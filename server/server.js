require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { initializeLTI, isLtiInstructor } = require('./middleware/ltiMiddleware');
const { validateLTIRequest } = initializeLTI();
const { sendGradeToMoodle } = require('./services/ltiService');
const { generateGamePdf } = require('./services/pdfGeneratorService');
const { initDatabase, getDatabase } = require('./db/database');
const { createUserRepository } = require('./db/userRepository');
const { issueToken, verifyToken, extractToken } = require('./utils/authToken');
const apiRoutes = require('./routes');

initDatabase();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    // cors по умолчанию ставит '*', что запрещено вместе с credentials: true.
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
// Body parsers нужны глобально (в том числе до multer и роутов PDF).
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET || 'conundrum-dev-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        maxAge: 86400000
    }
}));

// === ПОДКЛЮЧЕНИЕ ВСЕХ API РОУТОВ ОДНОЙ СТРОКОЙ ===
app.use('/api', apiRoutes);

// === HEALTH CHECK ===
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// === LTI и PDF ===
app.post('/api/lti/submit-score', async (req, res) => {
    // Браузеры всё чаще блокируют сторонние cookie внутри iframe LMS, поэтому
    // данные outcome дублируются в JWT и принимаются наравне с сессией.
    const tokenClaims = verifyToken(extractToken(req)) || {};
    const session = req.session || {};
    const hasSessionOutcome = Boolean(
        session.lti && session.lis_outcome_service_url && session.lis_result_sourcedid
    );
    const hasTokenOutcome = Boolean(
        tokenClaims.lti && tokenClaims.lis_outcome_service_url && tokenClaims.lis_result_sourcedid
    );
    if (!hasSessionOutcome && !hasTokenOutcome) {
        return res.status(403).json({ error: 'No LTI session' });
    }
    try {
        const { score, totalScore } = req.body;
        await sendGradeToMoodle(
            tokenClaims.lis_outcome_service_url || session.lis_outcome_service_url,
            tokenClaims.lis_result_sourcedid || session.lis_result_sourcedid,
            parseFloat(score), parseFloat(totalScore),
            process.env.LTI_KEY, process.env.LTI_SECRET
        );
        res.json({ message: 'Score submitted' });
    } catch (e) { res.status(500).json({ error: 'Score submission failed' }); }
});

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const pdfBuffer = await generateGamePdf({
            ...req.body.gameData,
            name: req.body.gameName,
            shareId: req.body.shareId || req.body.gameData?.share_id || null,
            shareUrl: req.body.shareUrl || null
        });
        const safeName = encodeURIComponent(req.body.gameName || 'game').replace(/[^a-zA-Z0-9-_.]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
        res.send(pdfBuffer);
    } catch (e) { res.status(500).json({ error: 'PDF Error' }); }
});

app.post('/lti/launch', validateLTIRequest, async (req, res) => {
    try {
        const ltiSession = req.session || {};
        const ltiUserId = ltiSession.userId;
        if (!ltiUserId) return res.status(400).send('LTI Error: missing user id');

        const email = ltiSession.lis_person_contact_email_primary || `lti-${ltiUserId}@local`;
        const username = ltiSession.lis_person_name_full || `LTI ${ltiUserId}`;
        const users = createUserRepository({ db: getDatabase() });
        const user = users.upsertLtiUser({
            email,
            username,
            password_hash: bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10)
        });

        const resourceLinkId = ltiSession.resource_link_id || '';
        const isInstructor = isLtiInstructor(ltiSession.roles);
        const token = issueToken(user, {
            lti: true,
            ltiUserId,
            ltiRole: isInstructor ? 'instructor' : 'learner',
            resource_link_id: resourceLinkId,
            lis_outcome_service_url: ltiSession.lis_outcome_service_url || null,
            lis_result_sourcedid: ltiSession.lis_result_sourcedid || null
        });

        const redirectUrl = new URL((process.env.CLIENT_URL || 'http://localhost') + '/gamegenerator');
        redirectUrl.searchParams.append('auth_token', token);
        redirectUrl.searchParams.append('lti', 'true');
        redirectUrl.searchParams.append(
            'mode',
            isInstructor ? 'configure' : 'solve'
        );
        redirectUrl.searchParams.append('resource_link_id', resourceLinkId);

        res.redirect(redirectUrl.toString());
    } catch (e) {
        console.error(e);
        res.status(500).send('LTI Error');
    }
});

// Все ошибки API отдают JSON: клиент не должен получать HTML вместо описания проблемы.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const isBodyTooLarge = err?.type === 'entity.too.large' || err?.status === 413;
    const isBadJson = err instanceof SyntaxError && 'body' in err;
    if (!isBodyTooLarge && !isBadJson) return next(err);

    res.status(isBodyTooLarge ? 413 : 400).json({
        error: isBodyTooLarge
            ? 'Request body is too large.'
            : 'Invalid JSON body.'
    });
});

module.exports = app;
module.exports.app = app;

if (require.main === module) {
    app.listen(process.env.PORT || 5000, () => console.log('Server started'));
}

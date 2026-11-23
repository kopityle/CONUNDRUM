require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { initializeLTI } = require('./middleware/ltiMiddleware');
const { validateLTIRequest } = initializeLTI();
const { sendGradeToMoodle } = require('./services/ltiService');
const { generateGamePdf } = require('./services/pdfGeneratorService');
const { initDatabase, getDatabase } = require('./db/database');
const { createUserRepository } = require('./db/userRepository');
const { issueToken } = require('./utils/authToken');
const apiRoutes = require('./routes');

initDatabase();

const app = express();

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
// Body parsers нужны глобально
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    if (!req.session?.lti) return res.status(403).json({ error: 'No LTI session' });
    try {
        const { score, totalScore } = req.body;
        await sendGradeToMoodle(
            req.session.lis_outcome_service_url,
            req.session.lis_result_sourcedid,
            parseFloat(score), parseFloat(totalScore),
            process.env.LTI_KEY, process.env.LTI_SECRET
        );
        res.json({ message: 'Score submitted' });
    } catch (e) { res.status(500).json({ error: 'Score submission failed' }); }
});

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const pdfBuffer = await generateGamePdf({ ...req.body.gameData, name: req.body.gameName });
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
        const token = issueToken(user, {
            lti: true,
            ltiUserId,
            resource_link_id: resourceLinkId
        });

        const redirectUrl = new URL((process.env.CLIENT_URL || 'http://localhost') + '/gamegenerator');
        redirectUrl.searchParams.append('auth_token', token);
        redirectUrl.searchParams.append('lti', 'true');
        redirectUrl.searchParams.append(
            'mode',
            String(ltiSession.roles || '').toLowerCase().includes('instructor') ? 'configure' : 'solve'
        );
        redirectUrl.searchParams.append('resource_link_id', resourceLinkId);

        res.redirect(redirectUrl.toString());
    } catch (e) {
        console.error(e);
        res.status(500).send('LTI Error');
    }
});

module.exports = app;
module.exports.app = app;

if (require.main === module) {
    app.listen(process.env.PORT || 5000, () => console.log('Server started'));
}

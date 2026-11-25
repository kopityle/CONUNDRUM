require('dotenv').config();
const crypto = require('crypto');

const INSTRUCTOR_ROLES = [
    'instructor',
    'teacher',
    'administrator',
    'contentdeveloper',
    'teachingassistant',
];

function isLtiInstructor(roles) {
    const normalized = String(roles || '').toLowerCase();
    return INSTRUCTOR_ROLES.some((role) => normalized.includes(role));
}

const initializeLTI = () => {
    // Функция для проверки подписи LTI запроса
    const validateLTIRequest = (req, res, next) => {
        // Получаем подпись из запроса (из body ИЛИ headers)
        const oauthSignature = req.body?.oauth_signature
            || req.query?.oauth_signature
            || req.headers['oauth_signature'];
        // Получаем секрет из переменных окружения
        const consumerSecret = process.env.LTI_SECRET;

        if (!consumerSecret) {
            console.error('Error: LTI_SECRET environment variable is not set.');
            return res.status(500).send('LTI configuration error.');
        }

        if (!oauthSignature) {
            return res.status(401).send('Unauthorized: Missing OAuth signature');
        }

        // Проверяем подпись
        const isValid = verifySignature(req, consumerSecret);

        if (!isValid) {
            console.error('Invalid LTI signature');
            return res.status(401).send('Unauthorized: Invalid OAuth signature');
        }

        // Аутентификация успешна
        const userId = req.body.user_id;
        req.session.userId = userId;
        req.session.lti = true;
        req.session.roles = req.body.roles || '';
        req.session.resource_link_id = req.body.resource_link_id;
        // Сохраняем все нужные данные в сессию
        req.session.lis_outcome_service_url = req.body.lis_outcome_service_url;
        req.session.lis_result_sourcedid = req.body.lis_result_sourcedid;
        req.session.lis_person_contact_email_primary = req.body.lis_person_contact_email_primary;
        req.session.lis_person_name_full = req.body.lis_person_name_full;

        console.log('LTI validation successful for user:', userId);
        next(); // Переходим к следующему middleware
    };

    // Функция для проверки подписи OAuth 1.0a
    const verifySignature = (req, consumerSecret) => {
        const oauthSignature = req.body?.oauth_signature
            || req.query?.oauth_signature
            || req.headers['oauth_signature'];
        // OAuth 1.0 нормализует и параметры строки запроса, и параметры тела.
        const params = { ...(req.query || {}), ...(req.body || {}) };
        delete params.oauth_signature;

        // 1. Собираем и кодируем параметры (OAuth 1.0 normalized parameters)
        const encodedParams = Object.keys(params)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');

        // 2. Базовый URL должен совпадать с URL, который Moodle подписал.
        // req.protocol учитывает X-Forwarded-Proto (trust proxy в server.js),
        // а originalUrl — это тот путь, на который реально пришёл launch.
        const launchPath = req.originalUrl.split('?')[0];
        const baseUrl = `${req.protocol}://${req.get('host')}${launchPath}`;
        const baseString = `POST&${encodeURIComponent(baseUrl)}&${encodeURIComponent(encodedParams)}`;

        // 3. HMAC-SHA1 с пустым token secret (LTI 1.1)
        const signingKey = `${encodeURIComponent(consumerSecret)}&`;
        const hash = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

        // 4. Сравниваем подписи безопасно (если возможно)
        try {
            return crypto.timingSafeEqual(Buffer.from(hash, 'base64'), Buffer.from(oauthSignature, 'base64'));
        } catch (e) {
            // Fallback for environments without timingSafeEqual or if buffers have different lengths
            return hash === oauthSignature;
        }
    };

    return {
        validateLTIRequest
    };
};

module.exports = { initializeLTI, isLtiInstructor };
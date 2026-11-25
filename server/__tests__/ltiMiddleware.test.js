const crypto = require('crypto');
const { initializeLTI, isLtiInstructor } = require('../middleware/ltiMiddleware');

const SECRET = 'lti-test-secret';

function signedRequest({ protocol = 'https', host = 'moodle.test', query = {}, body = {} } = {}) {
    const params = { ...query, ...body };
    const encoded = Object.keys(params)
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    const baseUrl = `${protocol}://${host}/lti/launch`;
    const baseString = `POST&${encodeURIComponent(baseUrl)}&${encodeURIComponent(encoded)}`;
    const signature = crypto
        .createHmac('sha1', `${encodeURIComponent(SECRET)}&`)
        .update(baseString)
        .digest('base64');

    return {
        body: { ...body, oauth_signature: signature },
        query,
        protocol,
        originalUrl: '/lti/launch',
        headers: {},
        session: {},
        get: (name) => (name === 'host' ? host : undefined),
    };
}

describe('LTI middleware', () => {
    const originalSecret = process.env.LTI_SECRET;

    beforeEach(() => { process.env.LTI_SECRET = SECRET; });
    afterEach(() => {
        if (originalSecret === undefined) delete process.env.LTI_SECRET;
        else process.env.LTI_SECRET = originalSecret;
    });

    test('роли преподавателя распознаются, Learner — нет', () => {
        expect(isLtiInstructor('Instructor')).toBe(true);
        expect(isLtiInstructor('urn:lti:role:ims/lis/Teacher')).toBe(true);
        expect(isLtiInstructor('Administrator,ContentDeveloper')).toBe(true);
        expect(isLtiInstructor('Learner')).toBe(false);
        expect(isLtiInstructor('')).toBe(false);
    });

    test('подпись проверяется по фактическому launch URL и параметрам запроса', () => {
        const { validateLTIRequest } = initializeLTI();
        const req = signedRequest({
            protocol: 'http',
            host: 'moodle.test:8080',
            query: { custom_param: 'from-query' },
            body: {
                user_id: 'student-1',
                roles: 'Learner',
                lis_outcome_service_url: 'https://moodle.test/mod/lti/service.php',
                lis_result_sourcedid: 'source-1',
            },
        });
        const res = { status: jest.fn(() => res), send: jest.fn(() => res) };
        const next = jest.fn();

        validateLTIRequest(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.userId).toBe('student-1');
        expect(req.session.roles).toBe('Learner');
        expect(req.session.lis_result_sourcedid).toBe('source-1');
    });

    test('неверная подпись отвергается', () => {
        const { validateLTIRequest } = initializeLTI();
        const req = signedRequest({ body: { user_id: 'student-1' } });
        req.body.oauth_signature = 'invalid';
        const res = { status: jest.fn(() => res), send: jest.fn(() => res) };
        const next = jest.fn();

        validateLTIRequest(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createDatabase } = require('../db/database');
const { createAuthController } = require('../controllers/AuthController');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        cookie() {
            return this;
        },
        clearedCookies: [],
        clearCookie(name) {
            this.clearedCookies.push(name);
            return this;
        }
    };
}

function makeReq(body = {}, headers = {}) {
    return { body, headers, cookies: {} };
}

describe('AuthController', () => {
    let db;
    let controller;
    let auth;

    beforeEach(() => {
        db = createDatabase(':memory:');
        controller = createAuthController({ db });
        auth = createAuthMiddleware({ db });
    });

    afterEach(() => {
        db.close();
    });

    function registration(email = `teacher-${crypto.randomUUID()}@example.com`) {
        return {
            email,
            password: 'strong-password',
            username: 'Teacher',
            occupation: 'teacher',
            gender: 'female'
        };
    }

    test('register stores a bcrypt hash and returns a token', async () => {
        const body = registration();
        const req = makeReq(body);
        const res = makeRes();

        await controller.register(req, res);

        expect(res.statusCode).toBe(201);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user.email).toBe(body.email);
        expect(res.body.user).not.toHaveProperty('password_hash');

        const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(body.email);
        expect(row.password_hash).not.toBe(body.password);
        expect(bcrypt.compareSync(body.password, row.password_hash)).toBe(true);
    });

    test('login returns a token for valid credentials', async () => {
        const body = registration();
        await controller.register(makeReq(body), makeRes());

        const res = makeRes();
        await controller.login(makeReq({ email: body.email, password: body.password }), res);

        expect(res.statusCode).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user.email).toBe(body.email);
    });

    test('login rejects a wrong password', async () => {
        const body = registration();
        await controller.register(makeReq(body), makeRes());

        const res = makeRes();
        await controller.login(makeReq({ email: body.email, password: 'wrong' }), res);

        expect(res.statusCode).toBe(401);
    });

    test('me works with a Bearer token', async () => {
        const body = registration();
        const registerRes = makeRes();
        await controller.register(makeReq(body), registerRes);

        const req = makeReq({}, { authorization: `Bearer ${registerRes.body.token}` });
        const next = jest.fn();
        auth.requireAuth(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);

        const res = makeRes();
        controller.me(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.user.email).toBe(body.email);
    });

    test('me works with the conundrum_token cookie', async () => {
        const body = registration();
        const registerRes = makeRes();
        await controller.register(makeReq(body), registerRes);

        const req = makeReq({}, {});
        req.cookies = { conundrum_token: registerRes.body.token };
        const res = makeRes();
        controller.me(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.user.id).toBe(registerRes.body.user.id);
    });

    test('profile updates and returns the user', async () => {
        const body = registration();
        const registerRes = makeRes();
        await controller.register(makeReq(body), registerRes);

        const req = makeReq({ username: 'Updated Teacher', occupation: 'admin', gender: 'other' }, {
            authorization: `Bearer ${registerRes.body.token}`
        });
        const res = makeRes();
        controller.profile(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.user.username).toBe('Updated Teacher');
        expect(res.body.user.occupation).toBe('admin');
        expect(db.prepare('SELECT username FROM users WHERE id = ?').get(registerRes.body.user.id).username)
            .toBe('Updated Teacher');
    });

    test('duplicate email returns 409', async () => {
        const body = registration();
        await controller.register(makeReq(body), makeRes());

        const res = makeRes();
        await controller.register(makeReq(body), res);

        expect(res.statusCode).toBe(409);
    });

    test('logout clears the cookie without requiring a token', () => {
        const res = makeRes();
        controller.logout(makeReq(), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(res.clearedCookies).toContain('conundrum_token');
    });
});

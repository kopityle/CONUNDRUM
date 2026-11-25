'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDatabaseAsync } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { extractToken, verifyToken, issueToken, setTokenCookie, clearTokenCookie } = require('../utils/authToken');

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        occupation: user.occupation,
        gender: user.gender,
        created_at: user.created_at
    };
}

function isFilledString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function createAuthController(options = {}) {
    const resolveDb = async () => options.db || await getDatabaseAsync();

    async function authenticate(req) {
        if (req.user) return req.user;
        const payload = verifyToken(extractToken(req));
        if (!payload?.sub) return null;
        return createUserRepository({ db: await resolveDb() }).findById(payload.sub);
    }

    return {
        async register(req, res) {
            try {
                const body = req.body || {};
                const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
                const password = body.password;
                const username = typeof body.username === 'string' ? body.username.trim() : '';

                if (!email || !email.includes('@')) {
                    return res.status(400).json({ error: 'A valid email is required' });
                }
                if (!isFilledString(password)) {
                    return res.status(400).json({ error: 'Password is required' });
                }
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const users = createUserRepository({ db: await resolveDb() });
                if (await users.findByEmail(email)) {
                    return res.status(409).json({ error: 'Email already in use' });
                }

                const user = await users.create({
                    id: crypto.randomUUID(),
                    email,
                    password_hash: await bcrypt.hash(password, 10),
                    username,
                    occupation: body.occupation === undefined || body.occupation === null ? null : String(body.occupation),
                    gender: body.gender === undefined || body.gender === null ? null : String(body.gender),
                    created_at: new Date().toISOString()
                });

                const token = issueToken(user);
                setTokenCookie(res, token);
                return res.status(201).json({ token, user: publicUser(user) });
            } catch (error) {
                return res.status(500).json({ error: 'Registration failed' });
            }
        },

        async login(req, res) {
            try {
                const body = req.body || {};
                const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
                const password = body.password;

                if (!email || !isFilledString(password)) {
                    return res.status(400).json({ error: 'Email and password are required' });
                }

                const user = await createUserRepository({ db: await resolveDb() }).findByEmail(email);
                if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
                    return res.status(401).json({ error: 'Invalid email or password' });
                }

                const token = issueToken(user);
                setTokenCookie(res, token);
                return res.status(200).json({ token, user: publicUser(user) });
            } catch (error) {
                return res.status(500).json({ error: 'Login failed' });
            }
        },

        async me(req, res) {
            const user = await authenticate(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            return res.status(200).json({ user: publicUser(user) });
        },

        async profile(req, res) {
            try {
                const user = await authenticate(req);
                if (!user) return res.status(401).json({ error: 'Unauthorized' });

                const body = req.body || {};
                if (!['username', 'occupation', 'gender'].some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
                    return res.status(400).json({ error: 'No profile fields to update' });
                }
                if (Object.prototype.hasOwnProperty.call(body, 'username') && !isFilledString(body.username)) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const changes = {};
                if (Object.prototype.hasOwnProperty.call(body, 'username')) {
                    changes.username = String(body.username).trim();
                }
                if (Object.prototype.hasOwnProperty.call(body, 'occupation')) {
                    changes.occupation = body.occupation === null ? null : String(body.occupation);
                }
                if (Object.prototype.hasOwnProperty.call(body, 'gender')) {
                    changes.gender = body.gender === null ? null : String(body.gender);
                }

                const updated = await createUserRepository({ db: await resolveDb() })
                    .updateProfile(user.id, changes);
                return res.status(200).json({ user: publicUser(updated) });
            } catch (error) {
                return res.status(500).json({ error: 'Profile update failed' });
            }
        },

        logout(req, res) {
            clearTokenCookie(res);
            return res.status(200).json({ success: true });
        }
    };
}

const controller = createAuthController();

module.exports = controller;
module.exports.createAuthController = createAuthController;
module.exports.publicUser = publicUser;

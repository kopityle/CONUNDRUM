'use strict';

const { getDatabaseAsync } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { extractToken, verifyToken } = require('../utils/authToken');

function createAuthMiddleware(options = {}) {
    const resolveDb = async () => options.db || await getDatabaseAsync();

    async function authenticate(req, required) {
        const payload = verifyToken(extractToken(req));
        if (!payload || !payload.sub) {
            return required ? { error: 'Unauthorized' } : null;
        }
        const user = await createUserRepository({ db: await resolveDb() }).findById(payload.sub);
        if (!user) {
            return required ? { error: 'Unauthorized' } : null;
        }
        req.user = user;
        req.auth = payload;
        return { user };
    }

    return {
        async requireAuth(req, res, next) {
            try {
                const result = await authenticate(req, true);
                if (result.error) return res.status(401).json({ error: result.error });
                return next();
            } catch (error) {
                return next(error);
            }
        },
        async optionalAuth(req, res, next) {
            try {
                await authenticate(req, false);
                return next();
            } catch (error) {
                return next(error);
            }
        }
    };
}

async function requireAuth(req, res, next) {
    return createAuthMiddleware().requireAuth(req, res, next);
}

async function optionalAuth(req, res, next) {
    return createAuthMiddleware().optionalAuth(req, res, next);
}

module.exports = { createAuthMiddleware, requireAuth, optionalAuth };

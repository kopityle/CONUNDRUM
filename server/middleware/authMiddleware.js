'use strict';

const { getDatabase, initDatabase } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { extractToken, verifyToken } = require('../utils/authToken');

function createAuthMiddleware(options = {}) {
    const resolveDb = () => options.db || getDatabase() || initDatabase();

    function authenticate(req, required) {
        const payload = verifyToken(extractToken(req));
        if (!payload || !payload.sub) {
            return required ? { error: 'Unauthorized' } : null;
        }
        const user = createUserRepository({ db: resolveDb() }).findById(payload.sub);
        if (!user) {
            return required ? { error: 'Unauthorized' } : null;
        }
        req.user = user;
        req.auth = payload;
        return { user };
    }

    return {
        requireAuth(req, res, next) {
            const result = authenticate(req, true);
            if (result.error) return res.status(401).json({ error: result.error });
            return next();
        },
        optionalAuth(req, res, next) {
            authenticate(req, false);
            return next();
        }
    };
}

function requireAuth(req, res, next) {
    return createAuthMiddleware().requireAuth(req, res, next);
}

function optionalAuth(req, res, next) {
    return createAuthMiddleware().optionalAuth(req, res, next);
}

module.exports = { createAuthMiddleware, requireAuth, optionalAuth };

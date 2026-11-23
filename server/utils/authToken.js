'use strict';

const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'conundrum_token';
const TOKEN_TTL = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
    return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'conundrum-dev-secret';
}

function issueToken(user, claims = {}) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            username: user.username,
            ...claims
        },
        getSecret(),
        { expiresIn: TOKEN_TTL }
    );
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const payload = jwt.verify(token, getSecret());
        return payload && typeof payload === 'object' ? payload : null;
    } catch (_) {
        return null;
    }
}

function parseCookieHeader(header) {
    const cookies = {};
    if (!header || typeof header !== 'string') return cookies;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1) continue;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
    }
    return cookies;
}

function extractToken(req) {
    if (!req) return null;
    const authorization = req.headers?.authorization || req.headers?.Authorization;
    if (typeof authorization === 'string') {
        const match = authorization.match(/^Bearer\s+(.+)$/i);
        if (match) return match[1].trim();
    }
    if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
    if (req.signedCookies?.[COOKIE_NAME]) return req.signedCookies[COOKIE_NAME];
    return parseCookieHeader(req.headers?.cookie)[COOKIE_NAME] || null;
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/'
    };
}

function setTokenCookie(res, token) {
    if (res && typeof res.cookie === 'function') {
        res.cookie(COOKIE_NAME, token, cookieOptions());
    }
}

function clearTokenCookie(res) {
    if (res && typeof res.clearCookie === 'function') {
        const { maxAge, ...options } = cookieOptions();
        res.clearCookie(COOKIE_NAME, options);
    }
}

module.exports = {
    COOKIE_NAME,
    TOKEN_TTL,
    getSecret,
    issueToken,
    verifyToken,
    extractToken,
    setTokenCookie,
    clearTokenCookie
};

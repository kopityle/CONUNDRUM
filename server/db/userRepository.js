'use strict';

const crypto = require('crypto');
const { toAsyncDb } = require('./asyncDb');

function createUserRepository({ db }) {
    const store = toAsyncDb(db);

    const findById = async (id) =>
        store.prepare('SELECT * FROM users WHERE id = ?').get(id);

    const findByEmail = async (email) => {
        if (!email) return null;
        return store.prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
            .get(String(email).trim());
    };

    const create = async ({ id, email, password_hash, username, occupation, gender, created_at }) => {
        const userId = id || crypto.randomUUID();
        await store.prepare(`
            INSERT INTO users (id, email, password_hash, username, occupation, gender, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            email,
            password_hash,
            username,
            occupation === undefined ? null : occupation,
            gender === undefined ? null : gender,
            created_at || new Date().toISOString()
        );
        return findById(userId);
    };

    const updateProfile = async (id, { username, occupation, gender }) => {
        const current = await findById(id);
        if (!current) return null;
        await store.prepare(`
            UPDATE users SET username = ?, occupation = ?, gender = ? WHERE id = ?
        `).run(
            username === undefined ? current.username : username,
            occupation === undefined ? current.occupation : occupation,
            gender === undefined ? current.gender : gender,
            id
        );
        return findById(id);
    };

    // Used by the LTI launch: the same LMS user keeps one local account.
    const upsertLtiUser = async ({ email, username, password_hash }) => {
        const existing = await findByEmail(email);
        if (existing) {
            await store.prepare('UPDATE users SET username = ? WHERE id = ?')
                .run(username, existing.id);
            return findById(existing.id);
        }
        return create({
            email,
            password_hash,
            username,
            occupation: '',
            gender: '',
            created_at: new Date().toISOString()
        });
    };

    return { findById, findByEmail, create, updateProfile, upsertLtiUser };
}

module.exports = { createUserRepository };

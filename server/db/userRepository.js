'use strict';

const crypto = require('crypto');

function createUserRepository({ db }) {
    return {
        findById(id) {
            return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
        },

        findByEmail(email) {
            if (!email) return null;
            return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim()) || null;
        },

        create({ id, email, password_hash, username, occupation, gender, created_at }) {
            const userId = id || crypto.randomUUID();
            db.prepare(`
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
            return this.findById(userId);
        },

        updateProfile(id, { username, occupation, gender }) {
            const current = this.findById(id);
            if (!current) return null;
            db.prepare(`
                UPDATE users SET username = ?, occupation = ?, gender = ? WHERE id = ?
            `).run(
                username === undefined ? current.username : username,
                occupation === undefined ? current.occupation : occupation,
                gender === undefined ? current.gender : gender,
                id
            );
            return this.findById(id);
        },

        // Used by the LTI launch: the same LMS user keeps one local account.
        upsertLtiUser({ email, username, password_hash }) {
            const existing = this.findByEmail(email);
            if (existing) {
                db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, existing.id);
                return this.findById(existing.id);
            }
            return this.create({
                email,
                password_hash,
                username,
                occupation: '',
                gender: '',
                created_at: new Date().toISOString()
            });
        }
    };
}

module.exports = { createUserRepository };

'use strict';

const crypto = require('crypto');
const { toAsyncDb } = require('./asyncDb');

function encodeJson(value) {
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch (_) {
            return JSON.stringify(value);
        }
    }
    return JSON.stringify(value === undefined ? null : value);
}

function createPuzzleRepository({ db }) {
    const store = toAsyncDb(db);

    const findById = async (id) =>
        store.prepare('SELECT * FROM puzzles WHERE id = ?').get(id);

    const findByShareId = async (shareId) =>
        store.prepare('SELECT * FROM puzzles WHERE share_id = ?').get(shareId);

    const create = async ({ id, user_id, share_id, name, game_type, game_data, tags, created_at }) => {
        const puzzleId = id || crypto.randomUUID();
        await store.prepare(`
            INSERT INTO puzzles (id, user_id, share_id, name, game_type, game_data, tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            puzzleId,
            user_id || null,
            share_id,
            name,
            game_type,
            encodeJson(game_data),
            encodeJson(tags === undefined ? [] : tags),
            created_at || new Date().toISOString()
        );
        return findById(puzzleId);
    };

    const listByUser = (userId) => store.prepare(`
        SELECT p.id, p.user_id, p.share_id, p.name, p.game_type, p.game_data, p.tags,
               p.created_at,
               COUNT(a.id) AS attempt_count,
               COALESCE(AVG(a.score), 0) AS avg_score
        FROM puzzles p
        LEFT JOIN puzzle_attempts a ON a.puzzle_id = p.id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `).all(userId);

    const update = async (id, changes) => {
        const allowed = ['name', 'game_type', 'game_data', 'tags'];
        const sets = [];
        const values = [];

        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(changes, key)) {
                sets.push(`${key} = ?`);
                values.push(key === 'game_data' || key === 'tags' ? encodeJson(changes[key]) : changes[key]);
            }
        }
        if (!sets.length) return findById(id);

        values.push(id);
        await store.prepare(`UPDATE puzzles SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        return findById(id);
    };

    const deletePuzzle = async (id) => {
        await store.prepare('DELETE FROM puzzle_attempts WHERE puzzle_id = ?').run(id);
        const result = await store.prepare('DELETE FROM puzzles WHERE id = ?').run(id);
        return result.changes > 0;
    };

    const findAttemptById = async (id) =>
        store.prepare('SELECT * FROM puzzle_attempts WHERE id = ?').get(id);

    const addAttempt = async ({ id, puzzle_id, student_name, score, duration_sec, wrong_words, created_at }) => {
        const attemptId = id || crypto.randomUUID();
        await store.prepare(`
            INSERT INTO puzzle_attempts
                (id, puzzle_id, student_name, score, duration_sec, wrong_words, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            attemptId,
            puzzle_id,
            student_name,
            score,
            duration_sec,
            encodeJson(wrong_words === undefined ? [] : wrong_words),
            created_at || new Date().toISOString()
        );
        return findAttemptById(attemptId);
    };

    const getAttempts = (puzzleId) => store.prepare(`
        SELECT id, student_name, score, duration_sec, wrong_words, created_at
        FROM puzzle_attempts WHERE puzzle_id = ? ORDER BY created_at DESC
    `).all(puzzleId);

    const getAnalyticsSummary = async (puzzleId) =>
        store.prepare(`
            SELECT COUNT(id) AS attemptCount,
                   COALESCE(AVG(score), 0) AS averageScore,
                   COUNT(DISTINCT student_name) AS uniqueStudents
            FROM puzzle_attempts WHERE puzzle_id = ?
        `).get(puzzleId) || { attemptCount: 0, averageScore: 0, uniqueStudents: 0 };

    const getLtiConfig = async (resourceLinkId) =>
        store.prepare('SELECT * FROM lti_configurations WHERE resource_link_id = ?')
            .get(resourceLinkId);

    const upsertLtiConfig = async (resourceLinkId, generationParams, userId) => {
        const now = new Date().toISOString();
        const encoded = encodeJson(generationParams);
        const existing = await getLtiConfig(resourceLinkId);
        if (existing) {
            await store.prepare(`
                UPDATE lti_configurations
                SET generation_params = ?, user_id = ?, updated_at = ?
                WHERE resource_link_id = ?
            `).run(encoded, userId || existing.user_id || null, now, resourceLinkId);
        } else {
            await store.prepare(`
                INSERT INTO lti_configurations (resource_link_id, generation_params, user_id, updated_at)
                VALUES (?, ?, ?, ?)
            `).run(resourceLinkId, encoded, userId || null, now);
        }
        return getLtiConfig(resourceLinkId);
    };

    return {
        create,
        findById,
        findByShareId,
        listByUser,
        update,
        delete: deletePuzzle,
        addAttempt,
        findAttemptById,
        getAttempts,
        getAnalyticsSummary,
        getLtiConfig,
        upsertLtiConfig
    };
}

module.exports = { createPuzzleRepository, encodeJson };

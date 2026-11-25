'use strict';

const crypto = require('crypto');
const { getDatabaseAsync } = require('../db/database');
const { createPuzzleRepository } = require('../db/puzzleRepository');

function decodeJson(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return raw;
    }
}

function asWordList(value) {
    if (Array.isArray(value)) {
        return value.filter((word) => word !== null && word !== undefined)
            .map((word) => String(word).trim())
            .filter(Boolean);
    }
    if (typeof value !== 'string' || !value.trim()) return [];
    const parsed = decodeJson(value, null);
    if (Array.isArray(parsed)) return asWordList(parsed);
    return value.split(/[\s,;]+/).map((word) => word.trim()).filter(Boolean);
}

function formatPuzzle(row, withStats = false) {
    const puzzle = {
        id: row.id,
        share_id: row.share_id,
        name: row.name,
        game_type: row.game_type,
        game_data: decodeJson(row.game_data, {}),
        tags: decodeJson(row.tags, []),
        created_at: row.created_at
    };
    if (withStats) {
        puzzle.attempt_count = Number(row.attempt_count) || 0;
        puzzle.avg_score = Number(row.avg_score) || 0;
    }
    return puzzle;
}

function isFilledString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function createPuzzleController(options = {}) {
    const resolveDb = async () => options.db || await getDatabaseAsync();
    const repo = async () => createPuzzleRepository({ db: await resolveDb() });

    async function generateShareId(puzzles) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const shareId = crypto.randomBytes(6).toString('base64url');
            if (!(await puzzles.findByShareId(shareId))) return shareId;
        }
        // Extremely unlikely, but keep the 6-8 character contract even on collisions.
        return crypto.randomBytes(5).toString('base64url');
    }

    async function ownedPuzzle(req, res) {
        const puzzle = await (await repo()).findById(req.params.id);
        if (!puzzle || !req.user || puzzle.user_id !== req.user.id) {
            res.status(404).json({ error: 'Puzzle not found' });
            return null;
        }
        return puzzle;
    }

    return {
        async list(req, res) {
            const puzzles = (await (await repo()).listByUser(req.user.id))
                .map((row) => formatPuzzle(row, true));
            return res.status(200).json(puzzles);
        },

        async create(req, res) {
            try {
                const body = req.body || {};
                if (!isFilledString(body.name)) {
                    return res.status(400).json({ error: 'Puzzle name is required' });
                }
                if (!isFilledString(body.game_type)) {
                    return res.status(400).json({ error: 'Game type is required' });
                }
                if (body.game_data === undefined || body.game_data === null) {
                    return res.status(400).json({ error: 'Game data is required' });
                }

                const puzzles = await repo();
                const created = await puzzles.create({
                    user_id: req.user?.id || null,
                    share_id: await generateShareId(puzzles),
                    name: String(body.name).trim(),
                    game_type: String(body.game_type).trim(),
                    game_data: body.game_data,
                    tags: body.tags === undefined ? [] : body.tags,
                    created_at: new Date().toISOString()
                });
                return res.status(201).json(formatPuzzle(created));
            } catch (error) {
                return res.status(500).json({ error: 'Could not create puzzle' });
            }
        },

        async get(req, res) {
            const puzzle = await ownedPuzzle(req, res);
            if (!puzzle) return undefined;
            return res.status(200).json(formatPuzzle(puzzle));
        },

        async update(req, res) {
            const puzzle = await ownedPuzzle(req, res);
            if (!puzzle) return undefined;

            const body = req.body || {};
            const changes = {};
            if (Object.prototype.hasOwnProperty.call(body, 'name')) {
                if (!isFilledString(body.name)) return res.status(400).json({ error: 'Puzzle name is required' });
                changes.name = String(body.name).trim();
            }
            if (Object.prototype.hasOwnProperty.call(body, 'game_type')) {
                if (!isFilledString(body.game_type)) return res.status(400).json({ error: 'Game type is required' });
                changes.game_type = String(body.game_type).trim();
            }
            if (Object.prototype.hasOwnProperty.call(body, 'game_data')) {
                if (body.game_data === undefined || body.game_data === null) {
                    return res.status(400).json({ error: 'Game data is required' });
                }
                changes.game_data = body.game_data;
            }
            if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
                changes.tags = body.tags === undefined || body.tags === null ? [] : body.tags;
            }

            const updated = await (await repo()).update(puzzle.id, changes);
            return res.status(200).json(formatPuzzle(updated));
        },

        async delete(req, res) {
            const puzzle = await ownedPuzzle(req, res);
            if (!puzzle) return undefined;
            await (await repo()).delete(puzzle.id);
            return res.status(200).json({ success: true });
        },

        async analytics(req, res) {
            const puzzle = await ownedPuzzle(req, res);
            if (!puzzle) return undefined;

            const puzzles = await repo();
            const summary = await puzzles.getAnalyticsSummary(puzzle.id);
            const attempts = (await puzzles.getAttempts(puzzle.id)).map((attempt) => ({
                id: attempt.id,
                student_name: attempt.student_name,
                score: Number(attempt.score) || 0,
                duration_sec: Number(attempt.duration_sec) || 0,
                wrong_words: asWordList(attempt.wrong_words),
                created_at: attempt.created_at
            }));

            const frequencies = new Map();
            for (const attempt of attempts) {
                for (const rawWord of attempt.wrong_words) {
                    const word = rawWord.toLowerCase();
                    frequencies.set(word, (frequencies.get(word) || 0) + 1);
                }
            }
            const difficultWords = Array.from(frequencies, ([word, count]) => ({ word, count }))
                .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
                .slice(0, 10);

            return res.status(200).json({
                attemptCount: Number(summary.attemptCount) || 0,
                averageScore: Number(summary.averageScore) || 0,
                uniqueStudents: Number(summary.uniqueStudents) || 0,
                attempts,
                difficultWords
            });
        },

        async getPublicPuzzle(req, res) {
            const puzzle = await (await repo()).findByShareId(req.params.shareId);
            if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
            return res.status(200).json({
                id: puzzle.id,
                share_id: puzzle.share_id,
                name: puzzle.name,
                game_type: puzzle.game_type,
                game_data: decodeJson(puzzle.game_data, {})
            });
        },

        async createAttempt(req, res) {
            try {
                const puzzle = await (await repo()).findByShareId(req.params.shareId);
                if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });

                const body = req.body || {};
                if (!isFilledString(body.student_name)) {
                    return res.status(400).json({ error: 'Student name is required' });
                }
                const score = Number(body.score);
                if (body.score === undefined || body.score === null || body.score === '' || !Number.isFinite(score) || score < 0) {
                    return res.status(400).json({ error: 'A valid score is required' });
                }
                const duration = Number(body.duration_sec);
                if (body.duration_sec === undefined || body.duration_sec === null || body.duration_sec === '' ||
                    !Number.isFinite(duration) || duration < 0) {
                    return res.status(400).json({ error: 'A valid duration is required' });
                }

                const wrongWords = asWordList(body.wrong_words);
                const attempt = await (await repo()).addAttempt({
                    puzzle_id: puzzle.id,
                    student_name: String(body.student_name).trim(),
                    score,
                    duration_sec: Math.round(duration),
                    wrong_words: wrongWords,
                    created_at: new Date().toISOString()
                });

                return res.status(201).json({
                    id: attempt.id,
                    student_name: attempt.student_name,
                    score: Number(attempt.score),
                    duration_sec: Number(attempt.duration_sec),
                    wrong_words: asWordList(attempt.wrong_words)
                });
            } catch (error) {
                return res.status(500).json({ error: 'Could not save attempt' });
            }
        },

        async getLtiConfig(req, res) {
            const config = await (await repo()).getLtiConfig(req.params.resourceLinkId);
            return res.status(200).json({
                generation_params: config ? decodeJson(config.generation_params, null) : null
            });
        },

        async putLtiConfig(req, res) {
            const body = req.body || {};
            if (body.generationParams === undefined) {
                return res.status(400).json({ error: 'generationParams is required' });
            }
            const params = typeof body.generationParams === 'string'
                ? decodeJson(body.generationParams, {})
                : body.generationParams;
            await (await repo()).upsertLtiConfig(req.params.resourceLinkId, params, req.user?.id || null);
            return res.status(200).json({ success: true });
        }
    };
}

const controller = createPuzzleController();

module.exports = controller;
module.exports.createPuzzleController = createPuzzleController;
module.exports.formatPuzzle = formatPuzzle;

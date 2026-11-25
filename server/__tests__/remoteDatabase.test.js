const crypto = require('crypto');
const { createClient } = require('@libsql/client');
const { fromLibsql } = require('../db/asyncDb');
const { SCHEMA, isRemoteDatabase } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { createPuzzleRepository } = require('../db/puzzleRepository');

describe('внешняя база (libSQL)', () => {
    let db;

    beforeEach(async () => {
        db = fromLibsql(createClient({ url: 'file::memory:' }));
        await db.exec(SCHEMA);
    });

    afterEach(() => {
        db.close();
    });

    test('репозитории работают через один и тот же асинхронный API', async () => {
        const users = createUserRepository({ db });
        const puzzles = createPuzzleRepository({ db });

        const user = await users.create({
            id: crypto.randomUUID(),
            email: `remote-${crypto.randomUUID()}@example.com`,
            password_hash: 'hash',
            username: 'teacher'
        });
        expect((await users.findByEmail(user.email)).id).toBe(user.id);

        const puzzle = await puzzles.create({
            user_id: user.id,
            share_id: 'remote123',
            name: 'Внешний пазл',
            game_type: 'crossword',
            game_data: { words: ['alpha'] },
            tags: ['test']
        });
        expect((await puzzles.findByShareId('remote123')).name).toBe('Внешний пазл');
        expect(await puzzles.listByUser(user.id)).toHaveLength(1);

        const attempt = await puzzles.addAttempt({
            puzzle_id: puzzle.id,
            student_name: 'Ученик',
            score: 100,
            duration_sec: 30,
            wrong_words: []
        });
        expect(attempt.score).toBe(100);
        expect((await puzzles.getAnalyticsSummary(puzzle.id)).attemptCount).toBe(1);

        await puzzles.upsertLtiConfig('link-1', { topic: 'Школа' }, user.id);
        const config = await puzzles.getLtiConfig('link-1');
        expect(JSON.parse(config.generation_params).topic).toBe('Школа');

        expect(await puzzles.delete(puzzle.id)).toBe(true);
        expect(await puzzles.findById(puzzle.id)).toBeNull();
    });

    test('внешний режим включается только на сетевом URL', () => {
        const original = {
            TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
            DATABASE_URL: process.env.DATABASE_URL
        };
        try {
            delete process.env.TURSO_DATABASE_URL;
            process.env.DATABASE_URL = 'libsql://db-example.turso.io';
            expect(isRemoteDatabase()).toBe(true);

            process.env.DATABASE_URL = 'file:./local.db';
            expect(isRemoteDatabase()).toBe(false);
        } finally {
            for (const [key, value] of Object.entries(original)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        }
    });
});

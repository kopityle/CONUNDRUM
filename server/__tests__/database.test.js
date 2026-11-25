const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createDatabase } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { createPuzzleRepository } = require('../db/puzzleRepository');

describe('SQLite database', () => {
    let memoryDb;

    afterEach(() => {
        if (memoryDb) {
            memoryDb.close();
            memoryDb = null;
        }
    });

    test('createDatabase(":memory:") creates all tables', () => {
        memoryDb = createDatabase(':memory:');
        const tables = memoryDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
            .map((row) => row.name);

        expect(tables).toEqual(expect.arrayContaining([
            'users', 'puzzles', 'puzzle_attempts', 'lti_configurations'
        ]));
    });

    test('file database creates its directory and uses WAL', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conundrum-db-'));
        const file = path.join(root, 'nested', 'conundrum.db');
        const db = createDatabase(file);

        try {
            expect(fs.existsSync(file)).toBe(true);
            const mode = db.prepare('PRAGMA journal_mode').get().journal_mode;
            expect(String(mode).toLowerCase()).toBe('wal');
            expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
        } finally {
            db.close();
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('stores and reads users and puzzles', async () => {
        memoryDb = createDatabase(':memory:');
        const users = createUserRepository({ db: memoryDb });
        const puzzles = createPuzzleRepository({ db: memoryDb });

        const user = await users.create({
            id: crypto.randomUUID(),
            email: `user-${crypto.randomUUID()}@example.com`,
            password_hash: 'hashed-password',
            username: 'teacher',
            occupation: 'teacher',
            gender: 'female'
        });
        expect((await users.findById(user.id)).email).toBe(user.email);
        expect((await users.findByEmail(user.email)).id).toBe(user.id);

        const puzzle = await puzzles.create({
            user_id: user.id,
            share_id: 'abc123',
            name: 'Vocabulary crossword',
            game_type: 'crossword',
            game_data: { words: ['alpha'] },
            tags: ['vocabulary']
        });
        expect((await puzzles.findById(puzzle.id)).name).toBe('Vocabulary crossword');
        expect((await puzzles.findByShareId('abc123')).id).toBe(puzzle.id);
        expect(await puzzles.listByUser(user.id)).toHaveLength(1);
    });
});

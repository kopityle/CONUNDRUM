const crypto = require('crypto');
const { createDatabase } = require('../db/database');
const { createUserRepository } = require('../db/userRepository');
const { createPuzzleController } = require('../controllers/PuzzleController');

function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

function makeReq(body = {}, user = null, params = {}) {
    return { body, user, params, headers: {}, cookies: {} };
}

describe('PuzzleController', () => {
    let db;
    let controller;
    let user;

    beforeEach(async () => {
        db = createDatabase(':memory:');
        controller = createPuzzleController({ db });
        user = await createUserRepository({ db }).create({
            id: crypto.randomUUID(),
            email: `owner-${crypto.randomUUID()}@example.com`,
            password_hash: 'hash',
            username: 'owner'
        });
    });

    afterEach(() => {
        db.close();
    });

    const puzzleBody = () => ({
        name: 'Vocabulary puzzle',
        game_type: 'crossword',
        game_data: { words: ['apple', 'banana'] },
        tags: ['school', 'english']
    });

    async function createOwnedPuzzle() {
        const res = makeRes();
        await controller.create(makeReq(puzzleBody(), user), res);
        expect(res.statusCode).toBe(201);
        return res.body;
    }

    test('create generates a 6-8 character share_id and parses JSON fields', async () => {
        const res = makeRes();
        await controller.create(makeReq(puzzleBody(), user), res);

        expect(res.statusCode).toBe(201);
        expect(res.body.share_id).toMatch(/^[A-Za-z0-9_-]{6,8}$/);
        expect(res.body.game_data).toEqual({ words: ['apple', 'banana'] });
        expect(res.body.tags).toEqual(['school', 'english']);

        const guestRes = makeRes();
        await controller.create(makeReq(puzzleBody(), null), guestRes);
        expect(guestRes.statusCode).toBe(201);
        const row = db.prepare('SELECT user_id FROM puzzles WHERE id = ?').get(guestRes.body.id);
        expect(row.user_id).toBeNull();
    });

    test('owner list contains attempt_count and avg_score', async () => {
        const puzzle = await createOwnedPuzzle();

        const attemptRes = makeRes();
        await controller.createAttempt(makeReq({
            student_name: 'Student A',
            score: 80,
            duration_sec: 120,
            wrong_words: ['apple']
        }, null, { shareId: puzzle.share_id }), attemptRes);
        expect(attemptRes.statusCode).toBe(201);

        const res = makeRes();
        await controller.list(makeReq({}, user), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toEqual(expect.objectContaining({
            id: puzzle.id,
            share_id: puzzle.share_id,
            attempt_count: 1,
            avg_score: 80
        }));
    });

    test('get, update and delete respect ownership', async () => {
        const puzzle = await createOwnedPuzzle();

        const getRes = makeRes();
        await controller.get(makeReq({}, user, { id: puzzle.id }), getRes);
        expect(getRes.body.id).toBe(puzzle.id);

        const updateRes = makeRes();
        await controller.update(makeReq({ name: 'Renamed puzzle', tags: ['updated'] }, user, { id: puzzle.id }), updateRes);
        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.name).toBe('Renamed puzzle');
        expect(updateRes.body.tags).toEqual(['updated']);
        expect(updateRes.body.share_id).toBe(puzzle.share_id);

        const otherUser = await createUserRepository({ db }).create({
            id: crypto.randomUUID(),
            email: `other-${crypto.randomUUID()}@example.com`,
            password_hash: 'hash',
            username: 'other'
        });
        const forbiddenRes = makeRes();
        await controller.get(makeReq({}, otherUser, { id: puzzle.id }), forbiddenRes);
        expect(forbiddenRes.statusCode).toBe(404);

        const deleteRes = makeRes();
        await controller.delete(makeReq({}, user, { id: puzzle.id }), deleteRes);
        expect(deleteRes.statusCode).toBe(200);
        expect(deleteRes.body).toEqual({ success: true });
        expect(db.prepare('SELECT id FROM puzzles WHERE id = ?').get(puzzle.id)).toBeUndefined();
    });

    test('analytics counts difficult words from wrong_words', async () => {
        const puzzle = await createOwnedPuzzle();
        const attempts = [
            { student_name: 'Anna', score: 70, duration_sec: 60, wrong_words: ['apple', 'banana', 'apple'] },
            { student_name: 'Ben', score: 90, duration_sec: 45, wrong_words: ['apple', 'cherry'] },
            { student_name: 'Anna', score: 60, duration_sec: 80, wrong_words: 'cherry, date' }
        ];
        for (const attempt of attempts) {
            const res = makeRes();
            await controller.createAttempt(makeReq(attempt, null, { shareId: puzzle.share_id }), res);
            expect(res.statusCode).toBe(201);
        }

        const res = makeRes();
        await controller.analytics(makeReq({}, user, { id: puzzle.id }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.attemptCount).toBe(3);
        expect(res.body.averageScore).toBeCloseTo((70 + 90 + 60) / 3);
        expect(res.body.uniqueStudents).toBe(2);
        expect(res.body.attempts).toHaveLength(3);
        expect(res.body.attempts[0].wrong_words).toBeInstanceOf(Array);
        expect(res.body.difficultWords).toEqual([
            { word: 'apple', count: 3 },
            { word: 'cherry', count: 2 },
            { word: 'banana', count: 1 },
            { word: 'date', count: 1 }
        ]);
    });

    test('public GET by share_id and POST attempt work without auth', async () => {
        const puzzle = await createOwnedPuzzle();

        const getRes = makeRes();
        await controller.getPublicPuzzle(makeReq({}, null, { shareId: puzzle.share_id }), getRes);

        expect(getRes.statusCode).toBe(200);
        expect(getRes.body).toEqual(expect.objectContaining({
            id: puzzle.id,
            share_id: puzzle.share_id,
            name: puzzle.name,
            game_type: puzzle.game_type,
            game_data: puzzle.game_data
        }));

        const attemptRes = makeRes();
        await controller.createAttempt(makeReq({
            student_name: 'Guest student',
            score: 5,
            duration_sec: 30,
            wrong_words: 'banana cherry'
        }, null, { shareId: puzzle.share_id }), attemptRes);

        expect(attemptRes.statusCode).toBe(201);
        expect(attemptRes.body.student_name).toBe('Guest student');
        expect(attemptRes.body.score).toBe(5);
        expect(attemptRes.body.duration_sec).toBe(30);
        expect(attemptRes.body.wrong_words).toEqual(['banana', 'cherry']);

        const stored = db.prepare('SELECT wrong_words FROM puzzle_attempts WHERE id = ?').get(attemptRes.body.id);
        expect(JSON.parse(stored.wrong_words)).toEqual(['banana', 'cherry']);
    });
});

const RateLimiter = require('../utils/RateLimiter');

describe('RateLimiter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('limits requests per key independently', () => {
        const limiter = new RateLimiter(2, 1000);

        expect(limiter.tryConsume('1.1.1.1')).toBe(true);
        expect(limiter.tryConsume('1.1.1.1')).toBe(true);
        expect(limiter.tryConsume('1.1.1.1')).toBe(false);

        expect(limiter.tryConsume('2.2.2.2')).toBe(true);
        expect(limiter.tryConsume('2.2.2.2')).toBe(true);
        expect(limiter.tryConsume('2.2.2.2')).toBe(false);
    });

    test('cleans stale timestamps and empty client entries automatically', () => {
        const limiter = new RateLimiter(1, 1000);

        expect(limiter.tryConsume('1.1.1.1')).toBe(true);
        expect(limiter.size).toBe(1);
        expect(limiter.tryConsume('1.1.1.1')).toBe(false);

        jest.advanceTimersByTime(1001);

        // запись удаляется при следующем обращении, даже к другому IP
        expect(limiter.tryConsume('2.2.2.2')).toBe(true);
        expect(limiter.size).toBe(1);
        expect(limiter.tryConsume('1.1.1.1')).toBe(true);
    });

    test('reset clears all clients', () => {
        const limiter = new RateLimiter(1, 1000);
        limiter.tryConsume('1.1.1.1');
        limiter.reset();
        expect(limiter.size).toBe(0);
        expect(limiter.tryConsume('1.1.1.1')).toBe(true);
    });
});

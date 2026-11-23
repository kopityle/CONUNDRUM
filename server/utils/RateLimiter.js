/**
 * Лимитер запросов с раздельными квотами по ключу (обычно — IP клиента).
 * Старые записи удаляются при каждом обращении, поэтому Map не растёт бесконечно.
 */
class RateLimiter {
    constructor(limit = 20, interval = 60000) {
        this.limit = limit;
        this.interval = interval;
        this.clients = new Map();
    }

    tryConsume(key = 'default') {
        const clientKey = key || 'unknown';
        const now = Date.now();
        this.prune(now);

        const recent = (this.clients.get(clientKey) || []).filter(
            (time) => now - time < this.interval
        );

        if (recent.length >= this.limit) {
            this.clients.set(clientKey, recent);
            return false;
        }

        recent.push(now);
        this.clients.set(clientKey, recent);
        return true;
    }

    /** Удаляет истёкшие отметки и полностью пустые записи клиентов. */
    prune(now = Date.now()) {
        for (const [key, timestamps] of this.clients) {
            const recent = timestamps.filter((time) => now - time < this.interval);
            if (recent.length === 0) {
                this.clients.delete(key);
            } else {
                this.clients.set(key, recent);
            }
        }
    }

    get size() {
        this.prune();
        return this.clients.size;
    }

    reset() {
        this.clients.clear();
    }
}

module.exports = RateLimiter;

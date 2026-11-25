import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiFetch, AUTH_CHANGED_EVENT, TOKEN_STORAGE_KEY } from '../services/authService';

const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    text: async () => JSON.stringify(body),
});

describe('apiFetch session loss', () => {
    beforeEach(() => {
        localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    test('clears a stale token when the server no longer knows the user', async () => {
        const events = [];
        const handler = (event) => events.push(event.detail);
        window.addEventListener(AUTH_CHANGED_EVENT, handler);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { error: 'Unauthorized' })));

        await expect(apiFetch('/api/auth/me')).rejects.toThrow('Сессия сброшена. Войдите снова.');
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
        expect(events).toEqual([{ user: null }]);

        window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    });

    test('keeps the token when the password is simply wrong', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            response(401, { error: 'Invalid email or password' })
        ));

        await expect(apiFetch('/api/auth/login', {
            method: 'POST',
            body: { email: 'a@b.test', password: 'wrong' },
        })).rejects.toThrow('Invalid email or password');
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('stale-token');
    });
});

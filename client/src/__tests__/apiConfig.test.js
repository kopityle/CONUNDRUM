import { describe, expect, it, vi } from 'vitest';
import { API_BASE, apiUrl } from '../services/apiConfig';

describe('apiConfig', () => {
    it('keeps same-origin API paths when VITE_API_URL is not set', () => {
        // Vite/ nginx proxy /api in this configuration; a missing env must never
        // turn into the literal string "undefined/api/...".
        expect(API_BASE).not.toBe('undefined');
        expect(apiUrl('/api/generate-game')).toBe(`${API_BASE}/api/generate-game`);
    });

    it('normalizes paths and does not add duplicate slashes', () => {
        expect(apiUrl('api/puzzles')).toBe(`${API_BASE}/api/puzzles`);
        expect(apiUrl('/api/puzzles')).not.toContain('//api');
    });

    it('strips a trailing slash from a configured backend URL', async () => {
        vi.stubEnv('VITE_API_URL', 'https://api.example.com/');
        vi.resetModules();
        try {
            const { apiUrl: configuredApiUrl } = await import('../services/apiConfig');
            expect(configuredApiUrl('/api/generate-game'))
                .toBe('https://api.example.com/api/generate-game');
        } finally {
            vi.unstubAllEnvs();
        }
    });
});

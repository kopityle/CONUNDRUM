import { afterEach, describe, expect, test } from 'vitest';
import { clientUrl } from '../services/apiConfig';

describe('clientUrl', () => {
    afterEach(() => {
        delete window.BASE_URL;
    });

    test('keeps the GitHub Pages project prefix', () => {
        window.BASE_URL = 'https://kopityle.github.io/CONUNDRUM';
        expect(clientUrl('/play/abc123')).toBe('https://kopityle.github.io/CONUNDRUM/play/abc123');
    });

    test('falls back to the current origin', () => {
        expect(clientUrl('/play/abc123')).toBe(`${window.location.origin}/play/abc123`);
    });
});

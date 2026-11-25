const { clientUrl, getClientBaseUrl } = require('../utils/clientUrl');

describe('clientUrl', () => {
    const original = { ...process.env };

    afterEach(() => {
        if (original.CLIENT_URL === undefined) delete process.env.CLIENT_URL;
        else process.env.CLIENT_URL = original.CLIENT_URL;
        if (original.CLIENT_BASE_PATH === undefined) delete process.env.CLIENT_BASE_PATH;
        else process.env.CLIENT_BASE_PATH = original.CLIENT_BASE_PATH;
        if (original.GITHUB_REPO === undefined) delete process.env.GITHUB_REPO;
        else process.env.GITHUB_REPO = original.GITHUB_REPO;
    });

    test('username project Pages gets the repository prefix', () => {
        process.env.CLIENT_URL = 'https://kopityle.github.io/';
        expect(getClientBaseUrl()).toBe('https://kopityle.github.io/CONUNDRUM');
        expect(clientUrl('/play/abc123')).toBe('https://kopityle.github.io/CONUNDRUM/play/abc123');
    });

    test('explicit CLIENT_BASE_PATH is used as-is', () => {
        process.env.CLIENT_URL = 'https://example.test';
        process.env.CLIENT_BASE_PATH = '/app/';
        expect(clientUrl('/gamegenerator')).toBe('https://example.test/app/gamegenerator');
    });

    test('plain URL is not modified', () => {
        process.env.CLIENT_URL = 'https://app.test';
        expect(clientUrl('/play/abc123')).toBe('https://app.test/play/abc123');
    });

    test('without CLIENT_URL the path stays relative', () => {
        delete process.env.CLIENT_URL;
        expect(clientUrl('/play/abc123')).toBe('/play/abc123');
        expect(clientUrl('/gamegenerator', 'http://localhost')).toBe('http://localhost/gamegenerator');
    });
});

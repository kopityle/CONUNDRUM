const RebusGenerator = require('../services/RebusGenerator');

function okResponse(content) {
    return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] })
    };
}

function iconifyResponse(icons) {
    return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ icons, total: icons.length })
    };
}

describe('RebusGenerator', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('ищет иконку через Iconify и подставляет PNG URL для image-части', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(okResponse(JSON.stringify([{
                word: 'ПОДВАЛ',
                parts: [{
                    type: 'image',
                    description: 'волна',
                    iconQuery: 'wave',
                    subtract_start: 0,
                    subtract_end: 0
                }]
            }])))
            .mockResolvedValueOnce(iconifyResponse(['mdi:wave']));

        const generator = new RebusGenerator('key', 'https://openrouter.test', {
            models: ['model-1'],
            fetchImpl: fetchMock
        });
        const result = await generator.generateRebus('подвал', 'topic', 1);

        const part = result.rebuses[0].parts[0];
        expect(part.iconQuery).toBe('wave');
        expect(part.imageUrl).toContain('images.weserv.nl');
        expect(part.imageUrl).toContain('api.iconify.design%2Fmdi%2Fwave.svg');
        expect(part.imageUrl).toContain('output=png');
        expect(result.words).toEqual([{ word: 'ПОДВАЛ', clue: 'Ребус №1' }]);

        const aiBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(aiBody.response_format.type).toBe('json_schema');
        expect(aiBody.messages.at(-1).content).toContain('ONE SHORT ENGLISH NOUN');

        const searchUrl = fetchMock.mock.calls[1][0];
        expect(searchUrl).toContain('api.iconify.design/search');
        expect(searchUrl).toContain('query=wave');
        expect(searchUrl).toContain('prefixes=');
    });

    test('кэширует URL иконок по запросу', async () => {
        const fetchMock = jest.fn().mockResolvedValue(iconifyResponse(['mdi:house']));
        const generator = new RebusGenerator('key', 'https://openrouter.test', { fetchImpl: fetchMock });

        const first = await generator.findIconUrl('дом', 'HOUSE');
        const second = await generator.findIconUrl('большой дом', 'house');

        expect(first).toBe(second);
        expect(first).toContain('api.iconify.design%2Fmdi%2Fhouse.svg');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(generator.iconCache.size).toBe(1);
    });

    test('при пустом результате поиска возвращает и кэширует заглушку', async () => {
        const fetchMock = jest.fn().mockResolvedValue(iconifyResponse([]));
        const generator = new RebusGenerator('key', 'https://openrouter.test', { fetchImpl: fetchMock });

        const first = await generator.findIconUrl('нечто', 'unfindablething');
        const second = await generator.findIconUrl('нечто', 'unfindablething');

        expect(first).toContain('data:image/svg+xml');
        expect(second).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Iconify'));
    });

    test('legacy-метод findFreepikIconUrl делегирует в findIconUrl', async () => {
        const fetchMock = jest.fn().mockResolvedValue(iconifyResponse(['mdi:cat']));
        const generator = new RebusGenerator('key', 'https://openrouter.test', { fetchImpl: fetchMock });

        const url = await generator.findFreepikIconUrl('кот', 'cat');

        expect(url).toContain('api.iconify.design%2Fmdi%2Fcat.svg');
    });
});

const RebusGenerator = require('../services/RebusGenerator');

function okResponse(content) {
    return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] })
    };
}

describe('RebusGenerator', () => {
    const originalKey = process.env.FREEPIK_API_KEY;

    beforeEach(() => {
        process.env.FREEPIK_API_KEY = 'freepik-key';
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        if (originalKey === undefined) delete process.env.FREEPIK_API_KEY;
        else process.env.FREEPIK_API_KEY = originalKey;
        jest.restoreAllMocks();
    });

    test('запрашивает iconQuery и подставляет URL иконки для image-части', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(okResponse(JSON.stringify([{
                word: 'ПОДВАЛ',
                parts: [{
                    type: 'image',
                    description: 'волна',
                    iconQuery: 'волна',
                    subtract_start: 0,
                    subtract_end: 0
                }]
            }])))
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ data: [{ image: { source: { url: 'https://icon.test/wave.png' } } }] })
            });

        const generator = new RebusGenerator('key', 'https://openrouter.test', {
            models: ['model-1'],
            fetchImpl: fetchMock
        });
        const result = await generator.generateRebus('подвал', 'topic', 1);

        expect(result.rebuses[0].parts[0].iconQuery).toBe('волна');
        expect(result.rebuses[0].parts[0].imageUrl).toBe('https://icon.test/wave.png');
        expect(result.words).toEqual([{ word: 'ПОДВАЛ', clue: 'Ребус №1' }]);
        const aiBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(aiBody.response_format.type).toBe('json_schema');
    });

    test('кэширует URL иконок по запросу', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ data: [{ image: { source: { url: 'https://icon.test/dom.png' } } }] })
        });
        const generator = new RebusGenerator('key', 'https://openrouter.test', { fetchImpl: fetchMock });

        const first = await generator.findFreepikIconUrl('дом', 'дом');
        const second = await generator.findFreepikIconUrl('большой дом', 'ДОМ');

        expect(first).toBe('https://icon.test/dom.png');
        expect(second).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(generator.iconCache.size).toBe(1);
    });
});

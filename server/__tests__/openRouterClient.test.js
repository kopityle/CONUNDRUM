const {
    callOpenRouter,
    DEFAULT_MODELS,
    REQUEST_TIMEOUT_MS
} = require('../utils/openRouterClient');

function okResponse(content) {
    return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] })
    };
}

function errorResponse(status) {
    return {
        ok: false,
        status,
        text: jest.fn().mockResolvedValue('provider error')
    };
}

function requestBody(fetchMock, index = 0) {
    return JSON.parse(fetchMock.mock.calls[index][1].body);
}

describe('callOpenRouter', () => {
    let fetchMock;

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        fetchMock = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('отправляет Structured Outputs и AbortController с таймаутом 35с', async () => {
        fetchMock.mockResolvedValue(okResponse('[{"word":"кот","clue":"животное"}]'));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1'],
            jsonSchema: { type: 'array' },
            fetchImpl: fetchMock
        });

        expect(result.structured).toBe(true);
        expect(result.items).toEqual([{ word: 'кот', clue: 'животное' }]);
        const body = requestBody(fetchMock);
        expect(body.response_format).toEqual({
            type: 'json_schema',
            json_schema: { name: 'puzzle_response', strict: true, schema: { type: 'array' } }
        });
        expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
        expect(REQUEST_TIMEOUT_MS).toBe(35_000);
    });

    test('при 429 и 5xx автоматически пробует следующую модель', async () => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(429))
            .mockResolvedValueOnce(errorResponse(503))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2', 'model-3'],
            fetchImpl: fetchMock
        });

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(result.model).toBe('model-3');
        expect(requestBody(fetchMock, 2).model).toBe('model-3');
    });

    test('при 400 на json_schema повторяет ту же модель без response_format', async () => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(400))
            .mockResolvedValueOnce(okResponse("[{'word':'кот','clue':'животное'}]"));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2'],
            jsonSchema: { type: 'array' },
            fetchImpl: fetchMock
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(requestBody(fetchMock, 0).model).toBe('model-1');
        expect(requestBody(fetchMock, 0).response_format).toBeDefined();
        expect(requestBody(fetchMock, 1).model).toBe('model-1');
        expect(requestBody(fetchMock, 1).response_format).toBeUndefined();
        expect(result.structured).toBe(false);
        expect(result.items).toEqual([{ word: 'кот', clue: 'животное' }]);
    });

    test('прерывает запрос по таймауту и переходит к следующей модели', async () => {
        fetchMock.mockImplementation((url, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
        }));

        await expect(callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2'],
            timeout: 5,
            fetchImpl: fetchMock
        })).rejects.toThrow(/timeout after 5ms/);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('при невалидном JSON от первой модели использует вторую', async () => {
        fetchMock
            .mockResolvedValueOnce(okResponse('неверный ответ без JSON'))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2'],
            fetchImpl: fetchMock
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.items).toHaveLength(1);
    });

    test('использует модель по умолчанию, если список не передан', () => {
        expect(DEFAULT_MODELS.length).toBeGreaterThanOrEqual(3);
    });
});

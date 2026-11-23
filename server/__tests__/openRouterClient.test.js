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

function errorResponse(status, body = 'provider error') {
    return {
        ok: false,
        status,
        text: jest.fn().mockResolvedValue(body)
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
        expect(fetchMock.mock.calls[0][1].headers['HTTP-Referer']).toBe('http://localhost');
        expect(body.temperature).toBe(0.5);
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
            .mockResolvedValueOnce(errorResponse(400, 'response_format json_schema is not supported'))
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

    test('при 404 «unavailable for free» сразу пробует следующую модель', async () => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(
                404,
                'This model is unavailable for free. The paid version is available now - use this slug instead: deepseek/deepseek-r1-0528'
            ))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['deepseek/deepseek-r1-0528:free', 'model-2'],
            jsonSchema: { type: 'array' },
            fetchImpl: fetchMock
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(requestBody(fetchMock, 0).model).toBe('deepseek/deepseek-r1-0528:free');
        expect(requestBody(fetchMock, 1).model).toBe('model-2');
        expect(console.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('не поддерживает json_schema')
        );
        expect(result.model).toBe('model-2');
    });

    test('при 404 с явным отказом json_schema повторяет ту же модель без response_format', async () => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(404, 'json_schema is not supported for this model'))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

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
        expect(requestBody(fetchMock, 1).model).toBe('model-1');
        expect(requestBody(fetchMock, 1).response_format).toBeUndefined();
        expect(result.model).toBe('model-1');
        expect(result.structured).toBe(false);
    });

    test.each([400, 422])('при %i без признаков json_schema пробует следующую модель', async (status) => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(status, 'invalid request for this model'))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

        const result = await callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2'],
            jsonSchema: { type: 'array' },
            fetchImpl: fetchMock
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(requestBody(fetchMock, 1).model).toBe('model-2');
        expect(result.model).toBe('model-2');
    });

    test.each([401, 403])('при %i бросает ошибку сразу, не перебирая модели', async (status) => {
        fetchMock
            .mockResolvedValueOnce(errorResponse(status, 'invalid api key'))
            .mockResolvedValueOnce(okResponse('[{"word":"кот","clue":"животное"}]'));

        await expect(callOpenRouter({
            apiKey: 'key',
            apiUrl: 'https://openrouter.test/api',
            prompt: 'give words',
            models: ['model-1', 'model-2'],
            fetchImpl: fetchMock
        })).rejects.toThrow(new RegExp(`OpenRouter API error: ${status}`));

        expect(fetchMock).toHaveBeenCalledTimes(1);
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

    test('использует актуальные бесплатные модели по умолчанию', () => {
        expect(DEFAULT_MODELS).toEqual(expect.arrayContaining([
            'inclusionai/ling-3.2-flash:free',
            'baidu/ernie-5.5-flash-preview:free',
            'openrouter/free'
        ]));
        expect(DEFAULT_MODELS).not.toContain('qwen/qwen3-235b-a22b:free');
        expect(DEFAULT_MODELS).not.toContain('deepseek/deepseek-r1-0528:free');
    });
});

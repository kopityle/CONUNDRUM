const { parseAiJsonArray } = require('./aiResponse');

const REQUEST_TIMEOUT_MS = 35_000;

// Несколько моделей: при 429/5xx/таймауте автоматически пробуем следующую.
const DEFAULT_MODELS = [
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-235b-a22b:free',
    'deepseek/deepseek-r1-0528:free'
];

function resolveModels(models) {
    if (Array.isArray(models) && models.length > 0) return models;
    if (process.env.OPENROUTER_MODELS) {
        const fromEnv = process.env.OPENROUTER_MODELS.split(',')
            .map((model) => model.trim())
            .filter(Boolean);
        if (fromEnv.length > 0) return fromEnv;
    }
    return DEFAULT_MODELS;
}

function isRetryableStatus(status) {
    return status === 429 || status >= 500;
}

// Некоторые модели отклоняют response_format: json_schema (400/404/422).
function isSchemaUnsupportedStatus(status) {
    return status === 400 || status === 404 || status === 422;
}

/**
 * Запрос к OpenRouter с Structured Outputs, таймаутом и фоллбэком на другие модели.
 * Возвращает { items, data, model, structured }.
 */
async function callOpenRouter({
    apiKey,
    apiUrl,
    prompt,
    models,
    jsonSchema = null,
    schemaName = 'puzzle_response',
    temperature = 0.2,
    timeout = REQUEST_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
}) {
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
    if (!apiUrl) throw new Error('OPENROUTER_API_URL is not configured');
    if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');

    const modelList = resolveModels(models);
    let lastError = new Error('OpenRouter request failed');

    for (const model of modelList) {
        const structuredAttempts = jsonSchema ? [true, false] : [false];

        for (const useStructured of structuredAttempts) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const body = {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature,
                    top_p: 1
                };

                if (useStructured) {
                    body.response_format = {
                        type: 'json_schema',
                        json_schema: { name: schemaName, strict: true, schema: jsonSchema }
                    };
                }

                const response = await fetchImpl(apiUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': '*',
                        'X-Title': 'Conundrum Game Generator',
                        'User-Agent': 'Conundrum/1.0.0'
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    const error = new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
                    error.status = response.status;
                    lastError = error;

                    if (useStructured && isSchemaUnsupportedStatus(response.status)) {
                        console.warn(`Модель ${model} не поддерживает json_schema, повторяем без structured output`);
                        continue; // та же модель, но без response_format
                    }

                    if (isRetryableStatus(response.status)) {
                        console.warn(`OpenRouter ${model}: статус ${response.status}, пробуем следующую модель`);
                        break; // следующая модель
                    }

                    throw error;
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('Нейросеть не сгенерировала текст...');

                const items = parseAiJsonArray(content);
                if (items.length === 0) {
                    throw new Error('Нейросеть вернула невалидный JSON после очистки и jsonrepair');
                }

                return { items, data, model, structured: useStructured };
            } catch (error) {
                if (!lastError || error !== lastError) lastError = error;

                if (error?.name === 'AbortError') {
                    lastError = new Error(`OpenRouter request timeout after ${timeout}ms`);
                    break;
                }

                if (error?.status) break; // все HTTP-ошибки, кроме schema fallback, — к следующей модели
                break; // сетевая ошибка / ошибка парсинга — следующая модель
            } finally {
                clearTimeout(timeoutId);
            }
        }
    }

    throw lastError;
}

module.exports = {
    callOpenRouter,
    resolveModels,
    DEFAULT_MODELS,
    REQUEST_TIMEOUT_MS
};

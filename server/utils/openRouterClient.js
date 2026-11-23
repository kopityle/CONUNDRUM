const { parseAiJsonArray } = require('./aiResponse');

const REQUEST_TIMEOUT_MS = 35_000;

// Актуальные бесплатные модели. Проверяются через scripts/openrouter-free-models.ps1.
// Сначала два проверенных фаворита, затем роутер, затем остальные.
const DEFAULT_MODELS = [
    'inclusionai/ling-3.2-flash:free',
    'baidu/ernie-5.5-flash-preview:free',
    'openrouter/free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
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

// Schema может быть отклонена (400/404/422), но 404 также означает «модель недоступна».
// Различаем по телу ответа, иначе повторяем ту же мёртвую модель без response_format.
function isSchemaUnsupportedError(status, errorText) {
    if (![400, 404, 422].includes(status)) return false;

    const text = String(errorText || '').toLowerCase();
    const schemaSignal = /json_schema|structured output|structured_outputs|response_format|schema/i.test(text);
    const modelSignal = /unavailable for free|paid version|no matching model|model not found|does not exist|invalid model|free variant/i.test(text);

    return schemaSignal && !modelSignal;
}

// Ошибки модели/запроса — идём к следующей модели. 401/403 намеренно не трогаем:
// при битом ключе бессмысленно перебирать весь пул.
function shouldTryNextModel(status) {
    return status === 400 || status === 404 || status === 422 || isRetryableStatus(status);
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
    temperature = 0.5,
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
                        'HTTP-Referer': 'http://localhost',
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

                    if (useStructured && isSchemaUnsupportedError(response.status, errorText)) {
                        console.warn(`Модель ${model} не поддерживает json_schema, повторяем без structured output`);
                        continue; // та же модель, но без response_format
                    }

                    if (shouldTryNextModel(response.status)) {
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

                if (error?.status && !shouldTryNextModel(error.status)) {
                    throw error; // 401/403 и другие «не перебирать» ошибки — сразу наружу
                }
                if (error?.status) break; // остальные HTTP-ошибки — к следующей модели
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

const { jsonrepair } = require('jsonrepair');
const { cleanApiResponse } = require('./jsonUtils');

function asArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        for (const key of ['words', 'rebuses', 'items', 'result', 'data']) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return null;
}

/**
 * Достаёт массив из ответа LLM. Порядок фоллбэков:
 * 1) чистый JSON, 2) jsonrepair по исходному тексту,
 * 3) cleanApiResponse (мусор, markdown, кривые кавычки) + jsonrepair внутри неё.
 */
function parseAiJsonArray(content) {
    if (Array.isArray(content)) return content;
    if (content && typeof content === 'object') return asArray(content) || [];
    if (typeof content !== 'string' || content.trim() === '') return [];

    const trimmed = content.trim();
    const candidates = [trimmed];

    try {
        candidates.push(jsonrepair(trimmed));
    } catch (error) {
        // jsonrepair не справился с мусором вокруг JSON — пробуем cleanApiResponse ниже
    }

    const cleaned = cleanApiResponse(trimmed);
    if (cleaned !== '[]') candidates.push(cleaned);

    for (const candidate of candidates) {
        try {
            const array = asArray(JSON.parse(candidate));
            if (array) return array;
        } catch (error) {
            // пробуем следующий кандидат
        }
    }

    return [];
}

module.exports = { parseAiJsonArray };

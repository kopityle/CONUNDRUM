const { z } = require('zod');

// Базовые схемы без refine: их можно преобразовать в JSON Schema для Structured Outputs.
const lettersOnly = /^[\p{L}\s]+$/u;
const shortNoun = /^[\p{L}-]{1,30}$/u;

const baseWordSchema = z.object({
    word: z.string().trim().min(1).regex(lettersOnly, 'word должен содержать только буквы и пробелы'),
    clue: z.string().trim().min(1)
});

/** Слово + подсказка: без цифр/спецсимволов, непустая подсказка, подсказка не содержит ответ. */
const wordSchema = baseWordSchema.refine(
    ({ word, clue }) => !clue.toLocaleLowerCase().includes(word.toLocaleLowerCase()),
    { message: 'clue не должен содержать само слово', path: ['clue'] }
);

const wordsSchema = z.array(baseWordSchema).min(1);

const textPartSchema = z.object({
    type: z.literal('text'),
    content: z.string().trim().min(1)
});

const imagePartSchema = z.object({
    type: z.literal('image'),
    description: z.string().trim().min(1),
    iconQuery: z.string().trim().regex(shortNoun, 'iconQuery должен быть одним коротким существительным'),
    subtract_start: z.number().int().min(0),
    subtract_end: z.number().int().min(0)
});

const rebusPartSchema = z.discriminatedUnion('type', [textPartSchema, imagePartSchema]);
const rebusSchema = z.object({
    word: z.string().trim().min(1),
    parts: z.array(rebusPartSchema).min(1)
});
const rebusesSchema = z.array(rebusSchema).min(1);

/** JSON Schema для response_format (проверки refine в неё не попадают — они применяются после). */
function toJsonSchema(schema) {
    const { $schema, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-2020-12' });
    return jsonSchema;
}

const wordsJsonSchema = toJsonSchema(wordsSchema);
const rebusesJsonSchema = toJsonSchema(rebusesSchema);

function normalizeKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalized = {};
    for (const [key, item] of Object.entries(value)) {
        const cleanKey = key.trim();
        normalized[cleanKey === 'clues' ? 'clue' : cleanKey] = item;
    }
    return normalized;
}

function toNonNegativeInt(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

/** Приводит ответ LLM к массиву валидных слов; битые элементы просто отбрасываются. */
function validateWords(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.reduce((valid, item) => {
        const parsed = wordSchema.safeParse(normalizeKeys(item));
        if (parsed.success) {
            valid.push(parsed.data);
        } else {
            console.warn('Отброшено невалидное слово от LLM:', item, parsed.error.issues);
        }
        return valid;
    }, []);
}

/** Нормализует части ребуса (в том числе fields по умолчанию) и оставляет только валидные. */
function validateRebuses(raw) {
    if (!Array.isArray(raw)) return [];

    return raw.reduce((valid, item) => {
        const normalizedRebus = normalizeKeys(item);
        if (!normalizedRebus) return valid;

        const parts = Array.isArray(normalizedRebus.parts)
            ? normalizedRebus.parts.map((part) => {
                const normalizedPart = normalizeKeys(part);
                if (!normalizedPart) return null;
                if (normalizedPart.type === 'text') {
                    return {
                        type: 'text',
                        content: typeof normalizedPart.content === 'string' ? normalizedPart.content.trim() : ''
                    };
                }
                if (normalizedPart.type === 'image') {
                    const description = typeof normalizedPart.description === 'string'
                        ? normalizedPart.description.trim()
                        : '';
                    const rawIconQuery = typeof normalizedPart.iconQuery === 'string'
                        ? normalizedPart.iconQuery.trim()
                        : '';
                    return {
                        type: 'image',
                        description,
                        iconQuery: rawIconQuery || description.split(/\s+/)[0] || '',
                        subtract_start: toNonNegativeInt(normalizedPart.subtract_start),
                        subtract_end: toNonNegativeInt(normalizedPart.subtract_end)
                    };
                }
                return null;
            }).filter(Boolean)
            : [];

        const parsed = rebusSchema.safeParse({ ...normalizedRebus, parts });
        if (parsed.success) {
            valid.push(parsed.data);
        } else {
            console.warn('Отброшен невалидный ребус от LLM:', item, parsed.error.issues);
        }
        return valid;
    }, []);
}

module.exports = {
    baseWordSchema,
    wordSchema,
    wordsSchema,
    textPartSchema,
    imagePartSchema,
    rebusPartSchema,
    rebusSchema,
    wordsJsonSchema,
    rebusesJsonSchema,
    toJsonSchema,
    validateWords,
    validateRebuses
};

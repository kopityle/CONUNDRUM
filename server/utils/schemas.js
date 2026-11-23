const { z } = require('zod');

// Локальные Zod-проверки остаются строгими (regex/refine), но в OpenRouter
// отправляются отдельные JSON Schema только с типами и обязательными полями.
const lettersOnly = /^[\p{L}\s]+$/u;
// iconQuery уходит в Iconify: только английские lowercase-слова через дефис.
const shortNoun = /^[a-z][a-z0-9-]{0,39}$/;

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
    iconQuery: z.string().trim().regex(shortNoun, 'iconQuery должен быть одним английским словом в нижнем регистре'),
    subtract_start: z.number().int().min(0),
    subtract_end: z.number().int().min(0)
});

const rebusPartSchema = z.discriminatedUnion('type', [textPartSchema, imagePartSchema]);
const rebusSchema = z.object({
    word: z.string().trim().min(1),
    parts: z.array(rebusPartSchema).min(1)
});
const rebusesSchema = z.array(rebusSchema).min(1);

/**
 * JSON Schema для response_format OpenRouter.
 * Намеренно без pattern/minLength/refine: строгие проверки применяются локально
 * в validateWords/validateRebuses после получения ответа.
 */
const wordsJsonSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            word: { type: 'string' },
            clue: { type: 'string' }
        },
        required: ['word', 'clue'],
        additionalProperties: false
    }
};

const rebusTextPartJsonSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['text'] },
        content: { type: 'string' }
    },
    required: ['type', 'content'],
    additionalProperties: false
};

const rebusImagePartJsonSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['image'] },
        description: { type: 'string' },
        iconQuery: { type: 'string' },
        subtract_start: { type: 'integer' },
        subtract_end: { type: 'integer' }
    },
    required: ['type', 'description', 'iconQuery', 'subtract_start', 'subtract_end'],
    additionalProperties: false
};

const rebusesJsonSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            word: { type: 'string' },
            parts: {
                type: 'array',
                items: { anyOf: [rebusTextPartJsonSchema, rebusImagePartJsonSchema] }
            }
        },
        required: ['word', 'parts'],
        additionalProperties: false
    }
};

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
    validateWords,
    validateRebuses
};

const {
    wordSchema,
    wordsJsonSchema,
    imagePartSchema,
    rebusesJsonSchema,
    validateWords,
    validateRebuses
} = require('../utils/schemas');

describe('Zod-схемы ответов LLM', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('слово + подсказка', () => {
        test('принимает обычное слово с непустой подсказкой', () => {
            const result = wordSchema.safeParse({ word: 'кот', clue: 'Домашнее животное' });
            expect(result.success).toBe(true);
        });

        test('принимает слово из нескольких слов', () => {
            expect(wordSchema.safeParse({ word: 'ALTER EGO', clue: 'Вторая натура' }).success).toBe(true);
        });

        test('отвергает цифры и спецсимволы в слове', () => {
            expect(wordSchema.safeParse({ word: 'кот123', clue: 'Животное' }).success).toBe(false);
            expect(wordSchema.safeParse({ word: 'кот!', clue: 'Животное' }).success).toBe(false);
            expect(wordSchema.safeParse({ word: '', clue: 'Животное' }).success).toBe(false);
        });

        test('отвергает пустую подсказку', () => {
            expect(wordSchema.safeParse({ word: 'кот', clue: '   ' }).success).toBe(false);
        });

        test('отвергает подсказку, содержащую само слово', () => {
            expect(wordSchema.safeParse({ word: 'кот', clue: 'Кот на диване' }).success).toBe(false);
        });

        test('JSON Schema содержит обязательные поля word и clue', () => {
            expect(wordsJsonSchema.type).toBe('array');
            expect(wordsJsonSchema.items.required).toEqual(expect.arrayContaining(['word', 'clue']));
            expect(wordsJsonSchema.items.additionalProperties).toBe(false);
        });
    });

    describe('validateWords', () => {
        test('оставляет только валидные слова и нормализует ключи', () => {
            const raw = [
                { word: 'кот', clue: 'Мурлычет' },
                { ' word ': 'собака', ' clue ': 'Лает' },
                { word: 'cod1', clue: 'Рыба' },
                { word: 'дом', clue: 'дом — жилище' },
                null
            ];
            const result = validateWords(raw);
            expect(result).toEqual([
                { word: 'кот', clue: 'Мурлычет' },
                { word: 'собака', clue: 'Лает' }
            ]);
        });
    });

    describe('части ребуса', () => {
        test('требует iconQuery и неотрицательные сдвиги для image-части', () => {
            const withoutQuery = {
                type: 'image', description: 'волна', subtract_start: 0, subtract_end: 0
            };
            // сама схема требует iconQuery...
            expect(imagePartSchema.safeParse(withoutQuery).success).toBe(false);
            expect(imagePartSchema.safeParse({ ...withoutQuery, subtract_start: -1, iconQuery: 'волна' }).success)
                .toBe(false);
            // ...но фоллбэк-парсер подставляет его из description
            const withFallback = validateRebuses([{ word: 'ПОДВАЛ', parts: [withoutQuery] }]);
            expect(withFallback[0].parts[0].iconQuery).toBe('волна');

            const withQuery = { ...withoutQuery, iconQuery: 'волна' };
            const result = validateRebuses([{ word: 'ПОДВАЛ', parts: [withQuery] }]);
            expect(result).toHaveLength(1);
            expect(result[0].parts[0].iconQuery).toBe('волна');
        });

        test('нормализует отсутствующие поля и строковые числа', () => {
            const raw = [{
                word: 'УДОЧКА',
                parts: [{
                    type: 'image',
                    description: 'дудочка',
                    subtract_start: '1',
                    subtract_end: undefined
                }]
            }];
            const result = validateRebuses(raw);
            expect(result[0].parts[0]).toEqual({
                type: 'image',
                description: 'дудочка',
                iconQuery: 'дудочка',
                subtract_start: 1,
                subtract_end: 0
            });
        });

        test('JSON Schema ребуса описывает массив', () => {
            expect(rebusesJsonSchema.type).toBe('array');
            expect(JSON.stringify(rebusesJsonSchema)).toContain('iconQuery');
        });
    });
});

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

        test('JSON Schema содержит только типы и обязательные поля word и clue', () => {
            expect(wordsJsonSchema.type).toBe('array');
            expect(wordsJsonSchema.items.properties.word).toEqual({ type: 'string' });
            expect(wordsJsonSchema.items.properties.clue).toEqual({ type: 'string' });
            expect(wordsJsonSchema.items.required).toEqual(expect.arrayContaining(['word', 'clue']));
            expect(wordsJsonSchema.items.additionalProperties).toBe(false);
            expect(JSON.stringify(wordsJsonSchema)).not.toContain('pattern');
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
        test('требует английский iconQuery и неотрицательные сдвиги для image-части', () => {
            const withoutQuery = {
                type: 'image', description: 'волна', subtract_start: 0, subtract_end: 0
            };
            // сама схема требует iconQuery...
            expect(imagePartSchema.safeParse(withoutQuery).success).toBe(false);
            expect(imagePartSchema.safeParse({ ...withoutQuery, subtract_start: -1, iconQuery: 'wave' }).success)
                .toBe(false);
            // русское слово больше не подходит для Iconify
            expect(imagePartSchema.safeParse({ ...withoutQuery, iconQuery: 'волна' }).success).toBe(false);

            const withQuery = { ...withoutQuery, iconQuery: 'wave' };
            const result = validateRebuses([{ word: 'ПОДВАЛ', parts: [withQuery] }]);
            expect(result).toHaveLength(1);
            expect(result[0].parts[0].iconQuery).toBe('wave');
        });

        test('нормализует отсутствующие поля и строковые числа', () => {
            const raw = [{
                word: 'УДОЧКА',
                parts: [{
                    type: 'image',
                    description: 'дудочка',
                    iconQuery: 'flute',
                    subtract_start: '1',
                    subtract_end: undefined
                }]
            }];
            const result = validateRebuses(raw);
            expect(result[0].parts[0]).toEqual({
                type: 'image',
                description: 'дудочка',
                iconQuery: 'flute',
                subtract_start: 1,
                subtract_end: 0
            });
        });

        test('JSON Schema ребуса описывает массив без regex', () => {
            expect(rebusesJsonSchema.type).toBe('array');
            expect(JSON.stringify(rebusesJsonSchema)).toContain('iconQuery');
            expect(JSON.stringify(rebusesJsonSchema)).not.toContain('pattern');
            expect(JSON.stringify(rebusesJsonSchema)).not.toContain('minLength');
        });
    });
});

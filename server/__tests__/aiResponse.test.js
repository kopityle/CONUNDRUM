const { parseAiJsonArray } = require('../utils/aiResponse');

describe('fallback-парсинг ответа LLM', () => {
    test('парсит чистый JSON-массив', () => {
        expect(parseAiJsonArray('[{"word":"кот","clue":"животное"}]')).toEqual([
            { word: 'кот', clue: 'животное' }
        ]);
    });

    test('убирает markdown-обёртку', () => {
        const result = parseAiJsonArray('```json\n[{"word":"кот"}]\n```');
        expect(result).toEqual([{ word: 'кот' }]);
    });

    test('чинит мусор, одиночные кавычки и висячие запятые через cleanApiResponse', () => {
        const result = parseAiJsonArray(`Вот ответ: [{'word': 'кот', 'clue': 'животное'},]`);
        expect(result).toEqual([{ word: 'кот', clue: 'животное' }]);
    });

    test('восстанавливает массив jsonrepair после обрыва генерации', () => {
        const result = parseAiJsonArray('[{"word":"кот","clue":"животное"');
        expect(result).toEqual([{ word: 'кот', clue: 'животное' }]);
    });

    test('поддерживает объект-обёртку с полем words', () => {
        const result = parseAiJsonArray('{"words":[{"word":"кот","clue":"животное"}]}');
        expect(result).toEqual([{ word: 'кот', clue: 'животное' }]);
    });

    test('возвращает [] для полного мусора и пустого входа', () => {
        expect(parseAiJsonArray('isolated text')).toEqual([]);
        expect(parseAiJsonArray('')).toEqual([]);
        expect(parseAiJsonArray(null)).toEqual([]);
    });
});

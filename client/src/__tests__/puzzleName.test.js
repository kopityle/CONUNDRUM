import { buildAutoPuzzleName } from '../utils/puzzleName';

describe('buildAutoPuzzleName', () => {
    test('использует введённое название, если оно есть', () => {
        expect(buildAutoPuzzleName({
            puzzleName: '  Мой кроссворд  ',
            inputType: 'topic',
            topic: 'Фрукты',
            gameData: { gameType: 'crossword' },
        })).toBe('Мой кроссворд');
    });

    test('берёт тему, когда название не задано', () => {
        expect(buildAutoPuzzleName({
            puzzleName: '',
            inputType: 'topic',
            topic: '  Тропические\nфрукты ',
            gameData: { gameType: 'crossword' },
        })).toBe('Тропические фрукты');
    });

    test('берёт первые слова сгенерированной игры, если темы нет', () => {
        expect(buildAutoPuzzleName({
            puzzleName: '',
            inputType: 'text',
            gameData: {
                gameType: 'crossword',
                words: [{ word: 'маракуйя' }, { word: 'фейхоа' }, { word: 'гуава' }],
            },
        })).toBe('маракуйя, фейхоа');
    });

    test('подставляет тип игры, если слов ещё нет', () => {
        expect(buildAutoPuzzleName({ gameData: { gameType: 'wordsoup', words: [] } })).toBe('Филворд');
        expect(buildAutoPuzzleName({})).toBe('Головоломка');
    });

    test('обрезает слишком длинное автоназвание', () => {
        const result = buildAutoPuzzleName({
            inputType: 'topic',
            topic: 'Очень длинная тема '.repeat(10),
        });
        expect(result.length).toBeLessThanOrEqual(60);
        expect(result.endsWith('…')).toBe(true);
    });
});

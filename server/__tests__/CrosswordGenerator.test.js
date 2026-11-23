jest.mock('crossword-layout-generator');

const clg = require('crossword-layout-generator');
const CrosswordGenerator = require('../services/CrosswordGenerator');

function makeLayout(placed, unplaced = []) {
    return {
        rows: 6,
        cols: 6,
        result: [
            ...placed.map((answer, index) => ({
                answer,
                clue: `clue-${answer}`,
                orientation: 'across',
                startx: 1,
                starty: index + 1
            })),
            ...unplaced.map((answer) => ({
                answer,
                clue: `clue-${answer}`,
                orientation: 'none',
                startx: 0,
                starty: 0
            }))
        ]
    };
}

function okResponse(content) {
    return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] })
    };
}

describe('CrosswordGenerator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('buildCrosswordFromWords', () => {
        test('строит сетку и сохраняет исходные слова', () => {
            clg.generateLayout.mockImplementation(() => makeLayout(['КОТ', 'ДОМ']));

            const result = new CrosswordGenerator().buildCrosswordFromWords([
                { word: 'кот', clue: 'животное' },
                { word: 'дом', clue: 'жилище' }
            ]);

            expect(result.crossword[0].slice(0, 3).join('')).toBe('КОТ');
            expect(result.words).toHaveLength(2);
            expect(result.words[0].originalWord).toBe('кот');
        });

        test('пересчитывает макет до 3 раз и выбирает вариант с максимальным числом слов', () => {
            clg.generateLayout
                .mockImplementationOnce(() => makeLayout(['КОТ'], ['ДОМ']))
                .mockImplementationOnce(() => makeLayout(['КОТ', 'ДОМ']))
                .mockImplementationOnce(() => makeLayout(['ДОМ'], ['КОТ']));

            const result = new CrosswordGenerator().buildCrosswordFromWords([
                { word: 'кот', clue: 'животное' },
                { word: 'дом', clue: 'жилище' }
            ]);

            expect(clg.generateLayout).toHaveBeenCalledTimes(2);
            expect(result.words).toHaveLength(2);
            expect(result.words.every((word) => word.orientation !== 'none')).toBe(true);
        });

        test('отвергает пустой или невалидный список слов', () => {
            const generator = new CrosswordGenerator();
            expect(() => generator.buildCrosswordFromWords([])).toThrow(/Не предоставлены слова/);
            expect(() => generator.buildCrosswordFromWords([{ word: '', clue: 'x' }]))
                .toThrow(/Нет валидных слов/);
        });
    });

    test('generateCrossword фильтрует невалидные слова через Zod', async () => {
        const fetchMock = jest.fn().mockResolvedValue(okResponse(JSON.stringify([
            { word: 'кот', clue: 'Домашнее животное' },
            { word: 'кот123', clue: 'С цифрами' },
            { word: 'дом', clue: 'Жилище' },
            { word: 'собака', clue: 'собака лает' }
        ])));
        clg.generateLayout.mockImplementation(() => makeLayout(['КОТ', 'ДОМ']));

        const generator = new CrosswordGenerator('key', 'https://openrouter.test', {
            models: ['model-1'],
            fetchImpl: fetchMock
        });
        const result = await generator.generateCrossword('текст про животных', 'text', 4);

        expect(result.parsedWords.map((item) => item.word)).toEqual(['кот', 'дом']);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.response_format.type).toBe('json_schema');
    });
});

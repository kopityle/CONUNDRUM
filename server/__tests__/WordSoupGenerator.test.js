const WordSoupGenerator = require('../services/WordSoupGenerator');

describe('WordSoupGenerator.buildSoupFromWords', () => {
    beforeEach(() => {
        let seed = 42;
        jest.spyOn(Math, 'random').mockImplementation(() => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('создаёт квадратную сетку и размещает слова', () => {
        const generator = new WordSoupGenerator();
        const words = [
            { word: 'КОТ', clue: 'животное' },
            { word: 'ДОМ', clue: 'жилище' },
            { word: 'СОЛНЦЕ', clue: 'светило' }
        ];

        const result = generator.buildSoupFromWords(words);

        expect(result.grid).toHaveLength(result.gridSize);
        expect(result.grid.every((row) => row.length === result.gridSize)).toBe(true);
        expect(result.words.length).toBeGreaterThan(0);
        expect(result.words.every((word) => word.position >= 1)).toBe(true);
        expect(result.grid.every((row) => row.every((cell) => cell !== ''))).toBe(true);

        for (const placed of result.words) {
            const { startx, starty, orientation, cleanAnswer } = placed;
            let letters = '';
            for (let i = 0; i < cleanAnswer.length; i++) {
                const x = startx - 1 + (orientation === 'horizontal' || orientation === 'diagonal' ? i : 0);
                const y = starty - 1 + (orientation === 'vertical' || orientation === 'diagonal' ? i : 0);
                letters += result.grid[y][x];
            }
            expect(letters).toBe(cleanAnswer);
        }
    });

    test('отвергает пустой список слов', () => {
        const generator = new WordSoupGenerator();
        expect(() => generator.buildSoupFromWords([])).toThrow(/Не предоставлены слова/);
        expect(() => generator.buildSoupFromWords([{ word: ' ', clue: 'x' }]))
            .toThrow(/Нет валидных слов/);
    });
});

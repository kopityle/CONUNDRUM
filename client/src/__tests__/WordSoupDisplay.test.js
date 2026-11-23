import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { WordSoupDisplay } from '../js/WordSoupDisplay';
import { elements } from '../js/elements';

// Мокаем подсказки
vi.mock('../js/CluesDisplay', () => ({
    CluesDisplay: {
        displayWordSoupClues: vi.fn()
    }
}));

const mockGameData = {
    gridSize: 5,
    grid: [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'J'],
        ['K', 'L', 'M', 'N', 'O'],
        ['P', 'Q', 'R', 'S', 'T'],
        ['U', 'V', 'W', 'X', 'Y']
    ],
    words: [
        { word: "ABC", clue: "Alphabet start" }
    ]
};

describe('WordSoupDisplay Logic', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="crossword-container"></div>
            <div id="clues-container"></div>
        `;
        // Привязываем элементы
        elements.crosswordContainer = document.getElementById('crossword-container');
        elements.cluesContainer = document.getElementById('clues-container');
    });

    test('рендерит сетку филворда', () => {
        const wordSoup = new WordSoupDisplay(mockGameData, vi.fn(), vi.fn());
        wordSoup.display();

        // Проверяем контейнер супа
        const soupContainer = document.querySelector('.word-soup-container');
        expect(soupContainer).toBeInTheDocument();

        // Проверяем количество ячеек (5x5 = 25)
        const cells = document.querySelectorAll('.word-soup-cell');
        expect(cells.length).toBe(25);
    });

    test('ячейки содержат правильные буквы', () => {
        const wordSoup = new WordSoupDisplay(mockGameData, vi.fn(), vi.fn());
        wordSoup.display();

        // Проверяем первую букву "A"
        const firstCell = document.querySelector('.word-soup-cell[data-letter="A"]');
        expect(firstCell).toBeInTheDocument();
        expect(firstCell).toHaveTextContent('A');
    });
});
import { CluesDisplay } from './CluesDisplay.js';
import { GameStateManager } from './GameStateManager.js';
import { DisplayBase } from './DisplayBase.js';

/**
 * Класс, отвечающий за отображение и взаимодействие с кроссвордом
 */
export class CrosswordDisplay extends DisplayBase {
    /**
     * Отображает сетку кроссворда и слова
     * @param {Array<Array<string>>} grid - Двумерный массив, представляющий сетку кроссворда
     * @param {Array<Object>} words - Массив объектов слов, содержащих позицию и ориентацию
     */
    static displayCrossword(grid, words) {
        console.log("Сетка в displayCrossword:", grid);
        console.log("Слова в displayCrossword:", words);

        // Очищаем игровое поле
        this.clearGameField();

        // Проверяем входные данные
        if (!grid || !words) {
            console.error("Отсутствует сетка или слова!");
            GameStateManager.displayError('Не удалось получить данные кроссворда');
            return;
        }

        // Создаем таблицу
        const table = this.createElement('table', { className: 'crossword-table' });
        const crosswordContainer = document.getElementById('crossword-container');

        // Генерируем ячейки кроссворда
        grid.forEach((row, rowIndex) => {
            const tr = this.createElement('tr', {}, '', table);
            row.forEach((cell, colIndex) => {
                if (cell !== '') {
                    // Проверяем, начинается ли слово в этой позиции
                    const wordData = words.find(word =>
                        word.startx - 1 === colIndex && word.starty - 1 === rowIndex && word.orientation !== 'none'
                    );

                    // Создаем ячейку
                    const td = this.createElement('td', {
                        className: 'crossword-cell',
                        'data-correct-letter': cell.toUpperCase()
                    }, '', tr);

                    // Добавляем номер слова, если есть
                    if (wordData) {
                        this.createElement('span', 
                            { className: 'word-number' }, 
                            wordData.position, 
                            td
                        );
                    }

                    // Добавляем поле ввода
                    this.createElement('input', {
                        type: 'text',
                        maxLength: '1',
                        className: 'crossword-input'
                    }, '', td);
                } else {
                    this.createElement('td', { className: 'black-cell' }, '', tr);
                }
            });
        });

        crosswordContainer.appendChild(table);

        // Добавляем обработчики событий
        table.addEventListener('input', (event) => {
            const validateInput = (input) => {
                return input === event.target.parentNode.dataset.correctLetter;
            };

            const onValidInput = (input) => {
                input.parentNode.style.backgroundColor = '#c8e6c9';
                const nextInput = this.findNextInput(input, grid);
                if (nextInput) {
                    nextInput.focus();
                }
                GameStateManager.checkCrosswordSolved();
            };

            const onInvalidInput = (input) => {
                input.parentNode.style.backgroundColor = '#ffcdd2';
            };

            this.handleInput(event, validateInput, onValidInput, onInvalidInput);
        });

        table.addEventListener('keydown', (event) => {
            const onEnter = (input) => {
                const nextInput = this.findNextInput(input, grid);
                if (nextInput) {
                    nextInput.focus();
                }
            };

            const onArrow = (input, key) => {
                const currentCell = input.parentNode;
                const row = currentCell.parentNode.rowIndex;
                const col = currentCell.cellIndex;
                let nextInput;

                switch (key) {
                    case 'ArrowRight':
                        if (col + 1 < grid[row].length) {
                            nextInput = currentCell.parentNode.cells[col + 1].querySelector('input');
                        }
                        break;
                    case 'ArrowLeft':
                        if (col > 0) {
                            nextInput = currentCell.parentNode.cells[col - 1].querySelector('input');
                        }
                        break;
                    case 'ArrowDown':
                        if (row + 1 < grid.length) {
                            nextInput = table.rows[row + 1].cells[col].querySelector('input');
                        }
                        break;
                    case 'ArrowUp':
                        if (row > 0) {
                            nextInput = table.rows[row - 1].cells[col].querySelector('input');
                        }
                        break;
                }

                if (nextInput) {
                    nextInput.focus();
                }
            };

            this.handleKeydown(event, onEnter, onArrow);
        });

        // Отображаем подсказки
        CluesDisplay.displayClues(words);
    }

    /**
     * Находит следующую ячейку для ввода на основе текущей ячейки и сетки
     * @param {HTMLElement} currentInput - Текущая ячейка для ввода
     * @param {Array<Array<string>>} grid - Сетка кроссворда
     * @returns {HTMLElement|null} Следующая ячейка для ввода или null, если не найдена
     */
    static findNextInput(currentInput, grid) {
        const currentCell = currentInput.parentNode;
        const row = currentCell.parentNode.rowIndex;
        const col = currentCell.cellIndex;

        // Проверяем, есть ли ячейка справа
        if (col + 1 < grid[row].length && grid[row][col + 1] !== '') {
            const nextCell = currentCell.parentNode.cells[col + 1];
            const nextInput = nextCell.querySelector('input');
            if (nextInput) return nextInput;
        }

        // Проверяем, есть ли ячейка ниже
        if (row + 1 < grid.length && grid[row + 1][col] !== '') {
            const nextRow = currentCell.parentNode.parentNode.rows[row + 1];
            const nextCell = nextRow.cells[col];
            const nextInput = nextCell.querySelector('input');
            if (nextInput) return nextInput;
        }

        return null;
    }
}

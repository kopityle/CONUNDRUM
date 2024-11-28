/**
 * Класс, отвечающий за отображение и взаимодействие с кроссвордом
 */
export class CrosswordDisplay {
    /**
     * Отображает индикатор загрузки во время генерации кроссворда
     */
    static displayLoadingIndicator() {
        const cluesContainer = document.getElementById('clues-container');
        cluesContainer.style.display = 'none';

        const crosswordContainer = document.getElementById('crossword-container');
        crosswordContainer.innerHTML = '<div class="loading-indicator">Загрузка...</div>';
    }

    /**
     * Скрывает индикатор загрузки и показывает контейнер с подсказками
     */
    static hideLoadingIndicator() {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        const cluesContainer = document.getElementById('clues-container');
        cluesContainer.style.display = 'flex';
    }

    /**
     * Отображает сетку кроссворда и слова
     * @param {Array<Array<string>>} grid - Двумерный массив, представляющий сетку кроссворда
     * @param {Array<Object>} words - Массив объектов слов, содержащих позицию и ориентацию
     */
    static displayCrossword(grid, words) {
        console.log("Сетка в displayCrossword:", grid);
        console.log("Слова в displayCrossword:", words);

        const crosswordContainer = document.getElementById('crossword-container');
        crosswordContainer.innerHTML = '';

        // Проверяем входные данные
        if (!grid || !words) {
            console.error("Отсутствует сетка или слова!");
            crosswordContainer.textContent = 'Не удалось получить данные кроссворда';
            return;
        }

        // Генерируем HTML таблицы с номерами слов и ячейками для ввода
        const tableHTML = grid.map((row, rowIndex) => {
            return `<tr>${row.map((cell, colIndex) => {
                if (cell !== '') {
                    // Проверяем, начинается ли слово в этой позиции
                    const wordData = words.find(word =>
                        word.startx - 1 === colIndex && word.starty - 1 === rowIndex && word.orientation !== 'none'
                    );

                    const wordNumberHTML = wordData ? `<span class="word-number">${wordData.position}</span>` : '';

                    return `<td class="crossword-cell" data-correct-letter="${cell.toUpperCase()}">${wordNumberHTML}<input type="text" maxlength="1" class="crossword-input"></td>`;
                } else {
                    return `<td class="black-cell"></td>`;
                }
            }).join('')}</tr>`;
        }).join('');

        const table = document.createElement('table');
        table.classList.add('crossword-table');
        table.innerHTML = tableHTML;

        crosswordContainer.appendChild(table);

        // Добавляем обработчики событий для ввода и нажатия клавиш
        const tableElement = crosswordContainer.querySelector('table');
        tableElement.addEventListener('input', (event) => {
            const input = event.target;
            const userInput = input.value.toUpperCase();
            const correctLetter = input.parentNode.dataset.correctLetter;

            // Обновляем цвет фона ячейки в зависимости от ввода пользователя
            if (userInput === correctLetter) {
                input.parentNode.style.backgroundColor = '#c8e6c9';
            } else {
                input.parentNode.style.backgroundColor = '#ffcdd2';
            }

            // Переходим к следующей ячейке для ввода
            const nextInput = this.findNextInput(input, grid);
            if (nextInput) {
                nextInput.focus();
            }

            // Проверяем, решен ли кроссворд
            this.checkCrosswordSolved();
        });

        tableElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const nextInput = this.findNextInput(event.target, grid);
                if (nextInput) {
                    nextInput.focus();
                }
            }
        });

        // Отображаем подсказки
        this.displayClues(words);
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

    /**
     * Проверяет, решен ли кроссворд
     */
    static checkCrosswordSolved() {
        const cells = document.querySelectorAll('.crossword-cell input');

        for (const input of cells) {
            const userInput = input.value.toUpperCase();
            const correctLetter = input.parentNode.dataset.correctLetter;

            if (userInput !== correctLetter) {
                return;
            }
        }

        // Отображаем сообщение об успехе
        this.displaySuccessMessage();
    }

    /**
     * Отображает сообщение об успехе
     */
    static displaySuccessMessage() {
        const crosswordContainer = document.getElementById('crossword-container');
        const cluesContainer = document.getElementById('clues-container');

        crosswordContainer.innerHTML = '';
        cluesContainer.innerHTML = '';

        const successMessage = document.createElement('div');
        successMessage.classList.add('success-message');
        successMessage.innerHTML = `
            <h2>Поздравляем!</h2>
            <p>Вы успешно решили кроссворд!</p>
        `;

        crosswordContainer.appendChild(successMessage);
    }

    /**
     * Отображает подсказки
     * @param {Array<Object>} words - Массив объектов слов, содержащих позицию и ориентацию
     */
    static displayClues(words) {
        const cluesContainer = document.getElementById('clues-container');
        cluesContainer.innerHTML = '';

        const acrossClues = words.filter(wordData => wordData.orientation === 'across');
        const downClues = words.filter(wordData => wordData.orientation === 'down');

        /**
         * Создает список подсказок
         * @param {Array<Object>} clues - Массив объектов слов, содержащих позицию и ориентацию
         * @param {string} title - Заголовок списка подсказок
         * @returns {HTMLElement} Элемент списка подсказок
         */
        const createClueList = (clues, title) => {
            const list = document.createElement('ul');
            clues.forEach(wordData => {
                const li = document.createElement('li');
                li.textContent = `${wordData.position}. ${wordData.clue}`;
                const showAnswerButton = document.createElement('button');
                showAnswerButton.textContent = 'Показать ответ';
                showAnswerButton.classList.add('show-answer-button');
                showAnswerButton.addEventListener('click', () => {
                    showAnswerButton.remove();
                    li.textContent += ` (${wordData.answer})`;
                });
                li.appendChild(showAnswerButton);
                list.appendChild(li);
            });

            const container = document.createElement('div');
            container.classList.add('clues-section');
            const titleElement = document.createElement('h3');
            titleElement.textContent = title;
            container.appendChild(titleElement);
            container.appendChild(list);
            return container;
        };

        const acrossContainer = createClueList(acrossClues, 'По горизонтали');
        const downContainer = createClueList(downClues, 'По вертикали');

        cluesContainer.appendChild(acrossContainer);
        cluesContainer.appendChild(downContainer);
    }

    /**
     * Отображает сообщение об ошибке
     * @param {string} message - Сообщение об ошибке
     */
    static displayError(message) {
        const crosswordContainer = document.getElementById('crossword-container');
        crosswordContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

/**
 * Класс, отвечающий за отображение и управление подсказками кроссворда
 */
export class CluesDisplay {
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
}
/**
 * Класс, отвечающий за отображение и управление подсказками кроссворда и филворда
 */
export class CluesDisplay {
    /**
     * Отображает подсказки для кроссворда
     * @param {Array<Object>} words - Массив объектов слов, содержащих позицию и ориентацию
     */
    static displayCrosswordClues(words) {
        const cluesContainer = document.getElementById('clues-container');
        cluesContainer.innerHTML = '';

        const acrossClues = words.filter(wordData => wordData.orientation === 'across')
            .sort((a, b) => a.position - b.position);
        const downClues = words.filter(wordData => wordData.orientation === 'down')
            .sort((a, b) => a.position - b.position);

        const acrossContainer = this.createClueList(acrossClues, 'По горизонтали');
        const downContainer = this.createClueList(downClues, 'По вертикали');

        cluesContainer.appendChild(acrossContainer);
        cluesContainer.appendChild(downContainer);
    }

    /**
     * Отображает подсказки для филворда
     * @param {Array<Object>} words - Массив объектов слов
     */
    static displayWordSoupClues(words) {
        const cluesContainer = document.getElementById('clues-container');
        cluesContainer.innerHTML = '';

        // Преобразуем слова в формат для отображения
        const cluesData = words.map((word, index) => ({
            position: index + 1,
            clue: word.clue,
            word: word.word,
            cleanWord: word.word.replace(/\s+/g, '')
        }));

        const container = this.createClueList(cluesData, 'Слова в филворде');
        cluesContainer.appendChild(container);
    }

    /**
     * Создает список подсказок
     * @private
     */
    static createClueList(clues, title) {
        const list = document.createElement('ul');
        list.className = 'word-list';

        clues.forEach(wordData => {
            const li = document.createElement('li');
            li.className = 'word-item';
            if (wordData.cleanWord) {
                li.setAttribute('data-word', wordData.word);
                li.setAttribute('data-clean-word', wordData.cleanWord);
            }
            
            const clueText = document.createElement('span');
            clueText.textContent = `${wordData.position}. ${wordData.clue}`;
            li.appendChild(clueText);

            const showAnswerButton = document.createElement('button');
            showAnswerButton.textContent = 'Показать ответ';
            showAnswerButton.className = 'show-answer-button';
            showAnswerButton.addEventListener('click', () => {
                showAnswerButton.remove();
                const displayWord = wordData.originalWord || wordData.word;
                clueText.textContent += ` (${displayWord})`;
            });
            li.appendChild(showAnswerButton);
            list.appendChild(li);
        });

        const container = document.createElement('div');
        container.className = 'clues-section';
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        container.appendChild(titleElement);
        container.appendChild(list);
        return container;
    }
}
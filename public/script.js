
document.getElementById('crossword-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const documentText = document.getElementById('document').value;
    const verticalWords = parseInt(document.getElementById('vertical-words').value);
    const horizontalWords = parseInt(document.getElementById('horizontal-words').value);

    try {
        const response = await fetch('/generate-crossword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: documentText,
                verticalWords: verticalWords,
                horizontalWords: horizontalWords
            })
        });

        const data = await response.json();

        if (data.crossword && data.words) {
            displayCrossword(data.crossword, data.words);
        } else {
            displayError('Не удалось получить данные кроссворда');
        }
    } catch (error) {
        console.error(error);
        displayError('Произошла ошибка при генерации кроссворда.');
    }
});

function displayCrossword(grid, words) {
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.innerHTML = ''; // Очищаем контейнер

    if (!grid || !words) {
        crosswordContainer.textContent = 'Не удалось получить данные кроссворда';
        return;
    }

    // Создаем таблицу для сетки кроссворда
    const table = document.createElement('table');
    table.classList.add('crossword-table');

    for (let row = 0; row < grid.length; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < grid[row].length; col++) {
            const td = document.createElement('td');

            if (grid[row][col] !== '') {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.letter = grid[row][col];
                input.classList.add('crossword-input');
                td.appendChild(input);
            } else {
                td.classList.add('black-cell');
            }

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    crosswordContainer.appendChild(table);

    // Отображение подсказок
    displayClues(words);
}

function displayClues(words) {
    const cluesContainer = document.createElement('div');
    cluesContainer.classList.add('clues-container');

    const acrossClues = document.createElement('div');
    acrossClues.classList.add('clues-section');
    const acrossTitle = document.createElement('h3');
    acrossTitle.textContent = 'По горизонтали';
    acrossClues.appendChild(acrossTitle);

    const acrossList = document.createElement('ul');
    words.forEach((wordObj, index) => {
        const li = document.createElement('li');
        li.textContent = wordObj.clue;
        acrossList.appendChild(li);
    });
    acrossClues.appendChild(acrossList);

    const downClues = document.createElement('div');
    downClues.classList.add('clues-section');
    const downTitle = document.createElement('h3');
    downTitle.textContent = 'По вертикали';
    downClues.appendChild(downTitle);

    const downList = document.createElement('ul');
    words.forEach((wordObj, index) => {
        const li = document.createElement('li');
        li.textContent = wordObj.clue;
        downList.appendChild(li);
    });
    downClues.appendChild(downList);

    cluesContainer.appendChild(acrossClues);
    cluesContainer.appendChild(downClues);

    // Добавляем контейнер с подсказками ниже кроссворда
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.appendChild(cluesContainer);
}

function displayError(message) {
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.innerHTML = `<p class="error">${message}</p>`;
}
// Добавим обработчик событий для проверки ввода пользователем

function displayCrossword(grid, words) {
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.innerHTML = ''; // Очищаем контейнер

    if (!grid || !words) {
        crosswordContainer.textContent = 'Не удалось получить данные кроссворда';
        return;
    }

    // Создаем таблицу для сетки кроссворда
    const table = document.createElement('table');
    table.classList.add('crossword-table');

    for (let row = 0; row < grid.length; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < grid[row].length; col++) {
            const td = document.createElement('td');

            if (grid[row][col] !== '') {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.letter = grid[row][col];
                input.classList.add('crossword-input');

                // Добавляем обработчик для проверки ввода
                input.addEventListener('input', () => {
                    const userInput = input.value.toUpperCase();
                    const correctLetter = input.dataset.letter;
                    if (userInput === correctLetter) {
                        input.style.backgroundColor = '#c8e6c9'; // Зеленый
                        input.disabled = true; // Блокируем поле после правильного ввода
                    } else {
                        input.style.backgroundColor = '#ffcdd2'; // Красный
                    }
                });

                td.appendChild(input);
            } else {
                td.classList.add('black-cell');
            }

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    crosswordContainer.appendChild(table);

    // Отображение подсказок
    displayClues(words);
}
document.getElementById('crossword-form').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const inputType = document.getElementById('input-type').value;
    const documentText = document.getElementById('document').value;
    const totalWords = parseInt(document.getElementById('total-words').value);
    const topic = document.getElementById('topic').value;
    const fileInput = document.getElementById('file-upload');
  
    // Создаем FormData
    const formData = new FormData();
  
    formData.append('inputType', inputType);
    formData.append('totalWords', totalWords);
  
    if (inputType === 'text') {
      formData.append('text', documentText);
    } else if (inputType === 'file' && fileInput.files[0]) {
      formData.append('file-upload', fileInput.files[0]); //  Добавляем файл в formData
      console.log("Файл в formData:", fileInput.files[0]); //  Проверка файла
    } else if (inputType === 'topic') {
      formData.append('topic', topic);
    } else {
      displayError('Неверный тип ввода или файл не выбран.');
      return;
    }
  
    try {
      const response = await fetch('/generate-crossword', {
        method: 'POST',
        // Удаляем headers: { 'Content-Type': 'application/json' }
        body: formData // Отправляем formData
      });
  
      if (!response.ok) {
        throw new Error(`Ошибка при отправке запроса: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.crossword && data.words) {
        displayCrossword(data.crossword, data.layout.result);
        console.log("data.layout.result:", data.layout.result);
        displayClues(data.layout.result);
      } else {
        displayError('Не удалось получить данные кроссворда');
      }
    } catch (error) {
      console.error(error);
      displayError(`Произошла ошибка: ${error.message}`);
    }
  });
  
  function displayCrossword(grid, words) {
    console.log("Grid in displayCrossword:", grid);
    console.log("Words in displayCrossword:", words);
  
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.innerHTML = '';
  
    if (!grid || !words) {
      console.error("Grid or words are missing!");
      crosswordContainer.textContent = 'Не удалось получить данные кроссворда';
      return;
    }
  
    const table = document.createElement('table');
    table.classList.add('crossword-table');
  
    for (let row = 0; row < grid.length; row++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < grid[row].length; col++) {
        const td = document.createElement('td');
        td.classList.add('crossword-cell');
        td.contenteditable = true;
  
        if (grid[row][col] !== '') {
          const input = document.createElement('input');
          input.type = 'text';
          input.maxLength = 1;
          input.classList.add('crossword-input');
  
          input.addEventListener('input', () => {
            const userInput = input.value.toUpperCase();
            const correctLetter = grid[row][col].toUpperCase();
  
            if (userInput === correctLetter) {
              td.style.backgroundColor = '#c8e6c9';
            } else {
              td.style.backgroundColor = '#ffcdd2';
            }
          });
  
          const wordData = words.find(word =>
            word.startx - 1 === col && word.starty - 1 === row && word.orientation !== 'none'
          );
  
          if (wordData) {
            const wordNumberSpan = document.createElement('span');
            wordNumberSpan.textContent = wordData.position;
            wordNumberSpan.classList.add('word-number');
            td.appendChild(wordNumberSpan);
          }
  
          td.appendChild(input);
        } else {
          td.classList.add('black-cell');
        }
  
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
  
    crosswordContainer.appendChild(table);
    displayClues(words);
  }

function displayClues(words) {
    const cluesContainer = document.getElementById('clues-container');
    cluesContainer.innerHTML = '';

    console.log("Words in displayClues:", words);

    const acrossClues = words.filter(wordData => wordData.orientation === 'across');
    const downClues = words.filter(wordData => wordData.orientation === 'down');

    console.log("acrossClues:", acrossClues);
    console.log("downClues:", downClues);

    const acrossList = document.createElement('ul');
    acrossClues.forEach(wordData => {
        const li = document.createElement('li');
        li.textContent = `${wordData.position}. ${wordData.clue}`;
        acrossList.appendChild(li);
    });

    const downList = document.createElement('ul');
    downClues.forEach(wordData => {
        const li = document.createElement('li');
        li.textContent = `${wordData.position}. ${wordData.clue}`; 
        downList.appendChild(li);
    });

    const acrossContainer = document.createElement('div');
    acrossContainer.classList.add('clues-section');
    const acrossTitle = document.createElement('h3');
    acrossTitle.textContent = 'По  горизонтали';
    acrossContainer.appendChild(acrossTitle);
    acrossContainer.appendChild(acrossList); 

    const downContainer = document.createElement('div');
    downContainer.classList.add('clues-section');
    const downTitle = document.createElement('h3');
    downTitle.textContent = 'По  вертикали';
    downContainer.appendChild(downTitle);
    downContainer.appendChild(downList); 

    cluesContainer.appendChild(acrossContainer);
    cluesContainer.appendChild(downContainer);
}

function displayError(message) {
    const crosswordContainer = document.getElementById('crossword-container');
    crosswordContainer.innerHTML = `<p class="error">${message}</p>`;
}

const inputTypeSelect = document.getElementById('input-type');
const documentTextarea = document.getElementById('document');
const fileUploadInput = document.getElementById('file-upload');
const topicInput = document.getElementById('topic');

inputTypeSelect.addEventListener('change', () => {
  const selectedType = inputTypeSelect.value;

  documentTextarea.style.display = 'none';
  fileUploadInput.style.display = 'none';
  topicInput.style.display = 'none';

  if (selectedType === 'text') {
    documentTextarea.style.display = 'block';
  } else if (selectedType === 'file') {
    fileUploadInput.style.display = 'block';
  } else if (selectedType === 'topic') {
    topicInput.style.display = 'block';
  }
});
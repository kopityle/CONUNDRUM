import { supabase, signUp, signIn, signOut} from './config/SupabaseClient.js';
import { elements } from './js/elements.js';
import { AuthManager } from './js/AuthManager.js'; // Импортируем AuthManage
document.getElementById('crossword-form').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const inputType = document.getElementById('input-type').value;
    const documentText = document.getElementById('document').value;
    const totalWords = parseInt(document.getElementById('total-words').value);
    const topic = document.getElementById('topic').value;
    const fileInput = document.getElementById('file-upload');
    if (inputType === '') {
      return displayError('Выберите тип ввода.');
    }
    if (inputType === 'text' && documentText.trim() === '') {
        return displayError('Введите текст.');
    }

    if (inputType === 'topic' && topic.trim() === '') {
        return displayError('Введите тему.');
    }

    if (inputType === 'file' && !fileInput.files.length) {
        return displayError('Выберите файл.');
    }

    if (isNaN(totalWords) || totalWords < 1) {
        return displayError('Введите корректное количество слов (больше 0).');
    }

    displayLoadingIndicator();

    try {
        const response = await fetch('/generate-crossword', {
            method: 'POST',
            body: new FormData(event.target),
        });

        if (!response.ok) {
            throw new Error(`Ошибка при отправке запроса: ${response.status}`);
        }

        const data = await response.json();

        if (data.crossword && data.words) {
            displayCrossword(data.crossword, data.layout.result);
            displayClues(data.layout.result);
        } else {
            displayError('Не удалось получить данные кроссворда');
        }
    } catch (error) {
        console.error(error);

        if (error.response && error.response.data && error.response.data.error) {
            displayError(error.response.data.error);
        } else {
            displayError("Произошла ошибка при генерации кроссворда. Пожалуйста, попробуйте снова.");
        }
    } finally {
        hideLoadingIndicator();
    }
});
/**
 * Displays a loading indicator in the crossword container
 * and hides the clues container
 */
function displayLoadingIndicator() {
  // Скрыть подсказки вместе с кроссвордом
  const cluesContainer = document.getElementById('clues-container');
  cluesContainer.style.display = 'none';

  const crosswordContainer = document.getElementById('crossword-container');
  crosswordContainer.innerHTML = '<div class="loading-indicator">Загрузка...</div>';
}

function hideLoadingIndicator() {
  const loadingIndicator = document.querySelector('.loading-indicator');
  if (loadingIndicator) {
      loadingIndicator.remove();
  }

  // Показать подсказки после загрузки
  const cluesContainer = document.getElementById('clues-container');
  cluesContainer.style.display = 'flex';
}

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

  const tableHTML = grid.map((row, rowIndex) => {
      return `<tr>${row.map((cell, colIndex) => {
          if (cell !== '') {
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

  const tableElement = crosswordContainer.querySelector('table');
  tableElement.addEventListener('input', (event) => {
      const input = event.target;
      const userInput = input.value.toUpperCase();
      const correctLetter = input.parentNode.dataset.correctLetter;

      if (userInput === correctLetter) {
          input.parentNode.style.backgroundColor = '#c8e6c9';
      } else {
          input.parentNode.style.backgroundColor = '#ffcdd2';
      }

      const nextInput = findNextInput(input, grid);
      if (nextInput) {
          nextInput.focus();
      }
      checkCrosswordSolved(); // вызываем функцию для проверки решения после каждого ввода
  });

  tableElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); //  <---  Предотвращаем отправку формы
        const nextInput = findNextInput(event.target, grid);
        if (nextInput) {
            nextInput.focus();
        }
    }
  });

  displayClues(words);
}



function findNextInput(currentInput, grid) {
  const currentCell = currentInput.parentNode;
  const row = currentCell.parentNode.rowIndex;
  const col = currentCell.cellIndex;

  // Проверяем следующую ячейку по горизонтали
  if (col + 1 < grid[row].length && grid[row][col + 1] !== '') {
      const nextCell = currentCell.parentNode.cells[col + 1];
      const nextInput = nextCell.querySelector('input');
      if (nextInput) return nextInput;
  }

  // Проверяем следующую ячейку по вертикали
  if (row + 1 < grid.length && grid[row + 1][col] !== '') {
      const nextRow = currentCell.parentNode.parentNode.rows[row + 1];
      const nextCell = nextRow.cells[col];
      const nextInput = nextCell.querySelector('input');
      if (nextInput) return nextInput;
  }

  // Если следующей ячейки нет, возвращаем null
  return null;
}

function checkCrosswordSolved() {
  const cells = document.querySelectorAll('.crossword-cell input');

  for (const input of cells) {
    const userInput = input.value.toUpperCase();
    const correctLetter = input.parentNode.dataset.correctLetter; // Используем dataset для хранения правильного ответа

    if (userInput !== correctLetter) {
      return; // Прерываем, если найдена неверная буква
    }
  }

  displaySuccessMessage(); // Вызываем функцию для отображения сообщения об успехе, если все буквы верны
}


function displaySuccessMessage() {
  const crosswordContainer = document.getElementById('crossword-container');
  const cluesContainer = document.getElementById('clues-container'); // Получаем контейнер подсказок

  crosswordContainer.innerHTML = ''; // Очищаем контейнер
  cluesContainer.innerHTML = '';     // Очищаем контейнер подсказок
  const successMessage = document.createElement('div');
  successMessage.classList.add('success-message');
  successMessage.textContent = 'Поздравляем! Вы решили кроссворд!';
  // Дополнительно: можно добавить анимацию или другие эффекты к сообщению
  crosswordContainer.appendChild(successMessage); // Добавляем сообщение
    // // После отображения сообщения об успехе, инкрементируем счетчик
    // const user = supabase.auth.user(); // Получаем текущего пользователя
    // if (user) {
    //     incrementCrosswordCount(user.id);
    // } else {
    //   console.error("Пользователь не авторизован!");
    // }
}

// // Вызываем эту функцию после успешной авторизации или при загрузке страницы, если пользователь уже авторизован
// async function initializeUserProfile() {
// const user = supabase.auth.user();
// if (user) {
//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .select('crosswords_solved')
//       .eq('id', user.id)
//       .single();
//     if (error) {
//       console.error("Ошибка получения данных профиля:", error);
//     } else {
//       updateCrosswordCountUI(data.crosswords_solved || 0); // Обновляем UI счетчиком или 0, если счетчика еще нет
//     }
//   } catch (error) {
//     console.error("Ошибка получения данных профиля:", error)
//   }
// }
// }



function displayClues(words) {
    const cluesContainer = document.getElementById('clues-container');
    cluesContainer.innerHTML = '';

    const acrossClues = words.filter(wordData => wordData.orientation === 'across');
    const downClues = words.filter(wordData => wordData.orientation === 'down');

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

    const acrossContainer = createClueList(acrossClues, 'По  горизонтали');
    const downContainer = createClueList(downClues, 'По  вертикали');

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

// Popup Management
class PopupManager {
  static open(popup) {
      popup.style.display = 'block';
  }

  static close(popup) {
      popup.style.display = 'none';
  }

  static handleOutsideClick(event) {
      if (event.target.classList.contains('popup')) {
          this.close(event.target);
      }
  }
}


// Event Listeners
function initializeEventListeners() {
  // Popup triggers
  elements.openRegisterButton.addEventListener('click', () => PopupManager.open(elements.registerPopup));
  elements.openLoginButton.addEventListener('click', () => PopupManager.open(elements.loginPopup));

  // Form submissions
  elements.registerForm.addEventListener('submit', (e) => AuthManager.handleRegistration(e));
  elements.loginForm.addEventListener('submit', (e) => AuthManager.handleLogin(e));

  // Logout
  elements.logoutButton.addEventListener('click', () => AuthManager.handleLogout());

  // Outside click handling
  window.addEventListener('click', (e) => PopupManager.handleOutsideClick(e));

  // Close buttons
  document.querySelectorAll('.close').forEach(button => {
      button.addEventListener('click', () => {
          const popup = button.closest('.popup');
          PopupManager.close(popup);
      });
  });
  // Добавьте новый обработчик для кнопки открытия профиля
  elements.openProfileButton.addEventListener('click', () => AuthManager.showProfilePopup());

  // Обновите обработчик для формы профиля
  elements.profileForm.addEventListener('submit', (e) => AuthManager.updateProfile(e));
}

function initialize() {
  AuthManager.showAuthButtons();
  initializeEventListeners();
}

// Вызываем initialize после загрузки DOM
document.addEventListener('DOMContentLoaded', initialize);

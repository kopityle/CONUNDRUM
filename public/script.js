import { supabase, signUp, signIn, signOut, getUserData, updateProfile} from './config/SupabaseClient.js';
document.getElementById('crossword-form').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const inputType = document.getElementById('input-type').value;
    const documentText = document.getElementById('document').value;
    const totalWords = parseInt(document.getElementById('total-words').value);
    const topic = document.getElementById('topic').value;
    const fileInput = document.getElementById('file-upload');
      // --- Проверка на пустые поля ---
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

    // Проверка на число слов
    if (isNaN(totalWords) || totalWords < 1) {
        return displayError('Введите корректное количество слов (больше 0).');
    }
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
    displayLoadingIndicator();  
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
        displayClues(data.layout.result);   
      } else {
        displayError('Не удалось получить данные кроссворда');
      }
    } catch (error) {
      console.error(error);

      if (error.response && error.response.data && error.response.data.error) {
          displayError(error.response.data.error); // <---  Вызываем displayError() с сообщением от сервера
      } else {
          displayError("Произошла ошибка при генерации кроссворда. Пожалуйста, попробуйте снова."); // <--- Вызываем displayError() с общим сообщением
      }

  } finally {
      hideLoadingIndicator();
  }
});
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

  const table = document.createElement('table');
  table.classList.add('crossword-table');

  for (let row = 0; row < grid.length; row++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < grid[row].length; col++) {
          const td = document.createElement('td');
          td.classList.add('crossword-cell');


          if (grid[row][col] !== '') {
              const input = document.createElement('input');
              input.type = 'text';
              input.maxLength = 1;
              input.classList.add('crossword-input');

              input.addEventListener('input', (event) => { // <--- Добавили event
                  const userInput = input.value.toUpperCase();
                  const correctLetter = grid[row][col].toUpperCase();

                  if (userInput === correctLetter) {
                      td.style.backgroundColor = '#c8e6c9';
                  } else {
                      td.style.backgroundColor = '#ffcdd2';
                  }

                  // Автоматический переход к следующей ячейке
                  if (input.value) {
                      const nextInput = findNextInput(input, grid);
                      if (nextInput) {
                          nextInput.focus();
                      }
                  }
                  checkCrosswordSolved(); // вызываем функцию для проверки решения после каждого ввода
              });
              input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); //  <---  Предотвращаем отправку формы
                    const nextInput = findNextInput(input, grid);
                    if (nextInput) {
                        nextInput.focus();
                    }
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

  const cells = table.querySelectorAll('.crossword-cell input'); //  <--- cells из table
  cells.forEach(input => {
      const row = input.parentNode.parentNode.rowIndex;
      const col = input.parentNode.cellIndex;
      input.parentNode.dataset.correctLetter = grid[row][col].toUpperCase();
      // input.addEventListener('input', checkCrosswordSolved); // <--- Убрали отсюда, чтобы не вызывать дважды
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
  let allCorrect = true;

  cells.forEach(input => {
      const userInput = input.value.toUpperCase();
      const correctLetter = input.parentNode.dataset.correctLetter; // Используем dataset для хранения правильного ответа

      if (userInput !== correctLetter) {
          allCorrect = false;
      }
  });

  if (allCorrect) {
      displaySuccessMessage(); // Вызываем функцию для отображения сообщения об успехе
  }
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

async function updateCrosswordCountUI(count) {  // <--- Одна функция updateCrosswordCountUI
  const countElement = document.getElementById('crossword-count'); 
  if (countElement) {
      countElement.textContent = `Решено кроссвордов: ${count}`; // Добавляем текст для ясности
  }
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

      const showAnswerButton = document.createElement('button');
      showAnswerButton.textContent = 'Показать ответ';
      showAnswerButton.classList.add('show-answer-button');
      showAnswerButton.addEventListener('click', () => {
          // Удаляем кнопку
          showAnswerButton.remove();
          // Добавляем ответ в текст подсказки
          li.textContent += ` (${wordData.answer})`;
      });
      li.appendChild(showAnswerButton);
  });

    const downList = document.createElement('ul');
    downClues.forEach(wordData => {
      // ... (код для downClues, скопируйте логику из acrossClues)
      const li = document.createElement('li');
      li.textContent = `${wordData.position}. ${wordData.clue}`;
      downList.appendChild(li);

      const showAnswerButton = document.createElement('button');
      showAnswerButton.textContent = 'Показать ответ';
      showAnswerButton.classList.add('show-answer-button');
      showAnswerButton.addEventListener('click', () => {
          // Удаляем кнопку
          showAnswerButton.remove();
          // Добавляем ответ в текст подсказки
          li.textContent += ` (${wordData.answer})`;
      });
      li.appendChild(showAnswerButton);
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
// DOM Elements
const elements = {
  registerPopup: document.getElementById('register-popup'),
  loginPopup: document.getElementById('login-popup'),
  profileArea: document.getElementById('profile-area'),
  logoutButton: document.getElementById('logout-button'),
  openRegisterButton: document.getElementById('open-register-popup'),
  openLoginButton: document.getElementById('open-login-popup'),
  registerForm: document.getElementById('register-form'),
  loginForm: document.getElementById('login-form'),
  profileUsername: document.getElementById('profile-username'),
  profileEmail: document.getElementById('profile-email'),
  profilePopup: document.getElementById('profile-popup'),
  profileForm: document.getElementById('profile-form'),
  openProfileButton: document.getElementById('open-profile-popup')
};

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

// Auth Management
class AuthManager {
  static async handleRegistration(event) {
    event.preventDefault();
    try {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const username = document.getElementById('register-username').value;
        const age = document.getElementById('register-age').value || null;
        const gender = document.getElementById('register-gender').value || null;
        const occupation = document.getElementById('register-occupation').value || null;

        const result = await signUp(email, password, username, age, gender, occupation);

        if (result) {
            this.showSuccessMessage('Регистрация успешна!');
            PopupManager.close(elements.registerPopup);
            // try {
            //     // Добавляем пользователя в таблицу users
            //     const { error } = await supabase
            //         .from('users')
            //         .insert([
            //             {
            //                 id: result.user.id,
            //                 email: result.user.email,
            //                 username: username,
            //                 age: age,
            //                 gender: gender,
            //                 occupation: occupation,
            //                 crosswords_solved: 0 //  Устанавливаем начальное значение счетчика
            //             },
            //         ]);

            //     if (error) {
            //         console.error('Ошибка добавления пользователя в таблицу users:', error);
            //         this.showErrorMessage('Ошибка при создании профиля: ' + error.message); //  <-  Сообщение об ошибке
            //         // Дополнительные действия при ошибке, например, откат регистрации в Supabase Auth
            //         return; //  <-  Останавливаем выполнение, если произошла ошибка
            //     } else {
            //         console.log('Пользователь успешно добавлен в таблицу users');
            //     }

                const loginResult = await signIn(email, password);
                if (loginResult) {
                    await this.updateProfileUI(loginResult.user);
                }
            // } catch (error) {
            //     console.error("Ошибка при добавлении пользователя в users:", error);
            //     this.showErrorMessage('Ошибка при создании профиля: ' + error.message);  //  <-  Сообщение об ошибке
            //     // Дополнительные действия при ошибке
            // }

        }
    } catch (error) {
        this.showErrorMessage('Ошибка регистрации: ' + error.message);
    }
}

  // И метод handleLogin
  static async handleLogin(event) {
    event.preventDefault();
    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const result = await signIn(email, password);
        if (result) {
            this.showSuccessMessage('Вход выполнен успешно!');
            PopupManager.close(elements.loginPopup);
            await this.updateProfileUI(result.user);
        }
    } catch (error) {
        this.showErrorMessage('Ошибка входа: ' + error.message);
    }
  }

  static async handleLogout() {
    try {
      await signOut();
      this.showSuccessMessage('Вы вышли из системы');
      this.hideProfilePopup();
      this.showAuthButtons();
    } catch (error) {
      this.showErrorMessage('Ошибка при выходе из системы');
    }
  }

  static async updateProfileUI(user) {
    console.log('Updating profile UI for user:', user);
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();

      if (error) throw error;
        // const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        // if (authError) {
        //     console.error('Ошибка аутентификации:', authError);
        //     this.showErrorMessage('Ошибка аутентификации: ' + authError.message);
        //     return; // Прерываем выполнение функции, если ошибка аутентификации
        // }

        if (currentUser) {
            elements.profileUsername.textContent = currentUser.user_metadata.username || currentUser.email;
            elements.profileEmail.textContent = currentUser.email;
            document.getElementById('profile-age').value = currentUser.user_metadata.age || '';
            document.getElementById('profile-gender').value = currentUser.user_metadata.gender || '';
            document.getElementById('profile-occupation').value = currentUser.user_metadata.occupation || '';

            this.showProfileButton();
            // console.log("User ID:", currentUser.id);

            // try { // Отдельный try...catch для запроса к Supabase
            //     const { data: countData, error: countError } = await supabase
            //         .from('users')
            //         .select('crosswords_solved')
            //         .eq('id', currentUser.id)
            //         .single();

            //     console.log("Supabase response:", { countData, countError });

            //     if (countError) {
            //         console.error('Ошибка получения счетчика:', countError);
            //         if (countError.code === 'PGRST116') { // Проверяем код ошибки, если нет строки
            //           // Добавляем пользователя в таблицу users, если его там нет
            //           const { error: insertError } = await supabase
            //             .from('users')
            //             .insert([{
            //               id: currentUser.id,
            //               email: currentUser.email,
            //               username: currentUser.user_metadata.username,
            //               age: currentUser.user_metadata.age || null,
            //               gender: currentUser.user_metadata.gender || null,
            //               occupation: currentUser.user_metadata.occupation || null,
            //               crosswords_solved: 0
            //             }]);
            //           if (insertError) {
            //             console.error("Ошибка добавления пользователя в таблицу 'users':", insertError);
            //             updateCrosswordCountUI(0); //  Устанавливаем счетчик в 0 при ошибке
            //             return;
            //           } else {
            //             updateCrosswordCountUI(0); // Устанавливаем начальное значение счетчика
            //           }
            //         } else {
            //             // Другие ошибки Supabase
            //             updateCrosswordCountUI(0); //  Устанавливаем счетчик в 0 при ошибке
            //         }
            //     } else {
            //         updateCrosswordCountUI(countData.crosswords_solved || 0);
            //     }

            // } catch (error) { // Ловим все ошибки запроса к базе данных
            //     console.error("Ошибка при получении данных из Supabase:", error);
            //     this.showErrorMessage("Ошибка при загрузке данных профиля: " + error.message);
            //     updateCrosswordCountUI(0); //  Устанавливаем счетчик в 0 при ошибке
            // }
        }
    } catch (error) {
        console.error('Error updating profile UI:', error);
        this.showErrorMessage('Ошибка при обновлении интерфейса профиля: ' + error.message);
    }
}

  static async updateProfile(event) {
    event.preventDefault();
    try {
      const age = document.getElementById('profile-age').value;
      const gender = document.getElementById('profile-gender').value;
      const occupation = document.getElementById('profile-occupation').value;
  
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          age: age ? parseInt(age) : null,
          gender: gender || null,
          occupation: occupation || null
        }
      });
  
      if (error) throw error;
  
      this.showSuccessMessage('Профиль успешно обновлен');
      await this.updateProfileUI(data.user);
    } catch (error) {
      console.error('Error updating profile:', error);
      this.showErrorMessage('Ошибка при обновлении профиля: ' + error.message);
    }
  }

  static showProfileArea() {
      elements.profileArea.style.display = 'block';
      elements.logoutButton.style.display = 'block';
      elements.openLoginButton.style.display = 'none';
      elements.openRegisterButton.style.display = 'none';
  }

  static hideProfileArea() {
      elements.profileArea.style.display = 'none';
      elements.logoutButton.style.display = 'none';
      elements.openLoginButton.style.display = 'inline-block';
      elements.openRegisterButton.style.display = 'inline-block';
  }

  static showProfilePopup() {
    PopupManager.open(elements.profilePopup);
  }

  static hideProfilePopup() {
    PopupManager.close(elements.profilePopup);
  }

  static showProfileButton() {
    elements.openProfileButton.style.display = 'inline-block';
    elements.openLoginButton.style.display = 'none';
    elements.openRegisterButton.style.display = 'none';
  }

  static showAuthButtons() {
    elements.openProfileButton.style.display = 'none';
    elements.openLoginButton.style.display = 'inline-block';
    elements.openRegisterButton.style.display = 'inline-block';
  }
  static showSuccessMessage(message) {
      // Implement your success message UI
      alert(message); // Replace with better UI feedback
  }

  static showErrorMessage(message) {
      // Implement your error message UI
      alert(message); // Replace with better UI feedback
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
export {AuthManager}
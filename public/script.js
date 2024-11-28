import { supabase, signUp, signIn, signOut} from './config/SupabaseClient.js';
import { elements } from './js/elements.js';
import { AuthManager } from './js/AuthManager.js';
import { CrosswordDisplay } from './js/CrosswordDisplay.js';
import { PopupManager } from './js/PopupManager.js';

/**
 * Обработчик отправки формы для генерации кроссворда
 * Проверяет введенные данные и отправляет запрос на сервер
 */
document.getElementById('crossword-form').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    // Получение значений из формы
    const inputType = document.getElementById('input-type').value;
    const documentText = document.getElementById('document').value;
    const totalWords = parseInt(document.getElementById('total-words').value);
    const topic = document.getElementById('topic').value;
    const fileInput = document.getElementById('file-upload');

    // Валидация введенных данных
    if (inputType === '') {
      return CrosswordDisplay.displayError('Выберите тип ввода.');
    }
    if (inputType === 'text' && documentText.trim() === '') {
        return CrosswordDisplay.displayError('Введите текст.');
    }

    if (inputType === 'topic' && topic.trim() === '') {
        return CrosswordDisplay.displayError('Введите тему.');
    }

    if (inputType === 'file' && !fileInput.files.length) {
        return CrosswordDisplay.displayError('Выберите файл.');
    }

    if (isNaN(totalWords) || totalWords < 1) {
        return CrosswordDisplay.displayError('Введите корректное количество слов (больше 0).');
    }

    // Показываем индикатор загрузки
    CrosswordDisplay.displayLoadingIndicator();

    try {
        // Отправка данных на сервер
        const response = await fetch('/generate-crossword', {
            method: 'POST',
            body: new FormData(event.target),
        });

        if (!response.ok) {
            throw new Error(`Ошибка при отправке запроса: ${response.status}`);
        }

        const data = await response.json();

        // Отображение кроссворда при успешном получении данных
        if (data.crossword && data.words) {
            CrosswordDisplay.displayCrossword(data.crossword, data.layout.result);
        } else {
            CrosswordDisplay.displayError('Не удалось получить данные кроссворда');
        }
    } catch (error) {
        console.error(error);

        if (error.response && error.response.data && error.response.data.error) {
            CrosswordDisplay.displayError(error.response.data.error);
        } else {
            CrosswordDisplay.displayError("Произошла ошибка при генерации кроссворда. Пожалуйста, попробуйте снова.");
        }
    } finally {
        CrosswordDisplay.hideLoadingIndicator();
    }
});
/**
 * Переключает видимость полей ввода в зависимости от выбранного типа
 */
const inputTypeSelect = document.getElementById('input-type');
const documentTextarea = document.getElementById('document');
const fileUploadInput = document.getElementById('file-upload');
const topicInput = document.getElementById('topic');

function toggleInputs() {
    const selectedType = inputTypeSelect.value;
    
    documentTextarea.style.display = selectedType === 'text' ? 'block' : 'none';
    fileUploadInput.style.display = selectedType === 'file' ? 'block' : 'none';
    topicInput.style.display = selectedType === 'topic' ? 'block' : 'none';
}


inputTypeSelect.addEventListener('change', toggleInputs);
toggleInputs();

/**
 * Инициализация обработчиков событий для элементов интерфейса
 */
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

/**
 * Инициализация приложения
 */
function initialize() {
  AuthManager.showAuthButtons();
  initializeEventListeners();
}

// Вызываем initialize после загрузки DOM
document.addEventListener('DOMContentLoaded', initialize);

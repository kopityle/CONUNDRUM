import { supabase } from './config/SupabaseClient.js';
import { AuthManager } from './js/AuthManager.js';
import { UIUtils } from './js/UIUtils.js';
import { CrosswordDisplay } from './js/CrosswordDisplay.js';
import { WordSoupDisplay } from './js/WordSoupDisplay.js';
import { DisplayBase } from './js/DisplayBase.js';
import { elements } from './js/elements.js';

// Обработчик отправки формы для генерации игры
elements.crosswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
  
    // Получение значений из формы
    const gameType = elements.gameTypeSelect.value;
    const inputType = elements.inputTypeSelect.value;
    const documentText = elements.documentTextarea.value;
    const totalWords = parseInt(elements.totalWordsInput.value);
    const topic = elements.topicInput.value;
    const fileInput = elements.fileUploadInput;

    // Валидация введенных данных
    if (inputType === '') {
        return UIUtils.showError('Выберите тип ввода.');
    }
    if (inputType === 'text' && documentText.trim() === '') {
        return UIUtils.showError('Введите текст.');
    }

    if (inputType === 'topic' && topic.trim() === '') {
        return UIUtils.showError('Введите тему.');
    }

    if (inputType === 'file' && !fileInput.files.length) {
        return UIUtils.showError('Выберите файл.');
    }

    if (isNaN(totalWords) || totalWords < 1) {
        return UIUtils.showError('Введите корректное количество слов (больше 0).');
    }

    // Показываем индикатор загрузки
    DisplayBase.displayLoadingIndicator();

    try {
        // Отправка данных на сервер
        const formData = new FormData(event.target);
        const response = await fetch('/generate-game', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Ошибка при отправке запроса: ${response.status}`);
        }

        const data = await response.json();

        // Отображение игры в зависимости от выбранного типа
        if (gameType === 'wordsoup') {
            if (data.grid && data.words) {
                const display = new WordSoupDisplay(data);
                display.display();
            } else {
                UIUtils.showError('Не удалось получить данные для игры');
            }
        } else {
            if (data.crossword && data.words) {
                CrosswordDisplay.displayCrossword(data.crossword, data.layout.result);
            } else {
                UIUtils.showError('Не удалось получить данные кроссворда');
            }
        }
    } catch (error) {
        console.error(error);

        if (error.response?.data?.error) {
            UIUtils.showError(error.response.data.error);
        } else {
            UIUtils.showError("Произошла ошибка при генерации игры. Пожалуйста, попробуйте снова.");
        }
    } finally {
        DisplayBase.hideLoadingIndicator();
    }
});

// Инициализация приложения
function initialize() {
    AuthManager.showAuthButtons();
    UIUtils.initialize();
}

// Вызываем initialize после загрузки DOM
document.addEventListener('DOMContentLoaded', initialize);

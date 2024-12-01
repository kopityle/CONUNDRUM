import { supabase } from './config/SupabaseClient.js';
import { AuthManager } from './js/AuthManager.js';
import { UIUtils } from './js/UIUtils.js';
import { CrosswordDisplay } from './js/CrosswordDisplay.js';
import { DisplayBase } from './js/DisplayBase.js';

// Обработчик отправки формы для генерации кроссворда
UIUtils.elements.crosswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
  
    // Получение значений из формы
    const inputType = UIUtils.elements.inputTypeSelect.value;
    const documentText = UIUtils.elements.documentTextarea.value;
    const totalWords = parseInt(UIUtils.elements.totalWordsInput.value);
    const topic = UIUtils.elements.topicInput.value;
    const fileInput = UIUtils.elements.fileUploadInput;

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
            UIUtils.showError('Не удалось получить данные кроссворда');
        }
    } catch (error) {
        console.error(error);

        if (error.response?.data?.error) {
            UIUtils.showError(error.response.data.error);
        } else {
            UIUtils.showError("Произошла ошибка при генерации кроссворда. Пожалуйста, попробуйте снова.");
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

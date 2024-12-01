import { supabase } from '../config/SupabaseClient.js';
import { AuthManager } from './AuthManager.js';
import { elements } from './elements.js';

/**
 * Класс для управления пользовательским интерфейсом
 */
export class UIUtils {
    /**
     * Инициализация всех обработчиков событий
     */
    static initialize() {
        this.initializePopupHandlers();
        this.initializeFormHandlers();
        this.initializeInputTypeHandlers();
    }

    /**
     * Инициализация обработчиков для попапов
     */
    static initializePopupHandlers() {
        // Обработчики открытия попапов
        elements.openRegisterButton?.addEventListener('click', () => this.showPopup(elements.registerPopup));
        elements.openLoginButton?.addEventListener('click', () => this.showPopup(elements.loginPopup));
        elements.openProfileButton?.addEventListener('click', () => this.showPopup(elements.profilePopup));

        // Обработчик клика вне попапа
        window.addEventListener('click', (e) => this.handleOutsideClick(e));

        // Обработчики кнопок закрытия
        document.querySelectorAll('.close').forEach(button => {
            button.addEventListener('click', () => {
                const popup = button.closest('.popup');
                this.hidePopup(popup);
            });
        });
    }

    /**
     * Инициализация обработчиков для форм
     */
    static initializeFormHandlers() {
        // Добавляем обработчики событий для форм, если они существуют
        if (elements.registerForm) {
            elements.registerForm.addEventListener('submit', (e) => AuthManager.handleRegistration(e));
        }
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', (e) => AuthManager.handleLogin(e));
        }
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', (e) => AuthManager.updateProfile(e));
        }
        if (elements.logoutButton) {
            elements.logoutButton.addEventListener('click', () => AuthManager.handleLogout());
        }
    }

    /**
     * Инициализация обработчиков для переключения типа ввода
     */
    static initializeInputTypeHandlers() {
        if (elements.inputTypeSelect) {
            elements.inputTypeSelect.addEventListener('change', () => this.toggleInputs());
            this.toggleInputs(); // Вызываем сразу для установки начального состояния
        }
    }

    /**
     * Переключение видимости полей ввода
     */
    static toggleInputs() {
        const selectedType = elements.inputTypeSelect.value;
        
        elements.documentTextarea.style.display = selectedType === 'text' ? 'block' : 'none';
        elements.fileUploadInput.style.display = selectedType === 'file' ? 'block' : 'none';
        elements.topicInput.style.display = selectedType === 'topic' ? 'block' : 'none';
    }

    /**
     * Показать попап
     * @param {HTMLElement} popup - Элемент попапа
     */
    static showPopup(popup) {
        if (popup) {
            popup.style.display = 'block';
        }
    }

    /**
     * Скрыть попап
     * @param {HTMLElement} popup - Элемент попапа
     */
    static hidePopup(popup) {
        if (popup) {
            popup.style.display = 'none';
        }
    }

    /**
     * Обработка клика вне попапа
     * @param {Event} event - Событие клика
     */
    static handleOutsideClick(event) {
        const popups = document.querySelectorAll('.popup');
        popups.forEach(popup => {
            if (event.target === popup) {
                this.hidePopup(popup);
            }
        });
    }

    /**
     * Показать сообщение об ошибке
     * @param {string} message - Текст сообщения
     */
    static showError(message) {
        alert(message);
    }

    /**
     * Показать сообщение об успехе
     * @param {string} message - Текст сообщения
     */
    static showSuccess(message) {
        alert(message);
    }
}

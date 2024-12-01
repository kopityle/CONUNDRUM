/**
 * Класс для управления пользовательским интерфейсом
 */
export class UIUtils {
    static elements = {
        // Модальные окна
        registerPopup: document.getElementById('register-popup'),
        loginPopup: document.getElementById('login-popup'),
        profilePopup: document.getElementById('profile-popup'),
        
        // Область профиля и кнопка выхода
        profileArea: document.getElementById('profile-area'),
        logoutButton: document.getElementById('logout-button'),
        
        // Кнопки открытия модальных окон
        openRegisterButton: document.getElementById('open-register-popup'),
        openLoginButton: document.getElementById('open-login-popup'),
        openProfileButton: document.getElementById('open-profile-popup'),
        
        // Формы
        registerForm: document.getElementById('register-form'),
        loginForm: document.getElementById('login-form'),
        profileForm: document.getElementById('profile-form'),
        
        // Элементы профиля
        profileUsername: document.getElementById('profile-username'),
        profileEmail: document.getElementById('profile-email'),

        // Элементы формы кроссворда
        inputTypeSelect: document.getElementById('input-type'),
        documentTextarea: document.getElementById('document'),
        fileUploadInput: document.getElementById('file-upload'),
        topicInput: document.getElementById('topic'),
        totalWordsInput: document.getElementById('total-words'),
        crosswordForm: document.getElementById('crossword-form')
    };

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
        this.elements.openRegisterButton?.addEventListener('click', () => this.showPopup(this.elements.registerPopup));
        this.elements.openLoginButton?.addEventListener('click', () => this.showPopup(this.elements.loginPopup));
        this.elements.openProfileButton?.addEventListener('click', () => this.showPopup(this.elements.profilePopup));

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
        if (this.elements.registerForm) {
            this.elements.registerForm.addEventListener('submit', (e) => AuthManager.handleRegistration(e));
        }
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', (e) => AuthManager.handleLogin(e));
        }
        if (this.elements.profileForm) {
            this.elements.profileForm.addEventListener('submit', (e) => AuthManager.updateProfile(e));
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.addEventListener('click', () => AuthManager.handleLogout());
        }
    }

    /**
     * Инициализация обработчиков для переключения типа ввода
     */
    static initializeInputTypeHandlers() {
        if (this.elements.inputTypeSelect) {
            this.elements.inputTypeSelect.addEventListener('change', () => this.toggleInputs());
            this.toggleInputs(); // Вызываем сразу для установки начального состояния
        }
    }

    /**
     * Переключение видимости полей ввода
     */
    static toggleInputs() {
        const selectedType = this.elements.inputTypeSelect.value;
        
        this.elements.documentTextarea.style.display = selectedType === 'text' ? 'block' : 'none';
        this.elements.fileUploadInput.style.display = selectedType === 'file' ? 'block' : 'none';
        this.elements.topicInput.style.display = selectedType === 'topic' ? 'block' : 'none';
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
}

/**
 * Модуль elements.js
 * Содержит ссылки на DOM-элементы, используемые в приложении
 */

export const elements = {
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
    profileAge: document.getElementById('profile-age'),
    profileGender: document.getElementById('profile-gender'),
    profileOccupation: document.getElementById('profile-occupation'),

    // Элементы регистрации
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    registerUsername: document.getElementById('register-username'),
    registerAge: document.getElementById('register-age'),
    registerGender: document.getElementById('register-gender'),
    registerOccupation: document.getElementById('register-occupation'),

    // Элементы входа
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),

    // Элементы формы кроссворда
    inputTypeSelect: document.getElementById('input-type'),
    documentTextarea: document.getElementById('document'),
    fileUploadInput: document.getElementById('file-upload'),
    topicInput: document.getElementById('topic'),
    totalWordsInput: document.getElementById('total-words'),
    crosswordForm: document.getElementById('crossword-form'),

    // Элементы игрового поля
    crosswordContainer: document.getElementById('crossword-container'),
    cluesContainer: document.getElementById('clues-container')
};

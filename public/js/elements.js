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
    profileEmail: document.getElementById('profile-email')
};

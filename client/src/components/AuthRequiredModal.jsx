import React from 'react';
import '../css/shareModal.css';

const AuthRequiredModal = ({ onLogin, onCopyLink, onClose }) => (
    <div
        className='shared-game-overlay'
        onClick={(event) => {
            if (event.target === event.currentTarget) onClose?.();
        }}
    >
        <div className='shared-game-modal auth-required-modal glass-surface' role='dialog' aria-modal='true' aria-label='Требуется авторизация'>
            <button
                type='button'
                className='shared-game-close'
                aria-label='Закрыть'
                onClick={onClose}
            >
                ×
            </button>
            <h2>Сохранить игру?</h2>
            <p className='auth-required-text'>
                Войдите в аккаунт, чтобы сохранить головоломку в личном кабинете,
                или просто скопируйте ссылку для класса.
            </p>
            <div className='auth-required-buttons'>
                <button type='button' className='auth-required-login-button' onClick={onLogin}>
                    Войти / Зарегистрироваться
                </button>
                <button type='button' className='auth-required-copy-button' onClick={onCopyLink}>
                    Скопировать ссылку
                </button>
            </div>
        </div>
    </div>
);

export default AuthRequiredModal;

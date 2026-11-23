import React from 'react';
import '../css/notifications.css';

const NotificationBanner = ({ notifications = [], onDismiss }) => {
    if (!notifications.length) return null;

    return (
        <div className='notification-stack' role='region' aria-label='Уведомления' aria-live='polite'>
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`notification-banner glass-surface ${notification.type === 'success' ? 'success' : 'error'}`}
                    role={notification.type === 'success' ? 'status' : 'alert'}
                >
                    <span className='notification-message'>{notification.message}</span>
                    <button
                        type='button'
                        className='notification-close'
                        aria-label='Закрыть уведомление'
                        onClick={() => onDismiss?.(notification.id)}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationBanner;

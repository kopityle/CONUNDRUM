import { useCallback, useRef, useState } from 'react';

/**
 * Неблокирующие уведомления внутри интерфейса.
 * Уведомления остаются на экране, пока пользователь их не закроет.
 */
const useNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const nextId = useRef(1);

    const notify = useCallback((message, type = 'error') => {
        if (!message) return;
        const id = nextId.current++;
        setNotifications((prev) => [...prev, { id, message, type }]);
    }, []);

    const notifyError = useCallback((message) => notify(message, 'error'), [notify]);
    const notifySuccess = useCallback((message) => notify(message, 'success'), [notify]);

    const dismissNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, []);

    return { notifications, notify, notifyError, notifySuccess, dismissNotification };
};

export default useNotifications;

/**
 * Модуль для работы с Supabase 
 * Предоставляет функции для аутентификации и управления профилем пользователя
 */

import { AuthManager } from '../js/AuthManager.js'; // Импортируем AuthManage

// Глобальная переменная для клиента Supabase
let supabase;  // Объявляем supabase глобально в модуле

/**
 * Инициализирует клиент Supabase
 * Получает конфигурацию с сервера
 */
async function initSupabase() {
    try {
        // Получаем конфигурацию с сервера
        const response = await fetch('/supabase-config');
        const config = await response.json();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error("Не получены URL или ключ Supabase от сервера");
        }

        // Создаем клиент Supabase
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        // Устанавливаем слушатель изменений состояния аутентификации
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                AuthManager.updateProfileUI(session.user);
            } else if (event === 'SIGNED_OUT') {
                AuthManager.showAuthButtons();
            }
        });
    } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
    }
}

// Запускаем инициализацию при загрузке модуля
initSupabase(); // Запускаем инициализацию сразу

/**
 * Регистрация нового пользователя
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль пользователя
 * @param {string} username - Имя пользователя
 * @param {string|null} gender - Пол пользователя
 * @param {string|null} occupation - Род занятий пользователя
 * @returns {Promise<Object>} Данные созданного пользователя
 */
async function signUp(email, password, username, gender, occupation) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { 
                    username,
                    gender: gender || null,
                    occupation: occupation || null
                }
            }
        });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка регистрации:', error.message);
        throw error;
    }
}

/**
 * Вход пользователя в систему
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль пользователя
 * @returns {Promise<Object>} Данные сессии пользователя
 */
async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка входа:', error.message);
        throw error;
    }
}

/**
 * Выход пользователя из системы
 * @returns {Promise<void>}
 */
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Ошибка выхода:', error.message);
        throw error;
    }
}

/**
 * Получение данных пользователя
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} Данные профиля пользователя
 */
async function getUserData(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка получения данных пользователя:', error.message);
        throw error;
    }
}

/**
 * Обновление профиля пользователя
 * @param {string} userId - ID пользователя
 * @param {Object} updates - Объект с обновляемыми полями
 * @returns {Promise<Object>} Обновленные данные профиля
 */
async function updateProfile(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка обновления профиля:', error.message);
        throw error;
    }
}

export { supabase, signUp, signIn, signOut, getUserData, updateProfile }
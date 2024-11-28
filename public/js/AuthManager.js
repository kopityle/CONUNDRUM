// Импорт необходимых модулей для аутентификации и управления интерфейсом
import { elements } from './elements.js';
import { supabase, signUp, signIn, signOut} from '../config/SupabaseClient.js';
import { PopupManager } from './PopupManager.js';

/**
 * Класс, отвечающий за все операции, связанные с аутентификацией,
 * включая регистрацию, вход, выход и обновление интерфейса
 */
class AuthManager {
    /**
     * Обрабатывает процесс регистрации пользователя
     * @param {Event} event - Событие отправки формы
     */
    static async handleRegistration(event) {
        event.preventDefault();
        try {
            // Получаем значения из формы регистрации
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const username = document.getElementById('register-username').value;
            const age = document.getElementById('register-age').value || null;
            const gender = document.getElementById('register-gender').value || null;
            const occupation = document.getElementById('register-occupation').value || null;

            // Пытаемся зарегистрировать пользователя
            const result = await signUp(email, password, username, age, gender, occupation);

            if (result) {
                // Показываем сообщение об успехе и закрываем окно регистрации
                this.showSuccessMessage('Регистрация успешна!');
                PopupManager.close(elements.registerPopup);

                // Автоматически входим в систему после успешной регистрации
                const loginResult = await signIn(email, password);
                if (loginResult) {
                    await this.updateProfileUI(loginResult.user);
                }
            }
        } catch (error) {
            this.showErrorMessage('Ошибка регистрации: ' + error.message);
        }
    }
  
    /**
     * Обрабатывает процесс входа пользователя
     * @param {Event} event - Событие отправки формы
     */
    static async handleLogin(event) {
        event.preventDefault();
        try {
            // Получаем учетные данные из формы
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            // Пытаемся войти в систему
            const result = await signIn(email, password);
            if (result) {
                this.showSuccessMessage('Вход выполнен успешно!');
                PopupManager.close(elements.loginPopup);
                await this.updateProfileUI(result.user);
            }
        } catch (error) {
            this.showErrorMessage('Ошибка входа: ' + error.message);
        }
    }
  
    /**
     * Обрабатывает процесс выхода пользователя из системы
     */
    static async handleLogout() {
        try {
            // Выполняем выход из системы
            await signOut();
            this.showSuccessMessage('Вы вышли из системы');
            this.hideProfilePopup();
            this.showAuthButtons();
        } catch (error) {
            this.showErrorMessage('Ошибка при выходе из системы');
        }
    }
  
    /**
     * Обновляет интерфейс профиля пользователя
     * @param {Object} user - Объект пользователя
     */
    static async updateProfileUI(user) {
        console.log('Обновление интерфейса профиля для пользователя:', user);
        try {
            // Получаем данные текущего пользователя
            const { data: { user: currentUser }, error } = await supabase.auth.getUser();

            if (error) throw error;

            if (currentUser) {
                // Обновляем элементы интерфейса данными пользователя
                elements.profileUsername.textContent = currentUser.user_metadata.username || currentUser.email;
                elements.profileEmail.textContent = currentUser.email;
                document.getElementById('profile-age').value = currentUser.user_metadata.age || '';
                document.getElementById('profile-gender').value = currentUser.user_metadata.gender || '';
                document.getElementById('profile-occupation').value = currentUser.user_metadata.occupation || '';

                this.showProfileButton();
            }
        } catch (error) {
            console.error('Ошибка обновления интерфейса профиля:', error);
            this.showErrorMessage('Ошибка при обновлении интерфейса профиля: ' + error.message);
        }
    }
  
    /**
     * Обновляет информацию профиля пользователя
     * @param {Event} event - Событие отправки формы
     */
    static async updateProfile(event) {
        event.preventDefault();
        try {
            // Получаем обновленную информацию из формы
            const age = document.getElementById('profile-age').value;
            const gender = document.getElementById('profile-gender').value;
            const occupation = document.getElementById('profile-occupation').value;
    
            // Пытаемся обновить профиль пользователя
            const { data, error } = await supabase.auth.updateUser({
                data: { 
                    age: age ? parseInt(age) : null,
                    gender: gender || null,
                    occupation: occupation || null
                }
            });
    
            if (error) throw error;
    
            // Показываем сообщение об успехе и обновляем интерфейс
            this.showSuccessMessage('Профиль успешно обновлен');
            await this.updateProfileUI(data.user);
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            this.showErrorMessage('Ошибка при обновлении профиля: ' + error.message);
        }
    }
  
    /**
     * Показывает область профиля
     */
    static showProfileArea() {
        elements.profileArea.style.display = 'block';
        elements.logoutButton.style.display = 'block';
        elements.openLoginButton.style.display = 'none';
        elements.openRegisterButton.style.display = 'none';
    }
  
    /**
     * Скрывает область профиля
     */
    static hideProfileArea() {
        elements.profileArea.style.display = 'none';
        elements.logoutButton.style.display = 'none';
        elements.openLoginButton.style.display = 'inline-block';
        elements.openRegisterButton.style.display = 'inline-block';
    }
  
    /**
     * Показывает всплывающее окно профиля
     */
    static showProfilePopup() {
        PopupManager.open(elements.profilePopup);
    }
  
    /**
     * Скрывает всплывающее окно профиля
     */
    static hideProfilePopup() {
        PopupManager.close(elements.profilePopup);
    }
  
    /**
     * Показывает кнопку профиля
     */
    static showProfileButton() {
        elements.openProfileButton.style.display = 'inline-block';
        elements.openLoginButton.style.display = 'none';
        elements.openRegisterButton.style.display = 'none';
    }
  
    /**
     * Показывает кнопки аутентификации
     */
    static showAuthButtons() {
        elements.openProfileButton.style.display = 'none';
        elements.openLoginButton.style.display = 'inline-block';
        elements.openRegisterButton.style.display = 'inline-block';
    }
  
    /**
     * Показывает сообщение об успехе
     * @param {String} message - Текст сообщения об успехе
     */
    static showSuccessMessage(message) {
        // Реализация отображения сообщения об успехе
        alert(message); 
    }
  
    /**
     * Показывает сообщение об ошибке
     * @param {String} message - Текст сообщения об ошибке
     */
    static showErrorMessage(message) {
        // Реализация отображения сообщения об ошибке
        alert(message); 
    }
}

export { AuthManager }
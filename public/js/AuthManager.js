// Импорт необходимых модулей для аутентификации и управления интерфейсом
import { elements } from './elements.js';
import { supabase, signUp, signIn, signOut} from '../config/SupabaseClient.js';
import { UIUtils } from './UIUtils.js';

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
            const email = elements.registerEmail.value;
            const password = elements.registerPassword.value;
            const username = elements.registerUsername.value;
            const birthdate = elements.registerBirthdate.value || null;
            const gender = elements.registerGender.value || null;
            const occupation = elements.registerOccupation.value || null;

            // Пытаемся зарегистрировать пользователя
            const result = await signUp(email, password, username, birthdate, gender, occupation);

            if (result) {
                // Показываем сообщение об успехе и закрываем окно регистрации
                UIUtils.showSuccess('Регистрация успешна!');
                UIUtils.hidePopup(elements.registerPopup);

                // Автоматически входим в систему после успешной регистрации
                const loginResult = await signIn(email, password);
                if (loginResult) {
                    await this.updateProfileUI(loginResult.user);
                }
            }
        } catch (error) {
            UIUtils.showError('Ошибка регистрации: ' + error.message);
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
            const email = elements.loginEmail.value;
            const password = elements.loginPassword.value;

            // Пытаемся войти в систему
            const result = await signIn(email, password);
            if (result) {
                UIUtils.showSuccess('Вход выполнен успешно!');
                UIUtils.hidePopup(elements.loginPopup);
                await this.updateProfileUI(result.user);
            }
        } catch (error) {
            UIUtils.showError('Ошибка входа: ' + error.message);
        }
    }
  
    /**
     * Обрабатывает процесс выхода пользователя из системы
     */
    static async handleLogout() {
        try {
            // Выполняем выход из системы
            await signOut();
            UIUtils.showSuccess('Вы вышли из системы');
            this.hideProfilePopup();
            this.showAuthButtons();
        } catch (error) {
            UIUtils.showError('Ошибка при выходе из системы');
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
                elements.profileBirthdate.value = currentUser.user_metadata.birthdate || '';
                elements.profileGender.value = currentUser.user_metadata.gender || '';
                elements.profileOccupation.value = currentUser.user_metadata.occupation || '';
                
                // Calculate and display age
                const birthdate = currentUser.user_metadata.birthdate;
                if (birthdate) {
                    const age = this.calculateAge(birthdate);
                    elements.profileAge.textContent = `(Возраст: ${age})`;
                }

                this.showProfileButton();
            }
        } catch (error) {
            console.error('Ошибка обновления интерфейса профиля:', error);
            UIUtils.showError('Ошибка при обновлении интерфейса профиля: ' + error.message);
        }
    }
    
    /**
     * Вычисляет возраст по дате рождения
     * @param {string} birthdate - Дата рождения в формате 'YYYY-MM-DD'
     */
    static calculateAge(birthdate) {
        const birthdateParts = birthdate.split('-');
        const birthYear = parseInt(birthdateParts[0]);
        const birthMonth = parseInt(birthdateParts[1]);
        const birthDay = parseInt(birthdateParts[2]);
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const currentDay = today.getDate();
        
        let age = currentYear - birthYear;
        
        if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
            age--;
        }
        
        return age;
    }
  
    /**
     * Обновляет информацию профиля пользователя
     * @param {Event} event - Событие отправки формы
     */
    static async updateProfile(event) {
        event.preventDefault();
        try {
            // Получаем обновленную информацию из формы
            const birthdate = elements.profileBirthdate.value;
            const gender = elements.profileGender.value;
            const occupation = elements.profileOccupation.value;

            // Пытаемся обновить профиль пользователя
            const { data, error } = await supabase.auth.updateUser({
                data: { 
                    birthdate: birthdate || null,
                    gender: gender || null,
                    occupation: occupation || null
                }
            });

            if (error) throw error;

            // Показываем сообщение об успехе и обновляем интерфейс
            UIUtils.showSuccess('Профиль успешно обновлен');
            await this.updateProfileUI(data.user);
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            UIUtils.showError('Ошибка при обновлении профиля: ' + error.message);
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
        UIUtils.showPopup(elements.profilePopup);
    }
  
    /**
     * Скрывает всплывающее окно профиля
     */
    static hideProfilePopup() {
        UIUtils.hidePopup(elements.profilePopup);
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
}

export { AuthManager }
import { elements } from './elements.js';
import { supabase, signUp, signIn, signOut} from '../config/SupabaseClient.js';
import { PopupManager } from './PopupManager.js';
// Auth Management
class AuthManager {
    static async handleRegistration(event) {
      event.preventDefault();
      try {
          const email = document.getElementById('register-email').value;
          const password = document.getElementById('register-password').value;
          const username = document.getElementById('register-username').value;
          const age = document.getElementById('register-age').value || null;
          const gender = document.getElementById('register-gender').value || null;
          const occupation = document.getElementById('register-occupation').value || null;

          const result = await signUp(email, password, username, age, gender, occupation);

          if (result) {
              this.showSuccessMessage('Регистрация успешна!');
              PopupManager.close(elements.registerPopup);

                  const loginResult = await signIn(email, password);
                  if (loginResult) {
                      await this.updateProfileUI(loginResult.user);
                  }

          }
      } catch (error) {
          this.showErrorMessage('Ошибка регистрации: ' + error.message);
      }
  }
  
    // И метод handleLogin
    static async handleLogin(event) {
      event.preventDefault();
      try {
          const email = document.getElementById('login-email').value;
          const password = document.getElementById('login-password').value;

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
  
    static async handleLogout() {
      try {
        await signOut();
        this.showSuccessMessage('Вы вышли из системы');
        this.hideProfilePopup();
        this.showAuthButtons();
      } catch (error) {
        this.showErrorMessage('Ошибка при выходе из системы');
      }
    }
  
    static async updateProfileUI(user) {
      console.log('Updating profile UI for user:', user);
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();

        if (error) throw error;

          if (currentUser) {
              elements.profileUsername.textContent = currentUser.user_metadata.username || currentUser.email;
              elements.profileEmail.textContent = currentUser.email;
              document.getElementById('profile-age').value = currentUser.user_metadata.age || '';
              document.getElementById('profile-gender').value = currentUser.user_metadata.gender || '';
              document.getElementById('profile-occupation').value = currentUser.user_metadata.occupation || '';

              this.showProfileButton();
          }
      } catch (error) {
          console.error('Error updating profile UI:', error);
          this.showErrorMessage('Ошибка при обновлении интерфейса профиля: ' + error.message);
      }
  }
  
    static async updateProfile(event) {
      event.preventDefault();
      try {
        const age = document.getElementById('profile-age').value;
        const gender = document.getElementById('profile-gender').value;
        const occupation = document.getElementById('profile-occupation').value;
    
        const { data, error } = await supabase.auth.updateUser({
          data: { 
            age: age ? parseInt(age) : null,
            gender: gender || null,
            occupation: occupation || null
          }
        });
    
        if (error) throw error;
    
        this.showSuccessMessage('Профиль успешно обновлен');
        await this.updateProfileUI(data.user);
      } catch (error) {
        console.error('Error updating profile:', error);
        this.showErrorMessage('Ошибка при обновлении профиля: ' + error.message);
      }
    }
  
    static showProfileArea() {
        elements.profileArea.style.display = 'block';
        elements.logoutButton.style.display = 'block';
        elements.openLoginButton.style.display = 'none';
        elements.openRegisterButton.style.display = 'none';
    }
  
    static hideProfileArea() {
        elements.profileArea.style.display = 'none';
        elements.logoutButton.style.display = 'none';
        elements.openLoginButton.style.display = 'inline-block';
        elements.openRegisterButton.style.display = 'inline-block';
    }
  
    static showProfilePopup() {
      PopupManager.open(elements.profilePopup);
    }
  
    static hideProfilePopup() {
      PopupManager.close(elements.profilePopup);
    }
  
    static showProfileButton() {
      elements.openProfileButton.style.display = 'inline-block';
      elements.openLoginButton.style.display = 'none';
      elements.openRegisterButton.style.display = 'none';
    }
  
    static showAuthButtons() {
      elements.openProfileButton.style.display = 'none';
      elements.openLoginButton.style.display = 'inline-block';
      elements.openRegisterButton.style.display = 'inline-block';
    }
    static showSuccessMessage(message) {
        // Implement your success message UI
        alert(message); // Replace with better UI feedback
    }
  
    static showErrorMessage(message) {
        // Implement your error message UI
        alert(message); // Replace with better UI feedback
    }
  }
  export {AuthManager}
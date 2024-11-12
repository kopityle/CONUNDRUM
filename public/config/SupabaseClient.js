import { AuthManager } from '../script.js'; // Импортируем AuthManage
console.log("window.supabase:", window.supabase); // Для отладки
let supabase;  // Объявляем supabase глобально в модуле

async function initSupabase() {
    try {
        const response = await fetch('/supabase-config');
        const config = await response.json();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error("Supabase URL or anon key not received from server.");
        }

        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        // Auth state observer
        supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
        AuthManager.updateProfileUI(session.user);
        } else if (event === 'SIGNED_OUT') {
        AuthManager.showAuthButtons();
        }
    });
    } catch (error) {
        console.error('Error initializing Supabase:', error);
    }
}

initSupabase(); // Запускаем инициализацию сразу


// Обновленные функции аутентификации с актуальным API
async function signUp(email, password, username, age, gender, occupation) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          username,
          age: age ? parseInt(age) : null,
          gender: gender || null,
          occupation: occupation || null
        }
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Signup error:', error.message);
    throw error;
  }
}

async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
          
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Signin error:', error.message);
        throw error;
    }
}

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Signout error:', error.message);
        throw error;
    }
}

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
        console.error('Get user data error:', error.message);
        throw error;
    }
}

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
        console.error('Profile update error:', error.message);
        throw error;
    }
}

export { supabase, signUp, signIn, signOut, getUserData, updateProfile };
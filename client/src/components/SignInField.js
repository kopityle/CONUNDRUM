import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../config/supabaseClient';
import '../css/signInField.css';
import EyeIcon from '../assets/svg/EyeIcon';
import ArrowLeftIcon from '../assets/svg/ArrowLeftIcon';

const SignInField = ({ isPasswordVisible, togglePasswordVisibility, switchLoginProcess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setMessage(error.message);
                return;
            }

            if (data?.user) {
                setMessage('Вход успешен!');
                navigate('/account');
            }
        } catch (error) {
            setMessage('Ошибка входа');
            console.error('Login error:', error);
        }
    };

    const goToMainPage = () => {
        navigate('/'); 
    };

    return (
        <section className='register-account'>
            <div className='register-account-info'>
                <p className='register-title'>С возвращением!</p>
                <div className='if-have-account'>
                    <p>Нет аккаунта?</p>
                    <button className='sign-in-button' onClick={switchLoginProcess}>
                        Зарегистрироваться!
                    </button>
                </div>
                <form className='register-form' onSubmit={handleLogin}>
                    <div className='reg-input-data'>
                        <input 
                            className='reg-login-input' 
                            type='email' 
                            placeholder='Электронная почта' 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <div className='reg-input-password-div'>
                            <input 
                                className='reg-password-input' 
                                type={isPasswordVisible ? 'text' : 'password'} 
                                placeholder='Пароль' 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <EyeIcon isVisible={isPasswordVisible} onClick={togglePasswordVisibility} />
                        </div>
                    </div>
                    {message && <p className='create-account-message'>{message}</p>}
                    <div className='create-and-exit-buttons'>
                        <button className='back-to-main-page-button' onClick={goToMainPage}>
                            <ArrowLeftIcon />
                            На главную
                        </button>
                        <button 
                            type='submit' 
                            className='create-account-button'
                        >
                            Войти
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default SignInField;
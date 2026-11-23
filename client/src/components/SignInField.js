import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import '../css/signInField.css';
import EyeIcon from '../assets/svg/EyeIcon';
import ArrowLeftIcon from '../assets/svg/ArrowLeftIcon';

const SignInField = ({ isPasswordVisible, togglePasswordVisibility, switchLoginProcess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { user } = await login({ email, password });

            if (user) {
                setMessage('Вход успешен!');
                navigate('/account');
            }
        } catch (error) {
            setMessage(error.message || 'Ошибка входа');
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
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
                            disabled={isLoading}
                        />
                        <div className='reg-input-password-div'>
                            <input 
                                className='reg-password-input' 
                                type={isPasswordVisible ? 'text' : 'password'} 
                                placeholder='Пароль' 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
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
                            disabled={isLoading}
                        >
                            {isLoading ? 'Вход...' : 'Войти'}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default SignInField;
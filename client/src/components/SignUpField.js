import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/signUpField.css';
import EyeIcon from '../assets/svg/EyeIcon';
import ArrowLeftIcon from '../assets/svg/ArrowLeftIcon';
import { OCCUPATIONS, GENDERS } from '../constants/profileOptions';

const SignUpField = ({ isPasswordVisible, togglePasswordVisibility, switchLoginProcess, supabase }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState('');
    const [occupation, setOccupation] = useState('');    
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const goToMainPage = () => {
        navigate('/');
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!supabase) {
            setMessage('Ошибка инициализации. Попробуйте позже.');
            return;
        }

        if (!username || !email || !password || !gender || !occupation) {
            setMessage('Пожалуйста, заполните все поля');
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        gender,
                        occupation
                    }
                }
            });

            if (error) {
                setMessage(error.message);
                throw error;
            }

            if (data?.user) {
                setMessage('Регистрация успешна! Проверьте вашу почту для подтверждения.');
                setTimeout(() => {
                    switchLoginProcess();
                }, 3000);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setMessage(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className='register-account'>
            <div className='register-account-info'>
                <p className='register-title'>Добро пожаловать!</p>
                <div className='if-have-account'>
                    <p>Уже есть аккаунт?</p>
                    <button className='sign-in-button' onClick={switchLoginProcess}>
                        Войти!
                    </button>
                </div>
                <form className='register-form' onSubmit={handleRegister}>
                    <div className='reg-input-data'>
                        <input 
                            className='reg-login-input' 
                            type='text' 
                            placeholder='Имя пользователя' 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)} 
                            autoComplete='off'
                            disabled={isLoading}
                        />
                        <input 
                            className='reg-login-input' 
                            type='email' 
                            placeholder='Электронная почта' 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)} 
                            autoComplete='off'
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
                                autoComplete='off'
                                disabled={isLoading}
                            />
                            <EyeIcon isVisible={isPasswordVisible} onClick={togglePasswordVisibility} />
                        </div>
                    </div>
                    <div className='birthday-role-gender-input'>
                        <div className='reg-role registr' id='reg-role'>
                            <select className='reg-role-select registr' id='reg-role-select' required value={occupation}
                                onChange={(e) => setOccupation(e.target.value)}
                                disabled={isLoading}>
                                <option value='' disabled hidden>Выберите роль</option>
                                {OCCUPATIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className='reg-gender' id='reg-gender'>
                            <select className='reg-gender-select registr' id='reg-gender-select' required value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                disabled={isLoading}>
                                <option value='' disabled hidden>Пол</option>
                                {GENDERS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
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
                            {isLoading ? 'Создание аккаунта...' : 'Создать аккаунт'}
                        </button>
                    </div>
                    
                </form>
            </div>
        </section>
    );
};

export default SignUpField;
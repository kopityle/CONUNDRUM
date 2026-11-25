import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import '../css/profile.css';
import { getMe, updateProfile as updateUserProfile, logout as logoutUser } from '../services/authService';
import ProfileInfo from './ProfileInfo';
import SavedPuzzles from './SavedPuzzles';
import Preloader from '../assets/svg/Preloader';
import NotificationBanner from './NotificationBanner';
import useNotifications from '../hooks/useNotifications';

const PersonalAccount = ({ isBlackTheme, toggleTheme, user }) => {
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const { notifications, notifyError, notifySuccess, dismissNotification } = useNotifications();
    const [userData, setUserData] = useState({
        username: '',
        email: '',
        gender: '',
        occupation: ''
    });
    const [error, setError] = useState(null);
    const [newUsername, setNewUsername] = useState('');
    const [newOccupation, setNewOccupation] = useState('');
    const [newGender, setNewGender] = useState('');

    const getProfile = async () => {
        try {
            if (!user) {
                setError('Пользователь не авторизован');
                return;
            }

            const currentUser = await getMe();

            if (currentUser) {
                const metadata = currentUser.user_metadata || {};
                const username = currentUser.username || metadata.username || 'Не указано';
                const occupation = currentUser.occupation || metadata.occupation || 'Не указано';
                const gender = currentUser.gender || metadata.gender || 'Не указано';

                setUserData({
                    email: currentUser.email || '',
                    username,
                    gender,
                    occupation,
                });
                setNewUsername(username);
                setNewOccupation(currentUser.occupation || metadata.occupation || 'НЕ УКАЗАНО');
                setNewGender(currentUser.gender || metadata.gender || 'НЕ УКАЗАНО');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            setError('Ошибка при загрузке данных пользователя');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        getProfile();
    }, [user]);

    const updateProfile = async () => {
        try {
            const updatedUser = await updateUserProfile({
                username: newUsername,
                gender: newGender,
                occupation: newOccupation,
            });

            const metadata = updatedUser?.user_metadata || {};
            setUserData(prevData => ({
                ...prevData,
                username: updatedUser?.username || metadata.username || newUsername,
                gender: updatedUser?.gender || metadata.gender || newGender,
                occupation: updatedUser?.occupation || metadata.occupation || newOccupation,
            }));

            notifySuccess('Профиль успешно обновлен!');
        } catch (error) {
            console.error('Error updating profile:', error);
            notifyError('Произошла ошибка при обновлении профиля');
        }
    };

    const logout = async () => {
        try {
            await logoutUser();
            navigate('/');
        } catch (error) {
            console.error('Ошибка при выходе из системы:', error);
            notifyError('Ошибка при выходе из системы');
            setTimeout(() => navigate('/'), 2000);
        }
    };

    if (error) {
        return <div className="error">{error}</div>;
    }

    return (
        <>
            <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />
            <Header isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} isAuth={true}/>
            <main className='personal-account-main '>
                <div className="background-video-main red"/>
                <div className="ellipse-bg red"></div>
                
                    {isLoading 
                        ? 
                            <div className='preloader-overlay'><Preloader /></div>
                        :
                        <section className='profile-and-games'>
                            <ProfileInfo
                                userData={userData}
                                newUsername={newUsername}
                                newOccupation={newOccupation}
                                newGender={newGender}
                                onUsernameChange={(e) => setNewUsername(e.target.value)}
                                onOccupationChange={(e) => setNewOccupation(e.target.value)}
                                onGenderChange={(e) => setNewGender(e.target.value)}
                                onUpdateProfile={updateProfile}
                                onLogout={logout}
                            />
                            <SavedPuzzles />
                        </section>
                    }
            </main>
        </>
    )
}

export default PersonalAccount;
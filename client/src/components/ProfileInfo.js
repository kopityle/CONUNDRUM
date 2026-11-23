import React from 'react';
import { OCCUPATIONS, PROFILE_GENDERS } from '../constants/profileOptions';


const ProfileInfo = ({
    userData, 
    newUsername, 
    newOccupation, 
    newGender, 
    onUsernameChange, 
    onOccupationChange, 
    onGenderChange, 
    onUpdateProfile, 
    onLogout 
}) => {
    return (
        <section className='about-account-info profile-info-left'>
            <div className='profile-title'>
                <h1>Личный кабинет</h1>
                <div className='horizontal-line'></div>
            </div>
            <div className='user-data'>
                <div className='user-data-login user-data-item'>
                    <p>Логин</p>
                    <input 
                    className='userdata-input-changer' 
                    type='text' 
                    placeholder={userData.username}
                    value={newUsername}
                    onChange={onUsernameChange}
                    />
                </div>
                <div className='user-data-email user-data-item'>
                    <p>Почта</p>
                    <p className='userdata-input-changer'>{userData.email}</p>
                </div>
                <div className='user-data-role user-data-item'>
                    <p>Роль</p>
                    <div className='reg-role' id='reg-role'>
                        <select 
                            className='reg-role-select' 
                            id='reg-role-select' 
                            required 
                            value={newOccupation}
                            onChange={onOccupationChange}
                        >
                            <option value='' disabled hidden>Выберите роль</option>
                            {OCCUPATIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className='user-data-gender user-data-item'>
                    <p>Пол</p>
                    <div className='reg-gender' id='reg-gender'>
                        <select 
                            className='reg-gender-select' 
                            id='reg-gender-select' 
                            required 
                            value={newGender}
                            onChange={onGenderChange}
                        >
                            <option value='' disabled hidden>Пол</option>
                            {PROFILE_GENDERS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <div className='account-buttons'>
                <button type='submit' onClick={onUpdateProfile} className='update-account-button'>
                    Обновить
                </button>
                <button type='submit' onClick={onLogout} className='log-out-button'>
                    Выйти
                </button>
            </div>
        </section>
    );
};

export default ProfileInfo;
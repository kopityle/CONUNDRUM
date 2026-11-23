import React, { useState } from 'react';
import AboutPopup from './AboutPopup';
import ManualPopup from './ManualPopup';
import { useNavigate } from 'react-router-dom';
import '../css/header.css';
import ThemeChanger from './ThemeChanger';
import HomeIcon from '../assets/svg/HomeIcon';
import StartIcon from '../assets/svg/StartIcon';
import ProfileIcon from '../assets/svg/ProfileIcon';

const Header = ({ isAuth, isBlackTheme, toggleTheme }) => {
  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [isManualVisible, setIsManualVisible] = useState(false);
  const navigate = useNavigate();

  // Проверяем, является ли пользователь LTI пользователем
  const isLTIMode = new URLSearchParams(window.location.search).get('lti') === 'true';

  if (isLTIMode) {
    return null;
  }

  const toggleAboutPopup = () => {
    setIsAboutVisible(!isAboutVisible);
    setIsManualVisible(false);
  };

  const toggleManualPopup = () => {
    setIsManualVisible(!isManualVisible);
    setIsAboutVisible(false);
  };

  const navToRegister = () => navigate('/register');
  const navToGame = () => navigate('/gamegenerator');
  const navToProfile = () => navigate('/account');

  // Генератор доступен гостям: «Старт» всегда ведёт в /gamegenerator.
  const startOnClick = navToGame;
  // Личный кабинет остаётся доступен только после входа.
  const profileOnClick = isAuth ? navToProfile : navToRegister;

  return (
    <header className='main-page-header'>
      <button className='go-main-page-button' onClick={() => navigate('/')}>
        <HomeIcon />
      </button>
      <button className={`about-button ${isAboutVisible ? 'pressed' : ''}`} onClick={toggleAboutPopup}>О проекте</button>
      <button className={`manual-button ${isManualVisible ? 'pressed' : ''}`} onClick={toggleManualPopup}>Инструкция</button>
      <div className='functional-buttons-wrapper'>
        <button className='start-button' onClick={startOnClick}>
          <StartIcon />
        </button> 
        <button className='go-to-profile-button-if-logged-in' onClick={profileOnClick}>
          <ProfileIcon />
        </button>
        <ThemeChanger isBlackTheme={isBlackTheme} toggleTheme={toggleTheme}/>
      </div>
      <AboutPopup isVisible={isAboutVisible}/>
      <ManualPopup isVisible={isManualVisible}/>
    </header>
  );
};

export default Header;
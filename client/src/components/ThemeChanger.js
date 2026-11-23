import '../css/newThemeChanger.css';
import ThemeSwitcherIcon from '../assets/svg/ThemeSwitcherIcon';

const ThemeChanger = ({ isBlackTheme, toggleTheme }) => (
    <button className='theme-changer-button' onClick={toggleTheme} aria-label='Переключить тему'>
        <ThemeSwitcherIcon isBlackTheme={isBlackTheme} />
    </button>
);

export default ThemeChanger;

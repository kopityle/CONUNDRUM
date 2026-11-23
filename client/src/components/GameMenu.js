import PuzzleCreatorIcon from "../assets/svg/PuzzleCreatorIcon";
import ThemeChanger from "./ThemeChanger";
import '../css/gameMenu.css';
import SaveButton from "../assets/svg/SaveButton";
import DownloadPdf from "../assets/svg/DownloadPdf";
import HomeIcon from "../assets/svg/HomeIcon";
import ProfileIcon from "../assets/svg/ProfileIcon";
import EditIcon from "../assets/svg/EditIcon";
import ShareIcon from "../assets/svg/ShareIcon";
import { useState } from "react";
import { useNavigate } from 'react-router-dom';


const GameMenu = ({
    isAuth, 
    isBlackTheme, 
    toggleTheme, 
    isLTI,
    isCurrentGameData,
    isEditing,
    handleEnterEditMode,
    handleActualSavePuzzle,
    onSave,
    handleShare,
    handleDownloadPdf,
    isLoading,
    toggleFormCreatingPuzzle,
    isFormCreatingPuzzle
}) => {
    const [open, setOpen] = useState(true);
    const navigate = useNavigate();

    const navToRegister = () => navigate('/register');
    const navToProfile = () => navigate('/account');

    const profileOnClick = isAuth ? navToProfile : navToRegister;
    const saveGame = onSave || handleActualSavePuzzle;

    return (
        <section className={`game-menu-sidebar ${open ? "open" : "closed"}`}>
            <button 
                className='game-menu-toggle-button'
                onClick={() => {
                    if (isFormCreatingPuzzle) {
                        setOpen(!open);
                        toggleFormCreatingPuzzle();
                    }
                    else {
                        setOpen(!open);
                    }
                }}
            >
                <HomeIcon fill='#000' />
            </button>
            <div className="game-menu-content">
                {!isLTI && (
                    <button className='game-menu-profile-button' onClick={profileOnClick}>
                        <ProfileIcon />
                    </button>
                )}
                <button 
                    className={`open-game-form-button ${isFormCreatingPuzzle ? 'clicked' : ''}`}
                    onClick={toggleFormCreatingPuzzle}>
                    <PuzzleCreatorIcon />
                </button>
                <ThemeChanger isBlackTheme={isBlackTheme} toggleTheme={toggleTheme}/>
                
                {isCurrentGameData && !isEditing && (
                    <>
                    {isCurrentGameData.gameType !== 'rebus' && (
                        <button
                            onClick={handleEnterEditMode}
                            className="game-action-button edit-puzzle-button"
                            title='Редактировать слова и подсказки'
                            disabled={isLoading}
                        >
                            <EditIcon />
                        </button>
                    )}
                        <button
                            onClick={saveGame}
                            className="game-action-button save-puzzle-button"
                            title='Сохранить в свои головоломки'
                            disabled={isLoading}
                        >
                            <SaveButton />
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            className="game-action-button download-pdf-button"
                            title='Cкачать в PDF'
                            disabled={isLoading}
                        >
                            <DownloadPdf />
                        </button>
                        <button
                            onClick={handleShare}
                            className="game-action-button share-game-button"
                            title='Поделиться с классом'
                            disabled={isLoading}
                        >
                            <ShareIcon />
                        </button>
                    </>
                )}
                
            </div>
        </section>
    );
};

export default GameMenu;

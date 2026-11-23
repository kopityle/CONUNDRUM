import React, { useEffect, useMemo, useState } from 'react';
import CrosswordBoard from './game/CrosswordBoard';
import WordSoupBoard from './game/WordSoupBoard';
import CluesPanel from './game/CluesPanel';
import RebusDisplay from './RebusDisplay';
import Preloader from '../assets/svg/Preloader';
import PostGameReview from './PostGameReview';
import '../css/postGameReview.css';

const GameWorkspace = ({
    currentGameData,
    isEditing = false,
    editableWords = [],
    puzzleNameForSave = '',
    isLoading = false,
    gameVersion = 0,
    onItemChange,
    onPuzzleNameChange,
    onSaveChanges,
    onCancelEdit,
    onAttempt,
    onComplete,
    reviewStats,
    reviewTerms = [],
    shareId = '',
    isAuthor = false,
    onDownloadPdf,
    onShare,
    onRestart,
    onHint,
}) => {
    const [foundWords, setFoundWords] = useState([]);
    const [hint, setHint] = useState(null);

    const gameType = currentGameData?.gameType;
    const dataSignature = `${gameType || ''}-${gameVersion}`;

    useEffect(() => {
        setFoundWords([]);
        setHint(null);
    }, [dataSignature]);

    const crosswordGrid = useMemo(
        () => currentGameData?.crossword || currentGameData?.grid || [],
        [dataSignature, currentGameData]
    );
    const crosswordWords = useMemo(
        () => currentGameData?.layout?.result || currentGameData?.words || [],
        [dataSignature, currentGameData]
    );
    const wordSoupGrid = useMemo(
        () => currentGameData?.grid || [],
        [dataSignature, currentGameData]
    );
    const wordSoupWords = useMemo(
        () => currentGameData?.words || [],
        [dataSignature, currentGameData]
    );
    const clueWords = useMemo(() => {
        if (isEditing && editableWords.length) return editableWords;
        return gameType === 'crossword' ? crosswordWords : wordSoupWords;
    }, [isEditing, editableWords, gameType, crosswordWords, wordSoupWords]);

    const showHint = (type, word) => {
        setHint({ type, value: word, token: `${Date.now()}-${Math.random()}` });
    };

    const renderBoard = () => {
        if (isEditing) return null;

        if (gameType === 'crossword') {
            if (!crosswordGrid.length || !crosswordWords.length) return null;
            return (
                <CrosswordBoard
                    key={`crossword-${dataSignature}`}
                    grid={crosswordGrid}
                    words={crosswordWords}
                    onAttempt={onAttempt}
                    onComplete={onComplete}
                    hint={hint}
                    onHint={onHint}
                />
            );
        }

        if (gameType === 'wordsoup') {
            if (!wordSoupGrid.length) return null;
            return (
                <WordSoupBoard
                    key={`wordsoup-${dataSignature}`}
                    grid={wordSoupGrid}
                    words={wordSoupWords}
                    onAttempt={onAttempt}
                    onComplete={onComplete}
                    onWordFound={(word) => setFoundWords((prev) =>
                        prev.includes(word) ? prev : [...prev, word]
                    )}
                />
            );
        }

        return null;
    };

    return (
        <section id='display-game-on-screen'>
            <section id='crossword-and-clues'>
                <div id='preloader-container' style={{ display: isLoading ? 'flex' : 'none' }}>
                    <Preloader />
                </div>

                {currentGameData && gameType === 'rebus' && (
                    <div className='rebus-wrapper'>
                        <RebusDisplay
                            gameData={currentGameData}
                            onAttempt={onAttempt}
                            onComplete={onComplete}
                            onHint={onHint}
                        />
                    </div>
                )}

                {currentGameData && gameType !== 'rebus' && (
                    <div
                        id='crossword-container'
                        className={isEditing ? 'grid-disabled' : ''}
                        style={{ display: isLoading ? 'none' : 'flex' }}
                    >
                        {renderBoard()}
                    </div>
                )}

                <section className='puzzle-info-and-iditing'>
                    {isEditing && (
                        <div className='edit-puzzle-info-container'>
                            <div className='edit-puzzle-info-wrapper'>
                                <input
                                    type='text'
                                    value={puzzleNameForSave}
                                    onChange={(event) => onPuzzleNameChange?.(event.target.value)}
                                    placeholder='Название пазла'
                                    className='puzzle-name-edit-input'
                                    aria-label='Название пазла'
                                />
                            </div>
                            <div className='edit-puzzle-info-wrapper'>
                                <div className='edit-puzzle-info-buttons'>
                                    <button
                                        type='button'
                                        className='game-action-btn save-changes-btn'
                                        onClick={onSaveChanges}
                                        title='Сохранить изменения и перегенерировать сетку'
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                    <button
                                        type='button'
                                        className='game-action-btn cancel-edit-btn'
                                        onClick={onCancelEdit}
                                        title='Отменить редактирование'
                                        disabled={isLoading}
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentGameData && gameType !== 'rebus' && (
                        <div
                            id='clues-container'
                            style={{ display: isLoading ? 'none' : 'flex' }}
                        >
                            <CluesPanel
                                gameType={gameType}
                                words={clueWords}
                                editableWords={editableWords}
                                isEditing={isEditing}
                                foundWords={foundWords}
                                onItemChange={onItemChange}
                                onShowAnswer={(word) => {
                                    onHint?.(word);
                                    if (gameType === 'crossword') showHint('word', word);
                                }}
                                onRevealLetter={(word) => {
                                    onHint?.(word);
                                    showHint('letter', word);
                                }}
                            />
                        </div>
                    )}
                </section>
            </section>

            {reviewStats && !isEditing && (
                <PostGameReview
                    stats={reviewStats}
                    terms={reviewTerms || []}
                    gameType={gameType}
                    shareId={shareId}
                    isAuthor={isAuthor}
                    onDownloadPdf={onDownloadPdf}
                    onShare={onShare}
                    onRestart={onRestart}
                />
            )}
        </section>
    );
};

export default GameWorkspace;

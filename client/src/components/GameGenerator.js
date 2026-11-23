import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '../css/gameGenerator.css';

import GameMenu from './GameMenu';
import PuzzleCreatorForm from './PuzzleCreatorForm';
import GameWorkspace from './GameWorkspace';
import NotificationBanner from './NotificationBanner';
import useNotifications from '../hooks/useNotifications';
import ActivityTracker from '../modules/ActivityTracker';
import GameLogotype from '../assets/svg/GameLogotype';
import {
    createPuzzle,
    getPuzzle,
    updatePuzzle,
    fetchRegeneratedLayout,
    saveLtiConfiguration,
    getLtiConfiguration,
} from '../services/puzzleService';
import ShareModal from './ShareModal';
import AuthRequiredModal from './AuthRequiredModal';

const GAME_TYPES = ['crossword', 'wordsoup', 'rebus'];

const GameGenerator = ({ isBlackTheme, toggleTheme, user, isAuth, ltiUserId }) => {
    const navigate = useNavigate();
    const { notifications, notifyError, notifySuccess, dismissNotification } = useNotifications();
    const trackerRef = useRef(null);
    if (!trackerRef.current) trackerRef.current = new ActivityTracker();

    const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
    const isLTI = urlParams.get('lti') === 'true';
    const isAuthenticated = !!user;
    const ltiContextId = useMemo(
        () => ltiUserId
            || user?.ltiUserId
            || user?.lti_user_id
            || user?.user_metadata?.moodle_id
            || (user?.lti ? user.id : undefined),
        [ltiUserId, user]
    );

    const [isFormCreatingPuzzle, setIsFormCreatingPuzzle] = useState(true);
    const [isConfigureMode, setIsConfigureMode] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [currentGameData, setCurrentGameData] = useState(null);
    const [puzzleNameForSave, setPuzzleNameForSave] = useState('');
    const [currentPuzzleId, setCurrentPuzzleId] = useState(null);
    const [resourceLinkId, setResourceLinkId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editableWordsAndClues, setEditableWordsAndClues] = useState([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [originalPuzzleNameForEdit, setOriginalPuzzleNameForEdit] = useState('');
    const [gameVersion, setGameVersion] = useState(0);
    const [currentShareId, setCurrentShareId] = useState(null);
    const [shareTarget, setShareTarget] = useState(null);
    const [isAuthRequiredOpen, setIsAuthRequiredOpen] = useState(false);

    const calculateScore = useCallback(() => {
        const stats = trackerRef.current.getStats();
        if (!stats) return 0;

        const score = stats.attempts > 0 ? parseFloat(stats.accuracy) : 0;
        return Math.max(0, Math.min(100, Math.round(score)));
    }, []);

    const submitLTIScore = useCallback(async (score) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/lti/submit-score`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score, totalScore: 100 }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to submit score: ${errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Error submitting LTI score:', error);
        }
    }, []);

    const handleComplete = useCallback(async () => {
        if (ltiContextId) {
            await submitLTIScore(calculateScore());
        }
        trackerRef.current.stopTracking();
    }, [calculateScore, ltiContextId, submitLTIScore]);

    const handleAttempt = useCallback((isCorrect) => {
        trackerRef.current.recordAttempt(isCorrect);
    }, []);

    const startGameTracking = useCallback((gameData, sourceName, inputType = 'loaded_or_edited') => {
        trackerRef.current.reset();
        // ActivityTracker не использует метаданные, но они остаются в вызове для совместимости.
        trackerRef.current.startTracking({
            gameType: gameData?.gameType,
            inputType,
            sourceName,
            totalWords: gameData?.words?.length || 0,
        });
    }, []);

    const generateGameFromConfig = useCallback(async (config) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('gameType', config.gameType);
            formData.append('inputType', config.inputType);
            formData.append('totalWords', config.totalWords);
            formData.append('difficulty', config.difficulty || 'normal');
            if (config.inputType === 'text') formData.append('text', config.text);
            else if (config.inputType === 'topic') formData.append('topic', config.topic);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-game`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || response.statusText);
            }

            const data = await response.json();
            const nextGameData = { ...data, gameType: config.gameType };
            setCurrentGameData(nextGameData);
            setPuzzleNameForSave('');
            setIsFormCreatingPuzzle(false);
            setIsConfigureMode(false);
            setIsLoading(false);
            setGameVersion((version) => version + 1);
            startGameTracking(nextGameData, 'LTI', 'lti_config');
        } catch (error) {
            notifyError(`Не удалось загрузить задание: ${error.message}`);
            setIsLoading(false);
        }
    }, [notifyError, startGameTracking]);

    const loadAndDisplayPuzzle = useCallback(async (puzzleId) => {
        setIsLoading(true);
        try {
            const loadedPuzzle = await getPuzzle(puzzleId);
            if (!loadedPuzzle?.game_data || !loadedPuzzle.id) {
                throw new Error('Пазл не найден');
            }

            const nextGameData = {
                ...loadedPuzzle.game_data,
                gameType: loadedPuzzle.game_type || loadedPuzzle.game_data.gameType,
            };
            if (!GAME_TYPES.includes(nextGameData.gameType)) {
                throw new Error(`Неизвестный тип игры: ${nextGameData.gameType}`);
            }

            setCurrentGameData(nextGameData);
            setPuzzleNameForSave(loadedPuzzle.name || '');
            setCurrentPuzzleId(loadedPuzzle.id);
            setCurrentShareId(loadedPuzzle.share_id || null);
            setOriginalPuzzleNameForEdit(loadedPuzzle.name || '');
            setIsFormCreatingPuzzle(false);
            setIsConfigureMode(true);
            setIsEditing(false);
            setIsLoading(false);
            setGameVersion((version) => version + 1);
            startGameTracking(nextGameData, loadedPuzzle.name || 'Unnamed Puzzle', 'loaded_from_db');
        } catch (error) {
            notifyError(`Ошибка при загрузке игры: ${error.message}`);
            setIsLoading(false);
        }
    }, [notifyError, startGameTracking]);

    useEffect(() => {
        trackerRef.current.startTracking();

        if (isLTI) {
            if (!user) {
                setIsLoading(true);
                return;
            }

            const mode = urlParams.get('mode');
            const resource = urlParams.get('resource_link_id');
            setResourceLinkId(resource);

            if (mode === 'configure') {
                setIsFormCreatingPuzzle(true);
                setIsConfigureMode(true);
                setIsLoading(false);
            } else if (mode === 'solve') {
                setIsFormCreatingPuzzle(false);
                setIsConfigureMode(false);
                setIsLoading(true);
                getLtiConfiguration(resource)
                    .then((config) => {
                        if (config) generateGameFromConfig(config);
                        else {
                            notifyError('Задание еще не настроено преподавателем.');
                            setIsLoading(false);
                        }
                    })
                    .catch((error) => {
                        notifyError(`Ошибка загрузки задания: ${error.message}`);
                        setIsLoading(false);
                    });
            } else {
                setIsLoading(false);
            }
            return;
        }

        const puzzleIdToLoad = urlParams.get('load_puzzle_id');
        if (puzzleIdToLoad) {
            loadAndDisplayPuzzle(puzzleIdToLoad);
        } else {
            setIsLoading(false);
            setIsFormCreatingPuzzle(true);
            setIsConfigureMode(true);
        }
    }, [generateGameFromConfig, isLTI, loadAndDisplayPuzzle, notifyError, urlParams, user]);

    useEffect(() => () => trackerRef.current.stopTracking(), []);

    const handleSaveLtiConfig = useCallback(async (params) => {
        if (!params.gameType || !params.inputType || !params.totalWords || params.totalWords < 1) {
            notifyError('Пожалуйста, заполните все обязательные поля.');
            return;
        }

        setIsLoading(true);
        try {
            const generationParams = {
                gameType: params.gameType,
                inputType: params.inputType,
                topic: params.topic,
                text: params.text,
                totalWords: Number(params.totalWords),
                difficulty: params.difficulty || 'normal',
            };
            await saveLtiConfiguration(resourceLinkId, generationParams);
            notifySuccess('Конфигурация для этого задания успешно сохранена!');
        } catch (error) {
            notifyError(`Ошибка сохранения: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [notifyError, notifySuccess, resourceLinkId]);

    const handleGenerateGame = useCallback(async (params) => {
        const { gameType, inputType, topic, text, totalWords, difficulty, file, puzzleName } = params;

        if (!inputType) {
            notifyError('Выберите тип ввода.');
            return;
        }
        if (inputType === 'text' && (!text || !text.trim())) {
            notifyError('Введите текст.');
            return;
        }
        if (inputType === 'topic' && (!topic || !topic.trim())) {
            notifyError('Введите тему.');
            return;
        }
        if (inputType === 'file' && !file) {
            notifyError('Выберите файл.');
            return;
        }
        if (!Number.isFinite(totalWords) || totalWords < 1) {
            notifyError('Введите корректное количество слов (больше 0).');
            return;
        }

        setIsLoading(true);
        setCurrentGameData(null);
        try {
            const formData = new FormData();
            formData.append('gameType', gameType);
            formData.append('difficulty', difficulty);
            formData.append('inputType', inputType);
            formData.append('totalWords', totalWords);

            if (inputType === 'text') formData.append('text', text);
            else if (inputType === 'topic') formData.append('topic', topic);
            else if (inputType === 'file' && file) formData.append('file-upload', file);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-game`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to generate games: ${errorData.error || response.status}`);
            }

            const data = await response.json();
            const nextGameData = { ...data, gameType };
            setCurrentGameData(nextGameData);
            setPuzzleNameForSave(puzzleName || '');
            setIsFormCreatingPuzzle(false);
            setIsLoading(false);
            setGameVersion((version) => version + 1);
            startGameTracking(nextGameData, puzzleName || 'Unnamed Puzzle', inputType);
            trackerRef.current.recordGameGenerated({ gameType, inputType, totalWords });
        } catch (error) {
            notifyError(error.message || 'Произошла ошибка при генерации игры. Пожалуйста, попробуйте снова.');
            setCurrentGameData(null);
            setIsLoading(false);
        }
    }, [notifyError, startGameTracking]);

    const handleSubmit = useCallback((params) => {
        if (isConfigureMode && isLTI) handleSaveLtiConfig(params);
        else handleGenerateGame(params);
    }, [handleGenerateGame, handleSaveLtiConfig, isConfigureMode, isLTI]);

    const handleActualSavePuzzle = useCallback(async () => {
        if (!puzzleNameForSave.trim()) {
            notifyError('Пожалуйста, введите название игры.');
            return;
        }
        if (!currentGameData?.gameType) {
            notifyError('Тип игры не определен в сохраненных данных. Попробуйте сгенерировать заново.');
            return;
        }
        if (!GAME_TYPES.includes(currentGameData.gameType)) {
            notifyError(`Недопустимый тип игры для сохранения: ${currentGameData.gameType}`);
            return;
        }

        const puzzleToSave = {
            name: puzzleNameForSave,
            game_type: currentGameData.gameType,
            game_data: currentGameData,
            tags: [],
        };

        try {
            const savedPuzzle = await createPuzzle(puzzleToSave);
            if (savedPuzzle?.id) {
                notifySuccess(`Игра "${savedPuzzle.name}" успешно сохранена!`);
                setCurrentPuzzleId(savedPuzzle.id);
                setCurrentShareId(savedPuzzle.share_id || null);
                setOriginalPuzzleNameForEdit(savedPuzzle.name);
            } else {
                notifyError('Не удалось сохранить игру или ID не был получен.');
            }
        } catch (error) {
            notifyError(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`);
        }
    }, [currentGameData, notifyError, notifySuccess, puzzleNameForSave]);

    const handleDownloadPdf = useCallback(async () => {
        if (!currentGameData) {
            notifyError('Нет данных игры для скачивания.');
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameData: currentGameData,
                    gameName: puzzleNameForSave || currentGameData.gameType,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${puzzleNameForSave || currentGameData.gameType || 'game'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            notifyError(`Ошибка при скачивании PDF: ${error.message}`);
        }
    }, [currentGameData, notifyError, puzzleNameForSave]);

    const handleEnterEditMode = useCallback(() => {
        if (!currentGameData?.words) {
            notifyError('Нет данных для редактирования.');
            return;
        }

        const wordsWithOriginalIndex = currentGameData.words.map((word, index) => ({
            ...word,
            originalArrayIndex: index,
        }));
        setIsEditing(true);
        setEditableWordsAndClues(wordsWithOriginalIndex);
        setHasUnsavedChanges(false);
        setOriginalPuzzleNameForEdit(puzzleNameForSave);
    }, [currentGameData, notifyError, puzzleNameForSave]);

    const handleItemChange = useCallback((originalIndex, field, value) => {
        setEditableWordsAndClues((prev) => prev.map((item) =>
            item.originalArrayIndex === originalIndex ? { ...item, [field]: value } : item
        ));
        setHasUnsavedChanges(true);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditableWordsAndClues([]);
        setHasUnsavedChanges(false);
        setPuzzleNameForSave(originalPuzzleNameForEdit);
        setGameVersion((version) => version + 1);
    }, [originalPuzzleNameForEdit]);

    const handleSaveChangesAndRegenerate = useCallback(async () => {
        if (!currentGameData) {
            notifyError('Нет данных игры для сохранения.');
            return;
        }

        const wordsChanged = JSON.stringify(editableWordsAndClues.map(({ word, clue }) => ({ word, clue }))) !==
            JSON.stringify(currentGameData.words.map(({ word, clue }) => ({ word, clue })));
        const nameChanged = puzzleNameForSave !== originalPuzzleNameForEdit;

        if (!wordsChanged && !nameChanged && !hasUnsavedChanges) {
            notifyError('Нет изменений для сохранения.');
            setIsEditing(false);
            setGameVersion((version) => version + 1);
            return;
        }

        setIsEditing(false);
        setIsLoading(true);
        try {
            const wordsForBackend = editableWordsAndClues.map(({ originalArrayIndex, ...rest }) => rest);
            const regenerated = await fetchRegeneratedLayout(currentGameData.gameType, wordsForBackend);
            if (!regenerated?.words) {
                throw new Error('Сервер вернул некорректные данные после перегенерации.');
            }

            const updatedGameData = currentGameData.gameType === 'crossword'
                ? {
                    ...currentGameData,
                    name: puzzleNameForSave,
                    crossword: regenerated.crossword,
                    grid: regenerated.crossword,
                    layout: regenerated.layout,
                    words: regenerated.words,
                }
                : {
                    ...currentGameData,
                    name: puzzleNameForSave,
                    grid: regenerated.grid,
                    gridSize: regenerated.gridSize,
                    words: regenerated.words,
                };

            if (currentPuzzleId) {
                const updatedPuzzle = await updatePuzzle(currentPuzzleId, {
                    name: puzzleNameForSave,
                    game_data: updatedGameData,
                });
                if (updatedPuzzle?.share_id) setCurrentShareId(updatedPuzzle.share_id);
                setCurrentGameData(updatedGameData);
                setOriginalPuzzleNameForEdit(puzzleNameForSave);
                notifySuccess(`Пазл "${puzzleNameForSave}" успешно обновлен!`);
            } else {
                if (!puzzleNameForSave.trim()) {
                    throw new Error('Пожалуйста, введите название для нового пазла.');
                }
                const puzzleToCreate = {
                    name: puzzleNameForSave,
                    game_type: currentGameData.gameType,
                    game_data: updatedGameData,
                    tags: [],
                };
                const newSavedPuzzle = await createPuzzle(puzzleToCreate);
                if (!newSavedPuzzle?.id) {
                    throw new Error('Не удалось создать и сохранить новый пазл.');
                }
                setCurrentGameData(updatedGameData);
                setCurrentPuzzleId(newSavedPuzzle.id);
                setCurrentShareId(newSavedPuzzle.share_id || null);
                setPuzzleNameForSave(newSavedPuzzle.name);
                setOriginalPuzzleNameForEdit(newSavedPuzzle.name);
                notifySuccess(`Новый пазл "${newSavedPuzzle.name}" успешно создан и сохранен!`);
            }

            setEditableWordsAndClues([]);
            setHasUnsavedChanges(false);
            setGameVersion((version) => version + 1);
            startGameTracking(updatedGameData, puzzleNameForSave);
        } catch (error) {
            setIsEditing(true);
            notifyError(`Ошибка: ${error.message || 'Не удалось сохранить изменения.'}`);
        } finally {
            setIsLoading(false);
        }
    }, [
        currentGameData,
        currentPuzzleId,
        editableWordsAndClues,
        hasUnsavedChanges,
        notifyError,
        notifySuccess,
        originalPuzzleNameForEdit,
        puzzleNameForSave,
        startGameTracking,
    ]);

    const handleShare = useCallback(async () => {
        if (!currentGameData?.gameType) {
            notifyError('Нет игры, которой можно поделиться.');
            return;
        }

        try {
            let shareId = currentShareId;
            let name = puzzleNameForSave?.trim() || currentGameData.gameType;

            if (!shareId) {
                const createdPuzzle = await createPuzzle({
                    name,
                    game_type: currentGameData.gameType,
                    game_data: currentGameData,
                    tags: [],
                });
                shareId = createdPuzzle?.share_id;
                if (!shareId) {
                    throw new Error('Не удалось получить ссылку на игру.');
                }
                name = createdPuzzle.name || name;
                setCurrentShareId(shareId);
                if (createdPuzzle.id) setCurrentPuzzleId(createdPuzzle.id);
            }

            setShareTarget({ shareId, name });
        } catch (error) {
            notifyError(`Ошибка при создании ссылки: ${error.message || 'Неизвестная ошибка'}`);
        }
    }, [createPuzzle, currentGameData, currentShareId, notifyError, puzzleNameForSave]);

    const handleSaveClick = useCallback(() => {
        if (!isAuthenticated) {
            setIsAuthRequiredOpen(true);
            return;
        }
        handleActualSavePuzzle();
    }, [handleActualSavePuzzle, isAuthenticated]);

    return (
        <>
            <Helmet>
                <title>Генератор головоломок и кроссвордов — CONUNDRUM</title>
                <meta
                    name='description'
                    content='Онлайн-генератор головоломок, кроссвордов и ребусов CONUNDRUM. Создавайте обучающие игры из текста или файлов за несколько шагов.'
                />
                <meta name='robots' content='index, follow' />
                <link rel='canonical' href={`${window.BASE_URL || ''}/gamegenerator`} />
                <meta property='og:title' content='Генератор головоломок — CONUNDRUM' />
                <meta
                    property='og:description'
                    content='Создавайте кроссворды, ребусы и обучающие игры онлайн с помощью генератора CONUNDRUM.'
                />
                <meta property='og:type' content='website' />
                <meta property='og:url' content={`${window.BASE_URL || ''}/gamegenerator`} />
                <meta property='og:image' content={`${window.BASE_URL || ''}/favicon.ico`} />
                <meta name='twitter:card' content='summary_large_image' />
            </Helmet>

            <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

            <main id='game-main-page'>
                <GameMenu
                    isAuth={isAuth}
                    isBlackTheme={isBlackTheme}
                    toggleTheme={toggleTheme}
                    isLTI={isLTI}
                    isAuthenticated={isAuthenticated}
                    isCurrentGameData={currentGameData}
                    isEditing={isEditing}
                    handleEnterEditMode={handleEnterEditMode}
                    handleActualSavePuzzle={handleActualSavePuzzle}
                    onSave={handleSaveClick}
                    handleShare={handleShare}
                    handleDownloadPdf={handleDownloadPdf}
                    isLoading={isLoading}
                    toggleFormCreatingPuzzle={() => setIsFormCreatingPuzzle((visible) => !visible)}
                    isFormCreatingPuzzle={isFormCreatingPuzzle}
                    navToProfile={() => navigate('/account')}
                />

                <div className='background-video-main red' />
                <div className='ellipse-bg red' />
                <div className='main-logo-title red'>
                    <GameLogotype />
                </div>

                <section className={`creating-puzzle-input-data ${isFormCreatingPuzzle ? 'visible' : 'hidden'}`}>
                    <PuzzleCreatorForm
                        isLTI={isLTI}
                        isConfigureMode={isConfigureMode}
                        isLoading={isLoading}
                        onSubmit={handleSubmit}
                        onFileError={notifyError}
                    />
                </section>

                <GameWorkspace
                    currentGameData={currentGameData}
                    isEditing={isEditing}
                    editableWords={editableWordsAndClues}
                    puzzleNameForSave={puzzleNameForSave}
                    isLoading={isLoading}
                    gameVersion={gameVersion}
                    onItemChange={handleItemChange}
                    onPuzzleNameChange={(name) => {
                        setPuzzleNameForSave(name);
                        setHasUnsavedChanges(true);
                    }}
                    onSaveChanges={handleSaveChangesAndRegenerate}
                    onCancelEdit={handleCancelEdit}
                    onAttempt={handleAttempt}
                    onComplete={handleComplete}
                />
            </main>

            {shareTarget && (
                <ShareModal
                    shareId={shareTarget.shareId}
                    name={shareTarget.name}
                    onClose={() => setShareTarget(null)}
                />
            )}

            {isAuthRequiredOpen && (
                <AuthRequiredModal
                    onLogin={() => {
                        setIsAuthRequiredOpen(false);
                        navigate('/register');
                    }}
                    onCopyLink={() => {
                        setIsAuthRequiredOpen(false);
                        handleShare();
                    }}
                    onClose={() => setIsAuthRequiredOpen(false)}
                />
            )}
        </>
    );
};

export default GameGenerator;

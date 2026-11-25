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
import { apiUrl } from '../services/apiConfig';
import { apiFetch } from '../services/authService';
import {
    createPuzzle,
    getPuzzle,
    updatePuzzle,
    fetchRegeneratedLayout,
    saveLtiConfiguration,
    getLtiConfiguration,
    downloadGamePdf,
} from '../services/puzzleService';
import { getReviewTerms } from '../utils/reviewTerms';
import { buildAutoPuzzleName } from '../utils/puzzleName';
import ShareModal from './ShareModal';
import AuthRequiredModal from './AuthRequiredModal';

const GAME_TYPES = ['crossword', 'wordsoup', 'rebus'];

const GameGenerator = ({ isBlackTheme, toggleTheme, user, isAuth, isAuthResolved = true, ltiUserId }) => {
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
    const [reviewStats, setReviewStats] = useState(null);

    const calculateScore = useCallback(() => {
        const stats = trackerRef.current.getStats();
        if (!stats) return 0;

        const score = stats.attempts > 0 ? parseFloat(stats.accuracy) : 0;
        return Math.max(0, Math.min(100, Math.round(score)));
    }, []);

    const submitLTIScore = useCallback(async (score) => {
        try {
            // apiFetch добавляет Bearer-токен: внутри iframe LMS сессионную
            // cookie браузер может не отправить, а токен всегда под рукой.
            await apiFetch('/api/lti/submit-score', {
                method: 'POST',
                body: { score, totalScore: 100 },
            });
        } catch (error) {
            console.error('Error submitting LTI score:', error);
        }
    }, []);

    const handleComplete = useCallback(async () => {
        if (isLTI || ltiContextId) {
            await submitLTIScore(calculateScore());
        }
        const stats = trackerRef.current.stopTracking() || trackerRef.current.getStats();
        setReviewStats({
            accuracy: parseFloat(stats?.accuracy) || 0,
            duration: stats?.duration || 0,
            attempts: stats?.attempts || 0,
            wrongWords: stats?.wrongWords || [],
            hintedWords: stats?.hintedWords || [],
        });
    }, [calculateScore, isLTI, ltiContextId, submitLTIScore]);

    const handleAttempt = useCallback((isCorrect, word) => {
        trackerRef.current.recordAttempt(isCorrect, word);
    }, []);

    const startGameTracking = useCallback((gameData, sourceName, inputType = 'loaded_or_edited') => {
        setReviewStats(null);
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

            const response = await fetch(apiUrl('/api/generate-game'), {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка запроса (${response.status}) ${response.statusText}`.trim());
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

        // Ждём только проверку сессии, но не самого пользователя: в LTI без
        // токена user может никогда не появиться, и спиннер зависнет навсегда.
        if (isLTI && !isAuthResolved) return;

        if (isLTI) {

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
                if (!isAuthenticated) {
                    notifyError('Войдите через LTI, чтобы загрузить задание.');
                    setIsLoading(false);
                    return;
                }
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
    }, [generateGameFromConfig, isAuthResolved, isAuthenticated, isLTI, loadAndDisplayPuzzle, notifyError, urlParams]);

    useEffect(() => () => trackerRef.current.stopTracking(), []);

    const handleSaveLtiConfig = useCallback(async (params) => {
        if (!params.gameType || !params.inputType || !params.totalWords || params.totalWords < 1) {
            notifyError('Пожалуйста, заполните все обязательные поля.');
            return;
        }
        // В режиме решения LTI-задания файл недоступен, поэтому сохраняем только text/topic.
        if (!['text', 'topic'].includes(params.inputType)) {
            notifyError('Для LTI-задания доступны только ввод текста и тема.');
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

            const response = await fetch(apiUrl('/api/generate-game'), {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to generate games: ${errorData.error || `ошибка ${response.status} ${response.statusText}`.trim()}`);
            }

            const data = await response.json();
            const nextGameData = { ...data, gameType };
            const resolvedName = buildAutoPuzzleName({ puzzleName, inputType, topic, gameData: nextGameData });
            setCurrentGameData(nextGameData);
            setPuzzleNameForSave(resolvedName);
            setIsFormCreatingPuzzle(false);
            setIsLoading(false);
            setGameVersion((version) => version + 1);
            startGameTracking(nextGameData, resolvedName, inputType);
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

    // Обновление пазла доступно только владельцу. Гость может создавать пазлы
    // (POST разрешён без токена), поэтому при утерянной сессии сохраняем копию,
    // а не показываем ошибку «Unauthorized» из PUT /api/puzzles/:id.
    const savePuzzle = useCallback(async ({ name, gameData }) => {
        if (currentPuzzleId && isAuthenticated) {
            try {
                const puzzle = await updatePuzzle(currentPuzzleId, {
                    name,
                    game_data: gameData,
                });
                return { puzzle, created: false };
            } catch (error) {
                if (error?.status !== 401) throw error;
                setCurrentPuzzleId(null);
            }
        }

        const puzzle = await createPuzzle({
            name,
            game_type: gameData.gameType,
            game_data: gameData,
            tags: [],
        });
        return { puzzle, created: true };
    }, [createPuzzle, currentPuzzleId, isAuthenticated, updatePuzzle]);

    const handleActualSavePuzzle = useCallback(async () => {
        if (!currentGameData?.gameType) {
            notifyError('Тип игры не определен в сохраненных данных. Попробуйте сгенерировать заново.');
            return;
        }
        if (!GAME_TYPES.includes(currentGameData.gameType)) {
            notifyError(`Недопустимый тип игры для сохранения: ${currentGameData.gameType}`);
            return;
        }

        try {
            const nameToSave = puzzleNameForSave?.trim() || buildAutoPuzzleName({ gameData: currentGameData });
            const { puzzle: savedPuzzle, created } = await savePuzzle({
                name: nameToSave,
                gameData: currentGameData,
            });
            if (savedPuzzle?.id) {
                notifySuccess(created
                    ? `Игра "${savedPuzzle.name}" успешно сохранена!`
                    : `Пазл "${savedPuzzle.name}" успешно обновлен!`);
                setCurrentPuzzleId(savedPuzzle.id);
                setCurrentShareId(savedPuzzle.share_id || null);
                setOriginalPuzzleNameForEdit(savedPuzzle.name);
            } else {
                notifyError('Не удалось сохранить игру или ID не был получен.');
            }
        } catch (error) {
            notifyError(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`);
        }
    }, [currentGameData, notifyError, notifySuccess, puzzleNameForSave, savePuzzle]);

    const handleDownloadPdf = useCallback(async () => {
        if (!currentGameData) {
            notifyError('Нет данных игры для скачивания.');
            return;
        }

        const gameName = puzzleNameForSave?.trim() || buildAutoPuzzleName({ gameData: currentGameData });
        try {
            await downloadGamePdf({
                gameData: currentGameData,
                gameName,
                shareId: currentShareId,
                fileName: gameName,
            });
        } catch (error) {
            notifyError(`Ошибка при скачивании PDF: ${error.message}`);
        }
    }, [currentGameData, currentShareId, notifyError, puzzleNameForSave]);

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

            const nameToSave = puzzleNameForSave?.trim() || buildAutoPuzzleName({ gameData: updatedGameData });

            const hadSavedPuzzle = Boolean(currentPuzzleId);
            const { puzzle: savedPuzzle, created } = await savePuzzle({
                name: nameToSave,
                gameData: updatedGameData,
            });
            if (!savedPuzzle?.id) {
                throw new Error('Не удалось сохранить изменения пазла.');
            }

            setCurrentGameData(updatedGameData);
            setCurrentPuzzleId(savedPuzzle.id);
            setCurrentShareId(savedPuzzle.share_id || null);
            setPuzzleNameForSave(savedPuzzle.name || nameToSave);
            setOriginalPuzzleNameForEdit(savedPuzzle.name || nameToSave);
            notifySuccess(created && hadSavedPuzzle
                ? `Изменения сохранены как новый пазл "${savedPuzzle.name}". Чтобы обновить исходный, войдите в аккаунт.`
                : created
                    ? `Новый пазл "${savedPuzzle.name}" успешно создан и сохранен!`
                    : `Пазл "${savedPuzzle.name}" успешно обновлен!`);

            setEditableWordsAndClues([]);
            setHasUnsavedChanges(false);
            setGameVersion((version) => version + 1);
            startGameTracking(updatedGameData, nameToSave);
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
        savePuzzle,
        startGameTracking,
    ]);

    const handleShare = useCallback(async () => {
        if (!currentGameData?.gameType) {
            notifyError('Нет игры, которой можно поделиться.');
            return;
        }

        try {
            let shareId = currentShareId;
            let name = puzzleNameForSave?.trim() || buildAutoPuzzleName({ gameData: currentGameData });

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
                    isReadOnly={isLTI && !isConfigureMode}
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
                    reviewStats={reviewStats}
                    reviewTerms={getReviewTerms(currentGameData)}
                    shareId={currentShareId}
                    isAuthor={isAuthenticated && !(isLTI && !isConfigureMode)}
                    onDownloadPdf={handleDownloadPdf}
                    onShare={handleShare}
                    onRestart={() => {
                        setReviewStats(null);
                        setGameVersion((version) => version + 1);
                    }}
                    onHint={(word) => trackerRef.current.recordHint(word)}
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

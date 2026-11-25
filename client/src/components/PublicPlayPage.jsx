import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPublicPuzzle, submitAttempt, downloadGamePdf } from '../services/puzzleService';
import ActivityTracker from '../modules/ActivityTracker';
import { getReviewTerms } from '../utils/reviewTerms';
import GameWorkspace from './GameWorkspace';
import PostGameReview from './PostGameReview';
import NotificationBanner from './NotificationBanner';
import Preloader from '../assets/svg/Preloader';
import useNotifications from '../hooks/useNotifications';
import '../css/publicPlay.css';

const PublicPlayPage = () => {
    const { shareId } = useParams();
    const { notifications, notifyError, dismissNotification } = useNotifications();

    const [phase, setPhase] = useState('loading');
    const [puzzle, setPuzzle] = useState(null);
    const [studentName, setStudentName] = useState('');
    const [result, setResult] = useState(null);
    const [submitFailed, setSubmitFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const trackerRef = useRef(null);
    if (!trackerRef.current) trackerRef.current = new ActivityTracker();
    const submittedRef = useRef(false);
    const pendingSubmissionRef = useRef(null);
    const activeShareIdRef = useRef(shareId);

    useEffect(() => { activeShareIdRef.current = shareId; }, [shareId]);

    useEffect(() => {
        let canceled = false;
        const loadPuzzle = async () => {
            setPhase('loading');
            try {
                const loaded = await getPublicPuzzle(shareId);
                if (canceled) return;
                setPuzzle(loaded);
                setPhase('name');
            } catch (error) {
                if (canceled) return;
                notifyError(error.message || 'Не удалось загрузить игру.');
                setPhase('error');
            }
        };

        loadPuzzle();
        return () => { canceled = true; };
    }, [shareId, notifyError, reloadKey]);

    useEffect(() => () => trackerRef.current.stopTracking(), []);

    const handleStart = () => {
        const name = studentName.trim();
        if (!name) {
            notifyError('Введите ваше имя, чтобы начать решение.');
            return;
        }

        submittedRef.current = false;
        setSubmitFailed(false);
        pendingSubmissionRef.current = null;
        trackerRef.current.reset();
        trackerRef.current.startTracking();
        setResult(null);
        setPhase('playing');
    };

    const handleAttempt = useCallback((isCorrect, word) => {
        trackerRef.current.recordAttempt(isCorrect, word);
    }, []);

    const handleComplete = useCallback(async () => {
        if (submittedRef.current) return;
        submittedRef.current = true;

        const stats = trackerRef.current.stopTracking() || trackerRef.current.getStats();
        const attempts = stats?.attempts || 0;
        const score = attempts > 0
            ? Math.max(0, Math.min(100, Math.round(parseFloat(stats.accuracy) || 0)))
            : 0;
        const durationSec = stats?.duration || 0;
        const finalName = studentName.trim();
        const wrongWords = stats?.wrongWords || [];
        const hintedWords = stats?.hintedWords || [];

        const submission = {
            student_name: finalName,
            score,
            duration_sec: durationSec,
            wrong_words: wrongWords,
        };
        pendingSubmissionRef.current = submission;
        setSubmitFailed(false);
        try {
            await submitAttempt(shareId, submission);
            if (activeShareIdRef.current === shareId) pendingSubmissionRef.current = null;
        } catch (error) {
            if (activeShareIdRef.current !== shareId) return;
            setSubmitFailed(true);
            notifyError(error.message || 'Не удалось сохранить результат.');
        }

        // Пока запрос шёл, пользователь мог открыть другой пазл.
        if (activeShareIdRef.current !== shareId) return;

        setResult({
            studentName: finalName,
            score,
            durationSec,
            accuracy: score,
            attempts,
            wrongWords,
            hintedWords,
        });
        setPhase('complete');
    }, [notifyError, shareId, studentName]);

    const retrySubmit = useCallback(async () => {
        const submission = pendingSubmissionRef.current;
        if (!submission) return;
        try {
            await submitAttempt(shareId, submission);
            pendingSubmissionRef.current = null;
            setSubmitFailed(false);
        } catch (error) {
            notifyError(error.message || 'Не удалось сохранить результат.');
        }
    }, [notifyError, shareId]);

    const gameData = puzzle?.game_data
        ? { ...puzzle.game_data, gameType: puzzle.game_type || puzzle.game_data.gameType }
        : null;

    const handleDownloadPdf = async () => {
        if (!gameData) return;
        try {
            await downloadGamePdf({
                gameData,
                gameName: puzzle?.name || '',
                shareId,
                fileName: puzzle?.name || 'game',
            });
        } catch (error) {
            notifyError(error.message || 'Не удалось скачать PDF.');
        }
    };

    const handleRestart = () => {
        trackerRef.current.stopTracking();
        setPhase('name');
        setStudentName('');
        setResult(null);
        setReloadKey((key) => key + 1);
    };

    return (
        <>
            <Helmet>
                <title>{puzzle?.name ? `${puzzle.name} — CONUNDRUM` : 'Игра — CONUNDRUM'}</title>
            </Helmet>

            <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

            <main className='public-play-main'>
                <div className='background-video-main red' />
                <div className='ellipse-bg red' />

                <section className='public-play-card glass-surface'>
                    {phase === 'loading' && (
                        <div className='preloader-overlay'><Preloader /></div>
                    )}

                    {phase === 'error' && (
                        <div className='public-play-step'>
                            <h1>Игра недоступна</h1>
                            <p>Проверьте ссылку или попробуйте открыть её ещё раз.</p>
                            <button
                                type='button'
                                className='public-play-button'
                                onClick={() => setReloadKey((key) => key + 1)}
                            >
                                Попробовать снова
                            </button>
                        </div>
                    )}

                    {phase === 'name' && (
                        <div className='public-play-step'>
                            <h1>{puzzle?.name || 'Головоломка'}</h1>
                            <p className='public-play-subtitle'>Представьтесь, чтобы мы сохранили ваш результат.</p>
                            <label className='public-play-label' htmlFor='student-name'>Ваше имя и класс</label>
                            <input
                                id='student-name'
                                className='public-play-input'
                                type='text'
                                placeholder='Иван П., 8А класс'
                                value={studentName}
                                onChange={(event) => setStudentName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleStart();
                                }}
                            />
                            <button type='button' className='public-play-button' onClick={handleStart}>
                                Начать решение
                            </button>
                        </div>
                    )}

                    {phase === 'playing' && gameData && (
                        <div className='public-play-game'>
                            <h1>{puzzle?.name || 'Головоломка'}</h1>
                            <p className='public-play-subtitle'>Ученик: {studentName.trim()}</p>
                            <GameWorkspace
                                currentGameData={gameData}
                                onAttempt={handleAttempt}
                                onComplete={handleComplete}
                                onHint={(word) => trackerRef.current.recordHint(word)}
                            />
                        </div>
                    )}

                    {phase === 'complete' && result && (
                        <div className='public-play-result'>
                            <PostGameReview
                                stats={{
                                    accuracy: parseFloat(result.accuracy) || 0,
                                    duration: result.durationSec || 0,
                                    attempts: result.attempts || 0,
                                    wrongWords: result.wrongWords || [],
                                    hintedWords: result.hintedWords || [],
                                }}
                                terms={getReviewTerms(gameData)}
                                gameType={gameData?.gameType || ''}
                                studentName={result.studentName}
                                shareId={shareId}
                                isAuthor={false}
                                onDownloadPdf={handleDownloadPdf}
                                onRestart={handleRestart}
                            />
                            {submitFailed && (
                                <div className='public-play-submit-error' role='status'>
                                    <p>Результат не удалось сохранить. Проверьте соединение и попробуйте снова.</p>
                                    <button type='button' className='public-play-button' onClick={retrySubmit}>
                                        Повторить отправку результата
                                    </button>
                                </div>
                            )}
                            <Link className='public-play-home-link' to='/'>На главную</Link>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
};

export default PublicPlayPage;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPublicPuzzle, submitAttempt } from '../services/puzzleService';
import ActivityTracker from '../modules/ActivityTracker';
import GameWorkspace from './GameWorkspace';
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
    const [reloadKey, setReloadKey] = useState(0);

    const trackerRef = useRef(null);
    if (!trackerRef.current) trackerRef.current = new ActivityTracker();
    const wrongWordsRef = useRef([]);
    const submittedRef = useRef(false);

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

        wrongWordsRef.current = [];
        submittedRef.current = false;
        trackerRef.current.reset();
        trackerRef.current.startTracking();
        setResult(null);
        setPhase('playing');
    };

    const handleAttempt = useCallback((isCorrect, word) => {
        trackerRef.current.recordAttempt(isCorrect);
        if (!isCorrect && word && !wrongWordsRef.current.includes(word)) {
            wrongWordsRef.current.push(word);
        }
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
        const wrongWords = [...wrongWordsRef.current];

        try {
            await submitAttempt(shareId, {
                student_name: finalName,
                score,
                duration_sec: durationSec,
                wrong_words: wrongWords,
            });
        } catch (error) {
            notifyError(error.message || 'Не удалось сохранить результат.');
        }

        setResult({ studentName: finalName, score, durationSec });
        setPhase('complete');
    }, [notifyError, shareId, studentName]);

    const gameData = puzzle?.game_data
        ? { ...puzzle.game_data, gameType: puzzle.game_type || puzzle.game_data.gameType }
        : null;

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
                    {phase === 'loading' && <Preloader />}

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
                            />
                        </div>
                    )}

                    {phase === 'complete' && result && (
                        <div className='public-play-step public-play-result'>
                            <h1>Поздравляем, {result.studentName}!</h1>
                            <p>Вы справились с головоломкой.</p>
                            <p className='public-play-score'>Ваш результат: {result.score} из 100</p>
                            <p>Время решения: {result.durationSec} с</p>
                            <Link className='public-play-home-link' to='/'>На главную</Link>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
};

export default PublicPlayPage;

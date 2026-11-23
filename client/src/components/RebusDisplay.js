import React, { useCallback, useRef, useState } from 'react';
import '../css/RebusDisplay.css';

const RebusDisplay = ({ gameData, onAttempt, onComplete }) => {
    const [solvedWords, setSolvedWords] = useState([]);
    const completedRef = useRef(false);
    const rebuses = gameData?.rebuses;

    const handleAttempt = useCallback((isCorrect, word) => {
        onAttempt?.(isCorrect, word);
        if (!isCorrect) return;

        setSolvedWords((prev) => {
            if (prev.includes(word)) return prev;
            const next = [...prev, word];
            if (next.length === rebuses.length && !completedRef.current) {
                completedRef.current = true;
                onComplete?.();
            }
            return next;
        });
    }, [onAttempt, onComplete, rebuses?.length]);

    if (!rebuses) return null;
    return (
        <div className="rebus-game-container">
            <h2>Ребусы</h2>
            <div className="rebuses-list">
                {rebuses.map((rebus, index) => (
                    <RebusCard key={index} rebus={rebus} index={index} onAttempt={handleAttempt} />
                ))}
            </div>
        </div>
    );
};

const RebusCard = ({ rebus, index, onAttempt }) => {
    const [showAnswer, setShowAnswer] = useState(false);
    const [userAnswer, setUserAnswer] = useState('');
    const [status, setStatus] = useState('initial'); // initial, correct, incorrect

    const handleCheck = () => {
        const isCorrect = userAnswer.trim().toLowerCase() === rebus.word.toLowerCase();
        if (onAttempt) onAttempt(isCorrect, rebus.word);

        if (isCorrect) {
            setStatus('correct');
        } else {
            setStatus('incorrect');
            setTimeout(() => setStatus('initial'), 1000);
        }
    };

    return (
        <div className={`rebus-card ${status === 'correct' ? 'solved' : ''}`}>
            <div className="rebus-number">{index + 1}.</div>
            <div className="rebus-content">
                {rebus.parts.map((part, pIdx) => (
                    <div key={pIdx} className="rebus-part">
                        {part.type === 'text' ? (
                            <span className="rebus-text-part">{part.content}</span>
                        ) : (
                            <div className="rebus-image-wrapper">
                                {part.subtract_start > 0 && <div className="commas commas-left">{",".repeat(part.subtract_start)}</div>}
                                <img src={part.imageUrl} alt="rebus part" className="rebus-image" />
                                {part.subtract_end > 0 && <div className="commas commas-right">{",".repeat(part.subtract_end)}</div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="rebus-interaction">
                <input 
                    type="text" 
                    className={`rebus-input ${status}`}
                    placeholder="Ваш ответ"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={status === 'correct' || showAnswer}
                />
                {status !== 'correct' && <button className="btn-check" onClick={handleCheck}>Проверить</button>}
            </div>

            <div className="rebus-answer-section">
                {showAnswer || status === 'correct' ? (
                    <span className="rebus-answer-text">{rebus.word}</span>
                ) : (
                    <button className="btn-show-answer" onClick={() => setShowAnswer(true)}>Показать ответ</button>
                )}
            </div>
        </div>
    );
};

export default RebusDisplay;
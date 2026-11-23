import React, { useId, useMemo, useState } from 'react';
import '../css/postGameReview.css';

const normalizeWord = (value) => String(value ?? '').trim().toUpperCase();

const PostGameReview = ({
    stats = { accuracy: 0, duration: 0, attempts: 0, wrongWords: [], hintedWords: [] },
    terms = [],
    gameType = '',
    studentName = '',
    shareId = '',
    isAuthor = false,
    onDownloadPdf = async () => {},
    onShare = async () => {},
    onRestart = () => {},
}) => {
    const titleId = useId();
    const [flippedCards, setFlippedCards] = useState(() => new Set());
    const [reversed, setReversed] = useState(false);

    const accuracy = Math.round(Number(stats?.accuracy) || 0);
    const duration = Math.round(Number(stats?.duration) || 0);
    const attempts = Math.round(Number(stats?.attempts) || 0);

    const reviewWords = useMemo(() => {
        const result = new Set();
        const collect = (words) => {
            if (!Array.isArray(words)) return;
            words.forEach((word) => {
                const normalized = normalizeWord(word);
                if (normalized) result.add(normalized);
            });
        };
        collect(stats?.wrongWords);
        collect(stats?.hintedWords);
        return result;
    }, [stats?.wrongWords, stats?.hintedWords]);

    const reviewTerms = Array.isArray(terms) ? terms : [];

    const toggleCard = (index) => {
        setFlippedCards((previous) => {
            const next = new Set(previous);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleMode = () => {
        setReversed((previous) => !previous);
        setFlippedCards(new Set());
    };

    return (
        <section
            className='post-game-review glass-surface'
            aria-labelledby={titleId}
            data-game-type={gameType || undefined}
            data-share-id={shareId || undefined}
        >
            <header className='review-header'>
                <h2 id={titleId} className='review-title'>Закрепление материала</h2>
                {studentName && (
                    <>
                        <p className='review-congratulations'>{`Поздравляем, ${studentName}!`}</p>
                        <p className='review-score'>{`Ваш результат: ${accuracy} из 100`}</p>
                    </>
                )}
            </header>

            <ul className='review-stats' aria-label='Результаты игры'>
                <li className='review-stat'>{`Точность: ${accuracy}%`}</li>
                <li className='review-stat'>{`Время: ${duration} с`}</li>
                <li className='review-stat'>{`Попыток: ${attempts}`}</li>
            </ul>

            <div className='review-section'>
                <div className='review-section-header'>
                    <h3 className='review-section-title'>Карточки для повторения</h3>
                    <button
                        type='button'
                        className='review-mode-toggle'
                        aria-pressed={reversed}
                        onClick={toggleMode}
                    >
                        {reversed
                            ? 'Показать: Определение → Слово'
                            : 'Показать: Слово → Определение'}
                    </button>
                </div>

                <div className='review-flashcards'>
                    {reviewTerms.map((term, index) => {
                        const word = String(term?.word ?? '').trim();
                        if (!word) return null;

                        const clue = String(term?.clue ?? '').trim();
                        const isFlipped = flippedCards.has(index);
                        const needsReview = reviewWords.has(normalizeWord(word));
                        const frontText = reversed ? (clue || word) : word;
                        const backText = reversed ? word : (clue || 'Определение не указано');

                        return (
                            <article
                                key={`${normalizeWord(word)}-${index}`}
                                className={`review-flashcard${needsReview ? ' needs-review' : ''}`}
                                data-flipped={isFlipped}
                            >
                                <button
                                    type='button'
                                    className='review-flashcard-button'
                                    aria-pressed={isFlipped}
                                    onClick={() => toggleCard(index)}
                                >
                                    <span className='review-flashcard-inner'>
                                        <span className='review-flashcard-face review-flashcard-front'>
                                            {isFlipped ? '' : frontText}
                                        </span>
                                        <span className='review-flashcard-face review-flashcard-back'>
                                            {isFlipped ? backText : ''}
                                        </span>
                                    </span>
                                </button>
                                {needsReview && <span className='review-badge'>Стоит повторить</span>}
                            </article>
                        );
                    })}
                </div>
            </div>

            <footer className='review-actions'>
                <button
                    type='button'
                    className='review-action review-download'
                    onClick={() => onDownloadPdf?.()}
                >
                    Скачать PDF (Задание + Ответы)
                </button>
                {isAuthor && (
                    <button
                        type='button'
                        className='review-action review-share'
                        onClick={() => onShare?.()}
                    >
                        Поделиться с классом
                    </button>
                )}
                <button
                    type='button'
                    className='review-action review-restart'
                    onClick={() => onRestart?.()}
                >
                    Сыграть ещё раз
                </button>
            </footer>
        </section>
    );
};

export default PostGameReview;

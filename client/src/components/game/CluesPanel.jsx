import React, { useState } from 'react';
import ShowAnswerIcon from '../../assets/svg/ShowAnswerIcon';
import '../../css/crossword.css';

const getAnswer = (item) => item?.word ?? item?.answer ?? '';
const getItemKey = (item, index) =>
    typeof item?.originalArrayIndex === 'number' ? item.originalArrayIndex : index;

const CluesPanel = ({
    gameType = 'crossword',
    words = [],
    editableWords,
    isEditing = false,
    foundWords = [],
    onItemChange,
    onShowAnswer,
    onRevealLetter,
}) => {
    const [shownAnswers, setShownAnswers] = useState({});
    const sourceWords = isEditing && editableWords ? editableWords : words;
    const found = new Set(foundWords);

    const toggleAnswer = (item) => {
        const answer = getAnswer(item);
        setShownAnswers((prev) => ({ ...prev, [answer]: !prev[answer] }));
        onShowAnswer?.(answer, item);
    };

    const renderItem = (item, index) => {
        const answer = getAnswer(item);
        const itemKey = getItemKey(item, index);
        const isFound = found.has(answer);

        if (isEditing) {
            return (
                <li className='word-item' key={`${itemKey}-${index}`}>
                    <span className='clue-position'>{item.position || index + 1}. </span>
                    <textarea
                        className='editable-clue-textarea'
                        value={item.clue || ''}
                        rows={2}
                        aria-label={`Подсказка ${index + 1}`}
                        onChange={(event) => onItemChange?.(itemKey, 'clue', event.target.value)}
                    />
                    <textarea
                        className='editable-word-input'
                        value={answer}
                        rows={1}
                        aria-label={`Ответ ${index + 1}`}
                        onChange={(event) => onItemChange?.(itemKey, 'word', event.target.value)}
                    />
                </li>
            );
        }

        return (
            <li
                className={`word-item ${isFound ? 'found' : ''}`.trim()}
                key={`${answer}-${index}`}
                data-word={answer}
                data-clean-word={String(answer).replace(/\s+/g, '')}
            >
                <span className='clue-position'>{item.position || index + 1}. </span>
                <span className='clue-text-content'>{item.clue}</span>
                <button
                    type='button'
                    className='show-answer-button'
                    title='Показать ответ'
                    aria-label={`Показать ответ: ${answer}`}
                    aria-expanded={!!shownAnswers[answer]}
                    onClick={() => toggleAnswer(item)}
                >
                    {shownAnswers[answer]
                        ? <span className='shown-answer-text'>{answer}</span>
                        : <ShowAnswerIcon />}
                </button>
                {gameType === 'crossword' && (
                    <button
                        type='button'
                        className='show-answer-button reveal-letter-button'
                        title='Открыть 1 букву'
                        aria-label={`Открыть 1 букву слова ${answer}`}
                        onClick={() => onRevealLetter?.(answer, item)}
                    >
                        1 буква
                    </button>
                )}
            </li>
        );
    };

    const renderSection = (title, items) => (
        <div className='clues-section' key={title}>
            <h3>{title}</h3>
            <ul className='word-list'>
                {items.map(renderItem)}
            </ul>
        </div>
    );

    if (gameType === 'crossword') {
        const sorted = [...sourceWords].sort((a, b) => (a.position || 0) - (b.position || 0));
        const across = sorted.filter((item) => item.orientation === 'across');
        const down = sorted.filter((item) => item.orientation === 'down');
        return (
            <>
                {renderSection(isEditing ? 'По горизонтали (редактирование)' : 'По горизонтали', across)}
                {renderSection(isEditing ? 'По вертикали (редактирование)' : 'По вертикали', down)}
            </>
        );
    }

    const wordList = sourceWords.map((item, index) => ({
        ...item,
        position: item.position || index + 1,
    }));
    return renderSection(
        isEditing ? 'Слова в филворде (редактирование)' : 'Слова в филворде',
        wordList
    );
};

export default CluesPanel;

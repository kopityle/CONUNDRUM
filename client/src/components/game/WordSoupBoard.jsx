import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../css/crossword.css';

const cellKey = (row, col) => `${row}-${col}`;

const getDirection = (from, to) => {
    const rowDiff = to.row - from.row;
    const colDiff = to.col - from.col;

    if (rowDiff === 0 && Math.abs(colDiff) === 1) {
        return { rowStep: 0, colStep: Math.sign(colDiff) };
    }
    if (colDiff === 0 && Math.abs(rowDiff) === 1) {
        return { rowStep: Math.sign(rowDiff), colStep: 0 };
    }
    if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) {
        return { rowStep: Math.sign(rowDiff), colStep: Math.sign(colDiff) };
    }
    return null;
};

const WordSoupBoard = ({ grid = [], words = [], onAttempt, onComplete, onWordFound }) => {
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [foundKeys, setFoundKeys] = useState({});
    const [incorrectKeys, setIncorrectKeys] = useState({});
    const [victory, setVictory] = useState(false);

    const selectionRef = useRef([]);
    const isSelectingRef = useRef(false);
    const directionRef = useRef(null);
    const foundWordsRef = useRef(new Set());
    const completedRef = useRef(false);
    const timeoutRef = useRef([]);

    const expectedWords = useMemo(
        () => words.map((word) => ({
            ...word,
            clean: String(word.word || '').toUpperCase().replace(/\s+/g, ''),
        })),
        [words]
    );

    const reset = useCallback(() => {
        selectionRef.current = [];
        isSelectingRef.current = false;
        directionRef.current = null;
        foundWordsRef.current = new Set();
        completedRef.current = false;
        setSelectedKeys([]);
        setFoundKeys({});
        setIncorrectKeys({});
        setVictory(false);
        document.body.style.overflow = '';
        timeoutRef.current.forEach(clearTimeout);
        timeoutRef.current = [];
    }, []);

    useEffect(() => {
        reset();
        return () => {
            document.body.style.overflow = '';
            timeoutRef.current.forEach(clearTimeout);
        };
    }, [grid, words, reset]);

    const startSelection = useCallback((cell) => {
        isSelectingRef.current = true;
        selectionRef.current = [cell];
        directionRef.current = null;
        setSelectedKeys([cell.key]);
        document.body.style.overflow = 'hidden';
    }, []);

    const continueSelection = useCallback((cell) => {
        if (!isSelectingRef.current) return;

        const selected = selectionRef.current;
        const index = selected.findIndex((item) => item.key === cell.key);

        if (index !== -1) {
            if (index < selected.length - 1) {
                const removed = selected.splice(index + 1);
                setSelectedKeys(selected.map((item) => item.key));
                setIncorrectKeys((prev) => {
                    const next = { ...prev };
                    removed.forEach((item) => { delete next[item.key]; });
                    return next;
                });
                if (selected.length === 1) directionRef.current = null;
            }
            return;
        }

        const last = selected[selected.length - 1];
        if (!last) return;

        if (selected.length === 1) {
            directionRef.current = getDirection(last, cell);
        } else if (directionRef.current) {
            const expected = {
                row: last.row + directionRef.current.rowStep,
                col: last.col + directionRef.current.colStep,
            };
            if (expected.row !== cell.row || expected.col !== cell.col) return;
        }

        if (!directionRef.current) return;

        selected.push(cell);
        setSelectedKeys(selected.map((item) => item.key));
    }, []);

    const endSelection = useCallback(() => {
        if (!isSelectingRef.current || selectionRef.current.length === 0) {
            isSelectingRef.current = false;
            selectionRef.current = [];
            document.body.style.overflow = '';
            return;
        }

        const selected = selectionRef.current;
        const selectedWord = selected.map((cell) => cell.letter).join('').toUpperCase();
        const reversedWord = selectedWord.split('').reverse().join('');
        const foundWord = expectedWords.find((word) =>
            word.clean === selectedWord || word.clean === reversedWord
        );

        let isCorrectAttempt = false;

        if (foundWord && !foundWordsRef.current.has(foundWord.word)) {
            isCorrectAttempt = true;
            foundWordsRef.current.add(foundWord.word);
            setFoundKeys((prev) => {
                const next = { ...prev };
                selected.forEach((cell) => { next[cell.key] = true; });
                return next;
            });
            onWordFound?.(foundWord.word);

            if (foundWordsRef.current.size === expectedWords.length && expectedWords.length > 0) {
                if (!completedRef.current) {
                    completedRef.current = true;
                    onComplete?.();
                    const timeout = setTimeout(() => setVictory(true), 100);
                    timeoutRef.current.push(timeout);
                }
            }
        } else {
            setIncorrectKeys((prev) => {
                const next = { ...prev };
                selected.forEach((cell) => {
                    if (!foundKeys[cell.key]) next[cell.key] = true;
                });
                return next;
            });
            const timeout = setTimeout(() => {
                setIncorrectKeys((prev) => {
                    const next = { ...prev };
                    selected.forEach((cell) => { delete next[cell.key]; });
                    return next;
                });
            }, 500);
            timeoutRef.current.push(timeout);
        }

        onAttempt?.(isCorrectAttempt, foundWord?.word || selectedWord);

        selectionRef.current = [];
        isSelectingRef.current = false;
        directionRef.current = null;
        setSelectedKeys([]);
        document.body.style.overflow = '';
    }, [expectedWords, foundKeys, onAttempt, onComplete, onWordFound]);

    useEffect(() => {
        const handleDocumentTouchMove = (event) => {
            if (!isSelectingRef.current || !event.touches?.length) return;
            const touch = event.touches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element?.classList?.contains('word-soup-cell')) {
                continueSelection({
                    row: Number(element.dataset.row),
                    col: Number(element.dataset.col),
                    key: element.dataset.cellKey,
                    letter: element.dataset.letter,
                });
            }
        };

        document.addEventListener('mouseup', endSelection);
        document.addEventListener('touchend', endSelection);
        document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });

        return () => {
            document.removeEventListener('mouseup', endSelection);
            document.removeEventListener('touchend', endSelection);
            document.removeEventListener('touchmove', handleDocumentTouchMove);
        };
    }, [continueSelection, endSelection]);

    if (victory) {
        return (
            <div className='success-message'>
                <div>
                    <h2>Поздравляем! Вы нашли все слова!</h2>
                    <div className='success-divider'></div>
                </div>
                <div>
                    <p>Иногда важен не результат, который можно положить на полку, а сам процесс.</p>
                    <p>Этот момент вашей победы навсегда останется в памяти...</p>
                    <p>Ну, или хотя бы в хорошем настроении на сегодня! Отличная работа!</p>
                </div>
            </div>
        );
    }

    return (
        <div className='word-soup-container'>
            <table className='word-soup-grid'>
                <tbody>
                    {grid.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                            {row.map((letter, colIndex) => {
                                const key = cellKey(rowIndex, colIndex);
                                const cell = { row: rowIndex, col: colIndex, key, letter: String(letter) };
                                const classes = ['word-soup-cell'];
                                if (selectedKeys.includes(key)) classes.push('selected');
                                if (foundKeys[key]) classes.push('found');
                                if (incorrectKeys[key]) classes.push('incorrect');

                                return (
                                    <td
                                        key={key}
                                        className={classes.join(' ')}
                                        data-row={rowIndex}
                                        data-col={colIndex}
                                        data-cell-key={key}
                                        data-letter={letter}
                                        aria-label={`Буква ${rowIndex + 1}, ${colIndex + 1}: ${letter}`}
                                        onMouseDown={() => startSelection(cell)}
                                        onMouseOver={() => continueSelection(cell)}
                                        onTouchStart={(event) => {
                                            event.preventDefault();
                                            startSelection(cell);
                                        }}
                                        onTouchMove={(event) => {
                                            event.preventDefault();
                                            const touch = event.touches?.[0];
                                            const element = touch
                                                ? document.elementFromPoint(touch.clientX, touch.clientY)
                                                : null;
                                            if (element?.classList?.contains('word-soup-cell')) {
                                                continueSelection({
                                                    row: Number(element.dataset.row),
                                                    col: Number(element.dataset.col),
                                                    key: element.dataset.cellKey,
                                                    letter: element.dataset.letter,
                                                });
                                            }
                                        }}
                                    >
                                        {letter}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default WordSoupBoard;

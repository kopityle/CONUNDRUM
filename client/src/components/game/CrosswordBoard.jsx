import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../css/crossword.css';

const cellKey = (row, col) => `${row}-${col}`;

const getWordText = (word) => String(word?.answer ?? word?.word ?? '');

const getWordCells = (word) => {
    const cells = [];
    const answer = getWordText(word);
    let x = Number(word?.startx) - 1;
    let y = Number(word?.starty) - 1;

    for (let i = 0; i < answer.length; i += 1) {
        cells.push({ row: y, col: x });
        if (word?.orientation === 'across') x += 1;
        else if (word?.orientation === 'down') y += 1;
        else break;
    }
    return cells;
};

const CrosswordBoard = ({ grid = [], words = [], onAttempt, onComplete, hint, onHint }) => {
    const [values, setValues] = useState({});
    const [statuses, setStatuses] = useState({});
    const [completed, setCompleted] = useState(false);
    const inputRefs = useRef({});
    const directionRef = useRef(null);
    const completedRef = useRef(false);
    const lastHintRef = useRef(null);

    const gridSignature = JSON.stringify(grid);
    const wordsSignature = JSON.stringify(words);

    const gridData = useMemo(() => grid, [gridSignature]);
    const wordData = useMemo(() => words, [wordsSignature]);

    const wordCells = useMemo(
        () => wordData.map((word) => ({ word, cells: getWordCells(word) })),
        [wordData]
    );

    const cellClassesByKey = useMemo(() => {
        const result = {};
        gridData.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell === '') return;
                const classes = ['crossword-cell'];
                const relatedWords = wordCells.filter(({ cells }) =>
                    cells.some(({ row, col }) => row === rowIndex && col === colIndex)
                );
                const startingWord = wordData.find((word) =>
                    Number(word.startx) - 1 === colIndex &&
                    Number(word.starty) - 1 === rowIndex &&
                    word.orientation !== 'none'
                );

                relatedWords.forEach(({ word, cells }) => {
                    const index = cells.findIndex(({ row, col }) => row === rowIndex && col === colIndex);
                    if (index === -1) return;
                    const isFirst = index === 0;
                    const isLast = index === cells.length - 1;

                    if (isFirst && word.orientation === 'across') classes.push('first-letter-horizontal');
                    if (isFirst && word.orientation === 'down') classes.push('first-letter-vertical');
                    if (isLast && word.orientation === 'across') classes.push('last-letter-horizontal');
                    if (isLast && word.orientation === 'down') classes.push('last-letter-vertical');
                });

                if (relatedWords.length > 1) classes.push('cross');
                result[cellKey(rowIndex, colIndex)] = { classes, startingWord };
            });
        });
        return result;
    }, [gridData, wordData, wordCells]);

    const findWordForCell = useCallback((row, col) => {
        const preferredOrientation = directionRef.current;
        const candidates = wordCells.filter(({ cells }) =>
            cells.some((cell) => cell.row === row && cell.col === col)
        );
        const preferred = candidates.find(({ word }) => word.orientation === preferredOrientation);
        return (preferred || candidates[0])?.word;
    }, [wordCells]);

    const determineDirection = useCallback((row, col) => {
        const hasRight = col + 1 < (gridData[row]?.length || 0) && gridData[row][col + 1] !== '';
        const hasDown = row + 1 < gridData.length && gridData[row + 1][col] !== '';
        const hasLeft = col > 0 && gridData[row][col - 1] !== '';
        const hasUp = row > 0 && gridData[row - 1][col] !== '';

        const startingWord = wordData.find((word) =>
            Number(word.startx) - 1 === col &&
            Number(word.starty) - 1 === row &&
            word.orientation !== 'none'
        );
        if (startingWord) {
            if (hasDown && !hasRight) return 'down';
            if (hasRight && !hasDown) return 'across';
        }
        if (hasLeft || hasRight) return 'across';
        if (hasUp || hasDown) return 'down';
        return 'across';
    }, [gridData, wordData]);

    const focusCell = useCallback((row, col) => {
        const input = inputRefs.current[cellKey(row, col)];
        if (input) input.focus();
    }, []);

    const focusNextInput = useCallback((row, col) => {
        const direction = directionRef.current || determineDirection(row, col);
        const next = direction === 'down'
            ? { row: row + 1, col }
            : { row, col: col + 1 };

        if (gridData[next.row]?.[next.col] !== undefined && gridData[next.row][next.col] !== '') {
            focusCell(next.row, next.col);
        }
    }, [determineDirection, focusCell, gridData]);

    const checkSolved = useCallback((nextValues) => {
        if (!gridData.length) return false;
        for (let row = 0; row < gridData.length; row += 1) {
            for (let col = 0; col < gridData[row].length; col += 1) {
                const correct = gridData[row][col];
                if (correct === '') continue;
                if ((nextValues[cellKey(row, col)] || '') !== String(correct).toUpperCase()) return false;
            }
        }
        return true;
    }, [gridData]);

    const completeGame = useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        setCompleted(true);
        onComplete?.();
    }, [onComplete]);

    useEffect(() => {
        setValues({});
        setStatuses({});
        setCompleted(false);
        completedRef.current = false;
        directionRef.current = null;
        lastHintRef.current = null;
    }, [gridSignature, wordsSignature]);

    // Внешние подсказки: одна буква или целое слово.
    useEffect(() => {
        if (!hint || !gridData.length) return;
        if (lastHintRef.current === hint) return;
        lastHintRef.current = hint;

        const target = wordCells.find(({ word }) =>
            getWordText(word).toUpperCase() === String(hint.value || '').toUpperCase()
        );
        if (!target) return;
        onHint?.(getWordText(target));

        const keys = hint.type === 'word'
            ? target.cells.map(({ row, col }) => cellKey(row, col))
            : (() => {
                const firstIncorrect = target.cells.find(({ row, col }) => {
                    const key = cellKey(row, col);
                    const correct = String(gridData[row]?.[col] || '').toUpperCase();
                    return (values[key] || '') !== correct;
                }) || target.cells[0];
                return firstIncorrect ? [cellKey(firstIncorrect.row, firstIncorrect.col)] : [];
            })();

        setValues((prev) => {
            const next = { ...prev };
            keys.forEach((key) => {
                const [row, col] = key.split('-').map(Number);
                const letter = gridData[row]?.[col];
                if (letter) next[key] = String(letter).toUpperCase();
            });
            if (checkSolved(next)) completeGame();
            return next;
        });
        setStatuses((prev) => {
            const next = { ...prev };
            keys.forEach((key) => { next[key] = 'valid'; });
            return next;
        });
    }, [hint, gridData, wordCells, values, checkSolved, completeGame, onHint]);

    const handleChange = (row, col, event) => {
        const value = event.target.value.slice(-1).toUpperCase();
        const key = cellKey(row, col);
        const correctLetter = String(gridData[row][col]).toUpperCase();
        const isCorrect = value === correctLetter;

        if (!directionRef.current) directionRef.current = determineDirection(row, col);

        const nextValues = { ...values, [key]: value };
        setValues(nextValues);
        setStatuses((prev) => ({ ...prev, [key]: isCorrect ? 'valid' : 'invalid' }));
        const word = findWordForCell(row, col);
        onAttempt?.(isCorrect, getWordText(word));

        if (isCorrect) {
            focusNextInput(row, col);
            if (checkSolved(nextValues)) completeGame();
        }
    };

    const handleKeyDown = (row, col, event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            focusNextInput(row, col);
            return;
        }
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

        event.preventDefault();
        directionRef.current = ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 'across' : 'down';
        let nextRow = row;
        let nextCol = col;
        if (event.key === 'ArrowRight') nextCol += 1;
        if (event.key === 'ArrowLeft') nextCol -= 1;
        if (event.key === 'ArrowDown') nextRow += 1;
        if (event.key === 'ArrowUp') nextRow -= 1;
        focusCell(nextRow, nextCol);
    };

    if (!gridData.length) return null;

    if (completed) {
        return (
            <div className='success-message'>
                <div>
                    <h2>Поздравляем! Вы успешно решили кроссворд!</h2>
                    <div className='success-divider'></div>
                </div>
                <div>
                    <p>Главный трофей — не сохранённый файл, а новые нейронные связи в вашей голове.</p>
                    <p>Ваша победа — лучший результат. Возвращайтесь за новыми победами!</p>
                    <p>Или помучаем нейронную сеть еще немного, сгенерируем еще одну игру?</p>
                </div>
            </div>
        );
    }

    return (
        <table className='crossword-table'>
            <tbody>
                {gridData.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                        {row.map((cell, colIndex) => {
                            if (cell === '') {
                                return <td key={cellKey(rowIndex, colIndex)} className='black-cell' />;
                            }
                            const key = cellKey(rowIndex, colIndex);
                            const { classes, startingWord } = cellClassesByKey[key];
                            const status = statuses[key];
                            return (
                                <td
                                    key={key}
                                    className={classes.join(' ')}
                                    data-correct-letter={String(cell).toUpperCase()}
                                    style={{
                                        backgroundColor: status === 'valid'
                                            ? '#62E953'
                                            : status === 'invalid'
                                                ? '#ED7E98'
                                                : undefined,
                                    }}
                                >
                                    {startingWord && <span className='word-number'>{startingWord.position}</span>}
                                    <input
                                        ref={(element) => {
                                            if (element) inputRefs.current[key] = element;
                                            else delete inputRefs.current[key];
                                        }}
                                        type='text'
                                        maxLength={1}
                                        className={`crossword-input ${status || ''}`.trim()}
                                        value={values[key] || ''}
                                        onChange={(event) => handleChange(rowIndex, colIndex, event)}
                                        onKeyDown={(event) => handleKeyDown(rowIndex, colIndex, event)}
                                        onClick={() => { directionRef.current = null; }}
                                        aria-label={`Буква ${rowIndex + 1}, ${colIndex + 1}`}
                                    />
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default CrosswordBoard;

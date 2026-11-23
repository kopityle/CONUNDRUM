import React, { useState } from 'react';
import FileChooseIcon from '../assets/svg/FileChooseIcon';
import FileErrorIcon from '../assets/svg/FileErrorIcon';
import FileSuccessIcon from '../assets/svg/FileSuccessIcon';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const PuzzleCreatorForm = ({ isLTI = false, isConfigureMode = false, isLoading = false, onSubmit, onFileError }) => {
    const [puzzleName, setPuzzleName] = useState('');
    const [gameType, setGameType] = useState('crossword');
    const [inputType, setInputType] = useState('topic');
    const [topic, setTopic] = useState('');
    const [text, setText] = useState('');
    const [totalWords, setTotalWords] = useState('');
    const [difficulty, setDifficulty] = useState('normal');
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState(false);

    const changeInputType = (nextType) => {
        setInputType(nextType);
        if (nextType !== 'topic') setTopic('');
        if (nextType !== 'text') setText('');
        if (nextType !== 'file') setFile(null);
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files?.[0] || null;
        setFileError(false);

        if (!selectedFile) {
            setFile(null);
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
            event.target.value = '';
            setFile(null);
            setFileError(true);
            onFileError?.('Файл слишком большой. Максимальный размер: 10 МБ.');
            return;
        }

        setFile(selectedFile);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit?.({
            puzzleName,
            gameType,
            inputType,
            topic,
            text,
            totalWords: Number(totalWords),
            difficulty,
            file,
        });
    };

    return (
        <form id='crossword-form' encType='multipart/form-data' onSubmit={handleSubmit}>
            <input
                className='input-puzzle-name'
                type='text'
                placeholder='НАЗВАНИЕ'
                value={puzzleName}
                onChange={(event) => setPuzzleName(event.target.value)}
                aria-label='Название игры'
                required
            />

            <div className='input-type-of-puzzle'>
                <h2>ВИД ГОЛОВОЛОМКИ</h2>
                <div>
                    <input
                        type='radio'
                        id='crossword'
                        value='crossword'
                        name='gameType'
                        checked={gameType === 'crossword'}
                        onChange={() => setGameType('crossword')}
                    />
                    <label htmlFor='crossword'>Кроссворд</label>
                </div>
                <div>
                    <input
                        type='radio'
                        id='fillword'
                        value='wordsoup'
                        name='gameType'
                        checked={gameType === 'wordsoup'}
                        onChange={() => setGameType('wordsoup')}
                    />
                    <label htmlFor='fillword'>Филворд</label>
                </div>
                <div>
                    <input
                        type='radio'
                        id='rebus'
                        value='rebus'
                        name='gameType'
                        checked={gameType === 'rebus'}
                        onChange={() => setGameType('rebus')}
                    />
                    <label htmlFor='rebus'>Ребусы</label>
                </div>
            </div>

            <div className='input-interaction-format'>
                <h2>ФОРМАТ ВВОДА</h2>
                <div>
                    <input
                        type='radio'
                        id='set-topic'
                        value='topic'
                        name='inputType'
                        checked={inputType === 'topic'}
                        onChange={() => changeInputType('topic')}
                    />
                    <label htmlFor='set-topic'>Задать тему</label>
                    <div className='topic-input'>
                        <input
                            type='text'
                            id='topic'
                            name='topic'
                            placeholder='Например: Фрукты'
                            style={{ display: inputType === 'topic' ? 'block' : 'none' }}
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            aria-label='Тема'
                        />
                    </div>
                </div>
                <div>
                    <input
                        type='radio'
                        id='set-text'
                        value='text'
                        name='inputType'
                        checked={inputType === 'text'}
                        onChange={() => changeInputType('text')}
                    />
                    <label htmlFor='set-text'>Задать текст</label>
                    <div className='text-input'>
                        <textarea
                            className='text-input-textarea'
                            id='document'
                            name='text'
                            placeholder='Например: Однажды весною, в час небывало жаркого заката...'
                            style={{ display: inputType === 'text' ? 'block' : 'none' }}
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            aria-label='Текст'
                        />
                    </div>
                </div>
                <div>
                    <input
                        type='radio'
                        id='upload-file'
                        value='file'
                        name='inputType'
                        checked={inputType === 'file'}
                        onChange={() => changeInputType('file')}
                    />
                    <label htmlFor='upload-file'>Загрузить файл</label>
                    <div
                        className='file-input'
                        id='file-input-div'
                        style={{ display: inputType === 'file' ? 'flex' : 'none' }}
                    >
                        <input
                            type='file'
                            className='file-input-area'
                            id='file-upload'
                            name='file-upload'
                            onChange={handleFileChange}
                            aria-label='Файл'
                        />
                        <label htmlFor='file-upload' className='file-input-label'>
                            {fileError && (
                                <div className='file-load-indicator error'>
                                    <FileErrorIcon />
                                    Ошибка загрузки
                                </div>
                            )}
                            {!fileError && file && (
                                <div className='file-load-indicator success'>
                                    <FileSuccessIcon />
                                    Файл загружен
                                </div>
                            )}
                            {!fileError && !file && (
                                <div className='file-load-indicator choosing'>
                                    <FileChooseIcon />
                                    Выберите файл
                                </div>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            <div className='input-difficulty-of-game'>
                <h2>СЛОЖНОСТЬ</h2>
                {[
                    { id: 'easy', value: 'easy', label: 'Легко' },
                    { id: 'normal', value: 'normal', label: 'Нормально' },
                    { id: 'hard', value: 'hard', label: 'Сложно' },
                ].map((option) => (
                    <div key={option.id}>
                        <input
                            type='radio'
                            id={option.id}
                            value={option.value}
                            name='difficulty'
                            checked={difficulty === option.value}
                            onChange={() => setDifficulty(option.value)}
                        />
                        <label htmlFor={option.id}>{option.label}</label>
                    </div>
                ))}
            </div>

            <div className='input-puzzle-size'>
                <h2>КОЛИЧЕСТВО СЛОВ</h2>
                <input
                    type='number'
                    id='total-words'
                    name='totalWords'
                    min='5'
                    max='20'
                    step='1'
                    value={totalWords}
                    onChange={(event) => setTotalWords(event.target.value)}
                    aria-label='Количество слов'
                    required
                />
            </div>

            <button type='submit' className='generate-puzzle-button' disabled={isLoading}>
                {isLTI && isConfigureMode ? 'Сохранить конфигурацию' : 'Сгенерировать'}
            </button>
        </form>
    );
};

export default PuzzleCreatorForm;

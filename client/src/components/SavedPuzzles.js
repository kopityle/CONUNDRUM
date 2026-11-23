import { useEffect, useMemo, useState } from 'react';
import '../css/saved-puzzles.css';
import { useNavigate } from 'react-router-dom';
import {
    getUserPuzzlesFromSupabase,
    updatePuzzleTags,
    deletePuzzleFromSupabase,
} from '../services/puzzleService';
import Preloader from '../assets/svg/Preloader';
import PuzzleIcon from '../assets/svg/PuzzleIcon';
import GameTypeIcon from '../assets/svg/GameTypeIcon';
import WordsCountIcon from '../assets/svg/WordsCountIcon';
import NotificationBanner from './NotificationBanner';
import useNotifications from '../hooks/useNotifications';

const gameType = {
    crossword: 'Кроссворд',
    wordsoup: 'Филворд',
    rebus: 'Ребусы',
};

const SavedPuzzles = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [userTags, setTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [editingPuzzleIndex, setEditingPuzzleIndex] = useState(null);
    const [newTag, setNewTag] = useState('');
    const [puzzlesData, setPuzzlesData] = useState([]);
    const [puzzleToDelete, setPuzzleToDelete] = useState(null);
    const navigate = useNavigate();
    const { notifications, notifyError, dismissNotification } = useNotifications();

    useEffect(() => {
        const fetchPuzzles = async () => {
            try {
                setIsLoading(true);
                const userPuzzles = await getUserPuzzlesFromSupabase();
                const normalizedPuzzles = userPuzzles.map((puzzle) => ({
                    ...puzzle,
                    tags: puzzle.tags || [],
                }));
                setPuzzlesData(normalizedPuzzles);
                setTags([...new Set(normalizedPuzzles.flatMap((puzzle) => puzzle.tags))].sort());
            } catch (error) {
                notifyError(error.message || 'Не удалось загрузить список ваших игр.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchPuzzles();
    }, [notifyError]);

    const handleLoadPuzzle = (puzzleId) => {
        navigate(`/gamegenerator?load_puzzle_id=${puzzleId}`);
    };

    const updateUniqueTags = (puzzles) => {
        setTags([...new Set(puzzles.flatMap((puzzle) => puzzle.tags || []))].sort());
    };

    const filteredTags = useMemo(
        () => [...userTags].sort().filter((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [userTags, searchTerm]
    );

    const filteredPuzzles = selectedTags.length > 0
        ? puzzlesData.filter((puzzle) =>
            selectedTags.every((selectedTag) => puzzle.tags.includes(selectedTag))
        )
        : puzzlesData;

    const toggleTagSelection = (tag) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
        );
    };

    const replacePuzzleTags = (puzzleId, updatedTags) => {
        setPuzzlesData((prev) => prev.map((puzzle) =>
            puzzle.id === puzzleId ? { ...puzzle, tags: updatedTags } : puzzle
        ));
        updateUniqueTags(puzzlesData.map((puzzle) =>
            puzzle.id === puzzleId ? { ...puzzle, tags: updatedTags } : puzzle
        ));
    };

    const removeTag = async (puzzleId, tagIndex) => {
        try {
            const puzzle = puzzlesData.find((item) => item.id === puzzleId);
            const updatedTags = [...puzzle.tags];
            updatedTags.splice(tagIndex, 1);
            replacePuzzleTags(puzzleId, updatedTags);
            await updatePuzzleTags(puzzleId, updatedTags);
        } catch (error) {
            notifyError('Не удалось удалить тег');
        }
    };

    const startAddingTag = (puzzleIndex) => {
        setEditingPuzzleIndex(puzzleIndex);
        setNewTag('');
    };

    const saveNewTag = async (puzzleId) => {
        const tag = newTag.trim();
        if (!tag || tag.length < 3 || tag.length > 15) {
            notifyError('Тег должен содержать от 3 до 15 символов');
            return;
        }

        const puzzle = puzzlesData.find((item) => item.id === puzzleId);
        if (puzzle.tags.includes(tag)) {
            notifyError('Этот тег уже добавлен');
            return;
        }

        try {
            const updatedTags = [...puzzle.tags, tag];
            replacePuzzleTags(puzzleId, updatedTags);
            setEditingPuzzleIndex(null);
            setNewTag('');
            await updatePuzzleTags(puzzleId, updatedTags);
        } catch (error) {
            notifyError('Не удалось добавить тег');
        }
    };

    const handleKeyDown = (event, puzzleId) => {
        if (event.key === 'Enter') saveNewTag(puzzleId);
    };

    const confirmDeletePuzzle = async () => {
        if (!puzzleToDelete) return;
        try {
            await deletePuzzleFromSupabase(puzzleToDelete.id);
            const nextPuzzles = puzzlesData.filter((puzzle) => puzzle.id !== puzzleToDelete.id);
            setPuzzlesData(nextPuzzles);
            updateUniqueTags(nextPuzzles);
            setPuzzleToDelete(null);
        } catch (error) {
            notifyError('Не удалось удалить головоломку');
        }
    };

    return (
        <section className='about-account-info user-saved-games-and-tags'>
            <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

            {puzzleToDelete && (
                <div className='delete-confirmation' role='dialog' aria-modal='true' aria-label='Подтверждение удаления'>
                    <div className='delete-confirmation-content glass-surface'>
                        <p>Вы уверены, что хотите удалить "{puzzleToDelete.name}"?</p>
                        <div className='delete-confirmation-buttons'>
                            <button type='button' onClick={() => setPuzzleToDelete(null)}>Отмена</button>
                            <button type='button' onClick={confirmDeletePuzzle}>Удалить</button>
                        </div>
                    </div>
                </div>
            )}

            <div className='profile-title'>
                <h1>Сохраненные головоломки</h1>
                <div className='horizontal-line'></div>
            </div>
            <div className='saved-games-and-tags'>
                <section className='user-saved-games'>
                    {isLoading
                        ? <Preloader />
                        : (
                            <ul className='saved-games-list'>
                                {filteredPuzzles.map((puzzle, puzzleIndex) => (
                                    <li key={puzzle.id} className='saved-games-item'>
                                        <span
                                            className='puzzle-delete-button'
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setPuzzleToDelete(puzzle);
                                            }}
                                            role='button'
                                            tabIndex={0}
                                            title='Удалить головоломку'
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') setPuzzleToDelete(puzzle);
                                            }}
                                        >
                                            ×
                                        </span>
                                        <div className='saved-game-info' onClick={() => handleLoadPuzzle(puzzle.id)}>
                                            <div>
                                                <PuzzleIcon />
                                                <p>{puzzle.name}</p>
                                            </div>
                                            <div>
                                                <GameTypeIcon />
                                                <p>{gameType[puzzle.game_type]}</p>
                                            </div>
                                            <div>
                                                <WordsCountIcon />
                                                <p>
                                                    {puzzle.game_data.words?.length || puzzle.game_data.rebuses?.length || 0} слов
                                                </p>
                                            </div>
                                        </div>
                                        <div className='horizontal-line'></div>
                                        <ul className='saved-games-tags'>
                                            {puzzle.tags.map((tag, tagIndex) => (
                                                <li key={`${puzzle.id}-${tag}`} className='games-tag-item'>
                                                    &#9733; {tag}
                                                    <span
                                                        className='tag-remove'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            removeTag(puzzle.id, tagIndex);
                                                        }}
                                                    >
                                                        ×
                                                    </span>
                                                </li>
                                            ))}
                                            {editingPuzzleIndex === puzzleIndex ? (
                                                <li className='tag-input-container'>
                                                    &#9733;
                                                    <input
                                                        minLength={3}
                                                        maxLength={15}
                                                        type='text'
                                                        className='new-tag-input'
                                                        value={newTag}
                                                        onChange={(event) => setNewTag(event.target.value)}
                                                        onKeyDown={(event) => handleKeyDown(event, puzzle.id)}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type='button'
                                                        className='tag-save-button'
                                                        onClick={() => saveNewTag(puzzle.id)}
                                                    >
                                                        ✓
                                                    </button>
                                                </li>
                                            ) : (
                                                puzzle.tags.length < 3 &&
                                                <li className='add-new-tag-button' onClick={() => startAddingTag(puzzleIndex)}>
                                                    +
                                                </li>
                                            )}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                </section>
                <section className='user-tags'>
                    <div className='user-tags-content'>
                        <h2>Поиск по тегам</h2>
                        <input
                            type='text'
                            minLength={2}
                            maxLength={10}
                            className='search-tags-input'
                            placeholder='Введите тег...'
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                        <ul className='user-tags-list'>
                            {filteredTags.length > 0
                                ? filteredTags.map((tag) => (
                                    <li
                                        key={tag}
                                        className={`user-tags-item ${selectedTags.includes(tag) ? 'selected' : ''}`}
                                        onClick={() => toggleTagSelection(tag)}
                                    >
                                        &#9733; {tag}
                                    </li>
                                ))
                                : <li className='user-tags-item'>Тегов не найдено...</li>}
                        </ul>
                    </div>
                </section>
            </div>
        </section>
    );
};

export default SavedPuzzles;

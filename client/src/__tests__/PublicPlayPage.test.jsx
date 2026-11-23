import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import PublicPlayPage from '../components/PublicPlayPage';
import { getPublicPuzzle, submitAttempt } from '../services/puzzleService';

vi.mock('../services/puzzleService', () => ({
    getPublicPuzzle: vi.fn(),
    submitAttempt: vi.fn(),
}));

vi.mock('../components/GameWorkspace', () => ({
    default: ({ currentGameData, onAttempt, onComplete, onHint }) => (
        <div data-testid='mock-workspace'>
            <span>{currentGameData?.gameType}</span>
            <button type='button' onClick={() => onAttempt(false, 'CODE')}>Wrong attempt</button>
            <button type='button' onClick={() => onAttempt(true, 'TEST')}>Correct attempt</button>
            <button type='button' onClick={() => onHint?.('TEST')}>Hint</button>
            <button type='button' onClick={() => onComplete()}>Complete game</button>
        </div>
    ),
}));

const publicPuzzle = {
    id: 5,
    share_id: 'share-abc',
    name: 'Математический кроссворд',
    game_type: 'crossword',
    game_data: { words: [{ word: 'TEST', clue: 'clue' }], grid: [[]] },
};

const renderPage = () => render(
    <HelmetProvider>
        <MemoryRouter initialEntries={['/play/share-abc']}>
            <Routes>
                <Route path='/play/:shareId' element={<PublicPlayPage />} />
            </Routes>
        </MemoryRouter>
    </HelmetProvider>
);

const startGame = async () => {
    fireEvent.change(await screen.findByPlaceholderText('Иван П., 8А класс'), {
        target: { value: 'Иван' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Начать решение' }));
    return screen.findByTestId('mock-workspace');
};

describe('PublicPlayPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPublicPuzzle.mockResolvedValue(publicPuzzle);
        submitAttempt.mockResolvedValue({ id: 1 });
    });

    test('loads the shared puzzle and asks for a student name before starting', async () => {
        renderPage();

        expect(await screen.findByText('Математический кроссворд')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Иван П., 8А класс')).toBeInTheDocument();
        expect(getPublicPuzzle).toHaveBeenCalledWith('share-abc');
        expect(screen.queryByTestId('mock-workspace')).not.toBeInTheDocument();

        const workspace = await startGame();
        expect(workspace).toHaveTextContent('crossword');
    });

    test('requires a name before starting the game', async () => {
        renderPage();
        await screen.findByText('Математический кроссворд');

        fireEvent.click(screen.getByRole('button', { name: 'Начать решение' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Введите ваше имя');
        expect(screen.queryByTestId('mock-workspace')).not.toBeInTheDocument();
    });

    test('submits one attempt with score, duration and wrong words, then congratulates', async () => {
        renderPage();
        await startGame();

        fireEvent.click(screen.getByRole('button', { name: 'Wrong attempt' }));
        fireEvent.click(screen.getByRole('button', { name: 'Correct attempt' }));
        fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
        fireEvent.click(screen.getByRole('button', { name: 'Complete game' }));
        fireEvent.click(screen.getByRole('button', { name: 'Complete game' }));

        await waitFor(() => {
            expect(submitAttempt).toHaveBeenCalledTimes(1);
        });
        expect(submitAttempt).toHaveBeenCalledWith('share-abc', {
            student_name: 'Иван',
            score: 50,
            duration_sec: expect.any(Number),
            wrong_words: ['CODE'],
        });
        expect(await screen.findByText('Поздравляем, Иван!')).toBeInTheDocument();
        expect(screen.getByText('Ваш результат: 50 из 100')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Закрепление материала' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'TEST' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Стоит повторить')).toBeInTheDocument();
    });

    test('shows an error state when the share link is invalid', async () => {
        getPublicPuzzle.mockRejectedValueOnce(new Error('Пазл не найден'));
        renderPage();

        expect(await screen.findByText('Игра недоступна')).toBeInTheDocument();
        expect(await screen.findByRole('alert')).toHaveTextContent('Пазл не найден');
    });
});

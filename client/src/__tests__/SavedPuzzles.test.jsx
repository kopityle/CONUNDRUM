import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import SavedPuzzles from '../components/SavedPuzzles';
import {
    getPuzzles,
    deletePuzzle,
    updatePuzzle,
    getPuzzleAnalytics,
} from '../services/puzzleService';

vi.mock('../services/puzzleService', () => ({
    getPuzzles: vi.fn(),
    deletePuzzle: vi.fn(),
    updatePuzzle: vi.fn(),
    getPuzzleAnalytics: vi.fn(),
}));

const puzzles = [
    {
        id: 'p1',
        name: 'Puzzle A',
        share_id: 'share-1',
        game_type: 'crossword',
        tags: ['school'],
        game_data: { words: [{ word: 'TEST' }, { word: 'CODE' }] },
    },
    {
        id: 'p2',
        name: 'Puzzle B',
        share_id: 'share-2',
        game_type: 'rebus',
        tags: ['logic'],
        game_data: { rebuses: [{ word: 'ТЕСТ' }] },
    },
];

const analytics = {
    attemptCount: 3,
    averageScore: 82.5,
    uniqueStudents: 2,
    attempts: [],
    difficultWords: [{ word: 'CODE', count: 2 }],
};

const renderSavedPuzzles = () => render(
    <MemoryRouter>
        <SavedPuzzles />
    </MemoryRouter>
);

describe('SavedPuzzles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPuzzles.mockResolvedValue(puzzles);
        deletePuzzle.mockResolvedValue({ success: true });
        updatePuzzle.mockResolvedValue({});
        getPuzzleAnalytics.mockResolvedValue(analytics);
    });

    test('renders saved puzzles with stable keys and translated game types', async () => {
        renderSavedPuzzles();

        expect(await screen.findByText('Puzzle A')).toBeInTheDocument();
        expect(screen.getByText('Puzzle B')).toBeInTheDocument();
        expect(screen.getByText('Кроссворд')).toBeInTheDocument();
        expect(screen.getByText('Ребусы')).toBeInTheDocument();
        expect(screen.getByText(/2\s+слов/)).toBeInTheDocument();
    });

    test('uses an in-app confirmation instead of window.confirm', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderSavedPuzzles();
        await screen.findByText('Puzzle A');

        fireEvent.click(screen.getAllByTitle('Удалить головоломку')[0]);
        expect(screen.getByRole('dialog', { name: 'Подтверждение удаления' })).toBeInTheDocument();

        fireEvent.click(screen.getByText('Удалить'));

        await waitFor(() => {
            expect(deletePuzzle).toHaveBeenCalledWith('p1');
        });
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    test('shows a notification when loading fails', async () => {
        getPuzzles.mockRejectedValueOnce(new Error('Не удалось загрузить'));
        renderSavedPuzzles();

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить');
    });

    test('opens a share modal with a QR code and a public link', async () => {
        const { container } = renderSavedPuzzles();
        await screen.findByText('Puzzle A');

        fireEvent.click(screen.getAllByTitle('Поделиться')[0]);

        const dialog = await screen.findByRole('dialog', { name: 'Поделиться с классом' });
        expect(dialog).toHaveTextContent('Puzzle A');
        expect(container.querySelector('.shared-game-qr svg')).toBeTruthy();
        expect(screen.getByDisplayValue(/\/play\/share-1$/)).toHaveAttribute('readonly');
    });

    test('loads and expands analytics for a puzzle', async () => {
        renderSavedPuzzles();
        await screen.findByText('Puzzle A');

        fireEvent.click(screen.getAllByTitle('Аналитика')[0]);

        const panel = await screen.findByTestId('analytics-p1');
        expect(getPuzzleAnalytics).toHaveBeenCalledWith('p1');
        expect(panel).toHaveTextContent('Попыток: 3');
        expect(panel).toHaveTextContent('Средний балл: 82.5');
        expect(panel).toHaveTextContent('CODE');

        fireEvent.click(screen.getAllByTitle('Аналитика')[0]);
        await waitFor(() => expect(screen.queryByTestId('analytics-p1')).not.toBeInTheDocument());
    });

    test('updates tags through the puzzle API', async () => {
        const { container } = renderSavedPuzzles();
        await screen.findByText('Puzzle A');

        fireEvent.click(container.querySelector('.tag-remove'));

        await waitFor(() => {
            expect(updatePuzzle).toHaveBeenCalledWith('p1', { tags: [] });
        });
    });
});

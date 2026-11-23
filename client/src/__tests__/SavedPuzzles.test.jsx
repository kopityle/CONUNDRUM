import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import SavedPuzzles from '../components/SavedPuzzles';
import {
    getUserPuzzlesFromSupabase,
    deletePuzzleFromSupabase,
    updatePuzzleTags,
} from '../services/puzzleService';

vi.mock('../services/puzzleService', () => ({
    getUserPuzzlesFromSupabase: vi.fn(),
    deletePuzzleFromSupabase: vi.fn(),
    updatePuzzleTags: vi.fn(),
}));

const puzzles = [
    {
        id: 'p1',
        name: 'Puzzle A',
        game_type: 'crossword',
        tags: ['school'],
        game_data: { words: [{ word: 'TEST' }, { word: 'CODE' }] },
    },
    {
        id: 'p2',
        name: 'Puzzle B',
        game_type: 'rebus',
        tags: ['logic'],
        game_data: { rebuses: [{ word: 'ТЕСТ' }] },
    },
];

const renderSavedPuzzles = () => render(
    <MemoryRouter>
        <SavedPuzzles />
    </MemoryRouter>
);

describe('SavedPuzzles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserPuzzlesFromSupabase.mockResolvedValue(puzzles);
        deletePuzzleFromSupabase.mockResolvedValue({});
        updatePuzzleTags.mockResolvedValue({});
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
            expect(deletePuzzleFromSupabase).toHaveBeenCalledWith('p1');
        });
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    test('shows a notification when loading fails', async () => {
        getUserPuzzlesFromSupabase.mockRejectedValueOnce(new Error('Не удалось загрузить'));
        renderSavedPuzzles();

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить');
    });
});

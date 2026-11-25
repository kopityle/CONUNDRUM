import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { expect, test, vi } from 'vitest';
import GameWorkspace from '../components/GameWorkspace';

vi.mock('../components/game/CrosswordBoard', () => ({
    default: () => <div data-testid='crossword-board' />,
}));

vi.mock('../components/game/CluesPanel', () => ({
    default: () => <div data-testid='clues-panel' />,
}));

const words = [
    { word: 'КОТ', clue: 'Кот', startx: 1, starty: 1, orientation: 'across', position: 1 },
];

const gameData = {
    gameType: 'crossword',
    grid: [['КОТ'], ['А', '', 'О'], ['ШАР']],
    crossword: [['КОТ'], ['А', '', 'О'], ['ШАР']],
    words,
    layout: { result: words },
};

test('edit mode keeps the board mounted and marks it as read-only', () => {
    const { container } = render(
        <GameWorkspace
            currentGameData={gameData}
            isEditing
            editableWords={words}
            puzzleNameForSave='Тест'
        />
    );

    expect(screen.getByTestId('crossword-board')).toBeInTheDocument();
    expect(screen.getByTestId('clues-panel')).toBeInTheDocument();
    expect(container.querySelector('#crossword-container')).toHaveClass('grid-disabled');
});

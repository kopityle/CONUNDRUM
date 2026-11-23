import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import CrosswordBoard from '../components/game/CrosswordBoard';

const grid = [['T', 'E', 'S', 'T']];

const words = [
    {
        word: 'TEST',
        answer: 'TEST',
        clue: 'Test clue',
        startx: 1,
        starty: 1,
        orientation: 'across',
        position: 1,
    },
];

const hintGrid = [
    ['T', 'E', 'S', 'T'],
    ['C', 'O', 'D', 'E'],
];

const hintWords = [
    ...words,
    {
        word: 'CODE',
        answer: 'CODE',
        clue: 'Code clue',
        startx: 1,
        starty: 2,
        orientation: 'across',
        position: 2,
    },
];

describe('CrosswordBoard', () => {
    test('renders a controlled input for every non-empty cell', () => {
        render(<CrosswordBoard grid={grid} words={words} />);

        expect(screen.getAllByRole('textbox')).toHaveLength(4);
        expect(document.querySelector('[data-correct-letter="T"]')).toBeInTheDocument();
    });

    test('reports attempts with the matching word and highlights correctness', () => {
        const onAttempt = vi.fn();
        render(<CrosswordBoard grid={grid} words={words} onAttempt={onAttempt} />);

        const [firstInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstInput, { target: { value: 'X' } });

        expect(onAttempt).toHaveBeenCalledWith(false, 'TEST');
        expect(firstInput).toHaveClass('invalid');
        expect(firstInput.closest('td')).toHaveStyle({ backgroundColor: '#ED7E98' });
    });

    test('advances the cursor to the next cell after a correct letter', () => {
        render(<CrosswordBoard grid={grid} words={words} />);

        const inputs = screen.getAllByRole('textbox');
        inputs[0].focus();
        fireEvent.change(inputs[0], { target: { value: 'T' } });

        expect(inputs[1]).toHaveFocus();
    });

    test('supports arrow navigation between cells', () => {
        render(<CrosswordBoard grid={grid} words={words} />);

        const inputs = screen.getAllByRole('textbox');
        inputs[0].focus();
        fireEvent.keyDown(inputs[0], { key: 'ArrowRight' });

        expect(inputs[1]).toHaveFocus();
    });

    test('calls onComplete when the whole grid is solved', () => {
        const onComplete = vi.fn();
        render(<CrosswordBoard grid={grid} words={words} onComplete={onComplete} />);

        const inputs = screen.getAllByRole('textbox');
        'TEST'.split('').forEach((letter, index) => {
            fireEvent.change(inputs[index], { target: { value: letter } });
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/Вы успешно решили кроссворд/i)).toBeInTheDocument();
    });

    test('applies a whole-word external hint without revealing other words', () => {
        const onComplete = vi.fn();
        render(
            <CrosswordBoard
                grid={hintGrid}
                words={hintWords}
                onComplete={onComplete}
                hint={{ type: 'word', value: 'TEST', token: 1 }}
            />
        );

        const inputs = screen.getAllByRole('textbox');
        expect(inputs.map((input) => input.value).join('')).toBe('TEST');
        expect(inputs.slice(4).every((input) => input.value === '')).toBe(true);
        expect(onComplete).not.toHaveBeenCalled();
    });

    test('applies a single-letter external hint', () => {
        render(
            <CrosswordBoard
                grid={hintGrid}
                words={hintWords}
                hint={{ type: 'letter', value: 'CODE', token: 2 }}
            />
        );

        const inputs = screen.getAllByRole('textbox');
        expect(inputs[4].value).toBe('C');
        expect(inputs.slice(5).every((input) => input.value === '')).toBe(true);
    });
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import WordSoupBoard from '../components/game/WordSoupBoard';

const grid = [
    ['C', 'A', 'T'],
    ['X', 'Y', 'Z'],
];

const words = [{ word: 'CAT', clue: 'A pet' }];

const getCells = (container) => container.querySelectorAll('.word-soup-cell');

describe('WordSoupBoard', () => {
    test('renders the grid and locks scrolling while selecting', () => {
        const { container } = render(<WordSoupBoard grid={grid} words={words} />);
        const cells = getCells(container);

        expect(cells).toHaveLength(6);

        fireEvent.mouseDown(cells[0]);
        expect(document.body.style.overflow).toBe('hidden');

        fireEvent.mouseUp(document);
        expect(document.body.style.overflow).toBe('');
    });

    test('finds a word selected with the mouse', () => {
        const onAttempt = vi.fn();
        const onWordFound = vi.fn();
        const { container } = render(
            <WordSoupBoard grid={grid} words={words} onAttempt={onAttempt} onWordFound={onWordFound} />
        );
        const cells = getCells(container);

        fireEvent.mouseDown(cells[0]);
        fireEvent.mouseOver(cells[1]);
        fireEvent.mouseOver(cells[2]);
        fireEvent.mouseUp(document);

        expect(onWordFound).toHaveBeenCalledWith('CAT');
        expect(onAttempt).toHaveBeenCalledWith(true, 'CAT');
        expect(cells[0]).toHaveClass('found');
        expect(cells[1]).toHaveClass('found');
        expect(cells[2]).toHaveClass('found');
    });

    test('accepts a word selected in reverse order', () => {
        const onWordFound = vi.fn();
        const { container } = render(
            <WordSoupBoard grid={grid} words={words} onWordFound={onWordFound} />
        );
        const cells = getCells(container);

        fireEvent.mouseDown(cells[2]);
        fireEvent.mouseOver(cells[1]);
        fireEvent.mouseOver(cells[0]);
        fireEvent.mouseUp(document);

        expect(onWordFound).toHaveBeenCalledWith('CAT');
    });

    test('marks an incorrect attempt', () => {
        const onAttempt = vi.fn();
        const { container } = render(
            <WordSoupBoard grid={grid} words={words} onAttempt={onAttempt} />
        );
        const cells = getCells(container);

        fireEvent.mouseDown(cells[3]);
        fireEvent.mouseOver(cells[4]);
        fireEvent.mouseUp(document);

        expect(onAttempt).toHaveBeenCalledWith(false, 'XY');
        expect(cells[3]).toHaveClass('incorrect');
        expect(cells[4]).toHaveClass('incorrect');
    });

    test('continues a touch selection via elementFromPoint', () => {
        const originalElementFromPoint = document.elementFromPoint;
        const onWordFound = vi.fn();
        const { container } = render(
            <WordSoupBoard grid={grid} words={words} onWordFound={onWordFound} />
        );
        const cells = getCells(container);
        const touch = { clientX: 10, clientY: 10 };

        document.elementFromPoint = vi.fn()
            .mockReturnValueOnce(cells[1])
            .mockReturnValueOnce(cells[2]);

        fireEvent.touchStart(cells[0], { touches: [touch] });
        fireEvent.touchMove(document, { touches: [touch] });
        fireEvent.touchMove(document, { touches: [touch] });
        fireEvent.touchEnd(document);

        expect(document.elementFromPoint).toHaveBeenCalledTimes(2);
        expect(onWordFound).toHaveBeenCalledWith('CAT');

        document.elementFromPoint = originalElementFromPoint;
    });

    test('calls onComplete after every word is found', () => {
        const onComplete = vi.fn();
        const { container } = render(
            <WordSoupBoard grid={grid} words={words} onComplete={onComplete} />
        );
        const cells = getCells(container);

        fireEvent.mouseDown(cells[0]);
        fireEvent.mouseOver(cells[1]);
        fireEvent.mouseOver(cells[2]);
        fireEvent.mouseUp(document);

        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});

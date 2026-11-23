import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import CluesPanel from '../components/game/CluesPanel';

const words = [
    {
        word: 'TEST',
        clue: 'Test clue',
        orientation: 'across',
        position: 1,
    },
    {
        word: 'CODE',
        clue: 'Code clue',
        orientation: 'down',
        position: 2,
    },
];

describe('CluesPanel', () => {
    test('splits crossword clues into across and down sections', () => {
        render(<CluesPanel gameType='crossword' words={words} />);

        expect(screen.getByText('По горизонтали')).toBeInTheDocument();
        expect(screen.getByText('По вертикали')).toBeInTheDocument();
        expect(screen.getByText('Test clue')).toBeInTheDocument();
        expect(screen.getByText('Code clue')).toBeInTheDocument();
    });

    test('shows an answer and notifies the parent', () => {
        const onShowAnswer = vi.fn();
        render(<CluesPanel gameType='crossword' words={words} onShowAnswer={onShowAnswer} />);

        fireEvent.click(screen.getByLabelText('Показать ответ: TEST'));

        expect(screen.getByText('TEST')).toBeInTheDocument();
        expect(onShowAnswer).toHaveBeenCalledWith('TEST', expect.objectContaining({ word: 'TEST' }));
    });

    test('requests a single letter reveal for crossword words', () => {
        const onRevealLetter = vi.fn();
        render(<CluesPanel gameType='crossword' words={words} onRevealLetter={onRevealLetter} />);

        fireEvent.click(screen.getByLabelText('Открыть 1 букву слова CODE'));

        expect(onRevealLetter).toHaveBeenCalledWith('CODE', expect.objectContaining({ word: 'CODE' }));
    });

    test('renders word soup clues without a letter reveal', () => {
        render(<CluesPanel gameType='wordsoup' words={[{ word: 'CAT', clue: 'A pet' }]} />);

        expect(screen.getByText('Слова в филворде')).toBeInTheDocument();
        expect(screen.queryByText('1 буква')).not.toBeInTheDocument();
    });

    test('uses controlled edit fields without querying the document', () => {
        const onItemChange = vi.fn();
        const editableWords = [{ ...words[0], originalArrayIndex: 7 }];
        render(
            <CluesPanel
                gameType='crossword'
                words={words}
                editableWords={editableWords}
                isEditing
                onItemChange={onItemChange}
            />
        );

        fireEvent.change(screen.getByLabelText('Подсказка 1'), { target: { value: 'Updated clue' } });
        fireEvent.change(screen.getByLabelText('Ответ 1'), { target: { value: 'QUIZ' } });

        expect(onItemChange).toHaveBeenCalledWith(7, 'clue', 'Updated clue');
        expect(onItemChange).toHaveBeenCalledWith(7, 'word', 'QUIZ');
    });
});

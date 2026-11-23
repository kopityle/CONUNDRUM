import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import RebusDisplay from '../components/RebusDisplay';
import '@testing-library/jest-dom';

const makeRebus = (word) => ({
    word,
    parts: [
        { type: 'text', content: word[0] },
        {
            type: 'image',
            imageUrl: 'https://example.com/rebus.png',
            subtract_start: 0,
            subtract_end: 0,
        },
        { type: 'text', content: word.slice(1) },
    ],
});

const mockGameData = { rebuses: [makeRebus('ТЕСТ')] };
const mockGameDataWithTwoRebuses = { rebuses: [makeRebus('ТЕСТ'), makeRebus('КОД')] };

describe('RebusDisplay Component', () => {
    test('renders the title and a rebus card', () => {
        render(<RebusDisplay gameData={mockGameData} />);

        expect(screen.getByText(/Ребусы/i)).toBeInTheDocument();
        expect(screen.getByText('Т')).toBeInTheDocument();
        expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    });

    test('shows the answer on demand', () => {
        render(<RebusDisplay gameData={mockGameData} />);

        expect(screen.queryByText('ТЕСТ')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText(/Показать ответ/i));

        expect(screen.getByText('ТЕСТ')).toBeInTheDocument();
    });

    test('reports correct and incorrect attempts with the rebus word', () => {
        const onAttempt = vi.fn();
        render(<RebusDisplay gameData={mockGameData} onAttempt={onAttempt} />);

        const input = screen.getByPlaceholderText('Ваш ответ');
        const checkButton = screen.getByText('Проверить');

        fireEvent.change(input, { target: { value: 'неверно' } });
        fireEvent.click(checkButton);
        expect(onAttempt).toHaveBeenLastCalledWith(false, 'ТЕСТ');

        fireEvent.change(input, { target: { value: 'тест' } });
        fireEvent.click(checkButton);
        expect(onAttempt).toHaveBeenLastCalledWith(true, 'ТЕСТ');
    });

    test('calls onComplete after every rebus is solved', () => {
        const onComplete = vi.fn();
        render(<RebusDisplay gameData={mockGameDataWithTwoRebuses} onComplete={onComplete} />);

        const inputs = screen.getAllByPlaceholderText('Ваш ответ');
        const checkButtons = screen.getAllByText('Проверить');

        fireEvent.change(inputs[0], { target: { value: 'ТЕСТ' } });
        fireEvent.click(checkButtons[0]);
        fireEvent.change(inputs[1], { target: { value: 'КОД' } });
        fireEvent.click(checkButtons[1]);

        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});

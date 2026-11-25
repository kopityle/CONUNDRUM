import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import PuzzleCreatorForm from '../components/PuzzleCreatorForm';

const setFile = (input, size) => {
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [{ size, name: 'source.txt' }],
    });
    fireEvent.change(input);
};

describe('PuzzleCreatorForm', () => {
    test('submits controlled form values', () => {
        const onSubmit = vi.fn();
        const { container } = render(<PuzzleCreatorForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText('Название игры'), { target: { value: 'My puzzle' } });
        fireEvent.click(screen.getByLabelText('Филворд'));
        fireEvent.change(screen.getByLabelText('Тема'), { target: { value: 'Fruits' } });
        fireEvent.change(screen.getByLabelText('Количество слов'), { target: { value: '7' } });
        fireEvent.click(screen.getByLabelText('Сложно'));
        fireEvent.submit(container.querySelector('form'));

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            puzzleName: 'My puzzle',
            gameType: 'wordsoup',
            inputType: 'topic',
            topic: 'Fruits',
            totalWords: 7,
            difficulty: 'hard',
            file: null,
        }));
    });

    test('название не обязательно и показывает статус генерации', () => {
        const { rerender } = render(<PuzzleCreatorForm />);

        const name = screen.getByLabelText('Название игры');
        expect(name).not.toBeRequired();
        expect(name).toHaveAttribute('placeholder', 'НАЗВАНИЕ (ПО ЖЕЛАНИЮ)');

        rerender(<PuzzleCreatorForm isLoading />);
        expect(screen.getByRole('button', { name: 'Генерация...' })).toBeDisabled();

        rerender(<PuzzleCreatorForm isLoading isLTI isConfigureMode />);
        expect(screen.getByRole('button', { name: 'Сохранение...' })).toBeDisabled();
    });

    test('rejects files larger than 10 MB', () => {
        const onFileError = vi.fn();
        render(<PuzzleCreatorForm onFileError={onFileError} />);

        fireEvent.click(screen.getByLabelText('Загрузить файл'));
        const fileInput = screen.getByLabelText('Файл');
        setFile(fileInput, 10 * 1024 * 1024 + 1);

        expect(onFileError).toHaveBeenCalledWith('Файл слишком большой. Максимальный размер: 10 МБ.');
        expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();
    });

    test('shows a success indicator for an allowed file', () => {
        render(<PuzzleCreatorForm />);

        fireEvent.click(screen.getByLabelText('Загрузить файл'));
        setFile(screen.getByLabelText('Файл'), 1024);

        expect(screen.getByText('Файл загружен')).toBeInTheDocument();
    });
});

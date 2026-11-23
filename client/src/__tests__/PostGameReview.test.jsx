import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import PostGameReview from '../components/PostGameReview';

const terms = [
    { word: 'CODE', clue: 'Код доступа' },
    { word: 'TEST', clue: 'Проверка' },
];

const baseStats = {
    accuracy: 85.6,
    duration: 42,
    attempts: 10,
    wrongWords: [],
    hintedWords: [],
};

describe('PostGameReview', () => {
    test('shows the consolidated title, result and stats', () => {
        render(<PostGameReview stats={baseStats} terms={terms} studentName='Иван' />);

        expect(screen.getByRole('heading', { name: 'Закрепление материала' })).toBeInTheDocument();
        expect(screen.getByText('Поздравляем, Иван!')).toBeInTheDocument();
        expect(screen.getByText('Ваш результат: 86 из 100')).toBeInTheDocument();
        expect(screen.getByText('Точность: 86%')).toBeInTheDocument();
        expect(screen.getByText('Время: 42 с')).toBeInTheDocument();
        expect(screen.getByText('Попыток: 10')).toBeInTheDocument();
    });

    test('marks a term from wrong or hinted words with a single review badge', () => {
        render(
            <PostGameReview
                stats={{
                    ...baseStats,
                    wrongWords: ['code'],
                    hintedWords: ['CODE'],
                }}
                terms={terms}
            />
        );

        const codeCard = screen.getByRole('button', { name: 'CODE' }).closest('article');
        const testCard = screen.getByRole('button', { name: 'TEST' }).closest('article');

        expect(codeCard).toHaveClass('needs-review');
        expect(testCard).not.toHaveClass('needs-review');
        expect(screen.getAllByText('Стоит повторить')).toHaveLength(1);
    });

    test('flips only the clicked flashcard', () => {
        render(<PostGameReview stats={baseStats} terms={terms} />);

        const codeButton = screen.getByRole('button', { name: 'CODE' });
        const testButton = screen.getByRole('button', { name: 'TEST' });

        expect(codeButton).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(codeButton);

        expect(codeButton).toHaveAttribute('aria-pressed', 'true');
        expect(testButton).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Код доступа')).toBeVisible();
        expect(screen.queryByText('Проверка')).not.toBeInTheDocument();

        fireEvent.click(codeButton);
        expect(codeButton).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('CODE')).toBeVisible();
    });

    test('mode toggle changes the initial face of every card', () => {
        render(<PostGameReview stats={baseStats} terms={terms} />);

        const toggle = screen.getByRole('button', { name: 'Показать: Слово → Определение' });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('CODE')).toBeVisible();
        expect(screen.queryByText('Код доступа')).not.toBeInTheDocument();

        fireEvent.click(toggle);

        expect(screen.getByRole('button', { name: 'Показать: Определение → Слово' }))
            .toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Код доступа')).toBeVisible();
        expect(screen.queryByText('CODE')).not.toBeInTheDocument();
    });

    test('calls quick action handlers and hides sharing for students', () => {
        const onDownloadPdf = vi.fn();
        const onShare = vi.fn();
        const onRestart = vi.fn();

        const { rerender } = render(
            <PostGameReview
                stats={baseStats}
                terms={terms}
                onDownloadPdf={onDownloadPdf}
                onShare={onShare}
                onRestart={onRestart}
            />
        );

        expect(screen.queryByRole('button', { name: 'Поделиться с классом' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Скачать PDF (Задание + Ответы)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Сыграть ещё раз' }));

        expect(onDownloadPdf).toHaveBeenCalledTimes(1);
        expect(onRestart).toHaveBeenCalledTimes(1);
        expect(onShare).not.toHaveBeenCalled();

        rerender(
            <PostGameReview
                stats={baseStats}
                terms={terms}
                isAuthor
                onDownloadPdf={onDownloadPdf}
                onShare={onShare}
                onRestart={onRestart}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Поделиться с классом' }));
        expect(onShare).toHaveBeenCalledTimes(1);
    });
});

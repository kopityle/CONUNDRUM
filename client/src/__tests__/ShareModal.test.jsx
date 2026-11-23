import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import ShareModal from '../components/ShareModal';

describe('ShareModal', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
    });

    afterEach(() => {
        delete navigator.clipboard;
        if (document.execCommand) delete document.execCommand;
    });

    test('renders a QR code and a copyable public link', () => {
        const { container } = render(
            <ShareModal shareId='abc123' name='Кроссворд' onClose={vi.fn()} />
        );

        const dialog = screen.getByRole('dialog', { name: 'Поделиться с классом' });
        expect(dialog).toHaveTextContent('Кроссворд');
        expect(container.querySelector('.shared-game-qr svg')).toBeTruthy();

        const link = screen.getByDisplayValue(/\/play\/abc123$/);
        expect(link).toHaveAttribute('readonly');
    });

    test('copies the link to the clipboard', async () => {
        render(<ShareModal shareId='abc123' onClose={vi.fn()} />);

        const link = screen.getByDisplayValue(/\/play\/abc123$/);
        fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

        await vi.waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(link.value);
        });
        expect(await screen.findByRole('button', { name: 'Скопировано!' })).toBeInTheDocument();
    });

    test('falls back to execCommand when the clipboard API is unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: undefined,
        });
        const execCommand = vi.fn().mockReturnValue(true);
        document.execCommand = execCommand;

        render(<ShareModal shareId='abc123' onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(await screen.findByRole('button', { name: 'Скопировано!' })).toBeInTheDocument();
    });

    test('closes via the close button and the overlay', () => {
        const onClose = vi.fn();
        const { container } = render(<ShareModal shareId='abc123' onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(container.querySelector('.shared-game-overlay'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});

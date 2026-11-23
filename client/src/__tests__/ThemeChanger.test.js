import { vi } from 'vitest';
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeChanger from '../components/ThemeChanger';

describe('ThemeChanger Component', () => {
    test('calls toggleTheme when the button is clicked', () => {
        const mockToggle = vi.fn();
        render(<ThemeChanger isBlackTheme={true} toggleTheme={mockToggle} />);

        fireEvent.click(screenButton());

        expect(mockToggle).toHaveBeenCalled();
    });

    test('renders the sun for the black theme and the moon for the white theme', () => {
        const { container, rerender } = render(
            <ThemeChanger isBlackTheme={true} toggleTheme={() => {}} />
        );

        expect(container.querySelector('.theme-switcher-icon.sun')).toBeInTheDocument();

        rerender(<ThemeChanger isBlackTheme={false} toggleTheme={() => {}} />);

        expect(container.querySelector('.theme-switcher-icon.moon')).toBeInTheDocument();
    });
});

function screenButton() {
    return document.querySelector('.theme-changer-button');
}

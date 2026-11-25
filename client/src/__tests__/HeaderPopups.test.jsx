import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import Header from '../components/Header';

vi.mock('../components/ThemeChanger', () => ({
    default: () => <button data-testid='theme-changer' />,
}));

test('renders popup content outside the header so it is not clipped by its rounded box', () => {
    const { container } = render(
        <MemoryRouter>
            <Header isAuth={false} isBlackTheme toggleTheme={() => {}} />
        </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'О проекте' }));

    const popup = document.body.querySelector('.about-popup.visible');
    expect(popup).toBeInTheDocument();
    expect(container.querySelector('.main-page-header')).not.toContainElement(popup);
});

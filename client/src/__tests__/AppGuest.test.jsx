import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';
import { getMe, getToken, setToken } from '../services/authService';

vi.mock('../services/authService', () => ({
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    removeToken: vi.fn(),
    isAuthenticated: vi.fn(() => false),
    getMe: vi.fn(async () => null),
    register: vi.fn(),
    login: vi.fn(),
    updateProfile: vi.fn(),
    logout: vi.fn(),
    apiFetch: vi.fn(),
    AUTH_CHANGED_EVENT: 'auth-changed',
    TOKEN_STORAGE_KEY: 'conundrum_token',
}));

vi.mock('../components/GameGenerator', () => ({
    default: ({ user }) => <div>Мок генератора {user ? '— авторизован' : '— гость'}</div>,
}));

vi.mock('../components/PublicPlayPage', () => ({
    default: () => <div>Публичная игра</div>,
}));

const renderApp = (path = '/gamegenerator') => render(
    <MemoryRouter initialEntries={[path]}>
        <App />
    </MemoryRouter>
);

describe('App guest routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getToken.mockReturnValue(null);
        getMe.mockResolvedValue(null);
        window.history.replaceState({}, '', '/');
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
    });

    test('renders the game generator without login and does not fetch a session', async () => {
        renderApp('/gamegenerator');

        expect(await screen.findByText(/Мок генератора/)).toBeInTheDocument();
        expect(screen.getByText(/гость/)).toBeInTheDocument();
        expect(getMe).not.toHaveBeenCalled();
    });

    test('redirects a guest from /account to /register', async () => {
        renderApp('/account');

        expect(await screen.findByText('Добро пожаловать!')).toBeInTheDocument();
        expect(screen.queryByText('Личный кабинет')).not.toBeInTheDocument();
    });

    test('supports the public play route', async () => {
        renderApp('/play/share-xyz');

        expect(await screen.findByText('Публичная игра')).toBeInTheDocument();
    });

    test('restores a session from auth_token in LTI mode', async () => {
        window.history.replaceState({}, '', '/?lti=true&auth_token=query-token');
        getMe.mockResolvedValue({ id: 7, email: 'teacher@example.com' });

        renderApp('/');

        expect(setToken).toHaveBeenCalledWith('query-token');
        expect(getMe).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/авторизован/)).toBeInTheDocument();
    });
});

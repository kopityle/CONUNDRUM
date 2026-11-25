// Единая нормализация базового адреса API.
// VITE_API_URL может быть не задан (тогда запросы идут на тот же origin,
// где Vite/nginx проксирует /api) или заканчиваться слешем.
const rawApiUrl = import.meta.env.VITE_API_URL || '';

export const API_BASE = String(rawApiUrl).trim().replace(/\/+$/, '');

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalizedPath}`;
};

const trimTrailingSlashes = (value) => String(value || '').trim().replace(/\/+$/, '');

/**
 * Публичная ссылка на клиент. GitHub Pages раздаёт проект из подпапки /<repo>,
 * поэтому нельзя брать только origin — ссылки для учеников должны содержать
 * базовый путь, иначе они попадают на 404 страницу GitHub.
 */
export const clientUrl = (path = '/') => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const runtimeBase = typeof window === 'undefined'
        ? trimTrailingSlashes(import.meta.env.VITE_BASE_URL)
        : trimTrailingSlashes(
            window.BASE_URL || `${window.location.origin}${trimTrailingSlashes(import.meta.env.BASE_URL)}`
        );
    const base = runtimeBase || trimTrailingSlashes(import.meta.env.VITE_CLIENT_URL) ||
        (typeof window === 'undefined' ? '' : window.location.origin);
    return `${base}${normalizedPath}`;
};

export default apiUrl;

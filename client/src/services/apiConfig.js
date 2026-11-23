// Единая нормализация базового адреса API.
// VITE_API_URL может быть не задан (тогда запросы идут на тот же origin,
// где Vite/nginx проксирует /api) или заканчиваться слешем.
const rawApiUrl = import.meta.env.VITE_API_URL || '';

export const API_BASE = String(rawApiUrl).trim().replace(/\/+$/, '');

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalizedPath}`;
};

export default apiUrl;

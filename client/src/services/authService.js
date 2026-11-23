// src/services/authService.js
export const TOKEN_STORAGE_KEY = 'conundrum_token';
export const AUTH_CHANGED_EVENT = 'auth-changed';

export const getToken = () => {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

export const removeToken = () => {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        // localStorage may be unavailable (private mode / SSR) - ignore.
    }
};

export const setToken = (token) => {
    if (!token) {
        removeToken();
        return;
    }
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
        // Ignore storage failures - the httpOnly cookie can still carry the session.
    }
};

export const isAuthenticated = () => Boolean(getToken());

const dispatchAuthChanged = (user) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, {
            detail: { user: user || null },
        }));
    }
};

export const apiFetch = async (path, options = {}) => {
    const { headers, body, ...rest } = options;
    const token = getToken();
    const requestHeaders = { ...(headers || {}) };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    let requestBody = body;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const contentTypeKey = Object.keys(requestHeaders).find(
        (key) => key.toLowerCase() === 'content-type'
    );

    if (body !== undefined && body !== null && !isFormData) {
        if (!contentTypeKey) requestHeaders['Content-Type'] = 'application/json';
        requestBody = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${path}`, {
        ...rest,
        credentials: 'include',
        headers: requestHeaders,
        body: requestBody,
    });

    let data = null;
    const responseText = await response.text();
    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            data = responseText;
        }
    }

    if (!response.ok) {
        const message = (data && (data.error || data.message))
            || response.statusText
            || `Ошибка запроса (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
};

export const register = async ({ email, password, username, occupation, gender }) => {
    const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { email, password, username, occupation, gender },
    });

    if (data?.token) setToken(data.token);
    const user = data?.user || null;
    dispatchAuthChanged(user);
    return { token: data?.token || getToken(), user };
};

export const login = async ({ email, password }) => {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
    });

    if (data?.token) setToken(data.token);
    const user = data?.user || null;
    dispatchAuthChanged(user);
    return { token: data?.token || getToken(), user };
};

export const getMe = async () => {
    const data = await apiFetch('/api/auth/me');
    return data?.user || null;
};

export const updateProfile = async ({ username, occupation, gender }) => {
    const data = await apiFetch('/api/auth/profile', {
        method: 'POST',
        body: { username, occupation, gender },
    });

    const user = data?.user || null;
    dispatchAuthChanged(user);
    return user;
};

export const logout = async () => {
    try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        // Even if the server call fails, the local session must be cleared.
    }
    removeToken();
    dispatchAuthChanged(null);
};

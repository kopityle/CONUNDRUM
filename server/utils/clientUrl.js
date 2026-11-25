'use strict';

const trimTrailingSlashes = (value) => String(value || '').trim().replace(/\/+$/, '');

/**
 * Публичный адрес клиента. На GitHub Pages проект живёт в подпапке /<repo>,
 * поэтому CLIENT_URL, указывающий только на домен, нужно дополнить путём.
 * CLIENT_BASE_PATH позволяет задать путь явно для любого другого деплоя.
 */
function getClientBaseUrl(fallback = '') {
    const configured = trimTrailingSlashes(process.env.CLIENT_URL || fallback);
    const basePath = String(process.env.CLIENT_BASE_PATH || '').trim().replace(/^\/+|\/+$/g, '');
    if (basePath) return `${configured}/${basePath}`;

    try {
        const parsed = new URL(configured);
        if (parsed.hostname.endsWith('.github.io') && parsed.pathname === '/') {
            return `${configured}/${process.env.GITHUB_REPO || 'CONUNDRUM'}`;
        }
    } catch (error) {
        // CLIENT_URL может быть относительным — оставляем его как есть.
    }
    return configured;
}

function clientUrl(path = '/', fallback = '') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getClientBaseUrl(fallback)}${normalizedPath}`;
}

module.exports = { getClientBaseUrl, clientUrl };

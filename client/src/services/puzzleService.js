// src/services/puzzleService.js
import { apiFetch } from './authService';

const normalizePuzzles = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.puzzles)) return data.puzzles;
    return [];
};

export const getPuzzles = async () => normalizePuzzles(await apiFetch('/api/puzzles'));

export const createPuzzle = async (puzzleData) => apiFetch('/api/puzzles', {
    method: 'POST',
    body: puzzleData,
});

export const getPuzzle = async (puzzleId) =>
    apiFetch(`/api/puzzles/${encodeURIComponent(puzzleId)}`);

export const updatePuzzle = async (puzzleId, puzzleUpdateData) =>
    apiFetch(`/api/puzzles/${encodeURIComponent(puzzleId)}`, {
        method: 'PUT',
        body: puzzleUpdateData,
    });

export const deletePuzzle = async (puzzleId) =>
    apiFetch(`/api/puzzles/${encodeURIComponent(puzzleId)}`, { method: 'DELETE' });

export const getPuzzleAnalytics = async (puzzleId) =>
    apiFetch(`/api/puzzles/${encodeURIComponent(puzzleId)}/analytics`);

export const getPublicPuzzle = async (shareId) =>
    apiFetch(`/api/play/${encodeURIComponent(shareId)}`);

export const submitAttempt = async (shareId, attempt) =>
    apiFetch(`/api/play/${encodeURIComponent(shareId)}/attempt`, {
        method: 'POST',
        body: attempt,
    });

export const saveLtiConfiguration = async (resourceLinkId, generationParams) =>
    apiFetch(`/api/lti/config/${encodeURIComponent(resourceLinkId)}`, {
        method: 'PUT',
        body: { generationParams },
    });

export const getLtiConfiguration = async (resourceLinkId) => {
    try {
        const data = await apiFetch(`/api/lti/config/${encodeURIComponent(resourceLinkId)}`);
        return data?.generation_params ?? data?.generationParams ?? data ?? null;
    } catch (error) {
        //"No configuration yet" is a normal state for a freshly created LTI placement.
        if (error?.status === 404) return null;
        throw error;
    }
};

export const fetchRegeneratedLayout = async (gameType, wordsAndClues) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/recalculate-game-layout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameType: gameType, words: wordsAndClues }),
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: response.statusText || "Неизвестная ошибка при перегенерации сетки." };
        }
        console.error("Ошибка при перегенерации сетки:", errorData, "Статус:", response.status);
        throw new Error(errorData.error || `Ошибка при перегенерации сетки: ${response.status}`);
    }
    return response.json();
};

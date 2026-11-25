const GAME_TYPE_LABELS = {
    crossword: 'Кроссворд',
    wordsoup: 'Филворд',
    rebus: 'Ребусы',
};

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const shorten = (value, maxLength = 60) => (
    value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value
);

export const buildAutoPuzzleName = ({ puzzleName, inputType, topic, gameData } = {}) => {
    const explicitName = clean(puzzleName);
    if (explicitName) return explicitName;

    if (inputType === 'topic') {
        const topicName = clean(topic);
        if (topicName) return shorten(topicName);
    }

    const firstWords = (gameData?.words || [])
        .map((word) => clean(word?.word || word?.answer || word?.originalWord))
        .filter(Boolean)
        .slice(0, 2);

    if (firstWords.length) return shorten(firstWords.join(', '));

    return GAME_TYPE_LABELS[gameData?.gameType] || 'Головоломка';
};

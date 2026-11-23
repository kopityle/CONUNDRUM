export const normalizeWord = (value) => String(value ?? '').trim().toUpperCase();

const deriveRebusClue = (rebus) => {
    const parts = Array.isArray(rebus?.parts) ? rebus.parts : [];
    const pieces = parts.map((part) => {
        if (part?.type === 'text') return String(part.content ?? '').trim();

        const label = part?.description || part?.iconQuery || 'изображение';
        const markers = [];
        if (Number(part?.subtract_start) > 0) markers.push(`−${part.subtract_start} слева`);
        if (Number(part?.subtract_end) > 0) markers.push(`−${part.subtract_end} справа`);
        return `[${label}]${markers.length ? ` ${markers.join(', ')}` : ''}`;
    }).filter(Boolean);

    return rebus?.clue || rebus?.description || rebus?.explanation || pieces.join(' ');
};

export const getReviewTerms = (gameData) => {
    const gameType = gameData?.gameType;

    let source = [];
    if (gameType === 'crossword') source = gameData.layout?.result || gameData.words || [];
    else if (gameType === 'wordsoup') source = gameData.words || [];
    else if (gameType === 'rebus') source = gameData.rebuses || [];

    if (!Array.isArray(source)) return [];

    const terms = [];
    const seen = new Set();

    source.forEach((item) => {
        const word = normalizeWord(item?.answer ?? item?.word);
        if (!word || seen.has(word)) return;
        seen.add(word);

        const clue = gameType === 'rebus'
            ? deriveRebusClue(item)
            : String(item?.clue ?? '').trim();

        terms.push({ word, clue });
    });

    return terms;
};

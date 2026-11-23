const clg = require('crossword-layout-generator');
const {
    callOpenRouter,
    DEFAULT_MODELS,
    REQUEST_TIMEOUT_MS
} = require('../utils/openRouterClient');
const { wordsJsonSchema, validateWords } = require('../utils/schemas');

function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Генератор кроссвордов: слова и подсказки приходят из OpenRouter,
 * сетка строится через crossword-layout-generator.
 */
class CrosswordGenerator {
    constructor(apiKey, apiUrl, options = {}) {
        this.openrouterApiKey = apiKey;
        this.openrouterApiUrl = apiUrl;
        this.models = options.models ?? DEFAULT_MODELS;
        this.timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    }

    async generateCrossword(text, inputType, totalWords, difficulty = 'normal') {
        text = text.trim().replace(/\s+/g, ' ');
        const difficultyLevel = difficulty === 'easy' ? 'simple and commonly used' :
            difficulty === 'hard' ? 'complex and sophisticated' :
                'moderately difficult';

        let prompt;
        if (inputType === 'topic') {
            prompt = `Generate real ${totalWords} ${difficultyLevel} words related to the topic "${text}".
The keywords must be in their base form (lemma). For each word, provide a concise, accurate, and unambiguous definition, question, or short description suitable for a word puzzle.
The clue must directly relate to the word, be in the same language as the input topic, and must NOT contain the word itself. Avoid direct answers, use paraphrases/analogies. If in doubt about the language, use Russian.
Return only a JSON array of objects with "word" and "clue" fields.`;
        } else {
            prompt = `Extract ${totalWords} ${difficultyLevel} keywords from the given text: "${text}".
The keywords must be in their base form (lemma). For each word, create a concise, accurate, and unambiguous definition, question, or short description related to the meaning of the word in the text.
The clue must be in the same language as the input text and must NOT contain the word itself. Avoid direct answers, use paraphrases/analogies. If in doubt about the language, use Russian.
Return only a JSON array of objects with "word" and "clue" fields.`;
        }

        const { items: wordsData, data: responseData } = await callOpenRouter({
            apiKey: this.openrouterApiKey,
            apiUrl: this.openrouterApiUrl,
            prompt,
            models: this.models,
            jsonSchema: wordsJsonSchema,
            schemaName: 'crossword_words',
            validateItems: validateWords,
            temperature: 0.5,
            timeout: this.timeout,
            fetchImpl: this.fetchImpl
        });

        // Zod: word без цифр/спецсимволов, непустая clue, clue не содержит само слово.
        // callOpenRouter уже вызвал validateWords и перешёл к следующей модели при мусоре.
        if (wordsData.length === 0) {
            throw new Error('Нейросеть не вернула валидных слов или все они были отфильтрованы.');
        }

        const layout = this.buildBestLayout(wordsData);

        // Сохраняем оригинальные слова (с пробелами), сетке оставляем версию без пробелов
        layout.result.forEach((wordData) => {
            const originalWordData = wordsData.find((item) =>
                item.word.replace(/\s+/g, '').toLocaleUpperCase() === wordData.answer.toLocaleUpperCase()
            );
            const originalWord = originalWordData ? originalWordData.word : wordData.answer;

            wordData.originalWord = originalWord;
            wordData.word = originalWord;
            wordData.answer = wordData.answer.replace(/\s+/g, '');
        });

        const crosswordGrid = this.createGridFromLayout(layout);
        const displayWords = layout.result.map((wordData) => ({
            ...wordData,
            word: wordData.originalWord,
            answer: wordData.originalWord,
            cleanAnswer: wordData.answer
        }));

        return {
            crossword: crosswordGrid,
            words: displayWords,
            rawResponse: responseData,
            parsedWords: wordsData,
            layout
        };
    }

    /**
     * Строит макет, выбирая результат с максимальным числом размещённых слов.
     * Если crossword-layout-generator отбросил слова (orientation === 'none'),
     * повторяем расчёт на перемешанных массивах (всего до 3 попыток).
     */
    buildBestLayout(wordsAndClues) {
        const layoutInput = wordsAndClues.map((item) => ({
            answer: String(item.word).replace(/\s+/g, '').toLocaleUpperCase(),
            clue: item.clue
        }));

        const countPlaced = (layout) => (layout?.result || []).filter(
            (word) => word.orientation && word.orientation !== 'none'
        ).length;

        let bestLayout = null;
        let bestScore = -1;

        for (let attempt = 0; attempt < 3; attempt++) {
            const attemptInput = attempt === 0 ? [...layoutInput] : shuffle(layoutInput);
            const layout = clg.generateLayout(attemptInput);
            if (!layout || !Array.isArray(layout.result) || layout.result.length === 0) continue;

            const score = countPlaced(layout);
            if (score > bestScore) {
                bestLayout = layout;
                bestScore = score;
            }
            if (score >= layoutInput.length) break;
        }

        if (!bestLayout) {
            throw new Error('Не удалось сгенерировать валидный макет кроссворда. Возможно, слова не пересекаются или их слишком мало.');
        }
        return bestLayout;
    }

    createGridFromLayout(layout) {
        const grid = Array.from({ length: layout.rows }, () => Array(layout.cols).fill(''));

        layout.result.forEach((wordData) => {
            const wordForGrid = String(wordData.answer || '').toLocaleUpperCase();

            if (!wordForGrid || wordData.orientation === 'none') return;

            const x = wordData.startx - 1;
            const y = wordData.starty - 1;

            if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) {
                console.warn(`Пропуск слова ${wordForGrid}: некорректные начальные координаты`);
                return;
            }

            for (let i = 0; i < wordForGrid.length; i++) {
                const currentX = wordData.orientation === 'across' ? x + i : x;
                const currentY = wordData.orientation === 'across' ? y : y + i;

                if (currentX >= layout.cols || currentY >= layout.rows) {
                    console.warn(`Пропуск слова ${wordForGrid}: выход за границы сетки`);
                    return;
                }
                grid[currentY][currentX] = wordForGrid[i];
            }
        });

        return grid;
    }

    buildCrosswordFromWords(wordsAndClues) {
        if (!wordsAndClues || !Array.isArray(wordsAndClues) || wordsAndClues.length === 0) {
            throw new Error('Не предоставлены слова для генерации кроссворда.');
        }

        // тут приходят пользовательские слова — проверяем только базовую пригодность,
        // не применяя жёсткие LLM-лимиты из Zod
        const validWordsAndClues = wordsAndClues.filter(
            (item) => item && typeof item.word === 'string' && typeof item.clue === 'string' && item.word.trim() !== ''
        ).map((item) => ({ word: item.word.trim(), clue: item.clue.trim() }));

        if (validWordsAndClues.length === 0) {
            throw new Error('Нет валидных слов для генерации кроссворда.');
        }

        const layout = this.buildBestLayout(validWordsAndClues);
        const displayWords = layout.result.map((wordData) => {
            const originalItem = validWordsAndClues.find(
                (item) => item.word.replace(/\s+/g, '').toLocaleUpperCase() === wordData.answer.toLocaleUpperCase()
            );
            const originalWord = originalItem ? originalItem.word : wordData.answer;
            return {
                ...wordData,
                word: originalWord,
                originalWord: originalWord,
                cleanAnswer: wordData.answer
            };
        });

        return {
            crossword: this.createGridFromLayout(layout),
            words: displayWords,
            layout
        };
    }
}

module.exports = CrosswordGenerator;

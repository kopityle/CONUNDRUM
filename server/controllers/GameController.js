const CrosswordGenerator = require('../services/CrosswordGenerator');
const WordSoupGenerator = require('../services/WordSoupGenerator');
const RebusGenerator = require('../services/RebusGenerator');
const FileManager = require('../services/FileManager');
const CircuitBreaker = require('../utils/CircuitBreaker');
const RateLimiter = require('../utils/RateLimiter');

const breaker = new CircuitBreaker();
// Лимит на IP, а не глобальный: один клиент не блокирует остальных
const limiter = new RateLimiter(20, 60000);
const crosswordGenerator = new CrosswordGenerator(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_URL);
const wordSoupGenerator = new WordSoupGenerator(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_URL);
const rebusGenerator = new RebusGenerator(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_URL);
const fileManager = new FileManager();

function userError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function getClientIp(req) {
    return req.ip ||
        req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown';
}

// Логика генерации игры с нуля
exports.generateGame = async (req, res) => {
    if (!limiter.tryConsume(getClientIp(req))) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }

    try {
        const { inputType, gameType, difficulty } = req.body || {};
        const totalWords = parseInt(req.body?.totalWords, 10);

        let text;
        if (inputType === 'text') {
            text = req.body.text;
        } else if (inputType === 'topic') {
            text = req.body.topic;
        } else if (inputType === 'file') {
            if (!req.file) throw userError('Файл не загружен.');

            // Обязательная валидация ДО парсинга: понятные ошибки 400 вместо падения парсера
            fileManager.validateFileType(req.file.originalname);
            fileManager.validateFileSize(req.file);
            text = await fileManager.parseFile(req.file);
        } else {
            throw userError('Invalid input type');
        }

        if (!text || !String(text).trim()) throw userError('Empty input text');

        // Ограничиваем контекст перед отправкой в LLM (особенно для больших PDF)
        text = fileManager.truncateText(String(text).trim().replace(/\s+/g, ' '));

        const gameData = await breaker.call(async () => {
            if (gameType === 'wordsoup') {
                return wordSoupGenerator.generateWordSoup(text, inputType, totalWords, difficulty || 'normal');
            }
            if (gameType === 'rebus') {
                const result = await rebusGenerator.generateRebus(text, inputType, totalWords, difficulty || 'normal');
                return { ...result, gameType: 'rebus' };
            }
            const cwData = await crosswordGenerator.generateCrossword(text, inputType, totalWords, difficulty || 'normal');
            return {
                grid: cwData.crossword,
                words: cwData.words,
                layout: cwData.layout,
                crossword: cwData.crossword,
                gameType: 'crossword'
            };
        });

        res.json(gameData);
    } catch (error) {
        console.error('Gen Error:', error.message);

        let statusCode = error.status || 500;
        let userMessage = 'An error occurred while generating the game.';
        const errorMessage = error.message.toLowerCase();

        if (statusCode === 400) {
            userMessage = error.message;
        } else if (error.code === 'LIMIT_FILE_SIZE' ||
            errorMessage.includes('invalid') || errorMessage.includes('empty') ||
            errorMessage.includes('words count') || errorMessage.includes('file')) {
            statusCode = 400;
            userMessage = error.message;
        } else if (errorMessage.includes('api') || errorMessage.includes('нейросеть') || errorMessage.includes('openrouter')) {
            statusCode = 503;
            userMessage = 'AI service is temporarily unavailable. Please try again.';
        }

        res.status(statusCode).json({
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Логика пересчета сетки (когда юзер редактирует слова)
exports.recalculateLayout = async (req, res) => {
    try {
        const { gameType, words } = req.body || {};

        if (!gameType || !words || !Array.isArray(words) || words.length === 0) {
            return res.status(400).json({ error: 'Invalid data for recalculation' });
        }

        let recalculatedData;
        if (gameType === 'crossword') {
            recalculatedData = crosswordGenerator.buildCrosswordFromWords(words);
        } else if (gameType === 'wordsoup') {
            recalculatedData = wordSoupGenerator.buildSoupFromWords(words);
        } else {
            return res.status(400).json({ error: 'Invalid game type' });
        }

        res.json(recalculatedData);
    } catch (error) {
        console.error('Recalc Error:', error.message);
        const status = error.message.includes('Could not generate') ? 422 : 500;
        res.status(status).json({ error: error.message || 'Recalculation failed' });
    }
};

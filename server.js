// server.js

const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const port = 8080;
const publicPath = path.join(__dirname, 'public');

app.use(express.static(publicPath));
app.use(express.json());

const openrouterApiKey = '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'; // 🔑 Ваш ключ
const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

app.post('/generate-crossword', async (req, res) => {
    const text = req.body.text;
    const verticalWords = parseInt(req.body.verticalWords);
    const horizontalWords = parseInt(req.body.horizontalWords);
    const totalWords = verticalWords + horizontalWords;

    try {
        const prompt = `Из текста: "${text}" выделите ${totalWords} ключевых слов. Для каждого слова дайте краткое определение или вопрос, подходящее для кроссворда. Сформируйте ответ в формате JSON:
[
    {"word": "слово1", "clue": "определение1"},
    {"word": "слово2", "clue": "определение2"},
    ...
]
Не добавляйте никаких дополнительных символов или текста.`;

        const response = await axios.post(openrouterApiUrl, {
            model: "google/gemma-2-9b-it:free",
            messages: [
                { role: "user", content: prompt }
            ],
            top_p: 1,
            temperature: 0.7,
            frequency_penalty: 0,
            presence_penalty: 0,
            repetition_penalty: 1,
            top_k: 0
        }, {
            headers: {
                'Authorization': `Bearer ${openrouterApiKey}`,
                'Content-Type': 'application/json',
                // Добавьте другие заголовки, если необходимо
            }
        });

        // Логирование полного ответа от нейросети для отладки
        console.log('Ответ от нейросети:', response.data);

        // Извлечение содержимого сообщения
        const messageContent = response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content;
        console.log('Содержимое сообщения от нейросети:', messageContent);

        // Парсинг ответа от нейросети
        let wordsData;
        try {
            wordsData = JSON.parse(messageContent);
            console.log('Парсинг JSON успешен:', wordsData);
        } catch (parseError) {
            console.error('Ошибка при парсинге JSON:', parseError);
            console.error('Содержимое сообщения:', messageContent);
            return res.status(500).send('Неверный формат данных от нейросети');
        }

        // Генерация кроссворда (простейшая реализация)
        const crosswordGrid = generateCrossword(wordsData);

        // Для отладки: отправляем всё возвращённое от нейросети на клиент
        res.json({ 
            crossword: crosswordGrid, 
            words: wordsData,
            rawResponse: response.data, // Добавляем необработанный ответ для отладки на клиенте
            parsedWords: wordsData // Также возвращаем разобранные данные
        });
    } catch (error) {
        console.error('Ошибка API запроса:', error.response ? error.response.data : error.message);
        res.status(500).send('Ошибка API запроса');
    }
});

// Простейшая функция для генерации кроссворда
function generateCrossword(wordsData) {
    // Создаём пустую сетку 15x15
    const gridSize = 15;
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));

    // Простейшее размещение слов по горизонтали, начиная с первой строки
    wordsData.forEach((item, index) => {
        const row = index % gridSize;
        const col = 0;
        for (let i = 0; i < item.word.length; i++) {
            if (col + i < gridSize) {
                grid[row][col + i] = item.word[i].toUpperCase();
            }
        }
    });

    return grid;
}

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
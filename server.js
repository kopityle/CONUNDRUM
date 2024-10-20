// server
const express = require('express');
const path = require('path');
const axios = require('axios');
const clg = require('crossword-layout-generator');
const app = express();
const port = 8080;
const publicPath = path.join(__dirname, 'public');

app.use(express.static(publicPath));
app.use(express.json());

const openrouterApiKey = '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';
const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

app.post('/generate-crossword', async (req, res) => {
    const text = req.body.text;;
    const totalWords = parseInt(req.body.totalWords); 

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
                'Content-Type': 'application/json'
            }
        });

        console.log('Ответ от нейросети:', response.data);

        const messageContent = response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content;
        console.log('Содержимое сообщения от нейросети:', messageContent);

        let wordsData;
        try {
            wordsData = JSON.parse(messageContent);
            console.log('Парсинг JSON успешен:', wordsData);
        } catch (parseError) {
            console.error('Ошибка при парсинге JSON:', parseError);
            console.error('Содержимое сообщения:', messageContent);
            return res.status(500).send('Неверный формат данных от нейросети');
        }

        console.log("Words data:", wordsData);
        const layout = clg.generateLayout(wordsData.map(item => ({ answer: item.word, clue: item.clue })))
        console.log("Layout:", layout);
        console.log("Layout rows:", layout.rows);
        console.log("Layout cols:", layout.cols);
        const crosswordGrid = createGridFromLayout(layout, wordsData);
    
        res.json({
            crossword: crosswordGrid,
            words: wordsData,
            rawResponse: response.data,
            parsedWords: wordsData,
            layout: layout
        });
    } catch (error) {
        console.error('Ошибка API запроса:', error.response ? error.response.data : error.message);
        res.status(500).send('Ошибка API запроса');
    }
});

function createGridFromLayout(layout, wordsData) {
    const grid = Array.from({ length: layout.rows }, () => Array(layout.cols).fill(''));

    layout.result.forEach((wordData, index) => {
        const word = wordsData.find(item => item.word.toUpperCase() === wordData.answer.toUpperCase())?.word.toUpperCase();
        const clue = wordsData.find(item => item.word.toUpperCase() === wordData.answer.toUpperCase())?.clue; // Получаем clue


        if (word && wordData.orientation !== 'none') {
            let x = wordData.startx - 1;
            let y = wordData.starty - 1;

            for (let i = 0; i < word.length; i++) {
                if (wordData.orientation === 'across') {
                    grid[y][x + i] = word[i];  
                } else { 
                    grid[y + i][x] = word[i]; 
                }
            }
            wordData.clue = clue; 
        }
    });

    console.log("Generated grid:", grid); 
    return grid;
}

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
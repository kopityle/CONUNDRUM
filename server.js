const express = require('express');
const path = require('path');
const axios = require('axios');
const clg = require('crossword-layout-generator');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer'); //  Добавляем multer
require('dotenv').config();

const app = express();
const port = 8089;
const publicPath = path.join(__dirname, 'public');

// Настройка multer для сохранения файлов во временную папку
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Указываем путь к вашей новой временной папке
      cb(null, path.join(__dirname, 'temp-uploads')); 
    },
    filename: function (req, file, cb) {
      const uniqueFilename = uuidv4() + '.txt';
      cb(null, uniqueFilename);
    }
  });
  const upload = multer({ storage: storage });
console.log("Временная папка:", os.tmpdir());
app.use(express.static(publicPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

const openrouterApiKey = process.env.OPENROUTER_API_KEY; 
const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

// Используем upload.single('file-upload') для обработки загрузки одного файла
app.post('/generate-crossword', upload.single('file-upload'), async (req, res) => { 
  console.log('Получен запрос на генерацию кроссворда:', req.body.inputType);
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);

  const inputType = req.body.inputType;
  const totalWords = parseInt(req.body.totalWords);
  let text = '';

  if (inputType === 'text') {
    text = req.body.text;
  } else if (inputType === 'topic') {
    text = req.body.topic;
  } else if (inputType === 'file' && req.file) { //  Проверяем наличие файла
    try {
      // Читаем текст из загруженного файла
      text = fs.readFileSync(req.file.path, 'utf8');
      console.log('Текст из файла:', text);

      // Удаляем временный файл
      fs.unlinkSync(req.file.path);
      console.log('Временный файл удален:', req.file.path);
    } catch (err) {
      console.error('Ошибка при работе с файлом:', err);
      return res.status(500).send('Ошибка при работе с файлом.');
    }
  } else {
    return res.status(400).send('Неверный тип ввода.');
  }

  try {
    let prompt = '';
    if (inputType === 'topic') {
      prompt = `Составьте кроссворд из ${totalWords} слов на тему "${text}". 
      Для каждого слова дайте краткое определение или вопрос, подходящее для кроссворда. 
      Сформируйте ответ в формате JSON:
      [
        {"word": "слово1", "clue": "определение1"},
        {"word": "слово2", "clue": "определение2"},
        ...
      ]
      Не добавляйте никаких дополнительных символов или текста.`;
    } else { // inputType === 'file' or 'text'
      prompt = `Из текста: "${text}" выделите ${totalWords} ключевых слов. Для каждого слова дайте краткое определение или вопрос, подходящее для кроссворда. Сформируйте ответ в формате JSON:
      [
        {"word": "слово1", "clue": "определение1"},
        {"word": "слово2", "clue": "определение2"},
        ...
      ]
      Не добавляйте никаких дополнительных символов или текста.`;
    }

    const response = await axios.post(openrouterApiUrl, {
      model: "google/gemma-2-9b-it:free",
      messages: [{ role: "user", content: prompt }],
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

    const messageContent = response.data.choices && 
                            response.data.choices[0] && 
                            response.data.choices[0].message && 
                            response.data.choices[0].message.content;

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

    const layout = clg.generateLayout(wordsData.map(item => ({ answer: item.word, clue: item.clue })));
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
    const clue = wordsData.find(item => item.word.toUpperCase() === wordData.answer.toUpperCase())?.clue;

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
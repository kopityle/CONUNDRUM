const express = require('express');
const path = require('path');
const axios = require('axios');
const clg = require('crossword-layout-generator')
const multer = require('multer');
const DocxParser = require('docx-parser');
const pdf = require('pdf-parse');
const { SupabaseClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = 8086;
const publicPath = path.join(__dirname, 'public');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.static(publicPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Переменные окружения
const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;

app.post('/generate-crossword', upload.single('file-upload'), async (req, res) => {
  // console.log('Получен запрос на генерацию кроссворда:', req.body.inputType);
  // console.log('req.file:', req.file);
  // console.log('req.body:', req.body);

  const inputType = req.body.inputType;
  const totalWords = parseInt(req.body.totalWords);
  let text = '';

  if (inputType === 'text') {
    text = req.body.text;
    generateCrossword(text, inputType, totalWords, res);
  } else if (inputType === 'topic') {
    text = req.body.topic;
    generateCrossword(text, inputType, totalWords, res);
  } else if (inputType === 'file' && req.file) {
    try {
      const fileBuffer = req.file.buffer; // Файл в буфере
      const fileExtension = path.extname(req.file.originalname).toLowerCase();

      if (fileExtension === '.txt') {
        text = fileBuffer.toString('utf-8');
        // console.log('Текст из .txt файла:', text);
        generateCrossword(text, inputType, totalWords, res);
      } else if (fileExtension === '.docx') {
        // Обработка .docx
        DocxParser.parseDocx(fileBuffer, (data) => {
          text = data;
          generateCrossword(text, inputType, totalWords, res);
      });
      } else if (fileExtension === '.pdf') {
        pdf(fileBuffer).then((data) => {
          text = data.text;
          generateCrossword(text, inputType, totalWords, res);
      });
      } else {
        return res.status(400).send('Неподдерживаемый тип файла.');
      }
    } catch (err) {
      console.error('Ошибка при работе с файлом:', err);
      return res.status(500).send('Ошибка при работе с файлом.');
    }
  } else {
    return res.status(400).send('Неверный тип ввода.');
  }
});

//  Функция для обработки текста и генерации кроссворда
async function generateCrossword(text, inputType, totalWords, res) {
  
  try {
    // Очищаем текст, удаляя лишние пробелы и переносы строк
    text = text.trim().replace(/\s+/g, ' ');

    let prompt = '';
    if (inputType === 'topic') {
      prompt = `Generate real ${totalWords} words related to the topic "${text}". For each word, provide a concise, accurate, and unambiguous definition, question, or short description suitable for a word puzzle. Ensure the clue directly relates to the word and is in the same language as the input topic.If you are in doubt about the choice of language, then take Russian.
      Format the response as JSON:
      [
        {"word": "word1", "clue": "clue1"},
        {"word": "word2", "clue": "clue2"},
        ...
      ]
      Do not add anything outside the JSON structure. Ensure valid JSON.`;
    } else { // inputType === 'text' or 'file'
      prompt = `Extract ${totalWords} keywords from the given text: "${text}". For each word, create a concise, accurate, and unambiguous definition, question, or short description. The clue must clearly relate to the meaning of the word within the provided text and be in the same language as the input text.If you are in doubt about the choice of language, then take Russian
      Format the response as JSON:
      [
        {"word": "word1", "clue": "clue1"},
        {"word": "word2", "clue": "clue2"},
        ...
      ]
      Do not add anything outside the JSON structure. Ensure valid JSON.`;
    }
    // console.log('Промпт, который отправляется нейросети:', prompt); // Добавлен console.log

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

    let messageContent = response.data.choices?.[0]?.message?.content;

    if (!messageContent || messageContent.trim().length === 0) {
      console.error("Нейросеть не сгенерировала текст.");
      res.status(500).send({
          error: "Нейросеть не сгенерировала текст. Попробуйте изменить запрос или повторите попытку позже."
      });
      return;
  }

    // console.log('Содержимое сообщения от нейросети:', messageContent);

      let originalContent = messageContent.replace(/```json/g, '').trim();
      let cleanedMessageContent = originalContent;
      
      // 1. Удаление одинарных кавычек по краям
      if (cleanedMessageContent.startsWith("'") && cleanedMessageContent.endsWith("'")) {
          cleanedMessageContent = cleanedMessageContent.slice(1, -1);
          console.log("Удалены одинарные кавычки по краям.");
      }
      
      // 2. Удаление бэкслешей перед кавычками
      cleanedMessageContent = cleanedMessageContent.replace(/\\"/g, '"'); // <---  Улучшено:  удаляем всегда, не нужно проверять includes
      
      // 3. Удаление лишних точек
      cleanedMessageContent = cleanedMessageContent.replace(/\.{5,}/g, ''); // <--- Улучшено: удаляем всегда
      
      // 4. Находим начало и конец JSON (и обрезаем лишний текст)
      const startIndex = cleanedMessageContent.indexOf('[');
      const endIndex = cleanedMessageContent.lastIndexOf(']');
      
      if (startIndex !== -1 && endIndex !== -1 && (startIndex > 0 || endIndex < cleanedMessageContent.length - 1) ) {
          cleanedMessageContent = cleanedMessageContent.substring(startIndex, endIndex + 1);
          console.log("Обрезан лишний текст до или после JSON.");
      }
      
      // 5. Удаление непечатаемых символов, \r, \n и •
      cleanedMessageContent = cleanedMessageContent.replace(/[\u0000-\u001F\u007F-\u009F•\r\n]+/g, "");
      
      // 6. Удаление лишних пробелов (в конце!)
      cleanedMessageContent = cleanedMessageContent.trim();
      if (originalContent !== cleanedMessageContent) {
        console.log("Произведена очистка JSON. Исходный текст:", originalContent);
        console.log("Очищенный текст:", cleanedMessageContent);
      }
    // Удаляем запятую после последнего элемента массива
    cleanedMessageContent = cleanedMessageContent.replace(/,\s*\]$/, ']');
    console.log("Текст перед парсингом:", cleanedMessageContent);

    if (originalContent !== cleanedMessageContent) {
      console.log("Произведена очистка JSON. Исходный текст:", originalContent);
      console.log("Очищенный текст:", cleanedMessageContent);
  }

  console.log("Текст перед парсингом:", cleanedMessageContent);

  let wordsData;

  try {
      wordsData = JSON.parse(cleanedMessageContent);
  } catch (jsonError) {
      console.error("Ошибка парсинга JSON:", jsonError);
      console.error("Содержимое сообщения (после очистки):", cleanedMessageContent);

      res.status(500).send({
          error: "Нейросеть вернула невалидный JSON. Попробуйте повторить запрос.",
          originalMessage: messageContent,
          cleanedMessage: cleanedMessageContent
      });
      return;
  }

  // Проверка структуры данных после парсинга
  if (!Array.isArray(wordsData) || !wordsData.every(item => typeof item === 'object' && item.hasOwnProperty('word') && item.hasOwnProperty('clue'))) {
      console.error('Неверная структура данных от нейросети:', wordsData);
      return res.status(500).send('Неверная структура данных от нейросети');
  }

  // Генерация кроссворда
  const layout = clg.generateLayout(wordsData.map(item => ({
      answer: item.word,
      clue: item.clue
  })));
  const crosswordGrid = createGridFromLayout(layout, wordsData);

  res.json({
      crossword: crosswordGrid,
      words: wordsData,
      rawResponse: response.data,
      parsedWords: wordsData,
      layout: layout
  });

} catch (apiError) { // обработка ошибки API запроса
  console.error('Ошибка API запроса:', apiError.response ? apiError.response.data : apiError.message);
  res.status(500).send('Ошибка API запроса');
}
}
// Отправка данных в SupabaseClient
app.get('/supabase-config', (req, res) => {
  res.json({
    supabaseUrl,
    supabaseAnonKey,
  });
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
  // console.log("Generated grid:", grid);
  return grid;
}

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
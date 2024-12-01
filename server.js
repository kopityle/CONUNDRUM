const express = require('express');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const CrosswordGenerator = require('./classes/CrosswordGenerator');
const FileManager = require('./classes/FileManager');

const app = express();
const port = 8095;
const publicPath = path.join(__dirname, 'public');

// Environment variables
const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;

// Initialize our classes
const crosswordGenerator = new CrosswordGenerator(openrouterApiKey, openrouterApiUrl);
const fileManager = new FileManager();

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.static(publicPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/generate-crossword', upload.single('file-upload'), async (req, res) => {
    try {
        const inputType = req.body.inputType;
        const totalWords = parseInt(req.body.totalWords);
        let text = '';
        
        // Handle different input types
        if (inputType === 'text') {
            text = req.body.text;
        } else if (inputType === 'topic') {
            text = req.body.topic;
        } else if (inputType === 'file' && req.file) {
            // Validate and parse file
            fileManager.validateFileType(req.file.originalname);
            fileManager.validateFileSize(req.file);
            text = await fileManager.parseFile(req.file);
        } else {
            throw new Error('Invalid input type or missing file');
        }

        // Input validation
        if (!text || text.trim().length === 0) {
            throw new Error('Empty input text');
        }

        if (isNaN(totalWords) || totalWords < 1) {
            throw new Error('Invalid number of words');
        }
        
        // Generate crossword
        const crosswordData = await crosswordGenerator.generateCrossword(text, inputType, totalWords);
        
        // Validate crossword data
        if (!crosswordData || !crosswordData.crossword || !crosswordData.words || !crosswordData.layout) {
            throw new Error('Failed to generate valid crossword data');
        }

        res.json(crosswordData);

    } catch (error) {
        console.error('Error generating crossword:', error);
        
        // Send appropriate error response
        let statusCode = 500;
        let errorMessage = 'An error occurred while generating the crossword';

        if (error.message.includes('Invalid input') || error.message.includes('Empty input')) {
            statusCode = 400;
            errorMessage = error.message;
        } else if (error.message.includes('API') || error.message.includes('нейросеть')) {
            statusCode = 503;
            errorMessage = 'AI service temporarily unavailable. Please try again later.';
        }

        res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Supabase configuration endpoint
app.get('/supabase-config', (req, res) => {
    res.json({
        supabaseUrl,
        supabaseAnonKey,
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
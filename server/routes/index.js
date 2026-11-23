const express = require('express');
const router = express.Router();
const multer = require('multer');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileLimits');
const GameController = require('../controllers/GameController');

// Лимит совпадает с FileManager и с проверкой на клиенте (10 МБ)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
});

router.post('/generate-game', upload.single('file-upload'), GameController.generateGame);
router.post('/recalculate-game-layout', express.json(), GameController.recalculateLayout);
router.post('/track-activity', (req, res) => {
    res.status(200).json({ message: 'Activity tracked' });
});

// Multer может отклонить файл до контроллера — отдаём понятный JSON вместо HTML-ошибки
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: `File size exceeds limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. Please upload a smaller file.` });
        }
        return res.status(400).json({ error: `Invalid file upload: ${err.message}` });
    }
    next(err);
});

module.exports = router;

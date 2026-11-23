const express = require('express');
const router = express.Router();
const multer = require('multer');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileLimits');
const GameController = require('../controllers/GameController');
const AuthController = require('../controllers/AuthController');
const PuzzleController = require('../controllers/PuzzleController');
const { initDatabase } = require('../db/database');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

const db = initDatabase();
const { requireAuth, optionalAuth } = createAuthMiddleware({ db });

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

// Auth
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.get('/auth/me', requireAuth, AuthController.me);
router.post('/auth/profile', requireAuth, AuthController.profile);

// Teacher puzzles and analytics
router.get('/puzzles', requireAuth, PuzzleController.list);
router.post('/puzzles', optionalAuth, PuzzleController.create);
router.get('/puzzles/:id/analytics', requireAuth, PuzzleController.analytics);
router.get('/puzzles/:id', requireAuth, PuzzleController.get);
router.put('/puzzles/:id', requireAuth, PuzzleController.update);
router.delete('/puzzles/:id', requireAuth, PuzzleController.delete);

// Public play
router.get('/play/:shareId', PuzzleController.getPublicPuzzle);
router.post('/play/:shareId/attempt', PuzzleController.createAttempt);

// LTI generation config
router.get('/lti/config/:resourceLinkId', requireAuth, PuzzleController.getLtiConfig);
router.put('/lti/config/:resourceLinkId', requireAuth, PuzzleController.putLtiConfig);

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

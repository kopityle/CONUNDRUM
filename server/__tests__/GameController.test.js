const FileManager = require('../services/FileManager');
const CrosswordGenerator = require('../services/CrosswordGenerator');

const controller = require('../controllers/GameController');

function makeRes() {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    return res;
}

describe('GameController.generateGame', () => {
    let validateType, validateSize, parseFile, truncateText, generateCrossword;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        validateType = jest.spyOn(FileManager.prototype, 'validateFileType');
        validateSize = jest.spyOn(FileManager.prototype, 'validateFileSize');
        parseFile = jest.spyOn(FileManager.prototype, 'parseFile').mockResolvedValue('текст из файла');
        truncateText = jest.spyOn(FileManager.prototype, 'truncateText').mockReturnValue('обрезанный текст');
        generateCrossword = jest.spyOn(CrosswordGenerator.prototype, 'generateCrossword')
            .mockResolvedValue({ crossword: [[]], words: [], layout: {} });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function fileRequest(originalname, size) {
        return {
            ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
            body: { inputType: 'file', gameType: 'crossword', totalWords: '5' },
            file: { originalname, size, buffer: Buffer.from('data') }
        };
    }

    test('возвращает 400 для неподдерживаемого типа файла до парсинга', async () => {
        const req = fileRequest('malware.exe', 10);
        const res = makeRes();

        await controller.generateGame(req, res);

        expect(validateType).toHaveBeenCalledWith('malware.exe');
        expect(parseFile).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/Unsupported file type/);
    });

    test('возвращает 400 для файла больше 10 МБ до парсинга', async () => {
        const req = fileRequest('huge.pdf', 10 * 1024 * 1024 + 1);
        const res = makeRes();

        await controller.generateGame(req, res);

        expect(validateSize).toHaveBeenCalled();
        expect(parseFile).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/10MB/);
    });

    test('проверяет файл, обрезает текст и передаёт его в генератор', async () => {
        const req = fileRequest('notes.pdf', 1024);
        const res = makeRes();

        await controller.generateGame(req, res);

        expect(validateType).toHaveBeenCalledWith('notes.pdf');
        expect(validateSize).toHaveBeenCalled();
        expect(validateType.mock.invocationCallOrder[0]).toBeLessThan(parseFile.mock.invocationCallOrder[0]);
        expect(truncateText).toHaveBeenCalledWith('текст из файла');
        expect(generateCrossword).toHaveBeenCalledWith('обрезанный текст', 'file', 5, 'normal');
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ gameType: 'crossword' }));
    });
});

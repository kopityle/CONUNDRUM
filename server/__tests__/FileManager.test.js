jest.mock('mammoth', () => ({
    extractRawText: jest.fn()
}));

const mammoth = require('mammoth');
const FileManager = require('../services/FileManager');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileLimits');

describe('FileManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mammoth.extractRawText.mockResolvedValue({ value: 'текст из docx' });
    });

    describe('validateFileType / validateFileSize', () => {
        test('поддерживает txt, docx, pdf и регистронезависимые расширения', () => {
            const manager = new FileManager();
            expect(manager.validateFileType('notes.TXT')).toBe('.txt');
            expect(manager.validateFileType('book.docx')).toBe('.docx');
            expect(manager.validateFileType('scan.PDF')).toBe('.pdf');
        });

        test('отвергает неподдерживаемые и пустые имена файлов', () => {
            const manager = new FileManager();
            expect(() => manager.validateFileType('virus.exe')).toThrow(/Unsupported file type/);
            expect(() => manager.validateFileType('')).toThrow(/Unsupported file type/);
            expect(() => manager.validateFileType(null)).toThrow(/Unsupported file type/);
        });

        test('пропускает файл ровно с лимитом и отвергает больше лимита', () => {
            const manager = new FileManager();
            expect(() => manager.validateFileSize({ size: MAX_FILE_SIZE_BYTES })).not.toThrow();
            expect(() => manager.validateFileSize({ size: MAX_FILE_SIZE_BYTES + 1 }))
                .toThrow(/exceeds limit of 10MB/);
            expect(() => manager.validateFileSize({})).toThrow(/size is unknown/);
        });
    });

    describe('truncateText', () => {
        test('короткий текст возвращает без изменений', () => {
            const manager = new FileManager();
            expect(manager.truncateText('короткий текст', 100)).toBe('короткий текст');
        });

        test('длинный текст обрезается с пометкой', () => {
            const manager = new FileManager();
            const result = manager.truncateText('слово '.repeat(100), 50);
            expect(result).toContain('[Текст обрезан до 50 символов]');
            expect(result.length).toBeLessThan(50 + '[Текст обрезан до 50 символов]'.length + 1);
        });

        test('не является строкой — возвращает пустую строку', () => {
            expect(new FileManager().truncateText(undefined)).toBe('');
        });
    });

    describe('parseFile', () => {
        test('парсит txt', async () => {
            const manager = new FileManager();
            const text = await manager.parseFile({
                originalname: 'a.txt',
                size: 12,
                buffer: Buffer.from('привет мир')
            });
            expect(text).toBe('привет мир');
        });

        test('валидирует тип и размер ДО вызова парсера', async () => {
            const manager = new FileManager();
            const parseDocx = jest.spyOn(manager, 'parseDocx').mockResolvedValue('docx');
            const parsePdf = jest.spyOn(manager, 'parsePdf').mockResolvedValue('pdf');

            await expect(manager.parseFile({
                originalname: 'bad.exe', size: 10, buffer: Buffer.from('x')
            })).rejects.toThrow(/Unsupported file type/);

            await expect(manager.parseFile({
                originalname: 'big.pdf', size: MAX_FILE_SIZE_BYTES + 1, buffer: Buffer.from('x')
            })).rejects.toThrow(/exceeds limit/);

            expect(parseDocx).not.toHaveBeenCalled();
            expect(parsePdf).not.toHaveBeenCalled();
        });

        test('парсит docx через mammoth', async () => {
            const manager = new FileManager();
            const buffer = Buffer.from('fake docx');
            const result = await manager.parseFile({ originalname: 'a.docx', size: 9, buffer });
            expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
            expect(result).toBe('текст из docx');
        });

        test('парсит pdf через внедрённый unpdf-парсер', async () => {
            const extractPdfText = jest.fn().mockResolvedValue('текст из pdf\nвторая страница');
            const manager = new FileManager({ extractPdfText });
            const buffer = Buffer.from('%PDF-1.4');
            const result = await manager.parseFile({ originalname: 'a.pdf', size: 8, buffer });
            expect(extractPdfText).toHaveBeenCalledWith(buffer);
            expect(result).toBe('текст из pdf\nвторая страница');
        });

        test('оборачивает ошибки парсера в понятное сообщение', async () => {
            const manager = new FileManager({ extractPdfText: jest.fn().mockRejectedValue(new Error('broken pdf')) });
            await expect(manager.parsePdf(Buffer.from('x'))).rejects.toThrow(/Failed to parse PDF file: broken pdf/);
        });
    });
});

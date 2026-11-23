const path = require('path');
const mammoth = require('mammoth');
const { MB, MAX_FILE_SIZE_BYTES, MAX_LLM_TEXT_CHARS } = require('../utils/fileLimits');

/**
 * unpdf — ESM-модуль, поэтому загружаем его динамически.
 * Функцию можно подменить в тестах через конструктор.
 */
async function defaultExtractPdfText(buffer) {
    const { extractText } = await import('unpdf');
    const result = await extractText(new Uint8Array(buffer));
    const text = Array.isArray(result?.text) ? result.text.join('\n') : result?.text;
    return typeof text === 'string' ? text : '';
}

/**
 * Валидация, парсинг и подготовка загруженных файлов (txt, docx, pdf).
 */
class FileManager {
    constructor(options = {}) {
        this.supportedTypes = ['.txt', '.docx', '.pdf'];
        this.maxFileSize = options.maxFileSize ?? MAX_FILE_SIZE_BYTES;
        this.maxTextLength = options.maxTextLength ?? MAX_LLM_TEXT_CHARS;
        this.extractPdfText = options.extractPdfText ?? defaultExtractPdfText;
    }

    validateFileType(filename) {
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error(`Unsupported file type. Supported types: ${this.supportedTypes.join(', ')}`);
        }
        const extension = path.extname(filename).toLowerCase();
        if (!this.supportedTypes.includes(extension)) {
            throw new Error(`Unsupported file type. Supported types: ${this.supportedTypes.join(', ')}`);
        }
        return extension;
    }

    validateFileSize(file) {
        if (!file || typeof file.size !== 'number' || Number.isNaN(file.size)) {
            throw new Error('Invalid file: file size is unknown');
        }
        if (file.size > this.maxFileSize) {
            throw new Error(
                `File size exceeds limit of ${this.maxFileSize / MB}MB. Please upload a smaller file.`
            );
        }
    }

    /**
     * Безопасная обрезка текста перед отправкой в LLM: по границе слова,
     * с явной пометкой, что текст был урезан.
     */
    truncateText(text, maxLength = this.maxTextLength) {
        if (typeof text !== 'string') return '';
        if (text.length <= maxLength) return text;

        const slice = text.slice(0, maxLength);
        const lastSpace = slice.lastIndexOf(' ');
        const cutoff = lastSpace > maxLength * 0.8 ? slice.slice(0, lastSpace) : slice;
        return `${cutoff.trimEnd()}\n[Текст обрезан до ${maxLength} символов]`;
    }

    async parseFile(file) {
        if (!file) throw new Error('Invalid file: no file provided');

        // Валидация до парсинга: не кормим парсеры неподдерживаемыми/слишком большими файлами
        this.validateFileType(file.originalname);
        this.validateFileSize(file);

        const extension = path.extname(file.originalname).toLowerCase();

        try {
            switch (extension) {
                case '.txt':
                    return file.buffer.toString('utf-8');
                case '.docx':
                    return await this.parseDocx(file.buffer);
                case '.pdf':
                    return await this.parsePdf(file.buffer);
                default:
                    // validateFileType выше уже отсек такие файлы
                    throw new Error('Unsupported file type');
            }
        } catch (error) {
            throw new Error(`Error parsing file: ${error.message}`);
        }
    }

    async parseDocx(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value || '';
        } catch (error) {
            throw new Error(`Failed to parse DOCX file: ${error.message}`);
        }
    }

    async parsePdf(buffer) {
        try {
            return await this.extractPdfText(buffer);
        } catch (error) {
            throw new Error(`Failed to parse PDF file: ${error.message}`);
        }
    }
}

module.exports = FileManager;

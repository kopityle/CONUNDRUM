jest.mock('qrcode', () => ({
    toBuffer: jest.fn()
}));

const QRCode = require('qrcode');
const { generateGamePdf } = require('../services/pdfGeneratorService');

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngBuffer() {
    return Buffer.from(TINY_PNG_BASE64, 'base64');
}

function pageCount(buffer) {
    return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

function crosswordData() {
    return {
        gameType: 'crossword',
        name: 'Тестовый кроссворд',
        grid: [
            ['К', 'О', 'Т', ''],
            ['А', '', 'О', ''],
            ['Ш', 'А', 'Р', '']
        ],
        words: [
            {
                word: 'КОТ', answer: 'КОТ', clue: 'Домашнее животное',
                startx: 1, starty: 1, orientation: 'across', position: 1
            },
            {
                word: 'ШАР', answer: 'ШАР', clue: 'Круглый предмет',
                startx: 1, starty: 3, orientation: 'across', position: 4
            }
        ],
        layout: {
            result: [
                {
                    word: 'КОТ', answer: 'КОТ', clue: 'Домашнее животное',
                    startx: 1, starty: 1, orientation: 'across', position: 1
                }
            ]
        }
    };
}

function wordSoupData() {
    return {
        gameType: 'wordsoup',
        name: 'Тестовый филворд',
        grid: [
            ['К', 'О', 'Т'],
            ['Д', 'О', 'М'],
            ['Ш', 'А', 'Р']
        ],
        words: [
            { word: 'КОТ', clue: 'Домашнее животное', startx: 1, starty: 1 },
            { word: 'ДОМ', clue: 'Жилище', row: 2, col: 1 }
        ]
    };
}

function rebusData({ useDataUrl = false, broken = false } = {}) {
    return {
        gameType: 'rebus',
        name: 'Тестовые ребусы',
        rebuses: [{
            word: 'ПОДВАЛ',
            parts: [
                { type: 'text', content: 'ПОД' },
                {
                    type: 'image',
                    description: 'волна',
                    iconQuery: 'wave',
                    subtract_start: 2,
                    subtract_end: 1,
                    imageUrl: useDataUrl
                        ? `data:image/png;base64,${TINY_PNG_BASE64}`
                        : (broken ? 'https://icons.test/missing.png' : 'https://icons.test/wave.png')
                }
            ]
        }]
    };
}

/**
 * Minimal PDFKit substitute: it records every text call and tracks page
 * boundaries, which lets the tests assert content that PDFKit encodes with
 * the embedded Cyrillic font (and therefore cannot be grepped in raw bytes).
 */
function createMockPdfDocument(registry) {
    return class MockPDFDocument {
        constructor() {
            this.page = { width: 595.28, height: 841.89 };
            this.x = 48;
            this.y = 48;
            this._fontSize = 12;
            this._listeners = {};
        }

        on(event, handler) {
            (this._listeners[event] = this._listeners[event] || []).push(handler);
            if (event === 'end') {
                setImmediate(() => this.emit('end'));
            }
            return this;
        }

        emit(event, ...args) {
            (this._listeners[event] || []).forEach((handler) => handler(...args));
            return this;
        }

        registerFont() { return this; }
        font() { return this; }
        fontSize(size) { this._fontSize = size; return this; }
        fillColor() { return this; }
        strokeColor() { return this; }
        lineWidth() { return this; }
        save() { return this; }
        restore() { return this; }
        rect() { return this; }
        stroke() { return this; }
        moveTo() { return this; }
        lineTo() { return this; }
        dash() { return this; }
        undash() { return this; }
        image(buffer, x, y, options) {
            registry.images.push({ buffer, x, y, options });
            return this;
        }
        widthOfString(value) { return String(value).length * this._fontSize * 0.6; }
        heightOfString() { return this._fontSize * 1.2; }
        text(value, x, y, options) {
            if (x === undefined) {
                registry.pages[registry.pages.length - 1].push(String(value));
                return this;
            }
            const entry = { value: String(value), x, y, options };
            registry.texts.push(entry);
            registry.pages[registry.pages.length - 1].push(entry.value);
            return this;
        }
        addPage() {
            registry.addPageCalls += 1;
            registry.pages.push([]);
            return this;
        }
        end() { return this; }
    };
}

async function generateWithMockedDoc(gameData) {
    const registry = { texts: [], pages: [[]], images: [], addPageCalls: 0 };
    let service;
    jest.isolateModules(() => {
        jest.doMock('pdfkit', () => createMockPdfDocument(registry));
        service = require('../services/pdfGeneratorService');
    });
    try {
        await service.generateGamePdf(gameData);
    } finally {
        jest.dontMock('pdfkit');
    }
    return registry;
}

describe('generateGamePdf', () => {
    const originalClientUrl = process.env.CLIENT_URL;
    const originalFetch = global.fetch;

    beforeEach(() => {
        QRCode.toBuffer.mockReset();
        QRCode.toBuffer.mockResolvedValue(pngBuffer());
        delete process.env.CLIENT_URL;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalClientUrl === undefined) {
            delete process.env.CLIENT_URL;
        } else {
            process.env.CLIENT_URL = originalClientUrl;
        }
        jest.dontMock('pdfkit');
    });

    test('кроссворд: возвращает 2-страничный PDF с листом ученика и ключами', async () => {
        const buffer = await generateGamePdf(crosswordData());

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
        expect(pageCount(buffer)).toBe(2);
        expect(QRCode.toBuffer).not.toHaveBeenCalled();
    });

    test('филворд: возвращает 2-страничный PDF без ошибок', async () => {
        const buffer = await generateGamePdf(wordSoupData());

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
        expect(pageCount(buffer)).toBe(2);
    });

    test('ребус: загружает изображение, не требует QR и остаётся 2-страничным', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: jest.fn().mockResolvedValue(
                Uint8Array.from(pngBuffer()).buffer
            )
        });

        const buffer = await generateGamePdf(rebusData());

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(pageCount(buffer)).toBe(2);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://icons.test/wave.png',
            expect.any(Object)
        );
        expect(QRCode.toBuffer).not.toHaveBeenCalled();
    });

    test('ребус: data URL и ошибка загрузки изображения не прерывают генерацию', async () => {
        const fromDataUrl = await generateGamePdf(rebusData({ useDataUrl: true }));
        expect(pageCount(fromDataUrl)).toBe(2);

        global.fetch = jest.fn().mockRejectedValue(new Error('network is down'));
        const fromFailedFetch = await generateGamePdf(rebusData({ broken: true }));
        expect(pageCount(fromFailedFetch)).toBe(2);
    });

    test('QR: использует shareId и CLIENT_URL, добавляет подпись на первую страницу', async () => {
        process.env.CLIENT_URL = 'https://app.test';

        const buffer = await generateGamePdf({ ...crosswordData(), shareId: 'abc123' });

        expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
        expect(QRCode.toBuffer).toHaveBeenCalledWith(
            'https://app.test/play/abc123',
            { type: 'png', width: 96, margin: 1 }
        );
        expect(pageCount(buffer)).toBe(2);
    });

    test('QR: явный shareUrl имеет приоритет над shareId', async () => {
        await generateGamePdf({
            ...wordSoupData(),
            shareId: 'ignored',
            shareUrl: 'https://custom.test/puzzle/1'
        });

        expect(QRCode.toBuffer).toHaveBeenCalledWith(
            'https://custom.test/puzzle/1',
            { type: 'png', width: 96, margin: 1 }
        );
    });

    test('QR: share_id из данных тоже работает', async () => {
        await generateGamePdf({ ...crosswordData(), share_id: 'from-data' });

        expect(QRCode.toBuffer).toHaveBeenCalledWith(
            '/play/from-data',
            { type: 'png', width: 96, margin: 1 }
        );
    });

    test('содержимое кроссворда: заголовки, задание ученика и ключи преподавателя', async () => {
        const registry = await generateWithMockedDoc(crosswordData());
        const studentPage = registry.pages[0].join(' ');
        const teacherPage = registry.pages[1].join(' ');

        expect(registry.addPageCalls).toBe(1);
        expect(studentPage).toContain('Кроссворд: Тестовый кроссворд');
        expect(registry.texts.map((item) => item.value)).toContain('Ученик: ____________________ Класс: ________.');
        expect(studentPage).toContain('По горизонтали:');
        expect(studentPage).toContain('По вертикали:');
        expect(teacherPage).toContain('Ключи и ответы: Тестовый кроссворд (Для преподавателя)');
        expect(teacherPage).toContain('Быстрая проверка:');
        expect(teacherPage).toContain('КОТ — Домашнее животное');
    });

    test('содержимое филворда: подсказки, сетка и найденные слова с координатами', async () => {
        const registry = await generateWithMockedDoc(wordSoupData());

        expect(registry.pages[0].join(' ')).toContain('Филворд: Тестовый филворд');
        expect(registry.pages[0].join(' ')).toContain('Подсказки:');
        expect(registry.pages[1].join(' ')).toContain('Ключи и ответы: Тестовый филворд');
        expect(registry.pages[1].join(' ')).toContain('Найденные слова:');
        expect(registry.pages[1].join(' ')).toContain('р. 1, ст. 1');
    });

    test('содержимое ребуса: запятые вокруг картинки, ответ только на странице ключей', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: jest.fn().mockResolvedValue(
                Uint8Array.from(pngBuffer()).buffer
            )
        });

        const registry = await generateWithMockedDoc(rebusData());
        const studentPage = registry.pages[0].join(' ');
        const teacherPage = registry.pages[1].join(' ');

        expect(registry.addPageCalls).toBe(1);
        expect(registry.images.length).toBeGreaterThan(0);
        expect(studentPage).toContain('ПОД');
        expect(studentPage).toContain(',,');
        expect(studentPage).toContain(',');
        expect(studentPage).not.toContain('ПОДВАЛ');
        expect(studentPage).toContain('Подсказки:');
        expect(teacherPage).toContain('ПОДВАЛ');
        expect(teacherPage).toContain('разгадка');
    });

    test(' QR-подпись рисуется на странице ученика', async () => {
        process.env.CLIENT_URL = 'https://app.test';
        const registry = await generateWithMockedDoc({ ...crosswordData(), shareId: 'abc123' });

        expect(registry.images.length).toBeGreaterThan(0);
        expect(registry.pages[0]).toContain('Решить онлайн');
    });
});

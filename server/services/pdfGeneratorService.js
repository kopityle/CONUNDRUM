const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const FONT_NAME = 'Roboto';
const FONT_PATH = path.join(__dirname, '..', 'fonts', 'RobotoMono.ttf');

// A4: 595.28 x 841.89 pt. Margins are deliberately fixed so that all content
// (including text and grids) is placed explicitly and no implicit page break
// can ever occur: every doc.text() call below receives a definite `height`.
const PAGE_MARGIN = 48;
const GRID_TOP = 140;
const GRID_MAX_HEIGHT = 290;
const REBUS_TOP = 140;
const REBUS_MAX_HEIGHT = 370;
const QR_SIZE = 96;
const QR_RESERVED_HEIGHT = QR_SIZE + 36;
const IMAGE_TIMEOUT_MS = 4000;

const GAME_TYPE_LABELS = {
    crossword: 'Кроссворд',
    wordsoup: 'Филворд',
    rebus: 'Ребусы'
};

/**
 * Builds the share URL used for the QR code.
 * @param {Object} gameData
 * @returns {string}
 */
function buildShareUrl(gameData) {
    if (gameData.shareUrl) return String(gameData.shareUrl);
    const shareId = gameData.shareId || gameData.share_id;
    if (!shareId) return '';
    return `${process.env.CLIENT_URL || ''}/play/${shareId}`;
}

/**
 * Normalizes a possibly ragged 2D grid into an array of string arrays.
 * @param {*} grid
 * @returns {string[][]}
 */
function normalizeGrid(grid) {
    if (!Array.isArray(grid)) return [];
    return grid.map((row) => Array.isArray(row)
        ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
        : []);
}

/**
 * Merges `words` and `layout.result` (both shapes are produced by the generators).
 * @param {Object} gameData
 * @returns {Array<Object>}
 */
function collectWords(gameData) {
    const sources = [
        ...(Array.isArray(gameData.words) ? gameData.words : []),
        ...(Array.isArray(gameData.layout && gameData.layout.result) ? gameData.layout.result : [])
    ];

    const seen = new Set();
    return sources.filter((word) => {
        if (!word || typeof word !== 'object') return false;
        const answer = String(word.word || word.answer || '').toLocaleLowerCase();
        const key = `${answer}|${word.startx}|${word.starty}|${word.orientation}|${word.position}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isAcross(word) {
    return String(word.orientation || '').toLowerCase() === 'across';
}

function isDown(word) {
    return String(word.orientation || '').toLowerCase() === 'down';
}

/**
 * The generators use 1-based startx/starty; tolerate 0 as "first cell" too.
 * @param {*} value
 * @returns {number} zero-based index, or -1 when unusable
 */
function toCellIndex(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return -1;
    if (number > 0) return number - 1;
    if (number === 0) return 0;
    return -1;
}

/**
 * Cell -> list of word numbers starting in that cell (crossword numbering).
 * @param {Array<Object>} words
 * @returns {Map<string, string[]>}
 */
function buildStartNumbers(words) {
    const numbers = new Map();
    words.forEach((word) => {
        if (!isAcross(word) && !isDown(word)) return;
        if (word.position === undefined || word.position === null || word.position === '') return;
        const row = toCellIndex(word.starty);
        const col = toCellIndex(word.startx);
        if (row < 0 || col < 0) return;
        const key = `${row}:${col}`;
        const list = numbers.get(key) || [];
        const label = String(word.position);
        if (!list.includes(label)) list.push(label);
        numbers.set(key, list);
    });
    return numbers;
}

/**
 * Sets font/size for measuring and returns the width of a string in points.
 * @param {PDFKit.PDFDocument} doc
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
function measureText(doc, text, fontSize) {
    doc.font(FONT_NAME).fontSize(fontSize);
    return doc.widthOfString(String(text === null || text === undefined ? '' : text));
}

/**
 * Splits text into lines that fit `maxWidth`, using the embedded font metrics.
 * @param {PDFKit.PDFDocument} doc
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapLines(doc, text, maxWidth, fontSize = 10) {
    const width = Math.max(1, maxWidth);
    const lines = [];
    const paragraphs = String(text === null || text === undefined ? '' : text).split(/\n/);

    paragraphs.forEach((paragraph) => {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push('');
            return;
        }

        let current = '';
        words.forEach((word) => {
            let chunks = [word];
            if (measureText(doc, word, fontSize) > width) {
                // A single word longer than the line: break it by characters.
                chunks = [];
                let chunk = '';
                for (const char of word) {
                    if (chunk && measureText(doc, chunk + char, fontSize) > width) {
                        chunks.push(chunk);
                        chunk = char;
                    } else {
                        chunk += char;
                    }
                }
                if (chunk) chunks.push(chunk);
            }

            chunks.forEach((chunk, chunkIndex) => {
                const candidate = current ? `${current} ${chunk}` : chunk;
                if (current && measureText(doc, candidate, fontSize) > width) {
                    lines.push(current);
                    current = chunk;
                } else {
                    current = candidate;
                }
                if (chunkIndex < chunks.length - 1) {
                    lines.push(current);
                    current = '';
                }
            });
        });
        if (current) lines.push(current);
    });

    return lines;
}

/**
 * Keeps at most `maxLines` lines, appending an ellipsis to the last one.
 * @param {PDFKit.PDFDocument} doc
 * @param {string[]} lines
 * @param {number} maxWidth
 * @param {number} maxLines
 * @returns {string[]}
 */
function truncateLines(doc, lines, maxWidth, maxLines, fontSize = 10) {
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length && measureText(doc, `${last}…`, fontSize) > maxWidth) {
        last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last}…`;
    return kept;
}

/**
 * Single text line with an explicit height: PDFKit never adds a page when
 * `height` is supplied, so this is safe on both pages.
 */
function writeLine(doc, text, x, y, options = {}) {
    const {
        width = 100,
        height = 14,
        fontSize = 10,
        align = 'left',
        color = '#000000',
        underline = false
    } = options;

    doc.font(FONT_NAME)
        .fontSize(fontSize)
        .fillColor(color)
        .text(String(text === null || text === undefined ? '' : text), x, y, {
            width,
            height,
            align,
            ellipsis: true,
            lineBreak: false,
            underline
        });
}

/**
 * Wrapped, bounded block of text. Returns the Y coordinate just below the block.
 */
function writeBlock(doc, text, x, y, maxWidth, maxHeight, options = {}) {
    const fontSize = options.fontSize || 10;
    const align = options.align || 'left';
    const color = options.color || '#000000';
    const lineHeight = Math.max(10, fontSize * 1.35);
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    doc.font(FONT_NAME).fontSize(fontSize);
    const lines = truncateLines(doc, wrapLines(doc, text, maxWidth, fontSize), maxWidth, maxLines, fontSize);

    let cursorY = y;
    lines.forEach((line) => {
        writeLine(doc, line, x, cursorY, {
            width: maxWidth,
            height: lineHeight + 2,
            fontSize,
            align,
            color
        });
        cursorY += lineHeight;
    });
    return cursorY;
}

function truncateToWidth(doc, text, maxWidth, fontSize) {
    let value = String(text === null || text === undefined ? '' : text);
    if (measureText(doc, value, fontSize) <= maxWidth) return value;
    while (value.length && measureText(doc, `${value}…`, fontSize) > maxWidth) {
        value = value.slice(0, -1);
    }
    return `${value}…`;
}

/**
 * Computes a cell size that fits both the available width and height, then
 * centers the grid inside the content area.
 */
function computeGridLayout(doc, grid, top, maxHeight) {
    const rows = grid.length;
    const cols = rows ? Math.max(...grid.map((row) => row.length)) : 0;
    const contentWidth = doc.page.width - 2 * PAGE_MARGIN;
    const cellSize = Math.max(4, Math.min(
        24,
        Math.floor((contentWidth - 8) / Math.max(1, cols)),
        Math.floor((maxHeight - 8) / Math.max(1, rows))
    ));
    const gridWidth = cols * cellSize;
    const gridHeight = rows * cellSize;
    return {
        rows,
        cols,
        cellSize,
        startX: PAGE_MARGIN + Math.max(0, (contentWidth - gridWidth) / 2),
        startY: top,
        gridWidth,
        gridHeight,
        bottom: top + gridHeight
    };
}

/**
 * Draws a grid. For a crossword `showLetters=false` skips black cells; a word
 * soup (allCells=true) draws every cell. Page 1 passes showLetters=false.
 * @returns {Object} grid layout info
 */
function drawGrid(doc, grid, top, maxHeight, options = {}) {
    const layout = computeGridLayout(doc, grid, top, maxHeight);
    const { cellSize, startX, startY } = layout;
    const allCells = Boolean(options.allCells);
    const showLetters = Boolean(options.showLetters);
    const numbers = options.numbers || new Map();
    const numberFontSize = Math.max(5, Math.min(8, cellSize * 0.36));
    const letterFontSize = Math.max(7, Math.min(12, cellSize * 0.56));

    doc.save();
    doc.lineWidth(0.6).strokeColor('#333333');
    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
            const value = grid[row][col] || '';
            if (!allCells && String(value).trim() === '') continue;
            const x = startX + col * cellSize;
            const y = startY + row * cellSize;
            doc.rect(x, y, cellSize, cellSize).stroke();

            if (showLetters && value) {
                writeLine(doc, value, x, y + Math.max(1, (cellSize - letterFontSize) / 2), {
                    width: cellSize,
                    height: cellSize,
                    fontSize: letterFontSize,
                    align: 'center'
                });
            } else if (!showLetters) {
                const list = numbers.get(`${row}:${col}`);
                if (list && list.length) {
                    writeLine(doc, list.join('/'), x + 1.5, y + 1, {
                        width: cellSize - 2,
                        height: Math.max(7, numberFontSize + 2),
                        fontSize: numberFontSize
                    });
                }
            }
        }
    }
    doc.restore();
    return layout;
}

/**
 * Loads an image buffer from an http(s) URL or a base64 data URL.
 * Never throws: a missing icon only degrades to an empty frame in the PDF.
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
async function loadImage(url) {
    if (typeof url !== 'string' || !url) return null;
    try {
        if (/^data:image\/[^;,]+;base64,/i.test(url)) {
            const buffer = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
            return buffer.length ? buffer : null;
        }
        if (/^https?:\/\//i.test(url)) {
            const options = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                ? { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) }
                : {};
            const response = await fetch(url, options);
            if (!response || response.ok === false) return null;
            const buffer = Buffer.from(await response.arrayBuffer());
            return buffer.length ? buffer : null;
        }
    } catch (error) {
        return null;
    }
    return null;
}

/**
 * Pre-loads every rebus image once, before the PDF stream is created, so the
 * drawing pass stays synchronous and `doc.end()` is called exactly once.
 * @param {Object} gameData
 * @returns {Promise<Map<string, Buffer|null>>}
 */
async function preloadRebusImages(gameData) {
    const cache = new Map();
    if (gameData.gameType !== 'rebus') return cache;
    const rebuses = Array.isArray(gameData.rebuses) ? gameData.rebuses : [];
    for (const rebus of rebuses) {
        const parts = rebus && Array.isArray(rebus.parts) ? rebus.parts : [];
        for (const part of parts) {
            if (!part || part.type !== 'image') continue;
            const url = part.imageUrl;
            if (!url || cache.has(url)) continue;
            cache.set(url, await loadImage(url));
        }
    }
    return cache;
}

function nonNegativeCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.min(20, Math.floor(number)) : 0;
}

/**
 * Human-readable decryption logic for a rebus.
 * @param {Object} rebus
 * @param {boolean} includeAnswer - page 2 shows the answer, page 1 does not
 * @returns {string}
 */
function deriveRebusLogic(rebus, includeAnswer = true) {
    const explicit = rebus.clue || rebus.description || rebus.explanation;
    if (explicit) return String(explicit);

    const parts = Array.isArray(rebus.parts) ? rebus.parts : [];
    const pieces = parts.map((part) => {
        if (!part) return '';
        if (part.type === 'text') return String(part.content === null || part.content === undefined ? '' : part.content).trim();
        if (part.type !== 'image') return '';
        const label = String(part.description || part.iconQuery || 'изображение').trim();
        const left = nonNegativeCount(part.subtract_start);
        const right = nonNegativeCount(part.subtract_end);
        const cuts = `${left ? ` −${left} слева` : ''}${right ? ` −${right} справа` : ''}`;
        return `[${label}]${cuts}`;
    }).filter(Boolean);

    const expression = pieces.join(' + ');
    return includeAnswer ? `${expression} → ${rebus.word || ''}` : `${expression} → ?`;
}

function rebusHint(rebus) {
    return deriveRebusLogic(rebus, false);
}

function wordHint(word) {
    return String(word.clue || word.definition || word.description || word.explanation || '—');
}

function drawSeparator(doc, y, rightEdge) {
    doc.save()
        .lineWidth(0.6)
        .strokeColor('#888888')
        .moveTo(PAGE_MARGIN, y)
        .lineTo(rightEdge, y)
        .stroke()
        .restore();
}

/**
 * Compact QR code (with caption) in the bottom-right corner, inside margins.
 */
function drawQrCode(doc, qrBuffer) {
    const x = doc.page.width - PAGE_MARGIN - QR_SIZE;
    const y = doc.page.height - PAGE_MARGIN - QR_SIZE - 18;
    try {
        doc.image(qrBuffer, x, y, {
            fit: [QR_SIZE, QR_SIZE],
            align: 'center',
            valign: 'center'
        });
        writeLine(doc, 'Решить онлайн', x, y + QR_SIZE + 2, {
            width: QR_SIZE,
            height: 14,
            fontSize: 8,
            align: 'center',
            color: '#444444'
        });
    } catch (error) {
        // A broken QR image must never break PDF generation.
    }
}

function drawMissingImageFrame(doc, x, y, size, caption) {
    doc.save();
    doc.lineWidth(0.6).strokeColor('#999999').dash(2, { space: 2 });
    doc.rect(x, y, size, size).stroke();
    doc.undash();
    doc.restore();
    doc.font(FONT_NAME).fontSize(7);
    const label = truncateToWidth(doc, caption || 'изображение', size - 4, 7);
    writeLine(doc, label, x + 2, y + Math.max(2, (size - 9) / 2), {
        width: size - 4,
        height: 11,
        fontSize: 7,
        align: 'center',
        color: '#777777'
    });
}

/**
 * Draws one full rebus card: number, text parts, comma runs and image parts
 * (or a labelled empty frame when an icon could not be loaded).
 */
function drawRebusCard(doc, rebus, index, x, y, width, height, imageCache) {
    doc.save();
    doc.lineWidth(0.8).strokeColor('#444444').rect(x, y, width, height).stroke();
    doc.restore();

    writeLine(doc, `${index + 1}.`, x + 6, y + 6, { width: 20, height: 14, fontSize: 10 });

    const fontSize = Math.max(9, Math.min(13, width / 18));
    const lineHeight = Math.max(14, fontSize * 1.35);
    const imageSize = Math.max(26, Math.min(50, height - 32));
    const right = x + width - 6;
    const bottom = y + height - 5;
    const partsStartX = x + 26;
    let cursorX = partsStartX;
    let cursorY = y + 5;

    const ensureRoom = (neededWidth, neededHeight) => {
        if (cursorX + neededWidth > right && cursorX > partsStartX) {
            cursorX = partsStartX;
            cursorY += neededHeight;
        }
        return cursorY + neededHeight <= bottom;
    };

    const drawCommas = (count) => {
        if (!count) return true;
        const label = ','.repeat(count);
        const labelWidth = measureText(doc, label, fontSize);
        if (!ensureRoom(labelWidth, lineHeight)) return false;
        writeLine(doc, label, cursorX, cursorY, {
            width: Math.max(6, Math.min(labelWidth + 2, right - cursorX)),
            height: lineHeight,
            fontSize,
            color: '#aa3333'
        });
        cursorX += labelWidth + 1;
        return true;
    };

    const parts = Array.isArray(rebus.parts) ? rebus.parts : [];
    for (const part of parts) {
        if (!part) continue;
        if (part.type === 'text') {
            const label = String(part.content === null || part.content === undefined ? '' : part.content);
            if (!label) continue;
            const labelWidth = Math.min(measureText(doc, label, fontSize), right - partsStartX);
            if (!ensureRoom(labelWidth, lineHeight)) break;
            writeLine(doc, label, cursorX, cursorY, {
                width: Math.max(6, right - cursorX),
                height: lineHeight,
                fontSize
            });
            cursorX += labelWidth + 4;
            continue;
        }
        if (part.type !== 'image') continue;

        if (!drawCommas(nonNegativeCount(part.subtract_start))) break;
        if (!ensureRoom(imageSize, imageSize)) break;

        const buffer = imageCache.get(part.imageUrl) || null;
        if (buffer) {
            try {
                doc.image(buffer, cursorX, cursorY, {
                    fit: [imageSize, imageSize],
                    align: 'center',
                    valign: 'center'
                });
            } catch (error) {
                drawMissingImageFrame(doc, cursorX, cursorY, imageSize,
                    part.description || part.iconQuery || 'изображение');
            }
        } else {
            drawMissingImageFrame(doc, cursorX, cursorY, imageSize,
                part.description || part.iconQuery || 'изображение');
        }
        cursorX += imageSize + 3;
        if (!drawCommas(nonNegativeCount(part.subtract_end))) break;
    }
}

function drawRebusCards(doc, gameData, imageCache, top, maxHeight, contentWidth) {
    const rebuses = (Array.isArray(gameData.rebuses) ? gameData.rebuses : []).filter(Boolean);
    if (!rebuses.length) {
        writeLine(doc, 'Ребусы не найдены.', PAGE_MARGIN, top, {
            width: contentWidth,
            height: 18,
            fontSize: 11
        });
        return top + 20;
    }

    const columns = rebuses.length > 1 ? 2 : 1;
    const gap = 10;
    const minCardHeight = 64;
    const visibleRows = Math.max(1, Math.floor((maxHeight + gap) / (minCardHeight + gap)));
    const visible = rebuses.slice(0, visibleRows * columns);
    const rows = Math.ceil(visible.length / columns);
    const cardWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
    const cardHeight = Math.max(minCardHeight, Math.min(112, Math.floor((maxHeight - gap * (rows - 1)) / rows)));

    visible.forEach((rebus, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        drawRebusCard(
            doc,
            rebus,
            index,
            PAGE_MARGIN + column * (cardWidth + gap),
            top + row * (cardHeight + gap),
            cardWidth,
            cardHeight,
            imageCache
        );
    });

    const bottom = top + rows * (cardHeight + gap);
    if (visible.length < rebuses.length) {
        writeLine(doc, '…', PAGE_MARGIN, bottom, {
            width: contentWidth,
            height: 14,
            fontSize: 11,
            align: 'center'
        });
        return bottom + 16;
    }
    return bottom;
}

/**
 * A compact one-line-per-item list, optionally split into two columns.
 * Returns the Y coordinate below the list.
 */
function drawItemList(doc, title, items, x, y, width, maxHeight, options = {}) {
    const fontSize = options.fontSize || 9.5;
    const columns = options.columns || 1;
    const maxLines = options.maxLines || 1;
    const lineHeight = fontSize * 1.45;
    const itemHeight = lineHeight * maxLines;
    let cursorY = y;

    if (title) {
        writeLine(doc, title, x, cursorY, {
            width,
            height: 18,
            fontSize: fontSize + 1
        });
        cursorY += 20;
    }

    const available = Math.max(0, maxHeight - 20);
    const columnWidth = (width - (columns > 1 ? 10 : 0)) / columns;
    const rowsPerColumn = Math.max(1, Math.floor(available / itemHeight));
    const perColumn = Math.ceil(items.length / columns);

    for (let column = 0; column < columns; column++) {
        const columnX = x + column * (columnWidth + 10);
        const columnItems = items.slice(column * perColumn, (column + 1) * perColumn);
        const limit = Math.min(columnItems.length, rowsPerColumn);
        for (let index = 0; index < limit; index++) {
            writeBlock(doc, columnItems[index], columnX, cursorY + index * itemHeight,
                columnWidth - 4, itemHeight, { fontSize });
        }
        if (columnItems.length > rowsPerColumn) {
            writeLine(doc, '…', columnX, cursorY + rowsPerColumn * itemHeight, {
                width: columnWidth,
                height: lineHeight,
                fontSize,
                align: 'center'
            });
        }
    }

    return cursorY + Math.min(perColumn, rowsPerColumn) * itemHeight;
}

function drawHeader(doc, contentWidth, titleFontSize, title) {
    const rightEdge = doc.page.width - PAGE_MARGIN;
    writeLine(doc, title, PAGE_MARGIN, PAGE_MARGIN, {
        width: contentWidth,
        height: titleFontSize + 10,
        fontSize: titleFontSize
    });
    writeLine(doc, `Дата: ${new Date().toLocaleDateString('ru-RU')}`, PAGE_MARGIN, PAGE_MARGIN + 30, {
        width: contentWidth,
        height: 16,
        fontSize: 10
    });
    writeLine(doc, 'Ученик: ____________________ Класс: ________.', PAGE_MARGIN, PAGE_MARGIN + 48, {
        width: contentWidth,
        height: 16,
        fontSize: 10
    });
    drawSeparator(doc, GRID_TOP - 24, rightEdge);
}

/**
 * PAGE 1 — student handout.
 */
function drawStudentPage(doc, gameData, context) {
    const contentWidth = doc.page.width - 2 * PAGE_MARGIN;
    const name = gameData.name || 'Без названия';
    const label = GAME_TYPE_LABELS[gameData.gameType] || 'Игра';
    drawHeader(doc, contentWidth, 17, `${label}: ${name}`);

    const words = collectWords(gameData);
    const rightEdge = doc.page.width - PAGE_MARGIN;
    const clueWidth = context.qrBuffer ? contentWidth - QR_SIZE - 14 : contentWidth;
    const clueX = PAGE_MARGIN;
    let clueTop = GRID_TOP + GRID_MAX_HEIGHT + 22;

    if (gameData.gameType === 'crossword') {
        const grid = normalizeGrid(gameData.grid);
        const layout = drawGrid(doc, grid, GRID_TOP, GRID_MAX_HEIGHT, {
            numbers: buildStartNumbers(words),
            showLetters: false
        });
        clueTop = Math.max(clueTop, layout.bottom + 22);

        const across = words.filter(isAcross).sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
        const down = words.filter(isDown).sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
        const columnWidth = (clueWidth - 10) / 2;
        const height = rightEdge - clueTop - (context.qrBuffer ? QR_RESERVED_HEIGHT : 20) + 20;
        drawItemList(doc, 'По горизонтали:', across.map((word) => `${word.position || '?'} ${wordHint(word)}`),
            clueX, clueTop, columnWidth, height, { fontSize: 9 });
        drawItemList(doc, 'По вертикали:', down.map((word) => `${word.position || '?'} ${wordHint(word)}`),
            clueX + columnWidth + 10, clueTop, columnWidth, height, { fontSize: 9 });
    } else if (gameData.gameType === 'rebus') {
        const bottom = drawRebusCards(doc, gameData, context.imageCache, REBUS_TOP, REBUS_MAX_HEIGHT, clueWidth);
        clueTop = Math.max(clueTop, bottom + 12);
        const rebuses = (Array.isArray(gameData.rebuses) ? gameData.rebuses : []).filter(Boolean);
        const height = Math.max(0, (doc.page.height - PAGE_MARGIN - (context.qrBuffer ? QR_RESERVED_HEIGHT : 16)) - clueTop);
        drawItemList(doc, 'Подсказки:', rebuses.map((rebus, index) => `${index + 1}. ${rebusHint(rebus)}`),
            clueX, clueTop, clueWidth, height, { fontSize: 9, columns: clueWidth > 360 ? 2 : 1 });
    } else {
        const grid = normalizeGrid(gameData.grid);
        const layout = drawGrid(doc, grid, GRID_TOP, GRID_MAX_HEIGHT, {
            allCells: true,
            showLetters: true
        });
        clueTop = Math.max(clueTop, layout.bottom + 22);
        const height = Math.max(0, (doc.page.height - PAGE_MARGIN - (context.qrBuffer ? QR_RESERVED_HEIGHT : 16)) - clueTop);
        drawItemList(doc, 'Подсказки:', words.map((word, index) => `${index + 1}. ${wordHint(word)}`),
            clueX, clueTop, clueWidth, height, { fontSize: 9, columns: clueWidth > 360 ? 2 : 1 });
    }

    if (context.qrBuffer) drawQrCode(doc, context.qrBuffer);
}

/**
 * Coordinates string for word-soup answers when the generator supplies them.
 */
function wordCoordinates(word) {
    const row = toCellIndex(word.row !== undefined ? word.row : word.starty);
    const col = toCellIndex(word.col !== undefined ? word.col : word.startx);
    if (row < 0 || col < 0) return '';
    return ` (р. ${row + 1}, ст. ${col + 1})`;
}

function fastCheckItems(gameData, words) {
    if (gameData.gameType === 'rebus') {
        const rebuses = Array.isArray(gameData.rebuses) ? gameData.rebuses.filter(Boolean) : [];
        return rebuses.map((rebus) => `${rebus.word || '?'} — ${rebusHint(rebus)}`);
    }
    return words.map((word) => `${word.word || word.answer || '?'} — ${wordHint(word)}`);
}

/**
 * PAGE 2 — teacher answer sheet.
 */
function drawTeacherPage(doc, gameData, context) {
    const contentWidth = doc.page.width - 2 * PAGE_MARGIN;
    const name = gameData.name || 'Без названия';
    const rightEdge = doc.page.width - PAGE_MARGIN;
    writeLine(doc, `Ключи и ответы: ${name} (Для преподавателя).`, PAGE_MARGIN, PAGE_MARGIN, {
        width: contentWidth,
        height: 24,
        fontSize: 15
    });
    drawSeparator(doc, PAGE_MARGIN + 32, rightEdge);

    const words = collectWords(gameData);
    const bottomLimit = doc.page.height - PAGE_MARGIN - 10;
    let cursorY = GRID_TOP;

    if (gameData.gameType === 'crossword') {
        const grid = normalizeGrid(gameData.grid);
        const layout = drawGrid(doc, grid, GRID_TOP, GRID_MAX_HEIGHT, {
            showLetters: true
        });
        cursorY = Math.min(bottomLimit - 120, layout.bottom + 24);
        const height = Math.max(0, bottomLimit - cursorY);
        drawItemList(doc, 'Быстрая проверка:', fastCheckItems(gameData, words),
            PAGE_MARGIN, cursorY, contentWidth, height, { fontSize: 9, columns: 2 });
    } else if (gameData.gameType === 'rebus') {
        const rebuses = (Array.isArray(gameData.rebuses) ? gameData.rebuses : []).filter(Boolean);
        cursorY = PAGE_MARGIN + 48;
        const listHeight = Math.min(460, Math.max(60, bottomLimit - cursorY - 180));
        const items = rebuses.map((rebus, index) => `${index + 1}. ${rebus.word || '?'} — ${deriveRebusLogic(rebus, true)}`);
        cursorY = drawItemList(doc, 'Ответы и разгадка:', items,
            PAGE_MARGIN, cursorY, contentWidth, listHeight, { fontSize: 10, columns: 1, maxLines: 2 });
        drawItemList(doc, 'Быстрая проверка:', fastCheckItems(gameData, words),
            PAGE_MARGIN, Math.min(bottomLimit - 120, cursorY + 14), contentWidth,
            Math.max(0, bottomLimit - Math.min(bottomLimit - 120, cursorY + 14)),
            { fontSize: 9, columns: 2 });
    } else {
        const grid = normalizeGrid(gameData.grid);
        const layout = drawGrid(doc, grid, GRID_TOP, GRID_MAX_HEIGHT, {
            allCells: true,
            showLetters: true
        });
        cursorY = Math.min(bottomLimit - 240, layout.bottom + 18);
        const found = words.map((word, index) => {
            const answer = word.word || word.answer || '';
            return `${index + 1}. ${answer}${wordCoordinates(word)}`;
        });
        cursorY = drawItemList(doc, 'Найденные слова:', found,
            PAGE_MARGIN, cursorY, contentWidth, 150, { fontSize: 9, columns: 2 });
        const checkTop = Math.min(bottomLimit - 100, cursorY + 12);
        drawItemList(doc, 'Быстрая проверка:', fastCheckItems(gameData, words),
            PAGE_MARGIN, checkTop, contentWidth, Math.max(0, bottomLimit - checkTop),
            { fontSize: 9, columns: 2 });
    }
}

/**
 * Generates an exact two-page A4 PDF for a crossword, word soup or rebus game.
 * @param {Object} gameData
 * @returns {Promise<Buffer>}
 */
async function generateGamePdf(gameData) {
    const data = gameData && typeof gameData === 'object' ? gameData : {};
    const fontBuffer = fs.readFileSync(FONT_PATH);
    const shareUrl = buildShareUrl(data);

    let qrBuffer = null;
    if (shareUrl) {
        try {
            qrBuffer = await QRCode.toBuffer(shareUrl, {
                type: 'png',
                width: 96,
                margin: 1
            });
        } catch (error) {
            qrBuffer = null;
        }
    }

    const imageCache = await preloadRebusImages(data);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        try {
            doc.registerFont(FONT_NAME, fontBuffer);
            doc.font(FONT_NAME);

            const context = { qrBuffer, imageCache };
            drawStudentPage(doc, data, context);
            doc.addPage(); // the only addPage call — exactly two pages
            doc.font(FONT_NAME);
            drawTeacherPage(doc, data, context);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateGamePdf };

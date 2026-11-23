const CrosswordGenerator = require('./CrosswordGenerator');
const { callOpenRouter } = require('../utils/openRouterClient');
const { rebusesJsonSchema, validateRebuses } = require('../utils/schemas');

const ICON_FALLBACK_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E";

// Iconify: поиск по английскому имени иконки, без API-ключа.
// Ограничиваемся наборами с лицензиями Apache-2.0 / MIT / ISC.
const ICONIFY_SEARCH_URL = 'https://api.iconify.design/search';
const ICONIFY_ICON_HOST = 'api.iconify.design';
const ICONIFY_PREFIXES = 'mdi,mdi-,lucide,lucide-,tabler,tabler-,material-symbols,material-symbols-';
// Официальный CDN Iconify отдаёт только SVG, PDFKit умеет PNG/JPEG —
// rasterизируем SVG через публичный image proxy без ключа.
const ICON_RASTER_URL = 'https://images.weserv.nl/';
const ICON_TIMEOUT_MS = 8_000;

function pickIconName(icons, query) {
    const list = Array.isArray(icons) ? icons : [];
    const decorative = /(duotone|filled|outline|sharp|rounded|light|lab)/;
    const rank = (fullName) => {
        const name = String(fullName || '').split(':')[1]?.toLowerCase() || '';
        if (name === query) return 0;
        if (name.startsWith(query) && !decorative.test(name)) return 1;
        if (name.includes(query) && !decorative.test(name)) return 2;
        return 3;
    };
    return list.slice().sort((a, b) => rank(a) - rank(b))[0] || null;
}

class RebusGenerator extends CrosswordGenerator {
    constructor(apiKey, apiUrl, options = {}) {
        super(apiKey, apiUrl, options);
        // in-memory кэш URL иконок по поисковому запросу
        this.iconCache = new Map();
    }

    async generateRebus(text, inputType, totalWords, difficulty = 'normal') {
        const prompt = this.createRebusPrompt(text, inputType, totalWords);

        const { items: rebusData, data: responseData } = await callOpenRouter({
            apiKey: this.openrouterApiKey,
            apiUrl: this.openrouterApiUrl,
            prompt,
            models: this.models,
            jsonSchema: rebusesJsonSchema,
            schemaName: 'rebuses',
            validateItems: validateRebuses,
            temperature: 0.7,
            timeout: this.timeout,
            fetchImpl: this.fetchImpl
        });

        // Валидация структуры частей ребуса через Zod + нормализация полей по умолчанию
        // уже выполнена в callOpenRouter; при мусоре он пробует следующую модель.
        if (rebusData.length === 0) {
            throw new Error('Нейросеть не смогла придумать валидные ребусы.');
        }

        for (const rebus of rebusData) {
            for (const part of rebus.parts) {
                if (part.type === 'image') {
                    part.imageUrl = await this.findIconUrl(part.description, part.iconQuery);
                }
            }
        }

        const wordsForCompatibility = rebusData.map((rebus, index) => ({
            word: rebus.word,
            clue: `Ребус №${index + 1}`
        }));

        return {
            rebuses: rebusData,
            words: wordsForCompatibility,
            rawResponse: responseData
        };
    }

    /**
     * Возвращает публичный URL PNG-иконки по английскому имени из iconQuery.
     * Результат (включая заглушку) кэшируется по запросу в памяти.
     */
    async findIconUrl(description, iconQuery) {
        const query = String(iconQuery || '').trim().split(/\s+/)[0].toLowerCase() || '';
        if (!query) return ICON_FALLBACK_URL;

        const cacheKey = query;
        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        let result = ICON_FALLBACK_URL;

        try {
            const searchUrl = `${ICONIFY_SEARCH_URL}?query=${encodeURIComponent(query)}` +
                `&prefixes=${encodeURIComponent(ICONIFY_PREFIXES)}&limit=32`;
            const response = await (this.fetchImpl || globalThis.fetch)(searchUrl, {
                signal: AbortSignal.timeout(ICON_TIMEOUT_MS)
            });

            if (!response.ok) {
                console.error(`Iconify API error: ${response.status} ${response.statusText}`);
            } else {
                const data = await response.json();
                const fullName = pickIconName(data?.icons, query);

                if (!fullName) {
                    console.warn(`Iconify: иконка для "${query}" не найдена (описание: "${description || ''}").`);
                } else {
                    const [prefix, iconName] = fullName.split(':');
                    const svgPath = `${ICONIFY_ICON_HOST}/${prefix}/${iconName}.svg`;
                    result = `${ICON_RASTER_URL}?url=${encodeURIComponent(svgPath)}&output=png&w=128&h=128`;
                }
            }
        } catch (error) {
            console.error('Error fetching from Iconify:', error);
        }

        this.iconCache.set(cacheKey, result);
        return result;
    }

    /** Legacy-имя для совместимости со старыми вызовами. */
    async findFreepikIconUrl(description, iconQuery) {
        return this.findIconUrl(description, iconQuery);
    }

    createRebusPrompt(text, inputType, totalWords) {
        const context = inputType === 'topic'
            ? `related to the topic "${text}"`
            : `extracted from the text: "${text}"`;

        return `
Generate ${totalWords} creative and LOGICALLY CORRECT Rebus puzzles ${context}.

Break each word into parts: "text" (letters) or "image" (a visual object).

Return a JSON array using exactly these fields:
[
    {
        "word": "TARGET_WORD",
        "parts": [
            { "type": "text", "content": "LETTERS" },
            {
                "type": "image",
                "description": "RUSSIAN description (e.g. кот, дом)",
                "iconQuery": "ONE SHORT ENGLISH NOUN in lowercase for icon search (e.g. wave, cat, house)",
                "subtract_start": 0,
                "subtract_end": 0
            }
        ]
    }
]

EXTREMELY IMPORTANT RULES:
1. **DO NOT replace letters inside an image word.** Example: for "КОЗА", DO NOT use image "КОСА" and replace 'C' with 'З'. This is FORBIDDEN.
2. **ONLY use "subtract_start" and "subtract_end" to modify image words.** This is the ONLY allowed modification. Always include both numbers (0 if nothing is removed).
3. **Double-check your logic and letter count!** The parts MUST assemble into the EXACT target word.
4. Use only simple, concrete, easy-to-draw nouns for images.
5. Image descriptions MUST be in RUSSIAN, but iconQuery MUST be in ENGLISH: lowercase latin letters only, exactly ONE noun, no spaces, digits or punctuation (e.g. "wave", "cat", "house").
6. Output ONLY a valid JSON array.

Example:
- Target: "ПОДВАЛ"
- Logic: Text "ПОД" + Image "ВАЛ" (волна).
- Correct JSON: [{"word":"ПОДВАЛ","parts":[{"type":"text","content":"ПОД"},{"type":"image","description":"волна","iconQuery":"wave","subtract_start":0,"subtract_end":0}]}]

Example with subtraction:
- Target: "УДОЧКА"
- Logic: Image "ДУДОЧКА" -> remove "Д" from start.
- Correct JSON: [{"word":"УДОЧКА","parts":[{"type":"image","description":"дудочка","iconQuery":"flute","subtract_start":1,"subtract_end":0}]}]
`;
    }
}

module.exports = RebusGenerator;

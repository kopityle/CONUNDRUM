const CrosswordGenerator = require('./CrosswordGenerator');
const { callOpenRouter } = require('../utils/openRouterClient');
const { rebusesJsonSchema, validateRebuses } = require('../utils/schemas');

const ICON_FALLBACK_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E";

class RebusGenerator extends CrosswordGenerator {
    constructor(apiKey, apiUrl, options = {}) {
        super(apiKey, apiUrl, options);
        this.freepikApiKey = process.env.FREEPIK_API_KEY;
        // in-memory кэш URL иконок по поисковому запросу
        this.iconCache = new Map();
    }

    async generateRebus(text, inputType, totalWords, difficulty = 'normal') {
        const prompt = this.createRebusPrompt(text, inputType, totalWords);

        const { items, data: responseData } = await callOpenRouter({
            apiKey: this.openrouterApiKey,
            apiUrl: this.openrouterApiUrl,
            prompt,
            models: this.models,
            jsonSchema: rebusesJsonSchema,
            schemaName: 'rebuses',
            temperature: 0.7,
            timeout: this.timeout,
            fetchImpl: this.fetchImpl
        });

        // Валидация структуры частей ребуса через Zod + нормализация полей по умолчанию
        const rebusData = validateRebuses(items);
        if (rebusData.length === 0) {
            throw new Error('Нейросеть не смогла придумать валидные ребусы.');
        }

        for (const rebus of rebusData) {
            for (const part of rebus.parts) {
                if (part.type === 'image') {
                    part.imageUrl = await this.findFreepikIconUrl(part.description, part.iconQuery);
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

    /** Возвращает URL иконки, кэшируя результат (включая заглушку) по запросу. */
    async findFreepikIconUrl(description, iconQuery) {
        const query = String(iconQuery || '').trim().split(/\s+/)[0] ||
            String(description || '').trim().split(/\s+/)[0] || '';
        if (!query) return ICON_FALLBACK_URL;

        const cacheKey = query.toLocaleLowerCase();
        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        if (!this.freepikApiKey) {
            console.warn('FREEPIK_API_KEY не установлен. Возвращаем заглушку.');
            this.iconCache.set(cacheKey, ICON_FALLBACK_URL);
            return ICON_FALLBACK_URL;
        }

        const url = `https://api.freepik.com/v1/resources?term=${encodeURIComponent(cacheKey)}&per_page=1&order=relevance&filters[content_type][value]=icon`;
        let result = ICON_FALLBACK_URL;

        try {
            const response = await (this.fetchImpl || globalThis.fetch)(url, {
                headers: {
                    'x-freepik-api-key': this.freepikApiKey,
                    'Accept-Language': 'ru-RU'
                }
            });

            if (!response.ok) {
                console.error(`Freepik API error: ${response.status} ${response.statusText}`);
            } else {
                const data = await response.json();
                const icon = data?.data?.[0];
                if (icon?.image?.source?.url) {
                    result = icon.image.source.url;
                } else {
                    console.warn(`Freepik: иконка для "${query}" не найдена.`);
                }
            }
        } catch (error) {
            console.error('Error fetching from Freepik:', error);
        }

        this.iconCache.set(cacheKey, result);
        return result;
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
                "iconQuery": "ONE SHORT RUSSIAN NOUN for icon search (e.g. волна)",
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
5. Image descriptions and iconQuery MUST be in RUSSIAN. iconQuery must be exactly ONE short noun without digits or punctuation.
6. Output ONLY a valid JSON array.

Example:
- Target: "ПОДВАЛ"
- Logic: Text "ПОД" + Image "ВАЛ" (волна).
- Correct JSON: [{"word":"ПОДВАЛ","parts":[{"type":"text","content":"ПОД"},{"type":"image","description":"волна","iconQuery":"волна","subtract_start":0,"subtract_end":0}]}]

Example with subtraction:
- Target: "УДОЧКА"
- Logic: Image "ДУДОЧКА" -> remove "Д" from start.
- Correct JSON: [{"word":"УДОЧКА","parts":[{"type":"image","description":"дудочка","iconQuery":"дудочка","subtract_start":1,"subtract_end":0}]}]
`;
    }
}

module.exports = RebusGenerator;

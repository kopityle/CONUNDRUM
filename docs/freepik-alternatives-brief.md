# Бриф для внешней нейросети: анализ использования Freepik и подбор аналогов

> **Статус (обновлено):** решение принято — Freepik заменён на **Iconify** (`api.iconify.design/search`) с растеризацией SVG через `images.weserv.nl`. Файл оставлен как исторический контекст для проверки выбора.

> Скопируй всё содержимое этого файла в другую нейросеть как один промпт.
> Секретов в файле нет: реальные ключи хранятся только в env-переменных.

---

## Роль

Ты — независимый технический аналитик. Проанализируй, как в проекте CONUNDRUM используется API Freepik, и подбери аналоги/замены. Не presume, что Freepik обязателен: если лучшее решение — убрать внешний API вообще, скажи об этом.

## Задача

1. Объясни своими словами, какую ровно задачу решает Freepik в этом проекте.
2. Сформулируй требования к замене (функциональные, юридические, технические).
3. Предложи 4–6 аналогов, для каждого укажи: что это, нужен ли ключ/оплата, лицензия и атрибуция, формат ответа, поддержка русских запросов, стабильность URL, CORS, риски.
4. Дай таблицу сравнения и чёткую рекомендацию: **какой аналог выбрать и почему**, плюс план миграции с минимальными изменениями кода.
5. Отдельно оцени вариант «вообще не использовать внешний image-search API» (статический набор иконок / emoji / генерация SVG).

## Как именно мы используем Freepik (факты из кода)

### 1. Единственный вызов API

`server/services/RebusGenerator.js`:

```js
this.freepikApiKey = process.env.FREEPIK_API_KEY;
this.iconCache = new Map();

async findFreepikIconUrl(description, iconQuery) {
    const query = String(iconQuery || '').trim().split(/\s+/)[0] ||
        String(description || '').trim().split(/\s+/)[0] || '';
    if (!query) return ICON_FALLBACK_URL;

    const cacheKey = query.toLocaleLowerCase();
    if (this.iconCache.has(cacheKey)) return this.iconCache.get(cacheKey);

    if (!this.freepikApiKey) {
        console.warn('FREEPIK_API_KEY не установлен. Возвращаем заглушку.');
        this.iconCache.set(cacheKey, ICON_FALLBACK_URL);
        return ICON_FALLBACK_URL;
    }

    const url = `https://api.freepik.com/v1/resources?term=${encodeURIComponent(cacheKey)}&per_page=1&order=relevance&filters[content_type][value]=icon`;

    const response = await (this.fetchImpl || globalThis.fetch)(url, {
        headers: {
            'x-freepik-api-key': this.freepikApiKey,
            'Accept-Language': 'ru-RU'
        }
    });

    const data = await response.json();
    const icon = data?.data?.[0];
    if (icon?.image?.source?.url) result = icon.image.source.url;
}
```

То есть: **один короткий русский noun → один URL иконки**. Никаких загрузок файлов, никакой генерации картинок, никакой привязки к конкретному ресурсу.

### 2. Откуда берётся поисковый запрос

LLM (OpenRouter) в `createRebusPrompt()` получает инструкцию:

```text
iconQuery: "ONE SHORT RUSSIAN NOUN for icon search (e.g. волна)"
Image descriptions and iconQuery MUST be in RUSSIAN.
iconQuery must be exactly ONE short noun without digits or punctuation.
```

Локальная Zod-валидация в `server/utils/schemas.js`:

```js
const shortNoun = /^[\p{L}-]{1,30}$/u;
iconQuery: z.string().trim().regex(shortNoun, 'iconQuery должен быть одним коротким существительным')
```

### 3. Куда попадает результат

`generateRebus()` подставляет URL в каждую image-часть ребуса:

```js
part.imageUrl = await this.findFreepikIconUrl(part.description, part.iconQuery);
```

Дальше URL используется в двух местах:

- **Браузер:** `client/src/components/RebusDisplay.js` → `<img src={part.imageUrl} ... />` (запрос идёт без заголовков, без ключа).
- **PDF (сервер):** `server/services/pdfGeneratorService.js` → `loadImage(url)` → `fetch(url)` без заголовков → `doc.image(buffer, ...)`.
  Поддерживаются `http(s)` URL и `data:image/...;base64,...`. Если картинка не загрузилась — рисуется рамка с подписью.

### 4. Ограничения, которые важно учесть при подборе аналога

- Ключ есть **только на сервере**, но сами картинки грузятся и клиентом, и сервером **без ключа**. Значит аналог обязан отдавать **публично доступные прямой URL изображений** (или data URL). Нельзя использовать API, где скачивание требует `Authorization`.
- Запрос — **одно Russian word**, без punctuation/digits. Многие аналоги (Iconify, Lucide, Tabler, Phosphor, Material Symbols) работают с **английскими kebab-case именами** — при переходе придётся менять промпт LLM и валидацию: пусть модель возвращает канонический ID иконки из whitelist, а не русское слово. Оцени, насколько это рискованно для качества ребусов.
- Формат: PDFKit умеет PNG/JPEG; SVG «как есть» может не отрисоваться (в текущем коде SVG-fallback всё равно падает в рамку). Желательно PNG/JPEG либо конвертация SVG→PNG на сервере.
- Нужна **лицензия, разрешающая использование в образовательном веб-сервисе**, и понятные требования к атрибуции. Сейчас атрибуция нигде не отображается — если аналог её требует, это отдельная задача.
- Нужна предсказуемая доступность: сейчас нет таймаута на запрос Freepik, ошибки только логируются, при отсутствии ключа/сети подставляется `data:image/svg+xml` заглушка.
- `iconCache` — in-memory `Map` на экземпляр генератора (создаётся один раз в `GameController`), то есть кэш теряется при рестарте и не общий между репликами.
- Тесты: `server/__tests__/RebusGenerator.test.js` проверяют подстановку `imageUrl` и кэширование; `server/__tests__/pdfGenerator.test.js` проверяет деградацию до рамки.

### 5. Где ещё упоминается Freepik

- `README.md`: `FREEPIK_API_KEY=<freepik-key>` в разделе «AI / генерация».
- `server/scripts/openrouter-free-models.ps1` с Freepik не связан.
- Никаких других вызовов/зависимостей Freepik в репозитории нет.

## Критерии оценки (важно для рекомендации)

1. **Юридическая чистота**: лицензия, атрибуция, коммерческое использование.
2. **Соответствие задаче**: иконки/пиктограммы для ребусов, а не случайные фото.
3. **Русский язык**: насколько хорошо находится нужный объект по одному русскому слову.
4. **Техническая совместимость**: прямой URL без ключа, PNG/JPEG, CORS, стабильность, rate limits.
5. **Надёжность**: что будет при 429/5xx/не найденном изображении.
6. **Стоимость и кэширование**: бесплатный лимит, нужна ли регистрация.
7. **Цена миграции**: сколько кода и промптов придётся менять.

## Что учесть в сравнении (заготовка списка, не ограничение)

- Iconify API (`api.iconify.design/...`) — огромный набор SVG, без ключа, но английские ID и лицензии по сетам.
- Статические наборы: Tabler Icons, Lucide, Phosphor, Material Symbols — предсказуемо, но нужен RU→EN mapping.
- Emoji-подход: Twemoji / Noto Emoji CDN — просто, но ограничить abstractions («волна», «дудочка»).
- Pixabay API / Pexels API / Openverse / Wikimedia Commons — поиск по словам, фото/CC-контент, атрибуция.
- Полный отказ от внешнего поиска: LLM возвращает ID из whitelist, иконки лежат в репозитории как локальные PNG/SVG.

## Формат ответа

1. Краткое резюме: что делает Freepik здесь.
2. Таблица аналогов с колонками: Название | Ключ | Лицензия/атрибуция | RU-запросы | Прямой URL | Формат | Риски | Вердикт.
3. Топ-3 с объяснением.
4. Рекомендованный вариант + почему именно он.
5. План миграции: какие файлы менять, какой должен быть интерфейс `findIconUrl(description, query)`, что делать с промптом LLM и валидацией, как сохранить fallback и кэш.
6. Честный список потерь при отказе от Freepik.

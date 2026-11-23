# Conundrum React

Веб-приложение для генерации и прохождения обучающих головоломок на основе загруженного текста (кроссворд, филворд, ребус) с поддержкой LTI и PDF-экспорта. Данные преподавателей, головоломок и попыток хранятся локально в SQLite.

## Что умеет проект

- Генерация игровых заданий из пользовательского документа (`/api/generate-game`).
- Поддержка нескольких режимов отображения (кроссворд, филворд, ребус).
- Пересчёт раскладки кроссворда (`/api/recalculate-game-layout`).
- Экспорт задания в PDF (`/api/generate-pdf`).
- Регистрация/вход преподавателей по JWT + httpOnly-cookie, управление своими головоломками и просмотр аналитики.
- Публичный запуск головоломки по `share_id` и сохранение попыток учеников без авторизации.
- LTI-интеграция: запуск из LMS, определение ролей, отправка оценки, сохранение параметров генерации.

## Стек

**Frontend**
- React (Vite)
- React Router
- Nginx (раздача статики и проксирование)

**Backend**
- Node.js + Express
- SQLite (`better-sqlite3`), файл `server/data/conundrum.db`
- JWT (`jsonwebtoken`), bcryptjs, cookie-parser
- Multer (загрузка файлов)
- PDFKit
- OAuth / LTI middleware

**Инфраструктура**
- Docker / Docker Compose
- Разделение на 2 контейнера: `client` и `server`
- Healthcheck для каждого сервиса

## Структура репозитория

```text
.
├── client/                 # React-приложение
├── server/                 # Express API + SQLite + LTI + генерация PDF
│   ├── db/                 # схема БД и репозитории
│   ├── controllers/        # AuthController, PuzzleController, GameController
│   ├── middleware/         # аутентификация и LTI
│   ├── routes/             # API-роуты
│   └── data/               # локальный SQLite-файл (не коммитится)
├── docker-compose.yml      # Оркестрация контейнеров
└── README.md
```

## База данных

Файл создаётся автоматически при первом запуске: `server/data/conundrum.db`. Включены `journal_mode = WAL` и `foreign_keys = ON`. Таблицы: `users`, `puzzles`, `puzzle_attempts`, `lti_configurations`. Путь можно переопределить переменной `DB_PATH`.

## Переменные окружения

### 1) Корневой `.env` (для сборки client в docker-compose)

```env
VITE_API_URL=
VITE_BASE_URL=http://localhost
```

`VITE_API_URL` можно оставить пустым только там, где `/api` проксируется (Vite dev server или nginx в Docker). Для GitHub Pages укажите абсолютный адрес бэкенда без завершающего слеша, например `https://api.example.com`; иначе POST-запросы к статическому хостингу вернут `405 Not Allowed`. Значение читается через `import.meta.env.VITE_API_URL` во всех клиентских запросах.

### 2) `server/.env`

```env
PORT=5000
NODE_ENV=production

# CORS / сессии / JWT
# Можно перечислить несколько origin через запятую: https://one.example,https://two.example
# Для GitHub Pages обязательно добавьте https://<user>.github.io
ALLOWED_ORIGINS=http://localhost
SESSION_SECRET=<strong-session-secret>
JWT_SECRET=<optional-jwt-secret>          # если не задан — используется SESSION_SECRET
CLIENT_URL=http://localhost
DB_PATH=/app/data/conundrum.db             # опционально, по умолчанию server/data/conundrum.db

# LTI 1.1
LTI_KEY=<lti-consumer-key>
LTI_SECRET=<lti-consumer-secret>

# AI / генерация
OPENROUTER_API_KEY=<openrouter-key>
OPENROUTER_API_URL=<openrouter-api-url>
# Иконки для ребусов ищутся через Iconify, API-ключ не требуется
```

## Запуск через Docker Compose (рекомендуется)

```bash
docker compose up -d --build
```

После запуска:
- Frontend: `http://localhost`
- Backend healthcheck: `http://localhost/api/health` (через прокси)  
  (внутри контейнера backend слушает `5000`)

Полезные команды:

```bash
# Логи
docker compose logs -f

# Остановка
docker compose down
```

## Локальный запуск без Docker

### Backend

```bash
cd server
npm ci
npm start
```

### Frontend

```bash
cd client
npm ci
npm start
```

## API

### Аутентификация

- `POST /api/auth/register` — `{email,password,username,occupation?,gender?}` → `{token,user}` (201).
- `POST /api/auth/login` — `{email,password}` → `{token,user}`.
- `GET /api/auth/me` — текущий пользователь по Bearer-токену или cookie `conundrum_token`.
- `POST /api/auth/profile` — `{username?,occupation?,gender?}` → `{user}`.
- `POST /api/auth/logout` — очищает cookie `conundrum_token` → `{success:true}`.

### Головоломки и аналитика (требуется авторизация)

- `GET /api/puzzles` — список своих головоломок с `attempt_count` и `avg_score`.
- `POST /api/puzzles` — создание `{name,game_type,game_data,tags?}`; доступно и без авторизации (гостевая головоломка).
- `GET /api/puzzles/:id` — головоломка по id (только владелец).
- `PUT /api/puzzles/:id` — обновление name/game_type/game_data/tags (только владелец).
- `DELETE /api/puzzles/:id` — удаление вместе с попытками (только владелец).
- `GET /api/puzzles/:id/analytics` — попытки, средний балл, уникальные ученики и самые частые ошибочные слова.

### Публичный запуск (без авторизации)

- `GET /api/play/:shareId` — головоломка по короткому `share_id`.
- `POST /api/play/:shareId/attempt` — `{student_name,score,duration_sec,wrong_words}` → сохранённая попытка (201).

### LTI и прочее

- `GET /api/lti/config/:resourceLinkId` — сохранённые `generation_params` (требуется авторизация).
- `PUT /api/lti/config/:resourceLinkId` — `{generationParams}` → `{success:true}`.
- `POST /api/generate-game` — генерация игры по загруженному файлу.
- `POST /api/recalculate-game-layout` — перерасчёт layout кроссворда.
- `POST /api/track-activity` — трекинг активности.
- `POST /api/generate-pdf` — формирование PDF.
- `POST /api/lti/submit-score` — отправка результата в LMS через LTI.
- `GET /api/health` — проверка состояния backend.
- `POST /lti/launch` — LTI launch с редиректом в клиент.

## Тесты

```bash
# backend
cd server && npm test

# frontend
cd client && npm test
```

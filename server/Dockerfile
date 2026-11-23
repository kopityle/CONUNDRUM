FROM node:24-alpine

# Устанавливаем системные утилиты для компиляции нативных модулей (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]

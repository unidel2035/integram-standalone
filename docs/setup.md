# Настройка окружения VentureOS

> Руководство по развёртыванию платформы Фонда Суверенных Технологий НТИ

---

## 1. Системные требования

### Минимальные требования

- **OS:** Linux (Ubuntu 22.04+), macOS 13+, Windows 10+ (WSL2)
- **Node.js:** v20.0.0 или выше
- **npm:** v9.0.0 или выше
- **RAM:** 4 GB (рекомендуется 8 GB)
- **Disk:** 10 GB свободного места

### Рекомендуемые требования

- **OS:** Ubuntu 22.04 LTS
- **Node.js:** v20.11.0 (LTS)
- **RAM:** 16 GB
- **Disk:** 50 GB SSD

---

## 2. Установка зависимостей

### 2.1 Node.js и npm

**Ubuntu/Debian:**
```bash
# Установка Node.js 20 LTS через nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Проверка версии
node --version  # v20.11.0
npm --version   # 10.2.4
```

**macOS:**
```bash
# Установка через Homebrew
brew install node@20
brew link node@20

# Или через nvm
brew install nvm
nvm install 20
nvm use 20
```

**Windows (WSL2):**
```bash
# Следовать инструкциям Ubuntu/Debian
# Убедиться, что WSL2 установлен
wsl --install
```

### 2.2 Git

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install git

# macOS
brew install git

# Проверка
git --version
```

### 2.3 GitHub CLI (опционально, для работы с issues/PRs)

```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# macOS
brew install gh

# Аутентификация
gh auth login
```

---

## 3. Клонирование репозитория

```bash
# Клонирование
git clone https://github.com/unidel2035/found.git
cd found

# Переключение на dev ветку (основная ветка разработки)
git checkout dev

# Проверка текущей ветки
git branch --show-current
```

---

## 4. Настройка переменных окружения

### 4.1 Копирование шаблона

```bash
cp .env.example .env
```

### 4.2 Редактирование .env

Откройте `.env` в текстовом редакторе и заполните обязательные переменные:

#### Обязательные переменные

```bash
# AI Provider (минимум один)
DEEPSEEK_API_KEY=sk-your-deepseek-key-here

# Integram Database (обязательно)
INTEGRAM_SERVER_URL=ai2o.ru
INTEGRAM_SYSTEM_USERNAME=your-integram-login
INTEGRAM_SYSTEM_PASSWORD=your-integram-password

# Backend
PORT=3000
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
```

#### Опциональные переменные

```bash
# Дополнительные AI провайдеры
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
YANDEXGPT_API_KEY=your-yandex-gpt-key-here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# GitHub (для Koda AI automation)
GITHUB_TOKEN=ghp_your-github-token-here

# KAG (если запущен локально)
KAG_SERVER_URL=http://localhost:8000
```

### 4.3 Получение API-ключей

**DeepSeek:**
1. Зарегистрироваться на https://platform.deepseek.com
2. Перейти в API Keys
3. Создать новый ключ
4. Скопировать в `.env` → `DEEPSEEK_API_KEY`

**OpenAI:**
1. Зарегистрироваться на https://platform.openai.com
2. Billing → Add payment method
3. API Keys → Create new secret key
4. Скопировать в `.env` → `OPENAI_API_KEY`

**Anthropic (Claude):**
1. Зарегистрироваться на https://console.anthropic.com
2. Get API Keys
3. Создать новый ключ
4. Скопировать в `.env` → `ANTHROPIC_API_KEY`

**Integram:**
- Тестовая БД: `ai2o.ru/fst` (логин/пароль задаются в `.env` через `INTEGRAM_SYSTEM_USERNAME` / `INTEGRAM_SYSTEM_PASSWORD`)
- Для production: запросить кредентиалы у администратора

**Telegram Bot:**
1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → следовать инструкциям
3. Скопировать токен в `.env` → `TELEGRAM_BOT_TOKEN`

---

## 5. Установка зависимостей проекта

### 5.1 Корневая директория (Frontend)

```bash
# Находясь в found/
npm install
```

### 5.2 Backend

```bash
cd backend/monolith
npm install
cd ../..
```

---

## 6. Запуск в режиме разработки

### 6.1 Backend

```bash
cd backend/monolith
npm run dev
```

Backend запустится на `http://localhost:3000`

**Проверка:**
```bash
curl http://localhost:3000/api/health
# → { "status": "ok", "timestamp": "..." }
```

### 6.2 Frontend

В новом терминале:

```bash
# Находясь в found/
npm run dev
```

Frontend запустится на `http://localhost:5173`

**Проверка:**
Открыть браузер → `http://localhost:5173`

### 6.3 Горячая перезагрузка

Оба процесса поддерживают hot-reload:
- Frontend: Vite HMR (изменения видны мгновенно)
- Backend: nodemon (автоматический перезапуск при изменении файлов)

---

## 7. Проверка работоспособности

### 7.1 Проверка доступа к Integram

```bash
# Тест аутентификации
curl -X POST 'https://ai2o.ru/fst/auth?JSON_KV' -d 'login=d&pwd=d'
```

Ожидаемый ответ:
```json
{
  "token": "long-token-string",
  "_xsrf": "xsrf-string",
  "id": "user-id"
}
```

### 7.2 Проверка AI Token Router

```bash
# Тест маршрутизации токенов
curl -X POST http://localhost:3000/api/ai-tokens/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "Hello",
    "model": "deepseek-chat",
    "stream": false
  }'
```

### 7.3 Проверка WebSocket

Открыть консоль браузера на `http://localhost:5173`:

```javascript
// Проверка Socket.io подключения
const socket = io('http://localhost:3000');
socket.on('connect', () => console.log('Connected:', socket.id));
```

---

## 8. Структура проекта после установки

```
found/
├── node_modules/           # Frontend dependencies
├── src/
│   ├── views/pages/        # Vue страницы
│   ├── components/         # Vue компоненты
│   ├── services/           # API clients
│   ├── router/             # Vue Router
│   └── config/             # Конфигурация
├── backend/
│   └── monolith/
│       ├── node_modules/   # Backend dependencies
│       ├── src/            # Backend source
│       └── scripts/        # Koda automation
├── docs/                   # Документация
├── e2e/                    # E2E тесты
├── tests/                  # Unit тесты
├── .env                    # Ваши переменные окружения (НЕ коммитить!)
├── .env.example            # Шаблон (коммитить)
├── package.json            # Frontend deps
└── vite.config.js          # Vite config
```

---

## 9. Запуск тестов

### 9.1 Unit Tests

```bash
# Frontend unit tests
npm run test:unit

# Backend unit tests
cd backend/monolith
npm run test
```

### 9.2 E2E Tests

```bash
# Установить Playwright (первый раз)
npx playwright install

# Запустить E2E тесты
npm run test:e2e
```

### 9.3 Coverage

```bash
npm run test:coverage
```

Отчёт сохраняется в `coverage/index.html`

---

## 10. Koda AI Automation Scripts

Koda — бесплатные AI-скрипты для автоматизации (используют MiniMax-M2.5 через GitHub token).

### 10.1 Настройка

```bash
# В .env добавить
GITHUB_TOKEN=ghp_your-github-token-here
```

### 10.2 Использование

```bash
cd backend/monolith

# QA-тестирование страниц
node scripts/koda-site-tester.cjs /fst-committee --full

# Code review коммитов
node scripts/koda-code-reviewer.cjs --commit HEAD~3..HEAD

# API-тестирование
node scripts/koda-api-tester.cjs --auth

# Проверка деплоя
node scripts/koda-deploy-checker.cjs

# Тестирование через SOCKS proxy
node scripts/koda-deploy-tester.cjs --full
```

---

## 11. Troubleshooting

### Проблема: "Module not found"

**Причина:** Не установлены зависимости

**Решение:**
```bash
# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install

# Для backend
cd backend/monolith
rm -rf node_modules package-lock.json
npm install
```

### Проблема: "Port 3000 already in use"

**Решение:**
```bash
# Найти процесс на порту 3000
lsof -i :3000

# Убить процесс
kill -9 <PID>

# Или изменить порт в .env
PORT=3001
```

### Проблема: "ECONNREFUSED ai2o.ru"

**Причина:** Проблемы с сетью или Integram недоступен

**Решение:**
```bash
# Проверить доступность
curl https://ai2o.ru/fst/auth?JSON_KV

# Если не работает — проверить VPN/proxy
```

### Проблема: "Unauthorized" при запросах к AI

**Причина:** Неверный API-ключ

**Решение:**
```bash
# Проверить ключ в .env
cat .env | grep API_KEY

# Пересоздать ключ на платформе провайдера
# Обновить в .env
```

### Проблема: WebSocket не подключается

**Причина:** CORS или неверный URL

**Решение:**
```bash
# В .env проверить
VITE_WS_URL=ws://localhost:3000

# В backend/monolith/src/index.js проверить CORS
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" }
});
```

---

## 12. Production Deployment

### 12.1 Build

```bash
# Frontend build
npm run build
# → dist/

# Backend (уже production-ready)
cd backend/monolith
npm install --production
```

### 12.2 Systemd Services

**Backend Service** (`/etc/systemd/system/dronedoc-backend.service`):
```ini
[Unit]
Description=VentureOS Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/found/backend/monolith
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Frontend Service** (`/etc/systemd/system/dronedoc-frontend.service`):
```ini
[Unit]
Description=VentureOS Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/found
ExecStart=/usr/bin/npx vite preview --port 5173 --host
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Запуск:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable dronedoc-backend dronedoc-frontend
sudo systemctl start dronedoc-backend dronedoc-frontend
sudo systemctl status dronedoc-backend dronedoc-frontend
```

### 12.3 Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name fst.drondoc.ru;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 13. Кредентиалы и доступы

### Development

| Сервис | URL | Логин | Пароль |
|--------|-----|-------|--------|
| Integram FST (test) | ai2o.ru/fst | d | d |
| Integram KVAL (ontology) | ai2o.ru/kval | d | d |
| Frontend (dev) | localhost:5173 | - | - |
| Backend (dev) | localhost:3000 | - | - |

### Production

| Сервис | URL | Доступ |
|--------|-----|--------|
| Frontend | fst.drondoc.ru | Публичный |
| Backend API | fst.drondoc.ru/api | Требует auth |
| Integram FST (prod) | ai2o.ru/fst | Запросить у admin |

**Запрос доступов:**
- Администратор: unidel@yandex.ru
- GitHub Issues: https://github.com/unidel2035/found/issues

---

## 14. Дальнейшие шаги

После успешной установки:

1. **Изучить документацию:**
   - [`docs/architecture.md`](./architecture.md) — архитектура платформы
   - [`docs/database.md`](./database.md) — схема БД Integram
   - [`CLAUDE.md`](../CLAUDE.md) — dev guidelines для AI

2. **Запустить примеры:**
   - Открыть `/fst-committee` → запустить AI дебаты
   - Открыть `/fst-deal` → создать Term Sheet
   - Открыть `/fst-portfolio` → мониторинг портфеля

3. **Создать тестовый проект:**
   - Перейти в `/fst` (FST Hub)
   - Создать проект через форму
   - Запустить AI Committee
   - Структурировать сделку

4. **Написать тесты:**
   - Unit test для нового компонента
   - E2E test для нового flow

5. **Внести вклад:**
   - Форкнуть репозиторий
   - Создать feature branch
   - Открыть PR с описанием

---

## 15. Полезные команды

```bash
# Проверка статуса Git
git status

# Создание новой ветки
git checkout -b feat/my-feature

# Запуск линтера
npm run lint

# Исправление линтера автоматически
npm run lint:fix

# Проверка типов (если используется TypeScript)
npm run type-check

# Очистка кэша
rm -rf node_modules/.vite

# Пересборка полная
npm run build -- --force

# Логи backend в production
sudo journalctl -u dronedoc-backend -f

# Логи frontend в production
sudo journalctl -u dronedoc-frontend -f

# Перезапуск сервисов
sudo systemctl restart dronedoc-backend dronedoc-frontend
```

---

## 16. Контакты

**Техническая поддержка:**
- GitHub Issues: https://github.com/unidel2035/found/issues
- Email: unidel@yandex.ru

**Документация:**
- GitHub Wiki: https://github.com/unidel2035/found/wiki
- Architecture: [`docs/architecture.md`](./architecture.md)
- Database: [`docs/database.md`](./database.md)

**Community:**
- Telegram: (TBD)
- Discord: (TBD)

---

_Создано: 2026-03-06 | Issue: [#2](https://github.com/unidel2035/found/issues/2)_

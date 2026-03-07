# FST REST API

REST API для интеграции платформы Фонда Суверенных Технологий (ФСТ) с внешними системами: Госуслуги, СПАРК, Сколково, министерства.

## 📋 Содержание

- [Быстрый старт](#быстрый-старт)
- [Аутентификация](#аутентификация)
- [Эндпоинты](#эндпоинты)
  - [Portfolio API](#portfolio-api)
  - [Applications API](#applications-api)
  - [Webhooks API](#webhooks-api)
- [SDK и примеры](#sdk-и-примеры)
- [Rate Limiting](#rate-limiting)
- [Развёртывание](#развёртывание)

---

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Создайте `.env` файл в корне проекта:

```env
# Integram (база данных)
INTEGRAM_SERVER_URL=https://ai2o.ru
INTEGRAM_SYSTEM_USERNAME=your-integram-login
INTEGRAM_SYSTEM_PASSWORD=your-integram-password

# API Server
FST_API_PORT=3100
NODE_ENV=production

# Webhook Secrets
WEBHOOK_SECRET_EGRUL=your-egrul-secret
WEBHOOK_SECRET_ROSPATENT=your-rospatent-secret
WEBHOOK_SECRET_HH=your-hh-secret

# Telegram (опционально, для уведомлений)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-chat-id
```

### 3. Запуск сервера

```bash
npm run api
```

Сервер запустится на `http://localhost:3100`.

### 4. Проверка работоспособности

```bash
curl http://localhost:3100/api/fst/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T08:00:00.000Z",
  "service": "FST REST API",
  "version": "1.0.0"
}
```

### 5. Swagger UI

Откройте в браузере: http://localhost:3100/api/fst/docs

---

## 🔐 Аутентификация

### API Token (Bearer)

Для доступа к Portfolio и Applications API используется Bearer токен:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://dev.drondoc.ru/api/fst/portfolio
```

**Получить API токен:** unidel@yandex.ru

Токены хранятся в Integram БД (type 1195: API Tokens) и имеют следующие свойства:
- Уникальный токен
- Название партнёра
- Права доступа (read/write)
- Статус активности

### Webhook Secret

Для webhook эндпоинтов используется секрет в заголовке:

```bash
curl -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"inn": "7729123456", ...}' \
  https://dev.drondoc.ru/api/fst/webhook/egrul
```

Секреты настраиваются через переменные окружения.

---

## 📡 Эндпоинты

### Portfolio API

#### GET /api/fst/portfolio

Возвращает список портфельных компаний с показателями здоровья (публичный вариант без конфиденциальных финансовых данных).

**Требует аутентификации:** да

**Пример запроса:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dev.drondoc.ru/api/fst/portfolio
```

**Пример ответа:**
```json
{
  "total": 3,
  "companies": [
    {
      "id": 1202,
      "name": "АвиаЛогик",
      "inn": "7729123456",
      "healthScore": 85,
      "trafficLight": "green",
      "trl": 6,
      "status": "active",
      "metrics": {
        "patentsCount": 5,
        "hiringActivity": 12,
        "newsCoverage": 8,
        "lastUpdated": "2026-03-06T12:00:00Z"
      }
    }
  ],
  "timestamp": "2026-03-07T08:00:00Z"
}
```

#### GET /api/fst/company/:id

Возвращает детальную информацию о портфельной компании.

**Требует аутентификации:** да

**Параметры:**
- `id` (path) — ID компании в портфеле

**Пример запроса:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dev.drondoc.ru/api/fst/company/1202
```

**Пример ответа:**
```json
{
  "id": 1202,
  "name": "АвиаЛогик",
  "inn": "7729123456",
  "description": "Разработка автономных БПЛА для логистики",
  "healthScore": 85,
  "trafficLight": "green",
  "trl": 6,
  "status": "active",
  "metrics": {
    "patentsCount": 5,
    "hiringActivity": 12,
    "newsCoverage": 8,
    "lastUpdated": "2026-03-06T12:00:00Z"
  },
  "recentEvents": [
    {
      "type": "rospatent_granted",
      "description": "Роспатент: Получен патент RU2751234",
      "timestamp": "2026-03-05T10:00:00Z",
      "severity": "info"
    }
  ]
}
```

#### GET /api/fst/kpis

Возвращает агрегированные KPI всего портфеля.

**Требует аутентификации:** да

**Пример запроса:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dev.drondoc.ru/api/fst/kpis
```

**Пример ответа:**
```json
{
  "totalCompanies": 3,
  "averageHealthScore": 78,
  "trafficLightDistribution": {
    "green": 2,
    "yellow": 1,
    "red": 0
  },
  "totalPatents": 12,
  "averageTRL": 6,
  "activeCompanies": 3,
  "timestamp": "2026-03-07T08:00:00Z"
}
```

### Applications API

#### POST /api/fst/apply

Создаёт новую заявку на финансирование из внешних порталов.

**Требует аутентификации:** да

**Body параметры:**
- `companyName` (обязательно) — Название компании
- `inn` (обязательно) — ИНН компании
- `description` (обязательно) — Описание проекта
- `requestedAmount` (обязательно) — Запрашиваемая сумма (руб.)
- `ogrn` — ОГРН (опционально)
- `trl` — Technology Readiness Level 1-9 (опционально)
- `sovereignty` — Индекс суверенности 0-10 (опционально)
- `subfund` — Целевой субфонд (опционально)
- `stage` — Стадия инвестирования (опционально)
- `contactEmail` — Email для связи (опционально)
- `contactPhone` — Телефон (опционально)
- `source` — Источник заявки: skolkovo, rfrit, gosuslugi, api (опционально)

**Пример запроса:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "ИнноТех",
    "inn": "7729123456",
    "ogrn": "1177746123456",
    "description": "Разработка инновационных БПЛА для гражданского применения",
    "requestedAmount": 50000000,
    "trl": 6,
    "sovereignty": 8,
    "contactEmail": "contact@innotech.ru",
    "source": "api"
  }' \
  https://dev.drondoc.ru/api/fst/apply
```

**Пример ответа:**
```json
{
  "success": true,
  "applicationId": 1215,
  "message": "Application submitted successfully",
  "status": "pending_review",
  "nextSteps": [
    "Your application will be reviewed by AI Investment Committee",
    "Expected response time: 5-7 business days",
    "You will receive notifications via email"
  ],
  "trackingUrl": "/api/fst/application/1215"
}
```

#### GET /api/fst/application/:id

Возвращает статус заявки и результаты рассмотрения AI-инвесткомитета.

**Требует аутентификации:** да

**Параметры:**
- `id` (path) — ID заявки

**Пример запроса:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dev.drondoc.ru/api/fst/application/1215
```

**Пример ответа:**
```json
{
  "applicationId": 1215,
  "companyName": "ИнноТех",
  "status": "approved",
  "submittedAt": "2026-03-01T10:00:00Z",
  "lastUpdated": "2026-03-05T15:30:00Z",
  "committeeReview": {
    "decision": "APPROVE",
    "score": 82,
    "reviewedAt": "2026-03-05T15:30:00Z",
    "conditions": [
      "Подтверждение TRL 6 независимым экспертом"
    ]
  },
  "deal": {
    "id": 1220,
    "amount": 45000000,
    "equity": 15.5,
    "status": "draft",
    "signedAt": null
  }
}
```

**Возможные статусы заявки:**
- `pending_review` — На рассмотрении
- `approved` — Одобрено ИК
- `approved_pending_signature` — Одобрено, ожидает подписания
- `approved_funded` — Одобрено и профинансировано
- `deferred` — Отложено (требуется доработка)
- `rejected` — Отклонено

### Webhooks API

#### POST /api/fst/webhook/egrul

Получение обновлений из ЕГРЮЛ/ЕФРСБ (изменения статуса, адреса, директора, банкротства).

**Требует аутентификации:** X-Webhook-Secret

**Body параметры:**
- `inn` (обязательно) — ИНН компании
- `changeType` (обязательно) — Тип изменения: status, address, director, capital, bankruptcy
- `newValue` (обязательно) — Новое значение
- `companyName` — Название компании (опционально)
- `oldValue` — Старое значение (опционально)
- `source` — Источник данных (опционально)
- `changeDate` — Дата изменения (опционально)

**Пример запроса:**
```bash
curl -X POST \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "inn": "7729123456",
    "companyName": "АвиаЛогик",
    "changeType": "director",
    "oldValue": "Иванов И.И.",
    "newValue": "Петров П.П.",
    "source": "egrul-parser",
    "changeDate": "2026-03-07T08:00:00Z"
  }' \
  https://dev.drondoc.ru/api/fst/webhook/egrul
```

**Пример ответа:**
```json
{
  "success": true,
  "eventId": 3456,
  "companyId": 1202,
  "severity": "high",
  "message": "EGRUL update processed successfully"
}
```

#### POST /api/fst/webhook/rospatent

Получение информации о новых патентах и изменениях IP.

**Требует аутентификации:** X-Webhook-Secret

**Body параметры:**
- `inn` (обязательно) — ИНН компании
- `patentNumber` (обязательно) — Номер патента
- `status` (обязательно) — Статус: filed, granted, expired, invalidated
- `companyName` — Название компании (опционально)
- `patentTitle` — Название патента (опционально)
- `patentType` — Тип: invention, utility_model, industrial_design (опционально)
- `filingDate` — Дата подачи (опционально)
- `grantDate` — Дата выдачи (опционально)

**Пример запроса:**
```bash
curl -X POST \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "inn": "7729123456",
    "companyName": "АвиаЛогик",
    "patentNumber": "RU2751234",
    "patentTitle": "Система автономной навигации БПЛА",
    "patentType": "invention",
    "status": "granted",
    "filingDate": "2025-01-15",
    "grantDate": "2026-03-07"
  }' \
  https://dev.drondoc.ru/api/fst/webhook/rospatent
```

#### POST /api/fst/webhook/hh

Получение статистики найма с HH.ru.

**Требует аутентификации:** X-Webhook-Secret

**Body параметры:**
- `inn` (обязательно) — ИНН компании
- `activeVacancies` (обязательно) — Количество активных вакансий
- `companyName` — Название компании (опционально)
- `totalVacancies` — Всего вакансий (опционально)
- `avgSalary` — Средняя зарплата (опционально)
- `topPositions` — Топ позиций [{title, count}] (опционально)
- `period` — Период: week, month (опционально)

**Пример запроса:**
```bash
curl -X POST \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "inn": "7729123456",
    "companyName": "АвиаЛогик",
    "activeVacancies": 15,
    "totalVacancies": 25,
    "avgSalary": 150000,
    "topPositions": [
      {"title": "Software Engineer", "count": 5},
      {"title": "Data Scientist", "count": 3}
    ],
    "period": "month"
  }' \
  https://dev.drondoc.ru/api/fst/webhook/hh
```

---

## 🛠️ SDK и примеры

### Python

См. `src/api/sdk/python_example.py`

```bash
pip install requests
export FST_API_TOKEN="your_token"
python src/api/sdk/python_example.py
```

### JavaScript/Node.js

См. `src/api/sdk/javascript_example.js`

```bash
export FST_API_TOKEN="your_token"
node src/api/sdk/javascript_example.js
```

---

## ⚡ Rate Limiting

Для партнёров установлен лимит: **1000 запросов в день**.

При превышении лимита API возвращает:
```json
{
  "error": "Rate limit exceeded. Maximum 1000 requests per day."
}
```

HTTP Status: `429 Too Many Requests`

---

## 🚀 Развёртывание

### Production (systemd)

1. Создайте systemd service:

```bash
sudo nano /etc/systemd/system/fst-api.service
```

```ini
[Unit]
Description=FST REST API Server
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/found/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/found/.env

[Install]
WantedBy=multi-user.target
```

2. Запустите сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fst-api
sudo systemctl start fst-api
sudo systemctl status fst-api
```

3. Проверьте логи:

```bash
sudo journalctl -u fst-api -f
```

### Nginx Reverse Proxy

```nginx
location /api/fst {
    proxy_pass http://localhost:3100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 📊 Тестирование

Запустите автоматические тесты:

```bash
export FST_API_TOKEN="test-token"
./src/api/test_endpoints.sh
```

---

## 📞 Поддержка

По вопросам получения API токена и интеграции:

**Email:** unidel@yandex.ru
**Документация:** https://dev.drondoc.ru/api/fst/docs
**GitHub:** https://github.com/unidel2035/found/issues

---

## 📄 Лицензия

UNLICENSED — внутренний проект ФСТ НТИ

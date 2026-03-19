# Integram API v2 — Plan

> Новый API параллельно с legacy-compat. Не заменяет его — работает рядом.
> Цель: покрыть 100% реализованного в legacy, с нормальными HTTP-кодами, REST-форматом и WebSocket.

## Монтирование

```
/              → legacy-compat (старый фронтенд, без изменений)
/api/v2/:db/   → новый API (v2) — этот план
/api/          → существующие modern routes (без изменений)
```

Одна строка в `index.js`, **до** legacyCompatRoutes:
```javascript
this.app.use('/api/v2', v2Routes);
```

---

## Структура файлов

```
backend/monolith/src/api/v2/
│
├── index.js                          # Точка входа: монтирует все модули
├── PLAN.md                           # Этот файл
│
├── middleware/
│   ├── auth.js                       # Bearer token + cookie аутентификация
│   ├── csrf.js                       # CSRF только для cookie-сессий
│   ├── grants.js                     # Проверка грантов (DDL/write)
│   ├── db.js                         # Attach pool к req.pool по :db
│   ├── validate.js                   # Zod-валидация body/query/params
│   └── errors.js                     # Centralized error handler → правильные HTTP коды
│
├── modules/
│   ├── objects/                      # ◀ ФАЗА 1 (первый модуль)
│   │   ├── router.js
│   │   ├── objects.service.js
│   │   ├── objects.schema.js         # Zod-схемы
│   │   └── objects.ws.js             # WebSocket события
│   │
│   ├── schema/                       # ◀ ФАЗА 2 — DDL
│   │   ├── router.js
│   │   ├── schema.service.js
│   │   └── schema.schema.js
│   │
│   ├── reports/                      # ◀ ФАЗА 3
│   │   ├── router.js
│   │   ├── reports.service.js
│   │   └── reports.ws.js             # Стриминг отчётов через WS
│   │
│   ├── files/                        # ◀ ФАЗА 4
│   │   ├── router.js
│   │   └── files.service.js
│   │
│   ├── directories/                  # ◀ ФАЗА 4
│   │   ├── router.js
│   │   └── directories.service.js
│   │
│   ├── auth/                         # ◀ ФАЗА 5
│   │   ├── router.js
│   │   └── auth.service.js
│   │
│   └── admin/                        # ◀ ФАЗА 6
│       ├── router.js
│       └── admin.service.js
│
├── realtime/                         # ◀ ФАЗА 1 (инфраструктура WS)
│   ├── ws-server.js                  # ws-сервер, /api/v2/:db/ws
│   ├── ws-auth.js                    # Аутентификация через первое сообщение
│   └── ws-rooms.js                   # Комнаты по typeId, broadcast helpers
│
└── utils/
    ├── respond.js                    # Стандартный формат ответа
    ├── paginate.js                   # Cursor-based + offset пагинация
    └── sql-guards.js                 # Реэкспорт sanitizeIdentifier/checkInjection
```

---

## Формат данных

### Успех
```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 50,
    "cursor": "eyJpZCI6MTczfQ=="
  }
}
```

### Ошибка
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Object 123 not found",
    "field": "id"
  }
}
```

### Отличия от legacy
| Legacy | V2 |
|--------|-----|
| HTTP 200 на любые ошибки | 400 / 401 / 403 / 404 / 500 |
| `{err: "text"}` | `{ok: false, error: {code, message}}` |
| `text/html` Content-Type на JSON | `application/json` всегда |
| Форм-редиректы после мутаций | JSON everywhere |
| Нет meta/пагинации | `meta.total`, `meta.cursor` всегда |

---

## Аутентификация

- **Bearer token** в `Authorization: Bearer <token>` — основной метод
- **Cookie** `<db>=<token>` — поддерживается для совместимости с фронтом
- Токены хранятся в той же БД что и в legacy — миграция не нужна
- CSRF только для cookie-сессий (не для Bearer)

---

## WebSocket

```
WS /api/v2/:db/ws
```

Аутентификация — первое сообщение после коннекта:
```json
{ "type": "auth", "token": "..." }
```

### Сервер → клиент
```json
{ "type": "object:created",  "data": { "id": 123, "typeId": 45, ... } }
{ "type": "object:updated",  "data": { "id": 123, "changes": { ... } } }
{ "type": "object:deleted",  "data": { "id": 123 } }
{ "type": "schema:changed",  "data": { "typeId": 45, "action": "column_added" } }
{ "type": "report:row",      "data": { "requestId": "abc", "row": { ... } } }
{ "type": "report:done",     "data": { "requestId": "abc", "total": 500 } }
```

### Клиент → сервер
```json
{ "type": "subscribe",   "typeId": 45 }
{ "type": "unsubscribe", "typeId": 45 }
{ "type": "report:run",  "requestId": "abc", "reportId": 7, "filters": { ... } }
```

---

## Фаза 1 — Objects

Покрывает весь `_m_*` из legacy-compat.

### Эндпоинты

| Метод | Путь | Legacy | Описание |
|-------|------|--------|----------|
| GET | `/api/v2/:db/objects` | `_list` | Список объектов |
| GET | `/api/v2/:db/objects/:id` | — | Один объект |
| POST | `/api/v2/:db/objects` | `_m_new` | Создать |
| PATCH | `/api/v2/:db/objects/:id` | `_m_save` | Обновить |
| DELETE | `/api/v2/:db/objects/:id` | `_m_del` | Удалить |
| PUT | `/api/v2/:db/objects/:id/requisites` | `_m_set` | Установить реквизиты (multipart) |
| POST | `/api/v2/:db/objects/:id/move` | `_m_move` | Переместить |
| POST | `/api/v2/:db/objects/:id/reorder` | `_m_ord` + `_m_up` | Изменить порядок |
| PATCH | `/api/v2/:db/objects/:id/id` | `_m_id` | Изменить ID |

### GET /objects — query params

```
?typeId=45            обязательный
?parentId=100         фильтр по родителю
?q=текст              поиск (LIKE)
?page=1               offset-пагинация
?pageSize=50
?cursor=eyJ...        cursor-пагинация (альтернатива)
?sort=name
?order=asc|desc
?FR_date=2024-01-01   фильтры (совместимость с отчётами)
?TO_date=2024-12-31
?EQ_status=5
?LIKE_name=Иван
```

### GET /objects — ответ

```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "typeId": 45,
      "parentId": 100,
      "order": 1,
      "requisites": {
        "phone": "+7 999 123-45-67",
        "status": { "id": 5, "name": "Активен" }
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-03-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 250,
    "page": 1,
    "pageSize": 50,
    "cursor": "eyJpZCI6MTczfQ=="
  }
}
```

### POST /objects — body

```json
{
  "typeId": 45,
  "parentId": 100,
  "requisites": {
    "phone": "+7 999 123-45-67",
    "email": "test@example.com"
  }
}
```

### PATCH /objects/:id — body

```json
{
  "requisites": {
    "phone": "+7 888 000-00-00"
  }
}
```

---

## Фаза 2 — Schema

Покрывает весь `_d_*` из legacy-compat.

### Эндпоинты

| Метод | Путь | Legacy | Описание |
|-------|------|--------|----------|
| GET | `/api/v2/:db/schema` | `terms` | Все типы |
| GET | `/api/v2/:db/schema/:typeId` | `_d_main` | Тип с колонками |
| POST | `/api/v2/:db/schema` | `_d_new` | Создать тип |
| PATCH | `/api/v2/:db/schema/:typeId` | `_d_save` | Обновить тип |
| DELETE | `/api/v2/:db/schema/:typeId` | `_d_del` | Удалить тип |
| POST | `/api/v2/:db/schema/:typeId/columns` | `_d_req` / `_d_ref` | Добавить колонку |
| PATCH | `/api/v2/:db/schema/columns/:reqId` | `_d_attrs` | Изменить атрибуты |
| DELETE | `/api/v2/:db/schema/columns/:reqId` | `_d_del_req` | Удалить колонку |
| POST | `/api/v2/:db/schema/columns/:reqId/reorder` | `_d_ord` / `_d_up` | Порядок |

### GET /schema/:typeId — ответ

```json
{
  "ok": true,
  "data": {
    "id": 45,
    "name": "Контакты",
    "parentId": 10,
    "columns": [
      {
        "id": 7,
        "name": "phone",
        "alias": "Телефон",
        "type": "string",
        "nullable": true,
        "multi": false,
        "order": 1,
        "refTypeId": null
      },
      {
        "id": 8,
        "name": "status",
        "alias": "Статус",
        "type": "reference",
        "nullable": false,
        "multi": false,
        "order": 2,
        "refTypeId": 12
      }
    ]
  }
}
```

---

## Фаза 3 — Reports

### Эндпоинты

| Метод | Путь | Legacy | Описание |
|-------|------|--------|----------|
| GET | `/api/v2/:db/reports` | — | Список отчётов |
| GET | `/api/v2/:db/reports/:reportId` | — | Структура отчёта |
| POST | `/api/v2/:db/reports/:reportId/run` | `POST /:db action=report` | Выполнить |
| GET | `/api/v2/:db/reports/:reportId/export` | `?csv` | Выгрузка CSV/XLSX |
| WS | `/api/v2/:db/ws → report:run` | — | Стриминг строк |

### POST /run — body

```json
{
  "filters": {
    "date": { "from": "2024-01-01", "to": "2024-12-31" },
    "status": { "eq": 5 },
    "name": { "like": "Иван" }
  },
  "page": 1,
  "pageSize": 100
}
```

---

## Фаза 4 — Files & Directories

### Files

| Метод | Путь | Legacy |
|-------|------|--------|
| POST | `/api/v2/:db/files` | `/upload` |
| GET | `/api/v2/:db/files/:filename` | `/download/:filename` |
| DELETE | `/api/v2/:db/files/:filename` | — |

### Directories

| Метод | Путь | Legacy |
|-------|------|--------|
| GET | `/api/v2/:db/directories` | `GET dir_admin` |
| POST | `/api/v2/:db/directories` | `POST dir_admin` |

POST body: `{ "action": "add"|"delete"|"rename"|"move", "id": ..., "name": ..., "parentId": ... }`

---

## Фаза 5 — Auth v2

| Метод | Путь | Legacy |
|-------|------|--------|
| POST | `/api/v2/auth/login` | `POST /:db/auth` |
| POST | `/api/v2/auth/logout` | `GET /:db/exit` |
| POST | `/api/v2/auth/refresh` | — |
| GET | `/api/v2/auth/me` | — |
| POST | `/api/v2/auth/code/request` | `POST /:db/getcode` |
| POST | `/api/v2/auth/code/verify` | `POST /:db/checkcode` |

---

## Фаза 6 — Admin

| Метод | Путь | Legacy |
|-------|------|--------|
| GET | `/api/v2/:db/grants` | `/grants` |
| POST | `/api/v2/:db/admin/backup` | `/backup` |
| POST | `/api/v2/:db/admin/restore` | `/restore` |
| POST | `/api/v2/:db/admin/export/:typeId` | `/export/:typeId` |
| POST | `/api/v2/:db/admin/import` | `/bki-import` |

---

## Порядок реализации

| # | Фаза | Что делаем |
|---|------|------------|
| 1 | Инфраструктура | index.js, middleware/, utils/, realtime/ws-server.js |
| 2 | Objects | modules/objects/ — первый бизнес-модуль |
| 3 | Schema | modules/schema/ |
| 4 | Reports | modules/reports/ + WS стриминг |
| 5 | Files | modules/files/ |
| 6 | Directories | modules/directories/ |
| 7 | Auth v2 | modules/auth/ |
| 8 | Admin | modules/admin/ |
| 9 | OpenAPI | Генерация из Zod-схем, /api/v2/docs |

---

## Ключевые решения

1. **Логику не дублируем** — `*.service.js` импортирует те же `execSql`, `sanitizeIdentifier` что legacy.
2. **Одна БД** — никакой миграции, v2 работает с теми же таблицами.
3. **ws** (нативный) для WebSocket — без socket.io overhead.
4. **Zod** для валидации всех схем.
5. **OpenAPI** генерируется из Zod через `@asteasolutions/zod-to-openapi`.

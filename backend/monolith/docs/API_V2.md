# API v2 - Документация

Полная документация для Integram Standalone API v2 с использованием JSON:API 1.1.

## 📋 Обзор

**Базовый URL**: `/api/v2`  
**Версия**: 2.0.0  
**Статус**: Beta  
**Формат**: JSON:API 1.1  
**Реализация**: См. `/backend/monolith/src/api/v2/`

### Основные возможности

- ✅ JSON:API 1.1 совместимость
- ✅ HATEOAS навигация
- ✅ Строгая типизация данных
- ✅ Пагинация, фильтрация, сортировка
- ✅ Единый формат ошибок
- ✅ OpenAPI 3.1 спецификация
- ✅ Request tracing (X-Request-ID)

---

## 🔐 Аутентификация и авторизация

### Методы передачи токенов

1. **HTTP-Only Cookie** (рекомендуется)
   ```http
   Cookie: integram_access_token=eyJhbGc...
   ```

2. **Authorization Header** (для API клиентов)
   ```http
   Authorization: Bearer eyJhbGc...
   ```

3. **Custom Header** (альтернатива)
   ```http
   X-Integram-Token: eyJhbGc...
   ```

### JWT Token Structure

```json
{
  "payload": {
    "iss": "integram-auth-service",
    "sub": "user:550e8400-e29b-41d4-a716-446655440000",
    "scope": ["read:objects", "write:objects"],
    "context": {
      "userId": "...",
      "username": "...",
      "databases": ["db1", "db2"]
    }
  }
}
```

---

## 📐 Формат JSON:API 1.1

### Успешный ответ

```json
{
  "jsonapi": { "version": "1.1" },
  "data": {
    "type": "integram-object",
    "id": "obj_001",
    "attributes": { ...},
    "relationships": { ...},
    "links": { "self": "/api/v2/..." },
    "meta": { "version": 1 }
  },
  "meta": { "timestamp": "2025-12-26T15:30:00Z" }
}
```

### Ответ с ошибкой

```json
{
  "jsonapi": { "version": "1.1" },
  "errors": [{
    "status": "400",
    "code": "VALIDATION_ERROR",
    "title": "Validation Error",
    "detail": "...",
    "source": { "pointer": "/data/attributes/..." }
  }]
}
```

---

## 🔗 Endpoints

### Health Check

**`GET /api/v2/health`**

Проверка состояния API.

**Ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T15:30:00Z",
  "version": "2.0.0",
  "uptime": 3600,
  "memory": { "used": 128, "total": 256, "unit": "MB" }
}
```

**cURL:**
```bash
curl http://localhost:8081/api/v2/health
```

---

### API Discovery

**`GET /api/v2`**

Получить информацию об API и доступных endpoints.

**Ответ:** Возвращает метаданные API, список доступных endpoints, rate limits.

**cURL:**
```bash
curl http://localhost:8081/api/v2
```

---

### Список таблиц

**`GET /api/v2/integram/databases/{database}/types`**

Получить список всех таблиц в базе данных.

**Параметры:**
- `database` (string) — имя базы данных

**Ответ:**
```json
{
  "data": [
    {
      "type": "integram-type",
      "id": "type_clients",
      "attributes": {
        "typeName": "Клиенты",
        "typeAlias": "clients",
        "objectCount": 150,
        "permissions": { "canRead": true, "canCreate": true }
      },
      "links": {
        "metadata": "/api/v2/integram/databases/db1/types/type_clients/metadata",
        "objects": "/api/v2/integram/databases/db1/types/type_clients/objects"
      }
    }
  ]
}
```

**cURL:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/api/v2/integram/databases/db1/types
```

**Python:**
```python
types = client.request('GET', '/integram/databases/db1/types')
for t in types['data']:
    print(f"{t['attributes']['typeName']}: {t['attributes']['objectCount']} objects")
```

**JavaScript:**
```javascript
const types = await client.request('GET', '/integram/databases/db1/types');
types.data.forEach(t => console.log(`${t.attributes.typeName}: ${t.attributes.objectCount}`));
```

---

### Структура таблицы

**`GET /api/v2/integram/databases/{database}/types/{typeId}/metadata`**

Получить метаданные таблицы — информацию о колонках (реквизитах).

**Параметры:**
- `database` (string) — имя базы данных
- `typeId` (string) — ID типа

**Ответ:**
```json
{
  "data": {
    "type": "integram-type-metadata",
    "id": "type_clients",
    "attributes": {
      "typeInfo": { "typeId": "type_clients", "typeName": "Клиенты" },
      "requisites": [
        {
          "requisiteId": "req_name",
          "requisiteName": "Название",
          "dataType": "string",
          "isRequired": true,
          "constraints": { "minLength": 1, "maxLength": 255 }
        }
      ],
      "subordinates": []
    }
  }
}
```

**cURL:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/api/v2/integram/databases/db1/types/type_clients/metadata
```

---

### Список объектов

**`GET /api/v2/integram/databases/{database}/types/{typeId}/objects`**

Получить список объектов с пагинацией и фильтрацией.

**Параметры:**
- `database` (string) — имя БД
- `typeId` (string) — ID типа
- `page` (int, default: 1) — номер страницы
- `limit` (int, default: 50) — объектов на страницу
- `sort` (string, default: "-updatedAt") — поле сортировки

**Ответ:**
```json
{
  "data": [
    {
      "type": "integram-object",
      "id": "obj_001",
      "attributes": {
        "requisites": {
          "req_name": "ООО \"Ромашка\"",
          "req_email": "info@romashka.ru"
        },
        "displayName": "ООО \"Ромашка\""
      },
      "links": { "self": "/api/v2/integram/databases/db1/objects/obj_001" }
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 50, "total": 2, "totalPages": 1 }
  },
  "links": {
    "self": "...?page=1&limit=50",
    "first": "...?page=1&limit=50",
    "last": "...?page=1&limit=50"
  }
}
```

**cURL:**
```bash
# Базовый запрос
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8081/api/v2/integram/databases/db1/types/type_clients/objects"

# С пагинацией и сортировкой
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8081/api/v2/integram/databases/db1/types/type_clients/objects?page=2&limit=20&sort=-req_updated_at"
```

**Python:**
```python
objects = client.request('GET', '/integram/databases/db1/types/type_clients/objects?page=1&limit=10')
for obj in objects['data']:
    print(obj['attributes']['displayName'])
```

---

### Создание объекта

**`POST /api/v2/integram/databases/{database}/types/{typeId}/objects`**

Создать новый объект.

**Тело запроса:**
```json
{
  "data": {
    "type": "integram-object",
    "attributes": {
      "requisites": {
        "req_name": "ООО \"Тестовая\"",
        "req_email": "test@example.com"
      }
    }
  }
}
```

**Ответ (201 Created):**
```json
{
  "data": {
    "type": "integram-object",
    "id": "obj_new_123",
    "attributes": { ...},
    "links": { "self": "/api/v2/integram/databases/db1/objects/obj_new_123" }
  }
}
```

**Headers:** `Location: /api/v2/integram/databases/db1/objects/obj_new_123`

**cURL:**
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{"data":{"type":"integram-object","attributes":{"requisites":{"req_name":"Test","req_email":"test@example.com"}}}}' \
  http://localhost:8081/api/v2/integram/databases/db1/types/type_clients/objects
```

**Python:**
```python
data = {
    "data": {
        "type": "integram-object",
        "attributes": {
            "requisites": {"req_name": "Test", "req_email": "test@example.com"}
        }
    }
}
response = client.request('POST', '/integram/databases/db1/types/type_clients/objects', json=data)
print(f"Created: {response['data']['id']}")
```

---

### Получение объекта

**`GET /api/v2/integram/databases/{database}/objects/{objectId}`**

Получить объект по ID.

**cURL:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/api/v2/integram/databases/db1/objects/obj_001
```

---

### Обновление объекта

**`PATCH /api/v2/integram/databases/{database}/objects/{objectId}`**

Обновить объект (частичное обновление).

**Тело запроса:**
```json
{
  "data": {
    "type": "integram-object",
    "id": "obj_001",
    "attributes": {
      "requisites": { "req_email": "new@example.com" }
    }
  }
}
```

**cURL:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{"data":{"type":"integram-object","id":"obj_001","attributes":{"requisites":{"req_email":"new@example.com"}}}}' \
  http://localhost:8081/api/v2/integram/databases/db1/objects/obj_001
```

---

### Удаление объекта

**`DELETE /api/v2/integram/databases/{database}/objects/{objectId}`**

Удалить объект.

**Ответ:** 204 No Content

**cURL:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/api/v2/integram/databases/db1/objects/obj_001
```

---

## 📄 Пагинация и фильтрация

### Пагинация

- `page` (int) — номер страницы (начинается с 1)
- `limit` (int) — объектов на страницу (default: 50, max: 100)

### Сортировка

- По возрастанию: `sort=field_name`
- По убыванию: `sort=-field_name`
- Множественная: `sort=field1,-field2`

**Примеры:**
```bash
?sort=req_name                # По имени (возр.)
?sort=-req_updated_at         # По дате обновления (убыв.)
?sort=req_status,-req_name    # Статус (возр.), имя (убыв.)
```

### Фильтрация

```bash
?filter[req_status]=active           # Точное совпадение
?filter[req_email][like]=romashka    # Содержит
?filter[req_created_at][gte]=2025-01-01  # Больше или равно
```

---

## ⚠️ Коды ошибок

### HTTP статус коды

| Код | Название | Описание |
|-----|----------|----------|
| 200 | OK | Успешный запрос |
| 201 | Created | Ресурс создан |
| 204 | No Content | Успешное удаление |
| 400 | Bad Request | Неверный формат |
| 401 | Unauthorized | Требуется авторизация |
| 403 | Forbidden | Доступ запрещен |
| 404 | Not Found | Не найдено |
| 422 | Unprocessable Entity | Ошибка валидации |
| 500 | Internal Server Error | Внутренняя ошибка |

### Коды ошибок приложения

- `VALIDATION_ERROR` — ошибка валидации
- `AUTHENTICATION_REQUIRED` — требуется аутентификация
- `INVALID_TOKEN` — неверный токен
- `RESOURCE_NOT_FOUND` — ресурс не найден
- `RATE_LIMIT_EXCEEDED` — превышен лимит
- `INTERNAL_SERVER_ERROR` — внутренняя ошибка

**Пример ошибки:**
```json
{
  "errors": [{
    "status": "422",
    "code": "VALIDATION_ERROR",
    "title": "Validation Error",
    "detail": "Field 'email' must be valid",
    "source": { "pointer": "/data/attributes/requisites/req_email" }
  }]
}
```

---

## 💻 Примеры использования

### Python клиент

```python
import requests

class IntegramAPIClient:
    def __init__(self, base_url="http://localhost:8081/api/v2"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/vnd.api+json',
            'Accept': 'application/vnd.api+json'
        })

    def set_token(self, token):
        self.session.headers['Authorization'] = f'Bearer {token}'

    def request(self, method, endpoint, **kwargs):
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json() if response.status_code != 204 else None

# Использование
client = IntegramAPIClient()
client.set_token('YOUR_TOKEN')

# Получить таблицы
types = client.request('GET', '/integram/databases/db1/types')

# Создать объект
data = {
    "data": {
        "type": "integram-object",
        "attributes": {
            "requisites": {"req_name": "Test", "req_email": "test@example.com"}
        }
    }
}
new_obj = client.request('POST', '/integram/databases/db1/types/type_clients/objects', json=data)
```

### JavaScript клиент

```javascript
class IntegramAPIClient {
  constructor(baseURL = 'http://localhost:8081/api/v2') {
    this.baseURL = baseURL;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, body = null) {
    const headers = {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json'
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? null : response.json();
  }
}

// Использование
const client = new IntegramAPIClient();
client.setToken('YOUR_TOKEN');

const types = await client.request('GET', '/integram/databases/db1/types');
```

---

## 📚 Дополнительные ресурсы

### Документация

- [JSON:API 1.1 Specification](https://jsonapi.org/format/)
- [MODERN_API_FORMAT.md](../../docs/api/MODERN_API_FORMAT.md) — полная спецификация
- [EXAMPLES.md](../../docs/api/EXAMPLES.md) — дополнительные примеры
- [openapi-v2.yaml](../../docs/api/openapi-v2.yaml) — OpenAPI спецификация

### OpenAPI спецификация

- YAML: `GET /api/v2/openapi.yaml`
- JSON: `GET /api/v2/openapi.json`

### Request Tracing

Каждый запрос получает уникальный `X-Request-ID`:

```http
GET /api/v2/integram/databases/db1/types
X-Request-ID: req_1735225800_abc123
```

---

**Версия документации**: 1.0.0  
**Дата обновления**: 2025-12-26  
**Реализация**: `/backend/monolith/src/api/v2/`

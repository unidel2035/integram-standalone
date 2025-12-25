# HTTP MCP Server - Руководство по использованию

## Обзор

Integram MCP Server доступен через HTTP API по адресу:
```
https://dev.drondoc.ru/api/mcp/integram
```

Это позволяет использовать MCP инструменты без необходимости запускать локальный Node.js процесс.

## 🏗️ Распределённая архитектура

**Важно**: Проект использует распределённую архитектуру, где:

- **Claude CLI** работает на одном сервере (локальная машина, CI/CD)
- **Backend orchestrator** работает на `dev.drondoc.ru`
- **MCP инструменты** доступны через HTTP мост

Подробное описание архитектуры: [DISTRIBUTED_MCP_ARCHITECTURE.md](./DISTRIBUTED_MCP_ARCHITECTURE.md)

### Схема взаимодействия

```
┌─────────────────────────────┐
│  Claude CLI (локально)      │
│  ├─ http-mcp-bridge.js      │ ← stdio
└──────────┬──────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────┐
│  Backend (dev.drondoc.ru)   │
│  ├─ Express API             │
│  └─ integram-server.js      │ ← stdio
└──────────┬──────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────┐
│  Integram API               │
│  https://dronedoc.ru        │
└─────────────────────────────┘
```

## API Эндпоинты

### 1. Список инструментов

**GET** `https://dev.drondoc.ru/api/mcp/integram/tools`

**Ответ:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "integram_authenticate",
      "description": "Authenticate with Integram API and establish a session",
      "inputSchema": {
        "type": "object",
        "properties": { ... },
        "required": ["serverURL", "database", "login", "password"]
      }
    },
    ...
  ],
  "count": 27
}
```

### 2. Выполнение инструмента

**POST** `https://dev.drondoc.ru/api/mcp/integram/execute`

**Тело запроса:**
```json
{
  "toolName": "integram_authenticate",
  "arguments": {
    "serverURL": "https://dronedoc.ru",
    "database": "a2025",
    "login": "d",
    "password": "d"
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"token\":\"...\",\"xsrf\":\"...\",\"userId\":123,...}"
      }
    ]
  },
  "toolName": "integram_authenticate"
}
```

## Примеры использования

### Пример 1: Аутентификация

```bash
curl -X POST https://dev.drondoc.ru/api/mcp/integram/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "integram_authenticate",
    "arguments": {
      "serverURL": "https://dronedoc.ru",
      "database": "a2025",
      "login": "your-username",
      "password": "your-password"
    }
  }'
```

### Пример 2: Получение словаря типов

```bash
# Сначала установите контекст (если уже есть токен)
curl -X POST https://dev.drondoc.ru/api/mcp/integram/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "integram_set_context",
    "arguments": {
      "serverURL": "https://dronedoc.ru",
      "database": "a2025",
      "token": "your-token",
      "xsrfToken": "your-xsrf"
    }
  }'

# Затем получите словарь
curl -X POST https://dev.drondoc.ru/api/mcp/integram/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "integram_get_dictionary",
    "arguments": {}
  }'
```

### Пример 3: Создание объекта

```bash
curl -X POST https://dev.drondoc.ru/api/mcp/integram/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "integram_create_object",
    "arguments": {
      "typeId": 42,
      "value": "Новый проект",
      "requisites": {
        "101": "Описание проекта",
        "102": "2025-01-15"
      }
    }
  }'
```

### Пример 4: Получение списка объектов

```bash
curl -X POST https://dev.drondoc.ru/api/mcp/integram/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "integram_get_object_list",
    "arguments": {
      "typeId": 42,
      "params": {
        "offset": 0,
        "limit": 50
      }
    }
  }'
```

## Настройка для Claude Code

### Вариант 1: Через HTTP Bridge (Рекомендуется)

Создайте файл `.claude/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "integram-remote": {
      "command": "node",
      "args": [
        "/home/user/dronedoc2025/backend/monolith/src/services/mcp/http-mcp-bridge.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://dev.drondoc.ru",
        "MCP_API_PATH": "/api/mcp/integram"
      }
    }
  }
}
```

### Вариант 2: Для Claude Desktop

Добавьте в файл конфигурации Claude Desktop:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "integram-remote": {
      "command": "node",
      "args": [
        "/absolute/path/to/dronedoc2025/backend/monolith/src/services/mcp/http-mcp-bridge.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://dev.drondoc.ru",
        "MCP_API_PATH": "/api/mcp/integram"
      }
    }
  }
}
```

## Использование в Claude

После настройки вы можете использовать MCP инструменты прямо в чате с Claude:

### Пример диалога:

**Вы:** Аутентифицируйся в Integram на сервере https://dronedoc.ru, база данных a2025, логин d, пароль d

**Claude:** *Использует инструмент `integram_authenticate` через HTTP MCP сервер*

Результат аутентификации:
- Токен: abc123...
- Пользователь: Администратор (ID: 1)
- Роль: admin

**Вы:** Покажи все типы в базе данных

**Claude:** *Использует инструмент `integram_get_dictionary`*

Найдено 15 типов:
1. Проекты (ID: 42)
2. Задачи (ID: 43)
...

**Вы:** Создай новый объект в типе Проекты с названием "Тестовый проект"

**Claude:** *Использует инструмент `integram_create_object`*

Объект создан успешно:
- ID: 1234
- Название: Тестовый проект
- Тип: Проекты (42)

## Доступные инструменты (27 штук)

### Аутентификация (2)
- `integram_authenticate` - Аутентификация с логином/паролем
- `integram_set_context` - Установка контекста из существующей сессии

### DDL операции (8)
- `integram_create_type` - Создать тип
- `integram_save_type` - Сохранить тип
- `integram_delete_type` - Удалить тип
- `integram_add_requisite` - Добавить реквизит
- `integram_delete_requisite` - Удалить реквизит
- `integram_save_requisite_alias` - Сохранить алиас реквизита
- `integram_toggle_requisite_null` - Переключить NULL constraint
- `integram_toggle_requisite_multi` - Переключить multiselect

### DML операции (6)
- `integram_create_object` - Создать объект
- `integram_save_object` - Сохранить объект
- `integram_set_object_requisites` - Установить реквизиты
- `integram_delete_object` - Удалить объект
- `integram_move_object_up` - Переместить вверх
- `integram_move_object_to_parent` - Переместить к другому parent

### Запросы (7)
- `integram_get_dictionary` - Получить словарь типов
- `integram_get_type_metadata` - Получить метаданные типа
- `integram_get_object_list` - Получить список объектов
- `integram_get_object_edit_data` - Получить данные для редактирования
- `integram_get_type_editor_data` - Получить данные редактора типов
- `integram_execute_report` - Выполнить отчёт
- `integram_get_reference_options` - Получить опции для dropdown

### Multiselect (2)
- `integram_add_multiselect_item` - Добавить элемент
- `integram_remove_multiselect_item` - Удалить элемент

### Файлы (2)
- `integram_get_dir_admin` - Получить содержимое директории
- `integram_create_backup` - Создать бэкап

## Преимущества HTTP MCP сервера

✅ **Не требует локального запуска** - сервер уже работает на dev.drondoc.ru
✅ **Централизованное управление** - один сервер для всех пользователей
✅ **Единая аутентификация** - сессии управляются на сервере
✅ **Быстрый доступ** - нет задержек на запуск локального процесса
✅ **Логирование** - все операции логируются на сервере

## Безопасность

⚠️ **Важные замечания:**

1. **HTTPS используется** - все данные передаются в зашифрованном виде
2. **Не храните пароли** - используйте токены для последующих запросов
3. **Проверяйте права доступа** - убедитесь что используете нужную БД
4. **Логи операций** - все операции записываются на сервере

## Отладка

### Проверка доступности сервера

```bash
curl https://dev.drondoc.ru/api/health
```

Ожидаемый ответ:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T10:00:00.000Z",
  "uptime": 12345.67,
  "coordinator": "running",
  "messageQueue": "running"
}
```

### Проверка списка инструментов

```bash
curl https://dev.drondoc.ru/api/mcp/integram/tools | jq '.tools | length'
```

Должно вернуть: `27`

### Логи HTTP Bridge

Если используете HTTP bridge, логи доступны в stderr:

```bash
node backend/monolith/src/services/mcp/http-mcp-bridge.js 2>&1 | grep "Error"
```

## Поддержка

При возникновении проблем:

1. Проверьте доступность сервера (см. "Отладка")
2. Убедитесь что используете правильные URL и параметры
3. Проверьте логи на сервере
4. Создайте issue в репозитории

## См. также

- [Локальный MCP сервер](./INTEGRAM_MCP_README.md)
- [Настройка для Claude Code](./CLAUDE_CODE_SETUP.md)
- [Примеры использования](../../examples/mcp-client-example.js)

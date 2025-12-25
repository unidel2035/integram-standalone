# Настройка Integram MCP Server для Claude Code

## Обзор

Этот документ описывает, как подключить Integram MCP Server к Claude Code (CLI) или Claude Desktop для использования инструментов Integram API прямо из интерфейса Claude.

## Что даёт MCP сервер?

MCP (Model Context Protocol) сервер позволяет Claude AI:

- **Работать с базой данных Integram** через естественный язык
- **Создавать и редактировать структуру данных** (типы, реквизиты)
- **Управлять объектами** (создание, редактирование, удаление)
- **Выполнять запросы и отчёты** из Integram
- **Получать метаданные** о типах и объектах

Вместо того, чтобы вручную писать API запросы, вы просто говорите Claude:
- "Покажи мне все типы в базе данных"
- "Создай новый объект типа Projects с названием 'Новый проект'"
- "Получи данные объекта с ID 123"

И Claude использует MCP инструменты для выполнения этих действий.

## Установка для Claude Code (CLI)

### 1. Проверьте, что MCP сервер работает

```bash
# Перейдите в директорию monolith
cd /home/user/dronedoc2025/backend/monolith

# Установите зависимости (если ещё не установлены)
npm install

# Запустите тесты, чтобы убедиться, что сервер работает
npm test -- src/services/mcp/__tests__/integram-server.test.js
```

Вы должны увидеть:
```
✓ 14 passed (14)
```

### 2. Создайте конфигурацию для Claude Code

Создайте файл `.claude/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "integram": {
      "command": "node",
      "args": [
        "/home/user/dronedoc2025/backend/monolith/src/services/mcp/integram-server.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### 3. Проверьте подключение

Запустите Claude Code и попросите его показать доступные MCP инструменты:

```
Какие MCP инструменты у тебя есть для работы с Integram?
```

Claude должен перечислить 28 инструментов, включая:
- `integram_authenticate`
- `integram_get_dictionary`
- `integram_create_object`
- и другие

## Установка для Claude Desktop

### 1. Найдите файл конфигурации Claude Desktop

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Добавьте Integram MCP сервер

Откройте файл конфигурации и добавьте (или обновите) секцию `mcpServers`:

```json
{
  "mcpServers": {
    "integram": {
      "command": "node",
      "args": [
        "/absolute/path/to/dronedoc2025/backend/monolith/src/services/mcp/integram-server.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Важно:** Замените `/absolute/path/to/dronedoc2025` на реальный абсолютный путь к вашему проекту.

### 3. Перезапустите Claude Desktop

Закройте и снова откройте Claude Desktop, чтобы конфигурация применилась.

### 4. Проверьте подключение

В чате Claude Desktop спросите:
```
Какие MCP серверы у тебя подключены?
```

Вы должны увидеть "integram" в списке.

## Использование MCP сервера

### Пример 1: Аутентификация

```
Аутентифицируйся в Integram:
- Сервер: https://dronedoc.ru
- База данных: a2025
- Логин: admin
- Пароль: your-password
```

Claude вызовет инструмент `integram_authenticate` и покажет результат.

### Пример 2: Получение списка типов

```
Покажи мне все типы в базе данных Integram
```

Claude вызовет `integram_get_dictionary` и отобразит список типов в удобном формате.

### Пример 3: Создание нового объекта

```
Создай новый объект:
- Тип: 42 (Projects)
- Название: "Мой новый проект"
- Описание (реквизит 101): "Тестовый проект"
- Дата начала (реквизит 102): "2025-01-15"
```

Claude вызовет `integram_create_object` с правильными параметрами.

### Пример 4: Получение метаданных типа

```
Покажи метаданные типа с ID 42, включая все реквизиты
```

Claude вызовет `integram_get_type_metadata`.

### Пример 5: Выполнение отчёта

```
Выполни отчёт с ID 10 и покажи результаты
```

Claude вызовет `integram_execute_report`.

## Доступные инструменты

### Аутентификация
- `integram_authenticate` - Аутентификация с логином и паролем
- `integram_set_context` - Установка контекста из существующей сессии

### DDL операции (структура БД)
- `integram_create_type` - Создать новый тип (таблицу)
- `integram_save_type` - Сохранить свойства типа
- `integram_delete_type` - Удалить тип
- `integram_add_requisite` - Добавить реквизит (колонку)
- `integram_delete_requisite` - Удалить реквизит
- `integram_save_requisite_alias` - Сохранить алиас реквизита
- `integram_toggle_requisite_null` - Переключить NULL constraint
- `integram_toggle_requisite_multi` - Переключить multiselect

### DML операции (данные)
- `integram_create_object` - Создать объект (запись)
- `integram_save_object` - Сохранить объект
- `integram_set_object_requisites` - Установить реквизиты объекта
- `integram_delete_object` - Удалить объект
- `integram_move_object_up` - Переместить объект вверх
- `integram_move_object_to_parent` - Переместить в другой parent

### Запросы
- `integram_get_dictionary` - Получить список независимых типов
- `integram_get_type_metadata` - Получить метаданные типа
- `integram_get_object_list` - Получить список объектов типа
- `integram_get_object_edit_data` - Получить данные для редактирования объекта
- `integram_get_type_editor_data` - Получить данные редактора типов
- `integram_execute_report` - Выполнить отчёт
- `integram_get_reference_options` - Получить опции для dropdown'ов

### Multiselect
- `integram_add_multiselect_item` - Добавить элемент в multiselect
- `integram_remove_multiselect_item` - Удалить элемент из multiselect

### Файлы
- `integram_get_dir_admin` - Получить содержимое директории
- `integram_create_backup` - Создать бэкап базы данных

## Отладка

### Проверка работы сервера

Запустите сервер напрямую для тестирования:

```bash
node /home/user/dronedoc2025/backend/monolith/src/services/mcp/integram-server.js
```

Сервер должен вывести:
```
Integram MCP Server running on stdio
```

Нажмите Ctrl+C для выхода.

### Проверка с примером клиента

Запустите пример клиента:

```bash
cd /home/user/dronedoc2025/backend/monolith
node examples/mcp-client-example.js
```

Вы должны увидеть список всех инструментов и примеры их использования.

### Логи

Если MCP сервер не работает в Claude Code/Desktop, проверьте логи:

**Claude Code:**
```bash
# Логи обычно в ~/.claude/logs/
tail -f ~/.claude/logs/mcp.log
```

**Claude Desktop:**
- Откройте Developer Tools (View → Developer Tools)
- Проверьте консоль на наличие ошибок MCP

### Типичные проблемы

1. **"MCP server not found"**
   - Проверьте абсолютный путь к `integram-server.js`
   - Убедитесь, что Node.js установлен и доступен в PATH

2. **"Cannot connect to MCP server"**
   - Проверьте, что `npm install` выполнен в `backend/monolith`
   - Убедитесь, что все зависимости установлены

3. **"Authentication failed"**
   - Проверьте правильность URL, базы данных, логина и пароля
   - Убедитесь, что сервер Integram доступен

4. **"Tool not found"**
   - Перезапустите Claude Code/Desktop
   - Проверьте, что конфигурация MCP применилась

## Безопасность

⚠️ **Важно:**

1. **Не храните пароли в конфигурации** - используйте только логин, а пароль вводите через Claude
2. **Проверяйте все действия** - перед выполнением DDL операций (создание/удаление типов)
3. **Используйте тестовую БД** - для экспериментов используйте отдельную тестовую базу
4. **Ограничьте доступ** - используйте учётную запись с минимально необходимыми правами

## Дополнительная информация

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Integram API Documentation](../../../docs/integram-api.md)
- [MCP Server README](./INTEGRAM_MCP_README.md)
- [Test Examples](./__tests__/integram-server.test.js)

## Поддержка

Если у вас возникли проблемы:

1. Проверьте раздел "Отладка" выше
2. Запустите тесты: `npm test -- src/services/mcp/__tests__/integram-server.test.js`
3. Запустите пример клиента: `node examples/mcp-client-example.js`
4. Создайте issue в репозитории с описанием проблемы

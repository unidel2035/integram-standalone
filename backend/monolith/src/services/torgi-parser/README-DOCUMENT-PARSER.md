# Torgi.gov.ru Document Parser

## Обзор

Парсер документов для torgi.gov.ru с использованием Playwright MCP и сохранением в Integram.

## Issue #4660

**Задача**: Хранить документы https://dronedoc.ru/torgi/object/561/?F_U=2555, парсить со страниц типа https://torgi.gov.ru/new/public/lots/lot/22000010600000000293_6/(lotInfo:docs)#lotInfoSection-docs с использованием MCP Integram и MCP Playwright.

**Решение**: Создан модуль `playwright-document-parser.js` для парсинга документов со страниц torgi.gov.ru с использованием Playwright MCP и интеграция с существующим TorgiParserService для сохранения в Integram.

## Файлы

### 1. `playwright-document-parser.js`

Основной модуль парсинга документов с веб-страниц.

**Функции**:
- `parseDocumentsFromPage(playwrightMCP, lotUrl)` - парсинг через accessibility snapshot
- `parseDocumentsViaEval(playwrightMCP)` - парсинг через JavaScript evaluation
- `parseDocumentsAuto(playwrightMCP, lotUrl)` - автоматический выбор метода
- `extractLotId(url)` - извлечение ID лота из URL

**Пример использования**:

```javascript
import { parseDocumentsAuto } from './playwright-document-parser.js'

// С Playwright MCP client
const result = await parseDocumentsAuto(playwrightMCP, lotUrl)

console.log(`Found ${result.documentsCount} documents`)
result.documents.forEach(doc => {
  console.log(`- ${doc.name}: ${doc.url}`)
})
```

### 2. API Endpoint

**POST /api/torgi-parser/parse-documents-playwright**

Парсинг документов лота с использованием Playwright MCP.

**Request**:
```json
{
  "lotUrl": "https://torgi.gov.ru/new/public/lots/lot/ID/(lotInfo:docs)",
  "saveToIntegram": true,
  "login": "d",
  "password": "d"
}
```

**Note**: Endpoint пока возвращает инструкцию, так как Playwright MCP должен быть вызван из Claude Code, а не из API.

### 3. Тестовые скрипты

- `examples/test-torgi-document-parser.js` - тест с mock данными
- `examples/parse-torgi-documents-with-mcp.md` - подробная документация

## Использование с Claude Code

### Шаг 1: Навигация и snapshot

```javascript
// Открыть страницу с документами
await mcp__playwright__browser_navigate({
  url: 'https://torgi.gov.ru/new/public/lots/lot/22000010600000000293_6/(lotInfo:docs)'
})

// Подождать загрузки
await mcp__playwright__browser_wait_for({ time: 3 })

// Получить snapshot
const snapshot = await mcp__playwright__browser_snapshot()
```

### Шаг 2: Парсинг документов

```javascript
// Импорт функций парсера
import { parseDocumentsFromPage } from './playwright-document-parser.js'

// Парсинг из snapshot
const documents = extractDocumentsFromSnapshot(snapshot)
```

### Шаг 3: Сохранение в Integram

```javascript
// Аутентификация
await mcp__integram__integram_authenticate({
  serverURL: 'https://dronedoc.ru',
  database: 'torgi',
  login: 'd',
  password: 'd'
})

// Создание документов
for (const doc of documents) {
  await mcp__integram__integram_create_object({
    typeId: 561,  // Таблица документов
    value: doc.name,
    parentId: lotId,  // ID родительского лота
    requisites: {
      '564': docTypeId,  // Тип документа
      '568': doc.url,    // URL
      '569': doc.size    // Размер (опционально)
    }
  })
}
```

## Структура данных

### Integram: Таблица 561 (Документы)

| Реквизит | ID | Тип | Описание |
|----------|----|----|----------|
| Название | - | value | Название документа |
| Родитель | - | parent | ID лота (таблица 346) |
| Тип документа | 564 | REF→563 | Ссылка на справочник |
| URL | 568 | SHORT | Ссылка для скачивания |
| Размер файла | 569 | NUMBER | Размер в байтах |
| Дата публикации | 570 | DATETIME | Дата публикации |

### Справочник 563 (Типы документов)

| ID | Тип |
|----|-----|
| 571 | Иное |
| 572 | Форма заявки |
| 573 | Документация аукциона |
| 574 | Проект договора |
| 575 | Извещение о торгах |
| 576 | Протокол |
| 577 | Разъяснение |
| 578 | ЕГРН |

## Определение типа документа

Парсер автоматически определяет тип по ключевым словам:

```javascript
"Документация аукциона.pdf" → 573 (Документация аукциона)
"Форма заявки.docx" → 572 (Форма заявки)
"Проект договора аренды.doc" → 574 (Проект договора)
"Выписка из ЕГРН.pdf" → 578 (ЕГРН)
"Приложение 1.pdf" → 571 (Иное)
```

## Парсинг размера файла

Поддерживаемые форматы:

```javascript
"2.5 МБ" → 2621440 байт
"150 КБ" → 153600 байт
"1.2 GB" → 1288490189 байт
"500 bytes" → 500 байт
```

## Интеграция с TorgiParserService

Существующий TorgiParserService уже поддерживает сохранение документов:

```javascript
import { TorgiParserService } from './TorgiParserService.js'

const parser = new TorgiParserService()
await parser.initIntegram('d', 'd')

// Сохранение документов лота
await parser.saveLotDocuments(lotId, documents)
```

Функции TorgiParserService для работы с документами:
- `getLotDocuments(lotId)` - получение документов через API
- `extractDocumentsFromLotData(lotData)` - извлечение из JSON
- `saveDocument(lotId, docData)` - сохранение одного документа
- `saveLotDocuments(lotId, documents)` - сохранение всех документов
- `detectDocumentType(typeStr)` - определение типа документа

## Примеры URL

### Torgi.gov.ru (для парсинга)

```
https://torgi.gov.ru/new/public/lots/lot/22000010600000000293_6/(lotInfo:docs)#lotInfoSection-docs
https://torgi.gov.ru/new/public/lots/lot/12345678901234567890_1/(lotInfo:docs)
```

### DronDoc Integram (сохранённые данные)

```
https://dronedoc.ru/torgi/object/561/?F_U=2555  (Документы)
https://dronedoc.ru/torgi/object/346/?F_U=2555  (Лоты)
```

## Обработка ошибок

### Timeout при навигации

```javascript
try {
  await mcp__playwright__browser_navigate({ url: lotUrl })
} catch (error) {
  if (error.message.includes('Timeout')) {
    // Retry или использовать прокси
    console.error('Site timeout, try using proxy')
  }
}
```

### Документы не найдены

1. Проверьте URL - должен содержать раздел документов
2. Увеличьте время ожидания: `browser_wait_for({ time: 5 })`
3. Попробуйте альтернативный метод (eval)
4. Проверьте HTML-структуру страницы

### Ошибки сохранения в Integram

1. Проверьте аутентификацию (login/password)
2. Убедитесь, что лот существует в таблице 346
3. Проверьте requisite IDs (564, 568, 569, 570)
4. Убедитесь, что тип документа существует в справочнике 563

## Дальнейшая разработка

### TODO

- [ ] Полная интеграция Playwright MCP в API endpoint
- [ ] Автоматическое скачивание файлов документов
- [ ] OCR для извлечения текста из PDF
- [ ] Индексация содержимого документов для поиска
- [ ] Валидация наличия обязательных документов
- [ ] Поддержка batch-парсинга (множество лотов)
- [ ] Мониторинг новых документов (webhook/polling)

### Расширения

**1. Скачивание файлов**:
```javascript
async function downloadDocument(doc) {
  const response = await fetch(doc.url)
  const buffer = await response.arrayBuffer()
  await fs.writeFile(`./downloads/${doc.name}`, buffer)
}
```

**2. Извлечение текста из PDF**:
```javascript
import pdfParse from 'pdf-parse'

const dataBuffer = await fs.readFile(pdfPath)
const pdfData = await pdfParse(dataBuffer)
const text = pdfData.text
```

**3. Валидация документов**:
```javascript
const REQUIRED_DOCS = [
  'документация аукциона',
  'форма заявки',
  'проект договора'
]

function validateDocuments(documents) {
  const foundTypes = new Set(documents.map(d => d.type))
  const missing = REQUIRED_DOCS.filter(type => !foundTypes.has(type))

  if (missing.length > 0) {
    throw new Error(`Missing required documents: ${missing.join(', ')}`)
  }
}
```

## Поддержка

- GitHub Issue: #4660
- MCP Integram: https://dronedoc.ru (database: torgi, login: d, password: d)
- MCP Playwright: через Claude Code

## Лицензия

MIT

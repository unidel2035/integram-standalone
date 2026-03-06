/**
 * AI Block Service
 * Handles context extraction, prompt building, and response parsing for AI blocks
 * Issue #6572: Enhanced context understanding for AI blocks
 */

import { logger } from '@/utils/logger'

/**
 * Extract structured document context for AI blocks
 * @param {Object} quillEditor - Quill editor instance
 * @param {string} documentTitle - Document title
 * @param {number|null} savedDocumentId - Document ID in Integram
 * @param {string|null} selectedFolder - Current folder
 * @returns {Object} Structured document context
 */
export function getDocumentContext(quillEditor, documentTitle, savedDocumentId = null, selectedFolder = null) {
  if (!quillEditor) {
    logger.warn('aiBlockService: getDocumentContext called without quillEditor')
    return {
      title: documentTitle || 'Без названия',
      content: { full: '', plainText: '', surrounding: '' },
      structure: { headings: [], lists: [], tables: [], blocks: [] },
      cursor: { position: 0 },
      metadata: {}
    }
  }

  try {
    const selection = quillEditor.getSelection()
    const cursorPosition = selection ? selection.index : quillEditor.getLength()

    // Get full content
    const fullHtml = quillEditor.root.innerHTML
    const plainText = quillEditor.getText()
    const contentLength = plainText.length

    // Extract structure
    const structure = extractDocumentStructure(quillEditor)

    // Get surrounding context (±500 characters around cursor)
    const surroundingStart = Math.max(0, cursorPosition - 500)
    const surroundingEnd = Math.min(contentLength, cursorPosition + 500)
    const surroundingText = plainText.substring(surroundingStart, surroundingEnd).trim()

    // Determine cursor context
    const cursorContext = analyzeCursorContext(quillEditor, cursorPosition, structure)

    // Metadata
    const metadata = {
      documentId: savedDocumentId,
      folder: selectedFolder,
      wordCount: countWords(plainText),
      characterCount: contentLength,
      timestamp: new Date().toISOString()
    }

    const context = {
      title: documentTitle || 'Без названия',
      content: {
        full: fullHtml,
        plainText: plainText.substring(0, 12000), // Max 12000 chars
        surrounding: surroundingText
      },
      structure,
      cursor: {
        position: cursorPosition,
        ...cursorContext
      },
      metadata
    }

    logger.info('aiBlockService: Document context extracted', {
      titleLength: context.title.length,
      plainTextLength: context.content.plainText.length,
      headingsCount: structure.headings.length,
      listsCount: structure.lists.length,
      tablesCount: structure.tables.length,
      cursorPosition
    })

    return context
  } catch (error) {
    logger.error('aiBlockService: Error extracting document context', error)
    return {
      title: documentTitle || 'Без названия',
      content: { full: '', plainText: '', surrounding: '' },
      structure: { headings: [], lists: [], tables: [], blocks: [] },
      cursor: { position: 0 },
      metadata: {}
    }
  }
}

/**
 * Extract document structure (headings, lists, tables, blocks)
 * @param {Object} quillEditor - Quill editor instance
 * @returns {Object} Document structure
 */
function extractDocumentStructure(quillEditor) {
  const structure = {
    headings: [],
    lists: [],
    tables: [],
    blocks: []
  }

  try {
    const delta = quillEditor.getContents()
    let currentPosition = 0

    delta.ops.forEach((op, index) => {
      const length = op.insert?.length || 1

      // Extract headings (h1, h2, h3, h4, h5, h6)
      if (op.attributes?.header) {
        const level = op.attributes.header
        const text = typeof op.insert === 'string' ? op.insert.trim() : ''
        if (text) {
          structure.headings.push({
            level,
            text,
            position: currentPosition
          })
        }
      }

      // Extract lists (ul, ol)
      if (op.attributes?.list) {
        const listType = op.attributes.list // 'bullet' or 'ordered'
        const text = typeof op.insert === 'string' ? op.insert.trim() : ''

        // Check if this is a new list or continuation
        const lastList = structure.lists[structure.lists.length - 1]
        if (lastList && lastList.type === listType &&
            currentPosition - lastList.endPosition < 10) {
          // Continue existing list
          lastList.items++
          lastList.endPosition = currentPosition + length
        } else {
          // Start new list
          structure.lists.push({
            type: listType === 'ordered' ? 'ol' : 'ul',
            items: 1,
            position: currentPosition,
            endPosition: currentPosition + length
          })
        }
      }

      // Extract embedded tables (Integram tables)
      if (op.insert && typeof op.insert === 'object' && op.insert['integram-table']) {
        const tableData = op.insert['integram-table']
        structure.tables.push({
          id: tableData.tableId || tableData.id,
          name: tableData.tableName || `Таблица ${tableData.tableId || tableData.id}`,
          mode: tableData.mode || 'simple',
          position: currentPosition
        })
      }

      // Extract custom blocks (callouts, checklists, etc.)
      if (op.insert && typeof op.insert === 'object') {
        const blockTypes = {
          'coda-callout': 'callout',
          'coda-checklist': 'checklist',
          'coda-quote': 'quote',
          'coda-button': 'button',
          'coda-toggle': 'toggle',
          'coda-card': 'card'
        }

        Object.keys(blockTypes).forEach(blotName => {
          if (op.insert[blotName]) {
            structure.blocks.push({
              type: blockTypes[blotName],
              data: op.insert[blotName],
              position: currentPosition
            })
          }
        })
      }

      currentPosition += length
    })

    logger.info('aiBlockService: Document structure extracted', {
      headings: structure.headings.length,
      lists: structure.lists.length,
      tables: structure.tables.length,
      blocks: structure.blocks.length
    })

  } catch (error) {
    logger.error('aiBlockService: Error extracting document structure', error)
  }

  return structure
}

/**
 * Analyze cursor context (nearest heading, inside list, etc.)
 * @param {Object} quillEditor - Quill editor instance
 * @param {number} cursorPosition - Cursor position
 * @param {Object} structure - Document structure
 * @returns {Object} Cursor context
 */
function analyzeCursorContext(quillEditor, cursorPosition, structure) {
  const context = {
    nearestHeading: null,
    insideList: false,
    listType: null,
    nearestTable: null,
    nearestBlock: null
  }

  try {
    // Find nearest heading before cursor
    const headingsBeforeCursor = structure.headings.filter(h => h.position < cursorPosition)
    if (headingsBeforeCursor.length > 0) {
      const nearestHeading = headingsBeforeCursor[headingsBeforeCursor.length - 1]
      context.nearestHeading = nearestHeading.text
    }

    // Check if cursor is inside a list
    const [line] = quillEditor.getLine(cursorPosition)
    if (line?.parent?.statics?.blotName === 'list-item' || line?.parent?.statics?.blotName === 'list') {
      context.insideList = true

      // Determine list type from structure
      const listsAroundCursor = structure.lists.filter(
        l => l.position <= cursorPosition && l.endPosition >= cursorPosition
      )
      if (listsAroundCursor.length > 0) {
        context.listType = listsAroundCursor[0].type
      }
    }

    // Find nearest table
    const tablesBeforeCursor = structure.tables.filter(t => t.position < cursorPosition)
    if (tablesBeforeCursor.length > 0) {
      const nearestTable = tablesBeforeCursor[tablesBeforeCursor.length - 1]
      context.nearestTable = {
        id: nearestTable.id,
        name: nearestTable.name
      }
    }

    // Find nearest custom block
    const blocksBeforeCursor = structure.blocks.filter(b => b.position < cursorPosition)
    if (blocksBeforeCursor.length > 0) {
      const nearestBlock = blocksBeforeCursor[blocksBeforeCursor.length - 1]
      context.nearestBlock = nearestBlock.type
    }

  } catch (error) {
    logger.error('aiBlockService: Error analyzing cursor context', error)
  }

  return context
}

/**
 * Count words in text
 * @param {string} text - Text to count words
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
}

/**
 * Build enhanced system prompt with document context
 * @param {Object} documentContext - Document context
 * @param {string} userRequest - User request/prompt
 * @returns {string} Enhanced system prompt
 */
export function buildSystemPrompt(documentContext, userRequest = '') {
  const { title, content, structure, cursor, metadata } = documentContext

  let systemPrompt = `Ты — ИИ-ассистент текстового редактора DronDoc. Твоя задача — помогать пользователю писать, редактировать и улучшать документы.

📄 КОНТЕКСТ ДОКУМЕНТА:
- Название: "${title}"
- Размер: ${metadata.wordCount || 0} слов, ${metadata.characterCount || 0} символов`

  if (metadata.folder) {
    systemPrompt += `\n- Папка: ${metadata.folder}`
  }

  // Add structure information
  if (structure.headings.length > 0) {
    systemPrompt += `\n- Структура: ${structure.headings.length} заголовков`
    const mainHeadings = structure.headings.filter(h => h.level <= 2).slice(0, 5)
    if (mainHeadings.length > 0) {
      systemPrompt += `\n  Основные разделы: ${mainHeadings.map(h => `"${h.text}"`).join(', ')}`
    }
  }

  if (structure.lists.length > 0) {
    systemPrompt += `\n- Списки: ${structure.lists.length} (${structure.lists.reduce((sum, l) => sum + l.items, 0)} пунктов)`
  }

  if (structure.tables.length > 0) {
    systemPrompt += `\n- Таблицы Integram: ${structure.tables.map(t => `${t.name} (ID: ${t.id})`).join(', ')}`
  }

  // Add cursor context
  if (cursor.nearestHeading) {
    systemPrompt += `\n- Текущая секция: "${cursor.nearestHeading}"`
  }

  if (cursor.insideList) {
    systemPrompt += `\n- Курсор находится в списке (${cursor.listType === 'ol' ? 'нумерованный' : 'маркированный'})`
  }

  // Add surrounding content
  if (content.surrounding) {
    const surroundingPreview = content.surrounding.substring(0, 300)
    systemPrompt += `\n- Контекст вокруг курсора: "${surroundingPreview}${content.surrounding.length > 300 ? '...' : ''}"`
  }

  // Formatting instructions
  systemPrompt += `

🎨 ВОЗМОЖНОСТИ ФОРМАТИРОВАНИЯ:

1. **Базовый HTML**: <p>, <ul>, <ol>, <li>, <strong>, <em>, <h3>, <h4>, <h5>, <h6>, <blockquote>, <code>

2. **Специальные блоки** (используй эти теги для создания компонентов):

   [CALLOUT type="info|warning|success|error" icon="emoji"]
   Текст важного примечания или предупреждения.
   [/CALLOUT]

   [CHECKLIST]
   - [ ] Невыполненная задача
   - [x] Выполненная задача
   [/CHECKLIST]

   [QUOTE author="Имя автора"]
   Текст цитаты
   [/QUOTE]

   [BUTTON text="Текст кнопки" style="primary|secondary|success|danger"]

3. **Таблицы Integram** (если нужно вставить существующую таблицу из базы данных):

   [INTEGRAM_TABLE id="220847" mode="simple"]

   Например: [INTEGRAM_TABLE id="${structure.tables[0]?.id || '220847'}" mode="simple"]

4. **Живые Vue/PrimeVue компоненты** (для интерактивных элементов: кнопки, формы, таблицы, карточки):

   [VUE_COMPONENT]
   <div>
     <Button label="Нажми" severity="success" @click="onClick" />
     <p v-if="clicked">Кнопка нажата!</p>
   </div>
   <script>
   export default {
     data() { return { clicked: false } },
     methods: { onClick() { this.clicked = true } }
   }
   </script>
   [/VUE_COMPONENT]

   Доступные PrimeVue компоненты: Button, InputText, InputNumber, DataTable, Column, Tag, Message, ProgressSpinner, Dropdown.
   Используй v-model, @click, v-if, v-for как в обычном Vue 3.
   ЗАПРЕЩЕНО: eval(), fetch(), localStorage, import(), document.cookie.

5. **Экосистема БАС — Единая модель** (интерактивный блок с 12 акторами, 22 потоками, 10 бизнес-моделями):

   [ECOSYSTEM_UNIFIED tab="models" height="600"]

   Вкладки (tab):
   - "models" — 12 карточек бизнес-моделей: компоненты, производитель, инфраструктура, дата-центр, оператор, обработка данных, инжиниринг, заказчик, финансы, государство (госпрограммы), университет (НИР), НПЦ (региональный). Каждая карточка показывает выручку, EBITDA, мультипликатор и типы бизнес-моделей (агентская, подписка, pay-per-use, грант, субсидия, лицензия, лизинг, SaaS, бюджетное финансирование, налоги).
   - "ecosystem" — визуализация экосистемы: Sankey-диаграмма, цепочка ценности (3 ряда × 4 актора), матрица Леонтьева, каузальные петли (CLD), Монте-Карло, сценарии, дорожная карта, DCF-синергии.
   - "backtest" — бэктестирование с историческим анализом.

   Используй когда пользователь просит вставить экосистему БАС, единую модель, сравнить бизнес-модели или построить цепочку ценности.

📋 ИНСТРУКЦИИ:
- ОТВЕЧАЙ ТОЛЬКО контентом для вставки в редактор. Без объяснений, без комментариев.
- Используй подходящее форматирование на основе запроса пользователя.
- Если запрос требует специального блока (список задач, важное примечание и т.д.), используй соответствующий тег.
- Когда пользователь просит создать список задач, план, TODO, шаги или чеклист — ВСЕГДА используй [CHECKLIST] формат.
- Когда пользователь просит создать кнопку, форму, таблицу или любой интерактивный элемент — ВСЕГДА используй [VUE_COMPONENT] с PrimeVue компонентами.
- ВСЕГДА выбирай наиболее подходящий формат ответа автоматически.
- Сохраняй стиль и тон документа.
- Если запрос неясен или требует уточнений, задай вопрос пользователю.
- Для HTML тегов: не используй markdown обёртки типа \`\`\`html, только чистый HTML/теги.
`

  // Add document content (limited to avoid token overflow)
  if (content.plainText && content.plainText.trim()) {
    const contentPreview = content.plainText.substring(0, 4000)
    systemPrompt += `\n📝 СОДЕРЖИМОЕ ДОКУМЕНТА (первые ${Math.min(content.plainText.length, 4000)} символов):\n\n${contentPreview}${content.plainText.length > 4000 ? '\n...(содержимое обрезано)' : ''}\n`
  }

  logger.info('aiBlockService: System prompt built', {
    promptLength: systemPrompt.length,
    hasStructure: structure.headings.length > 0,
    hasCursorContext: !!cursor.nearestHeading
  })

  return systemPrompt
}

/**
 * Get contextual placeholder for AI block textarea
 * @param {Object} documentContext - Document context
 * @returns {string} Placeholder text
 */
export function getContextualPlaceholder(documentContext) {
  const { content, cursor, structure } = documentContext

  // Empty document
  if (!content.plainText || content.plainText.trim().length < 50) {
    return "Создай план статьи на тему... | Напиши введение о..."
  }

  // Inside list
  if (cursor.insideList) {
    return "Добавь пункты в список... | Расширь текущий пункт..."
  }

  // After heading
  if (cursor.nearestHeading) {
    return `Напиши о: ${cursor.nearestHeading}... | Добавь примеры...`
  }

  // Document has tables
  if (structure.tables.length > 0) {
    const tableName = structure.tables[0].name
    return `Проанализируй таблицу "${tableName}"... | Создай сводку...`
  }

  // Default
  return "Что нужно сделать? | Улучши текст | Создай таблицу..."
}

/**
 * Analyze user request to determine intent
 * @param {string} userRequest - User's request/prompt
 * @returns {Object} Intent analysis
 */
export function analyzeUserIntent(userRequest) {
  const lowerRequest = userRequest.toLowerCase()

  const intents = {
    generation: /создай|сгенерируй|напиши|добавь|придумай/i.test(lowerRequest),
    editing: /исправь|улучши|измени|отредактируй|перефразируй/i.test(lowerRequest),
    formatting: /отформатируй|сделай список|таблиц|жирным|курсивом/i.test(lowerRequest),
    summarization: /кратко|резюме|сводка|основные моменты/i.test(lowerRequest),
    expansion: /расширь|подробнее|больше деталей|дополни/i.test(lowerRequest),
    translation: /переведи|перевод|на английский|на русский/i.test(lowerRequest),
    question: /как|что|почему|зачем|когда|\?/i.test(lowerRequest)
  }

  const detectedIntents = Object.keys(intents).filter(key => intents[key])

  return {
    primary: detectedIntents[0] || 'generation',
    all: detectedIntents,
    requiresContext: intents.editing || intents.formatting || intents.summarization
  }
}

/**
 * Build conversation history for AI API
 * @param {Array} historyArray - Array of previous interactions
 * @param {number} maxLength - Maximum number of messages to include
 * @returns {Array} Formatted conversation history
 */
export function buildConversationHistory(historyArray = [], maxLength = 5) {
  if (!Array.isArray(historyArray) || historyArray.length === 0) {
    return []
  }

  // Take last N interactions
  const recentHistory = historyArray.slice(-maxLength)

  // Format for API
  const conversationHistory = []
  recentHistory.forEach(interaction => {
    conversationHistory.push({
      role: 'user',
      content: interaction.prompt
    })
    conversationHistory.push({
      role: 'assistant',
      content: interaction.response
    })
  })

  logger.info('aiBlockService: Conversation history built', {
    totalInteractions: historyArray.length,
    includedInteractions: recentHistory.length,
    messages: conversationHistory.length
  })

  return conversationHistory
}

export default {
  getDocumentContext,
  buildSystemPrompt,
  getContextualPlaceholder,
  analyzeUserIntent,
  buildConversationHistory
}

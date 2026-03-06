/**
 * useBlockEditorTools.js
 * AI tools for Block Document Editor
 * - Contextual action suggestions based on document
 * - Execute AI actions on the Quill editor via custom events
 * - Tool definitions for AI function calling
 */

import { ref, computed } from 'vue'

// ============================================================
// Tool definitions (for AI system prompt / function calling)
// ============================================================
export const BLOCK_EDITOR_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'editor_insert_text',
      description: 'Insert text/HTML content at cursor position or at end of document',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'HTML content to insert' },
          position: { type: 'string', enum: ['cursor', 'end', 'beginning'], description: 'Where to insert (default: cursor)' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_plan_steps',
      description: 'Create a visible task plan before starting multi-step editing. Call this FIRST for complex tasks with multiple changes. Shows user what you will do.',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
              }
            }
          }
        },
        required: ['steps']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_str_replace',
      description: 'Find exact text in the document and replace it. Use this to fix typos, correct errors, or replace any specific text fragment. old_str must match exactly (use enough context to be unique). new_str is the replacement. Can be called multiple times to fix multiple errors.',
      parameters: {
        type: 'object',
        properties: {
          old_str: { type: 'string', description: 'Exact text to find (include surrounding words for uniqueness if needed)' },
          new_str: { type: 'string', description: 'Replacement text' }
        },
        required: ['old_str', 'new_str']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_replace_selection',
      description: 'Replace the currently selected text in the editor (only use if user explicitly selected text)',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'HTML content to replace selection with — must be a small fragment, NOT the full document' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_heading',
      description: 'Insert a heading block',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Heading text' },
          level: { type: 'number', enum: [1, 2, 3], description: 'Heading level (1=H1, 2=H2, 3=H3)' },
          position: { type: 'string', enum: ['cursor', 'end'], description: 'Where to insert' }
        },
        required: ['text', 'level']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_list',
      description: 'Insert a bullet or numbered list',
      parameters: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'string' }, description: 'List items' },
          ordered: { type: 'boolean', description: 'true = numbered list, false = bullet list' },
          position: { type: 'string', enum: ['cursor', 'end'], description: 'Where to insert' }
        },
        required: ['items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_code_block',
      description: 'Insert a code block',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code content' },
          language: { type: 'string', description: 'Programming language (optional)' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_append_section',
      description: 'Append a full section (heading + content) at the end of the document',
      parameters: {
        type: 'object',
        properties: {
          heading: { type: 'string', description: 'Section heading' },
          headingLevel: { type: 'number', enum: [1, 2, 3], description: 'Heading level' },
          content: { type: 'string', description: 'Section HTML content (paragraphs, lists, etc.)' }
        },
        required: ['heading', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_integram_table',
      description: 'Insert an Integram database table embed. If user says "добавь таблицу N" — call immediately with tableId=N, do NOT ask questions.',
      parameters: {
        type: 'object',
        properties: {
          tableId: { type: 'string', description: 'Integram type/table ID (numeric string)' },
          tableName: { type: 'string', description: 'Display name (optional, auto-resolved if omitted)' },
          database: { type: 'string', description: 'Database name (kval, my, etc.). Default: current database.' },
          mode: { type: 'string', enum: ['simple', 'full', 'cards'], description: 'simple=read-only, full=editable, cards=card layout. Default: full' }
        },
        required: ['tableId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_integram_report',
      description: 'Insert an Integram report embed (aggregated/filtered query results)',
      parameters: {
        type: 'object',
        properties: {
          reportId: { type: 'string', description: 'Integram report ID' },
          database: { type: 'string', description: 'Database name' }
        },
        required: ['reportId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_simple_table',
      description: 'Insert a plain HTML table with headers and data rows',
      parameters: {
        type: 'object',
        properties: {
          headers: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '2D array of cell values' }
        },
        required: ['headers']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'integram_normalize_page_tables',
      description: 'Scan the current document for HTML tables and normalize them into an Integram relational database model. Creates lookup tables for repeated values, handles colspan/rowspan, and replaces <table> elements with Integram embeds.',
      parameters: {
        type: 'object',
        properties: {
          database: { type: 'string', description: 'Target Integram database (e.g. kval)' },
          strategy: { type: 'string', enum: ['normalize', 'flat', 'auto'], description: 'Normalization strategy (default: auto)' },
          reuseExisting: { type: 'boolean', description: 'Reuse existing Integram types if schema matches (default: true)' }
        },
        required: ['database']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_clear_and_write',
      description: 'Clear the document and write completely new content (use carefully)',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'New full HTML content for the document' },
          title: { type: 'string', description: 'New document title (optional)' }
        },
        required: ['content']
      }
    }
  },
  // Issue #7057: FinModel and Ecosystem embed tools
  {
    type: 'function',
    function: {
      name: 'editor_insert_finmodel',
      description: 'Insert a FinModel (financial model) block into the document. The block renders as an interactive spreadsheet with P&L, NPV, IRR calculations. Use this when the user asks to create or insert a financial model.',
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: 'Existing FinModel ID to load (leave empty to create a new model)' },
          database: { type: 'string', description: 'Database name (default: fm)' },
          server: { type: 'string', description: 'Server URL (default: ai2o.ru)' },
          position: { type: 'string', enum: ['cursor', 'end'], description: 'Where to insert (default: end)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_ecosystem',
      description: 'Insert an Ecosystem block into the document. The block renders Sankey diagrams, causal-loop diagrams, Leontief input-output matrix, Monte Carlo simulations and other ecosystem analytics. Use this when the user asks to create or insert an ecosystem analysis, Sankey diagram, or business ecosystem visualization.',
      parameters: {
        type: 'object',
        properties: {
          ecosystemId: { type: 'string', description: 'Existing Ecosystem ID to load (leave empty to create new)' },
          database: { type: 'string', description: 'Database name (default: fm)' },
          server: { type: 'string', description: 'Server URL (default: ai2o.ru)' },
          position: { type: 'string', enum: ['cursor', 'end'], description: 'Where to insert (default: end)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_update_finmodel',
      description: 'Send an update instruction to an active FinModel block (e.g. "increase revenue by 30%", "add Marketing row", "change EBITDA formula"). The user must have clicked on a FinModel block first to make it active.',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'Natural-language instruction for the FinModel AI assistant' },
          modelId: { type: 'string', description: 'FinModel block ID to update (uses active model if omitted)' }
        },
        required: ['instruction']
      }
    }
  },
  // Issue #7060: Read FinModel data tool
  {
    type: 'function',
    function: {
      name: 'editor_read_finmodel',
      description: 'Read data from an active FinModel block in the document. Returns financial data (P&L, NPV, IRR, scenarios, etc.) so you can answer questions about the model. Use this when the user asks about financial data like "What is the NPV?", "Show P&L for 5 years", "Which scenario has the highest IRR?".',
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: 'FinModel block ID to read (uses active model if omitted)' },
          database: { type: 'string', description: 'Database name (default: fm)' },
          server: { type: 'string', description: 'Server URL (default: ai2o.ru)' }
        },
        required: []
      }
    }
  },
  // Issue #7061: Read Ecosystem data tool
  {
    type: 'function',
    function: {
      name: 'editor_read_ecosystem',
      description: 'Read data from an active Ecosystem block in the document. Returns ecosystem data (businesses, Sankey flows, Leontief matrix, feedback loops, Monte Carlo results, etc.) so you can answer analytical questions. Use this when the user asks questions like "Which business has the highest Leontief multiplier?", "Show Sankey flow diagram", "What is the NPV range from Monte Carlo?".',
      parameters: {
        type: 'object',
        properties: {
          ecosystemId: { type: 'string', description: 'Ecosystem block ID to read (uses active ecosystem if omitted)' },
          database: { type: 'string', description: 'Database name (default: fm)' },
          server: { type: 'string', description: 'Server URL (default: ai2o.ru)' }
        },
        required: []
      }
    }
  },
  // Issue #7074: Business transformation tool (AS-IS → TO-BE)
  {
    type: 'function',
    function: {
      name: 'editor_insert_business_transform',
      description: 'Insert a business transformation section: heading + FinModel AS-IS (current state) + separator + FinModel TO-BE (after drone/AI agents). Use when user asks to analyze/transform their business, show before/after, reverse engineer their business model.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Industry/sector of the business' },
          businessDescription: { type: 'string', description: 'Brief description of the business' }
        },
        required: []
      }
    }
  },
  // Issue #7063: Update Ecosystem data/parameters tool
  {
    type: 'function',
    function: {
      name: 'editor_update_ecosystem',
      description: 'Send an update instruction to an active Ecosystem block (e.g. "Add 4 businesses: Production ($5M), DaaS ($3M)", "Set discount rate 12% and horizon 5 years", "Add flow from Production to DaaS — $500K/year"). The user must have clicked on an Ecosystem block first to make it active.',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'Natural-language instruction for the Ecosystem AI assistant' },
          ecosystemId: { type: 'string', description: 'Ecosystem block ID to update (uses active ecosystem if omitted)' }
        },
        required: ['instruction']
      }
    }
  },
  // Issue #7076: Import DOCX/PDF/XLSX file into editor
  {
    type: 'function',
    function: {
      name: 'editor_delete_block',
      description: 'Delete an embedded block from the document by type. Use when user says "убери", "удали блок", "убери таблицу" etc.',
      parameters: {
        type: 'object',
        properties: {
          blockType: { type: 'string', description: 'Block type: integram-table, integram-report, integram-chart, finmodel, ecosystem, ecosystem-unified, mermaid, callout, selector, embed, simple-table, whiteboard, tech-pyramid, integram-tabs, timeline, calendar, map, spoiler, drononomics, ontology, osint' },
          occurrence: { type: 'number', description: 'Which occurrence to delete (1-based). Default: 1' }
        },
        required: ['blockType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_import_file',
      description: 'Open the file import dialog so the user can select a DOCX, PDF, or XLSX file and insert its content as editor blocks.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_mermaid',
      description: 'Insert a Mermaid diagram block. Provide Mermaid syntax code.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mermaid diagram code (e.g. "graph TD; A-->B;")' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_callout',
      description: 'Insert a callout/alert block (info, warning, error, success).',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Callout text content' },
          type: { type: 'string', enum: ['info', 'warning', 'error', 'success', 'note'], description: 'Callout theme. Default: info' },
          emoji: { type: 'string', description: 'Optional emoji icon' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_embed',
      description: 'Insert external content embed (YouTube, Figma, Google Docs, etc.).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to embed' },
          title: { type: 'string', description: 'Display title (optional)' },
          height: { type: 'number', description: 'Embed height in px. Default: 400' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_spoiler',
      description: 'Insert a collapsible spoiler/toggle block.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Spoiler header text. Default: "Нажмите, чтобы развернуть"' },
          defaultOpen: { type: 'boolean', description: 'Start expanded. Default: false' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_integram_chart',
      description: 'Open chart configuration dialog to build a chart from Integram table data.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_drononomics',
      description: 'Insert Drononomics simulation block (BAS economics: tokenomics, P&L, Leontief matrix).',
      parameters: {
        type: 'object',
        properties: {
          scenario: { type: 'string', description: 'Scenario name. Default: default' },
          region: { type: 'string', description: 'Region code (e.g. szfo, cfo). Default: empty' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_ecosystem_unified',
      description: 'Insert unified BAS Ecosystem block (7 business models + ecosystem + Monte Carlo backtest).',
      parameters: {
        type: 'object',
        properties: {
          tab: { type: 'string', description: 'Initial tab: models, ecosystem, backtest. Default: models' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_ontology',
      description: 'Insert UAV ontology block (SKOS taxonomy: concept tree, search, multilingual labels).',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['tree', 'graph', 'search'], description: 'Display mode. Default: tree' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_osint',
      description: 'Insert OSINT dashboard block (China UAV market analytics).',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Search keyword. Default: 无人机' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editor_insert_integram_tabs',
      description: 'Insert Integram tabs block (multiple tables/cards/charts as tabs). Opens config dialog.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
]

// ============================================================
// Contextual action suggestions based on document content
// Issue #6914: Added isPreviewMode parameter to show "Create TZ" button when preview=1
// ============================================================
export function getContextualActions(documentContext, isPreviewMode = false) {
  if (!documentContext) {
    return [
      { label: 'Создать документ', icon: 'pi pi-file', prompt: 'Создай структуру нового документа' },
      { label: 'Помощь', icon: 'pi pi-question-circle', prompt: 'Что ты умеешь делать в редакторе документов?' }
    ]
  }

  const { title = '', content = '', fullLength = 0 } = documentContext
  const titleLower = title.toLowerCase()
  const contentLower = content.toLowerCase()
  const isEmpty = fullLength < 50

  const actions = []

  // Issue #6914: Add "Create TZ" action when in preview mode with document content
  // This creates a new TZ document based on the current document
  if (isPreviewMode && !isEmpty) {
    actions.push({
      label: 'Создать ТЗ',
      icon: 'pi pi-file-edit',
      prompt: `На основе этого документа "${title}" создай новое Техническое Задание (ТЗ).

ВАЖНО: Используй doc_create_document чтобы создать НОВЫЙ документ с ТЗ.

Структура нового ТЗ должна включать:
1. Введение — краткое описание проекта на основе документа
2. Цели и задачи — что нужно достичь
3. Функциональные требования — конкретные функции на основе содержимого документа
4. Нефункциональные требования — производительность, безопасность, масштабируемость
5. Технические требования — технологии, интеграции, инфраструктура
6. Этапы реализации — план работ с этапами
7. Критерии приёмки — как проверить что всё сделано

Извлеки максимум информации из текущего документа и его встроенных таблиц/отчётов Integram.

После вызова doc_create_document получишь результат с documentId — используй его в ссылке.
В конце ответа добавь кнопку-ссылку на новый документ в формате:

:::actions
[{"label":"Открыть ТЗ","action":"url","value":"/block-editor?docId=ПОЛУЧЕННЫЙ_ID&database=kval"}]
:::

Замени ПОЛУЧЕННЫЙ_ID на реальный documentId из ответа doc_create_document.`
    })
  }

  if (isEmpty) {
    // Empty document
    actions.push({ label: 'Создать структуру', icon: 'pi pi-sitemap', prompt: `Создай структуру документа "${title}" — разделы, подразделы и краткое описание каждого.` })
    actions.push({ label: 'Написать ТЗ', icon: 'pi pi-file-edit', prompt: `Напиши техническое задание (ТЗ) для "${title}". Включи: цели, требования, функции, технологии.` })
    actions.push({ label: 'Написать план', icon: 'pi pi-list', prompt: `Создай подробный план документа "${title}" с разделами и подразделами.` })
  } else {
    // Has content
    actions.push({ label: 'Исправить ошибки', icon: 'pi pi-wrench', prompt: 'Найди все орфографические и грамматические ошибки в документе. Для каждой ошибки вызови editor_str_replace с точным old_str из текста и исправленным new_str. Исправляй только ошибки, не меняй смысл.' })
    actions.push({ label: 'Улучшить стиль', icon: 'pi pi-sparkles', prompt: 'Улучши стиль и читаемость. Для каждого улучшения используй editor_str_replace: old_str — оригинальный фрагмент, new_str — улучшенная версия. Работай небольшими фрагментами.' })
    actions.push({ label: 'Краткое резюме', icon: 'pi pi-align-left', prompt: 'Напиши краткое резюме этого документа (3-5 предложений) и добавь его в начало документа через editor_str_replace или editor_insert_text.' })
    actions.push({ label: 'Дополнить содержание', icon: 'pi pi-plus-circle', prompt: 'Изучи документ и добавь недостающие разделы через editor_append_section. Развёрни существующие разделы через editor_str_replace.' })
    actions.push({ label: 'Освежить', icon: 'pi pi-refresh', prompt: 'Проанализируй документ: определи тему и что уже написано. Найди через web_search свежую и актуальную информацию по теме — новые данные, изменения, цифры, факты которых нет в документе. Замени устаревшие данные на актуальные через editor_str_replace. Добавь новую информацию которой нет — через editor_append_section или editor_str_replace туда где она уместна по смыслу. Не трогай то что остаётся актуальным.' })
  }

  // Context-based suggestions
  if (titleLower.includes('тз') || titleLower.includes('требован') || contentLower.includes('требован')) {
    actions.push({ label: 'Добавить раздел', icon: 'pi pi-plus', prompt: 'Добавь раздел "Нефункциональные требования" в конец ТЗ через editor_append_section.' })
  }
  if (titleLower.includes('отчёт') || titleLower.includes('отчет') || titleLower.includes('report')) {
    actions.push({ label: 'Выводы', icon: 'pi pi-check-circle', prompt: 'Напиши раздел "Выводы и рекомендации" и добавь через editor_append_section.' })
  }
  if (contentLower.includes('код') || contentLower.includes('api') || contentLower.includes('функци')) {
    actions.push({ label: 'Добавить примеры', icon: 'pi pi-code', prompt: 'Добавь примеры кода через editor_insert_code_block или editor_append_section.' })
  }

  actions.push({ label: 'Перевести (EN)', icon: 'pi pi-globe', prompt: 'Переведи документ на английский. Используй editor_str_replace для каждого абзаца: old_str — русский текст, new_str — перевод.' })
  actions.push({ label: 'Структурировать', icon: 'pi pi-sort-alt', prompt: 'Структурируй документ: добавь заголовки через editor_str_replace (замени начало абзаца на заголовок), разбей на разделы через editor_append_section.' })


  // Check if document contains HTML tables (normalize action)
  if (contentLower.includes('<table') || contentLower.includes('table>')) {
    actions.unshift({ label: 'Нормализовать таблицы', icon: 'pi pi-database', prompt: 'Создай базу данных из таблиц на этой странице — нормализуй HTML-таблицы в Integram.' })
  }

  return actions.slice(0, 7) // Max 7 suggestions
}

// ============================================================
// Execute editor actions received from AI
// ============================================================
export function executeEditorAction(action) {
  const { type, ...params } = action
  window.dispatchEvent(new CustomEvent('ai-block-editor-action', {
    detail: { type, params }
  }))
}

export function executeEditorActions(actions) {
  if (!Array.isArray(actions)) return
  for (const action of actions) {
    executeEditorAction(action)
  }
}

// ============================================================
// Parse AI response text for embedded action tags
// e.g. <!--EDITOR_ACTION:{"type":"editor_insert_text","content":"..."}-->
// ============================================================
export function parseEditorActionsFromResponse(text) {
  if (!text) return { cleanText: text, actions: [] }

  const actions = []
  const ACTION_RE = /<!--EDITOR_ACTION:(.*?)-->/gs

  let cleanText = text
  let match
  while ((match = ACTION_RE.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1])
      actions.push(action)
    } catch (e) {
      console.warn('[BlockEditorTools] Failed to parse action tag:', match[1])
    }
    cleanText = cleanText.replace(match[0], '')
  }

  return { cleanText: cleanText.trim(), actions }
}

// ============================================================
// Build system prompt addition for block editor mode
// ============================================================
export function buildBlockEditorSystemPromptAddition(documentContext) {
  let addition = '\n\n=== РЕЖИМ РЕДАКТОРА ДОКУМЕНТОВ ===\n'
  addition += 'Ты работаешь в режиме ИИ-ассистента редактора документов DronDoc.\n'
  addition += 'У тебя есть инструменты для ПРЯМОГО управления документом:\n\n'
  addition += '**Доступные действия с документом:**\n'
  addition += '- `editor_plan_steps` — ТОЛЬКО показывает план, НЕ редактирует документ! После editor_plan_steps ОБЯЗАТЕЛЬНО вызови реальные инструменты (editor_append_section, editor_insert_text, editor_str_replace и т.д.). НИКОГДА не останавливайся после одного editor_plan_steps!\n'
  addition += '- `editor_str_replace` — ОСНОВНОЙ инструмент для исправлений: найти точный текст и заменить его (как sed). Вызывай столько раз сколько нужно для каждой ошибки.\n'
  addition += '- `editor_replace_selection` — заменить выделенный пользователем текст (только если пользователь что-то выделил)\n'
  addition += '- `editor_insert_text` — вставить HTML-контент в документ\n'
  addition += '- `editor_insert_heading` — добавить заголовок (H1/H2/H3)\n'
  addition += '- `editor_insert_list` — добавить список (маркированный или нумерованный)\n'
  addition += '- `editor_insert_code_block` — добавить блок кода\n'
  addition += '- `editor_append_section` — добавить раздел (заголовок + контент) в конец\n'
  addition += '- `editor_clear_and_write` — перезаписать весь документ (осторожно!)\n'
  addition += '- `integram_normalize_page_tables` — нормализовать HTML-таблицы в базу данных Integram\n'
  addition += '- `editor_insert_finmodel` — вставить блок Финмодели (FinModel) в документ. Интерактивная таблица с P&L, NPV, IRR. Параметры: modelId (опц.), database (default: fm), server (default: ai2o.ru)\n'
  addition += '- `editor_insert_ecosystem` — вставить блок Экосистемы (Ecosystem) в документ. Содержит Sankey-диаграмму, матрицу Леонтьева, Монте-Карло и другие аналитические инструменты. Параметры: ecosystemId (опц.), database (default: fm), server (default: ai2o.ru)\n'
  addition += '- `editor_update_finmodel` — отправить инструкцию активной Финмодели (например: "увеличь выручку на 30%", "добавь строку Маркетинг"). Требует активный блок FinModel (пользователь кликнул на него).\n'
  addition += '- `editor_read_finmodel` — прочитать данные из активного блока FinModel (P&L, NPV, IRR, сценарии). Используй когда пользователь задаёт вопрос о данных финмодели (например: "Какой NPV?", "Покажи P&L", "Какой IRR в сценарии X?").\n'
  addition += '- `editor_read_ecosystem` — прочитать данные из активного блока Ecosystem (бизнесы, Sankey-потоки, матрица Леонтьева, Монте-Карло). Используй когда пользователь задаёт аналитические вопросы об экосистеме (например: "Какой бизнес имеет наибольший мультипликатор?", "Покажи Sankey", "Какой диапазон NPV?").\n'
  addition += '- `editor_update_ecosystem` — отправить инструкцию активному блоку Ecosystem (например: "Добавь 4 бизнеса: Производство ($5M), DaaS ($3M), Аналитика ($2M), Страхование ($4M)", "Установи ставку дисконтирования 12%", "Добавь поток из Производства в DaaS — $500K/год"). Требует активный блок Ecosystem (пользователь кликнул на него).\n'
  addition += '- `editor_import_file` — открыть диалог импорта файла: DOCX, PDF или XLSX. Содержимое будет вставлено в документ как блоки редактора. Используй когда пользователь говорит "импортируй файл", "загрузи документ", "вставь DOCX/PDF/Excel".\n\n'

  addition += '**ПРАВИЛО editor_str_replace:** old_str — это точный текст из документа (слово/фраза), new_str — замена. НЕ вставляй весь документ в new_str!\n'
  addition += '**Для исправления ошибок:** найди все ошибки, вызови editor_str_replace для каждой отдельно.\n'
  addition += 'Форматируй контент как чистый HTML (без markdown-обёрток).\n\n'
  addition += '**КРИТИЧЕСКОЕ ПРАВИЛО:** Когда пользователь просит добавить/написать/вставить контент — ты ДОЛЖЕН вызвать editor_append_section или editor_insert_text с реальным HTML-контентом. editor_plan_steps ТОЛЬКО показывает план и НЕ МЕНЯЕТ документ. Если ты вызвал editor_plan_steps — сразу вызывай следующий инструмент!\n\n'

  if (documentContext) {
    addition += `**Текущий документ:** "${documentContext.title || 'Без названия'}"\n`
    if (documentContext.fullLength > 0) {
      addition += `**Длина документа:** ${documentContext.fullLength} символов\n`
    }
  }

  addition += '=== КОНЕЦ ИНСТРУКЦИЙ РЕДАКТОРА ===\n'
  return addition
}

// ============================================================
// Composable export
// ============================================================
export function useBlockEditorTools() {
  const pendingActions = ref([])
  const isExecuting = ref(false)

  async function executeActions(actions) {
    isExecuting.value = true
    for (const action of actions) {
      executeEditorAction(action)
      // Small delay between actions for visual feedback
      await new Promise(r => setTimeout(r, 100))
    }
    pendingActions.value = []
    isExecuting.value = false
  }

  return {
    pendingActions,
    isExecuting,
    executeActions,
    getContextualActions,
    parseEditorActionsFromResponse,
    buildBlockEditorSystemPromptAddition,
    BLOCK_EDITOR_TOOL_DEFINITIONS
  }
}

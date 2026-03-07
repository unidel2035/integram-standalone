/**
 * useChatLogic.js - Shared chat logic for Chat.vue and ChatPage.vue
 *
 * This composable extracts all shared business logic from both components,
 * following the DRY (Don't Repeat Yourself) principle.
 *
 * Both Chat.vue (sidebar) and ChatPage.vue (fullscreen) use the same core logic,
 * differing only in UI presentation (layout, styling, TabView vs sidebar).
 */

import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logger } from '@/utils/logger'
import { getApiUrl } from '@/utils/apiConfig'
import apiClient from '@/axios2.js'
import polzaService from '@/services/polzaService.js'
import { integramChatSessionService } from '@/services/integramChatSessionService.js'
import integramApiClient from '@/services/integramApiClient.js'
import {
  searchWeb,
  executeCode as executeCodeAPI,
  extractCodeBlocks,
  hasExecutableCode,
  formatSearchResults,
  getAgentSystemPrompt
} from '@/services/chatAgentService'
import {
  createWorkspace,
  getUserWorkspaces,
  deleteWorkspace,
  chatWithWorkspace
} from '@/services/workspaceService'
import integraMCPService from '@/services/integraMCPService'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER } from '@/config/aiDefaults.js'
import { innAnalyticsService } from '@/services/innAnalyticsService'
import { egrulService } from '@/services/egrulService'
import { vatCalculatorService } from '@/services/vatCalculatorService'
import { fsspService } from '@/services/fsspService'
import { parseHHRequest, processHHRequest as processHHRequestService } from '@/services/hhAgentService'
import agentTriggerService, { AGENT_TYPES, AGENT_METADATA } from '@/services/agentTriggerService'
import { useAuthStore } from '@/stores/authStore'
import { useGeneralChat } from '@/composables/useGeneralChat'
import { executeQuery } from '@/services/orchestratorService'
import { syncHtmlToBlocks } from '@/services/docBlocksApiService'

/**
 * Convert Quill HTML to Markdown for AI context.
 * Preserves structure (headings, lists, bold, embeds) so AI understands the document.
 */

// Russian-friendly names for AI tool calls displayed in chat
const TOOL_NAME_MAP = {
  // Editor tools
  'editor_plan_steps':             '📋 Планировщик задач',
  'editor_str_replace':            '✏️ Редактирование текста',
  'editor_insert_text':            '📝 Вставка текста',
  'editor_append_section':         '➕ Добавление раздела',
  'editor_clear_and_write':        '🔄 Перезапись документа',
  'editor_insert_heading':         '📌 Вставка заголовка',
  'editor_insert_list':            '📋 Вставка списка',
  'editor_insert_simple_table':    '📊 Вставка таблицы',
  'editor_insert_integram_table':  '🗃️ Вставка таблицы Integram',
  'editor_insert_integram_report': '📈 Вставка отчёта Integram',
  'editor_insert_code_block':      '💻 Вставка кода',
  'editor_replace_selection':      '🔁 Замена выделенного',
  // Issue #7057: FinModel and Ecosystem tools
  'editor_insert_finmodel':        '📊 Вставка финмодели',
  'editor_insert_ecosystem':       '🌐 Вставка экосистемы',
  'editor_update_finmodel':        '✏️ Обновление финмодели',
  // Issue #7060: Read FinModel data tool
  'editor_read_finmodel':          '📖 Чтение данных финмодели',
  // Issue #7061: Read Ecosystem data tool
  'editor_read_ecosystem':         '🌿 Чтение данных экосистемы',
  // Issue #7063: Update Ecosystem data/parameters
  'editor_update_ecosystem':       '🌱 Обновление экосистемы',
  // Issue #7074: Business transformation tool
  'editor_insert_business_transform': '🔄 Трансформация бизнеса AS-IS→TO-BE',
  // Issue #7076: File import (DOCX/PDF/XLSX)
  'editor_import_file':            '📂 Импорт файла в редактор',
  // Short aliases (fallback when tool name arrives without editor_ prefix)
  'finmodel':                      '📊 Вставка финмодели',
  'ecosystem':                     '🌐 Вставка экосистемы',
  'business_transform':            '🔄 Трансформация бизнеса AS-IS→TO-BE',
  'insert_finmodel':               '📊 Вставка финмодели',
  'insert_ecosystem':              '🌐 Вставка экосистемы',
  'update_finmodel':               '✏️ Обновление финмодели',
  'read_finmodel':                 '📖 Чтение данных финмодели',
  'read_ecosystem':                '🌿 Чтение данных экосистемы',
  'update_ecosystem':              '🌱 Обновление экосистемы',
  // KAG (Knowledge Graph) pre-fetch - Issue #7217
  'kag_search':                    '🔍 Поиск в базе знаний',
  // Web tools
  'tavily_search':                 '🔍 Поиск в интернете',
  'web_fetch':                     '🌐 Загрузка страницы',
  'web_search':                    '🔍 Поиск в интернете',
  'web_instant_answer':            '💡 Быстрый ответ',
  // Doc tools
  'doc_append_section':            '➕ Добавление раздела',
  'doc_create_document':           '📄 Создание документа',
  'doc_duplicate':                 '📋 Копирование документа',
  'doc_replace_section':           '🔄 Замена раздела',
  'doc_get_content':               '📖 Чтение документа',
  'doc_summarize':                 '📝 Краткое изложение',
  'doc_search':                    '🔎 Поиск в документе',
  'doc_insert_integram_table':     '📊 Вставка таблицы Integram',
  'doc_insert_integram_report':    '📈 Вставка отчёта Integram',
  'doc_insert_mermaid':            '🔷 Вставка диаграммы',
  'doc_insert_callout':            '💬 Вставка блока-выноски',
  'doc_insert_embed':              '🔗 Вставка внешнего контента',
  // Integram tools
  'integram_authenticate':              '🔑 Авторизация',
  'integram_get_dictionary':            '📚 Список таблиц',
  'integram_get_type_metadata':         '🔍 Структура таблицы',
  'integram_get_all_types_metadata':    '🔍 Все структуры',
  'integram_get_object_list':           '📋 Список записей',
  'integram_get_all_objects':           '📋 Все записи',
  'integram_get_object_count':          '🔢 Количество записей',
  'integram_search_objects':            '🔎 Поиск записей',
  'integram_create_object':             '➕ Создание записи',
  'integram_save_object':               '💾 Сохранение записи',
  'integram_set_object_requisites':     '✏️ Изменение записи',
  'integram_update_object_value':       '✏️ Обновление значения',
  'integram_delete_object':             '🗑️ Удаление записи',
  'integram_copy_object':               '📋 Копирование записи',
  'integram_bulk_delete_objects':       '🗑️ Массовое удаление',
  'integram_create_objects_batch':      '➕ Пакетное создание',
  'integram_execute_report':            '📊 Выполнение отчёта',
  'integram_smart_query':               '🔎 Умный запрос',
  'integram_natural_query':             '💬 Запрос на естественном языке',
  'integram_get_object_edit_data':      '📝 Данные для редактирования',
  'integram_get_object_meta':           '🔍 Метаданные объекта',
  'integram_get_object_children':       '🌿 Дочерние записи',
  'integram_move_object_up':            '⬆️ Переместить вверх',
  'integram_move_object_to_parent':     '↩️ Переместить к родителю',
  'integram_set_object_order':          '🔀 Сортировка',
  'integram_add_multiselect_item':      '➕ Добавить в мультивыбор',
  'integram_remove_multiselect_item':   '➖ Убрать из мультивыбора',
  'integram_get_multiselect_items':     '📋 Элементы мультивыбора',
  'integram_get_reference_options':     '🔗 Варианты для ссылки',
  'integram_create_type':               '🏗️ Создание таблицы',
  'integram_save_type':                 '💾 Сохранение таблицы',
  'integram_delete_type':               '🗑️ Удаление таблицы',
  'integram_add_requisite':             '➕ Добавление колонки',
  'integram_delete_requisite':          '🗑️ Удаление колонки',
  'integram_rename_requisite':          '✏️ Переименование колонки',
  'integram_save_requisite_alias':      '🏷️ Алиас колонки',
  'integram_toggle_requisite_null':     '⚙️ Настройка колонки',
  'integram_toggle_requisite_multi':    '⚙️ Мультизначение колонки',
  'integram_execute_connector':         '🔌 Выполнение коннектора',
  'integram_get_session_info':          'ℹ️ Информация о сессии',
  'integram_create_parent_with_children': '🌳 Создание с дочерними',
  'integram_get_table_structure':       '📐 Структура таблицы',
  // Ontology tools
  'ontology_search_concepts':           '🔍 Поиск в онтологии БПЛА',
  'ontology_get_concept':               '📖 Детали концепта',
  'ontology_get_hierarchy':             '🌳 Иерархия концептов',
  'event_engine_get_scenarios':         '🎯 Сценарии БАС',
  'event_engine_get_mission':           '🚁 Детали миссии',
  'event_engine_get_stats':             '📊 Статистика онтологии',
  // Event engine extended tools
  'event_engine_list_concepts':         '📋 Список СОД-концептов',
  'event_engine_create_concept':        '➕ Создание концепта',
  'event_engine_list_actors':           '👥 Список акторов',
  'event_engine_create_actor':          '👤 Создание актора',
  'event_engine_list_models':           '📦 Список моделей',
  'event_engine_get_model_tree':        '🌳 Дерево модели',
  'event_engine_create_individual':     '🚁 Создание миссии',
  'event_engine_execute_model':         '▶️ Запуск модели',
  'event_engine_query_bsl':             '🔎 BSL-запрос',
  'event_engine_link_ontology':         '🔗 Привязка к онтологии',
  // MBSE tools
  'mbse_list_requirements':            '📋 Список требований MBSE',
  'mbse_create_requirement':           '➕ Создание требования',
  'mbse_get_traceability':             '🔗 Матрица трассировки',
  'mbse_trace_requirement':            '🔗 Трассировка требований',
  'mbse_list_states':                  '🔄 Состояния FSM',
  'mbse_create_state':                 '➕ Создание состояния',
  'mbse_create_transition':            '➡️ Создание перехода',
  'mbse_execute_fsm':                  '▶️ Запуск автомата',
  'mbse_generate_diagram':             '📊 SysML диаграмма',
  'mbse_verify_requirement':           '✅ Верификация требования',
  'mbse_get_coverage':                 '📊 Покрытие требований',
  // Navigation tools
  'search_platform_routes':            '🗺️ Поиск страниц платформы',
  'navigate_to':                       '🔀 Переход на страницу',
  // Knowledge base tools
  'kb_search':                         '🔍 Поиск в базе знаний',
  'kb_save_entity':                    '💾 Сохранение в базу знаний',
  // Agent tools
  'launch_agent':                      '🤖 Запуск агента',
  'check_agent_job':                   '📋 Статус агента',
  // Integram table-row tools (integramTools.js)
  'integram_get_table':                '📋 Получение таблицы',
  'integram_get_row':                  '📄 Получение строки',
  'integram_update_cell':              '✏️ Обновление ячейки',
  'integram_search_rows':              '🔎 Поиск строк',
  'integram_create_row':               '➕ Создание строки',
  // Integram type editor tools
  'integram_get_type_editor_data':     '🔧 Данные редактора типа',
  // Editor tools (additional)
  'editor_insert_ecosystem_unified':   '🌐 Вставка единой экосистемы',
  'editor_delete_block':               '🗑️ Удаление блока',
  'editor_insert_mermaid':             '🔷 Вставка диаграммы Mermaid',
}

function friendlyToolName(name) {
  if (!name) return 'Инструмент'
  if (TOOL_NAME_MAP[name]) return TOOL_NAME_MAP[name]
  // Fallback: make raw name readable (strip prefix, replace underscores)
  return name.replace(/^(integram_|editor_|doc_|web_|navigate_|search_platform_)/, '').replace(/_/g, ' ')
}

/**
 * Parse and strip :::actions block from AI response text.
 * Returns { text: cleanedText, suggestedActions: Array|null }
 *
 * AI can embed at the end of a response:
 *   :::actions
 *   [{"label":"Да","action":"message","value":"Да, продолжи"}]
 *   :::
 */
// Strip lines where the model leaked tool result summaries (e.g. "ontology_search_concepts: выполнено")
function filterToolNoise(text) {
  if (!text) return text
  return text
    .split('\n')
    .filter(line => !/^[\w_]+:\s*(выполнено|completed|executed|done|ok|success)\s*$/i.test(line.trim()))
    .join('\n')
    .trim()
}

function extractActionsFromText(text) {
  if (!text) return { text: text || '', suggestedActions: null }
  // Match :::actions block anywhere in the text (not just at end)
  // Strip the block AND any trailing text after it (verifier commentary etc.)
  const match = text.match(/\n*:::actions\s*\n([\s\S]*?)\n:::\s*(?:\n[\s\S]*)?$/)
  if (!match) return { text, suggestedActions: null }
  try {
    const raw = match[1].trim()
    let buttons = null

    // Format 1: single JSON array — [{...}, {...}]
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) buttons = parsed
    } catch {
      // Format 2: multiple JSON arrays, one per line — [{...}]\n[{...}]
      // AI sometimes generates each button as a separate array
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('['))
      const merged = []
      for (const line of lines) {
        try {
          const arr = JSON.parse(line)
          if (Array.isArray(arr)) merged.push(...arr)
        } catch { /* skip malformed lines */ }
      }
      if (merged.length > 0) buttons = merged
    }

    if (!buttons || buttons.length === 0) return { text, suggestedActions: null }
    // Keep only text BEFORE the :::actions block
    const cleanText = text.substring(0, match.index).trimEnd()
    return { text: cleanText, suggestedActions: buttons }
  } catch {
    return { text, suggestedActions: null }
  }
}

function quillHtmlToMarkdown(html) {
  if (!html) return ''
  let md = html

  // Integram embeds — represent as readable placeholders
  md = md.replace(
    /<div[^>]*class="[^"]*integram-table-embed[^"]*"[^>]*data-table-id="([^"]*)"[^>]*data-table-name="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, id, name) => `\n[Таблица Integram: ${name} (ID: ${id})]\n`
  )
  md = md.replace(
    /<div[^>]*class="[^"]*integram-table-embed[^"]*"[^>]*data-table-name="([^"]*)"[^>]*data-table-id="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, name, id) => `\n[Таблица Integram: ${name} (ID: ${id})]\n`
  )
  md = md.replace(
    /<div[^>]*class="[^"]*integram-report-embed[^"]*"[^>]*data-report-id="([^"]*)"[^>]*>/gi,
    (_, id) => `\n[Отчёт Integram (ID: ${id})]\n`
  )
  // FinModel embeds → readable placeholders (before stripping contenteditable divs)
  md = md.replace(
    /<div[^>]*class="[^"]*fin-model-blot[^"]*"[^>]*data-model-id="([^"]*)"[^>]*data-database="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, modelId, db) => `\n[Финмодель (ID: ${modelId}, БД: ${db})]\n`
  )
  // FinModel: alternate attribute order
  md = md.replace(
    /<div[^>]*class="[^"]*fin-model-blot[^"]*"[^>]*data-database="([^"]*)"[^>]*data-model-id="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, db, modelId) => `\n[Финмодель (ID: ${modelId}, БД: ${db})]\n`
  )
  // Ecosystem embeds → readable placeholders
  md = md.replace(
    /<div[^>]*class="[^"]*ecosys-embed[^"]*"[^>]*data-ecosystem-id="([^"]*)"[^>]*data-database="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, ecoId, db) => `\n[Экосистема (ID: ${ecoId}, БД: ${db})]\n`
  )
  md = md.replace(
    /<div[^>]*class="[^"]*ecosys-embed[^"]*"[^>]*data-database="([^"]*)"[^>]*data-ecosystem-id="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, db, ecoId) => `\n[Экосистема (ID: ${ecoId}, БД: ${db})]\n`
  )
  // Mermaid diagram embeds
  md = md.replace(
    /<div[^>]*class="[^"]*mermaid-diagram[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Mermaid-диаграмма]\n'
  )
  // Callout embeds
  md = md.replace(
    /<div[^>]*class="[^"]*callout-block-wrapper[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Каллаут (блок-заметка)]\n'
  )
  // Integram tabs embed
  md = md.replace(
    /<div[^>]*class="[^"]*integram-tabs-embed[^"]*"[^>]*data-database="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, db) => `\n[Табы Integram (БД: ${db})]\n`
  )
  // Integram chart embed
  md = md.replace(
    /<div[^>]*class="[^"]*integram-chart-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[График Integram]\n'
  )
  // Selector filter embed
  md = md.replace(
    /<div[^>]*class="[^"]*selector-embed[^"]*"[^>]*data-name="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, name) => `\n[Селектор-фильтр: ${name}]\n`
  )
  // Tech pyramid embed
  md = md.replace(
    /<div[^>]*class="[^"]*tech-pyramid-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Пирамида технологий]\n'
  )
  // Whiteboard embed
  md = md.replace(
    /<div[^>]*class="[^"]*whiteboard-block-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Whiteboard (доска)]\n'
  )
  // Simple table embed (coda-style)
  md = md.replace(
    /<div[^>]*class="[^"]*coda-simple-table-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Простая таблица]\n'
  )
  // Generic embed (iframe)
  md = md.replace(
    /<div[^>]*class="[^"]*embed-block-placeholder[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Встроенный блок (embed)]\n'
  )
  // Timeline embed
  md = md.replace(
    /<div[^>]*class="[^"]*timeline-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Таймлайн]\n'
  )
  // Calendar embed
  md = md.replace(
    /<div[^>]*class="[^"]*coda-calendar-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Календарь]\n'
  )
  // Map embed
  md = md.replace(
    /<div[^>]*class="[^"]*coda-map-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Карта]\n'
  )
  // Spoiler embed
  md = md.replace(
    /<div[^>]*class="[^"]*spoiler-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Спойлер]\n'
  )
  // Domain block embed
  md = md.replace(
    /<div[^>]*class="[^"]*domain-block-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '\n[Доменный блок]\n'
  )
  // Strip remaining contenteditable divs (embeds inner content)
  md = md.replace(/<div[^>]*contenteditable[^>]*>[\s\S]*?<\/div>/gi, '')

  // Headings — strip inner tags then add markdown prefix
  const stripTags = s => s.replace(/<[^>]+>/g, '').trim()
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${stripTags(t)}\n`)
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${stripTags(t)}\n`)
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${stripTags(t)}\n`)
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `\n#### ${stripTags(t)}\n`)

  // Inline formatting
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${stripTags(t)}`)
  md = md.replace(/<\/ul>/gi, '\n').replace(/<\/ol>/gi, '\n')

  // Paragraphs and breaks
  md = md.replace(/<\/p>/gi, '\n\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Strip all remaining HTML tags
  md = md.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')

  // Normalize whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md
}

export function useChatLogic() {
  const router = useRouter()
  const route = useRoute()

  // ==================== Authentication ====================
  let authStore
  try {
    authStore = useAuthStore()
  } catch (error) {
    console.warn('[useChatLogic] Pinia not ready, deferring authStore access:', error.message)
    authStore = null
  }

  const currentUserId = computed(() => {
    if (authStore?.unifiedSession?.userId) {
      const userId = authStore.unifiedSession.userId
      return typeof userId === 'string' ? parseInt(userId, 10) : userId
    }
    if (authStore?.primaryUserId) {
      const userId = authStore.primaryUserId
      return typeof userId === 'string' ? parseInt(userId, 10) : userId
    }
    const storedId = localStorage.getItem('id')
    if (storedId) {
      return parseInt(storedId, 10)
    }
    return null // fallback
  })

  // ==================== General Chat Integration ====================
  let generalChat
  try {
    const generalChatComposable = useGeneralChat(currentUserId)
    // Wrap in reactive() to auto-unwrap nested refs in templates
    generalChat = reactive(generalChatComposable)
  } catch (error) {
    console.error('[useChatLogic] Failed to initialize generalChat:', error)
    generalChat = null
  }

  // Fallback if generalChat is undefined or null
  if (!generalChat) {
    console.warn('[useChatLogic] generalChat is undefined, using fallback')
    generalChat = reactive({
      activeChat: { id: null, name: 'Загрузка...', messages: [] },
      newMessage: '',
      availableRooms: [],
      loadingRooms: false,
      loadingMessages: false,
      typingUsers: [],
      isConnected: false,
      typingIndicator: computed(() => ''),
      init: async () => { console.warn('[GeneralChat] Init skipped - using fallback') },
      loadRooms: async () => { console.warn('[GeneralChat] LoadRooms skipped'); return [] },
      createDefaultRoom: async () => { console.warn('[GeneralChat] CreateDefaultRoom skipped'); return null },
      joinRoom: async () => { console.warn('[GeneralChat] JoinRoom skipped') },
      sendMessage: async () => { console.warn('[GeneralChat] SendMessage skipped - general chat unavailable') },
      handleTyping: () => {}
    })
  }

  // ==================== State Management ====================

  // UI State
  // Restore last selected tab from localStorage (Issue #7121)
  const savedTabIndex = parseInt(localStorage.getItem('chat_activeTabIndex') || '0', 10)
  const activeTabIndex = ref(isNaN(savedTabIndex) ? 0 : savedTabIndex)
  const showHistory = ref(false)
  const showImageDialog = ref(false)
  const showSettings = ref(false)
  const showTools = ref(false)
  const showDocPicker = ref(false)
  const showAgentsList = ref(false)
  const showDataSelector = ref(false)
  const showCreateWorkspaceDialog = ref(false)
  const showIntegraMCPAuth = ref(false)
  const showEditMessageDialog = ref(false)
  const showCodeExecutionWindow = ref(false)
  const isRecording = ref(false)
  const uploadProgress = ref(0)
  const currentImage = ref('')

  // Refs for file inputs and menus
  const fileInput = ref(null)
  const fileInputGeneral = ref(null)
  const modalFileInput = ref(null)
  const attachmentMenu = ref(null)
  const attachmentMenuGeneral = ref(null)
  const modalAttachmentMenu = ref(null)

  // Container refs (to be bound in components)
  const aiMessagesContainer = ref(null)
  const messagesContainer = ref(null)
  const modalMessagesContainer = ref(null)

  // Model selection - read from ModelSelector's preference format
  // First try app-specific key, then legacy key, then default to Polza Claude
  const loadInitialModelAndProvider = () => {
    // Try unified Chat preference (used by ModelSelector in both sidebar and page)
    const chatPref = localStorage.getItem('modelPreference_Chat')
    if (chatPref) {
      try {
        const parsed = JSON.parse(chatPref)
        if (parsed.preferredModelId && parsed.preferredProvider) {
          console.log('[useChatLogic] Loaded from Chat preference:', parsed)
          return {
            model: parsed.preferredModelId,
            provider: parsed.preferredProvider
          }
        }
      } catch (e) {
        console.warn('[useChatLogic] Failed to parse Chat preference:', e)
      }
    }

    // Fallback: try legacy ChatPage key
    const chatPagePref = localStorage.getItem('modelPreference_ChatPage')
    if (chatPagePref) {
      try {
        const parsed = JSON.parse(chatPagePref)
        if (parsed.preferredModelId && parsed.preferredProvider) {
          console.log('[useChatLogic] Loaded from legacy ChatPage preference:', parsed)
          // Migrate to new unified key
          localStorage.setItem('modelPreference_Chat', chatPagePref)
          return {
            model: parsed.preferredModelId,
            provider: parsed.preferredProvider
          }
        }
      } catch (e) {
        console.warn('[useChatLogic] Failed to parse ChatPage preference:', e)
      }
    }
    // Try legacy key
    const legacy = localStorage.getItem('selectedModel')
    if (legacy) {
      console.log('[useChatLogic] Loaded from legacy key:', legacy)
      // Try to determine provider from model ID
      const provider = legacy.includes('claude') ? 'polza' :
                       legacy.includes('deepseek') ? 'deepseek' :
                       legacy.includes('gpt') ? 'openai' : 'polza'
      return { model: legacy, provider }
    }
    console.log('[useChatLogic] Using default:', DEFAULT_AI_PROVIDER, '+', DEFAULT_AI_MODEL)
    return {
      model: DEFAULT_AI_MODEL,
      provider: DEFAULT_AI_PROVIDER
    }
  }

  const initialSelection = loadInitialModelAndProvider()
  const selectedModel = ref(initialSelection.model)
  const selectedProvider = ref(initialSelection.provider)
  const userAccessToken = ref(localStorage.getItem('userAccessToken') || null)

  // ==================== Context Management ====================

  /** Model context window sizes (conservative estimates) */
  const MODEL_CONTEXT_WINDOWS = {
    'deepseek-chat': 128000,
    'deepseek-reasoner': 128000,
    'claude-sonnet-4-20250514': 128000,
    'claude-3-5-sonnet-20241022': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'yandexgpt': 32000,
    'yandexgpt-lite': 32000,
  }
  const DEFAULT_CONTEXT_WINDOW = 128000

  /** Estimate token count — heuristic optimized for mixed ru/en text */
  const estimateTokens = (messages) => {
    let totalChars = 0
    for (const msg of messages) {
      if (msg.text) totalChars += msg.text.length
      if (msg.thinkingContent) totalChars += msg.thinkingContent.length
    }
    return Math.ceil(totalChars / 3.5)
  }

  /** Get context window for currently selected model */
  const getModelContextWindow = (modelId) => {
    if (!modelId) return DEFAULT_CONTEXT_WINDOW
    const id = modelId.toLowerCase()
    for (const [key, val] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (id.includes(key)) return val
    }
    return DEFAULT_CONTEXT_WINDOW
  }

  /** Reactive context usage tracker */
  const contextUsage = reactive({
    usedTokens: 0,
    maxTokens: DEFAULT_CONTEXT_WINDOW,
    lastRealUsage: null,
    percent: 0
  })

  /** Recalculate context usage from current messages */
  const updateContextUsage = () => {
    const msgs = aiChat.messages.filter(m => !isSystemMessage(m))
    contextUsage.usedTokens = estimateTokens(msgs)
    contextUsage.maxTokens = getModelContextWindow(selectedModel.value)
    contextUsage.percent = Math.min(100, Math.round((contextUsage.usedTokens / contextUsage.maxTokens) * 100))
  }

  // LLM Settings
  const llmSettings = reactive({
    contextSize: parseInt(localStorage.getItem('llm_contextSize')) || 8192,
    gpuLayers: parseInt(localStorage.getItem('llm_gpuLayers')) || 100,
    temperature: parseFloat(localStorage.getItem('llm_temperature')) || 0.6,
    topK: parseInt(localStorage.getItem('llm_topK')) || 40,
    topP: parseFloat(localStorage.getItem('llm_topP')) || 0.9,
    minP: parseFloat(localStorage.getItem('llm_minP')) || 0.1,
    repeatLastN: parseInt(localStorage.getItem('llm_repeatLastN')) || 64,
    repeatPenalty: parseFloat(localStorage.getItem('llm_repeatPenalty')) || 1.0,
    presencePenalty: parseFloat(localStorage.getItem('llm_presencePenalty')) || 0.0,
    frequencyPenalty: parseFloat(localStorage.getItem('llm_frequencyPenalty')) || 0.0,
    customTemplate: localStorage.getItem('llm_customTemplate') || '',
    tensorBufferType: localStorage.getItem('llm_tensorBufferType') || '',
    disableKVOffload: localStorage.getItem('llm_disableKVOffload') === 'true',
    batchSize: parseInt(localStorage.getItem('llm_batchSize')) || 512,
    customSystemPrompt: localStorage.getItem('llm_customSystemPrompt') || '',
    // Issue #6830: Streaming toggle - allows user to explicitly enable/disable SSE streaming
    enableStreaming: localStorage.getItem('llm_enableStreaming') !== 'false', // default ON
    // Issue #6830: Extended thinking support for DeepSeek-R1 and Claude 3.7+
    enableThinking: localStorage.getItem('llm_enableThinking') !== 'false', // default ON
    thinkingBudget: parseInt(localStorage.getItem('llm_thinkingBudget')) || 8000, // tokens
    // Issue #6830: Agent chain orchestration (Scout → Plan → Execute → Verify)
    enableAgentChain: localStorage.getItem('llm_enableAgentChain') !== 'false', // default ON
  })

  // Tools configuration
  const toolsConfig = reactive({
    mcpEnabled: localStorage.getItem('tools_mcpEnabled') !== 'false',
    agentsEnabled: localStorage.getItem('tools_agentsEnabled') !== 'false',
    searchEnabled: localStorage.getItem('tools_searchEnabled') !== 'false',
    webBrowsingEnabled: localStorage.getItem('tools_webBrowsingEnabled') === 'true',
    codeInterpreterEnabled: localStorage.getItem('tools_codeInterpreterEnabled') === 'true',
    integramDatabaseEnabled: localStorage.getItem('tools_integramDatabaseEnabled') !== 'false', // Integram MCP enabled by default
    innAgentEnabled: localStorage.getItem('tools_innAgentEnabled') !== 'false', // INN Agent enabled by default
    egrulAgentEnabled: localStorage.getItem('tools_egrulAgentEnabled') !== 'false', // EGRUL Agent enabled by default
    vatAgentEnabled: localStorage.getItem('tools_vatAgentEnabled') !== 'false', // VAT Calculator Agent enabled by default
    fsspAgentEnabled: localStorage.getItem('tools_fsspAgentEnabled') !== 'false', // FSSP Agent enabled by default
    hhAgentEnabled: localStorage.getItem('tools_hhAgentEnabled') !== 'false', // HeadHunter Agent enabled by default
    codeAnalyzerAgentEnabled: localStorage.getItem('tools_codeAnalyzerAgentEnabled') !== 'false', // Code Analyzer Agent enabled by default
    devHelperAgentEnabled: localStorage.getItem('tools_devHelperAgentEnabled') !== 'false', // Dev Helper Agent enabled by default
    supportAgentEnabled: localStorage.getItem('tools_supportAgentEnabled') !== 'false', // Customer Support Agent enabled by default
    onecAgentEnabled: localStorage.getItem('tools_onecAgentEnabled') !== 'false', // 1C Agent enabled by default
    deepResearchAgentEnabled: localStorage.getItem('tools_deepResearchAgentEnabled') !== 'false', // Deep Research Agent enabled by default
    financialResearchAgentEnabled: localStorage.getItem('tools_financialResearchAgentEnabled') !== 'false', // Financial Research Agent enabled by default
    salesAgentEnabled: localStorage.getItem('tools_salesAgentEnabled') !== 'false', // Sales Agent enabled by default
    webSearch: localStorage.getItem('tools_webSearch') !== 'false', // Tavily web search (on by default)
    // Issue #6834: Native tool calling mode (Think-Act-Observe loop with web_*, doc_*, integram_* tools)
    toolCalling: localStorage.getItem('tools_toolCalling') === 'true', // Native tool calling (off by default)
    // Issue #6834: Tool calling sub-options
    toolCallingWebTools: localStorage.getItem('tools_toolCallingWebTools') !== 'false', // web_search, web_fetch (on by default when tool calling enabled)
    toolCallingDocTools: localStorage.getItem('tools_toolCallingDocTools') !== 'false', // doc_* tools (on by default when tool calling enabled)
    toolCallingIntegramTools: localStorage.getItem('tools_toolCallingIntegramTools') !== 'false' // integram_* tools (on by default when tool calling enabled)
  })

  // Agent mode
  const agentMode = ref(localStorage.getItem('chat_agentMode') === 'true')
  const deepAgentEnabled = ref(localStorage.getItem('chat_deepAgent') === 'true')

  // Running agents tracking (for UI indication)
  const runningAgents = ref([]) // Array of { name, startTime, status }

  // Chat state
  // NOTE: Инициализация с default messages. Реальная история загружается из Integram в init()
  const aiChat = reactive({
    messages: [
      {
        text: 'Ты цифровой помощник. Отвечаешь кратко и по существу. Анализируешь JSON в которых таблицы в формате:Работаем с таблицей: headers (id,value,type,isMain) определяют колонки, rows (id,values) содержат ячейки с headerId для связи данных.',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: true,
      },
      {
        text: 'Я могу анализировать таблицы и отчёты, отвечать на вопросы и т.д.\nЧем могу помочь?',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
        isSystemGreeting: true, // Skip in conversationHistory
      },
    ],
  })

  // Use general chat state from useGeneralChat composable
  const activeChat = generalChat.activeChat
  const newMessage = generalChat.newMessage

  const aiMessage = ref('')
  const aiDisplayText = ref('')  // Short label for quick prompts (shown in chat instead of full prompt)
  const aiLoading = ref(false)
  const aiError = ref(null)
  const assistantMessage = ref(null)
  const currentAttachments = ref([])
  // Fallback retry state (tier fallback is now handled by backend chatWithFallback)
  const _fallbackRetry = ref(null) // null | { userMessage, attachments }
  // AbortController for cancelling in-flight AI requests
  let _abortController = null

  // Selected agent for chat (set by AgentSelector in ChatPage.vue)
  // When set, this agent will be used directly bypassing orchestrator trigger matching
  const selectedAgentForChat = ref(null)

  /**
   * Set the selected agent for chat messages
   * @param {Object|null} agent - Agent object with id, name, etc. or null to clear
   */
  const setSelectedAgentForChat = (agent) => {
    selectedAgentForChat.value = agent
    if (agent) {
      logger.info('[useChatLogic] Selected agent for chat:', agent.name, '(ID:', agent.id, ')')
      try { localStorage.setItem('selectedChatAgent', JSON.stringify(agent)) } catch {}
    } else {
      logger.info('[useChatLogic] Cleared selected agent for chat')
      localStorage.removeItem('selectedChatAgent')
    }
  }

  // Restore agent from localStorage on init
  try {
    const savedAgent = localStorage.getItem('selectedChatAgent')
    if (savedAgent) {
      selectedAgentForChat.value = JSON.parse(savedAgent)
      logger.info('[useChatLogic] Restored agent from localStorage:', selectedAgentForChat.value?.name)
    }
  } catch {}


  // Session management
  const currentSessionId = ref(null)
  const isApiAvailable = ref(false)
  // sessionHistory removed - using unified savedChats system for both Chat.vue and ChatPage.vue
  const loadingHistory = ref(false)

  // Message editing
  const editingMessageIndex = ref(null)
  const editingMessageText = ref('')

  // Voice recognition
  const recognition = ref(null)

  // Workspace management
  const workspaces = ref([])
  const selectedWorkspace = ref(null)
  const loadingWorkspaces = ref(false)
  const creatingWorkspace = ref(false)
  const createWorkspaceError = ref(null)
  const newWorkspace = reactive({
    name: '',
    repositoryUrl: '',
    branch: 'main'
  })

  // Integram MCP state
  const integraMCPState = reactive({
    isAuthenticated: false,
    serverURL: '',
    database: '',
    username: '',
    userId: null
  })

  const integramAuthForm = reactive({
    serverURL: 'https://ai2o.ru',
    database: 'my',
    login: '',
    password: ''
  })

  const integramAuthLoading = ref(false)
  const integramAuthError = ref(null)

  // ==================== Integram MCP Functions (Phase 1) ====================
  // Issue #7113: Add missing MCP authentication functions

  const checkIntegraMCPConnection = () => {
    const status = integraMCPService.getConnectionStatus()
    Object.assign(integraMCPState, status)
    return status
  }

  const handleIntegraMCPAuth = async () => {
    integramAuthLoading.value = true
    integramAuthError.value = null

    try {
      const result = await integraMCPService.authenticate({
        serverURL: integramAuthForm.serverURL,
        database: integramAuthForm.database,
        login: integramAuthForm.login,
        password: integramAuthForm.password
      })

      if (result.success) {
        // Update state
        checkIntegraMCPConnection()

        // Close dialog
        showIntegraMCPAuth.value = false

        // Clear password
        integramAuthForm.password = ''

        // Show success notification
        logger.debug('[useChatLogic] Integram MCP authenticated:', result)
      }
    } catch (error) {
      integramAuthError.value = error.message
      logger.error('[useChatLogic] Integram MCP authentication failed:', error)
    } finally {
      integramAuthLoading.value = false
    }
  }

  const handleIntegraMCPLogout = () => {
    integraMCPService.logout()
    checkIntegraMCPConnection()
    integramAuthForm.password = ''
  }

  const testIntegraMCP = async () => {
    try {
      logger.debug('[useChatLogic] Testing Integram MCP with getDictionary...')
      const result = await integraMCPService.getDictionary()
      logger.debug('[useChatLogic] Integram MCP test successful:', result)
      return result
    } catch (error) {
      logger.error('[useChatLogic] Integram MCP test failed:', error)
      throw error
    }
  }

  // Code execution
  const codeExecutions = ref([])

  // Data selector
  const selectedDataType = ref(null)
  const selectedDataItem = ref(null)
  const dataComment = ref('')
  const loadingDataItems = ref(false)
  const dataItems = ref([])
  const dataTypes = ref([
    { label: 'Таблица Integram', value: 'integram_table' },
    { label: 'Отчёт Integram', value: 'integram_report' }
  ])

  // Chat management
  const savedChats = ref(JSON.parse(localStorage.getItem('savedChats') || '[]'))
  const newChatName = ref('')

  // API configuration - UNIFIED CHAT ENDPOINT
  const CHAT_API_URL = '/api/chat' // Single entry point, routes to all providers via coordinator
  const SYSTEM_PROMPT = `Ты - ИИ-ассистент платформы ФСТ НТИ (Фонд Суверенных Технологий). ВСЕГДА отвечай ТОЛЬКО на русском языке. Отвечаешь кратко и по существу.

О ПЛАТФОРМЕ ФСТ НТИ:
ФСТ НТИ — венчурный фонд, финансирующий технологические проекты в сфере БПЛА (БАС), робототехники и малой энергетики. Платформа управляет инвестиционным процессом: от воронки сделок до портфельного мониторинга.

ДАННЫЕ ФОНДА В БАЗЕ (ai2o.ru/fst, РЕАЛЬНЫЕ):
- Таблица 1155 «Проекты ФСТ v2»: 6 проектов
  1. АО «МикроСхема» — БПЛА-комплектующие, БАС, статус: В процессе DD
  2. ООО «РоботАгро» — агро-дроны, БАС, статус: Одобрен ИК
  3. ПАО «ДронМед» — медицинская доставка, БАС, статус: Портфельная
  4. ООО «СтелсКоптер» — военная разведка, БАС, статус: Отказ
  5. АО «ЭнергоМини» — МЭ, малая энергетика, статус: В работе
  6. ООО «РобоТех» — промышленные роботы, Робот, статус: Due Diligence
- Таблица 1082 «Субфонды»: 3 субфонда (БАС, РОБО, МЭ)
- Таблица 1160 «Решения ИК»: решения инвестиционного комитета
- Таблица 1164 «Сделки»: сделки по портфельным компаниям
- Таблица 1169 «Портфельные компании»: 3 компании (МикроСхема, РоботАгро, ДронМед)

ПРАВИЛА ОТВЕТОВ НА ВОПРОСЫ О ФОНДЕ:
⚡ ОТВЕЧАЙ НЕМЕДЛЕННО из данных выше — НЕ вызывай kb_search, search, или любые другие инструменты для вопросов о проектах ФСТ. Данные уже есть в контексте.
- «сколько проектов» → сразу: В базе ФСТ 6 проектов (таблица ниже)
- «какие проекты» / «список» → перечисли все 6 с описанием
- «портфель» / «портфельные» → 3 компании: МикроСхема, РоботАгро, ДронМед
- «субфонды» → БАС, РОБО, МЭ
- Вопросы о конкретном проекте → отвечай из данных выше немедленно
- Только если вопрос выходит за пределы этих данных — тогда используй инструменты

О ПЛАТФОРМЕ DRONDOC (базовые возможности):
DronDoc — платформа-конструктор приложений с ИИ-агентами, созданная для работы с данными, документами и автоматизации бизнес-процессов.

РЕАЛЬНО РАБОТАЮЩИЕ ВОЗМОЖНОСТИ:
- Мультимодельный ИИ-чат: 8 провайдеров (DeepSeek, Claude, GPT-4o, YandexGPT, Kodacode и др.) с автоматическим переключением
- Integram — low-code СУБД: таблицы, отчёты, формы, AI-кнопки в ячейках. Production-система на ai2o.ru
- 60+ MCP-инструментов для AI-доступа к базам данных через стандартный протокол Model Context Protocol
- Блочный редактор документов (по типу Notion) с AI-вставками: финмодели, экосистемы, таблицы, импорт DOCX/PDF/XLSX
- Парсеры государственных данных РФ: ЕГРЮЛ, ФССП, ИНН, Торги (torgi.gov.ru) — РЕАЛЬНЫЕ данные в реальном времени
- Онтология БПЛА: 902 концепта (дроны, компоненты, технологии, миссии), поиск на RU/EN/ZH
- Событийная онтология: сценарии применения БАС (С/Х, пожары, доставка, мониторинг), причинно-следственные модели
- MBSE (системная инженерия): требования, трассировка, конечные автоматы, SysML-диаграммы
- Telegram-интеграции: бот, парсер групп/каналов, облачное хранилище Pentaract
- Tool calling (native): я могу вызывать инструменты — искать в базах, парсить данные, навигировать по платформе
- TAO-агент: автономный цикл Think-Act-Observe для сложных задач
- Агентская цепочка: разведчик → планировщик → исполнитель → верификатор

ДАННЫЕ — ЧЕСТНАЯ КАРТИНА:
- Госданные (ЕГРЮЛ, ФССП, Торги) — РЕАЛЬНЫЕ, парсятся с гос.сайтов в реальном времени
- Integram таблицы — РЕАЛЬНЫЕ production-данные
- Документы и финмодели — РЕАЛЬНЫЕ
- Онтология БПЛА — собрана из открытых источников, 902 концепта
- Справочник дронов (характеристики, цены) — из открытых источников, может быть неполным
- Агро-модуль — ПРОТОТИП с синтетическими данными, реальных датчиков нет
- Телеметрия дронов (MAVLink) — ПРОТОТИП, UI готов, реальных подключений нет
- Каталог из 100+ агентов — реально функционируют ~15-20, остальные — витрина/прототипы

ТЕХНОЛОГИИ: Vue 3, Node.js, Vite, PrimeVue, Express, 220+ API-маршрутов, Cloudflare, systemd.
150+ страниц в приложении, 2360+ API-эндпоинтов.

Когда спрашивают "что ты умеешь" — перечисли РЕАЛЬНЫЕ возможности. Когда спрашивают про данные — честно разделяй реальные и синтетические.

Анализируешь JSON в которых таблицы в формате: headers (id,value,type,isMain) определяют колонки, rows (id,values) содержат ячейки с headerId для связи данных.

ПРАВИЛА ИСПОЛЬЗОВАНИЯ ИНСТРУМЕНТОВ:
- Вопросы о БПЛА, дронах, их характеристиках, китайских/российских/зарубежных БПЛА → НЕМЕДЛЕННО вызови ontology_search_concepts для поиска в онтологии (902 концепта)
- Поисковые запросы с конкретным объектом ("кто такой X", "найди [конкретное]", "что такое Z", "статьи про X", "страница X") → НЕМЕДЛЕННО вызови kb_search или search_platform_routes БЕЗ планирования
- Если объект поиска НЕ указан ("найди что-нибудь", "найди в базе знаний", "что-то найди", "что-нибудь") → НЕ вызывай инструменты, СРАЗУ уточни у пользователя: "Что именно вы хотите найти?"
- Навигация ("открой X", "перейди на X", "покажи страницу X") → НЕМЕДЛЕННО: search_platform_routes → navigate_to
- Нашёл новую информацию → НЕМЕДЛЕННО kb_save_entity для сохранения
- Сложные задачи (создать, построить, разработать) → сначала составь план, потом действуй
- Агентные задачи ("парси X", "собери данные о X", "найди все Y", "заполни таблицу", "исследуй рынок") → НЕМЕДЛЕННО вызови launch_agent с подробным описанием задачи
- НЕ говори "я буду искать" или "позволь мне найти" — просто ВЫЗОВИ инструмент и верни результат
- После выполнения инструментов: давай СОДЕРЖАТЕЛЬНЫЙ ответ на основе полученных данных. НИКОГДА не отвечай в формате "название_инструмента: выполнено" — это не ответ, это мусор. Если запрос неясен — уточни у пользователя.`

  // ==================== Issue #6507: Document context for AI chat ====================
  const editorDocumentContext = ref(null)

  // Listen for document context updates from IntegramDocumentEditor
  const handleEditorContextUpdate = (event) => {
    editorDocumentContext.value = event.detail
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('editor-context-update', handleEditorContextUpdate)
    // Also pick up existing context if editor is already open
    if (window.__editorDocumentContext) {
      editorDocumentContext.value = window.__editorDocumentContext
    }
  }

  // ==================== Issue #6832: Integram table context for AI chat ====================
  const integramTableContext = ref(null)

  // ==================== Issue #7017: FinModel context for AI chat ====================
  // Tracks active FinModel block when user is on BlockDocumentEditor page
  const finmodelContext = ref(null) // { activeModelId, modelTitle, selectedRow, cellValues }

  const handleFinmodelContextUpdate = (event) => {
    finmodelContext.value = event.detail
    logger.debug('[useChatLogic] FinModel context updated:', event.detail?.activeModelId)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('finmodel-context-update', handleFinmodelContextUpdate)
    if (window.__finmodelContext) {
      finmodelContext.value = window.__finmodelContext
    }
  }

  // ==================== Issue #7057: Ecosystem context for AI chat ====================
  // Tracks active Ecosystem block when user is on BlockDocumentEditor page
  const ecosystemContext = ref(null) // { activeEcosystemId }

  const handleEcosystemContextUpdate = (event) => {
    ecosystemContext.value = event.detail
    logger.debug('[useChatLogic] Ecosystem context updated:', event.detail?.activeEcosystemId)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('ecosystem-context-update', handleEcosystemContextUpdate)
    if (window.__ecosystemContext) {
      ecosystemContext.value = window.__ecosystemContext
    }
  }

  // Issue #6832: Agent status bar state (shown during agent:status SSE events)
  const agentStatusBar = ref({ isVisible: false, phase: '', message: '', icon: '', progress: null, sources: [] })

  // Poll background agent job status; insert result as chat message when done
  function startAgentJobPolling(jobId, initialMessage) {
    agentStatusBar.value = { isVisible: true, phase: 'running', message: `🤖 ${initialMessage}`, icon: '🤖', progress: null, sources: [] }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/chat/agent-job/${jobId}`))
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'running') {
          // still running — update message if we have one
          if (data.recentLog) {
            agentStatusBar.value.message = `🤖 Агент работает...`
          }
          return
        }
        // done or failed — stop polling
        clearInterval(interval)
        agentStatusBar.value.isVisible = false
        if (data.status === 'completed') {
          const summary = data.summary || data.result?.summary || 'Агент завершил работу.'
          aiChat.messages.push({
            text: `✅ **Агент завершил задачу:**\n\n${summary}`,
            isUser: false,
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          })
        } else if (data.status === 'failed') {
          aiChat.messages.push({
            text: `❌ Агент завершил работу с ошибкой: ${data.error || 'неизвестная ошибка'}`,
            isUser: false,
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          })
        }
        await nextTick()
        scrollToBottom(aiMessagesContainer)
      } catch (_) { /* network error, retry next tick */ }
    }, 5000)
  }

  // Listen for Integram table context updates from IntegramDataTableWrapper
  const handleIntegramTableContextUpdate = (event) => {
    integramTableContext.value = event.detail
    logger.debug('[useChatLogic] Integram table context updated:', event.detail?.tableName || event.detail?.typeId)
  }

  // Function to manually set table context (called from components)
  const setIntegramTableContext = (context) => {
    integramTableContext.value = context
    // Also emit event for other components to pick up
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('integram-table-context-update', { detail: context }))
      window.__integramTableContext = context
    }
  }

  // Function to clear table context
  const clearIntegramTableContext = () => {
    integramTableContext.value = null
    if (typeof window !== 'undefined') {
      window.__integramTableContext = null
    }
  }

  // Issue #6832: Clear document context (e.g. when user clicks × in ContextBar)
  const clearEditorDocumentContext = () => {
    editorDocumentContext.value = null
  }

  // Additional reference documents (read-only context for AI)
  const additionalDocuments = ref([])

  const addAdditionalDocument = (doc) => {
    if (!additionalDocuments.value.find(d => d.id === doc.id)) {
      additionalDocuments.value.push(doc)
    }
  }

  const removeAdditionalDocument = (docId) => {
    additionalDocuments.value = additionalDocuments.value.filter(d => d.id !== docId)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('integram-table-context-update', handleIntegramTableContextUpdate)
    // Also pick up existing context if table is already open
    if (window.__integramTableContext) {
      integramTableContext.value = window.__integramTableContext
    }
  }

  // ==================== Computed Properties ====================

  // Safe helper — route can be a Vue Proxy with a throwing getter
  // when Chat remounts via ErrorBoundary outside router inject context
  const _routePath = computed(() => {
    try { return route?.path ?? '' } catch { return '' }
  })

  const isEditorPage = computed(() => {
    const p = _routePath.value
    return p.startsWith('/editor') || p.startsWith('/integram-doc-editor') || p.startsWith('/block-editor')
  })

  const isBlockEditorPage = computed(() => _routePath.value.startsWith('/block-editor'))

  // Issue #6832: Detect Integram table pages
  const isIntegramTablePage = computed(() => {
    // Match routes like /integram/{db}/table/{id} or /integram/{db}/{id}
    return _routePath.value.match(/^\/integram\/[^/]+\/(table\/)?[0-9]+/)
  })

  // Detect ontology-related pages
  const isOntologyPage = computed(() => {
    const p = _routePath.value
    return p.startsWith('/event-ontology') || p.startsWith('/ontology') || p.startsWith('/drononomics')
  })

  // Contextual action chips for ontology pages
  const ontologyContextualActions = computed(() => {
    if (!isOntologyPage.value) return []
    const p = _routePath.value
    const actions = [
      { label: 'Сценарии БАС', icon: 'pi pi-flag', prompt: 'Покажи все сценарии применения БАС (беспилотных авиационных систем). Используй event_engine_get_scenarios.' },
      { label: 'Статистика', icon: 'pi pi-chart-bar', prompt: 'Покажи статистику событийной онтологии: сколько концептов, акторов, моделей, индивидов. Используй event_engine_get_stats.' },
      { label: 'Список акторов', icon: 'pi pi-users', prompt: 'Покажи список всех акторов событийной онтологии. Используй event_engine_list_actors.' }
    ]
    if (p.startsWith('/event-ontology')) {
      actions.push(
        { label: 'Создать сценарий', icon: 'pi pi-plus', prompt: 'Помоги создать новый сценарий применения БАС. Спроси меня какой сценарий нужен, затем используй event_engine_create_concept.' },
        { label: 'BSL-запрос', icon: 'pi pi-search', prompt: 'Помоги составить BSL-запрос к событиям. Какие фильтры тебе нужны? Доступны: $Actor, $BEFORE, $AFTER, $BETWEEN, $FIRST, $LAST, $JOIN, $PATTERN.' }
      )
    }
    if (p.startsWith('/ontology')) {
      actions.push(
        { label: 'Поиск концептов', icon: 'pi pi-search', prompt: 'Найди концепты в онтологии БПЛА. О чём искать? Используй ontology_search_concepts.' },
        { label: 'Иерархия', icon: 'pi pi-sitemap', prompt: 'Покажи иерархию концептов онтологии БПЛА. Начни с корневых элементов. Используй ontology_get_hierarchy.' }
      )
    }
    if (p.startsWith('/drononomics')) {
      actions.push(
        { label: 'Модели событий', icon: 'pi pi-box', prompt: 'Покажи все модели событий в событийной онтологии. Используй event_engine_list_models.' }
      )
    }
    return actions
  })

  // ==================== Watchers ====================

  // Note: Model/provider preferences are saved by ModelSelector component
  // useChatLogic only reads from localStorage on init, ModelSelector handles saving
  watch(selectedModel, (newVal) => {
    // Only save to legacy key for backward compatibility
    localStorage.setItem('selectedModel', newVal)
  })

  watch(llmSettings, (newVal) => {
    Object.keys(newVal).forEach(key => {
      localStorage.setItem(`llm_${key}`, String(newVal[key]))
    })
  }, { deep: true })

  watch(toolsConfig, (newVal) => {
    Object.keys(newVal).forEach(key => {
      localStorage.setItem(`tools_${key}`, String(newVal[key]))
    })
  }, { deep: true })

  watch(agentMode, (newVal) => {
    localStorage.setItem('chat_agentMode', String(newVal))
    if (newVal) {
      loadWorkspaces()
    }
  })

  watch(deepAgentEnabled, (newVal) => {
    localStorage.setItem('chat_deepAgent', String(newVal))
  })

  // Issue #7121: Persist active tab index so the last selected tab is restored on reload
  // Guard against -1 which ChatPage.vue temporarily sets during forced TabView re-init
  watch(activeTabIndex, (newVal) => {
    if (newVal >= 0) {
      localStorage.setItem('chat_activeTabIndex', String(newVal))
    }
  })

  // NOTE: localStorage сохранение происходит явно как fallback после каждого сообщения
  // Автоматический watch удалён, чтобы избежать дублирования с Integram

  // Issue #6507: Clear document context when navigating away from editor
  watch(() => route?.path, (newPath) => {
    if (!newPath?.startsWith('/editor') && !newPath?.startsWith('/integram-doc-editor')) {
      editorDocumentContext.value = null
    }
  })

  // Issue #6832: Clear Integram table context when navigating away from table pages
  watch(() => route?.path, (newPath) => {
    if (!newPath?.match(/^\/integram\/[^/]+\/(table\/)?[0-9]+/)) {
      integramTableContext.value = null
      if (typeof window !== 'undefined') {
        window.__integramTableContext = null
      }
    }
  })

  // ==================== Helper Functions ====================

  const isSystemMessage = (msg) => {
    return msg.text && msg.text.includes('Ты цифровой помощник') && msg.isUser
  }

  const getCombinedSystemPrompt = () => {
    // Check for custom agent system prompt from customer-journey
    const customAgentPrompt = localStorage.getItem('customAgentSystemPrompt')
    const customAgentName = localStorage.getItem('customAgentName')

    // If custom agent is loaded, use its system prompt as base
    let combined = customAgentPrompt
      ? `Ты - AI-агент "${customAgentName}".\n\n${customAgentPrompt}\n\n---\n\nДополнительные возможности DronDoc:\n${SYSTEM_PROMPT}`
      : SYSTEM_PROMPT

    // Add information about enabled agents/tools
    const enabledAgents = []
    if (toolsConfig.innAgentEnabled) {
      enabledAgents.push('INN Analytics Agent (автоматический поиск данных по ИНН компаний)')
    }
    if (toolsConfig.egrulAgentEnabled) {
      enabledAgents.push('EGRUL Parser Agent (официальные данные из ЕГРЮЛ ФНС по ИНН/ОГРН/названию)')
    }
    if (toolsConfig.codeInterpreterEnabled) {
      enabledAgents.push('Code Interpreter (выполнение Python кода)')
    }
    if (toolsConfig.webBrowsingEnabled) {
      enabledAgents.push('Web Browsing (получение актуальной информации из интернета)')
    }
    if (toolsConfig.integramDatabaseEnabled) {
      enabledAgents.push('Integram Database (работа с таблицами Integram через MCP)')
    }
    if (toolsConfig.mcpEnabled) {
      enabledAgents.push('MCP Tools (Model Context Protocol серверы)')
    }
    if (toolsConfig.searchEnabled) {
      enabledAgents.push('Search Tools (поиск в интернете)')
    }
    if (toolsConfig.agentsEnabled) {
      enabledAgents.push('General Agents (агентная система)')
    }
    if (toolsConfig.deepResearchAgentEnabled) {
      enabledAgents.push('Deep Research Agent (глубокий анализ компаний, рынков, HR - триггеры: /research, @исследование, "проанализируй компанию")')
    }
    if (toolsConfig.financialResearchAgentEnabled) {
      enabledAgents.push('Financial Research Agent (котировки, валюты, финансовый анализ - триггеры: /finance, @финансы, "курс доллара", "акции Сбербанка")')
    }

    if (enabledAgents.length > 0) {
      combined += '\n\nПодключённые агенты и инструменты:\n' + enabledAgents.map(a => `- ${a}`).join('\n')
      combined += '\n\nКогда пользователь спрашивает про агентов или инструменты, сообщи какие агенты сейчас подключены из этого списка.'

      // Add specific usage instructions for Integram Database
      if (toolsConfig.integramDatabaseEnabled) {
        combined += '\n\nВАЖНО: Когда пользователь спрашивает про таблицы, базу данных, данные в Integram - ОБЯЗАТЕЛЬНО используй MCP инструменты:'
        combined += '\n- integram_get_dictionary - получить список всех таблиц'
        combined += '\n- integram_get_type_metadata - получить структуру таблицы (колонки, типы)'
        combined += '\n- integram_get_object_list - получить данные из таблицы'
        combined += '\n- integram_get_all_objects - получить ВСЕ объекты из таблицы'
        combined += '\nНИКОГДА не выдумывай данные о таблицах - всегда используй реальные данные через MCP!'
      }
    }

    // Always include ontology tools context
    combined += '\n\nОнтологические инструменты (всегда доступны):'
    combined += '\n📖 Чтение:'
    combined += '\n- ontology_search_concepts — поиск в онтологии БПЛА (902 концепта: дроны, компоненты, технологии, миссии). RU/EN/ZH.'
    combined += '\n- ontology_get_concept — детали концепта (названия 3 языка, определение, связи)'
    combined += '\n- ontology_get_hierarchy — дерево broader/narrower'
    combined += '\n- event_engine_get_scenarios — сценарии БАС (С/Х, пожары, нефтепровод, доставка, ЛЭП, строительство, экомониторинг)'
    combined += '\n- event_engine_get_mission — детали миссии (события, таймлайн, причинные цепочки)'
    combined += '\n- event_engine_get_stats — статистика событийной онтологии'
    combined += '\n- event_engine_list_concepts — все СОД-концепты с привязками к онтологии БПЛА'
    combined += '\n- event_engine_list_actors — акторы (пилоты, дроны, операторы, системы)'
    combined += '\n- event_engine_list_models — модели событий (шаблоны сценариев)'
    combined += '\n- event_engine_get_model_tree — дерево событий модели (причинно-следственная структура)'
    combined += '\n✏️ Создание и запуск:'
    combined += '\n- event_engine_create_concept — создать концепт (новый сценарий) с привязкой к онтологии БПЛА'
    combined += '\n- event_engine_create_actor — создать актора (пилот, дрон, оператор)'
    combined += '\n- event_engine_create_individual — создать индивида (экземпляр миссии)'
    combined += '\n- event_engine_execute_model — запустить модель для индивида (создать дерево предметных событий)'
    combined += '\n- event_engine_link_ontology — привязать СОД-концепт к элементу онтологии БПЛА'
    combined += '\n🔎 Аналитика:'
    combined += '\n- event_engine_query_bsl — BSL-запрос: $Actor, $BEFORE/$AFTER/$BETWEEN, $FIRST/$LAST, $JOIN, $PATTERN'
    combined += '\n🔧 MBSE (системная инженерия):'
    combined += '\n- mbse_list_requirements — список системных требований (фильтры: тип, приоритет, статус)'
    combined += '\n- mbse_create_requirement — создать требование (привязка к концепту СОД)'
    combined += '\n- mbse_get_traceability — матрица трассировки (derives/satisfies/verifies/refines/allocates)'
    combined += '\n- mbse_trace_requirement — создать связь между требованиями'
    combined += '\n- mbse_list_states — состояния конечного автомата (FSM) модели'
    combined += '\n- mbse_create_state — создать состояние (initial/normal/final/composite)'
    combined += '\n- mbse_create_transition — создать переход FSM (триггер, условие, действие)'
    combined += '\n- mbse_execute_fsm — запустить FSM для индивида'
    combined += '\n- mbse_generate_diagram — SysML диаграмма (bdd/ibd/activity/requirements)'
    combined += '\n- mbse_verify_requirement — записать результат верификации'
    combined += '\n- mbse_get_coverage — матрица покрытия требований'
    combined += '\n\nКогда пользователь спрашивает про БПЛА, дроны, сценарии, миссии, онтологию — ОБЯЗАТЕЛЬНО используй эти инструменты!'
    combined += '\nДля создания нового сценария: create_concept → create_individual → execute_model.'
    combined += '\nДля анализа событий: query_bsl с фильтрами по актору и времени.'
    combined += '\nДля MBSE: mbse_create_requirement → mbse_trace_requirement → mbse_verify_requirement.'

    if (llmSettings.customSystemPrompt && llmSettings.customSystemPrompt.trim()) {
      combined += '\n\n' + llmSettings.customSystemPrompt.trim()
    }

    // Issue #6507: Add document context when user is on the editor page
    const docCtx = editorDocumentContext.value || window.__editorDocumentContext
    if (isEditorPage.value && docCtx) {
      const isBlockEditor = docCtx.route === '/block-editor' || docCtx.documentId

      if (isBlockEditor) {
        combined += '\n\n=== БЛОЧНЫЙ РЕДАКТОР DRONDOC ==='
        combined += '\nТы — ИИ-ассистент блочного редактора DronDoc. Ты НАПРЯМУЮ редактируешь документ через инструменты.'

        combined += '\n\n## СТРУКТУРА ДОКУМЕНТА'
        combined += '\nДокумент хранится в Integram (БД) как HTML-строка в поле req 996446 объекта типа 996443.'
        combined += '\nФормат: последовательность HTML-блоков:'
        combined += '\n  <h1>Заголовок 1</h1>'
        combined += '\n  <h2>Раздел</h2>'
        combined += '\n  <p>Абзац текста</p>'
        combined += '\n  <ul><li>Элемент списка</li></ul>'
        combined += '\n  <table>...</table>'
        combined += '\nБлоки ПЛОСКИЕ — нет страниц, нет вложенности. Только последовательность HTML-элементов.'

        // Issue #7043: Tool descriptions are provided via OpenAI function calling format.
        // Only include usage hints here, NOT full parameter descriptions (avoids dual description → model describes tools in text instead of calling them).
        combined += '\n\n## ИНСТРУМЕНТЫ'
        combined += '\nТы ОБЯЗАН использовать function calling (tool_call) для редактирования документа. НИКОГДА не описывай инструменты текстом — ВЫЗЫВАЙ их!'
        combined += '\nКРИТИЧНО: Если пользователь просит "добавь таблицу N" или "вставь таблицу N" — СРАЗУ вызывай editor_insert_integram_table({ tableId: N }) БЕЗ уточняющих вопросов. Число = ID таблицы в Integram.'
        combined += '\n\nОсновные инструменты (вызывай через tool_call):'
        combined += '\n  • editor_str_replace — ОСНОВНОЙ. Точный поиск и замена текста. old_str = ЧИСТЫЙ текст (без Markdown), должен ТОЧНО совпадать.'
        combined += '\n  • editor_append_section — добавить раздел (заголовок + контент) в конец'
        combined += '\n  • editor_insert_text — вставить HTML-фрагмент'
        combined += '\n  • editor_insert_integram_table — встроить интерактивную таблицу из Integram'
        combined += '\n  • editor_insert_integram_report — встроить отчёт Integram'
        combined += '\n  • editor_insert_simple_table — вставить HTML-таблицу'
        combined += '\n  • editor_clear_and_write — ОПАСНО: полная перезапись документа'
        combined += '\n  • editor_insert_finmodel — вставить блок финансовой модели (P&L, NPV, IRR)'
        combined += '\n  • editor_insert_ecosystem — вставить блок экосистемы (Sankey, Леонтьев, Монте-Карло)'
        combined += '\n  • editor_update_finmodel — обновить активный блок FinModel (требует клик пользователя на блок)'
        combined += '\n  • editor_read_finmodel — прочитать данные финмодели (P&L, NPV, IRR)'
        combined += '\n  • editor_read_ecosystem — прочитать данные экосистемы'
        combined += '\n  • editor_update_ecosystem — изменить параметры экосистемы (требует клик пользователя на блок)'
        combined += '\n  • editor_insert_business_transform — вставить раздел трансформации AS-IS → TO-BE'
        combined += '\n  • editor_insert_mermaid — вставить Mermaid-диаграмму (code: строка mermaid-кода)'
        combined += '\n  • editor_insert_callout — вставить блок-выноску (text, type: info/warning/error/success)'
        combined += '\n  • editor_insert_embed — встроить внешний контент по URL (YouTube, Figma и др.)'
        combined += '\n  • editor_insert_spoiler — вставить спойлер/сворачиваемый блок (title, defaultOpen)'
        combined += '\n  • editor_insert_drononomics — вставить блок Дронономика (симуляция БАС)'
        combined += '\n  • editor_insert_ecosystem_unified — вставить Экосистему БАС (7 моделей + бэктест)'
        combined += '\n  • editor_insert_ontology — вставить Онтологию БПЛА (SKOS таксономия)'
        combined += '\n  • editor_insert_osint — вставить OSINT-дашборд (аналитика рынка БПЛА)'
        combined += '\n  • editor_insert_integram_chart — открыть конфигуратор диаграммы Integram'
        combined += '\n  • editor_insert_integram_tabs — вставить вкладки Integram (несколько таблиц/карточек)'
        combined += '\n  • editor_delete_block — удалить embedded блок из документа по типу (finmodel/ecosystem/integram-table и др.)'
        combined += '\n  • editor_plan_steps — показать план действий перед многошаговым редактированием'

        combined += '\n\n## EMBEDDED ОБЪЕКТЫ (интерактивные блоки)'
        combined += '\nВ документе могут быть специальные блоки — они не редактируются через editor_str_replace.'
        combined += '\nОни видны в содержимом документа как [Финмодель (ID: ...)], [Экосистема (ID: ...)], [Таблица Integram: ...] и т.д.'
        combined += '\nДля удаления любого embed-блока: editor_delete_block({ blockType: "тип", occurrence: 1 })'
        combined += '\nТипы блоков: finmodel, ecosystem, ecosystem-unified, integram-table, integram-report, integram-chart, mermaid, callout, selector, embed, simple-table, whiteboard, tech-pyramid, integram-tabs, timeline, calendar, map, spoiler'
        combined += '\nОни распознаются по CSS-классу и data-атрибутам:\n'
        combined += '\n### Финмодель (fin-model-blot)'
        combined += '\n```html'
        combined += '\n<div class="fin-model-blot" contenteditable="false"'
        combined += '\n  data-model-id="17446"         ← ID финмодели'
        combined += '\n  data-database="fm"             ← база данных'
        combined += '\n  data-server="ai2o.ru">'
        combined += '\n```'
        combined += '\n→ Вставить: editor_insert_finmodel({ modelId, database, server })'
        combined += '\n→ Удалить: editor_delete_block({ blockType: "finmodel", occurrence: 1 })'
        combined += '\n→ Читать: editor_read_finmodel({ modelId })'
        combined += '\n→ Обновить: editor_update_finmodel({ instruction: "..." })'
        combined += '\n\n### Экосистема (ecosys-embed)'
        combined += '\n```html'
        combined += '\n<div class="ecosys-embed" contenteditable="false"'
        combined += '\n  data-ecosystem-id="12345"      ← ID экосистемы'
        combined += '\n  data-database="fm">'
        combined += '\n```'
        combined += '\n→ Вставить: editor_insert_ecosystem({ ecosystemId, database })'
        combined += '\n→ Удалить: editor_delete_block({ blockType: "ecosystem", occurrence: 1 })'
        combined += '\n→ Читать: editor_read_ecosystem({ ecosystemId })'
        combined += '\n→ Обновить: editor_update_ecosystem({ instruction: "..." })'
        combined += '\n\n### Таблица Integram (integram-table-embed)'
        combined += '\n```html'
        combined += '\n<div class="integram-table-embed" contenteditable="false"'
        combined += '\n  data-database="kval"          ← база данных'
        combined += '\n  data-table-id="916814"        ← ID типа/таблицы в Integram'
        combined += '\n  data-table-name="Объект контроля"  ← отображаемое имя'
        combined += '\n  data-table-mode="simple">     ← simple|full|cards'
        combined += '\n```'
        combined += '\n→ Вставить: editor_insert_integram_table({ tableId, tableName, database, mode })'
        combined += '\n→ Удалить: editor_delete_block({ blockType: "integram-table", occurrence: 1 })'
        combined += '\n→ Читать данные: integram_get_object_list или integram_smart_query (MCP tools)'

        combined += '\n\n### Отчёт Integram (integram-report-embed)'
        combined += '\n```html'
        combined += '\n<div class="integram-report-embed"'
        combined += '\n  data-database="kval"  data-report-id="999">'
        combined += '\n```'
        combined += '\n→ Вставить: editor_insert_integram_report({ reportId, database })'
        combined += '\n→ Удалить: editor_delete_block({ blockType: "integram-report", occurrence: 1 })'

        combined += '\n\n### Простая HTML-таблица'
        combined += '\n```html'
        combined += '\n<table><thead><tr><th>Кол-во</th><th>Баллы</th></tr></thead><tbody>...</tbody></table>'
        combined += '\n```'
        combined += '\n→ Вставить: editor_insert_simple_table({ headers: [...], rows: [[...], [...]] })'

        combined += '\n\n### Селектор-фильтр (selector-embed)'
        combined += '\n```html'
        combined += '\n<div class="selector-embed" data-name="КНО" data-database="kval" data-type-id="916811">'
        combined += '\n```'
        combined += '\n→ Интерактивный фильтр. Связывается с таблицами через data-selector-name.'

        combined += '\n\n## КАК РАБОТАТЬ С INTEGRAM (читать данные)'
        combined += '\nДля поиска таблиц: integram_get_dictionary(database) → список всех типов с ID и именами'
        combined += '\nДля чтения строк: integram_get_object_list(typeId, { limit: 10 })'
        combined += '\nДля поиска: integram_search_objects(typeId, query)'
        combined += '\nДля запросов: integram_smart_query("найди все таблицы с полем Дата")'
        combined += '\nАутентификация: integram_authenticate({ serverURL: "ai2o.ru", database: "kval", login: "d", password: "d" })'
        combined += '\nПосле аутентификации все integram_* операции доступны.'

        combined += '\n\n## WORKFLOW: "загугли и вставь в документ"'
        combined += '\n1. editor_plan_steps([...шаги...]) — показать план'
        combined += '\n2. Поиск в вебе через web search tools'
        combined += '\n3. editor_append_section / editor_insert_simple_table — вставить в документ'
        combined += '\n4. Ответить кратко что сделано'

        combined += '\n\n## ПРАВИЛА'
        combined += '\n  ✗ НЕ пиши HTML/текст в чат — это не редактирует документ!'
        combined += '\n  ✗ НЕ передавай весь документ в new_str/content без необходимости!'
        combined += '\n  ✓ Для исправления ошибок: editor_str_replace (один вызов = одна замена)'
        combined += '\n  ✓ Для добавления: editor_append_section или editor_insert_text'
        combined += '\n  ✓ Можно делать несколько вызовов подряд для разных правок'

        const _db = docCtx.database || 'kval'
        if (docCtx.documentId) {
          combined += `\n\n## ДОКУМЕНТ`
          combined += `\nID: ${docCtx.documentId} | БД: ${_db} | Название: "${docCtx.title}"`
        } else {
          combined += `\n\nДокумент: "${docCtx.title}"`
        }

        // Integram DB context for MCP tools
        combined += `\n\n## INTEGRAM`
        combined += `\nБД по умолчанию: "${_db}" на ai2o.ru`
        combined += `\nДля поиска/вставки таблиц: integram_authenticate({ serverURL: "ai2o.ru", database: "${_db}", login: "d", password: "d" }) → integram_get_dictionary() → editor_insert_integram_table(...)`

        // Issue #7057: FinModel context — include when a FinModel block is active
        const _fmCtx = finmodelContext.value || window.__finmodelContext
        const _ecoCtx = ecosystemContext.value || window.__ecosystemContext
        if (_fmCtx?.activeModelId) {
          combined += `\n\n## АКТИВНАЯ ФИНМОДЕЛЬ`
          combined += `\nID активного блока FinModel: ${_fmCtx.activeModelId}`
          combined += `\nПользователь кликнул на этот блок — он готов к чтению и обновлению.`
          combined += `\nЧтобы прочитать данные (NPV, IRR, P&L): editor_read_finmodel({ modelId: "${_fmCtx.activeModelId}" })`
          combined += `\nЧтобы изменить данные: editor_update_finmodel({ instruction: "...", modelId: "${_fmCtx.activeModelId}" })`
        } else {
          combined += `\n\n## ФИНМОДЕЛЬ И ЭКОСИСТЕМА`
          combined += `\nЕсли просит добавить экосистему / Sankey-диаграмму: editor_insert_ecosystem({}) — вставляет новый блок.`
          combined += `\n\n### WORKFLOW: Создание финмодели (ОБЯЗАТЕЛЬНО следуй этим шагам!)`
          combined += `\nКогда пользователь просит создать финансовую модель (например "Сделай финмодель дронов"):`
          combined += `\n⚠️ ВАЖНО: Выполняй ВСЕ шаги последовательно. НЕ заменяй шаг 2 на поиск в интернете или вызов агентов.`
          combined += `\n1. Вызови editor_insert_finmodel({}) — модель создаётся автоматически с шаблоном P&L`
          combined += `\n2. СРАЗУ ЖЕ вызови editor_update_finmodel({ instruction: "Установи значения: Выручка от реализации = X, Себестоимость продаж = Y, Зарплата и соцвзносы = Z, Аренда и коммунальные = W, Маркетинг и реклама = V, Прочие расходы = U, Амортизация = T, Проценты по кредитам = S" })`
          combined += `\n   Подставь реалистичные числа (в рублях) исходя из тематики. НЕ нужен поиск — придумай сам разумные значения.`
          combined += `\n   Ответ содержит полный расчёт P&L с EBITDA, чистой прибылью и рентабельностью.`
          combined += `\n3. Прокомментируй результат: покажи ключевые показатели (рентабельность, EBITDA, чистая прибыль), дай рекомендации.`
          combined += `\nНЕ ПРОПУСКАЙ шаг 2! Финмодель без данных бесполезна. Пользователь ожидает заполненную модель.`
          combined += `\n\nВходные поля P&L: Выручка от реализации, Прочие доходы, Себестоимость продаж, Зарплата и соцвзносы, Аренда и коммунальные, Маркетинг и реклама, Прочие расходы, Амортизация, Проценты по кредитам`
          combined += `\nРасчётные (автоматически): Итого выручка, Итого расходы, EBITDA, EBIT, Прибыль до налогов, Налог на прибыль (20%), Чистая прибыль, Рентабельность`
          combined += `\n\nКогда пользователь просит изменить показатель (напр. "хочу 30% рентабельность"):`
          combined += `\n1. Подбери новые входные значения чтобы достичь целевой рентабельности`
          combined += `\n2. Вызови editor_update_finmodel с новыми значениями`
          combined += `\n3. Прокомментируй: какие показатели изменились и почему`
          combined += `\n\nПримеры бизнес-моделей дронов:`
          combined += `\n- Агро-опрыскивание: 10 дронов × 500 га/сезон × 2000 руб/га = 10 млн выручки`
          combined += `\n- Мониторинг: лётные часы × 40 000 руб/час`
          combined += `\n- Грузоперевозки: 100 кг×км × тариф`
        }
        if (_ecoCtx?.activeEcosystemId) {
          combined += `\n\n## АКТИВНАЯ ЭКОСИСТЕМА`
          combined += `\nID активного блока Ecosystem: ${_ecoCtx.activeEcosystemId}`
          combined += `\nПользователь кликнул на этот блок экосистемы — он готов к чтению и обновлению.`
          combined += `\nЧтобы прочитать данные (бизнесы, Sankey, матрица Леонтьева, Монте-Карло): editor_read_ecosystem({ ecosystemId: "${_ecoCtx.activeEcosystemId}" })`
          combined += `\nЧтобы добавить бизнесы/потоки или изменить параметры: editor_update_ecosystem({ instruction: "...", ecosystemId: "${_ecoCtx.activeEcosystemId}" })`
          if (_ecoCtx.businessesTypeId) combined += `\nID таблицы «Бизнесы»: ${_ecoCtx.businessesTypeId}`
          if (_ecoCtx.flowsTypeId) combined += `\nID таблицы «Потоки»: ${_ecoCtx.flowsTypeId}`
        } else {
          combined += `\n\nЧтобы прочитать данные экосистемы — попроси пользователя кликнуть на блок Ecosystem, затем используй editor_read_ecosystem.`
          combined += `\nЧтобы изменить экосистему — попроси пользователя кликнуть на блок Ecosystem, затем используй editor_update_ecosystem.`
        }

        if (docCtx.selectedText) {
          combined += `\n\n⚠️ ВЫДЕЛЕННЫЙ ФРАГМЕНТ — работай только с ним:\n"${docCtx.selectedText}"`
        }

        // Document content: HTML → Markdown (preserves headings, lists, bold, embeds)
        const _docMarkdown = docCtx.html ? quillHtmlToMarkdown(docCtx.html) : (docCtx.content || '')
        if (_docMarkdown) {
          const _preview = _docMarkdown.length > 6000 ? _docMarkdown.substring(0, 6000) + '\n...(обрезано)' : _docMarkdown
          combined += `\n\n## СОДЕРЖИМОЕ ДОКУМЕНТА (Markdown)\n${_preview}`
          combined += '\n(# = H1, ## = H2, **текст** = жирный, [Таблица Integram: ...] = embedded объект)'
        }

        // Additional reference documents (read-only)
        if (additionalDocuments.value.length > 0) {
          combined += '\n\n## ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ (только чтение — не редактируй эти документы)'
          combined += '\nЭти документы предоставлены как справочный материал. Используй их содержимое при ответах, но не изменяй их через инструменты.'
          additionalDocuments.value.forEach((doc, i) => {
            combined += `\n\n### [${i + 1}] "${doc.title}"`
            combined += `\n${doc.content || '(содержимое недоступно)'}`
          })
        }

        combined += '\n\n## SUGGESTED ACTIONS (опционально)'
        combined += '\nКогда ответ подразумевает выбор из нескольких вариантов — добавь в самый конец ответа блок кнопок:'
        combined += '\n:::actions'
        combined += '\n[{"label":"Краткое название","action":"message","value":"Сообщение от пользователя при нажатии"}]'
        combined += '\n:::'
        combined += '\nПравила:'
        combined += '\n• Используй только когда есть реальный выбор (2-4 кнопки максимум)'
        combined += '\n• Не добавляй кнопки в каждый ответ — только когда полезно'
        combined += '\n• action типы: "message" — отправить сообщение, "copy" — скопировать value в буфер'
        combined += '\n• Примеры: ["Добавить введение","Добавить заключение","Добавить список источников"] — варианты дополнения документа'
        combined += '\n• Блок :::actions ДОЛЖЕН быть последним в ответе, без текста после него'

        combined += '\n=== КОНЕЦ ==='
      } else {
        combined += '\n\n--- РЕЖИМ АССИСТЕНТА РЕДАКТОРА ДОКУМЕНТОВ ---'
        combined += '\nТы — ИИ-ассистент текстового редактора DronDoc. Твоя задача — помогать пользователю писать, редактировать и улучшать документы.'
        combined += '\nФорматируй ответы как ЧИСТЫЙ HTML без markdown-обёрток (без ```html...``` блоков). Используй теги: p, ul, ol, li, strong, em, h3, h4.'
        combined += `\n\nТекущий документ: "${docCtx.title}"`
        if (docCtx.content) {
          combined += `\nСодержимое (${docCtx.fullLength > 8000 ? 'первые 8000 из ' + docCtx.fullLength + ' символов' : docCtx.fullLength + ' символов'}):\n${docCtx.content}`
        }
        combined += '\n\nЕсли пользователь просит написать, дополнить или изменить текст — формируй готовый текст для вставки в документ.'
      }
      combined += '\n--- КОНЕЦ КОНТЕКСТА ---'
    }

    // Issue #6832: Add Integram table context when user is on a table page
    const tableCtx = integramTableContext.value || window.__integramTableContext
    if (tableCtx) {
      combined += '\n\n--- РЕЖИМ АССИСТЕНТА ТАБЛИЦЫ INTEGRAM ---'
      combined += '\nТы — ИИ-ассистент для работы с таблицей Integram. Ты знаешь структуру таблицы и можешь помочь с обработкой данных.'
      combined += `\n\nТекущая таблица: "${tableCtx.tableName || 'Таблица ' + tableCtx.typeId}"`
      combined += `\nБаза данных: ${tableCtx.database || 'не указана'}`
      combined += `\nID типа: ${tableCtx.typeId || 'не указан'}`

      if (tableCtx.columns && tableCtx.columns.length > 0) {
        combined += `\n\nСтруктура таблицы (${tableCtx.columns.length} колонок):\n`
        combined += tableCtx.columns.map(col => `- ${col.alias || col.value || col.id} (ID: ${col.termId || col.id}, тип: ${col.type || 'неизвестен'})`).join('\n')
      }

      if (tableCtx.selectedRows && tableCtx.selectedRows.length > 0) {
        combined += `\n\nВыбранные строки (${tableCtx.selectedRows.length}):\n`
        combined += JSON.stringify(tableCtx.selectedRows.slice(0, 5), null, 2)
        if (tableCtx.selectedRows.length > 5) {
          combined += `\n... и ещё ${tableCtx.selectedRows.length - 5} строк`
        }
      }

      combined += '\n\nДоступные команды для работы с таблицей:'
      combined += '\n- /fill-table - заполнить колонку для всех строк (пример: "/fill-table Описание используя Название")'
      combined += '\n- /summarize - сделать сводку по данным таблицы'
      combined += '\n- /filter - помочь отфильтровать данные'
      combined += '\n--- КОНЕЦ КОНТЕКСТА ТАБЛИЦЫ ---'
    }

    // Debug logging
    console.log('[getCombinedSystemPrompt] toolsConfig:', { ...toolsConfig })
    console.log('[getCombinedSystemPrompt] enabledAgents:', enabledAgents)
    console.log('[getCombinedSystemPrompt] documentContext:', docCtx ? `"${docCtx.title}" (${docCtx.fullLength} chars)` : 'none')
    console.log('[getCombinedSystemPrompt] tableContext:', tableCtx ? `"${tableCtx.tableName || tableCtx.typeId}" (${tableCtx.columns?.length || 0} columns)` : 'none')
    console.log('[getCombinedSystemPrompt] Final prompt length:', combined.length)

    // Save to window for debugging
    if (typeof window !== 'undefined') {
      window.__lastSystemPrompt = combined
    }

    return combined
  }

  const scrollToBottom = (container) => {
    nextTick(() => {
      if (!container?.value) return
      // Support both raw DOM elements and Vue component refs (e.g. DynamicScroller)
      const el = container.value.$el || container.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  const isImage = (attachment) => {
    if (!attachment) return false
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const name = attachment.name || attachment.url || ''
    return imageExts.some(ext => name.toLowerCase().endsWith(ext))
  }

  const getAttachmentIcon = (attachment) => {
    if (!attachment) return 'pi pi-file'
    const name = attachment.name || attachment.url || ''
    if (name.endsWith('.pdf')) return 'pi pi-file-pdf'
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'pi pi-file-word'
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'pi pi-file-excel'
    return 'pi pi-file'
  }

  const getAttachmentDisplayName = (attachment) => {
    if (!attachment) return 'Файл'
    return attachment.name || attachment.id || 'Файл'
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getWorkspaceName = (id) => {
    const ws = workspaces.value.find(w => w.id === id)
    return ws ? ws.name : id
  }

  const getWorkspaceRepo = (id) => {
    const ws = workspaces.value.find(w => w.id === id)
    return ws ? (ws.repositoryUrl || 'Не указан') : 'Не указан'
  }

  // ==================== Model Selection ====================

  const handleModelChange = ({ modelId, model }) => {
    logger.debug('Model changed:', { modelId, model })
    selectedModel.value = modelId

    // Update provider when model changes
    if (model && model.provider_name) {
      selectedProvider.value = model.provider_name
      logger.debug('Provider updated to:', model.provider_name)
    }

    localStorage.setItem('selectedModel', modelId)

    // Update context window for the new model
    updateContextUsage()
  }

  const handleDeepAgentToggle = () => {
    logger.debug('Deep Agent toggled:', deepAgentEnabled.value)
  }

  // ==================== API Health Check ====================

  const checkPolzaHealth = async () => {
    // NOTE: Unified /api/chat is stateless and always available
    // No need for health check - just assume API is ready
    logger.info('[checkPolzaHealth] Unified API always available (stateless)')
    isApiAvailable.value = true
    return true
  }

  // ==================== Demo Response Generator ====================

  const generateDemoResponse = (userMessage, model) => {
    const message = userMessage.toLowerCase()

    if (message.includes('привет') || message.includes('hello') || message.includes('добр')) {
      return `Привет! Я ИИ-ассистент платформы DronDoc. Сейчас AI-модель ${model} временно недоступна, поэтому отвечаю в офлайн-режиме.

Когда модель доступна, я могу:
- Искать данные в госреестрах (ЕГРЮЛ, ФССП, Торги) — это реальные данные
- Работать с таблицами Integram через 60+ MCP-инструментов
- Редактировать документы с AI-вставками
- Искать в онтологии БПЛА (902 концепта)
- Запускать агентов для исследований и анализа

Попробуйте переключить модель (DeepSeek, Claude, GPT-4o) в настройках.`
    }

    if (message.includes('помощь') || message.includes('help') || message.includes('что умеешь') || message.includes('возможност') || message.includes('расскажи о себе')) {
      return `Я — ИИ-ассистент DronDoc. Честно о моих возможностях:

**Реально работает (когда AI-модель доступна):**
- Мультимодельный чат (8 провайдеров: DeepSeek, Claude, GPT-4o, YandexGPT и др.)
- Парсинг госданных РФ: ЕГРЮЛ, ФССП, ИНН, Торги — реальные данные в реальном времени
- Работа с Integram (low-code СУБД): таблицы, отчёты, формы, 60+ MCP-инструментов
- Блочный редактор документов с AI (импорт DOCX/PDF/XLSX)
- Онтология БПЛА: 902 концепта, событийные модели, MBSE
- Telegram-интеграции: бот, парсер групп, хранилище Pentaract
- Tool calling: я вызываю инструменты, а не просто генерирую текст

**Прототипы (UI готов, данные синтетические):**
- Телеметрия дронов (MAVLink) — нет реальных подключений
- Агро-модуль — синтетические данные
- Каталог 100+ агентов — реально работают ~15-20

Сейчас модель ${model} недоступна. Попробуйте другую модель в настройках.`
    }

    if (message.includes('данные') || message.includes('источник') || message.includes('откуда')) {
      return `**Источники данных DronDoc (честная картина):**

**Реальные данные:**
- ЕГРЮЛ / ИНН / ФССП — парсинг с гос.сайтов в реальном времени
- Торги (torgi.gov.ru) — реальные торги и аукционы
- Integram таблицы — production-данные на ai2o.ru
- Документы и финмодели — реальные
- Telegram — реальные группы и каналы
- Онтология БПЛА — 902 концепта из открытых источников

**Синтетические/демо данные:**
- Справочник дронов — из открытых источников, может быть неполным
- Агро-модуль — демо-данные, нет реальных датчиков
- Часть каталога агентов — описания без реализации

Модель ${model} сейчас недоступна для полноценного анализа.`
    }

    if (message.includes('технолог') || message.includes('стек') || message.includes('архитектур')) {
      return `**Технологический стек DronDoc:**

**Frontend:** Vue 3, Vite, PrimeVue, Pinia, vue-router (150+ маршрутов), chart.js, OpenLayers
**Backend:** Node.js, Express, 220+ файлов API (2360+ эндпоинтов)
**AI:** 8 провайдеров (DeepSeek, Claude, GPT-4o, YandexGPT, Kodacode, Polza, DeepAI, OpenCode)
**Данные:** Integram (low-code СУБД), SQLite (кэш), 60+ MCP-инструментов
**Инфраструктура:** 2 сервера, systemd, Cloudflare, SOCKS5 прокси для госсервисов

Модель ${model} сейчас недоступна. Переключите в настройках.`
    }

    if (message.includes('спасиб') || message.includes('thanks')) {
      return `Пожалуйста! Для полноценной работы переключите модель AI в настройках. Доступны: DeepSeek, Claude, GPT-4o, YandexGPT и другие.`
    }

    const responses = [
      `Модель ${model} сейчас временно недоступна. Я работаю в офлайн-режиме и могу рассказать о возможностях платформы. Для полноценного ответа переключите модель в настройках (DeepSeek, Claude, GPT-4o).`,
      `Понял ваш запрос. К сожалению, модель ${model} временно недоступна. Попробуйте другую модель в настройках. DronDoc поддерживает 8 AI-провайдеров.`,
      `Хороший вопрос! Для ответа нужна AI-модель, но ${model} временно не отвечает. Переключитесь на другую модель. Спросите "что умеешь" — расскажу о возможностях.`
    ]

    return responses[Math.floor(Math.random() * responses.length)]
  }

  // ==================== Main Chat Functions ====================

  // Use sendMessage from generalChat composable
  const sendMessage = async () => {
    await generalChat.sendMessage()
    scrollToBottom(messagesContainer)
  }

  // ========== INN Agent Integration ==========

  /**
   * Call INN Agent to fetch company data by INN
   * @param {string} inn - INN number (10 or 12 digits)
   * @returns {Promise<Object>} Company data or error
   */
  const callINNAgent = async (inn) => {
    const agentName = 'INN Analytics Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[INN Agent] Starting search for INN: ${inn}`)

      // Call the agent service
      const result = await innAnalyticsService.getCompanyByINN(inn)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = result.success ? 'completed' : 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed/failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return result
    } catch (error) {
      logger.error('[INN Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: false,
        error: error.message || 'Ошибка при получении данных по ИНН',
        data: null
      }
    }
  }

  /**
   * Check if message contains INN request and process it
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no INN found
   */
  const processINNRequest = async (message) => {
    // INN Agent works independently of agentMode (utility agent)
    if (!toolsConfig.innAgentEnabled) {
      return null
    }

    // Extract INN from message (10 or 12 digits)
    const innMatch = message.match(/\b(\d{10}|\d{12})\b/)

    if (!innMatch) {
      return null
    }

    const inn = innMatch[1]
    logger.debug(`[INN Agent] Found INN in message: ${inn}`)

    // Call agent
    const result = await callINNAgent(inn)

    if (!result.success) {
      return `❌ Ошибка поиска по ИНН ${inn}: ${result.error}`
    }

    // Format company data for display
    const company = result.data.company
    let response = `🔍 **Данные по ИНН ${inn}:**\n\n`
    response += `📋 **Название:** ${company.name || 'Н/Д'}\n`
    response += `🏢 **Тип:** ${company.entityType || 'Н/Д'}\n`
    response += `📝 **ОГРН:** ${company.ogrn || 'Н/Д'}\n`

    if (company.kpp) {
      response += `🔢 **КПП:** ${company.kpp}\n`
    }

    response += `📅 **Дата регистрации:** ${company.registrationDate || 'Н/Д'}\n`
    response += `📍 **Адрес:** ${company.address || 'Н/Д'}\n`

    if (company.okved) {
      response += `💼 **ОКВЭД:** ${company.okved}\n`
    }

    response += `\n✅ *Источник: ${company.source}*`

    return response
  }

  // ========== Web Search Agent Integration ==========

  /**
   * Call Web Search Agent to search the internet
   * @param {string} query - Search query
   * @returns {Promise<Object>} Search results or error
   */
  const callSearchAgent = async (query) => {
    const agentName = 'Web Search Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[Search Agent] Starting search for: ${query}`)

      // Call the search service
      const result = await searchWeb(query)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'completed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: true,
        data: result
      }
    } catch (error) {
      logger.error('[Search Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: false,
        error: error.message || 'Ошибка при поиске в интернете',
        data: null
      }
    }
  }

  /**
   * Check if message contains web search request and process it
   * Triggers: "найди в интернете <query>", "поиск <query>", "search <query>", "загугли <query>"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no search request found
   */
  const processSearchRequest = async (message) => {
    if (!toolsConfig.searchEnabled) {
      return null
    }

    // Check for search trigger keywords (case-insensitive)
    const searchTriggers = /(найди в интернете|поиск в интернете|загугли|search|веб.?поиск|искать в сети)\s+(.+)/i
    const match = message.match(searchTriggers)

    if (!match) {
      return null
    }

    const query = match[2].trim()
    logger.debug(`[Search Agent] Found search request: ${query}`)

    // Call agent
    const result = await callSearchAgent(query)

    if (!result.success) {
      return `❌ Ошибка поиска: ${result.error}`
    }

    // Format search results
    return formatSearchResults(result.data)
  }

  // ========== VAT Calculator Agent Integration ==========

  /**
   * Call VAT Calculator Agent to calculate Russian VAT
   * @param {Object} request - Parsed VAT request from vatCalculatorService
   * @returns {Promise<Object>} Calculation result
   */
  const callVatAgent = async (request) => {
    const agentName = 'VAT Calculator Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[VAT Agent] Calculating VAT:`, request)

      // Calculate VAT using service
      const result = vatCalculatorService.calculateVat(request)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = result.success ? 'completed' : 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed/failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return result
    } catch (error) {
      logger.error('[VAT Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: false,
        error: error.message || 'Ошибка при расчёте НДС'
      }
    }
  }

  /**
   * Check if message contains VAT request and process it
   * Triggers: "ндс 100000", "ндс из 120000", "выделить ндс"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no VAT request found
   */
  const processVatRequest = async (message) => {
    if (!toolsConfig.vatAgentEnabled) {
      return null
    }

    // Parse VAT request from message
    const request = vatCalculatorService.parseVatRequest(message)

    if (!request) {
      return null
    }

    logger.debug(`[VAT Agent] Found VAT request:`, request)

    // Call agent
    const result = await callVatAgent(request)

    // Format and return result
    return vatCalculatorService.formatVatResult(result)
  }

  // ========== FSSP Agent Integration ==========

  /**
   * Call FSSP Agent to check debts by INN
   * @param {string} inn - INN to check
   * @returns {Promise<Object>} Debt check result
   */
  const callFsspAgent = async (inn) => {
    const agentName = 'FSSP Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[FSSP Agent] Checking debts for INN: ${inn}`)

      // Call FSSP service
      const result = await fsspService.searchByINN(inn)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = result.success ? 'completed' : 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed/failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return result
    } catch (error) {
      logger.error('[FSSP Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: false,
        error: error.message || 'Ошибка при проверке долгов в ФССП',
        data: null
      }
    }
  }

  /**
   * Check if message contains FSSP debt check request and process it
   * Triggers: "долги ИНН", "фссп 1234567890", "проверить долги"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no FSSP request found
   */
  const processFsspRequest = async (message) => {
    if (!toolsConfig.fsspAgentEnabled) {
      return null
    }

    // Parse debt request from message
    const request = fsspService.parseDebtRequest(message)

    if (!request) {
      return null
    }

    logger.debug(`[FSSP Agent] Found debt request:`, request)

    // Call agent
    const result = await callFsspAgent(request.inn)

    // Format and return result
    return fsspService.formatDebtResult(result, request.inn)
  }

  // ========== HeadHunter Agent Integration ==========

  /**
   * Call HH Agent to search vacancies, estimate salaries, or find employers
   * @param {Object} request - Parsed HH request
   * @returns {Promise<string>} Formatted response
   */
  const callHHAgent = async (request) => {
    const agentName = 'HeadHunter Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[HH Agent] Processing request:`, request)

      // Call HH service
      const result = await processHHRequestService(request)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'completed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return result
    } catch (error) {
      logger.error('[HH Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return `❌ Ошибка HeadHunter Agent: ${error.message}`
    }
  }

  /**
   * Check if message contains HH request and process it
   * Triggers: "вакансии {должность}", "зарплата {должность}", "работодатель {компания}"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no HH request found
   */
  const processHHAgentRequest = async (message) => {
    if (!toolsConfig.hhAgentEnabled) {
      return null
    }

    // Parse HH request from message
    const request = parseHHRequest(message)

    if (!request) {
      return null
    }

    logger.debug(`[HH Agent] Found HH request:`, request)

    // Call agent
    return await callHHAgent(request)
  }

  // ========== EGRUL Agent Integration ==========

  /**
   * Call EGRUL Agent to fetch official company data from FNS registry
   * @param {string} query - INN, OGRN, or company name
   * @returns {Promise<Object>} Company data or error
   */
  const callEGRULAgent = async (query) => {
    const agentName = 'EGRUL Parser Agent'

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running'
      })

      logger.debug(`[EGRUL Agent] Starting search for: ${query}`)

      // Call the agent service
      const result = await egrulService.getCompanyData(query)

      // Update agent status
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = result.success ? 'completed' : 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()

        // Auto-remove completed/failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return result
    } catch (error) {
      logger.error('[EGRUL Agent] Error:', error)

      // Update agent status to failed
      const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
      if (agentIndex !== -1) {
        runningAgents.value[agentIndex].status = 'failed'
        runningAgents.value[agentIndex].endTime = Date.now()
        runningAgents.value[agentIndex].error = error.message

        // Auto-remove failed agents after 5 seconds
        setTimeout(() => {
          const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
          if (idx !== -1) {
            runningAgents.value.splice(idx, 1)
          }
        }, 5000)
      }

      return {
        success: false,
        error: error.message || 'Ошибка при получении данных из ЕГРЮЛ',
        data: null
      }
    }
  }

  /**
   * Check if message contains EGRUL request and process it
   * Triggers: "егрюл <query>", "егрул <ИНН>", "egrul <query>"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null if no EGRUL request found
   */
  const processEGRULRequest = async (message) => {
    // EGRUL Agent works independently of agentMode (utility agent)
    if (!toolsConfig.egrulAgentEnabled) {
      return null
    }

    // Check for EGRUL trigger keywords (case-insensitive)
    // Note: \b doesn't work with Cyrillic, so we use simpler pattern
    const egrulTriggers = /(егрюл|egrul|егрул)\s+(.+)/i
    const match = message.match(egrulTriggers)

    if (!match) {
      return null
    }

    const query = match[2].trim()
    logger.debug(`[EGRUL Agent] Found EGRUL request: ${query}`)

    // Call agent
    const result = await callEGRULAgent(query)

    if (!result.success) {
      return `❌ Ошибка поиска в ЕГРЮЛ: ${result.error}`
    }

    // Return formatted response
    return result.formatted
  }

  // ========== Code Analyzer Agent Integration ==========

  /**
   * Check if message contains code analysis request
   * Triggers: "анализ кода", "проверить код", "код ревью"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processCodeAnalyzerRequest = async (message) => {
    if (!toolsConfig.codeAnalyzerAgentEnabled) {
      return null
    }

    const triggers = /(анализ кода|проверить код|код ревью|code review|analyze code)/i
    if (!triggers.test(message)) {
      return null
    }

    logger.debug('[Code Analyzer Agent] Triggered')

    return `💻 **Code Analyzer Agent**

Я могу помочь с анализом кода! Для полного функционала перейдите на страницу [Code Analyzer](/code-analyzer).

**Возможности:**
• Статический анализ кода
• Поиск уязвимостей
• Проверка стиля кода
• Рекомендации по улучшению

Чтобы использовать агента здесь в чате, просто вставьте код и я его проанализирую.`
  }

  // ========== Dev Helper Agent Integration ==========

  /**
   * Check if message contains dev helper request
   * Triggers: "помощь разработчику", "помощь с кодом"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processDevHelperRequest = async (message) => {
    if (!toolsConfig.devHelperAgentEnabled) {
      return null
    }

    const triggers = /(помощь разработчику|помощь с кодом|dev help|developer help)/i
    if (!triggers.test(message)) {
      return null
    }

    logger.debug('[Dev Helper Agent] Triggered')

    return `🛠️ **Dev Helper Agent**

Готов помочь с разработкой! Подробнее на странице [Dev Helper](/dev-helper).

**Могу помочь с:**
• Генерация кода
• Отладка ошибок
• Рефакторинг
• Написание тестов
• Документация

Задайте ваш вопрос и я помогу!`
  }

  // ========== Customer Support Agent Integration ==========

  /**
   * Check if message contains support request
   * Triggers: "поддержка", "тикет", "жалоба"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processSupportAgentRequest = async (message) => {
    if (!toolsConfig.supportAgentEnabled) {
      return null
    }

    const triggers = /(поддержка клиент|создать тикет|жалоба клиента|customer support|support ticket)/i
    if (!triggers.test(message)) {
      return null
    }

    logger.debug('[Support Agent] Triggered')

    return `🎧 **Customer Support Agent**

Система поддержки клиентов готова! Полный функционал на [Customer Support](/customer-support).

**Возможности:**
• Создание тикетов
• Автоматические ответы
• Приоритизация обращений
• Интеграция с Telegram
• Аналитика обращений

Опишите проблему клиента, и я помогу создать тикет.`
  }

  // ========== 1C Agent Integration ==========

  /**
   * Check if message contains 1C integration request
   * Triggers: "1с", "1c"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processOneCAgentRequest = async (message) => {
    if (!toolsConfig.onecAgentEnabled) {
      return null
    }

    const triggers = /(^|\s)(1с|1c)\s/i
    if (!triggers.test(message)) {
      return null
    }

    logger.debug('[1C Agent] Triggered')

    return `📊 **1C Integration Agent**

Интеграция с 1С:Предприятие готова! Подробнее на [1C Agent](/onec-agent).

**Возможности:**
• Подключение к 1С через OData/HTTP
• Получение данных из справочников
• Синхронизация документов
• Выполнение запросов
• Двусторонняя интеграция

Укажите параметры подключения к вашей базе 1С.`
  }

  // ========== Sales Agent Integration ==========

  /**
   * Check if message contains sales request
   * Triggers: "лиды", "воронка", "скоринг лида", "квалификация лида"
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processSalesAgentRequest = async (message) => {
    if (!toolsConfig.salesAgentEnabled) {
      return null
    }

    const triggers = /(лид|воронка продаж|скоринг|квалификац|продажи помощь|sales help|leads|sales funnel)/i
    if (!triggers.test(message)) {
      return null
    }

    logger.debug('[Sales Agent] Triggered')

    return `💼 **Sales Agent**

AI-помощник по продажам активирован! Полный функционал на [Sales Agent](/sales-agent).

**Возможности:**
• Генерация лидов из Telegram групп
• Скоринг лидов
• Управление воронкой продаж
• AI-коммуникация с клиентами
• Аналитика кампаний

Подробнее о задаче, и я помогу!`
  }

  // ========== Deep Research Agent Integration ==========

  /**
   * Process Deep Research Agent request
   * Triggers on: /research, @исследование, @исследуй, @research
   * Or implicit triggers: "проанализируй компанию", "найди информацию о", etc.
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processDeepResearchRequest = async (message) => {
    if (!toolsConfig.deepResearchAgentEnabled) {
      return null
    }

    // Use agentTriggerService to detect if this is a deep research request
    const detection = agentTriggerService.detectAgent(message)

    if (detection.agent !== AGENT_TYPES.DEEP_RESEARCH) {
      return null
    }

    logger.debug('[Deep Research Agent] Triggered with confidence:', detection.confidence)

    const agentName = 'Deep Research Agent'
    const query = agentTriggerService.extractQuery(message)

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running',
        phase: 'starting'
      })

      // Get AI token ID from localStorage (like other services: CaptionService, VoiceAssistant)
      const accessToken = localStorage.getItem('current_ai_token_id') || '206099'

      // Return a promise that resolves when research is complete
      return new Promise((resolve) => {
        let progressMessages = []

        agentTriggerService.executeAgent(AGENT_TYPES.DEEP_RESEARCH, query, {
          accessToken,
          onProgress: (event) => {
            // Update running agent status
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].phase = event.phase || event.type
              runningAgents.value[agentIndex].message = event.message
            }
            progressMessages.push(event.message)
          },
          onComplete: (result) => {
            // Update agent status
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].status = 'completed'
              runningAgents.value[agentIndex].endTime = Date.now()

              // Auto-remove after 5 seconds
              setTimeout(() => {
                const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
                if (idx !== -1) {
                  runningAgents.value.splice(idx, 1)
                }
              }, 5000)
            }

            // Format result
            let response = `🔍 **Deep Research Agent**\n\n`
            response += result.answer || 'Исследование завершено.'

            if (result.sources && result.sources.length > 0) {
              response += '\n\n**Источники:**\n'
              result.sources.slice(0, 5).forEach((source, i) => {
                response += `${i + 1}. ${source.tool || source.description || 'Источник'}\n`
              })
            }

            if (result.iterations) {
              response += `\n\n_Итерации: ${result.iterations}, Время: ${Math.round(result.duration / 1000)}с_`
            }

            resolve(response)
          },
          onError: (error) => {
            // Update agent status to failed
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].status = 'failed'
              runningAgents.value[agentIndex].endTime = Date.now()
              runningAgents.value[agentIndex].error = error

              setTimeout(() => {
                const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
                if (idx !== -1) {
                  runningAgents.value.splice(idx, 1)
                }
              }, 5000)
            }

            resolve(`❌ Ошибка Deep Research Agent: ${error}`)
          }
        })
      })
    } catch (error) {
      logger.error('[Deep Research Agent] Error:', error)
      return `❌ Ошибка Deep Research Agent: ${error.message}`
    }
  }

  // ========== Financial Research Agent Integration ==========

  /**
   * Process Financial Research Agent request
   * Triggers on: /finance, @финансы, @finance
   * Or implicit triggers: "котировки", "курс доллара", "акции Сбербанка", etc.
   * @param {string} message - User message
   * @returns {Promise<string|null>} Agent response or null
   */
  const processFinancialResearchRequest = async (message) => {
    if (!toolsConfig.financialResearchAgentEnabled) {
      return null
    }

    // Use agentTriggerService to detect if this is a financial research request
    const detection = agentTriggerService.detectAgent(message)

    if (detection.agent !== AGENT_TYPES.FINANCIAL_RESEARCH) {
      return null
    }

    logger.debug('[Financial Research Agent] Triggered with confidence:', detection.confidence)

    const agentName = 'Financial Research Agent'
    const query = agentTriggerService.extractQuery(message)

    try {
      // Track agent start
      runningAgents.value.push({
        name: agentName,
        startTime: Date.now(),
        status: 'running',
        phase: 'analyzing'
      })

      // Get AI token ID from localStorage (like other services: CaptionService, VoiceAssistant)
      const accessToken = localStorage.getItem('current_ai_token_id') || '206099'

      // Return a promise that resolves when research is complete
      return new Promise((resolve) => {
        agentTriggerService.executeAgent(AGENT_TYPES.FINANCIAL_RESEARCH, query, {
          accessToken,
          onProgress: (event) => {
            // Update running agent status
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].phase = event.phase || event.type
              runningAgents.value[agentIndex].message = event.message
            }
          },
          onComplete: (result) => {
            // Update agent status
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].status = 'completed'
              runningAgents.value[agentIndex].endTime = Date.now()

              // Auto-remove after 5 seconds
              setTimeout(() => {
                const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
                if (idx !== -1) {
                  runningAgents.value.splice(idx, 1)
                }
              }, 5000)
            }

            // Format result
            let response = `📊 **Financial Research Agent**\n\n`

            // Use synthesis.summary if available, otherwise answer
            const summary = result.synthesis?.summary || result.answer || 'Финансовый анализ завершён.'
            response += summary

            // Show key findings
            if (result.synthesis?.keyFindings && result.synthesis.keyFindings.length > 0) {
              response += '\n\n**Ключевые данные:**\n'
              result.synthesis.keyFindings.forEach((finding, i) => {
                response += `${i + 1}. ${finding}\n`
              })
            }

            // Show data if available
            if (result.data && typeof result.data === 'object' && Object.keys(result.data).length > 0) {
              response += '\n\n**Данные:**\n'
              Object.entries(result.data).forEach(([key, value]) => {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
                response += `• ${key}: ${displayValue}\n`
              })
            }

            // Format sources properly (they are objects with {tool, source, timestamp})
            if (result.sources && result.sources.length > 0) {
              response += '\n\n**Источники:**\n'
              result.sources.slice(0, 5).forEach((src, i) => {
                const sourceName = typeof src === 'object'
                  ? (src.source || src.tool || JSON.stringify(src))
                  : src
                response += `${i + 1}. ${sourceName}\n`
              })
            }

            // Confidence is a string like 'low', 'medium', 'high'
            const confidence = result.synthesis?.confidence || result.confidence
            if (confidence) {
              const confidenceMap = { low: '⚠️ Низкая', medium: '✓ Средняя', high: '✓✓ Высокая' }
              const displayConfidence = confidenceMap[confidence] || confidence
              response += `\n\n_Уверенность: ${displayConfidence}_`
            }

            // Show recommendations if available
            if (result.synthesis?.recommendations && result.synthesis.recommendations.length > 0) {
              response += '\n\n**Рекомендации:**\n'
              result.synthesis.recommendations.forEach((rec, i) => {
                response += `• ${rec}\n`
              })
            }

            resolve(response)
          },
          onError: (error) => {
            // Update agent status to failed
            const agentIndex = runningAgents.value.findIndex(a => a.name === agentName && a.status === 'running')
            if (agentIndex !== -1) {
              runningAgents.value[agentIndex].status = 'failed'
              runningAgents.value[agentIndex].endTime = Date.now()
              runningAgents.value[agentIndex].error = error

              setTimeout(() => {
                const idx = runningAgents.value.findIndex(a => a.name === agentName && a.endTime === runningAgents.value[agentIndex].endTime)
                if (idx !== -1) {
                  runningAgents.value.splice(idx, 1)
                }
              }, 5000)
            }

            resolve(`❌ Ошибка Financial Research Agent: ${error}`)
          }
        })
      })
    } catch (error) {
      logger.error('[Financial Research Agent] Error:', error)
      return `❌ Ошибка Financial Research Agent: ${error.message}`
    }
  }

  // ========== Issue #6832: Slash Commands for Specialized Agents ==========

  /**
   * Process slash commands for table operations
   * Triggers: /fill-table, /summarize-doc, /research, /translate, /expand
   * @param {string} message - User message
   * @returns {Object|null} Command info or null if not a command
   */
  const detectSlashCommand = (message) => {
    const trimmed = message.trim()

    // /fill-table <column> using <source>
    const fillMatch = trimmed.match(/^\/fill-table\s+(.+?)(?:\s+using\s+|\s+используя\s+)(.+)$/i)
    if (fillMatch) {
      return {
        command: 'fill-table',
        outputColumn: fillMatch[1].trim(),
        sourceColumn: fillMatch[2].trim()
      }
    }

    // /summarize or /summarize-doc
    if (/^\/summarize(-doc)?(\s|$)/i.test(trimmed)) {
      return { command: 'summarize-doc' }
    }

    // /research <query>
    const researchMatch = trimmed.match(/^\/research\s+(.+)$/i)
    if (researchMatch) {
      return {
        command: 'research',
        query: researchMatch[1].trim()
      }
    }

    // /translate <language>
    const translateMatch = trimmed.match(/^\/translate\s+(.+)$/i)
    if (translateMatch) {
      return {
        command: 'translate',
        targetLanguage: translateMatch[1].trim()
      }
    }

    // /expand [instructions]
    const expandMatch = trimmed.match(/^\/expand(?:\s+(.+))?$/i)
    if (expandMatch) {
      return {
        command: 'expand',
        instructions: expandMatch[1]?.trim() || ''
      }
    }

    // /generate-report <topic>
    const reportMatch = trimmed.match(/^\/generate-report\s+(.+)$/i)
    if (reportMatch) {
      return {
        command: 'generate-report',
        topic: reportMatch[1].trim()
      }
    }

    // /compact — manual context compaction
    if (/^\/compact(\s|$)/i.test(trimmed)) {
      return { command: 'compact' }
    }

    // Issue #7078: /import [hint] — open FileImportDialog from chat
    // Supports hints like "переведи с китайского" to pre-select source language
    const importMatch = trimmed.match(/^\/import(?:\s+(.+))?$/i)
    if (importMatch) {
      const hint = importMatch[1]?.trim() || ''
      // Detect language hint in the message
      let sourceLang = 'auto'
      if (/китай|chinese|zh\b/i.test(hint)) sourceLang = 'zh'
      else if (/англий|english|en\b/i.test(hint)) sourceLang = 'en'
      else if (/немец|german|de\b/i.test(hint)) sourceLang = 'de'
      else if (/франц|french|fr\b/i.test(hint)) sourceLang = 'fr'
      else if (/испан|spanish|es\b/i.test(hint)) sourceLang = 'es'
      return {
        command: 'import',
        hint,
        sourceLang
      }
    }

    return null
  }

  /**
   * Process /fill-table command for bulk table column filling
   * @param {Object} cmdInfo - Command info from detectSlashCommand
   * @returns {Promise<string>} Status message
   */
  const processTableFillCommand = async (cmdInfo) => {
    const tableCtx = integramTableContext.value || window.__integramTableContext

    if (!tableCtx) {
      return '❌ Для команды /fill-table необходимо открыть таблицу Integram'
    }

    // Find output column
    const outputCol = tableCtx.columns?.find(c =>
      c.alias?.toLowerCase().includes(cmdInfo.outputColumn.toLowerCase()) ||
      c.value?.toLowerCase().includes(cmdInfo.outputColumn.toLowerCase())
    )

    // Find source column
    const sourceCol = tableCtx.columns?.find(c =>
      c.alias?.toLowerCase().includes(cmdInfo.sourceColumn.toLowerCase()) ||
      c.value?.toLowerCase().includes(cmdInfo.sourceColumn.toLowerCase())
    )

    if (!outputCol) {
      return `❌ Колонка "${cmdInfo.outputColumn}" не найдена в таблице`
    }

    logger.info('[TableFill] Starting bulk fill:', {
      table: tableCtx.tableName,
      outputColumn: outputCol.alias || outputCol.value,
      sourceColumn: sourceCol?.alias || cmdInfo.sourceColumn
    })

    // Build prompt template
    const promptTemplate = sourceCol
      ? `Generate content for "[${outputCol.alias || outputCol.value}]" based on: [${sourceCol.alias || sourceCol.value}]`
      : `Generate content for "[${outputCol.alias || outputCol.value}]" based on the row data: [VAL]`

    return `🔄 Запуск заполнения колонки "${outputCol.alias || outputCol.value}" для ${tableCtx.rowCount || 'всех'} строк...\n\nПромпт: ${promptTemplate}\n\n_Используйте API endpoint /api/chat/table-fill для выполнения_`
  }

  /**
   * Process /research command for web research
   * @param {Object} cmdInfo - Command info
   * @returns {Promise<string>} Research results
   */
  const processResearchCommand = async (cmdInfo) => {
    logger.info('[Research] Starting web research:', cmdInfo.query)

    try {
      const response = await fetch(`${CHAT_API_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cmdInfo.query,
          model: selectedModel.value,
          maxResults: 5,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Research failed')
      }

      let responseText = `🔍 **Результаты исследования**\n\n${result.content}`

      if (result.sources && result.sources.length > 0) {
        responseText += '\n\n**Источники:**\n'
        result.sources.forEach((source, i) => {
          responseText += `${i + 1}. [${source.title}](${source.url})\n`
        })
      }

      return responseText

    } catch (error) {
      logger.error('[Research] Error:', error)
      return `❌ Ошибка веб-исследования: ${error.message}`
    }
  }

  /**
   * Issue #7078: Process /import command — opens FileImportDialog via window event.
   * BlockDocumentEditor.vue listens for 'editor-open-import-dialog' and opens the dialog.
   *
   * @param {Object} cmdInfo - { command, hint, sourceLang }
   * @returns {string} Feedback message for the chat
   */
  const processImportCommand = (cmdInfo) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('editor-open-import-dialog', {
        detail: {
          hint: cmdInfo.hint,
          sourceLang: cmdInfo.sourceLang
        }
      }))
    }
    const langLabel = cmdInfo.sourceLang !== 'auto' ? ` (язык: ${cmdInfo.sourceLang})` : ''
    return `📂 Открываю диалог импорта документа${langLabel}...\n\nВыберите файл (.md, .docx, .pdf, .xlsx) для импорта в редактор.`
  }

  /**
   * Compact (summarize) old messages to free context window.
   * Keeps the last `keepCount` messages and replaces everything before with a summary.
   * @param {number} keepCount - Number of recent messages to keep (default 6 = 3 pairs)
   * @returns {Promise<string|null>} Status message or null if nothing to compact
   */
  const compactMessages = async (keepCount = 6) => {
    const msgs = aiChat.messages.filter(m => !isSystemMessage(m))
    if (msgs.length < 4) return 'Нечего сжимать — слишком мало сообщений.'

    const toCompact = msgs.slice(0, Math.max(0, msgs.length - keepCount))
    if (toCompact.length === 0) return 'Нечего сжимать.'

    const keepMsgs = msgs.slice(-keepCount)

    try {
      const response = await fetch(`${CHAT_API_URL}/compact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: toCompact.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text
          })),
          model: selectedModel.value,
          provider: selectedProvider.value
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (!data.success || !data.summary) throw new Error(data.error || 'Не удалось сжать контекст')

      // Replace chat history: summary + kept messages
      const summaryMsg = {
        text: `📝 **Сводка предыдущего разговора:**\n\n${data.summary}`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
        isCompactSummary: true
      }

      aiChat.messages.splice(0, aiChat.messages.length, summaryMsg, ...keepMsgs)
      updateContextUsage()

      return `Сжато ${data.originalCount} сообщений → 1 сводка. Контекст: ${contextUsage.percent}%`
    } catch (err) {
      logger.error('[compactMessages] Error:', err)
      return `Ошибка сжатия: ${err.message}`
    }
  }

  const sendAiMessage = async () => {
    if (!aiMessage.value.trim() && currentAttachments.value.length === 0) return

    // Issue #6832: Handle slash commands before regular AI dispatch
    const slashCmd = detectSlashCommand(aiMessage.value.trim())
    if (slashCmd) {
      aiChat.messages.push({
        text: aiMessage.value,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: true
      })
      aiMessage.value = ''
      aiLoading.value = true
      try {
        let result
        if (slashCmd.command === 'fill-table') result = await processTableFillCommand(slashCmd)
        else if (slashCmd.command === 'research') result = await processResearchCommand(slashCmd)
        else if (slashCmd.command === 'import') result = processImportCommand(slashCmd)
        else if (slashCmd.command === 'compact') result = await compactMessages()
        if (result) {
          aiChat.messages.push({ text: result, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), isUser: false })
        }
      } finally {
        aiLoading.value = false
      }
      return
    }

    const userMessage = aiMessage.value
    const displayText = aiDisplayText.value || ''
    const attachments = [...currentAttachments.value]

    aiChat.messages.push({
      text: userMessage,
      displayText: displayText || undefined,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
      attachments: attachments.length > 0 ? attachments : undefined
    })

    aiMessage.value = ''
    aiDisplayText.value = ''
    currentAttachments.value = []
    aiLoading.value = true
    aiError.value = null
    assistantMessage.value = null
    let lastUsage = null

    scrollToBottom(aiMessagesContainer)

    // ==================== SESSION MANAGEMENT (UNIFIED for ALL providers) ====================
    // Generate session ID if this is the first message
    if (!currentSessionId.value) {
      currentSessionId.value = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      logger.info('[useChatLogic] Generated new session ID:', currentSessionId.value)

      // Create session in Integram DB for persistent storage and billing
      try {
        const tokenId = localStorage.getItem('current_ai_token_id') || '206099'
        integramChatSessionService.setCurrentToken(tokenId)
        await integramChatSessionService.createSession({
          sessionId: currentSessionId.value,
          model: selectedModel.value,
          systemPrompt: getCombinedSystemPrompt()
        })
        logger.info('[useChatLogic] Session created in Integram DB:', currentSessionId.value)
      } catch (integramError) {
        logger.warn('[useChatLogic] Failed to create Integram session (continuing anyway):', integramError)
        // Not critical - chat works without Integram DB
      }
    }
    // ======================================================================================

    try {
      // ==================== AGENT SELECTION CHECK (Issue #VAB-Integration) ====================
      // Check if a specific agent is selected in AgentSelector with a system prompt
      // If so, bypass orchestrator and use regular AI chat with agent's system prompt
      const selectedAgent = selectedAgentForChat.value
      let agentSystemPrompt = null

      if (selectedAgent && selectedAgent.systemPrompt) {
        // Agent has system prompt (custom or auto-generated by useAgentSelector)
        logger.info('[useChatLogic] Using agent system prompt from:', selectedAgent.name, '(ID:', selectedAgent.id, ')')
        agentSystemPrompt = selectedAgent.systemPrompt
      } else if (selectedAgent) {
        // Agent selected but no system prompt - auto-generate from metadata
        const name = selectedAgent.name || 'AI Agent'
        const desc = selectedAgent.description || ''
        const category = selectedAgent.category || ''
        agentSystemPrompt = `You are "${name}"${category && category !== 'other' ? `, a specialized ${category} agent` : ''}.${desc ? ` ${desc}${desc.endsWith('.') ? '' : '.'}` : ''} Respond helpfully and stay within your area of specialization when possible.`
        logger.info('[useChatLogic] Auto-generated system prompt for agent:', selectedAgent.name)
      }

      // ==================== UNIFIED ORCHESTRATOR (Issue #5632) ====================
      // Only use orchestrator when NO specific agent is selected
      // Orchestrator does trigger matching to find the right agent(s)

      if (!selectedAgent) {
        logger.info('[useChatLogic] No agent selected, attempting orchestrator routing for query:', userMessage.substring(0, 100))

        const accessToken = localStorage.getItem('current_ai_token_id') || '206099'
        const userId = currentUserId.value || 'anonymous'

        try {
          const orchestratorResult = await executeQuery(userMessage, {
            accessToken,
            userId,
            includeTrace: false, // Set to true for debugging
            metadata: {
              source: 'chat',
              sessionId: currentSessionId.value
            }
          })

          // Check if orchestrator found matching agents
          if (orchestratorResult.success && orchestratorResult.matches?.length > 0) {
            // Orchestrator found matching agents - use the first match's system prompt if available
            const matchedAgent = orchestratorResult.matches[0]
            logger.info('[useChatLogic] Orchestrator matched agent:', matchedAgent.agentName)

            // Note: To fully support orchestrator-matched agents with system prompts,
            // we would need to fetch the agent's full data including systemPrompt
            // For now, just log that a match was found
          } else {
            logger.debug('[useChatLogic] Orchestrator did not find matching agents, using default AI chat')
          }
        } catch (orchestratorError) {
          logger.warn('[useChatLogic] Orchestrator error, falling back to regular AI chat:', orchestratorError)
          // Fall through to regular AI chat on orchestrator error
        }
      } else {
        logger.info('[useChatLogic] Agent selected, bypassing orchestrator:', selectedAgent.name)
      }
      // ==============================================================================

      // Create assistant message placeholder
      assistantMessage.value = {
        text: '',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
        // Add agent information if an agent is selected (VAB integration)
        agentUsed: selectedAgent ? selectedAgent.name : null,
        agentInfo: selectedAgent ? {
          id: selectedAgent.id,
          name: selectedAgent.name,
          category: selectedAgent.category,
          icon: selectedAgent.icon
        } : null
      }
      aiChat.messages.push(assistantMessage.value)

      // Check if workspace chat should be used
      const useWorkspaceChat = agentMode.value && selectedWorkspace.value
      console.log('[sendAiMessage] ROUTE CHECK - agentMode:', agentMode.value, 'selectedWorkspace:', selectedWorkspace.value, 'useWorkspaceChat:', useWorkspaceChat)

      if (useWorkspaceChat) {
        // Use workspace chat endpoint
        const workspaceSessionId = `workspace_${selectedWorkspace.value}_${Date.now()}`

        // Save workspace session to Integram
        try {
          const tokenId = localStorage.getItem('current_ai_token_id') || '206099'
          integramChatSessionService.setCurrentToken(tokenId)
          await integramChatSessionService.createSession({
            sessionId: workspaceSessionId,
            model: selectedModel.value,
            systemPrompt: `Workspace: ${selectedWorkspace.value}`
          })
          logger.debug('[useChatLogic] Workspace session saved to Integram:', workspaceSessionId)
        } catch (integramError) {
          logger.warn('[useChatLogic] Failed to save workspace session to Integram:', integramError)
        }

        // Call workspace chat
        const response = await chatWithWorkspace(
          selectedWorkspace.value,
          userMessage,
          [],
          { model: selectedModel.value },
          null
        )

        const assistantText = response.response || response.reply || 'Ответ получен'
        assistantMessage.value.text = assistantText

        // Save transaction to Integram
        try {
          const usage = response.metadata?.usage || {}
          await integramChatSessionService.saveMessageExchange({
            sessionId: workspaceSessionId,
            userMessage: userMessage,
            assistantMessage: assistantText,
            model: selectedModel.value,
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            cost: usage.cost || 0,
            systemPrompt: `Workspace: ${selectedWorkspace.value}`
          })
          logger.debug('[useChatLogic] Workspace transaction saved to Integram')
        } catch (integramError) {
          logger.warn('[useChatLogic] Failed to save workspace transaction:', integramError)
        }
      } else {
        // Use unified /api/chat endpoint (works for ALL providers: Polza, DeepSeek, OpenAI, KodaCode, KodaAgent, etc.)
        console.log('[sendAiMessage] Using unified /api/chat endpoint with provider:', selectedProvider.value)

        // Auto-compaction: if context > 85%, compact before sending
        updateContextUsage()
        if (contextUsage.percent > 85 && aiChat.messages.filter(m => !isSystemMessage(m)).length > 6) {
          logger.info('[sendAiMessage] Context at', contextUsage.percent + '%, auto-compacting...')
          const compactResult = await compactMessages()
          if (compactResult) {
            aiChat.messages.push({
              text: `💬 ${compactResult}`,
              time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              isUser: false,
              isSystemNotice: true
            })
          }
        }

        // Issue #6507: Use getCombinedSystemPrompt which includes document context when on editor page
        const finalSystemPrompt = agentSystemPrompt || getCombinedSystemPrompt()
        console.log('[sendAiMessage] System prompt includes document context:', !!editorDocumentContext.value)

        // Use unified chat API with streaming
        _abortController = new AbortController()
        const response = await fetch(`${CHAT_API_URL}`, {
          method: 'POST',
          signal: _abortController.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            userId: currentUserId.value,
            model: selectedModel.value,
            provider: selectedProvider.value,
            conversationHistory: aiChat.messages
              .filter(msg => !isSystemMessage(msg)) // Skip system messages
              .filter(msg => !msg.isSystemGreeting) // Skip system greeting
              .filter(msg => msg.text && msg.text.trim() !== '') // Skip empty messages
              .filter(msg => !msg.isDemo) // Skip demo fallback responses
              .map(msg => ({
                role: msg.isUser ? 'user' : 'assistant',
                content: msg.text
              })),
            maxTokens: llmSettings.contextSize,
            temperature: llmSettings.temperature,
            topP: llmSettings.topP,
            // Pass agent's system prompt if an agent is selected (VAB integration)
            // This allows custom agents created in Visual Agent Builder to work in chat
            systemPrompt: finalSystemPrompt, // includes document context if available
            agentContext: selectedAgent ? {
              id: selectedAgent.id,
              name: selectedAgent.name,
              category: selectedAgent.category
            } : null,
            enableTools: true, // Enable MCP tools for Integram database access
            // Issue #7232: Web search respects ONLY the user toggle button.
            // Previously: always on for block editor, which ignored user's preference.
            enableWebSearch: toolsConfig.webSearch,
            // Issue #6832: Enable editor tools when document context is available (not just on block-editor page)
            enableEditorTools: isBlockEditorPage.value || !!editorDocumentContext.value,
            // Issue #6834: Native tool calling mode (web_*, doc_*, integram_* tools via Think-Act-Observe loop)
            enableToolCalling: toolsConfig.toolCalling || false,
            toolCallingConfig: toolsConfig.toolCalling ? {
              // Issue #7232: enableWebTools must also respect the user's web search toggle.
              // toolCallingWebTools only controls the sub-toggle within native tool calling;
              // the master web search toggle (webSearch) must gate it as well.
              enableWebTools: toolsConfig.toolCallingWebTools && toolsConfig.webSearch,
              enableDocumentTools: toolsConfig.toolCallingDocTools,
              enableIntegramTools: toolsConfig.toolCallingIntegramTools
            } : null,
            // Issue #6832: Include table context in request if available
            tableContext: integramTableContext.value || null,
            documentContext: editorDocumentContext.value || null,
            // Issue #7060: Include finmodelContext so backend can read FinModel data
            finmodelContext: finmodelContext.value || null,
            // Issue #7061: Include ecosystemContext so backend can read Ecosystem data
            ecosystemContext: ecosystemContext.value || null,
            // Issue #6834: Include Integram context for tool calling
            integramContext: toolsConfig.toolCalling && integraMCPState.isAuthenticated ? {
              token: integraMCPState.token,
              xsrfToken: integraMCPState.xsrfToken,
              serverURL: integraMCPState.serverURL,
              database: integraMCPState.database
            } : null,
            // Issue #7043: Streaming now supports tool execution loop on the backend.
            // Block editor uses streaming with tools — backend handles tool calls via SSE events.
            stream: llmSettings.enableAgentChain
              ? true
              : (llmSettings.enableStreaming && !toolsConfig.toolCalling),
            // Issue #6830: Extended thinking parameters for DeepSeek-R1 and Claude 3.7+
            enableThinking: llmSettings.enableThinking,
            thinkingBudget: llmSettings.thinkingBudget,
            // Issue #6830: Agent chain orchestration mode
            enableAgentChain: llmSettings.enableAgentChain,
            // Additional reference documents from context bar (for forced Scout)
            // Pass raw HTML — AI needs markup to understand structure, Integram embeds, block types
            additionalDocuments: additionalDocuments.value.length > 0
              ? additionalDocuments.value.map(d => ({ id: d.id, title: d.title, content: d.content || '' }))
              : undefined,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Handle SSE streaming response
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('text/event-stream')) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6)
                if (data === '[DONE]') {
                  // Finalize: extract :::actions buttons from accumulated text
                  agentStatusBar.value.isVisible = false
                  if (assistantMessage.value) {
                    const { text, suggestedActions } = extractActionsFromText(filterToolNoise(assistantMessage.value.text))
                    assistantMessage.value.text = text
                    if (suggestedActions) assistantMessage.value.suggestedActions = suggestedActions
                  }
                  continue
                }

                try {
                  const parsed = JSON.parse(data)

                  // Issue #6752: Handle thinking/reasoning chunks from thinking models
                  if (parsed.type === 'thinking') {
                    if (!assistantMessage.value.thinkingContent) {
                      assistantMessage.value.thinkingContent = ''
                      // Issue #6756: Auto-expand thinking block when content first arrives
                      assistantMessage.value._thinkingExpanded = true
                      scrollToBottom(aiMessagesContainer)
                    }
                    assistantMessage.value.thinkingContent += parsed.thinking
                  // Handle different streaming formats
                  } else if (parsed.type === 'content') {
                    assistantMessage.value.text += parsed.content
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    // Format from TokenBasedLLMCoordinator
                    assistantMessage.value.text += parsed.delta.text
                    scrollToBottom(aiMessagesContainer)
                  // Issue #7230: Agent chain SSE events MUST come before generic parsed.chunk
                  // to prevent agent events with a chunk field being treated as text
                  } else if (parsed.type === 'agent:plan') {
                    // Plan created - initialize execution steps tracking
                    if (!assistantMessage.value.executionSteps) {
                      assistantMessage.value.executionSteps = []
                    }
                    assistantMessage.value.agentPlan = parsed.tasks
                    assistantMessage.value.executionSteps = parsed.tasks.map((task, index) => ({
                      id: `task_${index}`,
                      type: 'agent_task',
                      title: task.name,
                      description: task.description,
                      status: 'pending',
                      dependencies: task.dependencies || []
                    }))
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:wave:start') {
                    // Issue #6830: Wave starting - track parallel execution waves
                    if (!assistantMessage.value.waves) {
                      assistantMessage.value.waves = []
                    }
                    assistantMessage.value.waves.push({
                      index: parsed.wave,
                      tasks: parsed.tasks,
                      startTime: Date.now()
                    })
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:task:start') {
                    // Task starting - update step status
                    if (assistantMessage.value.executionSteps && parsed.index !== undefined) {
                      assistantMessage.value.executionSteps[parsed.index].status = 'running'
                      assistantMessage.value.executionSteps[parsed.index].startTime = Date.now()
                    }
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:thinking') {
                    // TAO think phase - aggregate reasoning content
                    if (!assistantMessage.value.thinkingContent) {
                      assistantMessage.value.thinkingContent = ''
                      assistantMessage.value._thinkingExpanded = true
                    }
                    assistantMessage.value.thinkingContent += parsed.reasoning
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:action:start') {
                    // Tool call starting - add to execution steps
                    // Background agent tools are invisible — handled via polling/status bar
                    if (!assistantMessage.value) break
                    if (['launch_agent', 'check_agent_job'].includes(parsed.tool)) break
                    if (!assistantMessage.value.executionSteps) {
                      assistantMessage.value.executionSteps = []
                    }
                    // Fallback retry: increment retry counter on existing step instead of duplicating
                    const existingStep = assistantMessage.value.executionSteps.find(
                      s => s.toolName === parsed.tool && s.status === 'completed'
                    )
                    if (existingStep) {
                      existingStep.retryCount = (existingStep.retryCount || 1) + 1
                    } else {
                      assistantMessage.value.executionSteps.push({
                        id: `action_${Date.now()}`,
                        type: 'tool_call',
                        title: friendlyToolName(parsed.tool).replace(/^\S+\s/, ''),
                        toolName: parsed.tool,
                        toolInput: parsed.input,
                        status: 'running',
                        startTime: Date.now()
                      })
                    }
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:action:end') {
                    // Tool call completed - update the last tool action
                    const steps = assistantMessage.value?.executionSteps || []
                    const lastToolAction = [...steps].reverse().find(s => s.type === 'tool_call' && s.toolName === parsed.tool)
                    if (lastToolAction) {
                      lastToolAction.toolResult = parsed.result
                      lastToolAction.duration = Date.now() - (lastToolAction.startTime || Date.now())
                      // Detect errors in tool result
                      let _resultObj = parsed.result
                      if (typeof _resultObj === 'string') {
                        try { _resultObj = JSON.parse(_resultObj) } catch (_) { _resultObj = null }
                      }
                      if (_resultObj && typeof _resultObj === 'object' && (_resultObj.error || _resultObj.isError)) {
                        lastToolAction.status = 'error'
                        lastToolAction.errorMessage = _resultObj.error || _resultObj.message || 'Ошибка выполнения инструмента'
                      } else {
                        lastToolAction.status = 'completed'
                      }
                    }
                    // launch_agent: start background polling, show status bar
                    if (parsed.tool === 'launch_agent') {
                      try {
                        const jobResult = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result
                        if (jobResult?.jobId) {
                          startAgentJobPolling(jobResult.jobId, jobResult.message || 'Агент работает...')
                        }
                      } catch (_) {}
                    }
                    // Issue #6898 / #7043: If tool returned an editorAction or action,
                    // apply it to the document immediately (correct channel: tool → editor)
                    if (isBlockEditorPage.value || editorDocumentContext.value) {
                      try {
                        const resultData = typeof parsed.result === 'string'
                          ? JSON.parse(parsed.result) : parsed.result
                        const editorAct = resultData?.editorAction || resultData?.action
                        if (editorAct) {
                          window.dispatchEvent(new CustomEvent('ai-block-editor-action', {
                            detail: editorAct
                          }))
                        }
                      } catch (_) { /* result is not JSON, skip */ }
                    }
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:task:end') {
                    // Task completed - update step status
                    if (assistantMessage.value.executionSteps && parsed.index !== undefined) {
                      assistantMessage.value.executionSteps[parsed.index].status = 'completed'
                      assistantMessage.value.executionSteps[parsed.index].summary = parsed.summary
                      assistantMessage.value.executionSteps[parsed.index].duration =
                        Date.now() - (assistantMessage.value.executionSteps[parsed.index].startTime || Date.now())
                    }
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.type === 'agent:status') {
                    // Issue #6832: Update AgentStatusBar
                    agentStatusBar.value = {
                      isVisible: true,
                      phase: parsed.phase || '',
                      message: parsed.message || '',
                      icon: parsed.icon || '',
                      progress: parsed.progress ?? null,
                      sources: parsed.sources || []
                    }
                  } else if (parsed.type === 'agent:sources') {
                    // Issue #6832: Web research sources
                    agentStatusBar.value.sources = parsed.sources || []
                  } else if (parsed.type === 'agent:navigate') {
                    // Navigate user to a platform page
                    if (parsed.path) {
                      console.log('[useChatLogic] agent:navigate received, path:', parsed.path)
                      logger.info('[useChatLogic] Streaming navigate to:', parsed.path)
                      window.__chatNavPath = parsed.path

                      // Issue #7043: Visual feedback — add execution step + inline text
                      if (assistantMessage.value) {
                        if (!assistantMessage.value.executionSteps) {
                          assistantMessage.value.executionSteps = []
                        }
                        // Only add if not already present from agent:action:start/end
                        const alreadyHasNav = assistantMessage.value.executionSteps.some(
                          s => s.toolName === 'navigate_to' && s.toolInput?.path === parsed.path
                        )
                        if (!alreadyHasNav) {
                          assistantMessage.value.executionSteps.push({
                            id: `nav_${Date.now()}`,
                            type: 'tool_call',
                            title: 'Переход на страницу',
                            toolName: 'navigate_to',
                            toolInput: { path: parsed.path, reason: parsed.reason || '' },
                            toolResult: { success: true, path: parsed.path },
                            status: 'completed',
                            duration: 0
                          })
                        }
                        // Add navigation confirmation as inline text
                        assistantMessage.value.navigatedTo = parsed.path
                      }

                      // Emit custom event so App.vue/router can handle navigation at top level
                      window.dispatchEvent(new CustomEvent('chat:navigate', { detail: { path: parsed.path } }))
                      router.push(parsed.path).catch(e => console.warn('[useChatLogic] navigate error:', e?.message))
                      scrollToBottom(aiMessagesContainer)
                    }
                  } else if (parsed.type === 'agent:model_fallback') {
                    // Model refused (censorship/policy) — show inline warning and continue with fallback
                    if (assistantMessage.value) {
                      const warn = `\n\n> ⚠️ **${parsed.from_model?.split('/').pop() || 'Модель'} отказала** (цензура)${parsed.to_model ? ` → использую **${parsed.to_model.split('/').pop()}**` : ''}\n\n`
                      assistantMessage.value = { ...assistantMessage.value, text: (assistantMessage.value.text || '') + warn }
                    }
                    // Also update status bar
                    agentStatusBar.value.message = parsed.message || '⚠️ Цензура, переключаюсь...'
                  } else if (parsed.type === 'done' || parsed.done) {
                    agentStatusBar.value.isVisible = false
                    logger.debug('Streaming completed. Usage:', parsed.usage)
                    lastUsage = parsed.usage
                    // Update context usage with real data from provider
                    if (parsed.usage?.prompt_tokens) {
                      contextUsage.lastRealUsage = parsed.usage
                      contextUsage.usedTokens = parsed.usage.prompt_tokens + (parsed.usage.completion_tokens || 0)
                      contextUsage.percent = Math.min(100, Math.round((contextUsage.usedTokens / contextUsage.maxTokens) * 100))
                    }
                    // Extract suggested action buttons from accumulated text
                    if (assistantMessage.value) {
                      const { text, suggestedActions } = extractActionsFromText(filterToolNoise(assistantMessage.value.text))
                      assistantMessage.value.text = text
                      if (suggestedActions) assistantMessage.value.suggestedActions = suggestedActions
                    }
                  } else if (parsed.chunk) {
                    // Issue #7230: Generic chunk fallback — MUST be last to avoid
                    // catching agent:* events that happen to have a chunk field
                    assistantMessage.value.text += parsed.chunk
                    scrollToBottom(aiMessagesContainer)
                  } else if (parsed.error) {
                    throw new Error(parsed.error)
                  }
                } catch (e) {
                  if (e.message && !e.message.includes('JSON')) {
                    throw e
                  }
                }
              }
            }
          }
        } else if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          if (!data.success) {
            throw new Error(data.error || 'Неизвестная ошибка API')
          }
          // Extract suggested action buttons from response text
          const { text: cleanedResponse, suggestedActions } = extractActionsFromText(filterToolNoise(data.response))
          assistantMessage.value.text = cleanedResponse
          if (suggestedActions) assistantMessage.value.suggestedActions = suggestedActions

          // SGR validation status from backend
          if (data.sgr) {
            assistantMessage.value.sgrStatus = data.sgr.status
            assistantMessage.value.sgrValid = data.sgr.valid
            assistantMessage.value.sgrFixes = data.sgr.fixes || []
            if (data.sgr.status === 'fixed') {
              logger.info('[useChatLogic] SGR auto-fixed response:', data.sgr.fixes)
            } else if (data.sgr.status === 'invalid') {
              logger.warn('[useChatLogic] SGR validation failed:', data.sgr.errors)
            }
          }

          // Issue #6731: Store tool calls in message for visualization
          if (data.toolCalls && data.toolCalls.length > 0) {
            logger.info('[useChatLogic] Tool calls executed:', data.toolCalls.length)
            // Convert tool calls to execution steps format for AgentExecutionSteps component
            assistantMessage.value.toolCalls = data.toolCalls
            assistantMessage.value.executionSteps = data.toolCalls.map((tc, index) => ({
              id: tc.id || `tool_${index}`,
              type: 'tool_call',
              title: friendlyToolName(tc.name),
              toolName: tc.name,
              toolInput: tc.input,
              toolResult: tc.result,
              status: tc.status || 'completed',
              duration: tc.duration
            }))
          }

          // Execute block editor actions returned by AI
          if (data.editorActions && data.editorActions.length > 0 && isBlockEditorPage.value) {
            logger.info('[useChatLogic] Executing', data.editorActions.length, 'editor actions from AI')
            for (const action of data.editorActions) {
              window.dispatchEvent(new CustomEvent('ai-block-editor-action', {
                detail: { type: action.type, params: action.params }
              }))
              await new Promise(r => setTimeout(r, 80))
            }
          }

          // Execute navigation actions returned by AI (navigate_to tool)
          if (data.navigationActions && data.navigationActions.length > 0) {
            logger.info('[useChatLogic] Executing navigation:', data.navigationActions)
            for (const nav of data.navigationActions) {
              if (nav.path) {
                // Issue #7043: Visual feedback for navigation
                if (assistantMessage.value) {
                  assistantMessage.value.navigatedTo = nav.path
                }
                await router.push(nav.path)
              }
            }
          }
        }
      }

      // Finalize the assistant message
      _fallbackRetry.value = null
      if (assistantMessage.value) {
        // Wire token usage into message object for footer display
        if (lastUsage) {
          assistantMessage.value.inputTokens = lastUsage.prompt_tokens || 0
          assistantMessage.value.outputTokens = lastUsage.completion_tokens || 0
        }
        const finalMessageObj = { ...assistantMessage.value }
        aiChat.messages.splice(aiChat.messages.indexOf(assistantMessage.value), 1, finalMessageObj)
        assistantMessage.value = null
      }
    } catch (error) {
      // User pressed Stop — don't retry, just clean up
      if (error.name === 'AbortError') {
        console.info('[sendAiMessage] Aborted by user')
        _fallbackRetry.value = null
        if (assistantMessage.value) {
          assistantMessage.value.text += '\n\n*(остановлено пользователем)*'
          const finalMessageObj = { ...assistantMessage.value }
          aiChat.messages.splice(aiChat.messages.indexOf(assistantMessage.value), 1, finalMessageObj)
          assistantMessage.value = null
        }
        return
      }

      console.error('❌ [sendAiMessage] CRITICAL ERROR:', error)

      // Backend handles tier-based fallback (chatWithFallback).
      // If we're here, all tiers are exhausted — show error in chat bubble with retry button.
      _fallbackRetry.value = null
      aiError.value = null

      const errorMsg = {
        text: '⚠️ ИИ временно недоступен',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
        isError: true,
        retryMessage: userMessage,
        retryAttachments: attachments
      }

      if (assistantMessage.value) {
        Object.assign(assistantMessage.value, errorMsg)
        const finalMessageObj = { ...assistantMessage.value }
        aiChat.messages.splice(aiChat.messages.indexOf(assistantMessage.value), 1, finalMessageObj)
        assistantMessage.value = null
      } else {
        aiChat.messages.push(errorMsg)
      }
    } finally {
      _abortController = null
      aiLoading.value = false
      agentStatusBar.value.isVisible = false
      scrollToBottom(aiMessagesContainer)

      // Update context usage estimate after each exchange
      updateContextUsage()

      // Save message exchange to Integram (PRIMARY storage)
      const lastAssistantText = aiChat.messages
        .filter(msg => !msg.isUser && msg.text)
        .pop()?.text || ''

      let integramSaveSuccess = false

      if (currentSessionId.value && lastAssistantText) {
        try {
          // Save transaction
          await integramChatSessionService.saveMessageExchange({
            sessionId: currentSessionId.value,
            userMessage: userMessage,
            assistantMessage: lastAssistantText,
            model: selectedModel.value,
            inputTokens: lastUsage?.prompt_tokens || 0,
            outputTokens: lastUsage?.completion_tokens || 0,
            cost: lastUsage?.cost || 0,
            systemPrompt: getCombinedSystemPrompt()
          })

          // Update full messages array in session
          await integramChatSessionService.updateMessages(
            currentSessionId.value,
            aiChat.messages
          )

          logger.debug('[useChatLogic] Chat saved to Integram (primary storage)')
          integramSaveSuccess = true
        } catch (integramError) {
          logger.warn('[useChatLogic] Failed to save to Integram:', integramError)
          integramSaveSuccess = false
        }
      }

      // Always save to localStorage as safety net (primary = Integram, fallback = localStorage)
      try {
        localStorage.setItem('aiChat', JSON.stringify(aiChat.messages))
        logger.debug('[useChatLogic] Chat saved to localStorage (safety net)')
      } catch (localStorageError) {
        logger.error('[useChatLogic] Failed to save to localStorage:', localStorageError)
      }
    }
  }

  // ==================== Editor Action Buttons ====================
  // Cancel in-flight AI request
  const cancelAiRequest = () => {
    if (_abortController) {
      _abortController.abort()
      // AbortError will be caught by sendAiMessage's catch block
      // which handles cleanup, text append, and finally block resets aiLoading
    }
  }

  // Sends an editor action (from contextual buttons) with label shown in chat bubble
  // instead of raw prompt. Uses non-streaming mode with editor tools enabled.

  const sendEditorAction = async (action) => {
    // action = { label, prompt, icon }
    const label = action.label || 'Действие'
    const prompt = action.prompt || ''

    // Show label (not raw prompt) in user bubble
    aiChat.messages.push({
      text: prompt,          // actual content sent to AI
      displayText: label,    // shown in bubble
      isEditorAction: true,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      isUser: true
    })

    aiLoading.value = true
    aiError.value = null
    assistantMessage.value = null
    scrollToBottom(aiMessagesContainer)

    try {
      const docCtx = editorDocumentContext.value || window.__editorDocumentContext
      const systemPrompt = getCombinedSystemPrompt()
        + '\n\nВАЖНО: Ты выполняешь действие по кнопке пользователя. Используй доступные editor_* инструменты. После выполнения ответь ОДНОЙ строкой-итогом (например: "Исправлено 2 ошибки" или "Добавлен раздел Введение"). Без объяснений.'

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          model: selectedModel.value,
          conversationHistory: [],  // fresh context for action
          systemPrompt,
          enableEditorTools: true,
          stream: false,  // tools need non-streaming
          documentContext: docCtx || null,
          temperature: 0.3,
          maxTokens: 8192
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      // Execute editor actions
      if (data.editorActions && data.editorActions.length > 0) {
        for (const act of data.editorActions) {
          window.dispatchEvent(new CustomEvent('ai-block-editor-action', {
            detail: { type: act.type, params: act.params }
          }))
          await new Promise(r => setTimeout(r, 80))
        }
      }

      // Build compact summary
      const actionCount = (data.editorActions || []).length
      const summary = data.response?.split('\n')[0]?.substring(0, 120)
        || (actionCount > 0 ? `Выполнено: ${actionCount} изменений` : 'Готово')

      aiChat.messages.push({
        text: summary,
        isEditorAction: true,
        executionSteps: data.toolCalls?.map((tc, i) => ({
          id: `tc_${i}`,
          type: 'tool_call',
          title: friendlyToolName(tc.name),
          status: 'completed'
        })),
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false
      })
    } catch (err) {
      aiChat.messages.push({
        text: `Ошибка: ${err.message}`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false
      })
    } finally {
      aiLoading.value = false
      scrollToBottom(aiMessagesContainer)
    }
  }

  // ==================== Message Actions ====================

  const copyToClipboard = (text) => {
    if (!text) return
    const doFallback = () => {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
      document.body.appendChild(el)
      el.focus()
      el.select()
      try { document.execCommand('copy') } catch (_) {}
      document.body.removeChild(el)
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(doFallback)
    } else {
      doFallback()
    }
  }

  const editMessage = (index) => {
    const message = aiChat.messages[index]
    if (!message) return

    aiMessage.value = message.text

    if (message.attachments && message.attachments.length > 0) {
      currentAttachments.value = [...message.attachments]
    }

    aiChat.messages.splice(index, 1)
    console.log('[useChatLogic] Message edited')
  }

  const deleteMessage = (index) => {
    try {
      aiChat.messages.splice(index, 1)
      const messagesToSave = aiChat.messages.filter(msg => msg !== assistantMessage.value)
      localStorage.setItem('aiChat', JSON.stringify(messagesToSave))
      console.log('[useChatLogic] Message deleted')
    } catch (error) {
      console.error('[useChatLogic] Failed to delete message:', error)
    }
  }

  const resendMessage = async (index) => {
    try {
      const message = aiChat.messages[index]
      if (!message) return

      if (message.isUser) {
        // User message: resend as-is
        aiMessage.value = message.text
        if (message.attachments && message.attachments.length > 0) {
          currentAttachments.value = [...message.attachments]
        }
        await sendAiMessage()
        console.log('[useChatLogic] User message resent')
      } else {
        // AI message: regenerate — remove this response and resend the last user message before it
        const lastUserMsg = aiChat.messages.slice(0, index).reverse().find(m => m.isUser && !isSystemMessage(m))
        if (!lastUserMsg) return

        aiChat.messages.splice(index, 1)
        aiMessage.value = lastUserMsg.text
        if (lastUserMsg.attachments && lastUserMsg.attachments.length > 0) {
          currentAttachments.value = [...lastUserMsg.attachments]
        }
        await sendAiMessage()
        console.log('[useChatLogic] AI message regenerated')
      }
    } catch (error) {
      console.error('[useChatLogic] Failed to resend message:', error)
    }
  }

  // ==================== Chat Management ====================

  const saveCurrentChat = () => {
    if (!newChatName.value.trim()) return

    savedChats.value.push({
      name: newChatName.value,
      date: new Date().toLocaleDateString('ru-RU'),
      messages: [...aiChat.messages]
    })

    localStorage.setItem('savedChats', JSON.stringify(savedChats.value))
    newChatName.value = ''
  }

  const loadChat = (chat) => {
    aiChat.messages = [...chat.messages]
    showHistory.value = false
    // Прокрутить к последним сообщениям после загрузки истории
    nextTick(() => {
      scrollToBottom(aiMessagesContainer)
    })
  }

  const deleteChat = (index) => {
    savedChats.value.splice(index, 1)
    localStorage.setItem('savedChats', JSON.stringify(savedChats.value))
  }

  /**
   * Quick save current chat with auto-generated name
   */
  const quickSaveChat = () => {
    console.log('[useChatLogic] quickSaveChat called, messages:', aiChat.messages.length)
    if (aiChat.messages.length <= 2) {
      console.log('[useChatLogic] Not enough messages to save')
      return
    }

    // Find first user message for the name
    const firstUserMsg = aiChat.messages.find(m => m.isUser)
    const autoName = firstUserMsg?.text?.substring(0, 50) || `Чат ${new Date().toLocaleTimeString('ru-RU')}`

    savedChats.value.unshift({
      name: autoName,
      date: new Date().toLocaleDateString('ru-RU'),
      time: new Date().toLocaleTimeString('ru-RU'),
      messages: [...aiChat.messages],
      model: selectedModel.value,
      provider: selectedProvider.value
    })

    // Keep max 50 chats
    if (savedChats.value.length > 50) {
      savedChats.value = savedChats.value.slice(0, 50)
    }

    localStorage.setItem('savedChats', JSON.stringify(savedChats.value))
    logger.info('[useChatLogic] Chat quick-saved:', autoName)
  }

  /**
   * Start a new chat (clear current messages)
   */
  const startNewChat = () => {
    // Save current if has content
    if (aiChat.messages.length > 2) {
      quickSaveChat()
    }

    // Reset to initial state
    aiChat.messages = [
      {
        text: 'Я могу анализировать таблицы и отчёты, отвечать на вопросы и т.д. Чем могу помочь?',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
        isSystemGreeting: true // Skip in conversationHistory
      }
    ]

    // Reset session ID (new session will be created on first message)
    currentSessionId.value = null

    // Clear previous errors
    aiError.value = null

    // Reset context usage
    contextUsage.usedTokens = 0
    contextUsage.lastRealUsage = null
    contextUsage.percent = 0

    showHistory.value = false
    logger.info('[useChatLogic] Started new chat')
  }

  /**
   * Clear all saved chats
   */
  const clearAllChats = () => {
    savedChats.value = []
    localStorage.setItem('savedChats', JSON.stringify([]))
    logger.info('[useChatLogic] All chats cleared')
  }

  // ==================== Session History Management ====================
  // Session history now uses unified savedChats system (no separate sessionHistory)

  /**
   * Save current session to history (now uses only savedChats for both Chat.vue and ChatPage.vue)
   */
  const saveSessionToHistory = () => {
    // Check if there are any user messages (excluding initial system messages)
    const userMessages = aiChat.messages.filter((msg, index) => index > 1 && msg.isUser)

    if (userMessages.length === 0) {
      logger.info('[useChatLogic] Not saving empty session to history (no user messages)')
      return
    }

    // Use quickSaveChat to save to unified savedChats system
    quickSaveChat()
  }

  /**
   * Detect provider from model ID
   * Used to update stale provider info from saved sessions
   */
  const detectProviderFromModel = (modelId) => {
    if (!modelId) return null

    const model = modelId.toLowerCase()

    // Check for explicit provider prefix (e.g., "kodacode/KodaAgent")
    if (model.includes('/')) {
      const prefix = model.split('/')[0]
      return prefix
    }

    // Detect from model name patterns
    if (model.includes('koda')) return 'kodacode'
    if (model.includes('claude')) return 'anthropic'
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) return 'openai'
    if (model.includes('deepseek')) return 'deepseek'
    if (model.includes('gemini')) return 'google'
    if (model.includes('polza')) return 'polza'

    return null
  }

  // Removed loadSession and deleteSession - now using unified loadChat/deleteChat from savedChats system

  // ==================== Attachments ====================

  const showImagePreview = (url) => {
    currentImage.value = url
    showImageDialog.value = true
  }

  const toggleVoiceInput = () => {
    isRecording.value = !isRecording.value
    // Voice input implementation would go here
  }

  const triggerFileUpload = () => {
    fileInput.value?.click()
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    uploadProgress.value = 10

    try {
      for (const file of files) {
        const attachment = {
          name: file.name,
          size: file.size,
          type: file.type,
          source: 'file',
          url: URL.createObjectURL(file)
        }
        currentAttachments.value.push(attachment)
      }
      uploadProgress.value = 100
    } catch (error) {
      console.error('File upload error:', error)
    } finally {
      setTimeout(() => {
        uploadProgress.value = 0
      }, 1000)
      event.target.value = ''
    }
  }

  const removeCurrentAttachment = (index) => {
    currentAttachments.value.splice(index, 1)
  }

  const downloadAttachment = (attachment) => {
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.name
    link.click()
  }

  // ==================== Data Selector ====================

  const loadDataItems = async () => {
    if (!selectedDataType.value) return

    loadingDataItems.value = true
    try {
      if (selectedDataType.value === 'integram_table') {
        dataItems.value = [
          { id: 1, name: 'Таблица пользователей' },
          { id: 2, name: 'Таблица заказов' },
          { id: 3, name: 'Таблица продуктов' }
        ]
      } else {
        dataItems.value = [
          { id: 1, name: 'Отчёт по продажам' },
          { id: 2, name: 'Отчёт по клиентам' },
          { id: 3, name: 'Финансовый отчёт' }
        ]
      }
    } catch (error) {
      console.error('Failed to load data items:', error)
      dataItems.value = []
    } finally {
      loadingDataItems.value = false
    }
  }

  const attachDataSource = () => {
    if (!selectedDataItem.value) return

    const item = dataItems.value.find(i => i.id === selectedDataItem.value)
    if (!item) return

    const attachment = {
      id: `${selectedDataType.value}_${selectedDataItem.value}`,
      name: item.name,
      type: selectedDataType.value,
      source: 'data',
      comment: dataComment.value
    }

    currentAttachments.value.push(attachment)

    selectedDataType.value = null
    selectedDataItem.value = null
    dataComment.value = ''
    showDataSelector.value = false
  }

  // ==================== Workspace Management ====================

  const loadWorkspaces = async () => {
    loadingWorkspaces.value = true
    try {
      const userId = currentUserId.value
      const result = await getUserWorkspaces(userId)
      workspaces.value = result || []
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      workspaces.value = []
    } finally {
      loadingWorkspaces.value = false
    }
  }

  const handleCreateWorkspace = async () => {
    createWorkspaceError.value = null

    if (!newWorkspace.name.trim()) {
      createWorkspaceError.value = 'Название workspace обязательно'
      return
    }

    creatingWorkspace.value = true
    try {
      const userId = currentUserId.value
      const workspaceData = {
        name: newWorkspace.name.trim(),
        repositoryUrl: newWorkspace.repositoryUrl.trim() || null,
        branch: newWorkspace.branch.trim() || 'main'
      }

      const result = await createWorkspace(userId, workspaceData)

      workspaces.value.push(result)
      selectedWorkspace.value = result.id

      newWorkspace.name = ''
      newWorkspace.repositoryUrl = ''
      newWorkspace.branch = 'main'
      showCreateWorkspaceDialog.value = false
    } catch (error) {
      console.error('Failed to create workspace:', error)
      createWorkspaceError.value = error.message || 'Ошибка создания workspace'
    } finally {
      creatingWorkspace.value = false
    }
  }

  const navigateToWorkspaces = () => {
    router.push('/workspaces')
  }

  // ==================== Chat Session Management ====================

  const createNewChatSession = async () => {
    try {
      // Save current session to history before creating new one
      saveSessionToHistory()

      // Clear current chat
      aiChat.messages = [
        {
          text: 'Ты цифровой помощник. Отвечаешь кратко и по существу. Анализируешь JSON в которых таблицы в формате:Работаем с таблицей: headers (id,value,type,isMain) определяют колонки, rows (id,values) содержат ячейки с headerId для связи данных.',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          isUser: true,
        },
        {
          text: 'Я могу анализировать таблицы и отчёты, отвечать на вопросы и т.д.\nЧем могу помочь?',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          isUser: false,
        },
      ]

      // Reset session
      currentSessionId.value = null
      localStorage.removeItem('polza_session_id') // Legacy cleanup

      // Clear attachments
      currentAttachments.value = []

      logger.info('[useChatLogic] New chat session created')
    } catch (error) {
      console.error('[useChatLogic] Failed to create new chat session:', error)
    }
  }

  const clearCurrentChat = async () => {
    if (activeTabIndex.value === 0) {
      if (confirm('Очистить историю чата?')) {
        // NOTE: No need to terminate session - unified API is stateless
        // Just clear local storage
        const sessionId = localStorage.getItem('polza_session_id')
        if (sessionId) {
          try {
            // DEPRECATED: Session termination not needed with unified API
            // await fetch(`${CHAT_API_URL}/terminate`, ...)
            logger.info('[useChatLogic] Clearing session (stateless API):', sessionId)
          } catch (error) {
            console.error('[useChatLogic] Failed to terminate session:', error)
          }
        }

        // Clear chat
        aiChat.messages = [
          {
            text: 'Ты цифровой помощник. Отвечаешь кратко и по существу. Анализируешь JSON в которых таблицы в формате:Работаем с таблицей: headers (id,value,type,isMain) определяют колонки, rows (id,values) содержат ячейки с headerId для связи данных.',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            isUser: true,
          },
          {
            text: 'Я могу анализировать таблицы и отчёты, отвечать на вопросы и т.д.\nЧем могу помочь?',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            isUser: false,
          },
        ]

        // Reset session
        currentSessionId.value = null
        aiError.value = null
        localStorage.removeItem("polza_session_id") // Legacy cleanup
        localStorage.setItem('aiChat', JSON.stringify(aiChat.messages))

        logger.info('[useChatLogic] Chat cleared')
      }
    } else {
      if (confirm('Очистить общий чат?')) {
        activeChat.messages = [
          {
            text: 'Добро пожаловать в общий чат! Здесь вы можете общаться с коллегами.',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            isUser: false,
          },
        ]
        logger.info('[useChatLogic] General chat cleared')
      }
    }
  }

  // ==================== Chat History Loading ====================

  /**
   * Загружает историю чата из Integram (primary storage)
   * @returns {Promise<Array|null>} Массив сообщений или null если загрузка не удалась
   */
  const loadChatFromIntegram = async () => {
    try {
      logger.info('[useChatLogic] Attempting to load chat history from Integram...')

      // Initialize integram service
      const tokenId = localStorage.getItem('current_ai_token_id') || '206099'
      integramChatSessionService.setCurrentToken(tokenId)

      // Получаем последнюю сессию
      const sessions = await integramChatSessionService.loadSessionHistory(1)

      if (!sessions || sessions.length === 0) {
        logger.info('[useChatLogic] No sessions found in Integram')
        return null
      }

      const lastSession = sessions[0]
      const integramId = lastSession.id
      logger.info('[useChatLogic] Found last session, Integram ID:', integramId)

      // Получаем данные сессии напрямую через integramApiClient
      const result = await integramApiClient.getObjectEditData(integramId)

      if (!result || !result.reqs) {
        logger.info('[useChatLogic] Failed to load session data')
        return null
      }

      // Извлекаем sessionId и messages из реквизитов
      const SESSION_REQUISITES = {
        SESSION_ID: 205921,
        MESSAGES_JSON: 205926
      }

      const sessionId = result.reqs?.[SESSION_REQUISITES.SESSION_ID]?.value
      const messagesJson = result.reqs?.[SESSION_REQUISITES.MESSAGES_JSON]?.value

      if (!messagesJson) {
        logger.info('[useChatLogic] Session has no messages')
        return null
      }

      let messages
      try {
        messages = JSON.parse(messagesJson)
      } catch (error) {
        logger.warn('[useChatLogic] Failed to parse messages JSON:', error)
        return null
      }

      if (!messages || messages.length === 0) {
        logger.info('[useChatLogic] Session messages array is empty')
        return null
      }

      logger.info('[useChatLogic] Successfully loaded', messages.length, 'messages from Integram')

      // Сохраняем sessionId для дальнейшего использования
      if (sessionId) {
        currentSessionId.value = sessionId
        // Обновляем кэш сессий
        integramChatSessionService.sessionsCache.set(sessionId, integramId)
      }

      return messages
    } catch (error) {
      logger.warn('[useChatLogic] Failed to load from Integram, will use localStorage fallback:', error)
      return null
    }
  }

  // ==================== Lifecycle ====================

  const init = async () => {
    // STEP 1: Load chat history from Integram (primary storage)
    const integramMessages = await loadChatFromIntegram()

    if (integramMessages && integramMessages.length > 0) {
      logger.info('[useChatLogic] Using Integram history')
      aiChat.messages = integramMessages
    } else {
      // STEP 2: Fallback to localStorage
      const localMessages = localStorage.getItem('aiChat')
      if (localMessages) {
        try {
          const parsed = JSON.parse(localMessages)
          if (parsed && parsed.length > 0) {
            logger.info('[useChatLogic] Using localStorage fallback')
            aiChat.messages = parsed
          }
        } catch (error) {
          logger.warn('[useChatLogic] Failed to parse localStorage, using default messages')
        }
      }
      // STEP 3: If both failed, default messages are already set in aiChat initialization
    }

    // Continue with normal initialization
    await checkPolzaHealth()

    if (agentMode.value) {
      loadWorkspaces()
    }

    // Initialize general chat
    await generalChat.init()

    // Scroll to the latest messages after history is loaded
    scrollToBottom(aiMessagesContainer)

    // Issue #7121: Save current session to history when the page is closed/reloaded
    // This ensures the chat history is preserved even if the user does not explicitly start a new chat
    // Use once: true to automatically remove listener after it fires (prevents double-registration)
    window.addEventListener('beforeunload', quickSaveChat, { once: true })
  }

  // ==================== Suggested Actions ====================

  /**
   * Retry a failed message (from error message retry button)
   */
  const handleRetry = (msg) => {
    // Remove the error message from chat
    const idx = aiChat.messages.indexOf(msg)
    if (idx !== -1) aiChat.messages.splice(idx, 1)
    // Re-inject user message and send
    aiMessage.value = msg.retryMessage || ''
    if (msg.retryAttachments?.length) currentAttachments.value = msg.retryAttachments
    sendAiMessage()
  }

  // ==================== ТЗ Quick Action ====================
  // Fetches Integram report 1079731 from kval + current document context,
  // asks AI to generate a full Техническое Задание, then offers "Создать документ".

  const _TZ_REPORT_URL = 'https://ai2o.ru/kval/report/1079731?JSON_KV='

  const sendTzAction = async () => {
    if (aiLoading.value) return

    const docCtx = editorDocumentContext.value || window.__editorDocumentContext

    // Show compact user bubble
    aiChat.messages.push({
      text: '📋 Создать ТЗ',
      displayText: '📋 Создать ТЗ',
      isEditorAction: true,
      isTzRequest: true,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      isUser: true
    })

    aiLoading.value = true
    aiError.value = null
    assistantMessage.value = null

    // Create AI message with all 5 steps
    const tzMsg = reactive({
      text: '',
      isUser: false,
      isTzGenerated: false,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      tzSteps: [
        { label: 'Смотрю документ', status: 'pending' },
        { label: 'Получаю отчёт', status: 'pending' },
        { label: 'Создаю ТЗ', status: 'pending' },
        { label: 'Проверка ТЗ', status: 'pending' },
        { label: 'Сохранение ТЗ', status: 'pending' },
      ],
      suggestedActions: null
    })
    aiChat.messages.push(tzMsg)
    // Set assistantMessage so the global loading spinner is suppressed
    assistantMessage.value = tzMsg
    await nextTick()
    scrollToBottom(aiMessagesContainer)
    tzMsg.tzSteps[0].status = 'done'
    tzMsg.tzSteps[1].status = 'active'

    try {
      // 1. Fetch report + enforce min 5s spinner for "Получаю отчёт"
      let reportText = ''
      try {
        await integramApiClient.switchDatabase('kval')
        const kvalToken = integramApiClient.databases?.['kval']?.token
          || integramApiClient.getAuthHeaders('kval')['X-Authorization']
          || localStorage.getItem('my_token')
          || ''
        const [resp] = await Promise.all([
          fetch(_TZ_REPORT_URL, { headers: kvalToken ? { 'X-Authorization': kvalToken } : {} }),
          new Promise(r => setTimeout(r, 5000))
        ])
        if (resp.ok) {
          reportText = await resp.text()
          if (reportText.length > 40000) reportText = reportText.slice(0, 40000) + '\n...[обрезано]'
        } else {
          reportText = `[Ошибка загрузки отчёта: HTTP ${resp.status}]`
        }
      } catch (e) {
        logger.warn('[sendTzAction] Report fetch error:', e.message)
        reportText = '[Не удалось загрузить данные отчёта]'
      }
      // Report received — mark done, start AI step
      tzMsg.tzSteps[1].status = 'done'
      tzMsg.tzSteps[2].status = 'active'

      // 2. Build prompt
      const docTitle = docCtx?.title || 'текущий документ'
      const prompt = `Ты — помощник по составлению технических заданий. На основе текущего документа и данных из отчёта Integram (report/1079731) напиши полное структурированное Техническое Задание (ТЗ).

## Данные из отчёта Integram (база kval, report 1079731):

${reportText || '[данные отчёта не получены]'}

## Требования к ТЗ:
Создай полное ТЗ на основе документа "${docTitle}" и данных отчёта. Структура:
1. **Введение** — описание проекта, контекст
2. **Цели и задачи** — что требуется достичь
3. **Функциональные требования** — конкретные функции и возможности
4. **Нефункциональные требования** — производительность, надёжность, безопасность
5. **Технические требования** — технологический стек, интеграции, инфраструктура
6. **Этапы реализации** — план работ с разбивкой по этапам
7. **Критерии приёмки** — как верифицировать выполнение

Ответ должен быть ТОЛЬКО в формате HTML (используй h2, h3, p, ul, ol, strong, em). Не используй Markdown. Используй данные из отчёта для конкретики — цифры, сроки, ответственные.`

      // 3. Call AI (non-streaming, full response)
      const tzSystemPrompt = `Ты — помощник по составлению технических заданий.

СТРОГО ЗАПРЕЩЕНО: использовать editor_str_replace, editor_clear_and_write, editor_append_section, editor_insert_text, editor_insert_heading или ЛЮБЫЕ другие editor_* инструменты.
НЕ модифицируй текущий документ ни в каком виде.

Разрешено:
- integram_authenticate, integram_execute_report, integram_get_object_list и другие integram_* инструменты для получения данных из отчёта.
- web_search и web_fetch — для поиска best practices, ГОСТов, шаблонов и примеров ТЗ в интернете. Используй их чтобы обогатить ТЗ актуальными стандартами и лучшими практиками.

Твоя задача: получить данные из Integram (если нужно), при необходимости найти в интернете лучшие практики и стандарты оформления ТЗ, проанализировать документ из контекста, и вернуть ТОЛЬКО HTML текст готового ТЗ в своём ответе — без вызова редакторных инструментов.`

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          model: selectedModel.value,
          provider: selectedProvider.value,
          conversationHistory: [],
          systemPrompt: tzSystemPrompt,
          enableEditorTools: false,
          enableAgentChain: true,
          stream: false,
          documentContext: docCtx ? { title: docCtx.title, content: docCtx.content } : null,
          temperature: 0.3,
          maxTokens: 8192
        })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      let tzHtml = data.response || data.result || data.text || data.finalResponse || ''

      // 4. Проверка ТЗ — agent validates HTML, formatting, completeness
      tzMsg.tzSteps[2].status = 'done'
      tzMsg.tzSteps[3].status = 'active'
      await nextTick()
      scrollToBottom(aiMessagesContainer)

      const validatePrompt = `Проверь следующий HTML-документ Технического Задания на качество. Исправь ВСЕ найденные проблемы и верни ИСПРАВЛЕННЫЙ полный HTML.

## Что проверить:
1. **Обрезанный текст** — есть ли предложения или разделы, которые обрываются на полуслове? Если да — допиши их логично.
2. **HTML-теги** — все ли теги правильно открыты и закрыты? Нет ли сломанных тегов (незакрытых <ul>, <ol>, <li>, <p>, <strong>, <em> и т.д.)?
3. **Форматирование** — используются ли правильные теги (h2 для разделов, h3 для подразделов, p для текста, ul/ol для списков)? Нет ли голого текста без обёртки в теги?
4. **Полнота** — присутствуют ли ВСЕ 7 обязательных разделов: Введение, Цели и задачи, Функциональные требования, Нефункциональные требования, Технические требования, Этапы реализации, Критерии приёмки?
5. **Markdown-артефакты** — нет ли остатков Markdown (**, ##, - списки)? Замени на HTML-эквиваленты.

## HTML документа:

${tzHtml}

ВАЖНО: Верни ТОЛЬКО исправленный HTML целиком. Без комментариев, без пояснений, без markdown — только чистый HTML.`

      const validateResp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: validatePrompt,
          model: selectedModel.value,
          provider: selectedProvider.value,
          conversationHistory: [],
          systemPrompt: 'Ты — валидатор HTML-документов. Проверяй и исправляй HTML. Возвращай ТОЛЬКО исправленный HTML без комментариев.',
          enableEditorTools: false,
          enableAgentChain: false,
          stream: false,
          temperature: 0.1,
          maxTokens: 5000
        })
      })

      if (validateResp.ok) {
        const validateData = await validateResp.json()
        const validatedHtml = validateData.response || validateData.result || validateData.text || validateData.finalResponse || ''
        if (validatedHtml.length > 100) {
          tzHtml = validatedHtml
        }
      } else {
        logger.warn('[sendTzAction] Validation agent failed, using original HTML')
      }

      // 5. Сохранение ТЗ — auto-create document
      tzMsg.tzSteps[3].status = 'done'
      tzMsg.tzSteps[4].status = 'active'
      await nextTick()
      scrollToBottom(aiMessagesContainer)

      const tzDocUrl = await createTzDocument(tzHtml, docTitle)

      // All done
      tzMsg.tzSteps[4].status = 'done'
      tzMsg.text = '✅ ТЗ готово'
      tzMsg.isTzGenerated = true
      tzMsg.suggestedActions = tzDocUrl
        ? [{ label: '🔗 Перейти в ТЗ', action: 'url', value: tzDocUrl }]
        : null
    } catch (error) {
      logger.error('[sendTzAction] Error:', error)
      // Update existing tzMsg with error state
      if (tzMsg) {
        tzMsg.tzSteps = null
        tzMsg.text = `⚠️ Ошибка при генерации ТЗ: ${error.message}`
        tzMsg.isError = true
      }
    } finally {
      aiLoading.value = false
      assistantMessage.value = null
      nextTick(() => scrollToBottom(aiMessagesContainer))
    }
  }

  // Create TZ document in kval and open in new tab
  const createTzDocument = async (tzContent, docTitle = '') => {
    try {
      const rawUser = localStorage.getItem('my_user') || localStorage.getItem('user') || 'user'
      const cleanUser = rawUser.replace(/[^\w\u0400-\u04FF]/g, '_').slice(0, 20)

      // Auto-increment index per user
      const counterKey = `tz_doc_counter_${cleanUser}`
      const idx = parseInt(localStorage.getItem(counterKey) || '0') + 1
      localStorage.setItem(counterKey, String(idx))
      const docName = `ТЗ_${cleanUser}_${idx}`

      const userId = integramApiClient.userId
        || localStorage.getItem('my_id')
        || localStorage.getItem('id')
        || null

      const result = await syncHtmlToBlocks('new', tzContent, docName, cleanUser, null, 'kval', userId)

      if (result && result.documentId) {
        return `/block-editor?docId=${result.documentId}&database=kval`
      } else {
        throw new Error('Не получен ID документа от сервера')
      }
    } catch (err) {
      logger.error('[createTzDocument] Error:', err)
      throw err
    }
  }

  /**
   * Handle a click on a suggested action button inside a chat message.
   * Clears buttons from that message and performs the action.
   */
  const handleSuggestedAction = async (msg, btn) => {
    if (btn.action === 'create_tz_doc') {
      btn.loading = true
      try {
        const url = await createTzDocument(btn.tzContent || '', btn.docTitle || '')
        // Replace spinner button with a link button
        msg.suggestedActions = url
          ? [{ label: '🔗 Перейти в ТЗ', action: 'url', value: url }]
          : null
      } catch (err) {
        msg.suggestedActions = [{ label: `⚠️ ${err.message}`, action: 'url', value: '' }]
      }
      return
    }
    // For all other actions — clear buttons immediately
    msg.suggestedActions = null
    if (btn.action === 'message') {
      aiMessage.value = btn.value || ''
      await sendAiMessage()
    } else if (btn.action === 'copy') {
      try {
        await navigator.clipboard.writeText(btn.value || '')
      } catch {
        /* ignore clipboard errors */
      }
    } else if (btn.action === 'url') {
      window.open(btn.value || btn.url || '', '_blank')
    }
  }

  // ==================== Return Public API ====================

  return {
    // State
    activeTabIndex,
    showHistory,
    showImageDialog,
    showSettings,
    showTools,
    showDocPicker,
    showAgentsList,
    showDataSelector,
    showCreateWorkspaceDialog,
    showIntegraMCPAuth,
    showEditMessageDialog,
    showCodeExecutionWindow,
    isRecording,
    uploadProgress,
    currentImage,
    selectedModel,
    selectedProvider,
    userAccessToken,
    llmSettings,
    toolsConfig,
    agentMode,
    deepAgentEnabled,
    runningAgents,
    selectedAgentForChat,
    setSelectedAgentForChat,
    aiChat,
    activeChat,
    aiMessage,
    aiDisplayText,
    newMessage,
    aiLoading,
    aiError,
    assistantMessage,
    currentAttachments,
    currentSessionId,
    isApiAvailable,
    loadingHistory,
    editingMessageIndex,
    editingMessageText,
    workspaces,
    selectedWorkspace,
    loadingWorkspaces,
    creatingWorkspace,
    createWorkspaceError,
    newWorkspace,
    integraMCPState,
    integramAuthForm,
    integramAuthLoading,
    integramAuthError,
    // Issue #7113: Export Integram MCP functions
    checkIntegraMCPConnection,
    handleIntegraMCPAuth,
    handleIntegraMCPLogout,
    testIntegraMCP,
    codeExecutions,
    selectedDataType,
    selectedDataItem,
    dataComment,
    loadingDataItems,
    dataItems,
    dataTypes,
    savedChats,
    newChatName,

    // Context management
    contextUsage,
    compactMessages,

    // General Chat (entire composable for template access)
    generalChat,

    // Refs (for binding in components)
    fileInput,
    fileInputGeneral,
    modalFileInput,
    attachmentMenu,
    attachmentMenuGeneral,
    modalAttachmentMenu,
    aiMessagesContainer,
    messagesContainer,
    modalMessagesContainer,

    // Computed
    isEditorPage,
    isBlockEditorPage,
    isIntegramTablePage,
    isOntologyPage,
    ontologyContextualActions,
    currentUserId,
    editorDocumentContext,
    integramTableContext,
    setIntegramTableContext,
    clearIntegramTableContext,
    clearEditorDocumentContext,
    additionalDocuments,
    addAdditionalDocument,
    removeAdditionalDocument,
    agentStatusBar,
    finmodelContext,
    ecosystemContext,

    // Methods
    isSystemMessage,
    getCombinedSystemPrompt,
    scrollToBottom,
    isImage,
    getAttachmentIcon,
    getAttachmentDisplayName,
    formatFileSize,
    getWorkspaceName,
    getWorkspaceRepo,
    handleModelChange,
    handleDeepAgentToggle,
    checkPolzaHealth,
    generateDemoResponse,
    sendMessage,
    sendAiMessage,
    cancelAiRequest,
    sendEditorAction,
    sendTzAction,
    copyToClipboard,
    editMessage,
    deleteMessage,
    resendMessage,
    handleSuggestedAction,
    handleRetry,
    saveCurrentChat,
    loadChat,
    deleteChat,
    quickSaveChat,
    startNewChat,
    clearAllChats,
    saveSessionToHistory,
    showImagePreview,
    toggleVoiceInput,
    triggerFileUpload,
    handleFileUpload,
    removeCurrentAttachment,
    downloadAttachment,
    loadDataItems,
    attachDataSource,
    loadWorkspaces,
    handleCreateWorkspace,
    navigateToWorkspaces,
    createNewChatSession,
    clearCurrentChat,
    init,

    // Issue #6832: Slash command handlers
    detectSlashCommand,
    processTableFillCommand,
    processResearchCommand,
    // Issue #7078: Import dialog trigger
    processImportCommand,

    // General Chat methods (from useGeneralChat)
    loadRooms: generalChat.loadRooms,
    createDefaultRoom: generalChat.createDefaultRoom,
    joinRoom: generalChat.joinRoom,
    handleTyping: generalChat.handleTyping,
  }
}

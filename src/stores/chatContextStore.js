/**
 * Chat Context Store — event-driven page context for sidebar chat.
 *
 * Pages write their context here (active tab, selected entity, available actions).
 * Chat.vue reads it reactively → adjusts systemPrompt, chips, placeholder, handler.
 *
 * Usage from page:
 *   const ctx = useChatContextStore()
 *   ctx.setPageContext({ page: 'portfolio', tab: 'monitor', ... })
 *
 * Usage from Chat.vue:
 *   const ctx = useChatContextStore()
 *   ctx.chips        → reactive chip list
 *   ctx.placeholder   → input placeholder
 *   ctx.systemPromptExtra → extra system prompt lines
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useChatContextStore = defineStore('chatContext', () => {
  // ── Core state ──────────────────────────────────────
  const page = ref('')           // 'portfolio' | 'deal' | 'hub' | ...
  const tab = ref('')            // 'dashboard' | 'monitor' | 'analytics' | 'chat'
  const subTab = ref('')         // 'cards' | 'pipeline' | 'finance' | 'valuations'

  // Selected entity (company, deal, etc.)
  const selectedEntity = ref(null)  // { id, name, type, data }

  // Page-level data summary for AI context
  const pageSummary = ref('')       // compact text summary of page state

  // Custom chips provided by page
  const pageChips = ref([])         // [{ label, icon, prompt, id }]

  // Custom system prompt additions from page
  const pageSystemPrompt = ref('')

  // Response mode
  const responseMode = ref('text')  // 'text' | 'blocks' | 'agent'

  // ── Actions ─────────────────────────────────────────

  /**
   * Set full page context. Called by page on mount/watch.
   * @param {Object} ctx
   */
  function setPageContext(ctx) {
    if (ctx.page !== undefined) page.value = ctx.page
    if (ctx.tab !== undefined) tab.value = ctx.tab
    if (ctx.subTab !== undefined) subTab.value = ctx.subTab
    if (ctx.selectedEntity !== undefined) selectedEntity.value = ctx.selectedEntity
    if (ctx.pageSummary !== undefined) pageSummary.value = ctx.pageSummary
    if (ctx.pageChips !== undefined) pageChips.value = ctx.pageChips
    if (ctx.pageSystemPrompt !== undefined) pageSystemPrompt.value = ctx.pageSystemPrompt
    if (ctx.responseMode !== undefined) responseMode.value = ctx.responseMode
  }

  /** Clear context (on page unmount) */
  function clearPageContext() {
    page.value = ''
    tab.value = ''
    subTab.value = ''
    selectedEntity.value = null
    pageSummary.value = ''
    pageChips.value = []
    pageSystemPrompt.value = ''
    responseMode.value = 'text'
  }

  /** Update just the selected entity */
  function setSelectedEntity(entity) {
    selectedEntity.value = entity
  }

  /** Update just the tab */
  function setTab(newTab, newSubTab) {
    tab.value = newTab
    if (newSubTab !== undefined) subTab.value = newSubTab
  }

  /** Update chips */
  function setChips(chips) {
    pageChips.value = chips
  }

  /** Update page summary */
  function setSummary(summary) {
    pageSummary.value = summary
  }

  // ── Computed for Chat.vue ───────────────────────────

  const placeholder = computed(() => {
    if (page.value === 'portfolio') {
      if (tab.value === 'dashboard') return 'Анализ портфеля: риски, лидеры, runway...'
      if (tab.value === 'monitor') {
        if (selectedEntity.value) return `Спросите про ${selectedEntity.value.name}...`
        return 'Выберите компанию или спросите про портфель...'
      }
      if (tab.value === 'analytics') return 'Финансовый анализ, сравнение метрик...'
      if (tab.value === 'chat') return 'AI-аналитик портфеля...'
    }
    if (page.value === 'deal') return 'Анализ сделки, условия, финмодель...'
    if (page.value === 'hub') return 'Обзор фонда, модули, навигация...'
    if (page.value === 'dealflow') return 'Воронка сделок, статусы, конверсия...'
    return ''  // empty = use default from Chat.vue
  })

  const chips = computed(() => {
    // Page-specific chips take priority
    if (pageChips.value.length > 0) return pageChips.value
    return []
  })

  const systemPromptExtra = computed(() => {
    const parts = []

    if (pageSystemPrompt.value) {
      parts.push(pageSystemPrompt.value)
    }

    if (page.value === 'portfolio') {
      parts.push(`\nТЕКУЩИЙ КОНТЕКСТ: Страница "Портфельный монитор", вкладка "${tab.value}".`)

      if (tab.value === 'dashboard') {
        parts.push('Пользователь на дашборде. Отвечай аналитикой по портфелю в целом.')
        parts.push('Можешь генерировать блоки визуализации (графики, метрики, алерты).')
      }

      if (tab.value === 'monitor') {
        parts.push('Пользователь на вкладке «Компании». Отвечай про конкретные компании.')
        if (selectedEntity.value) {
          parts.push(`ВЫБРАНА КОМПАНИЯ: ${selectedEntity.value.name}`)
          if (selectedEntity.value.data) {
            const d = selectedEntity.value.data
            const facts = []
            if (d.invested) facts.push(`инвестиции: ${d.invested} млн`)
            if (d.trl) facts.push(`TRL: ${d.trl}`)
            if (d.revenue) facts.push(`выручка: ${d.revenue} млн`)
            if (d.subfund) facts.push(`субфонд: ${d.subfund}`)
            if (d.riskLevel) facts.push(`риск: ${d.riskLevel}`)
            if (d.employees) facts.push(`команда: ${d.employees} чел.`)
            if (d.description) facts.push(`описание: ${d.description.slice(0, 200)}`)
            if (facts.length) parts.push(`Данные: ${facts.join(', ')}`)
          }
        } else {
          parts.push('Компания не выбрана. Отвечай про портфель в целом или предложи выбрать.')
        }
      }

      if (tab.value === 'analytics') {
        parts.push('Пользователь на вкладке «Аналитика». Помогай с финансовым анализом.')
        if (subTab.value === 'finance') parts.push('Подвкладка: Финансы (инвестиции, выручка, доля ФСТ)')
        if (subTab.value === 'valuations') parts.push('Подвкладка: Оценки (pre/post-money, TVPI)')
      }
    }

    if (pageSummary.value) {
      parts.push(`\nДАННЫЕ СТРАНИЦЫ:\n${pageSummary.value}`)
    }

    return parts.join('\n')
  })

  /** Label for hint badge in chat */
  const contextLabel = computed(() => {
    if (!page.value) return ''
    if (page.value === 'portfolio') {
      const labels = { dashboard: 'Дашборд', monitor: 'Компании', analytics: 'Аналитика', chat: 'AI Аналитик' }
      let label = `Портфель → ${labels[tab.value] || tab.value}`
      if (selectedEntity.value) label += ` → ${selectedEntity.value.name}`
      return label
    }
    return page.value
  })

  return {
    // State
    page, tab, subTab, selectedEntity, pageSummary, pageChips, pageSystemPrompt, responseMode,
    // Actions
    setPageContext, clearPageContext, setSelectedEntity, setTab, setChips, setSummary,
    // Computed (for Chat.vue)
    placeholder, chips, systemPromptExtra, contextLabel,
  }
})

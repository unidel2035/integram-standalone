<template>
  <div class="sec-root">
    <!-- Заголовок -->
    <div class="sec-header">
      <div class="sec-title-block">
        <i class="pi pi-share-alt" style="color:var(--p-primary-color)"></i>
        <span class="sec-title">Сценарное прогнозирование</span>
        <span class="sec-subtitle">Событийная онтология · цепочка вех · обсуждение агентов</span>
      </div>
      <div class="sec-actions">
        <div class="sec-path-tabs">
          <button v-for="path in PATHS" :key="path.id"
            :class="['sec-path-btn', { active: activePath === path.id }]"
            :style="activePath === path.id ? { borderColor: path.color, color: path.color } : {}"
            @click="activePath = path.id">
            {{ path.label }}
          </button>
        </div>
        <button class="sec-btn-ai" :disabled="generating" @click="generateChain">
          <i :class="generating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
          {{ generating ? 'Генерация...' : chain.length ? 'Перегенерировать' : 'AI-генерация цепочки' }}
        </button>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!chain.length && !generating" class="sec-empty">
      <i class="pi pi-share-alt sec-empty-icon"></i>
      <div class="sec-empty-text">
        AI отберёт события из событийной онтологии (TRL-переходы, пилоты, контракты, меры поддержки)
        и оценит вероятность и горизонт каждого для данного проекта
      </div>
    </div>

    <!-- Лоадер -->
    <div v-if="generating" class="sec-loading">
      <div class="sec-loading-steps">
        <div v-for="(step, i) in loadSteps" :key="i"
          :class="['sec-loading-step', { active: i === loadingStep, done: i < loadingStep }]">
          <i :class="i < loadingStep ? 'pi pi-check' : i === loadingStep ? 'pi pi-spin pi-spinner' : 'pi pi-circle'"></i>
          {{ step }}
        </div>
      </div>
    </div>

    <!-- Цепочка событий -->
    <div v-if="chain.length" class="sec-chain-area">

      <!-- Горизонтальная лента -->
      <div class="sec-timeline">
        <div v-for="(node, i) in visibleNodes" :key="node.id"
          :class="['sec-node', `path-${node.path}`, { selected: selectedNode?.id === node.id, dimmed: activePath !== 'all' && node.path !== activePath && node.path !== 'all' }]"
          @click="selectNode(node)">

          <!-- Стрелка между нодами -->
          <div v-if="i < visibleNodes.length - 1" class="sec-connector">
            <div class="sec-connector-line"></div>
            <i class="pi pi-chevron-right sec-connector-arrow"></i>
          </div>

          <!-- Карточка ноды -->
          <div class="sec-node-card" :style="{ borderColor: pathColor(node.path) }">
            <div class="sec-node-top">
              <!-- Chain badge из онтологии -->
              <span v-if="node.chain" class="sec-chain-badge"
                :style="{ background: `color-mix(in srgb, ${chainColor(node.chain)} 14%, transparent)`, color: chainColor(node.chain) }">
                {{ chainLabel(node.chain) }}
              </span>
              <span v-else class="sec-node-type-badge"
                :style="{ background: `color-mix(in srgb, ${pathColor(node.path)} 14%, transparent)`, color: pathColor(node.path) }">
                {{ node.phase }}
              </span>
              <span class="sec-node-horizon">~{{ node.horizonMonths }}м</span>
            </div>
            <div class="sec-node-icon-wrap"
              :style="{ background: `color-mix(in srgb, ${pathColor(node.path)} 14%, transparent)` }">
              <i :class="node.icon || 'pi pi-circle'" :style="{ color: pathColor(node.path) }"></i>
            </div>
            <div class="sec-node-label">{{ node.label }}</div>
            <div class="sec-node-prob">
              <div class="sec-prob-bar">
                <div class="sec-prob-fill" :style="{ width: node.probability + '%', background: probColor(node.probability) }"></div>
              </div>
              <span class="sec-prob-val" :style="{ color: probColor(node.probability) }">{{ node.probability }}%</span>
            </div>
            <div class="sec-node-conds-summary">
              <i class="pi pi-list-check" style="font-size:0.65rem"></i>
              {{ (node.conditions || []).length }} условий
              <span v-if="node.agentVotes?.length" class="sec-node-votes-count">
                · {{ node.agentVotes.length }} мнений
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Детальная панель выбранной ноды -->
      <div v-if="selectedNode" class="sec-detail">
        <div class="sec-detail-header">
          <i :class="selectedNode.icon || 'pi pi-circle'" :style="{ color: pathColor(selectedNode.path) }"></i>
          <span class="sec-detail-title">{{ selectedNode.label }}</span>
          <!-- Path badge -->
          <span class="sec-detail-path-badge"
            :style="{ background: `color-mix(in srgb, ${pathColor(selectedNode.path)} 14%, transparent)`, color: pathColor(selectedNode.path) }">
            {{ pathLabel(selectedNode.path) }}
          </span>
          <!-- Ontology ID badge -->
          <span v-if="selectedNode.eventTypeId" class="sec-ontology-badge">
            <i class="pi pi-database"></i>
            {{ selectedNode.eventTypeId }}
          </span>
          <button class="sec-close-btn" @click="selectedNode = null">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="sec-detail-body">
          <!-- Описание из онтологии -->
          <div class="sec-detail-desc">{{ selectedNode.description }}</div>

          <!-- Мета: горизонт, вероятность, импакт -->
          <div class="sec-detail-meta">
            <div class="sec-meta-item">
              <span class="sec-meta-label">Горизонт</span>
              <span class="sec-meta-value">{{ selectedNode.horizonMonths }} мес.</span>
            </div>
            <div class="sec-meta-item">
              <span class="sec-meta-label">Вероятность</span>
              <span class="sec-meta-value" :style="{ color: probColor(selectedNode.probability) }">{{ selectedNode.probability }}%</span>
            </div>
            <div v-if="selectedNode.impact?.revenue" class="sec-meta-item">
              <span class="sec-meta-label">Выручка</span>
              <span class="sec-meta-value">{{ selectedNode.impact.revenue }}</span>
            </div>
            <div v-if="selectedNode.impact?.valuation" class="sec-meta-item">
              <span class="sec-meta-label">Оценка</span>
              <span class="sec-meta-value">{{ selectedNode.impact.valuation }}</span>
            </div>
            <div v-if="selectedNode.impact?.trl" class="sec-meta-item">
              <span class="sec-meta-label">TRL</span>
              <span class="sec-meta-value">{{ selectedNode.impact.trl }}</span>
            </div>
            <div v-if="selectedNode.subject" class="sec-meta-item">
              <span class="sec-meta-label">Субъект</span>
              <span class="sec-meta-value sec-meta-value--sm">{{ selectedNode.subject }}</span>
            </div>
          </div>

          <!-- Связи из онтологии (preconditions / enables) -->
          <div v-if="selectedNode.preconditions?.length || selectedNode.enables?.length" class="sec-ontology-links">
            <div v-if="selectedNode.preconditions?.length" class="sec-onto-group">
              <span class="sec-onto-label"><i class="pi pi-arrow-left"></i> Предусловия</span>
              <div class="sec-onto-chips">
                <span v-for="p in selectedNode.preconditions" :key="p" class="sec-onto-chip sec-onto-chip--pre">{{ p }}</span>
              </div>
            </div>
            <div v-if="filteredEnables(selectedNode).length" class="sec-onto-group">
              <span class="sec-onto-label"><i class="pi pi-arrow-right"></i> Открывает</span>
              <div class="sec-onto-chips">
                <span v-for="e in filteredEnables(selectedNode)" :key="e" class="sec-onto-chip sec-onto-chip--ena">{{ e }}</span>
              </div>
            </div>
          </div>

          <!-- Условия возникновения -->
          <div class="sec-conditions-section">
            <div class="sec-section-title">
              <i class="pi pi-list-check"></i>
              Условия возникновения
            </div>
            <div v-if="!selectedNode.conditions?.length" class="sec-no-conditions">
              Событие может произойти в любой момент
            </div>
            <div v-for="(cond, ci) in selectedNode.conditions" :key="ci" class="sec-condition">
              <div class="sec-cond-left">
                <span class="sec-cond-type" :class="`cond-${cond.type || 'trigger'}`">
                  {{ condTypeLabel(cond.type) }}
                </span>
                <span class="sec-cond-text">{{ cond.text }}</span>
              </div>
              <div v-if="cond.threshold" class="sec-cond-threshold">
                ≥ {{ cond.threshold }} {{ cond.unit || '' }}
              </div>
            </div>
          </div>

          <!-- Обсуждение агентов -->
          <div class="sec-agents-section">
            <div class="sec-section-title">
              <i class="pi pi-comments"></i>
              Мнения агентов ИК
              <button class="sec-discuss-btn" :disabled="discussing" @click="discussWithAgents">
                <i :class="discussing ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
                {{ discussing ? 'Анализируют...' : selectedNode.agentVotes?.length ? 'Переобсудить' : 'Обсудить' }}
              </button>
            </div>
            <div v-if="!selectedNode.agentVotes?.length && !discussing" class="sec-no-discussion">
              Нажмите «Обсудить» — 6 агентов ИК проанализируют это событие
            </div>
            <div class="sec-agent-votes">
              <div v-for="vote in (selectedNode.agentVotes || [])" :key="vote.agentId"
                :class="['sec-agent-vote', `stance-${vote.stance?.toLowerCase()}`]">
                <div class="sec-av-header">
                  <span class="sec-av-avatar" :style="{ background: agentColor(vote.agentId) }">
                    {{ agentAv(vote.agentId) }}
                  </span>
                  <span class="sec-av-name">{{ agentName(vote.agentId) }}</span>
                  <span class="sec-av-stance" :class="`stance-badge-${vote.stance?.toLowerCase()}`">
                    {{ stanceLabel(vote.stance) }}
                  </span>
                  <span class="sec-av-prob">{{ vote.probEstimate }}%</span>
                </div>
                <div class="sec-av-comment">{{ vote.comment }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Сводка по путям -->
      <div class="sec-path-summary">
        <div v-for="path in PATHS" :key="path.id" class="sec-path-stat">
          <span class="sec-ps-dot" :style="{ background: path.color }"></span>
          <span class="sec-ps-label">{{ path.label }}:</span>
          <span class="sec-ps-nodes">{{ nodesForPath(path.id).length }} нод</span>
          <span class="sec-ps-avg">· ср. вер. {{ avgProb(path.id) }}%</span>
        </div>
      </div>
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="sec-error">
      <i class="pi pi-exclamation-triangle"></i> {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  filterCandidateNodes,
  buildEnrichPrompt,
  mergeWithOntology,
  CHAIN_META,
} from '@/composables/useEventChain.js'

// ── Константы ──────────────────────────────────────────────────────────────────

const PATHS = [
  { id: 'all',         label: 'Все пути',     color: 'var(--p-text-muted-color)' },
  { id: 'optimistic',  label: 'Оптимист',     color: 'var(--fst-green)' },
  { id: 'base',        label: 'Базовый',      color: 'var(--fst-blue)' },
  { id: 'pessimistic', label: 'Риск',         color: 'var(--fst-red)' },
]

const AGENT_META = {
  tech:        { name: 'Техн. аналитик',  av: 'ТА', color: 'var(--fst-blue)' },
  finance:     { name: 'Фин. аналитик',   av: 'ФА', color: 'var(--fst-green)' },
  sovereignty: { name: 'Эксперт сувер.',  av: 'ЭС', color: 'var(--fst-brand)' },
  risk:        { name: 'Риск-менеджер',   av: 'РМ', color: 'var(--fst-red)' },
  portfolio:   { name: 'Стратег',         av: 'СТ', color: 'var(--fst-purple)' },
  devil:       { name: 'Критик',          av: 'КР', color: 'var(--p-text-muted-color)' },
}

const COND_TYPE_LABELS = {
  precondition: 'Предусловие',
  trigger:      'Триггер',
  milestone:    'Веха',
  financial:    'Финансовый',
  regulatory:   'Регуляторный',
  market:       'Рыночный',
  tech:         'Технический',
}

const LOAD_STEPS = [
  'Анализ проекта — сектор, TRL, стадия...',
  'Фильтрация онтологии — отбор событий...',
  'AI оценивает вероятности и горизонты...',
  'Назначение путей (оптимист / база / риск)...',
  'Построение условий возникновения...',
  'Сборка сценарного графа...',
]

// ── Props ──────────────────────────────────────────────────────────────────────
const props = defineProps({
  project:  { type: Object, default: () => ({}) },
  session:  { type: Object, default: () => ({}) },
  decision: { type: Object, default: null },
})

// ── State ──────────────────────────────────────────────────────────────────────
const chain        = ref([])
const activePath   = ref('all')
const selectedNode = ref(null)
const generating   = ref(false)
const discussing   = ref(false)
const error        = ref('')
const loadingStep  = ref(0)
const loadSteps    = ref(LOAD_STEPS)

// ── Вычисляемые ────────────────────────────────────────────────────────────────
const visibleNodes = computed(() => {
  if (activePath.value === 'all') return chain.value
  return chain.value.filter(n => n.path === activePath.value || n.path === 'all')
})

function nodesForPath(pid) {
  if (pid === 'all') return chain.value
  return chain.value.filter(n => n.path === pid || n.path === 'all')
}

function avgProb(pid) {
  const nodes = nodesForPath(pid)
  if (!nodes.length) return 0
  return Math.round(nodes.reduce((s, n) => s + n.probability, 0) / nodes.length)
}

// Фильтрует enables — убирает measure-specific вида "MEASURE_APPLIED:fasie-umnik"
function filteredEnables(node) {
  return (node.enables || []).filter(e => !e.includes(':'))
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pathColor(pid) {
  return PATHS.find(p => p.id === pid)?.color || 'var(--p-text-muted-color)'
}
function pathLabel(pid) {
  return PATHS.find(p => p.id === pid)?.label || pid
}
function probColor(p) {
  if (p >= 70) return 'var(--fst-green)'
  if (p >= 40) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
function chainColor(chain) {
  return CHAIN_META[chain]?.color || 'var(--p-text-muted-color)'
}
function chainLabel(chain) {
  return CHAIN_META[chain]?.label || chain
}
function agentName(id)  { return AGENT_META[id]?.name  || id }
function agentAv(id)    { return AGENT_META[id]?.av    || '?' }
function agentColor(id) { return AGENT_META[id]?.color || 'var(--p-text-muted-color)' }
function condTypeLabel(t) { return COND_TYPE_LABELS[t] || t || 'Условие' }
function stanceLabel(s) {
  return { SUPPORT: '✓ Поддерж.', NEUTRAL: '⊙ Нейтр.', CONCERN: '⚠ Риск', BLOCK: '✗ Блокир.' }[s] || s
}

// ── Выбор ноды ─────────────────────────────────────────────────────────────────
function selectNode(node) {
  selectedNode.value = selectedNode.value?.id === node.id ? null : node
}

// ── AI-генерация цепочки (онтология → AI обогащение) ──────────────────────────
async function generateChain() {
  generating.value = true
  error.value = ''
  loadingStep.value = 0
  chain.value = []
  selectedNode.value = null

  const stepTimer = setInterval(() => {
    if (loadingStep.value < LOAD_STEPS.length - 1) loadingStep.value++
  }, 1600)

  try {
    // 1. Фильтруем кандидатные ноды из онтологии
    const candidates = filterCandidateNodes(props.project)

    // 2. AI оценивает вероятности/горизонты/условия — не придумывает события
    const prompt = buildEnrichPrompt(candidates, props.project, props.decision)

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId:      'anthropic/claude-sonnet-4-20250514',
        prompt,
        systemPrompt: 'Ты — аналитик венчурного фонда. Отвечай только в JSON без markdown.',
        application:  'ScenarioEventChainPanel',
      }),
    })

    const { response } = await res.json()
    const m = response.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Модель вернула неверный формат')
    const data = JSON.parse(m[0])

    if (!data.events?.length) throw new Error('Пустой ответ от модели')

    // 3. Мержим AI-оценки с определениями из онтологии
    chain.value = mergeWithOntology(data.events, candidates)

    if (chain.value.length) selectedNode.value = chain.value[0]

  } catch (e) {
    error.value = 'Генерация: ' + e.message
    console.error('[ScenarioEventChainPanel.generateChain]', e)
  } finally {
    clearInterval(stepTimer)
    generating.value = false
    loadingStep.value = 0
  }
}

// ── Обсуждение ноды агентами ───────────────────────────────────────────────────
async function discussWithAgents() {
  if (!selectedNode.value) return
  discussing.value = true
  error.value = ''

  try {
    const node = selectedNode.value
    const proj = props.project || {}

    const condText = (node.conditions || [])
      .map(c => `• [${c.type}] ${c.text}${c.threshold ? ' ≥ ' + c.threshold : ''}`)
      .join('\n') || '(без условий)'

    const prompt = `Ты симулятор инвесткомитета. Верни мнение ВСЕХ шести агентов ИК по событию-вехе стартапа.

ПРОЕКТ: ${proj.title || proj.name || 'стартап'}, отрасль: ${proj.subfund || proj.industry || 'БПЛА'}

СОБЫТИЕ: «${node.label}» [${node.eventTypeId || node.phase}]
Описание: ${node.description}
Цепочка: ${node.chain || 'core'}
Горизонт: ${node.horizonMonths} месяцев
Вероятность: ${node.probability}%
Субъект: ${node.subject || 'команда'}

Условия возникновения:
${condText}

Каждый агент — оценить реалистичность, назвать главный риск/фактор, скорректировать вероятность.

Агенты: tech, finance, sovereignty, risk, portfolio, devil

Ответь ТОЛЬКО в JSON:
{
  "votes": [
    {
      "agentId": "tech",
      "stance": "SUPPORT|NEUTRAL|CONCERN|BLOCK",
      "probEstimate": 70,
      "comment": "Краткий комментарий (2-3 предложения)"
    }
  ]
}`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId:      'deepseek/deepseek-chat',
        prompt,
        systemPrompt: 'Симулятор ИК. Отвечай только JSON без markdown.',
        application:  'ScenarioEventChainPanel.discuss',
      }),
    })

    const { response } = await res.json()
    const m = response.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Неверный формат ответа')
    const data = JSON.parse(m[0])

    if (data.votes?.length) {
      const idx = chain.value.findIndex(n => n.id === selectedNode.value.id)
      if (idx !== -1) {
        chain.value[idx].agentVotes = data.votes
        selectedNode.value = chain.value[idx]
      }
    }
  } catch (e) {
    error.value = 'Обсуждение: ' + e.message
    console.error('[ScenarioEventChainPanel.discussWithAgents]', e)
  } finally {
    discussing.value = false
  }
}
</script>

<style scoped>
.sec-root {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Header */
.sec-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.sec-title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sec-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-text-color);
}
.sec-subtitle {
  font-size: 0.73rem;
  color: var(--p-text-muted-color);
}
.sec-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Path tabs */
.sec-path-tabs { display: flex; gap: 4px; }
.sec-path-btn {
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.73rem;
  cursor: pointer;
  transition: all 0.15s;
}
.sec-path-btn.active { font-weight: 600; background: var(--p-surface-card); }
.sec-path-btn:hover:not(.active) { background: var(--p-surface-card); }

.sec-btn-ai {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--p-primary-color);
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 6px 14px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.sec-btn-ai:disabled { opacity: 0.5; cursor: default; }
.sec-btn-ai:hover:not(:disabled) { opacity: 0.85; }

/* Empty */
.sec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--p-text-muted-color);
  text-align: center;
}
.sec-empty-icon { font-size: 2rem; opacity: 0.3; }
.sec-empty-text { font-size: 0.8rem; max-width: 440px; line-height: 1.5; }

/* Loading */
.sec-loading { padding: 16px; display: flex; justify-content: center; }
.sec-loading-steps { display: flex; flex-direction: column; gap: 6px; }
.sec-loading-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  transition: color 0.3s;
}
.sec-loading-step.active { color: var(--p-primary-color); font-weight: 600; }
.sec-loading-step.done   { color: var(--fst-green); }

/* Chain area */
.sec-chain-area { display: flex; flex-direction: column; gap: 12px; }

/* Timeline */
.sec-timeline {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.sec-node {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.sec-node.dimmed { opacity: 0.3; }
.sec-node.selected .sec-node-card { box-shadow: 0 0 0 2px var(--p-primary-color); }

/* Connector */
.sec-connector {
  display: flex;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
  position: relative;
}
.sec-connector-line { height: 1px; width: 100%; background: var(--p-content-border-color); }
.sec-connector-arrow {
  position: absolute;
  right: -4px;
  font-size: 0.55rem;
  color: var(--p-text-muted-color);
}

/* Node card */
.sec-node-card {
  width: 144px;
  background: var(--p-surface-card);
  border: 1.5px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 10px 8px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.sec-node-card:hover { background: var(--p-surface-card); }

.sec-node-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
}
.sec-chain-badge,
.sec-node-type-badge {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 4px;
  padding: 1px 5px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sec-node-horizon { font-size: 0.62rem; color: var(--p-text-muted-color); flex-shrink: 0; }

.sec-node-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}
.sec-node-icon-wrap i { font-size: 0.9rem; }

.sec-node-label {
  font-size: 0.73rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.3;
  text-align: center;
}

.sec-prob-bar {
  height: 3px;
  background: var(--p-content-border-color);
  border-radius: 2px;
  overflow: hidden;
}
.sec-prob-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
.sec-node-prob { display: flex; align-items: center; gap: 5px; }
.sec-node-prob .sec-prob-bar { flex: 1; }
.sec-prob-val { font-size: 0.65rem; font-weight: 700; flex-shrink: 0; }

.sec-node-conds-summary {
  font-size: 0.62rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 3px;
}
.sec-node-votes-count { color: var(--p-primary-color); }

/* Detail panel */
.sec-detail {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sec-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sec-detail-header > i { font-size: 1.1rem; }
.sec-detail-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--p-text-color);
  flex: 1;
}
.sec-detail-path-badge {
  font-size: 0.7rem;
  border-radius: 5px;
  padding: 2px 8px;
  font-weight: 600;
}
.sec-ontology-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-family: monospace;
  color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 6px;
}
.sec-close-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 2px 4px;
}
.sec-close-btn:hover { color: var(--p-text-color); }

.sec-detail-body { display: flex; flex-direction: column; gap: 12px; }

.sec-detail-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* Meta strip */
.sec-detail-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.sec-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 72px;
}
.sec-meta-label {
  font-size: 0.63rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sec-meta-value {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.sec-meta-value--sm { font-size: 0.72rem; font-weight: 400; }

/* Ontology links (preconditions / enables) */
.sec-ontology-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 10px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 7px;
}
.sec-onto-group { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; }
.sec-onto-label {
  font-size: 0.68rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  padding-top: 2px;
}
.sec-onto-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.sec-onto-chip {
  font-size: 0.62rem;
  font-family: monospace;
  border-radius: 4px;
  padding: 2px 6px;
}
.sec-onto-chip--pre {
  background: color-mix(in srgb, var(--fst-brand) 12%, transparent);
  color: var(--fst-brand);
}
.sec-onto-chip--ena {
  background: color-mix(in srgb, var(--fst-blue) 12%, transparent);
  color: var(--fst-blue);
}

/* Conditions */
.sec-conditions-section,
.sec-agents-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sec-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.sec-no-conditions,
.sec-no-discussion {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}

.sec-condition {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 7px 10px;
}
.sec-cond-left { display: flex; align-items: flex-start; gap: 6px; flex: 1; }
.sec-cond-type {
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
  text-transform: uppercase;
}
.cond-precondition {
  background: color-mix(in srgb, var(--fst-purple) 14%, transparent);
  color: var(--fst-purple);
}
.cond-trigger {
  background: color-mix(in srgb, var(--fst-brand) 14%, transparent);
  color: var(--fst-brand);
}
.cond-financial {
  background: color-mix(in srgb, var(--fst-green) 14%, transparent);
  color: var(--fst-green);
}
.cond-regulatory {
  background: color-mix(in srgb, var(--fst-purple) 14%, transparent);
  color: var(--fst-purple);
}
.cond-tech {
  background: color-mix(in srgb, var(--fst-blue) 14%, transparent);
  color: var(--fst-blue);
}
.cond-market {
  background: color-mix(in srgb, var(--fst-cyan) 14%, transparent);
  color: var(--fst-cyan);
}
.cond-milestone {
  background: color-mix(in srgb, var(--fst-cyan) 14%, transparent);
  color: var(--fst-cyan);
}

.sec-cond-text { font-size: 0.75rem; color: var(--p-text-color); line-height: 1.4; }
.sec-cond-threshold { font-size: 0.72rem; color: var(--p-primary-color); font-weight: 600; flex-shrink: 0; }

/* Agent discussion */
.sec-discuss-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.72rem;
  cursor: pointer;
  color: var(--p-text-color);
  transition: all 0.15s;
  margin-left: auto;
}
.sec-discuss-btn:disabled { opacity: 0.5; cursor: default; }
.sec-discuss-btn:hover:not(:disabled) { background: var(--p-surface-card); }

.sec-agent-votes { display: flex; flex-direction: column; gap: 6px; }
.sec-agent-vote {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-left-width: 3px;
}
.sec-agent-vote.stance-support { border-left-color: var(--fst-green); }
.sec-agent-vote.stance-neutral  { border-left-color: var(--p-text-muted-color); }
.sec-agent-vote.stance-concern  { border-left-color: var(--fst-brand); }
.sec-agent-vote.stance-block    { border-left-color: var(--fst-red); }

.sec-av-header { display: flex; align-items: center; gap: 6px; }
.sec-av-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.sec-av-name { font-size: 0.75rem; font-weight: 600; color: var(--p-text-color); flex: 1; }
.sec-av-stance { font-size: 0.65rem; border-radius: 4px; padding: 1px 6px; }
.stance-badge-support {
  background: color-mix(in srgb, var(--fst-green) 14%, transparent);
  color: var(--fst-green);
}
.stance-badge-neutral {
  background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
  color: var(--p-text-muted-color);
}
.stance-badge-concern {
  background: color-mix(in srgb, var(--fst-brand) 14%, transparent);
  color: var(--fst-brand);
}
.stance-badge-block {
  background: color-mix(in srgb, var(--fst-red) 14%, transparent);
  color: var(--fst-red);
}
.sec-av-prob { font-size: 0.7rem; font-weight: 700; color: var(--p-text-muted-color); flex-shrink: 0; }
.sec-av-comment { font-size: 0.75rem; color: var(--p-text-muted-color); line-height: 1.45; }

/* Path summary */
.sec-path-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: var(--p-surface-card);
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
}
.sec-path-stat { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; }
.sec-ps-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sec-ps-label { font-weight: 600; color: var(--p-text-color); }
.sec-ps-nodes { color: var(--p-text-color); }
.sec-ps-avg   { color: var(--p-text-muted-color); }

/* Error */
.sec-error {
  font-size: 0.78rem;
  color: var(--fst-red);
  background: color-mix(in srgb, var(--fst-red) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 25%, transparent);
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>

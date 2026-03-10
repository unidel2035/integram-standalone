<template>
  <div class="sec-root">
    <!-- Заголовок -->
    <div class="sec-header">
      <div class="sec-title-block">
        <i class="pi pi-share-alt" style="color:var(--p-primary-color)"></i>
        <span class="sec-title">Сценарное прогнозирование</span>
        <span class="sec-subtitle">Цепочка событий развития стартапа · условия возникновения · обсуждение агентов</span>
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
        Нажмите «AI-генерация цепочки» — AI ИК сгенерирует сценарии развития стартапа
        как последовательность событий с условиями и вероятностями
      </div>
    </div>

    <!-- Лоадер генерации -->
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

      <!-- Горизонтальная лента событий -->
      <div class="sec-timeline">
        <div v-for="(node, i) in visibleNodes" :key="node.id"
          :class="['sec-node', `path-${node.path}`, { selected: selectedNode?.id === node.id, dimmed: activePath !== 'all' && node.path !== activePath && node.path !== 'all' }]"
          @click="selectNode(node)">

          <!-- Линия связи -->
          <div v-if="i < visibleNodes.length - 1" class="sec-connector">
            <div class="sec-connector-line"></div>
            <i class="pi pi-chevron-right sec-connector-arrow"></i>
          </div>

          <!-- Карточка события -->
          <div class="sec-node-card" :style="{ borderColor: pathColor(node.path) }">
            <div class="sec-node-top">
              <span class="sec-node-type-badge" :style="{ background: pathColor(node.path) + '22', color: pathColor(node.path) }">
                {{ node.phase || 'milestone' }}
              </span>
              <span class="sec-node-horizon">~{{ node.horizonMonths }}м</span>
            </div>
            <div class="sec-node-icon-wrap" :style="{ background: pathColor(node.path) + '18' }">
              <i :class="node.icon || 'pi pi-circle'" :style="{ color: pathColor(node.path) }"></i>
            </div>
            <div class="sec-node-label">{{ node.label }}</div>
            <div class="sec-node-prob">
              <div class="sec-prob-bar">
                <div class="sec-prob-fill" :style="{ width: node.probability + '%', background: probColor(node.probability) }"></div>
              </div>
              <span class="sec-prob-val" :style="{ color: probColor(node.probability) }">{{ node.probability }}%</span>
            </div>
            <!-- Условия (сколько выполнено) -->
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
          <span class="sec-detail-path-badge" :style="{ background: pathColor(selectedNode.path) + '22', color: pathColor(selectedNode.path) }">
            {{ pathLabel(selectedNode.path) }}
          </span>
          <button class="sec-close-btn" @click="selectedNode = null">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="sec-detail-body">
          <!-- Описание -->
          <div class="sec-detail-desc">{{ selectedNode.description }}</div>

          <!-- Мета -->
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

      <!-- Сводка по пути -->
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

// ── Константы ──────────────────────────────────────────────────────────────────

const PATHS = [
  { id: 'all',         label: 'Все пути',     color: '#64748b' },
  { id: 'optimistic',  label: 'Оптимист',      color: '#22c55e' },
  { id: 'base',        label: 'Базовый',       color: '#3b82f6' },
  { id: 'pessimistic', label: 'Риск-сценарий', color: '#ef4444' },
]

const AGENT_META = {
  tech:        { name: 'Техн. аналитик',  av: 'ТА', color: '#6366f1' },
  finance:     { name: 'Фин. аналитик',   av: 'ФА', color: '#3b82f6' },
  sovereignty: { name: 'Эксперт сувер.',  av: 'ЭС', color: '#f59e0b' },
  risk:        { name: 'Риск-менеджер',   av: 'РМ', color: '#ef4444' },
  portfolio:   { name: 'Стратег',         av: 'СТ', color: '#8b5cf6' },
  devil:       { name: 'Критик',          av: 'КР', color: '#64748b' },
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
  'Анализ проекта и отрасли...',
  'Построение событийной онтологии...',
  'Генерация оптимистичного пути...',
  'Генерация базового пути...',
  'Генерация пути рисков...',
  'Расчёт условий и вероятностей...',
]

// ── Props ──────────────────────────────────────────────────────────────────────
const props = defineProps({
  project:  { type: Object, default: () => ({}) },
  session:  { type: Object, default: () => ({}) },
  decision: { type: Object, default: null },
})

// ── State ──────────────────────────────────────────────────────────────────────
const chain       = ref([])
const activePath  = ref('all')
const selectedNode = ref(null)
const generating  = ref(false)
const discussing  = ref(false)
const error       = ref('')
const loadingStep = ref(0)
const loadSteps   = ref(LOAD_STEPS)

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

// ── Helpers ────────────────────────────────────────────────────────────────────
function pathColor(pid) {
  return PATHS.find(p => p.id === pid)?.color || '#64748b'
}
function pathLabel(pid) {
  return PATHS.find(p => p.id === pid)?.label || pid
}
function probColor(p) {
  return p >= 70 ? '#22c55e' : p >= 40 ? '#f59e0b' : '#ef4444'
}
function agentName(id)  { return AGENT_META[id]?.name  || id }
function agentAv(id)    { return AGENT_META[id]?.av    || '?' }
function agentColor(id) { return AGENT_META[id]?.color || '#64748b' }
function condTypeLabel(t) { return COND_TYPE_LABELS[t] || t || 'Условие' }
function stanceLabel(s) {
  return { SUPPORT: '✓ Поддерж.', NEUTRAL: '⊙ Нейтр.', CONCERN: '⚠ Риск', BLOCK: '✗ Блокир.' }[s] || s
}

// ── Выбор ноды ─────────────────────────────────────────────────────────────────
function selectNode(node) {
  selectedNode.value = selectedNode.value?.id === node.id ? null : node
}

// ── AI-генерация цепочки ───────────────────────────────────────────────────────
async function generateChain() {
  generating.value = true
  error.value = ''
  loadingStep.value = 0
  chain.value = []
  selectedNode.value = null

  // Имитация прогресса шагов
  const stepTimer = setInterval(() => {
    if (loadingStep.value < LOAD_STEPS.length - 1) loadingStep.value++
  }, 1800)

  try {
    const proj = props.project || {}
    const dec  = props.decision || {}

    const conditions = (dec.conditions || [])
      .map(c => typeof c === 'string' ? c : c.text || '')
      .filter(Boolean)
      .join('; ')

    const prompt = `Ты — AI-аналитик венчурного фонда. Построй цепочку событий-вех развития стартапа.

ПРОЕКТ:
- Название: ${proj.title || proj.name || proj.company || 'неизвестно'}
- Отрасль: ${proj.industry || proj.subfund || 'БПЛА / беспилотники'}
- TRL: ${proj.trl || '4-5'}
- Стадия: ${proj.stage || 'Pre-seed / Seed'}
- Сумма раунда: ${proj.askRub ? (proj.askRub / 1e6).toFixed(1) + ' млн ₽' : proj.askAmount || 'не указана'}
- Краткое описание: ${proj.description || proj.problem || ''}

УСЛОВИЯ ИК: ${conditions || 'не определены'}

ЗАДАЧА: сгенерируй 6-9 событий-вех как цепочку для трёх сценариев: оптимистичный, базовый, риск-сценарий.

Каждое событие — конкретный milestone стартапа (TRL-переход, пилот, сертификация, контракт, раунд, масштаб).
Каждое событие должно иметь:
- условия возникновения (что должно произойти ДО него)
- вероятность реализации (0-100%)
- горизонт (месяцев от текущего момента)
- финансовый импакт

Ответь СТРОГО в JSON (без markdown-блоков):
{
  "events": [
    {
      "id": "e1",
      "path": "all|optimistic|base|pessimistic",
      "label": "Короткое название события",
      "description": "Что именно происходит и почему это важно",
      "phase": "seed|pilot|growth|scale|exit",
      "icon": "pi pi-arrow-up-right",
      "horizonMonths": 6,
      "probability": 75,
      "conditions": [
        {
          "type": "precondition|trigger|financial|regulatory|tech|market",
          "text": "Текст условия",
          "threshold": null,
          "unit": null
        }
      ],
      "impact": {
        "revenue": "+30%",
        "valuation": "+2x",
        "trl": "+2"
      }
    }
  ]
}

Требования:
- path="all" — событие присутствует во всех сценариях (например PROJECT_START)
- path="optimistic" — только в лучшем сценарии
- path="base" — в базовом, но не обязательно в оптимистичном
- path="pessimistic" — негативный исход / риск-событие
- Суммарно 6-9 событий, охватывающих все три пути
- Условия должны ссылаться на предыдущие события ("После завершения пилота", "При TRL ≥ 7")
- Вероятности реалистичные для венчурного проекта (не все 80%+)
- Иконки ТОЛЬКО из PrimeVue: pi pi-arrow-up-right, pi pi-play, pi pi-check, pi pi-file-edit, pi pi-wallet, pi pi-expand, pi pi-shield, pi pi-star, pi pi-users, pi pi-chart-line, pi pi-exclamation-triangle`

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

    if (!data.events?.length) throw new Error('Пустая цепочка от модели')

    chain.value = data.events.map((e, i) => ({
      ...e,
      id:          e.id || `e${i}`,
      path:        e.path || 'base',
      probability: e.probability ?? 60,
      horizonMonths: e.horizonMonths ?? (i + 1) * 3,
      conditions:  e.conditions || [],
      agentVotes:  [],
    }))

    // Выбираем первый узел по умолчанию
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

    const prompt = `Ты симулятор инвесткомитета. Верни мнение ВСЕХ шести агентов ИК по конкретному событию-вехе стартапа.

ПРОЕКТ: ${proj.title || proj.name || 'стартап'}, отрасль: ${proj.industry || 'БПЛА'}

СОБЫТИЕ: «${node.label}»
Описание: ${node.description}
Горизонт: ${node.horizonMonths} месяцев
Текущая вероятность: ${node.probability}%
Условия возникновения:
${condText}

Каждый агент должен:
1. Оценить реалистичность условий
2. Назвать главный риск или фактор успеха
3. Скорректировать вероятность события (свою оценку %)

Агенты:
- tech (технический аналитик)
- finance (финансовый аналитик)
- sovereignty (эксперт по суверенитету / регуляторике)
- risk (риск-менеджер)
- portfolio (портфельный стратег)
- devil (критик / адвокат дьявола)

Ответь ТОЛЬКО в JSON:
{
  "votes": [
    {
      "agentId": "tech",
      "stance": "SUPPORT|NEUTRAL|CONCERN|BLOCK",
      "probEstimate": 70,
      "comment": "Краткий профессиональный комментарий (2-3 предложения)"
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
      // Мутируем прямо в chain чтобы Vue обновил
      const idx = chain.value.findIndex(n => n.id === node.id)
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
.sec-path-tabs {
  display: flex;
  gap: 4px;
}
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
.sec-path-btn.active {
  font-weight: 600;
  background: var(--p-surface-ground);
}
.sec-path-btn:hover:not(.active) { background: var(--p-surface-ground); }

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
.sec-empty-text { font-size: 0.8rem; max-width: 400px; line-height: 1.5; }

/* Loading */
.sec-loading {
  padding: 16px;
  display: flex;
  justify-content: center;
}
.sec-loading-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sec-loading-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  transition: color 0.3s;
}
.sec-loading-step.active { color: var(--p-primary-color); font-weight: 600; }
.sec-loading-step.done   { color: #22c55e; }

/* Chain area */
.sec-chain-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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
.sec-connector-line {
  height: 1px;
  width: 100%;
  background: var(--p-content-border-color);
}
.sec-connector-arrow {
  position: absolute;
  right: -4px;
  font-size: 0.55rem;
  color: var(--p-text-muted-color);
}

/* Node card */
.sec-node-card {
  width: 140px;
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
.sec-node-card:hover { background: var(--p-surface-ground); }

.sec-node-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sec-node-type-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 4px;
  padding: 1px 5px;
}
.sec-node-horizon {
  font-size: 0.62rem;
  color: var(--p-text-muted-color);
}

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
.sec-prob-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s;
}
.sec-node-prob {
  display: flex;
  align-items: center;
  gap: 5px;
}
.sec-node-prob .sec-prob-bar { flex: 1; }
.sec-prob-val {
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
}

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
  background: var(--p-surface-ground);
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
.sec-close-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 2px 4px;
}
.sec-close-btn:hover { color: var(--p-text-color); }

.sec-detail-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.sec-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sec-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 80px;
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
.sec-cond-left {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
}
.sec-cond-type {
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
  text-transform: uppercase;
}
.cond-precondition { background: #6366f122; color: #6366f1; }
.cond-trigger      { background: #f59e0b22; color: #f59e0b; }
.cond-financial    { background: #22c55e22; color: #22c55e; }
.cond-regulatory   { background: #8b5cf622; color: #8b5cf6; }
.cond-tech         { background: #3b82f622; color: #3b82f6; }
.cond-market       { background: #ec489922; color: #ec4899; }
.cond-milestone    { background: #0ea5e922; color: #0ea5e9; }

.sec-cond-text {
  font-size: 0.75rem;
  color: var(--p-text-color);
  line-height: 1.4;
}
.sec-cond-threshold {
  font-size: 0.72rem;
  color: var(--p-primary-color);
  font-weight: 600;
  flex-shrink: 0;
}

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
.sec-discuss-btn:hover:not(:disabled) { background: var(--p-surface-ground); }

.sec-agent-votes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
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
.sec-agent-vote.stance-support { border-left-color: #22c55e; }
.sec-agent-vote.stance-neutral  { border-left-color: #64748b; }
.sec-agent-vote.stance-concern  { border-left-color: #f59e0b; }
.sec-agent-vote.stance-block    { border-left-color: #ef4444; }

.sec-av-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
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
.sec-av-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-color);
  flex: 1;
}
.sec-av-stance {
  font-size: 0.65rem;
  border-radius: 4px;
  padding: 1px 6px;
}
.stance-badge-support { background: #22c55e22; color: #22c55e; }
.stance-badge-neutral  { background: #64748b22; color: #64748b; }
.stance-badge-concern  { background: #f59e0b22; color: #f59e0b; }
.stance-badge-block    { background: #ef535022; color: #ef5350; }

.sec-av-prob {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.sec-av-comment {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  line-height: 1.45;
}

/* Path summary */
.sec-path-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
}
.sec-path-stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
}
.sec-ps-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sec-ps-label { font-weight: 600; color: var(--p-text-color); }
.sec-ps-nodes { color: var(--p-text-color); }
.sec-ps-avg   { color: var(--p-text-muted-color); }

/* Error */
.sec-error {
  font-size: 0.78rem;
  color: #ef5350;
  background: #ef535011;
  border: 1px solid #ef535033;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>

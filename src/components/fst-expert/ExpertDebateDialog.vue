<template>
  <Dialog v-model:visible="visible" modal :closable="!running"
    header="Инвесткомитет — Challenger Debate"
    style="width: 760px; max-width: 98vw; max-height: 90vh"
    :pt="{ content: { style: 'padding: 0; overflow: hidden;' } }">

    <!-- Setup screen -->
    <div v-if="!started && !running" class="db-setup">

      <!-- Expert selectors -->
      <div class="db-setup-experts">
        <div class="db-setup-expert">
          <div class="db-setup-label">Эксперт A (тезис)</div>
          <div v-for="e in EXPERTS" :key="e.id"
            :class="['db-expert-option', { active: form.expertAId === e.id }]"
            @click="form.expertAId = e.id">
            <span class="db-expert-av">{{ e.avatar }}</span>
            <div>
              <div class="db-expert-name">{{ e.name }}</div>
              <div class="db-expert-title">{{ e.title }}</div>
            </div>
          </div>
        </div>

        <div class="db-setup-vs">
          <i class="pi pi-arrows-h" style="font-size:18px; color:var(--p-text-muted-color)"></i>
          <span>vs</span>
        </div>

        <div class="db-setup-expert">
          <div class="db-setup-label">Эксперт B (challenger)</div>
          <div v-for="e in EXPERTS" :key="e.id"
            :class="['db-expert-option', { active: form.expertBId === e.id, disabled: form.expertAId === e.id }]"
            @click="form.expertAId !== e.id && (form.expertBId = e.id)">
            <span class="db-expert-av">{{ e.avatar }}</span>
            <div>
              <div class="db-expert-name">{{ e.name }}</div>
              <div class="db-expert-title">{{ e.title }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Deal context input -->
      <div class="db-setup-deal">
        <div class="db-setup-label">Контекст сделки</div>
        <textarea v-model="form.dealContext" class="db-deal-input"
          placeholder="Вставьте данные о стартапе: название, рынок, TRL, запрос финансирования, команда..."
          rows="4" />
      </div>

      <div class="db-setup-footer">
        <span class="db-setup-hint">
          <i class="pi pi-info-circle"></i>
          5 раундов · Модель BlackRock challenger · ~60 сек
        </span>
        <Button label="Начать дебаты" icon="pi pi-play"
          :disabled="form.expertAId === form.expertBId"
          @click="startDebate" />
      </div>
    </div>

    <!-- Debate arena -->
    <div v-else class="db-arena" ref="arenaRef">

      <!-- Header strip: two experts -->
      <div v-if="meta.expertA" class="db-header">
        <div class="db-header-expert" :style="{ borderColor: meta.expertA.color }">
          <span class="db-av">{{ meta.expertA.avatar }}</span>
          <div>
            <div class="db-hname">{{ meta.expertA.name }}</div>
            <div class="db-htitle">{{ meta.expertA.title }}</div>
          </div>
        </div>
        <div class="db-header-center">
          <i class="pi pi-bolt" style="color:var(--fst-brand)"></i>
          <span>Challenger Debate</span>
        </div>
        <div class="db-header-expert right" :style="{ borderColor: meta.expertB?.color }">
          <div style="text-align:right">
            <div class="db-hname">{{ meta.expertB?.name }}</div>
            <div class="db-htitle">{{ meta.expertB?.title }}</div>
          </div>
          <span class="db-av">{{ meta.expertB?.avatar }}</span>
        </div>
      </div>

      <!-- Speech timeline -->
      <div class="db-timeline" ref="timelineRef">

        <!-- Speech bubble -->
        <div v-for="(speech, i) in speeches" :key="i"
          :class="['db-speech', speech.side, speech.step]">

          <!-- Round badge -->
          <div v-if="speech.round" class="db-round-badge">Раунд {{ speech.round }}</div>

          <div class="db-speech-inner">
            <div class="db-speech-av" :style="{ background: speech.color + '22', borderColor: speech.color }">
              {{ speech.avatar }}
            </div>
            <div class="db-speech-body">
              <div class="db-speech-meta">
                <span class="db-speech-name" :style="{ color: speech.color }">{{ speech.name }}</span>
                <span :class="['db-event-tag', speech.eventTag]">
                  <i :class="eventTagIcon(speech.eventType)"></i>
                  {{ eventTagLabel(speech.eventType) }}
                </span>
              </div>
              <div class="db-speech-text">{{ speech.text }}</div>
            </div>
          </div>
        </div>

        <!-- Thinking indicator -->
        <div v-if="thinking" class="db-thinking">
          <div class="db-thinking-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="db-thinking-label">
            <span v-if="thinking.expertId === 'synthesis'">Председатель</span>
            <span v-else>{{ meta[thinking.expertId === form.expertAId ? 'expertA' : 'expertB']?.name }}</span>
            — {{ thinking.label }}
          </span>
        </div>

        <!-- Synthesis card -->
        <div v-if="synthesis" class="db-synthesis">
          <div class="db-synthesis-header">
            <i class="pi pi-gavel"></i>
            Решение инвесткомитета
          </div>

          <div class="db-synthesis-verdict">
            <span :class="['db-verdict-badge', synthesis.decision?.toLowerCase()]">
              {{ synthesis.decision }}
            </span>
            <div class="db-verdict-scores">
              <div class="db-score-item">
                <span class="db-score-val">{{ Math.round((synthesis.confidence || 0) * 100) }}%</span>
                <span class="db-score-lbl">уверенность</span>
              </div>
              <div class="db-score-sep"></div>
              <div class="db-score-item">
                <i :class="synthesis.consensus ? 'pi pi-check-circle' : 'pi pi-times-circle'"
                   :style="{ color: synthesis.consensus ? 'var(--fst-green)' : 'var(--fst-brand)' }"></i>
                <span class="db-score-lbl">{{ synthesis.consensus ? 'консенсус' : 'расхождение' }}</span>
              </div>
              <div class="db-score-sep"></div>
              <div class="db-score-item">
                <span class="db-score-val">{{ Math.round((synthesis.consensusScore || 0) * 100) }}%</span>
                <span class="db-score-lbl">совпадение</span>
              </div>
            </div>
          </div>

          <div v-if="synthesis.keyInsight" class="db-synthesis-insight">
            <i class="pi pi-lightbulb" style="color:var(--fst-brand)"></i>
            {{ synthesis.keyInsight }}
          </div>

          <p class="db-synthesis-summary">{{ synthesis.summary }}</p>

          <div v-if="synthesis.conditions?.length" class="db-synthesis-conditions">
            <div class="db-cond-label">Условия:</div>
            <div v-for="(c, ci) in synthesis.conditions" :key="ci" class="db-cond-item">
              <i class="pi pi-check" style="font-size:10px; color:var(--fst-blue)"></i>
              {{ c }}
            </div>
          </div>
        </div>

      </div><!-- /db-timeline -->

      <!-- Footer -->
      <div class="db-footer">
        <div v-if="running" class="db-progress">
          <div class="db-progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="db-footer-actions">
          <span v-if="running" class="db-status-text">
            <i class="pi pi-spin pi-spinner" style="font-size:11px"></i>
            Дебаты идут...
          </span>
          <span v-else-if="synthesis" class="db-status-text done">
            <i class="pi pi-check-circle"></i>
            Завершено
          </span>
          <template v-if="!running">
            <Button v-if="synthesis" label="Новые дебаты" severity="secondary" size="small"
              icon="pi pi-refresh" @click="reset" />
            <Button label="Закрыть" size="small" @click="visible = false" />
          </template>
        </div>
      </div>

    </div>

  </Dialog>
</template>

<script setup>
import { ref, reactive, nextTick, computed, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = defineProps({
  modelValue: Boolean,
  initialDealContext: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

// ── Expert catalog — загружается из /api/expert/registry (Integram DB) ──
const EXPERTS = ref([
  { id: 'gordin',   name: 'Дионис Гордин',   title: 'Инв. директор ФСТ НТИ', avatar: '👔', color: 'var(--fst-purple)' },
  { id: 'medvedev', name: 'Вадим Медведев',   title: 'Ген. директор Фонда НТИ', avatar: '🏛️', color: 'var(--fst-brand)' },
  { id: 'babincev', name: 'Глеб Бабинцев',    title: 'Ген. директор Аэронекст НТИ', avatar: '✈️', color: 'var(--fst-blue)' },
])

onMounted(async () => {
  try {
    const r = await fetch('/api/expert/registry')
    if (r.ok) {
      const { experts } = await r.json()
      if (experts?.length) EXPERTS.value = experts
    }
  } catch { /* fallback to defaults */ }
})

// ── Form ──────────────────────────────────────────────────────
const form = reactive({
  expertAId:   'gordin',
  expertBId:   'babincev',
  dealContext: props.initialDealContext,
})

// ── State ─────────────────────────────────────────────────────
const started     = ref(false)
const running     = ref(false)
const speeches    = ref([])
const thinking    = ref(null)
const synthesis   = ref(null)
const meta        = reactive({ expertA: null, expertB: null })
const progressPct = ref(0)
const arenaRef    = ref(null)
const timelineRef = ref(null)

// Progress map: step → %
const STEP_PROGRESS = {
  start: 5, thinking: null,
  thesis_a: 20, challenge_b: 40,
  rebuttal_a: 60, position_b: 78,
  synthesis: 92, done: 100,
}

// ── Event tags ────────────────────────────────────────────────
function eventTagLabel(type) {
  const m = {
    'EXPERT_ARGUMENT_RAISED': 'Тезис',
    'ARGUMENT_CHALLENGED':    'Оппозиция',
    'EXPERT_EVALUATED':       'Позиция',
    'DECISION_MADE':          'Решение',
  }
  return m[type] || type
}
function eventTagIcon(type) {
  const m = {
    'EXPERT_ARGUMENT_RAISED': 'pi pi-comment',
    'ARGUMENT_CHALLENGED':    'pi pi-bolt',
    'EXPERT_EVALUATED':       'pi pi-verified',
    'DECISION_MADE':          'pi pi-gavel',
  }
  return m[type] || 'pi pi-circle'
}

// ── Scroll to bottom ──────────────────────────────────────────
async function scrollBottom() {
  await nextTick()
  if (timelineRef.value) timelineRef.value.scrollTop = timelineRef.value.scrollHeight
}

// ── Start debate ──────────────────────────────────────────────
async function startDebate() {
  started.value  = true
  running.value  = true
  speeches.value = []
  thinking.value = null
  synthesis.value = null
  progressPct.value = 5

  const body = {
    expertAId: form.expertAId,
    expertBId: form.expertBId,
    dealData:  form.dealContext ? { description: form.dealContext } : null,
  }

  try {
    const resp = await fetch('/api/expert/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(line.slice(6))
          handleEvent(evt)
        } catch {}
      }
    }
  } catch (err) {
    speeches.value.push({ side: 'center', step: 'error', text: `Ошибка: ${err.message}`, name: 'Система' })
  } finally {
    running.value  = false
    thinking.value = null
    progressPct.value = 100
  }
}

// ── Handle SSE event ──────────────────────────────────────────
function handleEvent(evt) {
  const p = STEP_PROGRESS[evt.step]
  if (p != null) progressPct.value = p

  if (evt.step === 'start') {
    meta.expertA = evt.expertA
    meta.expertB = evt.expertB
    return
  }

  if (evt.step === 'thinking') {
    thinking.value = evt
    scrollBottom()
    return
  }

  if (evt.step === 'done') {
    thinking.value = null
    return
  }

  if (evt.step === 'error') {
    thinking.value = null
    speeches.value.push({ side: 'center', step: 'error', text: evt.error, name: 'Система' })
    scrollBottom()
    return
  }

  if (evt.step === 'synthesis') {
    thinking.value = null
    synthesis.value = evt
    scrollBottom()
    return
  }

  // Speech bubble
  const isA = evt.expertId === form.expertAId
  thinking.value = null
  speeches.value.push({
    side:      isA ? 'left' : 'right',
    step:      evt.step,
    expertId:  evt.expertId,
    name:      evt.name,
    avatar:    evt.avatar,
    color:     evt.color,
    title:     evt.title,
    text:      evt.text,
    eventType: evt.eventType,
    eventTag:  evt.eventType?.toLowerCase().replace(/_/g, '-') || '',
    round:     evt.round || null,
  })
  scrollBottom()
}

// ── Reset ─────────────────────────────────────────────────────
function reset() {
  started.value   = false
  speeches.value  = []
  thinking.value  = null
  synthesis.value = null
  meta.expertA    = null
  meta.expertB    = null
  progressPct.value = 0
}
</script>

<style scoped>
/* ── Setup ─────────────────────────────────────────────────── */
.db-setup {
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.db-setup-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--p-text-muted-color); margin-bottom: 8px;
}
.db-setup-experts {
  display: flex; gap: 12px; align-items: flex-start;
}
.db-setup-expert { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.db-setup-vs {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding-top: 28px; color: var(--p-text-muted-color); font-size: 11px;
  font-weight: 700; min-width: 32px;
}
.db-expert-option {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  cursor: pointer; transition: all 0.15s;
  &:hover { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 6%, transparent); }
  &.active { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 10%, transparent); }
  &.disabled { opacity: 0.4; pointer-events: none; }
}
.db-expert-av { font-size: 20px; }
.db-expert-name { font-size: 12px; font-weight: 600; }
.db-expert-title { font-size: 10px; color: var(--p-text-muted-color); }

.db-deal-input {
  width: 100%; resize: vertical;
  background: var(--p-surface-card); color: var(--p-text-color);
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 10px; font-size: 13px; font-family: inherit;
  &:focus { outline: none; border-color: var(--p-primary-color); }
}
.db-setup-footer {
  display: flex; align-items: center; justify-content: space-between;
}
.db-setup-hint {
  font-size: 11px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 5px;
}

/* ── Arena ──────────────────────────────────────────────────── */
.db-arena {
  display: flex; flex-direction: column; height: 72vh; min-height: 400px;
}

.db-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card); flex-shrink: 0;
}
.db-header-expert {
  display: flex; align-items: center; gap: 10px;
  border-left: 3px solid; padding-left: 10px;
  &.right { border-left: none; border-right: 3px solid; padding-left: 0; padding-right: 10px; }
}
.db-av        { font-size: 22px; }
.db-hname     { font-size: 12px; font-weight: 700; }
.db-htitle    { font-size: 10px; color: var(--p-text-muted-color); }
.db-header-center {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; color: var(--p-text-muted-color);
}

/* ── Timeline ───────────────────────────────────────────────── */
.db-timeline {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 16px;
}

.db-round-badge {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: var(--p-text-muted-color);
  text-align: center; margin-bottom: -8px;
  &::before, &::after { content: '  ——  '; }
}

.db-speech { display: flex; flex-direction: column; }
.db-speech.left  .db-speech-inner { flex-direction: row; }
.db-speech.right .db-speech-inner { flex-direction: row-reverse; }

.db-speech-inner { display: flex; gap: 10px; align-items: flex-start; }

.db-speech-av {
  width: 36px; height: 36px; border-radius: 50%; border: 2px solid;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}

.db-speech-body {
  max-width: 78%; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color); border-radius: 12px;
  padding: 10px 14px;
  .db-speech.left  & { border-top-left-radius: 2px; }
  .db-speech.right & { border-top-right-radius: 2px; }
  .db-speech.challenge_b & { border-color: color-mix(in srgb, var(--fst-brand) 40%, transparent); }
  .db-speech.rebuttal_a  & { border-color: color-mix(in srgb, var(--fst-blue) 40%, transparent); }
}

.db-speech-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.db-speech-name { font-size: 11px; font-weight: 700; }

.db-event-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 10px;
  display: flex; align-items: center; gap: 3px;
  background: color-mix(in srgb, var(--p-text-color) 8%, transparent);
  color: var(--p-text-muted-color);
}

.db-speech-text {
  font-size: 13px; line-height: 1.55; color: var(--p-text-color);
}

/* ── Thinking ───────────────────────────────────────────────── */
.db-thinking {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; color: var(--p-text-muted-color); font-size: 12px;
}
.db-thinking-dots {
  display: flex; gap: 4px;
  span {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--p-text-muted-color); animation: db-bounce 1.2s infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}
@keyframes db-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1;   }
}

/* ── Synthesis card ─────────────────────────────────────────── */
.db-synthesis {
  background: color-mix(in srgb, var(--p-surface-card) 80%, transparent);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 16px; margin-top: 4px;
}
.db-synthesis-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--p-text-muted-color); margin-bottom: 12px;
}
.db-synthesis-verdict { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }

.db-verdict-badge {
  font-size: 16px; font-weight: 800; padding: 6px 16px; border-radius: 8px;
  &.одобрить { color: var(--fst-green);  background: color-mix(in srgb, var(--fst-green)  14%, transparent); border: 1px solid color-mix(in srgb, var(--fst-green)  35%, transparent); }
  &.отложить  { color: var(--fst-brand);  background: color-mix(in srgb, var(--fst-brand)  14%, transparent); border: 1px solid color-mix(in srgb, var(--fst-brand)  35%, transparent); }
  &.отклонить { color: var(--fst-red);    background: color-mix(in srgb, var(--fst-red)    14%, transparent); border: 1px solid color-mix(in srgb, var(--fst-red)    35%, transparent); }
}

.db-verdict-scores { display: flex; align-items: center; gap: 10px; }
.db-score-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.db-score-val  { font-size: 15px; font-weight: 700; }
.db-score-lbl  { font-size: 9px; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.4px; }
.db-score-sep  { width: 1px; height: 28px; background: var(--p-content-border-color); }

.db-synthesis-insight {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; font-style: italic; color: var(--p-text-muted-color);
  background: color-mix(in srgb, var(--fst-brand) 6%, transparent);
  border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;
}
.db-synthesis-summary { font-size: 13px; line-height: 1.55; margin: 0 0 10px; }

.db-synthesis-conditions { display: flex; flex-direction: column; gap: 4px; }
.db-cond-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--p-text-muted-color); margin-bottom: 2px; }
.db-cond-item  { display: flex; align-items: center; gap: 6px; font-size: 12px; }

/* ── Footer ─────────────────────────────────────────────────── */
.db-footer { flex-shrink: 0; border-top: 1px solid var(--p-content-border-color); }
.db-progress { height: 2px; background: color-mix(in srgb, var(--p-text-color) 10%, transparent); }
.db-progress-fill { height: 100%; background: var(--p-primary-color); transition: width 0.6s ease; }
.db-footer-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 10px 16px;
}
.db-status-text {
  font-size: 12px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 5px;
  margin-right: auto;
  &.done { color: var(--fst-green); }
}
</style>

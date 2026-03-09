<template>
  <FstPageLayout title="Стартапер" subtitle="AI-агент первого касания — от документа к инвесткомитету" icon="pi pi-rocket">
    <template #actions>
      <Button v-if="sessionId && twin.completeness >= 80" label="Передать в ИК" icon="pi pi-send"
        severity="success" size="small" @click="sendToIC" />
      <Button v-if="sessionId && twin.completeness > 0" label="Сохранить" icon="pi pi-save"
        severity="secondary" size="small" :loading="saving" @click="saveSession" />
    </template>

    <!-- Onboarding (no session yet) -->
    <div v-if="!sessionId" class="stp-onboard">
      <div class="stp-onboard-icon">🚀</div>
      <h2>Добро пожаловать в ФСТ НТИ</h2>
      <p>Загрузите описание вашего проекта или начните диалог с агентом фонда</p>
      <div class="stp-onboard-actions">
        <Button label="Начать диалог" icon="pi pi-comments" size="large" @click="startSession" />
        <span class="stp-or">или</span>
        <label class="stp-upload-btn">
          <i class="pi pi-upload"></i> Загрузить документ
          <input type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.json" @change="onFileUpload" />
        </label>
      </div>
      <p class="stp-formats">PDF · DOCX · XLSX · TXT · MD · JSON</p>
    </div>

    <!-- Main 3-panel layout -->
    <div v-else class="stp-layout">

      <!-- LEFT: Chat -->
      <div class="stp-panel stp-chat-panel">
        <div class="stp-panel-header">
          <i class="pi pi-comments"></i> Диалог с агентом
          <span class="stp-completeness-badge" :class="completenessClass">{{ twin.completeness }}% готово</span>
        </div>

        <!-- Messages -->
        <div class="stp-messages" ref="messagesEl">
          <div v-for="(msg, i) in messages" :key="i"
            :class="['stp-msg', msg.role === 'user' ? 'stp-msg--user' : 'stp-msg--agent']">
            <div class="stp-msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
            <div class="stp-msg-bubble" v-html="renderMarkdown(msg.content)"></div>
          </div>
          <div v-if="thinking" class="stp-msg stp-msg--agent">
            <div class="stp-msg-avatar">🤖</div>
            <div class="stp-msg-bubble stp-thinking">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="stp-input-row">
          <label class="stp-attach-btn" title="Прикрепить документ">
            <i class="pi pi-paperclip"></i>
            <input type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.json" @change="onFileUpload" />
          </label>
          <Textarea v-model="inputText" placeholder="Напишите о вашем проекте..." autoResize rows="1"
            class="stp-textarea" @keydown.enter.exact.prevent="sendMessage" />
          <Button icon="pi pi-send" :loading="thinking" :disabled="!inputText.trim()"
            @click="sendMessage" class="stp-send-btn" />
        </div>
      </div>

      <!-- CENTER: Digital Twin -->
      <div class="stp-panel stp-twin-panel">
        <div class="stp-panel-header"><i class="pi pi-sitemap"></i> Цифровой двойник</div>

        <!-- Completeness ring -->
        <div class="stp-completeness-ring">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" class="stp-ring-bg"/>
            <circle cx="40" cy="40" r="34" class="stp-ring-fill"
              :stroke-dasharray="`${twin.completeness * 2.136} 213.6`"/>
          </svg>
          <div class="stp-ring-label">{{ twin.completeness }}%</div>
        </div>

        <!-- Fields grid -->
        <div class="stp-twin-grid">
          <div class="stp-twin-field" v-for="f in twinFields" :key="f.key">
            <span class="stp-twin-label">{{ f.label }}</span>
            <span class="stp-twin-val" :class="{ 'stp-empty': !getTwinVal(f) }">
              {{ getTwinVal(f) || '—' }}
            </span>
          </div>
        </div>

        <!-- Metrics History sparkline placeholder -->
        <div v-if="twin.metricsHistory" class="stp-metrics-hint">
          <i class="pi pi-chart-line"></i> История метрик загружена
        </div>
      </div>

      <!-- RIGHT: Psycho + Beacons -->
      <div class="stp-panel stp-insights-panel">

        <!-- Psycho Profile -->
        <div class="stp-panel-header"><i class="pi pi-brain"></i> Профиль фаундера</div>
        <div v-if="!psychoProfile" class="stp-empty-hint">
          <i class="pi pi-info-circle"></i> Появится после 5 ответов
        </div>
        <div v-else class="stp-psycho">
          <div class="stp-mbti">{{ psychoProfile.mbti || '???' }}</div>
          <div class="stp-signals">
            <div v-for="(val, key) in psychoProfile.signals" :key="key" class="stp-signal-row">
              <span class="stp-signal-label">{{ SIGNAL_LABELS[key] }}</span>
              <div class="stp-signal-bar">
                <div class="stp-signal-fill" :style="{ width: (val * 10) + '%', background: signalColor(val) }"></div>
              </div>
              <span class="stp-signal-val">{{ val }}/10</span>
            </div>
          </div>
          <div v-if="psychoProfile.redFlags?.length" class="stp-flags">
            <div v-for="f in psychoProfile.redFlags" :key="f" class="stp-flag stp-flag--red">🚩 {{ f }}</div>
          </div>
          <div v-if="psychoProfile.greenSignals?.length" class="stp-flags">
            <div v-for="g in psychoProfile.greenSignals" :key="g" class="stp-flag stp-flag--green">✅ {{ g }}</div>
          </div>
          <div v-if="psychoProfile.summary" class="stp-psycho-summary">{{ psychoProfile.summary }}</div>
          <div class="stp-confidence">Уверенность: {{ Math.round((psychoProfile.confidence || 0) * 100) }}%</div>
        </div>

        <!-- Beacons / Anomalies -->
        <div class="stp-panel-header stp-panel-header--mt"><i class="pi pi-flag"></i> Маяки для ИК</div>
        <div v-if="!beacons.length" class="stp-empty-hint">
          <i class="pi pi-check-circle"></i> Аномалий не выявлено
        </div>
        <div v-for="b in beacons" :key="b.text" :class="['stp-beacon', 'stp-beacon--' + b.severity]">
          <div class="stp-beacon-header">
            <span class="stp-beacon-type">{{ BEACON_TYPE_ICONS[b.type] }} {{ b.type }}</span>
            <span :class="['stp-beacon-sev', 'stp-sev--' + b.severity]">
              {{ b.severity === 'high' ? 'Высокий' : b.severity === 'medium' ? 'Средний' : 'Низкий' }}
            </span>
          </div>
          <div class="stp-beacon-text">{{ b.text }}</div>
          <div v-if="b.recommendation" class="stp-beacon-rec">💡 {{ b.recommendation }}</div>
        </div>

        <!-- FinModel helper -->
        <div class="stp-panel-header stp-panel-header--mt"><i class="pi pi-calculator"></i> Финмодель</div>
        <div v-if="!finModelOpen" class="stp-finmodel-btn-wrap">
          <Button label="Помочь с финмоделью" icon="pi pi-calculator" severity="secondary" size="small"
            style="width:100%" @click="openFinModel" />
        </div>
        <div v-else class="stp-finmodel">
          <div v-if="finModelReply" class="stp-finmodel-result" v-html="renderMarkdown(finModelReply)"></div>
          <div v-else class="stp-empty-hint"><i class="pi pi-spin pi-spinner"></i> Формирую финдопущения...</div>
        </div>
      </div>

    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'

const API = '/api/startuper'

// ── State ──────────────────────────────────────────────────────
const sessionId   = ref(null)
const messages    = ref([])
const twin        = ref({
  completeness: 0, company: null, inn: null, description: null,
  trl: null, mrl: null, teamSize: null, stage: null, askRub: null, marketSize: null,
  projectedIRR: null, competitors: [], founderName: null, founderBio: null,
  revenue: null, burnRate: null, runway: null, sector: null, metricsHistory: null
})
const beacons        = ref([])
const psychoProfile  = ref(null)
const inputText      = ref('')
const thinking       = ref(false)
const saving         = ref(false)
const messagesEl     = ref(null)
const finModelOpen   = ref(false)
const finModelReply  = ref('')

// ── Constants ─────────────────────────────────────────────────
const SIGNAL_LABELS = {
  concreteness: 'Конкретность',
  resilience:   'Стрессоустойчивость',
  honesty:      'Честность',
  expertise:    'Экспертиза',
  trackRecord:  'Трек-рекорд',
}
const BEACON_TYPE_ICONS = { RISK: '⚠️', OPPORTUNITY: '💡', QUESTION: '❓', CONDITION: '📋' }

const twinFields = [
  { key: 'company',      label: 'Компания' },
  { key: 'inn',          label: 'ИНН' },
  { key: 'stage',        label: 'Стадия' },
  { key: 'trl',          label: 'TRL' },
  { key: 'teamSize',     label: 'Команда' },
  { key: 'sector',       label: 'Сектор' },
  { key: 'askRub',       label: 'Запрос',  format: v => v ? (v / 1e6).toFixed(1) + 'M₽' : null },
  { key: 'marketSize',   label: 'TAM',     format: v => v ? (v / 1e9).toFixed(1) + 'B₽' : null },
  { key: 'projectedIRR', label: 'IRR',     format: v => v ? (v * 100).toFixed(0) + '%' : null },
  { key: 'runway',       label: 'Runway',  format: v => v ? v + ' мес' : null },
  { key: 'founderName',  label: 'Фаундер' },
  { key: 'revenue',      label: 'Выручка' },
]

// ── Computed ──────────────────────────────────────────────────
const completenessClass = computed(() => {
  const c = twin.value.completeness
  if (c >= 80) return 'stp-complete--high'
  if (c >= 50) return 'stp-complete--med'
  return 'stp-complete--low'
})

// ── Helpers ───────────────────────────────────────────────────
function getTwinVal(f) {
  const v = twin.value[f.key]
  if (v === null || v === undefined || v === '') return null
  if (Array.isArray(v)) return v.length ? v.join(', ') : null
  if (f.format) return f.format(v)
  return String(v)
}

function signalColor(val) {
  if (val >= 7) return 'var(--p-green-500, #4caf50)'
  if (val >= 4) return 'var(--p-orange-500, #ff9800)'
  return 'var(--p-red-500, #ef5350)'
}

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

// ── Actions ───────────────────────────────────────────────────
async function startSession() {
  try {
    const r = await fetch(`${API}/session`, { method: 'POST' })
    const d = await r.json()
    sessionId.value = d.sessionId
  } catch {
    sessionId.value = `local-${Date.now()}`
  }
  messages.value.push({
    role: 'assistant',
    content: '👋 Добро пожаловать в ФСТ НТИ!\n\nЯ помогу подготовить вашу заявку для инвесткомитета. Расскажите о вашем проекте — что вы создаёте и какую проблему решаете?\n\nИли сразу загрузите документ (питч-дек, описание, финмодель) — я разберу его автоматически.',
    timestamp: Date.now()
  })
}

async function sendMessage() {
  const msg = inputText.value.trim()
  if (!msg || thinking.value) return
  if (!sessionId.value) await startSession()

  messages.value.push({ role: 'user', content: msg, timestamp: Date.now() })
  inputText.value = ''
  thinking.value = true
  scrollToBottom()

  try {
    const r = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, message: msg })
    })
    const d = await r.json()

    if (d.twin)         Object.assign(twin.value, d.twin)
    if (d.beacons)      beacons.value = d.beacons
    if (d.psychoProfile) psychoProfile.value = d.psychoProfile
    if (d.messages)     messages.value = d.messages
    else if (d.reply)   messages.value.push({ role: 'assistant', content: d.reply, timestamp: Date.now() })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '⚠️ Ошибка соединения с агентом. Попробуйте ещё раз.', timestamp: Date.now() })
  }

  thinking.value = false
  scrollToBottom()
}

async function onFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!sessionId.value) await startSession()

  thinking.value = true
  messages.value.push({ role: 'user', content: `📎 Загружаю файл: ${file.name}`, timestamp: Date.now() })
  scrollToBottom()

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const r = await fetch(`${API}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, base64Data, mimeType: file.type, filename: file.name })
    })
    const d = await r.json()

    if (d.twin)      Object.assign(twin.value, d.twin)
    if (d.anomalies) beacons.value = d.anomalies
    if (d.messages)  messages.value = d.messages
    else if (d.reply) messages.value.push({ role: 'assistant', content: d.reply, timestamp: Date.now() })
  } catch {
    messages.value.push({ role: 'assistant', content: '⚠️ Не удалось разобрать файл. Попробуйте другой формат.', timestamp: Date.now() })
  }

  thinking.value = false
  scrollToBottom()
  e.target.value = ''
}

async function saveSession() {
  if (!sessionId.value) return
  saving.value = true
  await fetch(`${API}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId.value })
  }).catch(() => {})
  saving.value = false
}

async function sendToIC() {
  await saveSession()
  localStorage.setItem('startuper_twin', JSON.stringify(twin.value))
  localStorage.setItem('startuper_beacons', JSON.stringify(beacons.value))
  window.location.href = '/fst-committee'
}

async function openFinModel() {
  finModelOpen.value = true
  try {
    const r = await fetch(`${API}/finmodel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value })
    })
    const d = await r.json()
    finModelReply.value = d.reply || 'Не удалось сгенерировать финмодель'
  } catch {
    finModelReply.value = '⚠️ Ошибка при генерации финмодели'
  }
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────── */
.stp-onboard {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 60vh; text-align: center; gap: 16px;
}
.stp-onboard-icon { font-size: 4rem; }
.stp-onboard h2 { font-size: 1.5rem; color: var(--p-text-color); margin: 0; }
.stp-onboard p { color: var(--p-text-muted-color); margin: 0; }
.stp-onboard-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; }
.stp-or { color: var(--p-text-muted-color); font-size: 0.875rem; }
.stp-upload-btn {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 10px 20px; border-radius: 8px;
  border: 1px dashed var(--p-content-border-color);
  color: var(--p-primary-color); font-size: 0.875rem;
  transition: background 0.2s;
}
.stp-upload-btn:hover { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.stp-upload-btn input { display: none; }
.stp-formats { font-size: 0.75rem; color: var(--p-text-muted-color); }

.stp-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  height: calc(100vh - 120px);
  min-height: 600px;
}
@media (max-width: 900px) { .stp-layout { grid-template-columns: 1fr; height: auto; } }

.stp-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.stp-panel-header {
  padding: 10px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  border-bottom: 1px solid var(--p-content-border-color);
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.stp-panel-header--mt {
  margin-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
}
.stp-completeness-badge {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 700;
}
.stp-complete--high { background: color-mix(in srgb, #4caf50 15%, var(--p-surface-card)); color: #4caf50; }
.stp-complete--med  { background: color-mix(in srgb, #ff9800 15%, var(--p-surface-card)); color: #ff9800; }
.stp-complete--low  { background: color-mix(in srgb, #ef5350 15%, var(--p-surface-card)); color: #ef5350; }

/* ── Chat ───────────────────────────────────────── */
.stp-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stp-msg { display: flex; gap: 8px; align-items: flex-start; }
.stp-msg--user { flex-direction: row-reverse; }
.stp-msg-avatar { font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }
.stp-msg-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.5;
  word-break: break-word;
}
.stp-msg--agent .stp-msg-bubble {
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color);
  border-radius: 2px 12px 12px 12px;
  color: var(--p-text-color);
}
.stp-msg--user .stp-msg-bubble {
  background: var(--p-primary-color);
  color: #fff;
  border-radius: 12px 2px 12px 12px;
}
.stp-thinking { display: flex; gap: 4px; align-items: center; min-width: 48px; }
.stp-thinking span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--p-primary-color); animation: blink 1.4s infinite;
}
.stp-thinking span:nth-child(2) { animation-delay: 0.2s; }
.stp-thinking span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }

.stp-input-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--p-content-border-color);
  align-items: flex-end;
  flex-shrink: 0;
}
.stp-attach-btn { cursor: pointer; color: var(--p-text-muted-color); padding: 8px; }
.stp-attach-btn:hover { color: var(--p-primary-color); }
.stp-attach-btn input { display: none; }
.stp-textarea { flex: 1; font-size: 0.875rem; }
.stp-send-btn { flex-shrink: 0; }

/* ── Twin ───────────────────────────────────────── */
.stp-twin-panel { overflow-y: auto; }
.stp-completeness-ring {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 16px auto 8px;
  flex-shrink: 0;
}
.stp-completeness-ring svg { transform: rotate(-90deg); width: 80px; height: 80px; }
.stp-ring-bg   { fill: none; stroke: var(--p-content-border-color); stroke-width: 6; }
.stp-ring-fill {
  fill: none;
  stroke: var(--p-primary-color);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s;
}
.stp-ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.stp-twin-grid {
  padding: 4px 12px 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.stp-twin-field {
  background: color-mix(in srgb, var(--p-primary-color) 4%, var(--p-surface-card));
  border-radius: 6px;
  padding: 6px 8px;
}
.stp-twin-label {
  display: block;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 2px;
}
.stp-twin-val { font-size: 0.8rem; font-weight: 600; color: var(--p-text-color); }
.stp-empty { color: var(--p-text-muted-color); font-weight: 400; }
.stp-metrics-hint {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

/* ── Insights panel ─────────────────────────────── */
.stp-insights-panel { overflow-y: auto; }
.stp-empty-hint {
  padding: 12px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  display: flex;
  gap: 6px;
  align-items: center;
}

.stp-psycho { padding: 10px 14px; }
.stp-mbti {
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  color: var(--p-primary-color);
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}
.stp-signals { display: flex; flex-direction: column; gap: 6px; }
.stp-signal-row { display: flex; align-items: center; gap: 6px; }
.stp-signal-label { font-size: 0.7rem; color: var(--p-text-muted-color); width: 100px; flex-shrink: 0; }
.stp-signal-bar {
  flex: 1;
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
}
.stp-signal-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
.stp-signal-val { font-size: 0.7rem; font-weight: 600; color: var(--p-text-muted-color); width: 30px; text-align: right; }
.stp-flags { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.stp-flag { font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; }
.stp-flag--red   { background: color-mix(in srgb, #ef5350 12%, var(--p-surface-card)); color: color-mix(in srgb, #ef5350 80%, var(--p-text-color)); }
.stp-flag--green { background: color-mix(in srgb, #4caf50 12%, var(--p-surface-card)); color: color-mix(in srgb, #4caf50 80%, var(--p-text-color)); }
.stp-psycho-summary { margin-top: 8px; font-size: 0.8rem; font-style: italic; color: var(--p-text-muted-color); }
.stp-confidence { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 6px; }

.stp-beacon { margin: 6px 10px; padding: 8px 10px; border-radius: 6px; border-left: 3px solid; }
.stp-beacon--high   { border-color: #ef5350; background: color-mix(in srgb, #ef5350 8%, var(--p-surface-card)); }
.stp-beacon--medium { border-color: #ff9800; background: color-mix(in srgb, #ff9800 8%, var(--p-surface-card)); }
.stp-beacon--low    { border-color: #4caf50; background: color-mix(in srgb, #4caf50 8%, var(--p-surface-card)); }
.stp-beacon-header  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.stp-beacon-type    { font-size: 0.7rem; font-weight: 600; color: var(--p-text-muted-color); }
.stp-beacon-sev     { font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; }
.stp-sev--high   { background: color-mix(in srgb, #ef5350 20%, var(--p-surface-card)); color: #ef5350; }
.stp-sev--medium { background: color-mix(in srgb, #ff9800 20%, var(--p-surface-card)); color: #ff9800; }
.stp-sev--low    { background: color-mix(in srgb, #4caf50 20%, var(--p-surface-card)); color: #4caf50; }
.stp-beacon-text { font-size: 0.8rem; color: var(--p-text-color); }
.stp-beacon-rec  { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; }

.stp-finmodel-btn-wrap { padding: 10px; }
.stp-finmodel { padding: 10px; font-size: 0.8rem; color: var(--p-text-color); }
.stp-finmodel-result { line-height: 1.6; }
</style>

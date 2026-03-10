<template>
  <div class="exp" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">

    <!-- Drag overlay -->
    <Transition name="fade">
      <div v-if="dragging" class="exp-drag-overlay">
        <div class="exp-drag-box">
          <i class="pi pi-file-import"></i>
          <span>Отпустите для обучения аватара</span>
          <small>Протоколы ИК, интервью, заметки — всё подходит</small>
        </div>
      </div>
    </Transition>

    <!-- ══════════ TOPBAR ══════════ -->
    <div class="exp-topbar">
      <div class="exp-topbar-left">
        <i class="pi pi-user-edit" style="color:var(--fst-purple);font-size:18px"></i>
        <span class="exp-title">Аватар Эксперта</span>
        <span v-if="expert" class="exp-badge">{{ expert.name }}</span>
        <span v-if="expert" class="exp-subtitle">{{ expert.title }}</span>
      </div>
      <div class="exp-topbar-right">
        <!-- Переключатель эксперта -->
        <div class="exp-expert-switcher">
          <button v-for="p in allProfiles" :key="p.id"
            :class="['exp-expert-tab', { active: expert?.id === p.id }]"
            :style="{ '--ecolor': p.color }"
            @click="switchExpert(p.id)"
            :title="p.title">
            <span>{{ p.avatar }}</span>
            <span class="exp-expert-tab-name">{{ p.name.split(' ')[1] || p.name }}</span>
          </button>
        </div>
        <div v-if="learnedCount > 0" class="exp-learn-badge">
          <i class="pi pi-brain"></i> {{ learnedCount }}
        </div>
        <label class="exp-btn exp-btn--ghost" title="Загрузить документ для обучения">
          <i class="pi pi-upload"></i> Обучить
          <input type="file" accept=".txt,.md,.pdf,.docx,.json" multiple @change="onFileInput" hidden />
        </label>
        <button class="exp-btn exp-btn--ghost" @click="clearSession" title="Сбросить сессию">
          <i class="pi pi-refresh"></i>
        </button>
      </div>
    </div>

    <!-- ══════════ BODY ══════════ -->
    <div class="exp-body">

      <!-- Left: Expert profile panel -->
      <div class="exp-sidebar">

        <!-- Avatar card -->
        <div v-if="expert" class="exp-avatar-card">
          <div class="exp-avatar-face" :style="{ background: `color-mix(in srgb, ${expert.color} 15%, var(--p-surface-card))`, borderColor: expert.color }">
            <span class="exp-avatar-icon">{{ expert.avatar }}</span>
            <div class="exp-avatar-online"></div>
          </div>
          <div class="exp-avatar-name">{{ expert.name }}</div>
          <div class="exp-avatar-title">{{ expert.title }}</div>
        </div>

        <!-- Loading state -->
        <div v-else class="exp-avatar-card exp-avatar-card--loading">
          <div class="exp-avatar-face"><span>⏳</span></div>
          <div class="exp-avatar-name">Загрузка...</div>
        </div>

        <!-- Tabs: Bio / Principles / Deal -->
        <div class="exp-side-tabs">
          <button v-for="t in SIDE_TABS" :key="t.key"
            :class="['exp-side-tab', { active: sideTab === t.key }]"
            @click="sideTab = t.key">
            <i :class="t.icon"></i> {{ t.label }}
          </button>
        </div>

        <!-- Bio tab -->
        <div v-if="sideTab === 'bio' && expert" class="exp-side-content">
          <div class="exp-bio-text">{{ expert.bio }}</div>
        </div>

        <!-- Principles tab -->
        <div v-if="sideTab === 'principles' && expert" class="exp-side-content">
          <div class="exp-section-label">Инвестиционные принципы</div>
          <div v-for="(p, i) in expert.investmentPrinciples" :key="i" class="exp-principle">
            <i class="pi pi-check-circle" style="color:var(--fst-green)"></i>
            <span>{{ p }}</span>
          </div>
          <div class="exp-section-label" style="margin-top:16px">Красные флаги</div>
          <div v-for="(f, i) in expert.redFlags" :key="i" class="exp-principle">
            <i class="pi pi-times-circle" style="color:var(--fst-red)"></i>
            <span>{{ f }}</span>
          </div>
        </div>

        <!-- Deal evaluation tab -->
        <div v-if="sideTab === 'deal'" class="exp-side-content">
          <div class="exp-section-label">Передать сделку на оценку</div>
          <p class="exp-hint">Вставьте данные стартапа — аватар эксперта даст вердикт инвестсовета</p>
          <div class="exp-field">
            <label>Название компании</label>
            <input v-model="deal.company" class="exp-input" placeholder="ООО «Проект»" />
          </div>
          <div class="exp-field">
            <label>Отрасль</label>
            <input v-model="deal.sector" class="exp-input" placeholder="БПЛА, микроэлектроника..." />
          </div>
          <div class="exp-field">
            <label>Описание продукта</label>
            <textarea v-model="deal.description" class="exp-textarea" rows="3" placeholder="Что делает компания..."></textarea>
          </div>
          <div class="exp-row">
            <div class="exp-field exp-field--half">
              <label>TRL</label>
              <input v-model.number="deal.trl" class="exp-input" type="number" min="1" max="9" placeholder="1–9" />
            </div>
            <div class="exp-field exp-field--half">
              <label>Стадия</label>
              <select v-model="deal.stage" class="exp-input">
                <option value="">—</option>
                <option>pre-seed</option><option>seed</option>
                <option>A</option><option>B</option>
              </select>
            </div>
          </div>
          <div class="exp-field">
            <label>Запрос (млн ₽)</label>
            <input v-model.number="deal.askMln" class="exp-input" type="number" placeholder="50" />
          </div>
          <div class="exp-field">
            <label>Российская технобаза?</label>
            <select v-model="deal.sovereign" class="exp-input">
              <option value="">Не указано</option>
              <option value="yes">Да — полностью</option>
              <option value="partial">Частично</option>
              <option value="no">Нет</option>
            </select>
          </div>
          <div class="exp-field">
            <label>Команда</label>
            <input v-model="deal.team" class="exp-input" placeholder="3 чел, бывший Роскосмос..." />
          </div>
          <button class="exp-btn exp-btn--primary" :disabled="evaluating" @click="evaluateDeal">
            <i :class="evaluating ? 'pi pi-spin pi-spinner' : 'pi pi-balance-scale'"></i>
            {{ evaluating ? 'Анализирую...' : 'Получить вердикт ИК' }}
          </button>

          <!-- Structured verdict -->
          <div v-if="lastVerdict" class="exp-verdict-card">
            <div :class="['exp-verdict-badge', `exp-verdict--${verdictClass(lastVerdict.decision)}`]">
              {{ lastVerdict.decision }}
            </div>
            <div class="exp-verdict-meta">
              <span>Суверенность: <b>{{ lastVerdict.sovereigntyScore }}/10</b></span>
              <span>Соответствие: <b>{{ lastVerdict.sectorFit }}</b></span>
            </div>
            <div v-if="lastVerdict.keyStrengths?.length" class="exp-verdict-list">
              <div class="exp-list-label">Сильные стороны</div>
              <div v-for="s in lastVerdict.keyStrengths" :key="s" class="exp-verdict-item exp-verdict-item--green">
                <i class="pi pi-check"></i> {{ s }}
              </div>
            </div>
            <div v-if="lastVerdict.keyWeaknesses?.length" class="exp-verdict-list">
              <div class="exp-list-label">Вопросы / слабости</div>
              <div v-for="w in lastVerdict.keyWeaknesses" :key="w" class="exp-verdict-item exp-verdict-item--red">
                <i class="pi pi-exclamation-triangle"></i> {{ w }}
              </div>
            </div>
          </div>
        </div>

        <!-- Learned patterns tab -->
        <div v-if="sideTab === 'patterns'" class="exp-side-content">
          <div class="exp-section-label">Загруженные паттерны ({{ learnedCount }})</div>
          <div v-if="learnedCount === 0" class="exp-hint">
            Загрузите протоколы ИК, интервью или заметки — аватар извлечёт паттерны поведения эксперта
          </div>
          <div v-for="(p, i) in learnedPatterns" :key="i" class="exp-pattern">
            <span class="exp-pattern-num">{{ i + 1 }}</span>
            <span>{{ p }}</span>
          </div>
          <div v-if="uploadedDocs.length" style="margin-top:16px">
            <div class="exp-section-label">Документы</div>
            <div v-for="doc in uploadedDocs" :key="doc.name" class="exp-doc-item">
              <i class="pi pi-file"></i>
              <span>{{ doc.name }}</span>
              <span class="exp-doc-patterns">+{{ doc.patterns }} паттернов</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Right: Chat -->
      <div class="exp-chat">
        <div class="exp-messages" ref="messagesEl">
          <!-- Welcome message -->
          <div v-if="chatMessages.length === 0 && expert" class="exp-welcome">
            <div class="exp-welcome-icon">{{ expert.avatar }}</div>
            <div class="exp-welcome-name">{{ expert.name }}</div>
            <div class="exp-welcome-text">
              Здравствуйте. Я готов обсудить ваш проект или ответить на вопросы об инвестиционных приоритетах Фонда НТИ. Можете также передать мне данные стартапа для предварительного заключения.
            </div>
            <div class="exp-quick-prompts">
              <button v-for="q in QUICK_PROMPTS" :key="q" class="exp-quick-btn" @click="sendQuick(q)">
                {{ q }}
              </button>
            </div>
          </div>

          <!-- Messages -->
          <template v-for="(msg, i) in chatMessages" :key="i">
            <div v-if="msg.role === 'user'" class="exp-msg exp-msg--user">
              <div class="exp-msg-body">
                <div v-if="msg.file" class="exp-msg-file">
                  <i class="pi pi-file"></i> {{ msg.file }}
                  <span v-if="msg.learned" class="exp-msg-learned">✓ Паттерны извлечены</span>
                </div>
                <div v-if="msg.text" v-html="md(msg.text)" class="exp-msg-text"></div>
              </div>
              <div class="exp-msg-av exp-msg-av--user">👤</div>
            </div>
            <div v-else class="exp-msg exp-msg--expert">
              <div class="exp-msg-av" :style="{ background: expert?.color ? `color-mix(in srgb, ${expert.color} 25%, var(--p-surface-card))` : 'var(--p-surface-card)', border: `2px solid ${expert?.color || 'var(--fst-purple)'}` }">
                {{ expert?.avatar || '👔' }}
              </div>
              <div class="exp-msg-body">
                <div class="exp-msg-expert-name" :style="{ color: expert?.color || 'var(--fst-purple)' }">
                  {{ expert?.name || 'Эксперт' }}
                </div>
                <div v-if="msg.isVerdict" class="exp-verdict-tag">
                  <i class="pi pi-balance-scale"></i> Заключение инвестсовета
                </div>
                <div v-html="md(msg.text)" class="exp-msg-text"></div>
              </div>
            </div>
          </template>

          <!-- Thinking -->
          <div v-if="thinking" class="exp-msg exp-msg--expert">
            <div class="exp-msg-av" :style="{ background: `color-mix(in srgb, var(--fst-purple) 20%, var(--p-surface-card))`, border: '2px solid var(--fst-purple)' }">
              {{ expert?.avatar || '👔' }}
            </div>
            <div class="exp-msg-body">
              <div class="exp-msg-expert-name" style="color:var(--fst-purple)">{{ expert?.name || 'Эксперт' }}</div>
              <div class="exp-typing"><span/><span/><span/></div>
            </div>
          </div>
        </div>

        <!-- Input bar -->
        <div class="exp-input-bar">
          <label class="exp-attach-btn" title="Загрузить документ">
            <i class="pi pi-paperclip"></i>
            <input type="file" accept=".txt,.md,.pdf,.docx,.json" multiple @change="onFileInput" hidden />
          </label>
          <textarea v-model="inputText" ref="inputEl" class="exp-input-area"
            placeholder="Задайте вопрос или расскажите о проекте..."
            rows="1" @keydown.enter.exact.prevent="sendMessage" @input="autoResize"
          ></textarea>
          <button class="exp-send-btn" :class="{ active: inputText.trim() }"
            @click="sendMessage" :disabled="thinking && !inputText.trim()">
            <i :class="thinking ? 'pi pi-spin pi-spinner' : 'pi pi-send'"></i>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { marked } from 'marked'
import { useRoleStore } from '@/stores/roleStore'

const roleStore = useRoleStore()

const SIDE_TABS = [
  { key: 'bio',       label: 'Биография',  icon: 'pi pi-user' },
  { key: 'principles',label: 'Принципы',   icon: 'pi pi-book' },
  { key: 'deal',      label: 'Сделка',     icon: 'pi pi-balance-scale' },
  { key: 'patterns',  label: 'Паттерны',   icon: 'pi pi-brain' },
]

const QUICK_PROMPTS = [
  'Какие критерии отбора у ФСТ НТИ?',
  'Что значит "технологический суверенитет" для вас?',
  'Как выглядит идеальная заявка на инвесткомитет?',
  'Расскажите о фокусных отраслях фонда',
  'Как вы оцениваете команду стартапа?',
]

// ── State ──────────────────────────────────────────────────────
const sessionId    = ref(null)
const expert       = ref(null)
const allProfiles  = ref([])
const chatMessages = ref([])
const inputText    = ref('')
const thinking     = ref(false)
const dragging     = ref(false)
const sideTab      = ref('bio')
const learnedPatterns = ref([])
const uploadedDocs = ref([])
const evaluating   = ref(false)
const lastVerdict  = ref(null)
const messagesEl   = ref(null)
const inputEl      = ref(null)

const deal = ref({
  company: '', sector: '', description: '',
  trl: null, stage: '', askMln: null,
  sovereign: '', team: ''
})

const learnedCount = computed(() => learnedPatterns.value.length)

// ── Markdown ───────────────────────────────────────────────────
function md(text) {
  if (!text) return ''
  try { return marked.parse(text) } catch { return text }
}

function verdictClass(decision) {
  if (!decision) return 'neutral'
  if (decision.includes('ОДОБРИТЬ')) return 'approve'
  if (decision.includes('ОТКЛОНИТЬ')) return 'reject'
  return 'hold'
}

// ── Session init ───────────────────────────────────────────────
async function initSession() {
  // Берём expertId из roleStore (Integram профиль → fallback конфиг → gordin)
  const expertId = roleStore.expertId || 'gordin'
  try {
    const r = await fetch('/api/expert/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId })
    })
    const d = await r.json()
    sessionId.value = d.sessionId
    expert.value = d.expert
  } catch (e) {
    console.error('[expert] session init failed', e)
    // Fallback expert data
    expert.value = {
      id: 'gordin',
      name: 'Дионис Гордин',
      title: 'Инвестиционный директор, Фонд НТИ / ФСТ НТИ',
      avatar: '👔',
      color: 'var(--fst-purple)',
      bio: 'Инвестиционный директор Фонда НТИ и ФСТ НТИ. 20+ лет в венчурных инвестициях.',
      investmentPrinciples: ['Технологический суверенитет', 'Мультипликатор 1:3+', 'Приоритет БПЛА/микроэлектроника'],
      redFlags: ['Нет российской технобазы', 'Вне приоритетных отраслей']
    }
  }
}

// ── Send message ───────────────────────────────────────────────
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || thinking.value) return
  inputText.value = ''
  if (inputEl.value) { inputEl.value.style.height = 'auto' }

  chatMessages.value.push({ role: 'user', text })
  thinking.value = true
  await scrollDown()

  try {
    const r = await fetch('/api/expert/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, message: text })
    })
    const d = await r.json()
    chatMessages.value.push({ role: 'assistant', text: d.reply || 'Ошибка ответа' })
  } catch {
    chatMessages.value.push({ role: 'assistant', text: 'Соединение недоступно. Попробуйте ещё раз.' })
  } finally {
    thinking.value = false
    await scrollDown()
  }
}

function sendQuick(prompt) {
  inputText.value = prompt
  sendMessage()
}

// ── File upload / learn ────────────────────────────────────────
async function onFileInput(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  for (const file of files) {
    await processFile(file)
  }
}

function onDrop(e) {
  dragging.value = false
  const files = Array.from(e.dataTransfer.files || [])
  for (const file of files) processFile(file)
}

async function processFile(file) {
  const text = await file.text().catch(() => '')
  if (!text) return

  // Add file message to chat
  chatMessages.value.push({ role: 'user', file: file.name, text: `Загружен документ для обучения аватара: **${file.name}**` })
  thinking.value = true
  await scrollDown()

  try {
    const r = await fetch('/api/expert/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, text, filename: file.name })
    })
    const d = await r.json()

    if (d.success && d.extracted) {
      const patterns = d.extracted.patterns || []
      learnedPatterns.value.push(...patterns)
      uploadedDocs.value.push({ name: file.name, patterns: patterns.length })

      chatMessages.value.push({
        role: 'assistant',
        text: `Документ **«${file.name}»** обработан. Извлечено ${patterns.length} паттернов поведения.\n\n${d.extracted.summary || ''}\n\nМой аватар теперь учитывает эти данные в ответах.`,
        learned: true
      })
    } else {
      chatMessages.value.push({ role: 'assistant', text: `Не удалось обработать документ «${file.name}».` })
    }
  } catch {
    chatMessages.value.push({ role: 'assistant', text: 'Ошибка при обработке документа.' })
  } finally {
    thinking.value = false
    await scrollDown()
  }
}

// ── Deal evaluation ────────────────────────────────────────────
async function evaluateDeal() {
  if (evaluating.value) return
  evaluating.value = true
  sideTab.value = 'deal'

  const dealData = {
    ...deal.value,
    askRub: deal.value.askMln ? deal.value.askMln * 1e6 : null
  }

  thinking.value = true
  chatMessages.value.push({
    role: 'user',
    text: `Прошу дать предварительное заключение инвестсовета по проекту **${deal.value.company || 'без названия'}** (${deal.value.sector || 'отрасль не указана'}, TRL ${deal.value.trl || '?'}, запрос ${deal.value.askMln || '?'} млн ₽).`
  })
  await scrollDown()

  try {
    const r = await fetch('/api/expert/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, dealData })
    })
    const d = await r.json()

    chatMessages.value.push({ role: 'assistant', text: d.verdict, isVerdict: true })
    if (d.structured?.decision) lastVerdict.value = d.structured
  } catch {
    chatMessages.value.push({ role: 'assistant', text: 'Ошибка при получении вердикта.' })
  } finally {
    evaluating.value = false
    thinking.value = false
    await scrollDown()
  }
}

// ── Helpers ────────────────────────────────────────────────────
async function scrollDown() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function clearSession() {
  chatMessages.value = []
  learnedPatterns.value = []
  uploadedDocs.value = []
  lastVerdict.value = null
  deal.value = { company: '', sector: '', description: '', trl: null, stage: '', askMln: null, sovereign: '', team: '' }
  initSession()
}

async function switchExpert(expertId) {
  chatMessages.value = []
  learnedPatterns.value = []
  uploadedDocs.value = []
  lastVerdict.value = null
  sessionId.value = null
  expert.value = null
  // Инициализируем с новым экспертом
  const r = await fetch('/api/expert/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expertId })
  })
  const d = await r.json()
  sessionId.value = d.sessionId
  expert.value = d.expert
}

async function loadProfiles() {
  try {
    const r = await fetch('/api/expert/profiles')
    const d = await r.json()
    allProfiles.value = d.profiles || []
  } catch { allProfiles.value = [] }
}

// ── Init ───────────────────────────────────────────────────────
onMounted(async () => {
  await loadProfiles()
  await initSession()
})
</script>

<style scoped>
/* ══ Layout ══════════════════════════════════════════════════ */
.exp {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--p-surface-ground);
  font-size: 13px;
  color: var(--p-text-color);
}

/* ══ Topbar ══════════════════════════════════════════════════ */
.exp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
  gap: 16px;
  z-index: 10;
}
.exp-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.exp-title { font-weight: 700; font-size: 14px; }
.exp-badge {
  background: color-mix(in srgb, var(--fst-purple) 15%, var(--p-surface-card));
  color: var(--fst-purple);
  border: 1px solid var(--fst-purple);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
}
.exp-subtitle {
  color: var(--p-text-muted-color);
  font-size: 12px;
}
.exp-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.exp-expert-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 20px;
  padding: 3px;
}
.exp-expert-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--p-text-muted-color);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}
.exp-expert-tab:hover { background: var(--p-surface-card); color: var(--ecolor); }
.exp-expert-tab.active {
  background: color-mix(in srgb, var(--ecolor) 15%, var(--p-surface-card));
  color: var(--ecolor);
}
.exp-expert-tab-name { max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.exp-learn-badge {
  background: color-mix(in srgb, var(--fst-green) 12%, var(--p-surface-card));
  color: var(--fst-green);
  border: 1px solid var(--fst-green);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ══ Body ════════════════════════════════════════════════════ */
.exp-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ══ Sidebar ═════════════════════════════════════════════════ */
.exp-sidebar {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.exp-avatar-card {
  padding: 20px 16px 12px;
  text-align: center;
  border-bottom: 1px solid var(--p-content-border-color);
  position: relative;
}
.exp-avatar-face {
  width: 64px; height: 64px;
  border-radius: 50%;
  border: 3px solid var(--fst-purple);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 10px;
  position: relative;
}
.exp-avatar-icon { font-size: 28px; }
.exp-avatar-online {
  position: absolute; bottom: 2px; right: 2px;
  width: 12px; height: 12px;
  background: var(--fst-green);
  border-radius: 50%;
  border: 2px solid var(--p-surface-card);
}
.exp-avatar-name { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.exp-avatar-title { color: var(--p-text-muted-color); font-size: 11px; line-height: 1.4; }
.exp-avatar-card--loading .exp-avatar-face { border-color: var(--p-content-border-color); }

.exp-side-tabs {
  display: flex;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
}
.exp-side-tab {
  flex: 1;
  padding: 8px 4px;
  font-size: 10px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transition: color 0.15s, border-color 0.15s;
  border-bottom: 2px solid transparent;
}
.exp-side-tab i { font-size: 13px; }
.exp-side-tab.active {
  color: var(--fst-purple);
  border-bottom-color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 5%, transparent);
}

.exp-side-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.exp-bio-text {
  font-size: 12px;
  line-height: 1.7;
  color: var(--p-text-muted-color);
  white-space: pre-line;
}
.exp-section-label {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.exp-principle {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  align-items: flex-start;
}
.exp-principle i { flex-shrink: 0; margin-top: 2px; }
.exp-hint {
  color: var(--p-text-muted-color);
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 12px;
}
.exp-field { margin-bottom: 10px; }
.exp-field label { display: block; font-size: 11px; font-weight: 600; color: var(--p-text-muted-color); margin-bottom: 4px; }
.exp-row { display: flex; gap: 8px; }
.exp-field--half { flex: 1; }
.exp-input, .exp-textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-size: 12px;
  font-family: inherit;
  box-sizing: border-box;
}
.exp-textarea { resize: vertical; }
.exp-input:focus, .exp-textarea:focus {
  outline: none;
  border-color: var(--fst-purple);
}

.exp-pattern {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 6px 0;
  border-bottom: 1px solid var(--p-content-border-color);
  font-size: 12px;
  line-height: 1.5;
}
.exp-pattern-num {
  background: color-mix(in srgb, var(--fst-purple) 15%, var(--p-surface-card));
  color: var(--fst-purple);
  border-radius: 50%;
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  flex-shrink: 0;
}
.exp-doc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; font-size: 12px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.exp-doc-patterns {
  margin-left: auto;
  color: var(--fst-green); font-size: 11px; font-weight: 600;
}

/* Verdict card */
.exp-verdict-card {
  margin-top: 16px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
}
.exp-verdict-badge {
  text-align: center;
  font-weight: 800;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
}
.exp-verdict--approve { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.exp-verdict--reject  { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.exp-verdict--hold    { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.exp-verdict--neutral { background: var(--p-surface-card); color: var(--p-text-muted-color); }
.exp-verdict-meta {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 10px;
}
.exp-verdict-meta b { color: var(--p-text-color); }
.exp-verdict-list { margin-bottom: 8px; }
.exp-list-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--p-text-muted-color); margin-bottom: 4px; }
.exp-verdict-item {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; line-height: 1.5; margin-bottom: 4px;
}
.exp-verdict-item--green { color: var(--fst-green); }
.exp-verdict-item--red { color: var(--fst-red); }

/* ══ Chat ════════════════════════════════════════════════════ */
.exp-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--p-surface-ground);
}

.exp-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Welcome */
.exp-welcome {
  margin: auto;
  max-width: 480px;
  text-align: center;
  padding: 40px 20px;
}
.exp-welcome-icon { font-size: 48px; margin-bottom: 12px; }
.exp-welcome-name { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.exp-welcome-text {
  color: var(--p-text-muted-color);
  line-height: 1.7; font-size: 13px;
  margin-bottom: 20px;
}
.exp-quick-prompts {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
}
.exp-quick-btn {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--p-text-color);
  transition: border-color 0.15s, background 0.15s;
}
.exp-quick-btn:hover {
  border-color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 8%, var(--p-surface-card));
}

/* Messages */
.exp-msg {
  display: flex;
  gap: 10px;
  max-width: 80%;
}
.exp-msg--user { flex-direction: row-reverse; align-self: flex-end; }
.exp-msg--expert { align-self: flex-start; }

.exp-msg-av {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.exp-msg-av--user {
  background: color-mix(in srgb, var(--fst-blue) 15%, var(--p-surface-card));
  border: 2px solid var(--fst-blue);
}
.exp-msg-body {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 10px 14px;
  max-width: 100%;
}
.exp-msg--user .exp-msg-body {
  background: color-mix(in srgb, var(--fst-blue) 10%, var(--p-surface-card));
  border-color: color-mix(in srgb, var(--fst-blue) 25%, transparent);
}
.exp-msg-expert-name {
  font-size: 11px; font-weight: 700;
  margin-bottom: 4px; opacity: 0.8;
}
.exp-msg-text :deep(p) { margin: 0 0 8px; line-height: 1.6; }
.exp-msg-text :deep(p:last-child) { margin-bottom: 0; }
.exp-msg-text :deep(ul), .exp-msg-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.exp-msg-text :deep(strong) { color: var(--p-text-color); }
.exp-msg-file {
  font-size: 12px; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.exp-msg-learned { color: var(--fst-green); font-weight: 600; }
.exp-verdict-tag {
  background: color-mix(in srgb, var(--fst-purple) 12%, transparent);
  color: var(--fst-purple);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px;
  margin-bottom: 8px;
}

/* Typing */
.exp-typing { display: flex; gap: 4px; align-items: center; height: 20px; }
.exp-typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--fst-purple); opacity: 0.4;
  animation: exp-pulse 1.2s infinite ease-in-out;
}
.exp-typing span:nth-child(2) { animation-delay: 0.2s; }
.exp-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes exp-pulse { 0%,80%,100% { opacity:0.4; transform:scale(0.8) } 40% { opacity:1; transform:scale(1) } }

/* Input bar */
.exp-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: var(--p-surface-card);
  border-top: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
}
.exp-attach-btn {
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 8px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.exp-attach-btn:hover { color: var(--fst-purple); background: color-mix(in srgb, var(--fst-purple) 10%, transparent); }
.exp-input-area {
  flex: 1;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 8px 12px;
  resize: none;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  min-height: 38px;
  max-height: 120px;
  transition: border-color 0.15s;
}
.exp-input-area:focus { outline: none; border-color: var(--fst-purple); }
.exp-send-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--p-content-border-color);
  color: var(--p-text-muted-color);
  cursor: pointer;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
  font-size: 14px;
}
.exp-send-btn.active { background: var(--fst-purple); color: white; }

/* Buttons */
.exp-btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: none; border-radius: 8px;
  padding: 7px 12px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.exp-btn--ghost {
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  border: 1px solid var(--p-content-border-color);
}
.exp-btn--ghost:hover { background: var(--p-surface-card); color: var(--p-text-color); }
.exp-btn--primary {
  background: var(--fst-purple);
  color: white;
  width: 100%;
  justify-content: center;
  padding: 9px;
  margin-top: 4px;
}
.exp-btn--primary:hover { opacity: 0.9; }
.exp-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Drag overlay */
.exp-drag-overlay {
  position: fixed; inset: 0;
  background: color-mix(in srgb, var(--fst-purple) 12%, var(--p-surface-ground));
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.exp-drag-box {
  background: var(--p-surface-card);
  border: 2px dashed var(--fst-purple);
  border-radius: 16px;
  padding: 40px 60px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.exp-drag-box i { font-size: 36px; color: var(--fst-purple); }
.exp-drag-box span { font-size: 18px; font-weight: 700; }
.exp-drag-box small { color: var(--p-text-muted-color); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<template>
  <div class="mini-app" :class="{ 'tg-dark': isDark }">
    <!-- Header -->
    <div class="mini-header">
      <div class="mini-logo">🛡️ ФСТ НТИ</div>
      <div class="mini-nav">
        <button v-for="tab in tabs" :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id">
          {{ tab.icon }}
        </button>
      </div>
    </div>

    <!-- Tab: Портфель -->
    <div v-if="activeTab === 'portfolio'" class="tab-content">
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-val">6.4 млрд</div>
          <div class="kpi-label">NAV</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">38%</div>
          <div class="kpi-label">IRR</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">{{ portfolio.length }}</div>
          <div class="kpi-label">Компаний</div>
        </div>
      </div>

      <div class="section-title">Портфельные компании</div>
      <div v-for="c in portfolio" :key="c.name" class="company-card" @click="selectCompany(c)">
        <div class="company-top">
          <span class="company-status">{{ c.st }}</span>
          <span class="company-name">{{ c.name }}</span>
          <span class="company-sector">{{ c.sector }}</span>
        </div>
        <div class="company-metrics">
          <span>💰 {{ c.rev }}</span>
          <span>⏳ {{ c.run }}</span>
          <span>TRL {{ c.trl }}</span>
          <span class="irr">↑ {{ c.irr }}</span>
        </div>
        <div v-if="c.st === '🔴'" class="company-alert">⚡ Требует внимания</div>
      </div>
    </div>

    <!-- Tab: Алерты -->
    <div v-if="activeTab === 'alerts'" class="tab-content">
      <div class="section-title">Активные алерты</div>
      <div v-for="a in alerts" :key="a.id" :class="['alert-card', a.level]">
        <div class="alert-top">
          <span class="alert-icon">{{ a.icon }}</span>
          <span class="alert-company">{{ a.company }}</span>
          <span class="alert-badge">{{ a.level === 'critical' ? 'КРИТИЧНО' : 'Внимание' }}</span>
        </div>
        <div class="alert-text">{{ a.text }}</div>
        <div class="alert-action">→ {{ a.action }}</div>
      </div>
    </div>

    <!-- Tab: ИК -->
    <div v-if="activeTab === 'ic'" class="tab-content">
      <div class="section-title">Последние решения ИК</div>
      <div v-for="d in decisions" :key="d.id" class="decision-card">
        <div class="decision-top">
          <span :class="['decision-verdict', d.verdict]">{{ d.verdictLabel }}</span>
          <span class="decision-company">{{ d.company }}</span>
        </div>
        <div class="decision-meta">{{ d.date }} · {{ d.amount }}</div>
        <div class="decision-agents">
          <span v-for="a in d.agents" :key="a.role" :class="['agent-dot', a.vote]" :title="a.role"></span>
        </div>
      </div>
      <a :href="platformUrl + '/fst-committee'" class="open-btn">🤖 Запустить AI ИК</a>
    </div>

    <!-- Tab: AI Чат -->
    <div v-if="activeTab === 'ai'" class="tab-content ai-tab">
      <div class="section-title">AI Ассистент фонда</div>
      <div class="chat-messages" ref="chatEl">
        <div v-for="m in messages" :key="m.id" :class="['message', m.role]">
          <div class="message-bubble">{{ m.text }}</div>
        </div>
        <div v-if="loading" class="message assistant">
          <div class="message-bubble loading">⏳ Анализирую данные...</div>
        </div>
      </div>
      <div class="quick-questions">
        <button v-for="q in quickQuestions" :key="q" class="quick-btn" @click="askQuestion(q)">{{ q }}</button>
      </div>
      <div class="chat-input-row">
        <input v-model="question" class="chat-input" placeholder="Спросите о портфеле..."
          @keydown.enter="askQuestion(question)" />
        <button class="send-btn" @click="askQuestion(question)" :disabled="loading">→</button>
      </div>
    </div>

    <!-- Детали компании (overlay) -->
    <div v-if="selectedCompany" class="company-overlay" @click.self="selectedCompany = null">
      <div class="company-detail">
        <div class="detail-close" @click="selectedCompany = null">✕</div>
        <div class="detail-status">{{ selectedCompany.st }}</div>
        <h2>{{ selectedCompany.name }}</h2>
        <div class="detail-grid">
          <div class="detail-item"><span>Сектор</span><strong>{{ selectedCompany.sector }}</strong></div>
          <div class="detail-item"><span>Выручка</span><strong>{{ selectedCompany.rev }}</strong></div>
          <div class="detail-item"><span>Runway</span><strong>{{ selectedCompany.run }}</strong></div>
          <div class="detail-item"><span>TRL</span><strong>{{ selectedCompany.trl }}/9</strong></div>
          <div class="detail-item"><span>IRR</span><strong>{{ selectedCompany.irr }}</strong></div>
        </div>
        <div class="detail-actions">
          <a :href="platformUrl + '/fst-portfolio'" class="action-btn primary">📊 Монитор</a>
          <a :href="platformUrl + '/fst-twin'" class="action-btn">🌐 Двойник</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const activeTab = ref('portfolio')
const selectedCompany = ref(null)
const question = ref('')
const loading = ref(false)
const chatEl = ref(null)
const messages = ref([
  { id: 1, role: 'assistant', text: '👋 Привет! Я AI-ассистент ФСТ НТИ. Спросите меня о портфеле, компаниях, метриках или стратегии фонда.' }
])

const isDark = ref(true)
const platformUrl = 'https://fst.drondoc.ru'

const tabs = [
  { id: 'portfolio', icon: '📊' },
  { id: 'alerts',    icon: '⚠️' },
  { id: 'ic',        icon: '🤖' },
  { id: 'ai',        icon: '💬' },
]

const portfolio = ref([
  { name: 'АвиаЛогик',  sector: 'БАС',  st: '🟢', rev: '18 млн', run: '14 мес', trl: 6, irr: '34%' },
  { name: 'МикроСхема', sector: 'МЭ',   st: '🟡', rev: '42 млн', run: '7 мес',  trl: 7, irr: '28%' },
  { name: 'АэроСпектр', sector: 'БАС',  st: '🔴', rev: '8 млн',  run: '3 мес',  trl: 5, irr: '12%' },
  { name: 'РобоМакс',   sector: 'РОБО', st: '🟢', rev: '31 млн', run: '22 мес', trl: 7, irr: '41%' },
  { name: 'ДронСервис', sector: 'БАС',  st: '🟢', rev: '55 млн', run: '18 мес', trl: 8, irr: '52%' },
])

const alerts = ref([
  { id:1, level:'critical', icon:'🔴', company:'АэроСпектр', text:'Runway 3 мес — критический уровень', action:'Срочно: мост-финансирование' },
  { id:2, level:'warning',  icon:'🟡', company:'МикроСхема',  text:'Runway 7 мес, приближается порог', action:'Подготовить Серию B к Q2 2026' },
  { id:3, level:'warning',  icon:'🟡', company:'АэроСпектр',  text:'TRL стагнация более 6 месяцев', action:'Запросить tech update от команды' },
])

const decisions = ref([
  { id:1, company:'АвиаЛогик', verdict:'approved', verdictLabel:'✅ Одобрено', date:'01.03.2026', amount:'25 млн ₽',
    agents:[{role:'Технич.',vote:'yes'},{role:'Финансист',vote:'yes'},{role:'Суверен.',vote:'yes'},{role:'Риски',vote:'yes'},{role:'Стратег',vote:'yes'},{role:'Адвокат',vote:'no'}] },
  { id:2, company:'НейроДрон', verdict:'rejected', verdictLabel:'❌ Отклонено', date:'22.02.2026', amount:'80 млн ₽',
    agents:[{role:'Технич.',vote:'no'},{role:'Финансист',vote:'no'},{role:'Суверен.',vote:'yes'},{role:'Риски',vote:'no'},{role:'Стратег',vote:'no'},{role:'Адвокат',vote:'no'}] },
])

const quickQuestions = [
  'Кто в зоне риска?',
  'IRR портфеля?',
  'Лучшая компания?',
  'Следующий ИК?',
]

async function askQuestion(q) {
  if (!q || !q.trim() || loading.value) return
  const text = q.trim()
  question.value = ''

  messages.value.push({ id: Date.now(), role: 'user', text })
  loading.value = true
  await nextTick()
  chatEl.value?.scrollTo(0, chatEl.value.scrollHeight)

  try {
    const portfolioContext = portfolio.value.map(c =>
      `${c.name} (${c.sector}): выручка ${c.rev}, runway ${c.run}, TRL ${c.trl}, IRR ${c.irr}, статус ${c.st === '🟢' ? 'норма' : c.st === '🟡' ? 'внимание' : 'критично'}`
    ).join('\n')

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: text,
        systemPrompt: `Ты AI-ассистент венчурного фонда ФСТ НТИ. Отвечай коротко и по делу (2-4 предложения).
Данные портфеля:\n${portfolioContext}\n
NAV: 6.4 млрд ₽, AUM: 8.2 млрд ₽, IRR: 38%, субфонды: БАС/РОБО/МЭ.`,
        application: 'FstMiniApp',
      })
    })
    const data = await res.json()
    messages.value.push({ id: Date.now()+1, role: 'assistant', text: data.response || data.content || 'Не удалось получить ответ.' })
  } catch {
    messages.value.push({ id: Date.now()+1, role: 'assistant', text: '⚠️ Ошибка соединения с AI. Попробуйте позже.' })
  }

  loading.value = false
  await nextTick()
  chatEl.value?.scrollTo(0, chatEl.value.scrollHeight)
}

function selectCompany(c) { selectedCompany.value = c }

let _tgClickHandler = null

onMounted(() => {
  // Telegram WebApp integration
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp
    tg.ready()
    tg.expand()
    isDark.value = tg.colorScheme === 'dark'
    tg.MainButton.setText('Открыть полную платформу')
    _tgClickHandler = () => tg.openLink(platformUrl)
    tg.MainButton.onClick(_tgClickHandler)
    tg.MainButton.show()
  }
})

onUnmounted(() => {
  if (window.Telegram?.WebApp && _tgClickHandler) {
    window.Telegram.WebApp.MainButton.offClick(_tgClickHandler)
    window.Telegram.WebApp.MainButton.hide()
  }
})
</script>

<style scoped>
.mini-app {
  min-height: 100vh;
  background: #0f0f14;
  color: #e8e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding-bottom: 2rem;
}

.mini-header {
  position: sticky; top: 0; z-index: 10;
  background: #16161f;
  padding: 0.75rem 1rem;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #2a2a3a;
}
.mini-logo { font-weight: 700; font-size: 1rem; letter-spacing: 0.5px; }
.mini-nav { display: flex; gap: 0.25rem; }
.tab-btn {
  padding: 0.4rem 0.6rem; border-radius: 8px; border: none;
  background: transparent; color: #888; font-size: 1.2rem; cursor: pointer;
  transition: all 0.15s;
}
.tab-btn.active { background: #2a2a4a; color: #fff; }

.tab-content { padding: 1rem; }
.section-title { font-size: 0.75rem; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 1px; margin: 1rem 0 0.5rem; }

.kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
.kpi-card { background: #1a1a28; border-radius: 10px; padding: 0.75rem; text-align: center; }
.kpi-val { font-size: 1.1rem; font-weight: 700; color: #7c6af7; }
.kpi-label { font-size: 0.7rem; color: #666; margin-top: 0.2rem; }

.company-card {
  background: #1a1a28; border-radius: 12px; padding: 0.875rem; margin-bottom: 0.5rem;
  cursor: pointer; transition: background 0.15s; border: 1px solid transparent;
}
.company-card:active { background: #22223a; border-color: #7c6af7; }
.company-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.company-name { font-weight: 600; flex: 1; }
.company-sector { font-size: 0.7rem; background: #2a2a3a; padding: 0.2rem 0.5rem; border-radius: 4px; color: #888; }
.company-metrics { display: flex; gap: 0.75rem; font-size: 0.78rem; color: #999; }
.irr { color: #4caf7d; }
.company-alert { margin-top: 0.4rem; font-size: 0.75rem; color: #ff6b6b; }

.alert-card { background: #1a1a28; border-radius: 12px; padding: 0.875rem; margin-bottom: 0.5rem; border-left: 3px solid; }
.alert-card.critical { border-color: #ff4444; }
.alert-card.warning  { border-color: #ffaa00; }
.alert-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
.alert-company { font-weight: 600; flex: 1; }
.alert-badge { font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; background: #2a2a3a; color: #888; }
.alert-text { font-size: 0.82rem; color: #ccc; margin-bottom: 0.25rem; }
.alert-action { font-size: 0.78rem; color: #7c6af7; }

.decision-card { background: #1a1a28; border-radius: 12px; padding: 0.875rem; margin-bottom: 0.5rem; }
.decision-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.decision-verdict { font-size: 0.8rem; }
.decision-company { font-weight: 600; }
.decision-meta { font-size: 0.75rem; color: #666; margin-bottom: 0.4rem; }
.decision-agents { display: flex; gap: 4px; }
.agent-dot { width: 10px; height: 10px; border-radius: 50%; }
.agent-dot.yes { background: #4caf7d; }
.agent-dot.no  { background: #ff4444; }
.open-btn {
  display: block; text-align: center; margin-top: 1rem;
  background: #7c6af7; color: #fff; padding: 0.75rem; border-radius: 12px;
  text-decoration: none; font-weight: 600;
}

.ai-tab { display: flex; flex-direction: column; height: calc(100vh - 120px); }
.chat-messages { flex: 1; overflow-y: auto; padding-bottom: 0.5rem; }
.message { display: flex; margin-bottom: 0.5rem; }
.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }
.message-bubble {
  max-width: 80%; padding: 0.625rem 0.875rem; border-radius: 14px;
  font-size: 0.88rem; line-height: 1.4;
}
.message.user .message-bubble { background: #7c6af7; color: #fff; border-bottom-right-radius: 4px; }
.message.assistant .message-bubble { background: #1a1a28; color: #e8e8f0; border-bottom-left-radius: 4px; }
.message-bubble.loading { color: #666; }
.quick-questions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
.quick-btn {
  font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 16px;
  border: 1px solid #2a2a3a; background: transparent; color: #7c6af7; cursor: pointer;
}
.chat-input-row { display: flex; gap: 0.5rem; }
.chat-input {
  flex: 1; background: #1a1a28; border: 1px solid #2a2a3a; border-radius: 10px;
  padding: 0.625rem 0.875rem; color: #e8e8f0; font-size: 0.9rem; outline: none;
}
.send-btn {
  background: #7c6af7; color: #fff; border: none; border-radius: 10px;
  padding: 0 1rem; font-size: 1.1rem; cursor: pointer;
}
.send-btn:disabled { opacity: 0.5; }

.company-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100;
  display: flex; align-items: flex-end;
}
.company-detail {
  background: #16161f; border-radius: 20px 20px 0 0; padding: 1.5rem;
  width: 100%; position: relative; animation: slideUp 0.2s ease;
}
.detail-close {
  position: absolute; top: 1rem; right: 1rem;
  width: 28px; height: 28px; background: #2a2a3a; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;
}
.detail-status { font-size: 2.5rem; margin-bottom: 0.25rem; }
.company-detail h2 { font-size: 1.4rem; margin: 0 0 1rem; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
.detail-item { background: #1a1a28; border-radius: 10px; padding: 0.625rem; }
.detail-item span { display: block; font-size: 0.7rem; color: #666; margin-bottom: 0.2rem; }
.detail-item strong { font-size: 1rem; color: #e8e8f0; }
.detail-actions { display: flex; gap: 0.5rem; }
.action-btn {
  flex: 1; text-align: center; padding: 0.75rem; border-radius: 12px;
  text-decoration: none; font-weight: 600; font-size: 0.88rem;
  background: #1a1a28; color: #e8e8f0;
}
.action-btn.primary { background: #7c6af7; color: #fff; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .kpi-row { flex-wrap: wrap; gap: 8px; }
  .kpi-card { flex-wrap: wrap; gap: 8px; }
  .kpi-row { grid-template-columns: 1fr !important; }
  .detail-grid { grid-template-columns: 1fr !important; }
}
</style>

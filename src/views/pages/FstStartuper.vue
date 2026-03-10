<template>
  <div class="spw" @dragover.prevent="dragging=true" @dragleave.self="dragging=false" @drop.prevent="onDrop">

    <!-- Drag overlay -->
    <Transition name="fade">
      <div v-if="dragging" class="spw-drag-overlay">
        <div class="spw-drag-box"><i class="pi pi-paperclip"></i><span>Отпустите файл</span></div>
      </div>
    </Transition>

    <!-- ══════════ TOPBAR ══════════ -->
    <div class="spw-topbar">
      <div class="spw-topbar-left">
        <i class="pi pi-rocket" style="color:var(--p-primary-color);font-size:18px"></i>
        <span class="spw-co-name">{{ twin.company || 'Моя компания' }}</span>
        <span v-if="twin.stage" class="spw-badge spw-badge--blue">{{ twin.stage }}</span>
        <span v-if="twin.trl" class="spw-badge spw-badge--purple">TRL {{ twin.trl }}</span>
        <div class="spw-kpi-strip">
          <div class="spw-kpi" v-for="k in kpiItems" :key="k.key">
            <span class="spw-kpi-val" :style="{ color: k.color }">{{ k.val }}</span>
            <span class="spw-kpi-label">{{ k.label }}</span>
          </div>
        </div>
      </div>
      <div class="spw-topbar-right">
        <!-- Role switcher -->
        <div class="spw-roles">
          <button v-for="r in ROLES" :key="r.key"
            :class="['spw-role-btn', { active: role === r.key }]"
            @click="role = r.key" :title="r.desc">
            <i :class="r.icon"></i> {{ r.label }}
          </button>
        </div>
        <div class="spw-topbar-sep"></div>
        <button class="spw-btn spw-btn--ghost" @click="clearSession" title="Сбросить сессию">
          <i class="pi pi-refresh"></i>
        </button>
        <button v-if="twin.completeness >= 80" class="spw-btn spw-btn--primary" @click="sendToIC">
          <i class="pi pi-send"></i> В ИК
        </button>
      </div>
    </div>

    <!-- ══════════ BODY ══════════ -->
    <div class="spw-body">

      <!-- ─── LEFT: Artifact Navigator ─── -->
      <div class="spw-nav">
        <div v-for="sec in visibleArtifacts" :key="sec.key" class="spw-nav-section">
          <div class="spw-nav-head">
            <i :class="sec.icon"></i>
            <span>{{ sec.label }}</span>
          </div>
          <div v-for="item in sec.items" :key="item.key"
            :class="['spw-nav-item', { active: activeView === item.key }]"
            @click="openView(item)">
            <i :class="item.icon" style="font-size:12px;opacity:.7"></i>
            <span>{{ item.label }}</span>
            <span v-if="item.filled" class="spw-nav-dot spw-nav-dot--ok" title="Заполнен"></span>
            <span v-else-if="item.required" class="spw-nav-dot spw-nav-dot--empty" title="Требует заполнения"></span>
          </div>
        </div>
      </div>

      <!-- ─── CENTER: Main Workspace ─── -->
      <div class="spw-main">

        <!-- Dashboard -->
        <template v-if="activeView === 'dashboard'">
          <div class="spw-dash">
            <!-- Completeness card -->
            <div class="spw-dash-row">
              <div class="spw-card spw-card--wide">
                <div class="spw-card-head"><i class="pi pi-chart-pie"></i> Готовность пакета документов</div>
                <div class="spw-complete-bar">
                  <div class="spw-complete-fill" :style="{ width: twin.completeness + '%', background: completenessColor }"></div>
                </div>
                <div class="spw-complete-label">{{ twin.completeness }}% заполнено</div>
                <div class="spw-doc-status-grid">
                  <div v-for="doc in docStatus" :key="doc.key" :class="['spw-ds', `spw-ds--${doc.status}`]">
                    <i :class="doc.icon"></i>
                    <span>{{ doc.label }}</span>
                  </div>
                </div>
              </div>

              <!-- Company metrics -->
              <div class="spw-card">
                <div class="spw-card-head"><i class="pi pi-building"></i> Компания</div>
                <div class="spw-metric-list">
                  <div class="spw-ml-row" v-for="m in companyMetrics" :key="m.key">
                    <span class="spw-ml-label">{{ m.label }}</span>
                    <span class="spw-ml-val">{{ m.val || '—' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scoring if available -->
            <div v-if="scoring.totalScore" class="spw-card spw-card--wide">
              <div class="spw-card-head"><i class="pi pi-star"></i> AI-оценка · {{ scoring.totalScore }}/100 · {{ scoring.verdict }}</div>
              <div class="spw-score-grid">
                <div v-for="(dim, key) in scoring.dimensions" :key="key" class="spw-score-row">
                  <span class="spw-score-label">{{ SCORE_LABELS[key] }}</span>
                  <div class="spw-score-track"><div :style="{ width: dim.score*10+'%', background: scoreColor(dim.score) }"></div></div>
                  <b class="spw-score-num" :style="{ color: scoreColor(dim.score) }">{{ dim.score }}</b>
                </div>
              </div>
            </div>

            <!-- Beacons -->
            <div v-if="beacons.length" class="spw-card spw-card--wide">
              <div class="spw-card-head"><i class="pi pi-exclamation-triangle" style="color:var(--p-orange-400)"></i> Сигналы</div>
              <div v-for="b in beacons" :key="b.text" :class="['spw-beacon', `spw-beacon--${b.severity}`]">
                <b>{{ b.dimension }}</b>: {{ b.text }}
              </div>
            </div>

            <!-- Quick start if empty -->
            <div v-if="!twin.company" class="spw-card spw-card--wide spw-card--start">
              <div class="spw-card-head">С чего начать</div>
              <p style="font-size:13px;color:var(--p-text-muted-color);margin:0 0 12px">Расскажите агенту о проекте или загрузите любой документ</p>
              <div class="spw-start-actions">
                <button class="spw-btn spw-btn--primary" @click="openView({ key: 'agent', type: 'chat' })">
                  <i class="pi pi-comments"></i> Открыть агента
                </button>
                <label class="spw-btn spw-btn--outline">
                  <i class="pi pi-upload"></i> Загрузить файл
                  <input type="file" accept="*" multiple @change="onFileInput" hidden />
                </label>
                <button class="spw-demo-btn" @click="loadDemo('sirin')">🚀 Загрузить SIRIN demo</button>
              </div>
            </div>
          </div>
        </template>

        <!-- Agent chat -->
        <template v-else-if="activeView === 'agent'">
          <div class="spw-chat-wrap">
            <div class="spw-messages" ref="messagesEl">
              <template v-for="(msg, i) in chatMessages" :key="i">
                <div v-if="msg.role === 'divider'" class="spw-divider"><span>{{ msg.text }}</span></div>
                <div v-else-if="msg.role === 'user'" class="spw-msg spw-msg--user">
                  <div class="spw-msg-body">
                    <img v-if="msg.isImage" :src="msg.dataUrl" class="spw-msg-img" />
                    <div v-else-if="msg.file" class="spw-msg-file"><i class="pi pi-paperclip"></i> {{ msg.file }}</div>
                    <div v-if="msg.text" v-html="md(msg.text)" class="spw-msg-text"></div>
                  </div>
                  <div class="spw-msg-av spw-msg-av--user">👤</div>
                </div>
                <div v-else class="spw-msg spw-msg--agent">
                  <div class="spw-msg-av" :style="{ background: agent(msg.agent).color }">{{ agent(msg.agent).icon }}</div>
                  <div class="spw-msg-body">
                    <div class="spw-msg-agent-name" :style="{ color: agent(msg.agent).color }">{{ agent(msg.agent).name }}</div>
                    <div v-if="msg.type === 'event'" :class="['spw-event-pill', 'spw-ep--'+(msg.step||'info')]">{{ msg.text }}</div>
                    <div v-else v-html="md(msg.text)" class="spw-msg-text"></div>
                    <div v-if="msg.scoreCard" class="spw-score-card">
                      <div class="spw-sc-total" :class="scoreClass(msg.scoreCard.totalScore)">
                        {{ msg.scoreCard.totalScore }}<span>/100</span>
                      </div>
                      <div class="spw-sc-bars">
                        <div v-for="(dim, key) in msg.scoreCard.dimensions" :key="key" class="spw-sc-row">
                          <span>{{ SCORE_LABELS[key] }}</span>
                          <div class="spw-sc-track"><div :style="{ width: dim.score*10+'%', background: scoreColor(dim.score) }"></div></div>
                          <b>{{ dim.score }}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-if="thinking" class="spw-msg spw-msg--agent">
                <div class="spw-msg-av" :style="{ background: AGENTS.navigator.color }">🤖</div>
                <div class="spw-msg-body">
                  <div class="spw-msg-agent-name" :style="{ color: AGENTS.navigator.color }">Навигатор</div>
                  <div class="spw-typing"><span/><span/><span/></div>
                </div>
              </div>
            </div>
            <div class="spw-input-bar">
              <label class="spw-attach-btn">
                <i class="pi pi-paperclip"></i>
                <input type="file" accept="*" multiple @change="onFileInput" hidden />
              </label>
              <textarea v-model="inputText" ref="inputEl" class="spw-input"
                placeholder="Напишите о проекте или задайте вопрос агенту..."
                rows="1" @keydown.enter.exact.prevent="sendMessage" @input="autoResize" @paste="onPaste"
              ></textarea>
              <button class="spw-send-btn" :class="{ active: inputText.trim() }"
                @click="sendMessage" :disabled="thinking && !inputText.trim()">
                <i :class="thinking ? 'pi pi-spin pi-spinner' : 'pi pi-send'"></i>
              </button>
            </div>
          </div>
        </template>

        <!-- Document viewer -->
        <template v-else-if="activeItem?.type === 'doc'">
          <div class="spw-doc-view">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i :class="activeItem.icon"></i> {{ activeItem.label }}</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--primary" @click="fillDocWithAI(activeItem)">
                  <i class="pi pi-magic"></i> Заполнить с AI
                </button>
                <a v-if="activeItem.url" :href="activeItem.url" target="_blank" class="spw-btn spw-btn--outline">
                  <i class="pi pi-external-link"></i> Открыть
                </a>
                <a v-if="activeItem.downloadUrl" :href="activeItem.downloadUrl" class="spw-btn spw-btn--ghost">
                  <i class="pi pi-download"></i>
                </a>
              </div>
            </div>
            <div class="spw-doc-body">
              <iframe v-if="activeItem.url && activeItem.url.endsWith('.pdf')"
                :src="activeItem.url" class="spw-doc-iframe" />
              <div v-else class="spw-doc-placeholder">
                <i class="pi pi-file-word" style="font-size:56px;color:var(--p-primary-color);opacity:.4"></i>
                <h3>{{ activeItem.label }}</h3>
                <p>Нажмите «Заполнить с AI» — агент автоматически заполнит документ<br>данными вашей компании и запросит недостающее</p>
                <div v-if="activeItem.fields?.length" class="spw-doc-fields">
                  <div v-for="f in activeItem.fields" :key="f.key" class="spw-doc-field">
                    <label>{{ f.label }}</label>
                    <input v-model="docValues[f.key]" :placeholder="f.placeholder" class="spw-field-input" />
                  </div>
                </div>
              </div>
              <!-- AI response for this doc -->
              <div v-if="docAiResponse" class="spw-doc-ai-resp" v-html="md(docAiResponse)"></div>
            </div>
          </div>
        </template>

        <!-- FinModel -->
        <template v-else-if="activeView === 'finmodel'">
          <div class="spw-finmodel-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-table"></i> Финансовая модель</span>
              <a href="https://ai2o.ru/download/fst/7ac404839/47442f27815.zip"
                class="spw-btn spw-btn--ghost" title="Скачать пакет документов">
                <i class="pi pi-download"></i> Пакет SIRIN
              </a>
            </div>
            <div class="spw-finmodel-body">
              <FstFinModelBlock v-if="finmodelId" :modelId="finmodelId" database="fst" />
              <div v-else class="spw-doc-placeholder">
                <i class="pi pi-table" style="font-size:56px;opacity:.3"></i>
                <h3>Финансовая модель</h3>
                <p>Модель будет создана агентом после заполнения ключевых данных<br>(выручка, затраты, раунды финансирования)</p>
                <button class="spw-btn spw-btn--primary" @click="createFinmodel">
                  <i class="pi pi-magic"></i> Создать финмодель с AI
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Grants -->
        <template v-else-if="activeView === 'grants'">
          <div class="spw-grants-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-money-bill"></i> Подходящие гранты</span>
              <button class="spw-btn spw-btn--primary" @click="runResearch">
                <i class="pi pi-refresh"></i> Обновить
              </button>
            </div>
            <div v-if="research.grants?.grants?.length" class="spw-grants-list">
              <div v-for="g in research.grants.grants" :key="g.name" class="spw-grant-card">
                <div class="spw-grant-name">{{ g.name }}</div>
                <div class="spw-grant-meta">
                  <span>{{ g.provider }}</span>
                  <span class="spw-grant-amount">до {{ g.maxAmount }}</span>
                  <span :class="['spw-grant-fit', `spw-gf--${g.fit}`]">{{ g.fitLabel }}</span>
                </div>
                <div class="spw-grant-rec">{{ g.recommendation }}</div>
              </div>
            </div>
            <div v-else class="spw-doc-placeholder">
              <i class="pi pi-money-bill" style="font-size:48px;opacity:.3"></i>
              <p>Запустите поиск грантов — агент проанализирует все доступные программы</p>
            </div>
          </div>
        </template>

      </div><!-- /spw-main -->

      <!-- ─── RIGHT: Agents + Events ─── -->
      <div class="spw-aside">

        <!-- Active agents for current role -->
        <div class="spw-aside-section">
          <div class="spw-aside-head">Агенты</div>
          <div v-for="a in roleAgents" :key="a.id"
            :class="['spw-agent-card', { active: activeAgent === a.id }]"
            @click="activateAgent(a)">
            <span class="spw-agent-av" :style="{ background: a.color }">{{ a.icon }}</span>
            <div class="spw-agent-info">
              <div class="spw-agent-name">{{ a.name }}</div>
              <div class="spw-agent-role">{{ a.role }}</div>
            </div>
          </div>
        </div>

        <!-- Event feed -->
        <div class="spw-aside-section spw-aside-events">
          <div class="spw-aside-head">
            <span>События</span>
            <span class="spw-ev-count">{{ events.length }}</span>
          </div>
          <div class="spw-events-feed">
            <div v-for="ev in events" :key="ev.id" class="spw-ev-item">
              <div :class="['spw-ev-dot', `spw-ev-dot--${ev.type}`]"></div>
              <div class="spw-ev-body">
                <div class="spw-ev-text">{{ ev.text }}</div>
                <div class="spw-ev-time">{{ ev.time }}</div>
              </div>
            </div>
            <div v-if="!events.length" class="spw-ev-empty">События появятся по мере работы с платформой</div>
          </div>
        </div>

      </div><!-- /spw-aside -->

    </div><!-- /spw-body -->
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FstFinModelBlock from '@/components/finmodel/FstFinModelBlock.vue'

const router = useRouter()

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const ROLES = [
  { key: 'founder', label: 'Основатель', icon: 'pi pi-user', desc: 'Полный доступ к пространству компании' },
  { key: 'investor', label: 'Инвестор', icon: 'pi pi-briefcase', desc: 'DataRoom и финансовые документы' },
  { key: 'expert', label: 'Эксперт', icon: 'pi pi-star', desc: 'Технический анализ и оценки' },
]

const AGENTS = {
  navigator: { id: 'navigator', name: 'Навигатор', icon: '🤖', color: '#6366f1', role: 'Ведёт через платформу' },
  analyst:   { id: 'analyst',   name: 'Аналитик',  icon: '🔍', color: '#8b5cf6', role: 'Анализирует проект' },
  scorer:    { id: 'scorer',    name: 'Скорер',    icon: '📊', color: '#f59e0b', role: 'Оценивает по 8 критериям' },
  grants:    { id: 'grants',    name: 'Грантовед', icon: '💰', color: '#10b981', role: 'Ищет гранты и субсидии' },
  finance:   { id: 'finance',   name: 'Финансист', icon: '💹', color: '#059669', role: 'Финмодель и оценка' },
  legal:     { id: 'legal',     name: 'Юрист',     icon: '⚖️', color: '#64748b', role: 'Договора и IP' },
  risk:      { id: 'risk',      name: 'Риск',      icon: '🛡️', color: '#ef4444', role: 'Управление рисками' },
  critic:    { id: 'critic',    name: 'Критик',    icon: '🔥', color: '#475569', role: 'Стресс-тест идей' },
}

const ROLE_AGENTS = {
  founder:  ['navigator', 'analyst', 'scorer', 'grants', 'finance', 'legal', 'risk', 'critic'],
  investor: ['analyst', 'finance', 'risk'],
  expert:   ['analyst', 'scorer', 'critic', 'risk'],
}

const SCORE_LABELS = {
  technology: 'Технология', market: 'Рынок', team: 'Команда',
  finance: 'Финансы', sovereignty: 'Суверенность', competition: 'Конкуренция',
  ip: 'IP', risk: 'Риски',
}

// Artifacts tree — SIRIN документы + наши
const ARTIFACTS_ALL = [
  {
    key: 'overview', label: 'Обзор', icon: 'pi pi-th-large', roles: ['founder','investor','expert'],
    items: [
      { key: 'dashboard', label: 'Дашборд', icon: 'pi pi-chart-bar', type: 'dashboard', roles: ['founder','investor','expert'] },
      { key: 'grants', label: 'Гранты', icon: 'pi pi-money-bill', type: 'grants', roles: ['founder'] },
    ],
  },
  {
    key: 'dataroom', label: 'DataRoom', icon: 'pi pi-folder-open', roles: ['founder','investor','expert'],
    items: [
      { key: 'doc-nav',      label: 'Навигатор по пакету', icon: 'pi pi-map',              type: 'doc', required: true,
        downloadUrl: 'https://ai2o.ru/download/fst/7ac404839/47442f27815.zip' },
      { key: 'doc-teaser',   label: 'Тизер',               icon: 'pi pi-bolt',             type: 'doc', roles: ['founder','investor','expert'] },
      { key: 'doc-exec',     label: 'Executive Summary',    icon: 'pi pi-file',             type: 'doc', required: true },
      { key: 'doc-faq',      label: 'FAQ для инвестора',    icon: 'pi pi-question-circle',  type: 'doc' },
      { key: 'doc-nda',      label: 'NDA',                  icon: 'pi pi-lock',             type: 'doc', required: true },
      { key: 'doc-dataroom', label: 'Data Room (полный)',   icon: 'pi pi-database',         type: 'doc' },
      { key: 'doc-letter',   label: 'Письмо инвестору',    icon: 'pi pi-envelope',         type: 'doc' },
    ],
  },
  {
    key: 'finance', label: 'Финансы', icon: 'pi pi-chart-line', roles: ['founder','investor'],
    items: [
      { key: 'finmodel',    label: 'Финансовая модель',  icon: 'pi pi-table',    type: 'finmodel', required: true },
      { key: 'doc-bizplan', label: 'Бизнес-план',        icon: 'pi pi-book',     type: 'doc', required: true },
      { key: 'doc-nma',     label: 'Отчёт по НМА',       icon: 'pi pi-star',     type: 'doc' },
      { key: 'doc-founder', label: 'Справка основателя', icon: 'pi pi-id-card',  type: 'doc' },
    ],
  },
  {
    key: 'deal', label: 'Сделка', icon: 'pi pi-handshake', roles: ['founder','investor'],
    items: [
      { key: 'doc-termsheet',  label: 'Term Sheet (фонд)', icon: 'pi pi-file-edit',  type: 'doc', required: true },
      { key: 'doc-ts-own',     label: 'Term Sheet (наш)',  icon: 'pi pi-file-edit',  type: 'doc',
        url: 'https://ai2fund.ru/term_sheet.pdf' },
      { key: 'doc-invest',     label: 'Договор инвестирования', icon: 'pi pi-verified',  type: 'doc', required: true },
      { key: 'doc-corp',       label: 'Корпоративный договор',  icon: 'pi pi-users',     type: 'doc', required: true },
      { key: 'doc-protocol',   label: 'Протокол собрания',      icon: 'pi pi-list',      type: 'doc' },
      { key: 'doc-application',label: 'Заявление о вступлении', icon: 'pi pi-user-plus', type: 'doc', required: true },
      { key: 'doc-spouse',     label: 'Согласие супруга',       icon: 'pi pi-heart',     type: 'doc' },
    ],
  },
  {
    key: 'ip', label: 'Интеллектуальная собственность', icon: 'pi pi-shield', roles: ['founder','expert'],
    items: [
      { key: 'doc-patent',  label: 'Патентная заявка',   icon: 'pi pi-award',
        url: 'https://ai2fund.ru/patent_application.pdf', type: 'doc', filled: true },
      { key: 'doc-ts-ip',   label: 'Term Sheet (наш)',    icon: 'pi pi-file-edit',
        url: 'https://ai2fund.ru/term_sheet.pdf', type: 'doc', filled: true },
    ],
  },
  {
    key: 'agents', label: 'Агент', icon: 'pi pi-android', roles: ['founder','expert'],
    items: [
      { key: 'agent', label: 'AI-ассистент', icon: 'pi pi-comments', type: 'chat' },
    ],
  },
]

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

const role = ref('founder')
const activeView = ref('dashboard')
const activeItem = ref(null)
const activeAgent = ref('navigator')
const dragging = ref(false)
const thinking = ref(false)
const inputText = ref('')
const finmodelId = ref(null)
const docAiResponse = ref('')
const docValues = ref({})

const twin = ref({
  company: 'SIRIN', stage: 'Pre-Seed', sector: 'AI/Deep Tech',
  trl: 7, mrl: 4, teamSize: 3, askRub: 60000000,
  marketSize: '15 млрд ₽', projectedIRR: 28, runway: 18,
  revenue: 0, burnRate: 800000, completeness: 35,
  description: 'AI-платформа управления венчурным фондом',
  founder: 'Гаврилов Денис Александрович', inn: '', website: 'ai2fund.ru',
  contactEmail: '',
})

const scoring = ref({ totalScore: 0, dimensions: {}, verdict: '' })
const beacons = ref([])
const research = ref({ grants: { grants: [] } })
const chatMessages = ref([])
const events = ref([
  { id: 1, type: 'info',    text: 'Workspace создан',           time: 'Сегодня' },
  { id: 2, type: 'doc',     text: 'Получен пакет документов SIRIN (18 файлов)', time: 'Сегодня' },
  { id: 3, type: 'ip',      text: 'Патентная заявка сформирована', time: 'Сегодня' },
  { id: 4, type: 'deal',    text: 'Term Sheet подготовлен',     time: 'Сегодня' },
])

// ═══════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════

const visibleArtifacts = computed(() =>
  ARTIFACTS_ALL
    .filter(s => s.roles.includes(role.value))
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.roles || i.roles.includes(role.value)),
    }))
)

const roleAgents = computed(() =>
  ROLE_AGENTS[role.value].map(id => AGENTS[id])
)

const kpiItems = computed(() => [
  { key: 'completeness', label: 'Готовность', val: twin.value.completeness + '%', color: completenessColor.value },
  { key: 'trl',     label: 'TRL',     val: twin.value.trl ? twin.value.trl + '/9' : '—' },
  { key: 'runway',  label: 'Runway',  val: twin.value.runway ? twin.value.runway + 'м' : '—' },
  { key: 'ask',     label: 'Ask',     val: twin.value.askRub ? (twin.value.askRub / 1e6).toFixed(0) + 'M₽' : '—' },
  { key: 'irr',     label: 'IRR',     val: twin.value.projectedIRR ? twin.value.projectedIRR + '%' : '—' },
])

const completenessColor = computed(() => {
  const c = twin.value.completeness
  if (c >= 80) return 'var(--p-green-500)'
  if (c >= 50) return 'var(--p-orange-400)'
  return 'var(--p-red-400)'
})

const companyMetrics = computed(() => [
  { key: 'founder',  label: 'Основатель',  val: twin.value.founder },
  { key: 'inn',      label: 'ИНН',         val: twin.value.inn },
  { key: 'sector',   label: 'Отрасль',     val: twin.value.sector },
  { key: 'team',     label: 'Команда',     val: twin.value.teamSize ? twin.value.teamSize + ' чел.' : '' },
  { key: 'revenue',  label: 'Выручка',     val: twin.value.revenue ? (twin.value.revenue / 1e6).toFixed(1) + 'M₽' : '0' },
  { key: 'burn',     label: 'Burn Rate',   val: twin.value.burnRate ? (twin.value.burnRate / 1e3).toFixed(0) + 'k₽/мес' : '' },
  { key: 'website',  label: 'Сайт',        val: twin.value.website },
])

const docStatus = computed(() => [
  { key: 'exec',    label: 'ExecSummary',  icon: 'pi pi-file',    status: 'empty' },
  { key: 'bizplan', label: 'Бизнес-план',  icon: 'pi pi-book',    status: 'empty' },
  { key: 'finmodel',label: 'Финмодель',    icon: 'pi pi-table',   status: 'partial' },
  { key: 'termsheet',label: 'Term Sheet',  icon: 'pi pi-file-edit',status: 'ok' },
  { key: 'patent',  label: 'Патент',       icon: 'pi pi-award',   status: 'ok' },
  { key: 'nda',     label: 'NDA',          icon: 'pi pi-lock',    status: 'empty' },
  { key: 'invest',  label: 'Договор',      icon: 'pi pi-verified',status: 'empty' },
])

const messagesEl = ref(null)
const inputEl = ref(null)

// ═══════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════

function agent(id) { return AGENTS[id] || AGENTS.navigator }

function openView(item) {
  activeView.value = item.key
  activeItem.value = item
  docAiResponse.value = ''
  // Switch to agent if type=chat
  if (item.type === 'chat') {
    activeView.value = 'agent'
  }
  if (item.type === 'finmodel') {
    activeView.value = 'finmodel'
  }
  if (item.type === 'grants') {
    activeView.value = 'grants'
  }
}

function activateAgent(a) {
  activeAgent.value = a.id
  openView({ key: 'agent', type: 'chat' })
  nextTick(() => {
    if (!chatMessages.value.length) {
      chatMessages.value.push({
        role: 'agent', agent: a.id,
        text: `Привет! Я ${a.name}. ${a.role}. Чем могу помочь по проекту **${twin.value.company}**?`,
      })
    }
  })
}

async function fillDocWithAI(item) {
  openView({ key: 'agent', type: 'chat' })
  const prompt = `Помоги заполнить документ «${item.label}» данными компании ${twin.value.company}:
- Основатель: ${twin.value.founder}
- Отрасль: ${twin.value.sector}
- Стадия: ${twin.value.stage}
- TRL: ${twin.value.trl}
- Запрашиваемые инвестиции: ${(twin.value.askRub/1e6).toFixed(0)} млн ₽
- Описание: ${twin.value.description}

Что нужно заполнить и какие данные запросить у основателя?`
  inputText.value = prompt
  await sendMessage()
  addEvent('doc', `Агент заполняет: ${item.label}`)
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || thinking.value) return
  inputText.value = ''
  autoResize()
  chatMessages.value.push({ role: 'user', text })
  thinking.value = true
  scrollToBottom()

  try {
    const res = await fetch('/api/startuper/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId.value,
        message: text,
        twin: twin.value,
        agentFocus: activeAgent.value,
        context: activeItem.value?.label,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.twin) Object.assign(twin.value, data.twin)
      if (data.scoring) scoring.value = data.scoring
      if (data.beacons) beacons.value = data.beacons
      chatMessages.value.push({
        role: 'agent', agent: data.agent || activeAgent.value,
        text: data.reply, scoreCard: data.scoreCard || null,
      })
      addEvent('agent', 'Агент ответил на запрос')
    }
  } catch (e) {
    // Fallback response
    chatMessages.value.push({
      role: 'agent', agent: activeAgent.value,
      text: `Обрабатываю запрос по **${twin.value.company}**. Для полной работы необходимо подключение к серверу.`,
    })
  } finally {
    thinking.value = false
    scrollToBottom()
    saveLS()
  }
}

const sessionId = ref(null)

async function initSession() {
  try {
    const res = await fetch('/api/startuper/session', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      sessionId.value = data.sessionId
    }
  } catch {}
  if (!sessionId.value) sessionId.value = 'local-' + Date.now()
}

function loadDemo(name) {
  if (name === 'sirin') {
    twin.value = {
      company: 'SIRIN', stage: 'Pre-Seed', sector: 'AI / FinTech',
      trl: 7, mrl: 4, teamSize: 3, askRub: 60000000,
      marketSize: '15 млрд ₽', projectedIRR: 28, runway: 18,
      revenue: 0, burnRate: 800000, completeness: 35,
      description: 'AI-платформа управления венчурным фондом. VentureOS — полный цикл: заявка → ИК → сделка → мониторинг → выход.',
      founder: 'Гаврилов Денис Александрович', inn: '', website: 'ai2fund.ru',
      contactEmail: 'unidel@yandex.ru',
    }
    addEvent('info', 'Загружены демо-данные SIRIN')
  }
}

function clearSession() {
  chatMessages.value = []
  scoring.value = { totalScore: 0, dimensions: {}, verdict: '' }
  beacons.value = []
  sessionId.value = null
  initSession()
}

function sendToIC() {
  router.push('/fst-committee')
  addEvent('deal', 'Проект направлен в инвесткомитет')
}

async function runResearch() {
  if (!sessionId.value) return
  try {
    const res = await fetch('/api/startuper/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, twin: twin.value }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.grants) research.value.grants = data.grants
    }
  } catch {}
}

async function createFinmodel() {
  openView({ key: 'agent', type: 'chat' })
  inputText.value = `Создай финансовую модель для компании ${twin.value.company}:
- Запрашиваемые инвестиции: ${(twin.value.askRub/1e6).toFixed(0)} млн ₽
- Выручка Y1: целевая, Y5: с учётом роста рынка ${twin.value.marketSize}
- Burn rate: ${(twin.value.burnRate/1e3).toFixed(0)}k₽/мес, Runway: ${twin.value.runway} мес.
- Целевой IRR: ${twin.value.projectedIRR}%`
  await sendMessage()
}

// Files
async function onFileInput(e) { await handleFiles([...e.target.files]) }
async function onDrop(e) { dragging.value = false; await handleFiles([...e.dataTransfer.files]) }
async function onPaste(e) {
  const items = [...(e.clipboardData?.items || [])]
  const imageItem = items.find(i => i.type.startsWith('image/'))
  if (imageItem) {
    const blob = imageItem.getAsFile()
    await handleFiles([blob])
  }
}

async function handleFiles(files) {
  for (const file of files) {
    openView({ key: 'agent', type: 'chat' })
    if (file.type.startsWith('image/')) {
      const dataUrl = await readAsDataUrl(file)
      chatMessages.value.push({ role: 'user', isImage: true, dataUrl, text: '' })
    } else {
      chatMessages.value.push({ role: 'user', file: file.name, text: '' })
    }
    thinking.value = true
    scrollToBottom()
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (sessionId.value) fd.append('sessionId', sessionId.value)
      const res = await fetch('/api/startuper/parse', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        if (data.twin) Object.assign(twin.value, data.twin)
        if (data.reply) chatMessages.value.push({ role: 'agent', agent: 'analyst', text: data.reply })
      }
    } catch (err) {
      chatMessages.value.push({ role: 'agent', agent: 'analyst', text: `Файл **${file.name}** получен. Анализирую...` })
    } finally {
      thinking.value = false
      scrollToBottom()
      saveLS()
    }
  }
}

function readAsDataUrl(blob) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(blob) })
}

// Helpers
function scrollToBottom() {
  nextTick(() => { if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight })
}
function autoResize() {
  nextTick(() => {
    if (inputEl.value) { inputEl.value.style.height = 'auto'; inputEl.value.style.height = inputEl.value.scrollHeight + 'px' }
  })
}
function addEvent(type, text) {
  events.value.unshift({ id: Date.now(), type, text, time: new Date().toLocaleTimeString('ru') })
}
function scoreColor(s) { return s >= 8 ? 'var(--p-green-500)' : s >= 6 ? 'var(--p-orange-400)' : 'var(--p-red-400)' }
function scoreClass(s) { return s >= 70 ? 'good' : s >= 50 ? 'mid' : 'low' }
function md(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

// Persistence
const LS_KEY = 'spw_v1'
function saveLS() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ twin: twin.value, scoring: scoring.value, events: events.value.slice(0, 20) })) } catch {}
}
function loadLS() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    if (d.twin) Object.assign(twin.value, d.twin)
    if (d.scoring) scoring.value = d.scoring
    if (d.events?.length) events.value = d.events
  } catch {}
}

watch([twin, scoring], saveLS, { deep: true })

onMounted(() => {
  loadLS()
  initSession()
})
</script>

<style scoped>
/* ══ Root ══ */
.spw {
  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
  background: var(--p-surface-ground);
  font-family: var(--p-font-family, system-ui);
}

/* ══ Topbar ══ */
.spw-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; gap: 16px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0; z-index: 10;
}
.spw-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.spw-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.spw-topbar-sep { width: 1px; height: 20px; background: var(--p-content-border-color); }

.spw-co-name { font-size: 15px; font-weight: 700; color: var(--p-text-color); white-space: nowrap; }

.spw-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 20px;
  font-weight: 600; white-space: nowrap;
}
.spw-badge--blue { background: var(--p-blue-100); color: var(--p-blue-700); }
.spw-badge--purple { background: var(--p-purple-100); color: var(--p-purple-700); }

.spw-kpi-strip { display: flex; gap: 16px; margin-left: 8px; }
.spw-kpi { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.spw-kpi-val { font-size: 14px; font-weight: 700; line-height: 1; }
.spw-kpi-label { font-size: 10px; color: var(--p-text-muted-color); white-space: nowrap; }

/* Role tabs */
.spw-roles { display: flex; gap: 2px; background: var(--p-surface-ground); border-radius: 8px; padding: 3px; }
.spw-role-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border: none; cursor: pointer; border-radius: 6px;
  background: transparent; color: var(--p-text-muted-color);
  font-size: 12px; font-weight: 500; transition: all .15s;
}
.spw-role-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.spw-role-btn.active { background: var(--p-surface-card); color: var(--p-primary-color); font-weight: 600; }

/* ══ Body ══ */
.spw-body {
  display: grid;
  grid-template-columns: 220px 1fr 260px;
  flex: 1; overflow: hidden;
}

/* ══ Nav sidebar ══ */
.spw-nav {
  background: var(--p-surface-card);
  border-right: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 8px 0;
}
.spw-nav-section { margin-bottom: 4px; }
.spw-nav-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px 4px;
  font-size: 11px; font-weight: 700; letter-spacing: .4px;
  color: var(--p-text-muted-color); text-transform: uppercase;
}
.spw-nav-item {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 14px 6px 20px;
  font-size: 12.5px; cursor: pointer; color: var(--p-text-color);
  transition: background .1s; position: relative;
}
.spw-nav-item:hover { background: var(--p-surface-hover); }
.spw-nav-item.active {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: var(--p-primary-color); font-weight: 600;
}
.spw-nav-dot {
  width: 7px; height: 7px; border-radius: 50%; margin-left: auto; flex-shrink: 0;
}
.spw-nav-dot--ok { background: var(--p-green-500); }
.spw-nav-dot--empty { background: var(--p-orange-400); }

/* ══ Main ══ */
.spw-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* Dashboard */
.spw-dash { padding: 20px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; gap: 16px; }
.spw-dash-row { display: flex; gap: 16px; }
.spw-card {
  background: var(--p-surface-card); border-radius: 10px;
  border: 1px solid var(--p-content-border-color);
  padding: 16px; flex: 1;
}
.spw-card--wide { flex: 2; }
.spw-card--start { border: 2px dashed var(--p-content-border-color); text-align: center; }
.spw-card-head { font-size: 12px; font-weight: 700; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }

.spw-complete-bar { height: 8px; background: var(--p-surface-ground); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.spw-complete-fill { height: 100%; border-radius: 4px; transition: width .4s; }
.spw-complete-label { font-size: 12px; color: var(--p-text-muted-color); margin-bottom: 12px; }

.spw-doc-status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
.spw-ds {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 8px; border-radius: 6px; font-size: 11px;
}
.spw-ds--ok { background: color-mix(in srgb, var(--p-green-500) 12%, transparent); color: var(--p-green-600); }
.spw-ds--partial { background: color-mix(in srgb, var(--p-orange-400) 12%, transparent); color: var(--p-orange-600); }
.spw-ds--empty { background: var(--p-surface-ground); color: var(--p-text-muted-color); }

.spw-metric-list { display: flex; flex-direction: column; gap: 6px; }
.spw-ml-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.spw-ml-label { color: var(--p-text-muted-color); }
.spw-ml-val { font-weight: 600; }

.spw-score-grid { display: flex; flex-direction: column; gap: 6px; }
.spw-score-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.spw-score-label { width: 110px; color: var(--p-text-muted-color); }
.spw-score-track { flex: 1; height: 6px; background: var(--p-surface-ground); border-radius: 3px; overflow: hidden; }
.spw-score-track div { height: 100%; border-radius: 3px; transition: width .4s; }
.spw-score-num { width: 20px; text-align: right; font-size: 12px; }

.spw-beacon { padding: 6px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 4px; }
.spw-beacon--warn { background: color-mix(in srgb, var(--p-orange-400) 12%, transparent); color: var(--p-orange-700); }
.spw-beacon--error { background: color-mix(in srgb, var(--p-red-400) 12%, transparent); color: var(--p-red-700); }
.spw-beacon--info { background: color-mix(in srgb, var(--p-blue-500) 10%, transparent); color: var(--p-blue-700); }

.spw-start-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
.spw-demo-btn {
  background: none; border: none; cursor: pointer; color: var(--p-primary-color);
  font-size: 12px; padding: 4px 8px; border-radius: 4px;
}
.spw-demo-btn:hover { background: var(--p-surface-hover); }

/* Chat */
.spw-chat-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.spw-divider { text-align: center; font-size: 11px; color: var(--p-text-muted-color); padding: 4px 0; }
.spw-msg { display: flex; gap: 8px; max-width: 85%; }
.spw-msg--user { flex-direction: row-reverse; align-self: flex-end; }
.spw-msg--agent { align-self: flex-start; }
.spw-msg-av {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.spw-msg-av--user { background: var(--p-primary-color); color: #fff; }
.spw-msg-body { display: flex; flex-direction: column; gap: 4px; }
.spw-msg-agent-name { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
.spw-msg-text {
  font-size: 13px; line-height: 1.5;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  padding: 8px 12px; border-radius: 10px;
}
.spw-msg--user .spw-msg-text {
  background: var(--p-primary-color); color: #fff; border-color: transparent;
}
.spw-msg-img { max-width: 200px; border-radius: 8px; }
.spw-msg-file { font-size: 12px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; }
.spw-typing { display: flex; gap: 4px; padding: 8px 12px; background: var(--p-surface-card); border-radius: 10px; width: fit-content; }
.spw-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--p-text-muted-color); animation: bounce .8s infinite; }
.spw-typing span:nth-child(2) { animation-delay: .15s; }
.spw-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

.spw-score-card { background: var(--p-surface-ground); border-radius: 8px; padding: 10px; margin-top: 6px; }
.spw-sc-total { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
.spw-sc-total span { font-size: 13px; font-weight: 400; color: var(--p-text-muted-color); }
.spw-sc-total.good { color: var(--p-green-500); }
.spw-sc-total.mid { color: var(--p-orange-400); }
.spw-sc-total.low { color: var(--p-red-400); }
.spw-sc-bars { display: flex; flex-direction: column; gap: 5px; }
.spw-sc-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.spw-sc-row span { width: 90px; color: var(--p-text-muted-color); }
.spw-sc-track { flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.spw-sc-track div { height: 100%; border-radius: 3px; }

.spw-event-pill {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.spw-ep--info { background: var(--p-blue-100); color: var(--p-blue-700); }
.spw-ep--ok   { background: var(--p-green-100); color: var(--p-green-700); }
.spw-ep--warn { background: var(--p-orange-100); color: var(--p-orange-700); }

.spw-input-bar {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 16px; border-top: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}
.spw-attach-btn {
  padding: 8px; cursor: pointer; color: var(--p-text-muted-color);
  border-radius: 6px; transition: all .15s;
}
.spw-attach-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.spw-input {
  flex: 1; border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 8px 12px; font-size: 13px; resize: none; overflow: hidden;
  background: var(--p-surface-ground); color: var(--p-text-color);
  max-height: 120px; line-height: 1.5; outline: none; font-family: inherit;
}
.spw-input:focus { border-color: var(--p-primary-color); }
.spw-send-btn {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: var(--p-surface-hover); color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all .15s;
}
.spw-send-btn.active { background: var(--p-primary-color); color: #fff; }

/* Document view */
.spw-doc-view { display: flex; flex-direction: column; height: 100%; }
.spw-doc-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card); flex-shrink: 0;
}
.spw-doc-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex: 1; }
.spw-doc-actions { display: flex; gap: 6px; }
.spw-doc-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.spw-doc-iframe { flex: 1; border: none; width: 100%; min-height: 500px; }
.spw-doc-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  text-align: center; padding: 40px; color: var(--p-text-muted-color);
}
.spw-doc-placeholder h3 { margin: 0; font-size: 16px; color: var(--p-text-color); }
.spw-doc-placeholder p { margin: 0; font-size: 13px; line-height: 1.6; }
.spw-doc-fields { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.spw-doc-field { display: flex; flex-direction: column; gap: 4px; text-align: left; }
.spw-doc-field label { font-size: 11px; color: var(--p-text-muted-color); }
.spw-field-input {
  border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 6px 10px; font-size: 13px; background: var(--p-surface-ground); color: var(--p-text-color);
}
.spw-doc-ai-resp {
  padding: 16px; margin: 12px; border-radius: 8px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  font-size: 13px; line-height: 1.6;
}

/* FinModel */
.spw-finmodel-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-finmodel-body { flex: 1; overflow: auto; }

/* Grants */
.spw-grants-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-grants-list { padding: 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.spw-grant-card {
  background: var(--p-surface-card); border-radius: 8px;
  border: 1px solid var(--p-content-border-color); padding: 12px;
}
.spw-grant-name { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
.spw-grant-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 6px; }
.spw-grant-amount { font-weight: 700; color: var(--p-green-600); }
.spw-grant-fit { padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.spw-gf--high { background: var(--p-green-100); color: var(--p-green-700); }
.spw-gf--mid  { background: var(--p-orange-100); color: var(--p-orange-700); }
.spw-gf--low  { background: var(--p-surface-ground); color: var(--p-text-muted-color); }
.spw-grant-rec { font-size: 12px; color: var(--p-text-muted-color); }

/* ══ Aside ══ */
.spw-aside {
  background: var(--p-surface-card);
  border-left: 1px solid var(--p-content-border-color);
  display: flex; flex-direction: column; overflow: hidden;
}
.spw-aside-section { display: flex; flex-direction: column; border-bottom: 1px solid var(--p-content-border-color); }
.spw-aside-head {
  padding: 10px 14px; font-size: 11px; font-weight: 700;
  color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: .4px;
  display: flex; align-items: center; justify-content: space-between;
}
.spw-ev-count { background: var(--p-primary-color); color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 10px; }

.spw-agent-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer; transition: background .1s;
}
.spw-agent-card:hover { background: var(--p-surface-hover); }
.spw-agent-card.active { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.spw-agent-av { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.spw-agent-name { font-size: 12px; font-weight: 600; }
.spw-agent-role { font-size: 11px; color: var(--p-text-muted-color); }

.spw-aside-events { flex: 1; overflow: hidden; min-height: 0; }
.spw-events-feed { overflow-y: auto; flex: 1; padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; height: calc(100% - 36px); }
.spw-ev-item { display: flex; gap: 8px; align-items: flex-start; }
.spw-ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.spw-ev-dot--info  { background: var(--p-blue-500); }
.spw-ev-dot--doc   { background: var(--p-purple-500); }
.spw-ev-dot--deal  { background: var(--p-green-500); }
.spw-ev-dot--ip    { background: var(--p-orange-400); }
.spw-ev-dot--agent { background: var(--p-primary-color); }
.spw-ev-text { font-size: 12px; line-height: 1.4; }
.spw-ev-time { font-size: 10px; color: var(--p-text-muted-color); }
.spw-ev-empty { font-size: 12px; color: var(--p-text-muted-color); text-align: center; padding: 16px 0; }

/* ══ Buttons ══ */
.spw-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 12px; font-weight: 500; transition: all .15s; text-decoration: none;
}
.spw-btn--primary { background: var(--p-primary-color); color: #fff; }
.spw-btn--primary:hover { opacity: .85; }
.spw-btn--outline { background: transparent; border: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.spw-btn--outline:hover { background: var(--p-surface-hover); }
.spw-btn--ghost { background: transparent; color: var(--p-text-muted-color); }
.spw-btn--ghost:hover { background: var(--p-surface-hover); color: var(--p-text-color); }

/* Drag overlay */
.spw-drag-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.spw-drag-box {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  background: var(--p-surface-card); border-radius: 16px; padding: 40px 60px;
  border: 2px dashed var(--p-primary-color); font-size: 16px; font-weight: 600;
}
.spw-drag-box i { font-size: 36px; color: var(--p-primary-color); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

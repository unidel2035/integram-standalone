<template>
  <div class="stp" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">

    <!-- Drag overlay -->
    <Transition name="fade">
      <div v-if="dragging" class="stp-drag-overlay">
        <div class="stp-drag-box">
          <i class="pi pi-paperclip"></i>
          <span>Отпустите файл</span>
        </div>
      </div>
    </Transition>

    <!-- ═══ TOOLBAR ═══ -->
    <div class="stp-bar">
      <div class="stp-bar-brand">
        <i class="pi pi-rocket"></i>
        <span class="stp-bar-name">Стартапер</span>
        <span class="stp-bar-sub">AI-агент первого касания ФСТ НТИ</span>
      </div>
      <div class="stp-bar-actions">
        <button v-if="sessionId" class="stp-btn stp-btn--ghost" @click="clearSession" title="Начать заново">
          <i class="pi pi-refresh"></i>
        </button>
        <button v-if="twin.completeness > 0" class="stp-btn stp-btn--outline" @click="goToApply">
          <i class="pi pi-file-edit"></i> Заявка
        </button>
        <button v-if="twin.completeness >= 80" class="stp-btn stp-btn--success" @click="sendToIC">
          <i class="pi pi-send"></i> В инвесткомитет
        </button>
      </div>
    </div>

    <!-- ═══ ONBOARDING ═══ -->
    <div v-if="!sessionId" class="stp-onboard">
      <div class="stp-ob-glow"></div>
      <div class="stp-ob-icon">🚀</div>
      <h1 class="stp-ob-title">Добро пожаловать в ФСТ НТИ</h1>
      <p class="stp-ob-sub">Просто напишите о проекте или прикрепите любой документ — pitch-deck, описание, финмодель, фото прототипа</p>
      <div class="stp-ob-actions">
        <button class="stp-btn stp-btn--primary stp-btn--lg" @click="startSession">
          <i class="pi pi-comments"></i> Начать диалог
        </button>
        <label class="stp-btn stp-btn--secondary stp-btn--lg">
          <i class="pi pi-upload"></i> Загрузить файл
          <input type="file" accept="*" multiple @change="onFileInput" hidden />
        </label>
      </div>
      <div class="stp-ob-formats">PDF · DOCX · XLSX · PNG · JPG · TXT · JSON</div>
      <div class="stp-ob-demo">
        <span>Демо-данные:</span>
        <button class="stp-demo-chip" @click="loadDemo('aerobot')">🚁 АэроБот (Seed, TRL 6)</button>
        <button class="stp-demo-chip" @click="loadDemo('quantum')">⚛️ КвантумВижн (Pre-Seed)</button>
        <button class="stp-demo-chip" @click="loadDemo('agro')">🌾 АгроДрон (JSON)</button>
      </div>
    </div>

    <!-- ═══ MAIN SPLIT LAYOUT ═══ -->
    <div v-else class="stp-split">

      <!-- ── LEFT: CHAT ── -->
      <div class="stp-chat-col">
        <div class="stp-messages" ref="messagesEl">
          <template v-for="(msg, i) in chatMessages" :key="i">

            <!-- Divider -->
            <div v-if="msg.role === 'divider'" class="stp-divider">
              <span>{{ msg.text }}</span>
            </div>

            <!-- USER message -->
            <div v-else-if="msg.role === 'user'" class="stp-msg stp-msg--user">
              <div class="stp-msg-body">
                <img v-if="msg.isImage" :src="msg.dataUrl" class="stp-msg-img" />
                <div v-else-if="msg.file" class="stp-msg-file">
                  <i class="pi pi-paperclip"></i> {{ msg.file }}
                </div>
                <div v-if="msg.text" v-html="md(msg.text)" class="stp-msg-text"></div>
              </div>
              <div class="stp-msg-av stp-msg-av--user">👤</div>
            </div>

            <!-- AGENT message -->
            <div v-else-if="msg.role === 'agent'" class="stp-msg stp-msg--agent">
              <div class="stp-msg-av" :style="{ background: agent(msg.agent).color }">
                {{ agent(msg.agent).icon }}
              </div>
              <div class="stp-msg-body">
                <div class="stp-msg-agent-label" :style="{ color: agent(msg.agent).color }">
                  {{ agent(msg.agent).name }}
                </div>
                <!-- Event pill -->
                <div v-if="msg.type === 'event'" :class="['stp-event-pill', 'stp-ep--' + (msg.step || 'info')]">
                  {{ msg.text }}
                </div>
                <!-- Normal text -->
                <div v-else v-html="md(msg.text)" class="stp-msg-text"></div>
                <!-- Inline scoring card when scorer finishes -->
                <div v-if="msg.scoreCard" class="stp-score-card">
                  <div class="stp-sc-total" :class="scoreClass(msg.scoreCard.totalScore)">
                    {{ msg.scoreCard.totalScore }}<span>/100</span>
                  </div>
                  <div class="stp-sc-bars">
                    <div v-for="(dim, key) in msg.scoreCard.dimensions" :key="key" class="stp-sc-row">
                      <span>{{ SCORE_LABELS[key] }}</span>
                      <div class="stp-sc-track"><div :style="{ width: dim.score * 10 + '%', background: scoreColor(dim.score) }"></div></div>
                      <b>{{ dim.score }}</b>
                    </div>
                  </div>
                  <div v-if="msg.scoreCard.verdict" class="stp-sc-verdict">{{ msg.scoreCard.verdict }}</div>
                </div>
              </div>
            </div>

          </template>

          <!-- Typing indicator -->
          <div v-if="thinking" class="stp-msg stp-msg--agent">
            <div class="stp-msg-av" :style="{ background: AGENTS.navigator.color }">🤖</div>
            <div class="stp-msg-body">
              <div class="stp-msg-agent-label" :style="{ color: AGENTS.navigator.color }">Навигатор</div>
              <div class="stp-typing"><span/><span/><span/></div>
            </div>
          </div>
        </div>

        <!-- Input bar -->
        <div class="stp-input-bar">
          <label class="stp-attach-btn" title="Прикрепить файл или фото">
            <i class="pi pi-paperclip"></i>
            <input type="file" accept="*" multiple @change="onFileInput" hidden />
          </label>
          <textarea
            v-model="inputText"
            ref="inputEl"
            class="stp-input"
            placeholder="Напишите о проекте... или перетащите файл"
            rows="1"
            @keydown.enter.exact.prevent="sendMessage"
            @input="autoResize"
            @paste="onPaste"
          ></textarea>
          <button class="stp-send-btn" :class="{ active: inputText.trim() }" @click="sendMessage" :disabled="thinking && !inputText.trim()">
            <i :class="thinking ? 'pi pi-spin pi-spinner' : 'pi pi-send'"></i>
          </button>
        </div>
      </div>

      <!-- ── RIGHT: TABS ── -->
      <div class="stp-tabs-col">
        <div class="stp-tabs-nav">
          <button :class="['stp-tnav', activeTab === 'twin' && 'on']" @click="activeTab = 'twin'">
            🧬 Двойник
            <span v-if="twin.completeness > 0" :class="['stp-tnav-badge', completenessClass]">{{ twin.completeness }}%</span>
          </button>
          <button :class="['stp-tnav', activeTab === 'apply' && 'on']" @click="activeTab = 'apply'">
            📋 Анкета
          </button>
          <button v-if="grantsCount > 0" :class="['stp-tnav', activeTab === 'grants' && 'on']" @click="activeTab = 'grants'">
            💰 Гранты <span class="stp-tnav-badge stp-tnav-badge--green">{{ grantsCount }}</span>
          </button>
          <button v-if="psychoProfile" :class="['stp-tnav', activeTab === 'psycho' && 'on']" @click="activeTab = 'psycho'">
            🧠 Психотип
            <span v-if="psychoProfile.mbti" class="stp-tnav-badge stp-tnav-badge--purple">{{ psychoProfile.mbti }}</span>
          </button>
        </div>

        <!-- TAB: ДВОЙНИК -->
        <div v-show="activeTab === 'twin'" class="stp-tab-content">
          <!-- Empty state -->
          <div v-if="twin.completeness === 0" class="stp-twin-empty">
            <div class="stp-te-icon">🧬</div>
            <p>Цифровой двойник появится после загрузки документа или диалога с агентом</p>
          </div>

          <!-- Requirements matrix -->
          <div v-else class="stp-twin-body">
            <div class="stp-matrix-title">Матрица требований ФСТ НТИ</div>
            <div class="stp-matrix">
              <div v-for="c in CRITERIA" :key="c.id" class="stp-matrix-row">
                <div class="stp-mr-status" :class="'stp-mr-status--' + criterionStatus(c)">
                  {{ statusIcon(criterionStatus(c)) }}
                </div>
                <div class="stp-mr-label">{{ c.label }}</div>
                <div class="stp-mr-val">{{ c.format(twin) }}</div>
                <div class="stp-mr-req">{{ c.req }}</div>
              </div>
            </div>

            <!-- Completeness bar -->
            <div class="stp-compl-bar">
              <div class="stp-compl-fill" :style="{ width: twin.completeness + '%' }"></div>
            </div>
            <div class="stp-compl-label">Готовность пакета: {{ twin.completeness }}%</div>

            <!-- Scoring panel -->
            <div v-if="scoring" class="stp-scoring">
              <div class="stp-scoring-head">
                Скоринг
                <span :class="['stp-scoring-total', scoreClass(scoring.totalScore)]">{{ scoring.totalScore }}/100</span>
              </div>
              <div v-for="(dim, key) in scoring.dimensions" :key="key" class="stp-sc-row">
                <span>{{ SCORE_LABELS[key] }}</span>
                <div class="stp-sc-track"><div :style="{ width: dim.score * 10 + '%', background: scoreColor(dim.score) }"></div></div>
                <b>{{ dim.score }}</b>
              </div>
              <div v-if="scoring.verdict" class="stp-sc-verdict">{{ scoring.verdict }}</div>
            </div>

            <!-- Beacons / Anomalies -->
            <div v-if="beacons.length" class="stp-beacons">
              <div class="stp-beacons-title">
                <i class="pi pi-flag-fill"></i> Маяки для инвесткомитета
                <span class="stp-beacons-count">{{ beacons.length }}</span>
              </div>
              <div v-for="(b, i) in beacons" :key="i" :class="['stp-beacon', 'stp-beacon--' + b.severity]">
                <div class="stp-beacon-top">
                  <span :class="['stp-beacon-sev', 'stp-bs--' + b.severity]">
                    {{ b.severity === 'high' ? '🔴 Высокий' : b.severity === 'medium' ? '🟡 Средний' : '🟢 Низкий' }}
                  </span>
                  <span class="stp-beacon-dim">{{ b.dimension }}</span>
                </div>
                <div class="stp-beacon-text">{{ b.text }}</div>
                <div v-if="b.recommendation" class="stp-beacon-rec">💡 {{ b.recommendation }}</div>
              </div>
            </div>

            <!-- Research CTA -->
            <div class="stp-research-cta">
              <button v-if="!researching" class="stp-btn stp-btn--warning stp-btn--full" @click="triggerResearch">
                <i class="pi pi-search"></i> Полное исследование (ЕГРЮЛ · ФИПС · СМИ · Гранты)
              </button>
              <div v-else class="stp-researching">
                <i class="pi pi-spin pi-spinner"></i> Исследую компанию...
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: ПСИХОПРОФИЛЬ -->
        <div v-show="activeTab === 'psycho'" class="stp-tab-content">
          <div v-if="!psychoProfile" class="stp-twin-empty">
            <div class="stp-te-icon">🧠</div>
            <p>Психопрофиль появится после 5+ ответов фаундера</p>
          </div>
          <div v-else class="stp-psycho">
            <!-- MBTI badge -->
            <div class="stp-psycho-header">
              <div class="stp-mbti-badge">{{ psychoProfile.mbti || '?' }}</div>
              <div class="stp-psycho-meta">
                <div class="stp-psycho-summary">{{ psychoProfile.summary }}</div>
                <div class="stp-psycho-conf">Уверенность модели: {{ Math.round((psychoProfile.confidence || 0) * 100) }}%</div>
              </div>
            </div>

            <!-- Signals -->
            <div v-if="psychoProfile.signals" class="stp-signals">
              <div class="stp-signals-title">Сигналы коммуникации</div>
              <div v-for="(val, key) in psychoProfile.signals" :key="key" class="stp-sig-row">
                <span class="stp-sig-label">{{ SIGNAL_LABELS[key] || key }}</span>
                <div class="stp-sig-track">
                  <div class="stp-sig-fill" :style="{ width: val * 10 + '%', background: val >= 7 ? '#4caf50' : val >= 4 ? '#ff9800' : '#ef5350' }"></div>
                </div>
                <b class="stp-sig-val">{{ val }}/10</b>
              </div>
            </div>

            <!-- Red flags -->
            <div v-if="psychoProfile.redFlags?.length" class="stp-flags">
              <div class="stp-flags-title">🚩 Красные флаги</div>
              <div v-for="(f, i) in psychoProfile.redFlags" :key="i" class="stp-flag stp-flag--red">{{ f }}</div>
            </div>

            <!-- Green signals -->
            <div v-if="psychoProfile.greenSignals?.length" class="stp-flags">
              <div class="stp-flags-title">✅ Зелёные сигналы</div>
              <div v-for="(g, i) in psychoProfile.greenSignals" :key="i" class="stp-flag stp-flag--green">{{ g }}</div>
            </div>
          </div>
        </div>

        <!-- TAB: АНКЕТА -->
        <div v-show="activeTab === 'apply'" class="stp-tab-content">
          <div v-if="twin.completeness === 0" class="stp-twin-empty">
            <div class="stp-te-icon">📋</div>
            <p>Поля анкеты заполнятся автоматически по мере диалога</p>
          </div>
          <div v-else class="stp-apply-preview">
            <div class="stp-ap-group">
              <div class="stp-ap-group-title">Компания</div>
              <div class="stp-ap-row"><span>Название</span><b>{{ twin.company || '—' }}</b></div>
              <div class="stp-ap-row"><span>ИНН</span><b>{{ twin.inn || '—' }}</b></div>
              <div class="stp-ap-row"><span>Сектор</span><b>{{ twin.sector || '—' }}</b></div>
              <div class="stp-ap-row"><span>Стадия</span><b>{{ twin.stage || '—' }}</b></div>
              <div class="stp-ap-row"><span>Команда</span><b>{{ twin.teamSize ? twin.teamSize + ' чел' : '—' }}</b></div>
              <div class="stp-ap-row"><span>Сайт</span><b>{{ twin.website || '—' }}</b></div>
            </div>
            <div class="stp-ap-group">
              <div class="stp-ap-group-title">Технология</div>
              <div class="stp-ap-row"><span>TRL</span><b>{{ twin.trl ? 'TRL ' + twin.trl : '—' }}</b></div>
              <div class="stp-ap-row"><span>MRL</span><b>{{ twin.mrl ? 'MRL ' + twin.mrl : '—' }}</b></div>
              <div class="stp-ap-row stp-ap-row--full"><span>Описание</span><b>{{ twin.description || '—' }}</b></div>
            </div>
            <div class="stp-ap-group">
              <div class="stp-ap-group-title">Финансы</div>
              <div class="stp-ap-row"><span>Запрос</span><b>{{ twin.askRub ? (twin.askRub/1e6).toFixed(0) + ' млн ₽' : '—' }}</b></div>
              <div class="stp-ap-row"><span>TAM</span><b>{{ twin.marketSize ? (twin.marketSize/1e9).toFixed(1) + ' млрд ₽' : '—' }}</b></div>
              <div class="stp-ap-row"><span>IRR</span><b>{{ twin.projectedIRR ? (twin.projectedIRR*100).toFixed(0) + '%' : '—' }}</b></div>
              <div class="stp-ap-row"><span>Runway</span><b>{{ twin.runway ? twin.runway + ' мес' : '—' }}</b></div>
            </div>
            <div class="stp-ap-group">
              <div class="stp-ap-group-title">Команда</div>
              <div class="stp-ap-row"><span>Основатель</span><b>{{ twin.founderName || '—' }}</b></div>
              <div class="stp-ap-row stp-ap-row--full"><span>Биография</span><b>{{ (twin.founderBio || '').slice(0, 120) || '—' }}</b></div>
            </div>
            <div v-if="twin.competitors?.length" class="stp-ap-group">
              <div class="stp-ap-group-title">Конкуренты</div>
              <div class="stp-ap-chips">
                <span v-for="c in twin.competitors" :key="c" class="stp-chip">{{ c }}</span>
              </div>
            </div>
            <button class="stp-btn stp-btn--accent stp-btn--full" style="margin-top:8px" @click="goToApply">
              <i class="pi pi-file-edit"></i> Открыть полную заявку
            </button>
          </div>
        </div>

        <!-- TAB: ГРАНТЫ -->
        <div v-show="activeTab === 'grants'" class="stp-tab-content">
          <div v-if="!research?.grants?.grants?.length" class="stp-twin-empty">
            <div class="stp-te-icon">💰</div>
            <p>Запустите исследование — подберём подходящие гранты</p>
          </div>
          <div v-else>
            <div v-for="g in research.grants.grants" :key="g.name" class="stp-grant-card">
              <div class="stp-gc-top">
                <b>{{ g.name }}</b>
                <span :class="['stp-gc-fit', g.fit?.includes('высок') ? 'high' : g.fit?.includes('средн') ? 'med' : 'low']">{{ g.fit }}</span>
              </div>
              <div class="stp-gc-sub">{{ g.provider }} · до {{ g.maxAmount ? (g.maxAmount/1e6).toFixed(0) + 'M₽' : '?' }}</div>
              <div class="stp-gc-comment">{{ g.comment }}</div>
            </div>
            <div v-if="research.grants.topRecommendation" class="stp-grant-rec">
              💡 {{ research.grants.topRecommendation }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStartuperStore } from '@/stores/startuperStore'
import { useEventStore } from '@/stores/eventStore.js'
import { useGrEventStore } from '@/stores/grEventStore.js'

const API = '/api/startuper'
const router = useRouter()
const startuperStore = useStartuperStore()
const eventStore = useEventStore()
const grEventStore = useGrEventStore()

// Хелпер: добавить событие в ленту лида
function leadEvent(type, data = {}) {
  if (sessionId.value) eventStore.addLeadEvent(sessionId.value, type, data)
}

// ── Agents ────────────────────────────────────────────────────
const AGENTS = {
  // Первого касания
  navigator: { id: 'navigator', name: 'Навигатор',             icon: '🤖', color: '#6366f1' },
  analyst:   { id: 'analyst',   name: 'Аналитик',              icon: '🔍', color: '#a855f7' },
  scorer:    { id: 'scorer',    name: 'Скорер',                 icon: '📊', color: '#f59e0b' },
  grants:    { id: 'grants',    name: 'Грантовед',              icon: '💰', color: '#10b981' },
  // Агенты инвесткомитета
  tech:      { id: 'tech',      name: 'Технический аналитик',  icon: '⚙️',  color: '#42a5f5' },
  finance:   { id: 'finance',   name: 'Финансовый аналитик',   icon: '💹', color: '#66bb6a' },
  risk:      { id: 'risk',      name: 'Риск-менеджер',          icon: '🛡️',  color: '#ef5350' },
  devil:     { id: 'devil',     name: 'Критический аналитик',  icon: '🔥', color: '#78909c' },
}
function agent(id) { return AGENTS[id] || AGENTS.navigator }

const SCORE_LABELS = {
  technology: 'Технологии', market: 'Рынок', team: 'Команда', finance: 'Финансы',
  sovereignty: 'Суверенность', competition: 'Конкуренция', ip: 'IP/Патенты', risk: 'Риски'
}

const SIGNAL_LABELS = {
  concreteness: 'Конкретность', resilience: 'Стрессоустойчивость',
  honesty: 'Честность', expertise: 'Экспертиза', trackRecord: 'Track Record'
}

// ── Requirements matrix ───────────────────────────────────────
const CRITERIA = [
  {
    id: 'trl', label: 'TRL', req: '≥ 5',
    format: t => t.trl ? `TRL ${t.trl}` : '—',
    status: t => !t.trl ? 'unknown' : t.trl >= 5 ? 'ok' : t.trl >= 3 ? 'warn' : 'fail'
  },
  {
    id: 'sector', label: 'Сектор', req: 'БАС / Роботы / МЭ',
    format: t => t.sector || '—',
    status: t => !t.sector ? 'unknown' : ['BAS','ROBO','ME'].includes(t.sector) ? 'ok' : 'warn'
  },
  {
    id: 'stage', label: 'Стадия', req: 'Seed — Серия A',
    format: t => t.stage || '—',
    status: t => !t.stage ? 'unknown' : ['seed','a','pre-seed'].includes(t.stage?.toLowerCase()) ? 'ok' : 'warn'
  },
  {
    id: 'ask', label: 'Запрос инвестиций', req: '50–500 млн ₽',
    format: t => t.askRub ? `${(t.askRub/1e6).toFixed(0)} млн ₽` : '—',
    status: t => !t.askRub ? 'unknown' : (t.askRub >= 50e6 && t.askRub <= 500e6) ? 'ok' : 'warn'
  },
  {
    id: 'team', label: 'Команда', req: '≥ 3 чел',
    format: t => t.teamSize ? `${t.teamSize} чел` : '—',
    status: t => !t.teamSize ? 'unknown' : t.teamSize >= 3 ? 'ok' : t.teamSize >= 2 ? 'warn' : 'fail'
  },
  {
    id: 'runway', label: 'Runway', req: '≥ 6 мес',
    format: t => t.runway ? `${t.runway} мес` : '—',
    status: t => !t.runway ? 'unknown' : t.runway >= 6 ? 'ok' : t.runway >= 3 ? 'warn' : 'fail'
  },
  {
    id: 'market', label: 'Рынок (TAM)', req: '≥ 10 млрд ₽',
    format: t => t.marketSize ? `${(t.marketSize/1e9).toFixed(1)} млрд ₽` : '—',
    status: t => !t.marketSize ? 'unknown' : t.marketSize >= 10e9 ? 'ok' : t.marketSize >= 3e9 ? 'warn' : 'fail'
  },
  {
    id: 'irr', label: 'IRR прогноз', req: '20–80%',
    format: t => t.projectedIRR ? `${(t.projectedIRR*100).toFixed(0)}%` : '—',
    status: t => !t.projectedIRR ? 'unknown' : (t.projectedIRR >= 0.2 && t.projectedIRR <= 0.8) ? 'ok' : 'warn'
  },
  {
    id: 'competitors', label: 'Конкуренты', req: 'названы',
    format: t => t.competitors?.length ? `${t.competitors.length} назв.` : '—',
    status: t => !t.competitors?.length ? 'fail' : 'ok'
  },
  {
    id: 'founder', label: 'Фаундер', req: 'указан',
    format: t => t.founderName || '—',
    status: t => t.founderName ? 'ok' : 'unknown'
  },
]

function criterionStatus(c) { return c.status(twin.value) }
function statusIcon(s) { return s === 'ok' ? '✅' : s === 'warn' ? '⚠️' : s === 'fail' ? '🔴' : '○' }

// ── State ─────────────────────────────────────────────────────
const sessionId    = ref(null)
const chatMessages = ref([])       // unified stream
const twin = ref({
  completeness: 0, company: null, inn: null, description: null, problem: null, solution: null,
  trl: null, mrl: null, teamSize: null, stage: null, askRub: null, marketSize: null,
  projectedIRR: null, competitors: [], founderName: null, founderBio: null,
  revenue: null, burnRate: null, runway: null, sector: null, website: null,
  contactEmail: null, metricsHistory: null
})
const scoring       = ref(null)
const research      = ref(null)
const psychoProfile = ref(null)
const beacons       = ref([])
const inputText    = ref('')
const thinking     = ref(false)
const researching  = ref(false)
const dragging     = ref(false)
const activeTab    = ref('twin')
const messagesEl   = ref(null)
const inputEl      = ref(null)
const saving       = ref(false)
let   sseSource    = null

const completenessClass = computed(() => {
  const c = twin.value.completeness
  return c >= 80 ? 'badge-green' : c >= 50 ? 'badge-orange' : 'badge-red'
})
const grantsCount = computed(() => research.value?.grants?.grants?.length || 0)

function scoreColor(v) {
  return v >= 7 ? '#4caf50' : v >= 4 ? '#ff9800' : '#ef5350'
}
function scoreClass(s) {
  return s >= 70 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low'
}

// ── Markdown renderer ─────────────────────────────────────────
function md(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

// ── Chat helpers ──────────────────────────────────────────────
function pushUser(text, opts = {}) {
  chatMessages.value.push({ role: 'user', text, ...opts })
  scrollBottom()
}
function pushAgent(text, agentId = 'navigator', opts = {}) {
  chatMessages.value.push({ role: 'agent', agent: agentId, text, ...opts })
  scrollBottom()
}
function pushEvent(text, agentId, step) {
  chatMessages.value.push({ role: 'agent', agent: agentId, type: 'event', step, text })
  scrollBottom()
}
function scrollBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}
function autoResize() {
  if (inputEl.value) {
    inputEl.value.style.height = 'auto'
    inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 160) + 'px'
  }
}

// ── SSE stream ────────────────────────────────────────────────
function startSSE(sid) {
  if (sseSource) sseSource.close()
  sseSource = new EventSource(`${API}/stream/${sid}`)
  sseSource.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data)
      handleSSE(ev)
    } catch {}
  }
  sseSource.onerror = () => { researching.value = false }
}

function handleSSE(ev) {
  // Handle events that don't require a message field first
  if (ev.type === 'ANOMALIES') {
    if (ev.anomalies?.length) beacons.value = ev.anomalies
    return
  }
  if (ev.type === 'COMPLETENESS') {
    const prev = twin.value.completeness
    if (ev.twin) Object.assign(twin.value, ev.twin)
    leadEvent('TWIN_UPDATED', { completeness: twin.value.completeness })
    if (prev < 30 && twin.value.completeness >= 30) leadEvent('TWIN_THRESHOLD_30', { completeness: twin.value.completeness })
    if (prev < 80 && twin.value.completeness >= 80) leadEvent('TWIN_THRESHOLD_80', { completeness: twin.value.completeness })
    return
  }
  if (!ev.message) return
  // Map event type → agent
  const agentId =
    ev.step === 'scoring'     ? 'scorer'    :
    ev.step === 'grants'      ? 'grants'    :
    ev.type === 'RESEARCH_DONE' ? 'scorer'  :
    'analyst'

  if (ev.type === 'RESEARCH_START') {
    pushEvent(ev.message, 'analyst', 'start')
  } else if (ev.type === 'STEP_START') {
    if (ev.step === 'ic_agents') {
      chatMessages.value.push({ role: 'divider', text: '🏛️ Первичный анализ агентов инвесткомитета' })
    }
    pushEvent(ev.message, agentId, ev.step)
  } else if (ev.type === 'STEP_DONE') {
    pushEvent(ev.message, agentId, ev.step)
    // Фиксируем завершение конкретных шагов
    if (ev.step === 'egrul')       leadEvent('EGRUL_CHECKED',       { company: ev.company, inn: ev.inn })
    if (ev.step === 'patents')     leadEvent('PATENTS_FOUND',       { count: ev.count || 0, patents: ev.patents })
    if (ev.step === 'competitors') leadEvent('COMPETITORS_ANALYZED',{ count: ev.count || 0 })
    if (ev.step === 'grants')      leadEvent('GRANTS_MATCHED',      { count: ev.grantsCount || 0, grantIds: ev.grantIds })
    if (ev.step === 'ic_agents')   leadEvent('IC_PRELIM_DONE',      { icAgentsCount: ev.agentsCount || 0 })
  } else if (ev.type === 'RESEARCH_DONE') {
    researching.value = false
    if (ev.scoring)  scoring.value  = ev.scoring
    if (ev.research) research.value = ev.research
    if (grantsCount.value > 0) activeTab.value = 'twin'
    pushAgent(ev.message, 'scorer', { scoreCard: ev.scoring })
    // Скоринг в ленту
    if (ev.scoring) {
      leadEvent('SCORING_DONE', {
        totalScore:  ev.scoring.totalScore,
        dimensions:  ev.scoring.dimensions,
        verdict:     ev.scoring.verdict,
      })
    }
    // Если гранты найдены — фиксируем
    if (ev.research?.grants?.grants?.length) {
      leadEvent('GRANTS_MATCHED', {
        count:    ev.research.grants.grants.length,
        grantIds: ev.research.grants.grants.map(g => g.name),
      })
    }
  } else if (ev.type === 'IC_ANALYSIS') {
    if (ev.agentId && !AGENTS[ev.agentId]) {
      AGENTS[ev.agentId] = { id: ev.agentId, name: ev.agentName, icon: ev.agentIcon, color: ev.agentColor }
    }
    pushAgent(ev.message, ev.agentId)
  } else if (ev.type === 'RESEARCH_ERROR') {
    pushEvent(ev.message, 'analyst', 'error')
    researching.value = false
  } else if (ev.type === 'MESSAGE') {
    pushAgent(ev.message, 'navigator')
  }
}

// ── Persistence ───────────────────────────────────────────────
const LS_KEY = 'stp_v2'

function saveLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      sessionId: sessionId.value,
      chatMessages: chatMessages.value,
      twin: twin.value,
      scoring: scoring.value,
      research: research.value,
      psychoProfile: psychoProfile.value,
      beacons: beacons.value,
    }))
  } catch {}
}

function clearSession() {
  if (sseSource) { sseSource.close(); sseSource = null }
  localStorage.removeItem(LS_KEY)
  sessionId.value = null
  chatMessages.value = []
  twin.value = {
    completeness: 0, company: null, inn: null, description: null, problem: null, solution: null,
    trl: null, mrl: null, teamSize: null, stage: null, askRub: null, marketSize: null,
    projectedIRR: null, competitors: [], founderName: null, founderBio: null,
    revenue: null, burnRate: null, runway: null, sector: null, website: null,
    contactEmail: null, metricsHistory: null
  }
  scoring.value = null
  research.value = null
  psychoProfile.value = null
  beacons.value = []
  researching.value = false
}

watch([sessionId, chatMessages, twin, scoring, research, psychoProfile, beacons], saveLS, { deep: true })

onMounted(async () => {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (!saved) return
    const s = JSON.parse(saved)
    if (!s.sessionId) return
    const r = await fetch(`${API}/session/${s.sessionId}`)
    if (!r.ok) { localStorage.removeItem(LS_KEY); return }
    sessionId.value = s.sessionId
    if (s.chatMessages?.length) chatMessages.value = s.chatMessages
    if (s.twin) Object.assign(twin.value, s.twin)
    if (s.scoring) scoring.value = s.scoring
    if (s.research) research.value = s.research
    if (s.psychoProfile) psychoProfile.value = s.psychoProfile
    if (s.beacons?.length) beacons.value = s.beacons
    startSSE(s.sessionId)
    scrollBottom()
  } catch {}
})

// ── Session init ──────────────────────────────────────────────
async function startSession() {
  try {
    const r = await fetch(`${API}/session`, { method: 'POST' })
    const d = await r.json()
    sessionId.value = d.sessionId
    startSSE(d.sessionId)
  } catch {
    sessionId.value = `local-${Date.now()}`
  }
  leadEvent('LEAD_STARTED', { sessionId: sessionId.value })
  pushAgent(
    '👋 **Добро пожаловать в ФСТ НТИ!**\n\nЯ помогу подготовить вашу заявку для инвесткомитета.\n\nРасскажите о проекте — или прикрепите любой документ, картинку, скриншот.\n\nЯ автоматически:\n- Проверю компанию в **ЕГРЮЛ**\n- Найду **патенты** в ФИПС\n- Проанализирую **конкурентов**\n- Подберу **гранты**\n- Проведу **скоринг** по 8 осям',
    'navigator'
  )
}

// ── Send message ──────────────────────────────────────────────
async function sendMessage() {
  const msg = inputText.value.trim()
  if (!msg || thinking.value) return
  if (!sessionId.value) await startSession()

  pushUser(msg)
  leadEvent('MESSAGE_SENT', { length: msg.length })
  inputText.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'
  thinking.value = true

  try {
    const r = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, message: msg })
    })
    const d = await r.json()
    if (d.twin)         Object.assign(twin.value, d.twin)
    if (d.scoring)      scoring.value = d.scoring
    if (d.psychoProfile) { psychoProfile.value = d.psychoProfile; if (!activeTab.value) activeTab.value = 'psycho' }
    if (d.beacons?.length) beacons.value = d.beacons
    if (d.anomalies?.length) beacons.value = d.anomalies
    const reply = d.reply || d.messages?.at(-1)?.content
    if (reply) pushAgent(reply, 'navigator')
  } catch {
    pushAgent('⚠️ Ошибка соединения. Попробуйте ещё раз.', 'navigator')
  }
  thinking.value = false
}

// ── File upload ───────────────────────────────────────────────
async function handleFiles(files) {
  if (!files?.length) return
  if (!sessionId.value) await startSession()

  for (const file of files) {
    const isImage = file.type.startsWith('image/')
    let dataUrl = null
    let base64Data = ''

    // Read file
    await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        dataUrl = e.target.result
        // Strip data URL prefix for base64
        base64Data = e.target.result.split(',')[1] || btoa(e.target.result)
        resolve()
      }
      if (isImage) reader.readAsDataURL(file)
      else reader.readAsDataURL(file)
    })

    // Show in chat
    pushUser('', { file: file.name, isImage, dataUrl })
    leadEvent('DOC_UPLOADED', { filename: file.name, mimeType: file.type, isImage })
    thinking.value = true

    try {
      const r = await fetch(`${API}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.value,
          base64Data,
          mimeType: file.type || 'application/octet-stream',
          filename: file.name
        })
      })
      const d = await r.json()
      const prevCompleteness = twin.value.completeness
      if (d.twin) Object.assign(twin.value, d.twin)
      if (d.psychoProfile) psychoProfile.value = d.psychoProfile
      if (d.beacons?.length) beacons.value = d.beacons
      if (d.anomalies?.length) beacons.value = d.anomalies
      const reply = d.messages?.at(-1)?.content
      if (reply) pushAgent(reply, 'navigator')
      else pushAgent(`Файл **${file.name}** обработан. Готовность: **${twin.value.completeness}%**`, 'analyst')

      leadEvent('DOC_PARSED', { filename: file.name, completeness: twin.value.completeness, trl: twin.value.trl })
      leadEvent('TWIN_UPDATED', { completeness: twin.value.completeness, twin: twin.value })

      // Milestones completeness
      if (prevCompleteness < 30 && twin.value.completeness >= 30)
        leadEvent('TWIN_THRESHOLD_30', { completeness: twin.value.completeness })
      if (prevCompleteness < 80 && twin.value.completeness >= 80)
        leadEvent('TWIN_THRESHOLD_80', { completeness: twin.value.completeness })

      // Auto-trigger research if completeness crossed 30%
      if (twin.value.completeness >= 30 && !researching.value && !research.value) {
        setTimeout(() => triggerResearch(), 1000)
      }
    } catch {
      pushAgent(`⚠️ Не удалось обработать файл ${file.name}`, 'analyst')
    }
    thinking.value = false
  }
}

function onFileInput(e) {
  handleFiles(e.target.files)
  e.target.value = ''
}
function onDrop(e) {
  dragging.value = false
  handleFiles(e.dataTransfer.files)
}
function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  const imageItems = [...items].filter(i => i.type.startsWith('image/'))
  if (!imageItems.length) return
  e.preventDefault()
  const files = imageItems.map(i => i.getAsFile()).filter(Boolean)
  handleFiles(files)
}

// ── Research pipeline ─────────────────────────────────────────
async function triggerResearch() {
  if (!sessionId.value || researching.value) return
  researching.value = true
  leadEvent('RESEARCH_STARTED', { completeness: twin.value.completeness })
  pushEvent('🔍 Запускаю исследовательский конвейер...', 'analyst', 'start')
  try {
    await fetch(`${API}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value })
    })
  } catch {
    researching.value = false
    pushEvent('❌ Ошибка запуска исследования', 'analyst', 'error')
  }
}

// ── Demo ──────────────────────────────────────────────────────
async function loadDemo(name) {
  await startSession()
  thinking.value = true
  const files = {
    aerobot: { url: '/demo/startup-aerobot.txt', mime: 'text/plain',        filename: 'startup-aerobot.txt' },
    quantum: { url: '/demo/startup-quantum.md',  mime: 'text/markdown',      filename: 'startup-quantum.md'  },
    agro:    { url: '/demo/startup-agro.json',   mime: 'application/json',   filename: 'startup-agro.json'   },
  }
  const f = files[name]
  if (!f) { thinking.value = false; return }
  try {
    const text = await fetch(f.url).then(r => r.text())
    const base64Data = btoa(unescape(encodeURIComponent(text)))
    pushUser('', { file: f.filename })
    const r = await fetch(`${API}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, base64Data, mimeType: f.mime, filename: f.filename })
    })
    const d = await r.json()
    if (d.twin) Object.assign(twin.value, d.twin)
    const reply = d.messages?.at(-1)?.content
    if (reply) pushAgent(reply, 'navigator')
    else pushAgent(`Демо-файл **${f.filename}** загружен. Готовность: **${twin.value.completeness}%**`, 'analyst')
    setTimeout(() => triggerResearch(), 800)
  } catch {
    pushAgent('⚠️ Не удалось загрузить демо-файл', 'analyst')
  }
  thinking.value = false
}

// ── Actions ───────────────────────────────────────────────────
function goToApply() {
  leadEvent('APPLY_STARTED', { completeness: twin.value.completeness })
  startuperStore.setPrefill(twin.value)
  router.push('/fst-apply')
}

async function sendToIC() {
  if (!sessionId.value) return
  saving.value = true
  await fetch(`${API}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId.value })
  }).catch(() => {})
  saving.value = false
  leadEvent('SENT_TO_IC', {
    completeness: twin.value.completeness,
    score:        scoring.value?.totalScore,
    company:      twin.value.company,
    trl:          twin.value.trl,
    sector:       twin.value.sector,
    askRub:       twin.value.askRub,
  })
  // Инициализируем GR-проект сразу при отправке в ИК
  if (sessionId.value) {
    grEventStore.initProject(sessionId.value, {
      trl:    twin.value.trl,
      sector: twin.value.sector,
      name:   twin.value.company,
    })
  }
  localStorage.setItem('startuper_twin', JSON.stringify({
    ...twin.value,
    psychoProfile: psychoProfile.value || undefined,
    beacons:       beacons.value?.length ? beacons.value : undefined,
    scoring:       scoring.value?.total ?? undefined,
  }))
  router.push('/fst-committee')
}
</script>

<style scoped>
/* ═══ ROOT ═══ */
.stp {
  display: flex; flex-direction: column;
  height: calc(100vh - 60px); /* subtract AppLayout header */
  background: var(--p-surface-ground);
  position: relative; overflow: hidden;
}

/* ═══ DRAG OVERLAY ═══ */
.stp-drag-overlay {
  position: absolute; inset: 0; z-index: 100;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.stp-drag-box {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 40px 60px; border: 2px dashed var(--p-primary-color);
  border-radius: 16px; font-size: 1.2rem; color: var(--p-primary-color); font-weight: 700;
}
.stp-drag-box i { font-size: 2.5rem; }

/* ═══ TOOLBAR ═══ */
.stp-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; height: 52px; flex-shrink: 0;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
}
.stp-bar-brand { display: flex; align-items: center; gap: 10px; }
.stp-bar-brand i { color: var(--p-primary-color); font-size: 1.1rem; }
.stp-bar-name { font-weight: 700; font-size: 0.95rem; color: var(--p-text-color); }
.stp-bar-sub { font-size: 0.75rem; color: var(--p-text-muted-color); }
.stp-bar-actions { display: flex; align-items: center; gap: 8px; }

/* ═══ BUTTONS ═══ */
.stp-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 8px; border: none;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.stp-btn--ghost   { background: transparent; color: var(--p-text-muted-color); border: 1px solid transparent; }
.stp-btn--ghost:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.stp-btn--primary { background: var(--p-primary-color); color: #fff; }
.stp-btn--primary:hover { opacity: 0.9; }
.stp-btn--secondary { background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-content-border-color); }
.stp-btn--secondary:hover { border-color: var(--p-primary-color); }
.stp-btn--outline { background: transparent; color: var(--p-primary-color); border: 1px solid var(--p-primary-color); }
.stp-btn--outline:hover { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.stp-btn--accent  { background: var(--p-primary-color); color: #fff; }
.stp-btn--success { background: #4caf50; color: #fff; }
.stp-btn--warning { background: #f59e0b; color: #fff; }
.stp-btn--full    { width: 100%; justify-content: center; }
.stp-btn--lg      { padding: 12px 24px; font-size: 0.95rem; border-radius: 10px; }

/* ═══ ONBOARDING ═══ */
.stp-onboard {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; padding: 40px 20px; text-align: center; position: relative;
}
.stp-ob-glow {
  position: absolute; width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--p-primary-color) 12%, transparent), transparent 70%);
  pointer-events: none;
}
.stp-ob-icon { font-size: 4rem; filter: drop-shadow(0 4px 20px rgba(99,102,241,.4)); }
.stp-ob-title { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--p-text-color); }
.stp-ob-sub { margin: 0; font-size: 0.92rem; color: var(--p-text-muted-color); max-width: 480px; line-height: 1.6; }
.stp-ob-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.stp-ob-formats { font-size: 0.72rem; color: var(--p-text-muted-color); letter-spacing: 0.08em; }
.stp-ob-demo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 0.78rem; color: var(--p-text-muted-color); }
.stp-demo-chip {
  padding: 4px 12px; border-radius: 20px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color); cursor: pointer; font-size: 0.78rem; transition: all 0.15s;
}
.stp-demo-chip:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }

/* ═══ SPLIT LAYOUT ═══ */
.stp-split {
  flex: 1; display: flex; overflow: hidden;
}

/* ═══ CHAT COLUMN ═══ */
.stp-chat-col {
  flex: 1; display: flex; flex-direction: column; min-width: 0;
  border-right: 1px solid var(--p-content-border-color);
}
.stp-messages {
  flex: 1; overflow-y: auto; padding: 20px 16px;
  display: flex; flex-direction: column; gap: 14px;
  scroll-behavior: smooth;
}

/* Messages */
.stp-msg { display: flex; align-items: flex-start; gap: 10px; max-width: 100%; }
.stp-msg--user { flex-direction: row-reverse; }
.stp-msg-av {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; flex-shrink: 0;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
}
.stp-msg-av--user { background: var(--p-primary-color); border: none; }
.stp-msg-body {
  max-width: 78%; display: flex; flex-direction: column; gap: 4px;
}
.stp-msg--user .stp-msg-body { align-items: flex-end; }
.stp-msg-agent-label {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 2px;
}
.stp-msg-text {
  padding: 10px 14px; border-radius: 12px; font-size: 0.85rem; line-height: 1.6;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color); word-break: break-word;
}
.stp-msg--user .stp-msg-text {
  background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color);
  border-radius: 12px 2px 12px 12px;
}
.stp-msg--agent .stp-msg-text { border-radius: 2px 12px 12px 12px; }
.stp-msg-img { max-width: 240px; max-height: 180px; border-radius: 10px; object-fit: cover; }
.stp-msg-file {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 8px; font-size: 0.8rem;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
}
.stp-msg--user .stp-msg-file { background: color-mix(in srgb, var(--p-primary-color) 15%, var(--p-surface-card)); }

/* Event pills */
.stp-event-pill {
  display: inline-flex; align-items: center;
  padding: 5px 12px; border-radius: 20px; font-size: 0.76rem;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
}
.stp-ep--error { background: rgba(239,83,80,.08); border-color: #ef5350; color: #ef5350; }
.stp-ep--start { background: rgba(99,102,241,.07); border-color: var(--p-primary-color); color: var(--p-primary-color); }

/* Typing */
.stp-typing { display: flex; gap: 4px; padding: 10px 14px; }
.stp-typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--p-text-muted-color); animation: bounce 1.2s infinite;
}
.stp-typing span:nth-child(2) { animation-delay: .2s; }
.stp-typing span:nth-child(3) { animation-delay: .4s; }
@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }

/* Score card in chat */
.stp-score-card {
  margin-top: 8px; padding: 14px; border-radius: 10px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  min-width: 240px;
}
.stp-sc-total { font-size: 2rem; font-weight: 800; line-height: 1; margin-bottom: 10px; }
.stp-sc-total span { font-size: 1rem; font-weight: 400; opacity: 0.7; }
.score-high { color: #4caf50; }
.score-mid  { color: #ff9800; }
.score-low  { color: #ef5350; }
.stp-sc-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; font-size: 0.72rem; }
.stp-sc-row span { color: var(--p-text-muted-color); width: 90px; flex-shrink: 0; }
.stp-sc-row b { color: var(--p-text-muted-color); width: 16px; text-align: right; }
.stp-sc-track { flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.stp-sc-track > div { height: 100%; border-radius: 3px; transition: width 0.8s; }
.stp-sc-verdict {
  margin-top: 10px; font-size: 0.78rem; font-style: italic;
  color: var(--p-text-muted-color); padding-top: 10px;
  border-top: 1px solid var(--p-content-border-color);
}

/* ═══ INPUT BAR ═══ */
.stp-input-bar {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 12px 14px; border-top: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}
.stp-attach-btn {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--p-text-muted-color);
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card); flex-shrink: 0; transition: all 0.15s;
}
.stp-attach-btn:hover { color: var(--p-primary-color); border-color: var(--p-primary-color); }
.stp-input {
  flex: 1; padding: 8px 12px; border-radius: 10px; resize: none; min-height: 36px;
  background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color); font-size: 0.88rem; line-height: 1.5;
  font-family: inherit; outline: none; transition: border 0.15s;
}
.stp-input:focus { border-color: var(--p-primary-color); }
.stp-send-btn {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
  background: var(--p-content-border-color); color: var(--p-text-muted-color);
  border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; transition: all 0.15s;
}
.stp-send-btn.active, .stp-send-btn:not(:disabled):hover {
  background: var(--p-primary-color); color: #fff;
}

/* ═══ TABS COLUMN ═══ */
.stp-tabs-col {
  width: 340px; flex-shrink: 0; display: flex; flex-direction: column;
  background: var(--p-surface-card);
}
@media (max-width: 860px) {
  .stp-split { flex-direction: column; }
  .stp-tabs-col { width: 100%; height: 320px; border-top: 1px solid var(--p-content-border-color); }
  .stp-chat-col { border-right: none; }
}

.stp-tabs-nav {
  display: flex; border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card); flex-shrink: 0;
}
.stp-tnav {
  flex: 1; padding: 10px 4px; background: none; border: none; cursor: pointer;
  font-size: 0.77rem; font-weight: 600; color: var(--p-text-muted-color);
  border-bottom: 2px solid transparent; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}
.stp-tnav.on { color: var(--p-primary-color); border-bottom-color: var(--p-primary-color); }
.stp-tnav-badge {
  font-size: 0.65rem; padding: 1px 5px; border-radius: 8px; font-weight: 700;
  background: var(--p-surface-ground); color: var(--p-text-muted-color);
}
.stp-tnav-badge.badge-green { background: #4caf5020; color: #4caf50; }
.stp-tnav-badge.badge-orange { background: #ff980020; color: #ff9800; }
.stp-tnav-badge.badge-red { background: #ef535020; color: #ef5350; }
.stp-tnav-badge--green { background: #4caf5020; color: #4caf50; }

.stp-tab-content { flex: 1; overflow-y: auto; padding: 14px; }

/* ═══ TWIN EMPTY STATE ═══ */
.stp-twin-empty {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; text-align: center; padding: 20px;
}
.stp-te-icon { font-size: 2.5rem; opacity: 0.5; }
.stp-twin-empty p { font-size: 0.82rem; color: var(--p-text-muted-color); line-height: 1.6; }

/* ═══ REQUIREMENTS MATRIX ═══ */
.stp-twin-body { display: flex; flex-direction: column; gap: 12px; }
.stp-matrix-title {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
}
.stp-matrix { display: flex; flex-direction: column; gap: 2px; }
.stp-matrix-row {
  display: grid; grid-template-columns: 20px 1fr 1fr 28px; gap: 4px;
  align-items: center; padding: 6px 8px; border-radius: 6px;
  background: var(--p-surface-ground); font-size: 0.76rem;
  transition: background 0.15s;
}
.stp-matrix-row:hover { background: color-mix(in srgb, var(--p-primary-color) 4%, var(--p-surface-ground)); }
.stp-mr-status { font-size: 0.7rem; text-align: center; }
.stp-mr-label { color: var(--p-text-muted-color); font-weight: 600; }
.stp-mr-val { color: var(--p-text-color); font-weight: 700; text-align: right; }
.stp-mr-req { color: var(--p-text-muted-color); font-size: 0.68rem; text-align: right; display: none; }
.stp-matrix-row:hover .stp-mr-req { display: block; }
.stp-mr-status--ok      { }
.stp-mr-status--warn    { }
.stp-mr-status--fail    { }
.stp-mr-status--unknown { filter: grayscale(1); opacity: 0.5; }

/* Completeness bar */
.stp-compl-bar {
  height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden;
}
.stp-compl-fill {
  height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width 0.6s;
}
.stp-compl-label { font-size: 0.7rem; color: var(--p-text-muted-color); text-align: right; }

/* Scoring panel */
.stp-scoring {
  background: var(--p-surface-ground); border-radius: 10px; padding: 12px;
}
.stp-scoring-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.72rem; font-weight: 700; color: var(--p-text-muted-color);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
}
.stp-scoring-total { font-size: 1.1rem; font-weight: 800; }

/* Research CTA */
.stp-research-cta { padding-top: 4px; }
.stp-researching {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  padding: 10px; font-size: 0.8rem; color: var(--p-text-muted-color);
}

/* ═══ APPLY PREVIEW ═══ */
.stp-apply-preview { display: flex; flex-direction: column; gap: 12px; }
.stp-ap-group {
  background: var(--p-surface-ground); border-radius: 8px; padding: 10px 12px;
}
.stp-ap-group-title {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--p-text-muted-color); margin-bottom: 8px;
}
.stp-ap-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 8px; padding: 3px 0; font-size: 0.78rem;
}
.stp-ap-row span { color: var(--p-text-muted-color); flex-shrink: 0; }
.stp-ap-row b { color: var(--p-text-color); text-align: right; word-break: break-word; max-width: 180px; }
.stp-ap-row--full { flex-direction: column; }
.stp-ap-row--full b { text-align: left; max-width: 100%; }
.stp-ap-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.stp-chip {
  padding: 2px 8px; border-radius: 12px; font-size: 0.72rem;
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-card));
  color: var(--p-primary-color); border: 1px solid color-mix(in srgb, var(--p-primary-color) 25%, transparent);
}

/* ═══ GRANTS ═══ */
.stp-grant-card {
  background: var(--p-surface-ground); border-radius: 8px; padding: 10px 12px;
  margin-bottom: 8px; border-left: 3px solid var(--p-content-border-color);
}
.stp-gc-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; font-size: 0.82rem; }
.stp-gc-top b { color: var(--p-text-color); font-weight: 700; }
.stp-gc-fit { padding: 2px 7px; border-radius: 10px; font-size: 0.68rem; font-weight: 700; flex-shrink: 0; }
.stp-gc-fit.high { background: #4caf5020; color: #4caf50; }
.stp-gc-fit.med  { background: #ff980020; color: #ff9800; }
.stp-gc-fit.low  { background: #90909020; color: #909090; }
.stp-gc-sub { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 4px; }
.stp-gc-comment { font-size: 0.74rem; color: var(--p-text-muted-color); }
.stp-grant-rec {
  margin-top: 8px; padding: 10px 12px; border-radius: 8px; font-size: 0.8rem;
  background: color-mix(in srgb, #4caf50 8%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, #4caf50 25%, transparent);
  color: var(--p-text-color);
}

/* ═══ DIVIDER ═══ */
.stp-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 8px 0; color: var(--p-text-muted-color);
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
}
.stp-divider::before, .stp-divider::after {
  content: ''; flex: 1; height: 1px;
  background: var(--p-content-border-color);
}
.stp-divider span { white-space: nowrap; }

/* ═══ TRANSITIONS ═══ */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ═══ BEACONS ═══ */
.stp-beacons { margin-top: 16px; }
.stp-beacons-title {
  display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700;
  color: var(--p-text-color); margin-bottom: 8px;
}
.stp-beacons-count {
  background: #ef535020; color: #ef5350;
  border-radius: 10px; padding: 1px 7px; font-size: 0.72rem; font-weight: 700;
}
.stp-beacon {
  padding: 10px 12px; border-radius: 8px; margin-bottom: 8px;
  border-left: 3px solid transparent;
}
.stp-beacon--high   { background: #ef535010; border-color: #ef5350; }
.stp-beacon--medium { background: #ff980010; border-color: #ff9800; }
.stp-beacon--low    { background: #4caf5010; border-color: #4caf50; }
.stp-beacon-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.stp-beacon-sev { font-size: 0.72rem; font-weight: 700; }
.stp-beacon-dim {
  font-size: 0.7rem; padding: 1px 6px; border-radius: 4px;
  background: var(--p-surface-ground); color: var(--p-text-muted-color);
}
.stp-beacon-text { font-size: 0.8rem; color: var(--p-text-color); line-height: 1.4; }
.stp-beacon-rec  { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; font-style: italic; }

/* ═══ PSYCHO TAB ═══ */
.stp-psycho { padding: 4px 0; }
.stp-psycho-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
.stp-mbti-badge {
  min-width: 60px; height: 60px; border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff; font-size: 1.4rem; font-weight: 900;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  letter-spacing: 1px;
}
.stp-psycho-summary { font-size: 0.82rem; color: var(--p-text-color); line-height: 1.5; margin-bottom: 4px; }
.stp-psycho-conf { font-size: 0.72rem; color: var(--p-text-muted-color); }
.stp-signals { margin-bottom: 14px; }
.stp-signals-title { font-size: 0.75rem; font-weight: 700; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.stp-sig-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.stp-sig-label { font-size: 0.78rem; color: var(--p-text-color); width: 130px; flex-shrink: 0; }
.stp-sig-track { flex: 1; height: 6px; border-radius: 3px; background: var(--p-surface-ground); overflow: hidden; }
.stp-sig-fill  { height: 100%; border-radius: 3px; transition: width 0.4s; }
.stp-sig-val   { font-size: 0.75rem; font-weight: 700; width: 36px; text-align: right; color: var(--p-text-color); }
.stp-flags { margin-bottom: 12px; }
.stp-flags-title { font-size: 0.75rem; font-weight: 700; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.stp-flag { display: inline-block; margin: 3px 4px 3px 0; padding: 3px 10px; border-radius: 6px; font-size: 0.78rem; }
.stp-flag--red   { background: #ef535015; color: #ef5350; border: 1px solid #ef535030; }
.stp-flag--green { background: #4caf5015; color: #4caf50; border: 1px solid #4caf5030; }
.stp-tnav-badge--purple { background: #a855f720; color: #a855f7; }
</style>

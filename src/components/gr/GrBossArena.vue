<!--
  GrBossArena — главный игровой экран GR Арены
  Нарратив: компания застряла → барьер → фонд бьёт → мультипликатор
-->
<template>
  <div class="arena">

    <!-- ══════════════════════════════════════════════
         ЭКРАН 1: ВЫБОР КОМПАНИИ (нет компании)
    ══════════════════════════════════════════════ -->
    <div v-if="!company && !projects.length" class="arena-loading">
      <i class="pi pi-spin pi-spinner" style="font-size:2rem;opacity:0.4" />
    </div>

    <div v-else-if="!company" class="arena-pick">
      <div class="arena-pick-title">⚔️ Выбери компанию для GR-битвы</div>
      <div class="arena-pick-grid">
        <div v-for="p in pickableProjects" :key="p.id"
             :class="['arena-pick-card', `arena-pick-card--${p.urgency}`]"
             @click="$emit('pick', p)">
          <div class="arena-pick-name">{{ p.name }}</div>
          <div class="arena-pick-meta">TRL {{ p.trl }} · {{ p.stage }}</div>
          <div class="arena-pick-crisis" :style="{ color: urgencyColor(p.urgency) }">
            {{ p.crisisLine }}
          </div>
          <div class="arena-pick-hint">нажми → начать битву</div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════
         ЭКРАН 2: НАРРАТИВ + БОЙ (компания выбрана)
    ══════════════════════════════════════════════ -->
    <template v-else>

      <!-- Шапка: ситуация компании -->
      <div :class="['arena-crisis', `arena-crisis--${urgency}`]">
        <div class="arena-crisis-left">
          <div class="arena-crisis-badge" :style="{ background: urgencyColor(urgency) }">
            {{ urgencyLabel }}
          </div>
          <div class="arena-company-name">{{ company.name }}</div>
          <div class="arena-company-meta">
            TRL {{ company.trl }} · {{ company.stage }} · Runway {{ company.runway }} мес
          </div>
        </div>
        <div class="arena-crisis-stats">
          <div class="arena-cstat" v-if="company.runway <= 6">
            <span class="arena-cstat-val" style="color:#ef4444">{{ company.runway }}</span>
            <span class="arena-cstat-lbl">мес runway</span>
          </div>
          <div class="arena-cstat">
            <span class="arena-cstat-val" :style="{ color: irrMultiplier > 1.5 ? '#22c55e' : 'var(--p-text-muted-color)' }">
              {{ irrMultiplier }}x
            </span>
            <span class="arena-cstat-lbl">IRR фонда</span>
          </div>
          <div class="arena-cstat">
            <span class="arena-cstat-val">{{ bossesDefeated }}/{{ activeBosses.length }}</span>
            <span class="arena-cstat-lbl">барьеров</span>
          </div>
        </div>
      </div>

      <!-- Нарратив -->
      <div class="arena-narrative">
        <div class="arena-narrative-text">{{ narrativeText }}</div>
        <div class="arena-stakes">
          <div class="arena-stake arena-stake--bad">
            <div class="arena-stake-label">❌ Без GR-работы</div>
            <div class="arena-stake-val">{{ stakesBad }}</div>
          </div>
          <div class="arena-stake-arrow">→</div>
          <div class="arena-stake arena-stake--good">
            <div class="arena-stake-label">✅ Пробьёшь барьер</div>
            <div class="arena-stake-val">{{ stakesGood }}</div>
          </div>
        </div>
      </div>

      <!-- Мультипликатор (растёт при победах) -->
      <div :class="['arena-multiplier', { 'arena-multiplier--max': bossesDefeated === activeBosses.length && activeBosses.length }]">
        <div class="arena-mult-num">{{ irrMultiplier }}x</div>
        <div class="arena-mult-body">
          <div class="arena-mult-track">
            <div class="arena-mult-fill" :style="{ width: Math.min(100, (irrMultiplier - 1) / 2 * 100) + '%' }" />
          </div>
          <div class="arena-mult-desc">
            <span v-if="!activeBosses.length">диагностируй проект чтобы обнаружить барьеры</span>
            <span v-else-if="bossesActive">
              повергни {{ bossesActive }} {{ bossesActive === 1 ? 'барьер' : 'барьера' }}
              — добавишь +{{ (bossesActive * 0.4).toFixed(1) }}x к IRR
            </span>
            <span v-else style="color:#22c55e;font-weight:700">
              🏆 Все барьеры пробиты! Максимальный мультипликатор.
            </span>
          </div>
        </div>
        <GrXpBar :events="events" style="min-width:200px;flex:1" />
      </div>

      <!-- AI-подсказка -->
      <div v-if="aiSuggestionLoading" class="arena-ai arena-ai--loading">
        <i class="pi pi-spin pi-spinner" /> AI думает над следующим шагом…
      </div>
      <div v-else-if="aiSuggestion" class="arena-ai">
        <div class="arena-ai-header">
          <i class="pi pi-sparkles" style="color:#ab47bc" />
          <strong>Следующие шаги (AI)</strong>
          <button @click="aiSuggestion = null" class="arena-ai-close">×</button>
        </div>
        <div style="font-size:12px;line-height:1.8;white-space:pre-line;padding-top:4px">{{ aiSuggestion }}</div>
      </div>

      <!-- ══ ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ══ -->
      <div class="arena-mode-tabs">
        <button :class="['arena-mode-tab', { active: arenaMode === 'scenarios' }]"
                @click="arenaMode = 'scenarios'">
          🗺️ Сценарии выхода
        </button>
        <button :class="['arena-mode-tab', { active: arenaMode === 'bosses' }]"
                @click="arenaMode = 'bosses'">
          ⚔️ Битва с барьерами
          <span v-if="activeBosses.length" class="arena-mode-badge">{{ activeBosses.length }}</span>
        </button>
        <button :class="['arena-mode-tab', { active: arenaMode === 'map' }]"
                @click="arenaMode = 'map'">
          📡 Карта операции
        </button>
      </div>

      <!-- ══ СЦЕНАРИЙ-ПЛЕЕР ══ -->
      <div v-if="arenaMode === 'scenarios'">
        <GrScenarioPlayer
          :company="company"
          :events="events"
          :possible="possibleMoves"
          @apply="onApplyScenario"
        />
      </div>

      <!-- ══ АРЕНА БОССОВ ══ -->
      <div v-else-if="arenaMode === 'bosses'">

        <div v-if="!events.length" class="arena-init">
          <Button label="Начать диагностику барьеров" icon="pi pi-search"
                  size="large" severity="warning" @click="$emit('init')" />
          <div class="arena-init-hint">
            Анализируем {{ company.name }}: ищем регуляторные, рыночные и технологические барьеры
          </div>
        </div>

        <template v-else>
          <div v-if="activeBosses.length" class="arena-bosses">
            <div v-for="b in activeBosses" :key="b.boss.id" class="arena-boss-wrap">
              <GrBossCard
                :boss="b.boss"
                :state="b.state"
                :available-moves="movesForBoss(b.boss)"
                @attack="handleAttack"
              />
            </div>
          </div>
          <div v-else class="arena-clear">
            <div class="arena-clear-icon">🏆</div>
            <div class="arena-clear-title">Все барьеры пробиты</div>
            <div class="arena-clear-sub">
              {{ company.name }} получила мультипликатор {{ irrMultiplier }}x к IRR фонда.
            </div>
          </div>
        </template>
      </div>

      <!-- ══ КАРТА ОПЕРАЦИИ ══ -->
      <div v-else-if="arenaMode === 'map'">
        <GrStartupMap
          :events="events"
          :company-name="company.name"
          :start-trl="company.trl || 3"
        />
      </div>

      <!-- История событий -->
      <details v-if="events.length" class="arena-history">
        <summary class="arena-history-sum">
          <i class="pi pi-history" />
          История событий
          <span class="arena-evt-count">{{ events.length }}</span>
          <span style="margin-left:auto;opacity:0.5;font-size:11px">▼</span>
        </summary>
        <div style="padding:12px">
          <div v-for="ev in [...events].reverse()" :key="ev.id" class="arena-ev">
            <div class="arena-ev-dot" :style="{ background: eventColor(ev.type) }" />
            <div class="arena-ev-label">{{ eventLabel(ev.type) }}</div>
            <div class="arena-ev-date">{{ fmtDate(ev.ts) }}</div>
            <button class="arena-ev-del" @click="$emit('remove', ev.id)">×</button>
          </div>
        </div>
      </details>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import GrBossCard        from './GrBossCard.vue'
import GrXpBar           from './GrXpBar.vue'
import GrScenarioPlayer  from './GrScenarioPlayer.vue'
import GrStartupMap      from './GrStartupMap.vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'
import { GR_EVENT_TYPES } from '@/config/grEventTypes.js'
import { playHit, playVictory } from '@/services/grSoundEngine.js'

const props = defineProps({
  company:              { type: Object,  default: null },
  projects:             { type: Array,   default: () => [] },
  events:               { type: Array,   default: () => [] },
  possible:             { type: Array,   default: () => [] },
  aiSuggestion:         { type: String,  default: null },
  aiSuggestionLoading:  { type: Boolean, default: false },
})

const emit = defineEmits(['pick', 'init', 'attack', 'remove', 'applyScenario'])

// ─── Режим арены ─────────────────────────────────────────────────────────────
const arenaMode = ref('scenarios')

// Possible moves для сценарий-плеера
const possibleMoves = computed(() => props.possible || [])

// ─── Проекты для выбора (обогащённые) ────────────────────────────────────────
const pickableProjects = computed(() =>
  props.projects.map(p => {
    const trl    = p.trl || 4
    const runway = p.runway || 12
    const risk   = p.riskLevel || (runway < 6 ? 'red' : trl < 5 ? 'yellow' : 'green')
    const urgency = risk === 'red' || runway <= 4 ? 'critical'
                  : risk === 'yellow' || runway <= 9 ? 'warn'
                  : 'ok'
    const crisisLine = urgency === 'critical'
      ? `⚠️ Runway ${runway} мес — критично`
      : urgency === 'warn'
      ? `⚡ Требует внимания GR`
      : `✓ Стабильно — укрепи позиции`
    return { ...p, urgency, crisisLine }
  }).sort((a, b) => {
    const order = { critical: 0, warn: 1, ok: 2 }
    return order[a.urgency] - order[b.urgency]
  })
)

// ─── Urgency текущей компании ─────────────────────────────────────────────────
const urgency = computed(() => {
  if (!props.company) return 'ok'
  const r = props.company.runway || 12
  const risk = props.company.riskLevel || 'green'
  if (risk === 'red' || r <= 4)  return 'critical'
  if (risk === 'yellow' || r <= 9) return 'warn'
  return 'ok'
})

const urgencyLabel = computed(() => ({
  critical: '🚨 КРИТИЧЕСКАЯ СИТУАЦИЯ',
  warn:     '⚡ ТРЕБУЕТ ВНИМАНИЯ',
  ok:       '✅ СТАБИЛЬНО',
}[urgency.value]))

function urgencyColor(u) {
  return { critical: '#ef4444', warn: '#f59e0b', ok: '#22c55e' }[u] || '#64748b'
}

// ─── Нарратив ─────────────────────────────────────────────────────────────────
const narrativeText = computed(() => {
  const c = props.company
  if (!c) return ''
  const name = c.name
  const trl  = c.trl || '?'
  const runway = c.runway || '?'

  if (urgency.value === 'critical') {
    return `${name} умирает. Runway ${runway} месяца — дальше пустота. `
         + `Продукт TRL ${trl} технически готов, команда держится. `
         + `Но путь на рынок заблокирован барьером, который деньгами не пробить. `
         + `Только GR-работа фонда может спасти этот проект.`
  }
  if (urgency.value === 'warn') {
    return `${name} замедляется. TRL ${trl}, runway ${runway} мес — пространство сужается. `
         + `Барьеры уже тормозят рост. Без активного GR через квартал ситуация станет критической. `
         + `Действуй сейчас, пока есть время.`
  }
  return `${name} развивается стабильно. TRL ${trl}, runway ${runway} мес. `
       + `Но барьеры уже существуют — просто пока не ощущаются. `
       + `Преодолей их сейчас, до того как они станут стеной. `
       + `Каждый пробитый барьер — дополнительный мультипликатор к IRR.`
})

const stakesBad = computed(() => {
  if (urgency.value === 'critical') return 'Компания умирает через 4 мес → потеря инвестиции → 0x'
  if (urgency.value === 'warn')     return 'Застревает на этапе → теряет рынок → 0.5x в лучшем случае'
  return 'Медленный рост → упущенные возможности → посредственный IRR'
})

const stakesGood = computed(() => {
  const mult = (1.0 + activeBosses.value.length * 0.4 + 0.5).toFixed(1)
  return `Барьер пробит → выход на рынок → до ${mult}x к IRR фонда`
})

// ─── Боссы ────────────────────────────────────────────────────────────────────
const activeBosses = computed(() =>
  GR_BOSSES
    .map(boss => ({ boss, state: getBossState(boss, props.events) }))
    .filter(b => b.state !== null)
)

const bossesDefeated = computed(() => activeBosses.value.filter(b => b.state.defeated).length)
const bossesActive   = computed(() => activeBosses.value.filter(b => !b.state.defeated).length)

// ─── Атаки + звук ────────────────────────────────────────────────────────────
function resolveDamage(move) {
  for (const { boss } of activeBosses.value) {
    const atk = boss.attacks?.find(a => a.type === move.type)
    if (atk?.damage) return atk.damage
  }
  return 100
}

function handleAttack(move) {
  playHit(resolveDamage(move))
  emit('attack', move)
}

function onApplyScenario(events) {
  for (const evt of events) {
    playHit(resolveDamage(evt))
    emit('attack', evt)
  }
}

// Победа над боссом — звук
watch(bossesDefeated, (now, prev) => {
  if (now > (prev ?? 0)) playVictory()
})

const irrMultiplier = computed(() => {
  const d = bossesDefeated.value
  const total = activeBosses.value.length
  if (!total) return 1.0
  const allDefeated = d === total && total > 0
  return +(1.0 + d * 0.4 + (allDefeated ? 0.5 : 0)).toFixed(1)
})

function movesForBoss(boss) {
  const bossTypes = new Set(boss.attacks.map(a => a.type))
  return props.possible.filter(p => bossTypes.has(p.type) && p.probability !== 'blocked')
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function eventLabel(type) {
  return GR_EVENT_TYPES[type]?.label || type.replace(/_/g, ' ')
}
function eventColor(type) {
  return GR_EVENT_TYPES[type]?.color || 'var(--p-primary-color)'
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
</script>

<style scoped>
.arena { display: flex; flex-direction: column; gap: 12px; }

/* ─── Выбор компании ─── */
.arena-pick-title {
  font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--p-text-color);
}
.arena-pick-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.arena-pick-card {
  background: var(--p-surface-card);
  border: 2px solid var(--p-content-border-color);
  border-radius: 12px; padding: 14px;
  cursor: pointer; transition: all 0.2s;
}
.arena-pick-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
.arena-pick-card--critical { border-left: 4px solid #ef4444; }
.arena-pick-card--warn      { border-left: 4px solid #f59e0b; }
.arena-pick-card--ok        { border-left: 4px solid #22c55e; }
.arena-pick-name   { font-weight: 700; font-size: 14px; margin-bottom: 3px; }
.arena-pick-meta   { font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 6px; }
.arena-pick-crisis { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
.arena-pick-hint   { font-size: 9px; color: var(--p-text-muted-color); font-style: italic; }

/* ─── Шапка кризиса ─── */
.arena-crisis {
  border-radius: 14px; padding: 16px 20px;
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  border: 2px solid;
}
.arena-crisis--critical { background: #ef444410; border-color: #ef444444; }
.arena-crisis--warn     { background: #f59e0b10; border-color: #f59e0b44; }
.arena-crisis--ok       { background: #22c55e08; border-color: #22c55e44; }

.arena-crisis-left { flex: 1; }
.arena-crisis-badge {
  display: inline-block;
  font-size: 9px; font-weight: 800; letter-spacing: 0.08em;
  color: #fff; border-radius: 6px; padding: 2px 8px; margin-bottom: 6px;
}
.arena-company-name { font-size: 1.4rem; font-weight: 900; color: var(--p-text-color); }
.arena-company-meta { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }

.arena-crisis-stats { display: flex; gap: 20px; }
.arena-cstat { text-align: center; }
.arena-cstat-val { display: block; font-size: 1.6rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.arena-cstat-lbl { font-size: 9px; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.05em; }

/* ─── Нарратив ─── */
.arena-narrative {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 16px 20px;
}
.arena-narrative-text {
  font-size: 14px; line-height: 1.75; color: var(--p-text-color);
  margin-bottom: 14px;
}
.arena-stakes { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.arena-stake {
  flex: 1; min-width: 160px;
  border-radius: 8px; padding: 10px 14px;
}
.arena-stake--bad  { background: #ef444412; border: 1px solid #ef444433; }
.arena-stake--good { background: #22c55e12; border: 1px solid #22c55e33; }
.arena-stake-label { font-size: 10px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); }
.arena-stake-val   { font-size: 12px; font-weight: 600; line-height: 1.4; }
.arena-stake-arrow { font-size: 1.4rem; color: var(--p-text-muted-color); flex-shrink: 0; }

/* ─── Мультипликатор ─── */
@keyframes mult-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } 50% { box-shadow: 0 0 20px 6px rgba(34,197,94,0.2); } }
.arena-multiplier {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  background: var(--p-surface-card);
  border: 2px solid var(--p-content-border-color);
  border-radius: 12px; padding: 12px 18px;
  transition: border-color 0.4s;
}
.arena-multiplier--max { border-color: #22c55e88; animation: mult-pulse 2s ease infinite; }
.arena-mult-num {
  font-size: 2.4rem; font-weight: 900; color: #22c55e;
  font-variant-numeric: tabular-nums; flex-shrink: 0;
  transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
}
.arena-mult-body { flex: 1; min-width: 120px; }
.arena-mult-track { height: 8px; background: var(--p-content-border-color); border-radius: 6px; overflow: hidden; margin-bottom: 5px; }
.arena-mult-fill { height: 100%; background: linear-gradient(90deg,#22c55e,#86efac); border-radius: 6px; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
.arena-mult-desc { font-size: 12px; color: var(--p-text-muted-color); }

/* ─── Переключатель режимов ─── */
.arena-mode-tabs {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;
}
.arena-mode-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
  background: transparent; border: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color); cursor: pointer;
  transition: all 0.2s;
}
.arena-mode-tab:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }
.arena-mode-tab.active {
  background: var(--p-primary-color); color: white; border-color: var(--p-primary-color);
}
.arena-mode-badge {
  background: #ef4444; color: white; border-radius: 10px;
  font-size: 10px; padding: 1px 5px; font-weight: 700;
}

/* ─── Кнопка старта ─── */
.arena-init {
  display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 20px;
  background: var(--p-surface-card); border: 1px dashed var(--p-content-border-color); border-radius: 14px;
}
.arena-init-hint { font-size: 11px; color: var(--p-text-muted-color); text-align: center; }

/* ─── Боссы ─── */
.arena-bosses { display: flex; flex-direction: column; gap: 12px; }
.arena-boss-wrap {}

/* ─── Победа ─── */
@keyframes trophy { 0%{transform:scale(0.5)rotate(-15deg);opacity:0} 60%{transform:scale(1.1)rotate(5deg)} 100%{transform:scale(1)rotate(0);opacity:1} }
.arena-clear { text-align: center; padding: 32px; }
.arena-clear-icon { font-size: 3.5rem; animation: trophy 0.6s cubic-bezier(0.16,1,0.3,1) forwards; display: block; margin-bottom: 12px; }
.arena-clear-title { font-size: 1.3rem; font-weight: 800; color: #22c55e; margin-bottom: 8px; }
.arena-clear-sub { font-size: 13px; color: var(--p-text-muted-color); line-height: 1.7; }

/* ─── AI-подсказка ─── */
.arena-ai { background: var(--p-surface-card); border: 1px solid #ab47bc44; border-radius: 10px; padding: 12px 14px; }
.arena-ai--loading { color: var(--p-text-muted-color); font-style: italic; display: flex; align-items: center; gap: 8px; font-size: 12px; }
.arena-ai-header { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }
.arena-ai-close { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--p-text-muted-color); font-size: 18px; line-height: 1; }

/* ─── История ─── */
.arena-history { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; }
.arena-history-sum {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  cursor: pointer; font-size: 12px; font-weight: 600; color: var(--p-text-muted-color);
  list-style: none; user-select: none;
}
.arena-history-sum::-webkit-details-marker { display: none; }
.arena-evt-count { background: var(--p-primary-color); color:#fff; border-radius:10px; padding: 0 6px; font-size:10px; }
.arena-ev { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--p-content-border-color); font-size: 12px; }
.arena-ev:last-child { border-bottom: none; }
.arena-ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.arena-ev-label { flex: 1; }
.arena-ev-date { font-size: 10px; color: var(--p-text-muted-color); }
.arena-ev-del { background: none; border: none; cursor: pointer; color: var(--p-text-muted-color); opacity: 0.4; font-size: 14px; transition: opacity 0.15s; }
.arena-ev-del:hover { opacity: 1; color: #ef4444; }

.arena-loading { display: flex; justify-content: center; padding: 60px; }
</style>

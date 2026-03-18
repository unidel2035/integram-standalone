<template>
  <div class="gift-graph-root">
    <!-- Статус сканирования -->
    <div v-if="scanning" class="scan-progress">
      <ProgressBar :value="scanProgress" :showValue="true" />
      <div class="scan-status">{{ scanStatus }}</div>
    </div>

    <!-- ═══ ГРАФ ЗДОРОВЬЯ ПРОЕКТОВ ═══ -->
      <div class="gift-graph-section">
        <div class="gg-toolbar">
          <span class="gg-title"><i class="pi pi-share-alt" /> Здоровье проектов</span>
          <div class="gg-scan-inline">
            <InputText v-model="repoUrl" placeholder="github.com/owner/repo" size="small" class="gg-scan-input" />
            <Button icon="pi pi-plus" size="small" :loading="scanning" @click="startScan" severity="secondary" text />
          </div>
          <div class="gg-layouts">
            <button v-for="l in ['cola','dagre','fcose']" :key="l"
              :class="['gg-layout-btn', { active: activeLayout === l }]"
              @click="switchLayout(l)">
              {{ { cola: 'Физика', dagre: 'Дерево', fcose: 'Авто' }[l] }}
            </button>
          </div>
        </div>
        <div class="gg-legend">
          <span class="gg-legend-item"><span class="gg-dot" style="background:#22c55e"></span> Можно брать</span>
          <span class="gg-legend-item"><span class="gg-dot" style="background:#f59e0b"></span> С оговорками</span>
          <span class="gg-legend-item"><span class="gg-dot" style="background:#ef4444"></span> Рискованно</span>
          <span class="gg-legend-item"><span class="gg-dot" style="background:#8b5cf6;border-radius:3px"></span> Критерий</span>
          <span class="gg-legend-hint">Клик на узел — детали</span>
        </div>
        <div class="gg-body">
          <div ref="cyContainer" class="gg-canvas" />
          <transition name="gg-slide">
            <div v-if="selectedNode" class="gg-node-detail">
              <div class="gg-nd-close">
                <Button icon="pi pi-times" text size="small" severity="secondary" @click="selectedNode = null" />
              </div>
              <div class="gg-nd-header">
                <span class="gg-nd-dot" :style="{ background: selectedNode.color }"></span>
                <strong>{{ selectedNode.label }}</strong>
              </div>
              <span class="gg-nd-type">{{ selectedNode.type }}</span>
              <div v-if="selectedNode.metrics?.length" class="gg-nd-metrics">
                <div v-for="m in selectedNode.metrics" :key="m.label" class="gg-nd-metric">
                  <span>{{ m.label }}</span><b>{{ m.val }}</b>
                </div>
              </div>
              <div v-if="selectedNode.desc" class="gg-nd-desc">{{ selectedNode.desc }}</div>
            </div>
          </transition>
        </div>
      </div>

      <template v-if="result">
      <!-- ═══ МЕТРИКИ ═══ -->
      <div class="fst-metrics-strip">
        <div v-for="m in topMetrics" :key="m.label" class="fst-metric-item">
          <i :class="m.icon" class="fst-metric-item-icon" :style="{ color: m.color }"></i>
          <div class="fst-metric-item-val">{{ m.val }}</div>
          <div class="fst-metric-item-label">{{ m.label }}</div>
        </div>
      </div>

      <!-- ═══ КАРТОЧКИ ДРОНОВ ═══ -->
      <div class="drones-grid">

        <!-- Здоровье сообщества -->
        <div class="drone-card" v-if="d.community">
          <div class="dc-header">
            <i class="pi pi-users"></i>
            <span>Здоровье сообщества</span>
            <span class="dc-badge" :class="d.community.busFactorRisk">
              bus={{ d.community.busFactor }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Контрибуторы</span><b>{{ d.community.contributors }}</b></div>
            <div class="dc-row"><span>Коммиты</span><b>{{ d.community.totalCommits?.toLocaleString() }}</b></div>
            <div class="dc-row"><span>Критич. зависимость</span><b :class="d.community.busFactorRisk">{{ d.community.busFactor }} чел.</b></div>
            <div class="dc-row"><span>Топ-1 делает</span><b>{{ d.community.top1Percent }}%</b></div>
            <div class="dc-row"><span>Лицензия</span><b>{{ d.community.license }}</b></div>
            <div class="dc-row"><span>Язык</span><b>{{ d.community.language }}</b></div>
            <div class="dc-mini-table" v-if="d.community.top5Contributors">
              <div class="dc-mini-title">Топ-5 контрибуторов</div>
              <div v-for="c in d.community.top5Contributors" :key="c.login" class="dc-mini-row">
                <span>{{ c.login }}</span>
                <span>{{ c.pct }}%</span>
                <span class="muted">{{ c.contributions }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- География -->
        <div class="drone-card" v-if="d.geography">
          <div class="dc-header">
            <i class="pi pi-globe"></i>
            <span>География контрибуторов</span>
            <span class="dc-badge" :class="d.geography.sovereigntySignal === 'positive' ? 'low' : d.geography.sovereigntySignal === 'high_dependency' ? 'critical' : 'medium'">
              {{ d.geography.sovereigntySignal }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Профилей с локацией</span><b>{{ d.geography.profilesCovered }}</b></div>
            <div class="dc-row"><span>Российские контрибуторы</span><b :class="d.geography.russianPresence ? 'green' : 'red'">{{ d.geography.russianContributors }}</b></div>
            <div class="dc-row"><span>Из стран-санкционеров</span><b>{{ d.geography.sanctionSourcePercent }}%</b></div>
            <div class="dc-row"><span>Географическое разнообразие</span><b>{{ d.geography.geoDiversity }} регионов</b></div>
            <div class="dc-geo-bars" v-if="d.geography.geoDistribution">
              <div v-for="(pct, region) in sortedGeo" :key="region" class="geo-bar-row">
                <span class="geo-label">{{ geoName(region) }}</span>
                <div class="geo-bar-wrap">
                  <div class="geo-bar" :style="{ width: pct + '%' }" :class="geoBarClass(region)"></div>
                </div>
                <span class="geo-pct">{{ pct }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Корпоративная зависимость -->
        <div class="drone-card" v-if="d.corporate">
          <div class="dc-header">
            <i class="pi pi-building"></i>
            <span>Корпоративная зависимость</span>
            <span class="dc-badge" :class="d.corporate.corporateRisk">
              {{ d.corporate.corporateRisk }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Доминирующая корпорация</span><b>{{ d.corporate.dominantCorporation || 'нет' }}</b></div>
            <div class="dc-row"><span>Доля доминанта</span><b>{{ d.corporate.dominantPercent }}%</b></div>
            <div class="dc-row"><span>Корпоративный проект</span><b :class="d.corporate.isCorporateProject ? 'red' : 'green'">{{ d.corporate.isCorporateProject ? 'Да' : 'Нет' }}</b></div>
            <div class="dc-row"><span>Российские компании</span><b>{{ d.corporate.russianCorporatePercent }}%</b></div>
            <div class="dc-verdict">{{ d.corporate.verdict }}</div>
          </div>
        </div>

        <!-- Тренд активности -->
        <div class="drone-card" v-if="d.activityTrend">
          <div class="dc-header">
            <i class="pi pi-chart-line"></i>
            <span>Тренд активности</span>
            <span class="dc-badge" :class="trendBadge(d.activityTrend.trend)">
              {{ d.activityTrend.trend }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Недавний средний/нед</span><b>{{ d.activityTrend.recentWeeklyAvg }}</b></div>
            <div class="dc-row"><span>Предыдущий средний/нед</span><b>{{ d.activityTrend.olderWeeklyAvg }}</b></div>
            <div class="dc-row"><span>Изменение</span><b :class="d.activityTrend.changePercent > 0 ? 'green' : 'red'">{{ d.activityTrend.changePercent > 0 ? '+' : '' }}{{ d.activityTrend.changePercent }}%</b></div>
            <div class="dc-row"><span>Последний релиз</span><b>{{ d.activityTrend.lastRelease ? new Date(d.activityTrend.lastRelease).toLocaleDateString('ru') : 'нет' }}</b></div>
            <div class="dc-row"><span>Релизов за год</span><b>{{ d.activityTrend.releasesPerYear }}</b></div>
            <!-- Мини-график -->
            <div class="dc-sparkline" v-if="d.activityTrend.weeklyData?.length">
              <div class="spark-title">Коммиты по неделям</div>
              <div class="spark-bars">
                <div v-for="(w, i) in d.activityTrend.weeklyData" :key="i"
                  class="spark-bar"
                  :style="{ height: sparkH(w.total, d.activityTrend.weeklyData) + 'px' }"
                  :title="w.week + ': ' + w.total + ' коммитов'"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Скорость реакции -->
        <div class="drone-card" v-if="d.responseTime">
          <div class="dc-header">
            <i class="pi pi-clock"></i>
            <span>Скорость реакции</span>
            <span class="dc-badge" :class="respBadge(d.responseTime.responsiveness)">
              {{ d.responseTime.responsiveness }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Первый ответ (медиана)</span><b>{{ d.responseTime.formattedResponse }}</b></div>
            <div class="dc-row"><span>Решение issue (медиана)</span><b>{{ d.responseTime.formattedResolve }}</b></div>
            <div class="dc-row"><span>Выборка</span><b>{{ d.responseTime.sampleSize }} issues</b></div>
          </div>
        </div>

        <!-- Лицензия -->
        <div class="drone-card" v-if="d.license">
          <div class="dc-header">
            <i class="pi pi-book"></i>
            <span>Лицензия</span>
            <span class="dc-badge" :class="d.license.forking === 'free' ? 'low' : d.license.forking === 'restricted' ? 'critical' : 'medium'">
              {{ d.license.type }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Тип</span><b>{{ d.license.type }}</b></div>
            <div class="dc-row"><span>Форкабельность</span><b>{{ d.license.forking }}</b></div>
            <div class="dc-row"><span>Смешивание</span><b>{{ d.license.canMix ? 'Да' : 'Нет' }}</b></div>
            <div class="dc-verdict">{{ d.license.sovereigntyNote }}</div>
          </div>
        </div>

        <!-- Форки -->
        <div class="drone-card" v-if="d.forks">
          <div class="dc-header">
            <i class="pi pi-share-alt"></i>
            <span>Существующие форки</span>
            <span class="dc-badge" :class="d.forks.russianForksCount > 0 ? 'low' : 'medium'">
              {{ d.forks.totalForks }} форков
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Всего форков</span><b>{{ d.forks.totalForks }}</b></div>
            <div class="dc-row"><span>Активных (&lt;90 дн)</span><b>{{ d.forks.activeForks }}</b></div>
            <div class="dc-row"><span>Российских форков</span><b :class="d.forks.russianForksCount > 0 ? 'green' : ''">{{ d.forks.russianForksCount }}</b></div>
            <div class="dc-row"><span>Жизнеспособность</span><b>{{ (d.forks.forkVitality * 100).toFixed(0) }}%</b></div>
            <div class="dc-verdict">{{ d.forks.verdict }}</div>
            <div class="dc-mini-table" v-if="d.forks.topForks?.length">
              <div class="dc-mini-title">Топ форки</div>
              <div v-for="f in d.forks.topForks.slice(0, 5)" :key="f.fullName" class="dc-mini-row">
                <span>{{ f.fullName }}</span>
                <span>{{ f.stars }} *</span>
                <span class="muted" :class="f.active ? 'green' : ''">{{ f.daysSincePush }}дн</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Капитализация кода -->
        <div class="drone-card wide" v-if="d.capitalization">
          <div class="dc-header">
            <i class="pi pi-dollar"></i>
            <span>Капитализация кода</span>
            <span class="dc-badge medium">{{ d.capitalization.ksloc }} KSLOC</span>
          </div>
          <div class="dc-body">
            <div class="dc-cols">
              <div>
                <div class="dc-mini-title">Размер</div>
                <div class="dc-row"><span>Строк кода</span><b>{{ d.capitalization.estimatedLOC?.toLocaleString() }}</b></div>
                <div class="dc-row"><span>Человеко-месяцы</span><b>{{ d.capitalization.personMonths }}</b></div>
                <div class="dc-row"><span>Возраст проекта</span><b>{{ d.capitalization.ageYears }} лет</b></div>
                <div class="dc-row"><span>Ценность экосистемы</span><b>{{ d.capitalization.ecosystemValue }}</b></div>
              </div>
              <div>
                <div class="dc-mini-title">Стоимость традиционно</div>
                <div class="dc-row"><span>В России</span><b class="cost">{{ d.capitalization.costTraditional?.russiaFormatted }}</b></div>
                <div class="dc-row"><span>В США</span><b class="cost">{{ d.capitalization.costTraditional?.usaFormatted }}</b></div>
              </div>
              <div>
                <div class="dc-mini-title">Стоимость с ИИ</div>
                <div class="dc-row"><span>Чистая переписка</span><b class="cost green">{{ d.capitalization.costWithAI?.cleanRewrite }}</b></div>
                <div class="dc-row"><span>С edge-cases</span><b class="cost">{{ d.capitalization.costWithAI?.withEdgeCases }}</b></div>
                <div class="dc-row"><span>Экосистема</span><b class="cost red">{{ d.capitalization.costWithAI?.ecosystem }}</b></div>
              </div>
              <div>
                <div class="dc-mini-title">Сложность форка</div>
                <div class="dc-row"><span>Трудозатраты</span><b class="cost">{{ d.capitalization.forkCost?.effort }}</b></div>
              </div>
            </div>
            <div class="dc-verdict">{{ d.capitalization.verdictRu }}</div>
            <!-- Языки -->
            <div class="dc-lang-bars" v-if="d.capitalization.languages">
              <div v-for="(bytes, lang) in topLanguages" :key="lang" class="lang-bar-row">
                <span class="lang-label">{{ lang }}</span>
                <div class="lang-bar-wrap">
                  <div class="lang-bar" :style="{ width: langPct(bytes) + '%' }"></div>
                </div>
                <span class="lang-pct">{{ langPct(bytes) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- AI-присутствие -->
        <div class="drone-card" v-if="d.aiPresence">
          <div class="dc-header">
            <i class="pi pi-microchip-ai"></i>
            <span>AI-присутствие</span>
            <span class="dc-badge" :class="aiLevelBadge(d.aiPresence.aiLevel)">
              {{ d.aiPresence.aiLevel }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>AI-коммиты</span><b>{{ d.aiPresence.aiCommits }} / {{ d.aiPresence.totalCommitsAnalyzed }}</b></div>
            <div class="dc-row"><span>AI-коммиты %</span><b>{{ d.aiPresence.aiCommitPercent }}%</b></div>
            <div class="dc-row"><span>Бот-коммиты</span><b>{{ d.aiPresence.botCommits }}</b></div>
            <div class="dc-row"><span>Человеческие</span><b>{{ d.aiPresence.humanCommits }}</b></div>
            <div class="dc-row"><span>AI PR-ы</span><b>{{ d.aiPresence.aiPRs }} ({{ d.aiPresence.aiPRPercent }}%)</b></div>
            <div class="dc-verdict">{{ d.aiPresence.forkImplication }}</div>
            <div class="dc-mini-table" v-if="d.aiPresence.aiEvidence?.length">
              <div class="dc-mini-title">Свидетельства AI</div>
              <div v-for="e in d.aiPresence.aiEvidence.slice(0, 5)" :key="e.sha || e.number" class="dc-mini-row">
                <span class="muted">{{ e.type }}</span>
                <span>{{ e.sha || '#' + e.number }}</span>
                <span class="muted">{{ (e.message || e.title || '').slice(0, 50) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Риски безопасности -->
        <div class="drone-card" v-if="d.securityRisks">
          <div class="dc-header">
            <i class="pi pi-shield"></i>
            <span>Риски безопасности</span>
            <span class="dc-badge" :class="d.securityRisks.securityScore >= 70 ? 'low' : d.securityRisks.securityScore >= 40 ? 'medium' : 'critical'">
              {{ d.securityRisks.securityScore }}/100
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>PR-based workflow</span><b :class="d.securityRisks.prBasedWorkflow ? 'green' : 'red'">{{ d.securityRisks.prBasedWorkflow ? 'Да' : 'Нет' }}</b></div>
            <div class="dc-row"><span>Покрытие ревью</span><b>{{ d.securityRisks.reviewCoverage }}%</b></div>
            <div class="dc-row"><span>Топ-1 контрибутор</span><b>{{ d.securityRisks.top1ContributorPercent }}%</b></div>
            <div class="dc-row"><span>Подозрительные паттерны</span><b :class="d.securityRisks.suspiciousCount > 0 ? 'red' : 'green'">{{ d.securityRisks.suspiciousCount }}</b></div>
            <div v-if="d.securityRisks.risks?.length" class="dc-risks">
              <div v-for="r in d.securityRisks.risks" :key="r" class="dc-risk-item">{{ r }}</div>
            </div>
          </div>
        </div>

        <!-- Риски устойчивости -->
        <div class="drone-card" v-if="d.sustainability">
          <div class="dc-header">
            <i class="pi pi-heart"></i>
            <span>Риски устойчивости</span>
            <span class="dc-badge" :class="d.sustainability.burnoutLevel">
              выгорание: {{ d.sustainability.burnoutScore }}
            </span>
          </div>
          <div class="dc-body">
            <div class="dc-row"><span>Главный мейнтейнер</span><b>{{ d.sustainability.mainMaintainer }} ({{ d.sustainability.mainMaintainerPercent }}%)</b></div>
            <div class="dc-row"><span>Звёзд / контрибутор</span><b>{{ d.sustainability.starToContributorRatio }}</b></div>
            <div class="dc-row"><span>Issues / мейнтейнер</span><b>{{ d.sustainability.issueLoadPerMaintainer }}</b></div>
            <div v-if="d.sustainability.signals?.length" class="dc-risks">
              <div v-for="s in d.sustainability.signals" :key="s" class="dc-risk-item">{{ s }}</div>
            </div>
            <div class="dc-verdict">{{ d.sustainability.recommendation }}</div>
          </div>
        </div>

      </div>

      <!-- ═══ ЭПОХА ИИ: Философский блок ═══ -->
      <div class="epoch-block" v-if="d.aiPresence">
        <div class="epoch-header">Что мы оцениваем в эпоху ИИ?</div>
        <div class="epoch-body">
          <p>{{ d.aiPresence.epochNote }}</p>
          <div class="epoch-table">
            <div class="et-row et-header">
              <div>Аспект</div><div>Может ИИ?</div><div>Ценность для форка</div>
            </div>
            <div class="et-row" v-for="a in epochAspects" :key="a.aspect">
              <div>{{ a.aspect }}</div>
              <div :class="a.canAI ? 'green' : 'red'">{{ a.canAI ? 'Да' : 'Нет' }}</div>
              <div><b>{{ a.forkValue }}</b></div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  fstProjects: { type: Array, default: () => [] }
})
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import dagre from 'cytoscape-dagre'
import fcose from 'cytoscape-fcose'

cytoscape.use(cola)
cytoscape.use(dagre)
cytoscape.use(fcose)

const cyContainer = ref(null)
let cy = null
const selectedNode = ref(null)
const activeLayout = ref('dagre')

const repoUrl = ref('')
const scanning = ref(false)
const scanProgress = ref(0)
const scanStatus = ref('')
const result = ref(null)

const d = computed(() => result.value?.drones || {})

// ── Запуск скана через бэкенд ──
async function startScan() {
  if (!repoUrl.value) return
  scanning.value = true
  scanProgress.value = 0
  scanStatus.value = 'Подключение к GitHub API...'

  try {
    // Вызываем бэкенд API
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const resp = await fetch(`${apiUrl}/api/gift/github/sovereignty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: repoUrl.value })
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    result.value = await resp.json()
  } catch (err) {
    console.error('Scan failed:', err)
    // Fallback: используем демо-данные для отладки UI
    result.value = getDemoData()
  } finally {
    scanning.value = false
    scanProgress.value = 100
  }
}

// ── Метрики для верхней полоски ──
const topMetrics = computed(() => {
  if (!result.value) return []
  const c = d.value.community || {}
  const t = d.value.activityTrend || {}
  const cap = d.value.capitalization || {}
  const ai = d.value.aiPresence || {}
  const sec = d.value.securityRisks || {}
  return [
    { icon: 'pi pi-star', color: 'var(--fst-brand)', val: c.stars?.toLocaleString() || '0', label: 'Звёзды' },
    { icon: 'pi pi-users', color: 'var(--p-primary-color)', val: c.contributors || 0, label: 'Контрибуторы' },
    { icon: 'pi pi-chart-line', color: t.trend === 'growing' ? 'var(--fst-green)' : t.trend === 'declining' ? 'var(--fst-red)' : 'var(--fst-brand)', val: t.trend || '?', label: 'Тренд' },
    { icon: 'pi pi-dollar', color: 'var(--fst-cyan)', val: cap.costTraditional?.russiaFormatted || '?', label: 'Капитализация (РФ)' },
    { icon: 'pi pi-microchip-ai', color: 'var(--fst-purple)', val: (ai.aiCommitPercent || 0) + '%', label: 'AI-код' },
    { icon: 'pi pi-shield', color: sec.securityScore >= 70 ? 'var(--fst-green)' : 'var(--fst-red)', val: (sec.securityScore || 0) + '/100', label: 'Безопасность' }
  ]
})

// ── Вспомогательные функции ──
const verdictClass = computed(() => {
  const s = result.value?.summary?.sovereigntyScore || 0
  return s >= 75 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low'
})

const sortedGeo = computed(() => {
  const geo = d.value.geography?.geoDistribution || {}
  return Object.fromEntries(Object.entries(geo).sort((a, b) => b[1] - a[1]))
})

const topLanguages = computed(() => {
  const langs = d.value.capitalization?.languages || {}
  return Object.fromEntries(Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 8))
})

const totalLangBytes = computed(() => Object.values(d.value.capitalization?.languages || {}).reduce((s, v) => s + v, 0))
function langPct(bytes) { return totalLangBytes.value > 0 ? +(bytes / totalLangBytes.value * 100).toFixed(1) : 0 }

const GEO_NAMES = {
  russia: 'Россия', usa: 'США', eu: 'Европа', china: 'Китай', india: 'Индия',
  japan: 'Япония', korea: 'Корея', israel: 'Израиль', canada: 'Канада',
  brazil: 'Бразилия', other_cis: 'СНГ', other: 'Прочие', unknown: 'Неизвестно'
}
function geoName(k) { return GEO_NAMES[k] || k }
function geoBarClass(region) {
  if (region === 'russia') return 'geo-ru'
  if (['usa', 'eu', 'canada'].includes(region)) return 'geo-sanction'
  return 'geo-neutral'
}

function trendBadge(trend) {
  return { growing: 'low', stable: 'medium', declining: 'high', dying: 'critical', dead: 'critical', abandoned: 'critical' }[trend] || 'medium'
}
function respBadge(resp) {
  return { excellent: 'low', good: 'low', slow: 'medium', unresponsive: 'critical' }[resp] || 'medium'
}
function aiLevelBadge(level) {
  return { minimal: 'low', light: 'low', moderate: 'medium', heavy: 'high' }[level] || 'medium'
}

function sparkH(val, data) {
  const max = Math.max(...data.map(d => d.total), 1)
  return Math.max(2, Math.round(val / max * 40))
}

const epochAspects = [
  { aspect: 'Чистый код (логика, алгоритмы)', canAI: true, forkValue: 'Низкая' },
  { aspect: 'Edge-cases и production баг-фиксы', canAI: false, forkValue: 'Высокая' },
  { aspect: 'Интеграции с другими системами', canAI: false, forkValue: 'Высокая' },
  { aspect: 'CI/CD пайплайны и инфраструктура', canAI: true, forkValue: 'Средняя' },
  { aspect: 'Документация пользовательских сценариев', canAI: false, forkValue: 'Высокая' },
  { aspect: 'Adoption (сколько людей используют)', canAI: false, forkValue: 'Критическая' },
  { aspect: 'Сообщество: баг-репорты, обсуждения', canAI: false, forkValue: 'Критическая' },
  { aspect: 'Тесты (unit/integration/e2e)', canAI: true, forkValue: 'Средняя' },
  { aspect: 'Security аудиты и CVE-фиксы', canAI: false, forkValue: 'Критическая' }
]

// ── Cytoscape граф онтологии дара ──
const DRONE_META = {
  community: { label: 'Сообщество', icon: 'pi-users' },
  geography: { label: 'География', icon: 'pi-globe' },
  corporate: { label: 'Корпорации', icon: 'pi-building' },
  activityTrend: { label: 'Активность', icon: 'pi-chart-line' },
  responseTime: { label: 'Реакция', icon: 'pi-clock' },
  license: { label: 'Лицензия', icon: 'pi-book' },
  forks: { label: 'Форки', icon: 'pi-share-alt' },
  capitalization: { label: 'Капитализация', icon: 'pi-dollar' },
  aiPresence: { label: 'AI-код', icon: 'pi-microchip-ai' },
  securityRisks: { label: 'Безопасность', icon: 'pi-shield' },
  sustainability: { label: 'Устойчивость', icon: 'pi-heart' },
}

// Gift ontology aspects — mapped from GitHub actions
const GIFT_ASPECTS = [
  { id: 'gift_offer', label: 'gift.offer\n(PR submitted)', canAI: true },
  { id: 'gratitude_edge', label: 'gratitude\n(PR reviewed)', canAI: false },
  { id: 'gift_accept', label: 'gift.accept\n(PR merged)', canAI: false },
  { id: 'gift_decline', label: 'gift.decline\n(PR closed)', canAI: false },
  { id: 'telos_declare', label: 'telos.declare\n(Issue opened)', canAI: true },
  { id: 'freedom_accept', label: 'freedom.accept\n(Review approved)', canAI: false },
  { id: 'freedom_refuse', label: 'freedom.refuse\n(Changes req.)', canAI: false },
]

function droneHealth(key, drones) {
  if (!drones[key]) return 'unknown'
  const dr = drones[key]
  if (key === 'community') return dr.busFactorRisk === 'critical' ? 'bad' : dr.busFactorRisk === 'medium' ? 'warn' : 'good'
  if (key === 'geography') return dr.sovereigntySignal === 'high_dependency' ? 'bad' : dr.sovereigntySignal === 'positive' ? 'good' : 'warn'
  if (key === 'corporate') return dr.corporateRisk === 'critical' || dr.corporateRisk === 'high' ? 'bad' : dr.corporateRisk === 'low' ? 'good' : 'warn'
  if (key === 'activityTrend') return dr.trend === 'declining' || dr.trend === 'dying' ? 'bad' : dr.trend === 'growing' ? 'good' : 'warn'
  if (key === 'responseTime') return dr.responsiveness === 'unresponsive' ? 'bad' : dr.responsiveness === 'excellent' || dr.responsiveness === 'good' ? 'good' : 'warn'
  if (key === 'license') return dr.forking === 'free' ? 'good' : dr.forking === 'restricted' ? 'bad' : 'warn'
  if (key === 'forks') return dr.russianForksCount > 0 ? 'good' : dr.activeForks > 100 ? 'good' : 'warn'
  if (key === 'capitalization') return dr.ecosystemValue === 'high' ? 'good' : 'warn'
  if (key === 'aiPresence') return dr.aiLevel === 'heavy' ? 'warn' : 'good'
  if (key === 'securityRisks') return dr.securityScore >= 70 ? 'good' : dr.securityScore >= 40 ? 'warn' : 'bad'
  if (key === 'sustainability') return dr.burnoutLevel === 'low' ? 'good' : dr.burnoutLevel === 'high' || dr.burnoutLevel === 'critical' ? 'bad' : 'warn'
  return 'warn'
}

const HEALTH_COLORS = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', unknown: '#64748b' }

// Multiple projects for the portfolio graph
const demoProjects = ref([])

function convertFstProjects(fstList) {
  return fstList.map(p => {
    const name = (p.title || p.name || '').replace(/^ООО\s*/i, '').slice(0, 25)
    const trl = p.trl || 5
    const emp = p.employees || 10
    const sov = p.sovereigntyScore || 5
    const loc = p.localizationRatio || 0.5
    const pat = p.patents || 0
    const busFactor = Math.max(Math.round(emp / 5), 1)
    const sovScore = Math.round(loc * 100)
    const topShare = emp > 20 ? 15 : emp > 5 ? 35 : 60
    const reviewCov = trl >= 7 ? 80 : trl >= 5 ? 55 : 30
    const burnout = emp < 5 ? 'critical' : emp < 15 ? 'high' : 'low'
    const verdict = sovScore >= 70 ? 'СУВЕРЕННО' : sovScore >= 45 ? 'УСЛОВНО' : 'ВЫСОКИЕ РИСКИ'

    return {
      owner: p.subFund || p.subfund || 'ФСТ', repo: name,
      scanDate: new Date().toISOString(), scanDurationMs: 1000,
      summary: {
        sovereigntyScore: sovScore, verdict,
        keyRisks: sovScore < 50 ? ['Низкая локализация'] : [],
        strengths: [trl >= 7 ? `TRL ${trl}` : '', pat > 0 ? `${pat} патентов` : '', sov >= 7 ? 'Высокая суверенность' : ''].filter(Boolean),
      },
      drones: {
        community: { stars: emp * 50, forks: emp * 10, contributors: emp, totalCommits: emp * 500, busFactor, busFactorRisk: busFactor >= 5 ? 'low' : busFactor >= 2 ? 'medium' : 'high', top1Percent: String(topShare), license: loc > 0.7 ? 'MIT' : 'proprietary', language: 'Mixed' },
        geography: { geoDistribution: { russia: Math.round(loc * 100), usa: Math.round((1 - loc) * 50), eu: Math.round((1 - loc) * 30), china: 5, unknown: 5 }, russianPresence: true, russianContributors: Math.round(emp * loc), sanctionSourcePercent: Math.round((1 - loc) * 100), sovereigntySignal: loc > 0.7 ? 'positive' : loc > 0.4 ? 'medium_dependency' : 'high_dependency' },
        corporate: { dominantCorporation: 'none', dominantPercent: 0, corporateRisk: 'low' },
        securityRisks: { securityScore: Math.round(50 + trl * 5), reviewCoverage: reviewCov, top1ContributorPercent: topShare, risks: reviewCov < 50 ? ['Низкое покрытие ревью'] : [] },
        sustainability: { mainMaintainer: 'founder', mainMaintainerPercent: topShare, burnoutLevel: burnout, recommendation: burnout === 'low' ? 'Устойчив.' : 'Риск выгорания.' },
        license: { type: loc > 0.7 ? 'permissive' : 'proprietary', forking: loc > 0.7 ? 'free' : 'restricted' },
        activity: { trend: trl >= 6 ? 'growing' : 'stable', recentAvg: emp * 5, previousAvg: emp * 4 },
        capitalization: { sloc: emp * 10000, personMonths: emp * 12, costRussia: `${(emp * 2).toFixed(0)} млн руб`, projectAge: `${2026 - (p.founded || 2020)} лет` },
      }
    }
  })
}

function getDemoProjects() {
  const linux = getDemoData()
  return [
    linux,
    {
      owner: 'ArduPilot', repo: 'ardupilot', scanDate: new Date().toISOString(), scanDurationMs: 8200,
      summary: { sovereigntyScore: 58, verdict: 'УСЛОВНО ПОДХОДИТ', keyRisks: ['Зависимость от западных корпораций'], strengths: ['Активное сообщество дронов', 'Открытая лицензия'] },
      drones: {
        community: { stars: 11200, forks: 16800, contributors: 180, totalCommits: 420000, busFactor: 8, busFactorRisk: 'medium', top1Percent: '7.2', license: 'GPL-3.0', language: 'C++' },
        geography: { geoDistribution: { usa: 40, eu: 25, russia: 3, china: 15, india: 7, unknown: 10 }, russianPresence: true, russianContributors: 2, sanctionSourcePercent: 65, sovereigntySignal: 'medium_dependency' },
        corporate: { dominantCorporation: 'CubePilot', dominantPercent: 22, corporateRisk: 'medium' },
        securityRisks: { securityScore: 65, reviewCoverage: 55, top1ContributorPercent: 7.2, risks: ['Низкое покрытие review'] },
        sustainability: { mainMaintainer: 'peterbarker', mainMaintainerPercent: 7.2, burnoutLevel: 'medium', recommendation: 'Умеренный риск burnout.' },
        license: { type: 'copyleft', forking: 'must_open_source' },
      }
    },
    {
      owner: 'PX4', repo: 'PX4-Autopilot', scanDate: new Date().toISOString(), scanDurationMs: 7100,
      summary: { sovereigntyScore: 45, verdict: 'ВЫСОКИЕ РИСКИ', keyRisks: ['Сильная зависимость от Dronecode/Linux Foundation', 'Санкционные юрисдикции'], strengths: ['Стандарт индустрии БПЛА'] },
      drones: {
        community: { stars: 8400, forks: 12200, contributors: 140, totalCommits: 310000, busFactor: 5, busFactorRisk: 'medium', top1Percent: '11.3', license: 'BSD-3', language: 'C++' },
        geography: { geoDistribution: { usa: 45, eu: 30, china: 12, russia: 1, india: 5, unknown: 7 }, russianPresence: true, russianContributors: 1, sanctionSourcePercent: 75, sovereigntySignal: 'high_dependency' },
        corporate: { dominantCorporation: 'Auterion', dominantPercent: 35, corporateRisk: 'high' },
        securityRisks: { securityScore: 55, reviewCoverage: 48, top1ContributorPercent: 11.3, risks: ['Высокая зависимость от одного мейнтейнера'] },
        sustainability: { mainMaintainer: 'LorenzMeier', mainMaintainerPercent: 11.3, burnoutLevel: 'high', recommendation: 'Высокий риск burnout. Проект может стагнировать.' },
        license: { type: 'permissive', forking: 'free' },
      }
    },
    {
      owner: 'mavlink', repo: 'mavlink', scanDate: new Date().toISOString(), scanDurationMs: 3400,
      summary: { sovereigntyScore: 82, verdict: 'СУВЕРЕННО', keyRisks: [], strengths: ['Протокол-стандарт', 'Минимальная корпоративная зависимость', 'Свободная лицензия'] },
      drones: {
        community: { stars: 3200, forks: 2800, contributors: 95, totalCommits: 18000, busFactor: 12, busFactorRisk: 'low', top1Percent: '4.5', license: 'MIT', language: 'Python' },
        geography: { geoDistribution: { usa: 25, eu: 35, russia: 8, china: 15, india: 10, unknown: 7 }, russianPresence: true, russianContributors: 5, sanctionSourcePercent: 60, sovereigntySignal: 'positive' },
        corporate: { dominantCorporation: 'none', dominantPercent: 0, corporateRisk: 'low' },
        securityRisks: { securityScore: 78, reviewCoverage: 72, risks: [] },
        sustainability: { mainMaintainer: 'community', mainMaintainerPercent: 4.5, burnoutLevel: 'low', recommendation: 'Здоровый проект.' },
        license: { type: 'permissive', forking: 'free' },
      }
    },
    {
      owner: 'kubernetes', repo: 'kubernetes', scanDate: new Date().toISOString(), scanDurationMs: 15600,
      summary: { sovereigntyScore: 38, verdict: 'КРИТИЧЕСКИЕ РИСКИ', keyRisks: ['Google контролирует 30%', '90% контрибуторов из санкционных юрисдикций', 'Сложность форка'], strengths: ['Де-факто стандарт', 'Огромная экосистема'] },
      drones: {
        community: { stars: 112000, forks: 40000, contributors: 250, totalCommits: 380000, busFactor: 35, busFactorRisk: 'low', top1Percent: '1.8', license: 'Apache-2.0', language: 'Go' },
        geography: { geoDistribution: { usa: 50, eu: 20, china: 15, russia: 2, india: 8, unknown: 5 }, russianPresence: true, russianContributors: 2, sanctionSourcePercent: 70, sovereigntySignal: 'high_dependency' },
        corporate: { dominantCorporation: 'Google', dominantPercent: 30, corporateRisk: 'high' },
        securityRisks: { securityScore: 88, reviewCoverage: 92, risks: [] },
        sustainability: { mainMaintainer: 'thockin', mainMaintainerPercent: 1.8, burnoutLevel: 'low', recommendation: 'Устойчив, но зависим от корпораций.' },
        license: { type: 'permissive', forking: 'free' },
      }
    },
  ]
}

function giftScore(proj) {
  // Composite gift ontology score based on drone data
  const d = proj.drones || {}
  let score = 0, count = 0
  if (d.community) { score += d.community.busFactorRisk === 'low' ? 90 : d.community.busFactorRisk === 'medium' ? 50 : 20; count++ }
  if (d.securityRisks) { score += (d.securityRisks.securityScore || 0); count++ }
  if (d.sustainability) { score += d.sustainability.burnoutLevel === 'low' ? 85 : d.sustainability.burnoutLevel === 'medium' ? 50 : 20; count++ }
  if (d.geography) { score += d.geography.sovereigntySignal === 'positive' ? 80 : d.geography.sovereigntySignal === 'high_dependency' ? 25 : 50; count++ }
  if (d.license) { score += d.license.forking === 'free' ? 90 : d.license.forking === 'restricted' ? 30 : 60; count++ }
  return count ? Math.round(score / count) : 50
}

function buildMultiProjectElements(projects) {
  const nodes = []
  const edges = []

  // Central hub
  nodes.push({ data: { id: 'hub', label: 'Проекты', nodeType: 'hub', color: '#6366f1', size: 38 } })

  // Criteria nodes — small circles with short labels below
  const criteria = [
    { id: 'cr_code', label: 'Код', icon: 'code' },
    { id: 'cr_review', label: 'Ревью', icon: 'review' },
    { id: 'cr_fork', label: 'Форк', icon: 'fork' },
    { id: 'cr_ours', label: 'Наши', icon: 'geo' },
    { id: 'cr_alive', label: 'Жив?', icon: 'alive' },
    { id: 'cr_safe', label: 'Безоп.', icon: 'safe' },
    { id: 'cr_license', label: 'Лиценз.', icon: 'license' },
  ]
  criteria.forEach(c => {
    nodes.push({ data: { id: c.id, label: c.label, nodeType: 'criterion', criterionIcon: c.icon, color: '#ddd6fe', size: 18 } })
    edges.push({ data: { source: 'hub', target: c.id, label: '' }, classes: 'gift-edge' })
  })

  projects.forEach((proj, pi) => {
    const pid = `proj_${pi}`
    const score = proj.summary?.sovereigntyScore || 0
    const gs = giftScore(proj)
    const repoColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
    nodes.push({ data: {
      id: pid, label: `${proj.repo}\n${score}%`, nodeType: 'repo',
      color: repoColor, size: 32, score, giftScore: gs, projIndex: pi,
      verdict: proj.summary?.verdict || '',
    }})
    edges.push({ data: { source: 'hub', target: pid, label: '' } })

    // Cross-edges to criteria — show which criteria this project satisfies
    const drones = proj.drones || {}
    if (drones.community) edges.push({ data: { source: pid, target: 'cr_code', label: '' }, classes: 'cross' })
    if (drones.geography?.russianContributors > 0) edges.push({ data: { source: pid, target: 'cr_ours', label: '' }, classes: 'cross' })
    if (drones.securityRisks?.securityScore >= 70) edges.push({ data: { source: pid, target: 'cr_safe', label: '' }, classes: 'cross' })
    if (drones.sustainability?.burnoutLevel !== 'critical') edges.push({ data: { source: pid, target: 'cr_alive', label: '' }, classes: 'cross' })
    if (drones.license?.forking === 'free') edges.push({ data: { source: pid, target: 'cr_license', label: '' }, classes: 'cross' })
  })

  return [...nodes, ...edges]
}

function getLayoutConfig(name) {
  const configs = {
    cola: { name: 'cola', animate: false, maxSimulationTime: 4000, nodeSpacing: 60, edgeLength: el => {
      const src = el.source().data('nodeType')
      const tgt = el.target().data('nodeType')
      if (src === 'hub' && tgt === 'repo') return 220
      if (src === 'hub' && tgt === 'gift_aspect') return 180
      if (src === 'repo' && tgt === 'drone') return 100
      return 150
    }, convergenceThreshold: 0.005, padding: 40, randomize: true, avoidOverlap: true },
    dagre: { name: 'dagre', rankDir: 'TB', nodeSep: 40, rankSep: 60, padding: 20, animate: false },
    fcose: { name: 'fcose', animate: false, quality: 'proof', nodeRepulsion: () => 8000, idealEdgeLength: () => 100, padding: 40, randomize: true, nodeSeparation: 60 },
  }
  return configs[name] || configs.fcose
}

function initCyGraph() {
  if (cy) { cy.destroy(); cy = null }
  if (!cyContainer.value) return

  const projects = demoProjects.value
  if (!projects.length) return

  cy = cytoscape({
    container: cyContainer.value,
    elements: buildMultiProjectElements(projects),
    style: [
      // ── Base node ──
      { selector: 'node', style: {
        'background-color': 'data(color)', 'label': 'data(label)',
        'font-size': 7, 'color': '#64748b', 'text-valign': 'bottom', 'text-halign': 'center',
        'text-margin-y': 3, 'text-wrap': 'wrap', 'text-max-width': 60,
        'width': 'data(size)', 'height': 'data(size)', 'shape': 'ellipse',
        'border-width': 1.5, 'border-color': '#ffffff', 'background-opacity': 0.9,
        'text-outline-width': 1, 'text-outline-color': '#ffffff', 'text-outline-opacity': 0.8,
        'overlay-padding': 3,
      }},
      // ── Hub ──
      { selector: 'node[nodeType="hub"]', style: {
        'font-size': 10, 'font-weight': 'bold',
        'text-valign': 'center', 'text-halign': 'center',
        'border-width': 2, 'border-color': '#4338ca',
        'color': '#ffffff', 'text-outline-color': '#4338ca', 'text-outline-width': 1.5,
        'overlay-color': '#6366f1', 'overlay-padding': 4, 'overlay-opacity': 0.1,
      }},
      // ── Repo ──
      { selector: 'node[nodeType="repo"]', style: {
        'font-size': 8, 'font-weight': 'bold',
        'text-valign': 'center', 'text-halign': 'center',
        'border-width': 2, 'border-color': '#ffffff',
        'color': '#ffffff', 'text-outline-color': 'data(color)', 'text-outline-width': 1,
        'text-wrap': 'wrap', 'text-max-width': 55,
        'overlay-color': 'data(color)', 'overlay-padding': 3, 'overlay-opacity': 0.08,
      }},
      // ── Criterion — small circle, label below ──
      { selector: 'node[nodeType="criterion"]', style: {
        'shape': 'ellipse', 'font-size': 8, 'color': '#7c3aed',
        'text-outline-color': '#ffffff', 'text-outline-width': 1,
        'border-color': '#c4b5fd', 'border-width': 1,
        'background-opacity': 0.5, 'text-valign': 'bottom', 'text-halign': 'center',
        'text-margin-y': 3,
      }},
      // ── Interaction states ──
      { selector: 'node.dimmed', style: { 'opacity': 0.1 } },
      { selector: 'node.highlighted', style: {
        'border-width': 4, 'border-color': '#3b82f6',
        'overlay-color': '#3b82f6', 'overlay-padding': 8, 'overlay-opacity': 0.15,
      }},
      // ── Edges ──
      { selector: 'edge', style: {
        'width': 1.2, 'line-color': '#e2e8f0', 'target-arrow-color': '#cbd5e1',
        'target-arrow-shape': 'vee', 'arrow-scale': 0.8, 'curve-style': 'bezier',
        'label': 'data(label)', 'font-size': 8, 'font-weight': 'bold', 'color': '#475569',
        'text-outline-width': 2, 'text-outline-color': '#ffffff',
        'text-rotation': 'autorotate', 'opacity': 0.5,
      }},
      { selector: 'edge.gift-edge', style: { 'line-style': 'dashed', 'line-dash-pattern': [4, 3], 'line-color': '#ddd6fe', 'target-arrow-color': '#ddd6fe', 'opacity': 0.35, 'target-arrow-shape': 'none' } },
      { selector: 'edge.cross', style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 4], 'line-color': '#c7d2fe', 'target-arrow-color': '#c7d2fe', 'opacity': 0.4, 'font-size': 7, 'color': '#818cf8' } },
      { selector: 'edge.dimmed', style: { 'opacity': 0.04 } },
      { selector: 'edge.highlighted', style: { 'line-color': '#6366f1', 'target-arrow-color': '#6366f1', 'opacity': 1, 'width': 2 } },
    ],
    layout: { name: 'preset' },
    userZoomingEnabled: true, userPanningEnabled: true, boxSelectionEnabled: false,
    minZoom: 0.3, maxZoom: 3,
  })

  // Run layout after cy is created, then fit
  const doFit = () => { if (cy) { cy.resize(); cy.fit(undefined, 30) } }
  const layout = cy.layout(getLayoutConfig('dagre'))
  layout.on('layoutstop', doFit)
  layout.run()
  // Fallback fit for layouts that don't fire layoutstop with animate:false
  setTimeout(doFit, 100)
  setTimeout(doFit, 500)

  // Click → detail panel
  cy.on('tap', 'node', evt => {
    const nd = evt.target.data()

    cy.elements().removeClass('highlighted dimmed')
    const connected = evt.target.closedNeighborhood()
    connected.addClass('highlighted')
    cy.elements().not(connected).addClass('dimmed')

    if (nd.nodeType === 'criterion') {
      const criterionDescs = {
        cr_code: 'Сколько разработчиков пишут код? Чем больше — тем устойчивее проект.',
        cr_review: 'Проверяют ли код перед принятием? Высокий % ревью = меньше багов и закладок.',
        cr_fork: 'Позволяет ли лицензия сделать свою копию проекта без ограничений?',
        cr_ours: 'Есть ли российские разработчики среди контрибуторов?',
        cr_alive: 'Активно ли развивается проект? Нет ли риска что его бросят?',
        cr_safe: 'Насколько безопасен код? Нет ли подозрительных паттернов (как xz-backdoor)?',
        cr_license: 'Подходит ли лицензия для использования в России?',
      }
      const connectedRepos = projects.filter((_, i) => {
        const pid = `proj_${i}`
        return cy?.edges(`[source="${pid}"][target="${nd.id}"]`).length > 0
      })
      selectedNode.value = {
        label: nd.label.replace('\n', ' '), type: 'Критерий оценки', color: '#8b5cf6',
        metrics: [
          { label: 'Проходят', val: connectedRepos.length + ' из ' + projects.length },
        ],
        desc: criterionDescs[nd.id] || ''
      }
    } else if (nd.nodeType === 'repo') {
      const proj = projects[nd.projIndex] || {}
      const s = proj.summary || {}
      const gs = giftScore(proj)
      const healthVerdict = gs >= 75 ? 'Можно брать' : gs >= 50 ? 'С оговорками' : 'Рискованно'
      selectedNode.value = {
        label: `${proj.owner}/${proj.repo}`, type: 'Проект', color: nd.color,
        metrics: [
          { label: 'Безопасность', val: (s.sovereigntyScore || '?') + '%' },
          { label: 'Здоровье', val: gs + '%' },
          { label: 'Вердикт', val: s.verdict || '' },
          { label: 'Итог', val: healthVerdict },
        ],
        desc: [...(s.keyRisks || []).map(r => 'Риск: ' + r), ...(s.strengths || []).map(r => '+ ' + r)].join('\n')
      }
    } else if (nd.nodeType === 'hub') {
      const avg = Math.round(projects.reduce((s, p) => s + (p.summary?.sovereigntyScore || 0), 0) / projects.length)
      const avgGift = Math.round(projects.reduce((s, p) => s + giftScore(p), 0) / projects.length)
      selectedNode.value = {
        label: 'Наши проекты', type: 'Портфель', color: '#6366f1',
        metrics: [
          { label: 'Проектов', val: projects.length },
          { label: 'Безопасность (сред.)', val: avg + '%' },
          { label: 'Здоровье (сред.)', val: avgGift + '%' },
        ],
        desc: 'Безопасность — можно ли форкнуть и использовать в России. Здоровье — активность сообщества, ревью, устойчивость.'
      }
    }
  })

  cy.on('tap', evt => {
    if (evt.target === cy) {
      cy.elements().removeClass('highlighted dimmed')
      selectedNode.value = null
    }
  })

}

function switchLayout(name) {
  if (!cy) return
  activeLayout.value = name
  const doFit = () => { if (cy) { cy.resize(); cy.fit(undefined, 30) } }
  const layout = cy.layout(getLayoutConfig(name))
  layout.on('layoutstop', doFit)
  layout.run()
  setTimeout(doFit, 100)
  setTimeout(doFit, 500)
}

// Auto-load data on mount
onMounted(() => {
  result.value = getDemoData()
  if (props.fstProjects?.length) {
    demoProjects.value = convertFstProjects(props.fstProjects)
  } else {
    demoProjects.value = getDemoProjects()
  }

  // Cytoscape needs a visible container — use ResizeObserver to detect when tab becomes visible
  const tryInit = () => {
    if (cyContainer.value && cyContainer.value.offsetHeight > 0) {
      if (props.fstProjects?.length) demoProjects.value = convertFstProjects(props.fstProjects)
      initCyGraph()
      return true
    }
    return false
  }

  nextTick(() => {
    if (tryInit()) return
    // Container not visible yet (tab not active) — poll until visible
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval)
    }, 500)
    // Stop polling after 30s
    setTimeout(() => clearInterval(interval), 30000)
  })
})

// Rebuild graph when result or fstProjects change
watch(result, () => { nextTick(() => initCyGraph()) })
watch(() => props.fstProjects?.length, (len) => {
  if (len > 0) {
    demoProjects.value = convertFstProjects(props.fstProjects)
    nextTick(() => initCyGraph())
  }
})

onBeforeUnmount(() => {
  if (cy) { cy.destroy(); cy = null }
})

// ── Демо-данные для разработки UI ──
function getDemoData() {
  return {
    owner: 'torvalds', repo: 'linux', scanDate: new Date().toISOString(), scanDurationMs: 12400,
    summary: {
      sovereigntyScore: 72,
      verdict: 'УСЛОВНО ПОДХОДИТ (есть риски)',
      keyRisks: ['Корпоративная зависимость: intel', '85% контрибуторов из стран-санкционеров'],
      strengths: ['Есть российские контрибуторы', 'Здоровый bus factor: 42', 'Проект растёт', 'Свободная лицензия']
    },
    drones: {
      community: { stars: 186000, forks: 55000, contributors: 250, totalCommits: 1200000, busFactor: 42, busFactorRisk: 'low', top1Percent: '2.1', license: 'GPL-2.0', language: 'C', top5Contributors: [
        { login: 'torvalds', contributions: 25200, pct: '2.1' },
        { login: 'gregkh', contributions: 18400, pct: '1.5' },
        { login: 'axboe', contributions: 12300, pct: '1.0' },
        { login: 'davem330', contributions: 11200, pct: '0.9' },
        { login: 'tiwai', contributions: 9800, pct: '0.8' }
      ]},
      geography: { geoDistribution: { usa: 35, eu: 30, russia: 5, china: 10, india: 8, unknown: 12 }, profilesCovered: '22/30', russianPresence: true, russianContributors: 3, sanctionSourcePercent: 65, geoDiversity: 5, sovereigntySignal: 'positive' },
      corporate: { dominantCorporation: 'intel', dominantPercent: 18, isCorporateProject: false, russianCorporatePresence: false, russianCorporatePercent: 0, corporateRisk: 'low', verdict: 'Community-driven проект. Более устойчив к уходу одного спонсора.', corporateDistribution: { intel: 18, google: 12, ibm: 8, microsoft: 5 } },
      activityTrend: { trend: 'growing', recentWeeklyAvg: 285, olderWeeklyAvg: 260, changePercent: 9.6, lastRelease: '2026-03-10', releasesPerYear: 12, weeklyData: [
        { week: '2026-01-05', total: 240 }, { week: '2026-01-12', total: 310 }, { week: '2026-01-19', total: 280 },
        { week: '2026-01-26', total: 295 }, { week: '2026-02-02', total: 260 }, { week: '2026-02-09', total: 320 },
        { week: '2026-02-16', total: 290 }, { week: '2026-02-23', total: 275 }, { week: '2026-03-02', total: 310 },
        { week: '2026-03-09', total: 285 }, { week: '2026-03-16', total: 300 }, { week: '2026-03-16', total: 0 }
      ]},
      responseTime: { medianFirstResponseHours: 6.2, medianResolveHours: 72, sampleSize: 20, responsiveness: 'good', formattedResponse: '6 ч', formattedResolve: '3 дн' },
      license: { type: 'copyleft', canMix: false, forking: 'must_open_source', sovereigntyNote: 'Форк должен оставаться open-source (GPL)' },
      forks: { totalForks: 55000, activeForks: 3200, russianForksCount: 2, forkVitality: 0.064, verdict: 'Найдено 2 российских форков. Можно координировать усилия.', topForks: [
        { fullName: 'AltLinux/linux', stars: 120, daysSincePush: 3, active: true },
        { fullName: 'AstraLinux/kernel', stars: 45, daysSincePush: 12, active: true }
      ]},
      capitalization: { languages: { C: 850000000, 'C++': 12000000, Assembly: 45000000, Python: 8000000, Shell: 6000000, Makefile: 15000000 }, estimatedLOC: 28000000, ksloc: 28000, personMonths: 95000, costTraditional: { russiaFormatted: '59.4 млрд руб', usaFormatted: '256.5 млрд руб' }, costWithAI: { cleanRewrite: '5.9 млрд руб', withEdgeCases: '19.6 млрд руб', ecosystem: 'Не воспроизводимо' }, forkCost: { effort: '8.9 млрд руб' }, ageYears: 33.2, ecosystemValue: 'high', verdictRu: 'Крупный проект. Полная переписка нерентабельна даже с ИИ.' },
      aiPresence: { totalCommitsAnalyzed: 200, aiCommits: 2, botCommits: 15, humanCommits: 183, aiCommitPercent: 1.1, aiPRs: 0, aiPRPercent: 0, aiLevel: 'minimal', forkImplication: 'Преимущественно человеческий код. Глубокое понимание у контрибуторов.', epochNote: 'В эпоху ИИ ценность проекта — не в коде, а в: (1) edge-cases и баг-фиксах за годы, (2) экосистеме интеграций, (3) adoption и доверии, (4) документации реальных сценариев. Клод форкнет и перепишет. Но 10 лет production-опыта — нет.', aiEvidence: [] },
      securityRisks: { securityScore: 80, prBasedWorkflow: true, reviewCoverage: 85, top1ContributorPercent: 2.1, suspiciousCount: 0, risks: [] },
      sustainability: { mainMaintainer: 'torvalds', mainMaintainerPercent: 2.1, starToContributorRatio: 744, issueLoadPerMaintainer: 12, burnoutScore: 15, burnoutLevel: 'low', signals: [], recommendation: 'Здоровое распределение нагрузки.' }
    }
  }
}
</script>

<style scoped>
.repo-input { min-width: 300px; }

/* ── Прогресс ── */
.scan-progress { padding: 20px; text-align: center; }
.scan-status { margin-top: 8px; font-size: 0.8rem; color: var(--p-text-muted-color); }

/* ── Вердикт ── */
.verdict-bar { display: flex; align-items: flex-start; gap: 20px; background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; flex-wrap: wrap; margin-bottom: 12px; }
.verdict-score { text-align: center; min-width: 100px; }
.vs-val { font-size: 2.8rem; font-weight: 900; }
.vs-label { font-size: 0.7rem; color: var(--p-text-muted-color); }
.vs-verdict { font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-top: 4px; display: inline-block; white-space: nowrap; }
.score-high .vs-val { color: var(--fst-green); }
.score-high .vs-verdict { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.score-mid .vs-val { color: var(--fst-brand); }
.score-mid .vs-verdict { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.score-low .vs-val { color: var(--fst-red); }
.score-low .vs-verdict { background: color-mix(in srgb, var(--fst-red) 12%, transparent); color: var(--fst-red); }

.verdict-meta { display: flex; flex-direction: column; gap: 4px; }
.vm-repo { font-weight: 700; font-size: 1rem; color: var(--p-text-color); }
.vm-date, .vm-duration { font-size: 0.72rem; color: var(--p-text-muted-color); }

.verdict-lists { display: flex; gap: 20px; flex: 1; flex-wrap: wrap; }
.vl-title { font-size: 0.7rem; font-weight: 700; color: var(--p-text-muted-color); margin-bottom: 4px; }
.vl-item { font-size: 0.78rem; padding: 2px 0; }
.vl-item.risk { color: var(--fst-red); }
.vl-item.risk::before { content: '\2022 '; }
.vl-item.strength { color: var(--fst-green); }
.vl-item.strength::before { content: '\2713 '; }

/* ── Сетка карточек ── */
.drones-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; margin-top: 12px; }
.drone-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.drone-card.wide { grid-column: span 2; }

.dc-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.dc-header i { color: var(--p-primary-color); font-size: 1rem; }

.dc-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-left: auto; white-space: nowrap; }
.dc-badge.low { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.dc-badge.medium { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.dc-badge.high { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.dc-badge.critical { background: color-mix(in srgb, var(--fst-red) 20%, transparent); color: var(--fst-red); font-weight: 900; }

.dc-body { display: flex; flex-direction: column; gap: 5px; }
.dc-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--p-text-color); padding: 2px 0; }
.dc-row span:first-child { color: var(--p-text-muted-color); }

.dc-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }

.dc-verdict { background: var(--p-surface-ground); border-radius: 6px; padding: 8px 10px; font-size: 0.75rem; color: var(--p-text-color); margin-top: 4px; }

.dc-mini-table { margin-top: 6px; }
.dc-mini-title { font-size: 0.68rem; font-weight: 700; color: var(--p-text-muted-color); margin-bottom: 4px; }
.dc-mini-row { display: flex; justify-content: space-between; font-size: 0.72rem; padding: 2px 0; border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent); }

.dc-risks { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.dc-risk-item { font-size: 0.72rem; color: var(--fst-red); padding: 2px 0; }
.dc-risk-item::before { content: '\26A0 '; }

/* ── Цвета ── */
.green { color: var(--fst-green) !important; }
.red { color: var(--fst-red) !important; }
.muted { color: var(--p-text-muted-color) !important; }
.cost { font-family: 'JetBrains Mono', monospace; }

/* ── Гео-бары ── */
.dc-geo-bars, .dc-lang-bars { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.geo-bar-row, .lang-bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; }
.geo-label, .lang-label { min-width: 70px; color: var(--p-text-muted-color); }
.geo-bar-wrap, .lang-bar-wrap { flex: 1; height: 8px; background: var(--p-surface-ground); border-radius: 4px; overflow: hidden; }
.geo-bar, .lang-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
.geo-bar.geo-ru { background: var(--fst-green); }
.geo-bar.geo-sanction { background: var(--fst-red); }
.geo-bar.geo-neutral { background: var(--p-primary-color); }
.lang-bar { background: var(--p-primary-color); }
.geo-pct, .lang-pct { min-width: 40px; text-align: right; color: var(--p-text-muted-color); }

/* ── Спарклайн ── */
.dc-sparkline { margin-top: 8px; }
.spark-title { font-size: 0.68rem; color: var(--p-text-muted-color); margin-bottom: 4px; }
.spark-bars { display: flex; align-items: flex-end; gap: 2px; height: 44px; }
.spark-bar { flex: 1; background: var(--p-primary-color); border-radius: 2px 2px 0 0; min-width: 4px; opacity: 0.7; }
.spark-bar:hover { opacity: 1; }

/* ── Эпоха ИИ ── */
.epoch-block { background: var(--p-surface-card); border: 1px solid var(--p-primary-color); border-radius: 10px; padding: 18px; margin-top: 16px; }
.epoch-header { font-size: 1rem; font-weight: 800; color: var(--p-text-color); margin-bottom: 10px; }
.epoch-body p { font-size: 0.82rem; color: var(--p-text-color); line-height: 1.6; margin: 0 0 12px; }
.epoch-table { display: flex; flex-direction: column; gap: 0; }
.et-row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; padding: 6px 8px; font-size: 0.78rem; border-bottom: 1px solid var(--p-content-border-color); }
.et-row.et-header { font-weight: 700; color: var(--p-text-muted-color); font-size: 0.72rem; }

/* ── Cytoscape граф ── */
.gift-graph-section { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
.gift-graph-root { display: flex; flex-direction: column; }
.gg-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--p-content-border-color); background: var(--p-surface-ground); }
.gg-scan-inline { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.gg-scan-input { width: 220px; font-size: 0.78rem; }
.gg-title { font-size: 0.88rem; font-weight: 700; color: var(--p-text-color); display: flex; align-items: center; gap: 6px; }
.gg-layouts { margin-left: auto; display: flex; gap: 4px; }
.gg-layout-btn { background: transparent; border: 1px solid var(--p-content-border-color); color: var(--p-text-muted-color); padding: 3px 10px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; transition: all 0.15s; }
.gg-layout-btn:hover { border-color: var(--p-primary-color); color: var(--p-text-color); }
.gg-layout-btn.active { background: var(--p-primary-color); border-color: var(--p-primary-color); color: #fff; }
.gg-legend { display: flex; gap: 14px; padding: 6px 14px; font-size: 11px; color: var(--p-text-muted-color); align-items: center; }
.gg-legend-item { display: flex; align-items: center; gap: 5px; }
.gg-hex { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); border-radius: 0 !important; }
.gg-legend-hint { margin-left: auto; font-size: 10px; color: var(--p-primary-400); font-style: italic; }
.gg-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.gg-body { display: flex; position: relative; overflow: hidden; border-radius: 0 0 10px 10px; }
.gg-canvas { flex: 1; min-width: 0; height: calc(100vh - 16rem); min-height: 400px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #eef2ff 100%); }
.gg-node-detail { width: 280px; flex-shrink: 0; border-left: 2px solid var(--p-primary-200); padding: 16px 18px; background: var(--p-surface-card); color: var(--p-text-color); overflow-y: auto; height: calc(100vh - 16rem); min-height: 400px; display: flex; flex-direction: column; gap: 10px; }
.gg-nd-close { display: flex; justify-content: flex-end; margin: -8px -8px 0 0; }
.gg-nd-header { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
.gg-nd-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.gg-nd-type { font-size: 0.7rem; color: var(--p-text-muted-color); padding: 2px 8px; border-radius: 10px; background: var(--p-surface-100); align-self: flex-start; }
.gg-nd-metrics { display: flex; flex-direction: column; gap: 8px; }
.gg-nd-metric { font-size: 0.82rem; display: flex; justify-content: space-between; align-items: baseline; gap: 4px; }
.gg-nd-metric span { color: var(--p-text-muted-color); font-size: 0.72rem; }
.gg-nd-metric b { font-size: 0.85rem; }
.gg-nd-desc { font-size: 0.76rem; color: var(--p-text-muted-color); white-space: pre-line; line-height: 1.5; padding: 8px 10px; background: var(--p-surface-50); border-radius: 6px; border-left: 3px solid var(--p-primary-300); }
/* slide transition */
.gg-slide-enter-active, .gg-slide-leave-active { transition: width 0.25s ease, opacity 0.25s ease; overflow: hidden; }
.gg-slide-enter-from, .gg-slide-leave-to { width: 0; opacity: 0; padding: 0; border-left-width: 0; }

/* ── Пустое состояние ── */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 300px; color: var(--p-text-muted-color); text-align: center; }
.empty-state p { margin: 0; font-size: 0.88rem; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .repo-input { min-width: 160px !important; }
  .drones-grid { grid-template-columns: 1fr !important; }
  .drone-card.wide { grid-column: span 1; }
  .verdict-bar { flex-direction: column; align-items: center; text-align: center; }
  .dc-cols { grid-template-columns: 1fr !important; }
  .et-row { grid-template-columns: 1fr; gap: 2px; }
  .et-row.et-header { display: none; }
}
</style>

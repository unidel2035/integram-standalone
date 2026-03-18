<template>
  <div class="sov-panel">
    <!-- Ввод репозитория -->
    <div class="sov-input-bar">
      <InputText v-model="repoUrl" placeholder="https://github.com/owner/repo" class="sov-input" />
      <Button icon="pi pi-search" label="Сканировать" size="small" :loading="scanning" @click="startScan" />
    </div>

    <ProgressBar v-if="scanning" :value="scanProgress" :showValue="true" style="margin-top: 8px" />

    <!-- Результаты: граф + детали -->
    <template v-if="result">
      <!-- Вердикт -->
      <div class="sov-verdict" :class="verdictClass">
        <div class="sov-score">{{ result.summary?.sovereigntyScore || 0 }}<span class="sov-score-of">/100</span></div>
        <div class="sov-verdict-text">{{ result.summary?.verdict }}</div>
        <div class="sov-repo">{{ result.owner }}/{{ result.repo }}</div>
      </div>

      <!-- Граф -->
      <div class="sov-graph-wrapper">
        <div class="sov-graph-toolbar">
          <span class="sov-graph-title"><i class="pi pi-share-alt" /> Граф суверенности</span>
          <div class="sov-layout-btns">
            <Button v-for="l in layouts" :key="l.name" :label="l.label" size="small" text
              :severity="currentLayout === l.name ? 'primary' : 'secondary'"
              @click="applyLayout(l.name)" />
          </div>
          <Button icon="pi pi-expand" size="small" text severity="secondary" @click="toggleFullscreen" style="margin-left:auto" />
        </div>

        <div class="sov-graph-legend">
          <span class="sov-legend-item" v-for="lt in legendTypes" :key="lt.label">
            <span class="sov-legend-dot" :style="{ background: lt.color }" />{{ lt.label }}
          </span>
        </div>

        <div ref="cyContainer" class="sov-graph-canvas" :class="{ fullscreen: isFullscreen }" />

        <!-- Выбранная нода -->
        <div v-if="selectedNode" class="sov-node-detail">
          <div class="sov-node-detail-header">
            <span class="sov-node-detail-dot" :style="{ background: selectedNode.color }" />
            <div>
              <div class="sov-node-detail-label">{{ selectedNode.label }}</div>
              <div class="sov-node-detail-type">{{ selectedNode.type }}</div>
            </div>
            <Button icon="pi pi-times" size="small" text severity="secondary" @click="clearSelection" style="margin-left:auto" />
          </div>
          <div v-if="selectedNode.metrics?.length" class="sov-node-metrics">
            <div v-for="m in selectedNode.metrics" :key="m.label" class="sov-metric" :class="m.class">
              <span class="sov-metric-label">{{ m.label }}</span>
              <span class="sov-metric-val">{{ m.val }}</span>
            </div>
          </div>
          <div v-if="selectedNode.desc" class="sov-node-desc">{{ selectedNode.desc }}</div>
        </div>
      </div>

      <!-- Риски / Сильные стороны -->
      <div class="sov-lists" v-if="result.summary?.keyRisks?.length || result.summary?.strengths?.length">
        <div class="sov-list" v-if="result.summary.keyRisks?.length">
          <div class="sov-list-title">Риски</div>
          <div v-for="r in result.summary.keyRisks" :key="r" class="sov-list-item risk">{{ r }}</div>
        </div>
        <div class="sov-list" v-if="result.summary.strengths?.length">
          <div class="sov-list-title">Сильные стороны</div>
          <div v-for="s in result.summary.strengths" :key="s" class="sov-list-item strength">{{ s }}</div>
        </div>
      </div>
    </template>

    <!-- Пустое состояние с демо -->
    <div v-if="!result && !scanning" class="sov-empty">
      <p>Введите URL репозитория для анализа суверенности (11 дронов, 50+ метрик)</p>
      <Button label="Демо: Linux kernel" icon="pi pi-play" size="small" severity="secondary" text @click="loadDemo" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import cola from 'cytoscape-cola'
import fcose from 'cytoscape-fcose'

cytoscape.use(dagre)
cytoscape.use(cola)
cytoscape.use(fcose)

const repoUrl = ref('')
const scanning = ref(false)
const scanProgress = ref(0)
const result = ref(null)
const cyContainer = ref(null)
const isFullscreen = ref(false)
const selectedNode = ref(null)
const currentLayout = ref('cola')
let cy = null

const layouts = [
  { name: 'cola', label: 'Физика' },
  { name: 'dagre', label: 'Иерархия' },
  { name: 'fcose', label: 'Кластеры' },
]

const legendTypes = [
  { label: 'Репозиторий', color: '#3b82f6' },
  { label: 'Дрон (здоров)', color: '#22c55e' },
  { label: 'Дрон (внимание)', color: '#f59e0b' },
  { label: 'Дрон (риск)', color: '#ef4444' },
  { label: 'Эпоха ИИ', color: '#8b5cf6' },
]

// ─── Drone definitions ───────────────────────────────────────────────────────

const DRONE_DEFS = [
  { key: 'community', label: 'Здоровье сообщества', icon: 'pi-users' },
  { key: 'geography', label: 'География', icon: 'pi-globe' },
  { key: 'corporate', label: 'Корпоративная зависимость', icon: 'pi-building' },
  { key: 'activityTrend', label: 'Тренд активности', icon: 'pi-chart-line' },
  { key: 'responseTime', label: 'Скорость реакции', icon: 'pi-clock' },
  { key: 'license', label: 'Лицензия', icon: 'pi-file' },
  { key: 'forks', label: 'Форки', icon: 'pi-copy' },
  { key: 'capitalization', label: 'Капитализация кода', icon: 'pi-dollar' },
  { key: 'aiPresence', label: 'AI-присутствие', icon: 'pi-microchip-ai' },
  { key: 'securityRisks', label: 'Риски безопасности', icon: 'pi-shield' },
  { key: 'sustainability', label: 'Устойчивость', icon: 'pi-heart' },
]

const EPOCH_ASPECTS = [
  { key: 'clean_code', label: 'Чистый код', canAI: true, forkValue: 'Низкая' },
  { key: 'edge_cases', label: 'Edge-cases', canAI: false, forkValue: 'Высокая' },
  { key: 'integrations', label: 'Интеграции', canAI: false, forkValue: 'Высокая' },
  { key: 'cicd', label: 'CI/CD', canAI: true, forkValue: 'Средняя' },
  { key: 'docs', label: 'Документация', canAI: false, forkValue: 'Высокая' },
  { key: 'adoption', label: 'Adoption', canAI: false, forkValue: 'Критическая' },
  { key: 'community_aspect', label: 'Сообщество', canAI: false, forkValue: 'Критическая' },
  { key: 'tests', label: 'Тесты', canAI: true, forkValue: 'Средняя' },
  { key: 'security_audits', label: 'Security аудиты', canAI: false, forkValue: 'Критическая' },
]

// ─── Drone health scoring ────────────────────────────────────────────────────

function droneHealth(key, drones) {
  const d = drones?.[key]
  if (!d) return 'unknown'
  switch (key) {
    case 'community': return d.busFactor >= 5 ? 'good' : d.busFactor >= 2 ? 'warn' : 'bad'
    case 'geography': return d.sanctionSourcePercent > 50 ? 'bad' : d.russianPresence ? 'good' : 'warn'
    case 'corporate': return d.isCorporateProject ? 'bad' : d.dominantPercent > 50 ? 'warn' : 'good'
    case 'activityTrend': return d.trend === 'growing' ? 'good' : d.trend === 'declining' ? 'bad' : 'warn'
    case 'responseTime': return ['excellent', 'good'].includes(d.responsiveness) ? 'good' : d.responsiveness === 'slow' ? 'bad' : 'warn'
    case 'license': return d.forking === 'free' ? 'good' : d.forking === 'restricted' ? 'bad' : 'warn'
    case 'forks': return d.activeForks > 10 ? 'good' : d.activeForks > 0 ? 'warn' : 'bad'
    case 'capitalization': return 'warn' // always informational
    case 'aiPresence': return d.aiCommitPercent > 50 ? 'bad' : d.aiCommitPercent > 20 ? 'warn' : 'good'
    case 'securityRisks': return d.securityScore >= 70 ? 'good' : d.securityScore >= 40 ? 'warn' : 'bad'
    case 'sustainability': return d.burnoutLevel === 'high' ? 'bad' : d.burnoutLevel === 'medium' ? 'warn' : 'good'
    default: return 'unknown'
  }
}

const HEALTH_COLORS = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', unknown: '#94a3b8' }

// ─── Build drone metrics for detail panel ────────────────────────────────────

function droneMetrics(key, drones) {
  const d = drones?.[key]
  if (!d) return []
  switch (key) {
    case 'community': return [
      { label: 'Звёзды', val: d.stars?.toLocaleString() || '?' },
      { label: 'Bus factor', val: `${d.busFactor || '?'} чел`, class: d.busFactorRisk === 'critical' ? 'red' : '' },
      { label: 'Топ-1', val: `${d.top1Percent || '?'}%` },
      { label: 'Контрибуторы', val: d.contributors || '?' },
    ]
    case 'geography': return [
      { label: 'Регионы', val: d.geoDiversity || '?' },
      { label: 'РФ', val: d.russianPresence ? 'Да' : 'Нет', class: d.russianPresence ? 'green' : 'red' },
      { label: 'Санкц.', val: `${d.sanctionSourcePercent || 0}%` },
    ]
    case 'corporate': return [
      { label: 'Доминант', val: d.dominantCorporation || 'нет' },
      { label: 'Доля', val: `${d.dominantPercent || 0}%` },
      { label: 'Корп?', val: d.isCorporateProject ? 'Да' : 'Нет', class: d.isCorporateProject ? 'red' : 'green' },
    ]
    case 'activityTrend': return [
      { label: 'Тренд', val: d.trend || '?', class: d.trend === 'growing' ? 'green' : d.trend === 'declining' ? 'red' : '' },
      { label: 'Коммитов/нед', val: d.recentWeeklyAvg || '?' },
      { label: 'Релизов/год', val: d.releasesPerYear || '?' },
    ]
    case 'responseTime': return [
      { label: 'Ответ', val: d.formattedResponse || '?' },
      { label: 'Решение', val: d.formattedResolve || '?' },
      { label: 'Уровень', val: d.responsiveness || '?' },
    ]
    case 'license': return [
      { label: 'Тип', val: d.type || '?' },
      { label: 'Форк', val: d.forking || '?' },
      { label: 'Смешив.', val: d.canMix ? 'Да' : 'Нет' },
    ]
    case 'forks': return [
      { label: 'Всего', val: d.totalForks || '?' },
      { label: 'Активных', val: d.activeForks || '?' },
      { label: 'РФ форки', val: d.russianForksCount || 0, class: d.russianForksCount > 0 ? 'green' : '' },
    ]
    case 'capitalization': return [
      { label: 'KSLOC', val: d.ksloc || '?' },
      { label: 'Стоимость (РФ)', val: d.costTraditional?.russiaFormatted || '?' },
      { label: 'С ИИ (чисто)', val: d.costWithAI?.cleanRewrite || '?' },
    ]
    case 'aiPresence': return [
      { label: 'AI коммиты', val: `${d.aiCommitPercent || 0}%` },
      { label: 'AI PR-ы', val: `${d.aiPRPercent || 0}%` },
      { label: 'Уровень', val: d.aiLevel || '?' },
    ]
    case 'securityRisks': return [
      { label: 'Баллы', val: `${d.securityScore || 0}/100`, class: d.securityScore >= 70 ? 'green' : 'red' },
      { label: 'PR workflow', val: d.prBasedWorkflow ? 'Да' : 'Нет' },
      { label: 'xz-паттерн', val: d.suspiciousCount || 0, class: d.suspiciousCount > 0 ? 'red' : 'green' },
    ]
    case 'sustainability': return [
      { label: 'Выгорание', val: d.burnoutScore || 0, class: d.burnoutLevel === 'high' ? 'red' : 'green' },
      { label: 'Мейнтейнер', val: `${d.mainMaintainer || '?'}` },
    ]
    default: return []
  }
}

function droneDesc(key, drones) {
  const d = drones?.[key]
  if (!d) return ''
  switch (key) {
    case 'community': return `bus factor: ${d.busFactor || '?'}, контрибуторы: ${d.contributors || '?'}`
    case 'geography': return `${d.russianContributors || 0} российских, ${d.sanctionSourcePercent || 0}% санкц.`
    case 'corporate': return d.verdict || ''
    case 'activityTrend': return `${d.trend || '?'}, ${d.changePercent || 0}% изменение`
    case 'responseTime': return `Ответ: ${d.formattedResponse || '?'}, решение: ${d.formattedResolve || '?'}`
    case 'license': return d.sovereigntyNote || ''
    case 'forks': return d.verdict || ''
    case 'capitalization': return d.verdictRu || ''
    case 'aiPresence': return d.forkImplication || ''
    case 'securityRisks': return (d.risks || []).join('; ') || 'Рисков не обнаружено'
    case 'sustainability': return d.recommendation || ''
    default: return ''
  }
}

// ─── Build Cytoscape elements ────────────────────────────────────────────────

function buildElements(data) {
  const drones = data?.drones || {}
  const nodes = []
  const edges = []

  // Central repository node
  nodes.push({
    data: {
      id: 'repo',
      label: `${data.owner}/${data.repo}`,
      nodeType: 'repo',
      color: '#3b82f6',
      size: 70,
    }
  })

  // 11 drone nodes
  DRONE_DEFS.forEach(def => {
    const health = droneHealth(def.key, drones)
    nodes.push({
      data: {
        id: `drone_${def.key}`,
        label: def.label,
        nodeType: 'drone',
        droneKey: def.key,
        health,
        color: HEALTH_COLORS[health],
        size: 50,
      }
    })
    edges.push({
      data: {
        id: `e_repo_${def.key}`,
        source: 'repo',
        target: `drone_${def.key}`,
        label: 'сканирует',
      }
    })
  })

  // Epoch AI hub node
  nodes.push({
    data: {
      id: 'epoch_ai',
      label: 'Эпоха ИИ',
      nodeType: 'epoch_hub',
      color: '#a855f7',
      size: 55,
    }
  })
  edges.push({
    data: {
      id: 'e_repo_epoch',
      source: 'repo',
      target: 'epoch_ai',
      label: 'философская основа',
    }
  })

  // 9 epoch aspect nodes
  EPOCH_ASPECTS.forEach(a => {
    const color = a.canAI ? '#a78bfa' : '#7c3aed'
    nodes.push({
      data: {
        id: `epoch_${a.key}`,
        label: a.label,
        nodeType: 'epoch_aspect',
        canAI: a.canAI,
        forkValue: a.forkValue,
        color,
        size: 35,
      }
    })
    edges.push({
      data: {
        id: `e_epoch_${a.key}`,
        source: 'epoch_ai',
        target: `epoch_${a.key}`,
        label: a.canAI ? 'ИИ воспроизводит' : 'невоспроизводимо',
      }
    })
  })

  // Cross-drone relations
  const crossEdges = [
    ['drone_capitalization', 'epoch_ai', 'оценивает стоимость'],
    ['drone_aiPresence', 'epoch_ai', 'измеряет долю ИИ'],
    ['drone_corporate', 'drone_sustainability', 'влияет на'],
    ['drone_community', 'drone_forks', 'определяет'],
    ['drone_securityRisks', 'drone_sustainability', 'угрожает'],
    ['drone_activityTrend', 'drone_responseTime', 'коррелирует'],
    ['drone_geography', 'drone_corporate', 'контекст'],
  ]
  crossEdges.forEach(([src, tgt, label], i) => {
    edges.push({
      data: { id: `cross_${i}`, source: src, target: tgt, label }
    })
  })

  return [...nodes, ...edges]
}

// ─── Cytoscape init ──────────────────────────────────────────────────────────

function initCy(data) {
  if (cy) { cy.destroy(); cy = null }
  if (!cyContainer.value) return

  cy = cytoscape({
    container: cyContainer.value,
    elements: buildElements(data),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'label': 'data(label)',
          'font-size': 10,
          'color': '#e2e8f0',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'text-wrap': 'wrap',
          'text-max-width': 80,
          'width': 'data(size)',
          'height': 'data(size)',
          'shape': 'ellipse',
          'border-width': 2,
          'border-color': 'data(color)',
          'background-opacity': 0.85,
          'text-outline-width': 2,
          'text-outline-color': '#1e293b',
          'transition-property': 'background-color, border-color, width, height, opacity',
          'transition-duration': '0.2s',
        },
      },
      {
        selector: 'node[nodeType="repo"]',
        style: {
          'shape': 'round-rectangle',
          'font-size': 12,
          'font-weight': 'bold',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 120,
          'height': 45,
          'border-width': 3,
        },
      },
      {
        selector: 'node[nodeType="epoch_hub"]',
        style: {
          'shape': 'diamond',
          'font-size': 11,
          'font-weight': 'bold',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 70,
          'height': 70,
        },
      },
      {
        selector: 'node[nodeType="epoch_aspect"]',
        style: {
          'shape': 'round-rectangle',
          'width': 65,
          'height': 25,
          'font-size': 8,
          'text-valign': 'center',
          'text-halign': 'center',
          'text-margin-y': 0,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#ffffff',
          'background-opacity': 1,
        },
      },
      {
        selector: 'node.dimmed',
        style: { 'opacity': 0.15 },
      },
      {
        selector: 'node.highlighted',
        style: { 'opacity': 1, 'border-width': 3, 'border-color': '#ffffff' },
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#475569',
          'target-arrow-color': '#475569',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': 7,
          'color': '#64748b',
          'text-outline-width': 1.5,
          'text-outline-color': '#1e293b',
          'text-rotation': 'autorotate',
          'opacity': 0.6,
        },
      },
      {
        selector: 'edge.dimmed',
        style: { 'opacity': 0.05 },
      },
      {
        selector: 'edge.highlighted',
        style: { 'line-color': '#60a5fa', 'target-arrow-color': '#60a5fa', 'opacity': 1, 'width': 2.5 },
      },
    ],
    layout: getLayoutConfig('cola'),
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    minZoom: 0.3,
    maxZoom: 3,
  })

  // Node click → detail panel
  cy.on('tap', 'node', evt => {
    const d = evt.target.data()
    const data_drones = result.value?.drones || {}

    if (d.nodeType === 'drone') {
      selectedNode.value = {
        label: d.label,
        type: `Дрон: ${d.health === 'good' ? 'здоров' : d.health === 'warn' ? 'внимание' : 'риск'}`,
        color: d.color,
        metrics: droneMetrics(d.droneKey, data_drones),
        desc: droneDesc(d.droneKey, data_drones),
      }
    } else if (d.nodeType === 'epoch_aspect') {
      selectedNode.value = {
        label: d.label,
        type: `Эпоха ИИ: ${d.canAI ? 'ИИ воспроизводит' : 'невоспроизводимо'}`,
        color: d.color,
        metrics: [
          { label: 'ИИ может', val: d.canAI ? 'Да' : 'Нет', class: d.canAI ? 'green' : 'red' },
          { label: 'Ценность форка', val: d.forkValue },
        ],
        desc: '',
      }
    } else if (d.nodeType === 'epoch_hub') {
      selectedNode.value = {
        label: 'Эпоха ИИ: что оцениваем?',
        type: 'Философская рамка',
        color: d.color,
        metrics: [],
        desc: 'В эпоху ИИ Claude может переписать чистый код. Но не может воспроизвести adoption, сообщество, production-баги и security-аудиты.',
      }
    } else if (d.nodeType === 'repo') {
      const s = result.value?.summary
      selectedNode.value = {
        label: d.label,
        type: `Суверенность: ${s?.sovereigntyScore || 0}/100`,
        color: d.color,
        metrics: [
          { label: 'Балл', val: `${s?.sovereigntyScore || 0}/100` },
          { label: 'Вердикт', val: s?.verdict || '?' },
        ],
        desc: '',
      }
    }

    // Highlight connected, dim rest
    cy.elements().addClass('dimmed').removeClass('highlighted')
    const node = evt.target
    const connected = node.connectedEdges().connectedNodes().add(node).add(node.connectedEdges())
    connected.removeClass('dimmed').addClass('highlighted')
  })

  // Click background → clear
  cy.on('tap', evt => {
    if (evt.target === cy) clearSelection()
  })
}

function clearSelection() {
  selectedNode.value = null
  cy?.elements().removeClass('dimmed highlighted')
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

function getLayoutConfig(name) {
  switch (name) {
    case 'dagre':
      return { name: 'dagre', rankDir: 'TB', nodeSep: 40, rankSep: 60, padding: 20 }
    case 'fcose':
      return {
        name: 'fcose',
        quality: 'proof',
        randomize: true,
        animate: true,
        animationDuration: 600,
        nodeSeparation: 120,
        idealEdgeLength: 120,
        nodeRepulsion: 6000,
        padding: 20,
      }
    case 'cola':
    default:
      return {
        name: 'cola',
        animate: true,
        maxSimulationTime: 2000,
        nodeSpacing: 30,
        edgeLength: 140,
        padding: 20,
        randomize: false,
        avoidOverlap: true,
        convergenceThreshold: 0.01,
      }
  }
}

function applyLayout(name) {
  if (!cy) return
  currentLayout.value = name
  cy.layout(getLayoutConfig(name)).run()
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  setTimeout(() => { cy?.resize(); cy?.fit(undefined, 20) }, 100)
}

// ─── Scan API ────────────────────────────────────────────────────────────────

async function startScan() {
  if (!repoUrl.value) return
  scanning.value = true
  scanProgress.value = 10
  try {
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const resp = await fetch(`${apiUrl}/api/github/sovereignty-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: repoUrl.value })
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    result.value = await resp.json()
  } catch (err) {
    console.error('Scan failed:', err)
  } finally {
    scanning.value = false
    scanProgress.value = 100
  }
}

const verdictClass = computed(() => {
  const s = result.value?.summary?.sovereigntyScore || 0
  return s >= 75 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low'
})

// ─── Demo data ───────────────────────────────────────────────────────────────

function loadDemo() {
  result.value = {
    owner: 'torvalds', repo: 'linux',
    summary: {
      sovereigntyScore: 92,
      verdict: 'Высшая суверенность — образцовый open-source проект',
      keyRisks: ['Высокая зависимость от Linus Torvalds лично', 'Основные контрибуторы — из США и ЕС'],
      strengths: ['Bus factor > 100', 'GPL-2.0 — свободный форк', '26000+ активных форков', 'Ядро невоспроизводимо ИИ'],
    },
    drones: {
      community: { stars: 185000, busFactor: 120, busFactorRisk: 'healthy', top1Percent: 3, contributors: 22000 },
      geography: { geoDiversity: 50, russianPresence: true, russianContributors: 340, sanctionSourcePercent: 15 },
      corporate: { dominantCorporation: 'Intel', dominantPercent: 12, isCorporateProject: false, verdict: 'Независимый от корпораций' },
      activityTrend: { trend: 'growing', changePercent: 5, recentWeeklyAvg: 800, releasesPerYear: 6 },
      responseTime: { formattedResponse: '< 24ч', formattedResolve: '~2 нед', responsiveness: 'good' },
      license: { type: 'GPL-2.0', forking: 'free', canMix: false, sovereigntyNote: 'GPL гарантирует свободу форка' },
      forks: { totalForks: 56000, activeForks: 26000, russianForksCount: 85, verdict: 'Массовое форк-сообщество' },
      capitalization: { ksloc: 28000, costTraditional: { russiaFormatted: '$12B' }, costWithAI: { cleanRewrite: '$400M' }, forkCost: { effort: '500 чел-лет' }, verdictRu: 'Ядро = невоспроизводимый актив' },
      aiPresence: { aiCommitPercent: 0.5, aiPRPercent: 0.2, aiLevel: 'minimal', forkImplication: 'ИИ-код минимален, ценность максимальна' },
      securityRisks: { securityScore: 85, prBasedWorkflow: true, suspiciousCount: 0, risks: [] },
      sustainability: { burnoutScore: 15, burnoutLevel: 'low', mainMaintainer: 'Linus Torvalds', mainMaintainerPercent: 1, recommendation: 'Здоровая ротация мейнтейнеров' },
    }
  }
}

// ─── Watch result → init graph ───────────────────────────────────────────────

watch(result, async (val) => {
  if (val) {
    await nextTick()
    initCy(val)
  }
})

onUnmounted(() => { cy?.destroy() })
</script>

<style scoped>
.sov-panel { padding: 0; }
.sov-input-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.sov-input { flex: 1; }

/* Verdict */
.sov-verdict { display: flex; align-items: center; gap: 16px; padding: 14px 18px; border-radius: 10px; margin-bottom: 14px; }
.sov-verdict.score-high { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); }
.sov-verdict.score-mid { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); }
.sov-verdict.score-low { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); }
.sov-score { font-size: 2.2rem; font-weight: 900; }
.score-high .sov-score { color: #22c55e; }
.score-mid .sov-score { color: #f59e0b; }
.score-low .sov-score { color: #ef4444; }
.sov-score-of { font-size: 0.9rem; font-weight: 400; color: var(--p-text-muted-color); }
.sov-verdict-text { font-weight: 700; font-size: 0.85rem; }
.sov-repo { font-size: 0.78rem; color: var(--p-text-muted-color); margin-left: auto; }

/* Graph wrapper */
.sov-graph-wrapper {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}

.sov-graph-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid #1e293b;
  background: #1e293b;
}
.sov-graph-title {
  font-weight: 600;
  font-size: 13px;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sov-layout-btns { display: flex; gap: 2px; margin-left: 12px; }

.sov-graph-legend {
  display: flex;
  gap: 14px;
  padding: 6px 14px;
  font-size: 11px;
  color: #94a3b8;
  border-bottom: 1px solid #1e293b;
}
.sov-legend-item { display: flex; align-items: center; gap: 5px; }
.sov-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.sov-graph-canvas {
  width: 100%;
  height: 420px;
  background: #0f172a;
  transition: height 0.3s ease;
}
.sov-graph-canvas.fullscreen {
  height: 700px;
}

/* Selected node detail */
.sov-node-detail {
  border-top: 1px solid #1e293b;
  padding: 12px 14px;
  background: #1e293b;
  color: #e2e8f0;
}
.sov-node-detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sov-node-detail-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sov-node-detail-label { font-weight: 700; font-size: 14px; }
.sov-node-detail-type { font-size: 11px; color: #94a3b8; }
.sov-node-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}
.sov-metric {
  display: flex;
  flex-direction: column;
  background: #0f172a;
  padding: 6px 10px;
  border-radius: 6px;
  min-width: 70px;
}
.sov-metric-label { font-size: 10px; color: #64748b; }
.sov-metric-val { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.sov-metric.red .sov-metric-val { color: #ef4444; }
.sov-metric.green .sov-metric-val { color: #22c55e; }
.sov-node-desc { margin-top: 8px; font-size: 12px; color: #94a3b8; }

/* Risks & Strengths */
.sov-lists { display: flex; gap: 16px; flex-wrap: wrap; }
.sov-list { flex: 1; min-width: 200px; }
.sov-list-title { font-size: 0.72rem; font-weight: 700; color: var(--p-text-muted-color); margin-bottom: 4px; }
.sov-list-item { font-size: 0.78rem; padding: 2px 0; }
.sov-list-item.risk { color: #ef4444; }
.sov-list-item.risk::before { content: '\26A0 '; }
.sov-list-item.strength { color: #22c55e; }
.sov-list-item.strength::before { content: '\2713 '; }

/* Empty state */
.sov-empty { text-align: center; padding: 40px; color: var(--p-text-muted-color); font-size: 0.85rem; }
.sov-empty p { margin-bottom: 12px; }
</style>

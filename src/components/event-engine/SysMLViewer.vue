<template>
  <div class="sysml-viewer">
    <div class="sysml-toolbar">
      <h3>SysML диаграммы</h3>
      <Select v-model="currentModelId" :options="models" optionLabel="val" optionValue="id"
        placeholder="Выберите модель" class="sysml-model-select" filter />
      <Button icon="pi pi-refresh" size="small" severity="secondary" text @click="loadDiagram" :loading="loading" />
    </div>

    <TabView v-model:activeIndex="activeTab" @tab-change="onTabChange">
      <TabPanel header="BDD">
        <div class="sysml-diagram-container">
          <div ref="bddRef" class="sysml-mermaid" v-html="renderedBDD"></div>
          <div class="sysml-actions" v-if="diagrams.bdd">
            <Button icon="pi pi-copy" label="Mermaid-код" size="small" severity="secondary" @click="copyCode('bdd')" />
            <Button icon="pi pi-download" label="SVG" size="small" severity="secondary" @click="exportSVG('bdd')" />
            <span class="sysml-meta">{{ diagrams.bdd.metadata?.concepts || 0 }} концептов, {{ diagrams.bdd.metadata?.relations || 0 }} связей</span>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="IBD">
        <div class="sysml-diagram-container">
          <div ref="ibdRef" class="sysml-mermaid" v-html="renderedIBD"></div>
          <div class="sysml-actions" v-if="diagrams.ibd">
            <Button icon="pi pi-copy" label="Mermaid-код" size="small" severity="secondary" @click="copyCode('ibd')" />
            <Button icon="pi pi-download" label="SVG" size="small" severity="secondary" @click="exportSVG('ibd')" />
            <span class="sysml-meta">{{ diagrams.ibd.metadata?.individuals || 0 }} индивидов</span>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Activity">
        <div class="sysml-diagram-container">
          <div ref="activityRef" class="sysml-mermaid" v-html="renderedActivity"></div>
          <div class="sysml-actions" v-if="diagrams.activity">
            <Button icon="pi pi-copy" label="Mermaid-код" size="small" severity="secondary" @click="copyCode('activity')" />
            <Button icon="pi pi-download" label="SVG" size="small" severity="secondary" @click="exportSVG('activity')" />
            <span class="sysml-meta">{{ diagrams.activity.metadata?.events || 0 }} событий</span>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Requirements">
        <div class="sysml-diagram-container">
          <div ref="reqRef" class="sysml-mermaid" v-html="renderedReq"></div>
          <div class="sysml-actions" v-if="diagrams.requirements">
            <Button icon="pi pi-copy" label="Mermaid-код" size="small" severity="secondary" @click="copyCode('requirements')" />
            <Button icon="pi pi-download" label="SVG" size="small" severity="secondary" @click="exportSVG('requirements')" />
            <span class="sysml-meta">{{ diagrams.requirements.metadata?.requirements || 0 }} требований</span>
          </div>
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, inject } from 'vue'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import Select from 'primevue/select'

const api = inject('eventEngineApi')
const injectedModelId = inject('selectedModelId', ref(null))
const selectedApplicationId = inject('selectedApplicationId', ref(null))

const loading = ref(false)
const models = ref([])
const currentModelId = ref(injectedModelId.value)
const activeTab = ref(0)
const diagrams = ref({ bdd: null, ibd: null, activity: null, requirements: null })
const renderedBDD = ref('')
const renderedIBD = ref('')
const renderedActivity = ref('')
const renderedReq = ref('')
const bddRef = ref(null)
const ibdRef = ref(null)
const activityRef = ref(null)
const reqRef = ref(null)

let mermaid = null

const diagramTypes = ['bdd', 'ibd', 'activity', 'requirements']

async function loadMermaid() {
  if (window.mermaid) { mermaid = window.mermaid; return }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.async = true
    script.onload = () => {
      mermaid = window.mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('p-dark') ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', wrappingWidth: 200 },
        class: { useMaxWidth: false },
      })
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Mermaid'))
    document.head.appendChild(script)
  })
}

async function renderMermaid(code, containerId) {
  if (!mermaid || !code) return ''
  try {
    const id = `sysml-${containerId}-${Date.now()}`
    const { svg } = await mermaid.render(id, code)
    return svg
  } catch (e) {
    console.warn('Mermaid render error:', e)
    return `<pre class="mermaid-error">${code}</pre>`
  }
}

async function loadModels() {
  try {
    const resp = await api.get('/models')
    models.value = resp.data?.data || []
  } catch (e) { console.error('Failed to load models', e) }
}

async function loadDiagram() {
  if (!currentModelId.value) return
  loading.value = true
  const type = diagramTypes[activeTab.value]
  try {
    const resp = await api.get(`/models/${currentModelId.value}/diagrams/${type}`)
    diagrams.value[type] = resp.data?.data || null
    await renderCurrent()
  } catch (e) { console.error(`Failed to load ${type} diagram`, e) }
  loading.value = false
}

async function renderCurrent() {
  await loadMermaid()
  const type = diagramTypes[activeTab.value]
  const code = diagrams.value[type]?.mermaid
  if (!code) return
  const html = await renderMermaid(code, type)
  switch (type) {
    case 'bdd': renderedBDD.value = html; break
    case 'ibd': renderedIBD.value = html; break
    case 'activity': renderedActivity.value = html; break
    case 'requirements': renderedReq.value = html; break
  }
}

function onTabChange() { nextTick(() => loadDiagram()) }

function copyCode(type) {
  const code = diagrams.value[type]?.mermaid
  if (code) navigator.clipboard.writeText(code).catch(() => {})
}

function exportSVG(type) {
  const refs = { bdd: bddRef, ibd: ibdRef, activity: activityRef, requirements: reqRef }
  const el = refs[type]?.value
  if (!el) return
  const svg = el.querySelector('svg')
  if (!svg) return
  const svgData = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([svgData], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sysml-${type}-${currentModelId.value}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

watch(currentModelId, () => { if (currentModelId.value) loadDiagram() })
watch(selectedApplicationId, async () => {
  await loadModels()
  if (currentModelId.value && !models.value.find(m => String(m.id) === String(currentModelId.value))) {
    currentModelId.value = models.value[0]?.id || null
  }
  if (currentModelId.value) loadDiagram()
})

onMounted(async () => {
  await loadModels()
  if (currentModelId.value) loadDiagram()
})
</script>

<style scoped>
.sysml-viewer { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.sysml-toolbar { display: flex; align-items: center; gap: 8px; }
.sysml-toolbar h3 { margin: 0; white-space: nowrap; }
.sysml-model-select { width: 200px; }
.sysml-diagram-container { display: flex; flex-direction: column; gap: 8px; }
.sysml-mermaid { min-height: 300px; max-height: 70vh; background: var(--p-surface-card); border-radius: 8px; padding: 16px; overflow: auto; }
.sysml-mermaid :deep(svg) { min-width: 600px; height: auto; }
.sysml-mermaid :deep(.node rect), .sysml-mermaid :deep(.node polygon) { rx: 6; ry: 6; }
.sysml-mermaid :deep(.classLabel .label) { font-size: 14px !important; }
.sysml-mermaid :deep(.nodeLabel) { font-size: 13px !important; white-space: normal !important; max-width: 180px; word-wrap: break-word; }
.sysml-actions { display: flex; align-items: center; gap: 8px; }
.sysml-meta { margin-left: auto; font-size: 0.8rem; color: var(--p-text-muted-color); }
:deep(.mermaid-error) { color: var(--p-text-muted-color); font-size: 0.85rem; white-space: pre-wrap; }
</style>

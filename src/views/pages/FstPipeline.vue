<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useEventStore } from '@/stores/eventStore.js'
import { useToast } from 'primevue/usetoast'
import { buildPipelineStages, getPipelineSummary, detectBlockers } from '@/services/pipelineService.js'
import { getEventDef } from '@/config/eventRegistry.js'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import PipelineMetrics from '@/components/fst-pipeline/PipelineMetrics.vue'
import PipelineStage from '@/components/fst-pipeline/PipelineStage.vue'
import PipelineEventEmitter from '@/components/fst-pipeline/PipelineEventEmitter.vue'
import PipelineAIPanel from '@/components/fst-pipeline/PipelineAIPanel.vue'
import PipelineCrossLinks from '@/components/fst-pipeline/PipelineCrossLinks.vue'

const eventStore = useEventStore()
const toast      = useToast()

// ─── Активная сделка ─────────────────────────────────────────────────────────

// Сделки: demo-список + из projectStore
const DEMO_DEALS = [
  { id: 'ventureos-001', name: 'VentureOS',           inn: '7707123456', askMln: 120, trl: 7, sector: 'SaaS / FinTech', stage: 'Pre-A' },
  { id: 'agrobot-002',   name: 'АгроБот',             inn: '7704987654', askMln: 50,  trl: 5, sector: 'AgriTech', stage: 'Seed' },
  { id: 'medai-003',     name: 'MedAI Diagnostics',   inn: '7703654321', askMln: 200, trl: 6, sector: 'MedTech', stage: 'Pre-A' },
]

const deals    = ref(DEMO_DEALS)
const activeDealId = ref(DEMO_DEALS[0].id)

const activeDeal = computed(() => deals.value.find(d => d.id === activeDealId.value) || deals.value[0])

// ─── Стадии конвейера ─────────────────────────────────────────────────────────

const stages = computed(() => buildPipelineStages(activeDealId.value, eventStore))
const summary = computed(() => getPipelineSummary(stages.value))
const blockers = computed(() => detectBlockers(stages.value))

// ─── Активная стадия (выбранная) ─────────────────────────────────────────────

const activeStageId = ref(null)

const selectedStage = computed(() => {
  if (activeStageId.value) return stages.value.find(s => s.id === activeStageId.value) || null
  return stages.value.find(s => s.status === 'active') || stages.value[0] || null
})

// При смене сделки — сбрасываем выбранную стадию
watch(activeDealId, () => { activeStageId.value = null })

// ─── AI-панель ───────────────────────────────────────────────────────────────

const aiPanelVisible = ref(false)

// ─── Онтологическая панель (Integram concepts) ───────────────────────────────

const ontoPanelVisible = ref(false)

// ─── Уведомления о блокировщиках ─────────────────────────────────────────────

function showBlockerAlerts() {
  for (const b of blockers.value) {
    toast.add({
      severity: b.severity === 'error' ? 'error' : 'warn',
      summary: b.type === 'blocked' ? 'Блокировщик' : 'SLA предупреждение',
      detail: b.description,
      life: 7000,
    })
  }
}

// ─── Автоматическое оповещение при добавлении событий ────────────────────────

function automationHandler(evt) {
  toast.add({
    severity: 'info',
    summary: 'Автоматизация',
    detail: `Событие "${evt.label}" может активировать смежные сущности`,
    life: 5000,
    icon: 'pi pi-share-alt',
  })
}

// ─── Демо-данные: заполняем конвейер VentureOS ───────────────────────────────

function seedDemoEvents(dealId) {
  const timeline = eventStore.getTimeline('deal', dealId)
  if (timeline.length > 0) return   // уже есть события

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  // Напрямую пушим события с историческими ts (обход store для seeding)
  const SEED = [
    { type: 'PI_REGISTERED',         data: { actor: 'УТ', notes: 'Поступила ПИ от компании VentureOS' }, ts: now - 40 * day },
    { type: 'PI_COMPLIANCE_CHECK',    data: { actor: 'УТ', notes: 'Соответствует инвест-декларации НТИ' }, ts: now - 38 * day },
    { type: 'PI_ACCEPTED',            data: { actor: 'УТ', notes: 'Открыты работы, назначен РП Соколов А.В.' }, ts: now - 36 * day },
    { type: 'RP_ASSIGNED',            data: { actor: 'УТ', notes: 'РП уведомил Инициатора' }, ts: now - 35 * day },
    { type: 'NDA_SIGNED',             data: { actor: 'РП', notes: 'НДА подписано 04.02.2026' }, ts: now - 33 * day },
    { type: 'PRELIM_ANALYSIS_STARTED',data: { actor: 'РП', notes: 'Запрошены финмодель и бизнес-план' }, ts: now - 32 * day },
    { type: 'OUS_FORMED',             data: { actor: 'РП', notes: 'Заключение о целесообразности готово' }, ts: now - 20 * day },
    { type: 'PRELIM_ANALYSIS_DONE',   data: { actor: 'УТ', notes: 'Решение: переход к ПП-3' }, ts: now - 18 * day },
    { type: 'OUS_SIGNED',             data: { actor: 'УТ', notes: 'ОУС подписано, эксклюзивность 45 р.д.' }, ts: now - 15 * day },
    { type: 'IC1_CONVENED',           data: { actor: 'УТ', notes: 'ИК-1 назначен на 04.03.2026' }, ts: now - 7 * day },
  ]
  for (const e of SEED) {
    const def = getEventDef(e.type)
    const evt = {
      id: `demo_${e.type}_${Math.random().toString(36).slice(2, 8)}`,
      entityType: 'deal',
      entityId: dealId,
      type: e.type,
      label: def?.label || e.type,
      icon: def?.icon || null,
      color: def?.color || null,
      subject: def?.subject || null,
      data: e.data,
      meta: { seeded: true },
      ts: e.ts,
    }
    timeline.push(evt)
  }
}

onMounted(async () => {
  // Загружаем ленты для всех сущностей по ID сделки
  await Promise.all([
    eventStore.load('deal', activeDealId.value),
    eventStore.load('session', activeDealId.value),
    eventStore.load('company', activeDealId.value),
    eventStore.load('fund', activeDealId.value),
  ])

  // Заполняем демо-данными если лента пуста
  seedDemoEvents(activeDealId.value)

  // Включаем cross-entity автоматизацию
  eventStore.setAutomationEmitter(automationHandler)

  // Показываем предупреждения о блокировщиках
  if (blockers.value.length) {
    setTimeout(showBlockerAlerts, 1500)
  }
})

// При смене сделки перезагружаем данные
watch(activeDealId, async (newId) => {
  await Promise.all([
    eventStore.load('deal', newId),
    eventStore.load('session', newId),
  ])
})
</script>

<template>
  <FstPageLayout
    title="Регуляторный конвейер"
    subtitle="ПП-1 → ПП-6 · Регламент ФСТ НТИ · 23.03.2023"
    icon="pi pi-filter"
  >
    <template #actions>
      <!-- Выбор сделки -->
      <Select
        v-model="activeDealId"
        :options="deals"
        optionLabel="name"
        optionValue="id"
        placeholder="Выбрать сделку"
        style="min-width: 200px"
      />

      <!-- Блокировщики -->
      <Button
        v-if="blockers.length"
        :label="`${blockers.length} ${blockers.length === 1 ? 'блокировщик' : 'блокировщика'}`"
        icon="pi pi-exclamation-triangle"
        severity="danger"
        size="small"
        @click="showBlockerAlerts"
      />

      <!-- Онтология -->
      <Button
        label="Онтология"
        icon="pi pi-sitemap"
        severity="secondary"
        size="small"
        @click="ontoPanelVisible = true"
      />

      <!-- AI-анализ -->
      <Button
        label="AI-анализ"
        icon="pi pi-sparkles"
        size="small"
        @click="aiPanelVisible = true"
      />
    </template>

    <!-- ── Метрики (flush к краям) ── -->
    <PipelineMetrics :summary="summary" style="margin: -20px -20px 0" />

    <!-- ── Основной layout ── -->
    <div class="fp-layout">

      <!-- Левая колонка: стадии -->
      <div class="fp-stages-col">
        <div class="fp-stages-label">Подпроцессы регламента</div>
        <div class="fp-stages-list">
          <PipelineStage
            v-for="stage in stages"
            :key="stage.id"
            :stage="stage"
            :active="selectedStage?.id === stage.id"
            @select="id => { activeStageId = id }"
          />
        </div>
      </div>

      <!-- Правая колонка: эмиттер + связи -->
      <div class="fp-detail-col">
        <!-- Информация об активной стадии -->
        <div v-if="selectedStage" class="fp-stage-desc page-card">
          <div class="fp-desc-header">
            <i :class="selectedStage.icon" :style="{ color: selectedStage.color }" class="fp-desc-icon"></i>
            <div>
              <div class="fp-desc-title">{{ selectedStage.label }}: {{ selectedStage.name }}</div>
              <div class="fp-desc-subtitle">{{ selectedStage.description }}</div>
            </div>
          </div>
          <div class="fp-desc-meta">
            <Tag :value="selectedStage.reglamentRef" severity="secondary" />
            <Tag v-if="selectedStage.slaDays" :value="`SLA: ${selectedStage.slaDays} р.д.`" severity="secondary" />
            <span v-for="actor in selectedStage.actors" :key="actor" class="fp-actor-chip">{{ actor }}</span>
          </div>
        </div>

        <!-- Эмиттер событий -->
        <PipelineEventEmitter
          :dealId="activeDealId"
          :currentStage="selectedStage"
          @eventAdded="() => {}"
        />

        <!-- Кросс-сущностные связи -->
        <PipelineCrossLinks
          :dealId="activeDealId"
          :stages="stages"
        />
      </div>
    </div>

    <!-- ── AI-панель (Dialog) ── -->
    <Dialog
      v-model:visible="aiPanelVisible"
      header="AI-анализ регуляторного конвейера"
      modal
      :style="{ width: 'min(94vw, 820px)' }"
    >
      <PipelineAIPanel
        :stages="stages"
        :dealId="activeDealId"
        :dealData="activeDeal"
      />
    </Dialog>

    <!-- ── Онтологическая панель ── -->
    <Dialog
      v-model:visible="ontoPanelVisible"
      header="Онтология событий ФСТ НТИ (Integram #70910)"
      modal
      :style="{ width: 'min(94vw, 700px)' }"
    >
      <div class="fp-onto">
        <div class="fp-onto-intro">
          37 концептов типа 2416 (СОД Концепты) в базе Integram FST.
          Суперкласс: <strong>Регламентное событие ФСТ НТИ</strong> (ID 70910).
          Каждый концепт имеет prefLabel_en, определение и ссылку на пункт регламента.
        </div>

        <div class="fp-onto-grid">
          <div
            v-for="stage in stages"
            :key="stage.id"
            class="fp-onto-group"
          >
            <div class="fp-onto-group-header" :style="{ borderLeftColor: stage.color }">
              {{ stage.label }}: {{ stage.name }}
            </div>
            <div v-for="evtType in stage.allEventTypes" :key="evtType" class="fp-onto-concept">
              <code class="fp-onto-code">{{ evtType }}</code>
              <span class="fp-onto-ref">{{ stage.reglamentRef }}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </FstPageLayout>
</template>

<style scoped>
/* ── Layout ── */
.fp-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  padding-top: 16px;
  align-items: start;
}

@media (max-width: 1100px) {
  .fp-layout {
    grid-template-columns: 1fr;
  }
}

/* ── Левая колонка ── */
.fp-stages-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fp-stages-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
}

.fp-stages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Правая колонка ── */
.fp-detail-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 16px;
}

/* ── Карточка описания стадии ── */
.page-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 16px;
}

.fp-stage-desc {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fp-desc-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.fp-desc-icon {
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.fp-desc-title {
  font-size: 13px;
  font-weight: 600;
}

.fp-desc-subtitle {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 3px;
  line-height: 1.4;
}

.fp-desc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.fp-actor-chip {
  font-size: 10px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
}

/* ── Онтология ── */
.fp-onto {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fp-onto-intro {
  font-size: 13px;
  line-height: 1.5;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  border-radius: 8px;
  padding: 10px 12px;
}

.fp-onto-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.fp-onto-group {
  border-left: 3px solid var(--p-content-border-color);
  padding-left: 12px;
}

.fp-onto-group-header {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  border-left: 3px solid var(--fst-blue);
  padding-left: 8px;
  margin-left: -12px;
}

.fp-onto-concept {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
}

.fp-onto-code {
  font-family: monospace;
  font-size: 11px;
  background: var(--p-surface-ground);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--fst-purple);
}

.fp-onto-ref {
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>

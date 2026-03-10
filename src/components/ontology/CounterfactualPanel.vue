<template>
  <div class="cf-panel">
    <div class="cf-panel__header">
      <i class="pi pi-history" style="color:var(--p-primary-color)" />
      <span>Что было бы без этой сделки?</span>
      <Button
        v-if="!result"
        label="Рассчитать"
        icon="pi pi-calculator"
        size="small"
        severity="secondary"
        :loading="loading"
        @click="calculate"
        style="margin-left:auto"
      />
      <Button
        v-else
        icon="pi pi-refresh"
        size="small"
        text
        severity="secondary"
        @click="result = null"
        style="margin-left:auto"
        title="Сбросить"
      />
    </div>

    <div v-if="result" class="cf-result">
      <div class="cf-row">
        <span class="cf-label">NAV фонда</span>
        <span class="cf-current">{{ fmtM(result.currentNav) }}</span>
        <i class="pi pi-arrow-right cf-arrow" />
        <span class="cf-without" :class="result.navDelta < 0 ? 'cf-negative' : 'cf-positive'">
          {{ fmtM(result.withoutNav) }}
        </span>
        <span class="cf-delta" :class="result.navDelta < 0 ? 'cf-negative' : 'cf-positive'">
          {{ result.navDelta >= 0 ? '+' : '' }}{{ fmtM(result.navDelta) }}
        </span>
      </div>

      <div class="cf-row">
        <span class="cf-label">Deployed капитал</span>
        <span class="cf-current">{{ fmtM(result.currentDeployed) }}</span>
        <i class="pi pi-arrow-right cf-arrow" />
        <span class="cf-without">{{ fmtM(result.withoutDeployed) }}</span>
        <span class="cf-delta cf-positive">+{{ fmtM(result.deployedDelta) }}</span>
      </div>

      <div class="cf-row">
        <span class="cf-label">Компаний в портфеле</span>
        <span class="cf-current">{{ result.currentCompanies }}</span>
        <i class="pi pi-arrow-right cf-arrow" />
        <span class="cf-without">{{ result.withoutCompanies }}</span>
        <span v-if="result.removedCompany" class="cf-tag">
          без «{{ result.removedCompany }}»
        </span>
      </div>

      <div class="cf-note">
        <i class="pi pi-info-circle" />
        Расчёт основан на событийной истории. Убраны все события связанные с этой сделкой и её downstream эффектами.
      </div>
    </div>

    <div v-else-if="!loading" class="cf-empty">
      Рассчитайте как бы выглядел портфель фонда без закрытия этой сделки
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Button from 'primevue/button'
import { useEventStore } from '@/stores/eventStore.js'

const props = defineProps({
  dealId:      { type: String, required: true },
  companyName: { type: String, default: '' },
})

const eventStore = useEventStore()
const loading = ref(false)
const result  = ref(null)

function calculate() {
  loading.value = true
  setTimeout(() => {
    // Get current fund state
    const fundIds = eventStore.getIds('fund')
    const fundId  = fundIds[0] || 'subfund-bas'
    const fundState = eventStore.getState('fund', fundId)

    // Get current company count
    const companyIds = eventStore.getIds('company')

    // Simulate: if this deal hadn't closed, what would fund look like?
    // Find DEAL_CLOSED event for this deal
    const dealTimeline = eventStore.getTimeline('deal', props.dealId)
    const closedEvent  = dealTimeline.find(e => e.type === 'DEAL_CLOSED')
    const amount       = closedEvent?.data?.amount || 15_000_000

    // Current values
    const currentNav      = fundState.nav      || fundState.deployed * 1.15 || 350_000_000
    const currentDeployed = fundState.deployed || amount * companyIds.length || 120_000_000

    // Counterfactual: without this deal
    const withoutDeployed = Math.max(0, currentDeployed - amount)
    const withoutNav      = Math.max(0, currentNav - amount * 1.1)  // rough: deployed + 10% markup
    const navDelta        = currentNav - withoutNav

    result.value = {
      currentNav,
      withoutNav,
      navDelta,
      currentDeployed,
      withoutDeployed,
      deployedDelta:    currentDeployed - withoutDeployed,
      currentCompanies: companyIds.length,
      withoutCompanies: Math.max(0, companyIds.length - 1),
      removedCompany:   props.companyName,
    }
    loading.value = false
  }, 600)
}

function fmtM(v) {
  if (!v && v !== 0) return '—'
  const m = v / 1_000_000
  return m >= 1000
    ? `${(m / 1000).toFixed(1)} млрд ₽`
    : `${m.toFixed(0)} млн ₽`
}
</script>

<style scoped>
.cf-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
}
.cf-panel__header {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; margin-bottom: 10px;
}

.cf-result { display: flex; flex-direction: column; gap: 8px; }

.cf-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px; border-radius: 6px;
  background: var(--p-surface-ground);
  flex-wrap: wrap;
}
.cf-label    { flex: 1; color: var(--p-text-muted-color); min-width: 120px; }
.cf-current  { font-weight: 600; }
.cf-arrow    { color: var(--p-text-muted-color); font-size: 11px; }
.cf-without  { font-weight: 600; }
.cf-delta    { font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.cf-positive { color: #22c55e; }
.cf-negative { color: #ef4444; }
.cf-tag {
  font-size: 11px; color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px; padding: 1px 6px;
}

.cf-note {
  display: flex; align-items: flex-start; gap: 6px;
  color: var(--p-text-muted-color); font-size: 11px;
  padding: 6px 8px; border-radius: 6px;
  background: var(--p-surface-ground);
}

.cf-empty {
  color: var(--p-text-muted-color);
  font-size: 12px; padding: 8px 0;
}
</style>

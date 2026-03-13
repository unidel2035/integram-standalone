<template>
  <FstPageLayout
    title="Биллинг и подписка"
    subtitle="Управление тарифом, баланс токенов, расход AI"
  >
    <template #header>
      <div class="bill-title-group">
        <i class="pi pi-credit-card" style="font-size:16px;color:var(--fst-purple)"></i>
        <span class="bill-title">Биллинг · <b>{{ currentPlanName }}</b></span>
        <Tag v-if="subscription" :value="subscription.status === 'active' ? 'Активна' : subscription.status" :severity="subscription.status === 'active' ? 'success' : 'warn'" />
      </div>
    </template>

    <template #actions>
      <Button icon="pi pi-plus" label="Пополнить" size="small" severity="success" @click="showDeposit = true" />
      <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="loadAll" :loading="loading" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="bill-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-database fst-metric-item-icon"></i>
        <div class="fst-metric-item-val" :style="{ color: balanceColor }">{{ balanceDisplay }}</div>
        <div class="fst-metric-item-label">Баланс токенов</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-box fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ currentPlanName }}</div>
        <div class="fst-metric-item-label">Тариф</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-bolt fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ quotaDisplay }}</div>
        <div class="fst-metric-item-label">AI-вызовов</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-wallet fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ costDisplay }}</div>
        <div class="fst-metric-item-label">Расход ₽</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-bar fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ usageStats?.totalCalls || 0 }}</div>
        <div class="fst-metric-item-label">Всего вызовов</div>
      </div>
    </div>

    <!-- ─── Tabs ─── -->
    <div class="bill-tabs">
      <SelectButton v-model="activeTab" :options="tabs" optionLabel="label" optionValue="id" :allowEmpty="false" />
    </div>

    <!-- ─── Tab: Баланс ─── -->
    <div v-if="activeTab === 'balance'" class="bill-content">
      <div class="bill-section">
        <div class="bill-balance-header">
          <div class="bill-balance-big">
            <span class="bill-balance-number">{{ balanceDisplay }}</span>
            <span class="bill-balance-unit">токенов</span>
          </div>
          <div v-if="balance" class="bill-balance-info">
            <span>Приветственный бонус: {{ (balance.welcomeBonus || 0).toLocaleString('ru') }}</span>
            <span v-if="balance.updatedAt"> · Обновлено: {{ formatDate(balance.updatedAt) }}</span>
          </div>
        </div>
      </div>
      <div class="bill-section">
        <div class="bill-section-title">История транзакций</div>
        <DataTable :value="transactions" size="small" stripedRows paginator :rows="20" emptyMessage="Нет транзакций">
          <Column field="ts" header="Дата" style="width:150px">
            <template #body="{ data }">{{ formatDate(data.ts) }}</template>
          </Column>
          <Column header="Тип" style="width:130px">
            <template #body="{ data }">
              <Tag :value="txTypeLabel(data.type)" :severity="txTypeSeverity(data.type)" />
            </template>
          </Column>
          <Column header="Сумма" style="width:120px">
            <template #body="{ data }">
              <span :style="{ color: data.amount >= 0 ? 'var(--fst-green)' : 'var(--fst-red)', fontWeight: 600 }">
                {{ data.amount >= 0 ? '+' : '' }}{{ data.amount.toLocaleString('ru') }}
              </span>
            </template>
          </Column>
          <Column header="Остаток" style="width:120px">
            <template #body="{ data }">{{ data.balanceAfter.toLocaleString('ru') }}</template>
          </Column>
          <Column field="description" header="Описание" />
        </DataTable>
      </div>
    </div>

    <!-- ─── Tab: Тариф ─── -->
    <div v-if="activeTab === 'plans'" class="bill-content">
      <div class="bill-plans-grid">
        <div v-for="plan in plans" :key="plan.code"
          class="bill-plan-card"
          :class="{ active: subscription?.planCode === plan.code }"
        >
          <div class="bill-plan-badge" v-if="plan.code === 'pro'">Популярный</div>
          <div class="bill-plan-name">{{ plan.name }}</div>
          <div class="bill-plan-price">
            <span class="bill-plan-amount">{{ plan.price === 0 ? 'Бесплатно' : `₽${plan.price.toLocaleString('ru')}` }}</span>
            <span v-if="plan.price > 0" class="bill-plan-period">/ мес</span>
          </div>
          <div class="bill-plan-limit">
            <i class="pi pi-bolt" style="font-size:12px"></i>
            {{ plan.aiCallsLimit === -1 ? 'Безлимитные' : plan.aiCallsLimit }} AI-вызовов/мес
          </div>
          <div class="bill-plan-features">{{ plan.features }}</div>
          <div class="bill-plan-models">
            <span class="bill-plan-models-label">Модели:</span> {{ plan.models === 'all' ? 'Все' : plan.models }}
          </div>
          <Button
            v-if="subscription?.planCode !== plan.code"
            :label="subscription?.planCode && planRank(plan.code) > planRank(subscription.planCode) ? 'Повысить' : 'Выбрать'"
            :severity="plan.code === 'pro' ? 'success' : 'secondary'"
            class="bill-plan-btn"
            @click="changePlan(plan.code)"
            :loading="subscribing"
          />
          <Button
            v-else
            label="Текущий тариф"
            severity="secondary"
            class="bill-plan-btn"
            disabled
          />
        </div>
      </div>
    </div>

    <!-- ─── Tab: Использование ─── -->
    <div v-if="activeTab === 'usage'" class="bill-content">
      <div class="bill-section">
        <div class="bill-section-title">Использование по моделям</div>
        <DataTable :value="modelRows" size="small" stripedRows>
          <Column field="model" header="Модель" />
          <Column field="calls" header="Вызовов" style="width:120px" />
          <Column header="Стоимость ₽" style="width:140px">
            <template #body="{ data }">{{ data.cost.toFixed(2) }}</template>
          </Column>
        </DataTable>
      </div>
      <div class="bill-section">
        <div class="bill-section-title">Использование по модулям</div>
        <DataTable :value="appRows" size="small" stripedRows>
          <Column field="app" header="Модуль" />
          <Column field="calls" header="Вызовов" style="width:120px" />
          <Column header="Стоимость ₽" style="width:140px">
            <template #body="{ data }">{{ data.cost.toFixed(2) }}</template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- ─── Tab: История ─── -->
    <div v-if="activeTab === 'history'" class="bill-content">
      <div class="bill-section">
        <div class="bill-section-title">Последние AI-вызовы</div>
        <DataTable :value="history" size="small" stripedRows paginator :rows="20">
          <Column field="timestamp" header="Дата" style="width:170px">
            <template #body="{ data }">{{ formatDate(data.timestamp) }}</template>
          </Column>
          <Column field="modelId" header="Модель" />
          <Column field="application" header="Модуль" style="width:150px" />
          <Column field="promptTokens" header="In" style="width:80px" />
          <Column field="completionTokens" header="Out" style="width:80px" />
          <Column header="₽" style="width:90px">
            <template #body="{ data }">{{ data.costRub.toFixed(4) }}</template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- ─── Deposit Dialog ─── -->
    <Dialog v-model:visible="showDeposit" header="Пополнить баланс токенов" modal style="width:420px;max-width:95vw">
      <div class="bill-deposit-form">
        <div class="bill-deposit-field">
          <label class="bill-deposit-label">User ID</label>
          <InputText v-model="depositUserId" fluid />
        </div>
        <div class="bill-deposit-field">
          <label class="bill-deposit-label">Количество токенов</label>
          <InputNumber v-model="depositAmount" :min="1" :showButtons="false" fluid />
        </div>
        <div class="bill-deposit-field">
          <label class="bill-deposit-label">Описание</label>
          <InputText v-model="depositDescription" placeholder="Причина пополнения" fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" @click="showDeposit = false" />
        <Button label="Пополнить" severity="success" icon="pi pi-plus" @click="doDeposit" :loading="depositing" />
      </template>
    </Dialog>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import {
  fetchPlans, fetchSubscription, fetchUsageStats, fetchUsageHistory,
  subscribe, fetchQuota, fetchBalance, fetchTransactions, depositTokens,
} from '@/services/billingService'

const userId = ref(localStorage.getItem('userId') || 'anonymous')
const loading = ref(false)
const subscribing = ref(false)
const activeTab = ref('balance')

const tabs = [
  { label: 'Баланс', id: 'balance' },
  { label: 'Тариф', id: 'plans' },
  { label: 'Использование', id: 'usage' },
  { label: 'История', id: 'history' },
]

const plans = ref([])
const subscription = ref(null)
const usageStats = ref(null)
const history = ref([])
const quota = ref(null)
const balance = ref(null)
const transactions = ref([])

// Deposit dialog
const showDeposit = ref(false)
const depositUserId = ref('')
const depositAmount = ref(100000)
const depositDescription = ref('')
const depositing = ref(false)

const currentPlanName = computed(() => {
  if (!subscription.value) return 'Бесплатный'
  const plan = plans.value.find(p => p.code === subscription.value.planCode)
  return plan?.name || subscription.value.planCode
})

const balanceDisplay = computed(() => {
  if (!balance.value) return '—'
  return balance.value.balance.toLocaleString('ru')
})

const balanceColor = computed(() => {
  if (!balance.value) return 'var(--p-text-color)'
  if (balance.value.balance <= 0) return 'var(--fst-red)'
  if (balance.value.balance < 10000) return 'var(--fst-brand)'
  return 'var(--fst-green)'
})

const quotaDisplay = computed(() => {
  if (!quota.value) return '—'
  if (quota.value.limit === -1) return `${quota.value.callsUsed} / ∞`
  return `${quota.value.callsUsed} / ${quota.value.limit}`
})

const costDisplay = computed(() => {
  const cost = subscription.value?.costRub || usageStats.value?.totalCost || 0
  return cost.toFixed(2)
})

const modelRows = computed(() => {
  if (!usageStats.value?.byModel) return []
  return Object.entries(usageStats.value.byModel).map(([model, v]) => ({ model, calls: v.calls, cost: v.cost }))
})

const appRows = computed(() => {
  if (!usageStats.value?.byApp) return []
  return Object.entries(usageStats.value.byApp).map(([app, v]) => ({ app, calls: v.calls, cost: v.cost }))
})

function planRank(code) {
  return { free: 0, pro: 1, enterprise: 2 }[code] ?? 0
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function txTypeLabel(type) {
  return { welcome_bonus: 'Бонус', deposit: 'Пополнение', deduction: 'Списание' }[type] || type
}

function txTypeSeverity(type) {
  return { welcome_bonus: 'info', deposit: 'success', deduction: 'secondary' }[type] || 'secondary'
}

async function loadAll() {
  loading.value = true
  try {
    const [p, s, u, h, q, b, t] = await Promise.all([
      fetchPlans(),
      fetchSubscription(userId.value),
      fetchUsageStats(userId.value),
      fetchUsageHistory(userId.value, 100),
      fetchQuota(userId.value),
      fetchBalance(userId.value),
      fetchTransactions(userId.value, 100),
    ])
    plans.value = p
    subscription.value = s
    usageStats.value = u
    history.value = h
    quota.value = q
    balance.value = b
    transactions.value = t
  } catch (err) {
    console.error('[Billing] load error:', err)
  } finally {
    loading.value = false
  }
}

async function changePlan(planCode) {
  subscribing.value = true
  try {
    await subscribe(userId.value, planCode)
    await loadAll()
  } catch (err) {
    console.error('[Billing] subscribe error:', err)
  } finally {
    subscribing.value = false
  }
}

async function doDeposit() {
  if (!depositUserId.value || !depositAmount.value) return
  depositing.value = true
  try {
    await depositTokens(depositUserId.value, depositAmount.value, depositDescription.value)
    showDeposit.value = false
    depositDescription.value = ''
    await loadAll()
  } catch (err) {
    console.error('[Billing] deposit error:', err)
  } finally {
    depositing.value = false
  }
}

onMounted(() => {
  depositUserId.value = userId.value
  loadAll()
})
</script>

<style scoped>
.bill-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bill-title {
  font-size: 14px;
  font-weight: 600;
}
.bill-metrics {
  margin: -20px -20px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.bill-tabs {
  padding: 16px 0 0;
}
.bill-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
.bill-section {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 20px;
}
.bill-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 14px;
}

/* ─── Balance ─── */
.bill-balance-header {
  text-align: center;
  padding: 20px 0;
}
.bill-balance-big {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}
.bill-balance-number {
  font-size: 42px;
  font-weight: 800;
  color: var(--fst-green);
}
.bill-balance-unit {
  font-size: 16px;
  color: var(--p-text-muted-color);
}
.bill-balance-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* ─── Plan cards ─── */
.bill-plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.bill-plan-card {
  position: relative;
  background: var(--p-surface-card);
  border: 2px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s;
}
.bill-plan-card.active {
  border-color: var(--fst-green);
}
.bill-plan-card:hover {
  border-color: var(--fst-purple);
}
.bill-plan-badge {
  position: absolute;
  top: -10px;
  right: 16px;
  background: var(--fst-purple);
  color: white;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 10px;
  border-radius: 8px;
}
.bill-plan-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--p-text-color);
}
.bill-plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.bill-plan-amount {
  font-size: 28px;
  font-weight: 800;
  color: var(--p-text-color);
}
.bill-plan-period {
  font-size: 13px;
  color: var(--p-text-muted-color);
}
.bill-plan-limit {
  font-size: 13px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 6px;
}
.bill-plan-features {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}
.bill-plan-models {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.bill-plan-models-label {
  font-weight: 600;
  color: var(--p-text-color);
}
.bill-plan-btn {
  margin-top: auto;
  width: 100%;
}

/* ─── Deposit dialog ─── */
.bill-deposit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bill-deposit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bill-deposit-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color);
}
</style>

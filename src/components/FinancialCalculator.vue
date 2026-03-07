<script setup>
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Card from 'primevue/card'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  termId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:visible'])

const calculatorType = ref('irr')
const calculatorTypes = ref([
  { label: 'IRR', value: 'irr' },
  { label: 'MOIC', value: 'moic' },
  { label: 'DPI', value: 'dpi' },
  { label: 'LTV/CAC', value: 'ltv-cac' }
])

// IRR Calculator inputs
const initialInvestment = ref(10000000)
const finalValue = ref(50000000)
const years = ref(5)

// MOIC Calculator inputs
const invested = ref(5000000)
const currentValue = ref(15000000)

// DPI Calculator inputs
const distributions = ref(8000000)
const paidInCapital = ref(10000000)

// LTV/CAC Calculator inputs
const arpu = ref(5000)
const grossMargin = ref(80)
const churnRate = ref(10)
const cac = ref(10000)

const irrResult = computed(() => {
  if (!initialInvestment.value || !finalValue.value || !years.value || years.value <= 0) return null
  const ratio = finalValue.value / initialInvestment.value
  const irr = (Math.pow(ratio, 1 / years.value) - 1) * 100
  return irr.toFixed(2)
})

const moicResult = computed(() => {
  if (!invested.value) return null
  return (currentValue.value / invested.value).toFixed(2)
})

const dpiResult = computed(() => {
  if (!paidInCapital.value) return null
  return (distributions.value / paidInCapital.value).toFixed(2)
})

const ltvResult = computed(() => {
  if (!churnRate.value || churnRate.value <= 0) return null
  const ltv = (arpu.value * (grossMargin.value / 100)) / (churnRate.value / 100)
  return ltv.toFixed(0)
})

const ltvCacRatio = computed(() => {
  if (!ltvResult.value || !cac.value) return null
  return (ltvResult.value / cac.value).toFixed(2)
})

const ltvCacHealth = computed(() => {
  const ratio = parseFloat(ltvCacRatio.value)
  if (!ratio) return ''
  if (ratio >= 3) return '✅ Отличные unit economics'
  if (ratio >= 1.5) return '⚠️ Приемлемые показатели'
  return '❌ Плохие unit economics'
})

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="💹 Интерактивный финансовый калькулятор"
    :modal="true"
    :closable="true"
    :dismissableMask="true"
    :style="{ width: '50rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    @update:visible="handleClose"
  >
    <div class="calculator-container">
      <!-- Calculator Type Selector -->
      <div class="mb-4">
        <label class="block mb-2 font-semibold">Выберите метрику:</label>
        <SelectButton v-model="calculatorType" :options="calculatorTypes" optionLabel="label" optionValue="value" />
      </div>

      <!-- IRR Calculator -->
      <Card v-if="calculatorType === 'irr'" class="calculator-card">
        <template #title>
          <div class="calculator-title">
            <i class="pi pi-chart-line"></i>
            <span>Калькулятор IRR</span>
          </div>
        </template>
        <template #content>
          <div class="input-grid">
            <div class="input-field">
              <label>Инвестиция (₽):</label>
              <InputNumber v-model="initialInvestment" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
            <div class="input-field">
              <label>Финальная стоимость (₽):</label>
              <InputNumber v-model="finalValue" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
            <div class="input-field">
              <label>Срок (лет):</label>
              <InputNumber v-model="years" :min="1" :max="30" />
            </div>
          </div>
          <div v-if="irrResult" class="result-box">
            <div class="result-label">Внутренняя норма доходности:</div>
            <div class="result-value">{{ irrResult }}% годовых</div>
            <div class="result-description">
              {{ irrResult >= 25 ? '✅ Отличный результат для венчурного фонда!' : irrResult >= 15 ? '⚠️ Хороший результат' : '❌ Ниже ожиданий для венчура' }}
            </div>
          </div>
        </template>
      </Card>

      <!-- MOIC Calculator -->
      <Card v-if="calculatorType === 'moic'" class="calculator-card">
        <template #title>
          <div class="calculator-title">
            <i class="pi pi-arrow-up-right"></i>
            <span>Калькулятор MOIC</span>
          </div>
        </template>
        <template #content>
          <div class="input-grid">
            <div class="input-field">
              <label>Инвестировано (₽):</label>
              <InputNumber v-model="invested" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
            <div class="input-field">
              <label>Текущая стоимость (₽):</label>
              <InputNumber v-model="currentValue" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
          </div>
          <div v-if="moicResult" class="result-box">
            <div class="result-label">Множитель инвестиций:</div>
            <div class="result-value">{{ moicResult }}x</div>
            <div class="result-description">
              {{ moicResult >= 3 ? '✅ Отличная доходность!' : moicResult >= 1.5 ? '⚠️ Умеренная доходность' : '❌ Капитал не вырос достаточно' }}
            </div>
          </div>
        </template>
      </Card>

      <!-- DPI Calculator -->
      <Card v-if="calculatorType === 'dpi'" class="calculator-card">
        <template #title>
          <div class="calculator-title">
            <i class="pi pi-wallet"></i>
            <span>Калькулятор DPI</span>
          </div>
        </template>
        <template #content>
          <div class="input-grid">
            <div class="input-field">
              <label>Распределения LP (₽):</label>
              <InputNumber v-model="distributions" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
            <div class="input-field">
              <label>Внесённый капитал (₽):</label>
              <InputNumber v-model="paidInCapital" :min="0" mode="currency" currency="RUB" locale="ru-RU" />
            </div>
          </div>
          <div v-if="dpiResult" class="result-box">
            <div class="result-label">Реализованная стоимость:</div>
            <div class="result-value">{{ dpiResult }}x</div>
            <div class="result-description">
              {{ dpiResult >= 1.0 ? '✅ LP уже вернули капитал!' : `⏳ Возвращено ${(dpiResult * 100).toFixed(0)}% капитала` }}
            </div>
          </div>
        </template>
      </Card>

      <!-- LTV/CAC Calculator -->
      <Card v-if="calculatorType === 'ltv-cac'" class="calculator-card">
        <template #title>
          <div class="calculator-title">
            <i class="pi pi-users"></i>
            <span>Калькулятор LTV/CAC</span>
          </div>
        </template>
        <template #content>
          <div class="input-grid">
            <div class="input-field">
              <label>ARPU (₽/мес):</label>
              <InputNumber v-model="arpu" :min="0" />
            </div>
            <div class="input-field">
              <label>Gross Margin (%):</label>
              <InputNumber v-model="grossMargin" :min="0" :max="100" suffix="%" />
            </div>
            <div class="input-field">
              <label>Churn Rate (%/мес):</label>
              <InputNumber v-model="churnRate" :min="0.1" :max="100" suffix="%" />
            </div>
            <div class="input-field">
              <label>CAC (₽):</label>
              <InputNumber v-model="cac" :min="0" />
            </div>
          </div>
          <div v-if="ltvResult && ltvCacRatio" class="result-box">
            <div class="result-metrics">
              <div>
                <div class="result-label">LTV:</div>
                <div class="result-value">₽{{ Number(ltvResult).toLocaleString('ru-RU') }}</div>
              </div>
              <div>
                <div class="result-label">LTV/CAC Ratio:</div>
                <div class="result-value">{{ ltvCacRatio }}x</div>
              </div>
            </div>
            <div class="result-description">{{ ltvCacHealth }}</div>
          </div>
        </template>
      </Card>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm text-muted-color">
          <i class="pi pi-calculator mr-1"></i>
          Упрощённые формулы для демонстрации концепций
        </span>
        <Button label="Закрыть" icon="pi pi-times" @click="handleClose" text />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.calculator-container {
  min-height: 300px;
}

.calculator-card {
  margin-top: 1rem;
}

.calculator-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  color: var(--p-primary-color);
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.input-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.result-box {
  background: linear-gradient(135deg, var(--p-primary-50) 0%, var(--p-primary-100) 100%);
  border-left: 4px solid var(--p-primary-color);
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.result-label {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-bottom: 0.5rem;
}

.result-description {
  font-size: 1rem;
  color: var(--p-text-color);
  margin-top: 0.75rem;
  font-weight: 500;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
}

/* Dark mode adjustments */
:root.dark .result-box {
  background: linear-gradient(135deg, var(--p-surface-700) 0%, var(--p-surface-800) 100%);
}
</style>

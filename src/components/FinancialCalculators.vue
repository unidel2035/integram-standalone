<template>
  <div class="calculator-container">
    <!-- IRR Calculator -->
    <div v-if="termId === 'irr'" class="calculator">
      <h4>Калькулятор IRR</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Инвестиция (₽ млн)</label>
          <InputNumber v-model="irr.investment" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Возврат (₽ млн)</label>
          <InputNumber v-model="irr.returnAmount" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Период (лет)</label>
          <InputNumber v-model="irr.years" :min="1" :max="20" :step="1" />
        </div>
      </div>
      <div class="calc-result">
        <strong>IRR:</strong> {{ calculateIRR() }}% годовых
      </div>
    </div>

    <!-- MOIC Calculator -->
    <div v-if="termId === 'moic'" class="calculator">
      <h4>Калькулятор MOIC</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Инвестиция (₽ млн)</label>
          <InputNumber v-model="moic.investment" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Текущая стоимость (₽ млн)</label>
          <InputNumber v-model="moic.currentValue" :min="0" :step="1" />
        </div>
      </div>
      <div class="calc-result">
        <strong>MOIC:</strong> {{ calculateMOIC() }}x
      </div>
    </div>

    <!-- DPI Calculator -->
    <div v-if="termId === 'dpi'" class="calculator">
      <h4>Калькулятор DPI</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Внесённый капитал (₽ млн)</label>
          <InputNumber v-model="dpi.paidIn" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Распределения (₽ млн)</label>
          <InputNumber v-model="dpi.distributions" :min="0" :step="1" />
        </div>
      </div>
      <div class="calc-result">
        <strong>DPI:</strong> {{ calculateDPI() }}x
      </div>
    </div>

    <!-- TVPI Calculator -->
    <div v-if="termId === 'tvpi'" class="calculator">
      <h4>Калькулятор TVPI</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Внесённый капитал (₽ млн)</label>
          <InputNumber v-model="tvpi.paidIn" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Распределения (₽ млн)</label>
          <InputNumber v-model="tvpi.distributions" :min="0" :step="1" />
        </div>
        <div class="input-group">
          <label>Остаточная стоимость (₽ млн)</label>
          <InputNumber v-model="tvpi.residualValue" :min="0" :step="1" />
        </div>
      </div>
      <div class="calc-result">
        <strong>TVPI:</strong> {{ calculateTVPI() }}x
      </div>
    </div>

    <!-- Burn Rate & Runway Calculator -->
    <div v-if="termId === 'burn-rate' || termId === 'runway'" class="calculator">
      <h4>Калькулятор Burn Rate и Runway</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Месячные расходы (₽ млн)</label>
          <InputNumber v-model="runway.monthlyExpenses" :min="0" :step="0.1" />
        </div>
        <div class="input-group">
          <label>Месячный доход (₽ млн)</label>
          <InputNumber v-model="runway.monthlyRevenue" :min="0" :step="0.1" />
        </div>
        <div class="input-group">
          <label>Баланс (₽ млн)</label>
          <InputNumber v-model="runway.balance" :min="0" :step="1" />
        </div>
      </div>
      <div class="calc-result">
        <strong>Burn Rate:</strong> {{ calculateBurnRate() }} ₽млн/месяц<br>
        <strong>Runway:</strong> {{ calculateRunway() }} месяцев
      </div>
    </div>

    <!-- Unit Economics Calculator -->
    <div v-if="termId === 'unit-economics' || termId === 'ltv' || termId === 'cac'" class="calculator">
      <h4>Калькулятор Unit Economics</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>ARPU (₽/месяц)</label>
          <InputNumber v-model="unitEcon.arpu" :min="0" :step="100" />
        </div>
        <div class="input-group">
          <label>Gross Margin (%)</label>
          <InputNumber v-model="unitEcon.margin" :min="0" :max="100" :step="5" />
        </div>
        <div class="input-group">
          <label>Churn Rate (%/месяц)</label>
          <InputNumber v-model="unitEcon.churn" :min="0" :max="100" :step="1" />
        </div>
        <div class="input-group">
          <label>CAC (₽)</label>
          <InputNumber v-model="unitEcon.cac" :min="0" :step="1000" />
        </div>
      </div>
      <div class="calc-result">
        <strong>LTV:</strong> {{ calculateLTV() }} ₽<br>
        <strong>LTV/CAC:</strong> {{ calculateLTVCAC() }}x
        <span :class="getLTVCACClass()">{{ getLTVCACStatus() }}</span>
      </div>
    </div>

    <!-- Dilution Calculator -->
    <div v-if="termId === 'dilution'" class="calculator">
      <h4>Калькулятор разводнения</h4>
      <div class="calc-inputs">
        <div class="input-group">
          <label>Текущие акции</label>
          <InputNumber v-model="dilution.currentShares" :min="0" :step="1000" />
        </div>
        <div class="input-group">
          <label>Новые акции</label>
          <InputNumber v-model="dilution.newShares" :min="0" :step="1000" />
        </div>
        <div class="input-group">
          <label>Ваши акции</label>
          <InputNumber v-model="dilution.yourShares" :min="0" :step="100" />
        </div>
      </div>
      <div class="calc-result">
        <strong>Было:</strong> {{ calculateOldOwnership() }}%<br>
        <strong>Стало:</strong> {{ calculateNewOwnership() }}%<br>
        <strong>Разводнение:</strong> {{ calculateDilutionPercent() }}%
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import InputNumber from 'primevue/inputnumber'

const props = defineProps({
  termId: {
    type: String,
    required: true
  }
})

// IRR calculator state
const irr = ref({
  investment: 10,
  returnAmount: 50,
  years: 5
})

// MOIC calculator state
const moic = ref({
  investment: 10,
  currentValue: 30
})

// DPI calculator state
const dpi = ref({
  paidIn: 100,
  distributions: 80
})

// TVPI calculator state
const tvpi = ref({
  paidIn: 100,
  distributions: 80,
  residualValue: 120
})

// Runway calculator state
const runway = ref({
  monthlyExpenses: 5,
  monthlyRevenue: 2,
  balance: 50
})

// Unit Economics calculator state
const unitEcon = ref({
  arpu: 5000,
  margin: 70,
  churn: 5,
  cac: 10000
})

// Dilution calculator state
const dilution = ref({
  currentShares: 10000,
  newShares: 5000,
  yourShares: 6000
})

// Calculator functions
const calculateIRR = () => {
  if (irr.value.investment <= 0 || irr.value.years <= 0) return '0.0'
  const rate = Math.pow(irr.value.returnAmount / irr.value.investment, 1 / irr.value.years) - 1
  return (rate * 100).toFixed(1)
}

const calculateMOIC = () => {
  if (moic.value.investment <= 0) return '0.0'
  return (moic.value.currentValue / moic.value.investment).toFixed(1)
}

const calculateDPI = () => {
  if (dpi.value.paidIn <= 0) return '0.0'
  return (dpi.value.distributions / dpi.value.paidIn).toFixed(2)
}

const calculateTVPI = () => {
  if (tvpi.value.paidIn <= 0) return '0.0'
  return ((tvpi.value.distributions + tvpi.value.residualValue) / tvpi.value.paidIn).toFixed(2)
}

const calculateBurnRate = () => {
  const burn = runway.value.monthlyExpenses - runway.value.monthlyRevenue
  return burn > 0 ? burn.toFixed(1) : '0.0'
}

const calculateRunway = () => {
  const burn = runway.value.monthlyExpenses - runway.value.monthlyRevenue
  if (burn <= 0) return '∞'
  return Math.floor(runway.value.balance / burn)
}

const calculateLTV = () => {
  if (unitEcon.value.churn <= 0) return '∞'
  const ltv = (unitEcon.value.arpu * (unitEcon.value.margin / 100)) / (unitEcon.value.churn / 100)
  return Math.round(ltv).toLocaleString('ru-RU')
}

const calculateLTVCAC = () => {
  if (unitEcon.value.cac <= 0 || unitEcon.value.churn <= 0) return '0.0'
  const ltv = (unitEcon.value.arpu * (unitEcon.value.margin / 100)) / (unitEcon.value.churn / 100)
  return (ltv / unitEcon.value.cac).toFixed(1)
}

const getLTVCACClass = () => {
  const ratio = parseFloat(calculateLTVCAC())
  if (ratio >= 3) return 'status-good'
  if (ratio >= 1.5) return 'status-ok'
  return 'status-bad'
}

const getLTVCACStatus = () => {
  const ratio = parseFloat(calculateLTVCAC())
  if (ratio >= 3) return '✓ Отлично'
  if (ratio >= 1.5) return '⚠ Приемлемо'
  return '✗ Плохо'
}

const calculateOldOwnership = () => {
  if (dilution.value.currentShares <= 0) return '0.0'
  return ((dilution.value.yourShares / dilution.value.currentShares) * 100).toFixed(1)
}

const calculateNewOwnership = () => {
  const total = dilution.value.currentShares + dilution.value.newShares
  if (total <= 0) return '0.0'
  return ((dilution.value.yourShares / total) * 100).toFixed(1)
}

const calculateDilutionPercent = () => {
  const oldOwn = parseFloat(calculateOldOwnership())
  const newOwn = parseFloat(calculateNewOwnership())
  return (oldOwn - newOwn).toFixed(1)
}
</script>

<style scoped>
.calculator-container {
  margin-top: 1rem;
}

.calculator {
  background: linear-gradient(135deg, var(--p-primary-50) 0%, var(--p-blue-50) 100%);
  border: 2px solid var(--p-primary-200);
  border-radius: 8px;
  padding: 1.5rem;
}

.calculator h4 {
  margin: 0 0 1rem 0;
  color: var(--p-primary-color);
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.calculator h4::before {
  content: '🧮';
}

.calc-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.calc-result {
  background: var(--p-surface-0);
  border-left: 4px solid var(--p-primary-color);
  padding: 1rem;
  border-radius: 4px;
  font-size: 1.1rem;
  line-height: 1.8;
}

.calc-result strong {
  color: var(--p-primary-color);
}

.status-good {
  color: var(--p-green-600);
  font-weight: 600;
  margin-left: 0.5rem;
}

.status-ok {
  color: var(--p-orange-600);
  font-weight: 600;
  margin-left: 0.5rem;
}

.status-bad {
  color: var(--p-red-600);
  font-weight: 600;
  margin-left: 0.5rem;
}

/* Dark mode */
:root.dark .calculator {
  background: linear-gradient(135deg, var(--p-surface-700) 0%, var(--p-surface-600) 100%);
  border-color: var(--p-surface-500);
}

:root.dark .calc-result {
  background: var(--p-surface-800);
}
</style>

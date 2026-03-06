<template>
  <Dialog
    v-model:visible="isVisible"
    :header="$t('agentPurchase.title')"
    :style="{ width: '500px' }"
    :modal="true"
    @update:visible="handleClose"
  >
    <div v-if="agent" class="purchase-dialog-content">
      <!-- Agent Info -->
      <div class="agent-info">
        <div class="agent-header">
          <span class="agent-icon">{{ agent.icon || '🤖' }}</span>
          <div class="agent-details">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <p class="agent-creator">{{ $t('agentPurchase.by') }} {{ agent.creator }}</p>
          </div>
        </div>
        <p class="agent-description">{{ agent.description }}</p>
      </div>

      <!-- Pricing Info -->
      <div class="pricing-section">
        <div class="pricing-header">
          <h4>{{ $t('agentPurchase.pricingDetails') }}</h4>
        </div>

        <div class="pricing-card" :class="`pricing-${agent.pricingModel}`">
          <div class="pricing-model">
            <i :class="getPricingIcon(agent.pricingModel)" />
            <span class="model-label">{{ getPricingModelLabel(agent.pricingModel) }}</span>
          </div>

          <div class="price-display">
            <span v-if="agent.price === 0" class="price-free">{{ $t('agentPurchase.free') }}</span>
            <div v-else class="price-amount">
              <span class="currency">$</span>
              <span class="amount">{{ agent.price }}</span>
              <span v-if="agent.pricingModel === 'subscription'" class="period">/{{ $t('agentPurchase.month') }}</span>
            </div>
          </div>

          <!-- Features based on pricing model -->
          <div class="pricing-features">
            <div v-if="agent.pricingModel === 'free'" class="feature-item">
              <i class="pi pi-check-circle" />
              <span>{{ $t('agentPurchase.features.basicAccess') }}</span>
            </div>
            <div v-if="agent.pricingModel === 'one_time'" class="feature-item">
              <i class="pi pi-check-circle" />
              <span>{{ $t('agentPurchase.features.lifetimeAccess') }}</span>
            </div>
            <div v-if="agent.pricingModel === 'subscription'" class="feature-item">
              <i class="pi pi-check-circle" />
              <span>{{ $t('agentPurchase.features.monthlyUpdates') }}</span>
            </div>
            <div v-if="agent.pricingModel === 'subscription'" class="feature-item">
              <i class="pi pi-check-circle" />
              <span>{{ $t('agentPurchase.features.prioritySupport') }}</span>
            </div>
            <div v-if="agent.pricingModel === 'subscription'" class="feature-item">
              <i class="pi pi-check-circle" />
              <span>{{ $t('agentPurchase.features.cancelAnytime') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Balance Information (only for paid agents) -->
      <div v-if="agent.price > 0" class="balance-section">
        <h4>{{ $t('agentPurchase.balanceInfo') || 'Баланс' }}</h4>
        <div class="balance-card" :class="{ 'insufficient': !hasSufficientBalance }">
          <div class="balance-row">
            <span class="balance-label">{{ $t('agentPurchase.currentBalance') || 'Текущий баланс:' }}</span>
            <span class="balance-value">
              <i v-if="loadingBalance" class="pi pi-spin pi-spinner" />
              <template v-else>${{ userBalance.toFixed(2) }}</template>
            </span>
          </div>
          <div class="balance-row">
            <span class="balance-label">{{ $t('agentPurchase.required') || 'Требуется:' }}</span>
            <span class="balance-value">${{ agent.price.toFixed(2) }}</span>
          </div>
          <div v-if="!hasSufficientBalance" class="balance-warning">
            <i class="pi pi-exclamation-triangle" />
            <span>{{ $t('agentPurchase.insufficientFunds') || 'Недостаточно средств' }}</span>
          </div>
        </div>
      </div>

      <!-- Payment Method Selection (only for paid agents) -->
      <div v-if="agent.price > 0" class="payment-method-section">
        <h4>{{ $t('agentPurchase.paymentMethod') }}</h4>
        <div class="payment-methods">
          <div
            v-for="method in paymentMethods"
            :key="method.value"
            :class="['payment-method-option', { selected: selectedPaymentMethod === method.value }]"
            @click="selectedPaymentMethod = method.value"
          >
            <i :class="method.icon" />
            <span>{{ method.label }}</span>
          </div>
        </div>
      </div>

      <!-- Error/Success Messages -->
      <Message v-if="errorMessage" severity="error" :closable="false">
        {{ errorMessage }}
      </Message>
      <Message v-if="successMessage && !showSuccessActions" severity="success" :closable="false">
        {{ successMessage }}
      </Message>

      <!-- Success Actions (Issue #5028) -->
      <div v-if="showSuccessActions" class="success-actions-section">
        <div class="success-header">
          <i class="pi pi-check-circle success-icon" />
          <h3>{{ successMessage }}</h3>
          <p class="success-subtitle">{{ $t('agentPurchase.actions.whatNext') }}</p>
        </div>

        <div class="action-buttons">
          <Button
            v-if="agent && agent.path"
            :label="$t('agentPurchase.actions.openAgent')"
            icon="pi pi-external-link"
            @click="handleOpenAgent"
            class="p-button-lg p-button-success"
          />
          <Button
            :label="$t('agentPurchase.actions.goToMyAgents')"
            icon="pi pi-list"
            @click="handleGoToMyAgents"
            class="p-button-lg"
          />
          <Button
            :label="$t('agentPurchase.actions.continueShopping')"
            icon="pi pi-shopping-bag"
            @click="handleContinueShopping"
            class="p-button-lg p-button-outlined"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="!showSuccessActions">
        <Button
          :label="$t('common.cancel')"
          icon="pi pi-times"
          @click="handleClose"
          class="p-button-text"
          :disabled="processing"
        />
        <Button
          v-if="agent && agent.price === 0"
          :label="$t('agentPurchase.activate')"
          icon="pi pi-check"
          @click="handleActivate"
          :loading="processing"
        />
        <Button
          v-else-if="agent && agent.pricingModel === 'one_time'"
          :label="$t('agentPurchase.buyNow')"
          icon="pi pi-shopping-cart"
          @click="handlePurchase"
          :loading="processing"
          :disabled="!selectedPaymentMethod || !hasSufficientBalance || loadingBalance"
        />
        <Button
          v-else-if="agent && agent.pricingModel === 'subscription'"
          :label="$t('agentPurchase.subscribe')"
          icon="pi pi-calendar"
          @click="handleSubscribe"
          :loading="processing"
          :disabled="!selectedPaymentMethod || !hasSufficientBalance || loadingBalance"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useRouter } from 'vue-router'
import { purchaseAgent, subscribeToAgent, activateFreeAgent } from '@/services/paymentService'
import { getUserBalance } from '@/services/tokenService'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  agent: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'purchase-complete'])

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const processing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const selectedPaymentMethod = ref('card')
const showSuccessActions = ref(false)
const purchaseType = ref('')
const userBalance = ref(0)
const loadingBalance = ref(false)

const paymentMethods = computed(() => [
  { value: 'card', label: t('agentPurchase.methods.card'), icon: 'pi pi-credit-card' },
  { value: 'yookassa', label: t('agentPurchase.methods.yookassa'), icon: 'pi pi-wallet' },
  { value: 'stripe', label: t('agentPurchase.methods.stripe'), icon: 'pi pi-globe' }
])

// Computed: check if user has sufficient balance
const hasSufficientBalance = computed(() => {
  if (!props.agent || props.agent.price === 0) return true
  return userBalance.value >= props.agent.price
})

// Reset state when dialog opens/closes
watch(isVisible, async (newValue) => {
  if (newValue) {
    resetState()
    await fetchUserBalance()
  }
})

const resetState = () => {
  errorMessage.value = ''
  successMessage.value = ''
  selectedPaymentMethod.value = 'card'
  processing.value = false
  showSuccessActions.value = false
  purchaseType.value = ''
}

const fetchUserBalance = async () => {
  loadingBalance.value = true
  try {
    // Mock access token - in real app, get from auth store
    const accessToken = 'mock-token'
    userBalance.value = await getUserBalance(accessToken)
  } catch (error) {
    console.error('Failed to fetch user balance:', error)
    userBalance.value = 0
  } finally {
    loadingBalance.value = false
  }
}

const getPricingIcon = (model) => {
  const icons = {
    'free': 'pi pi-gift',
    'one_time': 'pi pi-shopping-cart',
    'subscription': 'pi pi-calendar'
  }
  return icons[model] || 'pi pi-tag'
}

const getPricingModelLabel = (model) => {
  const labels = {
    'free': t('agentPurchase.models.free'),
    'one_time': t('agentPurchase.models.oneTime'),
    'subscription': t('agentPurchase.models.subscription')
  }
  return labels[model] || model
}

const handleClose = () => {
  if (!processing.value) {
    isVisible.value = false
  }
}

const handleActivate = async () => {
  if (!props.agent) return

  processing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Mock access token - in real app, get from auth store
    const accessToken = 'mock-token'

    const result = await activateFreeAgent(props.agent.id, accessToken)

    // Check if agent was already activated (Issue #5030)
    if (result.alreadyActivated) {
      successMessage.value = t('agentPurchase.success.alreadyActivated')

      toast.add({
        severity: 'info',
        summary: t('common.info'),
        detail: t('agentPurchase.success.alreadyActivated'),
        life: 3000
      })

      // Close dialog after showing info message
      setTimeout(() => {
        emit('purchase-complete', { agent: props.agent, type: 'activation', alreadyActivated: true })
        handleClose()
      }, 1500)
    } else {
      // First activation - show success actions (Issue #5028)
      purchaseType.value = 'activation'
      successMessage.value = t('agentPurchase.success.activated')
      showSuccessActions.value = true

      toast.add({
        severity: 'success',
        summary: t('agentPurchase.success.activated'),
        detail: t('agentPurchase.success.activatedDetail', { name: props.agent.name }),
        life: 5000
      })

      emit('purchase-complete', { agent: props.agent, type: 'activation', alreadyActivated: false })
    }
  } catch (error) {
    errorMessage.value = error.message || t('agentPurchase.error.activationFailed')
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: errorMessage.value,
      life: 5000
    })
  } finally {
    processing.value = false
  }
}

const handlePurchase = async () => {
  if (!props.agent || !selectedPaymentMethod.value) return

  // Check balance before proceeding
  if (!hasSufficientBalance.value) {
    const deficit = props.agent.price - userBalance.value
    toast.add({
      severity: 'warn',
      summary: t('agentPurchase.insufficientFunds') || 'Недостаточно средств',
      detail: t('agentPurchase.topUpMessage', { amount: deficit.toFixed(2) }) ||
              `Требуется: $${props.agent.price.toFixed(2)}, Ваш баланс: $${userBalance.value.toFixed(2)}. Необходимо пополнить на $${deficit.toFixed(2)}`,
      life: 5000
    })
    return
  }

  processing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Mock access token - in real app, get from auth store
    const accessToken = 'mock-token'

    const result = await purchaseAgent({
      agentId: props.agent.id,
      price: props.agent.price,
      paymentMethod: selectedPaymentMethod.value
    }, accessToken)

    purchaseType.value = 'purchase'
    successMessage.value = t('agentPurchase.success.purchased')
    showSuccessActions.value = true

    toast.add({
      severity: 'success',
      summary: t('agentPurchase.success.purchased'),
      detail: t('agentPurchase.success.purchasedDetail', { name: props.agent.name }),
      life: 5000
    })

    emit('purchase-complete', { agent: props.agent, type: 'purchase', result })
  } catch (error) {
    errorMessage.value = error.message || t('agentPurchase.error.purchaseFailed')
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: errorMessage.value,
      life: 5000
    })
  } finally {
    processing.value = false
  }
}

const handleSubscribe = async () => {
  if (!props.agent || !selectedPaymentMethod.value) return

  // Check balance before proceeding
  if (!hasSufficientBalance.value) {
    const deficit = props.agent.price - userBalance.value
    toast.add({
      severity: 'warn',
      summary: t('agentPurchase.insufficientFunds') || 'Недостаточно средств',
      detail: t('agentPurchase.topUpMessage', { amount: deficit.toFixed(2) }) ||
              `Требуется: $${props.agent.price.toFixed(2)}, Ваш баланс: $${userBalance.value.toFixed(2)}. Необходимо пополнить на $${deficit.toFixed(2)}`,
      life: 5000
    })
    return
  }

  processing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Mock access token - in real app, get from auth store
    const accessToken = 'mock-token'

    const result = await subscribeToAgent({
      agentId: props.agent.id,
      price: props.agent.price,
      paymentMethod: selectedPaymentMethod.value
    }, accessToken)

    purchaseType.value = 'subscription'
    successMessage.value = t('agentPurchase.success.subscribed')
    showSuccessActions.value = true

    toast.add({
      severity: 'success',
      summary: t('agentPurchase.success.subscribed'),
      detail: t('agentPurchase.success.subscribedDetail', { name: props.agent.name }),
      life: 5000
    })

    emit('purchase-complete', { agent: props.agent, type: 'subscription', result })
  } catch (error) {
    errorMessage.value = error.message || t('agentPurchase.error.subscriptionFailed')
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: errorMessage.value,
      life: 5000
    })
  } finally {
    processing.value = false
  }
}

// Action handlers for success state
const handleOpenAgent = () => {
  if (props.agent && props.agent.path) {
    router.push(props.agent.path)
    handleClose()
  }
}

const handleGoToMyAgents = () => {
  router.push('/my-agents')
  handleClose()
}

const handleContinueShopping = () => {
  handleClose()
}
</script>

<style scoped>
.purchase-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.agent-info {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.agent-icon {
  font-size: 3rem;
  line-height: 1;
}

.agent-details {
  flex: 1;
}

.agent-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.agent-creator {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.agent-description {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-color-secondary);
}

.pricing-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.pricing-card {
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid var(--surface-border);
  background: var(--surface-card);
  transition: all 0.3s ease;
}

.pricing-card.pricing-free {
  border-color: var(--green-500);
  background: linear-gradient(135deg, var(--green-50) 0%, var(--surface-card) 100%);
}

.pricing-card.pricing-one_time {
  border-color: var(--blue-500);
  background: linear-gradient(135deg, var(--blue-50) 0%, var(--surface-card) 100%);
}

.pricing-card.pricing-subscription {
  border-color: var(--purple-500);
  background: linear-gradient(135deg, var(--purple-50) 0%, var(--surface-card) 100%);
}

.pricing-model {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.price-display {
  margin-bottom: 1.5rem;
}

.price-free {
  font-size: 2rem;
  font-weight: 700;
  color: var(--green-600);
}

.price-amount {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.amount {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1;
}

.period {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin-left: 0.25rem;
}

.pricing-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-color);
}

.feature-item i {
  color: var(--green-500);
  font-size: 1rem;
}

.balance-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.balance-card {
  padding: 1.25rem;
  border-radius: 8px;
  border: 2px solid var(--surface-border);
  background: var(--surface-card);
  transition: all 0.3s ease;
}

.balance-card.insufficient {
  border-color: var(--red-500);
  background: linear-gradient(135deg, var(--red-50) 0%, var(--surface-card) 100%);
}

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.balance-row:last-of-type {
  margin-bottom: 0;
}

.balance-label {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.balance-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.balance-warning {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  background: var(--red-100);
  color: var(--red-900);
  font-size: 0.9rem;
  font-weight: 600;
}

.balance-warning i {
  font-size: 1.1rem;
  color: var(--red-600);
}

.payment-method-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.payment-methods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.payment-method-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--surface-card);
}

.payment-method-option:hover {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.payment-method-option.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
  box-shadow: 0 0 0 2px var(--primary-100);
}

.payment-method-option i {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.payment-method-option span {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

/* Issue #5028: Success Actions Section */
.success-actions-section {
  padding: 2rem 1rem;
  background: linear-gradient(135deg, var(--green-50) 0%, var(--surface-card) 100%);
  border-radius: 12px;
  border: 2px solid var(--green-200);
}

.success-header {
  text-align: center;
  margin-bottom: 2rem;
}

.success-icon {
  font-size: 4rem;
  color: var(--green-500);
  margin-bottom: 1rem;
  animation: successPulse 0.6s ease-out;
}

@keyframes successPulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.success-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--green-700);
}

.success-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-buttons .p-button {
  justify-content: center;
  width: 100%;
}
</style>

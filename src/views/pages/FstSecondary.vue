<template>
  <FstPageLayout title="🔄 Secondary Market" subtitle="Вторичные сделки: продажа доли фонда другим инвесторам">
    <template #actions>
      <select v-model="selectedCompany" class="sec-select">
          <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="sec-btn secondary" @click="showNetworkDialog = true">
          <i class="pi pi-share-alt"></i> Сеть покупателей
        </button>
        <button class="sec-btn primary" @click="openSellDialog">
          <i class="pi pi-dollar"></i> Продать долю
        </button>
    </template>

    <!-- Сводка текущей позиции -->
    <div class="sec-position">
      <h2>Позиция ФСТ НТИ в {{ currentCompanyName }}</h2>
      <div class="sec-pos-cards">
        <div class="sec-pos-card">
          <div class="sec-pos-icon"><i class="pi pi-percentage"></i></div>
          <div class="sec-pos-data">
            <div class="sec-pos-val">{{ fstPosition.fdPct }}%</div>
            <div class="sec-pos-lbl">Доля FD</div>
          </div>
        </div>
        <div class="sec-pos-card">
          <div class="sec-pos-icon"><i class="pi pi-wallet"></i></div>
          <div class="sec-pos-data">
            <div class="sec-pos-val">{{ fstPosition.invested }} млн ₽</div>
            <div class="sec-pos-lbl">Инвестировано</div>
          </div>
        </div>
        <div class="sec-pos-card">
          <div class="sec-pos-icon"><i class="pi pi-chart-line"></i></div>
          <div class="sec-pos-data">
            <div class="sec-pos-val">{{ fstPosition.currentValue }} млн ₽</div>
            <div class="sec-pos-lbl">Текущая стоимость</div>
          </div>
        </div>
        <div class="sec-pos-card">
          <div class="sec-pos-icon"><i class="pi pi-arrows-h"></i></div>
          <div class="sec-pos-data">
            <div class="sec-pos-val">{{ fstPosition.multiple }}x</div>
            <div class="sec-pos-lbl">Money Multiple</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="sec-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['sec-tab', { active: activeTab === t.id }]" @click="activeTab = t.id">
        <i :class="t.icon"></i> {{ t.label }}
      </button>
    </div>

    <!-- Active Offers Tab -->
    <div v-if="activeTab === 'offers'" class="sec-section">
      <div class="sec-section-header">
        <h2>Активные предложения</h2>
        <div class="sec-filters">
          <select v-model="offerFilter" class="sec-select-sm">
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="pending">Ожидают LOI</option>
            <option value="negotiation">Переговоры</option>
            <option value="closed">Закрытые</option>
          </select>
        </div>
      </div>

      <div v-if="filteredOffers.length === 0" class="sec-empty">
        <i class="pi pi-inbox"></i>
        <p>Нет активных предложений</p>
        <button class="sec-btn primary" @click="openSellDialog">Создать предложение</button>
      </div>

      <div v-else class="sec-offers-grid">
        <div v-for="offer in filteredOffers" :key="offer.id" class="sec-offer-card">
          <div class="sec-offer-header">
            <div>
              <h3>{{ offer.companyName }}</h3>
              <span class="sec-offer-badge" :class="'status-' + offer.status">{{ offerStatusLabel(offer.status) }}</span>
            </div>
            <div class="sec-offer-date">{{ formatDate(offer.createdAt) }}</div>
          </div>
          <div class="sec-offer-body">
            <div class="sec-offer-row">
              <span class="sec-offer-label">Продаваемая доля:</span>
              <span class="sec-offer-value">{{ offer.sharePercent }}%</span>
            </div>
            <div class="sec-offer-row">
              <span class="sec-offer-label">Минимальная цена:</span>
              <span class="sec-offer-value">{{ offer.minPrice }} млн ₽</span>
            </div>
            <div class="sec-offer-row">
              <span class="sec-offer-label">Оценочный метод:</span>
              <span class="sec-offer-value">{{ offer.valuationMethod }}</span>
            </div>
            <div class="sec-offer-row">
              <span class="sec-offer-label">Заинтересовано покупателей:</span>
              <span class="sec-offer-value bold">{{ offer.interestedBuyers }}</span>
            </div>
          </div>
          <div class="sec-offer-actions">
            <button class="sec-btn-sm secondary" @click="viewOfferDetails(offer)">
              <i class="pi pi-eye"></i> Детали
            </button>
            <button class="sec-btn-sm primary" @click="viewBuyers(offer)">
              <i class="pi pi-users"></i> Покупатели ({{ offer.interestedBuyers }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Valuation Tab -->
    <div v-if="activeTab === 'valuation'" class="sec-section">
      <h2>Оценка доли для вторичной продажи</h2>

      <div class="sec-val-methods">
        <div
          v-for="method in valuationMethods"
          :key="method.id"
          class="sec-val-method"
          :class="{ active: selectedValuation === method.id }"
          @click="selectedValuation = method.id"
        >
          <div class="sec-val-method-header">
            <i :class="method.icon"></i>
            <h3>{{ method.name }}</h3>
          </div>
          <p class="sec-val-method-desc">{{ method.description }}</p>
          <div class="sec-val-result">
            <div class="sec-val-result-val">{{ method.value }} млн ₽</div>
            <div class="sec-val-result-label">Расчётная цена доли ФСТ НТИ</div>
          </div>
        </div>
      </div>

      <div class="sec-val-details">
        <h3>Детали расчёта: {{ selectedValuationMethod.name }}</h3>
        <div class="sec-val-calc">
          <div v-for="param in selectedValuationMethod.params" :key="param.label" class="sec-val-param">
            <label>{{ param.label }}</label>
            <div class="sec-val-param-value">{{ param.value }}</div>
          </div>
        </div>
        <div class="sec-val-recommendation">
          <i class="pi pi-info-circle"></i>
          <div>
            <strong>Рекомендация:</strong>
            {{ selectedValuationMethod.recommendation }}
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction History Tab -->
    <div v-if="activeTab === 'history'" class="sec-section">
      <h2>История вторичных сделок</h2>

      <table class="sec-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Компания</th>
            <th>Продано %</th>
            <th>Цена, млн ₽</th>
            <th>Покупатель</th>
            <th>Multiple</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in transactionHistory" :key="tx.id">
            <td>{{ formatDate(tx.date) }}</td>
            <td class="bold">{{ tx.companyName }}</td>
            <td class="num">{{ tx.sharePercent }}%</td>
            <td class="num">{{ tx.price }}</td>
            <td>{{ tx.buyer }}</td>
            <td class="num bold" :class="multipleClass(tx.multiple)">{{ tx.multiple }}x</td>
            <td><span class="sec-badge" :class="'status-' + tx.status">{{ txStatusLabel(tx.status) }}</span></td>
          </tr>
        </tbody>
      </table>

      <div class="sec-history-summary">
        <div class="sec-sum-card">
          <span class="sec-sum-label">Всего сделок:</span>
          <span class="sec-sum-value">{{ transactionHistory.length }}</span>
        </div>
        <div class="sec-sum-card">
          <span class="sec-sum-label">Общая сумма:</span>
          <span class="sec-sum-value">{{ totalTransactionValue }} млн ₽</span>
        </div>
        <div class="sec-sum-card">
          <span class="sec-sum-label">Средний multiple:</span>
          <span class="sec-sum-value">{{ averageMultiple }}x</span>
        </div>
      </div>
    </div>

    <!-- Buyers Network Tab -->
    <div v-if="activeTab === 'network'" class="sec-section">
      <h2>Сеть потенциальных покупателей</h2>

      <div class="sec-network-filters">
        <input v-model="buyerSearch" type="text" placeholder="Поиск по названию..." class="sec-input" />
        <select v-model="buyerTypeFilter" class="sec-select-sm">
          <option value="all">Все типы</option>
          <option value="vc">Венчурный фонд</option>
          <option value="corp">Корпорация</option>
          <option value="state">Госкорпорация</option>
          <option value="strategic">Стратег. инвестор</option>
        </select>
      </div>

      <div class="sec-buyers-grid">
        <div v-for="buyer in filteredBuyers" :key="buyer.id" class="sec-buyer-card">
          <div class="sec-buyer-header">
            <div class="sec-buyer-avatar" :style="{ background: buyer.color }">{{ buyer.initials }}</div>
            <div>
              <h3>{{ buyer.name }}</h3>
              <span class="sec-buyer-type">{{ buyer.type }}</span>
            </div>
          </div>
          <div class="sec-buyer-info">
            <div class="sec-buyer-stat">
              <i class="pi pi-wallet"></i>
              <span>{{ buyer.fundSize }} млрд ₽</span>
            </div>
            <div class="sec-buyer-stat">
              <i class="pi pi-briefcase"></i>
              <span>{{ buyer.portfolioCount }} портф. комп.</span>
            </div>
            <div class="sec-buyer-stat">
              <i class="pi pi-chart-line"></i>
              <span>{{ buyer.focusAreas.join(', ') }}</span>
            </div>
          </div>
          <div class="sec-buyer-actions">
            <button class="sec-btn-sm secondary" @click="viewBuyerProfile(buyer)">Профиль</button>
            <button class="sec-btn-sm primary" @click="sendOffer(buyer)">Отправить предложение</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sell Share Modal -->
    <div v-if="showSellDialog" class="modal-overlay" @click.self="showSellDialog = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h3>Продажа доли ФСТ НТИ</h3>
          <button class="modal-close" @click="showSellDialog = false"><i class="pi pi-times"></i></button>
        </div>

        <div class="modal-body">
          <div class="modal-form">
            <div class="form-group">
              <label>Компания</label>
              <select v-model="sellForm.companyId" class="sec-input">
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>Тип продажи</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" v-model="sellForm.saleType" value="partial" />
                  <span>Частичная продажа</span>
                </label>
                <label class="radio-label">
                  <input type="radio" v-model="sellForm.saleType" value="full" />
                  <span>Полная продажа</span>
                </label>
              </div>
            </div>

            <div v-if="sellForm.saleType === 'partial'" class="form-group">
              <label>Продаваемая доля, %</label>
              <input v-model.number="sellForm.sharePercent" type="number" min="1" max="100" step="0.1" class="sec-input" />
              <div class="form-hint">Текущая доля ФСТ НТИ: {{ fstPosition.fdPct }}%</div>
            </div>

            <div class="form-group">
              <label>Метод оценки</label>
              <select v-model="sellForm.valuationMethod" class="sec-input">
                <option value="nav">NAV-based (последний NAV × коэфф. ликвидности)</option>
                <option value="dcf">DCF (дисконтированные потоки)</option>
                <option value="comparable">Comparable transactions (аналогичные сделки)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Минимальная цена, млн ₽</label>
              <input v-model.number="sellForm.minPrice" type="number" min="0" step="10" class="sec-input" />
              <div class="form-hint">Рекомендуемая цена: {{ recommendedPrice }} млн ₽</div>
            </div>

            <div class="form-group">
              <label>Покупатели</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sellForm.targetBuyers" value="network" />
                  <span>Сеть соинвесторов ({{ networkBuyersCount }})</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sellForm.targetBuyers" value="strategic" />
                  <span>Стратегические инвесторы</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sellForm.targetBuyers" value="state" />
                  <span>Госкорпорации (Ростех, Роскосмос)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="sec-btn secondary" @click="showSellDialog = false">Отмена</button>
          <button class="sec-btn primary" @click="createSellOffer">
            <i class="pi pi-check"></i> Создать предложение
          </button>
        </div>
      </div>
    </div>

    <!-- Network Dialog -->
    <div v-if="showNetworkDialog" class="modal-overlay" @click.self="showNetworkDialog = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Сеть покупателей</h3>
          <button class="modal-close" @click="showNetworkDialog = false"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-body">
          <p>В вашей сети {{ networkBuyersCount }} потенциальных покупателей.</p>
          <ul class="network-list">
            <li v-for="b in buyers.slice(0, 5)" :key="b.id">{{ b.name }} — {{ b.type }}</li>
          </ul>
          <button class="sec-btn primary" @click="activeTab = 'network'; showNetworkDialog = false">Смотреть всех</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const activeTab = ref('offers')
const selectedCompany = ref('agrodr')
const offerFilter = ref('all')
const buyerSearch = ref('')
const buyerTypeFilter = ref('all')
const selectedValuation = ref('nav')
const showSellDialog = ref(false)
const showNetworkDialog = ref(false)

const tabs = [
  { id: 'offers', label: 'Предложения', icon: 'pi pi-list' },
  { id: 'valuation', label: 'Оценка', icon: 'pi pi-calculator' },
  { id: 'history', label: 'История', icon: 'pi pi-history' },
  { id: 'network', label: 'Покупатели', icon: 'pi pi-users' }
]

const companies = ref([
  { id: 'agrodr', name: 'АгроДрон' },
  { id: 'robofarm', name: 'RoboFarm' },
  { id: 'medtech', name: 'МедТех БПЛА' }
])

const currentCompanyName = computed(() => {
  return companies.value.find(c => c.id === selectedCompany.value)?.name || ''
})

// FST position in selected company
const fstPosition = computed(() => {
  const positions = {
    agrodr: { fdPct: 20.5, invested: 180, currentValue: 256, multiple: 1.42 },
    robofarm: { fdPct: 15.0, invested: 120, currentValue: 180, multiple: 1.50 },
    medtech: { fdPct: 18.3, invested: 150, currentValue: 195, multiple: 1.30 }
  }
  return positions[selectedCompany.value] || positions.agrodr
})

// Secondary market offers
const offers = ref([
  {
    id: 1,
    companyName: 'АгроДрон',
    sharePercent: 10,
    minPrice: 120,
    valuationMethod: 'NAV-based',
    status: 'active',
    interestedBuyers: 3,
    createdAt: '2026-02-15'
  },
  {
    id: 2,
    companyName: 'RoboFarm',
    sharePercent: 7.5,
    minPrice: 85,
    valuationMethod: 'DCF',
    status: 'negotiation',
    interestedBuyers: 2,
    createdAt: '2026-02-20'
  },
  {
    id: 3,
    companyName: 'МедТех БПЛА',
    sharePercent: 18.3,
    minPrice: 195,
    valuationMethod: 'Comparable',
    status: 'pending',
    interestedBuyers: 1,
    createdAt: '2026-03-01'
  }
])

const filteredOffers = computed(() => {
  if (offerFilter.value === 'all') return offers.value
  return offers.value.filter(o => o.status === offerFilter.value)
})

// Valuation methods
const valuationMethods = ref([
  {
    id: 'nav',
    name: 'NAV-based',
    icon: 'pi pi-chart-pie',
    description: 'Последний NAV × коэффициент ликвидности (дисконт 10-30%)',
    value: 230,
    params: [
      { label: 'Последний NAV', value: '1250 млн ₽' },
      { label: 'Доля ФСТ НТИ', value: '20.5%' },
      { label: 'Расчётная стоимость доли', value: '256 млн ₽' },
      { label: 'Дисконт за неликвидность', value: '-10%' },
      { label: 'Финальная цена', value: '230 млн ₽' }
    ],
    recommendation: 'Консервативный подход, подходит для быстрой продажи. Дисконт 10% — стандартный для secondary рынка венчурных долей.'
  },
  {
    id: 'dcf',
    name: 'DCF (Discounted Cash Flow)',
    icon: 'pi pi-money-bill',
    description: 'Приведённая стоимость будущих денежных потоков',
    value: 285,
    params: [
      { label: 'Прогноз выручки 2027', value: '450 млн ₽' },
      { label: 'EBITDA margin', value: '25%' },
      { label: 'Ставка дисконтирования', value: '18%' },
      { label: 'Terminal multiple', value: '8x EBITDA' },
      { label: 'Доля ФСТ НТИ от EV', value: '285 млн ₽' }
    ],
    recommendation: 'Оптимистичный сценарий для компаний с сильными финансовыми показателями. Используйте для переговоров с стратегическими инвесторами.'
  },
  {
    id: 'comparable',
    name: 'Comparable Transactions',
    icon: 'pi pi-copy',
    description: 'Оценка на основе похожих secondary сделок',
    value: 260,
    params: [
      { label: 'Средний multiple аналогов', value: '1.45x' },
      { label: 'Инвестировано ФСТ НТИ', value: '180 млн ₽' },
      { label: 'Расчётная цена', value: '261 млн ₽' },
      { label: 'Корректировка на сектор', value: '-0.5%' },
      { label: 'Финальная цена', value: '260 млн ₽' }
    ],
    recommendation: 'Наиболее рыночный подход. Основан на реальных сделках в секторе агротех и робототехники за последние 12 месяцев.'
  }
])

const selectedValuationMethod = computed(() => {
  return valuationMethods.value.find(m => m.id === selectedValuation.value) || valuationMethods.value[0]
})

// Transaction history
const transactionHistory = ref([
  { id: 1, date: '2025-11-10', companyName: 'SkyVision', sharePercent: 12.0, price: 85, buyer: 'Ростех', multiple: 1.31, status: 'completed' },
  { id: 2, date: '2025-09-22', companyName: 'DroneLogistics', sharePercent: 8.5, price: 60, buyer: 'ВЭБ.РФ', multiple: 1.20, status: 'completed' },
  { id: 3, date: '2025-07-15', companyName: 'AeroDefense', sharePercent: 15.0, price: 120, buyer: 'Роскосмос', multiple: 1.50, status: 'completed' }
])

const totalTransactionValue = computed(() => {
  return transactionHistory.value.reduce((sum, tx) => sum + tx.price, 0)
})

const averageMultiple = computed(() => {
  const avg = transactionHistory.value.reduce((sum, tx) => sum + tx.multiple, 0) / transactionHistory.value.length
  return avg.toFixed(2)
})

// Buyers network
const buyers = ref([
  { id: 1, name: 'Ростех', type: 'Госкорпорация', fundSize: 500, portfolioCount: 120, focusAreas: ['БПЛА', 'Оборона'], color: '#3b82f6', initials: 'РТ' },
  { id: 2, name: 'Роскосмос', type: 'Госкорпорация', fundSize: 350, portfolioCount: 80, focusAreas: ['Космос', 'БПЛА'], color: '#8b5cf6', initials: 'РК' },
  { id: 3, name: 'ВЭБ.РФ', type: 'Корпорация', fundSize: 280, portfolioCount: 95, focusAreas: ['Инфраструктура', 'Агротех'], color: '#10b981', initials: 'ВЭБ' },
  { id: 4, name: 'Сколково Ventures', type: 'Венчурный фонд', fundSize: 15, portfolioCount: 45, focusAreas: ['БПЛА', 'ИИ', 'Робототехника'], color: '#f59e0b', initials: 'СВ' },
  { id: 5, name: 'RVC', type: 'Венчурный фонд', fundSize: 12, portfolioCount: 60, focusAreas: ['DeepTech', 'БПЛА'], color: '#ef4444', initials: 'РВК' },
  { id: 6, name: 'Газпромбанк Invest', type: 'Стратег. инвестор', fundSize: 40, portfolioCount: 30, focusAreas: ['Энергетика', 'Индустрия'], color: '#06b6d4', initials: 'ГПБ' }
])

const networkBuyersCount = computed(() => buyers.value.length)

const filteredBuyers = computed(() => {
  let result = buyers.value

  if (buyerSearch.value) {
    result = result.filter(b => b.name.toLowerCase().includes(buyerSearch.value.toLowerCase()))
  }

  if (buyerTypeFilter.value !== 'all') {
    const typeMap = {
      vc: 'Венчурный фонд',
      corp: 'Корпорация',
      state: 'Госкорпорация',
      strategic: 'Стратег. инвестор'
    }
    result = result.filter(b => b.type === typeMap[buyerTypeFilter.value])
  }

  return result
})

// Sell form
const sellForm = ref({
  companyId: 'agrodr',
  saleType: 'partial',
  sharePercent: 10,
  valuationMethod: 'nav',
  minPrice: 230,
  targetBuyers: ['network']
})

const recommendedPrice = computed(() => {
  const method = valuationMethods.value.find(m => m.id === sellForm.value.valuationMethod)
  return method?.value || 230
})

// Helper functions
function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function offerStatusLabel(status) {
  const labels = {
    active: 'Активно',
    pending: 'Ожидает LOI',
    negotiation: 'Переговоры',
    closed: 'Закрыто'
  }
  return labels[status] || status
}

function txStatusLabel(status) {
  const labels = {
    completed: 'Завершено',
    pending: 'В процессе',
    cancelled: 'Отменено'
  }
  return labels[status] || status
}

function multipleClass(multiple) {
  if (multiple >= 1.5) return 'green'
  if (multiple >= 1.2) return 'yellow'
  return 'red'
}

function openSellDialog() {
  sellForm.value.companyId = selectedCompany.value
  sellForm.value.minPrice = recommendedPrice.value
  showSellDialog.value = true
}

function createSellOffer() {
  const newOffer = {
    id: offers.value.length + 1,
    companyName: currentCompanyName.value,
    sharePercent: sellForm.value.saleType === 'full' ? fstPosition.value.fdPct : sellForm.value.sharePercent,
    minPrice: sellForm.value.minPrice,
    valuationMethod: sellForm.value.valuationMethod,
    status: 'active',
    interestedBuyers: 0,
    createdAt: new Date().toISOString().split('T')[0]
  }
  offers.value.unshift(newOffer)
  showSellDialog.value = false
  activeTab.value = 'offers'
}

function viewOfferDetails(offer) {
  alert(`Детали предложения:\n\nКомпания: ${offer.companyName}\nДоля: ${offer.sharePercent}%\nМин. цена: ${offer.minPrice} млн ₽\nСтатус: ${offerStatusLabel(offer.status)}`)
}

function viewBuyers(offer) {
  alert(`Заинтересованные покупатели для ${offer.companyName}:\n\n${offer.interestedBuyers} покупателей просмотрели предложение.`)
}

function viewBuyerProfile(buyer) {
  alert(`Профиль покупателя:\n\n${buyer.name}\nТип: ${buyer.type}\nРазмер фонда: ${buyer.fundSize} млрд ₽\nПортфель: ${buyer.portfolioCount} компаний\nФокус: ${buyer.focusAreas.join(', ')}`)
}

function sendOffer(buyer) {
  alert(`Предложение отправлено инвестору ${buyer.name}`)
}
</script>

<style scoped>
.sec-root { padding: 24px; display: flex; flex-direction: column; gap: 24px; min-height: 100vh; background: var(--surface-ground); }

/* Header */
.sec-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.sec-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.sec-subtitle { font-size: 0.8rem; color: var(--p-text-muted-color); margin-top: 4px; }
.sec-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* Buttons */
.sec-btn { padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.sec-btn.primary { background: var(--p-primary-color); color: #fff; }
.sec-btn.primary:hover { opacity: 0.9; }
.sec-btn.secondary { background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.sec-btn.secondary:hover { background: var(--surface-hover); }

.sec-btn-sm { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; transition: all 0.2s; }
.sec-btn-sm.primary { background: var(--p-primary-color); color: #fff; }
.sec-btn-sm.secondary { background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }

.sec-select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.9rem; }
.sec-select-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.85rem; }
.sec-input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.9rem; width: 100%; }

/* Position Summary */
.sec-position { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 24px; }
.sec-position h2 { margin: 0 0 16px; font-size: 1.1rem; color: var(--p-text-color); }
.sec-pos-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.sec-pos-card { display: flex; align-items: center; gap: 14px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 10px; padding: 16px; }
.sec-pos-icon { width: 48px; height: 48px; border-radius: 10px; background: var(--p-primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
.sec-pos-val { font-size: 1.5rem; font-weight: 700; color: var(--p-primary-color); }
.sec-pos-lbl { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }

/* Tabs */
.sec-tabs { display: flex; gap: 6px; overflow-x: auto; }
.sec-tab { padding: 10px 18px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s; }
.sec-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

/* Section */
.sec-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 24px; }
.sec-section h2 { margin: 0 0 20px; font-size: 1.15rem; color: var(--p-text-color); }
.sec-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.sec-filters { display: flex; gap: 8px; }

/* Empty State */
.sec-empty { text-align: center; padding: 60px 20px; color: var(--p-text-muted-color); }
.sec-empty i { font-size: 3rem; margin-bottom: 16px; opacity: 0.5; }
.sec-empty p { margin: 0 0 20px; font-size: 1rem; }

/* Offers Grid */
.sec-offers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.sec-offer-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; gap: 14px; transition: all 0.2s; }
.sec-offer-card:hover { border-color: var(--p-primary-color); box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 8%, transparent); }
.sec-offer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.sec-offer-header h3 { margin: 0; font-size: 1rem; color: var(--p-text-color); }
.sec-offer-badge { padding: 3px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.sec-offer-badge.status-active { background: #10b98122; color: #10b981; }
.sec-offer-badge.status-pending { background: #f59e0b22; color: #f59e0b; }
.sec-offer-badge.status-negotiation { background: #3b82f622; color: #3b82f6; }
.sec-offer-badge.status-closed { background: #6b728022; color: #6b7280; }
.sec-offer-date { font-size: 0.75rem; color: var(--p-text-muted-color); }
.sec-offer-body { display: flex; flex-direction: column; gap: 8px; }
.sec-offer-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
.sec-offer-label { color: var(--p-text-muted-color); }
.sec-offer-value { font-weight: 600; color: var(--p-text-color); }
.sec-offer-value.bold { color: var(--p-primary-color); }
.sec-offer-actions { display: flex; gap: 8px; }

/* Valuation */
.sec-val-methods { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--p-content-border-color); padding-bottom: 12px; }
.sec-val-method { background: var(--surface-ground); border: 2px solid var(--surface-border); border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.2s; }
.sec-val-method:hover { border-color: var(--p-primary-color); }
.sec-val-method.active { border-color: var(--p-primary-color); background: var(--p-primary-color)11; }
.sec-val-method-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.sec-val-method-header i { font-size: 1.5rem; color: var(--p-primary-color); }
.sec-val-method-header h3 { margin: 0; font-size: 1rem; color: var(--p-text-color); }
.sec-val-method-desc { font-size: 0.8rem; color: var(--p-text-muted-color); margin-bottom: 14px; line-height: 1.4; }
.sec-val-result { background: var(--surface-card); border-radius: 8px; padding: 12px; text-align: center; }
.sec-val-result-val { font-size: 1.6rem; font-weight: 700; color: var(--p-primary-color); }
.sec-val-result-label { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 4px; }

.sec-val-details { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; }
.sec-val-details h3 { margin: 0 0 16px; font-size: 1rem; color: var(--p-text-color); }
.sec-val-calc { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
.sec-val-param { display: flex; flex-direction: column; gap: 4px; }
.sec-val-param label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.sec-val-param-value { font-size: 0.95rem; font-weight: 600; color: var(--p-text-color); }
.sec-val-recommendation { display: flex; gap: 12px; padding: 14px; background: var(--surface-card); border-radius: 8px; border-left: 3px solid var(--p-primary-color); font-size: 0.85rem; color: var(--p-text-color); line-height: 1.5; }
.sec-val-recommendation i { color: var(--p-primary-color); font-size: 1.2rem; flex-shrink: 0; }

/* Table */
.sec-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.sec-table th { padding: 10px 12px; text-align: left; color: var(--p-text-muted-color); border-bottom: 2px solid var(--surface-border); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
.sec-table td { padding: 12px 12px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.sec-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.sec-table .bold { font-weight: 700; }
.sec-table .green { color: #10b981; }
.sec-table .yellow { color: #f59e0b; }
.sec-table .red { color: #ef4444; }

.sec-badge { padding: 3px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 600; }
.sec-badge.status-completed { background: #10b98122; color: #10b981; }
.sec-badge.status-pending { background: #f59e0b22; color: #f59e0b; }
.sec-badge.status-cancelled { background: #ef444422; color: #ef4444; }

.sec-history-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 20px; }
.sec-sum-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; display: flex; justify-content: space-between; align-items: center; }
.sec-sum-label { font-size: 0.8rem; color: var(--p-text-muted-color); }
.sec-sum-value { font-size: 1.3rem; font-weight: 700; color: var(--p-primary-color); }

/* Buyers Network */
.sec-network-filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }

.sec-buyers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.sec-buyer-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; gap: 14px; transition: all 0.2s; }
.sec-buyer-card:hover { border-color: var(--p-primary-color); box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 8%, transparent); }
.sec-buyer-header { display: flex; align-items: center; gap: 12px; }
.sec-buyer-avatar { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 1rem; flex-shrink: 0; }
.sec-buyer-header h3 { margin: 0; font-size: 1rem; color: var(--p-text-color); }
.sec-buyer-type { font-size: 0.75rem; color: var(--p-text-muted-color); }
.sec-buyer-info { display: flex; flex-direction: column; gap: 8px; }
.sec-buyer-stat { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--p-text-color); }
.sec-buyer-stat i { color: var(--p-primary-color); }
.sec-buyer-actions { display: flex; gap: 8px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 14px; width: 500px; max-width: 95vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px color-mix(in srgb, var(--p-text-color) 30%, transparent); }
.modal-lg { width: 700px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--surface-border); }
.modal-header h3 { margin: 0; font-size: 1.15rem; color: var(--p-text-color); }
.modal-close { background: none; border: none; cursor: pointer; color: var(--p-text-muted-color); font-size: 1.2rem; padding: 4px; transition: color 0.2s; }
.modal-close:hover { color: var(--p-text-color); }
.modal-body { padding: 24px; }
.modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--surface-border); }

/* Form */
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.85rem; color: var(--p-text-muted-color); font-weight: 600; }
.form-hint { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; }

.radio-group { display: flex; gap: 16px; }
.radio-label { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--p-text-color); cursor: pointer; }
.radio-label input[type="radio"] { cursor: pointer; }

.checkbox-group { display: flex; flex-direction: column; gap: 8px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--p-text-color); cursor: pointer; }
.checkbox-label input[type="checkbox"] { cursor: pointer; }

.network-list { list-style: none; padding: 0; margin: 16px 0; }
.network-list li { padding: 8px 0; border-bottom: 1px solid var(--surface-border); font-size: 0.9rem; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .sec-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .sec-history-summary { flex-wrap: wrap; gap: 8px; }
  .sec-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .sec-tabs > * { flex-shrink: 0; font-size: 0.8rem; }
  .sec-pos-cards { grid-template-columns: 1fr !important; }
  .sec-offers-grid { grid-template-columns: 1fr !important; }
}
</style>

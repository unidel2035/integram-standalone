<template>
  <div class="admin-root">
    <div class="admin-header">
      <div>
        <h1>Бэк-офис фонда</h1>
        <span class="admin-subtitle">Управленческий учёт и соответствие ФСБУ 4/2023</span>
      </div>
      <div class="admin-actions">
        <select v-model="selectedPeriod" class="admin-select" @change="loadPeriodData">
          <option v-for="p in periods" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="admin-btn secondary" @click="exportReport">Экспорт отчёта</button>
        <button class="admin-btn primary" @click="generateAudit">Аудиторский пакет</button>
      </div>
    </div>

    <!-- Навигация табов -->
    <div class="admin-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['admin-tab', { active: activeTab === t.id }]" @click="activeTab = t.id">
        <i :class="t.icon"></i>
        {{ t.label }}
      </button>
    </div>

    <!-- ════════════════════════════════════════════ MANAGEMENT FEE -->
    <div v-if="activeTab === 'fees'" class="admin-section">
      <h2>Management Fee & Carried Interest</h2>
      <p class="admin-note">Расчёт вознаграждения управляющей компании согласно LPA</p>

      <div class="fee-grid">
        <!-- Management Fee -->
        <div class="fee-card">
          <div class="fee-card-header">
            <h3>Management Fee</h3>
            <span class="fee-badge">2% годовых</span>
          </div>
          <div class="fee-calc">
            <div class="fee-row">
              <span class="fee-label">Committed Capital</span>
              <span class="fee-val">{{ formatCurrency(fundParams.committedCapital) }}</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Ставка Management Fee</span>
              <span class="fee-val">{{ fundParams.managementFeeRate }}%</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Период начисления</span>
              <span class="fee-val">{{ selectedPeriod }}</span>
            </div>
            <div class="fee-separator"></div>
            <div class="fee-row total">
              <span class="fee-label">Начислено за квартал</span>
              <span class="fee-val green">{{ formatCurrency(managementFeeQuarterly) }}</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Статус оплаты</span>
              <span class="fee-val"><span class="status-badge paid">Оплачено</span></span>
            </div>
          </div>
        </div>

        <!-- Carried Interest -->
        <div class="fee-card">
          <div class="fee-card-header">
            <h3>Carried Interest</h3>
            <span class="fee-badge orange">20% от прибыли</span>
          </div>
          <div class="fee-calc">
            <div class="fee-row">
              <span class="fee-label">Hurdle Rate</span>
              <span class="fee-val">{{ fundParams.hurdleRate }}%</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Прибыль сверх hurdle</span>
              <span class="fee-val">{{ formatCurrency(profitAboveHurdle) }}</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Ставка Carry</span>
              <span class="fee-val">{{ fundParams.carryRate }}%</span>
            </div>
            <div class="fee-separator"></div>
            <div class="fee-row total">
              <span class="fee-label">Начислено Carry (потенциально)</span>
              <span class="fee-val orange">{{ formatCurrency(carriedInterest) }}</span>
            </div>
            <div class="fee-row">
              <span class="fee-label">Статус</span>
              <span class="fee-val"><span class="status-badge accrued">Начислено</span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- История начислений -->
      <h3 class="subsection-title">История начислений</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Период</th>
            <th>Тип</th>
            <th>Начислено, млн ₽</th>
            <th>Дата оплаты</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fee in feeHistory" :key="fee.id">
            <td>{{ fee.period }}</td>
            <td><span class="type-badge" :class="fee.type">{{ feeTypeLabel(fee.type) }}</span></td>
            <td class="num">{{ formatCurrency(fee.amount) }}</td>
            <td class="gray">{{ fee.paymentDate }}</td>
            <td><span class="status-badge" :class="fee.status">{{ statusLabel(fee.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══════════════════════════════════════════ FUND EXPENSES -->
    <div v-if="activeTab === 'expenses'" class="admin-section">
      <h2>Расходы фонда</h2>
      <p class="admin-note">Операционные расходы: due diligence, legal, travel, admin</p>

      <!-- Добавить расход -->
      <div class="expense-add-bar">
        <button class="admin-btn primary small" @click="showAddExpense = true">
          <i class="pi pi-plus"></i>
          Добавить расход
        </button>
      </div>

      <!-- Категории расходов -->
      <div class="expense-categories">
        <div v-for="cat in expenseCategories" :key="cat.id" class="expense-cat-card">
          <div class="expense-cat-icon" :style="{ background: cat.color + '22', color: cat.color }">
            <i :class="cat.icon"></i>
          </div>
          <div class="expense-cat-body">
            <div class="expense-cat-label">{{ cat.label }}</div>
            <div class="expense-cat-amount">{{ formatCurrency(cat.total) }}</div>
          </div>
          <div class="expense-cat-pct">{{ cat.pct }}%</div>
        </div>
      </div>

      <!-- Таблица расходов -->
      <table class="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Категория</th>
            <th>Описание</th>
            <th>Контрагент</th>
            <th>Сумма, млн ₽</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exp in expenses" :key="exp.id">
            <td class="gray">{{ exp.date }}</td>
            <td><span class="cat-badge" :class="exp.category">{{ categoryLabel(exp.category) }}</span></td>
            <td>{{ exp.description }}</td>
            <td class="gray">{{ exp.counterparty }}</td>
            <td class="num">{{ formatCurrency(exp.amount) }}</td>
            <td><span class="status-badge" :class="exp.status">{{ statusLabel(exp.status) }}</span></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4"><strong>Итого расходы за {{ selectedPeriod }}</strong></td>
            <td class="num bold">{{ formatCurrency(totalExpenses) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ════════════════════════════════════════════════ NAV CALC -->
    <div v-if="activeTab === 'nav'" class="admin-section">
      <h2>Расчёт NAV (Net Asset Value)</h2>
      <p class="admin-note">Квартальный расчёт чистой стоимости активов фонда</p>

      <div class="nav-summary-grid">
        <div class="nav-metric-card primary">
          <div class="nav-metric-label">NAV на конец периода</div>
          <div class="nav-metric-value">{{ formatCurrency(navCurrent) }}</div>
          <div class="nav-metric-change green">+{{ navChangePercent }}% за квартал</div>
        </div>
        <div class="nav-metric-card">
          <div class="nav-metric-label">Committed Capital</div>
          <div class="nav-metric-value">{{ formatCurrency(fundParams.committedCapital) }}</div>
        </div>
        <div class="nav-metric-card">
          <div class="nav-metric-label">Deployed Capital</div>
          <div class="nav-metric-value">{{ formatCurrency(deployedCapital) }}</div>
        </div>
        <div class="nav-metric-card">
          <div class="nav-metric-label">Unrealized Gains</div>
          <div class="nav-metric-value green">{{ formatCurrency(unrealizedGains) }}</div>
        </div>
      </div>

      <!-- Детальный расчёт NAV -->
      <h3 class="subsection-title">Детальный расчёт NAV — {{ selectedPeriod }}</h3>
      <table class="admin-table nav-table">
        <thead>
          <tr>
            <th>Статья</th>
            <th>Начало периода</th>
            <th>Изменение</th>
            <th>Конец периода</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in navRows" :key="row.label" :class="{ 'nav-total': row.isTotal, 'nav-subtitle': row.isSubtitle }">
            <td :class="{ 'bold': row.isTotal, 'subtitle': row.isSubtitle }">{{ row.label }}</td>
            <td class="num" :class="row.isTotal ? 'bold' : ''">{{ row.begin != null ? formatCurrency(row.begin) : '' }}</td>
            <td class="num" :class="[row.isTotal ? 'bold' : '', row.change > 0 ? 'green' : row.change < 0 ? 'red' : '']">
              {{ row.change != null ? formatCurrency(row.change, true) : '' }}
            </td>
            <td class="num" :class="row.isTotal ? 'bold' : ''">{{ row.end != null ? formatCurrency(row.end) : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════ BANKING OPS -->
    <div v-if="activeTab === 'banking'" class="admin-section">
      <h2>Банковские операции</h2>
      <p class="admin-note">Счета фонда, capital calls, distributions, FX</p>

      <!-- Реестр счетов -->
      <h3 class="subsection-title">Реестр банковских счетов</h3>
      <div class="account-cards">
        <div v-for="acc in bankAccounts" :key="acc.id" class="account-card">
          <div class="account-header">
            <div class="account-bank">{{ acc.bank }}</div>
            <span class="account-currency">{{ acc.currency }}</span>
          </div>
          <div class="account-number">{{ acc.accountNumber }}</div>
          <div class="account-balance">
            <span class="account-balance-label">Баланс:</span>
            <span class="account-balance-val">{{ formatAmount(acc.balance, acc.currency) }}</span>
          </div>
          <div class="account-status">
            <span class="status-badge" :class="acc.status">{{ acc.status === 'active' ? 'Активен' : 'Закрыт' }}</span>
          </div>
        </div>
      </div>

      <!-- Capital Calls -->
      <h3 class="subsection-title">Capital Calls (заявки на взносы)</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Дата уведомления</th>
            <th>Инвестор (LP)</th>
            <th>Запрошено, млн ₽</th>
            <th>Получено, млн ₽</th>
            <th>Дата получения</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cc in capitalCalls" :key="cc.id">
            <td class="gray">{{ cc.noticeDate }}</td>
            <td>{{ cc.investor }}</td>
            <td class="num">{{ formatCurrency(cc.requested) }}</td>
            <td class="num">{{ formatCurrency(cc.received) }}</td>
            <td class="gray">{{ cc.receivedDate || '—' }}</td>
            <td><span class="status-badge" :class="cc.status">{{ capitalCallStatus(cc.status) }}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Distributions -->
      <h3 class="subsection-title">Distributions (выплаты инвесторам)</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Инвестор (LP)</th>
            <th>Тип выплаты</th>
            <th>Сумма, млн ₽</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dist in distributions" :key="dist.id">
            <td class="gray">{{ dist.date }}</td>
            <td>{{ dist.investor }}</td>
            <td><span class="type-badge" :class="dist.type">{{ distributionType(dist.type) }}</span></td>
            <td class="num">{{ formatCurrency(dist.amount) }}</td>
            <td><span class="status-badge" :class="dist.status">{{ statusLabel(dist.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════════ AUDIT -->
    <div v-if="activeTab === 'audit'" class="admin-section">
      <h2>Аудиторская поддержка</h2>
      <p class="admin-note">Подготовка пакета для внешнего аудитора (Ernst & Young)</p>

      <!-- Аудиторские документы -->
      <div class="audit-docs-grid">
        <div v-for="doc in auditDocs" :key="doc.id" class="audit-doc-card" @click="generateDoc(doc.id)">
          <div class="audit-doc-icon" :style="{ background: doc.color + '22', color: doc.color }">
            <i :class="doc.icon"></i>
          </div>
          <div class="audit-doc-body">
            <div class="audit-doc-title">{{ doc.title }}</div>
            <div class="audit-doc-desc">{{ doc.desc }}</div>
          </div>
          <div class="audit-doc-status">
            <span class="status-badge" :class="doc.status">{{ doc.status === 'ready' ? 'Готов' : 'Не готов' }}</span>
          </div>
        </div>
      </div>

      <!-- Trial Balance -->
      <h3 class="subsection-title">Trial Balance (Оборотно-сальдовая ведомость)</h3>
      <table class="admin-table trial-balance-table">
        <thead>
          <tr>
            <th>Счёт</th>
            <th>Наименование</th>
            <th>Дебет начало</th>
            <th>Кредит начало</th>
            <th>Оборот Дт</th>
            <th>Оборот Кт</th>
            <th>Дебет конец</th>
            <th>Кредит конец</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tb in trialBalance" :key="tb.account">
            <td class="mono">{{ tb.account }}</td>
            <td>{{ tb.name }}</td>
            <td class="num">{{ tb.debitBegin > 0 ? formatCurrency(tb.debitBegin) : '—' }}</td>
            <td class="num">{{ tb.creditBegin > 0 ? formatCurrency(tb.creditBegin) : '—' }}</td>
            <td class="num">{{ tb.debitTurnover > 0 ? formatCurrency(tb.debitTurnover) : '—' }}</td>
            <td class="num">{{ tb.creditTurnover > 0 ? formatCurrency(tb.creditTurnover) : '—' }}</td>
            <td class="num bold">{{ tb.debitEnd > 0 ? formatCurrency(tb.debitEnd) : '—' }}</td>
            <td class="num bold">{{ tb.creditEnd > 0 ? formatCurrency(tb.creditEnd) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Аудит-трейл -->
      <h3 class="subsection-title">Audit Trail (История операций)</h3>
      <div class="audit-trail-filters">
        <input v-model="auditTrailSearch" type="text" placeholder="Поиск по описанию или пользователю..." class="audit-search" />
        <select v-model="auditTrailType" class="admin-select small">
          <option value="all">Все типы</option>
          <option value="capital_call">Capital Call</option>
          <option value="distribution">Distribution</option>
          <option value="expense">Expense</option>
          <option value="fee">Fee</option>
        </select>
      </div>
      <table class="admin-table audit-trail-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Пользователь</th>
            <th>Тип операции</th>
            <th>Описание</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="trail in filteredAuditTrail" :key="trail.id">
            <td class="mono gray">{{ trail.timestamp }}</td>
            <td>{{ trail.user }}</td>
            <td><span class="type-badge" :class="trail.type">{{ trail.type }}</span></td>
            <td>{{ trail.description }}</td>
            <td class="num">{{ trail.amount ? formatCurrency(trail.amount) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════ FSBU 4/2023 -->
    <div v-if="activeTab === 'fsbu'" class="admin-section">
      <h2>Отчётность ФСБУ 4/2023</h2>
      <p class="admin-note">Формы финансовой отчётности в соответствии с новым стандартом (обязателен с 01.01.2025)</p>

      <!-- Нормативная база -->
      <div class="fsbu-info-card">
        <div class="fsbu-info-icon"><i class="pi pi-book"></i></div>
        <div class="fsbu-info-body">
          <div class="fsbu-info-title">Нормативная база</div>
          <ul class="fsbu-info-list">
            <li><strong>ФСБУ 4/2023</strong> «Бухгалтерская (финансовая) отчётность» (обязателен с 01.01.2025)</li>
            <li><strong>ФЗ-402</strong> «О бухгалтерском учёте»</li>
            <li><strong>ФЗ-156</strong> «Об инвестиционных фондах» — требования к УК ПИФ</li>
            <li><strong>Положение ЦБ РФ № 590-П</strong> — оценка активов</li>
          </ul>
        </div>
      </div>

      <!-- Формы отчётности -->
      <h3 class="subsection-title">Формы отчётности</h3>
      <div class="fsbu-forms-grid">
        <div v-for="form in fsbuForms" :key="form.id" class="fsbu-form-card" @click="generateFsbuForm(form.id)">
          <div class="fsbu-form-header">
            <div class="fsbu-form-code">{{ form.code }}</div>
            <span class="status-badge" :class="form.status">{{ form.status === 'ready' ? 'Готов' : 'В процессе' }}</span>
          </div>
          <div class="fsbu-form-title">{{ form.title }}</div>
          <div class="fsbu-form-desc">{{ form.desc }}</div>
          <button class="fsbu-form-btn">
            <i class="pi pi-download"></i>
            Сформировать
          </button>
        </div>
      </div>

      <!-- Отчёт о финансовом положении (баланс) -->
      <h3 class="subsection-title">Отчёт о финансовом положении фонда (упрощённая форма)</h3>
      <table class="admin-table fsbu-balance-table">
        <thead>
          <tr>
            <th>Наименование показателя</th>
            <th>Код</th>
            <th>На {{ selectedPeriod }}</th>
            <th>На предыдущий период</th>
          </tr>
        </thead>
        <tbody>
          <tr class="fsbu-section-header">
            <td colspan="4"><strong>АКТИВЫ</strong></td>
          </tr>
          <tr v-for="asset in fsbuAssets" :key="asset.code">
            <td>{{ asset.name }}</td>
            <td class="mono gray">{{ asset.code }}</td>
            <td class="num">{{ formatCurrency(asset.current) }}</td>
            <td class="num gray">{{ formatCurrency(asset.previous) }}</td>
          </tr>
          <tr class="fsbu-total">
            <td><strong>ИТОГО АКТИВЫ</strong></td>
            <td class="mono gray">1600</td>
            <td class="num bold">{{ formatCurrency(totalAssets) }}</td>
            <td class="num gray bold">{{ formatCurrency(totalAssetsPrevious) }}</td>
          </tr>
          <tr class="fsbu-section-header">
            <td colspan="4"><strong>ПАССИВЫ</strong></td>
          </tr>
          <tr v-for="liability in fsbuLiabilities" :key="liability.code">
            <td>{{ liability.name }}</td>
            <td class="mono gray">{{ liability.code }}</td>
            <td class="num">{{ formatCurrency(liability.current) }}</td>
            <td class="num gray">{{ formatCurrency(liability.previous) }}</td>
          </tr>
          <tr class="fsbu-total">
            <td><strong>ИТОГО ПАССИВЫ</strong></td>
            <td class="mono gray">1700</td>
            <td class="num bold">{{ formatCurrency(totalLiabilities) }}</td>
            <td class="num gray bold">{{ formatCurrency(totalLiabilitiesPrevious) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Add Expense -->
    <div v-if="showAddExpense" class="modal-overlay" @click.self="showAddExpense = false">
      <div class="modal-box">
        <h3>Добавить расход фонда</h3>
        <div class="modal-form">
          <label>Дата</label>
          <input v-model="newExpense.date" type="date" />
          <label>Категория</label>
          <select v-model="newExpense.category">
            <option value="due_diligence">Due Diligence</option>
            <option value="legal">Legal & Compliance</option>
            <option value="travel">Travel & Accommodation</option>
            <option value="admin">Admin & Office</option>
            <option value="audit">Audit & Tax</option>
            <option value="other">Other</option>
          </select>
          <label>Описание</label>
          <input v-model="newExpense.description" placeholder="Краткое описание расхода" />
          <label>Контрагент</label>
          <input v-model="newExpense.counterparty" placeholder="Наименование организации" />
          <label>Сумма, млн ₽</label>
          <input v-model.number="newExpense.amount" type="number" step="0.1" />
        </div>
        <div class="modal-actions">
          <button class="admin-btn secondary" @click="showAddExpense = false">Отмена</button>
          <button class="admin-btn primary" @click="addExpense">Добавить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const activeTab = ref('fees')
const selectedPeriod = ref('Q4 2025')
const showAddExpense = ref(false)
const auditTrailSearch = ref('')
const auditTrailType = ref('all')

const periods = ['Q4 2025', 'Q3 2025', 'Q2 2025', 'Q1 2025', 'Q4 2024', 'Q3 2024']

const tabs = [
  { id: 'fees',     label: 'Management Fee & Carry', icon: 'pi pi-percentage' },
  { id: 'expenses', label: 'Расходы фонда',          icon: 'pi pi-money-bill' },
  { id: 'nav',      label: 'Расчёт NAV',             icon: 'pi pi-calculator' },
  { id: 'banking',  label: 'Банковские операции',    icon: 'pi pi-building-columns' },
  { id: 'audit',    label: 'Аудит',                  icon: 'pi pi-file-check' },
  { id: 'fsbu',     label: 'ФСБУ 4/2023',            icon: 'pi pi-book' },
]

// ══════════════════════════════════════════════════ FUND PARAMS
const fundParams = ref({
  committedCapital: 2120,
  managementFeeRate: 2.0,
  hurdleRate: 8.0,
  carryRate: 20.0,
})

const managementFeeQuarterly = computed(() => {
  return (fundParams.value.committedCapital * fundParams.value.managementFeeRate / 100) / 4
})

const profitAboveHurdle = computed(() => {
  // Simplified calculation: unrealized gains above hurdle
  const hurdle = fundParams.value.committedCapital * (fundParams.value.hurdleRate / 100)
  return Math.max(0, 350 - hurdle)
})

const carriedInterest = computed(() => {
  return profitAboveHurdle.value * (fundParams.value.carryRate / 100)
})

const feeHistory = ref([
  { id: 1, period: 'Q4 2025', type: 'mgmt_fee', amount: 10.6, paymentDate: '2025-12-28', status: 'paid' },
  { id: 2, period: 'Q3 2025', type: 'mgmt_fee', amount: 10.6, paymentDate: '2025-09-30', status: 'paid' },
  { id: 3, period: 'Q2 2025', type: 'mgmt_fee', amount: 10.6, paymentDate: '2025-06-28', status: 'paid' },
  { id: 4, period: 'Q1 2025', type: 'mgmt_fee', amount: 10.6, paymentDate: '2025-03-31', status: 'paid' },
  { id: 5, period: 'Q4 2024', type: 'mgmt_fee', amount: 10.6, paymentDate: '2024-12-30', status: 'paid' },
])

// ════════════════════════════════════════════════════ EXPENSES
const expenses = ref([
  { id: 1, date: '2025-12-15', category: 'due_diligence', description: 'Техническая экспертиза АвиаЛогик', counterparty: 'TechConsult', amount: 1.8, status: 'paid' },
  { id: 2, date: '2025-12-10', category: 'legal', description: 'Юридическое сопровождение сделки', counterparty: 'Правовед Групп', amount: 2.4, status: 'paid' },
  { id: 3, date: '2025-11-28', category: 'travel', description: 'Командировка в Казань (визит в портфельную ко.)', counterparty: 'Аэрофлот', amount: 0.3, status: 'paid' },
  { id: 4, date: '2025-11-20', category: 'audit', description: 'Квартальный аудит E&Y', counterparty: 'Ernst & Young', amount: 4.2, status: 'paid' },
  { id: 5, date: '2025-11-15', category: 'admin', description: 'Аренда офиса УК', counterparty: 'БЦ Москва-Сити', amount: 1.2, status: 'paid' },
  { id: 6, date: '2025-10-30', category: 'due_diligence', description: 'Финансовая экспертиза RoboFarm', counterparty: 'PwC', amount: 2.1, status: 'paid' },
])

const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0))

const expenseCategories = computed(() => {
  const cats = [
    { id: 'due_diligence', label: 'Due Diligence', icon: 'pi pi-search', color: '#667eea', total: 0, pct: 0 },
    { id: 'legal', label: 'Legal & Compliance', icon: 'pi pi-file-check', color: '#fb923c', total: 0, pct: 0 },
    { id: 'travel', label: 'Travel', icon: 'pi pi-map-marker', color: '#34d399', total: 0, pct: 0 },
    { id: 'audit', label: 'Audit & Tax', icon: 'pi pi-calculator', color: '#a78bfa', total: 0, pct: 0 },
    { id: 'admin', label: 'Admin & Office', icon: 'pi pi-building', color: '#22d3ee', total: 0, pct: 0 },
    { id: 'other', label: 'Other', icon: 'pi pi-ellipsis-h', color: '#9ca3af', total: 0, pct: 0 },
  ]

  expenses.value.forEach(e => {
    const cat = cats.find(c => c.id === e.category)
    if (cat) cat.total += e.amount
  })

  const total = totalExpenses.value
  cats.forEach(c => { c.pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : 0 })

  return cats
})

const newExpense = ref({
  date: new Date().toISOString().slice(0, 10),
  category: 'due_diligence',
  description: '',
  counterparty: '',
  amount: 0,
})

function addExpense() {
  expenses.value.push({
    id: Date.now(),
    ...newExpense.value,
    status: 'pending',
  })
  showAddExpense.value = false
  newExpense.value = {
    date: new Date().toISOString().slice(0, 10),
    category: 'due_diligence',
    description: '',
    counterparty: '',
    amount: 0,
  }
}

// ══════════════════════════════════════════════════════ NAV
const deployedCapital = ref(810)
const unrealizedGains = ref(350)
const navCurrent = computed(() => {
  return fundParams.value.committedCapital - deployedCapital.value + unrealizedGains.value
})
const navChangePercent = ref(12.4)

const navRows = ref([
  { label: 'I. Начальный NAV', begin: 1580, change: null, end: null, isSubtitle: true },
  { label: 'Взносы LP (Capital Calls)', begin: null, change: 200, end: null },
  { label: 'Инвестиции в портфельные компании', begin: null, change: -150, end: null },
  { label: 'Возврат капитала (exits)', begin: null, change: 80, end: null },
  { label: 'Management Fee', begin: null, change: -10.6, end: null },
  { label: 'Операционные расходы', begin: null, change: -12.0, end: null },
  { label: 'II. Изменение стоимости инвестиций', begin: null, change: null, end: null, isSubtitle: true },
  { label: 'Нереализованная переоценка портфеля', begin: null, change: 250, end: null },
  { label: 'Реализованная прибыль от выходов', begin: null, change: 42.6, end: null },
  { label: 'FX переоценка (курсовые разницы)', begin: null, change: -5.0, end: null },
  { label: 'III. NAV на конец периода', begin: 1580, change: 395, end: 1975, isTotal: true },
])

// ══════════════════════════════════════════════════ BANKING
const bankAccounts = ref([
  { id: 1, bank: 'Сбербанк', accountNumber: '40701810100000012345', currency: 'RUB', balance: 450.5, status: 'active' },
  { id: 2, bank: 'ВТБ', accountNumber: '40701810200000067890', currency: 'RUB', balance: 280.3, status: 'active' },
  { id: 3, bank: 'Тинькофф Банк', accountNumber: '40701840300000054321', currency: 'USD', balance: 4.2, status: 'active' },
  { id: 4, bank: 'Альфа-Банк', accountNumber: '40701978400000098765', currency: 'EUR', balance: 1.8, status: 'active' },
])

const capitalCalls = ref([
  { id: 1, noticeDate: '2025-11-01', investor: 'Росатом', requested: 300, received: 300, receivedDate: '2025-11-15', status: 'received' },
  { id: 2, noticeDate: '2025-11-01', investor: 'ВЭБ.РФ', requested: 200, received: 200, receivedDate: '2025-11-18', status: 'received' },
  { id: 3, noticeDate: '2025-12-10', investor: 'Сколково', requested: 150, received: 0, receivedDate: null, status: 'pending' },
])

const distributions = ref([
  { id: 1, date: '2025-10-15', investor: 'Росатом', type: 'dividend', amount: 25, status: 'paid' },
  { id: 2, date: '2025-10-15', investor: 'ВЭБ.РФ', type: 'dividend', amount: 18, status: 'paid' },
  { id: 3, date: '2025-09-20', investor: 'Частные LP', type: 'return_capital', amount: 12, status: 'paid' },
])

// ════════════════════════════════════════════════════ AUDIT
const auditDocs = ref([
  { id: 'trial_balance', title: 'Trial Balance', desc: 'Оборотно-сальдовая ведомость', icon: 'pi pi-table', color: '#667eea', status: 'ready' },
  { id: 'reconciliation', title: 'LP Account Reconciliation', desc: 'Сверка счетов инвесторов', icon: 'pi pi-users', color: '#fb923c', status: 'ready' },
  { id: 'capital_activity', title: 'Capital Activity Statement', desc: 'Отчёт о движении капитала', icon: 'pi pi-chart-line', color: '#34d399', status: 'ready' },
  { id: 'investment_schedule', title: 'Investment Schedule', desc: 'Расшифровка инвестиций', icon: 'pi pi-list', color: '#22d3ee', status: 'ready' },
  { id: 'expense_detail', title: 'Expense Detail', desc: 'Детализация расходов фонда', icon: 'pi pi-money-bill', color: '#a78bfa', status: 'ready' },
  { id: 'valuation_report', title: 'Valuation Report', desc: 'Отчёт об оценке портфеля', icon: 'pi pi-chart-bar', color: '#f87171', status: 'progress' },
])

const trialBalance = ref([
  { account: '01', name: 'Основные средства', debitBegin: 5.2, creditBegin: 0, debitTurnover: 0.8, creditTurnover: 0, debitEnd: 6.0, creditEnd: 0 },
  { account: '50', name: 'Касса', debitBegin: 0.5, creditBegin: 0, debitTurnover: 2.1, creditTurnover: 2.0, debitEnd: 0.6, creditEnd: 0 },
  { account: '51', name: 'Расчётные счета', debitBegin: 420.3, creditBegin: 0, debitTurnover: 500, creditTurnover: 410, debitEnd: 510.3, creditEnd: 0 },
  { account: '58', name: 'Финансовые вложения', debitBegin: 680, creditBegin: 0, debitTurnover: 150, creditTurnover: 80, debitEnd: 750, creditEnd: 0 },
  { account: '60', name: 'Расчёты с поставщиками', debitBegin: 0, creditBegin: 8.5, debitTurnover: 12, creditTurnover: 10.2, debitEnd: 0, creditEnd: 6.7 },
  { account: '80', name: 'Уставный капитал', debitBegin: 0, creditBegin: 2120, debitTurnover: 0, creditTurnover: 0, debitEnd: 0, creditEnd: 2120 },
])

const auditTrail = ref([
  { id: 1, timestamp: '2025-12-15 14:32:18', user: 'Иванов А.П.', type: 'capital_call', description: 'Capital call от Сколково: 150 млн ₽', amount: 150 },
  { id: 2, timestamp: '2025-12-10 09:15:42', user: 'Петрова М.С.', type: 'expense', description: 'Расход: Юридическое сопровождение сделки', amount: 2.4 },
  { id: 3, timestamp: '2025-11-28 16:48:03', user: 'Сидоров К.В.', type: 'distribution', description: 'Distribution Росатом: дивиденды 25 млн ₽', amount: 25 },
  { id: 4, timestamp: '2025-11-20 11:22:55', user: 'Иванов А.П.', type: 'fee', description: 'Management Fee Q4 2025: 10.6 млн ₽', amount: 10.6 },
  { id: 5, timestamp: '2025-11-15 13:07:19', user: 'Кузнецова Е.Н.', type: 'capital_call', description: 'Получение Capital call от ВЭБ.РФ: 200 млн ₽', amount: 200 },
])

const filteredAuditTrail = computed(() => {
  let filtered = auditTrail.value
  if (auditTrailType.value !== 'all') {
    filtered = filtered.filter(t => t.type === auditTrailType.value)
  }
  if (auditTrailSearch.value) {
    const search = auditTrailSearch.value.toLowerCase()
    filtered = filtered.filter(t =>
      t.description.toLowerCase().includes(search) ||
      t.user.toLowerCase().includes(search)
    )
  }
  return filtered
})

// ══════════════════════════════════════════════ FSBU 4/2023
const fsbuForms = ref([
  { id: 'balance', code: 'Форма 1', title: 'Отчёт о финансовом положении', desc: 'Бухгалтерский баланс фонда', status: 'ready' },
  { id: 'income', code: 'Форма 2', title: 'Отчёт о совокупном доходе', desc: 'Отчёт о прибылях и убытках', status: 'ready' },
  { id: 'equity', code: 'Форма 3', title: 'Отчёт об изменениях капитала', desc: 'Движение собственного капитала', status: 'ready' },
  { id: 'cash', code: 'Форма 4', title: 'Отчёт о движении денежных средств', desc: 'Cash flow statement', status: 'ready' },
  { id: 'notes', code: 'Форма 5', title: 'Примечания к финансовой отчётности', desc: 'Пояснения и раскрытия', status: 'progress' },
])

const fsbuAssets = ref([
  { code: '1110', name: 'Нематериальные активы', current: 2.4, previous: 2.1 },
  { code: '1150', name: 'Основные средства', current: 6.0, previous: 5.2 },
  { code: '1170', name: 'Финансовые вложения', current: 750, previous: 680 },
  { code: '1210', name: 'Запасы', current: 0.8, previous: 0.6 },
  { code: '1250', name: 'Денежные средства и денежные эквиваленты', current: 510.9, previous: 420.8 },
  { code: '1260', name: 'Прочие оборотные активы', current: 8.2, previous: 6.5 },
])

const fsbuLiabilities = ref([
  { code: '1410', name: 'Уставный капитал (committed capital)', current: 2120, previous: 2120 },
  { code: '1420', name: 'Добавочный капитал', current: 0, previous: 0 },
  { code: '1470', name: 'Нераспределённая прибыль (убыток)', current: -852.7, previous: -1012.2 },
  { code: '1510', name: 'Долгосрочные обязательства', current: 0, previous: 0 },
  { code: '1520', name: 'Краткосрочные обязательства', current: 10.9, previous: 8.7 },
])

const totalAssets = computed(() => fsbuAssets.value.reduce((s, a) => s + a.current, 0))
const totalAssetsPrevious = computed(() => fsbuAssets.value.reduce((s, a) => s + a.previous, 0))
const totalLiabilities = computed(() => fsbuLiabilities.value.reduce((s, l) => s + l.current, 0))
const totalLiabilitiesPrevious = computed(() => fsbuLiabilities.value.reduce((s, l) => s + l.previous, 0))

// ══════════════════════════════════════════════ HELPERS
function formatCurrency(val, signed = false) {
  if (val == null) return '—'
  const prefix = signed && val > 0 ? '+' : ''
  return prefix + val.toFixed(1) + ' млн ₽'
}

function formatAmount(val, currency) {
  return val.toFixed(1) + ' млн ' + currency
}

function feeTypeLabel(t) {
  return { mgmt_fee: 'Management Fee', carry: 'Carried Interest' }[t] || t
}

function statusLabel(s) {
  return { paid: 'Оплачено', pending: 'Ожидание', accrued: 'Начислено', received: 'Получено', progress: 'В процессе', ready: 'Готов' }[s] || s
}

function categoryLabel(c) {
  return {
    due_diligence: 'Due Diligence',
    legal: 'Legal',
    travel: 'Travel',
    admin: 'Admin',
    audit: 'Audit',
    other: 'Other',
  }[c] || c
}

function capitalCallStatus(s) {
  return { received: 'Получено', pending: 'Ожидание', partial: 'Частично' }[s] || s
}

function distributionType(t) {
  return { dividend: 'Дивиденды', return_capital: 'Возврат капитала', exit_proceeds: 'Выход' }[t] || t
}

function loadPeriodData() {
  // Stub: reload data for selected period
}

function exportReport() {
  alert('Экспорт управленческого отчёта за ' + selectedPeriod.value)
}

function generateAudit() {
  alert('Генерация полного аудиторского пакета для Ernst & Young')
}

function generateDoc(docId) {
  alert('Генерация документа: ' + docId)
}

function generateFsbuForm(formId) {
  alert('Формирование отчётности ФСБУ 4/2023: ' + formId)
}
</script>

<style scoped>
.admin-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.admin-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.admin-header h1 { margin: 0; font-size: 1.5rem; color: var(--p-text-color); }
.admin-subtitle { font-size: 0.85rem; color: var(--p-text-muted-color); }
.admin-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.admin-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.83rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.admin-btn.primary  { background: var(--p-primary-color); color: #fff; }
.admin-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }
.admin-btn.small { padding: 5px 10px; font-size: 0.78rem; }
.admin-select { padding: 7px 10px; border-radius: 7px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-color); font-size: 0.83rem; }
.admin-select.small { padding: 5px 8px; font-size: 0.78rem; }

.admin-tabs { display: flex; gap: 4px; flex-wrap: wrap; overflow-x: auto; }
.admin-tab { padding: 9px 16px; border-radius: 7px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.admin-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.admin-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 20px; }
.admin-section h2 { margin: 0 0 8px; font-size: 1.1rem; color: var(--p-text-color); }
.admin-note { font-size: 0.8rem; color: var(--p-text-muted-color); margin: 0 0 18px; }
.subsection-title { font-size: 0.95rem; margin: 20px 0 12px; color: var(--p-text-color); }

/* Fees */
.fee-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }
.fee-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 16px; }
.fee-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.fee-card-header h3 { margin: 0; font-size: 0.95rem; color: var(--p-text-color); }
.fee-badge { padding: 3px 10px; border-radius: 5px; font-size: 0.72rem; font-weight: 600; background: var(--p-primary-color); color: #fff; }
.fee-badge.orange { background: #ff9800; }
.fee-calc { display: flex; flex-direction: column; gap: 8px; }
.fee-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
.fee-row.total { font-size: 0.9rem; }
.fee-label { color: var(--p-text-muted-color); }
.fee-val { color: var(--p-text-color); font-weight: 600; }
.fee-separator { height: 1px; background: var(--p-surface-border); margin: 6px 0; }

/* Expenses */
.expense-add-bar { margin-bottom: 16px; }
.expense-categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.expense-cat-card { display: flex; align-items: center; gap: 12px; background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 12px; }
.expense-cat-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
.expense-cat-body { flex: 1; }
.expense-cat-label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.expense-cat-amount { font-size: 0.95rem; font-weight: 700; color: var(--p-text-color); }
.expense-cat-pct { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* NAV */
.nav-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
.nav-metric-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; }
.nav-metric-card.primary { background: linear-gradient(135deg, var(--p-primary-color)22 0%, var(--p-surface-ground) 100%); border-color: var(--p-primary-color); }
.nav-metric-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 6px; }
.nav-metric-value { font-size: 1.3rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 4px; }
.nav-metric-change { font-size: 0.78rem; font-weight: 600; }

/* Tables */
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.admin-table th { padding: 8px 12px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.75rem; font-weight: 600; }
.admin-table td { padding: 9px 12px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.admin-table tfoot td { border-top: 2px solid var(--p-surface-border); border-bottom: none; background: var(--p-surface-ground); padding-top: 12px; }
.admin-table tr.nav-total, .admin-table tr.fsbu-total { background: var(--p-surface-ground); }
.admin-table tr.nav-subtitle td, .admin-table tr.fsbu-section-header td { color: var(--p-text-muted-color); font-style: italic; font-size: 0.8rem; background: var(--p-surface-ground); padding-top: 12px; font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: 'Courier New', monospace; font-size: 0.8rem; }
.bold { font-weight: 700; }
.gray { color: var(--p-text-muted-color); }
.green { color: #66bb6a; }
.red { color: #ef5350; }
.orange { color: #ff9800; }
.blue { color: #42a5f5; }

/* Badges */
.status-badge, .type-badge, .cat-badge { padding: 3px 9px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
.status-badge.paid, .status-badge.received, .status-badge.ready { background: #66bb6a22; color: #66bb6a; }
.status-badge.pending { background: #ff980022; color: #ff9800; }
.status-badge.accrued, .status-badge.progress { background: #42a5f522; color: #42a5f5; }
.status-badge.active { background: #66bb6a22; color: #66bb6a; }
.type-badge.mgmt_fee { background: #667eea22; color: #667eea; }
.type-badge.carry { background: #ff980022; color: #ff9800; }
.type-badge.dividend { background: #66bb6a22; color: #66bb6a; }
.type-badge.return_capital { background: #42a5f522; color: #42a5f5; }
.type-badge.capital_call { background: #667eea22; color: #667eea; }
.type-badge.distribution { background: #66bb6a22; color: #66bb6a; }
.type-badge.expense { background: #ef535022; color: #ef5350; }
.type-badge.fee { background: #ff980022; color: #ff9800; }
.cat-badge.due_diligence { background: #667eea22; color: #667eea; }
.cat-badge.legal { background: #fb923c22; color: #fb923c; }
.cat-badge.travel { background: #34d39922; color: #34d399; }
.cat-badge.audit { background: #a78bfa22; color: #a78bfa; }
.cat-badge.admin { background: #22d3ee22; color: #22d3ee; }
.cat-badge.other { background: #9ca3af22; color: #9ca3af; }

/* Banking */
.account-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 24px; }
.account-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; }
.account-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.account-bank { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.account-currency { padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; background: var(--p-primary-color); color: #fff; }
.account-number { font-family: 'Courier New', monospace; font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 10px; }
.account-balance { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.account-balance-label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.account-balance-val { font-size: 1.1rem; font-weight: 700; color: var(--p-text-color); }
.account-status { margin-top: 8px; }

/* Audit */
.audit-docs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 24px; }
.audit-doc-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s; }
.audit-doc-card:hover { border-color: var(--p-primary-color); transform: translateY(-2px); }
.audit-doc-icon { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 10px; }
.audit-doc-body { margin-bottom: 12px; }
.audit-doc-title { font-size: 0.9rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 4px; }
.audit-doc-desc { font-size: 0.75rem; color: var(--p-text-muted-color); }
.audit-doc-status { margin-bottom: 8px; }

.audit-trail-filters { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.audit-search { flex: 1; min-width: 200px; padding: 7px 12px; border-radius: 7px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-color); font-size: 0.83rem; }

/* FSBU */
.fsbu-info-card { display: flex; gap: 16px; background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 16px; margin-bottom: 24px; }
.fsbu-info-icon { font-size: 2rem; color: var(--p-primary-color); }
.fsbu-info-body { flex: 1; }
.fsbu-info-title { font-size: 0.95rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 8px; }
.fsbu-info-list { margin: 0; padding-left: 20px; font-size: 0.8rem; color: var(--p-text-muted-color); }
.fsbu-info-list li { margin-bottom: 4px; }

.fsbu-forms-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 24px; }
.fsbu-form-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s; }
.fsbu-form-card:hover { border-color: var(--p-primary-color); transform: translateY(-2px); }
.fsbu-form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fsbu-form-code { font-family: 'Courier New', monospace; font-size: 0.75rem; font-weight: 700; color: var(--p-primary-color); }
.fsbu-form-title { font-size: 0.9rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 6px; }
.fsbu-form-desc { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 12px; }
.fsbu-form-btn { width: 100%; padding: 7px 12px; border-radius: 6px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-color); font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
.fsbu-form-btn:hover { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--p-content-background); border-radius: 12px; padding: 24px; width: 450px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; font-size: 1rem; color: var(--p-text-color); }
.modal-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.modal-form label { font-size: 0.78rem; color: var(--p-text-muted-color); font-weight: 600; }
.modal-form input, .modal-form select { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 8px 12px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>

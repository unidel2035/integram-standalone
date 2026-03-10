<template>
  <FstPageLayout title="Бэк-офис фонда" subtitle="Управленческий учёт и ФСБУ 4/2023">
    <template #actions>
      <select v-model="selectedPeriod" class="admin-select" @change="loadData">
          <option v-for="p in periods" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="admin-btn secondary" @click="exportToExcel">Экспорт в Excel</button>
        <button class="admin-btn primary" @click="generateAuditPackage">Аудиторский пакет</button>
    </template>

    <!-- Статус ФСБУ 4/2023 -->
    <div class="admin-compliance-bar">
      <div class="compliance-title">Соответствие ФСБУ 4/2023</div>
      <div v-for="s in complianceStatus" :key="s.label" class="compliance-item">
        <div class="compliance-icon" :class="s.status">{{ s.status === 'ok' ? '✓' : s.status === 'warning' ? '!' : '○' }}</div>
        <div class="compliance-label">{{ s.label }}</div>
        <div class="compliance-date">{{ s.date }}</div>
      </div>
    </div>

    <!-- Навигация по секциям -->
    <div class="admin-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['admin-tab', { active: activeTab === t.id }]" @click="activeTab = t.id">
        {{ t.label }}
      </button>
    </div>

    <!-- Management Fee -->
    <div v-if="activeTab === 'mgmt-fee'" class="admin-section">
      <h2>Management Fee — Вознаграждение УК</h2>
      <div class="admin-params-card">
        <h3>Параметры начисления</h3>
        <div class="params-grid">
          <div class="param-field">
            <label>Committed Capital, млн ₽</label>
            <input v-model.number="mgmtFee.committedCapital" type="number" step="100" @input="calcMgmtFee" />
          </div>
          <div class="param-field">
            <label>Ставка Management Fee, %</label>
            <input v-model.number="mgmtFee.rate" type="number" step="0.1" @input="calcMgmtFee" />
          </div>
          <div class="param-field">
            <label>Период начисления</label>
            <select v-model="mgmtFee.period" @change="calcMgmtFee">
              <option value="annual">Ежегодно</option>
              <option value="quarterly">Ежеквартально</option>
              <option value="monthly">Ежемесячно</option>
            </select>
          </div>
          <div class="param-field">
            <label>Дата начала</label>
            <input v-model="mgmtFee.startDate" type="date" @change="calcMgmtFee" />
          </div>
        </div>
      </div>

      <div class="admin-result-card">
        <h3>Расчёт Management Fee</h3>
        <div class="mgmt-fee-calc">
          <div class="calc-item">
            <span class="calc-label">Committed Capital:</span>
            <span class="calc-value">{{ formatNum(mgmtFee.committedCapital) }} млн ₽</span>
          </div>
          <div class="calc-item">
            <span class="calc-label">Ставка:</span>
            <span class="calc-value">{{ mgmtFee.rate }}%</span>
          </div>
          <div class="calc-item highlight">
            <span class="calc-label">Годовое начисление:</span>
            <span class="calc-value bold">{{ formatNum(mgmtFee.annualAmount) }} млн ₽</span>
          </div>
          <div class="calc-item">
            <span class="calc-label">{{ mgmtFee.period === 'quarterly' ? 'Квартальное' : 'Месячное' }} начисление:</span>
            <span class="calc-value">{{ formatNum(mgmtFee.periodAmount) }} млн ₽</span>
          </div>
        </div>

        <h4>График начислений {{ selectedPeriod }}</h4>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Период</th>
              <th>Дата начисления</th>
              <th>Сумма, млн ₽</th>
              <th>Дата оплаты</th>
              <th>Оплачено, млн ₽</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mgmtFeeSchedule" :key="row.period">
              <td>{{ row.period }}</td>
              <td>{{ row.accrualDate }}</td>
              <td class="num">{{ formatNum(row.amount) }}</td>
              <td>{{ row.paymentDate || '—' }}</td>
              <td class="num">{{ row.paid ? formatNum(row.amount) : '—' }}</td>
              <td><span class="status-badge" :class="row.status">{{ statusLabel(row.status) }}</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><strong>Итого за {{ selectedPeriod }}</strong></td>
              <td class="num bold">{{ formatNum(mgmtFeeTotal.accrued) }}</td>
              <td></td>
              <td class="num bold">{{ formatNum(mgmtFeeTotal.paid) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Fund Expenses -->
    <div v-if="activeTab === 'expenses'" class="admin-section">
      <h2>Расходы фонда</h2>
      <div class="admin-actions-bar">
        <button class="admin-btn primary small" @click="showAddExpense = true">+ Добавить расход</button>
        <div class="filter-group">
          <label>Категория:</label>
          <select v-model="expenseFilter.category">
            <option value="">Все</option>
            <option value="due-diligence">Due Diligence</option>
            <option value="legal">Юридические</option>
            <option value="travel">Командировки</option>
            <option value="admin">Административные</option>
            <option value="audit">Аудит</option>
            <option value="marketing">Маркетинг</option>
          </select>
        </div>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Категория</th>
            <th>Описание</th>
            <th>Контрагент</th>
            <th>Сумма, ₽</th>
            <th>Статус</th>
            <th>Документы</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in filteredExpenses" :key="e.id">
            <td>{{ e.date }}</td>
            <td><span class="category-badge" :class="e.category">{{ categoryLabel(e.category) }}</span></td>
            <td>{{ e.description }}</td>
            <td class="gray">{{ e.counterparty }}</td>
            <td class="num">{{ formatNum(e.amount) }}</td>
            <td><span class="status-badge" :class="e.status">{{ statusLabel(e.status) }}</span></td>
            <td>
              <button class="link-btn" @click="viewDocs(e.id)">{{ e.docCount }} файл(ов)</button>
            </td>
            <td>
              <button class="action-btn" @click="editExpense(e.id)">✎</button>
              <button class="action-btn del" @click="deleteExpense(e.id)">✕</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4"><strong>Итого {{ selectedPeriod }}</strong></td>
            <td class="num bold">{{ formatNum(expensesTotal) }}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>

      <div class="expenses-chart-card">
        <h3>Расходы по категориям</h3>
        <div class="expenses-breakdown">
          <div v-for="cat in expensesByCategory" :key="cat.category" class="exp-cat-item">
            <div class="exp-cat-label">{{ cat.label }}</div>
            <div class="exp-cat-bar-wrap">
              <div class="exp-cat-bar" :style="{ width: cat.pct + '%', background: cat.color }"></div>
            </div>
            <div class="exp-cat-value">{{ formatNum(cat.amount) }} млн ₽ ({{ cat.pct.toFixed(1) }}%)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Carried Interest -->
    <div v-if="activeTab === 'carry'" class="admin-section">
      <h2>Carried Interest — Участие УК в прибыли</h2>
      <div class="admin-params-card">
        <h3>Параметры Carried Interest</h3>
        <div class="params-grid">
          <div class="param-field">
            <label>Hurdle Rate, %</label>
            <input v-model.number="carry.hurdleRate" type="number" step="0.5" @input="calcCarry" />
          </div>
          <div class="param-field">
            <label>Carried Interest, %</label>
            <input v-model.number="carry.carryRate" type="number" step="1" @input="calcCarry" />
          </div>
          <div class="param-field">
            <label>Метод расчёта</label>
            <select v-model="carry.method" @change="calcCarry">
              <option value="european">European (по фонду целиком)</option>
              <option value="american">American (по каждой сделке)</option>
            </select>
          </div>
          <div class="param-field">
            <label>Clawback provision</label>
            <input type="checkbox" v-model="carry.clawback" @change="calcCarry" />
          </div>
        </div>
      </div>

      <div class="admin-result-card">
        <h3>Расчёт Carried Interest</h3>
        <div class="carry-calc">
          <div class="carry-step">
            <div class="carry-step-num">1</div>
            <div class="carry-step-body">
              <div class="carry-step-label">Общие взносы LP</div>
              <div class="carry-step-value">{{ formatNum(carry.totalContributions) }} млн ₽</div>
            </div>
          </div>
          <div class="carry-step">
            <div class="carry-step-num">2</div>
            <div class="carry-step-body">
              <div class="carry-step-label">Preferred Return ({{ carry.hurdleRate }}%)</div>
              <div class="carry-step-value">{{ formatNum(carry.preferredReturn) }} млн ₽</div>
            </div>
          </div>
          <div class="carry-step">
            <div class="carry-step-num">3</div>
            <div class="carry-step-body">
              <div class="carry-step-label">Текущая стоимость портфеля + реализованная прибыль</div>
              <div class="carry-step-value">{{ formatNum(carry.currentValue) }} млн ₽</div>
            </div>
          </div>
          <div class="carry-step highlight">
            <div class="carry-step-num">4</div>
            <div class="carry-step-body">
              <div class="carry-step-label">Профит сверх hurdle</div>
              <div class="carry-step-value bold">{{ formatNum(carry.profitAboveHurdle) }} млн ₽</div>
            </div>
          </div>
          <div class="carry-step final">
            <div class="carry-step-num">5</div>
            <div class="carry-step-body">
              <div class="carry-step-label">Carried Interest ({{ carry.carryRate }}%)</div>
              <div class="carry-step-value bold green">{{ formatNum(carry.carryAmount) }} млн ₽</div>
            </div>
          </div>
        </div>

        <div class="carry-notice">
          <strong>Примечание:</strong> Carried Interest начисляется, но не выплачивается до момента реализации портфеля (exit events). Clawback provision {{ carry.clawback ? 'активен' : 'не активен' }}.
        </div>
      </div>
    </div>

    <!-- NAV Calculation -->
    <div v-if="activeTab === 'nav'" class="admin-section">
      <h2>NAV — Net Asset Value фонда</h2>
      <div class="nav-period-select">
        <label>Отчётная дата:</label>
        <input v-model="nav.reportDate" type="date" @change="calcNav" />
        <button class="admin-btn secondary small" @click="calcNav">Пересчитать NAV</button>
      </div>

      <div class="admin-result-card">
        <h3>Расчёт NAV на {{ nav.reportDate }}</h3>
        <table class="admin-table nav-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th>Сумма, млн ₽</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            <tr class="nav-section-header">
              <td colspan="3"><strong>АКТИВЫ</strong></td>
            </tr>
            <tr>
              <td>Инвестиции в портфельные компании (справедливая стоимость)</td>
              <td class="num">{{ formatNum(nav.portfolioFairValue) }}</td>
              <td class="gray">Оценка по ЦБ РФ № 590-П</td>
            </tr>
            <tr>
              <td>Денежные средства на счетах</td>
              <td class="num">{{ formatNum(nav.cash) }}</td>
              <td class="gray">{{ nav.accounts.length }} счет(ов)</td>
            </tr>
            <tr>
              <td>Дебиторская задолженность</td>
              <td class="num">{{ formatNum(nav.receivables) }}</td>
              <td class="gray">Capital calls к получению</td>
            </tr>
            <tr>
              <td>Прочие активы</td>
              <td class="num">{{ formatNum(nav.otherAssets) }}</td>
              <td class="gray"></td>
            </tr>
            <tr class="nav-subtotal">
              <td><strong>Всего активов</strong></td>
              <td class="num bold">{{ formatNum(nav.totalAssets) }}</td>
              <td></td>
            </tr>
            <tr class="nav-section-header">
              <td colspan="3"><strong>ОБЯЗАТЕЛЬСТВА</strong></td>
            </tr>
            <tr>
              <td>Кредиторская задолженность</td>
              <td class="num">{{ formatNum(nav.payables) }}</td>
              <td class="gray">Неоплаченные расходы</td>
            </tr>
            <tr>
              <td>Начисленный, но не оплаченный Management Fee</td>
              <td class="num">{{ formatNum(nav.accruedMgmtFee) }}</td>
              <td class="gray"></td>
            </tr>
            <tr>
              <td>Прочие обязательства</td>
              <td class="num">{{ formatNum(nav.otherLiabilities) }}</td>
              <td class="gray"></td>
            </tr>
            <tr class="nav-subtotal">
              <td><strong>Всего обязательств</strong></td>
              <td class="num bold">{{ formatNum(nav.totalLiabilities) }}</td>
              <td></td>
            </tr>
            <tr class="nav-total">
              <td><strong>NET ASSET VALUE (NAV)</strong></td>
              <td class="num bold green">{{ formatNum(nav.netAssetValue) }}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="nav-metrics">
          <div class="nav-metric">
            <div class="nav-metric-label">NAV per LP Share</div>
            <div class="nav-metric-value">{{ formatNum(nav.navPerShare) }} ₽</div>
          </div>
          <div class="nav-metric">
            <div class="nav-metric-label">Изменение NAV за квартал</div>
            <div class="nav-metric-value" :class="nav.quarterChange >= 0 ? 'green' : 'red'">{{ nav.quarterChange >= 0 ? '+' : '' }}{{ nav.quarterChange.toFixed(2) }}%</div>
          </div>
          <div class="nav-metric">
            <div class="nav-metric-label">Изменение NAV с начала года</div>
            <div class="nav-metric-value" :class="nav.ytdChange >= 0 ? 'green' : 'red'">{{ nav.ytdChange >= 0 ? '+' : '' }}{{ nav.ytdChange.toFixed(2) }}%</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bank Operations -->
    <div v-if="activeTab === 'banking'" class="admin-section">
      <h2>Банковские операции</h2>

      <div class="admin-subsection">
        <h3>Счета фонда</h3>
        <div class="bank-accounts">
          <div v-for="acc in bankAccounts" :key="acc.id" class="bank-account-card">
            <div class="ba-header">
              <div class="ba-bank">{{ acc.bank }}</div>
              <div class="ba-currency">{{ acc.currency }}</div>
            </div>
            <div class="ba-number">{{ acc.number }}</div>
            <div class="ba-balance">{{ formatNum(acc.balance) }} {{ acc.currency }}</div>
            <div class="ba-updated">Обновлено: {{ acc.lastUpdate }}</div>
          </div>
          <div class="bank-account-card add-new" @click="showAddAccount = true">
            <div class="add-icon">+</div>
            <div class="add-label">Добавить счёт</div>
          </div>
        </div>
      </div>

      <div class="admin-subsection">
        <h3>Capital Calls — Вызовы капитала</h3>
        <button class="admin-btn primary small" @click="showCreateCapitalCall = true">+ Создать Capital Call</button>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Дата уведомления</th>
              <th>Дата платежа</th>
              <th>Общая сумма, млн ₽</th>
              <th>Получено, млн ₽</th>
              <th>Статус</th>
              <th>LP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cc in capitalCalls" :key="cc.id">
              <td>{{ cc.noticeDate }}</td>
              <td>{{ cc.dueDate }}</td>
              <td class="num">{{ formatNum(cc.totalAmount) }}</td>
              <td class="num">{{ formatNum(cc.receivedAmount) }}</td>
              <td><span class="status-badge" :class="cc.status">{{ statusLabel(cc.status) }}</span></td>
              <td class="gray">{{ cc.lpCount }} LP</td>
              <td>
                <button class="link-btn" @click="viewCapitalCallDetails(cc.id)">Детали</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-subsection">
        <h3>Distributions — Распределения</h3>
        <button class="admin-btn primary small" @click="showCreateDistribution = true">+ Создать Distribution</button>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Дата уведомления</th>
              <th>Дата выплаты</th>
              <th>Общая сумма, млн ₽</th>
              <th>Выплачено, млн ₽</th>
              <th>Тип</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in distributions" :key="d.id">
              <td>{{ d.noticeDate }}</td>
              <td>{{ d.paymentDate }}</td>
              <td class="num">{{ formatNum(d.totalAmount) }}</td>
              <td class="num">{{ formatNum(d.paidAmount) }}</td>
              <td><span class="type-badge" :class="d.type">{{ distributionTypeLabel(d.type) }}</span></td>
              <td><span class="status-badge" :class="d.status">{{ statusLabel(d.status) }}</span></td>
              <td>
                <button class="link-btn" @click="viewDistributionDetails(d.id)">Детали</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Audit Support -->
    <div v-if="activeTab === 'audit'" class="admin-section">
      <h2>Аудиторская поддержка</h2>

      <div class="audit-package-status">
        <h3>Статус подготовки аудиторского пакета {{ selectedPeriod }}</h3>
        <div class="audit-checklist">
          <div v-for="item in auditChecklist" :key="item.id" class="audit-check-item">
            <input type="checkbox" :id="'audit-' + item.id" v-model="item.completed" />
            <label :for="'audit-' + item.id">{{ item.label }}</label>
            <span class="audit-resp">{{ item.responsible }}</span>
            <span class="audit-deadline" :class="{ overdue: item.overdue }">{{ item.deadline }}</span>
          </div>
        </div>
      </div>

      <div class="admin-subsection">
        <h3>Trial Balance (Оборотно-сальдовая ведомость)</h3>
        <table class="admin-table trial-balance-table">
          <thead>
            <tr>
              <th>Счёт</th>
              <th>Наименование</th>
              <th>Дебет начало</th>
              <th>Кредит начало</th>
              <th>Дебет оборот</th>
              <th>Кредит оборот</th>
              <th>Дебет конец</th>
              <th>Кредит конец</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in trialBalance" :key="row.account">
              <td>{{ row.account }}</td>
              <td>{{ row.name }}</td>
              <td class="num">{{ formatNum(row.debitBegin) }}</td>
              <td class="num">{{ formatNum(row.creditBegin) }}</td>
              <td class="num">{{ formatNum(row.debitTurnover) }}</td>
              <td class="num">{{ formatNum(row.creditTurnover) }}</td>
              <td class="num">{{ formatNum(row.debitEnd) }}</td>
              <td class="num">{{ formatNum(row.creditEnd) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><strong>Итого</strong></td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.debitBegin) }}</td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.creditBegin) }}</td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.debitTurnover) }}</td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.creditTurnover) }}</td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.debitEnd) }}</td>
              <td class="num bold">{{ formatNum(trialBalanceTotal.creditEnd) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="admin-subsection">
        <h3>LP Account Reconciliation</h3>
        <table class="admin-table">
          <thead>
            <tr>
              <th>LP</th>
              <th>Commitment, млн ₽</th>
              <th>Called Capital, млн ₽</th>
              <th>Distributions, млн ₽</th>
              <th>NAV, млн ₽</th>
              <th>Статус сверки</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lp in lpReconciliation" :key="lp.id">
              <td>{{ lp.name }}</td>
              <td class="num">{{ formatNum(lp.commitment) }}</td>
              <td class="num">{{ formatNum(lp.called) }}</td>
              <td class="num">{{ formatNum(lp.distributions) }}</td>
              <td class="num">{{ formatNum(lp.nav) }}</td>
              <td><span class="status-badge" :class="lp.reconciled ? 'ok' : 'warning'">{{ lp.reconciled ? 'Сверено' : 'Требует проверки' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-subsection">
        <h3>Audit Trail — Журнал операций</h3>
        <div class="audit-trail-filters">
          <input v-model="auditTrailFilter.search" type="text" placeholder="Поиск по описанию..." />
          <select v-model="auditTrailFilter.type">
            <option value="">Все типы</option>
            <option value="capital-call">Capital Call</option>
            <option value="distribution">Distribution</option>
            <option value="investment">Инвестиция</option>
            <option value="expense">Расход</option>
            <option value="mgmt-fee">Management Fee</option>
          </select>
        </div>
        <table class="admin-table audit-trail-table">
          <thead>
            <tr>
              <th>Дата/время</th>
              <th>Тип</th>
              <th>Описание</th>
              <th>Сумма, ₽</th>
              <th>Пользователь</th>
              <th>Документ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in filteredAuditTrail" :key="entry.id">
              <td>{{ entry.timestamp }}</td>
              <td><span class="type-badge" :class="entry.type">{{ entry.type }}</span></td>
              <td>{{ entry.description }}</td>
              <td class="num">{{ formatNum(entry.amount) }}</td>
              <td class="gray">{{ entry.user }}</td>
              <td><button v-if="entry.docId" class="link-btn" @click="viewDoc(entry.docId)">Просмотр</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FSBU 4/2023 Reports -->
    <div v-if="activeTab === 'fsbu'" class="admin-section">
      <h2>ФСБУ 4/2023 — Отчётность</h2>

      <div class="fsbu-intro">
        <p><strong>ФСБУ 4/2023</strong> «Бухгалтерская (финансовая) отчётность» обязателен с 01.01.2025. Фонд обязан предоставлять:</p>
        <ul>
          <li>Отчёт о финансовом положении (Баланс)</li>
          <li>Отчёт о совокупном доходе</li>
          <li>Отчёт об изменениях капитала</li>
          <li>Отчёт о движении денежных средств</li>
          <li>Примечания к финансовой отчётности</li>
        </ul>
      </div>

      <div class="admin-subsection">
        <h3>Отчёт о финансовом положении (Баланс)</h3>
        <table class="admin-table fsbu-table">
          <thead>
            <tr>
              <th>Актив</th>
              <th>На {{ nav.reportDate }}</th>
              <th>На начало года</th>
            </tr>
          </thead>
          <tbody>
            <tr class="fsbu-section">
              <td><strong>I. ВНЕОБОРОТНЫЕ АКТИВЫ</strong></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>Финансовые вложения (долгосрочные)</td>
              <td class="num">{{ formatNum(fsbu.balance.longTermInvestments) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.longTermInvestmentsPrev) }}</td>
            </tr>
            <tr class="fsbu-section">
              <td><strong>II. ОБОРОТНЫЕ АКТИВЫ</strong></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>Денежные средства и денежные эквиваленты</td>
              <td class="num">{{ formatNum(fsbu.balance.cash) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.cashPrev) }}</td>
            </tr>
            <tr>
              <td>Дебиторская задолженность</td>
              <td class="num">{{ formatNum(fsbu.balance.receivables) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.receivablesPrev) }}</td>
            </tr>
            <tr class="fsbu-total">
              <td><strong>БАЛАНС (АКТИВЫ)</strong></td>
              <td class="num bold">{{ formatNum(fsbu.balance.totalAssets) }}</td>
              <td class="num bold">{{ formatNum(fsbu.balance.totalAssetsPrev) }}</td>
            </tr>
          </tbody>
        </table>

        <table class="admin-table fsbu-table">
          <thead>
            <tr>
              <th>Пассив</th>
              <th>На {{ nav.reportDate }}</th>
              <th>На начало года</th>
            </tr>
          </thead>
          <tbody>
            <tr class="fsbu-section">
              <td><strong>III. КАПИТАЛ И РЕЗЕРВЫ</strong></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>Уставный капитал (фонды LP)</td>
              <td class="num">{{ formatNum(fsbu.balance.capital) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.capitalPrev) }}</td>
            </tr>
            <tr>
              <td>Нераспределённая прибыль (убыток)</td>
              <td class="num">{{ formatNum(fsbu.balance.retainedEarnings) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.retainedEarningsPrev) }}</td>
            </tr>
            <tr class="fsbu-section">
              <td><strong>IV. ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА</strong></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>Отложенные обязательства</td>
              <td class="num">{{ formatNum(fsbu.balance.longTermLiabilities) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.longTermLiabilitiesPrev) }}</td>
            </tr>
            <tr class="fsbu-section">
              <td><strong>V. КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА</strong></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>Кредиторская задолженность</td>
              <td class="num">{{ formatNum(fsbu.balance.payables) }}</td>
              <td class="num">{{ formatNum(fsbu.balance.payablesPrev) }}</td>
            </tr>
            <tr class="fsbu-total">
              <td><strong>БАЛАНС (ПАССИВЫ)</strong></td>
              <td class="num bold">{{ formatNum(fsbu.balance.totalLiabilities) }}</td>
              <td class="num bold">{{ formatNum(fsbu.balance.totalLiabilitiesPrev) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-subsection">
        <h3>Отчёт о совокупном доходе</h3>
        <table class="admin-table fsbu-table">
          <thead>
            <tr>
              <th>Показатель</th>
              <th>За {{ selectedPeriod }}</th>
              <th>За аналогичный период прошлого года</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Доходы от финансовых вложений</td>
              <td class="num green">{{ formatNum(fsbu.income.investmentIncome) }}</td>
              <td class="num">{{ formatNum(fsbu.income.investmentIncomePrev) }}</td>
            </tr>
            <tr>
              <td>Вознаграждение управляющей компании</td>
              <td class="num red">{{ formatNum(fsbu.income.mgmtFee) }}</td>
              <td class="num">{{ formatNum(fsbu.income.mgmtFeePrev) }}</td>
            </tr>
            <tr>
              <td>Прочие расходы</td>
              <td class="num red">{{ formatNum(fsbu.income.otherExpenses) }}</td>
              <td class="num">{{ formatNum(fsbu.income.otherExpensesPrev) }}</td>
            </tr>
            <tr class="fsbu-total">
              <td><strong>Чистая прибыль (убыток)</strong></td>
              <td class="num bold" :class="fsbu.income.netIncome >= 0 ? 'green' : 'red'">{{ formatNum(fsbu.income.netIncome) }}</td>
              <td class="num bold">{{ formatNum(fsbu.income.netIncomePrev) }}</td>
            </tr>
            <tr>
              <td>Прочий совокупный доход</td>
              <td class="num">{{ formatNum(fsbu.income.otherComprehensiveIncome) }}</td>
              <td class="num">{{ formatNum(fsbu.income.otherComprehensiveIncomePrev) }}</td>
            </tr>
            <tr class="fsbu-total">
              <td><strong>Совокупный доход (убыток)</strong></td>
              <td class="num bold" :class="fsbu.income.comprehensiveIncome >= 0 ? 'green' : 'red'">{{ formatNum(fsbu.income.comprehensiveIncome) }}</td>
              <td class="num bold">{{ formatNum(fsbu.income.comprehensiveIncomePrev) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-subsection">
        <h3>Примечания к финансовой отчётности</h3>
        <div class="fsbu-notes">
          <div class="fsbu-note">
            <div class="note-num">1</div>
            <div class="note-body">
              <div class="note-title">Общая информация</div>
              <div class="note-text">Фонд создан в соответствии с ФЗ-156 «Об инвестиционных фондах». Управляющая компания: {{ fsbu.notes.managementCompany }}. Размер фонда: {{ formatNum(fsbu.notes.fundSize) }} млн ₽.</div>
            </div>
          </div>
          <div class="fsbu-note">
            <div class="note-num">2</div>
            <div class="note-body">
              <div class="note-title">Учётная политика</div>
              <div class="note-text">Учёт ведётся в соответствии с ФСБУ 4/2023. Оценка финансовых вложений проводится по справедливой стоимости согласно Положению ЦБ РФ № 590-П.</div>
            </div>
          </div>
          <div class="fsbu-note">
            <div class="note-num">3</div>
            <div class="note-body">
              <div class="note-title">Структура портфеля</div>
              <div class="note-text">Количество портфельных компаний: {{ fsbu.notes.portfolioCount }}. Средний чек инвестиции: {{ formatNum(fsbu.notes.avgInvestment) }} млн ₽. Сектора: БАС ({{ fsbu.notes.sectors.uas }}%), Робототехника ({{ fsbu.notes.sectors.robotics }}%), Микроэлектроника ({{ fsbu.notes.sectors.micro }}%).</div>
            </div>
          </div>
          <div class="fsbu-note">
            <div class="note-num">4</div>
            <div class="note-body">
              <div class="note-title">Вознаграждение управляющей компании</div>
              <div class="note-text">Management Fee: {{ fsbu.notes.mgmtFeeRate }}% от committed capital ежегодно. Carried Interest: {{ fsbu.notes.carryRate }}% от прибыли свыше hurdle rate ({{ fsbu.notes.hurdleRate }}%).</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Expense Modal -->
    <div v-if="showAddExpense" class="modal-overlay" @click.self="showAddExpense = false">
      <div class="modal-box">
        <h3>Добавить расход</h3>
        <div class="modal-form">
          <label>Дата</label>
          <input v-model="newExpense.date" type="date" />
          <label>Категория</label>
          <select v-model="newExpense.category">
            <option value="due-diligence">Due Diligence</option>
            <option value="legal">Юридические</option>
            <option value="travel">Командировки</option>
            <option value="admin">Административные</option>
            <option value="audit">Аудит</option>
            <option value="marketing">Маркетинг</option>
          </select>
          <label>Описание</label>
          <input v-model="newExpense.description" type="text" />
          <label>Контрагент</label>
          <input v-model="newExpense.counterparty" type="text" />
          <label>Сумма, ₽</label>
          <input v-model.number="newExpense.amount" type="number" step="1000" />
        </div>
        <div class="modal-actions">
          <button class="admin-btn secondary" @click="showAddExpense = false">Отмена</button>
          <button class="admin-btn primary" @click="addExpense">Добавить</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { logger } from '@/utils/logger'

const activeTab = ref('mgmt-fee')
const selectedPeriod = ref('2025')

const periods = ['2025', '2024', '2023']

const tabs = [
  { id: 'mgmt-fee', label: 'Management Fee' },
  { id: 'expenses', label: 'Расходы фонда' },
  { id: 'carry', label: 'Carried Interest' },
  { id: 'nav', label: 'NAV' },
  { id: 'banking', label: 'Банк. операции' },
  { id: 'audit', label: 'Аудит' },
  { id: 'fsbu', label: 'ФСБУ 4/2023' }
]

const complianceStatus = ref([
  { label: 'Баланс', status: 'ok', date: 'Q4 2025' },
  { label: 'Отчёт о доходе', status: 'ok', date: 'Q4 2025' },
  { label: 'Изм. капитала', status: 'ok', date: 'Q4 2025' },
  { label: 'Движ. ДС', status: 'warning', date: 'В процессе' },
  { label: 'Примечания', status: 'pending', date: 'Не готово' }
])

// Management Fee
const mgmtFee = ref({
  committedCapital: 2120,
  rate: 2.0,
  period: 'quarterly',
  startDate: '2023-01-01',
  annualAmount: 0,
  periodAmount: 0
})

const mgmtFeeSchedule = ref([
  { period: 'Q1 2025', accrualDate: '01.01.2025', amount: 10.6, paymentDate: '15.01.2025', paid: true, status: 'paid' },
  { period: 'Q2 2025', accrualDate: '01.04.2025', amount: 10.6, paymentDate: '15.04.2025', paid: true, status: 'paid' },
  { period: 'Q3 2025', accrualDate: '01.07.2025', amount: 10.6, paymentDate: '15.07.2025', paid: true, status: 'paid' },
  { period: 'Q4 2025', accrualDate: '01.10.2025', amount: 10.6, paymentDate: null, paid: false, status: 'accrued' }
])

const mgmtFeeTotal = computed(() => {
  const accrued = mgmtFeeSchedule.value.reduce((sum, row) => sum + row.amount, 0)
  const paid = mgmtFeeSchedule.value.filter(r => r.paid).reduce((sum, row) => sum + row.amount, 0)
  return { accrued, paid }
})

function calcMgmtFee() {
  mgmtFee.value.annualAmount = mgmtFee.value.committedCapital * mgmtFee.value.rate / 100
  if (mgmtFee.value.period === 'quarterly') {
    mgmtFee.value.periodAmount = mgmtFee.value.annualAmount / 4
  } else if (mgmtFee.value.period === 'monthly') {
    mgmtFee.value.periodAmount = mgmtFee.value.annualAmount / 12
  } else {
    mgmtFee.value.periodAmount = mgmtFee.value.annualAmount
  }
}
calcMgmtFee()

// Expenses
const showAddExpense = ref(false)
const expenseFilter = ref({ category: '' })
const newExpense = ref({
  date: '',
  category: 'due-diligence',
  description: '',
  counterparty: '',
  amount: 0
})

const expenses = ref([
  { id: 1, date: '15.01.2025', category: 'due-diligence', description: 'DD для ДронТех', counterparty: 'EY', amount: 1.2, status: 'paid', docCount: 3 },
  { id: 2, date: '22.02.2025', category: 'legal', description: 'Юридическое сопровождение сделки', counterparty: 'РСПП Правовед', amount: 0.8, status: 'paid', docCount: 5 },
  { id: 3, date: '10.03.2025', category: 'travel', description: 'Командировка в Казань', counterparty: 'Аэрофлот', amount: 0.15, status: 'paid', docCount: 2 },
  { id: 4, date: '05.04.2025', category: 'audit', description: 'Квартальный аудит Q1', counterparty: 'Ernst & Young', amount: 4.2, status: 'paid', docCount: 1 },
  { id: 5, date: '18.05.2025', category: 'admin', description: 'Аренда офиса', counterparty: 'Москва-Сити', amount: 0.5, status: 'paid', docCount: 1 },
  { id: 6, date: '01.06.2025', category: 'marketing', description: 'Участие в форуме ПМЭФ', counterparty: 'Росконгресс', amount: 0.3, status: 'accrued', docCount: 0 }
])

const filteredExpenses = computed(() => {
  if (!expenseFilter.value.category) return expenses.value
  return expenses.value.filter(e => e.category === expenseFilter.value.category)
})

const expensesTotal = computed(() => {
  return filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0)
})

const expensesByCategory = computed(() => {
  const cats = {}
  expenses.value.forEach(e => {
    if (!cats[e.category]) cats[e.category] = 0
    cats[e.category] += e.amount
  })
  const total = Object.values(cats).reduce((s, v) => s + v, 0)
  const result = []
  const colors = {
    'due-diligence': 'var(--fst-blue)',
    'legal': 'var(--fst-green)',
    'travel': 'var(--fst-brand)',
    'admin': 'var(--fst-purple)',
    'audit': 'var(--fst-red)',
    'marketing': 'var(--fst-cyan)'
  }
  for (const [cat, amt] of Object.entries(cats)) {
    result.push({
      category: cat,
      label: categoryLabel(cat),
      amount: amt,
      pct: (amt / total) * 100,
      color: colors[cat]
    })
  }
  return result.sort((a, b) => b.amount - a.amount)
})

function addExpense() {
  expenses.value.push({
    id: Date.now(),
    ...newExpense.value,
    status: 'accrued',
    docCount: 0
  })
  showAddExpense.value = false
  newExpense.value = { date: '', category: 'due-diligence', description: '', counterparty: '', amount: 0 }
}

function editExpense(id) {
  logger.debug('Edit expense', id)
}

function deleteExpense(id) {
  expenses.value = expenses.value.filter(e => e.id !== id)
}

function viewDocs(id) {
  logger.debug('View docs', id)
}

// Carried Interest
const carry = ref({
  hurdleRate: 8,
  carryRate: 20,
  method: 'european',
  clawback: true,
  totalContributions: 2120,
  preferredReturn: 0,
  currentValue: 2850,
  profitAboveHurdle: 0,
  carryAmount: 0
})

function calcCarry() {
  const years = 3 // example
  carry.value.preferredReturn = carry.value.totalContributions * (1 + carry.value.hurdleRate / 100) ** years
  carry.value.profitAboveHurdle = Math.max(0, carry.value.currentValue - carry.value.preferredReturn)
  carry.value.carryAmount = carry.value.profitAboveHurdle * carry.value.carryRate / 100
}
calcCarry()

// NAV
const nav = ref({
  reportDate: '2025-12-31',
  portfolioFairValue: 1850,
  cash: 520,
  receivables: 180,
  otherAssets: 12,
  totalAssets: 0,
  payables: 28,
  accruedMgmtFee: 10.6,
  otherLiabilities: 5,
  totalLiabilities: 0,
  netAssetValue: 0,
  navPerShare: 0,
  quarterChange: 5.2,
  ytdChange: 12.8,
  accounts: [
    { bank: 'ВТБ', number: '40701...8901', currency: 'RUB' },
    { bank: 'Сбер', number: '40702...4567', currency: 'RUB' }
  ]
})

function calcNav() {
  nav.value.totalAssets = nav.value.portfolioFairValue + nav.value.cash + nav.value.receivables + nav.value.otherAssets
  nav.value.totalLiabilities = nav.value.payables + nav.value.accruedMgmtFee + nav.value.otherLiabilities
  nav.value.netAssetValue = nav.value.totalAssets - nav.value.totalLiabilities
  nav.value.navPerShare = nav.value.netAssetValue / 2.12 // example: 2.12M shares
}
calcNav()

// Banking
const showAddAccount = ref(false)
const showCreateCapitalCall = ref(false)
const showCreateDistribution = ref(false)

const bankAccounts = ref([
  { id: 1, bank: 'ВТБ', number: '40701810538000008901', currency: 'RUB', balance: 320.5, lastUpdate: '07.01.2026' },
  { id: 2, bank: 'Сбербанк', number: '40702810238050014567', currency: 'RUB', balance: 199.5, lastUpdate: '07.01.2026' },
  { id: 3, bank: 'Газпромбанк', number: '40703810538100012345', currency: 'USD', balance: 2.1, lastUpdate: '06.01.2026' }
])

const capitalCalls = ref([
  { id: 1, noticeDate: '01.12.2024', dueDate: '15.12.2024', totalAmount: 600, receivedAmount: 600, status: 'completed', lpCount: 12 },
  { id: 2, noticeDate: '15.03.2025', dueDate: '01.04.2025', totalAmount: 450, receivedAmount: 420, status: 'partial', lpCount: 12 },
  { id: 3, noticeDate: '10.09.2025', dueDate: '25.09.2025', totalAmount: 300, receivedAmount: 0, status: 'pending', lpCount: 12 }
])

const distributions = ref([
  { id: 1, noticeDate: '20.06.2025', paymentDate: '05.07.2025', totalAmount: 180, paidAmount: 180, type: 'realized-profit', status: 'completed' },
  { id: 2, noticeDate: '15.12.2025', paymentDate: '30.12.2025', totalAmount: 25, paidAmount: 0, type: 'return-of-capital', status: 'pending' }
])

function viewCapitalCallDetails(id) {
  logger.debug('Capital call details', id)
}

function viewDistributionDetails(id) {
  logger.debug('Distribution details', id)
}

// Audit
const auditChecklist = ref([
  { id: 1, label: 'Trial Balance готов', completed: true, responsible: 'Бухгалтерия', deadline: '15.01.2026', overdue: false },
  { id: 2, label: 'LP Account Reconciliation выполнена', completed: true, responsible: 'Бухгалтерия', deadline: '20.01.2026', overdue: false },
  { id: 3, label: 'Портфельные оценки обновлены', completed: false, responsible: 'Инвест. команда', deadline: '25.01.2026', overdue: false },
  { id: 4, label: 'Документы по сделкам собраны', completed: false, responsible: 'Юрист', deadline: '30.01.2026', overdue: false },
  { id: 5, label: 'Финансовая отчётность ФСБУ 4/2023', completed: false, responsible: 'Директор', deadline: '05.02.2026', overdue: false }
])

const trialBalance = ref([
  { account: '01', name: 'Основные средства', debitBegin: 5.2, creditBegin: 0, debitTurnover: 1.2, creditTurnover: 0, debitEnd: 6.4, creditEnd: 0 },
  { account: '50', name: 'Касса', debitBegin: 0.05, creditBegin: 0, debitTurnover: 2.1, creditTurnover: 1.8, debitEnd: 0.35, creditEnd: 0 },
  { account: '51', name: 'Расчётные счета', debitBegin: 480, creditBegin: 0, debitTurnover: 1200, creditTurnover: 1160, debitEnd: 520, creditEnd: 0 },
  { account: '58', name: 'Финансовые вложения', debitBegin: 1620, creditBegin: 0, debitTurnover: 350, creditTurnover: 120, debitEnd: 1850, creditEnd: 0 },
  { account: '60', name: 'Расчёты с поставщиками', debitBegin: 0, creditBegin: 18, debitTurnover: 15, creditTurnover: 25, debitEnd: 0, creditEnd: 28 },
  { account: '80', name: 'Уставный капитал', debitBegin: 0, creditBegin: 2000, debitTurnover: 0, creditTurnover: 120, debitEnd: 0, creditEnd: 2120 }
])

const trialBalanceTotal = computed(() => {
  return trialBalance.value.reduce((acc, row) => ({
    debitBegin: acc.debitBegin + row.debitBegin,
    creditBegin: acc.creditBegin + row.creditBegin,
    debitTurnover: acc.debitTurnover + row.debitTurnover,
    creditTurnover: acc.creditTurnover + row.creditTurnover,
    debitEnd: acc.debitEnd + row.debitEnd,
    creditEnd: acc.creditEnd + row.creditEnd
  }), { debitBegin: 0, creditBegin: 0, debitTurnover: 0, creditTurnover: 0, debitEnd: 0, creditEnd: 0 })
})

const lpReconciliation = ref([
  { id: 1, name: 'ВЭБ.РФ', commitment: 600, called: 500, distributions: 50, nav: 520, reconciled: true },
  { id: 2, name: 'РВК', commitment: 400, called: 350, distributions: 30, nav: 360, reconciled: true },
  { id: 3, name: 'Сколково', commitment: 300, called: 280, distributions: 20, nav: 285, reconciled: false },
  { id: 4, name: 'ФРП', commitment: 250, called: 220, distributions: 15, nav: 228, reconciled: true }
])

const auditTrailFilter = ref({ search: '', type: '' })

const auditTrail = ref([
  { id: 1, timestamp: '2025-12-15 14:30:22', type: 'capital-call', description: 'Capital Call #3 создан', amount: 300, user: 'Иванов А.', docId: 'cc-003' },
  { id: 2, timestamp: '2025-11-20 10:15:00', type: 'investment', description: 'Инвестиция в ДронТех — транш 2', amount: 150, user: 'Петрова М.', docId: 'inv-045' },
  { id: 3, timestamp: '2025-10-10 16:45:33', type: 'distribution', description: 'Distribution #1 выполнен', amount: 180, user: 'Сидоров П.', docId: 'dist-001' },
  { id: 4, timestamp: '2025-09-05 09:20:11', type: 'expense', description: 'Оплата аудита Q3', amount: 4.2, user: 'Иванов А.', docId: 'exp-128' },
  { id: 5, timestamp: '2025-07-01 11:00:00', type: 'mgmt-fee', description: 'Management Fee Q3 начислен', amount: 10.6, user: 'Система', docId: null }
])

const filteredAuditTrail = computed(() => {
  let result = auditTrail.value
  if (auditTrailFilter.value.type) {
    result = result.filter(e => e.type === auditTrailFilter.value.type)
  }
  if (auditTrailFilter.value.search) {
    const s = auditTrailFilter.value.search.toLowerCase()
    result = result.filter(e => e.description.toLowerCase().includes(s))
  }
  return result
})

function viewDoc(docId) {
  logger.debug('View document', docId)
}

// FSBU 4/2023
const fsbu = ref({
  balance: {
    longTermInvestments: 1850,
    longTermInvestmentsPrev: 1620,
    cash: 520,
    cashPrev: 480,
    receivables: 180,
    receivablesPrev: 150,
    totalAssets: 2562,
    totalAssetsPrev: 2268,
    capital: 2120,
    capitalPrev: 2000,
    retainedEarnings: 398.4,
    retainedEarningsPrev: 232,
    longTermLiabilities: 0,
    longTermLiabilitiesPrev: 0,
    payables: 28,
    payablesPrev: 18,
    totalLiabilities: 2562,
    totalLiabilitiesPrev: 2268
  },
  income: {
    investmentIncome: 360,
    investmentIncomePrev: 280,
    mgmtFee: 42.4,
    mgmtFeePrev: 40,
    otherExpenses: 7.2,
    otherExpensesPrev: 6.8,
    netIncome: 310.4,
    netIncomePrev: 233.2,
    otherComprehensiveIncome: 0,
    otherComprehensiveIncomePrev: 0,
    comprehensiveIncome: 310.4,
    comprehensiveIncomePrev: 233.2
  },
  notes: {
    managementCompany: 'ООО "УК ФСТ НТИ"',
    fundSize: 2120,
    portfolioCount: 18,
    avgInvestment: 102.8,
    sectors: { uas: 60, robotics: 25, micro: 15 },
    mgmtFeeRate: 2.0,
    carryRate: 20,
    hurdleRate: 8
  }
})

// Helper functions
function formatNum(n) {
  if (n == null) return '—'
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function statusLabel(s) {
  const labels = {
    paid: 'Оплачено',
    accrued: 'Начислено',
    pending: 'Ожидается',
    completed: 'Завершено',
    partial: 'Частично',
    ok: 'OK',
    warning: 'Требует проверки'
  }
  return labels[s] || s
}

function categoryLabel(c) {
  const labels = {
    'due-diligence': 'Due Diligence',
    'legal': 'Юридические',
    'travel': 'Командировки',
    'admin': 'Административные',
    'audit': 'Аудит',
    'marketing': 'Маркетинг'
  }
  return labels[c] || c
}

function distributionTypeLabel(t) {
  const labels = {
    'realized-profit': 'Реализованная прибыль',
    'return-of-capital': 'Возврат капитала',
    'income': 'Доход от портфеля'
  }
  return labels[t] || t
}

function loadData() {
  logger.debug('Load data for', selectedPeriod.value)
}

function exportToExcel() {
  logger.debug('Export to Excel')
}

function generateAuditPackage() {
  logger.debug('Generate audit package')
}
</script>

<style scoped>
.admin-root {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  background: var(--surface-ground);
  min-height: 100vh;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.admin-header h1 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0 0 0.5rem 0;
}

.admin-subtitle {
  color: var(--p-text-muted-color);
  font-size: 1rem;
}

.admin-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.admin-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.admin-btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.admin-btn.primary {
  background: var(--p-primary-color);
  color: white;
}

.admin-btn.primary:hover {
  background: var(--p-primary-600);
}

.admin-btn.secondary {
  background: var(--p-content-border-color);
  color: var(--p-text-color);
}

.admin-btn.secondary:hover {
  background: var(--p-surface-300);
}

.admin-btn.small {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
}

.admin-compliance-bar {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 8px;
  margin-bottom: 1.5rem;
  align-items: center;
  border: 1px solid var(--surface-border);
}

.compliance-title {
  font-weight: 600;
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.compliance-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.compliance-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
}

.compliance-icon.ok {
  background: var(--fst-green);
  color: white;
}

.compliance-icon.warning {
  background: var(--fst-brand);
  color: white;
}

.compliance-icon.pending {
  background: var(--p-surface-300);
  color: var(--p-text-muted-color);
}

.compliance-label {
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.compliance-date {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.admin-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--surface-border);
}

.admin-tab {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.admin-tab:hover {
  color: var(--p-text-color);
  background: var(--surface-card);
}

.admin-tab.active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
}

.admin-section {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 2rem;
  border: 1px solid var(--surface-border);
}

.admin-section h2 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0 0 1.5rem 0;
}

.admin-section h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0 0 1rem 0;
}

.admin-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 1.5rem 0 1rem 0;
}

.admin-params-card, .admin-result-card, .admin-subsection {
  background: var(--surface-card);
  border-radius: 6px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.param-field label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
}

.param-field input, .param-field select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.mgmt-fee-calc {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.calc-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.calc-item.highlight {
  background: var(--p-primary-50);
  padding: 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
}

.calc-label {
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
}

.calc-value {
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.calc-value.bold {
  font-weight: 700;
  font-size: 1.1rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface-card);
  font-size: 0.9rem;
}

.admin-table th {
  background: var(--surface-card);
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--p-text-color);
  border-bottom: 2px solid var(--surface-border);
}

.admin-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
  color: var(--p-text-color);
}

.admin-table tbody tr:hover {
  background: var(--surface-card);
}

.admin-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.admin-table .bold {
  font-weight: 700;
}

.admin-table .gray {
  color: var(--p-text-muted-color);
}

.admin-table .green {
  color: var(--fst-green);
}

.admin-table .red {
  color: var(--fst-red);
}

.admin-table tfoot {
  background: var(--surface-card);
  font-weight: 600;
}

.status-badge, .category-badge, .type-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  display: inline-block;
}

.status-badge.paid, .status-badge.completed, .status-badge.ok {
  background: color-mix(in srgb, var(--fst-green) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color));
}

.status-badge.accrued, .status-badge.partial {
  background: color-mix(in srgb, var(--fst-brand) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color));
}

.status-badge.pending {
  background: var(--p-content-border-color);
  color: var(--p-text-muted-color);
}

.status-badge.warning {
  background: color-mix(in srgb, var(--fst-brand) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color));
}

.category-badge.due-diligence {
  background: color-mix(in srgb, var(--fst-blue) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-blue) 70%, var(--p-text-color));
}

.category-badge.legal {
  background: color-mix(in srgb, var(--fst-green) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color));
}

.category-badge.travel {
  background: color-mix(in srgb, var(--fst-brand) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color));
}

.category-badge.admin {
  background: color-mix(in srgb, var(--fst-purple) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-purple) 70%, var(--p-text-color));
}

.category-badge.audit {
  background: color-mix(in srgb, var(--fst-red) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-red) 70%, var(--p-text-color));
}

.category-badge.marketing {
  background: color-mix(in srgb, var(--fst-cyan) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-cyan) 70%, var(--p-text-color));
}

.type-badge.realized-profit {
  background: color-mix(in srgb, var(--fst-green) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color));
}

.type-badge.return-of-capital {
  background: color-mix(in srgb, var(--fst-blue) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-blue) 70%, var(--p-text-color));
}

.type-badge.income {
  background: color-mix(in srgb, var(--fst-purple) 10%, var(--p-surface-card));
  color: color-mix(in srgb, var(--fst-purple) 70%, var(--p-text-color));
}

.link-btn, .action-btn {
  background: none;
  border: none;
  color: var(--p-primary-color);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

.link-btn:hover {
  text-decoration: underline;
}

.action-btn {
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
}

.action-btn.del {
  color: var(--fst-red);
}

.admin-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.filter-group select {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--p-text-color);
  font-size: 0.9rem;
}

.expenses-chart-card {
  margin-top: 1.5rem;
}

.expenses-breakdown {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.exp-cat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exp-cat-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.exp-cat-bar-wrap {
  width: 100%;
  height: 24px;
  background: var(--surface-card);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.exp-cat-bar {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s;
}

.exp-cat-value {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.carry-calc {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.carry-step {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.carry-step.highlight {
  background: var(--p-primary-50);
  border-color: var(--p-primary-200);
}

.carry-step.final {
  background: color-mix(in srgb, var(--fst-green) 10%, var(--p-surface-card));
  border-color: var(--fst-green);
}

.carry-step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.carry-step-body {
  flex: 1;
}

.carry-step-label {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

.carry-step-value {
  font-size: 1.1rem;
  color: var(--p-text-color);
}

.carry-step-value.bold {
  font-weight: 700;
  font-size: 1.3rem;
}

.carry-notice {
  padding: 1rem;
  background: var(--surface-card);
  border-left: 4px solid var(--p-primary-color);
  border-radius: 4px;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.nav-period-select {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.nav-period-select label {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.nav-period-select input {
  padding: 0.5rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--p-text-color);
}

.nav-table .nav-section-header td {
  background: var(--surface-card);
  font-weight: 600;
  padding: 0.75rem;
}

.nav-table .nav-subtotal td {
  background: var(--surface-card);
  font-weight: 600;
  border-top: 2px solid var(--surface-border);
}

.nav-table .nav-total td {
  background: color-mix(in srgb, var(--fst-green) 10%, var(--p-surface-card));
  font-weight: 700;
  font-size: 1.05rem;
  border-top: 3px solid var(--fst-green);
  color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color));
}

.nav-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.nav-metric {
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
  text-align: center;
}

.nav-metric-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}

.nav-metric-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.bank-accounts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.bank-account-card {
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.bank-account-card.add-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 120px;
  border-style: dashed;
  transition: all 0.2s;
}

.bank-account-card.add-new:hover {
  background: var(--surface-card);
  border-color: var(--p-primary-color);
}

.add-icon {
  font-size: 2rem;
  color: var(--p-primary-color);
}

.add-label {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.ba-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ba-bank {
  font-weight: 600;
  color: var(--p-text-color);
}

.ba-currency {
  padding: 0.25rem 0.5rem;
  background: var(--surface-card);
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.ba-number {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  font-family: monospace;
  margin-bottom: 0.5rem;
}

.ba-balance {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 0.25rem;
}

.ba-updated {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.audit-package-status {
  margin-bottom: 1.5rem;
}

.audit-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-check-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--surface-card);
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

.audit-check-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.audit-check-item label {
  flex: 1;
  font-size: 0.95rem;
  color: var(--p-text-color);
  cursor: pointer;
}

.audit-resp {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  padding: 0.25rem 0.75rem;
  background: var(--surface-card);
  border-radius: 12px;
}

.audit-deadline {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  min-width: 80px;
  text-align: right;
}

.audit-deadline.overdue {
  color: var(--fst-red);
  font-weight: 600;
}

.audit-trail-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.audit-trail-filters input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--p-text-color);
}

.audit-trail-filters select {
  padding: 0.5rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--p-text-color);
}

.fsbu-intro {
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: var(--p-text-color);
}

.fsbu-intro ul {
  margin: 0.5rem 0 0 1.5rem;
}

.fsbu-intro li {
  margin: 0.25rem 0;
}

.fsbu-table .fsbu-section td {
  background: var(--surface-card);
  font-weight: 600;
  padding: 0.75rem;
  border-top: 2px solid var(--surface-border);
}

.fsbu-table .fsbu-total td {
  background: var(--surface-card);
  font-weight: 700;
  font-size: 1.05rem;
  border-top: 3px solid var(--p-text-color);
  padding: 1rem 0.75rem;
}

.fsbu-notes {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fsbu-note {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.note-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.note-body {
  flex: 1;
}

.note-title {
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
}

.note-text {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--p-text-color) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 40px color-mix(in srgb, var(--p-text-color) 20%, transparent);
}

.modal-box h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-form label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-color);
  margin-bottom: -0.5rem;
}

.modal-form input, .modal-form select {
  padding: 0.6rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background: var(--surface-ground);
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .admin-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .admin-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .admin-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .admin-tabs > * { flex-shrink: 0; font-size: 0.8rem; }
  .params-grid { grid-template-columns: 1fr !important; }
  .nav-metrics { grid-template-columns: 1fr !important; }
}
</style>

<template>
  <div class="syn-root">
    <div class="syn-header">
      <div>
        <h1>🤝 Сеть со-инвесторов</h1>
        <span class="syn-sub">Управление синдикацией с РФРИТ, Сколково, Ростех Венчурс, Росинфокоминвест</span>
      </div>
      <div class="syn-actions">
        <button class="syn-btn secondary" @click="showAnalytics = !showAnalytics">
          <i class="pi pi-chart-line"></i> Аналитика
        </button>
        <button class="syn-btn secondary" @click="exportSyndication">
          <i class="pi pi-download"></i> Экспорт
        </button>
        <button class="syn-btn primary" @click="showAddInvestor = true">
          <i class="pi pi-user-plus"></i> + Инвестор
        </button>
        <button class="syn-btn primary" @click="showAddDeal = true">
          <i class="pi pi-plus"></i> + Сделка
        </button>
      </div>
    </div>

    <!-- Сводка синдикации -->
    <div class="syn-summary">
      <div class="ss-card" v-for="s in summary" :key="s.label">
        <div class="ss-val" :class="s.color">{{ s.value }}</div>
        <div class="ss-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="syn-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['syn-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <i :class="tab.icon"></i> {{ tab.label }}
      </button>
    </div>

    <!-- База со-инвесторов -->
    <div v-show="activeTab === 'investors'" class="syn-section">
      <div class="section-header">
        <h2>База со-инвесторов</h2>
        <div class="filter-group">
          <select v-model="filterType" class="syn-select">
            <option value="all">Все типы</option>
            <option value="gov">Государственные</option>
            <option value="private">Частные</option>
            <option value="corporate">Корпоративные</option>
          </select>
          <select v-model="filterRelation" class="syn-select">
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="potential">Потенциальные</option>
          </select>
        </div>
      </div>
      <div class="investor-grid">
        <div v-for="inv in filteredInvestors" :key="inv.name" class="inv-card" @click="showInvestorDetails(inv)">
          <div class="inv-header">
            <div class="inv-avatar" :class="inv.type">{{ inv.initials }}</div>
            <div class="inv-info">
              <div class="inv-name">{{ inv.name }}</div>
              <div class="inv-type">{{ inv.typeLabel }}</div>
            </div>
            <div class="inv-rel" :class="inv.relation">{{ relLabel(inv.relation) }}</div>
          </div>

          <!-- Рейтинг -->
          <div class="inv-rating">
            <div class="rating-item">
              <span class="rating-label">Скорость решения</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= inv.rating.speed ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
            <div class="rating-item">
              <span class="rating-label">Чёткость условий</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= inv.rating.clarity ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
            <div class="rating-item">
              <span class="rating-label">Полезность партнёра</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= inv.rating.usefulness ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
          </div>

          <div class="inv-stats">
            <div class="inv-stat">
              <span>Со-инвест.</span><strong>{{ inv.coDeals }} сделок</strong>
            </div>
            <div class="inv-stat">
              <span>Объём</span><strong>{{ inv.totalAmount }} млн ₽</strong>
            </div>
            <div class="inv-stat">
              <span>Тикет</span><strong>{{ inv.minTicket }}–{{ inv.maxTicket }} млн ₽</strong>
            </div>
          </div>
          <div class="inv-focus">
            <span v-for="f in inv.focus" :key="f" class="focus-tag">{{ f }}</span>
          </div>

          <!-- Контакты -->
          <div class="inv-contact" v-if="inv.contact">
            <i class="pi pi-user"></i> {{ inv.contact.name }}, {{ inv.contact.position }}
            <br><i class="pi pi-envelope"></i> {{ inv.contact.email }}
          </div>
        </div>
      </div>
    </div>

    <!-- Активные синдикации -->
    <div v-show="activeTab === 'deals'" class="syn-section">
      <div class="section-header">
        <h2>Синдицированные сделки</h2>
        <div class="filter-group">
          <select v-model="filterStatus" class="syn-select">
            <option value="all">Все статусы</option>
            <option value="negotiating">Переговоры</option>
            <option value="nda">Подписали NDA</option>
            <option value="ts">Подписали TS</option>
            <option value="closed">Закрыты</option>
            <option value="failed">Не состоялись</option>
          </select>
        </div>
      </div>
      <table class="syn-table">
        <thead>
          <tr>
            <th>Сделка / Компания</th>
            <th>Всего раунд</th>
            <th>Доля ФСТ</th>
            <th>Со-инвесторы</th>
            <th>Права</th>
            <th>Статус</th>
            <th>Закрытие</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="deal in filteredDeals" :key="deal.id">
            <td>
              <div class="deal-name">{{ deal.company }}</div>
              <div class="deal-round">{{ deal.round }}</div>
            </td>
            <td class="num">{{ deal.totalRound }} млн ₽</td>
            <td class="num">
              <div>{{ deal.fstAmount }} млн ₽</div>
              <div class="share-pct">{{ deal.fstPct }}%</div>
            </td>
            <td>
              <div class="co-list">
                <span v-for="co in deal.coInvestors" :key="co" class="co-chip" :title="getInvestorShare(deal, co)">
                  {{ co }}
                </span>
              </div>
            </td>
            <td>
              <span class="rights-badge" :class="deal.rights">{{ rightsLabel(deal.rights) }}</span>
            </td>
            <td><span class="deal-status" :class="deal.status">{{ dealStatusLabel(deal.status) }}</span></td>
            <td class="deal-date">{{ deal.closeDate }}</td>
            <td>
              <button class="action-btn" @click="updateCapTable(deal)" title="Обновить cap table">
                <i class="pi pi-chart-pie"></i>
              </button>
              <button class="action-btn" @click="viewDealDetails(deal)" title="Детали">
                <i class="pi pi-eye"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Аналитика -->
    <div v-show="activeTab === 'analytics'" class="syn-section">
      <h2>Аналитика сети со-инвестирования</h2>

      <!-- Network Graph -->
      <div class="analytics-card">
        <h3><i class="pi pi-sitemap"></i> Граф сети со-инвесторов</h3>
        <div class="network-graph" ref="networkGraphRef">
          <svg width="100%" height="500"></svg>
        </div>
        <div class="graph-legend">
          <span><span class="legend-dot gov"></span> Государственные</span>
          <span><span class="legend-dot private"></span> Частные</span>
          <span><span class="legend-dot corporate"></span> Корпоративные</span>
          <span><span class="legend-dot fst"></span> ФСТ НТИ</span>
        </div>
      </div>

      <!-- Heatmap -->
      <div class="analytics-card">
        <h3><i class="pi pi-th-large"></i> Тепловая карта: активность по секторам</h3>
        <div class="heatmap-container">
          <table class="heatmap-table">
            <thead>
              <tr>
                <th>Инвестор</th>
                <th v-for="sector in sectors" :key="sector">{{ sector }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in coInvestors.slice(0, 6)" :key="inv.name">
                <td class="heatmap-label">{{ inv.name }}</td>
                <td
                  v-for="sector in sectors"
                  :key="sector"
                  :class="['heatmap-cell', getHeatmapClass(inv, sector)]"
                  :title="`${inv.name} - ${sector}: ${getActivityLevel(inv, sector)} сделок`"
                >
                  {{ getActivityLevel(inv, sector) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Syndication Potential -->
      <div class="analytics-card">
        <h3><i class="pi pi-chart-bar"></i> Потенциал синдикации для сделок в воронке</h3>
        <div class="potential-grid">
          <div v-for="opportunity in syndicationOpportunities" :key="opportunity.company" class="potential-card">
            <div class="potential-header">
              <span class="potential-company">{{ opportunity.company }}</span>
              <span class="potential-score" :class="getScoreClass(opportunity.score)">
                {{ opportunity.score }}/10
              </span>
            </div>
            <div class="potential-sector">{{ opportunity.sector }}</div>
            <div class="potential-matches">
              <strong>Подходящие со-инвесторы:</strong>
              <div class="match-list">
                <span v-for="match in opportunity.matches" :key="match.name" class="match-chip" :title="`Совпадение: ${match.matchScore}%`">
                  {{ match.name }} ({{ match.matchScore }}%)
                </span>
              </div>
            </div>
            <div class="potential-reason">{{ opportunity.reason }}</div>
            <button class="syn-btn primary small" @click="inviteCoInvestor(opportunity)">
              <i class="pi pi-send"></i> Пригласить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Term Sheet шаблоны -->
    <div v-show="activeTab === 'templates'" class="syn-section">
      <h2>Term Sheet шаблоны синдикации</h2>
      <div class="ts-grid">
        <div v-for="ts in termSheets" :key="ts.name" class="ts-card">
          <div class="ts-name">{{ ts.name }}</div>
          <div class="ts-desc">{{ ts.desc }}</div>
          <div class="ts-terms">
            <div v-for="t in ts.terms" :key="t.label" class="ts-term">
              <span class="tt-label">{{ t.label }}:</span>
              <span class="tt-val">{{ t.value }}</span>
            </div>
          </div>
          <button class="ts-btn" @click="useTemplate(ts)">Использовать шаблон</button>
        </div>
      </div>
    </div>

    <!-- Модалы -->
    <!-- Добавить инвестора -->
    <div v-if="showAddInvestor" class="modal-overlay" @click.self="showAddInvestor = false">
      <div class="modal-box large">
        <h3>Добавить со-инвестора</h3>
        <div class="modal-form">
          <label>Название</label>
          <input v-model="newInvestor.name" placeholder="Название фонда/института" />

          <label>Тип</label>
          <select v-model="newInvestor.type">
            <option value="gov">Государственный</option>
            <option value="private">Частный</option>
            <option value="corporate">Корпоративный</option>
          </select>

          <label>Фокус-сектора (через запятую)</label>
          <input v-model="newInvestor.focusStr" placeholder="БАС, Deep Tech, Robotics" />

          <label>Контактное лицо</label>
          <input v-model="newInvestor.contactName" placeholder="Имя Фамилия" />

          <label>Должность</label>
          <input v-model="newInvestor.contactPosition" placeholder="Инвестиционный директор" />

          <label>Email</label>
          <input v-model="newInvestor.contactEmail" type="email" placeholder="investor@fund.ru" />

          <label>Мин. тикет (млн ₽)</label>
          <input v-model.number="newInvestor.minTicket" type="number" step="10" />

          <label>Макс. тикет (млн ₽)</label>
          <input v-model.number="newInvestor.maxTicket" type="number" step="50" />
        </div>
        <div class="modal-actions">
          <button class="syn-btn secondary" @click="showAddInvestor = false">Отмена</button>
          <button class="syn-btn primary" @click="addInvestor">Добавить</button>
        </div>
      </div>
    </div>

    <!-- Добавить сделку -->
    <div v-if="showAddDeal" class="modal-overlay" @click.self="showAddDeal = false">
      <div class="modal-box">
        <h3>Новая синдицированная сделка</h3>
        <div class="modal-form">
          <label>Компания</label>
          <input v-model="newDeal.company" />

          <label>Раунд</label>
          <input v-model="newDeal.round" placeholder="Серия A" />

          <label>Объём раунда, млн ₽</label>
          <input v-model.number="newDeal.totalRound" type="number" step="10" />

          <label>Доля ФСТ, млн ₽</label>
          <input v-model.number="newDeal.fstAmount" type="number" step="5" />

          <label>Со-инвесторы (через запятую)</label>
          <input v-model="newDeal.coInvestorsStr" placeholder="Сколково, ФРП..." />

          <label>Права со-инвесторов</label>
          <select v-model="newDeal.rights">
            <option value="pari-passu">Pari Passu (равные)</option>
            <option value="senior">Senior (приоритетные)</option>
            <option value="junior">Junior (младшие)</option>
          </select>

          <label>Статус</label>
          <select v-model="newDeal.status">
            <option value="negotiating">Переговоры</option>
            <option value="nda">Подписали NDA</option>
            <option value="ts">Подписали TS</option>
            <option value="closed">Закрыта</option>
          </select>

          <label>Планируемое закрытие</label>
          <input v-model="newDeal.closeDate" type="date" />
        </div>
        <div class="modal-actions">
          <button class="syn-btn secondary" @click="showAddDeal = false">Отмена</button>
          <button class="syn-btn primary" @click="addDeal">Добавить</button>
        </div>
      </div>
    </div>

    <!-- Детали инвестора -->
    <div v-if="selectedInvestor" class="modal-overlay" @click.self="selectedInvestor = null">
      <div class="modal-box large">
        <h3>{{ selectedInvestor.name }}</h3>
        <div class="investor-details">
          <div class="detail-section">
            <h4>Основная информация</h4>
            <p><strong>Тип:</strong> {{ selectedInvestor.typeLabel }}</p>
            <p><strong>Статус:</strong> {{ relLabel(selectedInvestor.relation) }}</p>
            <p><strong>Тикет:</strong> {{ selectedInvestor.minTicket }}–{{ selectedInvestor.maxTicket }} млн ₽</p>
          </div>

          <div class="detail-section">
            <h4>Рейтинг партнёра</h4>
            <div class="rating-detail">
              <span>Скорость принятия решений:</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= selectedInvestor.rating.speed ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
            <div class="rating-detail">
              <span>Чёткость условий:</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= selectedInvestor.rating.clarity ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
            <div class="rating-detail">
              <span>Полезность как партнёра:</span>
              <div class="rating-stars">
                <i v-for="n in 5" :key="n" :class="['pi', n <= selectedInvestor.rating.usefulness ? 'pi-star-fill' : 'pi-star']"></i>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedInvestor.contact">
            <h4>Контакт</h4>
            <p><strong>Имя:</strong> {{ selectedInvestor.contact.name }}</p>
            <p><strong>Должность:</strong> {{ selectedInvestor.contact.position }}</p>
            <p><strong>Email:</strong> <a :href="`mailto:${selectedInvestor.contact.email}`">{{ selectedInvestor.contact.email }}</a></p>
          </div>

          <div class="detail-section">
            <h4>История со-инвестиций</h4>
            <p><strong>Сделок вместе:</strong> {{ selectedInvestor.coDeals }}</p>
            <p><strong>Общий объём:</strong> {{ selectedInvestor.totalAmount }} млн ₽</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="syn-btn primary" @click="selectedInvestor = null">Закрыть</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// UI State
const showAddDeal = ref(false)
const showAddInvestor = ref(false)
const showAnalytics = ref(false)
const selectedInvestor = ref(null)
const activeTab = ref('investors')

// Filters
const filterType = ref('all')
const filterRelation = ref('all')
const filterStatus = ref('all')

// Tabs
const tabs = [
  { id: 'investors', label: 'База инвесторов', icon: 'pi pi-users' },
  { id: 'deals', label: 'Сделки', icon: 'pi pi-briefcase' },
  { id: 'analytics', label: 'Аналитика', icon: 'pi pi-chart-line' },
  { id: 'templates', label: 'Шаблоны TS', icon: 'pi pi-file' }
]

// Sectors for heatmap
const sectors = ['БАС', 'Deep Tech', 'Robotics', 'Агро', 'Телеком', 'Нанотех']

// Co-investors database
const coInvestors = ref([
  {
    name: 'РФРИТ',
    initials: 'РФ',
    type: 'gov',
    typeLabel: 'Гос. институт',
    relation: 'active',
    coDeals: 5,
    totalAmount: 850,
    minTicket: 100,
    maxTicket: 500,
    focus: ['БАС', 'Deep Tech', 'Robotics'],
    rating: { speed: 4, clarity: 5, usefulness: 5 },
    contact: { name: 'Иванов Петр Сергеевич', position: 'Директор инвестиций', email: 'p.ivanov@rfrит.ru' },
    sectorActivity: { 'БАС': 3, 'Deep Tech': 2, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  },
  {
    name: 'Сколково Ventures',
    initials: 'СВ',
    type: 'gov',
    typeLabel: 'Гос. институт',
    relation: 'active',
    coDeals: 3,
    totalAmount: 270,
    minTicket: 50,
    maxTicket: 300,
    focus: ['БАС', 'Deep Tech'],
    rating: { speed: 5, clarity: 4, usefulness: 4 },
    contact: { name: 'Смирнова Анна', position: 'Партнёр', email: 'a.smirnova@sk.ru' },
    sectorActivity: { 'БАС': 2, 'Deep Tech': 1, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  },
  {
    name: 'Ростех Венчурс',
    initials: 'РВ',
    type: 'corporate',
    typeLabel: 'Корпоративный ВФ',
    relation: 'active',
    coDeals: 4,
    totalAmount: 620,
    minTicket: 80,
    maxTicket: 400,
    focus: ['БАС', 'Robotics', 'Deep Tech'],
    rating: { speed: 3, clarity: 4, usefulness: 5 },
    contact: { name: 'Кузнецов Дмитрий', position: 'Руководитель направления БАС', email: 'd.kuznetsov@rostec.ru' },
    sectorActivity: { 'БАС': 2, 'Deep Tech': 1, 'Robotics': 1, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  },
  {
    name: 'Росинфокоминвест',
    initials: 'РК',
    type: 'gov',
    typeLabel: 'Гос. институт',
    relation: 'active',
    coDeals: 2,
    totalAmount: 380,
    minTicket: 100,
    maxTicket: 600,
    focus: ['Телеком', 'Deep Tech'],
    rating: { speed: 3, clarity: 3, usefulness: 4 },
    contact: { name: 'Волков Андрей', position: 'Начальник отдела', email: 'a.volkov@rki.ru' },
    sectorActivity: { 'БАС': 0, 'Deep Tech': 1, 'Robotics': 0, 'Агро': 0, 'Телеком': 1, 'Нанотех': 0 }
  },
  {
    name: 'ВЭБ.РФ',
    initials: 'ВЭ',
    type: 'gov',
    typeLabel: 'Гос. банк',
    relation: 'active',
    coDeals: 2,
    totalAmount: 440,
    minTicket: 100,
    maxTicket: 1000,
    focus: ['Инфраструктура', 'Экспорт'],
    rating: { speed: 2, clarity: 3, usefulness: 3 },
    contact: { name: 'Федорова Елена', position: 'Директор департамента', email: 'e.fedorova@veb.ru' },
    sectorActivity: { 'БАС': 1, 'Deep Tech': 1, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  },
  {
    name: 'Роснано',
    initials: 'РН',
    type: 'gov',
    typeLabel: 'Гос. институт',
    relation: 'potential',
    coDeals: 1,
    totalAmount: 120,
    minTicket: 50,
    maxTicket: 500,
    focus: ['Нанотех', 'Материалы'],
    rating: { speed: 3, clarity: 3, usefulness: 3 },
    contact: { name: 'Морозов Игорь', position: 'Инвестиционный менеджер', email: 'i.morozov@rusnano.ru' },
    sectorActivity: { 'БАС': 0, 'Deep Tech': 0, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 1 }
  },
  {
    name: 'Sistema_VC',
    initials: 'SY',
    type: 'private',
    typeLabel: 'Частный ВФ',
    relation: 'active',
    coDeals: 2,
    totalAmount: 180,
    minTicket: 50,
    maxTicket: 200,
    focus: ['B2B SaaS', 'Телеком'],
    rating: { speed: 5, clarity: 5, usefulness: 4 },
    contact: { name: 'Соколов Михаил', position: 'Партнёр', email: 'm.sokolov@sistema.vc' },
    sectorActivity: { 'БАС': 0, 'Deep Tech': 1, 'Robotics': 0, 'Агро': 0, 'Телеком': 1, 'Нанотех': 0 }
  },
  {
    name: 'Tiltech Ventures',
    initials: 'TV',
    type: 'private',
    typeLabel: 'Частный ВФ',
    relation: 'potential',
    coDeals: 0,
    totalAmount: 0,
    minTicket: 30,
    maxTicket: 150,
    focus: ['Агро', 'Robotics'],
    rating: { speed: 4, clarity: 4, usefulness: 3 },
    contact: { name: 'Попов Сергей', position: 'Managing Partner', email: 's.popov@tiltech.vc' },
    sectorActivity: { 'БАС': 0, 'Deep Tech': 0, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  },
  {
    name: 'ФРП',
    initials: 'Ф',
    type: 'gov',
    typeLabel: 'Гос. институт',
    relation: 'active',
    coDeals: 1,
    totalAmount: 250,
    minTicket: 50,
    maxTicket: 750,
    focus: ['Промышленность', 'НИОКР'],
    rating: { speed: 2, clarity: 3, usefulness: 4 },
    contact: { name: 'Лебедев Олег', position: 'Начальник управления', email: 'o.lebedev@frprf.ru' },
    sectorActivity: { 'БАС': 0, 'Deep Tech': 1, 'Robotics': 0, 'Агро': 0, 'Телеком': 0, 'Нанотех': 0 }
  }
])

function relLabel(r) { return { active: 'Активный', potential: 'Потенциальный' }[r] || r }
function rightsLabel(r) { return { 'pari-passu': 'Pari Passu', senior: 'Senior', junior: 'Junior' }[r] || r }

// Computed filters
const filteredInvestors = computed(() => {
  return coInvestors.value.filter(inv => {
    if (filterType.value !== 'all' && inv.type !== filterType.value) return false
    if (filterRelation.value !== 'all' && inv.relation !== filterRelation.value) return false
    return true
  })
})

const filteredDeals = computed(() => {
  return synDeals.value.filter(deal => {
    if (filterStatus.value !== 'all' && deal.status !== filterStatus.value) return false
    return true
  })
})

const summary = computed(() => [
  { label: 'Со-инвестиций всего', value: synDeals.value.length, color: 'blue' },
  { label: 'Объём синдикаций', value: synDeals.value.reduce((s, d) => s + d.totalRound, 0) + ' млн ₽', color: 'green' },
  { label: 'Объём ФСТ', value: synDeals.value.reduce((s, d) => s + d.fstAmount, 0) + ' млн ₽', color: 'blue' },
  { label: 'Активных партнёров', value: coInvestors.value.filter(i => i.relation === 'active').length, color: 'green' }
])

// Syndication deals
const synDeals = ref([
  { id: 1, company: 'АгроДрон', round: 'Серия A+', totalRound: 380, fstAmount: 180, fstPct: 47, coInvestors: ['Сколково Ventures', 'РФРИТ'], rights: 'pari-passu', status: 'closed', closeDate: '2024-03-15' },
  { id: 2, company: 'DroneLogistics', round: 'Серия B', totalRound: 720, fstAmount: 350, fstPct: 49, coInvestors: ['ВЭБ.РФ', 'Sistema_VC'], rights: 'pari-passu', status: 'closed', closeDate: '2023-12-01' },
  { id: 3, company: 'CyberPilot', round: 'Серия B+', totalRound: 500, fstAmount: 200, fstPct: 40, coInvestors: ['Роснано', 'Сколково Ventures'], rights: 'senior', status: 'closed', closeDate: '2023-06-20' },
  { id: 4, company: 'НейроМат', round: 'Серия A', totalRound: 280, fstAmount: 150, fstPct: 54, coInvestors: ['ФРП'], rights: 'pari-passu', status: 'ts', closeDate: '2026-04-30' },
  { id: 5, company: 'Новый стартап', round: 'Seed', totalRound: 120, fstAmount: 60, fstPct: 50, coInvestors: ['Tiltech Ventures'], rights: 'pari-passu', status: 'negotiating', closeDate: '2026-06-01' },
  { id: 6, company: 'АэроТех', round: 'Серия A', totalRound: 450, fstAmount: 200, fstPct: 44, coInvestors: ['РФРИТ', 'Ростех Венчурс'], rights: 'pari-passu', status: 'nda', closeDate: '2026-05-15' }
])

function dealStatusLabel(s) {
  return { closed: 'Закрыта', active: 'Активна', negotiating: 'Переговоры', nda: 'Подписали NDA', ts: 'Подписали TS', failed: 'Не состоялась' }[s] || s
}

// Syndication opportunities (for analytics)
const syndicationOpportunities = ref([
  {
    company: 'DroneDelivery AI',
    sector: 'БАС',
    score: 9,
    matches: [
      { name: 'РФРИТ', matchScore: 95 },
      { name: 'Ростех Венчурс', matchScore: 88 },
      { name: 'Сколково Ventures', matchScore: 82 }
    ],
    reason: 'Высокий интерес к БАС-сектору среди 3 крупных партнёров. РФРИТ искал подобные проекты.'
  },
  {
    company: 'RoboFarm',
    sector: 'Агро',
    score: 7,
    matches: [
      { name: 'Tiltech Ventures', matchScore: 90 },
      { name: 'ФРП', matchScore: 65 }
    ],
    reason: 'Tiltech специализируется на агротехе. Средний потенциал.'
  },
  {
    company: 'NanoMaterials Pro',
    sector: 'Нанотех',
    score: 6,
    matches: [
      { name: 'Роснано', matchScore: 100 }
    ],
    reason: 'Единственный специализированный партнёр — Роснано.'
  },
  {
    company: '5G Drone Network',
    sector: 'Телеком',
    score: 8,
    matches: [
      { name: 'Росинфокоминвест', matchScore: 92 },
      { name: 'Sistema_VC', matchScore: 85 }
    ],
    reason: 'Отличное совпадение с фокусом Росинфокоминвест и Sistema_VC.'
  }
])

const termSheets = ref([
  {
    name: 'Паритетная синдикация',
    desc: 'Равные доли ФСТ и со-инвестора, общее управление',
    terms: [
      { label: 'Доля ФСТ', value: '50%' },
      { label: 'Право вето', value: 'Взаимное' },
      { label: 'Drag-along', value: '75% голосов' },
      { label: 'Антиразводнение', value: 'Full ratchet' }
    ]
  },
  {
    name: 'Лид-инвестор',
    desc: 'ФСТ — лидирующий инвестор, со-инвесторы следуют',
    terms: [
      { label: 'Доля ФСТ', value: '>50%' },
      { label: 'Место в СД', value: 'ФСТ: 2 / Со: 1' },
      { label: 'Инф. права', value: 'Квартальный пакет' },
      { label: 'Pro-rata', value: 'Право ФСТ' }
    ]
  },
  {
    name: 'Со-лид',
    desc: 'Два равных лид-инвестора',
    terms: [
      { label: 'Доля ФСТ', value: '25–35%' },
      { label: 'Место в СД', value: '1+1 наблюдатель' },
      { label: 'Tag-along', value: 'Оба инвестора' },
      { label: 'Ликв. преф.', value: '1x non-part.' }
    ]
  }
])

// Form data
const newDeal = ref({
  company: '',
  round: '',
  totalRound: 0,
  fstAmount: 0,
  coInvestorsStr: '',
  rights: 'pari-passu',
  status: 'negotiating',
  closeDate: ''
})

const newInvestor = ref({
  name: '',
  type: 'gov',
  focusStr: '',
  contactName: '',
  contactPosition: '',
  contactEmail: '',
  minTicket: 50,
  maxTicket: 300
})

// Network graph reference
const networkGraphRef = ref(null)

// Functions
function showInvestorDetails(inv) {
  selectedInvestor.value = inv
}

function getInvestorShare(deal, coInvestorName) {
  const coShare = (deal.totalRound - deal.fstAmount) / deal.coInvestors.length
  return `~${Math.round(coShare)} млн ₽`
}

function getHeatmapClass(inv, sector) {
  const activity = inv.sectorActivity[sector] || 0
  if (activity === 0) return 'heat-0'
  if (activity === 1) return 'heat-1'
  if (activity === 2) return 'heat-2'
  return 'heat-3'
}

function getActivityLevel(inv, sector) {
  return inv.sectorActivity[sector] || 0
}

function getScoreClass(score) {
  if (score >= 8) return 'score-high'
  if (score >= 6) return 'score-medium'
  return 'score-low'
}

function inviteCoInvestor(opportunity) {
  alert(`Приглашение со-инвесторов для сделки "${opportunity.company}"`)
}

function updateCapTable(deal) {
  alert(`Автоматическое обновление cap table для "${deal.company}"`)
}

function viewDealDetails(deal) {
  alert(`Детали сделки: ${deal.company}`)
}

function useTemplate(ts) {
  alert('Шаблон "' + ts.name + '" применён')
}

function addDeal() {
  synDeals.value.push({
    id: Date.now(),
    company: newDeal.value.company,
    round: newDeal.value.round,
    totalRound: newDeal.value.totalRound,
    fstAmount: newDeal.value.fstAmount,
    fstPct: Math.round((newDeal.value.fstAmount / newDeal.value.totalRound) * 100),
    coInvestors: newDeal.value.coInvestorsStr.split(',').map(s => s.trim()),
    rights: newDeal.value.rights,
    status: newDeal.value.status,
    closeDate: newDeal.value.closeDate
  })
  showAddDeal.value = false
  newDeal.value = { company: '', round: '', totalRound: 0, fstAmount: 0, coInvestorsStr: '', rights: 'pari-passu', status: 'negotiating', closeDate: '' }
}

function addInvestor() {
  const initials = newInvestor.value.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const typeLabels = { gov: 'Гос. институт', private: 'Частный ВФ', corporate: 'Корпоративный ВФ' }

  coInvestors.value.push({
    name: newInvestor.value.name,
    initials,
    type: newInvestor.value.type,
    typeLabel: typeLabels[newInvestor.value.type],
    relation: 'potential',
    coDeals: 0,
    totalAmount: 0,
    minTicket: newInvestor.value.minTicket,
    maxTicket: newInvestor.value.maxTicket,
    focus: newInvestor.value.focusStr.split(',').map(s => s.trim()),
    rating: { speed: 3, clarity: 3, usefulness: 3 },
    contact: {
      name: newInvestor.value.contactName,
      position: newInvestor.value.contactPosition,
      email: newInvestor.value.contactEmail
    },
    sectorActivity: Object.fromEntries(sectors.map(s => [s, 0]))
  })

  showAddInvestor.value = false
  newInvestor.value = {
    name: '',
    type: 'gov',
    focusStr: '',
    contactName: '',
    contactPosition: '',
    contactEmail: '',
    minTicket: 50,
    maxTicket: 300
  }
}

function exportSyndication() {
  alert('Экспорт данных синдикации в Excel/PDF')
}

// D3 Network Graph
onMounted(() => {
  initNetworkGraph()
})

function initNetworkGraph() {
  // Simple force-directed graph visualization
  // This is a placeholder - in production, you would use d3.js
  const svg = networkGraphRef.value?.querySelector('svg')
  if (!svg) return

  // For now, display a placeholder message
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', '50%')
  text.setAttribute('y', '50%')
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('fill', 'var(--p-text-muted-color)')
  text.textContent = 'Граф сети со-инвесторов (интеграция D3.js)'
  svg.appendChild(text)

  // TODO: Implement D3 force graph with nodes for each co-investor
  // and edges representing co-investment relationships
}
</script>

<style scoped>
.syn-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.syn-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.syn-header h1 { margin: 0; font-size: 1.5rem; color: var(--p-text-color); }
.syn-sub { font-size: 0.85rem; color: var(--p-text-muted-color); }
.syn-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.syn-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.83rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.syn-btn.primary { background: var(--p-primary-color); color: #fff; }
.syn-btn.secondary { background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.syn-btn.small { padding: 6px 10px; font-size: 0.75rem; }
.syn-btn:hover { opacity: 0.9; }

.syn-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.ss-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 14px; text-align: center; }
.ss-val { font-size: 1.5rem; font-weight: 700; }
.ss-val.green { color: #66bb6a; }
.ss-val.blue { color: var(--p-primary-color); }
.ss-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }

.syn-tabs { display: flex; gap: 8px; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 8px; overflow-x: auto; }
.syn-tab { padding: 8px 16px; border-radius: 6px; border: none; background: transparent; color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.syn-tab:hover { background: var(--surface-hover); color: var(--p-text-color); }
.syn-tab.active { background: var(--p-primary-color); color: #fff; }

.syn-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.syn-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.section-header h2 { margin: 0; }
.filter-group { display: flex; gap: 8px; }
.syn-select { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--surface-border); background: var(--surface-ground); color: var(--p-text-color); font-size: 0.8rem; }

.investor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.inv-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.2s; }
.inv-card:hover { border-color: var(--p-primary-color); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.inv-header { display: flex; align-items: center; gap: 10px; }
.inv-avatar { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: #fff; }
.inv-avatar.gov { background: color-mix(in srgb, #42a5f5 70%, var(--p-text-color)); }
.inv-avatar.private { background: color-mix(in srgb, #ab47bc 70%, var(--p-text-color)); }
.inv-avatar.corporate { background: color-mix(in srgb, #ff9800 70%, var(--p-text-color)); }
.inv-info { flex: 1; }
.inv-name { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); }
.inv-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.inv-rel { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; }
.inv-rel.active { background: #66bb6a22; color: #66bb6a; }
.inv-rel.potential { background: var(--surface-border); color: var(--p-text-muted-color); }

.inv-rating { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--surface-card); border-radius: 6px; }
.rating-item { display: flex; justify-content: space-between; align-items: center; }
.rating-label { font-size: 0.7rem; color: var(--p-text-muted-color); }
.rating-stars { display: flex; gap: 2px; }
.rating-stars i { font-size: 0.7rem; color: #ffa726; }

.inv-stats { display: flex; gap: 12px; }
.inv-stat { display: flex; flex-direction: column; gap: 1px; }
.inv-stat span { font-size: 0.65rem; color: var(--p-text-muted-color); }
.inv-stat strong { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.inv-focus { display: flex; gap: 4px; flex-wrap: wrap; }
.focus-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; background: var(--surface-border); color: var(--p-text-muted-color); }
.inv-contact { font-size: 0.7rem; color: var(--p-text-muted-color); line-height: 1.4; padding-top: 8px; border-top: 1px solid var(--surface-border); }
.inv-contact i { margin-right: 4px; }

.syn-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 800px; }
.syn-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; }
.syn-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.deal-name { font-weight: 600; }
.deal-round { font-size: 0.72rem; color: var(--p-text-muted-color); }
.num { text-align: right; }
.share-pct { font-size: 0.68rem; color: var(--p-text-muted-color); }
.co-list { display: flex; gap: 4px; flex-wrap: wrap; }
.co-chip { font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; background: var(--surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--surface-border); cursor: pointer; }
.co-chip:hover { background: var(--p-primary-color); color: #fff; }
.rights-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.rights-badge.pari-passu { background: #42a5f522; color: #42a5f5; }
.rights-badge.senior { background: #66bb6a22; color: #66bb6a; }
.rights-badge.junior { background: #ff980022; color: #ff9800; }
.deal-status { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.deal-status.closed { background: #66bb6a22; color: #66bb6a; }
.deal-status.ts { background: #42a5f522; color: #42a5f5; }
.deal-status.nda { background: #9c27b022; color: #9c27b0; }
.deal-status.negotiating { background: #ff980022; color: #ff9800; }
.deal-status.failed { background: #ef535022; color: #ef5350; }
.deal-date { font-size: 0.75rem; color: var(--p-text-muted-color); }
.action-btn { padding: 4px 8px; border: none; background: transparent; color: var(--p-text-muted-color); cursor: pointer; border-radius: 4px; }
.action-btn:hover { background: var(--surface-hover); color: var(--p-primary-color); }

/* Analytics */
.analytics-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.analytics-card h3 { margin: 0 0 12px; font-size: 0.95rem; color: var(--p-text-color); display: flex; align-items: center; gap: 8px; }
.network-graph { margin: 16px 0; }
.graph-legend { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 12px; font-size: 0.75rem; color: var(--p-text-muted-color); }
.legend-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
.legend-dot.gov { background: color-mix(in srgb, #42a5f5 70%, var(--p-text-color)); }
.legend-dot.private { background: color-mix(in srgb, #ab47bc 70%, var(--p-text-color)); }
.legend-dot.corporate { background: color-mix(in srgb, #ff9800 70%, var(--p-text-color)); }
.legend-dot.fst { background: var(--p-primary-color); }

/* Heatmap */
.heatmap-container { overflow-x: auto; }
.heatmap-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.heatmap-table th { padding: 8px; text-align: center; border: 1px solid var(--surface-border); background: var(--surface-ground); font-size: 0.7rem; color: var(--p-text-muted-color); }
.heatmap-table td { padding: 8px; text-align: center; border: 1px solid var(--surface-border); }
.heatmap-label { text-align: left !important; font-weight: 600; color: var(--p-text-color); }
.heatmap-cell { cursor: pointer; transition: all 0.2s; }
.heatmap-cell.heat-0 { background: var(--surface-ground); color: var(--p-text-muted-color); }
.heatmap-cell.heat-1 { background: #42a5f533; color: #42a5f5; }
.heatmap-cell.heat-2 { background: #66bb6a66; color: #66bb6a; }
.heatmap-cell.heat-3 { background: #66bb6a; color: #fff; font-weight: 700; }
.heatmap-cell:hover { opacity: 0.8; }

/* Syndication Potential */
.potential-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.potential-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.potential-header { display: flex; justify-content: space-between; align-items: center; }
.potential-company { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.potential-score { font-size: 0.85rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
.potential-score.score-high { background: #66bb6a22; color: #66bb6a; }
.potential-score.score-medium { background: #ff980022; color: #ff9800; }
.potential-score.score-low { background: var(--surface-border); color: var(--p-text-muted-color); }
.potential-sector { font-size: 0.72rem; color: var(--p-text-muted-color); }
.potential-matches { font-size: 0.75rem; }
.potential-matches strong { display: block; margin-bottom: 6px; color: var(--p-text-color); }
.match-list { display: flex; gap: 4px; flex-wrap: wrap; }
.match-chip { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; background: var(--p-primary-color); color: #fff; cursor: pointer; }
.match-chip:hover { opacity: 0.8; }
.potential-reason { font-size: 0.72rem; color: var(--p-text-muted-color); font-style: italic; padding: 8px; background: var(--surface-card); border-radius: 4px; }

/* Term Sheets */
.ts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.ts-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.ts-name { font-weight: 700; font-size: 0.88rem; color: var(--p-primary-color); }
.ts-desc { font-size: 0.75rem; color: var(--p-text-muted-color); }
.ts-terms { display: flex; flex-direction: column; gap: 4px; }
.ts-term { display: flex; gap: 6px; font-size: 0.78rem; }
.tt-label { color: var(--p-text-muted-color); min-width: 100px; }
.tt-val { font-weight: 600; color: var(--p-text-color); }
.ts-btn { margin-top: auto; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--p-primary-color); background: transparent; color: var(--p-primary-color); cursor: pointer; font-size: 0.78rem; font-weight: 600; }
.ts-btn:hover { background: var(--p-primary-color); color: #fff; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 400px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
.modal-box.large { width: 600px; }
.modal-box h3 { margin: 0 0 16px; color: var(--p-text-color); }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* Investor Details Modal */
.investor-details { display: flex; flex-direction: column; gap: 16px; }
.detail-section { padding: 12px; background: var(--surface-ground); border-radius: 8px; }
.detail-section h4 { margin: 0 0 8px; font-size: 0.85rem; color: var(--p-primary-color); }
.detail-section p { margin: 4px 0; font-size: 0.8rem; color: var(--p-text-color); }
.detail-section a { color: var(--p-primary-color); text-decoration: none; }
.detail-section a:hover { text-decoration: underline; }
.rating-detail { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; }
.rating-detail span { font-size: 0.75rem; color: var(--p-text-color); }
</style>

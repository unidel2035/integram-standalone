<template>
  <div class="syn-root">
    <div class="syn-header">
      <div>
        <h1>Со-инвестирование</h1>
        <span class="syn-sub">Синдикация с государственными и институциональными со-инвесторами</span>
      </div>
      <div class="syn-actions">
        <button class="syn-btn secondary" @click="exportSyndication">Экспорт</button>
        <button class="syn-btn primary" @click="showAddDeal = true">+ Сделка</button>
      </div>
    </div>

    <!-- Сводка синдикации -->
    <div class="syn-summary">
      <div class="ss-card" v-for="s in summary" :key="s.label">
        <div class="ss-val" :class="s.color">{{ s.value }}</div>
        <div class="ss-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- Сеть со-инвесторов -->
    <div class="syn-section">
      <h2>Сеть со-инвесторов</h2>
      <div class="investor-grid">
        <div v-for="inv in coInvestors" :key="inv.name" class="inv-card">
          <div class="inv-header">
            <div class="inv-avatar" :class="inv.type">{{ inv.initials }}</div>
            <div class="inv-info">
              <div class="inv-name">{{ inv.name }}</div>
              <div class="inv-type">{{ inv.typeLabel }}</div>
            </div>
            <div class="inv-rel" :class="inv.relation">{{ relLabel(inv.relation) }}</div>
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
        </div>
      </div>
    </div>

    <!-- Активные синдикации -->
    <div class="syn-section">
      <h2>Активные синдикации</h2>
      <table class="syn-table">
        <thead>
          <tr>
            <th>Сделка / Компания</th>
            <th>Всего раунд</th>
            <th>Доля ФСТ</th>
            <th>Со-инвесторы</th>
            <th>Статус</th>
            <th>Закрытие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="deal in synDeals" :key="deal.id">
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
                <span v-for="co in deal.coInvestors" :key="co" class="co-chip">{{ co }}</span>
              </div>
            </td>
            <td><span class="deal-status" :class="deal.status">{{ dealStatusLabel(deal.status) }}</span></td>
            <td class="deal-date">{{ deal.closeDate }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Term Sheet шаблоны -->
    <div class="syn-section">
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

    <!-- Добавить сделку Modal -->
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
          <label>Со-инвесторы</label>
          <input v-model="newDeal.coInvestorsStr" placeholder="Сколково, ФРП..." />
          <label>Планируемое закрытие</label>
          <input v-model="newDeal.closeDate" type="date" />
        </div>
        <div class="modal-actions">
          <button class="syn-btn secondary" @click="showAddDeal = false">Отмена</button>
          <button class="syn-btn primary" @click="addDeal">Добавить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const showAddDeal = ref(false)

const coInvestors = ref([
  { name: 'Сколково Ventures',   initials: 'СВ', type: 'gov',     typeLabel: 'Гос. институт',   relation: 'active',   coDeals: 3, totalAmount: 270, minTicket: 50,  maxTicket: 300,  focus: ['БАС', 'Deep Tech'], },
  { name: 'ВЭБ.РФ',             initials: 'ВЭ', type: 'gov',     typeLabel: 'Гос. банк',        relation: 'active',   coDeals: 2, totalAmount: 440, minTicket: 100, maxTicket: 1000, focus: ['Инфраструктура', 'Экспорт'] },
  { name: 'Роснано',             initials: 'РН', type: 'gov',     typeLabel: 'Гос. институт',   relation: 'potential', coDeals: 1, totalAmount: 120, minTicket: 50,  maxTicket: 500,  focus: ['Нанотех', 'Материалы'] },
  { name: 'Sistema_VC',          initials: 'SY', type: 'private', typeLabel: 'Частный ВФ',      relation: 'active',   coDeals: 2, totalAmount: 180, minTicket: 50,  maxTicket: 200,  focus: ['B2B SaaS', 'Телеком'] },
  { name: 'Тiltech Ventures',   initials: 'TV', type: 'private', typeLabel: 'Частный ВФ',      relation: 'potential', coDeals: 0, totalAmount: 0,   minTicket: 30,  maxTicket: 150,  focus: ['Агро', 'Robotics'] },
  { name: 'ФРП',                 initials: 'Ф',  type: 'gov',     typeLabel: 'Гос. институт',   relation: 'active',   coDeals: 1, totalAmount: 250, minTicket: 50,  maxTicket: 750,  focus: ['Промышленность', 'НИОКР'] }
])

function relLabel(r) { return { active: 'Активный', potential: 'Потенциальный' }[r] || r }

const summary = computed(() => [
  { label: 'Со-инвестиций всего', value: synDeals.value.length, color: 'blue' },
  { label: 'Объём синдикаций',    value: synDeals.value.reduce((s, d) => s + d.totalRound, 0) + ' млн ₽', color: 'green' },
  { label: 'Объём ФСТ',          value: synDeals.value.reduce((s, d) => s + d.fstAmount, 0) + ' млн ₽', color: 'blue'  },
  { label: 'Со-инвесторов',       value: coInvestors.value.filter(i => i.relation === 'active').length, color: 'green' }
])

const synDeals = ref([
  { id: 1, company: 'АгроДрон',        round: 'Серия A+',  totalRound: 380, fstAmount: 180, fstPct: 47, coInvestors: ['Сколково', 'Частный'], status: 'closed',  closeDate: '2024-03-15' },
  { id: 2, company: 'DroneLogistics',  round: 'Серия B',   totalRound: 720, fstAmount: 350, fstPct: 49, coInvestors: ['ВЭБ.РФ', 'Sistema_VC'], status: 'closed', closeDate: '2023-12-01' },
  { id: 3, company: 'CyberPilot',      round: 'Серия B+',  totalRound: 500, fstAmount: 200, fstPct: 40, coInvestors: ['Роснано', 'Сколково'], status: 'closed',  closeDate: '2023-06-20' },
  { id: 4, company: 'НейроМат',        round: 'Серия A',   totalRound: 280, fstAmount: 150, fstPct: 54, coInvestors: ['ФРП'],                  status: 'active',  closeDate: '2026-04-30' },
  { id: 5, company: 'Новый стартап',   round: 'Seed',      totalRound: 120, fstAmount: 60,  fstPct: 50, coInvestors: ['Tiltech'],              status: 'negotiating', closeDate: '2026-06-01' }
])

function dealStatusLabel(s) { return { closed: 'Закрыта', active: 'Активна', negotiating: 'Переговоры', failed: 'Не состоялась' }[s] || s }

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

function useTemplate(ts) { alert('Шаблон "' + ts.name + '" применён') }

const newDeal = ref({ company: '', round: '', totalRound: 0, fstAmount: 0, coInvestorsStr: '', closeDate: '' })

function addDeal() {
  synDeals.value.push({
    id: Date.now(),
    company: newDeal.value.company,
    round: newDeal.value.round,
    totalRound: newDeal.value.totalRound,
    fstAmount: newDeal.value.fstAmount,
    fstPct: Math.round(newDeal.value.fstAmount / newDeal.value.totalRound * 100),
    coInvestors: newDeal.value.coInvestorsStr.split(',').map(s => s.trim()),
    status: 'negotiating',
    closeDate: newDeal.value.closeDate
  })
  showAddDeal.value = false
}

function exportSyndication() { alert('Экспорт данных синдикации') }
</script>

<style scoped>
.syn-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.syn-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.syn-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.syn-sub { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.syn-actions { display: flex; gap: 8px; }
.syn-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.syn-btn.primary  { background: var(--p-primary-color); color: #fff; }
.syn-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }

.syn-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.ss-card { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 14px; text-align: center; }
.ss-val { font-size: 1.5rem; font-weight: 700; }
.ss-val.green { color: #66bb6a; } .ss-val.blue { color: var(--p-primary-color); }
.ss-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }

.syn-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.syn-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.investor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.inv-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.inv-header { display: flex; align-items: center; gap: 10px; }
.inv-avatar { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: #fff; }
.inv-avatar.gov     { background: #1565c0; }
.inv-avatar.private { background: #7b1fa2; }
.inv-info { flex: 1; }
.inv-name { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); }
.inv-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.inv-rel { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; }
.inv-rel.active    { background: #66bb6a22; color: #66bb6a; }
.inv-rel.potential { background: var(--p-surface-border); color: var(--p-text-muted-color); }
.inv-stats { display: flex; gap: 12px; }
.inv-stat { display: flex; flex-direction: column; gap: 1px; }
.inv-stat span { font-size: 0.65rem; color: var(--p-text-muted-color); }
.inv-stat strong { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.inv-focus { display: flex; gap: 4px; flex-wrap: wrap; }
.focus-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; background: var(--p-surface-border); color: var(--p-text-muted-color); }

.syn-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 600px; }
.syn-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.72rem; }
.syn-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.deal-name { font-weight: 600; }
.deal-round { font-size: 0.72rem; color: var(--p-text-muted-color); }
.num { text-align: right; }
.share-pct { font-size: 0.68rem; color: var(--p-text-muted-color); }
.co-list { display: flex; gap: 4px; flex-wrap: wrap; }
.co-chip { font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-surface-border); }
.deal-status { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.deal-status.closed      { background: #66bb6a22; color: #66bb6a; }
.deal-status.active      { background: #42a5f522; color: #42a5f5; }
.deal-status.negotiating { background: #ff980022; color: #ff9800; }
.deal-date { font-size: 0.75rem; color: var(--p-text-muted-color); }

.ts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.ts-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.ts-name { font-weight: 700; font-size: 0.88rem; color: var(--p-primary-color); }
.ts-desc { font-size: 0.75rem; color: var(--p-text-muted-color); }
.ts-terms { display: flex; flex-direction: column; gap: 4px; }
.ts-term { display: flex; gap: 6px; font-size: 0.78rem; }
.tt-label { color: var(--p-text-muted-color); min-width: 100px; }
.tt-val { font-weight: 600; color: var(--p-text-color); }
.ts-btn { margin-top: auto; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--p-primary-color); background: transparent; color: var(--p-primary-color); cursor: pointer; font-size: 0.78rem; font-weight: 600; }
.ts-btn:hover { background: var(--p-primary-color); color: #fff; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--p-content-background); border-radius: 12px; padding: 24px; width: 400px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>

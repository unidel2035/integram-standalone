<template>
  <FstPageLayout title="Реестр производителей БПЛА" subtitle="Интеграция с реестром отечественных БПЛА по Постановлению Правительства №1726">
    <template #actions>
      <button class="reg-btn secondary" @click="syncRegistry">Синхронизировать</button>
        <button class="reg-btn primary" @click="showApplication = true">Подать заявку</button>
    </template>

    <!-- Статус синхронизации -->
    <div class="reg-sync-bar">
      <div class="sync-item" v-for="s in syncStatus" :key="s.label">
        <div class="sync-icon" :class="s.status">{{ s.status === 'ok' ? '✓' : s.status === 'sync' ? '↻' : '!' }}</div>
        <div class="sync-label">{{ s.label }}</div>
        <div class="sync-time">{{ s.time }}</div>
      </div>
    </div>

    <!-- Портфельные компании в реестре -->
    <div class="reg-section">
      <h2>Портфельные компании — статус в реестре ПП-1726</h2>
      <div class="portfolio-status">
        <div v-for="co in portfolioStatus" :key="co.name" class="co-status-card">
          <div class="cos-header">
            <div class="cos-name">{{ co.name }}</div>
            <span class="cos-badge" :class="co.status">{{ coStatusLabel(co.status) }}</span>
          </div>
          <div class="cos-products">
            <div v-for="p in co.products" :key="p.model" class="cos-product">
              <div class="prod-model">{{ p.model }}</div>
              <div class="prod-reg" :class="p.registered ? 'registered' : 'not-registered'">
                {{ p.registered ? `Рег. №${p.regNum}` : 'Не зарегистрирован' }}
              </div>
              <div class="prod-cat">{{ p.category }}</div>
            </div>
          </div>
          <div class="cos-actions">
            <button class="small-btn" @click="applyForRegistration(co)">{{ co.status === 'registered' ? 'Обновить' : 'Зарегистрировать' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Поиск по реестру -->
    <div class="reg-section">
      <h2>Поиск в реестре отечественных БПЛА</h2>
      <div class="search-bar">
        <input v-model="searchQuery" placeholder="Модель, производитель или рег. номер..." class="reg-search" @keyup.enter="doSearch" />
        <select v-model="categoryFilter" class="reg-select">
          <option value="">Все категории</option>
          <option>Мультироторный</option>
          <option>Самолётного типа</option>
          <option>Вертолётного типа</option>
          <option>Наземный робот</option>
        </select>
        <button class="reg-btn primary" @click="doSearch">Найти</button>
      </div>
      <table class="reg-table" v-if="searchResults.length">
        <thead>
          <tr>
            <th>Рег. №</th>
            <th>Производитель</th>
            <th>Модель</th>
            <th>Категория</th>
            <th>Макс. взл. масса</th>
            <th>Применение</th>
            <th>Дата регистрации</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in searchResults" :key="r.regNum" :class="{ 'portfolio-row': r.isPortfolio }">
            <td class="reg-num">{{ r.regNum }}</td>
            <td class="reg-manufacturer">{{ r.manufacturer }}</td>
            <td class="reg-model">{{ r.model }}</td>
            <td class="reg-cat">{{ r.category }}</td>
            <td class="num">{{ r.maxWeight }} кг</td>
            <td class="reg-use">{{ r.useCase }}</td>
            <td class="reg-date">{{ r.registeredAt }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="searched" class="no-results">Ничего не найдено</div>
    </div>

    <!-- Требования к регистрации -->
    <div class="reg-section">
      <h2>Требования ПП-1726 к включению в реестр</h2>
      <div class="req-grid">
        <div v-for="r in requirements" :key="r.title" class="req-card">
          <div class="req-title">{{ r.title }}</div>
          <div class="req-desc">{{ r.desc }}</div>
          <div class="req-threshold">Порог: {{ r.threshold }}</div>
        </div>
      </div>
    </div>

    <!-- Application modal -->
    <div v-if="showApplication" class="modal-overlay" @click.self="showApplication = false">
      <div class="modal-box">
        <h3>Заявка на включение в реестр</h3>
        <div class="modal-form">
          <label>Производитель</label>
          <input v-model="appForm.manufacturer" />
          <label>Модель БПЛА</label>
          <input v-model="appForm.model" />
          <label>Категория</label>
          <select v-model="appForm.category">
            <option>Мультироторный</option>
            <option>Самолётного типа</option>
            <option>Вертолётного типа</option>
          </select>
          <label>Максимальная взлётная масса, кг</label>
          <input v-model.number="appForm.maxWeight" type="number" step="0.1" />
          <label>Уровень локализации, %</label>
          <input v-model.number="appForm.localization" type="number" step="5" />
        </div>
        <div class="modal-actions">
          <button class="reg-btn secondary" @click="showApplication = false">Отмена</button>
          <button class="reg-btn primary" @click="submitApplication">Отправить заявку</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const showApplication = ref(false)
const searchQuery     = ref('')
const categoryFilter  = ref('')
const searchResults   = ref([])
const searched        = ref(false)

const syncStatus = ref([
  { label: 'Минпромторг реестр',  status: 'ok',   time: 'Обновлён 06.03.2026' },
  { label: 'Росавиация БВС',      status: 'ok',   time: 'Обновлён 06.03.2026' },
  { label: 'Роспатент патенты',   status: 'ok',   time: 'Обновлён 05.03.2026' },
  { label: 'ЕГРЮЛ проверка',      status: 'sync', time: 'Синхр. в процессе...' }
])

const portfolioStatus = ref([
  {
    name: 'АгроДрон',
    status: 'registered',
    products: [
      { model: 'AD-A1 Агро', registered: true, regNum: 'БПЛА-2024-01847', category: 'Мультироторный' },
      { model: 'AD-A2 Опрыскиватель', registered: true, regNum: 'БПЛА-2024-02103', category: 'Мультироторный' }
    ]
  },
  {
    name: 'DroneLogistics',
    status: 'partial',
    products: [
      { model: 'DL-C10 Cargo', registered: true, regNum: 'БПЛА-2025-00341', category: 'Мультироторный' },
      { model: 'DL-F1 Fast',   registered: false, regNum: null, category: 'Самолётного типа' }
    ]
  },
  {
    name: 'CyberPilot',
    status: 'pending',
    products: [
      { model: 'CP-UTM System', registered: false, regNum: null, category: 'ПО / UTM' }
    ]
  },
  {
    name: 'МедТех БПЛА',
    status: 'not_registered',
    products: [
      { model: 'MT-Med1 Экстренный', registered: false, regNum: null, category: 'Мультироторный' }
    ]
  }
])

function coStatusLabel(s) { return { registered: 'В реестре', partial: 'Частично', pending: 'На рассмотрении', not_registered: 'Не зарегистрирован' }[s] || s }

function doSearch() {
  searched.value = true
  searchResults.value = [
    { regNum: 'БПЛА-2024-01847', manufacturer: 'АгроДрон (ФСТ)',      model: 'AD-A1 Агро',      category: 'Мультироторный',    maxWeight: 25,  useCase: 'Агро-обработка', registeredAt: '2024-07-01', isPortfolio: true  },
    { regNum: 'БПЛА-2024-02103', manufacturer: 'АгроДрон (ФСТ)',      model: 'AD-A2 Опрыскив.', category: 'Мультироторный',    maxWeight: 30,  useCase: 'Агро-обработка', registeredAt: '2024-09-15', isPortfolio: true  },
    { regNum: 'БПЛА-2025-00341', manufacturer: 'DroneLogistics (ФСТ)', model: 'DL-C10 Cargo',    category: 'Мультироторный',    maxWeight: 50,  useCase: 'Доставка грузов', registeredAt: '2025-03-01', isPortfolio: true },
    { regNum: 'БПЛА-2023-10241', manufacturer: 'Геоскан',             model: 'Геоскан 201',     category: 'Самолётного типа',  maxWeight: 3.6, useCase: 'Картография',    registeredAt: '2023-05-20', isPortfolio: false },
    { regNum: 'БПЛА-2023-11892', manufacturer: 'ZALA AERO',           model: 'ZALA 421-16',     category: 'Самолётного типа',  maxWeight: 2.8, useCase: 'Разведка',       registeredAt: '2023-08-10', isPortfolio: false }
  ].filter(r => !searchQuery.value || r.model.toLowerCase().includes(searchQuery.value.toLowerCase()) || r.manufacturer.toLowerCase().includes(searchQuery.value.toLowerCase()))
}

const requirements = ref([
  { title: 'Локализация производства',  desc: 'Доля российских компонентов по стоимости',        threshold: '≥ 60%'     },
  { title: 'Регистрация в ЕГРЮЛ',      desc: 'Производитель — российское юридическое лицо',      threshold: 'Обязательно' },
  { title: 'ГОСТ Р сертификация',      desc: 'Соответствие национальным стандартам безопасности', threshold: 'ГОСТ Р 58785' },
  { title: 'Сертификация Росавиации',  desc: 'Для аппаратов > 250 г требуется сертификат',       threshold: '> 250 г'     },
  { title: 'TRL',                       desc: 'Технологическая готовность',                       threshold: '≥ TRL 7'    },
  { title: 'Производственная мощность', desc: 'Подтверждённые объёмы производства в РФ',          threshold: '≥ 50 ед./год' }
])

const appForm = ref({ manufacturer: '', model: '', category: 'Мультироторный', maxWeight: 5, localization: 70 })

function applyForRegistration(co) { showApplication.value = true; appForm.value.manufacturer = co.name }
function submitApplication() { alert('Заявка на регистрацию отправлена в Минпромторг'); showApplication.value = false }
function syncRegistry() { syncStatus.value[3].status = 'ok'; syncStatus.value[3].time = 'Обновлён только что' }
</script>

<style scoped>
.reg-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.reg-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.reg-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.reg-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.reg-actions { display: flex; gap: 8px; }
.reg-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.reg-btn.primary  { background: var(--p-primary-color); color: #fff; }
.reg-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }

.reg-sync-bar { display: flex; gap: 0; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; overflow: hidden; }
.sync-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px; border-right: 1px solid var(--surface-border); }
.sync-item:last-child { border-right: none; }
.sync-icon { font-size: 1rem; font-weight: 700; }
.sync-icon.ok   { color: #66bb6a; }
.sync-icon.sync { color: #ff9800; }
.sync-icon.fail { color: #ef5350; }
.sync-label { font-size: 0.72rem; color: var(--p-text-color); text-align: center; font-weight: 600; }
.sync-time  { font-size: 0.65rem; color: var(--p-text-muted-color); }

.reg-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.reg-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.portfolio-status { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.co-status-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; }
.cos-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cos-name { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.cos-badge { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.cos-badge.registered    { background: #66bb6a22; color: #66bb6a; }
.cos-badge.partial       { background: #ff980022; color: #ff9800; }
.cos-badge.pending       { background: #42a5f522; color: #42a5f5; }
.cos-badge.not_registered{ background: #ef535022; color: #ef5350; }
.cos-products { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.cos-product { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; background: var(--surface-card); border-radius: 6px; }
.prod-model { font-weight: 600; font-size: 0.8rem; color: var(--p-text-color); }
.prod-reg { font-size: 0.72rem; font-weight: 600; }
.prod-reg.registered     { color: #66bb6a; }
.prod-reg.not-registered { color: var(--p-text-muted-color); }
.prod-cat { font-size: 0.65rem; color: var(--p-text-muted-color); }
.cos-actions { display: flex; }
.small-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--p-primary-color); background: transparent; color: var(--p-primary-color); cursor: pointer; font-size: 0.75rem; font-weight: 600; }

.search-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.reg-search { flex: 1; min-width: 200px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 8px 12px; color: var(--p-text-color); font-size: 0.85rem; }
.reg-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }
.no-results { text-align: center; color: var(--p-text-muted-color); padding: 20px; font-size: 0.85rem; }

.reg-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 640px; }
.reg-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; }
.reg-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.portfolio-row { background: rgba(99, 102, 241, 0.04); }
.reg-num { font-family: monospace; font-size: 0.72rem; color: var(--p-primary-color); }
.reg-manufacturer { font-weight: 600; }
.reg-model { font-size: 0.82rem; }
.num { text-align: right; }
.reg-use, .reg-date { font-size: 0.72rem; color: var(--p-text-muted-color); }

.req-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.req-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px; }
.req-title { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 4px; }
.req-desc { font-size: 0.72rem; color: var(--p-text-muted-color); margin-bottom: 6px; }
.req-threshold { font-size: 0.78rem; font-weight: 600; color: var(--p-primary-color); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 380px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>

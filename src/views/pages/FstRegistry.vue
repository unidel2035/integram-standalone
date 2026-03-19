<template>
  <FstPageLayout title="Реестр производителей БПЛА" subtitle="Интеграция с реестром отечественных БПЛА по Постановлению Правительства №1726">
    <template #actions>
      <Button label="Синхронизировать" severity="secondary" @click="syncRegistry" />
      <Button label="Подать заявку" @click="showApplication = true" />
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
            <Button :label="co.status === 'registered' ? 'Обновить' : 'Зарегистрировать'" severity="secondary" outlined size="small" @click="applyForRegistration(co)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Поиск по реестру -->
    <div class="reg-section">
      <h2>Поиск в реестре отечественных БПЛА</h2>
      <div class="search-bar">
        <InputText v-model="searchQuery" placeholder="Модель, производитель или рег. номер..." class="reg-search" @keyup.enter="doSearch" />
        <Select v-model="categoryFilter" :options="categoryOptions" placeholder="Все категории" size="small" />
        <Button label="Найти" @click="doSearch" />
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
    <Dialog v-model:visible="showApplication" header="Заявка на включение в реестр" :style="{ width: '380px' }" modal>
      <div class="modal-form">
        <label>Производитель</label>
        <InputText v-model="appForm.manufacturer" fluid />
        <label>Модель БПЛА</label>
        <InputText v-model="appForm.model" fluid />
        <label>Категория</label>
        <Select v-model="appForm.category" :options="appCategoryOptions" fluid />
        <label>Максимальная взлётная масса, кг</label>
        <InputText v-model.number="appForm.maxWeight" type="number" step="0.1" fluid />
        <label>Уровень локализации, %</label>
        <InputText v-model.number="appForm.localization" type="number" step="5" fluid />
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button label="Отмена" severity="secondary" @click="showApplication = false" />
          <Button label="Отправить заявку" @click="submitApplication" />
        </div>
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'

const showApplication = ref(false)
const searchQuery     = ref('')
const categoryFilter  = ref('')

const categoryOptions = ['', 'Мультироторный', 'Самолётного типа', 'Вертолётного типа', 'Наземный робот']
const appCategoryOptions = ['Мультироторный', 'Самолётного типа', 'Вертолётного типа']
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
.reg-sync-bar { display: flex; gap: 0; background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; overflow: hidden; }
.sync-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px; border-right: 1px solid var(--p-content-border-color); }
.sync-item:last-child { border-right: none; }
.sync-icon { font-size: 1rem; font-weight: 700; }
.sync-icon.ok   { color: var(--fst-green); }
.sync-icon.sync { color: var(--fst-brand); }
.sync-icon.fail { color: var(--fst-red); }
.sync-label { font-size: 0.72rem; color: var(--p-text-color); text-align: center; font-weight: 600; }
.sync-time  { font-size: 0.65rem; color: var(--p-text-muted-color); }

.reg-section { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; overflow-x: auto; }
.reg-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.portfolio-status { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.co-status-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 14px; }
.cos-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cos-name { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.cos-badge { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.cos-badge.registered    { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.cos-badge.partial       { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.cos-badge.pending       { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.cos-badge.not_registered{ background: color-mix(in srgb, var(--fst-red) 13%, transparent); color: var(--fst-red); }
.cos-products { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.cos-product { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; background: var(--p-surface-card); border-radius: 6px; }
.prod-model { font-weight: 600; font-size: 0.8rem; color: var(--p-text-color); }
.prod-reg { font-size: 0.72rem; font-weight: 600; }
.prod-reg.registered     { color: var(--fst-green); }
.prod-reg.not-registered { color: var(--p-text-muted-color); }
.prod-cat { font-size: 0.65rem; color: var(--p-text-muted-color); }
.cos-actions { display: flex; }

.search-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.reg-search { flex: 1; min-width: 200px; }
.no-results { text-align: center; color: var(--p-text-muted-color); padding: 20px; font-size: 0.85rem; }

.reg-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 640px; }
.reg-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); font-size: 0.72rem; }
.reg-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.portfolio-row { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }
.reg-num { font-family: monospace; font-size: 0.72rem; color: var(--p-primary-color); }
.reg-manufacturer { font-weight: 600; }
.reg-model { font-size: 0.82rem; }
.num { text-align: right; }
.reg-use, .reg-date { font-size: 0.72rem; color: var(--p-text-muted-color); }

.req-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.req-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 12px; }
.req-title { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 4px; }
.req-desc { font-size: 0.72rem; color: var(--p-text-muted-color); margin-bottom: 6px; }
.req-threshold { font-size: 0.78rem; font-weight: 600; color: var(--p-primary-color); }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .reg-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .portfolio-status { grid-template-columns: 1fr !important; }
  .req-grid { grid-template-columns: 1fr !important; }
}
</style>

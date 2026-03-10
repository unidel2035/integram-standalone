<template>
  <FstPageLayout title="Подать заявку в ФСТ НТИ">
    <Toast position="bottom-center" />
    <div class="apply-hero">
      <h1>Подать заявку в ФСТ НТИ</h1>
      <p>Фонд инвестирует в технологические компании в сфере БАС, робототехники и малой энергетики на стадиях Seed, A и B</p>
      <div class="apply-criteria">
        <div class="ac-item" v-for="c in criteria" :key="c.label">
          <span class="ac-icon">{{ c.icon }}</span>
          <div>
            <div class="ac-title">{{ c.label }}</div>
            <div class="ac-val">{{ c.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Баннер предзаполнения -->
    <div v-if="prefilled" class="apply-prefill-banner">
      <i class="pi pi-robot"></i>
      Данные предзаполнены из диалога с AI-агентом Стартапер — проверьте и дополните при необходимости
    </div>

    <!-- Форма -->
    <div v-if="!submitted" class="apply-form-wrap">
      <!-- Прогресс -->
      <div class="apply-steps">
        <div v-for="(step, i) in steps" :key="i" :class="['apply-step', { active: currentStep === i, done: currentStep > i }]">
          <div class="step-circle">{{ currentStep > i ? '✓' : i + 1 }}</div>
          <div class="step-label">{{ step }}</div>
        </div>
      </div>

      <!-- Шаг 1: Компания -->
      <div v-if="currentStep === 0" class="step-form">
        <h2>Информация о компании</h2>
        <div class="form-grid">
          <div class="form-field required full">
            <label>Название компании</label>
            <input v-model="form.companyName" placeholder="ООО «МоёПредприятие»" />
          </div>
          <div class="form-field">
            <label>Форма собственности</label>
            <select v-model="form.legalForm">
              <option value="">— выберите —</option>
              <option>ООО</option><option>АО</option><option>ЗАО</option>
              <option>ИП</option><option>ПАО</option><option>НКО</option>
            </select>
          </div>
          <div class="form-field">
            <label>ИНН</label>
            <input v-model="form.inn" placeholder="1234567890" maxlength="12" />
          </div>
          <div class="form-field">
            <label>ОГРН</label>
            <input v-model="form.ogrn" placeholder="1027700132195" maxlength="15" />
          </div>
          <div class="form-field">
            <label>КПП</label>
            <input v-model="form.kpp" placeholder="770901001" maxlength="9" />
          </div>
          <div class="form-field required">
            <label>Email для связи</label>
            <input v-model="form.email" type="email" placeholder="founder@company.ru" />
          </div>
          <div class="form-field">
            <label>Телефон</label>
            <input v-model="form.phone" placeholder="+7 (999) 000-00-00" />
          </div>
          <div class="form-field">
            <label>Сайт компании</label>
            <input v-model="form.website" placeholder="https://..." />
          </div>
          <div class="form-field">
            <label>Регион / Город</label>
            <input v-model="form.city" placeholder="Москва" />
          </div>
          <div class="form-field full">
            <label>Юридический адрес</label>
            <input v-model="form.legalAddress" placeholder="123456, г. Москва, ул. Примерная, д. 1" />
          </div>
          <div class="form-field">
            <label>ФИО руководителя</label>
            <input v-model="form.ceoName" placeholder="Иванов Иван Иванович" />
          </div>
          <div class="form-field">
            <label>Должность руководителя</label>
            <input v-model="form.ceoTitle" placeholder="Генеральный директор / CEO" />
          </div>
          <div class="form-field">
            <label>Год основания</label>
            <input v-model.number="form.foundedYear" type="number" min="2000" max="2026" />
          </div>
          <div class="form-field">
            <label>Кол-во сотрудников</label>
            <input v-model.number="form.teamSize" type="number" step="1" placeholder="15" />
          </div>
          <div class="form-field required">
            <label>Отрасль / Сектор</label>
            <select v-model="form.sector">
              <option value="">— выберите —</option>
              <option>Беспилотные авиационные системы (БАС)</option>
              <option>Наземная робототехника</option>
              <option>Малая распределённая энергетика (МЭ)</option>
              <option>Компоненты и материалы для БАС</option>
              <option>Программное обеспечение для БПЛА</option>
              <option>Сервисы и услуги на базе БПЛА</option>
            </select>
          </div>
          <div class="form-field">
            <label>Резидентство / акселераторы</label>
            <input v-model="form.residency" placeholder="Сколково, ИННОПОЛИС, Фонд НТИ..." />
          </div>
          <div class="form-field full">
            <label>Состав ключевой команды</label>
            <textarea v-model="form.teamDesc" rows="2" placeholder="ФИО, роль, компетенции..."></textarea>
          </div>
          <div class="form-field full">
            <label>Выручка компании за последние 3 года, млн ₽</label>
            <input v-model="form.revenue3y" placeholder="2022: 5, 2023: 12, 2024: 28" />
          </div>
        </div>
      </div>

      <!-- Шаг 2: Проект и технология -->
      <div v-if="currentStep === 1" class="step-form">
        <h2>Проект и технология</h2>
        <div class="form-grid">
          <div class="form-field full">
            <label>Цели проекта</label>
            <textarea v-model="form.projectGoals" rows="3" placeholder="Каких результатов планируете достичь за срок реализации?"></textarea>
          </div>
          <div class="form-field full">
            <label>Технологический результат</label>
            <textarea v-model="form.techResult" rows="2" placeholder="Конкретный технологический артефакт / изделие / ПО..."></textarea>
          </div>
          <div class="form-field full">
            <label>Коммерческий результат</label>
            <textarea v-model="form.commercialResult" rows="2" placeholder="Ожидаемые контракты, выручка, клиенты..."></textarea>
          </div>
          <div class="form-field full">
            <label>Уровень готовности технологии (TRL 1–9)</label>
            <div class="trl-slider-wrap">
              <input v-model.number="form.trl" type="range" min="1" max="9" step="1" class="trl-slider" />
              <div class="trl-val">TRL {{ form.trl }}</div>
              <div class="trl-desc">{{ trlDescription }}</div>
            </div>
          </div>
          <div class="form-field">
            <label>Суверенность (% отечественных компонентов)</label>
            <div class="trl-slider-wrap">
              <input v-model.number="form.sovereignty" type="range" min="0" max="100" step="5" class="trl-slider" />
              <div class="trl-val">{{ form.sovereignty }}%</div>
            </div>
          </div>
          <div class="form-field">
            <label>Двойное назначение</label>
            <select v-model="form.dualUse">
              <option value="">— выберите —</option>
              <option>Только гражданское</option>
              <option>Возможно двойное применение</option>
              <option>Явное двойное назначение</option>
            </select>
          </div>
          <div class="form-field full">
            <label>Научно-технический задел</label>
            <textarea v-model="form.rdBacklog" rows="2" placeholder="Патенты, НИР, опытные образцы, публикации..."></textarea>
          </div>
          <div class="form-field full">
            <label>РИД и ОИС (интеллектуальная собственность)</label>
            <textarea v-model="form.rid" rows="2" placeholder="Количество патентов, статус, охраняемые РИД..."></textarea>
          </div>
          <div class="form-field">
            <label>Сроки реализации проекта</label>
            <input v-model="form.timeline" placeholder="напр. 24 мес. (2025–2026)" />
          </div>
          <div class="form-field">
            <label>Общая стоимость проекта, млн ₽</label>
            <input v-model.number="form.projectCost" type="number" step="1" />
          </div>
        </div>
      </div>

      <!-- Шаг 3: Рынок -->
      <div v-if="currentStep === 2" class="step-form">
        <h2>Рынок и конкуренция</h2>
        <div class="form-grid">
          <div class="form-field full">
            <label>Потенциальные заказчики / клиенты</label>
            <textarea v-model="form.potentialCustomers" rows="2" placeholder="Кто будет платить? Первые клиенты / LOI?"></textarea>
          </div>
          <div class="form-field full">
            <label>Модель монетизации</label>
            <textarea v-model="form.monetizationModel" rows="2" placeholder="Продажа изделий, подписка, SaaS, сервисный контракт..."></textarea>
          </div>
          <div class="form-field full">
            <label>TAM / SAM / SOM — Россия, млрд ₽</label>
            <input v-model="form.tamSamSomRf" placeholder="TAM=300, SAM=40, SOM=4" />
          </div>
          <div class="form-field full">
            <label>TAM / SAM / SOM — зарубежные рынки, млрд ₽ (при наличии)</label>
            <input v-model="form.tamSamSomAbroad" placeholder="TAM=500, SAM=60, SOM=5" />
          </div>
          <div class="form-field">
            <label>Целевые экспортные рынки</label>
            <input v-model="form.exportMarkets" placeholder="ОАЭ, Иран, Бразилия..." />
          </div>
          <div class="form-field">
            <label>Ключевые конкуренты</label>
            <input v-model="form.competitors" placeholder="Компания А, Компания Б..." />
          </div>
          <div class="form-field full">
            <label>Конкурентный анализ и УТП</label>
            <textarea v-model="form.competitiveAnalysis" rows="3" placeholder="В чём ваше преимущество? Барьеры входа для конкурентов..."></textarea>
          </div>
        </div>
      </div>

      <!-- Шаг 4: Финансы и команда -->
      <div v-if="currentStep === 3" class="step-form">
        <h2>Финансы и команда</h2>
        <div class="form-grid">
          <div class="form-field required">
            <label>Запрашиваемые инвестиции, млн ₽</label>
            <input v-model.number="form.amount" type="number" step="5" />
          </div>
          <div class="form-field">
            <label>Предложение доли, %</label>
            <input v-model.number="form.equityOffered" type="number" step="0.5" />
          </div>
          <div class="form-field">
            <label>Pre-money оценка, млн ₽</label>
            <input v-model.number="form.preMoney" type="number" step="10" />
          </div>
          <div class="form-field">
            <label>Текущая выручка ARR, млн ₽</label>
            <input v-model.number="form.arr" type="number" step="0.5" />
          </div>
          <div class="form-field">
            <label>Прогноз IRR, %</label>
            <input v-model.number="form.irrForecast" type="number" step="1" placeholder="35" />
          </div>
          <div class="form-field">
            <label>Runway, мес.</label>
            <input v-model.number="form.runway" type="number" step="1" />
          </div>
          <div class="form-field full">
            <label>Стратегия выхода (exit)</label>
            <textarea v-model="form.exitStrategy" rows="2" placeholder="IPO, M&A, стратегический покупатель, buyback..."></textarea>
          </div>
          <div class="form-field full">
            <label>Опыт работы с институтами развития</label>
            <textarea v-model="form.devInstitutions" rows="2" placeholder="Сколково, ФРП, РВК, РФРИТ, Фонд НТИ..."></textarea>
          </div>
          <div class="form-field full">
            <label>Государственное финансирование (гранты, субсидии)</label>
            <textarea v-model="form.govFunding" rows="2" placeholder="Получены / поданы гранты, сумма, источник..."></textarea>
          </div>
        </div>
      </div>

      <!-- Шаг 5: Документы и контакты -->
      <div v-if="currentStep === 4" class="step-form">
        <h2>Документы и контакты</h2>
        <div class="form-grid">
          <div class="form-field full">
            <label>Pitch Deck (PDF/PPT)</label>
            <div class="file-drop" @dragover.prevent @drop.prevent="handleDrop($event, 'pitch')">
              <input type="file" accept=".pdf,.pptx" @change="handleFile($event, 'pitch')" hidden ref="pitchInput" />
              <button class="file-btn" @click="$refs.pitchInput.click()">Выбрать файл</button>
              <span class="file-name">{{ form.pitchFile || 'Или перетащите файл сюда' }}</span>
            </div>
          </div>
          <div class="form-field full">
            <label>Финансовая модель (Excel)</label>
            <div class="file-drop">
              <input type="file" accept=".xlsx,.xls" @change="handleFile($event, 'model')" hidden ref="modelInput" />
              <button class="file-btn" @click="$refs.modelInput.click()">Выбрать файл</button>
              <span class="file-name">{{ form.modelFile || 'Или перетащите файл сюда' }}</span>
            </div>
          </div>
          <div class="form-field">
            <label>Telegram</label>
            <input v-model="form.telegram" placeholder="@username" />
          </div>
          <div class="form-field full">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.agreeNda" />
              Я согласен на обработку персональных данных и подписание NDA при необходимости
            </label>
          </div>
        </div>

        <!-- Скоринг-превью -->
        <div class="scoring-preview">
          <h3>Предварительная оценка заявки</h3>
          <div class="score-rows">
            <div v-for="s in scoringRows" :key="s.label" class="score-row">
              <span>{{ s.label }}</span>
              <div class="score-bar-wrap">
                <div class="score-bar" :style="{ width: s.score + '%', background: s.color }"></div>
              </div>
              <span class="score-num">{{ s.score }}/100</span>
            </div>
          </div>
          <div class="gate-result" :class="gatePass ? 'pass' : 'fail'">
            {{ gatePass ? '✓ Заявка соответствует базовым критериям фонда' : '✗ Требует доработки перед подачей' }}
          </div>
        </div>
      </div>

      <!-- Навигация -->
      <div class="step-nav">
        <button class="apply-btn secondary" @click="prevStep" :disabled="currentStep === 0">← Назад</button>
        <button v-if="currentStep < steps.length - 1" class="apply-btn primary" @click="nextStep">Далее →</button>
        <button v-else class="apply-btn primary submit" @click="submitApplication" :disabled="!canSubmit || submitting">
          <i v-if="submitting" class="pi pi-spin pi-spinner" style="font-size: 0.9rem; margin-right: 6px;"></i>
          {{ submitting ? 'Отправка...' : 'Отправить заявку' }}
        </button>
      </div>
    </div>

    <!-- Таблица поданных заявок -->
    <div v-if="!submitted" class="apply-table-section">
      <div class="ats-header">
        <h2>Поданные заявки</h2>
        <button class="apply-btn secondary" @click="loadApplications" :disabled="loadingApps">
          <i :class="loadingApps ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"></i>
        </button>
      </div>
      <div v-if="loadingApps" class="ats-empty">Загрузка...</div>
      <div v-else-if="applications.length === 0" class="ats-empty">Заявок пока нет</div>
      <div v-else class="ats-wrap">
        <table class="ats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Компания</th>
              <th>ИНН</th>
              <th>Email</th>
              <th>TRL</th>
              <th>TAM/SAM/SOM (РФ)</th>
              <th>IRR %</th>
              <th>Дата</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="app in applications" :key="app.id">
              <td class="ats-id">FST-{{ app.id }}</td>
              <td class="ats-name">{{ app.name }}</td>
              <td class="ats-muted">{{ app.inn || '—' }}</td>
              <td class="ats-muted">{{ app.email || '—' }}</td>
              <td><span class="ats-badge">TRL {{ app.trl || '—' }}</span></td>
              <td class="ats-muted small">{{ app.tamSamSomRf || '—' }}</td>
              <td class="ats-irr">{{ app.irrForecast ? app.irrForecast + '%' : '—' }}</td>
              <td class="ats-muted small">{{ app.submittedAt ? app.submittedAt.slice(0,10) : '—' }}</td>
              <td>
                <a :href="`https://api.ai2o.ru/fst/edit_obj/${app.id}`" target="_blank" class="ats-icon-btn" title="Открыть в базе"><i class="pi pi-external-link"></i></a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Успех -->
    <div v-else class="apply-success">
      <div class="success-icon">✓</div>
      <h2>Заявка принята!</h2>
      <p>Номер заявки: <strong>{{ applicationId }}</strong></p>
      <p>В течение 5 рабочих дней аналитик ФСТ НТИ свяжется с вами по email <strong>{{ form.email }}</strong></p>
      <div class="next-steps">
        <div class="ns-step" v-for="s in nextSteps" :key="s.title">
          <div class="ns-num">{{ s.num }}</div>
          <div><div class="ns-title">{{ s.title }}</div><div class="ns-desc">{{ s.desc }}</div></div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useToast } from 'primevue/usetoast'
import { createProjectFromApplication, createApplication, createCompany, getApplications } from '@/services/fstApi'
import { useStartuperStore } from '@/stores/startuperStore'
import { useEventStore } from '@/stores/eventStore.js'

const toast = useToast()
const startuperStore = useStartuperStore()
const eventStore = useEventStore()

// ID лида для event log — привязан к ИНН или имени компании
const applyLeadId = computed(() => `apply-${form.value.inn || form.value.companyName?.replace(/\s+/g, '_') || 'draft'}`)
const currentStep = ref(0)
const submitted = ref(false)
const applicationId = ref('')
const submitting = ref(false)
const applications = ref([])
const loadingApps = ref(false)

async function loadApplications() {
  loadingApps.value = true
  try { applications.value = await getApplications() } catch (e) { console.error(e) } finally { loadingApps.value = false }
}
onMounted(loadApplications)
const prefilled = ref(false)

const steps = ['Компания', 'Проект', 'Рынок', 'Финансы', 'Документы']

const criteria = ref([
  { icon: '💰', label: 'Объём инвестиций', value: '50–500 млн ₽' },
  { icon: '📊', label: 'Стадия',           value: 'Seed — Серия B' },
  { icon: '🇷🇺', label: 'Локализация',    value: '> 60% отечественное' },
  { icon: '⚡', label: 'TRL',              value: '≥ 5 (опытный образец)' }
])

const form = ref({
  // Шаг 1 — Компания
  companyName: '', legalForm: '', inn: '', ogrn: '', kpp: '',
  email: '', phone: '', website: '', city: '', legalAddress: '',
  ceoName: '', ceoTitle: '', foundedYear: null, teamSize: null,
  sector: '', residency: '', teamDesc: '', revenue3y: '',
  // Стадия — остаётся в заявке
  stage: '', description: '',
  // Шаг 2 — Проект
  projectGoals: '', techResult: '', commercialResult: '', trl: 5, sovereignty: 70,
  dualUse: '', rdBacklog: '', rid: '', timeline: '', projectCost: null,
  // Шаг 3 — Рынок
  potentialCustomers: '', monetizationModel: '', tamSamSomRf: '', tamSamSomAbroad: '',
  exportMarkets: '', competitors: '', competitiveAnalysis: '',
  // Шаг 4 — Финансы
  amount: 100, equityOffered: 15, preMoney: null, arr: null,
  irrForecast: null, runway: null, exitStrategy: '',
  devInstitutions: '', govFunding: '',
  // Шаг 5 — Документы
  email: '', phone: '', telegram: '', website: '', agreeNda: false,
  pitchFile: '', modelFile: ''
})

const trlDescription = computed(() => {
  const desc = ['', 'Базовые принципы', 'Концепция', 'Экспериментальное подтверждение', 'Лабораторный образец', 'Опытный образец', 'Демонстрация', 'Системная интеграция', 'Квалификация', 'Полностью готово']
  return desc[form.value.trl] || ''
})

const scoringRows = computed(() => [
  { label: 'TRL', score: form.value.trl * 11, color: form.value.trl >= 5 ? '#66bb6a' : '#ef5350' },
  { label: 'Суверенность', score: form.value.sovereignty, color: form.value.sovereignty >= 60 ? '#66bb6a' : '#ff9800' },
  { label: 'Команда', score: form.value.teamSize ? Math.min(100, form.value.teamSize * 5) : 30, color: '#42a5f5' },
  { label: 'IRR прогноз', score: form.value.irrForecast ? Math.min(100, form.value.irrForecast * 1.5) : 20, color: '#ab47bc' }
])

const gatePass = computed(() => form.value.trl >= 5 && form.value.sovereignty >= 60)
const canSubmit = computed(() => form.value.email && form.value.companyName && form.value.agreeNda)

const nextSteps = ref([
  { num: '1', title: 'Скрининг',      desc: '5 раб. дней — первичный анализ аналитиком фонда' },
  { num: '2', title: 'DD',            desc: '2-3 недели — due diligence технологии и команды' },
  { num: '3', title: 'Инвесткомитет', desc: 'Презентация на ИК — при положительном DD' },
  { num: '4', title: 'Term Sheet',    desc: 'Согласование условий и закрытие сделки' }
])

onMounted(() => {
  const p = startuperStore.prefill
  if (p) {
    Object.keys(p).forEach(k => {
      if (p[k] !== null && p[k] !== undefined && p[k] !== '') {
        form.value[k] = p[k]
      }
    })
    prefilled.value = true
    startuperStore.clear()
    toast.add({ severity: 'info', summary: 'Данные из Стартапер', detail: 'Форма предзаполнена данными из диалога с агентом', life: 5000 })
  }
})

function prevStep() { if (currentStep.value > 0) currentStep.value-- }
function nextStep() {
  if (currentStep.value < steps.length - 1) {
    // Фиксируем переход по шагу как шаг заполнения заявки
    if (currentStep.value === 0) {
      eventStore.add('lead', applyLeadId.value, 'APPLY_STARTED', {
        company: form.value.companyName,
        inn:     form.value.inn,
        trl:     form.value.trl,
      })
    }
    currentStep.value++
  }
}

function handleFile(e, type) {
  const file = e.target.files[0]
  if (file) form.value[type + 'File'] = file.name
}

function handleDrop(e, type) {
  const file = e.dataTransfer.files[0]
  if (file) form.value[type + 'File'] = file.name
}

async function submitApplication() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    // 1. Создаём Компания (7828)
    const companyResult = await createCompany({
      name:         form.value.companyName,
      legalForm:    form.value.legalForm,
      inn:          form.value.inn,
      ogrn:         form.value.ogrn,
      kpp:          form.value.kpp,
      email:        form.value.email,
      phone:        form.value.phone,
      website:      form.value.website,
      region:       form.value.city,
      legalAddress: form.value.legalAddress,
      ceoName:      form.value.ceoName,
      ceoTitle:     form.value.ceoTitle,
      foundedYear:  form.value.foundedYear,
      teamSize:     form.value.teamSize,
      sector:       form.value.sector,
      residency:    form.value.residency,
      teamDesc:     form.value.teamDesc,
      revenue3y:    form.value.revenue3y,
    })
    const companyId = companyResult?.obj || companyResult?.id

    // 2. Создаём Заявка (1956) со ссылкой на Компанию
    const appResult = await createApplication({
      companyName:  form.value.companyName,
      companyId,
      inn:          form.value.inn,
      email:        form.value.email,
      description:  form.value.description,
      projectGoals: form.value.projectGoals,
      techResult:   form.value.techResult,
      commercialResult: form.value.commercialResult,
      trl:          form.value.trl,
      dualUse:      form.value.dualUse,
      rdBacklog:    form.value.rdBacklog,
      rid:          form.value.rid,
      timeline:     form.value.timeline,
      projectCost:  form.value.projectCost ? form.value.projectCost * 1_000_000 : null,
      potentialCustomers: form.value.potentialCustomers,
      monetizationModel:  form.value.monetizationModel,
      tamSamSomRf:       form.value.tamSamSomRf,
      tamSamSomAbroad:   form.value.tamSamSomAbroad,
      exportMarkets:     form.value.exportMarkets,
      competitiveAnalysis: form.value.competitiveAnalysis,
      irrForecast:  form.value.irrForecast,
      exitStrategy: form.value.exitStrategy,
      devInstitutions: form.value.devInstitutions,
      govFunding:   form.value.govFunding,
      contacts: `${form.value.ceoName} | ${form.value.email} | ${form.value.phone} | ${form.value.telegram}`.replace(/\s*\|\s*\|?\s*$/,''),
    })

    // Также создаём проект в Проекты ФСТ (1155) для пайплайна
    await createProjectFromApplication(form.value).catch(() => {})

    const id = appResult?.obj || appResult?.id
    applicationId.value = id ? `FST-${id}` : `FST-${Date.now().toString().slice(-6)}`
    submitted.value = true

    // Финальное событие — заявка отправлена
    eventStore.add('lead', applyLeadId.value, 'SENT_TO_IC', {
      company:     form.value.companyName,
      inn:         form.value.inn,
      trl:         form.value.trl,
      sector:      form.value.sector,
      askRub:      form.value.amount,
      applicationId: applicationId.value,
      completeness: 100,
    })

    toast.add({ severity: 'success', summary: 'Заявка отправлена', detail: `Номер: ${applicationId.value}`, life: 5000 })
  } catch (error) {
    console.error('Failed to submit application:', error)
    toast.add({ severity: 'error', summary: 'Ошибка отправки', detail: 'Не удалось отправить заявку. Попробуйте позже или свяжитесь с нами по email.', life: 5000 })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.apply-hero { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 32px; text-align: center; }
.apply-hero h1 { margin: 0 0 8px; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.apply-hero p { font-size: 0.95rem; color: var(--p-text-muted-color); max-width: 600px; margin: 0 auto 20px; }
.apply-criteria { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
.ac-item { display: flex; align-items: center; gap: 10px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 10px 14px; }
.ac-icon { font-size: 1.3rem; }
.ac-title { font-size: 0.72rem; color: var(--p-text-muted-color); }
.ac-val   { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }

.apply-form-wrap { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 28px; display: flex; flex-direction: column; gap: 24px; }

.apply-steps { display: flex; gap: 0; overflow-x: auto; padding-bottom: 4px; }
.apply-step { display: flex; align-items: center; gap: 6px; flex: 1; position: relative; min-width: 80px; }
.apply-step::after { content: '→'; position: absolute; right: -6px; color: var(--p-text-muted-color); font-size: 0.8rem; }
.apply-step:last-child::after { display: none; }
.step-circle { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 700; background: var(--surface-ground); border: 2px solid var(--surface-border); color: var(--p-text-muted-color); flex-shrink: 0; }
.apply-step.active .step-circle { background: var(--p-primary-color); border-color: var(--p-primary-color); color: #fff; }
.apply-step.done .step-circle { background: #66bb6a; border-color: #66bb6a; color: #fff; }
.step-label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.apply-step.active .step-label { color: var(--p-text-color); font-weight: 600; }

.step-form h2 { margin: 0 0 16px; font-size: 1.1rem; color: var(--p-text-color); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field.full { grid-column: 1 / -1; }
.form-field.required label::after { content: ' *'; color: #ef5350; }
.form-field label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.form-field input, .form-field select, .form-field textarea { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 8px 12px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; resize: vertical; }
.form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: var(--p-primary-color); outline: none; }
.checkbox-label { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: var(--p-text-color); cursor: pointer; }
.checkbox-label input { width: auto; margin-top: 2px; accent-color: var(--p-primary-color); }

.trl-slider-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0; }
.trl-slider { flex: 1; min-width: 120px; accent-color: var(--p-primary-color); }
.trl-val  { font-size: 0.95rem; font-weight: 700; color: var(--p-primary-color); min-width: 50px; }
.trl-desc { font-size: 0.72rem; color: var(--p-text-muted-color); width: 100%; }

.file-drop { display: flex; align-items: center; gap: 10px; border: 2px dashed var(--surface-border); border-radius: 8px; padding: 12px; }
.file-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); cursor: pointer; font-size: 0.82rem; }
.file-name { font-size: 0.78rem; color: var(--p-text-muted-color); }

.scoring-preview { margin-top: 8px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 10px; padding: 16px; }
.scoring-preview h3 { margin: 0 0 12px; font-size: 0.9rem; color: var(--p-text-color); }
.score-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.score-row { display: flex; align-items: center; gap: 10px; font-size: 0.82rem; }
.score-row span:first-child { min-width: 100px; color: var(--p-text-muted-color); }
.score-bar-wrap { flex: 1; height: 8px; background: var(--surface-border); border-radius: 4px; overflow: hidden; }
.score-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.score-num { min-width: 50px; text-align: right; font-weight: 600; color: var(--p-text-color); }
.gate-result { padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; }
.gate-result.pass { background: #66bb6a18; color: #66bb6a; border: 1px solid #66bb6a44; }
.gate-result.fail { background: #ef535018; color: #ef5350; border: 1px solid #ef535044; }

.step-nav { display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--surface-border); }
.apply-btn { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.88rem; font-weight: 600; }
.apply-btn.primary { background: var(--p-primary-color); color: #fff; }
.apply-btn.secondary { background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.apply-btn.submit { background: #66bb6a; }

.apply-success { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 48px; text-align: center; }
.success-icon { font-size: 4rem; color: #66bb6a; margin-bottom: 16px; }
.apply-success h2 { margin: 0 0 8px; color: var(--p-text-color); }
.apply-success p { font-size: 0.9rem; color: var(--p-text-muted-color); }
.next-steps { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; text-align: left; max-width: 480px; margin-left: auto; margin-right: auto; }
.ns-step { display: flex; align-items: flex-start; gap: 12px; }
.ns-num { width: 28px; height: 28px; border-radius: 50%; background: var(--p-primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
.ns-title { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); }
.ns-desc  { font-size: 0.75rem; color: var(--p-text-muted-color); }

.apply-prefill-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: 8px; font-size: 0.82rem;
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 30%, transparent);
  color: var(--p-text-color);
}
.apply-prefill-banner i { color: var(--p-primary-color); flex-shrink: 0; }
</style>

<style scoped>
.apply-table-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 12px; padding: 20px; }
.ats-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.ats-header h2 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.ats-empty { text-align: center; padding: 24px; color: var(--p-text-muted-color); font-size: 0.85rem; }
.ats-wrap { overflow-x: auto; }
.ats-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 640px; }
.ats-table th { padding: 6px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; white-space: nowrap; }
.ats-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.ats-id   { font-size: 0.72rem; color: var(--p-text-muted-color); font-family: monospace; }
.ats-name { font-weight: 600; }
.ats-muted { color: var(--p-text-muted-color); }
.ats-muted.small { font-size: 0.75rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ats-badge { background: var(--p-primary-color); color: #fff; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
.ats-irr { font-weight: 700; color: #66bb6a; }
.ats-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--surface-border); color: var(--p-text-muted-color); text-decoration: none; font-size: 0.78rem; transition: all 0.15s; }
.ats-icon-btn:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }
</style>

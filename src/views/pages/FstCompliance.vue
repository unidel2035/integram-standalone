<template>
  <FstPageLayout title="AML/KYC Комплаенс" subtitle="Проверка LP-партнёров и соответствие ФЗ-115, FATF, ЕКС">
    <template #actions>
      <button class="cpl-btn secondary" @click="exportReport">Отчёт AML</button>
        <button class="cpl-btn primary" @click="showAddLp = true">+ Онбординг LP</button>
    </template>

    <!-- KPI compliance -->
    <div class="cpl-kpis">
      <div class="cpl-kpi" v-for="k in kpis" :key="k.label">
        <div class="kpi-val" :class="k.color">{{ k.value }}</div>
        <div class="kpi-lbl">{{ k.label }}</div>
      </div>
    </div>

    <!-- Статус LP по AML/KYC -->
    <div class="cpl-section">
      <h2>LP-партнёры — статус KYC</h2>
      <table class="cpl-table">
        <thead>
          <tr>
            <th>LP-партнёр</th>
            <th>Тип</th>
            <th>KYC-статус</th>
            <th>AML-риск</th>
            <th>Дата верификации</th>
            <th>Следующее обновление</th>
            <th>Ответственный</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lp in lpList" :key="lp.name">
            <td class="lp-name">{{ lp.name }}</td>
            <td class="lp-type">{{ lp.type }}</td>
            <td><span class="kyc-badge" :class="lp.kyc">{{ kycLabel(lp.kyc) }}</span></td>
            <td><span class="risk-badge" :class="lp.risk">{{ riskLabel(lp.risk) }}</span></td>
            <td class="date-col">{{ lp.verifiedAt }}</td>
            <td class="date-col" :class="isExpiring(lp.nextReview) ? 'warn-date' : ''">{{ lp.nextReview }}</td>
            <td class="officer">{{ lp.officer }}</td>
            <td>
              <button class="action-btn" @click="reviewLp(lp)">Проверить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Чек-листы -->
    <div class="cpl-checklists">
      <div class="cpl-section">
        <h2>KYC Чек-лист (новый LP)</h2>
        <div class="checklist">
          <div v-for="item in kycChecklist" :key="item.label" class="check-item">
            <input type="checkbox" v-model="item.done" />
            <div class="check-info">
              <div class="check-label">{{ item.label }}</div>
              <div class="check-basis">{{ item.basis }}</div>
            </div>
            <span class="check-risk" :class="item.risk">{{ item.risk }}</span>
          </div>
        </div>
        <div class="check-result" :class="kycDone ? 'done' : 'pending'">
          {{ kycDone ? '✓ KYC пройден' : `Осталось: ${kycRemaining} пунктов` }}
        </div>
      </div>

      <div class="cpl-section">
        <h2>AML-скрининг</h2>
        <div class="aml-scan-form">
          <input v-model="scanQuery" placeholder="ИНН, ОГРН или ФИО..." class="scan-input" />
          <button class="cpl-btn primary" @click="runScan">Проверить</button>
        </div>
        <div v-if="scanResult" class="scan-result" :class="scanResult.clean ? 'clean' : 'alert'">
          <div class="sr-icon">{{ scanResult.clean ? '✓' : '!' }}</div>
          <div>
            <div class="sr-title">{{ scanResult.clean ? 'Проверка пройдена' : 'Найдены совпадения' }}</div>
            <div class="sr-desc">{{ scanResult.desc }}</div>
            <div v-if="!scanResult.clean" class="sr-sources">Источники: {{ scanResult.sources.join(', ') }}</div>
          </div>
        </div>
        <div class="aml-sources">
          <h3>Источники для скрининга</h3>
          <div class="sources-list">
            <div v-for="s in amlSources" :key="s.name" class="source-item">
              <span class="source-icon" :class="s.active ? 'active' : 'inactive'">{{ s.active ? '●' : '○' }}</span>
              <span class="source-name">{{ s.name }}</span>
              <span class="source-type">{{ s.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Регуляторная карта -->
    <div class="cpl-section">
      <h2>Регуляторная карта</h2>
      <div class="reg-grid">
        <div v-for="r in regulations" :key="r.code" class="reg-card" :class="r.status">
          <div class="reg-code">{{ r.code }}</div>
          <div class="reg-name">{{ r.name }}</div>
          <div class="reg-desc">{{ r.desc }}</div>
          <div class="reg-status">{{ regStatusLabel(r.status) }}</div>
          <div class="reg-deadline">Следующий аудит: {{ r.nextAudit }}</div>
        </div>
      </div>
    </div>

    <!-- Onboarding modal -->
    <div v-if="showAddLp" class="modal-overlay" @click.self="showAddLp = false">
      <div class="modal-box">
        <h3>Онбординг нового LP</h3>
        <div class="modal-form">
          <label>Наименование</label>
          <input v-model="newLp.name" placeholder="Юридическое название" />
          <label>ИНН</label>
          <input v-model="newLp.inn" placeholder="1234567890" maxlength="10" />
          <label>Тип LP</label>
          <select v-model="newLp.type">
            <option>Госкорпорация</option>
            <option>Институциональный инвестор</option>
            <option>Частный LP</option>
            <option>Корпоративный LP</option>
          </select>
          <label>Страна резидентства</label>
          <input v-model="newLp.country" placeholder="Россия" />
          <label>AML-уровень риска</label>
          <select v-model="newLp.risk">
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="cpl-btn secondary" @click="showAddLp = false">Отмена</button>
          <button class="cpl-btn primary" @click="addLp">Начать KYC</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const showAddLp = ref(false)
const scanQuery = ref('')
const scanResult = ref(null)

const kpis = ref([
  { label: 'LP прошли KYC',    value: '8/9',   color: 'green' },
  { label: 'AML высокий риск', value: '0',      color: 'green' },
  { label: 'Истекают 30 дней', value: '2',      color: 'orange' },
  { label: 'Проверок / год',   value: '24',     color: 'blue'  },
  { label: 'Соответствие ФЗ-115', value: '100%', color: 'green' }
])

const lpList = ref([
  { name: 'Росатом',              type: 'Госкорп.',     kyc: 'verified', risk: 'low',    verifiedAt: '2025-06-01', nextReview: '2026-06-01', officer: 'Иванов А.' },
  { name: 'ВЭБ.РФ',              type: 'Институциональный', kyc: 'verified', risk: 'low', verifiedAt: '2025-07-15', nextReview: '2026-07-15', officer: 'Петров С.' },
  { name: 'Сколково',             type: 'Институциональный', kyc: 'verified', risk: 'low', verifiedAt: '2025-08-01', nextReview: '2026-08-01', officer: 'Ким А.' },
  { name: 'ГК Ростех',           type: 'Госкорп.',     kyc: 'verified', risk: 'low',    verifiedAt: '2025-09-10', nextReview: '2026-04-10', officer: 'Иванов А.' },
  { name: 'Частный LP #1',       type: 'Частный LP',   kyc: 'verified', risk: 'medium', verifiedAt: '2025-10-01', nextReview: '2026-04-01', officer: 'Захаров А.' },
  { name: 'Частный LP #2',       type: 'Частный LP',   kyc: 'review',   risk: 'medium', verifiedAt: '2025-11-15', nextReview: '2026-05-15', officer: 'Захаров А.' },
  { name: 'Ренова (корп.фонд)', type: 'Корп. LP',     kyc: 'verified', risk: 'low',    verifiedAt: '2025-12-01', nextReview: '2026-12-01', officer: 'Петров С.' },
  { name: 'АФК Система',         type: 'Корп. LP',     kyc: 'verified', risk: 'low',    verifiedAt: '2025-12-15', nextReview: '2026-12-15', officer: 'Петров С.' },
  { name: 'Новый LP',            type: 'Частный LP',   kyc: 'pending',  risk: 'unknown', verifiedAt: '—',          nextReview: '—',          officer: 'Не назначен' }
])

function kycLabel(s) { return { verified: 'Верифицирован', review: 'На проверке', pending: 'Ожидает KYC' }[s] || s }
function riskLabel(s) { return { low: 'Низкий', medium: 'Средний', high: 'Высокий', unknown: 'Н/О' }[s] || s }
function isExpiring(date) { return date !== '—' && date < new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }
function regStatusLabel(s) { return { compliant: 'Соответствует', review: 'На ревью', pending: 'Ожидает' }[s] || s }

const kycChecklist = ref([
  { label: 'Устав и учредительные документы',    basis: 'ФЗ-115, ст. 7', risk: 'required', done: true  },
  { label: 'Выписка из ЕГРЮЛ (актуальная)',       basis: 'ФЗ-129',        risk: 'required', done: true  },
  { label: 'Данные бенефициарных владельцев',    basis: 'ФЗ-115, ст. 6.1', risk: 'required', done: false },
  { label: 'Финансовая отчётность за 2 года',    basis: 'ФАТФ рекомендация 22', risk: 'required', done: true },
  { label: 'Проверка в санкционных списках',     basis: 'ЕС, OFAC, Роскомнадзор', risk: 'required', done: true },
  { label: 'Политика управления рисками LP',     basis: 'ILPA Principle',  risk: 'preferred', done: false },
  { label: 'NDA подписана',                      basis: 'ФЗ-98 Коммерч. тайна', risk: 'required', done: true }
])

const kycDone = computed(() => kycChecklist.value.every(i => i.done || i.risk === 'preferred'))
const kycRemaining = computed(() => kycChecklist.value.filter(i => !i.done && i.risk === 'required').length)

function runScan() {
  if (!scanQuery.value) return
  setTimeout(() => {
    scanResult.value = {
      clean: true,
      desc: `ИНН/ОГРН "${scanQuery.value}" не найден в санкционных списках и реестрах нежелательных организаций`,
      sources: []
    }
  }, 800)
}

const amlSources = ref([
  { name: 'Реестр МРИ ФНС',          type: 'Налоговый',    active: true  },
  { name: 'Росфинмониторинг (перечень)', type: 'AML',         active: true  },
  { name: 'Реестр Роскомнадзора',     type: 'Блокировки',   active: true  },
  { name: 'ЕС Sanctions List',         type: 'Санкции',      active: true  },
  { name: 'OFAC SDN List',             type: 'Санкции США',  active: false },
  { name: 'PEP база (ФАС/ЦБ)',        type: 'Политически', active: true  },
  { name: 'World-Check / Refinitiv',   type: 'Коммерч.',    active: false }
])

const regulations = ref([
  { code: 'ФЗ-115', name: 'Противодействие отмыванию доходов', desc: 'KYC всех LP, хранение документов 5 лет', status: 'compliant', nextAudit: '2026-07-01' },
  { code: 'ФЗ-156', name: 'Инвестиционные фонды',              desc: 'Отчётность ЦБ РФ ежеквартально',          status: 'compliant', nextAudit: '2026-04-01' },
  { code: 'FATF R.10', name: 'Должная осмотрительность',       desc: 'Enhanced DD для high-risk LP',            status: 'compliant', nextAudit: '2026-09-01' },
  { code: 'FATF R.22', name: 'Профессиональные посредники',    desc: 'KYC через уполномоченных лиц',            status: 'review',    nextAudit: '2026-06-01' }
])

const newLp = ref({ name: '', inn: '', type: 'Институциональный инвестор', country: 'Россия', risk: 'low' })

function reviewLp(lp) { alert(`Запуск KYC-проверки: ${lp.name}`) }

function addLp() {
  lpList.value.push({
    name: newLp.value.name, type: newLp.value.type,
    kyc: 'pending', risk: newLp.value.risk,
    verifiedAt: '—', nextReview: '—', officer: 'Захаров А.'
  })
  showAddLp.value = false
}

function exportReport() { alert('Экспорт AML-отчёта') }
</script>

<style scoped>
.cpl-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.cpl-kpi { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 14px; text-align: center; }
.kpi-val { font-size: 2rem; font-weight: 700; }
.kpi-val.green  { color: var(--fst-green); } .kpi-val.orange { color: var(--fst-brand); } .kpi-val.blue { color: var(--p-primary-color); }
.kpi-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }

.cpl-section { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; }
.cpl-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.cpl-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.cpl-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); font-size: 0.72rem; }
.cpl-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.lp-name { font-weight: 600; }
.lp-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.kyc-badge, .risk-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
.kyc-badge.verified { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.kyc-badge.review   { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.kyc-badge.pending  { background: var(--p-surface-card); color: var(--p-text-muted-color); border: 1px solid var(--p-content-border-color); }
.risk-badge.low     { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.risk-badge.medium  { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.risk-badge.high    { background: color-mix(in srgb, var(--fst-red) 13%, transparent); color: var(--fst-red); }
.risk-badge.unknown { background: var(--p-surface-card); color: var(--p-text-muted-color); }
.date-col { font-size: 0.75rem; }
.warn-date { color: var(--fst-brand); font-weight: 600; }
.officer { font-size: 0.75rem; color: var(--p-text-muted-color); }
.action-btn { padding: 3px 10px; border-radius: 5px; border: 1px solid var(--p-content-border-color); background: var(--p-surface-card); color: var(--p-text-color); cursor: pointer; font-size: 0.75rem; }

.cpl-checklists { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .cpl-checklists { grid-template-columns: 1fr; } 
  .comp-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}

.checklist { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.check-item { display: flex; align-items: flex-start; gap: 8px; }
.check-item input { accent-color: var(--p-primary-color); margin-top: 2px; }
.check-info { flex: 1; }
.check-label { font-size: 0.82rem; color: var(--p-text-color); }
.check-basis { font-size: 0.68rem; color: var(--p-text-muted-color); }
.check-risk { font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.check-risk.required  { background: color-mix(in srgb, var(--fst-red) 12%, transparent); color: var(--fst-red); }
.check-risk.preferred { background: color-mix(in srgb, var(--fst-blue) 12%, transparent); color: var(--fst-blue); }
.check-result { padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; }
.check-result.done    { background: color-mix(in srgb, var(--fst-green) 10%, transparent); color: var(--fst-green); border: 1px solid color-mix(in srgb, var(--fst-green) 27%, transparent); }
.check-result.pending { background: color-mix(in srgb, var(--fst-brand) 10%, transparent); color: var(--fst-brand); border: 1px solid color-mix(in srgb, var(--fst-brand) 27%, transparent); }

.aml-scan-form { display: flex; gap: 8px; margin-bottom: 14px; }
.scan-input { flex: 1; background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 8px 12px; color: var(--p-text-color); font-size: 0.85rem; }
.scan-result { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 8px; margin-bottom: 14px; }
.scan-result.clean { background: color-mix(in srgb, var(--fst-green) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-green) 27%, transparent); }
.scan-result.alert { background: color-mix(in srgb, var(--fst-red) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-red) 27%, transparent); }
.sr-icon { font-size: 1.4rem; font-weight: 700; }
.scan-result.clean .sr-icon { color: var(--fst-green); }
.scan-result.alert .sr-icon { color: var(--fst-red); }
.sr-title { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); }
.sr-desc  { font-size: 0.78rem; color: var(--p-text-muted-color); }
.sr-sources { font-size: 0.72rem; color: var(--fst-red); margin-top: 4px; }
.aml-sources h3 { font-size: 0.88rem; margin: 0 0 10px; color: var(--p-text-color); }
.sources-list { display: flex; flex-direction: column; gap: 6px; }
.source-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
.source-icon { font-size: 0.7rem; }
.source-icon.active   { color: var(--fst-green); }
.source-icon.inactive { color: var(--p-text-muted-color); }
.source-name { flex: 1; color: var(--p-text-color); }
.source-type { font-size: 0.68rem; color: var(--p-text-muted-color); }

.reg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.reg-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 5px; }
.reg-card.compliant { border-left: 3px solid var(--fst-green); }
.reg-card.review    { border-left: 3px solid var(--fst-brand); }
.reg-code { font-weight: 700; font-size: 0.82rem; color: var(--p-primary-color); }
.reg-name { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.reg-desc { font-size: 0.72rem; color: var(--p-text-muted-color); }
.reg-status { font-size: 0.72rem; font-weight: 600; }
.reg-card.compliant .reg-status { color: var(--fst-green); }
.reg-card.review .reg-status    { color: var(--fst-brand); }
.reg-deadline { font-size: 0.68rem; color: var(--p-text-muted-color); }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>

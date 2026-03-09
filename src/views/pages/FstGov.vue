<template>
  <FstPageLayout>
    <template #header>
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        <i class="pi pi-building" style="color:#42a5f5;font-size:20px"></i>
        <div>
          <div style="font-weight:700;font-size:15px">GR-Панель · Government Relations</div>
          <div style="font-size:11px;color:var(--p-text-muted-color)">Меры поддержки · Онтологии · Конструктор новых мер</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <Button icon="pi pi-home" label="ФСТ" size="small" text severity="secondary" @click="$router.push('/fst-hub')" />
      </div>
    </template>

    <!-- Tab bar -->
    <div class="gr-tabs">
      <button v-for="t in TABS" :key="t.id" :class="['gr-tab', { 'gr-tab--active': activeTab === t.id }]" @click="activeTab = t.id">
        <i :class="t.icon" />
        {{ t.label }}
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ 1: Меры поддержки стартапов
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'measures'" class="gr-content">

      <!-- Выбор стартапа для персонального плана -->
      <div class="gr-startup-panel">
        <div class="gr-section-title">
          <i class="pi pi-bolt" style="color:#ffa726"></i>
          Персональный план мер — выберите проект
        </div>
        <div class="gr-startup-row">
          <Select v-model="selectedProject" :options="projects" optionLabel="name"
            placeholder="Выбрать проект из портфеля..." class="gr-select" @change="matchMeasures" />
          <Button v-if="selectedProject" label="Генерировать план" icon="pi pi-sparkles"
            size="small" severity="warning" :loading="planLoading" @click="generatePlan" />
          <Button label="Обновить из БД" icon="pi pi-refresh" size="small" text severity="secondary"
            :loading="projectsLoading" @click="loadProjects" />
        </div>

        <!-- Карточка проекта -->
        <div v-if="selectedProject" class="gr-project-card">
          <div class="gr-pc-row">
            <span class="gr-pc-label">Субфонд</span><span class="gr-pc-val">{{ selectedProject.subFundName || '—' }}</span>
            <span class="gr-pc-label">TRL</span><span class="gr-pc-val">{{ selectedProject.trl || '—' }}</span>
            <span class="gr-pc-label">Стадия</span><span class="gr-pc-val">{{ selectedProject.stageName || 'Посевная' }}</span>
            <span class="gr-pc-label">Запрос</span><span class="gr-pc-val">{{ selectedProject.requestedAmount ? Math.round(selectedProject.requestedAmount/1e6) + ' млн ₽' : '—' }}</span>
            <span class="gr-pc-label">Суверенность</span><span class="gr-pc-val">{{ selectedProject.sovereigntyScore || '—' }}/9</span>
          </div>
          <div v-if="matchedMeasures.length" class="gr-match-summary">
            <Tag :value="`Подходит мер: ${matchedMeasures.length}`" severity="success" />
            <Tag :value="`Потенциал: ${totalPotential}`" severity="info" />
          </div>
        </div>

        <!-- AI план -->
        <div v-if="planText" class="gr-plan-block">
          <div class="gr-plan-header">
            <i class="pi pi-file-check" style="color:#66bb6a"></i>
            <span>AI-план получения мер поддержки · {{ selectedProject?.name }}</span>
          </div>
          <div class="gr-plan-text" v-html="planText"></div>
        </div>
      </div>

      <!-- Банк мер поддержки -->
      <div class="gr-measures-bank">
        <div class="gr-section-title">
          <i class="pi pi-wallet" style="color:#42a5f5"></i>
          Банк мер государственной поддержки
          <span class="gr-count">{{ filteredMeasures.length }} из {{ allMeasures.length }}</span>
        </div>

        <!-- Фильтры -->
        <div class="gr-filters">
          <InputText v-model="searchMeasures" placeholder="Поиск мер..." class="gr-filter-input" />
          <Select v-model="filterType" :options="MEASURE_TYPES" optionLabel="label" optionValue="value"
            placeholder="Тип меры" class="gr-filter-sel" />
          <Select v-model="filterSector" :options="SECTORS" placeholder="Сектор" class="gr-filter-sel" />
          <Button v-if="searchMeasures || filterType || filterSector" icon="pi pi-times" text size="small" @click="clearFilters" />
        </div>

        <!-- Таблица мер -->
        <div class="gr-measures-grid">
          <div v-for="m in filteredMeasures" :key="m.id"
            :class="['gr-measure-card', { 'gr-measure-card--matched': isMeasureMatched(m.id) }]">
            <div class="gr-mc-header">
              <Tag :value="m.type_label" :class="`gr-type-${m.type}`" />
              <Tag v-if="m.status === 'active'" value="Активна" severity="success" />
              <Tag v-else-if="m.status === 'seasonal'" value="Сезонная" severity="warn" />
              <Tag v-else value="Закрыта" severity="secondary" />
              <span v-if="isMeasureMatched(m.id)" class="gr-match-badge">✓ Подходит</span>
            </div>
            <div class="gr-mc-name">{{ m.name }}</div>
            <div class="gr-mc-operator">{{ m.operator }}</div>
            <div class="gr-mc-meta">
              <span><i class="pi pi-wallet" /> {{ m.amount }}</span>
              <span><i class="pi pi-chart-line" /> TRL ≥ {{ m.trl_min }}</span>
              <span><i class="pi pi-tag" /> {{ m.sector.join(', ') }}</span>
            </div>
            <div class="gr-mc-criteria">
              <div v-for="c in m.criteria" :key="c" class="gr-criterion">· {{ c }}</div>
            </div>
            <div v-if="m.deadline" class="gr-mc-deadline">
              <i class="pi pi-calendar" /> Дедлайн: {{ m.deadline }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ 2: Конструктор новых мер
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'constructor'" class="gr-content">

      <!-- Агент анализа пробелов -->
      <div class="gr-agent-panel">
        <div class="gr-agent-header">
          <div class="gr-agent-icon"><i class="pi pi-sitemap" /></div>
          <div>
            <div class="gr-agent-title">Агент «Конвейер новых мер»</div>
            <div class="gr-agent-sub">Анализ пробелов портфеля → событийная онтология → проектирование меры → запуск</div>
          </div>
          <Button label="Запустить анализ пробелов" icon="pi pi-sparkles" size="small"
            severity="warning" :loading="agentLoading" @click="runGapAnalysis" />
        </div>

        <!-- Конвейер -->
        <div class="gr-pipeline">
          <div v-for="(step, i) in pipelineSteps" :key="i" :class="['gr-pipe-step', `gr-pipe-step--${step.status}`]">
            <div class="gr-pipe-dot"><i :class="step.icon" /></div>
            <div class="gr-pipe-body">
              <div class="gr-pipe-name">{{ step.name }}</div>
              <div class="gr-pipe-desc">{{ step.desc }}</div>
            </div>
          </div>
        </div>

        <div v-if="agentOutput" class="gr-agent-output">
          <div class="gr-agent-output-header"><i class="pi pi-bolt" /> Результат анализа</div>
          <div v-html="agentOutput" style="padding:14px;font-size:13px;line-height:1.7"></div>
        </div>
      </div>

      <!-- Событийная онтология -->
      <div class="gr-ontology-panel">
        <div class="gr-section-title">
          <i class="pi pi-sitemap" style="color:#ab47bc"></i>
          Событийная онтология создания новых мер
        </div>
        <div class="gr-onto-grid">
          <div v-for="chain in eventOntology" :key="chain.id" class="gr-onto-chain">
            <div class="gr-onto-trigger">
              <i :class="chain.icon" style="font-size:16px" />
              {{ chain.trigger }}
            </div>
            <div class="gr-onto-events">
              <div v-for="(ev, ei) in chain.events" :key="ei" :class="['gr-onto-event', `gr-onto-event--${ev.type}`]">
                <span class="gr-onto-arrow">→</span>
                <span class="gr-onto-ev-name">{{ ev.name }}</span>
                <span v-if="ev.actor" class="gr-onto-actor">{{ ev.actor }}</span>
              </div>
            </div>
            <div class="gr-onto-result">
              <i class="pi pi-check-circle" style="color:#66bb6a" /> {{ chain.result }}
            </div>
          </div>
        </div>
      </div>

      <!-- Конструктор новой меры -->
      <div class="gr-constructor-panel">
        <div class="gr-section-title">
          <i class="pi pi-plus-circle" style="color:#66bb6a"></i>
          Конструктор новой меры поддержки
        </div>
        <div class="gr-constructor-form">
          <div class="gr-cf-row">
            <div class="gr-cf-group">
              <label>Название меры</label>
              <InputText v-model="newMeasure.name" placeholder="Грант на масштабирование БАС-стартапов..." class="gr-cf-input" />
            </div>
            <div class="gr-cf-group">
              <label>Тип инструмента</label>
              <Select v-model="newMeasure.type" :options="MEASURE_TYPES" optionLabel="label" optionValue="value" class="gr-cf-input" />
            </div>
          </div>
          <div class="gr-cf-row">
            <div class="gr-cf-group">
              <label>Оператор (кто выдаёт)</label>
              <InputText v-model="newMeasure.operator" placeholder="Минпромторг / НТИ / Сколково..." class="gr-cf-input" />
            </div>
            <div class="gr-cf-group">
              <label>Объём финансирования</label>
              <InputText v-model="newMeasure.amount" placeholder="до 50 млн ₽" class="gr-cf-input" />
            </div>
          </div>
          <div class="gr-cf-row">
            <div class="gr-cf-group">
              <label>Проблема / рыночный провал</label>
              <Textarea v-model="newMeasure.problem" rows="2" placeholder="Опишите какой пробел закрывает эта мера..." class="gr-cf-input" />
            </div>
            <div class="gr-cf-group">
              <label>Целевая аудитория</label>
              <InputText v-model="newMeasure.target" placeholder="Стартапы БАС с TRL 5–8, выручка < 200 млн ₽" class="gr-cf-input" />
            </div>
          </div>
          <div class="gr-cf-row">
            <div class="gr-cf-group">
              <label>Триггер события (почему сейчас)</label>
              <InputText v-model="newMeasure.trigger" placeholder="Нацпроект БАС, санкции, технологический суверенитет..." class="gr-cf-input" />
            </div>
            <div class="gr-cf-group">
              <label>Ожидаемый результат</label>
              <InputText v-model="newMeasure.expected" placeholder="50 компаний, 2 тыс. рабочих мест, выручка 10 млрд ₽" class="gr-cf-input" />
            </div>
          </div>

          <!-- Онтологические теги -->
          <div class="gr-cf-group">
            <label>Онтологические теги</label>
            <div class="gr-onto-tags">
              <span v-for="tag in ONTO_TAGS" :key="tag"
                :class="['gr-onto-tag', { 'gr-onto-tag--sel': newMeasure.ontoTags.includes(tag) }]"
                @click="toggleOntoTag(tag)">{{ tag }}</span>
            </div>
          </div>

          <div class="gr-cf-actions">
            <Button label="Сгенерировать концепцию (AI)" icon="pi pi-sparkles" severity="warning"
              :loading="constructorLoading" @click="generateMeasureProposal" />
            <Button label="Сохранить в библиотеку" icon="pi pi-save" severity="success"
              :disabled="!newMeasure.name" @click="saveMeasureToLib" />
            <Button label="Сформировать служебную записку" icon="pi pi-file-edit" severity="info"
              :disabled="!proposalText" @click="generateMemo" />
          </div>
        </div>

        <!-- Концепция -->
        <div v-if="proposalText" class="gr-proposal-block">
          <div class="gr-proposal-header">
            <i class="pi pi-file-edit" style="color:#42a5f5"></i>
            Проектное предложение новой меры
          </div>
          <div v-html="proposalText" class="gr-proposal-text"></div>
        </div>

        <!-- Служебная записка -->
        <div v-if="memoText" class="gr-memo-block">
          <div class="gr-memo-header">
            <i class="pi pi-envelope" style="color:#ffa726"></i>
            Служебная записка — к запуску новой меры
            <Button label="Скопировать" icon="pi pi-copy" size="small" text @click="copyMemo" />
          </div>
          <div v-html="memoText" class="gr-memo-text"></div>
        </div>
      </div>

      <!-- Библиотека предложений -->
      <div v-if="proposalLibrary.length" class="gr-library-panel">
        <div class="gr-section-title">
          <i class="pi pi-book" style="color:#ffa726"></i>
          Библиотека предложений ({{ proposalLibrary.length }})
        </div>
        <div class="gr-library-grid">
          <div v-for="p in proposalLibrary" :key="p.id" class="gr-lib-card">
            <div class="gr-lib-name">{{ p.name }}</div>
            <div class="gr-lib-meta">
              <Tag :value="p.type_label" />
              <span style="color:var(--p-text-muted-color);font-size:11px">{{ p.operator }}</span>
            </div>
            <div class="gr-lib-status--draft">Черновик</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ 3: Регуляторный радар
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'radar'" class="gr-content">
      <div class="gov-kpi-row">
        <div class="gov-kpi" v-for="k in kpis" :key="k.label">
          <div class="gov-kpi-icon">{{ k.icon }}</div>
          <div class="gov-kpi-val">{{ k.value }}</div>
          <div class="gov-kpi-lbl">{{ k.label }}</div>
        </div>
      </div>
      <div class="gov-card">
        <h3>Регуляторный радар БАС-отрасли</h3>
        <div class="radar-list">
          <div v-for="reg in regulations" :key="reg.code" class="radar-item">
            <div class="radar-status">{{ statusIcon(reg.status) }}</div>
            <div class="radar-info">
              <div class="radar-code">{{ reg.code }}</div>
              <div class="radar-name">{{ reg.name }}</div>
              <div class="radar-desc">{{ reg.desc }}</div>
            </div>
            <div class="radar-meta">
              <span class="radar-date">{{ reg.date }}</span>
              <span class="radar-risk" :class="`risk-${reg.risk}`">Риск: {{ reg.risk }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { getProjects } from '@/services/fstApi.js'
import { getMeasures, matchMeasures as matchMeasuresFromService } from '@/services/grMeasuresService.js'
import { ONTOLOGY_TAGS as GR_ONTO_TAGS } from '@/config/grOntology.js'

const toast = useToast()
const activeTab = ref('measures')

const TABS = [
  { id: 'measures',    label: 'Меры поддержки стартапов',  icon: 'pi pi-wallet' },
  { id: 'constructor', label: 'Конструктор новых мер',     icon: 'pi pi-sitemap' },
  { id: 'radar',       label: 'Регуляторный радар',         icon: 'pi pi-shield' },
]

const MEASURE_TYPES = [
  { label: 'Грант',             value: 'grant' },
  { label: 'Займ',              value: 'loan' },
  { label: 'Налоговая льгота',  value: 'tax' },
  { label: 'Статус',            value: 'status' },
  { label: 'Субсидия',          value: 'subsidy' },
  { label: 'Гарантия',          value: 'guarantee' },
]

const SECTORS = ['БПЛА / БАС', 'Робототехника', 'Промышленность', 'ИТ / ПО', 'Аэрокосмос', 'Все секторы']

const ONTO_TAGS = GR_ONTO_TAGS.map(t => t.label)

// ─── Банк мер поддержки (удалён, данные в grMeasuresData.js) ─────────────────
// eslint-disable-next-line no-unused-vars
const _REMOVED = [
  {
    id: 'fond-umnik', name: 'УМНИК — молодёжный научно-инновационный конкурс',
    operator: 'Фонд содействия инновациям', type: 'grant', type_label: 'Грант',
    amount: 'до 500 тыс. ₽', trl_min: 1, sector: ['БПЛА / БАС', 'Робототехника', 'ИТ / ПО'],
    criteria: ['Возраст основателей до 30 лет', 'НИОКР на стадии идеи', 'Российская прописка'],
    stage: ['Pre-seed'], deadline: 'ноябрь ежегодно', status: 'active',
  },
  {
    id: 'fond-start1', name: 'СТАРТ-1 — коммерциализация инновационных разработок',
    operator: 'Фонд содействия инновациям', type: 'grant', type_label: 'Грант',
    amount: 'до 4 млн ₽', trl_min: 3, sector: ['БПЛА / БАС', 'Робототехника', 'Промышленность'],
    criteria: ['Юрлицо до 3 лет', 'Прототип или MVP', 'Без крупных госакционеров'],
    stage: ['Pre-seed', 'Посевная'], deadline: 'апрель / октябрь', status: 'active',
  },
  {
    id: 'fond-start2', name: 'СТАРТ-2 — масштабирование инновационных проектов',
    operator: 'Фонд содействия инновациям', type: 'grant', type_label: 'Грант',
    amount: 'до 20 млн ₽', trl_min: 5, sector: ['БПЛА / БАС', 'Промышленность', 'Робототехника'],
    criteria: ['Завершён СТАРТ-1 или аналог', 'Продажи > 0', 'Сo-financing 50%'],
    stage: ['Посевная', 'Раунд A'], deadline: 'февраль / август', status: 'active',
  },
  {
    id: 'skolkovo-grant', name: 'Грант Сколково на R&D',
    operator: 'Фонд Сколково', type: 'grant', type_label: 'Грант',
    amount: 'до 30 млн ₽', trl_min: 4, sector: ['БПЛА / БАС', 'Робототехника', 'ИТ / ПО', 'Аэрокосмос'],
    criteria: ['Статус участника Сколково', 'Наличие R&D-плана', 'Приоритетные направления'],
    stage: ['Посевная', 'Раунд A'], deadline: 'Rolling basis', status: 'active',
  },
  {
    id: 'skolkovo-status', name: 'Статус участника Сколково (налоговые льготы)',
    operator: 'Фонд Сколково', type: 'tax', type_label: 'Налоговая льгота',
    amount: 'НДС 0%, СВ 7.6%, налог на прибыль 0%', trl_min: 1, sector: ['Все секторы'],
    criteria: ['Выручка < 1 млрд ₽/год', 'Инновационная деятельность'],
    stage: ['Pre-seed', 'Посевная', 'Раунд A', 'Раунд B'], deadline: null, status: 'active',
  },
  {
    id: 'minprom-719', name: 'Постановление 719 — подтверждение российского происхождения',
    operator: 'Минпромторг РФ', type: 'status', type_label: 'Статус',
    amount: 'Доступ к госзакупкам', trl_min: 7, sector: ['БПЛА / БАС', 'Промышленность', 'Аэрокосмос'],
    criteria: ['Локализация ≥ 70%', 'Аудит Минпромторга'],
    stage: ['Раунд A', 'Раунд B'], deadline: null, status: 'active',
  },
  {
    id: 'rfriti-grant', name: 'Грант РФРИТ на разработку отечественного ПО',
    operator: 'РФРИТ (Минцифры)', type: 'grant', type_label: 'Грант',
    amount: 'до 500 млн ₽', trl_min: 5, sector: ['ИТ / ПО', 'Промышленность'],
    criteria: ['Разработка СППО или промышленного ПО', 'Первые клиенты', 'ОКВЭД 62/63'],
    stage: ['Посевная', 'Раунд A', 'Раунд B'], deadline: 'конкурсная основа', status: 'active',
  },
  {
    id: 'nti-grant', name: 'Грант дорожной карты НТИ «Аэронет»',
    operator: 'НТИ / Минэкономразвития', type: 'grant', type_label: 'Грант',
    amount: 'до 100 млн ₽', trl_min: 4, sector: ['БПЛА / БАС', 'Аэрокосмос'],
    criteria: ['Проект в периметре Аэронет', 'Партнёрство с якорным заказчиком'],
    stage: ['Посевная', 'Раунд A'], deadline: 'ежегодный конкурс', status: 'active',
  },
  {
    id: 'bas-natproject', name: 'Субсидия по Нацпроекту БАС (ПП РФ №1421)',
    operator: 'Минпромторг / Минтранс', type: 'subsidy', type_label: 'Субсидия',
    amount: 'до 300 млн ₽', trl_min: 6, sector: ['БПЛА / БАС'],
    criteria: ['Реестр производителей БАС', 'Контракт 2025+', 'TRL ≥ 6'],
    stage: ['Раунд A', 'Раунд B'], deadline: 'плановый период 2025-2030', status: 'active',
  },
  {
    id: 'veb-loan', name: 'Льготный займ ВЭБ.РФ',
    operator: 'ВЭБ.РФ', type: 'loan', type_label: 'Займ',
    amount: 'от 100 млн ₽', trl_min: 6, sector: ['Промышленность', 'БПЛА / БАС', 'Робототехника'],
    criteria: ['Выручка > 50 млн ₽/год', 'Залоговое обеспечение'],
    stage: ['Раунд A', 'Раунд B'], deadline: null, status: 'active',
  },
  {
    id: 'corp-msp', name: 'Льготное кредитование МСП',
    operator: 'Корпорация МСП / Минэкономразвития', type: 'loan', type_label: 'Займ',
    amount: 'до 500 млн ₽ по ставке КС-3%', trl_min: 1, sector: ['Все секторы'],
    criteria: ['Статус МСП', 'Выручка < 2 млрд ₽'],
    stage: ['Pre-seed', 'Посевная', 'Раунд A', 'Раунд B'], deadline: null, status: 'active',
  },
  {
    id: 'minprom-niokr', name: 'Грант на НИОКР (Минпромторг ПП 1649)',
    operator: 'Минпромторг РФ', type: 'grant', type_label: 'Грант',
    amount: 'до 300 млн ₽', trl_min: 3, sector: ['БПЛА / БАС', 'Промышленность', 'Аэрокосмос', 'Робототехника'],
    criteria: ['НИОКР по приоритетным технологиям', 'Соисполнитель ОПК или вуз'],
    stage: ['Посевная', 'Раунд A'], deadline: 'конкурсная основа', status: 'active',
  },
  {
    id: 'spief-fast', name: 'Программа быстрого масштабирования',
    operator: 'Сколково / Росатом', type: 'grant', type_label: 'Грант',
    amount: 'до 50 млн ₽ + менторство', trl_min: 6, sector: ['БПЛА / БАС', 'Промышленность'],
    criteria: ['Готовый продукт TRL ≥ 6', 'Первые B2B/B2G продажи', 'Инд. партнёр'],
    stage: ['Раунд A'], deadline: null, status: 'seasonal',
  },
]

// ─── Таб 1: Данные ─────────────────────────────────────────────────────────────
const allMeasures = ref(getMeasures())  // сразу заполнено из grMeasuresData
const measuresLoading = ref(false)

const projects = ref([])
const projectsLoading = ref(false)
const selectedProject = ref(null)
const planLoading = ref(false)
const planText = ref('')
const matchedMeasures = ref([])
const searchMeasures = ref('')
const filterType = ref(null)
const filterSector = ref(null)

const SUBFUND_NAMES = { 1096: 'БАС', 1098: 'РОБО', 1100: 'МЭ' }
const STAGE_NAMES = { 1115: 'Pre-seed', 1117: 'Посевная', 1119: 'Раунд A', 1123: 'На доработке', 1125: 'В работе', 1127: 'Закрыт' }

async function loadProjects() {
  projectsLoading.value = true
  try {
    const raw = await getProjects()
    projects.value = raw.map(p => ({
      ...p,
      subFundName: SUBFUND_NAMES[p.subFund] || 'БАС',
      stageName: STAGE_NAMES[p.statusId] || 'Посевная',
    }))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ошибка загрузки проектов', detail: e.message, life: 3000 })
  } finally {
    projectsLoading.value = false
  }
}

function getMeasuresSource() {
  return allMeasures.value
}

function matchMeasures() {
  if (!selectedProject.value) { matchedMeasures.value = []; return }
  const p = selectedProject.value
  const trl = p.trl || 4
  const sector = p.subFundName === 'БАС' ? 'БПЛА / БАС'
    : p.subFundName === 'РОБО' ? 'Робототехника' : 'Промышленность'

  matchedMeasures.value = matchMeasuresFromService(selectedProject.value).map(m => m.id)
}

function isMeasureMatched(id) { return matchedMeasures.value.includes(id) }

const totalPotential = computed(() => {
  const amounts = getMeasuresSource()
    .filter(m => matchedMeasures.value.includes(m.id))
    .map(m => parseInt((m.amount || '').replace(/[^\d]/g, '')) || 0)
    .filter(n => n > 0)
  const total = amounts.reduce((s, n) => s + n, 0)
  if (total >= 1000) return `~${Math.round(total/1000)} млрд ₽`
  return total > 0 ? `~${total} млн ₽` : '—'
})

const filteredMeasures = computed(() => {
  let list = getMeasuresSource()
  if (searchMeasures.value) {
    const q = searchMeasures.value.toLowerCase()
    list = list.filter(m => (m.name || '').toLowerCase().includes(q) || (m.operator || '').toLowerCase().includes(q))
  }
  if (filterType.value) list = list.filter(m => m.type === filterType.value)
  if (filterSector.value && filterSector.value !== 'Все секторы') {
    list = list.filter(m => m.sector?.includes(filterSector.value) || m.sector?.includes('Все секторы'))
  }
  return list
})

function clearFilters() { searchMeasures.value = ''; filterType.value = null; filterSector.value = null }

async function generatePlan() {
  if (!selectedProject.value) return
  planLoading.value = true
  planText.value = ''
  matchMeasures()
  const p = selectedProject.value
  const matched = getMeasuresSource().filter(m => matchedMeasures.value.includes(m.id))
  const measuresStr = matched.map((m, i) =>
    `${i+1}. ${m.name} (${m.operator}) — ${m.amount}, TRL≥${m.trl_min}`
  ).join('\n')

  try {
    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        application: 'FstGov-MeasuresPlan',
        systemPrompt: `Ты — GR-аналитик венчурного фонда ФСТ НТИ. Составляй конкретные практические планы получения мер поддержки для стартапов. Используй HTML: <b>, <ul><li>, <p>. Будь конкретен в сроках и шагах.`,
        prompt: `Составь приоритизированный план получения мер поддержки для:
Проект: ${p.name}
Субфонд: ${p.subFundName}, TRL: ${p.trl || 4}, Стадия: ${p.stageName}
Запрос: ${p.requestedAmount ? Math.round(p.requestedAmount/1e6) + ' млн ₽' : 'не указана'}
Суверенность: ${p.sovereigntyScore || '—'}/9

Подходящие меры (${matched.length}):
${measuresStr}

Для каждой меры: приоритет, шаги подачи (3-5 пунктов), сроки, что подготовить, риски отказа.`
      })
    })
    const data = await res.json()
    planText.value = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    planText.value = '<p style="color:red">Ошибка генерации плана</p>'
  } finally {
    planLoading.value = false
  }
}

// ─── Таб 2: Конструктор ────────────────────────────────────────────────────────
const eventOntology = [
  {
    id: 'market-fail', trigger: 'Рыночный провал', icon: 'pi pi-exclamation-triangle',
    events: [
      { name: 'Фиксация провала (отрасль, регулятор)', type: 'detect', actor: 'НТИ / ФСТ' },
      { name: 'Аналитическая записка', type: 'analyze', actor: 'Минэко / РАНХиГС' },
      { name: 'Рабочая группа', type: 'org', actor: 'Аппарат Правительства' },
      { name: 'Концепция меры', type: 'design', actor: 'Оператор + НТИ' },
      { name: 'Пилот (5-10 компаний)', type: 'pilot', actor: 'Фонд / Агентство' },
      { name: 'НПА (ПП РФ / Приказ)', type: 'legal', actor: 'Профильное Министерство' },
    ],
    result: 'Новая мера в федеральном бюджете'
  },
  {
    id: 'tech-gap', trigger: 'Технологический разрыв', icon: 'pi pi-trending-up',
    events: [
      { name: 'Форсайт / TRL-аудит', type: 'detect', actor: 'НТИ / ЦТЭР' },
      { name: 'Стратегическая сессия', type: 'org', actor: 'Президиум НТИ' },
      { name: 'Дорожная карта технологии', type: 'design', actor: 'Рабочая группа НТИ' },
      { name: 'НИОКР-гранты', type: 'pilot', actor: 'Фонд содействия / Минпромторг' },
      { name: 'Масштабирование через ФПИ', type: 'scale', actor: 'ФПИ / НАПО' },
    ],
    result: 'Технологическая программа с бюджетом'
  },
  {
    id: 'reg-barrier', trigger: 'Регуляторный барьер', icon: 'pi pi-ban',
    events: [
      { name: 'Жалоба отрасли / кейс-стади', type: 'detect', actor: 'Ассоциация / ФСТ' },
      { name: 'Экспертный совет Госдумы', type: 'org', actor: 'Профильный Комитет' },
      { name: 'Концепция изменения НПА', type: 'design', actor: 'Минюст + Минэко' },
      { name: 'ОРВ', type: 'analyze', actor: 'Минэкономразвития' },
      { name: 'Пилотный регуляторный режим', type: 'pilot', actor: 'Правительство РФ' },
    ],
    result: 'Изменение в законодательстве / регуляторная песочница'
  },
  {
    id: 'infra-gap', trigger: 'Инфраструктурный пробел', icon: 'pi pi-server',
    events: [
      { name: 'Потребность рынка зафиксирована', type: 'detect', actor: 'ФСТ / Ассоциация' },
      { name: 'ТЭО инфраструктурного объекта', type: 'analyze', actor: 'ВЭБ.РФ / Минстрой' },
      { name: 'ГЧП-проект', type: 'design', actor: 'Регион + Федерация' },
      { name: 'Финансирование (Нацпроект / бюджет)', type: 'pilot', actor: 'Минфин / ФНБ' },
    ],
    result: 'Испытательный полигон, сервисный центр и т.п.'
  },
]

const newMeasure = ref({ name: '', type: 'grant', operator: '', amount: '', problem: '', target: '', trigger: '', expected: '', ontoTags: [] })
const constructorLoading = ref(false)
const proposalText = ref('')
const memoText = ref('')
const proposalLibrary = ref([])

function toggleOntoTag(tag) {
  const idx = newMeasure.value.ontoTags.indexOf(tag)
  if (idx >= 0) newMeasure.value.ontoTags.splice(idx, 1)
  else newMeasure.value.ontoTags.push(tag)
}

async function generateMeasureProposal() {
  if (!newMeasure.value.name) return
  constructorLoading.value = true
  proposalText.value = ''
  const m = newMeasure.value
  const typeLabel = MEASURE_TYPES.find(t => t.value === m.type)?.label || m.type
  try {
    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        application: 'FstGov-MeasureConstructor',
        systemPrompt: `Ты — эксперт по государственной политике и мерам поддержки технологических компаний. Разрабатываешь концепции новых инструментов для экосистемы БАС/НТИ. HTML-форматирование. Пиши как для правительственного документа.`,
        prompt: `Разработай концепцию новой меры поддержки:
Название: ${m.name}
Тип: ${typeLabel}, Оператор: ${m.operator || '—'}
Объём: ${m.amount || '—'}, Проблема: ${m.problem || '—'}
Аудитория: ${m.target || '—'}, Триггер: ${m.trigger || '—'}
Результат: ${m.expected || '—'}
Теги: ${m.ontoTags.join(', ') || '—'}

1. <b>Обоснование</b> (проблема, рыночный провал)
2. <b>Механизм работы</b> (процесс, критерии отбора)
3. <b>Целевые показатели</b> (KPI)
4. <b>Источник финансирования</b>
5. <b>Нормативная база</b>
6. <b>Риски и митигация</b>
7. <b>Дорожная карта запуска</b>`
      })
    })
    const data = await res.json()
    proposalText.value = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    proposalText.value = '<p style="color:red">Ошибка генерации</p>'
  } finally {
    constructorLoading.value = false
  }
}

async function generateMemo() {
  if (!proposalText.value) return
  const m = newMeasure.value
  const typeLabel = MEASURE_TYPES.find(t => t.value === m.type)?.label || m.type
  try {
    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        application: 'FstGov-Memo',
        systemPrompt: `Ты — руководитель GR-направления ФСТ НТИ. Пишешь служебную записку для запуска новой меры. Тон: деловой, аргументированный. HTML. Март 2026.`,
        prompt: `Напиши служебную записку по введению новой меры поддержки:
Мера: ${m.name} (${typeLabel})
Проблема: ${m.problem}
Аудитория: ${m.target}
Результат: ${m.expected}
Разработчик: ФСТ НТИ

Структура: шапка (кому, от кого, дата, тема) → обоснование → суть предложения → запрашиваемое действие (поручение / рабочая группа) → подпись`
      })
    })
    const data = await res.json()
    memoText.value = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    memoText.value = '<p style="color:red">Ошибка генерации</p>'
  }
}

function saveMeasureToLib() {
  if (!newMeasure.value.name) return
  const typeLabel = MEASURE_TYPES.find(t => t.value === newMeasure.value.type)?.label || newMeasure.value.type
  proposalLibrary.value.push({ id: Date.now(), name: newMeasure.value.name, type: newMeasure.value.type, type_label: typeLabel, operator: newMeasure.value.operator })
  toast.add({ severity: 'success', summary: 'Сохранено в библиотеку', life: 2000 })
}

function copyMemo() {
  navigator.clipboard.writeText(memoText.value.replace(/<[^>]+>/g, '')).catch(() => {})
  toast.add({ severity: 'success', summary: 'Скопировано', life: 1500 })
}

// Агент анализа пробелов
const agentLoading = ref(false)
const agentOutput = ref('')
const pipelineSteps = ref([
  { name: 'Анализ портфеля ФСТ',    desc: 'Сбор данных по проектам',        icon: 'pi pi-database', status: 'idle' },
  { name: 'Карта мер поддержки',    desc: 'Сопоставление потребностей',     icon: 'pi pi-map',      status: 'idle' },
  { name: 'Выявление пробелов',     desc: 'Где нет подходящих инструментов', icon: 'pi pi-search',   status: 'idle' },
  { name: 'Событийная онтология',   desc: 'Моделирование триггеров',        icon: 'pi pi-sitemap',  status: 'idle' },
  { name: 'Проектирование мер',     desc: 'AI-генерация концепций',         icon: 'pi pi-sparkles', status: 'idle' },
  { name: 'Формирование пакета',    desc: 'Концепции + служебные записки',  icon: 'pi pi-file',     status: 'idle' },
])

async function runGapAnalysis() {
  agentLoading.value = true
  agentOutput.value = ''
  pipelineSteps.value.forEach(s => s.status = 'idle')

  for (let i = 0; i < pipelineSteps.value.length; i++) {
    pipelineSteps.value[i].status = 'running'
    await new Promise(r => setTimeout(r, 500))
    pipelineSteps.value[i].status = 'done'
  }

  try {
    const portfolioSummary = projects.value.slice(0, 8).map(p =>
      `- ${p.name}: TRL${p.trl || '?'}, ${p.subFundName}, ${p.stageName}`
    ).join('\n') || '- Данные не загружены'

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        application: 'FstGov-GapAnalysis',
        systemPrompt: `Ты — GR-агент ФСТ НТИ. Анализируешь пробелы в системе государственной поддержки технологических стартапов (БАС, робототехника, промышленные инновации). Задача — найти пробелы и предложить новые меры. Используй HTML.`,
        prompt: `Проведи анализ пробелов в государственной поддержке:

Портфель ФСТ НТИ:
${portfolioSummary}

Существующие меры: Фонд содействия (УМНИК, СТАРТ-1/2), Сколково, Нацпроект БАС, РФРИТ, Минпромторг (НИОКР, ПП-719), ВЭБ.РФ, МСП, НТИ Аэронет.

1. <b>Выяви 3-5 системных пробелов</b> — чего не хватает портфельным компаниям
2. <b>Для каждого пробела — новая мера</b> (название, тип, оператор, объём)
3. <b>Приоритизация</b> по срочности и масштабу
4. <b>Триггеры запуска</b> — почему именно сейчас
5. <b>Рекомендуемые действия</b> — что нужно сделать ФСТ НТИ`
      })
    })
    const data = await res.json()
    agentOutput.value = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    agentOutput.value = '<p style="color:red">Ошибка анализа</p>'
  } finally {
    agentLoading.value = false
  }
}

// ─── Регуляторный радар ────────────────────────────────────────────────────────
const kpis = [
  { icon: '🏛️', value: '4', label: 'Активных GR-треков' },
  { icon: '📋', value: '12', label: 'Мониторинг НПА' },
  { icon: '✅', value: '3', label: 'Меры в работе' },
  { icon: '⚠️', value: '2', label: 'Риска: высокий' },
]

const regulations = [
  { code: 'ФЗ-370 БПЛА', name: 'Регулирование эксплуатации дронов', desc: 'Сертификация, операторы, зоны полётов', date: 'янв 2026', status: 'active', risk: 'medium' },
  { code: 'ПП-1421 Нацпроект', name: 'Субсидии по Нацпроекту БАС', desc: 'Критерии отбора, объём субсидий 2025-2030', date: 'март 2026', status: 'pending', risk: 'low' },
  { code: 'Приказ Минпромторг-719', name: 'Обновление условий подтверждения БПЛА', desc: 'Повышение требований к локализации до 80%', date: 'фев 2026', status: 'risk', risk: 'high' },
  { code: 'ФЗ-ЭПТ Экспорт', name: 'Ограничения экспорта двойного назначения', desc: 'Новые согласования для зарубежных партнёрств', date: 'апр 2026', status: 'pending', risk: 'medium' },
]

function statusIcon(s) { return s === 'active' ? '✅' : s === 'risk' ? '🔴' : '🟡' }

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.gr-tabs {
  display: flex; gap: 4px; padding: 0 0 16px;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 20px; flex-wrap: wrap;
}
.gr-tab {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  background: transparent; cursor: pointer; font-size: 13px;
  color: var(--p-text-muted-color); font-family: inherit; transition: all 0.15s;
}
.gr-tab:hover { background: var(--p-surface-hover, rgba(0,0,0,0.04)); color: var(--p-text-color); }
.gr-tab--active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.gr-content { display: flex; flex-direction: column; gap: 20px; }

.gr-section-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 14px; color: var(--p-text-color); margin-bottom: 12px;
}
.gr-count { font-size: 12px; font-weight: 400; color: var(--p-text-muted-color); }

.gr-startup-panel, .gr-measures-bank, .gr-agent-panel, .gr-ontology-panel,
.gr-constructor-panel, .gr-library-panel {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 18px;
}

.gr-startup-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.gr-select { flex: 1; min-width: 260px; font-size: 13px; }

.gr-project-card {
  background: var(--p-surface-hover, rgba(0,0,0,0.02));
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 12px; margin-bottom: 12px;
}
.gr-pc-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.gr-pc-label { font-size: 11px; color: var(--p-text-muted-color); }
.gr-pc-val { font-size: 13px; font-weight: 600; color: var(--p-text-color); margin-right: 8px; }
.gr-match-summary { display: flex; gap: 8px; flex-wrap: wrap; }

.gr-plan-block { border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden; }
.gr-plan-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: rgba(102,187,106,0.06); font-weight: 600; font-size: 13px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.gr-plan-text { padding: 14px; font-size: 13px; line-height: 1.7; }

.gr-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
.gr-filter-input { font-size: 13px; min-width: 180px; }
.gr-filter-sel { font-size: 13px; min-width: 140px; }

.gr-measures-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }

.gr-measure-card {
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 12px; background: var(--p-surface-card); transition: border-color 0.2s;
}
.gr-measure-card--matched { border-color: var(--p-green-400, #4caf50); background: rgba(76,175,80,0.03); }
.gr-mc-header { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
.gr-match-badge {
  font-size: 11px; font-weight: 700; color: var(--p-green-600, #2e7d32);
  background: rgba(76,175,80,0.12); border-radius: 10px; padding: 2px 8px;
}
.gr-mc-name { font-weight: 600; font-size: 13px; margin-bottom: 4px; line-height: 1.4; }
.gr-mc-operator { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 8px; }
.gr-mc-meta { display: flex; gap: 10px; font-size: 11px; color: var(--p-text-muted-color); flex-wrap: wrap; margin-bottom: 6px; }
.gr-mc-meta span { display: flex; align-items: center; gap: 3px; }
.gr-mc-criteria { font-size: 11px; color: var(--p-text-muted-color); line-height: 1.6; }
.gr-mc-deadline { font-size: 11px; color: var(--p-orange-500, #ff9800); margin-top: 6px; display: flex; align-items: center; gap: 4px; }

:deep(.gr-type-grant) { background: rgba(102,187,106,0.15) !important; color: #2e7d32 !important; border: none !important; }
:deep(.gr-type-loan) { background: rgba(66,165,245,0.15) !important; color: #1565c0 !important; border: none !important; }
:deep(.gr-type-tax) { background: rgba(171,71,188,0.15) !important; color: #6a1b9a !important; border: none !important; }
:deep(.gr-type-status) { background: rgba(255,167,38,0.15) !important; color: #e65100 !important; border: none !important; }
:deep(.gr-type-subsidy) { background: rgba(38,198,218,0.15) !important; color: #00695c !important; border: none !important; }
:deep(.gr-type-guarantee) { background: rgba(239,83,80,0.15) !important; color: #b71c1c !important; border: none !important; }

/* Agent panel */
.gr-agent-header {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 18px; flex-wrap: wrap;
}
.gr-agent-icon {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #fff; flex-shrink: 0;
}
.gr-agent-title { font-weight: 700; font-size: 14px; }
.gr-agent-sub { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }

.gr-pipeline { display: flex; overflow-x: auto; margin-bottom: 16px; }
.gr-pipe-step {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border: 1px solid var(--p-content-border-color); border-right: none;
  background: var(--p-surface-card); min-width: 130px; transition: background 0.2s;
}
.gr-pipe-step:first-child { border-radius: 8px 0 0 8px; }
.gr-pipe-step:last-child { border-radius: 0 8px 8px 0; border-right: 1px solid var(--p-content-border-color); }
.gr-pipe-step--done { background: rgba(76,175,80,0.07); border-color: var(--p-green-400, #4caf50); }
.gr-pipe-step--running { background: rgba(255,167,38,0.1); border-color: #ffa726; }
.gr-pipe-dot { font-size: 15px; color: var(--p-text-muted-color); flex-shrink: 0; }
.gr-pipe-step--done .gr-pipe-dot { color: var(--p-green-500, #4caf50); }
.gr-pipe-step--running .gr-pipe-dot { color: #ffa726; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.gr-pipe-name { font-size: 11px; font-weight: 600; }
.gr-pipe-desc { font-size: 10px; color: var(--p-text-muted-color); }

.gr-agent-output { border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden; }
.gr-agent-output-header {
  padding: 10px 14px; background: rgba(66,165,245,0.06);
  font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}

/* Ontology */
.gr-onto-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
.gr-onto-chain {
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 14px; background: var(--p-surface-card);
}
.gr-onto-trigger {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 13px; margin-bottom: 10px; color: var(--p-primary-color);
}
.gr-onto-events { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.gr-onto-event { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 0; }
.gr-onto-arrow { color: var(--p-text-muted-color); flex-shrink: 0; }
.gr-onto-ev-name { flex: 1; }
.gr-onto-actor {
  font-size: 10px; color: var(--p-text-muted-color);
  background: var(--p-surface-hover, rgba(0,0,0,0.04)); border-radius: 4px; padding: 1px 6px;
}
.gr-onto-event--detect { color: #ef5350; }
.gr-onto-event--analyze { color: #ffa726; }
.gr-onto-event--org { color: #42a5f5; }
.gr-onto-event--design { color: #ab47bc; }
.gr-onto-event--pilot { color: #26c6da; }
.gr-onto-event--legal { color: #66bb6a; }
.gr-onto-event--scale { color: #66bb6a; }
.gr-onto-result { font-size: 12px; font-weight: 600; color: var(--p-green-600, #2e7d32); display: flex; align-items: center; gap: 6px; }

/* Constructor */
.gr-constructor-form { display: flex; flex-direction: column; gap: 12px; }
.gr-cf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 700px) { .gr-cf-row { grid-template-columns: 1fr; } }
.gr-cf-group { display: flex; flex-direction: column; gap: 5px; }
.gr-cf-group label { font-size: 12px; color: var(--p-text-muted-color); }
.gr-cf-input { font-size: 13px; }
.gr-onto-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.gr-onto-tag {
  padding: 4px 10px; border: 1px solid var(--p-content-border-color); border-radius: 12px;
  font-size: 11px; cursor: pointer; transition: all 0.15s; color: var(--p-text-muted-color);
}
.gr-onto-tag:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }
.gr-onto-tag--sel { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }
.gr-cf-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 6px; }

.gr-proposal-block, .gr-memo-block {
  border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden; margin-top: 14px;
}
.gr-proposal-header, .gr-memo-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--p-content-border-color);
}
.gr-proposal-header { background: rgba(66,165,245,0.05); }
.gr-memo-header { background: rgba(255,167,38,0.05); }
.gr-proposal-text, .gr-memo-text { padding: 14px; font-size: 13px; line-height: 1.7; }

.gr-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.gr-lib-card {
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 12px; display: flex; flex-direction: column; gap: 6px;
}
.gr-lib-name { font-weight: 600; font-size: 13px; }
.gr-lib-meta { display: flex; align-items: center; gap: 8px; }
.gr-lib-status--draft { font-size: 11px; color: var(--p-text-muted-color); }

/* Radar */
.gov-kpi-row { display: flex; gap: 12px; flex-wrap: wrap; }
.gov-kpi {
  flex: 1; min-width: 100px; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 14px; text-align: center;
}
.gov-kpi-icon { font-size: 22px; margin-bottom: 4px; }
.gov-kpi-val { font-size: 24px; font-weight: 700; color: var(--p-text-color); }
.gov-kpi-lbl { font-size: 11px; color: var(--p-text-muted-color); }
.gov-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 18px;
}
.gov-card h3 { margin: 0 0 14px; font-size: 14px; font-weight: 700; }
.radar-list { display: flex; flex-direction: column; gap: 10px; }
.radar-item {
  display: flex; gap: 12px; align-items: flex-start; padding: 10px;
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
}
.radar-status { font-size: 18px; flex-shrink: 0; }
.radar-info { flex: 1; }
.radar-code { font-weight: 700; font-size: 12px; color: var(--p-primary-color); }
.radar-name { font-weight: 600; font-size: 13px; }
.radar-desc { font-size: 12px; color: var(--p-text-muted-color); }
.radar-meta { text-align: right; display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
.radar-date { color: var(--p-text-muted-color); }
.risk-high { color: #ef5350; font-weight: 600; }
.risk-medium { color: #ffa726; font-weight: 600; }
.risk-low { color: #66bb6a; font-weight: 600; }
</style>

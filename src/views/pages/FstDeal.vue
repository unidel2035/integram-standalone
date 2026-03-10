<template>
  <FstPageLayout
    title="Управление сделкой"
    subtitle="SPV, транши, Term Sheet и финансовая модель"
    :live="false"
    icon="pi pi-file-edit"
  >
    <template #actions>
      <Tag :value="dealStatus" :severity="dealStatusSeverity" />
      <LearnTooltip
        label="Сохранить сделку"
        what="Сохраняет все параметры сделки: условия инвестиции, структуру SPV, транши и KPI"
        when="После заполнения или изменения параметров сделки"
        :terms="['SPV', 'Транши', 'KPI', 'Term Sheet']"
        hotkey="Ctrl+S"
      >
        <Button label="Сохранить" icon="pi pi-save" size="small" severity="success" @click="saveDeal" :loading="saving" />
      </LearnTooltip>
      <LearnTooltip
        label="Генерация Term Sheet"
        what="Генерирует юридический документ Term Sheet на основе заполненных параметров сделки"
        when="Когда все ключевые условия сделки согласованы и готовы к оформлению"
        :terms="['Term Sheet', 'Юридическая документация', 'Условия сделки']"
      >
        <Button label="Term Sheet" icon="pi pi-file-pdf" size="small" severity="secondary" @click="generateTermSheet" :loading="generatingTS" />
      </LearnTooltip>
      <Button icon="pi pi-arrow-left" label="ИК" severity="secondary" size="small" text @click="$router.push('/fst-committee')" />
      <Button icon="pi pi-question-circle" severity="secondary" size="small" text @click="toggleHelp" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="fst-deal-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-dollar fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ deal.totalAmount }} млн</div>
        <div class="fst-metric-item-label">Сумма</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-percentage fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ deal.type === 'equity' ? deal.equityShare + '%' : deal.type === 'cln' ? deal.clnRate + '%' : '—' }}</div>
        <div class="fst-metric-item-label">{{ deal.type === 'equity' ? 'Доля' : deal.type === 'cln' ? 'Ставка CLN' : 'Тип' }}</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-building fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ deal.type === 'equity' ? deal.preMoney + ' млн' : '—' }}</div>
        <div class="fst-metric-item-label">Пре-мани</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-calendar fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ deal.tranches.length }}</div>
        <div class="fst-metric-item-label">Транши</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-clock fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ deal.termMonths }} мес</div>
        <div class="fst-metric-item-label">Горизонт</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-line fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ aiMetrics[0].value }}</div>
        <div class="fst-metric-item-label">IRR прогноз</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="fst-deal-main">

      <!-- Col 1: Deal Parameters -->
      <div class="fst-deal-col">
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-building" style="color:var(--fst-blue)"></i> Параметры компании
          </div>
          <div class="fst-form-group">
            <label>Название компании</label>
            <InputText v-model="deal.companyName" placeholder="ООО «АвиаЛогик»" class="fst-input" />
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>ИНН</label>
              <InputText v-model="deal.inn" placeholder="7701234567" class="fst-input" />
            </div>
            <div class="fst-form-group">
              <label>ОГРН</label>
              <InputText v-model="deal.ogrn" placeholder="1027700000000" class="fst-input" />
            </div>
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>Субфонд</label>
              <Select v-model="deal.subFund" :options="subFunds" placeholder="Выбрать" class="fst-input" />
            </div>
            <div class="fst-form-group">
              <label>Стадия</label>
              <Select v-model="deal.stage" :options="stages" placeholder="Выбрать" class="fst-input" />
            </div>
          </div>
        </div>

        <!-- Условия от ИК (если пришли из инвесткомитета) -->
        <div v-if="icConditions.length" class="fst-deal-panel" style="border-left:3px solid var(--p-primary-color)">
          <div class="fst-deal-panel-title">
            <i class="pi pi-check-circle" style="color:var(--p-primary-color)"></i> Условия ИК
          </div>
          <ul style="margin:0;padding-left:18px;color:var(--p-text-color);font-size:13px;line-height:1.8">
            <li v-for="(c, i) in icConditions" :key="i">{{ c }}</li>
          </ul>
        </div>

        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-dollar" style="color:var(--fst-green)"></i> Условия инвестиции
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>Тип инструмента</label>
              <SelectButton v-model="deal.type" :options="dealTypes" optionLabel="l" optionValue="v" :allowEmpty="false" />
            </div>
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>Общая сумма (млн ₽)</label>
              <InputNumber v-model="deal.totalAmount" :min="1" :max="500" :step="5" suffix=" млн ₽" class="fst-input" />
            </div>
            <div class="fst-form-group" v-if="deal.type === 'equity'">
              <label>Доля (% капитала)</label>
              <InputNumber v-model="deal.equityShare" :min="1" :max="49" suffix="%" class="fst-input" />
            </div>
            <div class="fst-form-group" v-if="deal.type === 'cln'">
              <label>Ставка CLN (%)</label>
              <InputNumber v-model="deal.clnRate" :min="0" :max="30" suffix="%" class="fst-input" />
            </div>
          </div>
          <div class="fst-form-row" v-if="deal.type === 'equity'">
            <div class="fst-form-group">
              <label>Пре-мани оценка (млн ₽)</label>
              <InputNumber v-model="deal.preMoney" :min="10" :max="5000" :step="50" suffix=" млн ₽" class="fst-input" />
            </div>
            <div class="fst-form-group">
              <label>Конверт. в Серию А (x)</label>
              <InputNumber v-model="deal.conversionMultiple" :min="1" :max="5" :step="0.5" suffix="x" class="fst-input" />
            </div>
          </div>
          <div class="fst-form-group">
            <label>Срок действия соглашения (мес.)</label>
            <InputNumber v-model="deal.termMonths" :min="12" :max="84" :step="6" class="fst-input" />
          </div>
        </div>

        <!-- SPV Parameters -->
        <FeatureHint
          id="deal-spv-tab"
          title="Структура SPV"
          description="SPV (Special Purpose Vehicle) — отдельное юридическое лицо для изоляции рисков сделки. Заполните название, юрисдикцию и управляющего"
          position="bottom"
        >
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-sitemap" style="color:var(--fst-purple)"></i> Структура SPV
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>Название SPV</label>
              <InputText v-model="deal.spvName" placeholder="ФСТ-БАС-001" class="fst-input" />
            </div>
            <div class="fst-form-group">
              <label>Юрисдикция</label>
              <Select v-model="deal.spvJurisdiction" :options="jurisdictions" class="fst-input" />
            </div>
          </div>
          <div class="fst-form-row">
            <div class="fst-form-group">
              <label>Управляющий</label>
              <InputText v-model="deal.spvManager" placeholder="ФСТ НТИ Управляющая Компания" class="fst-input" />
            </div>
            <div class="fst-form-group">
              <label>Аудитор</label>
              <InputText v-model="deal.auditor" placeholder="ООО «Аудит-Партнер»" class="fst-input" />
            </div>
          </div>
        </div>
        </FeatureHint>
      </div>

      <!-- Col 2: Tranches & KPIs -->
      <div class="fst-deal-col">
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-calendar" style="color:var(--fst-brand)"></i> Транши
            <LearnTooltip
              label="Добавить транш"
              what="Добавляет новый транш финансирования с настраиваемыми условиями выплаты"
              when="Когда инвестиция разбивается на несколько этапов с разными условиями активации"
              :terms="['Транш', 'Поэтапное финансирование', 'KPI-триггеры']"
            >
              <Button icon="pi pi-plus" size="small" text severity="success" @click="addTranche" style="margin-left:auto" />
            </LearnTooltip>
          </div>
          <div v-for="(tr, idx) in deal.tranches" :key="idx" class="fst-tranche">
            <div class="fst-tranche-header">
              <span class="fst-tranche-num">Транш {{ idx + 1 }}</span>
              <Tag :value="tr.status" :severity="trancheStatusSeverity(tr.status)" style="font-size:10px" />
              <LearnTooltip
                label="Удалить транш"
                what="Удаляет транш из структуры финансирования сделки"
                when="Когда транш больше не требуется в плане финансирования"
                :terms="['Транш', 'Структура сделки']"
              >
                <Button icon="pi pi-trash" size="small" text severity="danger" @click="removeTranche(idx)" style="margin-left:auto" />
              </LearnTooltip>
            </div>
            <div class="fst-form-row">
              <div class="fst-form-group">
                <label>Сумма (млн ₽)</label>
                <InputNumber v-model="tr.amount" :min="1" :max="200" suffix=" млн ₽" class="fst-input" />
              </div>
              <div class="fst-form-group">
                <label>Дата / Условие</label>
                <Select v-model="tr.triggerType" :options="triggerTypes" optionLabel="l" optionValue="v" class="fst-input" />
              </div>
            </div>
            <div class="fst-form-group" v-if="tr.triggerType === 'kpi'">
              <label>KPI-триггер</label>
              <InputText v-model="tr.kpiDesc" placeholder="TRL ≥ 7, Выручка ≥ 50 млн ₽" class="fst-input" />
            </div>
            <div class="fst-form-group" v-if="tr.triggerType === 'date'">
              <label>Дата выплаты</label>
              <DatePicker v-model="tr.date" dateFormat="dd.mm.yy" class="fst-input" />
            </div>
            <div class="fst-tranche-progress">
              <span style="font-size:11px;color:var(--p-text-muted-color)">Статус исполнения:</span>
              <Select v-model="tr.status" :options="trancheStatuses" size="small" class="fst-input" style="width:140px" />
            </div>
          </div>

          <div class="fst-tranche-summary">
            <div>Итого транши: <b>{{ totalTranches }} млн ₽</b></div>
            <div>Осталось: <b :style="{ color: remainingColor }">{{ remaining }} млн ₽</b></div>
          </div>
        </div>

        <!-- KPI Targets -->
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-chart-bar" style="color:var(--fst-cyan)"></i> KPI-цели проекта
            <LearnTooltip
              label="Добавить KPI"
              what="Добавляет новую целевую метрику для отслеживания прогресса проекта"
              when="Для определения измеримых показателей успеха проекта на горизонте инвестирования"
              :terms="['KPI', 'Целевые показатели', 'Мониторинг портфеля']"
            >
              <Button icon="pi pi-plus" size="small" text severity="success" @click="addKpi" style="margin-left:auto" />
            </LearnTooltip>
          </div>
          <div v-for="(kpi, idx) in deal.kpis" :key="idx" class="fst-kpi-row">
            <div class="fst-kpi-meta">
              <InputText v-model="kpi.name" placeholder="Метрика" class="fst-input" style="font-size:12px;width:130px" />
              <Select v-model="kpi.unit" :options="kpiUnits" placeholder="ед." class="fst-input" style="font-size:12px;width:90px" />
            </div>
            <div class="fst-kpi-targets">
              <InputNumber v-model="kpi.target2025" :min="0" placeholder="2025" class="fst-input" style="font-size:12px;width:80px" />
              <InputNumber v-model="kpi.target2026" :min="0" placeholder="2026" class="fst-input" style="font-size:12px;width:80px" />
              <InputNumber v-model="kpi.target2027" :min="0" placeholder="2027" class="fst-input" style="font-size:12px;width:80px" />
              <LearnTooltip
                label="Удалить KPI"
                what="Удаляет метрику из списка целевых показателей проекта"
                when="Когда метрика больше не актуальна для оценки успеха проекта"
                :terms="['KPI', 'Целевые показатели']"
              >
                <Button icon="pi pi-times" size="small" text severity="secondary" @click="removeKpi(idx)" />
              </LearnTooltip>
            </div>
          </div>
          <div v-if="!deal.kpis.length" style="font-size:12px;color:var(--p-text-muted-color);padding:8px">
            Добавьте KPI-цели проекта
          </div>
        </div>

        <!-- Rights & Conditions -->
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-shield" style="color:var(--fst-red)"></i> Права и ограничения
          </div>
          <div class="fst-conditions-grid">
            <div v-for="c in conditions" :key="c.key" class="fst-condition-item">
              <Checkbox v-model="deal.conditions[c.key]" :binary="true" :inputId="c.key" />
              <label :for="c.key" style="font-size:12px;cursor:pointer">{{ c.label }}</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Col 3: Term Sheet + Smart Contract + AI -->
      <div class="fst-deal-col">
        <!-- Term Sheet Preview -->
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-file-word" style="color:var(--fst-blue)"></i> Term Sheet
            <LearnTooltip
              v-if="termSheet"
              label="Копировать Term Sheet"
              what="Копирует текст Term Sheet в буфер обмена для использования в других документах"
              when="Когда нужно перенести содержимое в email, презентацию или другой документ"
              :terms="['Term Sheet', 'Юридическая документация']"
            >
              <Button icon="pi pi-copy" size="small" text @click="copyTermSheet" style="margin-left:auto" />
            </LearnTooltip>
          </div>
          <div v-if="!termSheet && !generatingTS" class="fst-term-empty">
            <i class="pi pi-file" style="font-size:32px;color:var(--p-text-muted-color)"></i>
            <div>Нажмите «Term Sheet» для генерации через AI</div>
            <LearnTooltip
              label="Сгенерировать Term Sheet"
              what="AI генерирует юридический документ Term Sheet на основе всех заполненных параметров сделки"
              when="Когда все условия сделки согласованы и готовы к формализации в документе"
              :terms="['Term Sheet', 'AI-генерация', 'Юридическая документация']"
            >
              <Button label="Сгенерировать" icon="pi pi-sparkles" size="small" severity="info" @click="generateTermSheet" :loading="generatingTS" />
            </LearnTooltip>
          </div>
          <div v-else-if="generatingTS" class="fst-term-loading">
            <ProgressSpinner style="width:40px;height:40px" />
            <div>Генерация через AI...</div>
          </div>
          <div v-else class="fst-term-sheet" v-html="termSheet"></div>
        </div>

        <!-- Smart Contract Status -->
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-verified" style="color:var(--fst-green)"></i> Смарт-контракт
          </div>
          <div class="fst-sc-timeline">
            <div v-for="step in scSteps" :key="step.id" class="fst-sc-step"
              :class="{ done: step.done, active: step.active }">
              <div class="fst-sc-dot">
                <i :class="step.done ? 'pi pi-check' : step.active ? 'pi pi-spin pi-spinner' : 'pi pi-circle'" />
              </div>
              <div class="fst-sc-info">
                <div class="fst-sc-label">{{ step.label }}</div>
                <div class="fst-sc-desc">{{ step.desc }}</div>
              </div>
              <Button v-if="step.action && !step.done" :label="step.action" size="small"
                severity="info" text @click="advanceStep(step.id)" />
            </div>
          </div>
        </div>

        <!-- AI Risk Analysis -->
        <div class="fst-deal-panel">
          <div class="fst-deal-panel-title">
            <i class="pi pi-brain" style="color:var(--fst-brand)"></i> AI-анализ сделки
          </div>
          <div class="fst-ai-metrics">
            <div class="fst-ai-metric" v-for="m in aiMetrics" :key="m.key">
              <div class="fst-ai-metric-label">{{ m.label }}</div>
              <div class="fst-ai-metric-value" :style="{ color: m.color }">{{ m.value }}</div>
            </div>
          </div>
          <div class="fst-ai-verdict">
            <div class="fst-ai-verdict-label">Вердикт AI</div>
            <div class="fst-ai-verdict-text" :style="{ borderLeftColor: verdictColor }">{{ aiVerdict }}</div>
          </div>
          <Button label="Обновить оценку" icon="pi pi-refresh" size="small" severity="secondary"
            @click="refreshAI" :loading="aiLoading" style="margin-top:8px;width:100%" />
        </div>

        <!-- Navigation -->
        <div class="fst-deal-nav">
          <Button icon="pi pi-building" label="ЦД Фонда" severity="secondary" size="small" text @click="$router.push('/fst-fund')" />
          <Button icon="pi pi-chart-line" label="Мониторинг" severity="secondary" size="small" text @click="$router.push('/fst-portfolio')" />
          <Button icon="pi pi-users" label="Инвесткомитет" severity="secondary" size="small" text @click="$router.push('/fst-committee')" />
        </div>
      </div>

    </div>

    <!-- Финансовая модель компании (full-width) -->
    <FeatureHint id="finmodel-hyperformula" title="Финансовая модель" description="Интерактивная финансовая модель из базы api.ai2o.ru/fm. Расчёт NPV, IRR, MOIC." position="bottom">
    <div class="fst-deal-finmodel-section">
      <div class="fst-deal-finmodel-header" @click="finmodelExpanded = !finmodelExpanded">
        <div class="fst-deal-finmodel-title">
          <i class="pi pi-chart-bar" style="color:var(--fst-green);font-size:16px"></i>
          <span>Финансовая модель компании</span>
          <Tag value="Заполняет компания" severity="success" style="font-size:10px" />
          <span v-if="finmodelValues['NPV @ 15% (WACC)'] !== undefined"
            class="fst-fm-quick" :style="{ color: (finmodelValues['NPV @ 15% (WACC)'] || 0) > 0 ? 'var(--fst-green)' : 'var(--fst-red)' }">
            NPV: {{ formatFmVal(finmodelValues['NPV @ 15% (WACC)']) }} тыс.₽ ·
            MOIC: {{ formatFmVal(finmodelValues['MOIC (5 лет)'], 2) }}x ·
            IRR≈{{ formatFmVal(finmodelValues['IRR (приближение) %']) }}%
          </span>
        </div>
        <i :class="finmodelExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          style="color:var(--p-text-muted-color)" />
      </div>

      <div v-if="finmodelExpanded" class="fst-deal-finmodel-body">
        <div class="fst-fm-info">
          <i class="pi pi-info-circle" style="color:var(--fst-blue);font-size:12px"></i>
          Финансовая модель загружается из базы api.ai2o.ru/fm. Подключите модель по ID или создайте новую.
          Результаты NPV / MOIC / IRR обновляют AI-оценку сделки.
        </div>
        <FstFinModelBlock
          v-model:modelId="finModelId"
          database="fm"
          server="api.ai2o.ru"
        />
        <div class="fst-fm-actions">
          <Button label="Применить к AI-оценке" icon="pi pi-refresh" size="small" severity="success"
            @click="applyFinmodelToAI" />
        </div>
      </div>
    </div></FeatureHint>

    <!-- Ontology bar -->
    <div class="fst-deal-ont-bar">
      <OntologyNextSteps entity-type="deal" :entity-id="dealId" />
      <CausalExplanation entity-type="deal" :entity-id="dealId" style="margin-top:8px" />
      <CounterfactualPanel
        :deal-id="dealId"
        :company-name="deal.companyName"
        style="margin-top:8px"
      />
    </div>

    <!-- Page Tutor -->
    <PageTutorButton pageId="fst-deal" :getContext="getPageContext" />

    <!-- Page Help Drawer -->
    <PageHelpDrawer v-model:visible="helpOpen" :page-help="pageHelp" />

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { saveDeal as saveDealToFst } from '@/services/fstApi'
import { useEventStore } from '@/stores/eventStore.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import FstFinModelBlock from '@/components/finmodel/FstFinModelBlock.vue'
import LearnTooltip from '@/components/LearnTooltip.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import CounterfactualPanel from '@/components/ontology/CounterfactualPanel.vue'
import CausalExplanation from '@/components/ontology/CausalExplanation.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import PageTutorButton from '@/components/PageTutorButton.vue'
import PageHelpDrawer from '@/components/PageHelpDrawer.vue'
import { usePageHelp } from '@/composables/usePageHelp'
import { buildEntityContext, buildContextPrompt } from '@/services/ontologyContextBuilder.js'

const toast = useToast()
const eventStore = useEventStore()

// ── Page Help ─────────────────────────────────────────────────
const { isOpen: helpOpen, pageHelp, toggleHelp } = usePageHelp('fst-deal')

// ID сделки — производный от имени компании, стабильный в рамках сессии
const dealId = computed(() => `deal-${deal.value?.inn || 'draft'}`)

// ── Page Tutor Context ────────────────────────────────────────
function getPageContext() {
  const id = dealId.value
  const timeline = eventStore.getTimeline('deal', id)
  const ctx = buildEntityContext('deal', id, timeline, {}, { stage: deal.value?.stage })
  return {
    module: 'Управление сделкой',
    company: deal.value?.companyName,
    subFund: deal.value?.subFund,
    dealType: deal.value?.type,
    totalAmount: deal.value?.totalAmount,
    stage: deal.value?.stage,
    ontology: buildContextPrompt(ctx)
  }
}

// ─── Deal form ──────────────────────────────────────────────────────────────
const deal = ref({
  companyName: 'ООО «АвиаЛогик»',
  inn: '7701234567',
  ogrn: '1027700000001',
  subFund: 'БАС',
  stage: 'Посевная',
  type: 'equity',
  totalAmount: 50,
  equityShare: 15,
  clnRate: 12,
  preMoney: 250,
  conversionMultiple: 1.5,
  termMonths: 36,
  spvName: 'ФСТ-БАС-001',
  spvJurisdiction: 'РФ (Москва)',
  spvManager: 'ФСТ НТИ Управляющая Компания',
  auditor: 'Большая четвёрка (локальный партнёр)',
  tranches: [
    { amount: 15, triggerType: 'date', date: null, kpiDesc: '', status: 'Выплачен' },
    { amount: 20, triggerType: 'kpi', date: null, kpiDesc: 'TRL ≥ 7 · Команда ≥ 15 чел.', status: 'Ожидание' },
    { amount: 15, triggerType: 'kpi', date: null, kpiDesc: 'Выручка ≥ 50 млн ₽ · Контракты ≥ 3', status: 'Заблокирован' },
  ],
  kpis: [
    { name: 'Выручка', unit: 'млн ₽', target2025: 20, target2026: 80, target2027: 200 },
    { name: 'TRL', unit: 'уровень', target2025: 6, target2026: 7, target2027: 8 },
    { name: 'Сотрудники', unit: 'чел.', target2025: 12, target2026: 20, target2027: 35 },
    { name: 'Патенты', unit: 'шт.', target2025: 2, target2026: 4, target2027: 7 },
    { name: 'Контракты', unit: 'шт.', target2025: 1, target2026: 3, target2027: 6 },
  ],
  conditions: {
    antiDilution: true,
    dragAlong: true,
    tagAlong: true,
    preemptiveRight: true,
    boardSeat: false,
    vetoOnMajorDecisions: true,
    noCompete: false,
    ipAssignment: true,
    reportingMonthly: true,
    exitRights: true,
  }
})

const saving = ref(false)
const generatingTS = ref(false)
const icConditions = ref([])   // условия от ИК (из TERM_SHEET_PROPOSED)
const termSheet = ref('')
const aiLoading = ref(false)
const scCurrentStep = ref(2)

// ─── Options ────────────────────────────────────────────────────────────────
const subFunds = ['БАС', 'РОБО', 'МЭ', 'Крос-секторный']
const stages = ['Pre-seed', 'Посевная', 'Раунд A', 'Раунд B']
const dealTypes = [
  { l: 'Equity', v: 'equity' },
  { l: 'CLN', v: 'cln' },
  { l: 'Грант', v: 'grant' },
]
const jurisdictions = ['РФ (Москва)', 'РФ (Иннополис)', 'РФ (Сколково)']
const triggerTypes = [
  { l: 'По дате', v: 'date' },
  { l: 'По KPI', v: 'kpi' },
  { l: 'По решению ИК', v: 'manual' },
]
const trancheStatuses = ['Выплачен', 'Ожидание', 'Заблокирован', 'Просрочен']
const kpiUnits = ['млн ₽', 'уровень', 'чел.', 'шт.', '%', 'ед.']
const conditions = [
  { key: 'antiDilution', label: 'Антиразводнение (Full Ratchet)' },
  { key: 'dragAlong', label: 'Drag-along (принудительная продажа)' },
  { key: 'tagAlong', label: 'Tag-along (право присоединения)' },
  { key: 'preemptiveRight', label: 'Право первоочередной покупки' },
  { key: 'boardSeat', label: 'Место в совете директоров' },
  { key: 'vetoOnMajorDecisions', label: 'Вето по ключевым решениям' },
  { key: 'noCompete', label: 'Запрет конкуренции (founders)' },
  { key: 'ipAssignment', label: 'Передача IP в SPV' },
  { key: 'reportingMonthly', label: 'Ежемесячная отчётность' },
  { key: 'exitRights', label: 'Преимущественные права при выходе' },
]

// ─── Computed ────────────────────────────────────────────────────────────────
const dealStatus = computed(() => {
  if (scCurrentStep.value >= 5) return 'Подписано'
  if (scCurrentStep.value >= 3) return 'На подписании'
  if (scCurrentStep.value >= 2) return 'Согласование'
  return 'Черновик'
})

const dealStatusSeverity = computed(() => {
  if (scCurrentStep.value >= 5) return 'success'
  if (scCurrentStep.value >= 3) return 'warn'
  return 'secondary'
})

const totalTranches = computed(() =>
  deal.value.tranches.reduce((s, t) => s + (t.amount || 0), 0)
)

const remaining = computed(() => deal.value.totalAmount - totalTranches.value)
const remainingColor = computed(() => remaining.value < 0 ? 'var(--fst-red)' : remaining.value > 0 ? 'var(--fst-brand)' : 'var(--fst-green)')

// ─── Smart Contract Steps ────────────────────────────────────────────────────
const scSteps = computed(() => [
  { id: 1, label: 'ИК одобрил', desc: 'Решение инвесткомитета зафиксировано', done: scCurrentStep.value > 1, active: false, action: null },
  { id: 2, label: 'Term Sheet подписан', desc: 'Обе стороны акцептовали условия', done: scCurrentStep.value > 2, active: scCurrentStep.value === 2, action: 'Акцептовать' },
  { id: 3, label: 'Due Diligence завершён', desc: 'Юридическая и финансовая проверка', done: scCurrentStep.value > 3, active: scCurrentStep.value === 3, action: 'Завершить DD' },
  { id: 4, label: 'SPV зарегистрировано', desc: `ООО «${deal.value.spvName}» в ${deal.value.spvJurisdiction}`, done: scCurrentStep.value > 4, active: scCurrentStep.value === 4, action: 'Зарегистрировать' },
  { id: 5, label: 'Контракт подписан', desc: 'Все стороны подписали. Транш 1 разблокирован', done: scCurrentStep.value > 5, active: scCurrentStep.value === 5, action: 'Подписать' },
  { id: 6, label: 'Транш 1 выплачен', desc: `${deal.value.tranches[0]?.amount || 0} млн ₽ перечислено на счёт компании`, done: scCurrentStep.value > 6, active: scCurrentStep.value === 6, action: 'Выплатить' },
])

// ─── AI Metrics ──────────────────────────────────────────────────────────────
const aiMetrics = ref([
  { key: 'irr', label: 'IRR прогноз', value: '38%', color: 'var(--fst-green)' },
  { key: 'moic', label: 'MOIC (5л)', value: '4.2x', color: 'var(--fst-blue)' },
  { key: 'risk', label: 'Риск провала', value: '24%', color: 'var(--fst-brand)' },
  { key: 'exit', label: 'Горизонт выхода', value: '5 лет', color: 'var(--fst-purple)' },
  { key: 'score', label: 'Скор ФСТ', value: '7.4 / 9', color: 'var(--fst-cyan)' },
  { key: 'sovereign', label: 'Суверенность', value: '7 / 9', color: 'var(--fst-red)' },
])

const aiVerdict = ref('Высокий потенциал. Рекомендуется к финансированию при подтверждении TRL 6 в ходе DD. Ключевой риск — небольшая команда на посевной стадии. Целевой мультипликатор 4-5x при выходе в 2028-2030.')
const verdictColor = ref('var(--fst-green)')

// ─── Actions ─────────────────────────────────────────────────────────────────
function addTranche() {
  deal.value.tranches.push({ amount: 10, triggerType: 'kpi', date: null, kpiDesc: '', status: 'Заблокирован' })
}

function removeTranche(idx) {
  deal.value.tranches.splice(idx, 1)
}

function addKpi() {
  deal.value.kpis.push({ name: '', unit: 'млн ₽', target2025: 0, target2026: 0, target2027: 0 })
}

function removeKpi(idx) {
  deal.value.kpis.splice(idx, 1)
}

function trancheStatusSeverity(s) {
  if (s === 'Выплачен') return 'success'
  if (s === 'Ожидание') return 'warn'
  if (s === 'Просрочен') return 'danger'
  return 'secondary'
}

function advanceStep(stepId) {
  if (stepId === scCurrentStep.value) {
    scCurrentStep.value++
    // Фиксируем ключевые события сделки
    if (stepId === 2) eventStore.add('deal', dealId.value, 'TERM_SHEET_SIGNED', { company: deal.value.companyName })
    if (stepId === 3) eventStore.add('deal', dealId.value, 'DD_COMPLETED', { company: deal.value.companyName })
    if (stepId === 6) eventStore.add('deal', dealId.value, 'TRANCHE_RELEASED', { tranche: 1, amount: deal.value.tranches[0]?.amount || 0 })
    toast.add({ severity: 'success', summary: 'Шаг выполнен', detail: scSteps.value[stepId - 1]?.label, life: 2500 })
  }
}

async function generateTermSheet() {
  generatingTS.value = true
  termSheet.value = ''
  await new Promise(r => setTimeout(r, 2000))
  const d = deal.value
  const shareText = d.type === 'equity'
    ? `${d.equityShare}% капитала (пре-мани оценка ${d.preMoney} млн ₽)`
    : d.type === 'cln'
    ? `Конвертируемый займ по ставке ${d.clnRate}% годовых`
    : `Грантовое финансирование (невозвратное)`
  termSheet.value = `
<div style="font-size:12px;line-height:1.7">
<h3 style="color:var(--p-primary-color);margin:0 0 10px">TERM SHEET № ФСТ-2026-001</h3>
<p style="color:var(--p-text-muted-color);font-size:11px">Конфиденциально · ${new Date().toLocaleDateString('ru-RU')} · Не является офертой</p>
<table style="width:100%;border-collapse:collapse;font-size:12px">
  <tr><td style="padding:4px 8px;font-weight:600;width:45%;color:var(--p-text-muted-color)">Эмитент</td><td style="padding:4px 8px">${d.companyName}</td></tr>
  <tr style="background:var(--p-surface-card)"><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">Инвестор</td><td style="padding:4px 8px">Фонд Суверенных Технологий НТИ (${d.spvName})</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">Инструмент</td><td style="padding:4px 8px">${dealTypes.find(t=>t.v===d.type)?.l}</td></tr>
  <tr style="background:var(--p-surface-card)"><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">Сумма</td><td style="padding:4px 8px"><b>${d.totalAmount} млн ₽</b> (${d.tranches.length} транша)</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">Условия</td><td style="padding:4px 8px">${shareText}</td></tr>
  <tr style="background:var(--p-surface-card)"><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">Срок</td><td style="padding:4px 8px">${d.termMonths} месяцев</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;color:var(--p-text-muted-color)">SPV</td><td style="padding:4px 8px">${d.spvName} (${d.spvJurisdiction})</td></tr>
</table>
<h4 style="margin:10px 0 4px;color:var(--p-text-color)">Транши</h4>
${d.tranches.map((t,i)=>`<div style="padding:3px 0;font-size:11px">• Транш ${i+1}: <b>${t.amount} млн ₽</b> — ${t.triggerType==='kpi'?`KPI: ${t.kpiDesc}`:t.triggerType==='date'?'По дате':'Решение ИК'}</div>`).join('')}
<h4 style="margin:10px 0 4px;color:var(--p-text-color)">Ключевые права инвестора</h4>
${Object.entries(d.conditions).filter(([,v])=>v).map(([k])=>`<div style="font-size:11px">• ${conditions.find(c=>c.key===k)?.label}</div>`).join('')}
<p style="margin-top:10px;font-size:11px;color:var(--p-text-muted-color)">Настоящий документ является предварительным соглашением об условиях инвестирования и не создаёт юридических обязательств до момента подписания корпоративного договора и устава SPV.</p>
</div>`
  generatingTS.value = false
}

async function saveDeal() {
  saving.value = true
  try {
    await saveDealToFst({
      name:        `Сделка: ${deal.value.companyName}`,
      companyName: deal.value.companyName,
      sharePercent: deal.value.sharePercent || 0,
      spvName:     deal.value.spvName || '',
      termSheet:   termSheet.value || '',
      signDate:    deal.value.signDate ? new Date(deal.value.signDate).toISOString() : new Date().toISOString()
    })
    eventStore.add('deal', dealId.value, 'DEAL_CLOSED', {
      company:     deal.value.companyName,
      amount:      deal.value.totalAmount,
      type:        deal.value.type,
      spv:         deal.value.spvName,
    })
    toast.add({ severity: 'success', summary: 'Сохранено в fst', detail: `Сделка ${deal.value.companyName} записана в Integram fst`, life: 3000 })
  } catch (err) {
    console.warn('saveDeal to fst failed:', err.message)
    toast.add({ severity: 'warn', summary: 'Локальное сохранение', detail: 'Не удалось сохранить в fst: ' + err.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

function copyTermSheet() {
  const text = termSheet.value.replace(/<[^>]+>/g, '')
  navigator.clipboard.writeText(text).then(() => {
    toast.add({ severity: 'info', summary: 'Скопировано', detail: 'Term Sheet в буфере обмена', life: 2000 })
  })
}

async function refreshAI() {
  aiLoading.value = true
  await new Promise(r => setTimeout(r, 1800))
  // Simulate slight variation
  const irr = (30 + Math.random() * 20).toFixed(0)
  const moic = (3 + Math.random() * 2).toFixed(1)
  const risk = (15 + Math.random() * 25).toFixed(0)
  aiMetrics.value[0].value = `${irr}%`
  aiMetrics.value[1].value = `${moic}x`
  aiMetrics.value[2].value = `${risk}%`
  aiMetrics.value[2].color = risk > 30 ? 'var(--fst-red)' : risk > 20 ? 'var(--fst-brand)' : 'var(--fst-green)'
  verdictColor.value = irr > 35 ? 'var(--fst-green)' : irr > 20 ? 'var(--fst-brand)' : 'var(--fst-red)'
  aiLoading.value = false
  toast.add({ severity: 'success', summary: 'AI обновил оценку', life: 2000 })
}

// ─── FinModel integration ────────────────────────────────────────────────────
const finmodelExpanded = ref(true)
const finmodelValues = ref({})
const finModelId = ref('')

function onFinmodelChange(vals) {
  finmodelValues.value = { ...vals }
}

function formatFmVal(v, decimals = 0) {
  if (v === undefined || v === null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'K'
  return Number(v).toFixed(decimals)
}

function applyFinmodelToAI() {
  const vals = finmodelValues.value
  const irr = vals['IRR (приближение) %'] ?? 0
  const moic = vals['MOIC (5 лет)'] ?? 0
  const npv = vals['NPV @ 15% (WACC)'] ?? 0
  const pi = vals['PI (индекс прибыльности)'] ?? 1
  const runway = vals['Runway (мес.)'] ?? 0

  // Risk of failure: inverse of PI clamped
  const riskRaw = Math.max(5, Math.min(60, 100 - pi * 30))

  aiMetrics.value[0].value = `${Math.round(irr)}%`
  aiMetrics.value[0].color = irr >= 25 ? 'var(--fst-green)' : irr >= 15 ? 'var(--fst-brand)' : 'var(--fst-red)'
  aiMetrics.value[1].value = `${moic.toFixed(1)}x`
  aiMetrics.value[1].color = moic >= 3 ? 'var(--fst-blue)' : moic >= 1.5 ? 'var(--fst-brand)' : 'var(--fst-red)'
  aiMetrics.value[2].value = `${Math.round(riskRaw)}%`
  aiMetrics.value[2].color = riskRaw > 35 ? 'var(--fst-red)' : riskRaw > 20 ? 'var(--fst-brand)' : 'var(--fst-green)'

  // Exit horizon from DPP
  const dpp = vals['DPP (дисконт.срок окуп., лет)'] ?? 4
  aiMetrics.value[3].value = `${Math.round(dpp)} лет`

  // Score FST: based on IRR + PI + runway
  const score = Math.min(9, Math.max(1,
    (irr / 40 * 3) + (Math.min(3, pi) * 1.5) + (Math.min(24, runway) / 24 * 2) + 1
  )).toFixed(1)
  aiMetrics.value[4].value = `${score} / 9`
  aiMetrics.value[4].color = score >= 7 ? 'var(--fst-cyan)' : score >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)'

  const npvSign = npv > 0 ? 'положительный' : 'отрицательный'
  verdictColor.value = irr >= 25 && npv > 0 ? 'var(--fst-green)' : irr >= 15 ? 'var(--fst-brand)' : 'var(--fst-red)'
  aiVerdict.value = `Финмодель: NPV @ 15% = ${formatFmVal(npv)} тыс.₽ (${npvSign}). MOIC ${moic.toFixed(1)}x, IRR ≈ ${Math.round(irr)}%, Runway ${Math.round(runway)} мес. ${npv > 0 && irr >= 20 ? 'Проект инвестиционно привлекателен.' : 'Требуется доработка финансовой модели.'}`

  toast.add({ severity: 'success', summary: 'AI-оценка обновлена из финмодели', life: 2500 })
}

// ─── Event tracking ──────────────────────────────────────────────────────────

onMounted(async () => {
  await eventStore.load('deal', dealId.value)
  const timeline = eventStore.getTimeline('deal', dealId.value)
  // Если есть TERM_SHEET_PROPOSED от ИК — предзаполняем форму
  const tsProposed = [...timeline].reverse().find(e => e.type === 'TERM_SHEET_PROPOSED')
  if (tsProposed?.data) {
    const d = tsProposed.data
    if (d.company)     deal.value.companyName = d.company
    if (d.amount)      deal.value.totalAmount = d.amount
    if (d.conditions?.length) {
      icConditions.value = Array.isArray(d.conditions) ? d.conditions : [d.conditions]
    }
    // ИК одобрил → шаг 1 выполнен, открываем шаг 2 (Term Sheet)
    if (scCurrentStep.value < 2) scCurrentStep.value = 2
  }
  if (!timeline.length) {
    eventStore.add('deal', dealId.value, 'DEAL_SOURCED', {
      company: deal.value.companyName,
      inn:     deal.value.inn,
      subFund: deal.value.subFund,
      stage:   deal.value.stage,
    })
  }
})
</script>

<style scoped>
/* Metrics flush to body edges */
.fst-deal-metrics {
  margin: -20px -20px 0;
}

/* Ontology bar */
.fst-deal-ont-bar {
  padding: 0 0 12px;
}

/* Main Grid */
.fst-deal-main {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding-top: 16px;
  flex: 1;
  overflow: auto;
}

/* Panel */
.fst-deal-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 16px;
}
.fst-deal-panel:last-child { margin-bottom: 0; }
.fst-deal-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fst-section-label-size);
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--p-content-border-color);
}

/* Form */
.fst-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.fst-form-group label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-weight: 500;
}
.fst-form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.fst-form-group:not(:last-child) {
  margin-bottom: 10px;
}
.fst-input { width: 100%; }

/* Tranches */
.fst-tranche {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  background: var(--p-surface-ground);
}
.fst-tranche-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.fst-tranche-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-tranche-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.fst-tranche-summary {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 8px;
  background: var(--p-surface-ground);
  border-radius: 4px;
  margin-top: 4px;
  color: var(--p-text-color);
}

/* KPI */
.fst-kpi-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-kpi-meta {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}
.fst-kpi-targets {
  display: flex;
  gap: 4px;
  align-items: center;
}

/* Conditions */
.fst-conditions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.fst-condition-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Term Sheet */
.fst-term-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: var(--p-text-muted-color);
  font-size: 12px;
  text-align: center;
}
.fst-term-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: var(--p-text-muted-color);
  font-size: 12px;
}
.fst-term-sheet {
  max-height: 350px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.6;
}

/* Smart Contract Timeline */
.fst-sc-timeline { display: flex; flex-direction: column; gap: 8px; }
.fst-sc-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px;
  border-radius: 6px;
  opacity: 0.6;
}
.fst-sc-step.done { opacity: 1; }
.fst-sc-step.active { opacity: 1; background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.fst-sc-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-content-border-color);
  flex-shrink: 0;
  font-size: 11px;
}
.fst-sc-step.done .fst-sc-dot { background: var(--fst-green); color: white; }
.fst-sc-step.active .fst-sc-dot { background: var(--p-primary-color); color: white; }
.fst-sc-info { flex: 1; }
.fst-sc-label { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.fst-sc-desc { font-size: 11px; color: var(--p-text-muted-color); }

/* AI Metrics */
.fst-ai-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.fst-ai-metric {
  background: var(--p-surface-ground);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}
.fst-ai-metric-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-bottom: 2px;
}
.fst-ai-metric-value {
  font-size: 16px;
  font-weight: 700;
}

/* AI Verdict */
.fst-ai-verdict-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.fst-ai-verdict-text {
  font-size: 12px;
  color: var(--p-text-color);
  border-left: 3px solid var(--fst-green);
  padding-left: 10px;
  line-height: 1.5;
}

/* Nav */
.fst-deal-nav {
  display: flex;
  gap: 8px;
  padding: 8px;
  justify-content: center;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
}

/* Responsive */
@media (max-width: 1100px) {
  .fst-deal-main { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 700px) {
  .fst-deal-main { grid-template-columns: 1fr; }

  /* FinModel tables — horizontal scroll with indicator */
  .fst-deal-finmodel-section table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
  }

  /* Toolbar buttons — icon-only on small screens */
  .fst-deal-toolbar .p-button .p-button-label {
    display: none;
  }
  .fst-deal-toolbar .p-button .p-button-icon {
    margin-right: 0;
  }

  /* Touch-friendly checkboxes */
  .fst-deal-rights label {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 4px 0;
  }
}

/* FinModel Section */
.fst-deal-finmodel-section {
  margin: 0 0 16px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
}
.fst-deal-finmodel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid transparent;
  transition: background 0.15s;
}
.fst-deal-finmodel-header:hover {
  background: var(--p-surface-ground);
}
.fst-deal-finmodel-section:has(.fst-deal-finmodel-body) .fst-deal-finmodel-header {
  border-bottom-color: var(--p-content-border-color);
}
.fst-deal-finmodel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-fm-quick {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  background: var(--p-surface-ground);
  border-radius: 4px;
}
.fst-deal-finmodel-body {
  padding: 16px;
  overflow-x: auto;
}
.fst-fm-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--fst-blue) 6%, transparent);
  border-radius: 6px;
  border-left: 3px solid var(--fst-blue);
}
.fst-fm-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
}
</style>

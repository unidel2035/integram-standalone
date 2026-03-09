<template>
  <FstPageLayout>
    <!-- Header -->
    <template #header>
      <div class="fex-header-left">
        <div class="fex-logo">
          <i class="pi pi-list-check" style="color:#66bb6a;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Исполнение сделки</b> · {{ company.name }}</span>
          <Tag :value="`Транш ${currentTranche} активен`" severity="success" style="font-size:11px" />
          <Tag :value="`День ${simDay}`" severity="info" style="font-size:11px" />
        </div>
        <div class="fex-sub">
          <i class="pi pi-circle-fill" :style="{ color: liveColor, fontSize:'8px' }"></i>
          Симуляция · {{ simDate }} · Скорость {{ speed }}x
        </div>
      </div>
      <div class="fex-header-center">
        <div class="fex-compliance-badge" :style="{ background: complianceGradient }">
          <span class="fex-compliance-score">{{ complianceScore }}%</span>
          <span class="fex-compliance-label">Исполнение</span>
        </div>
      </div>
      <div class="fex-header-right">
        <SelectButton v-model="viewMode" :options="viewModes" optionLabel="l" optionValue="v" :allowEmpty="false" size="small" />
        <LearnTooltip
          label="Симуляция исполнения"
          what="Запускает симуляцию постинвестиционного периода: KPI растут/падают, события фонда генерируются, транши разблокируются"
          when="Для понимания как фонд управляет компанией после инвестиции"
          :terms="['Постинвест', 'Транш', 'KPI', 'Симуляция']"
          hotkey="Space"
        >
          <Button :icon="running ? 'pi pi-pause' : 'pi pi-play'"
            :label="running ? 'Пауза' : 'Старт'"
            :severity="running ? 'warn' : 'success'"
            size="small" @click="toggleRun" />
        </LearnTooltip>
        <SelectButton v-model="speed" :options="speedOpts" optionLabel="l" optionValue="v" :allowEmpty="false" size="small" />
        <Button icon="pi pi-home" label="ФСТ" size="small" severity="secondary" text @click="$router.push('/fst')" />
        <Button icon="pi pi-arrow-left" label="Портфель" size="small" severity="secondary" text @click="$router.push('/fst-portfolio')" />
      </div>
    </template>

    <!-- KPI Dashboard (always visible) -->
    <div class="fex-kpi-bar">
      <div v-for="kpi in kpis" :key="kpi.key" class="fex-kpi-item">
        <div class="fex-kpi-head">
          <span class="fex-kpi-name">{{ kpi.name }}</span>
          <div class="fex-kpi-dot" :style="{ background: kpiColor(kpi) }"></div>
        </div>
        <div class="fex-kpi-progress">
          <div class="fex-kpi-bar-track">
            <div class="fex-kpi-bar-fill" :style="{ width: Math.min(100, kpi.actual / kpi.target * 100) + '%', background: kpiColor(kpi) }"></div>
          </div>
        </div>
        <div class="fex-kpi-nums">
          <b :style="{ color: kpiColor(kpi) }">{{ kpi.actual }}</b> / {{ kpi.target }} {{ kpi.unit }}
        </div>
      </div>
      <div class="fex-kpi-tranche">
        <div class="fex-kpi-name">Следующий транш</div>
        <div class="fex-kpi-nums" :style="{ color: trancheReady ? '#66bb6a' : '#ffa726' }">
          <i :class="trancheReady ? 'pi pi-check-circle' : 'pi pi-clock'" style="font-size:12px"></i>
          {{ trancheReady ? 'Разблокирован' : `${trancheProgress}% KPI` }}
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="fex-body">

      <!-- MODE: Задачи (Kanban) -->
      <template v-if="viewMode === 'tasks'">
        <!-- Task filter -->
        <div class="fex-tasks-toolbar">
          <div class="fex-filter-chips">
            <span v-for="cat in taskCategories" :key="cat.key"
              class="fex-chip" :class="{ active: taskFilter === cat.key }"
              @click="taskFilter = cat.key === taskFilter ? null : cat.key"
              :style="cat.key === taskFilter ? { background: cat.color, color: '#fff' } : {}">
              <i :class="cat.icon" style="font-size:10px"></i> {{ cat.name }}
            </span>
          </div>
          <div class="fex-tasks-stats">
            <span class="fex-stat green">{{ tasksDone }} выполнено</span>
            <span class="fex-stat yellow">{{ tasksInProgress }} в работе</span>
            <span class="fex-stat red">{{ tasksOverdue }} просрочено</span>
          </div>
        </div>

        <!-- Kanban board -->
        <div class="fex-kanban">
          <div v-for="col in kanbanCols" :key="col.status" class="fex-kanban-col">
            <div class="fex-kanban-col-header" :style="{ borderTopColor: col.color }">
              <span>{{ col.label }}</span>
              <span class="fex-kanban-count">{{ filteredTasks(col.status).length }}</span>
            </div>
            <div class="fex-kanban-cards">
              <div v-for="task in filteredTasks(col.status)" :key="task.id"
                class="fex-task-card"
                :class="{ overdue: task.status === 'overdue', critical: task.critical }"
                @click="selectedTask = task">
                <div class="fex-task-cat" :style="{ background: catColor(task.category) }">
                  <i :class="catIcon(task.category)" style="font-size:9px;color:#fff"></i>
                  {{ task.category }}
                </div>
                <div class="fex-task-name">{{ task.name }}</div>
                <div class="fex-task-meta">
                  <span>{{ task.assignee }}</span>
                  <span :style="{ color: deadlineColor(task.deadline) }">{{ task.deadline }}</span>
                </div>
                <div v-if="task.kpi" class="fex-task-kpi">
                  <i class="pi pi-chart-bar" style="font-size:9px;color:#ffa726"></i>
                  {{ task.kpi }}
                </div>
                <div v-if="task.progress !== undefined" class="fex-task-progress">
                  <div class="fex-task-progress-bar" :style="{ width: task.progress + '%', background: col.color }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Task detail dialog -->
        <div v-if="selectedTask" class="fex-task-dialog-overlay" @click.self="selectedTask = null">
          <div class="fex-task-dialog">
            <div class="fex-task-dialog-header">
              <div>
                <div class="fex-task-dialog-title">{{ selectedTask.name }}</div>
                <div class="fex-task-dialog-sub">{{ selectedTask.category }} · {{ selectedTask.assignee }}</div>
              </div>
              <Button icon="pi pi-times" text size="small" @click="selectedTask = null" />
            </div>
            <div class="fex-task-dialog-body">
              <div class="fex-task-detail-row"><b>Срок:</b> {{ selectedTask.deadline }}</div>
              <div class="fex-task-detail-row"><b>Статус:</b> {{ statusLabel(selectedTask.status) }}</div>
              <div v-if="selectedTask.kpi" class="fex-task-detail-row"><b>Влияет на KPI:</b> {{ selectedTask.kpi }}</div>
              <div v-if="selectedTask.desc" class="fex-task-detail-row fex-task-desc">{{ selectedTask.desc }}</div>
              <div v-if="selectedTask.fundAction" class="fex-task-fund-action">
                <i class="pi pi-exclamation-triangle" style="color:#ffa726"></i>
                <b>Реакция ФСТ:</b> {{ selectedTask.fundAction }}
              </div>
            </div>
            <div class="fex-task-dialog-actions">
              <Button v-if="selectedTask.status === 'todo' || selectedTask.status === 'blocked'"
                label="Начать" icon="pi pi-play" size="small" severity="info"
                @click="startTask(selectedTask); selectedTask = null" />
              <Button v-if="selectedTask.status === 'inprogress'"
                label="Завершить" icon="pi pi-check" size="small" severity="success"
                @click="completeTask(selectedTask); selectedTask = null" />
              <Button label="Закрыть" icon="pi pi-times" size="small" severity="secondary" text
                @click="selectedTask = null" />
            </div>
          </div>
        </div>
      </template>

      <!-- MODE: Мониторинг ФСТ (fund view) -->
      <template v-else-if="viewMode === 'fund'">
        <div class="fex-fund-body">

          <!-- Left: alerts & actions -->
          <div class="fex-fund-col">
            <div class="fex-fund-panel">
              <div class="fex-fund-panel-title">
                <i class="pi pi-exclamation-triangle" style="color:#ef5350"></i> Сигналы ФСТ
              </div>
              <div v-for="alert in fundAlerts" :key="alert.id" class="fex-alert" :class="alert.severity">
                <div class="fex-alert-dot" :style="{ background: alertColor(alert.severity) }"></div>
                <div class="fex-alert-body">
                  <div class="fex-alert-title">{{ alert.title }}</div>
                  <div class="fex-alert-msg">{{ alert.msg }}</div>
                  <div class="fex-alert-date">{{ alert.date }}</div>
                </div>
                <div class="fex-alert-actions">
                  <Button v-if="alert.action" :label="alert.action" size="small"
                    :severity="alert.severity === 'critical' ? 'danger' : 'warn'"
                    text @click="takeFundAction(alert)" />
                </div>
              </div>
              <div v-if="!fundAlerts.length" class="fex-no-alerts">
                <i class="pi pi-check-circle" style="color:#66bb6a;font-size:24px"></i>
                <div>Нет активных сигналов</div>
              </div>
            </div>

            <div class="fex-fund-panel">
              <div class="fex-fund-panel-title">
                <i class="pi pi-bolt" style="color:#ffa726"></i> Действия ФСТ
              </div>
              <div class="fex-actions-grid">
                <Button v-for="action in fundActions" :key="action.id"
                  :label="action.label" :icon="action.icon" size="small"
                  :severity="action.severity" :disabled="action.disabled"
                  @click="executeFundAction(action)"
                  class="fex-action-btn" />
              </div>
              <div class="fex-action-log">
                <div v-for="log in actionLog.slice(-5)" :key="log.id" class="fex-log-entry">
                  <span class="fex-log-time">{{ log.time }}</span>
                  <span class="fex-log-text">{{ log.text }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Middle: KPI monthly trend -->
          <div class="fex-fund-col fex-fund-col-wide">
            <div class="fex-fund-panel">
              <div class="fex-fund-panel-title">
                <i class="pi pi-chart-line" style="color:#42a5f5"></i> Прогресс KPI по месяцам
              </div>
              <div class="fex-kpi-table">
                <table>
                  <thead>
                    <tr>
                      <th>KPI</th>
                      <th v-for="m in months" :key="m">{{ m }}</th>
                      <th>Цель</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="kpi in kpis" :key="kpi.key">
                      <td class="fex-kpi-tname">{{ kpi.name }}</td>
                      <td v-for="(mv, mi) in kpi.monthly" :key="mi"
                        :style="{ background: monthCellBg(mv, kpi.monthlyTargets[mi]) }">
                        {{ mv }}
                      </td>
                      <td><b>{{ kpi.target }}</b></td>
                      <td :style="{ color: kpiColor(kpi), fontWeight: 600 }">
                        {{ Math.round(kpi.actual / kpi.target * 100) }}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tranche unlock condition -->
            <div class="fex-fund-panel">
              <div class="fex-fund-panel-title">
                <i class="pi pi-lock" :style="{ color: trancheReady ? '#66bb6a' : '#ffa726' }"></i>
                Условия разблокировки Транша {{ currentTranche + 1 }}
              </div>
              <div class="fex-tranche-conditions">
                <div v-for="cond in trancheConditions" :key="cond.key" class="fex-tranche-cond"
                  :class="{ met: cond.met }">
                  <i :class="cond.met ? 'pi pi-check-circle' : 'pi pi-times-circle'"
                    :style="{ color: cond.met ? '#66bb6a' : '#ef5350', fontSize:'14px' }" />
                  <div class="fex-cond-body">
                    <div class="fex-cond-name">{{ cond.name }}</div>
                    <div class="fex-cond-detail">{{ cond.detail }}</div>
                  </div>
                  <Tag :value="cond.met ? 'Выполнено' : 'Не выполнено'"
                    :severity="cond.met ? 'success' : 'danger'" style="font-size:10px" />
                </div>
              </div>
              <Button v-if="trancheReady" label="Разблокировать транш" icon="pi pi-unlock"
                severity="success" size="small" @click="unlockTranche" style="margin-top:10px;width:100%" />
              <div v-else class="fex-tranche-blocked">
                <i class="pi pi-lock" style="color:#ffa726"></i>
                {{ trancheConditions.filter(c=>!c.met).length }} условий не выполнено
              </div>
            </div>
          </div>

          <!-- Right: Event feed -->
          <div class="fex-fund-col">
            <div class="fex-fund-panel fex-events-panel">
              <div class="fex-fund-panel-title">
                <i class="pi pi-history" style="color:#26c6da"></i> Лента событий
              </div>
              <div class="fex-events-feed">
                <div v-for="ev in eventFeed.slice().reverse()" :key="ev.id" class="fex-ev">
                  <div class="fex-ev-dot" :style="{ background: evColor(ev.type) }"></div>
                  <div class="fex-ev-body">
                    <div class="fex-ev-title">{{ ev.title }}</div>
                    <div class="fex-ev-sub">{{ ev.date }} · {{ ev.source }}</div>
                  </div>
                  <Tag :value="ev.type" :style="{ fontSize: '9px', background: evColor(ev.type), color:'#fff' }" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>

    <!-- Page Tutor -->
    <PageTutorButton pageId="fst-execution" :getContext="getPageContext" />

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import PageTutorButton from '@/components/PageTutorButton.vue'
import LearnTooltip from '@/components/LearnTooltip.vue'

const toast = useToast()

// ── Page Tutor Context ────────────────────────────────────────
function getPageContext() {
  return {
    module: 'Исполнение фонда',
    company: company.name,
    viewMode: viewMode.value,
    currentTranche: currentTranche.value,
    tasksCount: allTasks.value.length
  }
}

// ─── Company & sim state ──────────────────────────────────────────────────────
const company = { name: 'АвиаЛогик', inn: '7701234567', subFund: 'БАС' }
const simDay = ref(1)
const currentTranche = ref(1)
const running = ref(false)
const speed = ref(5)
const speedOpts = [{ l: '1x', v: 1 }, { l: '5x', v: 5 }, { l: '20x', v: 20 }]
const viewMode = ref('tasks')
const viewModes = [{ l: 'Задачи', v: 'tasks' }, { l: 'Мониторинг ФСТ', v: 'fund' }]
const liveColor = ref('#66bb6a')
const selectedTask = ref(null)
const taskFilter = ref(null)

const startDate = new Date('2026-01-01')
const simDate = computed(() => {
  const d = new Date(startDate)
  d.setDate(d.getDate() + simDay.value - 1)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
})

const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн']

// ─── KPIs ─────────────────────────────────────────────────────────────────────
const kpis = ref([
  {
    key: 'revenue', name: 'Выручка', unit: 'млн ₽',
    actual: 3, target: 20,
    monthly: [0, 0.5, 1.5, 3, 0, 0],
    monthlyTargets: [1, 3, 5, 8, 12, 20],
  },
  {
    key: 'trl', name: 'TRL', unit: 'уровень',
    actual: 5, target: 7,
    monthly: [5, 5, 5, 5, 0, 0],
    monthlyTargets: [5, 5, 6, 6, 7, 7],
  },
  {
    key: 'headcount', name: 'Команда', unit: 'чел.',
    actual: 9, target: 15,
    monthly: [8, 9, 9, 9, 0, 0],
    monthlyTargets: [8, 10, 12, 14, 14, 15],
  },
  {
    key: 'patents', name: 'Патенты', unit: 'шт.',
    actual: 1, target: 3,
    monthly: [1, 1, 1, 1, 0, 0],
    monthlyTargets: [1, 1, 2, 3, 3, 3],
  },
  {
    key: 'contracts', name: 'Контракты', unit: 'шт.',
    actual: 0, target: 2,
    monthly: [0, 0, 0, 0, 0, 0],
    monthlyTargets: [0, 0, 1, 1, 2, 2],
  },
])

// ─── Tasks ────────────────────────────────────────────────────────────────────
const tasks = ref([
  // Product
  { id: 1, name: 'Разработка прошивки v2.1 (автопилот)', category: 'Продукт', assignee: 'Иванов А.', deadline: '2026-03-15', status: 'inprogress', progress: 65, kpi: 'TRL', critical: true, desc: 'Ключевая задача для достижения TRL 6. Автопилот должен пройти лабораторные испытания.' },
  { id: 2, name: 'Лабораторные испытания БПЛА Mk.2', category: 'Продукт', assignee: 'Смирнов К.', deadline: '2026-04-01', status: 'todo', progress: 0, kpi: 'TRL' },
  { id: 3, name: 'Полётные испытания (открытое поле)', category: 'Продукт', assignee: 'Иванов А.', deadline: '2026-05-15', status: 'todo', progress: 0, kpi: 'TRL', desc: 'Требует разрешения Росавиации. Подача документов — апрель.' },
  { id: 4, name: 'Сертификация в Росавиации', category: 'Регуляторика', assignee: 'Юристы', deadline: '2026-06-01', status: 'blocked', progress: 0, kpi: 'TRL', critical: true, fundAction: 'ФСТ направил запрос о статусе сертификации. Ожидается ответ.' },

  // Sales
  { id: 5, name: 'Переговоры с ФГУП Росаэронавигация', category: 'Продажи', assignee: 'Петров Д.', deadline: '2026-03-31', status: 'inprogress', progress: 40, kpi: 'Контракты' },
  { id: 6, name: 'Подписание LOI с МЧС России', category: 'Продажи', assignee: 'Петров Д.', deadline: '2026-04-15', status: 'todo', progress: 0, kpi: 'Контракты' },
  { id: 7, name: 'Участие в тендере МинТранс (30 млн ₽)', category: 'Продажи', assignee: 'Петров Д.', deadline: '2026-05-01', status: 'todo', progress: 0, kpi: 'Выручка', critical: true },

  // Team
  { id: 8, name: 'Найм ML-инженера (компьютерное зрение)', category: 'Команда', assignee: 'HR', deadline: '2026-03-20', status: 'inprogress', progress: 30, kpi: 'Команда' },
  { id: 9, name: 'Найм 2 инженеров-механиков', category: 'Команда', assignee: 'HR', deadline: '2026-04-01', status: 'todo', progress: 0, kpi: 'Команда' },
  { id: 10, name: 'Корпоративная программа опционов (ESOP)', category: 'Команда', assignee: 'CFO', deadline: '2026-04-30', status: 'todo', progress: 0 },

  // Finance
  { id: 11, name: 'Квартальный отчёт Q1 2026 в ФСТ', category: 'Финансы', assignee: 'CFO', deadline: '2026-04-15', status: 'inprogress', progress: 55, kpi: 'Отчётность' },
  { id: 12, name: 'Аудит расходов транша 1 (ФСТ-аудитор)', category: 'Финансы', assignee: 'CFO', deadline: '2026-05-01', status: 'todo', progress: 0 },
  { id: 13, name: 'Финансовая модель обновление (Г2 прогноз)', category: 'Финансы', assignee: 'CFO', deadline: '2026-03-25', status: 'overdue', progress: 20, kpi: 'Выручка', fundAction: 'ФСТ запросил обновлённую финмодель. Задержка 5 дней.' },

  // IP
  { id: 14, name: 'Подача заявки на патент (алгоритм навигации)', category: 'IP', assignee: 'R&D', deadline: '2026-04-01', status: 'todo', progress: 0, kpi: 'Патенты' },
  { id: 15, name: 'Регистрация торгового знака AвиаЛогик', category: 'IP', assignee: 'Юристы', deadline: '2026-05-01', status: 'todo', progress: 0 },

  // Regulatory
  { id: 16, name: 'Получение разрешения на полёты (Росавиация)', category: 'Регуляторика', assignee: 'Юристы', deadline: '2026-04-15', status: 'inprogress', progress: 50, kpi: 'TRL' },
  { id: 17, name: 'Соответствие ГОСТ Р 56055', category: 'Регуляторика', assignee: 'R&D', deadline: '2026-06-01', status: 'todo', progress: 0 },

  // Done
  { id: 18, name: 'Подписание инвестиционного договора', category: 'Финансы', assignee: 'CEO', deadline: '2026-01-15', status: 'done', progress: 100 },
  { id: 19, name: 'Открытие расчётного счёта SPV', category: 'Финансы', assignee: 'CFO', deadline: '2026-01-20', status: 'done', progress: 100 },
  { id: 20, name: 'Получение транша 1 (15 млн ₽)', category: 'Финансы', assignee: 'CFO', deadline: '2026-01-25', status: 'done', progress: 100 },
  { id: 21, name: 'Разработка БПЛА Mk.1 прошивка v1.0', category: 'Продукт', assignee: 'Иванов А.', deadline: '2026-02-01', status: 'done', progress: 100 },
  { id: 22, name: 'Первый тестовый полёт (крытый полигон)', category: 'Продукт', assignee: 'Иванов А.', deadline: '2026-02-15', status: 'done', progress: 100, kpi: 'TRL' },
  { id: 23, name: 'Офис ФСТ — установочная встреча', category: 'Команда', assignee: 'CEO', deadline: '2026-02-01', status: 'done', progress: 100 },
])

// ─── Events ───────────────────────────────────────────────────────────────────
const eventFeed = ref([
  { id: 1, title: 'Транш 1 (15 млн ₽) зачислен', date: '2026-01-25', type: 'Финансы', source: 'ФСТ НТИ' },
  { id: 2, title: 'Установочная встреча с ФСТ', date: '2026-02-01', type: 'Управление', source: 'ФСТ НТИ' },
  { id: 3, title: 'Первый тестовый полёт БПЛА Mk.1', date: '2026-02-15', type: 'Продукт', source: 'АвиаЛогик' },
  { id: 4, title: 'TRL остался на 5 — задержка разработки', date: '2026-03-01', type: 'Риск', source: 'Мониторинг' },
  { id: 5, title: 'Финмодель не обновлена — ПРОСРОЧЕНА', date: '2026-03-20', type: 'Риск', source: 'ФСТ НТИ' },
])

// ─── Fund alerts ──────────────────────────────────────────────────────────────
const fundAlerts = ref([
  {
    id: 1, severity: 'critical',
    title: 'Финансовая модель просрочена',
    msg: 'Задача #13 просрочена на 5 дней. ФСТ запросил обновление.',
    date: '2026-03-25', action: 'Отправить предупреждение'
  },
  {
    id: 2, severity: 'warn',
    title: 'TRL не растёт 2 месяца',
    msg: 'TRL 5 зафиксирован с января. Плановый TRL 6 к апрелю под угрозой.',
    date: '2026-03-20', action: 'Запросить объяснения'
  },
  {
    id: 3, severity: 'warn',
    title: 'Сертификация заблокирована',
    msg: 'Задача #4 заблокирована. Без сертификации нет полётных испытаний.',
    date: '2026-03-15', action: 'Назначить ментора'
  },
  {
    id: 4, severity: 'info',
    title: 'Контракты: 0 из 2 по плану',
    msg: 'Плановые контракты Q1 не заключены. Переговоры в процессе.',
    date: '2026-03-10', action: null
  },
])

// ─── Fund actions ─────────────────────────────────────────────────────────────
const fundActions = ref([
  { id: 'warn', label: 'Предупреждение', icon: 'pi pi-exclamation-triangle', severity: 'warn', disabled: false },
  { id: 'request', label: 'Запросить отчёт', icon: 'pi pi-file', severity: 'info', disabled: false },
  { id: 'mentor', label: 'Назначить ментора', icon: 'pi pi-user-plus', severity: 'secondary', disabled: false },
  { id: 'block', label: 'Заблокировать транш 2', icon: 'pi pi-lock', severity: 'danger', disabled: false },
  { id: 'ic', label: 'Созвать ИК', icon: 'pi pi-users', severity: 'danger', disabled: false },
  { id: 'unlock', label: 'Разблокировать транш 2', icon: 'pi pi-unlock', severity: 'success', disabled: true },
])

const actionLog = ref([
  { id: 1, time: '2026-02-01', text: 'Ментор назначен (А.Козлов — БПЛА-эксперт)' },
  { id: 2, time: '2026-03-01', text: 'Запрошен отчёт о статусе TRL' },
])

// ─── Tranche conditions ───────────────────────────────────────────────────────
const trancheConditions = computed(() => {
  const kpiMap = Object.fromEntries(kpis.value.map(k => [k.key, k]))
  return [
    {
      key: 'trl', name: 'TRL ≥ 7',
      detail: `Текущий TRL: ${kpiMap.trl?.actual ?? 0}`,
      met: (kpiMap.trl?.actual ?? 0) >= 7,
    },
    {
      key: 'revenue', name: 'Выручка ≥ 20 млн ₽',
      detail: `Текущая: ${kpiMap.revenue?.actual ?? 0} млн ₽`,
      met: (kpiMap.revenue?.actual ?? 0) >= 20,
    },
    {
      key: 'headcount', name: 'Команда ≥ 15 чел.',
      detail: `Текущая: ${kpiMap.headcount?.actual ?? 0} чел.`,
      met: (kpiMap.headcount?.actual ?? 0) >= 15,
    },
    {
      key: 'patents', name: 'Патенты ≥ 3',
      detail: `Текущих: ${kpiMap.patents?.actual ?? 0} шт.`,
      met: (kpiMap.patents?.actual ?? 0) >= 3,
    },
    {
      key: 'contracts', name: 'Контракты ≥ 2',
      detail: `Текущих: ${kpiMap.contracts?.actual ?? 0} шт.`,
      met: (kpiMap.contracts?.actual ?? 0) >= 2,
    },
    {
      key: 'finmodel', name: 'Финмодель обновлена',
      detail: tasks.value.find(t => t.id === 13)?.status === 'done' ? 'Обновлена' : 'Просрочена',
      met: tasks.value.find(t => t.id === 13)?.status === 'done',
    },
  ]
})

const trancheProgress = computed(() => {
  const met = trancheConditions.value.filter(c => c.met).length
  return Math.round(met / trancheConditions.value.length * 100)
})

const trancheReady = computed(() => trancheConditions.value.every(c => c.met))

// ─── Computed ─────────────────────────────────────────────────────────────────
const taskCategories = [
  { key: 'Продукт', name: 'Продукт', icon: 'pi pi-cog', color: '#42a5f5' },
  { key: 'Продажи', name: 'Продажи', icon: 'pi pi-dollar', color: '#66bb6a' },
  { key: 'Команда', name: 'Команда', icon: 'pi pi-users', color: '#26c6da' },
  { key: 'Финансы', name: 'Финансы', icon: 'pi pi-chart-bar', color: '#ffa726' },
  { key: 'IP', name: 'IP', icon: 'pi pi-key', color: '#ab47bc' },
  { key: 'Регуляторика', name: 'Регуляторика', icon: 'pi pi-shield', color: '#ef5350' },
]

const kanbanCols = [
  { status: 'done', label: 'Выполнено', color: '#66bb6a' },
  { status: 'inprogress', label: 'В работе', color: '#42a5f5' },
  { status: 'todo', label: 'В очереди', color: '#78909c' },
  { status: 'blocked', label: 'Заблокировано', color: '#ffa726' },
  { status: 'overdue', label: 'Просрочено', color: '#ef5350' },
]

const tasksDone = computed(() => tasks.value.filter(t => t.status === 'done').length)
const tasksInProgress = computed(() => tasks.value.filter(t => t.status === 'inprogress').length)
const tasksOverdue = computed(() => tasks.value.filter(t => t.status === 'overdue').length)

const complianceScore = computed(() => {
  const total = tasks.value.length
  const done = tasksDone.value
  const inprogress = tasksInProgress.value
  const overdue = tasksOverdue.value
  return Math.round((done * 1 + inprogress * 0.5 - overdue * 0.3) / total * 100)
})

const complianceGradient = computed(() => {
  const s = complianceScore.value
  if (s >= 70) return 'linear-gradient(135deg, #1b5e20, #388e3c)'
  if (s >= 40) return 'linear-gradient(135deg, #e65100, #ffa726)'
  return 'linear-gradient(135deg, #b71c1c, #ef5350)'
})

function filteredTasks(status) {
  return tasks.value.filter(t =>
    t.status === status &&
    (!taskFilter.value || t.category === taskFilter.value)
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function kpiColor(kpi) {
  const pct = kpi.actual / kpi.target
  if (pct >= 0.9) return '#66bb6a'
  if (pct >= 0.6) return '#ffa726'
  return '#ef5350'
}

function catColor(cat) {
  return taskCategories.find(c => c.key === cat)?.color ?? '#78909c'
}

function catIcon(cat) {
  return taskCategories.find(c => c.key === cat)?.icon ?? 'pi pi-circle'
}

function deadlineColor(dl) {
  if (!dl) return 'var(--p-text-muted-color)'
  const d = new Date(dl)
  const now = new Date('2026-03-25')
  const days = Math.ceil((d - now) / 86400000)
  if (days < 0) return '#ef5350'
  if (days < 14) return '#ffa726'
  return 'var(--p-text-muted-color)'
}

function statusLabel(s) {
  const map = { done: 'Выполнено', inprogress: 'В работе', todo: 'В очереди', blocked: 'Заблокировано', overdue: 'Просрочено' }
  return map[s] || s
}

function alertColor(s) {
  if (s === 'critical') return '#ef5350'
  if (s === 'warn') return '#ffa726'
  return '#42a5f5'
}

function evColor(type) {
  const map = { Финансы: '#66bb6a', Продукт: '#42a5f5', Риск: '#ef5350', Управление: '#ab47bc', Продажи: '#26c6da' }
  return map[type] || '#78909c'
}

function monthCellBg(actual, target) {
  if (!target || actual === 0) return 'transparent'
  const pct = actual / target
  if (pct >= 0.9) return 'rgba(102,187,106,0.2)'
  if (pct >= 0.6) return 'rgba(255,167,38,0.2)'
  return 'rgba(239,83,80,0.15)'
}

// ─── Simulation ───────────────────────────────────────────────────────────────
const simEventPool = [
  { prob: 0.03, fn: () => progressTask('Разработка прошивки v2.1 (автопилот)', 10, 'inprogress') },
  { prob: 0.02, fn: () => progressTask('Переговоры с ФГУП Росаэронавигация', 15, 'inprogress') },
  { prob: 0.04, fn: () => progressTask('Квартальный отчёт Q1 2026 в ФСТ', 15, 'inprogress') },
  { prob: 0.02, fn: () => progressTask('Найм ML-инженера (компьютерное зрение)', 25, 'inprogress') },
  { prob: 0.015, fn: () => progressTask('Получение разрешения на полёты (Росавиация)', 10, 'inprogress') },
  { prob: 0.008, fn: completePrinting },
  { prob: 0.005, fn: completeContract },
  { prob: 0.003, fn: completeTrl },
  { prob: 0.002, fn: hireEmployee },
]

function progressTask(name, delta, status) {
  const t = tasks.value.find(t => t.name === name)
  if (!t) return
  if (t.status === 'todo') t.status = status
  t.progress = Math.min(99, (t.progress || 0) + delta)
  if (t.progress >= 100) {
    t.progress = 100
    t.status = 'done'
    addEvent(`Задача завершена: ${t.name}`, 'Продукт', 'АвиаЛогик')
    toast.add({ severity: 'success', summary: 'Задача выполнена', detail: t.name, life: 2000 })
  }
}

function completePrinting() {
  const t = tasks.value.find(t => t.id === 13)
  if (t && t.status !== 'done') {
    t.status = 'done'
    t.progress = 100
    fundAlerts.value = fundAlerts.value.filter(a => a.id !== 1)
    addEvent('Финмодель обновлена (задержка устранена)', 'Финансы', 'АвиаЛогик')
    toast.add({ severity: 'success', summary: 'Финмодель обновлена', life: 2000 })
  }
}

function completeContract() {
  const kpi = kpis.value.find(k => k.key === 'contracts')
  if (kpi && kpi.actual < kpi.target) {
    kpi.actual++
    const latest = Math.max(...kpi.monthly.map((v, i) => i < 4 ? i : -1))
    if (latest >= 0) kpi.monthly[latest] = kpi.actual
    addEvent(`Подписан контракт #${kpi.actual}`, 'Продажи', 'АвиаЛогик')
    kpis.value.find(k => k.key === 'revenue').actual += 8
    toast.add({ severity: 'success', summary: 'Контракт подписан!', detail: `+8 млн ₽ к выручке`, life: 2500 })
  }
}

function completeTrl() {
  const kpi = kpis.value.find(k => k.key === 'trl')
  if (kpi && kpi.actual < kpi.target) {
    kpi.actual++
    addEvent(`TRL повышен до ${kpi.actual}`, 'Продукт', 'АвиаЛогик')
    toast.add({ severity: 'info', summary: `TRL → ${kpi.actual}`, life: 2000 })
  }
}

function hireEmployee() {
  const kpi = kpis.value.find(k => k.key === 'headcount')
  if (kpi && kpi.actual < kpi.target) {
    kpi.actual++
    addEvent(`Нанят сотрудник #${kpi.actual}`, 'Команда', 'АвиаЛогик')
    toast.add({ severity: 'info', summary: 'Найм', detail: `Команда: ${kpi.actual} чел.`, life: 1500 })
  }
}

let evIdCounter = eventFeed.value.length + 1
function addEvent(title, type, source) {
  eventFeed.value.push({
    id: evIdCounter++, title, type, source,
    date: simDate.value
  })
  if (eventFeed.value.length > 30) eventFeed.value.shift()
}

// ─── Simulation tick ──────────────────────────────────────────────────────────
let simInterval = null
onMounted(() => {
  simInterval = setInterval(() => {
    liveColor.value = liveColor.value === '#66bb6a' ? '#388e3c' : '#66bb6a'
    if (!running.value) return
    simDay.value += speed.value
    for (const ev of simEventPool) {
      if (Math.random() < ev.prob * speed.value) ev.fn()
    }
    // Revenue creep
    const rev = kpis.value.find(k => k.key === 'revenue')
    if (rev && rev.actual < rev.target && Math.random() < 0.05 * speed.value / 5) {
      rev.actual = Math.min(rev.target, rev.actual + Math.random() * 1.5)
      rev.actual = Math.round(rev.actual * 10) / 10
    }
  }, 800)
})
onUnmounted(() => clearInterval(simInterval))

function toggleRun() { running.value = !running.value }

// ─── Task actions ─────────────────────────────────────────────────────────────
function startTask(task) {
  if (task.status !== 'done') task.status = 'inprogress'
  addEvent(`Задача начата: ${task.name}`, 'Управление', 'АвиаЛогик')
}

function completeTask(task) {
  task.status = 'done'
  task.progress = 100
  addEvent(`Задача завершена: ${task.name}`, task.category, 'АвиаЛогик')
  toast.add({ severity: 'success', summary: 'Готово!', detail: task.name, life: 2000 })
}

// ─── Fund actions ─────────────────────────────────────────────────────────────
function takeFundAction(alert) {
  addActionLog(`Реакция на: "${alert.title}"`)
  fundAlerts.value = fundAlerts.value.filter(a => a.id !== alert.id)
  toast.add({ severity: 'warn', summary: 'Действие ФСТ', detail: alert.action, life: 2500 })
}

function executeFundAction(action) {
  const labels = {
    warn: 'Предупреждение отправлено компании',
    request: 'Запрос отчёта отправлен',
    mentor: 'Ментор назначен',
    block: 'Транш 2 заблокирован',
    ic: 'ИК созывается',
    unlock: 'Транш 2 разблокирован',
  }
  addActionLog(labels[action.id] || action.label)
  toast.add({
    severity: action.severity === 'danger' ? 'error' : 'success',
    summary: 'ФСТ НТИ', detail: labels[action.id], life: 3000
  })
  if (action.id === 'unlock') {
    currentTranche.value = 2
    addEvent('Транш 2 разблокирован ФСТ НТИ', 'Финансы', 'ФСТ НТИ')
    action.disabled = true
    fundActions.value.find(a => a.id === 'block').disabled = false
  }
}

let logId = actionLog.value.length + 1
function addActionLog(text) {
  actionLog.value.push({ id: logId++, time: simDate.value, text })
}

function unlockTranche() {
  executeFundAction(fundActions.value.find(a => a.id === 'unlock'))
}
</script>

<style scoped>
.fex-root {
  background: var(--surface-ground);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
}

/* Header */
.fex-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: transparent;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.fex-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fex-sub {
  font-size: 10px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.fex-header-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.fex-compliance-badge {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.fex-compliance-score {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.fex-compliance-label {
  font-size: 9px;
  color: rgba(255,255,255,0.8);
}
.fex-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* KPI Bar */
.fex-kpi-bar {
  display: flex;
  gap: 0;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  padding: 8px 16px;
  flex-shrink: 0;
  overflow-x: auto;
}
.fex-kpi-item {
  flex: 1;
  min-width: 100px;
  padding: 0 12px;
  border-right: 1px solid var(--surface-border);
}
.fex-kpi-item:last-child { border-right: none; }
.fex-kpi-tranche {
  flex: 0 0 130px;
  padding: 0 12px;
}
.fex-kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.fex-kpi-name {
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-weight: 500;
}
.fex-kpi-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.fex-kpi-progress { margin-bottom: 3px; }
.fex-kpi-bar-track {
  height: 4px;
  background: var(--surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fex-kpi-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s;
}
.fex-kpi-nums { font-size: 11px; color: var(--p-text-color); }

/* Body */
.fex-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Tasks toolbar */
.fex-tasks-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.fex-filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fex-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  cursor: pointer;
  transition: all 0.15s;
  color: var(--p-text-color);
}
.fex-chip:hover { border-color: var(--p-primary-color); }
.fex-tasks-stats {
  display: flex;
  gap: 12px;
}
.fex-stat { font-size: 11px; font-weight: 600; }
.fex-stat.green { color: #66bb6a; }
.fex-stat.yellow { color: #ffa726; }
.fex-stat.red { color: #ef5350; }

/* Kanban */
.fex-kanban {
  display: flex;
  gap: 8px;
  padding: 12px;
  overflow-x: auto;
  flex: 1;
  align-items: flex-start;
}
.fex-kanban-col {
  flex: 0 0 220px;
  min-height: 200px;
}
.fex-kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  padding: 8px 10px;
  background: var(--surface-card);
  border-radius: 6px 6px 0 0;
  border-top: 3px solid #78909c;
  margin-bottom: 4px;
}
.fex-kanban-count {
  font-size: 10px;
  background: var(--surface-ground);
  border-radius: 10px;
  padding: 1px 7px;
  color: var(--p-text-muted-color);
}
.fex-kanban-cards { display: flex; flex-direction: column; gap: 6px; }

/* Task Card */
.fex-task-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.fex-task-card:hover { border-color: var(--p-primary-color); transform: translateY(-1px); }
.fex-task-card.overdue { border-left: 3px solid #ef5350; }
.fex-task-card.critical { border-left: 3px solid #ffa726; }
.fex-task-cat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 10px;
  color: #fff;
  margin-bottom: 5px;
}
.fex-task-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--p-text-color);
  line-height: 1.4;
  margin-bottom: 5px;
}
.fex-task-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fex-task-kpi {
  font-size: 10px;
  color: #ffa726;
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 4px;
}
.fex-task-progress {
  height: 3px;
  background: var(--surface-border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}
.fex-task-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s;
}

/* Task dialog */
.fex-task-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fex-task-dialog {
  background: var(--surface-card);
  border-radius: 10px;
  padding: 20px;
  width: 480px;
  max-width: 90vw;
  border: 1px solid var(--surface-border);
  box-shadow: 0 10px 40px color-mix(in srgb, var(--p-text-color) 30%, transparent);
}
.fex-task-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.fex-task-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fex-task-dialog-sub {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.fex-task-dialog-body { margin-bottom: 16px; }
.fex-task-detail-row { font-size: 13px; margin-bottom: 8px; color: var(--p-text-color); }
.fex-task-desc { color: var(--p-text-muted-color); font-size: 12px; line-height: 1.5; }
.fex-task-fund-action {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255,167,38,0.1);
  border: 1px solid rgba(255,167,38,0.3);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--p-text-color);
  margin-top: 10px;
}
.fex-task-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Fund view */
.fex-fund-body {
  display: grid;
  grid-template-columns: 300px 1fr 280px;
  gap: 10px;
  padding: 12px;
  flex: 1;
  overflow: auto;
}
.fex-fund-col { display: flex; flex-direction: column; gap: 10px; }
.fex-fund-col-wide {}
.fex-fund-panel {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 12px;
}
.fex-fund-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--surface-border);
}

/* Alerts */
.fex-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  background: var(--surface-ground);
  margin-bottom: 6px;
}
.fex-alert.critical { border-left: 3px solid #ef5350; }
.fex-alert.warn { border-left: 3px solid #ffa726; }
.fex-alert.info { border-left: 3px solid #42a5f5; }
.fex-alert-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
.fex-alert-body { flex: 1; }
.fex-alert-title { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.fex-alert-msg { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; line-height: 1.4; }
.fex-alert-date { font-size: 10px; color: var(--p-text-muted-color); margin-top: 2px; }
.fex-no-alerts {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: var(--p-text-muted-color);
  font-size: 12px;
}

/* Actions */
.fex-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.fex-action-btn { width: 100%; }
.fex-action-log {
  border-top: 1px solid var(--surface-border);
  padding-top: 8px;
}
.fex-log-entry {
  display: flex;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
  color: var(--p-text-color);
}
.fex-log-time { color: var(--p-text-muted-color); flex-shrink: 0; }

/* KPI Table */
.fex-kpi-table { overflow-x: auto; }
.fex-kpi-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.fex-kpi-table th {
  text-align: center;
  padding: 4px 6px;
  background: var(--surface-ground);
  color: var(--p-text-muted-color);
  font-weight: 600;
  border: 1px solid var(--surface-border);
}
.fex-kpi-table td {
  text-align: center;
  padding: 5px 6px;
  border: 1px solid var(--surface-border);
  color: var(--p-text-color);
}
.fex-kpi-tname {
  text-align: left !important;
  font-weight: 500;
  white-space: nowrap;
}

/* Tranche conditions */
.fex-tranche-conditions { display: flex; flex-direction: column; gap: 8px; }
.fex-tranche-cond {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--surface-ground);
}
.fex-cond-body { flex: 1; }
.fex-cond-name { font-size: 12px; font-weight: 500; color: var(--p-text-color); }
.fex-cond-detail { font-size: 10px; color: var(--p-text-muted-color); }
.fex-tranche-blocked {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ffa726;
  margin-top: 10px;
  padding: 8px;
  background: rgba(255,167,38,0.1);
  border-radius: 6px;
}

/* Events */
.fex-events-panel { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.fex-events-feed {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fex-ev {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--surface-border);
}
.fex-ev:last-child { border-bottom: none; }
.fex-ev-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.fex-ev-body { flex: 1; }
.fex-ev-title { font-size: 11px; color: var(--p-text-color); }
.fex-ev-sub { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .fex-kpi-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .fex-compliance-score { flex-wrap: wrap; gap: 8px; }
  .fex-kpi-bar { flex-wrap: wrap; gap: 8px; }
  .fex-fund-body { grid-template-columns: 1fr !important; }
  .fex-actions-grid { grid-template-columns: 1fr !important; }
  .fex-fab { width: calc(100vw - 20px) !important; max-width: 480px; left: 10px !important; right: 10px !important; }
  .fex-sidebar, .fex-detail { max-height: 40vh; overflow-y: auto; }
}
</style>

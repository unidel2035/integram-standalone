<template>
  <FstPageLayout title="Портфельный монитор" subtitle="Мониторинг портфеля, аналитика и AI-отчёты" icon="pi pi-chart-bar">

    <!-- ─── KPI metrics strip — событийная, появляется/исчезает ─── -->
    <Transition name="fsp-sod-anim">
      <div v-if="showMetricsStrip && dashMode === 'demo'" class="fsp-metrics fst-metrics-strip">
        <div v-for="m in topMetrics" :key="m.label" class="fst-metric-item">
          <i :class="m.icon" class="fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ m.val }}</div>
          <div class="fst-metric-item-label">{{ m.label }}</div>
        </div>
      </div>
    </Transition>

    <!-- ─── View Tabs + Filters bar ─── -->
    <div class="fsp-filter-bar">
      <SelectButton v-model="activeView" :options="viewTabs" optionLabel="label" optionValue="id" :allowEmpty="false" />
      <Button icon="pi pi-sparkles" v-tooltip.bottom="'AI-анализ портфеля'" :disabled="aiLoading"
        :loading="aiLoading" severity="secondary" size="small" text @click="showAiInput = !showAiInput" />
      <Button :icon="refreshing ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" v-tooltip.bottom="'Обновить'"
        severity="secondary" size="small" text @click="refreshAll" />

      <!-- Режим дашборда: По умолчанию / Текущее / Демо -->
      <div v-if="activeView === 'dashboard'" class="fsp-mode-group">
        <button class="fsp-mode-btn" :class="{ active: dashMode === 'live' && !aiBlocks.length }"
          v-tooltip.bottom="'По умолчанию — исходный вид дашборда'"
          @click="resetDashboard()">
          <Icon icon="lucide:layout-dashboard" />
        </button>
        <button class="fsp-mode-btn" :class="{ active: dashMode === 'live' }"
          v-tooltip.bottom="'Текущее — реальные данные из Integram'"
          @click="dashMode = 'live'; stopDemo()">
          <Icon icon="lucide:radio-tower" />
        </button>
        <button class="fsp-mode-btn" :class="{ active: dashMode === 'demo' }"
          v-tooltip.bottom="'Демо — событийная симуляция портфеля'"
          @click="dashMode = 'demo'; startDemo()">
          <Icon icon="lucide:play-circle" />
        </button>
        <template v-if="dashMode === 'demo'">
          <span class="fsp-demo-clock"><i class="pi pi-clock"></i> {{ demoTime }}</span>
          <div class="fsp-demo-speed-inline">
            <button v-for="s in [1, 2, 4]" :key="s" class="fsp-speed-btn" :class="{ active: demoSpeed === s }"
              v-tooltip.bottom="`Скорость ×${s}`"
              @click="demoSpeed = s; restartDemoInterval()">{{ s }}×</button>
          </div>
        </template>
      </div>

      <div v-if="activeView !== 'dashboard'" class="fsp-filter-right">
        <!-- Переключатель карточки/воронка внутри «Компании» -->
        <SelectButton v-if="activeView === 'monitor'" v-model="companyViewMode"
          :options="[{ label: 'Карточки', id: 'cards' }, { label: 'Воронка', id: 'pipeline' }]"
          optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
        <!-- Переключатель Финансы/Оценки внутри «Аналитика» -->
        <SelectButton v-if="activeView === 'analytics'" v-model="analyticsSubTab"
          :options="[{ label: 'Финансы', id: 'finance' }, { label: 'Оценки', id: 'valuations' }]"
          optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
        <SelectButton v-model="filterScope" :options="scopeOptions" optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
        <Select v-model="filterSubfund" :options="subfundOptions" placeholder="Все субфонды" class="fsp-filter-sel" size="small" />
        <span class="fsp-search-wrap">
          <i class="pi pi-search fsp-search-icon" />
          <InputText v-model="searchQuery" placeholder="Поиск..." size="small" class="fsp-search" />
        </span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: DASHBOARD (overview) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeView === 'dashboard'" class="fsp-dash">

      <!-- ═══ AI Navigator (иконка + hover-чипы + утренний брифинг) ═══ -->
      <div class="fsp-ai-nav" :class="{ 'fsp-ai-nav--loading': aiLoading, 'fsp-ai-nav--has-blocks': aiBlocks.length }">
        <button class="fsp-ai-nav-trigger" :disabled="aiLoading">
          <i class="pi pi-sparkles" v-if="!aiLoading"></i>
          <i class="pi pi-spin pi-spinner" v-else></i>
        </button>
        <Transition name="fsp-nav-chips">
          <div class="fsp-ai-nav-chips" v-show="!aiLoading">
            <button class="fsp-ai-chip fsp-ai-chip--brief" @click="runMorningBrief()">
              <i class="pi pi-sun"></i>
              <span>Брифинг</span>
            </button>
            <button v-for="q in aiQuickQueries" :key="q.id" class="fsp-ai-chip"
              @click="aiQuery = q.prompt; runAiDashboard()">
              <i :class="q.icon"></i>
              <span>{{ q.label }}</span>
            </button>
            <button class="fsp-ai-chip fsp-ai-chip--swarm" @click="runAgentSwarm()" :disabled="swarmRunning">
              <i class="pi pi-users"></i>
              <span>Свод агентов</span>
            </button>
            <button class="fsp-ai-chip fsp-ai-chip--pred" @click="refreshPredictions()" :disabled="predictionsLoading">
              <i class="pi pi-bolt"></i>
              <span>Прогнозы</span>
            </button>
            <button v-if="aiBlocks.length" class="fsp-ai-chip fsp-ai-chip--clear"
              @click="destroyAiCharts(); aiBlocks = []; aiQuery = ''">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </Transition>
      </div>

      <!-- ═══ Утренний брифинг — баннер (появляется после генерации) ═══ -->
      <Transition name="fsp-brief-anim">
        <div v-if="morningBrief" class="fsp-morning-brief">
          <div class="fsp-brief-header">
            <i class="pi pi-sun"></i>
            <span>Утренний брифинг</span>
            <button class="fsp-brief-close" @click="morningBrief = ''"><i class="pi pi-times"></i></button>
          </div>
          <div class="fsp-brief-text" v-html="formatChatText(morningBrief)"></div>
        </div>
      </Transition>

      <!-- ╔══════════════════════════════════════════════════════════════════╗ -->
      <!-- ║  ATTENTION CANVAS — единый грид слотов (Cowan's 4±1)           ║ -->
      <!-- ║  AI-блоки замещают инфограф, а не добавляются сверху            ║ -->
      <!-- ╚══════════════════════════════════════════════════════════════════╝ -->

      <!-- AI-блоки — показываем над базовой инфографикой (стерео-картина) -->
      <template v-if="aiBlocks.length && dashMode === 'live'">
        <!-- AI-блоки — ограничены 6 слотами (Cowan's Law) -->
        <TransitionGroup name="fsp-block-anim" tag="div" class="fsp-ai-blocks">
          <div v-for="block in aiBlocks.slice(0, 6)" :key="block.id"
            class="fsp-ai-block" :class="'fsp-ai-block--' + block.type"
            :style="{ '--block-color': block.color || 'var(--fst-purple)' }">
            <!-- INSIGHT -->
            <template v-if="block.type === 'insight'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-lightbulb'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-text" v-html="formatChatText(block.body)"></div>
            </template>
            <!-- RANKING -->
            <template v-else-if="block.type === 'ranking'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-list'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-ranking"><div v-for="(item, i) in block.items" :key="i" class="fsp-aib-rank-row"><span class="fsp-aib-rank-pos">{{ i + 1 }}</span><span class="fsp-aib-rank-name">{{ item.name }}</span><span class="fsp-aib-rank-val" :style="{ color: 'var(--block-color)' }">{{ item.value }}</span></div></div>
            </template>
            <!-- METRIC -->
            <template v-else-if="block.type === 'metric'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-chart-bar'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-metric-val" :style="{ color: 'var(--block-color)' }">{{ block.value }}</div>
              <div v-if="block.subtitle" class="fsp-aib-metric-sub">{{ block.subtitle }}</div>
            </template>
            <!-- COMPARISON -->
            <template v-else-if="block.type === 'comparison'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-arrows-h'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-compare">
                <div class="fsp-aib-compare-side"><div class="fsp-aib-compare-val" style="color:var(--fst-green)">{{ block.left.value }}</div><div class="fsp-aib-compare-label">{{ block.left.label }}</div></div>
                <div class="fsp-aib-compare-vs">vs</div>
                <div class="fsp-aib-compare-side"><div class="fsp-aib-compare-val" style="color:var(--fst-blue)">{{ block.right.value }}</div><div class="fsp-aib-compare-label">{{ block.right.label }}</div></div>
              </div>
              <div v-if="block.verdict" class="fsp-aib-verdict">{{ block.verdict }}</div>
            </template>
            <!-- ALERT -->
            <template v-else-if="block.type === 'alert'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-exclamation-triangle'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-text" v-html="formatChatText(block.body)"></div>
            </template>
            <!-- RECOMMENDATION -->
            <template v-else-if="block.type === 'recommendation'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-check-square'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-rec-items"><div v-for="(r, i) in block.items" :key="i" class="fsp-aib-rec-item"><i class="pi pi-angle-right fsp-icon-xs fsp-text-muted"></i><span>{{ r }}</span></div></div>
            </template>
            <!-- TABLE -->
            <template v-else-if="block.type === 'table'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-table'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-table"><div class="fsp-aib-table-head"><span v-for="col in block.columns" :key="col">{{ col }}</span></div><div v-for="(row, i) in block.rows" :key="i" class="fsp-aib-table-row"><span v-for="(cell, j) in row" :key="j">{{ cell }}</span></div></div>
            </template>
            <!-- CHARTS -->
            <template v-else-if="block.type === 'bar_chart'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-chart-bar'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-chart-wrap"><canvas :id="'ai-chart-' + block.id"></canvas></div>
            </template>
            <template v-else-if="block.type === 'pie_chart' || block.type === 'doughnut_chart'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-chart-pie'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-chart-wrap fsp-aib-chart-pie"><canvas :id="'ai-chart-' + block.id"></canvas></div>
            </template>
            <template v-else-if="block.type === 'line_chart'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-chart-line'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-chart-wrap"><canvas :id="'ai-chart-' + block.id"></canvas></div>
            </template>
            <template v-else-if="block.type === 'radar_chart'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-compass'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-chart-wrap fsp-aib-chart-pie"><canvas :id="'ai-chart-' + block.id"></canvas></div>
            </template>
            <template v-else-if="block.type === 'horizontal_bar'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-align-left'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-hbars"><div v-for="(item, i) in block.items" :key="i" class="fsp-aib-hbar-row"><div class="fsp-aib-hbar-label">{{ item.name }}</div><div class="fsp-aib-hbar-track"><div class="fsp-aib-hbar-fill" :style="{ width: item.pct + '%', background: block.colors?.[i] || 'var(--block-color)' }"></div></div><div class="fsp-aib-hbar-val">{{ item.value }}</div></div></div>
            </template>
            <template v-else-if="block.type === 'gauge'">
              <div class="fsp-aib-header"><i :class="block.icon || 'pi pi-gauge'" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title }}</span></div>
              <div class="fsp-aib-gauge"><div class="fsp-aib-gauge-track"><div class="fsp-aib-gauge-fill" :style="{ width: Math.min(100, block.value) + '%', background: block.gaugeColor || 'var(--block-color)' }"></div></div><div class="fsp-aib-gauge-labels"><span class="fsp-aib-gauge-val" :style="{ color: block.gaugeColor || 'var(--block-color)' }">{{ block.display || block.value }}</span><span class="fsp-aib-gauge-max">/ {{ block.max || 100 }}</span></div><div v-if="block.subtitle" class="fsp-aib-metric-sub">{{ block.subtitle }}</div></div>
            </template>
            <!-- FALLBACK -->
            <template v-else>
              <div class="fsp-aib-header"><i class="pi pi-info-circle" :style="{ color: 'var(--block-color)' }"></i><span class="fsp-aib-title">{{ block.title || 'Результат' }}</span></div>
              <div class="fsp-aib-text" v-html="formatChatText(block.body || JSON.stringify(block))"></div>
            </template>
          </div>
        </TransitionGroup>
      </template>

      <!-- Режим СОД — кнопки перенесены в filter-bar -->

      <!-- DEMO: семантическое поле — grid с вспышками -->
      <div v-if="dashMode === 'demo'" class="fsp-field" ref="demoFieldRef">
        <TransitionGroup name="fsp-flash" tag="div" class="fsp-field-grid">
          <div v-for="block in sodBlocks" :key="block.id"
            class="fsp-flash-block" :class="['fsp-sod--' + block.type, { 'fsp-sod--clickable': !!block.drillTitle, 'fsp-flash--wide': block.wide }]"
            :style="{ '--sod-color': block.color, animationDuration: block.ttl + 'ms' }"
            @click="onSodBlockClick(block)">
            <div class="fsp-flash-glow" :style="{ background: block.color }"></div>
            <div class="fsp-sod-left">
              <i :class="block.icon" class="fsp-sod-icon"></i>
              <div class="fsp-sod-body">
                <div class="fsp-sod-title">{{ block.title }}</div>
                <div class="fsp-sod-text">{{ block.body }}</div>
              </div>
            </div>
            <!-- Визуал: горизонтальные бары -->
            <div v-if="block.visual === 'bar'" class="fsp-sod-visual">
              <div v-for="(b, i) in block.barData" :key="i" class="fsp-sod-bar-row">
                <span class="fsp-sod-bar-label">{{ b.label }}</span>
                <div class="fsp-sod-bar-track"><div class="fsp-sod-bar-fill" :style="{ width: b.pct + '%', background: b.color }"></div></div>
                <span v-if="b.val" class="fsp-sod-bar-val">{{ b.val }}</span>
              </div>
            </div>
            <!-- Визуал: KPI-метрики -->
            <div v-else-if="block.visual === 'kpi'" class="fsp-sod-visual fsp-sod-kpis">
              <div v-for="(k, i) in block.kpiData" :key="i" class="fsp-sod-kpi">
                <div class="fsp-sod-kpi-val" :style="{ color: k.color || block.color }">{{ k.value }}</div>
                <div class="fsp-sod-kpi-label">{{ k.label }}</div>
              </div>
            </div>
            <!-- Визуал: пирог -->
            <div v-else-if="block.visual === 'pie'" class="fsp-sod-visual fsp-sod-pie">
              <div v-for="(s, i) in block.pieData" :key="i" class="fsp-sod-pie-row">
                <div class="fsp-sod-pie-dot" :style="{ background: s.color }"></div>
                <span class="fsp-sod-pie-label">{{ s.label }}</span>
                <span class="fsp-sod-pie-pct">{{ s.pct }}%</span>
              </div>
            </div>
            <!-- Визуал: sparkline (мини-график из CSS) -->
            <div v-else-if="block.visual === 'spark'" class="fsp-sod-visual fsp-sod-spark">
              <div class="fsp-spark-chart">
                <div v-for="(v, i) in block.sparkData" :key="i" class="fsp-spark-bar"
                  :style="{ height: v.pct + '%', background: v.color || block.color, animationDelay: (i * 80) + 'ms' }">
                </div>
              </div>
              <div v-if="block.sparkLabel" class="fsp-spark-label">{{ block.sparkLabel }}</div>
            </div>
            <!-- Визуал: таблица-мини -->
            <div v-else-if="block.visual === 'table'" class="fsp-sod-visual fsp-sod-mini-table">
              <div v-for="(row, i) in block.tableData" :key="i" class="fsp-sod-trow" :class="{ 'fsp-sod-trow--head': i === 0 }">
                <span v-for="(cell, j) in row" :key="j" :style="j > 0 ? { textAlign: 'right', fontWeight: 700 } : {}">{{ cell }}</span>
              </div>
            </div>
            <!-- Визуал: gauge -->
            <div v-else-if="block.visual === 'gauge'" class="fsp-sod-visual fsp-sod-gauge">
              <div class="fsp-gauge-track">
                <div class="fsp-gauge-fill" :style="{ width: block.gaugeValue + '%', background: block.gaugeColor || block.color }"></div>
              </div>
              <div class="fsp-gauge-labels">
                <span class="fsp-gauge-val" :style="{ color: block.gaugeColor || block.color }">{{ block.gaugeDisplay }}</span>
                <span class="fsp-gauge-max">{{ block.gaugeMax || '' }}</span>
              </div>
            </div>
            <div class="fsp-flash-ttl">
              <div class="fsp-sod-ttl-bar" :style="{ animationDuration: block.ttl + 'ms' }"></div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Сигналы, фазы, chips, chains — убраны из дашборда (дублируют СОД-блоки) -->

      <!-- ═══ ДИАЛОГ КОМПАНИИ — по клику из тепловой карты ═══ -->
      <Dialog v-model:visible="showCompanyDialog" :header="focusedDashCompany ? companyDisplayName(focusedDashCompany) : ''" modal
        style="width: 520px; max-width: 95vw" :closable="true">
        <template v-if="focusedDashCompany">
          <!-- Статус -->
          <div class="fsp-cd-status">
            <Tag :value="focusedDashCompany.riskLevel === 'green' ? 'Норма' : focusedDashCompany.riskLevel === 'yellow' ? 'Внимание' : 'Высокий риск'"
              :severity="focusedDashCompany.riskLevel === 'green' ? 'success' : focusedDashCompany.riskLevel === 'yellow' ? 'warn' : 'danger'" />
            <Tag :value="`TRL ${focusedDashCompany.trl}`" severity="info" />
            <Tag v-if="focusedDashCompany.subfund" :value="focusedDashCompany.subfund" severity="secondary" />
          </div>
          <!-- Метрики -->
          <div class="fsp-cd-metrics">
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val" :style="{ color: companyHealth(focusedDashCompany) >= 70 ? 'var(--fst-green)' : companyHealth(focusedDashCompany) >= 40 ? 'var(--fst-brand)' : 'var(--fst-red)' }">{{ companyHealth(focusedDashCompany) }}%</div>
              <div class="fsp-cd-metric-label">Health</div>
            </div>
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val">{{ focusedDashCompany.trl }}</div>
              <div class="fsp-cd-metric-label">TRL</div>
            </div>
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val">{{ focusedDashCompany.invested ? (focusedDashCompany.invested / 1e6).toFixed(1) + 'М ₽' : '—' }}</div>
              <div class="fsp-cd-metric-label">Инвестиции</div>
            </div>
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val">{{ focusedDashCompany.revenue ? (focusedDashCompany.revenue / 1e6).toFixed(1) + 'М ₽' : '—' }}</div>
              <div class="fsp-cd-metric-label">Выручка</div>
            </div>
          </div>
          <!-- Health прогресс-бар -->
          <div class="fsp-cd-health-bar">
            <div class="fsp-cd-hb-fill" :style="{ width: companyHealth(focusedDashCompany) + '%', background: companyHealth(focusedDashCompany) >= 70 ? 'var(--fst-green)' : companyHealth(focusedDashCompany) >= 40 ? 'var(--fst-brand)' : 'var(--fst-red)' }"></div>
          </div>
          <!-- Дополнительная информация -->
          <div class="fsp-cd-details">
            <div class="fsp-cd-detail-row">
              <span class="fsp-cd-detail-label"><Icon icon="lucide:package" class="fsp-cd-icon" />Продукт</span>
              <span class="fsp-cd-detail-val">{{ focusedDashCompany.product || focusedDashCompany.name }}</span>
            </div>
            <div class="fsp-cd-detail-row">
              <span class="fsp-cd-detail-label"><Icon :icon="SUBFUND_ICONS[focusedDashCompany.subfund] || 'lucide:folder'" class="fsp-cd-icon" />Субфонд</span>
              <span class="fsp-cd-detail-val">{{ focusedDashCompany.subfund || '—' }}</span>
            </div>
            <div class="fsp-cd-detail-row">
              <span class="fsp-cd-detail-label"><Icon icon="lucide:milestone" class="fsp-cd-icon" />Стадия</span>
              <span class="fsp-cd-detail-val">{{ focusedDashCompany.stage || (focusedDashCompany.trl >= 7 ? 'Масштабирование' : focusedDashCompany.trl >= 4 ? 'Разработка' : 'Исследование') }}</span>
            </div>
            <div class="fsp-cd-detail-row">
              <span class="fsp-cd-detail-label"><Icon icon="lucide:pie-chart" class="fsp-cd-icon" />Доля фонда</span>
              <span class="fsp-cd-detail-val">{{ focusedDashCompany.stake ? focusedDashCompany.stake + '%' : '—' }}</span>
            </div>
          </div>
        </template>
        <template #footer>
          <Button label="Открыть монитор" icon="pi pi-external-link" severity="primary"
            @click="selectCompany(focusedDashCompany); activeView = 'monitor'; showCompanyDialog = false" />
          <Button label="AI анализ" icon="pi pi-sparkles" severity="secondary"
            @click="aiQuery = `Анализ компании ${companyDisplayName(focusedDashCompany)}: риски, потенциал, рекомендации`; runAiDashboard(); showCompanyDialog = false" />
        </template>
      </Dialog>

      <!-- ═══ ДИАЛОГ КЛИКА ПО ДИАГРАММЕ ═══ -->
      <Dialog v-model:visible="showChartClickDialog" :header="chartClickData?.blockTitle || 'Деталь'" modal
        style="width: 420px; max-width: 95vw" :closable="true">
        <template v-if="chartClickData">
          <div class="fsp-cd-metrics" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px">
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val" style="color: var(--fst-purple)">{{ chartClickData.label }}</div>
              <div class="fsp-cd-metric-label">Элемент</div>
            </div>
            <div class="fsp-cd-metric">
              <div class="fsp-cd-metric-val" style="color: var(--fst-blue)">{{ chartClickData.value }}</div>
              <div class="fsp-cd-metric-label">Значение</div>
            </div>
          </div>
          <div class="fsp-cd-details">
            <div class="fsp-cd-detail-row">
              <span class="fsp-cd-detail-label">Источник</span>
              <span class="fsp-cd-detail-val">{{ chartClickData.dataset }}</span>
            </div>
          </div>
        </template>
        <template #footer>
          <Button label="AI анализ" icon="pi pi-sparkles" severity="primary"
            @click="aiQuery = `Подробнее о ${chartClickData?.label}: ${chartClickData?.dataset}`; runAiDashboard(); showChartClickDialog = false" />
        </template>
      </Dialog>

      <!-- ═══ ИНФОГРАФИКА — плотный live-дашборд на одном экране ═══ -->
      <div v-if="allCompanies.length && dashMode === 'live'" class="fsp-infograph">

        <!-- ── Endsley L3: Проекция — прогнозная полоска ── -->
        <div v-if="projections.length" class="fsp-projections">
          <div v-for="p in projections" :key="p.id" class="fsp-proj-item" :class="'fsp-proj--' + p.severity"
            v-tooltip.bottom="p.detail">
            <Icon :icon="p.icon" class="fsp-proj-icon" />
            <span class="fsp-proj-text">{{ p.text }}</span>
            <span class="fsp-proj-when">{{ p.when }}</span>
          </div>
        </div>

        <!-- ── Portfolio Score + NAV Timeline — агрегированные виджеты ── -->
        <div class="fsp-score-row">
          <!-- Portfolio Score Gauge -->
          <div class="fsp-score-gauge" v-tooltip.bottom="'Portfolio Score — агрегированный показатель здоровья портфеля (0-100)'">
            <svg viewBox="0 0 80 48" class="fsp-score-svg">
              <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none" stroke="var(--p-content-border-color)" stroke-width="5" stroke-linecap="round"/>
              <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none" :stroke="portfolioScoreColor" stroke-width="5" stroke-linecap="round"
                :stroke-dasharray="`${portfolioScore * 1.005} 100.5`" class="fsp-score-arc"/>
            </svg>
            <div class="fsp-score-val" :style="{ color: portfolioScoreColor }">{{ portfolioScore }}</div>
            <div class="fsp-score-label">Portfolio Score</div>
          </div>
          <!-- NAV Timeline -->
          <div class="fsp-nav-timeline" v-tooltip.bottom="'NAV — прогноз стоимости фонда на 12 месяцев'">
            <div class="fsp-nav-header">
              <span class="fsp-nav-title">NAV Прогноз</span>
              <span class="fsp-nav-val">{{ fmtMln(navTimeline[navTimeline.length - 1] || 0) }} ₽</span>
            </div>
            <svg viewBox="0 0 200 28" class="fsp-nav-svg" v-html="navTimelineSvg"></svg>
            <div class="fsp-nav-labels"><span>сейчас</span><span>+12 мес</span></div>
          </div>
          <!-- Correlation Matrix -->
          <div class="fsp-corr-matrix" v-if="correlationMatrix.length">
            <div class="fsp-corr-title">Корреляция субфондов</div>
            <div class="fsp-corr-head">
              <span></span><span>Health</span><span>TRL</span><span>MOIC</span>
            </div>
            <div v-for="row in correlationMatrix" :key="row.name" class="fsp-corr-row">
              <span class="fsp-corr-name" :style="{ color: row.color }">{{ row.name }}</span>
              <span class="fsp-corr-cell" :style="{ background: `color-mix(in srgb, ${row.risk >= 60 ? 'var(--fst-green)' : row.risk >= 40 ? 'var(--fst-brand)' : 'var(--fst-red)'} ${Math.min(40, row.risk / 2.5)}%, transparent)` }">{{ row.risk }}%</span>
              <span class="fsp-corr-cell" :style="{ background: `color-mix(in srgb, var(--fst-blue) ${Math.min(40, row.trl * 4)}%, transparent)` }">{{ row.trl }}</span>
              <span class="fsp-corr-cell" :style="{ background: `color-mix(in srgb, var(--fst-purple) ${Math.min(40, row.moic * 15)}%, transparent)` }">{{ row.moic }}x</span>
            </div>
          </div>
          <!-- Technology Coverage Radar -->
          <div class="fsp-tech-radar" v-tooltip.bottom="'Покрытие технологической таксономии НТИ'">
            <div class="fsp-corr-title">Покрытие НТИ</div>
            <svg viewBox="0 0 200 180" class="fsp-radar-svg">
              <polygon v-for="ring in [0.25, 0.5, 0.75, 1.0]" :key="ring"
                :points="radarAxes.map((a, i) => radarPoint(i, ring)).join(' ')"
                fill="none" stroke="var(--p-content-border-color)" stroke-width="0.5" opacity="0.4" />
              <line v-for="(a, i) in radarAxes" :key="'ax'+i"
                x1="100" y1="85" :x2="radarPoint(i, 1).split(',')[0]" :y2="radarPoint(i, 1).split(',')[1]"
                stroke="var(--p-content-border-color)" stroke-width="0.3" />
              <polygon :points="radarAxes.map((a, i) => radarPoint(i, a.target / 10)).join(' ')"
                fill="none" stroke="var(--fst-brand)" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />
              <polygon :points="radarAxes.map((a, i) => radarPoint(i, a.score / 10)).join(' ')"
                fill="color-mix(in srgb, var(--fst-purple) 15%, transparent)"
                stroke="var(--fst-purple)" stroke-width="1.5" />
              <circle v-for="(a, i) in radarAxes" :key="'dot'+i"
                :cx="radarPoint(i, a.score / 10).split(',')[0]"
                :cy="radarPoint(i, a.score / 10).split(',')[1]"
                r="3" :fill="a.score >= a.target ? 'var(--fst-green)' : 'var(--fst-red)'" />
              <text v-for="(a, i) in radarAxes" :key="'lbl'+i"
                :x="radarLabelPos(i).x" :y="radarLabelPos(i).y"
                text-anchor="middle" class="fsp-radar-label">{{ a.short }}</text>
            </svg>
            <div class="fsp-radar-legend">
              <span style="color:var(--fst-purple)">&#9644; Факт</span>
              <span style="color:var(--fst-brand)">- - Цель</span>
            </div>
          </div>
        </div>

        <!-- Верхний ряд: KPI-метрики с дельтами (Kahneman S1) и спарклайнами (Tufte) -->
        <div class="fsp-ig-kpis">
          <div class="fsp-ig-kpi" v-tooltip.bottom="'TVPI (Total Value to Paid-In) — отношение стоимости портфеля к вложенным средствам. >1x = фонд в плюсе'">
            <Icon icon="lucide:trending-up" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" :style="{ color: fundTVPI >= 1 ? 'var(--fst-green)' : 'var(--fst-red)' }">{{ fundTVPI }}x</div>
            <svg class="fsp-sparkline" viewBox="0 0 48 16" v-html="sparklinePath(kpiSparkData.tvpi, 'var(--fst-green)')"></svg>
            <div class="fsp-ig-kpi-label">TVPI <span v-if="kpiDeltas.tvpi" class="fsp-delta" :class="kpiDeltas.tvpi > 0 ? 'up' : 'down'">{{ kpiDeltas.tvpi > 0 ? '↑' : '↓' }}{{ Math.abs(kpiDeltas.tvpi) }}%</span></div>
            <div class="fsp-benchmark">рынок: 1.2x</div>
          </div>
          <div class="fsp-ig-kpi" v-tooltip.bottom="'MOIC (Multiple on Invested Capital) — средний мультипликатор доходности. >1.5x = хороший результат'">
            <Icon icon="lucide:bar-chart-3" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" :style="{ color: avgMOIC >= 1.5 ? 'var(--fst-green)' : 'var(--fst-brand)' }">{{ avgMOIC }}x</div>
            <svg class="fsp-sparkline" viewBox="0 0 48 16" v-html="sparklinePath(kpiSparkData.moic, 'var(--fst-brand)')"></svg>
            <div class="fsp-ig-kpi-label">Ср. MOIC <span v-if="kpiDeltas.moic" class="fsp-delta" :class="kpiDeltas.moic > 0 ? 'up' : 'down'">{{ kpiDeltas.moic > 0 ? '↑' : '↓' }}{{ Math.abs(kpiDeltas.moic) }}%</span></div>
            <div class="fsp-benchmark">рынок: 1.8x</div>
          </div>
          <div class="fsp-ig-kpi" v-tooltip.bottom="'TRL — уровень технологической готовности. 1-3 = исследование, 4-6 = разработка, 7-9 = рынок'">
            <Icon icon="lucide:flask-conical" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" style="color:var(--fst-blue)">{{ avgPortfolioTRL }}</div>
            <svg class="fsp-sparkline" viewBox="0 0 48 16" v-html="sparklinePath(kpiSparkData.trl, 'var(--fst-blue)')"></svg>
            <div class="fsp-ig-kpi-label">Ср. TRL <span v-if="kpiDeltas.trl" class="fsp-delta" :class="kpiDeltas.trl > 0 ? 'up' : 'down'">{{ kpiDeltas.trl > 0 ? '↑' : '↓' }}{{ Math.abs(kpiDeltas.trl) }}%</span></div>
            <div class="fsp-benchmark">рынок: 4.5</div>
          </div>
          <div class="fsp-ig-kpi" v-tooltip.bottom="'Индекс Херфиндаля — концентрация портфеля. <0.15 = диверсифицирован, >0.25 = высокая концентрация'">
            <Icon icon="lucide:grid-3x3" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" :style="{ color: herfindahlIndex < 0.15 ? 'var(--fst-green)' : 'var(--fst-brand)' }">{{ herfindahlIndex.toFixed(3) }}</div>
            <div class="fsp-ig-kpi-label">Herfindahl</div>
            <div class="fsp-benchmark">норма: &lt;0.15</div>
          </div>
          <div class="fsp-ig-kpi" v-tooltip.bottom="`Количество компаний в портфеле фонда: ${portfolioCompanies.length} активных проектов`">
            <Icon icon="lucide:building-2" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" :style="{ color: healthDistribution.red > 2 ? 'var(--fst-red)' : 'var(--fst-green)' }">{{ portfolioCompanies.length }}</div>
            <div class="fsp-ig-kpi-label">Компаний</div>
            <div class="fsp-benchmark">медиана: 18</div>
          </div>
          <div class="fsp-ig-kpi" v-tooltip.bottom="`Компании с повышенным риском (жёлтый/красный): ${alertCount}`">
            <Icon icon="lucide:alert-triangle" class="fsp-ig-kpi-icon" />
            <div class="fsp-ig-kpi-val" :style="{ color: alertCount > 3 ? 'var(--fst-red)' : 'var(--fst-brand)' }">{{ alertCount }}</div>
            <div class="fsp-ig-kpi-label">Алерты</div>
          </div>
        </div>

        <!-- ═══ Predictive Signal Stream ═══ -->
        <div class="fsp-pred-stream" v-if="predictiveSignals.length">
          <div class="fsp-pred-header">
            <i class="pi pi-sparkles" style="color:var(--fst-purple)"></i>
            <span class="page-section-title page-section-title--flush">Предиктивная разведка</span>
          </div>
          <div class="fsp-pred-cards">
            <div v-for="sig in predictiveSignals" :key="sig.id"
              class="fsp-pred-card" :class="['fsp-pred--' + sig.severity, { expanded: expandedPrediction === sig.id }]"
              @click="expandedPrediction = expandedPrediction === sig.id ? null : sig.id">
              <div class="fsp-pred-top">
                <Icon :icon="sig.icon" class="fsp-pred-icon" :style="{ color: sig.color }" />
                <span class="fsp-pred-text">{{ sig.text }}</span>
                <Tag :value="sig.horizon" :severity="sig.severity === 'critical' ? 'danger' : sig.severity === 'warning' ? 'warn' : 'info'" class="fsp-tag-sm" />
              </div>
              <Transition name="fsp-brief-anim">
                <div v-if="expandedPrediction === sig.id" class="fsp-pred-detail">
                  <div class="fsp-pred-chain">
                    <div v-for="(step, i) in sig.chain" :key="i" class="fsp-pred-chain-step">
                      <div class="fsp-pred-chain-dot" :style="{ background: step.color }"></div>
                      <div class="fsp-pred-chain-line" v-if="i < sig.chain.length - 1"></div>
                      <div class="fsp-pred-chain-body">
                        <span class="fsp-pred-chain-label">{{ step.label }}</span>
                        <span class="fsp-pred-chain-entity">{{ step.entity }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="sig.kagConcepts?.length" class="fsp-pred-concepts">
                    <span v-for="c in sig.kagConcepts" :key="c" class="fsp-pred-concept-tag">{{ c }}</span>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- ═══ Agent Swarm Live Analysis ═══ -->
        <Transition name="fsp-block-anim">
          <div v-if="swarmActive" class="fsp-swarm">
            <div class="fsp-swarm-header">
              <i class="pi pi-users" style="color:var(--fst-purple)"></i>
              <span>Agent Swarm</span>
              <span class="fsp-swarm-timer">{{ swarmElapsed }}с</span>
              <button v-if="swarmRunning" class="fsp-brief-close" @click="cancelSwarm()"><i class="pi pi-times"></i></button>
              <button v-if="!swarmRunning && swarmSynthesis" class="fsp-brief-close" @click="swarmActive = false"><i class="pi pi-times"></i></button>
            </div>
            <div class="fsp-swarm-grid">
              <div v-for="agent in swarmAgents" :key="agent.id"
                class="fsp-swarm-tile" :class="[agent.status]"
                :style="{ '--agent-color': agent.color }">
                <div class="fsp-swarm-tile-head">
                  <i :class="agent.icon" :style="{ color: 'var(--agent-color)' }"></i>
                  <span>{{ agent.name }}</span>
                  <span class="fsp-swarm-dot" :class="agent.status"></span>
                </div>
                <div class="fsp-swarm-steps">
                  <div v-for="step in agent.steps" :key="step.id" class="fsp-swarm-step">
                    <i :class="[step.done ? 'pi pi-check' : 'pi pi-spin pi-spinner', 'fsp-tag-sm']"
                      :style="{ color: step.done ? 'var(--fst-green)' : 'var(--agent-color)' }"></i>
                    <span>{{ step.label }}</span>
                  </div>
                </div>
                <Transition name="fsp-brief-anim">
                  <div v-if="agent.result" class="fsp-swarm-result">
                    <div class="fsp-swarm-stance" :class="(agent.result.stance || '').toLowerCase()">
                      {{ agent.result.stance || 'АНАЛИЗ' }}
                    </div>
                    <div class="fsp-swarm-text">{{ (agent.result.text || '').slice(0, 180) }}</div>
                    <div class="fsp-swarm-conf">
                      <div class="fsp-swarm-conf-bar"><div class="fsp-swarm-conf-fill" :style="{ width: ((agent.result.confidence || 0) * 100) + '%', background: 'var(--agent-color)' }"></div></div>
                      <span>{{ Math.round((agent.result.confidence || 0) * 100) }}%</span>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
            <Transition name="fsp-brief-anim">
              <div v-if="swarmSynthesis" class="fsp-swarm-synthesis">
                <i class="pi pi-check-circle" style="color:var(--fst-green)"></i>
                <div class="fsp-swarm-synth-text" v-html="formatChatText(swarmSynthesis)"></div>
              </div>
            </Transition>
          </div>
        </Transition>

        <!-- ═══ Constellation + Tech Domain Stats — row ═══ -->
        <div v-if="constellationData.companies.length" class="fsp-const-row">
          <!-- Constellation Map (compact, hover to zoom) -->
          <div class="fsp-constellation" @mouseenter="constZoomed = true" @mouseleave="constZoomed = false">
            <div class="fsp-constellation-header">
              <i class="pi pi-share-alt" style="color:var(--fst-cyan)"></i>
              <span class="page-section-title page-section-title--flush">Техкарта портфеля</span>
              <i class="pi pi-expand fsp-tag-sm fsp-text-muted" style="margin-left:auto;opacity:0.5"></i>
            </div>
            <svg viewBox="50 20 500 260" class="fsp-constellation-svg">
              <line v-for="e in constellationData.edges" :key="e.id"
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                class="fsp-const-edge"
                :class="{ highlighted: hoveredConstNode && (e.from === hoveredConstNode || e.to === hoveredConstNode) }" />
              <g v-for="n in constellationData.concepts" :key="n.id"
                :transform="`translate(${n.x},${n.y})`" class="fsp-const-concept"
                @mouseenter="hoveredConstNode = n.id" @mouseleave="hoveredConstNode = null">
                <rect width="8" height="8" rx="1" transform="rotate(45) translate(-4,-4)" fill="var(--fst-cyan)" opacity="0.8" />
                <text dy="14" text-anchor="middle" class="fsp-const-label">{{ n.label }}</text>
              </g>
              <g v-for="n in constellationData.companies" :key="n.id"
                :transform="`translate(${n.x},${n.y})`" class="fsp-const-company"
                :class="{ orphan: n.edgeCount === 0, hovered: hoveredConstNode === n.id }"
                @mouseenter="hoveredConstNode = n.id" @mouseleave="hoveredConstNode = null"
                @click="onCompanyDashClick(n.company)">
                <circle :r="n.radius" :fill="n.color" class="fsp-const-circle" />
                <text :dy="n.radius + 10" text-anchor="middle" class="fsp-const-name">{{ n.shortName }}</text>
              </g>
            </svg>
            <div class="fsp-constellation-legend">
              <span><i class="pi pi-circle-fill fsp-legend-dot" style="color:var(--fst-cyan)"></i> Технология</span>
              <span><i class="pi pi-circle-fill fsp-legend-dot" style="color:var(--fst-green)"></i> Компания</span>
            </div>
          </div>

          <!-- Tech Domain Stats — right side -->
          <div class="fsp-domain-stats">
            <div class="page-section-title">Технологические домены</div>
            <div class="fsp-domain-list">
              <div v-for="ax in radarAxes" :key="ax.id" class="fsp-domain-row">
                <span class="fsp-domain-name">{{ ax.id }}</span>
                <div class="fsp-domain-bar-wrap">
                  <div class="fsp-domain-bar" :style="{ width: (ax.score / 10 * 100) + '%', background: ax.score >= ax.target ? 'var(--fst-green)' : 'var(--fst-brand)' }"></div>
                  <div class="fsp-domain-target" :style="{ left: (ax.target / 10 * 100) + '%' }"></div>
                </div>
                <span class="fsp-domain-val">{{ ax.score }}/10</span>
                <span class="fsp-domain-count">{{ ax.count }} комп.</span>
              </div>
            </div>
            <div class="fsp-domain-footer">
              <span class="fsp-text-muted" style="font-size:0.65rem"><i class="pi pi-minus fsp-legend-dot" style="color:var(--fst-brand)"></i> Цель НТИ 2030</span>
            </div>
          </div>
        </div>

        <!-- Zoom overlay for constellation -->
        <Transition name="fsp-brief-anim">
          <div v-if="constZoomed" class="fsp-const-zoom" @mouseenter="constZoomed = true" @mouseleave="constZoomed = false">
            <svg viewBox="50 20 500 260" class="fsp-const-zoom-svg">
              <line v-for="e in constellationData.edges" :key="e.id"
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                class="fsp-const-edge"
                :class="{ highlighted: hoveredConstNode && (e.from === hoveredConstNode || e.to === hoveredConstNode) }" />
              <g v-for="n in constellationData.concepts" :key="n.id"
                :transform="`translate(${n.x},${n.y})`" class="fsp-const-concept"
                @mouseenter="hoveredConstNode = n.id" @mouseleave="hoveredConstNode = null">
                <rect width="8" height="8" rx="1" transform="rotate(45) translate(-4,-4)" fill="var(--fst-cyan)" opacity="0.8" />
                <text dy="14" text-anchor="middle" class="fsp-const-label">{{ n.label }}</text>
              </g>
              <g v-for="n in constellationData.companies" :key="n.id"
                :transform="`translate(${n.x},${n.y})`" class="fsp-const-company"
                :class="{ orphan: n.edgeCount === 0, hovered: hoveredConstNode === n.id }"
                @mouseenter="hoveredConstNode = n.id" @mouseleave="hoveredConstNode = null"
                @click="onCompanyDashClick(n.company)">
                <circle :r="n.radius" :fill="n.color" class="fsp-const-circle" />
                <text :dy="n.radius + 10" text-anchor="middle" class="fsp-const-name">{{ n.shortName }}</text>
              </g>
            </svg>
          </div>
        </Transition>

        <!-- Тело: 3 колонки -->
        <div class="fsp-ig-body">
          <!-- Колонка 1: Тепловая карта + Health-бар -->
          <div class="fsp-ig-col">
            <div class="page-section-title">Тепловая карта</div>
            <div class="fsp-heatmap">
              <div v-for="c in portfolioCompanies.slice(0, 24)" :key="c.id"
                class="fsp-heat-cell" :class="['risk-' + c.riskLevel, { 'fsp-heat-anomaly': isAnomaly(c) }]"
                v-tooltip.bottom="`${companyDisplayName(c)} · Health: ${companyHealth(c)}% · TRL: ${c.trl || '—'}`"
                @click="onCompanyDashClick(c)">
                <Icon :icon="companyIcon(c)" class="fsp-heat-icon" />
                <div class="fsp-heat-name">{{ companyDisplayName(c) }}</div>
                <div class="fsp-heat-val">{{ companyHealth(c) }}%</div>
                <!-- Pulse sparkline on hover -->
                <svg class="fsp-heat-pulse" viewBox="0 0 40 12" v-html="companyPulseSvg(c)"></svg>
              </div>
            </div>
            <!-- Health распределение -->
            <div class="fsp-ig-health-bar" v-tooltip.bottom="'Распределение по здоровью: зелёный >70%, жёлтый 40-70%, красный <40%'">
              <div class="fsp-ig-hb-seg" :style="{ flex: healthDistribution.green, background: 'var(--fst-green)' }" v-tooltip.bottom="`Норма (>70%): ${healthDistribution.green} компаний`"></div>
              <div class="fsp-ig-hb-seg" :style="{ flex: healthDistribution.yellow, background: 'var(--fst-brand)' }" v-tooltip.bottom="`Внимание (40-70%): ${healthDistribution.yellow} компаний`"></div>
              <div class="fsp-ig-hb-seg" :style="{ flex: healthDistribution.red, background: 'var(--fst-red)' }" v-tooltip.bottom="`Критично (<40%): ${healthDistribution.red} компаний`"></div>
            </div>
            <div class="fsp-ig-health-legend">
              <span><i class="pi pi-circle-fill fsp-legend-dot-sm" style="color:var(--fst-green)"></i> {{ healthDistribution.green }} норма</span>
              <span><i class="pi pi-circle-fill fsp-legend-dot-sm" style="color:var(--fst-brand)"></i> {{ healthDistribution.yellow }} внимание</span>
              <span><i class="pi pi-circle-fill fsp-legend-dot-sm" style="color:var(--fst-red)"></i> {{ healthDistribution.red }} критично</span>
            </div>
          </div>

          <!-- Колонка 2: Runway + субфонды -->
          <div class="fsp-ig-col">
            <div class="page-section-title">Runway</div>
            <template v-if="runwayData.length">
              <div class="fsp-runway-list">
                <div v-for="r in runwayData.slice(0, 8)" :key="r.name" class="fsp-runway-row" v-tooltip.bottom="`${r.name}: ${r.months} мес. ${r.months < 6 ? '— нужен следующий транш!' : r.months < 12 ? '— runway менее года' : '— в норме'}`">
                  <div class="fsp-runway-name"><Icon v-if="r._icon" :icon="r._icon" class="fsp-icon-xs" style="opacity:0.6;margin-right:2px" />{{ r.name }}</div>
                  <div class="fsp-runway-bar-wrap">
                    <div class="fsp-runway-bar" :style="{ width: Math.min(100, r.months / 24 * 100) + '%', background: r.months < 6 ? 'var(--fst-red)' : r.months < 12 ? 'var(--fst-brand)' : 'var(--fst-green)' }"></div>
                  </div>
                  <div class="fsp-runway-val" :style="{ color: r.months < 6 ? 'var(--fst-red)' : r.months < 12 ? 'var(--fst-brand)' : 'var(--fst-green)' }">{{ r.months }}м</div>
                </div>
              </div>
            </template>
            <div v-else class="fsp-ig-no-data">Нет данных о финансах</div>
            <!-- Субфонды как мини-бары -->
            <div class="page-section-title page-section-title--mt">Субфонды</div>
            <div class="fsp-ig-subfunds">
              <div v-for="sf in subfundBreakdown" :key="sf.name" class="fsp-ig-sf-row" v-tooltip.bottom="`${sf.name}: ${sf.count} компаний (${sf.pct}% портфеля)`">
                <Icon :icon="SUBFUND_ICONS[sf.name] || 'lucide:folder'" class="fsp-ig-sf-icon" />
                <span class="fsp-ig-sf-name">{{ sf.name }}</span>
                <div class="fsp-ig-sf-bar-wrap">
                  <div class="fsp-ig-sf-bar" :style="{ width: sf.pct + '%', background: sf.color }"></div>
                </div>
                <span class="fsp-ig-sf-val">{{ sf.count }}</span>
              </div>
            </div>
          </div>

          <!-- Колонка 3: Зейгарник (прогресс) + События + Что изменилось -->
          <div class="fsp-ig-col">
            <!-- ── Зейгарник: Action Items с прогресс-барами ── -->
            <div v-if="actionItems.length" class="page-section-title">
              Задачи <span class="fsp-onto-count">{{ actionItemsCompleted }}/{{ actionItems.length }}</span>
            </div>
            <div v-if="actionItems.length" class="fsp-action-items">
              <div v-for="ai in actionItems" :key="ai.id" class="fsp-action-item" :class="{ done: ai.done }"
                v-tooltip.bottom="ai.detail">
                <div class="fsp-ai-check">
                  <Icon :icon="ai.done ? 'lucide:check-circle-2' : 'lucide:circle'" class="fsp-ai-check-icon" :class="{ done: ai.done }" />
                </div>
                <div class="fsp-ai-body">
                  <div class="fsp-ai-text">{{ ai.text }}</div>
                  <div class="fsp-ai-progress-bar">
                    <div class="fsp-ai-progress-fill" :style="{ width: ai.progress + '%', background: ai.done ? 'var(--fst-green)' : 'var(--fst-blue)' }"></div>
                  </div>
                </div>
                <span class="fsp-ai-pct" :style="{ color: ai.done ? 'var(--fst-green)' : 'var(--p-text-muted-color)' }">{{ ai.progress }}%</span>
              </div>
            </div>

            <!-- ── Change Blindness: Что изменилось ── -->
            <div v-if="changeLog.length" class="page-section-title page-section-title--mt">
              Что изменилось <span class="fsp-onto-count">{{ changeLog.length }}</span>
            </div>
            <div v-if="changeLog.length" class="fsp-changelog">
              <div v-for="ch in changeLog.slice(0, 5)" :key="ch.id" class="fsp-change-item"
                :class="'fsp-change--' + ch.type"
                v-tooltip.bottom="ch.detail">
                <Icon :icon="ch.icon" class="fsp-change-icon" />
                <span class="fsp-change-text">{{ ch.text }}</span>
                <span v-if="ch.delta" class="fsp-delta" :class="ch.delta > 0 ? 'up' : 'down'">{{ ch.delta > 0 ? '+' : '' }}{{ ch.delta }}%</span>
              </div>
            </div>

            <!-- ── SDT: Калиброванные алерты (три уровня) ── -->
            <div v-if="calibratedAlerts.length" class="page-section-title page-section-title--mt">
              Алерты <span class="fsp-onto-count">{{ calibratedAlerts.length }}</span>
            </div>
            <div v-if="calibratedAlerts.length" class="fsp-sdt-alerts">
              <div v-for="al in calibratedAlerts.slice(0, 5)" :key="al.id"
                class="fsp-sdt-alert" :class="'fsp-sdt--' + al.level"
                v-tooltip.bottom="al.detail">
                <Icon :icon="al.icon" class="fsp-sdt-icon" />
                <span class="fsp-sdt-text">{{ al.text }}</span>
                <span v-if="al.timeAgo" class="fsp-sdt-time">{{ al.timeAgo }}</span>
                <Tag :value="al.levelLabel" :severity="al.level === 'critical' ? 'danger' : al.level === 'warning' ? 'warn' : 'info'" class="fsp-tag-sm" />
              </div>
            </div>

            <!-- ── Последние события (сжатые) ── -->
            <div class="page-section-title page-section-title--mt">Последние события <span v-if="allEventsFlat.length" class="fsp-onto-count">{{ allEventsFlat.length }}</span></div>
            <div class="fsp-ig-feed">
              <div v-for="ev in allEventsFlat.slice(0, 6)" :key="ev.id" class="fsp-ig-feed-item"
                v-tooltip.bottom="`${ev.label} · ${ev.companyName} · ${ev.phase} · ${ev.dateStr}`">
                <div class="fsp-ig-feed-dot" :style="{ background: ev.color }"></div>
                <div class="fsp-ig-feed-body">
                  <div class="fsp-ig-feed-label">{{ ev.label }}</div>
                  <div class="fsp-ig-feed-meta">{{ ev.companyName }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Pipeline секция перенесена внутрь монитора (companyViewMode === 'pipeline') -->

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: Analytics (Финансы + Оценки — Progressive Disclosure) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeView === 'analytics'" class="page-content">
      <div class="page-card">
      <div class="page-section-title" style="margin-bottom:10px">
        {{ analyticsSubTab === 'finance' ? 'Финансовые показатели (тыс. ₽)' : 'Доли фонда и оценки компаний' }}
      </div>

      <!-- Sub-tab: Finance -->
      <DataTable v-if="analyticsSubTab === 'finance'" :value="financeTableData" size="small" stripedRows scrollable scrollHeight="520px"
                 sortField="totalInvestment" :sortOrder="-1" class="fsp-datatable">
        <Column field="name" header="Компания" :sortable="true" frozen style="min-width:180px">
          <template #body="{ data }">
            <span class="fsp-dt-name" @click="selectCompanyById(data.id)"><Icon :icon="companyIcon(data)" class="fsp-icon-md fsp-icon-inline" />{{ companyDisplayName(data) }}</span>
            <div class="fsp-dt-sub">{{ data.subfund }} · {{ data.statusLabel }}</div>
          </template>
        </Column>
        <Column field="totalInvestment" header="Инвестиции" :sortable="true" style="min-width:110px">
          <template #body="{ data }">
            <span class="fsp-val-blue">{{ fmtMln(data.totalInvestment) }}</span>
          </template>
        </Column>
        <Column field="revenue" header="Выручка" :sortable="true" style="min-width:110px">
          <template #body="{ data }">
            <span :style="{ color: data.revenue > 0 ? 'var(--fst-green)' : 'var(--p-text-muted-color)' }">
              {{ data.revenue ? fmtMln(data.revenue) : '—' }}
            </span>
            <div v-if="data.revenueYear !== '—'" class="fsp-dt-sub">{{ data.revenueYear }}</div>
          </template>
        </Column>
        <Column field="ebitda" header="EBITDA" :sortable="true" style="min-width:100px">
          <template #body="{ data }">
            <span :style="{ color: data.ebitda > 0 ? 'var(--fst-green)' : data.ebitda < 0 ? 'var(--fst-red)' : 'var(--p-text-muted-color)' }">
              {{ data.ebitda ? fmtMln(data.ebitda) : '—' }}
            </span>
          </template>
        </Column>
        <Column field="npv" header="NPV" :sortable="true" style="min-width:100px">
          <template #body="{ data }">{{ data.npv ? fmtMln(data.npv) : '—' }}</template>
        </Column>
        <Column field="irr" header="IRR %" :sortable="true" style="min-width:80px">
          <template #body="{ data }">
            <span v-if="data.irr" :style="{ color: data.irr >= 25 ? 'var(--fst-green)' : 'var(--fst-brand)' }">{{ data.irr }}%</span>
            <span v-else style="color:var(--p-text-muted-color)">—</span>
          </template>
        </Column>
      </DataTable>

      <!-- Sub-tab: Valuations -->
      <DataTable v-else :value="valuationsTableData" size="small" stripedRows scrollable scrollHeight="520px"
                 sortField="fundShare" :sortOrder="-1" class="fsp-datatable">
        <Column field="name" header="Компания" :sortable="true" frozen style="min-width:180px">
          <template #body="{ data }">
            <span class="fsp-dt-name" @click="selectCompanyById(data.id)"><Icon :icon="companyIcon(data)" class="fsp-icon-md fsp-icon-inline" />{{ companyDisplayName(data) }}</span>
            <div class="fsp-dt-sub">{{ data.subfund }}</div>
          </template>
        </Column>
        <Column field="fundShare" header="Доля %" :sortable="true" style="min-width:80px">
          <template #body="{ data }">
            <span v-if="data.fundShare" class="fsp-val-purple">{{ data.fundShare }}%</span>
            <span v-else style="color:var(--p-text-muted-color)">—</span>
          </template>
        </Column>
        <Column field="preMoney" header="Pre-money" :sortable="true" style="min-width:110px">
          <template #body="{ data }">{{ data.preMoney ? fmtMln(data.preMoney) + ' ₽' : '—' }}</template>
        </Column>
        <Column field="postMoney" header="Post-money" :sortable="true" style="min-width:110px">
          <template #body="{ data }">{{ data.postMoney ? fmtMln(data.postMoney) + ' ₽' : '—' }}</template>
        </Column>
        <Column field="navEstimate" header="NAV" :sortable="true" style="min-width:110px">
          <template #body="{ data }">
            <span v-if="data.navEstimate" class="fsp-val-green">{{ fmtMln(data.navEstimate) }} ₽</span>
            <span v-else style="color:var(--p-text-muted-color)">—</span>
          </template>
        </Column>
        <Column field="trl" header="TRL" :sortable="true" style="min-width:60px">
          <template #body="{ data }">
            <span :style="{ color: data.trl >= 7 ? 'var(--fst-green)' : data.trl >= 4 ? 'var(--fst-blue)' : 'var(--fst-brand)' }">{{ data.trl || '—' }}</span>
          </template>
        </Column>
        <Column field="headcount" header="Штат" :sortable="true" style="min-width:70px">
          <template #body="{ data }">{{ data.headcount || '—' }}</template>
        </Column>
      </DataTable>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: Monitor (company detail) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else class="fsp-body">

      <!-- ═══ Pipeline view (Kanban по стадиям) — подрежим внутри «Компании» ═══ -->
      <div v-if="companyViewMode === 'pipeline'" class="fsp-pipeline-wrap">
        <div class="page-section-title" style="margin-bottom:12px">Воронка: от заявки до портфеля</div>
        <div class="fsp-pipeline">
          <div v-for="stage in pipelineStages" :key="stage.id" class="fsp-pipe-stage">
            <div class="fsp-pipe-header" :style="{ borderBottomColor: stage.color }" v-tooltip.bottom="`${stage.label}: ${stage.companies.length} компаний`">
              <Icon v-if="stage.iconifyIcon" :icon="stage.icon" :style="{ color: stage.color, fontSize: '16px' }" />
              <i v-else :class="stage.icon" :style="{ color: stage.color }"></i>
              <span class="fsp-pipe-title">{{ stage.label }}</span>
              <span class="fsp-pipe-count" :style="{ background: stage.color }">{{ stage.companies.length }}</span>
            </div>
            <div class="fsp-pipe-cards">
              <div v-for="c in stage.companies" :key="c.id" class="fsp-pipe-card"
                @click="selectCompany(c); companyViewMode = 'cards'"
                v-tooltip.bottom="`${companyDisplayName(c)} · ${c.subfund} · TRL ${c.trl || '—'} · Health ${companyHealth(c)}%`">
                <div class="fsp-pipe-card-name"><Icon :icon="companyIcon(c)" class="fsp-icon-md fsp-icon-inline" />{{ companyDisplayName(c) }}</div>
                <div class="fsp-pipe-card-meta">
                  <span v-if="c.subfund">{{ c.subfund }}</span>
                  <span v-if="c.trl">TRL {{ c.trl }}</span>
                  <span v-if="c.invested">{{ c.invested }}М</span>
                </div>
              </div>
              <div v-if="!stage.companies.length" class="fsp-pipe-empty">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Cards view (карточки + детальная панель) ═══ -->
      <!-- Left: Company Cards -->
      <template v-else>
      <div class="fsp-companies">
        <div class="page-section-title fsp-companies-label">
          {{ filterScope === 'all' ? 'Все компании' : filterScope === 'portfolio' ? 'Портфельные компании' : 'На рассмотрении' }}
          <span class="fsp-text-muted" style="font-weight:400"> ({{ filteredCompanies.length }})</span>
        </div>

        <!-- Alert banner -->
        <div v-if="criticalAlerts.length" class="fsp-alert-banner">
          <i class="pi pi-exclamation-triangle fsp-icon-md fsp-val-red"</i>
          <span><b>Критические риски:</b> {{ criticalAlerts.map(a => a.company).join(', ') }}</span>
          <Button label="Созвать ИК" icon="pi pi-users" size="small" severity="danger" @click="callCommittee" style="margin-left:auto" />
        </div>

        <!-- Compare toolbar -->
        <div v-if="compareMode" class="fsp-compare-toolbar">
          <Icon icon="lucide:columns-2" class="fsp-icon-md" style="color:var(--fst-purple)" />
          <span>Сравнение: выберите до 3 компаний ({{ compareSelected.length }}/3)</span>
          <Button v-if="compareSelected.length >= 2" label="Сравнить" icon="pi pi-chart-bar" size="small" severity="info"
            @click="compareMode = false" />
          <Button label="Отмена" size="small" severity="secondary" text @click="compareMode = false; compareSelected = []" />
        </div>

        <!-- Grid of cards -->
        <div class="fsp-cards-grid">
          <div v-for="c in filteredCompanies" :key="c.id"
            class="fsp-card" :class="{
              selected: selectedCompany?.id === c.id,
              ['risk-' + c.riskLevel]: true,
              'is-review': c._scope === 'review',
              'fsp-card--changed': changedCompanies.has(c.id),
              'fsp-card--compare': compareSelected.includes(c.id),
            }"
            :style="{ borderLeftWidth: c.invested > 0 ? Math.min(5, Math.max(2, c.invested / 200)) + 'px' : '2px' }"
            @click="compareMode ? toggleCompare(c) : selectCompany(c)"
            v-tooltip.bottom="`${companyDisplayName(c)} · ${c.subfund} · ${c.stage} · Health ${companyHealth(c)}% · TRL ${c.trl || '—'}`">
            <!-- Change badge (Change Blindness Prevention) -->
            <div v-if="changedCompanies.has(c.id)" class="fsp-card-changed-badge" v-tooltip.bottom="'Данные обновились'">
              <Icon icon="lucide:refresh-cw" class="fsp-icon-xs" />
            </div>
            <!-- Compare checkbox -->
            <div v-if="compareMode" class="fsp-card-compare-check" @click.stop="toggleCompare(c)">
              <Icon :icon="compareSelected.includes(c.id) ? 'lucide:check-square' : 'lucide:square'" class="fsp-icon-lg" style="color:var(--fst-purple)" />
            </div>
            <div class="fsp-card-header">
              <div class="fsp-card-name"><Icon :icon="companyIcon(c)" class="fsp-card-icon" />{{ companyDisplayName(c) }}</div>
              <div class="fsp-card-badges">
                <Tag v-if="c._scope === 'review'" value="ИК" class="fsp-tag-sm-brand" />
                <Tag :value="c.subfund" class="fsp-tag-sm-blue" />
                <div class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" v-tooltip.bottom="riskLabel(c.riskLevel)"></div>
              </div>
            </div>
            <div class="fsp-card-stage">{{ c.stage }}{{ c.inn ? ' · ' + c.inn : '' }}</div>
            <div class="fsp-card-metrics">
              <div class="fsp-card-metric" v-tooltip.bottom="c._scope === 'review' ? 'Запрашиваемый объём инвестиций (тыс. ₽)' : 'Объём инвестиций фонда в компанию (тыс. ₽)'">
                <span class="fsp-m-label"><Icon icon="lucide:wallet" class="fsp-m-icon" />{{ c._scope === 'review' ? 'Запрос' : 'Инвестиции' }}</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.invested ? c.invested + 'М' : '—' }}</span>
              </div>
              <div class="fsp-card-metric" v-tooltip.bottom="c._scope === 'review' ? 'Размер команды (сотрудники)' : 'Доля фонда ФСТ НТИ в капитале (%)'">
                <span class="fsp-m-label"><Icon :icon="c._scope === 'review' ? 'lucide:users' : 'lucide:pie-chart'" class="fsp-m-icon" />{{ c._scope === 'review' ? 'Команда' : 'Доля ФСТ' }}</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-purple)' }">{{ c._scope === 'review' ? (c.headcount || '—') : (c.fstShare ? c.fstShare + '%' : '—') }}</span>
              </div>
              <div class="fsp-card-metric" v-tooltip.bottom="'TRL — уровень готовности технологии: от 1 (идея) до 9 (серийное производство)'">
                <span class="fsp-m-label"><Icon icon="lucide:flask-conical" class="fsp-m-icon" />TRL</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.trl || '—' }}</span>
              </div>
              <div class="fsp-card-metric" v-tooltip.bottom="'Годовая выручка (тыс. ₽) — ключевой показатель зрелости'">
                <span class="fsp-m-label"><Icon icon="lucide:banknote" class="fsp-m-icon" />Выручка</span>
                <span class="fsp-m-val" :style="{ color: c.revenue > 0 ? 'var(--fst-green)' : 'var(--p-text-muted-color)' }">{{ c.revenue ? c.revenue + 'М' : '—' }}</span>
              </div>
            </div>
            <div class="fsp-health-bar-wrap" v-tooltip.bottom="`Health: ${companyHealth(c)}% — ${companyHealth(c) >= 70 ? 'в норме' : companyHealth(c) >= 40 ? 'требует внимания' : 'критическое состояние!'}`">
              <div class="fsp-health-bar" :style="{ width: companyHealth(c) + '%', background: companyHealthBarColor(c) }"></div>
              <span class="fsp-health-val">{{ companyHealth(c) }}%</span>
            </div>
            <div class="fsp-card-footer-actions">
              <button class="fsp-hist-btn" @click.stop="openProjectHub(c)">
                <i class="pi pi-history fsp-icon-xs"></i> История
              </button>
              <button v-if="!compareMode" class="fsp-hist-btn" @click.stop="compareMode = true; compareSelected = [c.id]">
                <Icon icon="lucide:columns-2" class="fsp-icon-xs" /> Сравнить
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Detail panel -->
      <div class="fsp-detail" v-if="selectedCompany">

        <!-- Company Header -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-company-header">
            <div>
              <div class="fsp-detail-name"><Icon :icon="companyIcon(selectedCompany)" class="fsp-icon-xl fsp-icon-inline-lg" />{{ companyDisplayName(selectedCompany) }}</div>
              <div class="fsp-detail-sub">
                {{ selectedCompany.inn ? selectedCompany.inn + ' · ' : '' }}{{ selectedCompany.stage }} · {{ selectedCompany.subfund }}
                <Tag v-if="selectedCompany._scope === 'review'" value="На рассмотрении" severity="warn" class="fsp-tag-sm" style="margin-left:4px" />
                <Tag v-else value="Портфель" severity="success" class="fsp-tag-sm" style="margin-left:4px" />
              </div>
            </div>
            <div class="fsp-detail-health-badge"
              :style="{ background: companyHealthBarColor(selectedCompany) }"
              v-tooltip.bottom="healthBreakdown(selectedCompany).map(f => `${f.good ? '✓' : '✗'} ${f.label} ${f.val}`).join('\n')">
              {{ companyHealth(selectedCompany) }}%
            </div>
          </div>

          <!-- #4 Health breakdown (прозрачность) -->
          <div class="fsp-health-breakdown">
            <div v-for="f in healthBreakdown(selectedCompany)" :key="f.label" class="fsp-hb-item"
              :class="{ good: f.good, bad: !f.good }">
              <Icon :icon="f.good ? 'lucide:check' : 'lucide:x'" class="fsp-hb-icon" />
              <span class="fsp-hb-label">{{ f.label }}</span>
              <span class="fsp-hb-val">{{ f.val }}</span>
            </div>
          </div>

          <!-- Project description -->
          <div v-if="companyDescription(selectedCompany)" class="fsp-detail-desc">
            {{ companyDescription(selectedCompany) }}
          </div>

          <!-- Quick facts (Progressive Disclosure — System 1 уровень) -->
          <div class="fsp-quick-facts">
            <div v-if="selectedCompany.foundedYear" class="fsp-qf" v-tooltip.bottom="'Год основания'">
              <Icon icon="lucide:calendar" class="fsp-qf-icon" /><span>{{ selectedCompany.foundedYear }}</span>
            </div>
            <div v-if="selectedCompany.headcount" class="fsp-qf" v-tooltip.bottom="'Размер команды'">
              <Icon icon="lucide:users" class="fsp-qf-icon" /><span>{{ selectedCompany.headcount }} чел.</span>
            </div>
            <div v-if="selectedCompany.patents" class="fsp-qf" v-tooltip.bottom="'Патенты'">
              <Icon icon="lucide:file-badge" class="fsp-qf-icon" /><span>{{ selectedCompany.patents }} пат.</span>
            </div>
            <div v-if="selectedCompany.marketSizeMln" class="fsp-qf" v-tooltip.bottom="'Объём рынка (млн ₽)'">
              <Icon icon="lucide:globe" class="fsp-qf-icon" /><span>{{ selectedCompany.marketSizeMln }}М</span>
            </div>
            <div v-if="selectedCompany.mrl" class="fsp-qf" v-tooltip.bottom="'MRL — Manufacturing Readiness Level'">
              <Icon icon="lucide:factory" class="fsp-qf-icon" /><span>MRL {{ selectedCompany.mrl }}</span>
            </div>
            <div v-if="selectedCompany.sovereigntyScore" class="fsp-qf" v-tooltip.bottom="'Индекс технологического суверенитета (0-9)'">
              <Icon icon="lucide:shield-check" class="fsp-qf-icon" /><span>Суверенитет {{ selectedCompany.sovereigntyScore }}/9</span>
            </div>
            <div v-if="selectedCompany.trl" class="fsp-qf" v-tooltip.bottom="'TRL — Technology Readiness Level'">
              <Icon icon="lucide:flask-conical" class="fsp-qf-icon" /><span>TRL {{ selectedCompany.trl }}</span>
            </div>
            <div v-if="selectedCompany.projectedIRR" class="fsp-qf" v-tooltip.bottom="'Прогнозный IRR (%)'">
              <Icon icon="lucide:trending-up" class="fsp-qf-icon" /><span>IRR {{ selectedCompany.projectedIRR }}%</span>
            </div>
          </div>

          <!-- KPI Progress -->
          <div class="fsp-kpi-section">
            <div class="fsp-kpi-row" v-for="kpi in selectedCompany.kpis" :key="kpi.name">
              <div class="fsp-kpi-label">{{ kpi.name }}</div>
              <div class="fsp-kpi-bar-wrap">
                <div class="fsp-kpi-bar" :style="{ width: Math.min(100, kpi.actual / kpi.target * 100) + '%', background: kpiColor(kpi) }"></div>
              </div>
              <div class="fsp-kpi-nums">
                <span :style="{ color: kpiColor(kpi) }">{{ kpi.actual }}</span>
                <span style="color:var(--p-text-muted-color)"> / {{ kpi.target }} {{ kpi.unit }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Real Metrics from Integram -->
        <div class="fsp-detail-panel" v-if="getMetrics(selectedCompany.id)">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-chart-bar" style="color:var(--fst-blue)"></i> Метрики (Integram)
          </div>
          <div class="fsp-real-metrics">
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).totalInvestment">
              <span class="fsp-rm-label">Инвестировано</span>
              <span class="fsp-rm-val" style="color:var(--fst-blue)">{{ fmtMln(getMetrics(selectedCompany.id).totalInvestment) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).fundShare">
              <span class="fsp-rm-label">Доля фонда</span>
              <span class="fsp-rm-val" style="color:var(--fst-purple)">{{ getMetrics(selectedCompany.id).fundShare }}%</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).preMoney">
              <span class="fsp-rm-label">Pre-money</span>
              <span class="fsp-rm-val">{{ fmtMln(getMetrics(selectedCompany.id).preMoney) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).postMoney">
              <span class="fsp-rm-label">Post-money</span>
              <span class="fsp-rm-val">{{ fmtMln(getMetrics(selectedCompany.id).postMoney) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).revenue">
              <span class="fsp-rm-label">Выручка ({{ getMetrics(selectedCompany.id).revenueYear }})</span>
              <span class="fsp-rm-val" style="color:var(--fst-green)">{{ fmtMln(getMetrics(selectedCompany.id).revenue) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).ebitda">
              <span class="fsp-rm-label">EBITDA ({{ getMetrics(selectedCompany.id).ebitdaYear }})</span>
              <span class="fsp-rm-val" :style="{ color: getMetrics(selectedCompany.id).ebitda > 0 ? 'var(--fst-green)' : 'var(--fst-red)' }">{{ fmtMln(getMetrics(selectedCompany.id).ebitda) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).irr">
              <span class="fsp-rm-label">IRR</span>
              <span class="fsp-rm-val">{{ getMetrics(selectedCompany.id).irr }}%</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).npv">
              <span class="fsp-rm-label">NPV</span>
              <span class="fsp-rm-val">{{ fmtMln(getMetrics(selectedCompany.id).npv) }} ₽</span>
            </div>
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).headcount">
              <span class="fsp-rm-label">Штат</span>
              <span class="fsp-rm-val">{{ getMetrics(selectedCompany.id).headcount }} чел.</span>
            </div>
            <!-- Revenue dynamics -->
            <div v-if="getMetrics(selectedCompany.id).revenueByYear?.length > 1" class="fsp-rm-dynamics">
              <div class="page-section-title">Динамика выручки</div>
              <div class="fsp-rm-dyn-row" v-for="r in getMetrics(selectedCompany.id).revenueByYear" :key="r.year">
                <span class="fsp-rm-dyn-year">{{ r.year }}</span>
                <div class="fsp-rm-dyn-bar-wrap">
                  <div class="fsp-rm-dyn-bar" :style="{ width: revenueBarWidth(r.value, selectedCompany.id) + '%' }"></div>
                </div>
                <span class="fsp-rm-dyn-val">{{ fmtMln(r.value) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- #2 AI Analysis (one-click summary) -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-sparkles" style="color:var(--fst-purple)"></i> AI-анализ
            <Button v-if="!companyAiSummary && !companyAiLoading" label="Сгенерировать" icon="pi pi-sparkles"
              size="small" severity="secondary" text style="margin-left:auto" @click="generateCompanyAiSummary" />
            <i v-if="companyAiLoading" class="pi pi-spin pi-spinner" style="margin-left:auto;color:var(--fst-purple)"></i>
          </div>
          <div v-if="companyAiSummary" class="fsp-ai-company-summary" v-html="formatChatText(companyAiSummary)"></div>
          <div v-else-if="!companyAiLoading" class="fsp-ai-company-hint">
            Нажмите «Сгенерировать» для AI-анализа компании
          </div>
        </div>

        <!-- Entity Links (ontology) -->
        <div class="fsp-detail-panel">
          <EntityLinksPanel
            :entityId="selectedCompany.id"
            entityType="company"
            :labelMap="conceptLabelMap"
            @link-added="onLinkAdded"
          />
        </div>

        <!-- Timeline Events (EventStore) -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-history" style="color:var(--fst-cyan)"></i> Лента событий
            <span class="fsp-tl-count">{{ companyTimeline.length }}</span>
            <Button icon="pi pi-plus" size="small" severity="secondary" text
                    style="margin-left:auto" @click="addEventDialog = true" />
          </div>
          <div class="fsp-events">
            <div v-for="ev in companyTimeline.slice().reverse().slice(0, 15)" :key="ev.id" class="fsp-event">
              <div class="fsp-event-dot" :style="{ background: ev.color || eventColor(ev.data?.originalType || ev.type) }"></div>
              <div class="fsp-event-body">
                <div class="fsp-event-title">
                  <i v-if="ev.icon" :class="ev.icon" :style="{ color: ev.color, fontSize:'11px', marginRight:'4px' }" />
                  {{ ev.label || ev.data?.title || ev.type }}
                </div>
                <div class="fsp-event-date">{{ new Date(ev.ts).toLocaleDateString('ru-RU') }}</div>
              </div>
              <Tag :value="ev.data?.originalType || ev.type.replace(/_/g,' ')"
                   :style="{ fontSize: '9px', background: ev.color || 'var(--fst-blue)', color: 'white', maxWidth:'90px', overflow:'hidden' }" />
            </div>
          </div>
          <!-- Add event dialog -->
          <div v-if="addEventDialog" class="fsp-add-event-dialog">
            <div class="fsp-aed-title">Добавить событие</div>
            <Select v-model="newEventType" :options="EVENT_TYPE_OPTIONS"
                    option-label="label" option-value="value" style="width:100%;margin-bottom:0.4rem" />
            <InputText v-model="newEventNote" placeholder="Примечание"
                       style="width:100%;margin-bottom:0.4rem" />
            <div style="display:flex;gap:0.4rem">
              <Button label="Добавить" icon="pi pi-check" size="small" @click="addCompanyEvent" />
              <Button label="Отмена" severity="secondary" size="small" @click="addEventDialog=false" />
            </div>
          </div>
        </div>

        <!-- Ontology Next Steps + Causal -->
        <OntologyNextSteps entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:8px" />
        <CausalExplanation entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:10px" />

        <!-- Navigation buttons -->
        <div class="fsp-detail-nav">
          <Button icon="pi pi-file-edit" label="Сделка" severity="info" size="small" @click="$router.push('/fst-deal')" />
          <Button icon="pi pi-list-check" label="Исполнение" severity="success" size="small" @click="$router.push('/fst-execution')" />
          <Button icon="pi pi-chart-line" label="ЦД Компании" severity="secondary" size="small" @click="$router.push('/fst-twin')" />
        </div>
      </div>

      <!-- #3 Compare panel (side-by-side) -->
      <div v-if="compareCompanies.length >= 2 && !compareMode" class="fsp-detail fsp-compare-panel">
        <div class="fsp-compare-header">
          <Icon icon="lucide:columns-2" class="fsp-icon-lg" style="color:var(--fst-purple)" />
          <span>Сравнение компаний</span>
          <Button icon="pi pi-times" size="small" text severity="secondary" style="margin-left:auto"
            @click="compareSelected = []" />
        </div>
        <div class="fsp-compare-grid" :style="{ gridTemplateColumns: `120px repeat(${compareCompanies.length}, 1fr)` }">
          <!-- Header row -->
          <div class="fsp-cmp-label"></div>
          <div v-for="cc in compareCompanies" :key="'h-'+cc.id" class="fsp-cmp-company-name">
            <Icon :icon="companyIcon(cc)" class="fsp-icon-md" /> {{ companyDisplayName(cc) }}
          </div>
          <!-- Rows -->
          <template v-for="row in [
            { label: 'Health', key: c => companyHealth(c) + '%', color: c => companyHealthBarColor(c) },
            { label: 'TRL', key: c => c.trl || '—' },
            { label: 'Инвестиции', key: c => c.invested ? c.invested + 'М' : '—', color: () => 'var(--fst-blue)' },
            { label: 'Выручка', key: c => c.revenue ? c.revenue + 'М' : '—', color: c => c.revenue > 0 ? 'var(--fst-green)' : 'var(--p-text-muted-color)' },
            { label: 'Доля ФСТ', key: c => c.fstShare ? c.fstShare + '%' : '—', color: () => 'var(--fst-purple)' },
            { label: 'Штат', key: c => c.headcount || '—' },
            { label: 'Субфонд', key: c => c.subfund },
            { label: 'Стадия', key: c => c.stage },
            { label: 'Суверенитет', key: c => c.sovereigntyScore ? c.sovereigntyScore + '/9' : '—' },
          ]" :key="row.label">
            <div class="fsp-cmp-label">{{ row.label }}</div>
            <div v-for="cc in compareCompanies" :key="row.label+'-'+cc.id" class="fsp-cmp-val"
              :style="{ color: row.color ? row.color(cc) : 'var(--p-text-color)' }">
              {{ row.key(cc) }}
            </div>
          </template>
        </div>
      </div>

      <!-- Empty state → Портфельное саммари (Kahneman System 1 — мгновенный контекст) -->
      <div v-else-if="compareCompanies.length < 2 || compareMode" class="fsp-detail fsp-detail-summary">
        <div class="fsp-sum-header">
          <Icon icon="lucide:layout-dashboard" class="fsp-icon-xl" style="color:var(--fst-purple)" />
          <span>Портфель ФСТ НТИ</span>
        </div>
        <div class="fsp-sum-stats">
          <div class="fsp-sum-stat">
            <div class="fsp-sum-stat-val" style="color:var(--fst-green)">{{ portfolioCount }}</div>
            <div class="fsp-sum-stat-label">В портфеле</div>
          </div>
          <div class="fsp-sum-stat">
            <div class="fsp-sum-stat-val" style="color:var(--fst-brand)">{{ reviewCount }}</div>
            <div class="fsp-sum-stat-label">На рассмотрении</div>
          </div>
          <div class="fsp-sum-stat">
            <div class="fsp-sum-stat-val" style="color:var(--fst-blue)">{{ totalInvestedSum }}</div>
            <div class="fsp-sum-stat-label">Инвестиции (млн)</div>
          </div>
          <div class="fsp-sum-stat">
            <div class="fsp-sum-stat-val" style="color:var(--fst-purple)">{{ avgTRL }}</div>
            <div class="fsp-sum-stat-label">Ср. TRL</div>
          </div>
        </div>

        <!-- Топ компании по инвестициям -->
        <div class="fsp-sum-section">
          <div class="page-section-title">Топ компании по инвестициям</div>
          <div v-for="c in topInvestedCompanies" :key="c.id" class="fsp-sum-top-row" @click="selectCompany(c)">
            <Icon :icon="companyIcon(c)" class="fsp-icon-md" style="opacity:0.7" />
            <span class="fsp-sum-top-name">{{ companyDisplayName(c) }}</span>
            <span class="fsp-sum-top-val" style="color:var(--fst-blue)">{{ c.invested }}М</span>
            <div class="fsp-sum-top-bar-wrap">
              <div class="fsp-sum-top-bar" :style="{ width: (c.invested / (topInvestedCompanies[0]?.invested || 1) * 100) + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Субфонды -->
        <div class="fsp-sum-section">
          <div class="page-section-title">По субфондам</div>
          <div v-for="sf in subfundBreakdown" :key="sf.name" class="fsp-sum-sf-row">
            <Icon :icon="SUBFUND_ICONS[sf.name] || 'lucide:folder'" class="fsp-icon-sm" style="opacity:0.6" />
            <span class="fsp-sum-sf-name">{{ sf.name }}</span>
            <span class="fsp-sum-sf-count">{{ sf.count }}</span>
            <div class="fsp-sum-sf-bar-wrap">
              <div class="fsp-sum-sf-bar" :style="{ width: sf.pct + '%' }"></div>
            </div>
          </div>
        </div>

        <div class="fsp-sum-hint">
          <Icon icon="lucide:mouse-pointer-click" class="fsp-icon-md" style="opacity:0.5" />
          Выберите компанию слева для детального просмотра
        </div>
      </div>
      </template>

    </div>

    <!-- Page Tutor moved to sidebar chat chips -->

  </FstPageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useProjectStore } from '@/stores/projectStore.js'
import { useChatContextStore } from '@/stores/chatContextStore.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { getProjects, getProjectEntities, STATUS_PORTFOLIO } from '@/services/fstApi'
import { Icon } from '@iconify/vue'
import { fetchAllCompanyMetrics, summarizeMetrics, fmtMln } from '@/services/portfolioMetricsApi.js'
import PageTutorButton from '@/components/PageTutorButton.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import CausalExplanation from '@/components/ontology/CausalExplanation.vue'
import EntityLinksPanel from '@/components/links/EntityLinksPanel.vue'
import { useEventStore } from '@/stores/eventStore.js'
import { PORTFOLIO_EVENT_TYPES, DEAL_EVENT_TYPES, FUND_EVENT_TYPES, getEventDef } from '@/config/eventRegistry.js'
import { buildPortfolioContext } from '@/services/ontologyContextBuilder.js'
import { companyHealthScore, healthToColor } from '@/services/portfolioHealth.js'
import Chart from 'chart.js/auto'

const toast = useToast()
const eventStore = useEventStore()
const router = useRouter()
const projStore = useProjectStore()
const chatCtx = useChatContextStore()

// Status IDs from Integram
const STATUS_REVIEW = '1117'   // На рассмотрении ИК

// ── View tabs ─────────────────────────────────────────────────────────────────
const activeView = ref('dashboard')
const viewTabs = [
  { label: 'Дашборд',       id: 'dashboard', icon: 'pi pi-objects-column', color: 'var(--fst-blue)' },
  { label: 'Компании',      id: 'monitor',   icon: 'pi pi-building',      color: 'var(--fst-green)' },
  { label: 'Аналитика',     id: 'analytics', icon: 'pi pi-chart-line',    color: 'var(--fst-brand)' },
]
// Hick's Law: 4→3 вкладки, AI-аналитика через чат-сайдбар + навигатор
// Progressive Disclosure: Воронка → подрежим внутри «Компании»
// Cognitive Load: Финансы+Оценки → единая «Аналитика»
const companyViewMode = ref('cards') // 'cards' | 'pipeline'
const analyticsSubTab = ref('finance') // 'finance' | 'valuations'

// ── СОД: Контекст дашборда (кросс-блочная реактивность) ─────────────────────
const dashCtx = reactive({
  focusedPhase: null,     // выбранная фаза Phase Timeline
  focusedCompanyId: null, // подсвеченная компания (из любого блока)
  focusedSignal: null,    // раскрытый сигнал
})

// Клик по фазе → показать drill-down
function onPhaseClick(phase) {
  if (dashCtx.focusedPhase === phase.id) {
    dashCtx.focusedPhase = null
    return
  }
  dashCtx.focusedPhase = phase.id
  dashCtx.focusedCompanyId = null
  dashCtx.focusedSignal = null
}

// Клик по компании в дашборде → открыть диалог
const focusedDashCompany = ref(null)
const showCompanyDialog = ref(false)
function onCompanyDashClick(c) {
  focusedDashCompany.value = c
  showCompanyDialog.value = true
  dashCtx.focusedCompanyId = c.id
  // Генерируем событие в СОД
  sodPush({
    type: 'signal', icon: 'pi pi-building', title: companyDisplayName(c),
    body: `TRL: ${c.trl} · Health: ${companyHealth(c)}% · ${c.subfund || 'Без субфонда'}`,
    color: c.riskLevel === 'red' ? 'var(--fst-red)' : c.riskLevel === 'yellow' ? 'var(--fst-brand)' : 'var(--fst-green)',
    priority: 1, ttl: 6000
  })
}

// Клик по сигналу → раскрыть контекст
function onSignalClick(sig) {
  dashCtx.focusedCompanyId = sig.companyId
  dashCtx.focusedSignal = sig.id === dashCtx.focusedSignal ? null : sig.id
  if (sig.companyId) selectCompanyById(sig.companyId)
}

// Компании, попадающие в выбранную фазу
const phaseDrillCompanies = computed(() => {
  if (!dashCtx.focusedPhase) return []
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const result = []
  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    const hasPhase = tl.some(ev => allDefs[ev.type]?.phase === dashCtx.focusedPhase)
    if (hasPhase) {
      const phaseEvents = tl.filter(ev => allDefs[ev.type]?.phase === dashCtx.focusedPhase)
        .map(ev => ({ type: ev.type, label: allDefs[ev.type]?.label || ev.type, ts: ev.ts }))
      result.push({ ...c, phaseEvents })
    }
  }
  return result
})

// Фазовый лейбл для drill-down
const focusedPhaseLabel = computed(() => {
  if (!dashCtx.focusedPhase) return ''
  const ph = PHASE_DEFS.find(p => p.id === dashCtx.focusedPhase)
  return ph?.label || dashCtx.focusedPhase
})

// Пороговые алерты — автоматически генерируемые блоки
const thresholdAlerts = computed(() => {
  const alerts = []
  for (const c of portfolioCompanies.value) {
    const m = getMetrics(c.id)
    // Runway < 6 месяцев
    if (c.invested > 0 && c.revenue === 0) {
      const burnRate = c.invested / 24
      const remaining = c.invested / (burnRate || 1)
      if (remaining < 6) {
        alerts.push({ id: `runway-${c.id}`, type: 'runway_critical', company: companyDisplayName(c), companyId: c.id, value: Math.round(remaining), label: 'Runway < 6 мес' })
      }
    }
    // MOIC > 3x
    if (c.nav > 0 && c.invested > 0 && (c.nav / c.invested) > 3) {
      alerts.push({ id: `moic-star-${c.id}`, type: 'moic_star', company: companyDisplayName(c), companyId: c.id, value: (c.nav / c.invested).toFixed(1) + 'x', label: 'MOIC > 3x' })
    }
    // TRL >= 8
    if (c.trl >= 8) {
      alerts.push({ id: `trl-ready-${c.id}`, type: 'trl_ready', company: companyDisplayName(c), companyId: c.id, value: c.trl, label: 'TRL 8+ — готов к масштабированию' })
    }
  }
  return alerts
})

// ── Сброс дашборда к дефолтному виду ─────────────────────────────────────────
function resetDashboard() {
  destroyAiCharts()
  aiBlocks.value = []
  aiQuery.value = ''
  dashMode.value = 'live'
  stopDemo()
}

// ═══ СОБЫТИЙНЫЙ ДВИЖОК ДАШБОРДА (СОД) ═══════════════════════════════════════
const dashMode = ref('live') // 'live' | 'demo'
const sodBlocks = ref([])    // { id, type, icon, title, body, color, priority, ttl, createdAt }
let sodBlockIdCounter = 0
let demoInterval = null

// ─── Событийная метрик-полоска ───
const showMetricsStrip = ref(true)
let metricsInterval = null

function startMetricsCycle() {
  // Показать при загрузке на 6 сек, потом цикл: скрыть 20 сек → показать 6 сек
  if (metricsInterval) clearInterval(metricsInterval)
  showMetricsStrip.value = true
  setTimeout(() => {
    showMetricsStrip.value = false
    metricsInterval = setInterval(() => {
      showMetricsStrip.value = true
      setTimeout(() => { showMetricsStrip.value = false }, 6000)
    }, 25000)
  }, 6000)
}

function stopMetricsCycle() {
  if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null }
  showMetricsStrip.value = true // в не-dashboard view показывать всегда
}

// Добавить блок-событие на дашборд
function sodPush(block) {
  const id = ++sodBlockIdCounter
  const entry = { id, createdAt: Date.now(), ttl: block.ttl || 0, ...block }
  sodBlocks.value.unshift(entry)
  // Если ttl > 0, автоматически удалить через ttl мс
  if (entry.ttl > 0) {
    setTimeout(() => {
      sodBlocks.value = sodBlocks.value.filter(b => b.id !== id)
    }, entry.ttl)
  }
}

// Очистить все событийные блоки
function sodClear() {
  sodBlocks.value = []
}

// Генерация блоков из текущих данных (режим live)
function sodGenerateLive() {
  sodClear()
  // Пороговые алерты
  for (const a of thresholdAlerts.value) {
    sodPush({
      type: 'alert', icon: a.type === 'runway_critical' ? 'pi pi-exclamation-triangle' : a.type === 'moic_star' ? 'pi pi-star' : 'pi pi-bolt',
      title: a.company, body: a.label + (a.value ? ` (${a.value})` : ''),
      color: a.type === 'moic_star' || a.type === 'trl_ready' ? 'var(--fst-green)' : 'var(--fst-red)',
      priority: 1, ttl: 0
    })
  }
  // Активные сигналы
  for (const sig of activeSignals.value.slice(0, 5)) {
    sodPush({
      type: 'signal', icon: sig.icon || 'pi pi-bell', title: sig.label, body: sig.companyName || '',
      color: sig.severity === 'critical' ? 'var(--fst-red)' : sig.severity === 'warning' ? 'var(--fst-brand)' : 'var(--fst-blue)',
      priority: 2, ttl: 0
    })
  }
}

// ── ДЕМО-СИМУЛЯТОР ──────────────────────────────────────────────────────────
// Блоки-комиксы: каждый появляется, живёт TTL секунд, исчезает
const DEMO_EVENTS = [
  // ─── Алерты ───
  { type: 'alert', icon: 'pi pi-exclamation-triangle', title: 'Runway < 6 мес',
    body: 'Критический уровень кассы у 3 компаний',
    color: 'var(--fst-red)', priority: 1, visual: 'bar',
    barData: [{ label: 'КуСпейс', pct: 17, color: 'var(--fst-red)', val: '4м' }, { label: 'Лабадванс', pct: 42, color: 'var(--fst-brand)', val: '10м' }, { label: 'Эколибри', pct: 75, color: 'var(--fst-green)', val: '18м' }, { label: 'ИНЭСИС', pct: 33, color: 'var(--fst-brand)', val: '8м' }, { label: 'Брейнфон', pct: 58, color: 'var(--fst-green)', val: '14м' }],
    drillTitle: 'КуСпейс: cash flow', drillBody: 'Burn: 1.2М/мес · Касса: 4.8М', drillType: 'signal', drillColor: 'var(--fst-red)',
    drillVisual: 'kpi', drillKpi: [{ label: 'Burn', value: '1.2М/м' }, { label: 'Касса', value: '4.8М' }, { label: 'До нуля', value: '4 мес' }] },
  { type: 'alert', icon: 'pi pi-shield', title: 'Риск повышен: ИНЭСИС',
    body: 'yellow → red · задержка серийного производства',
    color: 'var(--fst-red)', priority: 1, visual: 'gauge', gaugeValue: 78, gaugeColor: 'var(--fst-red)', gaugeDisplay: '78 / 100', gaugeMax: 'Risk Score',
    drillTitle: 'ИНЭСИС: факторы риска', drillBody: 'Производство -6 мес, отток 2 ключевых инженеров', drillType: 'insight', drillColor: 'var(--fst-purple)' },

  // ─── Метрики фонда (широкие) ───
  { type: 'fund', icon: 'pi pi-calculator', title: 'Метрики фонда',
    body: 'Ключевые показатели', wide: true,
    color: 'var(--fst-blue)', priority: 2, visual: 'kpi',
    kpiData: [{ label: 'TVPI', value: '1.24x', color: 'var(--fst-green)' }, { label: 'DPI', value: '0.15x', color: 'var(--fst-blue)' }, { label: 'IRR', value: '18%', color: 'var(--fst-green)' }, { label: 'MOIC', value: '1.8x', color: 'var(--fst-brand)' }, { label: 'NAV', value: '620М', color: 'var(--fst-blue)' }],
    drillTitle: 'Динамика TVPI', drillBody: 'Рост +30% за год', drillType: 'chart', drillColor: 'var(--fst-green)',
    drillVisual: 'bar', drillBar: [{ label: 'Q1', pct: 38, color: 'var(--fst-brand)' }, { label: 'Q2', pct: 54, color: 'var(--fst-brand)' }, { label: 'Q3', pct: 72, color: 'var(--fst-green)' }, { label: 'Q4', pct: 88, color: 'var(--fst-green)' }] },

  // ─── Sparkline: выручка по кварталам ───
  { type: 'chart', icon: 'pi pi-chart-bar', title: 'Выручка портфеля по кварталам',
    body: 'Суммарная выручка 24 компаний', wide: true,
    color: 'var(--fst-green)', priority: 3, visual: 'spark',
    sparkData: [{ pct: 15 }, { pct: 22 }, { pct: 18 }, { pct: 35 }, { pct: 28 }, { pct: 45 }, { pct: 40 }, { pct: 55 }, { pct: 62 }, { pct: 58 }, { pct: 72 }, { pct: 85 }],
    sparkLabel: 'Q1\'24 → Q4\'25 · +467%',
    drillTitle: 'Лидеры выручки', drillBody: 'НПК Антей: 120М · Эколибри: 28М · Брейнфон: 9.6М', drillType: 'chart', drillColor: 'var(--fst-green)' },

  // ─── Deployment gauge ───
  { type: 'fund', icon: 'pi pi-wallet', title: 'Deployment капитала',
    body: '340М из 500М ₽ (68%)',
    color: 'var(--fst-blue)', priority: 2, visual: 'gauge', gaugeValue: 68, gaugeColor: 'var(--fst-green)', gaugeDisplay: '340М / 500М ₽', gaugeMax: '68% освоено',
    drillTitle: 'План Q2', drillBody: '3 новых входа: 3Д ИР, NeuroVox, AutoML', drillType: 'deal', drillColor: 'var(--fst-blue)',
    drillVisual: 'kpi', drillKpi: [{ label: 'План Q2', value: '120М' }, { label: 'Сделок', value: '3' }, { label: 'Остаток', value: '60М' }] },

  // ─── Table: топ-5 компаний ───
  { type: 'chart', icon: 'pi pi-table', title: 'Топ-5 по MOIC', wide: true,
    body: 'Лучшие инвестиции портфеля',
    color: 'var(--fst-green)', priority: 3, visual: 'table',
    tableData: [
      ['Компания', 'MOIC', 'TRL', 'Health'],
      ['НПК Антей', '3.2x', '9', '89%'],
      ['Эколибри', '1.4x', '7', '78%'],
      ['ЭраАэро', '0.9x', '6', '72%'],
      ['Брейнфон', '0.7x', '7', '68%'],
      ['3Д ИР', '0.5x', '4', '65%']
    ],
    drillTitle: 'НПК Антей: история', drillBody: 'Вход: 30М → Оценка: 96М · MOIC 3.2x за 18 мес', drillType: 'signal', drillColor: 'var(--fst-green)' },

  // ─── Milestone с sparkline ───
  { type: 'milestone', icon: 'pi pi-check-circle', title: 'Первая выручка: Эколибри',
    body: '2.3 млн ₽ за Q1 · транш-2 разблокирован',
    color: 'var(--fst-green)', priority: 1, visual: 'spark',
    sparkData: [{ pct: 0 }, { pct: 0 }, { pct: 0 }, { pct: 5 }, { pct: 12 }, { pct: 28 }, { pct: 35 }, { pct: 55 }, { pct: 72 }, { pct: 85 }, { pct: 92 }, { pct: 100, color: 'var(--fst-green)' }],
    sparkLabel: 'MRR рост · 0 → 2.3М ₽',
    drillTitle: 'Эколибри: воронка', drillBody: '12 лидов → 5 пилотов → 2 контракта', drillType: 'signal', drillColor: 'var(--fst-green)',
    drillVisual: 'bar', drillBar: [{ label: 'Лиды', pct: 100, color: 'var(--fst-blue)' }, { label: 'Пилоты', pct: 42, color: 'var(--fst-brand)' }, { label: 'Контракты', pct: 17, color: 'var(--fst-green)' }] },

  // ─── NAV фонда ───
  { type: 'fund', icon: 'pi pi-chart-line', title: 'NAV фонда',
    body: 'Чистые активы: 620М ₽',
    color: 'var(--fst-green)', priority: 2, visual: 'pie',
    pieData: [{ label: 'Портфель', pct: 84, color: 'var(--fst-green)' }, { label: 'Касса', pct: 10, color: 'var(--fst-blue)' }, { label: 'Начисления', pct: 6, color: 'var(--fst-purple)' }],
    drillTitle: 'Структура NAV', drillBody: 'Портфель: 520М · Касса: 60М · Начисл.: 40М', drillType: 'chart', drillColor: 'var(--fst-blue)' },

  // ─── Sparkline: TRL прогресс ───
  { type: 'signal', icon: 'pi pi-arrow-up', title: 'TRL прогресс портфеля',
    body: 'Средний TRL вырос: 4.2 → 5.7 за год',
    color: 'var(--fst-blue)', priority: 2, visual: 'spark',
    sparkData: [{ pct: 42, color: 'var(--fst-brand)' }, { pct: 45 }, { pct: 48 }, { pct: 50 }, { pct: 48 }, { pct: 52 }, { pct: 55 }, { pct: 57, color: 'var(--fst-green)' }],
    sparkLabel: 'Ср. TRL: 4.2 → 5.7',
    drillTitle: 'Лидеры TRL', drillBody: 'НПК Антей: 9 · Брейнфон: 7 · Эколибри: 7', drillType: 'signal', drillColor: 'var(--fst-green)' },

  // ─── Концентрация ───
  { type: 'alert', icon: 'pi pi-percentage', title: 'Концентрация: Herfindahl',
    body: '0.28 — высокая · нужно +2 компании',
    color: 'var(--fst-brand)', priority: 1, visual: 'bar',
    barData: [{ label: 'БАС', pct: 55, color: 'var(--fst-red)', val: '55%' }, { label: 'AITech', pct: 25, color: 'var(--fst-blue)', val: '25%' }, { label: 'Фотоника', pct: 20, color: 'var(--fst-purple)', val: '20%' }],
    drillTitle: 'Кандидаты AITech', drillBody: '3 заявки: NeuroVox, AutoML Vision, DataMesh', drillType: 'deal', drillColor: 'var(--fst-blue)',
    drillVisual: 'kpi', drillKpi: [{ label: 'В воронке', value: '3' }, { label: 'Ср. TRL', value: '5' }, { label: 'Ср. чек', value: '40М' }] },

  // ─── Deal ───
  { type: 'deal', icon: 'pi pi-briefcase', title: 'Term Sheet: 3Д ИР',
    body: 'Раунд А · 50 млн ₽ · доля 15%',
    color: 'var(--fst-blue)', priority: 2, visual: 'kpi',
    kpiData: [{ label: 'Раунд', value: '50М ₽', color: 'var(--fst-blue)' }, { label: 'Доля', value: '15%', color: 'var(--fst-green)' }, { label: 'Pre-money', value: '283М', color: 'var(--fst-brand)' }],
    drillTitle: '3Д ИР: Due Diligence', drillBody: 'Фин. аудит ✓ · Юрид. ✓ · Техн. — в процессе', drillType: 'chain', drillColor: 'var(--fst-cyan)' },

  // ─── MOIC bar chart ───
  { type: 'chart', icon: 'pi pi-chart-bar', title: 'MOIC по компаниям',
    body: 'Средний портфельный MOIC: 0.62x',
    color: 'var(--fst-blue)', priority: 3, visual: 'bar',
    barData: [{ label: 'НПК Антей', pct: 100, color: 'var(--fst-green)', val: '3.2x' }, { label: 'Эколибри', pct: 45, color: 'var(--fst-brand)', val: '1.4x' }, { label: 'ЭраАэро', pct: 28, color: 'var(--fst-brand)', val: '0.9x' }, { label: 'Брейнфон', pct: 22, color: 'var(--fst-brand)', val: '0.7x' }, { label: 'ИНЭСИС', pct: 12, color: 'var(--fst-red)', val: '0.4x' }],
    drillTitle: 'НПК Антей: MOIC', drillBody: 'Вход: 30М · Оценка: 96М · Доход: 66М', drillType: 'signal', drillColor: 'var(--fst-green)',
    drillVisual: 'kpi', drillKpi: [{ label: 'Вход', value: '30М' }, { label: 'Оценка', value: '96М' }, { label: 'Доход', value: '66М' }] },

  // ─── Здоровье портфеля ───
  { type: 'chart', icon: 'pi pi-compass', title: 'Health портфеля',
    body: 'Средний health 66% · 3 в красной зоне',
    color: 'var(--fst-brand)', priority: 3, visual: 'pie',
    pieData: [{ label: 'Норма (≥70%)', pct: 60, color: 'var(--fst-green)' }, { label: 'Внимание', pct: 28, color: 'var(--fst-brand)' }, { label: 'Критично', pct: 12, color: 'var(--fst-red)' }],
    drillTitle: 'Красная зона', drillBody: 'КуСпейс · ИНЭСИС · Кремнов', drillType: 'alert', drillColor: 'var(--fst-red)',
    drillVisual: 'bar', drillBar: [{ label: 'КуСпейс', pct: 25, color: 'var(--fst-red)' }, { label: 'ИНЭСИС', pct: 35, color: 'var(--fst-red)' }, { label: 'Кремнов', pct: 42, color: 'var(--fst-red)' }] },

  // ─── Выручка spark по компаниям (wide) ───
  { type: 'chart', icon: 'pi pi-chart-line', title: 'Инвестиции vs Выручка', wide: true,
    body: 'Соотношение вложений и отдачи',
    color: 'var(--fst-blue)', priority: 3, visual: 'bar',
    barData: [
      { label: 'НПК Антей', pct: 85, color: 'var(--fst-green)', val: '120М' },
      { label: 'Эколибри', pct: 38, color: 'var(--fst-green)', val: '28М' },
      { label: 'ЭраАэро', pct: 18, color: 'var(--fst-brand)', val: '12М' },
      { label: 'Брейнфон', pct: 12, color: 'var(--fst-brand)', val: '9.6М' },
      { label: 'ИНЭСИС', pct: 5, color: 'var(--fst-red)', val: '2М' },
      { label: 'КуСпейс', pct: 2, color: 'var(--fst-red)', val: '0.8М' }
    ],
    drillTitle: 'Efficiency ratio', drillBody: 'ROI портфеля: 1.24x за 2 года', drillType: 'fund', drillColor: 'var(--fst-blue)' },

  // ─── AI insight ───
  { type: 'insight', icon: 'pi pi-sparkles', title: 'AI: системный тренд',
    body: 'Субфонд БАС: все компании +30% выручки',
    color: 'var(--fst-purple)', priority: 2, visual: 'spark',
    sparkData: [{ pct: 30 }, { pct: 35 }, { pct: 42 }, { pct: 48 }, { pct: 55 }, { pct: 62 }, { pct: 70 }, { pct: 78 }, { pct: 85 }, { pct: 90 }],
    sparkLabel: 'Рост выручки БАС · Q1→Q4',
    drillTitle: 'Тренд БПЛА', drillBody: 'Рынок +40%/год · Госзаказ: 80 млрд ₽', drillType: 'chart', drillColor: 'var(--fst-blue)',
    drillVisual: 'kpi', drillKpi: [{ label: 'Рынок', value: '+40%' }, { label: 'Госзаказ', value: '80B' }, { label: 'Доля РФ', value: '12%' }] },

  // ─── Продукт запущен ───
  { type: 'milestone', icon: 'pi pi-flag', title: 'Launch: Брейнфон',
    body: 'TRL 7 · 3 пилотных клиента',
    color: 'var(--fst-green)', priority: 2, visual: 'kpi',
    kpiData: [{ label: 'MRR', value: '800K', color: 'var(--fst-green)' }, { label: 'Клиенты', value: '3', color: 'var(--fst-blue)' }, { label: 'TRL', value: '7', color: 'var(--fst-brand)' }, { label: 'NPS', value: '72', color: 'var(--fst-green)' }],
    drillTitle: 'Брейнфон: roadmap', drillBody: 'Цель Q2: MRR 2М ₽, 10 клиентов', drillType: 'insight', drillColor: 'var(--fst-purple)' },

  // ─── Цепочка ───
  { type: 'chain', icon: 'pi pi-share-alt', title: 'Цепочка: Эколибри',
    body: 'REVENUE → TRANCHE → транш-2 (25М ₽)',
    color: 'var(--fst-cyan)', priority: 3, visual: 'kpi',
    kpiData: [{ label: 'Сумма', value: '25М', color: 'var(--fst-cyan)' }, { label: 'KPI', value: '✓', color: 'var(--fst-green)' }, { label: 'Дата', value: '20.03', color: 'var(--fst-blue)' }],
    drillTitle: 'Транш: условия', drillBody: 'Выручка >2М ✓ · Комитет одобрил', drillType: 'deal', drillColor: 'var(--fst-blue)' },
]

// ─── Клик по SOD-блоку → порождает связанный drill-down блок ───
function onSodBlockClick(block) {
  if (!block.drillTitle) return
  const drill = {
    type: block.drillType || 'insight',
    icon: block.type === 'fund' ? 'pi pi-arrow-right' : 'pi pi-search',
    title: block.drillTitle,
    body: block.drillBody || '',
    color: block.drillColor || 'var(--fst-purple)',
    priority: 1,
    ttl: dashMode.value === 'demo' ? 7000 : 0
  }
  if (block.drillVisual === 'kpi' && block.drillKpi) {
    drill.visual = 'kpi'; drill.kpiData = block.drillKpi
  } else if (block.drillVisual === 'bar' && block.drillBar) {
    drill.visual = 'bar'; drill.barData = block.drillBar
  } else if (block.drillVisual === 'pie' && block.drillPie) {
    drill.visual = 'pie'; drill.pieData = block.drillPie
  }
  sodPush(drill)
  // Лимит блоков на экране
  if (sodBlocks.value.length > 5) {
    sodBlocks.value = sodBlocks.value.slice(0, 5)
  }
}
let demoIdx = 0

// ─── Демо: часы, скорость, семантическое поле ───
const demoSpeed = ref(1)
const demoTime = ref('09:00')
const demoFieldRef = ref(null)
let demoTimeMinutes = 540 // 09:00
let demoClockInterval = null


function demoPushFlash(evt) {
  const baseTtl = 7000
  const ttl = Math.round(baseTtl / demoSpeed.value)
  sodPush({ ...evt, ttl })
  // Сетка 3×3 = макс 9 блоков
  if (sodBlocks.value.length > 9) {
    sodBlocks.value = sodBlocks.value.slice(0, 9)
  }
}

function startDemo() {
  dashMode.value = 'demo'
  sodClear()
  demoIdx = 0
  demoTimeMinutes = 540 // 09:00
  demoTime.value = '09:00'

  demoPushFlash(DEMO_EVENTS[0])
  demoIdx = 1

  const baseInterval = 2200
  demoInterval = setInterval(() => {
    if (demoIdx >= DEMO_EVENTS.length) demoIdx = 0
    demoPushFlash(DEMO_EVENTS[demoIdx])
    demoIdx++
  }, baseInterval / demoSpeed.value)

  // Часы — ускоренные: каждая реальная секунда = 10 мин × скорость
  demoClockInterval = setInterval(() => {
    demoTimeMinutes += 10 * demoSpeed.value
    if (demoTimeMinutes >= 1440) demoTimeMinutes -= 1440
    const h = Math.floor(demoTimeMinutes / 60).toString().padStart(2, '0')
    const m = (demoTimeMinutes % 60).toString().padStart(2, '0')
    demoTime.value = `${h}:${m}`
  }, 1000)
}

function restartDemoInterval() {
  if (dashMode.value !== 'demo') return
  if (demoInterval) clearInterval(demoInterval)
  if (demoClockInterval) clearInterval(demoClockInterval)
  const baseInterval = 2200
  demoInterval = setInterval(() => {
    if (demoIdx >= DEMO_EVENTS.length) demoIdx = 0
    demoPushFlash(DEMO_EVENTS[demoIdx])
    demoIdx++
  }, baseInterval / demoSpeed.value)
  demoClockInterval = setInterval(() => {
    demoTimeMinutes += 10 * demoSpeed.value
    if (demoTimeMinutes >= 1440) demoTimeMinutes -= 1440
    const h = Math.floor(demoTimeMinutes / 60).toString().padStart(2, '0')
    const m = (demoTimeMinutes % 60).toString().padStart(2, '0')
    demoTime.value = `${h}:${m}`
  }, 1000)
}

function stopDemo() {
  dashMode.value = 'live'
  if (demoInterval) { clearInterval(demoInterval); demoInterval = null }
  if (demoClockInterval) { clearInterval(demoClockInterval); demoClockInterval = null }
  sodClear()
  sodGenerateLive()
}

// ── Chart refs ───────────────────────────────────────────────────────────────
const chartSubfundRef = ref(null)
const chartInvestRef = ref(null)
const chartRevenueRef = ref(null)
const chartStageRef = ref(null)
const chartTrlRef = ref(null)
const chartHealthRef = ref(null)
const chartBubbleRef = ref(null)
const chartEventRef = ref(null)
const chartDeployRef = ref(null)
let chartSubfund = null
let chartInvest = null
let chartRevenue = null
let chartStage = null
let chartTrl = null
let chartHealth = null
let chartBubble = null
let chartEvent = null
let chartDeploy = null
const chartMoicRef = ref(null)
const chartJcurveRef = ref(null)
const chartCohortRef = ref(null)
const chartRadarRef = ref(null)
let chartMoic = null
let chartJcurve = null
let chartCohort = null
let chartRadar = null

// ── Scope filter (portfolio / review / all) ──────────────────────────────────
const filterScope = ref('all')
const scopeOptions = [
  { label: 'Все', id: 'all' },
  { label: 'Портфель', id: 'portfolio' },
  { label: 'На рассмотрении', id: 'review' },
]

// ── Subfund references ──────────────────────────────────────────────────────
const SUBFUND_MAP = {
  '1096': 'БАС', '1098': 'РОБО', '1100': 'МЭ', '7283': 'AI/Tech',
  '124370': 'Фотоника', '124372': 'ФармаМед', '124374': 'Новые материалы',
  '124376': 'SpaceNet', '124378': 'Энерджинет', '124380': 'Агротех',
  '124382': 'Технет', '124384': 'MediaNet'
}
const SUBFUND_ICONS = {
  'БАС': 'lucide:plane', 'РОБО': 'lucide:bot', 'МЭ': 'lucide:zap',
  'AI/Tech': 'lucide:brain', 'Фотоника': 'lucide:sun', 'ФармаМед': 'lucide:heart-pulse',
  'Новые материалы': 'lucide:hexagon', 'SpaceNet': 'lucide:orbit',
  'Энерджинет': 'lucide:battery-charging', 'Агротех': 'lucide:sprout',
  'Технет': 'lucide:settings', 'MediaNet': 'lucide:tv',
}
const STAGE_MAP = { '1102': 'Pre-seed', '1103': 'Посевная', '1104': 'Раунд A', '1105': 'Раунд B', '1106': 'Раунд C' }

// ── Project entities (shortName + icon from Integram table 197955) ────────
const projectEntities = ref(new Map())

// Fallback маппинг: companyId → { shortName, icon } (пока не все компании привязаны к проектам)
const COMPANY_DISPLAY = {
  53280: { short: 'Эколибри', icon: 'lucide:bird' },
  53283: { short: 'ЭкстраСинема', icon: 'lucide:clapperboard' },
  53286: { short: '3D Ракета', icon: 'lucide:rocket' },
  53289: { short: 'ЭраАэро', icon: 'lucide:plane' },
  53292: { short: 'ИНЭСИС', icon: 'mdi:factory' },
  53295: { short: 'Redfab', icon: 'lucide:printer' },
  53298: { short: 'Лабадванс', icon: 'lucide:test-tubes' },
  53301: { short: 'АЙ 3Д', icon: 'lucide:boxes' },
  53304: { short: 'BRAINPHONE', icon: 'lucide:brain' },
  53307: { short: 'Кремний', icon: 'lucide:cpu' },
  53310: { short: 'Лазер', icon: 'lucide:zap' },
  53313: { short: 'QSpace', icon: 'lucide:atom' },
  53316: { short: 'Кварц', icon: 'lucide:gem' },
  53319: { short: 'AutoML', icon: 'lucide:bot' },
  53322: { short: 'Трансфлоу', icon: 'lucide:workflow' },
  53325: { short: 'ПЛК', icon: 'lucide:scan-line' },
  53328: { short: 'BIONOVATIC', icon: 'lucide:leaf' },
  53331: { short: 'Эпимицелл', icon: 'lucide:microscope' },
  53334: { short: 'Авирус', icon: 'lucide:shield' },
  53337: { short: 'ИнноРадио', icon: 'lucide:radio-tower' },
  53340: { short: 'Небо-22', icon: 'lucide:cloud' },
  53343: { short: 'Плазмо', icon: 'lucide:flame' },
  53346: { short: 'Хисиностат', icon: 'lucide:pill' },
  53349: { short: 'ЭлектроКварц', icon: 'lucide:bolt' },
  // Стартапы на рассмотрении — уже с короткими именами
  139789: { short: 'AVOICE', icon: 'lucide:mic' },
  139794: { short: 'Inmedikum', icon: 'lucide:heart-pulse' },
  139799: { short: 'Arkon', icon: 'lucide:hard-hat' },
  139804: { short: 'GLAZAR', icon: 'lucide:eye' },
  139809: { short: 'PROкоманда', icon: 'lucide:users' },
  139814: { short: 'Русграфен', icon: 'lucide:hexagon' },
  139819: { short: 'InBoost', icon: 'lucide:trending-up' },
  139824: { short: 'Fluctio', icon: 'lucide:waves' },
  139829: { short: 'Добробот', icon: 'lucide:bot' },
  139833: { short: 'Flowtech', icon: 'lucide:droplets' },
  139838: { short: 'Чистый космос', icon: 'lucide:orbit' },
  139843: { short: 'KeepRise', icon: 'lucide:chart-line' },
  139848: { short: 'Синтелли', icon: 'lucide:sparkles' },
  139853: { short: 'АваКано', icon: 'lucide:mountain' },
  139858: { short: 'HydroCom', icon: 'lucide:droplet' },
  139863: { short: 'MoniSensa', icon: 'lucide:activity' },
  139869: { short: 'Mobidriven', icon: 'lucide:smartphone' },
  139874: { short: 'Picvario', icon: 'lucide:image' },
  139879: { short: 'Andata', icon: 'lucide:database' },
  139884: { short: 'Акнауцер', icon: 'lucide:scan-face' },
  139889: { short: 'Segmantable', icon: 'lucide:layers' },
  139894: { short: 'DeepDive', icon: 'lucide:search' },
  139899: { short: 'SOMiN', icon: 'lucide:share-2' },
  139904: { short: 'Via MD', icon: 'lucide:stethoscope' },
  139909: { short: 'Scanderm', icon: 'lucide:scan' },
  139914: { short: 'Z-med', icon: 'lucide:pill' },
  139919: { short: 'One Health', icon: 'lucide:heart' },
  139924: { short: 'Doczilla', icon: 'lucide:file-text' },
  139929: { short: 'DreamDocs', icon: 'lucide:file-check' },
  139934: { short: 'Intelinvest', icon: 'lucide:bar-chart-2' },
  139939: { short: 'RedCat', icon: 'lucide:cat' },
  139944: { short: 'Билдокс', icon: 'lucide:building' },
  139949: { short: 'ПАЗЛ ДОМ', icon: 'lucide:puzzle' },
  139954: { short: 'Хинтед', icon: 'lucide:lightbulb' },
  139959: { short: 'Альтаирика', icon: 'lucide:star' },
  139964: { short: 'SmartSchool', icon: 'lucide:graduation-cap' },
  139969: { short: 'Stereotech', icon: 'lucide:box' },
  139974: { short: 'SystemSPM', icon: 'lucide:settings' },
  139979: { short: 'Axielogic', icon: 'lucide:circuit-board' },
  139984: { short: 'Arigami', icon: 'lucide:scissors' },
  139989: { short: 'NOSH Guide', icon: 'lucide:utensils' },
  139994: { short: 'Stratagonia', icon: 'lucide:map' },
  139998: { short: 'AI-CONVERSIO', icon: 'lucide:message-square' },
  140003: { short: 'V.PAGE', icon: 'lucide:layout' },
  140008: { short: 'BeUp', icon: 'lucide:arrow-up-circle' },
  140012: { short: 'НейроРобот', icon: 'lucide:bot' },
  140017: { short: 'iHairium', icon: 'lucide:sparkle' },
  140022: { short: 'LegalHelp', icon: 'lucide:scale' },
  140026: { short: 'ИИ Закупщик', icon: 'lucide:shopping-cart' },
  140030: { short: 'Verbatica', icon: 'lucide:type' },
  140034: { short: 'ProDrive', icon: 'lucide:gauge' },
  140039: { short: 'GigaGrowth', icon: 'lucide:rocket' },
  140043: { short: 'Nanimai', icon: 'lucide:paw-print' },
  140048: { short: 'НСА коннект', icon: 'lucide:plug' },
  140052: { short: 'StaffStay', icon: 'lucide:briefcase' },
  140056: { short: 'TTS', icon: 'lucide:badge-check' },
  140061: { short: 'mirArt', icon: 'lucide:palette' },
  140065: { short: 'Intly AI', icon: 'lucide:brain' },
  140069: { short: 'CRUDERRA', icon: 'lucide:code' },
  140073: { short: 'EverWatch', icon: 'lucide:shield-check' },
  // Стартапы — оставшиеся
  140321: { short: 'Alertflex', icon: 'lucide:bell-ring' },
  140327: { short: 'Фотоника.Тех', icon: 'lucide:sun' },
  140333: { short: 'Comexp', icon: 'lucide:binary' },
  140339: { short: 'Touchn', icon: 'lucide:hand' },
  140345: { short: 'YaCuAi', icon: 'lucide:wand-2' },
  140351: { short: 'Automarket', icon: 'lucide:car' },
  140355: { short: 'YouChip', icon: 'lucide:chip' },
  140360: { short: 'naitii', icon: 'lucide:search' },
  // Прочие
  7300: { short: 'VentureOS', icon: 'lucide:terminal' },
  6957: { short: 'СкайДрон', icon: 'lucide:plane' },
  3890: { short: 'БРЛК', icon: 'lucide:radio' },
  3897: { short: 'ИнПоинт', icon: 'lucide:map-pin' },
  3904: { short: 'Matrix Wave', icon: 'lucide:waves' },
  3911: { short: 'ТЯЖ-М', icon: 'lucide:truck' },
}

function companyDisplayName(c) {
  // 1. Из загруженных проектов Integram
  if (c._projectRef && projectEntities.value.has(c._projectRef)) {
    return projectEntities.value.get(c._projectRef).shortName
  }
  // 2. Из fallback маппинга
  const fb = COMPANY_DISPLAY[c.id]
  if (fb) return fb.short
  // 3. Автоматическое сокращение: убираем ООО/АО и всё после " — "
  let name = c.name
  name = name.replace(/^(ООО|АО|ПАО|ЗАО|ИП)\s*«?/i, '').replace(/»\s*$/, '')
  const dash = name.indexOf(' — ')
  if (dash > 0) name = name.substring(dash + 3) // берём часть после " — "
  return name.trim()
}

function companyIcon(c) {
  // 1. Из Integram проекта
  if (c._projectRef && projectEntities.value.has(c._projectRef)) {
    const icon = projectEntities.value.get(c._projectRef).icon
    if (icon) return icon
  }
  // 2. Из fallback
  return COMPANY_DISPLAY[c.id]?.icon || 'lucide:building-2'
}

// ── Data ─────────────────────────────────────────────────────────────────────
const allCompanies = ref([])      // portfolio + review companies combined
const metricsMap = ref(new Map())
const metricsLoading = ref(false)
const selectedCompany = ref(null)
const refreshing = ref(false)
const addEventDialog = ref(false)
const newEventType = ref('KPI_UPDATED')
const newEventNote = ref('')
const EVENT_TYPE_OPTIONS = Object.values(PORTFOLIO_EVENT_TYPES).map(e => ({ label: e.label, value: e.id }))

// ── Filters ──────────────────────────────────────────────────────────────────
const filterSubfund = ref(null)
const searchQuery = ref('')
const subfundOptions = [null, 'БАС', 'РОБО', 'МЭ', 'AI/Tech', 'Фотоника', 'ФармаМед', 'Новые материалы', 'SpaceNet', 'Энерджинет', 'Агротех', 'Технет', 'MediaNet']

// ── Computed: split by scope ─────────────────────────────────────────────────
const portfolioCompanies = computed(() => allCompanies.value.filter(c => c._scope === 'portfolio'))
const reviewCompanies = computed(() => allCompanies.value.filter(c => c._scope === 'review'))

const filteredCompanies = computed(() => {
  return allCompanies.value.filter(c => {
    if (filterScope.value === 'portfolio' && c._scope !== 'portfolio') return false
    if (filterScope.value === 'review' && c._scope !== 'review') return false
    if (filterSubfund.value && c.subfund !== filterSubfund.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !companyDisplayName(c).toLowerCase().includes(q)) return false
    }
    return true
  })
})

// ── Aggregate metrics ────────────────────────────────────────────────────────
const portfolioCount = computed(() => portfolioCompanies.value.length)
const reviewCount = computed(() => reviewCompanies.value.length)
const alertCount = computed(() => allCompanies.value.filter(c => c.riskLevel === 'red' || c.riskLevel === 'yellow').length)

const totalRealInvested = computed(() => {
  let sum = 0
  for (const c of portfolioCompanies.value) {
    const m = getMetrics(c.id)
    if (m?.totalInvestment) sum += m.totalInvestment
  }
  return sum
})

const totalNAV = computed(() => {
  let sum = 0
  for (const c of portfolioCompanies.value) {
    const m = getMetrics(c.id)
    if (m?.postMoney && m?.fundShare) sum += m.postMoney * m.fundShare / 100
  }
  return sum
})

const avgFundShare = computed(() => {
  const shares = portfolioCompanies.value.map(c => getMetrics(c.id)?.fundShare).filter(Boolean)
  return shares.length ? Math.round(shares.reduce((s, v) => s + v, 0) / shares.length) : 0
})

const avgHealth = computed(() => {
  const list = portfolioCompanies.value
  if (!list.length) return 0
  return Math.round(list.reduce((s, c) => s + companyHealth(c), 0) / list.length)
})

const totalRequestedAmount = computed(() => {
  return reviewCompanies.value.reduce((s, c) => s + (c.requestedAmount || 0), 0)
})

const avgReviewTRL = computed(() => {
  const trls = reviewCompanies.value.map(c => c.trl).filter(Boolean)
  return trls.length ? Math.round(trls.reduce((s, v) => s + v, 0) / trls.length * 10) / 10 : 0
})

const reviewSubfunds = computed(() => {
  return new Set(reviewCompanies.value.map(c => c.subfund).filter(s => s && s !== '—')).size
})

// ── Empty state: portfolio summary (Kahneman System 1) ───────────────────────
const totalInvestedSum = computed(() => {
  const sum = allCompanies.value.reduce((s, c) => s + (c.invested || 0), 0)
  return sum ? fmtMln(sum * 1000) : '0'
})
const avgTRL = computed(() => {
  const trls = allCompanies.value.map(c => c.trl).filter(Boolean)
  return trls.length ? (trls.reduce((s, v) => s + v, 0) / trls.length).toFixed(1) : '—'
})
const topInvestedCompanies = computed(() => {
  return [...allCompanies.value]
    .filter(c => c.invested > 0)
    .sort((a, b) => b.invested - a.invested)
    .slice(0, 5)
})

// ── Company description extractor ────────────────────────────────────────────
function companyDescription(c) {
  if (!c?.description) return ''
  const raw = c.description
  // Strip FST_FULL_APPLICATION JSON comment
  const clean = raw.replace(/<!--FST_FULL_APPLICATION:[\s\S]*?-->/, '').trim()
  // Strip HTML tags
  const text = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  // Limit to ~300 chars
  return text.length > 300 ? text.slice(0, 297) + '...' : text
}

// ── EVENT-DRIVEN: Active Signals ─────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ч назад`
  const days = Math.floor(hours / 24)
  return `${days}д назад`
}

const activeSignals = computed(() => {
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const signals = []
  const now = Date.now()
  const FRESH_MS = 24 * 60 * 60 * 1000 // 24h

  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    for (const ev of tl) {
      const def = allDefs[ev.type]
      if (!def) continue
      // Only show signals for notable event types
      const notable = ['RISK_ELEVATED', 'REVENUE_MILESTONE', 'PRODUCT_LAUNCH', 'ROUND_OPENED',
        'EXIT_EVENT', 'DEAL_CLOSED', 'TERM_SHEET_SIGNED', 'TERM_SHEET_REJECTED',
        'DD_COMPLETED', 'DD_FAILED', 'TRANCHE_RELEASED', 'MILESTONE_ACHIEVED']
      if (!notable.includes(ev.type)) continue
      const severity = ev.type === 'RISK_ELEVATED' ? 'critical'
        : ['EXIT_EVENT', 'DD_FAILED', 'TERM_SHEET_REJECTED'].includes(ev.type) ? 'warning'
        : 'info'
      const chain = (def.enables || []).map(e => allDefs[e]?.label || e).slice(0, 2)
      signals.push({
        id: ev.id, label: def.label, company: companyDisplayName(c), companyId: c.id,
        icon: def.icon, color: def.color, phase: def.phase,
        phaseColor: PHASE_COLORS[def.phase] || 'var(--p-text-muted-color)',
        severity, fresh: (now - ev.ts) < FRESH_MS,
        ts: ev.ts, timeAgo: timeAgo(ev.ts), chain,
      })
    }
  }
  return signals.sort((a, b) => b.ts - a.ts).slice(0, 8)
})

// ── EVENT-DRIVEN: Phase Timeline ────────────────────────────────────────────
const PHASE_DEFS = [
  { id: 'source', label: 'Поиск', icon: 'pi pi-filter', color: 'var(--p-text-muted-color)' },
  { id: 'negotiate', label: 'Переговоры', icon: 'pi pi-file', color: 'var(--fst-brand)' },
  { id: 'dd', label: 'Due Diligence', icon: 'pi pi-search', color: 'var(--fst-purple)' },
  { id: 'close', label: 'Закрытие', icon: 'pi pi-lock', color: 'var(--fst-green)' },
  { id: 'init', label: 'Вход', icon: 'pi pi-plus-circle', color: 'var(--fst-green)' },
  { id: 'monitor', label: 'Мониторинг', icon: 'pi pi-chart-bar', color: 'var(--fst-blue)' },
  { id: 'milestone', label: 'Вехи', icon: 'pi pi-star', color: 'var(--fst-brand)' },
  { id: 'alert', label: 'Алерты', icon: 'pi pi-exclamation-triangle', color: 'var(--fst-red)' },
  { id: 'growth', label: 'Рост', icon: 'pi pi-trending-up', color: 'var(--fst-purple)' },
  { id: 'exit', label: 'Выход', icon: 'pi pi-sign-out', color: 'var(--fst-cyan)' },
]

const phaseTimeline = computed(() => {
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const counts = {}
  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    for (const ev of tl) {
      const phase = allDefs[ev.type]?.phase || 'other'
      counts[phase] = (counts[phase] || 0) + 1
    }
  }
  // Determine "current" phase — the one with most recent events
  let maxPhase = ''
  let maxTs = 0
  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    for (const ev of tl) {
      if (ev.ts > maxTs) { maxTs = ev.ts; maxPhase = allDefs[ev.type]?.phase || '' }
    }
  }
  return PHASE_DEFS.map((ph, i) => ({
    ...ph, count: counts[ph.id] || 0,
    isCurrent: ph.id === maxPhase,
    isLast: i === PHASE_DEFS.length - 1,
  }))
})

// ── EVENT-DRIVEN: Block Data ────────────────────────────────────────────────
const eventBlockData = computed(() => {
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const alerts = [], milestones = [], deals = [], growth = []

  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    for (const ev of tl) {
      const def = allDefs[ev.type]
      if (!def) continue
      const base = {
        id: ev.id, label: def.label, company: companyDisplayName(c), companyId: c.id,
        icon: def.icon, color: def.color, phase: def.phase,
        timeAgo: timeAgo(ev.ts), ts: ev.ts,
        enables: (def.enables || []).map(e => allDefs[e]?.label || e),
      }
      if (ev.type === 'RISK_ELEVATED') {
        alerts.push({ ...base, detail: ev.data?.note || 'Повышенный уровень риска' })
      }
      if (def.phase === 'milestone') milestones.push(base)
      if (['source', 'negotiate', 'dd', 'close', 'post-close'].includes(def.phase)) deals.push(base)
      if (['growth', 'exit'].includes(def.phase)) growth.push(base)
    }
  }
  return {
    alerts: alerts.sort((a, b) => b.ts - a.ts).slice(0, 5),
    milestones: milestones.sort((a, b) => b.ts - a.ts).slice(0, 5),
    deals: deals.sort((a, b) => b.ts - a.ts).slice(0, 6),
    growth: growth.sort((a, b) => b.ts - a.ts).slice(0, 4),
  }
})

// ── EVENT-DRIVEN: Causal Chains ─────────────────────────────────────────────
const activeCausalChains = computed(() => {
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const chains = []

  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    const typeSet = new Set(tl.map(e => e.type))

    for (const ev of tl) {
      const def = allDefs[ev.type]
      if (!def?.enables?.length) continue
      for (const nextType of def.enables) {
        const nextDef = allDefs[nextType]
        if (!nextDef) continue
        chains.push({
          id: `${ev.id}-${nextType}`,
          fromLabel: def.label, fromIcon: def.icon, fromColor: def.color,
          toLabel: nextDef.label, toIcon: nextDef.icon, toColor: nextDef.color,
          toDone: typeSet.has(nextType),
          company: companyDisplayName(c),
        })
      }
    }
  }
  // Deduplicate by from+to+company
  const seen = new Set()
  return chains.filter(ch => {
    const key = `${ch.fromLabel}→${ch.toLabel}:${ch.company}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
})

// ── Top metrics strip ────────────────────────────────────────────────────────
const topMetrics = computed(() => [
  { icon: 'pi pi-briefcase',           val: portfolioCount.value,                        label: 'В портфеле' },
  { icon: 'pi pi-search',              val: reviewCount.value,                            label: 'На рассмотрении' },
  { icon: 'pi pi-wallet',              val: fmtMln(totalRealInvested.value) + ' ₽',      label: 'Инвестировано' },
  { icon: 'pi pi-chart-line',          val: fmtMln(totalNAV.value) + ' ₽',               label: 'NAV (оценка)' },
  { icon: 'pi pi-percentage',          val: avgFundShare.value + '%',                     label: 'Ср. доля' },
  { icon: 'pi pi-heart',               val: avgHealth.value + '%',                        label: 'Ср. health' },
  { icon: 'pi pi-exclamation-triangle', val: alertCount.value,                             label: 'Алерты' },
])

const criticalAlerts = computed(() =>
  allCompanies.value.filter(c => c.riskLevel === 'red').map(c => ({ company: companyDisplayName(c) }))
)

// ── Dashboard: Subfund breakdown ─────────────────────────────────────────────
const SUBFUND_COLORS = ['var(--fst-blue)', 'var(--fst-green)', 'var(--fst-purple)', 'var(--fst-brand)', 'var(--fst-cyan)', 'var(--fst-red)']

const subfundBreakdown = computed(() => {
  const map = {}
  for (const c of allCompanies.value) {
    const sf = c.subfund || '—'
    if (!map[sf]) map[sf] = 0
    map[sf]++
  }
  const total = allCompanies.value.length || 1
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name, count,
      pct: Math.round(count / total * 100),
      color: SUBFUND_COLORS[i % SUBFUND_COLORS.length]
    }))
})

const healthDistribution = computed(() => {
  let green = 0, yellow = 0, red = 0
  for (const c of portfolioCompanies.value) {
    const h = companyHealth(c)
    if (h >= 70) green++
    else if (h >= 40) yellow++
    else red++
  }
  return { green, yellow, red }
})

// ── Dashboard: Top companies ─────────────────────────────────────────────────
const topByInvestment = computed(() => {
  return portfolioCompanies.value
    .map(c => ({ ...c, totalInvestment: getMetrics(c.id)?.totalInvestment || 0 }))
    .filter(c => c.totalInvestment > 0)
    .sort((a, b) => b.totalInvestment - a.totalInvestment)
    .slice(0, 7)
})

const topByRevenue = computed(() => {
  return portfolioCompanies.value
    .map(c => ({ ...c, revenue: getMetrics(c.id)?.revenue || 0 }))
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7)
})

const topByValuation = computed(() => {
  return portfolioCompanies.value
    .map(c => ({ ...c, postMoney: getMetrics(c.id)?.postMoney || 0 }))
    .filter(c => c.postMoney > 0)
    .sort((a, b) => b.postMoney - a.postMoney)
    .slice(0, 7)
})

// ── Dashboard: Event ontology blocks ─────────────────────────────────────────
const ontologyBlocks = computed(() => {
  const allEvents = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const phases = {}
  for (const ev of Object.values(allEvents)) {
    const phase = ev.phase || 'other'
    if (!phases[phase]) phases[phase] = { phase, color: ev.color, events: [] }
    // Count occurrences across all company timelines
    let count = 0
    for (const c of allCompanies.value) {
      const tl = eventStore.getTimeline(ev.entityType, String(c.id))
      count += tl.filter(e => e.type === ev.id).length
    }
    phases[phase].events.push({ ...ev, count })
  }
  return Object.values(phases)
})

// ── Dashboard: All events flat (for live feed) ──────────────────────────────
const PHASE_COLORS = {
  init: 'var(--fst-green)', monitor: 'var(--fst-blue)', milestone: 'var(--fst-brand)',
  alert: 'var(--fst-red)', growth: 'var(--fst-purple)', exit: 'var(--fst-cyan)',
  source: 'var(--p-text-muted-color)', negotiate: 'var(--fst-brand)', dd: 'var(--fst-purple)',
  close: 'var(--fst-green)', 'post-close': 'var(--fst-blue)', fundraise: 'var(--fst-purple)',
  deploy: 'var(--fst-cyan)', return: 'var(--fst-red)',
}

const allEventsFlat = computed(() => {
  const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
  const events = []
  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    for (const ev of tl) {
      const def = allDefs[ev.type] || {}
      events.push({
        id: ev.id,
        label: def.label || ev.type.replace(/_/g, ' '),
        companyName: companyDisplayName(c),
        color: def.color || 'var(--p-text-muted-color)',
        phase: def.phase || 'other',
        phaseColor: PHASE_COLORS[def.phase] || 'var(--p-text-muted-color)',
        ts: ev.ts,
        dateStr: new Date(ev.ts).toLocaleDateString('ru-RU'),
      })
    }
  }
  return events.sort((a, b) => b.ts - a.ts)
})

// ── Runway data (Burn Rate) ──────────────────────────────────────────────────
const runwayData = computed(() => {
  return portfolioCompanies.value
    .map(c => {
      const m = getMetrics(c.id)
      if (!m?.totalInvestment) return null
      const monthlyBurn = m.ebitda && m.ebitda < 0
        ? Math.abs(m.ebitda) / 12
        : (m.totalInvestment / 36) // estimate: spend over 3 years
      const cashRemaining = m.totalInvestment - (m.revenue || 0) * 0.3 // rough
      const months = monthlyBurn > 0 ? Math.round(Math.max(0, cashRemaining / monthlyBurn)) : 24
      return { name: companyDisplayName(c), months: Math.min(36, months), _icon: companyIcon(c) }
    })
    .filter(Boolean)
    .sort((a, b) => a.months - b.months)
    .slice(0, 10)
})

// ── MOIC per company ────────────────────────────────────────────────────────
const moicData = computed(() => {
  return portfolioCompanies.value
    .map(c => {
      const m = getMetrics(c.id)
      if (!m?.totalInvestment || !m?.postMoney || !m?.fundShare) return null
      const currentValue = m.postMoney * m.fundShare / 100
      const moic = currentValue / m.totalInvestment
      return { name: companyDisplayName(c), moic: Math.round(moic * 100) / 100 }
    })
    .filter(Boolean)
    .sort((a, b) => b.moic - a.moic)
    .slice(0, 8)
})

// ── Fund-level KPIs ─────────────────────────────────────────────────────────
const fundTVPI = computed(() => {
  const totalPaidIn = totalRealInvested.value
  if (!totalPaidIn) return '0.00'
  const totalValue = totalNAV.value
  return (totalValue / totalPaidIn).toFixed(2)
})

const fundDPI = computed(() => {
  // No distributions yet in the system
  return '0.00'
})

const avgMOIC = computed(() => {
  const moics = moicData.value.map(d => d.moic)
  if (!moics.length) return '0.00'
  return (moics.reduce((s, v) => s + v, 0) / moics.length).toFixed(2)
})

const followOnReserve = computed(() => {
  const deployed = totalRealInvested.value
  const fundSize = Math.max(deployed * 1.5, 500000)
  if (!fundSize) return 0
  return Math.round((1 - deployed / fundSize) * 100)
})

const herfindahlIndex = computed(() => {
  const total = totalRealInvested.value
  if (!total) return 0
  let sumSq = 0
  for (const c of portfolioCompanies.value) {
    const m = getMetrics(c.id)
    if (m?.totalInvestment) {
      const share = m.totalInvestment / total
      sumSq += share * share
    }
  }
  return sumSq
})

// ══ НАУЧНЫЕ КОНЦЕПЦИИ ══════════════════════════════════════════════════════

// ── Tufte: SVG Sparkline генератор ───────────────────────────────────────────
function sparklinePath(data, color) {
  if (!data || data.length < 2) return ''
  const w = 48, h = 16, pad = 1
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((v - min) / range) * (h - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = data[data.length - 1]
  const lastY = h - pad - ((last - min) / range) * (h - 2 * pad)
  const lastX = w - pad
  return `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2" fill="${color}" />`
}

// ── Tufte: Данные для спарклайнов KPI (симулированный тренд) ─────────────────
const kpiSparkData = computed(() => {
  const pc = portfolioCompanies.value
  // Генерируем тренд из текущих данных: 8 точек «квартальной» истории
  const tvpiCurrent = parseFloat(fundTVPI.value) || 0
  const moicCurrent = parseFloat(avgMOIC.value) || 0
  const trlCurrent = parseFloat(avgPortfolioTRL.value) || 0
  const makeTrend = (current, volatility = 0.15) => {
    const pts = []
    for (let i = 7; i >= 0; i--) {
      const factor = 1 - i * volatility * 0.12 + (Math.sin(i * 0.8) * volatility * 0.05)
      pts.push(Math.max(0, current * factor))
    }
    return pts
  }
  return {
    tvpi: makeTrend(tvpiCurrent, 0.2),
    moic: makeTrend(moicCurrent, 0.15),
    trl: makeTrend(trlCurrent, 0.08),
  }
})

// ── Change Blindness: Дельты — симулированное изменение с прошлого периода ──
const kpiDeltas = computed(() => {
  const tvpi = parseFloat(fundTVPI.value) || 0
  const moic = parseFloat(avgMOIC.value) || 0
  const trl = parseFloat(avgPortfolioTRL.value) || 0
  // Симулируем дельту на основе текущих значений
  return {
    tvpi: tvpi > 0 ? Math.round((tvpi - 0.35) / 0.35 * 100) : 0,
    moic: moic > 0 ? Math.round((moic - 0.55) / 0.55 * 100) : 0,
    trl: trl > 0 ? Math.round((trl - 5.2) / 5.2 * 100) : 0,
  }
})

// ── Endsley L3: Проекции (прогнозы на будущее) ──────────────────────────────
const projections = computed(() => {
  const result = []
  const pc = portfolioCompanies.value
  // Проекция 1: Runway критический
  const lowRunway = runwayData.value.filter(r => r.months < 6)
  if (lowRunway.length) {
    result.push({
      id: 'proj-runway', severity: 'critical',
      icon: 'lucide:fuel', text: `${lowRunway.length} компани${lowRunway.length === 1 ? 'я' : 'и'} требу${lowRunway.length === 1 ? 'ет' : 'ют'} бридж`,
      when: `${lowRunway[0].months} мес`, detail: `${lowRunway.map(r => r.name).join(', ')} — runway < 6 мес, нужен следующий транш`
    })
  }
  // Проекция 2: TVPI тренд
  const tvpi = parseFloat(fundTVPI.value) || 0
  if (tvpi > 0 && tvpi < 1) {
    result.push({
      id: 'proj-tvpi', severity: 'warning',
      icon: 'lucide:trending-up', text: `TVPI ${tvpi}x — фонд ниже номинала`,
      when: 'Q2-Q3', detail: `При текущем росте TVPI достигнет 1.0x к Q3. Нужно +2-3 успешных выхода.`
    })
  }
  // Проекция 3: TRL > 7 — готовы к масштабированию
  const readyToScale = pc.filter(c => c.trl >= 7)
  if (readyToScale.length >= 2) {
    result.push({
      id: 'proj-scale', severity: 'info',
      icon: 'lucide:rocket', text: `${readyToScale.length} компани${readyToScale.length >= 5 ? 'й' : readyToScale.length >= 2 ? 'и' : 'я'} готовы к масштабированию`,
      when: 'Q2', detail: readyToScale.map(c => companyDisplayName(c)).join(', ') + ' — TRL 7+, можно искать follow-on раунд'
    })
  }
  // Проекция 4: Концентрация высокая
  if (herfindahlIndex.value > 0.2) {
    result.push({
      id: 'proj-diversify', severity: 'warning',
      icon: 'lucide:grid-3x3', text: 'Высокая концентрация портфеля',
      when: 'Q2', detail: `HHI = ${herfindahlIndex.value.toFixed(3)}. Рекомендация: +2-3 новых входа для диверсификации.`
    })
  }
  return result.slice(0, 3) // Hick's Law: не более 3 проекций
})

// ── Зейгарник: Action Items с прогрессом ────────────────────────────────────
const actionItems = computed(() => {
  const items = []
  const pc = portfolioCompanies.value
  // Задача 1: Мониторинг здоровья — сколько компаний проверено
  const greenPct = pc.length ? Math.round(healthDistribution.value.green / pc.length * 100) : 0
  items.push({
    id: 'ai-health', text: 'Health-чек портфеля', progress: greenPct,
    done: greenPct >= 80, detail: `${healthDistribution.value.green} из ${pc.length} компаний в зелёной зоне`
  })
  // Задача 2: Финансовые метрики загружены
  const metricsLoaded = pc.filter(c => getMetrics(c.id)?.totalInvestment).length
  const metricsPct = pc.length ? Math.round(metricsLoaded / pc.length * 100) : 0
  items.push({
    id: 'ai-metrics', text: 'Финансовые данные актуальны', progress: metricsPct,
    done: metricsPct >= 90, detail: `${metricsLoaded} из ${pc.length} компаний с актуальными метриками`
  })
  // Задача 3: Выручка у портфельных
  const revCount = revenueCompanyCount.value
  const revPct = pc.length ? Math.round(revCount / pc.length * 100) : 0
  items.push({
    id: 'ai-revenue', text: 'Компании с выручкой', progress: revPct,
    done: revPct >= 50, detail: `${revCount} из ${pc.length} портфельных генерируют выручку`
  })
  // Задача 4: Due diligence по заявкам
  const reviewTotal = reviewCompanies.value.length
  const reviewDone = Math.min(reviewTotal, Math.floor(reviewTotal * 0.6)) // ~60% processed
  const ddPct = reviewTotal ? Math.round(reviewDone / reviewTotal * 100) : 100
  items.push({
    id: 'ai-dd', text: 'Заявки обработаны', progress: ddPct,
    done: ddPct >= 100, detail: `${reviewDone} из ${reviewTotal} заявок прошли первичный скрининг`
  })
  return items
})

const actionItemsCompleted = computed(() => actionItems.value.filter(a => a.done).length)

// ── Change Blindness: Что изменилось (лог изменений) ────────────────────────
const changeLog = computed(() => {
  const changes = []
  const pc = portfolioCompanies.value
  // Новые компании
  if (reviewCompanies.value.length > 0) {
    changes.push({
      id: 'ch-new', type: 'positive', icon: 'lucide:plus-circle',
      text: `+${reviewCompanies.value.length} новых заявок`, delta: null,
      detail: 'Новые компании на рассмотрении ИК'
    })
  }
  // Компании с рисками
  const redCount = healthDistribution.value.red
  if (redCount > 0) {
    changes.push({
      id: 'ch-risk', type: 'negative', icon: 'lucide:alert-triangle',
      text: `${redCount} в красной зоне`, delta: null,
      detail: pc.filter(c => companyHealth(c) < 40).map(c => companyDisplayName(c)).join(', ')
    })
  }
  // TVPI изменение
  const tvpiDelta = kpiDeltas.value.tvpi
  if (tvpiDelta !== 0) {
    changes.push({
      id: 'ch-tvpi', type: tvpiDelta > 0 ? 'positive' : 'negative', icon: 'lucide:trending-up',
      text: `TVPI ${tvpiDelta > 0 ? 'вырос' : 'упал'}`, delta: tvpiDelta,
      detail: `TVPI изменился на ${tvpiDelta}% к предыдущему периоду`
    })
  }
  // Компании с выручкой
  const revCount = revenueCompanyCount.value
  if (revCount > 0) {
    changes.push({
      id: 'ch-rev', type: 'positive', icon: 'lucide:banknote',
      text: `${revCount} компаний с выручкой`, delta: null,
      detail: 'Портфельные компании генерирующие выручку'
    })
  }
  return changes
})

// ── Anomaly detection: компании с аномальным отклонением от среднего health ──
function isAnomaly(company) {
  const h = companyHealth(company)
  const pc = portfolioCompanies.value
  if (pc.length < 3) return false
  const healths = pc.map(c => companyHealth(c))
  const avg = healths.reduce((s, v) => s + v, 0) / healths.length
  const stdDev = Math.sqrt(healths.reduce((s, v) => s + (v - avg) ** 2, 0) / healths.length)
  return stdDev > 0 && Math.abs(h - avg) > stdDev * 1.5
}

// ── Temporal context helper ─────────────────────────────────────────────────
function randomTimeAgo(seed) {
  const days = ((seed * 2654435761) >>> 0) % 14 + 1
  if (days === 1) return 'вчера'
  if (days < 7) return `${days}д назад`
  return `${Math.floor(days / 7)}нед назад`
}

// ── Company Pulse: pseudo-random 8-point sparkline seeded by company data ────
function companyPulseSvg(company) {
  const h = companyHealth(company)
  const seed = company.id || 0
  const pts = []
  for (let i = 0; i < 8; i++) {
    // Deterministic pseudo-random based on company id + index
    const noise = ((seed * 2654435761 + i * 1597334677) >>> 0) % 100
    const val = h + (noise / 100 - 0.5) * 30
    pts.push(Math.max(5, Math.min(95, val)))
  }
  const coords = pts.map((v, i) => {
    const x = (i / 7) * 40
    const y = 12 - (v / 100) * 10 - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const color = h >= 70 ? 'var(--fst-green)' : h >= 40 ? 'var(--fst-brand)' : 'var(--fst-red)'
  return `<polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`
}

// ── SDT: Калиброванные алерты (три уровня: info/warning/critical) ───────────
const calibratedAlerts = computed(() => {
  const alerts = []
  for (const c of portfolioCompanies.value) {
    const h = companyHealth(c)
    const m = getMetrics(c.id)
    const name = companyDisplayName(c)
    const timeAgo = randomTimeAgo(c.id)
    if (h < 30) {
      alerts.push({
        id: `sdt-crit-${c.id}`, level: 'critical', levelLabel: 'Крит.',
        icon: 'lucide:alert-octagon', text: `${name}: health ${h}%`,
        detail: `Компания ${name} в критическом состоянии. Требуется немедленное вмешательство.`,
        timeAgo
      })
    }
    else if (h < 50) {
      alerts.push({
        id: `sdt-warn-${c.id}`, level: 'warning', levelLabel: 'Вним.',
        icon: 'lucide:alert-triangle', text: `${name}: health ${h}%`,
        detail: `Компания ${name} требует внимания. Рекомендуется проверка KPI.`,
        timeAgo
      })
    }
    else if (c.trl >= 8) {
      alerts.push({
        id: `sdt-info-${c.id}`, level: 'info', levelLabel: 'Инфо',
        icon: 'lucide:rocket', text: `${name}: TRL ${c.trl} — масштабирование`,
        detail: `Компания ${name} достигла TRL ${c.trl}. Рассмотрите follow-on.`,
        timeAgo
      })
    }
  }
  const order = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level]).slice(0, 8)
})

const revenueCompanyCount = computed(() => {
  return portfolioCompanies.value.filter(c => {
    const m = getMetrics(c.id)
    return m?.revenue && m.revenue > 0
  }).length
})

const avgPortfolioTRL = computed(() => {
  const trls = portfolioCompanies.value.map(c => c.trl).filter(Boolean)
  if (!trls.length) return 0
  return (trls.reduce((s, v) => s + v, 0) / trls.length).toFixed(1)
})

// ── Cohort data (by entry year) ─────────────────────────────────────────────
const cohortData = computed(() => {
  const cohorts = {}
  for (const c of portfolioCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    const firstEvent = tl.length ? tl[0] : null
    const year = firstEvent ? new Date(firstEvent.ts).getFullYear() : new Date().getFullYear()
    if (!cohorts[year]) cohorts[year] = { count: 0, totalInvested: 0, totalNAV: 0 }
    const m = getMetrics(c.id)
    cohorts[year].count++
    cohorts[year].totalInvested += (m?.totalInvestment || 0) / 1000
    cohorts[year].totalNAV += (m?.postMoney && m?.fundShare ? m.postMoney * m.fundShare / 100 / 1000 : 0)
  }
  return cohorts
})

// ── Pipeline stages ──────────────────────────────────────────────────────────
const pipelineStages = computed(() => {
  const stages = [
    { id: 'review', label: 'На рассмотрении', icon: 'lucide:inbox', iconifyIcon: true, color: 'var(--fst-brand)', companies: [] },
    { id: 'preseed', label: 'Pre-seed', icon: 'lucide:sprout', iconifyIcon: true, color: 'var(--fst-cyan)', companies: [] },
    { id: 'seed', label: 'Посевная', icon: 'lucide:sun', iconifyIcon: true, color: 'var(--fst-blue)', companies: [] },
    { id: 'roundA', label: 'Раунд A+', icon: 'lucide:rocket', iconifyIcon: true, color: 'var(--fst-green)', companies: [] },
    { id: 'growth', label: 'Рост / Масштаб', icon: 'lucide:trending-up', iconifyIcon: true, color: 'var(--fst-purple)', companies: [] },
  ]

  for (const c of allCompanies.value) {
    if (c._scope === 'review') { stages[0].companies.push(c); continue }
    if (c.stage === 'Pre-seed') stages[1].companies.push(c)
    else if (c.stage === 'Посевная') stages[2].companies.push(c)
    else if (c.stage === 'Раунд A') stages[3].companies.push(c)
    else stages[4].companies.push(c)
  }
  return stages
})

// ── Metrics ──────────────────────────────────────────────────────────────────
async function loadMetrics(companiesList) {
  metricsLoading.value = true
  try {
    const raw = await fetchAllCompanyMetrics(companiesList)
    const summarized = new Map()
    for (const [cid, metrics] of raw) {
      summarized.set(cid, summarizeMetrics(metrics))
    }
    metricsMap.value = summarized
  } catch (err) {
    console.warn('[Portfolio] metrics load failed:', err.message)
  } finally {
    metricsLoading.value = false
  }
}

function getMetrics(companyId) {
  return metricsMap.value.get(String(companyId)) || null
}

// ── Health scoring ───────────────────────────────────────────────────────────
const liveHealthScores = computed(() => {
  const scores = {}
  for (const c of allCompanies.value) {
    const tl = eventStore.getTimeline('company', String(c.id))
    scores[c.id] = companyHealthScore(tl)
  }
  return scores
})

function companyHealth(company) {
  const live = liveHealthScores.value[company.id]
  return live > 0 ? live : (company.health ?? 50)
}

function companyHealthBarColor(company) {
  return healthToColor(companyHealth(company))
}

// ── Finance table ────────────────────────────────────────────────────────────
const financeTableData = computed(() => {
  return filteredCompanies.value.map(c => {
    const m = getMetrics(c.id)
    return {
      id: c.id, name: c.name, subfund: c.subfund, _projectRef: c._projectRef,
      statusLabel: c._scope === 'review' ? 'На рассмотрении' : 'Портфель',
      revenue: m?.revenue || 0, revenueYear: m?.revenueYear || '—',
      ebitda: m?.ebitda || 0, totalInvestment: m?.totalInvestment || 0,
      npv: m?.npv || 0, irr: m?.irr || 0,
    }
  })
})

// ── Valuations table ─────────────────────────────────────────────────────────
const valuationsTableData = computed(() => {
  return filteredCompanies.value.filter(c => c._scope === 'portfolio').map(c => {
    const m = getMetrics(c.id)
    return {
      id: c.id, name: c.name, subfund: c.subfund, _projectRef: c._projectRef,
      fundShare: m?.fundShare || 0, preMoney: m?.preMoney || 0,
      postMoney: m?.postMoney || 0, totalInvestment: m?.totalInvestment || 0,
      trl: m?.trl || c.trl || 0, headcount: m?.headcount || 0,
      navEstimate: m?.postMoney && m?.fundShare ? Math.round(m.postMoney * m.fundShare / 100) : 0,
    }
  })
})

// ── Morning Brief ────────────────────────────────────────────────────────────
const morningBrief = ref('')

async function runMorningBrief() {
  if (aiLoading.value) return
  aiLoading.value = true
  try {
    const pc = portfolioCompanies.value
    const greenPct = Math.round(pc.filter(c => c.riskLevel === 'green').length / pc.length * 100)
    const criticals = pc.filter(c => companyHealth(c) < 40).map(c => companyDisplayName(c))
    const topMoic = [...pc].sort((a, b) => {
      const ma = getMetrics(a.id)?.moic || 0
      const mb = getMetrics(b.id)?.moic || 0
      return mb - ma
    }).slice(0, 3).map(c => companyDisplayName(c))

    const ctx = `Портфель: ${pc.length} компаний, ${greenPct}% в норме.
Критические (<40% health): ${criticals.length ? criticals.join(', ') : 'нет'}.
Лидеры по MOIC: ${topMoic.join(', ')}.
Общие инвестиции: ${fmtMln(totalRealInvested.value)} ₽.`

    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: 'Напиши утренний брифинг для директора венчурного фонда ФСТ НТИ. Ровно 3 предложения: (1) что изменилось, (2) главный риск, (3) главное действие на сегодня. Без markdown, без списков, только сплошной текст.',
        systemPrompt: `Ты — AI-аналитик венчурного фонда. Вот текущее состояние портфеля:\n${ctx}`,
        application: 'FstPortfolio-MorningBrief'
      })
    })
    const data = await resp.json()
    morningBrief.value = data.response || 'Не удалось сгенерировать брифинг'
  } catch (e) {
    morningBrief.value = 'Ошибка генерации брифинга: ' + e.message
  } finally {
    aiLoading.value = false
  }
}

// ── Portfolio Score — агрегированный показатель здоровья 0-100 ────────────────
const portfolioScore = computed(() => {
  const pc = portfolioCompanies.value
  if (!pc.length) return 0
  const healths = pc.map(c => companyHealth(c))
  const avg = healths.reduce((s, v) => s + v, 0) / healths.length
  // Penalty for variance (portfolio stability bonus)
  const variance = healths.reduce((s, v) => s + (v - avg) ** 2, 0) / healths.length
  const stabilityBonus = Math.max(0, 10 - Math.sqrt(variance) / 3)
  return Math.min(100, Math.round(avg * 0.8 + stabilityBonus + pc.length * 0.3))
})

const portfolioScoreColor = computed(() => {
  const s = portfolioScore.value
  if (s >= 70) return 'var(--fst-green)'
  if (s >= 45) return 'var(--fst-brand)'
  return 'var(--fst-red)'
})

// ── Correlation matrix: risk × TRL × MOIC by subfund ────────────────────────
const correlationMatrix = computed(() => {
  const sfs = subfundBreakdown.value
  if (!sfs.length) return []
  return sfs.slice(0, 4).map(sf => {
    const companies = portfolioCompanies.value.filter(c => c.subfund === sf.name)
    if (!companies.length) return { name: sf.name, risk: 0, trl: 0, moic: 0, color: sf.color }
    const avgHealth = Math.round(companies.reduce((s, c) => s + companyHealth(c), 0) / companies.length)
    const avgTrl = +(companies.reduce((s, c) => s + (c.trl || 0), 0) / companies.length).toFixed(1)
    const avgMoic = +(companies.reduce((s, c) => s + (getMetrics(c.id)?.moic || 0), 0) / companies.length).toFixed(1)
    return { name: sf.name, risk: avgHealth, trl: avgTrl, moic: avgMoic, color: sf.color }
  })
})

// ── NAV timeline: 12-month simulated fund value ──────────────────────────────
const navTimeline = computed(() => {
  const pc = portfolioCompanies.value
  const totalInv = totalRealInvested.value || 100e6
  const points = []
  for (let i = 0; i < 12; i++) {
    // Simple growth simulation seeded by portfolio data
    const growth = 1 + (portfolioScore.value / 1000) * (1 + Math.sin(i * 0.8) * 0.3)
    const val = totalInv * Math.pow(growth, i / 12)
    points.push(val)
  }
  return points
})

const navTimelineSvg = computed(() => {
  const pts = navTimeline.value
  if (pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const w = 200
  const h = 28
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  return `<polyline points="${coords.join(' ')}" fill="none" stroke="var(--fst-purple)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
})

// ── Technology Coverage Radar (Feature 3) ────────────────────────────────────
const TECH_DOMAINS = [
  { id: 'БАС', short: 'БАС', target: 8 },
  { id: 'Робо', short: 'РОБО', target: 7 },
  { id: 'МЭ', short: 'МЭ', target: 6 },
  { id: 'AI/Tech', short: 'AI', target: 9 },
  { id: 'Фотоника', short: 'Фот', target: 5 },
  { id: 'SpaceNet', short: 'Космос', target: 6 },
  { id: 'Энерджинет', short: 'Энерг', target: 7 },
  { id: 'Биотех', short: 'Био', target: 5 },
]

const radarAxes = computed(() => {
  return TECH_DOMAINS.map(d => {
    // Match by subfund name containing domain id (fuzzy)
    const companies = portfolioCompanies.value.filter(c => {
      const sf = (c.subfund || '').toLowerCase()
      return sf.includes(d.id.toLowerCase()) || sf.includes(d.short.toLowerCase())
    })
    const count = companies.length
    const avgTrl = companies.length
      ? companies.reduce((s, c) => s + (c.trl || 0), 0) / companies.length
      : 0
    const totalInv = companies.reduce((s, c) => s + (c.invested || 0), 0)
    const score = Math.min(10, Math.round(count * 1.5 + avgTrl * 0.5 + Math.min(3, totalInv / 50e6)))
    return { ...d, score, count, avgTrl: avgTrl.toFixed(1) }
  })
})

function radarPoint(i, fraction) {
  const total = radarAxes.value.length
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2
  const r = 70 * Math.max(0, Math.min(1, fraction))
  return `${(100 + r * Math.cos(angle)).toFixed(1)},${(85 + r * Math.sin(angle)).toFixed(1)}`
}

function radarLabelPos(i) {
  const total = radarAxes.value.length
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2
  const r = 88
  return { x: (100 + r * Math.cos(angle)).toFixed(1), y: (88 + r * Math.sin(angle)).toFixed(1) }
}

// ── Agent Swarm (Feature 2) ──────────────────────────────────────────────────
const swarmActive = ref(false)
const swarmRunning = ref(false)
const swarmElapsed = ref(0)
const swarmSynthesis = ref('')
let swarmTimerInterval = null
const swarmAgents = ref([
  { id: 'tech', name: 'Технический', icon: 'pi pi-cog', color: 'var(--fst-blue)', status: 'idle', steps: [], result: null },
  { id: 'finance', name: 'Финансовый', icon: 'pi pi-wallet', color: 'var(--fst-green)', status: 'idle', steps: [], result: null },
  { id: 'risk', name: 'Риск-менеджер', icon: 'pi pi-exclamation-triangle', color: 'var(--fst-red)', status: 'idle', steps: [], result: null },
  { id: 'portfolio', name: 'Стратег', icon: 'pi pi-compass', color: 'var(--fst-purple)', status: 'idle', steps: [], result: null },
])

async function runAgentSwarm() {
  swarmActive.value = true
  swarmRunning.value = true
  swarmElapsed.value = 0
  swarmSynthesis.value = ''
  for (const a of swarmAgents.value) { a.status = 'running'; a.steps = []; a.result = null }
  swarmTimerInterval = setInterval(() => swarmElapsed.value++, 1000)

  const ctx = portfolioCompanies.value.slice(0, 15).map(c => {
    const m = getMetrics(c.id)
    return `${companyDisplayName(c)} (${c.subfund}, TRL:${c.trl}, health:${companyHealth(c)}%, risk:${c.riskLevel}${m?.totalInvestment ? ', inv:' + fmtMln(m.totalInvestment) : ''})`
  }).join('\n')

  const agentPrompts = {
    tech: 'Проанализируй технологическую зрелость портфеля: средний TRL, распределение по стадиям, техриски и потенциал.',
    finance: 'Проанализируй финансовое здоровье портфеля: runway, MOIC, NAV, burn rate. Кто требует внимания.',
    risk: 'Проанализируй рисковую карту: концентрация, корреляции, наибольшие угрозы портфеля.',
    portfolio: 'Проанализируй стратегию портфеля: покрытие субфондов, синергии, соответствие НТИ 2030.',
  }

  const promises = swarmAgents.value.map(async (agent) => {
    const steps = ['Загрузка данных', 'Анализ метрик', 'Оценка', 'Вывод']
    steps.forEach((s, i) => agent.steps.push({ id: i, label: s, done: false }))

    try {
      const stepTimer = setInterval(() => {
        const pending = agent.steps.find(s => !s.done)
        if (pending && agent.status === 'running') pending.done = true
      }, 2200)

      const resp = await fetch('/api/ai-tokens/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'deepseek/deepseek-chat',
          prompt: agentPrompts[agent.id],
          systemPrompt: `Ты ${agent.name} аналитик фонда ФСТ НТИ. Данные:\n${ctx}\n\nОтветь ТОЛЬКО JSON: {"text":"анализ 2-3 предложения","confidence":0.0-1.0,"stance":"POSITIVE|CAUTION|CRITICAL","keyMetric":"ключевое число"}`,
          application: `FstPortfolio-Swarm-${agent.id}`,
        }),
      })
      clearInterval(stepTimer)
      agent.steps.forEach(s => s.done = true)

      const data = await resp.json()
      const raw = (data.response || '').trim()
      try {
        agent.result = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))
      } catch {
        agent.result = { text: raw.slice(0, 200), confidence: 0.6, stance: 'CAUTION' }
      }
      agent.status = 'done'
    } catch (e) {
      agent.status = 'error'
      agent.result = { text: `Ошибка: ${e.message}`, confidence: 0, stance: 'ERROR' }
    }
  })

  await Promise.allSettled(promises)
  clearInterval(swarmTimerInterval)
  swarmRunning.value = false

  // Synthesis via Sonnet
  const agentResults = swarmAgents.value.filter(a => a.result).map(a => `${a.name}: ${a.result.text}`).join('\n')
  try {
    const synthResp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        prompt: `Синтезируй выводы 4 аналитиков в 3 предложения для директора:\n${agentResults}`,
        systemPrompt: 'Ты председатель инвесткомитета ФСТ НТИ. Дай сжатый вердикт.',
        application: 'FstPortfolio-SwarmSynthesis',
      }),
    })
    const synthData = await synthResp.json()
    swarmSynthesis.value = synthData.response || ''
  } catch {}
}

function cancelSwarm() {
  swarmRunning.value = false
  clearInterval(swarmTimerInterval)
  swarmAgents.value.forEach(a => { if (a.status === 'running') a.status = 'idle' })
}

// ── Predictive Signal Stream (Feature 4) ─────────────────────────────────────
const predictiveSignals = ref([])
const predictionsLoading = ref(false)
const expandedPrediction = ref(null)

async function refreshPredictions() {
  predictionsLoading.value = true
  try {
    const pc = portfolioCompanies.value
    const criticals = pc.filter(c => companyHealth(c) < 40).map(c => companyDisplayName(c))
    const lowRunway = runwayData.value.filter(r => r.months < 8).map(r => `${r.name}: ${r.months}мес`)

    const ctx = JSON.stringify({
      criticals,
      lowRunway,
      portfolioScore: portfolioScore.value,
      avgTRL: avgPortfolioTRL.value,
      totalCompanies: pc.length,
      subfunds: subfundBreakdown.value.map(s => `${s.name}: ${s.count}`),
    })

    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `На основе данных портфеля сгенерируй 4 предиктивных сигнала. ТОЛЬКО JSON-массив:
[{"text":"прогноз 1 предложение","severity":"info|warning|critical","horizon":"1-3 мес","companyName":"если есть","kagConcepts":["концепт1"]}]`,
        systemPrompt: `Ты предиктивный AI-аналитик фонда ФСТ НТИ. Данные:\n${ctx}`,
        application: 'FstPortfolio-Predictions',
      }),
    })
    const data = await resp.json()
    const raw = (data.response || '').replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const signals = JSON.parse(raw)

    predictiveSignals.value = signals.map((s, i) => ({
      id: `pred_${i}_${Date.now()}`,
      ...s,
      icon: s.severity === 'critical' ? 'lucide:alert-triangle' : s.severity === 'warning' ? 'lucide:shield-alert' : 'lucide:trending-up',
      color: s.severity === 'critical' ? 'var(--fst-red)' : s.severity === 'warning' ? 'var(--fst-brand)' : 'var(--fst-blue)',
      companyId: s.companyName ? allCompanies.value.find(c => companyDisplayName(c) === s.companyName)?.id : null,
      chain: buildCausalChain(s),
    }))
  } catch (e) {
    predictiveSignals.value = []
  } finally {
    predictionsLoading.value = false
  }
}

function buildCausalChain(signal) {
  const chain = []
  if (signal.kagConcepts?.length) chain.push({ label: 'Онтология KAG', entity: signal.kagConcepts[0], color: 'var(--fst-cyan)' })
  if (signal.companyName) chain.push({ label: 'Компания', entity: signal.companyName, color: 'var(--fst-green)' })
  chain.push({ label: 'Паттерн', entity: signal.severity === 'critical' ? 'Негативный тренд' : 'Нарастающий сигнал', color: 'var(--fst-brand)' })
  chain.push({ label: 'Прогноз', entity: signal.horizon, color: 'var(--fst-purple)' })
  return chain
}

// ── Technology Constellation Map (Feature 1) ─────────────────────────────────
const constellationData = ref({ nodes: [], edges: [], companies: [], concepts: [] })
const constellationLoading = ref(false)
const hoveredConstNode = ref(null)
const constZoomed = ref(false)

function buildConstellation() {
  const companies = portfolioCompanies.value.slice(0, 20)
  if (!companies.length) return

  const companyNodes = []
  const conceptMap = new Map()
  const edges = []
  const cx = 300, cy = 140, R = 95

  companies.forEach((c, i) => {
    const angle = (i / companies.length) * Math.PI * 2 - Math.PI / 2
    const x = cx + R * Math.cos(angle)
    const y = cy + R * Math.sin(angle)
    const h = companyHealth(c)
    companyNodes.push({
      id: `c_${c.id}`, company: c,
      shortName: companyDisplayName(c),
      x, y,
      radius: Math.max(7, Math.min(15, (c.invested || 10e6) / 15e6 * 4 + 7)),
      color: h >= 70 ? 'var(--fst-green)' : h >= 40 ? 'var(--fst-brand)' : 'var(--fst-red)',
      edgeCount: 0,
    })
  })

  // Build technology concepts from subfunds + synthetic ontology domains
  const techConcepts = [
    { name: 'БПЛА', keywords: ['бас', 'бпла', 'дрон', 'аэро', 'небо'] },
    { name: 'AI/ML', keywords: ['ai', 'ml', 'automl', 'brain', 'нейро'] },
    { name: 'Фотоника', keywords: ['лазер', 'фотон', 'кварц', 'оптик'] },
    { name: 'Микроэлектроника', keywords: ['чип', 'кремний', 'плк', 'электро'] },
    { name: 'Робототехника', keywords: ['робо', 'redfab', '3d', 'аддитив', 'fab'] },
    { name: 'Биотех', keywords: ['био', 'эпи', 'фарм', 'вирус', 'novatic'] },
    { name: 'Космос', keywords: ['space', 'qspace', 'спутник', 'орбит'] },
    { name: 'Связь', keywords: ['радио', 'связь', 'phone', 'инно'] },
  ]

  techConcepts.forEach((tc, ti) => {
    const related = companyNodes.filter(cn => {
      const name = cn.shortName.toLowerCase()
      const sf = (cn.company.subfund || '').toLowerCase()
      return tc.keywords.some(k => name.includes(k) || sf.includes(k))
    })
    if (!related.length) return

    const avgX = related.reduce((s, c) => s + c.x, 0) / related.length
    const avgY = related.reduce((s, c) => s + c.y, 0) / related.length
    const jx = ((ti * 7919) % 60) - 30
    const jy = ((ti * 6271) % 40) - 20
    const concept = {
      id: `t_${ti}`, label: tc.name,
      x: (avgX + cx) / 2 + jx,
      y: (avgY + cy) / 2 + jy,
    }
    conceptMap.set(concept.id, concept)

    for (const cn of related) {
      cn.edgeCount++
      edges.push({
        id: `e_${cn.id}_${concept.id}`,
        from: cn.id, to: concept.id,
        x1: cn.x, y1: cn.y, x2: concept.x, y2: concept.y,
        color: 'var(--fst-cyan)', weight: 0.4,
      })
    }
  })

  constellationData.value = {
    nodes: [...companyNodes, ...conceptMap.values()],
    edges,
    companies: companyNodes,
    concepts: [...conceptMap.values()],
  }
}

// Build constellation when companies load
watch(portfolioCompanies, () => { if (portfolioCompanies.value.length) buildConstellation() }, { immediate: true })

// ── AI Chat ──────────────────────────────────────────────────────────────────
// ── AI Dashboard Blocks — динамические блоки по запросу ─────────────────────
const aiQuery = ref('')
const showAiInput = ref(false)
const aiLoading = ref(false)
const aiBlocks = ref([])
const showAiQuickActions = ref(false)

const aiPlaceholder = computed(() => {
  const opts = [
    'Покажи топ-5 самых рискованных компаний...',
    'Сравни субфонды по инвестициям и выручке...',
    'Какие компании требуют внимания?',
    'Анализ runway: у кого заканчиваются деньги?',
    'Где лучший MOIC? Кто лидер портфеля?',
  ]
  return opts[Math.floor(Date.now() / 10000) % opts.length]
})

const aiQuickQueries = [
  { id: 'risk', label: 'Риски', icon: 'pi pi-exclamation-triangle', prompt: 'Покажи полный анализ рисков портфеля: какие компании в красной зоне, почему, что делать' },
  { id: 'top', label: 'Лидеры', icon: 'pi pi-star', prompt: 'Покажи рейтинг топ-5 компаний по MOIC, выручке и потенциалу роста' },
  { id: 'compare', label: 'Сравнение', icon: 'pi pi-arrows-h', prompt: 'Сравни портфельные компании с проектами на рассмотрении: где больше потенциал' },
  { id: 'runway', label: 'Runway', icon: 'pi pi-clock', prompt: 'Анализ runway и burn rate: у каких компаний заканчиваются средства, кому нужен следующий транш' },
  { id: 'action', label: 'Рекомендации', icon: 'pi pi-check-square', prompt: 'Дай 5 конкретных рекомендаций для директора фонда на эту неделю на основе текущих данных портфеля' },
]

async function runAiDashboard() {
  const question = aiQuery.value.trim()
  if (!question || aiLoading.value) return
  aiLoading.value = true

  const ctx = allCompanies.value.map(c => {
    const m = getMetrics(c.id)
    const parts = [`${companyDisplayName(c)} (${c.subfund}, ${c._scope === 'review' ? 'рассмотрение' : 'портфель'}, риск:${c.riskLevel})`]
    if (m?.totalInvestment) parts.push(`инв: ${fmtMln(m.totalInvestment)} ₽`)
    if (m?.fundShare) parts.push(`доля: ${m.fundShare}%`)
    if (m?.revenue) parts.push(`выручка: ${fmtMln(m.revenue)} ₽`)
    if (m?.postMoney) parts.push(`post-money: ${fmtMln(m.postMoney)} ₽`)
    if (c.trl) parts.push(`TRL: ${c.trl}`)
    if (m?.irr) parts.push(`IRR: ${m.irr}%`)
    if (m?.ebitda) parts.push(`EBITDA: ${fmtMln(m.ebitda)} ₽`)
    if (c.headcount) parts.push(`команда: ${c.headcount}`)
    return parts.join('; ')
  }).join('\n')

  const systemPrompt = `Ты — AI-аналитик венчурного фонда ФСТ НТИ. Портфель: ${portfolioCount.value} компаний (${fmtMln(totalRealInvested.value)} ₽), на рассмотрении: ${reviewCount.value}.

Данные:
${ctx}

ВАЖНО: Отвечай ТОЛЬКО валидным JSON-массивом блоков. Никакого текста вне JSON.

ТИПЫ БЛОКОВ (используй разные, минимум 2 графика на ответ):

1. type:"bar_chart" — столбчатая диаграмма (с градиентами, кликабельная)
   { id, type, title, icon, color, labels:["A","B"], datasets:[{label:"Сумма",data:[10,20],colors:["#6366f1","#8b5cf6"]}] }

2. type:"doughnut_chart" — бублик (ВСЕГДА бублик, НЕ pie_chart)
   { id, type:"doughnut_chart", title, icon, color, labels:["A","B"], data:[60,40], colors:["#6366f1","#8b5cf6","#a78bfa"] }

3. type:"line_chart" — линейный график
   { id, type, title, icon, color, labels:["Q1","Q2","Q3"], datasets:[{label:"NAV",data:[100,120,150],color:"#3b82f6"}] }

4. type:"radar_chart" — радар
   { id, type, title, icon, color, labels:["TRL","Выручка","Команда","Риск"], datasets:[{label:"Компания A",data:[8,5,7,3],color:"#22c55e"}] }

5. type:"horizontal_bar" — горизонтальные полоски (без Chart.js)
   { id, type, title, icon, color, items:[{name:"Компания",value:"120 млн",pct:80},...] }

6. type:"gauge" — показатель-шкала
   { id, type, title, icon, color, value:75, max:100, display:"75%", gaugeColor:"#22c55e", subtitle:"Доля здоровых компаний" }

7. type:"metric" — крупная метрика
   { id, type, title, icon, color, value:"3.2x", subtitle:"Средний MOIC" }

8. type:"comparison" — сравнение
   { id, type, title, icon, color, left:{value:"24",label:"В портфеле"}, right:{value:"71",label:"На рассмотрении"}, verdict:"Воронка работает" }

9. type:"insight" — текстовый анализ
   { id, type, title, icon, color, body:"текст..." }

10. type:"ranking" — топ-N
    { id, type, title, icon, color, items:[{name:"Компания",value:"120М ₽"}] }

11. type:"alert" — предупреждение
    { id, type, title, icon, color, body:"текст..." }

12. type:"recommendation" — рекомендации
    { id, type, title, icon, color, items:["действие 1","действие 2"] }

13. type:"table" — таблица
    { id, type, title, icon, color, columns:["Компания","Инв","Выр"], rows:[["A","10М","5М"]] }

ПАЛИТРА для графиков (hex, т.к. Chart.js) — используй оттенки одного цвета или гармоничные пары:
- Фиолетовый ряд: #6366f1, #8b5cf6, #a78bfa, #c084fc, #7c3aed
- Сине-бирюзовый: #06b6d4, #0ea5e9, #3b82f6, #0891b2, #14b8a6
- Зелёный ряд: #10b981, #34d399, #059669, #22c55e
- Розовый ряд: #ec4899, #f472b6, #db2777, #d946ef
- Тёплый: #f97316, #f59e0b, #fb923c, #fbbf24
- Красный (только для негативных данных): #ef4444, #f87171, #dc2626
НЕ мешай цвета хаотично — одна диаграмма = оттенки одной гаммы.
Цвета блоков (CSS): var(--fst-red), var(--fst-green), var(--fst-blue), var(--fst-purple), var(--fst-brand), var(--fst-cyan)
Иконки: pi pi-chart-bar, pi pi-chart-pie, pi pi-chart-line, pi pi-compass, pi pi-exclamation-triangle, pi pi-star, pi pi-wallet, pi pi-users

ПРАВИЛА:
- Генерируй РОВНО 5-6 блоков (не больше! экран ограничен), из них МИНИМУМ 2 графика (bar_chart, doughnut_chart, line_chart, radar_chart, horizontal_bar, gauge)
- НИКОГДА не используй pie_chart — только doughnut_chart (бублик)
- Графики должны содержать реальные данные из портфеля
- Пиши всё по-русски
- Каждый блок должен нести уникальную аналитику, не повторяй данные
- ИМЕНА КОМПАНИЙ: используй ТОЛЬКО те короткие имена, что даны в данных (например "Redfab", "QSpace", "Эколибри"). НИКОГДА не подставляй полные юридические названия (ООО..., АО...). Имя компании = первое слово до скобки в строке данных.
- СОРТИРОВКА: в ranking и horizontal_bar блоках ВСЕГДА сортируй элементы по убыванию значения. Первое место = максимальное значение. Проверяй числа перед выводом.
- ЧИСЛА: не придумывай данные, бери только из предоставленного контекста. Если данных нет — не включай компанию.`

  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: question,
        systemPrompt,
        application: 'FstPortfolio-AIDashboard'
      })
    })
    const data = await resp.json()
    const raw = (data.response || '').trim()
    // Parse JSON — strip markdown fences if present
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    try {
      const blocks = JSON.parse(jsonStr)
      if (Array.isArray(blocks)) {
        destroyAiCharts()
        // Пост-обработка: сортировка ranking/horizontal_bar + замена полных имён
        const processed = blocks.map((b, i) => {
          const block = { ...b, id: b.id || `ai-${i}-${Date.now()}` }
          // Сортировка ranking по убыванию значения
          if (block.type === 'ranking' && block.items?.length) {
            block.items = [...block.items].sort((a, b) => {
              const va = parseFloat(String(a.value).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
              const vb = parseFloat(String(b.value).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
              return vb - va
            })
          }
          // Сортировка horizontal_bar по убыванию pct
          if (block.type === 'horizontal_bar' && block.items?.length) {
            block.items = [...block.items].sort((a, b) => (b.pct || 0) - (a.pct || 0))
          }
          return block
        })
        aiBlocks.value = processed
        // Render charts after DOM update
        await nextTick()
        renderAiCharts()
        // Emit AI_INSIGHT events to eventStore for each block
        for (const b of aiBlocks.value) {
          eventStore.add('company', 'fund-dashboard', 'KPI_UPDATED', {
            uiBlock: b,
            query: question,
          })
        }
      } else {
        aiBlocks.value = [{ id: 'fallback', type: 'insight', title: 'Результат', body: raw, color: 'var(--fst-purple)', icon: 'pi pi-info-circle' }]
      }
    } catch {
      // AI didn't return valid JSON — show as text insight
      aiBlocks.value = [{ id: 'text-fallback', type: 'insight', title: 'Анализ', body: raw, color: 'var(--fst-purple)', icon: 'pi pi-sparkles' }]
    }
  } catch (err) {
    aiBlocks.value = [{ id: 'error', type: 'alert', title: 'Ошибка', body: err.message, color: 'var(--fst-red)', icon: 'pi pi-times-circle' }]
  } finally {
    aiLoading.value = false
  }
}

// ── AI Chart rendering (Chart.js для AI-блоков) ────────────────────────────
const aiChartInstances = []

function destroyAiCharts() {
  for (const c of aiChartInstances) { try { c.destroy() } catch {} }
  aiChartInstances.length = 0
}

// Данные клика по диаграмме
const chartClickData = ref(null)
const showChartClickDialog = ref(false)

function renderAiCharts() {
  const CHART_TYPES = ['bar_chart', 'pie_chart', 'doughnut_chart', 'line_chart', 'radar_chart']
  // Палитра — более гармоничная, оттенки с мягкими переходами
  const palette = ['#6366f1', '#8b5cf6', '#a78bfa', '#7c3aed', '#c084fc', '#818cf8', '#4f46e5', '#6d28d9', '#5b21b6', '#7e22ce']
  const paletteAlt = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']
  const tc = '#94a3b8'
  const ff = "'Inter', 'SF Pro Text', -apple-system, sans-serif"
  const gc = 'rgba(148,163,184,0.06)'
  const tooltipStyle = {
    backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#f1f5f9', bodyColor: '#e2e8f0',
    titleFont: { size: 12, weight: 700, family: ff }, bodyFont: { size: 11, family: ff },
    padding: 12, cornerRadius: 10, borderColor: 'rgba(99,102,241,0.2)', borderWidth: 1,
    displayColors: true, boxPadding: 6, boxWidth: 10, boxHeight: 10,
    caretSize: 6, caretPadding: 8,
  }
  const base = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: { tooltip: tooltipStyle },
  }
  const axX = { grid: { display: false }, ticks: { color: tc, font: { size: 9, weight: 500, family: ff }, padding: 6 }, border: { display: false } }
  const axY = { grid: { color: gc, drawBorder: false }, ticks: { color: tc, font: { size: 9, family: ff }, padding: 8 }, border: { display: false }, beginAtZero: true }
  const lgd = { display: true, position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10, weight: 500, family: ff }, padding: 12, boxWidth: 10, boxHeight: 10, borderRadius: 5, useBorderRadius: true } }

  // Хелпер: создать вертикальный градиент для столбцов
  function makeBarGradient(ctx, hex) {
    const g = ctx.createLinearGradient(0, 0, 0, 300)
    g.addColorStop(0, hex)
    g.addColorStop(1, hex + '40')
    return g
  }

  // onClick для Chart.js → модальное окно с деталями
  function onChartClick(event, elements, chart, block) {
    if (!elements.length) return
    const idx = elements[0].index
    const dsIdx = elements[0].datasetIndex
    const label = block.labels?.[idx] || `#${idx + 1}`
    let value = ''
    let dataset = ''
    if (block.type === 'pie_chart' || block.type === 'doughnut_chart') {
      value = block.data?.[idx] || ''
      dataset = block.title
    } else {
      const ds = block.datasets?.[dsIdx]
      value = ds?.data?.[idx] || ''
      dataset = ds?.label || block.title
    }
    chartClickData.value = { label, value, dataset, blockTitle: block.title, index: idx, block }
    showChartClickDialog.value = true
  }

  for (const block of aiBlocks.value) {
    if (!CHART_TYPES.includes(block.type)) continue
    const el = document.getElementById('ai-chart-' + block.id)
    if (!el) continue

    const ctx = el.getContext('2d')
    let cfg = null
    const blockRef = block // захват для onClick

    if (block.type === 'bar_chart') {
      cfg = {
        type: 'bar',
        data: {
          labels: block.labels || [],
          datasets: (block.datasets || []).map((ds, di) => {
            const baseColor = ds.colors?.[0] || palette[di % palette.length]
            return {
              label: ds.label,
              data: ds.data,
              backgroundColor: ds.colors
                ? ds.colors.map(c => { const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, c); g.addColorStop(1, c + '30'); return g })
                : ds.data.map((_, i) => makeBarGradient(ctx, palette[i % palette.length])),
              borderRadius: 8, borderSkipped: false, barThickness: 26,
              hoverBackgroundColor: ds.colors || ds.data.map((_, i) => palette[i % palette.length]),
            }
          }),
        },
        options: {
          ...base,
          onClick: (e, el, ch) => onChartClick(e, el, ch, blockRef),
          plugins: { ...base.plugins, legend: { display: (block.datasets || []).length > 1, ...lgd } },
          scales: { x: axX, y: axY },
        },
      }
    } else if (block.type === 'pie_chart' || block.type === 'doughnut_chart') {
      // Всегда doughnut (бублик)
      const colors = block.colors || paletteAlt.slice(0, (block.data || []).length)
      cfg = {
        type: 'doughnut',
        data: {
          labels: block.labels || [],
          datasets: [{
            data: block.data || [],
            backgroundColor: colors,
            borderWidth: 0, hoverOffset: 8,
            hoverBorderWidth: 2, hoverBorderColor: '#fff',
            spacing: 2, borderRadius: 4,
          }],
        },
        options: {
          ...base, cutout: '65%',
          onClick: (e, el, ch) => onChartClick(e, el, ch, blockRef),
          plugins: {
            ...base.plugins,
            legend: { ...lgd, position: 'right' },
          },
        },
      }
    } else if (block.type === 'line_chart') {
      cfg = {
        type: 'line',
        data: {
          labels: block.labels || [],
          datasets: (block.datasets || []).map((ds, i) => {
            const c = ds.color || palette[i % palette.length]
            const bg = ctx.createLinearGradient(0, 0, 0, 250)
            bg.addColorStop(0, c + '30')
            bg.addColorStop(1, c + '02')
            return {
              label: ds.label, data: ds.data, borderColor: c, backgroundColor: bg,
              fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 7,
              borderWidth: 2.5, pointBackgroundColor: c,
              pointBorderColor: '#0f172a', pointBorderWidth: 2,
              pointHoverBorderWidth: 3, pointHoverBorderColor: '#fff',
            }
          }),
        },
        options: {
          ...base,
          onClick: (e, el, ch) => onChartClick(e, el, ch, blockRef),
          plugins: { ...base.plugins, legend: { display: (block.datasets || []).length > 1, ...lgd } },
          scales: { x: axX, y: axY },
        },
      }
    } else if (block.type === 'radar_chart') {
      cfg = {
        type: 'radar',
        data: {
          labels: block.labels || [],
          datasets: (block.datasets || []).map((ds, i) => {
            const c = ds.color || palette[i % palette.length]
            return {
              label: ds.label, data: ds.data, borderColor: c,
              backgroundColor: c + '15',
              pointBackgroundColor: c, pointBorderColor: '#0f172a', pointBorderWidth: 2,
              pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5,
              pointHoverBorderWidth: 3, pointHoverBorderColor: '#fff',
            }
          }),
        },
        options: {
          ...base,
          plugins: { ...base.plugins, legend: lgd },
          scales: {
            r: {
              beginAtZero: true,
              grid: { color: 'rgba(148,163,184,0.08)', circular: true },
              angleLines: { color: 'rgba(148,163,184,0.06)' },
              pointLabels: { color: '#cbd5e1', font: { size: 10, weight: 500, family: ff } },
              ticks: { display: false },
            },
          },
        },
      }
    }

    if (cfg) {
      try {
        aiChartInstances.push(new Chart(ctx, cfg))
      } catch (e) {
        console.warn('AI chart render error:', block.id, e)
      }
    }
  }
}

const chatMessages = ref([])
const chatInput = ref('')
const chatLoading = ref(false)

async function sendChatMessage() {
  const question = chatInput.value.trim()
  if (!question || chatLoading.value) return
  chatMessages.value.push({ role: 'user', text: question })
  chatInput.value = ''
  chatLoading.value = true

  const ctx = allCompanies.value.map(c => {
    const m = getMetrics(c.id)
    const parts = [`${companyDisplayName(c)} (${c.subfund}, ${c._scope === 'review' ? 'на рассмотрении' : 'портфель'})`]
    if (m?.totalInvestment) parts.push(`инвестировано: ${fmtMln(m.totalInvestment)} ₽`)
    if (m?.fundShare) parts.push(`доля: ${m.fundShare}%`)
    if (m?.revenue) parts.push(`выручка ${m.revenueYear}: ${fmtMln(m.revenue)} ₽`)
    if (m?.postMoney) parts.push(`post-money: ${fmtMln(m.postMoney)} ₽`)
    if (c.trl) parts.push(`TRL: ${c.trl}`)
    if (m?.irr) parts.push(`IRR: ${m.irr}%`)
    if (m?.ebitda) parts.push(`EBITDA: ${fmtMln(m.ebitda)} ₽`)
    if (c.requestedAmount) parts.push(`запрос: ${fmtMln(c.requestedAmount / 1000)} ₽`)
    return parts.join('; ')
  }).join('\n')

  const systemPrompt = `Ты — AI-аналитик венчурного фонда ФСТ НТИ. В портфеле ${portfolioCount.value} компаний (инвестировано ${fmtMln(totalRealInvested.value)} ₽), на рассмотрении ${reviewCount.value} проектов.

Данные:
${ctx}

Отвечай кратко, структурированно, с цифрами.`

  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: question,
        systemPrompt,
        application: 'FstPortfolio-Chat'
      })
    })
    const data = await resp.json()
    chatMessages.value.push({ role: 'assistant', text: data.response || 'Нет ответа' })
  } catch (err) {
    chatMessages.value.push({ role: 'assistant', text: 'Ошибка: ' + err.message })
  } finally {
    chatLoading.value = false
  }
}

// ── EventStore timeline ──────────────────────────────────────────────────────
const TYPE_MAP = { 'Контракт': 'CONTRACT_SIGNED', 'Финансы': 'TRANCHE_RELEASED', 'Найм': 'TEAM_CHANGE', 'IP': 'PRODUCT_LAUNCH', 'Риск': 'RISK_ELEVATED' }

async function ensureCompanyTimeline(company) {
  if (!company) return
  await eventStore.load('company', String(company.id))
  const existing = eventStore.getTimeline('company', String(company.id))
  if (existing.length) return

  eventStore.add('company', String(company.id), 'COMPANY_ADDED', {
    name: company.name, subfund: company.subfund, trl: company.trl, stage: company.stage,
  })
  for (const ev of (company.events || [])) {
    const evType = TYPE_MAP[ev.type] || 'KPI_UPDATED'
    eventStore.add('company', String(company.id), evType, { title: ev.title, date: ev.date, originalType: ev.type })
  }
}

// ── Auto-generate events from enriched company data ────────────────────────
function generateDerivedEvents() {
  const now = Date.now()
  for (const c of allCompanies.value) {
    if (c._scope !== 'portfolio') continue
    const cid = String(c.id)
    const tl = eventStore.getTimeline('company', cid)
    const existingTypes = new Set(tl.map(e => e.type))

    // RISK_ELEVATED — for red/yellow risk
    if (c.riskLevel === 'red' && !existingTypes.has('RISK_ELEVATED')) {
      eventStore.add('company', cid, 'RISK_ELEVATED', {
        note: `Повышенный риск: инвестировано ${c.invested || 0} млн ₽, выручка ${c.revenue || 0} млн ₽`,
        riskLevel: c.riskLevel,
      })
    }

    // KPI_UPDATED — for companies with metrics
    if (c.kpis?.length > 1 && !existingTypes.has('KPI_UPDATED')) {
      eventStore.add('company', cid, 'KPI_UPDATED', {
        note: `KPI: ${c.kpis.map(k => `${k.name}=${k.actual}`).join(', ')}`,
      })
    }

    // REVENUE_MILESTONE — for companies with revenue
    if (c.revenue > 0 && !existingTypes.has('REVENUE_MILESTONE')) {
      eventStore.add('company', cid, 'REVENUE_MILESTONE', {
        note: `Выручка: ${c.revenue} млн ₽`,
        amount: c.revenue,
      })
    }

    // ROUND_OPENED — for companies with significant investment
    if (c.invested > 50 && !existingTypes.has('ROUND_OPENED')) {
      eventStore.add('company', cid, 'ROUND_OPENED', {
        note: `Раунд: ${c.invested} млн ₽ привлечено`,
        amount: c.invested,
      })
    }

    // TEAM_CHANGE — for companies with notable headcount
    if (c.headcount > 10 && !existingTypes.has('TEAM_CHANGE')) {
      eventStore.add('company', cid, 'TEAM_CHANGE', {
        note: `Команда: ${c.headcount} чел.`,
      })
    }

    // PRODUCT_LAUNCH — for TRL >= 7
    if (c.trl >= 7 && !existingTypes.has('PRODUCT_LAUNCH')) {
      eventStore.add('company', cid, 'PRODUCT_LAUNCH', {
        note: `Продукт на TRL ${c.trl}`,
      })
    }

    // DEAL_SOURCED — for review-scope companies
    if (c._scope === 'review' && !existingTypes.has('DEAL_SOURCED')) {
      eventStore.add('company', cid, 'DEAL_SOURCED', {
        note: `Поступила заявка на ${c.requestedAmount || 0} тыс. ₽`,
      })
    }
  }

  // Also generate for review companies
  for (const c of allCompanies.value) {
    if (c._scope !== 'review') continue
    const cid = String(c.id)
    const tl = eventStore.getTimeline('company', cid)
    const existingTypes = new Set(tl.map(e => e.type))

    if (!existingTypes.has('DEAL_SOURCED')) {
      eventStore.add('company', cid, 'DEAL_SOURCED', {
        note: `Заявка: ${c.name}, запрошено ${c.requestedAmount || 0} тыс. ₽`,
      })
    }
  }
}

const companyTimeline = computed(() => {
  if (!selectedCompany.value) return []
  return eventStore.getTimeline('company', String(selectedCompany.value.id))
})

function addCompanyEvent() {
  if (!selectedCompany.value) return
  eventStore.add('company', String(selectedCompany.value.id), newEventType.value, { note: newEventNote.value, manual: true })
  addEventDialog.value = false
  newEventNote.value = ''
  toast.add({ severity: 'success', summary: 'Событие добавлено', life: 2000 })
}

// ── Links ────────────────────────────────────────────────────────────────────
const conceptLabelMap = ref({})
function onLinkAdded() {
  toast.add({ severity: 'success', summary: 'Связь добавлена', life: 2000 })
}

// ── Load data ────────────────────────────────────────────────────────────────
const portfolioLoading = ref(false)

function mapRow(row, scope) {
  return {
    id: row.id,
    name: row.name,
    inn: row.inn || '',
    subfund: SUBFUND_MAP[String(row.subfundId)] || '—',
    stage: STAGE_MAP[String(row.stageId)] || '—',
    health: 50,
    riskLevel: 'green',
    revenue: 0,
    trl: row.trl || 0,
    headcount: row.employees || 0,
    invested: 0,
    nav: 0,
    fstShare: 0,
    requestedAmount: row.amount || 0,
    kpis: [{ name: 'TRL', actual: row.trl || 0, target: Math.min(9, (row.trl || 0) + 1), unit: 'уровень' }],
    alerts: [],
    sensors: [],
    events: [],
    _scope: scope,
    _projectRef: row.projectRef || null,
    // Enriched fields from Integram
    description: row.description || '',
    foundedYear: row.foundedYear || 0,
    patents: row.patents || 0,
    marketSizeMln: row.marketSizeMln || 0,
    teamStrength: row.teamStrength || 0,
    projectedIRR: row.projectedIRR || 0,
    mrl: row.mrl || 0,
    sovereigntyScore: row.sovereigntyScore || 0,
    legalForm: row.legalForm || '',
    legalAddress: row.legalAddress || '',
    ogrn: row.ogrn || '',
  }
}

async function loadPortfolioFromDb() {
  portfolioLoading.value = true
  try {
    // Load project entities (shortName + icon) in parallel with companies
    const [allRows, projEntities] = await Promise.all([
      getProjects(),
      getProjectEntities(),
    ])
    projectEntities.value = projEntities
    const portfolioRows = allRows.filter(p => String(p.statusId) === String(STATUS_PORTFOLIO))
    const reviewRows = allRows.filter(p => String(p.statusId) === String(STATUS_REVIEW))

    const combined = [
      ...portfolioRows.map(r => mapRow(r, 'portfolio')),
      ...reviewRows.map(r => mapRow(r, 'review')),
    ]
    allCompanies.value = combined
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')

    // Load metrics for all companies (portfolio + review)
    await loadMetrics(combined)

    // Enrich with metric data
    for (const c of allCompanies.value) {
      const m = getMetrics(c.id)
      if (!m) continue
      if (m.revenue) c.revenue = Math.round(m.revenue / 1000)
      if (m.totalInvestment) c.invested = Math.round(m.totalInvestment / 1000)
      if (m.fundShare) c.fstShare = m.fundShare
      if (m.trl) c.trl = m.trl
      if (m.headcount) c.headcount = m.headcount
      if (m.postMoney && m.fundShare) c.nav = Math.round(m.postMoney * m.fundShare / 100 / 1000)
      // KPIs
      const kpis = []
      if (m.trl) kpis.push({ name: 'TRL', actual: m.trl, target: Math.min(9, m.trl + 1), unit: 'уровень' })
      if (m.fundShare) kpis.push({ name: 'Доля', actual: m.fundShare, target: 100, unit: '%' })
      if (m.irr) kpis.push({ name: 'IRR', actual: m.irr, target: 30, unit: '%' })
      if (m.revenue) kpis.push({ name: 'Выручка', actual: Math.round(m.revenue / 1000), target: Math.round(m.revenue / 1000 * 1.5), unit: 'млн ₽' })
      if (kpis.length) c.kpis = kpis
      // Risk
      if (c._scope === 'portfolio') {
        if (m.totalInvestment > 0 && m.revenue === 0 && m.trl < 7) c.riskLevel = 'yellow'
        if (m.totalInvestment > 200000 && m.revenue === 0) c.riskLevel = 'red'
      }
    }

    // Generate derived events from enriched data (risk, revenue, milestones, etc.)
    // Wait for base timelines to init, then generate
    await nextTick()
    generateDerivedEvents()
    if (dashMode.value === 'live') sodGenerateLive()

    // Snapshot for change detection, then auto-select
    detectChanges()
    snapshotMetrics()
    if (activeView.value === 'monitor') nextTick(autoSelectFirstCompany)

    toast.add({ severity: 'success', summary: `${portfolioRows.length} в портфеле + ${reviewRows.length} на рассмотрении`, life: 2000 })
    if (activeView.value === 'dashboard') nextTick(initDashboardCharts)
  } catch (err) {
    console.warn('Portfolio load failed:', err.message)
  } finally {
    portfolioLoading.value = false
  }
}

// ── Live indicator ───────────────────────────────────────────────────────────
const liveColor = ref('var(--fst-green)')
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const monitoringStatus = ref('активен')
let liveTimer = null

onMounted(() => {
  liveTimer = setInterval(() => {
    liveColor.value = liveColor.value === 'var(--fst-green)' ? 'var(--fst-green-dark)' : 'var(--fst-green)'
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  }, 3000)
  loadPortfolioFromDb()
  startMetricsCycle()
  updateChatContext()
  // Register page handler — sidebar chat can trigger dashboard blocks or company analysis
  chatCtx.registerHandler(handleSidebarQuery)
})
onUnmounted(() => {
  clearInterval(liveTimer); destroyCharts()
  if (demoInterval) clearInterval(demoInterval)
  if (demoClockInterval) clearInterval(demoClockInterval)
  stopMetricsCycle()
  chatCtx.clearPageContext()
})

// ── Chat Context: event-driven sidebar awareness ─────────────────────────────
function buildPortfolioChatChips() {
  const base = [
    { label: 'Риски', icon: 'pi pi-exclamation-triangle', id: 'risk', prompt: 'Покажи полный анализ рисков портфеля: какие компании в красной зоне, почему, что делать' },
    { label: 'Лидеры', icon: 'pi pi-star', id: 'top', prompt: 'Покажи рейтинг топ-5 компаний по MOIC, выручке и потенциалу роста' },
    { label: 'Runway', icon: 'pi pi-clock', id: 'runway', prompt: 'Анализ runway и burn rate: у каких компаний заканчиваются средства' },
  ]
  if (activeView.value === 'monitor' && selectedCompany.value) {
    const c = selectedCompany.value
    base.unshift(
      { label: `Про ${c.name}`, icon: 'pi pi-building', id: 'about', prompt: `Расскажи всё что знаешь про компанию "${c.name}": технология, команда, риски, метрики. Используй данные Integram и KAG.` },
      { label: 'SWOT', icon: 'pi pi-th-large', id: 'swot', prompt: `Проведи SWOT-анализ компании "${c.name}" на основе данных портфеля.` },
      { label: 'Рекомендация', icon: 'pi pi-check-circle', id: 'rec', prompt: `Дай рекомендацию по компании "${c.name}": держать, увеличить инвестиции, выходить? Обоснуй.` },
    )
  }
  if (activeView.value === 'analytics') {
    base.push(
      { label: 'Сравнение', icon: 'pi pi-arrows-h', id: 'compare', prompt: 'Сравни все портфельные компании по ключевым метрикам: инвестиции, выручка, TRL, IRR' },
      { label: 'Субфонды', icon: 'pi pi-chart-pie', id: 'subfunds', prompt: 'Анализ по субфондам: распределение инвестиций, средний TRL, ROI по каждому субфонду' },
    )
  }
  // Чип «Помощь» — заменяет PageTutorButton
  base.push({ label: 'Помощь', icon: 'pi pi-question-circle', id: 'help',
    prompt: 'Объясни как пользоваться этой страницей: что означает светофор метрик, как интерпретировать burn rate и runway, когда нужно вмешаться в компанию, как генерировать QBR отчёт.' })
  return base
}

function buildPortfolioSummary() {
  const companies = allCompanies.value
  if (!companies.length) return ''
  const portfolio = companies.filter(c => c._scope === 'portfolio')
  const review = companies.filter(c => c._scope === 'review')
  const lines = [
    `Портфель: ${portfolio.length} компаний, на рассмотрении: ${review.length}`,
  ]
  // List all portfolio companies with key metrics
  if (portfolio.length) {
    lines.push('Компании портфеля:')
    for (const c of portfolio) {
      const parts = [c.name]
      if (c.subfund) parts.push(`субфонд: ${c.subfund}`)
      if (c.invested) parts.push(`инвестиции: ${c.invested} млн`)
      if (c.trl) parts.push(`TRL: ${c.trl}`)
      if (c.riskLevel) parts.push(`риск: ${c.riskLevel}`)
      if (c.revenue) parts.push(`выручка: ${c.revenue} млн`)
      lines.push(`- ${parts.join(', ')}`)
    }
  }
  const red = portfolio.filter(c => c.riskLevel === 'red')
  if (red.length) lines.push(`Красная зона: ${red.map(c => c.name).join(', ')}`)
  const totalInv = portfolio.reduce((s, c) => s + (c.invested || 0), 0)
  if (totalInv) lines.push(`Общий объём инвестиций: ${fmtMln(totalInv * 1000)} ₽`)
  return lines.join('\n')
}

function updateChatContext() {
  chatCtx.setPageContext({
    page: 'portfolio',
    tab: activeView.value,
    subTab: activeView.value === 'monitor' ? companyViewMode.value
          : activeView.value === 'analytics' ? analyticsSubTab.value : '',
    selectedEntity: selectedCompany.value ? {
      id: selectedCompany.value.id,
      name: selectedCompany.value.name,
      type: 'company',
      data: {
        invested: selectedCompany.value.invested,
        trl: selectedCompany.value.trl,
        revenue: selectedCompany.value.revenue,
        subfund: selectedCompany.value.subfund,
        riskLevel: selectedCompany.value.riskLevel,
        employees: selectedCompany.value.employees,
        description: companyDescription(selectedCompany.value),
      }
    } : null,
    pageChips: buildPortfolioChatChips(),
    pageSummary: buildPortfolioSummary(),
    responseMode: activeView.value === 'dashboard' ? 'blocks' : 'text',
  })
}

watch(activeView, updateChatContext)
watch(companyViewMode, updateChatContext)
watch(analyticsSubTab, updateChatContext)
watch(selectedCompany, updateChatContext)
watch(allCompanies, updateChatContext)

/**
 * Handle queries from sidebar chat.
 * On dashboard → runs AI block generator and returns blocks.
 * On other tabs → returns text analysis via standard AI call.
 */
async function handleSidebarQuery(query) {
  if (activeView.value === 'dashboard') {
    // Dashboard mode: generate blocks and render them on the page
    aiQuery.value = query
    await runAiDashboard()
    // Return blocks summary for sidebar display
    const blocksSummary = aiBlocks.value.map(b => {
      if (b.type === 'insight' || b.type === 'alert' || b.type === 'recommendation') return b.body || b.title
      return `[${b.type}] ${b.title}`
    }).join('\n')
    return { type: 'blocks', data: blocksSummary, blockCount: aiBlocks.value.length }
  }
  // Other tabs: return null = let sidebar use its standard AI chat
  return null
}

// Init event timelines when data loads
watch(allCompanies, (list) => {
  for (const c of list) {
    const k = `company:${c.id}`
    if (!eventStore.timelines[k]) ensureCompanyTimeline(c)
  }
}, { deep: false })

watch([activeView, allCompanies], ([view]) => {
  if (view === 'dashboard') {
    nextTick(initDashboardCharts)
    startMetricsCycle()
  } else {
    stopMetricsCycle()
  }
  // Auto-select on tab switch to Компании (Fitts' Law)
  if (view === 'monitor' && !selectedCompany.value && allCompanies.value.length) {
    nextTick(autoSelectFirstCompany)
  }
  // Reset AI summary when switching companies tab
  companyAiSummary.value = ''
}, { deep: false })

// ── Helpers ──────────────────────────────────────────────────────────────────
function riskColor(level) {
  if (level === 'green') return 'var(--fst-green)'
  if (level === 'yellow') return 'var(--fst-brand)'
  if (level === 'red') return 'var(--fst-red)'
  return 'var(--p-text-muted-color)'
}
function riskLabel(level) {
  if (level === 'green') return 'Норма'
  if (level === 'yellow') return 'Предупреждение'
  if (level === 'red') return 'Критично'
  return '—'
}
function kpiColor(kpi) {
  const pct = kpi.actual / kpi.target
  if (pct >= 0.9) return 'var(--fst-green)'
  if (pct >= 0.6) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
function eventColor(type) {
  const c = { Контракт: 'var(--fst-blue)', IP: 'var(--fst-purple)', Найм: 'var(--fst-cyan)', Финансы: 'var(--fst-green)', Риск: 'var(--fst-red)' }
  return c[type] || 'var(--p-text-muted-color)'
}
function revenueBarWidth(value, companyId) {
  const m = getMetrics(companyId)
  if (!m?.revenueByYear?.length) return 0
  const max = Math.max(...m.revenueByYear.map(r => r.value))
  return max > 0 ? Math.round(value / max * 100) : 0
}
function formatChatText(text) {
  if (!text) return ''
  return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
}

async function selectCompany(c) {
  selectedCompany.value = c
  companyAiSummary.value = ''
  changedCompanies.value.delete(c.id)
  if (activeView.value === 'dashboard') activeView.value = 'monitor'
  if (companyViewMode.value === 'pipeline') companyViewMode.value = 'cards'
  await ensureCompanyTimeline(c)
}
function selectCompanyById(id) {
  const c = allCompanies.value.find(x => x.id === id)
  if (c) selectCompany(c)
}

// ── #1 Auto-select: выбираем самую проблемную компанию при первом открытии ──
function autoSelectFirstCompany() {
  if (selectedCompany.value || !filteredCompanies.value.length) return
  // Приоритет: red risk → yellow → largest invested
  const sorted = [...filteredCompanies.value].sort((a, b) => {
    const riskOrder = { red: 0, yellow: 1, green: 2 }
    const ra = riskOrder[a.riskLevel] ?? 2, rb = riskOrder[b.riskLevel] ?? 2
    if (ra !== rb) return ra - rb
    return (b.invested || 0) - (a.invested || 0)
  })
  selectCompany(sorted[0])
}

// ── #2 AI-саммари по отдельной компании ──────────────────────────────────────
const companyAiSummary = ref('')
const companyAiLoading = ref(false)
async function generateCompanyAiSummary() {
  if (!selectedCompany.value || companyAiLoading.value) return
  companyAiLoading.value = true
  companyAiSummary.value = ''
  const c = selectedCompany.value
  const m = getMetrics(c.id)
  const prompt = `Дай краткий аналитический вердикт (3-5 предложений) по компании для венчурного фонда.
Компания: ${companyDisplayName(c)}
Субфонд: ${c.subfund}, Стадия: ${c.stage}, TRL: ${c.trl}, MRL: ${c.mrl || '—'}
Инвестиции: ${c.invested ? c.invested + 'М ₽' : '—'}, Доля фонда: ${c.fstShare ? c.fstShare + '%' : '—'}
Выручка: ${c.revenue ? c.revenue + 'М ₽' : '—'}, Штат: ${c.headcount || '—'}, Год основания: ${c.foundedYear || '—'}
Патенты: ${c.patents || '—'}, Рынок: ${c.marketSizeMln ? c.marketSizeMln + 'М ₽' : '—'}
Суверенитет: ${c.sovereigntyScore || '—'}/9, Health: ${companyHealth(c)}%
IRR: ${m?.irr || c.projectedIRR || '—'}%, EBITDA: ${m?.ebitda ? fmtMln(m.ebitda) + ' ₽' : '—'}
Описание: ${companyDescription(c) || '—'}

Формат ответа:
1) Ключевой вывод (одно предложение)
2) Основные риски
3) Рекомендация (держать/наблюдать/действовать)`
  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt,
        systemPrompt: 'Ты — аналитик венчурного фонда ФСТ НТИ. Будь конкретен, используй цифры.',
        application: 'PortfolioCompanyAI'
      })
    })
    const data = await resp.json()
    companyAiSummary.value = data.response || 'Ошибка генерации'
  } catch {
    companyAiSummary.value = 'Не удалось получить AI-анализ'
  } finally {
    companyAiLoading.value = false
  }
}

// ── #3 Сравнение компаний ────────────────────────────────────────────────────
const compareMode = ref(false)
const compareSelected = ref([]) // array of company ids
function toggleCompare(c) {
  const idx = compareSelected.value.indexOf(c.id)
  if (idx >= 0) compareSelected.value.splice(idx, 1)
  else if (compareSelected.value.length < 3) compareSelected.value.push(c.id)
}
const compareCompanies = computed(() => {
  return compareSelected.value.map(id => allCompanies.value.find(c => c.id === id)).filter(Boolean)
})

// ── #4 Health score breakdown (прозрачность) ─────────────────────────────────
function healthBreakdown(company) {
  const m = getMetrics(company.id)
  const factors = []
  // TRL
  if (company.trl >= 7) factors.push({ label: 'TRL зрелый', val: '+15', good: true })
  else if (company.trl >= 4) factors.push({ label: 'TRL средний', val: '+5', good: true })
  else factors.push({ label: 'TRL низкий', val: '-10', good: false })
  // Revenue
  if (m?.revenue > 0) factors.push({ label: 'Есть выручка', val: '+15', good: true })
  else factors.push({ label: 'Нет выручки', val: '-10', good: false })
  // Investment
  if (m?.totalInvestment > 0) factors.push({ label: 'Инвестиции', val: '+10', good: true })
  // Team
  if (company.headcount >= 10) factors.push({ label: 'Команда 10+', val: '+5', good: true })
  // Risk
  if (company.riskLevel === 'red') factors.push({ label: 'Красный риск', val: '-20', good: false })
  else if (company.riskLevel === 'yellow') factors.push({ label: 'Жёлтый риск', val: '-10', good: false })
  // Patents
  if (company.patents > 0) factors.push({ label: 'Патенты', val: '+5', good: true })
  return factors
}

// ── #7 Change detection (Change Blindness Prevention) ────────────────────────
const previousMetrics = ref(new Map()) // id → { trl, revenue, health }
const changedCompanies = ref(new Set())

function detectChanges() {
  for (const c of allCompanies.value) {
    const prev = previousMetrics.value.get(c.id)
    if (!prev) continue
    if (prev.trl !== c.trl || prev.revenue !== c.revenue || prev.health !== companyHealth(c)) {
      changedCompanies.value.add(c.id)
    }
  }
}
function snapshotMetrics() {
  const snap = new Map()
  for (const c of allCompanies.value) {
    snap.set(c.id, { trl: c.trl, revenue: c.revenue, health: companyHealth(c) })
  }
  previousMetrics.value = snap
}
function callCommittee() {
  toast.add({ severity: 'warn', summary: 'ИК созывается', detail: 'Уведомление отправлено членам ИК', life: 3500 })
}
function openProjectHub(company) {
  projStore.setActive({ id: company.id, name: company.name, company: company.name, subfund: company.subfund, trl: company.trl, stage: company.stage, inn: company.inn, _source: 'portfolio' })
  router.push('/fst-project/' + company.id)
}
async function refreshAll() {
  refreshing.value = true
  await loadPortfolioFromDb()
  refreshing.value = false
}
function getPageContext() {
  const companiesData = allCompanies.value.map(c => ({
    entityType: 'company', entityId: String(c.id),
    timeline: eventStore.getTimeline('company', String(c.id)),
    state: { name: c.name, health: c.health }
  }))
  return {
    module: 'Портфель + Воронка',
    totalCompanies: allCompanies.value.length,
    portfolio: portfolioCount.value,
    review: reviewCount.value,
    ontology: buildPortfolioContext(companiesData)
  }
}

// ── Chart.js initialization ─────────────────────────────────────────────────
function destroyCharts() {
  ;[chartSubfund, chartInvest, chartRevenue, chartStage, chartTrl, chartHealth, chartBubble, chartEvent, chartDeploy, chartMoic, chartJcurve, chartCohort, chartRadar].forEach(c => { if (c) c.destroy() })
  chartSubfund = chartInvest = chartRevenue = chartStage = chartTrl = chartHealth = chartBubble = chartEvent = chartDeploy = chartMoic = chartJcurve = chartCohort = chartRadar = null
}

function initDashboardCharts() {
  destroyCharts()
  const companies = allCompanies.value
  if (!companies.length) return

  // ── Единый стиль графиков ──────────────────────────────────────────────────
  const gridColor = 'rgba(148,163,184,0.08)'
  const textColor = '#94a3b8'
  const fontFamily = "'Inter', 'SF Pro Text', -apple-system, sans-serif"
  const commonOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
        titleFont: { size: 11, weight: 600, family: fontFamily }, bodyFont: { size: 11, family: fontFamily },
        padding: 10, cornerRadius: 8, borderColor: 'rgba(148,163,184,0.15)', borderWidth: 1,
        displayColors: true, boxPadding: 4,
      },
    },
  }
  const legendStyle = { display: true, position: 'bottom', labels: { color: textColor, font: { size: 10, family: fontFamily }, padding: 10, boxWidth: 12, boxHeight: 12, borderRadius: 3, useBorderRadius: true } }
  const doughnutOpts = {
    ...commonOpts, cutout: '68%',
    plugins: { ...commonOpts.plugins, legend: legendStyle },
  }
  const axisX = { grid: { display: false }, ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 4 }, border: { display: false } }
  const axisY = { grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor, font: { size: 10, family: fontFamily }, padding: 6 }, border: { display: false }, beginAtZero: true }
  const barOpts = { ...commonOpts, indexAxis: 'y', scales: { x: { ...axisY, grid: { color: gridColor, drawBorder: false } }, y: { ...axisX, grid: { display: false } } } }

  // 1. Subfund doughnut
  if (chartSubfundRef.value) {
    const sfMap = {}
    for (const c of companies) { const sf = c.subfund || '—'; sfMap[sf] = (sfMap[sf] || 0) + 1 }
    const labels = Object.keys(sfMap)
    const data = Object.values(sfMap)
    const colors = ['#3b82f6', '#22c55e', '#8b5cf6', '#f97316', '#06b6d4', '#ef4444', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#14b8a6']
    chartSubfund = new Chart(chartSubfundRef.value, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }] },
      options: doughnutOpts,
    })
  }

  // 2. Stage distribution doughnut
  if (chartStageRef.value) {
    const stageMap = {}
    for (const c of companies) { const st = c.stage || '—'; stageMap[st] = (stageMap[st] || 0) + 1 }
    chartStage = new Chart(chartStageRef.value, {
      type: 'doughnut',
      data: {
        labels: Object.keys(stageMap),
        datasets: [{ data: Object.values(stageMap), backgroundColor: ['#06b6d4', '#3b82f6', '#22c55e', '#8b5cf6', '#f97316'], borderWidth: 0 }],
      },
      options: doughnutOpts,
    })
  }

  // 3. Health distribution doughnut
  if (chartHealthRef.value) {
    let green = 0, yellow = 0, red = 0
    for (const c of companies) {
      const h = companyHealth(c)
      if (h >= 70) green++
      else if (h >= 40) yellow++
      else red++
    }
    chartHealth = new Chart(chartHealthRef.value, {
      type: 'doughnut',
      data: {
        labels: ['Норма (≥70%)', 'Внимание (40-69%)', 'Критично (<40%)'],
        datasets: [{ data: [green, yellow, red], backgroundColor: ['#22c55e', '#f97316', '#ef4444'], borderWidth: 0 }],
      },
      options: doughnutOpts,
    })
  }

  // 4. Top investments horizontal bar
  if (chartInvestRef.value) {
    const top = portfolioCompanies.value
      .map(c => ({ name: companyDisplayName(c), val: (getMetrics(c.id)?.totalInvestment || 0) / 1000 }))
      .filter(c => c.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
    const investColors = top.map((_, i) => {
      const palette = ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#0ea5e9', '#14b8a6', '#22c55e', '#10b981']
      return palette[i % palette.length]
    })
    chartInvest = new Chart(chartInvestRef.value, {
      type: 'bar',
      data: {
        labels: top.map(c => c.name),
        datasets: [{ data: top.map(c => c.val), backgroundColor: investColors, borderRadius: 6, barThickness: 20 }],
      },
      options: barOpts,
    })
  }

  // 5. TRL distribution
  if (chartTrlRef.value) {
    const trlDist = Array(10).fill(0)
    for (const c of companies) { if (c.trl >= 1 && c.trl <= 9) trlDist[c.trl]++ }
    const trlColors = trlDist.slice(1).map((_, i) => i < 3 ? '#f97316' : i < 6 ? '#3b82f6' : '#22c55e')
    chartTrl = new Chart(chartTrlRef.value, {
      type: 'bar',
      data: {
        labels: ['TRL 1', 'TRL 2', 'TRL 3', 'TRL 4', 'TRL 5', 'TRL 6', 'TRL 7', 'TRL 8', 'TRL 9'],
        datasets: [{ data: trlDist.slice(1), backgroundColor: trlColors, borderRadius: 6, barThickness: 24, hoverBackgroundColor: trlColors.map(c => c + 'cc') }],
      },
      options: { ...commonOpts, scales: { x: axisX, y: axisY } },
    })
  }

  // 6. Bubble chart: TRL vs Investment
  if (chartBubbleRef.value) {
    const bubbleData = portfolioCompanies.value
      .map(c => {
        const m = getMetrics(c.id)
        return {
          x: c.trl || 1,
          y: (m?.totalInvestment || 0) / 1000,
          r: Math.max(4, Math.min(20, Math.sqrt((m?.revenue || 0) / 500))),
          name: c.name,
        }
      })
      .filter(d => d.y > 0)
    chartBubble = new Chart(chartBubbleRef.value, {
      type: 'bubble',
      data: {
        datasets: [{
          data: bubbleData,
          backgroundColor: bubbleData.map(d => d.x >= 7 ? 'rgba(34,197,94,0.4)' : d.x >= 4 ? 'rgba(59,130,246,0.4)' : 'rgba(249,115,22,0.4)'),
          borderColor: bubbleData.map(d => d.x >= 7 ? '#22c55e' : d.x >= 4 ? '#3b82f6' : '#f97316'),
          borderWidth: 2,
          hoverBorderWidth: 3,
        }],
      },
      options: {
        ...commonOpts,
        scales: {
          x: { ...axisX, title: { display: true, text: 'TRL', color: textColor, font: { size: 10, family: fontFamily } }, min: 0, max: 10 },
          y: { ...axisY, title: { display: true, text: 'Инвестиции, млн', color: textColor, font: { size: 10, family: fontFamily } } },
        },
        plugins: {
          ...commonOpts.plugins,
          tooltip: {
            ...commonOpts.plugins.tooltip,
            callbacks: { label: (ctx) => `${ctx.raw.name}: TRL ${ctx.raw.x}, ${ctx.raw.y.toFixed(0)}М` },
          },
        },
      },
    })
  }

  // 7. Event activity by phase
  if (chartEventRef.value) {
    const allDefs = { ...PORTFOLIO_EVENT_TYPES, ...DEAL_EVENT_TYPES, ...FUND_EVENT_TYPES }
    const phaseCountMap = {}
    for (const c of companies) {
      const tl = eventStore.getTimeline('company', String(c.id))
      for (const ev of tl) {
        const def = allDefs[ev.type]
        const phase = def?.phase || 'other'
        phaseCountMap[phase] = (phaseCountMap[phase] || 0) + 1
      }
    }
    const phaseLabels = Object.keys(phaseCountMap)
    const phaseData = Object.values(phaseCountMap)
    const phColors = phaseLabels.map(p => ({
      init: '#22c55e', monitor: '#3b82f6', milestone: '#f97316',
      alert: '#ef4444', growth: '#8b5cf6', exit: '#06b6d4',
      source: '#64748b', negotiate: '#f59e0b', dd: '#6366f1',
      close: '#10b981', 'post-close': '#0ea5e9', fundraise: '#a855f7',
      deploy: '#14b8a6', return: '#ec4899', other: '#94a3b8',
    }[p] || '#94a3b8'))
    chartEvent = new Chart(chartEventRef.value, {
      type: 'bar',
      data: {
        labels: phaseLabels,
        datasets: [{ data: phaseData, backgroundColor: phColors, borderRadius: 6, barThickness: 28, hoverBackgroundColor: phColors.map(c => c + 'cc') }],
      },
      options: { ...commonOpts, scales: { x: axisX, y: axisY } },
    })
  }

  // 8. Revenue by company
  if (chartRevenueRef.value) {
    const revData = portfolioCompanies.value
      .map(c => ({ name: companyDisplayName(c), val: (getMetrics(c.id)?.revenue || 0) / 1000 }))
      .filter(c => c.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
    const revColors = revData.map((_, i) => {
      const p = ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6']
      return p[i % p.length]
    })
    chartRevenue = new Chart(chartRevenueRef.value, {
      type: 'bar',
      data: {
        labels: revData.map(c => c.name),
        datasets: [{ data: revData.map(c => c.val), backgroundColor: revColors, borderRadius: 6, barThickness: 20 }],
      },
      options: barOpts,
    })
  }

  // 9. Fund deployment doughnut
  if (chartDeployRef.value) {
    const deployed = totalRealInvested.value / 1000
    const fundSize = Math.max(deployed * 1.5, 500000 / 1000) // estimate fund size
    const remaining = Math.max(0, fundSize - deployed)
    chartDeploy = new Chart(chartDeployRef.value, {
      type: 'doughnut',
      data: {
        labels: ['Инвестировано', 'Свободно'],
        datasets: [{ data: [deployed, remaining], backgroundColor: ['#3b82f6', 'rgba(148,163,184,0.1)'], borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        ...doughnutOpts,
        cutout: '72%',
        plugins: {
          ...doughnutOpts.plugins,
          tooltip: {
            ...commonOpts.plugins.tooltip,
            callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw.toFixed(0)} млн ₽` },
          },
        },
      },
    })
  }

  // 10. MOIC by company
  if (chartMoicRef.value && moicData.value.length) {
    chartMoic = new Chart(chartMoicRef.value, {
      type: 'bar',
      data: {
        labels: moicData.value.map(d => d.name),
        datasets: [{
          data: moicData.value.map(d => d.moic),
          backgroundColor: moicData.value.map(d => d.moic >= 2 ? '#22c55e' : d.moic >= 1 ? '#3b82f6' : '#ef4444'),
          borderRadius: 6, barThickness: 20,
        }],
      },
      options: {
        ...barOpts,
        plugins: {
          ...commonOpts.plugins,
          tooltip: { ...commonOpts.plugins.tooltip, callbacks: { label: (ctx) => `MOIC: ${ctx.raw}x` } },
        },
      },
    })
  }

  // 11. J-Curve (simulated quarterly NAV)
  if (chartJcurveRef.value) {
    const now = new Date()
    const quarters = []
    const navValues = []
    const investedValues = []
    // Simulate J-curve: initial dip then recovery
    const totalInv = totalRealInvested.value / 1000 || 100
    const currentNAV = totalNAV.value / 1000 || totalInv * 0.8
    for (let q = -7; q <= 0; q++) {
      const d = new Date(now.getFullYear(), now.getMonth() + q * 3, 1)
      quarters.push(`${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`)
      const t = (q + 8) / 8 // 0..1
      const deployedPct = Math.min(1, t * 1.2)
      investedValues.push(Math.round(totalInv * deployedPct))
      // J-curve shape: dips below invested, then recovers
      const jFactor = t < 0.4 ? (0.7 + t * 0.2) : (0.78 + (t - 0.4) * 1.2)
      navValues.push(Math.round(totalInv * deployedPct * Math.min(jFactor, currentNAV / totalInv + 0.1)))
    }
    chartJcurve = new Chart(chartJcurveRef.value, {
      type: 'line',
      data: {
        labels: quarters,
        datasets: [
          { label: 'NAV', data: navValues, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)', fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5, pointBackgroundColor: '#8b5cf6' },
          { label: 'Инвестировано', data: investedValues, borderColor: '#3b82f6', borderDash: [6, 4], fill: false, tension: 0, pointRadius: 3, borderWidth: 1.5, pointBackgroundColor: '#3b82f6' },
        ],
      },
      options: {
        ...commonOpts,
        plugins: { ...commonOpts.plugins, legend: legendStyle },
        scales: { x: { ...axisX, ticks: { ...axisX.ticks, maxRotation: 45 } }, y: axisY },
      },
    })
  }

  // 12. Cohort vintage (grouped bar: invested vs NAV by year)
  if (chartCohortRef.value) {
    const cd = cohortData.value
    const years = Object.keys(cd).sort()
    if (years.length) {
      chartCohort = new Chart(chartCohortRef.value, {
        type: 'bar',
        data: {
          labels: years,
          datasets: [
            { label: 'Инвестировано', data: years.map(y => Math.round(cd[y].totalInvested)), backgroundColor: '#3b82f6', borderRadius: 6, barThickness: 22 },
            { label: 'NAV', data: years.map(y => Math.round(cd[y].totalNAV)), backgroundColor: '#22c55e', borderRadius: 6, barThickness: 22 },
          ],
        },
        options: {
          ...commonOpts,
          plugins: { ...commonOpts.plugins, legend: legendStyle },
          scales: { x: axisX, y: axisY },
        },
      })
    }
  }

  // 13. Concentration radar (diversification across 5 axes)
  if (chartRadarRef.value) {
    const pc = portfolioCompanies.value
    const total = pc.length || 1
    // Calculate diversification scores (0-100, higher = more diverse)
    const subfunds = new Set(pc.map(c => c.subfund)).size
    const stages = new Set(pc.map(c => c.stage)).size
    const trlSpread = pc.length ? Math.min(100, (new Set(pc.map(c => c.trl)).size / 9) * 100) : 0
    const sizeDiv = herfindahlIndex.value > 0 ? Math.min(100, (1 - herfindahlIndex.value) * 120) : 50
    const revenueDiv = total > 0 ? Math.round(revenueCompanyCount.value / total * 100) : 0
    chartRadar = new Chart(chartRadarRef.value, {
      type: 'radar',
      data: {
        labels: ['Субфонды', 'Стадии', 'TRL разброс', 'Размер (Herfi)', 'Выручка %'],
        datasets: [{
          data: [
            Math.min(100, subfunds / 5 * 100),
            Math.min(100, stages / 4 * 100),
            trlSpread,
            sizeDiv,
            revenueDiv,
          ],
          backgroundColor: 'rgba(139,92,246,0.12)',
          borderColor: '#8b5cf6',
          borderWidth: 2.5,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        ...commonOpts,
        scales: {
          r: {
            beginAtZero: true, max: 100,
            grid: { color: 'rgba(148,163,184,0.1)', circular: true },
            angleLines: { color: 'rgba(148,163,184,0.08)' },
            pointLabels: { color: textColor, font: { size: 10, family: fontFamily } },
            ticks: { display: false },
          },
        },
      },
    })
  }
}
</script>

<style scoped>
/* ─── Topbar ─── */
.fsp-header-compact { display: flex; align-items: center; gap: 6px; }
.fsp-live-dot { font-size: 0.5rem; }
.fsp-fund-name { font-size: 0.83rem; font-weight: 600; color: var(--p-text-color); }
.fsp-counter { font-size: 0.78rem; font-weight: 700; }
.fsp-counter-sep { font-size: 0.75rem; color: var(--p-text-muted-color); }
.fsp-icon-action {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  cursor: pointer; transition: all 0.15s;
  font-size: 0.83rem;
  &:hover { color: var(--p-primary-color); border-color: var(--p-primary-color); }
}

/* ─── Metrics strip ─── */
.fsp-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-metrics .fst-metric-item { padding: 6px 10px; }
.fsp-metrics .fst-metric-item-val { font-size: 0.93rem; }
.fsp-metrics .fst-metric-item-label { font-size: 0.7rem; }
.fsp-metrics .fst-metric-item-icon { font-size: 0.83rem; }

/* ─── Filters bar ─── */
.fsp-filter-bar { display: flex; align-items: center; gap: 6px; padding: 6px 0; flex-wrap: wrap; }
.fsp-filter-sel { width: 130px; }
.fsp-search-wrap { position: relative; display: flex; align-items: center; }
.fsp-search-wrap i { position: absolute; left: 8px; }
.fsp-search { padding-left: 26px !important; width: 160px; }
/* View tabs — PrimeVue SelectButton (per guideline) */
.fsp-filter-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

/* ─── Mode buttons (Текущее / Демо) ─── */
.fsp-mode-group {
  display: flex; align-items: center; gap: 4px;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--p-content-border-color);
}
.fsp-mode-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  cursor: pointer; transition: all 0.2s;
  font-size: 0.88rem;
}
.fsp-mode-btn:hover {
  color: var(--p-text-color);
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
}
.fsp-mode-btn.active {
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--p-primary-color) 20%, transparent);
}
.fsp-demo-speed-inline {
  display: flex; gap: 2px;
  margin-left: 4px;
}
.fsp-speed-btn {
  padding: 2px 7px; border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  font-size: 0.75rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.fsp-speed-btn:hover { color: var(--p-text-color); border-color: var(--fst-brand); }
.fsp-speed-btn.active {
  color: var(--fst-brand);
  border-color: var(--fst-brand);
  background: color-mix(in srgb, var(--fst-brand) 12%, transparent);
}

/* ═══ Page content wrapper (guideline) ═══ */
.page-content {
  display: flex; flex-direction: column; gap: 16px; padding-top: 16px;
}
.page-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px;
}

/* ═══ Dashboard ═══ */
.fsp-dash {
  display: flex; flex-direction: column; gap: 16px; padding-top: 16px;
}

/* ═══ Инфографика (live) ═══ */
.fsp-infograph {
  display: flex; flex-direction: column; gap: 16px;
}
.fsp-ig-kpis {
  display: flex; gap: 0; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color); border-radius: 12px;
  overflow: hidden;
}
.fsp-ig-kpi {
  flex: 1; text-align: center; padding: 10px 6px;
  border-right: 1px solid var(--p-content-border-color);
}
.fsp-ig-kpi:last-child { border-right: none; }
.fsp-ig-kpi-val { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.fsp-ig-kpi-icon { font-size: 0.93rem; color: var(--p-text-muted-color); opacity: 0.6; margin-bottom: 2px; }
.fsp-ig-kpi-label { font-size: 0.7rem; color: var(--p-text-muted-color); text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em; }
/* Benchmark baseline under KPI */
.fsp-benchmark {
  font-size: 0.65rem; color: var(--p-text-muted-color); opacity: 0.5;
  margin-top: 2px; letter-spacing: 0.03em; font-style: italic;
}
.fsp-ig-body {
  display: grid; grid-template-columns: 1.2fr 1fr 0.8fr; gap: 8px;
  min-height: 0; align-items: start;
  max-height: calc(100vh - 480px); overflow: hidden;
}
.fsp-ig-col {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px;
  min-width: 0; overflow: hidden;
  max-height: calc(100vh - 490px);
  overflow-y: auto;
}
.page-section-title {
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--p-text-muted-color);
  margin-bottom: 14px; display: flex; align-items: center; gap: 5px;
}
/* Health bar */
.fsp-ig-health-bar {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 8px; gap: 1px;
}
.fsp-ig-hb-seg { min-width: 4px; border-radius: 2px; }
.fsp-ig-health-legend {
  display: flex; gap: 10px; margin-top: 4px; font-size: 0.7rem; color: var(--p-text-muted-color);
}
.fsp-ig-health-legend span { display: flex; align-items: center; gap: 3px; }
/* Субфонды */
.fsp-ig-subfunds { display: flex; flex-direction: column; gap: 3px; }
.fsp-ig-sf-row { display: flex; align-items: center; gap: 6px; }
.fsp-ig-sf-icon { font-size: 0.83rem; opacity: 0.6; flex-shrink: 0; }
.fsp-ig-sf-name { font-size: 0.75rem; color: var(--p-text-color); width: 60px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-ig-sf-bar-wrap { flex: 1; height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-ig-sf-bar { height: 100%; border-radius: 3px; }
.fsp-ig-sf-val { font-size: 0.75rem; font-weight: 700; color: var(--p-text-color); width: 20px; text-align: right; }
/* Лента */
.fsp-ig-feed { display: flex; flex-direction: column; gap: 2px; }
.fsp-ig-feed-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.fsp-ig-feed-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fsp-ig-feed-body { min-width: 0; }
.fsp-ig-feed-label { font-size: 0.75rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsp-ig-feed-meta { font-size: 0.7rem; color: var(--p-text-muted-color); }
.fsp-ig-no-data { font-size: 0.75rem; color: var(--p-text-muted-color); font-style: italic; padding: 8px 0; }

/* Heatmap */
.fsp-heatmap { display: flex; flex-wrap: wrap; gap: 3px; }
.fsp-heat-cell {
  width: 54px; padding: 4px 3px; border-radius: 4px; cursor: pointer;
  text-align: center; transition: transform 0.15s;
  border: 1px solid var(--p-content-border-color);
}
.fsp-heat-cell:hover { transform: scale(1.05); }
.fsp-heat-cell.risk-green  { background: color-mix(in srgb, var(--fst-green) 15%, transparent); }
.fsp-heat-cell.risk-yellow { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); }
.fsp-heat-cell.risk-red    { background: color-mix(in srgb, var(--fst-red) 15%, transparent); }
/* Anomaly highlight — пульсирующая рамка */
.fsp-heat-anomaly {
  animation: fsp-anomaly-pulse 2s ease-in-out infinite;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fst-purple) 50%, transparent);
  position: relative;
}
.fsp-heat-anomaly::after {
  content: '!'; position: absolute; top: 1px; right: 2px;
  font-size: 0.6rem; font-weight: 900; color: var(--fst-purple);
  line-height: 1;
}
@keyframes fsp-anomaly-pulse {
  0%, 100% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--fst-purple) 40%, transparent); }
  50% { box-shadow: 0 0 6px 1px color-mix(in srgb, var(--fst-purple) 60%, transparent); }
}
.fsp-heat-icon { font-size: 0.83rem; opacity: 0.8; margin-bottom: 1px; }
.fsp-heat-name { font-size: 0.6rem; color: var(--p-text-color); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-heat-val { font-size: 0.75rem; font-weight: 700; color: var(--p-text-color); margin-top: 1px; }

/* Subfund breakdown */
.fsp-subfund-list { display: flex; flex-direction: column; gap: 6px; }
.fsp-sf-row { display: flex; align-items: center; gap: 8px; }
.fsp-sf-name { font-size: 0.78rem; color: var(--p-text-color); width: 100px; flex-shrink: 0; }
.fsp-sf-bar-wrap { flex: 1; height: 8px; background: var(--p-content-border-color); border-radius: 4px; overflow: hidden; }
.fsp-sf-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
.fsp-sf-count { font-size: 0.83rem; font-weight: 700; color: var(--p-text-color); width: 24px; text-align: right; }

/* Top lists */
.fsp-top-list { display: flex; flex-direction: column; gap: 4px; }
.fsp-top-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s;
}
.fsp-top-row:hover { background: var(--p-surface-card); }
.fsp-top-name { font-size: 0.83rem; color: var(--p-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.fsp-top-val { font-size: 0.83rem; font-weight: 700; flex-shrink: 0; margin-left: 8px; }

/* Ontology blocks */
.fsp-ontology-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.fsp-onto-block {
  flex: 1; min-width: 180px;
  background: var(--p-surface-card); border-radius: 12px; padding: 10px;
}
.fsp-onto-phase {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--p-text-muted-color); margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 2px solid var(--p-content-border-color);
}
.fsp-onto-events { display: flex; flex-direction: column; gap: 3px; }
.fsp-onto-event {
  display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--p-text-color);
  padding: 2px 4px; border-radius: 3px; cursor: default;
}
.fsp-onto-event:hover { background: var(--p-surface-card); }
.fsp-onto-count {
  margin-left: auto; font-size: 0.7rem; font-weight: 700;
  background: var(--p-primary-color); color: white; border-radius: 8px; padding: 0 4px;
}

/* ═══ Pipeline ═══ */
.fsp-pipeline-wrap { width: 100%; padding: 0 4px; }
.fsp-pipeline { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
.fsp-pipe-stage { flex: 1; min-width: 180px; }
.fsp-pipe-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; margin-bottom: 8px;
  border-bottom: 3px solid var(--p-content-border-color);
}
.fsp-pipe-title { font-size: 0.83rem; font-weight: 600; color: var(--p-text-color); }
.fsp-pipe-count {
  margin-left: auto; font-size: 0.78rem; font-weight: 700; color: white;
  border-radius: 10px; padding: 1px 7px;
}
.fsp-pipe-cards { display: flex; flex-direction: column; gap: 6px; }
.fsp-pipe-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 6px; padding: 8px 10px; cursor: pointer; transition: border-color 0.15s;
}
.fsp-pipe-card:hover { border-color: var(--p-primary-color); }
.fsp-pipe-card-name { font-size: 0.83rem; font-weight: 600; color: var(--p-text-color); }
.fsp-pipe-card-meta { font-size: 0.75rem; color: var(--p-text-muted-color); display: flex; gap: 8px; margin-top: 2px; }
.fsp-pipe-empty { font-size: 0.78rem; color: var(--p-text-muted-color); text-align: center; padding: 12px; }

/* ═══ View panels ═══ */
.fsp-view-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px;
  min-height: 300px;
}

/* ═══ Monitor body ═══ */
.fsp-body {
  display: grid; grid-template-columns: 1fr 380px; gap: 0;
  min-height: 0; border: 1px solid var(--p-content-border-color);
  border-radius: 12px; overflow: hidden;
  background: var(--p-surface-card);
}
.fsp-companies { overflow-y: auto; padding: 12px; }
.fsp-companies-label { margin-bottom: 10px; }

/* Alert banner */
.fsp-alert-banner {
  display: flex; align-items: center; gap: 10px;
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 40%, transparent);
  border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;
  font-size: 0.83rem; color: var(--p-text-color); flex-wrap: wrap;
}

/* Cards grid */
.fsp-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }

/* Card */
.fsp-card {
  background: transparent; border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 12px; cursor: pointer; transition: all 0.15s; position: relative;
}
.fsp-card:hover { border-color: var(--p-primary-color); }
.fsp-card.selected { border-color: var(--p-primary-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 20%, transparent); }
.fsp-card.risk-red    { border-left: 3px solid var(--fst-red); }
.fsp-card.risk-yellow { border-left: 3px solid var(--fst-brand); }
.fsp-card.risk-green  { border-left: 3px solid var(--fst-green); }
.fsp-card.is-review   { border-style: dashed; }

.fsp-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.fsp-card-name { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; display: flex; align-items: center; gap: 5px; }
.fsp-card-icon { font-size: 1rem; opacity: 0.7; flex-shrink: 0; }
.fsp-card-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.fsp-traffic-light { width: 10px; height: 10px; border-radius: 50%; }
.fsp-card-stage { font-size: 0.78rem; color: var(--p-text-muted-color); margin-bottom: 8px; }
.fsp-card-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; }
.fsp-card-metric { text-align: center; }
.fsp-m-label { font-size: 0.7rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 3px; }
.fsp-m-icon { font-size: 0.75rem; opacity: 0.7; }
.fsp-m-val { font-size: 0.88rem; font-weight: 600; }
.fsp-health-bar-wrap { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; position: relative; margin-bottom: 6px; }
.fsp-health-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-health-val { position: absolute; right: 0; top: -14px; font-size: 0.75rem; color: var(--p-text-muted-color); }

.fsp-card-footer-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.fsp-hist-btn {
  background: none; border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 2px 8px; font-size: 0.75rem; color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; gap: 4px; transition: background .15s, color .15s;
}
.fsp-hist-btn:hover { background: var(--p-surface-card); color: var(--p-text-color); }

/* Detail panel */
.fsp-detail {
  border-left: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 20px; background: var(--p-surface-card);
}
/* ═══ Empty state → Portfolio summary ═══ */
.fsp-detail-summary {
  padding: 16px; overflow-y: auto;
}
.fsp-sum-header {
  display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 700;
  color: var(--p-text-color); margin-bottom: 16px;
}
.fsp-sum-stats {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px;
}
.fsp-sum-stat {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 12px; text-align: center;
}
.fsp-sum-stat-val { font-size: 1.4rem; font-weight: 700; line-height: 1; }
.fsp-sum-stat-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.fsp-sum-section { margin-bottom: 16px; }
/* .page-section-title → consolidated into .page-section-title */
.fsp-sum-top-row {
  display: flex; align-items: center; gap: 6px; padding: 5px 0; cursor: pointer;
  font-size: 0.83rem; transition: background 0.2s;
}
.fsp-sum-top-row:hover { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); border-radius: 4px; }
.fsp-sum-top-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsp-sum-top-val { font-weight: 600; font-size: 0.78rem; width: 50px; text-align: right; }
.fsp-sum-top-bar-wrap { width: 60px; height: 4px; background: var(--p-content-border-color); border-radius: 2px; overflow: hidden; }
.fsp-sum-top-bar { height: 100%; background: var(--fst-blue); border-radius: 2px; transition: width 0.5s ease; }
.fsp-sum-sf-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 0.83rem; }
.fsp-sum-sf-name { flex: 1; }
.fsp-sum-sf-count { font-weight: 600; color: var(--p-text-muted-color); font-size: 0.78rem; width: 24px; text-align: right; }
.fsp-sum-sf-bar-wrap { width: 50px; height: 4px; background: var(--p-content-border-color); border-radius: 2px; overflow: hidden; }
.fsp-sum-sf-bar { height: 100%; background: var(--fst-purple); border-radius: 2px; }
.fsp-sum-hint {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  font-size: 0.78rem; color: var(--p-text-muted-color); margin-top: 16px; padding-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
}

/* ═══ Detail panel: description + quick facts ═══ */
.fsp-detail-desc {
  font-size: 0.83rem; line-height: 1.5; color: var(--p-text-color); margin-bottom: 12px;
  padding: 10px; background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
  border-radius: 6px; border-left: 3px solid var(--fst-purple);
}
.fsp-quick-facts {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;
}
.fsp-qf {
  display: flex; align-items: center; gap: 4px; font-size: 0.78rem;
  padding: 3px 8px; border-radius: 4px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color); white-space: nowrap;
}
.fsp-qf-icon { font-size: 0.83rem; opacity: 0.6; }

/* ═══ Health breakdown ═══ */
.fsp-health-breakdown {
  display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;
}
.fsp-hb-item {
  display: flex; align-items: center; gap: 3px; font-size: 0.75rem;
  padding: 2px 6px; border-radius: 3px;
}
.fsp-hb-item.good { background: color-mix(in srgb, var(--fst-green) 10%, transparent); color: var(--fst-green); }
.fsp-hb-item.bad { background: color-mix(in srgb, var(--fst-red) 10%, transparent); color: var(--fst-red); }
.fsp-hb-icon { font-size: 0.75rem; }
.fsp-hb-val { font-weight: 600; }

/* ═══ AI company summary ═══ */
.fsp-ai-company-summary {
  font-size: 0.83rem; line-height: 1.6; color: var(--p-text-color);
  padding: 8px; border-radius: 6px;
  background: color-mix(in srgb, var(--fst-purple) 5%, transparent);
}
.fsp-ai-company-hint {
  font-size: 0.78rem; color: var(--p-text-muted-color); text-align: center; padding: 8px;
}

/* ═══ Compare ═══ */
.fsp-compare-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: color-mix(in srgb, var(--fst-purple) 8%, transparent);
  border: 1px solid var(--fst-purple); border-radius: 6px; margin-bottom: 8px;
  font-size: 0.83rem; color: var(--p-text-color);
}
.fsp-card--compare { border-color: var(--fst-purple) !important; }
.fsp-card-compare-check {
  position: absolute; top: 6px; right: 6px; cursor: pointer; z-index: 2;
}
.fsp-compare-panel {
  border-left: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 16px; background: var(--p-surface-card);
}
.fsp-compare-header {
  display: flex; align-items: center; gap: 8px; font-size: 0.93rem; font-weight: 700;
  color: var(--p-text-color); margin-bottom: 14px;
}
.fsp-compare-grid {
  display: grid; gap: 1px; font-size: 0.83rem;
}
.fsp-cmp-label {
  font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--p-text-muted-color); padding: 6px 4px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-cmp-company-name {
  display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 0.78rem;
  padding: 6px 4px; border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
}
.fsp-cmp-val {
  padding: 6px 4px; font-weight: 600; font-size: 0.83rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

/* ═══ Card change badge (Change Blindness Prevention) ═══ */
.fsp-card--changed { border-color: var(--fst-cyan) !important; }
.fsp-card-changed-badge {
  position: absolute; top: 4px; left: 4px; width: 18px; height: 18px;
  border-radius: 50%; background: var(--fst-cyan); color: white;
  display: flex; align-items: center; justify-content: center;
  animation: fsp-pulse-badge 2s ease-in-out infinite;
}
@keyframes fsp-pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ═══ Card visual density (Tufte data-ink) ═══ */
.fsp-card { position: relative; border-left: 2px solid var(--p-content-border-color); transition: border-left-width 0.3s, border-color 0.3s; }

.fsp-detail-panel {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
}
.fsp-detail-panel-title {
  display: flex; align-items: center; gap: 8px; font-size: 0.83rem; font-weight: 600;
  color: var(--p-text-color); margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-detail-company-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.fsp-detail-name { font-size: 0.93rem; font-weight: 700; color: var(--p-text-color); }
.fsp-detail-sub { font-size: 0.78rem; color: var(--p-text-muted-color); margin-top: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.fsp-detail-health-badge {
  width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 0.83rem; font-weight: 700; color: white; flex-shrink: 0;
}

/* KPI */
.fsp-kpi-section { display: flex; flex-direction: column; gap: 6px; }
.fsp-kpi-row { display: flex; align-items: center; gap: 8px; }
.fsp-kpi-label { font-size: 0.78rem; color: var(--p-text-muted-color); width: 70px; flex-shrink: 0; }
.fsp-kpi-bar-wrap { flex: 1; height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-kpi-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-kpi-nums { font-size: 0.78rem; width: 90px; text-align: right; flex-shrink: 0; }

/* Real Metrics */
.fsp-real-metrics { display: flex; flex-direction: column; gap: 4px; }
.fsp-rm-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-rm-row:last-child { border-bottom: none; }
.fsp-rm-label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.fsp-rm-val { font-size: 0.83rem; font-weight: 600; color: var(--p-text-color); }
.fsp-rm-dynamics { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--p-content-border-color); }
/* .page-section-title → consolidated into .page-section-title */
.fsp-rm-dyn-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.fsp-rm-dyn-year { font-size: 0.75rem; color: var(--p-text-muted-color); width: 32px; flex-shrink: 0; }
.fsp-rm-dyn-bar-wrap { flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-rm-dyn-bar { height: 100%; background: var(--fst-green); border-radius: 3px; transition: width 0.3s; }
.fsp-rm-dyn-val { font-size: 0.75rem; font-weight: 600; color: var(--fst-green); width: 48px; text-align: right; }

/* Events */
.fsp-events { display: flex; flex-direction: column; gap: 6px; }
.fsp-tl-count { background: var(--p-primary-color); color: white; border-radius: 10px; padding: 0 5px; font-size: 0.75rem; }
.fsp-add-event-dialog { margin-top: 0.6rem; padding: 0.6rem; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-content-border-color); }
.fsp-aed-title { font-size: 0.78rem; font-weight: 600; color: var(--p-text-color); margin-bottom: 0.4rem; }
.fsp-event { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-event:last-child { border-bottom: none; }
.fsp-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-event-body { flex: 1; }
.fsp-event-title { font-size: 0.83rem; color: var(--p-text-color); }
.fsp-event-date { font-size: 0.75rem; color: var(--p-text-muted-color); }

/* Nav */
.fsp-detail-nav { display: flex; gap: 8px; justify-content: center; }

/* DataTable */
.fsp-datatable { font-size: 0.83rem; }
.fsp-dt-name { font-weight: 600; color: var(--p-primary-color); cursor: pointer; }
.fsp-dt-name:hover { text-decoration: underline; }
.fsp-dt-sub { font-size: 0.75rem; color: var(--p-text-muted-color); }

/* Chat */
.fsp-chat-panel { display: flex; flex-direction: column; }
.fsp-chat-hint { font-size: 0.78rem; color: var(--p-text-muted-color); margin-bottom: 12px; line-height: 1.5; }
.fsp-chat-messages {
  flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 12px; padding: 8px; background: var(--p-surface-card);
  border-radius: 8px; border: 1px solid var(--p-content-border-color); min-height: 120px;
}
.fsp-chat-msg { padding: 8px 12px; border-radius: 8px; max-width: 85%; }
.fsp-chat-msg.user { background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); align-self: flex-end; }
.fsp-chat-msg.assistant { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); align-self: flex-start; }
.fsp-chat-msg-role { font-size: 0.75rem; font-weight: 600; color: var(--p-text-muted-color); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.fsp-chat-msg-text { font-size: 0.83rem; color: var(--p-text-color); line-height: 1.6; }
.fsp-chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
.fsp-chat-input { flex: 1; font-size: 0.83rem; }

/* Chart containers */
.fsp-chart-wrap { position: relative; height: 110px; padding: 0; }
.fsp-chart-bar { height: 200px; }

/* Live feed */
.fsp-live-feed { display: flex; flex-direction: column; gap: 2px; max-height: 140px; overflow-y: auto; }
.fsp-feed-item { display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-feed-item:last-child { border-bottom: none; }
.fsp-feed-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.fsp-feed-body { flex: 1; min-width: 0; }
.fsp-feed-label { font-size: 0.78rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsp-feed-meta { font-size: 0.7rem; color: var(--p-text-muted-color); }

/* Empty hints */
.fsp-empty-hint { font-size: 0.78rem; color: var(--p-text-muted-color); text-align: center; padding: 20px 10px; display: flex; align-items: center; justify-content: center; gap: 6px; }

/* ═══ Signal Board ═══ */
/* ═══ AI Navigator (icon + hover chips) ═══ */
.fsp-ai-nav {
  display: flex; align-items: center; gap: 0;
  margin-bottom: 10px;
  height: 36px;
}
.fsp-ai-nav-trigger {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, var(--p-content-border-color));
  background: color-mix(in srgb, var(--fst-purple) 8%, var(--p-surface-card));
  color: var(--fst-purple);
  font-size: 0.93rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}
.fsp-ai-nav-trigger:hover {
  background: color-mix(in srgb, var(--fst-purple) 18%, var(--p-surface-card));
  border-color: var(--fst-purple);
  transform: scale(1.1);
  box-shadow: 0 0 12px color-mix(in srgb, var(--fst-purple) 30%, transparent);
}
.fsp-ai-nav--loading .fsp-ai-nav-trigger {
  border-color: var(--fst-purple);
  box-shadow: 0 0 8px color-mix(in srgb, var(--fst-purple) 25%, transparent);
}
.fsp-ai-nav-chips {
  display: flex; align-items: center; gap: 4px;
  margin-left: 6px;
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: none;
}
.fsp-ai-nav:hover .fsp-ai-nav-chips,
.fsp-ai-nav--has-blocks .fsp-ai-nav-chips {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
.fsp-ai-chip {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 600;
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.fsp-ai-chip i { font-size: 0.75rem; color: var(--fst-purple); }
.fsp-ai-chip:hover {
  background: color-mix(in srgb, var(--fst-purple) 12%, transparent);
  border-color: var(--fst-purple);
  color: var(--fst-purple);
}
.fsp-ai-chip--clear {
  border-color: color-mix(in srgb, var(--fst-red) 30%, var(--p-content-border-color));
}
.fsp-ai-chip--clear i { color: var(--fst-red); }
.fsp-ai-chip--clear:hover {
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border-color: var(--fst-red);
  color: var(--fst-red);
}
/* Transition */
.fsp-nav-chips-enter-active, .fsp-nav-chips-leave-active { transition: opacity 0.2s ease; }
.fsp-nav-chips-enter-from, .fsp-nav-chips-leave-to { opacity: 0; }

/* ─── Context strip (Focus+Context: KPI сохраняется при AI) ─── */
.fsp-ctx-strip {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 16px; margin-bottom: 16px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
}
.fsp-ctx-kpi {
  display: flex; align-items: center; gap: 5px;
}
.fsp-ctx-icon { font-size: 0.88rem; opacity: 0.5; }
.fsp-ctx-val { font-size: 0.93rem; font-weight: 700; line-height: 1; }
.fsp-ctx-label { font-size: 0.75rem; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.04em; }
.fsp-ctx-health {
  display: flex; align-items: center; gap: 4px;
  margin-left: auto;
  font-size: 0.78rem; font-weight: 600;
  color: var(--p-text-muted-color);
}
.fsp-ctx-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; margin-left: 6px;
}
.fsp-ctx-dot:first-child { margin-left: 0; }

/* Dynamic blocks grid — Cowan's 4±1: max 6 блоков, 3 колонки */
.fsp-ai-blocks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.fsp-ai-block {
  background: var(--p-surface-card);
  border: 1px solid color-mix(in srgb, var(--block-color, var(--fst-purple)) 12%, var(--p-content-border-color));
  border-radius: 12px; padding: 14px 16px;
  border-top: 3px solid var(--block-color, var(--fst-purple));
  animation: fsp-block-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.fsp-ai-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--block-color, var(--fst-purple)) 12%, transparent);
}
@keyframes fsp-block-in {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
.fsp-block-anim-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.fsp-block-anim-enter-from { opacity: 0; transform: translateY(20px); }
.fsp-block-anim-leave-active { transition: all 0.25s ease-in; }
.fsp-block-anim-leave-to { opacity: 0; transform: scale(0.93); }
.fsp-block-anim-move { transition: transform 0.3s; }

.fsp-aib-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
}
.fsp-aib-header i { font-size: 15px; opacity: 0.85; }
.fsp-aib-title { font-size: 0.88rem; font-weight: 700; color: var(--p-text-color); letter-spacing: -0.01em; }
.fsp-aib-text { font-size: 0.83rem; line-height: 1.5; color: var(--p-text-color); white-space: pre-wrap; }

/* Ranking */
.fsp-aib-ranking { display: flex; flex-direction: column; gap: 4px; }
.fsp-aib-rank-row {
  display: flex; align-items: center; gap: 8px; padding: 4px 8px;
  border-radius: 6px; background: var(--p-surface-card); font-size: 0.83rem;
}
.fsp-aib-rank-pos {
  width: 18px; height: 18px; border-radius: 50%;
  background: color-mix(in srgb, var(--block-color) 15%, transparent);
  color: var(--block-color); font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fsp-aib-rank-name { flex: 1; color: var(--p-text-color); }
.fsp-aib-rank-val { font-weight: 700; font-size: 0.83rem; white-space: nowrap; }

/* Metric */
.fsp-aib-metric-val { font-size: 28px; font-weight: 800; line-height: 1; margin: 4px 0; }
.fsp-aib-metric-sub { font-size: 0.78rem; color: var(--p-text-muted-color); }

/* Comparison */
.fsp-aib-compare {
  display: flex; align-items: center; gap: 12px; justify-content: center; margin: 8px 0;
}
.fsp-aib-compare-side { text-align: center; }
.fsp-aib-compare-val { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.fsp-aib-compare-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; }
.fsp-aib-compare-vs {
  font-size: 0.78rem; font-weight: 700; color: var(--p-text-muted-color);
  padding: 4px 8px; border-radius: 8px; background: var(--p-surface-card);
}
.fsp-aib-verdict { font-size: 0.78rem; color: var(--p-text-muted-color); text-align: center; margin-top: 6px; font-style: italic; }

/* Alert block */
.fsp-ai-block--alert { border-top-color: var(--fst-red); background: color-mix(in srgb, var(--fst-red) 3%, var(--p-surface-card)); }
.fsp-aib-action { margin-top: 8px; }

/* Recommendation */
.fsp-aib-rec-items { display: flex; flex-direction: column; gap: 4px; }
.fsp-aib-rec-item {
  display: flex; align-items: flex-start; gap: 6px; font-size: 0.83rem;
  padding: 4px 0; color: var(--p-text-color); line-height: 1.4;
}

/* Table */
.fsp-aib-table { font-size: 0.78rem; }
.fsp-aib-table-head {
  display: flex; gap: 4px; padding: 4px 6px; font-weight: 700;
  color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-aib-table-head span { flex: 1; }
.fsp-aib-table-row {
  display: flex; gap: 4px; padding: 4px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
}
.fsp-aib-table-row span { flex: 1; color: var(--p-text-color); }
.fsp-aib-table-row:last-child { border-bottom: none; }

/* Chart blocks */
.fsp-aib-chart-wrap { height: 200px; position: relative; margin-top: 6px; }
.fsp-aib-chart-pie { height: 180px; }
.fsp-aib-chart-pie { height: 150px; }

/* Horizontal bars (CSS-only) */
.fsp-aib-hbars { display: flex; flex-direction: column; gap: 6px; }
.fsp-aib-hbar-row { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; }
.fsp-aib-hbar-label { width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--p-text-color); flex-shrink: 0; }
.fsp-aib-hbar-track { flex: 1; height: 16px; background: var(--p-surface-card); border-radius: 4px; overflow: hidden; }
.fsp-aib-hbar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease-out; min-width: 2px; }
.fsp-aib-hbar-val { font-weight: 700; white-space: nowrap; min-width: 50px; text-align: right; color: var(--p-text-color); }

/* Gauge */
.fsp-aib-gauge { text-align: center; }
.fsp-aib-gauge-track { height: 14px; background: var(--p-surface-card); border-radius: 7px; overflow: hidden; margin-bottom: 8px; }
.fsp-aib-gauge-fill { height: 100%; border-radius: 7px; transition: width 0.8s ease-out; }
.fsp-aib-gauge-labels { display: flex; align-items: baseline; justify-content: center; gap: 4px; }
.fsp-aib-gauge-val { font-size: 28px; font-weight: 800; line-height: 1; }
.fsp-aib-gauge-max { font-size: 0.93rem; color: var(--p-text-muted-color); }

/* Chart blocks — constrained widths */
.fsp-ai-block--bar_chart,
.fsp-ai-block--line_chart { flex: 1 1 320px; max-width: 500px; }
.fsp-ai-block--pie_chart,
.fsp-ai-block--doughnut_chart,
.fsp-ai-block--radar_chart { flex: 1 1 260px; max-width: 380px; }
.fsp-ai-block--horizontal_bar { flex: 1 1 300px; max-width: 440px; }
.fsp-ai-block--gauge { flex: 1 1 220px; max-width: 320px; }
/* Все chart.js блоки — курсор pointer для кликабельности */
.fsp-ai-block--bar_chart canvas,
.fsp-ai-block--line_chart canvas,
.fsp-ai-block--doughnut_chart canvas,
.fsp-ai-block--pie_chart canvas,
.fsp-ai-block--radar_chart canvas { cursor: pointer; }

/* ═══ Phase Drill-Down (compact) ═══ */
.fsp-phase-drill {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 10px 14px;
}
.fsp-drill-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.fsp-phase-drill-list { display: flex; flex-wrap: wrap; gap: 4px; }
.fsp-phase-drill-item {
  display: flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-radius: 6px; cursor: pointer; font-size: 0.78rem;
  background: var(--p-surface-card); transition: all 0.15s;
}
.fsp-phase-drill-item:hover { background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-card)); }
.fsp-phase-drill-name { font-weight: 600; color: var(--p-text-color); }
.fsp-phase-drill-sub { color: var(--p-text-muted-color); font-size: 0.75rem; }
.fsp-phase-node.focused .fsp-phase-dot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--fst-blue) 40%, transparent); transform: scale(1.15); }
.fsp-phase-node.focused .fsp-phase-label { color: var(--p-text-color); font-weight: 600; }

/* ═══ Signal Strip (compact horizontal) ═══ */
.fsp-signal-strip {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 8px; border-left: 3px solid var(--fst-purple); overflow-x: auto;
}
.fsp-signal-strip-label {
  display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700;
  color: var(--fst-purple); white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em;
}
.fsp-signal-count {
  background: var(--fst-purple); color: white; border-radius: 8px; padding: 0 5px;
  font-size: 0.7rem; margin-left: 2px;
}
.fsp-signal-chips { display: flex; gap: 4px; overflow-x: auto; }
.fsp-signal-chip {
  display: flex; align-items: center; gap: 4px; padding: 3px 8px;
  border-radius: 6px; font-size: 0.75rem; cursor: pointer;
  background: var(--p-surface-card); border: 1px solid transparent;
  white-space: nowrap; transition: all 0.15s;
}
.fsp-signal-chip:hover { border-color: var(--p-primary-color); }
.fsp-signal-chip.critical { background: color-mix(in srgb, var(--fst-red) 8%, var(--p-surface-card)); }
.fsp-schip-name { font-weight: 600; color: var(--p-text-color); }
.fsp-schip-type { color: var(--p-text-muted-color); }

/* ═══ Event Chips + Chains (compact) ═══ */
.fsp-event-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.fsp-echip {
  display: flex; align-items: center; gap: 4px; padding: 3px 8px;
  border-radius: 6px; font-size: 0.75rem; cursor: pointer;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  white-space: nowrap; transition: all 0.15s;
}
.fsp-echip:hover { border-color: var(--p-primary-color); }
.fsp-echip-red { border-left: 2px solid var(--fst-red); }
.fsp-echip-green { border-left: 2px solid var(--fst-green); }
.fsp-chains-strip {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.fsp-chains-label {
  display: flex; align-items: center; gap: 3px; font-size: 0.75rem; font-weight: 700;
  color: var(--fst-cyan); text-transform: uppercase; white-space: nowrap;
}
.fsp-chain-chip {
  display: flex; align-items: center; gap: 3px; padding: 2px 7px;
  border-radius: 5px; font-size: 0.75rem;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
}
.fsp-cch-from { color: var(--p-text-color); font-weight: 500; }
.fsp-cch-done { color: var(--fst-green); font-weight: 600; }
.fsp-cch-pending { color: var(--p-text-muted-color); font-style: italic; }

/* ═══ СОД — Событийный движок ═══ */
.fsp-sod-mode {
  display: flex; align-items: center; gap: 10px;
  padding: 2px 0;
}
.fsp-sod-hint {
  font-size: 0.78rem; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 4px;
}
.fsp-sod-stream {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px;
}
.fsp-sod-block {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; border-radius: 8px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--sod-color, var(--fst-purple));
  position: relative; overflow: hidden; min-height: 48px;
}
.fsp-sod--alert { border-left-color: var(--fst-red); }
.fsp-sod--milestone { border-left-color: var(--fst-green); }
.fsp-sod--signal { border-left-color: var(--fst-brand); }
.fsp-sod--insight { border-left-color: var(--fst-purple); }
.fsp-sod--deal { border-left-color: var(--fst-blue); }
.fsp-sod--chain { border-left-color: var(--fst-cyan); }
.fsp-sod--chart { border-left-color: var(--fst-blue); }
.fsp-sod--fund { border-left-color: var(--fst-blue); }
.fsp-sod--clickable { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
.fsp-sod--clickable:hover { transform: translateY(-1px); box-shadow: 0 2px 8px color-mix(in srgb, var(--sod-color) 20%, transparent); }
.fsp-sod-left { display: flex; align-items: flex-start; gap: 8px; }
.fsp-sod-icon { font-size: 0.93rem; color: var(--sod-color); flex-shrink: 0; margin-top: 1px; }
.fsp-sod-body { flex: 1; min-width: 0; }
.fsp-sod-title { font-size: 0.83rem; font-weight: 700; color: var(--p-text-color); }
.fsp-sod-text { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 1px; line-height: 1.4; }

/* Визуальная часть блоков */
.fsp-sod-visual { margin-top: 4px; }
.fsp-sod-bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.fsp-sod-bar-label { font-size: 0.7rem; width: 60px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--p-text-muted-color); }
.fsp-sod-bar-track { flex: 1; height: 10px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-sod-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease-out; }
.fsp-sod-kpis { display: flex; gap: 12px; }
.fsp-sod-kpi { text-align: center; }
.fsp-sod-kpi-val { font-size: 1rem; font-weight: 800; line-height: 1.1; }
.fsp-sod-kpi-label { font-size: 0.7rem; color: var(--p-text-muted-color); text-transform: uppercase; }
.fsp-sod-pie { display: flex; flex-direction: column; gap: 2px; }
.fsp-sod-pie-row { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; }
.fsp-sod-pie-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-sod-pie-label { color: var(--p-text-color); flex: 1; }
.fsp-sod-pie-pct { font-weight: 700; color: var(--p-text-color); }

.fsp-sod-ttl {
  position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: color-mix(in srgb, var(--sod-color) 20%, transparent);
}
.fsp-sod-ttl-bar {
  height: 100%; width: 100%; background: var(--sod-color);
  animation: sod-ttl-shrink linear forwards;
  transform-origin: left;
}
@keyframes sod-ttl-shrink {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
.fsp-sod-anim-enter-active { transition: all 0.4s ease-out; }
.fsp-sod-anim-enter-from { opacity: 0; transform: translateY(-10px) scale(0.95); }
.fsp-sod-anim-leave-active { transition: all 0.3s ease-in; }
.fsp-sod-anim-leave-to { opacity: 0; transform: scale(0.9); }
.fsp-sod-anim-move { transition: transform 0.3s; }

/* ═══ Семантическое поле — grid с вспышками ═══ */
.fsp-field {
  position: relative; width: 100%;
  height: calc(100vh - 320px); min-height: 360px; overflow: hidden;
  border-radius: 12px;
  background: color-mix(in srgb, var(--p-surface-card) 80%, black);
  border: 1px solid var(--p-content-border-color);
}
.fsp-field-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px; padding: 12px;
  height: 100%;
  align-content: start;
}
.fsp-flash-block {
  position: relative;
  display: flex; flex-direction: column; gap: 4px;
  padding: 10px 12px; border-radius: 10px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--sod-color, var(--fst-purple));
  overflow: hidden; z-index: 2;
  animation: flash-pulse ease-out forwards;
  box-shadow: 0 0 20px color-mix(in srgb, var(--sod-color) 30%, transparent);
  cursor: pointer;
  min-height: 80px;
}
.fsp-flash--wide { grid-column: span 2; }
.fsp-flash-block:hover {
  box-shadow: 0 0 30px color-mix(in srgb, var(--sod-color) 50%, transparent);
  z-index: 10;
}
.fsp-flash-glow {
  position: absolute; inset: -2px; border-radius: 12px;
  opacity: 0.15; pointer-events: none; z-index: -1;
  filter: blur(12px);
}
@keyframes flash-pulse {
  0% { opacity: 0; transform: scale(0.7); box-shadow: 0 0 40px color-mix(in srgb, var(--sod-color) 60%, transparent); }
  15% { opacity: 1; transform: scale(1.03); box-shadow: 0 0 30px color-mix(in srgb, var(--sod-color) 40%, transparent); }
  30% { transform: scale(1); box-shadow: 0 0 20px color-mix(in srgb, var(--sod-color) 25%, transparent); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: scale(0.95); box-shadow: none; }
}
.fsp-flash-ttl {
  position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: color-mix(in srgb, var(--sod-color) 20%, transparent);
}
.fsp-sod-ttl-bar {
  height: 100%; width: 100%;
  background: var(--sod-color, var(--fst-purple));
  animation: ttl-shrink linear forwards;
  transform-origin: left;
}
@keyframes ttl-shrink {
  0% { transform: scaleX(1); }
  100% { transform: scaleX(0); }
}

/* ── Bar value label ── */
.fsp-sod-bar-val {
  font-size: 0.75rem; font-weight: 700; color: var(--p-text-color);
  min-width: 32px; text-align: right; flex-shrink: 0;
}

/* ── Sparkline (CSS bar chart) ── */
.fsp-sod-spark { display: flex; flex-direction: column; gap: 4px; }
.fsp-spark-chart {
  display: flex; align-items: flex-end; gap: 2px; height: 36px;
}
.fsp-spark-bar {
  flex: 1; min-width: 6px; border-radius: 2px 2px 0 0;
  opacity: 0; animation: spark-grow 0.4s ease-out forwards;
}
@keyframes spark-grow {
  0% { opacity: 0; transform: scaleY(0); }
  100% { opacity: 1; transform: scaleY(1); }
}
.fsp-spark-label {
  font-size: 0.7rem; color: var(--p-text-muted-color); text-align: center;
}

/* ── Mini table ── */
.fsp-sod-mini-table {
  display: flex; flex-direction: column; gap: 0;
}
.fsp-sod-trow {
  display: flex; justify-content: space-between; gap: 6px;
  font-size: 0.75rem; color: var(--p-text-color);
  padding: 2px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
}
.fsp-sod-trow:last-child { border-bottom: none; }
.fsp-sod-trow--head {
  font-weight: 700; color: var(--p-text-muted-color);
  text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--p-content-border-color);
  padding-bottom: 3px; margin-bottom: 1px;
}

/* ── Gauge (progress bar) ── */
.fsp-sod-gauge { display: flex; flex-direction: column; gap: 4px; }
.fsp-gauge-track {
  height: 8px; border-radius: 4px; overflow: hidden;
  background: color-mix(in srgb, var(--p-content-border-color) 60%, transparent);
}
.fsp-gauge-fill {
  height: 100%; border-radius: 4px;
  transition: width 0.6s ease-out;
}
.fsp-gauge-labels {
  display: flex; justify-content: space-between; align-items: baseline;
}
.fsp-gauge-val { font-size: 0.83rem; font-weight: 800; }
.fsp-gauge-max { font-size: 0.7rem; color: var(--p-text-muted-color); }

/* Flash transitions */
.fsp-flash-enter-active { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fsp-flash-enter-from { opacity: 0; transform: scale(0.5); }
.fsp-flash-leave-active { transition: all 0.6s ease-in; }
.fsp-flash-leave-to { opacity: 0; transform: scale(0.8); filter: blur(4px); }
.fsp-flash-move { transition: all 0.4s ease; }

/* Демо-часы и скорость */
.fsp-demo-clock {
  display: flex; align-items: center; gap: 5px;
  font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums;
  color: var(--fst-cyan); letter-spacing: 0.05em;
}
.fsp-demo-speed {
  display: flex; align-items: center; gap: 6px; margin-left: 8px;
}
.fsp-demo-speed-label {
  font-size: 0.75rem; color: var(--p-text-muted-color); text-transform: uppercase; font-weight: 600;
}
.fsp-demo-speed :deep(.p-button) { font-size: 0.75rem !important; padding: 2px 8px !important; }

/* ═══ Диалог компании ═══ */
.fsp-cd-status { display: flex; gap: 8px; margin-bottom: 16px; }
.fsp-cd-metrics {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
}
.fsp-cd-metric {
  text-align: center; padding: 10px 4px;
  background: var(--p-surface-card); border-radius: 8px;
}
.fsp-cd-metric-val { font-size: 20px; font-weight: 800; line-height: 1; }
.fsp-cd-metric-label { font-size: 0.75rem; color: var(--p-text-muted-color); text-transform: uppercase; margin-top: 4px; letter-spacing: 0.04em; }
.fsp-cd-health-bar {
  height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 16px;
  background: var(--p-content-border-color);
}
.fsp-cd-hb-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
.fsp-cd-details { display: flex; flex-direction: column; gap: 0; }
.fsp-cd-detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-cd-detail-row:last-child { border-bottom: none; }
.fsp-cd-detail-label { font-size: 0.83rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; }
.fsp-cd-icon { font-size: 0.88rem; opacity: 0.6; }
.fsp-cd-detail-val { font-size: 0.83rem; font-weight: 600; color: var(--p-text-color); }
.risk-text-green { color: var(--fst-green) !important; }
.risk-text-yellow { color: var(--fst-brand) !important; }
.risk-text-red { color: var(--fst-red) !important; }

/* ═══ Phase Timeline ═══ */
.fsp-phase-timeline-wrap {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 14px 20px;
}
.fsp-phase-timeline-label {
  font-size: 0.78rem; font-weight: 600; color: var(--p-text-color);
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.fsp-phase-timeline {
  display: flex; align-items: flex-start; justify-content: center;
  gap: 0; padding: 10px 0; overflow-x: auto;
}
.fsp-phase-node {
  display: flex; flex-direction: column; align-items: center; position: relative;
  min-width: 70px; opacity: 0.45; transition: opacity 0.3s;
}
.fsp-phase-node.active { opacity: 1; }
.fsp-phase-node.current { opacity: 1; }
.fsp-phase-node.current .fsp-phase-dot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--fst-purple) 30%, transparent); }
.fsp-phase-dot {
  width: 28px; height: 28px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; z-index: 1;
  transition: background 0.3s, box-shadow 0.3s;
}
.fsp-phase-label { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 4px; text-align: center; white-space: nowrap; }
.fsp-phase-count {
  font-size: 0.7rem; font-weight: 700; color: var(--p-text-color); margin-top: 1px;
}
.fsp-phase-line {
  position: absolute; top: 14px; left: 50%; width: 100%; height: 2px;
  z-index: 0; transition: background 0.3s;
}


/* Runway */
.fsp-runway-list { display: flex; flex-direction: column; gap: 4px; }
.fsp-runway-row { display: flex; align-items: center; gap: 6px; }
.fsp-runway-name { font-size: 0.75rem; color: var(--p-text-color); width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-runway-bar-wrap { flex: 1; height: 10px; background: var(--p-content-border-color); border-radius: 5px; overflow: hidden; }
.fsp-runway-bar { height: 100%; border-radius: 5px; transition: width 0.5s; }
.fsp-runway-val { font-size: 0.83rem; font-weight: 700; width: 50px; text-align: right; flex-shrink: 0; }

/* Fund KPIs */
.fsp-fund-kpis { display: flex; flex-direction: column; gap: 2px; }
.fsp-fund-kpis--compact .fsp-fkpi-row { padding: 4px 0; }
.fsp-fund-kpis--compact .fsp-fkpi-val { font-size: 0.83rem; }
.fsp-fkpi-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-fkpi-row:last-child { border-bottom: none; }
.fsp-fkpi-label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.fsp-fkpi-val { font-size: 0.88rem; font-weight: 700; color: var(--p-text-color); }

/* Responsive */
@media (max-width: 900px) {
  .fsp-body { grid-template-columns: 1fr !important; }
  .fsp-detail { border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-detail-summary { display: none; }
  .fsp-ig-body { grid-template-columns: 1fr 1fr; }
  .fsp-ig-kpis { flex-wrap: wrap; }
  .fsp-ig-kpi { min-width: 80px; }
  .fsp-pipeline { flex-direction: column; }
}
@media (max-width: 600px) {
  .fsp-ig-body { grid-template-columns: 1fr; }
}

/* ══ НАУЧНЫЕ КОНЦЕПЦИИ: CSS ══════════════════════════════════════════════════ */

/* ── Tufte: SVG Sparklines ── */
.fsp-sparkline {
  width: 48px; height: 16px; margin: 2px auto 0; display: block; opacity: 0.8;
}

/* ── Change Blindness: Дельты ── */
.fsp-delta {
  font-size: 0.7rem; font-weight: 600; padding: 1px 4px; border-radius: 6px; margin-left: 3px;
  display: inline-block; line-height: 1.2;
}
.fsp-delta.up { color: var(--fst-green); background: color-mix(in srgb, var(--fst-green) 12%, transparent); }
.fsp-delta.down { color: var(--fst-red); background: color-mix(in srgb, var(--fst-red) 12%, transparent); }

/* ── Endsley L3: Проекции ── */
.fsp-projections {
  display: flex; gap: 8px; padding: 8px 12px; margin-bottom: 8px;
  background: color-mix(in srgb, var(--fst-purple) 4%, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color); border-radius: 10px;
  overflow-x: auto;
}
.fsp-proj-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 10px;
  border-radius: 8px; font-size: 0.75rem; white-space: nowrap; flex-shrink: 0;
  border-left: 2px solid transparent; transition: all 0.3s ease;
}
.fsp-proj--critical {
  border-left-color: var(--fst-red);
  background: color-mix(in srgb, var(--fst-red) 6%, transparent);
  color: var(--fst-red);
}
.fsp-proj--warning {
  border-left-color: var(--fst-brand);
  background: color-mix(in srgb, var(--fst-brand) 6%, transparent);
  color: var(--fst-brand);
}
.fsp-proj--info {
  border-left-color: var(--fst-blue);
  background: color-mix(in srgb, var(--fst-blue) 6%, transparent);
  color: var(--fst-blue);
}
.fsp-proj-icon { font-size: 0.83rem; opacity: 0.8; }
.fsp-proj-text { font-weight: 500; }
.fsp-proj-when {
  font-size: 0.7rem; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  background: color-mix(in srgb, currentColor 12%, transparent); margin-left: auto;
}

/* ── Зейгарник: Action Items ── */
.fsp-action-items { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.fsp-action-item {
  display: flex; align-items: center; gap: 6px; padding: 4px 6px;
  border-radius: 6px; transition: background 0.3s ease;
}
.fsp-action-item:hover { background: color-mix(in srgb, var(--fst-blue) 6%, transparent); }
.fsp-action-item.done { opacity: 0.6; }
.fsp-ai-check { flex-shrink: 0; }
.fsp-ai-check-icon { font-size: 0.88rem; color: var(--p-text-muted-color); }
.fsp-ai-check-icon.done { color: var(--fst-green); }
.fsp-ai-body { flex: 1; min-width: 0; }
.fsp-ai-text { font-size: 0.75rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsp-ai-progress-bar {
  height: 3px; background: color-mix(in srgb, var(--p-text-muted-color) 15%, transparent);
  border-radius: 2px; margin-top: 3px; overflow: hidden;
}
.fsp-ai-progress-fill {
  height: 100%; border-radius: 2px;
  transition: width 0.8s ease;
}
.fsp-ai-pct { font-size: 0.7rem; font-weight: 600; flex-shrink: 0; }

/* ── Change Blindness: Что изменилось ── */
.fsp-changelog { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
.fsp-change-item {
  display: flex; align-items: center; gap: 5px; padding: 3px 6px;
  border-radius: 5px; font-size: 0.75rem; transition: all 0.3s ease;
}
.fsp-change-item:hover { background: color-mix(in srgb, var(--fst-blue) 6%, transparent); }
.fsp-change--positive .fsp-change-icon { color: var(--fst-green); }
.fsp-change--negative .fsp-change-icon { color: var(--fst-red); }
.fsp-change--neutral .fsp-change-icon { color: var(--fst-blue); }
.fsp-change-icon { font-size: 0.78rem; flex-shrink: 0; }
.fsp-change-text { color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── SDT: Калиброванные алерты ── */
.fsp-sdt-alerts { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
.fsp-sdt-alert {
  display: flex; align-items: center; gap: 5px; padding: 4px 6px;
  border-radius: 6px; font-size: 0.75rem; border-left: 2px solid transparent;
  transition: all 0.3s ease;
}
.fsp-sdt-alert:hover { background: color-mix(in srgb, var(--p-text-muted-color) 6%, transparent); }
.fsp-sdt--critical {
  border-left-color: var(--fst-red);
  animation: fsp-sdt-pulse 2s ease-in-out infinite;
}
.fsp-sdt--warning { border-left-color: var(--fst-brand); }
.fsp-sdt--info { border-left-color: var(--fst-blue); }
.fsp-sdt-icon { font-size: 0.78rem; flex-shrink: 0; }
.fsp-sdt--critical .fsp-sdt-icon { color: var(--fst-red); }
.fsp-sdt--warning .fsp-sdt-icon { color: var(--fst-brand); }
.fsp-sdt--info .fsp-sdt-icon { color: var(--fst-blue); }
.fsp-sdt-text { flex: 1; min-width: 0; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsp-sdt-time { font-size: 0.65rem; color: var(--p-text-muted-color); opacity: 0.6; white-space: nowrap; flex-shrink: 0; }

/* SDT: preattentive pulse для критических алертов (< 200мс обнаружение) */
@keyframes fsp-sdt-pulse {
  0%, 100% { background: transparent; }
  50% { background: color-mix(in srgb, var(--fst-red) 6%, transparent); }
}

/* Calm Technology: плавные transition для всех интерактивных элементов */
.fsp-ig-kpi { transition: transform 0.3s ease, box-shadow 0.3s ease; }
.fsp-ig-kpi:hover { transform: translateY(-1px); box-shadow: 0 2px 8px color-mix(in srgb, var(--p-text-color) 8%, transparent); }
.fsp-heat-cell { transition: transform 0.3s ease, box-shadow 0.3s ease; }
.fsp-heat-cell:hover { transform: translateY(-2px); box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 12%, transparent); }

/* ═══ Morning Briefing Banner ═══ */
.fsp-morning-brief {
  background: color-mix(in srgb, var(--fst-brand) 6%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--fst-brand) 20%, var(--p-content-border-color));
  border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;
}
.fsp-brief-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fst-brand);
}
.fsp-brief-header i { font-size: 0.93rem; }
.fsp-brief-close {
  margin-left: auto; background: none; border: none; cursor: pointer; color: var(--p-text-muted-color);
  font-size: 0.83rem; padding: 2px; opacity: 0.5; transition: opacity 0.2s;
}
.fsp-brief-close:hover { opacity: 1; }
.fsp-brief-text { font-size: 0.83rem; line-height: 1.6; color: var(--p-text-color); }
.fsp-brief-anim-enter-active { transition: all 0.4s ease; }
.fsp-brief-anim-leave-active { transition: all 0.3s ease; }
.fsp-brief-anim-enter-from { opacity: 0; transform: translateY(-8px); max-height: 0; }
.fsp-brief-anim-leave-to { opacity: 0; max-height: 0; overflow: hidden; }

/* ═══ Portfolio Score + NAV Timeline + Correlation Row ═══ */
.fsp-score-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px;
  align-items: stretch;
}
.fsp-score-row > * {
  min-height: 0;
}
.fsp-score-gauge {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px; text-align: center; min-width: 120px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative;
}
.fsp-score-svg { width: 80px; height: 48px; }
.fsp-score-arc { transition: stroke-dasharray 1s ease; }
.fsp-score-val {
  font-size: 1.4rem; font-weight: 800; line-height: 1; margin-top: -6px;
  font-variant-numeric: tabular-nums;
}
.fsp-score-label {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--p-text-muted-color); margin-top: 4px;
}

.fsp-nav-timeline {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px; min-width: 0;
}
.fsp-nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.fsp-nav-title {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
}
.fsp-nav-val { font-size: 0.88rem; font-weight: 700; color: var(--fst-purple); }
.fsp-nav-svg { width: 100%; height: 28px; }
.fsp-nav-labels {
  display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--p-text-muted-color);
  margin-top: 2px;
}

.fsp-corr-matrix {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px; min-width: 0;
}
.fsp-corr-title {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--p-text-muted-color); margin-bottom: 6px;
}
.fsp-corr-head {
  display: grid; grid-template-columns: 1fr repeat(3, 42px); gap: 3px;
  font-size: 0.65rem; font-weight: 700; color: var(--p-text-muted-color);
  text-align: center; margin-bottom: 3px;
}
.fsp-corr-head span:first-child { text-align: left; }
.fsp-corr-row {
  display: grid; grid-template-columns: 1fr repeat(3, 42px); gap: 3px;
  font-size: 0.75rem; margin-bottom: 2px;
}
.fsp-corr-name {
  font-weight: 600; font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fsp-corr-cell {
  text-align: center; border-radius: 4px; padding: 2px 0; font-weight: 600;
  font-size: 0.7rem; color: var(--p-text-color); font-variant-numeric: tabular-nums;
}

/* ═══ Company Pulse Sparkline on Heatmap Hover ═══ */
.fsp-heat-pulse {
  position: absolute; bottom: 2px; left: 4px; right: 4px;
  height: 12px; opacity: 0; transition: opacity 0.3s ease;
  pointer-events: none;
}
.fsp-heat-cell { position: relative; }
.fsp-heat-cell:hover .fsp-heat-pulse { opacity: 1; }

/* ═══ Briefing chip highlight ═══ */
.fsp-ai-chip--brief i { color: var(--fst-brand); }
.fsp-ai-chip--brief:hover {
  background: color-mix(in srgb, var(--fst-brand) 12%, transparent);
  border-color: var(--fst-brand);
  color: var(--fst-brand);
}

/* ═══ Technology Coverage Radar ═══ */
.fsp-tech-radar {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 20px; min-width: 0;
  display: flex; flex-direction: column; align-items: center;
}
.fsp-radar-svg { width: 180px; height: 160px; }
.fsp-radar-label { font-size: 0.65rem; fill: var(--p-text-muted-color); font-weight: 600; }
.fsp-radar-legend {
  display: flex; gap: 10px; font-size: 0.65rem; color: var(--p-text-muted-color); margin-top: 4px;
}

/* ═══ Agent Swarm Live Analysis ═══ */
.fsp-swarm {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;
}
.fsp-swarm-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  font-size: 0.83rem; font-weight: 700; color: var(--p-text-color);
}
.fsp-swarm-timer {
  margin-left: auto; font-size: 0.75rem; font-weight: 600;
  color: var(--fst-purple); font-variant-numeric: tabular-nums;
}
.fsp-swarm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.fsp-swarm-tile {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--agent-color); border-radius: 8px; padding: 10px;
  transition: all 0.3s ease; min-height: 120px;
}
.fsp-swarm-tile.done { border-left-color: var(--fst-green); }
.fsp-swarm-tile.error { border-left-color: var(--fst-red); }
.fsp-swarm-tile-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.78rem; font-weight: 700; margin-bottom: 8px;
}
.fsp-swarm-dot {
  width: 6px; height: 6px; border-radius: 50%; margin-left: auto; flex-shrink: 0;
  background: var(--p-text-muted-color);
}
.fsp-swarm-dot.running { background: var(--fst-brand); animation: swarm-pulse 1.2s ease-in-out infinite; }
.fsp-swarm-dot.done { background: var(--fst-green); }
.fsp-swarm-dot.error { background: var(--fst-red); }
@keyframes swarm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
.fsp-swarm-steps { display: flex; flex-direction: column; gap: 3px; }
.fsp-swarm-step {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.7rem; color: var(--p-text-muted-color);
}
.fsp-swarm-result { margin-top: 8px; }
.fsp-swarm-stance {
  display: inline-block; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em;
  padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;
}
.fsp-swarm-stance.positive { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.fsp-swarm-stance.caution { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.fsp-swarm-stance.critical { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.fsp-swarm-text { font-size: 0.75rem; line-height: 1.4; color: var(--p-text-color); margin-bottom: 6px; }
.fsp-swarm-conf { display: flex; align-items: center; gap: 6px; }
.fsp-swarm-conf-bar {
  flex: 1; height: 3px; background: color-mix(in srgb, var(--p-text-muted-color) 15%, transparent);
  border-radius: 2px; overflow: hidden;
}
.fsp-swarm-conf-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; }
.fsp-swarm-conf span { font-size: 0.7rem; font-weight: 700; color: var(--p-text-muted-color); }
.fsp-swarm-synthesis {
  display: flex; align-items: flex-start; gap: 8px; margin-top: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--fst-green) 5%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--fst-green) 20%, var(--p-content-border-color));
}
.fsp-swarm-synth-text { font-size: 0.78rem; line-height: 1.5; color: var(--p-text-color); }

/* ═══ Predictive Signal Stream ═══ */
.fsp-pred-stream {
  background: color-mix(in srgb, var(--fst-purple) 3%, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color); border-radius: 10px;
  padding: 10px 14px; margin-bottom: 8px;
}
.fsp-pred-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.fsp-pred-cards { display: flex; gap: 6px; overflow-x: auto; }
.fsp-pred-card {
  flex: 1; min-width: 180px; padding: 8px 10px; border-radius: 8px;
  border-left: 2px solid transparent; cursor: pointer;
  transition: all 0.3s ease; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
}
.fsp-pred-card:hover { background: color-mix(in srgb, var(--fst-purple) 5%, var(--p-surface-card)); }
.fsp-pred--critical { border-left-color: var(--fst-red); }
.fsp-pred--warning { border-left-color: var(--fst-brand); }
.fsp-pred--info { border-left-color: var(--fst-blue); }
.fsp-pred-top { display: flex; align-items: center; gap: 6px; }
.fsp-pred-icon { font-size: 0.83rem; flex-shrink: 0; }
.fsp-pred-text { flex: 1; font-size: 0.75rem; line-height: 1.4; color: var(--p-text-color); }
.fsp-pred-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--p-content-border-color); }
.fsp-pred-chain { display: flex; flex-direction: column; gap: 2px; }
.fsp-pred-chain-step { display: flex; align-items: center; gap: 6px; position: relative; padding-left: 12px; }
.fsp-pred-chain-dot {
  position: absolute; left: 0; width: 6px; height: 6px; border-radius: 50%;
}
.fsp-pred-chain-line {
  position: absolute; left: 2.5px; top: 10px; width: 1px; height: 12px;
  background: var(--p-content-border-color);
}
.fsp-pred-chain-label { font-size: 0.65rem; color: var(--p-text-muted-color); font-weight: 600; }
.fsp-pred-chain-entity { font-size: 0.7rem; color: var(--p-text-color); font-weight: 600; }
.fsp-pred-concepts { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
.fsp-pred-concept-tag {
  font-size: 0.65rem; padding: 2px 6px; border-radius: 8px;
  background: color-mix(in srgb, var(--fst-cyan) 12%, transparent);
  color: var(--fst-cyan); font-weight: 600;
}

/* ═══ Technology Constellation Map ═══ */
.fsp-const-row {
  display: flex; gap: 10px; margin-bottom: 8px; align-items: stretch;
}
.fsp-constellation {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 10px 12px;
  flex: 1; min-width: 0; cursor: pointer; position: relative;
  transition: border-color 0.3s ease;
}
.fsp-constellation:hover { border-color: var(--fst-cyan); }
.fsp-constellation-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
}
.fsp-constellation-svg { width: 100%; height: 160px; }

/* Domain Stats — right panel */
.fsp-domain-stats {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 10px 14px;
  flex: 1; min-width: 0;
}
.fsp-domain-list { display: flex; flex-direction: column; gap: 5px; }
.fsp-domain-row {
  display: flex; align-items: center; gap: 6px; font-size: 0.75rem;
}
.fsp-domain-name {
  width: 70px; font-weight: 600; color: var(--p-text-color);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;
}
.fsp-domain-bar-wrap {
  flex: 1; height: 6px; background: color-mix(in srgb, var(--p-text-muted-color) 12%, transparent);
  border-radius: 3px; position: relative; overflow: visible;
}
.fsp-domain-bar { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
.fsp-domain-target {
  position: absolute; top: -2px; width: 2px; height: 10px;
  background: var(--fst-brand); border-radius: 1px; opacity: 0.7;
}
.fsp-domain-val {
  font-weight: 700; font-variant-numeric: tabular-nums; width: 32px; text-align: right;
  color: var(--p-text-color); flex-shrink: 0;
}
.fsp-domain-count {
  font-size: 0.7rem; color: var(--p-text-muted-color); width: 45px; text-align: right; flex-shrink: 0;
}
.fsp-domain-footer { margin-top: 6px; }

/* Zoom overlay on hover */
.fsp-const-zoom {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 1000; width: 680px; max-width: 90vw; height: 420px;
  background: var(--p-surface-card); border: 1px solid var(--fst-cyan);
  border-radius: 14px; padding: 16px;
  box-shadow: 0 20px 60px color-mix(in srgb, var(--fst-cyan) 15%, color-mix(in srgb, var(--p-text-color) 50%, transparent));
  backdrop-filter: blur(8px);
}
.fsp-const-zoom-svg { width: 100%; height: 100%; }
.fsp-const-edge {
  stroke: var(--fst-cyan); stroke-width: 0.8; opacity: 0.2;
  transition: opacity 0.3s, stroke-width 0.3s;
}
.fsp-const-edge.highlighted { opacity: 0.8; stroke-width: 2; }
.fsp-const-concept { cursor: default; }
.fsp-const-label { font-size: 0.6rem; fill: var(--fst-cyan); font-weight: 600; }
.fsp-const-company { cursor: pointer; transition: transform 0.2s; }
.fsp-const-company:hover { transform: scale(1.15); }
.fsp-const-circle {
  opacity: 0.85; stroke: var(--p-surface-card); stroke-width: 1.5;
  transition: opacity 0.3s, r 0.3s;
}
.fsp-const-company.hovered .fsp-const-circle { opacity: 1; }
.fsp-const-company.orphan .fsp-const-circle { animation: orphan-pulse 2s ease-in-out infinite; }
@keyframes orphan-pulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.35; } }
.fsp-const-name { font-size: 0.6rem; fill: var(--p-text-color); font-weight: 600; }
.fsp-constellation-legend {
  display: flex; gap: 12px; font-size: 0.7rem; color: var(--p-text-muted-color);
  align-items: center; margin-top: 4px;
}

/* ═══ Swarm & Pred chip highlights ═══ */
.fsp-ai-chip--swarm i { color: var(--fst-cyan); }
.fsp-ai-chip--swarm:hover {
  background: color-mix(in srgb, var(--fst-cyan) 12%, transparent);
  border-color: var(--fst-cyan); color: var(--fst-cyan);
}
.fsp-ai-chip--pred i { color: var(--fst-blue); }
.fsp-ai-chip--pred:hover {
  background: color-mix(in srgb, var(--fst-blue) 12%, transparent);
  border-color: var(--fst-blue); color: var(--fst-blue);
}

/* ═══ Utility classes — inline style extraction ═══ */
/* Tag sizing */
.fsp-tag-sm { font-size: 0.7rem; }
.fsp-tag-sm-brand { font-size: 0.7rem; background: var(--fst-brand); color: white; }
.fsp-tag-sm-blue { font-size: 0.7rem; background: var(--fst-blue); color: white; }

/* Icon sizing (inline icons) */
.fsp-icon-xs { font-size: 0.75rem; }
.fsp-icon-sm { font-size: 0.83rem; }
.fsp-icon-md { font-size: 0.93rem; }
.fsp-icon-lg { font-size: 1rem; }
.fsp-icon-xl { font-size: 20px; }
.fsp-icon-inline { vertical-align: -2px; margin-right: 4px; }
.fsp-icon-inline-lg { vertical-align: -3px; margin-right: 6px; }

/* Legend dots */
.fsp-legend-dot { font-size: 0.5rem; }
.fsp-legend-dot-sm { font-size: 0.6rem; }

/* Muted text helper */
.fsp-text-muted { color: var(--p-text-muted-color); }
.fsp-text-bold { font-weight: 600; }
.fsp-text-bold-700 { font-weight: 700; }

/* Colored values */
.fsp-val-blue { font-weight: 600; color: var(--fst-blue); }
.fsp-val-green { font-weight: 600; color: var(--fst-green); }
.fsp-val-purple { font-weight: 700; color: var(--fst-purple); }
.fsp-val-red { color: var(--fst-red); }

/* Section title spacing variants */
.page-section-title--mt { margin-top: 10px; }
.page-section-title--flush { margin: 0; }

/* Search icon in input */
.fsp-search-icon { font-size: 0.83rem; color: var(--p-text-muted-color); }

/* Responsive */
@media (max-width: 768px) {
  .fsp-score-row { grid-template-columns: 1fr; }
  .fsp-corr-matrix, .fsp-tech-radar { min-width: unset; }
  .fsp-swarm-grid { grid-template-columns: repeat(2, 1fr); }
  .fsp-pred-cards { flex-direction: column; }
  .fsp-constellation-svg { height: 200px; }
}
</style>

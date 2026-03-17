<template>
  <FstPageLayout
    title="Портфель фонда"
    subtitle="Мониторинг портфельных и рассматриваемых компаний"
  >
    <!-- ─── Topbar left: title + status ─── -->
    <template #header>
      <div class="fsp-title-group">
        <i class="pi pi-circle-fill fsp-live-dot" :style="{ color: liveColor }"></i>
        <span class="fsp-fund-name">ФСТ НТИ · <b>Портфельный монитор</b></span>
        <Tag :value="`${portfolioCount} в портфеле`" severity="success" class="fsp-tag" />
        <Tag :value="`${reviewCount} на рассмотрении`" severity="info" class="fsp-tag" />
        <Tag v-if="alertCount > 0" :value="`${alertCount} алертов`" severity="warn" class="fsp-tag" />
      </div>
      <div class="fsp-updated">
        Обновлено: {{ lastUpdate }} · Мониторинг {{ monitoringStatus }}
      </div>
    </template>

    <!-- ─── Topbar right: actions ─── -->
    <template #actions>
      <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="refreshAll" :loading="refreshing" />
      <Button icon="pi pi-building" label="ЦД Фонда" size="small" severity="secondary" text @click="$router.push('/fst-fund')" />
    </template>

    <!-- ─── KPI metrics strip ─── -->
    <div class="fsp-metrics fst-metrics-strip">
      <div v-for="m in topMetrics" :key="m.label" class="fst-metric-item">
        <i :class="m.icon" class="fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ m.val }}</div>
        <div class="fst-metric-item-label">{{ m.label }}</div>
      </div>
    </div>

    <!-- ─── View Tabs + Filters bar ─── -->
    <div class="fsp-filter-bar">
      <SelectButton v-model="activeView" :options="viewTabs" optionLabel="label" optionValue="id" :allowEmpty="false" class="fsp-view-tabs" />
      <div class="fsp-filter-right">
        <SelectButton v-model="filterScope" :options="scopeOptions" optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
        <Select v-model="filterSubfund" :options="subfundOptions" placeholder="Все субфонды" class="fsp-filter-sel" size="small" />
        <span class="fsp-search-wrap">
          <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
          <InputText v-model="searchQuery" placeholder="Поиск..." size="small" class="fsp-search" />
        </span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: DASHBOARD (overview) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeView === 'dashboard'" class="fsp-dash">

      <!-- Row 1: Summary cards -->
      <div class="fsp-dash-row">
        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-briefcase"></i> Портфель</div>
          <div class="fsp-dc-grid">
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val" style="color:var(--fst-green)">{{ portfolioCount }}</div>
              <div class="fsp-dc-label">компаний</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val" style="color:var(--fst-blue)">{{ fmtMln(totalRealInvested) }} ₽</div>
              <div class="fsp-dc-label">инвестировано</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val" style="color:var(--fst-purple)">{{ fmtMln(totalNAV) }} ₽</div>
              <div class="fsp-dc-label">NAV</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val">{{ avgFundShare }}%</div>
              <div class="fsp-dc-label">ср. доля</div>
            </div>
          </div>
        </div>

        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-search"></i> На рассмотрении</div>
          <div class="fsp-dc-grid">
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val" style="color:var(--fst-brand)">{{ reviewCount }}</div>
              <div class="fsp-dc-label">проектов</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val" style="color:var(--fst-blue)">{{ fmtMln(totalRequestedAmount) }} ₽</div>
              <div class="fsp-dc-label">запрошено</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val">{{ avgReviewTRL }}</div>
              <div class="fsp-dc-label">ср. TRL</div>
            </div>
            <div class="fsp-dc-metric">
              <div class="fsp-dc-val">{{ reviewSubfunds }}</div>
              <div class="fsp-dc-label">субфондов</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Risk heatmap + Subfund breakdown -->
      <div class="fsp-dash-row">
        <!-- Risk heatmap -->
        <div class="fsp-dash-card fsp-dash-card-wide">
          <div class="fsp-dc-title"><i class="pi pi-shield"></i> Тепловая карта рисков</div>
          <div class="fsp-heatmap">
            <div v-for="c in portfolioCompanies" :key="c.id"
              class="fsp-heat-cell" :class="'risk-' + c.riskLevel"
              :title="`${c.name}\nHealth: ${companyHealth(c)}%\nTRL: ${c.trl}`"
              @click="selectCompany(c); activeView = 'monitor'">
              <div class="fsp-heat-name">{{ c.name.slice(0, 12) }}</div>
              <div class="fsp-heat-val">{{ companyHealth(c) }}%</div>
            </div>
          </div>
        </div>

        <!-- Subfund breakdown -->
        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-chart-pie"></i> По субфондам</div>
          <div class="fsp-subfund-list">
            <div v-for="sf in subfundBreakdown" :key="sf.name" class="fsp-sf-row">
              <div class="fsp-sf-name">{{ sf.name }}</div>
              <div class="fsp-sf-bar-wrap">
                <div class="fsp-sf-bar" :style="{ width: sf.pct + '%', background: sf.color }"></div>
              </div>
              <div class="fsp-sf-count">{{ sf.count }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Top companies by metrics -->
      <div class="fsp-dash-row">
        <!-- Top by investment -->
        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-wallet"></i> Топ по инвестициям</div>
          <div class="fsp-top-list">
            <div v-for="c in topByInvestment" :key="c.id" class="fsp-top-row"
              @click="selectCompany(c); activeView = 'monitor'">
              <span class="fsp-top-name">{{ c.name }}</span>
              <span class="fsp-top-val" style="color:var(--fst-blue)">{{ fmtMln(c.totalInvestment) }} ₽</span>
            </div>
          </div>
        </div>

        <!-- Top by revenue -->
        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-chart-bar"></i> Топ по выручке</div>
          <div class="fsp-top-list">
            <div v-for="c in topByRevenue" :key="c.id" class="fsp-top-row"
              @click="selectCompany(c); activeView = 'monitor'">
              <span class="fsp-top-name">{{ c.name }}</span>
              <span class="fsp-top-val" style="color:var(--fst-green)">{{ fmtMln(c.revenue) }} ₽</span>
            </div>
          </div>
        </div>

        <!-- Top by valuation -->
        <div class="fsp-dash-card">
          <div class="fsp-dc-title"><i class="pi pi-star"></i> Топ по оценке</div>
          <div class="fsp-top-list">
            <div v-for="c in topByValuation" :key="c.id" class="fsp-top-row"
              @click="selectCompany(c); activeView = 'monitor'">
              <span class="fsp-top-name">{{ c.name }}</span>
              <span class="fsp-top-val" style="color:var(--fst-purple)">{{ fmtMln(c.postMoney) }} ₽</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 4: Event ontology overview -->
      <div class="fsp-dash-card" style="grid-column: 1/-1">
        <div class="fsp-dc-title"><i class="pi pi-sitemap"></i> Событийная онтология — портфельные блоки</div>
        <div class="fsp-ontology-grid">
          <div v-for="block in ontologyBlocks" :key="block.phase" class="fsp-onto-block">
            <div class="fsp-onto-phase" :style="{ borderColor: block.color }">{{ block.phase }}</div>
            <div class="fsp-onto-events">
              <div v-for="ev in block.events" :key="ev.id" class="fsp-onto-event"
                :title="`${ev.label}\nСубъект: ${ev.subject}\nОбъект: ${ev.object}`">
                <i :class="ev.icon" :style="{ color: ev.color, fontSize: '11px' }"></i>
                <span>{{ ev.label }}</span>
                <span v-if="ev.count" class="fsp-onto-count">{{ ev.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: PIPELINE (funnel) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeView === 'pipeline'" class="fsp-view-panel">
      <div class="fst-section-label" style="margin-bottom:12px">Воронка: от заявки до портфеля</div>
      <div class="fsp-pipeline">
        <div v-for="stage in pipelineStages" :key="stage.id" class="fsp-pipe-stage">
          <div class="fsp-pipe-header" :style="{ borderBottomColor: stage.color }">
            <i :class="stage.icon" :style="{ color: stage.color }"></i>
            <span class="fsp-pipe-title">{{ stage.label }}</span>
            <span class="fsp-pipe-count" :style="{ background: stage.color }">{{ stage.companies.length }}</span>
          </div>
          <div class="fsp-pipe-cards">
            <div v-for="c in stage.companies" :key="c.id" class="fsp-pipe-card"
              @click="selectCompany(c); activeView = 'monitor'">
              <div class="fsp-pipe-card-name">{{ c.name }}</div>
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

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: Finance Table -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeView === 'finance'" class="fsp-view-panel">
      <div class="fst-section-label" style="margin-bottom:10px">Финансовые показатели (тыс. ₽)</div>
      <DataTable :value="financeTableData" size="small" stripedRows scrollable scrollHeight="520px"
                 sortField="totalInvestment" :sortOrder="-1" class="fsp-datatable">
        <Column field="name" header="Компания" :sortable="true" frozen style="min-width:180px">
          <template #body="{ data }">
            <span class="fsp-dt-name" @click="selectCompanyById(data.id)">{{ data.name }}</span>
            <div class="fsp-dt-sub">{{ data.subfund }} · {{ data.statusLabel }}</div>
          </template>
        </Column>
        <Column field="totalInvestment" header="Инвестиции" :sortable="true" style="min-width:110px">
          <template #body="{ data }">
            <span style="font-weight:600;color:var(--fst-blue)">{{ fmtMln(data.totalInvestment) }}</span>
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
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: Valuations -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeView === 'valuations'" class="fsp-view-panel">
      <div class="fst-section-label" style="margin-bottom:10px">Доли фонда и оценки компаний</div>
      <DataTable :value="valuationsTableData" size="small" stripedRows scrollable scrollHeight="520px"
                 sortField="fundShare" :sortOrder="-1" class="fsp-datatable">
        <Column field="name" header="Компания" :sortable="true" frozen style="min-width:180px">
          <template #body="{ data }">
            <span class="fsp-dt-name" @click="selectCompanyById(data.id)">{{ data.name }}</span>
            <div class="fsp-dt-sub">{{ data.subfund }}</div>
          </template>
        </Column>
        <Column field="fundShare" header="Доля %" :sortable="true" style="min-width:80px">
          <template #body="{ data }">
            <span v-if="data.fundShare" style="font-weight:700;color:var(--fst-purple)">{{ data.fundShare }}%</span>
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
            <span v-if="data.navEstimate" style="font-weight:600;color:var(--fst-green)">{{ fmtMln(data.navEstimate) }} ₽</span>
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

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: AI Chat -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeView === 'chat'" class="fsp-view-panel fsp-chat-panel">
      <div class="fst-section-label" style="margin-bottom:10px">AI Аналитик портфеля</div>
      <div class="fsp-chat-hint">
        Задайте вопрос — аналитик ответит на основе реальных данных из Integram.
        Примеры: «Какая компания самая дорогая?», «Сравни портфель и проекты на рассмотрении», «Риски по субфонду БАС»
      </div>
      <div class="fsp-chat-messages">
        <div v-for="(msg, idx) in chatMessages" :key="idx" class="fsp-chat-msg" :class="msg.role">
          <div class="fsp-chat-msg-role">{{ msg.role === 'user' ? 'Вы' : 'AI Аналитик' }}</div>
          <div class="fsp-chat-msg-text" v-html="formatChatText(msg.text)"></div>
        </div>
        <div v-if="chatLoading" class="fsp-chat-msg assistant">
          <div class="fsp-chat-msg-role">AI Аналитик</div>
          <div class="fsp-chat-msg-text" style="color:var(--p-text-muted-color)">Анализирую данные...</div>
        </div>
      </div>
      <div class="fsp-chat-input-row">
        <Textarea v-model="chatInput" placeholder="Вопрос о портфеле..." rows="1" autoResize
                  @keydown.enter.exact.prevent="sendChatMessage" class="fsp-chat-input" />
        <Button icon="pi pi-send" size="small" @click="sendChatMessage" :loading="chatLoading" :disabled="!chatInput.trim()" />
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- VIEW: Monitor (company detail) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <div v-else class="fsp-body">

      <!-- Left: Company Cards -->
      <div class="fsp-companies">
        <div class="fst-section-label fsp-companies-label">
          {{ filterScope === 'all' ? 'Все компании' : filterScope === 'portfolio' ? 'Портфельные компании' : 'На рассмотрении' }}
          <span style="font-weight:400;color:var(--p-text-muted-color)"> ({{ filteredCompanies.length }})</span>
        </div>

        <!-- Alert banner -->
        <div v-if="criticalAlerts.length" class="fsp-alert-banner">
          <i class="pi pi-exclamation-triangle" style="color:var(--fst-red);font-size:14px"></i>
          <span><b>Критические риски:</b> {{ criticalAlerts.map(a => a.company).join(', ') }}</span>
          <Button label="Созвать ИК" icon="pi pi-users" size="small" severity="danger" @click="callCommittee" style="margin-left:auto" />
        </div>

        <!-- Grid of cards -->
        <div class="fsp-cards-grid">
          <div v-for="c in filteredCompanies" :key="c.id"
            class="fsp-card" :class="{ selected: selectedCompany?.id === c.id, ['risk-' + c.riskLevel]: true, 'is-review': c._scope === 'review' }"
            @click="selectCompany(c)">
            <div class="fsp-card-header">
              <div class="fsp-card-name">{{ c.name }}</div>
              <div class="fsp-card-badges">
                <Tag v-if="c._scope === 'review'" value="ИК" style="font-size:9px;background:var(--fst-brand);color:white" />
                <Tag :value="c.subfund" style="font-size:9px;background:var(--fst-blue);color:white" />
                <div class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" :title="riskLabel(c.riskLevel)"></div>
              </div>
            </div>
            <div class="fsp-card-stage">{{ c.stage }}{{ c.inn ? ' · ' + c.inn : '' }}</div>
            <div class="fsp-card-metrics">
              <div class="fsp-card-metric">
                <span class="fsp-m-label">{{ c._scope === 'review' ? 'Запрос' : 'Инвестиции' }}</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.invested ? c.invested + 'М' : '—' }}</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">{{ c._scope === 'review' ? 'Команда' : 'Доля ФСТ' }}</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-purple)' }">{{ c._scope === 'review' ? (c.headcount || '—') : (c.fstShare ? c.fstShare + '%' : '—') }}</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">TRL</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.trl || '—' }}</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Выручка</span>
                <span class="fsp-m-val" :style="{ color: c.revenue > 0 ? 'var(--fst-green)' : 'var(--p-text-muted-color)' }">{{ c.revenue ? c.revenue + 'М' : '—' }}</span>
              </div>
            </div>
            <div class="fsp-health-bar-wrap">
              <div class="fsp-health-bar" :style="{ width: companyHealth(c) + '%', background: companyHealthBarColor(c) }"></div>
              <span class="fsp-health-val">{{ companyHealth(c) }}%</span>
            </div>
            <div class="fsp-card-footer-actions">
              <button class="fsp-hist-btn" @click.stop="openProjectHub(c)">
                <i class="pi pi-history" style="font-size:10px"></i> История
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
              <div class="fsp-detail-name">{{ selectedCompany.name }}</div>
              <div class="fsp-detail-sub">
                {{ selectedCompany.inn ? selectedCompany.inn + ' · ' : '' }}{{ selectedCompany.stage }} · {{ selectedCompany.subfund }}
                <Tag v-if="selectedCompany._scope === 'review'" value="На рассмотрении" severity="warn" style="font-size:9px;margin-left:4px" />
                <Tag v-else value="Портфель" severity="success" style="font-size:9px;margin-left:4px" />
              </div>
            </div>
            <div class="fsp-detail-health-badge" :style="{ background: companyHealthBarColor(selectedCompany) }">
              {{ companyHealth(selectedCompany) }}%
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
              <div class="fsp-rm-dyn-title">Динамика выручки</div>
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

      <!-- Empty state -->
      <div v-else class="fsp-detail fsp-detail-empty">
        <i class="pi pi-arrow-left" style="font-size:24px;color:var(--p-text-muted-color)"></i>
        <div>Выберите компанию</div>
      </div>

    </div>

    <!-- Page Tutor -->
    <PageTutorButton pageId="fst-portfolio" :getContext="getPageContext" />

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useProjectStore } from '@/stores/projectStore.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { getProjects, STATUS_PORTFOLIO } from '@/services/fstApi'
import { fetchAllCompanyMetrics, summarizeMetrics, fmtMln } from '@/services/portfolioMetricsApi.js'
import PageTutorButton from '@/components/PageTutorButton.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import CausalExplanation from '@/components/ontology/CausalExplanation.vue'
import EntityLinksPanel from '@/components/links/EntityLinksPanel.vue'
import { useEventStore } from '@/stores/eventStore.js'
import { PORTFOLIO_EVENT_TYPES, DEAL_EVENT_TYPES, FUND_EVENT_TYPES, getEventDef } from '@/config/eventRegistry.js'
import { buildPortfolioContext } from '@/services/ontologyContextBuilder.js'
import { companyHealthScore, healthToColor } from '@/services/portfolioHealth.js'

const toast = useToast()
const eventStore = useEventStore()
const router = useRouter()
const projStore = useProjectStore()

// Status IDs from Integram
const STATUS_REVIEW = '1117'   // На рассмотрении ИК

// ── View tabs ─────────────────────────────────────────────────────────────────
const activeView = ref('dashboard')
const viewTabs = [
  { label: 'Дашборд',       id: 'dashboard' },
  { label: 'Монитор',       id: 'monitor' },
  { label: 'Воронка',       id: 'pipeline' },
  { label: 'Финансы',       id: 'finance' },
  { label: 'Оценки',        id: 'valuations' },
  { label: 'AI Аналитик',   id: 'chat' },
]

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
const STAGE_MAP = { '1102': 'Pre-seed', '1103': 'Посевная', '1104': 'Раунд A', '1105': 'Раунд B', '1106': 'Раунд C' }

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
    if (searchQuery.value && !c.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
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
  allCompanies.value.filter(c => c.riskLevel === 'red').map(c => ({ company: c.name }))
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

// ── Pipeline stages ──────────────────────────────────────────────────────────
const pipelineStages = computed(() => {
  const stages = [
    { id: 'review', label: 'На рассмотрении', icon: 'pi pi-inbox', color: 'var(--fst-brand)', companies: [] },
    { id: 'preseed', label: 'Pre-seed', icon: 'pi pi-seedling', color: 'var(--fst-cyan)', companies: [] },
    { id: 'seed', label: 'Посевная', icon: 'pi pi-sun', color: 'var(--fst-blue)', companies: [] },
    { id: 'roundA', label: 'Раунд A+', icon: 'pi pi-bolt', color: 'var(--fst-green)', companies: [] },
    { id: 'growth', label: 'Рост / Масштаб', icon: 'pi pi-chart-line', color: 'var(--fst-purple)', companies: [] },
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
      id: c.id, name: c.name, subfund: c.subfund,
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
      id: c.id, name: c.name, subfund: c.subfund,
      fundShare: m?.fundShare || 0, preMoney: m?.preMoney || 0,
      postMoney: m?.postMoney || 0, totalInvestment: m?.totalInvestment || 0,
      trl: m?.trl || c.trl || 0, headcount: m?.headcount || 0,
      navEstimate: m?.postMoney && m?.fundShare ? Math.round(m.postMoney * m.fundShare / 100) : 0,
    }
  })
})

// ── AI Chat ──────────────────────────────────────────────────────────────────
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
    const parts = [`${c.name} (${c.subfund}, ${c._scope === 'review' ? 'на рассмотрении' : 'портфель'})`]
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
  }
}

async function loadPortfolioFromDb() {
  portfolioLoading.value = true
  try {
    // Load all projects ONCE, then filter client-side (avoids duplicate Integram requests)
    const allRows = await getProjects()
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

    toast.add({ severity: 'success', summary: `${portfolioRows.length} в портфеле + ${reviewRows.length} на рассмотрении`, life: 2000 })
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
})
onUnmounted(() => clearInterval(liveTimer))

// Init event timelines when data loads
watch(allCompanies, (list) => {
  for (const c of list) {
    const k = `company:${c.id}`
    if (!eventStore.timelines[k]) ensureCompanyTimeline(c)
  }
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
  if (activeView.value === 'dashboard' || activeView.value === 'pipeline') activeView.value = 'monitor'
  await ensureCompanyTimeline(c)
}
function selectCompanyById(id) {
  const c = allCompanies.value.find(x => x.id === id)
  if (c) selectCompany(c)
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
</script>

<style scoped>
/* ─── Topbar ─── */
.fsp-title-group { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--p-text-color); }
.fsp-live-dot { font-size: 8px; }
.fsp-fund-name { font-size: 14px; }
.fsp-tag { font-size: 11px !important; }
.fsp-updated { font-size: 10px; color: var(--p-text-muted-color); margin-top: 2px; }

/* ─── Metrics strip ─── */
.fsp-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }

/* ─── Filters bar ─── */
.fsp-filter-bar { display: flex; align-items: center; gap: 8px; padding: 12px 0; flex-wrap: wrap; }
.fsp-filter-sel { width: 130px; }
.fsp-search-wrap { position: relative; display: flex; align-items: center; }
.fsp-search-wrap i { position: absolute; left: 8px; }
.fsp-search { padding-left: 26px !important; width: 160px; }
.fsp-view-tabs { flex-shrink: 0; }
.fsp-view-tabs :deep(.p-button) { font-size: 11px !important; padding: 5px 10px !important; }
.fsp-filter-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

/* ═══ Dashboard ═══ */
.fsp-dash { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
.fsp-dash-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.fsp-dash-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 16px;
}
.fsp-dash-card-wide { grid-column: span 2; }
.fsp-dc-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--p-text-muted-color); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
}
.fsp-dc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.fsp-dc-metric { text-align: center; }
.fsp-dc-val { font-size: 18px; font-weight: 700; color: var(--p-text-color); line-height: 1.2; }
.fsp-dc-label { font-size: 10px; color: var(--p-text-muted-color); margin-top: 2px; }

/* Heatmap */
.fsp-heatmap { display: flex; flex-wrap: wrap; gap: 6px; }
.fsp-heat-cell {
  width: 80px; padding: 8px 6px; border-radius: 6px; cursor: pointer;
  text-align: center; transition: transform 0.15s;
  border: 1px solid var(--p-content-border-color);
}
.fsp-heat-cell:hover { transform: scale(1.05); }
.fsp-heat-cell.risk-green  { background: color-mix(in srgb, var(--fst-green) 15%, transparent); }
.fsp-heat-cell.risk-yellow { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); }
.fsp-heat-cell.risk-red    { background: color-mix(in srgb, var(--fst-red) 15%, transparent); }
.fsp-heat-name { font-size: 9px; color: var(--p-text-color); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-heat-val { font-size: 12px; font-weight: 700; color: var(--p-text-color); margin-top: 2px; }

/* Subfund breakdown */
.fsp-subfund-list { display: flex; flex-direction: column; gap: 6px; }
.fsp-sf-row { display: flex; align-items: center; gap: 8px; }
.fsp-sf-name { font-size: 11px; color: var(--p-text-color); width: 100px; flex-shrink: 0; }
.fsp-sf-bar-wrap { flex: 1; height: 8px; background: var(--p-content-border-color); border-radius: 4px; overflow: hidden; }
.fsp-sf-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
.fsp-sf-count { font-size: 12px; font-weight: 700; color: var(--p-text-color); width: 24px; text-align: right; }

/* Top lists */
.fsp-top-list { display: flex; flex-direction: column; gap: 4px; }
.fsp-top-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s;
}
.fsp-top-row:hover { background: var(--p-surface-ground); }
.fsp-top-name { font-size: 12px; color: var(--p-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.fsp-top-val { font-size: 12px; font-weight: 700; flex-shrink: 0; margin-left: 8px; }

/* Ontology blocks */
.fsp-ontology-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.fsp-onto-block {
  flex: 1; min-width: 180px;
  background: var(--p-surface-ground); border-radius: 8px; padding: 10px;
}
.fsp-onto-phase {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--p-text-muted-color); margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 2px solid var(--p-content-border-color);
}
.fsp-onto-events { display: flex; flex-direction: column; gap: 3px; }
.fsp-onto-event {
  display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--p-text-color);
  padding: 2px 4px; border-radius: 3px; cursor: default;
}
.fsp-onto-event:hover { background: var(--p-surface-card); }
.fsp-onto-count {
  margin-left: auto; font-size: 9px; font-weight: 700;
  background: var(--p-primary-color); color: white; border-radius: 8px; padding: 0 4px;
}

/* ═══ Pipeline ═══ */
.fsp-pipeline { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
.fsp-pipe-stage { flex: 1; min-width: 180px; }
.fsp-pipe-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; margin-bottom: 8px;
  border-bottom: 3px solid var(--p-content-border-color);
}
.fsp-pipe-title { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.fsp-pipe-count {
  margin-left: auto; font-size: 11px; font-weight: 700; color: white;
  border-radius: 10px; padding: 1px 7px;
}
.fsp-pipe-cards { display: flex; flex-direction: column; gap: 6px; }
.fsp-pipe-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 6px; padding: 8px 10px; cursor: pointer; transition: border-color 0.15s;
}
.fsp-pipe-card:hover { border-color: var(--p-primary-color); }
.fsp-pipe-card-name { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.fsp-pipe-card-meta { font-size: 10px; color: var(--p-text-muted-color); display: flex; gap: 8px; margin-top: 2px; }
.fsp-pipe-empty { font-size: 11px; color: var(--p-text-muted-color); text-align: center; padding: 12px; }

/* ═══ View panels ═══ */
.fsp-view-panel {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 16px;
  background: var(--p-surface-card); min-height: 300px;
}

/* ═══ Monitor body ═══ */
.fsp-body {
  display: grid; grid-template-columns: 1fr 380px; gap: 0;
  min-height: 0; border: 1px solid var(--p-content-border-color);
  border-radius: 8px; overflow: hidden;
}
.fsp-companies { overflow-y: auto; padding: 12px; }
.fsp-companies-label { margin-bottom: 10px; }

/* Alert banner */
.fsp-alert-banner {
  display: flex; align-items: center; gap: 10px;
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 40%, transparent);
  border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;
  font-size: 12px; color: var(--p-text-color); flex-wrap: wrap;
}

/* Cards grid */
.fsp-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }

/* Card */
.fsp-card {
  background: transparent; border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.15s; position: relative;
}
.fsp-card:hover { border-color: var(--p-primary-color); }
.fsp-card.selected { border-color: var(--p-primary-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 20%, transparent); }
.fsp-card.risk-red    { border-left: 3px solid var(--fst-red); }
.fsp-card.risk-yellow { border-left: 3px solid var(--fst-brand); }
.fsp-card.risk-green  { border-left: 3px solid var(--fst-green); }
.fsp-card.is-review   { border-style: dashed; }

.fsp-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.fsp-card-name { font-weight: 600; font-size: 13px; color: var(--p-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.fsp-card-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.fsp-traffic-light { width: 10px; height: 10px; border-radius: 50%; }
.fsp-card-stage { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 8px; }
.fsp-card-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; }
.fsp-card-metric { text-align: center; }
.fsp-m-label { font-size: 9px; color: var(--p-text-muted-color); display: block; }
.fsp-m-val { font-size: 13px; font-weight: 600; }
.fsp-health-bar-wrap { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; position: relative; margin-bottom: 6px; }
.fsp-health-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-health-val { position: absolute; right: 0; top: -14px; font-size: 10px; color: var(--p-text-muted-color); }

.fsp-card-footer-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.fsp-hist-btn {
  background: none; border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 2px 8px; font-size: 10px; color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; gap: 4px; transition: background .15s, color .15s;
}
.fsp-hist-btn:hover { background: var(--p-surface-ground); color: var(--p-text-color); }

/* Detail panel */
.fsp-detail {
  border-left: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 12px; background: var(--p-surface-ground);
}
.fsp-detail-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--p-text-muted-color); font-size: 13px; min-height: 200px;
}
.fsp-detail-panel {
  background: transparent; border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 12px; margin-bottom: 10px;
}
.fsp-detail-panel-title {
  display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600;
  color: var(--p-text-color); margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-detail-company-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.fsp-detail-name { font-size: 14px; font-weight: 700; color: var(--p-text-color); }
.fsp-detail-sub { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.fsp-detail-health-badge {
  width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
}

/* KPI */
.fsp-kpi-section { display: flex; flex-direction: column; gap: 6px; }
.fsp-kpi-row { display: flex; align-items: center; gap: 8px; }
.fsp-kpi-label { font-size: 11px; color: var(--p-text-muted-color); width: 70px; flex-shrink: 0; }
.fsp-kpi-bar-wrap { flex: 1; height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-kpi-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-kpi-nums { font-size: 11px; width: 90px; text-align: right; flex-shrink: 0; }

/* Real Metrics */
.fsp-real-metrics { display: flex; flex-direction: column; gap: 4px; }
.fsp-rm-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-rm-row:last-child { border-bottom: none; }
.fsp-rm-label { font-size: 11px; color: var(--p-text-muted-color); }
.fsp-rm-val { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.fsp-rm-dynamics { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--p-content-border-color); }
.fsp-rm-dyn-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); margin-bottom: 6px; }
.fsp-rm-dyn-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.fsp-rm-dyn-year { font-size: 10px; color: var(--p-text-muted-color); width: 32px; flex-shrink: 0; }
.fsp-rm-dyn-bar-wrap { flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fsp-rm-dyn-bar { height: 100%; background: var(--fst-green); border-radius: 3px; transition: width 0.3s; }
.fsp-rm-dyn-val { font-size: 10px; font-weight: 600; color: var(--fst-green); width: 48px; text-align: right; }

/* Events */
.fsp-events { display: flex; flex-direction: column; gap: 6px; }
.fsp-tl-count { background: var(--p-primary-color); color: white; border-radius: 10px; padding: 0 5px; font-size: 10px; }
.fsp-add-event-dialog { margin-top: 0.6rem; padding: 0.6rem; background: var(--p-surface-ground); border-radius: 8px; border: 1px solid var(--p-content-border-color); }
.fsp-aed-title { font-size: 0.78rem; font-weight: 600; color: var(--p-text-color); margin-bottom: 0.4rem; }
.fsp-event { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fsp-event:last-child { border-bottom: none; }
.fsp-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-event-body { flex: 1; }
.fsp-event-title { font-size: 12px; color: var(--p-text-color); }
.fsp-event-date { font-size: 10px; color: var(--p-text-muted-color); }

/* Nav */
.fsp-detail-nav { display: flex; gap: 8px; justify-content: center; }

/* DataTable */
.fsp-datatable { font-size: 12px; }
.fsp-dt-name { font-weight: 600; color: var(--p-primary-color); cursor: pointer; }
.fsp-dt-name:hover { text-decoration: underline; }
.fsp-dt-sub { font-size: 10px; color: var(--p-text-muted-color); }

/* Chat */
.fsp-chat-panel { display: flex; flex-direction: column; }
.fsp-chat-hint { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 12px; line-height: 1.5; }
.fsp-chat-messages {
  flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 12px; padding: 8px; background: var(--p-surface-ground);
  border-radius: 8px; border: 1px solid var(--p-content-border-color); min-height: 120px;
}
.fsp-chat-msg { padding: 8px 12px; border-radius: 8px; max-width: 85%; }
.fsp-chat-msg.user { background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); align-self: flex-end; }
.fsp-chat-msg.assistant { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); align-self: flex-start; }
.fsp-chat-msg-role { font-size: 10px; font-weight: 600; color: var(--p-text-muted-color); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.fsp-chat-msg-text { font-size: 12px; color: var(--p-text-color); line-height: 1.6; }
.fsp-chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
.fsp-chat-input { flex: 1; font-size: 12px; }

/* Responsive */
@media (max-width: 900px) {
  .fsp-body { grid-template-columns: 1fr !important; }
  .fsp-detail { border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-detail-empty { display: none; }
  .fsp-dash-card-wide { grid-column: span 1; }
  .fsp-pipeline { flex-direction: column; }
}
</style>

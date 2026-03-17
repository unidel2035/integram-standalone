<template>
  <FstPageLayout
    title="Портфель фонда"
    subtitle="Мониторинг здоровья портфельных компаний"
  >
    <!-- ─── Topbar left: title + status ─── -->
    <template #header>
      <div class="fsp-title-group">
        <i class="pi pi-circle-fill fsp-live-dot" :style="{ color: liveColor }"></i>
        <span class="fsp-fund-name">ФСТ НТИ · <b>Портфельный монитор</b></span>
        <Tag :value="`${activeCount} активных`" severity="success" class="fsp-tag" />
        <Tag :value="`${alertCount} предупреждений`" :severity="alertCount > 0 ? 'warn' : 'secondary'" class="fsp-tag" />
      </div>
      <div class="fsp-updated">
        Обновлено: {{ lastUpdate }} · Мониторинг {{ monitoringStatus }}
      </div>
    </template>

    <!-- ─── Topbar right: actions ─── -->
    <template #actions>
      <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="refreshAll" :loading="refreshing" />
      <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="showAddDialog = true" />
      <Button icon="pi pi-building" label="ЦД Фонда" size="small" severity="secondary" text @click="$router.push('/fst-fund')" />
    </template>

    <!-- ─── KPI metrics strip ─── -->
    <div class="fsp-metrics fst-metrics-strip">
      <div v-for="m in portfolioMetrics" :key="m.label" class="fst-metric-item">
        <i :class="m.icon" class="fst-metric-item-icon" :style="{ color: m.color }"></i>
        <div class="fst-metric-item-val">{{ m.val }}</div>
        <div class="fst-metric-item-label">{{ m.label }}</div>
      </div>
    </div>

    <!-- ─── View Tabs + Filters bar ─── -->
    <div class="fsp-filter-bar">
      <SelectButton v-model="activeView" :options="viewTabs" optionLabel="label" optionValue="id" :allowEmpty="false" class="fsp-view-tabs" />
      <div class="fsp-filter-right">
        <Select v-model="filterSubfund" :options="subfundOptions" placeholder="Все субфонды" class="fsp-filter-sel" size="small" />
        <span class="fsp-search-wrap">
          <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
          <InputText v-model="searchQuery" placeholder="Поиск компании..." size="small" class="fsp-search" />
        </span>
      </div>
    </div>

    <!-- ═══ VIEW: Finance Table ═══ -->
    <div v-if="activeView === 'finance'" class="fsp-view-panel">
      <div class="fst-section-label" style="margin-bottom:10px">Финансовые показатели портфеля (тыс. ₽)</div>
      <DataTable :value="financeTableData" size="small" stripedRows scrollable scrollHeight="520px"
                 sortField="totalInvestment" :sortOrder="-1" class="fsp-datatable">
        <Column field="name" header="Компания" :sortable="true" frozen style="min-width:180px">
          <template #body="{ data }">
            <span class="fsp-dt-name" @click="selectCompanyById(data.id)">{{ data.name }}</span>
            <div class="fsp-dt-sub">{{ data.subfund }}</div>
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

    <!-- ═══ VIEW: Valuations ═══ -->
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
        <Column field="totalInvestment" header="Инвестиции" :sortable="true" style="min-width:110px">
          <template #body="{ data }">{{ data.totalInvestment ? fmtMln(data.totalInvestment) + ' ₽' : '—' }}</template>
        </Column>
        <Column field="navEstimate" header="NAV (оценка)" :sortable="true" style="min-width:110px">
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
        <Column field="salesUnits" header="Продажи шт." :sortable="true" style="min-width:90px">
          <template #body="{ data }">{{ data.salesUnits || '—' }}</template>
        </Column>
      </DataTable>
    </div>

    <!-- ═══ VIEW: AI Chat ═══ -->
    <div v-else-if="activeView === 'chat'" class="fsp-view-panel fsp-chat-panel">
      <div class="fst-section-label" style="margin-bottom:10px">AI Аналитик портфеля</div>
      <div class="fsp-chat-hint">
        Задайте вопрос о портфеле — аналитик ответит на основе реальных данных из Integram.
        Примеры: «Какая компания самая дорогая?», «Где самый высокий IRR?», «Суммарные инвестиции по субфондам»
      </div>
      <div class="fsp-chat-messages">
        <div v-for="(msg, idx) in chatMessages" :key="idx" class="fsp-chat-msg" :class="msg.role">
          <div class="fsp-chat-msg-role">{{ msg.role === 'user' ? 'Вы' : 'AI Аналитик' }}</div>
          <div class="fsp-chat-msg-text" v-html="formatChatText(msg.text)"></div>
        </div>
        <div v-if="chatLoading" class="fsp-chat-msg assistant">
          <div class="fsp-chat-msg-role">AI Аналитик</div>
          <div class="fsp-chat-msg-text" style="color:var(--p-text-muted-color)">Анализирую данные портфеля...</div>
        </div>
      </div>
      <div class="fsp-chat-input-row">
        <Textarea v-model="chatInput" placeholder="Вопрос о портфеле..." rows="1" autoResize
                  @keydown.enter.exact.prevent="sendChatMessage" class="fsp-chat-input" />
        <Button icon="pi pi-send" size="small" @click="sendChatMessage" :loading="chatLoading" :disabled="!chatInput.trim()" />
      </div>
    </div>

    <!-- ═══ VIEW: Monitor (default) ═══ -->
    <div v-else class="fsp-body">

      <!-- Left: Company Cards -->
      <div class="fsp-companies">
        <div class="fst-section-label fsp-companies-label">Портфельные компании</div>

        <!-- Alert banner -->
        <div v-if="criticalAlerts.length" class="fsp-alert-banner">
          <i class="pi pi-exclamation-triangle" style="color:var(--fst-red);font-size:14px"></i>
          <span><b>Критические риски:</b> {{ criticalAlerts.map(a => a.company).join(', ') }} — требуется внимание</span>
          <Button label="Созвать ИК" icon="pi pi-users" size="small" severity="danger" @click="callCommittee" style="margin-left:auto" />
        </div>

        <!-- Grid of cards -->
        <div class="fsp-cards-grid">
          <div v-for="(c, cIdx) in filteredCompanies" :key="c.id"
            class="fsp-card" :class="{ selected: selectedCompany?.id === c.id, ['risk-' + c.riskLevel]: true }"
            @click="selectCompany(c)">
            <div class="fsp-card-header">
              <div class="fsp-card-name">{{ c.name }}</div>
              <div class="fsp-card-badges">
                <Tag :value="c.subfund" style="font-size:10px;background:var(--fst-blue);color:white" />
                <FeatureHint
                  v-if="cIdx === 0"
                  id="portfolio-traffic-light"
                  title="Светофор рисков"
                  description="Цвет индикатора показывает уровень риска компании: зелёный — норма, жёлтый — требует внимания, красный — критический риск"
                  position="bottom"
                >
                  <div class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" :title="riskLabel(c.riskLevel)"></div>
                </FeatureHint>
                <div v-else class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" :title="riskLabel(c.riskLevel)"></div>
              </div>
            </div>
            <div class="fsp-card-stage">{{ c.stage }} · {{ c.inn }}</div>
            <div class="fsp-card-metrics">
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Инвестиции</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.invested ? c.invested + 'М' : '—' }}</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Доля ФСТ</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-purple)' }">{{ c.fstShare ? c.fstShare + '%' : '—' }}</span>
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
            <!-- GR-статус badge -->
            <div class="fsp-gr-badge" v-if="getGrStatus(c).total > 0 || true">
              <span class="fsp-gr-label">GR:</span>
              <span v-if="getGrStatus(c).funded > 0" class="fsp-gr-funded">✓ {{ getGrStatus(c).funded }}</span>
              <span v-if="getGrStatus(c).applied > 0" class="fsp-gr-applied">→ {{ getGrStatus(c).applied }}</span>
              <span v-if="getGrStatus(c).nextMeasure" class="fsp-gr-next">{{ getGrStatus(c).nextMeasure.slice(0, 18) }}…</span>
              <span v-else class="fsp-gr-empty">нет мер</span>
            </div>
            <div v-if="c.alerts.length" class="fsp-card-alerts">
              <div v-for="a in c.alerts.slice(0,2)" :key="a.type" class="fsp-card-alert" :class="a.severity">
                <i :class="alertIcon(a.type)" style="font-size:10px"></i> {{ a.msg }}
              </div>
            </div>
            <div class="fsp-card-footer-actions">
              <button class="fsp-hist-btn" @click.stop="openProjectHub(c)">
                <i class="pi pi-history" style="font-size:10px"></i> История
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Detail + Sources + AI -->
      <div class="fsp-detail" v-if="selectedCompany">

        <!-- Company Header -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-company-header">
            <div>
              <div class="fsp-detail-name">{{ selectedCompany.name }}</div>
              <div class="fsp-detail-sub">{{ selectedCompany.inn }} · {{ selectedCompany.stage }} · Субфонд {{ selectedCompany.subfund }}</div>
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
            <div class="fsp-rm-row" v-if="getMetrics(selectedCompany.id).salesUnits">
              <span class="fsp-rm-label">Продажи</span>
              <span class="fsp-rm-val">{{ getMetrics(selectedCompany.id).salesUnits }} шт.</span>
            </div>
            <!-- Revenue dynamics mini-table -->
            <div v-if="getMetrics(selectedCompany.id).revenueByYear?.length > 1" class="fsp-rm-dynamics">
              <div class="fsp-rm-dyn-title">Выручка по годам</div>
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

        <!-- Links Platform -->
        <div class="fsp-detail-panel">
          <EntityLinksPanel
            :entityId="selectedCompany.id"
            entityType="company"
            :labelMap="conceptLabelMap"
            @link-added="onLinkAdded"
          />
        </div>

        <!-- Data Sources -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-database" style="color:var(--fst-brand)"></i> Источники данных
            <Button icon="pi pi-refresh" size="small" text @click="refreshSources" :loading="sourcesLoading" style="margin-left:auto" />
          </div>
          <div class="fsp-sources-grid">
            <div v-for="src in dataSources" :key="src.id" class="fsp-source" :class="src.status">
              <div class="fsp-source-icon"><i :class="src.icon"></i></div>
              <div class="fsp-source-info">
                <div class="fsp-source-name">{{ src.name }}</div>
                <div class="fsp-source-last">{{ src.lastUpdate }}</div>
              </div>
              <div class="fsp-source-badge">
                <i :class="src.status === 'ok' ? 'pi pi-check-circle' : src.status === 'warn' ? 'pi pi-exclamation-circle' : 'pi pi-times-circle'"
                  :style="{ color: src.status === 'ok' ? 'var(--fst-green)' : src.status === 'warn' ? 'var(--fst-brand)' : 'var(--fst-red)' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Risk Sensors -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-shield" style="color:var(--fst-red)"></i> Датчики рисков
          </div>
          <div class="fsp-risk-sensors">
            <div v-for="sensor in selectedCompany.sensors" :key="sensor.type"
              class="fsp-sensor" :class="sensor.level">
              <div class="fsp-sensor-dot" :style="{ background: sensorColor(sensor.level) }"></div>
              <div class="fsp-sensor-info">
                <div class="fsp-sensor-name">{{ sensor.name }}</div>
                <div class="fsp-sensor-msg">{{ sensor.msg }}</div>
              </div>
              <Tag :value="sensor.level.toUpperCase()" :severity="sensorSeverity(sensor.level)" style="font-size:9px" />
            </div>
          </div>
        </div>

        <!-- Timeline Events (EventStore) -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-history" style="color:var(--fst-cyan)"></i> Лента событий
            <span class="fsp-tl-count">{{ companyTimeline.length }}</span>
            <Button icon="pi pi-plus" size="small" severity="secondary" text
                    style="margin-left:auto" @click="addEventDialog = true" />
          </div>

          <!-- EventStore лента -->
          <div class="fsp-events">
            <div v-for="ev in companyTimeline.slice().reverse()" :key="ev.id" class="fsp-event">
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

          <!-- Диалог добавления события -->
          <div v-if="addEventDialog" class="fsp-add-event-dialog">
            <div class="fsp-aed-title">Добавить событие</div>
            <Select v-model="newEventType" :options="EVENT_TYPE_OPTIONS"
                    option-label="label" option-value="value" style="width:100%;margin-bottom:0.4rem" />
            <InputText v-model="newEventNote" placeholder="Примечание (необязательно)"
                       style="width:100%;margin-bottom:0.4rem" />
            <div style="display:flex;gap:0.4rem">
              <Button label="Добавить" icon="pi pi-check" size="small" @click="addCompanyEvent" />
              <Button label="Отмена" severity="secondary" size="small" @click="addEventDialog=false" />
            </div>
          </div>
        </div>

        <!-- AI Weekly Report -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-brain" style="color:var(--fst-purple)"></i> AI Еженедельный отчёт
            <Button :label="aiReportLoading ? 'Генерация...' : 'Обновить'" icon="pi pi-sparkles" size="small" severity="secondary"
              @click="generateAiReport" :loading="aiReportLoading" style="margin-left:auto" />
          </div>
          <div v-if="aiReport" class="fsp-ai-report">
            <div v-for="section in aiReport" :key="section.title" class="fsp-ai-section">
              <div class="fsp-ai-section-title" :style="{ color: section.color }">
                <i :class="section.icon"></i> {{ section.title }}
              </div>
              <ul class="fsp-ai-list">
                <li v-for="point in section.points" :key="point">{{ point }}</li>
              </ul>
            </div>
          </div>
          <div v-else class="fsp-ai-empty">
            <Button label="Сгенерировать отчёт" icon="pi pi-sparkles" size="small" severity="info" @click="generateAiReport" :loading="aiReportLoading" />
          </div>
        </div>

        <!-- Ontology Next Steps + Causal -->
        <OntologyNextSteps entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:8px" />
        <CausalExplanation entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:10px" />

        <!-- Deal link -->
        <div class="fsp-detail-nav">
          <Button icon="pi pi-file-edit" label="Открыть сделку" severity="info" size="small" @click="$router.push('/fst-deal')" />
          <Button icon="pi pi-list-check" label="Исполнение" severity="success" size="small" @click="$router.push('/fst-execution')" />
          <Button icon="pi pi-chart-line" label="ЦД Компании" severity="secondary" size="small" @click="$router.push('/fst-twin')" />
          <Button icon="pi pi-building" label="GR-план" severity="warning" size="small" @click="$router.push({ path: '/fst-gov', query: { company: selectedCompany.id, tab: 'timeline' } })" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="fsp-detail fsp-detail-empty">
        <i class="pi pi-arrow-left" style="font-size:24px;color:var(--p-text-muted-color)"></i>
        <div>Выберите компанию из портфеля</div>
      </div>

    </div> <!-- close fsp-body / monitor view -->

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
import LearnTooltip from '@/components/LearnTooltip.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import CausalExplanation from '@/components/ontology/CausalExplanation.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import EntityLinksPanel from '@/components/links/EntityLinksPanel.vue'
import { useEventStore } from '@/stores/eventStore.js'
import { PORTFOLIO_EVENT_TYPES, getEventDef } from '@/config/eventRegistry.js'
import { buildEntityContext, buildContextPrompt, buildPortfolioContext } from '@/services/ontologyContextBuilder.js'
import { companyHealthScore, healthToColor } from '@/services/portfolioHealth.js'
import { useGrEventStore } from '@/stores/grEventStore.js'
import { nextPossibleEvents } from '@/services/grEventEngine.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'

const toast = useToast()
const eventStore = useEventStore()
const grEventStore = useGrEventStore()

// ── View tabs ────────────────────────────────────────────────────────────────
const activeView = ref('monitor')
const viewTabs = [
  { label: 'Монитор',     id: 'monitor' },
  { label: 'Финансы',     id: 'finance' },
  { label: 'Доли / Оценки', id: 'valuations' },
  { label: 'AI Аналитик', id: 'chat' },
]

// ── Metrics data from Integram type 126255 ────────────────────────────────────
const metricsMap = ref(new Map())     // companyId → summarizeMetrics result
const metricsLoading = ref(false)

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

  // Build context from all companies' metrics
  const ctx = companies.value.map(c => {
    const m = getMetrics(c.id)
    if (!m) return `${c.name}: нет данных`
    const parts = [`${c.name} (${c.subfund})`]
    if (m.totalInvestment) parts.push(`инвестировано: ${fmtMln(m.totalInvestment)} ₽`)
    if (m.fundShare) parts.push(`доля фонда: ${m.fundShare}%`)
    if (m.revenue) parts.push(`выручка ${m.revenueYear}: ${fmtMln(m.revenue)} ₽`)
    if (m.preMoney) parts.push(`pre-money: ${fmtMln(m.preMoney)} ₽`)
    if (m.postMoney) parts.push(`post-money: ${fmtMln(m.postMoney)} ₽`)
    if (m.trl) parts.push(`TRL: ${m.trl}`)
    if (m.headcount) parts.push(`штат: ${m.headcount}`)
    if (m.irr) parts.push(`IRR: ${m.irr}%`)
    if (m.npv) parts.push(`NPV: ${fmtMln(m.npv)} ₽`)
    if (m.salesUnits) parts.push(`продажи: ${m.salesUnits} шт.`)
    if (m.ebitda) parts.push(`EBITDA ${m.ebitdaYear}: ${fmtMln(m.ebitda)} ₽`)
    // Revenue dynamics
    if (m.revenueByYear?.length > 1) {
      parts.push('выручка по годам: ' + m.revenueByYear.map(r => `${r.year}=${fmtMln(r.value)}`).join(', '))
    }
    return parts.join('; ')
  }).join('\n')

  const totalInv = companies.value.reduce((s, c) => s + (getMetrics(c.id)?.totalInvestment || 0), 0)
  const systemPrompt = `Ты — AI-аналитик венчурного фонда ФСТ НТИ. Отвечай по существу, опираясь на реальные данные портфеля.
Все суммы в тыс. руб. если не указано иное. Фонд инвестировал суммарно ${fmtMln(totalInv)} ₽ в ${companies.value.length} компаний.

Данные портфеля:
${ctx}

Отвечай кратко, структурированно, с цифрами. Если данных нет — скажи прямо.`

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

// ── Finance table computed ───────────────────────────────────────────────────
const financeTableData = computed(() => {
  return filteredCompanies.value.map(c => {
    const m = getMetrics(c.id)
    return {
      id: c.id,
      name: c.name,
      subfund: c.subfund,
      revenue: m?.revenue || 0,
      revenueYear: m?.revenueYear || '—',
      ebitda: m?.ebitda || 0,
      totalInvestment: m?.totalInvestment || 0,
      npv: m?.npv || 0,
      irr: m?.irr || 0,
      cashflow: m?.byKey?.cashflow?.[0]?.value || 0,
    }
  })
})

// ── Valuations table computed ────────────────────────────────────────────────
const valuationsTableData = computed(() => {
  return filteredCompanies.value.map(c => {
    const m = getMetrics(c.id)
    return {
      id: c.id,
      name: c.name,
      subfund: c.subfund,
      fundShare: m?.fundShare || 0,
      preMoney: m?.preMoney || 0,
      postMoney: m?.postMoney || 0,
      totalInvestment: m?.totalInvestment || 0,
      trl: m?.trl || c.trl || 0,
      headcount: m?.headcount || 0,
      salesUnits: m?.salesUnits || 0,
      // NAV estimate = postMoney × fundShare / 100
      navEstimate: m?.postMoney && m?.fundShare ? Math.round(m.postMoney * m.fundShare / 100) : 0,
    }
  })
})

// ── Динамический health score из онтологии событий (issue #186) ───────────────
// Возвращает карту { companyId → score } реактивно через eventStore.timelines
const liveHealthScores = computed(() => {
  const scores = {}
  for (const company of companies.value) {
    const id = String(company.id)
    const timeline = eventStore.getTimeline('company', id)
    scores[company.id] = companyHealthScore(timeline)
  }
  return scores
})

function companyHealth(company) {
  const live = liveHealthScores.value[company.id]
  // Если есть события — используем живой score, иначе статичный из данных
  return live > 0 ? live : (company.health ?? 50)
}

function companyHealthBarColor(company) {
  const score = companyHealth(company)
  return healthToColor(score)
}

// GR-статус каждой компании
function getGrStatus(company) {
  const id = String(company.id)
  const timeline = grEventStore.getTimeline(id)
  const applied = timeline.filter(e => e.type === 'MEASURE_APPLIED').length
  const funded = timeline.filter(e => e.type === 'MEASURE_FUNDED').length
  const possible = nextPossibleEvents(timeline, GR_MEASURES)
  const nextHigh = possible.find(p => p.probability === 'high')
  return { applied, funded, total: timeline.length, nextMeasure: nextHigh?.measure?.name || nextHigh?.eventDef?.label || null }
}

// ─── EventStore: инициализация и работа с лентой компании ────────────────────

// Преобразовать статичные события компании в типизированные события реестра
const TYPE_MAP = {
  'Контракт': 'CONTRACT_SIGNED',
  'Финансы':  'TRANCHE_RELEASED',
  'Найм':     'TEAM_CHANGE',
  'IP':       'PRODUCT_LAUNCH',
  'Риск':     'RISK_ELEVATED',
}

async function ensureCompanyTimeline(company) {
  if (!company) return
  // Сначала тянем из Integram (если были события в прошлых сессиях)
  await eventStore.load('company', String(company.id))
  const existing = eventStore.getTimeline('company', String(company.id))
  if (existing.length) return // данные загружены из Integram — не перетираем

  // Ничего не загрузилось → инициализируем из статичных данных компании
  eventStore.add('company', String(company.id), 'COMPANY_ADDED', {
    name: company.name, subfund: company.subfund, trl: company.trl, stage: company.stage,
  })
  for (const ev of (company.events || [])) {
    const evType = TYPE_MAP[ev.type] || 'KPI_UPDATED'
    eventStore.add('company', String(company.id), evType, { title: ev.title, date: ev.date, originalType: ev.type })
  }
  if (company.revenue) eventStore.add('company', String(company.id), 'KPI_UPDATED', { revenue: company.revenue, trl: company.trl, runway: company.runway })
  if (company.riskLevel === 'red') eventStore.add('company', String(company.id), 'RISK_ELEVATED', { level: 'critical', auto: true })
}

// Лента событий выбранной компании (из EventStore)
const companyTimeline = computed(() => {
  if (!selectedCompany.value) return []
  return eventStore.getTimeline('company', String(selectedCompany.value.id))
})

// Состояние компании из EventStore
const companyEventState = computed(() => {
  if (!selectedCompany.value) return {}
  return eventStore.getState('company', String(selectedCompany.value.id))
})

// Добавить событие в ленту
const addEventDialog = ref(false)
const newEventType = ref('KPI_UPDATED')
const newEventNote = ref('')
const EVENT_TYPE_OPTIONS = Object.values(PORTFOLIO_EVENT_TYPES).map(e => ({ label: e.label, value: e.id }))

function addCompanyEvent() {
  if (!selectedCompany.value) return
  eventStore.add('company', String(selectedCompany.value.id), newEventType.value, { note: newEventNote.value, manual: true })
  addEventDialog.value = false
  newEventNote.value = ''
  toast.add({ severity: 'success', summary: 'Событие добавлено в ленту', life: 2000 })
}

// ── Links Platform ────────────────────────────────────────────
const conceptLabelMap = ref({})
function onLinkAdded(link) {
  toast.add({ severity: 'success', summary: 'Связь добавлена', life: 2000 })
}

// ── Page Tutor Context ────────────────────────────────────────
function getPageContext() {
  const company = companies.value.find(c => c.id === selectedCompanyId.value)
  // Build portfolio ontology context for all companies
  const companiesData = companies.value.map(c => ({
    entityType: 'company',
    entityId: String(c.id),
    timeline: eventStore.getTimeline('company', String(c.id)),
    state: { name: c.name, health: c.health }
  }))
  return {
    module: 'Портфель компаний',
    selectedCompany: company ? company.name : null,
    totalCompanies: companies.value.length,
    monitoringStatus: monitoringStatus.value,
    ontology: buildPortfolioContext(companiesData)
  }
}

// ─── Live indicator ───────────────────────────────────────────────────────────
const liveColor = ref('var(--fst-green)')
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const monitoringStatus = ref('активен')
let liveTimer = null

// ─── Загрузка из fst API ──────────────────────────────────────────────────────
const portfolioLoading = ref(false)

async function loadPortfolioFromDb() {
  portfolioLoading.value = true
  try {
    // Загружаем реальные компании напрямую из type 1155 со статусом "Портфель"
    const projectRows = await getProjects({ statusId: STATUS_PORTFOLIO })

    const subfundById = {
      '1096': 'БАС', '1098': 'РОБО', '1100': 'МЭ', '7283': 'AI/Tech',
      '124370': 'Фотоника', '124372': 'ФармаМед', '124374': 'Новые материалы',
      '124376': 'SpaceNet', '124378': 'Энерджинет', '124380': 'Агротех',
      '124382': 'Технет', '124384': 'MediaNet'
    }
    const stageById   = { '1102': 'Pre-seed', '1103': 'Посевная', '1104': 'Раунд A', '1105': 'Раунд B', '1106': 'Раунд C' }

    const companyList = projectRows.map(row => ({
      id:        row.id,
      name:      row.name,
      inn:       row.inn || '',
      subfund:   subfundById[String(row.subfundId)] || '—',
      stage:     stageById[String(row.stageId)] || '—',
      health:    50,
      riskLevel: 'green',
      revenue:   0,
      runway:    0,
      trl:       row.trl || 0,
      headcount: row.employees || 0,
      invested:  row.amount || 0,
      nav:       0,
      fstShare:  0,
      kpis:      [{ name: 'TRL', actual: row.trl || 0, target: (row.trl || 0) + 1, unit: 'уровень' }],
      aiReport:  null,
      updatedAt: null,
      alerts:    [],
      sensors:   [],
      events:    [],
    }))
    companies.value = companyList
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')

    // Load real metrics from Integram type 126255 (subordinate to each company)
    await loadMetrics(companyList)

    // Enrich company objects with real metric data
    for (const c of companies.value) {
      const m = getMetrics(c.id)
      if (!m) continue
      if (m.revenue) c.revenue = Math.round(m.revenue / 1000)   // тыс→млн
      if (m.totalInvestment) c.invested = Math.round(m.totalInvestment / 1000)
      if (m.fundShare) c.fstShare = m.fundShare
      if (m.trl) c.trl = m.trl
      if (m.headcount) c.headcount = m.headcount
      if (m.postMoney && m.fundShare) c.nav = Math.round(m.postMoney * m.fundShare / 100 / 1000)
      // Build KPIs from real data
      const kpis = []
      if (m.trl) kpis.push({ name: 'TRL', actual: m.trl, target: Math.min(9, m.trl + 1), unit: 'уровень' })
      if (m.fundShare) kpis.push({ name: 'Доля фонда', actual: m.fundShare, target: 100, unit: '%' })
      if (m.irr) kpis.push({ name: 'IRR', actual: m.irr, target: 30, unit: '%' })
      if (m.revenue) kpis.push({ name: 'Выручка', actual: Math.round(m.revenue / 1000), target: Math.round(m.revenue / 1000 * 1.5), unit: 'млн ₽' })
      if (kpis.length) c.kpis = kpis
      // Risk level from metrics
      if (m.totalInvestment > 0 && m.revenue === 0 && m.trl < 7) c.riskLevel = 'yellow'
      if (m.totalInvestment > 200000 && m.revenue === 0) c.riskLevel = 'red'
    }

    toast.add({ severity: 'success', summary: `Загружено ${companyList.length} компаний + метрики`, life: 2000 })
  } catch (err) {
    console.warn('fstApi.getPortfolio failed, using mock data:', err.message)
  } finally {
    portfolioLoading.value = false
  }
}

onMounted(() => {
  liveTimer = setInterval(() => {
    liveColor.value = liveColor.value === 'var(--fst-green)' ? 'var(--fst-green-dark)' : 'var(--fst-green)'
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  }, 3000)
  loadPortfolioFromDb()
})

onUnmounted(() => clearInterval(liveTimer))

// ─── Filters ─────────────────────────────────────────────────────────────────
const filterSubfund = ref(null)
const filterStatus = ref(null)
const searchQuery = ref('')
const subfundOptions = [null, 'БАС', 'РОБО', 'МЭ', 'AI/Tech', 'Фотоника', 'ФармаМед', 'Новые материалы', 'SpaceNet', 'Энерджинет', 'Агротех', 'Технет', 'MediaNet']
const statusOptions = [null, 'Зелёный', 'Жёлтый', 'Красный']

// ─── Portfolio data ───────────────────────────────────────────────────────────
const companies = ref([])

const selectedCompany = ref(null)
const refreshing = ref(false)
const sourcesLoading = ref(false)
const aiReportLoading = ref(false)
const aiReport = ref(null)
const showAddDialog = ref(false)

// ─── Data sources ─────────────────────────────────────────────────────────────
const dataSources = ref([
  { id: 'egrul', name: 'ЕГРЮЛ / ФНС', icon: 'pi pi-building', status: 'ok', lastUpdate: '2026-03-05 08:00' },
  { id: 'efrsb', name: 'ЕФРСБ (банкротства)', icon: 'pi pi-exclamation-circle', status: 'ok', lastUpdate: '2026-03-05 08:00' },
  { id: 'rosreestr', name: 'Роспатент', icon: 'pi pi-key', status: 'ok', lastUpdate: '2026-03-04 16:00' },
  { id: 'hh', name: 'HH.ru (найм)', icon: 'pi pi-users', status: 'warn', lastUpdate: '2026-03-03 12:00' },
  { id: 'news', name: 'Новостной мониторинг', icon: 'pi pi-globe', status: 'ok', lastUpdate: '2026-03-05 10:00' },
  { id: 'crm', name: 'Отчёты компании (Integram)', icon: 'pi pi-database', status: 'ok', lastUpdate: '2026-03-01 09:00' },
])

// При изменении списка компаний (после loadPortfolioFromDb) инициализируем их ленты
watch(companies, (list) => {
  for (const c of list) {
    const k = `company:${c.id}`
    if (!eventStore.timelines[k]) {
      ensureCompanyTimeline(c)
    }
  }
}, { deep: false })

// ─── Computed ─────────────────────────────────────────────────────────────────
const filteredCompanies = computed(() => {
  return companies.value.filter(c => {
    if (filterSubfund.value && c.subfund !== filterSubfund.value) return false
    if (filterStatus.value) {
      const map = { 'Зелёный': 'green', 'Жёлтый': 'yellow', 'Красный': 'red' }
      if (c.riskLevel !== map[filterStatus.value]) return false
    }
    if (searchQuery.value && !c.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

const activeCount = computed(() => companies.value.filter(c => c.riskLevel !== 'dead').length)
const alertCount = computed(() => companies.value.filter(c => c.riskLevel === 'red' || c.riskLevel === 'yellow').length)
const totalInvested = computed(() => companies.value.reduce((s, c) => s + (c.invested || 0), 0))
const avgHealth = computed(() => {
  if (!companies.value.length) return 0
  return Math.round(companies.value.reduce((s, c) => s + (liveHealthScores.value[c.id] || c.health || 50), 0) / companies.value.length)
})
const totalRealInvested = computed(() => {
  let sum = 0
  for (const c of companies.value) {
    const m = getMetrics(c.id)
    if (m?.totalInvestment) sum += m.totalInvestment
  }
  return sum // тыс. руб.
})
const avgFundShare = computed(() => {
  const shares = companies.value.map(c => getMetrics(c.id)?.fundShare).filter(Boolean)
  return shares.length ? Math.round(shares.reduce((s, v) => s + v, 0) / shares.length) : 0
})
const totalNAV = computed(() => {
  let sum = 0
  for (const c of companies.value) {
    const m = getMetrics(c.id)
    if (m?.postMoney && m?.fundShare) sum += m.postMoney * m.fundShare / 100
  }
  return sum // тыс. руб.
})
const portfolioMetrics = computed(() => [
  { icon: 'pi pi-building',            val: activeCount.value,                           label: 'Компаний',        },
  { icon: 'pi pi-wallet',              val: fmtMln(totalRealInvested.value) + ' ₽',     label: 'Инвестировано',   },
  { icon: 'pi pi-chart-line',          val: fmtMln(totalNAV.value) + ' ₽',              label: 'NAV (оценка)',    },
  { icon: 'pi pi-percentage',          val: avgFundShare.value + '%',                    label: 'Ср. доля',       },
  { icon: 'pi pi-heart',               val: avgHealth.value + '%',                       label: 'Ср. health',     },
  { icon: 'pi pi-exclamation-triangle', val: alertCount.value,                            label: 'Предупреждений', },
])
const criticalAlerts = computed(() => companies.value
  .filter(c => c.riskLevel === 'red')
  .map(c => ({ company: c.name }))
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  return 'Неизвестно'
}

function runwayColor(months) {
  if (months >= 12) return 'var(--fst-green)'
  if (months >= 6) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function kpiColor(kpi) {
  const pct = kpi.actual / kpi.target
  if (pct >= 0.9) return 'var(--fst-green)'
  if (pct >= 0.6) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function sensorColor(level) {
  if (level === 'ok') return 'var(--fst-green)'
  if (level === 'warn') return 'var(--fst-brand)'
  if (level === 'critical') return 'var(--fst-red)'
  return 'var(--p-text-muted-color)'
}

function sensorSeverity(level) {
  if (level === 'ok') return 'success'
  if (level === 'warn') return 'warn'
  if (level === 'critical') return 'danger'
  return 'secondary'
}

function alertIcon(type) {
  const icons = { runway: 'pi pi-clock', revenue: 'pi pi-chart-line', hiring: 'pi pi-users', ip: 'pi pi-key' }
  return icons[type] || 'pi pi-exclamation-triangle'
}

function eventColor(type) {
  const colors = { Контракт: 'var(--fst-blue)', IP: 'var(--fst-purple)', Найм: 'var(--fst-cyan)', Финансы: 'var(--fst-green)', Риск: 'var(--fst-red)', PR: 'var(--fst-brand)' }
  return colors[type] || 'var(--p-text-muted-color)'
}

async function selectCompany(c) {
  selectedCompany.value = c
  activeView.value = 'monitor'
  aiReport.value = null
  await ensureCompanyTimeline(c)
}

function selectCompanyById(id) {
  const c = companies.value.find(x => x.id === id)
  if (c) selectCompany(c)
}

function formatChatText(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')
}

function revenueBarWidth(value, companyId) {
  const m = getMetrics(companyId)
  if (!m?.revenueByYear?.length) return 0
  const max = Math.max(...m.revenueByYear.map(r => r.value))
  return max > 0 ? Math.round(value / max * 100) : 0
}

async function refreshAll() {
  refreshing.value = true
  await new Promise(r => setTimeout(r, 1500))
  lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  refreshing.value = false
  toast.add({ severity: 'success', summary: 'Обновлено', detail: 'Данные из всех источников актуализированы', life: 2500 })
}

async function refreshSources() {
  sourcesLoading.value = true
  await new Promise(r => setTimeout(r, 1000))
  sourcesLoading.value = false
  toast.add({ severity: 'info', summary: 'Источники обновлены', life: 2000 })
}

const router    = useRouter()
const projStore = useProjectStore()

function callCommittee() {
  toast.add({ severity: 'warn', summary: 'ИК созывается', detail: 'Уведомление отправлено членам Инвестиционного Комитета', life: 3500 })
}

function openProjectHub(company) {
  projStore.setActive({
    id:          company.id,
    name:        company.name,
    company:     company.name,
    subfund:     company.subfund,
    trl:         company.trl,
    stage:       company.stage,
    inn:         company.inn,
    _source:     'portfolio',
  })
  router.push('/fst-project/' + company.id)
}

async function generateAiReport() {
  if (!selectedCompany.value) return
  aiReportLoading.value = true
  await new Promise(r => setTimeout(r, 2000))
  const c = selectedCompany.value
  aiReport.value = [
    {
      title: 'Сильные стороны',
      icon: 'pi pi-check-circle',
      color: 'var(--fst-green)',
      points: [
        `TRL ${c.trl} — технологическая готовность на уровне рынка`,
        `Команда ${c.headcount} чел. соответствует стадии`,
        c.revenue > 10 ? `Выручка ${c.revenue} млн ₽ — признак рыночного спроса` : `Первые LOI подтверждают рыночный интерес`,
      ]
    },
    {
      title: 'Ключевые риски',
      icon: 'pi pi-exclamation-triangle',
      color: 'var(--fst-brand)',
      points: c.riskLevel === 'red'
        ? ['Runway критически низкий — срочный транш или реструктуризация', 'Отсутствие выручки создаёт риск дефолта', 'Необходимо экстренное заседание ИК']
        : c.riskLevel === 'yellow'
        ? ['Runway ниже комфортного уровня (9 мес.)', 'Выручка отстаёт от плана на 40%+', 'Рекомендуется досрочное рассмотрение транша 2']
        : ['Регуляторные задержки могут сдвинуть TRL-рост', 'Усиление конкуренции в нише', 'Риск потери ключевого сотрудника (основатель)'],
    },
    {
      title: 'Рекомендации ФСТ',
      icon: 'pi pi-lightbulb',
      color: 'var(--fst-blue)',
      points: c.riskLevel === 'red'
        ? ['Созвать экстренный ИК в течение 5 рабочих дней', 'Рассмотреть bridge-финансирование или реструктуризацию', 'Запросить план антикризисных мер от команды']
        : c.riskLevel === 'yellow'
        ? ['Разблокировать транш 2 при подтверждении KPI', 'Провести квартальный ревью с командой', 'Усилить менторскую поддержку ФСТ по продажам']
        : ['Поддержать выход на Раунд A в Q3 2026', 'Рекомендовать стратегическим партнёрам ФСТ', 'Рассмотреть рефинансирование при росте > 3x'],
    },
    {
      title: 'Прогноз',
      icon: 'pi pi-chart-line',
      color: 'var(--fst-purple)',
      points: [
        `Вероятность выживания 12 мес.: ${c.riskLevel === 'red' ? '35%' : c.riskLevel === 'yellow' ? '68%' : '91%'}`,
        `Целевой MOIC: ${c.riskLevel === 'red' ? '0-1x (риск списания)' : c.riskLevel === 'yellow' ? '2-3x (при стабилизации)' : '4-6x (позитивный сценарий)'}`,
        `Ожидаемый выход: ${c.stage === 'Pre-seed' ? '2029-2030' : c.stage === 'Посевная' ? '2028-2029' : '2027-2028'}`,
      ]
    }
  ]
  aiReportLoading.value = false
}
</script>

<style scoped>
/* ─── Topbar ─── */
.fsp-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fsp-live-dot { font-size: 8px; }
.fsp-fund-name { font-size: 14px; }
.fsp-tag { font-size: 11px !important; }
.fsp-updated {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* ─── Metrics strip ─── */
.fsp-metrics {
  margin: -20px -20px 0;           /* flush to FstPageLayout body edges */
  border-bottom: 1px solid var(--p-content-border-color);
}

/* ─── Filters bar ─── */
.fsp-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  flex-wrap: wrap;
}
.fsp-filter-sel { width: 130px; }
.fsp-search-wrap { position: relative; display: flex; align-items: center; }
.fsp-search-wrap i { position: absolute; left: 8px; }
.fsp-search { padding-left: 26px !important; width: 180px; }

/* ─── Section label ─── */
.fsp-companies-label { margin-bottom: 10px; }

/* ─── Body ─── */
.fsp-body {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0;
  min-height: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
}

/* Companies section */
.fsp-companies {
  overflow-y: auto;
  padding: 12px;
}

/* Alert banner */
.fsp-alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 40%, transparent);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--p-text-color);
  flex-wrap: wrap;
}

/* Cards grid */
.fsp-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

/* Card */
.fsp-card {
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.fsp-card:hover { border-color: var(--p-primary-color); }
.fsp-card.selected { border-color: var(--p-primary-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 20%, transparent); }
.fsp-card.risk-red    { border-left: 3px solid var(--fst-red);   }
.fsp-card.risk-yellow { border-left: 3px solid var(--fst-brand); }
.fsp-card.risk-green  { border-left: 3px solid var(--fst-green); }

.fsp-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.fsp-card-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color);
}
.fsp-card-badges { display: flex; align-items: center; gap: 6px; }
.fsp-traffic-light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.fsp-card-stage {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}
.fsp-card-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}
.fsp-card-metric { text-align: center; }
.fsp-m-label { font-size: 9px; color: var(--p-text-muted-color); display: block; }
.fsp-m-val { font-size: 13px; font-weight: 600; }

.fsp-health-bar-wrap {
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  margin-bottom: 6px;
}
.fsp-health-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-health-val {
  position: absolute;
  right: 0;
  top: -14px;
  font-size: 10px;
  color: var(--p-text-muted-color);
}

.fsp-card-alerts { display: flex; flex-direction: column; gap: 3px; }
.fsp-card-alert {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 3px;
}
.fsp-card-alert.warn   { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.fsp-card-alert.danger { background: color-mix(in srgb, var(--fst-red)   12%, transparent); color: var(--fst-red);   }

/* Detail panel */
.fsp-detail {
  border-left: 1px solid var(--p-content-border-color);
  overflow-y: auto;
  padding: 12px;
  background: var(--p-surface-ground);
}
.fsp-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  min-height: 200px;
}

.fsp-detail-panel {
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.fsp-detail-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.fsp-detail-company-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}
.fsp-detail-name { font-size: 14px; font-weight: 700; color: var(--p-text-color); }
.fsp-detail-sub { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }
.fsp-detail-health-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

/* KPI progress */
.fsp-kpi-section { display: flex; flex-direction: column; gap: 6px; }
.fsp-kpi-row { display: flex; align-items: center; gap: 8px; }
.fsp-kpi-label { font-size: 11px; color: var(--p-text-muted-color); width: 80px; flex-shrink: 0; }
.fsp-kpi-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
}
.fsp-kpi-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-kpi-nums { font-size: 11px; width: 90px; text-align: right; flex-shrink: 0; }

/* Sources */
.fsp-sources-grid { display: flex; flex-direction: column; gap: 6px; }
.fsp-source {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-surface-ground);
}
.fsp-source-icon { font-size: 14px; color: var(--p-text-muted-color); width: 20px; }
.fsp-source-info { flex: 1; }
.fsp-source-name { font-size: 12px; color: var(--p-text-color); }
.fsp-source-last { font-size: 10px; color: var(--p-text-muted-color); }

/* Sensors */
.fsp-risk-sensors { display: flex; flex-direction: column; gap: 6px; }
.fsp-sensor {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-surface-ground);
}
.fsp-sensor-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-sensor-info { flex: 1; }
.fsp-sensor-name { font-size: 11px; font-weight: 600; color: var(--p-text-color); }
.fsp-sensor-msg { font-size: 10px; color: var(--p-text-muted-color); }

/* Events */
.fsp-events { display: flex; flex-direction: column; gap: 6px; }
.fsp-tl-count { background: var(--p-primary-color); color:white; border-radius:10px; padding:0 5px; font-size:10px; }
.fsp-add-event-dialog { margin-top:0.6rem; padding:0.6rem; background:var(--p-surface-ground); border-radius:8px; border:1px solid var(--p-content-border-color); }
.fsp-aed-title { font-size:0.78rem; font-weight:600; color:var(--p-text-color); margin-bottom:0.4rem; }
.fsp-event {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-event:last-child { border-bottom: none; }
.fsp-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-event-body { flex: 1; }
.fsp-event-title { font-size: 12px; color: var(--p-text-color); }
.fsp-event-date { font-size: 10px; color: var(--p-text-muted-color); }

/* AI Report */
.fsp-ai-report { display: flex; flex-direction: column; gap: 10px; }
.fsp-ai-section {}
.fsp-ai-section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fsp-ai-list {
  margin: 0;
  padding-left: 18px;
}
.fsp-ai-list li { font-size: 11px; color: var(--p-text-color); line-height: 1.6; }
.fsp-ai-empty {
  display: flex;
  justify-content: center;
  padding: 12px;
}

/* Nav */
.fsp-detail-nav {
  display: flex;
  gap: 8px;
  justify-content: center;
}

@media (max-width: 900px) {
  .fsp-body { grid-template-columns: 1fr !important; }
  .fsp-detail { border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-right { max-height: 50vh; overflow-y: auto; border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-filter-bar { flex-wrap: wrap; gap: 6px; }
  .fsp-filter-sel, .fsp-search { width: 100% !important; }

  /* Hide empty detail placeholder on mobile — show only when company selected */
  .fsp-detail-empty { display: none; }

  /* Toolbar buttons — scrollable row */
  .fsp-toolbar-actions {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    gap: 4px;
  }
  .fsp-toolbar-actions .p-button {
    flex-shrink: 0;
    font-size: 0.8rem;
    padding: 0.375rem 0.5rem;
  }
}

/* ─── GR-badge ─── */
.fsp-card-footer-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.fsp-hist-btn {
  background: none; border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 2px 8px; font-size: 10px; color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; gap: 4px; transition: background .15s, color .15s;
}
.fsp-hist-btn:hover { background: var(--p-surface-ground); color: var(--p-text-color); }

.fsp-gr-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  padding: 3px 6px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.fsp-gr-label { color: var(--p-text-muted-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.fsp-gr-funded  { color: var(--fst-green); font-weight: 700; }
.fsp-gr-applied { color: var(--fst-brand); font-weight: 700; }
.fsp-gr-next { color: var(--p-primary-color); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-gr-empty { color: var(--p-text-muted-color); font-style: italic; }

/* ─── View tabs ─── */
.fsp-view-tabs { flex-shrink: 0; }
.fsp-view-tabs :deep(.p-button) { font-size: 11px !important; padding: 5px 10px !important; }
.fsp-filter-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

/* ─── View panels ─── */
.fsp-view-panel {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--p-surface-card);
  min-height: 300px;
}

/* ─── DataTable tweaks ─── */
.fsp-datatable { font-size: 12px; }
.fsp-dt-name {
  font-weight: 600;
  color: var(--p-primary-color);
  cursor: pointer;
}
.fsp-dt-name:hover { text-decoration: underline; }
.fsp-dt-sub { font-size: 10px; color: var(--p-text-muted-color); }

/* ─── AI Chat panel ─── */
.fsp-chat-panel { display: flex; flex-direction: column; }
.fsp-chat-hint {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
  line-height: 1.5;
}
.fsp-chat-messages {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
  min-height: 120px;
}
.fsp-chat-msg {
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 85%;
}
.fsp-chat-msg.user {
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  align-self: flex-end;
}
.fsp-chat-msg.assistant {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  align-self: flex-start;
}
.fsp-chat-msg-role {
  font-size: 10px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.fsp-chat-msg-text {
  font-size: 12px;
  color: var(--p-text-color);
  line-height: 1.6;
}
.fsp-chat-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.fsp-chat-input { flex: 1; font-size: 12px; }

/* ─── Real Metrics panel ─── */
.fsp-real-metrics { display: flex; flex-direction: column; gap: 4px; }
.fsp-rm-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-rm-row:last-child { border-bottom: none; }
.fsp-rm-label { font-size: 11px; color: var(--p-text-muted-color); }
.fsp-rm-val { font-size: 12px; font-weight: 600; color: var(--p-text-color); }

/* Revenue dynamics mini-chart */
.fsp-rm-dynamics {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
}
.fsp-rm-dyn-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.fsp-rm-dyn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.fsp-rm-dyn-year { font-size: 10px; color: var(--p-text-muted-color); width: 32px; flex-shrink: 0; }
.fsp-rm-dyn-bar-wrap {
  flex: 1;
  height: 5px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
}
.fsp-rm-dyn-bar {
  height: 100%;
  background: var(--fst-green);
  border-radius: 3px;
  transition: width 0.3s;
}
.fsp-rm-dyn-val { font-size: 10px; font-weight: 600; color: var(--fst-green); width: 48px; text-align: right; }
</style>

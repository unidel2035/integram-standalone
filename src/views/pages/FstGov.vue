<template>
  <FstPageLayout
    title="Корпоративное управление"
    subtitle="ESG-политики, комплаенс и управленческие стандарты"
  >
    <template #header>
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        <i class="pi pi-building" style="color:var(--fst-blue);font-size:20px"></i>
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

    <!-- Метрики -->
    <div class="fst-metrics-strip">
      <div v-for="m in govMetrics" :key="m.label" class="fst-metric-item">
        <i :class="m.icon" class="fst-metric-item-icon" :style="{ color: m.color }"></i>
        <div class="fst-metric-item-val">{{ m.val }}</div>
        <div class="fst-metric-item-label">{{ m.label }}</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ 1: Меры поддержки стартапов
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'measures'" class="gr-content">

      <!-- Выбор стартапа для персонального плана -->
      <div class="gr-startup-panel">
        <div class="gr-section-title">
          <i class="pi pi-bolt" style="color:var(--fst-brand)"></i>
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
            <Button label="Открыть GR-ленту" icon="pi pi-history" size="small" severity="info"
                    @click="activeTab = 'timeline'" />
          </div>
        </div>

        <!-- AI план -->
        <div v-if="planText" class="gr-plan-block">
          <div class="gr-plan-header">
            <i class="pi pi-file-check" style="color:var(--fst-green)"></i>
            <span>AI-план получения мер поддержки · {{ selectedProject?.name }}</span>
          </div>
          <div class="gr-plan-text" v-html="planText"></div>
        </div>
      </div>

      <!-- Банк мер поддержки -->
      <div class="gr-measures-bank">
        <div class="gr-section-title">
          <i class="pi pi-wallet" style="color:var(--fst-blue)"></i>
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
         ТАБ: GR Арена
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'timeline'" class="gr-content" @vue:mounted="ensureDemoTimeline">
      <GrBossArena
        :company="arenaCompany"
        :projects="projects"
        :events="tlEvents"
        :possible="tlPossible"
        :ai-suggestion="aiSuggestion"
        :ai-suggestion-loading="aiSuggestionLoading"
        @pick="p => { selectedProject = p; ensureDemoTimeline() }"
        @init="ensureDemoTimeline"
        @attack="tlApplyEvent"
        @remove="tlRemoveEvent"
      />
    </div>
    <div v-if="activeTab === 'timeline_old'" class="gr-content" @vue:mounted="ensureDemoTimeline">

      <!-- ── Шапка арены: проект + сброс ── -->
      <div class="gr-arena-head">
        <Select v-model="selectedProject" :options="projects" optionLabel="name"
                placeholder="Выбрать проект…" class="gr-arena-proj-sel"
                @change="activeTab = 'timeline'" />
        <div class="gr-arena-actions">
          <Button label="Сброс" icon="pi pi-refresh" size="small" severity="secondary" text @click="tlReset" />
          <button :class="['gr-tl-vs-btn', { active: tlView === 'dag' }]" @click="tlView = tlView === 'dag' ? 'timeline' : 'dag'">
            <i class="pi pi-share-alt" /> DAG
          </button>
        </div>
      </div>

      <!-- ── Экран старта (лента пуста) ── -->
      <div v-if="!grEventStore.getTimeline(tlProjectId).length" class="gr-arena-start">
        <div class="gr-arena-start-icon">⚔️</div>
        <div class="gr-arena-start-title">GR Арена</div>
        <div class="gr-arena-start-sub">
          Деньги фонда — не единственная ценность.<br>
          Настоящий актив — способность пробить барьер,<br>
          который деньгами не пробьёшь.
        </div>
        <Button label="Обнаружить барьеры" icon="pi pi-search"
                size="large" severity="warning"
                @click="ensureDemoTimeline" />
        <div class="gr-arena-start-hint">
          Анализируем проект и ищем регуляторные, рыночные и технологические барьеры
        </div>
      </div>

      <!-- ── Боевой экран (есть события) ── -->
      <template v-else>

        <!-- Мультипликатор IRR — главная метрика -->
        <div :class="['gr-multiplier', { 'gr-multiplier--max': bossesDefeated >= activeBosses.length && activeBosses.length }]">
          <div class="gr-multiplier-left">
            <div class="gr-multiplier-val">{{ irrMultiplier }}x</div>
            <div class="gr-multiplier-label">к IRR фонда</div>
          </div>
          <div class="gr-multiplier-center">
            <div class="gr-multiplier-track">
              <div class="gr-multiplier-fill"
                   :style="{ width: Math.min(100, (irrMultiplier - 1) / 2 * 100) + '%' }" />
            </div>
            <div class="gr-multiplier-desc">
              <span v-if="!activeBosses.length" style="color:var(--p-text-muted-color)">Барьеры не обнаружены — запустите диагностику</span>
              <span v-else-if="bossesActive">⚔️ Повержено {{ bossesDefeated }} из {{ activeBosses.length }} барьеров</span>
              <span v-else style="color:var(--fst-green)">🏆 Все барьеры пробиты — максимальный мультипликатор!</span>
            </div>
          </div>
          <div class="gr-multiplier-right">
            <GrXpBar :events="grEventStore.getTimeline(tlProjectId)" />
          </div>
        </div>

        <!-- AI-подсказка -->
        <div v-if="aiSuggestionLoading" class="gr-ai-hint gr-ai-hint--loading">
          <i class="pi pi-spin pi-spinner" /> AI анализирует следующие шаги…
        </div>
        <div v-else-if="aiSuggestion" class="gr-ai-hint">
          <div class="gr-ai-hint-header">
            <i class="pi pi-sparkles" style="color:var(--fst-purple)" />
            <strong>AI: следующие шаги после финансирования</strong>
            <button class="gr-ai-hint-close" @click="aiSuggestion = null">×</button>
          </div>
          <div class="gr-ai-hint-body" style="white-space:pre-line">{{ aiSuggestion }}</div>
        </div>

        <!-- ══ БОССЫ ══ -->
        <div v-if="activeBosses.length" class="gr-bosses-section">
          <div class="gr-bosses-header">
            <span class="gr-bosses-title">⚔️ Регуляторные барьеры</span>
            <span v-if="bossesDefeated" class="gr-bosses-score gr-bosses-score--win">{{ bossesDefeated }} повержено</span>
            <span v-if="bossesActive" class="gr-bosses-score gr-bosses-score--active">{{ bossesActive }} активных</span>
          </div>
          <div class="gr-bosses-grid">
            <GrBossCard v-for="b in activeBosses" :key="b.boss.id"
                        :boss="b.boss"
                        :state="b.state"
                        :available-moves="movesForBoss(b.boss)"
                        @attack="tlApplyEvent" />
          </div>
        </div>

        <!-- Нет боссов но есть лента → всё хорошо -->
        <div v-else class="gr-no-bosses">
          <i class="pi pi-shield-check" style="font-size:2rem;color:var(--fst-green);opacity:0.6" />
          <div>Барьеры не обнаружены или все преодолены</div>
          <div style="font-size:11px">Продолжайте добавлять события через лист возможных мер ниже</div>
        </div>

        <!-- Плотность событий (compact) -->
        <GrDensityChart :events="grEventStore.getTimeline(tlProjectId)" style="margin:8px 0" />

        <!-- Аккордеон: полная лента + DAG -->
        <details class="gr-history-details">
          <summary class="gr-history-summary">
            <i class="pi pi-history" /> История событий
            <span class="gr-tl-count">{{ grEventStore.getTimeline(tlProjectId).length }}</span>
            <span style="margin-left:auto;font-size:11px;opacity:0.6">развернуть ▼</span>
          </summary>
          <div class="gr-history-body">
            <div class="gr-tl-view-switch" style="margin-bottom:8px">
              <button :class="['gr-tl-vs-btn', { active: tlView === 'timeline' }]" @click="tlView = 'timeline'">
                <i class="pi pi-list" /> Лента
              </button>
              <button :class="['gr-tl-vs-btn', { active: tlView === 'dag' }]" @click="tlView = 'dag'">
                <i class="pi pi-share-alt" /> DAG
              </button>
            </div>
            <GrTimeline v-if="tlView === 'timeline'"
              :events="tlEvents" :possible="tlPossible" :stats="tlStats" :editable="true"
              @apply="tlApplyEvent" @remove="tlRemoveEvent" @counterfactual="showCounterfactual" />
            <div v-else class="gr-tl-dag-wrap">
              <GrCausalDag :events="tlEvents" />
            </div>
          </div>
        </details>

      </template>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ: GR-карта портфеля
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'grmap'" class="gr-content">
      <div class="gr-section-title">
        <i class="pi pi-map" style="color:var(--fst-blue)"></i>
        GR-карта всего портфеля
        <span class="gr-count">{{ grMapProjects.length }} проектов</span>
      </div>
      <div class="gr-map-desc">
        Все проекты портфеля на единой GR-карте. Кликните на проект — перейдёт в ленту событий.
      </div>

      <div v-if="!grMapProjects.length" class="gr-map-empty">
        <i class="pi pi-inbox" style="font-size:2rem;opacity:0.2" />
        <div>Загрузите проекты из БД на вкладке «Меры поддержки»</div>
      </div>

      <div v-else class="gr-map-grid">
        <div v-for="proj in grMapProjects" :key="proj.id"
             class="gr-map-card"
             :style="{ borderLeftColor: GR_PHASE_META[proj.grPhase].color }"
             @click="selectedProject = proj; activeTab = 'timeline'">
          <div class="gr-map-card-header">
            <div class="gr-map-card-name">{{ proj.name || proj.id }}</div>
            <div class="gr-map-phase-badge"
                 :style="{ background: GR_PHASE_META[proj.grPhase].color + '22', color: GR_PHASE_META[proj.grPhase].color }">
              <i :class="GR_PHASE_META[proj.grPhase].icon" style="font-size:9px" />
              {{ GR_PHASE_META[proj.grPhase].label }}
            </div>
          </div>
          <div class="gr-map-card-stats">
            <div class="gr-map-stat">
              <span class="gr-map-stat-val">{{ proj.funded }}</span>
              <span class="gr-map-stat-lbl">финанс.</span>
            </div>
            <div class="gr-map-stat">
              <span class="gr-map-stat-val" style="color:var(--fst-brand)">{{ proj.applied }}</span>
              <span class="gr-map-stat-lbl">заявок</span>
            </div>
            <div class="gr-map-stat">
              <span class="gr-map-stat-val" style="color:var(--fst-red)">{{ proj.rejected }}</span>
              <span class="gr-map-stat-lbl">откл.</span>
            </div>
            <div class="gr-map-stat">
              <span class="gr-map-stat-val" style="color:var(--p-text-muted-color)">{{ proj.total }}</span>
              <span class="gr-map-stat-lbl">событий</span>
            </div>
          </div>
          <div v-if="proj.lastEvt" class="gr-map-card-last">
            <i class="pi pi-clock" style="font-size:9px" />
            {{ proj.lastEvt.type?.replace(/_/g, ' ') }} · {{ new Date(proj.lastEvt.ts).toLocaleDateString('ru-RU') }}
          </div>
          <div v-else class="gr-map-card-last" style="font-style:italic">нет событий — нажмите для инициализации</div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         ТАБ 2.5: Онтология — классы, интерфейсы, событийные цепочки
    ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'ontology'" class="gr-content">

      <!-- Заголовок онтологии -->
      <div class="gr-onto-header-block">
        <div class="gr-section-title">
          <i class="pi pi-share-alt" style="color:var(--fst-purple)"></i>
          Событийная онтология
        </div>
        <div class="gr-onto-desc">
          Объект существует только через события. Интерфейс — граница между классами, через которую проходят события.
          Состояние = проекция ленты событий.
        </div>
      </div>

      <!-- Классы онтологии -->
      <div class="gr-section-title" style="margin-top:4px">
        <i class="pi pi-table" style="color:var(--fst-blue)"></i>
        Классы (типы объектов)
      </div>
      <div class="gr-onto-classes">
        <div v-for="(cls, key) in ONTOLOGY_CLASSES" :key="key" class="gr-onto-class-card">
          <div class="gr-onto-class-name">{{ cls.label }}</div>
          <div class="gr-onto-class-desc">{{ cls.description }}</div>
          <div v-if="cls.subtypes?.length" class="gr-onto-subtypes">
            <span v-for="st in cls.subtypes" :key="st" class="gr-onto-subtype">{{ st }}</span>
          </div>
          <div v-if="cls.properties?.length" class="gr-onto-props">
            <span v-for="p in cls.properties" :key="p" class="gr-onto-prop">{{ p }}</span>
          </div>
        </div>
      </div>

      <!-- Живые интерфейсы из событийной ленты -->
      <div class="gr-section-title" style="margin-top:20px">
        <i class="pi pi-arrow-right-arrow-left" style="color:var(--fst-purple)"></i>
        Интерфейсы — живые (из ленты проекта)
      </div>
      <div class="gr-onto-desc" style="margin-bottom:12px">
        Интерфейс = граница между субъектами. Событие меняет реальность на обеих сторонах.
        Один субъект видит «подали заявку», другой — «получили заявку».
      </div>

      <!-- Карта субъектов и интерфейсов -->
      <div class="gr-iface-map">
        <div v-for="iface in GR_INTERFACES" :key="iface.id" class="gr-iface-card"
             :style="{ borderColor: iface.color + '44' }">
          <div class="gr-iface-subjects">
            <div class="gr-iface-subj" :style="{ color: SUBJECT_ROLES[iface.from]?.color || 'var(--p-text-muted-color)' }">
              <i :class="SUBJECT_ROLES[iface.from]?.icon || 'pi pi-user'" />
              {{ SUBJECT_ROLES[iface.from]?.label || iface.from }}
            </div>
            <div class="gr-iface-line" :style="{ background: iface.color }">
              <span class="gr-iface-line-label">{{ iface.label }}</span>
            </div>
            <div class="gr-iface-subj" :style="{ color: SUBJECT_ROLES[iface.to]?.color || 'var(--p-text-muted-color)' }">
              <i :class="SUBJECT_ROLES[iface.to]?.icon || 'pi pi-user'" />
              {{ SUBJECT_ROLES[iface.to]?.label || iface.to }}
            </div>
          </div>
          <div class="gr-iface-desc">{{ iface.description }}</div>
          <!-- События этого интерфейса в текущей ленте -->
          <div class="gr-iface-live">
            <span v-for="evtType in iface.events" :key="evtType"
                  :class="['gr-iface-evt-tag', { 'gr-iface-evt-tag--live': tlEventsSet.has(evtType) }]"
                  :style="tlEventsSet.has(evtType) ? { background: iface.color+'22', color: iface.color } : {}">
              <i v-if="tlEventsSet.has(evtType)" class="pi pi-check-circle" />
              {{ evtType }}
            </span>
          </div>
        </div>
      </div>

      <!-- Классические интерфейсы из онтологии -->
      <div class="gr-section-title" style="margin-top:20px">
        <i class="pi pi-arrow-right-arrow-left" style="color:var(--fst-purple)"></i>
        Структурные интерфейсы (онтология мер)
      </div>
      <div class="gr-onto-interfaces">
        <div v-for="rel in ONTOLOGY_RELATIONS" :key="rel.from+rel.rel+rel.to" class="gr-onto-iface">
          <span class="gr-onto-iface-from">{{ ONTOLOGY_CLASSES[rel.from]?.label || rel.from }}</span>
          <div class="gr-onto-iface-arrow">
            <span class="gr-onto-iface-rel">{{ rel.rel.replace(/_/g, ' ') }}</span>
            <div class="gr-onto-iface-line"><i class="pi pi-arrow-right" /></div>
          </div>
          <span class="gr-onto-iface-to">{{ ONTOLOGY_CLASSES[rel.to]?.label || rel.to }}</span>
        </div>
      </div>

      <!-- Событийные цепочки (причинно-следственные) -->
      <div class="gr-section-title" style="margin-top:20px">
        <i class="pi pi-history" style="color:var(--fst-brand)"></i>
        Событийные цепочки (каузальная онтология)
      </div>
      <div class="gr-onto-desc" style="margin-bottom:12px">
        Триггер запускает цепочку. Каждый шаг — событие, меняющее состояние мира.
      </div>
      <div class="gr-onto-chains-grid">
        <div v-for="chain in GR_ONTO_TAGS.filter(t => t.group === 'trigger')" :key="chain.id" class="gr-onto-chain-row">
          <div class="gr-onto-chain-trigger" :style="{ borderColor: chain.color, background: chain.color + '18' }">
            <span :style="{ color: chain.color }">⚡</span>
            {{ chain.label }}
          </div>
          <div class="gr-onto-chain-arrow">→</div>
          <div class="gr-onto-chain-steps">
            <span v-for="(step, i) in ['Диагностика', 'Рабочая группа', 'Концепция', 'Пилот', 'НПА', 'Мера']" :key="i"
                  class="gr-onto-chain-step">{{ step }}</span>
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
          <i class="pi pi-sitemap" style="color:var(--fst-purple)"></i>
          Событийная онтология — меры как узлы цепочки
          <span class="gr-count" style="margin-left:6px">нажмите на шаг чтобы увидеть меры</span>
        </div>
        <div class="gr-onto-grid">
          <div v-for="chain in eventOntology" :key="chain.id" class="gr-onto-chain">
            <div class="gr-onto-trigger">
              <i :class="chain.icon" style="font-size:16px" />
              {{ chain.trigger }}
            </div>
            <div class="gr-onto-events">
              <div v-for="(ev, ei) in chain.events" :key="ei" class="gr-onto-step-wrap">
                <!-- Кликабельный узел -->
                <div :class="['gr-onto-event', `gr-onto-event--${ev.type}`,
                              getStepMeasures(chain.id, ev.type).length ? 'has-measures' : 'is-gap',
                              { 'is-active': activeOntoStep === `${chain.id}:${ev.type}` }]"
                     @click="toggleStep(chain.id, ev.type)">
                  <span class="gr-onto-arrow">→</span>
                  <span class="gr-onto-ev-name">{{ ev.name }}</span>
                  <span v-if="ev.actor" class="gr-onto-actor">{{ ev.actor }}</span>
                  <span v-if="getStepMeasures(chain.id, ev.type).length" class="gr-onto-mbadge">
                    {{ getStepMeasures(chain.id, ev.type).length }}
                  </span>
                  <span v-else class="gr-onto-gbadge">пробел</span>
                </div>
                <!-- Развёрнутые меры или пробел -->
                <div v-if="activeOntoStep === `${chain.id}:${ev.type}`" class="gr-onto-expanded">
                  <template v-if="getStepMeasures(chain.id, ev.type).length">
                    <div v-for="m in getStepMeasures(chain.id, ev.type)" :key="m.id"
                         class="gr-onto-mnode" @click.stop="fillFromMeasure(m)">
                      <span class="gr-om-type">{{ m.type_label }}</span>
                      <span class="gr-om-name">{{ m.name }}</span>
                      <span class="gr-om-amt">{{ m.amount }}</span>
                    </div>
                  </template>
                  <div v-else class="gr-onto-gap-row">
                    <span>⚠️ Нет мер для этого этапа — пробел в поддержке</span>
                    <Button label="+ Создать" icon="pi pi-plus" size="small" severity="warning"
                            @click.stop="createMeasureForGap(chain.id, ev)" />
                  </div>
                </div>
              </div>
            </div>
            <div class="gr-onto-result">
              <i class="pi pi-check-circle" style="color:var(--fst-green)" /> {{ chain.result }}
            </div>
          </div>
        </div>
      </div>


      <!-- Конструктор новой меры -->
      <div class="gr-constructor-panel">
        <div class="gr-section-title">
          <i class="pi pi-plus-circle" style="color:var(--fst-green)"></i>
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
              :loading="constructorLoading" :disabled="!newMeasure.name"
              v-tooltip.top="!newMeasure.name ? 'Введите название меры' : ''"
              @click="generateMeasureProposal" />
            <Button label="Сохранить в библиотеку" icon="pi pi-save" severity="success"
              :disabled="!newMeasure.name" @click="saveMeasureToLib" />
            <Button label="Сформировать служебную записку" icon="pi pi-file-edit" severity="info"
              :disabled="!proposalText" @click="generateMemo" />
          </div>
        </div>

        <!-- Концепция -->
        <div v-if="proposalText" class="gr-proposal-block">
          <div class="gr-proposal-header">
            <i class="pi pi-file-edit" style="color:var(--fst-blue)"></i>
            Проектное предложение новой меры
          </div>
          <div v-html="proposalText" class="gr-proposal-text"></div>
        </div>

        <!-- Служебная записка -->
        <div v-if="memoText" class="gr-memo-block">
          <div class="gr-memo-header">
            <i class="pi pi-envelope" style="color:var(--fst-brand)"></i>
            Служебная записка — к запуску новой меры
            <Button label="Скопировать" icon="pi pi-copy" size="small" text @click="copyMemo" />
          </div>
          <div v-html="memoText" class="gr-memo-text"></div>
        </div>
      </div>

      <!-- Библиотека предложений -->
      <div v-if="proposalLibrary.length" class="gr-library-panel">
        <div class="gr-section-title">
          <i class="pi pi-book" style="color:var(--fst-brand)"></i>
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

      <!-- KPI -->
      <div class="gov-kpi-row">
        <div class="gov-kpi">
          <div class="gov-kpi-icon">🔴</div>
          <div class="gov-kpi-val">{{ regulations.filter(r=>r.risk==='high').length }}</div>
          <div class="gov-kpi-lbl">Высокий риск</div>
        </div>
        <div class="gov-kpi">
          <div class="gov-kpi-icon">🟡</div>
          <div class="gov-kpi-val">{{ regulations.filter(r=>r.risk==='medium').length }}</div>
          <div class="gov-kpi-lbl">Средний риск</div>
        </div>
        <div class="gov-kpi">
          <div class="gov-kpi-icon">✅</div>
          <div class="gov-kpi-val">{{ regulations.filter(r=>r.risk==='low').length }}</div>
          <div class="gov-kpi-lbl">Низкий риск</div>
        </div>
        <div class="gov-kpi">
          <div class="gov-kpi-icon">📋</div>
          <div class="gov-kpi-val">{{ regulations.length }}</div>
          <div class="gov-kpi-lbl">НПА на мониторинге</div>
        </div>
      </div>

      <!-- Радар + список -->
      <div class="gov-card">
        <div class="gr-section-title">
          <i class="pi pi-crosshairs" style="color:var(--fst-blue)"></i>
          Радар регуляторных рисков
          <Button label="AI-анализ рисков" icon="pi pi-sparkles" size="small" severity="warning"
            :loading="radarLoading" @click="runRadarAnalysis" style="margin-left:auto" />
        </div>

        <div class="radar-layout">

          <!-- SVG Радар -->
          <div class="radar-chart-wrap">
            <div class="radar-svg-container" @mouseleave="radarTip.visible = false">
              <svg viewBox="0 0 400 400" class="radar-svg">
                <!-- Кольца риска -->
                <circle cx="200" cy="200" r="145" fill="color-mix(in srgb, var(--fst-red) 5%, transparent)" stroke="var(--fst-red)" stroke-width="1" stroke-dasharray="5,3"/>
                <circle cx="200" cy="200" r="95"  fill="color-mix(in srgb, var(--fst-brand) 5%, transparent)" stroke="var(--fst-brand)" stroke-width="1" stroke-dasharray="5,3"/>
                <circle cx="200" cy="200" r="45"  fill="color-mix(in srgb, var(--fst-green) 8%, transparent)" stroke="var(--fst-green)" stroke-width="1" stroke-dasharray="5,3"/>
                <!-- Подписи колец -->
                <text x="204" y="58"  font-size="9" fill="var(--fst-red)" opacity="0.8">Высокий</text>
                <text x="204" y="108" font-size="9" fill="var(--fst-brand)" opacity="0.8">Средний</text>
                <text x="204" y="158" font-size="9" fill="var(--fst-green)" opacity="0.8">Низкий</text>
                <!-- Линии секторов -->
                <line v-for="(l, i) in radarSectorLines" :key="i"
                      x1="200" y1="200" :x2="l.x2" :y2="l.y2"
                      stroke="var(--p-content-border-color)" stroke-width="1"/>
                <!-- Подписи секторов -->
                <text v-for="lb in radarSectorLabels" :key="lb.label"
                      :x="lb.x" :y="lb.y"
                      text-anchor="middle" dominant-baseline="middle"
                      font-size="10" fill="var(--p-text-muted-color)">{{ lb.label }}</text>
                <!-- Центр -->
                <circle cx="200" cy="200" r="3" fill="var(--p-text-muted-color)" opacity="0.3"/>
                <!-- НПА точки -->
                <g v-for="reg in regulations" :key="reg.code"
                   @mouseenter="showRadarTip(reg, $event)"
                   @mouseleave="radarTip.visible = false"
                   @click="openRegModal(reg)"
                   style="cursor:pointer">
                  <circle :cx="getRegPos(reg).x" :cy="getRegPos(reg).y" r="18"
                          :fill="getRegColor(reg)" :opacity="radarTip.reg?.code === reg.code ? 0.3 : 0.12"/>
                  <circle :cx="getRegPos(reg).x" :cy="getRegPos(reg).y"
                          :r="radarTip.reg?.code === reg.code ? 12 : 9"
                          :fill="getRegColor(reg)" opacity="0.9"
                          :stroke="radarTip.reg?.code === reg.code ? 'white' : 'none'" stroke-width="2"/>
                  <text :x="getRegPos(reg).x" :y="getRegPos(reg).y + 1"
                        text-anchor="middle" dominant-baseline="middle"
                        font-size="6.5" fill="white" font-weight="bold" pointer-events="none">
                    {{ reg.code.replace(/[^А-ЯA-Z0-9-]/gi,'').substring(0,6) }}
                  </text>
                </g>
              </svg>
            </div>
            <!-- Тултип через Teleport — поверх всего -->
            <Teleport to="body">
              <div v-if="radarTip.visible && radarTip.reg"
                   class="radar-tip-global"
                   :style="{ left: radarTip.x + 'px', top: radarTip.y + 'px' }">
                <div class="radar-tip-code" :style="{ color: getRegColor(radarTip.reg) }">{{ radarTip.reg.code }}</div>
                <div class="radar-tip-name">{{ radarTip.reg.name }}</div>
                <div v-if="radarTip.reg.desc" class="radar-tip-desc">{{ radarTip.reg.desc }}</div>
                <div class="radar-tip-meta">
                  <span :class="`risk-${radarTip.reg.risk}`">
                    {{ radarTip.reg.risk === 'high' ? '🔴 Высокий' : radarTip.reg.risk === 'medium' ? '🟡 Средний' : '✅ Низкий' }} риск
                  </span>
                  <span v-if="radarTip.reg.date" class="radar-tip-date">{{ radarTip.reg.date }}</span>
                </div>
                <div class="radar-tip-hint">Нажмите для создания меры →</div>
              </div>
            </Teleport>
            <div class="radar-chart-legend">
              <span class="rcl-item"><span class="rcl-dot" style="background:var(--fst-red)"></span>Высокий (внешнее)</span>
              <span class="rcl-item"><span class="rcl-dot" style="background:var(--fst-brand)"></span>Средний</span>
              <span class="rcl-item"><span class="rcl-dot" style="background:var(--fst-green)"></span>Низкий (центр)</span>
            </div>
          </div>

          <!-- Правая панель: форма + список -->
          <div class="radar-right-panel">
            <div class="radar-add-row">
              <InputText v-model="newReg.code" placeholder="Код НПА (ФЗ-370...)" class="radar-add-input" />
              <InputText v-model="newReg.name" placeholder="Название НПА" class="radar-add-input radar-add-name" />
              <Select v-model="newReg.risk" :options="['high','medium','low']" placeholder="Риск" class="radar-add-sel" />
              <Button icon="pi pi-plus" size="small" @click="addRegulation" :disabled="!newReg.code || !newReg.name" />
            </div>

            <div class="radar-list">
              <div v-for="reg in regulations" :key="reg.code"
                :class="['radar-item', `radar-item--${reg.risk}`]">
                <div class="radar-status">{{ statusIcon(reg.risk) }}</div>
                <div class="radar-info">
                  <div class="radar-code">{{ reg.code }}</div>
                  <div class="radar-name">{{ reg.name }}</div>
                  <div class="radar-desc">{{ reg.desc }}</div>
                </div>
                <div class="radar-meta">
                  <span class="radar-date">{{ reg.date }}</span>
                  <span :class="`risk-${reg.risk}`">{{ reg.risk === 'high' ? 'Высокий' : reg.risk === 'medium' ? 'Средний' : 'Низкий' }}</span>
                  <Button icon="pi pi-times" text size="small" severity="secondary" @click="removeRegulation(reg.code)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI-вывод -->
        <div v-if="radarAnalysis" class="gr-agent-output" style="margin-top:16px">
          <div class="gr-agent-output-header"><i class="pi pi-bolt" /> AI-анализ регуляторных рисков</div>
          <div v-html="radarAnalysis" style="padding:14px;font-size:13px;line-height:1.7"></div>
        </div>
      </div>
    </div>

  <!-- ═══ Модальное окно: Конструктор из НПА ═══ -->
  <Dialog v-model:visible="regModal.visible" modal
          :header="regModal.reg ? `Создать меру по НПА: ${regModal.reg.code}` : 'Конструктор меры'"
          style="width:min(720px,95vw)" :draggable="false">
    <div v-if="regModal.reg" class="regmodal-context">
      <div class="regmodal-npa">
        <span :style="{ color: getRegColor(regModal.reg), fontWeight:700 }">{{ regModal.reg.code }}</span>
        <span>{{ regModal.reg.name }}</span>
        <span class="regmodal-risk" :class="`risk-${regModal.reg.risk}`">
          {{ regModal.reg.risk === 'high' ? '🔴 Высокий риск' : regModal.reg.risk === 'medium' ? '🟡 Средний риск' : '✅ Низкий риск' }}
        </span>
      </div>
      <div v-if="regModal.reg.desc" class="regmodal-desc">{{ regModal.reg.desc }}</div>
    </div>

    <div class="gr-constructor-form" style="margin-top:16px">
      <div class="gr-cf-row">
        <div class="gr-cf-group">
          <label>Название меры</label>
          <InputText v-model="newMeasure.name" placeholder="Грант / субсидия / статус..." class="gr-cf-input" />
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
          <label>Проблема / регуляторный контекст</label>
          <Textarea v-model="newMeasure.problem" rows="2" class="gr-cf-input" />
        </div>
        <div class="gr-cf-group">
          <label>Целевая аудитория</label>
          <InputText v-model="newMeasure.target" placeholder="Стартапы БАС с TRL 5–8..." class="gr-cf-input" />
        </div>
      </div>
      <div class="gr-cf-row">
        <div class="gr-cf-group">
          <label>Триггер (почему сейчас)</label>
          <InputText v-model="newMeasure.trigger" class="gr-cf-input" />
        </div>
        <div class="gr-cf-group">
          <label>Ожидаемый результат</label>
          <InputText v-model="newMeasure.expected" placeholder="50 компаний, 10 млрд ₽ выручки" class="gr-cf-input" />
        </div>
      </div>
      <div class="gr-cf-group">
        <label>Онтологические теги</label>
        <div class="gr-onto-tags">
          <span v-for="tag in ONTO_TAGS" :key="tag"
            :class="['gr-onto-tag', { 'gr-onto-tag--sel': newMeasure.ontoTags.includes(tag) }]"
            @click="toggleOntoTag(tag)">{{ tag }}</span>
        </div>
      </div>

      <div v-if="regModal.proposalText" class="gr-proposal-block" style="margin-top:14px">
        <div class="gr-proposal-header"><i class="pi pi-file-edit" style="color:var(--fst-blue)"></i> Проектное предложение</div>
        <div v-html="regModal.proposalText" class="gr-proposal-text"></div>
      </div>
    </div>

    <template #footer>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <Button label="Сгенерировать концепцию (AI)" icon="pi pi-sparkles" severity="warning"
                :loading="regModal.loading" :disabled="!newMeasure.name"
                @click="generateModalProposal" />
        <Button label="Сохранить и закрыть" icon="pi pi-save" severity="success"
                :disabled="!newMeasure.name" @click="saveAndCloseModal" />
        <Button label="Закрыть" icon="pi pi-times" text severity="secondary"
                @click="regModal.visible = false" />
      </div>
    </template>
  </Dialog>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import GrTimeline from '@/components/gr/GrTimeline.vue'
import GrCausalDag from '@/components/gr/GrCausalDag.vue'
import GrDensityChart from '@/components/gr/GrDensityChart.vue'
import GrBossCard  from '@/components/gr/GrBossCard.vue'
import GrXpBar     from '@/components/gr/GrXpBar.vue'
import GrBossArena from '@/components/gr/GrBossArena.vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'
import { checkAchievements, calcXp, getLevel } from '@/config/grAchievements.js'
import { playAchievement, playLevelUp } from '@/services/grSoundEngine.js'
import { useToast } from 'primevue/usetoast'
import { getProjects } from '@/services/fstApi.js'
import { getMeasures, matchMeasures as matchMeasuresFromService, inferMeasures, buildRoute } from '@/services/grMeasuresService.js'
import { counterfactual, causeChain, happensBefore, GR_INTERFACES, SUBJECT_ROLES } from '@/services/grEventEngine.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'
import { ONTOLOGY_TAGS as GR_ONTO_TAGS, ONTOLOGY_CLASSES, ONTOLOGY_RELATIONS } from '@/config/grOntology.js'
import { useGrEventStore } from '@/stores/grEventStore.js'

const toast = useToast()
const route = useRoute()
const activeTab = ref('measures')

const TABS = [
  { id: 'measures',    label: 'Меры поддержки стартапов',  icon: 'pi pi-wallet' },
  { id: 'timeline',   label: 'Лента событий',             icon: 'pi pi-history' },
  { id: 'grmap',      label: 'GR-карта портфеля',         icon: 'pi pi-map' },
  { id: 'ontology',   label: 'Онтология',                 icon: 'pi pi-share-alt' },
  { id: 'constructor', label: 'Конструктор новых мер',    icon: 'pi pi-sitemap' },
  { id: 'radar',       label: 'Регуляторный радар',        icon: 'pi pi-shield' },
]

// ─── Проект — объявляем до всех computed/watch ────────────────────────────────
const selectedProject = ref(null)

// arenaCompany — обогащённый объект компании для арены (из projects или из router state)
const arenaCompany = computed(() => {
  const p = selectedProject.value
  if (!p) return null
  return {
    id:       p.id,
    name:     p.name || p.id,
    trl:      p.trl || 4,
    stage:    p.stageName || p.stage || 'Посевная',
    runway:   p.runway || 12,
    riskLevel: p.riskLevel || 'green',
    subfund:  p.subFundName || p.subfund || 'БАС',
  }
})

// ─── Событийная онтология (Timeline tab) ─────────────────────────────────────
const grEventStore = useGrEventStore()

// tlProjectId привязан к выбранному проекту; если не выбран — 'demo'
const tlProjectId = computed(() =>
  selectedProject.value ? String(selectedProject.value.id) : 'demo'
)

// Параметры проекта для инициализации ленты
function tlProjectParams() {
  const p = selectedProject.value
  if (!p) return { trl: 2, sector: 'БАС', name: 'Демо-проект БАС' }
  const sectorMap = { БАС: 'БАС', РОБО: 'РОБО', МЭ: 'МЭ' }
  return {
    trl:    p.trl || 4,
    sector: sectorMap[p.subFundName] || 'БАС',
    name:   p.name || p.id,
    stage:  p.stageName || 'Посевная',
  }
}

// Загрузка из Integram + инициализация если лента пуста
async function ensureDemoTimeline() {
  await grEventStore.load(tlProjectId.value)
  if (!grEventStore.getTimeline(tlProjectId.value).length) {
    grEventStore.initProject(tlProjectId.value, tlProjectParams())
  }
}

// Когда выбирается новый проект — загружаем его ленту и переходим на вкладку
watch(selectedProject, async (p) => {
  if (!p) return
  await ensureDemoTimeline()
  activeTab.value = 'timeline'
})

const tlView     = ref('timeline') // 'timeline' | 'dag'
const tlEvents   = computed(() => {
  const evts = grEventStore.getTimeline(tlProjectId.value)
  return tlView.value === 'dag' ? happensBefore(evts) : evts
})
const tlPossible = computed(() => grEventStore.getPossible(tlProjectId.value))
const tlStats    = computed(() => grEventStore.getStats(tlProjectId.value))

// Вывод онтологии для текущего проекта
const tlInferResult = computed(() => {
  const s = grEventStore.getState(tlProjectId.value)
  return inferMeasures(s)
})

// Маршрут финансирования TRL→9
const tlFundingRoute = computed(() => {
  const s = grEventStore.getState(tlProjectId.value)
  return buildRoute(s, 9)
})

// Множество типов событий в текущей ленте (для подсветки интерфейсов)
const tlEventsSet = computed(() => new Set(grEventStore.getTimeline(tlProjectId.value).map(e => e.type)))

// ─── Боссы ────────────────────────────────────────────────────────────────────
const activeBosses = computed(() => {
  const events = grEventStore.getTimeline(tlProjectId.value)
  return GR_BOSSES
    .map(boss => ({ boss, state: getBossState(boss, events) }))
    .filter(b => b.state !== null) // показываем только заспавнившихся
})

const bossesDefeated = computed(() => activeBosses.value.filter(b => b.state.defeated).length)
const bossesActive   = computed(() => activeBosses.value.filter(b => !b.state.defeated).length)

// Мультипликатор IRR: 1.0x + 0.4x за каждого побеждённого босса + 0.5x бонус за полную зачистку
const irrMultiplier = computed(() => {
  const d = bossesDefeated.value
  const total = activeBosses.value.length
  if (!total) return 1.0
  const allDefeated = d === total && total > 0
  return +(1.0 + d * 0.4 + (allDefeated ? 0.5 : 0)).toFixed(1)
})

const govMetrics = computed(() => [
  { icon: 'pi pi-wallet',      color: 'var(--fst-blue)',        val: allMeasures.value.length,      label: 'Мер поддержки' },
  { icon: 'pi pi-check-circle',color: 'var(--fst-green)',       val: matchedMeasures.value.length,  label: 'Совпадают' },
  { icon: 'pi pi-building',    color: 'var(--p-primary-color)', val: projects.value.length,         label: 'Проектов' },
  { icon: 'pi pi-shield',      color: irrMultiplier.value >= 2 ? 'var(--fst-green)' : 'var(--fst-brand)', val: irrMultiplier.value + 'x', label: 'IRR мульт.' },
  { icon: 'pi pi-bolt',        color: bossesActive.value > 0 ? 'var(--fst-red)' : 'var(--fst-green)',     val: activeBosses.value.length, label: 'Боссов' },
  { icon: 'pi pi-exclamation-circle', color: 'var(--fst-purple)', val: regulations.value.length,   label: 'НПА на радаре' },
])

// Атаки, доступные конкретному боссу — фильтруем possibleEvents по типам атак босса
function movesForBoss(boss) {
  const bossAttackTypes = new Set(boss.attacks.map(a => a.type))
  return tlPossible.value.filter(p =>
    bossAttackTypes.has(p.type) && p.probability !== 'blocked'
  )
}

// ─── XP + Ачивки ─────────────────────────────────────────────────────────────
const unlockedAchievements = ref(new Set())

const tlXp    = computed(() => calcXp(grEventStore.getTimeline(tlProjectId.value)))
const tlLevel = computed(() => getLevel(tlXp.value))

// Следим за лентой событий → проверяем новые ачивки + leveling
watch(() => grEventStore.getTimeline(tlProjectId.value).length, () => {
  const events = grEventStore.getTimeline(tlProjectId.value)
  const newAch  = checkAchievements(events, unlockedAchievements.value)
  for (const a of newAch) {
    unlockedAchievements.value.add(a.id)
    playAchievement()
    toast.add({ severity: 'success', summary: a.title, detail: a.desc, life: 4000 })
  }
  // level up
  const newLevel = getLevel(calcXp(events)).level
  if (newLevel > (tlLevel.value?.level ?? 0)) {
    playLevelUp()
    toast.add({ severity: 'info', summary: `Уровень ${newLevel}!`, detail: 'GR-экспертиза фонда растёт', life: 3000 })
  }
})

// Контрфактический анализ выбранного события
const tlCounterfactual = ref(null)
const tlCounterfactualEvent = ref(null)

function showCounterfactual(evt) {
  tlCounterfactualEvent.value = evt
  tlCounterfactual.value = counterfactual(tlEvents.value, evt.id, GR_MEASURES)
}

function closeCounterfactual() {
  tlCounterfactual.value = null
  tlCounterfactualEvent.value = null
}

// Цепочка причин для события
const tlCauseChain = ref(null)

function showCauseChain(evt) {
  tlCauseChain.value = causeChain(tlEvents.value, evt.id)
}

const aiSuggestion = ref(null)
const aiSuggestionLoading = ref(false)

async function fetchAiSuggestion(measureName, projectName) {
  aiSuggestionLoading.value = true
  aiSuggestion.value = null
  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `Мера «${measureName}» одобрена и профинансирована для проекта «${projectName || 'стартап'}». Что должна сделать команда в первые 30 дней? Дай 3 конкретных шага (кратко, по одной строке каждый).`,
        systemPrompt: 'Ты — опытный GR-менеджер фонда НТИ. Отвечай кратко, только по делу, на русском языке.',
        application: 'GrTimeline'
      })
    })
    const json = await resp.json()
    aiSuggestion.value = json.response || null
  } catch (e) {
    aiSuggestion.value = null
  } finally {
    aiSuggestionLoading.value = false
  }
}

function tlApplyEvent(possibleEvent) {
  if (possibleEvent.probability === 'blocked') return
  if (possibleEvent.type === 'MEASURE_APPLIED' && possibleEvent.measure) {
    grEventStore.applyMeasure(tlProjectId.value, possibleEvent.measure.id)
    setTimeout(() => {
      grEventStore.approveMeasure(tlProjectId.value, possibleEvent.measure.id,
        parseInt((possibleEvent.measure.amount || '').replace(/\D/g, '')) || 0)
      // AI-подсказка после финансирования меры
      fetchAiSuggestion(possibleEvent.measure.name, selectedProject.value?.name)
    }, 600)
  } else {
    grEventStore.addEvent(tlProjectId.value, possibleEvent.type, {})
  }
}

function tlRemoveEvent(eventId) {
  grEventStore.removeEvent(tlProjectId.value, eventId)
}

function tlReset() {
  grEventStore.clearTimeline(tlProjectId.value)
  grEventStore.initProject(tlProjectId.value, tlProjectParams())
}

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

// ─── GR-карта портфеля (Multi-project GR map) ─────────────────────────────────

const grMapProjects = computed(() => {
  return (projects.value || []).map(p => {
    const id = String(p.id)
    const timeline = grEventStore.getTimeline(id)
    const applied  = timeline.filter(e => e.type === 'MEASURE_APPLIED').length
    const funded   = timeline.filter(e => e.type === 'MEASURE_FUNDED').length
    const rejected = timeline.filter(e => e.type === 'MEASURE_REJECTED').length
    const lastEvt  = timeline[timeline.length - 1]
    const grPhase  = funded > 0 ? 'funded' : applied > 0 ? 'applied' : timeline.length > 0 ? 'init' : 'none'
    return { ...p, id, applied, funded, rejected, total: timeline.length, grPhase, lastEvt }
  })
})

const GR_PHASE_META = {
  none:    { label: 'Без событий', color: 'var(--p-text-muted-color)', icon: 'pi pi-circle' },
  init:    { label: 'Инициирован', color: 'var(--fst-blue)',           icon: 'pi pi-play' },
  applied: { label: 'Заявки поданы', color: 'var(--fst-brand)',        icon: 'pi pi-send' },
  funded:  { label: 'Финансирован', color: 'var(--fst-green)',         icon: 'pi pi-check-circle' },
}

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
    // Сохраняем план как событие в ленту проекта
    if (planText.value && selectedProject.value) {
      grEventStore.addEvent(tlProjectId.value, 'AI_PLAN_GENERATED', {
        measures: matchedMeasures.value.length,
        potential: totalPotential.value,
        summary: (data.response || '').substring(0, 200),
      })
    }
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

// ─── Онтология: привязка мер к узлам цепочек ─────────────────────────────────
const CHAIN_STEP_MEASURES = {
  // Рыночный провал
  'market-fail:detect': [],
  'market-fail:analyze': [],
  'market-fail:org': [],
  'market-fail:design': ['fasie-umnik', 'fasie-start1'],
  'market-fail:pilot': ['fasie-start2', 'skolkovo-grant', 'skolkovo-accel'],
  'market-fail:legal': ['skolkovo-status', 'minprom-719', 'spik-20'],
  // Технологический разрыв
  'tech-gap:detect': [],
  'tech-gap:org': ['nti-aeronet', 'nti-technet'],
  'tech-gap:design': ['fasie-umnik', 'fasie-start1', 'frp-niokr'],
  'tech-gap:pilot': ['rfriti-sppo', 'rfriti-ai', 'minprom-niokr'],
  'tech-gap:scale': ['fpi-program', 'veb-project'],
  // Регуляторный барьер
  'reg-barrier:detect': [],
  'reg-barrier:org': [],
  'reg-barrier:design': [],  // <— пробел!
  'reg-barrier:analyze': [], // <— пробел!
  'reg-barrier:pilot': ['skolkovo-status'],
  // Инфраструктурный пробел
  'infra-gap:detect': [],
  'infra-gap:analyze': ['msp-loan', 'msp-guarantee'],
  'infra-gap:design': ['veb-project'],
  'infra-gap:pilot': ['minprom-bas', 'frp-projects'],
}

const activeOntoStep = ref(null)

function toggleStep(chainId, stepType) {
  const key = `${chainId}:${stepType}`
  activeOntoStep.value = activeOntoStep.value === key ? null : key
}

function getStepMeasures(chainId, stepType) {
  const ids = CHAIN_STEP_MEASURES[`${chainId}:${stepType}`] || []
  return allMeasures.value.filter(m => ids.includes(m.id))
}

function createMeasureForGap(chainId, ev) {
  const chain = eventOntology.find(c => c.id === chainId)
  newMeasure.value.name = `Новая мера: ${ev.name} (${chain?.trigger})`
  newMeasure.value.problem = `Пробел в поддержке на этапе "${ev.name}" цепочки "${chain?.trigger}"`
  newMeasure.value.trigger = chain?.trigger || ''
  activeOntoStep.value = null
  document.querySelector('.gr-constructor-panel')?.scrollIntoView({ behavior: 'smooth' })
}

// ─── Радар: SVG-вспомогательные ───────────────────────────────────────────────
const RADAR_SECTORS = ['Сертификация', 'Финансирование', 'Экспорт', 'Эксплуатация', 'Правовые']

const radarSectorLines = computed(() => [0,1,2,3,4].map(i => {
  const angle = (i * 72 - 90) * Math.PI / 180
  return { x2: +(200 + 165 * Math.cos(angle)).toFixed(1), y2: +(200 + 165 * Math.sin(angle)).toFixed(1) }
}))

const radarSectorLabels = computed(() => RADAR_SECTORS.map((label, i) => {
  const angle = (i * 72 - 90 + 36) * Math.PI / 180
  return { label, x: +(200 + 188 * Math.cos(angle)).toFixed(1), y: +(200 + 188 * Math.sin(angle)).toFixed(1) }
}))

function getRegSector(reg) {
  const text = (reg.code + ' ' + reg.name + ' ' + (reg.desc || '')).toLowerCase()
  if (/сертифик|ап-21|ап-22|719|лицензи/.test(text)) return 0
  if (/субсиди|финансир|нацпроект|кредит|грант/.test(text)) return 1
  if (/экспорт|зарубеж/.test(text)) return 2
  if (/полёт|эксплуатац|операт|зон/.test(text)) return 3
  return 4
}

function getRegPos(reg) {
  const sector = getRegSector(reg)
  const radius = reg.risk === 'high' ? 145 : reg.risk === 'medium' ? 95 : 45
  const hash = reg.code.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  const jitter = ((Math.abs(hash) % 28) - 14) * Math.PI / 180
  const angle = (sector * 72 - 90 + 36) * Math.PI / 180 + jitter
  return { x: +(200 + radius * Math.cos(angle)).toFixed(1), y: +(200 + radius * Math.sin(angle)).toFixed(1) }
}

function getRegColor(reg) {
  return reg.risk === 'high' ? 'var(--fst-red)' : reg.risk === 'medium' ? 'var(--fst-brand)' : 'var(--fst-green)'
}

const radarTip = ref({ visible: false, reg: null, x: 0, y: 0 })

function showRadarTip(reg, event) {
  let x = event.pageX + 16
  let y = event.pageY - 10
  if (x + 240 > window.innerWidth) x = event.pageX - 250
  if (y + 130 > window.innerHeight + window.scrollY) y = event.pageY - 130
  radarTip.value = { visible: true, reg, x, y }
}

// ─── Модалка конструктора из НПА ──────────────────────────────────────────────
const regModal = ref({ visible: false, reg: null, loading: false, proposalText: '' })

function openRegModal(reg) {
  radarTip.value.visible = false
  newMeasure.value = {
    name: `Мера в ответ на ${reg.code}: ${reg.name.substring(0, 50)}`,
    type: reg.risk === 'low' ? 'subsidy' : 'grant',
    operator: '',
    amount: '',
    problem: reg.desc || reg.name,
    target: 'Стартапы и производители БАС / робототехника',
    trigger: `${reg.code} — ${reg.name} (${reg.date || ''})`,
    expected: '',
    ontoTags: reg.risk === 'high' ? ['Регуляторный барьер'] : reg.risk === 'low' ? ['Безвозвратный грант'] : ['Рыночный провал'],
  }
  regModal.value = { visible: true, reg, loading: false, proposalText: '' }
}

async function generateModalProposal() {
  if (!newMeasure.value.name) return
  regModal.value.loading = true
  regModal.value.proposalText = ''
  const m = newMeasure.value
  const typeLabel = MEASURE_TYPES.find(t => t.value === m.type)?.label || m.type
  try {
    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        application: 'FstGov-RadarModal',
        systemPrompt: `Ты — эксперт GR-политики ФСТ НТИ. Разрабатываешь меры поддержки в ответ на регуляторные изменения. Пиши кратко, структурированно, как правительственный документ. HTML.`,
        prompt: `Разработай меру поддержки в ответ на регуляторное изменение:
НПА: ${regModal.value.reg?.code} — ${regModal.value.reg?.name}
Описание НПА: ${regModal.value.reg?.desc || '—'}
Уровень риска: ${regModal.value.reg?.risk === 'high' ? 'высокий' : regModal.value.reg?.risk === 'medium' ? 'средний' : 'низкий'}

Предлагаемая мера: ${m.name} (${typeLabel})
Проблема: ${m.problem}
Аудитория: ${m.target}

1. <b>Суть меры</b> (2-3 предложения)
2. <b>Механизм</b> (кто оператор, процесс, критерии)
3. <b>Объём и источник</b>
4. <b>КПЭ</b> (3-5 показателей)
5. <b>Следующий шаг</b> (что нужно сделать ФСТ НТИ)`
      })
    })
    const data = await res.json()
    regModal.value.proposalText = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    regModal.value.proposalText = '<p style="color:red">Ошибка генерации</p>'
  } finally {
    regModal.value.loading = false
  }
}

function saveAndCloseModal() {
  if (!newMeasure.value.name) return
  const typeLabel = MEASURE_TYPES.find(t => t.value === newMeasure.value.type)?.label || newMeasure.value.type
  proposalLibrary.value.push({
    id: Date.now(), name: newMeasure.value.name,
    type: newMeasure.value.type, type_label: typeLabel,
    operator: newMeasure.value.operator
  })
  if (regModal.value.proposalText) proposalText.value = regModal.value.proposalText
  regModal.value.visible = false
  toast.add({ severity: 'success', summary: 'Сохранено в библиотеку', life: 2000 })
}

const newMeasure = ref({ name: '', type: 'grant', operator: '', amount: '', problem: '', target: '', trigger: '', expected: '', ontoTags: [] })
const selectedRefMeasure = ref(null)
const constructorLoading = ref(false)

function fillFromMeasure(m) {
  newMeasure.value.name = `Новая мера по образцу: ${m.name}`
  newMeasure.value.type = m.type || 'grant'
  newMeasure.value.operator = m.operator || ''
  newMeasure.value.amount = m.amount || ''
  newMeasure.value.target = m.sector?.join(', ') || ''
  newMeasure.value.problem = m.criteria?.join('. ') || ''
  newMeasure.value.ontoTags = []
  selectedRefMeasure.value = null
  // Скроллим к форме
  document.querySelector('.gr-constructor-panel')?.scrollIntoView({ behavior: 'smooth' })
}
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
const regulations = ref([
  { code: 'ФЗ-370 БПЛА', name: 'Регулирование эксплуатации дронов', desc: 'Сертификация, операторы, зоны полётов', date: 'янв 2026', risk: 'medium' },
  { code: 'ПП-1421 Нацпроект', name: 'Субсидии по Нацпроекту БАС', desc: 'Критерии отбора, объём субсидий 2025-2030', date: 'март 2026', risk: 'low' },
  { code: 'Приказ Минпромторг-719', name: 'Обновление условий подтверждения БПЛА', desc: 'Повышение требований к локализации до 80%', date: 'фев 2026', risk: 'high' },
  { code: 'ФЗ-ЭПТ Экспорт', name: 'Ограничения экспорта двойного назначения', desc: 'Новые согласования для зарубежных партнёрств', date: 'апр 2026', risk: 'medium' },
  { code: 'ПП РФ №1460 ЭПР БАС', name: 'Экспериментальный правовой режим БПЛА', desc: 'Разрешение полётов БПЛА в экспериментальных зонах без сертификации', date: 'июн 2026', risk: 'low' },
  { code: 'Приказ Росавиация 2025-67', name: 'Требования к сертификации операторов БАС', desc: 'Новые правила выдачи свидетельств операторов БПЛА', date: 'май 2026', risk: 'medium' },
])

const newReg = ref({ code: '', name: '', desc: '', date: '', risk: 'medium' })
const radarLoading = ref(false)
const radarAnalysis = ref('')

function statusIcon(s) { return s === 'high' ? '🔴' : s === 'low' ? '✅' : '🟡' }

function addRegulation() {
  if (!newReg.value.code || !newReg.value.name) return
  const now = new Date()
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
  regulations.value.push({
    code: newReg.value.code,
    name: newReg.value.name,
    desc: newReg.value.desc || '—',
    date: `${months[now.getMonth()]} ${now.getFullYear()}`,
    risk: newReg.value.risk || 'medium'
  })
  newReg.value = { code: '', name: '', desc: '', date: '', risk: 'medium' }
}

function removeRegulation(code) {
  regulations.value = regulations.value.filter(r => r.code !== code)
}

async function runRadarAnalysis() {
  radarLoading.value = true
  radarAnalysis.value = ''
  const regStr = regulations.value.map(r =>
    `- ${r.code}: ${r.name} (риск: ${r.risk === 'high' ? 'высокий' : r.risk === 'medium' ? 'средний' : 'низкий'}) — ${r.desc}`
  ).join('\n')

  try {
    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        application: 'FstGov-RadarAnalysis',
        systemPrompt: `Ты — GR-аналитик ФСТ НТИ. Специализируешься на регуляторных рисках для технологических стартапов БАС/дроны/робототехника. Давай конкретные, практические рекомендации. HTML: <b>, <ul><li>.`,
        prompt: `Проанализируй регуляторные изменения и риски для портфельных компаний ФСТ НТИ:

${regStr}

Портфель: БПЛА/БАС, Робототехника, промышленные инновации.

1. <b>Топ-3 критических риска</b> — что угрожает портфелю прямо сейчас
2. <b>Возможности</b> — какие изменения создают шансы
3. <b>Рекомендуемые действия</b> — что конкретно делать ФСТ НТИ (5-7 пунктов)
4. <b>Мониторинг</b> — за чем следить в ближайшие 3 месяца`
      })
    })
    const data = await res.json()
    radarAnalysis.value = (data.response || '').replace(/\n/g, '<br>')
  } catch {
    radarAnalysis.value = '<p style="color:red">Ошибка анализа</p>'
  } finally {
    radarLoading.value = false
  }
}

onMounted(async () => {
  await loadProjects()
  // Фоновая загрузка всех project-лент из Integram
  grEventStore.loadAll().catch(() => {})
  await ensureDemoTimeline()

  // Если пришли из портфеля с company=id&tab=timeline — сразу открыть арену
  if (route.query.company && route.query.tab === 'timeline') {
    const found = projects.value.find(p => String(p.id) === String(route.query.company))
    if (found) {
      selectedProject.value = found
      matchMeasures()
      activeTab.value = 'timeline'
    }
  }
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
.gr-tab:hover { background: var(--p-surface-hover, var(--fst-glass-xs)); color: var(--p-text-color); }
.gr-tab--active { background: var(--p-primary-color); color: white; border-color: var(--p-primary-color); }

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
  background: var(--p-surface-hover, var(--fst-glass-xs));
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
  background: color-mix(in srgb, var(--fst-green) 6%, transparent); font-weight: 600; font-size: 13px;
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
.gr-measure-card--matched { border-color: var(--fst-green); background: color-mix(in srgb, var(--fst-green) 3%, transparent); }
.gr-mc-header { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
.gr-match-badge {
  font-size: 11px; font-weight: 700; color: var(--fst-green);
  background: color-mix(in srgb, var(--fst-green) 12%, transparent); border-radius: 10px; padding: 2px 8px;
}
.gr-mc-name { font-weight: 600; font-size: 13px; margin-bottom: 4px; line-height: 1.4; }
.gr-mc-operator { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 8px; }
.gr-mc-meta { display: flex; gap: 10px; font-size: 11px; color: var(--p-text-muted-color); flex-wrap: wrap; margin-bottom: 6px; }
.gr-mc-meta span { display: flex; align-items: center; gap: 3px; }
.gr-mc-criteria { font-size: 11px; color: var(--p-text-muted-color); line-height: 1.6; }
.gr-mc-deadline { font-size: 11px; color: var(--fst-brand); margin-top: 6px; display: flex; align-items: center; gap: 4px; }

:deep(.gr-type-grant)     { background: color-mix(in srgb, var(--fst-green)  15%, transparent) !important; color: var(--fst-green)  !important; border: none !important; }
:deep(.gr-type-loan)      { background: color-mix(in srgb, var(--fst-blue)   15%, transparent) !important; color: var(--fst-blue)   !important; border: none !important; }
:deep(.gr-type-tax)       { background: color-mix(in srgb, var(--fst-purple) 15%, transparent) !important; color: var(--fst-purple) !important; border: none !important; }
:deep(.gr-type-status)    { background: color-mix(in srgb, var(--fst-brand)  15%, transparent) !important; color: var(--fst-brand)  !important; border: none !important; }
:deep(.gr-type-subsidy)   { background: color-mix(in srgb, var(--fst-cyan)   15%, transparent) !important; color: var(--fst-cyan)   !important; border: none !important; }
:deep(.gr-type-guarantee) { background: color-mix(in srgb, var(--fst-red)    15%, transparent) !important; color: var(--fst-red)    !important; border: none !important; }

/* Agent panel */
.gr-agent-header {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 18px; flex-wrap: wrap;
}
.gr-agent-icon {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, var(--fst-blue-dark, var(--fst-blue)), var(--fst-blue));
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: white; flex-shrink: 0;
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
.gr-pipe-step--done { background: color-mix(in srgb, var(--fst-green) 7%, transparent); border-color: var(--fst-green); }
.gr-pipe-step--running { background: color-mix(in srgb, var(--fst-brand) 10%, transparent); border-color: var(--fst-brand); }
.gr-pipe-dot { font-size: 15px; color: var(--p-text-muted-color); flex-shrink: 0; }
.gr-pipe-step--done .gr-pipe-dot { color: var(--fst-green); }
.gr-pipe-step--running .gr-pipe-dot { color: var(--fst-brand); animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.gr-pipe-name { font-size: 11px; font-weight: 600; }
.gr-pipe-desc { font-size: 10px; color: var(--p-text-muted-color); }

.gr-agent-output { border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden; }
.gr-agent-output-header {
  padding: 10px 14px; background: color-mix(in srgb, var(--fst-blue) 6%, transparent);
  font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}

/* Ontology - grid overridden by new flex rule above */
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
  background: var(--p-surface-hover, var(--fst-glass-xs)); border-radius: 4px; padding: 1px 6px;
}
.gr-onto-event--detect  { color: var(--fst-red); }
.gr-onto-event--analyze { color: var(--fst-brand); }
.gr-onto-event--org     { color: var(--fst-blue); }
.gr-onto-event--design  { color: var(--fst-purple); }
.gr-onto-event--pilot   { color: var(--fst-cyan); }
.gr-onto-event--legal   { color: var(--fst-green); }
.gr-onto-event--scale   { color: var(--fst-green); }
.gr-onto-result { font-size: 12px; font-weight: 600; color: var(--fst-green); display: flex; align-items: center; gap: 6px; }

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
.gr-onto-tag--sel { background: var(--p-primary-color); color: white; border-color: var(--p-primary-color); }
.gr-cf-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 6px; }

.gr-proposal-block, .gr-memo-block {
  border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden; margin-top: 14px;
}
.gr-proposal-header, .gr-memo-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--p-content-border-color);
}
.gr-proposal-header { background: color-mix(in srgb, var(--fst-blue) 5%, transparent); }
.gr-memo-header { background: color-mix(in srgb, var(--fst-brand) 5%, transparent); }
.gr-proposal-text, .gr-memo-text { padding: 14px; font-size: 13px; line-height: 1.7; }

.gr-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.gr-lib-card {
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 12px; display: flex; flex-direction: column; gap: 6px;
}
.gr-lib-name { font-weight: 600; font-size: 13px; }
.gr-lib-meta { display: flex; align-items: center; gap: 8px; }
.gr-lib-status--draft { font-size: 11px; color: var(--p-text-muted-color); }

/* ─── Radar visual ─────────────────────────────────────────────────────────── */
.radar-layout { display: grid; grid-template-columns: 360px 1fr; gap: 20px; align-items: start; }
@media (max-width: 900px) { .radar-layout { grid-template-columns: 1fr; } }
.radar-chart-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.radar-svg-container { position: relative; width: 100%; max-width: 340px; }
.radar-svg { width: 100%; display: block; }
.radar-svg-container { position: relative; width: 100%; max-width: 340px; }
.radar-chart-legend { display: flex; gap: 12px; font-size: 11px; flex-wrap: wrap; color: var(--p-text-muted-color); }
.rcl-item { display: flex; align-items: center; gap: 4px; }
.rcl-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.radar-right-panel { display: flex; flex-direction: column; gap: 12px; }

/* ─── Ontology step interactivity ──────────────────────────────────────────── */
.gr-onto-grid { display: flex; flex-direction: column; gap: 14px; }
.gr-onto-step-wrap { margin-bottom: 2px; }
.gr-onto-event { cursor: pointer; border-radius: 6px; padding: 4px 8px; transition: background 0.15s; }
.gr-onto-event:hover { background: color-mix(in srgb, var(--p-primary-color) 06%, transparent); }
.gr-onto-event.is-active { background: color-mix(in srgb, var(--p-primary-color) 1%, transparent); outline: 1px solid var(--p-primary-color); }
.gr-onto-event.has-measures::before { content: '●'; color: var(--p-primary-color); font-size: 8px; margin-right: 4px; }
.gr-onto-event.is-gap::before { content: '○'; color: var(--fst-red); font-size: 8px; margin-right: 4px; }
.gr-onto-mbadge {
  font-size: 9px; background: var(--p-primary-color); color: white;
  border-radius: 8px; padding: 1px 6px; margin-left: 6px; font-weight: 700;
}
.gr-onto-gbadge {
  font-size: 9px; background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red);
  border-radius: 8px; padding: 1px 6px; margin-left: 6px;
}
.gr-onto-expanded { margin: 4px 0 10px 24px; display: flex; flex-direction: column; gap: 4px; }
.gr-onto-mnode {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  border: 1px solid var(--p-primary-color); border-radius: 6px;
  background: color-mix(in srgb, var(--p-primary-color) 04%, transparent); cursor: pointer; transition: background 0.15s;
}
.gr-onto-mnode:hover { background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); }
.gr-om-type { font-size: 10px; color: var(--p-primary-color); font-weight: 600; flex-shrink: 0; min-width: 70px; }
.gr-om-name { flex: 1; font-size: 12px; font-weight: 500; }
.gr-om-amt { font-size: 11px; color: var(--p-text-muted-color); flex-shrink: 0; }
.gr-onto-gap-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: color-mix(in srgb, var(--fst-red) 5%, transparent); border: 1px dashed var(--fst-red);
  border-radius: 6px; font-size: 12px; color: var(--fst-red); flex-wrap: wrap;
}

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
.risk-high   { color: var(--fst-red);   font-weight: 600; }
.risk-medium { color: var(--fst-brand); font-weight: 600; }
.risk-low    { color: var(--fst-green); font-weight: 600; }

/* ─── Справочник мер в конструкторе ──────────────────────────────────────── */
.gr-ref-panel {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 18px;
}
.gr-ref-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;
  max-height: 320px; overflow-y: auto;
}
.gr-ref-card {
  border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 10px; cursor: pointer; transition: all 0.15s; background: var(--p-surface-card);
}
.gr-ref-card:hover { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 04%, transparent); }
.gr-ref-card--sel { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 08%, transparent); }
.gr-ref-top { display: flex; justify-content: space-between; margin-bottom: 4px; }
.gr-ref-type { font-size: 10px; color: var(--p-primary-color); font-weight: 600; }
.gr-ref-trl { font-size: 10px; color: var(--p-text-muted-color); }
.gr-ref-name { font-size: 12px; font-weight: 600; line-height: 1.3; margin-bottom: 3px; }
.gr-ref-op { font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 3px; }
.gr-ref-amount { font-size: 11px; color: var(--p-text-color); }
/* Modal */
.regmodal-context {
  background: var(--p-surface-hover, var(--fst-glass-xs));
  border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 12px 14px;
}
.regmodal-npa { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; margin-bottom: 5px; }
.regmodal-risk { font-size: 11px; font-weight: 600; }
.regmodal-desc { font-size: 12px; color: var(--p-text-muted-color); line-height: 1.5; }

/* ─── GR-карта портфеля ─── */
.gr-map-desc {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 14px;
}
.gr-map-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}
.gr-map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.gr-map-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-left: 4px solid;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.gr-map-card:hover { box-shadow: 0 2px 12px var(--fst-glass-lg); }
.gr-map-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.gr-map-card-name { font-weight: 600; font-size: 13px; flex: 1; }
.gr-map-phase-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.gr-map-card-stats { display: flex; gap: 10px; margin-bottom: 6px; }
.gr-map-stat { display: flex; flex-direction: column; align-items: center; min-width: 36px; }
.gr-map-stat-val { font-size: 1rem; font-weight: 700; color: var(--fst-green); }
.gr-map-stat-lbl { font-size: 8px; color: var(--p-text-muted-color); text-transform: uppercase; }
.gr-map-card-last { font-size: 9px; color: var(--p-text-muted-color); }
</style>

<style>
/* Radar tooltip — глобально поверх всего */
.radar-tip-global {
  position: fixed; z-index: 9999; pointer-events: none;
  background: #1e1e2e; color: #e2e8f0;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 11px 14px;
  min-width: 210px; max-width: 260px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
}
.radar-tip-global .radar-tip-code { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
.radar-tip-global .radar-tip-name { font-size: 13px; font-weight: 600; line-height: 1.35; margin-bottom: 5px; color: #f1f5f9; }
.radar-tip-global .radar-tip-desc { font-size: 11px; color: #94a3b8; line-height: 1.45; margin-bottom: 7px; }
.radar-tip-global .radar-tip-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 11px; font-weight: 600; margin-bottom: 6px; }
.radar-tip-global .radar-tip-date { color: #64748b; font-weight: 400; }
.radar-tip-global .radar-tip-hint { font-size: 10px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 5px; margin-top: 2px; }
.radar-tip-global .risk-high  { color: #f87171; }
.radar-tip-global .risk-medium { color: #fb923c; }
.radar-tip-global .risk-low   { color: #4ade80; }

/* ─── Timeline tab toolbar ─── */
.gr-tl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  margin-bottom: 0.75rem;
}
.gr-tl-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.gr-tl-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  padding: 0.5rem 0.75rem;
  background: var(--p-primary-color)0A;
  border: 1px solid var(--p-primary-color)22;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}
.gr-tl-hint i { color: var(--p-primary-color); flex-shrink: 0; }

/* ─── Онтология ─────────────────────────────────────────────────────────── */
.gr-onto-header-block { margin-bottom: 16px; }
.gr-onto-desc { font-size: 13px; color: var(--p-text-muted-color); line-height: 1.6; margin-bottom: 8px; }

.gr-onto-classes {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.gr-onto-class-card {
  border: 1px solid var(--p-content-border-color); border-radius: 10px;
  padding: 12px 14px; background: var(--p-surface-card);
}
.gr-onto-class-name { font-weight: 700; font-size: 13px; color: var(--p-primary-color); margin-bottom: 4px; }
.gr-onto-class-desc { font-size: 12px; color: var(--p-text-muted-color); line-height: 1.4; margin-bottom: 6px; }
.gr-onto-subtypes, .gr-onto-props { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.gr-onto-subtype {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--p-primary-color); color: white; opacity: 0.8;
}
.gr-onto-prop {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--p-surface-section, var(--fst-glass-sm)); color: var(--p-text-muted-color);
}

.gr-onto-interfaces { display: flex; flex-direction: column; gap: 8px; }
.gr-onto-iface {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 8px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
}
.gr-onto-iface-from {
  font-size: 12px; font-weight: 600;
  background: var(--p-primary-color); color: white; padding: 3px 10px; border-radius: 6px;
  white-space: nowrap;
}
.gr-onto-iface-to {
  font-size: 12px; font-weight: 600;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); color: var(--p-primary-color); padding: 3px 10px; border-radius: 6px;
  white-space: nowrap;
}
.gr-onto-iface-arrow { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 80px; }
.gr-onto-iface-rel { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 2px; font-style: italic; }
.gr-onto-iface-line { color: var(--p-text-muted-color); font-size: 16px; }

.gr-onto-chains-grid { display: flex; flex-direction: column; gap: 10px; }
.gr-onto-chain-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.gr-onto-chain-trigger {
  font-size: 12px; font-weight: 700; padding: 6px 12px;
  border-radius: 8px; border: 1.5px solid; white-space: nowrap;
}
.gr-onto-chain-arrow { font-size: 18px; color: var(--p-text-muted-color); }
.gr-onto-chain-steps { display: flex; flex-wrap: wrap; }
.gr-onto-chain-step {
  font-size: 11px; padding: 4px 10px; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color); color: var(--p-text-muted-color);
}
.gr-onto-chain-step:first-child { border-radius: 6px 0 0 6px; }
.gr-onto-chain-step:last-child  { border-radius: 0 6px 6px 0; }

/* ─── Переключатель вид лента/DAG ─────────────────────────────────────────── */
.gr-tl-view-switch {
  display: flex; border: 1px solid var(--p-content-border-color); border-radius: 8px; overflow: hidden;
}
.gr-tl-vs-btn {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px;
  border: none; background: transparent; cursor: pointer; font-size: 12px; font-weight: 500;
  color: var(--p-text-muted-color); font-family: inherit; transition: all 0.15s;
}
.gr-tl-vs-btn:hover { background: var(--p-surface-hover, var(--fst-glass-xs)); color: var(--p-text-color); }
.gr-tl-vs-btn.active { background: var(--p-primary-color); color: white; }

/* ─── DAG wrapper ─────────────────────────────────────────────────────────── */
.gr-tl-dag-wrap {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 14px 18px;
}
.gr-tl-dag-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
  font-size: 13px; flex-wrap: wrap;
}

/* ─── Карта интерфейсов ───────────────────────────────────────────────────── */
.gr-iface-map {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;
}
.gr-iface-card {
  border: 1.5px solid; border-radius: 10px; padding: 14px;
  background: var(--p-surface-card); display: flex; flex-direction: column; gap: 8px;
}
.gr-iface-subjects {
  display: flex; align-items: center; gap: 8px;
}
.gr-iface-subj {
  display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700;
  flex: 1; white-space: nowrap;
}
.gr-iface-line {
  flex: 1; height: 3px; border-radius: 2px; position: relative;
  display: flex; align-items: center; justify-content: center;
  min-width: 40px;
}
.gr-iface-line-label {
  position: absolute; font-size: 9px; font-weight: 700; color: white;
  background: inherit; padding: 1px 5px; border-radius: 4px; white-space: nowrap;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.gr-iface-desc { font-size: 11px; color: var(--p-text-muted-color); line-height: 1.5; }
.gr-iface-live { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.gr-iface-evt-tag {
  font-size: 9px; padding: 2px 7px; border-radius: 10px;
  background: var(--p-surface-section, var(--fst-glass-sm));
  color: var(--p-text-muted-color); display: flex; align-items: center; gap: 3px;
  font-weight: 500;
}
.gr-iface-evt-tag--live { font-weight: 700; }

/* ─── Маршрут финансирования ──────────────────────────────────────────────── */
.gr-tl-route {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 14px 18px;
}
.gr-tl-route-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 13px; color: var(--p-text-color);
  margin-bottom: 12px;
}
.gr-tl-route-steps {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start;
}
.gr-tl-route-stage {
  display: flex; flex-direction: column; gap: 4px;
  min-width: 140px; flex: 1;
}
.gr-tl-route-trl {
  font-size: 11px; font-weight: 700; color: var(--p-primary-color);
  padding: 2px 8px; background: color-mix(in srgb, var(--p-primary-color) 1%, transparent);
  border-radius: 4px; display: inline-block; width: fit-content;
}
.gr-tl-route-measures {
  display: flex; flex-direction: column; gap: 3px;
}
.gr-tl-route-m {
  font-size: 11px; color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px; padding: 2px 8px;
  line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 220px;
}
.gr-tl-route-more {
  font-size: 10px; color: var(--p-text-muted-color);
  padding: 2px 6px;
}

/* ─── Пробелы в поддержке ─────────────────────────────────────────────────── */
.gr-tl-gaps {
  background: color-mix(in srgb, var(--fst-brand) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-brand) 30%, transparent);
  border-radius: 10px; padding: 12px 16px;
}
.gr-tl-gaps-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 13px; color: var(--fst-brand);
  margin-bottom: 8px;
}
.gr-tl-gaps-list { display: flex; flex-wrap: wrap; gap: 6px; }
.gr-tl-gap-tag {
  font-size: 11px; padding: 3px 10px;
  background: color-mix(in srgb, var(--fst-brand) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-brand) 35%, transparent);
  border-radius: 12px; color: var(--fst-brand);
}

/* ─── Контрфактический анализ ─────────────────────────────────────────────── */
.gr-tl-counterfactual {
  background: color-mix(in srgb, var(--fst-purple) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
  border-radius: 10px; padding: 14px 18px;
}
.gr-tl-cf-header {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.gr-tl-cf-ev {
  font-size: 12px; font-weight: 600; color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 12%, transparent); padding: 2px 10px; border-radius: 6px;
}
.gr-tl-cf-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 18px; color: var(--p-text-muted-color); line-height: 1;
  padding: 0 4px; transition: color 0.15s;
}
.gr-tl-cf-close:hover { color: var(--p-text-color); }
.gr-tl-cf-body {
  display: flex; gap: 0; align-items: stretch;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 20%, transparent); border-radius: 8px; overflow: hidden;
}
.gr-tl-cf-col {
  flex: 1; padding: 12px 16px;
  background: var(--p-surface-card);
  display: flex; flex-direction: column; gap: 6px; font-size: 13px;
}
.gr-tl-cf-col:not(:last-child) { border-right: 1px solid color-mix(in srgb, var(--fst-purple) 20%, transparent); }
.gr-tl-cf-label {
  font-size: 11px; font-weight: 700; color: var(--p-text-muted-color);
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;
}
.gr-tl-cf-arrow {
  display: flex; align-items: center; justify-content: center;
  padding: 0 10px; font-size: 22px; color: color-mix(in srgb, var(--fst-purple) 40%, transparent);
  background: var(--p-surface-card); flex-shrink: 0;
}

/* ─── AI Suggestion hint ─── */
.gr-ai-hint {
  background: var(--p-surface-card);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 25%, transparent);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 13px;
}
.gr-ai-hint--loading {
  color: var(--p-text-muted-color);
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 8px;
}
.gr-ai-hint-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}
.gr-ai-hint-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  font-size: 16px;
  line-height: 1;
}
.gr-ai-hint-body {
  font-size: 12px;
  line-height: 1.7;
  color: var(--p-text-color);
}

/* ─── Шапка арены ─── */
.gr-arena-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px; flex-wrap: wrap;
}
.gr-arena-proj-sel { flex: 1; min-width: 160px; }
.gr-arena-actions { display: flex; gap: 6px; align-items: center; }

/* ─── Экран старта ─── */
@keyframes arena-glow {
  0%, 100% { text-shadow: 0 0 20px color-mix(in srgb, var(--fst-brand) 50%, transparent); }
  50%       { text-shadow: 0 0 40px color-mix(in srgb, var(--fst-brand) 90%, transparent); }
}
.gr-arena-start {
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; padding: 48px 24px; text-align: center;
}
.gr-arena-start-icon {
  font-size: 4rem; line-height: 1;
  animation: arena-glow 2s ease infinite;
}
.gr-arena-start-title {
  font-size: 1.8rem; font-weight: 900;
  color: var(--p-text-color); letter-spacing: -0.02em;
}
.gr-arena-start-sub {
  font-size: 14px; color: var(--p-text-muted-color);
  line-height: 1.7; max-width: 420px;
}
.gr-arena-start-hint {
  font-size: 11px; color: var(--p-text-muted-color);
  font-style: italic; max-width: 360px;
}

/* ─── Мультипликатор IRR ─── */
@keyframes multiplier-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--fst-green) 0%, transparent); }
  50%       { box-shadow: 0 0 20px 4px color-mix(in srgb, var(--fst-green) 25%, transparent); }
}
.gr-multiplier {
  display: flex; align-items: center; gap: 16px;
  background: var(--p-surface-card);
  border: 2px solid var(--p-content-border-color);
  border-radius: 14px; padding: 14px 18px;
  margin-bottom: 14px; flex-wrap: wrap;
  transition: border-color 0.4s;
}
.gr-multiplier--max {
  border-color: color-mix(in srgb, var(--fst-green) 50%, transparent);
  animation: multiplier-pulse 2s ease infinite;
}
.gr-multiplier-left { text-align: center; min-width: 60px; }
.gr-multiplier-val {
  font-size: 2.2rem; font-weight: 900; color: var(--fst-green);
  line-height: 1; font-variant-numeric: tabular-nums;
  transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
}
.gr-multiplier-label { font-size: 9px; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.06em; }
.gr-multiplier-center { flex: 1; min-width: 140px; }
.gr-multiplier-track {
  height: 8px; background: var(--p-content-border-color);
  border-radius: 6px; overflow: hidden; margin-bottom: 6px;
}
.gr-multiplier-fill {
  height: 100%; background: linear-gradient(90deg, var(--fst-green), color-mix(in srgb, var(--fst-green) 50%, white));
  border-radius: 6px;
  transition: width 0.7s cubic-bezier(0.16,1,0.3,1);
}
.gr-multiplier-desc { font-size: 12px; color: var(--p-text-muted-color); }
.gr-multiplier-right { flex: 1; min-width: 200px; }

/* ─── Нет боссов ─── */
.gr-no-bosses {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 24px; color: var(--p-text-muted-color);
  font-size: 13px; text-align: center;
}

/* ─── Аккордеон истории ─── */
.gr-history-details {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px; overflow: hidden; margin-top: 4px;
}
.gr-history-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: var(--p-text-muted-color);
  list-style: none; user-select: none;
}
.gr-history-summary::-webkit-details-marker { display: none; }
.gr-history-summary:hover { color: var(--p-text-color); }
.gr-history-body { padding: 12px; }

/* ─── Боссы ─── */
.gr-bosses-section {
  margin-bottom: 12px;
}
.gr-bosses-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.gr-bosses-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--p-text-color);
}
.gr-bosses-score {
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  padding: 2px 8px;
}
.gr-bosses-score--win    { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.gr-bosses-score--active { background: color-mix(in srgb, var(--fst-red) 12%, transparent);   color: var(--fst-red); }
.gr-bosses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
</style>

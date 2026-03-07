<template>
  <div class="fst-committee">
    <Toast position="bottom-center" />


    <!-- ═══ Conclusion Dialog ═══ -->
    <Dialog v-model:visible="conclusionVisible" :header="conclusionHeader" modal
      :closable="true" :dismissable-mask="true"
      :style="{ width: 'min(94vw, 1100px)' }">
      <div v-if="session?.decision" class="fst-conclusion">
        <div class="fst-conclusion-score" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
          {{ session.decision.aggregatedScore }}/100
        </div>
        <div class="fst-conclusion-recommendation"
          :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
          <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
          {{ VERDICTS[session.decision.recommendation]?.label }}
        </div>
        <div class="fst-conclusion-section">
          <div class="fst-conclusion-label">Голоса агентов:</div>
          <div class="fst-votes-summary">
            <span v-for="(count, v) in session.decision.voteCounts" :key="v"
              v-show="count > 0" class="fst-vote-pill"
              :style="{ background: VERDICTS[v]?.color }">
              {{ VERDICTS[v]?.label }}: {{ count }}
            </span>
          </div>
        </div>
        <div v-if="session.decision.conditions?.length" class="fst-conclusion-section">
          <div class="fst-conclusion-label">Условия одобрения:</div>
          <ul class="fst-conditions-list">
            <li v-for="c in session.decision.conditions" :key="c">{{ c }}</li>
          </ul>
        </div>
        <!-- Цифровой двойник контракта — матрица сценариев -->
        <div class="fst-conclusion-section fst-scenario-section">
          <div class="fst-conclusion-label">Сценарии сделки (Цифровой двойник контракта):</div>
          <ScenarioNodesPanel
            :decision="session.decision"
            :project="session.project"
            :contract-nodes="session.contractNodes || null"
            :node-proposals="session.nodeProposals || []"
            :node-votes="session.nodeVotes || []"
            :negotiating="['NODE_NEGOTIATION','NODE_VOTING'].includes(session.phase)"
            :approved="(session.contractNodes || []).length > 0"
          />
        </div>

        <div v-if="session.decision.humanApproval" class="fst-human-result">
          <i class="pi pi-check-circle" style="color:#4caf50"></i>
          Решение комитета утверждено:
          <strong>{{ VERDICTS[session.decision.humanApproval.verdict]?.label }}</strong>
        </div>
      </div>
      <template #footer>
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <LearnTooltip
            label="Сохранить в базу знаний"
            what="Сохраняет решение инвесткомитета в граф знаний KAG — для будущего обучения AI-агентов на реальных кейсах"
            when="После завершения сессии ИК для накопления исторических решений"
            :terms="['KAG', 'База знаний', 'AI-обучение']"
          >
            <Button v-if="!kagSaved" label="Сохранить в базу знаний" icon="pi pi-database"
              severity="info" size="small" :loading="kagSaving" @click="saveToKag" />
          </LearnTooltip>
          <span v-if="kagSaved" class="fst-kag-saved">
            <i class="pi pi-check-circle" style="color:#4caf50"></i>
            Сохранено в KAG ({{ kagSavedCount }} сущностей)
          </span>
          <LearnTooltip
            label="Сохранить в СОД"
            what="Создаёт событие в системе объектных данных Integram — фиксирует решение ИК в корпоративной базе фонда"
            when="После завершения сессии ИК для официального документирования"
            :terms="['СОД', 'Integram', 'Протокол ИК']"
          >
            <Button v-if="!intSaved" label="Сохранить в СОД" icon="pi pi-sitemap"
              severity="secondary" size="small" :loading="intSaving" @click="saveToIntegram" />
          </LearnTooltip>
          <span v-if="intSaved" class="fst-kag-saved">
            <i class="pi pi-check-circle" style="color:#7e57c2"></i>
            СОД #{{ intEventId }}
          </span>
          <LearnTooltip
            label="Новая сессия"
            what="Сбрасывает текущую сессию и возвращает к выбору проекта для оценки"
            when="После просмотра результатов текущей сессии инвесткомитета"
            :terms="['Сессия комитета', 'Инвесткомитет']"
          >
            <Button label="Новая сессия" icon="pi pi-refresh" severity="secondary" @click="resetSession"
              style="margin-left:auto" />
          </LearnTooltip>
        </div>
      </template>
    </Dialog>

    <!-- ═══ Main Dashboard ═══ -->
    <div v-if="session" class="fst-dashboard">

      <!-- Top Toolbar -->
      <div class="fst-toolbar">
        <div class="fst-toolbar-left">
          <span class="fst-logo">
            <i class="pi pi-building" style="color:#ffa726"></i>
            ФСТ НТИ · Инвесткомитет
          </span>
          <span class="fst-project-name">{{ session.project.title }}</span>
        </div>
        <div class="fst-toolbar-center">
          <div class="fst-phase-track">
            <div v-for="(ph, idx) in visiblePhases" :key="ph.id"
              :class="['fst-phase-step', {
                'fst-phase-step--done': phaseIdx > idx,
                'fst-phase-step--active': phaseIdx === idx,
              }]">
              <div class="fst-phase-dot" :style="{ background: phaseIdx >= idx ? ph.color : 'transparent', borderColor: ph.color }">
                <i v-if="phaseIdx > idx" class="pi pi-check" style="font-size:9px;color:#fff"></i>
              </div>
              <div class="fst-phase-label">{{ ph.label }}</div>
            </div>
          </div>
        </div>
        <div class="fst-toolbar-right">
          <Tag :value="currentPhase.label" :style="{ background: currentPhase.color }" class="fst-phase-tag" />
          <Button v-if="running" icon="pi pi-pause" size="small" text severity="secondary" @click="pauseSession" />
          <Button icon="pi pi-sliders-h" label="Настройки" size="small" text severity="secondary"
            @click="policyExpanded = !policyExpanded" title="Параметры оценки ФСТ" />
          <Button icon="pi pi-question-circle" size="small" text severity="secondary" @click="toggleHelp" title="Помощь по странице" />
          <Button icon="pi pi-times" size="small" text severity="secondary" @click="resetSession" />
        </div>
      </div>

      <!-- Main Layout -->
      <div class="fst-main">

        <!-- Left: Agents Panel -->
        <div class="fst-agents-panel">
          <div class="fst-panel-title">AI Агенты комитета</div>
          <div class="fst-agents-list">
            <div v-for="agent in AGENTS" :key="agent.id"
              :class="['fst-agent-card', {
                'fst-agent-card--thinking': agentStatus(agent.id).thinking,
                'fst-agent-card--voted': agentStatus(agent.id).vote,
              }]"
              :style="{ '--agent-color': agent.color }">
              <div class="fst-agent-avatar">
                <span class="fst-agent-emoji">{{ agent.avatar }}</span>
                <span v-if="agentStatus(agent.id).thinking" class="fst-agent-thinking-pulse"></span>
              </div>
              <div class="fst-agent-info">
                <div class="fst-agent-name">{{ agent.name }}</div>
                <div class="fst-agent-role-label">{{ agent.description.slice(0, 50) }}...</div>
                <div v-if="agentStatus(agent.id).thinking" class="fst-agent-think-text">
                  <i class="pi pi-spin pi-spinner" style="font-size:10px"></i>
                  {{ agentStatus(agent.id).thinkText }}
                </div>
                <div v-else-if="agentStatus(agent.id).vote" class="fst-agent-vote-badge"
                  :style="{ background: VERDICTS[agentStatus(agent.id).vote]?.color }">
                  <i :class="VERDICTS[agentStatus(agent.id).vote]?.icon"></i>
                  {{ agentStatus(agent.id).voteScore }}/100
                </div>
                <div v-else-if="agentStatus(agent.id).done" class="fst-agent-ready">
                  <i class="pi pi-check" style="color:#4caf50;font-size:10px"></i> Готов
                </div>
              </div>
              <div class="fst-agent-weight">{{ Math.round(agent.weight * 100) }}%</div>
            </div>
          </div>

          <!-- Project Mini Card -->
          <div class="fst-project-mini">
            <div class="fst-project-mini-title">{{ session.project.title }}</div>
            <div class="fst-project-mini-row">
              <span>Субфонд:</span>
              <span :style="{ color: SUBFUNDS[session.project.subFund]?.color }">
                {{ SUBFUNDS[session.project.subFund]?.name }}
              </span>
            </div>
            <div class="fst-project-mini-row">
              <span>Запрос:</span>
              <strong>{{ (session.project.requestedAmount / 1e6).toFixed(0) }} млн ₽</strong>
            </div>
            <div class="fst-project-mini-row">
              <span>TRL / MRL:</span>
              <span>{{ session.project.trl }} / {{ session.project.mrl }}</span>
            </div>
            <div class="fst-project-mini-row">
              <span>Суверенность:</span>
              <span :class="sovClass(session.project.sovereigntyScore)">{{ session.project.sovereigntyScore }}/9</span>
            </div>
            <div class="fst-project-mini-row">
              <span>Рынок:</span>
              <span>{{ (session.project.marketSize / 1e9).toFixed(1) }} млрд ₽</span>
            </div>
          </div>
        </div>

        <!-- Center: Debate Timeline / Graph -->
        <div class="fst-debate-panel">
          <div class="fst-panel-title">
            <div class="fst-debate-tabs">
              <button :class="['fst-dtab', { 'fst-dtab--active': debateTab === 'timeline' }]"
                @click="debateTab = 'timeline'">
                <i class="pi pi-comments"></i> Дебаты
                <span class="fst-arg-count">{{ session.arguments.length }}</span>
              </button>
              <button :class="['fst-dtab', { 'fst-dtab--active': debateTab === 'graph' }]"
                @click="debateTab = 'graph'">
                <i class="pi pi-sitemap"></i> Граф событий
              </button>
              <button :class="['fst-dtab', { 'fst-dtab--active': debateTab === 'links' }]"
                @click="debateTab = 'links'">
                <i class="pi pi-share-alt"></i> Граф связей
                <span v-if="portfolioOverlaps.length" class="fst-arg-count" style="background:#ef4444">
                  {{ portfolioOverlaps.length }}
                </span>
              </button>
            </div>
          </div>

          <!-- Portfolio overlap alert -->
          <div v-if="portfolioOverlaps.length && debateTab !== 'links'" class="fst-overlap-alert">
            <i class="pi pi-exclamation-triangle" style="color:#ffa726" />
            <span>Пересечение с портфелем:</span>
            <span v-for="(o, i) in portfolioOverlaps.slice(0,3)" :key="i" class="fst-overlap-pill">
              {{ o.companyName }} → {{ o.conceptName }}
            </span>
            <button class="fst-overlap-link" @click="debateTab = 'links'">Граф →</button>
          </div>

          <!-- Graph Panel -->
          <DebateGraphPanel v-if="debateTab === 'graph'" :session="session" class="fst-graph-panel" />

          <!-- Links Graph Panel -->
          <LinksGraphViz v-if="debateTab === 'links'" class="fst-graph-panel" />

          <div v-show="debateTab === 'timeline'" class="fst-timeline" ref="timelineEl">
            <!-- Loading phase -->
            <div v-if="session.phase === 'LOADING'" class="fst-loading-phase">
              <div class="fst-loading-title">
                <i class="pi pi-file-search"></i> Агенты изучают документацию...
              </div>
              <div v-for="agent in AGENTS" :key="agent.id" class="fst-loading-agent">
                <span class="fst-la-avatar">{{ agent.avatar }}</span>
                <div class="fst-la-bar-wrap">
                  <div class="fst-la-name">{{ agent.shortName }}</div>
                  <div class="fst-la-bar">
                    <div class="fst-la-bar-fill"
                      :style="{ background: agent.color, width: agentStatus(agent.id).done ? '100%' : agentStatus(agent.id).thinking ? '65%' : '0%' }"></div>
                  </div>
                </div>
                <div class="fst-la-status">
                  <i v-if="agentStatus(agent.id).done" class="pi pi-check" style="color:#4caf50"></i>
                  <i v-else-if="agentStatus(agent.id).thinking" class="pi pi-spin pi-spinner" style="color:#42a5f5"></i>
                  <i v-else class="pi pi-clock" style="color:#78909c"></i>
                </div>
              </div>
            </div>

            <!-- Arguments stream -->
            <TransitionGroup name="fst-arg" tag="div" class="fst-args-stream">
              <div v-for="arg in session.arguments" :key="arg.id"
                :class="['fst-argument', `fst-arg-type--${arg.type.toLowerCase()}`,
                  arg.targetArgId ? 'fst-argument--counter' : '']">
                <div class="fst-arg-header">
                  <span class="fst-arg-avatar">{{ agentById(arg.agentId)?.avatar }}</span>
                  <span class="fst-arg-agent-name" :style="{ color: agentById(arg.agentId)?.color }">
                    {{ agentById(arg.agentId)?.name }}
                  </span>
                  <span class="fst-arg-type-badge">{{ argTypeLabel(arg.type) }}</span>
                  <span class="fst-arg-dim">{{ arg.dimension }}</span>
                  <span v-if="arg.aiGenerated" class="fst-arg-ai-badge"
                    :title="arg.model ? `Модель: ${arg.model}` : 'Сгенерировано реальным AI'">
                    <i class="pi pi-bolt"></i> {{ arg.model ? arg.model.split('/').pop() : 'AI' }}
                  </span>
                  <span v-else class="fst-arg-tpl-badge" title="Шаблонный аргумент">
                    <i class="pi pi-server"></i>
                  </span>
                </div>
                <!-- Reply-to quote -->
                <div v-if="arg.targetArgId" class="fst-arg-reply">
                  <span class="fst-arg-reply-arrow">↩</span>
                  <span class="fst-arg-reply-who"
                    :style="{ color: agentById(session.arguments.find(a => a.id === arg.targetArgId)?.agentId)?.color }">
                    {{ agentById(session.arguments.find(a => a.id === arg.targetArgId)?.agentId)?.shortName || '?' }}:
                  </span>
                  <span class="fst-arg-reply-text">
                    {{ (session.arguments.find(a => a.id === arg.targetArgId)?.text || '').slice(0, 90) }}{{ (session.arguments.find(a => a.id === arg.targetArgId)?.text || '').length > 90 ? '…' : '' }}
                  </span>
                </div>
                <div class="fst-arg-text">{{ arg.text }}</div>
              </div>
            </TransitionGroup>

            <!-- Voting in progress -->
            <div v-if="session.phase === 'VOTING' && session.votes.length > 0" class="fst-vote-stream">
              <div class="fst-vote-title"><i class="pi pi-check-square"></i> Голосование агентов</div>
              <TransitionGroup name="fst-arg" tag="div">
                <div v-for="vote in session.votes" :key="vote.id" class="fst-vote-row">
                  <span class="fst-vote-avatar">{{ agentById(vote.agentId)?.avatar }}</span>
                  <span class="fst-vote-name" :style="{ color: agentById(vote.agentId)?.color }">
                    {{ agentById(vote.agentId)?.shortName }}
                  </span>
                  <span class="fst-vote-pill-sm" :style="{ background: VERDICTS[vote.verdict]?.color }">
                    {{ VERDICTS[vote.verdict]?.label }}
                  </span>
                  <span class="fst-vote-score">{{ vote.score }}/100</span>
                  <div class="fst-vote-conf-bar">
                    <div :style="{ width: (vote.confidence * 100) + '%', background: agentById(vote.agentId)?.color }"></div>
                  </div>
                </div>
              </TransitionGroup>
            </div>

            <!-- Empty state -->
            <div v-if="session.phase === 'IDLE'" class="fst-empty-state">
              <i class="pi pi-comments" style="font-size:40px;color:#444;margin-bottom:12px"></i>
              <div>Сессия готова. Запуск...</div>
            </div>
          </div><!-- /fst-timeline -->
        </div><!-- /fst-debate-panel -->

        <!-- Right: Scoring + Decision -->
        <div class="fst-score-panel">
          <div class="fst-panel-title">Скоринг проекта</div>

          <!-- Radar-style score display -->
          <div class="fst-radar-container">
            <svg viewBox="0 0 200 200" class="fst-radar-svg">
              <!-- Background rings -->
              <circle cx="100" cy="100" r="80" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="60" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="40" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="20" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>

              <!-- Axes -->
              <line v-for="(ax, i) in radarAxes" :key="i"
                x1="100" y1="100"
                :x2="100 + Math.cos(ax.angle - Math.PI/2) * 80"
                :y2="100 + Math.sin(ax.angle - Math.PI/2) * 80"
                stroke="#444" stroke-width="0.5"/>

              <!-- Score polygon -->
              <polygon :points="radarPoints" fill="rgba(66,165,245,0.2)" stroke="#42a5f5" stroke-width="1.5"/>

              <!-- Labels -->
              <text v-for="(ax, i) in radarAxes" :key="'l'+i"
                :x="100 + Math.cos(ax.angle - Math.PI/2) * 92"
                :y="100 + Math.sin(ax.angle - Math.PI/2) * 92"
                text-anchor="middle" dominant-baseline="middle"
                fill="#aaa" font-size="8">{{ ax.label }}</text>
            </svg>
          </div>

          <!-- Dim scores bars -->
          <div class="fst-dim-bars">
            <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-dim-bar-row">
              <div class="fst-dim-label">{{ dim.label }}</div>
              <div class="fst-dim-bar-bg">
                <div class="fst-dim-bar-fill"
                  :style="{ width: ((session.dimScores[key] || 0) * 100) + '%', background: dim.color }">
                </div>
              </div>
              <div class="fst-dim-value" :style="{ color: dim.color }">
                {{ Math.round((session.dimScores[key] || 0) * 100) }}
              </div>
            </div>
          </div>

          <!-- Aggregate Score -->
          <div v-if="session.decision" class="fst-agg-score">
            <div class="fst-agg-score-label">Итоговый балл</div>
            <div class="fst-agg-score-value" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
              {{ session.decision.aggregatedScore }}<span style="font-size:16px;opacity:0.6">/100</span>
            </div>
            <div class="fst-agg-rec" :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
              <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
              {{ VERDICTS[session.decision.recommendation]?.label }}
            </div>
          </div>

          <!-- Vote distribution -->
          <div v-if="session.votes.length > 0" class="fst-vote-dist">
            <div class="fst-panel-subtitle">Распределение голосов</div>
            <div class="fst-vote-dist-bars">
              <div v-for="(v, id) in VERDICTS" :key="id" class="fst-vote-dist-row">
                <span class="fst-vd-label">{{ v.label }}</span>
                <div class="fst-vd-bar-bg">
                  <div class="fst-vd-bar-fill" :style="{ width: voteBarWidth(id), background: v.color }"></div>
                </div>
                <span class="fst-vd-count">{{ voteCount(id) }}</span>
              </div>
            </div>
          </div>

          <!-- Conditions -->
          <div v-if="session.decision?.conditions?.length" class="fst-conditions">
            <div class="fst-panel-subtitle">Условия одобрения</div>
            <ul class="fst-cond-list">
              <li v-for="c in session.decision.conditions" :key="c" class="fst-cond-item">
                <i class="pi pi-angle-right" style="color:#ffa726;font-size:10px"></i> {{ c }}
              </li>
            </ul>
          </div>

          <!-- Key Risks -->
          <div v-if="session.decision?.risks?.length" class="fst-risks">
            <div class="fst-panel-subtitle">Ключевые риски</div>
            <ul class="fst-risk-list">
              <li v-for="r in session.decision.risks.slice(0,3)" :key="r" class="fst-risk-item">
                <i class="pi pi-exclamation-triangle" style="color:#ef5350;font-size:10px"></i> {{ r }}
              </li>
            </ul>
          </div>

          <!-- Financial Calculator -->
          <div class="fst-fin-calc-wrap">
            <FinancialCalculator
              :initial-ic="currentProject?.askRub || 100"
              :initial-wacc="fstPolicy.wacc || 18"
              :initial-cf="currentProject?.projectedCf || [0, 20, 40, 60, 80]"
              @metrics="onFinMetrics"
            />
          </div>

          <!-- Human Approval Panel -->
          <div v-if="session.phase === 'HUMAN_APPROVAL'" class="fst-human-panel">
            <div class="fst-panel-subtitle" style="color:#ffa726">
              <i class="pi pi-users"></i> Утверждение инвесткомитета
            </div>
            <p class="fst-human-prompt">
              AI-агенты вынесли рекомендацию. Члены комитета принимают окончательное решение:
            </p>
            <div class="fst-human-comment-row">
              <InputText v-model="humanComment" placeholder="Комментарий (опционально)" class="fst-human-comment" size="small" />
            </div>
            <div class="fst-human-buttons">
              <LearnTooltip
                label="Утвердить"
                what="Председатель комитета утверждает рекомендацию AI-агентов. Проект переходит к структурированию сделки."
                when="Когда согласны с решением агентов и готовы двигаться к Term Sheet"
                :terms="['Одобрение', 'Term Sheet', 'Инвесткомитет']"
              >
                <Button label="Утвердить" icon="pi pi-check" severity="success" size="small"
                  @click="humanDecide('APPROVE')" />
              </LearnTooltip>
              <LearnTooltip
                label="Отложить"
                what="Откладывает решение — проект остаётся в воронке для повторного рассмотрения после получения доп. информации"
                when="Когда нужна дополнительная информация: финмодель, DD, юр. проверка"
                :terms="['Due Diligence', 'Воронка сделок', 'Скрининг']"
              >
                <Button label="Отложить" icon="pi pi-clock" severity="warning" size="small"
                  @click="humanDecide('DEFER')" />
              </LearnTooltip>
              <LearnTooltip
                label="Отклонить"
                what="Проект не проходит критерии ФСТ НТИ. Решение фиксируется в протоколе."
                when="Когда проект не соответствует стратегии фонда или минимальным критериям отбора"
                :terms="['Критерии отбора', 'Протокол ИК', 'Политика фонда']"
              >
                <Button label="Отклонить" icon="pi pi-times" severity="danger" size="small"
                  @click="humanDecide('REJECT')" />
              </LearnTooltip>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ═══ Setup Screen ═══ -->
    <div v-else class="fst-setup">
      <div class="fst-setup-header">
        <div class="fst-setup-brand">
          <i class="pi pi-building"></i>
          ФСТ НТИ — AI Инвестиционный Комитет
        </div>
        <p class="fst-setup-desc">6 AI-агентов анализируют проект, дебатируют и выносят решение с обоснованием</p>
        <div class="fst-setup-subfunds" v-if="Object.keys(SUBFUNDS).length">
          <div v-for="sf in Object.values(SUBFUNDS)" :key="sf.id" class="fst-subfund-badge"
            :style="{ borderColor: sf.color, color: sf.color }">
            <i :class="sf.icon"></i> {{ sf.name }}
            <span class="fst-subfund-budget">{{ (sf.budget / 1e9).toFixed(1) }} млрд</span>
          </div>
        </div>
      </div>

      <!-- ═══ Project Detail Modal ═══ -->
      <Dialog v-model:visible="projectModalVisible" modal
        :closable="true" :dismissable-mask="true"
        :style="{ width: '560px', maxWidth: '95vw' }"
        :header="previewProject?.title || ''"
        :pt="{ header: { style: 'border-bottom: 3px solid ' + (SUBFUNDS[previewProject?.subFund]?.color || '#ffa726') } }">
        <div v-if="previewProject" class="fst-pmodal">
          <div class="fst-pmodal-top">
            <div class="fst-pmodal-subfund" :style="{ background: SUBFUNDS[previewProject.subFund]?.color || '#666' }">
              <i :class="SUBFUNDS[previewProject.subFund]?.icon"></i>
              {{ SUBFUNDS[previewProject.subFund]?.name || previewProject.subFund }}
            </div>
            <div class="fst-pmodal-stage">{{ previewProject.stage }}</div>
          </div>

          <div class="fst-pmodal-company">
            <i class="pi pi-building"></i> {{ previewProject.company }}
          </div>

          <div class="fst-pmodal-metrics">
            <div class="fst-pmodal-metric">
              <div class="fst-pmodal-metric-val">{{ (previewProject.requestedAmount / 1e6).toFixed(0) }} млн ₽</div>
              <div class="fst-pmodal-metric-label">Запрашиваемая сумма</div>
            </div>
            <div class="fst-pmodal-metric">
              <div class="fst-pmodal-metric-val" :class="trlClass(previewProject.trl)">TRL {{ previewProject.trl }}</div>
              <div class="fst-pmodal-metric-label">Готовность технологии</div>
            </div>
            <div class="fst-pmodal-metric">
              <div class="fst-pmodal-metric-val" :class="trlClass(previewProject.mrl - 1)">MRL {{ previewProject.mrl }}</div>
              <div class="fst-pmodal-metric-label">Рыночная готовность</div>
            </div>
            <div class="fst-pmodal-metric">
              <div class="fst-pmodal-metric-val" :class="sovClass(previewProject.sovereigntyScore)">{{ previewProject.sovereigntyScore }}/9</div>
              <div class="fst-pmodal-metric-label">Суверенность</div>
            </div>
            <div class="fst-pmodal-metric">
              <div class="fst-pmodal-metric-val" :class="irrClass(previewProject.projectedIRR)">{{ (previewProject.projectedIRR * 100).toFixed(0) }}%</div>
              <div class="fst-pmodal-metric-label">Прогноз IRR</div>
            </div>
            <div class="fst-pmodal-metric" v-if="previewProject.marketSize">
              <div class="fst-pmodal-metric-val">{{ (previewProject.marketSize / 1e9).toFixed(1) }} млрд</div>
              <div class="fst-pmodal-metric-label">Объём рынка</div>
            </div>
          </div>

          <div v-if="previewProject.description" class="fst-pmodal-desc">
            {{ previewProject.description }}
          </div>

          <div v-if="previewProject.tags?.length" class="fst-pmodal-tags">
            <span v-for="t in previewProject.tags" :key="t" class="fst-pmodal-tag">{{ t }}</span>
          </div>

          <!-- Policy check -->
          <div class="fst-pmodal-check">
            <div :class="['fst-pmodal-check-item', previewProject.trl >= fstPolicy.minTRL ? 'pass' : 'fail']">
              <i :class="previewProject.trl >= fstPolicy.minTRL ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
              TRL ≥ {{ fstPolicy.minTRL }} (есть {{ previewProject.trl }})
            </div>
            <div :class="['fst-pmodal-check-item', previewProject.mrl >= fstPolicy.minMRL ? 'pass' : 'fail']">
              <i :class="previewProject.mrl >= fstPolicy.minMRL ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
              MRL ≥ {{ fstPolicy.minMRL }} (есть {{ previewProject.mrl }})
            </div>
            <div :class="['fst-pmodal-check-item', previewProject.sovereigntyScore >= fstPolicy.minSovereignty ? 'pass' : 'fail']">
              <i :class="previewProject.sovereigntyScore >= fstPolicy.minSovereignty ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
              Суверенность ≥ {{ fstPolicy.minSovereignty }}/9 (есть {{ previewProject.sovereigntyScore }})
            </div>
          </div>
        </div>
        <template #footer>
          <Button label="Отмена" severity="secondary" text @click="projectModalVisible = false" />
          <Button
            :label="selectedProjectId === previewProject?.id ? 'Выбран ✓' : 'Выбрать проект'"
            :severity="selectedProjectId === previewProject?.id ? 'success' : 'primary'"
            icon="pi pi-check"
            @click="selectProject(previewProject)"
          />
        </template>
      </Dialog>

      <div class="fst-setup-body">
        <!-- Projects Grid -->
        <div class="fst-setup-col fst-setup-col--projects">
          <div class="fst-setup-section-title">
            <i class="pi pi-th-large" style="color:#38bdf8"></i>
            Выберите проект для рассмотрения
            <span v-if="selectedProjectId" class="fst-selected-badge">
              <i class="pi pi-check-circle"></i> Выбран
            </span>
          </div>
          <div class="fst-project-grid">
            <div v-if="PROJECTS_POOL.length === 0" class="fst-setup-empty">
              <i class="pi pi-spin pi-spinner"></i> Загрузка проектов...
            </div>
            <div v-for="p in PROJECTS_POOL" :key="p.id"
              :class="['fst-pcard', { 'fst-pcard--selected': selectedProjectId === p.id }]"
              :style="{ '--pc': SUBFUNDS[p.subFund]?.color || '#667eea' }"
              @click="openProjectModal(p)">
              <!-- Top stripe -->
              <div class="fst-pcard-stripe"></div>
              <!-- Selected indicator -->
              <div v-if="selectedProjectId === p.id" class="fst-pcard-checkmark">
                <i class="pi pi-check"></i>
              </div>
              <!-- Subfund + Stage -->
              <div class="fst-pcard-top">
                <span class="fst-pcard-subfund" :style="{ background: SUBFUNDS[p.subFund]?.color || '#666' }">
                  {{ SUBFUNDS[p.subFund]?.shortName || p.subFund?.toUpperCase() }}
                </span>
                <span class="fst-pcard-stage">{{ p.stage }}</span>
              </div>
              <!-- Title -->
              <div class="fst-pcard-title">{{ p.title }}</div>
              <!-- Company -->
              <div class="fst-pcard-company">
                <i class="pi pi-building"></i> {{ p.company }}
              </div>
              <!-- Amount -->
              <div class="fst-pcard-amount">{{ (p.requestedAmount / 1e6).toFixed(0) }} млн ₽</div>
              <!-- Metrics -->
              <div class="fst-pcard-metrics">
                <span class="fst-metric" :class="trlClass(p.trl)">TRL {{ p.trl }}</span>
                <span class="fst-metric" :class="trlClass(p.mrl - 1)">MRL {{ p.mrl }}</span>
                <span class="fst-metric" :class="sovClass(p.sovereigntyScore)">{{ p.sovereigntyScore }}/9</span>
                <span class="fst-metric" :class="irrClass(p.projectedIRR)">IRR {{ (p.projectedIRR * 100).toFixed(0) }}%</span>
              </div>
              <!-- Click hint -->
              <div class="fst-pcard-hint">
                <i class="pi pi-eye"></i> Подробнее
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Settings -->
        <div class="fst-setup-col fst-setup-col--settings">
          <div class="fst-setup-section-title">
            <i class="pi pi-gauge" style="color:#a78bfa"></i>
            Скорость симуляции
          </div>
          <div class="fst-speed-row">
            <div v-for="sp in speedOptions" :key="sp.id"
              :class="['fst-speed-btn', { active: selectedSpeed === sp.id }]"
              @click="selectedSpeed = sp.id">
              {{ sp.label }}
            </div>
          </div>

          <div class="fst-setup-section-title" style="margin-top:20px">
            <i class="pi pi-bolt" style="color:#a78bfa"></i>
            Режим агентов
          </div>
          <div class="fst-ai-mode-row">
            <div :class="['fst-ai-toggle', { 'fst-ai-toggle--on': useAI }]" @click="useAI = !useAI">
              <div class="fst-ai-toggle-knob"></div>
            </div>
            <div class="fst-ai-mode-label">
              <span v-if="useAI">
                <i class="pi pi-bolt" style="color:#a78bfa"></i>
                <strong>Реальный AI</strong> — агенты думают и отвечают друг другу
              </span>
              <span v-else>
                <i class="pi pi-server" style="color:#78909c"></i>
                <strong>Шаблоны</strong> — быстрая симуляция без API-вызовов
              </span>
            </div>
          </div>

          <!-- ═══ Настройки моделей оркестратора ═══ -->
          <div v-if="useAI" class="fst-setup-section-title" style="margin-top:20px">
            <div class="fst-policy-toggle" @click="modelPanelExpanded = !modelPanelExpanded">
              <i class="pi pi-microchip-ai" style="color:#42a5f5"></i>
              <span>Модели агентов</span>
              <span class="fst-policy-summary">{{ activeProfileLabel }}</span>
              <i :class="modelPanelExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                style="margin-left:auto;font-size:11px;color:var(--p-text-muted-color)"></i>
            </div>
          </div>
          <div v-if="useAI && modelPanelExpanded" class="fst-model-panel">
            <!-- Профили скорости -->
            <div class="fst-model-profiles">
              <div v-for="(profile, key) in SPEED_PROFILES" :key="key"
                :class="['fst-profile-btn', { 'fst-profile-btn--active': selectedSpeedProfile === key }]"
                @click="applySpeedProfile(key)">
                {{ profile.label }}
              </div>
            </div>
            <div class="fst-model-profile-desc">{{ SPEED_PROFILES[selectedSpeedProfile]?.description }}</div>

            <!-- Таблица: агент → модель -->
            <div class="fst-agent-model-grid">
              <div v-for="agent in AGENTS" :key="agent.id" class="fst-agent-model-row">
                <span class="fst-am-avatar" :style="{ color: agent.color }">{{ agent.avatar }}</span>
                <span class="fst-am-name">{{ agent.shortName }}</span>
                <select class="fst-am-select"
                  :value="agentModelOverrides[agent.id] || resolvedModels[agent.id]"
                  @change="e => setAgentModel(agent.id, e.target.value)">
                  <option v-for="m in COMMITTEE_MODELS" :key="m.id" :value="m.id">
                    {{ m.label }} · {{ m.description }}
                  </option>
                </select>
              </div>
            </div>
            <button class="fst-model-reset-btn" @click="resetModelOverrides">
              <i class="pi pi-refresh"></i> Сбросить к профилю
            </button>
          </div>

          <div class="fst-setup-section-title" style="margin-top:20px">
            <div class="fst-policy-toggle" @click="policyExpanded = !policyExpanded">
              <i class="pi pi-sliders-h" style="color:#ffa726"></i>
              <span>Параметры оценки ФСТ</span>
              <span class="fst-policy-summary">Сув. ≥ {{ fstPolicy.minSovereignty }}/9 · TRL ≥ {{ fstPolicy.minTRL }}</span>
              <i :class="policyExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                style="margin-left:auto;font-size:11px;color:var(--p-text-muted-color)"></i>
            </div>
          </div>
          <div v-if="policyExpanded" class="fst-policy-grid">
            <div v-for="(range, key) in FST_POLICY_RANGES" :key="key" class="fst-policy-item">
              <div class="fst-policy-label">{{ range.label }}: <b>{{ formatPolicyValue(key, fstPolicy[key]) }}</b></div>
              <Slider
                :modelValue="policySliderValue(key, fstPolicy[key])"
                @update:modelValue="v => setPolicyFromSlider(key, v)"
                :min="range.min * policyMultiplier(key)"
                :max="range.max * policyMultiplier(key)"
                :step="range.step * policyMultiplier(key)"
                class="fst-policy-slider"
              />
            </div>
            <Button label="Сброс" icon="pi pi-refresh" size="small" severity="secondary" text
              @click="resetPolicy" style="margin-top:4px" />
          </div>

          <div class="fst-setup-launch">
            <Button
              label="Запустить инвесткомитет"
              icon="pi pi-play"
              severity="success"
              size="large"
              :disabled="!selectedProjectId"
              @click="startSession"
              class="fst-launch-btn"
            />
            <div v-if="!selectedProjectId" class="fst-launch-hint">Выберите проект слева</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Page Help Drawer -->
  <PageHelpDrawer v-model:visible="helpOpen" :page-help="pageHelp" />
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Slider from 'primevue/slider'
import { FstCommitteeEngine, createSession } from '@/components/fst-committee/FstCommitteeEngine.js'
import {
  AGENTS, SCORING_DIMS, PHASES, PHASE_ORDER, VERDICTS,
  SPEED_MULTIPLIERS,
  FST_POLICY_DEFAULTS, FST_POLICY_RANGES,
} from '@/components/fst-committee/FstCommitteeConfig.js'
import {
  COMMITTEE_MODELS, SPEED_PROFILES, buildModelMap, getModelSummary, resolveModel
} from '@/components/fst-committee/fstCommitteeModelOrchestrator.js'
import { saveDecision, createProject, saveCommitteeSession, authenticate, STATUSES } from '@/services/fstApi'
import { saveSessionToKag, saveSessionToIntegram } from '@/components/fst-committee/fstCommitteeAI.js'
import FinancialCalculator from '@/components/fst-committee/FinancialCalculator.vue'
import DebateGraphPanel from '@/components/fst-committee/DebateGraphPanel.vue'
import ScenarioNodesPanel from '@/components/fst-committee/ScenarioNodesPanel.vue'
import LinksGraphViz from '@/components/links/LinksGraphViz.vue'
import { useFstData } from '@/composables/useFstData.js'
import LearnTooltip from '@/components/LearnTooltip.vue'
import PageHelpDrawer from '@/components/PageHelpDrawer.vue'
import { usePageHelp } from '@/composables/usePageHelp'

// ── Load FST Data ─────────────────────────────────────────────────

const { projects: PROJECTS_POOL, subfunds: SUBFUNDS, loadProjects, loadSubfunds } = useFstData()

// Load data on component mount
onMounted(async () => {
  await loadProjects()
  await loadSubfunds()
  // Set initial project after data loads
  if (PROJECTS_POOL.value.length > 0 && !selectedProjectId.value) {
    selectedProjectId.value = PROJECTS_POOL.value[0].id
  }
})

// ── State ─────────────────────────────────────────────────────

// Page Help
const { isOpen: helpOpen, pageHelp, toggleHelp } = usePageHelp('fst-committee')

const conclusionVisible = ref(false)
const projectModalVisible = ref(false)
const previewProject = ref(null)
const selectedProjectId = ref(null)
const selectedSpeed = ref('normal')
const useAI = ref(true)
const policyExpanded = ref(false)

// ── Оркестратор моделей ────────────────────────────────────────
const modelPanelExpanded = ref(false)
const selectedSpeedProfile = ref('fast')
const agentModelOverrides = ref({})  // { [agentId]: modelId } — переопределения пользователя

const resolvedModels = computed(() =>
  buildModelMap(AGENTS.map(a => a.id), selectedSpeedProfile.value, agentModelOverrides.value)
)

const activeProfileLabel = computed(() => {
  const summary = getModelSummary(resolvedModels.value)
  return summary || SPEED_PROFILES[selectedSpeedProfile.value]?.label
})

function applySpeedProfile(profileKey) {
  selectedSpeedProfile.value = profileKey
  agentModelOverrides.value = {}  // сбрасываем ручные override при смене профиля
}

function setAgentModel(agentId, modelId) {
  agentModelOverrides.value = { ...agentModelOverrides.value, [agentId]: modelId }
}

function resetModelOverrides() {
  agentModelOverrides.value = {}
}
const humanComment = ref('')
const session = ref(null)
const running = ref(false)
const timelineEl = ref(null)

const fstPolicy = ref({ ...FST_POLICY_DEFAULTS })

// Debate view tab
const debateTab = ref('timeline')
const portfolioOverlaps = ref([])

// KAG save state
const kagSaving    = ref(false)
const kagSaved     = ref(false)
const kagSavedCount = ref(0)

// Integram СОД save state
const intSaving  = ref(false)
const intSaved   = ref(false)
const intEventId = ref(null)

async function saveToIntegram() {
  if (!session.value || intSaving.value) return
  intSaving.value = true
  try {
    const result = await saveSessionToIntegram(session.value)
    if (result.eventId) {
      intEventId.value = result.eventId
      intSaved.value = true
    } else {
      console.error('Integram save error:', result.error)
    }
  } catch (e) {
    console.error('Integram save error:', e)
  } finally {
    intSaving.value = false
  }
}

async function saveToKag() {
  if (!session.value || kagSaving.value) return
  kagSaving.value = true
  try {
    const result = await saveSessionToKag(session.value)
    kagSavedCount.value = result.saved || 0
    kagSaved.value = true
  } catch (e) {
    console.error('KAG save error:', e)
  } finally {
    kagSaving.value = false
  }
}

// Финансовый калькулятор
const finMetrics = ref({ npv: null, irr: null, pi: null, gatePass: false })
const currentProject = computed(() => PROJECTS_POOL.value.find(p => p.id === selectedProjectId.value))

function onFinMetrics(m) {
  finMetrics.value = m
}

let engine = null

// ── Speed Options ─────────────────────────────────────────────

const speedOptions = [
  { id: 'slow',   label: '1x — Полный' },
  { id: 'normal', label: '2.5x — Быстрый' },
  { id: 'fast',   label: '6x — Демо' },
]

// ── Computed ──────────────────────────────────────────────────

const visiblePhases = computed(() =>
  PHASE_ORDER.slice(1, -1).map(id => PHASES[id])
)

const phaseIdx = computed(() => {
  if (!session.value) return 0
  return PHASE_ORDER.slice(1, -1).indexOf(session.value.phase)
})

const currentPhase = computed(() =>
  session.value ? PHASES[session.value.phase] : PHASES.IDLE
)

const conclusionHeader = computed(() => {
  const d = session.value?.decision
  if (!d) return 'Результат сессии'
  return `Решение комитета — ${d.aggregatedScore}/100`
})

// Radar chart helpers
const radarAxes = computed(() => {
  const dims = Object.keys(SCORING_DIMS)
  return dims.map((key, i) => ({
    key,
    label: SCORING_DIMS[key].label,
    angle: (i / dims.length) * 2 * Math.PI,
    color: SCORING_DIMS[key].color,
  }))
})

const radarPoints = computed(() => {
  if (!session.value) return ''
  const dimScores = session.value.dimScores
  const axes = radarAxes.value
  return axes.map(ax => {
    const val = (dimScores[ax.key] || 0) * 80
    const x = 100 + Math.cos(ax.angle - Math.PI / 2) * val
    const y = 100 + Math.sin(ax.angle - Math.PI / 2) * val
    return `${x},${y}`
  }).join(' ')
})

// ── Methods ───────────────────────────────────────────────────

function agentById(id) {
  return AGENTS.find(a => a.id === id)
}

function agentStatus(agentId) {
  return session.value?.agentStatus?.[agentId] || {}
}

function argTypeLabel(type) {
  const labels = { OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контр', SUMMARY: 'Итог' }
  return labels[type] || type
}

function voteCount(verdictId) {
  if (!session.value?.votes) return 0
  return session.value.votes.filter(v => v.verdict === verdictId).length
}

function voteBarWidth(verdictId) {
  const total = session.value?.votes?.length || 1
  return `${(voteCount(verdictId) / total) * 100}%`
}

function scoreColor(score) {
  if (score >= 72) return '#4caf50'
  if (score >= 50) return '#ffa726'
  return '#ef5350'
}

function trlClass(v) {
  if (v >= 6) return 'metric--good'
  if (v >= 4) return 'metric--warn'
  return 'metric--bad'
}
function sovClass(v) {
  if (v >= 7) return 'metric--good'
  if (v >= 5) return 'metric--warn'
  return 'metric--bad'
}
function irrClass(v) {
  if (v >= 0.30) return 'metric--good'
  if (v >= 0.22) return 'metric--warn'
  return 'metric--bad'
}

// ── FST Policy Helpers ────────────────────────────────────────

function policyMultiplier(key) {
  return key === 'minTRL' || key === 'minSovereignty' || key === 'minMRL' ? 1 : 100
}

function policySliderValue(key, val) {
  if (val == null) return 0
  const m = policyMultiplier(key)
  return m === 1 ? val : Math.round(val * 100)
}

function formatPolicyValue(key, val) {
  if (val == null) return '—'
  if (key === 'minTRL' || key === 'minSovereignty' || key === 'minMRL') return val.toString()
  return (val * 100).toFixed(0) + '%'
}

function setPolicyFromSlider(key, v) {
  const m = policyMultiplier(key)
  fstPolicy.value[key] = m === 1 ? v : v / 100
}

function openProjectModal(p) {
  previewProject.value = p
  projectModalVisible.value = true
}

function selectProject(p) {
  selectedProjectId.value = p.id
  projectModalVisible.value = false
}

function resetPolicy() {
  fstPolicy.value = { ...FST_POLICY_DEFAULTS }
}

// ── Session Management ────────────────────────────────────────

function startSession() {
  const project = PROJECTS_POOL.value.find(p => p.id === selectedProjectId.value)
  if (!project) return

  const sess = createSession(project, {
    speed:          selectedSpeed.value,
    policy:         { ...fstPolicy.value },
    useAI:          useAI.value,
    speedProfile:   selectedSpeedProfile.value,
    modelOverrides: { ...agentModelOverrides.value },
  })
  session.value = sess

  engine = new FstCommitteeEngine(sess, handleEvent)
  running.value = true
  engine.start().then(() => {
    running.value = false
  }).catch(() => {
    running.value = false
  })
}

function pauseSession() {
  if (engine) engine.stop()
  running.value = false
}

function resetSession() {
  if (engine) engine.stop()
  engine = null
  session.value = null
  running.value = false
  conclusionVisible.value = false
  humanComment.value = ''
  debateTab.value = 'timeline'
  kagSaved.value = false
  kagSavedCount.value = 0
  intSaved.value = false
  intEventId.value = null
}

function humanDecide(verdict) {
  if (engine && session.value?.phase === 'HUMAN_APPROVAL') {
    engine.humanDecide(verdict, humanComment.value, 'chair')
  }
}

// ── Event Handler ─────────────────────────────────────────────

function handleEvent(event) {
  // Синхронизируем примитивные поля из engine.session для реактивности
  if (session.value && engine?.session) {
    const s = engine.session
    session.value.phase = s.phase
    session.value.phaseIndex = s.phaseIndex
    session.value.decision = s.decision
    session.value.agentScores = s.agentScores
    session.value.revisionProgress = s.revisionProgress
    session.value.revisionStep = s.revisionStep
    session.value.revisedProject = s.revisedProject
    session.value.concludedAt = s.concludedAt
    session.value.nodeProposals = s.nodeProposals
    session.value.contractNodes = s.contractNodes
    session.value.nodeVotes = s.nodeVotes
  }

  if (event.type === 'PortfolioOverlapDetected') {
    portfolioOverlaps.value = event.overlaps || []
  }

  if (event.type === 'ContractNodesApproved') {
    saveContractNodes(session.value)
  }

  if (event.type === 'ArgumentRaised') {
    nextTick(() => {
      if (timelineEl.value) {
        timelineEl.value.scrollTop = timelineEl.value.scrollHeight
      }
    })
  }

  if (event.type === 'SessionConcluded') {
    setTimeout(() => {
      conclusionVisible.value = true
    }, 1500)
    // Сохранить решение ИК в fst
    saveDecisionToFst(session.value)
  }
}

async function saveDecisionToFst(sess) {
  if (!sess) return
  try {
    const project = PROJECTS_POOL.value.find(p => p.id === sess.projectId) || {}
    const approved = sess.decision?.humanApproval?.verdict === 'APPROVE'

    // Создать проект в fst если его ещё нет
    let fstProjectId = null
    try {
      const created = await createProject({
        name: project.company || project.name || sess.projectId,
        description: project.description || '',
        amount: project.askRub || 0,
        statusId: approved ? STATUSES['Одобрен'] : STATUSES['На доработке']
      })
      fstProjectId = created?.id
    } catch { /* проект уже может существовать */ }

    // Сохранить ПОЛНЫЙ протокол заседания инвесткомитета
    await saveCommitteeSession(sess, fstProjectId)

    console.log('✅ Протокол ИК сохранён в fst:', {
      project: project.name || sess.projectId,
      decision: sess.decision?.recommendation,
      score: sess.decision?.aggregatedScore,
      votes: sess.votes?.length,
      arguments: sess.arguments?.length
    })
  } catch (err) {
    console.error('❌ saveDecisionToFst failed:', err)
  }
}

async function saveContractNodes(sess) {
  if (!sess?.contractNodes?.length) return
  try {
    const { token, xsrf } = await authenticate()
    const db = import.meta.env.VITE_FST_DB || 'fst-api'
    const project = PROJECTS_POOL.value.find(p => p.id === sess.projectId) || {}

    async function post(path, fields) {
      const body = new URLSearchParams()
      for (const [k, v] of Object.entries(fields)) {
        if (v != null && v !== '') body.set(k, String(v))
      }
      body.set('_xsrf', xsrf)
      const r = await fetch(`/${db}/${path}?JSON_KV`, {
        method: 'POST',
        headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      return r.json()
    }

    // Создаём Смарт контракт (3995)
    const cData = await post('_m_new/3995', {
      t3995: `Смарт контракт — ${project.title || project.company || sess.projectId}`,
    })
    const contractId = cData.obj || cData.id
    if (!contractId) { console.warn('[saveContractNodes] no contractId'); return }

    // Создаём ноды (3996) под контрактом
    for (const node of sess.contractNodes) {
      const cf = node.cashflows || []
      const nData = await post('_m_new/3996', {
        t3996:  node.label || node.scenario,
        t4008:  node.scenario,
        t4010:  node.ic,
        t4012:  node.wacc,
        t4014:  node.n || cf.length,
        t4016:  cf[0] ?? 0,
        t4018:  cf[1] ?? 0,
        t4020:  cf[2] ?? 0,
        t4022:  cf[3] ?? 0,
        t4024:  cf[4] ?? 0,
        t4026:  node.npv ?? 0,
        t4028:  node.irr != null ? +(node.irr * 100).toFixed(1) : 0,
        t4030:  node.roi ?? 0,
        t4032:  node.dpp ?? 0,
        t4034:  node.pi ?? 0,
        t4036:  node.probability ?? 33,
        t4038:  'approved',
        up: contractId,
      })
      const nodeId = nData.obj || nData.id
      if (!nodeId) continue

      // Требования из условий decision (3999)
      const conditions = sess.decision?.conditions || []
      for (const cond of conditions) {
        await post('_m_new/3999', {
          t3999: typeof cond === 'string' ? cond : cond.text || String(cond),
          t4044: 'MEDIUM',
          t4046: 'PROPOSED',
          up: nodeId,
        })
      }
    }

    console.log('✅ Ноды контракта сохранены в БД. Contract ID:', contractId)
  } catch (err) {
    console.error('❌ saveContractNodes failed:', err)
  }
}

// Watch for phase changes to scroll timeline
watch(() => session.value?.arguments?.length, () => {
  nextTick(() => {
    if (timelineEl.value) {
      timelineEl.value.scrollTop = timelineEl.value.scrollHeight
    }
  })
})

onUnmounted(() => {
  if (engine) engine.stop()
})
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────── */
.fst-committee {
  min-height: 100vh;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-family: 'Inter', sans-serif;
}

/* ── Setup Screen ─────────────────────────────────────────── */
.fst-setup {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.fst-setup-header {
  padding: 24px 28px 18px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
}
.fst-setup-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  color: #ffa726;
  margin-bottom: 5px;
}
.fst-setup-desc {
  color: var(--p-text-muted-color);
  font-size: 13px;
  margin: 0 0 12px;
}
.fst-setup-subfunds {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fst-setup-body {
  display: grid;
  grid-template-columns: 1fr 360px;
  flex: 1;
}
.fst-setup-col {
  padding: 20px 24px;
  overflow-y: auto;
}
.fst-setup-col--projects {
  border-right: 1px solid var(--p-surface-border);
}
.fst-setup-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  margin-bottom: 10px;
}
.fst-setup-empty {
  color: var(--p-text-muted-color);
  font-size: 13px;
  padding: 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-setup-launch {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--p-surface-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-launch-btn { width: 100%; justify-content: center; }
.fst-launch-hint { text-align: center; font-size: 12px; color: var(--p-text-muted-color); }
.fst-policy-summary {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-left: 8px;
  font-weight: 400;
}

/* ── FST Policy Panel ──────────────────────────────────────── */
.fst-policy-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 0;
  border-top: 1px solid var(--p-content-border-color);
}
.fst-policy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
  margin-top: 10px;
  padding: 10px;
  background: var(--p-surface-section);
  border-radius: 8px;
}
.fst-policy-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fst-policy-label {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.fst-policy-label b {
  color: var(--p-text-color);
}
.fst-policy-slider {
  width: 100%;
}

/* ── Lobby ────────────────────────────────────────────────── */
.fst-intro {
  margin-bottom: 8px;
}
.fst-intro-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ffa726;
}
.fst-intro-text {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 12px;
}
.fst-intro-subfunds {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fst-subfund-badge {
  border: 1px solid;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.fst-subfund-budget {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 4px;
}
.fst-lobby-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--p-text-muted-color);
}
/* ── Project Grid Cards ───────────────────────────────────── */
.fst-selected-badge {
  margin-left: 10px;
  font-size: 11px;
  color: #4caf50;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: none;
  letter-spacing: 0;
}
.fst-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.fst-pcard {
  position: relative;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.fst-pcard-stripe {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--pc);
}
.fst-pcard:hover {
  border-color: var(--pc);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px var(--pc);
}
.fst-pcard--selected {
  border-color: var(--pc);
  box-shadow: 0 0 0 2px var(--pc), 0 4px 16px rgba(0,0,0,0.1);
}
.fst-pcard-checkmark {
  position: absolute;
  top: 10px; right: 10px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #4caf50;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
}
.fst-pcard-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.fst-pcard-subfund {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
}
.fst-pcard-stage {
  font-size: 10px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-hover);
  padding: 2px 7px;
  border-radius: 4px;
}
.fst-pcard-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.3;
  flex: 1;
}
.fst-pcard-company {
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 5px;
}
.fst-pcard-amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--pc);
}
.fst-pcard-metrics {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.fst-pcard-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}
.fst-pcard:hover .fst-pcard-hint { opacity: 1; }

/* ── Project Detail Modal ─────────────────────────────────── */
.fst-pmodal { display: flex; flex-direction: column; gap: 16px; }
.fst-pmodal-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fst-pmodal-subfund {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  color: #fff;
}
.fst-pmodal-stage {
  font-size: 12px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-hover);
  padding: 4px 10px;
  border-radius: 6px;
}
.fst-pmodal-company {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fst-pmodal-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: var(--p-surface-section, var(--p-surface-hover));
  border-radius: 10px;
  padding: 14px;
}
.fst-pmodal-metric { text-align: center; }
.fst-pmodal-metric-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--p-text-color);
  line-height: 1.2;
}
.fst-pmodal-metric-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.fst-pmodal-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  padding: 12px;
  background: var(--p-surface-hover);
  border-radius: 8px;
}
.fst-pmodal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fst-pmodal-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--p-surface-hover);
  border: 1px solid var(--p-surface-border);
  color: var(--p-text-muted-color);
}
.fst-pmodal-check {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}
.fst-pmodal-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.fst-pmodal-check-item.pass { color: #4caf50; }
.fst-pmodal-check-item.fail { color: #ef5350; }
.fst-metric {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 500;
}
.metric--good { background: rgba(76,175,80,0.15); color: #4caf50; }
.metric--warn { background: rgba(255,167,38,0.15); color: #ffa726; }
.metric--bad  { background: rgba(239,83,80,0.15);  color: #ef5350; }

.fst-overlap-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  background: rgba(255,167,38,0.08);
  border-bottom: 1px solid rgba(255,167,38,0.25);
  font-size: 0.78rem;
}
.fst-overlap-pill {
  background: rgba(239,68,68,0.12);
  color: #ef4444;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.73rem;
}
.fst-overlap-link {
  background: none;
  border: none;
  color: #42a5f5;
  cursor: pointer;
  font-size: 0.78rem;
  padding: 0 4px;
  text-decoration: underline;
}
.fst-speed-row {
  display: flex;
  gap: 8px;
}
.fst-speed-btn {
  padding: 6px 14px;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.fst-speed-btn.active {
  border-color: #42a5f5;
  background: rgba(66,165,245,0.12);
  color: #42a5f5;
}

/* ── Dashboard Layout ─────────────────────────────────────── */
.fst-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── Toolbar ──────────────────────────────────────────────── */
.fst-toolbar {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 52px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
  flex-shrink: 0;
  gap: 12px;
}
.fst-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.fst-logo {
  font-size: 13px;
  font-weight: 700;
  color: #ffa726;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-project-name {
  font-size: 12px;
  color: var(--p-text-muted-color);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fst-toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}
.fst-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-phase-track {
  display: flex;
  align-items: flex-start;
  gap: 0;
}
.fst-phase-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  min-width: 70px;
}
.fst-phase-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 7px;
  left: calc(50% + 7px);
  right: calc(-50% + 7px);
  height: 1px;
  background: #2a2a2a;
}
.fst-phase-step--done::after {
  background: #42a5f5;
}
.fst-phase-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  background: var(--p-surface-ground);
}
.fst-phase-step--done .fst-phase-dot,
.fst-phase-step--active .fst-phase-dot {
  background: var(--phase-color);
}
.fst-phase-label {
  font-size: 9px;
  color: var(--p-text-muted-color);
  text-align: center;
  line-height: 1.2;
  max-width: 60px;
}
.fst-phase-step--active .fst-phase-label {
  color: #fff;
  font-weight: 600;
}
.fst-phase-tag {
  font-size: 11px;
}

/* ── Main 3-column ────────────────────────────────────────── */
.fst-main {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  flex: 1;
  overflow: hidden;
  gap: 0;
}
.fst-panel-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--p-surface-border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-panel-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px;
}
.fst-arg-count {
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-weight: 400;
  margin-left: auto;
}

/* ── Agents Panel ─────────────────────────────────────────── */
.fst-agents-panel {
  border-right: 1px solid #1e2230;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.fst-agents-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fst-agent-card {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: all 0.2s;
  background: var(--p-surface-card);
  position: relative;
}
.fst-agent-card--thinking {
  border-color: var(--agent-color);
  box-shadow: 0 0 8px rgba(66,165,245,0.15);
}
.fst-agent-card--voted {
  opacity: 0.85;
}
.fst-agent-avatar {
  position: relative;
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}
.fst-agent-thinking-pulse {
  position: absolute;
  top: -2px; right: -2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--agent-color, #42a5f5);
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}
.fst-agent-info {
  flex: 1;
  min-width: 0;
}
.fst-agent-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--agent-color);
}
.fst-agent-role-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  line-height: 1.3;
  margin-top: 2px;
}
.fst-agent-think-text {
  font-size: 10px;
  color: #42a5f5;
  font-style: italic;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-agent-vote-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fst-agent-ready {
  font-size: 10px;
  color: #4caf50;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.fst-agent-weight {
  font-size: 10px;
  color: var(--p-text-muted-color);
  align-self: center;
  flex-shrink: 0;
}

/* ── Project Mini ─────────────────────────────────────────── */
.fst-project-mini {
  margin: auto 8px 8px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card);
}
.fst-project-mini-title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
  color: var(--p-text-color);
}
.fst-project-mini-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 2px 0;
}
.fst-project-mini-row strong { color: #ffd54f; }

/* ── Debate Panel ─────────────────────────────────────────── */
.fst-debate-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e2230;
}
.fst-timeline {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  scroll-behavior: smooth;
}

/* Loading phase */
.fst-loading-phase {
  padding: 16px;
  background: var(--p-surface-card);
  border-radius: 10px;
  margin-bottom: 12px;
}
.fst-loading-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #42a5f5;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-loading-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.fst-la-avatar { font-size: 16px; }
.fst-la-bar-wrap { flex: 1; }
.fst-la-name { font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 3px; }
.fst-la-bar {
  height: 4px;
  background: var(--p-surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-la-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.fst-la-status { font-size: 12px; }

/* Arguments */
.fst-args-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fst-argument {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card);
  transition: all 0.3s;
}
.fst-argument--counter {
  margin-left: 20px;
  border-left: 2px solid #7e57c2;
  background: var(--p-surface-section);
}
.fst-arg-type--challenge {
  border-color: rgba(239,83,80,0.3);
}
.fst-arg-type--counter {
  border-color: rgba(126,87,194,0.3);
}
.fst-arg-type--summary {
  border-color: rgba(102,187,106,0.2);
  background: var(--p-surface-ground);
}
.fst-arg-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-arg-avatar { font-size: 14px; }
.fst-arg-agent-name { font-size: 11px; font-weight: 600; }
.fst-arg-type-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--p-surface-border);
  color: var(--p-text-muted-color);
}
.fst-arg-ai-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  color: #a78bfa;
  background: rgba(167,139,250,0.12);
  border: 1px solid rgba(167,139,250,0.3);
  border-radius: 4px;
  padding: 1px 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.fst-arg-tpl-badge {
  margin-left: auto;
  font-size: 9px;
  color: var(--p-text-muted-color);
  opacity: 0.5;
  flex-shrink: 0;
}
.fst-arg-dim {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-left: auto;
}
.fst-arg-reply {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 10px;
  background: var(--p-surface-ground);
  border-left: 2px solid var(--p-surface-border);
  border-radius: 0 4px 4px 0;
  padding: 4px 8px;
  margin-bottom: 6px;
  line-height: 1.4;
}
.fst-arg-reply-arrow {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.fst-arg-reply-who {
  font-weight: 700;
  flex-shrink: 0;
}
.fst-arg-reply-text {
  color: var(--p-text-muted-color);
  font-style: italic;
}
.fst-arg-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--p-text-color);
}

/* Vote stream */
.fst-vote-stream {
  margin-top: 16px;
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 10px;
  border: 1px solid var(--p-surface-border);
}
.fst-vote-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #26c6da;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-vote-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.fst-vote-avatar { font-size: 14px; }
.fst-vote-name { font-size: 11px; font-weight: 600; min-width: 55px; }
.fst-vote-pill-sm {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
}
.fst-vote-score { font-size: 11px; color: var(--p-text-muted-color); min-width: 40px; }
.fst-vote-conf-bar {
  flex: 1;
  height: 4px;
  background: var(--p-surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-vote-conf-bar > div {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* Empty state */
.fst-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

/* Argument animation */
.fst-arg-enter-active { transition: all 0.4s ease; }
.fst-arg-enter-from { opacity: 0; transform: translateY(10px); }

/* ── Score Panel ──────────────────────────────────────────── */
.fst-score-panel {
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
}
.fst-fin-calc-wrap {
  margin-top: 12px;
}

.fst-radar-container {
  padding: 8px 0;
  display: flex;
  justify-content: center;
}
.fst-radar-svg {
  width: 160px;
  height: 160px;
}

.fst-dim-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.fst-dim-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-dim-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  min-width: 70px;
}
.fst-dim-bar-bg {
  flex: 1;
  height: 5px;
  background: var(--p-surface-border);
  border-radius: 3px;
  overflow: hidden;
}
.fst-dim-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.fst-dim-value {
  font-size: 10px;
  font-weight: 600;
  min-width: 24px;
  text-align: right;
}

/* Aggregate score */
.fst-agg-score {
  text-align: center;
  padding: 12px;
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  margin-bottom: 12px;
  background: var(--p-surface-card);
}
.fst-agg-score-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fst-agg-score-value {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 8px;
}
.fst-agg-rec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
  border-radius: 20px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* Vote distribution */
.fst-vote-dist {
  margin-bottom: 12px;
}
.fst-vote-dist-bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fst-vote-dist-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-vd-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 65px;
}
.fst-vd-bar-bg {
  flex: 1;
  height: 8px;
  background: var(--p-surface-border);
  border-radius: 4px;
  overflow: hidden;
}
.fst-vd-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.fst-vd-count {
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 14px;
  text-align: right;
}

/* Conditions & Risks */
.fst-cond-list, .fst-risk-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.fst-cond-item, .fst-risk-item {
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 3px 0;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  line-height: 1.4;
}
.fst-conditions { margin-bottom: 12px; }
.fst-risks { margin-bottom: 12px; }

/* Human approval panel */
.fst-human-panel {
  border: 1px solid rgba(255,167,38,0.3);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255,167,38,0.05);
  margin-top: auto;
}
.fst-human-prompt {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 6px 0 10px;
}
.fst-human-comment-row {
  margin-bottom: 10px;
}
.fst-human-comment {
  width: 100%;
  font-size: 12px;
}
.fst-human-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fst-human-buttons .p-button {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

/* Vote pills in conclusion */
.fst-votes-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.fst-vote-pill {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  color: #fff;
}

/* Conclusion */
.fst-conclusion { text-align: center; }
.fst-conclusion-score {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 12px;
}
.fst-conclusion-recommendation {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  border-radius: 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 16px;
}
.fst-conclusion-section {
  text-align: left;
  margin-bottom: 12px;
}
.fst-conclusion-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.fst-conditions-list {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding-left: 16px;
}
.fst-conditions-list li { margin-bottom: 4px; }
.fst-scenario-section { margin-top: 16px; }
.fst-human-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4caf50;
  margin-top: 12px;
  justify-content: center;
}

/* ── AI mode toggle ── */
.fst-ai-mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--p-surface-border);
  border-radius: 9px;
}
.fst-ai-toggle {
  width: 40px; height: 22px;
  border-radius: 11px;
  background: var(--p-surface-border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.fst-ai-toggle--on { background: #7c3aed; }
.fst-ai-toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.fst-ai-toggle--on .fst-ai-toggle-knob { transform: translateX(18px); }
.fst-ai-mode-label { font-size: 0.8125rem; color: var(--p-text-color); }
.fst-ai-mode-label strong { font-weight: 600; }

/* ── Debate Tabs ───────────────────────────────────────────── */
.fst-debate-tabs {
  display: flex;
  gap: 2px;
  align-items: center;
}
.fst-dtab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--p-text-muted-color);
  transition: all 0.15s;
}
.fst-dtab:hover {
  background: var(--p-surface-hover);
  color: var(--p-text-color);
}
.fst-dtab--active {
  background: var(--p-primary-color, #42a5f5);
  color: #fff;
  border-color: transparent;
}
.fst-dtab--active .fst-arg-count {
  background: rgba(255,255,255,0.25);
  color: #fff;
}

/* ── Graph Panel ───────────────────────────────────────────── */
.fst-graph-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── KAG saved badge ───────────────────────────────────────── */
.fst-kag-saved {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-color);
}

/* ── Оркестратор моделей ───────────────────────────────────── */
.fst-model-panel {
  padding: 10px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-model-profiles {
  display: flex;
  gap: 6px;
}
.fst-profile-btn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  font-size: 11px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.fst-profile-btn:hover {
  background: var(--p-surface-hover);
}
.fst-profile-btn--active {
  background: var(--p-primary-color, #42a5f5);
  color: #fff;
  border-color: transparent;
}
.fst-model-profile-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 0 2px;
}
.fst-agent-model-grid {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fst-agent-model-row {
  display: grid;
  grid-template-columns: 20px 55px 1fr;
  align-items: center;
  gap: 6px;
}
.fst-am-avatar { font-size: 14px; }
.fst-am-name {
  font-size: 11px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-am-select {
  font-size: 10px;
  padding: 3px 5px;
  border-radius: 5px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  cursor: pointer;
  width: 100%;
  min-width: 0;
}
.fst-model-reset-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--p-surface-border);
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-model-reset-btn:hover { background: var(--p-surface-hover); }
</style>

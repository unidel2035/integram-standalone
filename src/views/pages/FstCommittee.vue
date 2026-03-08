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

        <!-- Противоречия дебатов (ConditionalDecision) -->
        <div v-if="session.conditionalDecision?.contradictions?.length" class="fst-conclusion-section">
          <div class="fst-conclusion-label">Выявленные противоречия:</div>
          <div class="fst-contradictions-list">
            <div v-for="(c, i) in session.conditionalDecision.contradictions" :key="i" class="fst-contradiction-item">
              <span class="fst-contradiction-dim">{{ c.dimension }}</span>
              <span class="fst-contradiction-severity" :class="'sev-' + (c.severity || 'medium')">
                {{ c.severity === 'high' ? 'Высокая' : c.severity === 'low' ? 'Низкая' : 'Средняя' }}
              </span>
              <div class="fst-contradiction-thesis">{{ c.thesis }}</div>
              <div class="fst-contradiction-antithesis">{{ c.antithesis }}</div>
            </div>
          </div>
        </div>

        <!-- Условия из противоречий -->
        <div v-if="session.conditionalDecision?.conditions?.length" class="fst-conclusion-section">
          <div class="fst-conclusion-label">Условия сделки (из противоречий):</div>
          <div class="fst-deal-conditions">
            <div v-for="(cond, i) in session.conditionalDecision.conditions" :key="i" class="fst-deal-condition">
              <span class="fst-cond-type" :class="'type-' + cond.type">{{ cond.type }}</span>
              <span class="fst-cond-text">{{ cond.text }}</span>
              <span v-if="cond.metric" class="fst-cond-metric">{{ cond.metric }} {{ cond.threshold ? '≥ ' + cond.threshold : '' }}</span>
            </div>
          </div>
        </div>

        <!-- Belief Drift — изменение позиций агентов -->
        <div v-if="session.beliefDrift && Object.keys(session.beliefDrift).length" class="fst-conclusion-section">
          <div class="fst-conclusion-label">Динамика позиций агентов:</div>
          <div class="fst-belief-drift-grid">
            <div v-for="(drift, agentId) in session.beliefDrift" :key="agentId" class="fst-drift-card">
              <div class="fst-drift-header">
                <span class="fst-drift-avatar" :style="{ background: agentColor(agentId) }">
                  {{ agentAvatar(agentId) }}
                </span>
                <span class="fst-drift-name">{{ agentShortName(agentId) }}</span>
                <span v-if="drift.stanceChanged" class="fst-drift-changed">изменил позицию</span>
              </div>
              <div class="fst-drift-bars">
                <div class="fst-drift-bar-row">
                  <span class="fst-drift-label">Начало:</span>
                  <div class="fst-drift-bar" :style="{ width: (drift.initialConfidence * 100) + '%', background: stanceColor(drift.initialStance) }"></div>
                  <span class="fst-drift-val">{{ drift.initialStance || '?' }} {{ (drift.initialConfidence * 100).toFixed(0) }}%</span>
                </div>
                <div class="fst-drift-bar-row">
                  <span class="fst-drift-label">Итог:</span>
                  <div class="fst-drift-bar" :style="{ width: (drift.finalConfidence * 100) + '%', background: stanceColor(drift.finalStance) }"></div>
                  <span class="fst-drift-val">{{ drift.finalStance || '?' }} {{ (drift.finalConfidence * 100).toFixed(0) }}%</span>
                </div>
              </div>
              <div class="fst-drift-delta" :class="drift.delta > 0 ? 'positive' : drift.delta < 0 ? 'negative' : ''">
                {{ drift.delta > 0 ? '+' : '' }}{{ (drift.delta * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
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

      <!-- ── Header ───────────────────────────────────────────── -->
      <div class="fst-header">
        <div class="fst-header-project">
          <i class="pi pi-building" style="color:#ffa726"></i>
          <span class="fst-header-title">{{ session.project.title }}</span>
          <span class="fst-header-subfund"
            :style="{ background: SUBFUNDS[session.project.subFund]?.color || '#666' }">
            {{ SUBFUNDS[session.project.subFund]?.shortName || session.project.subFund }}
          </span>
        </div>

        <!-- Phase stepper -->
        <div class="fst-stepper">
          <template v-for="(ph, idx) in visiblePhases" :key="ph.id">
            <div :class="['fst-step', { 'fst-step--done': phaseIdx > idx, 'fst-step--active': phaseIdx === idx }]">
              <div class="fst-step-dot"
                :style="{ background: phaseIdx >= idx ? ph.color : 'transparent', borderColor: ph.color }">
                <i v-if="phaseIdx > idx" class="pi pi-check" style="font-size:7px;color:#fff"></i>
              </div>
              <span class="fst-step-label">{{ ph.label }}</span>
            </div>
            <div v-if="idx < visiblePhases.length - 1" class="fst-step-line"
              :style="{ background: phaseIdx > idx ? ph.color : 'var(--p-surface-border)' }"></div>
          </template>
        </div>

        <div class="fst-header-right">
          <div v-if="session.decision" class="fst-score-badge"
            :style="{ color: scoreColor(session.decision.aggregatedScore) }">
            {{ session.decision.aggregatedScore }}<span class="fst-score-denom">/100</span>
          </div>
          <div v-if="running" class="fst-running-pill">
            <i class="pi pi-spin pi-spinner"></i> AI
          </div>
          <Tag v-else-if="session.phase !== 'IDLE'" :value="currentPhase.label"
            :style="{ background: currentPhase.color, fontSize: '10px' }" />
          <Button v-if="running" icon="pi pi-pause" size="small" rounded text severity="secondary" @click="pauseSession" />
          <Button icon="pi pi-sliders-h" size="small" rounded text severity="secondary"
            @click="policyExpanded = !policyExpanded" title="Параметры оценки ФСТ" />
          <Button icon="pi pi-question-circle" size="small" rounded text severity="secondary" @click="toggleHelp" />
          <Button icon="pi pi-times" size="small" rounded text severity="secondary" @click="resetSession" title="Новая сессия" />
        </div>
      </div>

      <!-- ── Body: center + right ─────────────────────────────── -->
      <div class="fst-body">

        <!-- Center: debate / graph / links -->
        <div class="fst-center">
          <div class="fst-tabs-bar">
            <button :class="['fst-tab', { 'fst-tab--on': debateTab === 'timeline' }]"
              @click="debateTab = 'timeline'">
              <i class="pi pi-comments"></i> Дебаты
              <span v-if="session.arguments.length" class="fst-tab-count">{{ session.arguments.length }}</span>
            </button>
            <button :class="['fst-tab', { 'fst-tab--on': debateTab === 'graph' }]"
              @click="debateTab = 'graph'">
              <i class="pi pi-sitemap"></i> Граф
            </button>
            <button :class="['fst-tab', { 'fst-tab--on': debateTab === 'links' }]"
              @click="debateTab = 'links'">
              <i class="pi pi-share-alt"></i> Связи
              <span v-if="portfolioOverlaps.length" class="fst-tab-count fst-tab-count--red">
                {{ portfolioOverlaps.length }}
              </span>
            </button>
          </div>

          <div v-if="portfolioOverlaps.length && debateTab !== 'links'" class="fst-overlap-alert">
            <i class="pi pi-exclamation-triangle" style="color:#ffa726"></i>
            Пересечение с портфелем:
            <span v-for="(o, i) in portfolioOverlaps.slice(0,3)" :key="i" class="fst-overlap-pill">
              {{ o.companyName }} → {{ o.conceptName }}
            </span>
            <button class="fst-overlap-link" @click="debateTab = 'links'">Граф →</button>
          </div>

          <!-- Живая лента: что делают агенты прямо сейчас -->
          <div v-if="running && Object.keys(agentActivity).length" class="fst-activity-feed">
            <div v-for="(act, agId) in agentActivity" :key="agId"
              :class="['fst-activity-item', { 'fst-activity-item--result': act.result }]">
              <span class="fst-activity-dot" :style="{ background: AGENTS.find(a=>a.id===agId)?.color || '#888' }"></span>
              <span class="fst-activity-agent">{{ AGENTS.find(a=>a.id===agId)?.shortName }}</span>
              <span class="fst-activity-tool">{{ act.tool }}</span>
              <span v-if="act.result" class="fst-activity-result-arrow">→</span>
              <span v-if="act.reasoning" class="fst-activity-reason">{{ act.reasoning }}</span>
            </div>
          </div>

          <DebateGraphPanel v-if="debateTab === 'graph'" :session="session" class="fst-panel-fill" />
          <LinksGraphViz v-if="debateTab === 'links'" class="fst-panel-fill" />
          <DebateTimeline v-if="debateTab === 'timeline'" :session="session" :running="running" class="fst-panel-fill" />
        </div>

        <!-- Right: scoring + decision -->
        <div class="fst-right">

          <!-- Project KPIs -->
          <div class="fst-rs">
            <div class="fst-rs-title"><i class="pi pi-building"></i> Проект</div>
            <div class="fst-kpis">
              <div class="fst-kpi">
                <div class="fst-kpi-v">{{ (session.project.requestedAmount / 1e6).toFixed(0) }}</div>
                <div class="fst-kpi-u">млн ₽</div>
                <div class="fst-kpi-l">Запрос</div>
              </div>
              <div class="fst-kpi">
                <div class="fst-kpi-v" :class="trlClass(session.project.trl)">{{ session.project.trl }}</div>
                <div class="fst-kpi-u">/9</div>
                <div class="fst-kpi-l">TRL</div>
              </div>
              <div class="fst-kpi">
                <div class="fst-kpi-v" :class="sovClass(session.project.sovereigntyScore)">
                  {{ session.project.sovereigntyScore }}
                </div>
                <div class="fst-kpi-u">/9</div>
                <div class="fst-kpi-l">Суверен.</div>
              </div>
              <div class="fst-kpi">
                <div class="fst-kpi-v" :class="irrClass(session.project.projectedIRR)">
                  {{ (session.project.projectedIRR * 100).toFixed(0) }}%
                </div>
                <div class="fst-kpi-l">IRR</div>
              </div>
            </div>
          </div>

          <!-- Scoring: radar + dims -->
          <div class="fst-rs">
            <div class="fst-rs-title"><i class="pi pi-chart-bar"></i> Скоринг</div>
            <svg viewBox="0 0 200 200" class="fst-radar">
              <circle v-for="r in [20,40,60,80]" :key="r" cx="100" cy="100" :r="r"
                fill="none" stroke="var(--p-surface-border)" stroke-width="0.5" stroke-dasharray="3,3"/>
              <line v-for="(ax, i) in radarAxes" :key="'a'+i"
                x1="100" y1="100"
                :x2="100 + Math.cos(ax.angle - Math.PI/2) * 80"
                :y2="100 + Math.sin(ax.angle - Math.PI/2) * 80"
                stroke="var(--p-surface-border)" stroke-width="0.5"/>
              <polygon :points="radarPoints" fill="rgba(66,165,245,0.15)" stroke="#42a5f5" stroke-width="1.5"/>
              <text v-for="(ax, i) in radarAxes" :key="'l'+i"
                :x="100 + Math.cos(ax.angle - Math.PI/2) * 95"
                :y="100 + Math.sin(ax.angle - Math.PI/2) * 95"
                text-anchor="middle" dominant-baseline="middle"
                :fill="ax.color" font-size="7.5" font-weight="600">{{ ax.label }}</text>
            </svg>
            <div class="fst-dims">
              <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-dim-row">
                <span class="fst-dim-lbl">{{ dim.label }}</span>
                <div class="fst-dim-track">
                  <div class="fst-dim-fill"
                    :style="{ width: ((session.dimScores[key] || 0) * 100) + '%', background: dim.color }"></div>
                </div>
                <span class="fst-dim-num" :style="{ color: dim.color }">
                  {{ Math.round((session.dimScores[key] || 0) * 100) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Votes -->
          <div v-if="session.votes.length" class="fst-rs">
            <div class="fst-rs-title"><i class="pi pi-check-square"></i> Голоса</div>
            <div class="fst-vote-grid">
              <div v-for="vote in session.votes" :key="vote.id" class="fst-vc"
                :style="{ borderColor: VERDICTS[vote.verdict]?.color,
                  background: (VERDICTS[vote.verdict]?.color || '#888') + '18' }">
                <i :class="VERDICTS[vote.verdict]?.icon"
                  :style="{ color: VERDICTS[vote.verdict]?.color, fontSize: '10px' }"></i>
                <span class="fst-vc-n">{{ agentById(vote.agentId)?.shortName }}</span>
                <span class="fst-vc-s" :style="{ color: VERDICTS[vote.verdict]?.color }">{{ vote.score }}</span>
              </div>
            </div>
          </div>

          <!-- Decision -->
          <div v-if="session.decision" class="fst-rs fst-rs--decision">
            <div class="fst-rs-title"><i class="pi pi-gavel"></i> Решение комитета</div>
            <div class="fst-decision-score"
              :style="{ color: scoreColor(session.decision.aggregatedScore) }">
              {{ session.decision.aggregatedScore }}<span class="fst-decision-denom">/100</span>
            </div>
            <div class="fst-decision-rec"
              :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
              <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
              {{ VERDICTS[session.decision.recommendation]?.label }}
            </div>
            <ul v-if="session.decision.conditions?.length" class="fst-decision-conds">
              <li v-for="c in session.decision.conditions.slice(0, 3)" :key="c">
                <i class="pi pi-angle-right" style="color:#ffa726;font-size:9px"></i> {{ c }}
              </li>
            </ul>
            <div v-if="session.decision.humanApproval" class="fst-human-result">
              <i class="pi pi-check-circle" style="color:#4caf50"></i>
              Утверждено: <strong>{{ VERDICTS[session.decision.humanApproval.verdict]?.label }}</strong>
            </div>
            <Button label="Полный отчёт" icon="pi pi-arrow-right" icon-pos="right"
              size="small" outlined severity="secondary"
              style="width:100%;margin-top:10px;justify-content:center"
              @click="conclusionVisible = true" />
          </div>

          <!-- Human Approval -->
          <div v-if="session.phase === 'HUMAN_APPROVAL'" class="fst-rs fst-rs--approval">
            <div class="fst-rs-title" style="color:#ffa726">
              <i class="pi pi-users"></i> Утверждение ИК
            </div>
            <p class="fst-approval-hint">AI-агенты вынесли рекомендацию. Примите финальное решение:</p>
            <InputText v-model="humanComment" placeholder="Комментарий (опционально)"
              size="small" style="width:100%;margin-bottom:10px" />
            <div class="fst-approval-btns">
              <LearnTooltip label="Утвердить"
                what="Председатель комитета утверждает рекомендацию AI-агентов. Проект переходит к структурированию сделки."
                when="Когда согласны с решением агентов и готовы двигаться к Term Sheet"
                :terms="['Одобрение', 'Term Sheet', 'Инвесткомитет']">
                <Button label="Утвердить" icon="pi pi-check" severity="success" size="small"
                  style="width:100%" @click="humanDecide('APPROVE')" />
              </LearnTooltip>
              <LearnTooltip label="Отложить"
                what="Откладывает решение — проект остаётся в воронке для повторного рассмотрения"
                when="Когда нужна дополнительная информация: финмодель, DD, юр. проверка"
                :terms="['Due Diligence', 'Воронка сделок', 'Скрининг']">
                <Button label="Отложить" icon="pi pi-clock" severity="warning" size="small"
                  style="width:100%" @click="humanDecide('DEFER')" />
              </LearnTooltip>
              <LearnTooltip label="Отклонить"
                what="Проект не проходит критерии ФСТ НТИ. Решение фиксируется в протоколе."
                when="Когда проект не соответствует стратегии фонда или минимальным критериям отбора"
                :terms="['Критерии отбора', 'Протокол ИК', 'Политика фонда']">
                <Button label="Отклонить" icon="pi pi-times" severity="danger" size="small"
                  style="width:100%" @click="humanDecide('REJECT')" />
              </LearnTooltip>
            </div>
          </div>

        </div><!-- /fst-right -->
      </div><!-- /fst-body -->

      <!-- ── Agents Bar (bottom strip) ────────────────────────── -->
      <div class="fst-agents-bar">
        <div v-for="agent in AGENTS" :key="agent.id"
          :class="['fst-ac',
            agentStatus(agent.id).thinking ? 'fst-ac--thinking' : '',
            agentStatus(agent.id).vote ? 'fst-ac--voted' : '',
            agentStatus(agent.id).done && !agentStatus(agent.id).vote ? 'fst-ac--done' : '',
          ]"
          :style="{ '--ac': agent.color }">
          <span class="fst-ac-dot"></span>
          <span class="fst-ac-name">{{ agent.shortName }}</span>
          <span v-if="agentStatus(agent.id).thinking" class="fst-ac-status">
            <i class="pi pi-spin pi-spinner" style="font-size:9px;color:var(--ac)"></i>
            <span v-if="agentActivity[agent.id]?.tool" class="fst-ac-tool">
              {{ agentActivity[agent.id].tool }}
            </span>
          </span>
          <span v-else-if="agentStatus(agent.id).vote" class="fst-ac-vote"
            :style="{ background: VERDICTS[agentStatus(agent.id).vote]?.color }">
            <i :class="VERDICTS[agentStatus(agent.id).vote]?.icon" style="font-size:8px"></i>
            {{ agentStatus(agent.id).voteScore }}
          </span>
          <!-- Дельта позиции (OPENING → SUMMARY) -->
          <span v-if="session?.positionDeltas?.[agent.id]?.changed"
            class="fst-ac-delta"
            :title="`Позиция изменилась: ${session.positionDeltas[agent.id].from} → ${session.positionDeltas[agent.id].to}`">
            {{ stanceEmoji(session.positionDeltas[agent.id].from) }}→{{ stanceEmoji(session.positionDeltas[agent.id].to) }}
          </span>
          <span v-else-if="agentStatus(agent.id).done" class="fst-ac-status">
            <i class="pi pi-check" style="font-size:9px;color:#4caf50"></i>
          </span>
          <div class="fst-ac-pipe">
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.integram, '#42a5f5')" title="Данные"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.calc, '#ff9800')" title="Расчёт"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.llm, '#ab47bc')" title="LLM"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.save, '#66bb6a')" title="Сохр."></span>
          </div>
        </div>
      </div>

    </div><!-- /fst-dashboard -->

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

          <!-- ═══ Multi-Agent Orchestrator toggle ═══ -->
          <div v-if="useAI" class="fst-ai-mode-row" style="margin-top:14px">
            <div :class="['fst-ai-toggle', { 'fst-ai-toggle--on': useAgentLoop }]"
              @click="useAgentLoop = !useAgentLoop">
              <div class="fst-ai-toggle-knob"></div>
            </div>
            <div class="fst-ai-mode-label">
              <span v-if="useAgentLoop">
                <i class="pi pi-sitemap" style="color:#ffa726"></i>
                <strong>Multi-Agent Loop</strong> — агенты вызывают инструменты, работают параллельно, видят зал
              </span>
              <span v-else>
                <i class="pi pi-comments" style="color:#64748b"></i>
                <strong>Single-call</strong> — один LLM-вызов на аргумент (быстро)
              </span>
            </div>
          </div>


          <div v-if="useAI && useAgentLoop" class="fst-ai-mode-row" style="margin-top:10px">
            <div :class="['fst-ai-toggle', { 'fst-ai-toggle--on': useOrchestrator }]"
              @click="useOrchestrator = !useOrchestrator">
              <div class="fst-ai-toggle-knob"></div>
            </div>
            <div class="fst-ai-mode-label">
              <span v-if="useOrchestrator">
                <i class="pi pi-server" style="color:#66bb6a"></i>
                <strong>Server Orchestration</strong> — агенты работают на сервере, UI получает события в реальном времени
              </span>
              <span v-else>
                <i class="pi pi-desktop" style="color:#64748b"></i>
                <strong>Client-side</strong> — агенты работают в браузере (по умолчанию)
              </span>
            </div>
          </div>

          <!-- ═══ Режим голосования ═══ -->
          <div v-if="useAI && useAgentLoop" class="fst-ai-mode-row" style="margin-top:10px">
            <div class="fst-voting-mode-select">
              <i class="pi pi-chart-bar" style="color:#ab47bc; margin-right:6px"></i>
              <strong style="margin-right:10px">Голосование:</strong>
              <SelectButton v-model="votingMode" :options="[
                { label: 'Формула', value: 'formula' },
                { label: 'Гибрид', value: 'hybrid' },
                { label: 'LLM', value: 'llm' }
              ]" optionLabel="label" optionValue="value" :allowEmpty="false"
                style="font-size:0.8rem" />
            </div>
            <div class="fst-ai-mode-label" style="margin-top:4px; font-size:0.78rem; color:var(--p-text-color-secondary)">
              <span v-if="votingMode === 'formula'">Алгоритмические веса + bias + шум — быстро, предсказуемо</span>
              <span v-else-if="votingMode === 'hybrid'">LLM stance из дебатов + формульный score — баланс</span>
              <span v-else>Чисто LLM — stance и confidence из ответа агента, без формул</span>
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
import DebateTimeline from '@/components/fst-committee/DebateTimeline.vue'
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
const useAI        = ref(true)
const useAgentLoop = ref(true)    // Multi-agent orchestrator: tool_use + parallel
const useOrchestrator = ref(false) // Серверная оркестрация (Phase 3)
const votingMode = ref('hybrid')   // 'formula' | 'hybrid' | 'llm'
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

// Живая активность агентов: { [agentId]: { tool, iter, type, ts } }
const agentActivity = ref({})
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

function describeToolCall(tool, args, reasoning) {
  if (reasoning && reasoning.length > 4) return reasoning
  // Детерминированное описание из аргументов
  switch (tool) {
    case 'calc_irr':         return `IRR по CF: [${(args?.cashflows||[]).slice(0,3).join(', ')}...] IC=${args?.initial_investment||'?'} млн`
    case 'calc_npv':         return `NPV: WACC=${((args?.wacc||0.18)*100).toFixed(0)}%, IC=${args?.initial_investment||'?'} млн`
    case 'calc_monte_carlo': return `Монте-Карло: IRR_base=${((args?.base_irr||0)*100).toFixed(0)}%, vol=${((args?.volatility||0.35)*100).toFixed(0)}%`
    case 'calc_bayesian':    return `Байес: prior=${((args?.prior||0.08)*100).toFixed(0)}%, сигналы +${(args?.evidence_up||[]).length} −${(args?.evidence_down||[]).length}`
    case 'calc_power_score': return `7 Powers: scale=${args?.scale_economies||0} network=${args?.network_economies||0} brand=${args?.branding||0}...`
    case 'query_data':       return `данные: ${(args?.fields||[]).join(', ')}`
    case 'read_room':        return `читает зал (последние ${args?.n||8} реплик)`
    case 'web_search':       return `поиск: «${(args?.query||'').slice(0,60)}»`
    case 'memory_search':    return `память KAG: «${(args?.query||'').slice(0,60)}»`
    case 'search_precedents':return `прецеденты: «${(args?.query||'').slice(0,60)}»`
    case 'exec_code':        return `код: ${args?.description || (args?.code||'').slice(0,60)}`
    default:                 return tool
  }
}

function formatToolResult(result) {
  if (!result || typeof result !== 'object') return String(result || '').slice(0, 80)
  if (result.error) return `⚠ ${result.error}`.slice(0, 80)
  // Числовые результаты — самые важные
  const parts = []
  if (result.irr_pct !== undefined)        parts.push(`IRR ${result.irr_pct}%`)
  if (result.npv !== undefined)            parts.push(`NPV ${result.npv} млн`)
  if (result.p_positive_pct !== undefined) parts.push(`P(успех) ${result.p_positive_pct}%`)
  if (result.posterior_pct !== undefined)  parts.push(`P = ${result.posterior_pct}%`)
  if (result.total !== undefined && result.assessment) parts.push(`Power ${result.total}/70 — ${result.assessment}`)
  if (result.count !== undefined)          parts.push(`найдено ${result.count}`)
  if (result.results && typeof result.results === 'string') parts.push(result.results.slice(0, 80))
  if (result.result !== undefined)         parts.push(JSON.stringify(result.result).slice(0, 60))
  // Поля проекта
  const projFields = Object.entries(result).filter(([k,v]) => typeof v === 'number' || typeof v === 'string').slice(0, 3)
  if (!parts.length) projFields.forEach(([k,v]) => parts.push(`${k}: ${v}`))
  return parts.join(' · ').slice(0, 120) || JSON.stringify(result).slice(0, 80)
}

function agentStatus(agentId) {
  return session.value?.agentStatus?.[agentId] || {}
}

function fstPipeNodeStyle(state, color) {
  if (state === 'done')   return { background: color, borderColor: color }
  if (state === 'active') return { background: color + '88', borderColor: color, animation: 'fst-dot-blink 1s infinite' }
  if (state === 'error')  return { background: '#ef5350', borderColor: '#ef5350' }
  return {}
}

function argTypeLabel(type) {
  const labels = { OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контр', SUMMARY: 'Итог' }
  return labels[type] || type
}

function stanceEmoji(stance) {
  return stance === 'APPROVE' ? '✅' : stance === 'REJECT' ? '❌' : stance === 'DEFER' ? '⏳' : '?'
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
    useAgentLoop:   useAgentLoop.value,
    useOrchestrator: useOrchestrator.value,
    votingMode:      votingMode.value,
    speedProfile:   selectedSpeedProfile.value,
    modelOverrides: { ...agentModelOverrides.value },
  })
  session.value = sess
  agentActivity.value = {}

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
    // Новые ссылки на массивы → Vue гарантированно видит изменение
    session.value.events         = [...s.events]
    session.value.arguments      = [...s.arguments]
    session.value.votes          = [...s.votes]
    session.value.dimScores      = { ...s.dimScores }
    session.value.positionDeltas = s.positionDeltas ? { ...s.positionDeltas } : null
    session.value._tick          = (session.value._tick || 0) + 1
  }

  if (event.type === 'AgentLoopProgress') {
    const { agentId, type, tool, reasoning, iter } = event
    if (type === 'tool_start') {
      const desc = describeToolCall(tool, event.args, reasoning)
      agentActivity.value = { ...agentActivity.value, [agentId]: { tool, reasoning: desc, iter, ts: Date.now() } }
    } else if (type === 'tool_done') {
      const resultSnippet = formatToolResult(event.result)
      agentActivity.value = { ...agentActivity.value, [agentId]: { tool, reasoning: resultSnippet, result: true, iter, ts: Date.now() } }
    } else if (type === 'publish') {
      const copy = { ...agentActivity.value }
      delete copy[agentId]
      agentActivity.value = copy
    }
    return
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

  if (event.type === 'PositionDeltaReady') {
    // positionDeltas уже синкнуты выше через engine.session
  }

  if (event.type === 'ConditionalDecisionReady') {
    session.value.conditionalDecision = event
  }

  if (event.type === 'SessionConcluded') {
    if (event.beliefDrift) session.value.beliefDrift = event.beliefDrift
    agentActivity.value = {}
    setTimeout(() => {
      conclusionVisible.value = true
    }, 1500)
    // Сохранить решение ИК в fst
    saveDecisionToFst(session.value)
  }
}


function agentColor(id) {
  const a = AGENTS.find(a => a.id === id)
  return a?.color || '#64748b'
}
function agentAvatar(id) {
  const a = AGENTS.find(a => a.id === id)
  return a?.avatar || '🤖'
}
function agentShortName(id) {
  const a = AGENTS.find(a => a.id === id)
  return a?.shortName || id
}
function stanceColor(stance) {
  if (stance === 'APPROVE') return '#4caf50'
  if (stance === 'REJECT') return '#ef5350'
  return '#ffa726'
}

async function saveDecisionToFst(sess) {
  if (!sess) return
  try {
    const project = PROJECTS_POOL.value.find(p => p.id === sess.projectId) || sess.project || {}
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
    const project = PROJECTS_POOL.value.find(p => p.id === sess.projectId) || sess.project || {}

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
    const contractName = `Смарт контракт — ${project.title || project.company || sess.projectId || 'Проект'}`
    console.log('[saveContractNodes] creating contract:', contractName, 'nodes:', sess.contractNodes?.length)
    const cData = await post('_m_new/3995', {
      t3995: contractName,
    })
    console.log('[saveContractNodes] cData:', JSON.stringify(cData))
    const contractId = cData.id || cData.newId || cData.obj
    if (!contractId) { console.warn('[saveContractNodes] no contractId, response:', JSON.stringify(cData)); return }

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
      const nodeId = nData.id || nData.newId || nData.obj
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

onMounted(() => {
  document.documentElement.classList.add('committee-page')
})

onUnmounted(() => {
  document.documentElement.classList.remove('committee-page')
  if (engine) engine.stop()
})
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────── */
.fst-committee {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-family: 'Inter', sans-serif;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DASHBOARD — новый layout
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.fst-dashboard {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* ── Header ──────────────────────────────── */
.fst-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  flex-shrink: 0;
  min-height: 50px;
}
.fst-header-project {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}
.fst-header-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--p-text-color);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-header-subfund {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
/* Phase stepper */
.fst-stepper {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
  overflow: hidden;
  gap: 0;
}
.fst-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.fst-step-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}
.fst-step--active .fst-step-dot {
  box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
}
.fst-step-label {
  font-size: 8px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  max-width: 58px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.fst-step--active .fst-step-label,
.fst-step--done .fst-step-label { color: var(--p-text-color); }
.fst-step-line {
  width: 20px;
  height: 2px;
  margin-bottom: 10px;
  flex-shrink: 0;
  transition: background 0.3s;
}
/* Header right */
.fst-header-right {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}
.fst-score-badge {
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.fst-score-denom {
  font-size: 11px;
  opacity: 0.55;
  font-weight: 400;
}
.fst-running-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #42a5f5;
  padding: 3px 10px;
  background: rgba(66,165,245,0.1);
  border-radius: 20px;
  border: 1px solid rgba(66,165,245,0.25);
}

/* ── Body ────────────────────────────────── */
.fst-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Center */
.fst-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--p-surface-border);
  overflow: hidden;
}
.fst-tabs-bar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  flex-shrink: 0;
}
.fst-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border: none;
  background: none;
  color: var(--p-text-muted-color);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}
.fst-tab:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.fst-tab--on { background: var(--p-primary-color, #42a5f5); color: #fff; }
.fst-tab-count {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(255,255,255,0.25);
}
.fst-tab-count--red { background: #ef4444; color: #fff; }
.fst-panel-fill {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Right panel */
.fst-right {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-ground);
}
.fst-rs {
  padding: 12px 14px;
  border-bottom: 1px solid var(--p-surface-border);
}
.fst-rs-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 10px;
}

/* KPIs */
.fst-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.fst-kpi {
  text-align: center;
  padding: 8px 3px;
  background: var(--p-surface-card);
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}
.fst-kpi-v {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--p-text-color);
}
.fst-kpi-u {
  font-size: 9px;
  color: var(--p-text-muted-color);
  line-height: 1;
}
.fst-kpi-l {
  font-size: 8.5px;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 2px;
}

/* Radar */
.fst-radar {
  width: 100%;
  max-width: 190px;
  display: block;
  margin: 0 auto 10px;
}

/* Dimensions */
.fst-dims { display: flex; flex-direction: column; gap: 5px; }
.fst-dim-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-dim-lbl {
  font-size: 10px;
  color: var(--p-text-muted-color);
  width: 48px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-dim-track {
  flex: 1;
  height: 4px;
  background: var(--p-surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-dim-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.fst-dim-num {
  font-size: 10px;
  font-weight: 700;
  width: 22px;
  text-align: right;
  flex-shrink: 0;
}

/* Votes */
.fst-vote-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.fst-vc {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 10px;
}
.fst-vc-n { color: var(--p-text-muted-color); }
.fst-vc-s { font-weight: 700; }

/* Decision */
.fst-rs--decision { background: var(--p-surface-card); }
.fst-decision-score {
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.fst-decision-denom {
  font-size: 16px;
  opacity: 0.45;
  font-weight: 400;
}
.fst-decision-rec {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}
.fst-decision-conds {
  list-style: none;
  margin: 0 0 4px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fst-decision-conds li {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

/* Contradictions */
.fst-contradictions-list { display: flex; flex-direction: column; gap: 8px; }
.fst-contradiction-item {
  background: var(--p-surface-100);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}
.fst-contradiction-dim {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
}
.fst-contradiction-severity {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.fst-contradiction-severity.sev-high { background: #ffcdd2; color: #c62828; }
.fst-contradiction-severity.sev-medium { background: #fff3e0; color: #e65100; }
.fst-contradiction-severity.sev-low { background: #e8f5e9; color: #2e7d32; }
.fst-contradiction-thesis { margin-top: 4px; color: var(--p-text-color); }
.fst-contradiction-antithesis { color: var(--p-text-muted-color); font-style: italic; }

/* Deal conditions */
.fst-deal-conditions { display: flex; flex-direction: column; gap: 4px; }
.fst-deal-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.fst-cond-type {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.fst-cond-type.type-MILESTONE { background: #e3f2fd; color: #1565c0; }
.fst-cond-type.type-GOVERNANCE { background: #f3e5f5; color: #7b1fa2; }
.fst-cond-type.type-RISK { background: #fce4ec; color: #c62828; }
.fst-cond-text { flex: 1; color: var(--p-text-color); }
.fst-cond-metric { color: var(--p-text-muted-color); font-size: 11px; }

/* Belief Drift */
.fst-belief-drift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.fst-drift-card {
  background: var(--p-surface-100);
  border-radius: 8px;
  padding: 8px 10px;
}
.fst-drift-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-drift-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.fst-drift-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-drift-changed {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 6px;
  background: #fff3e0;
  color: #e65100;
  font-weight: 600;
  margin-left: auto;
}
.fst-drift-bars { display: flex; flex-direction: column; gap: 3px; }
.fst-drift-bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}
.fst-drift-label {
  width: 42px;
  color: var(--p-text-muted-color);
  font-size: 10px;
}
.fst-drift-bar {
  height: 6px;
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.5s ease;
}
.fst-drift-val {
  font-size: 10px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.fst-drift-delta {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  margin-top: 4px;
  color: var(--p-text-muted-color);
}
.fst-drift-delta.positive { color: #4caf50; }
.fst-drift-delta.negative { color: #ef5350; }

.fst-human-result {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 6px;
  color: var(--p-text-color);
}

/* Approval */
.fst-rs--approval {
  background: color-mix(in srgb, #ffa726 6%, transparent);
  border-color: color-mix(in srgb, #ffa726 25%, transparent);
}
.fst-approval-hint {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 0 0 10px;
}
.fst-approval-btns {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Agents Bar ───────────────────────────── */
.fst-agents-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  overflow-x: auto;
  flex-shrink: 0;
  min-height: 52px;
}
.fst-ac {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
  flex-shrink: 0;
  transition: border-color 0.2s, background 0.2s;
}
.fst-ac--thinking {
  border-color: var(--ac);
  background: color-mix(in srgb, var(--ac) 8%, transparent);
  animation: fst-chip-pulse 2s ease-in-out infinite;
}
.fst-ac--voted { border-color: var(--ac); }
.fst-ac--done { opacity: 0.65; }
.fst-ac-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ac);
  flex-shrink: 0;
}
.fst-ac--thinking .fst-ac-dot { animation: fst-dot-blink 1s ease-in-out infinite; }
.fst-ac-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
}
.fst-ac-status { display: flex; align-items: center; gap: 4px; }
.fst-ac-tool {
  font-size: 8px;
  color: var(--ac);
  background: color-mix(in srgb, var(--ac) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--ac) 40%, transparent);
  border-radius: 3px;
  padding: 0 4px;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Живая лента активности агентов */
.fst-activity-feed {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--p-surface-ground) 80%, transparent);
  border-bottom: 1px solid var(--p-surface-border);
  border-radius: 6px 6px 0 0;
  animation: fadeIn .2s ease;
}
.fst-activity-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 4px;
  padding: 2px 7px;
}
.fst-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fst-activity-agent { font-weight: 600; color: var(--p-text-color); }
.fst-activity-arrow { opacity: .5; }
.fst-activity-tool { color: #ff9800; font-family: monospace; flex-shrink: 0; }
.fst-activity-reason {
  color: var(--p-text-color);
  opacity: .8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
.fst-activity-item--result { background: color-mix(in srgb, #4caf50 8%, var(--p-surface-card)); }
.fst-activity-item--result .fst-activity-tool { color: #4caf50; }
.fst-activity-result-arrow { color: #4caf50; font-weight: bold; flex-shrink: 0; }
.fst-ac-delta {
  font-size: 9px;
  opacity: 0.85;
  margin-left: 4px;
  cursor: help;
  white-space: nowrap;
}
.fst-ac-vote {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.fst-ac-pipe {
  display: flex;
  gap: 2px;
  align-items: center;
}
.fst-pd {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-border);
  transition: all 0.3s;
}

@keyframes fst-chip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ac) 30%, transparent); }
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ac) 8%, transparent); }
}
@keyframes fst-dot-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* ── Setup Screen ─────────────────────────────────────────── */
.fst-setup {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
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
.fst-agent-pipeline {
  display: flex; align-items: center; gap: 2px; margin-top: 4px; flex-wrap: wrap;
}
.fst-pnode {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 4px; font-size: 0.7rem;
  border: 1px solid transparent; opacity: 0.3; transition: all 0.3s; cursor: default;
}
.fst-pnode.done, .fst-pnode.active { opacity: 1; }
.fst-pnode.error { border-color: #ef5350 !important; background: #ef535011 !important; opacity: 1; }
.fst-parrow {
  font-size: 0.6rem; color: var(--p-text-muted-color); opacity: 0.6;
  white-space: nowrap; user-select: none; letter-spacing: -1px;
}
@keyframes fst-pulse { 0%,100% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 4px 1px currentColor; } }
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
  min-height: 0;
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

/* Contradictions */
.fst-contradictions-list { display: flex; flex-direction: column; gap: 8px; }
.fst-contradiction-item {
  background: var(--p-surface-100);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}
.fst-contradiction-dim {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
}
.fst-contradiction-severity {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.fst-contradiction-severity.sev-high { background: #ffcdd2; color: #c62828; }
.fst-contradiction-severity.sev-medium { background: #fff3e0; color: #e65100; }
.fst-contradiction-severity.sev-low { background: #e8f5e9; color: #2e7d32; }
.fst-contradiction-thesis { margin-top: 4px; color: var(--p-text-color); }
.fst-contradiction-antithesis { color: var(--p-text-muted-color); font-style: italic; }

/* Deal conditions */
.fst-deal-conditions { display: flex; flex-direction: column; gap: 4px; }
.fst-deal-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.fst-cond-type {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.fst-cond-type.type-MILESTONE { background: #e3f2fd; color: #1565c0; }
.fst-cond-type.type-GOVERNANCE { background: #f3e5f5; color: #7b1fa2; }
.fst-cond-type.type-RISK { background: #fce4ec; color: #c62828; }
.fst-cond-text { flex: 1; color: var(--p-text-color); }
.fst-cond-metric { color: var(--p-text-muted-color); font-size: 11px; }

/* Belief Drift */
.fst-belief-drift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.fst-drift-card {
  background: var(--p-surface-100);
  border-radius: 8px;
  padding: 8px 10px;
}
.fst-drift-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-drift-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.fst-drift-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-drift-changed {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 6px;
  background: #fff3e0;
  color: #e65100;
  font-weight: 600;
  margin-left: auto;
}
.fst-drift-bars { display: flex; flex-direction: column; gap: 3px; }
.fst-drift-bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}
.fst-drift-label {
  width: 42px;
  color: var(--p-text-muted-color);
  font-size: 10px;
}
.fst-drift-bar {
  height: 6px;
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.5s ease;
}
.fst-drift-val {
  font-size: 10px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.fst-drift-delta {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  margin-top: 4px;
  color: var(--p-text-muted-color);
}
.fst-drift-delta.positive { color: #4caf50; }
.fst-drift-delta.negative { color: #ef5350; }

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

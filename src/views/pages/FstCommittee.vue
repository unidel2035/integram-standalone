<template>
  <div class="fst-committee">
    <!-- Toast provided by AppLayout.vue — no duplicate needed -->

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

        <!-- Сценарное прогнозирование — цепочка событий развития стартапа -->
        <div class="fst-conclusion-section fst-scenario-section">
          <div class="fst-conclusion-label">Сценарное прогнозирование (событийная онтология):</div>
          <ScenarioEventChainPanel
            :project="session.project"
            :session="session"
            :decision="session.conditionalDecision || session.decision"
            :initial-chain="sessionChain"
            :chain-generating="sessionChainLoading"
          />
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
          <div v-if="session.savedContractId" class="fst-contract-saved">
            <i class="pi pi-file-check"></i>
            Смарт контракт #{{ session.savedContractId }} сохранён в базе
          </div>
        </div>

        <!-- Рекомендации комитета (#158) -->
        <div v-if="session.recommendations?.length" class="fst-conclusion-section fst-recommendations">
          <div class="fst-conclusion-label">Рекомендации комитета ({{ session.recommendations.length }}):</div>
          <div class="fst-rec-list">
            <div v-for="rec in session.recommendations" :key="rec.id || rec.text"
                 class="fst-rec-item" :class="'priority-' + (rec.priority || 'MEDIUM').toLowerCase()">
              <span class="fst-rec-avatar">{{ rec.agentAvatar || '📋' }}</span>
              <div class="fst-rec-body">
                <div class="fst-rec-header">
                  <span class="fst-rec-agent">{{ rec.agent || rec.agentId }}</span>
                  <Tag :value="rec.priority" :severity="rec.priority === 'CRITICAL' || rec.priority === 'HIGH' ? 'danger' : rec.priority === 'LOW' ? 'success' : 'warn'" size="small" />
                  <span v-if="rec.owner" class="fst-rec-owner">→ {{ rec.owner }}</span>
                </div>
                <div class="fst-rec-text">{{ rec.text }}</div>
                <div v-if="rec.weeks || rec.effort" class="fst-rec-meta">
                  <span v-if="rec.weeks"><i class="pi pi-clock"></i> {{ rec.weeks }} нед.</span>
                  <span v-if="rec.effort"><i class="pi pi-bolt"></i> {{ rec.effort }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ontology: что дальше после решения ИК -->
        <OntologyNextSteps entity-type="session" :entity-id="session.id" style="margin:12px 0" />

        <div v-if="session.decision.humanApproval" class="fst-human-result">
          <i class="pi pi-check-circle" style="color:var(--fst-green)"></i>
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
            <i class="pi pi-check-circle" style="color:var(--fst-green)"></i>
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
            <i class="pi pi-check-circle" style="color:var(--fst-purple)"></i>
            СОД #{{ intEventId }}
          </span>
          <LearnTooltip
            label="Новая сессия"
            what="Сбрасывает текущую сессию и возвращает к выбору проекта для оценки"
            when="После просмотра результатов текущей сессии инвесткомитета"
            :terms="['Сессия комитета', 'Инвесткомитет']"
          >
            <Button
            v-if="session?.decision?.recommendation === 'APPROVE' || session?.decision?.recommendation === 'CONDITIONAL'"
            label="Открыть сделку"
            icon="pi pi-file-edit"
            severity="success"
            size="small"
            @click="openDealFromCommittee"
          />
          <Button
            label="История проекта"
            icon="pi pi-history"
            severity="secondary"
            size="small"
            @click="openProjectHub"
          />
          <Button label="Новая сессия" icon="pi pi-refresh" severity="secondary" @click="resetSession"
              style="margin-left:auto"
              data-action="reset-session"
              data-description="Сбрасывает текущую сессию и возвращает к выбору проекта"
            />
          </LearnTooltip>
        </div>
      </template>
    </Dialog>

    <!-- ═══ Main Dashboard ═══ -->
    <div v-if="session" class="fst-dashboard">

      <!-- ── Header ───────────────────────────────────────────── -->
      <div class="fst-header">
        <div class="fst-header-project">
          <i class="pi pi-building" style="color:var(--fst-brand)"></i>
          <span class="fst-header-title">{{ session.project.title }}</span>
          <span class="fst-header-subfund"
            :style="{ background: SUBFUNDS[session.project.subFund]?.color || 'var(--p-text-muted-color)' }">
            {{ SUBFUNDS[session.project.subFund]?.shortName || session.project.subFund }}
          </span>
        </div>

        <!-- Phase stepper -->
        <div class="fst-stepper">
          <template v-for="(ph, idx) in visiblePhases" :key="ph.id">
            <div :class="['fst-step', { 'fst-step--done': phaseIdx > idx, 'fst-step--active': phaseIdx === idx }]">
              <div class="fst-step-dot"
                :style="{ background: phaseIdx >= idx ? ph.color : 'transparent', borderColor: ph.color }">
                <i v-if="phaseIdx > idx" class="pi pi-check" style="font-size:7px;color:white"></i>
              </div>
              <span class="fst-step-label">{{ ph.label }}</span>
            </div>
            <div v-if="idx < visiblePhases.length - 1" class="fst-step-line"
              :style="{ background: phaseIdx > idx ? ph.color : 'var(--surface-border)' }"></div>
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
            <i class="pi pi-exclamation-triangle" style="color:var(--fst-brand)"></i>
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
              <span class="fst-activity-dot" :style="{ background: AGENTS.find(a=>a.id===agId)?.color || 'var(--p-text-muted-color)' }"></span>
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

          <!-- Issue #192: Брифинг стартапера -->
          <div v-if="startuperTwin" class="fst-rs fst-rs--briefing">
            <div class="fst-rs-title" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center"
              @click="briefingOpen = !briefingOpen">
              <span><i class="pi pi-bolt" style="color:var(--fst-brand)"></i> Брифинг: {{ startuperTwin.company }}</span>
              <span style="display:flex;align-items:center;gap:6px">
                <i :class="briefingOpen ? 'pi pi-angle-up' : 'pi pi-angle-down'"
                  style="font-size:11px;color:var(--p-text-muted-color)"></i>
                <i class="pi pi-times" style="font-size:11px;color:var(--p-text-muted-color)"
                  @click.stop="closeBriefing()" title="Закрыть"></i>
              </span>
            </div>
            <div v-if="briefingOpen">
              <!-- Метрики -->
              <div v-if="startuperTwin.metrics" class="fst-briefing-metrics">
                <div v-for="(val, key) in startuperTwin.metrics" :key="key" class="fst-briefing-m">
                  <div class="fst-briefing-mv">{{ typeof val === 'number' ? val.toFixed(val < 10 ? 1 : 0) : val }}</div>
                  <div class="fst-briefing-mk">{{ key }}</div>
                </div>
              </div>
              <!-- Скоринг -->
              <div v-if="startuperTwin.scoring" class="fst-briefing-score-row">
                <span class="fst-briefing-score-lbl">Скоринг</span>
                <div class="fst-briefing-score-bar">
                  <div :style="{ width: startuperTwin.scoring + '%',
                    background: startuperTwin.scoring > 65 ? 'var(--fst-green)' : startuperTwin.scoring > 40 ? 'var(--fst-brand)' : 'var(--fst-red)'
                  }"></div>
                </div>
                <span class="fst-briefing-score-val">{{ startuperTwin.scoring }}/100</span>
              </div>
              <!-- Психотип -->
              <div v-if="startuperTwin.psychoProfile" class="fst-briefing-psycho">
                <span class="fst-briefing-psycho-mbti">{{ startuperTwin.psychoProfile.mbti || '—' }}</span>
                <span class="fst-briefing-psycho-conf" :style="{
                  color: (startuperTwin.psychoProfile.confidence || 0) > 0.7 ? 'var(--fst-green)' : 'var(--fst-brand)'
                }">уверенность {{ Math.round((startuperTwin.psychoProfile.confidence || 0) * 100) }}%</span>
              </div>
              <div v-if="startuperTwin.psychoProfile?.redFlags?.length" class="fst-briefing-flags">
                <div v-for="f in startuperTwin.psychoProfile.redFlags.slice(0,2)" :key="f"
                  class="fst-briefing-flag fst-briefing-flag--red">
                  <i class="pi pi-exclamation-triangle"></i> {{ f }}
                </div>
              </div>
              <div v-if="startuperTwin.psychoProfile?.greenSignals?.length" class="fst-briefing-flags">
                <div v-for="g in startuperTwin.psychoProfile.greenSignals.slice(0,2)" :key="g"
                  class="fst-briefing-flag fst-briefing-flag--green">
                  <i class="pi pi-check-circle"></i> {{ g }}
                </div>
              </div>
              <!-- Аномалии/маяки -->
              <div v-if="startuperTwin.beacons?.length" class="fst-briefing-beacons">
                <div v-for="b in startuperTwin.beacons.slice(0,3)" :key="b.text"
                  class="fst-briefing-beacon"
                  :style="{ borderLeft: '3px solid ' + (b.severity === 'critical' ? 'var(--fst-red)' : b.severity === 'warning' ? 'var(--fst-brand)' : 'var(--fst-green)') }">
                  <div class="fst-briefing-beacon-text">{{ b.text }}</div>
                  <div v-if="b.recommendation" class="fst-briefing-beacon-rec">{{ b.recommendation }}</div>
                </div>
              </div>
              <!-- Сводка психопрофиля -->
              <div v-if="startuperTwin.psychoProfile?.summary" class="fst-briefing-summary">
                {{ startuperTwin.psychoProfile.summary }}
              </div>
            </div>
          </div>

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
                fill="none" stroke="var(--surface-border)" stroke-width="0.5" stroke-dasharray="3,3"/>
              <line v-for="(ax, i) in radarAxes" :key="'a'+i"
                x1="100" y1="100"
                :x2="100 + Math.cos(ax.angle - Math.PI/2) * 80"
                :y2="100 + Math.sin(ax.angle - Math.PI/2) * 80"
                stroke="var(--surface-border)" stroke-width="0.5"/>
              <polygon :points="radarPoints" :style="{ fill: 'color-mix(in srgb, var(--fst-blue) 15%, transparent)', stroke: 'var(--fst-blue)' }" stroke-width="1.5"/>
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
                  background: VERDICTS[vote.verdict]?.color ? `color-mix(in srgb, ${VERDICTS[vote.verdict].color} 10%, transparent)` : 'var(--p-surface-section)' }">
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
                <i class="pi pi-angle-right" style="color:var(--fst-brand);font-size:0.6875rem"></i> {{ c }}
              </li>
            </ul>
            <div v-if="session.decision.humanApproval" class="fst-human-result">
              <i class="pi pi-check-circle" style="color:var(--fst-green)"></i>
              Утверждено: <strong>{{ VERDICTS[session.decision.humanApproval.verdict]?.label }}</strong>
            </div>
            <Button label="Полный отчёт" icon="pi pi-arrow-right" icon-pos="right"
              size="small" outlined severity="secondary"
              style="width:100%;margin-top:10px;justify-content:center"
              @click="conclusionVisible = true"
              data-action="view-protocol"
              data-description="Открывает полный протокол заседания с голосами агентов и условиями"
            />
          </div>

          <!-- Human Approval -->
          <div v-if="session.phase === 'HUMAN_APPROVAL'" class="fst-rs fst-rs--approval">
            <div class="fst-rs-title" style="color:var(--fst-brand)">
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

      <!-- ── Issue #160: Debug Panel (dev mode) ────────────────── -->
      <div v-if="devMode && Object.keys(agentStats).length" class="fst-debug-panel">
        <div class="fst-debug-title">
          <i class="pi pi-bug"></i> Agent Diagnostics
          <span class="fst-debug-summary">
            LLM: {{ Object.values(agentStats).filter(s => s.agentLoop).length }}/{{ Object.keys(agentStats).length }}
            | Avg iter: {{ (Object.values(agentStats).reduce((s, a) => s + (a.iterCount || 0), 0) / Math.max(Object.keys(agentStats).length, 1)).toFixed(1) }}
            | Forced: {{ Object.values(agentStats).filter(s => s.forcedPublish).length }}
            | Tools: {{ [...new Set(Object.values(agentStats).flatMap(s => s.toolsUsed || []))].length }} unique
          </span>
        </div>
        <div class="fst-debug-grid">
          <div v-for="agent in AGENTS" :key="'dbg-'+agent.id" class="fst-debug-agent">
            <span class="fst-debug-name" :style="{ color: agent.color }">{{ agent.shortName }}</span>
            <span :class="['fst-debug-mode', agentStats[agent.id]?.agentLoop ? 'ok' : 'warn']">
              {{ agentStats[agent.id]?.agentLoop ? '🤖 LLM' : '📐 Formula' }}
            </span>
            <span class="fst-debug-val">iter={{ agentStats[agent.id]?.iterCount || 0 }}</span>
            <span class="fst-debug-val">args={{ agentStats[agent.id]?.argCount || 0 }}</span>
            <span class="fst-debug-val" :title="(agentStats[agent.id]?.toolsUsed || []).join(', ')">
              tools={{ (agentStats[agent.id]?.toolsUsed || []).length }}
            </span>
            <span v-if="agentStats[agent.id]?.model" class="fst-debug-model">{{ agentStats[agent.id].model?.split('/').pop() }}</span>
            <span v-if="agentStats[agent.id]?.forcedPublish" class="fst-debug-forced">⚡forced</span>
          </div>
        </div>
      </div>

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
          <span class="fst-ac-mode"
            :title="agentStats[agent.id]?.agentLoop ? `LLM: ${agentStats[agent.id].model || '?'} | iter=${agentStats[agent.id].iterCount}` : 'Формула'">
            {{ agentStats[agent.id]?.agentLoop ? '🤖' : '📐' }}
          </span>
          <span class="fst-ac-name">{{ agent.shortName }}</span>
          <span v-if="agentStatus(agent.id).thinking" class="fst-ac-status">
            <i class="pi pi-spin pi-spinner" style="font-size:0.6875rem;color:var(--ac)"></i>
            <span v-if="agentActivity[agent.id]?.tool" class="fst-ac-tool">
              {{ agentActivity[agent.id].tool }}
            </span>
          </span>
          <span v-else-if="agentStatus(agent.id).vote" class="fst-ac-vote"
            :style="{ background: VERDICTS[agentStatus(agent.id).vote]?.color }">
            <i :class="VERDICTS[agentStatus(agent.id).vote]?.icon" style="font-size:0.625rem"></i>
            {{ agentStatus(agent.id).voteScore }}
          </span>
          <!-- Дельта позиции (OPENING → SUMMARY) -->
          <span v-if="session?.positionDeltas?.[agent.id]?.changed"
            class="fst-ac-delta"
            :title="`Позиция изменилась: ${session.positionDeltas[agent.id].from} → ${session.positionDeltas[agent.id].to}`">
            {{ stanceEmoji(session.positionDeltas[agent.id].from) }}→{{ stanceEmoji(session.positionDeltas[agent.id].to) }}
          </span>
          <span v-else-if="agentStatus(agent.id).done" class="fst-ac-status">
            <i class="pi pi-check" style="font-size:0.6875rem;color:var(--fst-green)"></i>
          </span>
          <div class="fst-ac-pipe">
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.integram, 'var(--fst-blue)')" title="Данные"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.calc, 'var(--fst-brand)')" title="Расчёт"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.llm, 'var(--fst-purple)')" title="LLM"></span>
            <span class="fst-pd" :style="fstPipeNodeStyle(agentStatus(agent.id).pipeline?.save, 'var(--fst-green)')" title="Сохр."></span>
          </div>
        </div>
      </div>

    </div><!-- /fst-dashboard -->

    <!-- ═══ Setup Screen ═══ -->
    <div v-else class="fst-setup">

      <!-- Hub-style topbar -->
      <div class="ck-topbar fst-topbar">
        <div class="ck-topbar-left">
          <span class="ck-live-dot"></span>
          <span class="ck-title">AI-Инвесткомитет</span>
          <span class="ck-sep">·</span>
          <span class="ck-sub">6 агентов · дебаты · решение с обоснованием</span>
        </div>
        <div class="ck-topbar-actions">
          <button class="ck-btn" @click="newProjectDialog = true" title="Новая заявка">
            <i class="pi pi-file-plus"></i><span class="ck-btn-label"> Новая заявка</span>
          </button>
          <button class="ck-btn ck-btn--accent" @click="$router.push('/fst-protocol')" title="История заседаний">
            <i class="pi pi-clock"></i><span class="ck-btn-label"> История</span>
          </button>
        </div>
      </div>

      <!-- KPI metrics strip -->
      <div class="ck-metrics fst-metrics-strip">
        <div v-for="m in ckMetrics" :key="m.label" class="ck-metric fst-metric-item" :style="{ '--ck-c': m.color }">
          <i :class="m.icon" class="ck-metric-icon"></i>
          <div class="ck-metric-val">{{ m.val }}</div>
          <div class="ck-metric-label">{{ m.label }}</div>
        </div>
      </div>

      <!-- ═══ Project Detail Modal ═══ -->
      <Dialog v-model:visible="projectModalVisible" modal
        :closable="true" :dismissable-mask="true"
        :style="{ width: '560px', maxWidth: '95vw' }"
        :header="previewProject?.title || ''"
        :pt="{ header: { style: 'border-bottom: 3px solid ' + (SUBFUNDS[previewProject?.subFund]?.color || 'var(--fst-brand)') } }">
        <div v-if="previewProject" class="fst-pmodal">
          <div class="fst-pmodal-top">
            <div class="fst-pmodal-subfund" :style="{ background: SUBFUNDS[previewProject.subFund]?.color || 'var(--p-text-muted-color)' }">
              <span v-if="SUBFUNDS[previewProject.subFund]?.svgIcon" v-html="SUBFUNDS[previewProject.subFund].svgIcon" class="fst-subfund-svg"></span>
              <i v-else :class="SUBFUNDS[previewProject.subFund]?.icon"></i>
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

          <!-- Факторная модель T·S·M·G·E — если уже рассчитана -->
          <div v-if="previewProject._factorResult" class="fst-pmodal-factor">
            <div class="fst-pmodal-factor-title">
              Факторная оценка
              <span class="fst-pmodal-factor-grade"
                :style="{ color: previewProject._factorResult.grade <= 'B' ? 'var(--fst-green)' : 'var(--fst-brand)' }">
                {{ previewProject._factorResult.grade }}
              </span>
              <span class="fst-pmodal-factor-composite">{{ previewProject._factorResult.composite?.toFixed(1) }}/10</span>
            </div>
            <div class="fst-pmodal-factor-bars">
              <div v-for="(f, key) in previewProject._factorResult.factors" :key="key" class="fst-pmodal-factor-row">
                <span class="fst-pmodal-fkey">{{ key }}</span>
                <div class="fst-pmodal-fbar">
                  <div class="fst-pmodal-fbar-fill"
                    :style="{
                      width: ((f.score||0)/10*100) + '%',
                      background: f.score >= 7 ? 'var(--fst-green)' : f.score >= 4 ? 'var(--fst-brand)' : 'var(--fst-red)'
                    }">
                  </div>
                </div>
                <span class="fst-pmodal-fscore"
                  :style="{ color: (f.score||0) >= 7 ? 'var(--fst-green)' : (f.score||0) >= 4 ? 'var(--fst-brand)' : 'var(--fst-red)' }">
                  {{ f.score != null ? f.score.toFixed(1) : '—' }}
                </span>
              </div>
            </div>
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
        <!-- Projects Table -->
        <div class="fst-setup-col fst-setup-col--projects">
          <div class="fst-project-table-header">
            <div class="fst-proj-header-left">
              <span class="fst-proj-header-label">Проект</span>
              <Transition name="fade">
                <span v-if="selectedProjectId" class="fst-selected-badge">
                  <i class="pi pi-check-circle"></i> Выбран
                </span>
              </Transition>
            </div>
            <IconField class="fst-proj-search-field">
              <InputIcon class="pi pi-search" />
              <InputText v-model="projectFilter" placeholder="Поиск по названию, субфонду..." size="small" />
            </IconField>
            <div class="fst-proj-header-actions">
              <Button :icon="projectView === 'table' ? 'pi pi-th-large' : 'pi pi-list'"
                size="small" text rounded
                :title="projectView === 'table' ? 'Плитки' : 'Таблица'"
                @click="projectView = projectView === 'table' ? 'grid' : 'table'" />
              <Button icon="pi pi-plus" size="small" text rounded title="Новая заявка" @click="newProjectDialog = true" />
            </div>
          </div>

          <DataTable
            v-if="projectView === 'table'"
            :value="PROJECTS_POOL"
            v-model:selection="selectedRow"
            selectionMode="single"
            dataKey="id"
            size="small"
            stripedRows
            :metaKeySelection="false"
            :globalFilterFields="['title', 'company', 'subFund', 'stage']"
            :filters="{ global: { value: projectFilter, matchMode: 'contains' } }"
            scrollable
            scrollHeight="flex"
            class="fst-project-table"
            :rowClass="(p) => p.id === selectedProjectId ? 'fst-row-selected' : ''"
          >
            <template #empty>
              <div class="fst-setup-empty"><i class="pi pi-spin pi-spinner"></i> Загрузка проектов...</div>
            </template>
            <Column style="width:60px">
              <template #body="{ data }">
                <span class="fst-tbl-subfund" :style="{ background: SUBFUNDS[data.subFund]?.color || 'var(--fst-purple)' }">
                  {{ SUBFUNDS[data.subFund]?.shortName || data.subFund?.toUpperCase().slice(0,3) }}
                </span>
              </template>
            </Column>
            <Column style="width:70px">
              <template #body="{ data }">
                <span class="fst-tbl-stage">{{ data.stage }}</span>
              </template>
            </Column>
            <Column field="title" header="Название" style="min-width:180px">
              <template #body="{ data }">
                <div class="fst-tbl-title">{{ data.title }}</div>
                <div class="fst-tbl-company">{{ data.company }}</div>
              </template>
            </Column>
            <Column header="Запрос" style="width:80px">
              <template #body="{ data }">
                <span class="fst-tbl-amount">{{ (data.requestedAmount / 1e6).toFixed(0) }} млн</span>
              </template>
            </Column>
            <Column header="TRL" style="width:46px">
              <template #body="{ data }">
                <span class="fst-tbl-metric" :class="trlClass(data.trl)">{{ data.trl }}</span>
              </template>
            </Column>
            <Column header="IRR" style="width:54px">
              <template #body="{ data }">
                <span class="fst-tbl-metric" :class="irrClass(data.projectedIRR)">{{ (data.projectedIRR * 100).toFixed(0) }}%</span>
              </template>
            </Column>
            <Column style="width:38px">
              <template #body="{ data }">
                <Button icon="pi pi-eye" text rounded size="small" class="fst-tbl-detail-btn" @click.stop="openProjectModal(data)" />
              </template>
            </Column>
          </DataTable>

          <!-- Grid / tile view -->
          <div v-if="projectView === 'grid'" class="fst-project-grid-view">
            <div v-if="!filteredProjects.length" class="fst-setup-empty">
              <i class="pi pi-spin pi-spinner"></i> Загрузка проектов...
            </div>
            <div
              v-for="p in filteredProjects" :key="p.id"
              :class="['fst-pcard2', { 'fst-pcard2--selected': p.id === selectedProjectId }]"
              :style="{ '--card-accent': SUBFUNDS[p.subFund]?.color || 'var(--fst-purple)' }"
              @click="selectedProjectId = p.id"
            >
              <div class="fst-pcard2-body">
                <div class="fst-pcard2-top">
                  <span class="fst-pcard2-stage">{{ p.stage }}</span>
                  <Button icon="pi pi-arrow-right" text rounded size="small" class="fst-pcard2-eye"
                    @click.stop="openProjectModal(p)" title="Детали" />
                </div>
                <div class="fst-pcard2-title">{{ p.title }}</div>
                <div v-if="p.company && p.company !== p.title" class="fst-pcard2-company">{{ p.company }}</div>
                <div class="fst-pcard2-metrics">
                  <span class="fst-pcard2-chip" :class="trlClass(p.trl)">
                    TRL&nbsp;<strong>{{ p.trl }}</strong>
                  </span>
                  <span class="fst-pcard2-chip" :class="irrClass(p.projectedIRR)">
                    IRR&nbsp;<strong>{{ (p.projectedIRR * 100).toFixed(0) }}%</strong>
                  </span>
                  <span v-if="p.requestedAmount" class="fst-pcard2-amount">
                    {{ (p.requestedAmount / 1e6).toFixed(0) }} млн
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Settings -->
        <div class="fst-setup-col fst-setup-col--settings">
          <div class="fst-rp-section">
            <span class="fst-rp-label">Скорость</span>
            <div class="fst-speed-seg">
              <div v-for="sp in speedOptions" :key="sp.id"
                :class="['fst-speed-seg-btn', { active: selectedSpeed === sp.id }]"
                @click="selectedSpeed = sp.id"
                :title="sp.desc">
                <strong>{{ sp.val }}</strong>
                <span>{{ sp.desc }}</span>
              </div>
            </div>
          </div>

          <div class="fst-rp-section">
            <span class="fst-rp-label">Агенты</span>
            <div class="fst-toggle-row">
              <i :class="useAI ? 'pi pi-bolt' : 'pi pi-server'" class="fst-toggle-icon"
                :style="{ color: useAI ? 'var(--p-purple-400)' : 'var(--p-text-muted-color)' }" />
              <div class="fst-toggle-label">
                <strong>{{ useAI ? 'Реальный AI' : 'Шаблоны' }}</strong>
                <span>{{ useAI ? 'LLM-вызовы на каждый агент' : 'без API, быстро' }}</span>
              </div>
              <ToggleSwitch v-model="useAI" />
            </div>
            <div v-if="useAI" class="fst-toggle-row">
              <i :class="useAgentLoop ? 'pi pi-sitemap' : 'pi pi-comments'" class="fst-toggle-icon"
                :style="{ color: useAgentLoop ? 'var(--p-orange-400)' : 'var(--p-text-muted-color)' }" />
              <div class="fst-toggle-label">
                <strong>Multi-Agent Loop</strong>
                <span>агенты видят аргументы друг друга</span>
              </div>
              <ToggleSwitch v-model="useAgentLoop" />
            </div>
            <div v-if="useAI && useAgentLoop" class="fst-toggle-row">
              <i :class="useOrchestrator ? 'pi pi-server' : 'pi pi-desktop'" class="fst-toggle-icon"
                :style="{ color: useOrchestrator ? 'var(--p-green-400)' : 'var(--p-text-muted-color)' }" />
              <div class="fst-toggle-label">
                <strong>{{ useOrchestrator ? 'Серверный' : 'Client-side' }}</strong>
                <span>{{ useOrchestrator ? 'WebSocket, события в реальном времени' : 'прямо в браузере' }}</span>
              </div>
              <ToggleSwitch v-model="useOrchestrator" />
            </div>
          </div>

          <!-- ═══ Режим голосования ═══ -->
          <div v-if="useAI && useAgentLoop" class="fst-rp-section">
            <span class="fst-rp-label">Голосование</span>
            <SelectButton v-model="votingMode" :options="[
              { label: 'Формула', value: 'formula' },
              { label: 'Гибрид', value: 'hybrid' },
              { label: 'LLM', value: 'llm' }
            ]" optionLabel="label" optionValue="value" :allowEmpty="false" fluid size="small" />
            <div class="fst-rp-hint">
              <span v-if="votingMode === 'formula'">Алгоритмические веса — быстро и предсказуемо</span>
              <span v-else-if="votingMode === 'hybrid'">LLM-позиция + формульный score — баланс</span>
              <span v-else>Только LLM — stance и уверенность агента</span>
            </div>
          </div>

          <!-- ═══ Настройки моделей оркестратора ═══ -->
          <div v-if="useAI" class="fst-acc-row" @click="modelPanelExpanded = !modelPanelExpanded">
            <i class="pi pi-microchip-ai fst-acc-icon" style="color:var(--fst-blue)"></i>
            <span class="fst-acc-label">Модели</span>
            <span class="fst-acc-summary">{{ activeProfileLabel }}</span>
            <i :class="modelPanelExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="fst-acc-chevron"></i>
          </div>
          <div v-if="useAI && modelPanelExpanded" class="fst-model-panel">
            <!-- Профили скорости -->
            <SelectButton :modelValue="selectedSpeedProfile" @update:modelValue="applySpeedProfile"
              :options="speedProfileOptions" optionLabel="label" optionValue="value" :allowEmpty="false" fluid size="small" class="fst-profile-select" />
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
            <div class="fst-preset-row">
              <button class="fst-model-reset-btn" @click="resetModelOverrides">
                <i class="pi pi-refresh"></i> Сбросить к профилю
              </button>
              <button class="fst-model-reset-btn" @click="savePreset" :disabled="presetSaving">
                <i class="pi pi-save"></i> Сохранить пресет
              </button>
            </div>
            <div v-if="configPresets.length" class="fst-presets-list">
              <span style="font-size:0.75rem;color:var(--p-text-muted-color);margin-right:6px">Пресеты:</span>
              <span v-for="p in configPresets" :key="p.id"
                :class="['fst-preset-chip', { active: selectedPresetId === p.id }]"
                @click="applyPreset(p)">
                {{ p.name }}
              </span>
            </div>
          </div>

          <div class="fst-acc-row" @click="policyExpanded = !policyExpanded">
            <i class="pi pi-sliders-h fst-acc-icon" style="color:var(--fst-brand)"></i>
            <span class="fst-acc-label">Параметры ФСТ</span>
            <span class="fst-acc-summary">Сув. ≥ {{ fstPolicy.minSovereignty }}/9 · TRL ≥ {{ fstPolicy.minTRL }}</span>
            <i :class="policyExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="fst-acc-chevron"></i>
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

          <!-- Issue #161: IC decision thresholds -->
          <div class="fst-ic-params">
            <div class="fst-acc-row" @click="icParamsExpanded = !icParamsExpanded">
              <i class="pi pi-sliders-v fst-acc-icon" style="color:var(--fst-blue)"></i>
              <span class="fst-acc-label">Пороги ИК</span>
              <span class="fst-acc-summary">≥ {{ icParams.approveThreshold }}% / &lt; {{ icParams.deferThreshold }}%</span>
              <i :class="icParamsExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="fst-acc-chevron"></i>
            </div>
            <div v-if="icParamsExpanded" class="fst-policy-grid">
              <div class="fst-policy-item">
                <div class="fst-policy-label">Порог одобрения: <b>{{ icParams.approveThreshold }}%</b></div>
                <Slider v-model="icParams.approveThreshold" :min="55" :max="90" :step="1" class="fst-policy-slider" />
              </div>
              <div class="fst-policy-item">
                <div class="fst-policy-label">Порог «отложить»: <b>{{ icParams.deferThreshold }}%</b></div>
                <Slider v-model="icParams.deferThreshold" :min="30" :max="65" :step="1" class="fst-policy-slider" />
              </div>
              <div class="fst-policy-item">
                <div class="fst-policy-label">Макс итераций агента: <b>{{ icParams.maxIter }}</b></div>
                <Slider v-model="icParams.maxIter" :min="1" :max="10" :step="1" class="fst-policy-slider" />
              </div>
              <div class="fst-policy-item">
                <div class="fst-policy-label">Давление консенсуса: <b>{{ icParams.consensusPressure }}%</b></div>
                <Slider v-model="icParams.consensusPressure" :min="50" :max="100" :step="5" class="fst-policy-slider" />
              </div>
              <div class="fst-policy-item">
                <div class="fst-policy-label">Кворум (мин. агентов): <b>{{ icParams.quorum }}</b></div>
                <Slider v-model="icParams.quorum" :min="3" :max="12" :step="1" class="fst-policy-slider" />
              </div>
              <div style="display:flex;gap:6px;margin-top:4px">
                <Button label="Сброс" icon="pi pi-refresh" size="small" severity="secondary" text
                  @click="icParams = { ...IC_PARAMS_DEFAULTS }" />
                <Button label="Сохранить в БД" icon="pi pi-save" size="small" severity="info" text
                  :loading="icParamsSaving"
                  @click="saveICParams" />
              </div>
            </div>
          </div>

          <div class="fst-setup-launch">
            <FeatureHint
              id="committee-run-btn"
              title="Запуск AI-инвесткомитета"
              description="Нажмите, чтобы запустить голосование 6 AI-агентов по выбранной заявке"
              position="bottom"
            >
              <Button
                label="Запустить инвесткомитет"
                icon="pi pi-play"
                severity="success"
                size="large"
                :disabled="!selectedProjectId"
                @click="startSession"
                class="fst-launch-btn"
                data-action="run-investment-committee"
                data-description="Запускает голосование 6 AI-агентов по инвестиционной заявке"
                data-agent-hint="Требует выбранную компанию. После нажатия ждать 30–60 сек до получения результата."
              />
            </FeatureHint>
            <div v-if="!selectedProjectId" class="fst-launch-hint">Выберите проект слева</div>

            <!-- ── Гейт: Sovereign Score слишком низкий ── -->
            <div v-if="factorGateBlocked" class="fst-factor-gate">
              <div class="fst-factor-gate-title">
                <i class="pi pi-lock" style="color:var(--fst-red)"></i>
                Проект заблокирован: Sovereign Score {{ (factorGateBlocked.factorResult?.factors?.S?.score ?? 0).toFixed(1) }}/10
              </div>
              <div class="fst-factor-gate-body">
                ФСТ НТИ требует суверенности компонентов ≥ 40%. По факторной модели:
                <strong style="color:var(--fst-red)">S = {{ (factorGateBlocked.factorResult?.factors?.S?.score ?? 0).toFixed(1) }}</strong>
                — критическая зависимость от импорта.
              </div>
              <div class="fst-factor-gate-flags">
                <div v-for="f in factorGateBlocked.factorResult?.redFlags" :key="f" style="font-size:11px;color:var(--p-text-muted-color);padding:2px 0">
                  ⚠ {{ f }}
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px">
                <Button label="Всё равно запустить" size="small" severity="danger" text
                  @click="_doStartSession(factorGateBlocked.project); factorGateBlocked = null" />
                <Button label="Отменить" size="small" severity="secondary"
                  @click="factorGateBlocked = null" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Page Help Drawer -->
  <PageHelpDrawer v-model:visible="helpOpen" :page-help="pageHelp" />

  <!-- Issue #163: Новая заявка -->
  <Dialog v-model:visible="newProjectDialog" header="Новая заявка в ИК" :modal="true" :style="{ width: '680px' }" :closable="true">
    <div class="fst-newproj-form">
      <div class="fst-newproj-section">Основное</div>
      <div class="fst-newproj-row">
        <label>Название компании *</label>
        <input v-model="newProj.name" class="fst-newproj-input" placeholder="ООО ДронТех" />
      </div>
      <div class="fst-newproj-row">
        <label>ОГРН</label>
        <input v-model="newProj.ogrn" class="fst-newproj-input" placeholder="1234567890123" maxlength="13" />
      </div>
      <div class="fst-newproj-row">
        <label>Описание проекта</label>
        <textarea v-model="newProj.description" class="fst-newproj-input fst-newproj-textarea" rows="3" placeholder="Краткое описание технологии и продукта"></textarea>
      </div>
      <div class="fst-newproj-row2">
        <div>
          <label>Субфонд *</label>
          <select v-model="newProj.subfundId" class="fst-newproj-input">
            <option value="1096">БАС</option>
            <option value="1098">Робот</option>
            <option value="1100">МЭ</option>
          </select>
        </div>
        <div>
          <label>Стадия *</label>
          <select v-model="newProj.stageId" class="fst-newproj-input">
            <option value="1102">Pre-seed</option>
            <option value="1103">Seed</option>
            <option value="1104">Round A</option>
            <option value="1105">Round B</option>
            <option value="1106">Round C</option>
          </select>
        </div>
      </div>

      <div class="fst-newproj-section">Финансы</div>
      <div class="fst-newproj-row2">
        <div>
          <label>Сумма запроса, млн руб *</label>
          <input v-model.number="newProj.amountMln" type="number" min="0" class="fst-newproj-input" placeholder="15" />
        </div>
        <div>
          <label>Прогноз IRR, %</label>
          <input v-model.number="newProj.projectedIRR" type="number" min="0" max="200" class="fst-newproj-input" placeholder="35" />
        </div>
      </div>
      <div class="fst-newproj-row">
        <label>Размер рынка (TAM), млн руб</label>
        <input v-model.number="newProj.marketSizeMln" type="number" min="0" class="fst-newproj-input" placeholder="10000" />
      </div>

      <div class="fst-newproj-section">Технологии</div>
      <div class="fst-newproj-row3">
        <div>
          <label>TRL (1-9) *</label>
          <input v-model.number="newProj.trl" type="number" min="1" max="9" class="fst-newproj-input" placeholder="5" />
        </div>
        <div>
          <label>MRL (1-10)</label>
          <input v-model.number="newProj.mrl" type="number" min="1" max="10" class="fst-newproj-input" placeholder="3" />
        </div>
        <div>
          <label>Суверенность (0-9)</label>
          <input v-model.number="newProj.sovereigntyScore" type="number" min="0" max="9" class="fst-newproj-input" placeholder="6" />
        </div>
      </div>

      <div class="fst-newproj-section">Команда</div>
      <div class="fst-newproj-row3">
        <div>
          <label>Сила команды (0-10)</label>
          <input v-model.number="newProj.teamStrength" type="number" min="0" max="10" class="fst-newproj-input" placeholder="7" />
        </div>
        <div>
          <label>Сотрудников</label>
          <input v-model.number="newProj.employees" type="number" min="0" class="fst-newproj-input" placeholder="12" />
        </div>
        <div>
          <label>Патентов</label>
          <input v-model.number="newProj.patents" type="number" min="0" class="fst-newproj-input" placeholder="2" />
        </div>
      </div>
    </div>
    <template #footer>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="fst-btn fst-btn--secondary" @click="newProjectDialog = false">Отмена</button>
        <button class="fst-btn fst-btn--primary" :disabled="!newProj.name || !newProj.trl || !newProj.amountMln || newProjSaving" @click="submitNewProject">
          <i v-if="newProjSaving" class="pi pi-spin pi-spinner"></i>
          {{ newProjSaving ? 'Создание...' : 'Создать и выбрать' }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<!-- Page manifest — machine-readable metadata for AI agents -->
<script>
export const pageManifest = {
  id: 'fst-committee',
  title: 'AI-инвесткомитет',
  description: 'Запуск голосования 6 AI-агентов по инвестиционной заявке. Агенты анализируют заявку с разных ролей (Аналитик, Юрист, Технолог, ESG, Рынок, Председатель) и выносят решение.',
  capabilities: [
    { id: 'run-committee', label: 'Запустить ИК', trigger: 'button[data-action="run-investment-committee"]', params: ['companyId'], agentHint: 'Требует выбранную компанию. После нажатия ждать 30–60 сек.' },
    { id: 'view-protocol', label: 'Просмотр протокола', trigger: 'button[data-action="view-protocol"]' },
    { id: 'export-pdf', label: 'Экспорт в PDF', trigger: 'button[data-action="export-pdf"]' },
    { id: 'select-company', label: 'Выбор компании', trigger: '.fst-pcard[data-action="select-company"]', params: ['companyId'] }
  ],
  dataFields: [
    { id: 'company-name', label: 'Название компании', type: 'string' },
    { id: 'vote-result', label: 'Результат голосования', type: 'enum', values: ['approved', 'rejected', 'conditional', 'pending'] },
    { id: 'aggregated-score', label: 'Итоговый балл', type: 'number', range: [0, 100] },
    { id: 'agent-votes', label: 'Голоса агентов', type: 'array' },
    { id: 'conditions', label: 'Условия одобрения', type: 'array' }
  ],
  relatedPages: ['fst-dealflow', 'fst-deal', 'fst-protocol']
}
</script>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Slider from 'primevue/slider'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { FstCommitteeEngine, createSession } from '@/components/fst-committee/FstCommitteeEngine.js'
import {
  SCORING_DIMS, PHASES, PHASE_ORDER, VERDICTS,
  SPEED_MULTIPLIERS,
  FST_POLICY_DEFAULTS, FST_POLICY_RANGES,
} from '@/components/fst-committee/FstCommitteeConfig.js'
import { agents as AGENTS, loadAgents } from '@/components/fst-committee/agentProvider.js'
import {
  COMMITTEE_MODELS, SPEED_PROFILES, buildModelMap, getModelSummary, resolveModel
} from '@/components/fst-committee/fstCommitteeModelOrchestrator.js'
import { saveDecision, createProject, saveCommitteeSession, authenticate, STATUSES, loadCommitteeConfigs, saveCommitteeConfig, loadCommitteeParams, saveCommitteeParams, IC_PARAMS_DEFAULTS } from '@/services/fstApi'
import { saveSessionToKag, saveSessionToIntegram } from '@/components/fst-committee/fstCommitteeAI.js'
import { useEventStore } from '@/stores/eventStore.js'
import { useGrEventStore } from '@/stores/grEventStore.js'
import FinancialCalculator from '@/components/fst-committee/FinancialCalculator.vue'
import DebateGraphPanel from '@/components/fst-committee/DebateGraphPanel.vue'
import DebateTimeline from '@/components/fst-committee/DebateTimeline.vue'
import ScenarioNodesPanel from '@/components/fst-committee/ScenarioNodesPanel.vue'
import ScenarioEventChainPanel from '@/components/fst-committee/ScenarioEventChainPanel.vue'
import { generateEventChain } from '@/composables/useEventChain.js'
import LinksGraphViz from '@/components/links/LinksGraphViz.vue'
import { useFstData } from '@/composables/useFstData.js'
import { useProjectStore } from '@/stores/projectStore.js'
import LearnTooltip from '@/components/LearnTooltip.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import PageHelpDrawer from '@/components/PageHelpDrawer.vue'
import { usePageHelp } from '@/composables/usePageHelp'
import { logger } from '@/utils/logger'

// ── Load FST Data ─────────────────────────────────────────────────

const { projects: PROJECTS_POOL, subfunds: SUBFUNDS, loadProjects, loadSubfunds } = useFstData()
const toast      = useToast()
const router     = useRouter()
const projStore  = useProjectStore()

// Load data on component mount
onMounted(async () => {
  await Promise.all([loadProjects(), loadSubfunds(), loadAgents()])
  // Если пришли из FstStartuper — загружаем twin для брифинга
  const twin = JSON.parse(localStorage.getItem('startuper_twin') || 'null')
  if (twin?.company) {
    startuperTwin.value = twin
    const needle = twin.company.toLowerCase()
    const match = PROJECTS_POOL.value.find(p =>
      p.name?.toLowerCase().includes(needle) ||
      (twin.inn && p.inn === twin.inn)
    )
    if (match) selectedProjectId.value = match.id
    // НЕ удаляем — briefing должен оставаться пока пользователь сам не закроет
  }
  // Если пришли из другой страницы с активным проектом — пре-выбираем его
  const ap = projStore.activeProject
  if (ap && !selectedProjectId.value) {
    const match = PROJECTS_POOL.value.find(p =>
      p.id === ap.id ||
      p.name?.toLowerCase() === ap.name?.toLowerCase() ||
      p.company?.toLowerCase() === ap.company?.toLowerCase()
    )
    if (match) selectedProjectId.value = match.id
  }
  // Set initial project after data loads (if nothing matched above)
  if (PROJECTS_POOL.value.length > 0 && !selectedProjectId.value) {
    selectedProjectId.value = PROJECTS_POOL.value[0].id
  }
  // Issue #161: load IC thresholds from Integram
  loadCommitteeParams().then(p => { icParams.value = p }).catch(() => {})
  // Загружаем ленты прошлых сессий из Integram
  eventStore.load('session', '_all').catch(() => {})
})

// ── State ─────────────────────────────────────────────────────

// Page Help
const { isOpen: helpOpen, pageHelp, toggleHelp } = usePageHelp('fst-committee')

const eventStore = useEventStore()
const grEventStore = useGrEventStore()

const conclusionVisible = ref(false)
const projectModalVisible = ref(false)
const previewProject = ref(null)
// Issue #192: брифинг из FstStartuper
const startuperTwin = ref(null)
const briefingOpen = ref(true)
function closeBriefing() {
  startuperTwin.value = null
  try { localStorage.removeItem('startuper_twin') } catch {}
}
const selectedProjectId = ref(null)
const projectFilter = ref('')
const projectView = ref('table') // 'table' | 'grid'
const selectedRow = computed({
  get: () => PROJECTS_POOL.value?.find(p => p.id === selectedProjectId.value) ?? null,
  set: (p) => { if (p) selectedProjectId.value = p.id }
})

const ckMetrics = computed(() => {
  const projects = PROJECTS_POOL.value || []
  const avgTRL = projects.length
    ? (projects.reduce((s, p) => s + (p.trl || 5), 0) / projects.length).toFixed(1)
    : '—'
  const avgIRR = projects.length
    ? (projects.reduce((s, p) => s + (p.projectedIRR || 0), 0) / projects.length * 100).toFixed(0) + '%'
    : '—'
  const sfCount = Object.keys(SUBFUNDS.value || {}).length || 3
  return [
    { icon: 'pi pi-inbox',      color: 'var(--fst-blue)',   val: projects.length || '...', label: 'Заявок в пайплайне' },
    { icon: 'pi pi-sitemap',    color: 'var(--fst-purple)', val: sfCount,                  label: 'Субфондов' },
    { icon: 'pi pi-microchip',  color: 'var(--fst-green)',  val: avgTRL,                   label: 'Средний TRL' },
    { icon: 'pi pi-chart-line', color: 'var(--fst-brand)',  val: avgIRR,                   label: 'Средний IRR' },
  ]
})

const filteredProjects = computed(() => {
  if (!PROJECTS_POOL.value) return []
  const q = projectFilter.value.toLowerCase()
  if (!q) return PROJECTS_POOL.value
  return PROJECTS_POOL.value.filter(p =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.company || '').toLowerCase().includes(q) ||
    (p.subFund || '').toLowerCase().includes(q) ||
    (p.stage || '').toLowerCase().includes(q)
  )
})
const selectedSpeed = ref('normal')
const useAI        = ref(true)
const useAgentLoop = ref(true)    // Multi-agent orchestrator: tool_use + parallel
const useOrchestrator = ref(false) // Серверная оркестрация (Phase 3)

// Issue #159: restore saved settings from localStorage (must be before refs that use them)
const _savedModelCfg = JSON.parse(localStorage.getItem('fst_agent_models') || '{}')
const _savedProfile  = localStorage.getItem('fst_speed_profile') || 'fast'
const _savedVoting   = localStorage.getItem('fst_voting_mode') || ''

const votingMode = ref(_savedVoting || 'hybrid')   // 'formula' | 'hybrid' | 'llm'
const policyExpanded = ref(false)

// Issue #160: agent diagnostics
const devMode = ref(new URLSearchParams(window.location.search).has('debug'))
const agentStats = ref({})  // { [agentId]: { agentLoop, iterCount, toolsUsed, model, forcedPublish } }

// Issue #161: committee decision thresholds from Integram
const icParams = ref({ ...IC_PARAMS_DEFAULTS })
const icParamsSaving = ref(false)
const icParamsExpanded = ref(false)

async function saveICParams() {
  icParamsSaving.value = true
  try {
    await saveCommitteeParams(icParams.value)
  } finally { icParamsSaving.value = false }
}

// ── Issue #163: Новая заявка ──────────────────────────────────────
const newProjectDialog = ref(false)
const newProjSaving = ref(false)
const _newProjDefaults = () => ({
  name: '', ogrn: '', description: '',
  subfundId: '1096', stageId: '1103',
  amountMln: null, projectedIRR: null, marketSizeMln: null,
  trl: null, mrl: null, sovereigntyScore: null,
  teamStrength: null, employees: null, patents: null,
  metricsHistory: '',
  _showHistory: false,
})
const newProj = ref(_newProjDefaults())

async function submitNewProject() {
  newProjSaving.value = true
  try {
    const d = newProj.value
    const result = await createProject({
      name: d.name,
      ogrn: d.ogrn,
      description: d.description ? `<p>${d.description}</p>` : '',
      subfundId: d.subfundId,
      stageId: d.stageId,
      statusId: '1115', // New
      amount: (d.amountMln || 0) * 1_000_000,
      trl: d.trl || 0,
      mrl: d.mrl || 0,
      sovereigntyScore: d.sovereigntyScore || 0,
      projectedIRR: d.projectedIRR || 0,
      marketSizeMln: d.marketSizeMln || 0,
      teamStrength: d.teamStrength || 0,
      employees: d.employees || 0,
      patents: d.patents || 0,
      metricsHistory: d.metricsHistory ? (() => { try { return JSON.parse(d.metricsHistory) } catch { return undefined } })() : undefined,
    })
    const newId = result?.obj || result?.id
    // Reload projects and auto-select
    await loadProjects(true)
    if (newId) selectedProjectId.value = String(newId) // Integram returns number, list uses string
    newProjectDialog.value = false
    newProj.value = _newProjDefaults()
    toast.add({ severity: 'success', summary: 'Заявка создана', detail: d.name, life: 3000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: err.message, life: 5000 })
  } finally {
    newProjSaving.value = false
  }
}

// ── Оркестратор моделей ────────────────────────────────────────
const modelPanelExpanded = ref(false)
const selectedSpeedProfile = ref(_savedProfile)
const agentModelOverrides = ref(_savedModelCfg)  // { [agentId]: modelId } — переопределения пользователя

const resolvedModels = computed(() =>
  buildModelMap(AGENTS.value.map(a => a.id), selectedSpeedProfile.value, agentModelOverrides.value)
)

const speedProfileOptions = computed(() =>
  Object.entries(SPEED_PROFILES).map(([key, p]) => ({ value: key, label: p.label }))
)

const activeProfileLabel = computed(() => {
  const summary = getModelSummary(resolvedModels.value)
  return summary || SPEED_PROFILES[selectedSpeedProfile.value]?.label
})

function applySpeedProfile(profileKey) {
  selectedSpeedProfile.value = profileKey
  agentModelOverrides.value = {}
  localStorage.setItem('fst_speed_profile', profileKey)
  localStorage.setItem('fst_agent_models', '{}')
}

function setAgentModel(agentId, modelId) {
  agentModelOverrides.value = { ...agentModelOverrides.value, [agentId]: modelId }
  localStorage.setItem('fst_agent_models', JSON.stringify(agentModelOverrides.value))
}

function resetModelOverrides() {
  agentModelOverrides.value = {}
  localStorage.setItem('fst_agent_models', '{}')
}
// Issue #159: persist voting mode
watch(votingMode, v => localStorage.setItem('fst_voting_mode', v))

// Issue #159: config presets from DB
const configPresets = ref([])
const selectedPresetId = ref(null)
const presetSaving = ref(false)

async function loadPresets() {
  try { configPresets.value = await loadCommitteeConfigs() } catch {}
}

function applyPreset(preset) {
  if (!preset) return
  selectedPresetId.value = preset.id
  selectedSpeedProfile.value = preset.speedProfile || 'fast'
  votingMode.value = preset.votingMode || 'hybrid'
  agentModelOverrides.value = preset.modelMap || {}
  localStorage.setItem('fst_speed_profile', selectedSpeedProfile.value)
  localStorage.setItem('fst_voting_mode', votingMode.value)
  localStorage.setItem('fst_agent_models', JSON.stringify(agentModelOverrides.value))
}

async function savePreset() {
  const name = prompt('Название пресета:')
  if (!name) return
  presetSaving.value = true
  try {
    await saveCommitteeConfig({
      name,
      modelMap: agentModelOverrides.value,
      speedProfile: selectedSpeedProfile.value,
      votingMode: votingMode.value,
    })
    await loadPresets()
  } finally { presetSaving.value = false }
}

onMounted(() => { loadPresets() })

const humanComment = ref('')
const session = ref(null)
const running = ref(false)
// Гейт факторной модели: { project, factorResult } если S < 0.4
const factorGateBlocked = ref(null)

// Событийная цепочка — генерируется параллельно с дебатами при старте сессии
const sessionChain        = ref([])
const sessionChainLoading = ref(false)

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
  { id: 'slow',   label: '1x — Полный',    icon: 'pi pi-clock',   val: '1×',   desc: 'Полный' },
  { id: 'normal', label: '2.5x — Быстрый', icon: 'pi pi-bolt',    val: '2.5×', desc: 'Быстрый' },
  { id: 'fast',   label: '6x — Демо',      icon: 'pi pi-forward', val: '6×',   desc: 'Демо' },
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
  return AGENTS.value.find(a => a.id === id)
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
  if (state === 'error')  return { background: 'var(--fst-red)', borderColor: 'var(--fst-red)' }
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
  if (score >= 72) return 'var(--fst-green)'
  if (score >= 50) return 'var(--fst-brand)'
  return 'var(--fst-red)'
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

async function startSession() {
  const project = PROJECTS_POOL.value.find(p => p.id === selectedProjectId.value)
  if (!project) return

  // ─── Факторная модель T·S·M·G·E — считаем до старта ──────────────────────
  // Результат патчит project._factorScores → используется в computeDimScores()
  if (!project._factorScores) {
    try {
      const fr = await fetch('/api/factor/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal: {
            companyName:      project.company || project.title,
            description:      project.description,
            trl:              project.trl,
            trlGrowth:        (project.trl || 5) - 4,
            sovereignPercent: (project.sovereigntyScore || 5) / 9 * 100,
            totalInvestment:  (project.requestedAmount || 50) * 3,
            fstInvestment:    project.requestedAmount || 50,
            grChainCoverage:  project.localizationRatio || 0.5,
            exportPotential:  'medium',
          },
        }),
      })
      if (fr.ok) {
        const fd = await fr.json()
        project._factorResult = fd
        project._factorScores = {
          T: (fd.factors.T?.score ?? 5) / 10,
          S: (fd.factors.S?.score ?? 5) / 10,
          M: (fd.factors.M?.score ?? 5) / 10,
          G: (fd.factors.G?.score ?? 5) / 10,
          E: (fd.factors.E?.score ?? 5) / 10,
        }
        // Гейт: S < 0.4 (Sovereign Score < 4/10) — жёсткий фильтр ФСТ
        if (project._factorScores.S < 0.4) {
          factorGateBlocked.value = { project, factorResult: fd }
          return
        }
      }
    } catch (e) {
      console.warn('[FstCommittee] factor score failed, using raw dims:', e.message)
    }
  }

  _doStartSession(project)
}

function _doStartSession(project) {
  const sess = createSession(project, {
    speed:          selectedSpeed.value,
    policy:         { ...fstPolicy.value },
    useAI:          useAI.value,
    useAgentLoop:   useAgentLoop.value,
    useOrchestrator: useOrchestrator.value,
    votingMode:      votingMode.value,
    speedProfile:   selectedSpeedProfile.value,
    modelOverrides: { ...agentModelOverrides.value },
    icParams:       { ...icParams.value },
  })
  session.value = sess
  agentActivity.value = {}

  // ─── GR-контекст: инжектируем в сессию для агентов ────────────────────────
  const grState    = grEventStore.getState(selectedProjectId.value)
  const grTimeline = grEventStore.getTimeline(selectedProjectId.value)
  if (grTimeline.length || grState.triggers?.length) {
    const grLines = []
    if (grState.triggers?.length)
      grLines.push(`Выявленные барьеры: ${grState.triggers.join(', ')}`)
    if (grState.trl)
      grLines.push(`TRL по GR-событиям: ${grState.trl}`)
    if (grState.totalFunding)
      grLines.push(`Полученное финансирование: ${(grState.totalFunding/1e6).toFixed(1)} млн ₽`)
    if (grState.fundedMeasures?.length)
      grLines.push(`Одобренные меры: ${grState.fundedMeasures.filter(Boolean).join(', ')}`)
    if (grState.appliedMeasures?.length)
      grLines.push(`Поданные заявки: ${grState.appliedMeasures.filter(Boolean).join(', ')}`)
    if (grState.pilotDone)
      grLines.push('Пилот: завершён')
    if (grState.hasContract)
      grLines.push('Первый контракт: подписан')

    const recentEvts = grTimeline.slice(-5).map(e => `  • [${e.type}] ${e.label || e.type}${e.data?.measure ? ` (${e.data.measure})` : ''}`).join('\n')

    sess._grContext = `\n--- GR-статус проекта (событийная лента) ---\n${grLines.join('\n')}\nПоследние события:\n${recentEvts}\n---`
  }

  engine = new FstCommitteeEngine(sess, handleEvent)
  running.value = true

  // ─── Событийная цепочка — генерируется параллельно с дебатами ────────────
  sessionChain.value = []
  sessionChainLoading.value = true
  generateEventChain(project, null)
    .then(chain => { sessionChain.value = chain })
    .catch(e => { console.warn('[FstCommittee] event chain gen failed:', e) })
    .finally(() => { sessionChainLoading.value = false })

  // Фиксируем старт сессии ИК
  const _evtProject = PROJECTS_POOL.value.find(p => p.id === selectedProjectId.value)
  eventStore.add('session', sess.id, 'SESSION_STARTED', {
    projectId:   selectedProjectId.value,
    projectName: _evtProject?.name,
    agents:      sess.agents?.length || 6,
    votingMode:  votingMode.value,
  })

  engine.start().then(() => {
    running.value = false
    const projectId = selectedProjectId.value
    const project   = PROJECTS_POOL.value.find(p => p.id === projectId) || {}

    // Голоса каждого агента
    for (const vote of (session.value?.votes || [])) {
      eventStore.add('session', sess.id, 'VOTE_CAST', {
        agentId:  vote.agentId || vote.agent,
        verdict:  vote.verdict,
        score:    vote.score,
        reason:   vote.reason?.slice?.(0, 200),
      })
    }

    // Решение ИК
    if (session.value?.decision) {
      const verdict = session.value.decision.recommendation
      eventStore.add('session', sess.id, 'DECISION_MADE', {
        projectId,
        verdict,
        score:      session.value.decision.aggregatedScore,
        conditions: session.value.decision.conditions || [],
      })

      // ─── Регламентные события ИК ──────────────────────────────────────────
    // Определяем тип заседания ИК (1, 2 или 3) по контексту
    // По умолчанию — ИК-1 (первичное рассмотрение). ИК-2 активируется если deal уже в фазе DD.
    const dealTimeline = eventStore.getTimeline('deal', sess.id)
    const hasIC1Done = dealTimeline.some(e => e.type === 'IC1_DECISION_APPROVED')
    const hasIC2Done = dealTimeline.some(e => e.type === 'IC2_DECISION_APPROVED')
    const hasFinClosed = dealTimeline.some(e => e.type === 'FINANCIAL_CLOSING')

    let icRound = 1
    if (hasIC1Done && !hasIC2Done) icRound = 2
    else if (hasIC2Done && hasFinClosed) icRound = 3

    // Добавляем регламентное событие "Созвано заседание ИК-N"
    const icConvenedType = icRound === 1 ? 'IC1_CONVENED' : icRound === 2 ? 'IC2_CONVENED' : 'IC3_CONVENED'
    eventStore.add('session', sess.id, icConvenedType, { projectId, icRound, sessionId: sess.id })

    // Добавляем решение ИК-N в ленту сделки (регламентное событие)
    if (verdict === 'APPROVE' || verdict === 'CONDITIONAL') {
      const icApprovedType = icRound === 1 ? 'IC1_DECISION_APPROVED' : icRound === 2 ? 'IC2_DECISION_APPROVED' : 'IC3_DECISION_CONTINUE'
      eventStore.add('deal', sess.id, icApprovedType, {
        projectId, verdict, score: session.value.decision.aggregatedScore,
        sessionId: sess.id, conditions: session.value.decision.conditions || [],
      })
    } else if (verdict === 'REJECT') {
      const icRejectedType = icRound === 1 ? 'IC1_DECISION_REJECTED' : icRound === 2 ? 'IC2_DECISION_REJECTED' : 'IC3_DECISION_EXIT'
      eventStore.add('deal', sess.id, icRejectedType, {
        projectId, verdict, score: session.value.decision.aggregatedScore, sessionId: sess.id,
      })
    } else {
      // REVISION → доработка
      const icRevType = icRound === 1 ? 'IC1_DECISION_REVISION' : 'IC2_DECISION_REVISION'
      eventStore.add('deal', sess.id, icRevType, {
        projectId, verdict, sessionId: sess.id,
      })
    }

    // ─── Цепочка: решение → deal / project ───────────────────────────────
      if (verdict === 'APPROVE' || verdict === 'CONDITIONAL') {
        // 1. Term Sheet в ленте сделки (entityType = deal, id = sess.id)
        eventStore.add('deal', sess.id, 'TERM_SHEET_PROPOSED', {
          projectId,
          projectName: project.name || project.company,
          amount:      project.askRub || project.amount || 0,
          conditions:  session.value.decision.conditions || [],
          score:       session.value.decision.aggregatedScore,
        })

        // 2. Инициализируем GR-трекинг проекта если ещё нет событий
        const existingGr = grEventStore.getTimeline(projectId)
        if (!existingGr.length) {
          grEventStore.initProject(projectId, {
            name:   project.name || project.company || projectId,
            trl:    project.trl    || 4,
            sector: project.subfund?.includes?.('БАС') || project.subfund?.includes?.('БПЛА')
                      ? 'БАС' : (project.subfund || 'БАС'),
            stage:  project.stage  || 'Pre-seed',
          })
        }
      }
    }

    // ─── Фиксируем факторную оценку в событийной цепочке ─────────────────
    if (project._factorResult) {
      eventStore.add('deal', sess.id, 'FACTOR_SCORED', {
        projectId,
        grade:     project._factorResult.grade,
        composite: project._factorResult.composite,
        factors:   project._factorResult.factors,
        redFlags:  project._factorResult.redFlags,
      })
    }
  }).catch(() => {
    running.value = false
  })
}

function pauseSession() {
  if (engine) engine.stop()
  running.value = false
}

function openDealFromCommittee() {
  const projectId = selectedProjectId.value
  const project   = PROJECTS_POOL.value.find(p => p.id === projectId) || {}
  projStore.setActive({ ...project, _source: 'committee' })
  conclusionVisible.value = false
  router.push('/fst-deal')
}

function openProjectHub() {
  const projectId = selectedProjectId.value
  const project   = PROJECTS_POOL.value.find(p => p.id === projectId) || {}
  projStore.setActive({ ...project, _source: 'committee' })
  conclusionVisible.value = false
  router.push('/fst-project/' + projectId)
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
    session.value.recommendations = s.recommendations || []
    // Новые ссылки на массивы → Vue гарантированно видит изменение
    session.value.events         = [...s.events]
    session.value.arguments      = [...s.arguments]
    session.value.votes          = [...s.votes]
    session.value.dimScores      = { ...s.dimScores }
    session.value.positionDeltas = s.positionDeltas ? { ...s.positionDeltas } : null
    session.value._contradictions = s._contradictions ? [...s._contradictions] : null
    session.value._sharedContext  = s._sharedContext  ? { ...s._sharedContext, contradictions: s._sharedContext.contradictions ? [...s._sharedContext.contradictions] : [] } : null
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
    // Issue #160: collect agent diagnostics
    const arg = event.argument || event.arg || {}
    const aid = event.agentId || arg.agentId
    if (aid) {
      const prev = agentStats.value[aid] || { toolsUsed: [], iterCount: 0, argCount: 0 }
      agentStats.value = {
        ...agentStats.value,
        [aid]: {
          agentLoop:     arg.agentLoop || event.agentLoop || false,
          iterCount:     arg.iterCount || prev.iterCount,
          toolsUsed:     [...new Set([...(prev.toolsUsed || []), ...(arg.toolsUsed || [])])],
          model:         arg.model || prev.model || null,
          forcedPublish: arg.iterCount >= 5 || prev.forcedPublish || false,
          argCount:      (prev.argCount || 0) + 1,
        }
      }
    }
    // Фиксируем аргумент в ленте сессии
    if (session.value?.id) {
      const stance = arg.stance || arg.verdict || null
      const prevArg = session.value?.arguments?.at(-2) // предыдущий аргумент для детекции challenge
      const isChallenging = prevArg && stance && prevArg.agentId !== aid &&
        (stance === 'REJECT' || stance === 'CONDITIONAL') && prevArg.stance === 'APPROVE'
      eventStore.add('session', session.value.id,
        isChallenging ? 'ARGUMENT_CHALLENGED' : 'ARGUMENT_RAISED',
        { agentId: aid, stance, dimension: arg.dimension, content: arg.content?.slice?.(0, 200) }
      )
    }
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
    // Фиксируем условия в ленте сессии
    if (session.value?.id) {
      for (const cond of (event.conditions || [])) {
        eventStore.add('session', session.value.id, 'CONDITION_PROPOSED', {
          text: typeof cond === 'string' ? cond : cond.text,
          type: cond.type,
          metric: cond.metric,
          threshold: cond.threshold,
        })
      }
    }
  }

  if (event.type === 'ContradictionsFound') {
    session.value._contradictions = event.contradictions ? [...event.contradictions] : []
    // Фиксируем противоречия в ленте сессии
    if (session.value?.id) {
      for (const c of (event.contradictions || [])) {
        eventStore.add('session', session.value.id, 'CONTRADICTION_FOUND', {
          dimension: c.dimension,
          severity:  c.severity,
          thesis:    c.thesis?.slice?.(0, 200),
          antithesis: c.antithesis?.slice?.(0, 200),
        })
      }
    }
  }

  if (event.type === 'SessionConcluded') {
    if (event.beliefDrift) session.value.beliefDrift = event.beliefDrift
    // Issue #160: persist agentStats in session for protocol
    session.value.agentStats = { ...agentStats.value }
    agentActivity.value = {}

    // Фиксируем синтез аргументов (итог дебатов)
    if (session.value?.id && session.value?.arguments?.length) {
      const approveCount = session.value.arguments.filter(a => a.stance === 'APPROVE').length
      const rejectCount  = session.value.arguments.filter(a => a.stance === 'REJECT').length
      eventStore.add('session', session.value.id, 'ARGUMENT_SYNTHESIZED', {
        totalArgs:     session.value.arguments.length,
        approveArgs:   approveCount,
        rejectArgs:    rejectCount,
        contradictions: session.value._contradictions?.length || 0,
      })
    }

    setTimeout(() => {
      conclusionVisible.value = true
    }, 1500)
    // Сохранить решение ИК в fst
    saveDecisionToFst(session.value)
  }
}


function agentColor(id) {
  const a = AGENTS.value.find(a => a.id === id)
  return a?.color || 'var(--p-text-muted-color)'
}
function agentAvatar(id) {
  const a = AGENTS.value.find(a => a.id === id)
  return a?.avatar || '🤖'
}
function agentShortName(id) {
  const a = AGENTS.value.find(a => a.id === id)
  return a?.shortName || id
}
function stanceColor(stance) {
  if (stance === 'APPROVE') return 'var(--fst-green)'
  if (stance === 'REJECT') return 'var(--fst-red)'
  return 'var(--fst-brand)'
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

    logger.debug('✅ Протокол ИК сохранён в fst:', {
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
    logger.debug('[saveContractNodes] creating contract:', contractName, 'nodes:', sess.contractNodes?.length)
    const cData = await post('_m_new/3995', {
      t3995: contractName,
      up: 1,
    })
    logger.debug('[saveContractNodes] cData:', JSON.stringify(cData))
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
      // Issue #152: save MOIC if available
      if (nodeId && node.moic) {
        await post('_m_set/' + nodeId, { t4030: node.moic })
      }
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

    // Issue #158: save recommendations to Integram
    const recs = sess.recommendations || []
    for (const rec of recs) {
      await post("_m_new/3999", {
        t3999: rec.text || "",
        t4044: rec.priority || "MEDIUM",
        t4046: "RECOMMENDED",
        t4048: rec.agentId || rec.agent || "",
        up: contractId,
      })
    }
    logger.debug('✅ Ноды контракта сохранены в БД. Contract ID:', contractId)
    // Issue #152: save contractId + show toast
    sess.savedContractId = contractId
    session.value = { ...sess }
    toast.add({
      severity: 'success',
      summary: 'Смарт контракт создан',
      detail: 'Contract ID: ' + contractId,
      life: 8000
    })
    // Issue #156: redirect to contract viewer
    router.push("/fst-contract/" + contractId)
  } catch (err) {
    console.error('❌ saveContractNodes failed:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения контракта',
      detail: err.message,
      life: 5000
    })
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
  background: var(--p-surface-card);
  color: var(--p-text-color);
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
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: transparent;
  flex-shrink: 0;
}
.fst-header-project {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}
.fst-header-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-header-subfund {
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
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
  box-shadow: 0 0 0 3px color-mix(in srgb, white 12%, transparent);
}
.fst-step-label {
  font-size: 0.625rem;
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
  font-size: 1.25rem;
  font-weight: 900;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.fst-score-denom {
  font-size: 0.8125rem;
  opacity: 0.55;
  font-weight: 400;
}
.fst-running-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8125rem;
  color: var(--p-primary-color);
  padding: 3px 10px;
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 25%, transparent);
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
  border-right: 1px solid var(--surface-border);
  overflow: hidden;
}
.fst-tabs-bar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
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
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}
.fst-tab:hover { background: var(--surface-hover); color: var(--p-text-color); }
.fst-tab--on { background: var(--p-primary-color, var(--fst-blue)); color: white; }
.fst-tab-count {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  background: color-mix(in srgb, white 25%, transparent);
}
.fst-tab-count--red { background: var(--p-red-500); color: white; }
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
  background: var(--p-surface-card);
}
.fst-rs {
  padding: 12px 14px;
  border-bottom: 1px solid var(--surface-border);
}
.fst-rs-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
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
  background: var(--surface-card);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-kpi-v {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--p-text-color);
}
.fst-kpi-u {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  line-height: 1;
}
.fst-kpi-l {
  font-size: 0.6875rem;
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
  font-size: 0.75rem;
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
  background: var(--surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-dim-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.fst-dim-num {
  font-size: 0.75rem;
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
  font-size: 0.75rem;
}
.fst-vc-n { color: var(--p-text-muted-color); }
.fst-vc-s { font-weight: 700; }

/* Decision */
.fst-rs--decision { background: var(--surface-card); }

/* ── Issue #192: Briefing panel ── */
.fst-rs--briefing {
  border-left: 3px solid var(--fst-brand);
  background: color-mix(in srgb, var(--fst-brand) 6%, var(--p-surface-card));
}
.fst-briefing-metrics {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
}
.fst-briefing-m {
  flex: 1 1 60px; min-width: 60px;
  background: var(--p-surface-card);
  border-radius: 6px; padding: 4px 6px; text-align: center;
  border: 1px solid var(--p-content-border-color);
}
.fst-briefing-mv { font-size: 0.9rem; font-weight: 700; color: var(--p-text-color); }
.fst-briefing-mk { font-size: 0.6rem; color: var(--p-text-muted-color); margin-top: 1px; }
.fst-briefing-score-row {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.fst-briefing-score-lbl { font-size: 0.7rem; color: var(--p-text-muted-color); white-space: nowrap; }
.fst-briefing-score-bar {
  flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden;
}
.fst-briefing-score-bar div { height: 100%; border-radius: 3px; transition: width 0.3s; }
.fst-briefing-score-val { font-size: 0.7rem; font-weight: 700; white-space: nowrap; color: var(--p-text-color); }
.fst-briefing-psycho {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.fst-briefing-psycho-mbti {
  background: color-mix(in srgb, var(--fst-purple) 13%, transparent); color: var(--fst-purple);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 33%, transparent);
  border-radius: 4px; padding: 1px 7px;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 1px;
}
.fst-briefing-psycho-conf { font-size: 0.65rem; color: var(--p-text-muted-color); }
.fst-briefing-flags { display: flex; flex-direction: column; gap: 3px; margin-bottom: 5px; }
.fst-briefing-flag {
  font-size: 0.65rem; padding: 2px 6px; border-radius: 3px;
  display: flex; align-items: center; gap: 4px;
}
.fst-briefing-flag--red { background: color-mix(in srgb, var(--fst-red) 12%, transparent); color: var(--fst-red); }
.fst-briefing-flag--green { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.fst-briefing-beacons { display: flex; flex-direction: column; gap: 5px; margin-bottom: 6px; }
.fst-briefing-beacon {
  padding: 4px 8px;
  background: var(--p-surface-card);
  border-radius: 4px;
}
.fst-briefing-beacon-text { font-size: 0.68rem; color: var(--p-text-color); }
.fst-briefing-beacon-rec { font-size: 0.62rem; color: var(--p-text-muted-color); margin-top: 2px; }
.fst-briefing-summary {
  font-size: 0.67rem; color: var(--p-text-muted-color);
  font-style: italic; line-height: 1.4;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 6px; margin-top: 6px;
}
.fst-decision-score {
  font-size: 2.75rem;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.fst-decision-denom {
  font-size: 1rem;
  opacity: 0.45;
  font-weight: 400;
}
.fst-decision-rec {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
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
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

/* Contradictions */
.fst-contradictions-list { display: flex; flex-direction: column; gap: 8px; }
.fst-contradiction-item {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.875rem;
}
.fst-contradiction-dim {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  font-size: 0.8125rem;
  font-weight: 600;
  margin-right: 6px;
}
.fst-contradiction-severity {
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.fst-contradiction-severity.sev-high { background: color-mix(in srgb, var(--fst-red) 15%, var(--surface-card)); color: color-mix(in srgb, var(--fst-red) 70%, var(--p-text-color)); }
.fst-contradiction-severity.sev-medium { background: color-mix(in srgb, var(--fst-brand) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color)); }
.fst-contradiction-severity.sev-low { background: color-mix(in srgb, var(--fst-green) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color)); }
.fst-contradiction-thesis { margin-top: 4px; color: var(--p-text-color); }
.fst-contradiction-antithesis { color: var(--p-text-muted-color); font-style: italic; }

/* Deal conditions */
.fst-deal-conditions { display: flex; flex-direction: column; gap: 4px; }
.fst-deal-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}
.fst-cond-type {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.fst-cond-type.type-MILESTONE { background: color-mix(in srgb, var(--fst-blue) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-blue) 70%, var(--p-text-color)); }
.fst-cond-type.type-GOVERNANCE { background: color-mix(in srgb, var(--fst-purple) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-purple) 70%, var(--p-text-color)); }
.fst-cond-type.type-RISK { background: color-mix(in srgb, var(--fst-red) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-red) 70%, var(--p-text-color)); }
.fst-cond-text { flex: 1; color: var(--p-text-color); }
.fst-cond-metric { color: var(--p-text-muted-color); font-size: 0.8125rem; }

/* Belief Drift */
.fst-belief-drift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.fst-drift-card {
  background: var(--surface-card);
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
  font-size: 0.875rem;
}
.fst-drift-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-drift-changed {
  font-size: 0.75rem;
  padding: 1px 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--fst-brand) 10%, var(--surface-card));
  color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color));
  font-weight: 600;
  margin-left: auto;
}
.fst-drift-bars { display: flex; flex-direction: column; gap: 3px; }
.fst-drift-bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}
.fst-drift-label {
  width: 42px;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}
.fst-drift-bar {
  height: 6px;
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.5s ease;
}
.fst-drift-val {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.fst-drift-delta {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 700;
  margin-top: 4px;
  color: var(--p-text-muted-color);
}
.fst-drift-delta.positive { color: var(--fst-green); }
.fst-drift-delta.negative { color: var(--fst-red); }

.fst-human-result {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  margin-top: 6px;
  color: var(--p-text-color);
}

/* Approval */
.fst-rs--approval {
  background: color-mix(in srgb, var(--fst-brand) 6%, transparent);
  border-color: color-mix(in srgb, var(--fst-brand) 25%, transparent);
}
.fst-approval-hint {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 0 0 10px;
}
.fst-approval-btns {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fst-approval-extra-btns {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.fst-approval-weights-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
  user-select: none;
}
.fst-weights-score {
  margin-left: auto;
  font-weight: 700;
  font-size: 0.9rem;
}
.fst-approval-weights {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px;
  background: var(--p-surface-card);
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
}
.fst-weight-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-weight-label {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  width: 80px;
  flex-shrink: 0;
}
.fst-weight-slider { flex: 1 }
.fst-weight-val {
  font-size: 0.78rem;
  font-weight: 600;
  width: 28px;
  text-align: right;
}
.fst-veto-panel,
.fst-revision-panel {
  background: color-mix(in srgb, var(--fst-red) 6%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--fst-red) 30%, transparent);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.fst-revision-panel {
  background: color-mix(in srgb, var(--fst-brand) 6%, var(--p-surface-card));
  border-color: color-mix(in srgb, var(--fst-brand) 30%, transparent);
}
.fst-veto-title {
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 8px;
}
.fst-revision-textarea {
  width: 100%;
  padding: 6px 8px;
  font-size: 0.82rem;
  background: var(--p-surface-card);
  color: var(--p-text-color);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  resize: vertical;
}

/* ── Contradiction Map ────────────────────── */
.fst-rs--contradictions {
  background: color-mix(in srgb, var(--fst-red) 5%, transparent);
  border-color: color-mix(in srgb, var(--fst-red) 25%, transparent);
}
.fst-badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--fst-red);
  color: white;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  margin-left: 6px;
}
.fst-contradiction-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.fst-cmap-item {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.8rem;
}
.fst-cmap-agents {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.fst-cmap-agent {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-cmap-avatar { font-size: 1rem; }
.fst-cmap-name { font-size: 0.78rem; color: var(--p-text-muted-color); }
.fst-cmap-vs {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--fst-red);
  padding: 1px 5px;
}
.fst-cmap-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}
.fst-cmap-thesis {
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--fst-green) 80%, var(--p-text-color));
  margin-bottom: 2px;
}
.fst-cmap-antithesis {
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--fst-red) 80%, var(--p-text-color));
  margin-bottom: 2px;
}
.fst-cmap-synthesis {
  font-size: 0.78rem;
  color: var(--fst-green);
  margin-top: 4px;
  padding: 4px 6px;
  background: color-mix(in srgb, var(--fst-green) 8%, var(--p-surface-card));
  border-radius: 4px;
}

/* ── Agents Bar ───────────────────────────── */
.fst-agents-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-card);
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
  border: 1px solid var(--surface-border);
  background: var(--p-surface-card);
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
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
}
.fst-ac-status { display: flex; align-items: center; gap: 4px; }
.fst-ac-tool {
  font-size: 0.625rem;
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
  background: color-mix(in srgb, var(--p-surface-card) 80%, transparent);
  border-bottom: 1px solid var(--surface-border);
  border-radius: 6px 6px 0 0;
  animation: fadeIn .2s ease;
}
.fst-activity-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  padding: 2px 7px;
}
.fst-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fst-activity-agent { font-weight: 600; color: var(--p-text-color); }
.fst-activity-arrow { opacity: .5; }
.fst-activity-tool { color: var(--fst-brand); font-family: monospace; flex-shrink: 0; }
.fst-activity-reason {
  color: var(--p-text-color);
  opacity: .8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
.fst-activity-item--result { background: color-mix(in srgb, var(--fst-green) 8%, var(--surface-card)); }
.fst-activity-item--result .fst-activity-tool { color: var(--fst-green); }
.fst-activity-result-arrow { color: var(--fst-green); font-weight: bold; flex-shrink: 0; }
.fst-ac-delta {
  font-size: 0.6875rem;
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
  color: white;
  font-size: 0.75rem;
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
  border: 1px solid var(--surface-border);
  background: var(--surface-border);
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

/* ── Committee Topbar (Hub-style) ────────────────────────── */
/* base layout: .fst-topbar (fst.css) */
.ck-topbar {}
.ck-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ck-live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--p-primary-color);
  box-shadow: 0 0 6px var(--p-primary-color);
  animation: ck-pulse 2s infinite;
  flex-shrink: 0;
}
@keyframes ck-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.ck-title  { font-weight: 600; font-size: 14px; color: var(--p-text-color); }
.ck-sep    { color: var(--p-text-muted-color); }
.ck-sub    { font-size: 13px; color: var(--p-text-muted-color); }
.ck-topbar-actions { display: flex; gap: 8px; }
.ck-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  font-size: 13px;
  cursor: pointer;
  transition: background .15s;
}
.ck-btn:hover { background: var(--p-surface-hover); }
.ck-btn--accent {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--p-primary-color) 40%, transparent);
  color: var(--p-primary-color);
}
.ck-btn--accent:hover { background: color-mix(in srgb, var(--p-primary-color) 25%, transparent); }
.ck-btn-label { white-space: nowrap; }

/* ── Committee KPI Metrics ───────────────────────────────── */
/* base: .fst-metrics-strip + .fst-metric-item (fst.css) */
.ck-metrics {
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
}
.ck-metric {
  transition: border-color .2s, background .2s;
  cursor: default;
}
.ck-metric:hover {
  border-bottom-color: var(--ck-c, var(--p-primary-color));
  background: color-mix(in srgb, var(--ck-c, var(--p-primary-color)) 6%, var(--p-surface-card));
}
.ck-metric-icon {
  font-size: 16px;
  margin-bottom: 8px;
  opacity: 0.7;
  color: var(--ck-c, var(--p-text-muted-color));
}
.ck-metric-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1;
}
.ck-metric-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  max-width: 100%;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: transparent;
  flex-shrink: 0;
}
.fst-setup-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fst-setup-brand {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--p-text-color);
  letter-spacing: -0.01em;
}
.fst-setup-desc {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  margin: 0;
}
.fst-setup-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.fst-setup-subfunds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fst-setup-body {
  display: grid;
  grid-template-columns: 1fr 340px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.fst-setup-col {
  padding: 20px 24px;
  overflow-y: auto;
}
.fst-setup-col--projects {
  border-right: 1px solid var(--surface-border);
}
.fst-setup-col--settings {
  height: 100%;
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
}
/* .fst-setup-section-title → replaced by global .fst-section-title in fst.css */
.fst-setup-empty {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  padding: 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-setup-launch {
  margin-top: auto;
  padding: 16px 0 4px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-launch-btn { width: 100%; justify-content: center; }
.fst-launch-hint { text-align: center; font-size: 0.875rem; color: var(--p-text-muted-color); }
.fst-factor-gate {
  margin-top: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--fst-red) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 35%, transparent);
  border-radius: 8px;
}
.fst-factor-gate-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-factor-gate-body {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin-bottom: 6px;
}
.fst-factor-gate-flags { margin-top: 4px; }
.fst-policy-summary {
  font-size: 0.8125rem;
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
  font-size: 0.875rem;
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
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--p-text-color);
}
.fst-intro-text {
  font-size: 0.875rem;
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
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: default;
  user-select: none;
}
.fst-subfund-svg { display: inline-flex; align-items: center; line-height: 1; }
.fst-subfund-svg svg { width: 1em; height: 1em; vertical-align: middle; }
.fst-subfund-budget {
  font-size: 0.8125rem;
  opacity: 0.7;
  margin-left: 4px;
}
.fst-lobby-label {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--p-text-muted-color);
}
/* ── Project Grid Cards ───────────────────────────────────── */
.fst-selected-badge {
  margin-left: 10px;
  font-size: 0.8125rem;
  color: var(--fst-green);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: none;
  letter-spacing: 0;
}
/* ── Project header ── */
.fst-project-table-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--p-content-border-color);
  min-height: 48px;
}
.fst-proj-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.fst-proj-header-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
}
.fst-proj-search-field {
  flex: 1;
}
.fst-proj-search-field :deep(input) {
  width: 100%;
  font-size: 0.8125rem;
}
.fst-proj-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* ── Project DataTable ── */
.fst-project-table { flex: 1; }
.fst-project-table .p-datatable-thead th {
  font-size: 0.6875rem !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color) !important;
  background: transparent !important;
  padding: 6px 8px !important;
}
.fst-project-table .p-datatable-tbody td { padding: 6px 8px !important; cursor: pointer; }
.fst-project-table .p-datatable-tbody tr:hover td { background: color-mix(in srgb, var(--p-primary-color) 6%, transparent) !important; }
.fst-project-table .p-row-selected td,
.fst-project-table tr.fst-row-selected td { background: color-mix(in srgb, var(--p-primary-color) 12%, transparent) !important; }
.fst-tbl-subfund {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  color: white;
  white-space: nowrap;
}
.fst-tbl-stage {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.fst-tbl-title { font-size: 0.8125rem; font-weight: 600; color: var(--p-text-color); line-height: 1.3; }
.fst-tbl-company { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 1px; }
.fst-tbl-amount { font-size: 0.8125rem; font-weight: 600; color: var(--p-text-color); white-space: nowrap; }
.fst-tbl-metric { font-size: 0.8125rem; font-weight: 700; }
.fst-tbl-metric.metric--good { color: var(--p-green-400); }
.fst-tbl-metric.metric--warn { color: var(--p-orange-400); }
.fst-tbl-metric.metric--bad  { color: var(--p-red-400); }
.fst-tbl-detail-btn { opacity: 0; transition: opacity 0.15s; }
.fst-project-table .p-datatable-tbody tr:hover .fst-tbl-detail-btn { opacity: 1; }

/* ── Grid tile view ─────────────────────────────────────────── */
.fst-project-grid-view {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
  align-content: start;
}
.fst-pcard2 {
  position: relative;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--card-accent, var(--p-primary-color));
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  overflow: hidden;
}
.fst-pcard2:hover {
  box-shadow: 0 3px 14px var(--fst-glass-lg);
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--card-accent, var(--p-primary-color)) 60%, var(--p-content-border-color));
  border-left-color: var(--card-accent, var(--p-primary-color));
}
.fst-pcard2--selected {
  border-color: var(--card-accent, var(--p-primary-color)) !important;
  border-left-color: var(--card-accent, var(--p-primary-color)) !important;
  background: color-mix(in srgb, var(--card-accent, var(--p-primary-color)) 7%, var(--p-content-background)) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-accent, var(--p-primary-color)) 30%, transparent) !important;
}
.fst-pcard2-body {
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fst-pcard2-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.fst-pcard2-stage {
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: 0.03em;
}
.fst-pcard2-eye {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.fst-pcard2:hover .fst-pcard2-eye { opacity: 0.7; }
.fst-pcard2--selected .fst-pcard2-eye { opacity: 0.7; }
.fst-pcard2-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fst-pcard2-company {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-pcard2-metrics {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
}
.fst-pcard2-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.fst-pcard2-chip.metric--good strong { color: var(--p-green-400); }
.fst-pcard2-chip.metric--warn strong { color: var(--p-orange-400); }
.fst-pcard2-chip.metric--bad  strong { color: var(--p-red-400); }
.fst-pcard2-chip strong { font-weight: 700; }
.fst-pcard2-amount {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--p-text-color);
  white-space: nowrap;
}

/* fade transition for selected badge */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

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
  font-size: 0.875rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  color: white;
}
.fst-pmodal-stage {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  background: var(--surface-hover);
  padding: 4px 10px;
  border-radius: 6px;
}
.fst-pmodal-company {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9375rem;
  color: var(--p-text-color);
}
.fst-pmodal-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: var(--p-surface-section, var(--surface-hover));
  border-radius: 10px;
  padding: 14px;
}
.fst-pmodal-metric { text-align: center; }
.fst-pmodal-metric-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--p-text-color);
  line-height: 1.2;
}
.fst-pmodal-metric-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.fst-pmodal-desc {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  padding: 12px;
  background: var(--surface-hover);
  border-radius: 8px;
}
.fst-pmodal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fst-pmodal-tag {
  font-size: 0.8125rem;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--surface-hover);
  border: 1px solid var(--surface-border);
  color: var(--p-text-muted-color);
}
.fst-pmodal-check {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-pmodal-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}
.fst-pmodal-check-item.pass { color: var(--fst-green); }
.fst-pmodal-check-item.fail { color: var(--fst-red); }
.fst-pmodal-factor {
  padding: 10px 12px;
  background: color-mix(in srgb, var(--fst-purple) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 25%, transparent);
  border-radius: 8px;
  margin-bottom: 8px;
}
.fst-pmodal-factor-title {
  font-size: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.fst-pmodal-factor-grade { font-size: 18px; font-weight: 800; }
.fst-pmodal-factor-composite { font-size: 11px; color: var(--p-text-muted-color); margin-left: auto; }
.fst-pmodal-factor-bars { display: flex; flex-direction: column; gap: 5px; }
.fst-pmodal-factor-row { display: grid; grid-template-columns: 16px 1fr 28px; align-items: center; gap: 6px; }
.fst-pmodal-fkey { font-size: 10px; font-weight: 700; color: var(--p-text-muted-color); }
.fst-pmodal-fbar { height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.fst-pmodal-fbar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
.fst-pmodal-fscore { font-size: 10px; font-weight: 700; text-align: right; }
.fst-metric {
  font-size: 0.8125rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 500;
}
.metric--good { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.metric--warn { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.metric--bad  { background: color-mix(in srgb, var(--fst-red) 15%, transparent);   color: var(--fst-red); }

.fst-overlap-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--fst-brand) 8%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--fst-brand) 25%, transparent);
  font-size: 0.78rem;
}
.fst-overlap-pill {
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  color: var(--fst-red);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.73rem;
}
.fst-overlap-link {
  background: none;
  border: none;
  color: var(--p-primary-color);
  cursor: pointer;
  font-size: 0.78rem;
  padding: 0 4px;
  text-decoration: underline;
}
/* ── Speed cards ── */
/* ── Right panel sections ── */
.fst-rp-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-rp-section:last-of-type { border-bottom: none; }
.fst-rp-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}

/* ── Speed segmented ── */
.fst-speed-seg {
  display: flex;
  gap: 6px;
}
.fst-speed-seg-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 7px 4px;
  border: 1.5px solid var(--p-content-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
}
.fst-speed-seg-btn:hover {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
}
.fst-speed-seg-btn.active {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
}
.fst-speed-seg-btn strong {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1;
}
.fst-speed-seg-btn.active strong { color: var(--p-primary-color); }
.fst-speed-seg-btn span {
  font-size: 0.6rem;
  color: var(--p-text-muted-color);
}
/* legacy */
.fst-speed-btn {
  padding: 6px 14px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;
}
.fst-speed-btn:hover {
  background: var(--surface-hover);
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}
.fst-speed-btn.active {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  color: var(--p-primary-color);
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
  border-bottom: 1px solid var(--surface-border);
  background: var(--p-surface-card);
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
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-project-name {
  font-size: 0.875rem;
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
  background: var(--p-content-border-color);
}
.fst-phase-step--done::after {
  background: var(--p-primary-color);
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
  background: var(--p-surface-card);
}
.fst-phase-step--done .fst-phase-dot,
.fst-phase-step--active .fst-phase-dot {
  background: var(--phase-color);
}
.fst-phase-label {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  text-align: center;
  line-height: 1.2;
  max-width: 60px;
}
.fst-phase-step--active .fst-phase-label {
  color: white;
  font-weight: 600;
}
.fst-phase-tag {
  font-size: 0.8125rem;
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
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-panel-subtitle {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px;
}
.fst-arg-count {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-weight: 400;
  margin-left: auto;
}

/* ── Agents Panel ─────────────────────────────────────────── */
.fst-agents-panel {
  border-right: 1px solid var(--p-content-border-color);
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
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: all 0.2s;
  background: var(--surface-card);
  position: relative;
}
.fst-agent-card--thinking {
  border-color: var(--agent-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--fst-blue) 15%, transparent);
}
.fst-agent-card--voted {
  opacity: 0.85;
}
.fst-agent-avatar {
  position: relative;
  font-size: 1.25rem;
  flex-shrink: 0;
  line-height: 1;
}
.fst-agent-thinking-pulse {
  position: absolute;
  top: -2px; right: -2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--agent-color, var(--fst-blue));
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
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--agent-color);
}
.fst-agent-role-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
  margin-top: 2px;
}
.fst-agent-think-text {
  font-size: 0.75rem;
  color: var(--p-primary-color);
  font-style: italic;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-agent-vote-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
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
.fst-pnode.error { border-color: var(--fst-red) !important; background: color-mix(in srgb, var(--fst-red) 7%, transparent) !important; opacity: 1; }
.fst-parrow {
  font-size: 0.6rem; color: var(--p-text-muted-color); opacity: 0.6;
  white-space: nowrap; user-select: none; letter-spacing: -1px;
}
@keyframes fst-pulse { 0%,100% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 4px 1px currentColor; } }
.fst-agent-ready {
  font-size: 0.75rem;
  color: var(--fst-green);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.fst-agent-weight {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  align-self: center;
  flex-shrink: 0;
}

/* ── Project Mini ─────────────────────────────────────────── */
.fst-project-mini {
  margin: auto 8px 8px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--surface-card);
}
.fst-project-mini-title {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
  color: var(--p-text-color);
}
.fst-project-mini-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  padding: 2px 0;
}
.fst-project-mini-row strong { color: var(--p-primary-color); }

/* ── Debate Panel ─────────────────────────────────────────── */
.fst-debate-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--p-content-border-color);
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
  background: var(--surface-card);
  border-radius: 10px;
  margin-bottom: 12px;
}
.fst-loading-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--p-primary-color);
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
.fst-la-avatar { font-size: 1rem; }
.fst-la-bar-wrap { flex: 1; }
.fst-la-name { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 3px; }
.fst-la-bar {
  height: 4px;
  background: var(--surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-la-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.fst-la-status { font-size: 0.875rem; }

/* Arguments */
.fst-args-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fst-argument {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--surface-card);
  transition: all 0.3s;
}
.fst-argument--counter {
  margin-left: 20px;
  border-left: 2px solid var(--fst-purple);
  background: var(--p-surface-section);
}
.fst-arg-type--challenge {
  border-color: color-mix(in srgb, var(--fst-red) 30%, transparent);
}
.fst-arg-type--counter {
  border-color: color-mix(in srgb, var(--fst-purple) 30%, transparent);
}
.fst-arg-type--summary {
  border-color: color-mix(in srgb, var(--fst-green) 20%, transparent);
  background: var(--p-surface-card);
}
.fst-arg-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-arg-avatar { font-size: 0.9375rem; }
.fst-arg-agent-name { font-size: 0.8125rem; font-weight: 600; }
.fst-arg-type-badge {
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--surface-border);
  color: var(--p-text-muted-color);
}
.fst-arg-ai-badge {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
  border-radius: 4px;
  padding: 1px 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.fst-arg-tpl-badge {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  opacity: 0.5;
  flex-shrink: 0;
}
.fst-arg-dim {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-left: auto;
}
.fst-arg-reply {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.75rem;
  background: var(--p-surface-card);
  border-left: 2px solid var(--surface-border);
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
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--p-text-color);
}

/* Vote stream */
.fst-vote-stream {
  margin-top: 16px;
  padding: 12px;
  background: var(--surface-card);
  border-radius: 10px;
  border: 1px solid var(--surface-border);
}
.fst-vote-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--p-primary-color);
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
.fst-vote-avatar { font-size: 0.9375rem; }
.fst-vote-name { font-size: 0.8125rem; font-weight: 600; min-width: 55px; }
.fst-vote-pill-sm {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
}
.fst-vote-score { font-size: 0.8125rem; color: var(--p-text-muted-color); min-width: 40px; }
.fst-vote-conf-bar {
  flex: 1;
  height: 4px;
  background: var(--surface-border);
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
  font-size: 0.875rem;
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
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  min-width: 70px;
}
.fst-dim-bar-bg {
  flex: 1;
  height: 5px;
  background: var(--surface-border);
  border-radius: 3px;
  overflow: hidden;
}
.fst-dim-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.fst-dim-value {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 24px;
  text-align: right;
}

/* Aggregate score */
.fst-agg-score {
  text-align: center;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  margin-bottom: 12px;
  background: var(--surface-card);
}
.fst-agg-score-label {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fst-agg-score-value {
  font-size: 2.625rem;
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
  color: white;
  font-size: 0.875rem;
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
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  min-width: 65px;
}
.fst-vd-bar-bg {
  flex: 1;
  height: 8px;
  background: var(--surface-border);
  border-radius: 4px;
  overflow: hidden;
}
.fst-vd-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.fst-vd-count {
  font-size: 0.8125rem;
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
  font-size: 0.8125rem;
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
  border: 1px solid color-mix(in srgb, var(--fst-brand) 30%, transparent);
  border-radius: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--fst-brand) 5%, transparent);
  margin-top: auto;
}
.fst-human-prompt {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 6px 0 10px;
}
.fst-human-comment-row {
  margin-bottom: 10px;
}
.fst-human-comment {
  width: 100%;
  font-size: 0.875rem;
}
.fst-human-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fst-human-buttons .p-button {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
}

/* Vote pills in conclusion */
.fst-votes-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.fst-vote-pill {
  font-size: 0.875rem;
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
}

/* Conclusion */
.fst-conclusion { text-align: center; }
.fst-conclusion-score {
  font-size: 3.5rem;
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
  color: white;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 16px;
}
.fst-conclusion-section {
  text-align: left;
  margin-bottom: 12px;
}
.fst-conclusion-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.fst-conditions-list {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  padding-left: 16px;
}
.fst-conditions-list li { margin-bottom: 4px; }
.fst-scenario-section { margin-top: 16px; }

/* Contradictions */
.fst-contradictions-list { display: flex; flex-direction: column; gap: 8px; }
.fst-contradiction-item {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.875rem;
}
.fst-contradiction-dim {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  font-size: 0.8125rem;
  font-weight: 600;
  margin-right: 6px;
}
.fst-contradiction-severity {
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.fst-contradiction-severity.sev-high { background: color-mix(in srgb, var(--fst-red) 15%, var(--surface-card)); color: color-mix(in srgb, var(--fst-red) 70%, var(--p-text-color)); }
.fst-contradiction-severity.sev-medium { background: color-mix(in srgb, var(--fst-brand) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color)); }
.fst-contradiction-severity.sev-low { background: color-mix(in srgb, var(--fst-green) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-green) 70%, var(--p-text-color)); }
.fst-contradiction-thesis { margin-top: 4px; color: var(--p-text-color); }
.fst-contradiction-antithesis { color: var(--p-text-muted-color); font-style: italic; }

/* Deal conditions */
.fst-deal-conditions { display: flex; flex-direction: column; gap: 4px; }
.fst-deal-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}
.fst-cond-type {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.fst-cond-type.type-MILESTONE { background: color-mix(in srgb, var(--fst-blue) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-blue) 70%, var(--p-text-color)); }
.fst-cond-type.type-GOVERNANCE { background: color-mix(in srgb, var(--fst-purple) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-purple) 70%, var(--p-text-color)); }
.fst-cond-type.type-RISK { background: color-mix(in srgb, var(--fst-red) 10%, var(--surface-card)); color: color-mix(in srgb, var(--fst-red) 70%, var(--p-text-color)); }
.fst-cond-text { flex: 1; color: var(--p-text-color); }
.fst-cond-metric { color: var(--p-text-muted-color); font-size: 0.8125rem; }

/* Belief Drift */
.fst-belief-drift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.fst-drift-card {
  background: var(--surface-card);
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
  font-size: 0.875rem;
}
.fst-drift-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-drift-changed {
  font-size: 0.75rem;
  padding: 1px 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--fst-brand) 10%, var(--surface-card));
  color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color));
  font-weight: 600;
  margin-left: auto;
}
.fst-drift-bars { display: flex; flex-direction: column; gap: 3px; }
.fst-drift-bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}
.fst-drift-label {
  width: 42px;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}
.fst-drift-bar {
  height: 6px;
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.5s ease;
}
.fst-drift-val {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.fst-drift-delta {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 700;
  margin-top: 4px;
  color: var(--p-text-muted-color);
}
.fst-drift-delta.positive { color: var(--fst-green); }
.fst-drift-delta.negative { color: var(--fst-red); }

.fst-human-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--fst-green);
  margin-top: 12px;
  justify-content: center;
}

/* ── AI mode toggle rows ── */
.fst-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
}
.fst-toggle-icon { font-size: 0.9rem; flex-shrink: 0; width: 16px; text-align: center; }
.fst-toggle-name {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--p-text-color);
  min-width: 0;
}
.fst-toggle-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.fst-toggle-label strong { font-size: 0.8125rem; font-weight: 600; color: var(--p-text-color); }
.fst-toggle-label span  { font-size: 0.6875rem; color: var(--p-text-muted-color); line-height: 1.3; }
.fst-rp-hint {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

/* ── Accordion rows (Models / Policy / IC thresholds) ── */
.fst-acc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: 0 -12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-bottom: 1px solid var(--p-content-border-color);
  transition: all .15s;
}
.fst-acc-row:hover {
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-card));
  border-left-color: var(--p-primary-color);
}
.fst-acc-row:hover .fst-acc-label { color: var(--p-primary-color); }
.fst-acc-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: color-mix(in srgb, currentColor 15%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.fst-acc-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
  transition: color .15s;
}
.fst-acc-summary {
  flex: 1;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fst-acc-chevron {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.fst-profile-select { width: 100%; font-size: 0.8rem; }
.fst-profile-select .p-selectbutton-option { flex: 1; justify-content: center; font-size: 0.8rem; }
/* legacy kept for reference, unused */
.fst-ai-mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--surface-border);
  border-radius: 9px;
}
.fst-ai-toggle {
  width: 40px; height: 22px;
  border-radius: 11px;
  background: var(--surface-border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.fst-ai-toggle--on { background: var(--fst-purple-dark); }
.fst-ai-toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--p-text-color) 30%, transparent);
}
.fst-ai-toggle--on .fst-ai-toggle-knob { transform: translateX(18px); }
.fst-ai-mode-label { font-size: 0.8125rem; color: var(--p-text-color); }
.fst-ai-mode-label strong { font-weight: 600; }
.fst-ai-mode-label i.pi { margin-right: 5px; }

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
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  transition: all 0.15s;
}
.fst-dtab:hover {
  background: var(--surface-hover);
  color: var(--p-text-color);
}
.fst-dtab--active {
  background: var(--p-primary-color);
  color: white;
  border-color: transparent;
}
.fst-dtab--active .fst-arg-count {
  background: color-mix(in srgb, white 25%, transparent);
  color: white;
}

/* ── Graph Panel ───────────────────────────────────────────── */
.fst-graph-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── KAG saved badge ───────────────────────────────────────── */
.fst-contract-saved {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  background: color-mix(in srgb, var(--fst-green) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-green) 30%, transparent);
  border-radius: var(--p-content-border-radius, 6px);
  color: var(--fst-green-dark);
  font-size: 0.875rem;
  font-weight: 500;
}

:root.dark .fst-contract-saved {
  background: color-mix(in srgb, var(--fst-green) 12%, transparent);
  border-color: color-mix(in srgb, var(--fst-green) 25%, transparent);
  color: var(--fst-green);
}


/* Issue #158 — Recommendations panel */
.fst-rec-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.fst-rec-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  border-left: 3px solid var(--surface-border);
  background: var(--p-surface-card);
}
.fst-rec-item.priority-critical,
.fst-rec-item.priority-high {
  border-left-color: var(--fst-red);
  background: color-mix(in srgb, var(--fst-red) 5%, transparent);
}
.fst-rec-item.priority-medium {
  border-left-color: var(--p-orange-500);
}
.fst-rec-item.priority-low {
  border-left-color: var(--p-green-500);
}
.fst-rec-avatar {
  font-size: 1.3rem;
  flex-shrink: 0;
  margin-top: 2px;
}
.fst-rec-body {
  flex: 1;
  min-width: 0;
}
.fst-rec-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.fst-rec-agent {
  font-weight: 600;
  font-size: 0.85rem;
}
.fst-rec-owner {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.fst-rec-text {
  font-size: 0.9rem;
  line-height: 1.4;
}
.fst-rec-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.3rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.fst-rec-meta i {
  margin-right: 0.25rem;
}
.fst-kag-saved {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
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
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  color: var(--p-text-color);
  font-size: 0.8125rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.fst-profile-btn:hover {
  background: var(--surface-hover);
}
.fst-profile-btn--active {
  background: var(--p-primary-color);
  color: white;
  border-color: transparent;
}
.fst-voting-desc {
  text-align: center;
  font-size: 0.725rem;
  color: var(--p-text-muted-color);
  margin-top: 5px;
  padding: 0 4px;
}
.fst-model-profile-desc {
  font-size: 0.8125rem;
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
.fst-am-avatar { font-size: 0.9375rem; }
.fst-am-name {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-am-select {
  font-size: 0.75rem;
  padding: 3px 5px;
  border-radius: 5px;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  color: var(--p-text-color);
  cursor: pointer;
  width: 100%;
  min-width: 0;
}
.fst-model-reset-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--surface-border);
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-model-reset-btn:hover { background: var(--surface-hover); }
.fst-preset-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.fst-presets-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.fst-preset-chip {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.fst-preset-chip:hover {
  background: var(--surface-hover);
}
.fst-preset-chip.active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-color: var(--p-primary-color);
}
/* Issue #160: agent mode icon */
.fst-ac-mode {
  font-size: 0.75rem;
  line-height: 1;
  margin-right: 1px;
  opacity: 0.85;
}
/* Issue #160: debug panel */
.fst-debug-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 4px 8px;
  font-size: 0.8125rem;
}
.fst-debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.fst-debug-title i { color: var(--fst-red); font-size: 0.875rem; }
.fst-debug-summary {
  font-weight: 400;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  margin-left: auto;
}
.fst-debug-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.fst-debug-agent {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
}
.fst-debug-name { font-weight: 600; font-size: 0.75rem; }
.fst-debug-mode {
  font-size: 0.75rem;
  padding: 1px 4px;
  border-radius: 3px;
}
.fst-debug-mode.ok { background: color-mix(in srgb, var(--fst-green-dark) 25%, transparent); color: var(--fst-green); }
.fst-debug-mode.warn { background: color-mix(in srgb, var(--fst-brand-dark) 25%, transparent); color: var(--fst-brand); }
.fst-debug-val { color: var(--p-text-muted-color); font-size: 0.75rem; }
.fst-debug-model { color: var(--fst-purple); font-size: 0.6875rem; }
.fst-debug-forced { color: var(--fst-brand); font-size: 0.6875rem; font-weight: 600; }

/* Issue #163: New project button & form */
.fst-new-project-btn {
  background: var(--p-primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 0.8125rem;
  margin-left: 8px;
  vertical-align: middle;
  transition: background .15s;
}
.fst-new-project-btn:hover { filter: brightness(1.15); }

.fst-newproj-form { display: flex; flex-direction: column; gap: 10px; }
.fst-newproj-section {
  font-weight: 600; font-size: 0.875rem;
  color: var(--p-primary-color);
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 4px; margin-top: 6px;
}
.fst-newproj-row { display: flex; flex-direction: column; gap: 3px; }
.fst-newproj-row label,
.fst-newproj-row2 label,
.fst-newproj-row3 label {
  font-size: 0.875rem; color: var(--p-text-muted-color); font-weight: 500;
}
.fst-newproj-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fst-newproj-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.fst-newproj-row2 > div,
.fst-newproj-row3 > div { display: flex; flex-direction: column; gap: 3px; }
.fst-newproj-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--p-surface-card);
  color: var(--p-text-color);
  font-size: 0.875rem;
  outline: none;
  transition: border-color .15s;
}
.fst-newproj-input:focus { border-color: var(--p-primary-color); }
.fst-newproj-textarea { resize: vertical; min-height: 60px; font-family: inherit; }

.fst-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background .15s;
}
.fst-btn--primary {
  background: var(--p-primary-color); color: white;
}
.fst-btn--primary:disabled { opacity: .5; cursor: not-allowed; }
.fst-btn--primary:not(:disabled):hover { filter: brightness(1.1); }
.fst-btn--secondary {
  background: var(--p-surface-200); color: var(--p-text-color);
}
.fst-btn--secondary:hover { background: var(--p-surface-300); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .fst-committee { padding: 0; }

  /* 3-column main layout → single column on mobile */
  .fst-main {
    grid-template-columns: 1fr !important;
    overflow-y: auto;
  }
  .fst-main > *:nth-child(2) {
    border-left: none;
    border-right: none;
    border-top: 1px solid var(--surface-border);
    border-bottom: 1px solid var(--surface-border);
  }
  .fst-main > *:last-child {
    border-left: none;
    max-height: none;
  }

  /* Setup: stack project list + settings vertically */
  .fst-setup-body {
    grid-template-columns: 1fr !important;
  }
  .fst-setup-col {
    padding: 12px;
  }
  .fst-setup-col--projects {
    border-right: none;
    border-bottom: 1px solid var(--surface-border);
  }

  /* Header: wrap on mobile */
  .fst-header {
    flex-wrap: wrap;
    padding: 8px 12px;
    gap: 8px;
  }
  .fst-header-title {
    max-width: 180px;
    font-size: 0.875rem;
  }
  .fst-stepper {
    order: 3;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .fst-header-right {
    margin-left: auto;
  }

  /* Body: stack center + right vertically */
  .fst-body {
    flex-direction: column;
  }
  .fst-center {
    border-right: none;
    border-bottom: 1px solid var(--surface-border);
    min-height: 50vh;
  }
  .fst-right {
    width: 100% !important;
    max-height: 40vh;
    overflow-y: auto;
  }

  /* Tabs scroll */
  .fst-tabs-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
  }
  .fst-tabs-bar > * { flex-shrink: 0; font-size: 0.8rem; }

  /* Score/votes */
  .fst-conclusion-score { flex-wrap: wrap; gap: 8px; }
  .fst-votes-summary { flex-wrap: wrap; gap: 8px; }
  .fst-kpis { grid-template-columns: 1fr !important; }
  .fst-belief-drift-grid { grid-template-columns: 1fr !important; }

  /* Project cards in setup */
  .fst-project-card {
    padding: 10px;
  }
  .fst-project-metrics {
    flex-wrap: wrap;
    gap: 4px;
  }

  /* Subfund chips wrap */
  .fst-setup-subfunds {
    flex-wrap: wrap;
  }

  /* Settings compact on mobile */
  .fst-setup-col--settings {
    height: 50vh;
  }
  .fst-toggle-label { font-size: 0.75rem; }
  .fst-policy-toggle { font-size: 0.8rem; }
  .fst-model-panel { font-size: 0.8rem; }
  .fst-agent-model-grid { grid-template-columns: 1fr !important; }
  /* New project dialog — full width on mobile */
  .p-dialog { width: 95vw !important; max-width: 95vw !important; }
  .fst-newproj-grid { grid-template-columns: 1fr !important; }
}
</style>

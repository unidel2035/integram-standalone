<template>
  <div class="fst-panel">
    <!-- Tab switcher -->
    <div class="fst-panel-tabs">
      <button v-for="tab in tabs" :key="tab.id"
        :class="['fst-tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id">
        <i :class="tab.icon"></i> {{ tab.label }}
      </button>
    </div>

    <!-- ══ TAB: ONTOLOGY ══ -->
    <div v-if="activeTab === 'ontology'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-sitemap"></i> Онтология ФСТ НТИ Инвесткомитета
      </div>

      <!-- Classes -->
      <div class="fst-onto-grid">
        <div v-for="cls in ontologyClasses" :key="cls.name" class="fst-onto-card"
          :style="{ borderLeftColor: cls.color }">
          <div class="fst-onto-card-name">{{ cls.name }}</div>
          <div class="fst-onto-card-desc">{{ cls.description }}</div>
          <div class="fst-onto-card-props">
            <span v-for="p in cls.properties.slice(0,4)" :key="p" class="fst-onto-prop">{{ p }}</span>
            <span v-if="cls.properties.length > 4" class="fst-onto-prop fst-onto-prop--more">+{{ cls.properties.length - 4 }}</span>
          </div>
        </div>
      </div>

      <!-- Relations -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-share-alt"></i> Отношения (Object Properties)
      </div>
      <div class="fst-relations-list">
        <div v-for="rel in ontologyRelations" :key="rel.from + rel.predicate" class="fst-relation-row">
          <span class="fst-rel-from">{{ rel.from }}</span>
          <span class="fst-rel-pred">—{{ rel.predicate }}→</span>
          <span class="fst-rel-to">{{ rel.to }}</span>
        </div>
      </div>

      <!-- Scoring Dimensions -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-chart-bar"></i> Оценочные оси (Scoring Dimensions)
      </div>
      <div class="fst-dims-grid">
        <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-dim-card"
          :style="{ background: dim.color + '18', borderColor: dim.color + '60' }">
          <div class="fst-dim-label" :style="{ color: dim.color }">{{ dim.label }}</div>
          <div class="fst-dim-weight">вес {{ Math.round(dim.weight * 100) }}%</div>
          <div class="fst-dim-unit">{{ dim.unit }}</div>
          <div class="fst-dim-desc">{{ dim.description }}</div>
        </div>
      </div>
    </div>

    <!-- ══ TAB: AGENTS ══ -->
    <div v-if="activeTab === 'agents'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-users"></i> Агенты инвесткомитета
      </div>
      <div class="fst-agents-grid">
        <div v-for="agent in AGENTS" :key="agent.id" class="fst-agent-onto-card"
          :style="{ borderColor: agent.color }">
          <div class="fst-agent-onto-header">
            <span class="fst-agent-onto-emoji">{{ agent.avatar }}</span>
            <div>
              <div class="fst-agent-onto-name" :style="{ color: agent.color }">{{ agent.name }}</div>
              <div class="fst-agent-onto-role">{{ agent.role }}</div>
            </div>
            <div class="fst-agent-onto-weight">вес {{ Math.round(agent.weight * 100) }}%</div>
          </div>
          <div class="fst-agent-onto-desc">{{ agent.description }}</div>
          <div class="fst-agent-onto-focus">
            <span>Фокус:</span>
            <span v-for="f in agent.focus" :key="f" class="fst-focus-tag">{{ f }}</span>
          </div>
          <div class="fst-agent-onto-scores">
            <div v-for="(w, dim) in agent.scoringWeights" :key="dim" class="fst-ascore-row" v-show="w > 0">
              <span class="fst-ascore-dim">{{ SCORING_DIMS[dim]?.label }}</span>
              <div class="fst-ascore-bar">
                <div :style="{ width: (w * 100) + '%', background: agent.color }"></div>
              </div>
              <span class="fst-ascore-val">{{ Math.round(w * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TAB: EVENTS ══ -->
    <div v-if="activeTab === 'events'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-bolt"></i> Событийная онтология — Типы событий
      </div>

      <div v-for="group in eventGroups" :key="group.name" class="fst-event-group">
        <div class="fst-event-group-title" :style="{ color: group.color }">
          <i :class="group.icon"></i> {{ group.name }}
        </div>
        <div class="fst-event-list">
          <div v-for="ev in group.events" :key="ev.type" class="fst-event-row">
            <span class="fst-event-type" :style="{ background: group.color + '22', color: group.color }">
              {{ ev.type }}
            </span>
            <span class="fst-event-desc">{{ ev.description }}</span>
            <span v-if="ev.terminal" class="fst-event-terminal">TERMINAL</span>
          </div>
        </div>
      </div>

      <!-- Phase transition chain -->
      <div class="fst-section-title" style="margin-top:24px">
        <i class="pi pi-arrow-right"></i> Цепь фазовых переходов (Causality Chain)
      </div>
      <div class="fst-phase-chain">
        <div v-for="(ph, idx) in phaseChain" :key="ph.id" class="fst-chain-item">
          <div class="fst-chain-phase" :style="{ borderColor: ph.color, color: ph.color }">
            <i :class="ph.icon"></i>
            {{ ph.label }}
          </div>
          <div v-if="idx < phaseChain.length - 1" class="fst-chain-arrow">
            <i class="pi pi-arrow-right"></i>
          </div>
        </div>
      </div>

      <!-- Trigger conditions -->
      <div class="fst-section-title" style="margin-top:24px">
        <i class="pi pi-filter"></i> Условия переходов (Trigger Conditions)
      </div>
      <table class="fst-triggers-table">
        <thead>
          <tr>
            <th>Событие</th>
            <th>Условие триггера</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in triggerConditions" :key="t.event">
            <td><code>{{ t.event }}</code></td>
            <td>{{ t.condition }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══ TAB: CAUSALITY GRAPH ══ -->
    <div v-if="activeTab === 'causality'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-share-alt"></i> Граф причинности событийной онтологии ФСТ НТИ
      </div>
      <p style="font-size:12px;color:var(--p-text-muted-color,#888);margin-bottom:16px">
        Визуализация цепи событий и причинно-следственных связей между фазами инвесткомитета.
        Зелёные рёбра — нормальный поток, красные — терминальные состояния, оранжевые — условные переходы.
      </p>

      <!-- SVG causality graph -->
      <div class="fst-causal-svg-wrap">
        <svg :viewBox="`0 0 ${causalGraph.width} ${causalGraph.height}`" class="fst-causal-svg">
          <!-- Edge lines -->
          <g class="causal-edges">
            <line v-for="edge in causalGraph.edges" :key="edge.id"
              :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
              :stroke="edge.color" :stroke-width="edge.weight || 1.5"
              :stroke-dasharray="edge.dashed ? '5,3' : 'none'"
              marker-end="url(#arrowhead)" opacity="0.8"/>
          </g>

          <!-- Arrow marker -->
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--p-text-muted-color, #555)"/>
            </marker>
          </defs>

          <!-- Nodes -->
          <g v-for="node in causalGraph.nodes" :key="node.id" class="causal-node"
            :class="{ 'causal-node--active': hoveredNode === node.id }"
            @mouseenter="hoveredNode = node.id" @mouseleave="hoveredNode = null"
            style="cursor:pointer">
            <rect :x="node.x - node.w/2" :y="node.y - 18"
              :width="node.w" height="36" rx="8"
              :fill="node.fill" :stroke="node.stroke" stroke-width="1.5" opacity="0.95"/>
            <text :x="node.x" :y="node.y - 4" text-anchor="middle" dominant-baseline="middle"
              font-size="9" fill="#fff" font-weight="600">{{ node.label }}</text>
            <text :x="node.x" :y="node.y + 9" text-anchor="middle" dominant-baseline="middle"
              font-size="7.5" fill="rgba(255,255,255,0.7)">{{ node.sublabel }}</text>
          </g>
        </svg>

        <!-- Tooltip -->
        <div v-if="hoveredNode" class="fst-causal-tooltip">
          <div v-for="node in causalGraph.nodes.filter(n => n.id === hoveredNode)" :key="node.id">
            <strong>{{ node.label }}</strong><br>
            <span>{{ node.description }}</span>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="fst-causal-legend">
        <div class="fst-legend-item"><span class="fst-legend-line" style="background:#42a5f5"></span>Основной поток</div>
        <div class="fst-legend-item"><span class="fst-legend-line" style="background:#ffa726"></span>Условный переход</div>
        <div class="fst-legend-item"><span class="fst-legend-line" style="background:#4caf50"></span>Терминал: одобрено</div>
        <div class="fst-legend-item"><span class="fst-legend-line" style="background:#ef5350"></span>Терминал: отклонено</div>
        <div class="fst-legend-item"><span class="fst-legend-line" style="background:#888;border-style:dashed"></span>Опциональный</div>
      </div>

      <!-- Event causality table -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-table"></i> Матрица причинно-следственных связей
      </div>
      <table class="fst-triggers-table">
        <thead>
          <tr><th>Событие-причина</th><th>Событие-следствие</th><th>Условие</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in causalityMatrix" :key="c.cause + c.effect">
            <td><code>{{ c.cause }}</code></td>
            <td><code>{{ c.effect }}</code></td>
            <td style="font-size:11px;color:var(--p-text-muted-color,#888)">{{ c.condition }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══ TAB: AGENT CONFIG ══ -->
    <div v-if="activeTab === 'agent-config'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-sliders-h"></i> Настройка поведения AI-агентов
      </div>
      <p style="font-size:12px;color:var(--p-text-muted-color,#888);margin-bottom:16px">
        Редактируйте веса агентов и их скоринговые формулы. Изменения применяются к следующей симуляции.
      </p>

      <div class="fst-agent-config-grid">
        <div v-for="agent in agentConfigs" :key="agent.id" class="fst-ac-card"
          :style="{ borderColor: agent.color }">

          <div class="fst-ac-header">
            <span class="fst-ac-emoji">{{ agent.avatar }}</span>
            <div class="fst-ac-meta">
              <div class="fst-ac-name" :style="{ color: agent.color }">{{ agent.name }}</div>
              <div class="fst-ac-role">{{ agent.role }}</div>
            </div>
            <div class="fst-ac-bias-select">
              <select v-model="agent.bias" class="fst-bias-select">
                <option value="optimist">Оптимист</option>
                <option value="neutral">Нейтрал</option>
                <option value="pessimist">Пессимист</option>
              </select>
            </div>
          </div>

          <!-- Weight slider -->
          <div class="fst-ac-row">
            <label class="fst-ac-label">Вес голоса</label>
            <input type="range" v-model.number="agent.weight"
              min="0.05" max="0.5" step="0.01" class="fst-ac-slider"
              :style="{ accentColor: agent.color }"/>
            <span class="fst-ac-val">{{ Math.round(agent.weight * 100) }}%</span>
          </div>

          <!-- Scoring weights -->
          <div class="fst-ac-dims-title">Веса оценочных осей:</div>
          <div v-for="(w, dim) in agent.scoringWeights" :key="dim" class="fst-ac-dim-row">
            <label class="fst-ac-dim-label">{{ SCORING_DIMS[dim]?.label }}</label>
            <input type="range" v-model.number="agent.scoringWeights[dim]"
              min="0" max="0.7" step="0.01" class="fst-ac-slider"
              :style="{ accentColor: SCORING_DIMS[dim]?.color }"/>
            <span class="fst-ac-val" :style="{ color: SCORING_DIMS[dim]?.color }">
              {{ Math.round(agent.scoringWeights[dim] * 100) }}%
            </span>
          </div>

          <!-- Behaviour description -->
          <div class="fst-ac-desc">{{ agent.description }}</div>
        </div>
      </div>

      <!-- Total weights validation -->
      <div class="fst-ac-validation">
        <div class="fst-ac-val-row">
          <span>Сумма весов голосов агентов:</span>
          <span :style="{ color: Math.abs(totalAgentWeight - 1) < 0.02 ? '#4caf50' : '#ef5350', fontWeight: 600 }">
            {{ (totalAgentWeight * 100).toFixed(0) }}%
            {{ Math.abs(totalAgentWeight - 1) < 0.02 ? '✓ корректно' : '⚠ должно быть ~100%' }}
          </span>
        </div>
      </div>

      <div style="margin-top:12px">
        <Button label="Сбросить к умолчаниям" icon="pi pi-refresh" severity="secondary" size="small"
          @click="resetAgentConfigs" />
        <span style="font-size:11px;color:#888;margin-left:12px">
          Изменения применяются автоматически к следующей симуляции
        </span>
      </div>
    </div>

    <!-- ══ TAB: SIMULATOR ══ -->
    <div v-if="activeTab === 'simulator'" class="fst-tab-content fst-simulator-tab">
      <div class="fst-sim-wrapper">

        <!-- Project + Speed selectors -->
        <div v-if="!session" class="fst-sim-launch">
          <div class="fst-sim-launch-title">
            <i class="pi pi-play-circle" style="color:#ffa726;font-size:24px"></i>
            Запустить симуляцию инвесткомитета
          </div>
          <div class="fst-sim-select-row">
            <div class="fst-sim-select-label">Проект:</div>
            <Select v-model="selectedProjectId" :options="projectOptions" optionLabel="label" optionValue="value"
              class="fst-sim-select" placeholder="Выберите проект..." />
          </div>
          <div class="fst-sim-select-row">
            <div class="fst-sim-select-label">Скорость:</div>
            <div class="fst-speed-row">
              <div v-for="sp in speedOptions" :key="sp.id"
                :class="['fst-speed-btn', { active: selectedSpeed === sp.id }]"
                @click="selectedSpeed = sp.id">{{ sp.label }}</div>
            </div>
          </div>
          <Button label="Запустить комитет" icon="pi pi-play" severity="success"
            :disabled="!selectedProjectId" @click="startSession" />
        </div>

        <!-- Active session -->
        <div v-if="session" class="fst-sim-session">
          <!-- Phase bar -->
          <div class="fst-sim-phasebar">
            <div v-for="(ph, idx) in visiblePhases" :key="ph.id"
              :class="['fst-sim-phase', {
                done: phaseIdx > idx,
                active: phaseIdx === idx,
              }]">
              <div class="fst-sim-phase-dot" :style="{ background: phaseIdx >= idx ? ph.color : 'transparent', borderColor: ph.color }">
                <i v-if="phaseIdx > idx" class="pi pi-check" style="font-size:8px;color:#fff"></i>
              </div>
              <div class="fst-sim-phase-label">{{ ph.label }}</div>
            </div>
          </div>

          <!-- 3-column sim layout -->
          <div class="fst-sim-layout">
            <!-- Agents -->
            <div class="fst-sim-agents">
              <div class="fst-sim-col-title">Агенты</div>
              <div v-for="agent in AGENTS" :key="agent.id"
                :class="['fst-sim-agent', { thinking: agentStatus(agent.id).thinking, voted: agentStatus(agent.id).vote }]"
                :style="{ '--ac': agent.color }">
                <span class="fst-sim-agent-emoji">{{ agent.avatar }}</span>
                <div class="fst-sim-agent-info">
                  <div class="fst-sim-agent-name" :style="{ color: agent.color }">{{ agent.shortName }}</div>
                  <div v-if="agentStatus(agent.id).thinking" class="fst-sim-think">
                    <i class="pi pi-spin pi-spinner" style="font-size:9px"></i>
                    {{ agentStatus(agent.id).thinkText?.slice(0, 30) }}
                  </div>
                  <div v-else-if="agentStatus(agent.id).vote" class="fst-sim-vote-badge"
                    :style="{ background: VERDICTS[agentStatus(agent.id).vote]?.color }">
                    {{ VERDICTS[agentStatus(agent.id).vote]?.label }} · {{ agentStatus(agent.id).voteScore }}
                  </div>
                  <div v-else-if="agentStatus(agent.id).done" class="fst-sim-ready">
                    <i class="pi pi-check" style="color:#4caf50;font-size:9px"></i> готов
                  </div>
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div class="fst-sim-timeline-col">
              <div class="fst-sim-col-title">
                Дебаты
                <span style="font-size:10px;color:#666;margin-left:6px">{{ session.arguments.length }} арг.</span>
              </div>

              <!-- Loading -->
              <div v-if="session.phase === 'LOADING'" class="fst-sim-loading">
                <div v-for="agent in AGENTS" :key="agent.id" class="fst-sim-load-row">
                  <span>{{ agent.avatar }}</span>
                  <div class="fst-sim-load-bar">
                    <div :style="{ width: agentStatus(agent.id).done ? '100%' : agentStatus(agent.id).thinking ? '60%' : '5%', background: agent.color }"></div>
                  </div>
                  <i :class="agentStatus(agent.id).done ? 'pi pi-check' : 'pi pi-spin pi-spinner'"
                    :style="{ color: agentStatus(agent.id).done ? '#4caf50' : '#42a5f5', fontSize: '10px' }"></i>
                </div>
              </div>

              <div class="fst-sim-args" ref="timelineEl">
                <TransitionGroup name="fst-arg-anim" tag="div">
                  <div v-for="arg in session.arguments" :key="arg.id"
                    :class="['fst-sim-arg', `type-${arg.type.toLowerCase()}`, arg.targetArgId ? 'counter' : '']">
                    <div class="fst-sim-arg-hdr">
                      <span>{{ agentById(arg.agentId)?.avatar }}</span>
                      <span :style="{ color: agentById(arg.agentId)?.color, fontSize: '11px', fontWeight: 600 }">{{ agentById(arg.agentId)?.shortName }}</span>
                      <span class="fst-sim-arg-type">{{ argTypeLabel(arg.type) }}</span>
                    </div>
                    <div class="fst-sim-arg-text">{{ arg.text }}</div>
                  </div>
                </TransitionGroup>

                <!-- Votes -->
                <div v-if="session.votes.length > 0" class="fst-sim-votes-block">
                  <div class="fst-sim-votes-title"><i class="pi pi-check-square"></i> Голосование</div>
                  <TransitionGroup name="fst-arg-anim" tag="div">
                    <div v-for="vote in session.votes" :key="vote.id" class="fst-sim-vote-row">
                      <span>{{ agentById(vote.agentId)?.avatar }}</span>
                      <span :style="{ color: agentById(vote.agentId)?.color, fontSize: '11px' }">{{ agentById(vote.agentId)?.shortName }}</span>
                      <span class="fst-sim-vote-pill" :style="{ background: VERDICTS[vote.verdict]?.color }">{{ VERDICTS[vote.verdict]?.label }}</span>
                      <span style="font-size:11px;color:#888">{{ vote.score }}/100</span>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </div>

            <!-- Score + Decision -->
            <div class="fst-sim-score-col">
              <div class="fst-sim-col-title">Скоринг</div>

              <!-- Dim bars -->
              <div class="fst-sim-dim-bars">
                <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-sim-dim-row">
                  <span class="fst-sim-dim-label">{{ dim.label }}</span>
                  <div class="fst-sim-dim-bg">
                    <div :style="{ width: ((session.dimScores[key] || 0) * 100) + '%', background: dim.color }"></div>
                  </div>
                  <span :style="{ fontSize: '10px', color: dim.color, minWidth: '22px', textAlign: 'right' }">
                    {{ Math.round((session.dimScores[key] || 0) * 100) }}
                  </span>
                </div>
              </div>

              <!-- Aggregated decision -->
              <div v-if="session.decision" class="fst-sim-decision">
                <div class="fst-sim-score-val" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
                  {{ session.decision.aggregatedScore }}<small>/100</small>
                </div>
                <div class="fst-sim-rec" :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
                  <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
                  {{ VERDICTS[session.decision.recommendation]?.label }}
                </div>
              </div>

              <!-- Human approval -->
              <div v-if="session.phase === 'HUMAN_APPROVAL'" class="fst-sim-human">
                <div style="font-size:11px;color:#ffa726;font-weight:600;margin-bottom:8px">
                  <i class="pi pi-users"></i> Утверждение комитета
                </div>
                <div class="fst-sim-human-btns">
                  <Button label="Утвердить" icon="pi pi-check" severity="success" size="small"
                    @click="humanDecide('APPROVE')" />
                  <Button label="Отложить" icon="pi pi-clock" severity="warning" size="small"
                    @click="humanDecide('DEFER')" />
                  <Button label="Отклонить" icon="pi pi-times" severity="danger" size="small"
                    @click="humanDecide('REJECT')" />
                </div>
              </div>

              <!-- Concluded → transition to recs -->
              <div v-if="session.phase === 'CONCLUDED'" class="fst-sim-concluded">
                <i class="pi pi-check-circle" style="color:#4caf50;font-size:18px"></i>
                <div style="margin-top:4px">Голосование завершено — формируются рекомендации...</div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="fst-sim-controls">
            <Button icon="pi pi-stop" label="Сбросить" size="small" severity="secondary" text
              @click="resetSession" />
            <span v-if="session.roundNumber > 1" class="fst-round-badge">
              Раунд {{ session.roundNumber }}
            </span>
          </div>
        </div>

        <!-- ══ RECOMMENDATIONS PANEL ══ -->
        <div v-if="session && ['RECOMMENDATIONS','REVISION','READY_NEXT'].includes(session.phase)"
          class="fst-recs-panel">

          <div class="fst-recs-header">
            <div class="fst-recs-title">
              <i class="pi pi-list-check" style="color:#ab47bc"></i>
              Рекомендации команде проекта
              <span class="fst-round-pill">Раунд {{ session.roundNumber }}</span>
            </div>
            <div class="fst-recs-verdict" v-if="session.decision"
              :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
              {{ VERDICTS[session.decision.recommendation]?.label }}
              · {{ session.decision.aggregatedScore }}/100
            </div>
          </div>

          <!-- Rec list (editable checkboxes) -->
          <div v-if="session.phase === 'RECOMMENDATIONS'" class="fst-recs-list">
            <div v-for="rec in session.recommendations" :key="rec.id"
              :class="['fst-rec-card', `fst-rec-priority--${rec.priority.toLowerCase()}`,
                { 'fst-rec-card--checked': rec.accepted }]"
              :style="{ '--rec-color': rec.agentColor }">
              <div class="fst-rec-card-left">
                <input type="checkbox" v-model="rec.accepted" class="fst-rec-checkbox" />
                <span class="fst-rec-avatar">{{ rec.agentAvatar }}</span>
              </div>
              <div class="fst-rec-body">
                <div class="fst-rec-header-row">
                  <span class="fst-rec-priority" :class="`priority-${rec.priority.toLowerCase()}`">
                    {{ rec.priority }}
                  </span>
                  <span class="fst-rec-effort">{{ rec.effort }} · {{ rec.weeks }} нед.</span>
                  <span class="fst-rec-owner">{{ rec.owner }}</span>
                </div>
                <div class="fst-rec-text">{{ rec.text }}</div>
                <div class="fst-rec-metric">
                  Улучшает:
                  <strong :style="{ color: SCORING_DIMS[rec.metric]?.color || '#aaa' }">
                    {{ SCORING_DIMS[rec.metric]?.label || rec.metric }}
                  </strong>
                  <span v-if="rec.delta > 0" class="fst-rec-delta">+{{ rec.delta }}</span>
                </div>
              </div>
            </div>

            <div class="fst-recs-summary">
              <div class="fst-recs-summary-row">
                <span>Принято рекомендаций:</span>
                <strong>{{ session.recommendations.filter(r=>r.accepted).length }}
                  / {{ session.recommendations.length }}</strong>
              </div>
              <div class="fst-recs-summary-row">
                <span>Общий срок доработки:</span>
                <strong>{{ totalRevisionWeeks }} недель (~{{ Math.round(totalRevisionWeeks/4) }} мес.)</strong>
              </div>
              <Button label="Применить исправления и запустить доработку"
                icon="pi pi-cog" severity="success"
                :disabled="session.recommendations.filter(r=>r.accepted).length === 0"
                @click="startRevision" style="margin-top:10px;width:100%" />
            </div>
          </div>

          <!-- REVISION animation -->
          <div v-if="session.phase === 'REVISION'" class="fst-revision-anim">
            <div class="fst-revision-title">
              <i class="pi pi-spin pi-cog" style="color:#26a69a"></i>
              Команда дорабатывает проект...
            </div>
            <div class="fst-revision-progress-bar">
              <div :style="{ width: (session.revisionProgress * 100) + '%' }"></div>
            </div>
            <div class="fst-revision-step">
              <i class="pi pi-arrow-right" style="font-size:10px;color:#26a69a"></i>
              {{ session.revisionStep }}
            </div>
            <!-- Metrics changing live -->
            <div class="fst-revision-metrics">
              <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-rev-metric-row">
                <span class="fst-rev-metric-label">{{ dim.label }}</span>
                <div class="fst-rev-metric-bar">
                  <div class="fst-rev-bar-old"
                    :style="{ width: ((session.dimScores[key]||0)*100)+'%', background: dim.color+'44' }"></div>
                  <div class="fst-rev-bar-new"
                    :style="{ width: (revisionPreviewScore(key)*100)+'%', background: dim.color,
                      transition: `width ${session.revisionProgress * 2}s ease` }"></div>
                </div>
                <span :style="{ fontSize:'10px', color: dim.color, minWidth:'26px', textAlign:'right' }">
                  {{ Math.round(revisionPreviewScore(key)*100) }}
                </span>
              </div>
            </div>
          </div>

          <!-- READY_NEXT: diff + next round button -->
          <div v-if="session.phase === 'READY_NEXT' && session.revisedProject" class="fst-ready-next">
            <div class="fst-ready-title">
              <i class="pi pi-check-circle" style="color:#26a69a"></i>
              Доработка завершена — проект улучшен
            </div>

            <!-- Diff table -->
            <table class="fst-diff-table">
              <thead>
                <tr><th>Метрика</th><th>Было</th><th></th><th>Стало</th></tr>
              </thead>
              <tbody>
                <tr v-for="d in projectDiff" :key="d.label">
                  <td>{{ d.label }}</td>
                  <td class="fst-diff-old">{{ d.before }}</td>
                  <td class="fst-diff-arrow">
                    <i :class="d.improved ? 'pi pi-arrow-up' : 'pi pi-minus'"
                      :style="{ color: d.improved ? '#4caf50' : '#888' }"></i>
                  </td>
                  <td class="fst-diff-new" :style="{ color: d.improved ? '#4caf50' : '#ccc' }">
                    {{ d.after }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Predicted new score -->
            <div class="fst-predicted-score">
              <span>Прогноз нового балла:</span>
              <strong :style="{ color: scoreColor(predictedNextScore) }">
                {{ predictedNextScore }}/100
              </strong>
              <span class="fst-score-delta" :style="{ color: '#4caf50' }">
                +{{ predictedNextScore - session.decision.aggregatedScore }}
              </span>
            </div>

            <Button label="Запустить следующий раунд инвесткомитета"
              icon="pi pi-forward" severity="success" size="small"
              @click="startNextRound" style="width:100%;margin-top:10px" />
            <Button label="Начать заново с другим проектом"
              icon="pi pi-refresh" severity="secondary" size="small" text
              @click="resetSession" style="width:100%;margin-top:6px" />
          </div>
        </div>

        <!-- ══ ROUNDS HISTORY ══ -->
        <div v-if="roundHistory.length > 0" class="fst-rounds-history">
          <div class="fst-rounds-title">
            <i class="pi pi-history"></i> История раундов
          </div>
          <div v-for="(round, idx) in roundHistory" :key="round.sessionId" class="fst-round-row">
            <div class="fst-round-num">Р{{ idx + 1 }}</div>
            <div class="fst-round-info">
              <div class="fst-round-score" :style="{ color: scoreColor(round.score) }">
                {{ round.score }}/100
              </div>
              <div class="fst-round-verdict" :style="{ color: VERDICTS[round.verdict]?.color }">
                {{ VERDICTS[round.verdict]?.label }}
              </div>
            </div>
            <div class="fst-round-arrow" v-if="idx < roundHistory.length - 1">→</div>
          </div>
          <div v-if="session && session.decision" class="fst-round-row fst-round-row--current">
            <div class="fst-round-num">Р{{ roundHistory.length + 1 }}</div>
            <div class="fst-round-info">
              <div class="fst-round-score" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
                {{ session.decision.aggregatedScore }}/100
              </div>
              <div class="fst-round-verdict" :style="{ color: VERDICTS[session.decision.recommendation]?.color }">
                {{ VERDICTS[session.decision.recommendation]?.label }}
              </div>
            </div>
            <span style="font-size:9px;color:#888">текущий</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TAB: REQUIREMENTS ══ -->
    <div v-if="activeTab === 'requirements'" class="fst-tab-content">
      <div class="fst-section-title">
        <i class="pi pi-list-check"></i> Функциональные требования
      </div>
      <table class="fst-req-table">
        <thead><tr><th>ID</th><th>Требование</th></tr></thead>
        <tbody>
          <tr v-for="req in functionalRequirements" :key="req.id">
            <td><code>{{ req.id }}</code></td>
            <td>{{ req.text }}</td>
          </tr>
        </tbody>
      </table>

      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-sliders-h"></i> Нефункциональные требования
      </div>
      <table class="fst-req-table">
        <thead><tr><th>ID</th><th>Требование</th></tr></thead>
        <tbody>
          <tr v-for="req in nfRequirements" :key="req.id">
            <td><code>{{ req.id }}</code></td>
            <td>{{ req.text }}</td>
          </tr>
        </tbody>
      </table>

      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-building"></i> Сравнение с BlackRock Aladdin
      </div>
      <table class="fst-req-table">
        <thead><tr><th>Aladdin</th><th>ФСТ НТИ Инвесткомитет</th></tr></thead>
        <tbody>
          <tr v-for="row in alladinComparison" :key="row.aladdin">
            <td>{{ row.aladdin }}</td>
            <td>{{ row.fst }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══ TAB: GIFT FUND / OPEN SOURCE ══ -->
    <div v-if="activeTab === 'gift-fund'" class="fst-tab-content">

      <!-- ═══ ГРАФ ПРОЕКТОВ ФСТ ═══ -->
      <div class="fst-section-title">
        <i class="pi pi-share-alt"></i> Граф портфеля ФСТ НТИ
      </div>
      <div v-if="PROJECTS_POOL && PROJECTS_POOL.length > 0" class="gift-graph-wrap">
        <svg :viewBox="`0 0 ${graphWidth} ${graphHeight}`" class="gift-graph-svg">
          <!-- Связи субфонд → проект -->
          <line v-for="e in graphEdges" :key="e.id"
            :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
            :stroke="e.color" stroke-width="1.5" stroke-opacity="0.4" />
          <!-- Узлы субфондов -->
          <g v-for="sf in graphSubfundNodes" :key="sf.id">
            <circle :cx="sf.x" :cy="sf.y" r="22" :fill="sf.color" fill-opacity="0.15" :stroke="sf.color" stroke-width="2" />
            <text :x="sf.x" :y="sf.y + 4" text-anchor="middle" :fill="sf.color" font-size="9" font-weight="700">{{ sf.label }}</text>
          </g>
          <!-- Узлы проектов -->
          <g v-for="n in graphProjectNodes" :key="n.id" class="gift-graph-node" @click="giftSelectedProjectId = n.projectId; fillGiftFromProject()">
            <circle :cx="n.x" :cy="n.y" :r="n.r" :fill="n.color" fill-opacity="0.2" :stroke="n.color" stroke-width="1.5"
              :class="{ 'gift-graph-node-selected': giftSelectedProjectId === n.projectId }" />
            <text :x="n.x" :y="n.y - n.r - 4" text-anchor="middle" fill="var(--p-text-color)" font-size="8" font-weight="500">{{ n.label }}</text>
            <text :x="n.x" :y="n.y + 3" text-anchor="middle" :fill="n.color" font-size="9" font-weight="700">{{ n.trl }}</text>
          </g>
        </svg>
      </div>

      <!-- Карточки проектов -->
      <div class="fst-section-title">
        <i class="pi pi-briefcase"></i> Дар-оценка портфеля
      </div>
      <div v-if="PROJECTS_POOL.length === 0" class="gift-loading">Загрузка проектов...</div>
      <div v-else class="gift-portfolio-grid">
        <div v-for="p in PROJECTS_POOL" :key="p.id" class="gift-project-card"
          :class="{ 'gift-project-selected': giftSelectedProjectId === p.id }"
          @click="giftSelectedProjectId = p.id; fillGiftFromProject()">
          <div class="gift-project-header">
            <span class="gift-project-name">{{ p.title || p.name }}</span>
            <span class="gift-project-subfund" v-if="p.subFund || p.subfund">{{ p.subFund || p.subfund }}</span>
          </div>
          <div class="gift-project-metrics">
            <span v-if="p.trl" class="gift-pm" :style="{ color: p.trl >= 7 ? 'var(--fst-green)' : p.trl >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)' }">TRL {{ p.trl }}</span>
            <span v-if="p.employees" class="gift-pm">{{ p.employees }} чел.</span>
            <span v-if="p.patents" class="gift-pm">{{ p.patents }} пат.</span>
            <span v-if="p.sovereigntyScore" class="gift-pm" :style="{ color: p.sovereigntyScore >= 7 ? 'var(--fst-green)' : 'var(--fst-brand)' }">Сув. {{ p.sovereigntyScore }}</span>
          </div>
          <div class="gift-project-dar">
            <span class="gift-dar-label">Дар-потенциал:</span>
            <span class="gift-dar-value" :style="{ color: (p.localizationRatio || 0) > 0.7 ? 'var(--fst-green)' : (p.localizationRatio || 0) > 0.4 ? 'var(--fst-brand)' : 'var(--fst-red)' }">
              {{ (p.localizationRatio || 0) > 0.7 ? 'Высокий' : (p.localizationRatio || 0) > 0.4 ? 'Средний' : 'Низкий' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Три вопроса -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-question-circle"></i> Три вопроса онтологии дара
      </div>
      <div class="gift-questions-grid">
        <div class="gift-q-card" style="border-left:3px solid #e91e63">
          <div class="gift-q-num">1</div>
          <div class="gift-q-title">Что фонд ОТДАЁТ кроме денег?</div>
          <div class="gift-q-desc">Менторство, связи, экспертиза. Слой дара: utilitas → bonum → gratia</div>
        </div>
        <div class="gift-q-card" style="border-left:3px solid #9c27b0">
          <div class="gift-q-num">2</div>
          <div class="gift-q-title">Трансформирует ли это портфель?</div>
          <div class="gift-q-desc">Не IRR — а «фонд стал видеть рынок иначе». Взаимная трансформация</div>
        </div>
        <div class="gift-q-card" style="border-left:3px solid #00bcd4">
          <div class="gift-q-num">3</div>
          <div class="gift-q-title">Может ли проект сказать нет?</div>
          <div class="gift-q-desc">Свобода отказа = здоровый проект. Все принимают = зависимость</div>
        </div>
      </div>

      <!-- Новые агенты -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-users"></i> Агенты дар-анализа
      </div>
      <div class="gift-agents-grid">
        <div class="gift-agent-card" style="border-color:#e91e63">
          <div class="gift-agent-header">
            <span class="gift-agent-emoji">🤲</span>
            <div>
              <div class="gift-agent-name" style="color:#e91e63">Аналитик дара</div>
              <div class="gift-agent-role">gift_dar</div>
            </div>
          </div>
          <div class="gift-agent-desc">
            Оценивает: open source здоровье, суверенность через дар, burnout-риски,
            backdoor-устойчивость, perichoresis портфеля
          </div>
          <div class="gift-agent-rules">
            <div class="gift-rule gift-rule--green">Open source + высокая gratitude density → APPROVE</div>
            <div class="gift-rule gift-rule--yellow">Проприетарный без open source стратегии → DEFER</div>
            <div class="gift-rule gift-rule--red">Lone-maintainer паттерн (xz-сценарий) → REJECT</div>
          </div>
        </div>
        <div class="gift-agent-card" style="border-color:#00bcd4">
          <div class="gift-agent-header">
            <span class="gift-agent-emoji">🔓</span>
            <div>
              <div class="gift-agent-name" style="color:#00bcd4">Аудитор open source</div>
              <div class="gift-agent-role">opensource_audit</div>
            </div>
          </div>
          <div class="gift-agent-desc">
            Аудит для безопасного форка: закладки, лицензии, community health,
            стоимость очистки, суверенность использования
          </div>
          <div class="gift-agent-rules">
            <div class="gift-rule gift-rule--green">MIT/Apache/GPL + diverse community → суверенно</div>
            <div class="gift-rule gift-rule--yellow">SSPL/BSL → юридический риск при форке</div>
            <div class="gift-rule gift-rule--red">Proprietary / закрытый код → зависимость</div>
          </div>
        </div>
      </div>

      <!-- Анализатор проекта -->
      <div class="fst-section-title" style="margin-top:20px">
        <i class="pi pi-search"></i> Дар-анализ проекта
      </div>
      <div class="gift-analyzer">
        <div class="gift-analyzer-form">
          <div class="gift-form-row">
            <label>Проект фонда</label>
            <select v-model="giftSelectedProjectId" class="gift-input" @change="fillGiftFromProject">
              <option :value="null">— выберите проект —</option>
              <option v-for="p in PROJECTS_POOL" :key="p.id" :value="p.id">{{ p.title || p.name }}</option>
            </select>
          </div>
          <div class="gift-form-row">
            <label>Название проекта</label>
            <input v-model="giftAnalysis.projectName" class="gift-input" placeholder="Например: AeroScan SDK"/>
          </div>
          <div class="gift-form-row">
            <label>Open Source?</label>
            <select v-model="giftAnalysis.openSource" class="gift-input">
              <option :value="true">Да</option>
              <option :value="false">Нет</option>
            </select>
          </div>
          <div class="gift-form-row">
            <label>Лицензия</label>
            <select v-model="giftAnalysis.license" class="gift-input">
              <option value="MIT">MIT</option>
              <option value="Apache-2.0">Apache 2.0</option>
              <option value="GPL-3.0">GPL 3.0</option>
              <option value="LGPL">LGPL</option>
              <option value="BSD">BSD</option>
              <option value="SSPL">SSPL</option>
              <option value="BSL">BSL</option>
              <option value="proprietary">Проприетарная</option>
            </select>
          </div>
          <div class="gift-form-row">
            <label>Контрибуторы</label>
            <input v-model.number="giftAnalysis.contributors" type="number" class="gift-input" min="1" max="1000"/>
          </div>
          <div class="gift-form-row">
            <label>Доля топ-контрибутора (%)</label>
            <input v-model.number="giftAnalysis.topShare" type="number" class="gift-input" min="1" max="100"/>
          </div>
          <div class="gift-form-row">
            <label>Review coverage (%)</label>
            <input v-model.number="giftAnalysis.reviewDensity" type="number" class="gift-input" min="0" max="100"/>
          </div>
          <div class="gift-form-row">
            <label>Взаимные review-пары</label>
            <input v-model.number="giftAnalysis.mutualPairs" type="number" class="gift-input" min="0"/>
          </div>
          <div class="gift-form-row">
            <label>Организации-контрибуторы</label>
            <input v-model.number="giftAnalysis.orgs" type="number" class="gift-input" min="1"/>
          </div>
          <div class="gift-form-row">
            <label>Bus factor</label>
            <input v-model.number="giftAnalysis.busFactor" type="number" class="gift-input" min="1"/>
          </div>
          <div class="gift-form-row">
            <label>Форки</label>
            <input v-model.number="giftAnalysis.forks" type="number" class="gift-input" min="0"/>
          </div>
          <button class="gift-analyze-btn" @click="runGiftAnalysis">
            <i class="pi pi-heart"></i> Анализировать через онтологию дара
          </button>
        </div>

        <!-- Результат -->
        <div v-if="giftResult" class="gift-result">
          <div class="gift-result-header">
            <span class="gift-result-verdict"
              :class="{
                'verdict-approve': giftResult.suggestedStance === 'APPROVE',
                'verdict-defer': giftResult.suggestedStance === 'DEFER',
                'verdict-reject': giftResult.suggestedStance === 'REJECT'
              }">
              {{ giftResult.suggestedStance }}
            </span>
            <span class="gift-result-layer"
              :style="{ color: giftResult.giftLayer === 'gratia' ? '#e91e63' : giftResult.giftLayer === 'bonum' ? '#9c27b0' : '#78909c' }">
              {{ giftResult.giftLayer === 'gratia' ? 'Благодать' : giftResult.giftLayer === 'bonum' ? 'Благо' : 'Утилита' }}
            </span>
          </div>

          <div class="gift-metrics-grid">
            <div class="gift-metric">
              <div class="gift-metric-label">Плотность благодарности</div>
              <div class="gift-metric-value">{{ giftResult.gratitudeDensity }}</div>
              <div class="gift-metric-bar">
                <div :style="{ width: Math.min(giftResult.gratitudeDensity * 500, 100) + '%', background: '#e91e63' }"></div>
              </div>
            </div>
            <div class="gift-metric">
              <div class="gift-metric-label">Устойчивость к закладкам</div>
              <div class="gift-metric-value" :style="{ color: giftResult.backdoorResistance === 'high' ? '#4caf50' : giftResult.backdoorResistance === 'low' ? '#ef5350' : '#ffa726' }">
                {{ giftResult.backdoorResistance === 'high' ? 'Высокая' : giftResult.backdoorResistance === 'low' ? 'Низкая' : 'Средняя' }}
                ({{ giftResult.backdoorScore }}/100)
              </div>
              <div class="gift-metric-bar">
                <div :style="{ width: giftResult.backdoorScore + '%', background: giftResult.backdoorResistance === 'high' ? '#4caf50' : giftResult.backdoorResistance === 'low' ? '#ef5350' : '#ffa726' }"></div>
              </div>
            </div>
            <div class="gift-metric">
              <div class="gift-metric-label">Риск выгорания</div>
              <div class="gift-metric-value" :style="{ color: giftResult.burnoutRisk === 'low' ? '#4caf50' : giftResult.burnoutRisk === 'critical' ? '#ef5350' : '#ffa726' }">
                {{ giftResult.burnoutRisk === 'low' ? 'Низкий' : giftResult.burnoutRisk === 'critical' ? 'Критический' : giftResult.burnoutRisk === 'high' ? 'Высокий' : 'Средний' }}
              </div>
            </div>
            <div class="gift-metric">
              <div class="gift-metric-label">Суверенность</div>
              <div class="gift-metric-value" :style="{ color: giftResult.sovereigntyGift.includes('ДАРИТ') ? '#4caf50' : '#ef5350' }">
                {{ giftResult.sovereigntyGift }}
              </div>
            </div>
          </div>

          <!-- Наблюдения -->
          <div class="gift-observations">
            <div class="gift-obs-title">Наблюдения</div>
            <div v-for="(obs, i) in giftResult.observations" :key="i" class="gift-obs-item">
              {{ obs }}
            </div>
          </div>

          <!-- Burnout signals -->
          <div v-if="giftResult.burnoutSignals.length" class="gift-signals">
            <div class="gift-obs-title" style="color:#ef5350">Сигналы выгорания (xz/faker.js паттерн)</div>
            <div v-for="(sig, i) in giftResult.burnoutSignals" :key="i" class="gift-signal-item">
              ⚠ {{ sig }}
            </div>
          </div>
        </div>
      </div>

      <!-- Маппинг GitHub → Gift Ontology -->
      <div class="fst-section-title" style="margin-top:24px">
        <i class="pi pi-github"></i> GitHub → Онтология дара
      </div>
      <table class="fst-req-table">
        <thead><tr><th>GitHub действие</th><th>Gift Ontology</th><th>Что видит</th></tr></thead>
        <tbody>
          <tr v-for="m in githubMapping" :key="m.github">
            <td><code>{{ m.github }}</code></td>
            <td style="color:#e91e63">{{ m.gift }}</td>
            <td style="font-size:11px;color:var(--p-text-muted-color)">{{ m.insight }}</td>
          </tr>
        </tbody>
      </table>

      <!-- xz vs здоровый проект -->
      <div class="fst-section-title" style="margin-top:24px">
        <i class="pi pi-shield"></i> xz-backdoor vs здоровый проект
      </div>
      <div class="gift-compare-grid">
        <div class="gift-compare-card gift-compare--bad">
          <div class="gift-compare-title">xz-utils (бэкдор 2024)</div>
          <div class="gift-compare-row"><span>Мейнтейнер:</span> <span>1 человек, 80%+ кода</span></div>
          <div class="gift-compare-row"><span>Gratitude density:</span> <span style="color:#ef5350">~0</span></div>
          <div class="gift-compare-row"><span>Review coverage:</span> <span style="color:#ef5350">&lt;10%</span></div>
          <div class="gift-compare-row"><span>Newcomer trust:</span> <span style="color:#ef5350">Быстрый, без взаимности</span></div>
          <div class="gift-compare-row"><span>Результат:</span> <span style="color:#ef5350">Бэкдор в OpenSSH</span></div>
        </div>
        <div class="gift-compare-card gift-compare--good">
          <div class="gift-compare-title">Здоровый проект</div>
          <div class="gift-compare-row"><span>Мейнтейнеры:</span> <span>3+ из разных org</span></div>
          <div class="gift-compare-row"><span>Gratitude density:</span> <span style="color:#4caf50">>0.2</span></div>
          <div class="gift-compare-row"><span>Review coverage:</span> <span style="color:#4caf50">>80%</span></div>
          <div class="gift-compare-row"><span>Newcomer trust:</span> <span style="color:#4caf50">Постепенный, с review</span></div>
          <div class="gift-compare-row"><span>Результат:</span> <span style="color:#4caf50">Безопасный форк</span></div>
        </div>
      </div>

      <!-- API endpoints -->
      <div class="fst-section-title" style="margin-top:24px">
        <i class="pi pi-server"></i> API Endpoints
      </div>
      <table class="fst-req-table">
        <thead><tr><th>Метод</th><th>Endpoint</th><th>Назначение</th></tr></thead>
        <tbody>
          <tr v-for="ep in giftEndpoints" :key="ep.path">
            <td><code>{{ ep.method }}</code></td>
            <td><code>{{ ep.path }}</code></td>
            <td style="font-size:11px">{{ ep.desc }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import {
  AGENTS, SCORING_DIMS, PHASES, PHASE_ORDER, VERDICTS,
  SUBFUNDS,
} from '@/components/fst-committee/FstCommitteeConfig.js'
import { FstCommitteeEngine, createSession } from '@/components/fst-committee/FstCommitteeEngine.js'
// GitHubGiftGraph removed — replaced with FST portfolio gift cards
import { useFstData } from '@/composables/useFstData.js'

const { projects: PROJECTS_POOL_REF, loadProjects } = useFstData()
// Load projects from Integram on mount, select first when loaded
onMounted(async () => {
  await loadProjects()
  if (PROJECTS_POOL_REF.value?.length && !selectedProjectId.value) {
    selectedProjectId.value = PROJECTS_POOL_REF.value[0].id
  }
})

// ── Tabs ─────────────────────────────────────────────────────
const tabs = [
  { id: 'ontology',     label: 'Онтология',       icon: 'pi pi-sitemap' },
  { id: 'agents',       label: 'Агенты',           icon: 'pi pi-users' },
  { id: 'events',       label: 'Событийная цепь',  icon: 'pi pi-bolt' },
  { id: 'causality',    label: 'Граф причинности', icon: 'pi pi-share-alt' },
  { id: 'agent-config', label: 'Настройка агентов',icon: 'pi pi-sliders-h' },
  { id: 'simulator',    label: 'Симулятор',         icon: 'pi pi-play' },
  { id: 'requirements', label: 'Требования',        icon: 'pi pi-list-check' },
  { id: 'gift-fund',    label: 'Дар / Open Source', icon: 'pi pi-heart' },
]
const activeTab = ref('ontology')

// ── Ontology data ─────────────────────────────────────────────
const ontologyClasses = [
  {
    name: 'Project',
    color: '#42a5f5',
    description: 'Инвестиционный проект / заявка',
    properties: ['projectId', 'title', 'company', 'trl', 'mrl', 'sovereigntyScore', 'localizationRatio', 'marketSize', 'projectedIRR', 'requestedAmount'],
  },
  {
    name: 'Agent',
    color: '#7e57c2',
    description: 'AI Агент инвесткомитета',
    properties: ['agentId', 'name', 'role', 'avatar', 'weight', 'bias', 'scoringWeights', 'focus'],
  },
  {
    name: 'CommitteeSession',
    color: '#ffa726',
    description: 'Сессия инвесткомитета',
    properties: ['sessionId', 'project', 'agents', 'phase', 'startedAt', 'arguments', 'votes', 'decision'],
  },
  {
    name: 'Argument',
    color: '#ef5350',
    description: 'Аргумент / тезис агента',
    properties: ['argumentId', 'agentId', 'type', 'text', 'targetArgId', 'dimension', 'strength', 'timestamp'],
  },
  {
    name: 'Vote',
    color: '#26c6da',
    description: 'Голос агента по проекту',
    properties: ['voteId', 'agentId', 'verdict', 'score', 'confidence', 'rationale'],
  },
  {
    name: 'Decision',
    color: '#66bb6a',
    description: 'Решение комитета',
    properties: ['decisionId', 'aggregatedScore', 'recommendation', 'conditions', 'risks', 'voteCounts', 'humanApproval'],
  },
  {
    name: 'Company',
    color: '#78909c',
    description: 'Компания-заявитель',
    properties: ['companyId', 'name', 'inn', 'foundedYear', 'employees', 'revenue', 'patents'],
  },
  {
    name: 'SubFund',
    color: '#ffd54f',
    description: 'Субфонд (БАС / Робот / МЭ)',
    properties: ['id', 'name', 'budget', 'deployedRatio', 'marketFocus'],
  },
]

const ontologyRelations = [
  { from: 'CommitteeSession', predicate: 'evaluates',        to: 'Project' },
  { from: 'CommitteeSession', predicate: 'includes',         to: 'Agent' },
  { from: 'Agent',            predicate: 'raises',           to: 'Argument' },
  { from: 'Argument',         predicate: 'challenges',       to: 'Argument' },
  { from: 'Agent',            predicate: 'casts',            to: 'Vote' },
  { from: 'Vote',             predicate: 'about',            to: 'CommitteeSession' },
  { from: 'Decision',         predicate: 'basedOn',          to: 'Vote' },
  { from: 'Project',          predicate: 'requestedFrom',    to: 'SubFund' },
  { from: 'Project',          predicate: 'submittedBy',      to: 'Company' },
  { from: 'Decision',         predicate: 'humanApproval',    to: 'HumanApproval' },
]

// ── Event Ontology data ───────────────────────────────────────
const eventGroups = [
  {
    name: 'SESSION_EVENTS',
    color: '#42a5f5',
    icon: 'pi pi-calendar',
    events: [
      { type: 'SessionCreated',    description: 'Создана новая сессия инвесткомитета' },
      { type: 'SessionStarted',    description: 'Сессия запущена, агенты начали работу' },
      { type: 'PhaseTransitioned', description: 'Переход к новой фазе (prevPhase → nextPhase)' },
      { type: 'SessionConcluded',  description: 'Сессия завершена с финальным вердиктом', terminal: true },
    ],
  },
  {
    name: 'ANALYSIS_EVENTS',
    color: '#7e57c2',
    icon: 'pi pi-file-search',
    events: [
      { type: 'AgentAnalysisStarted',   description: 'Агент начал изучение документации проекта' },
      { type: 'AgentAnalysisCompleted', description: 'Агент завершил анализ, готов к дебатам' },
      { type: 'AgentStatusChanged',     description: 'Изменился статус агента (thinking, done, voted)' },
    ],
  },
  {
    name: 'DEBATE_EVENTS',
    color: '#ef5350',
    icon: 'pi pi-comments',
    events: [
      { type: 'ArgumentRaised',         description: 'Агент выдвинул аргумент (type: OPENING/CHALLENGE/COUNTER/SUMMARY)' },
      { type: 'CounterArgumentRaised',  description: 'Контраргумент в ответ на конкретный аргумент' },
      { type: 'ConsensusSignaled',      description: 'Агент сигнализирует о согласии с позицией' },
      { type: 'DisagreementSignaled',   description: 'Агент сигнализирует несогласие' },
    ],
  },
  {
    name: 'VOTING_EVENTS',
    color: '#26c6da',
    icon: 'pi pi-check-square',
    events: [
      { type: 'VotingStarted',   description: 'Начато голосование агентов' },
      { type: 'VoteCast',        description: 'Агент подал голос (verdict, score, confidence)' },
      { type: 'AllVotesCast',    description: 'Все агенты проголосовали' },
      { type: 'VotingConcluded', description: 'Голосование завершено' },
    ],
  },
  {
    name: 'DECISION_EVENTS',
    color: '#66bb6a',
    icon: 'pi pi-flag',
    events: [
      { type: 'DecisionFormed',    description: 'Решение сформировано (aggregatedScore, recommendation)' },
      { type: 'DecisionPublished', description: 'Решение опубликовано членам комитета' },
    ],
  },
  {
    name: 'HUMAN_APPROVAL_EVENTS',
    color: '#ffa726',
    icon: 'pi pi-users',
    events: [
      { type: 'HumanApprovalRequested', description: 'Запрос утверждения людьми' },
      { type: 'DecisionApproved',       description: 'Люди утвердили решение AI-агентов', terminal: true },
      { type: 'DecisionRejected',       description: 'Люди отклонили решение AI-агентов', terminal: true },
      { type: 'DecisionDeferred',       description: 'Решение отложено для доработки', terminal: true },
    ],
  },
]

const phaseChain = PHASE_ORDER.map(id => PHASES[id])

const triggerConditions = [
  { event: 'PhaseTransitioned → CROSS_DEBATE',     condition: 'Все 6 агентов подали первичные позиции (OPENING)' },
  { event: 'PhaseTransitioned → VOTING',           condition: 'Завершены 3 раунда дебатов ИЛИ все агенты дали SUMMARY' },
  { event: 'PhaseTransitioned → SYNTHESIS',        condition: 'Все 6 агентов проголосовали' },
  { event: 'PhaseTransitioned → HUMAN_APPROVAL',   condition: 'Решение сформировано и опубликовано' },
  { event: 'ConsensusSignaled',                     condition: 'Разброс оценок агентов < 15 баллов' },
  { event: 'DisagreementSignaled',                  condition: 'Разброс оценок агентов >= 30 баллов' },
  { event: 'DecisionApproved (авто)',               condition: 'aggregatedScore >= 72 И председатель нажал "Утвердить"' },
  { event: 'DecisionDeferred',                      condition: 'aggregatedScore 50..71 ИЛИ есть условия одобрения' },
  { event: 'DecisionRejected',                      condition: 'aggregatedScore < 50 ИЛИ председатель нажал "Отклонить"' },
]

// ── Requirements data ─────────────────────────────────────────
const functionalRequirements = [
  { id: 'FR-001', text: 'Создание сессии с выбором проекта из пула и запуском 6 агентов' },
  { id: 'FR-002', text: '6 агентов разных ролей с независимыми логиками анализа по 7 осям' },
  { id: 'FR-003', text: 'Генерация аргументов (OPENING, CHALLENGE, COUNTER, SUMMARY) на основе данных проекта' },
  { id: 'FR-004', text: 'Перекрёстные ссылки между аргументами — контраргументы с targetArgId' },
  { id: 'FR-005', text: 'Взвешенный скоринг 0-100 по 7 осям с индивидуальными весами агентов' },
  { id: 'FR-006', text: 'Голосование: каждый агент выдаёт вердикт (APPROVE/REJECT/DEFER) с confidence' },
  { id: 'FR-007', text: 'Синтез: агрегированный балл, условия одобрения, список ключевых рисков' },
  { id: 'FR-008', text: 'Утверждение людьми: председатель и члены комитета подтверждают решение' },
]

const nfRequirements = [
  { id: 'NFR-001', text: 'Сессия дебатов: 1-5 мин (настраиваемая скорость 1x / 2.5x / 6x)' },
  { id: 'NFR-002', text: 'Не более 6 агентов одновременно (расширяемо через конфиг)' },
  { id: 'NFR-003', text: 'Все аргументы и события сохраняются в session.events (воспроизводимость)' },
  { id: 'NFR-004', text: 'Дашборд работает в браузере без backend AI (симуляция офлайн)' },
  { id: 'NFR-005', text: 'При подключении к реальному AI — аргументы через /api/ai-tokens/chat' },
  { id: 'NFR-006', text: 'Интегрирован в /event-ontology как панель (точка сборки онтологий)' },
]

const alladinComparison = [
  { aladdin: 'Risk analytics engine (количественный)',   fst: 'AI agents debate (качественный + количественный)' },
  { aladdin: 'Рыночные данные в реальном времени',        fst: 'Проектные данные из Integram / заявки' },
  { aladdin: 'Portfolio-level risk',                       fst: 'Project-level + портфельный баланс' },
  { aladdin: 'Автоматические сделки',                     fst: 'Рекомендация → человеческое утверждение' },
  { aladdin: 'Нет объяснений ("black box")',              fst: 'Полная трассировка аргументов и контраргументов' },
  { aladdin: 'Проприетарные данные BlackRock',            fst: 'Данные ФСТ НТИ + онтология БПЛА в Integram' },
]

// ── Gift Fund / Open Source ────────────────────────────────────

const giftSelectedProjectId = ref(null)

// ── Gift Graph (SVG) ─────────────────────────────────────────────
const graphWidth = 700
const graphHeight = 400

const subfundColors = {
  'БАС': 'var(--fst-blue)', 'РОБО': 'var(--fst-green)', 'МЭ': 'var(--fst-brand)',
  'AI/Tech': 'var(--fst-purple)', 'Фотоника': 'var(--fst-cyan)', 'ФармаМед': 'var(--fst-red)',
  'SpaceNet': 'var(--fst-blue-dark)', 'Энерджинет': 'var(--fst-green-dark)',
  'Технет': 'var(--fst-brand-dark)', 'MediaNet': 'var(--fst-purple)',
}

const graphSubfundNodes = computed(() => {
  const sfs = new Map()
  for (const p of PROJECTS_POOL) {
    const sf = p.subFund || p.subfund || p.market || 'Другое'
    if (!sfs.has(sf)) sfs.set(sf, [])
    sfs.get(sf).push(p)
  }
  const arr = [...sfs.keys()]
  const cx = graphWidth / 2, cy = graphHeight / 2, radius = 130
  return arr.map((sf, i) => {
    const angle = (2 * Math.PI * i) / arr.length - Math.PI / 2
    return { id: sf, label: sf.length > 8 ? sf.slice(0, 7) + '…' : sf, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), color: subfundColors[sf] || 'var(--p-text-muted-color)' }
  })
})

const graphProjectNodes = computed(() => {
  const sfMap = new Map()
  graphSubfundNodes.value.forEach(sf => sfMap.set(sf.id, sf))
  return PROJECTS_POOL.map((p, i) => {
    const sf = sfMap.get(p.subFund || p.subfund || p.market || 'Другое') || { x: graphWidth / 2, y: graphHeight / 2, color: 'var(--p-text-muted-color)' }
    const angle = (2 * Math.PI * i) / Math.max(PROJECTS_POOL.length, 1) + 0.5
    const dist = 50 + ((i * 17 + 7) % 30)
    const name = (p.title || p.name || '').replace(/^ООО\s*/i, '').slice(0, 14)
    return {
      id: `p_${p.id}`, projectId: p.id, label: name,
      trl: p.trl ? `TRL${p.trl}` : '',
      x: sf.x + dist * Math.cos(angle), y: sf.y + dist * Math.sin(angle),
      r: 10 + (p.trl || 5) * 1.5,
      color: sf.color,
    }
  })
})

const graphEdges = computed(() => {
  const sfMap = new Map()
  graphSubfundNodes.value.forEach(sf => sfMap.set(sf.id, sf))
  return PROJECTS_POOL.map((p, i) => {
    const sf = sfMap.get(p.subFund || p.subfund || p.market || 'Другое')
    const pn = graphProjectNodes.value[i]
    if (!sf || !pn) return null
    return { id: `e_${i}`, x1: sf.x, y1: sf.y, x2: pn.x, y2: pn.y, color: sf.color }
  }).filter(Boolean)
})
const giftAnalysis = reactive({
  projectName: '',
  openSource: true,
  license: 'MIT',
  contributors: 10,
  topShare: 40,
  reviewDensity: 70,
  mutualPairs: 3,
  orgs: 3,
  busFactor: 3,
  forks: 15,
})
const giftResult = ref(null)

function fillGiftFromProject() {
  const p = PROJECTS_POOL.find(p => p.id === giftSelectedProjectId.value)
  if (!p) return
  giftAnalysis.projectName = p.title || p.name || ''
  // Estimate fields from project data
  giftAnalysis.contributors = p.employees || p.teamStrength ? Math.round((p.employees || 10) * 0.6) : 10
  giftAnalysis.busFactor = Math.min(Math.max(Math.round((p.employees || 5) / 5), 1), 10)
  giftAnalysis.orgs = p.patents ? Math.min(p.patents, 5) : 2
  giftAnalysis.openSource = (p.localizationRatio || 0) > 0.7
  giftAnalysis.topShare = p.employees > 20 ? 25 : p.employees > 5 ? 45 : 70
  giftAnalysis.reviewDensity = p.trl >= 7 ? 80 : p.trl >= 5 ? 60 : 40
  giftAnalysis.forks = p.trl >= 6 ? Math.round((p.employees || 5) * 2) : 5
  giftAnalysis.mutualPairs = Math.round(giftAnalysis.contributors * 0.3)
}

function runGiftAnalysis() {
  // Используем ту же логику что и execCalcGiftHealth из AgentToolRegistry
  const p = giftAnalysis
  const contributorsCount = p.contributors
  const topContributorShare = p.topShare / 100
  const reviewDensity = p.reviewDensity / 100
  const mutualReviewPairs = p.mutualPairs
  const openSource = p.openSource
  const license = p.license
  const communityOrgs = p.orgs
  const forkCount = p.forks
  const busFactor = p.busFactor

  const maxPairs = contributorsCount * (contributorsCount - 1) / 2
  const gratitudeDensity = maxPairs > 0 ? +(mutualReviewPairs / maxPairs).toFixed(3) : 0

  const xzSignals = []
  if (topContributorShare > 0.7) xzSignals.push(`Топ-контрибутор = ${(topContributorShare * 100).toFixed(0)}% активности`)
  if (busFactor <= 1) xzSignals.push('Bus factor = 1 — один человек держит проект')
  if (reviewDensity < 0.3) xzSignals.push(`Только ${(reviewDensity * 100).toFixed(0)}% PR проходят review`)
  if (communityOrgs <= 1) xzSignals.push('Все контрибуторы из одной организации')

  const burnoutRisk = xzSignals.length >= 3 ? 'critical' : xzSignals.length >= 2 ? 'high' : xzSignals.length >= 1 ? 'medium' : 'low'

  const backdoorScore = Math.round(
    (reviewDensity * 30) +
    (Math.min(gratitudeDensity * 5, 1) * 25) +
    (Math.min(communityOrgs / 5, 1) * 25) +
    ((1 - topContributorShare) * 20)
  )
  const backdoorResistance = backdoorScore >= 70 ? 'high' : backdoorScore >= 40 ? 'medium' : 'low'

  const sovereignLicenses = ['MIT', 'Apache', 'Apache-2.0', 'GPL', 'GPL-3.0', 'LGPL', 'BSD', 'MPL']
  const lockinLicenses = ['SSPL', 'BSL', 'Elastic', 'proprietary']
  const licenseUpper = (license || '').toUpperCase()
  const isSovereign = openSource && sovereignLicenses.some(l => licenseUpper.includes(l.toUpperCase()))
  const isLockin = !openSource || lockinLicenses.some(l => licenseUpper.includes(l.toUpperCase()))

  let giftLayer = 'utilitas'
  if (isSovereign && gratitudeDensity > 0.1) giftLayer = 'bonum'
  if (isSovereign && gratitudeDensity > 0.3 && burnoutRisk === 'low') giftLayer = 'gratia'

  let suggestedStance = 'DEFER'
  if (isLockin) suggestedStance = 'DEFER'
  if (burnoutRisk === 'critical') suggestedStance = 'REJECT'
  if (isSovereign && burnoutRisk === 'low' && backdoorResistance !== 'low') suggestedStance = 'APPROVE'

  giftResult.value = {
    gratitudeDensity,
    burnoutRisk,
    burnoutSignals: xzSignals,
    backdoorResistance,
    backdoorScore,
    giftLayer,
    sovereigntyGift: isSovereign ? 'ДАРИТ суверенность' : 'ПРОДАЁТ зависимость',
    suggestedStance,
    observations: [
      `Плотность благодарности: ${gratitudeDensity} (${gratitudeDensity > 0.2 ? 'связное сообщество' : 'разрозненные контрибуторы'})`,
      `Устойчивость к закладкам: ${backdoorResistance} (${backdoorScore}/100)`,
      `Риск выгорания: ${burnoutRisk}${xzSignals.length ? ' — ' + xzSignals[0] : ''}`,
      `Слой дара: ${giftLayer} (${giftLayer === 'gratia' ? 'высший — трансформирует обоих' : giftLayer === 'bonum' ? 'благо — взаимная польза' : 'утилитарный — обмен'})`,
      `Суверенность: ${isSovereign ? 'открытый код, можно форкнуть' : 'vendor lock-in, зависимость'}`,
    ],
  }
}

const githubMapping = [
  { github: 'PR submitted',          gift: 'gift.offer',        insight: 'Код подарен проекту — ещё не принят' },
  { github: 'PR reviewed',           gift: 'gratitude edge',    insight: 'Ревьюер благодарит автора вниманием' },
  { github: 'PR merged',             gift: 'gift.accept',       insight: 'Проект принял дар — оба трансформированы' },
  { github: 'PR closed w/o merge',   gift: 'gift.decline',      insight: 'Свобода отказа — не ошибка' },
  { github: 'Issue opened',          gift: 'telos.declare',     insight: 'Заявлена потребность — что нужно?' },
  { github: 'Issue resolved',        gift: 'gift toward telos', insight: 'Дар в направлении телоса' },
  { github: 'Code review approval',  gift: 'freedom.accept',    insight: 'Мейнтейнер свободно принял' },
  { github: 'Review: changes req.',  gift: 'freedom.refuse',    insight: 'Здоровый отказ — защита качества' },
]

const giftEndpoints = [
  { method: 'POST', path: '/api/gift/fund/analyze-project', desc: 'Дар-анализ проекта (openSource health, sovereignty, telos)' },
  { method: 'GET',  path: '/api/gift/fund/portfolio-health', desc: 'Здоровье портфеля (perichoresis, density, асимметрии)' },
  { method: 'GET',  path: '/api/gift/fund/suggest-pairs',    desc: 'Кто кому нужен в портфеле' },
  { method: 'POST', path: '/api/gift/fund/evaluate-repo',    desc: 'Оценка GitHub-репозитория через дар' },
  { method: 'POST', path: '/api/gift/fund/verdict',          desc: 'APPROVE/DEFER/REJECT через gift lens' },
  { method: 'POST', path: '/api/gift/github/analyze',        desc: 'Полный анализ open source проекта' },
  { method: 'POST', path: '/api/gift/github/xz-check',       desc: 'Детектор xz-backdoor паттерна' },
  { method: 'POST', path: '/api/gift/github/marak-check',    desc: 'Детектор burnout (faker.js)' },
  { method: 'POST', path: '/api/gift/github/sovereignty',    desc: 'Готовность к суверенному форку' },
]

// ── Causality Graph ───────────────────────────────────────────

const hoveredNode = ref(null)

const causalGraph = computed(() => {
  const W = 900, H = 520
  // Layout: phases as nodes in a flow, events as smaller nodes
  const phases = [
    { id: 'LOADING',           label: 'Анализ',       sublabel: 'AgentAnalysisStarted', description: 'Агенты изучают документы проекта',          fill: '#42a5f5', stroke: '#1565c0', x: 80,  y: 80 },
    { id: 'PRIMARY_POSITIONS', label: 'Позиции',      sublabel: 'ArgumentRaised×6',    description: 'Каждый агент выдвигает первичный тезис',      fill: '#7e57c2', stroke: '#4527a0', x: 240, y: 80 },
    { id: 'CROSS_DEBATE',      label: 'Дебаты',       sublabel: 'CHALLENGE/COUNTER',   description: '3 раунда перекрёстных аргументов',            fill: '#ef5350', stroke: '#b71c1c', x: 420, y: 80 },
    { id: 'FINAL_POSITIONS',   label: 'Финал',        sublabel: 'SUMMARY×6',          description: 'Каждый агент формулирует итоговую позицию',    fill: '#ff7043', stroke: '#bf360c', x: 600, y: 80 },
    { id: 'VOTING',            label: 'Голосование',  sublabel: 'VoteCast×6',         description: 'Агенты голосуют с весами и confidence',        fill: '#26c6da', stroke: '#00838f', x: 770, y: 80 },
    { id: 'SYNTHESIS',         label: 'Синтез',       sublabel: 'DecisionFormed',     description: 'Агрегация баллов, условия, риски',             fill: '#66bb6a', stroke: '#2e7d32', x: 770, y: 220 },
    { id: 'HUMAN_APPROVAL',    label: 'Комитет',      sublabel: 'HumanApproval',      description: 'Председатель утверждает решение агентов',      fill: '#ffa726', stroke: '#e65100', x: 600, y: 220 },
    { id: 'APPROVE',           label: 'ОДОБРЕНО',     sublabel: 'DecisionApproved',   description: 'Проект одобрен — переходит к инвестированию',  fill: '#4caf50', stroke: '#1b5e20', x: 420, y: 340 },
    { id: 'DEFER',             label: 'ОТЛОЖЕНО',     sublabel: 'DecisionDeferred',   description: 'Проект отложен для доработки',                 fill: '#ffa726', stroke: '#e65100', x: 600, y: 340 },
    { id: 'REJECT',            label: 'ОТКЛОНЕНО',    sublabel: 'DecisionRejected',   description: 'Проект отклонён',                              fill: '#ef5350', stroke: '#b71c1c', x: 780, y: 340 },
  ]
  const nodeW = (id) => id.length > 8 ? 110 : 90
  const nodes = phases.map(p => ({ ...p, w: nodeW(p.id) }))

  const edges = [
    { id: 'e1',  x1: 80,  y1: 98,  x2: 190, y2: 80,  color: '#42a5f5' },
    { id: 'e2',  x1: 290, y1: 80,  x2: 365, y2: 80,  color: '#7e57c2' },
    { id: 'e3',  x1: 475, y1: 80,  x2: 545, y2: 80,  color: '#ef5350' },
    { id: 'e4',  x1: 655, y1: 80,  x2: 715, y2: 80,  color: '#ff7043' },
    { id: 'e5',  x1: 770, y1: 98,  x2: 770, y2: 200, color: '#26c6da' },
    { id: 'e6',  x1: 770, y1: 238, x2: 660, y2: 220, color: '#66bb6a' },
    { id: 'e7',  x1: 545, y1: 220, x2: 465, y2: 300, color: '#4caf50' },
    { id: 'e8',  x1: 590, y1: 238, x2: 610, y2: 320, color: '#ffa726', dashed: true },
    { id: 'e9',  x1: 615, y1: 238, x2: 760, y2: 320, color: '#ef5350', dashed: true },
    // Cross-debate loop
    { id: 'e10', x1: 420, y1: 62,  x2: 420, y2: 30,  color: '#ef5350', dashed: true, weight: 1 },
    { id: 'e11', x1: 420, y1: 30,  x2: 240, y2: 30,  color: '#ef5350', dashed: true, weight: 1 },
    { id: 'e12', x1: 240, y1: 30,  x2: 240, y2: 62,  color: '#ef5350', dashed: true, weight: 1 },
  ]

  return { nodes, edges, width: W, height: H }
})

const causalityMatrix = [
  { cause: 'SessionStarted',         effect: 'AgentAnalysisStarted',   condition: 'x6 параллельно, один для каждого агента' },
  { cause: 'AgentAnalysisCompleted', effect: 'ArgumentRaised(OPENING)',  condition: 'Когда все 6 завершили анализ → фаза PRIMARY_POSITIONS' },
  { cause: 'ArgumentRaised(OPENING)',effect: 'ArgumentRaised(CHALLENGE)',condition: 'Когда все 6 позиций поданы → фаза CROSS_DEBATE' },
  { cause: 'ArgumentRaised(CHALLENGE)',effect:'ArgumentRaised(COUNTER)', condition: 'Другой агент (с P≥0.4) формирует контраргумент' },
  { cause: 'CROSS_DEBATE×3 rounds',  effect: 'ArgumentRaised(SUMMARY)', condition: 'Завершение 3 раундов → фаза FINAL_POSITIONS' },
  { cause: 'ArgumentRaised(SUMMARY)',effect: 'VotingStarted',            condition: 'Все 6 агентов дали SUMMARY → фаза VOTING' },
  { cause: 'VotingStarted',          effect: 'VoteCast',                 condition: 'Каждый агент вычисляет взвешенный скор + bias' },
  { cause: 'AllVotesCast',           effect: 'DecisionFormed',           condition: 'Агрегация (взвешенная сумма) → фаза SYNTHESIS' },
  { cause: 'DecisionFormed',         effect: 'HumanApprovalRequested',   condition: 'Всегда → фаза HUMAN_APPROVAL' },
  { cause: 'HumanApprovalRequested', effect: 'DecisionApproved',         condition: 'score ≥ 72 И председатель нажал "Утвердить"' },
  { cause: 'HumanApprovalRequested', effect: 'DecisionDeferred',         condition: 'score 50..71 ИЛИ нажал "Отложить"' },
  { cause: 'HumanApprovalRequested', effect: 'DecisionRejected',         condition: 'score < 50 ИЛИ нажал "Отклонить"' },
  { cause: 'Decision*',              effect: 'SessionConcluded',         condition: 'Любой из трёх терминальных вердиктов' },
]

// ── Agent Config (editable copies) ───────────────────────────

const agentConfigs = reactive(
  AGENTS.map(a => ({
    ...a,
    scoringWeights: { ...a.scoringWeights },
  }))
)

const totalAgentWeight = computed(() =>
  agentConfigs.reduce((s, a) => s + a.weight, 0)
)

function resetAgentConfigs() {
  AGENTS.forEach((orig, i) => {
    agentConfigs[i].weight = orig.weight
    agentConfigs[i].bias = orig.bias
    Object.keys(orig.scoringWeights).forEach(k => {
      agentConfigs[i].scoringWeights[k] = orig.scoringWeights[k]
    })
  })
}

// ── Simulator state ───────────────────────────────────────────
const PROJECTS_POOL = computed(() => PROJECTS_POOL_REF.value || [])
const selectedProjectId = ref(null)
const selectedSpeed = ref('normal')
const session = ref(null)
const timelineEl = ref(null)
let engine = null

const speedOptions = [
  { id: 'slow',   label: '1x' },
  { id: 'normal', label: '2.5x' },
  { id: 'fast',   label: '6x' },
]

const projectOptions = computed(() =>
  PROJECTS_POOL.map(p => ({
    label: `${p.title || p.name} (${((p.requestedAmount || 0) / 1e6).toFixed(0)} млн)`,
    value: p.id,
  }))
)

const visiblePhases = computed(() =>
  PHASE_ORDER.slice(1, -1).map(id => PHASES[id])
)

const phaseIdx = computed(() => {
  if (!session.value) return 0
  return PHASE_ORDER.slice(1, -1).indexOf(session.value.phase)
})

function agentById(id) { return AGENTS.find(a => a.id === id) }
function agentStatus(id) { return session.value?.agentStatus?.[id] || {} }
function argTypeLabel(t) {
  return { OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контр', SUMMARY: 'Итог' }[t] || t
}
function scoreColor(s) {
  return s >= 72 ? 'var(--fst-green)' : s >= 50 ? 'var(--fst-brand)' : 'var(--fst-red)'
}

function handleEvent() {
  if (session.value) session.value = { ...session.value }
  nextTick(() => {
    if (timelineEl.value) timelineEl.value.scrollTop = timelineEl.value.scrollHeight
  })
}

function startSession() {
  const project = PROJECTS_POOL.find(p => p.id === selectedProjectId.value)
  if (!project) return
  const sess = createSession(project, { speed: selectedSpeed.value })
  session.value = sess
  engine = new FstCommitteeEngine(sess, handleEvent)
  engine.start().catch(() => {})
}

function resetSession() {
  if (engine) engine.stop()
  engine = null
  session.value = null
  roundHistory.value = []
}

function humanDecide(verdict) {
  if (engine && session.value?.phase === 'HUMAN_APPROVAL') {
    engine.humanDecide(verdict, '', 'chair')
  }
}

// ── Recommendations & Revision ────────────────────────────────

const roundHistory = ref([])

const totalRevisionWeeks = computed(() => {
  if (!session.value?.recommendations) return 0
  return session.value.recommendations
    .filter(r => r.accepted)
    .reduce((s, r) => Math.max(s, r.weeks || 0), 0)
})

// Preview of dim scores after applying accepted recs
function revisionPreviewScore(dimKey) {
  const base = session.value?.dimScores?.[dimKey] || 0
  if (!session.value?.recommendations) return base
  // Compute improvement from accepted recs targeting this dim
  const improvement = session.value.recommendations
    .filter(r => r.accepted && r.metric === dimKey)
    .reduce((s, r) => s + (r.delta || 0), 0)
  return Math.min(1, base + improvement * 0.12)  // scaled
}

// Diff between original and revised project
const projectDiff = computed(() => {
  const orig = session.value?.project
  const rev = session.value?.revisedProject
  if (!orig || !rev) return []
  return [
    { label: 'TRL',          before: orig.trl,                       after: rev.trl,                       improved: rev.trl > orig.trl },
    { label: 'MRL',          before: orig.mrl,                       after: rev.mrl,                       improved: rev.mrl > orig.mrl },
    { label: 'Суверенность', before: `${orig.sovereigntyScore}/9`,   after: `${rev.sovereigntyScore}/9`,   improved: rev.sovereigntyScore > orig.sovereigntyScore },
    { label: 'IRR',          before: `${(orig.projectedIRR*100).toFixed(0)}%`, after: `${(rev.projectedIRR*100).toFixed(0)}%`, improved: rev.projectedIRR > orig.projectedIRR },
    { label: 'Команда',      before: `${(orig.teamStrength*100).toFixed(0)}%`, after: `${(rev.teamStrength*100).toFixed(0)}%`, improved: rev.teamStrength > orig.teamStrength },
  ]
})

// Predict next round score from revised project metrics
const predictedNextScore = computed(() => {
  const rev = session.value?.revisedProject
  if (!rev) return 0
  const { createSession: cs } = { createSession }
  const tempSess = createSession(rev, { speed: 'fast' })
  // Quick weighted sum approximation
  const ds = tempSess.dimScores
  const weights = { trl: 0.12, mrl: 0.10, sovereignty: 0.20, market: 0.12, finance: 0.18, risk: 0.15, team: 0.13 }
  const raw = Object.entries(weights).reduce((s, [k, w]) => s + (ds[k] || 0) * w, 0)
  return Math.min(99, Math.round(raw * 100) + 3)  // slight optimism after revision
})

function startRevision() {
  if (!engine || session.value?.phase !== 'RECOMMENDATIONS') return
  const acceptedIds = session.value.recommendations.filter(r => r.accepted).map(r => r.id)
  engine.startRevision(acceptedIds)
}

function startNextRound() {
  if (!engine || session.value?.phase !== 'READY_NEXT') return
  // Save current round to history
  roundHistory.value.push({
    sessionId: session.value.id,
    roundNumber: session.value.roundNumber,
    score: session.value.decision?.aggregatedScore || 0,
    verdict: session.value.decision?.recommendation || 'DEFER',
    recsApplied: session.value.recommendations.filter(r => r.accepted).length,
  })
  // Build new session
  const nextSess = engine.buildNextRoundSession()
  if (!nextSess) return
  if (engine) engine.stop()
  session.value = nextSess
  engine = new FstCommitteeEngine(nextSess, handleEvent)
  engine.start().catch(() => {})
}

onUnmounted(() => { if (engine) engine.stop() })

watch(() => session.value?.arguments?.length, () => {
  nextTick(() => {
    if (timelineEl.value) timelineEl.value.scrollTop = timelineEl.value.scrollHeight
  })
})
</script>

<style scoped>
/* ── Panel root ─────────────────────────────────────────────── */
.fst-panel {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Tabs ───────────────────────────────────────────────────── */
.fst-panel-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--p-surface-border, #2a2a2a);
  padding: 0 16px;
  flex-shrink: 0;
  background: var(--p-surface-section, #111);
}
.fst-tab-btn {
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--p-text-muted-color, #888);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}
.fst-tab-btn:hover { color: var(--p-text-color, #eee); }
.fst-tab-btn.active {
  border-bottom-color: #ffa726;
  color: #ffa726;
  font-weight: 600;
}

/* ── Tab content ────────────────────────────────────────────── */
.fst-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* ── Section titles ─────────────────────────────────────────── */
.fst-section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-text-muted-color, #888);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Ontology classes grid ──────────────────────────────────── */
.fst-onto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.fst-onto-card {
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-left: 3px solid;
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card, #111318);
}
.fst-onto-card-name {
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
  margin-bottom: 4px;
  color: var(--p-text-color, #e0e0e0);
}
.fst-onto-card-desc {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
  margin-bottom: 8px;
}
.fst-onto-card-props {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.fst-onto-prop {
  font-size: 10px;
  font-family: monospace;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--p-surface-hover, var(--p-surface-border, #1e2230));
  color: var(--p-text-secondary-color, #aaa);
}
.fst-onto-prop--more {
  color: var(--p-text-muted-color, #888);
  font-style: italic;
}

/* ── Relations ──────────────────────────────────────────────── */
.fst-relations-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fst-relation-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--p-surface-card, #111318);
}
.fst-rel-from { font-family: monospace; font-weight: 600; color: #42a5f5; }
.fst-rel-pred { color: var(--p-text-muted-color, #888); font-size: 11px; }
.fst-rel-to   { font-family: monospace; font-weight: 600; color: #66bb6a; }

/* ── Scoring dims grid ──────────────────────────────────────── */
.fst-dims-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.fst-dim-card {
  border: 1px solid;
  border-radius: 8px;
  padding: 10px 12px;
}
.fst-dim-label { font-size: 13px; font-weight: 700; }
.fst-dim-weight { font-size: 11px; color: var(--p-text-muted-color, #888); margin-top: 2px; }
.fst-dim-unit   { font-size: 11px; font-family: monospace; color: var(--p-text-muted-color, #aaa); }
.fst-dim-desc   { font-size: 11px; color: var(--p-text-muted-color, #888); margin-top: 4px; line-height: 1.4; }

/* ── Agents grid ────────────────────────────────────────────── */
.fst-agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.fst-agent-onto-card {
  border: 1px solid;
  border-radius: 10px;
  padding: 12px;
  background: var(--p-surface-card, #111318);
}
.fst-agent-onto-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}
.fst-agent-onto-emoji { font-size: 24px; flex-shrink: 0; }
.fst-agent-onto-name  { font-size: 13px; font-weight: 700; }
.fst-agent-onto-role  { font-size: 10px; color: var(--p-text-muted-color, #888); font-family: monospace; }
.fst-agent-onto-weight { margin-left: auto; font-size: 11px; color: var(--p-text-muted-color, #888); white-space: nowrap; }
.fst-agent-onto-desc  { font-size: 11px; color: var(--p-text-muted-color, #aaa); line-height: 1.4; margin-bottom: 8px; }
.fst-agent-onto-focus { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; font-size: 11px; color: var(--p-text-muted-color, #888); flex-wrap: wrap; }
.fst-focus-tag {
  font-size: 10px;
  font-family: monospace;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--p-surface-hover, var(--p-surface-border, #1e2230));
  color: var(--p-text-muted-color, #aaa);
}
.fst-agent-onto-scores { display: flex; flex-direction: column; gap: 3px; }
.fst-ascore-row { display: flex; align-items: center; gap: 5px; }
.fst-ascore-dim { font-size: 10px; color: var(--p-text-muted-color, #888); min-width: 65px; }
.fst-ascore-bar {
  flex: 1;
  height: 4px;
  background: var(--p-surface-hover, var(--p-surface-border, #1e2230));
  border-radius: 2px;
  overflow: hidden;
}
.fst-ascore-bar > div { height: 100%; border-radius: 2px; }
.fst-ascore-val { font-size: 10px; color: var(--p-text-muted-color, #888); min-width: 24px; text-align: right; }

/* ── Event groups ───────────────────────────────────────────── */
.fst-event-group { margin-bottom: 16px; }
.fst-event-group-title {
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-event-list { display: flex; flex-direction: column; gap: 4px; }
.fst-event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 4px;
  background: var(--p-surface-card, #111318);
}
.fst-event-type {
  font-family: monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.fst-event-desc { flex: 1; color: var(--p-text-muted-color, #aaa); }
.fst-event-terminal {
  font-size: 9px;
  font-weight: 700;
  color: #4caf50;
  border: 1px solid #4caf50;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* ── Phase chain ────────────────────────────────────────────── */
.fst-phase-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.fst-chain-item { display: flex; align-items: center; gap: 8px; }
.fst-chain-phase {
  border: 1px solid;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--p-surface-card, #111318);
}
.fst-chain-arrow { color: var(--p-text-muted-color, #555); font-size: 12px; }

/* ── Triggers table ─────────────────────────────────────────── */
.fst-triggers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.fst-triggers-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border, #2a2a2a);
  color: var(--p-text-muted-color, #888);
  font-size: 11px;
}
.fst-triggers-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border, var(--p-surface-border, #1e2230));
  vertical-align: top;
  color: var(--p-text-color, #ccc);
}
.fst-triggers-table code { font-family: monospace; font-size: 11px; color: #42a5f5; }

/* ── Requirements table ─────────────────────────────────────── */
.fst-req-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 8px;
}
.fst-req-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border, #2a2a2a);
  color: var(--p-text-muted-color, #888);
  font-size: 11px;
}
.fst-req-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border, var(--p-surface-border, #1e2230));
  color: var(--p-text-color, #ccc);
  vertical-align: top;
}
.fst-req-table code { font-family: monospace; color: #ffa726; font-size: 11px; }

/* ── Simulator tab ──────────────────────────────────────────── */
.fst-simulator-tab {
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fst-sim-wrapper { height: 100%; display: flex; flex-direction: column; }

/* Launch */
.fst-sim-launch {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
  padding-top: 24px;
}
.fst-sim-launch-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}
.fst-sim-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fst-sim-select-label { font-size: 12px; color: var(--p-text-muted-color, #888); white-space: nowrap; min-width: 60px; }
.fst-sim-select { flex: 1; }
.fst-speed-row { display: flex; gap: 6px; }
.fst-speed-btn {
  padding: 5px 10px;
  border: 1px solid #333;
  border-radius: 5px;
  cursor: pointer;
  font-size: 11px;
}
.fst-speed-btn.active { border-color: #42a5f5; color: #42a5f5; background: rgba(66,165,245,0.1); }

/* Session */
.fst-sim-session { display: flex; flex-direction: column; height: 100%; gap: 10px; }

/* Phase bar */
.fst-sim-phasebar {
  display: flex;
  gap: 0;
  align-items: flex-start;
  overflow-x: auto;
  flex-shrink: 0;
  padding-bottom: 4px;
}
.fst-sim-phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  position: relative;
  min-width: 80px;
}
.fst-sim-phase:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 6px;
  left: calc(50% + 7px);
  right: calc(-50% + 7px);
  height: 1px;
  background: var(--p-surface-border, #2a2a2a);
}
.fst-sim-phase.done::after { background: #42a5f5; }
.fst-sim-phase-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 1.5px solid;
  display: flex; align-items: center; justify-content: center;
  z-index: 1;
  background: var(--p-surface-ground, #0f1117);
}
.fst-sim-phase-label {
  font-size: 9px;
  color: var(--p-text-muted-color, #666);
  text-align: center;
  max-width: 72px;
  line-height: 1.2;
}
.fst-sim-phase.active .fst-sim-phase-label { color: #fff; font-weight: 600; }

/* 3-col layout */
.fst-sim-layout {
  display: grid;
  grid-template-columns: 140px 1fr 200px;
  gap: 8px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
.fst-sim-col-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #666);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--p-surface-border, #1e2230);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Agents col */
.fst-sim-agents {
  overflow-y: auto;
  border: 1px solid var(--p-surface-border, #1e2230);
  border-radius: 8px;
  padding: 8px;
}
.fst-sim-agent {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 5px 4px;
  border-radius: 5px;
  border: 1px solid transparent;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.fst-sim-agent.thinking { border-color: var(--ac); }
.fst-sim-agent-emoji { font-size: 14px; }
.fst-sim-agent-info { flex: 1; min-width: 0; }
.fst-sim-agent-name { font-size: 10px; font-weight: 600; }
.fst-sim-think {
  font-size: 9px; color: #42a5f5; font-style: italic;
  display: flex; align-items: center; gap: 3px; margin-top: 2px;
}
.fst-sim-vote-badge {
  font-size: 9px; padding: 1px 4px; border-radius: 3px; color: #fff; margin-top: 2px;
  display: inline-block;
}
.fst-sim-ready { font-size: 9px; color: #4caf50; margin-top: 2px; display: flex; align-items: center; gap: 2px; }

/* Timeline col */
.fst-sim-timeline-col {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-surface-border, #1e2230);
  border-radius: 8px;
  padding: 8px;
}
.fst-sim-loading { margin-bottom: 8px; }
.fst-sim-load-row {
  display: flex; align-items: center; gap: 6px; margin-bottom: 5px; font-size: 12px;
}
.fst-sim-load-bar {
  flex: 1; height: 4px; background: var(--p-surface-hover, var(--p-surface-border, #1e2230)); border-radius: 2px; overflow: hidden;
}
.fst-sim-load-bar > div { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.fst-sim-args { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.fst-sim-arg {
  border: 1px solid var(--p-surface-border, #1e2230);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--p-surface-ground, #0d1018);
}
.fst-sim-arg.counter { margin-left: 14px; border-left: 2px solid #7e57c2; }
.fst-sim-arg.type-challenge { border-color: rgba(239,83,80,0.3); }
.fst-sim-arg.type-summary  { border-color: rgba(102,187,106,0.2); }
.fst-sim-arg-hdr { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
.fst-sim-arg-type {
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  background: var(--p-surface-hover, var(--p-surface-border, #1e2230)); color: var(--p-text-muted-color, #888);
}
.fst-sim-arg-text { font-size: 11px; line-height: 1.5; color: var(--p-text-color, #ccc); }
.fst-sim-votes-block {
  border: 1px solid var(--p-surface-border, #1e2230); border-radius: 6px; padding: 8px; background: var(--p-surface-ground, #0d1018); margin-top: 8px;
}
.fst-sim-votes-title {
  font-size: 10px; font-weight: 600; color: #26c6da; margin-bottom: 6px;
  display: flex; align-items: center; gap: 4px;
}
.fst-sim-vote-row {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 11px;
}
.fst-sim-vote-pill { font-size: 9px; padding: 1px 6px; border-radius: 3px; color: #fff; }

/* Score col */
.fst-sim-score-col {
  overflow-y: auto;
  border: 1px solid var(--p-surface-border, #1e2230);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-sim-dim-bars { display: flex; flex-direction: column; gap: 5px; }
.fst-sim-dim-row { display: flex; align-items: center; gap: 5px; }
.fst-sim-dim-label { font-size: 10px; color: var(--p-text-muted-color, #888); min-width: 55px; }
.fst-sim-dim-bg {
  flex: 1; height: 5px; background: var(--p-surface-hover, var(--p-surface-border, #1e2230)); border-radius: 2px; overflow: hidden;
}
.fst-sim-dim-bg > div { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.fst-sim-decision { text-align: center; padding: 10px; border: 1px solid var(--p-surface-border, #1e2230); border-radius: 8px; }
.fst-sim-score-val { font-size: 32px; font-weight: 700; }
.fst-sim-score-val small { font-size: 12px; opacity: 0.5; }
.fst-sim-rec {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 12px; border-radius: 12px; color: #fff; font-size: 11px; font-weight: 600;
  margin-top: 6px;
}
.fst-sim-human { padding: 8px; border: 1px solid rgba(255,167,38,0.3); border-radius: 8px; }
.fst-sim-human-btns { display: flex; flex-direction: column; gap: 5px; }
.fst-sim-human-btns .p-button { font-size: 11px; }
.fst-sim-concluded { text-align: center; padding: 16px; color: #4caf50; font-size: 13px; }
.fst-sim-concluded > div { margin-top: 8px; }

/* Controls */
.fst-sim-controls { flex-shrink: 0; padding-top: 6px; }

/* Arg animation */
.fst-arg-anim-enter-active { transition: all 0.3s ease; }
.fst-arg-anim-enter-from   { opacity: 0; transform: translateY(8px); }

/* ── Recommendations Panel ──────────────────────────────────── */
.fst-recs-panel {
  margin-top: 10px;
  border: 1px solid rgba(171,71,188,0.3);
  border-radius: 10px;
  padding: 12px;
  background: rgba(171,71,188,0.05);
  flex-shrink: 0;
  max-height: 420px;
  overflow-y: auto;
}
.fst-recs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 10px;
}
.fst-recs-title {
  font-size: 12px;
  font-weight: 700;
  color: #ab47bc;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-round-pill {
  font-size: 10px;
  background: rgba(171,71,188,0.2);
  color: #ab47bc;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 4px;
}
.fst-recs-verdict {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  padding: 3px 10px;
  border-radius: 10px;
  flex-shrink: 0;
}
.fst-recs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-rec-card {
  display: flex;
  gap: 10px;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-left: 3px solid var(--rec-color, #ab47bc);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--p-surface-card, #111318);
  opacity: 0.7;
  transition: opacity 0.15s;
}
.fst-rec-card--checked { opacity: 1; }
.fst-rec-card-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.fst-rec-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #ab47bc;
}
.fst-rec-avatar { font-size: 14px; }
.fst-rec-body { flex: 1; min-width: 0; }
.fst-rec-header-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}
.fst-rec-priority {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}
.priority-critical { background: rgba(239,83,80,0.2);  color: #ef5350; }
.priority-high     { background: rgba(255,167,38,0.2); color: #ffa726; }
.priority-medium   { background: rgba(102,187,106,0.2);color: #66bb6a; }
.priority-low      { background: rgba(120,144,156,0.2);color: #78909c; }
.fst-rec-effort { font-size: 10px; color: var(--p-text-muted-color, #888); }
.fst-rec-owner  { font-size: 10px; color: var(--p-text-muted-color, #888); margin-left: auto; }
.fst-rec-text {
  font-size: 11px;
  line-height: 1.5;
  color: var(--p-text-color, #ccc);
  margin-bottom: 5px;
}
.fst-rec-metric {
  font-size: 10px;
  color: var(--p-text-muted-color, #888);
  display: flex;
  align-items: center;
  gap: 5px;
}
.fst-rec-delta {
  font-size: 10px;
  font-weight: 700;
  color: #4caf50;
  background: rgba(76,175,80,0.15);
  padding: 1px 4px;
  border-radius: 3px;
}
.fst-recs-summary {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 8px;
  background: var(--p-surface-section, #111);
}
.fst-recs-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
  margin-bottom: 4px;
}
.fst-recs-summary-row strong { color: var(--p-text-color, #eee); }

/* ── Revision Animation ──────────────────────────────────────── */
.fst-revision-anim {
  padding: 12px;
}
.fst-revision-title {
  font-size: 12px;
  font-weight: 600;
  color: #26a69a;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-revision-progress-bar {
  height: 6px;
  background: var(--p-surface-border, #2a2a2a);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.fst-revision-progress-bar > div {
  height: 100%;
  background: #26a69a;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.fst-revision-step {
  font-size: 11px;
  color: #26a69a;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-style: italic;
}
.fst-revision-metrics { display: flex; flex-direction: column; gap: 5px; }
.fst-rev-metric-row { display: flex; align-items: center; gap: 6px; }
.fst-rev-metric-label { font-size: 10px; color: var(--p-text-muted-color, #888); min-width: 70px; }
.fst-rev-metric-bar {
  flex: 1;
  height: 8px;
  background: var(--p-surface-border, #2a2a2a);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.fst-rev-bar-old {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  border-radius: 4px;
}
.fst-rev-bar-new {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  border-radius: 4px;
}

/* ── Ready Next ──────────────────────────────────────────────── */
.fst-ready-next { padding: 4px 0; }
.fst-ready-title {
  font-size: 12px;
  font-weight: 600;
  color: #26a69a;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 10px;
}
.fst-diff-table th {
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px solid var(--p-surface-border, #2a2a2a);
  color: var(--p-text-muted-color, #888);
  font-size: 10px;
}
.fst-diff-table td { padding: 4px 8px; border-bottom: 1px solid var(--p-surface-border, #1e2230); }
.fst-diff-old  { color: var(--p-text-muted-color, #888); }
.fst-diff-arrow { text-align: center; }
.fst-diff-new  { font-weight: 600; }
.fst-predicted-score {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
  padding: 8px;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 8px;
  background: var(--p-surface-card, #111318);
  margin-bottom: 8px;
}
.fst-predicted-score strong { font-size: 20px; font-weight: 700; }
.fst-score-delta {
  font-size: 12px;
  font-weight: 700;
  background: rgba(76,175,80,0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ── Rounds History ──────────────────────────────────────────── */
.fst-rounds-history {
  margin-top: 10px;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--p-surface-section, #111);
  flex-shrink: 0;
}
.fst-rounds-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #888);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  letter-spacing: 0.5px;
}
.fst-round-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--p-surface-border, #1e2230);
}
.fst-round-row:last-child { border-bottom: none; }
.fst-round-row--current { opacity: 0.8; }
.fst-round-num {
  font-size: 10px;
  font-weight: 700;
  color: var(--p-text-muted-color, #888);
  min-width: 22px;
}
.fst-round-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.fst-round-score { font-size: 13px; font-weight: 700; }
.fst-round-verdict { font-size: 10px; }
.fst-round-arrow { color: var(--p-text-muted-color, #555); font-size: 12px; }
.fst-round-badge {
  font-size: 10px;
  color: #ffa726;
  background: rgba(255,167,38,0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ── Causality Graph ────────────────────────────────────────── */
.fst-causal-svg-wrap {
  position: relative;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 10px;
  overflow: hidden;
  background: var(--p-surface-50, #f8f8f8);
}
.fst-causal-svg {
  width: 100%;
  height: 300px;
  display: block;
}
.causal-node rect { transition: opacity 0.15s; }
.causal-node--active rect { filter: brightness(1.3); }
.fst-causal-tooltip {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: var(--p-surface-overlay, rgba(0,0,0,0.85));
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--p-text-color, #eee);
  pointer-events: none;
  max-width: 280px;
}
.fst-causal-tooltip strong { display: block; margin-bottom: 3px; color: #ffa726; }
.fst-causal-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.fst-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
}
.fst-legend-line {
  display: inline-block;
  width: 24px;
  height: 2px;
  border-radius: 1px;
  border-style: solid;
  border-width: 1px;
}

/* ── Agent Config ────────────────────────────────────────────── */
.fst-agent-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.fst-ac-card {
  border: 1px solid;
  border-radius: 10px;
  padding: 12px;
  background: var(--p-surface-card, #111318);
}
.fst-ac-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.fst-ac-emoji { font-size: 22px; flex-shrink: 0; }
.fst-ac-meta  { flex: 1; }
.fst-ac-name  { font-size: 13px; font-weight: 700; }
.fst-ac-role  { font-size: 10px; color: var(--p-text-muted-color, #888); font-family: monospace; margin-top: 2px; }
.fst-ac-bias-select { align-self: center; }
.fst-bias-select {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid var(--p-surface-border, #333);
  background: var(--p-surface-hover, #1e2230);
  color: var(--p-text-color, #ccc);
  cursor: pointer;
}
.fst-ac-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.fst-ac-label {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
  min-width: 70px;
}
.fst-ac-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
}
.fst-ac-val {
  font-size: 11px;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  color: var(--p-text-color, #ccc);
}
.fst-ac-dims-title {
  font-size: 10px;
  color: var(--p-text-muted-color, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 8px 0 5px;
}
.fst-ac-dim-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.fst-ac-dim-label {
  font-size: 10px;
  color: var(--p-text-muted-color, #888);
  min-width: 65px;
}
.fst-ac-desc {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
  line-height: 1.4;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--p-surface-border, #1e2230);
}
.fst-ac-validation {
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid var(--p-surface-border, #2a2a2a);
  border-radius: 8px;
  background: var(--p-surface-card, #111318);
}
.fst-ac-val-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--p-text-muted-color, #aaa);
}

/* ── Gift Fund / Open Source ──────────────────────────── */
.gift-thesis-banner {
  background: linear-gradient(135deg, rgba(233,30,99,0.08), rgba(0,188,212,0.08));
  border: 1px solid rgba(233,30,99,0.2);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.gift-thesis-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--p-text-color);
}
.gift-graph-wrap {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}
.gift-graph-svg { width: 100%; height: auto; }
.gift-graph-node { cursor: pointer; }
.gift-graph-node:hover circle { stroke-width: 3; fill-opacity: 0.4; }
.gift-graph-node-selected { stroke-width: 3 !important; fill-opacity: 0.5 !important; }

.gift-loading { text-align: center; padding: 20px; color: var(--p-text-muted-color); font-size: 12px; }
.gift-portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}
.gift-project-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: var(--p-primary-color); }
  &.gift-project-selected {
    border-color: var(--fst-purple);
    background: color-mix(in srgb, var(--fst-purple) 6%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--fst-purple) 20%, transparent);
  }
}
.gift-project-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.gift-project-name { font-size: 11px; font-weight: 600; color: var(--p-text-color); }
.gift-project-subfund { font-size: 9px; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--fst-blue) 12%, transparent); color: var(--fst-blue); }
.gift-project-metrics { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.gift-pm { font-size: 10px; font-weight: 600; }
.gift-project-dar { display: flex; gap: 4px; align-items: center; }
.gift-dar-label { font-size: 9px; color: var(--p-text-muted-color); }
.gift-dar-value { font-size: 10px; font-weight: 700; }

.gift-questions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.gift-q-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 14px;
  position: relative;
}
.gift-q-num {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 28px;
  font-weight: 800;
  opacity: 0.1;
  color: var(--p-text-color);
}
.gift-q-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--p-text-color);
}
.gift-q-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}
.gift-agents-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.gift-agent-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 16px;
}
.gift-agent-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.gift-agent-emoji { font-size: 24px; }
.gift-agent-name { font-size: 14px; font-weight: 600; color: var(--p-text-color); }
.gift-agent-role { font-size: 11px; color: var(--p-text-muted-color); font-family: monospace; }
.gift-agent-desc { font-size: 12px; color: var(--p-text-muted-color); margin-bottom: 10px; line-height: 1.5; }
.gift-agent-rules { display: flex; flex-direction: column; gap: 4px; }
.gift-rule {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
}
.gift-rule--green { background: rgba(76,175,80,0.12); color: #2e7d32; }
.gift-rule--yellow { background: rgba(255,167,38,0.12); color: #e65100; }
.gift-rule--red { background: rgba(239,83,80,0.12); color: #c62828; }

.gift-analyzer {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
}
.gift-analyzer-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gift-form-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gift-form-row label {
  font-size: 11px;
  color: var(--p-text-muted-color);
}
.gift-input {
  background: var(--p-form-field-background);
  border: 1px solid var(--p-form-field-border-color);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--p-text-color);
  outline: none;
}
.gift-input:focus {
  border-color: #e91e63;
}
.gift-analyze-btn {
  margin-top: 8px;
  background: linear-gradient(135deg, #e91e63, #9c27b0);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.2s;
}
.gift-analyze-btn:hover { opacity: 0.85; }

.gift-result {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 16px;
}
.gift-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.gift-result-verdict {
  font-size: 18px;
  font-weight: 800;
  padding: 4px 14px;
  border-radius: 6px;
}
.verdict-approve { background: rgba(76,175,80,0.15); color: #2e7d32; }
.verdict-defer { background: rgba(255,167,38,0.15); color: #e65100; }
.verdict-reject { background: rgba(239,83,80,0.15); color: #c62828; }
.gift-result-layer {
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-color);
}
.gift-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.gift-metric {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 10px;
}
.gift-metric-label { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 4px; }
.gift-metric-value { font-size: 14px; font-weight: 600; color: var(--p-text-color); }
.gift-metric-bar {
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}
.gift-metric-bar > div {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}
.gift-observations { margin-bottom: 12px; }
.gift-obs-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.gift-obs-item {
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 3px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.gift-signal-item {
  font-size: 11px;
  color: #c62828;
  padding: 3px 0;
}
.gift-compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.gift-compare-card {
  border-radius: 10px;
  padding: 14px;
}
.gift-compare--bad {
  background: rgba(239,83,80,0.06);
  border: 1px solid rgba(239,83,80,0.2);
}
.gift-compare--good {
  background: rgba(76,175,80,0.06);
  border: 1px solid rgba(76,175,80,0.2);
}
.gift-compare-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--p-text-color);
}
.gift-compare-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  padding: 3px 0;
  color: var(--p-text-muted-color);
}
.gift-compare-row span:first-child { font-weight: 500; }
</style>

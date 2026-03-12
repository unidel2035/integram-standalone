<!--
  GrEventCanvas — событийный канвас GR-работы
  Компания → барьеры-боссы → цель (выход на рынок)
  Сценарии обходят барьеры. Задача — провести компанию к цели.
  Движок: force-directed layout, pan/zoom, SVG particles — адаптация CausalGraphCanvas.
-->
<template>
  <div class="ec-root">

    <!-- ── HUD ─────────────────────────────────────────────────────── -->
    <div class="ec-hud">
      <div class="ec-hud-title">
        <span class="ec-hud-bracket">[</span>
        GR КАНВАС
        <span class="ec-hud-bracket">]</span>
      </div>
      <div class="ec-hud-stats">
        <span class="ec-hud-dot-blink">●</span>
        <span>{{ nodes.length }} узлов</span>
        <span class="ec-dim">{{ edges.length }} связей</span>
        <span class="ec-dim">{{ Math.round(zoom * 100) }}%</span>
        <span v-if="irrMultiplier > 1" class="ec-hud-irr">IRR {{ irrMultiplier }}x</span>
      </div>
      <div class="ec-hud-acts">
        <button class="ec-hud-btn" @click="fitAll()"><i class="pi pi-expand"/></button>
        <button class="ec-hud-btn" @click="zoomBy(0.8)"><i class="pi pi-minus"/></button>
        <button class="ec-hud-btn" @click="zoomBy(1.25)"><i class="pi pi-plus"/></button>
        <button class="ec-hud-btn ec-hud-btn--danger" @click="rebuildGraph()"><i class="pi pi-refresh"/></button>
      </div>
    </div>

    <!-- ── Body ───────────────────────────────────────────────────── -->
    <div class="ec-body">

      <!-- SVG canvas -->
      <div class="ec-canvas" ref="canvasWrapEl">
        <svg class="ec-svg" ref="svgEl"
          @wheel.prevent="onWheel"
          @mousedown="onPanStart"
          @mousemove="onPanMove"
          @mouseup="onPanEnd"
          @mouseleave="onPanEnd"
        >
          <defs>
            <filter id="ec-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="ec-glow-sm" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="ec-rg-dark" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stop-color="#0f1e2e"/>
              <stop offset="100%" stop-color="#060d14"/>
            </radialGradient>
            <radialGradient id="ec-rg-goal" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stop-color="#2a2010"/>
              <stop offset="100%" stop-color="#0d0a04"/>
            </radialGradient>
            <!-- per-edge gradient -->
            <linearGradient
              v-for="edge in edges" :key="`eg-${edge.id}`"
              :id="`ec-grad-${edge.id}`" gradientUnits="userSpaceOnUse"
              :x1="nodeById(edge.sourceId)?.x || 0"
              :y1="nodeById(edge.sourceId)?.y || 0"
              :x2="nodeById(edge.targetId)?.x || 0"
              :y2="nodeById(edge.targetId)?.y || 0"
            >
              <stop offset="0%"   :stop-color="nodeColor(edge.sourceId)" stop-opacity="0.7"/>
              <stop offset="100%" :stop-color="nodeColor(edge.targetId)" stop-opacity="0.7"/>
            </linearGradient>
            <marker id="ec-arrow" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0,6 2.5,0 5" fill="#88aacc" opacity="0.6"/>
            </marker>
            <marker id="ec-arrow-red" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0,6 2.5,0 5" fill="#ef4444" opacity="0.7"/>
            </marker>
            <marker id="ec-arrow-green" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0,6 2.5,0 5" fill="#22c55e" opacity="0.7"/>
            </marker>
          </defs>

          <g :transform="`translate(${pan.x},${pan.y}) scale(${zoom})`">

            <!-- Tactical grid -->
            <g opacity="0.025">
              <line v-for="xi in 60" :key="`gx${xi}`"
                :x1="(xi-30)*80" y1="-3000" :x2="(xi-30)*80" y2="3000"
                stroke="#88aacc" stroke-width="0.5"/>
              <line v-for="yi in 50" :key="`gy${yi}`"
                x1="-3000" :y1="(yi-25)*80" x2="3000" :y2="(yi-25)*80"
                stroke="#88aacc" stroke-width="0.5"/>
            </g>

            <!-- ── Edges ─────────────────────────────────────────── -->
            <!-- Edge glow -->
            <path v-for="edge in edges" :key="`eg-${edge.id}`"
              :d="edgePath(edge)" fill="none"
              :stroke="`url(#ec-grad-${edge.id})`"
              stroke-width="4" stroke-opacity="0.05"
              filter="url(#ec-glow)"
            />
            <!-- Edge line -->
            <path v-for="edge in edges" :key="`el-${edge.id}`"
              :d="edgePath(edge)" fill="none"
              :stroke="`url(#ec-grad-${edge.id})`"
              :stroke-width="edge.weight || 1.2"
              :stroke-opacity="edge.defeated ? 0.15 : 0.55"
              :stroke-dasharray="edge.dashed ? '6 4' : edge.defeated ? '3 6' : ''"
              :marker-end="edgeArrow(edge)"
              class="ec-edge-dash"
            />
            <!-- Edge label -->
            <text v-for="edge in edges.filter(e=>e.label)" :key="`etl-${edge.id}`"
              :x="edgeMidX(edge)" :y="edgeMidY(edge) - 8"
              text-anchor="middle" font-size="7" fill="#88aacc" opacity="0.5"
              pointer-events="none">{{ edge.label }}</text>
            <!-- Particle -->
            <circle v-for="edge in edges.filter(e => !e.defeated)" :key="`ep-${edge.id}`"
              r="2"
              :fill="nodeColor(edge.sourceId)"
              filter="url(#ec-glow-sm)"
              opacity="0.75"
            >
              <animateMotion
                :dur="`${(edgeLen(edge)/110).toFixed(1)}s`"
                repeatCount="indefinite"
                :path="edgePath(edge)"
              />
            </circle>

            <!-- ── Nodes ─────────────────────────────────────────── -->
            <g
              v-for="node in nodes" :key="node.id"
              :transform="`translate(${node.x},${node.y})`"
              class="ec-node-g"
              @mouseenter="hoveredId = node.id"
              @mouseleave="hoveredId = null"
              @click.stop="selectNode(node)"
            >
              <!-- Reticle when selected -->
              <g v-if="selectedId === node.id">
                <circle r="60" :stroke="node.color" stroke-width="0.5"
                  stroke-dasharray="5 4" fill="none" opacity="0.2" class="ec-spin"/>
                <line x1="-95" y1="0" x2="-42" y2="0" :stroke="node.color" stroke-width="0.5" opacity="0.3"/>
                <line x1="42"  y1="0" x2="95"  y2="0" :stroke="node.color" stroke-width="0.5" opacity="0.3"/>
                <line x1="0" y1="-95" x2="0"  y2="-42" :stroke="node.color" stroke-width="0.5" opacity="0.3"/>
                <line x1="0" y1="42"  x2="0"  y2="95"  :stroke="node.color" stroke-width="0.5" opacity="0.3"/>
              </g>

              <!-- Hover pulse -->
              <circle v-if="hoveredId === node.id" r="42"
                :fill="`${node.color}0a`"
                :stroke="node.color" stroke-width="0.7"
                filter="url(#ec-glow-sm)" class="ec-pulse"/>

              <!-- Dial ring -->
              <circle :r="node.r || 34" fill="none"
                :stroke="node.color"
                :stroke-width="hoveredId === node.id || selectedId === node.id ? 1.5 : 0.7"
                :stroke-dasharray="node.defeated ? '2 5' : ''"
                :opacity="node.defeated ? 0.2 : hoveredId === node.id ? 0.85 : 0.35"
                :filter="hoveredId === node.id ? 'url(#ec-glow-sm)' : 'none'"
              />
              <!-- Tick marks -->
              <line v-for="t in 16" :key="`t${t}`"
                :x1="ptX((t-1)*22.5, (node.r||34)-4)"   :y1="ptY((t-1)*22.5, (node.r||34)-4)"
                :x2="ptX((t-1)*22.5, node.r||34)" :y2="ptY((t-1)*22.5, node.r||34)"
                :stroke="node.color" stroke-width="0.6" :opacity="node.defeated ? 0.1 : 0.25"
              />

              <!-- Node body -->
              <circle :r="(node.r||34) - 4"
                :fill="node.kind === 'goal' ? 'url(#ec-rg-goal)' : 'url(#ec-rg-dark)'"
                :stroke="node.color"
                stroke-width="1.5"
                :filter="hoveredId===node.id ? 'url(#ec-glow)' : 'url(#ec-glow-sm)'"
                :opacity="node.defeated ? 0.35 : 1"
              />

              <!-- HP bar for boss nodes -->
              <g v-if="node.kind === 'boss' && !node.defeated">
                <rect :x="-(node.r||34)+6" :y="(node.r||34)-10"
                  :width="(node.r||34)*2 - 12" height="4"
                  fill="#ffffff10" rx="2"/>
                <rect :x="-(node.r||34)+6" :y="(node.r||34)-10"
                  :width="((node.r||34)*2 - 12) * node.hpPct / 100" height="4"
                  :fill="node.color" rx="2"
                  style="transition: width 0.7s ease"
                />
              </g>

              <!-- Defeated cross -->
              <g v-if="node.defeated">
                <line :x1="-(node.r||34)*0.5" :y1="-(node.r||34)*0.5"
                      :x2="(node.r||34)*0.5"  :y2="(node.r||34)*0.5"
                      stroke="#22c55e" stroke-width="2" opacity="0.5"/>
                <line :x1="(node.r||34)*0.5"  :y1="-(node.r||34)*0.5"
                      :x2="-(node.r||34)*0.5" :y2="(node.r||34)*0.5"
                      stroke="#22c55e" stroke-width="2" opacity="0.5"/>
              </g>

              <!-- Label below -->
              <text :y="(node.r||34) + 14" text-anchor="middle"
                font-size="8.5" font-weight="700" letter-spacing="0.06em"
                :fill="node.color" :opacity="node.defeated ? 0.3 : 0.85"
                pointer-events="none">
                {{ node.label.toUpperCase() }}
              </text>
              <text v-if="node.sublabel" :y="(node.r||34) + 25" text-anchor="middle"
                font-size="7" :fill="node.color" opacity="0.45" pointer-events="none">
                {{ node.sublabel }}
              </text>
            </g>

          </g><!-- /transform -->
        </svg>

        <!-- HTML icon overlay -->
        <div class="ec-overlay" aria-hidden="true">
          <div v-for="node in nodes" :key="`ic-${node.id}`"
            class="ec-node-ic"
            :style="{ left: screenX(node) + 'px', top: screenY(node) + 'px',
                      fontSize: Math.max(9, Math.min(20, 15 * zoom)) + 'px',
                      opacity: node.defeated ? 0.3 : 1 }"
          >{{ node.emoji }}</div>
        </div>

        <!-- Zoom controls FAB -->
        <div class="ec-fab" @click.stop>
          <button class="ec-fab-btn" @click="zoomBy(0.8)"><i class="pi pi-minus"/></button>
          <button class="ec-fab-zoom" @click="resetZoom()">{{ Math.round(zoom*100) }}%</button>
          <button class="ec-fab-btn" @click="zoomBy(1.25)"><i class="pi pi-plus"/></button>
          <div class="ec-fab-sep"/>
          <button class="ec-fab-btn ec-fab-fit" @click="fitAll()"><i class="pi pi-expand"/></button>
        </div>

        <!-- Hint overlay -->
        <div v-if="!selectedId" class="ec-hint">
          <i class="pi pi-share-alt" style="font-size:1.3rem;opacity:0.35"/>
          <div>Нажмите на узел для деталей · Скролл для зума · Тащите для перемещения</div>
        </div>
      </div>

      <!-- ── Side panel ─────────────────────────────────────────── -->
      <Transition name="ec-slide">
        <div v-if="selectedNode" class="ec-panel" @click.stop>
          <button class="ec-panel-close" @click="selectedId = null">×</button>

          <!-- COMPANY panel -->
          <template v-if="selectedNode.kind === 'company'">
            <div class="ec-panel-head" :style="{ borderColor: selectedNode.color }">
              <span class="ec-panel-emoji">{{ selectedNode.emoji }}</span>
              <div>
                <div class="ec-panel-title">{{ selectedNode.label }}</div>
                <div class="ec-panel-sub">{{ company?.stage }} · TRL {{ company?.trl }}</div>
              </div>
            </div>
            <div class="ec-panel-stats">
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" :style="{ color: company?.runway <= 6 ? '#ef4444' : '#22c55e' }">
                  {{ company?.runway }}
                </span>
                <span class="ec-panel-stat-lbl">мес runway</span>
              </div>
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" :style="{ color: '#f59e0b' }">{{ irrMultiplier }}x</span>
                <span class="ec-panel-stat-lbl">IRR фонда</span>
              </div>
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val">{{ defeatedCount }}/{{ bossCount }}</span>
                <span class="ec-panel-stat-lbl">барьеров</span>
              </div>
            </div>
            <div class="ec-panel-hint">
              Нажмите на красные узлы-барьеры чтобы атаковать их,
              или на зелёные сценарии чтобы применить GR-стратегию.
            </div>
          </template>

          <!-- BOSS panel -->
          <template v-else-if="selectedNode.kind === 'boss'">
            <div class="ec-panel-head" :style="{ borderColor: selectedNode.color }">
              <span class="ec-panel-emoji">{{ selectedNode.emoji }}</span>
              <div>
                <div class="ec-panel-title">{{ selectedNode.label }}</div>
                <div class="ec-panel-sub">{{ selectedNode.boss?.subtitle }}</div>
              </div>
            </div>
            <div v-if="!selectedNode.defeated">
              <!-- HP -->
              <div class="ec-panel-hp">
                <div class="ec-panel-hp-row">
                  <span class="ec-panel-hp-lbl">HP</span>
                  <span class="ec-panel-hp-val" :style="{ color: selectedNode.color }">
                    {{ selectedNode.state?.currentHp }} / {{ selectedNode.state?.maxHp }}
                  </span>
                </div>
                <div class="ec-panel-hp-track">
                  <div class="ec-panel-hp-fill"
                    :style="{ width: selectedNode.hpPct + '%', background: selectedNode.color }" />
                </div>
              </div>
              <!-- Lore -->
              <div class="ec-panel-lore">{{ selectedNode.boss?.lore }}</div>

              <!-- Barrier concept model -->
              <template v-if="BOSS_CONCEPTS[selectedNode.boss?.id]">
                <div class="ec-panel-section-title">Концепт барьера</div>
                <div class="ec-concept-grid">
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">Сейчас</span>
                    <span class="ec-concept-val">{{ BOSS_CONCEPTS[selectedNode.boss.id].currentState }}</span>
                  </div>
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">Нужно</span>
                    <span class="ec-concept-val ec-concept-val--need">{{ BOSS_CONCEPTS[selectedNode.boss.id].needed }}</span>
                  </div>
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">Актор</span>
                    <span class="ec-concept-val">{{ BOSS_CONCEPTS[selectedNode.boss.id].actor }}</span>
                  </div>
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">GR-рычаг</span>
                    <span class="ec-concept-val ec-concept-val--lever">{{ BOSS_CONCEPTS[selectedNode.boss.id].grLever }}</span>
                  </div>
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">Блок-путь</span>
                    <span class="ec-concept-val ec-concept-val--block">{{ BOSS_CONCEPTS[selectedNode.boss.id].blockPath }}</span>
                  </div>
                  <div class="ec-concept-row">
                    <span class="ec-concept-key">Горизонт</span>
                    <span class="ec-concept-val">{{ BOSS_CONCEPTS[selectedNode.boss.id].timeline }}</span>
                  </div>
                </div>
                <!-- Event chain that defeats this barrier -->
                <div class="ec-concept-chain">
                  <span v-for="(ev, i) in BOSS_CONCEPTS[selectedNode.boss.id].eventChain" :key="ev"
                    class="ec-concept-chain-step"
                    :class="{ 'ec-concept-chain-step--done': appliedEventTypes.has(ev) }">
                    <span v-if="i > 0" class="ec-concept-chain-arrow">→</span>
                    {{ ev.replace(/_/g, ' ') }}
                  </span>
                </div>
              </template>

              <!-- Attacks -->
              <div class="ec-panel-section-title">Атаки</div>
              <div class="ec-panel-attacks">
                <button
                  v-for="atk in attacksForBoss(selectedNode.boss)"
                  :key="atk.type"
                  class="ec-atk-btn"
                  :class="{ 'ec-atk-btn--done': selectedNode.state?.attacksDone?.has(atk.type) }"
                  :disabled="selectedNode.state?.attacksDone?.has(atk.type)"
                  @click="handleAttack(atk)"
                >
                  <i :class="atk.icon" style="font-size:11px"/>
                  <span>{{ atk.label }}</span>
                  <span class="ec-atk-dmg">{{ atk.damage }} дмг</span>
                </button>
              </div>
            </div>
            <div v-else class="ec-panel-defeated">
              <div class="ec-panel-defeated-icon">🏆</div>
              <div class="ec-panel-defeated-text">{{ selectedNode.boss?.defeatText }}</div>
              <div class="ec-panel-rewards">
                <span v-for="r in selectedNode.boss?.rewards" :key="r" class="ec-reward-tag">{{ r }}</span>
              </div>
            </div>
          </template>

          <!-- SCENARIO panel -->
          <template v-else-if="selectedNode.kind === 'scenario'">
            <div class="ec-panel-head" :style="{ borderColor: selectedNode.color }">
              <span class="ec-panel-emoji">{{ selectedNode.emoji }}</span>
              <div>
                <div class="ec-panel-title">{{ selectedNode.label }}</div>
                <div class="ec-panel-sub">{{ selectedNode.scenario?.subtitle }}</div>
              </div>
            </div>
            <div class="ec-panel-stats">
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" :style="{ color: selectedNode.color }">
                  {{ selectedNode.scenario?.irr }}x
                </span>
                <span class="ec-panel-stat-lbl">IRR</span>
              </div>
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" :style="{ color: selectedNode.color }">
                  {{ selectedNode.scenario?.months ? selectedNode.scenario.months + ' мес' : '∞' }}
                </span>
                <span class="ec-panel-stat-lbl">До рынка</span>
              </div>
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" :style="{ color: selectedNode.color }">
                  {{ (selectedNode.scenario?.phases || []).length }}
                </span>
                <span class="ec-panel-stat-lbl">Раундов</span>
              </div>
            </div>
            <!-- Key phases -->
            <div class="ec-panel-section-title">Ключевые фазы</div>
            <div class="ec-panel-phases">
              <div v-for="(ph, i) in (selectedNode.scenario?.phases || []).slice(0,3)" :key="i"
                   class="ec-phase-row">
                <span class="ec-phase-badge" :style="{ background: selectedNode.color + '22', color: selectedNode.color }">
                  R{{ ph.round }}
                </span>
                <span class="ec-phase-label">{{ ph.label }}</span>
                <span class="ec-phase-cap" :style="{ color: selectedNode.color }">{{ ph.capital }}</span>
              </div>
            </div>
            <!-- Result -->
            <div v-if="selectedNode.scenario?.resultText" class="ec-panel-result">
              {{ selectedNode.scenario.resultText }}
            </div>
            <!-- Apply -->
            <button v-if="selectedNode.scenario?.type !== 'stagnation'"
              class="ec-apply-btn"
              :style="{ background: selectedNode.color + '18', borderColor: selectedNode.color + '55', color: selectedNode.color }"
              @click="applyScenario(selectedNode.scenario)"
            >
              ⚡ Применить этот путь
            </button>
          </template>

          <!-- GOAL panel -->
          <template v-else-if="selectedNode.kind === 'goal'">
            <div class="ec-panel-head" :style="{ borderColor: '#fbbf24' }">
              <span class="ec-panel-emoji">🏁</span>
              <div>
                <div class="ec-panel-title">Фор-кластер</div>
                <div class="ec-panel-sub">Цель: выход на рынок</div>
              </div>
            </div>
            <div class="ec-panel-stats">
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" style="color:#fbbf24">{{ irrMultiplier }}x</span>
                <span class="ec-panel-stat-lbl">текущий IRR</span>
              </div>
              <div class="ec-panel-stat">
                <span class="ec-panel-stat-val" style="color:#22c55e">
                  {{ defeatedCount }}/{{ bossCount }}
                </span>
                <span class="ec-panel-stat-lbl">барьеров пробито</span>
              </div>
            </div>
            <div class="ec-panel-hint">
              Победи все барьеры чтобы достичь максимального мультипликатора.
              Каждый пробитый барьер — +0.4x к IRR + бонус за полное прохождение +0.5x.
            </div>
          </template>

        </div>
      </Transition>

    </div><!-- /ec-body -->
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'

// ── Barrier concept models — internal causal structure of each barrier ─────────
// GR creates events → events modify barrier concept state → barrier generates startup events
const BOSS_CONCEPTS = {
  regulatory_barrier: {
    currentState: 'Сертификация БПЛА требует НПА, которого нет. Полёты в городе запрещены de facto.',
    needed:       'Внесение изменений в Воздушный кодекс + приказы Росавиации о зонах S-UAFS',
    actor:        'Росавиация, Минтранс, Правительство РФ',
    grLever:      'Рабочая группа НТИ → пилотный регион → тиражирование НПА',
    blockPath:    'Стартап → Полёты → Нужна лицензия → Лицензии нет → Нет НПА',
    timeline:     '18–36 мес. (цикл разработки НПА)',
    eventChain:   ['REGULATORY_BARRIER_DETECTED', 'WORKING_GROUP_FORMED', 'COUNTERMEASURE_ISSUED', 'MEASURE_APPROVED'],
  },
  market_failure:    {
    currentState: 'Корпоративные заказчики не понимают ROI от БПЛА. Рынок фрагментирован, нет типовых контрактов.',
    needed:       'Пилотные кейсы с гос. заказчиком + публичные ROI-кейсы + стандарты SLA',
    actor:        'Госкорпорации, Минпромторг, Сколково',
    grLever:      'Субсидированные пилоты через Нацпроект БАС → демонстрационные зоны',
    blockPath:    'Стартап → Продажи → Заказчик не верит → Нет доказательства рынка',
    timeline:     '12–24 мес. (2–3 пилота)',
    eventChain:   ['WORKING_GROUP_FORMED', 'MEASURE_APPLIED', 'MEASURE_FUNDED', 'TRL_UPDATED'],
  },
  tech_gap:          {
    currentState: 'TRL 4–5: технология работает в лаборатории, но нет полигона для испытаний на TRL 6–7.',
    needed:       'Доступ к испытательным полигонам + финансирование ОКР + сертификация по ГОСТ',
    actor:        'ЦИАМ, ЦАГИ, НИИ, ФСТ НТИ',
    grLever:      'Грант НТИ на ОКР → испытания в ExperimentZone → TRL-сертификат',
    blockPath:    'Стартап → TRL 7 → Нужны испытания → Полигон закрыт / дорог',
    timeline:     '12–18 мес. (при наличии финансирования)',
    eventChain:   ['MEASURE_APPLIED', 'MEASURE_APPROVED', 'MEASURE_FUNDED', 'TRL_UPDATED'],
  },
  infra_gap:         {
    currentState: 'Нет публичной инфраструктуры для логистики БПЛА: зарядок, хабов, диспетчеризации.',
    needed:       'Федеральная программа инфраструктуры БАС + частные хабы с господдержкой',
    actor:        'Минтранс, Росавиация, муниципалитеты, якорные операторы',
    grLever:      'Концессионные соглашения + инфраструктурные облигации + ОЭЗ',
    blockPath:    'Стартап → Масштаб → Нужны хабы → Хабов нет → Некому строить',
    timeline:     '24–48 мес. (инфраструктурный цикл)',
    eventChain:   ['REGULATORY_BARRIER_DETECTED', 'WORKING_GROUP_FORMED', 'MEASURE_APPLIED', 'MEASURE_FUNDED'],
  },
}

// ── Props ──────────────────────────────────────────────────────────────────────
const props = defineProps({
  company:  { type: Object, default: null },
  events:   { type: Array,  default: () => [] },
  possible: { type: Array,  default: () => [] },
  scenarios: { type: Array, default: () => [] },  // from GrScenarioPlayer
})
const emit = defineEmits(['attack', 'applyScenario'])

// ── Node/edge state ───────────────────────────────────────────────────────────
const nodes = ref([])
const edges = ref([])
let nodeIdCounter = 0

// ── Camera ────────────────────────────────────────────────────────────────────
const svgEl        = ref(null)
const canvasWrapEl = ref(null)
const pan          = ref({ x: 0, y: 0 })
const zoom         = ref(1)
let isPanning = false, panStart = { x: 0, y: 0 }, panOrigin = { x: 0, y: 0 }
let layoutRaf = null

// ── Selection / hover ─────────────────────────────────────────────────────────
const selectedId  = ref(null)
const hoveredId   = ref(null)
const selectedNode = computed(() => nodes.value.find(n => n.id === selectedId.value) || null)

// ── GR computed ───────────────────────────────────────────────────────────────
const bossStates = computed(() => {
  const m = {}
  for (const b of GR_BOSSES) m[b.id] = getBossState(b, props.events)
  return m
})

const defeatedCount = computed(() =>
  GR_BOSSES.filter(b => bossStates.value[b.id]?.defeated).length
)
const bossCount = computed(() =>
  GR_BOSSES.filter(b => bossStates.value[b.id] !== null).length
)
const irrMultiplier = computed(() => {
  const d = defeatedCount.value
  const total = bossCount.value
  if (!total) return 1.0
  const all = d === total && total > 0
  return +(1.0 + d * 0.4 + (all ? 0.5 : 0)).toFixed(1)
})

// Set of applied event types (for concept chain highlight)
const appliedEventTypes = computed(() => new Set(props.events.map(e => e.type)))

// ── Node color lookup ─────────────────────────────────────────────────────────
const BOSS_COLORS = {
  regulatory_barrier: '#ef4444',
  market_failure:     '#f59e0b',
  tech_gap:           '#3b82f6',
  infra_gap:          '#8b5cf6',
}
const SCENARIO_COLORS = {
  stagnation: '#ef4444',
  basic:      '#22c55e',
  schlimann:  '#06b6d4',
}

function nodeById(id) { return nodes.value.find(n => n.id === id) }
function nodeColor(id) {
  const n = nodeById(id)
  return n?.color || '#88aacc'
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function ptX(deg, r) { return +(r * Math.sin(deg * Math.PI / 180)).toFixed(2) }
function ptY(deg, r) { return +(-r * Math.cos(deg * Math.PI / 180)).toFixed(2) }

function svgCenter() {
  if (!svgEl.value) return { x: 500, y: 320 }
  const r = svgEl.value.getBoundingClientRect()
  return {
    x: (r.width  / 2 - pan.value.x) / zoom.value,
    y: (r.height / 2 - pan.value.y) / zoom.value,
  }
}
function screenX(node) { return pan.value.x + node.x * zoom.value }
function screenY(node) { return pan.value.y + node.y * zoom.value }

function edgePath(edge) {
  const src = nodeById(edge.sourceId)
  const tgt = nodeById(edge.targetId)
  if (!src || !tgt) return ''
  const dx = tgt.x - src.x, dy = tgt.y - src.y
  const d  = Math.sqrt(dx*dx + dy*dy) || 1
  const R  = 30
  const sx = src.x + dx/d*R, sy = src.y + dy/d*R
  const tx = tgt.x - dx/d*R, ty = tgt.y - dy/d*R
  const perp = { x: -dy/d * 30, y: dx/d * 30 }
  const mx = (sx+tx)/2, my = (sy+ty)/2
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(mx+perp.x).toFixed(1)} ${(my+perp.y).toFixed(1)} ${(mx+perp.x).toFixed(1)} ${(my+perp.y).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`
}
function edgeMidX(edge) {
  const s = nodeById(edge.sourceId), t = nodeById(edge.targetId)
  return s && t ? (s.x + t.x) / 2 : 0
}
function edgeMidY(edge) {
  const s = nodeById(edge.sourceId), t = nodeById(edge.targetId)
  return s && t ? (s.y + t.y) / 2 : 0
}
function edgeLen(edge) {
  const s = nodeById(edge.sourceId), t = nodeById(edge.targetId)
  if (!s || !t) return 200
  return Math.sqrt((t.x-s.x)**2 + (t.y-s.y)**2)
}
function edgeArrow(edge) {
  if (edge.kind === 'block') return 'url(#ec-arrow-red)'
  if (edge.kind === 'defeat') return 'url(#ec-arrow-green)'
  return 'url(#ec-arrow)'
}

// ── Force-directed layout ─────────────────────────────────────────────────────
function runForce(iters = 80) {
  const N = nodes.value.length
  if (N < 2) return
  const spring = 240, repulse = 16000, springK = 0.05, gravity = 0.002
  const pos = nodes.value.map(n => ({ id: n.id, x: n.x, y: n.y, vx: 0, vy: 0, fixed: n.fixed }))
  const edgeMap = edges.value.map(e => ({ s: e.sourceId, t: e.targetId }))
  const c = svgCenter()

  for (let iter = 0; iter < iters; iter++) {
    const damp = Math.max(0.7, 1 - iter / iters)
    for (let i = 0; i < pos.length; i++) {
      for (let j = i+1; j < pos.length; j++) {
        const a = pos[i], b = pos[j]
        if (a.fixed && b.fixed) continue
        const dx = b.x-a.x, dy = b.y-a.y
        const d2 = dx*dx + dy*dy + 1, d = Math.sqrt(d2)
        const f = repulse / d2
        const nx = dx/d, ny = dy/d
        if (!a.fixed) { a.vx -= f*nx; a.vy -= f*ny }
        if (!b.fixed) { b.vx += f*nx; b.vy += f*ny }
      }
    }
    for (const e of edgeMap) {
      const a = pos.find(p => p.id===e.s), b = pos.find(p => p.id===e.t)
      if (!a || !b) continue
      const dx = b.x-a.x, dy = b.y-a.y
      const d = Math.sqrt(dx*dx+dy*dy)+0.01
      const f = springK * (d - spring)
      const nx = dx/d, ny = dy/d
      if (!a.fixed) { a.vx += f*nx; a.vy += f*ny }
      if (!b.fixed) { b.vx -= f*nx; b.vy -= f*ny }
    }
    for (const p of pos) {
      if (p.fixed) continue
      p.vx += (c.x - p.x) * gravity
      p.vy += (c.y - p.y) * gravity
      const cap = 14 * damp
      p.vx = Math.max(-cap, Math.min(cap, p.vx)) * 0.85
      p.vy = Math.max(-cap, Math.min(cap, p.vy)) * 0.85
      p.x += p.vx; p.y += p.vy
    }
  }
  for (const p of pos) {
    const n = nodes.value.find(n => n.id === p.id)
    if (n && !n.fixed) { n.x = p.x; n.y = p.y }
  }
}

function animateLayout(frames = 30, andFit = false) {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  let f = 0
  function step() {
    runForce(4)
    if (++f < frames) layoutRaf = requestAnimationFrame(step)
    else if (andFit) fitAll()
  }
  layoutRaf = requestAnimationFrame(step)
}

function fitAll() {
  if (!nodes.value.length || !svgEl.value) return
  const rect = svgEl.value.getBoundingClientRect()
  const margin = 90
  const xs = nodes.value.map(n => n.x)
  const ys = nodes.value.map(n => n.y)
  const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin
  const minY = Math.min(...ys) - margin, maxY = Math.max(...ys) + margin
  const contentW = maxX - minX || 1, contentH = maxY - minY || 1
  const newZoom = Math.min((rect.width - 80) / contentW, (rect.height - 80) / contentH, 1.6)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  animateTo(
    { x: rect.width/2 - cx*newZoom, y: rect.height/2 - cy*newZoom },
    Math.max(0.15, newZoom)
  )
}
function animateTo(targetPan, targetZoom, steps = 18) {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  let step = 0
  const sp = { ...pan.value }, sz = zoom.value
  function tick() {
    step++
    const t = 1 - Math.pow(1 - step/steps, 3)
    pan.value  = { x: sp.x + (targetPan.x - sp.x)*t, y: sp.y + (targetPan.y - sp.y)*t }
    zoom.value = sz + (targetZoom - sz) * t
    if (step < steps) layoutRaf = requestAnimationFrame(tick)
  }
  layoutRaf = requestAnimationFrame(tick)
}
function zoomBy(factor) {
  if (!svgEl.value) return
  const r = svgEl.value.getBoundingClientRect()
  const cx = r.width/2, cy = r.height/2
  const oldZ = zoom.value, newZ = Math.max(0.1, Math.min(5, oldZ * factor))
  const wx = (cx - pan.value.x) / oldZ, wy = (cy - pan.value.y) / oldZ
  pan.value = { x: cx - wx*newZ, y: cy - wy*newZ }
  zoom.value = newZ
}
function resetZoom() {
  if (!svgEl.value) return
  const r = svgEl.value.getBoundingClientRect()
  const cx = r.width/2, cy = r.height/2
  const wx = (cx-pan.value.x)/zoom.value, wy = (cy-pan.value.y)/zoom.value
  pan.value = { x: cx-wx, y: cy-wy }
  zoom.value = 1
}

// ── Pan ────────────────────────────────────────────────────────────────────────
function onWheel(e) {
  if (!svgEl.value) return
  const r = svgEl.value.getBoundingClientRect()
  const mx = e.clientX - r.left, my = e.clientY - r.top
  const oldZ = zoom.value, newZ = Math.max(0.1, Math.min(5, oldZ * (e.deltaY > 0 ? 0.9 : 1.11)))
  const wx = (mx - pan.value.x) / oldZ, wy = (my - pan.value.y) / oldZ
  pan.value = { x: mx - wx*newZ, y: my - wy*newZ }
  zoom.value = newZ
}
function onPanStart(e) {
  if (e.target.closest('.ec-node-g, .ec-panel, .ec-fab, .ec-hud')) return
  isPanning = true; panStart = { x: e.clientX, y: e.clientY }; panOrigin = { ...pan.value }
}
function onPanMove(e) {
  if (isPanning) pan.value = { x: panOrigin.x + e.clientX - panStart.x, y: panOrigin.y + e.clientY - panStart.y }
}
function onPanEnd() { isPanning = false }

// ── Build graph from GR data ──────────────────────────────────────────────────
function makeNode(id, overrides) {
  return { id: `n${id}`, x: 0, y: 0, r: 30, ...overrides }
}

function buildGraph() {
  nodeIdCounter = 0
  const c = svgCenter()
  const ns = [], es = []

  // Company node (center)
  const companyNode = {
    id: 'node-company', x: c.x, y: c.y, r: 36, fixed: false,
    kind: 'company', emoji: '🚀',
    label: props.company?.name || 'Компания',
    sublabel: `TRL ${props.company?.trl || '?'}`,
    color: '#f97316',
    defeated: false, hpPct: 100,
  }
  ns.push(companyNode)

  // Goal node (top right)
  const allDefeated = defeatedCount.value > 0 && defeatedCount.value === bossCount.value
  const goalNode = {
    id: 'node-goal', x: c.x + 320, y: c.y - 220, r: 38, fixed: false,
    kind: 'goal', emoji: '🏁',
    label: 'Фор-кластер',
    sublabel: `${irrMultiplier.value}x IRR`,
    color: allDefeated ? '#22c55e' : '#fbbf24',
    defeated: false, hpPct: 100,
  }
  ns.push(goalNode)

  // Boss nodes
  const bossPositions = [
    { x: c.x - 280, y: c.y - 100 },
    { x: c.x - 100, y: c.y + 260 },
    { x: c.x + 220, y: c.y + 200 },
    { x: c.x + 100, y: c.y - 260 },
  ]
  GR_BOSSES.forEach((boss, i) => {
    const state = bossStates.value[boss.id]
    const triggered = state !== null
    const pos = bossPositions[i] || { x: c.x + Math.cos(i * Math.PI / 2) * 280, y: c.y + Math.sin(i * Math.PI / 2) * 280 }
    const bNode = {
      id: `node-boss-${boss.id}`,
      x: pos.x, y: pos.y, r: 32,
      kind: 'boss', emoji: boss.emoji,
      label: boss.name,
      sublabel: triggered ? (state.defeated ? 'ПРОБИТ ✓' : `HP ${state.currentHp}`) : 'спит',
      color: BOSS_COLORS[boss.id] || '#ef4444',
      boss, state,
      defeated: state?.defeated || false,
      hpPct: state ? state.hpPct : 100,
      triggered,
    }
    ns.push(bNode)
    // company → boss: blocking edge
    es.push({
      id: `e-co-boss-${boss.id}`,
      sourceId: 'node-company',
      targetId: `node-boss-${boss.id}`,
      kind: 'block', dashed: true,
      label: state?.defeated ? '' : 'БАРЬЕР',
      defeated: state?.defeated,
    })
    // boss → goal: blocking
    es.push({
      id: `e-boss-goal-${boss.id}`,
      sourceId: `node-boss-${boss.id}`,
      targetId: 'node-goal',
      kind: 'block', dashed: false,
      defeated: state?.defeated,
    })
  })

  // Scenario nodes (from props.scenarios, fallback to demo)
  const scenariosToShow = (props.scenarios || []).filter(s => s.type !== 'stagnation')
  const scenarioPositions = [
    { x: c.x - 220, y: c.y + 80  },
    { x: c.x + 60,  y: c.y - 180 },
  ]
  scenariosToShow.slice(0, 2).forEach((sc, i) => {
    const pos = scenarioPositions[i] || { x: c.x + Math.cos(i) * 200, y: c.y + Math.sin(i) * 200 }
    const sNode = {
      id: `node-sc-${sc.type}`,
      x: pos.x, y: pos.y, r: 28,
      kind: 'scenario', emoji: sc.icon || '⚡',
      label: sc.name,
      sublabel: sc.irr ? `${sc.irr}x IRR` : '',
      color: SCENARIO_COLORS[sc.type] || '#22c55e',
      scenario: sc,
      defeated: false, hpPct: 100,
    }
    ns.push(sNode)
    // company → scenario: action edge
    es.push({
      id: `e-co-sc-${sc.type}`,
      sourceId: 'node-company',
      targetId: `node-sc-${sc.type}`,
      kind: 'action', dashed: true,
    })
    // scenario → bosses it can defeat
    const eventTypes = new Set(
      (sc.phases || []).flatMap(ph => (ph.steps || []).map(s => s.eventType).filter(Boolean))
    )
    GR_BOSSES.forEach(boss => {
      if (boss.attacks.some(a => eventTypes.has(a.type))) {
        es.push({
          id: `e-sc-boss-${sc.type}-${boss.id}`,
          sourceId: `node-sc-${sc.type}`,
          targetId: `node-boss-${boss.id}`,
          kind: 'defeat', dashed: true,
          label: 'ПРОБЬЁТ',
          defeated: bossStates.value[boss.id]?.defeated,
        })
      }
    })
    // scenario → goal
    es.push({
      id: `e-sc-goal-${sc.type}`,
      sourceId: `node-sc-${sc.type}`,
      targetId: 'node-goal',
      kind: 'defeat', dashed: true,
    })
  })

  nodes.value = ns
  edges.value = es
  nextTick(() => animateLayout(40, true))
}

function rebuildGraph() {
  selectedId.value = null
  buildGraph()
}

// ── Attacks ───────────────────────────────────────────────────────────────────
function attacksForBoss(boss) {
  if (!boss) return []
  return boss.attacks.map(atk => {
    const available = props.possible.find(p => p.type === atk.type)
    return { ...atk, available: !!available }
  })
}

function handleAttack(atk) {
  emit('attack', atk)
}

function applyScenario(sc) {
  if (!sc) return
  const evts = (sc.phases || [])
    .flatMap(ph => ph.steps || [])
    .filter(s => s.eventType)
    .map(s => ({
      type:    s.eventType,
      label:   s.description,
      subject: `Сценарий: ${sc.name}`,
      ts:      new Date(Date.now() + s.month * 30 * 86400000).toISOString(),
      data:    { scenario: sc.type },
    }))
  emit('applyScenario', evts)
}

function selectNode(node) {
  selectedId.value = selectedId.value === node.id ? null : node.id
}

// ── Reactivity ────────────────────────────────────────────────────────────────
watch([() => props.events, () => props.scenarios, () => props.company], () => {
  buildGraph()
}, { deep: true })

// Update boss node sublabels live without full rebuild
watch(bossStates, () => {
  for (const n of nodes.value) {
    if (n.kind !== 'boss') continue
    const boss = n.boss
    const state = bossStates.value[boss?.id]
    if (!state) continue
    n.state     = state
    n.defeated  = state.defeated
    n.hpPct     = state.hpPct
    n.sublabel  = state.defeated ? 'ПРОБИТ ✓' : `HP ${state.currentHp}`
    n.color     = state.defeated
      ? `color-mix(in srgb, ${BOSS_COLORS[boss.id]} 40%, #666)`
      : BOSS_COLORS[boss.id]
  }
  // Update goal
  const goal = nodes.value.find(n => n.kind === 'goal')
  if (goal) {
    goal.sublabel = `${irrMultiplier.value}x IRR`
    goal.color = defeatedCount.value > 0 && defeatedCount.value === bossCount.value
      ? '#22c55e' : '#fbbf24'
  }
  // Fade defeated edges
  for (const e of edges.value) {
    if (e.kind === 'block' && e.id.includes('boss')) {
      const bossId = e.id.replace('e-co-boss-', '').replace('e-boss-goal-', '')
      e.defeated = bossStates.value[bossId]?.defeated || false
    }
  }
}, { deep: true })

let resizeObserver = null
let graphBuilt = false

onMounted(() => {
  nextTick(() => {
    if (!svgEl.value) return
    const r = svgEl.value.getBoundingClientRect()
    if (r.width > 10 && r.height > 10) {
      graphBuilt = true
      buildGraph()
      return
    }
    // SVG not yet sized — wait for first non-zero size
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 10 && height > 10 && !graphBuilt) {
          graphBuilt = true
          buildGraph()
          resizeObserver?.disconnect()
          resizeObserver = null
          break
        }
      }
    })
    resizeObserver.observe(svgEl.value)
  })
})
onBeforeUnmount(() => {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.ec-root {
  display: flex; flex-direction: column; height: 100%;
  background: #060d14; border-radius: 12px; overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ── HUD ─── */
.ec-hud {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 14px;
  background: #0a1520; border-bottom: 1px solid #1a2a3a;
  flex-shrink: 0;
}
.ec-hud-bracket { color: #00d4ff; opacity: 0.6; }
.ec-hud-title {
  font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
  color: #88aacc;
}
.ec-hud-stats {
  display: flex; gap: 10px; align-items: center; font-size: 10px; color: #88aacc;
}
.ec-hud-dot-blink { font-size: 8px; color: #22c55e; animation: blink 1.5s ease infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
.ec-dim { opacity: 0.4; }
.ec-hud-irr { font-weight: 700; color: #22c55e; font-size: 11px; }
.ec-hud-acts { margin-left: auto; display: flex; gap: 5px; }
.ec-hud-btn {
  font-size: 11px; padding: 3px 8px; border-radius: 5px; cursor: pointer;
  background: #112233; border: 1px solid #1a3050; color: #88aacc;
  transition: all 0.15s;
}
.ec-hud-btn:hover { background: #1a3050; color: #00d4ff; }
.ec-hud-btn--danger:hover { background: #3a1010; color: #ef4444; border-color: #ef444433; }

/* ── Body ─── */
.ec-body {
  display: flex; flex: 1; min-height: 0; position: relative;
}

/* ── Canvas ─── */
.ec-canvas {
  flex: 1; position: relative; overflow: hidden; cursor: grab;
}
.ec-canvas:active { cursor: grabbing; }
.ec-svg { width: 100%; height: 100%; display: block; }

/* Node group cursor */
.ec-node-g { cursor: pointer; }

/* Edge dash animation */
@keyframes dash-move { to { stroke-dashoffset: -40; } }
.ec-edge-dash { animation: dash-move 2s linear infinite; }

/* Spin animation */
@keyframes ec-spin { to { transform: rotate(360deg); } }
.ec-spin { animation: ec-spin 12s linear infinite; transform-origin: center; }

/* Pulse */
@keyframes ec-pulse { 0%,100%{r:42;opacity:0.4} 50%{r:52;opacity:0.1} }
.ec-pulse { animation: ec-pulse 2s ease infinite; }

/* HTML icon overlay */
.ec-overlay { position: absolute; inset: 0; pointer-events: none; }
.ec-node-ic {
  position: absolute; transform: translate(-50%, -50%);
  pointer-events: auto; cursor: pointer;
  user-select: none; transition: opacity 0.3s;
}

/* FAB toolbar */
.ec-fab {
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px;
  background: #0a1520cc; border: 1px solid #1a3050;
  backdrop-filter: blur(6px);
  border-radius: 10px; padding: 5px 8px;
}
.ec-fab-btn {
  font-size: 11px; padding: 4px 8px; border-radius: 6px; cursor: pointer;
  background: transparent; border: 1px solid #1a3050; color: #88aacc;
  transition: all 0.15s;
}
.ec-fab-btn:hover { background: #1a3050; color: #00d4ff; }
.ec-fab-fit { color: #22c55e; }
.ec-fab-zoom {
  font-size: 10px; font-weight: 700; color: #88aacc;
  padding: 4px 10px; background: transparent; border: 1px solid #1a3050;
  border-radius: 6px; cursor: pointer; min-width: 44px; text-align: center;
}
.ec-fab-sep { width: 1px; height: 20px; background: #1a3050; margin: 0 2px; }

/* Hint */
.ec-hint {
  position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; color: #88aacc; opacity: 0.55;
  white-space: nowrap;
}

/* ── Side panel ─── */
.ec-panel {
  width: 280px; flex-shrink: 0;
  background: #0a1a28; border-left: 1px solid #1a3050;
  overflow-y: auto; position: relative;
  display: flex; flex-direction: column; gap: 0;
}
.ec-panel-close {
  position: absolute; top: 8px; right: 10px;
  background: none; border: none; cursor: pointer;
  color: #88aacc; font-size: 18px; line-height: 1;
  opacity: 0.5; transition: opacity 0.15s;
}
.ec-panel-close:hover { opacity: 1; }

.ec-panel-head {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 14px 12px;
  border-bottom: 1px solid #1a3050;
  border-left: 3px solid transparent;
}
.ec-panel-emoji { font-size: 1.8rem; flex-shrink: 0; }
.ec-panel-title { font-size: 13px; font-weight: 700; color: #cce4ff; }
.ec-panel-sub { font-size: 10px; color: #88aacc; margin-top: 2px; }

.ec-panel-stats {
  display: flex; gap: 0; border-bottom: 1px solid #1a3050;
}
.ec-panel-stat {
  flex: 1; text-align: center; padding: 10px 8px;
  border-right: 1px solid #1a3050;
}
.ec-panel-stat:last-child { border-right: none; }
.ec-panel-stat-val {
  display: block; font-size: 1.3rem; font-weight: 900;
  font-variant-numeric: tabular-nums; color: #cce4ff;
}
.ec-panel-stat-lbl { font-size: 9px; color: #88aacc; text-transform: uppercase; letter-spacing: 0.05em; }

.ec-panel-hp { padding: 12px 14px 0; }
.ec-panel-hp-row { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 5px; }
.ec-panel-hp-lbl { color: #88aacc; }
.ec-panel-hp-track { height: 6px; background: #1a3050; border-radius: 4px; overflow: hidden; }
.ec-panel-hp-fill { height: 100%; border-radius: 4px; transition: width 0.7s ease; }

.ec-panel-lore { padding: 10px 14px; font-size: 11px; color: #88aacc; line-height: 1.6; border-bottom: 1px solid #1a3050; }

/* ── Barrier concept model ─── */
.ec-concept-grid {
  padding: 8px 14px 4px;
  display: flex; flex-direction: column; gap: 6px;
}
.ec-concept-row {
  display: flex; gap: 8px; align-items: flex-start;
}
.ec-concept-key {
  flex-shrink: 0; width: 60px;
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: #3a5070; padding-top: 1px;
}
.ec-concept-val {
  font-size: 10px; color: #88aacc; line-height: 1.55; flex: 1;
}
.ec-concept-val--need   { color: #22c55e; }
.ec-concept-val--lever  { color: #8b5cf6; }
.ec-concept-val--block  { color: #ef4444; font-style: italic; }

.ec-concept-chain {
  display: flex; flex-wrap: wrap; gap: 3px; align-items: center;
  padding: 8px 14px 10px;
  border-bottom: 1px solid #1a3050;
}
.ec-concept-chain-step {
  display: flex; align-items: center; gap: 3px;
  font-size: 8px; font-weight: 600; letter-spacing: 0.04em;
  color: #3a5070; padding: 2px 6px; border-radius: 4px;
  background: #0e1e2e; border: 1px solid #1a3050;
  transition: all 0.2s;
}
.ec-concept-chain-step--done {
  color: #22c55e; border-color: #22c55e33; background: #0e2218;
}
.ec-concept-chain-arrow { color: #2a4060; font-size: 7px; }

.ec-panel-section-title {
  padding: 8px 14px 4px;
  font-size: 9px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: #88aacc; opacity: 0.6;
}

.ec-panel-attacks { padding: 0 10px 12px; display: flex; flex-direction: column; gap: 5px; }
.ec-atk-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 7px; cursor: pointer; font-size: 11px;
  background: #112233; border: 1px solid #1a3050; color: #cce4ff;
  transition: all 0.15s; text-align: left;
}
.ec-atk-btn:hover:not(:disabled) { background: #1a3050; border-color: #00d4ff44; }
.ec-atk-btn:disabled, .ec-atk-btn--done { opacity: 0.35; cursor: default; }
.ec-atk-dmg { margin-left: auto; font-weight: 700; font-size: 10px; color: #f59e0b; }

.ec-panel-defeated { padding: 20px 14px; text-align: center; }
.ec-panel-defeated-icon { font-size: 2.5rem; margin-bottom: 8px; }
.ec-panel-defeated-text { font-size: 12px; color: #22c55e; line-height: 1.6; margin-bottom: 10px; }
.ec-panel-rewards { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.ec-reward-tag {
  font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
  background: #0f2e1a; border: 1px solid #22c55e44; color: #22c55e;
}

.ec-panel-phases { padding: 0 10px 8px; display: flex; flex-direction: column; gap: 5px; }
.ec-phase-row {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; padding: 5px 8px; border-radius: 6px;
  background: #0d1e2d; border: 1px solid #1a3050;
}
.ec-phase-badge {
  font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px; flex-shrink: 0;
}
.ec-phase-label { flex: 1; color: #cce4ff; }
.ec-phase-cap { font-size: 10px; font-weight: 700; flex-shrink: 0; }

.ec-panel-result {
  margin: 0 10px 10px; padding: 8px 10px; border-radius: 7px;
  font-size: 11px; color: #88aacc; line-height: 1.6;
  background: #0d1e2d; border: 1px solid #1a3050;
}

.ec-apply-btn {
  margin: 0 10px 14px; padding: 10px 14px;
  border-radius: 8px; border: 1px solid; cursor: pointer;
  font-size: 12px; font-weight: 700; width: calc(100% - 20px);
  transition: opacity 0.15s;
}
.ec-apply-btn:hover { opacity: 0.8; }

.ec-panel-hint {
  padding: 10px 14px; font-size: 10px; color: #88aacc;
  line-height: 1.6; opacity: 0.7; border-top: 1px solid #1a3050;
}

/* Panel slide transition */
.ec-slide-enter-active, .ec-slide-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.ec-slide-enter-from, .ec-slide-leave-to { transform: translateX(20px); opacity: 0; }
</style>

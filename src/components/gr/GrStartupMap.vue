<!--
  GrStartupMap — Пространство операции по Переслегину
  X = Свобода манёвра (0–10)   | Насколько открыты пути к цели
  Y = Темп операции  (0–10)    | Скорость продвижения в пространстве позиций

  СТАГНАЦИЯ      = нет событий → пьяный матрос, броуновское движение (плохо)
  СТРАТЕГИЯ ШЛИМАНА = быстрые непредсказуемые прыжки — враг не успевает (хорошо!)
  ЛИНИЯ ОПЕРАЦИИ = кристаллизация стратегии, направленный вектор (финал)

  «Действуем там где можем, пока враг собирается туда — мы уже в другом месте»
  Квантовый туннель = буквально Шлиман: босс ждёт у двери X, мы уже в Y
  Тень фонда = территория до которой враг уже не вернётся
-->
<template>
  <div class="smap-wrap">

    <!-- ── Легенда ────────────────────────────────────────────── -->
    <div class="smap-legend">
      <div v-for="b in BARRIERS" :key="b.bossId" class="smap-legend-item">
        <div class="smap-legend-dot"
             :style="{ background: b.color, opacity: isDefeated(b.bossId) ? 0.3 : 1 }" />
        <span :style="{ opacity: isDefeated(b.bossId) ? 0.4 : 1,
                        textDecoration: isDefeated(b.bossId) ? 'line-through' : 'none' }">
          {{ b.emoji }} {{ b.label }}
        </span>
        <span v-if="isDefeated(b.bossId)" style="color:#22c55e;font-weight:700;margin-left:4px">✓</span>
      </div>
      <div class="smap-legend-item" style="margin-left:8px">
        <div class="smap-legend-dot smap-legend-dot--tunnel" />
        <span style="color:#06b6d4">Квантовый туннель</span>
      </div>
      <div class="smap-legend-item" style="margin-left:auto">
        <div class="smap-legend-dot" style="background:var(--p-primary-color)" />
        <span>{{ companyName }}</span>
      </div>
    </div>

    <!-- ── SVG Карта ──────────────────────────────────────────── -->
    <div class="smap-container">
      <svg :viewBox="`0 0 ${SVG_W + LABEL_LEFT + LABEL_RIGHT} ${SVG_H + LABEL_TOP + LABEL_BOTTOM}`"
           class="smap-svg">

        <defs>
          <!-- Тень фонда: градиент от нижнего-левого угла к проекту -->
          <linearGradient id="shadow-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="var(--p-primary-color)" stop-opacity="0.12" />
            <stop offset="100%" stop-color="var(--p-primary-color)" stop-opacity="0.02" />
          </linearGradient>
          <!-- Свечение туннеля -->
          <radialGradient id="tunnel-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stop-color="#06b6d4" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0" />
          </radialGradient>
          <!-- Свечение проекта -->
          <filter id="project-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Свечение цели -->
          <filter id="goal-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Свечение туннеля (открытый) -->
          <filter id="tunnel-open-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Стрелка для линии операции -->
          <marker id="op-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="var(--p-primary-color)" opacity="0.7" />
          </marker>
          <!-- Стрелка туннеля -->
          <marker id="tunnel-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#06b6d4" opacity="0.8" />
          </marker>
        </defs>

        <!-- Фон -->
        <rect x="0" y="0"
              :width="SVG_W + LABEL_LEFT + LABEL_RIGHT"
              :height="SVG_H + LABEL_TOP + LABEL_BOTTOM"
              fill="var(--p-surface-card)" rx="12" />

        <!-- Grid area -->
        <g :transform="`translate(${LABEL_LEFT}, ${LABEL_TOP})`">

          <!-- ── Оперативная тень фонда ── -->
          <path :d="shadowPath"
                fill="url(#shadow-grad)"
                style="transition: d 1.2s cubic-bezier(0.16,1,0.3,1)" />

          <!-- ── Зональная подсветка X (Свобода манёвра) ── -->
          <rect x="0"               y="0" :width="SVG_W*0.25" :height="SVG_H" fill="#64748b06" />
          <rect :x="SVG_W*0.25"     y="0" :width="SVG_W*0.25" :height="SVG_H" fill="#3b82f606" />
          <rect :x="SVG_W*0.5"      y="0" :width="SVG_W*0.25" :height="SVG_H" fill="#f59e0b06" />
          <rect :x="SVG_W*0.75"     y="0" :width="SVG_W*0.25" :height="SVG_H" fill="#22c55e07" />

          <!-- ── Зоны пространства: «Поле решений» → «Стратегическое пространство» ── -->
          <text x="12" :y="SVG_H - 8"
                font-size="8" fill="var(--p-text-muted-color)" opacity="0.5" font-style="italic">
            Поле возможностей
          </text>
          <text :x="SVG_W - 10" y="10"
                font-size="8" fill="#22c55e" opacity="0.5" font-style="italic" text-anchor="end">
            Стратегическое пространство
          </text>
          <!-- Пунктирная линия «вырождения» (диагональ) -->
          <line :x1="0" :y1="SVG_H" :x2="SVG_W" :y2="0"
                stroke="var(--p-primary-color)" stroke-width="1"
                stroke-dasharray="3,8" opacity="0.1" />

          <!-- ── Зональная подсветка Y (Темп) ── -->
          <rect x="0" :y="tempoToY(10)"   :width="SVG_W" :height="tempoToY(8)-tempoToY(10)"  fill="#22c55e05" />
          <rect x="0" :y="tempoToY(8)"    :width="SVG_W" :height="tempoToY(6)-tempoToY(8)"   fill="#f59e0b05" />
          <rect x="0" :y="tempoToY(6)"    :width="SVG_W" :height="tempoToY(3)-tempoToY(6)"   fill="#3b82f604" />
          <rect x="0" :y="tempoToY(3)"    :width="SVG_W" :height="tempoToY(0)-tempoToY(3)"   fill="#64748b06" />

          <!-- ── Метки X зон ── -->
          <text v-for="z in XZONES" :key="z.label"
                :x="z.cx * SVG_W" :y="SVG_H + 26"
                text-anchor="middle" font-size="9"
                fill="var(--p-text-muted-color)" font-weight="600">{{ z.label }}</text>

          <!-- ── Метки Y зон ── -->
          <text v-for="z in YZONES" :key="z.label"
                x="-6" :y="tempoToY(z.t) + 4"
                text-anchor="end" font-size="8"
                fill="var(--p-text-muted-color)" font-weight="500">{{ z.label }}</text>

          <!-- ── Стрелки осей ── -->
          <text :x="SVG_W / 2" :y="SVG_H + 44"
                text-anchor="middle" font-size="10" fill="var(--p-text-muted-color)">
            ← Свобода манёвра →
          </text>

          <!-- ── Сетка ── -->
          <line v-for="i in 10" :key="'vg'+i"
                :x1="(i/10)*SVG_W" y1="0" :x2="(i/10)*SVG_W" :y2="SVG_H"
                stroke="var(--p-content-border-color)" stroke-width="0.5" opacity="0.4" />
          <line v-for="i in 10" :key="'hg'+i"
                x1="0" :y1="(i/10)*SVG_H" :x2="SVG_W" :y2="(i/10)*SVG_H"
                stroke="var(--p-content-border-color)" stroke-width="0.5" opacity="0.4" />

          <!-- ── Числовые метки X (0,2,4,6,8,10) ── -->
          <text v-for="n in [0,2,4,6,8,10]" :key="'xn'+n"
                :x="(n/10)*SVG_W" :y="SVG_H + 14"
                text-anchor="middle" font-size="9" fill="var(--p-text-muted-color)">{{ n }}</text>

          <!-- ── Числовые метки Y (0,2,4,6,8,10) ── -->
          <text v-for="n in [0,2,4,6,8,10]" :key="'yn'+n"
                x="-6" :y="tempoToY(n) + 4"
                text-anchor="end" font-size="9"
                :fill="Math.abs(n - projectTempo) < 1 ? 'var(--p-primary-color)' : 'var(--p-text-muted-color)'"
                :font-weight="Math.abs(n - projectTempo) < 1 ? '700' : '400'">{{ n }}</text>

          <!-- ══════════════════════════
               БАРЬЕРЫ
          ══════════════════════════ -->
          <g v-for="b in BARRIERS" :key="b.bossId">
            <!-- Заливка -->
            <rect
              :x="b.x1 * SVG_W"    :y="tempoToY(b.t2)"
              :width="(b.x2-b.x1)*SVG_W"
              :height="tempoToY(b.t1) - tempoToY(b.t2)"
              :fill="b.color"
              :opacity="isDefeated(b.bossId) ? 0.03 : 0.12"
              rx="4"
              style="transition: opacity 1s ease"
            />
            <!-- Граница -->
            <rect
              :x="b.x1 * SVG_W"    :y="tempoToY(b.t2)"
              :width="(b.x2-b.x1)*SVG_W"
              :height="tempoToY(b.t1) - tempoToY(b.t2)"
              fill="none"
              :stroke="b.color"
              :stroke-width="isDefeated(b.bossId) ? 1 : 2"
              :opacity="isDefeated(b.bossId) ? 0.1 : 0.65"
              stroke-dasharray="7,3" rx="4"
              style="transition: all 1s ease"
            />
            <!-- HP-бар -->
            <g v-if="!isDefeated(b.bossId)">
              <rect
                :x="b.x1*SVG_W+4"  :y="tempoToY(b.t2)+4"
                :width="(b.x2-b.x1)*SVG_W-8" height="5"
                fill="#ffffff18" rx="3" />
              <rect
                :x="b.x1*SVG_W+4"  :y="tempoToY(b.t2)+4"
                :width="((b.x2-b.x1)*SVG_W-8)*bossHpPct(b.bossId)/100" height="5"
                :fill="b.color" rx="3"
                style="transition: width 0.7s cubic-bezier(0.16,1,0.3,1)" />
            </g>
            <!-- Эмодзи + название -->
            <text :x="(b.x1+b.x2)/2*SVG_W"
                  :y="(tempoToY(b.t1)+tempoToY(b.t2))/2 + 2"
                  text-anchor="middle" font-size="18"
                  :opacity="isDefeated(b.bossId) ? 0.1 : 0.85"
                  style="transition: opacity 1s ease">{{ b.emoji }}</text>
            <text :x="(b.x1+b.x2)/2*SVG_W"
                  :y="(tempoToY(b.t1)+tempoToY(b.t2))/2 + 18"
                  text-anchor="middle" font-size="9" :fill="b.color" font-weight="700"
                  :opacity="isDefeated(b.bossId) ? 0.15 : 1"
                  style="transition: opacity 1s ease">
              {{ isDefeated(b.bossId) ? '✓ ПРОБИТ' : b.label }}
            </text>
          </g>

          <!-- ══════════════════════════
               КВАНТОВЫЕ ТУННЕЛИ
          ══════════════════════════ -->
          <g v-for="t in TUNNELS" :key="t.bossId + 'tunnel'">
            <template v-if="!isDefeated(t.bossId)">
              <!-- Туннельный путь (открыт) -->
              <path v-if="isTunnelOpen(t)"
                :d="tunnelPath(t)"
                fill="none" stroke="#06b6d4" stroke-width="2"
                stroke-dasharray="4,3" opacity="0.7"
                filter="url(#tunnel-open-glow)" />

              <!-- Портал закрыт -->
              <g v-if="!isTunnelOpen(t)"
                 :transform="`translate(${t.px * SVG_W}, ${tempoToY(t.tempo)})`">
                <circle r="11" fill="none" stroke="#06b6d4" stroke-width="1.5"
                        stroke-dasharray="3,2" opacity="0.35" />
                <circle r="6" fill="#06b6d440" />
                <text x="0" y="4" text-anchor="middle" font-size="9" fill="#06b6d4" opacity="0.5">◯</text>
              </g>

              <!-- Портал открыт (пульсирует) -->
              <g v-else :transform="`translate(${t.px * SVG_W}, ${tempoToY(t.tempo)})`"
                 filter="url(#tunnel-open-glow)">
                <circle r="18" fill="url(#tunnel-glow)" class="smap-tunnel-pulse" />
                <circle r="11" fill="#06b6d430" stroke="#06b6d4" stroke-width="2" />
                <circle r="6"  fill="#06b6d4" opacity="0.9" />
                <text x="0" y="-16" text-anchor="middle" font-size="8" fill="#06b6d4" font-weight="700">
                  ⚛ {{ t.label }}
                </text>
              </g>

              <!-- Стрелка «войти в туннель» -->
              <g v-if="isTunnelOpen(t) && isNearTunnel(t)">
                <path :d="`M ${projectX} ${projectY} L ${t.px*SVG_W - 14} ${tempoToY(t.tempo)}`"
                      stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="4,3"
                      marker-end="url(#tunnel-arrow)" opacity="0.6" />
              </g>
            </template>
          </g>

          <!-- ══════════════════════════
               ПУТЬ К ЦЕЛИ
          ══════════════════════════ -->
          <path :d="mainPathD" fill="none"
                stroke="var(--p-primary-color)" stroke-width="1.5"
                stroke-dasharray="5,4" opacity="0.18" />

          <!-- Квантовый путь (через открытый туннель) -->
          <path v-if="quantumPathD" :d="quantumPathD" fill="none"
                stroke="#06b6d4" stroke-width="2"
                stroke-dasharray="6,3" opacity="0.4"
                filter="url(#tunnel-open-glow)" />

          <!-- ══════════════════════════
               ЛИНИЯ ОПЕРАЦИИ — вектор движения
          ══════════════════════════ -->
          <g v-if="directionArrow">
            <line
              :x1="directionArrow.x1" :y1="directionArrow.y1"
              :x2="directionArrow.x2" :y2="directionArrow.y2"
              stroke="var(--p-primary-color)" stroke-width="2.5"
              marker-end="url(#op-arrow)"
              opacity="0.65"
            />
            <!-- Подпись линии -->
            <text
              :x="(directionArrow.x1 + directionArrow.x2) / 2 + 10"
              :y="(directionArrow.y1 + directionArrow.y2) / 2"
              font-size="8" fill="var(--p-primary-color)" font-weight="700" opacity="0.7">
              линия операции
            </text>
          </g>

          <!-- ══════════════════════════
               СЛЕДЫ ПРОШЛЫХ ПОЗИЦИЙ
               (регулятор опаздывает — Стратегия Шлимана)
          ══════════════════════════ -->
          <g v-if="isSchlimann || isLinear">
            <!-- Соединительная пунктирная линия следов -->
            <polyline v-if="positionTrail.length > 0"
              :points="[...positionTrail].reverse().map(p => `${p.x},${p.y}`).concat(`${projectX},${projectY}`).join(' ')"
              fill="none" stroke="var(--p-primary-color)" stroke-width="1"
              stroke-dasharray="2,4" opacity="0.25" />
            <!-- Точки следов -->
            <g v-for="trail in positionTrail" :key="'trail'+trail.age">
              <circle :cx="trail.x" :cy="trail.y"
                      :r="8 - trail.age * 2"
                      fill="var(--p-primary-color)"
                      :opacity="0.35 - trail.age * 0.1" />
              <!-- Метка "враг ищет здесь" -->
              <text v-if="trail.age === 1"
                    :x="trail.x" :y="trail.y - 14"
                    text-anchor="middle" font-size="8"
                    fill="#ef4444" opacity="0.6">👮 ищет</text>
            </g>
          </g>

          <!-- ══════════════════════════
               ВЕРОЯТНОСТНОЕ ОБЛАКО
          ══════════════════════════ -->
          <g v-for="ghost in ghostPositions" :key="ghost.label" opacity="0.2">
            <circle :cx="ghost.x" :cy="ghost.y" r="7"
                    fill="var(--p-primary-color)" />
            <text :x="ghost.x" :y="ghost.y - 12"
                  text-anchor="middle" font-size="8"
                  fill="var(--p-primary-color)">{{ ghost.label }}</text>
          </g>

          <!-- ══════════════════════════
               ЦЕЛЬ — верхний правый угол
          ══════════════════════════ -->
          <g :transform="`translate(${SVG_W - 18}, 14)`" filter="url(#goal-glow)">
            <circle r="20" fill="#fbbf2418" stroke="#fbbf24" stroke-width="1.5"
                    stroke-dasharray="4,3" />
            <circle r="12" fill="#fbbf2430" />
            <text x="0" y="5" text-anchor="middle" font-size="16">🏁</text>
          </g>
          <text :x="SVG_W - 18" y="46"
                text-anchor="middle" font-size="9" fill="#fbbf24" font-weight="700">ФОР-КЛАСТЕР</text>

          <!-- ══════════════════════════
               ПРОЕКТ — точка
               Пьяный матрос или линия операции
          ══════════════════════════ -->
          <g :transform="`translate(${projectX}, ${projectY})`"
             style="transition: transform 1.2s cubic-bezier(0.16,1,0.3,1)"
             filter="url(#project-glow)">
            <!-- Три режима: стагнация / Шлиман / линия -->
            <g :class="isStagnant ? 'smap-drunk' : isSchlimann ? 'smap-schlimann' : ''">
              <circle r="22" fill="var(--p-primary-color)" opacity="0.06" />
              <circle r="14" fill="var(--p-primary-color)" opacity="0.1" />
              <circle r="9"  fill="var(--p-primary-color)" opacity="0.9"
                      stroke="var(--p-surface-card)" stroke-width="2.5" />
              <circle r="9"  fill="none"
                      stroke="var(--p-primary-color)" stroke-width="1.5"
                      opacity="0.5" class="smap-pulse" />
              <!-- Иконка состояния -->
              <text x="0" y="3.5" text-anchor="middle" font-size="8" fill="white" font-weight="900">
                {{ isStagnant ? '?' : isSchlimann ? '⚡' : '→' }}
              </text>
            </g>
          </g>

          <!-- Метка проекта -->
          <text
            :x="Math.min(SVG_W - 44, Math.max(44, projectX))"
            :y="Math.max(18, projectY - 20)"
            text-anchor="middle" font-size="10" font-weight="700"
            fill="var(--p-primary-color)">{{ companyName }}</text>

        </g>

        <!-- Ось Y label -->
        <text x="12" :y="LABEL_TOP + SVG_H/2"
              text-anchor="middle" font-size="10" fill="var(--p-text-muted-color)" font-weight="600"
              :transform="`rotate(-90, 12, ${LABEL_TOP + SVG_H/2})`">← Темп / Кристаллизация →</text>

      </svg>
    </div>

    <!-- ── Тактическая сводка ──────────────────────────────────── -->
    <div class="smap-tactical">
      <div class="smap-tact-item">
        <span class="smap-tact-label">Свобода манёвра</span>
        <div class="smap-tact-bar">
          <div class="smap-tact-fill smap-tact-fill--x"
               :style="{ width: (projectFreedom / 10 * 100) + '%' }" />
        </div>
        <span class="smap-tact-val">{{ projectFreedom.toFixed(1) }}</span>
      </div>
      <div class="smap-tact-item">
        <span class="smap-tact-label">Темп операции</span>
        <div class="smap-tact-bar">
          <div class="smap-tact-fill smap-tact-fill--y"
               :style="{ width: (projectTempo / 10 * 100) + '%' }" />
        </div>
        <span class="smap-tact-val">{{ projectTempo.toFixed(1) }}</span>
      </div>
      <div class="smap-tact-status"
           :class="isStagnant ? 'smap-tact-status--warn' : isSchlimann ? 'smap-tact-status--schlimann' : 'smap-tact-status--ok'">
        <span v-if="isStagnant">🥴 Стагнация — нет движения</span>
        <span v-else-if="isSchlimann">⚡ Стратегия Шлимана — враг опаздывает</span>
        <span v-else>🎯 Линия операции — кристаллизация</span>
      </div>
      <div v-if="enemyNotReacted" class="smap-tact-shadow smap-tact-enemy">
        <span>👮 Враг ещё не среагировал:</span>
        <span style="font-weight:700;margin-left:4px;color:#22c55e">{{ 14 - enemyReactionDays }}д окно</span>
      </div>
      <div v-else-if="fundShadowPct > 5" class="smap-tact-shadow">
        <span>🌑 Тень фонда:</span>
        <span style="font-weight:700;margin-left:4px">{{ fundShadowPct.toFixed(0) }}% закрыто</span>
      </div>
    </div>

    <!-- ── Статус туннелей ─────────────────────────────────────── -->
    <div class="smap-tunnels-status">
      <div v-for="t in TUNNELS" :key="t.bossId+'s'"
           :class="['smap-tunnel-tag',
                    { 'smap-tunnel-tag--open': isTunnelOpen(t),
                      'smap-tunnel-tag--used': isDefeated(t.bossId) }]">
        <span class="smap-tunnel-icon">⚛</span>
        <span>{{ t.label }}</span>
        <span class="smap-tunnel-state">
          {{ isDefeated(t.bossId) ? 'использован' : isTunnelOpen(t) ? 'ОТКРЫТ' : 'заперт' }}
        </span>
      </div>
    </div>

    <div class="smap-hint">
      <i class="pi pi-info-circle" />
      <span>
        <b>Стратегия Шлимана</b> — действуем там где можем:
        пока враг собирается туда, мы уже в другом месте.
        Квантовый туннель = прыжок до того как босс выставил охрану.
        Цель — <b>Фор-кластер</b>: рынок, которого ещё нет.
        <span style="opacity:0.5;font-size:9px">— Переслегин</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'

const props = defineProps({
  events:      { type: Array,  default: () => [] },
  companyName: { type: String, default: 'Проект' },
  startTrl:    { type: Number, default: 3 },
})

const SVG_W        = 480
const SVG_H        = 300
const LABEL_LEFT   = 44
const LABEL_RIGHT  = 24
const LABEL_TOP    = 16
const LABEL_BOTTOM = 62

// ─── Зоны X: Свобода манёвра ──────────────────────────────────────────────────
const XZONES = [
  { label: 'Блокировка', cx: 0.125 },
  { label: 'Ограничен',  cx: 0.375 },
  { label: 'Манёвр',     cx: 0.625 },
  { label: 'Инициатива', cx: 0.875 },
]

// ─── Зоны Y: Темп операции ────────────────────────────────────────────────────
const YZONES = [
  { label: 'Доминир.',  t: 9   },
  { label: 'Прорыв',    t: 7   },
  { label: 'Темп',      t: 4.5 },
  { label: 'Стагнация', t: 1.5 },
]

// ─── Барьеры в новых координатах (x1,x2 — доли SVG_W; t1,t2 — темп) ─────────
const BARRIERS = [
  { bossId: 'tech_gap',           label: 'Технол. разрыв',  emoji: '⚙️', color: '#3b82f6',
    x1: 0.00, x2: 0.45, t1: 3, t2: 7 },
  { bossId: 'market_failure',     label: 'Провал рынка',    emoji: '📉', color: '#f59e0b',
    x1: 0.28, x2: 0.62, t1: 0, t2: 5 },
  { bossId: 'regulatory_barrier', label: 'Рег. барьер',     emoji: '🏛️', color: '#ef4444',
    x1: 0.42, x2: 1.00, t1: 5, t2: 8 },
  { bossId: 'infra_gap',          label: 'Инфра пробел',    emoji: '🏗️', color: '#8b5cf6',
    x1: 0.68, x2: 1.00, t1: 8, t2: 10 },
]

// ─── Квантовые туннели ────────────────────────────────────────────────────────
// px — позиция X [0..1], tempo — темп портала
const TUNNELS = [
  {
    bossId:    'tech_gap',
    label:     'НИОКР-прорыв',
    px:        0.18, tempo: 5,
    exitPx:    0.48, exitTempo: 5,
    condition: evts => evts.some(e => e.type === 'WORKING_GROUP_FORMED'),
  },
  {
    bossId:    'market_failure',
    label:     'Гос. контракт',
    px:        0.44, tempo: 2.5,
    exitPx:    0.65, exitTempo: 2.5,
    condition: evts => evts.some(e => e.type === 'MEASURE_APPLIED'),
  },
  {
    bossId:    'regulatory_barrier',
    label:     'Лоббирование НТИ',
    px:        0.72, tempo: 6.5,
    exitPx:    1.00, exitTempo: 6.5,
    condition: evts => evts.some(e => e.type === 'MEASURE_APPROVED'),
  },
  {
    bossId:    'infra_gap',
    label:     'Нац. полигон',
    px:        0.84, tempo: 9,
    exitPx:    1.00, exitTempo: 9,
    condition: evts => evts.some(e => e.type === 'MEASURE_FUNDED'),
  },
]

// ─── Состояния боссов ─────────────────────────────────────────────────────────
const bossStates = computed(() => {
  const map = {}
  for (const b of GR_BOSSES) map[b.id] = getBossState(b, props.events)
  return map
})

function isDefeated(id)  { return bossStates.value[id]?.defeated === true }
function bossHpPct(id)   { return bossStates.value[id]?.hpPercent ?? 100 }
function isTunnelOpen(t) { return !isDefeated(t.bossId) && t.condition(props.events) }

// ─── Координатные преобразования ─────────────────────────────────────────────
// tempoToY: темп 0→SVG_H (низ), 10→0 (верх)
function tempoToY(tempo) { return ((10 - tempo) / 10) * SVG_H }

// ─── Позиция проекта ──────────────────────────────────────────────────────────
// X = Свобода манёвра — накапливается из GR-событий + поражений боссов
const projectFreedom = computed(() => {
  let s = 0.5
  for (const e of props.events) {
    if (e.type === 'PROJECT_INITIATED')      s += 0.6
    if (e.type === 'WORKING_GROUP_FORMED')   s += 1.0
    if (e.type === 'MEASURE_APPLIED')        s += 0.8
    if (e.type === 'MEASURE_APPROVED')       s += 1.4
    if (e.type === 'MEASURE_FUNDED')         s += 2.2
    if (e.type === 'COUNTERMEASURE_ISSUED')  s -= 0.5
  }
  s += Object.values(bossStates.value).filter(b => b?.defeated).length * 1.5
  return Math.min(9.8, Math.max(0.2, s))
})

// Y = Темп операции — скорость в пространстве позиций
const projectTempo = computed(() => {
  let s = 0.5
  for (const e of props.events) {
    if (e.type === 'PROJECT_INITIATED')      s += 0.5
    if (e.type === 'WORKING_GROUP_FORMED')   s += 1.2
    if (e.type === 'MEASURE_APPLIED')        s += 1.0
    if (e.type === 'MEASURE_APPROVED')       s += 1.5
    if (e.type === 'MEASURE_FUNDED')         s += 2.0
    if (e.type === 'COUNTERMEASURE_ISSUED')  s -= 0.3
  }
  // Бонус за недавние события (последние 30 дней — высокий темп)
  const now = Date.now()
  const recent = props.events.filter(e => now - new Date(e.ts).getTime() < 30 * 86400000)
  s += recent.length * 0.25
  return Math.min(9.8, Math.max(0.2, s))
})

const projectX = computed(() => (projectFreedom.value / 10) * SVG_W)
const projectY = computed(() => tempoToY(projectTempo.value))

// ─── Три режима движения ──────────────────────────────────────────────────────
// СТАГНАЦИЯ: нет событий
// ШЛИМАН:    есть события, но темп < 6 (быстрые непредсказуемые прыжки)
// ЛИНИЯ:     темп >= 6 (кристаллизация, направленный вектор)
const isStagnant  = computed(() => props.events.length < 2)
const isSchlimann = computed(() => !isStagnant.value && projectTempo.value < 6)
const isLinear    = computed(() => projectTempo.value >= 6)

// ─── Следы прошлых позиций (регулятор опоздал) ───────────────────────────────
// Каждое событие — это прыжок. Показываем последние N позиций "до прыжка"
const positionTrail = computed(() => {
  if (props.events.length < 2) return []
  const trail = []
  // Симулируем позиции без последних 1/2/3 событий
  const evtTypes = ['MEASURE_FUNDED', 'MEASURE_APPROVED', 'MEASURE_APPLIED', 'WORKING_GROUP_FORMED']
  let prevEvents = [...props.events]
  for (let skip = 1; skip <= Math.min(3, props.events.length - 1); skip++) {
    // Убираем последние skip событий значимых типов
    const significantIdx = [...prevEvents].reverse().findIndex(e => evtTypes.includes(e.type))
    if (significantIdx < 0) break
    const realIdx = prevEvents.length - 1 - significantIdx
    prevEvents = prevEvents.filter((_, i) => i !== realIdx)
    // Вычисляем позицию для усечённого набора
    let f = 0.5, t = 0.5
    for (const e of prevEvents) {
      if (e.type === 'PROJECT_INITIATED')      { f += 0.6; t += 0.5 }
      if (e.type === 'WORKING_GROUP_FORMED')   { f += 1.0; t += 1.2 }
      if (e.type === 'MEASURE_APPLIED')        { f += 0.8; t += 1.0 }
      if (e.type === 'MEASURE_APPROVED')       { f += 1.4; t += 1.5 }
      if (e.type === 'MEASURE_FUNDED')         { f += 2.2; t += 2.0 }
    }
    const bs = {}
    for (const b of GR_BOSSES) bs[b.id] = getBossState(b, prevEvents)
    f += Object.values(bs).filter(b => b?.defeated).length * 1.5
    trail.push({
      x: Math.min(9.8, Math.max(0.2, f)) / 10 * SVG_W,
      y: tempoToY(Math.min(9.8, Math.max(0.2, t))),
      age: skip,   // 1 = только что, 3 = давно
    })
  }
  return trail
})

// ─── Счётчик реакции врага ────────────────────────────────────────────────────
// Сколько дней прошло с последнего события (враг ещё не среагировал < 14 дней)
const enemyReactionDays = computed(() => {
  if (!props.events.length) return null
  const lastEvt = props.events[props.events.length - 1]
  if (!lastEvt.ts) return null
  const days = Math.floor((Date.now() - new Date(lastEvt.ts).getTime()) / 86400000)
  return days
})
const enemyNotReacted = computed(() => enemyReactionDays.value !== null && enemyReactionDays.value < 14)

// ─── Оперативная тень фонда ──────────────────────────────────────────────────
// Прямоугольник от нижнего-левого угла до позиции проекта
const shadowPath = computed(() => {
  const px = projectX.value, py = projectY.value
  return `M 0 ${SVG_H} L ${px} ${SVG_H} L ${px} ${py} L 0 ${py} Z`
})

// Процент карты накрытый тенью
const fundShadowPct = computed(() => {
  return (projectFreedom.value / 10) * ((10 - projectTempo.value) / 10 * 0 + projectTempo.value / 10) * 100
})

// ─── Линия операции (вектор движения к цели) ──────────────────────────────────
const goalX = SVG_W - 18
const goalY = 14

const directionArrow = computed(() => {
  if (props.events.length < 1) return null
  const sx = projectX.value, sy = projectY.value
  const dx = goalX - sx, dy = goalY - sy
  const len = Math.sqrt(dx*dx + dy*dy)
  if (len < 30) return null
  // Длина стрелки зависит от темпа
  const arrowLen = 35 + (projectTempo.value / 10) * 35
  return {
    x1: sx,
    y1: sy,
    x2: sx + (dx / len) * arrowLen,
    y2: sy + (dy / len) * arrowLen,
  }
})

// ─── Путь к цели ─────────────────────────────────────────────────────────────
const mainPathD = computed(() => {
  const sx = projectX.value, sy = projectY.value
  const cx = (sx + goalX) / 2
  return `M ${sx} ${sy} Q ${cx} ${sy} ${cx} ${(sy + goalY) / 2} T ${goalX} ${goalY}`
})

const quantumPathD = computed(() => {
  const t = TUNNELS.find(t => isTunnelOpen(t))
  if (!t) return null
  const sx = projectX.value, sy = projectY.value
  const tx = t.px * SVG_W,          ty = tempoToY(t.tempo)
  const ex = t.exitPx * SVG_W,      ey = tempoToY(t.exitTempo)
  return `M ${sx} ${sy} L ${tx} ${ty} M ${ex} ${ey} Q ${(ex+goalX)/2} ${ey} ${goalX} ${goalY}`
})

// ─── Близость к туннелю ───────────────────────────────────────────────────────
function isNearTunnel(t) {
  const dx = projectX.value - t.px * SVG_W
  const dy = projectY.value - tempoToY(t.tempo)
  return Math.sqrt(dx*dx + dy*dy) < 80
}

// ─── Туннельный путь ─────────────────────────────────────────────────────────
function tunnelPath(t) {
  const tx = t.px * SVG_W,    ty = tempoToY(t.tempo)
  const ex = t.exitPx * SVG_W, ey = tempoToY(t.exitTempo)
  return `M ${tx} ${ty} C ${tx+20} ${ty}, ${ex-20} ${ey}, ${ex} ${ey}`
}

// ─── Вероятностное облако ────────────────────────────────────────────────────
const ghostPositions = computed(() => {
  if (!props.events.length) return []
  const ghosts = []
  if (props.events.some(e => e.type === 'MEASURE_APPLIED') &&
      !props.events.some(e => e.type === 'MEASURE_FUNDED')) {
    ghosts.push({
      x: projectX.value + 55,
      y: projectY.value - 25,
      label: '+финансир.',
    })
  }
  if (projectFreedom.value < 7) {
    ghosts.push({
      x: projectX.value + 20,
      y: projectY.value - 18,
      label: '+манёвр',
    })
  }
  return ghosts
})
</script>

<style scoped>
.smap-wrap { display: flex; flex-direction: column; gap: 8px; }

.smap-legend {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 10px; color: var(--p-text-muted-color); padding: 0 4px;
}
.smap-legend-item { display: flex; align-items: center; gap: 5px; }
.smap-legend-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: opacity 0.5s; }
.smap-legend-dot--tunnel { background: #06b6d4; box-shadow: 0 0 6px #06b6d4; }

.smap-container { overflow-x: auto; min-height: 120px; }
.smap-svg { display: block; width: 100%; height: auto; min-height: 200px; }

/* Пульс проекта */
@keyframes smap-pulse {
  0%   { r: 9;  opacity: 0.5; }
  100% { r: 24; opacity: 0; }
}
.smap-pulse { animation: smap-pulse 2.2s ease-out infinite; }

/* Пьяный матрос — медленное броуновское блуждание (стагнация) */
@keyframes drunk-sailor {
  0%   { transform: translate(0px,   0px); }
  10%  { transform: translate(-3px,  2px); }
  20%  { transform: translate(4px,  -3px); }
  30%  { transform: translate(-2px,  4px); }
  40%  { transform: translate(3px,   1px); }
  50%  { transform: translate(-4px, -2px); }
  60%  { transform: translate(2px,   3px); }
  70%  { transform: translate(-3px, -4px); }
  80%  { transform: translate(4px,  -1px); }
  90%  { transform: translate(-1px,  3px); }
  100% { transform: translate(0px,   0px); }
}
.smap-drunk { animation: drunk-sailor 2.4s ease-in-out infinite; }

/* Стратегия Шлимана — быстрые непредсказуемые прыжки (враг не успевает) */
@keyframes schlimann {
  0%   { transform: translate(0px,   0px)  scale(1); }
  8%   { transform: translate(5px,  -4px)  scale(1.1); }
  16%  { transform: translate(-3px,  6px)  scale(0.95); }
  24%  { transform: translate(7px,   2px)  scale(1.08); }
  32%  { transform: translate(-5px, -3px)  scale(1); }
  40%  { transform: translate(4px,   5px)  scale(1.05); }
  48%  { transform: translate(-6px,  1px)  scale(0.97); }
  56%  { transform: translate(3px,  -5px)  scale(1.1); }
  64%  { transform: translate(-2px,  4px)  scale(1); }
  72%  { transform: translate(6px,  -2px)  scale(1.06); }
  80%  { transform: translate(-4px, -4px)  scale(0.98); }
  90%  { transform: translate(2px,   3px)  scale(1.03); }
  100% { transform: translate(0px,   0px)  scale(1); }
}
.smap-schlimann { animation: schlimann 1.1s ease-in-out infinite; }

/* Пульс туннеля */
@keyframes tunnel-pulse {
  0%,100% { opacity: 0.4; transform: scale(1); }
  50%     { opacity: 0.9; transform: scale(1.3); }
}
.smap-tunnel-pulse { animation: tunnel-pulse 1.5s ease infinite; transform-origin: center; }

/* Тактическая сводка */
.smap-tactical {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 6px 10px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  font-size: 10px;
}
.smap-tact-item {
  display: flex; align-items: center; gap: 6px;
}
.smap-tact-label {
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.smap-tact-bar {
  width: 60px; height: 5px;
  background: var(--p-content-border-color);
  border-radius: 3px; overflow: hidden;
}
.smap-tact-fill {
  height: 100%; border-radius: 3px;
  transition: width 0.7s cubic-bezier(0.16,1,0.3,1);
}
.smap-tact-fill--x { background: var(--p-primary-color); }
.smap-tact-fill--y { background: #22c55e; }
.smap-tact-val { font-weight: 700; color: var(--p-text-color); }
.smap-tact-status {
  margin-left: auto; font-size: 10px; font-weight: 600; padding: 2px 8px;
  border-radius: 8px;
}
.smap-tact-status--warn      { background: #f59e0b18; color: #f59e0b; }
.smap-tact-status--schlimann { background: #06b6d418; color: #06b6d4;
  animation: schlimann-badge 1.5s ease-in-out infinite; }
.smap-tact-status--ok        { background: #22c55e18; color: #22c55e; }
@keyframes schlimann-badge {
  0%,100% { box-shadow: 0 0 0 0 #06b6d430; }
  50%     { box-shadow: 0 0 0 4px #06b6d420; }
}
.smap-tact-shadow    { font-size: 10px; color: var(--p-text-muted-color); white-space: nowrap; }
.smap-tact-enemy     { color: #22c55e; }

/* Статус туннелей */
.smap-tunnels-status { display: flex; gap: 6px; flex-wrap: wrap; }
.smap-tunnel-tag {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; padding: 3px 8px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px; color: var(--p-text-muted-color);
  opacity: 0.5; transition: all 0.4s;
}
.smap-tunnel-tag--open {
  border-color: #06b6d488; color: #06b6d4;
  opacity: 1; box-shadow: 0 0 8px #06b6d430;
}
.smap-tunnel-tag--used {
  border-color: #22c55e44; color: #22c55e;
  opacity: 0.6; text-decoration: line-through;
}
.smap-tunnel-icon { font-size: 11px; }
.smap-tunnel-state {
  font-weight: 700; text-transform: uppercase;
  font-size: 9px; letter-spacing: 0.04em;
}

.smap-hint {
  font-size: 10px; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 5px;
  font-style: italic; padding: 0 4px; line-height: 1.5;
}
</style>

<template>
  <div ref="blockEl" class="spb" :class="themeClass">

    <!-- ── Шапка ── -->
    <div class="spb-header">
      <div class="spb-header-row">
        <SelectButton
          v-model="viewMode"
          :options="VIEW_OPTIONS"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          size="small"
        />
        <div class="spb-controls">
          <Select
            v-model="selectedModelId"
            :options="models"
            optionLabel="name"
            optionValue="id"
            placeholder="Модель..."
            :loading="loading || aiLoading"
            size="small"
            style="min-width:200px"
            @change="onModelChange"
          />
          <ProgressSpinner v-if="aiLoading" style="width:20px;height:20px" strokeWidth="4" />
          <!-- Кнопка настроек -->
          <Button
            icon="pi pi-sliders-h"
            severity="secondary"
            text
            size="small"
            v-tooltip.bottom="'Настройки отображения'"
            @click="settingsVisible = !settingsVisible"
            :outlined="settingsVisible"
          />
        </div>
      </div>

      <!-- Панель настроек (inline коллапс) -->
      <div v-if="settingsVisible" class="spb-settings">
        <div class="spb-settings-title">Настройки пирамиды</div>
        <div class="spb-settings-row">
          <ToggleSwitch v-model="showBandFill" inputId="fill-toggle" />
          <label for="fill-toggle" class="spb-settings-label">Заливка уровней цветом</label>
        </div>
        <div class="spb-settings-row">
          <ToggleSwitch v-model="showBrickTint" inputId="tint-toggle" />
          <label for="tint-toggle" class="spb-settings-label">Подсветка кирпичей по статусу</label>
        </div>
        <div class="spb-settings-row">
          <ToggleSwitch v-model="thickSeparators" inputId="sep-toggle" />
          <label for="sep-toggle" class="spb-settings-label">Толстые разделители уровней</label>
        </div>
      </div>

      <!-- Легенда — цветные пилюли -->
      <div v-if="viewMode === 'страны'" class="spb-legend">
        <span class="leg-pill" style="--dot:#22c55e">Оба КЛЮЧ</span>
        <span class="leg-pill" style="--dot:#ef4444">Оба КРИЗИС</span>
        <span class="leg-pill" style="--dot:#3b82f6">Экспортный потенциал</span>
        <span class="leg-pill" style="--dot:#a855f7">Совместность</span>
        <span class="leg-pill" style="--dot:#f59e0b">ШАНС</span>
        <span class="leg-pill-note">кружок: левая половина — страна 1, правая — страна 2</span>
      </div>
      <div v-else-if="viewMode === 'портфель'" class="spb-legend">
        <span
          v-for="(co, i) in portfolioCompanies" :key="co.id"
          class="leg-pill"
          :style="{ '--dot': COMPANY_COLORS[i % COMPANY_COLORS.length], opacity: activeCo.size && !activeCo.has(co.id) ? 0.4 : 1 }"
        >{{ co.name }}</span>
        <span class="leg-pill" style="--dot:rgba(100,116,139,0.5)">Белое пятно</span>
      </div>
      <div v-else class="spb-legend">
        <span class="leg-pill" style="--dot:#22c55e">Оба покрывают</span>
        <span class="leg-pill" style="--dot:#3b82f6">Только ФСТ НТИ</span>
        <span class="leg-pill" :style="{ '--dot': '#f59e0b' }">Только {{ otherFundName }}</span>
        <span class="leg-pill" style="--dot:rgba(100,116,139,0.4)">Не покрыто</span>
      </div>
    </div>

    <!-- ── Загрузка ── -->
    <div v-if="loading" class="spb-loading">
      <ProgressSpinner style="width:32px;height:32px" />
      <span>Загрузка пирамиды...</span>
    </div>

    <!-- ── Основная строка ── -->
    <div v-else class="spb-main-row">

      <!-- Левая панель -->
      <div class="spb-panel">
        <!-- Страны -->
        <template v-if="viewMode === 'страны'">
          <div class="panel-label">Страна 1</div>
          <div
            v-for="c in countries" :key="'l-'+c.id"
            class="panel-item flag-item"
            :class="{ active: selectedCountry1?.id === c.id }"
            @click="selectedCountry1 = c"
          >
            <component :is="c.flagComponent" v-if="c.flagComponent" :width="34" :height="23" class="panel-flag" />
            <span>{{ c.name }}</span>
          </div>
        </template>

        <!-- Портфель: список компаний с переключением -->
        <template v-else-if="viewMode === 'портфель'">
          <div class="panel-label">Наш портфель</div>
          <div
            v-for="(co, i) in portfolioCompanies" :key="co.id"
            class="panel-item company-item"
            :class="{ active: activeCo.size === 0 || activeCo.has(co.id) }"
            @click="toggleCo(co.id)"
          >
            <span class="co-dot" :style="{ background: COMPANY_COLORS[i % COMPANY_COLORS.length] }"></span>
            {{ co.name }}
          </div>
          <div v-if="portfolioCompanies.length === 0" class="panel-empty">Нет компаний в портфеле</div>
          <div class="panel-score-row" v-if="portfolioCompanies.length">
            <span class="panel-sublabel">Белых пятен:</span>
            <span class="panel-score" style="color:var(--fst-red)">{{ whiteSpotsCount }}</span>
          </div>
          <div class="panel-score-row">
            <span class="panel-sublabel">Покрыто:</span>
            <span class="panel-score" style="color:var(--fst-green)">{{ coveredCount }}/{{ totalBricks }}</span>
          </div>
        </template>

        <!-- Фонды: наш портфель -->
        <template v-else>
          <div class="panel-label">ФСТ НТИ</div>
          <div
            v-for="co in portfolioCompanies" :key="'fst-'+co.id"
            class="panel-item"
            :class="{ active: fstActiveCo.has(co.id) }"
            @click="toggleFstCo(co.id)"
          >
            <span class="co-dot" style="background:var(--fst-blue)"></span>
            {{ co.name }}
          </div>
          <div v-if="portfolioCompanies.length === 0" class="panel-empty">Нет компаний</div>
        </template>
      </div>

      <!-- SVG Пирамида -->
      <div class="spb-svg-wrap">
        <div v-if="!bands.length" class="spb-empty">
          <i class="pi pi-info-circle"></i> Выберите модель пирамиды
        </div>
        <svg
          v-else
          :viewBox="`0 0 ${VW} ${VH}`"
          preserveAspectRatio="xMidYMid meet"
          class="spb-svg"
          @mouseleave="hideTooltip"
        >
          <defs>
            <clipPath v-for="(band, i) in bands" :key="'cp-'+i" :id="`spcp-${_uid}-${i}`">
              <polygon :points="band.outerPoints" />
            </clipPath>
          </defs>

          <rect :width="VW" :height="VH" fill="transparent" />

          <g v-for="(band, bi) in bands" :key="'b-'+bi">

            <!-- ① Заливка полосы (только если включена) -->
            <polygon
              v-if="showBandFill"
              :points="band.outerPoints"
              :fill="band.color"
              fill-opacity="0.88"
            />

            <!-- ② Кирпичи (обрезаны по форме полосы) -->
            <g :clip-path="`url(#spcp-${_uid}-${bi})`">
              <g
                v-for="(brick, ci) in band.bricks"
                :key="'br-'+ci"
                class="spb-brick"
                @mouseenter="showTooltip(brick, $event)"
                @mousemove="moveTooltip($event)"
                @mouseleave="hideTooltip"
                @click="openModal(brick)"
              >
                <!-- Вертикальный разделитель кирпичей (обрезан выше кругов) -->
                <line
                  v-if="ci > 0"
                  :x1="brick.x" :y1="band.topY + 4"
                  :x2="brick.x" :y2="band.botY - 16"
                  :stroke="showBandFill ? 'rgba(255,255,255,0.22)' : outlineColor"
                  stroke-width="1"
                  :opacity="showBandFill ? 1 : 0.2"
                />

                <!-- Индикаторные круги в нижней части кирпича -->
                <template v-if="viewMode==='страны'">
                  <!-- Один круг с двумя половинками: левая = страна 1, правая = страна 2 -->
                  <path
                    :d="`M ${brick.cx},${band.botY-14} m 0,-5 a 5,5 0 0,0 0,10 z`"
                    :fill="country1Status(brick.techId) ? LEVEL_COLORS[country1Status(brick.techId)] : (showBandFill ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.18)')"
                  />
                  <path
                    :d="`M ${brick.cx},${band.botY-14} m 0,-5 a 5,5 0 0,1 0,10 z`"
                    :fill="country2Status(brick.techId) ? LEVEL_COLORS[country2Status(brick.techId)] : (showBandFill ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.18)')"
                  />
                  <circle
                    :cx="brick.cx" :cy="band.botY-14" r="5"
                    fill="none"
                    :stroke="showBandFill ? 'rgba(255,255,255,0.5)' : outlineColor"
                    stroke-width="1"
                  />
                </template>

                <template v-else-if="viewMode==='портфель'">
                  <!-- Круг на каждую компанию, центрируем группу по кирпичу -->
                  <circle
                    v-for="(dot, di) in brickCompanyDots(brick.techId).slice(0, 5)"
                    :key="di"
                    :cx="brick.cx - (Math.min(brickCompanyDots(brick.techId).length,5)-1)*5 + di*10"
                    :cy="band.botY - 14"
                    r="4"
                    :fill="dot.color"
                    :stroke="showBandFill ? 'rgba(255,255,255,0.5)' : outlineColor"
                    stroke-width="1"
                  />
                  <!-- Пустой круг если никто не покрывает -->
                  <circle
                    v-if="!brickCompanyDots(brick.techId).length"
                    :cx="brick.cx"
                    :cy="band.botY - 14"
                    r="4"
                    fill="rgba(100,116,139,0.18)"
                    :stroke="showBandFill ? 'rgba(255,255,255,0.2)' : outlineColor"
                    stroke-width="1"
                    stroke-dasharray="2 2"
                  />
                </template>

                <template v-else-if="viewMode==='фонды'">
                  <!-- Один круг с двумя половинками: левая = ФСТ НТИ, правая = внешний фонд -->
                  <path
                    :d="`M ${brick.cx},${band.botY-14} m 0,-5 a 5,5 0 0,0 0,10 z`"
                    :fill="fstCovers(brick.techId) ? 'var(--fst-blue)' : (showBandFill ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.18)')"
                  />
                  <path
                    :d="`M ${brick.cx},${band.botY-14} m 0,-5 a 5,5 0 0,1 0,10 z`"
                    :fill="extCovers(brick.techId) ? 'var(--fst-brand)' : (showBandFill ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.18)')"
                  />
                  <circle
                    :cx="brick.cx" :cy="band.botY-14" r="5"
                    fill="none"
                    :stroke="showBandFill ? 'rgba(255,255,255,0.5)' : outlineColor"
                    stroke-width="1"
                  />
                </template>

                <!-- Лёгкая подсветка кирпича по статусу (если включена, без заливки полос) -->
                <rect
                  v-if="showBrickTint && !showBandFill"
                  :x="brick.x + 1.5"
                  :y="band.topY + (bi===0 ? 8 : 4)"
                  :width="Math.max(brick.w - 3, 1)"
                  :height="band.botY - band.topY - (bi===0 ? 18 : 10)"
                  :fill="brickTintColor(brick.techId)"
                  rx="3"
                />

                <!-- Индекс технологии — цвет зависит от заливки -->
                <text
                  :x="brick.cx"
                  :y="band.textY"
                  text-anchor="middle"
                  dominant-baseline="central"
                  :font-size="band.fontSize"
                  :font-weight="showBandFill ? '300' : '600'"
                  font-family="'Space Grotesk', system-ui, sans-serif"
                  letter-spacing="1"
                  :fill="showBandFill ? 'rgba(255,255,255,0.92)' : brickLabelColor(brick.techId)"
                  class="brick-text"
                >{{ brick.code }}</text>
              </g>
            </g>

            <!-- ③ Разделитель между уровнями:
                 с заливкой  → толстый sepColor (цвет фона = «вырезанный паз»)
                 без заливки → тонкая видимая линия outlineColor -->
            <line
              v-if="bi > 0"
              :x1="band.topLeft - 2" :y1="band.topY"
              :x2="band.topRight + 2" :y2="band.topY"
              :stroke="showBandFill ? sepColor : outlineColor"
              :stroke-width="showBandFill ? (thickSeparators ? 10 : 2) : 1"
              stroke-linecap="square"
              :opacity="showBandFill ? 1 : 0.35"
            />

            <!-- ④ Метка категории слева от пирамиды -->
            <rect :x="6" :y="band.midY - 8" width="3" height="14" :fill="showBandFill ? band.color : outlineColor" rx="1" opacity="0.6" />
            <text
              :x="15" :y="band.midY + 3"
              text-anchor="start"
              :fill="isDark ? '#94a3b8' : '#475569'"
              :font-size="sideLabelFontSize"
              font-weight="600"
              font-family="'Space Grotesk', system-ui, sans-serif"
              letter-spacing="0.4"
            >{{ band.name }}</text>

            <!-- ⑤ Счёт справа -->
            <text
              :x="VW - 10" :y="band.midY + 3"
              text-anchor="end"
              :fill="bandScoreColor(band)"
              :font-size="sideLabelFontSize"
              font-weight="700"
              font-family="'Space Grotesk', system-ui, sans-serif"
            >{{ bandScore(band) }}</text>
          </g>

          <!-- Контур пирамиды — всегда видимый -->
          <polygon
            :points="`${APEX.x},${APEX.y} ${BASE_RIGHT},${BASE_Y} ${BASE_LEFT},${BASE_Y}`"
            fill="none"
            :stroke="outlineColor"
            stroke-width="2.5"
            stroke-linejoin="round"
            opacity="0.6"
          />
          <!-- Поверх с заливкой — толстый sepColor как «оправа» между полосами и краем -->
          <polygon
            v-if="showBandFill"
            :points="`${APEX.x},${APEX.y} ${BASE_RIGHT},${BASE_Y} ${BASE_LEFT},${BASE_Y}`"
            fill="none"
            :stroke="sepColor"
            stroke-width="10.5"
            stroke-linejoin="miter"
          />
        </svg>
      </div>

      <!-- Правая панель -->
      <div class="spb-panel">
        <!-- Страны -->
        <template v-if="viewMode === 'страны'">
          <div class="panel-label">Страна 2</div>
          <div
            v-for="c in countries" :key="'r-'+c.id"
            class="panel-item flag-item"
            :class="{ active: selectedCountry2?.id === c.id }"
            @click="selectedCountry2 = c"
          >
            <component :is="c.flagComponent" v-if="c.flagComponent" :width="34" :height="23" class="panel-flag" />
            <span>{{ c.name }}</span>
          </div>
        </template>

        <!-- Портфель: матрица совместности компаний -->
        <template v-else-if="viewMode === 'портфель'">
          <div class="panel-label">Совместность</div>
          <div v-if="portfolioCompanies.length < 2" class="panel-empty">Нужно ≥ 2 компании</div>
          <div v-else class="compat-list">
            <div v-for="pair in compatibilityPairs" :key="pair.key" class="compat-row">
              <div class="compat-names">{{ pair.name1 }} ↔ {{ pair.name2 }}</div>
              <div class="compat-bar-wrap">
                <div class="compat-bar" :style="{ width: pair.score + '%', background: pair.color }"></div>
              </div>
              <div class="compat-pct" :style="{ color: pair.color }">{{ pair.score }}%</div>
            </div>
          </div>
        </template>

        <!-- Фонды: выбор другого фонда + компании -->
        <template v-else>
          <div class="panel-label">Другой фонд</div>
          <div
            v-for="fund in OTHER_FUNDS" :key="fund.id"
            class="panel-item fund-item"
            :class="{ active: selectedOtherFund === fund.id }"
            @click="selectedOtherFund = fund.id"
          >
            {{ fund.name }}
          </div>
          <template v-if="selectedOtherFund">
            <div class="panel-sublabel">Компании фонда</div>
            <div
              v-for="co in otherFundCompanies" :key="'ext-'+co.id"
              class="panel-item sub-item"
              :class="{ active: extActiveCo.has(co.id) }"
              @click="toggleExtCo(co.id)"
            >
              <span class="co-dot" style="background:var(--fst-brand)"></span>
              {{ co.name }}
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- ── Тултип ── -->
    <Teleport to="body">
      <div v-if="tt.visible" class="spb-tooltip" :style="{ left: tt.x+'px', top: tt.y+'px' }">
        <div class="spb-tt-top">
          <!-- Индикатор режима -->
          <div class="spb-tt-indicator">
            <div class="spb-tt-half" :style="{ background: tt.left  || 'rgba(100,116,139,0.3)' }"></div>
            <div class="spb-tt-half" :style="{ background: tt.right || 'rgba(100,116,139,0.3)' }"></div>
          </div>
          <div>
            <div class="spb-tt-code">{{ tt.code }}</div>
            <div class="spb-tt-name">{{ tt.name }}</div>
          </div>
        </div>
        <div class="spb-tt-cat"><i class="pi pi-layers"></i> {{ tt.category }}</div>
        <!-- Строки по режиму -->
        <template v-if="viewMode === 'страны'">
          <div v-if="selectedCountry1" class="spb-tt-row">
            <span class="spb-tt-dot" :style="{ background: tt.left || '#6b7280' }"></span>
            <span class="spb-tt-label">{{ selectedCountry1.name }}:</span>
            <span class="spb-tt-val" :style="{ color: tt.left || 'var(--p-text-muted-color)' }">{{ LEVEL_NAMES[country1Status(tt.techId)] || '—' }}</span>
          </div>
          <div v-if="selectedCountry2" class="spb-tt-row">
            <span class="spb-tt-dot" :style="{ background: tt.right || '#6b7280' }"></span>
            <span class="spb-tt-label">{{ selectedCountry2.name }}:</span>
            <span class="spb-tt-val" :style="{ color: tt.right || 'var(--p-text-muted-color)' }">{{ LEVEL_NAMES[country2Status(tt.techId)] || '—' }}</span>
          </div>
          <div v-if="tt.pятно" class="spb-tt-pятно" :style="{ background: tt.left, color: '#fff' }">{{ tt.pятно }}</div>
        </template>
        <template v-else-if="viewMode === 'портфель'">
          <div v-for="(dot, i) in brickCompanyDots(tt.techId)" :key="i" class="spb-tt-row">
            <span class="spb-tt-dot" :style="{ background: dot.color }"></span>
            <span class="spb-tt-label">{{ dot.name }}:</span>
            <span class="spb-tt-val" :style="{ color: dot.color }">{{ LEVEL_NAMES[dot.status] || dot.status }}</span>
          </div>
          <div v-if="!brickCompanyDots(tt.techId).length" class="spb-tt-white">⬜ Белое пятно — никто не покрывает</div>
        </template>
        <template v-else>
          <div class="spb-tt-row">
            <span class="spb-tt-dot" style="background:var(--fst-blue)"></span>
            <span class="spb-tt-label">ФСТ НТИ:</span>
            <span class="spb-tt-val">{{ fstCovers(tt.techId) ? 'Покрыто' : '—' }}</span>
          </div>
          <div class="spb-tt-row">
            <span class="spb-tt-dot" style="background:var(--fst-brand)"></span>
            <span class="spb-tt-label">{{ otherFundName }}:</span>
            <span class="spb-tt-val">{{ extCovers(tt.techId) ? 'Покрыто' : '—' }}</span>
          </div>
        </template>
        <div class="spb-tt-arrow"></div>
      </div>
    </Teleport>

    <!-- ── Модальное окно ── -->
    <Dialog
      v-model:visible="modalVisible"
      :header="modalBrick?.name"
      modal
      style="width:480px;max-width:95vw"
      :pt="{ root: { style: 'background:var(--p-surface-card);border:1px solid var(--p-content-border-color);border-radius:14px;' } }"
    >
      <div v-if="modalBrick" class="spb-modal">
        <div class="spb-modal-top">
          <div class="spb-modal-badge" :style="{ background: brickFill(modalBrick.techId) || 'var(--fst-blue)' }">
            {{ modalBrick.code }}
          </div>
          <div>
            <div class="spb-modal-cat"><i class="pi pi-layers"></i> {{ modalBrick.category }}</div>
            <div v-if="modalBrick.description" class="spb-modal-desc">{{ modalBrick.description }}</div>
          </div>
        </div>

        <!-- Режим Страны: тип взаимодействия -->
        <div v-if="viewMode === 'страны' && modalInteractionType" class="spb-modal-interaction">
          <Tag :severity="modalInteractionType.severity" :icon="modalInteractionType.icon" :value="modalInteractionType.label" style="font-size:11px;gap:5px" />
        </div>

        <!-- Режим Страны: потенциальное сотрудничество из PDF -->
        <div v-if="viewMode === 'страны' && COLLAB_DATA[modalBrick.code]" class="spb-modal-collab">
          <div class="page-section-title" style="margin-bottom:10px">ПОТЕНЦИАЛЬНОЕ СОТРУДНИЧЕСТВО</div>
          <div v-if="COLLAB_DATA[modalBrick.code].ruNeed || COLLAB_DATA[modalBrick.code].ruOffer" class="spb-collab-row">
            <span class="spb-leaders-flag">🇷🇺</span>
            <div class="spb-collab-body">
              <div v-if="COLLAB_DATA[modalBrick.code].ruOffer" class="spb-collab-offer">
                <span class="spb-collab-tag offer">ПОТЕНЦИАЛ</span>
                {{ COLLAB_DATA[modalBrick.code].ruOffer }}
              </div>
              <div v-if="COLLAB_DATA[modalBrick.code].ruNeed" class="spb-collab-need">
                <span class="spb-collab-tag need">ПОТРЕБНОСТЬ</span>
                {{ COLLAB_DATA[modalBrick.code].ruNeed }}
              </div>
            </div>
          </div>
          <div v-if="COLLAB_DATA[modalBrick.code].inNeed || COLLAB_DATA[modalBrick.code].inOffer" class="spb-collab-row">
            <span class="spb-leaders-flag">🇮🇳</span>
            <div class="spb-collab-body">
              <div v-if="COLLAB_DATA[modalBrick.code].inOffer" class="spb-collab-offer">
                <span class="spb-collab-tag offer">ПОТЕНЦИАЛ</span>
                {{ COLLAB_DATA[modalBrick.code].inOffer }}
              </div>
              <div v-if="COLLAB_DATA[modalBrick.code].inNeed" class="spb-collab-need">
                <span class="spb-collab-tag need">ПОТРЕБНОСТЬ</span>
                {{ COLLAB_DATA[modalBrick.code].inNeed }}
              </div>
            </div>
          </div>
        </div>

        <!-- Режим Страны: инфо о редактировании -->
        <div v-if="viewMode === 'страны' && countries.length" class="spb-modal-set">
          <div class="page-section-title" style="margin-bottom:8px">УСТАНОВИТЬ УРОВЕНЬ В TECH DB</div>
          <div class="spb-modal-note">Редактирование данных tech DB доступно через ai2o.ru/tech</div>
        </div>

        <!-- Режим Портфель: установить статус компании -->
        <div v-else-if="viewMode === 'портфель' && portfolioCompanies.length" class="spb-modal-set">
          <div class="page-section-title" style="margin-bottom:8px">СТАТУС КОМПАНИИ</div>
          <div class="spb-modal-co-row" v-for="co in portfolioCompanies" :key="co.id">
            <span class="spb-modal-co-name">{{ co.name }}</span>
            <SelectButton
              v-model="editStatuses[co.id]"
              :options="STATUS_OPTIONS"
              optionLabel="label"
              optionValue="value"
              :allowEmpty="true"
              size="small"
            />
          </div>
        </div>

        <!-- Технологические лидеры -->
        <div v-if="modalBrick && TECH_LEADERS[modalBrick.code] &&
                   (TECH_LEADERS[modalBrick.code].ru?.length || TECH_LEADERS[modalBrick.code].in?.length)"
             class="spb-modal-leaders">
          <div class="page-section-title" style="margin-bottom:8px">ТЕХНОЛОГИЧЕСКИЕ ЛИДЕРЫ</div>
          <div v-if="TECH_LEADERS[modalBrick.code].ru?.length" class="spb-modal-leaders-row">
            <span class="spb-leaders-flag">🇷🇺</span>
            <span class="spb-leaders-list">{{ TECH_LEADERS[modalBrick.code].ru.join(' · ') }}</span>
          </div>
          <div v-if="TECH_LEADERS[modalBrick.code].in?.length" class="spb-modal-leaders-row">
            <span class="spb-leaders-flag">🇮🇳</span>
            <span class="spb-leaders-list">{{ TECH_LEADERS[modalBrick.code].in.join(' · ') }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="modalVisible = false" />
        <Button v-if="viewMode==='портфель'" label="Сохранить" icon="pi pi-check" :loading="saving" @click="saveStatuses" />
        <Button v-else label="Закрыть" icon="pi pi-times" @click="modalVisible = false" />
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, markRaw, getCurrentInstance } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import FlagRU from '@/components/flags/FlagRU.vue'
import FlagCN from '@/components/flags/FlagCN.vue'
import FlagIN from '@/components/flags/FlagIN.vue'
import FlagBR from '@/components/flags/FlagBR.vue'
import FlagGB from '@/components/flags/FlagGB.vue'

const _uid = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2)

const props = defineProps({
  initialModelId: { type: String, default: null }
})

// ── Настройки отображения ─────────────────────────────────────────────────────
const settingsVisible  = ref(false)
const showBandFill     = ref(false)
const showBrickTint    = ref(false)
const thickSeparators  = ref(false)

// ── Режимы ────────────────────────────────────────────────────────────────────
const viewMode = ref('страны')
const VIEW_OPTIONS = [
  { label: 'Страны',   value: 'страны'   },
  { label: 'Портфель', value: 'портфель' },
  { label: 'Фонды',    value: 'фонды'    }
]

// ── Тема ──────────────────────────────────────────────────────────────────────
const blockEl  = ref(null)
const appDark  = ref(document.documentElement.classList.contains('app-dark'))
onMounted(() => {
  new MutationObserver(() => nextTick(() => {
    appDark.value = document.documentElement.classList.contains('app-dark')
  })).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
const isDark     = computed(() => appDark.value)
const themeClass = computed(() => isDark.value ? 'theme-dark' : 'theme-light')

function getActualBg() {
  let el = blockEl.value?.parentElement
  while (el && el !== document.body) {
    const bg = getComputedStyle(el).backgroundColor
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
    el = el.parentElement
  }
  return getComputedStyle(document.body).backgroundColor
}
const sepColor     = computed(() => { void isDark.value; return blockEl.value ? getActualBg() : (isDark.value ? '#0f172a' : '#f9fafb') })
const outlineColor = computed(() => isDark.value ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.6)')

// ── API ───────────────────────────────────────────────────────────────────────
const TECH_SERVER = 'https://ai2o.ru'
const TECH_DB     = 'tech'
const FST_DB      = 'fst'
const LOGIN       = 'unidel@yandex.ru'
const PASSWORD    = 'Denver2035'

let techToken = '', fstToken = '', fstXsrf = ''

async function authDB(db) {
  const r = await fetch(`${TECH_SERVER}/${db}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: LOGIN, pwd: PASSWORD })
  })
  const d = JSON.parse(await r.text())
  return { token: d.token || '', xsrf: d._xsrf || '' }
}
async function fetchDB(db, path, token) {
  const r = await fetch(`${TECH_SERVER}/${db}${path}`, {
    headers: token ? { 'X-Authorization': token } : {}
  })
  const t = await r.text()
  return t.startsWith('{') ? JSON.parse(t) : null
}
async function postDB(db, path, body, token, xsrf) {
  const r = await fetch(`${TECH_SERVER}/${db}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Authorization': token },
    body: new URLSearchParams({ ...body, _xsrf: xsrf })
  })
  const t = await r.text()
  return t.startsWith('{') ? JSON.parse(t) : null
}

// ── Состояние: tech db ────────────────────────────────────────────────────────
const loading      = ref(true)
const models       = ref([])    // { id, name }
const categories   = ref({})    // id → name
const technologies = ref({})    // id → { id, name, code, description }
const layers       = ref([])    // [ { id, categoryId, level, techIds[] } ]
const selectedModelId = ref(null)

// ── Состояние: fst db (пирамиды-модели) ──────────────────────────────────────
const fstPyramids       = ref([])   // [{id, name, layers:[{id,name,order,conceptIds}]}]
const fstConceptCodeMap = ref({})   // conceptId → code string (fst type 2416, field 2423)

// Страны
const FLAG_MAP = {
  '1016': markRaw(FlagRU),
  '1017': markRaw(FlagIN),
  '1018': markRaw(FlagCN),
  '1019': markRaw(FlagBR),
  '1020': markRaw(FlagGB)
}
const countries       = ref([])   // { id, name, flagComponent }
const countrySetData  = ref({})   // `${countryId}_${techId}` → levelId ('2408'|'2409'|'2410')
const selectedCountry1 = ref(null)
const selectedCountry2 = ref(null)

// SVG исключение: hex разрешены для статусных цветов
const LEVEL_COLORS = { '2408': '#22c55e', '2409': '#f59e0b', '2410': '#ef4444' }
const LEVEL_NAMES  = { '2408': 'КЛЮЧ',    '2409': 'ШАНС',    '2410': 'КРИЗИС'  }

// ── Состояние: fst db ─────────────────────────────────────────────────────────
const TYPE_STATUS      = 71349
const FIELD_ST_CONCEPT = 71351  // id технологии (текст)
const FIELD_ST_COMPANY = 71352  // id компании (текст)
const FIELD_ST_STATUS  = 71353  // КЛЮЧ/ШАНС/КРИЗИС

const portfolioCompanies = ref([])   // { id, name }
const coStatusMap        = ref({})   // `${coId}_${techId}` → { statusId, status }
const activeCo           = ref(new Set())   // выбранные компании (портфель)
const fstActiveCo        = ref(new Set())   // выбранные компании ФСТ (фонды)
const extActiveCo        = ref(new Set())   // выбранные компании другого фонда

// Цвета компаний (SVG исключение)
const COMPANY_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#f43f5e', '#0ea5e9']

// Статусы для модала
const STATUS_OPTIONS = [
  { label: 'КЛЮЧ',   value: 'КЛЮЧ'   },
  { label: 'ШАНС',   value: 'ШАНС'   },
  { label: 'КРИЗИС', value: 'КРИЗИС' }
]
const STATUS_HEX = { 'КЛЮЧ': '#22c55e', 'ШАНС': '#f59e0b', 'КРИЗИС': '#ef4444' }

// ── Другие фонды (статические данные, expandable через fst db) ────────────────
const OTHER_FUNDS = [
  {
    id: 'rvc', name: 'РВК / РФПИ',
    companies: [
      { id: 'rvc_1', name: 'Геоскан', techs: ['CT', 'AI', 'BC'] },
      { id: 'rvc_2', name: 'Флай Дроун', techs: ['CT', 'PM'] },
      { id: 'rvc_3', name: 'Аэросила', techs: ['EN', 'PM', 'CT'] },
      { id: 'rvc_4', name: 'ЛК Авиастроение', techs: ['CT', 'EN'] }
    ]
  },
  {
    id: 'skolkovo', name: 'Сколково',
    companies: [
      { id: 'sk_1', name: 'Аэромакс', techs: ['AI', 'CT', 'CM'] },
      { id: 'sk_2', name: 'ПТЕРО', techs: ['CT', 'PM', 'SW'] },
      { id: 'sk_3', name: 'Copter Express', techs: ['AI', 'SW', 'CM'] },
      { id: 'sk_4', name: 'Aerodyne Group RU', techs: ['AI', 'CT', 'BC'] }
    ]
  },
  {
    id: 'fsi', name: 'ФСИ (Бортник)',
    companies: [
      { id: 'fsi_1', name: 'Лаборатория Будущего', techs: ['SW', 'AI'] },
      { id: 'fsi_2', name: 'АвиаНова', techs: ['CT', 'EN', 'PM'] },
      { id: 'fsi_3', name: 'КиберДрон', techs: ['AI', 'CM', 'SW'] }
    ]
  },
  {
    id: 'innopractice', name: 'Иннопрактика',
    companies: [
      { id: 'ip_1', name: 'Русские Вертолётные Системы', techs: ['CT', 'EN'] },
      { id: 'ip_2', name: 'НПП НАРО', techs: ['CM', 'PM'] }
    ]
  }
]
// ── Технологические лидеры (PDF: TSM Россия–Индия 2025) ──────────────────────
const TECH_LEADERS = {
  AI:  { ru: ['Yandex', 'Сбер', 'VisionLabs', 'NTech Lab', 'МТС', 'Яндекс Роботикс', 'Neiry'],
         in: ['Neysa', 'TCS', 'Infosys', 'Qure.ai', 'Haptik', 'Sarvam AI', 'Simuganis', 'GreyOrange', 'Innefu Labs'] },
  CM:  { ru: ['Yandex', 'Сбер', 'Госуслуги', 'Гостех', 'Честный ЗНАК', 'Ростелеком', 'МТС', 'Иртея', 'Sitronics Group'],
         in: ['TCS', 'Infosys', 'Wipro', 'Airtel', 'HFCL', 'Tata Communications', 'Haptik', 'Sarvam AI'] },
  CS:  { ru: ['Kaspersky', 'Positive Technologies', 'VisionLabs', 'NTech Lab'],
         in: ['Innefu Labs', 'SecurDApp', 'Data Patterns'] },
  Cs:  { ru: ['Kaspersky', 'Positive Technologies'],
         in: ['Innefu Labs'] },
  GS:  { ru: ['Сканэкс', 'NextGIS', '2GIS', 'АО ГЛОНАСС', 'Sitronics Group', 'Правительство Москвы'],
         in: ['RMSI', 'Genesys International'] },
  SC:  { ru: ['Роскосмос', 'Бюро 1440', 'Гонец', 'ЭЛВИС', 'Sitronics Group'],
         in: ['Skyroot Aerospace', 'Bellatrix Aerospace', 'Dhruva Space', 'Astrogate Labs', 'Data Patterns', 'Eutelsat'] },
  Sp:  { ru: ['Роскосмос', 'Бюро 1440', 'Гонец', 'Сканэкс', 'АО ГЛОНАСС'],
         in: ['Skyroot Aerospace', 'Bellatrix Aerospace', 'Dhruva Space', 'Astrogate Labs'] },
  QC:  { ru: ['RQC', 'modum lab'],
         in: ['Qnu Labs', 'QPi Technology'] },
  XG:  { ru: ['МТС', 'Ростелеком', 'Иртея'],
         in: ['Airtel', 'HFCL', 'Tata Communications'] },
  BC:  { ru: ['MasterChain', 'Честный ЗНАК', 'Сбер'],
         in: ['SecurDApp', 'Fractable'] },
  BD:  { ru: ['Yandex Cloud', 'cloud.ru', 'VK Cloud', 'Yandex', 'Сбер'],
         in: ['TCS', 'Infosys', 'Wipro', 'Tata Communications', 'Neysa'] },
  Rb:  { ru: ['Яндекс Роботикс', 'Промобот', 'ExoAtlet', 'Ростех'],
         in: ['Simuganis', 'GreyOrange', 'BoBrive', 'Tata Motors', 'NiQo Robotics'] },
  HF:  { ru: ['Химрар', 'R-Pharm', 'BioCad', 'Generium', 'Origen'],
         in: ['Qure.ai', 'Apollo Hospitals', 'Practo', 'Fortis Healthcare', 'BrainSight AI', 'Sun Pharma', 'INTAS Pharmaceuticals', "Dr. Reddy's Laboratories"] },
  BS:  { ru: ['Химрар', 'R-Pharm', 'BioCad', 'Generium', 'Origen'],
         in: ['Sun Pharma', 'INTAS Pharmaceuticals', "Dr. Reddy's Laboratories", 'Syngene International', 'HiMedia Laboratories'] },
  Ge:  { ru: ['BioCad', 'Generium', 'Origen', 'Химрар'],
         in: ['Serum Institute of India', 'HiMedia Laboratories', 'Syngene International', "Dr. Reddy's Laboratories", 'Sun Pharma'] },
  HH:  { ru: ['ExoAtlet', 'Neiry', 'Greenbar'],
         in: ['BrainSight AI'] },
  NT:  { ru: ['SIBUR', 'Химрар', 'BioCad', 'CarbonLab', 'Greenbar'],
         in: ['Clean Science and Technology', 'Serum Institute of India', 'HiMedia Laboratories'] },
  PhT: { ru: ['ЭЛВИС', 'Mikron'],
         in: ['Data Patterns'] },
  Mb:  { ru: ['МТС', 'Ростелеком'],
         in: ['Airtel', 'HFCL', 'Reliance Industries'] },
  ASI: { ru: ['Ростех'],
         in: ['Tech Mahindra'] },
  MC:  { ru: ['Mikron', 'ЭЛВИС', 'AVK', 'Power Machines'],
         in: ['Dixon Technologies', 'Vishay Intertechnology India', 'BoBrive', 'Tata Motors', 'Mahindra & Mahindra', 'SLTL Group', 'Kirloskar Oil Engines'] },
  Sn:  { ru: ['Mikron', 'ЭЛВИС'],
         in: ['Dixon Technologies', 'Vishay Intertechnology India'] },
  Me:  { ru: ['AVK', 'Power Machines', 'TITAN'],
         in: ['SLTL Group', 'Vishay Intertechnology India'] },
  Mt:  { ru: ['SIBUR', 'CarbonLab', 'TITAN'],
         in: ['Creed Composites', 'NitPro Composites', 'Clean Science and Technology'] },
  Ch:  { ru: ['SIBUR', 'Уралхим', 'Фосагро'],
         in: ['KRIBHCO', 'IFFCO', 'Clean Science and Technology'] },
  CT:  { ru: ['АСКОН', 'ЦИФРОС', 'Ростех'],
         in: ['Creed Composites', 'NitPro Composites'] },
  SE:  { ru: ['АСКОН', 'ЦИФРОС', 'Гостех'],
         in: ['TCS', 'Infosys', 'Wipro', 'HCLTech', 'Fractable'] },
  DT:  { ru: ['ЦИФРОС', 'АСКОН', 'Гостех', 'Правительство Москвы'],
         in: [] },
  AR:  { ru: ['VisionLabs'],
         in: ['Fusion VR', 'Quytech'] },
  Ag:  { ru: ['Русагро', 'Фосагро', 'Уралхим'],
         in: ['KRIBHCO', 'IFFCO', 'Harvesto', 'Mahindra & Mahindra'] },
  NE:  { ru: ['Росатом', 'Газпром', 'Роскосмос'],
         in: ['NPCIL', 'NTPC'] },
  FE:  { ru: ['Росатом'],
         in: [] },
  En:  { ru: ['Газпром', 'Роснефть', 'Татнефть', 'Новавинд'],
         in: ['NTPC', 'NHPC', 'Tata Power', 'Thermax', 'Kirloskar Oil Engines', 'Tata Motors', 'Mahindra & Mahindra'] },
  WE:  { ru: ['Новавинд'],
         in: ['Bellatrix Aerospace', 'NTPC', 'Tata Power'] },
  HE:  { ru: ['Новавинд', 'Росатом'],
         in: ['NHPC', 'Tata Power', 'Thermax', 'Bellatrix Aerospace'] },
  So:  { ru: ['Новавинд'],
         in: ['NTPC', 'Tata Power'] },
  TE:  { ru: ['Росатом', 'Газпром', 'Роснефть', 'Power Machines'],
         in: ['Thermax', 'NTPC'] },
  Mn:  { ru: ['Газпром', 'Роснефть', 'Татнефть'],
         in: ['Reliance Industries'] },
  TF:  { ru: ['Сбер', 'MasterChain'],
         in: ['TCS', 'Infosys'] },
}

// ── 6 типов взаимодействия (PDF стр. 21) ─────────────────────────────────────
const INTERACTION_TYPES = {
  'КЛЮЧ+КЛЮЧ':    { label: 'Стратегическое партнёрство паритета',  severity: 'success', icon: 'pi pi-star-fill' },
  'ШАНС+ШАНС':    { label: 'Синергия взаимного развития',           severity: 'info',    icon: 'pi pi-sync'      },
  'КРИЗИС+КРИЗИС':{ label: 'Ускоренное совместное развитие',        severity: 'warn',    icon: 'pi pi-bolt'      },
  'КЛЮЧ+ШАНС':    { label: 'Асимметричный трансфер (RU→IN)',        severity: 'success', icon: 'pi pi-arrow-right'},
  'ШАНС+КЛЮЧ':    { label: 'Асимметричный трансфер (IN→RU)',        severity: 'success', icon: 'pi pi-arrow-left' },
  'КЛЮЧ+КРИЗИС':  { label: 'Наращивание потенциала (RU→IN)',        severity: 'success', icon: 'pi pi-chart-line' },
  'КРИЗИС+КЛЮЧ':  { label: 'Наращивание потенциала (IN→RU)',        severity: 'success', icon: 'pi pi-chart-line' },
  'ШАНС+КРИЗИС':  { label: 'Поддерживающее сотрудничество (RU→IN)', severity: 'secondary', icon: 'pi pi-handshake'},
  'КРИЗИС+ШАНС':  { label: 'Поддерживающее сотрудничество (IN→RU)', severity: 'secondary', icon: 'pi pi-handshake'},
}

// ── Потребности и потенциал по каждой технологии (PDF Раздел 3, стр. 22–29) ──
const COLLAB_DATA = {
  // ЭНЕРГЕТИКА
  WE:  { ruNeed: 'Ввод новых генерирующих мощностей, развитие местного производства компонентов (лопастей, генераторов, башен). Технологии для ВЭУ при низкой скорости ветра.',
         inOffer:'Включение в действующие цепочки поставок и опыт быстрого развёртывания мощностей. Доступ к современным турбинам и системам хранения для гибридных систем.' },
  BE:  { ruNeed: 'Постройка сети биогазовых станций >150 МВт к 2030. Технологии повышения эффективности переработки биомассы и коммерческого использования побочных продуктов.',
         inOffer:'Рост доли биоэнергетики, собственные R&D-центры по биотопливу, опыт масштабного развёртывания. Интегрированные энергетические хабы на базе биогаза и водорода.' },
  FE:  { ruOffer:'Цифровые двойники и нейросетевые модели для эффективности добычи «зрелых» месторождений. Опыт управления строительством сложных скважин. Импортозамещение геоинформационных систем.',
         inNeed: 'Планы по увеличению добывающих мощностей. Снижение производственных затрат и улучшение финансовых показателей. Инвестиции в строительство трубопроводов, обогатительных фабрик и заводов.' },
  TE:  { ruOffer:'Разведка геотермальных месторождений, строительство и эксплуатация геотермальных электростанций. Специализированные дочерние компании участвуют в разработке ORC-систем.',
         inNeed: 'Переход от пилотных проектов к промышленной выработке электроэнергии на геотермальных станциях. Диверсификация портфеля проектов в солнечную и ветровую энергетику.' },
  HE:  { ruOffer:'Полный технологический цикл водородной энергетики. Передовые разработки в области электролизёров и топливных элементов. Пилотные проекты и испытательные полигоны.',
         inNeed: 'Масштабирование технологий и создание гигафабрик накопителей. Снижение стоимости низкоуглеродной инфраструктуры. Доступ к передовым технологиям для декарбонизации.' },
  ES:  { ruOffer:'Поставки тестовых партий литий-ионных аккумуляторов. Партнёрство по созданию систем хранения энергии и возможная организация сборки в Индии.',
         inNeed: 'Технологии водорода как накопителя для балансировки ВИЭ. Суперконденсаторы и гибридные системы сезонного хранения. Различные типы СНЭ для регулирования частоты.' },
  NE:  { ruOffer:'Замкнутый ядерный топливный цикл и реакторы на быстрых нейтронах. Реакторы поколения III+ малой мощности. Экспорт полного цикла услуг от строительства АЭС до топливного обеспечения.',
         inNeed: 'Развитие национальной атомной инфраструктуры и энергобезопасности. Локализация технологий и развитие собственной научно-промышленной базы. Диверсификация энергобаланса.' },
  HP:  { ruOffer:'Российский опыт и инжиниринговые решения для строительства крупных ГЭС в сложных климатических и геологических условиях (гидротурбины). Партнёрство в разработке малых и приливных ГЭС.',
         inNeed: 'Участие в индийских тендерах на строительство и модернизацию ГЭС. Анализ и адаптация индийского опыта строительства гидроаккумулирующих электростанций.' },
  SE:  { ruOffer:'Российский опыт и инжиниринговые решения для строительства крупных ГЭС в сложных климатических и геологических условиях.',
         inOffer:'Партнёрство в разработке технологий для малых и приливных электростанций как перспективного сегмента. Строительство крупных ГЭС.' },
  DE:  { ruNeed: 'Адаптация индийского опыта управления распределительными сетями мегаполисов. Решения для управления спросом (Demand Response) с высокой долей ВИЭ.',
         inOffer:'Российские технологии микросетей для автономного энергоснабжения удалённых территорий. Цифровые платформы мониторинга с «гибким» реагированием на аварийные ситуации.' },
  // ПРОИЗВОДСТВО
  Mt:  { ruNeed: 'Внедрение композитных решений в промышленность. Создание совместных производств компонентов. Технологии для термостойких материалов и систем.',
         inOffer:'Опыт масштабирования технологий и вывода на глобальные рынки. Развитие платформ для интеграции новых материалов в микроэлектронику.' },
  DT:  { ruNeed: 'Тестирование и масштабирование передовых решений на базе индийских промышленных корпораций. Доступ к коммерциализации технологий виртуальных двойников АЭС.',
         inNeed: 'Интеграция российского ПО в сегменты PLM и DT в IT-экосистемы. Партнёрство по AI-алгоритмам для предиктивной аналитики на предприятиях.' },
  Ch:  { ruNeed: 'Доступ к технологиям производства фторорганики. Интеграция в цепочки поставок химической продукции для нужд фармацевтики.',
         inOffer:'Специализированные полимеры и композиты для аэрокосмических применений. Локализация технологий высокочистых реактивов для атомной и оборонной промышленности.' },
  Sn:  { ruNeed: 'Партнёрство для серийного производства датчиков с поддержкой IO-Link. Поставки электронных компонентов из Индии для удешевления продукции.',
         inOffer:'Специализированные сенсоры для космических применений и ядерной энергетики. Технологическая поддержка «умного» мониторинга трубопроводов.' },
  MC:  { ruNeed: 'Организация СП по производству тяжёлого оборудования для горнодобывающей отрасли. Выход на индийский транспортный рынок через поставки узлов и компонентов.',
         inNeed: 'Высокотехнологичное энергетическое оборудование (турбины, генераторы) для ГЭС и АЭС. Авиационные двигатели и компоненты для гражданской авиации.' },
  Rb:  { ruNeed: 'Освоение производства промышленных автономных мобильных роботов (грузоподъёмность до 500 кг). Доступ к индийскому рынку сервисной робототехники.',
         inNeed: 'Антропоморфные сервисные роботы для сферы услуг. Специальные роботы для опасных сред — атомная и химическая промышленность.' },
  Mn:  { ruNeed: 'Адаптация индийского опыта бережливого производства (Lean Manufacturing). Технологии быстрой локализации контрактного производства электроники.',
         inNeed: 'PLM-системы для управления полным жизненным циклом сложных высокотехнологичных изделий. Изучение российского опыта организации производств в атомной и авиационной отраслях.' },
  Me:  { ruNeed: 'Услуги по разработке и верификации ASIC и SoC-решений. Использование индийских дистрибьюторов для продвижения российской элементной базы.',
         inNeed: 'Поставки «защищённых» российских процессоров для критической инфраструктуры. Решения для развития собственных производственных мощностей в полупроводниковой промышленности.' },
  // БИОТЕХНОЛОГИИ, МЕДИЦИНА И КЛИМАТ
  NT:  { ruOffer:'Разработка нейроимплантов и интерфейсов «мозг-компьютер». Реабилитационная и вспомогательная техника (экзоскелеты, протезы). Исследования нейромониторинга.',
         inNeed: 'Доступ к передовому медицинскому оборудованию. Локализация производства нейроустройств и адаптация к местным условиям.' },
  Mb:  { ruNeed: 'Локализация производства полного цикла современных биоаналогов. Развитие центров подготовки кадров для новейших микробиологических препаратов.',
         inOffer:'Поставки критических материалов: фармацевтических субстанций, питательных сред, химических реагентов. Аутсорсинг доклинических стадий и испытаний.' },
  Ge:  { ruNeed: 'Доступ к передовым инструментам для редактирования генома (CRISPR-Cas). Создание совместных R&D-центров для разработки гено-терапевтических препаратов.',
         inOffer:'Аутсорсинг услуг CRISPR-инжиниринга и синтеза генов. Контрактные R&D и производство рекомбинантных белков, вакцин. Готовые технологические платформы.' },
  BS:  { ruNeed: 'Технологии мониторинга и анализа больших данных для оценки состояния экосистем. Методы и услуги по фитопроспектингу для обнаружения полезных свойств видов.',
         inOffer:'Платформы для анализа сложных биологических данных. Готовые исследовательские решения и создание совместных лабораторий. Технологии ускорения R&D-цикла.' },
  So:  { ruNeed: 'Эффективные и недорогие решения для восстановления деградированных почв. Технологии повышения плодородия и влагоудержания в засушливых регионах.',
         inOffer:'Оборудование для капельного орошения и управления водными ресурсами. Широкий ассортимент био-удобрений и органических добавок. Отработанные модели для сельскохозяйственных кооперативов.' },
  HH:  { ruOffer:'Внедрение готовых решений для телемедицины и управления клиниками. Доступ к крупным базам медицинских данных для обучения AI-алгоритмов. Технологии для удалённой реабилитации.',
         inNeed: 'Масштабируемые модели частных медицинских сетей и телемедицинских сервисов. Проверенные решения для цифровой диетологии и управления здоровьем на основе AI.' },
  HF:  { ruNeed: 'Экспертиза в области доказательной нутрициологии и клинических испытаний функциональных продуктов. Вывод инновационных продуктов на быстрорастущий рынок.',
         inNeed: 'Доступ к передовому медицинскому оборудованию. Совместная разработка ПО для анализа нейроданных и локализация производства нейроустройств.' },
  PhT: { ruNeed: 'Доступ к крупномасштабным мощностям для выпуска дженериков и биоаналогов по конкурентоспособной стоимости. Использование готовых дистрибуционных сетей.',
         inOffer:'Создание совместных производств в России и ЕАЭС. Совместные исследовательские проекты по новым лекарственным формам и платформам для сложных дженериков.' },
  Or:  { ruOffer:'Поиск стабильных каналов сбыта минеральных удобрений на быстрорастущем индийском рынке. Создание совместных предприятий на территории Индии для сборки, блендирования и фасовки.',
         inNeed: 'Совместные исследовательские проекты. Интеграция поставок удобрений с цифровыми сервисами для продвижения комплексных решений «удобрение + технология применения».' },
  CH:  { ruNeed: 'Технологии улавливания и утилизации попутного нефтяного газа (ПНГ) и метана. Партнёрства для верификации углеродных единиц по международным стандартам.',
         inOffer:'Использование данных Росгидромета для анализа климатических изменений. Партнёрства с климатическими институтами для совместных проектов по снижению выбросов.' },
  H20: { ruNeed: 'Технологии интеллектуального управления водораспределительными сетями (снижение потерь, контроль качества). Системы замкнутого водоснабжения для сельского хозяйства.',
         inOffer:'Реализация комплексных проектов по модернизации коммунальной водной инфраструктуры. Доступ к современному оборудованию и материалам.' },
  TF:  { ruNeed: 'Разработка ГМ сельскохозяйственных культур для экстремальных условий. Создание автономных биологических систем регенерации воздуха и воды для биосфер.',
         inOffer:'Разработка экономичных ракет-носителей для доставки на орбиту. Создание эффективных и многоразовых двигательных систем для межпланетных перелётов.' },
  // ЦИФРОВЫЕ СЕРВИСЫ
  BD:  { ruNeed: 'Развитие MLOps и AI-инфраструктуры — автоматизация жизненного цикла ML-моделей. Создание гибридных облачных архитектур для госсектора и финансов.',
         inNeed: 'Развитие отраслевых AI-решений для банковского сектора, ритейла и здравоохранения. Интеграция AI в унаследованные системы. Безопасность больших данных в облаке.' },
  AI:  { ruNeed: 'Инфраструктура для крупных AI-моделей — суперкомпьютерные мощности и облачные платформы. Периферийные вычислительные устройства для edge-AI в видеонаблюдении.',
         inNeed: 'Промышленные вычислительные платформы для развёртывания AI-решений на предприятиях. Создание отраслевых AI — разработка голосовых помощников и чат-ботов.' },
  BC:  { ruNeed: 'Разработка отраслевых стандартов и межбанковских блокчейн-решений. Создание доверенных B2B-сетей с контролем доступа.',
         inNeed: 'Масштабирование трекинг-платформ для миллионов транзакций. Развитие национальной блокчейн-инфраструктуры. Интеграция с государственными сервисами.' },
  Cs:  { ruOffer:'Интеграция решений в комплексные системы безопасности корпоративных инфраструктур. Передовые платформы на базе ИИ для выявления сложных и незаметных угроз.',
         inNeed: 'Коммерциализация решений для квантовой безопасности (QKD, QRNG). Защита веб-приложений и API в условиях роста целевых атак и уязвимостей облачных сред.' },
  ASI: { ruOffer:'Вычислительная инфраструктура — доступ к GPU/HPC кластерам для обучения больших моделей. Разработка AI-ускорителей и нейроморфных чипов.',
         inNeed: 'Масштабируемые AI-платформы — облачная инфраструктура для миллионов пользователей. Enterprise AI-решения — безопасные LLM-стэки для корпоративного сектора.' },
  // ТЕХНОЛОГИИ СВЯЗИ
  XG:  { ruNeed: 'Доступ к крупномасштабной реальной среде (мегаполисы, сельские кластеры) для тестирования 5G/6G. Коммерциализация инноваций AI-native RAN на глобальных рынках.',
         inOffer:'Опыт рефарминга: перевод частот с 2G/3G/4G под 5G. Построение NSA-сетей и развитие потребительских сервисов. Энергоэффективные радиорелейные системы UBR.' },
  AR:  { ruNeed: 'Продвинутые алгоритмы компьютерного зрения и SLAM для точного позиционирования AR-объектов в сложных средах. Суверенные аппаратные решения (VR/AR-шлемы).',
         inOffer:'Опыт быстрой разработки и оптимизации ПО, создание кроссплатформенных SDK. Сильные компетенции в cost-optimization и разработке отдельных электронных компонентов.' },
  QC:  { ruNeed: 'Технологии квантовых повторителей (репитеров) для QKD (~100–150 км). Продвинутые протоколы QKD, устойчивые к высоким уровням шума.',
         inOffer:'Специализация на совместном применении ИИ и квантовых протоколов QKD. Практический опыт создания и коммерциализации систем QKD. QNu Labs может быть полезен для РЖД.' },
  SC:  { ruNeed: 'Совместная разработка и модернизация ракетоносителей. Создание совместных стандартов для будущей интеграции спутниковых систем двух стран.',
         inNeed: 'Доступ к надёжным и тяжёлым средствам выведения. Оптимизация сетевых протоколов для эффективного взаимодействия спутниковых и наземных сетей.' },
  // ТРАНСПОРТНЫЕ ТЕХНОЛОГИИ
  GS:  { ruNeed: 'Локализация производства высокоточных оптических элементов и гиперспектральных камер. Наработка международного опыта для повышения функциональности ГИС-систем.',
         inNeed: 'Подготовка кадров для работы с современными ГИС-решениями. ИИ и сервисы аналитики больших данных для обработки геопространственной информации.' },
  Sp:  { ruNeed: 'Адаптивные алгоритмы модуляции и кодирования. Локализация технологий производства антенн, чипов, терминалов.',
         inOffer:'Специализированные ASIC и модули для спутниковой связи, соответствующих стандартам MIL-STD. Недорогие массовые пользовательские терминалы (VSAT).' },
  En:  { ruNeed: 'Развитие перспективных материалов для высокоточного литья, сварки, аддитивных технологий. Роботизация производственных процессов и модернизация производственных линий.',
         inOffer:'Модульные платформы батарейных систем (BES), интегрированный e-Drive. Развитие инфраструктуры мочевины (AdBlue/DEF). Системы селективного каталитического восстановления SCR.' },
}

// Вычислить тип взаимодействия для открытого кирпича
const modalInteractionType = computed(() => {
  if (!modalBrick.value || viewMode.value !== 'страны') return null
  const techId = modalBrick.value.techId
  const c1 = selectedCountry1.value || '1016'
  const c2 = selectedCountry2.value || '1017'
  const s1 = countrySetData.value[`${c1}_${techId}`]
  const s2 = countrySetData.value[`${c2}_${techId}`]
  if (!s1 || !s2) return null
  const NAME = { '2408': 'КЛЮЧ', '2409': 'ШАНС', '2410': 'КРИЗИС' }
  return INTERACTION_TYPES[`${NAME[s1]}+${NAME[s2]}`] || null
})

const selectedOtherFund = ref(null)
const otherFundCompanies = computed(() => {
  const fund = OTHER_FUNDS.find(f => f.id === selectedOtherFund.value)
  return fund ? fund.companies : []
})
const otherFundName = computed(() => {
  const fund = OTHER_FUNDS.find(f => f.id === selectedOtherFund.value)
  return fund ? fund.name : 'Внешний фонд'
})

// ── Модал / тултип ────────────────────────────────────────────────────────────
const modalVisible = ref(false)
const modalBrick   = ref(null)
const editStatuses = ref({})
const saving       = ref(false)
const tt = ref({ visible: false, x: 0, y: 0, techId: '', code: '', name: '', category: '', left: '', right: '', pятно: '' })

// ── Загрузка: tech db ─────────────────────────────────────────────────────────
async function loadTechModels() {
  const d = await fetchDB(TECH_DB, '/object/4023?JSON_KV&full=1&F_U=1&LIMIT=50', techToken)
  return (d?.object || []).map(o => ({ id: String(o.id), name: o.val }))
}
async function loadCategories() {
  const d = await fetchDB(TECH_DB, '/object/1028?JSON_KV&full=1&F_U=1&LIMIT=100', techToken)
  const map = {}
  for (const o of (d?.object || [])) map[String(o.id)] = o.val
  return map
}
async function loadTechnologies() {
  const d = await fetchDB(TECH_DB, '/object/1020?JSON_KV&full=1&F_U=1&LIMIT=500', techToken)
  if (!d) return {}
  const reqs = d.reqs || {}
  const map = {}
  for (const o of (d?.object || [])) {
    map[String(o.id)] = {
      id: String(o.id), name: o.val,
      code:        reqs[o.id]?.['1022'] || o.val.substring(0, 3).toUpperCase(),
      description: reqs[o.id]?.['1023'] || ''
    }
  }
  return map
}
async function loadCountries() {
  const d = await fetchDB(TECH_DB, '/object/1015?JSON_KV&full=1&F_U=1&LIMIT=100', techToken)
  return (d?.object || []).map(o => ({
    id: String(o.id),
    name: o.val,
    flagComponent: FLAG_MAP[String(o.id)] || null
  }))
}
async function loadCountrySetData() {
  const d = await fetchDB(TECH_DB, '/object/1924?JSON_KV&full=1&F_U=1&LIMIT=1000', techToken)
  if (!d) return {}
  const reqs = d.reqs || {}
  const map = {}
  for (const o of (d?.object || [])) {
    const r = reqs[o.id] || {}
    const countryId = (r['ref_1926'] || '').split(':')[1] || ''
    const techId    = (r['ref_1929'] || '').split(':')[1] || ''
    const levelId   = (r['ref_2949'] || '').split(':')[1] || ''
    if (countryId && techId && levelId) map[`${countryId}_${techId}`] = levelId
  }
  return map
}
// ── Загрузка fst pyramid-моделей ─────────────────────────────────────────────
async function loadFstPyramids() {
  const d = await fetchDB(FST_DB, '/object/71341?JSON_KV&full=1&LIMIT=100', fstToken)
  const res = []
  for (const o of (d?.object || [])) {
    const reqs = d.reqs?.[o.id] || {}
    let cfg = {}
    try {
      const raw = reqs['71345'] || '{}'
      const decoded = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#123;/g, '{').replace(/&#125;/g, '}')
      cfg = JSON.parse(decoded)
    } catch {}
    res.push({ id: String(o.id), name: o.val, layers: cfg.layers || [] })
  }
  return res
}
async function loadFstConceptCodes() {
  const d = await fetchDB(FST_DB, '/object/2416?JSON_KV&full=1&LIMIT=500', fstToken)
  const map = {}
  for (const o of (d?.object || [])) {
    const code = d.reqs?.[o.id]?.['2423'] || ''
    if (code) map[String(o.id)] = code
  }
  return map
}
function buildLayersFromFst(pyramidId) {
  const pyramid = fstPyramids.value.find(p => p.id === pyramidId)
  if (!pyramid) return []
  const c2id = codeToIdMap()
  return pyramid.layers
    .map((layer, i) => {
      const techIds = (layer.conceptIds || [])
        .map(cid => {
          const code = fstConceptCodeMap.value[String(cid)] || ''
          return c2id[code] || null
        })
        .filter(Boolean)
      return {
        id: String(layer.id),
        name: layer.name,
        categoryId: null,
        level: (pyramid.layers.length - (layer.order != null ? layer.order - 1 : i)),
        techIds
      }
    })
    .filter(l => l.techIds.length > 0)
}

async function loadLayers(modelId) {
  const d = await fetchDB(TECH_DB, `/object/4026?JSON_KV&full=1&F_U=${modelId}&LIMIT=500`, techToken)
  if (!d) return []
  const reqs = d.reqs || {}
  return (d.object || []).map(o => {
    const r = reqs[o.id] || {}
    let catId = null
    const catRef = r['ref_4028'] || r['4028'] || ''
    if (catRef.includes(':')) catId = catRef.split(':')[1]
    else if (catRef) catId = catRef

    const techRef = r['ref_5749'] || r['5749'] || r['ref_4029'] || r['4029'] || ''
    let techIds = []
    if (techRef.includes(':')) {
      techIds = techRef.split(':')[1].split(',').map(s => s.trim()).filter(Boolean)
    }
    return {
      id: String(o.id), name: o.val,
      categoryId: catId ? String(catId) : null,
      level: parseInt(r['4036'] || '0', 10),
      techIds
    }
  }).filter(l => l.techIds.length > 0)
}

// ── Статические данные PDF (страницы 15–16) ───────────────────────────────────
// Ключи — коды технологий из tech DB (поле 1022). Значения: 2408=КЛЮЧ, 2409=ШАНС, 2410=КРИЗИС
const PDF_STATUSES = {
  '1016': { // Россия — страница 15
    CT: '2408', CM: '2409', CH: '2410', H20: '2410', TF: '2410',
    GS: '2409', Sp: '2409', En: '2409',
    XG: '2409', 'AR/VR': '2409', AR: '2409', QC: '2409', CS: '2409', SC: '2409',
    BD: '2409', Cs: '2408', AI: '2409', ASI: '2409', BC: '2410',
    HF: '2410', HH: '2409', NT: '2409', PhT: '2409', Mb: '2409',
    Ge: '2409', BS: '2409', So: '2409', Or: '2409',
    DT: '2409', Ch: '2410', Mt: '2409', Sn: '2409', Me: '2409',
    MC: '2409', Rb: '2409', Mn: '2409',
    NE: '2408', FE: '2409', HP: '2409', WE: '2409', SE: '2409',
    BE: '2410', TE: '2409', HE: '2409', ES: '2409', DE: '2410',
  },
  '1017': { // Индия — страница 16
    CT: '2409', CM: '2409', CH: '2410', H20: '2410', TF: '2410',
    GS: '2409', Sp: '2409', En: '2409',
    XG: '2409', 'AR/VR': '2409', AR: '2409', QC: '2409', CS: '2409', SC: '2409',
    BD: '2409', Cs: '2409', AI: '2409', ASI: '2409', BC: '2409',
    HF: '2410', HH: '2410', NT: '2410', PhT: '2409', Mb: '2409',
    Ge: '2409', BS: '2409', So: '2410', Or: '2409',
    DT: '2410', Ch: '2410', Mt: '2410', Sn: '2410', Me: '2409',
    MC: '2409', Rb: '2410', Mn: '2410',
    NE: '2410', FE: '2410', HP: '2410', WE: '2410', SE: '2410',
    BE: '2410', TE: '2409', HE: '2410', ES: '2410', DE: '2410',
  }
}

const aiLoading = ref(false)
let _baseCountryData = {} // сохраняем оригинальные данные из DB

function codeToIdMap() {
  const m = {}
  for (const [id, tech] of Object.entries(technologies.value)) m[tech.code] = id
  return m
}

function applyPdfStatuses() {
  const c2id = codeToIdMap()
  const d = {}
  for (const [countryId, statuses] of Object.entries(PDF_STATUSES)) {
    for (const [code, level] of Object.entries(statuses)) {
      const techId = c2id[code]
      if (techId) d[`${countryId}_${techId}`] = level
    }
  }
  countrySetData.value = d
}

async function applyAiStatuses() {
  aiLoading.value = true
  try {
    const techList = Object.values(technologies.value)
      .map(t => `${t.code}: ${t.name}`).join('\n')
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `Оцени технологический суверенитет России (RU) и Индии (IN) по следующим технологиям.\nДля каждой технологии укажи уровень владения строго одним из: КЛЮЧ / ШАНС / КРИЗИС.\nКЛЮЧ = суверенные решения востребованы на глобальных рынках.\nШАНС = есть платформы и лидеры, нет полного цикла.\nКРИЗИС = системная работа отсутствует, прогрессирует отставание.\n\nТехнологии:\n${techList}\n\nОтвет строго в JSON: { "RU": { "CT": "КЛЮЧ", ... }, "IN": { "CT": "ШАНС", ... } }`,
        systemPrompt: 'Ты — аналитик технологического суверенитета. Отвечай только JSON без пояснений.',
        application: 'SovPyramidAI'
      })
    })
    const { response } = await resp.json()
    const match = response.match(/\{[\s\S]*\}/)
    if (!match) return
    const aiData = JSON.parse(match[0])
    const c2id = codeToIdMap()
    const LVL = { 'КЛЮЧ': '2408', 'ШАНС': '2409', 'КРИЗИС': '2410' }
    const d = {}
    for (const [code, lv] of Object.entries(aiData.RU || {})) {
      const tid = c2id[code]; if (tid && LVL[lv]) d[`1016_${tid}`] = LVL[lv]
    }
    for (const [code, lv] of Object.entries(aiData.IN || {})) {
      const tid = c2id[code]; if (tid && LVL[lv]) d[`1017_${tid}`] = LVL[lv]
    }
    countrySetData.value = d
  } catch (e) {
    console.error('AI statuses error:', e)
  } finally {
    aiLoading.value = false
  }
}

async function _ensureLayers() {
  if (layers.value.length) return
  const first = models.value.find(m => !m.id.startsWith('__'))
  if (first) {
    loading.value = true
    try { layers.value = await loadLayers(first.id) } finally { loading.value = false }
  }
}

async function onModelChange() {
  if (selectedModelId.value === '__base__') {
    await _ensureLayers()
    applyPdfStatuses()
    return
  }
  if (selectedModelId.value === '__ai__') {
    await _ensureLayers()
    await applyAiStatuses()
    return
  }
  if (!selectedModelId.value) { layers.value = []; return }
  // fst db pyramid-модели (редактируются в Конструкторе)
  if (selectedModelId.value.startsWith('fst_')) {
    if (Object.keys(_baseCountryData).length) countrySetData.value = { ..._baseCountryData }
    loading.value = true
    try { layers.value = buildLayersFromFst(selectedModelId.value.slice(4)) }
    finally { loading.value = false }
    return
  }
  // восстанавливаем оригинальные данные из DB при переходе от спец.моделей
  if (Object.keys(_baseCountryData).length) countrySetData.value = { ..._baseCountryData }
  loading.value = true
  try { layers.value = await loadLayers(selectedModelId.value) }
  finally { loading.value = false }
}

// ── Загрузка: fst db ──────────────────────────────────────────────────────────
async function loadPortfolioCompanies() {
  const d = await fetchDB(FST_DB, '/object/1169?JSON_KV&full=1&LIMIT=100', fstToken)
  return (d?.object || []).map(o => ({ id: String(o.id), name: o.val }))
}
async function loadCoStatusMap() {
  const d = await fetchDB(FST_DB, `/object/${TYPE_STATUS}?JSON_KV&full=1&LIMIT=3000`, fstToken)
  if (!d) return {}
  const map = {}
  for (const o of (d?.object || [])) {
    const r = d.reqs?.[o.id] || {}
    const coId  = (r[FIELD_ST_COMPANY]  || '').replace(/\D/g, '')
    const thId  = (r[FIELD_ST_CONCEPT]  || '').replace(/\D/g, '')
    const st    =  r[FIELD_ST_STATUS]   || ''
    if (coId && thId) map[`${coId}_${thId}`] = { statusId: String(o.id), status: st }
  }
  return map
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [ta, fa] = await Promise.all([authDB(TECH_DB), authDB(FST_DB)])
    techToken = ta.token; fstToken = fa.token; fstXsrf = fa.xsrf

    const [mods, cats, techs, ctrs, sData, comps, smap, fstPyrs, fstCodes] = await Promise.all([
      loadTechModels(), loadCategories(), loadTechnologies(),
      loadCountries(), loadCountrySetData(),
      loadPortfolioCompanies(), loadCoStatusMap(),
      loadFstPyramids(), loadFstConceptCodes()
    ])
    fstPyramids.value       = fstPyrs
    fstConceptCodeMap.value = fstCodes
    // Спецмодели: базовая (PDF) и AI-анализ
    const SPECIAL_MODELS = [
      { id: '__base__', name: '🇷🇺🇮🇳 Базовая (PDF 2025)' },
      { id: '__ai__',   name: '🤖 AI-анализ (DeepSeek)'   },
    ]
    // Модели из Конструктора (fst db type 71341)
    const FST_MODELS = fstPyrs.map(p => ({ id: `fst_${p.id}`, name: `📐 ${p.name}` }))
    models.value           = [...SPECIAL_MODELS, ...FST_MODELS, ...mods]
    categories.value       = cats
    technologies.value     = techs
    countries.value        = ctrs
    countrySetData.value   = sData
    _baseCountryData       = { ...sData }
    portfolioCompanies.value = comps
    coStatusMap.value      = smap

    // Если передана начальная модель (из Конструктора) — применяем её
    if (props.initialModelId && models.value.find(m => m.id === props.initialModelId)) {
      selectedModelId.value = props.initialModelId
      await onModelChange()
    } else {
      // По умолчанию: базовая модель из PDF
      selectedModelId.value = '__base__'
      if (mods.length) layers.value = await loadLayers(mods[0].id)
      applyPdfStatuses()
    }
    selectedCountry1.value = ctrs[0] || null
    selectedCountry2.value = ctrs[1] || null
  } catch (e) {
    console.error('SovPyramidBlock:', e)
  } finally {
    loading.value = false
  }
})

// Реагируем на смену initialModelId (когда пользователь нажал "Смотреть на пирамиде")
watch(() => props.initialModelId, async (id) => {
  if (id && models.value.find(m => m.id === id)) {
    selectedModelId.value = id
    await onModelChange()
  }
})

// ── Палитра полос (SVG-исключение: hex разрешены) ────────────────────────────
const PALETTE = [
  '#e63946', // apex — насыщенный красный
  '#f4721b', // оранжевый
  '#f0a500', // янтарный
  '#2a9d8f', // изумрудный
  '#4361ee', // индиго
  '#7b2fbe', // фиолетовый
  '#d62598', // пурпурный
  '#1a8fe3', // голубой
  '#3bb273', // зелёный
  '#c1440e', // терракота
  '#5e548e', // тёмно-лиловый
  '#0077b6', // океанический
]

// ── Геометрия пирамиды ────────────────────────────────────────────────────────
const VW = 1200, VH = 760
const APEX = { x: 600, y: 28 }, BASE_Y = 726, BASE_LEFT = 128, BASE_RIGHT = 1072

function rowT(i, total) { return i === 0 ? 0 : (i + 0.5) / (total + 0.5) }
function edgeAt(t) {
  return {
    leftX:  APEX.x + (BASE_LEFT  - APEX.x) * t,
    rightX: APEX.x + (BASE_RIGHT - APEX.x) * t,
    y:      APEX.y + (BASE_Y     - APEX.y) * t
  }
}
const sideLabelFontSize = computed(() => {
  const n = layers.value.length
  return n <= 5 ? 13 : n <= 8 ? 11.5 : n <= 12 ? 10 : 9
})

const bands = computed(() => {
  if (!layers.value.length) return []
  const sorted = [...layers.value].sort((a, b) => b.level - a.level)
  const total  = sorted.length
  return sorted.map((layer, bi) => {
    const top  = edgeAt(rowT(bi,   total))
    const bot  = edgeAt(rowT(bi+1, total))
    const topY = bi === 0 ? APEX.y : top.y
    const botY = bot.y
    const midY = (topY + botY) / 2
    const bandH = botY - topY
    const outerPoints = bi === 0
      ? `${APEX.x},${APEX.y} ${bot.leftX},${bot.y} ${bot.rightX},${bot.y}`
      : `${top.leftX},${top.y} ${top.rightX},${top.y} ${bot.rightX},${bot.y} ${bot.leftX},${bot.y}`
    const colLeft  = bi === 0 ? bot.leftX  : top.leftX
    const colRight = bi === 0 ? bot.rightX : top.rightX
    const colW     = colRight - colLeft
    const nBricks  = Math.max(layer.techIds.length, 1)
    const brickW   = colW / nBricks
    const wAtText  = bi === 0 ? (colW * 0.5) / nBricks : brickW
    const fontSize = Math.min(Math.min(Math.max(bandH * 0.38, 9), 24), Math.max(wAtText * 0.55, 8))
    const textY    = bi === 0 ? topY + (botY - topY) * (2 / 3) : midY
    const bricks   = layer.techIds.map((tid, ci) => {
      const tech = technologies.value[tid] || {}
      return {
        techId: tid,
        code:        tech.code        || tid,
        name:        tech.name        || tid,
        description: tech.description || '',
        category:    categories.value[layer.categoryId] || '',
        x:  colLeft + ci * brickW,
        w:  brickW,
        cx: bi === 0 ? APEX.x : colLeft + (ci + 0.5) * brickW
      }
    })
    return {
      name:  categories.value[layer.categoryId] || layer.name,
      level: layer.level,
      color: PALETTE[bi % PALETTE.length],
      outerPoints, topY, botY, midY, textY, bandH, fontSize,
      topLeft:  bi === 0 ? APEX.x : top.leftX,
      topRight: bi === 0 ? APEX.x : top.rightX,
      bricks
    }
  })
})

// ── Вспомогательные функции: страны ──────────────────────────────────────────
function country1Status(techId) { return selectedCountry1.value ? countrySetData.value[`${selectedCountry1.value.id}_${techId}`] : null }
function country2Status(techId) { return selectedCountry2.value ? countrySetData.value[`${selectedCountry2.value.id}_${techId}`] : null }

// «Пятно» по Переслегину: анализ билатеральной совместности
function pятnoAnalysis(techId) {
  const s1 = country1Status(techId)
  const s2 = country2Status(techId)
  if (!s1 && !s2) return { color: null, label: null }
  if (s1 === '2408' && s2 === '2408') return { color: '#22c55e', label: 'Стратегическое совпадение' }
  if (s1 === '2410' && s2 === '2410') return { color: '#ef4444', label: 'Проблемное пятно — оба в КРИЗИС' }
  if (s1 === '2408' && s2 === '2410') return { color: '#3b82f6', label: 'Экспортный потенциал' }
  if (s1 === '2410' && s2 === '2408') return { color: '#a855f7', label: 'Совместность — нужен партнёр' }
  if (s1 === '2409' || s2 === '2409') return { color: '#f59e0b', label: 'Развиваемые технологии' }
  return { color: LEVEL_COLORS[s1] || LEVEL_COLORS[s2] || null, label: null }
}

// ── Вспомогательные функции: портфель ────────────────────────────────────────
function coIndex(coId) { return portfolioCompanies.value.findIndex(c => c.id === coId) }
function coColor(coId) { return COMPANY_COLORS[coIndex(coId) % COMPANY_COLORS.length] || '#6b7280' }
function coStatus(coId, techId) { return coStatusMap.value[`${coId}_${techId}`]?.status || null }

function brickCompanyDots(techId) {
  const filter = activeCo.value.size > 0 ? activeCo.value : new Set(portfolioCompanies.value.map(c => c.id))
  return portfolioCompanies.value
    .filter(co => filter.has(co.id) && coStatus(co.id, techId))
    .map(co => ({
      coId: co.id, name: co.name,
      color: coColor(co.id),
      status: coStatus(co.id, techId) || ''
    }))
}

function toggleCo(coId) {
  const s = new Set(activeCo.value)
  if (s.has(coId)) s.delete(coId); else s.add(coId)
  activeCo.value = s
}
function toggleFstCo(coId) {
  const s = new Set(fstActiveCo.value)
  if (s.has(coId)) s.delete(coId); else s.add(coId)
  fstActiveCo.value = s
}
function toggleExtCo(coId) {
  const s = new Set(extActiveCo.value)
  if (s.has(coId)) s.delete(coId); else s.add(coId)
  extActiveCo.value = s
}

// Покрытие фондами
function fstCovers(techId) {
  const active = fstActiveCo.value.size > 0 ? fstActiveCo.value : new Set(portfolioCompanies.value.map(c => c.id))
  return [...active].some(coId => coStatus(coId, techId))
}
function extCovers(techId) {
  const activeFund = OTHER_FUNDS.find(f => f.id === selectedOtherFund.value)
  if (!activeFund) return false
  const active = extActiveCo.value.size > 0 ? extActiveCo.value : new Set(activeFund.companies.map(c => c.id))
  const techObj = technologies.value[techId]
  if (!techObj) return false
  return [...active].some(coId => {
    const co = activeFund.companies.find(c => c.id === coId)
    return co?.techs?.includes(techObj.code)
  })
}

// ── Подсчёты ─────────────────────────────────────────────────────────────────
const totalBricks = computed(() => bands.value.reduce((s, b) => s + b.bricks.length, 0))
const coveredCount = computed(() => {
  let n = 0
  for (const band of bands.value) {
    for (const brick of band.bricks) {
      if (brickCompanyDots(brick.techId).length > 0) n++
    }
  }
  return n
})
const whiteSpotsCount = computed(() => totalBricks.value - coveredCount.value)

// Матрица совместности компаний (пересечения технологий)
const compatibilityPairs = computed(() => {
  const cos = portfolioCompanies.value
  if (cos.length < 2) return []
  const pairs = []
  for (let i = 0; i < cos.length; i++) {
    for (let j = i + 1; j < cos.length; j++) {
      const a = cos[i], b = cos[j]
      const allTechs = new Set([...Object.keys(coStatusMap.value)
        .filter(k => k.startsWith(a.id + '_'))
        .map(k => k.split('_')[1]),
        ...Object.keys(coStatusMap.value)
          .filter(k => k.startsWith(b.id + '_'))
          .map(k => k.split('_')[1])
      ])
      if (allTechs.size === 0) continue
      let synergy = 0
      for (const tid of allTechs) {
        const sa = coStatus(a.id, tid), sb = coStatus(b.id, tid)
        if (sa === 'КЛЮЧ' && sb === 'КРИЗИС') synergy += 2
        if (sa === 'КРИЗИС' && sb === 'КЛЮЧ') synergy += 2
        if (sa && sb && sa === sb) synergy += 1
      }
      const score = Math.round(Math.min((synergy / (allTechs.size * 2)) * 100, 100))
      const color = score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#94a3b8'
      pairs.push({ key: `${a.id}_${b.id}`, name1: a.name, name2: b.name, score, color })
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, 8)
})

// ── Цвет кирпичей ─────────────────────────────────────────────────────────────
const UNKNOWN_FILL = 'rgba(100,116,139,0.18)'

// Лёгкий тинт кирпича (без заливки полосы, режим «PDF»)
// Используем 8-символьный hex (#RRGGBBAA) — поддерживается всеми современными браузерами
function brickTintColor(techId) {
  if (viewMode.value === 'страны') {
    const { color } = pятnoAnalysis(techId)
    return color ? color + '20' : 'rgba(100,116,139,0.07)'  // #RRGGBB20 ≈ 12% opacity
  }
  if (viewMode.value === 'портфель') {
    const dots = brickCompanyDots(techId)
    return dots.length ? dots[0].color + '20' : 'rgba(100,116,139,0.07)'
  }
  if (fstCovers(techId) && extCovers(techId)) return '#22c55e20'
  if (fstCovers(techId)) return '#3b82f620'
  if (extCovers(techId)) return '#f59e0b20'
  return 'rgba(100,116,139,0.07)'
}

// Цвет текста индекса без заливки (темнее/светлее в зависимости от темы и статуса)
function brickLabelColor(techId) {
  if (viewMode.value === 'страны') {
    const s1 = country1Status(techId)
    if (s1 === '2408') return isDark.value ? '#4ade80' : '#16a34a'
    if (s1 === '2410') return isDark.value ? '#f87171' : '#dc2626'
    if (s1 === '2409') return isDark.value ? '#fbbf24' : '#d97706'
  }
  if (viewMode.value === 'портфель') {
    const dots = brickCompanyDots(techId)
    if (dots.length) return dots[0].color
  }
  return isDark.value ? 'rgba(148,163,184,0.75)' : 'rgba(71,85,105,0.7)'
}

function brickFill(techId) {
  if (viewMode.value === 'страны') {
    const { color } = pятnoAnalysis(techId)
    return color || UNKNOWN_FILL
  }
  if (viewMode.value === 'портфель') {
    const dots = brickCompanyDots(techId)
    if (!dots.length) return UNKNOWN_FILL
    const coId = dots[0].coId
    return STATUS_HEX[coStatus(coId, techId)] || COMPANY_COLORS[coIndex(coId) % COMPANY_COLORS.length]
  }
  // Фонды режим
  const our = fstCovers(techId), ext = extCovers(techId)
  if (our && ext)  return '#22c55e'
  if (our && !ext) return '#3b82f6'
  if (!our && ext) return '#f59e0b'
  return UNKNOWN_FILL
}
function brickOpacity(techId) { return brickFill(techId) === UNKNOWN_FILL ? 1 : 0.78 }
function brickTextFill(techId) {
  const f = brickFill(techId)
  return f === UNKNOWN_FILL
    ? (isDark.value ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.5)')
    : 'rgba(255,255,255,0.95)'
}

// ── Счёт полосы (зависит от режима) ──────────────────────────────────────────
function bandScore(band) {
  if (!band.bricks.length) return ''
  if (viewMode.value === 'страны') {
    const key = band.bricks.filter(b => country1Status(b.techId) === '2408').length
    return `${key}/${band.bricks.length}`
  }
  if (viewMode.value === 'портфель') {
    const cov = band.bricks.filter(b => brickCompanyDots(b.techId).length > 0).length
    return `${cov}/${band.bricks.length}`
  }
  const our = band.bricks.filter(b => fstCovers(b.techId)).length
  return `${our}/${band.bricks.length}`
}
function bandScoreColor(band) {
  if (!band.bricks.length) return 'rgba(148,163,184,0.4)'
  const [num, den] = (bandScore(band) || '0/1').split('/').map(Number)
  const pct = den > 0 ? num / den : 0
  return pct >= 0.7 ? '#22c55e' : pct >= 0.4 ? '#f59e0b' : '#ef4444'
}

// ── Тултип ───────────────────────────────────────────────────────────────────
function showTooltip(brick, e) {
  const s1 = country1Status(brick.techId)
  const s2 = country2Status(brick.techId)
  const { color, label } = pятnoAnalysis(brick.techId)
  tt.value = {
    visible: true, x: e.clientX, y: e.clientY - 12,
    techId: brick.techId, code: brick.code, name: brick.name, category: brick.category,
    left:  LEVEL_COLORS[s1] || '', right: LEVEL_COLORS[s2] || '',
    pятно: label || ''
  }
}
function moveTooltip(e) { if (tt.value.visible) { tt.value.x = e.clientX; tt.value.y = e.clientY - 12 } }
function hideTooltip()  { tt.value.visible = false }

// ── Модальное окно ────────────────────────────────────────────────────────────
function openModal(brick) {
  modalBrick.value = brick
  editStatuses.value = {}
  for (const co of portfolioCompanies.value) {
    editStatuses.value[co.id] = coStatus(co.id, brick.techId) || null
  }
  modalVisible.value = true
}
async function saveStatuses() {
  if (!modalBrick.value) return
  saving.value = true
  try {
    for (const co of portfolioCompanies.value) {
      const newStatus = editStatuses.value[co.id]
      const key       = `${co.id}_${modalBrick.value.techId}`
      const existing  = coStatusMap.value[key]
      if (newStatus && !existing) {
        await postDB(FST_DB, `/_m_new/${TYPE_STATUS}`, {
          [`t${TYPE_STATUS}`]:      `${modalBrick.value.code} — ${co.name}`,
          [`r${FIELD_ST_CONCEPT}`]: modalBrick.value.techId,
          [`r${FIELD_ST_COMPANY}`]: co.id,
          [`r${FIELD_ST_STATUS}`]:  newStatus
        }, fstToken, fstXsrf)
      } else if (newStatus && existing && existing.status !== newStatus) {
        await postDB(FST_DB, `/_m_set/${existing.statusId}`, { [`r${FIELD_ST_STATUS}`]: newStatus }, fstToken, fstXsrf)
      } else if (!newStatus && existing) {
        await postDB(FST_DB, `/_m_del/${existing.statusId}`, {}, fstToken, fstXsrf)
      }
    }
    coStatusMap.value = await loadCoStatusMap()
    modalVisible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;600;700&display=swap');

.spb {
  display: flex; flex-direction: column;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  min-height: 560px;
}

/* ── Шапка ── */
.spb-header { display: flex; flex-direction: column; gap: 6px; padding-bottom: 10px; flex-shrink: 0; }
.spb-header-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.spb-controls { display: flex; align-items: center; gap: 6px; }

/* Панель настроек */
.spb-settings {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  padding: 8px 14px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
}
.spb-settings-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--p-text-muted-color);
  white-space: nowrap;
}
.spb-settings-row { display: flex; align-items: center; gap: 8px; }
.spb-settings-label {
  font-size: 12px; color: var(--p-text-color);
  cursor: pointer; white-space: nowrap;
  user-select: none;
}

/* Легенда — пилюли */
.spb-legend { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.leg-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 9px 2px 6px; border-radius: 20px;
  font-size: 10px; font-weight: 500;
  color: var(--p-text-color);
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  white-space: nowrap;
}
.leg-pill::before {
  content: '';
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: var(--dot, rgba(100,116,139,0.4));
}
.leg-pill-note {
  font-size: 10px; color: var(--p-text-muted-color);
  padding: 2px 4px;
}

.spb-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--p-text-muted-color); }
.spb-empty   { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--p-text-muted-color); font-size: 13px; }

/* ── Основная строка ── */
.spb-main-row { flex: 1; display: flex; align-items: stretch; gap: 8px; min-height: 0; }
.spb-svg-wrap { flex: 1; min-height: 0; }
.spb-svg      { width: 100%; height: 100%; min-height: 460px; }

/* ── Панели стран / компаний ── */
.spb-panel {
  width: 116px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: stretch;
  gap: 3px; overflow-y: auto; padding-top: 4px;
}
.panel-label {
  font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
  text-transform: uppercase; color: var(--p-text-muted-color);
  text-align: center; padding: 2px 4px 8px;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 4px;
}
.panel-sublabel {
  font-size: 9px; font-weight: 600; letter-spacing: 1px;
  text-transform: uppercase; color: var(--p-text-muted-color);
  text-align: center; padding: 8px 4px 4px; margin-top: 4px;
  border-top: 1px solid var(--p-content-border-color);
}
.panel-item {
  padding: 6px 8px; border-radius: 8px; cursor: pointer;
  font-size: 11px; color: var(--p-text-color);
  border: 1px solid transparent; transition: all 0.14s;
  text-align: center; line-height: 1.3;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.panel-item:hover  { background: var(--p-surface-ground); border-color: var(--p-content-border-color); }
.panel-item.active {
  background: var(--p-surface-ground);
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
  font-weight: 600;
}
/* Флаг + название — вертикально */
.flag-item { flex-direction: column; gap: 4px; padding: 8px 4px; }
.flag-item .panel-flag { border-radius: 3px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
.flag-item span { font-size: 10px; font-weight: 600; }
/* Активный флаг: рамка цветом флага/акцента */
.flag-item.active { border-color: var(--p-primary-color); }

.company-item       { opacity: 0.5; transition: opacity 0.14s; }
.company-item.active { opacity: 1; }
.fund-item           { font-weight: 600; font-size: 12px; }
.sub-item            { font-size: 10px; opacity: 0.75; }
.sub-item.active     { opacity: 1; }

.panel-empty { font-size: 10px; color: var(--p-text-muted-color); text-align: center; padding: 10px 4px; line-height: 1.5; }
.panel-score-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 8px; font-size: 10px;
  border-top: 1px solid var(--p-content-border-color); margin-top: 4px;
}
.panel-score { font-weight: 700; font-size: 12px; }

/* Точка компании */
.co-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* Матрица совместности */
.compat-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.compat-row  { display: flex; flex-direction: column; gap: 3px; }
.compat-names {
  font-size: 9px; color: var(--p-text-muted-color);
  line-height: 1.3; text-align: center;
}
.compat-bar-wrap {
  background: var(--p-surface-ground);
  border-radius: 4px; height: 5px; overflow: hidden;
}
.compat-bar { height: 5px; border-radius: 4px; transition: width 0.5s ease; }
.compat-pct { font-size: 10px; font-weight: 700; text-align: right; }

/* ── Кирпичи SVG ── */
.spb-brick { cursor: pointer; }
.brick-text { transition: opacity 0.1s; }
.spb-brick:hover .brick-text {
  opacity: 1 !important;
  filter: drop-shadow(0 0 4px rgba(255,255,255,0.8));
}

/* ── Тултип ── */
.spb-tooltip {
  position: fixed; z-index: 9999;
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 12px 16px 10px;
  min-width: 200px; max-width: 300px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.4);
  display: flex; flex-direction: column; gap: 6px;
}
.spb-tt-top { display: flex; align-items: flex-start; gap: 10px; }
.spb-tt-indicator {
  display: flex; width: 28px; height: 28px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0; margin-top: 3px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.spb-tt-half { flex: 1; }
.spb-tt-code { font-size: 24px; font-weight: 700; letter-spacing: 1.5px; color: var(--p-text-color); line-height: 1; }
.spb-tt-name { font-size: 12px; font-weight: 500; color: var(--p-text-color); line-height: 1.4; margin-top: 3px; }
.spb-tt-cat  {
  font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px;
  padding-top: 4px; border-top: 1px solid var(--p-content-border-color);
}
.spb-tt-row  { display: flex; align-items: center; gap: 7px; font-size: 11px; }
.spb-tt-dot  { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
.spb-tt-label { color: var(--p-text-muted-color); flex: 1; }
.spb-tt-val   { font-weight: 700; }
.spb-tt-pятно {
  font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
  padding: 4px 10px; border-radius: 6px; margin-top: 2px;
  color: #fff;
}
.spb-tt-white { font-size: 10px; color: var(--p-text-muted-color); font-style: italic; }
.spb-tt-arrow {
  position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
  border-left: 8px solid transparent; border-right: 8px solid transparent;
  border-top: 8px solid var(--p-content-border-color);
}
.spb-tt-arrow::after {
  content: ''; position: absolute;
  bottom: 1px; left: -7px;
  border-left: 7px solid transparent; border-right: 7px solid transparent;
  border-top: 7px solid var(--p-surface-card);
}

/* ── Модальное окно (фон через :pt на Dialog) ── */
.spb-modal { display: flex; flex-direction: column; gap: 16px; }
.spb-modal-top { display: flex; align-items: flex-start; gap: 14px; }
.spb-modal-badge {
  padding: 8px 16px; border-radius: 8px; font-weight: 700;
  font-size: 22px; letter-spacing: 2px; color: #fff; flex-shrink: 0;
  min-width: 72px; text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}
.spb-modal-cat  { font-size: 11px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.spb-modal-desc { font-size: 13px; color: var(--p-text-color); line-height: 1.6; }
.spb-modal-set  { background: var(--p-surface-ground); border-radius: 10px; padding: 14px; }
.spb-modal-note { font-size: 11px; color: var(--p-text-muted-color); }
.spb-modal-co-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 7px 0; border-bottom: 1px solid var(--p-content-border-color);
}
.spb-modal-co-row:last-child { border-bottom: none; }
.spb-modal-co-name { font-size: 12px; font-weight: 600; color: var(--p-text-color); min-width: 90px; }
.page-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--p-text-muted-color); }
.spb-modal-leaders { background: var(--p-surface-ground); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.spb-modal-leaders-row { display: flex; align-items: flex-start; gap: 8px; }
.spb-leaders-flag { font-size: 16px; line-height: 1.4; flex-shrink: 0; }
.spb-leaders-list { font-size: 12px; color: var(--p-text-color); line-height: 1.6; }
/* Тип взаимодействия */
.spb-modal-interaction { display: flex; align-items: center; gap: 8px; }
/* Потенциальное сотрудничество */
.spb-modal-collab { background: var(--p-surface-ground); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.spb-collab-row { display: flex; align-items: flex-start; gap: 10px; }
.spb-collab-body { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.spb-collab-offer, .spb-collab-need { font-size: 12px; color: var(--p-text-color); line-height: 1.6; display: flex; flex-direction: column; gap: 3px; }
.spb-collab-tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.07em; border-radius: 4px; padding: 1px 5px; margin-bottom: 2px; }
.spb-collab-tag.offer { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green-dark); }
.spb-collab-tag.need  { background: color-mix(in srgb, var(--fst-blue) 15%, transparent); color: var(--fst-blue-dark); }
</style>

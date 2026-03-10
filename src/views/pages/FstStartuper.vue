<template>
  <div class="spw" @dragover.prevent="dragging=true" @dragleave.self="dragging=false" @drop.prevent="onDrop">

    <!-- Drag overlay -->
    <Transition name="fade">
      <div v-if="dragging" class="spw-drag-overlay">
        <div class="spw-drag-box"><i class="pi pi-paperclip"></i><span>Отпустите файл</span></div>
      </div>
    </Transition>

    <!-- ══════════ TOPBAR ══════════ -->
    <div class="spw-topbar">
      <div class="spw-topbar-left">
        <i class="pi pi-rocket" style="color:var(--p-primary-color);font-size:18px"></i>
        <span class="spw-co-name">{{ twin.company || 'Моя компания' }}</span>
        <span v-if="twin.stage" class="spw-badge spw-badge--blue">{{ twin.stage }}</span>
        <span v-if="twin.trl" class="spw-badge spw-badge--purple">TRL {{ twin.trl }}</span>
        <div class="spw-kpi-strip">
          <div class="spw-kpi" v-for="k in kpiItems" :key="k.key">
            <span class="spw-kpi-val" :style="{ color: k.color }">{{ k.val }}</span>
            <span class="spw-kpi-label">{{ k.label }}</span>
          </div>
        </div>
      </div>
      <div class="spw-topbar-right">
        <!-- Role switcher -->
        <div class="spw-roles">
          <button v-for="r in ROLES" :key="r.key"
            :class="['spw-role-btn', { active: role === r.key }]"
            @click="role = r.key" :title="r.desc">
            <i :class="r.icon"></i> {{ r.label }}
          </button>
        </div>
        <div class="spw-topbar-sep"></div>
        <!-- Current user chip -->
        <div class="spw-user-chip" :title="`Воркспейс привязан к: ${currentUserEmail}`">
          <i class="pi pi-user"></i>
          <span>{{ currentUserEmail || 'Аноним' }}</span>
        </div>
        <div class="spw-topbar-sep"></div>
        <button class="spw-btn spw-btn--ghost" @click="clearSession" title="Сбросить сессию">
          <i class="pi pi-refresh"></i>
        </button>
        <button v-if="twin.completeness >= 80" class="spw-btn spw-btn--primary" @click="sendToIC">
          <i class="pi pi-send"></i> В ИК
        </button>
      </div>
    </div>

    <!-- ══════════ BODY ══════════ -->
    <div class="spw-body">

      <!-- ─── LEFT: Artifact Navigator ─── -->
      <div class="spw-nav">
        <div v-for="sec in visibleArtifacts" :key="sec.key" class="spw-nav-section">
          <div class="spw-nav-head">
            <i :class="sec.icon"></i>
            <span>{{ sec.label }}</span>
          </div>
          <div v-for="item in sec.items" :key="item.key"
            :class="['spw-nav-item', { active: activeView === item.key }]"
            @click="openView(item)">
            <i :class="item.icon" style="font-size:12px;opacity:.7"></i>
            <span>{{ item.label }}</span>
            <span v-if="item.filled" class="spw-nav-dot spw-nav-dot--ok" title="Заполнен"></span>
            <span v-else-if="item.required" class="spw-nav-dot spw-nav-dot--empty" title="Требует заполнения"></span>
          </div>
        </div>
      </div>

      <!-- ─── CENTER: Main Workspace ─── -->
      <div class="spw-main">

        <!-- Dashboard -->
        <template v-if="activeView === 'dashboard'">
          <div class="spw-dash">
            <!-- Completeness card -->
            <div class="spw-dash-row">
              <div class="spw-card spw-card--wide">
                <div class="spw-card-head"><i class="pi pi-chart-pie"></i> Готовность пакета документов</div>
                <div class="spw-complete-bar">
                  <div class="spw-complete-fill" :style="{ width: twin.completeness + '%', background: completenessColor }"></div>
                </div>
                <div class="spw-complete-label">{{ twin.completeness }}% заполнено</div>
                <div class="spw-doc-status-grid">
                  <div v-for="doc in docStatus" :key="doc.key" :class="['spw-ds', `spw-ds--${doc.status}`]">
                    <i :class="doc.icon"></i>
                    <span>{{ doc.label }}</span>
                  </div>
                </div>
              </div>

              <!-- Company metrics -->
              <div class="spw-card">
                <div class="spw-card-head"><i class="pi pi-building"></i> Компания</div>
                <div class="spw-metric-list">
                  <div class="spw-ml-row" v-for="m in companyMetrics" :key="m.key">
                    <span class="spw-ml-label">{{ m.label }}</span>
                    <span class="spw-ml-val">{{ m.val || '—' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scoring if available -->
            <div v-if="scoring.totalScore" class="spw-card spw-card--wide">
              <div class="spw-card-head"><i class="pi pi-star"></i> AI-оценка · {{ scoring.totalScore }}/100 · {{ scoring.verdict }}</div>
              <div class="spw-score-grid">
                <div v-for="(dim, key) in scoring.dimensions" :key="key" class="spw-score-row">
                  <span class="spw-score-label">{{ SCORE_LABELS[key] }}</span>
                  <div class="spw-score-track"><div :style="{ width: dim.score*10+'%', background: scoreColor(dim.score) }"></div></div>
                  <b class="spw-score-num" :style="{ color: scoreColor(dim.score) }">{{ dim.score }}</b>
                </div>
              </div>
            </div>

            <!-- Beacons -->
            <div v-if="beacons.length" class="spw-card spw-card--wide">
              <div class="spw-card-head"><i class="pi pi-exclamation-triangle" style="color:var(--p-orange-400)"></i> Сигналы</div>
              <div v-for="b in beacons" :key="b.text" :class="['spw-beacon', `spw-beacon--${b.severity}`]">
                <b>{{ b.dimension }}</b>: {{ b.text }}
              </div>
            </div>

            <!-- Quick start if empty -->
            <div v-if="!twin.company" class="spw-card spw-card--wide spw-card--start">
              <div class="spw-card-head">С чего начать</div>
              <p style="font-size:13px;color:var(--p-text-muted-color);margin:0 0 12px">Расскажите агенту о проекте или загрузите любой документ</p>
              <div class="spw-start-actions">
                <button class="spw-btn spw-btn--primary" @click="openView({ key: 'agent', type: 'chat' })">
                  <i class="pi pi-comments"></i> Открыть агента
                </button>
                <label class="spw-btn spw-btn--outline">
                  <i class="pi pi-upload"></i> Загрузить файл
                  <input type="file" accept="*" multiple @change="onFileInput" hidden />
                </label>
                <button class="spw-demo-btn" @click="loadDemo('vega')">🚀 Загрузить VEGA demo</button>
              </div>
            </div>
          </div>
        </template>

        <!-- Agent chat -->
        <template v-else-if="activeView === 'agent'">
          <div class="spw-chat-wrap">
            <div class="spw-messages" ref="messagesEl">
              <template v-for="(msg, i) in chatMessages" :key="i">
                <div v-if="msg.role === 'divider'" class="spw-divider"><span>{{ msg.text }}</span></div>
                <div v-else-if="msg.role === 'user'" class="spw-msg spw-msg--user">
                  <div class="spw-msg-body">
                    <img v-if="msg.isImage" :src="msg.dataUrl" class="spw-msg-img" />
                    <div v-else-if="msg.file" class="spw-msg-file"><i class="pi pi-paperclip"></i> {{ msg.file }}</div>
                    <div v-if="msg.text" v-html="md(msg.text)" class="spw-msg-text"></div>
                  </div>
                  <div class="spw-msg-av spw-msg-av--user">👤</div>
                </div>
                <div v-else class="spw-msg spw-msg--agent">
                  <div class="spw-msg-av" :style="{ background: agent(msg.agent).color }">{{ agent(msg.agent).icon }}</div>
                  <div class="spw-msg-body">
                    <div class="spw-msg-agent-name" :style="{ color: agent(msg.agent).color }">{{ agent(msg.agent).name }}</div>
                    <div v-if="msg.type === 'event'" :class="['spw-event-pill', 'spw-ep--'+(msg.step||'info')]">{{ msg.text }}</div>
                    <div v-else v-html="md(msg.text)" class="spw-msg-text"></div>
                    <div v-if="msg.scoreCard" class="spw-score-card">
                      <div class="spw-sc-total" :class="scoreClass(msg.scoreCard.totalScore)">
                        {{ msg.scoreCard.totalScore }}<span>/100</span>
                      </div>
                      <div class="spw-sc-bars">
                        <div v-for="(dim, key) in msg.scoreCard.dimensions" :key="key" class="spw-sc-row">
                          <span>{{ SCORE_LABELS[key] }}</span>
                          <div class="spw-sc-track"><div :style="{ width: dim.score*10+'%', background: scoreColor(dim.score) }"></div></div>
                          <b>{{ dim.score }}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-if="thinking" class="spw-msg spw-msg--agent">
                <div class="spw-msg-av" :style="{ background: AGENTS.navigator.color }">🤖</div>
                <div class="spw-msg-body">
                  <div class="spw-msg-agent-name" :style="{ color: AGENTS.navigator.color }">Навигатор</div>
                  <div class="spw-typing"><span/><span/><span/></div>
                </div>
              </div>
            </div>
            <div class="spw-input-bar">
              <label class="spw-attach-btn">
                <i class="pi pi-paperclip"></i>
                <input type="file" accept="*" multiple @change="onFileInput" hidden />
              </label>
              <textarea v-model="inputText" ref="inputEl" class="spw-input"
                placeholder="Напишите о проекте или задайте вопрос агенту..."
                rows="1" @keydown.enter.exact.prevent="sendMessage" @input="autoResize" @paste="onPaste"
              ></textarea>
              <button class="spw-send-btn" :class="{ active: inputText.trim() }"
                @click="sendMessage" :disabled="thinking && !inputText.trim()">
                <i :class="thinking ? 'pi pi-spin pi-spinner' : 'pi pi-send'"></i>
              </button>
            </div>
          </div>
        </template>

        <!-- Document viewer -->
        <template v-else-if="activeItem?.type === 'doc'">
          <div class="spw-doc-view">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i :class="activeItem.icon"></i> {{ activeItem.label }}</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--primary" @click="fillDocWithAI(activeItem)">
                  <i class="pi pi-magic"></i> Заполнить с AI
                </button>
                <a v-if="activeItem.url" :href="activeItem.url" target="_blank" class="spw-btn spw-btn--outline">
                  <i class="pi pi-external-link"></i> Открыть
                </a>
                <a v-if="activeItem.downloadUrl" :href="activeItem.downloadUrl" class="spw-btn spw-btn--ghost">
                  <i class="pi pi-download"></i>
                </a>
              </div>
            </div>
            <div class="spw-doc-body">
              <iframe v-if="activeItem.url && activeItem.url.endsWith('.pdf')"
                :src="activeItem.url" class="spw-doc-iframe" />
              <div v-else class="spw-doc-placeholder">
                <i class="pi pi-file-word" style="font-size:56px;color:var(--p-primary-color);opacity:.4"></i>
                <h3>{{ activeItem.label }}</h3>
                <p>Нажмите «Заполнить с AI» — агент автоматически заполнит документ<br>данными вашей компании и запросит недостающее</p>
                <div v-if="activeItem.fields?.length" class="spw-doc-fields">
                  <div v-for="f in activeItem.fields" :key="f.key" class="spw-doc-field">
                    <label>{{ f.label }}</label>
                    <input v-model="docValues[f.key]" :placeholder="f.placeholder" class="spw-field-input" />
                  </div>
                </div>
              </div>
              <!-- AI response for this doc -->
              <div v-if="docAiResponse" class="spw-doc-ai-resp" v-html="md(docAiResponse)"></div>
            </div>
          </div>
        </template>

        <!-- GOST Tech Doc -->
        <template v-else-if="activeItem?.type === 'doc-gost'">
          <div class="spw-gost-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i :class="activeItem.icon"></i> {{ activeItem.label }}</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--primary" :disabled="gostGenerating" @click="generateGostDoc(activeItem)">
                  <i :class="gostGenerating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
                  {{ gostGenerating ? 'Генерирую...' : gostDoc[activeItem.key] ? 'Перегенерировать' : 'Сгенерировать с AI' }}
                </button>
                <button v-if="gostDoc[activeItem.key]" class="spw-btn spw-btn--ghost" @click="copyGostDoc(activeItem.key)" title="Скопировать">
                  <i class="pi pi-copy"></i>
                </button>
              </div>
            </div>
            <div class="spw-gost-body">
              <div v-if="!gostDoc[activeItem.key] && !gostGenerating" class="spw-doc-placeholder">
                <i :class="activeItem.icon" style="font-size:48px;opacity:.3"></i>
                <h3>{{ activeItem.label }}</h3>
                <p>{{ gostDescription(activeItem.gostType) }}</p>
                <button class="spw-btn spw-btn--primary" @click="generateGostDoc(activeItem)">
                  <i class="pi pi-sparkles"></i> Сгенерировать с AI
                </button>
              </div>
              <div v-else-if="gostGenerating" class="spw-gost-loading">
                <i class="pi pi-spin pi-spinner" style="font-size:28px;color:var(--p-primary-color)"></i>
                <div style="font-size:14px;font-weight:600">AI пишет документ по ГОСТ...</div>
                <div style="font-size:11px;color:var(--p-text-muted-color)">{{ gostLoadingStep }}</div>
              </div>
              <pre v-else class="spw-gost-pre">{{ gostDoc[activeItem.key] }}</pre>
            </div>
          </div>
        </template>

        <!-- Term Sheet Constructor -->
        <template v-else-if="activeItem?.type === 'termsheet'">
          <div class="spw-ts-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-file-edit"></i> Term Sheet — Конструктор</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--primary" :disabled="tsGenerating" @click="generateTermSheet">
                  <i :class="tsGenerating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
                  {{ tsGenerating ? 'Заполняю...' : 'AI заполнить' }}
                </button>
                <a href="https://ai2fund.ru/term_sheet.pdf" target="_blank" class="spw-btn spw-btn--outline">
                  <i class="pi pi-external-link"></i> Эталон PDF
                </a>
              </div>
            </div>
            <div class="spw-ts-body">
              <div class="spw-ts-form">
                <div v-for="section in TS_SECTIONS" :key="section.key" class="spw-ts-section">
                  <div class="spw-ts-sec-head">{{ section.label }}</div>
                  <div v-for="field in section.fields" :key="field.key" class="spw-ts-field">
                    <label>{{ field.label }}</label>
                    <select v-if="field.type === 'select'" v-model="termSheet[field.key]" class="spw-field-input">
                      <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <input v-else v-model="termSheet[field.key]" :placeholder="field.placeholder" class="spw-field-input" />
                  </div>
                </div>
              </div>
              <div class="spw-ts-preview">
                <div class="spw-ts-preview-head">Предпросмотр Term Sheet</div>
                <div class="spw-ts-preview-content" v-html="renderTermSheet()"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- Smart Contract -->
        <template v-else-if="activeView === 'smart-contract'">
          <div class="spw-sc-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-verified"></i> Smart Contract сделки</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--primary" :disabled="scGenerating" @click="generateSmartContract">
                  <i :class="scGenerating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
                  {{ scGenerating ? 'Формирую...' : smartContract ? 'Обновить' : 'Сформировать контракт' }}
                </button>
                <button v-if="smartContract" class="spw-btn spw-btn--outline" @click="sendToIC">
                  <i class="pi pi-send"></i> В ИК на подпись
                </button>
              </div>
            </div>
            <div class="spw-sc-body">
              <div v-if="!smartContract && !scGenerating" class="spw-doc-placeholder">
                <i class="pi pi-verified" style="font-size:56px;color:var(--fst-purple);opacity:.4"></i>
                <h3>Smart Contract сделки</h3>
                <p>Смарт-контракт аккумулирует параметры Term Sheet, решение ИК и транши сделки.<br>
                   Формируется автоматически по результатам работы агентов и инвесткомитета.</p>
                <button class="spw-btn spw-btn--primary" @click="generateSmartContract">
                  <i class="pi pi-sparkles"></i> Сформировать контракт
                </button>
              </div>
              <div v-else-if="scGenerating" class="spw-gost-loading">
                <i class="pi pi-spin pi-spinner" style="font-size:28px;color:var(--p-primary-color)"></i>
                <div style="font-size:14px;font-weight:600">AI формирует смарт-контракт сделки...</div>
                <div style="font-size:11px;color:var(--p-text-muted-color)">Синтез данных Term Sheet + решение агентов + ИК...</div>
              </div>
              <div v-else-if="smartContract" class="spw-sc-content">
                <!-- Header -->
                <div class="spw-sc-header-card">
                  <div :class="['spw-sc-status', smartContract.status === 'APPROVED' ? 'sc-approved' : 'sc-pending']">
                    <i :class="smartContract.status === 'APPROVED' ? 'pi pi-check-circle' : 'pi pi-clock'"></i>
                    {{ smartContract.status === 'APPROVED' ? 'Одобрено ИК' : 'Ожидает ИК' }}
                  </div>
                  <div class="spw-sc-id">{{ smartContract.id }}</div>
                  <div class="spw-sc-ts">{{ smartContract.timestamp }}</div>
                </div>
                <!-- Parties -->
                <div class="spw-sc-section">
                  <div class="spw-sc-sec-title"><i class="pi pi-users"></i> Стороны сделки</div>
                  <div v-for="p in (smartContract.parties || [])" :key="p.role" class="spw-sc-party">
                    <span class="spw-sc-party-role">{{ p.role }}</span>
                    <span class="spw-sc-party-name">{{ p.name }}</span>
                  </div>
                </div>
                <!-- Terms -->
                <div class="spw-sc-section">
                  <div class="spw-sc-sec-title"><i class="pi pi-list"></i> Условия сделки</div>
                  <div class="spw-sc-terms-grid">
                    <div v-for="t in (smartContract.terms || [])" :key="t.key" class="spw-sc-term">
                      <span class="spw-sc-term-label">{{ t.label }}</span>
                      <span class="spw-sc-term-value">{{ t.value }}</span>
                    </div>
                  </div>
                </div>
                <!-- Milestones -->
                <div class="spw-sc-section">
                  <div class="spw-sc-sec-title"><i class="pi pi-flag"></i> Вехи и триггеры выплат</div>
                  <div v-for="(m, i) in (smartContract.milestones || [])" :key="i" class="spw-sc-milestone">
                    <span class="spw-sc-ms-num">{{ i + 1 }}</span>
                    <div class="spw-sc-ms-body">
                      <div class="spw-sc-ms-title">{{ m.title }}</div>
                      <div class="spw-sc-ms-cond">{{ m.condition }}</div>
                    </div>
                    <span class="spw-sc-ms-amount">{{ m.amount }}</span>
                  </div>
                </div>
                <!-- IC Decision -->
                <div v-if="smartContract.icDecision" class="spw-sc-section">
                  <div class="spw-sc-sec-title"><i class="pi pi-comments"></i> Решение инвесткомитета</div>
                  <div class="spw-sc-ic-decision" v-html="md(smartContract.icDecision)"></div>
                </div>
                <!-- JSON export -->
                <div class="spw-sc-json-toggle" @click="showScJson = !showScJson">
                  <i class="pi pi-code"></i> {{ showScJson ? 'Скрыть JSON' : 'Показать JSON' }}
                </div>
                <pre v-if="showScJson" class="spw-sc-json">{{ JSON.stringify(smartContract, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </template>

        <!-- FinModel -->
        <template v-else-if="activeView === 'finmodel'">
          <div class="spw-finmodel-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-table"></i> Финансовая модель — VentureOS</span>
              <div class="spw-doc-actions">
                <span style="font-size:11px;color:var(--p-text-muted-color);margin-right:8px">5-летний прогноз · Pre-Seed 60M₽</span>
              </div>
            </div>
            <div class="spw-finmodel-body">
              <FstFinModelBlock v-if="finmodelId" :modelId="finmodelId" database="fst" />
              <div v-else class="spw-fm-static">
                <!-- Scenarios strip -->
                <div class="spw-fm-scenarios">
                  <div v-for="(sc, name) in vegaFinmodel.scenarios" :key="name"
                    :class="['spw-fm-scenario', `spw-fm-sc--${name}`]">
                    <div class="spw-fm-sc-label">{{ name === 'base' ? 'Базовый' : name === 'optimistic' ? 'Оптимистичный' : 'Пессимистичный' }}</div>
                    <div class="spw-fm-sc-row"><span>IRR</span><strong>{{ sc.irr }}%</strong></div>
                    <div class="spw-fm-sc-row"><span>MOIC</span><strong>{{ sc.moic }}x</strong></div>
                    <div class="spw-fm-sc-row"><span>Окупаемость</span><strong>{{ sc.payback }} лет</strong></div>
                  </div>
                </div>
                <!-- P&L Table -->
                <div class="spw-fm-table-wrap">
                  <table class="spw-fm-table">
                    <thead>
                      <tr>
                        <th>Показатель</th>
                        <th v-for="y in vegaFinmodel.years" :key="y">{{ y }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Клиентов (фондов)</td><td v-for="(v,i) in vegaFinmodel.clients" :key="i">{{ v }}</td></tr>
                      <tr class="spw-fm-highlight"><td>ARR, млн ₽</td><td v-for="(v,i) in vegaFinmodel.arr" :key="i">{{ v }}</td></tr>
                      <tr><td>COGS, млн ₽</td><td v-for="(v,i) in vegaFinmodel.cogs" :key="i">{{ v }}</td></tr>
                      <tr><td>Валовая прибыль, млн ₽</td><td v-for="(v,i) in vegaFinmodel.grossProfit" :key="i">{{ v }}</td></tr>
                      <tr><td>OpEx, млн ₽</td><td v-for="(v,i) in vegaFinmodel.opex" :key="i">{{ v }}</td></tr>
                      <tr class="spw-fm-highlight"><td>EBITDA, млн ₽</td>
                        <td v-for="(v,i) in vegaFinmodel.ebitda" :key="i"
                          :style="{ color: v >= 0 ? 'var(--fst-green)' : 'var(--fst-red)', fontWeight: 700 }">{{ v }}</td>
                      </tr>
                      <tr><td>MRR, млн ₽</td><td v-for="(v,i) in vegaFinmodel.mrr" :key="i">{{ v }}</td></tr>
                      <tr><td>NRR, %</td><td v-for="(v,i) in vegaFinmodel.nrr" :key="i">{{ v ?? '—' }}</td></tr>
                      <tr><td>Команда, чел.</td><td v-for="(v,i) in vegaFinmodel.headcount" :key="i">{{ v }}</td></tr>
                    </tbody>
                  </table>
                </div>
                <!-- Assumptions -->
                <div class="spw-fm-assumptions">
                  <div class="spw-fm-assump-head">Допущения модели</div>
                  <ul>
                    <li v-for="(a, i) in vegaFinmodel.assumptions" :key="i">{{ a }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Grants -->
        <template v-else-if="activeView === 'grants'">
          <div class="spw-grants-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-money-bill"></i> Подходящие гранты</span>
              <button class="spw-btn spw-btn--primary" @click="runResearch">
                <i class="pi pi-refresh"></i> Обновить
              </button>
            </div>
            <div v-if="research.grants?.grants?.length" class="spw-grants-list">
              <div v-for="g in research.grants.grants" :key="g.name" class="spw-grant-card">
                <div class="spw-grant-name">{{ g.name }}</div>
                <div class="spw-grant-meta">
                  <span>{{ g.provider }}</span>
                  <span class="spw-grant-amount">до {{ g.maxAmount }}</span>
                  <span :class="['spw-grant-fit', `spw-gf--${g.fit}`]">{{ g.fitLabel }}</span>
                </div>
                <div class="spw-grant-rec">{{ g.recommendation }}</div>
              </div>
            </div>
            <div v-else class="spw-doc-placeholder">
              <i class="pi pi-money-bill" style="font-size:48px;opacity:.3"></i>
              <p>Запустите поиск грантов — агент проанализирует все доступные программы</p>
            </div>
          </div>
        </template>

      </div><!-- /spw-main -->

      <!-- ─── RIGHT: Agents + Events ─── -->
      <div class="spw-aside">

        <!-- Active agents for current role -->
        <div class="spw-aside-section">
          <div class="spw-aside-head">Агенты</div>
          <div v-for="a in roleAgents" :key="a.id"
            :class="['spw-agent-card', { active: activeAgent === a.id }]"
            @click="activateAgent(a)">
            <span class="spw-agent-av" :style="{ background: a.color }">{{ a.icon }}</span>
            <div class="spw-agent-info">
              <div class="spw-agent-name">{{ a.name }}</div>
              <div class="spw-agent-role">{{ a.role }}</div>
            </div>
          </div>
        </div>

        <!-- Event feed -->
        <div class="spw-aside-section spw-aside-events">
          <div class="spw-aside-head">
            <span>События</span>
            <span class="spw-ev-count">{{ events.length }}</span>
          </div>
          <div class="spw-events-feed">
            <div v-for="ev in events" :key="ev.id" class="spw-ev-item">
              <div :class="['spw-ev-dot', `spw-ev-dot--${ev.type}`]"></div>
              <div class="spw-ev-body">
                <div class="spw-ev-text">{{ ev.text }}</div>
                <div class="spw-ev-time">{{ ev.time }}</div>
              </div>
            </div>
            <div v-if="!events.length" class="spw-ev-empty">События появятся по мере работы с платформой</div>
          </div>
        </div>

      </div><!-- /spw-aside -->

    </div><!-- /spw-body -->
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FstFinModelBlock from '@/components/finmodel/FstFinModelBlock.vue'
import { buildArtifactTree, logEvent, fetchEvents, syncCompanyTwin } from '@/services/workspaceOntologyService.js'
import { vegaTwin, vegaTermSheet, vegaSmartContract, vegaGostDocs, vegaEvents, vegaFinmodel } from '@/data/vegaDemoData.js'

const router = useRouter()

// ── Текущий пользователь (из auth-системы, устанавливается при логине) ─────────
const currentUserId    = localStorage.getItem('id')   || ''
const currentUserEmail = localStorage.getItem('user') || ''
const OWNER_EMAIL      = 'unidel@yandex.ru'

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const ROLES = [
  { key: 'founder', label: 'Основатель', icon: 'pi pi-user', desc: 'Полный доступ к пространству компании' },
  { key: 'investor', label: 'Инвестор', icon: 'pi pi-briefcase', desc: 'DataRoom и финансовые документы' },
  { key: 'expert', label: 'Эксперт', icon: 'pi pi-star', desc: 'Технический анализ и оценки' },
]

const AGENTS = {
  navigator:   { id: 'navigator',   name: 'Навигатор',     icon: '🤖', color: '#6366f1', role: 'Ведёт через платформу' },
  analyst:     { id: 'analyst',     name: 'Аналитик',      icon: '🔍', color: '#8b5cf6', role: 'Анализирует проект' },
  scorer:      { id: 'scorer',      name: 'Скорер',        icon: '📊', color: '#f59e0b', role: 'Оценивает по 8 критериям' },
  grants:      { id: 'grants',      name: 'Грантовед',     icon: '💰', color: '#10b981', role: 'Ищет гранты и субсидии' },
  finance:     { id: 'finance',     name: 'Финансист',     icon: '💹', color: '#059669', role: 'Финмодель и оценка' },
  legal:       { id: 'legal',       name: 'Юрист',         icon: '⚖️', color: '#64748b', role: 'Договора и IP' },
  risk:        { id: 'risk',        name: 'Риск',          icon: '🛡️', color: '#ef4444', role: 'Управление рисками' },
  critic:      { id: 'critic',      name: 'Критик',        icon: '🔥', color: '#475569', role: 'Стресс-тест идей' },
  techwriter:  { id: 'techwriter',  name: 'Тех. писатель', icon: '📋', color: '#0ea5e9', role: 'ГОСТ документация, ТЗ, TRL' },
}

const ROLE_AGENTS = {
  founder:  ['navigator', 'analyst', 'scorer', 'grants', 'finance', 'legal', 'risk', 'critic', 'techwriter'],
  investor: ['analyst', 'finance', 'risk'],
  expert:   ['analyst', 'scorer', 'critic', 'risk', 'techwriter'],
}

const SCORE_LABELS = {
  technology: 'Технология', market: 'Рынок', team: 'Команда',
  finance: 'Финансы', sovereignty: 'Суверенность', competition: 'Конкуренция',
  ip: 'IP', risk: 'Риски',
}

// Artifacts tree — SIRIN документы + наши
const ARTIFACTS_ALL = [
  {
    key: 'overview', label: 'Обзор', icon: 'pi pi-th-large', roles: ['founder','investor','expert'],
    items: [
      { key: 'dashboard', label: 'Дашборд', icon: 'pi pi-chart-bar', type: 'dashboard', roles: ['founder','investor','expert'] },
      { key: 'grants', label: 'Гранты', icon: 'pi pi-money-bill', type: 'grants', roles: ['founder'] },
    ],
  },
  {
    key: 'dataroom', label: 'DataRoom', icon: 'pi pi-folder-open', roles: ['founder','investor','expert'],
    items: [
      { key: 'doc-nav',      label: 'Навигатор по пакету', icon: 'pi pi-map',              type: 'doc', required: true,
        downloadUrl: 'https://ai2o.ru/download/fst/7ac404839/47442f27815.zip' },
      { key: 'doc-teaser',   label: 'Тизер',               icon: 'pi pi-bolt',             type: 'doc-gost', gostType: 'doc-teaser', roles: ['founder','investor','expert'] },
      { key: 'doc-exec',     label: 'Executive Summary',    icon: 'pi pi-file',             type: 'doc-gost', gostType: 'doc-exec', required: true },
      { key: 'doc-faq',      label: 'FAQ для инвестора',    icon: 'pi pi-question-circle',  type: 'doc-gost', gostType: 'doc-faq' },
      { key: 'doc-nda',      label: 'NDA',                  icon: 'pi pi-lock',             type: 'doc-gost', gostType: 'doc-nda', required: true },
      { key: 'doc-dataroom', label: 'Data Room (полный)',   icon: 'pi pi-database',         type: 'doc' },
      { key: 'doc-letter',   label: 'Письмо инвестору',    icon: 'pi pi-envelope',         type: 'doc' },
    ],
  },
  {
    key: 'finance', label: 'Финансы', icon: 'pi pi-chart-line', roles: ['founder','investor'],
    items: [
      { key: 'finmodel',    label: 'Финансовая модель',  icon: 'pi pi-table',    type: 'finmodel', required: true },
      { key: 'doc-bizplan', label: 'Бизнес-план',        icon: 'pi pi-book',     type: 'doc-gost', gostType: 'doc-bizplan', required: true },
      { key: 'doc-nma',     label: 'Отчёт по НМА',       icon: 'pi pi-star',     type: 'doc' },
      { key: 'doc-founder', label: 'Справка основателя', icon: 'pi pi-id-card',  type: 'doc' },
    ],
  },
  {
    key: 'deal', label: 'Сделка', icon: 'pi pi-handshake', roles: ['founder','investor'],
    items: [
      { key: 'doc-termsheet',  label: 'Term Sheet (фонд)', icon: 'pi pi-file-edit',  type: 'doc', required: true },
      { key: 'doc-ts-own',     label: 'Term Sheet (конструктор)', icon: 'pi pi-file-edit',  type: 'termsheet' },
      { key: 'doc-invest',     label: 'Договор инвестирования', icon: 'pi pi-verified',  type: 'doc', required: true },
      { key: 'doc-corp',       label: 'Корпоративный договор',  icon: 'pi pi-users',     type: 'doc', required: true },
      { key: 'doc-protocol',   label: 'Протокол собрания',      icon: 'pi pi-list',      type: 'doc' },
      { key: 'doc-application',label: 'Заявление о вступлении', icon: 'pi pi-user-plus', type: 'doc', required: true },
      { key: 'doc-spouse',     label: 'Согласие супруга',       icon: 'pi pi-heart',     type: 'doc' },
      { key: 'smart-contract', label: 'Smart Contract сделки',  icon: 'pi pi-verified',  type: 'smart-contract' },
    ],
  },
  {
    key: 'tech', label: 'Тех. документация', icon: 'pi pi-cog', roles: ['founder', 'expert'],
    items: [
      { key: 'doc-tz',      label: 'ТЗ (ГОСТ 34.602)',    icon: 'pi pi-file-edit',  type: 'doc-gost', gostType: 'tz',      required: true },
      { key: 'doc-techdoc', label: 'Описание ПО (ГОСТ)',   icon: 'pi pi-book',       type: 'doc-gost', gostType: 'techdoc' },
      { key: 'doc-trl',     label: 'TRL-паспорт',          icon: 'pi pi-chart-bar',  type: 'doc-gost', gostType: 'trl' },
      { key: 'doc-sysarch', label: 'Архитектура системы',  icon: 'pi pi-sitemap',    type: 'doc-gost', gostType: 'arch' },
    ],
  },
  {
    key: 'ip', label: 'Интеллектуальная собственность', icon: 'pi pi-shield', roles: ['founder','expert'],
    items: [
      { key: 'doc-patent',  label: 'Патентная заявка',   icon: 'pi pi-award',
        url: 'https://ai2fund.ru/patent_application.pdf', type: 'doc', filled: true },
      { key: 'doc-ts-ip',   label: 'Term Sheet (наш)',    icon: 'pi pi-file-edit',
        url: 'https://ai2fund.ru/term_sheet.pdf', type: 'doc', filled: true },
    ],
  },
  {
    key: 'agents', label: 'Агент', icon: 'pi pi-android', roles: ['founder','expert'],
    items: [
      { key: 'agent', label: 'AI-ассистент', icon: 'pi pi-comments', type: 'chat' },
    ],
  },
]

const TS_SECTIONS = [
  {
    key: 'basic', label: 'Основные условия',
    fields: [
      { key: 'companyName',  label: 'Компания',          placeholder: 'SIRIN' },
      { key: 'roundName',    label: 'Раунд',             type: 'select', options: ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Конвертируемый займ'] },
      { key: 'investAmount', label: 'Сумма инвестиций',  placeholder: '60 млн ₽' },
      { key: 'preMoney',     label: 'Pre-money оценка',  placeholder: '200 млн ₽' },
    ],
  },
  {
    key: 'structure', label: 'Структура сделки',
    fields: [
      { key: 'shareClass',      label: 'Класс акций',              type: 'select', options: ['Привилегированные', 'Обыкновенные', 'Конвертируемый займ'] },
      { key: 'liquidationPref', label: 'Ликвидационная преф.',     placeholder: '1x не участвующая' },
      { key: 'antiDilution',    label: 'Анти-dilution',            type: 'select', options: ['Широкая база', 'Узкая база', 'Ratchet', 'Нет'] },
    ],
  },
  {
    key: 'governance', label: 'Управление',
    fields: [
      { key: 'boardSeats',    label: 'Совет директоров', placeholder: '1 фонд / 1 основатель / 1 независимый' },
      { key: 'vestingFounder',label: 'Вестинг основателя', placeholder: '48 мес / 12 мес клифф' },
      { key: 'proRata',       label: 'Pro-rata права',   type: 'select', options: ['Да', 'Нет', 'Ограниченные'] },
      { key: 'dragAlong',     label: 'Drag-along',       placeholder: '70% голосов' },
    ],
  },
  {
    key: 'rights', label: 'Права и обязательства',
    fields: [
      { key: 'informationRights', label: 'Права на информацию', placeholder: 'Ежеквартальная отчётность' },
      { key: 'closingConditions', label: 'Условия закрытия',    placeholder: 'Due diligence, аудит...' },
      { key: 'otherTerms',        label: 'Прочие условия',      placeholder: 'Дополнительные условия...' },
    ],
  },
]

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

const role = ref('founder')
const activeView = ref('dashboard')
const activeItem = ref(null)
const activeAgent = ref('navigator')
const dragging = ref(false)
const thinking = ref(false)
const inputText = ref('')
const finmodelId = ref(null)
const docAiResponse = ref('')
const docValues = ref({})
const companyId = ref(null)          // Integram object ID for this company
const artifactsFromOntology = ref(null)  // loaded from Integram; null = use static

// Tech / GOST documents
const gostDoc = ref({})
const gostGenerating = ref(false)
const gostLoadingStep = ref('')

// Term Sheet constructor
const termSheet = ref({})
const tsGenerating = ref(false)

// Smart Contract
const smartContract = ref(null)
const scGenerating = ref(false)
const showScJson = ref(false)

const twin = ref({
  company: '', stage: 'Pre-Seed', sector: '', trl: 0, mrl: 0,
  teamSize: 0, askRub: 0, marketSize: '', projectedIRR: 0,
  runway: 0, revenue: 0, burnRate: 0, completeness: 0,
  description: '', founder: '', inn: '', website: '',
  contactEmail: currentUserEmail,
})

const scoring = ref({ totalScore: 0, dimensions: {}, verdict: '' })
const beacons = ref([])
const research = ref({ grants: { grants: [] } })
const chatMessages = ref([])
const events = ref([])

// ═══════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════

const visibleArtifacts = computed(() => {
  const source = artifactsFromOntology.value || ARTIFACTS_ALL
  return source
    .filter(s => s.roles.includes(role.value))
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.roles || i.roles.includes(role.value)),
    }))
})

const roleAgents = computed(() =>
  ROLE_AGENTS[role.value].map(id => AGENTS[id])
)

const kpiItems = computed(() => [
  { key: 'completeness', label: 'Готовность', val: twin.value.completeness + '%', color: completenessColor.value },
  { key: 'trl',     label: 'TRL',     val: twin.value.trl ? twin.value.trl + '/9' : '—' },
  { key: 'runway',  label: 'Runway',  val: twin.value.runway ? twin.value.runway + 'м' : '—' },
  { key: 'ask',     label: 'Ask',     val: twin.value.askRub ? (twin.value.askRub / 1e6).toFixed(0) + 'M₽' : '—' },
  { key: 'irr',     label: 'IRR',     val: twin.value.projectedIRR ? twin.value.projectedIRR + '%' : '—' },
])

const completenessColor = computed(() => {
  const c = twin.value.completeness
  if (c >= 80) return 'var(--p-green-500)'
  if (c >= 50) return 'var(--p-orange-400)'
  return 'var(--p-red-400)'
})

const companyMetrics = computed(() => [
  { key: 'founder',  label: 'Основатель',  val: twin.value.founder },
  { key: 'inn',      label: 'ИНН',         val: twin.value.inn },
  { key: 'sector',   label: 'Отрасль',     val: twin.value.sector },
  { key: 'team',     label: 'Команда',     val: twin.value.teamSize ? twin.value.teamSize + ' чел.' : '' },
  { key: 'revenue',  label: 'Выручка',     val: twin.value.revenue ? (twin.value.revenue / 1e6).toFixed(1) + 'M₽' : '0' },
  { key: 'burn',     label: 'Burn Rate',   val: twin.value.burnRate ? (twin.value.burnRate / 1e3).toFixed(0) + 'k₽/мес' : '' },
  { key: 'website',  label: 'Сайт',        val: twin.value.website },
])

const docStatus = computed(() => [
  { key: 'exec',     label: 'ExecSummary',  icon: 'pi pi-file',     status: 'ok' },
  { key: 'bizplan',  label: 'Бизнес-план',  icon: 'pi pi-book',     status: 'ok' },
  { key: 'finmodel', label: 'Финмодель',    icon: 'pi pi-table',    status: 'partial' },
  { key: 'termsheet',label: 'Term Sheet',   icon: 'pi pi-file-edit',status: 'ok' },
  { key: 'patent',   label: 'Патент',       icon: 'pi pi-award',    status: 'ok' },
  { key: 'nda',      label: 'NDA',          icon: 'pi pi-lock',     status: 'ok' },
  { key: 'invest',   label: 'Договор',      icon: 'pi pi-verified', status: 'partial' },
])

const messagesEl = ref(null)
const inputEl = ref(null)

// ═══════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════

function agent(id) { return AGENTS[id] || AGENTS.navigator }

function openView(item) {
  activeView.value = item.key
  activeItem.value = item
  docAiResponse.value = ''
  // Switch to agent if type=chat
  if (item.type === 'chat') {
    activeView.value = 'agent'
  }
  if (item.type === 'finmodel') {
    activeView.value = 'finmodel'
    addEvent('doc', `Открыта финансовая модель VentureOS`)
  }
  if (item.type === 'grants') {
    activeView.value = 'grants'
  }
  if (item.type === 'smart-contract') {
    activeView.value = 'smart-contract'
    addEvent('deal', `Открыт Smart Contract ${smartContract.value?.id || ''}`)
  }
  if (item.type === 'termsheet') {
    addEvent('deal', `Открыт Term Sheet конструктор`)
  }
  if (item.type === 'doc-gost' && gostDoc.value[item.key]) {
    addEvent('doc', `Документ открыт онтодвижком: ${item.label}`)
  }
}

function activateAgent(a) {
  activeAgent.value = a.id
  openView({ key: 'agent', type: 'chat' })
  nextTick(() => {
    if (!chatMessages.value.length) {
      chatMessages.value.push({
        role: 'agent', agent: a.id,
        text: `Привет! Я ${a.name}. ${a.role}. Чем могу помочь по проекту **${twin.value.company}**?`,
      })
    }
  })
}

async function fillDocWithAI(item) {
  openView({ key: 'agent', type: 'chat' })
  const prompt = `Помоги заполнить документ «${item.label}» данными компании ${twin.value.company}:
- Основатель: ${twin.value.founder}
- Отрасль: ${twin.value.sector}
- Стадия: ${twin.value.stage}
- TRL: ${twin.value.trl}
- Запрашиваемые инвестиции: ${(twin.value.askRub/1e6).toFixed(0)} млн ₽
- Описание: ${twin.value.description}

Что нужно заполнить и какие данные запросить у основателя?`
  inputText.value = prompt
  await sendMessage()
  addEvent('doc', `Агент заполняет: ${item.label}`)
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || thinking.value) return
  inputText.value = ''
  autoResize()
  chatMessages.value.push({ role: 'user', text })
  thinking.value = true
  scrollToBottom()

  try {
    const res = await fetch('/api/startuper/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId.value,
        message: text,
        twin: twin.value,
        agentFocus: activeAgent.value,
        context: activeItem.value?.label,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.twin) Object.assign(twin.value, data.twin)
      if (data.scoring) scoring.value = data.scoring
      if (data.beacons) beacons.value = data.beacons
      chatMessages.value.push({
        role: 'agent', agent: data.agent || activeAgent.value,
        text: data.reply, scoreCard: data.scoreCard || null,
      })
      addEvent('agent', 'Агент ответил на запрос')
    }
  } catch (e) {
    // Fallback response
    chatMessages.value.push({
      role: 'agent', agent: activeAgent.value,
      text: `Обрабатываю запрос по **${twin.value.company}**. Для полной работы необходимо подключение к серверу.`,
    })
  } finally {
    thinking.value = false
    scrollToBottom()
    saveLS()
  }
}

const sessionId = ref(null)

async function initSession() {
  try {
    const res = await fetch('/api/startuper/session', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      sessionId.value = data.sessionId
    }
  } catch {}
  if (!sessionId.value) sessionId.value = 'local-' + Date.now()
}

function loadDemo(name) {
  if (name === 'vega') {
    Object.assign(twin.value, vegaTwin)
    Object.assign(termSheet.value, vegaTermSheet)
    gostDoc.value = { ...vegaGostDocs }
    smartContract.value = { ...vegaSmartContract }
    events.value = [...vegaEvents]
    addEvent('info', 'Загружены демо-данные VEGA')
  }
}

function clearSession() {
  chatMessages.value = []
  scoring.value = { totalScore: 0, dimensions: {}, verdict: '' }
  beacons.value = []
  sessionId.value = null
  initSession()
}

function sendToIC() {
  router.push('/fst-committee')
  addEvent('deal', 'Проект направлен в инвесткомитет')
}

async function runResearch() {
  if (!sessionId.value) return
  try {
    const res = await fetch('/api/startuper/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.value, twin: twin.value }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.grants) research.value.grants = data.grants
    }
  } catch {}
}

// ── GOST Tech Docs ──────────────────────────────────────────────────────────────

function gostDescription(type) {
  const DESCS = {
    tz:      'Техническое задание по ГОСТ 34.602-2020 — базовый документ разработки системы',
    techdoc: 'Описание программного обеспечения по ГОСТ 19.402 — функциональность, интерфейсы, API',
    trl:     'TRL-паспорт технологии — уровень готовности TRL 1-9 с доказательной базой и дорожной картой',
    arch:    'Архитектура системы — компоненты, интеграции, технический стек, масштабируемость',
  }
  return DESCS[type] || 'Технический документ по ГОСТ'
}

const GOST_PROMPTS = {
  tz: (tw) => `Создай Техническое задание по ГОСТ 34.602 для системы "${tw.company}".
Описание: ${tw.description}
Отрасль: ${tw.sector}, TRL: ${tw.trl}, Стадия: ${tw.stage}

Структура ТЗ (ГОСТ 34.602):
1. Общие сведения (наименование, шифр, исполнитель, заказчик, плановые сроки, порядок оформления)
2. Назначение и цели создания (назначение системы, цели создания и развития)
3. Характеристика объектов автоматизации (описание бизнес-процессов, условия эксплуатации)
4. Требования к системе:
   4.1 Требования к структуре и функционированию
   4.2 Требования к надёжности
   4.3 Требования к безопасности
   4.4 Требования к эргономике и технической эстетике
   4.5 Требования к защите информации от несанкционированного доступа
   4.6 Требования к патентной чистоте
5. Требования к функциям (задачам) подсистем
6. Требования к видам обеспечения (программное, информационное, техническое, организационное)
7. Состав и содержание работ по созданию системы (этапы, сроки, исполнители)
8. Порядок контроля и приёмки системы (виды, состав, методы испытаний)
9. Требования к документированию

Пиши профессионально, конкретно, с реальными данными для ${tw.company}. Используй заголовки ## и ###, списки.`,

  techdoc: (tw) => `Напиши описание программного обеспечения по ГОСТ 19.402 для "${tw.company}".
Описание: ${tw.description}
TRL: ${tw.trl}, Отрасль: ${tw.sector}

Разделы по ГОСТ 19.402:
## 1. Общие сведения
(наименование, обозначение, назначение, функциональные возможности)

## 2. Функциональное назначение
(перечень реализованных функций, ограничения применения)

## 3. Описание алгоритмов и функционирования
(основные алгоритмы, логика работы, AI-компоненты)

## 4. Используемые технические средства
(серверная инфраструктура, требования к оборудованию)

## 5. Вызов и загрузка
(способы запуска, процедура установки, настройка)

## 6. Входные данные
(форматы, источники, валидация)

## 7. Выходные данные
(форматы ответов, отчёты, уведомления)

## 8. Интерфейсы и API
(REST API, WebSocket, интеграции)

Пиши конкретно для ${tw.company}. Используй таблицы для API-методов где уместно.`,

  trl: (tw) => `Сформируй TRL-паспорт для технологии "${tw.company}".
Описание: ${tw.description}
Текущий TRL: ${tw.trl || 5}, Отрасль: ${tw.sector}

Структура TRL-паспорта:
## Описание технологии
## Текущий уровень TRL ${tw.trl || 5}/9 и обоснование
(что конкретно сделано, какие испытания пройдены, артефакты)

## Доказательная база текущего TRL
(прототипы, испытания, патенты, публикации, контракты)

## Ключевые риски и ограничения

## Требования для достижения TRL ${Math.min((tw.trl || 5) + 1, 9)}
(что нужно сделать, какие ресурсы, сроки)

## Дорожная карта TRL (таблица)
| TRL | Описание | Статус | Срок |
|-----|----------|--------|------|
(заполни для TRL 1-9, текущий отметь как "✓ Достигнут")

## Применимые стандарты и ГОСТы`,

  arch: (tw) => `Опиши архитектуру системы "${tw.company}".
Описание: ${tw.description}
TRL: ${tw.trl}, Отрасль: ${tw.sector}

## Обзор архитектуры
(тип архитектуры: монолит / микросервисы / serverless, обоснование)

## Компоненты системы
(перечень модулей с описанием ответственности)

## Технический стек
(frontend, backend, база данных, AI-модели, инфраструктура)

## Интеграции и внешние API
(что подключено, протоколы, форматы)

## Безопасность и защита данных
(аутентификация, авторизация, шифрование, соответствие требованиям)

## Масштабируемость и отказоустойчивость
(горизонтальное масштабирование, резервирование)

## CI/CD и DevOps
(сборка, тестирование, деплой, мониторинг)

Используй таблицы для компонентов и стека.`,
}

async function generateGostDoc(item) {
  gostGenerating.value = true
  gostLoadingStep.value = 'Анализирую данные проекта...'

  const STEPS = [
    'Анализирую данные проекта...',
    'Структурирую по ГОСТ...',
    'AI генерирует разделы...',
    'Форматирую документ...',
  ]
  let stepIdx = 0
  const stepTimer = setInterval(() => {
    if (stepIdx < STEPS.length - 1) gostLoadingStep.value = STEPS[++stepIdx]
  }, 2000)

  try {
    const promptFn = GOST_PROMPTS[item.gostType]
    const prompt = promptFn ? promptFn(twin.value) : `Напиши технический документ "${item.label}" для "${twin.value.company}": ${twin.value.description}`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        prompt,
        systemPrompt: 'Ты — технический писатель. Пиши по-русски, профессионально, с конкретными данными. Используй markdown: ## заголовки, таблицы, списки. Минимум воды, максимум конкретики.',
        application: 'GostDocGenerator',
      }),
    })
    const { response } = await res.json()
    gostDoc.value = { ...gostDoc.value, [item.key]: response }
    addEvent('doc', `Сгенерирован: ${item.label}`)
    // Mark as filled
    for (const sec of ARTIFACTS_ALL) {
      const itm = sec.items?.find(i => i.key === item.key)
      if (itm) { itm.filled = true; break }
    }
  } catch (e) {
    gostDoc.value = { ...gostDoc.value, [item.key]: `# ${item.label}\n\nОшибка генерации: ${e.message}` }
  } finally {
    clearInterval(stepTimer)
    gostGenerating.value = false
    gostLoadingStep.value = ''
  }
}

function copyGostDoc(key) {
  const text = gostDoc.value[key] || ''
  navigator.clipboard?.writeText(text)
}

// ── Term Sheet Constructor ───────────────────────────────────────────────────────

async function generateTermSheet() {
  tsGenerating.value = true
  try {
    const prompt = `Заполни Term Sheet для инвестиционной сделки с компанией "${twin.value.company}".
Данные: стадия ${twin.value.stage}, отрасль ${twin.value.sector}, TRL ${twin.value.trl}, инвестиции ${(twin.value.askRub/1e6).toFixed(0)} млн ₽.
Описание: ${twin.value.description}

Верни ТОЛЬКО JSON (без markdown):
{"companyName":"...","roundName":"...","investAmount":"...","preMoney":"...","shareClass":"...","liquidationPref":"...","antiDilution":"...","vestingFounder":"...","boardSeats":"...","proRata":"...","dragAlong":"...","informationRights":"...","closingConditions":"...","otherTerms":"..."}`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt,
        systemPrompt: 'Ты — венчурный юрист. Отвечай только JSON без markdown.',
        application: 'TermSheetConstructor',
      }),
    })
    const { response } = await res.json()
    const m = response.match(/\{[\s\S]*\}/)
    if (m) {
      Object.assign(termSheet.value, JSON.parse(m[0]))
      addEvent('deal', 'Term Sheet заполнен AI')
    }
  } catch (e) {
    console.error('[TermSheet.generate]', e)
  } finally {
    tsGenerating.value = false
  }
}

function renderTermSheet() {
  const ts = termSheet.value
  if (!ts.investAmount) return '<p style="color:var(--p-text-muted-color);text-align:center;padding:32px">Заполните форму или нажмите «AI заполнить»</p>'
  const row = (label, val) => val ? `<tr><td class="tsp-l">${label}</td><td class="tsp-v">${val}</td></tr>` : ''
  return `
<div class="ts-preview-doc">
  <div class="ts-preview-title">TERM SHEET</div>
  <div class="ts-preview-sub">${ts.companyName || '___'} · Раунд ${ts.roundName || '___'} · ${new Date().toLocaleDateString('ru')}</div>
  <table class="ts-preview-table">
    ${row('Сумма инвестиций', ts.investAmount)}
    ${row('Pre-money оценка', ts.preMoney)}
    ${row('Класс акций', ts.shareClass)}
    ${row('Ликвидационная преф.', ts.liquidationPref)}
    ${row('Анти-dilution', ts.antiDilution)}
    ${row('Вестинг основателя', ts.vestingFounder)}
    ${row('Совет директоров', ts.boardSeats)}
    ${row('Pro-rata права', ts.proRata)}
    ${row('Drag-along', ts.dragAlong)}
    ${row('Права на информацию', ts.informationRights)}
    ${row('Условия закрытия', ts.closingConditions)}
    ${row('Прочие условия', ts.otherTerms)}
  </table>
  <div class="ts-preview-footer">Конфиденциально · Не является офертой · Для обсуждения</div>
</div>`
}

// ── Smart Contract ───────────────────────────────────────────────────────────────

async function generateSmartContract() {
  scGenerating.value = true
  showScJson.value = false
  try {
    const ts = termSheet.value
    const prompt = `Сформируй смарт-контракт инвестиционной сделки в JSON.

Данные сделки:
- Компания: ${twin.value.company}
- Основатель: ${twin.value.founder}
- Раунд: ${ts.roundName || twin.value.stage}
- Инвестиции: ${ts.investAmount || (twin.value.askRub/1e6).toFixed(0) + ' млн ₽'}
- Pre-money оценка: ${ts.preMoney || 'не определена'}
- Класс акций: ${ts.shareClass || 'Привилегированные'}
- Ликвидационная преф.: ${ts.liquidationPref || '1x'}
- Вестинг: ${ts.vestingFounder || '48 мес'}
- TRL: ${twin.value.trl}
- Описание: ${twin.value.description}
- AI-оценка проекта: ${scoring.value.totalScore || 'не сформирована'}/100

Верни ТОЛЬКО JSON смарт-контракта:
{
  "id": "SC-2025-001",
  "timestamp": "ISO-дата",
  "status": "PENDING_IC",
  "parties": [{"role":"Инвестор","name":"ФСТ НТИ"},{"role":"Эмитент","name":"..."},{"role":"Основатель","name":"..."}],
  "terms": [{"key":"round","label":"Раунд","value":"..."},{"key":"amount","label":"Сумма","value":"..."},{"key":"preMoney","label":"Pre-money","value":"..."},{"key":"equity","label":"Доля фонда","value":"...%"},{"key":"shareClass","label":"Класс акций","value":"..."},{"key":"liquidation","label":"Ликвидационная преф.","value":"..."},{"key":"vesting","label":"Вестинг","value":"..."},{"key":"board","label":"Совет директоров","value":"..."}],
  "milestones": [{"title":"Транш 1 — Закрытие сделки","condition":"Подписание всех документов, прохождение KYC","amount":"..."},{"title":"Транш 2 — Достижение KPI","condition":"Выполнение ключевых метрик Q2 2025","amount":"..."},{"title":"Транш 3 — TRL-апгрейд","condition":"Подтверждение TRL ${(twin.value.trl||5)+1} независимой экспертизой","amount":"..."}],
  "conditions": ["Due diligence завершён без критичных замечаний","Аудит IP подтверждён","Основатели подписали vesting-соглашение"],
  "icDecision": null
}`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        prompt,
        systemPrompt: 'Ты — юрист венчурного фонда ФСТ НТИ. Формируй структурированные смарт-контракты. Отвечай только JSON без markdown.',
        application: 'SmartContractGenerator',
      }),
    })
    const { response } = await res.json()
    const m = response.match(/\{[\s\S]*\}/)
    if (m) {
      smartContract.value = JSON.parse(m[0])
      addEvent('deal', `Smart Contract сформирован: ${smartContract.value.id}`)
    }
  } catch (e) {
    console.error('[SmartContract.generate]', e)
  } finally {
    scGenerating.value = false
  }
}

async function createFinmodel() {
  openView({ key: 'agent', type: 'chat' })
  inputText.value = `Создай финансовую модель для компании ${twin.value.company}:
- Запрашиваемые инвестиции: ${(twin.value.askRub/1e6).toFixed(0)} млн ₽
- Выручка Y1: целевая, Y5: с учётом роста рынка ${twin.value.marketSize}
- Burn rate: ${(twin.value.burnRate/1e3).toFixed(0)}k₽/мес, Runway: ${twin.value.runway} мес.
- Целевой IRR: ${twin.value.projectedIRR}%`
  await sendMessage()
}

// Files
async function onFileInput(e) { await handleFiles([...e.target.files]) }
async function onDrop(e) { dragging.value = false; await handleFiles([...e.dataTransfer.files]) }
async function onPaste(e) {
  const items = [...(e.clipboardData?.items || [])]
  const imageItem = items.find(i => i.type.startsWith('image/'))
  if (imageItem) {
    const blob = imageItem.getAsFile()
    await handleFiles([blob])
  }
}

async function handleFiles(files) {
  for (const file of files) {
    openView({ key: 'agent', type: 'chat' })
    if (file.type.startsWith('image/')) {
      const dataUrl = await readAsDataUrl(file)
      chatMessages.value.push({ role: 'user', isImage: true, dataUrl, text: '' })
    } else {
      chatMessages.value.push({ role: 'user', file: file.name, text: '' })
    }
    thinking.value = true
    scrollToBottom()
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (sessionId.value) fd.append('sessionId', sessionId.value)
      const res = await fetch('/api/startuper/parse', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        if (data.twin) Object.assign(twin.value, data.twin)
        if (data.reply) chatMessages.value.push({ role: 'agent', agent: 'analyst', text: data.reply })
      }
    } catch (err) {
      chatMessages.value.push({ role: 'agent', agent: 'analyst', text: `Файл **${file.name}** получен. Анализирую...` })
    } finally {
      thinking.value = false
      scrollToBottom()
      saveLS()
    }
  }
}

function readAsDataUrl(blob) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(blob) })
}

// Helpers
function scrollToBottom() {
  nextTick(() => { if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight })
}
function autoResize() {
  nextTick(() => {
    if (inputEl.value) { inputEl.value.style.height = 'auto'; inputEl.value.style.height = inputEl.value.scrollHeight + 'px' }
  })
}
function addEvent(type, text, data = {}) {
  events.value.unshift({ id: Date.now(), type, text, time: new Date().toLocaleTimeString('ru') })
  logEvent({ type, entityType: 'company', entityId: companyId.value || '', text, data })
}
function scoreColor(s) { return s >= 8 ? 'var(--p-green-500)' : s >= 6 ? 'var(--p-orange-400)' : 'var(--p-red-400)' }
function scoreClass(s) { return s >= 70 ? 'good' : s >= 50 ? 'mid' : 'low' }
function md(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

// Persistence — ключ изолирован по userId: каждый пользователь видит только свои данные
const LS_KEY = `spw_v3_${currentUserId || 'anon'}`
function saveLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      twin: twin.value,
      scoring: scoring.value,
      events: events.value.slice(0, 30),
      companyId: companyId.value,
      gostDoc: gostDoc.value,
      termSheet: termSheet.value,
      smartContract: smartContract.value,
    }))
  } catch {}
}
function loadLS() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    if (d.twin?.company) {
      Object.assign(twin.value, d.twin)
      if (d.scoring) scoring.value = d.scoring
      if (d.events?.length) events.value = d.events
      if (d.companyId) companyId.value = d.companyId
      if (d.gostDoc && Object.keys(d.gostDoc).length) gostDoc.value = d.gostDoc
      if (d.termSheet && Object.keys(d.termSheet).length) termSheet.value = d.termSheet
      if (d.smartContract) smartContract.value = d.smartContract
      return true
    }
  } catch {}
  return false
}

watch([twin, scoring, gostDoc, termSheet, smartContract], saveLS, { deep: true })

onMounted(async () => {
  // ── Auth guard ──────────────────────────────────────────────────
  if (!localStorage.getItem('token')) {
    router.push('/login?redirect=/fst-startuper')
    return
  }

  const hasData = loadLS()

  // Автозагрузка данных VentureOS для владельца при первом заходе
  if (!hasData && currentUserEmail === OWNER_EMAIL) {
    Object.assign(twin.value, vegaTwin)
    termSheet.value = { ...vegaTermSheet }
    gostDoc.value = { ...vegaGostDocs }
    smartContract.value = { ...vegaSmartContract }
    events.value = [...vegaEvents]
    addEvent('info', `Рабочее пространство VentureOS загружено для ${currentUserEmail}`)
    saveLS()
  }

  initSession()

  // Try loading artifact tree from Integram ontology
  const tree = await buildArtifactTree()
  if (tree) artifactsFromOntology.value = tree

  // Load past events for this company from EventLog
  if (companyId.value) {
    const past = await fetchEvents(companyId.value, 20)
    if (past.length) {
      const mapped = past.map(e => ({
        id: e.id,
        type: e.type,
        text: e.text || `${e.entityType}:${e.type}`,
        time: e.ts ? new Date(e.ts).toLocaleTimeString('ru') : '',
      }))
      events.value = [...mapped, ...events.value].slice(0, 50)
    }
  }
})
</script>

<style scoped>
/* ══ Root ══ */
.spw {
  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
  background: var(--p-surface-ground);
  font-family: var(--p-font-family, system-ui);
}

/* ══ Topbar ══ */
.spw-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; gap: 16px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0; z-index: 10;
}
.spw-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.spw-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.spw-topbar-sep { width: 1px; height: 20px; background: var(--p-content-border-color); }
.spw-user-chip {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--p-text-muted-color);
  padding: 4px 10px; border-radius: 20px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.spw-co-name { font-size: 15px; font-weight: 700; color: var(--p-text-color); white-space: nowrap; }

.spw-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 20px;
  font-weight: 600; white-space: nowrap;
}
.spw-badge--blue { background: var(--p-blue-100); color: var(--p-blue-700); }
.spw-badge--purple { background: var(--p-purple-100); color: var(--p-purple-700); }

.spw-kpi-strip { display: flex; gap: 16px; margin-left: 8px; }
.spw-kpi { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.spw-kpi-val { font-size: 14px; font-weight: 700; line-height: 1; }
.spw-kpi-label { font-size: 10px; color: var(--p-text-muted-color); white-space: nowrap; }

/* Role tabs */
.spw-roles { display: flex; gap: 2px; background: var(--p-surface-ground); border-radius: 8px; padding: 3px; }
.spw-role-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border: none; cursor: pointer; border-radius: 6px;
  background: transparent; color: var(--p-text-muted-color);
  font-size: 12px; font-weight: 500; transition: all .15s;
}
.spw-role-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.spw-role-btn.active { background: var(--p-surface-card); color: var(--p-primary-color); font-weight: 600; }

/* ══ Body ══ */
.spw-body {
  display: grid;
  grid-template-columns: 220px 1fr 260px;
  flex: 1; overflow: hidden;
}

/* ══ Nav sidebar ══ */
.spw-nav {
  background: var(--p-surface-card);
  border-right: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 8px 0;
}
.spw-nav-section { margin-bottom: 4px; }
.spw-nav-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px 4px;
  font-size: 11px; font-weight: 700; letter-spacing: .4px;
  color: var(--p-text-muted-color); text-transform: uppercase;
}
.spw-nav-item {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 14px 6px 20px;
  font-size: 12.5px; cursor: pointer; color: var(--p-text-color);
  transition: background .1s; position: relative;
}
.spw-nav-item:hover { background: var(--p-surface-hover); }
.spw-nav-item.active {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: var(--p-primary-color); font-weight: 600;
}
.spw-nav-dot {
  width: 7px; height: 7px; border-radius: 50%; margin-left: auto; flex-shrink: 0;
}
.spw-nav-dot--ok { background: var(--p-green-500); }
.spw-nav-dot--empty { background: var(--p-orange-400); }

/* ══ Main ══ */
.spw-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* Dashboard */
.spw-dash { padding: 20px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; gap: 16px; }
.spw-dash-row { display: flex; gap: 16px; }
.spw-card {
  background: var(--p-surface-card); border-radius: 10px;
  border: 1px solid var(--p-content-border-color);
  padding: 16px; flex: 1;
}
.spw-card--wide { flex: 2; }
.spw-card--start { border: 2px dashed var(--p-content-border-color); text-align: center; }
.spw-card-head { font-size: 12px; font-weight: 700; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }

.spw-complete-bar { height: 8px; background: var(--p-surface-ground); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.spw-complete-fill { height: 100%; border-radius: 4px; transition: width .4s; }
.spw-complete-label { font-size: 12px; color: var(--p-text-muted-color); margin-bottom: 12px; }

.spw-doc-status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
.spw-ds {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 8px; border-radius: 6px; font-size: 11px;
}
.spw-ds--ok { background: color-mix(in srgb, var(--p-green-500) 12%, transparent); color: var(--p-green-600); }
.spw-ds--partial { background: color-mix(in srgb, var(--p-orange-400) 12%, transparent); color: var(--p-orange-600); }
.spw-ds--empty { background: var(--p-surface-ground); color: var(--p-text-muted-color); }

.spw-metric-list { display: flex; flex-direction: column; gap: 6px; }
.spw-ml-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.spw-ml-label { color: var(--p-text-muted-color); }
.spw-ml-val { font-weight: 600; }

.spw-score-grid { display: flex; flex-direction: column; gap: 6px; }
.spw-score-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.spw-score-label { width: 110px; color: var(--p-text-muted-color); }
.spw-score-track { flex: 1; height: 6px; background: var(--p-surface-ground); border-radius: 3px; overflow: hidden; }
.spw-score-track div { height: 100%; border-radius: 3px; transition: width .4s; }
.spw-score-num { width: 20px; text-align: right; font-size: 12px; }

.spw-beacon { padding: 6px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 4px; }
.spw-beacon--warn { background: color-mix(in srgb, var(--p-orange-400) 12%, transparent); color: var(--p-orange-700); }
.spw-beacon--error { background: color-mix(in srgb, var(--p-red-400) 12%, transparent); color: var(--p-red-700); }
.spw-beacon--info { background: color-mix(in srgb, var(--p-blue-500) 10%, transparent); color: var(--p-blue-700); }

.spw-start-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
.spw-demo-btn {
  background: none; border: none; cursor: pointer; color: var(--p-primary-color);
  font-size: 12px; padding: 4px 8px; border-radius: 4px;
}
.spw-demo-btn:hover { background: var(--p-surface-hover); }

/* Chat */
.spw-chat-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.spw-divider { text-align: center; font-size: 11px; color: var(--p-text-muted-color); padding: 4px 0; }
.spw-msg { display: flex; gap: 8px; max-width: 85%; }
.spw-msg--user { flex-direction: row-reverse; align-self: flex-end; }
.spw-msg--agent { align-self: flex-start; }
.spw-msg-av {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.spw-msg-av--user { background: var(--p-primary-color); color: #fff; }
.spw-msg-body { display: flex; flex-direction: column; gap: 4px; }
.spw-msg-agent-name { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
.spw-msg-text {
  font-size: 13px; line-height: 1.5;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  padding: 8px 12px; border-radius: 10px;
}
.spw-msg--user .spw-msg-text {
  background: var(--p-primary-color); color: #fff; border-color: transparent;
}
.spw-msg-img { max-width: 200px; border-radius: 8px; }
.spw-msg-file { font-size: 12px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; }
.spw-typing { display: flex; gap: 4px; padding: 8px 12px; background: var(--p-surface-card); border-radius: 10px; width: fit-content; }
.spw-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--p-text-muted-color); animation: bounce .8s infinite; }
.spw-typing span:nth-child(2) { animation-delay: .15s; }
.spw-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

.spw-score-card { background: var(--p-surface-ground); border-radius: 8px; padding: 10px; margin-top: 6px; }
.spw-sc-total { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
.spw-sc-total span { font-size: 13px; font-weight: 400; color: var(--p-text-muted-color); }
.spw-sc-total.good { color: var(--p-green-500); }
.spw-sc-total.mid { color: var(--p-orange-400); }
.spw-sc-total.low { color: var(--p-red-400); }
.spw-sc-bars { display: flex; flex-direction: column; gap: 5px; }
.spw-sc-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.spw-sc-row span { width: 90px; color: var(--p-text-muted-color); }
.spw-sc-track { flex: 1; height: 5px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.spw-sc-track div { height: 100%; border-radius: 3px; }

.spw-event-pill {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.spw-ep--info { background: var(--p-blue-100); color: var(--p-blue-700); }
.spw-ep--ok   { background: var(--p-green-100); color: var(--p-green-700); }
.spw-ep--warn { background: var(--p-orange-100); color: var(--p-orange-700); }

.spw-input-bar {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 16px; border-top: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}
.spw-attach-btn {
  padding: 8px; cursor: pointer; color: var(--p-text-muted-color);
  border-radius: 6px; transition: all .15s;
}
.spw-attach-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.spw-input {
  flex: 1; border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 8px 12px; font-size: 13px; resize: none; overflow: hidden;
  background: var(--p-surface-ground); color: var(--p-text-color);
  max-height: 120px; line-height: 1.5; outline: none; font-family: inherit;
}
.spw-input:focus { border-color: var(--p-primary-color); }
.spw-send-btn {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: var(--p-surface-hover); color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all .15s;
}
.spw-send-btn.active { background: var(--p-primary-color); color: #fff; }

/* Document view */
.spw-doc-view { display: flex; flex-direction: column; height: 100%; }
.spw-doc-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card); flex-shrink: 0;
}
.spw-doc-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex: 1; }
.spw-doc-actions { display: flex; gap: 6px; }
.spw-doc-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.spw-doc-iframe { flex: 1; border: none; width: 100%; min-height: 500px; }
.spw-doc-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  text-align: center; padding: 40px; color: var(--p-text-muted-color);
}
.spw-doc-placeholder h3 { margin: 0; font-size: 16px; color: var(--p-text-color); }
.spw-doc-placeholder p { margin: 0; font-size: 13px; line-height: 1.6; }
.spw-doc-fields { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.spw-doc-field { display: flex; flex-direction: column; gap: 4px; text-align: left; }
.spw-doc-field label { font-size: 11px; color: var(--p-text-muted-color); }
.spw-field-input {
  border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 6px 10px; font-size: 13px; background: var(--p-surface-ground); color: var(--p-text-color);
}
.spw-doc-ai-resp {
  padding: 16px; margin: 12px; border-radius: 8px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  font-size: 13px; line-height: 1.6;
}

/* FinModel */
.spw-finmodel-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-finmodel-body { flex: 1; overflow: auto; }

/* Grants */
.spw-grants-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-grants-list { padding: 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.spw-grant-card {
  background: var(--p-surface-card); border-radius: 8px;
  border: 1px solid var(--p-content-border-color); padding: 12px;
}
.spw-grant-name { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
.spw-grant-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 6px; }
.spw-grant-amount { font-weight: 700; color: var(--p-green-600); }
.spw-grant-fit { padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.spw-gf--high { background: var(--p-green-100); color: var(--p-green-700); }
.spw-gf--mid  { background: var(--p-orange-100); color: var(--p-orange-700); }
.spw-gf--low  { background: var(--p-surface-ground); color: var(--p-text-muted-color); }
.spw-grant-rec { font-size: 12px; color: var(--p-text-muted-color); }

/* ══ Aside ══ */
.spw-aside {
  background: var(--p-surface-card);
  border-left: 1px solid var(--p-content-border-color);
  display: flex; flex-direction: column; overflow: hidden;
}
.spw-aside-section { display: flex; flex-direction: column; border-bottom: 1px solid var(--p-content-border-color); }
.spw-aside-head {
  padding: 10px 14px; font-size: 11px; font-weight: 700;
  color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: .4px;
  display: flex; align-items: center; justify-content: space-between;
}
.spw-ev-count { background: var(--p-primary-color); color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 10px; }

.spw-agent-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer; transition: background .1s;
}
.spw-agent-card:hover { background: var(--p-surface-hover); }
.spw-agent-card.active { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.spw-agent-av { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.spw-agent-name { font-size: 12px; font-weight: 600; }
.spw-agent-role { font-size: 11px; color: var(--p-text-muted-color); }

.spw-aside-events { flex: 1; overflow: hidden; min-height: 0; }
.spw-events-feed { overflow-y: auto; flex: 1; padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; height: calc(100% - 36px); }
.spw-ev-item { display: flex; gap: 8px; align-items: flex-start; }
.spw-ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.spw-ev-dot--info  { background: var(--p-blue-500); }
.spw-ev-dot--doc   { background: var(--p-purple-500); }
.spw-ev-dot--deal  { background: var(--p-green-500); }
.spw-ev-dot--ip    { background: var(--p-orange-400); }
.spw-ev-dot--agent { background: var(--p-primary-color); }
.spw-ev-text { font-size: 12px; line-height: 1.4; }
.spw-ev-time { font-size: 10px; color: var(--p-text-muted-color); }
.spw-ev-empty { font-size: 12px; color: var(--p-text-muted-color); text-align: center; padding: 16px 0; }

/* ══ Buttons ══ */
.spw-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 12px; font-weight: 500; transition: all .15s; text-decoration: none;
}
.spw-btn--primary { background: var(--p-primary-color); color: #fff; }
.spw-btn--primary:hover { opacity: .85; }
.spw-btn--outline { background: transparent; border: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.spw-btn--outline:hover { background: var(--p-surface-hover); }
.spw-btn--ghost { background: transparent; color: var(--p-text-muted-color); }
.spw-btn--ghost:hover { background: var(--p-surface-hover); color: var(--p-text-color); }

/* Drag overlay */
.spw-drag-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.spw-drag-box {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  background: var(--p-surface-card); border-radius: 16px; padding: 40px 60px;
  border: 2px dashed var(--p-primary-color); font-size: 16px; font-weight: 600;
}
.spw-drag-box i { font-size: 36px; color: var(--p-primary-color); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ══ GOST Tech Docs ══ */
.spw-gost-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-gost-body { flex: 1; overflow-y: auto; }
.spw-gost-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; height: 240px; color: var(--p-text-muted-color);
}
.spw-gost-pre {
  white-space: pre-wrap; word-break: break-word; font-family: inherit;
  font-size: 13px; line-height: 1.75; margin: 0;
  padding: 24px 28px; color: var(--p-text-color);
  max-width: 820px;
}

/* ══ Term Sheet Constructor ══ */
.spw-ts-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-ts-body { flex: 1; display: grid; grid-template-columns: 340px 1fr; overflow: hidden; }
.spw-ts-form {
  overflow-y: auto; padding: 16px 14px;
  border-right: 1px solid var(--p-content-border-color);
  display: flex; flex-direction: column; gap: 18px;
}
.spw-ts-section { display: flex; flex-direction: column; gap: 10px; }
.spw-ts-sec-head {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--p-text-muted-color);
  padding-bottom: 4px; border-bottom: 1px solid var(--p-content-border-color);
}
.spw-ts-field { display: flex; flex-direction: column; gap: 3px; }
.spw-ts-field label { font-size: 11px; color: var(--p-text-muted-color); }
.spw-ts-preview { overflow-y: auto; padding: 20px; background: var(--p-surface-ground); }
.spw-ts-preview-head {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--p-text-muted-color); margin-bottom: 14px;
}

/* Term Sheet preview doc (v-html injected) */
:deep(.ts-preview-doc) {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 24px;
}
:deep(.ts-preview-title) {
  font-size: 18px; font-weight: 800; letter-spacing: .5px; text-align: center;
  color: var(--p-text-color); margin-bottom: 4px;
}
:deep(.ts-preview-sub) {
  font-size: 12px; color: var(--p-text-muted-color); text-align: center; margin-bottom: 20px;
}
:deep(.ts-preview-table) { width: 100%; border-collapse: collapse; font-size: 13px; }
:deep(.tsp-l) {
  padding: 7px 10px; color: var(--p-text-muted-color); width: 46%;
  border-bottom: 1px solid var(--p-content-border-color);
}
:deep(.tsp-v) {
  padding: 7px 10px; font-weight: 600; color: var(--p-text-color);
  border-bottom: 1px solid var(--p-content-border-color);
}
:deep(.ts-preview-footer) {
  font-size: 10px; color: var(--p-text-muted-color); text-align: center;
  margin-top: 20px; font-style: italic;
}

/* ══ Smart Contract ══ */
.spw-sc-wrap { display: flex; flex-direction: column; height: 100%; }
.spw-sc-body { flex: 1; overflow-y: auto; }
.spw-sc-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; max-width: 860px; }
.spw-sc-header-card {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 12px 16px;
}
.spw-sc-status {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px;
}
.sc-approved { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.sc-pending  { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.spw-sc-id { font-size: 13px; font-weight: 600; color: var(--p-text-color); font-family: monospace; }
.spw-sc-ts { font-size: 11px; color: var(--p-text-muted-color); margin-left: auto; }
.spw-sc-section {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 12px 16px;
}
.spw-sc-sec-title {
  font-size: 11px; font-weight: 700; color: var(--p-text-muted-color);
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 10px;
  display: flex; align-items: center; gap: 6px;
}
.spw-sc-party {
  display: flex; gap: 12px; padding: 7px 0;
  border-bottom: 1px solid var(--p-content-border-color); font-size: 13px;
}
.spw-sc-party:last-child { border-bottom: none; }
.spw-sc-party-role { color: var(--p-text-muted-color); width: 100px; flex-shrink: 0; }
.spw-sc-party-name { font-weight: 600; }
.spw-sc-terms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.spw-sc-term { background: var(--p-surface-ground); border-radius: 6px; padding: 8px 10px; }
.spw-sc-term-label { display: block; font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 2px; }
.spw-sc-term-value { font-size: 13px; font-weight: 600; color: var(--p-text-color); }
.spw-sc-milestone {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid var(--p-content-border-color);
}
.spw-sc-milestone:last-child { border-bottom: none; }
.spw-sc-ms-num {
  width: 22px; height: 22px; border-radius: 50%; background: var(--p-primary-color);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px;
}
.spw-sc-ms-body { flex: 1; }
.spw-sc-ms-title { font-size: 13px; font-weight: 600; color: var(--p-text-color); }
.spw-sc-ms-cond { font-size: 12px; color: var(--p-text-muted-color); margin-top: 2px; }
.spw-sc-ms-amount { font-size: 13px; font-weight: 700; color: var(--fst-green); flex-shrink: 0; }
.spw-sc-ic-decision { font-size: 13px; line-height: 1.6; color: var(--p-text-color); }
.spw-sc-json-toggle {
  font-size: 12px; color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; gap: 5px; padding: 4px 0;
}
.spw-sc-json-toggle:hover { color: var(--p-text-color); }
.spw-sc-json {
  font-size: 11px; background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
  padding: 12px 14px; overflow-x: auto; max-height: 320px; font-family: monospace; line-height: 1.5;
}

/* ── Finmodel Static ── */
.spw-fm-static { display: flex; flex-direction: column; gap: 16px; padding: 16px; height: 100%; overflow-y: auto; }
.spw-fm-scenarios { display: flex; gap: 12px; }
.spw-fm-scenario {
  flex: 1; border-radius: 8px; padding: 12px 14px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-ground);
}
.spw-fm-sc--base { border-color: var(--fst-blue); }
.spw-fm-sc--optimistic { border-color: var(--fst-green); }
.spw-fm-sc--pessimistic { border-color: var(--fst-brand); }
.spw-fm-sc-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--p-text-muted-color); margin-bottom: 8px; }
.spw-fm-sc-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
.spw-fm-sc-row strong { font-size: 14px; font-weight: 700; color: var(--p-text-color); }
.spw-fm-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--p-content-border-color); }
.spw-fm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.spw-fm-table th {
  background: var(--p-surface-ground); padding: 8px 10px; text-align: right; font-weight: 600;
  border-bottom: 1px solid var(--p-content-border-color); white-space: nowrap; color: var(--p-text-muted-color);
}
.spw-fm-table th:first-child { text-align: left; }
.spw-fm-table td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--p-content-border-color); }
.spw-fm-table td:first-child { text-align: left; color: var(--p-text-muted-color); white-space: nowrap; }
.spw-fm-table tr:last-child td { border-bottom: none; }
.spw-fm-highlight td:first-child { color: var(--p-text-color); font-weight: 600; }
.spw-fm-assumptions { background: var(--p-surface-ground); border-radius: 8px; padding: 12px 16px; }
.spw-fm-assump-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--p-text-muted-color); margin-bottom: 8px; }
.spw-fm-assumptions ul { margin: 0; padding-left: 16px; }
.spw-fm-assumptions li { font-size: 12px; line-height: 1.6; color: var(--p-text-color); }
</style>

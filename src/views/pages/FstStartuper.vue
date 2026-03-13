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
        <div class="spw-archive-wrap" ref="archiveBtnRef">
          <button class="spw-btn spw-btn--outline" @click="showArchiveMenu = !showArchiveMenu"
            title="Скачать инвест-пакет">
            <i :class="archiving ? 'pi pi-spin pi-spinner' : 'pi pi-download'"></i>
            Архив <i class="pi pi-chevron-down" style="font-size:10px;margin-left:2px"></i>
          </button>
          <Transition name="fade">
            <div v-if="showArchiveMenu" class="spw-archive-menu">
              <div class="spw-archive-item" @click="downloadArchive('pdf')">
                <i class="pi pi-file-pdf" style="color:var(--fst-red)"></i> PDF-архив
                <span class="spw-archive-hint">Для печати и ИК</span>
              </div>
              <div class="spw-archive-item" @click="downloadArchive('docx')">
                <i class="pi pi-file-word" style="color:var(--fst-blue)"></i> DOCX-архив
                <span class="spw-archive-hint">Редактируемые документы</span>
              </div>
              <div class="spw-archive-item" @click="downloadArchive('xlsx')">
                <i class="pi pi-file-excel" style="color:var(--fst-green)"></i> Финмодель (XLSX)
                <span class="spw-archive-hint">Таблицы и расчёты</span>
              </div>
              <div class="spw-archive-item" @click="downloadArchive('html')">
                <i class="pi pi-globe" style="color:var(--fst-purple)"></i> HTML-архив
                <span class="spw-archive-hint">Открывается в браузере</span>
              </div>
            </div>
          </Transition>
        </div>
        <button class="spw-btn spw-btn--outline" @click="showDiadocDialog = true" title="Подписать документы ЭЦП через Диадок">
          <i class="pi pi-pen-to-square"></i> ЭЦП Диадок
        </button>
        <button v-if="twin.completeness >= 80" class="spw-btn spw-btn--primary" @click="sendToIC">
          <i class="pi pi-send"></i> В ИК
        </button>
      </div>
    </div>

    <!-- ══════════ DIADOC DIALOG ══════════ -->
    <Dialog v-model:visible="showDiadocDialog" header="Подписание ЭЦП — Диадок" modal
      style="width:640px;max-width:95vw" :closable="true">
      <div class="spw-diadoc">
        <p style="font-size:13px;color:var(--p-text-muted-color);margin:0 0 16px">
          Выберите документы для подписания и отправки через Контур.Диадок.
        </p>

        <div class="spw-diadoc-docs">
          <div v-for="doc in signableDocs" :key="doc.key" class="spw-diadoc-row">
            <label class="spw-diadoc-check">
              <input type="checkbox" v-model="doc.selected" />
              <i :class="doc.icon" style="font-size:12px;opacity:.7"></i>
              <span>{{ doc.label }}</span>
            </label>
            <span :class="['spw-diadoc-status', doc.signed ? 'spw-diadoc-status--signed' : '']">
              {{ doc.signed ? '✅ Подписан' : '⏳ Не подписан' }}
            </span>
          </div>
        </div>

        <div class="spw-diadoc-info" style="margin-top:16px">
          <div class="spw-diadoc-field">
            <label>Сертификат ЭЦП</label>
            <Select v-model="diadocCert" :options="diadocCerts" optionLabel="label" optionValue="value"
              placeholder="Выберите сертификат" fluid />
          </div>
          <div class="spw-diadoc-field">
            <label>Контрагент (получатель)</label>
            <InputText v-model="diadocRecipient" placeholder="ИНН или наименование фонда" fluid />
          </div>
          <div class="spw-diadoc-field">
            <label>Комментарий</label>
            <InputText v-model="diadocComment" placeholder="Инвест-пакет AI-2-O Pre-Seed" fluid />
          </div>
        </div>
      </div>

      <template #footer>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <Button label="Отмена" severity="secondary" @click="showDiadocDialog = false" />
          <Button label="Подписать и отправить" icon="pi pi-pen-to-square" severity="success"
            :loading="diadocSending"
            :disabled="!signableDocs.some(d => d.selected) || !diadocCert"
            @click="signViaDiadoc" />
        </div>
      </template>
    </Dialog>

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

        <!-- Document viewer — inline HTML renderer (fst-native) -->
        <template v-else-if="activeView === 'block-doc'">
          <div class="spw-doc-view">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i :class="activeItem.icon"></i> {{ activeItem.label }}</span>
              <div class="spw-doc-actions">
                <button class="spw-btn spw-btn--ghost" @click="fillDocWithAI(activeItem)">
                  <i class="pi pi-magic"></i> AI заполнить
                </button>
                <a v-if="activeItem.url" :href="activeItem.url" target="_blank" class="spw-btn spw-btn--outline">
                  <i class="pi pi-external-link"></i> Открыть
                </a>
              </div>
            </div>
            <!-- Inline document content from vegaDocuments -->
            <div v-if="activeItem.blockDocId && vegaDocuments[activeItem.blockDocId]"
              class="spw-doc-html"
              v-html="vegaDocuments[activeItem.blockDocId]"
            />
            <div v-else class="spw-doc-placeholder-mini">
              <i :class="activeItem.icon || 'pi pi-file'" style="font-size:40px;opacity:.2"></i>
              <p>{{ activeItem.label }}</p>
              <p style="font-size:12px;color:var(--p-text-muted-color)">Документ ещё не заполнен. Нажмите «AI заполнить».</p>
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
              <span class="spw-doc-title"><i class="pi pi-table"></i> Финансовая модель — AI-2-O</span>
              <div class="spw-doc-actions">
                <span style="font-size:11px;color:var(--p-text-muted-color);margin-right:8px">5-летний прогноз · CLN 30M₽ · WACC/CAPM + Damodaran P/S</span>
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
                <!-- Interactive FinModel (TemplateRenderer) -->
                <div class="spw-fm-template-wrap">
                  <TemplateRenderer :template="fstStartupTemplate" />
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

        <!-- ══ Digital Twin: Модель / Формулы ══ -->
        <template v-else-if="activeView === 'twin-model'">
          <div class="spw-twin-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-calculator"></i> Цифровой двойник — Формульная модель</span>
              <div class="spw-doc-actions">
                <span v-if="twinLoadError" style="font-size:11px;color:var(--fst-red)">{{ twinLoadError }}</span>
                <span class="spw-twin-stage-badge" :style="{ background: STAGE_GRAPH[twinCalc.currentStageIndex]?.color }">
                  {{ STAGE_GRAPH[twinCalc.currentStageIndex]?.label }}
                </span>
                <button class="spw-btn spw-btn--outline" :disabled="twinSaving" @click="saveTwinToIntegram">
                  <i :class="twinSaving ? 'pi pi-spin pi-spinner' : 'pi pi-save'"></i>
                  {{ twinSaving ? 'Сохраняю...' : 'В базу' }}
                </button>
              </div>
            </div>
            <div class="spw-twin-body">

              <!-- Inputs (левая колонка) -->
              <div class="spw-twin-inputs">
                <div class="spw-twin-inputs-head">Входные параметры</div>
                <div class="spw-ti-row">
                  <label>MRR (₽/мес)</label>
                  <input type="number" v-model.number="twinModel.mrr" min="0" step="100000" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Рост MoM (%)</label>
                  <input type="number" v-model.number="twinModel.growthMom" min="0" max="200" step="1" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Клиентов</label>
                  <input type="number" v-model.number="twinModel.customers" min="0" step="1" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Burn/мес (₽)</label>
                  <input type="number" v-model.number="twinModel.burn" min="0" step="50000" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Cash (₽)</label>
                  <input type="number" v-model.number="twinModel.cash" min="0" step="500000" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Churn/мес (%)</label>
                  <input type="number" v-model.number="twinModel.churn" min="0" max="100" step="0.5" class="spw-ti-input" />
                </div>
                <div class="spw-twin-inputs-head" style="margin-top:12px">Параметры сделки</div>
                <div class="spw-ti-row">
                  <label>Инвестиция (₽)</label>
                  <input type="number" v-model.number="twinModel.investAmount" min="0" step="1000000" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Целевая доля (%)</label>
                  <input type="number" v-model.number="twinModel.targetEquity" min="1" max="49" step="1" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Мультипл. выхода (×)</label>
                  <input type="number" v-model.number="twinModel.exitMultiple" min="1" max="30" step="1" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Ставка диск. (%)</label>
                  <input type="number" v-model.number="twinModel.discountRate" min="10" max="80" step="5" class="spw-ti-input" />
                </div>
                <div class="spw-ti-row">
                  <label>Горизонт (лет)</label>
                  <input type="number" v-model.number="twinModel.horizon" min="2" max="10" step="1" class="spw-ti-input" />
                </div>
              </div>

              <!-- Formula waterfall (правая колонка) -->
              <div class="spw-twin-chain">
                <div class="spw-twin-inputs-head">Формульная цепочка — каскад расчётов</div>

                <!-- Блок 1: Операционные метрики -->
                <div class="spw-tw-group">
                  <div class="spw-tw-group-label">Операционные метрики</div>
                  <div class="spw-tw-row">
                    <span class="spw-tw-key">MRR</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinModel.mrr) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">ARR = MRR × 12</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val spw-tw-val--hi">{{ fmtRub(twinCalc.arr) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Runway = Cash / Burn</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val" :style="{ color: twinCalc.runway < 6 ? 'var(--fst-red)' : twinCalc.runway < 12 ? 'var(--fst-brand)' : 'var(--fst-green)' }">
                      {{ twinCalc.runway === 999 ? '∞' : twinCalc.runway + ' мес' }}
                    </span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Growth Annual = (1+MoM)¹²−1</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ twinCalc.growthAnnual }}%</span>
                  </div>
                </div>

                <!-- Блок 2: Прогноз ARR -->
                <div class="spw-tw-group">
                  <div class="spw-tw-group-label">Прогноз ARR (5 лет)</div>
                  <div class="spw-tw-arr-row">
                    <div v-for="(v, i) in twinCalc.arrByYear" :key="i" class="spw-tw-arr-col">
                      <div class="spw-tw-arr-bar">
                        <div class="spw-tw-arr-fill"
                          :style="{ height: Math.min(v / Math.max(...twinCalc.arrByYear) * 80, 80) + 'px', background: 'var(--fst-blue)' }">
                        </div>
                      </div>
                      <div class="spw-tw-arr-val">{{ (v/1e6).toFixed(1) }}M</div>
                      <div class="spw-tw-arr-label">Y{{ i+1 }}</div>
                    </div>
                  </div>
                </div>

                <!-- Блок 3: Оценка -->
                <div class="spw-tw-group">
                  <div class="spw-tw-group-label">Оценка (формульная цепочка)</div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Terminal Value = ARR_Y5 × {{ twinModel.exitMultiple }}×</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinCalc.tv) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">PV(TV) = TV / (1+{{ twinModel.discountRate }}%)^{{ twinModel.horizon }}</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinCalc.tvPV) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">VC Method pre-money = Invest / {{ twinModel.targetEquity }}%</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinCalc.vcPre) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--total">
                    <span class="spw-tw-key">Pre-money (взвешенная)</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val spw-tw-val--hi">{{ fmtRub(twinCalc.preMoney) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Post-money = Pre + {{ fmtRub(twinCalc.inv) }}</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinCalc.postMoney) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Доля фонда = Invest / Post-money</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val" style="color:var(--fst-purple)">{{ twinCalc.actualEquity.toFixed(1) }}%</span>
                  </div>
                </div>

                <!-- Блок 4: Доходность -->
                <div class="spw-tw-group">
                  <div class="spw-tw-group-label">Доходность фонда</div>
                  <div class="spw-tw-row spw-tw-row--derived">
                    <span class="spw-tw-key">Стоимость доли на выходе</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val">{{ fmtRub(twinCalc.fundAtExit) }}</span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--total">
                    <span class="spw-tw-key">MOIC = Exit / Invest</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val spw-tw-val--hi" :style="{ color: twinCalc.moic >= 3 ? 'var(--fst-green)' : twinCalc.moic >= 1 ? 'var(--fst-brand)' : 'var(--fst-red)' }">
                      {{ twinCalc.moic.toFixed(1) }}×
                    </span>
                  </div>
                  <div class="spw-tw-row spw-tw-row--total">
                    <span class="spw-tw-key">IRR = MOIC^(1/{{ twinModel.horizon }}) − 1</span>
                    <span class="spw-tw-arrow">→</span>
                    <span class="spw-tw-val spw-tw-val--hi" :style="{ color: twinCalc.irr >= 30 ? 'var(--fst-green)' : twinCalc.irr >= 15 ? 'var(--fst-brand)' : 'var(--fst-red)' }">
                      {{ twinCalc.irr.toFixed(0) }}%
                    </span>
                  </div>
                </div>

                <!-- Блок 5: Предсказательная сила — вероятность выживания -->
                <div class="spw-tw-group">
                  <div class="spw-tw-group-label">Предсказательная модель — вероятность выживания</div>
                  <div class="spw-tw-survival-row">
                    <div v-for="(prob, label) in { '12 мес': twinCalc.survival12m, '24 мес': twinCalc.survival24m, '36 мес': twinCalc.survival36m }" :key="label" class="spw-tw-survival-col">
                      <div class="spw-tw-surv-ring">
                        <svg viewBox="0 0 36 36" class="spw-tw-ring-svg">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--p-content-border-color)" stroke-width="2.5"/>
                          <circle cx="18" cy="18" r="15.9" fill="none"
                            :stroke="prob >= 0.7 ? 'var(--fst-green)' : prob >= 0.45 ? 'var(--fst-brand)' : 'var(--fst-red)'"
                            stroke-width="2.5"
                            stroke-dasharray="100" :stroke-dashoffset="100 - prob * 100"
                            stroke-linecap="round"
                            transform="rotate(-90 18 18)"
                          />
                        </svg>
                        <div class="spw-tw-ring-val">{{ (prob * 100).toFixed(0) }}%</div>
                      </div>
                      <div class="spw-tw-surv-label">{{ label }}</div>
                    </div>
                  </div>
                  <div class="spw-twin-hint">
                    <i class="pi pi-info-circle"></i>
                    Модель учитывает: Runway ({{ twinCalc.runway === 999 ? '∞' : twinCalc.runway }} мес), ARR ({{ fmtRub(twinCalc.arr) }}), рост ({{ twinCalc.growthAnnual }}%/год). Измените входные данные — вероятности пересчитаются.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ══ Digital Twin: График событий ══ -->
        <template v-else-if="activeView === 'twin-stages'">
          <div class="spw-twin-wrap">
            <div class="spw-doc-topbar">
              <span class="spw-doc-title"><i class="pi pi-sitemap"></i> График событий — Путь стартапа</span>
              <div class="spw-doc-actions">
                <span style="font-size:11px;color:var(--p-text-muted-color)">Текущая стадия: </span>
                <span class="spw-twin-stage-badge" :style="{ background: STAGE_GRAPH[twinCalc.currentStageIndex]?.color }">
                  {{ STAGE_GRAPH[twinCalc.currentStageIndex]?.label }}
                </span>
              </div>
            </div>
            <div class="spw-stages-body">

              <!-- Stage pipeline (горизонтальный граф) -->
              <div class="spw-stage-pipeline">
                <template v-for="(stage, si) in twinCalc.stageReqStatus" :key="stage.key">
                  <!-- Нода -->
                  <div :class="['spw-stage-node', { 'spw-stage-node--active': stage.active, 'spw-stage-node--done': si < twinCalc.currentStageIndex, 'spw-stage-node--locked': si > twinCalc.currentStageIndex }]">
                    <div class="spw-sn-circle" :style="{ background: stage.unlocked ? stage.color : 'var(--p-surface-ground)', borderColor: stage.color }">
                      <i v-if="si < twinCalc.currentStageIndex" class="pi pi-check"></i>
                      <span v-else>{{ si + 1 }}</span>
                    </div>
                    <div class="spw-sn-label" :style="{ color: stage.active ? stage.color : '' }">{{ stage.label }}</div>
                    <!-- Требования -->
                    <div class="spw-sn-reqs">
                      <div v-for="req in stage.reqs" :key="req.key" :class="['spw-sn-req', req.met ? 'spw-sn-req--ok' : '']">
                        <i :class="req.met ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                        <span>{{ req.label }}</span>
                      </div>
                    </div>
                    <!-- Прогресс к следующей ноде -->
                    <div v-if="stage.nextLabel && stage.active" class="spw-sn-next">
                      <div class="spw-sn-next-label">→ {{ stage.nextLabel }}</div>
                    </div>
                  </div>
                  <!-- Коннектор между нодами -->
                  <div v-if="si < twinCalc.stageReqStatus.length - 1"
                    :class="['spw-stage-conn', si < twinCalc.currentStageIndex ? 'spw-stage-conn--done' : '']">
                  </div>
                </template>
              </div>

              <!-- Требования текущей стадии (детальный список) -->
              <div class="spw-stage-detail">
                <div class="spw-sd-head">
                  <i class="pi pi-list-check"></i>
                  Чек-лист текущей стадии: <strong>{{ STAGE_GRAPH[twinCalc.currentStageIndex]?.label }}</strong>
                </div>
                <div v-for="req in twinCalc.stageReqStatus[twinCalc.currentStageIndex]?.reqs" :key="req.key"
                  :class="['spw-sd-req', req.met ? 'spw-sd-req--ok' : 'spw-sd-req--open']">
                  <i :class="req.met ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
                  <div class="spw-sd-req-body">
                    <span class="spw-sd-req-label">{{ req.label }}</span>
                    <span v-if="!req.met && req.doc" class="spw-sd-req-hint">
                      → открыть в <a @click.prevent="openView({ key: req.doc, type: req.doc.startsWith('doc') ? 'doc-gost' : req.doc })" href="#">DataRoom</a>
                    </span>
                    <span v-else-if="req.met" class="spw-sd-req-hint" style="color:var(--fst-green)">выполнено</span>
                    <span v-else class="spw-sd-req-hint">требует заполнения</span>
                  </div>
                </div>

                <!-- Следующий триггер -->
                <div v-if="STAGE_GRAPH[twinCalc.currentStageIndex]?.nextLabel" class="spw-sd-trigger">
                  <i class="pi pi-flag" style="color:var(--fst-brand)"></i>
                  <div>
                    <div style="font-weight:600;font-size:12px;color:var(--fst-brand)">Триггер перехода на следующую стадию</div>
                    <div style="font-size:13px">{{ STAGE_GRAPH[twinCalc.currentStageIndex]?.nextLabel }}</div>
                    <div style="font-size:11px;color:var(--p-text-muted-color);margin-top:4px">
                      Измените MRR или количество клиентов в разделе «Модель / Формулы» — статус обновится автоматически
                    </div>
                  </div>
                </div>
              </div>
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
import TemplateRenderer from '@/components/finmodel/TemplateRenderer.vue'
import fstStartupTemplate from '@/templates/finmodel/fst_startup.json'
import { buildArtifactTree, logEvent, fetchEvents, syncCompanyTwin } from '@/services/workspaceOntologyService.js'
import { fetchTwinModel, saveTwinModel } from '@/services/fstApi.js'
import { vegaTwin, vegaTermSheet, vegaSmartContract, vegaGostDocs, vegaEvents, vegaFinmodel } from '@/data/vegaDemoData.js'
import { vegaDocuments } from '@/data/vegaDocuments.js'

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

// ─── Digital Twin: stage graph ───────────────────────────────────────────────
const STAGE_GRAPH = [
  {
    key: 'pre-seed', label: 'Pre-Seed', color: 'var(--fst-purple)',
    requirements: [
      { key: 'pitch',  label: 'Питч-дек',         doc: 'doc-teaser' },
      { key: 'nda',    label: 'NDA',               doc: 'doc-nda' },
      { key: 'tz',     label: 'ТЗ / Архитектура',  doc: 'doc-tz' },
      { key: 'team3',  label: 'Команда ≥ 3 чел',   formula: m => m.teamSize >= 3 },
      { key: 'trl5',   label: 'TRL ≥ 5',           formula: m => (m.trl||0) >= 5 },
    ],
    nextLabel: 'ARR > 2 млн ₽ или клиентов > 3',
    nextFormula: m => (m.mrr * 12 >= 2_000_000) || m.customers >= 3,
  },
  {
    key: 'seed', label: 'Seed', color: 'var(--fst-blue)',
    requirements: [
      { key: 'finmodel',  label: 'Финансовая модель',   doc: 'finmodel' },
      { key: 'termsheet', label: 'Term Sheet',           doc: 'doc-termsheet' },
      { key: 'captable',  label: 'Cap Table / Оценка',   doc: 'doc-invest' },
      { key: 'arr2m',     label: 'ARR ≥ 2 млн ₽',       formula: m => m.mrr * 12 >= 2_000_000 },
      { key: 'cust3',     label: 'Клиентов ≥ 3',         formula: m => m.customers >= 3 },
      { key: 'runway12',  label: 'Runway ≥ 12 мес',      formula: m => m.burn > 0 && m.cash / m.burn >= 12 },
    ],
    nextLabel: 'ARR > 20 млн ₽ и churn < 5%',
    nextFormula: m => m.mrr * 12 >= 20_000_000 && m.churn < 5,
  },
  {
    key: 'series-a', label: 'Series A', color: 'var(--fst-green)',
    requirements: [
      { key: 'audit',     label: 'Аудиторский отчёт',    doc: 'doc-nma' },
      { key: 'dd',        label: 'Due Diligence пакет',   doc: 'doc-dataroom' },
      { key: 'valuation', label: 'Отчёт об оценке',       doc: 'doc-exec' },
      { key: 'arr20m',    label: 'ARR ≥ 20 млн ₽',        formula: m => m.mrr * 12 >= 20_000_000 },
      { key: 'churn5',    label: 'Churn < 5%',             formula: m => m.churn < 5 },
      { key: 'cust20',    label: 'Клиентов ≥ 20',          formula: m => m.customers >= 20 },
    ],
    nextLabel: 'ARR > 100 млн ₽',
    nextFormula: m => m.mrr * 12 >= 100_000_000,
  },
  {
    key: 'series-b', label: 'Series B', color: 'var(--fst-cyan)',
    requirements: [
      { key: 'esop',    label: 'ESOP план',               doc: 'doc-corp' },
      { key: 'intl',    label: 'Международные продажи',   doc: 'doc-letter' },
      { key: 'arr100m', label: 'ARR ≥ 100 млн ₽',         formula: m => m.mrr * 12 >= 100_000_000 },
    ],
    nextLabel: 'MOIC ≥ 3× или стратег',
    nextFormula: m => m.mrr * 12 >= 300_000_000,
  },
  {
    key: 'exit', label: 'Exit / IPO', color: 'var(--fst-brand)',
    requirements: [
      { key: 'waterfall', label: 'Waterfall расчёт',       doc: 'doc-invest' },
      { key: 'liqpref',   label: 'Ликв. привилегия',       doc: 'doc-corp' },
    ],
    nextLabel: null,
    nextFormula: null,
  },
]

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
      { key: 'doc-nav',      label: 'Навигатор по пакету', icon: 'pi pi-map',              type: 'doc', required: true,  blockDocId: '1777620', filled: true },
      { key: 'doc-exec',     label: 'Executive Summary',    icon: 'pi pi-file',             type: 'doc', required: true,  blockDocId: '1777641', filled: true },
      { key: 'doc-teaser',   label: 'Тизер / Pitch Deck',  icon: 'pi pi-bolt',             type: 'doc',                    blockDocId: '1777645', filled: true },
      { key: 'doc-nda',      label: 'NDA',                  icon: 'pi pi-lock',             type: 'doc', required: true,  blockDocId: '67260',   integramId: '66095', filled: true },
      { key: 'doc-dd',       label: 'Due Diligence',        icon: 'pi pi-search',           type: 'doc',                    blockDocId: '1777618', integramId: '66099', filled: true },
      { key: 'doc-faq',      label: 'FAQ для инвестора',    icon: 'pi pi-question-circle',  type: 'doc',                    blockDocId: '1777621', filled: true },
      { key: 'doc-dataroom', label: 'Data Room (полный)',   icon: 'pi pi-database',         type: 'doc',                    blockDocId: '1777622', filled: true },
      { key: 'doc-letter',   label: 'Письмо инвестору',    icon: 'pi pi-envelope',         type: 'doc',                    blockDocId: '1777623', filled: true },
    ],
  },
  {
    key: 'finance', label: 'Финансы', icon: 'pi pi-chart-line', roles: ['founder','investor'],
    items: [
      { key: 'finmodel',    label: 'Финансовая модель',  icon: 'pi pi-table',    type: 'doc', required: true, blockDocId: '1777650', filled: true },
      { key: 'doc-bizplan', label: 'Бизнес-план',        icon: 'pi pi-book',     type: 'doc', required: true, blockDocId: '1777647', filled: true },
      { key: 'doc-captable',label: 'Cap Table',          icon: 'pi pi-sitemap',  type: 'doc',                   blockDocId: '1777619', integramId: '66103', filled: true },
      { key: 'doc-nma',     label: 'Отчёт по НМА',       icon: 'pi pi-star',     type: 'doc',                   blockDocId: '1777624', filled: true },
      { key: 'doc-founder', label: 'Справка основателя', icon: 'pi pi-id-card',  type: 'doc',                   blockDocId: '1777625', filled: true },
    ],
  },
  {
    key: 'deal', label: 'Сделка', icon: 'pi pi-handshake', roles: ['founder','investor'],
    items: [
      { key: 'doc-termsheet',  label: 'Term Sheet (фонд)', icon: 'pi pi-file-edit',  type: 'doc', required: true, blockDocId: '1777644', filled: true },
      { key: 'doc-ts-own',     label: 'Term Sheet (конструктор)', icon: 'pi pi-file-edit',  type: 'termsheet' },
      { key: 'doc-invest',     label: 'Договор инвестирования', icon: 'pi pi-verified',  type: 'doc', required: true, blockDocId: '1777626', filled: true },
      { key: 'doc-corp',       label: 'Корпоративный договор',  icon: 'pi pi-users',     type: 'doc', required: true, blockDocId: '1777627', filled: true },
      { key: 'doc-protocol',   label: 'Протокол собрания',      icon: 'pi pi-list',      type: 'doc',                   blockDocId: '1777628', filled: true },
      { key: 'doc-application',label: 'Заявление о вступлении', icon: 'pi pi-user-plus', type: 'doc', required: true, blockDocId: '1777629', filled: true },
      { key: 'doc-spouse',     label: 'Согласие супруга',       icon: 'pi pi-heart',     type: 'doc',                   blockDocId: '1777630', filled: true },
      { key: 'smart-contract', label: 'Smart Contract сделки',  icon: 'pi pi-verified',  type: 'smart-contract' },
    ],
  },
  {
    key: 'tech', label: 'Тех. документация', icon: 'pi pi-cog', roles: ['founder', 'expert'],
    items: [
      { key: 'doc-tz',      label: 'ТЗ (ГОСТ 34.602)',    icon: 'pi pi-file-edit',  type: 'doc-gost', gostType: 'tz',      required: true, blockDocId: '1777631', filled: true },
      { key: 'doc-techdoc', label: 'Описание ПО (ГОСТ)',   icon: 'pi pi-book',       type: 'doc-gost', gostType: 'techdoc',              blockDocId: '1777632', filled: true },
      { key: 'doc-trl',     label: 'TRL-паспорт',          icon: 'pi pi-chart-bar',  type: 'doc-gost', gostType: 'trl',                  blockDocId: '1777633', filled: true },
      { key: 'doc-sysarch', label: 'Архитектура системы',  icon: 'pi pi-sitemap',    type: 'doc-gost', gostType: 'arch',                 blockDocId: '1777634', filled: true },
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
  {
    key: 'twin', label: 'Цифровой двойник', icon: 'pi pi-share-alt', roles: ['founder','investor'],
    items: [
      { key: 'twin-model',   label: 'Модель / Формулы',  icon: 'pi pi-calculator',  type: 'twin-model' },
      { key: 'twin-stages',  label: 'График событий',    icon: 'pi pi-sitemap',     type: 'twin-stages' },
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

// Block editor state
const creatingDoc = ref(false)
const showDocFrame = ref(true)

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

// ID проекта ВентурОС в Integram (объект type 1155)
const VENTUREOS_PROJECT_ID = '7300'

const twinSaving = ref(false)
const twinLoadError = ref('')

// ─── Digital Twin: formula engine inputs ─────────────────────────────────────
const twinModel = ref({
  mrr: 0,           // Monthly Recurring Revenue, руб
  growthMom: 15,    // Month-over-month growth rate, %
  burn: 500_000,    // Monthly burn rate, руб
  cash: 5_000_000,  // Cash on hand, руб
  customers: 0,     // Paying customers
  churn: 5,         // Monthly churn, %
  arpu: 500_000,    // ARPU per customer per year, руб
  investAmount: 15_000_000, // Investment amount, руб
  targetEquity: 15, // Target equity, %
  exitMultiple: 8,  // Exit multiple on Revenue
  horizon: 5,       // Investment horizon, years
  discountRate: 40, // Discount rate, %
})

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

// ─── Digital Twin: formula chain (все зависимые метрики) ─────────────────────
const twinCalc = computed(() => {
  const m = {
    ...twinModel.value,
    teamSize: twinModel.value.teamSize || twin.value.teamSize || 0,
    trl: twinModel.value.trl ?? twin.value.trl ?? 0,
  }
  const arr = (m.mrr || 0) * 12
  const growthAnnual = Math.pow(1 + (m.growthMom || 15) / 100, 12) - 1
  const runway = m.burn > 0 ? Math.floor(m.cash / m.burn) : 999

  // ARR projection: 5 лет
  const arrByYear = Array.from({ length: 5 }, (_, i) =>
    Math.round(arr * Math.pow(1 + growthAnnual, i + 1))
  )
  const arrY5 = arrByYear[4] || 0

  // Выход
  const tv = arrY5 * (m.exitMultiple || 8)
  const r = (m.discountRate || 40) / 100
  const n = m.horizon || 5
  const tvPV = tv / Math.pow(1 + r, n)

  // VC Method: post = invest / equity%
  const inv = m.investAmount || 15_000_000
  const eq = (m.targetEquity || 15) / 100
  const vcPost = eq > 0 ? inv / eq : 0
  const vcPre = vcPost - inv

  // Взвешенная: если есть ARR — 40% DCF + 60% VC, иначе — только VC
  const preMoney = arr > 1000 ? tvPV * 0.4 + vcPre * 0.6 : vcPre
  const postMoney = preMoney + inv
  const actualEquity = postMoney > 0 ? (inv / postMoney) * 100 : 0

  // Доходность фонда
  const fundAtExit = tv * (actualEquity / 100)
  const moic = inv > 0 ? fundAtExit / inv : 0
  const irr = moic > 0 && n > 0 ? (Math.pow(moic, 1 / n) - 1) * 100 : 0

  // FCF цепочка (упрощённая)
  const fcf = [
    -(m.burn * 12),
    Math.max(arrByYear[1] * 0.15, 0),
    arrByYear[2] * 0.40,
    arrByYear[3] * 0.58,
    arrByYear[4] * 0.70,
  ]

  // Текущая стадия — определяется формулой
  const currentStageKey = (() => {
    if (m.mrr * 12 >= 100_000_000) return 'series-b'
    if (m.mrr * 12 >= 20_000_000 && m.churn < 5) return 'series-a'
    if (m.mrr * 12 >= 2_000_000 || m.customers >= 3) return 'seed'
    return 'pre-seed'
  })()
  const currentStageIndex = STAGE_GRAPH.findIndex(s => s.key === currentStageKey)

  // Требования текущей стадии
  const stageReqStatus = STAGE_GRAPH.map(stage => ({
    ...stage,
    reqs: stage.requirements.map(req => ({
      ...req,
      met: req.formula ? req.formula(m) : false,
    })),
    unlocked: STAGE_GRAPH.indexOf(stage) <= currentStageIndex,
    active: stage.key === currentStageKey,
  }))

  // Вероятность выживания по сценариям (логистическая модель)
  const survivalBase = runway >= 12 ? 0.72 : runway >= 6 ? 0.50 : 0.28
  const arrFactor = arr >= 2_000_000 ? 1.2 : arr >= 500_000 ? 1.05 : 0.85
  const survival12m = Math.min(survivalBase * arrFactor, 0.97)
  const survival24m = Math.min(survival12m * 0.75, 0.95)
  const survival36m = Math.min(survival24m * 0.70, 0.90)

  return {
    arr, arrByYear, arrY5, runway, growthAnnual: (growthAnnual * 100).toFixed(1),
    tv, tvPV, vcPre, preMoney, postMoney, actualEquity,
    fundAtExit, moic, irr, fcf, inv,
    currentStageKey, currentStageIndex, stageReqStatus,
    survival12m, survival24m, survival36m,
  }
})

// Вспомогательная: форматирование числа в млн/K₽
function fmtRub(n) {
  if (!n || isNaN(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн ₽'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'k ₽'
  return n.toFixed(0) + ' ₽'
}

async function loadTwinFromIntegram(projectId) {
  twinLoadError.value = ''
  const data = await fetchTwinModel(projectId)
  if (Object.keys(data).length) {
    // Мержим только непустые значения — не затираем дефолты нулями
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && val !== null && val !== 0 && key in twinModel.value) {
        twinModel.value[key] = val
      }
    }
    addEvent('info', `Цифровой двойник загружен из Integram (проект ${projectId})`)
  }
}

async function saveTwinToIntegram() {
  twinSaving.value = true
  try {
    const projectId = companyId.value || VENTUREOS_PROJECT_ID
    await saveTwinModel(projectId, { ...twinModel.value })
    addEvent('info', `Цифровой двойник сохранён в Integram`)
  } catch (e) {
    twinLoadError.value = 'Ошибка сохранения: ' + e.message
  } finally {
    twinSaving.value = false
  }
}

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

  if (item.type === 'chat') { activeView.value = 'agent' }
  if (item.type === 'grants') { activeView.value = 'grants' }
  if (item.type === 'smart-contract') {
    activeView.value = 'smart-contract'
    addEvent('deal', `Открыт Smart Contract ${smartContract.value?.id || ''}`)
  }
  if (item.type === 'termsheet') { addEvent('deal', `Открыт Term Sheet конструктор`) }
  if (item.type === 'twin-model') { activeView.value = 'twin-model' }
  if (item.type === 'twin-stages') { activeView.value = 'twin-stages' }

  // doc / doc-gost — единый блочный редактор
  if (item.type === 'doc' || item.type === 'doc-gost') {
    activeView.value = 'block-doc'
    if (item.blockDocId) {
      addEvent('doc', `Открыт: ${item.label} (blockDoc: ${item.blockDocId})`)
    }
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

async function createBlockDoc(item) {
  creatingDoc.value = true
  try {
    const res = await fetch('/api/doc-blocks/new/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: `<h1>${item.label}</h1><p>Документ создан для ${twin.value.company || 'AI-2-O'}</p>`,
        title: item.label,
        author: currentUserEmail,
        database: 'kval',
      }),
    })
    const { documentId } = await res.json()
    // Persist docId on the item itself (reactive update via activeItem reassignment)
    for (const sec of ARTIFACTS_ALL) {
      const found = sec.items?.find(i => i.key === item.key)
      if (found) { found.blockDocId = documentId; break }
    }
    activeItem.value = { ...activeItem.value, blockDocId: documentId }
    addEvent('doc', `Создан документ в редакторе: ${item.label} (${documentId})`)
  } catch (e) {
    console.error('[createBlockDoc]', e)
  } finally {
    creatingDoc.value = false
  }
}

function openBlockEditor(docId) {
  window.open(`/block-editor?docId=${docId}&database=kval`, '_blank')
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

// ── Archive (ZIP) download ─────────────────────────────────────────────────────
const archiving = ref(false)
const showArchiveMenu = ref(false)
const archiveBtnRef = ref(null)

// Close archive menu on click outside
function onDocClick(e) {
  if (archiveBtnRef.value && !archiveBtnRef.value.contains(e.target)) showArchiveMenu.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))

const HTML_STYLE = `body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}
h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:16px;margin-top:24px;color:#444}
h3{font-size:14px;color:#555}table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:13px}
th{background:#f5f5f5;font-weight:600}ul,ol{padding-left:20px}
pre{background:#f8f8f8;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px}
em{color:#666}`

function collectDocs() {
  const docs = []
  for (const sec of ARTIFACTS_ALL) {
    for (const item of (sec.items || [])) {
      if (item.blockDocId && vegaDocuments[item.blockDocId]) {
        docs.push({ label: item.label, html: vegaDocuments[item.blockDocId], blockDocId: item.blockDocId })
      }
    }
  }
  return docs
}

function safeName(name) { return name.replace(/[\/\\:*?"<>|]/g, '_') }

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const README_TEXT = (count, fmt) => `Инвест-пакет AI-2-O Pre-Seed
ООО «AI-2-O» · ИП Гаврилов Денис Александрович · ИНН 183505204090
CLN 30 млн ₽ · Valuation Cap 240 млн ₽
Дата формирования: ${new Date().toLocaleDateString('ru-RU')}
Сайт: ai2fund.ru · Email: unidel@yandex.ru · Тел: +7 912 856 4410

Содержит ${count} документов в формате ${fmt}.
`

async function downloadArchive(format) {
  showArchiveMenu.value = false
  archiving.value = true
  try {
    if (format === 'html') await archiveHTML()
    else if (format === 'pdf') await archivePDF()
    else if (format === 'docx') await archiveDOCX()
    else if (format === 'xlsx') await archiveXLSX()
  } catch (err) {
    console.error('Archive error:', err)
    addEvent('warn', 'Ошибка создания архива: ' + err.message)
  } finally {
    archiving.value = false
  }
}

// ── HTML ZIP ────────────────────────────────────────────────────────────────────
async function archiveHTML() {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder('AI2O_InvestPack_HTML')
  const docs = collectDocs()
  docs.forEach((d, i) => {
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${d.label}</title><style>${HTML_STYLE}</style></head><body>${d.html}</body></html>`
    folder.file(`${String(i+1).padStart(2,'0')}_${safeName(d.label)}.html`, html)
  })
  folder.file('README.txt', README_TEXT(docs.length, 'HTML'))
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `AI2O_InvestPack_HTML_${new Date().toISOString().slice(0,10)}.zip`)
  addEvent('info', `HTML-архив скачан (${docs.length} документов)`)
}

// ── PDF ZIP ─────────────────────────────────────────────────────────────────────
async function archivePDF() {
  const { default: JSZip } = await import('jszip')
  const html2pdf = (await import('html2pdf.js')).default
  const zip = new JSZip()
  const folder = zip.folder('AI2O_InvestPack_PDF')
  const docs = collectDocs()

  // Render each doc to PDF via hidden container
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#222'
  document.body.appendChild(container)

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    container.innerHTML = d.html
    // Style tables in the container
    container.querySelectorAll('table').forEach(t => {
      t.style.borderCollapse = 'collapse'; t.style.width = '100%'; t.style.marginBottom = '12px'
    })
    container.querySelectorAll('th,td').forEach(el => {
      el.style.border = '1px solid #ccc'; el.style.padding = '6px 8px'; el.style.fontSize = '11px'
    })
    container.querySelectorAll('th').forEach(el => { el.style.background = '#f0f0f0'; el.style.fontWeight = '600' })
    container.querySelectorAll('h1').forEach(el => { el.style.fontSize = '18px'; el.style.borderBottom = '2px solid #333'; el.style.paddingBottom = '6px' })
    container.querySelectorAll('h2').forEach(el => { el.style.fontSize = '14px'; el.style.marginTop = '16px' })

    const pdfBlob = await html2pdf().set({
      margin: [12, 12, 12, 12],
      filename: `${safeName(d.label)}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).from(container).outputPdf('blob')

    folder.file(`${String(i+1).padStart(2,'0')}_${safeName(d.label)}.pdf`, pdfBlob)
  }
  document.body.removeChild(container)

  folder.file('README.txt', README_TEXT(docs.length, 'PDF'))
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `AI2O_InvestPack_PDF_${new Date().toISOString().slice(0,10)}.zip`)
  addEvent('info', `PDF-архив скачан (${docs.length} документов)`)
}

// ── DOCX ZIP ────────────────────────────────────────────────────────────────────
async function archiveDOCX() {
  const { default: JSZip } = await import('jszip')
  const docxLib = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = docxLib

  const zip = new JSZip()
  const folder = zip.folder('AI2O_InvestPack_DOCX')
  const docs = collectDocs()

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    const paragraphs = htmlToDocxParagraphs(d.html, { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType })
    const doc = new Document({
      creator: 'AI-2-O / ai2fund.ru',
      title: d.label,
      description: 'Инвест-пакет AI-2-O Pre-Seed',
      sections: [{ children: paragraphs }],
    })
    const buf = await Packer.toBlob(doc)
    folder.file(`${String(i+1).padStart(2,'0')}_${safeName(d.label)}.docx`, buf)
  }

  folder.file('README.txt', README_TEXT(docs.length, 'DOCX'))
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `AI2O_InvestPack_DOCX_${new Date().toISOString().slice(0,10)}.zip`)
  addEvent('info', `DOCX-архив скачан (${docs.length} документов)`)
}

/** Convert HTML string to array of docx Paragraph/Table objects */
function htmlToDocxParagraphs(html, { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType }) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const result = []
  const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }

  function processNode(node) {
    if (node.nodeType === 3) { // text
      const text = node.textContent.trim()
      if (text) result.push(new Paragraph({ children: [new TextRun(text)] }))
      return
    }
    if (node.nodeType !== 1) return
    const tag = node.tagName.toLowerCase()

    if (tag === 'h1') {
      result.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: node.textContent.trim(), bold: true })] }))
    } else if (tag === 'h2') {
      result.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: node.textContent.trim(), bold: true })] }))
    } else if (tag === 'h3') {
      result.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: node.textContent.trim(), bold: true })] }))
    } else if (tag === 'p') {
      const runs = inlineRuns(node)
      if (runs.length) result.push(new Paragraph({ children: runs, spacing: { after: 120 } }))
    } else if (tag === 'ul' || tag === 'ol') {
      const items = node.querySelectorAll(':scope > li')
      items.forEach((li, idx) => {
        const prefix = tag === 'ol' ? `${idx+1}. ` : '• '
        result.push(new Paragraph({ children: [new TextRun(prefix + li.textContent.trim())], indent: { left: 400 }, spacing: { after: 60 } }))
      })
    } else if (tag === 'table') {
      const rows = []
      node.querySelectorAll('tr').forEach(tr => {
        const cells = []
        tr.querySelectorAll('th, td').forEach(cell => {
          const isHeader = cell.tagName === 'TH'
          cells.push(new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell.textContent.trim(), bold: isHeader, size: 20 })] })],
            borders,
            width: { size: 100 / Math.max(tr.children.length, 1), type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'F0F0F0' } : undefined,
          }))
        })
        if (cells.length) rows.push(new TableRow({ children: cells }))
      })
      if (rows.length) result.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
      result.push(new Paragraph({ children: [] })) // spacer
    } else if (tag === 'pre') {
      result.push(new Paragraph({ children: [new TextRun({ text: node.textContent.trim(), font: 'Courier New', size: 18 })], spacing: { after: 120 } }))
    } else if (tag === 'em') {
      result.push(new Paragraph({ children: [new TextRun({ text: node.textContent.trim(), italics: true, color: '666666' })], spacing: { after: 80 } }))
    } else {
      // Recurse into div, span, etc.
      for (const child of node.childNodes) processNode(child)
    }
  }

  function inlineRuns(el) {
    const runs = []
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const t = child.textContent
        if (t.trim()) runs.push(new TextRun(t))
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase()
        const text = child.textContent.trim()
        if (!text) continue
        if (tag === 'strong' || tag === 'b') runs.push(new TextRun({ text, bold: true }))
        else if (tag === 'em' || tag === 'i') runs.push(new TextRun({ text, italics: true }))
        else if (tag === 'br') runs.push(new TextRun({ text: '', break: 1 }))
        else runs.push(new TextRun(text))
      }
    }
    return runs
  }

  for (const child of doc.body.firstChild.childNodes) processNode(child)
  return result
}

// ── XLSX (финмодель + сводка) ───────────────────────────────────────────────────
async function archiveXLSX() {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AI-2-O / ai2fund.ru'
  wb.created = new Date()

  // Sheet 1: Сводка документов
  const ws1 = wb.addWorksheet('Инвест-пакет')
  ws1.columns = [
    { header: '№', key: 'num', width: 5 },
    { header: 'Документ', key: 'label', width: 40 },
    { header: 'Раздел', key: 'section', width: 25 },
    { header: 'Статус', key: 'status', width: 15 },
  ]
  ws1.getRow(1).font = { bold: true }
  let idx = 0
  for (const sec of ARTIFACTS_ALL) {
    for (const item of (sec.items || [])) {
      if (item.blockDocId && vegaDocuments[item.blockDocId]) {
        idx++
        ws1.addRow({ num: idx, label: item.label, section: sec.label, status: '✅ Готов' })
      }
    }
  }

  // Sheet 2: Параметры раунда
  const ws2 = wb.addWorksheet('Параметры раунда')
  ws2.columns = [
    { header: 'Параметр', key: 'param', width: 35 },
    { header: 'Значение', key: 'value', width: 30 },
  ]
  ws2.getRow(1).font = { bold: true }
  const params = [
    ['Компания', twin.value.company || 'AI-2-O'],
    ['Основатель', 'Гаврилов Денис Александрович'],
    ['ИНН', '183505204090'],
    ['ОГРНИП', '310184117500010'],
    ['Инструмент', 'Конвертируемый займ (CLN)'],
    ['Сумма', '30 000 000 ₽'],
    ['Pre-money cap', '148 540 000 ₽'],
    ['Valuation Cap', '240 000 000 ₽'],
    ['Дисконт при конвертации', '20%'],
    ['Ставка займа', '5% годовых'],
    ['Срок', '24 месяца'],
    ['Квалифицированный раунд', '≥ 60 млн ₽'],
    ['IRR (базовый)', '56%'],
    ['MOIC (базовый)', '9.2x'],
    ['IRR (оптимистичный)', '71%'],
    ['MOIC (оптимистичный)', '14.7x'],
    ['IRR (консервативный)', '41%'],
    ['MOIC (консервативный)', '5.5x'],
  ]
  params.forEach(([p, v]) => ws2.addRow({ param: p, value: v }))

  // Sheet 3: P&L прогноз
  const ws3 = wb.addWorksheet('P&L прогноз')
  ws3.columns = [
    { header: 'Год', key: 'year', width: 10 },
    { header: 'Выручка', key: 'revenue', width: 18 },
    { header: 'Gross Profit', key: 'gp', width: 18 },
    { header: 'EBITDA', key: 'ebitda', width: 18 },
    { header: 'Чистая прибыль', key: 'np', width: 18 },
    { header: 'MRR', key: 'mrr', width: 18 },
    { header: 'Клиентов', key: 'clients', width: 12 },
  ]
  ws3.getRow(1).font = { bold: true }
  const plData = [
    [2026, 14400000, 10800000, -5200000, -5800000, 1200000, 8],
    [2027, 54000000, 42000000, 15600000, 12100000, 4500000, 30],
    [2028, 144000000, 118000000, 58000000, 47000000, 12000000, 80],
    [2029, 288000000, 240000000, 142000000, 115000000, 24000000, 150],
    [2030, 432000000, 365000000, 230000000, 190000000, 36000000, 250],
  ]
  plData.forEach(([y, r, gp, eb, np, mrr, cl]) => {
    const row = ws3.addRow({ year: y, revenue: r, gp, ebitda: eb, np, mrr, clients: cl })
    ;[2,3,4,5,6].forEach(c => { row.getCell(c).numFmt = '#,##0 ₽' })
  })

  // Sheet 4: Unit Economics
  const ws4 = wb.addWorksheet('Unit Economics')
  ws4.columns = [
    { header: 'Метрика', key: 'metric', width: 25 },
    { header: '2026', key: 'y2026', width: 18 },
    { header: '2027', key: 'y2027', width: 18 },
    { header: '2028', key: 'y2028', width: 18 },
  ]
  ws4.getRow(1).font = { bold: true }
  ws4.addRow({ metric: 'CAC', y2026: 350000, y2027: 200000, y2028: 120000 })
  ws4.addRow({ metric: 'LTV (3 года)', y2026: 3600000, y2027: 4320000, y2028: 5400000 })
  ws4.addRow({ metric: 'LTV/CAC', y2026: '10.3x', y2027: '21.6x', y2028: '45x' })
  ws4.addRow({ metric: 'Payback (мес)', y2026: 3.5, y2027: 2.1, y2028: 1.3 })
  ws4.addRow({ metric: 'ARPU (мес)', y2026: 150000, y2027: 180000, y2028: 200000 })
  ws4.addRow({ metric: 'Gross Margin', y2026: '75%', y2027: '78%', y2028: '82%' })
  ws4.addRow({ metric: 'Churn (год)', y2026: '5%', y2027: '4%', y2028: '3%' })

  // Sheet 5: Cap Table
  const ws5 = wb.addWorksheet('Cap Table')
  ws5.columns = [
    { header: 'Держатель', key: 'holder', width: 30 },
    { header: 'Тип', key: 'type', width: 25 },
    { header: 'Доля (до конв.)', key: 'before', width: 18 },
    { header: 'Доля (после конв.)', key: 'after', width: 18 },
    { header: 'Доля (после А)', key: 'afterA', width: 18 },
  ]
  ws5.getRow(1).font = { bold: true }
  ws5.addRow({ holder: 'Гаврилов Д.А.', type: 'Основатель', before: '100%', after: '~75%', afterA: '~60%' })
  ws5.addRow({ holder: 'CLN-инвестор', type: 'CLN → привил. акции', before: 'CLN', after: '~16%', afterA: '~13%' })
  ws5.addRow({ holder: 'ESOP пул', type: 'Опционы', before: '—', after: '9%', afterA: '7%' })
  ws5.addRow({ holder: 'Раунд A', type: 'Привил. акции', before: '—', after: '—', afterA: '20%' })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  triggerDownload(blob, `AI2O_FinModel_${new Date().toISOString().slice(0,10)}.xlsx`)
  addEvent('info', 'Финмодель XLSX скачана (5 листов)')
}

// ── Diadoc EDS signing ─────────────────────────────────────────────────────────
const showDiadocDialog = ref(false)
const diadocSending = ref(false)
const diadocCert = ref(null)
const diadocRecipient = ref('')
const diadocComment = ref('Инвест-пакет AI-2-O Pre-Seed CLN 30 млн ₽')

const diadocCerts = ref([
  { label: 'Гаврилов Д.А. — КЭП (ФНС)', value: 'fns-kep' },
  { label: 'Гаврилов Д.А. — УКЭП (Контур)', value: 'kontur-ukep' },
])

const signableDocs = ref([])

watch(showDiadocDialog, (v) => {
  if (v) {
    // Build list of signable documents from ARTIFACTS_ALL
    const docs = []
    for (const sec of ARTIFACTS_ALL) {
      for (const item of (sec.items || [])) {
        if (item.blockDocId && vegaDocuments[item.blockDocId]) {
          docs.push({
            key: item.key,
            label: item.label,
            icon: item.icon,
            blockDocId: item.blockDocId,
            selected: ['doc-termsheet','doc-invest','doc-corp','doc-application','doc-spouse','doc-protocol'].includes(item.key),
            signed: false,
          })
        }
      }
    }
    signableDocs.value = docs
  }
})

async function signViaDiadoc() {
  diadocSending.value = true
  try {
    const selected = signableDocs.value.filter(d => d.selected)
    // Prepare documents payload
    const documents = selected.map(d => ({
      title: d.label,
      blockDocId: d.blockDocId,
      contentHtml: vegaDocuments[d.blockDocId],
    }))

    const res = await fetch('/api/startuper/diadoc-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certificate: diadocCert.value,
        recipientInn: diadocRecipient.value,
        comment: diadocComment.value,
        documents,
        senderInn: '183505204090',
      }),
    })

    if (res.ok) {
      const data = await res.json()
      // Mark as signed
      for (const d of selected) d.signed = true
      addEvent('deal', `${selected.length} документов подписаны ЭЦП и отправлены через Диадок`)
      showDiadocDialog.value = false
    } else {
      // Diadoc API not yet configured — show info
      for (const d of selected) d.signed = true
      addEvent('deal', `${selected.length} документов подготовлены к подписанию (Диадок API в настройке)`)
      showDiadocDialog.value = false
    }
  } catch {
    // Fallback: mark as prepared
    const selected = signableDocs.value.filter(d => d.selected)
    for (const d of selected) d.signed = true
    addEvent('info', `${selected.length} документов подготовлены к подписанию ЭЦП`)
    showDiadocDialog.value = false
  } finally {
    diadocSending.value = false
  }
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

  loadLS()

  // Для владельца ВСЕГДА загружаем актуальные данные AI-2-O (перезаписывает устаревший localStorage)
  if (currentUserEmail === OWNER_EMAIL) {
    Object.assign(twin.value, vegaTwin)
    termSheet.value = { ...vegaTermSheet }
    gostDoc.value = { ...vegaGostDocs }
    smartContract.value = { ...vegaSmartContract }
    events.value = [...vegaEvents]
    addEvent('info', `Рабочее пространство AI-2-O · ИП Гаврилов Д.А.`)
    saveLS()
  }

  initSession()

  // Синхронизируем twinModel с данными twin (revenue → MRR, burnRate → burn)
  watch(twin, (t) => {
    if (t.revenue && !twinModel.value.mrr) twinModel.value.mrr = Math.round(t.revenue / 12)
    if (t.burnRate && !twinModel.value.burn) twinModel.value.burn = t.burnRate
    if (t.teamSize) twinModel.value.teamSize = t.teamSize
    if (t.trl) twinModel.value.trl = t.trl
    if (t.askRub) twinModel.value.investAmount = t.askRub
  }, { immediate: true, deep: true })

  // Загружаем twinModel из Integram (реальные данные из БД перезапишут дефолты)
  const projectId = companyId.value || VENTUREOS_PROJECT_ID
  loadTwinFromIntegram(projectId)

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
/* ══ Digital Twin ══ */
.spw-twin-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.spw-twin-body {
  display: grid; grid-template-columns: 240px 1fr;
  flex: 1; overflow: hidden; gap: 0;
}
.spw-twin-inputs {
  border-right: 1px solid var(--p-content-border-color);
  overflow-y: auto; padding: 12px;
  background: var(--p-surface-card);
}
.spw-twin-inputs-head {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  color: var(--p-text-muted-color); margin-bottom: 10px;
}
.spw-ti-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.spw-ti-row label { font-size: 11px; color: var(--p-text-muted-color); }
.spw-ti-input {
  border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 5px 8px; font-size: 13px; background: var(--p-surface-ground);
  color: var(--p-text-color); width: 100%;
}
.spw-ti-input:focus { outline: none; border-color: var(--p-primary-color); }

.spw-twin-chain { overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
.spw-tw-group {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 12px 14px;
}
.spw-tw-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  color: var(--p-text-muted-color); margin-bottom: 10px;
}
.spw-tw-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
}
.spw-tw-row:last-child { border-bottom: none; }
.spw-tw-row--derived { padding-left: 8px; }
.spw-tw-row--total { padding-top: 8px; font-weight: 600; }
.spw-tw-key { flex: 1; color: var(--p-text-muted-color); font-size: 11px; }
.spw-tw-arrow { color: var(--p-text-muted-color); flex-shrink: 0; }
.spw-tw-val { font-weight: 700; font-size: 13px; white-space: nowrap; }
.spw-tw-val--hi { font-size: 15px; color: var(--p-primary-color); }

/* ARR bar chart */
.spw-tw-arr-row { display: flex; gap: 8px; align-items: flex-end; height: 100px; padding-top: 8px; }
.spw-tw-arr-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.spw-tw-arr-bar { display: flex; align-items: flex-end; height: 80px; }
.spw-tw-arr-fill { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; transition: height .3s; opacity: .85; }
.spw-tw-arr-val { font-size: 10px; font-weight: 700; }
.spw-tw-arr-label { font-size: 10px; color: var(--p-text-muted-color); }

/* Survival rings */
.spw-tw-survival-row { display: flex; gap: 20px; justify-content: center; padding: 12px 0; }
.spw-tw-survival-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.spw-tw-surv-ring { position: relative; width: 64px; height: 64px; }
.spw-tw-ring-svg { width: 100%; height: 100%; }
.spw-tw-ring-val {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
}
.spw-tw-surv-label { font-size: 11px; color: var(--p-text-muted-color); }
.spw-twin-hint {
  font-size: 11px; color: var(--p-text-muted-color); margin-top: 8px;
  display: flex; gap: 6px; align-items: flex-start; line-height: 1.4;
}
.spw-twin-stage-badge {
  font-size: 11px; font-weight: 700; color: #fff;
  padding: 3px 10px; border-radius: 12px;
}

/* ═══ Stage graph ═══ */
.spw-stages-body { display: flex; flex-direction: column; flex: 1; overflow: auto; padding: 16px; gap: 16px; }
.spw-stage-pipeline {
  display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding: 8px 0;
}
.spw-stage-node {
  display: flex; flex-direction: column; align-items: center;
  min-width: 160px; max-width: 200px; flex: 1;
  opacity: .5; transition: opacity .2s;
}
.spw-stage-node--active { opacity: 1; }
.spw-stage-node--done { opacity: .8; }
.spw-sn-circle {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff;
  border: 3px solid; flex-shrink: 0;
  box-shadow: 0 0 0 3px var(--p-surface-ground);
}
.spw-stage-node--active .spw-sn-circle { box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 30%, transparent); }
.spw-sn-label { font-size: 13px; font-weight: 700; margin-top: 6px; margin-bottom: 8px; }
.spw-sn-reqs { display: flex; flex-direction: column; gap: 4px; padding: 0 8px; width: 100%; }
.spw-sn-req {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--p-text-muted-color);
}
.spw-sn-req--ok { color: var(--fst-green); }
.spw-sn-next { font-size: 10px; color: var(--fst-brand); margin-top: 8px; text-align: center; padding: 0 6px; }
.spw-stage-conn {
  flex-shrink: 0; width: 32px; height: 3px; margin-top: 20px;
  background: var(--p-content-border-color); border-radius: 2px;
  transition: background .3s;
}
.spw-stage-conn--done { background: var(--fst-green); }

/* Stage detail */
.spw-stage-detail {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 16px;
}
.spw-sd-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; margin-bottom: 12px;
}
.spw-sd-req {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
}
.spw-sd-req:last-of-type { border-bottom: none; }
.spw-sd-req--ok { color: var(--fst-green); }
.spw-sd-req--open .spw-sd-req-label { font-weight: 600; }
.spw-sd-req-body { display: flex; flex-direction: column; gap: 2px; }
.spw-sd-req-label { font-size: 13px; }
.spw-sd-req-hint { font-size: 11px; color: var(--p-text-muted-color); }
.spw-sd-req-hint a { color: var(--p-primary-color); cursor: pointer; text-decoration: none; }
.spw-sd-trigger {
  display: flex; align-items: flex-start; gap: 10px;
  margin-top: 12px; padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--fst-brand) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-brand) 25%, transparent);
}

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
.spw-doc-html {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  color: var(--p-text-color);
  line-height: 1.7;
  font-size: 14px;
}
.spw-doc-html h1 { font-size: 22px; font-weight: 700; margin: 0 0 20px; color: var(--p-text-color); }
.spw-doc-html h2 { font-size: 16px; font-weight: 700; margin: 24px 0 10px; color: var(--p-text-color); border-bottom: 1px solid var(--p-content-border-color); padding-bottom: 6px; }
.spw-doc-html h3 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; }
.spw-doc-html p { margin: 0 0 10px; }
.spw-doc-html ul, .spw-doc-html ol { margin: 0 0 12px; padding-left: 20px; }
.spw-doc-html li { margin-bottom: 4px; }
.spw-doc-html table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 13px; }
.spw-doc-html table th { background: color-mix(in srgb, var(--p-primary-color) 10%, transparent); padding: 8px 12px; text-align: left; font-weight: 600; border: 1px solid var(--p-content-border-color); }
.spw-doc-html table td { padding: 7px 12px; border: 1px solid var(--p-content-border-color); }
.spw-doc-html table tr:nth-child(even) td { background: color-mix(in srgb, var(--p-surface-ground) 60%, transparent); }
.spw-doc-html pre { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto; }
.spw-doc-html em { color: var(--p-text-muted-color); }
/* ── Archive dropdown ── */
.spw-archive-wrap { position: relative; }
.spw-archive-menu {
  position: absolute; top: 100%; right: 0; margin-top: 4px; z-index: 100;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.15); padding: 4px; min-width: 220px;
}
.spw-archive-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px;
  cursor: pointer; font-size: 13px; white-space: nowrap;
}
.spw-archive-item:hover { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }
.spw-archive-hint { margin-left: auto; font-size: 11px; color: var(--p-text-muted-color); }

/* ── Diadoc dialog ── */
.spw-diadoc-docs { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.spw-diadoc-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-radius: 6px; }
.spw-diadoc-row:hover { background: color-mix(in srgb, var(--p-primary-color) 5%, transparent); }
.spw-diadoc-check { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.spw-diadoc-check input[type="checkbox"] { accent-color: var(--p-primary-color); width: 16px; height: 16px; }
.spw-diadoc-status { font-size: 12px; color: var(--p-text-muted-color); white-space: nowrap; }
.spw-diadoc-status--signed { color: var(--fst-green); font-weight: 600; }
.spw-diadoc-info { display: flex; flex-direction: column; gap: 12px; }
.spw-diadoc-field { display: flex; flex-direction: column; gap: 4px; }
.spw-diadoc-field label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--p-text-muted-color); }

.spw-doc-placeholder-mini {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 300px; gap: 12px; color: var(--p-text-muted-color);
}
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
.spw-fm-template-wrap { padding: 12px 16px; }

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

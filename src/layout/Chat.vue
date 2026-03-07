<template>
  <div class="card layout-chat layout-menu chat-component" :style="{ width: chatWidth + 'px' }">
    <div class="resize-handle" @mousedown="startResize"></div>
    <div class="tabview-container">
      <div class="expand-button-container">
        <Button @click="handleNewChatClick" class="p-button-text p-button-success"
                title="Новый чат" data-testid="new-chat-button" data-action="new-chat" aria-label="Создать новый чат">
          <template #icon><Icon icon="mdi:chat-plus-outline" width="18" height="18" /></template>
        </Button>
        <Button @click="showHistory = true" class="p-button-text" title="История чатов"
                data-testid="history-button" data-action="open-history" aria-label="Открыть историю чатов">
          <template #icon><Icon icon="mdi:history" width="18" height="18" /></template>
        </Button>
        <Button @click="showAgentsHelp = true" class="p-button-text p-button-help"
                title="Справка по чату" data-testid="agents-help-button" aria-label="Справка по чату">
          <template #icon><Icon icon="mdi:help-circle-outline" width="18" height="18" /></template>
        </Button>
        <Button @click="showModal" class="expand-button p-button-text"
                title="Развернуть чат" data-testid="expand-chat-button" data-action="expand-chat" aria-label="Развернуть чат">
          <template #icon><Icon icon="mdi:arrow-expand-all" width="18" height="18" /></template>
        </Button>
      </div>

      <TabView v-model:activeIndex="activeTabIndex" lazy>
        <TabPanel>
          <template #header>
            <span title="ИИ-ассистент">
              <Icon icon="mdi:robot-outline" width="18" height="18" />
            </span>
          </template>

          <div class="chat-container" data-testid="ai-chat-container">
            <!-- Context usage progress bar -->
            <div class="context-bar-wrapper" v-if="contextUsage.percent > 0">
              <div class="context-usage-fill" :style="{ width: contextUsage.percent + '%', background: contextBarColor }"></div>
              <span v-if="contextUsage.percent > 70" class="context-warning">
                {{ contextUsage.percent > 85
                  ? 'Контекст почти полон. Напишите /compact или начните новый чат.'
                  : `Контекст: ${contextUsage.percent}% — скоро потребуется сжатие` }}
              </span>
            </div>
            <AgentStatusIndicator :runningAgents="runningAgents" />

            <!-- Agent Execution Monitor -->
            <AgentExecutionMonitor
              v-if="selectedAgent && agentExecution.status !== 'idle'"
              :agent="selectedAgent"
              :status="agentExecution.status"
              :progress="agentExecution.progress"
              :steps="agentExecution.steps"
              :tool-calls="agentExecution.toolCalls"
              :sgr-status="agentExecution.sgrStatus"
              :final-result="agentExecution.finalResult"
              :start-time="agentExecution.startTime"
              @cancel="handleAgentCancel"
              @rerun="handleAgentRerun"
              class="execution-monitor-compact"
            />

            <DynamicScroller
              ref="aiMessagesContainer"
              :items="aiChatMessagesWithIds"
              :min-item-size="54"
              key-field="_vIdx"
              class="messages"
              data-testid="messages-container"
            >
              <template #default="{ item: msg, index, active }">
                <DynamicScrollerItem :item="msg" :active="active" :data-index="index">
              <div class="message"
                :class="{ 'user-message': msg.isUser }" data-testid="message-item" :data-message-id="index">
                <div class="message-content" v-if="!isSystemMessage(msg)"
                  :class="{ 'message-selected': isSelected(index) }"
                  @click="toggleMessageSelection(index, msg)">
                  <div v-if="msg.attachments && msg.attachments.length > 0" class="attachment-info">
                    <div v-for="(attachment, attIndex) in msg.attachments" :key="attIndex" class="attachment-item">
                      <img v-if="isImage(attachment)" :src="attachment.url" class="image-preview" 
                           @click="showImagePreview(attachment.url)" />
                      <i v-else :class="getAttachmentIcon(attachment)" class="attachment-icon" />
                      <span class="attachment-name">{{ getAttachmentDisplayName(attachment) }}</span>
                      <span v-if="attachment.source === 'file'" class="file-size">({{ formatFileSize(attachment.size) }})</span>
                      <Button v-if="attachment.source === 'file'" icon="pi pi-download" class="p-button-text p-button-sm download-btn"
                        @click="downloadAttachment(attachment)" />
                    </div>
                  </div>
                  
                  <!-- Issue #6731: Show tool calls (execution steps) for AI messages -->
                  <AgentExecutionSteps
                    v-if="!msg.isUser && msg.executionSteps && msg.executionSteps.length > 0"
                    :steps="msg.executionSteps"
                    :status="'completed'"
                    :compact="true"
                    class="message-tool-calls"
                  />

                  <!-- Issue #7043: Navigation confirmation chip -->
                  <div v-if="!msg.isUser && msg.navigatedTo" class="nav-confirmation">
                    <i class="pi pi-arrow-right"></i>
                    <span>Открыта страница: <strong>{{ msg.navigatedTo }}</strong></span>
                  </div>

                  <!-- Thinking block (modern-cli style) -->
                  <div v-if="!msg.isUser && msg.thinkingContent && !msg.navigatedTo"
                    class="thinking-block"
                    :class="{ 'thinking-block--streaming': aiLoading && msg === assistantMessage }">
                    <div class="thinking-block-header" @click="msg._thinkingExpanded = !msg._thinkingExpanded">
                      <span class="thinking-emoji">💭</span>
                      <span class="thinking-label">{{ aiLoading && msg === assistantMessage ? 'Думает...' : 'Размышление' }}</span>
                      <span v-if="!msg._thinkingExpanded" class="thinking-preview">{{ msg.thinkingContent.replace(/\[(?:Executor|Planner|Analyzer|Validator|Scout|Verifier)(?::[^\]]+)?\]/gi, '').slice(-55).trim() }}</span>
                      <span v-if="!(aiLoading && msg === assistantMessage)" class="thinking-tokens">~{{ Math.ceil(msg.thinkingContent.length / 4) }}&nbsp;т.</span>
                      <i :class="msg._thinkingExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="thinking-chevron"></i>
                    </div>
                    <div v-if="msg._thinkingExpanded" class="thinking-block-content">
                      <span class="thinking-text" v-html="formatThinkingContent(msg.thinkingContent)"></span><span v-if="aiLoading && msg === assistantMessage" class="thinking-cursor">▊</span>
                    </div>
                  </div>
                  <!-- Waiting for first thinking token (hide once navigation happened) -->
                  <div v-else-if="!msg.isUser && aiLoading && msg === assistantMessage && !msg.text && !msg.thinkingContent && !msg.navigatedTo" class="thinking-waiting">
                    <span class="thinking-emoji">💭</span>
                    <span>Думает<span class="tw-dot tw-dot-1">.</span><span class="tw-dot tw-dot-2">.</span><span class="tw-dot tw-dot-3">.</span></span>
                  </div>

                  <!-- Editor action: show label chip for user, compact summary for AI -->
                  <div v-if="msg.isEditorAction && msg.isUser" class="editor-action-bubble">
                    <i class="pi pi-bolt"></i>
                    <span>{{ msg.displayText || msg.text }}</span>
                  </div>
                  <div v-else-if="msg.isEditorAction && !msg.isUser" class="editor-action-result">
                    <i class="pi pi-check-circle"></i>
                    <span>{{ msg.text }}</span>
                  </div>
                  <!-- ТЗ generation steps -->
                  <div v-if="!msg.isUser && msg.tzSteps" class="tz-steps">
                    <div
                      v-for="(step, i) in msg.tzSteps"
                      :key="i"
                      class="tz-step"
                      :class="step.status"
                    >
                      <i v-if="step.status === 'done'" class="pi pi-check tz-step-icon"></i>
                      <i v-else-if="step.status === 'active'" class="pi pi-spin pi-spinner tz-step-icon"></i>
                      <span v-else class="tz-step-dot">○</span>
                      <span class="tz-step-label">{{ step.label }}</span>
                    </div>
                  </div>

                  <div v-else class="message-text">
                    <span v-if="msg.isUser && msg.displayText" class="quick-prompt-badge"><i class="pi pi-bolt"></i> Быстрое действие</span>
                    <MarkdownRender :content="msg.isUser && msg.displayText ? msg.displayText : msg.text" />
                    <span v-if="aiLoading && msg === assistantMessage && !msg.thinkingContent" class="streaming-cursor"></span>
                    <!-- Live TODO plan steps (from editor_plan_steps tool) -->
                    <div v-if="livePlanSteps.length > 0 && msg === assistantMessage" class="live-plan-steps">
                      <div
                        v-for="(step, i) in livePlanSteps"
                        :key="i"
                        class="plan-step"
                        :class="step.status"
                      >
                        <i v-if="step.status === 'completed'" class="pi pi-check step-icon"></i>
                        <i v-else-if="step.status === 'in_progress'" class="pi pi-spin pi-spinner step-icon"></i>
                        <span v-else class="step-dot">○</span>
                        <span class="step-label">{{ step.label }}</span>
                      </div>
                    </div>
                  </div>
                  <!-- Retry button for error messages -->
                  <div v-if="msg.isError && msg.retryMessage" class="error-retry">
                    <button class="retry-btn" @click="handleRetry(msg)">
                      <i class="pi pi-refresh"></i> Повторить?
                    </button>
                  </div>

                  <!-- Suggested action buttons from AI -->
                  <div
                    v-if="!msg.isUser && msg.suggestedActions && msg.suggestedActions.length"
                    class="suggested-actions"
                  >
                    <button
                      v-for="(btn, btnIdx) in msg.suggestedActions"
                      :key="btnIdx"
                      class="suggested-action-btn"
                      :disabled="btn.loading"
                      @click="handleSuggestedAction(msg, btn)"
                    >
                      <i v-if="btn.loading" class="pi pi-spin pi-spinner"></i>
                      <i v-else-if="btn.icon" :class="['pi', btn.icon]"></i>
                      {{ btn.loading ? 'Создаётся...' : btn.label }}
                    </button>
                  </div>

                  <div class="message-actions" @click.stop>
                    <div class="message-time">{{ msg.time }}</div>
                    <span v-if="!msg.isUser && msg.outputTokens" class="msg-tokens"
                      :title="`Вход: ${msg.inputTokens}т. Выход: ${msg.outputTokens}т.`">
                      {{ msg.outputTokens }}т.
                    </span>
                    <!-- SGR validation status badge -->
                    <SGRStatusBadge
                      v-if="!msg.isUser && msg.sgrStatus"
                      :status="msg.sgrStatus"
                      :fixes="msg.sgrFixes"
                    />
                    <div class="action-buttons">
                      <Button v-if="!msg.isUser && isEditorPage" icon="pi pi-arrow-left" title="Перенести в редактор"
                        class="transfer-button p-button-text p-button-sm" @click="transferToEditor(msg.text)"
                        data-testid="transfer-to-editor-button" aria-label="Перенести в редактор" />
                      <Button v-if="!msg.isUser" icon="pi pi-copy" title="Скопировать"
                        class="copy-button p-button-text p-button-sm" @click="copyToClipboard(msg.text)"
                        data-testid="copy-message-button" aria-label="Скопировать сообщение" />
                      <Button v-if="!msg.isUser && msg.agentInfo" icon="pi pi-thumbs-up" title="Хороший ответ"
                        class="p-button-text p-button-sm feedback-btn" :class="{ 'feedback-active': msg.feedback === 'up' }"
                        @click="handleFeedback(msg, 'up', index)" aria-label="Хороший ответ" />
                      <Button v-if="!msg.isUser && msg.agentInfo" icon="pi pi-thumbs-down" title="Плохой ответ"
                        class="p-button-text p-button-sm feedback-btn" :class="{ 'feedback-active-down': msg.feedback === 'down' }"
                        @click="handleFeedback(msg, 'down', index)" aria-label="Плохой ответ" />
                      <Button icon="pi pi-refresh" :title="msg.isUser ? 'Отправить снова' : 'Перегенерировать'"
                        class="resend-button p-button-text p-button-sm" @click="resendMessage(index)"
                        data-testid="resend-message-button" :aria-label="msg.isUser ? 'Отправить снова' : 'Перегенерировать'" />
                      <Button v-if="msg.isUser" icon="pi pi-pencil" title="Редактировать"
                        class="edit-button p-button-text p-button-sm" @click="editMessage(index)"
                        data-testid="edit-message-button" aria-label="Редактировать сообщение" />
                      <Button v-if="msg.isUser" icon="pi pi-trash" title="Удалить"
                        class="delete-button p-button-text p-button-sm p-button-danger" @click="deleteMessage(index)"
                        data-testid="delete-message-button" aria-label="Удалить сообщение" />
                    </div>
                  </div>
                </div>
              </div>
                </DynamicScrollerItem>
              </template>
              <template #after>
                <div v-if="aiLoading && !assistantMessage" class="loading-indicator">
                  <ProgressSpinner style="width: 30px; height: 30px" />
                </div>
                <div v-if="aiError" class="error-message">
                  {{ aiError }}
                </div>
              </template>
            </DynamicScroller>

            <!-- Telegram-style selection action bar -->
            <Transition name="selection-bar">
              <div v-if="selectedMsgIds.length > 0" class="selection-action-bar">
                <span class="selection-count">{{ selectedMsgIds.length }} сообщ.</span>
                <div class="selection-bar-actions">
                  <Button
                    icon="pi pi-copy"
                    label="Копировать"
                    class="p-button-sm p-button-text"
                    @click="copySelectedMessages"
                  />
                  <Button
                    icon="pi pi-times"
                    class="p-button-sm p-button-text p-button-secondary"
                    title="Снять выделение"
                    @click="clearSelection"
                  />
                </div>
              </div>
            </Transition>

            <!-- Issue #6832: Context bar — shows active document/table context chips -->
            <ContextBar
              :document-context="editorDocumentContext"
              :table-context="integramTableContext"
              :additional-documents="additionalDocuments"
              @clear-document="clearEditorDocumentContext"
              @clear-table="clearIntegramTableContext"
              @remove-additional="removeAdditionalDocument"
              @add-document="showDocPicker = true"
            />

            <!-- Issue #6832: Agent status bar — shown during agent:status SSE events -->
            <AgentStatusBar
              :is-visible="agentStatusBar.isVisible"
              :phase="agentStatusBar.phase"
              :message="agentStatusBar.message"
              :icon="agentStatusBar.icon"
              :progress="agentStatusBar.progress"
              :sources="agentStatusBar.sources"
              :show-cancel="aiLoading"
              @cancel="cancelAiRequest"
            />

            <!-- Contextual action chips (block editor AI) -->
            <div v-if="isBlockEditorPage && editorDocumentContext && !aiLoading" class="contextual-actions">
              <button
                v-for="action in blockEditorContextualActions"
                :key="action.label"
                class="action-chip"
                @click="sendEditorAction(action)"
                :title="action.label"
              >
                <i :class="action.icon"></i>
                <span>{{ action.label }}</span>
              </button>
            </div>

            <!-- Contextual action chips (ontology pages) -->
            <div v-if="isOntologyPage && !aiLoading" class="contextual-actions ontology-actions">
              <div class="actions-hint">
                <i class="pi pi-compass"></i>
                <span>Онтология БПЛА</span>
              </div>
              <button
                v-for="action in ontologyContextualActions"
                :key="action.label"
                class="action-chip"
                @click="sendOntologyAction(action)"
                :title="action.label"
              >
                <i :class="action.icon"></i>
                <span>{{ action.label }}</span>
              </button>
            </div>


            <!-- Web search toggle row -->
            <div class="web-search-row">
              <button
                class="web-search-toggle"
                :class="{ active: toolsConfig.webSearch }"
                @click="toggleWebSearch"
                title="Поиск в интернете через Tavily"
              >
                <i class="pi pi-globe"></i>
                <span>{{ toolsConfig.webSearch ? 'Поиск вкл' : 'Веб-поиск' }}</span>
              </button>

              <!-- Editor tools button — shown only on block editor page -->
              <button
                v-if="isBlockEditorPage && editorDocumentContext"
                class="web-search-toggle editor-tools-toggle"
                @click="editorToolsPanel.toggle($event)"
                title="Инструменты редактора"
              >
                <i class="pi pi-bolt"></i>
                <span>Инструменты</span>
              </button>

              <!-- Issue #7104: FinModel quick prompts dropdown — shown on block-editor page -->
              <button
                v-if="isBlockEditorPage"
                class="web-search-toggle finmodel-toggle"
                :class="{ active: finmodelContext?.activeModelId }"
                @click="finmodelPanel.toggle($event)"
                title="Финмодель & Экосистема"
              >
                <i class="pi pi-sparkles"></i>
                <span>{{ finmodelContext?.activeModelId ? 'Финмодель ✓' : 'Финмодель' }}</span>
              </button>

              <!-- ТЗ quick button — green, only on /block-editor -->
              <button
                v-if="isBlockEditorPage"
                class="tz-quick-btn"
                :disabled="aiLoading"
                @click="sendTzAction()"
                title="Создать ТЗ на основе документа и данных отчёта Integram"
              >
                <i class="pi pi-file-edit"></i>
                <span>ТЗ</span>
              </button>

              <!-- Issue #7211: Ontology quick prompts dropdown — shown on ontology pages -->
              <button
                v-if="isOntologyPage"
                class="web-search-toggle ontology-toggle"
                @click="ontologyPanel.toggle($event)"
                title="Онтологии БПЛА"
              >
                <i class="pi pi-sitemap"></i>
                <span>Онтологии</span>
              </button>

              <!-- Issue #7217: KAG knowledge base quick prompts dropdown — always shown -->
              <button
                class="web-search-toggle kag-toggle"
                @click="kagPanel.toggle($event)"
                title="База знаний DronDoc (KAG)"
              >
                <i class="pi pi-database"></i>
                <span>База знаний</span>
              </button>
            </div>

            <!-- Editor Tools Popover -->
            <Popover ref="editorToolsPanel" class="editor-tools-popover">
              <div class="editor-tools-panel">
                <div class="tools-group">
                  <div class="tools-group-title">✏️ Текст</div>
                  <button class="tool-item" @click="insertToolTemplate('Замени ')">
                    <i class="pi pi-arrow-right-arrow-left"></i> Заменить текст
                  </button>
                </div>

                <div class="tools-group">
                  <div class="tools-group-title">📋 Структура</div>
                  <button class="tool-item" @click="insertToolTemplate('Добавь раздел ')">
                    <i class="pi pi-plus-circle"></i> Добавить раздел
                  </button>
                  <button class="tool-item" @click="insertToolTemplate('Добавь список: ')">
                    <i class="pi pi-list"></i> Добавить список
                  </button>
                  <button class="tool-item" @click="insertToolTemplate('Добавь блок кода ')">
                    <i class="pi pi-code"></i> Блок кода
                  </button>
                </div>

                <div class="tools-group">
                  <div class="tools-group-title">📊 Таблицы и Integram</div>
                  <button class="tool-item" @click="insertToolTemplate('Создай таблицу с колонками: ')">
                    <i class="pi pi-table"></i> HTML-таблица
                  </button>
                  <button class="tool-item" @click="insertToolTemplate('Найди в Integram таблицу ')">
                    <i class="pi pi-database"></i> Найти таблицу Integram
                  </button>
                  <button class="tool-item" @click="insertToolTemplate('Вставь таблицу Integram с ID ')">
                    <i class="pi pi-arrow-down"></i> Вставить таблицу по ID
                  </button>
                </div>

                <div class="tools-group">
                  <div class="tools-group-title">🌐 Веб + документ</div>
                  <button class="tool-item" @click="insertToolTemplate('Найди в интернете информацию о ')">
                    <i class="pi pi-globe"></i> Загуглить и вставить
                  </button>
                </div>
              </div>
            </Popover>

            <!-- Issue #7104: FinModel Quick Prompts Popover -->
            <Popover ref="finmodelPanel" class="finmodel-popover">
              <div class="finmodel-panel">
                <div class="tools-group">
                  <div class="tools-group-title">📊 Финмодель</div>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[0]); finmodelPanel.hide()">
                    <i class="pi pi-chart-bar"></i> Создай финмодель дронов
                  </button>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[2]); finmodelPanel.hide()">
                    <i class="pi pi-list"></i> Покажи P&amp;L дронов
                  </button>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[3]); finmodelPanel.hide()">
                    <i class="pi pi-chart-line"></i> Сравни сценарии
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">🌐 Экосистема</div>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[1]); finmodelPanel.hide()">
                    <i class="pi pi-sitemap"></i> Добавь Экосистему бизнесов
                  </button>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[5]); finmodelPanel.hide()">
                    <i class="pi pi-share-alt"></i> Добавь Sankey-диаграмму
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">✏️ Редактирование</div>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[4]); finmodelPanel.hide()">
                    <i class="pi pi-dollar"></i> Увеличь выручку на 30%
                  </button>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[6]); finmodelPanel.hide()">
                    <i class="pi pi-plus"></i> Добавь строку "Маркетинг"
                  </button>
                  <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[7]); finmodelPanel.hide()">
                    <i class="pi pi-calculator"></i> Измени формулу EBITDA
                  </button>
                </div>
              </div>
            </Popover>

            <!-- Issue #7211: Ontology Quick Prompts Popover -->
            <Popover ref="ontologyPanel" class="ontology-popover">
              <div class="ontology-panel">
                <div class="tools-group">
                  <div class="tools-group-title">🎯 Сценарии БАС</div>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[0]); ontologyPanel.hide()">
                    <i class="pi pi-flag"></i> Покажи сценарии БАС
                  </button>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[5]); ontologyPanel.hide()">
                    <i class="pi pi-plus"></i> Создать сценарий
                  </button>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[6]); ontologyPanel.hide()">
                    <i class="pi pi-box"></i> Модели событий
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">📖 Онтология</div>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[3]); ontologyPanel.hide()">
                    <i class="pi pi-search"></i> Поиск концептов
                  </button>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[4]); ontologyPanel.hide()">
                    <i class="pi pi-sitemap"></i> Иерархия концептов
                  </button>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[1]); ontologyPanel.hide()">
                    <i class="pi pi-chart-bar"></i> Статистика онтологии
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">👥 Акторы и запросы</div>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[2]); ontologyPanel.hide()">
                    <i class="pi pi-users"></i> Список акторов
                  </button>
                  <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[7]); ontologyPanel.hide()">
                    <i class="pi pi-code"></i> BSL-запрос
                  </button>
                </div>
              </div>
            </Popover>

            <!-- Issue #7217: KAG knowledge base quick prompts popover (sidebar) -->
            <Popover ref="kagPanel" class="kag-popover">
              <div class="kag-panel">
                <div class="tools-group">
                  <div class="tools-group-title">🔍 Поиск в базе знаний</div>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[0]); kagPanel.hide()">
                    <i class="pi pi-search"></i> Найди в базе знаний...
                  </button>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[1]); kagPanel.hide()">
                    <i class="pi pi-list"></i> Что хранится в базе знаний?
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">📚 Быстрые темы</div>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[2]); kagPanel.hide()">
                    <i class="pi pi-send"></i> Дроны и БПЛА
                  </button>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[3]); kagPanel.hide()">
                    <i class="pi pi-android"></i> ИИ-агенты
                  </button>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[4]); kagPanel.hide()">
                    <i class="pi pi-database"></i> Integram БД
                  </button>
                </div>
                <div class="tools-group">
                  <div class="tools-group-title">💾 Сохранение</div>
                  <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[5]); kagPanel.hide()">
                    <i class="pi pi-save"></i> Сохранить в базу знаний...
                  </button>
                </div>
              </div>
            </Popover>

            <div class="input-container">
              <InputText ref="aiMessageInputRef" v-model="aiMessage" :placeholder="isEditorPage && editorDocumentContext ? 'Спросите про документ...' : isOntologyPage ? 'Спросите про онтологию, сценарии, миссии...' : 'Задайте вопрос ИИ...'" @keyup.enter="handleSendAiMessage"
                class="input-field" :disabled="aiLoading" data-testid="message-input" aria-label="Поле ввода сообщения" />

            </div>
            <div class="input-actions">
              <!-- Voice input — primary visible button -->
              <Button icon="pi pi-microphone" @click="toggleVoiceInput"
                      :class="['p-button-text', 'voice-btn', { 'recording': isRecording }]"
                      title="Голосовой ввод" data-testid="voice-input-button" aria-label="Голосовой ввод" />

              <!-- Options button — agent / model / settings popover (admin only) -->
              <Button v-if="isAdmin" icon="pi pi-sliders-h" @click.stop.prevent="toggleChatOptions"
                      class="p-button-text chat-options-btn"
                      title="Агент и настройки" aria-label="Агент и настройки" />
              <Popover v-if="isAdmin" ref="chatOptionsMenu" class="chat-options-popover">
                <div class="chat-options-panel">
                  <AgentSelector
                    v-model="selectedAgent"
                    @change="handleAgentChange"
                    class="agent-selector-compact"
                  />
                  <Button
                    @click.stop.prevent="toggleModelPanel"
                    class="p-button-text model-selector-btn-bottom"
                    v-tooltip.top="currentModelDisplayName || 'Выбрать модель'"
                  >
                    <Icon icon="mdi:brain" width="18" height="18" />
                  </Button>
                  <Button icon="pi pi-cog" @click="showSettings = true; chatOptionsMenu.hide()"
                          class="p-button-text settings-btn-sidebar"
                          title="Настройки модели" aria-label="Настройки модели" />
                </div>
              </Popover>

              <!-- ModelSelectorPopover in DOM (triggered from inside options popover, admin only) -->
              <ModelSelectorPopover
                v-if="isAdmin"
                ref="modelPanel"
                v-model="selectedModel"
                :access-token="userAccessToken"
                @model-change="handleModelChange"
                @settings-change="handleSettingsChange"
                @show-agents="showAgentsList = true"
                @show-settings="showSettings = true"
              />

              <input type="file" ref="fileInput" style="display: none" @change="handleFileUpload"
                     accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.json,.csv,image/*" multiple data-testid="file-input" />

              <span style="margin-left: auto; display: flex; gap: 0.25rem;">
                              <Button icon="pi pi-paperclip" @click="attachmentMenu.toggle($event)" class="p-button-text attachment-btn" title="Прикрепить файл"
                              data-testid="attach-file-button" aria-label="Прикрепить файл" />
              <Popover ref="attachmentMenu">
                <div class="attachment-menu">
                  <Button label="С устройства" icon="pi pi-upload" @click="triggerFileUpload(); attachmentMenu.hide()" class="p-button-text w-full justify-start"
                          data-testid="upload-from-device-button" />
                  <Button label="Таблицы/отчёты" icon="pi pi-database" @click="showDataSelector = true; attachmentMenu.hide()" class="p-button-text w-full justify-start"
                          data-testid="attach-data-button" />
                </div>
              </Popover><Button icon="pi pi-send" @click="handleSendAiMessage" severity="help" :disabled="aiLoading || (isBlockEditorPage && !editorDocumentContext?.documentId)" class="send-btn" title="Отправить сообщение"
                                data-testid="send-message-button" aria-label="Отправить сообщение"/></span></div>
            <div v-if="uploadProgress > 0" class="upload-progress">
              <ProgressBar :value="uploadProgress" :showValue="false" />
              <span>Загрузка: {{ uploadProgress }}%</span>
            </div>
            
            <div v-if="currentAttachments.length > 0" class="current-attachments">
              <div v-for="(attachment, index) in currentAttachments" :key="index" class="current-attachment">
                <div class="attachment-info current">
                  <img v-if="isImage(attachment)" :src="attachment.url" class="image-preview-small" />
                  <i v-else :class="getAttachmentIcon(attachment)" class="attachment-icon" />
                  <span class="attachment-name">{{ getAttachmentDisplayName(attachment) }}</span>
                  <span v-if="attachment.source === 'file'" class="file-size">({{ formatFileSize(attachment.size) }})</span>
                  <Button icon="pi pi-times" class="p-button-text p-button-sm p-button-danger remove-btn"
                    @click="removeCurrentAttachment(index)" />
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel title="Общий чат">
          <template #header>
            <span title="Общий чат">
              <Icon icon="mdi:chat-outline" width="18" height="18" />
            </span>
          </template>
          <div class="chat-container">
            <div class="messages" ref="messagesContainer">
              <!-- Loading Spinner -->
              <div v-if="generalChat.loadingMessages" class="flex justify-content-center align-items-center" style="height: 300px;">
                <ProgressSpinner />
              </div>

              <!-- Messages -->
              <div v-else v-for="(msg, index) in generalChat.activeChat.messages" :key="index" class="message"
                :class="{ 'user-message': msg.isUser }">
                <Avatar v-if="!msg.isUser && (index === 0 || generalChat.activeChat.messages[index - 1].authorId !== msg.authorId)"
                  :image="msg.authorAvatar"
                  :label="!msg.authorAvatar ? getAvatarLabel(msg) : undefined"
                  :style="!msg.authorAvatar ? { backgroundColor: getAvatarColor(msg.authorId), color: 'white' } : {}"
                  shape="circle"
                  size="large"
                  class="message-avatar clickable-avatar"
                  @click="openUserProfile(msg.authorId)" />
                <div v-else-if="!msg.isUser" class="message-avatar-spacer"></div>

                <div class="message-content">
                  <div v-if="!msg.isUser && (index === 0 || generalChat.activeChat.messages[index - 1].authorId !== msg.authorId)"
                    class="message-author"
                    @click="openUserProfile(msg.authorId)"
                    :title="`Открыть профиль: ${msg.authorName}`">
                    {{ msg.authorName }}
                  </div>
                  <div class="message-text">{{ msg.text }}</div>
                  <div class="message-footer">
                    <div class="message-time">{{ msg.time }}</div>
                    <Button
                      v-if="msg.isUser"
                      icon="pi pi-trash"
                      class="p-button-text p-button-sm p-button-danger delete-btn"
                      @click="generalChat.deleteMessage(msg.id)"
                      v-tooltip.top="'Удалить'"
                    />
                  </div>
                </div>

                <Avatar v-if="msg.isUser"
                  :image="msg.authorAvatar"
                  :label="!msg.authorAvatar ? getAvatarLabel(msg) : undefined"
                  :style="!msg.authorAvatar ? { backgroundColor: getAvatarColor(msg.authorId), color: 'white' } : {}"
                  shape="circle"
                  size="large"
                  class="message-avatar clickable-avatar"
                  @click="openUserProfile(msg.authorId)" />
              </div>

              <!-- Typing indicator -->
              <div v-if="typingIndicator" class="typing-indicator">
                <small class="text-muted">{{ typingIndicator }}</small>
              </div>
            </div>
            <div class="input-container">
              <InputText ref="generalMessageInputRef" v-model="generalChat.newMessage" placeholder="Напишите ваше сообщение..."
                @keyup.enter="generalChat.sendMessage"
                class="input-field" />
              <Button icon="pi pi-send" @click="generalChat.sendMessage" severity="info" class="send-btn" title="Отправить сообщение"/>
            </div>
          </div>
        </TabPanel>

        <!-- Dynamic Room Tabs -->
        <TabPanel v-for="room in openRooms" :key="room.id">
          <template #header>
            <span class="tab-header-content">
              <Icon icon="lucide:hash" width="16" height="16" />
              <span>{{ room.name }}</span>
              <Button
                icon="pi pi-times"
                class="p-button-text p-button-sm tab-close-btn"
                @click.stop="closeRoomTab(room.id)"
                v-tooltip.top="'Закрыть вкладку'"
              />
            </span>
          </template>
          <div class="chat-container">
            <div class="room-header">
              <div class="room-info">
                <h3 class="room-name">{{ room.name }}</h3>
                <small class="room-description">{{ room.description || 'Комната' }}</small>
              </div>
              <div class="room-actions">
                <Button
                  icon="pi pi-users"
                  label="Участники"
                  @click="openRoomMembers(room.id, room.creatorId)"
                  outlined
                  size="small"
                />
              </div>
            </div>
            <div class="messages">
              <div v-for="(msg, index) in generalChat.activeChat.messages" :key="index" class="message"
                :class="{ 'user-message': msg.isUser }">
                <Avatar v-if="!msg.isUser && (index === 0 || generalChat.activeChat.messages[index - 1].authorId !== msg.authorId)"
                  :image="msg.authorAvatar"
                  :label="!msg.authorAvatar ? getAvatarLabel(msg) : undefined"
                  :style="!msg.authorAvatar ? { backgroundColor: getAvatarColor(msg.authorId), color: 'white' } : {}"
                  shape="circle"
                  size="large"
                  class="message-avatar clickable-avatar"
                  @click="openUserProfile(msg.authorId)" />
                <div v-else-if="!msg.isUser" class="message-avatar-spacer"></div>

                <div class="message-content">
                  <div v-if="!msg.isUser && (index === 0 || generalChat.activeChat.messages[index - 1].authorId !== msg.authorId)"
                    class="message-author"
                    @click="openUserProfile(msg.authorId)"
                    :title="`Открыть профиль: ${msg.authorName}`">
                    {{ msg.authorName }}
                  </div>
                  <div class="message-text">{{ msg.text }}</div>
                  <div class="message-footer">
                    <div class="message-time">{{ msg.time }}</div>
                    <Button
                      v-if="msg.isUser"
                      icon="pi pi-trash"
                      class="p-button-text p-button-sm p-button-danger delete-btn"
                      @click="generalChat.deleteMessage(msg.id)"
                      v-tooltip.top="'Удалить'"
                    />
                  </div>
                </div>

                <Avatar v-if="msg.isUser"
                  :image="msg.authorAvatar"
                  :label="!msg.authorAvatar ? getAvatarLabel(msg) : undefined"
                  :style="!msg.authorAvatar ? { backgroundColor: getAvatarColor(msg.authorId), color: 'white' } : {}"
                  shape="circle"
                  size="large"
                  class="message-avatar clickable-avatar"
                  @click="openUserProfile(msg.authorId)" />
              </div>
            </div>
            <div class="input-container">
              <InputText v-model="generalChat.newMessage" placeholder="Напишите ваше сообщение..." @keyup.enter="generalChat.sendMessage"
                class="input-field" />
              <Button icon="pi pi-send" @click="generalChat.sendMessage" severity="info" class="send-btn" title="Отправить сообщение"/>
            </div>
          </div>
        </TabPanel>
      </TabView>

    </div>

    <Dialog v-model:visible="isModalVisible" modal :closable="true"
      :style="{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh' }" :contentStyle="{
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }" :modal="true" @hide="hideModal" :dismissableMask="false">
      <template #header>
        <div class="flex align-items-center justify-between w-full">
          <span class="font-bold flex align-items-center gap-1">
            <Icon :icon="activeTabIndex === 0 ? 'mdi:robot-outline' : 'mdi:chat-outline'" width="18" height="18" />{{ activeTabIndex === 0 ? 'ИИ-ассистент' : 'Общий чат' }}
          </span>
          <div class="flex align-items-center gap-1">
            <Button icon="pi pi-plus" @click="startNewChat" class="p-button-text"
                    title="Новый чат" />
            <Button icon="pi pi-trash" @click="clearCurrentChat" class="p-button-text p-button-danger"
                    title="Очистить чат" />
          </div>
        </div>
      </template>

      <div class="modal-chat-container">
        <div class="modal-messages" ref="modalMessagesContainer">
          <div v-for="(msg, index) in activeTabIndex === 0
            ? aiChat.messages
            : activeChat.messages" :key="index" class="modal-message" :class="{ 'modal-user-message': msg.isUser }">
            <Avatar v-if="!msg.isUser" :icon="activeTabIndex === 0 ? 'pi pi-sparkles' : 'pi pi-user'" shape="circle"
              size="normal" class="mr-2" />
            <div class="modal-message-content" v-if="!isSystemMessage(msg)">
              <div v-if="msg.attachment || (msg.attachments && msg.attachments.length > 0)" class="modal-attachment-info">
                <template v-if="msg.attachment">
                  <img v-if="isImage(msg.attachment)" :src="msg.attachment.url" class="image-preview" 
                       @click="showImagePreview(msg.attachment.url)" />
                  <i v-else :class="getAttachmentIcon(msg.attachment)" class="attachment-icon" />
                  <span class="attachment-name">{{ getAttachmentDisplayName(msg.attachment) }}</span>
                  <span v-if="msg.attachment.source === 'file'" class="file-size">({{ formatFileSize(msg.attachment.size) }})</span>
                  <Button v-if="msg.attachment.source === 'file'" icon="pi pi-download" class="p-button-text p-button-sm download-btn"
                    @click="downloadAttachment(msg.attachment)" />
                </template>
                <template v-else-if="msg.attachments && msg.attachments.length > 0">
                  <div v-for="(attachment, attIndex) in msg.attachments" :key="attIndex" class="attachment-item">
                    <img v-if="isImage(attachment)" :src="attachment.url" class="image-preview" 
                         @click="showImagePreview(attachment.url)" />
                    <i v-else :class="getAttachmentIcon(attachment)" class="attachment-icon" />
                    <span class="attachment-name">{{ getAttachmentDisplayName(attachment) }}</span>
                    <span v-if="attachment.source === 'file'" class="file-size">({{ formatFileSize(attachment.size) }})</span>
                    <Button v-if="attachment.source === 'file'" icon="pi pi-download" class="p-button-text p-button-sm download-btn"
                      @click="downloadAttachment(attachment)" />
                  </div>
                </template>
              </div>
              
              <!-- Issue #7043: Navigation confirmation chip (modal) -->
              <div v-if="!msg.isUser && msg.navigatedTo" class="nav-confirmation">
                <i class="pi pi-arrow-right"></i>
                <span>Открыта страница: <strong>{{ msg.navigatedTo }}</strong></span>
              </div>

              <!-- Thinking block modal view (modern-cli style) -->
              <div v-if="!msg.isUser && msg.thinkingContent && activeTabIndex === 0 && !msg.navigatedTo"
                class="thinking-block"
                :class="{ 'thinking-block--streaming': aiLoading && msg === assistantMessage }">
                <div class="thinking-block-header" @click="msg._thinkingExpanded = !msg._thinkingExpanded">
                  <span class="thinking-emoji">💭</span>
                  <span class="thinking-label">{{ aiLoading && msg === assistantMessage ? 'Думает...' : 'Размышление' }}</span>
                  <span v-if="!msg._thinkingExpanded" class="thinking-preview">{{ msg.thinkingContent.replace(/\[(?:Executor|Planner|Analyzer|Validator|Scout|Verifier)(?::[^\]]+)?\]/gi, '').slice(-55).trim() }}</span>
                  <span v-if="!(aiLoading && msg === assistantMessage)" class="thinking-tokens">~{{ Math.ceil(msg.thinkingContent.length / 4) }}&nbsp;т.</span>
                  <i :class="msg._thinkingExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="thinking-chevron"></i>
                </div>
                <div v-if="msg._thinkingExpanded" class="thinking-block-content">
                  <span class="thinking-text" v-html="formatThinkingContent(msg.thinkingContent)"></span><span v-if="aiLoading && msg === assistantMessage" class="thinking-cursor">▊</span>
                </div>
              </div>
              <!-- Waiting for first thinking token (modal, hide once navigation happened) -->
              <div v-else-if="!msg.isUser && aiLoading && msg === assistantMessage && !msg.text && !msg.thinkingContent && !msg.navigatedTo && activeTabIndex === 0" class="thinking-waiting">
                <span class="thinking-emoji">💭</span>
                <span>Думает<span class="tw-dot tw-dot-1">.</span><span class="tw-dot tw-dot-2">.</span><span class="tw-dot tw-dot-3">.</span></span>
              </div>

              <div class="modal-message-text">
                <span v-if="msg.isUser && msg.displayText" class="quick-prompt-badge"><i class="pi pi-bolt"></i> Быстрое действие</span>
                <MarkdownRender v-if="activeTabIndex === 0" :content="msg.isUser && msg.displayText ? msg.displayText : msg.text" />
                <template v-else>{{ msg.isUser && msg.displayText ? msg.displayText : msg.text }}</template>
                <span v-if="
                  aiLoading &&
                  msg === assistantMessage &&
                  activeTabIndex === 0
                " class="streaming-cursor"></span>
              </div>
              <div class="modal-message-actions">
                <div class="modal-message-time">{{ msg.time }}</div>
                <div class="modal-action-buttons">
                  <Button v-if="activeTabIndex === 0 && !msg.isUser" icon="pi pi-copy" title="Скопировать"
                    class="copy-button p-button-text p-button-sm" @click="copyToClipboard(msg.text)"
                    aria-label="Скопировать сообщение" />
                  <Button v-if="activeTabIndex === 0" icon="pi pi-refresh" title="Отправить снова"
                    class="resend-button p-button-text p-button-sm" @click="resendMessage(index)"
                    data-testid="resend-message-button-modal" aria-label="Отправить сообщение снова" />
                  <Button v-if="activeTabIndex === 0 && msg.isUser" icon="pi pi-pencil" title="Редактировать"
                    class="edit-button p-button-text p-button-sm" @click="editMessage(index)"
                    data-testid="edit-message-button-modal" aria-label="Редактировать сообщение" />
                  <Button v-if="activeTabIndex === 0 && msg.isUser" icon="pi pi-trash" title="Удалить"
                    class="delete-button p-button-text p-button-sm p-button-danger" @click="deleteMessage(index)"
                    data-testid="delete-message-button-modal" aria-label="Удалить сообщение" />
                </div>
              </div>
            </div>
            <Avatar v-if="msg.isUser && !isSystemMessage(msg)" icon="pi pi-user" shape="circle" size="normal" class="ml-2" />
          </div>

          <div v-if="aiLoading && !assistantMessage && activeTabIndex === 0" class="modal-loading-indicator">
            <ProgressSpinner style="width: 30px; height: 30px" />
          </div>

          <div v-if="aiError && activeTabIndex === 0" class="modal-error-message">
            {{ aiError }}
          </div>

          <!-- Typing indicator for general chat -->
          <div v-if="typingIndicator && activeTabIndex === 1" class="modal-typing-indicator">
            <small class="text-muted">{{ typingIndicator }}</small>
          </div>
        </div>
        <div class="modal-controls">
          <div class="workspace-selector-row" v-if="activeTabIndex === 0 && agentMode">
            <label>Workspace:</label>
            <Dropdown v-model="selectedWorkspace" :options="workspaces" optionLabel="name" optionValue="id"
              placeholder="Выберите workspace" class="workspace-dropdown" :filter="true" :loading="loadingWorkspaces">
              <template #value="slotProps">
                <div v-if="slotProps.value" class="workspace-option">
                  <i class="pi pi-folder"></i>
                  <span>{{ getWorkspaceName(slotProps.value) }}</span>
                </div>
                <span v-else>{{ slotProps.placeholder }}</span>
              </template>
              <template #option="slotProps">
                <div class="workspace-option">
                  <i class="pi pi-folder"></i>
                  <span>{{ slotProps.option.name }}</span>
                </div>
              </template>
            </Dropdown>
            <Button icon="pi pi-plus" @click="showCreateWorkspaceDialog = true" class="p-button-text"
                    title="Создать workspace" />
            <Button icon="pi pi-refresh" @click="loadWorkspaces" :loading="loadingWorkspaces" class="p-button-text"
                    title="Обновить список" />
          </div>

          <!-- Issue #7104: Quick prompts, tools, and finmodel in fullsize modal chat -->
          <div class="modal-quick-actions" v-if="activeTabIndex === 0">
            <button
              class="modal-action-toggle"
              :class="{ active: toolsConfig.webSearch }"
              @click="toggleWebSearch"
              title="Поиск в интернете через Tavily"
            >
              <i class="pi pi-globe"></i>
              <span>{{ toolsConfig.webSearch ? 'Поиск вкл' : 'Веб-поиск' }}</span>
            </button>

            <button
              v-if="isBlockEditorPage && editorDocumentContext"
              class="modal-action-toggle"
              @click="editorToolsPanel.toggle($event)"
              title="Инструменты редактора"
            >
              <i class="pi pi-bolt"></i>
              <span>Инструменты</span>
            </button>

            <button
              v-if="isBlockEditorPage"
              class="modal-action-toggle finmodel-toggle"
              :class="{ active: finmodelContext?.activeModelId }"
              @click="finmodelPanelModal.toggle($event)"
              title="Финмодель & Экосистема"
            >
              <i class="pi pi-sparkles"></i>
              <span>{{ finmodelContext?.activeModelId ? 'Финмодель ✓' : 'Финмодель' }}</span>
            </button>

            <button
              v-if="isBlockEditorPage"
              class="modal-action-toggle tz-toggle"
              :disabled="aiLoading"
              @click="sendTzAction()"
              title="Создать ТЗ"
            >
              <i class="pi pi-file-edit"></i>
              <span>ТЗ</span>
            </button>

            <!-- Issue #7211: Ontology quick prompts — shown on ontology pages -->
            <button
              v-if="isOntologyPage"
              class="modal-action-toggle ontology-toggle"
              @click="ontologyPanelModal.toggle($event)"
              title="Онтологии БПЛА"
            >
              <i class="pi pi-sitemap"></i>
              <span>Онтологии</span>
            </button>

            <!-- Issue #7217: KAG knowledge base quick prompts — always shown -->
            <button
              class="modal-action-toggle kag-toggle"
              @click="kagPanelModal.toggle($event)"
              title="База знаний DronDoc (KAG)"
            >
              <i class="pi pi-database"></i>
              <span>База знаний</span>
            </button>
          </div>

          <!-- Issue #7104: FinModel Popover for Modal Chat -->
          <Popover ref="finmodelPanelModal" class="finmodel-popover">
            <div class="finmodel-panel">
              <div class="tools-group">
                <div class="tools-group-title">📊 Финмодель</div>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[0]); finmodelPanelModal.hide()">
                  <i class="pi pi-chart-bar"></i> Создай финмодель дронов
                </button>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[2]); finmodelPanelModal.hide()">
                  <i class="pi pi-list"></i> Покажи P&amp;L дронов
                </button>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[3]); finmodelPanelModal.hide()">
                  <i class="pi pi-chart-line"></i> Сравни сценарии
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">🌐 Экосистема</div>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[1]); finmodelPanelModal.hide()">
                  <i class="pi pi-sitemap"></i> Добавь Экосистему бизнесов
                </button>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[5]); finmodelPanelModal.hide()">
                  <i class="pi pi-share-alt"></i> Добавь Sankey-диаграмму
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">✏️ Редактирование</div>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[4]); finmodelPanelModal.hide()">
                  <i class="pi pi-dollar"></i> Увеличь выручку на 30%
                </button>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[6]); finmodelPanelModal.hide()">
                  <i class="pi pi-plus"></i> Добавь строку "Маркетинг"
                </button>
                <button class="tool-item" @click="sendFinmodelQuickPrompt(FINMODEL_QUICK_PROMPTS[7]); finmodelPanelModal.hide()">
                  <i class="pi pi-calculator"></i> Измени формулу EBITDA
                </button>
              </div>
            </div>
          </Popover>

          <!-- Issue #7211: Ontology Popover for Modal Chat -->
          <Popover ref="ontologyPanelModal" class="ontology-popover">
            <div class="ontology-panel">
              <div class="tools-group">
                <div class="tools-group-title">🎯 Сценарии БАС</div>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[0]); ontologyPanelModal.hide()">
                  <i class="pi pi-flag"></i> Покажи сценарии БАС
                </button>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[5]); ontologyPanelModal.hide()">
                  <i class="pi pi-plus"></i> Создать сценарий
                </button>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[6]); ontologyPanelModal.hide()">
                  <i class="pi pi-box"></i> Модели событий
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">📖 Онтология</div>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[3]); ontologyPanelModal.hide()">
                  <i class="pi pi-search"></i> Поиск концептов
                </button>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[4]); ontologyPanelModal.hide()">
                  <i class="pi pi-sitemap"></i> Иерархия концептов
                </button>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[1]); ontologyPanelModal.hide()">
                  <i class="pi pi-chart-bar"></i> Статистика онтологии
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">👥 Акторы и запросы</div>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[2]); ontologyPanelModal.hide()">
                  <i class="pi pi-users"></i> Список акторов
                </button>
                <button class="tool-item" @click="sendOntologyQuickPrompt(ONTOLOGY_QUICK_PROMPTS[7]); ontologyPanelModal.hide()">
                  <i class="pi pi-code"></i> BSL-запрос
                </button>
              </div>
            </div>
          </Popover>

          <!-- Issue #7217: KAG knowledge base Popover for Modal Chat -->
          <Popover ref="kagPanelModal" class="kag-popover">
            <div class="kag-panel">
              <div class="tools-group">
                <div class="tools-group-title">🔍 Поиск в базе знаний</div>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[0]); kagPanelModal.hide()">
                  <i class="pi pi-search"></i> Найди в базе знаний...
                </button>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[1]); kagPanelModal.hide()">
                  <i class="pi pi-list"></i> Что хранится в базе знаний?
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">📚 Быстрые темы</div>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[2]); kagPanelModal.hide()">
                  <i class="pi pi-send"></i> Дроны и БПЛА
                </button>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[3]); kagPanelModal.hide()">
                  <i class="pi pi-android"></i> ИИ-агенты
                </button>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[4]); kagPanelModal.hide()">
                  <i class="pi pi-database"></i> Integram БД
                </button>
              </div>
              <div class="tools-group">
                <div class="tools-group-title">💾 Сохранение</div>
                <button class="tool-item" @click="sendKagQuickPrompt(KAG_QUICK_PROMPTS[5]); kagPanelModal.hide()">
                  <i class="pi pi-save"></i> Сохранить в базу знаний...
                </button>
              </div>
            </div>
          </Popover>

          <div class="modal-input-container">
            <Button icon="pi pi-microphone" @click="toggleVoiceInput"
                    :class="['p-button-text', 'voice-btn', { 'recording': isRecording }]"
                    title="Голосовой ввод" />
            <Button v-if="activeTabIndex === 0 && isAdmin" icon="pi pi-sliders-h" @click.stop.prevent="toggleChatOptions"
                    class="p-button-text chat-options-btn"
                    title="Агент и настройки" aria-label="Агент и настройки" />
            <InputText ref="modalAiInputRef" v-if="activeTabIndex === 0" v-model="aiMessage" placeholder="Задайте вопрос ИИ..."
              @keyup.enter="handleSendAiMessage" class="modal-input-field" :disabled="aiLoading" />
            <InputText ref="modalGeneralInputRef" v-else v-model="newMessage" placeholder="Напишите ваше сообщение..."
              @keyup.enter="handleSendMessage" @input="handleTyping"
              class="modal-input-field" />
            <input type="file" ref="modalFileInput" style="display: none" @change="handleModalFileUpload"
                   accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.json,.csv,image/*" multiple />
            <Button icon="pi pi-paperclip" @click="modalAttachmentMenu.toggle($event)" class="p-button-text attachment-btn" title="Прикрепить файл" />
            <Popover ref="modalAttachmentMenu">
              <div class="attachment-menu">
                <Button label="С устройства" icon="pi pi-upload" @click="triggerModalFileUpload(); modalAttachmentMenu.hide()" class="p-button-text w-full justify-start" />
                <Button label="Таблицы/отчёты" icon="pi pi-database" @click="showDataSelector = true; modalAttachmentMenu.hide()" class="p-button-text w-full justify-start" />
              </div>
            </Popover>
            <Button icon="pi pi-send" @click="activeTabIndex === 0 ? handleSendAiMessage() : handleSendMessage()"
              :severity="activeTabIndex === 0 ? 'help' : 'info'" :disabled="aiLoading && activeTabIndex === 0" class="send-btn" />
          </div>
        </div>
        
        <div v-if="currentAttachments.length > 0 && activeTabIndex === 0" class="current-attachments">
          <div v-for="(attachment, index) in currentAttachments" :key="index" class="current-attachment">
            <div class="modal-attachment-info current">
              <img v-if="isImage(attachment)" :src="attachment.url" class="image-preview-small" />
              <i v-else :class="getAttachmentIcon(attachment)" class="attachment-icon" />
              <span class="attachment-name">{{ getAttachmentDisplayName(attachment) }}</span>
              <span v-if="attachment.source === 'file'" class="file-size">({{ formatFileSize(attachment.size) }})</span>
              <Button icon="pi pi-times" class="p-button-text p-button-sm p-button-danger remove-btn"
                @click="removeCurrentAttachment(index)" />
            </div>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- History Dialog (using ChatHistoryDialog component) -->
    <ChatHistoryDialog
      v-model:visible="showHistory"
      :savedChats="savedChats"
      :canSaveCurrentChat="aiChat.messages.length > 2"
      @quickSave="quickSaveChat"
      @startNewChat="startNewChat"
      @clearAll="clearAllChats"
      @saveWithName="saveCurrentChatWithName"
      @loadChat="loadChat"
      @deleteChat="deleteChat"
    />

    <Dialog v-model:visible="showEditMessageDialog" modal header="Редактировать сообщение" :style="{ width: '500px' }" data-testid="edit-message-dialog">
      <div class="edit-message-dialog">
        <Textarea v-model="editingMessageText" rows="10" class="w-full" autoResize data-testid="edit-message-textarea" aria-label="Текст сообщения" />
      </div>
      <template #footer>
        <Button label="Отмена" icon="pi pi-times" @click="cancelEditMessage" class="p-button-text"
                data-testid="cancel-edit-button" aria-label="Отменить редактирование" />
        <Button label="Сохранить" icon="pi pi-check" @click="saveEditedMessage" severity="success"
                data-testid="save-edit-button" aria-label="Сохранить изменения" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showDataSelector" modal header="Прикрепить данные" :style="{ width: '500px' }">
      <div class="data-selector-dialog">
        <div class="field">
          <label>Тип вложения</label>
          <Dropdown v-model="selectedDataType" :options="dataTypes" optionLabel="label"
            placeholder="Выберите тип вложения" class="w-full" />
        </div>

        <div class="field" v-if="selectedDataType">
          <label>{{ selectedDataType.label }}</label>
          <Dropdown v-model="selectedDataItem" :options="dataItems"
            :optionLabel="item => item.name || item.value || item.id" placeholder="Выберите элемент" class="w-full"
            :loading="loadingDataItems" />
        </div>

        <div class="field" v-if="selectedDataItem">
          <label>Комментарий к данным</label>
          <InputText v-model="dataComment" placeholder="Добавьте комментарий..." class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" icon="pi pi-times" @click="showDataSelector = false" class="p-button-text" />
        <Button label="Прикрепить" icon="pi pi-paperclip" @click="attachData" :disabled="!selectedDataItem"
          severity="success" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showImageDialog" modal header="Просмотр изображения" :style="{ width: 'auto' }">
      <img :src="currentImage" class="preview-image" />
    </Dialog>

    <!-- Settings Dialog -->
    <Dialog v-model:visible="showSettings" modal header="Настройки модели" :style="{ width: '600px', maxHeight: '80vh' }">
      <div class="settings-dialog">
        <div class="field">
          <label>Context Size (Размер контекста)</label>
          <InputNumber v-model="llmSettings.contextSize" :min="0" :max="32768" :step="512" class="w-full" />
          <small>Размер контекста промпта (0 = загружается из модели). По умолчанию: 8192</small>
        </div>

        <div class="field">
          <label>GPU Layers (Слои GPU)</label>
          <InputNumber v-model="llmSettings.gpuLayers" :min="-1" :max="200" class="w-full" />
          <small>Количество слоев модели для выгрузки на GPU (-1 для всех слоев, 0 для CPU). По умолчанию: 100</small>
        </div>

        <div class="field">
          <label>Temperature (Температура): {{ llmSettings.temperature }}</label>
          <Slider v-model="llmSettings.temperature" :min="0" :max="2" :step="0.1" class="w-full" />
          <small>Температура для сэмплирования (выше = более случайно). По умолчанию: 0.6</small>
        </div>

        <div class="field">
          <label>Top K: {{ llmSettings.topK }}</label>
          <Slider v-model="llmSettings.topK" :min="0" :max="100" :step="1" class="w-full" />
          <small>Top-K сэмплирование (0 = отключено). По умолчанию: 40</small>
        </div>

        <div class="field">
          <label>Top P: {{ llmSettings.topP }}</label>
          <Slider v-model="llmSettings.topP" :min="0" :max="1" :step="0.05" class="w-full" />
          <small>Top-P сэмплирование (1.0 = отключено). По умолчанию: 0.9</small>
        </div>

        <div class="field">
          <label>Min P: {{ llmSettings.minP }}</label>
          <Slider v-model="llmSettings.minP" :min="0" :max="1" :step="0.05" class="w-full" />
          <small>Min-P сэмплирование (0.0 = отключено). По умолчанию: 0.1</small>
        </div>

        <div class="field">
          <label>Repeat Last N (Повтор последних N)</label>
          <InputNumber v-model="llmSettings.repeatLastN" :min="-1" :max="256" class="w-full" />
          <small>Количество токенов для штрафа за повторение (0 = отключено, -1 = ctx_size). По умолчанию: 64</small>
        </div>

        <div class="field">
          <label>Repeat Penalty (Штраф за повтор): {{ llmSettings.repeatPenalty }}</label>
          <Slider v-model="llmSettings.repeatPenalty" :min="1" :max="2" :step="0.05" class="w-full" />
          <small>Штраф за повторяющиеся последовательности токенов (1.0 = отключено). По умолчанию: 1.0</small>
        </div>

        <div class="field">
          <label>Presence Penalty (Штраф за присутствие): {{ llmSettings.presencePenalty }}</label>
          <Slider v-model="llmSettings.presencePenalty" :min="0" :max="2" :step="0.1" class="w-full" />
          <small>Штраф за присутствие (0.0 = отключено). По умолчанию: 0.0</small>
        </div>

        <div class="field">
          <label>Frequency Penalty (Штраф за частоту): {{ llmSettings.frequencyPenalty }}</label>
          <Slider v-model="llmSettings.frequencyPenalty" :min="0" :max="2" :step="0.1" class="w-full" />
          <small>Штраф за частоту (0.0 = отключено). По умолчанию: 0.0</small>
        </div>

        <div class="field">
          <label>Batch Size (Размер пакета)</label>
          <InputNumber v-model="llmSettings.batchSize" :min="1" :max="2048" :step="128" class="w-full" />
          <small>Логический максимальный размер пакета для обработки промптов. По умолчанию: 512</small>
        </div>

        <div class="field">
          <label>Custom Jinja Chat template (Пользовательский шаблон)</label>
          <Textarea v-model="llmSettings.customTemplate" rows="3" class="w-full"
                    placeholder="{% for message in messages %}...{% endfor %}" />
          <small>Пользовательский Jinja шаблон чата для модели</small>
        </div>

        <div class="field">
          <label>Override Tensor Buffer Type (Переопределение типа буфера тензора)</label>
          <InputText v-model="llmSettings.tensorBufferType" class="w-full"
                     placeholder="layers\.\d+\.ffn_.*=CPU" />
          <small>Переопределить тип буфера тензора для модели</small>
        </div>

        <div class="field">
          <label>Custom System Prompt (Дополнительный системный промпт)</label>
          <Textarea v-model="llmSettings.customSystemPrompt" rows="5" class="w-full"
                    placeholder="Введите дополнительный системный промпт, который будет добавлен к стандартному..." />
          <small>Дополнительные инструкции для ИИ, которые будут добавлены к стандартному системному промпту</small>
        </div>

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="llmSettings.disableKVOffload" inputId="kvOffload" :binary="true" />
          <label for="kvOffload">Disable KV Offload (Отключить выгрузку KV кэша на GPU)</label>
        </div>

        <!-- Issue #6830: AI Pipeline Settings -->
        <div class="field-group mt-4">
          <h4 class="text-primary mb-3"><i class="pi pi-bolt mr-2"></i>AI Pipeline (Пайплайн ИИ)</h4>

          <div class="field flex align-items-center gap-2">
            <Checkbox v-model="llmSettings.enableStreaming" inputId="enableStreaming" :binary="true" />
            <label for="enableStreaming">Streaming (Потоковый вывод)</label>
          </div>
          <small class="block mb-3">Отображение ответа в реальном времени. Отключается при использовании инструментов.</small>

          <div class="field flex align-items-center gap-2">
            <Checkbox v-model="llmSettings.enableThinking" inputId="enableThinking" :binary="true" />
            <label for="enableThinking">Extended Thinking (Расширенное мышление)</label>
          </div>
          <small class="block mb-2">Показывать цепочку рассуждений для DeepSeek-R1 и Claude 3.7+</small>

          <div class="field" v-if="llmSettings.enableThinking">
            <label>Thinking Budget (Бюджет мышления): {{ llmSettings.thinkingBudget }} токенов</label>
            <Slider v-model="llmSettings.thinkingBudget" :min="1024" :max="32000" :step="512" class="w-full" />
            <small>Максимальное количество токенов для цепочки рассуждений</small>
          </div>

          <div class="field flex align-items-center gap-2">
            <Checkbox v-model="llmSettings.enableAgentChain" inputId="enableAgentChain" :binary="true" />
            <label for="enableAgentChain">Agent Chain (Цепочка агентов)</label>
          </div>
          <small class="block">Автоматическая декомпозиция задач: Scout → Planner → Executor → Verifier</small>
        </div>
      </div>

      <template #footer>
        <Button label="Закрыть" icon="pi pi-times" @click="showSettings = false" class="p-button-text" />
        <Button label="Сбросить по умолчанию" icon="pi pi-refresh" @click="resetSettings" severity="secondary" />
      </template>
    </Dialog>

    <!-- Tools Dialog -->
    <Dialog v-model:visible="showTools" modal header="Инструменты" :style="{ width: '500px' }">
      <div class="tools-dialog">
        <div class="field flex align-items-center gap-2 agent-mode-toggle">
          <Checkbox v-model="agentMode" inputId="agentMode" :binary="true" />
          <label for="agentMode" class="font-bold">
            🤖 Режим агента (как Claude Code)
          </label>
        </div>

        <Divider />

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.mcpEnabled" inputId="mcp" :binary="true" />
          <label for="mcp">MCP (Model Context Protocol)</label>
        </div>

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.agentsEnabled" inputId="agents" :binary="true" />
          <label for="agents">Агенты (AI Agents)</label>
        </div>

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.searchEnabled" inputId="search" :binary="true" />
          <label for="search">Поиск в интернете (Search)</label>
        </div>

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.webBrowsingEnabled" inputId="webBrowsing" :binary="true" />
          <label for="webBrowsing">Веб-браузинг (Web Browsing)</label>
        </div>

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.codeInterpreterEnabled" inputId="codeInterpreter" :binary="true" />
          <label for="codeInterpreter">Выполнение кода (Code Execution)</label>
        </div>

        <Divider />

        <div class="field flex align-items-center gap-2">
          <Checkbox v-model="toolsConfig.integramDatabaseEnabled" inputId="integramDatabase" :binary="true" />
          <label for="integramDatabase">🗄️ Integram Database Access</label>
        </div>

        <div v-if="toolsConfig.integramDatabaseEnabled" class="integram-mcp-status" style="margin-left: 30px; margin-top: 10px;">
          <div v-if="integraMCPState.isAuthenticated" class="flex align-items-center gap-2">
            <i class="pi pi-check-circle success-icon" />
            <span class="status-text">
              Подключено: {{ integraMCPState.username }}@{{ integraMCPState.database }}
            </span>
            <Button label="Отключить" icon="pi pi-sign-out"
                    @click="handleIntegraMCPLogout"
                    class="p-button-text p-button-sm p-button-danger" />
          </div>
          <div v-else class="flex align-items-center gap-2">
            <i class="pi pi-times-circle warning-icon" />
            <span class="status-text">Не подключено</span>
            <Button label="Войти" icon="pi pi-sign-in"
                    @click="showIntegraMCPAuth = true; showTools = false"
                    class="p-button-text p-button-sm" />
          </div>
        </div>

        <div v-if="agentMode" class="agent-info">
          <small>
            <i class="pi pi-info-circle" />
            В режиме агента чат может выполнять поиск, генерировать и запускать код,
            устанавливать зависимости.
          </small>
        </div>
      </div>

      <template #footer>
        <Button label="Закрыть" icon="pi pi-check" @click="showTools = false" severity="success" />
      </template>
    </Dialog>

    <!-- Document Picker Dialog — add reference documents to AI context -->
    <Dialog v-model:visible="showDocPicker" modal header="Добавить документ в контекст" :style="{ width: '520px' }">
      <div class="doc-picker-dialog">
        <p class="doc-picker-hint">
          <i class="pi pi-info-circle"></i>
          Выбранный документ будет доступен ИИ <strong>только для чтения</strong> как справочный материал.
          Основной документ (открытый) остаётся единственным редактируемым.
        </p>
        <div class="doc-picker-search">
          <InputText v-model="docPickerSearch" placeholder="Поиск по названию..." class="w-full" @input="filterDocs" />
        </div>
        <div class="doc-picker-list" v-if="docPickerList.length > 0">
          <div
            v-for="doc in docPickerList"
            :key="doc.id"
            class="doc-picker-item"
            :class="{ 'already-added': isDocAlreadyAdded(doc.id) }"
            @click="selectDoc(doc)"
          >
            <i class="pi pi-file-edit"></i>
            <span class="doc-picker-title">{{ doc.title || doc.value || 'Без названия' }}</span>
            <span v-if="isDocAlreadyAdded(doc.id)" class="doc-picker-added">✓ добавлен</span>
          </div>
        </div>
        <div v-else-if="docPickerLoading" class="doc-picker-loading">
          <i class="pi pi-spin pi-spinner"></i> Загрузка документов...
        </div>
        <div v-else class="doc-picker-empty">Документы не найдены</div>
      </div>
      <template #footer>
        <Button label="Закрыть" icon="pi pi-times" @click="showDocPicker = false" text />
      </template>
    </Dialog>

    <!-- Create Workspace Dialog -->
    <Dialog v-model:visible="showCreateWorkspaceDialog" modal header="Создать Workspace" :style="{ width: '600px' }">
      <div class="create-workspace-dialog">
        <div class="field">
          <label for="workspace-name">Название workspace</label>
          <InputText id="workspace-name" v-model="newWorkspace.name"
                     placeholder="Введите название..." class="w-full" />
        </div>

        <div class="field">
          <label for="workspace-repo">Git Repository URL (опционально)</label>
          <InputText id="workspace-repo" v-model="newWorkspace.repositoryUrl"
                     placeholder="https://github.com/user/repo.git" class="w-full" />
          <small>URL репозитория для клонирования в workspace</small>
        </div>

        <div class="field" v-if="newWorkspace.repositoryUrl">
          <label for="workspace-branch">Ветка (опционально)</label>
          <InputText id="workspace-branch" v-model="newWorkspace.branch"
                     placeholder="main" class="w-full" />
          <small>По умолчанию: main</small>
        </div>

        <div v-if="createWorkspaceError" class="error-message mt-3">
          {{ createWorkspaceError }}
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" icon="pi pi-times" @click="showCreateWorkspaceDialog = false" class="p-button-text" />
        <Button label="Создать" icon="pi pi-plus" @click="handleCreateWorkspace"
                :loading="creatingWorkspace" severity="success" />
      </template>
    </Dialog>

    <!-- Integram MCP Authentication Dialog (Phase 1) -->
    <Dialog v-model:visible="showIntegraMCPAuth" modal header="🗄️ Integram Database - Вход" :style="{ width: '500px' }">
      <div class="integram-auth-dialog">
        <div class="field">
          <label for="integram-server">Сервер</label>
          <InputText id="integram-server" v-model="integramAuthForm.serverURL"
                     placeholder="https://ai2o.ru" class="w-full" />
          <small>URL сервера Integram</small>
        </div>

        <div class="field">
          <label for="integram-database">База данных</label>
          <InputText id="integram-database" v-model="integramAuthForm.database"
                     placeholder="my" class="w-full" />
          <small>Название базы данных (например: my, a2025)</small>
        </div>

        <div class="field">
          <label for="integram-login">Логин</label>
          <InputText id="integram-login" v-model="integramAuthForm.login"
                     placeholder="Введите логин" class="w-full"
                     @keyup.enter="handleIntegraMCPAuth" />
        </div>

        <div class="field">
          <label for="integram-password">Пароль</label>
          <Password id="integram-password" v-model="integramAuthForm.password"
                    placeholder="Введите пароль" class="w-full"
                    :feedback="false" toggleMask
                    @keyup.enter="handleIntegraMCPAuth" />
        </div>

        <div v-if="integramAuthError" class="error-message mt-3">
          <i class="pi pi-exclamation-triangle" />
          {{ integramAuthError }}
        </div>

        <div class="info-message mt-3">
          <small>
            <i class="pi pi-info-circle" />
            После входа AI-ассистент сможет работать с таблицами Integram напрямую,
            без загрузки всех данных в память. Это значительно ускоряет работу с большими базами данных.
          </small>
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" icon="pi pi-times" @click="showIntegraMCPAuth = false" class="p-button-text" />
        <Button label="Войти" icon="pi pi-sign-in" @click="handleIntegraMCPAuth"
                :loading="integramAuthLoading" severity="success"
                :disabled="!integramAuthForm.login || !integramAuthForm.password" />
      </template>
    </Dialog>

    <!-- Agents List Dialog -->
    <Dialog v-model:visible="showAgentsList" modal header="Доступные агенты" :style="{ width: '800px' }" data-testid="agents-dialog">
      <AvailableAgentsList :toolsConfig="toolsConfig" />
    </Dialog>

    <!-- Code Execution Window -->
    <CodeExecutionWindow
      v-model="showCodeExecutionWindow"
      :executions="codeExecutions"
      @execution-complete="onExecutionComplete"
      @execution-error="onExecutionError"
    />

    <!-- Toast для уведомлений General Chat -->
    <Toast />

    <!-- Room Management Dialogs -->
    <RoomCreationDialog
      v-model:visible="showRoomCreationDialog"
      @created="handleRoomCreated"
    />

    <RoomMembersDialog
      v-model:visible="showRoomMembersDialog"
      :roomId="currentRoomId"
      :roomCreatorId="currentRoomCreatorId"
      :currentUserId="currentUserId"
      @member-removed="handleMemberRemoved"
    />

    <!-- Chat Help Dialog -->
    <ChatHelpDialog
      v-model="showAgentsHelp"
      @send-command="handleAgentCommand"
    />
  </div>
</template>


<script setup>
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatLogic } from '@/composables/useChatLogic'
import Toast from 'primevue/toast'
import InputSwitch from 'primevue/inputswitch'
import ProgressSpinner from 'primevue/progressspinner'

// Import components
import MarkdownRender from '@/components/MarkdownRender.vue'
import CodeExecutionWindow from '@/components/chat/CodeExecutionWindow.vue'
import ModelSelectorPopover from '@/components/ai/ModelSelectorPopover.vue'
import ModelSelector from '@/components/ai/ModelSelector.vue'
import AgentStatusIndicator from '@/components/chat/AgentStatusIndicator.vue'
import ContextBar from '@/components/chat/ContextBar.vue'
import AgentStatusBar from '@/components/chat/AgentStatusBar.vue'
import AvailableAgentsList from '@/components/chat/AvailableAgentsList.vue'
import ChatHistoryDialog from '@/components/chat/ChatHistoryDialog.vue'
import RoomCreationDialog from '@/components/chat/RoomCreationDialog.vue'
import RoomMembersDialog from '@/components/chat/RoomMembersDialog.vue'
import ChatHelpDialog from '@/components/chat/ChatHelpDialog.vue'
import SGRStatusBadge from '@/components/chat/SGRStatusBadge.vue'
import AgentSelector from '@/components/chat/AgentSelector.vue'
import AgentExecutionMonitor from '@/components/agents/AgentExecutionMonitor.vue'
// Issue #6731: Import components for showing tool calls and thinking
import AgentExecutionSteps from '@/components/chat/AgentExecutionSteps.vue'
import { useAgentFeedback } from '@/composables/useAgentFeedback'
import { getContextualActions } from '@/composables/useBlockEditorTools'
import { Icon } from '@iconify/vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// ========== Import ALL shared logic from composable ==========
const {
  // State
  activeTabIndex,
  activeChat,
  aiChat,
  generalChat,
  deepAgentEnabled,
  aiMessage,
  aiDisplayText,
  newMessage,
  aiLoading,
  aiError,
  assistantMessage,
  currentAttachments,
  selectedModel,
  selectedProvider,
  userAccessToken,
  llmSettings,
  toolsConfig,
  agentMode,
  workspaces,
  selectedWorkspace,
  loadingWorkspaces,
  creatingWorkspace,
  createWorkspaceError,
  newWorkspace,
  showHistory,
  showSettings,
  showTools,
  showDocPicker,
  showDataSelector,
  showCreateWorkspaceDialog,
  showIntegraMCPAuth,
  showEditMessageDialog,
  showAgentsList,
  currentImage,
  showImageDialog,
  isRecording,
  uploadProgress,
  integraMCPState,
  integramAuthForm,
  integramAuthLoading,
  integramAuthError,
  loadingHistory,
  codeExecutions,
  showCodeExecutionWindow,
  selectedDataType,
  selectedDataItem,
  dataComment,
  loadingDataItems,
  dataItems,
  dataTypes,
  editingMessageIndex,
  editingMessageText,
  runningAgents,
  savedChats,
  newChatName,

  // Context management
  contextUsage,
  compactMessages,

  // General Chat state
  availableRooms,
  loadingRooms,
  loadingMessages,
  typingUsers,
  isConnected,
  typingIndicator,

  // Refs for template binding
  fileInput,
  fileInputGeneral,
  modalFileInput,
  attachmentMenu,
  attachmentMenuGeneral,
  modalAttachmentMenu,
  aiMessagesContainer,
  messagesContainer,
  modalMessagesContainer,

  // Computed
  isEditorPage,
  isBlockEditorPage,
  isOntologyPage,
  ontologyContextualActions,
  currentUserId,
  editorDocumentContext,
  integramTableContext,
  setIntegramTableContext,
  clearIntegramTableContext,
  clearEditorDocumentContext,
  additionalDocuments,
  finmodelContext,
  addAdditionalDocument,
  removeAdditionalDocument,
  agentStatusBar,

  // Methods - Message handling
  isSystemMessage,
  scrollToBottom,
  sendMessage,
  sendAiMessage,
  cancelAiRequest,
  sendEditorAction,
  sendTzAction,
  copyToClipboard,
  editMessage,
  deleteMessage,
  resendMessage,
  startEditMessage,
  saveEditedMessage,
  cancelEditMessage,

  // Methods - File & Image handling
  isImage,
  getAttachmentIcon,
  getAttachmentDisplayName,
  formatFileSize,
  triggerFileUpload,
  handleFileUpload,
  triggerFileUploadGeneral,
  handleFileUploadGeneral,
  triggerModalFileUpload,
  handleModalFileUpload,
  removeCurrentAttachment,
  downloadAttachment,
  showImagePreview,

  // Methods - Voice input
  toggleVoiceInput,

  // Methods - Model & Settings
  handleModelChange,
  handleDeepAgentToggle,
  resetSettings,

  // Methods - Workspace
  getWorkspaceName,
  loadWorkspaces,
  handleCreateWorkspace,
  navigateToWorkspaces,

  // Methods - Data selector
  loadDataItems,
  attachDataSource,

  // Methods - Session management
  createNewChatSession,
  clearCurrentChat,

  // Methods - Chat history
  saveCurrentChat,
  loadChat,
  deleteChat,
  quickSaveChat,
  startNewChat,
  clearAllChats,

  // Methods - Integram MCP
  checkIntegraMCPConnection,
  handleIntegraMCPAuth,
  handleIntegraMCPLogout,
  testIntegraMCP,

  // Methods - General Chat
  loadRooms,
  createDefaultRoom,
  joinRoom,
  handleTyping,

  handleSuggestedAction,
  handleRetry,

  // Lifecycle
  init
} = useChatLogic()

// ========== UI-Specific State & Methods (Chat.vue only) ==========
// These are NOT in composable because they're specific to sidebar UI

// Model selector overlay panel ref
const modelPanel = ref(null)

// Chat options popover ref (agent / model / settings)
const chatOptionsMenu = ref(null)
const toggleChatOptions = (e) => chatOptionsMenu.value?.toggle(e)

// Options button visible only to admin role users
const isAdmin = ref(false)

// Editor tools popover ref
const editorToolsPanel = ref(null)

// FinModel quick prompts popover ref (Issue #7104)
const finmodelPanel = ref(null)
const finmodelPanelModal = ref(null)

// Issue #7211: Ontology quick prompts popover ref
const ontologyPanel = ref(null)
const ontologyPanelModal = ref(null)

// Issue #7217: KAG knowledge base quick prompts popover ref
const kagPanel = ref(null)
const kagPanelModal = ref(null)

// Insert a template prompt into the chat input (for parametric editor tools)
function insertToolTemplate(template) {
  aiMessage.value = template
  editorToolsPanel.value?.hide()
  nextTick(() => {
    aiMessageInputRef.value?.$el?.focus()
  })
}

// Context bar color based on usage percentage
const contextBarColor = computed(() => {
  const p = contextUsage.percent
  if (p > 85) return 'var(--red-500)'
  if (p > 70) return 'var(--orange-500)'
  if (p > 50) return 'var(--yellow-500)'
  return 'var(--green-500)'
})

// Telegram-style message selection
const selectedMsgIds = ref([])
function isSelected(index) {
  return selectedMsgIds.value.includes(index)
}
function toggleMessageSelection(index, msg) {
  const i = selectedMsgIds.value.indexOf(index)
  if (i >= 0) selectedMsgIds.value.splice(i, 1)
  else selectedMsgIds.value.push(index)
}
function clearSelection() {
  selectedMsgIds.value = []
}
function copySelectedMessages() {
  const sorted = [...selectedMsgIds.value].sort((a, b) => a - b)
  const texts = sorted.map(idx => {
    const msg = aiChatMessagesWithIds.value[idx]
    return msg ? (msg.displayText || msg.text || '') : ''
  }).filter(Boolean)
  if (texts.length) copyToClipboard(texts.join('\n\n'))
  clearSelection()
}

// Current model display name for the button
const currentModelDisplayName = computed(() => {
  if (!selectedModel.value) return null

  // Map of provider names to readable labels
  const providerNames = {
    polza: 'Полза',
    kodacode: 'KodaCode',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
    yandex: 'Yandex'
  }

  const providerLabel = providerNames[selectedProvider.value] || selectedProvider.value
  const modelName = selectedModel.value
    .replace(/^(gpt-|claude-|deepseek-|yandex-)/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `${providerLabel}: ${modelName}`
})

// Toggle overlay panel
function toggleModelPanel(event) {
  if (modelPanel.value) {
    modelPanel.value.toggle(event)
  }
}

// Handle settings change from ModelSelector
function handleSettingsChange(settings) {
  // Sync ModelSelector settings to useChatLogic llmSettings
  if (settings.temperature !== undefined) {
    llmSettings.temperature = settings.temperature
  }
  if (settings.maxTokens !== undefined) {
    llmSettings.contextSize = settings.maxTokens
  }
  if (settings.topP !== undefined) {
    llmSettings.topP = settings.topP
  }
  console.log('[Chat.vue] Settings synced from ModelSelector:', settings)
}

// Save current chat with custom name (wrapper for ChatHistoryDialog)
function saveCurrentChatWithName(name) {
  newChatName.value = name
  saveCurrentChat()
}

// Room Management
const router = useRouter()
const route = useRoute()

// Issue #6914: Detect preview mode from URL query parameter
const isPreviewMode = computed(() => route.query?.preview === '1')

const showRoomCreationDialog = ref(false)
const showRoomMembersDialog = ref(false)
const currentRoomId = ref(null) // Current room ID
const currentRoomCreatorId = ref(null)
const openRooms = ref([]) // List of open room tabs (excluding general chat)

// Agents Help Dialog
const showAgentsHelp = ref(false)

// Agent Selector and Execution Monitor state
const selectedAgent = ref(null)
const agentExecution = ref({
  status: 'idle',
  progress: 0,
  steps: [],
  toolCalls: [],
  sgrStatus: null,
  finalResult: null,
  startTime: null
})

// Agent handlers
function handleAgentChange(agent) {
  console.log('[Chat] Agent selected:', agent?.name)
  if (agent) {
    localStorage.setItem('customAgentSystemPrompt', agent.systemPrompt || '')
    localStorage.setItem('customAgentName', agent.name || '')
  } else {
    localStorage.removeItem('customAgentSystemPrompt')
    localStorage.removeItem('customAgentName')
  }
}

function handleAgentCancel() {
  agentExecution.value.status = 'cancelled'
}

function handleAgentRerun() {
  agentExecution.value = {
    status: 'running',
    progress: 0,
    steps: [],
    toolCalls: [],
    sgrStatus: null,
    finalResult: null,
    startTime: new Date()
  }
}

// Block editor contextual actions
// Issue #6914: Pass isPreviewMode to show "Create TZ" button when preview=1
const blockEditorContextualActions = computed(() => getContextualActions(editorDocumentContext.value, isPreviewMode.value))

// Virtual scroller: messages with stable unique IDs
const aiChatMessagesWithIds = computed(() =>
  (aiChat.messages || []).map((msg, i) => {
    if (!msg._vIdx) msg._vIdx = i
    return msg
  })
)

// Live TODO plan steps from AI (updated via editor_plan_steps tool)
const livePlanSteps = ref([])

function onEditorPlanSteps(event) {
  livePlanSteps.value = event.detail?.steps || []
}

function sendContextualAction(prompt) {
  aiMessage.value = prompt
  sendAiMessage()
}

// Web search toggle (Tavily)
function toggleWebSearch() {
  toolsConfig.webSearch = !toolsConfig.webSearch
  localStorage.setItem('tools_webSearch', toolsConfig.webSearch ? 'true' : 'false')
}

// Agent Feedback (Agentic Context Engine pattern)
const { recordFeedback } = useAgentFeedback()

function handleFeedback(msg, feedback, index) {
  if (msg.feedback === feedback) {
    // Toggle off
    msg.feedback = null
    return
  }
  msg.feedback = feedback
  if (msg.agentInfo) {
    // Find the user message that triggered this response
    const userMsg = aiChat.messages.slice(0, index).reverse().find(m => m.isUser)
    recordFeedback(
      msg.agentInfo.id || msg.agentInfo.name,
      feedback,
      userMsg?.text || '',
      msg.text?.substring(0, 200) || ''
    )
  }
}

// Avatar helper functions
function openUserProfile(authorId) {
  if (!authorId) return
  router.push(`/integram/my/user/${authorId}`)
}

function getAvatarColor(userId) {
  if (!userId) return 'var(--surface-300)'

  const hash = userId.toString().split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  const colors = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B',
    '#EF4444', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
  ]

  return colors[Math.abs(hash) % colors.length]
}

function getAvatarLabel(msg) {
  if (!msg.authorName || msg.authorName === 'Unknown') {
    return msg.authorId ? msg.authorId.toString().substring(0, 2) : '??'
  }
  return msg.authorName.substring(0, 2).toUpperCase()
}

// Room management functions
function closeRoomTab(roomId) {
  const index = openRooms.value.findIndex(r => r.id === roomId)
  if (index !== -1) {
    openRooms.value.splice(index, 1)

    if (currentRoomId.value === roomId) {
      activeTabIndex.value = 1 // General Chat tab (watcher will handle room switch)
    }
  }
}

function openRoomMembers(roomId, creatorId) {
  currentRoomId.value = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId
  currentRoomCreatorId.value = creatorId
  showRoomMembersDialog.value = true
}

async function handleRoomCreated(room) {
  console.log('Room created:', room)

  if (!openRooms.value.find(r => r.id === room.id)) {
    openRooms.value.push({
      id: room.id,
      name: room.name,
      description: room.description,
      creatorId: room.creatorId,
      typeId: room.typeId
    })
  }

  const roomTabIndex = openRooms.value.findIndex(r => r.id === room.id) + 2
  activeTabIndex.value = roomTabIndex

  await generalChat.refreshRooms(room.id)

  const roomId = room.id
  currentRoomId.value = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId
  currentRoomCreatorId.value = room.creatorId || null
}

async function handleMemberRemoved(data) {
  console.log('Member removed:', data)

  if (data.self) {
    const roomIndex = openRooms.value.findIndex(r => r.id === currentRoomId.value)
    if (roomIndex !== -1) {
      openRooms.value.splice(roomIndex, 1)
    }

    activeTabIndex.value = 1 // General Chat tab (watcher will handle room switch)
  }

  await generalChat.loadRooms()
}

/**
 * Handle agent command sent from AgentsHelpDialog
 * Populates the chat input with the selected command
 */
function handleAgentCommand(command) {
  // Switch to AI Assistant tab if not already there
  if (activeTabIndex.value !== 0) {
    activeTabIndex.value = 0
  }

  // Populate the chat input with the command
  aiMessage.value = command

  // Focus the input field
  nextTick(() => {
    if (aiMessageInputRef.value) {
      const element = aiMessageInputRef.value.$el || aiMessageInputRef.value
      if (element && element.focus) {
        element.focus()
      }
    }
  })
}

// Watch for tab changes to switch rooms
watch(activeTabIndex, async (newIndex) => {
  if (newIndex === 1) {
    // General Chat - use already active chat from generalChat
    // No need to switch, already initialized in useGeneralChat.init()
    if (generalChat.activeChat.id) {
      const roomId = generalChat.activeChat.id
      currentRoomId.value = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId
      currentRoomCreatorId.value = generalChat.activeChat.creatorId || null
    }
  } else if (newIndex >= 2) {
    const roomIndex = newIndex - 2
    const room = openRooms.value[roomIndex]
    if (room) {
      await generalChat.switchRoom(room.id)
      const roomId = room.id
      currentRoomId.value = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId
      currentRoomCreatorId.value = room.creatorId
    }
  }
})

// Watch for room changes in generalChat.activeChat
watch(() => generalChat.activeChat.id, (newRoomId) => {
  if (newRoomId) {
    currentRoomId.value = typeof newRoomId === 'string' ? parseInt(newRoomId, 10) : newRoomId
    currentRoomCreatorId.value = generalChat.activeChat.creatorId || null
    console.log('[Chat] Room switched:', newRoomId, 'creatorId:', currentRoomCreatorId.value)
  }
})

// Input refs for focus management
const aiMessageInputRef = ref(null)
const generalMessageInputRef = ref(null)
const modalAiInputRef = ref(null)
const modalGeneralInputRef = ref(null)

// Helper function to focus input
const focusInput = (inputRef) => {
  nextTick(() => {
    if (inputRef.value) {
      // Handle both PrimeVue InputText and native input
      const element = inputRef.value.$el || inputRef.value
      if (element && element.focus) {
        element.focus()
      }
    }
  })
}

// Send ontology action chip — sets prompt as message and sends via standard AI chat
const sendOntologyAction = (action) => {
  aiDisplayText.value = action.label?.replace(/^[^\s]+\s/, '') || ''
  aiMessage.value = action.prompt || action.label
  handleSendAiMessage()
}

// Wrapper functions with focus return
const handleSendAiMessage = () => {
  sendAiMessage()
  // Focus returns to input after message is sent
  if (isModalVisible.value) {
    focusInput(modalAiInputRef)
  } else {
    focusInput(aiMessageInputRef)
  }
}

const handleSendMessage = () => {
  sendMessage()
  // Focus returns to input after message is sent
  if (isModalVisible.value) {
    focusInput(modalGeneralInputRef)
  } else {
    focusInput(generalMessageInputRef)
  }
}

// Modal visibility (specific to Chat.vue sidebar)
const isModalVisible = ref(false)

const showModal = () => {
  isModalVisible.value = true
  nextTick(() => {
    scrollToBottom(modalMessagesContainer)
  })
}

const hideModal = () => {
  isModalVisible.value = false
}

// Handle "New Chat" button click based on active tab
const handleNewChatClick = () => {
  if (activeTabIndex.value === 0) {
    // ИИ-ассистент: создать новую ИИ сессию
    createNewChatSession()
  } else {
    // Общий чат или комнаты: показать диалог создания комнаты
    showRoomCreationDialog.value = true
  }
}

// Close sidebar chat (specific to Chat.vue)
const closeChat = () => {
  localStorage.setItem('chat', 'false')
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'chat',
    newValue: 'false',
    storageArea: localStorage
  }))
}

// Format agent thinking content: replace [Scout], [Planner] etc. with styled Russian labels
const THINKING_PHASE_LABELS = {
  'Scout': { label: '🔍 Разведка', color: '#3b82f6' },
  'Planner': { label: '📋 Планировщик', color: '#6366f1' },
  'Verifier': { label: '✅ Проверка', color: '#10b981' },
}

const formatThinkingContent = (text) => {
  if (!text) return ''
  // Replace [Scout], [Planner], [Verifier], [Executor:name] with styled spans
  let result = text
    .replace(/\[Scout\]/g, `<span class="thinking-phase-tag" style="color:#3b82f6;font-weight:600">🔍 Разведка</span>`)
    .replace(/\[Planner\]/g, `<span class="thinking-phase-tag" style="color:#6366f1;font-weight:600">📋 Планировщик</span>`)
    .replace(/\[Verifier\]/g, `<span class="thinking-phase-tag" style="color:#10b981;font-weight:600">✅ Проверка</span>`)
    .replace(/\[Executor:([^\]]+)\]/g, (_, name) => `<span class="thinking-phase-tag" style="color:#f59e0b;font-weight:600">⚙️ ${name}</span>`)
    .replace(/\[Executor\]/g, `<span class="thinking-phase-tag" style="color:#f59e0b;font-weight:600">⚙️ Исполнитель</span>`)
    .replace(/\[([^\]]+)\]/g, (_, name) => `<span class="thinking-phase-tag" style="color:#a855f7;font-weight:600">[${name}]</span>`)
    .replace(/\n/g, '<br>')
  return result
}

// Transfer content to editor (specific to Chat.vue when used alongside editor)
const transferToEditor = (content) => {
  window.dispatchEvent(
    new CustomEvent('insert-ai-content', {
      detail: { content }
    })
  )
}

// Document picker logic
const docPickerSearch = ref('')
const docPickerList = ref([])
const docPickerAllDocs = ref([])
const docPickerLoading = ref(false)

const loadDocPickerDocs = async () => {
  if (docPickerLoading.value) return
  docPickerLoading.value = true
  try {
    const db = editorDocumentContext.value?.database || 'kval'
    const res = await fetch(`/api/doc-blocks/documents?database=${db}`)
    const data = await res.json()
    docPickerAllDocs.value = (data.documents || [])
      .filter(d => String(d.id) !== String(editorDocumentContext.value?.documentId))
    docPickerList.value = docPickerAllDocs.value
  } catch (e) {
    docPickerList.value = []
  } finally {
    docPickerLoading.value = false
  }
}

const filterDocs = () => {
  const q = docPickerSearch.value.toLowerCase()
  docPickerList.value = q
    ? docPickerAllDocs.value.filter(d => (d.title || d.value || '').toLowerCase().includes(q))
    : docPickerAllDocs.value
}

const isDocAlreadyAdded = (id) => {
  return additionalDocuments.value.some(d => String(d.id) === String(id))
}

const selectDoc = async (doc) => {
  if (isDocAlreadyAdded(doc.id)) return
  try {
    const db = editorDocumentContext.value?.database || 'kval'
    const res = await fetch(`/api/doc-blocks/${doc.id}?database=${db}`)
    const data = await res.json()
    const content = data.html || data.content || doc.title || ''
    addAdditionalDocument({ id: doc.id, title: doc.title || doc.value || 'Документ', content })
    showDocPicker.value = false
    docPickerSearch.value = ''
  } catch (e) {
    addAdditionalDocument({ id: doc.id, title: doc.title || doc.value || 'Документ', content: '' })
    showDocPicker.value = false
  }
}

watch(showDocPicker, (val) => {
  if (val) loadDocPickerDocs()
})

// Resize functionality (Chat.vue specific - sidebar width)
const chatWidth = ref(parseInt(localStorage.getItem('chatWidth')) || 320)
const isResizing = ref(false)

const startResize = (e) => {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  const newWidth = window.innerWidth - e.clientX
  if (newWidth >= 280 && newWidth <= 800) {
    chatWidth.value = newWidth
  }
}

const stopResize = () => {
  if (isResizing.value) {
    isResizing.value = false
    localStorage.setItem('chatWidth', chatWidth.value.toString())
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }
}

// ========== Issue #7017: FinModel Chat Integration ==========

// FinModel + Ecosystem quick prompts — shown in sidebar on block-editor page (Issue #7017/#7057)
const FINMODEL_QUICK_PROMPTS = [
  { id: 'build',     label: '📊 Создай финмодель дронов' },
  { id: 'ecosystem', label: '🌐 Добавь Экосистему бизнесов' },
  { id: 'pl',        label: '📋 Покажи P&L дронов' },
  { id: 'scenarios', label: '📈 Сравни сценарии' },
  { id: 'revenue30', label: '💰 Увеличь выручку на 30%' },
  { id: 'sankey',    label: '🔀 Добавь Sankey-диаграмму' },
  { id: 'add-row',   label: '➕ Добавь строку "Маркетинг"' },
  { id: 'ebitda',    label: '🔧 Измени формулу EBITDA' },
]

/**
 * Send a FinModel quick prompt directly into the AI chat.
 * Strips leading emoji+space from quick-prompt label to produce clean text.
 */
function sendFinmodelQuickPrompt(qp) {
  const label = qp.label.replace(/^[^\s]+\s/, '')
  aiDisplayText.value = label
  aiMessage.value = qp.prompt || label
  handleSendAiMessage()
}

/**
 * Emit a "insert new FinModelBlock" request to BlockDocumentEditor.
 * BlockDocumentEditor listens for the `finmodel-insert-model` window event.
 */
function dispatchFinmodelInsert() {
  window.dispatchEvent(new CustomEvent('finmodel-insert-model', {
    detail: { modelId: '', database: 'fm', server: 'ai2o.ru' }
  }))
}

/**
 * Emit a "update existing FinModel" request to BlockDocumentEditor.
 * Used when AI response contains FinModel modification instructions.
 */
function dispatchFinmodelUpdate(instruction) {
  const modelId = finmodelContext.value?.activeModelId
  if (!modelId) return
  window.dispatchEvent(new CustomEvent('finmodel-update-model', {
    detail: { modelId, instruction }
  }))
}

// ========== Issue #7211: Ontology Quick Prompts ==========

// Ontology quick prompts — shown in sidebar on ontology pages (Issue #7211)
const ONTOLOGY_QUICK_PROMPTS = [
  { id: 'scenarios', label: '🎯 Покажи сценарии БАС', prompt: 'Покажи все сценарии применения БАС (беспилотных авиационных систем). Используй event_engine_get_scenarios.' },
  { id: 'stats', label: '📊 Статистика онтологии', prompt: 'Покажи статистику событийной онтологии: сколько концептов, акторов, моделей, индивидов. Используй event_engine_get_stats.' },
  { id: 'actors', label: '👥 Список акторов', prompt: 'Покажи список всех акторов событийной онтологии. Используй event_engine_list_actors.' },
  { id: 'search', label: '🔍 Поиск концептов', prompt: 'Найди концепты в онтологии БПЛА. О чём искать? Используй ontology_search_concepts.' },
  { id: 'hierarchy', label: '🌳 Иерархия концептов', prompt: 'Покажи иерархию концептов онтологии БПЛА. Начни с корневых элементов. Используй ontology_get_hierarchy.' },
  { id: 'create-scenario', label: '➕ Создать сценарий', prompt: 'Помоги создать новый сценарий применения БАС. Спроси меня какой сценарий нужен, затем используй event_engine_create_concept.' },
  { id: 'models', label: '📦 Модели событий', prompt: 'Покажи все модели событий в событийной онтологии. Используй event_engine_list_models.' },
  { id: 'bsl', label: '🔎 BSL-запрос', prompt: 'Помоги составить BSL-запрос к событиям. Какие фильтры тебе нужны? Доступны: $Actor, $BEFORE, $AFTER, $BETWEEN, $FIRST, $LAST, $JOIN, $PATTERN.' },
]

/**
 * Send an Ontology quick prompt directly into the AI chat.
 * Uses the prompt field directly if available, otherwise strips emoji from label.
 */
function sendOntologyQuickPrompt(qp) {
  aiDisplayText.value = qp.label.replace(/^[^\s]+\s/, '')
  aiMessage.value = qp.prompt || aiDisplayText.value
  handleSendAiMessage()
}

// ========== Issue #7217: KAG Knowledge Base Quick Prompts ==========

// KAG knowledge base quick prompts — shown in sidebar on all pages (Issue #7217)
const KAG_QUICK_PROMPTS = [
  { id: 'search', label: '🔍 Найди в базе знаний', prompt: 'Найди в базе знаний DronDoc информацию по теме: ' },
  { id: 'summary', label: '📋 Что хранится в базе знаний?', prompt: 'Расскажи, какая информация хранится в базе знаний DronDoc. Что я могу найти и спросить?' },
  { id: 'drones', label: '🚁 Дроны и БПЛА', prompt: 'Найди в базе знаний всё о дронах и БПЛА: технические характеристики, применение, регулирование.' },
  { id: 'agents', label: '🤖 ИИ-агенты', prompt: 'Найди в базе знаний информацию об ИИ-агентах DronDoc: какие есть, что умеют, как использовать.' },
  { id: 'integram', label: '🗄️ Integram база данных', prompt: 'Найди в базе знаний документацию и примеры работы с Integram.' },
  { id: 'save', label: '💾 Сохранить в базу знаний', prompt: 'Сохрани следующую информацию в базу знаний DronDoc: ' },
]

/**
 * Send a KAG knowledge base quick prompt directly into the AI chat.
 * For search/save prompts, keeps them as-is for user to complete; others send immediately.
 */
function sendKagQuickPrompt(qp) {
  const needsInput = ['search', 'save'].includes(qp.id)
  aiDisplayText.value = qp.label.replace(/^[^\s]+\s/, '')
  aiMessage.value = qp.prompt
  if (!needsInput) {
    handleSendAiMessage()
  }
}

// ========== Code Execution Window Event Handlers ==========
// Issue #7113: Add handlers for CodeExecutionWindow events
const onExecutionComplete = (exec) => {
  console.log('[Chat.vue] Code execution completed:', exec)
}

const onExecutionError = (exec) => {
  console.error('[Chat.vue] Code execution error:', exec)
}

// ========== Lifecycle Hooks ==========

function onKeydownSelection(e) {
  if (e.key === 'Escape' && selectedMsgIds.value.length > 0) clearSelection()
}

onMounted(() => {
  // Initialize shared chat logic
  init()
  // Listen for editor plan steps updates from BlockDocumentEditor
  window.addEventListener('editor-plan-steps', onEditorPlanSteps)
  window.addEventListener('keydown', onKeydownSelection)

  // Check admin role — Options button shown only to admins
  const _token = localStorage.getItem('token')
  const _db = localStorage.getItem('db') || 'my'
  const _apiBase = localStorage.getItem('apiBase') || 'ai2o.ru'
  if (_token) {
    const _protocol = _apiBase === 'localhost' ? 'http' : 'https'
    fetch(`${_protocol}://${_apiBase}/${_db}/xsrf?JSON_KV=true`, {
      headers: { 'X-Authorization': _token }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.role === 'admin') isAdmin.value = true })
      .catch(() => {})
  }

  // Force PrimeVue TabView ink bar recalculation after DOM is ready
  nextTick(() => {
    const idx = activeTabIndex.value
    activeTabIndex.value = -1
    nextTick(() => { activeTabIndex.value = idx })
  })
})

onUnmounted(() => {
  // Cleanup resize event listeners
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  window.removeEventListener('editor-plan-steps', onEditorPlanSteps)
  window.removeEventListener('keydown', onKeydownSelection)
})
</script>

<style scoped lang="scss">
.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: transparent;
  z-index: 1000;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(to right, transparent, var(--primary-color));
    box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.3);
  }

  &:active {
    background: var(--primary-color);
    box-shadow: 0 0 12px rgba(var(--primary-rgb), 0.5);
  }
}

.doc-picker-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.doc-picker-hint {
  font-size: 0.8125rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  line-height: 1.5;
}

.doc-picker-search {
  width: 100%;
}

.doc-picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 320px;
  overflow-y: auto;
}

.doc-picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  border: 1px solid transparent;
  transition: all 0.15s;

  &:hover:not(.already-added) {
    background: var(--surface-hover, var(--surface-hover));
    border-color: var(--p-primary-color, var(--primary-color));
  }

  &.already-added {
    opacity: 0.5;
    cursor: default;
  }

  .pi {
    color: var(--p-text-color-secondary, var(--text-color-secondary));
    font-size: 0.875rem;
    flex-shrink: 0;
  }
}

.doc-picker-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-picker-added {
  font-size: 0.75rem;
  color: var(--p-green-500, #22c55e);
  flex-shrink: 0;
}

.doc-picker-loading, .doc-picker-empty {
  text-align: center;
  padding: 1.5rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-size: 0.875rem;
}

.quick-prompts {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--surface-border);

  :deep(.p-button) {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}

/* Issue #7104: FinModel dropdown toggle button */
.finmodel-toggle {
  background: rgba(167, 139, 250, 0.12) !important;
  border-color: rgba(139, 92, 246, 0.3) !important;
  color: #7c3aed !important;

  &:hover {
    background: rgba(167, 139, 250, 0.22) !important;
  }

  &.active {
    background: rgba(124, 58, 237, 0.2) !important;
    border-color: #8b5cf6 !important;
    color: #7c3aed !important;
  }
}

/* Issue #7104: FinModel popover panel (same style as editor-tools-popover) */
.finmodel-popover {
  .finmodel-panel {
    width: 240px;
    padding: 0.25rem 0;
  }
  .tools-group {
    padding: 0.25rem 0;
    & + .tools-group { border-top: 1px solid var(--surface-border); }
  }
  .tools-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    padding: 0.3rem 0.75rem 0.15rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    text-align: left;
    transition: background 0.15s;
    i { font-size: 0.8rem; color: var(--text-color-secondary); }
    &:hover {
      background: var(--surface-hover);
      color: var(--primary-color);
      i { color: var(--primary-color); }
    }
  }
}

/* Issue #7211: Ontology dropdown toggle button */
.ontology-toggle {
  background: rgba(34, 197, 94, 0.12) !important;
  border-color: rgba(34, 197, 94, 0.3) !important;
  color: #16a34a !important;

  &:hover {
    background: rgba(34, 197, 94, 0.22) !important;
  }

  &.active {
    background: rgba(34, 197, 94, 0.2) !important;
    border-color: #22c55e !important;
    color: #16a34a !important;
  }
}

/* Issue #7211: Ontology popover panel (same style as finmodel-popover) */
.ontology-popover {
  .ontology-panel {
    width: 240px;
    padding: 0.25rem 0;
  }
  .tools-group {
    padding: 0.25rem 0;
    & + .tools-group { border-top: 1px solid var(--surface-border); }
  }
  .tools-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    padding: 0.3rem 0.75rem 0.15rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    text-align: left;
    transition: background 0.15s;
    i { font-size: 0.8rem; color: var(--text-color-secondary); }
    &:hover {
      background: var(--surface-hover);
      color: var(--green-600);
      i { color: var(--green-600); }
    }
  }
}

/* Issue #7217: KAG knowledge base dropdown toggle button */
.kag-toggle {
  background: rgba(14, 165, 233, 0.12) !important;
  border-color: rgba(14, 165, 233, 0.3) !important;
  color: #0284c7 !important;

  &:hover {
    background: rgba(14, 165, 233, 0.22) !important;
  }

  &.active {
    background: rgba(14, 165, 233, 0.2) !important;
    border-color: #0ea5e9 !important;
    color: #0284c7 !important;
  }
}

/* Issue #7217: KAG knowledge base popover panel */
.kag-popover {
  .kag-panel {
    width: 240px;
    padding: 0.25rem 0;
  }
  .tools-group {
    padding: 0.25rem 0;
    & + .tools-group { border-top: 1px solid var(--surface-border); }
  }
  .tools-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    padding: 0.3rem 0.75rem 0.15rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    text-align: left;
    transition: background 0.15s;
    i { font-size: 0.8rem; color: var(--text-color-secondary); }
    &:hover {
      background: var(--surface-hover);
      color: #0284c7;
      i { color: #0284c7; }
    }
  }
}

/* Issue #7104: Modal quick actions row (fullsize chat) */
.modal-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-ground);
}

.modal-action-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 16px;
  cursor: pointer;
  color: var(--text-color);
  transition: all 0.2s;

  i {
    font-size: 0.85rem;
  }

  &:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  &.active {
    background: rgba(59, 130, 246, 0.15);
    border-color: var(--blue-500);
    color: var(--blue-500);
  }

  &.finmodel-toggle.active {
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--p-primary-500, #8b5cf6);
    color: var(--p-primary-600, #7c3aed);
  }

  &.tz-toggle {
    background: rgba(34, 197, 94, 0.1);
    border-color: var(--green-500);
    color: var(--green-600);
    &:hover {
      background: var(--green-500);
      color: white;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.ontology-toggle {
    background: rgba(34, 197, 94, 0.1);
    border-color: var(--green-500);
    color: var(--green-600);
    &:hover {
      background: rgba(34, 197, 94, 0.2);
      border-color: var(--green-600);
    }
  }

  &.kag-toggle {
    background: rgba(14, 165, 233, 0.1);
    border-color: rgba(14, 165, 233, 0.3);
    color: #0284c7;
    &:hover {
      background: rgba(14, 165, 233, 0.2);
      border-color: #0ea5e9;
    }
  }
}

.message-actions, .modal-message-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);

  .action-buttons, .modal-action-buttons {
    display: flex;
    gap: 0.25rem;
    transition: opacity 0.2s ease;

    :deep(.p-button) {
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border-radius: 6px;
      transition: all 0.15s ease;

      &:hover {
        transform: scale(1.1);
        background: var(--surface-hover) !important;
      }

      &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
    }
  }
}

// Telegram-style selected message highlight
.message-content.message-selected {
  background: rgba(var(--primary-color-rgb, 14, 165, 233), 0.12) !important;
  border-color: var(--primary-color, #0ea5e9) !important;
  border-width: 1px;
  border-style: solid;
  position: relative;

  &::after {
    content: '✓';
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.25rem;
    height: 1.25rem;
    line-height: 1.25rem;
    text-align: center;
    border-radius: 50%;
    background: var(--primary-color, #0ea5e9);
    color: #fff;
    font-size: 0.7rem;
    pointer-events: none;
  }
}

// Floating selection action bar (Telegram-style)
.selection-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--surface-card, #fff);
  border-top: 1px solid var(--surface-border, #e2e8f0);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
  gap: 0.5rem;

  .selection-count {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--primary-color, #0ea5e9);
  }

  .selection-bar-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
}

.selection-bar-enter-active,
.selection-bar-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.selection-bar-enter-from,
.selection-bar-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

// Action buttons: hidden by default, visible on bubble hover/focus (both sidebar & modal)
.message-actions .action-buttons,
.modal-message-actions .modal-action-buttons {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-content:hover .message-actions .action-buttons,
.message-content:focus-within .message-actions .action-buttons,
.modal-message-content:hover .modal-message-actions .modal-action-buttons,
.modal-message-content:focus-within .modal-message-actions .modal-action-buttons {
  opacity: 1;
}

// User message actions — inherit bubble text color (both sidebar & modal)
.user-message .message-content .message-actions,
.modal-user-message .modal-message-content .modal-message-actions {
  border-top-color: rgba(0, 0, 0, 0.08);

  .message-time, .modal-message-time {
    color: inherit;
    opacity: 0.6;
  }
}

// Editor tools badge
.editor-tools-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.65rem;
  padding: 0.1rem 0.35rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 8px;
  color: var(--blue-400);
}

// Contextual action chips
.contextual-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem 0.1rem;
  .action-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    background: var(--surface-hover);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-color);
    &:hover {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
  }
  &.ontology-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.08) 100%);
    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    .actions-hint {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--p-primary-600, #4f46e5);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      .app-dark & { color: var(--p-primary-300, #a5b4fc); }
    }
    .action-chip {
      border-color: rgba(99, 102, 241, 0.25);
      &:hover {
        background: var(--p-primary-500, #6366f1);
      }
    }
  }
}

// Editor action message bubbles
.quick-prompt-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  margin-bottom: 0.3rem;
  background: var(--p-purple-100, #f3e8ff);
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--p-purple-600, #7c3aed);
  letter-spacing: 0.02em;
  i { font-size: 0.65rem; }
  .app-dark & {
    background: var(--p-purple-900, #3b0764);
    color: var(--p-purple-300, #c4b5fd);
  }
}

.editor-action-bubble {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  background: var(--p-primary-100, #e0e7ff);
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--p-primary-700, #3730a3);
  .app-dark & {
    background: var(--p-primary-900, #1e1b4b);
    color: var(--p-primary-300, #a5b4fc);
  }
}
.editor-action-result {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--p-green-600, #16a34a);
  .app-dark & {
    color: var(--p-green-400, #4ade80);
  }
  i { font-size: 0.85rem; }
}

// Document loading notice
.doc-loading-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
  color: var(--p-amber-600, #d97706);
  background: var(--p-amber-50, #fffbeb);
  border-top: 1px solid var(--p-amber-200, #fde68a);
  i { font-size: 0.75rem; }
}

// Web search toggle row
.web-search-row {
  padding: 0.2rem 0.5rem;
  .web-search-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.72rem;
    background: transparent;
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    cursor: pointer;
    color: var(--text-color-secondary);
    transition: all 0.2s;
    &:hover { border-color: var(--primary-color); color: var(--primary-color); }
    &.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: var(--blue-400);
      color: var(--blue-400);
    }
  }
}

// Editor tools toggle button (same style as web-search-toggle but bolt color)
.editor-tools-toggle {
  margin-left: 0.3rem;
  &:hover { border-color: var(--yellow-400) !important; color: var(--yellow-400) !important; }
}

// ТЗ quick button — green, only on /block-editor
.tz-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.3rem;
  padding: 0.25rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1.5px solid #22c55e;
  background: #22c55e;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
  i { font-size: 0.75rem; }
  &:hover { background: #16a34a; border-color: #16a34a; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

// Editor tools popover panel
.editor-tools-popover {
  .editor-tools-panel {
    width: 220px;
    padding: 0.25rem 0;
  }
  .tools-group {
    padding: 0.25rem 0;
    & + .tools-group { border-top: 1px solid var(--surface-border); }
  }
  .tools-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    padding: 0.3rem 0.75rem 0.15rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    text-align: left;
    transition: background 0.15s;
    i { font-size: 0.8rem; color: var(--text-color-secondary); }
    &:hover {
      background: var(--surface-hover);
      color: var(--primary-color);
      i { color: var(--primary-color); }
    }
  }
}

// Feedback buttons
.feedback-btn {
  color: var(--text-color-secondary) !important;
  &:hover {
    color: var(--primary-color) !important;
  }
}
.feedback-active {
  color: var(--green-500) !important;
  background: rgba(34, 197, 94, 0.1) !important;
}
.feedback-active-down {
  color: var(--red-500) !important;
  background: rgba(239, 68, 68, 0.1) !important;
}

.voice-btn {
  &.recording {
    animation: pulse 1s infinite;
    color: var(--red-500) !important;
  }
}

.upload-progress {
  padding: 0.5rem;
  background: var(--surface-ground);
  border-top: 1px solid var(--surface-border);
  
  span {
    font-size: 0.75rem;
    display: block;
    text-align: center;
    margin-top: 0.25rem;
  }
}

.image-preview {
  max-width: 200px;
  max-height: 150px;
  cursor: pointer;
  border-radius: 4px;
}

.image-preview-small {
  max-width: 40px;
  max-height: 40px;
  border-radius: 4px;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
}

.history-dialog {
  .chat-list {
    max-height: 300px;
    overflow-y: auto;
    
    .chat-item {
      display: flex;
      justify-content: between;
      align-items: center;
      padding: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
      
      .chat-actions {
        display: flex;
        gap: 0.25rem;
        margin-left: auto;
      }
    }
  }
}

.card {
  display: flex;
  flex-direction: column;
}

.tabview-container {
  position: relative;
  height: 100%;
}

.expand-button-container {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
  display: flex;
  gap: 0.25rem;
}

.chat-container {
  display: flex;
  flex-direction: column;
  background-color: var(--surface-card);
  border-radius: 12px;
  height: 100%;
  position: relative;
}

/* Context usage bar */
.context-bar-wrapper {
  position: relative;
  height: 2px;
  background: var(--surface-200);
  flex-shrink: 0;
}
.context-usage-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
  border-radius: 0 1px 1px 0;
}
.context-warning {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  background: var(--surface-card);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 1;
  opacity: 0.9;
}

/* Token count in message footer */
.msg-tokens {
  font-size: 0.65rem;
  color: var(--text-color-secondary);
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: 4px;
}
.message-content:hover .msg-tokens {
  opacity: 0.7;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.875rem 0.875rem;
  flex-wrap: wrap;

  :deep(.p-button) {
    transition: all 0.2s ease;
    border-radius: 10px;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.model-selector-btn-bottom {
  color: var(--primary-color) !important;

  &:hover {
    background: var(--surface-hover) !important;
  }
}

.chat-options-btn {
  color: var(--text-color-secondary) !important;
  padding: 0.25rem !important;
  width: 2rem;
  height: 2rem;

  &:hover {
    color: var(--primary-color) !important;
    background: var(--surface-hover) !important;
  }
}

.chat-options-panel {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
}

/* Issue #6762: Settings button in sidebar */
.settings-btn-sidebar {
  color: var(--text-color-secondary) !important;
  padding: 0.25rem !important;
  width: 2rem;
  height: 2rem;

  &:hover {
    color: var(--primary-color) !important;
    background: var(--surface-hover) !important;
  }
}

/* Agent Selector and Execution Monitor compact styles */
.agent-selector-compact {
  :deep(.selected-agent) {
    padding: 0.25rem 0.5rem;
    min-width: 120px;
    font-size: 0.75rem;
  }
}

.execution-monitor-compact {
  margin: 0.5rem;
  font-size: 0.875rem;
}

.model-overlay-panel {
  pointer-events: auto !important;
  z-index: 1100 !important;
}

.model-popover-content {
  min-width: 400px;
  max-width: 450px;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  gap: 0.5rem;
}

.popover-title {
  font-size: 1rem;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-color);
}

.popover-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: nowrap;
}

/* Ensure OverlayPanel doesn't close on internal interactions */
:deep(.p-overlaypanel) {
  z-index: 1100 !important;
}

.messages {
  flex: 1;
  min-height: 0;
  padding: 0.5rem 0 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }

  .message {
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0 0.5rem 0.75rem;
    display: flex;
    animation: slideIn 0.3s ease;

    &.user-message {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message-content {
      background: var(--surface-ground);
      padding: 0.875rem 1rem;
      border-radius: 16px;
      position: relative;
      max-width: 95%;
      transition: background 0.2s ease;
      
      .attachment-info {
        .attachment-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--surface-100);
          border-radius: 4px;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .pi-file, .pi-database { 
            color: var(--primary-color); 
          }
          
          .file-size, .api-id {
            font-size: 0.75rem;
            opacity: 0.7;
          }
        }
      }
      
      .message-text {
        margin-bottom: 0.5rem;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .message-time {
        font-size: 0.8rem;
        opacity: 0.65;
        font-weight: 500;
        letter-spacing: 0.01em;
      }
      
      .transfer-button {
        width: 24px;
        height: 24px;
      }
    }
    
    &.user-message .message-content {
      background: var(--p-primary-100, var(--primary-100, #dbeafe));
      color: var(--p-primary-900, var(--primary-900, #1e3a5f));

      .message-time { opacity: 0.6; }

      .app-dark & {
        background: var(--p-primary-900, var(--primary-900, #1e2a4a));
        color: var(--p-primary-100, var(--primary-100, #e0e7ff));
      }
    }
  }
}

.input-container {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--surface-card);
  border-radius: 16px;
  margin-top: auto;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
  align-items: center;
  position: sticky;
  bottom: 0;
  z-index: 10;
  border-top: 1px solid var(--surface-border);

  .input-field {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 40px;
    border-radius: 12px;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
    transition: all 0.2s ease;

    &:focus {
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
    }
  }
}

.current-attachments {
  padding: 0 0.875rem 0.875rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;

  .current-attachment {
    .attachment-info.current {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background: linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%);
      border: 1px solid var(--primary-200);
      border-radius: 12px;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }

      .attachment-icon {
        font-size: 1.25rem;
        color: var(--primary-color);
      }

      .attachment-name {
        font-weight: 500;
        color: var(--text-color);
      }

      .file-size {
        color: var(--text-color-secondary);
        font-size: 0.8rem;
      }
    }
  }
}

.loading-indicator {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.error-message {
  color: var(--red-500);
  padding: 0.5rem;
  background: var(--red-50);
  border-radius: 4px;
  margin: 0.5rem;
  text-align: left;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  max-width: 100%;
  overflow-x: auto;
}

.streaming-cursor::after {
  content: '|';
  animation: blink 1s infinite;
  color: var(--primary-color);
}

/* ТЗ generation steps */
.tz-steps {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.82rem;
}

.tz-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);

  &.done { color: var(--green-600, #16a34a); }
  &.active { color: var(--primary-color, #3b82f6); font-weight: 500; }
  &.pending { opacity: 0.4; }
}

.tz-step-icon { font-size: 0.75rem; width: 14px; }
.tz-step-dot { width: 14px; text-align: center; font-size: 0.7rem; }
.tz-step-label { }

/* Live plan steps (editor_plan_steps TODO list) */
.live-plan-steps {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-ground, #f8fafc);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.82rem;
}

.plan-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);

  &.completed {
    color: var(--green-600, #16a34a);
    .step-label { text-decoration: line-through; opacity: 0.7; }
  }
  &.in_progress {
    color: var(--primary-color, #3b82f6);
    font-weight: 500;
  }
}

.step-icon { font-size: 0.75rem; width: 14px; }
.step-dot { font-size: 0.8rem; width: 14px; text-align: center; opacity: 0.5; }
.step-label { flex: 1; }

/* Thinking block — modern-cli style */
.thinking-block {
  margin-bottom: 0.5rem;
  border: 1px solid rgba(139, 92, 246, 0.22);
  border-left: 3px solid #8b5cf6;
  border-radius: 0 6px 6px 0;
  overflow: hidden;
  font-size: 0.8rem;
  background: rgba(139, 92, 246, 0.03);
}

.thinking-block--streaming {
  animation: thinking-pulse-border 2s ease-in-out infinite;
}

@keyframes thinking-pulse-border {
  0%, 100% { border-left-color: #8b5cf6; }
  50% { border-left-color: #c4b5fd; }
}

.thinking-block-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  color: #7c3aed;
  user-select: none;
  font-size: 0.77rem;
}

.thinking-block-header:hover {
  background: rgba(139, 92, 246, 0.07);
}

.thinking-emoji {
  font-size: 0.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.thinking-label {
  font-weight: 500;
  flex-shrink: 0;
  color: #7c3aed;
}

.thinking-preview {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color-secondary, #6c757d);
  font-style: italic;
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 0.2rem;
  direction: rtl;
  text-align: left;
}

.thinking-tokens {
  font-size: 0.67rem;
  color: #a78bfa;
  opacity: 0.85;
  margin-left: auto;
  margin-right: 0.3rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.thinking-chevron {
  font-size: 0.6rem;
  color: #7c3aed;
  opacity: 0.7;
  flex-shrink: 0;
}

.thinking-block-content {
  padding: 0.45rem 0.65rem;
  white-space: pre-wrap;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--text-color-secondary, #6c757d);
  max-height: 200px;
  overflow-y: auto;
  background: rgba(139, 92, 246, 0.025);
  border-top: 1px solid rgba(139, 92, 246, 0.12);
}

.thinking-cursor {
  display: inline-block;
  color: #8b5cf6;
  animation: thinking-blink 0.65s ease-in-out infinite;
  margin-left: 1px;
}

.thinking-text :deep(.thinking-phase-tag) {
  display: inline-block;
  margin: 0 0.1rem;
  font-size: 0.75rem;
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
}

@keyframes thinking-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Waiting for first thinking token */
/* Issue #7043: Navigation confirmation chip */
.nav-confirmation {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  margin: 0.25rem 0;
  background: rgba(34, 197, 94, 0.1);
  border-left: 3px solid #22c55e;
  border-radius: 0.25rem;
  color: #16a34a;
  font-size: 0.8rem;
}
.nav-confirmation i {
  font-size: 0.75rem;
}
.nav-confirmation strong {
  color: #15803d;
}

.thinking-waiting {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0;
  color: #7c3aed;
  font-size: 0.78rem;
  font-style: italic;
}

.tw-dot {
  opacity: 0;
  animation: tw-dot-fade 1.4s ease-in-out infinite;
}
.tw-dot-2 { animation-delay: 0.2s; }
.tw-dot-3 { animation-delay: 0.4s; }

@keyframes tw-dot-fade {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 1; }
}

.attachment-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 150px;
  
  :deep(.p-button) {
    justify-content: flex-start;
  }
}

.modal-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.modal-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  
  .modal-message {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    max-width: 95%;

    &.modal-user-message {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    
    .modal-message-content {
      background: var(--surface-ground);
      padding: 0.75rem 1rem;
      border-radius: 16px;
      position: relative;
      word-break: break-word;
      max-width: 100%;
      transition: background 0.2s ease;
      
      .modal-attachment-info {
        .attachment-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--surface-100);
          border-radius: 4px;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .pi-file, .pi-database { 
            color: var(--primary-color); 
          }
          
          .file-size, .api-id {
            font-size: 0.75rem;
            opacity: 0.7;
          }
        }
      }
      
      .modal-message-text {
        :deep(p) { margin: 0; }
        :deep(pre) {
          white-space: pre-wrap;
          background: var(--surface-100);
          padding: 0.5rem;
          border-radius: 4px;
          overflow-x: auto;
        }
      }
      
      .modal-message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        text-align: right;
      }
    }
    
    &.modal-user-message .modal-message-content {
      background: var(--p-primary-100, var(--primary-100, #dbeafe));
      color: var(--p-primary-900, var(--primary-900, #1e3a5f));

      .modal-message-time { opacity: 0.6; }

      .app-dark & {
        background: var(--p-primary-900, var(--primary-900, #1e2a4a));
        color: var(--p-primary-100, var(--primary-100, #e0e7ff));
      }
    }
  }
}

.modal-controls {
  flex-shrink: 0;
  background: var(--surface-ground);
  border-top: 1px solid var(--surface-border);
}

.modal-input-container {
  flex-shrink: 0;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem 1rem;

  .modal-input-field {
    flex: 1;
    min-width: 0;
  }
}

.modal-loading-indicator {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.modal-error-message {
  color: var(--red-500);
  padding: 0.75rem;
  background: var(--red-50);
  border-radius: 6px;
  margin: 0.5rem;
  text-align: left;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  max-width: 100%;
  overflow-x: auto;
}

.data-selector-dialog {
  .field {
    margin-bottom: 1rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
  }
}

.settings-dialog {
  max-height: 60vh;
  overflow-y: auto;

  .field {
    margin-bottom: 1.5rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    small {
      display: block;
      margin-top: 0.25rem;
      opacity: 0.7;
      font-size: 0.75rem;
    }
  }
}

.tools-dialog {
  .field {
    margin-bottom: 1rem;

    label {
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
  }

  .agent-mode-toggle {
    background: rgba(var(--primary-500), 0.1);
    padding: 1rem;
    border-radius: 8px;

    label {
      font-size: 1.1rem;
    }
  }

  .agent-info {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border-radius: 4px;
    border-left: 3px solid var(--primary-color);

    i {
      margin-right: 0.5rem;
      color: var(--primary-color);
    }
  }
}

:deep(.p-tabview) {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .p-tabview-panels {
    flex: 1;
    min-height: 0;
    position: relative;
    padding: 0 0 0;
    
    .p-tabview-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
  
  .p-button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    
    .pi { font-size: 1rem; }
  }
  
  .p-inputtext {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }
  
  .p-avatar { aspect-ratio: 1/1; flex-shrink: 0; }
  
  .p-tabview-nav, .p-tablist {
    position: relative;
    display: flex;
    align-items: center;
  }
  .p-tabview-nav-link, .p-tab {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .p-tabview-ink-bar {
    background-color: var(--primary-color);
    height: 2px;
    display: block !important;
  }
}

.modal-messages::-webkit-scrollbar,
.messages::-webkit-scrollbar {
  width: 8px;
  
  &-track { background: var(--surface-ground); }
  &-thumb {
    background: var(--surface-border);
    border-radius: 4px;
    
    &:hover { background: var(--text-color-secondary); }
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media screen and (max-width: 960px) {
  :deep(.p-dialog) { width: 80vw !important; }
  .modal-message { max-width: 90%; }

  .message-content {
    max-width: 90%;
    padding: 0.75rem 0.875rem;
  }

  .input-container {
    padding: 0.75rem;
    gap: 0.5rem;

    .input-field {
      height: 38px;
      padding: 0.625rem 0.875rem;
      font-size: 0.9rem;
    }
  }

  .input-actions {
    padding: 0 0.75rem 0.75rem;
    gap: 0.375rem;
  }
}

@media screen and (max-width: 640px) {
  :deep(.p-dialog) {
    width: 95vw !important;
    height: 95vh !important;
  }

  .modal-message { max-width: 95%; }
  .modal-message-content { padding: 0.625rem 0.875rem; }
  .modal-input-container { padding: 0.75rem; }

  .messages {
    padding: 0.75rem 0.5rem 80px;
    gap: 0.5rem;
  }

  .message {
    padding: 0.125rem 0.25rem 0.5rem;

    &.user-message {
      align-self: flex-end;
    }

    .message-content {
      max-width: 95%;
      padding: 0.625rem 0.875rem;
      border-radius: 14px;
    }
  }

  .input-container {
    padding: 0.625rem;
    gap: 0.5rem;
    border-radius: 14px;

    .input-field {
      height: 36px;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
    }
  }

  .input-actions {
    padding: 0 0.625rem 0.625rem;
    gap: 0.25rem;

    :deep(.p-button) {
      min-width: auto;
      padding: 0.5rem;
    }
  }

  .current-attachments {
    padding: 0 0.625rem 0.625rem;
    gap: 0.5rem;

    .current-attachment .attachment-info.current {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
    }
  }

  .message-actions {
    margin-top: 0.5rem;
    padding-top: 0.375rem;

    .action-buttons {
      gap: 0.375rem;
    }
  }

  .expand-button-container {
    top: 0.375rem;
    right: 0.375rem;
    gap: 0.125rem;

    .expand-button {
      width: 1.75rem;
      height: 1.75rem;
    }
  }
}
/* Utility classes for theme-aware colors */
.status-text {
  font-size: 0.75rem;
  color: var(--text-color);
}

.success-icon {
  color: var(--green-500);
}

.warning-icon {
  color: var(--orange-500);
}

.error-icon {
  color: var(--red-500);
}

/* Session history styles */
.history-dialog {
  .chat-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .chat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    background: var(--surface-50);
    border: 1px solid var(--surface-border);
    transition: all 0.2s;

    &:hover {
      background: var(--surface-100);
      border-color: var(--primary-color);
    }

    .chat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      strong {
        color: var(--text-color);
      }

      small {
        color: var(--text-color-secondary);
        font-size: 0.85rem;
      }
    }

    .chat-actions {
      display: flex;
      gap: 0.25rem;
    }
  }

  .text-muted {
    color: var(--text-color-secondary);
  }
}

/* Edit message dialog */
.edit-message-dialog {
  :deep(.p-inputtextarea) {
    font-family: inherit;
    font-size: 0.95rem;
  }
}

/* ========== Error Retry Button ========== */
.error-retry {
  margin-top: 0.5rem;
}
.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--orange-400, #f97316);
  border-radius: 1rem;
  background: transparent;
  color: var(--orange-400, #f97316);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
}
.retry-btn:hover {
  background: color-mix(in srgb, var(--orange-400, #f97316) 10%, transparent);
}

/* ========== Suggested Action Buttons ========== */
.suggested-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border);
}

.suggested-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.4;
  border: 1px solid var(--p-primary-color, var(--primary-color));
  border-radius: 999px;
  background: transparent;
  color: var(--p-primary-color, var(--primary-color));
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}

.suggested-action-btn:hover {
  background: var(--p-primary-color, var(--primary-color));
  color: #fff;
}

.suggested-action-btn:active {
  opacity: 0.8;
}
</style>

<template>
  <div class="lesson-container">
    <!-- Progress Bar -->
    <ProgressBar
      :title="lessonData.title"
      :subtitle="lessonData.subtitle"
      :current-step="currentStep"
      :total-steps="lessonData.totalSteps"
      :step-labels="stepLabels"
      @step-click="goToStep"
    />

    <!-- Step Content -->
    <div class="step-content">
      <!-- Step 1: Introduction to Recommendation Systems -->
      <div v-if="currentStep === 1" class="step-section" key="step-1">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="story-block">
              <div class="quote-box story">
                <i class="pi pi-book quote-icon"></i>
                <p class="story-text">{{ currentStepData.content.story }}</p>
              </div>

              <div class="timeline-comparison">
                <div class="timeline-item past">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <h4>📚 {{ currentStepData.content.problem.past }}</h4>
                  </div>
                </div>
                <div class="timeline-arrow">
                  <i class="pi pi-arrow-down"></i>
                </div>
                <div class="timeline-item present">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <h4>💻 {{ currentStepData.content.problem.present }}</h4>
                  </div>
                </div>
              </div>

              <div class="metaphor-box">
                <i class="pi pi-lightbulb metaphor-icon"></i>
                <p><strong>Ключевая метафора:</strong> {{ currentStepData.content.metaphor }}</p>
              </div>

              <!-- Why Libraries Need This -->
              <div class="why-section">
                <h3>{{ currentStepData.content.whyLibraries.title }}</h3>
                <div class="reasons-grid">
                  <div
                    v-for="reason in currentStepData.content.whyLibraries.reasons"
                    :key="reason.text"
                    class="reason-card"
                  >
                    <i :class="reason.icon" class="reason-icon"></i>
                    <h4>{{ reason.text }}</h4>
                    <p>{{ reason.description }}</p>
                  </div>
                </div>
              </div>

              <!-- Real Example -->
              <div class="real-example-box">
                <h3>{{ currentStepData.content.realExample.title }}</h3>
                <div class="example-content">
                  <div class="challenge">
                    <strong>Вызов:</strong> {{ currentStepData.content.realExample.challenge }}
                  </div>
                  <div class="solution">
                    <strong>Решение:</strong> {{ currentStepData.content.realExample.solution }}
                  </div>
                  <div class="results">
                    <strong>Результаты:</strong>
                    <ul>
                      <li v-for="result in currentStepData.content.realExample.results" :key="result">
                        {{ result }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 2: Types of Recommendation Systems -->
      <div v-if="currentStep === 2" class="step-section" key="step-2">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="intro-text">
              <p>{{ currentStepData.content.intro }}</p>
            </div>

            <!-- Types of Systems -->
            <div class="types-grid">
              <div
                v-for="type in currentStepData.content.types"
                :key="type.title"
                class="type-card"
              >
                <div class="type-header">
                  <span class="type-emoji">{{ type.emoji }}</span>
                  <h3>{{ type.title }}</h3>
                </div>
                <p class="type-description">{{ type.description }}</p>

                <div class="how-it-works">
                  <strong>Как работает:</strong>
                  <p>{{ type.howItWorks }}</p>
                </div>

                <div class="pros-cons">
                  <div class="pros">
                    <h4>Преимущества:</h4>
                    <ul>
                      <li v-for="pro in type.pros" :key="pro">{{ pro }}</li>
                    </ul>
                  </div>
                  <div class="cons">
                    <h4>Ограничения:</h4>
                    <ul>
                      <li v-for="con in type.cons" :key="con">{{ con }}</li>
                    </ul>
                  </div>
                </div>

                <div class="use-case">
                  <h4>Применение в библиотеке:</h4>
                  <p><strong>Сценарий:</strong> {{ type.libraryUseCase.scenario }}</p>
                  <p><strong>Пример:</strong> {{ type.libraryUseCase.example }}</p>
                  <div class="tools">
                    <strong>Инструменты:</strong>
                    <Chip
                      v-for="tool in type.libraryUseCase.tools"
                      :key="tool"
                      :label="tool"
                      class="tool-chip"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Decision Tree -->
            <div class="decision-tree">
              <h3>{{ currentStepData.content.decisionTree.title }}</h3>
              <div class="questions-list">
                <div
                  v-for="(q, index) in currentStepData.content.decisionTree.questions"
                  :key="index"
                  class="decision-question"
                >
                  <div class="question">
                    <i class="pi pi-question-circle"></i>
                    <strong>{{ q.question }}</strong>
                  </div>
                  <div class="answers">
                    <div class="answer yes">
                      <span class="label">Да:</span> {{ q.yes }}
                    </div>
                    <div class="answer no">
                      <span class="label">Нет:</span> {{ q.no }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 3: Practice 1 - Content-Based Recommendations -->
      <div v-if="currentStep === 3" class="step-section" key="step-3">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-info-circle quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>

            <div class="task-description">
              <h3>{{ currentStepData.content.task.title }}</h3>
              <p>{{ currentStepData.content.task.description }}</p>
            </div>

            <!-- AI Tools -->
            <div class="ai-tools">
              <h4>Доступные инструменты:</h4>
              <div class="tools-grid">
                <a
                  v-for="tool in currentStepData.content.task.tools"
                  :key="tool.name"
                  :href="tool.url"
                  target="_blank"
                  class="tool-card"
                >
                  <i :class="tool.icon"></i>
                  <span>{{ tool.name }}</span>
                </a>
              </div>
            </div>

            <!-- Prompt Template -->
            <div class="prompt-template">
              <h4>Шаблон промпта:</h4>
              <div class="prompt-box">
                <pre>{{ currentStepData.content.task.prompt }}</pre>
                <Button
                  label="Копировать"
                  icon="pi pi-copy"
                  size="small"
                  @click="copyPrompt(currentStepData.content.task.prompt)"
                />
              </div>
            </div>

            <!-- Examples -->
            <div class="examples-section">
              <h4>Примеры рекомендаций:</h4>
              <div
                v-for="example in currentStepData.content.task.examples"
                :key="example.book"
                class="example-card"
              >
                <div class="example-header">
                  <h5>{{ example.book }}</h5>
                  <p>{{ example.description }}</p>
                </div>
                <div class="recommendations">
                  <h6>Рекомендации:</h6>
                  <div
                    v-for="rec in example.expectedRecommendations"
                    :key="rec.title"
                    class="recommendation-item"
                  >
                    <div class="rec-title">{{ rec.title }}</div>
                    <div class="rec-reason">{{ rec.reason }}</div>
                    <div class="rec-meta">
                      <Chip :label="rec.similarity" class="similarity-chip" />
                      <Chip :label="`Сходство: ${rec.score}/10`" class="score-chip" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Interactive Demo -->
            <div class="interactive-demo">
              <h4>{{ currentStepData.content.interactiveDemo.title }}</h4>
              <p>{{ currentStepData.content.interactiveDemo.description }}</p>
              <div class="sample-books">
                <Button
                  v-for="book in currentStepData.content.interactiveDemo.sampleBooks"
                  :key="book.title"
                  :label="`${book.title} (${book.author})`"
                  @click="selectSampleBook(book)"
                  outlined
                  class="sample-book-btn"
                />
              </div>
              <div v-if="selectedBook" class="selected-book-info">
                <Message severity="info">
                  Выбрана книга: <strong>{{ selectedBook.title }}</strong> - {{ selectedBook.author }}
                  ({{ selectedBook.genre }}). Используйте шаблон промпта выше для создания рекомендаций!
                </Message>
              </div>
            </div>

            <!-- Tips -->
            <div class="tips-box">
              <h4>💡 Полезные советы:</h4>
              <ul>
                <li v-for="tip in currentStepData.content.tips" :key="tip">{{ tip }}</li>
              </ul>
            </div>

            <!-- Success Criteria -->
            <div class="success-criteria">
              <h4>Критерии успеха:</h4>
              <div class="criteria-list">
                <div v-for="criteria in currentStepData.content.successCriteria" :key="criteria" class="criteria-item">
                  <i class="pi pi-check-circle"></i>
                  <span>{{ criteria }}</span>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 4: Practice 2 - Collaborative Filtering -->
      <div v-if="currentStep === 4" class="step-section" key="step-4">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-info-circle quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>

            <!-- Concept Visualization -->
            <div class="concept-viz">
              <h3>{{ currentStepData.content.conceptVisualization.title }}</h3>
              <div class="readers-viz">
                <div
                  v-for="reader in currentStepData.content.conceptVisualization.example.readers"
                  :key="reader.name"
                  class="reader-card"
                  :style="{ borderColor: reader.color }"
                >
                  <h4 :style="{ color: reader.color }">{{ reader.name }}</h4>
                  <div class="books-list">
                    <Chip
                      v-for="book in reader.books"
                      :key="book"
                      :label="book"
                      class="book-chip-small"
                    />
                  </div>
                </div>
              </div>
              <div class="logic-explanation">
                <h4>Логика рекомендаций:</h4>
                <ul>
                  <li
                    v-for="point in currentStepData.content.conceptVisualization.example.logic"
                    :key="point"
                  >
                    {{ point }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- Task -->
            <div class="task-section">
              <h3>{{ currentStepData.content.task.title }}</h3>
              <p>{{ currentStepData.content.task.description }}</p>

              <!-- Sample Data -->
              <div class="sample-data">
                <h4>Данные о читателях:</h4>
                <DataTable :value="currentStepData.content.task.sampleData.readers" class="p-datatable-sm">
                  <Column field="name" header="Читатель"></Column>
                  <Column field="books" header="Взятые книги">
                    <template #body="slotProps">
                      <div class="books-cell">
                        <Chip
                          v-for="book in slotProps.data.books"
                          :key="book"
                          :label="book"
                          class="book-chip-tiny"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </div>

              <!-- Questions -->
              <div class="questions-section">
                <h4>Задания для анализа:</h4>
                <div
                  v-for="(q, index) in currentStepData.content.task.questions"
                  :key="index"
                  class="question-card"
                >
                  <div class="question-text">
                    <strong>Вопрос {{ index + 1 }}:</strong> {{ q.question }}
                  </div>
                  <div v-if="q.hint" class="hint">
                    <i class="pi pi-info-circle"></i>
                    <span>{{ q.hint }}</span>
                  </div>
                  <Button
                    v-if="!answersRevealed[index]"
                    label="Показать ответ"
                    @click="revealAnswer(index)"
                    outlined
                    size="small"
                  />
                  <div v-else class="answer-revealed">
                    <div class="answer">
                      <strong>Ответ:</strong> {{ q.answer }}
                    </div>
                    <div class="explanation">
                      <strong>Объяснение:</strong> {{ q.explanation }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI Helper -->
            <div class="ai-helper">
              <h3>{{ currentStepData.content.task.aiHelper.title }}</h3>
              <div class="helper-prompt">
                <h4>Промпт для ИИ:</h4>
                <pre>{{ currentStepData.content.task.aiHelper.prompt }}</pre>
                <Button
                  label="Копировать промпт"
                  icon="pi pi-copy"
                  @click="copyPrompt(currentStepData.content.task.aiHelper.prompt)"
                />
              </div>
              <div class="expected-response">
                <h4>Ожидаемый ответ:</h4>
                <div class="response-box">
                  <pre>{{ currentStepData.content.task.aiHelper.expectedResponse }}</pre>
                </div>
              </div>
            </div>

            <!-- Real World Application -->
            <div class="real-world-app">
              <h3>{{ currentStepData.content.realWorldApplication.title }}</h3>
              <div class="steps-grid">
                <div
                  v-for="step in currentStepData.content.realWorldApplication.steps"
                  :key="step.step"
                  class="step-card"
                >
                  <h4>{{ step.step }}</h4>
                  <p>{{ step.description }}</p>
                  <div v-if="step.format" class="meta-info">
                    <strong>Формат:</strong> {{ step.format }}
                  </div>
                  <div v-if="step.tools" class="meta-info">
                    <strong>Инструменты:</strong>
                    <span v-for="(tool, idx) in step.tools" :key="idx">
                      {{ tool }}<span v-if="idx < step.tools.length - 1">, </span>
                    </span>
                  </div>
                  <div v-if="step.options" class="meta-info">
                    <strong>Варианты:</strong>
                    <ul>
                      <li v-for="option in step.options" :key="option">{{ option }}</li>
                    </ul>
                  </div>
                  <div v-if="step.output" class="meta-info">
                    <strong>Результат:</strong> {{ step.output }}
                  </div>
                  <div v-if="step.channels" class="meta-info">
                    <strong>Каналы:</strong>
                    <span v-for="(channel, idx) in step.channels" :key="idx">
                      {{ channel }}<span v-if="idx < step.channels.length - 1">, </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 5: Practice 3 - Automation -->
      <div v-if="currentStep === 5" class="step-section" key="step-5">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-info-circle quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>

            <!-- Why Automate -->
            <div class="why-automate">
              <h3>{{ currentStepData.content.why.title }}</h3>
              <div class="benefits-grid">
                <div
                  v-for="benefit in currentStepData.content.why.benefits"
                  :key="benefit.benefit"
                  class="benefit-card"
                >
                  <i :class="benefit.icon" class="benefit-icon"></i>
                  <h4>{{ benefit.benefit }}</h4>
                  <p>{{ benefit.description }}</p>
                </div>
              </div>
            </div>

            <!-- Task Scenario -->
            <div class="scenario-box">
              <h3>{{ currentStepData.content.task.title }}</h3>
              <p>{{ currentStepData.content.task.description }}</p>
              <div class="scenario-details">
                <div class="detail-item situation">
                  <strong>Ситуация:</strong> {{ currentStepData.content.task.scenario.situation }}
                </div>
                <div class="detail-item challenge">
                  <strong>Вызов:</strong> {{ currentStepData.content.task.scenario.challenge }}
                </div>
                <div class="detail-item solution">
                  <strong>Решение:</strong> {{ currentStepData.content.task.scenario.solution }}
                </div>
              </div>
            </div>

            <!-- Demo -->
            <div class="demo-section">
              <h3>{{ currentStepData.content.task.demo.title }}</h3>
              <p>{{ currentStepData.content.task.demo.description }}</p>

              <!-- Sample Readers -->
              <div class="sample-readers">
                <div
                  v-for="reader in currentStepData.content.task.demo.readers"
                  :key="reader.id"
                  class="demo-reader-card"
                >
                  <h4>{{ reader.name }}</h4>
                  <div class="reader-info">
                    <div><strong>Любимые книги:</strong></div>
                    <ul>
                      <li v-for="book in reader.favoriteBooks" :key="book">{{ book }}</li>
                    </ul>
                    <div><strong>Предпочтения:</strong> {{ reader.preferences }}</div>
                  </div>
                </div>
              </div>

              <!-- Process Steps -->
              <div class="process-steps">
                <h4>Процесс автоматизации:</h4>
                <div
                  v-for="(step, index) in currentStepData.content.task.demo.processSteps"
                  :key="index"
                  class="process-step"
                >
                  <div class="step-number">{{ index + 1 }}</div>
                  <div class="step-content">
                    <h5>{{ step.step }}</h5>
                    <p>{{ step.description }}</p>
                    <div v-if="step.examplePrompt" class="code-block">
                      <pre>{{ step.examplePrompt }}</pre>
                    </div>
                    <div v-if="step.pseudocode" class="code-block">
                      <pre>{{ step.pseudocode }}</pre>
                    </div>
                    <div v-if="step.output" class="output-info">
                      <strong>Результат:</strong> {{ step.output }}
                    </div>
                    <div v-if="step.channels" class="channels-info">
                      <strong>Каналы доставки:</strong>
                      <ul>
                        <li v-for="channel in step.channels" :key="channel">{{ channel }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Expected Results -->
              <div class="expected-results">
                <h4>{{ currentStepData.content.task.expectedResults.title }}</h4>
                <DataTable :value="currentStepData.content.task.expectedResults.metrics" class="p-datatable-sm">
                  <Column field="metric" header="Метрика"></Column>
                  <Column field="manual" header="Вручную"></Column>
                  <Column field="automated" header="Автоматически"></Column>
                  <Column field="improvement" header="Улучшение">
                    <template #body="slotProps">
                      <Chip :label="slotProps.data.improvement" class="improvement-chip" />
                    </template>
                  </Column>
                </DataTable>
              </div>
            </div>

            <!-- Practical Guide -->
            <div class="practical-guide">
              <h3>{{ currentStepData.content.practicalGuide.title }}</h3>

              <div class="guide-options">
                <!-- Option 1: Without Programming -->
                <div class="guide-option">
                  <h4>{{ currentStepData.content.practicalGuide.forNonProgrammers.title }}</h4>
                  <ol>
                    <li
                      v-for="step in currentStepData.content.practicalGuide.forNonProgrammers.steps"
                      :key="step"
                    >
                      {{ step }}
                    </li>
                  </ol>
                  <div class="time-estimate">
                    <i class="pi pi-clock"></i>
                    {{ currentStepData.content.practicalGuide.forNonProgrammers.time }}
                  </div>
                </div>

                <!-- Option 2: With Automation -->
                <div class="guide-option advanced">
                  <h4>{{ currentStepData.content.practicalGuide.forAdvanced.title }}</h4>
                  <p>{{ currentStepData.content.practicalGuide.forAdvanced.description }}</p>
                  <div class="tools-list">
                    <strong>Инструменты:</strong>
                    <ul>
                      <li
                        v-for="tool in currentStepData.content.practicalGuide.forAdvanced.tools"
                        :key="tool"
                      >
                        {{ tool }}
                      </li>
                    </ul>
                  </div>
                  <div class="time-estimate">
                    <i class="pi pi-clock"></i>
                    {{ currentStepData.content.practicalGuide.forAdvanced.time }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Real Case -->
            <div class="real-case">
              <h3>{{ currentStepData.content.realCase.title }}</h3>
              <div class="case-content">
                <div class="problem"><strong>Проблема:</strong> {{ currentStepData.content.realCase.problem }}</div>
                <div class="solution"><strong>Решение:</strong> {{ currentStepData.content.realCase.solution }}</div>
                <div class="implementation">
                  <strong>Реализация:</strong>
                  <ul>
                    <li
                      v-for="item in currentStepData.content.realCase.implementation"
                      :key="item"
                    >
                      {{ item }}
                    </li>
                  </ul>
                </div>
                <div class="results">
                  <strong>Результаты:</strong>
                  <ul class="results-list">
                    <li
                      v-for="result in currentStepData.content.realCase.results"
                      :key="result"
                      class="result-item"
                    >
                      <i class="pi pi-check-circle"></i>
                      {{ result }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 6: Implementation Plan -->
      <div v-if="currentStep === 6" class="step-section" key="step-6">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <!-- Summary -->
            <div class="summary-section">
              <h3>{{ currentStepData.content.summary.title }}</h3>
              <div class="summary-points">
                <div
                  v-for="(point, index) in currentStepData.content.summary.points"
                  :key="index"
                  class="summary-point"
                >
                  <div class="point-number">{{ index + 1 }}</div>
                  <p>{{ point }}</p>
                </div>
              </div>
            </div>

            <!-- Roadmap -->
            <div class="roadmap-section">
              <h3>{{ currentStepData.content.roadmap.title }}</h3>
              <div class="phases-timeline">
                <div
                  v-for="phase in currentStepData.content.roadmap.phases"
                  :key="phase.phase"
                  class="phase-card"
                >
                  <div class="phase-header">
                    <i :class="phase.icon"></i>
                    <h4>{{ phase.phase }}</h4>
                  </div>
                  <div class="phase-tasks">
                    <ul>
                      <li v-for="task in phase.tasks" :key="task">{{ task }}</li>
                    </ul>
                  </div>
                  <div class="phase-deliverable">
                    <strong>Результат:</strong> {{ phase.deliverable }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Wins -->
            <div class="quick-wins">
              <h3>{{ currentStepData.content.quickWins.title }}</h3>
              <div class="wins-grid">
                <div
                  v-for="win in currentStepData.content.quickWins.actions"
                  :key="win.action"
                  class="win-card"
                >
                  <div class="win-header">
                    <h4>{{ win.action }}</h4>
                    <Chip :label="win.time" class="time-chip" />
                  </div>
                  <p>{{ win.description }}</p>
                  <div class="win-impact">
                    <i class="pi pi-bolt"></i>
                    <strong>Эффект:</strong> {{ win.impact }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Tools -->
            <div class="tools-section">
              <h3>{{ currentStepData.content.tools.title }}</h3>

              <div class="essential-tools">
                <h4>Необходимые инструменты:</h4>
                <div class="tools-list">
                  <div
                    v-for="tool in currentStepData.content.tools.essential"
                    :key="tool.tool"
                    class="tool-item"
                  >
                    <div class="tool-name">
                      <strong>{{ tool.tool }}</strong>
                      <Chip :label="tool.priority" severity="danger" />
                    </div>
                    <div class="tool-purpose">{{ tool.purpose }}</div>
                    <div class="tool-cost">
                      <i class="pi pi-money-bill"></i>
                      {{ tool.cost }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="advanced-tools">
                <h4>Дополнительные инструменты:</h4>
                <div class="tools-list">
                  <div
                    v-for="tool in currentStepData.content.tools.advanced"
                    :key="tool.tool"
                    class="tool-item advanced"
                  >
                    <div class="tool-name">
                      <strong>{{ tool.tool }}</strong>
                    </div>
                    <div class="tool-purpose">{{ tool.purpose }}</div>
                    <div class="tool-cost">
                      <i class="pi pi-money-bill"></i>
                      {{ tool.cost }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Metrics -->
            <div class="metrics-section">
              <h3>{{ currentStepData.content.metrics.title }}</h3>
              <DataTable :value="currentStepData.content.metrics.kpis" class="p-datatable-sm">
                <Column field="metric" header="Метрика"></Column>
                <Column field="howToMeasure" header="Как измерять"></Column>
                <Column field="target" header="Целевое значение"></Column>
                <Column field="frequency" header="Частота измерения"></Column>
              </DataTable>
            </div>

            <!-- Common Mistakes -->
            <div class="mistakes-section">
              <h3>{{ currentStepData.content.commonMistakes.title }}</h3>
              <div class="mistakes-list">
                <div
                  v-for="mistake in currentStepData.content.commonMistakes.mistakes"
                  :key="mistake.mistake"
                  class="mistake-card"
                >
                  <div class="mistake-title">
                    <i class="pi pi-exclamation-triangle"></i>
                    <strong>{{ mistake.mistake }}</strong>
                  </div>
                  <div class="mistake-why">
                    <strong>Почему плохо:</strong> {{ mistake.why }}
                  </div>
                  <div class="mistake-solution">
                    <strong>Решение:</strong> {{ mistake.solution }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Community -->
            <div class="community-section">
              <h3>{{ currentStepData.content.community.title }}</h3>
              <div class="resources-grid">
                <div
                  v-for="resource in currentStepData.content.community.resources"
                  :key="resource.name"
                  class="resource-card"
                >
                  <h4>{{ resource.name }}</h4>
                  <p>{{ resource.description }}</p>
                  <div class="resource-meta">
                    <Chip :label="resource.type" />
                    <span class="benefit">{{ resource.benefit }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Inspiration -->
            <div class="inspiration-section">
              <h3>{{ currentStepData.content.inspiration.title }}</h3>
              <div class="cases-grid">
                <div
                  v-for="case_ in currentStepData.content.inspiration.cases"
                  :key="case_.library"
                  class="case-card"
                >
                  <h4>{{ case_.library }}</h4>
                  <div class="case-achievement">
                    <strong>Достижение:</strong> {{ case_.achievement }}
                  </div>
                  <div class="case-result">
                    <strong>Результат:</strong> {{ case_.result }}
                  </div>
                  <div class="case-quote">
                    <i class="pi pi-quote-left"></i>
                    <em>{{ case_.quote }}</em>
                  </div>
                </div>
              </div>
            </div>

            <!-- Final Message -->
            <div class="final-message">
              <h3>{{ currentStepData.content.finalMessage.title }}</h3>
              <p class="message-text">{{ currentStepData.content.finalMessage.message }}</p>
              <div class="cta-box">
                <i class="pi pi-star-fill"></i>
                <p>{{ currentStepData.content.finalMessage.cta }}</p>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div class="navigation-buttons">
      <Button
        v-if="currentStep > 1"
        label="Назад"
        icon="pi pi-arrow-left"
        @click="previousStep"
        outlined
        size="large"
      />
      <div class="spacer"></div>
      <Button
        v-if="currentStep < lessonData.totalSteps"
        label="Далее"
        icon="pi pi-arrow-right"
        iconPos="right"
        @click="nextStep"
        size="large"
      />
      <Button
        v-else
        label="Завершить урок"
        icon="pi pi-check"
        iconPos="right"
        @click="completeLesson"
        severity="success"
        size="large"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import ProgressBar from './ProgressBar.vue'
import { lesson9Data } from '@/data/tutorial/lesson9Data'

const router = useRouter()
const toast = useToast()
const currentStep = ref(1)
const lessonData = lesson9Data

// Error boundary for component
onErrorCaptured((err, instance, info) => {
  console.error('[Lesson9Container] Error captured:', err, info)

  // Show user-friendly error message
  if (toast) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка в уроке',
      detail: 'Произошла ошибка при отображении урока. Попробуйте обновить страницу.',
      life: 5000
    })
  }

  // Prevent error from propagating
  return false
})

// Safety check on mount
onMounted(() => {
  try {
    // Verify lesson data is loaded correctly
    if (!lessonData || !lessonData.steps || lessonData.steps.length === 0) {
      throw new Error('Lesson data is not loaded correctly')
    }

    // Verify current step is valid
    if (currentStep.value < 1 || currentStep.value > lessonData.totalSteps) {
      currentStep.value = 1
    }
  } catch (err) {
    console.error('[Lesson9Container] Mount error:', err)
    if (toast) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка загрузки урока',
        detail: 'Не удалось загрузить данные урока',
        life: 5000
      })
    }
  }
})

// State
const selectedBook = ref(null)
const answersRevealed = ref({})

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

const currentStepData = computed(() => {
  return lessonData.steps[currentStep.value - 1]
})

// Methods
const selectSampleBook = (book) => {
  try {
    if (!book || !book.title || !book.author) {
      throw new Error('Invalid book data')
    }

    selectedBook.value = book

    if (toast) {
      toast.add({
        severity: 'success',
        summary: 'Книга выбрана',
        detail: `${book.title} - ${book.author}`,
        life: 3000
      })
    }
  } catch (err) {
    console.error('[Lesson9] Select book error:', err)

    if (toast) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось выбрать книгу',
        life: 3000
      })
    }
  }
}

const revealAnswer = (index) => {
  answersRevealed.value[index] = true
}

const copyPrompt = async (text) => {
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API not available')
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      console.warn('[Lesson9] Not in secure context, clipboard may not work')
    }

    await navigator.clipboard.writeText(text)

    if (toast) {
      toast.add({
        severity: 'success',
        summary: 'Скопировано',
        detail: 'Промпт скопирован в буфер обмена',
        life: 3000
      })
    }
  } catch (err) {
    console.error('[Lesson9] Copy failed:', err)

    if (toast) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось скопировать текст. Попробуйте выделить и скопировать вручную.',
        life: 3000
      })
    }

    // Fallback: try to use old execCommand method
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)

      if (toast) {
        toast.add({
          severity: 'success',
          summary: 'Скопировано',
          detail: 'Текст скопирован (использован резервный метод)',
          life: 3000
        })
      }
    } catch (fallbackErr) {
      console.error('[Lesson9] Fallback copy also failed:', fallbackErr)
      // Don't show another error, already showed one above
    }
  }
}

const nextStep = () => {
  try {
    if (currentStep.value < lessonData.totalSteps) {
      currentStep.value++
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (err) {
    console.error('[Lesson9] Next step error:', err)
  }
}

const previousStep = () => {
  try {
    if (currentStep.value > 1) {
      currentStep.value--
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (err) {
    console.error('[Lesson9] Previous step error:', err)
  }
}

const goToStep = (step) => {
  try {
    if (step >= 1 && step <= lessonData.totalSteps) {
      currentStep.value = step
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (err) {
    console.error('[Lesson9] Go to step error:', err)
  }
}

const completeLesson = () => {
  try {
    localStorage.setItem('tutorial_lesson9_completed', 'true')

    if (toast) {
      toast.add({
        severity: 'success',
        summary: 'Урок завершен!',
        detail: 'Поздравляем! Вы освоили машинное обучение для рекомендательных систем.',
        life: 5000
      })
    }

    router.push('/agents/tutorial/lesson-1')
  } catch (err) {
    console.error('[Lesson9] Complete lesson error:', err)

    if (toast) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось завершить урок',
        life: 3000
      })
    }
  }
}
</script>

<style scoped>
.lesson-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.step-content {
  margin-bottom: 2rem;
}

.step-section {
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.step-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

.step-icon i {
  font-size: 2.5rem;
  color: white;
}

.step-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.content-card {
  margin-bottom: 2rem;
}

/* Story Block */
.story-block {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.quote-box {
  padding: 1.5rem;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border-radius: 12px;
  border-left: 4px solid #3B82F6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.quote-box.story {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border-left-color: #F59E0B;
}

.quote-icon {
  font-size: 1.5rem;
  color: #3B82F6;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.story-text {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #78350F;
  margin: 0;
  font-style: italic;
}

.timeline-comparison {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  border: 2px solid #E5E7EB;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.timeline-marker {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3B82F6;
  flex-shrink: 0;
}

.timeline-item.present .timeline-marker {
  background: #10B981;
}

.timeline-arrow {
  text-align: center;
  color: #9CA3AF;
  font-size: 1.5rem;
}

.timeline-content h4 {
  margin: 0;
  font-size: 1rem;
  color: #1f2937;
}

.metaphor-box {
  padding: 1.5rem;
  background: linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%);
  border-radius: 12px;
  border-left: 4px solid #8B5CF6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.metaphor-icon {
  font-size: 1.5rem;
  color: #8B5CF6;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.metaphor-box p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #581C87;
  margin: 0;
}

/* Why Section */
.why-section {
  margin-top: 2rem;
}

.why-section h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
  text-align: center;
}

.reasons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.reason-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s ease;
}

.reason-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  transform: translateY(-4px);
}

.reason-icon {
  font-size: 2rem;
  color: #3B82F6;
  margin-bottom: 1rem;
}

.reason-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.reason-card p {
  font-size: 0.9rem;
  color: #6B7280;
  margin: 0;
}

/* Real Example Box */
.real-example-box {
  margin-top: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 12px;
  border: 2px solid #10B981;
}

.real-example-box h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #065F46;
  margin: 0 0 1rem 0;
}

.example-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.challenge, .solution, .results {
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.challenge strong, .solution strong, .results strong {
  color: #059669;
  display: block;
  margin-bottom: 0.5rem;
}

.results ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

.results li {
  color: #047857;
  margin-bottom: 0.5rem;
}

/* Types Grid */
.intro-text {
  margin-bottom: 2rem;
  font-size: 1.05rem;
  line-height: 1.6;
  color: #4B5563;
}

.types-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 2rem;
}

.type-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.type-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
}

.type-header {
  text-align: center;
  margin-bottom: 1rem;
}

.type-emoji {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
}

.type-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.type-description {
  text-align: center;
  font-size: 1.1rem;
  color: #6B7280;
  font-style: italic;
  margin-bottom: 1.5rem;
}

.how-it-works {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #F9FAFB;
  border-radius: 8px;
}

.how-it-works strong {
  color: #1f2937;
  display: block;
  margin-bottom: 0.5rem;
}

.pros-cons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.pros, .cons {
  padding: 1rem;
  border-radius: 8px;
}

.pros {
  background: #ECFDF5;
  border: 1px solid #10B981;
}

.cons {
  background: #FEF2F2;
  border: 1px solid #EF4444;
}

.pros h4 {
  color: #065F46;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.cons h4 {
  color: #991B1B;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.pros ul, .cons ul {
  margin: 0;
  padding-left: 1.5rem;
}

.pros li {
  color: #047857;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.cons li {
  color: #B91C1C;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.use-case {
  padding: 1rem;
  background: #EFF6FF;
  border-radius: 8px;
}

.use-case h4 {
  color: #1E40AF;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.use-case p {
  font-size: 0.9rem;
  color: #1E3A8A;
  margin: 0.5rem 0;
}

.tools {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.tool-chip {
  background-color: #DBEAFE;
  color: #1E40AF;
}

/* Decision Tree */
.decision-tree {
  margin-top: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
  border-radius: 12px;
  border: 2px solid #8B5CF6;
}

.decision-tree h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #5B21B6;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.decision-question {
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.question {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  color: #1f2937;
}

.question i {
  color: #8B5CF6;
  font-size: 1.25rem;
}

.answers {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 2rem;
}

.answer {
  font-size: 0.95rem;
  color: #4B5563;
}

.answer .label {
  font-weight: 600;
  color: #1f2937;
}

.answer.yes {
  color: #047857;
}

.answer.no {
  color: #B91C1C;
}

/* Task Section */
.explanation-block {
  margin-bottom: 1.5rem;
}

.task-description {
  margin-bottom: 1.5rem;
}

.task-description h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.task-description p {
  font-size: 1rem;
  color: #6B7280;
  margin: 0;
}

/* AI Tools */
.ai-tools {
  margin: 1.5rem 0;
}

.ai-tools h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #F9FAFB;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
  text-decoration: none;
  color: #1f2937;
  transition: all 0.3s ease;
}

.tool-card:hover {
  border-color: #3B82F6;
  background: #EFF6FF;
  transform: translateY(-2px);
}

.tool-card i {
  font-size: 1.5rem;
  color: #3B82F6;
}

/* Prompt Template */
.prompt-template {
  margin: 1.5rem 0;
}

.prompt-template h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.prompt-box {
  background: #1f2937;
  border-radius: 8px;
  padding: 1rem;
  position: relative;
}

.prompt-box pre {
  color: #F9FAFB;
  margin: 0 0 1rem 0;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* Examples Section */
.examples-section {
  margin: 2rem 0;
}

.examples-section h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.example-card {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
}

.example-header h5 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.example-header p {
  font-size: 0.95rem;
  color: #6B7280;
  font-style: italic;
  margin: 0 0 1rem 0;
}

.recommendations h6 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 1rem 0 0.75rem 0;
}

.recommendation-item {
  padding: 1rem;
  background: #F9FAFB;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.rec-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.rec-reason {
  font-size: 0.9rem;
  color: #6B7280;
  margin-bottom: 0.5rem;
}

.rec-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.similarity-chip {
  background-color: #DBEAFE;
  color: #1E40AF;
}

.score-chip {
  background-color: #FEF3C7;
  color: #78350F;
}

/* Interactive Demo */
.interactive-demo {
  margin: 2rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
  border-radius: 12px;
  border: 2px solid #0EA5E9;
}

.interactive-demo h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #0C4A6E;
  margin: 0 0 0.5rem 0;
}

.interactive-demo p {
  color: #075985;
  margin: 0 0 1rem 0;
}

.sample-books {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.sample-book-btn {
  flex: 0 0 auto;
}

.selected-book-info {
  margin-top: 1rem;
}

/* Tips Box */
.tips-box {
  margin: 1.5rem 0;
  padding: 1.25rem;
  background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
  border-radius: 12px;
  border-left: 4px solid #F59E0B;
}

.tips-box h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #78350F;
  margin: 0 0 0.75rem 0;
}

.tips-box ul {
  margin: 0;
  padding-left: 1.5rem;
}

.tips-box li {
  font-size: 0.95rem;
  color: #92400E;
  margin-bottom: 0.5rem;
}

/* Success Criteria */
.success-criteria {
  margin: 1.5rem 0;
}

.success-criteria h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.criteria-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.criteria-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #ECFDF5;
  border-radius: 8px;
}

.criteria-item i {
  color: #10B981;
  font-size: 1.25rem;
  flex-shrink: 0;
}

/* Concept Visualization */
.concept-viz {
  margin-bottom: 2rem;
}

.concept-viz h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.readers-viz {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.reader-card {
  padding: 1rem;
  background: white;
  border: 3px solid;
  border-radius: 8px;
}

.reader-card h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-chip-small {
  font-size: 0.85rem;
}

.logic-explanation {
  padding: 1.5rem;
  background: #F9FAFB;
  border-radius: 8px;
}

.logic-explanation h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.logic-explanation ul {
  margin: 0;
  padding-left: 1.5rem;
}

.logic-explanation li {
  font-size: 0.95rem;
  color: #4B5563;
  margin-bottom: 0.5rem;
}

/* Task Section */
.task-section {
  margin-bottom: 2rem;
}

.task-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

.sample-data {
  margin: 1.5rem 0;
}

.sample-data h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.books-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.book-chip-tiny {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Questions Section */
.questions-section {
  margin: 2rem 0;
}

.questions-section h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.question-card {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
}

.question-text {
  margin-bottom: 1rem;
  font-size: 1rem;
  color: #1f2937;
}

.hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #FEF3C7;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #78350F;
  margin-bottom: 1rem;
}

.hint i {
  color: #F59E0B;
}

.answer-revealed {
  margin-top: 1rem;
  padding: 1rem;
  background: #ECFDF5;
  border-radius: 8px;
  border: 2px solid #10B981;
}

.answer {
  margin-bottom: 0.75rem;
  color: #047857;
}

.explanation {
  color: #065F46;
  font-size: 0.95rem;
}

/* AI Helper */
.ai-helper {
  margin: 2rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
  border-radius: 12px;
  border: 2px solid #0EA5E9;
}

.ai-helper h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0C4A6E;
  margin: 0 0 1rem 0;
}

.helper-prompt h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #075985;
  margin: 0 0 0.75rem 0;
}

.helper-prompt pre {
  background: #1f2937;
  color: #F9FAFB;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.expected-response {
  margin-top: 1.5rem;
}

.expected-response h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #075985;
  margin: 0 0 0.75rem 0;
}

.response-box {
  background: white;
  padding: 1rem;
  border-radius: 8px;
}

.response-box pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #1f2937;
}

/* Real World Application */
.real-world-app {
  margin: 2rem 0;
}

.real-world-app h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.step-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.step-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.step-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.step-card p {
  font-size: 0.95rem;
  color: #4B5563;
  margin: 0 0 1rem 0;
}

.meta-info {
  font-size: 0.9rem;
  color: #6B7280;
  margin-top: 0.75rem;
}

.meta-info strong {
  color: #1f2937;
}

.meta-info ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

/* Why Automate */
.why-automate {
  margin-bottom: 2rem;
}

.why-automate h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.benefit-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s ease;
}

.benefit-card:hover {
  border-color: #10B981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  transform: translateY(-4px);
}

.benefit-icon {
  font-size: 2rem;
  color: #10B981;
  margin-bottom: 1rem;
}

.benefit-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.benefit-card p {
  font-size: 0.9rem;
  color: #6B7280;
  margin: 0;
}

/* Scenario Box */
.scenario-box {
  margin: 2rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border-radius: 12px;
  border: 2px solid #F59E0B;
}

.scenario-box h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #78350F;
  margin: 0 0 0.75rem 0;
}

.scenario-box > p {
  color: #92400E;
  margin: 0 0 1.5rem 0;
}

.scenario-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-item {
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.detail-item strong {
  display: block;
  margin-bottom: 0.5rem;
}

.detail-item.situation strong {
  color: #0284C7;
}

.detail-item.challenge strong {
  color: #DC2626;
}

.detail-item.solution strong {
  color: #059669;
}

/* Demo Section */
.demo-section {
  margin: 2rem 0;
}

.demo-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

.demo-section > p {
  color: #6B7280;
  margin: 0 0 1.5rem 0;
}

.sample-readers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.demo-reader-card {
  padding: 1rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
}

.demo-reader-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.reader-info {
  font-size: 0.9rem;
  color: #4B5563;
}

.reader-info strong {
  display: block;
  margin-top: 0.75rem;
  color: #1f2937;
}

.reader-info ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

/* Process Steps */
.process-steps {
  margin: 2rem 0;
}

.process-steps h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.process-step {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.step-number {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content h5 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.step-content p {
  font-size: 0.95rem;
  color: #6B7280;
  margin: 0 0 1rem 0;
}

.code-block {
  background: #1f2937;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.code-block pre {
  color: #F9FAFB;
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.output-info, .channels-info {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #4B5563;
}

.channels-info ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

/* Expected Results */
.expected-results {
  margin: 2rem 0;
}

.expected-results h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.improvement-chip {
  background-color: #D1FAE5;
  color: #065F46;
  font-weight: 600;
}

/* Practical Guide */
.practical-guide {
  margin: 2rem 0;
}

.practical-guide h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.guide-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.guide-option {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
}

.guide-option.advanced {
  border-color: #8B5CF6;
}

.guide-option h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.guide-option ol {
  margin: 0 0 1rem 0;
  padding-left: 1.5rem;
}

.guide-option li {
  font-size: 0.95rem;
  color: #4B5563;
  margin-bottom: 0.5rem;
}

.tools-list ul {
  margin: 0.5rem 0 1rem 0;
  padding-left: 1.5rem;
}

.tools-list li {
  font-size: 0.95rem;
  color: #4B5563;
  margin-bottom: 0.5rem;
}

.time-estimate {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #F9FAFB;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #6B7280;
  font-weight: 600;
}

.time-estimate i {
  color: #3B82F6;
}

/* Real Case */
.real-case {
  margin: 2rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 12px;
  border: 2px solid #10B981;
}

.real-case h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #065F46;
  margin: 0 0 1.5rem 0;
}

.case-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.problem, .solution, .implementation, .results {
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.problem strong {
  color: #DC2626;
  display: block;
  margin-bottom: 0.5rem;
}

.solution strong {
  color: #0284C7;
  display: block;
  margin-bottom: 0.5rem;
}

.implementation strong {
  color: #7C3AED;
  display: block;
  margin-bottom: 0.5rem;
}

.results strong {
  color: #059669;
  display: block;
  margin-bottom: 0.5rem;
}

.implementation ul, .results-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

.implementation li {
  color: #4B5563;
  margin-bottom: 0.5rem;
}

.result-item {
  color: #047857;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.result-item i {
  color: #10B981;
  margin-top: 0.25rem;
  flex-shrink: 0;
}

/* Summary Section */
.summary-section {
  margin-bottom: 2rem;
}

.summary-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.summary-points {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-point {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: #F9FAFB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.summary-point:hover {
  background: #F3F4F6;
  transform: translateX(5px);
}

.point-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.summary-point p {
  font-size: 1rem;
  line-height: 1.6;
  color: #1f2937;
  margin: 0.25rem 0 0 0;
}

/* Roadmap Section */
.roadmap-section {
  margin-bottom: 2rem;
}

.roadmap-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.phases-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.phase-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.phase-card:hover {
  border-color: #8B5CF6;
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.2);
  transform: translateY(-4px);
}

.phase-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #E5E7EB;
}

.phase-header i {
  font-size: 1.75rem;
  color: #8B5CF6;
}

.phase-header h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.phase-tasks ul {
  margin: 0 0 1rem 0;
  padding-left: 1.5rem;
}

.phase-tasks li {
  font-size: 0.95rem;
  color: #4B5563;
  margin-bottom: 0.5rem;
}

.phase-deliverable {
  padding: 0.75rem;
  background: #F3F4F6;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #374151;
}

.phase-deliverable strong {
  color: #1f2937;
}

/* Quick Wins */
.quick-wins {
  margin-bottom: 2rem;
}

.quick-wins h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.wins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.win-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.win-card:hover {
  border-color: #10B981;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2);
  transform: translateY(-4px);
}

.win-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.win-header h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  flex: 1;
}

.time-chip {
  background-color: #DBEAFE;
  color: #1E40AF;
  white-space: nowrap;
}

.win-card p {
  font-size: 0.95rem;
  color: #6B7280;
  margin: 0 0 1rem 0;
}

.win-impact {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #ECFDF5;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #065F46;
}

.win-impact i {
  color: #10B981;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

/* Tools Section */
.tools-section {
  margin-bottom: 2rem;
}

.tools-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.essential-tools, .advanced-tools {
  margin-bottom: 2rem;
}

.essential-tools h4, .advanced-tools h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tool-item {
  padding: 1rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.tool-item:hover {
  border-color: #3B82F6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.tool-item.advanced {
  border-color: #E9D5FF;
}

.tool-item.advanced:hover {
  border-color: #8B5CF6;
}

.tool-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.tool-name strong {
  font-size: 1rem;
  color: #1f2937;
}

.tool-purpose {
  font-size: 0.95rem;
  color: #6B7280;
  margin-bottom: 0.5rem;
}

.tool-cost {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #059669;
  font-weight: 600;
}

.tool-cost i {
  color: #10B981;
}

/* Metrics Section */
.metrics-section {
  margin-bottom: 2rem;
}

.metrics-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

/* Mistakes Section */
.mistakes-section {
  margin-bottom: 2rem;
}

.mistakes-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.mistakes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mistake-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #FCA5A5;
  border-radius: 12px;
}

.mistake-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: #DC2626;
}

.mistake-title i {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.mistake-title strong {
  font-size: 1rem;
}

.mistake-why {
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  color: #6B7280;
}

.mistake-why strong {
  color: #1f2937;
}

.mistake-solution {
  padding: 0.75rem;
  background: #ECFDF5;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #065F46;
}

.mistake-solution strong {
  color: #047857;
}

/* Community Section */
.community-section {
  margin-bottom: 2rem;
}

.community-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.resource-card {
  padding: 1.5rem;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.resource-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-4px);
}

.resource-card h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

.resource-card p {
  font-size: 0.95rem;
  color: #6B7280;
  margin: 0 0 1rem 0;
}

.resource-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.resource-meta .benefit {
  font-size: 0.9rem;
  color: #059669;
  font-weight: 600;
}

/* Inspiration Section */
.inspiration-section {
  margin-bottom: 2rem;
}

.inspiration-section h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.case-card {
  padding: 1.5rem;
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border: 2px solid #F59E0B;
  border-radius: 12px;
}

.case-card h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #78350F;
  margin: 0 0 1rem 0;
}

.case-achievement {
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  color: #92400E;
}

.case-achievement strong {
  color: #78350F;
}

.case-result {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #92400E;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
}

.case-result strong {
  color: #78350F;
}

.case-quote {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  font-style: italic;
  color: #92400E;
}

.case-quote i {
  color: #F59E0B;
  font-size: 1.25rem;
  flex-shrink: 0;
}

/* Final Message */
.final-message {
  margin-top: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
  border-radius: 12px;
  border: 2px solid #8B5CF6;
  text-align: center;
}

.final-message h3 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #5B21B6;
  margin: 0 0 1.5rem 0;
}

.message-text {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #6D28D9;
  margin: 0 0 1.5rem 0;
}

.cta-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
}

.cta-box i {
  font-size: 1.75rem;
  color: #F59E0B;
}

.cta-box p {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

/* Navigation Buttons */
.navigation-buttons {
  display: flex;
  gap: 1rem;
  padding: 2rem 0;
  border-top: 2px solid #E5E7EB;
}

.spacer {
  flex: 1;
}

@media (max-width: 768px) {
  .lesson-container {
    padding: 1rem;
  }

  .step-header h2 {
    font-size: 1.5rem;
  }

  .step-icon {
    width: 64px;
    height: 64px;
  }

  .step-icon i {
    font-size: 2rem;
  }

  .reasons-grid,
  .types-grid,
  .benefits-grid,
  .wins-grid,
  .phases-timeline,
  .resources-grid,
  .cases-grid {
    grid-template-columns: 1fr;
  }

  .pros-cons {
    grid-template-columns: 1fr;
  }

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>

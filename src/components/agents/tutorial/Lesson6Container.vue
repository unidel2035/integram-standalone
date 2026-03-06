<template>
  <div class="lesson6-container">
    <!-- Header -->
    <div class="lesson-header">
      <div class="header-content">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          @click="goBack"
          class="back-btn"
        />
        <div class="header-title">
          <h1>📊 {{ lessonData.title }}</h1>
          <p>{{ lessonData.subtitle }}</p>
          <small>Лектор: {{ lessonData.lecturer }}</small>
        </div>
      </div>
      <div class="lesson-progress">
        <Tag :value="`Урок 6 - Шаг ${currentStep}/${lessonData.totalSteps}`" severity="info" />
      </div>
    </div>

    <!-- Steps Navigation -->
    <div class="steps-navigation">
      <div class="steps-list">
        <div
          v-for="step in lessonData.steps"
          :key="step.id"
          class="step-item"
          :class="{ 'active': currentStep === step.id, 'completed': completedSteps.includes(step.id) }"
          @click="goToStep(step.id)"
        >
          <div class="step-number">{{ step.id }}</div>
          <div class="step-info">
            <i :class="step.icon"></i>
            <div class="step-title">{{ step.title }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="lesson-content">
      <!-- Step 1: История и введение -->
      <div v-show="currentStep === 1" class="step-content">
        <Card class="story-card">
          <template #title>
            <h2>📜 История, которая изменит ваше представление о данных</h2>
          </template>
          <template #content>
            <div class="story-timeline">
              <div class="timeline-item">
                <div class="timeline-marker">{{ lessonData.steps[0].content.story.year }}</div>
                <div class="timeline-content">
                  <h3>{{ lessonData.steps[0].content.story.place }}</h3>
                  <p><strong>Проблема:</strong> {{ lessonData.steps[0].content.story.problem }}</p>
                  <p><strong>Герой:</strong> {{ lessonData.steps[0].content.story.hero }}</p>
                  <p><strong>Решение:</strong> {{ lessonData.steps[0].content.story.solution }}</p>
                </div>
              </div>
              <div class="timeline-item modern">
                <div class="timeline-marker">Сегодня</div>
                <div class="timeline-content">
                  <p class="highlight">{{ lessonData.steps[0].content.story.modernParallel }}</p>
                </div>
              </div>
            </div>

            <div class="key-facts">
              <h3>Ключевые факты</h3>
              <div class="facts-grid">
                <div v-for="fact in lessonData.steps[0].content.keyFacts" :key="fact.period" class="fact-card">
                  <Tag :value="fact.period" severity="info" />
                  <p>{{ fact.fact }}</p>
                </div>
              </div>
            </div>

            <Message severity="info" :closable="false" class="metaphor-message">
              <strong>Ключевая метафора:</strong><br>
              {{ lessonData.steps[0].content.keyMetaphor }}
            </Message>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Далее: Два лика данных"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 2: Два лика данных -->
      <div v-show="currentStep === 2" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>Два лика данных — драматическое противостояние</h2>
          </template>
        </Card>

        <div class="data-types-comparison">
          <!-- Структурированные данные -->
          <Card class="data-type-card structured">
            <template #title>
              <div class="card-title-with-emoji">
                <span class="emoji">{{ lessonData.steps[1].content.structuredData.emoji }}</span>
                <div>
                  <h3>{{ lessonData.steps[1].content.structuredData.title }}</h3>
                  <p class="subtitle">{{ lessonData.steps[1].content.structuredData.subtitle }}</p>
                </div>
              </div>
            </template>
            <template #content>
              <div class="characteristics">
                <h4>Характеристики:</h4>
                <div class="char-list">
                  <div v-for="char in lessonData.steps[1].content.structuredData.characteristics" :key="char.text" class="char-item">
                    <i :class="char.icon"></i>
                    <span>{{ char.text }}</span>
                  </div>
                </div>
              </div>

              <div class="examples">
                <h4>Примеры в библиотеке:</h4>
                <div class="examples-grid">
                  <Tag v-for="example in lessonData.steps[1].content.structuredData.examples" :key="example" :value="example" />
                </div>
              </div>

              <div class="success-story">
                <h4>🏆 История успеха:</h4>
                <p>
                  <strong>{{ lessonData.steps[1].content.structuredData.successStory.organization }}</strong>
                  {{ lessonData.steps[1].content.structuredData.successStory.achievement }}
                </p>
                <Tag :value="lessonData.steps[1].content.structuredData.successStory.result" severity="success" />
              </div>
            </template>
          </Card>

          <!-- Неструктурированные данные -->
          <Card class="data-type-card unstructured">
            <template #title>
              <div class="card-title-with-emoji">
                <span class="emoji">{{ lessonData.steps[1].content.unstructuredData.emoji }}</span>
                <div>
                  <h3>{{ lessonData.steps[1].content.unstructuredData.title }}</h3>
                  <p class="subtitle">{{ lessonData.steps[1].content.unstructuredData.subtitle }}</p>
                </div>
              </div>
            </template>
            <template #content>
              <div class="characteristics">
                <h4>Характеристики:</h4>
                <div class="char-list">
                  <div v-for="char in lessonData.steps[1].content.unstructuredData.characteristics" :key="char.text" class="char-item">
                    <i :class="char.icon"></i>
                    <span>{{ char.text }}</span>
                  </div>
                </div>
              </div>

              <div class="examples">
                <h4>Примеры в библиотеке:</h4>
                <div class="examples-grid">
                  <Tag v-for="example in lessonData.steps[1].content.unstructuredData.examples" :key="example" :value="example" severity="warning" />
                </div>
              </div>

              <div class="success-story">
                <h4>🏆 История успеха:</h4>
                <p>
                  <strong>{{ lessonData.steps[1].content.unstructuredData.successStory.organization }}</strong>
                  {{ lessonData.steps[1].content.unstructuredData.successStory.achievement }}
                </p>
                <Tag :value="lessonData.steps[1].content.unstructuredData.successStory.result" severity="success" />
              </div>
            </template>
          </Card>
        </div>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Умные примеры"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 3: Умные примеры -->
      <div v-show="currentStep === 3" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>🔥 Умные примеры, которые взорвут ваше сознание</h2>
          </template>
        </Card>

        <div class="smart-cases">
          <Card v-for="case_ in lessonData.steps[2].content.cases" :key="case_.id" class="smart-case-card">
            <template #title>
              <div class="case-title">
                <span class="emoji-large">{{ case_.emoji }}</span>
                <h3>{{ case_.title }}</h3>
              </div>
            </template>
            <template #content>
              <p class="case-description">{{ case_.description }}</p>

              <div class="data-types-breakdown">
                <div class="data-type-column">
                  <h4>📊 Структурированные:</h4>
                  <ul>
                    <li v-for="item in case_.dataTypes.structured" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="data-type-column">
                  <h4>💬 Неструктурированные:</h4>
                  <ul>
                    <li v-for="item in case_.dataTypes.unstructured" :key="item">{{ item }}</li>
                  </ul>
                </div>
              </div>

              <div class="case-result">
                <strong>Результат:</strong> {{ case_.result }}
              </div>
            </template>
          </Card>
        </div>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Инструменты"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 4: Волшебные инструменты -->
      <div v-show="currentStep === 4" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>🛠️ Волшебные инструменты преображения</h2>
          </template>
        </Card>

        <Card class="transformation-card">
          <template #title>
            <h3>{{ lessonData.steps[3].content.transformation1.title }}</h3>
          </template>
          <template #content>
            <div class="transformation-demo">
              <div class="before-after">
                <div class="before">
                  <Tag value="ДО" severity="danger" />
                  <p class="query">{{ lessonData.steps[3].content.transformation1.before }}</p>
                  <small class="note">{{ lessonData.steps[3].content.transformation1.beforeNote }}</small>
                </div>
                <div class="arrow">
                  <i class="pi pi-arrow-right"></i>
                </div>
                <div class="after">
                  <Tag value="ПОСЛЕ" severity="success" />
                  <p class="query">{{ lessonData.steps[3].content.transformation1.after }}</p>
                  <small class="note">{{ lessonData.steps[3].content.transformation1.afterNote }}</small>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="process-card">
          <template #title>
            <h3>{{ lessonData.steps[3].content.transformation2.title }}</h3>
          </template>
          <template #content>
            <div class="process-steps">
              <div v-for="step in lessonData.steps[3].content.transformation2.steps" :key="step.number" class="process-step">
                <div class="step-icon" :style="{ backgroundColor: step.color }">
                  <i :class="step.icon"></i>
                </div>
                <div class="step-details">
                  <h4>Шаг {{ step.number }}: {{ step.title }}</h4>
                  <p class="tool-name">{{ step.tool }}</p>
                  <p class="tool-description">{{ step.description }}</p>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Практика"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
            :disabled="false"
          />
        </div>
      </div>

      <!-- Interactive Game: Library Journey -->
      <div v-show="showLibraryGame" class="step-content">
        <LibraryJourneyGame @return-to-lesson="closeGame" />
      </div>

      <!-- Step 5: Практическое задание 1 -->
      <div v-show="currentStep === 5 && !showLibraryGame" class="step-content" id="step-5-content">
        <Card class="intro-card">
          <template #title>
            <h2>✏️ {{ lessonData.steps[4].content.title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[4].content.description }}</p>
            <Message severity="info" :closable="false">
              <strong>Цель:</strong> {{ lessonData.steps[4].content.task.objective }}
            </Message>

            <!-- Game Launch Button -->
            <Card class="game-launch-card mt-4">
              <template #title>
                <h3>🎮 Интерактивное путешествие</h3>
              </template>
              <template #content>
                <p>
                  Прежде чем приступить к практическим заданиям, пройдите интерактивное путешествие по Библиотеке Данных!
                  В этой игре вы примените полученные знания на практике с помощью AI.
                </p>
                <Message severity="success" :closable="false" class="mt-2">
                  <strong>Особенности:</strong>
                  <ul class="mt-2">
                    <li>5 увлекательных этапов работы с неструктурированными данными</li>
                    <li>Реальная интеграция с DeepSeek AI</li>
                    <li>Игровая механика с очками и достижениями</li>
                    <li>Влияние ваших решений на судьбу библиотеки</li>
                  </ul>
                </Message>
                <Button
                  label="Начать путешествие"
                  icon="pi pi-play-circle"
                  @click="launchGame"
                  severity="success"
                  size="large"
                  class="mt-3 w-full"
                />
              </template>
            </Card>
          </template>
        </Card>

        <Card class="exercise-card">
          <template #title>
            <h3>Задание</h3>
          </template>
          <template #content>
            <div class="instructions">
              <ol>
                <li v-for="instruction in lessonData.steps[4].content.task.instructions" :key="instruction">{{ instruction }}</li>
              </ol>
            </div>

            <div class="fields-overview">
              <div class="fields-section">
                <h4>📊 Структурированные поля:</h4>
                <div class="field-list">
                  <div v-for="field in lessonData.steps[4].content.task.fields.structured" :key="field.name" class="field-item">
                    <strong>{{ field.name }}</strong>
                    <Tag :value="field.type" />
                    <p class="example">Пример: {{ field.example }}</p>
                  </div>
                </div>
              </div>

              <div class="fields-section">
                <h4>💬 Неструктурированные поля:</h4>
                <div class="field-list">
                  <div v-for="field in lessonData.steps[4].content.task.fields.unstructured" :key="field.name" class="field-item">
                    <strong>{{ field.name }}</strong>
                    <Tag :value="field.type" severity="warning" />
                    <p class="example">Пример: {{ field.example }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="quiz-section">
              <h4>Проверьте себя:</h4>
              <p class="quiz-question">{{ lessonData.steps[4].content.quiz.question }}</p>
              <div class="quiz-options">
                <div
                  v-for="option in lessonData.steps[4].content.quiz.options"
                  :key="option.id"
                  class="quiz-option"
                  :class="{ 'selected': task1Answer === option.id, 'correct': task1Checked && option.correct, 'incorrect': task1Checked && task1Answer === option.id && !option.correct }"
                  @click="task1Answer = option.id"
                >
                  <RadioButton v-model="task1Answer" :inputId="option.id" :value="option.id" />
                  <label :for="option.id">{{ option.text }}</label>
                </div>
              </div>
              <Button
                v-if="!task1Checked"
                label="Проверить ответ"
                @click="checkTask1Answer"
                :disabled="!task1Answer"
                class="check-btn"
              />
              <Message v-if="task1Checked" :severity="task1Correct ? 'success' : 'error'" :closable="false">
                {{ task1Correct ? 'Правильно!' : 'Неправильно.' }}
                {{ lessonData.steps[4].content.quiz.explanation }}
              </Message>
            </div>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Задание 2"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="!task1Checked || !task1Correct"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 6: Практическое задание 2 -->
      <div v-show="currentStep === 6" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>🧹 {{ lessonData.steps[5].content.title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[5].content.description }}</p>
            <Message severity="warn" :closable="false">
              <strong>Сценарий:</strong> {{ lessonData.steps[5].content.task.scenario }}
            </Message>
          </template>
        </Card>

        <Card class="data-cleaning-card">
          <template #title>
            <h3>Проблемы в данных</h3>
          </template>
          <template #content>
            <div class="problems-list">
              <div v-for="problem in lessonData.steps[5].content.task.problems" :key="problem.type" class="problem-item">
                <h4>{{ problem.type }}</h4>
                <ul>
                  <li v-for="example in problem.examples" :key="example">{{ example }}</li>
                </ul>
                <Tag :value="problem.solution" severity="info" />
              </div>
            </div>

            <div class="cleaning-steps">
              <h4>Шаги очистки:</h4>
              <div class="steps-timeline">
                <div v-for="step in lessonData.steps[5].content.task.cleaningSteps" :key="step.step" class="cleaning-step">
                  <div class="step-number">{{ step.step }}</div>
                  <div class="step-content">
                    <h5>{{ step.action }}</h5>
                    <div class="before-after-inline">
                      <div class="before-inline">
                        <Tag value="До" severity="danger" />
                        <code>{{ step.before }}</code>
                      </div>
                      <i class="pi pi-arrow-right"></i>
                      <div class="after-inline">
                        <Tag value="После" severity="success" />
                        <code>{{ step.after }}</code>
                      </div>
                    </div>
                    <p class="rule">Правило: {{ step.rule }}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="exercise-card">
          <template #title>
            <h3>Практическое упражнение</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[5].content.exercise.instruction }}</p>
            <div class="data-table">
              <h4>Исходные данные:</h4>
              <DataTable :value="lessonData.steps[5].content.exercise.testData" class="p-datatable-sm">
                <Column field="isbn" header="ISBN" />
                <Column field="author" header="Автор" />
                <Column field="title" header="Название" />
                <Column field="year" header="Год" />
                <Column field="category" header="Категория" />
              </DataTable>
            </div>
            <div class="data-table">
              <h4>Ожидаемый результат:</h4>
              <DataTable :value="lessonData.steps[5].content.exercise.expectedResult" class="p-datatable-sm">
                <Column field="isbn" header="ISBN" />
                <Column field="author" header="Автор" />
                <Column field="title" header="Название" />
                <Column field="year" header="Год" />
                <Column field="category" header="Категория" />
              </DataTable>
            </div>
            <Button
              label="Понятно, перехожу к следующему заданию"
              icon="pi pi-check"
              @click="markTask2Complete"
              :disabled="task2Complete"
              class="complete-btn"
            />
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Задание 3"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="!task2Complete"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 7: Практическое задание 3 -->
      <div v-show="currentStep === 7" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>💬 {{ lessonData.steps[6]?.content?.title || 'Практическое задание 3' }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[6]?.content?.description || '' }}</p>
            <Message v-if="lessonData.steps[6]?.content?.task?.scenario" severity="info" :closable="false">
              <strong>Сценарий:</strong> {{ lessonData.steps[6].content.task.scenario }}
            </Message>
          </template>
        </Card>

        <Card v-if="lessonData.steps[6]?.content?.task?.sampleReviews" class="reviews-card">
          <template #title>
            <h3>Примеры отзывов</h3>
          </template>
          <template #content>
            <div class="reviews-list">
              <div v-for="(review, index) in lessonData.steps[6].content.task.sampleReviews" :key="index" class="review-item">
                <div class="review-header">
                  <strong>{{ review.bookTitle }}</strong>
                  <small>{{ review.reader }}, {{ review.date }}</small>
                </div>
                <p class="review-text">{{ review.review }}</p>
              </div>
            </div>
          </template>
        </Card>

        <Card v-if="lessonData.steps[6]?.content?.task?.analysisTypes" class="analysis-card">
          <template #title>
            <h3>Типы анализа</h3>
          </template>
          <template #content>
            <Accordion>
              <AccordionTab v-for="analysis in lessonData.steps[6].content.task.analysisTypes" :key="analysis.type" :header="analysis.type">
                <p><strong>Описание:</strong> {{ analysis.description }}</p>
                <p><strong>Техника:</strong> {{ analysis.technique }}</p>
                <div v-if="analysis.positiveWords" class="word-lists">
                  <div>
                    <h5>Позитивные слова:</h5>
                    <div class="tags-list">
                      <Tag v-for="word in analysis.positiveWords" :key="word" :value="word" severity="success" />
                    </div>
                  </div>
                  <div>
                    <h5>Негативные слова:</h5>
                    <div class="tags-list">
                      <Tag v-for="word in analysis.negativeWords" :key="word" :value="word" severity="danger" />
                    </div>
                  </div>
                </div>
                <div v-if="analysis.examples" class="examples-table">
                  <DataTable :value="analysis.examples" class="p-datatable-sm">
                    <Column field="review" header="Отзыв #" />
                    <Column v-if="analysis.type === 'Анализ тональности'" field="sentiment" header="Тональность" />
                    <Column v-if="analysis.type === 'Анализ тональности'" field="confidence" header="Уверенность" />
                    <Column v-if="analysis.type === 'Извлечение рейтинга'" field="rating" header="Рейтинг" />
                    <Column v-if="analysis.type === 'Извлечение рейтинга'" field="extractedFrom" header="Источник" />
                    <Column field="keywords" header="Ключевые слова">
                      <template #body="slotProps">
                        <span v-if="Array.isArray(slotProps.data.keywords)">{{ slotProps.data.keywords.join(', ') }}</span>
                        <span v-else>{{ slotProps.data.keywords }}</span>
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </AccordionTab>
            </Accordion>
          </template>
        </Card>

        <Card v-if="lessonData.steps[6]?.content?.task" class="practical-task-card">
          <template #title>
            <h3>Практическое задание</h3>
          </template>
          <template #content>
            <p v-if="lessonData.steps[6]?.content?.task?.objective">
              <strong>Цель:</strong> {{ lessonData.steps[6].content.task.objective }}
            </p>
            <p v-if="lessonData.steps[6]?.content?.task?.scenario">
              <strong>Сценарий:</strong> {{ lessonData.steps[6].content.task.scenario }}
            </p>
            <p v-if="lessonData.steps[6]?.content?.task?.challenge">
              <strong>Вызов:</strong> {{ lessonData.steps[6].content.task.challenge }}
            </p>

            <div v-if="lessonData.steps[6]?.content?.task?.steps" class="task-steps">
              <h4>Шаги выполнения:</h4>
              <ol>
                <li v-for="step in lessonData.steps[6].content.task.steps" :key="step.step">
                  <strong>{{ step.action }}</strong>
                  <p v-if="step.description">{{ step.description }}</p>
                  <pre v-if="step.prompt" class="step-prompt">{{ step.prompt }}</pre>
                </li>
              </ol>
            </div>

            <div v-if="lessonData.steps[6]?.content?.task?.exercise" class="exercise-info">
              <h4>Упражнение:</h4>
              <p><strong>Задание:</strong> {{ lessonData.steps[6].content.task.exercise.task }}</p>
              <div v-if="lessonData.steps[6].content.task.exercise.datasets" class="datasets-list">
                <h5>Наборы данных для создания:</h5>
                <ul>
                  <li v-for="dataset in lessonData.steps[6].content.task.exercise.datasets" :key="dataset.name">
                    <strong>{{ dataset.name }}</strong>: {{ dataset.fields }}
                  </li>
                </ul>
              </div>
              <p v-if="lessonData.steps[6].content.task.exercise.timeLimit">
                <strong>Время:</strong> {{ lessonData.steps[6].content.task.exercise.timeLimit }}
              </p>
            </div>

            <div class="task-questions">
              <div v-for="(question, index) in []" :key="index" class="task-question">
                <p class="question-text">{{ question.question }}</p>
                <div v-if="Array.isArray(question.options)" class="question-options">
                  <div
                    v-for="option in question.options"
                    :key="option"
                    class="question-option"
                    :class="{ 'selected': task3Answers[index] === option, 'correct': task3Checked[index] && option === question.correct, 'incorrect': task3Checked[index] && task3Answers[index] === option && option !== question.correct }"
                    @click="task3Answers[index] = option"
                  >
                    <RadioButton v-model="task3Answers[index]" :inputId="`q${index}-${option}`" :value="option" />
                    <label :for="`q${index}-${option}`">{{ option }}</label>
                  </div>
                  <Button
                    v-if="!task3Checked[index]"
                    label="Проверить"
                    @click="checkTask3Answer(index)"
                    :disabled="!task3Answers[index]"
                    size="small"
                  />
                  <Message v-if="task3Checked[index]" :severity="task3Answers[index] === question.correct ? 'success' : 'error'" :closable="false">
                    {{ task3Answers[index] === question.correct ? 'Правильно!' : 'Неправильно.' }}
                    {{ question.explanation }}
                  </Message>
                </div>
                <div v-else class="free-answer">
                  <InputText v-model="task3Answers[index]" placeholder="Ваш ответ" class="w-full" />
                  <Button
                    v-if="!task3Checked[index]"
                    label="Проверить"
                    @click="checkTask3Answer(index)"
                    :disabled="!task3Answers[index]"
                    size="small"
                  />
                  <Message v-if="task3Checked[index]" severity="info" :closable="false">
                    {{ question.explanation }}
                  </Message>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Заключение"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="false"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 8: Будущее и заключение -->
      <div v-show="currentStep === 8" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>🚀 Будущее, которое уже здесь</h2>
          </template>
        </Card>

        <div v-if="lessonData.steps[7]?.content?.scenarios" class="scenarios-grid">
          <Card v-for="scenario in lessonData.steps[7].content.scenarios" :key="scenario.id" class="scenario-card">
            <template #title>
              <div class="scenario-title">
                <span class="emoji-large">{{ scenario.emoji }}</span>
                <h3>{{ scenario.title }}</h3>
              </div>
            </template>
            <template #content>
              <p>{{ scenario.description }}</p>
              <ul>
                <li v-for="feature in scenario.features" :key="feature">{{ feature }}</li>
              </ul>
            </template>
          </Card>
        </div>

        <Message v-if="lessonData.steps[7]?.content?.keyTakeaway" severity="success" :closable="false" class="key-takeaway">
          <strong>Ключевая мысль:</strong><br>
          {{ lessonData.steps[7].content.keyTakeaway }}
        </Message>

        <Card v-if="lessonData.steps[7]?.content?.finalTask" class="final-task-card">
          <template #title>
            <h3>{{ lessonData.steps[7].content.finalTask.title }}</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[7].content.finalTask.description }}</p>

            <div v-if="lessonData.steps[7].content.finalTask.example" class="example-transformation">
              <div class="unstructured-example">
                <Tag value="Неструктурированный запрос" severity="warning" />
                <p class="example-text">{{ lessonData.steps[7].content.finalTask.example.unstructuredQuery }}</p>
              </div>
              <i class="pi pi-arrow-down transform-arrow"></i>
              <div class="structured-example">
                <Tag value="Структурированные данные" severity="success" />
                <div class="structured-data-table">
                  <div v-for="(value, key) in lessonData.steps[7].content.finalTask.example.structuredData" :key="key" class="data-row">
                    <strong>{{ key }}:</strong>
                    <span v-if="Array.isArray(value)">{{ value.join(', ') }}</span>
                    <span v-else>{{ value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card v-if="lessonData.steps[7]?.content?.secretFormula" class="formula-card">
          <template #title>
            <h3>{{ lessonData.steps[7].content.secretFormula.title }}</h3>
          </template>
          <template #content>
            <div class="formula">
              {{ lessonData.steps[7].content.secretFormula.formula }}
            </div>
            <p class="conclusion">{{ lessonData.steps[7].content.secretFormula.conclusion }}</p>
          </template>
        </Card>

        <Card v-if="lessonData.steps[7]?.content?.quiz" class="quiz-card">
          <template #title>
            <h3>{{ lessonData.steps[7].content.quiz.title || 'Итоговый тест' }}</h3>
          </template>
          <template #content>
            <div v-for="(question, qIndex) in lessonData.steps[7].content.quiz.questions || []" :key="qIndex" class="final-quiz-question">
              <p class="quiz-question">{{ qIndex + 1 }}. {{ question.question }}</p>
              <div class="quiz-options">
                <div
                  v-for="option in question.options"
                  :key="option.id"
                  class="quiz-option"
                  :class="{ 'selected': finalQuizAnswers[qIndex] === option.id, 'correct': finalQuizChecked[qIndex] && option.correct, 'incorrect': finalQuizChecked[qIndex] && finalQuizAnswers[qIndex] === option.id && !option.correct }"
                  @click="finalQuizAnswers[qIndex] = option.id"
                >
                  <RadioButton v-model="finalQuizAnswers[qIndex]" :inputId="`fq${qIndex}-${option.id}`" :value="option.id" />
                  <label :for="`fq${qIndex}-${option.id}`">{{ option.text }}</label>
                </div>
              </div>
              <Button
                v-if="!finalQuizChecked[qIndex]"
                label="Проверить"
                @click="checkFinalQuizAnswer(qIndex)"
                :disabled="!finalQuizAnswers[qIndex]"
                size="small"
              />
              <Message v-if="finalQuizChecked[qIndex]" :severity="finalQuizAnswers[qIndex] === question.options.find(o => o.correct)?.id ? 'success' : 'error'" :closable="false">
                {{ finalQuizAnswers[qIndex] === question.options.find(o => o.correct)?.id ? 'Правильно!' : 'Неправильно, попробуйте ещё раз.' }}
              </Message>
            </div>

            <Button
              v-if="allFinalQuizCorrect"
              label="Завершить урок"
              icon="pi pi-check-circle"
              @click="completeLesson"
              severity="success"
              class="complete-lesson-btn"
            />
          </template>
        </Card>

        <Card v-if="lessonCompleted && lessonData.steps[7]?.content?.certificate" class="certificate-card">
          <template #title>
            <h3>🎓 {{ lessonData.steps[7].content.certificate.title || 'Сертификат об освоении' }}</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[7].content.certificate.description || '' }}</p>
            <Message severity="success" :closable="false">
              <strong>Поздравляем!</strong> Вы успешно завершили урок "{{ lessonData.title }}"!
            </Message>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            v-if="lessonCompleted"
            label="Вернуться к списку уроков"
            icon="pi pi-list"
            @click="goToLessons"
            class="next-btn"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { logger } from '@/utils/logger'
import { ref, computed, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import LibraryJourneyGame from './LibraryJourneyGame.vue'

import lessonData from '@/data/tutorial/lesson6Data'

const router = useRouter()
const toast = useToast()

// Error boundary for child components
onErrorCaptured((err, instance, info) => {
  console.error('[Lesson6Container] Captured error:', err, info)

  // Show user-friendly error message
  toast.add({
    severity: 'error',
    summary: 'Произошла ошибка',
    detail: 'Пожалуйста, обновите страницу или вернитесь назад',
    life: 5000
  })

  // Report to error tracking service if available
  if (window.errorReportingService) {
    window.errorReportingService.reportError(err, {
      component: 'Lesson6Container',
      lifecycle: info,
      lessonData: {
        currentStep: currentStep.value
      }
    })
  }

  // Return false to propagate error up, or true to stop propagation
  return false
})

// Validate lesson data on mount
onMounted(() => {
  try {
    if (!lessonData || !lessonData.steps || !Array.isArray(lessonData.steps)) {
      throw new Error('Invalid lessonData structure')
    }

    logger.info('[Lesson6Container] Lesson data validated successfully')
  } catch (err) {
    console.error('[Lesson6Container] Failed to validate lesson data:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки урока',
      detail: 'Не удалось загрузить данные урока',
      life: 5000
    })
  }
})

const currentStep = ref(1)
const completedSteps = ref([])
const lessonCompleted = ref(false)
const showLibraryGame = ref(false)

// Task 1 state
const task1Answer = ref(null)
const task1Checked = ref(false)
const task1Correct = ref(false)

// Task 2 state
const task2Complete = ref(false)

// Task 3 state
const task3Answers = ref([])
const task3Checked = ref([])

// Final quiz state
const finalQuizAnswers = ref({})
const finalQuizChecked = ref({})

const allFinalQuizCorrect = computed(() => {
  try {
    const questions = lessonData?.steps?.[7]?.content?.quiz?.questions
    if (!questions || !Array.isArray(questions)) {
      return false
    }
    return questions.every((question, index) => {
      if (!question || !question.options || !Array.isArray(question.options)) {
        return false
      }
      const correctOptionId = question.options.find(o => o && o.correct)?.id
      return finalQuizAnswers.value[index] === correctOptionId && finalQuizChecked.value[index]
    })
  } catch (err) {
    console.error('[Lesson6Container] Error in allFinalQuizCorrect computed:', err)
    return false
  }
})

const goToStep = (stepId) => {
  try {
    if (stepId <= currentStep.value || completedSteps.value.includes(stepId)) {
      currentStep.value = stepId
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Внимание',
        detail: 'Сначала завершите текущий шаг',
        life: 3000
      })
    }
  } catch (err) {
    console.error('[Lesson6Container] Error in goToStep:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось перейти к шагу',
      life: 3000
    })
  }
}

const nextStep = () => {
  try {
    logger.debug('nextStep called, current step:', currentStep.value)

    // Mark current step as completed
    if (!completedSteps.value.includes(currentStep.value)) {
      completedSteps.value.push(currentStep.value)
    }

    // Move to next step if not at the end
    if (currentStep.value < lessonData.totalSteps) {
      const previousStep = currentStep.value
      currentStep.value++
      logger.debug('Step changed from', previousStep, 'to', currentStep.value)

      // Ensure smooth scroll to top
      setTimeout(() => {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (scrollErr) {
          console.warn('[Lesson6Container] Scroll error (non-critical):', scrollErr)
        }
      }, 100)

      // Show feedback toast
      toast.add({
        severity: 'success',
        summary: 'Переход к следующему шагу',
        detail: `Вы перешли к шагу ${currentStep.value}`,
        life: 2000
      })
    }
  } catch (err) {
    console.error('[Lesson6Container] Error in nextStep:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось перейти к следующему шагу',
      life: 3000
    })
  }
}

const prevStep = () => {
  try {
    if (currentStep.value > 1) {
      currentStep.value--
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (err) {
    console.error('[Lesson6Container] Error in prevStep:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось вернуться к предыдущему шагу',
      life: 3000
    })
  }
}

const goBack = () => {
  try {
    router.push('/agents/tutorial/lesson-5')
  } catch (err) {
    console.error('[Lesson6Container] Error in goBack:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка навигации',
      detail: 'Не удалось вернуться назад',
      life: 3000
    })
  }
}

const goToLessons = () => {
  try {
    router.push('/agents/workflow-builder')
  } catch (err) {
    console.error('[Lesson6Container] Error in goToLessons:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка навигации',
      detail: 'Не удалось перейти к списку уроков',
      life: 3000
    })
  }
}

const checkTask1Answer = () => {
  try {
    task1Checked.value = true
    const correctOption = lessonData?.steps?.[4]?.content?.quiz?.options?.find(o => o && o.correct)
    task1Correct.value = correctOption && task1Answer.value === correctOption.id

    if (task1Correct.value) {
      toast.add({
        severity: 'success',
        summary: 'Правильно!',
        detail: 'Вы успешно ответили на вопрос',
        life: 3000
      })
    }
  } catch (err) {
    console.error('[Lesson6Container] Error in checkTask1Answer:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось проверить ответ',
      life: 3000
    })
  }
}

const markTask2Complete = () => {
  try {
    task2Complete.value = true
    toast.add({
      severity: 'success',
      summary: 'Отлично!',
      detail: 'Вы разобрались с очисткой данных',
      life: 3000
    })
  } catch (err) {
    console.error('[Lesson6Container] Error in markTask2Complete:', err)
  }
}

const checkTask3Answer = (questionIndex) => {
  try {
    task3Checked.value[questionIndex] = true
    toast.add({
      severity: 'info',
      summary: 'Ответ проверен',
      detail: 'Смотрите пояснение ниже',
      life: 3000
    })
  } catch (err) {
    console.error('[Lesson6Container] Error in checkTask3Answer:', err)
  }
}

const checkFinalQuizAnswer = (questionIndex) => {
  try {
    finalQuizChecked.value[questionIndex] = true
  } catch (err) {
    console.error('[Lesson6Container] Error in checkFinalQuizAnswer:', err)
  }
}

const completeLesson = () => {
  try {
    lessonCompleted.value = true
    toast.add({
      severity: 'success',
      summary: 'Поздравляем!',
      detail: 'Вы успешно завершили урок!',
      life: 5000
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    console.error('[Lesson6Container] Error in completeLesson:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось завершить урок',
      life: 3000
    })
  }
}

const launchGame = () => {
  try {
    showLibraryGame.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.add({
      severity: 'info',
      summary: 'Игра запущена',
      detail: 'Добро пожаловать в путешествие по Библиотеке Данных!',
      life: 3000
    })
  } catch (err) {
    console.error('[Lesson6Container] Error in launchGame:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось запустить игру',
      life: 3000
    })
  }
}

const closeGame = () => {
  try {
    showLibraryGame.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.add({
      severity: 'success',
      summary: 'Возвращение к уроку',
      detail: 'Продолжайте изучение материала',
      life: 3000
    })
  } catch (err) {
    console.error('[Lesson6Container] Error in closeGame:', err)
  }
}
</script>

<style scoped lang="scss">
.lesson6-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }

  .game-launch-card {
    background: linear-gradient(135deg, var(--blue-50) 0%, var(--green-50) 100%);
    border: 2px solid var(--primary-color);

    ul {
      padding-left: 1.5rem;
      margin: 0;

      li {
        margin: 0.5rem 0;
      }
    }
  }

  .lesson-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;

    .header-content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;

      .back-btn {
        font-size: 1.5rem;
        margin-top: 0.5rem;
      }

      .header-title {
        h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.2;

          @media (max-width: 768px) {
            font-size: 1.5rem;
          }
        }

        p {
          margin: 0.5rem 0 0.25rem 0;
          color: var(--text-color-secondary);
          font-size: 1.1rem;

          @media (max-width: 768px) {
            font-size: 0.95rem;
          }
        }

        small {
          color: var(--text-color-secondary);
          font-style: italic;
        }
      }
    }

    .lesson-progress {
      font-size: 1rem;
    }
  }

  .steps-navigation {
    margin-bottom: 2rem;
    overflow-x: auto;

    .steps-list {
      display: flex;
      gap: 0.75rem;
      min-width: min-content;
      padding-bottom: 0.5rem;

      .step-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        background: var(--surface-card);
        border: 2px solid var(--surface-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 100px;

        &:hover {
          border-color: var(--primary-color);
          transform: translateY(-2px);
        }

        &.active {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);

          .step-number {
            background: white;
            color: var(--primary-color);
          }
        }

        &.completed {
          border-color: var(--green-500);

          .step-number {
            background: var(--green-500);
            color: white;
          }
        }

        .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--surface-ground);
          border-radius: 50%;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;

          i {
            font-size: 1.2rem;
          }

          .step-title {
            font-weight: 500;
            font-size: 0.875rem;
            text-align: center;
            white-space: nowrap;
          }
        }
      }
    }
  }

  .lesson-content {
    .step-content {
      animation: fadeIn 0.3s ease-in;
    }

    .intro-card {
      margin-bottom: 2rem;

      h2 {
        margin: 0;
        font-size: 1.75rem;
      }
    }

    .story-card {
      margin-bottom: 2rem;

      .story-timeline {
        margin: 2rem 0;

        .timeline-item {
          display: flex;
          gap: 2rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;

          &.modern {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .timeline-marker {
            font-size: 2rem;
            font-weight: 700;
            min-width: 100px;
          }

          .timeline-content {
            flex: 1;

            h3 {
              margin-top: 0;
            }

            p {
              margin: 0.5rem 0;
            }

            .highlight {
              font-size: 1.1rem;
              font-weight: 500;
            }
          }
        }
      }

      .key-facts {
        margin: 2rem 0;

        .facts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
          margin-top: 1rem;

          .fact-card {
            padding: 1.5rem;
            background: var(--surface-ground);
            border-radius: 8px;
            border-left: 4px solid var(--primary-color);

            p {
              margin-top: 1rem;
              margin-bottom: 0;
            }
          }
        }
      }

      .metaphor-message {
        margin-top: 2rem;
        font-size: 1.05rem;
        line-height: 1.6;
      }
    }

    .data-types-comparison {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }

      .data-type-card {
        &.structured {
          border-top: 4px solid #3B82F6;
        }

        &.unstructured {
          border-top: 4px solid #EC4899;
        }

        .card-title-with-emoji {
          display: flex;
          align-items: flex-start;
          gap: 1rem;

          .emoji {
            font-size: 3rem;
          }

          h3 {
            margin: 0;
            font-size: 1.5rem;
          }

          .subtitle {
            margin: 0.25rem 0 0 0;
            font-size: 1rem;
            color: var(--text-color-secondary);
            font-weight: normal;
          }
        }

        .characteristics {
          margin-bottom: 1.5rem;

          h4 {
            margin-top: 0;
          }

          .char-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;

            .char-item {
              display: flex;
              align-items: center;
              gap: 0.75rem;

              i {
                font-size: 1.2rem;
              }
            }
          }
        }

        .examples {
          margin-bottom: 1.5rem;

          .examples-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
          }
        }

        .success-story {
          padding: 1rem;
          background: var(--surface-ground);
          border-radius: 8px;

          p {
            margin: 0.5rem 0;
          }
        }
      }
    }

    .smart-cases {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 2rem;

      .smart-case-card {
        .case-title {
          display: flex;
          align-items: center;
          gap: 1rem;

          .emoji-large {
            font-size: 3rem;
          }

          h3 {
            margin: 0;
          }
        }

        .case-description {
          font-size: 1.05rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .data-types-breakdown {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
          margin-bottom: 1.5rem;

          .data-type-column {
            h4 {
              margin-top: 0;
            }

            ul {
              padding-left: 1.5rem;
              margin: 0.5rem 0;

              li {
                margin: 0.5rem 0;
              }
            }
          }
        }

        .case-result {
          padding: 1rem;
          background: var(--green-50);
          border-left: 4px solid var(--green-500);
          border-radius: 4px;
          font-size: 1.05rem;
        }
      }
    }

    .transformation-card,
    .process-card {
      margin-bottom: 2rem;

      .transformation-demo {
        .before-after {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 2rem;
          align-items: center;

          @media (max-width: 768px) {
            grid-template-columns: 1fr;

            .arrow {
              display: none;
            }
          }

          .before,
          .after {
            padding: 1.5rem;
            background: var(--surface-ground);
            border-radius: 8px;

            .query {
              margin: 1rem 0;
              font-size: 1.05rem;
              line-height: 1.5;
            }

            .note {
              color: var(--text-color-secondary);
              font-style: italic;
            }
          }

          .arrow {
            font-size: 2rem;
            color: var(--primary-color);
          }
        }
      }

      .process-steps {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;

        .process-step {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;

          .step-icon {
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            color: white;
            font-size: 1.5rem;
            flex-shrink: 0;
          }

          .step-details {
            flex: 1;

            h4 {
              margin: 0 0 0.5rem 0;
            }

            .tool-name {
              font-weight: 600;
              color: var(--primary-color);
              margin: 0.5rem 0;
            }

            .tool-description {
              margin: 0.5rem 0 0 0;
              color: var(--text-color-secondary);
            }
          }
        }
      }
    }

    .exercise-card {
      margin-bottom: 2rem;

      .instructions {
        ol {
          padding-left: 1.5rem;

          li {
            margin: 0.75rem 0;
            line-height: 1.5;
          }
        }
      }

      .fields-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 2rem;
        margin: 2rem 0;

        .fields-section {
          h4 {
            margin-top: 0;
          }

          .field-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;

            .field-item {
              padding: 1rem;
              background: var(--surface-ground);
              border-radius: 8px;

              strong {
                display: block;
                margin-bottom: 0.5rem;
              }

              .example {
                margin: 0.5rem 0 0 0;
                font-size: 0.9rem;
                color: var(--text-color-secondary);
              }
            }
          }
        }
      }

      .quiz-section {
        margin-top: 2rem;
        padding: 1.5rem;
        background: var(--surface-ground);
        border-radius: 8px;

        .quiz-question {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;

          .quiz-option {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            background: var(--surface-card);
            border: 2px solid var(--surface-border);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              border-color: var(--primary-color);
            }

            &.selected {
              border-color: var(--primary-color);
              background: var(--primary-50);
            }

            &.correct {
              border-color: var(--green-500);
              background: var(--green-50);
            }

            &.incorrect {
              border-color: var(--red-500);
              background: var(--red-50);
            }

            label {
              cursor: pointer;
              flex: 1;
            }
          }
        }

        .check-btn {
          margin-top: 1rem;
        }
      }
    }

    .data-cleaning-card {
      margin-bottom: 2rem;

      .problems-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-bottom: 2rem;

        .problem-item {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;

          h4 {
            margin-top: 0;
          }

          ul {
            padding-left: 1.5rem;
            margin: 1rem 0;
          }
        }
      }

      .cleaning-steps {
        h4 {
          margin-top: 0;
        }

        .steps-timeline {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;

          .cleaning-step {
            display: flex;
            gap: 1.5rem;
            align-items: flex-start;
            padding: 1.5rem;
            background: var(--surface-ground);
            border-radius: 8px;

            .step-number {
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--primary-color);
              color: white;
              border-radius: 50%;
              font-weight: 700;
              font-size: 1.2rem;
              flex-shrink: 0;
            }

            .step-content {
              flex: 1;

              h5 {
                margin: 0 0 1rem 0;
              }

              .before-after-inline {
                display: flex;
                align-items: center;
                gap: 1rem;
                flex-wrap: wrap;
                margin: 1rem 0;

                .before-inline,
                .after-inline {
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;

                  code {
                    background: var(--surface-card);
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    font-family: monospace;
                  }
                }
              }

              .rule {
                margin: 1rem 0 0 0;
                color: var(--text-color-secondary);
                font-style: italic;
              }
            }
          }
        }
      }
    }

    .data-table {
      margin: 2rem 0;

      h4 {
        margin-bottom: 1rem;
      }
    }

    .complete-btn {
      margin-top: 2rem;
    }

    .reviews-card {
      margin-bottom: 2rem;

      .reviews-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;

        .review-item {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;
          border-left: 4px solid var(--primary-color);

          .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;

            strong {
              font-size: 1.1rem;
            }

            small {
              color: var(--text-color-secondary);
            }
          }

          .review-text {
            margin: 0;
            line-height: 1.6;
          }
        }
      }
    }

    .analysis-card {
      margin-bottom: 2rem;

      .word-lists {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        margin: 1.5rem 0;

        h5 {
          margin-top: 0;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
      }

      .examples-table {
        margin-top: 1.5rem;
      }
    }

    .practical-task-card {
      margin-bottom: 2rem;

      .task-steps {
        margin: 1.5rem 0;

        h4 {
          margin-bottom: 1rem;
        }

        ol {
          padding-left: 1.5rem;

          li {
            margin-bottom: 1.5rem;

            strong {
              display: block;
              margin-bottom: 0.5rem;
              color: var(--primary-color);
            }

            p {
              margin: 0.5rem 0;
              color: var(--text-color-secondary);
            }

            .step-prompt {
              background: var(--surface-ground);
              padding: 1rem;
              border-radius: 4px;
              border-left: 4px solid var(--primary-color);
              margin: 0.75rem 0;
              overflow-x: auto;
              font-size: 0.9rem;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          }
        }
      }

      .exercise-info {
        margin: 1.5rem 0;
        padding: 1.5rem;
        background: var(--blue-50);
        border-radius: 8px;

        h4, h5 {
          margin-top: 0;
          margin-bottom: 1rem;
        }

        .datasets-list {
          margin: 1rem 0;

          ul {
            padding-left: 1.5rem;

            li {
              margin: 0.75rem 0;
              line-height: 1.5;

              strong {
                color: var(--primary-color);
              }
            }
          }
        }
      }

      .review-to-analyze {
        padding: 1.5rem;
        background: var(--yellow-50);
        border-radius: 8px;
        margin: 1.5rem 0;

        .review-text {
          margin: 1rem 0 0 0;
          font-size: 1.05rem;
          line-height: 1.6;
        }
      }

      .task-questions {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        margin-top: 2rem;

        .task-question {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;

          .question-text {
            font-weight: 600;
            margin-bottom: 1rem;
          }

          .question-options {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;

            .question-option {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 1rem;
              background: var(--surface-card);
              border: 2px solid var(--surface-border);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                border-color: var(--primary-color);
              }

              &.selected {
                border-color: var(--primary-color);
                background: var(--primary-50);
              }

              &.correct {
                border-color: var(--green-500);
                background: var(--green-50);
              }

              &.incorrect {
                border-color: var(--red-500);
                background: var(--red-50);
              }

              label {
                cursor: pointer;
                flex: 1;
              }
            }
          }

          .free-answer {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
        }
      }
    }

    .scenarios-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;

      .scenario-card {
        .scenario-title {
          display: flex;
          align-items: center;
          gap: 1rem;

          .emoji-large {
            font-size: 3rem;
          }

          h3 {
            margin: 0;
          }
        }

        ul {
          padding-left: 1.5rem;

          li {
            margin: 0.75rem 0;
          }
        }
      }
    }

    .key-takeaway {
      margin: 2rem 0;
      font-size: 1.05rem;
      line-height: 1.6;
    }

    .final-task-card {
      margin-bottom: 2rem;

      .example-transformation {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        margin-top: 2rem;

        .transform-arrow {
          font-size: 2rem;
          color: var(--primary-color);
          align-self: center;
        }

        .unstructured-example,
        .structured-example {
          padding: 1.5rem;
          border-radius: 8px;

          .example-text {
            margin: 1rem 0 0 0;
            font-size: 1.05rem;
            line-height: 1.6;
          }
        }

        .unstructured-example {
          background: var(--yellow-50);
        }

        .structured-example {
          background: var(--green-50);

          .structured-data-table {
            margin-top: 1rem;

            .data-row {
              display: flex;
              gap: 1rem;
              padding: 0.75rem 0;
              border-bottom: 1px solid var(--surface-border);

              &:last-child {
                border-bottom: none;
              }

              strong {
                min-width: 200px;
              }
            }
          }
        }
      }
    }

    .formula-card {
      margin-bottom: 2rem;

      .formula {
        padding: 2rem;
        background: var(--blue-50);
        border-radius: 8px;
        font-size: 1.2rem;
        font-weight: 600;
        text-align: center;
        margin: 1rem 0;
        line-height: 1.8;
      }

      .conclusion {
        margin-top: 1.5rem;
        font-size: 1.05rem;
        line-height: 1.6;
      }
    }

    .quiz-card {
      margin-bottom: 2rem;

      .final-quiz-question {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: var(--surface-ground);
        border-radius: 8px;

        .quiz-question {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;

          .quiz-option {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            background: var(--surface-card);
            border: 2px solid var(--surface-border);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              border-color: var(--primary-color);
            }

            &.selected {
              border-color: var(--primary-color);
              background: var(--primary-50);
            }

            &.correct {
              border-color: var(--green-500);
              background: var(--green-50);
            }

            &.incorrect {
              border-color: var(--red-500);
              background: var(--red-50);
            }

            label {
              cursor: pointer;
              flex: 1;
            }
          }
        }
      }

      .complete-lesson-btn {
        width: 100%;
        margin-top: 2rem;
        font-size: 1.2rem;
        padding: 1rem;
      }
    }

    .certificate-card {
      margin-top: 2rem;
      border: 4px solid var(--green-500);
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--surface-border);

      .next-btn {
        margin-left: auto;
      }

      @media (max-width: 768px) {
        flex-direction: column;

        .next-btn {
          margin-left: 0;
        }

        button {
          width: 100%;
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<template>
  <div class="library-journey-game">
    <!-- Game Header -->
    <Card class="game-header">
      <template #title>
        <div class="game-title">
          <h2>{{ gameData.gameTitle }}</h2>
          <Tag :value="currentRank.title" :icon="currentRank.icon" />
        </div>
      </template>
      <template #subtitle>
        <p>{{ gameData.gameDescription }}</p>
      </template>
      <template #content>
        <!-- Library Stats Dashboard -->
        <div class="library-stats">
          <div class="stat-card">
            <i class="pi pi-star-fill"></i>
            <div class="stat-info">
              <span class="stat-label">Репутация</span>
              <ProgressBar :value="libraryStats.reputation" :showValue="true" />
            </div>
          </div>
          <div class="stat-card">
            <i class="pi pi-bolt"></i>
            <div class="stat-info">
              <span class="stat-label">Эффективность</span>
              <ProgressBar :value="libraryStats.efficiency" :showValue="true" />
            </div>
          </div>
          <div class="stat-card">
            <i class="pi pi-sparkles"></i>
            <div class="stat-info">
              <span class="stat-label">Инновации</span>
              <ProgressBar :value="libraryStats.innovation" :showValue="true" />
            </div>
          </div>
        </div>

        <!-- Points and Progress -->
        <div class="progress-info">
          <div class="points-display">
            <i class="pi pi-trophy"></i>
            <span>Очки: <strong>{{ totalPoints }}</strong> / {{ gameData.gameMechanics.pointsSystem.totalPossible }}</span>
          </div>
          <div class="stage-progress">
            <Tag :value="`Этап ${currentStageIndex + 1} из ${gameData.journeyStages.length}`" severity="info" />
          </div>
        </div>
      </template>
    </Card>

    <!-- Tutorial Overlay -->
    <Dialog v-model:visible="showTutorial" header="Обучение" :modal="true" :closable="false" class="tutorial-dialog">
      <div class="tutorial-content">
        <div class="tutorial-step">
          <h3>{{ currentTutorialStep.title }}</h3>
          <p>{{ currentTutorialStep.description }}</p>
          <Message severity="info" :closable="false">
            <strong>Действие:</strong> {{ currentTutorialStep.action }}
          </Message>
        </div>
      </div>
      <template #footer>
        <Button v-if="tutorialStepIndex > 0" label="Назад" icon="pi pi-arrow-left" @click="prevTutorialStep" outlined />
        <Button
          v-if="tutorialStepIndex < gameData.tutorial.steps.length - 1"
          label="Далее"
          icon="pi pi-arrow-right"
          @click="nextTutorialStep"
        />
        <Button
          v-else
          label="Начать игру!"
          icon="pi pi-play"
          @click="startGame"
          severity="success"
        />
      </template>
    </Dialog>

    <!-- Journey Stages -->
    <div v-if="gameStarted && !gameCompleted" class="journey-stages">
      <div class="stage-selector">
        <div
          v-for="(stage, index) in gameData.journeyStages"
          :key="stage.stage"
          class="stage-item"
          :class="{
            'active': currentStageIndex === index,
            'completed': completedStages.includes(index),
            'locked': index > currentStageIndex && !completedStages.includes(index)
          }"
          @click="selectStage(index)"
        >
          <div class="stage-icon">{{ stage.icon }}</div>
          <div class="stage-name">{{ stage.name }}</div>
          <i v-if="completedStages.includes(index)" class="pi pi-check-circle completion-icon"></i>
        </div>
      </div>

      <!-- Current Stage Content -->
      <Card class="stage-content">
        <template #title>
          <div class="stage-title">
            <span class="stage-emoji">{{ currentStage.icon }}</span>
            <h3>{{ currentStage.name }}</h3>
          </div>
        </template>
        <template #content>
          <div class="challenge-section">
            <Message severity="warn" :closable="false">
              <strong>Задача:</strong> {{ currentStage.challenge }}
            </Message>

            <!-- Stage-specific content -->
            <div v-if="currentStage.stage === 1" class="stage-1-content">
              <Card class="input-card">
                <template #title>Запрос читателя</template>
                <template #content>
                  <p class="unstructured-input">{{ currentStage.unstructuredInput }}</p>

                  <Divider />

                  <h4>Ваша задача: {{ currentStage.playerTask }}</h4>

                  <div class="structure-form">
                    <div class="form-field">
                      <label>Жанр:</label>
                      <InputText v-model="stage1Answer.genre" placeholder="Введите жанр" class="w-full" />
                    </div>
                    <div class="form-field">
                      <label>Возрастная категория:</label>
                      <Dropdown
                        v-model="stage1Answer.ageCategory"
                        :options="['Детская', 'Подростковая', 'Взрослая литература', 'Для всех возрастов']"
                        placeholder="Выберите категорию"
                        class="w-full"
                      />
                    </div>
                    <div class="form-field">
                      <label>Характеристики (через запятую):</label>
                      <Textarea v-model="stage1Answer.characteristics" rows="3" class="w-full" />
                    </div>
                    <div class="form-field">
                      <label>Исключения:</label>
                      <InputText v-model="stage1Answer.exclusions" placeholder="Что НЕ нужно искать" class="w-full" />
                    </div>
                  </div>

                  <div class="ai-assist">
                    <Button
                      label="Использовать AI-помощь"
                      icon="pi pi-sparkles"
                      @click="useAIAssist(1)"
                      :loading="aiProcessing"
                      outlined
                    />
                    <small>Использует DeepSeek для анализа запроса</small>
                  </div>
                </template>
              </Card>
            </div>

            <div v-else-if="currentStage.stage === 2" class="stage-2-content">
              <Card class="input-card">
                <template #title>Новые поступления</template>
                <template #content>
                  <div v-for="(book, index) in currentStage.unstructuredInput" :key="index" class="book-entry">
                    <Tag :value="`Книга ${index + 1}`" />
                    <p class="book-description">{{ book }}</p>

                    <div class="catalog-form">
                      <InputText
                        v-model="stage2Answers[index].title"
                        placeholder="Название"
                        class="w-full mb-2"
                      />
                      <InputText
                        v-model="stage2Answers[index].author"
                        placeholder="Автор"
                        class="w-full mb-2"
                      />
                      <Dropdown
                        v-model="stage2Answers[index].genre"
                        :options="['Фантастика', 'Детектив', 'Триллер', 'Историческая проза', 'Классика']"
                        placeholder="Жанр"
                        class="w-full mb-2"
                      />
                      <InputText
                        v-model="stage2Answers[index].topic"
                        placeholder="Тематика"
                        class="w-full"
                      />
                    </div>
                  </div>

                  <Button
                    label="AI: Извлечь данные из всех описаний"
                    icon="pi pi-robot"
                    @click="useAIAssist(2)"
                    :loading="aiProcessing"
                    severity="secondary"
                    class="mt-3"
                  />
                </template>
              </Card>
            </div>

            <div v-else-if="currentStage.stage === 3" class="stage-3-content">
              <Card class="input-card">
                <template #title>Анализ отзывов</template>
                <template #content>
                  <p>Всего отзывов для анализа: {{ currentStage.sampleReviews.length }}</p>

                  <div class="reviews-list">
                    <div v-for="(review, index) in currentStage.sampleReviews" :key="index" class="review-card">
                      <p class="review-text">"{{ review.text }}"</p>
                      <div class="review-analysis">
                        <Dropdown
                          v-model="stage3Answers[index].sentiment"
                          :options="['positive', 'negative', 'neutral', 'mixed']"
                          placeholder="Тональность"
                        />
                        <Dropdown
                          v-model="stage3Answers[index].category"
                          :options="['Техническая', 'Комфорт', 'Сервис', 'Навигация', 'Коллекция']"
                          placeholder="Категория проблемы"
                        />
                        <Dropdown
                          v-model="stage3Answers[index].urgency"
                          :options="['high', 'medium', 'low']"
                          placeholder="Срочность"
                        />
                      </div>
                    </div>
                  </div>

                  <Divider />

                  <h4>Выявленные проблемы:</h4>
                  <Textarea
                    v-model="stage3Summary.topIssues"
                    rows="4"
                    placeholder="Опишите 3 главные проблемы"
                    class="w-full mb-3"
                  />

                  <h4>План действий:</h4>
                  <Textarea
                    v-model="stage3Summary.actionPlan"
                    rows="4"
                    placeholder="Что нужно сделать в первую очередь?"
                    class="w-full"
                  />

                  <Button
                    label="AI: Проанализировать все отзывы"
                    icon="pi pi-chart-bar"
                    @click="useAIAssist(3)"
                    :loading="aiProcessing"
                    severity="help"
                    class="mt-3"
                  />
                </template>
              </Card>
            </div>

            <div v-else-if="currentStage.stage === 4" class="stage-4-content">
              <Card class="input-card">
                <template #title>Дискуссия читательского клуба</template>
                <template #content>
                  <div class="discussion-transcript">
                    <div v-for="(comment, index) in currentStage.sampleDiscussion" :key="index" class="discussion-comment">
                      <i class="pi pi-comment"></i>
                      <p>{{ comment }}</p>
                    </div>
                  </div>

                  <Divider />

                  <h4>Извлечённые темы:</h4>
                  <Chips v-model="stage4Answers.topics" placeholder="Добавьте темы" class="w-full mb-3" />

                  <h4>Интересы читателей:</h4>
                  <Textarea
                    v-model="stage4Answers.interests"
                    rows="4"
                    placeholder="Какие интересы и потребности вы выявили?"
                    class="w-full mb-3"
                  />

                  <h4>Рекомендации по закупкам:</h4>
                  <Textarea
                    v-model="stage4Answers.recommendations"
                    rows="4"
                    placeholder="Что нужно заказать? Какие мероприятия провести?"
                    class="w-full"
                  />

                  <Button
                    label="AI: Извлечь insights из дискуссии"
                    icon="pi pi-lightbulb"
                    @click="useAIAssist(4)"
                    :loading="aiProcessing"
                    severity="warning"
                    class="mt-3"
                  />
                </template>
              </Card>
            </div>

            <div v-else-if="currentStage.stage === 5" class="stage-5-content">
              <Card class="input-card">
                <template #title>Предиктивная аналитика</template>
                <template #content>
                  <h4>Источники данных:</h4>

                  <Accordion>
                    <AccordionTab header="Социальные сети">
                      <ul>
                        <li v-for="(item, index) in currentStage.sampleData.socialMedia" :key="index">{{ item }}</li>
                      </ul>
                    </AccordionTab>
                    <AccordionTab header="Поисковые запросы">
                      <ul>
                        <li v-for="(item, index) in currentStage.sampleData.searchQueries" :key="index">{{ item }}</li>
                      </ul>
                    </AccordionTab>
                    <AccordionTab header="Культурные события">
                      <ul>
                        <li v-for="(item, index) in currentStage.sampleData.culturalEvents" :key="index">{{ item }}</li>
                      </ul>
                    </AccordionTab>
                  </Accordion>

                  <Divider />

                  <h4>Прогноз популярных тем:</h4>
                  <DataTable :value="stage5Predictions" editMode="row" class="mb-3">
                    <Column field="topic" header="Тема">
                      <template #editor="{ data }">
                        <InputText v-model="data.topic" />
                      </template>
                    </Column>
                    <Column field="confidence" header="Уверенность (0-1)">
                      <template #editor="{ data }">
                        <InputNumber v-model="data.confidence" :min="0" :max="1" :step="0.05" />
                      </template>
                    </Column>
                    <Column field="reason" header="Обоснование">
                      <template #editor="{ data }">
                        <InputText v-model="data.reason" />
                      </template>
                    </Column>
                  </DataTable>

                  <Button
                    label="Добавить прогноз"
                    icon="pi pi-plus"
                    @click="addPrediction"
                    outlined
                    size="small"
                    class="mb-3"
                  />

                  <h4>Рекомендации по закупкам:</h4>
                  <Textarea
                    v-model="stage5PurchaseRec"
                    rows="6"
                    placeholder="Что заказать, в каком количестве, с каким приоритетом?"
                    class="w-full"
                  />

                  <Button
                    label="AI: Создать комплексный прогноз"
                    icon="pi pi-bolt"
                    @click="useAIAssist(5)"
                    :loading="aiProcessing"
                    severity="success"
                    class="mt-3"
                  />
                </template>
              </Card>
            </div>

            <!-- Submit Button -->
            <div class="stage-actions">
              <Button
                label="Проверить решение"
                icon="pi pi-check"
                @click="submitStage"
                :disabled="!canSubmit"
                severity="success"
                size="large"
              />
              <div v-if="stageTimer > 0" class="timer">
                <i class="pi pi-clock"></i>
                <span>Время: {{ formatTime(stageTimer) }}</span>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Game Completed -->
    <Card v-if="gameCompleted" class="game-completed">
      <template #title>
        <h2>🏆 Поздравляем! Путешествие завершено!</h2>
      </template>
      <template #content>
        <div class="final-stats">
          <div class="stat-item">
            <i class="pi pi-trophy"></i>
            <div>
              <h3>Итоговые очки</h3>
              <p class="big-number">{{ totalPoints }}</p>
            </div>
          </div>
          <div class="stat-item">
            <i class="pi pi-star-fill"></i>
            <div>
              <h3>Финальный ранг</h3>
              <p class="rank-title">{{ currentRank.title }} {{ currentRank.icon }}</p>
            </div>
          </div>
        </div>

        <Divider />

        <h3>Открытые возможности:</h3>
        <div class="unlocked-items">
          <Tag
            v-for="unlock in unlockedFeatures"
            :key="unlock.id"
            :value="unlock.name"
            severity="success"
            icon="pi pi-check"
          />
        </div>

        <Divider />

        <h3>Полученные достижения:</h3>
        <div class="achievements-list">
          <div v-for="achievement in earnedAchievements" :key="achievement.id" class="achievement-card">
            <i class="pi pi-medal"></i>
            <div>
              <strong>{{ achievement.name }}</strong>
              <p>{{ achievement.requirement }}</p>
            </div>
          </div>
        </div>

        <Message severity="success" :closable="false" class="mt-4">
          <strong>Вы освоили работу с неструктурированными данными!</strong><br>
          Теперь вы можете применять эти навыки в реальной работе библиотеки.
        </Message>

        <div class="final-actions">
          <Button
            label="Вернуться к уроку"
            icon="pi pi-arrow-left"
            @click="$emit('return-to-lesson')"
            outlined
          />
          <Button
            label="Начать заново"
            icon="pi pi-refresh"
            @click="restartGame"
            severity="secondary"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import libraryJourneySpecs from '@/data/tutorial/lesson6GameSpecifications'

const toast = useToast()
const emit = defineEmits(['return-to-lesson'])

// Game data
const gameData = libraryJourneySpecs

// Game state
const gameStarted = ref(false)
const gameCompleted = ref(false)
const showTutorial = ref(true)
const tutorialStepIndex = ref(0)
const currentStageIndex = ref(0)
const completedStages = ref([])
const totalPoints = ref(0)
const aiProcessing = ref(false)
const stageTimer = ref(0)
let timerInterval = null

// Library stats
const libraryStats = ref({
  reputation: 50,
  efficiency: 60,
  innovation: 40
})

// Answers for each stage
const stage1Answer = ref({
  genre: '',
  ageCategory: '',
  characteristics: '',
  exclusions: ''
})

const stage2Answers = ref([
  { title: '', author: '', genre: '', topic: '' },
  { title: '', author: '', genre: '', topic: '' },
  { title: '', author: '', genre: '', topic: '' }
])

const stage3Answers = ref([])
const stage3Summary = ref({
  topIssues: '',
  actionPlan: ''
})

const stage4Answers = ref({
  topics: [],
  interests: '',
  recommendations: ''
})

const stage5Predictions = ref([])
const stage5PurchaseRec = ref('')

// Computed properties
const currentTutorialStep = computed(() => {
  return gameData.tutorial.steps[tutorialStepIndex.value]
})

const currentStage = computed(() => {
  return gameData.journeyStages[currentStageIndex.value]
})

const currentRank = computed(() => {
  const ranks = gameData.gameMechanics.pointsSystem.ranks
  return ranks.find(rank => totalPoints.value >= rank.min && totalPoints.value <= rank.max) || ranks[0]
})

const canSubmit = computed(() => {
  // Basic validation based on current stage
  if (currentStageIndex.value === 0) {
    return stage1Answer.value.genre && stage1Answer.value.ageCategory
  }
  if (currentStageIndex.value === 1) {
    return stage2Answers.value.every(a => a.title || a.author || a.genre)
  }
  if (currentStageIndex.value === 2) {
    return stage3Summary.value.topIssues && stage3Summary.value.actionPlan
  }
  if (currentStageIndex.value === 3) {
    return stage4Answers.value.topics.length > 0 &&
           stage4Answers.value.interests &&
           stage4Answers.value.recommendations
  }
  if (currentStageIndex.value === 4) {
    return stage5Predictions.value.length > 0 && stage5PurchaseRec.value
  }
  return false
})

const unlockedFeatures = computed(() => {
  return gameData.gameMechanics.unlockables.filter((_, index) => {
    return completedStages.value.includes(index)
  })
})

const earnedAchievements = computed(() => {
  const achievements = []
  // Check achievement conditions
  if (totalPoints.value === gameData.gameMechanics.pointsSystem.totalPossible) {
    achievements.push(gameData.gameMechanics.achievements.find(a => a.id === 'master-of-data'))
  }
  // Add more achievement checks
  return achievements.filter(Boolean)
})

// Methods
const nextTutorialStep = () => {
  if (tutorialStepIndex.value < gameData.tutorial.steps.length - 1) {
    tutorialStepIndex.value++
  }
}

const prevTutorialStep = () => {
  if (tutorialStepIndex.value > 0) {
    tutorialStepIndex.value--
  }
}

const startGame = () => {
  showTutorial.value = false
  gameStarted.value = true
  startStageTimer()
}

const startStageTimer = () => {
  const stage = currentStage.value
  if (stage.successCriteria && stage.successCriteria.timeLimit) {
    stageTimer.value = stage.successCriteria.timeLimit
    timerInterval = setInterval(() => {
      if (stageTimer.value > 0) {
        stageTimer.value--
      } else {
        clearInterval(timerInterval)
      }
    }, 1000)
  }
}

const selectStage = (index) => {
  if (index <= currentStageIndex.value || completedStages.value.includes(index)) {
    currentStageIndex.value = index
    if (timerInterval) clearInterval(timerInterval)
    startStageTimer()
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Этап заблокирован',
      detail: 'Сначала завершите предыдущие этапы',
      life: 3000
    })
  }
}

const useAIAssist = async (stageNum) => {
  aiProcessing.value = true

  try {
    // Get API configuration from environment
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    const baseURL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.deepseek.com/v1'
    const model = import.meta.env.VITE_OPENAI_MODEL || 'deepseek-chat'

    if (!apiKey) {
      throw new Error('DeepSeek API key not configured')
    }

    let prompt = ''
    let responseHandler = null

    // Build prompt based on stage
    if (stageNum === 1) {
      prompt = gameData.aiIntegration.prompts.queryStructuring.replace(
        '{query}',
        currentStage.value.unstructuredInput
      )
      responseHandler = (data) => {
        if (data.жанр) stage1Answer.value.genre = Array.isArray(data.жанр) ? data.жанр.join(', ') : data.жанр
        if (data.возрастная_категория) stage1Answer.value.ageCategory = data.возрастная_категория
        if (data.ключевые_слова) stage1Answer.value.characteristics = data.ключевые_слова.join(', ')
        if (data.исключения) stage1Answer.value.exclusions = data.исключения.join(', ')
      }
    } else if (stageNum === 2) {
      prompt = `Извлеки структурированные данные из следующих описаний книг:\n\n${currentStage.value.unstructuredInput.join('\n\n')}\n\nВерни JSON массив с полями: title, author, genre, topic для каждой книги.`
      responseHandler = (data) => {
        if (Array.isArray(data)) {
          data.forEach((book, index) => {
            if (stage2Answers.value[index]) {
              stage2Answers.value[index] = {
                title: book.title || book.название || '',
                author: book.author || book.автор || '',
                genre: book.genre || book.жанр || '',
                topic: book.topic || book.тематика || ''
              }
            }
          })
        }
      }
    } else if (stageNum === 3) {
      const reviews = currentStage.value.sampleReviews.map(r => r.text).join('\n\n')
      prompt = `Проанализируй следующие отзывы читателей:\n\n${reviews}\n\nДля каждого отзыва определи: тональность, категорию проблемы, срочность. Также выдели 3 главные проблемы и план действий.`
      responseHandler = (data) => {
        if (data.reviews && Array.isArray(data.reviews)) {
          stage3Answers.value = data.reviews
        }
        if (data.topIssues) {
          stage3Summary.value.topIssues = data.topIssues
        }
        if (data.actionPlan) {
          stage3Summary.value.actionPlan = data.actionPlan
        }
      }
    } else if (stageNum === 4) {
      const discussion = currentStage.value.sampleDiscussion.join('\n\n')
      prompt = `Проанализируй дискуссию читательского клуба:\n\n${discussion}\n\nИзвлеки: основные темы, интересы читателей, рекомендации по комплектованию библиотеки.`
      responseHandler = (data) => {
        if (data.topics) stage4Answers.value.topics = data.topics
        if (data.interests) stage4Answers.value.interests = data.interests
        if (data.recommendations) stage4Answers.value.recommendations = data.recommendations
      }
    } else if (stageNum === 5) {
      const allData = JSON.stringify(currentStage.value.sampleData, null, 2)
      prompt = gameData.aiIntegration.prompts.trendPrediction.replace('{data}', allData)
      responseHandler = (data) => {
        if (data.predictions && Array.isArray(data.predictions)) {
          stage5Predictions.value = data.predictions.map(p => ({
            topic: p.topic || p.тема,
            confidence: p.confidence || p.уверенность,
            reason: p.reason || p.обоснование
          }))
        }
        if (data.purchaseRecommendations) {
          stage5PurchaseRec.value = data.purchaseRecommendations
        }
      }
    }

    // Call DeepSeek API
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по библиотечным системам и обработке данных. Отвечай на русском языке в формате JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: gameData.aiIntegration.config.temperature,
        max_tokens: gameData.aiIntegration.config.max_tokens
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const result = await response.json()
    const content = result.choices[0].message.content

    // Parse JSON response
    let parsedData
    try {
      parsedData = JSON.parse(content)
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    if (responseHandler) {
      responseHandler(parsedData)
    }

    toast.add({
      severity: 'success',
      summary: 'AI помог!',
      detail: 'Данные обработаны с помощью DeepSeek AI',
      life: 3000
    })

  } catch (error) {
    console.error('AI assist error:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка AI',
      detail: error.message || 'Не удалось обработать запрос',
      life: 5000
    })
  } finally {
    aiProcessing.value = false
  }
}

const submitStage = () => {
  const stage = currentStage.value

  // Calculate score based on time and accuracy
  let points = 0
  let accuracy = 0.7 // Base accuracy, could be calculated more precisely

  const timeBonusRatio = stageTimer.value / (stage.successCriteria.timeLimit || 300)
  const timeBonus = timeBonusRatio > 0.5 ? 1.2 : 1.0

  points = Math.floor(stage.successCriteria.rewardPoints * accuracy * timeBonus)

  totalPoints.value += points

  // Update library stats based on outcome
  const outcome = points > stage.successCriteria.rewardPoints * 0.8
    ? stage.gameOutcome.success
    : points > stage.successCriteria.rewardPoints * 0.5
    ? (stage.gameOutcome.partial || stage.gameOutcome.success)
    : stage.gameOutcome.failure

  // Parse effect string and update stats
  if (outcome.effect) {
    const effectMatch = outcome.effect.match(/([+-]\d+)\s+к\s+(\w+)/)
    if (effectMatch) {
      const value = parseInt(effectMatch[1])
      const stat = effectMatch[2]

      if (stat === 'репутации') {
        libraryStats.value.reputation = Math.max(0, Math.min(100, libraryStats.value.reputation + value))
      } else if (stat === 'эффективности') {
        libraryStats.value.efficiency = Math.max(0, Math.min(100, libraryStats.value.efficiency + value))
      } else if (stat.includes('инновац') || stat.includes('развит')) {
        libraryStats.value.innovation = Math.max(0, Math.min(100, libraryStats.value.innovation + value))
      }
    }
  }

  completedStages.value.push(currentStageIndex.value)

  toast.add({
    severity: points > stage.successCriteria.rewardPoints * 0.8 ? 'success' : 'info',
    summary: outcome.message,
    detail: `Получено очков: ${points}. ${outcome.effect}`,
    life: 5000
  })

  if (outcome.unlocks) {
    toast.add({
      severity: 'success',
      summary: 'Открыта новая возможность!',
      detail: outcome.unlocks,
      life: 5000
    })
  }

  // Move to next stage or complete game
  if (currentStageIndex.value < gameData.journeyStages.length - 1) {
    currentStageIndex.value++
    startStageTimer()
  } else {
    completeGame()
  }
}

const completeGame = () => {
  if (timerInterval) clearInterval(timerInterval)
  gameCompleted.value = true

  toast.add({
    severity: 'success',
    summary: 'Игра завершена!',
    detail: `Поздравляем! Ваш ранг: ${currentRank.value.title}`,
    life: 10000
  })
}

const restartGame = () => {
  // Reset all state
  gameStarted.value = false
  gameCompleted.value = false
  showTutorial.value = true
  tutorialStepIndex.value = 0
  currentStageIndex.value = 0
  completedStages.value = []
  totalPoints.value = 0
  libraryStats.value = { reputation: 50, efficiency: 60, innovation: 40 }

  // Reset all answers
  stage1Answer.value = { genre: '', ageCategory: '', characteristics: '', exclusions: '' }
  stage2Answers.value = [
    { title: '', author: '', genre: '', topic: '' },
    { title: '', author: '', genre: '', topic: '' },
    { title: '', author: '', genre: '', topic: '' }
  ]
  stage3Answers.value = []
  stage3Summary.value = { topIssues: '', actionPlan: '' }
  stage4Answers.value = { topics: [], interests: '', recommendations: '' }
  stage5Predictions.value = []
  stage5PurchaseRec.value = ''
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const addPrediction = () => {
  stage5Predictions.value.push({
    topic: '',
    confidence: 0.5,
    reason: ''
  })
}

// Initialize stage 3 answers
watch(() => currentStage.value, (newStage) => {
  if (newStage.stage === 3 && stage3Answers.value.length === 0) {
    stage3Answers.value = newStage.sampleReviews.map(() => ({
      sentiment: '',
      category: '',
      urgency: ''
    }))
  }
}, { immediate: true })

onMounted(() => {
  // Initialize stage 3 answers if on that stage
  if (currentStage.value.stage === 3) {
    stage3Answers.value = currentStage.value.sampleReviews.map(() => ({
      sentiment: '',
      category: '',
      urgency: ''
    }))
  }
})
</script>

<style scoped lang="scss">
.library-journey-game {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;

  .game-header {
    margin-bottom: 2rem;

    .game-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;

      h2 {
        margin: 0;
      }
    }

    .library-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;

      .stat-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--surface-ground);
        border-radius: 8px;

        i {
          font-size: 2rem;
          color: var(--primary-color);
        }

        .stat-info {
          flex: 1;

          .stat-label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }
        }
      }
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;

      .points-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.2rem;

        i {
          color: var(--yellow-500);
        }
      }
    }
  }

  .journey-stages {
    .stage-selector {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      overflow-x: auto;
      padding-bottom: 1rem;

      .stage-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        background: var(--surface-card);
        border: 2px solid var(--surface-border);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 120px;
        position: relative;

        &:hover:not(.locked) {
          border-color: var(--primary-color);
          transform: translateY(-2px);
        }

        &.active {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }

        &.completed {
          border-color: var(--green-500);
          background: var(--green-50);
        }

        &.locked {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .stage-icon {
          font-size: 2rem;
        }

        .stage-name {
          font-size: 0.875rem;
          text-align: center;
          font-weight: 500;
        }

        .completion-icon {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          color: var(--green-500);
          font-size: 1.2rem;
        }
      }
    }

    .stage-content {
      .stage-title {
        display: flex;
        align-items: center;
        gap: 1rem;

        .stage-emoji {
          font-size: 2rem;
        }

        h3 {
          margin: 0;
        }
      }

      .challenge-section {
        .unstructured-input {
          padding: 1.5rem;
          background: var(--yellow-50);
          border-left: 4px solid var(--yellow-500);
          border-radius: 4px;
          font-size: 1.1rem;
          line-height: 1.6;
          margin: 1.5rem 0;
        }

        .structure-form,
        .catalog-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin: 1.5rem 0;

          .form-field {
            label {
              display: block;
              font-weight: 600;
              margin-bottom: 0.5rem;
            }
          }
        }

        .book-entry {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;
          margin-bottom: 1.5rem;

          .book-description {
            margin: 1rem 0;
            padding: 1rem;
            background: var(--surface-card);
            border-radius: 4px;
          }
        }

        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin: 1.5rem 0;

          .review-card {
            padding: 1rem;
            background: var(--surface-ground);
            border-radius: 8px;

            .review-text {
              font-style: italic;
              margin-bottom: 1rem;
              padding: 1rem;
              background: var(--surface-card);
              border-radius: 4px;
            }

            .review-analysis {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 1rem;
            }
          }
        }

        .discussion-transcript {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;
          margin: 1.5rem 0;

          .discussion-comment {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: var(--surface-card);
            border-radius: 4px;

            i {
              color: var(--primary-color);
              margin-top: 0.25rem;
            }

            p {
              margin: 0;
              flex: 1;
            }
          }
        }

        .ai-assist {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
          margin-top: 1.5rem;

          small {
            color: var(--text-color-secondary);
            font-style: italic;
          }
        }

        .stage-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--surface-border);

          .timer {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.1rem;
            font-weight: 600;

            i {
              color: var(--primary-color);
            }
          }
        }
      }
    }
  }

  .game-completed {
    .final-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 2rem 0;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
        background: var(--surface-ground);
        border-radius: 12px;

        i {
          font-size: 3rem;
          color: var(--yellow-500);
        }

        h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: var(--text-color-secondary);
        }

        .big-number {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          color: var(--primary-color);
        }

        .rank-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }
      }
    }

    .unlocked-items {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin: 1rem 0;
    }

    .achievements-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin: 1rem 0;

      .achievement-card {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.5rem;
        background: var(--surface-ground);
        border-radius: 8px;
        border-left: 4px solid var(--yellow-500);

        i {
          font-size: 2rem;
          color: var(--yellow-500);
        }

        strong {
          display: block;
          margin-bottom: 0.5rem;
        }

        p {
          margin: 0;
          color: var(--text-color-secondary);
        }
      }
    }

    .final-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }
  }

  .tutorial-dialog {
    .tutorial-content {
      .tutorial-step {
        h3 {
          margin-top: 0;
        }

        p {
          line-height: 1.6;
          margin: 1rem 0;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .library-journey-game {
    padding: 1rem;

    .stage-selector {
      .stage-item {
        min-width: 100px;

        .stage-name {
          font-size: 0.75rem;
        }
      }
    }

    .stage-actions {
      flex-direction: column;
      gap: 1rem;

      button {
        width: 100%;
      }
    }

    .final-actions {
      flex-direction: column;

      button {
        width: 100%;
      }
    }
  }
}
</style>

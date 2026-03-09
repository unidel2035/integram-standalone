<template>
  <FstPageLayout
    title="Центр обучения ФСТ НТИ"
    subtitle="Всё для освоения платформы: туры, видео, квизы, сценарии"
    icon="pi pi-graduation-cap"
  >
    <template #actions>
      <Button
        label="Мой прогресс"
        icon="pi pi-chart-line"
        severity="secondary"
        size="small"
        @click="$router.push('/fst-learning-progress')"
      />
      <Button
        v-if="learningStore.overallProgress > 0"
        label="Начать тур заново"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        outlined
        @click="handleResetTour"
      />
    </template>

    <div class="dg-page">

      <!-- ── Hero ── -->
      <div class="dg-hero">
        <div class="dg-hero-left">
          <div class="dg-hero-badge">
            <i class="pi pi-graduation-cap"></i>
            Центр обучения
          </div>
          <h1 class="dg-hero-title">
            Добро пожаловать<span v-if="learningStore.userName">, {{ learningStore.userName }}</span>!
          </h1>
          <p class="dg-hero-sub">
            Освойте платформу управления венчурным фондом шаг за шагом.
            Туры, видео, квизы и сценарии — всё в одном месте.
          </p>
          <div class="dg-progress-block">
            <div class="dg-progress-header">
              <span class="dg-progress-label">Ваш прогресс</span>
              <span class="dg-progress-pct">{{ learningStore.overallProgress }}%</span>
            </div>
            <div class="dg-progress-track">
              <div class="dg-progress-fill" :style="{ width: learningStore.overallProgress + '%' }"></div>
            </div>
          </div>
          <div class="dg-hero-actions">
            <Button
              v-if="learningStore.nextRecommended"
              :label="'Продолжить: ' + learningStore.nextRecommended.title"
              icon="pi pi-play"
              size="small"
              @click="handleContinue"
            />
            <Button
              v-else
              label="Все ресурсы"
              icon="pi pi-book"
              size="small"
              @click="activeTab = 'tours'"
            />
          </div>
        </div>
        <div class="dg-hero-right">
          <div class="dg-stats-mini">
            <div class="dg-stat-mini" v-for="stat in heroStats" :key="stat.label">
              <div class="dg-stat-mini-val" :style="{ color: stat.color }">{{ stat.value }}</div>
              <div class="dg-stat-mini-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Quick Start (если роль не выбрана или показываем по умолчанию) ── -->
      <div class="dg-section">
        <div class="dg-section-header">
          <h2 class="dg-section-title">
            <i class="pi pi-bolt"></i>
            Быстрый старт
          </h2>
          <Button
            v-if="!learningStore.userRole"
            label="Выбрать мою роль"
            icon="pi pi-user-edit"
            size="small"
            severity="secondary"
            @click="showRoleDialog = true"
          />
          <span v-else class="dg-role-badge" @click="showRoleDialog = true">
            <i class="pi pi-user"></i>
            {{ currentRoleLabel }}
            <i class="pi pi-pencil dg-role-edit"></i>
          </span>
        </div>

        <div class="dg-quickstart-grid">
          <div
            v-for="task in learningStore.quickStartTasks"
            :key="task.title"
            class="dg-qs-card"
            :class="{ done: task.tourId && learningStore.completedTours.includes(task.tourId) }"
            @click="$router.push(task.route)"
          >
            <div class="dg-qs-icon">
              <i :class="task.icon"></i>
            </div>
            <div class="dg-qs-title">{{ task.title }}</div>
            <i
              v-if="task.tourId && learningStore.completedTours.includes(task.tourId)"
              class="pi pi-check-circle dg-qs-check"
            ></i>
            <i v-else class="pi pi-arrow-right dg-qs-arrow"></i>
          </div>
        </div>
      </div>

      <!-- ── Каталог ресурсов ── -->
      <div class="dg-section">
        <div class="dg-section-header">
          <h2 class="dg-section-title">
            <i class="pi pi-book"></i>
            Каталог ресурсов
          </h2>
        </div>

        <!-- Tabs -->
        <div class="dg-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="dg-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            {{ tab.label }}
            <span class="dg-tab-badge">{{ tab.count }}</span>
          </button>
        </div>

        <!-- Tours tab -->
        <div v-if="activeTab === 'tours'" class="dg-catalog-grid">
          <div
            v-for="tour in learningStore.tours"
            :key="tour.id"
            class="dg-catalog-card"
            :class="{ done: learningStore.completedTours.includes(tour.id) }"
          >
            <div class="dg-cc-header">
              <div class="dg-cc-icon">
                <i :class="tour.icon"></i>
              </div>
              <span v-if="learningStore.completedTours.includes(tour.id)" class="dg-cc-done-badge">
                <i class="pi pi-check"></i> Пройден
              </span>
            </div>
            <div class="dg-cc-title">{{ tour.title }}</div>
            <div class="dg-cc-meta"><i class="pi pi-clock"></i> {{ tour.duration }}</div>
            <router-link :to="tour.route" class="dg-cc-btn">
              {{ learningStore.completedTours.includes(tour.id) ? 'Повторить' : 'Начать тур' }}
            </router-link>
          </div>
        </div>

        <!-- Videos tab -->
        <div v-if="activeTab === 'videos'" class="dg-videos-section">
          <!-- Overall video progress -->
          <div class="dg-video-summary">
            <span class="dg-video-summary-stat">
              <i class="pi pi-check-circle" style="color: #16a34a"></i>
              Просмотрено <strong>{{ learningStore.completedVideos.length }}</strong> из
              <strong>{{ learningStore.videos.length }}</strong> уроков
            </span>
            <div class="dg-video-summary-bar">
              <div
                class="dg-video-summary-fill"
                :style="{ width: videoCompletionPct + '%' }"
              ></div>
            </div>
          </div>

          <!-- Playlists -->
          <div
            v-for="playlist in learningStore.videoPlaylists"
            :key="playlist.id"
            class="dg-playlist"
          >
            <div class="dg-playlist-header" @click="togglePlaylist(playlist.id)">
              <div class="dg-playlist-title-row">
                <div class="dg-playlist-icon">
                  <i :class="playlist.icon"></i>
                </div>
                <div>
                  <div class="dg-playlist-label">{{ playlist.label }}</div>
                  <div class="dg-playlist-meta">{{ playlist.description }}</div>
                </div>
              </div>
              <div class="dg-playlist-right">
                <span class="dg-playlist-progress">
                  {{ playlistProgress(playlist.id) }}
                </span>
                <i :class="expandedPlaylists.includes(playlist.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="dg-playlist-chevron"></i>
              </div>
            </div>

            <Transition name="dg-fade">
              <div v-if="expandedPlaylists.includes(playlist.id)" class="dg-playlist-grid">
                <VideoLesson
                  v-for="video in videosInPlaylist(playlist.id)"
                  :key="video.id"
                  :video="video"
                  @watched="onVideoWatched"
                />
              </div>
            </Transition>
          </div>
        </div>

        <!-- Quizzes tab -->
        <div v-if="activeTab === 'quizzes'" class="dg-catalog-grid">
          <div
            v-for="quiz in learningStore.quizzes"
            :key="quiz.id"
            class="dg-catalog-card"
            :class="{ done: learningStore.completedQuizzes.includes(quiz.id) }"
          >
            <div class="dg-cc-header">
              <div class="dg-cc-icon" style="background: color-mix(in srgb, #2ca5e0 15%, transparent)">
                <i class="pi pi-question-circle" style="color: #2ca5e0"></i>
              </div>
              <span v-if="learningStore.completedQuizzes.includes(quiz.id)" class="dg-cc-done-badge">
                <i class="pi pi-check"></i> Сдан
              </span>
              <span class="dg-cc-tag">{{ quiz.tag }}</span>
            </div>
            <div class="dg-cc-title">{{ quiz.title }}</div>
            <div class="dg-cc-meta"><i class="pi pi-list-check"></i> {{ quiz.questions }} вопросов</div>
            <router-link to="/fst-quiz" class="dg-cc-btn">
              {{ learningStore.completedQuizzes.includes(quiz.id) ? 'Пройти снова' : 'Начать квиз' }}
            </router-link>
          </div>
        </div>

        <!-- Scenarios tab -->
        <div v-if="activeTab === 'scenarios'" class="dg-catalog-grid">
          <div
            v-for="scenario in learningStore.scenarios"
            :key="scenario.id"
            class="dg-catalog-card"
            :class="{ done: learningStore.completedScenarios.includes(scenario.id) }"
          >
            <div class="dg-cc-header">
              <div class="dg-cc-icon" style="background: color-mix(in srgb, #16a34a 15%, transparent)">
                <i class="pi pi-play" style="color: #16a34a"></i>
              </div>
              <span v-if="learningStore.completedScenarios.includes(scenario.id)" class="dg-cc-done-badge">
                <i class="pi pi-check"></i> Выполнен
              </span>
              <span class="dg-cc-tag">{{ scenario.tag }}</span>
            </div>
            <div class="dg-cc-title">{{ scenario.title }}</div>
            <div class="dg-cc-meta"><i class="pi pi-list"></i> {{ scenario.steps }} шагов</div>
            <button class="dg-cc-btn" @click="learningStore.completeScenario(scenario.id)">
              {{ learningStore.completedScenarios.includes(scenario.id) ? 'Повторить' : 'Запустить' }}
            </button>
          </div>
        </div>

        <!-- Glossary tab -->
        <div v-if="activeTab === 'glossary'" class="dg-glossary-promo">
          <div class="dg-gp-icon"><i class="pi pi-book"></i></div>
          <div>
            <div class="dg-gp-title">Глоссарий венчурных терминов</div>
            <p class="dg-gp-desc">
              Более 150 терминов с пояснениями: от IRR и Waterfall до Cap Table и SAFE.
              Поиск, категории, примеры из практики.
            </p>
            <router-link to="/fst-glossary" class="dg-cc-btn" style="display:inline-block">
              Открыть глоссарий
            </router-link>
          </div>
        </div>
      </div>

      <!-- ── Последние активности ── -->
      <div v-if="learningStore.recentActivities.length > 0" class="dg-section">
        <div class="dg-section-header">
          <h2 class="dg-section-title">
            <i class="pi pi-history"></i>
            Последние активности
          </h2>
          <router-link to="/fst-learning-progress" class="dg-see-all">
            Весь прогресс <i class="pi pi-arrow-right"></i>
          </router-link>
        </div>
        <div class="dg-activity-list">
          <div v-for="(act, idx) in learningStore.recentActivities" :key="idx" class="dg-activity-row">
            <i :class="activityIcon(act.type)" class="dg-act-icon"></i>
            <div class="dg-act-body">
              <span class="dg-act-title">Вы {{ activityVerb(act.type) }}: {{ act.resourceTitle }}</span>
            </div>
            <span class="dg-act-time">{{ formatTime(act.timestamp) }}</span>
          </div>
        </div>
        <div v-if="learningStore.nextRecommended" class="dg-next-rec">
          <i class="pi pi-arrow-right"></i>
          <span>
            <strong>Следующее:</strong>
            {{ learningStore.nextRecommended.title }}
          </span>
        </div>
      </div>

      <!-- ── Для AI-агентов ── -->
      <div class="dg-section dg-ai-section">
        <div class="dg-section-header">
          <h2 class="dg-section-title">
            <i class="pi pi-microchip-ai"></i>
            Для AI-агентов
          </h2>
        </div>
        <div class="dg-ai-grid">
          <div class="dg-ai-card">
            <div class="dg-ai-card-title">
              <i class="pi pi-link"></i> Platform Manifest
            </div>
            <p class="dg-ai-card-desc">
              Агент может изучить структуру платформы через manifest-эндпоинт:
            </p>
            <code class="dg-ai-code">GET /api/platform/manifest</code>
            <p class="dg-ai-card-desc" style="margin-top: 0.5rem">
              Возвращает JSON: все модули, маршруты, описания, роли пользователей.
            </p>
          </div>
          <div class="dg-ai-card">
            <div class="dg-ai-card-title">
              <i class="pi pi-code"></i> MCP-инструменты
            </div>
            <p class="dg-ai-card-desc">
              Агент может работать с данными фонда через 60+ MCP-инструментов Integram:
            </p>
            <div class="dg-ai-examples">
              <code class="dg-ai-code-sm">integram_get_all_objects({ db: 'fst', typeId: 1155 })</code>
              <code class="dg-ai-code-sm">integram_create_object({ db: 'fst', typeId: 1155, name: '...' })</code>
              <code class="dg-ai-code-sm">integram_natural_query({ query: 'проекты на стадии ИК' })</code>
            </div>
          </div>
          <div class="dg-ai-card">
            <div class="dg-ai-card-title">
              <i class="pi pi-send"></i> Как агент изучает платформу
            </div>
            <ol class="dg-ai-steps">
              <li>Получает manifest → понимает структуру модулей</li>
              <li>Аутентифицируется в Integram через MCP</li>
              <li>Использует <code>integram_get_schema</code> для каждой базы</li>
              <li>Обходит данные через <code>integram_get_all_objects</code></li>
              <li>Строит контекст для ответов пользователю</li>
            </ol>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Role selection dialog ── -->
    <Dialog v-model:visible="showRoleDialog" modal header="Выберите вашу роль" :style="{ width: '480px' }">
      <div class="dg-role-grid">
        <div
          v-for="role in learningStore.availableRoles"
          :key="role.id"
          class="dg-role-card"
          :class="{ selected: learningStore.userRole === role.id }"
          @click="selectRole(role.id)"
        >
          <i :class="role.icon" class="dg-role-icon"></i>
          <div class="dg-role-label">{{ role.label }}</div>
          <div class="dg-role-desc">{{ role.description }}</div>
        </div>
      </div>
    </Dialog>

    <!-- ── Feature Hints Reset ── -->
    <div class="dg-hints-section">
      <div class="dg-hints-header">
        <i class="pi pi-lightbulb" style="color: var(--p-primary-color)"></i>
        <span>Подсказки платформы</span>
      </div>
      <p class="dg-hints-desc">
        При первом посещении каждой страницы платформа показывает обучающие подсказки-пульсы.
        Если хотите увидеть их снова — нажмите кнопку ниже.
      </p>
      <div class="dg-hints-row">
        <span class="dg-hints-count">
          <i class="pi pi-check-circle" style="color: var(--p-primary-color)"></i>
          Просмотрено подсказок: <strong>{{ hintsSeenCount }}</strong>
        </span>
        <button class="dg-hints-reset-btn" @click="resetFeatureHints">
          <i class="pi pi-refresh"></i>
          Показать все подсказки заново
        </button>
      </div>
      <Transition name="dg-fade">
        <div v-if="hintsResetDone" class="dg-hints-ok">
          <i class="pi pi-check"></i>
          Сброшено! При следующем посещении страниц подсказки появятся снова.
        </div>
      </Transition>
    </div>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useLearningStore } from '@/stores/learningStore'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useFeatureHints } from '@/composables/useFeatureHints.js'
import VideoLesson from '@/components/VideoLesson.vue'

const router = useRouter()
const learningStore = useLearningStore()
const { resetAllHints, seenCount: hintsSeenCount } = useFeatureHints()

const hintsResetDone = ref(false)
function resetFeatureHints() {
  resetAllHints()
  hintsResetDone.value = true
  setTimeout(() => { hintsResetDone.value = false }, 3000)
}

const showRoleDialog = ref(false)
const activeTab = ref('tours')

// ── Video playlists ──
// Start with first playlist open by default
const expandedPlaylists = ref(['onboarding'])

function togglePlaylist(playlistId) {
  const idx = expandedPlaylists.value.indexOf(playlistId)
  if (idx >= 0) {
    expandedPlaylists.value.splice(idx, 1)
  } else {
    expandedPlaylists.value.push(playlistId)
  }
}

function videosInPlaylist(playlistId) {
  return learningStore.videos.filter(v => v.playlist === playlistId)
}

function playlistProgress(playlistId) {
  const all = videosInPlaylist(playlistId)
  const done = all.filter(v => learningStore.completedVideos.includes(v.id)).length
  return `${done} / ${all.length}`
}

const videoCompletionPct = computed(() => {
  const total = learningStore.videos.length
  if (!total) return 0
  return Math.round((learningStore.completedVideos.length / total) * 100)
})

function onVideoWatched(videoId) {
  learningStore.completeVideo(videoId)
}

const tabs = computed(() => [
  { id: 'tours',     label: 'Туры',     icon: 'pi pi-map',             count: learningStore.tours.length },
  { id: 'videos',    label: 'Видео',    icon: 'pi pi-video',           count: learningStore.videos.length },
  { id: 'quizzes',   label: 'Квизы',    icon: 'pi pi-question-circle', count: learningStore.quizzes.length },
  { id: 'scenarios', label: 'Сценарии', icon: 'pi pi-play',            count: learningStore.scenarios.length },
  { id: 'glossary',  label: 'Глоссарий', icon: 'pi pi-book',           count: null },
])

const heroStats = computed(() => [
  {
    label: 'Туров',
    value: learningStore.completedTours.length + ' / ' + learningStore.tours.length,
    color: 'var(--p-primary-color)',
  },
  {
    label: 'Квизов',
    value: learningStore.completedQuizzes.length + ' / ' + learningStore.quizzes.length,
    color: '#2ca5e0',
  },
  {
    label: 'Видео',
    value: learningStore.completedVideos.length + ' / ' + learningStore.videos.length,
    color: '#d97706',
  },
])

const currentRoleLabel = computed(() => {
  const role = learningStore.availableRoles.find(r => r.id === learningStore.userRole)
  return role?.label || ''
})

function selectRole(roleId) {
  learningStore.setRole(roleId)
  showRoleDialog.value = false
}

function handleContinue() {
  const next = learningStore.nextRecommended
  if (!next) return
  if (next.route) router.push(next.route)
  else if (next.type === 'quiz') router.push('/fst-quiz')
}

function handleResetTour() {
  learningStore.resetProgress()
}

function activityIcon(type) {
  const map = { tour: 'pi pi-map', video: 'pi pi-video', quiz: 'pi pi-question-circle', scenario: 'pi pi-play' }
  return map[type] || 'pi pi-circle'
}

function activityVerb(type) {
  const map = { tour: 'прошли тур', video: 'посмотрели', quiz: 'сдали квиз', scenario: 'выполнили сценарий' }
  return map[type] || 'завершили'
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'только что'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад'
  if (diff < 172800000) return 'вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.dg-page {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ── Hero ── */
.dg-hero {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  padding: 2rem;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--p-primary-color) 12%, var(--p-surface-card)) 0%,
    var(--p-surface-card) 100%
  );
  border: 1px solid var(--p-content-border-color);
  border-radius: 1.25rem;
}

.dg-hero-left {
  flex: 1;
}

.dg-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--p-primary-color);
  color: white;
  padding: 0.25rem 0.875rem;
  border-radius: 2rem;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.875rem;
}

.dg-hero-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 0.625rem;
  line-height: 1.25;
  color: var(--p-text-color);
}

.dg-hero-sub {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  margin: 0 0 1.25rem;
  line-height: 1.6;
}

.dg-progress-block {
  margin-bottom: 1.25rem;
}

.dg-progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.dg-progress-pct {
  color: var(--p-primary-color);
}

.dg-progress-label {
  color: var(--p-text-muted-color);
}

.dg-progress-track {
  height: 8px;
  background: var(--p-content-border-color);
  border-radius: 99px;
  overflow: hidden;
}

.dg-progress-fill {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 99px;
  transition: width 0.6s ease;
  min-width: 4px;
}

.dg-hero-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dg-hero-right {
  flex-shrink: 0;
}

.dg-stats-mini {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-width: 130px;
}

.dg-stat-mini {
  text-align: right;
}

.dg-stat-mini-val {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
}

.dg-stat-mini-label {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  margin-top: 0.2rem;
}

/* ── Section ── */
.dg-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dg-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dg-section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-color);
}

.dg-section-title i {
  color: var(--p-primary-color);
}

.dg-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-primary-color);
  border: 1px solid var(--p-primary-color);
  border-radius: 2rem;
  padding: 0.2rem 0.75rem;
  cursor: pointer;
  user-select: none;
}

.dg-role-edit {
  font-size: 0.65rem;
  opacity: 0.7;
}

/* ── Quick start ── */
.dg-quickstart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.875rem;
}

.dg-qs-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.dg-qs-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.dg-qs-card.done {
  background: color-mix(in srgb, #16a34a 6%, var(--p-surface-card));
  border-color: color-mix(in srgb, #16a34a 25%, var(--p-content-border-color));
}

.dg-qs-icon {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
  font-size: 1rem;
}

.dg-qs-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.3;
}

.dg-qs-check {
  color: #16a34a;
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  font-size: 1rem;
}

.dg-qs-arrow {
  color: var(--p-text-muted-color);
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  font-size: 0.85rem;
}

/* ── Tabs ── */
.dg-tabs {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  padding: 0.375rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;
  width: fit-content;
  max-width: 100%;
}

.dg-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.dg-tab:hover {
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  color: var(--p-text-color);
}

.dg-tab.active {
  background: var(--p-primary-color);
  color: white;
}

.dg-tab-badge {
  background: color-mix(in srgb, currentColor 15%, transparent);
  border-radius: 99px;
  padding: 0 0.4rem;
  font-size: 0.7rem;
  min-width: 1.2em;
  text-align: center;
}

/* ── Catalog grid ── */
.dg-catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.dg-catalog-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  padding: 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  transition: border-color 0.15s;
}

.dg-catalog-card:hover {
  border-color: var(--p-primary-color);
}

.dg-catalog-card.done {
  background: color-mix(in srgb, #16a34a 5%, var(--p-surface-card));
}

.dg-cc-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dg-cc-icon {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
  font-size: 1rem;
  flex-shrink: 0;
}

.dg-cc-done-badge {
  font-size: 0.7rem;
  color: #16a34a;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: auto;
}

.dg-cc-tag {
  font-size: 0.7rem;
  color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 2rem;
  font-weight: 600;
  margin-left: auto;
}

.dg-cc-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.35;
  flex: 1;
}

.dg-cc-meta {
  font-size: 0.775rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.dg-cc-btn {
  display: inline-block;
  text-align: center;
  padding: 0.4rem 1rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  color: var(--p-primary-color);
  border: 1px solid var(--p-primary-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
  margin-top: auto;
}

.dg-cc-btn:hover {
  background: color-mix(in srgb, var(--p-primary-color) 22%, transparent);
}

/* ── Glossary promo ── */
.dg-glossary-promo {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  padding: 1.5rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 1rem;
}

.dg-gp-icon {
  width: 56px;
  height: 56px;
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
  font-size: 1.5rem;
  flex-shrink: 0;
}

.dg-gp-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.dg-gp-desc {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 0.875rem;
}

/* ── Videos section ── */
.dg-videos-section {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dg-video-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;
  font-size: 0.85rem;
}

.dg-video-summary-stat {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--p-text-muted-color);
}

.dg-video-summary-bar {
  flex: 1;
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 99px;
  overflow: hidden;
}

.dg-video-summary-fill {
  height: 100%;
  background: #16a34a;
  border-radius: 99px;
  transition: width 0.5s ease;
}

/* ── Playlist ── */
.dg-playlist {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  overflow: hidden;
}

.dg-playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  gap: 1rem;
  user-select: none;
}

.dg-playlist-header:hover {
  background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
}

.dg-playlist-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dg-playlist-icon {
  width: 40px;
  height: 40px;
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.dg-playlist-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.dg-playlist-meta {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-top: 0.1rem;
}

.dg-playlist-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dg-playlist-progress {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  padding: 0.1rem 0.5rem;
  border-radius: 2rem;
}

.dg-playlist-chevron {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  transition: transform 0.2s;
}

.dg-playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 1rem;
}

/* ── Activity ── */
.dg-activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dg-activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.625rem;
  font-size: 0.875rem;
}

.dg-act-icon {
  color: var(--p-primary-color);
  flex-shrink: 0;
}

.dg-act-body {
  flex: 1;
  min-width: 0;
}

.dg-act-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.dg-act-time {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  flex-shrink: 0;
}

.dg-see-all {
  font-size: 0.8rem;
  color: var(--p-primary-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dg-next-rec {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 25%, var(--p-content-border-color));
  border-radius: 0.625rem;
  font-size: 0.875rem;
  color: var(--p-text-color);
}

.dg-next-rec > i {
  color: var(--p-primary-color);
  flex-shrink: 0;
}

/* ── AI section ── */
.dg-ai-section {
  padding: 1.5rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 1.25rem;
}

.dg-ai-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.dg-ai-card {
  padding: 1.125rem;
  background: color-mix(in srgb, var(--p-primary-color) 4%, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
}

.dg-ai-card-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--p-text-color);
}

.dg-ai-card-title i {
  color: var(--p-primary-color);
}

.dg-ai-card-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 0 0 0.5rem;
}

.dg-ai-code {
  display: block;
  font-family: monospace;
  font-size: 0.78rem;
  padding: 0.4rem 0.625rem;
  background: color-mix(in srgb, var(--p-text-color) 8%, transparent);
  border-radius: 0.375rem;
  color: var(--p-text-color);
  word-break: break-all;
}

.dg-ai-examples {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.dg-ai-code-sm {
  display: block;
  font-family: monospace;
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  background: color-mix(in srgb, var(--p-text-color) 8%, transparent);
  border-radius: 0.375rem;
  color: var(--p-text-color);
  word-break: break-all;
}

.dg-ai-steps {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.7;
}

.dg-ai-steps code {
  font-family: monospace;
  background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
  font-size: 0.78em;
}

/* ── Role dialog ── */
.dg-role-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.875rem;
  padding-top: 0.25rem;
}

.dg-role-card {
  padding: 1.125rem;
  border: 2px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}

.dg-role-card:hover {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
}

.dg-role-card.selected {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
}

.dg-role-icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
  margin-bottom: 0.5rem;
}

.dg-role-label {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
}

.dg-role-desc {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .dg-hero {
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.25rem;
  }
  .dg-hero-right {
    width: 100%;
  }
  .dg-stats-mini {
    flex-direction: row;
    justify-content: space-around;
    min-width: unset;
  }
  .dg-stat-mini {
    text-align: center;
  }
  .dg-hero-title {
    font-size: 1.25rem;
  }
  .dg-quickstart-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dg-role-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .dg-catalog-grid {
    grid-template-columns: 1fr;
  }
  .dg-quickstart-grid {
    grid-template-columns: 1fr;
  }
  .dg-ai-grid {
    grid-template-columns: 1fr;
  }
  .dg-tabs {
    width: 100%;
    justify-content: center;
  }
}
</style>

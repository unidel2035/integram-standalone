<template>
  <FstPageLayout
    title="Мой прогресс"
    subtitle="Статистика обучения и достижения"
    icon="pi pi-chart-line"
  >
    <div class="lp-page">

      <!-- Summary cards -->
      <div class="lp-stats-row">
        <div class="lp-stat-card">
          <div class="lp-stat-icon" style="background: color-mix(in srgb, var(--p-primary-color) 15%, transparent)">
            <i class="pi pi-graduation-cap" style="color: var(--p-primary-color)"></i>
          </div>
          <div class="lp-stat-value">{{ learningStore.overallProgress }}%</div>
          <div class="lp-stat-label">Общий прогресс</div>
        </div>
        <div class="lp-stat-card">
          <div class="lp-stat-icon" style="background: color-mix(in srgb, #16a34a 15%, transparent)">
            <i class="pi pi-map" style="color: #16a34a"></i>
          </div>
          <div class="lp-stat-value">{{ learningStore.completedTours.length }} / {{ learningStore.tours.length }}</div>
          <div class="lp-stat-label">Туров пройдено</div>
        </div>
        <div class="lp-stat-card">
          <div class="lp-stat-icon" style="background: color-mix(in srgb, #2ca5e0 15%, transparent)">
            <i class="pi pi-question-circle" style="color: #2ca5e0"></i>
          </div>
          <div class="lp-stat-value">{{ learningStore.completedQuizzes.length }} / {{ learningStore.quizzes.length }}</div>
          <div class="lp-stat-label">Квизов сдано</div>
        </div>
        <div class="lp-stat-card">
          <div class="lp-stat-icon" style="background: color-mix(in srgb, #d97706 15%, transparent)">
            <i class="pi pi-video" style="color: #d97706"></i>
          </div>
          <div class="lp-stat-value">{{ learningStore.completedVideos.length }} / {{ learningStore.videos.length }}</div>
          <div class="lp-stat-label">Видео просмотрено</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="lp-progress-section">
        <div class="lp-progress-header">
          <span>Общий прогресс обучения</span>
          <span class="lp-progress-pct">{{ learningStore.overallProgress }}%</span>
        </div>
        <div class="lp-progress-track">
          <div class="lp-progress-fill" :style="{ width: learningStore.overallProgress + '%' }"></div>
        </div>
      </div>

      <div class="lp-grid">
        <!-- Tours progress -->
        <div class="lp-section-card">
          <div class="lp-section-title">
            <i class="pi pi-map"></i> Туры по модулям
          </div>
          <div class="lp-resource-list">
            <div
              v-for="tour in learningStore.tours"
              :key="tour.id"
              class="lp-resource-row"
              :class="{ done: learningStore.completedTours.includes(tour.id) }"
            >
              <i :class="tour.icon" class="lp-rr-icon"></i>
              <div class="lp-rr-body">
                <div class="lp-rr-title">{{ tour.title }}</div>
                <div class="lp-rr-meta">{{ tour.duration }}</div>
              </div>
              <i
                v-if="learningStore.completedTours.includes(tour.id)"
                class="pi pi-check-circle lp-done-icon"
              ></i>
              <router-link v-else :to="tour.route" class="lp-start-btn">
                Начать
              </router-link>
            </div>
          </div>
        </div>

        <!-- Quizzes progress -->
        <div class="lp-section-card">
          <div class="lp-section-title">
            <i class="pi pi-question-circle"></i> Квизы
          </div>
          <div class="lp-resource-list">
            <div
              v-for="quiz in learningStore.quizzes"
              :key="quiz.id"
              class="lp-resource-row"
              :class="{ done: learningStore.completedQuizzes.includes(quiz.id) }"
            >
              <i class="pi pi-list-check lp-rr-icon"></i>
              <div class="lp-rr-body">
                <div class="lp-rr-title">{{ quiz.title }}</div>
                <div class="lp-rr-meta">{{ quiz.questions }} вопросов · {{ quiz.tag }}</div>
              </div>
              <i
                v-if="learningStore.completedQuizzes.includes(quiz.id)"
                class="pi pi-check-circle lp-done-icon"
              ></i>
              <router-link v-else to="/fst-quiz" class="lp-start-btn">
                Начать
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent activity -->
      <div class="lp-section-card" style="margin-top: 1.5rem">
        <div class="lp-section-title">
          <i class="pi pi-history"></i> Последняя активность
        </div>
        <div v-if="learningStore.recentActivities.length === 0" class="lp-empty">
          <i class="pi pi-info-circle"></i> Пока нет активности. Начните с тура по главной странице.
        </div>
        <div class="lp-activity-list">
          <div
            v-for="(activity, idx) in learningStore.recentActivities"
            :key="idx"
            class="lp-activity-row"
          >
            <i :class="activityIcon(activity.type)" class="lp-act-icon"></i>
            <div class="lp-act-body">
              <span class="lp-act-title">{{ activity.resourceTitle }}</span>
              <span class="lp-act-type">{{ activityLabel(activity.type) }}</span>
            </div>
            <span class="lp-act-time">{{ formatTime(activity.timestamp) }}</span>
          </div>
        </div>
      </div>

    </div>
  </FstPageLayout>
</template>

<script setup>
import { useLearningStore } from '@/stores/learningStore'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const learningStore = useLearningStore()

function activityIcon(type) {
  const map = {
    tour: 'pi pi-map',
    video: 'pi pi-video',
    quiz: 'pi pi-question-circle',
    scenario: 'pi pi-play',
  }
  return map[type] || 'pi pi-circle'
}

function activityLabel(type) {
  const map = {
    tour: 'тур',
    video: 'видео',
    quiz: 'квиз',
    scenario: 'сценарий',
  }
  return map[type] || type
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
.lp-page {
  max-width: 980px;
  margin: 0 auto;
}

.lp-stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.lp-stat-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.lp-stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.lp-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.lp-stat-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.lp-progress-section {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}

.lp-progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.lp-progress-pct {
  color: var(--p-primary-color);
}

.lp-progress-track {
  height: 10px;
  background: var(--p-content-border-color);
  border-radius: 99px;
  overflow: hidden;
}

.lp-progress-fill {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 99px;
  transition: width 0.6s ease;
}

.lp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 1.25rem;
}

.lp-section-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.875rem;
  padding: 1.25rem;
}

.lp-section-title {
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-color);
}

.lp-section-title i {
  color: var(--p-primary-color);
}

.lp-resource-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-resource-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--p-content-border-color);
  font-size: 0.875rem;
  transition: background 0.15s;
}

.lp-resource-row.done {
  background: color-mix(in srgb, #16a34a 6%, var(--p-surface-card));
  border-color: color-mix(in srgb, #16a34a 20%, var(--p-content-border-color));
}

.lp-rr-icon {
  color: var(--p-primary-color);
  font-size: 1rem;
  flex-shrink: 0;
}

.lp-rr-body {
  flex: 1;
  min-width: 0;
}

.lp-rr-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp-rr-meta {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.lp-done-icon {
  color: #16a34a;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.lp-start-btn {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
  padding: 0.2rem 0.625rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 2rem;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
}

.lp-start-btn:hover {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

.lp-empty {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  padding: 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lp-activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--p-content-border-color);
  font-size: 0.875rem;
}

.lp-act-icon {
  color: var(--p-primary-color);
  font-size: 1rem;
  flex-shrink: 0;
}

.lp-act-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.lp-act-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp-act-type {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lp-act-time {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .lp-grid {
    grid-template-columns: 1fr;
  }
  .lp-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<template>
  <FstPageLayout>
    <template #header>
      <div class="lp-title-group">
        <span class="lp-live-dot" />
        <span class="lp-title">Мой прогресс</span>
        <span class="lp-sep">·</span>
        <span class="lp-sub">достижения и траектория обучения</span>
      </div>
    </template>

    <!-- Metrics strip -->
    <div class="lp-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-graduation-cap fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ learningStore.overallProgress }}%</div>
        <div class="fst-metric-item-label">Общий прогресс</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-map fst-metric-item-icon" style="color: var(--fst-green)"></i>
        <div class="fst-metric-item-val">{{ learningStore.completedTours.length }} / {{ learningStore.tours.length }}</div>
        <div class="fst-metric-item-label">Туров пройдено</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-question-circle fst-metric-item-icon" style="color: var(--fst-cyan)"></i>
        <div class="fst-metric-item-val">{{ learningStore.completedQuizzes.length }} / {{ learningStore.quizzes.length }}</div>
        <div class="fst-metric-item-label">Квизов сдано</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-video fst-metric-item-icon" style="color: var(--fst-brand)"></i>
        <div class="fst-metric-item-val">{{ learningStore.completedVideos.length }} / {{ learningStore.videos.length }}</div>
        <div class="fst-metric-item-label">Видео просмотрено</div>
      </div>
    </div>

    <div class="lp-page">

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
      <div class="lp-section-card">
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
/* ── Header ── */
.lp-title-group { display: flex; align-items: center; gap: 8px; }
.lp-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--p-primary-color); flex-shrink: 0; animation: lp-pulse 2s infinite; }
@keyframes lp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.lp-title { font-size: 14px; font-weight: 600; color: var(--p-text-color); }
.lp-sep { color: var(--p-text-muted-color); }
.lp-sub { font-size: 0.82rem; color: var(--p-text-muted-color); font-weight: 400; }

/* ── Metrics flush ── */
.lp-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }

/* ── Content wrapper ── */
.lp-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.lp-progress-section {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 16px 20px;
}

.lp-progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.lp-progress-pct { color: var(--p-primary-color); }

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
  gap: 16px;
}

.lp-section-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 16px;
}

.lp-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lp-resource-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lp-resource-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
  font-size: 0.875rem;
  transition: background 0.15s;
}

.lp-resource-row.done {
  background: color-mix(in srgb, var(--fst-green) 6%, var(--p-surface-card));
  border-color: color-mix(in srgb, var(--fst-green) 20%, var(--p-content-border-color));
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
  color: var(--fst-green);
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
  gap: 6px;
}

.lp-activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
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
  .lp-grid { grid-template-columns: 1fr; }
}
</style>

<template>
  <Card class="progress-summary-card">
    <template #title>
      <div class="summary-header">
        <i class="pi pi-chart-line"></i>
        <span>{{ title }}</span>
      </div>
    </template>
    <template #content>
      <div class="progress-content">
        <!-- Progress Overview -->
        <div class="progress-overview">
          <h3>📜 Твой прогресс обучения:</h3>
          <div class="lessons-list">
            <div
              v-for="lesson in progress.lessons"
              :key="lesson.id"
              class="lesson-item"
              :class="{
                'completed': lesson.completed,
                'current': lesson.id === 5 && !lesson.completed
              }"
            >
              <i :class="getLessonIcon(lesson)"></i>
              <span>Урок {{ lesson.id }}: {{ lesson.title }}</span>
              <Tag
                v-if="lesson.completed"
                value="✅"
                severity="success"
                class="ml-2"
              />
              <Tag
                v-else-if="lesson.id === 5"
                value="🔥 в процессе"
                severity="warning"
                class="ml-2"
              />
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🏆</div>
            <div class="stat-content">
              <div class="stat-label">Получено бейджей</div>
              <div class="stat-value">{{ progress.badges }}/{{ progress.totalBadges }}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-content">
              <div class="stat-label">Очки опыта (XP)</div>
              <div class="stat-value">{{ progress.xp }}/{{ progress.totalXp }}</div>
            </div>
          </div>
        </div>

        <!-- XP Progress Bar -->
        <div class="xp-progress">
          <ProgressBar
            :value="xpPercentage"
            :showValue="false"
            class="xp-bar"
          />
          <small class="xp-text">{{ progress.xp }} / {{ progress.totalXp }} XP</small>
        </div>

        <!-- Brief Summary -->
        <div class="summary-message">
          <Message severity="info" :closable="false">
            <p>
              {{ summaryText }}
            </p>
          </Message>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: {
    type: Object,
    required: true,
    default: () => ({
      lessons: [],
      badges: 0,
      totalBadges: 5,
      xp: 0,
      totalXp: 300
    })
  },
  title: {
    type: String,
    default: 'Что мы уже умеем'
  },
  summaryText: {
    type: String,
    default: 'Ты научился создавать агентов, соединять их в workflow, настраивать параметры и следить за выполнением. Теперь время применить все эти знания для решения реальных задач!'
  }
})

const xpPercentage = computed(() => {
  return (props.progress.xp / props.progress.totalXp) * 100
})

const getLessonIcon = (lesson) => {
  if (lesson.completed) {
    return 'pi pi-check-circle text-green-500'
  } else if (lesson.id === 5) {
    return 'pi pi-spin pi-spinner text-orange-500'
  }
  return 'pi pi-circle text-gray-400'
}
</script>

<style scoped lang="scss">
.progress-summary-card {
  margin-bottom: 2rem;

  .summary-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;

    i {
      color: var(--primary-color);
    }
  }

  .progress-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .progress-overview {
    h3 {
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
  }

  .lessons-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--p-surface-card);
    border-radius: var(--content-border-radius);
  }

  .lesson-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;

    &.completed {
      background: rgba(34, 197, 94, 0.1);
    }

    &.current {
      background: rgba(251, 146, 60, 0.1);
      font-weight: 500;
      animation: pulse 2s infinite;
    }

    i {
      font-size: 1.2rem;
    }

    span {
      flex: 1;
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--p-surface-card);
    border-radius: var(--content-border-radius);
    border: 1px solid var(--surface-border);
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .stat-icon {
      font-size: 2rem;
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .stat-label {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }

      .stat-value {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--primary-color);
      }
    }
  }

  .xp-progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .xp-bar {
      height: 1.5rem;
    }

    .xp-text {
      text-align: center;
      color: var(--text-color-secondary);
    }
  }

  .summary-message {
    p {
      margin: 0;
      line-height: 1.6;
      font-size: 1rem;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

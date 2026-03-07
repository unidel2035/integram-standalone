<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="'Интерактивные туры по платформе'"
    :style="{ width: '600px' }"
    :breakpoints="{ '960px': '75vw', '640px': '95vw' }"
  >
    <div class="tours-menu">
      <p class="tours-intro">
        Познакомьтесь с ключевыми модулями платформы ФСТ НТИ через интерактивные туры.
        Каждый тур подсветит важные элементы интерфейса и объяснит их назначение.
      </p>

      <div class="tours-progress" v-if="tourProgress > 0">
        <div class="progress-label">
          Пройдено туров: {{ completedCount }} из {{ totalCount }}
        </div>
        <ProgressBar :value="tourProgress" />
      </div>

      <div class="tours-list">
        <div
          v-for="tour in availableTours"
          :key="tour.id"
          class="tour-card"
          :class="{ 'tour-completed': tour.completed }"
          @click="startTour(tour.id)"
        >
          <div class="tour-header">
            <div class="tour-icon">
              <i :class="tour.icon"></i>
            </div>
            <div class="tour-info">
              <div class="tour-name">{{ tour.name }}</div>
              <div class="tour-desc">{{ tour.description }}</div>
            </div>
            <div class="tour-badge">
              <i v-if="tour.completed" class="pi pi-check-circle" style="color: var(--green-500)"></i>
              <span v-else class="tour-steps">{{ tour.steps }} шагов</span>
            </div>
          </div>
          <Button
            :label="tour.completed ? 'Пройти заново' : 'Начать тур'"
            :icon="tour.completed ? 'pi pi-refresh' : 'pi pi-play'"
            :outlined="tour.completed"
            size="small"
            @click.stop="startTour(tour.id)"
          />
        </div>
      </div>

      <div class="tours-actions">
        <Button
          label="Сбросить все туры"
          icon="pi pi-replay"
          severity="secondary"
          text
          @click="resetAllTours"
        />
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useProductTour } from '@/composables/useProductTour'
import { useRouter } from 'vue-router'

const visible = defineModel('visible', { type: Boolean, default: false })

const onboardingStore = useOnboardingStore()
const router = useRouter()

const {
  startFstHubTour,
  startFstCommitteeTour,
  startFstDealTour,
  startFstPortfolioTour,
  startFstDealflowTour,
} = useProductTour()

const availableTours = ref([
  {
    id: 'fst-hub',
    name: 'Главная ФСТ',
    description: 'Обзор платформы, воронка инвестиций, ключевые метрики',
    icon: 'pi pi-home',
    steps: 10,
    route: '/fst-hub',
    completed: false,
  },
  {
    id: 'fst-committee',
    name: 'AI Инвесткомитет',
    description: '6 AI-агентов, дебаты, голосование, решение ИК',
    icon: 'pi pi-users',
    steps: 8,
    route: '/fst-committee',
    completed: false,
  },
  {
    id: 'fst-deal',
    name: 'Сделка',
    description: 'SPV, транши, Term Sheet, финансовая модель',
    icon: 'pi pi-handshake',
    steps: 7,
    route: '/fst-deal',
    completed: false,
  },
  {
    id: 'fst-portfolio',
    name: 'Портфель',
    description: 'Светофор рисков, датчики здоровья, AI-отчёты',
    icon: 'pi pi-briefcase',
    steps: 6,
    route: '/fst-portfolio',
    completed: false,
  },
  {
    id: 'fst-dealflow',
    name: 'Дилфлоу',
    description: 'Воронка заявок, фильтры, AI-скоринг',
    icon: 'pi pi-filter',
    steps: 5,
    route: '/fst-dealflow',
    completed: false,
  },
])

const completedCount = computed(() =>
  availableTours.value.filter(t => t.completed).length
)

const totalCount = computed(() => availableTours.value.length)

const tourProgress = computed(() =>
  totalCount.value > 0 ? Math.round((completedCount.value / totalCount.value) * 100) : 0
)

const updateTourStatus = () => {
  availableTours.value.forEach(tour => {
    const step = onboardingStore.tourSteps.find(s => s.id === tour.id)
    if (step) {
      tour.completed = step.completed
    }
  })
}

const startTour = (tourId) => {
  const tour = availableTours.value.find(t => t.id === tourId)
  if (!tour) return

  // Close dialog
  visible.value = false

  // Navigate to tour route if not already there
  if (router.currentRoute.value.path !== tour.route) {
    router.push(tour.route).then(() => {
      // Wait for route to load, then start tour
      setTimeout(() => {
        launchTour(tourId)
      }, 500)
    })
  } else {
    // Already on correct route, start tour immediately
    launchTour(tourId)
  }
}

const launchTour = (tourId) => {
  switch (tourId) {
    case 'fst-hub':
      startFstHubTour()
      break
    case 'fst-committee':
      startFstCommitteeTour()
      break
    case 'fst-deal':
      startFstDealTour()
      break
    case 'fst-portfolio':
      startFstPortfolioTour()
      break
    case 'fst-dealflow':
      startFstDealflowTour()
      break
  }
}

const resetAllTours = () => {
  onboardingStore.resetTour('fst-hub')
  onboardingStore.resetTour('fst-committee')
  onboardingStore.resetTour('fst-deal')
  onboardingStore.resetTour('fst-portfolio')
  onboardingStore.resetTour('fst-dealflow')
  updateTourStatus()
}

onMounted(() => {
  updateTourStatus()
})

defineExpose({
  updateTourStatus,
})
</script>

<style scoped>
.tours-menu {
  padding: 0.5rem 0;
}

.tours-intro {
  color: var(--text-color-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.tours-progress {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.progress-label {
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-color);
}

.tours-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.tour-card {
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface-card);
}

.tour-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.tour-card.tour-completed {
  background: var(--surface-ground);
  border-color: var(--green-200);
}

.tour-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.tour-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.tour-info {
  flex: 1;
}

.tour-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.tour-desc {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.tour-badge {
  flex-shrink: 0;
}

.tour-steps {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  padding: 0.25rem 0.5rem;
  background: var(--surface-ground);
  border-radius: 4px;
}

.tours-actions {
  display: flex;
  justify-content: center;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}
</style>

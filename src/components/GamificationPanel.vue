<template>
  <Card class="gamification-panel">
    <template #header>
      <div class="panel-header">
        <h3>
          <i class="pi pi-trophy"></i>
          Ваш прогресс
        </h3>
        <Button
          icon="pi pi-info-circle"
          text
          rounded
          @click="showInfoDialog = true"
          v-tooltip.left="'Информация о системе достижений'"
        />
      </div>
    </template>

    <template #content>
      <!-- Level and XP -->
      <div class="level-section">
        <div class="level-badge">
          <div class="level-number">{{ level }}</div>
          <div class="level-label">Уровень</div>
        </div>
        <div class="xp-progress">
          <div class="xp-header">
            <span class="xp-label">{{ totalXP }} XP</span>
            <span class="xp-next">{{ xpToNextLevel }} XP до уровня {{ level + 1 }}</span>
          </div>
          <ProgressBar :value="levelProgress" :showValue="false" class="xp-bar" />
        </div>
      </div>

      <Divider />

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-item">
          <i class="pi pi-check-circle" style="color: var(--p-green-500);"></i>
          <div class="stat-content">
            <div class="stat-value">{{ quizCompletionCount }}</div>
            <div class="stat-label">Квизов пройдено</div>
          </div>
        </div>

        <div class="stat-item">
          <i class="pi pi-star" style="color: var(--p-yellow-500);"></i>
          <div class="stat-content">
            <div class="stat-value">{{ averageQuizScore }}%</div>
            <div class="stat-label">Средний балл</div>
          </div>
        </div>

        <div class="stat-item">
          <i class="pi pi-fire" style="color: var(--p-orange-500);"></i>
          <div class="stat-content">
            <div class="stat-value">{{ currentStreak }}</div>
            <div class="stat-label">Дней подряд</div>
          </div>
        </div>

        <div class="stat-item">
          <i class="pi pi-trophy" style="color: var(--p-purple-500);"></i>
          <div class="stat-content">
            <div class="stat-value">{{ unlockedBadgesCount }}</div>
            <div class="stat-label">Бейджей</div>
          </div>
        </div>
      </div>

      <!-- Recent Badges -->
      <div v-if="recentBadges.length > 0" class="recent-badges-section">
        <h4>Последние достижения</h4>
        <div class="badges-grid">
          <div
            v-for="badge in recentBadges"
            :key="badge.id"
            class="badge-item"
            v-tooltip.top="badge.description"
          >
            <div class="badge-icon">{{ badge.icon }}</div>
            <div class="badge-name">{{ badge.name }}</div>
            <div class="badge-date">{{ formatDate(badge.unlockedAt) }}</div>
          </div>
        </div>
        <Button
          label="Посмотреть все"
          text
          size="small"
          @click="showAllBadges"
        />
      </div>

      <!-- Quick Actions -->
      <div class="actions-section">
        <Button
          label="Все достижения"
          icon="pi pi-trophy"
          outlined
          size="small"
          @click="showBadgesDialog = true"
        />
      </div>
    </template>
  </Card>

  <!-- Badges Dialog -->
  <Dialog
    v-model:visible="showBadgesDialog"
    header="Все достижения"
    :modal="true"
    :style="{ width: '800px', maxWidth: '95vw' }"
  >
    <TabView>
      <TabPanel header="Все">
        <div class="badges-collection">
          <div
            v-for="badge in allBadges"
            :key="badge.id"
            class="collection-badge"
            :class="{ locked: !badge.unlocked }"
          >
            <div class="collection-badge-icon">{{ badge.icon }}</div>
            <div class="collection-badge-name">{{ badge.name }}</div>
            <div class="collection-badge-desc">{{ badge.description }}</div>
            <Tag
              v-if="badge.unlocked"
              value="Получен"
              severity="success"
              class="badge-status"
            />
            <Tag
              v-else
              value="Заблокирован"
              severity="secondary"
              class="badge-status"
            />
            <div v-if="badge.unlocked" class="collection-badge-date">
              {{ formatDate(badge.unlockedAt) }}
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Квизы">
        <div class="badges-collection">
          <div
            v-for="badge in badgesByCategory('quiz')"
            :key="badge.id"
            class="collection-badge"
            :class="{ locked: !badge.unlocked }"
          >
            <div class="collection-badge-icon">{{ badge.icon }}</div>
            <div class="collection-badge-name">{{ badge.name }}</div>
            <div class="collection-badge-desc">{{ badge.description }}</div>
            <Tag
              v-if="badge.unlocked"
              value="Получен"
              severity="success"
              class="badge-status"
            />
            <Tag
              v-else
              value="Заблокирован"
              severity="secondary"
              class="badge-status"
            />
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Модули">
        <div class="badges-collection">
          <div
            v-for="badge in badgesByCategory('module')"
            :key="badge.id"
            class="collection-badge"
            :class="{ locked: !badge.unlocked }"
          >
            <div class="collection-badge-icon">{{ badge.icon }}</div>
            <div class="collection-badge-name">{{ badge.name }}</div>
            <div class="collection-badge-desc">{{ badge.description }}</div>
            <Tag
              v-if="badge.unlocked"
              value="Получен"
              severity="success"
              class="badge-status"
            />
            <Tag
              v-else
              value="Заблокирован"
              severity="secondary"
              class="badge-status"
            />
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Серии">
        <div class="badges-collection">
          <div
            v-for="badge in badgesByCategory('streak')"
            :key="badge.id"
            class="collection-badge"
            :class="{ locked: !badge.unlocked }"
          >
            <div class="collection-badge-icon">{{ badge.icon }}</div>
            <div class="collection-badge-name">{{ badge.name }}</div>
            <div class="collection-badge-desc">{{ badge.description }}</div>
            <Tag
              v-if="badge.unlocked"
              value="Получен"
              severity="success"
              class="badge-status"
            />
            <Tag
              v-else
              value="Заблокирован"
              severity="secondary"
              class="badge-status"
            />
          </div>
        </div>
      </TabPanel>
    </TabView>
  </Dialog>

  <!-- Info Dialog -->
  <Dialog
    v-model:visible="showInfoDialog"
    header="О системе достижений"
    :modal="true"
    :style="{ width: '600px', maxWidth: '95vw' }"
  >
    <div class="info-content">
      <h4>Как это работает?</h4>
      <p>Система геймификации помогает отслеживать ваш прогресс обучения и мотивирует изучать новые модули.</p>

      <h4>XP и уровни</h4>
      <ul>
        <li>Проходите квизы и получайте XP-очки</li>
        <li>За каждый правильный ответ — 10 XP</li>
        <li>Каждые 100 XP — новый уровень</li>
      </ul>

      <h4>Бейджи</h4>
      <ul>
        <li>Разблокируйте бейджи за достижения</li>
        <li>Получите 100% в квизе — получите специальный бейдж эксперта</li>
        <li>Занимайтесь каждый день — получайте бейджи за серии</li>
      </ul>

      <h4>Серии (Streaks)</h4>
      <ul>
        <li>Занимайтесь каждый день, чтобы поддерживать серию</li>
        <li>Чем длиннее серия, тем круче бейджи</li>
        <li>Пропустите день — серия сбросится</li>
      </ul>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Divider from 'primevue/divider'
import Dialog from 'primevue/dialog'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import { useGamificationStore } from '@/stores/gamificationStore'

const gamificationStore = useGamificationStore()

// State
const showBadgesDialog = ref(false)
const showInfoDialog = ref(false)

// Computed from store
const level = computed(() => gamificationStore.level)
const totalXP = computed(() => gamificationStore.totalXP)
const xpToNextLevel = computed(() => gamificationStore.xpToNextLevel)
const levelProgress = computed(() => gamificationStore.levelProgress)
const quizCompletionCount = computed(() => gamificationStore.quizCompletionCount)
const averageQuizScore = computed(() => gamificationStore.averageQuizScore)
const currentStreak = computed(() => gamificationStore.currentStreak)
const allBadges = computed(() => gamificationStore.allBadges)

const unlockedBadgesCount = computed(() => {
  return allBadges.value.filter(b => b.unlocked).length
})

const recentBadges = computed(() => {
  return allBadges.value
    .filter(b => b.unlocked)
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 3)
})

// Methods
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function showAllBadges() {
  showBadgesDialog.value = true
}

function badgesByCategory(category) {
  return allBadges.value.filter(b => b.category === category)
}
</script>

<style scoped>
.gamification-panel {
  background: var(--surface-card);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 0 1.5rem;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.level-section {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.level-badge {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--p-primary-500) 0%, var(--p-purple-500) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.level-number {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.level-label {
  font-size: 0.75rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.xp-progress {
  flex: 1;
}

.xp-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.xp-label {
  font-weight: 600;
  font-size: 1.1rem;
}

.xp-next {
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.xp-bar {
  height: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-item i {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--p-text-secondary-color);
}

.recent-badges-section {
  margin-top: 1rem;
}

.recent-badges-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.badges-grid {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.badge-item {
  flex: 1;
  text-align: center;
  padding: 1rem;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.badge-item:hover {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
  transform: translateY(-2px);
}

.badge-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.badge-name {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.badge-date {
  font-size: 0.75rem;
  color: var(--p-text-secondary-color);
}

.actions-section {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

.badges-collection {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  max-height: 500px;
  overflow-y: auto;
  padding: 0.5rem;
}

.collection-badge {
  padding: 1.5rem;
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  text-align: center;
  transition: all 0.2s ease;
  background: var(--surface-card);
}

.collection-badge.locked {
  opacity: 0.5;
  filter: grayscale(1);
}

.collection-badge:not(.locked):hover {
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.collection-badge-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.collection-badge-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.collection-badge-desc {
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
  margin-bottom: 0.75rem;
  min-height: 2.5rem;
}

.badge-status {
  margin-bottom: 0.5rem;
}

.collection-badge-date {
  font-size: 0.75rem;
  color: var(--p-text-secondary-color);
}

.info-content h4 {
  margin: 1.5rem 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.info-content h4:first-child {
  margin-top: 0;
}

.info-content p {
  margin: 0 0 1rem 0;
  line-height: 1.6;
}

.info-content ul {
  margin: 0.5rem 0 1rem 1.5rem;
  line-height: 1.8;
}

.info-content li {
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .level-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .level-badge {
    align-self: center;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .badges-grid {
    flex-direction: column;
  }

  .badges-collection {
    grid-template-columns: 1fr;
  }
}
</style>

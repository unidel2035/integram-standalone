<template>
  <Card class="public-agent-card" @click="handleCardClick">
    <!-- Agent Screenshot/Icon -->
    <template #header>
      <div class="agent-header">
        <div class="agent-icon-wrapper">
          <span class="agent-icon">{{ agent.icon || '🤖' }}</span>
        </div>
        <div class="agent-badge" v-if="agent.category">
          <Tag :value="agent.category" severity="info" />
        </div>
      </div>
    </template>

    <!-- Agent Info -->
    <template #content>
      <div class="agent-info">
        <h3 class="agent-name">{{ agent.name }}</h3>
        <p class="agent-description">{{ agent.description }}</p>

        <!-- Stats -->
        <div class="agent-stats">
          <div class="stat-item" :title="`${stats.views} просмотров`">
            <i class="pi pi-eye"></i>
            <span>{{ formatNumber(stats.views) }}</span>
          </div>
          <div class="stat-item" :title="`${stats.likes} лайков`">
            <i class="pi pi-heart"></i>
            <span>{{ formatNumber(stats.likes) }}</span>
          </div>
          <div class="stat-item" :title="`${stats.comments} комментариев`">
            <i class="pi pi-comment"></i>
            <span>{{ formatNumber(stats.comments) }}</span>
          </div>
          <div class="stat-item" :title="`${stats.runs} запусков`">
            <i class="pi pi-play"></i>
            <span>{{ formatNumber(stats.runs) }}</span>
          </div>
        </div>

        <!-- Creator Info -->
        <div class="agent-creator" v-if="agent.createdBy">
          <Avatar
            :label="getInitials(agent.createdBy)"
            size="small"
            shape="circle"
            class="creator-avatar"
          />
          <span class="creator-name">{{ agent.createdBy }}</span>
        </div>
      </div>
    </template>

    <!-- Actions -->
    <template #footer>
      <div class="agent-actions">
        <Button
          label="Открыть"
          icon="pi pi-external-link"
          class="p-button-sm p-button-primary"
          @click.stop="openAgent"
        />
        <Button
          icon="pi pi-heart"
          :class="['p-button-sm p-button-text', { 'p-button-danger': isLiked }]"
          @click.stop="toggleLike"
          :loading="likingInProgress"
        />
        <Button
          icon="pi pi-share-alt"
          class="p-button-sm p-button-text"
          @click.stop="shareAgent"
        />
      </div>
    </template>
  </Card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import axios from 'axios'

const props = defineProps({
  agent: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const toast = useToast()

// State
const stats = ref(props.agent.stats || { views: 0, likes: 0, comments: 0, runs: 0 })
const isLiked = ref(false)
const likingInProgress = ref(false)

// Format large numbers (1000 -> 1K, 1000000 -> 1M)
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

// Get user initials
const getInitials = (name) => {
  if (!name) return '?'
  const parts = name.split(' ')
  return parts.map(p => p[0]).join('').substring(0, 2).toUpperCase()
}

// Handle card click (increment views)
const handleCardClick = async () => {
  try {
    await axios.post(`/api/public/agent/${props.agent.agentId}/increment-stat`, {
      stat: 'views'
    })
    stats.value.views++
  } catch (error) {
    console.error('Failed to increment views:', error)
  }
}

// Open agent in new page
const openAgent = () => {
  if (props.agent.slug) {
    router.push(`/a/${props.agent.slug}`)
  } else {
    router.push(`/agent/${props.agent.agentId}`)
  }
}

// Toggle like
const toggleLike = async () => {
  if (likingInProgress.value) return

  likingInProgress.value = true
  try {
    // TODO: Get actual user ID from auth store
    const userId = 'guest'

    const response = await axios.post(`/api/public/agent/${props.agent.agentId}/like`, {
      userId
    })

    if (response.data.success) {
      isLiked.value = response.data.liked
      stats.value.likes = response.data.likes

      toast.add({
        severity: isLiked.value ? 'success' : 'info',
        summary: isLiked.value ? 'Лайк добавлен' : 'Лайк удалён',
        life: 2000
      })
    }
  } catch (error) {
    console.error('Failed to toggle like:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось обновить лайк',
      life: 3000
    })
  } finally {
    likingInProgress.value = false
  }
}

// Share agent
const shareAgent = async () => {
  const url = props.agent.slug
    ? `${window.location.origin}/a/${props.agent.slug}`
    : `${window.location.origin}/agent/${props.agent.agentId}`

  try {
    if (navigator.share) {
      await navigator.share({
        title: props.agent.name,
        text: props.agent.description,
        url
      })
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url)
      toast.add({
        severity: 'success',
        summary: 'Ссылка скопирована',
        detail: 'Ссылка на агента скопирована в буфер обмена',
        life: 3000
      })
    }
  } catch (error) {
    console.error('Failed to share:', error)
  }
}
</script>

<style scoped>
.public-agent-card {
  cursor: pointer;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.public-agent-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.agent-header {
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
  text-align: center;
  border-radius: 8px 8px 0 0;
}

.agent-icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.agent-icon {
  font-size: 3rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.agent-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.agent-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0;
}

.agent-description {
  color: var(--text-color-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-stats {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface-100);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.stat-item i {
  font-size: 1rem;
}

.stat-item:first-child i {
  color: #3B82F6;
}

.stat-item:nth-child(2) i {
  color: #EF4444;
}

.stat-item:nth-child(3) i {
  color: #10B981;
}

.stat-item:nth-child(4) i {
  color: #8B5CF6;
}

.agent-creator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border);
}

.creator-name {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.agent-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.agent-actions .p-button:first-child {
  flex: 1;
}

.p-button-danger i {
  color: #EF4444 !important;
}

@media (max-width: 768px) {
  .agent-header {
    padding: 1.5rem 1rem;
  }

  .agent-icon {
    font-size: 2.5rem;
  }

  .agent-name {
    font-size: 1.1rem;
  }

  .agent-stats {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat-item {
    font-size: 0.85rem;
  }
}
</style>

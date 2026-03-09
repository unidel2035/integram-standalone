<template>
  <div class="vl-card" :class="{ watched: isWatched, expanded: isExpanded }">
    <!-- Player / Preview -->
    <div class="vl-player-wrap">
      <!-- YouTube embed -->
      <template v-if="video.youtubeId && isExpanded">
        <iframe
          :src="`https://www.youtube.com/embed/${video.youtubeId}?start=${Math.floor(savedProgress)}&rel=0&modestbranding=1`"
          class="vl-iframe"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          @load="onIframeLoad"
        ></iframe>
      </template>

      <!-- Native video -->
      <template v-else-if="video.src && isExpanded">
        <video
          ref="videoEl"
          class="vl-video"
          controls
          preload="metadata"
          :src="video.src"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @loadedmetadata="onLoadedMeta"
        ></video>
      </template>

      <!-- Preview thumbnail / placeholder -->
      <template v-else>
        <div
          class="vl-preview"
          :style="video.thumbnail ? `background-image: url(${video.thumbnail})` : ''"
          @click="toggleExpand"
        >
          <div class="vl-play-btn" :title="isExpanded ? 'Свернуть' : 'Смотреть'">
            <i :class="isExpanded ? 'pi pi-chevron-up' : 'pi pi-play'"></i>
          </div>
          <div v-if="video.duration" class="vl-duration-badge">
            <i class="pi pi-clock"></i>
            {{ video.duration }}
          </div>
          <div v-if="isWatched" class="vl-watched-overlay">
            <i class="pi pi-check-circle"></i>
          </div>
        </div>
      </template>

      <!-- Collapse button when expanded with embed -->
      <button v-if="isExpanded && (video.youtubeId || video.src)" class="vl-collapse-btn" @click="toggleExpand">
        <i class="pi pi-chevron-up"></i>
        Свернуть
      </button>
    </div>

    <!-- Info row -->
    <div class="vl-info">
      <div class="vl-meta-row">
        <span class="vl-playlist-tag" v-if="video.playlistTag">{{ video.playlistTag }}</span>
        <span class="vl-duration" v-if="video.duration">
          <i class="pi pi-clock"></i>
          {{ video.duration }}
        </span>
        <span v-if="isWatched" class="vl-watched-badge">
          <i class="pi pi-check-circle"></i>
          Просмотрено
        </span>
      </div>

      <div class="vl-title">{{ video.title }}</div>

      <!-- Progress bar -->
      <div v-if="progressPercent > 0 && !isWatched" class="vl-progress-wrap">
        <div class="vl-progress-bar" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div v-else-if="isWatched" class="vl-progress-wrap">
        <div class="vl-progress-bar watched-bar" style="width: 100%"></div>
      </div>

      <!-- Chapters / timestamps -->
      <div v-if="video.chapters && video.chapters.length && !isExpanded" class="vl-chapters">
        <div
          v-for="ch in video.chapters"
          :key="ch.time"
          class="vl-chapter-item"
          @click="jumpToChapter(ch.time)"
          :title="`Перейти к ${ch.label}`"
        >
          <i class="pi pi-step-forward"></i>
          <span class="vl-chapter-time">{{ formatSeconds(ch.time) }}</span>
          <span class="vl-chapter-label">{{ ch.label }}</span>
        </div>
      </div>

      <!-- Notes / synopsis -->
      <div v-if="video.notes" class="vl-notes">
        <i class="pi pi-file-edit"></i>
        <span>{{ video.notes }}</span>
      </div>

      <!-- Related module link -->
      <div v-if="video.moduleRoute" class="vl-module-link">
        <router-link :to="video.moduleRoute" class="vl-module-btn">
          <i class="pi pi-arrow-right"></i>
          {{ video.moduleLabel || 'Перейти в модуль' }}
        </router-link>
      </div>

      <!-- Action buttons -->
      <div class="vl-actions">
        <button
          v-if="!isExpanded && (video.youtubeId || video.src)"
          class="vl-action-btn primary"
          @click="toggleExpand"
        >
          <i class="pi pi-play"></i>
          {{ isWatched ? 'Смотреть снова' : (progressPercent > 0 ? 'Продолжить' : 'Смотреть') }}
        </button>
        <button
          v-if="!isWatched"
          class="vl-action-btn secondary"
          @click="markWatched"
          title="Отметить как просмотренное"
        >
          <i class="pi pi-check"></i>
          Отметить просмотренным
        </button>
        <button
          class="vl-action-btn ai-btn"
          :disabled="scriptLoading"
          @click="generateScript"
          title="Написать сценарий урока с помощью AI"
        >
          <i :class="scriptLoading ? 'pi pi-spin pi-spinner' : 'pi pi-microchip-ai'"></i>
          Сценарий AI
        </button>
      </div>
    </div>

    <!-- AI Script dialog -->
    <Transition name="vl-slide">
      <div v-if="scriptText" class="vl-script-panel">
        <div class="vl-script-header">
          <span><i class="pi pi-microchip-ai"></i> AI-сценарий урока</span>
          <button class="vl-script-close" @click="scriptText = ''">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="vl-script-body">{{ scriptText }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  video: {
    type: Object,
    required: true,
    // Expected shape:
    // {
    //   id: string,
    //   title: string,
    //   duration?: string,        // '3:45'
    //   youtubeId?: string,       // YouTube video ID
    //   src?: string,             // native video URL
    //   thumbnail?: string,       // preview image URL
    //   notes?: string,           // short synopsis
    //   moduleRoute?: string,     // '/fst-deal'
    //   moduleLabel?: string,     // 'Перейти в модуль Сделки'
    //   playlistTag?: string,     // playlist name
    //   chapters?: [{ time: 90, label: 'Раздел 1' }]
    // }
  },
})

const emit = defineEmits(['watched'])

const router = useRouter()
const videoEl = ref(null)
const isExpanded = ref(false)
const scriptText = ref('')
const scriptLoading = ref(false)

// --- Progress tracking ---
const PROGRESS_KEY = (id) => `video_progress_${id}`
const WATCHED_THRESHOLD = 0.8

const savedProgress = computed(() => {
  const v = localStorage.getItem(PROGRESS_KEY(props.video.id))
  return v ? parseFloat(v) : 0
})

const videoDurationSec = ref(0)

const progressPercent = computed(() => {
  if (!videoDurationSec.value) {
    // Estimate from duration string "3:45"
    const dur = parseDurationString(props.video.duration)
    if (!dur) return 0
    const sp = savedProgress.value
    return Math.min(100, Math.round((sp / dur) * 100))
  }
  return Math.min(100, Math.round((savedProgress.value / videoDurationSec.value) * 100))
})

const isWatched = computed(() => {
  // Check localStorage watched flag
  return localStorage.getItem(`video_watched_${props.video.id}`) === '1'
})

// Watch for 80% threshold to auto-mark watched
watch(progressPercent, (pct) => {
  if (pct >= 80 && !isWatched.value) {
    markWatched()
  }
})

function parseDurationString(str) {
  if (!str) return 0
  const parts = str.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function onTimeUpdate(e) {
  const t = e.target.currentTime
  videoDurationSec.value = e.target.duration || 0
  localStorage.setItem(PROGRESS_KEY(props.video.id), String(t))
}

function onLoadedMeta(e) {
  videoDurationSec.value = e.target.duration || 0
  // Restore position
  if (videoEl.value && savedProgress.value > 5) {
    videoEl.value.currentTime = savedProgress.value
  }
}

function onEnded() {
  markWatched()
}

function onIframeLoad() {
  // YouTube iframe tracking is limited without API — we rely on manual mark or time threshold
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && videoEl.value) {
    nextTick(() => {
      if (videoEl.value && savedProgress.value > 5) {
        videoEl.value.currentTime = savedProgress.value
      }
    })
  }
}

function jumpToChapter(timeSec) {
  isExpanded.value = true
  nextTick(() => {
    if (videoEl.value) {
      videoEl.value.currentTime = timeSec
      videoEl.value.play()
    }
  })
}

function markWatched() {
  localStorage.setItem(`video_watched_${props.video.id}`, '1')
  emit('watched', props.video.id)
}

// --- AI script generation ---
async function generateScript() {
  if (scriptLoading.value) return
  scriptLoading.value = true
  scriptText.value = ''
  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `Напиши сценарий 3-минутного урока по теме: "${props.video.title}" для пользователя платформы ФСТ НТИ (управление венчурным фондом). Структура: вступление (30 сек), основная часть с 3-4 ключевыми тезисами, заключение с призывом к действию. Стиль: дружелюбный, деловой, без воды. Длина: ~350 слов.`,
        systemPrompt: 'Ты — методолог онлайн-обучения. Пишешь сценарии скринкастов для платформы управления венчурным фондом ФСТ НТИ. Пиши на русском языке.',
        application: 'VideoLesson',
      }),
    })
    const data = await resp.json()
    scriptText.value = data.response || data.error || 'Не удалось получить ответ от AI.'
  } catch (e) {
    scriptText.value = 'Ошибка при обращении к AI: ' + e.message
  } finally {
    scriptLoading.value = false
  }
}
</script>

<style scoped>
.vl-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.vl-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 2px 12px color-mix(in srgb, var(--p-primary-color) 12%, transparent);
}

.vl-card.watched {
  border-color: color-mix(in srgb, #16a34a 35%, var(--p-content-border-color));
  background: color-mix(in srgb, #16a34a 4%, var(--p-surface-card));
}

/* ── Player wrap ── */
.vl-player-wrap {
  position: relative;
  width: 100%;
}

.vl-iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  display: block;
}

.vl-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  background: #000;
}

.vl-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-card));
  background-size: cover;
  background-position: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.15s;
}

.vl-preview:hover .vl-play-btn {
  transform: scale(1.1);
  background: var(--p-primary-color);
  color: white;
}

.vl-play-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 20%, var(--p-surface-card));
  color: var(--p-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: transform 0.15s, background 0.15s, color 0.15s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}

.vl-duration-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.vl-watched-overlay {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #16a34a;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.vl-collapse-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.375rem;
  background: color-mix(in srgb, var(--p-text-color) 6%, transparent);
  border: none;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  cursor: pointer;
  justify-content: center;
  transition: background 0.15s;
}

.vl-collapse-btn:hover {
  background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
}

/* ── Info ── */
.vl-info {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.vl-meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vl-playlist-tag {
  font-size: 0.7rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  color: var(--p-primary-color);
  padding: 0.1rem 0.5rem;
  border-radius: 2rem;
}

.vl-duration {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.vl-watched-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: #16a34a;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}

.vl-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.35;
}

/* ── Progress bar ── */
.vl-progress-wrap {
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 99px;
  overflow: hidden;
}

.vl-progress-bar {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 99px;
  transition: width 0.4s ease;
}

.watched-bar {
  background: #16a34a;
}

/* ── Chapters ── */
.vl-chapters {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.vl-chapter-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  padding: 0.15rem 0.25rem;
  border-radius: 0.25rem;
  transition: background 0.12s, color 0.12s;
}

.vl-chapter-item:hover {
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  color: var(--p-primary-color);
}

.vl-chapter-item i {
  font-size: 0.65rem;
  color: var(--p-primary-color);
}

.vl-chapter-time {
  font-family: monospace;
  font-size: 0.72rem;
  min-width: 2.5rem;
}

/* ── Notes ── */
.vl-notes {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  background: color-mix(in srgb, var(--p-text-color) 4%, transparent);
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
}

.vl-notes i {
  color: var(--p-primary-color);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

/* ── Module link ── */
.vl-module-link {
  margin-top: auto;
}

.vl-module-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
  border: 1px solid var(--p-primary-color);
  border-radius: 0.5rem;
  padding: 0.25rem 0.625rem;
  transition: background 0.12s;
}

.vl-module-btn:hover {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

/* ── Actions ── */
.vl-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.vl-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.vl-action-btn.primary {
  background: var(--p-primary-color);
  color: white;
  border-color: var(--p-primary-color);
}

.vl-action-btn.primary:hover {
  background: color-mix(in srgb, var(--p-primary-color) 85%, #000);
}

.vl-action-btn.secondary {
  background: transparent;
  color: var(--p-text-muted-color);
  border-color: var(--p-content-border-color);
}

.vl-action-btn.secondary:hover {
  background: color-mix(in srgb, var(--p-text-color) 6%, transparent);
  color: var(--p-text-color);
}

.vl-action-btn.ai-btn {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
}

.vl-action-btn.ai-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--p-primary-color) 18%, transparent);
}

.vl-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── AI Script panel ── */
.vl-script-panel {
  border-top: 1px solid var(--p-content-border-color);
  background: color-mix(in srgb, var(--p-primary-color) 5%, var(--p-surface-card));
}

.vl-script-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-text-color);
  border-bottom: 1px solid var(--p-content-border-color);
}

.vl-script-header i {
  color: var(--p-primary-color);
  margin-right: 0.35rem;
}

.vl-script-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 0.2rem;
  font-size: 0.875rem;
  line-height: 1;
  transition: color 0.12s;
}

.vl-script-close:hover {
  color: var(--p-text-color);
}

.vl-script-body {
  padding: 0.875rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--p-text-color);
  white-space: pre-wrap;
  max-height: 320px;
  overflow-y: auto;
}

/* ── Transitions ── */
.vl-slide-enter-active,
.vl-slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.vl-slide-enter-from,
.vl-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .vl-actions {
    flex-direction: column;
  }

  .vl-action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

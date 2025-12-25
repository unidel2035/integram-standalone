<script setup lang="ts">
interface Props {
  width?: string
  height?: string
  showText?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '120',
  height: '32',
  showText: true
})
</script>

<template>
  <div class="logo-display" :style="{ width: props.width + 'px', height: props.height + 'px' }">
    <div class="logo-content">
      <!-- ИНТЕГРАМ Logo Icon -->
      <svg
        :width="props.height"
        :height="props.height"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="logo-icon"
      >
        <!-- Simplified geometric logo representing integration/connectivity -->
        <circle cx="16" cy="16" r="14" fill="url(#gradient1)" opacity="0.2"/>
        <path
          d="M8 16 L16 8 L24 16 L16 24 Z"
          fill="url(#gradient2)"
          stroke="currentColor"
          stroke-width="2"
        />
        <circle cx="16" cy="16" r="4" fill="currentColor"/>
        <defs>
          <linearGradient id="gradient1" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stop-color="#2563eb"/>
            <stop offset="100%" stop-color="#0891b2"/>
          </linearGradient>
          <linearGradient id="gradient2" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
      </svg>

      <!-- ИНТЕГРАМ Text -->
      <span v-if="showText" class="logo-text">ИНТЕГРАМ</span>
    </div>
  </div>
</template>

<style scoped>
.logo-display {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
}

.logo-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-icon {
  flex-shrink: 0;
  color: var(--primary-600);
  transition: transform 0.3s ease;
}

.logo-icon:hover {
  transform: scale(1.05);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-600), var(--cyan-600));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Dark mode adjustments */
.dark .logo-icon {
  color: var(--primary-400);
}

.dark .logo-text {
  background: linear-gradient(135deg, var(--primary-400), var(--cyan-400));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>

<template>
  <div class="fh-wrapper">
    <!-- Default slot content (the element being highlighted) -->
    <slot />

    <!-- Pulse dot + callout — only shown while hint is active -->
    <Transition name="fh-fade">
      <div v-if="active" class="fh-pulse-container" :class="'fh-pos-' + position">
        <!-- Animated pulse dot -->
        <button
          class="fh-pulse"
          :aria-label="'Подсказка: ' + title"
          @click.stop="open = !open"
        >
          <span class="fh-pulse-ring" />
          <span class="fh-pulse-core" />
        </button>

        <!-- Callout card -->
        <Transition name="fh-pop">
          <div v-if="open" class="fh-callout" :class="'fh-callout-' + position" role="tooltip">
            <div class="fh-callout-title">{{ title }}</div>
            <div v-if="description" class="fh-callout-desc">{{ description }}</div>
            <button class="fh-callout-btn" @click.stop="dismiss">
              Понял, спасибо
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFeatureHints } from '@/composables/useFeatureHints.js'

const props = defineProps({
  /** Unique stable identifier for this hint */
  id: {
    type: String,
    required: true,
  },
  /** Short heading shown in the callout */
  title: {
    type: String,
    required: true,
  },
  /** Longer explanation shown in the callout */
  description: {
    type: String,
    default: '',
  },
  /**
   * Where the callout appears relative to the pulse dot.
   * 'top' | 'bottom' | 'left' | 'right'
   */
  position: {
    type: String,
    default: 'bottom',
    validator: (v) => ['top', 'bottom', 'left', 'right'].includes(v),
  },
})

const { isSeen, markSeen } = useFeatureHints()

/** Whether the hint should still be visible at all */
const active = computed(() => !!props.id && !isSeen(props.id))

/** Whether the callout panel is currently open */
const open = ref(false)

function dismiss() {
  open.value = false
  markSeen(props.id)
}

onMounted(() => {
  // Auto-open the callout briefly after mount so users notice it
  if (active.value && props.id) {
    // Small delay so the page settles before we draw attention
    const t = setTimeout(() => { open.value = true }, 800)
    // Auto-collapse after 6 s if the user ignores it (doesn't dismiss)
    const autoClose = setTimeout(() => { open.value = false }, 6800)
    // Cleanup is intentionally skipped for unmount — hints are per-session
    void t; void autoClose
  }
})
</script>

<style scoped>
/* ── Container ─────────────────────────────────────── */
.fh-wrapper {
  position: relative;
  display: inline-block;
}

/* ── Pulse dot placement ───────────────────────────── */
.fh-pulse-container {
  position: absolute;
  z-index: 100;
  pointer-events: none; /* children re-enable below */
}

.fh-pos-top    { top: -10px;  right: -10px; }
.fh-pos-bottom { bottom: -10px; right: -10px; }
.fh-pos-right  { top: -10px;  right: -10px; }
.fh-pos-left   { top: -10px;  left: -10px; }

/* ── Pulse button ──────────────────────────────────── */
.fh-pulse {
  position: relative;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  pointer-events: all;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  outline-offset: 2px;
}

.fh-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--p-primary-color);
  animation: fh-ring-pulse 1.6s ease-out infinite;
  opacity: 0;
}

.fh-pulse-core {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--p-primary-color);
  box-shadow: 0 0 6px 2px color-mix(in srgb, var(--p-primary-color) 60%, transparent);
}

@keyframes fh-ring-pulse {
  0%   { transform: scale(0.6); opacity: 0.8; }
  80%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(2.2); opacity: 0; }
}

/* ── Callout card ──────────────────────────────────── */
.fh-callout {
  pointer-events: all;
  position: absolute;
  z-index: 110;
  width: 240px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Callout arrow via ::before pseudo */
.fh-callout::before {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  transform: rotate(45deg);
}

/* ── Callout positions ─────────────────────────────── */
.fh-callout-bottom {
  top: 28px;
  right: 0;
}
.fh-callout-bottom::before {
  top: -6px;
  right: 6px;
  border-bottom: none;
  border-right: none;
}

.fh-callout-top {
  bottom: 28px;
  right: 0;
}
.fh-callout-top::before {
  bottom: -6px;
  right: 6px;
  border-top: none;
  border-left: none;
}

.fh-callout-right {
  top: 0;
  left: 28px;
}
.fh-callout-right::before {
  top: 6px;
  left: -6px;
  border-top: none;
  border-right: none;
}

.fh-callout-left {
  top: 0;
  right: 28px;
}
.fh-callout-left::before {
  top: 6px;
  right: -6px;
  border-bottom: none;
  border-left: none;
}

/* ── Callout content ───────────────────────────────── */
.fh-callout-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.3;
}

.fh-callout-desc {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.fh-callout-btn {
  align-self: flex-end;
  margin-top: 4px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  background: var(--p-primary-color);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
}

.fh-callout-btn:hover {
  opacity: 0.85;
}

/* ── Transitions ───────────────────────────────────── */
.fh-fade-enter-active,
.fh-fade-leave-active {
  transition: opacity 0.3s;
}
.fh-fade-enter-from,
.fh-fade-leave-to {
  opacity: 0;
}

.fh-pop-enter-active {
  transition: opacity 0.2s, transform 0.2s;
}
.fh-pop-leave-active {
  transition: opacity 0.15s;
}
.fh-pop-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}
.fh-pop-leave-to {
  opacity: 0;
}
</style>

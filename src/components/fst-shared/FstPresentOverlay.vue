<template>
  <Transition name="present-slide">
    <div v-if="store.isActive" class="present-overlay" :class="{ 'present-overlay--min': store.isMinimized }">

      <!-- ═══ MINIMIZED BAR ═══ -->
      <div v-if="store.isMinimized" class="present-mini" @click="store.toggleMinimize()">
        <div class="present-mini-steps">
          <span class="present-mini-dot" v-for="(_, i) in store.totalSteps" :key="i"
            :class="{ active: i === store.currentIndex, done: i < store.currentIndex }"></span>
        </div>
        <div class="present-mini-title">
          <i class="pi pi-microphone"></i>
          <span>ШАГ {{ store.currentIndex + 1 }}/{{ store.totalSteps }} · {{ store.currentStep?.title }}</span>
        </div>
        <div class="present-mini-actions">
          <button class="present-btn-mini" @click.stop="store.prev(router)" :disabled="store.isFirst">
            <i class="pi pi-chevron-left"></i>
          </button>
          <button class="present-btn-mini present-btn-next-mini" @click.stop="store.next(router)" :disabled="store.isLast">
            ДАЛЕЕ <i class="pi pi-chevron-right"></i>
          </button>
          <button class="present-btn-mini present-btn-exit" @click.stop="store.stop()" title="Завершить">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>

      <!-- ═══ EXPANDED PANEL ═══ -->
      <div v-else class="present-panel">

        <!-- Header -->
        <div class="present-header">
          <div class="present-progress-bar">
            <div class="present-progress-fill" :style="{ width: store.progress + '%' }"></div>
          </div>
          <div class="present-header-row">
            <div class="present-step-counter">
              <span class="present-step-badge">ШАГ {{ store.currentIndex + 1 }} / {{ store.totalSteps }}</span>
              <span class="present-route-tag">{{ store.currentStep?.route }}</span>
            </div>
            <div class="present-header-actions">
              <button class="present-ctrl-btn" @click="store.toggleMinimize()" title="Свернуть (H)">
                <i class="pi pi-minus"></i>
              </button>
              <button class="present-ctrl-btn present-ctrl-exit" @click="store.stop()" title="Завершить презентацию">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Step dots navigation -->
        <div class="present-dots">
          <button
            v-for="(step, i) in PRESENT_SCENARIO"
            :key="i"
            class="present-dot"
            :class="{ active: i === store.currentIndex, done: i < store.currentIndex }"
            @click="store.goTo(i, router)"
            :title="step.title"
          ></button>
        </div>

        <!-- Content -->
        <div class="present-content">
          <div class="present-title-block">
            <div class="present-step-title">{{ store.currentStep?.title }}</div>
            <div class="present-step-subtitle">{{ store.currentStep?.subtitle }}</div>
          </div>

          <div class="present-script-block">
            <div class="present-script-label">
              <i class="pi pi-microphone"></i> ГОВОРИТЕ
            </div>
            <div class="present-script-text">
              {{ store.currentStep?.script }}
            </div>
          </div>

          <div v-if="store.currentStep?.actions?.length" class="present-actions-block">
            <div class="present-actions-label">
              <i class="pi pi-cursor"></i> ДЕЙСТВИЯ
            </div>
            <ul class="present-actions-list">
              <li v-for="(action, i) in store.currentStep.actions" :key="i">
                {{ action }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Navigation -->
        <div class="present-nav">
          <button class="present-nav-btn present-nav-prev" @click="store.prev(router)" :disabled="store.isFirst">
            <i class="pi pi-chevron-left"></i> Назад
          </button>
          <div class="present-nav-hint">Пробел / →</div>
          <button
            class="present-nav-btn present-nav-next"
            @click="store.next(router)"
            :disabled="store.isLast"
          >
            {{ store.isLast ? 'Завершено' : 'ДАЛЕЕ' }}
            <i v-if="!store.isLast" class="pi pi-chevron-right"></i>
            <i v-else class="pi pi-check"></i>
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePresentStore, PRESENT_SCENARIO } from '@/stores/presentStore'

const store = usePresentStore()
const router = useRouter()

function onKeydown(e) {
  if (!store.isActive) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.code === 'Space' || e.code === 'ArrowRight') {
    e.preventDefault()
    if (!store.isLast) store.next(router)
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault()
    if (!store.isFirst) store.prev(router)
  }
  if (e.code === 'KeyH') {
    e.preventDefault()
    store.toggleMinimize()
  }
  if (e.code === 'Escape') {
    if (store.isMinimized) store.toggleMinimize()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* ═══════════════════════════════════════ OVERLAY WRAPPER */
.present-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  pointer-events: none;
}
.present-overlay > * { pointer-events: all; }

/* ═══════════════════════════════════════ MINIMIZED BAR */
.present-mini {
  display: flex;
  align-items: center;
  gap: 16px;
  background: color-mix(in srgb, var(--fst-purple) 90%, black);
  border-top: 2px solid var(--fst-purple);
  padding: 10px 20px;
  cursor: pointer;
  user-select: none;
}
.present-mini-steps {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.present-mini-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  transition: background 0.2s;
}
.present-mini-dot.done { background: color-mix(in srgb, var(--fst-purple) 60%, white); }
.present-mini-dot.active { background: white; width: 20px; border-radius: 4px; }

.present-mini-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: white;
}
.present-mini-title .pi { opacity: 0.7; }

.present-mini-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.present-btn-mini {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}
.present-btn-mini:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.present-btn-mini:disabled { opacity: 0.35; cursor: not-allowed; }
.present-btn-next-mini {
  background: white;
  color: var(--fst-purple);
  font-weight: 700;
  padding: 6px 16px;
}
.present-btn-next-mini:hover:not(:disabled) { background: rgba(255,255,255,0.9); }
.present-btn-exit { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.3); }
.present-btn-exit:hover { background: rgba(255,80,80,0.35) !important; }

/* ═══════════════════════════════════════ EXPANDED PANEL */
.present-panel {
  background: #0f0a1e;
  border-top: 2px solid var(--fst-purple);
  box-shadow: 0 -8px 48px rgba(0,0,0,0.7), 0 -2px 24px color-mix(in srgb, var(--fst-purple) 20%, transparent);
  max-height: 50vh;
  overflow-y: auto;
}

/* Progress bar */
.present-progress-bar {
  height: 3px;
  background: rgba(255,255,255,0.1);
  width: 100%;
}
.present-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--fst-purple), var(--fst-blue));
  transition: width 0.4s ease;
}

.present-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 0;
}
.present-step-counter {
  display: flex;
  align-items: center;
  gap: 10px;
}
.present-step-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 15%, transparent);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
}
.present-route-tag {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  font-family: monospace;
}
.present-header-actions {
  display: flex;
  gap: 8px;
}
.present-ctrl-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.6);
  width: 28px; height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.present-ctrl-btn:hover { background: rgba(255,255,255,0.15); color: white; }
.present-ctrl-exit:hover { background: rgba(255,60,60,0.3) !important; color: #ff6060 !important; }

/* Dots nav */
.present-dots {
  display: flex;
  gap: 6px;
  padding: 10px 20px 0;
}
.present-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.15);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}
.present-dot:hover { background: rgba(255,255,255,0.35); transform: scale(1.2); }
.present-dot.done {
  background: color-mix(in srgb, var(--fst-purple) 70%, white);
}
.present-dot.active {
  background: var(--fst-purple);
  width: 28px;
  border-radius: 5px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--fst-purple) 60%, transparent);
}

/* Content */
.present-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 20px;
  padding: 16px 20px;
  align-items: start;
}
.present-title-block {
  min-width: 160px;
}
.present-step-title {
  font-size: 16px;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
}
.present-step-subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.45);
}

.present-script-block {
  flex: 1;
}
.present-script-label, .present-actions-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fst-purple);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.present-script-text {
  font-size: 14px;
  color: rgba(255,255,255,0.9);
  line-height: 1.65;
}

.present-actions-block {
  min-width: 220px;
}
.present-actions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.present-actions-list li {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  padding-left: 14px;
  position: relative;
  line-height: 1.5;
}
.present-actions-list li::before {
  content: '›';
  position: absolute;
  left: 0;
  color: var(--fst-cyan);
  font-weight: 700;
}

/* Navigation */
.present-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.present-nav-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.25);
}
.present-nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s;
}
.present-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.present-nav-prev {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1);
}
.present-nav-prev:hover:not(:disabled) {
  background: rgba(255,255,255,0.12);
  color: white;
}
.present-nav-next {
  background: var(--fst-purple);
  color: white;
  font-size: 15px;
  padding: 10px 32px;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--fst-purple) 40%, transparent);
}
.present-nav-next:hover:not(:disabled) {
  background: color-mix(in srgb, var(--fst-purple) 80%, white);
  transform: translateY(-1px);
  box-shadow: 0 6px 28px color-mix(in srgb, var(--fst-purple) 50%, transparent);
}

/* ═══════════════════════════════════════ ANIMATION */
.present-slide-enter-active,
.present-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.present-slide-enter-from,
.present-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

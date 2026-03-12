<template>
  <div class="fp">

    <!-- ═══ TOPBAR ═══ -->
    <div class="fp-topbar">
      <div class="fp-topbar-left">
        <div class="fp-logo">ФСТ</div>
        <div>
          <div class="fp-topbar-title">Режим презентации</div>
          <div class="fp-topbar-sub">Телесуфлёр Гордина · Встреча с Песковым · {{ today }}</div>
        </div>
      </div>
      <div class="fp-topbar-right">
        <Button
          v-if="!store.isActive"
          label="Запустить"
          icon="pi pi-play"
          @click="store.start()"
        />
        <Button
          v-else
          label="Остановить"
          icon="pi pi-stop"
          severity="danger"
          outlined
          @click="store.stop()"
        />
      </div>
    </div>

    <!-- ═══ TWO COLUMNS ═══ -->
    <div class="fp-layout">

      <!-- LEFT: Teleprompter (Gordin's screen) -->
      <div class="fp-prompter">

        <!-- Not started yet -->
        <Transition name="fp-fade">
          <div v-if="!store.isActive" class="fp-idle">
            <div class="fp-idle-icon"><i class="pi pi-play-circle"></i></div>
            <div class="fp-idle-title">Готов к запуску</div>
            <div class="fp-idle-sub">Откройте второе окно с платформой (ссылка справа), затем нажмите «Запустить»</div>
            <Button label="Запустить презентацию" icon="pi pi-play" severity="success" size="large" @click="store.start()" style="margin-top: 20px" />
          </div>
        </Transition>

        <!-- Active: teleprompter -->
        <Transition name="fp-fade">
          <div v-if="store.isActive" class="fp-active">

            <!-- Progress -->
            <div class="fp-progress-bar">
              <div class="fp-progress-fill" :style="{ width: store.progress + '%' }"></div>
            </div>

            <!-- Step header -->
            <div class="fp-step-header">
              <div class="fp-step-badge">
                ШАГ {{ store.currentIndex + 1 }} / {{ store.totalSteps }}
                <span v-if="store.currentStep?.highlight" class="fp-step-star">★ ключевой</span>
              </div>
              <div class="fp-step-route">{{ store.currentStep?.route }}</div>
            </div>

            <!-- Step dots -->
            <div class="fp-dots">
              <button
                v-for="(step, i) in PRESENT_SCENARIO"
                :key="i"
                class="fp-dot"
                :class="{ active: i === store.currentIndex, done: i < store.currentIndex }"
                @click="store.goTo(i)"
                :title="step.title"
              ></button>
            </div>

            <!-- Title -->
            <div class="fp-title">{{ store.currentStep?.title }}</div>
            <div class="fp-subtitle">{{ store.currentStep?.subtitle }}</div>

            <!-- Script — big, readable -->
            <div class="fp-script-wrap">
              <div class="fp-script-label"><i class="pi pi-microphone"></i> ГОВОРИТЕ</div>
              <div class="fp-script">{{ store.currentStep?.script }}</div>
            </div>

            <!-- Actions -->
            <div v-if="store.currentStep?.actions?.length" class="fp-actions-wrap">
              <div class="fp-actions-label"><i class="pi pi-cursor"></i> ДЕЙСТВИЯ</div>
              <ul class="fp-actions">
                <li v-for="(a, i) in store.currentStep.actions" :key="i">{{ a }}</li>
              </ul>
            </div>

            <!-- AI Insight block -->
            <div class="fp-ai-wrap" v-if="store.aiLoading || store.aiInsight">
              <div class="fp-ai-label">
                <i class="pi pi-sparkles"></i> AI-ИНСАЙТ
                <span v-if="store.aiLoading" class="fp-ai-loading">генерирую...</span>
              </div>
              <template v-if="store.aiInsight && !store.aiLoading">
                <div class="fp-ai-hook">{{ store.aiInsight.hook }}</div>
                <div class="fp-ai-row">
                  <div class="fp-ai-section">
                    <div class="fp-ai-section-label">Вопрос Пескова</div>
                    <div class="fp-ai-section-text">{{ store.aiInsight.peskovQuestion }}</div>
                  </div>
                  <div class="fp-ai-section">
                    <div class="fp-ai-section-label">Ответ Гордина</div>
                    <div class="fp-ai-section-text">{{ store.aiInsight.answer }}</div>
                  </div>
                </div>
                <div class="fp-ai-tech">
                  <i class="pi pi-microchip-ai"></i>
                  {{ store.aiInsight.techNote }}
                </div>
              </template>
            </div>

            <!-- Nav buttons -->
            <div class="fp-nav">
              <Button
                label="Назад"
                icon="pi pi-chevron-left"
                severity="secondary"
                outlined
                :disabled="store.isFirst"
                @click="store.prev()"
              />
              <div class="fp-nav-hint">
                <kbd>Пробел</kbd> <kbd>→</kbd> следующий
              </div>
              <Button
                :label="store.isLast ? 'Завершено' : 'ДАЛЕЕ →'"
                :icon="store.isLast ? 'pi pi-check' : ''"
                :severity="store.isLast ? 'success' : 'primary'"
                :disabled="store.isLast"
                size="large"
                @click="store.next()"
              />
            </div>

          </div>
        </Transition>

      </div>

      <!-- RIGHT: Setup + Scenario list -->
      <div class="fp-sidebar">

        <!-- Demo window link -->
        <div class="fp-card fp-card--demo">
          <div class="fp-card-hd">
            <i class="pi pi-external-link"></i> Окно для Пескова
          </div>
          <div class="fp-card-bd">
            <p>Откройте это окно на экране/проекторе, который видит Песков. Оно будет автоматически переключаться.</p>
            <Button
              label="Открыть чистое окно"
              icon="pi pi-external-link"
              severity="secondary"
              fluid
              @click="openDemoWindow"
            />
            <div class="fp-card-note">В этом окне нет суфлёра — только платформа. Маленький индикатор «DEMO» внизу справа.</div>
          </div>
        </div>

        <!-- GitHub for Peskov -->
        <div class="fp-card fp-card--github">
          <div class="fp-card-hd">
            <i class="pi pi-github"></i> Claude Пескова читает репо
          </div>
          <div class="fp-card-bd">
            <div class="fp-steps-list">
              <div class="fp-step-item">
                <span class="fp-n">1</span>
                <span>GitHub → Settings → Developer settings → Fine-grained tokens → New token → <strong>Contents: Read</strong></span>
              </div>
              <div class="fp-step-item">
                <span class="fp-n">2</span>
                <span>Дайте Пескову токен и ссылку на репо</span>
              </div>
              <div class="fp-step-item">
                <span class="fp-n">3</span>
                <span>Скажите ему: <em>«Попроси Claude прочитать AI_CONTEXT.md в репозитории»</em></span>
              </div>
            </div>
            <div class="fp-session-id">
              <span class="fp-session-label">Сессия в Integram:</span>
              <code>session:present-live</code>
            </div>
          </div>
        </div>

        <!-- Hotkeys -->
        <div class="fp-card fp-card--keys">
          <div class="fp-card-hd">
            <i class="pi pi-keyboard"></i> Горячие клавиши
          </div>
          <div class="fp-card-bd">
            <div class="fp-key-row"><kbd>Пробел</kbd><kbd>→</kbd> <span>Следующий шаг</span></div>
            <div class="fp-key-row"><kbd>←</kbd> <span>Предыдущий шаг</span></div>
            <div class="fp-key-row"><kbd>1</kbd>–<kbd>8</kbd> <span>Перейти на шаг напрямую</span></div>
          </div>
        </div>

        <!-- Scenario overview -->
        <div class="fp-card fp-card--scenario">
          <div class="fp-card-hd">
            <i class="pi pi-list"></i> Сценарий
            <span class="fp-scenario-time">~{{ totalMinutes }} мин</span>
          </div>
          <div class="fp-card-bd fp-card-bd--compact">
            <div
              v-for="(step, i) in PRESENT_SCENARIO"
              :key="i"
              class="fp-scenario-row"
              :class="{
                'fp-scenario-row--active': store.isActive && i === store.currentIndex,
                'fp-scenario-row--done': store.isActive && i < store.currentIndex,
              }"
              @click="store.isActive && store.goTo(i)"
            >
              <span class="fp-scenario-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="fp-scenario-title">{{ step.title }}</span>
              <span v-if="step.highlight" class="fp-scenario-star">★</span>
              <span class="fp-scenario-dur">{{ step.duration }}с</span>
            </div>
          </div>
        </div>

        <!-- Tips -->
        <div class="fp-card fp-card--tips">
          <div class="fp-card-hd"><i class="pi pi-lightbulb"></i> Советы Гордину</div>
          <div class="fp-card-bd">
            <ul class="fp-tips">
              <li>Не торопитесь на шаге 4 (ИК) — дайте агентам поработать</li>
              <li>«Карта знаний» вместо «онтологии» — это договорённость с Песковым</li>
              <li>Если Песков задаёт технический вопрос — скажите «сейчас его Claude ответит» — это усилит эффект</li>
              <li>Акцент: мы упаковываем стартапы, берём на себя всё — это не типичный фонд</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { usePresentStore, PRESENT_SCENARIO } from '@/stores/presentStore'
import Button from 'primevue/button'

const store = usePresentStore()

const today = computed(() =>
  new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
)
const totalMinutes = computed(() =>
  Math.round(PRESENT_SCENARIO.reduce((s, x) => s + x.duration, 0) / 60)
)

function openDemoWindow() {
  window.open(window.location.origin + '/fst-hub', '_blank', 'noopener')
}

// Keyboard navigation — works only when this page is active
function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (!store.isActive) return

  if (e.code === 'Space' || e.code === 'ArrowRight') {
    e.preventDefault()
    store.next()
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault()
    store.prev()
  }
  // Number keys 1–8 for direct step jump
  const num = parseInt(e.key)
  if (!isNaN(num) && num >= 1 && num <= PRESENT_SCENARIO.length) {
    store.goTo(num - 1)
  }
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.fp {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ═══════════════════════════════════════ TOPBAR */
.fp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  position: sticky;
  top: 0;
  z-index: 10;
}
.fp-topbar-left { display: flex; align-items: center; gap: 14px; }
.fp-logo {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--fst-purple), var(--fst-blue));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}
.fp-topbar-title { font-size: 15px; font-weight: 700; color: var(--p-text-color); }
.fp-topbar-sub { font-size: 12px; color: var(--p-text-muted-color); margin-top: 1px; }

/* ═══════════════════════════════════════ LAYOUT */
.fp-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  flex: 1;
  min-height: 0;
}

/* ═══════════════════════════════════════ PROMPTER */
.fp-prompter {
  padding: 32px;
  border-right: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
}

/* Idle */
.fp-idle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
}
.fp-idle-icon { font-size: 48px; color: var(--fst-purple); opacity: 0.4; }
.fp-idle-title { font-size: 20px; font-weight: 700; color: var(--p-text-color); }
.fp-idle-sub { font-size: 14px; color: var(--p-text-muted-color); max-width: 400px; line-height: 1.6; }

/* Active */
.fp-active { display: flex; flex-direction: column; gap: 20px; }

.fp-progress-bar {
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 2px;
  overflow: hidden;
}
.fp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--fst-purple), var(--fst-blue));
  border-radius: 2px;
  transition: width 0.4s ease;
}

.fp-step-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fp-step-badge {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fst-purple);
  background: color-mix(in srgb, var(--fst-purple) 12%, transparent);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 25%, transparent);
  display: flex;
  align-items: center;
  gap: 8px;
}
.fp-step-star { color: var(--fst-brand); }
.fp-step-route { font-size: 12px; color: var(--p-text-muted-color); font-family: monospace; }

.fp-dots { display: flex; gap: 7px; }
.fp-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: none;
  background: var(--p-content-border-color);
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}
.fp-dot:hover { background: var(--p-text-muted-color); transform: scale(1.2); }
.fp-dot.done { background: color-mix(in srgb, var(--fst-purple) 50%, var(--p-surface-card)); }
.fp-dot.active { background: var(--fst-purple); width: 28px; border-radius: 5px; }

.fp-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--p-text-color);
  line-height: 1.2;
}
.fp-subtitle {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin-top: -12px;
}

.fp-script-wrap {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--fst-purple);
  border-radius: 12px;
  padding: 20px;
}
.fp-script-label, .fp-actions-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fst-purple);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp-script {
  font-size: 18px;
  line-height: 1.7;
  color: var(--p-text-color);
}

.fp-actions-wrap {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--fst-cyan);
  border-radius: 12px;
  padding: 16px 20px;
}
.fp-actions-label { color: var(--fst-cyan); }
.fp-actions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fp-actions li {
  font-size: 14px;
  color: var(--p-text-color);
  padding-left: 16px;
  position: relative;
  line-height: 1.5;
}
.fp-actions li::before {
  content: '›';
  position: absolute;
  left: 0;
  color: var(--fst-cyan);
  font-weight: 700;
  font-size: 18px;
  line-height: 1.2;
}

.fp-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
}
.fp-nav-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* ═══════════════════════════════════════ SIDEBAR */
.fp-sidebar {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  background: var(--p-surface-ground);
}
.fp-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  overflow: hidden;
}
.fp-card-hd {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fp-card--demo .fp-card-hd { color: var(--fst-green); }
.fp-card--github .fp-card-hd { color: var(--fst-blue); }
.fp-card--keys .fp-card-hd { color: var(--fst-brand); }
.fp-card--scenario .fp-card-hd { color: var(--fst-purple); }
.fp-card--tips .fp-card-hd { color: var(--fst-cyan); }
.fp-scenario-time { margin-left: auto; font-weight: 400; color: var(--p-text-muted-color); font-size: 11px; }

.fp-card-bd {
  padding: 12px 14px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
}
.fp-card-bd p { margin: 0 0 10px; }
.fp-card-bd--compact { padding: 6px 0; }
.fp-card-note {
  font-size: 11px;
  color: var(--p-text-muted-color);
  opacity: 0.7;
  margin-top: 8px;
}

.fp-steps-list { display: flex; flex-direction: column; gap: 8px; }
.fp-step-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}
.fp-n {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--p-text-color);
  flex-shrink: 0;
}

.fp-key-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
kbd {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-bottom-width: 2px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-color);
  font-family: inherit;
}

.fp-scenario-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: default;
  transition: background 0.15s;
  font-size: 12px;
}
.fp-scenario-row--active {
  background: color-mix(in srgb, var(--fst-purple) 10%, transparent);
  cursor: pointer;
}
.fp-scenario-row--done { opacity: 0.45; cursor: pointer; }
.fp-scenario-row:hover { background: var(--p-surface-ground); cursor: pointer; }

.fp-scenario-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  font-family: monospace;
  min-width: 24px;
}
.fp-scenario-row--active .fp-scenario-num { color: var(--fst-purple); }
.fp-scenario-title { flex: 1; color: var(--p-text-color); }
.fp-scenario-star { color: var(--fst-brand); font-size: 11px; }
.fp-scenario-dur { color: var(--p-text-muted-color); font-size: 11px; }

.fp-tips {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
  line-height: 1.5;
}

/* ═══════════════════════════════════════ AI INSIGHT */
.fp-ai-wrap {
  background: color-mix(in srgb, var(--fst-purple) 8%, var(--p-surface-ground));
  border: 1px solid color-mix(in srgb, var(--fst-purple) 20%, transparent);
  border-left: 3px solid var(--fst-purple);
  border-radius: 12px;
  padding: 16px 20px;
}
.fp-ai-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fst-purple);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp-ai-loading {
  font-weight: 400;
  color: var(--p-text-muted-color);
  text-transform: none;
  letter-spacing: 0;
  animation: fp-blink 1s ease-in-out infinite;
}
@keyframes fp-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.fp-ai-hook {
  font-size: 16px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 14px;
  line-height: 1.4;
}
.fp-ai-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.fp-ai-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  margin-bottom: 5px;
}
.fp-ai-section-text {
  font-size: 13px;
  color: var(--p-text-color);
  line-height: 1.55;
}
.fp-ai-tech {
  font-size: 12px;
  color: var(--fst-cyan);
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--fst-purple) 15%, transparent);
  line-height: 1.5;
}

/* ═══════════════════════════════════════ SESSION ID */
.fp-session-id {
  margin-top: 10px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--p-content-border-color);
}
.fp-session-label { color: var(--p-text-muted-color); }

/* ═══════════════════════════════════════ TRANSITIONS */
.fp-fade-enter-active, .fp-fade-leave-active { transition: opacity 0.25s; }
.fp-fade-enter-from, .fp-fade-leave-to { opacity: 0; }
</style>

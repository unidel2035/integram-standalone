<!-- GrBossCard — игровая карточка регуляторного барьера-босса v2 -->
<template>
  <div ref="cardEl"
       :class="['gr-boss', {
         'gr-boss--defeated': state.defeated,
         'gr-boss--rage':     !state.defeated && state.hpPercent < 25,
         'gr-boss--shake':    isShaking,
       }]"
       :style="{
         borderColor: state.defeated ? '#22c55e44' : boss.color + '88',
         background:  state.defeated ? 'var(--p-surface-card)' : boss.bgGradient,
       }">

    <!-- Конфетти при победе -->
    <div v-if="confettiActive" class="gr-boss-confetti" aria-hidden="true">
      <span v-for="p in confettiPieces" :key="p.id" class="gr-boss-cp"
            :style="{ left: p.left + '%', animationDelay: p.delay + 's', background: p.color, animationDuration: p.dur + 's' }" />
    </div>

    <!-- Плавающие числа урона -->
    <div class="gr-boss-dmg-layer" aria-hidden="true">
      <TransitionGroup name="dmg">
        <div v-for="d in damageNums" :key="d.id" class="gr-boss-dmg-num"
             :style="{ left: d.x + '%', color: boss.color }">
          −{{ d.val }}
        </div>
      </TransitionGroup>
    </div>

    <!-- Шапка -->
    <div class="gr-boss-header">
      <div :class="['gr-boss-emoji', { 'gr-boss-emoji--rage': !state.defeated && state.hpPercent < 25 }]">
        {{ boss.emoji }}
      </div>
      <div class="gr-boss-info">
        <div class="gr-boss-name" :style="{ color: state.defeated ? '#22c55e' : boss.color }">
          {{ boss.name }}
          <span v-if="state.defeated" class="gr-boss-badge gr-boss-badge--dead">ПОВЕРЖЕН ☠️</span>
          <span v-else-if="state.hpPercent < 25" class="gr-boss-badge gr-boss-badge--rage">ЯРОСТЬ!</span>
        </div>
        <div class="gr-boss-subtitle">{{ boss.subtitle }}</div>
      </div>
      <div class="gr-boss-hpnum" :style="{ color: hpColor }">
        {{ state.defeated ? 0 : state.currentHp }}
        <span class="gr-boss-hpmax"> / {{ boss.maxHp }}</span>
      </div>
    </div>

    <!-- HP-бар -->
    <div class="gr-boss-track">
      <div class="gr-boss-bar"
           :style="{ width: state.hpPercent + '%', background: hpColor }" />
      <div v-if="!state.defeated" class="gr-boss-pct" :style="{ color: hpColor }">
        {{ Math.round(state.hpPercent) }}% HP
      </div>
    </div>

    <!-- === ПОБЕДА === -->
    <Transition name="victory">
      <div v-if="state.defeated" class="gr-boss-win">
        <div class="gr-boss-win-text">{{ boss.defeatText }}</div>
        <div class="gr-boss-rewards">
          <span v-for="r in boss.rewards" :key="r" class="gr-boss-reward">🏆 {{ r }}</span>
        </div>
        <div class="gr-boss-win-date">
          Повержен {{ state.defeatTs ? new Date(state.defeatTs).toLocaleDateString('ru-RU') : 'сегодня' }}
        </div>
      </div>
    </Transition>

    <!-- === ПРОГРЕСС АТАК === -->
    <div v-if="!state.defeated" class="gr-boss-attacks">
      <div v-for="atk in boss.attacks" :key="atk.type"
           :class="['gr-boss-atk', { 'gr-boss-atk--done': state.attacksDone.has(atk.type) }]"
           :style="state.attacksDone.has(atk.type) ? { borderLeftColor: boss.color } : {}">
        <div class="gr-boss-atk-icon"
             :style="state.attacksDone.has(atk.type) ? { background: boss.color + '22', color: boss.color } : {}">
          <i :class="state.attacksDone.has(atk.type) ? 'pi pi-check' : atk.icon" />
        </div>
        <div class="gr-boss-atk-label">{{ atk.label }}</div>
        <div class="gr-boss-atk-dmg" :style="{ color: state.attacksDone.has(atk.type) ? boss.color : 'var(--p-text-muted-color)' }">
          <span v-if="state.attacksDone.has(atk.type)" style="font-weight:700">−{{ atk.damage }}</span>
          <span v-else style="opacity:0.45">{{ atk.damage }}⚡</span>
        </div>
      </div>
    </div>

    <!-- === ДОСТУПНЫЕ ХОДЫ (атаки игрока) === -->
    <div v-if="!state.defeated && availableMoves.length" class="gr-boss-moves">
      <div class="gr-boss-moves-title">⚔️ Доступные атаки:</div>
      <div class="gr-boss-moves-list">
        <button v-for="move in availableMoves" :key="move.type + (move.measure?.id || '')"
                class="gr-boss-move-btn"
                :style="{ borderColor: boss.color + '66', color: boss.color }"
                :disabled="move.probability === 'blocked'"
                @click.stop="$emit('attack', move)">
          <i :class="move.eventDef?.icon || 'pi pi-bolt'" style="font-size:11px" />
          {{ move.measure?.name || move.eventDef?.label || move.type }}
          <span class="gr-boss-move-dmg">
            −{{ bossAttackDamage(move.type) }}⚡
          </span>
        </button>
      </div>
    </div>

    <!-- Лор -->
    <div v-if="!state.defeated" class="gr-boss-lore">{{ boss.lore }}</div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { playHit, playCrit, playVictory, playBossSpawn } from '@/services/grSoundEngine.js'

const props = defineProps({
  boss:           { type: Object,  required: true },
  state:          { type: Object,  required: true },
  availableMoves: { type: Array,   default: () => [] },
})
defineEmits(['attack'])

function bossAttackDamage(eventType) {
  return props.boss.attacks.find(a => a.type === eventType)?.damage || '?'
}

const cardEl    = ref(null)
const isShaking = ref(false)
const damageNums = ref([])
const confettiActive = ref(false)

// Конфетти — генерируем 1 раз
const CONFETTI_COLORS = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#fbbf24','#06b6d4']
const confettiPieces = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left:  5 + i * 4.7,
  delay: (i % 5) * 0.12,
  dur:   0.8 + (i % 3) * 0.2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

const hpColor = computed(() => {
  if (props.state.defeated)         return '#22c55e'
  if (props.state.hpPercent < 20)   return '#ef4444'
  if (props.state.hpPercent < 50)   return '#f59e0b'
  return props.boss.color
})

// ─── Следим за изменением HP ──────────────────────────────────────────────────
watch(() => props.state?.currentHp, (newHp, oldHp) => {
  if (oldHp === undefined || oldHp === null) return
  if (newHp < oldHp) {
    const dmg = oldHp - newHp
    spawnDamageNum(dmg)
    shake()
    dmg >= 150 ? playCrit() : playHit(dmg)
  }
  if (newHp === 0 && oldHp > 0) {
    triggerVictory()
  }
})

// ─── Спавн босса ──────────────────────────────────────────────────────────────
onMounted(() => {
  if (!props.state.defeated) playBossSpawn()
})

function spawnDamageNum(val) {
  const id = Date.now() + Math.random()
  damageNums.value.push({ id, val, x: 20 + Math.random() * 60 })
  setTimeout(() => {
    damageNums.value = damageNums.value.filter(d => d.id !== id)
  }, 900)
}

function shake() {
  isShaking.value = true
  setTimeout(() => { isShaking.value = false }, 500)
}

function triggerVictory() {
  playVictory()
  confettiActive.value = true
  setTimeout(() => { confettiActive.value = false }, 3000)
}
</script>

<style scoped>
/* ─── Обёртка ─── */
.gr-boss {
  border: 2px solid;
  border-radius: 14px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.4s, background 0.4s, opacity 0.4s, filter 0.4s;
}

/* Ярость — красное мерцание */
@keyframes rage-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  50%       { box-shadow: 0 0 16px 4px rgba(239,68,68,0.3); }
}
.gr-boss--rage { animation: rage-pulse 1.2s ease infinite; }

/* Повержен — серый, прозрачный */
.gr-boss--defeated { opacity: 0.7; filter: saturate(0.25); }
.gr-boss--defeated:hover { opacity: 1; filter: none; transition: all 0.3s; }

/* Тряска при ударе */
@keyframes boss-shake {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-8px) rotate(-1deg); }
  30%  { transform: translateX(8px) rotate(1deg); }
  45%  { transform: translateX(-5px); }
  60%  { transform: translateX(5px); }
  80%  { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}
.gr-boss--shake { animation: boss-shake 0.45s ease; }

/* ─── Конфетти ─── */
.gr-boss-confetti {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 120px;
  pointer-events: none;
  overflow: hidden;
  z-index: 10;
}
@keyframes confetti-fall {
  0%   { transform: translateY(-10px) rotate(0deg) scale(1);   opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translateY(100px) rotate(540deg) scale(0.5); opacity: 0; }
}
.gr-boss-cp {
  position: absolute;
  top: 0;
  width: 8px; height: 8px;
  border-radius: 2px;
  animation: confetti-fall linear forwards;
}

/* ─── Урон-числа ─── */
.gr-boss-dmg-layer {
  position: absolute;
  top: 10px; left: 0; right: 0;
  height: 80px;
  pointer-events: none;
  z-index: 20;
}
.gr-boss-dmg-num {
  position: absolute;
  font-size: 1.3rem;
  font-weight: 900;
  text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  user-select: none;
}
/* TransitionGroup анимация чисел */
.dmg-enter-active { animation: float-dmg 0.85s cubic-bezier(0.2, 1, 0.4, 1) forwards; }
@keyframes float-dmg {
  0%   { transform: translateY(0) scale(1.4); opacity: 1; }
  40%  { transform: translateY(-30px) scale(1.1); opacity: 1; }
  100% { transform: translateY(-70px) scale(0.7); opacity: 0; }
}

/* ─── Шапка ─── */
.gr-boss-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}
.gr-boss-emoji {
  font-size: 2.4rem;
  line-height: 1;
  flex-shrink: 0;
  transition: transform 0.3s;
}
@keyframes rage-spin {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50%       { transform: scale(1.15) rotate(-8deg); }
}
.gr-boss-emoji--rage { animation: rage-spin 0.8s ease infinite; }

.gr-boss-info { flex: 1; min-width: 0; }
.gr-boss-name {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gr-boss-subtitle {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.gr-boss-hpnum {
  font-size: 1.5rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  transition: color 0.3s;
}
.gr-boss-hpmax { font-size: 9px; opacity: 0.5; font-weight: 400; }

/* ─── Бейджи ─── */
.gr-boss-badge {
  font-size: 9px;
  font-weight: 800;
  border-radius: 6px;
  padding: 2px 6px;
  letter-spacing: 0.05em;
}
.gr-boss-badge--dead { background: #22c55e; color: #fff; }
.gr-boss-badge--rage { background: #ef4444; color: #fff; animation: rage-pulse 0.8s ease infinite; }

/* ─── HP-бар ─── */
.gr-boss-track {
  height: 10px;
  background: var(--p-content-border-color);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 4px;
  position: relative;
}
.gr-boss-bar {
  height: 100%;
  border-radius: 6px;
  min-width: 2px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s;
}
.gr-boss-pct {
  font-size: 9px;
  font-weight: 700;
  text-align: right;
  margin-bottom: 10px;
  opacity: 0.8;
}

/* ─── Победа ─── */
.victory-enter-active { animation: victory-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes victory-pop {
  0%   { transform: scale(0.8); opacity: 0; }
  60%  { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}
.gr-boss-win { padding: 6px 0; }
.gr-boss-win-text {
  font-size: 13px;
  font-weight: 700;
  color: #22c55e;
  margin-bottom: 8px;
  line-height: 1.4;
}
.gr-boss-rewards { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.gr-boss-reward {
  font-size: 10px;
  background: #22c55e18;
  color: #22c55e;
  border: 1px solid #22c55e44;
  border-radius: 8px;
  padding: 2px 8px;
  font-weight: 600;
}
.gr-boss-win-date { font-size: 9px; color: var(--p-text-muted-color); }

/* ─── Атаки ─── */
.gr-boss-attacks {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0 8px;
}
.gr-boss-atk {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid transparent;
  opacity: 0.45;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.gr-boss-atk--done {
  opacity: 1;
  background: transparent;
  border-color: transparent;
}
.gr-boss-atk-icon {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-size: 11px;
  flex-shrink: 0;
  transition: all 0.3s;
}
.gr-boss-atk-label { flex: 1; font-size: 11px; font-weight: 500; }
.gr-boss-atk-dmg   { font-size: 11px; font-variant-numeric: tabular-nums; transition: color 0.3s; }

/* ─── Доступные атаки ─── */
.gr-boss-moves { margin-top: 8px; }
.gr-boss-moves-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.gr-boss-moves-list { display: flex; flex-direction: column; gap: 5px; }
.gr-boss-move-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1.5px solid;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  text-align: left;
  transition: all 0.15s;
}
.gr-boss-move-btn:hover:not(:disabled) {
  filter: brightness(1.15);
  transform: translateX(3px);
  box-shadow: -3px 0 12px rgba(0,0,0,0.15);
}
.gr-boss-move-btn:disabled { opacity: 0.35; cursor: default; }
.gr-boss-move-btn i { flex-shrink: 0; }
.gr-boss-move-dmg {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.75;
  white-space: nowrap;
}

/* ─── Лор ─── */
.gr-boss-lore {
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-style: italic;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 8px;
  line-height: 1.5;
}
</style>

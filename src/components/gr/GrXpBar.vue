<!-- GrXpBar — уровень и XP проекта -->
<template>
  <div class="gr-xp">
    <!-- Уровень -->
    <div class="gr-xp-level" :style="{ background: lvl.color + '22', borderColor: lvl.color + '66' }">
      <span class="gr-xp-lvl-num" :style="{ color: lvl.color }">{{ lvl.level }}</span>
      <span class="gr-xp-lvl-label" :style="{ color: lvl.color }">{{ lvl.label }}</span>
    </div>

    <!-- XP прогресс -->
    <div class="gr-xp-progress">
      <div class="gr-xp-track">
        <div class="gr-xp-fill"
             :style="{ width: lvl.progress + '%', background: lvl.color }" />
      </div>
      <div class="gr-xp-nums">
        <span :style="{ color: lvl.color }">{{ lvl.xp }} XP</span>
        <span style="color:var(--p-text-muted-color)"> / {{ lvl.nextXp }}</span>
      </div>
    </div>

    <!-- Ачивки -->
    <div v-if="achievements.length" class="gr-xp-achivs">
      <span v-for="a in achievements.slice(0, 5)" :key="a.id"
            class="gr-xp-achiv" :title="a.desc">
        {{ a.title.split(' ')[0] }}
      </span>
      <span v-if="achievements.length > 5" class="gr-xp-achiv-more">
        +{{ achievements.length - 5 }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { calcXp, getLevel, checkAchievements, GR_ACHIEVEMENTS } from '@/config/grAchievements.js'

const props = defineProps({
  events: { type: Array, default: () => [] },
})

const lvl          = computed(() => getLevel(calcXp(props.events)))
const achievements = computed(() => GR_ACHIEVEMENTS.filter(a => a.check(props.events)))
</script>

<style scoped>
.gr-xp {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  flex-wrap: wrap;
}
.gr-xp-level {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid;
  border-radius: 8px;
  padding: 3px 10px;
  flex-shrink: 0;
}
.gr-xp-lvl-num {
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1;
}
.gr-xp-lvl-label {
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.gr-xp-progress {
  flex: 1;
  min-width: 80px;
}
.gr-xp-track {
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
}
.gr-xp-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.gr-xp-nums {
  font-size: 9px;
  font-weight: 600;
  text-align: right;
}
.gr-xp-achivs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.gr-xp-achiv {
  font-size: 14px;
  cursor: default;
  line-height: 1;
}
.gr-xp-achiv-more {
  font-size: 9px;
  color: var(--p-text-muted-color);
  font-weight: 600;
  align-self: center;
}
</style>

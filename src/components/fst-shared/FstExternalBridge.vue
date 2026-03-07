<template>
  <!-- Если задан внешний URL found-приложения — показываем iframe -->
  <div v-if="externalUrl" class="fst-bridge">
    <div class="fst-bridge__banner">
      <i class="pi pi-external-link"></i>
      <span>Модуль перенесён на платформу ФСТ.</span>
      <a :href="externalUrl" target="_blank">Открыть напрямую</a>
    </div>
    <iframe
      :src="iframeUrl"
      class="fst-bridge__frame"
      allow="fullscreen"
    />
  </div>

  <!-- Иначе — рендерим локальный контент (оригинальная страница dronedoc2025) -->
  <slot v-else />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** Относительный маршрут внутри found-приложения, например '/fst-committee' */
  route: {
    type: String,
    default: ''
  }
})

// VITE_FST_URL задаётся в .env.local когда found-приложение задеплоено
// Пример: VITE_FST_URL=https://fst.drondoc.ru
const externalUrl = computed(() => import.meta.env.VITE_FST_URL || '')

const iframeUrl = computed(() =>
  externalUrl.value ? `${externalUrl.value}${props.route}` : ''
)
</script>

<style scoped>
.fst-bridge {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.fst-bridge__banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--p-primary-50);
  border-bottom: 1px solid var(--p-primary-200);
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.fst-bridge__banner a {
  color: var(--p-primary-color);
  text-decoration: underline;
  margin-left: auto;
}
.fst-bridge__frame {
  flex: 1;
  width: 100%;
  min-height: calc(100vh - 60px);
  border: none;
}
</style>

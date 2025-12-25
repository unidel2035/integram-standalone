<script setup lang="ts">
</script>

<template>
  <section class="hero-section py-20 px-4 bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-surface-800 dark:to-surface-900">
    <div class="container mx-auto max-w-6xl text-center">
      <h1 class="text-5xl md:text-6xl font-bold text-surface-900 dark:text-surface-100 mb-6">
        ИНТЕГРАМ
      </h1>
      <p class="text-xl md:text-2xl text-surface-700 dark:text-surface-300 mb-8">
        Платформа для интеграции и автоматизации бизнес-процессов
      </p>
      <div class="flex gap-4 justify-center">
        <RouterLink
          to="/register"
          class="bg-gradient-to-r from-primary-600 to-cyan-600 hover:from-primary-700 hover:to-cyan-700 text-white px-8 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl font-semibold"
        >
          Начать бесплатно
        </RouterLink>
        <RouterLink
          to="/login"
          class="bg-white dark:bg-surface-800 border-2 border-primary-600 text-primary-600 dark:text-primary-400 px-8 py-3 rounded-full transition-all duration-300 hover:shadow-lg font-semibold"
        >
          Войти
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

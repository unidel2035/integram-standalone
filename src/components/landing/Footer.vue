<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="py-12 px-4 bg-surface-900 text-surface-100">
    <div class="container mx-auto max-w-6xl">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <!-- Company Info -->
        <div>
          <h3 class="text-xl font-bold mb-4">ИНТЕГРАМ</h3>
          <p class="text-surface-400 text-sm">
            Платформа для интеграции и автоматизации бизнес-процессов
          </p>
        </div>

        <!-- О платформе -->
        <div>
          <h4 class="font-semibold mb-4">О платформе</h4>
          <ul class="space-y-2 text-sm text-surface-400">
            <li><a href="#features" class="hover:text-primary-400 transition-colors">Возможности</a></li>
            <li><a href="#pricing" class="hover:text-primary-400 transition-colors">Тарифы</a></li>
            <li><a href="#cases" class="hover:text-primary-400 transition-colors">Примеры использования</a></li>
          </ul>
        </div>

        <!-- Документация -->
        <div>
          <h4 class="font-semibold mb-4">Документация</h4>
          <ul class="space-y-2 text-sm text-surface-400">
            <li><a href="#docs" class="hover:text-primary-400 transition-colors">Руководство пользователя</a></li>
            <li><a href="#api" class="hover:text-primary-400 transition-colors">API документация</a></li>
            <li><a href="#faq" class="hover:text-primary-400 transition-colors">FAQ</a></li>
          </ul>
        </div>

        <!-- Контакты -->
        <div>
          <h4 class="font-semibold mb-4">Контакты</h4>
          <ul class="space-y-2 text-sm text-surface-400">
            <li><a href="mailto:support@integram.io" class="hover:text-primary-400 transition-colors">support@integram.io</a></li>
            <li><a href="#support" class="hover:text-primary-400 transition-colors">Техподдержка</a></li>
          </ul>
        </div>
      </div>

      <div class="border-t border-surface-800 pt-8 text-center text-sm text-surface-400">
        <p>&copy; {{ currentYear }} ИНТЕГРАМ. Все права защищены.</p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale, availableLocales } = useI18n()

const currentLocale = ref(locale.value)

// Language options with flags
const languages = [
  { code: 'ru', label: 'RU', flag: '🇷🇺', name: 'Русский' },
  { code: 'en', label: 'EN', flag: '🇬🇧', name: 'English' }
]

const changeLanguage = (langCode: string) => {
  locale.value = langCode
  currentLocale.value = langCode
  localStorage.setItem('preferred-language', langCode)
}

onMounted(() => {
  const savedLang = localStorage.getItem('preferred-language')
  if (savedLang && availableLocales.includes(savedLang)) {
    locale.value = savedLang
    currentLocale.value = savedLang
  }
})
</script>

<template>
  <div class="language-switcher">
    <div class="language-buttons">
      <button
        v-for="lang in languages"
        :key="lang.code"
        :class="['language-icon-button', { active: currentLocale === lang.code }]"
        :title="lang.name"
        @click="changeLanguage(lang.code)"
      >
        <span class="flag-icon">{{ lang.flag }}</span>
        <span class="lang-code">{{ lang.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-switcher {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.language-buttons {
  display: flex;
  gap: 0.25rem;
}

.language-icon-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--surface-700);
}

.flag-icon {
  font-size: 1rem;
  line-height: 1;
}

.lang-code {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.language-icon-button:hover {
  background-color: rgba(37, 99, 235, 0.1);
  border-color: var(--primary-600);
}

.language-icon-button.active {
  background: linear-gradient(135deg, var(--primary-600), var(--cyan-600));
  border-color: var(--primary-600);
  color: white;
}

/* Dark mode */
.dark .language-icon-button {
  color: var(--surface-300);
}

.dark .language-icon-button:hover {
  background-color: rgba(59, 130, 246, 0.2);
}

.dark .language-icon-button.active {
  background: linear-gradient(135deg, var(--primary-500), var(--cyan-500));
}
</style>

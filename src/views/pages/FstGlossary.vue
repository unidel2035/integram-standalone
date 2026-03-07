<template>
  <div class="fst-glossary-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <i class="pi pi-book" style="font-size: 2rem; color: var(--p-primary-color);"></i>
          <div>
            <h1>📚 Глоссарий венчурных терминов</h1>
            <p class="subtitle">Интерактивный справочник с AI-объяснениями для начинающих инвесторов</p>
          </div>
        </div>
        <div class="header-actions">
          <Button
            label="Калькулятор метрик"
            icon="pi pi-calculator"
            @click="calculatorVisible = true"
            outlined
            severity="primary"
          />
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <Card class="search-card">
      <template #content>
        <div class="search-section">
          <IconField iconPosition="left" class="search-input-wrapper">
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText
              v-model="searchQuery"
              placeholder="Поиск терминов по названию или описанию..."
              class="w-full"
            />
          </IconField>

          <div class="category-filters">
            <Button
              v-for="category in categories"
              :key="category.id"
              :label="category.label"
              :icon="`pi ${category.icon}`"
              :severity="selectedCategory === category.id ? 'primary' : 'secondary'"
              :outlined="selectedCategory !== category.id"
              @click="toggleCategory(category.id)"
              size="small"
            />
            <Button
              v-if="selectedCategory"
              label="Все термины"
              icon="pi pi-times"
              severity="secondary"
              outlined
              @click="selectedCategory = null"
              size="small"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Stats -->
    <div class="stats-grid">
      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-book"></i>
            <span>Всего терминов</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ totalTerms }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-chart-line"></i>
            <span>Финансовые</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ categoryCounts.financial || 0 }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-briefcase"></i>
            <span>Венчурные</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ categoryCounts.venture || 0 }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-sparkles"></i>
            <span>AI & Технологии</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ categoryCounts.ai || 0 }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-shield"></i>
            <span>Регулирование</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ categoryCounts.regulation || 0 }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-cog"></i>
            <i class="pi pi-desktop"></i>
            <span>Платформа</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ categoryCounts.platform || 0 }}</div>
        </template>
      </Card>
    </div>

    <!-- Terms Grid -->
    <div class="terms-grid">
      <Card
        v-for="term in filteredTerms"
        :key="term.id"
        class="term-card"
        @click="openTermModal(term.id)"
      >
        <template #header>
          <div class="term-card-header">
            <Chip :label="getCategoryLabel(term.category)" :icon="`pi ${getCategoryIcon(term.category)}`" size="small" />
          </div>
        </template>
        <template #title>
          <div class="term-card-title">
            {{ term.title }}
          </div>
        </template>
        <template #content>
          <p class="term-card-description">
            {{ term.definition.slice(0, 120) }}{{ term.definition.length > 120 ? '...' : '' }}
          </p>
        </template>
        <template #footer>
          <div class="term-card-footer">
            <span class="related-count" v-if="term.relatedTerms && term.relatedTerms.length > 0">
              <i class="pi pi-link"></i>
              {{ term.relatedTerms.length }} связанных
            </span>
            <Button
              label="Подробнее"
              icon="pi pi-arrow-right"
              text
              size="small"
            />
          </div>
        </template>
      </Card>
    </div>

    <!-- Empty state -->
    <Card v-if="filteredTerms.length === 0" class="empty-state">
      <template #content>
        <div class="text-center">
          <i class="pi pi-search" style="font-size: 3rem; color: var(--p-text-muted-color);"></i>
          <h3>Термины не найдены</h3>
          <p>Попробуйте изменить поисковый запрос или фильтры</p>
        </div>
      </template>
    </Card>

    <!-- Term Modal -->
    <TermModal
      v-model:visible="modalVisible"
      :termId="selectedTermId"
      @navigate="navigateToTerm"
    />

    <!-- Financial Calculator -->
    <FinancialCalculator v-model:visible="calculatorVisible" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Chip from 'primevue/chip'
import TermModal from '@/components/TermModal.vue'
import FinancialCalculator from '@/components/FinancialCalculator.vue'
import { glossaryTerms, searchTerms, getCategories, getTermsByCategory } from '@/data/glossary'

const searchQuery = ref('')
const selectedCategory = ref(null)
const modalVisible = ref(false)
const selectedTermId = ref(null)
const calculatorVisible = ref(false)

const categories = getCategories()

const allTerms = computed(() => Object.values(glossaryTerms))

const totalTerms = computed(() => allTerms.value.length)

const categoryCounts = computed(() => {
  const counts = {}
  allTerms.value.forEach(term => {
    counts[term.category] = (counts[term.category] || 0) + 1
  })
  return counts
})

const filteredTerms = computed(() => {
  let terms = allTerms.value

  // Filter by category
  if (selectedCategory.value) {
    terms = getTermsByCategory(selectedCategory.value)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    terms = searchTerms(searchQuery.value)
    // If category is also selected, intersect the results
    if (selectedCategory.value) {
      const categoryTermIds = getTermsByCategory(selectedCategory.value).map(t => t.id)
      terms = terms.filter(t => categoryTermIds.includes(t.id))
    }
  }

  // Sort alphabetically by title
  return terms.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
})

const toggleCategory = (categoryId) => {
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = null
  } else {
    selectedCategory.value = categoryId
  }
}

const getCategoryLabel = (category) => {
  const cat = categories.find(c => c.id === category)
  return cat?.label || category
}

const getCategoryIcon = (category) => {
  const cat = categories.find(c => c.id === category)
  return cat?.icon || 'pi-book'
}

const openTermModal = (termId) => {
  selectedTermId.value = termId
  modalVisible.value = true
}

const navigateToTerm = (termId) => {
  selectedTermId.value = termId
  // Modal stays open, just changes the term
}

onMounted(() => {
  // Set page title
  document.title = 'Глоссарий венчурных терминов | ФСТ НТИ'
})
</script>

<style scoped>
.fst-glossary-page {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-section h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--p-text-color);
}

.subtitle {
  margin: 0.5rem 0 0 0;
  color: var(--p-text-muted-color);
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-card {
  margin-bottom: 2rem;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-input-wrapper {
  width: 100%;
}

.category-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  text-align: center;
}

.stat-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-top: 0.5rem;
}

.terms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.term-card {
  cursor: pointer;
  transition: all 0.2s ease;
  height: 100%;
}

.term-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.term-card-header {
  padding: 1rem 1rem 0;
}

.term-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
}

.term-card-description {
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 0;
}

.term-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.related-count {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-state h3 {
  margin-top: 1rem;
  color: var(--p-text-color);
}

.empty-state p {
  color: var(--p-text-muted-color);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .terms-grid {
    grid-template-columns: 1fr;
  }

  .title-section h1 {
    font-size: 1.5rem;
  }

  .stat-value {
    font-size: 2rem;
  }
}
</style>

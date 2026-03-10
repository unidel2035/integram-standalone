<template>
  <FstPageLayout>
    <template #header>
      <div class="gl-title-group">
        <span class="gl-live-dot" />
        <span class="gl-title">Глоссарий</span>
        <span class="gl-sep">·</span>
        <span class="gl-sub">термины венчурного инвестирования и технологий</span>
      </div>
    </template>

    <template #actions>
      <Button label="Калькулятор метрик" icon="pi pi-calculator" size="small" severity="secondary" @click="calculatorVisible = true" />
    </template>

    <!-- Metrics strip -->
    <div class="gl-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-book fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ totalTerms }}</div>
        <div class="fst-metric-item-label">Всего терминов</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-line fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ categoryCounts.financial || 0 }}</div>
        <div class="fst-metric-item-label">Финансовые</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-briefcase fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ categoryCounts.venture || 0 }}</div>
        <div class="fst-metric-item-label">Венчурные</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-sparkles fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ categoryCounts.ai || 0 }}</div>
        <div class="fst-metric-item-label">AI & Технологии</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-shield fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ categoryCounts.regulation || 0 }}</div>
        <div class="fst-metric-item-label">Регулирование</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-desktop fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ categoryCounts.platform || 0 }}</div>
        <div class="fst-metric-item-label">Платформа</div>
      </div>
    </div>

    <div class="gl-content">

    <!-- Search and Filters -->
    <div class="gl-search-card">
      <IconField iconPosition="left" class="gl-search-input">
        <InputIcon><i class="pi pi-search" /></InputIcon>
        <InputText v-model="searchQuery" placeholder="Поиск терминов по названию или описанию..." fluid />
      </IconField>
      <div class="gl-category-filters">
        <Button
          v-for="category in categories"
          :key="category.id"
          :label="category.label"
          :icon="`pi ${category.icon}`"
          :severity="selectedCategory === category.id ? 'primary' : 'secondary'"
          :outlined="selectedCategory !== category.id"
          size="small"
          @click="toggleCategory(category.id)"
        />
        <Button v-if="selectedCategory" label="Сбросить" icon="pi pi-times" severity="secondary" outlined size="small" @click="selectedCategory = null" />
      </div>
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
    <div v-if="filteredTerms.length === 0" class="gl-empty">
      <i class="pi pi-search" style="font-size: 3rem; color: var(--p-text-muted-color);"></i>
      <div class="gl-empty-title">Термины не найдены</div>
      <p style="color: var(--p-text-muted-color); margin: 0">Попробуйте изменить поисковый запрос или фильтры</p>
    </div>

    </div><!-- /gl-content -->

    <!-- Term Modal -->
    <TermModal
      v-model:visible="modalVisible"
      :termId="selectedTermId"
      @navigate="navigateToTerm"
    />

    <!-- Financial Calculator -->
    <FinancialCalculator v-model:visible="calculatorVisible" />
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
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
/* ── Header ── */
.gl-title-group { display: flex; align-items: center; gap: 8px; }
.gl-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--p-primary-color); flex-shrink: 0; animation: gl-pulse 2s infinite; }
@keyframes gl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.gl-title { font-size: 14px; font-weight: 600; color: var(--p-text-color); }
.gl-sep { color: var(--p-text-muted-color); }
.gl-sub { font-size: 0.82rem; color: var(--p-text-muted-color); font-weight: 400; }

/* ── Metrics flush ── */
.gl-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }

/* ── Content wrapper ── */
.gl-content { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }

/* ── Search card ── */
.gl-search-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gl-search-input { width: 100%; }
.gl-category-filters { display: flex; flex-wrap: wrap; gap: 6px; }

/* ── Terms grid ── */
.terms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.term-card { cursor: pointer; transition: border-color 0.15s; }
.term-card:hover { border-color: var(--p-primary-color); }

.term-card-header { padding: 12px 14px 0; }
.term-card-title { font-size: 0.95rem; font-weight: 600; color: var(--p-text-color); margin-bottom: 6px; }
.term-card-description { color: var(--p-text-muted-color); line-height: 1.5; margin: 0; font-size: 0.82rem; }
.term-card-footer { display: flex; justify-content: space-between; align-items: center; }
.related-count { font-size: 0.78rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; }

/* ── Empty state ── */
.gl-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 40px;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 12px;
  text-align: center;
}
.gl-empty-title { font-weight: 600; font-size: 0.95rem; color: var(--p-text-color); }

@media (max-width: 768px) {
  .terms-grid { grid-template-columns: 1fr; }
}
</style>

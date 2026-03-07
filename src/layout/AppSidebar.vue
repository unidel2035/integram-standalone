<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLayout } from './composables/layout'
import AppMenu from './AppMenu.vue'
import SmartSearchResults from '@/components/SmartSearchResults.vue'
import ToursMenuDialog from '@/components/ToursMenuDialog.vue'
import { debouncedSmartSearch } from '@/services/smartSearchService'
import { logger } from '@/utils/logger'
import LogoDisplay from '@/components/LogoDisplay.vue'

const route = useRoute()
const { layoutState, toggleSidebarCollapse } = useLayout()

const isBlockEditorRoute = computed(() => false)
const isIntegramRoute = computed(() => false)
const isOntologyRoute = computed(() => false)
const isDronomicsRoute = computed(() => false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const searchResults = ref(null)
const searchLoading = ref(false)
const menuModel = ref([])
const toursDialogVisible = ref(false)

const handleKeyDown = (e) => {
  // "/" to focus on search (like GitHub, YouTube)
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Don't trigger if already in an input, textarea, or contenteditable element
    const activeElement = document.activeElement
    const isInInput = activeElement?.tagName === 'INPUT'
    const isInTextarea = activeElement?.tagName === 'TEXTAREA'
    const isContentEditable = activeElement?.isContentEditable || activeElement?.hasAttribute('contenteditable')
    const isInQuillEditor = activeElement?.classList?.contains('ql-editor') || activeElement?.closest('.ql-editor')

    if (!isInInput && !isInTextarea && !isContentEditable && !isInQuillEditor) {
      e.preventDefault()
      searchInputRef.value?.$el?.focus()
    }
  }

  // Esc to clear search
  if (e.key === 'Escape') {
    if (searchQuery.value) {
      searchQuery.value = ''
    }
  }

  // Arrow down to focus on first extra result (after menu)
  if (e.key === 'ArrowDown' && searchQuery.value && hasExtraResults.value) {
    e.preventDefault()
    const firstExtraResult = document.querySelector('.search-item')
    if (firstExtraResult) {
      firstExtraResult.focus()
    }
  }
}

// Perform smart search when query changes (for extra results only)
// flush: 'post' ensures DOM updates before search runs (prevents input lag)
watch(searchQuery, (newQuery) => {
  if (!newQuery || newQuery.trim() === '') {
    searchResults.value = null
    searchLoading.value = false
    return
  }

  // Delay loading indicator to avoid flicker on fast typing
  searchLoading.value = true

  // Call debounced search with callback (non-blocking)
  debouncedSmartSearch(
    newQuery,
    menuModel.value,
    {
      maxRoutesResults: 10,
      maxAgentsResults: 5,
      maxIntegramResults: 10
    },
    (results) => {
      // Callback executed after debounce delay
      searchResults.value = results
      searchLoading.value = false
      logger.debug('Smart search results:', results)
    }
  )
}, { flush: 'post' })

// Clear search query when route changes
watch(() => route.path, () => {
  searchQuery.value = ''
})

// Clear search query when sidebar is expanded
watch(() => layoutState.sidebarCollapsed, (newVal, oldVal) => {
  // Clear search when sidebar is expanded (collapsed changes from true to false)
  if (oldVal === true && newVal === false) {
    searchQuery.value = ''
  }
}, { flush: 'post' })

const handleNavigate = () => {
  searchQuery.value = ''
}

// Check if there are extra search results (routes, agents, Integram, AI) to show
const hasExtraResults = computed(() => {
  if (!searchResults.value) return false
  return (
    searchResults.value.routes.length > 0 ||
    searchResults.value.agents.length > 0 ||
    (searchResults.value.documents && searchResults.value.documents.length > 0) ||
    searchResults.value.integramResults.length > 0 ||
    searchResults.value.aiResults.length > 0
  )
})

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  // Clear search query on mount to ensure clean state
  searchQuery.value = ''
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

const showToursMenu = () => {
  toursDialogVisible.value = true
}
</script>

<template>
    <div class="layout-sidebar" :class="{ 'sidebar-collapsed': layoutState.sidebarCollapsed }">
        <!-- Sticky header with toggle button only (logo removed) -->
        <div class="sidebar-header">
            <Button
                :icon="layoutState.sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
                @click="toggleSidebarCollapse"
                class="p-button-text p-button-rounded sidebar-toggle-btn"
                v-tooltip.right="layoutState.sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
                aria-label="Переключить меню"
            />
        </div>

        <!-- Sticky search input -->
        <div class="sidebar-search p-3">
            <IconField iconPosition="left">
                <InputIcon class="pi pi-search" aria-hidden="true" />
                <InputText
                    ref="searchInputRef"
                    v-model="searchQuery"
                    placeholder="Поиск..."
                    class="w-full"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    role="searchbox"
                    aria-label="Поиск по меню и страницам"
                    aria-controls="smart-search-extras"
                />
            </IconField>
        </div>

        <!-- Scrollable content area -->
        <div class="sidebar-scrollable-content">
            <!-- Quick-access icons (collapsed only) -->
            <div v-if="layoutState.sidebarCollapsed" class="collapsed-quick-links">
                <router-link
                    to="/block-editor"
                    class="collapsed-quick-link"
                    :class="{ 'active': isBlockEditorRoute }"
                    v-tooltip.right="'Редактор документов'"
                >
                    <i class="pi pi-fw pi-file-edit"></i>
                </router-link>
                <router-link
                    to="/integram"
                    class="collapsed-quick-link"
                    :class="{ 'active': isIntegramRoute }"
                    v-tooltip.right="'Integram'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M 2,5 L 16,12 L 2,19 Z"/>
                        <path d="M 22,5 L 8,12 L 22,19 Z"/>
                    </svg>
                </router-link>
                <router-link
                    to="/onto"
                    class="collapsed-quick-link"
                    :class="{ 'active': isOntologyRoute }"
                    v-tooltip.right="'Онтологии'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="4" r="2"/>
                        <circle cx="6" cy="12" r="2"/>
                        <circle cx="18" cy="12" r="2"/>
                        <circle cx="4" cy="20" r="2"/>
                        <circle cx="12" cy="20" r="2"/>
                        <line x1="12" y1="6" x2="6" y2="10"/>
                        <line x1="12" y1="6" x2="18" y2="10"/>
                        <line x1="6" y1="14" x2="4" y2="18"/>
                        <line x1="6" y1="14" x2="12" y2="18"/>
                    </svg>
                </router-link>
                <router-link
                    to="/drononomics"
                    class="collapsed-quick-link"
                    :class="{ 'active': isDronomicsRoute }"
                    v-tooltip.right="'Дронономика'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="6" r="2"/>
                        <path d="M6 4l4 2m4 0l4-2"/>
                        <path d="M6 8l4-2m4 0l4 2"/>
                        <polyline points="4 20 8 16 12 18 16 14 20 17"/>
                    </svg>
                </router-link>
                <div class="collapsed-quick-divider"></div>
            </div>

            <!-- Menu (ALWAYS visible, filtered by search query) -->
            <div>
                <app-menu
                    :search-query="searchQuery"
                    :collapsed="layoutState.sidebarCollapsed"
                    @menu-loaded="menuModel = $event"
                />
            </div>

            <!-- Tours menu button -->
            <div v-if="!layoutState.sidebarCollapsed" class="tours-menu-button-wrapper">
                <Button
                    label="Интерактивные туры"
                    icon="pi pi-map"
                    @click="showToursMenu"
                    class="w-full tours-button"
                    outlined
                />
            </div>

            <!-- Smart Search Extras (routes, agents, Integram) - shown BELOW menu -->
            <div
                v-if="hasExtraResults && !layoutState.sidebarCollapsed"
                id="smart-search-extras"
                class="smart-search-extras"
            >
                <SmartSearchResults
                    :results="searchResults"
                    :query="searchQuery"
                    :loading="searchLoading"
                    @navigate="handleNavigate"
                />
            </div>
        </div>

        <!-- Tours Dialog -->
        <ToursMenuDialog v-model:visible="toursDialogVisible" />
    </div>
</template>

<style lang="scss" scoped>
.layout-sidebar {
    // Remove overflow from parent - we'll handle it in child
    display: flex;
    flex-direction: column;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: width;
}

.sidebar-header {
    // Sticky header - stays at top (Issue #6934: now includes logo)
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background-color: var(--surface-overlay);
    z-index: 1;
    min-height: 48px;
    gap: 0.5rem;
}

.sidebar-logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    transition: opacity 0.2s;

    &:hover {
        opacity: 0.8;
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
        border-radius: 4px;
    }
}

.sidebar-logo-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: opacity 0.2s;

    &:hover {
        opacity: 0.8;
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
        border-radius: 4px;
    }
}

.sidebar-toggle-btn {
    flex-shrink: 0;
}

.sidebar-search {
    // Sticky search - stays below header
    flex-shrink: 0;
    position: relative;
    transition: opacity 0.2s ease;
    opacity: 1;
    background-color: var(--surface-overlay);
    z-index: 1;
}

.sidebar-scrollable-content {
    // Scrollable content area - only this part scrolls
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    // Smooth scrolling
    scroll-behavior: smooth;
    // Custom scrollbar styling
    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--surface-border);
        border-radius: 3px;
        &:hover {
            background: var(--surface-400);
        }
    }
}

.layout-sidebar.sidebar-collapsed {
    width: 5rem !important;

    .sidebar-header {
        flex-direction: column;
        justify-content: center;
        padding: 0.5rem;
        gap: 0.25rem;
    }

    .sidebar-search {
        opacity: 0;
        pointer-events: none;
    }
}

/* Collapsed quick-access links (Documents + Integram) */
.collapsed-quick-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem 0.5rem 0;
    gap: 0.1rem;
}

.collapsed-quick-link {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.75rem 0.5rem;
    border-radius: var(--content-border-radius);
    color: var(--text-color);
    text-decoration: none;
    transition: background-color var(--element-transition-duration);
    cursor: pointer;

    i {
        font-size: 1.5rem;
    }

    svg {
        width: 1.5rem;
        height: 1.5rem;
    }

    &:hover {
        background-color: var(--surface-hover);
    }

    &.active,
    &.router-link-active {
        background-color: var(--p-highlight-background);
        color: var(--p-highlight-color);
    }
}

.collapsed-quick-divider {
    width: 60%;
    height: 1px;
    background: var(--surface-border);
    margin: 0.25rem 0;
}

/* Smart search extras - shown BELOW menu */
.smart-search-extras {
    padding: 0.5rem 1rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--surface-border);
    animation: fadeInUp 0.15s ease-out;
}

/* Fast fade-in animation */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Tours menu button */
.tours-menu-button-wrapper {
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--surface-border);
}

.tours-button {
    font-size: 0.9rem;
}
</style>

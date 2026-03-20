<template>
  <div class="integram-request-list">
    <!-- Breadcrumb -->
    <IntegramBreadcrumb :items="breadcrumbItems" />

    <!-- Metadata Loading Indicator (above Card) -->
    <div v-if="metadataLoading && loadMetadataEnabled" class="metadata-loading-notification mb-3">
      <div class="flex align-items-center justify-content-between">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-spin pi-spinner text-primary"></i>
          <span class="font-medium">Загрузка метаданных...</span>
          <Badge :value="`${loadedMetadataCount} / ${requests.length}`" severity="secondary" />
        </div>
        <Button
          icon="pi pi-times"
          size="small"
          text
          rounded
          severity="secondary"
          @click="cancelMetadataLoading"
          v-tooltip.top="'Остановить загрузку'"
        />
      </div>
    </div>

    <!-- Main Card -->
    <Card>
      <template #title>
        <div class="flex align-items-center justify-content-between">
          <div class="flex align-items-center gap-2">
            <span>Отчёты</span>
            <Badge v-if="requests.length" :value="requests.length" severity="secondary" />
          </div>
          <div class="flex gap-2 align-items-center ml-auto">
            <Button
              icon="pi pi-plus"
              label="Создать"
              size="small"
              @click="createRequest"
              v-tooltip.bottom="'Создать новый отчёт'"
              data-testid="create-report-button"
            />

            <Button
              icon="pi pi-cog"
              size="small"
              outlined
              @click="showSettingsDialog = true"
              v-tooltip.bottom="'Настройки отображения'"
            />

            <Button
              icon="pi pi-refresh"
              size="small"
              outlined
              @click="loadRequests"
              v-tooltip.bottom="'Обновить'"
              :loading="loading"
            />
          </div>
        </div>
      </template>

      <template #content>
        <!-- Toolbar: Search, Filters, View Mode, Sort -->
        <div class="toolbar-section mb-3">
          <div class="flex align-items-center justify-content-between flex-wrap gap-3">
            <!-- Search -->
            <IconField iconPosition="left" class="flex-grow-1" style="max-width: 400px">
              <InputIcon class="pi pi-search" />
              <InputText
                ref="searchInput"
                v-model="searchQuery"
                placeholder="Поиск по названию, ID..."
                class="w-full"
                @keydown="handleSearchKeydown"
              />
            </IconField>

            <!-- Filters + View Mode + Sort -->
            <div class="flex align-items-center gap-2 flex-wrap">
              <!-- Filter Chips -->
              <div class="flex align-items-center gap-2">
                <Chip
                  :class="{ 'chip-active': activeFilter === 'all' }"
                  label="Все"
                  @click="activeFilter = 'all'"
                  class="cursor-pointer"
                />
                <Chip
                  :class="{ 'chip-active': activeFilter === 'favorites' }"
                  @click="activeFilter = 'favorites'"
                  class="cursor-pointer"
                >
                  <i class="pi pi-star-fill mr-1"></i>
                  Избранные
                </Chip>
                <Chip
                  v-if="loadMetadataEnabled"
                  :class="{ 'chip-active': activeFilter === 'empty' }"
                  @click="activeFilter = 'empty'"
                  class="cursor-pointer"
                >
                  <i class="pi pi-inbox mr-1"></i>
                  Пустые
                </Chip>
                <Chip
                  v-if="loadMetadataEnabled"
                  :class="{ 'chip-active': activeFilter === 'filled' }"
                  @click="activeFilter = 'filled'"
                  class="cursor-pointer"
                >
                  <i class="pi pi-check-circle mr-1"></i>
                  С данными
                </Chip>
              </div>

              <!-- Sort Dropdown -->
              <Dropdown
                v-model="sortBy"
                :options="sortOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Сортировка"
                class="w-10rem"
              />

              <!-- View Mode Toggle -->
              <SelectButton
                v-model="viewMode"
                :options="viewOptions"
                optionLabel="icon"
                optionValue="value"
                :allowEmpty="false"
              >
                <template #option="{ option }">
                  <i :class="option.icon" v-tooltip.top="option.label"></i>
                </template>
              </SelectButton>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-content-center py-5">
          <ProgressSpinner />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-5">
          <Message severity="error" :closable="false">{{ error }}</Message>
        </div>

        <!-- Content (requests + pagination) -->
        <div v-else>
          <!-- View Mode Transition Loading -->
          <div v-if="viewModeTransitioning" class="flex justify-content-center align-items-center py-5">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
            <span class="ml-3 text-500">Переключение режима...</span>
          </div>

          <div v-else>
            <!-- Pagination Info -->
            <div v-if="paginationEnabled" class="flex align-items-center justify-content-between mb-3">
              <div class="text-sm text-500">
                Показано {{ paginatedRequests.length }} из {{ filteredRequests.length }} отчётов
              </div>
              <Paginator
                v-if="totalPages > 1"
                v-model:first="first"
                :rows="pageSize"
                :totalRecords="filteredRequests.length"
                :rowsPerPageOptions="[20, 50, 100]"
                @page="onPageChange"
              />
            </div>

            <!-- Grid View -->
            <div v-if="viewMode === 'grid'" class="grid">
              <div
                v-for="(request, index) in paginatedRequests"
                :key="request.id"
                class="col-12 sm:col-6 md:col-4 lg:col-3"
              >
                <Card
                  class="request-card h-full cursor-pointer"
                  :class="{ 'request-card-active': activeRequestIndex === index }"
                  @click="navigateToRequest(request.id)"
                  @contextmenu="onRequestContextMenu($event, request)"
                >
                  <template #header>
                    <div class="card-header-actions">
                      <Button
                        :icon="isFavorite(request.id) ? 'pi pi-star-fill' : 'pi pi-star'"
                        :class="{ 'favorite-active': isFavorite(request.id) }"
                        text
                        rounded
                        size="small"
                        @click.stop="toggleFavorite(request.id)"
                        v-tooltip.top="'Добавить в избранное'"
                      />
                      <Button
                        icon="pi pi-ellipsis-v"
                        text
                        rounded
                        size="small"
                        @click.stop="onRequestContextMenu($event, request)"
                        v-tooltip.top="'Меню'"
                      />
                    </div>
                  </template>

                  <template #title>
                    <div class="request-card-title">
                      {{ request.val || `Отчёт #${request.id}` }}
                    </div>
                  </template>

                  <template #subtitle>
                    <div class="request-card-subtitle">
                      ID: {{ request.id }}
                    </div>
                  </template>

                  <template #content>
                    <div class="request-stats">
                      <div v-if="loadMetadataEnabled && request.metadata" class="flex justify-content-between text-sm">
                        <span class="text-500">Строк:</span>
                        <span class="font-medium">{{ request.metadata.rowCount || 0 }}</span>
                      </div>
                      <div v-if="loadMetadataEnabled && request.metadata" class="flex justify-content-between text-sm">
                        <span class="text-500">Колонок:</span>
                        <span class="font-medium">{{ request.metadata.columnCount || 0 }}</span>
                      </div>
                      <div class="flex justify-content-between text-sm">
                        <span class="text-500">Создан:</span>
                        <span class="font-medium">{{ formatDate(request.created_at) }}</span>
                      </div>
                    </div>
                  </template>

                  <template #footer>
                    <div class="flex gap-2">
                      <Button
                        label="Открыть"
                        icon="pi pi-eye"
                        size="small"
                        class="flex-1"
                        @click.stop="navigateToRequest(request.id)"
                      />
                      <Button
                        icon="pi pi-play"
                        size="small"
                        outlined
                        @click.stop="executeRequest(request.id)"
                        v-tooltip.top="'Выполнить отчёт'"
                      />
                    </div>
                  </template>
                </Card>
              </div>
            </div>

            <!-- Table View -->
            <div v-else-if="viewMode === 'table'">
              <DataTable
                :value="paginatedRequests"
                stripedRows
                showGridlines
                @row-click="onRowClick"
                @row-contextmenu="onRowContextMenu"
                class="request-table"
              >
                <Column field="ord" header="N" style="width: 60px; text-align: center" headerStyle="text-align: center">
                  <template #body="slotProps">
                    <span class="text-color-secondary text-sm">{{ slotProps.index + 1 }}</span>
                  </template>
                </Column>

                <Column field="id" header="ID" sortable style="width: 100px"></Column>

                <Column field="val" header="Название" sortable>
                  <template #body="slotProps">
                    <div class="flex align-items-center gap-2">
                      <i
                        v-if="isFavorite(slotProps.data.id)"
                        class="pi pi-star-fill text-yellow-500"
                        style="font-size: 0.8rem"
                      ></i>
                      <span class="font-medium">{{ slotProps.data.val || `Отчёт #${slotProps.data.id}` }}</span>
                    </div>
                  </template>
                </Column>

                <Column v-if="loadMetadataEnabled" header="Строк" style="width: 100px; text-align: center">
                  <template #body="slotProps">
                    <span v-if="slotProps.data.metadata">{{ slotProps.data.metadata.rowCount || 0 }}</span>
                    <span v-else class="text-color-secondary">—</span>
                  </template>
                </Column>

                <Column v-if="loadMetadataEnabled" header="Колонок" style="width: 100px; text-align: center">
                  <template #body="slotProps">
                    <span v-if="slotProps.data.metadata">{{ slotProps.data.metadata.columnCount || 0 }}</span>
                    <span v-else class="text-color-secondary">—</span>
                  </template>
                </Column>

                <Column field="created_at" header="Создан" sortable style="width: 180px">
                  <template #body="slotProps">
                    {{ formatDate(slotProps.data.created_at) }}
                  </template>
                </Column>

                <Column header="Действия" style="width: 200px">
                  <template #body="slotProps">
                    <div class="flex gap-2">
                      <Button
                        icon="pi pi-eye"
                        size="small"
                        outlined
                        @click.stop="navigateToRequest(slotProps.data.id)"
                        v-tooltip.top="'Открыть'"
                      />
                      <Button
                        icon="pi pi-play"
                        size="small"
                        outlined
                        @click.stop="executeRequest(slotProps.data.id)"
                        v-tooltip.top="'Выполнить'"
                      />
                      <Button
                        icon="pi pi-pencil"
                        size="small"
                        outlined
                        @click.stop="editRequest(slotProps.data.id)"
                        v-tooltip.top="'Редактировать'"
                      />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>

            <!-- List View -->
            <div v-else-if="viewMode === 'list'" class="list-view">
              <div
                v-for="request in paginatedRequests"
                :key="request.id"
                class="list-item p-3 border-bottom-1 surface-border cursor-pointer hover:surface-hover"
                @click="navigateToRequest(request.id)"
                @contextmenu="onRequestContextMenu($event, request)"
              >
                <div class="flex align-items-center justify-content-between">
                  <div class="flex align-items-center gap-3 flex-1">
                    <i
                      v-if="isFavorite(request.id)"
                      class="pi pi-star-fill text-yellow-500"
                    ></i>
                    <div class="flex-1">
                      <div class="font-medium">{{ request.val || `Отчёт #${request.id}` }}</div>
                      <div class="text-sm text-color-secondary">ID: {{ request.id }}</div>
                    </div>
                    <div v-if="loadMetadataEnabled && request.metadata" class="flex gap-4 text-sm text-color-secondary">
                      <span>Строк: {{ request.metadata.rowCount || 0 }}</span>
                      <span>Колонок: {{ request.metadata.columnCount || 0 }}</span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <Button
                      icon="pi pi-eye"
                      size="small"
                      text
                      @click.stop="navigateToRequest(request.id)"
                    />
                    <Button
                      icon="pi pi-play"
                      size="small"
                      text
                      @click.stop="executeRequest(request.id)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="filteredRequests.length === 0" class="text-center py-5">
              <i class="pi pi-inbox text-6xl text-400 mb-3"></i>
              <p class="text-xl text-500">Отчёты не найдены</p>
              <p class="text-sm text-500 mt-2">Создайте новый отчёт или измените фильтры поиска</p>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Context Menu -->
    <ContextMenu ref="contextMenu" :model="contextMenuItems" />

    <!-- Settings Dialog -->
    <Dialog
      v-model:visible="showSettingsDialog"
      header="Настройки отображения"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex flex-column gap-3">
        <div class="field-checkbox">
          <Checkbox v-model="loadMetadataEnabled" inputId="loadMetadata" :binary="true" />
          <label for="loadMetadata" class="ml-2">Загружать метаданные отчётов</label>
        </div>
        <div class="field-checkbox">
          <Checkbox v-model="paginationEnabled" inputId="pagination" :binary="true" />
          <label for="pagination" class="ml-2">Включить пагинацию</label>
        </div>
        <div class="field">
          <label for="pageSize">Элементов на странице</label>
          <InputNumber
            v-model="pageSize"
            inputId="pageSize"
            :min="10"
            :max="100"
            :step="10"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Закрыть" @click="showSettingsDialog = false" autofocus />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import integramService from '@/services/integramApiClient'
import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Refs
const searchInput = ref(null)
const contextMenu = ref(null)

// State
const requests = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const activeFilter = ref('all')
const sortBy = ref('name')
const viewMode = ref('grid')
const showSettingsDialog = ref(false)
const loadMetadataEnabled = ref(false)
const paginationEnabled = ref(true)
const pageSize = ref(20)
const first = ref(0)
const metadataLoading = ref(false)
const loadedMetadataCount = ref(0)
const viewModeTransitioning = ref(false)
const activeRequestIndex = ref(-1)
const selectedRequest = ref(null)
const favorites = ref([])

// Computed
const database = computed(() => route.params.database || 'my')

const breadcrumbItems = computed(() => [
  {
    label: 'Отчёты',
    to: `/integram/${database.value}/requests`
  }
])

const sortOptions = [
  { label: 'По названию', value: 'name' },
  { label: 'По ID', value: 'id' },
  { label: 'По дате создания', value: 'created' }
]

const viewOptions = [
  { label: 'Сетка', value: 'grid', icon: 'pi pi-th-large' },
  { label: 'Таблица', value: 'table', icon: 'pi pi-table' },
  { label: 'Список', value: 'list', icon: 'pi pi-list' }
]

const filteredRequests = computed(() => {
  let filtered = requests.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(req =>
      (req.val || '').toLowerCase().includes(query) ||
      req.id.toString().includes(query)
    )
  }

  // Active filter
  if (activeFilter.value === 'favorites') {
    filtered = filtered.filter(req => favorites.value.includes(req.id))
  } else if (activeFilter.value === 'empty' && loadMetadataEnabled.value) {
    filtered = filtered.filter(req => req.metadata && req.metadata.rowCount === 0)
  } else if (activeFilter.value === 'filled' && loadMetadataEnabled.value) {
    filtered = filtered.filter(req => req.metadata && req.metadata.rowCount > 0)
  }

  // Sort
  if (sortBy.value === 'name') {
    filtered.sort((a, b) => (a.val || '').localeCompare(b.val || ''))
  } else if (sortBy.value === 'id') {
    filtered.sort((a, b) => a.id - b.id)
  } else if (sortBy.value === 'created') {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }

  return filtered
})

const totalPages = computed(() => {
  if (!paginationEnabled.value) return 1
  return Math.ceil(filteredRequests.value.length / pageSize.value)
})

const paginatedRequests = computed(() => {
  if (!paginationEnabled.value) return filteredRequests.value
  const start = first.value
  const end = start + pageSize.value
  return filteredRequests.value.slice(start, end)
})

const contextMenuItems = computed(() => [
  {
    label: 'Открыть',
    icon: 'pi pi-eye',
    command: () => navigateToRequest(selectedRequest.value.id)
  },
  {
    label: 'Выполнить',
    icon: 'pi pi-play',
    command: () => executeRequest(selectedRequest.value.id)
  },
  {
    label: 'Редактировать',
    icon: 'pi pi-pencil',
    command: () => editRequest(selectedRequest.value.id)
  },
  {
    separator: true
  },
  {
    label: isFavorite(selectedRequest.value?.id) ? 'Удалить из избранного' : 'Добавить в избранное',
    icon: isFavorite(selectedRequest.value?.id) ? 'pi pi-star-fill' : 'pi pi-star',
    command: () => toggleFavorite(selectedRequest.value.id)
  },
  {
    separator: true
  },
  {
    label: 'Копировать ID',
    icon: 'pi pi-copy',
    command: () => copyToClipboard(selectedRequest.value.id)
  },
  {
    separator: true
  },
  {
    label: 'Удалить',
    icon: 'pi pi-trash',
    class: 'text-red-500',
    command: () => deleteRequest(selectedRequest.value.id)
  }
])

// Methods
async function loadRequests() {
  loading.value = true
  error.value = null

  try {
    // Load reports (type 22 objects)
    const response = await integramService.getObjects(22, {
      pg: 1,
      LIMIT: 1000 // Load all reports
    })

    if (response && response.object) {
      requests.value = response.object.map(obj => ({
        id: obj.id,
        val: obj.val || `Отчёт #${obj.id}`,
        created_at: obj.created_at || null,
        updated_at: obj.updated_at || null,
        metadata: null
      }))

      logger.info(`Loaded ${requests.value.length} reports (type 22)`)

      // Load metadata if enabled
      if (loadMetadataEnabled.value) {
        loadRequestsMetadata()
      }
    } else {
      requests.value = []
    }
  } catch (err) {
    logger.error('Failed to load requests:', err)
    error.value = 'Не удалось загрузить список отчётов: ' + err.message
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.value,
      life: 5000
    })
  } finally {
    loading.value = false
  }
}

async function loadRequestsMetadata() {
  metadataLoading.value = true
  loadedMetadataCount.value = 0

  for (const request of requests.value) {
    try {
      const result = await integramService.executeReport(request.id, {})

      if (result) {
        let rowCount = 0
        let columnCount = 0

        if (Array.isArray(result)) {
          rowCount = result.length
          columnCount = result.length > 0 ? Object.keys(result[0]).length : 0
        } else if (result.columns && result.data) {
          rowCount = result.data.length
          columnCount = result.columns.length
        }

        request.metadata = {
          rowCount,
          columnCount
        }
      }

      loadedMetadataCount.value++
    } catch (err) {
      logger.warn(`Failed to load metadata for request ${request.id}:`, err)
      request.metadata = { rowCount: 0, columnCount: 0 }
      loadedMetadataCount.value++
    }
  }

  metadataLoading.value = false
}

function cancelMetadataLoading() {
  metadataLoading.value = false
}

function navigateToRequest(requestId) {
  router.push(`/integram/${database.value}/requests/${requestId}`)
}

function executeRequest(requestId) {
  router.push(`/integram/${database.value}/requests/${requestId}?autorun=1`)
}

function editRequest(requestId) {
  router.push(`/integram/${database.value}/object/${requestId}?edit=1`)
}

function createRequest() {
  // Navigate to object view for type 22 (Reports) with action=create query param
  // This will trigger the create dialog in IntegramObjectView
  router.push(`/integram/${database.value}/object/22?action=create`)
}

function isFavorite(requestId) {
  return favorites.value.includes(requestId)
}

function toggleFavorite(requestId) {
  const index = favorites.value.indexOf(requestId)
  if (index > -1) {
    favorites.value.splice(index, 1)
    toast.add({
      severity: 'info',
      summary: 'Удалено из избранного',
      life: 2000
    })
  } else {
    favorites.value.push(requestId)
    toast.add({
      severity: 'success',
      summary: 'Добавлено в избранное',
      life: 2000
    })
  }
  saveFavorites()
}

function saveFavorites() {
  localStorage.setItem(`integram_favorites_requests_${database.value}`, JSON.stringify(favorites.value))
}

function loadFavorites() {
  try {
    const saved = localStorage.getItem(`integram_favorites_requests_${database.value}`)
    if (saved) {
      favorites.value = JSON.parse(saved)
    }
  } catch (err) {
    logger.warn('Failed to load favorites:', err)
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(String(text))
  toast.add({
    severity: 'success',
    summary: 'Скопировано',
    detail: `ID ${text} скопирован в буфер обмена`,
    life: 2000
  })
}

async function deleteRequest(requestId) {
  if (!confirm(`Удалить отчёт #${requestId}?`)) return

  try {
    await integramService.deleteObject(requestId)
    toast.add({
      severity: 'success',
      summary: 'Удалено',
      detail: `Отчёт #${requestId} успешно удалён`,
      life: 3000
    })
    loadRequests()
  } catch (err) {
    logger.error('Failed to delete request:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось удалить отчёт: ' + err.message,
      life: 5000
    })
  }
}

function onRowClick(event) {
  navigateToRequest(event.data.id)
}

function onRowContextMenu(event) {
  selectedRequest.value = event.data
  contextMenu.value.show(event.originalEvent)
}

function onRequestContextMenu(event, request) {
  event.preventDefault()
  selectedRequest.value = request
  contextMenu.value.show(event)
}

function onPageChange(event) {
  first.value = event.first
}

function handleSearchKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeRequestIndex.value = 0
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeRequestIndex.value = filteredRequests.value.length - 1
  } else if (event.key === 'Enter' && activeRequestIndex.value >= 0) {
    event.preventDefault()
    const request = filteredRequests.value[activeRequestIndex.value]
    if (request) {
      navigateToRequest(request.id)
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('ru-RU')
  } catch {
    return '—'
  }
}

// Watch view mode changes
watch(viewMode, () => {
  viewModeTransitioning.value = true
  nextTick(() => {
    setTimeout(() => {
      viewModeTransitioning.value = false
    }, 100)
  })
})

// Lifecycle
onMounted(() => {
  loadFavorites()
  loadRequests()
})
</script>

<style scoped>
.integram-request-list {
  padding: 1rem;
}

.metadata-loading-notification {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.toolbar-section {
  padding: 0.5rem;
  background: var(--surface-0);
  border-radius: 8px;
}

.chip-active {
  background: var(--primary-color) !important;
  color: white !important;
}

.cursor-pointer {
  cursor: pointer;
}

.request-card {
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.request-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.request-card-active {
  border: 2px solid var(--primary-color);
}

.card-header-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 1;
}

.favorite-active {
  color: var(--yellow-500) !important;
}

.request-card-title {
  font-size: 1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-card-subtitle {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.request-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-table {
  cursor: pointer;
}

:deep(.request-table tbody tr:hover) {
  background: var(--surface-hover) !important;
}

.list-view .list-item {
  transition: background 0.2s;
}

.button-on {
  background: var(--primary-color) !important;
  color: white !important;
}
</style>

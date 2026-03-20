<template>
  <div class="integram-table-embed-component" :class="{ 'full-mode': mode === 'full' }" @mousedown.stop @click.stop @dblclick.stop @keydown.stop @keyup.stop @input.stop @compositionstart.stop @compositionend.stop>
    <!-- Issue #6533: Full mode - render IntegramDataTableWrapper -->
    <template v-if="mode === 'full'">
      <!-- Issue #6805: Skeleton placeholder (visible until table-loaded event) -->
      <div v-if="tableLoading" class="table-skeleton-wrapper">
        <Skeleton width="100%" height="48px" class="mb-2" />
        <Skeleton width="100%" height="720px" />
      </div>
      <!-- Wrapper always mounted so it can emit table-loaded; hidden during skeleton -->
      <IntegramDataTableWrapper
        v-show="!tableLoading"
        :typeId="tableId"
        :database="database"
        :embedded="true"
        :parentId="filterParent || undefined"
        :editModeProp="editMode"
        :selectorName="selectorName || undefined"
        :selectorColumnId="selectorColumnId || undefined"
        :blockId="blockId || undefined"
        :initialFilterConditions="initialFilterConditions || undefined"
        :initialSelectedColumns="initialSelectedColumns || undefined"
        :initialColumnWidths="initialColumnWidths || undefined"
        :initialColumnOrder="initialColumnOrder || undefined"
        :initialVirtualColumns="initialVirtualColumns || undefined"
        @table-loaded="tableLoading = false"
        @settings-updated="$emit('settings-updated', $event)"
      />
    </template>

    <!-- Simple mode - original DataTable preview -->
    <template v-else>
      <Card>
        <template #title>
          <div class="flex align-items-center justify-content-between">
            <div class="flex align-items-center gap-2">
              <i class="pi pi-table text-primary"></i>
              <span>{{ tableName }}</span>
            </div>
            <div class="flex gap-2">
              <Tag :value="database" severity="info" />
              <Tag :value="`ID: ${tableId}`" />
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="text-center py-5">
            <ProgressSpinner />
            <p class="mt-3 text-color-secondary">Загрузка данных таблицы...</p>
          </div>

          <div v-else-if="error" class="text-center py-5">
            <Message severity="error" :closable="false">
              {{ error }}
            </Message>
          </div>

          <div v-else-if="objects && objects.length > 0">
            <DataTable
              :value="displayObjects"
              :paginator="true"
              :rows="10"
              :rowsPerPageOptions="[5, 10, 20]"
              stripedRows
              :scrollable="true"
              scrollHeight="400px"
              size="small"
            >
              <!-- ID Column -->
              <Column field="id" header="ID" :sortable="true" style="width: 80px">
                <template #body="{ data }">
                  <code class="text-sm">{{ data.id }}</code>
                </template>
              </Column>

              <!-- Val Column -->
              <Column field="val" header="Значение" :sortable="true" style="min-width: 200px">
                <template #body="{ data }">
                  {{ data.val }}
                </template>
              </Column>

              <!-- Dynamic requisite columns -->
              <Column
                v-for="req in displayedRequisites"
                :key="req.id"
                :field="`req_${req.id}`"
                :header="req.val"
                :sortable="true"
                style="min-width: 150px"
              >
                <template #body="{ data }">
                  <span v-if="data[`req_${req.id}`]">{{ data[`req_${req.id}`] }}</span>
                  <span v-else class="text-color-secondary">—</span>
                </template>
              </Column>
            </DataTable>

            <div class="mt-3 text-right">
              <Button
                label="Открыть полную таблицу"
                icon="pi pi-external-link"
                size="small"
                outlined
                @click="openFullTable"
              />
            </div>
          </div>

          <div v-else class="text-center py-5">
            <Message severity="info" :closable="false">
              В таблице нет данных
            </Message>
          </div>
        </template>
      </Card>
    </template>
  </div>
</template>

<script>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Skeleton from 'primevue/skeleton'
import integramService from '@/services/integramApiClient'
import * as docBlocksApi from '@/services/docBlocksApiService'
import { logger } from '@/utils/logger'
// Issue #6533: Import full-fledged table component
// Use defineAsyncComponent to avoid chunk conflicts with dynamic imports
const IntegramDataTableWrapper = defineAsyncComponent(() => import('@/components/integram/IntegramDataTableWrapper.vue'))

export default {
  name: 'IntegramTableEmbed',
  emits: ['settings-updated'],
  components: {
    Card,
    DataTable,
    Column,
    Button,
    Tag,
    Message,
    ProgressSpinner,
    Skeleton,
    IntegramDataTableWrapper
  },
  props: {
    database: {
      type: String,
      required: true
    },
    tableId: {
      type: String,
      required: true
    },
    tableName: {
      type: String,
      required: true
    },
    maxRows: {
      type: Number,
      default: 20
    },
    // Issue #6533: Mode prop to switch between simple and full table view
    mode: {
      type: String,
      default: 'simple',
      validator: (value) => ['simple', 'full'].includes(value)
    },
    // Issue #6474: filterParent for scenario constructor (filters subordinate objects)
    filterParent: {
      type: String,
      default: ''
    },
    // Issue #6714: Edit mode override ('single-click' | 'double-click')
    editMode: {
      type: String,
      default: null
    },
    // Selector integration: name of the selector to listen to
    selectorName: {
      type: String,
      default: null
    },
    // Selector integration: column to filter by ('__val__' for main field or a requisite ID)
    selectorColumnId: {
      type: String,
      default: null
    },
    // Block-level settings persistence (stored in Integram block metadata, shared across users)
    blockId: {
      type: [String, Number],
      default: null
    },
    initialFilterConditions: {
      type: Array,
      default: null
    },
    initialSelectedColumns: {
      type: Object,
      default: null
    },
    initialColumnWidths: {
      type: Object,
      default: null
    },
    initialColumnOrder: {
      type: Array,
      default: null
    },
    initialVirtualColumns: {
      type: Array,
      default: null
    }
  },
  setup(props) {
    // Safe router access for embedded mode (sub-app may lack router provider)
    let router = null
    try { router = useRouter() } catch { /* embedded mode */ }
    const loading = ref(true)
    const error = ref(null)
    const objects = ref([])
    const requisites = ref([])
    // Issue #6805: Skeleton loading state for full mode
    const tableLoading = ref(props.mode === 'full')

    // Computed properties
    const displayObjects = computed(() => {
      return objects.value.slice(0, props.maxRows)
    })

    const displayedRequisites = computed(() => {
      // Show max 5 most common requisites
      return requisites.value.slice(0, 5)
    })

    // Load table data
    const loadTableData = async () => {
      loading.value = true
      error.value = null

      const useBackend = props.database === 'kval'

      try {
        if (useBackend) {
          // kval: use backend API (no CORS)
          const metaResult = await docBlocksApi.getTypeMetadata(props.tableId)
          const typeMetadata = metaResult.metadata
          if (typeMetadata && typeMetadata.requisites) {
            requisites.value = typeMetadata.requisites
          }

          const queryParams = { LIMIT: props.maxRows + 10 }
          // Issue #6474: filterParent — загружать subordinate-объекты конкретного родителя
          if (props.filterParent) {
            queryParams.F_U = props.filterParent
          }
          const response = await docBlocksApi.getObjectsByType(props.tableId, queryParams)

          const objectsArray = response.object || response.objects || []
          const reqs = response.reqs || {}

          objects.value = objectsArray.map(obj => {
            const objReqs = reqs[obj.id] || {}
            const mergedObj = { ...obj }
            Object.keys(objReqs).forEach(reqId => {
              mergedObj[`req_${reqId}`] = objReqs[reqId].value || objReqs[reqId]
            })
            return mergedObj
          })
        } else {
          // Other databases: use integramService
          integramService.setDatabase(props.database)

          if (!integramService.isAuthenticated()) {
            integramService.loadSession()
            if (!integramService.isAuthenticated()) {
              throw new Error('Требуется авторизация в Integram')
            }
          }

          const typeMetadata = await integramService.getTypeMetadata(props.tableId)
          if (typeMetadata && typeMetadata.requisites) {
            requisites.value = typeMetadata.requisites
          }

          const response = await integramService.getObjects(props.tableId, {
            LIMIT: props.maxRows + 10
          })

          const objectsArray = response.object || response.objects || []
          const reqs = response.reqs || {}

          objects.value = objectsArray.map(obj => {
            const objReqs = reqs[obj.id] || {}
            const mergedObj = { ...obj }
            Object.keys(objReqs).forEach(reqId => {
              mergedObj[`req_${reqId}`] = objReqs[reqId].value || objReqs[reqId]
            })
            return mergedObj
          })
        }

        logger.info(`IntegramTableEmbed: Loaded ${objects.value.length} objects for table ${props.tableId}`)
      } catch (err) {
        logger.error('IntegramTableEmbed: Failed to load table data', err)
        error.value = err.message || 'Не удалось загрузить данные таблицы'
      } finally {
        loading.value = false
      }
    }

    // Open full table in new route (with fallback for embedded mode)
    const openFullTable = () => {
      const path = `/integram/${props.database}/table/${props.tableId}`
      if (router) {
        router.push(path)
      } else {
        window.open(path, '_blank')
      }
    }

    onMounted(() => {
      // В режиме 'full' данные загружает IntegramDataTableWrapper — не дублируем
      if (props.mode !== 'full') {
        loadTableData()
      }
    })

    return {
      loading,
      error,
      objects,
      requisites,
      displayObjects,
      displayedRequisites,
      openFullTable,
      tableLoading
    }
  }
}
</script>

<style scoped>
.integram-table-embed-component {
  margin: 0;
}

/* Simple mode only: strip Card styling so the embed looks flat/inline in the document.
   Issue #6629: without :not(.full-mode) these rules incorrectly override the
   IntegramDataTableWrapper's own Card styles when embedded in full mode. */
.integram-table-embed-component:not(.full-mode) :deep(.p-card) {
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.integram-table-embed-component:not(.full-mode) :deep(.p-card-body) {
  padding: 0;
}

.integram-table-embed-component:not(.full-mode) :deep(.p-card-caption) {
  padding: 0;
}

.integram-table-embed-component:not(.full-mode) :deep(.p-card-title) {
  font-size: 1rem;
  padding: 0;
  background: transparent;
}

.integram-table-embed-component:not(.full-mode) :deep(.p-card-content) {
  padding: 0;
  background: transparent;
}

code {
  background: var(--surface-hover);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

/* Issue #6805: Skeleton loading wrapper for full mode - fixed height prevents layout jumps */
.table-skeleton-wrapper {
  padding: 0;
}

.table-skeleton-wrapper .mb-2 {
  margin-bottom: 0.5rem;
}

/* Issue #6533: Full mode styling — IntegramDataTableWrapper renders with its own Card,
   so we only override layout/spacing here (margin, overflow), NOT the Card appearance.
   The wrapper component's own scoped styles control its visual presentation.
   Issue #6629: removed the full-mode :deep(.p-card*) overrides that were incorrectly
   stripping the wrapper's Card border, background, and padding. */
.integram-table-embed-component.full-mode {
  border: none;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.integram-table-embed-component.full-mode :deep(.integram-datatable-wrapper) {
  margin: 0;
}
</style>

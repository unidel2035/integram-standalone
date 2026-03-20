<template>
  <div class="integram-object-edit-page integram-touch-friendly">
    <!--
      Integram Object Edit Page
      ==========================
      This page handles editing of Integram objects. It intelligently detects whether
      the objectId refers to a TYPE (table of objects) or a single object:

      - If TYPE: Shows a table view with inline editing capabilities
      - If single object: Delegates to IntegramEnhancedObjectEditor for form-based editing

      Features:
      - Inline cell editing for table views
      - Row-level actions (edit in form, delete)
      - Add new records
      - Edit table structure (columns, types)
      - Real-time save with visual feedback
    -->

    <!-- Breadcrumb -->
    <IntegramBreadcrumb :items="breadcrumbItems" />

    <!-- Loading state -->
    <Card v-if="loading">
      <template #content>
        <div class="text-center py-5">
          <ProgressSpinner />
          <p class="mt-3">{{ loadingMessage }}</p>
        </div>
      </template>
    </Card>

    <!-- Error state -->
    <Card v-else-if="errorMessage">
      <template #content>
        <div class="text-center py-5">
          <Message severity="error" :closable="false">{{ errorMessage }}</Message>
        </div>
      </template>
    </Card>

    <!-- Table view for TYPE objects (multiple rows with inline editing) -->
    <div v-else-if="isType && objectsData">
      <Card>
        <template #title>
          <div class="flex align-items-center justify-content-between">
            <span>{{ typeData?.val || 'Объекты' }}</span>
            <div class="flex gap-2 align-items-center ml-auto">
              <Button
                icon="pi pi-plus"
                label="Создать"
                @click="addNewRow"
                size="small"
                v-tooltip.bottom="'Добавить новую запись'"
              />

              <Button
                icon="pi pi-pencil"
                :outlined="!inlineEditMode"
                :severity="inlineEditMode ? 'success' : 'secondary'"
                @click="toggleInlineEdit"
                size="small"
                rounded
                v-tooltip.bottom="inlineEditMode ? 'Режим правки вкл.' : 'Включить правку'"
              />

              <Button
                icon="pi pi-cog"
                outlined
                rounded
                size="small"
                @click="editTypeStructure"
                v-tooltip.bottom="'Структура таблицы'"
              />

              <Button
                icon="pi pi-refresh"
                outlined
                rounded
                size="small"
                @click="loadData"
                v-tooltip.bottom="'Обновить'"
              />
            </div>
          </div>
        </template>

        <template #content>
          <!-- Help message for editing -->
          <Message v-if="!inlineEditMode" severity="info" :closable="true" class="mb-3">
            <div class="flex align-items-center gap-2">
              <i class="pi pi-info-circle text-2xl"></i>
              <div>
                <p class="m-0 mb-2"><strong>🎯 ИНСТРУКЦИЯ: Как редактировать значения в таблице</strong></p>
                <ul class="m-0 pl-4">
                  <li class="mb-1"><strong>Быстрое редактирование в таблице:</strong> Нажмите кнопку <strong>"Включить правку"</strong> выше, затем кликните на любую ячейку для редактирования</li>
                  <li class="mb-1"><strong>Детальное редактирование записи:</strong> Нажмите <i class="pi pi-pencil"></i> в строке для открытия формы редактирования со всеми типами полей</li>
                  <li class="mb-1"><strong>Изменение структуры таблицы:</strong> Нажмите кнопку <strong>"Структура"</strong> для добавления/удаления колонок, изменения типов данных</li>
                  <li class="mb-1"><strong>Добавление новых записей:</strong> Нажмите кнопку <strong>"Добавить"</strong> для создания новой записи</li>
                </ul>
                <div class="mt-2 p-2 surface-50 border-round">
                  <small class="text-600">
                    <i class="pi pi-lightbulb mr-1"></i>
                    <strong>Совет:</strong> Все изменения сохраняются автоматически при выходе из ячейки. Последнее сохранение отображается внизу таблицы.
                  </small>
                </div>
              </div>
            </div>
          </Message>

          <!-- Active Edit Mode Banner -->
          <Message v-else severity="success" :closable="false" class="mb-3">
            <div class="flex align-items-center gap-2">
              <i class="pi pi-check-circle text-2xl"></i>
              <div>
                <p class="m-0"><strong>✅ РЕЖИМ РЕДАКТИРОВАНИЯ АКТИВЕН</strong> - Кликните на любую ячейку для изменения значения</p>
              </div>
            </div>
          </Message>

          <!-- Data table with inline editing -->
          <DataTable
            v-model:filters="filters"
            :value="tableData"
            :paginator="true"
            :rows="rowsPerPage"
            :rowsPerPageOptions="[10, 20, 50, 100]"
            :editMode="inlineEditMode ? 'cell' : null"
            @cell-edit-complete="onCellEditComplete"
            :loading="tableLoading"
            showGridlines
            stripedRows
            resizableColumns
            columnResizeMode="expand"
            filterDisplay="row"
            class="editable-integram-table"
            dataKey="id"
          >
            <!-- ID Column -->
            <Column field="id" header="ID" :sortable="true" style="min-width: 80px">
              <template #body="{ data }">
                <code class="text-sm">{{ data.id }}</code>
              </template>
              <template #filter="{ filterModel, filterCallback }">
                <InputText
                  v-model="filterModel.value"
                  @input="filterCallback()"
                  placeholder="Поиск по ID"
                  class="p-column-filter"
                  size="small"
                />
              </template>
            </Column>

            <!-- Value Column -->
            <Column field="val" header="Значение" :sortable="true" style="min-width: 200px">
              <template #body="{ data }">
                <div class="editable-cell-content">
                  {{ data.val }}
                </div>
              </template>
              <template #editor="{ data, field }">
                <InputText
                  v-model="data[field]"
                  autofocus
                  class="w-full"
                />
              </template>
              <template #filter="{ filterModel, filterCallback }">
                <InputText
                  v-model="filterModel.value"
                  @input="filterCallback()"
                  placeholder="Поиск"
                  class="p-column-filter"
                  size="small"
                />
              </template>
            </Column>

            <!-- Dynamic Requisite Columns -->
            <Column
              v-for="reqId in requisiteColumns"
              :key="reqId"
              :field="`req_${reqId}`"
              :header="getRequisiteName(reqId)"
              :sortable="true"
              style="min-width: 150px"
            >
              <template #body="{ data }">
                <div class="editable-cell-content">
                  <!-- Multiselect reference: display as badges -->
                  <template v-if="getRequisiteMetadata(reqId).isMulti && Array.isArray(formatCellValue(data[`req_${reqId}`], reqId))">
                    <div class="multiselect-badges">
                      <span
                        v-for="item in formatCellValue(data[`req_${reqId}`], reqId)"
                        :key="item.id || item.ref"
                        class="badge badge-pill text-sm px-2 py-1 mr-1 mb-1"
                        :style="{ backgroundColor: getBadgeColor(item.ref || item.id) }"
                      >
                        {{ item.val || item.name || `#${item.ref || item.id}` }}
                      </span>
                    </div>
                  </template>
                  <!-- Regular value -->
                  <template v-else>
                    {{ formatCellValue(data[`req_${reqId}`], reqId) }}
                  </template>
                </div>
              </template>
              <template #editor="{ data, field }">
                <!-- Reference fields (including multiselect) can only be edited in form view -->
                <div v-if="getRequisiteMetadata(reqId).isReference" class="text-sm text-500">
                  <i class="pi pi-info-circle mr-1"></i>
                  Редактируется только в форме
                </div>
                <component
                  v-else
                  :is="getEditorComponent(reqId)"
                  v-model="data[field]"
                  :class="{ 'w-full': true }"
                  autofocus
                />
              </template>
              <template #filter="{ filterModel, filterCallback }">
                <InputText
                  v-model="filterModel.value"
                  @input="filterCallback()"
                  :placeholder="`Поиск по ${getRequisiteName(reqId)}`"
                  class="p-column-filter"
                  size="small"
                />
              </template>
            </Column>

            <!-- Actions Column -->
            <Column header="Действия" :frozen="true" alignFrozen="right" style="min-width: 140px">
              <template #body="{ data }">
                <div class="integram-actions">
                  <!-- Primary actions -->
                  <Button
                    icon="pi pi-pencil"
                    @click="editObjectForm(data.id)"
                    size="small"
                    text
                    rounded
                    severity="info"
                    v-tooltip.top="'Редактировать в форме'"
                    aria-label="Редактировать"
                  />
                  <!-- Destructive action (визуально отделена) -->
                  <Button
                    icon="pi pi-trash"
                    @click="confirmDeleteRow(data.id)"
                    size="small"
                    text
                    rounded
                    severity="danger"
                    v-tooltip.top="'Удалить'"
                    aria-label="Удалить"
                    class="ml-auto"
                  />
                </div>
              </template>
            </Column>

            <template #footer>
              <div class="flex justify-content-between align-items-center">
                <span class="text-sm">Всего записей: {{ tableData.length }}</span>
                <span v-if="lastSaved" class="text-sm text-color-secondary">
                  Последнее сохранение: {{ lastSaved }}
                </span>
              </div>
            </template>
          </DataTable>
        </template>
      </Card>
    </div>

    <!-- Single object form editor (for individual objects, not types) -->
    <IntegramEnhancedObjectEditor
      v-else-if="!isType && database && objectId"
      :database="database"
      :objectId="objectId"
      @objectLoaded="onObjectLoaded"
    />

    <!-- Fallback message if nothing is showing -->
    <Card v-else-if="!loading && !isType">
      <template #content>
        <Message severity="warn" :closable="false">
          <p>Не удалось загрузить объект #{{ objectId }}</p>
          <p class="mt-2">
            <router-link :to="`/integram/${database}/dict`">
              Вернуться к списку таблиц
            </router-link>
          </p>
        </Message>
      </template>
    </Card>

    <!-- Delete Confirmation Dialog -->
    <Dialog
      v-model:visible="deleteDialog.visible"
      header="Подтверждение удаления"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex align-items-center gap-3">
        <i class="pi pi-exclamation-triangle text-4xl text-warning"></i>
        <span>Вы уверены, что хотите удалить запись с ID <strong>{{ deleteDialog.objectId }}</strong>?</span>
      </div>
      <template #footer>
        <div class="integram-actions justify-content-end w-full">
          <Button
            label="Отмена"
            icon="pi pi-times"
            @click="deleteDialog.visible = false"
            text
            aria-label="Отменить удаление"
          />
          <Button
            label="Удалить"
            icon="pi pi-trash"
            severity="danger"
            @click="deleteRow"
            :loading="deleteDialog.loading"
            aria-label="Подтвердить удаление"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode } from '@primevue/core/api';
import { useIntegramSession } from '@/composables/useIntegramSession';
import integramService from '@/services/integramApiClient';
import integramApiClient from '@/services/integramApiClient';
import IntegramEnhancedObjectEditor from '@/components/integram/IntegramEnhancedObjectEditor.vue';
import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { isAuthenticated, database: sessionDatabase } = useIntegramSession();

// Session state
const sessionReady = ref(false);
const loading = ref(true);
const errorMessage = ref('');
const loadingMessage = ref('Инициализация сессии...');

// View state
const isType = ref(false); // true if objectId is a TYPE (table view), false if single object (form view)
const objectsData = ref(null);
const typeData = ref(null);
const tableData = ref([]);
const tableLoading = ref(false);
const requisitesMetadata = ref({}); // Metadata for each requisite (isReference, isMulti, refTypeId, etc.)

// Single object state (from EnhancedObjectEditor)
const singleObjectData = ref(null);
const singleObjectTypeName = ref(null);
const singleObjectTypeId = ref(null);

// Inline editing state
const inlineEditMode = ref(false);
const rowsPerPage = ref(20);
const lastSaved = ref(null);

// Filters
const filters = ref({
  id: { value: null, matchMode: FilterMatchMode.CONTAINS },
  val: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// Delete dialog
const deleteDialog = ref({
  visible: false,
  objectId: null,
  loading: false
});

// Get objectId from route params
const objectId = computed(() => route.params.objectId);

// Get database from session or route
const database = computed(() => route.params.database || sessionDatabase.value || 'integram');

// Computed: Breadcrumb items
// Format: {db} > Таблицы > {таблица} > (edit icon) {элемент}
// Note: Database ({db}) is automatically prepended by IntegramBreadcrumb's homeItem
const breadcrumbItems = computed(() => {
  const items = [
    { label: 'Таблицы', to: `/integram/${database.value}/dict`, icon: 'pi pi-table' }
  ];

  if (isType.value && typeData.value?.val) {
    // Table view: {db} > Таблицы > {table name}
    items.push({ label: typeData.value.val, icon: 'pi pi-bars' });
  } else if (!isType.value && singleObjectData.value) {
    // Single object edit: {db} > Таблицы > {table name} > (edit) {object name}
    if (singleObjectTypeName.value && singleObjectTypeId.value) {
      items.push({
        label: singleObjectTypeName.value,
        to: `/integram/${database.value}/object/${singleObjectTypeId.value}`,
        icon: 'pi pi-bars'
      });
    }
    items.push({
      label: singleObjectData.value.val || `#${singleObjectData.value.id}`,
      icon: 'pi pi-pencil'
    });
  } else if (!isType.value) {
    // Loading state
    items.push({ label: 'Загрузка...', icon: 'pi pi-spin pi-spinner' });
  }

  return items;
});

// Computed: Requisite columns
const requisiteColumns = computed(() => {
  if (!objectsData.value || !objectsData.value.req_order) {
    return [];
  }
  return objectsData.value.req_order;
});

// Methods
function getRequisiteName(reqId) {
  if (!objectsData.value || !objectsData.value.req_type) {
    return `Реквизит ${reqId}`;
  }
  return objectsData.value.req_type[reqId] || `Реквизит ${reqId}`;
}

function getRequisiteBase(reqId) {
  if (!objectsData.value || !objectsData.value.req_base) {
    return 'SHORT';
  }
  return objectsData.value.req_base[reqId] || 'SHORT';
}

function getRequisiteMetadata(reqId) {
  return requisitesMetadata.value[reqId] || {
    isReference: false,
    isMulti: false,
    refTypeId: null
  };
}

function getBadgeColor(id) {
  // Generate color based on ID (like in legacy implementation and ReferenceField.vue)
  const colors = [
    '#78AAD2', '#78AAFF', '#78D2AA', '#78D2FF', '#78FFAA', '#78FFD2',
    '#AA78D2', '#AA78FF', '#AAD278', '#AAD2FF', '#AAFF78', '#AAFFD2',
    '#D278AA', '#D278FF', '#D2AA78', '#D2AAFF', '#D2FF78', '#D2FFAA',
    '#FF78AA', '#FF78D2', '#FFAA78', '#FFAAD2', '#FFD278', '#FFD2AA'
  ];

  // Defensive: Handle undefined, null, or invalid IDs
  // Convert to number and use modulo to get color index
  const numericId = parseInt(id) || 0;
  const colorIndex = Math.abs(numericId) % colors.length;

  return colors[colorIndex];
}

function getEditorComponent(reqId) {
  const baseType = getRequisiteBase(reqId);

  // Map base types to editor components
  switch (baseType) {
    case 'SIGNED':
    case 'NUMBER':
      return InputText; // TODO: Use InputNumber
    case 'BOOLEAN':
      return 'Checkbox';
    case 'DATE':
    case 'DATETIME':
      return 'Calendar';
    case 'MEMO':
    case 'HTML':
      return 'Textarea';
    default:
      return InputText;
  }
}

function formatCellValue(value, reqId) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const metadata = getRequisiteMetadata(reqId);
  const baseType = getRequisiteBase(reqId);

  // Handle REFERENCE fields (including multiselect)
  if (metadata.isReference) {
    // Multiselect: value is an array of objects with {id, ref, val, ord}
    if (metadata.isMulti && Array.isArray(value)) {
      if (value.length === 0) {
        return '—';
      }
      // Return array for rendering as badges in template
      return value;
    }

    // Single reference: value might be object {id, val} or just ID
    if (value && typeof value === 'object' && 'val' in value) {
      return value.val;
    }

    // If just ID, return it (not ideal, but better than nothing)
    return value;
  }

  // Handle other base types
  switch (baseType) {
    case 'BOOLEAN':
      return value ? '✓' : '✗';
    case 'DATE':
    case 'DATETIME':
      // Format date if needed
      return value;
    default:
      return value;
  }
}

function toggleInlineEdit() {
  inlineEditMode.value = !inlineEditMode.value;

  toast.add({
    severity: 'info',
    summary: inlineEditMode.value ? 'Режим редактирования включен' : 'Режим редактирования выключен',
    detail: inlineEditMode.value ? 'Кликните на ячейку для редактирования' : 'Редактирование отключено',
    life: 3000
  });
}

async function onCellEditComplete(event) {
  const { data, newValue, field, index } = event;

  if (newValue === data[field]) {
    return; // No changes
  }

  // Update local data
  tableData.value[index][field] = newValue;

  // Save to API
  try {
    tableLoading.value = true;

    // Prepare requisites for saving
    const requisites = {};

    if (field === 'val') {
      // Saving the main value field
      await integramApiClient.saveObject(
        data.id,
        objectId.value, // typeId
        newValue,
        {} // empty requisites
      );
    } else if (field.startsWith('req_')) {
      // Saving a requisite field
      const requisiteId = field.replace('req_', '');
      requisites[requisiteId] = newValue;

      await integramApiClient.setObjectRequisites(data.id, requisites);
    } else {
      // Other fields (like 'up') can be saved via setObjectRequisites as well
      requisites[field] = newValue;
      await integramApiClient.setObjectRequisites(data.id, requisites);
    }

    lastSaved.value = new Date().toLocaleTimeString('ru-RU');

    toast.add({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Изменения успешно сохранены',
      life: 2000
    });
  } catch (error) {
    console.error('Error saving cell:', error);
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: error.message || 'Не удалось сохранить изменения',
      life: 5000
    });

    // Revert change
    await loadData();
  } finally {
    tableLoading.value = false;
  }
}

async function addNewRow() {
  try {
    // Get parent ID from query params (F_U) if this is a subordinate table
    const parentId = route.query.F_U || null;

    // createObject(typeId, value, requisites, parentId)
    const result = await integramApiClient.createObject(
      objectId.value,      // typeId - objectId IS the type ID when isType=true
      'Новая запись',      // value - the main field value
      {},                  // requisites - empty for new row
      parentId             // parentId - from F_U query param or null
    );

    toast.add({
      severity: 'success',
      summary: 'Создано',
      detail: `Новая запись #${result.id || ''} успешно создана`,
      life: 3000
    });

    // Reload data
    await loadData();
  } catch (error) {
    console.error('Error creating row:', error);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message || 'Не удалось создать запись',
      life: 5000
    });
  }
}

function confirmDeleteRow(rowObjectId) {
  deleteDialog.value.objectId = rowObjectId;
  deleteDialog.value.visible = true;
}

async function deleteRow() {
  try {
    deleteDialog.value.loading = true;

    await integramApiClient.deleteObject(deleteDialog.value.objectId);

    toast.add({
      severity: 'success',
      summary: 'Удалено',
      detail: 'Запись успешно удалена',
      life: 3000
    });

    deleteDialog.value.visible = false;
    deleteDialog.value.objectId = null;

    // Reload data
    await loadData();
  } catch (error) {
    console.error('Error deleting row:', error);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message || 'Не удалось удалить запись',
      life: 5000
    });
  } finally {
    deleteDialog.value.loading = false;
  }
}

function editObjectForm(rowObjectId) {
  // Navigate to form editor for this specific object
  router.push(`/integram/${database.value}/edit_obj/${rowObjectId}`);
}

function editTypeStructure() {
  // Navigate to type structure editor
  router.push(`/integram/${database.value}/edit_types?typeId=${objectId.value}`);
}

// Handle object loaded event from EnhancedObjectEditor
function onObjectLoaded(data) {
  singleObjectData.value = data.objectData;
  singleObjectTypeName.value = data.typeName;
  singleObjectTypeId.value = data.objectData?.typ;
}

async function loadData() {
  try {
    tableLoading.value = true;
    loadingMessage.value = 'Загрузка данных...';

    // Try to load as TYPE (table of objects)
    const result = await integramService.getObjects(objectId.value);

    if (result && result.list) {
      // Success! This is a TYPE, show table view
      isType.value = true;
      objectsData.value = result;
      typeData.value = result.type;

      // Load type metadata to get requisite details (for multiselect, reference detection)
      try {
        const metaData = await integramService.getMetadata(objectId.value);

        if (metaData && metaData.reqs) {
          // Parse requisite metadata to detect reference and multiselect fields
          const metadata = {};

          metaData.reqs.forEach(req => {
            const isArray = req.type === '4'; // Array type
            const isReference = !isArray && (req.ref !== undefined);
            const isMulti = req.attrs && req.attrs.includes(':MULTI:');

            metadata[req.id] = {
              isReference,
              isArray,
              isMulti,
              refTypeId: req.ref || null,
              baseType: req.type || null
            };
          });

          requisitesMetadata.value = metadata;
        }
      } catch (metaError) {
        if (import.meta.env.DEV) {
          console.warn('Could not load type metadata:', metaError);
        }
        // Continue without metadata - some features will be limited
      }

      // Build table data
      tableData.value = result.list.map(obj => {
        const row = {
          id: obj.id,
          val: obj.val,
          up: obj.up
        };

        // Add requisite values
        if (result.req_order) {
          result.req_order.forEach(reqId => {
            const metadata = requisitesMetadata.value[reqId];

            // Check if this is a multiselect field
            if (metadata && metadata.isMulti && metadata.isReference) {
              // Parse multiselect data from ref_{reqId} and display text
              const refField = obj[`ref_${reqId}`];
              const displayText = obj[reqId];

              if (refField && displayText) {
                // Format: "typeId:id1,id2,id3"
                const refMatch = refField.match(/^(\d+):(.+)$/);

                if (refMatch) {
                  const refTypeId = refMatch[1];
                  const refIds = refMatch[2].split(',');
                  const displayNames = displayText.split(',');

                  // Build array of multiselect items
                  const multiselectItems = refIds.map((refId, index) => ({
                    id: null, // Multiselect relation ID (not available in this format)
                    ref: refId.trim(),
                    val: displayNames[index] ? displayNames[index].trim() : `#${refId.trim()}`,
                    ord: index + 1
                  }));

                  row[`req_${reqId}`] = multiselectItems;
                } else {
                  // Fallback: just display text
                  row[`req_${reqId}`] = displayText || '';
                }
              } else {
                row[`req_${reqId}`] = [];
              }
            } else {
              // Regular field: assign value as-is
              row[`req_${reqId}`] = obj[reqId] || '';
            }
          });
        }

        return row;
      });

      loadingMessage.value = '';
    } else {
      // This might be a single object, not a type
      isType.value = false;
    }
  } catch (error) {
    console.error('Error loading as TYPE:', error);

    // Fall back to single object form
    isType.value = false;
  } finally {
    tableLoading.value = false;
    loading.value = false;
  }
}

// Redirect to login if not authenticated
if (!isAuthenticated.value) {
  router.replace('/integram/login');
}

// Initialize on mount
onMounted(async () => {
  try {
    loadingMessage.value = 'Проверка аутентификации...';

    // Simple authentication check
    if (!isAuthenticated.value) {
      throw new Error('Не авторизован. Требуется вход в систему.');
    }

    // Get authentication info from integramApiClient
    const authInfo = integramApiClient.getAuthInfo();

    if (!authInfo || !authInfo.token) {
      throw new Error('Сессия истекла. Требуется повторный вход.');
    }

    // Set database for integramService if available
    if (authInfo.database) {
      integramService.setDatabase(authInfo.database);
    }

    // Mark session as ready
    sessionReady.value = true;

    // Try to load data
    await loadData();
  } catch (error) {
    console.error('Initialization error:', error);
    errorMessage.value = error.message;
    loading.value = false;

    // Redirect to login after a delay
    setTimeout(() => {
      router.replace('/integram/login');
    }, 2000);
  }
});
</script>

<style scoped>
.integram-object-edit-page {
  width: 100%;
  height: 100%;
}

.editable-integram-table {
  font-size: 0.9rem;
}

.editable-cell-content {
  min-height: 1.5rem;
  cursor: pointer;
}

.editable-cell-content:hover {
  background-color: var(--surface-50);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
}

.breadcrumb-item + .breadcrumb-item::before {
  content: "/";
  padding: 0 0.5rem;
  color: var(--text-color-secondary);
}

.breadcrumb-item.active {
  color: var(--text-color);
}

.breadcrumb-item a {
  color: var(--primary-color);
  text-decoration: none;
}

.breadcrumb-item a:hover {
  text-decoration: underline;
}

/* Multiselect badges (matching legacy edit_obj.html and ReferenceField.vue) */
.multiselect-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 12px;
  color: var(--p-text-color, #1a1a1a);
  font-weight: 500;
  white-space: nowrap;
}

.badge-pill {
  border-radius: 12px;
}
</style>

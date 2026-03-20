<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="isEdit ? 'Настройки календаря' : 'Создать календарь'"
    :style="{ width: '600px' }"
    @hide="handleCancel"
  >
    <div class="calendar-settings-form">
      <!-- Database Selection -->
      <div class="form-field">
        <label for="database">База данных</label>
        <Dropdown
          id="database"
          v-model="localConfig.database"
          :options="databases"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите базу данных"
          @change="handleDatabaseChange"
          class="w-full"
        />
      </div>

      <!-- Table Selection -->
      <div class="form-field">
        <label for="table">Таблица</label>
        <Dropdown
          id="table"
          v-model="localConfig.typeId"
          :options="tables"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите таблицу"
          :disabled="!localConfig.database || loadingTables"
          :loading="loadingTables"
          @change="handleTableChange"
          class="w-full"
        />
        <small v-if="loadingTables" class="text-muted">Загрузка списка таблиц...</small>
      </div>

      <!-- Date Field Selection -->
      <div class="form-field">
        <label for="dateField">Поле даты начала <span class="required">*</span></label>
        <Dropdown
          id="dateField"
          v-model="localConfig.dateField"
          :options="dateFields"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите поле даты"
          :disabled="!localConfig.typeId || loadingFields"
          :loading="loadingFields"
          class="w-full"
        />
        <small class="text-muted">Только поля типа DATE или DATETIME</small>
      </div>

      <!-- End Date Field Selection (Optional) -->
      <div class="form-field">
        <label for="endDateField">Поле даты окончания (опционально)</label>
        <Dropdown
          id="endDateField"
          v-model="localConfig.endDateField"
          :options="dateFields"
          optionLabel="label"
          optionValue="value"
          placeholder="Не выбрано"
          :disabled="!localConfig.typeId || loadingFields"
          :loading="loadingFields"
          showClear
          class="w-full"
        />
        <small class="text-muted">Для событий с длительностью</small>
      </div>

      <!-- Title Field Selection -->
      <div class="form-field">
        <label for="titleField">Поле названия события <span class="required">*</span></label>
        <Dropdown
          id="titleField"
          v-model="localConfig.titleField"
          :options="textFields"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите поле названия"
          :disabled="!localConfig.typeId || loadingFields"
          :loading="loadingFields"
          class="w-full"
        />
        <small class="text-muted">Поля типа SHORT или LONG</small>
      </div>

      <!-- Color Selection -->
      <div class="form-field">
        <label for="eventColor">Цвет событий</label>
        <div class="flex gap-2 align-items-center">
          <input
            id="eventColor"
            v-model="localConfig.color"
            type="color"
            class="color-input"
          />
          <span class="color-value">{{ localConfig.color }}</span>
        </div>
      </div>

      <!-- Default View -->
      <div class="form-field">
        <label for="defaultView">Режим отображения по умолчанию</label>
        <Dropdown
          id="defaultView"
          v-model="localConfig.defaultView"
          :options="viewOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите режим"
          class="w-full"
        />
      </div>

      <!-- Height -->
      <div class="form-field">
        <label for="height">Высота календаря (px)</label>
        <InputNumber
          id="height"
          v-model="localConfig.height"
          :min="300"
          :max="1200"
          :step="50"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Отмена" text @click="handleCancel" />
        <Button
          :label="isEdit ? 'Сохранить' : 'Создать'"
          @click="handleApply"
          :disabled="!isConfigValid"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { useToast } from 'primevue/usetoast'
import integramApiClient from '@/services/integramApiClient'

const props = defineProps({
  visible: { type: Boolean, default: false },
  config: { type: Object, default: () => ({}) },
  isEdit: { type: Boolean, default: false },
  serverURL: { type: String, default: 'ai2o.ru' },
  token: { type: String, default: null },
  xsrfToken: { type: String, default: null }
})

const emit = defineEmits(['update:visible', 'apply', 'cancel'])

const toast = useToast()

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const localConfig = ref({
  database: 'kval',
  typeId: null,
  dateField: null,
  endDateField: null,
  titleField: null,
  colorField: null,
  defaultView: 'dayGridMonth',
  color: '#4CAF50',
  height: 600
})

const databases = ref([
  { label: 'kval', value: 'kval' },
  { label: 'my', value: 'my' },
  { label: 'a2025', value: 'a2025' }
])

const tables = ref([])
const loadingTables = ref(false)

const dateFields = ref([])
const textFields = ref([])
const loadingFields = ref(false)

const viewOptions = ref([
  { label: 'Месяц', value: 'dayGridMonth' },
  { label: 'Неделя', value: 'timeGridWeek' },
  { label: 'День', value: 'timeGridDay' }
])

const isConfigValid = computed(() => {
  return !!(
    localConfig.value.database &&
    localConfig.value.typeId &&
    localConfig.value.dateField &&
    localConfig.value.titleField
  )
})

// Load tables from selected database — uses integramApiClient (same as TimelineBlockSettings)
const loadTables = async () => {
  if (!localConfig.value.database) return

  loadingTables.value = true
  try {
    integramApiClient.setDatabase(localConfig.value.database)
    const dictionary = await integramApiClient.getDictionary()
    const typeList = dictionary?.type || dictionary?.types || (Array.isArray(dictionary) ? dictionary : [])
    tables.value = typeList.map(type => ({
      label: type.val || type.name || `Type ${type.id}`,
      value: String(type.id)
    })).sort((a, b) => a.label.localeCompare(b.label))
  } catch (error) {
    console.error('CalendarBlockSettings: Error loading tables:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: 'Не удалось загрузить список таблиц',
      life: 3000
    })
  } finally {
    loadingTables.value = false
  }
}

// Load fields (requisites) from selected table — uses integramApiClient
const loadFields = async () => {
  if (!localConfig.value.typeId) return

  loadingFields.value = true
  try {
    integramApiClient.setDatabase(localConfig.value.database)
    const metadata = await integramApiClient.getTypeMetadata(localConfig.value.typeId)
    const requisites = metadata?.requisites || metadata?.req || []

    dateFields.value = requisites
      .filter(req => req.type === 4 || req.type === 5) // 4=DATETIME, 5=DATE
      .map(req => ({
        label: req.alias || req.name || `Requisite ${req.id}`,
        value: String(req.id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    textFields.value = requisites
      .filter(req => req.type === 3 || req.type === 2) // 3=SHORT, 2=LONG
      .map(req => ({
        label: req.alias || req.name || `Requisite ${req.id}`,
        value: String(req.id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch (error) {
    console.error('CalendarBlockSettings: Error loading fields:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: 'Не удалось загрузить список полей',
      life: 3000
    })
  } finally {
    loadingFields.value = false
  }
}

const handleDatabaseChange = () => {
  localConfig.value.typeId = null
  localConfig.value.dateField = null
  localConfig.value.endDateField = null
  localConfig.value.titleField = null
  tables.value = []
  dateFields.value = []
  textFields.value = []
  loadTables()
}

const handleTableChange = () => {
  localConfig.value.dateField = null
  localConfig.value.endDateField = null
  localConfig.value.titleField = null
  dateFields.value = []
  textFields.value = []
  loadFields()
}

const handleApply = () => {
  if (!isConfigValid.value) {
    toast.add({
      severity: 'warn',
      summary: 'Заполните обязательные поля',
      detail: 'Выберите базу данных, таблицу, поле даты и поле названия',
      life: 3000
    })
    return
  }

  emit('apply', { ...localConfig.value })
  isVisible.value = false
}

const handleCancel = () => {
  emit('cancel')
  isVisible.value = false
}

// Watch for visibility to initialize config
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      // Load initial config
      localConfig.value = {
        database: props.config.database || 'kval',
        typeId: props.config.typeId || null,
        dateField: props.config.dateField || null,
        endDateField: props.config.endDateField || null,
        titleField: props.config.titleField || null,
        colorField: props.config.colorField || null,
        defaultView: props.config.defaultView || 'dayGridMonth',
        color: props.config.color || '#4CAF50',
        height: props.config.height || 600
      }

      // Load tables if database is set
      if (localConfig.value.database) {
        loadTables()
      }

      // Load fields if table is set
      if (localConfig.value.typeId) {
        loadFields()
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.calendar-settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
  color: var(--text-color);
}

.required {
  color: var(--red-500);
}

.text-muted {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.color-input {
  width: 50px;
  height: 38px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  cursor: pointer;
}

.color-value {
  font-family: monospace;
  color: var(--text-color-secondary);
}

.dialog-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>

<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Фильтрация данных"
    :modal="true"
    :style="{ width: '600px' }"
    :breakpoints="{ '960px': '90vw' }"
  >
    <!-- Пустое состояние -->
    <div v-if="localConditions.length === 0" class="filter-empty-state">
      <i class="pi pi-filter" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
      <p class="mt-3 mb-3 text-color-secondary">Условия фильтрации не заданы</p>
      <Button
        label="Добавить условие"
        icon="pi pi-plus"
        outlined
        @click="addLocalCondition"
      />
    </div>

    <!-- Список условий -->
    <div v-else class="filter-conditions-list">
      <div
        v-for="(condition, index) in localConditions"
        :key="index"
        class="filter-condition-item"
      >
        <div class="condition-header">
          <h4 class="condition-title">Условие {{ index + 1 }}</h4>
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            size="small"
            @click="removeLocalCondition(index)"
            v-tooltip.left="'Удалить условие'"
          />
        </div>

        <div class="condition-fields">
          <!-- Выбор колонки -->
          <div class="field mb-3">
            <label :for="`col-${index}`">Столбец</label>
            <Dropdown
              :id="`col-${index}`"
              v-model="condition.headerId"
              :options="filterableFields"
              optionLabel="label"
              optionValue="id"
              placeholder="Выберите столбец"
              class="w-full"
              @change="updateLocalConditionType(index)"
            />
          </div>

          <!-- Выбор оператора -->
          <div class="field mb-3">
            <label :for="`op-${index}`">Оператор</label>
            <Dropdown
              :id="`op-${index}`"
              v-model="condition.operator"
              :options="getOperatorsForType(condition.type)"
              optionLabel="label"
              optionValue="value"
              placeholder="Выберите оператор"
              class="w-full"
              @change="() => {
                condition.value = null
                if ((condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'equals' && condition.dirTableId) {
                  loadRefOptions(condition.dirTableId)
                }
              }"
            />
          </div>

          <!-- Значение -->
          <template v-if="condition.operator !== 'isEmpty'">
            <!-- Источник значения -->
            <div class="field mb-2">
              <label>Источник значения</label>
              <div class="flex gap-2 mt-1">
                <Button
                  label="Вручную"
                  size="small"
                  :severity="condition.valueSource === 'manual' ? 'primary' : 'secondary'"
                  :outlined="condition.valueSource !== 'manual'"
                  @click="condition.valueSource = 'manual'; condition.selectorName = null"
                />
                <Button
                  label="Selector (динамически)"
                  icon="pi pi-link"
                  size="small"
                  :severity="condition.valueSource === 'selector' ? 'info' : 'secondary'"
                  :outlined="condition.valueSource !== 'selector'"
                  @click="toggleLocalValueSource(index)"
                />
              </div>
            </div>

            <!-- Имя Selector-а -->
            <div v-if="condition.valueSource === 'selector'" class="field mb-3">
              <label :for="`sel-${index}`">Имя Selector'а</label>
              <InputText
                :id="`sel-${index}`"
                v-model="condition.selectorName"
                class="w-full"
                placeholder="vid_kno, region, status..."
              />
              <small class="text-color-secondary">
                Значение берётся из блока Selector с этим именем
                <span v-if="condition.selectorName && selectorState.selectors[condition.selectorName]">
                  — сейчас: <strong>{{ selectorState.selectors[condition.selectorName] }}</strong>
                </span>
                <span v-else-if="condition.selectorName" class="text-orange-500"> — не активен</span>
              </small>
            </div>

            <!-- Ввод значения вручную -->
            <div v-if="condition.valueSource === 'manual' && !isRangeOperator(condition.operator)" class="field">
              <label :for="`val-${index}`">Значение</label>

              <!-- Справочное поле, оператор equals → объектный пикер -->
              <template v-if="(condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'equals'">
                <Dropdown
                  :id="`val-${index}`"
                  v-model="condition.value"
                  :options="refFilterOptions[condition.dirTableId] || []"
                  optionLabel="label"
                  optionValue="id"
                  :filter="true"
                  filterPlaceholder="Поиск..."
                  placeholder="Выберите объект..."
                  class="w-full"
                  :loading="!!refFilterLoading[condition.dirTableId]"
                  @show="loadRefOptions(condition.dirTableId)"
                >
                  <template #option="{ option }">
                    <span :class="option.isSpecial ? 'text-primary font-semibold' : ''">
                      {{ option.label }}
                      <span v-if="option.isSpecial && currentUserId" class="text-sm opacity-70">
                        (ID: {{ currentUserId }})
                      </span>
                    </span>
                  </template>
                </Dropdown>
                <small v-if="condition.value === '__current_user__'" class="text-primary">
                  Будет использован ID текущего пользователя из сессии
                </small>
                <small v-else-if="condition.value" class="text-color-secondary">
                  F_{{ condition.headerId?.replace('req_', '') }}=@{{ condition.value }}
                </small>
              </template>

              <!-- Справочное поле, оператор contains → текстовый поиск -->
              <template v-else-if="(condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'contains'">
                <InputText
                  :id="`val-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  placeholder="Поиск по тексту..."
                />
                <small class="text-color-secondary">Поиск по отображаемому значению (LIKE)</small>
              </template>

              <!-- Числовое поле -->
              <InputNumber
                v-else-if="[13, 14].includes(condition.type)"
                :id="`val-${index}`"
                v-model="condition.value"
                class="w-full"
                placeholder="Введите число..."
              />

              <!-- Дата/Время -->
              <Calendar
                v-else-if="[4, 9, 5].includes(condition.type)"
                :id="`val-${index}`"
                v-model="condition.value"
                class="w-full"
                :showIcon="true"
                dateFormat="dd.mm.yy"
                :showTime="condition.type === 4"
              />

              <!-- Длинный текст -->
              <Textarea
                v-else-if="condition.type === 2"
                :id="`val-${index}`"
                v-model="condition.value"
                class="w-full"
                :rows="3"
              />

              <!-- Короткий текст (default) -->
              <InputText
                v-else
                :id="`val-${index}`"
                v-model="condition.value"
                class="w-full"
                placeholder="Введите значение..."
              />
            </div>

            <!-- Диапазон (between) -->
            <div v-else-if="condition.valueSource === 'manual' && isRangeOperator(condition.operator)" class="grid">
              <div class="col-6">
                <div class="field">
                  <label :for="`from-${index}`">От</label>
                  <InputNumber
                    v-if="[13, 14].includes(condition.type)"
                    :id="`from-${index}`"
                    v-model="condition.value"
                    class="w-full"
                  />
                  <Calendar
                    v-else-if="[4, 9, 5].includes(condition.type)"
                    :id="`from-${index}`"
                    v-model="condition.value"
                    :showIcon="true"
                    dateFormat="dd.mm.yy"
                    :showTime="condition.type === 4"
                  />
                  <InputText
                    v-else
                    :id="`from-${index}`"
                    v-model="condition.value"
                    class="w-full"
                  />
                </div>
              </div>
              <div class="col-6">
                <div class="field">
                  <label :for="`to-${index}`">До</label>
                  <InputNumber
                    v-if="[13, 14].includes(condition.type)"
                    :id="`to-${index}`"
                    v-model="condition.value2"
                    class="w-full"
                  />
                  <Calendar
                    v-else-if="[4, 9, 5].includes(condition.type)"
                    :id="`to-${index}`"
                    v-model="condition.value2"
                    :showIcon="true"
                    dateFormat="dd.mm.yy"
                    :showTime="condition.type === 4"
                  />
                  <InputText
                    v-else
                    :id="`to-${index}`"
                    v-model="condition.value2"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- Скрыть колонку -->
          <div class="field mt-3">
            <div class="flex align-items-center gap-2">
              <Checkbox
                :inputId="`hide-${index}`"
                v-model="condition.hideColumn"
                :binary="true"
              />
              <label :for="`hide-${index}`" class="cursor-pointer text-sm">
                Скрыть колонку в таблице
              </label>
            </div>
            <small v-if="condition.hideColumn" class="text-color-secondary">
              Фильтр применяется, но колонка не отображается в таблице
            </small>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <Button
          label="Добавить условие"
          icon="pi pi-plus"
          text
          class="w-full"
          @click="addLocalCondition"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-content-between align-items-center w-full">
        <Button
          label="Сбросить все"
          icon="pi pi-filter-slash"
          @click="$emit('reset')"
          severity="danger"
          text
          size="small"
        />
        <div class="flex gap-2">
          <Button
            label="Отмена"
            @click="$emit('cancel')"
            text
          />
          <Button
            label="Применить"
            icon="pi pi-check"
            @click="onApply"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Calendar from 'primevue/calendar'
import Checkbox from 'primevue/checkbox'
import {
  getOperatorsForType,
  getDefaultOperatorForType,
  isRangeOperator
} from '@/composables/useIntegramServerFilters'

const props = defineProps({
  /** v-model:visible */
  visible: {
    type: Boolean,
    default: false
  },
  /**
   * Текущие активные условия фильтрации (из composable).
   * При открытии диалога создаётся локальная копия.
   */
  filterConditions: {
    type: Array,
    default: () => []
  },
  /**
   * Нормализованный список полей: { id, label, type, columnType, dirTableId }
   * Тип 10 (nested) исключён родительским computed filterableFields.
   */
  filterableFields: {
    type: Array,
    default: () => []
  },
  /** Кэш опций справочных полей: { [dirTableId]: [{id, label, isSpecial?}] } */
  refFilterOptions: {
    type: Object,
    default: () => ({})
  },
  refFilterLoading: {
    type: Object,
    default: () => ({})
  },
  /** ID текущего пользователя Integram (для подсказки в пикере) */
  currentUserId: {
    type: [String, Number],
    default: null
  },
  /** Реактивный объект selectorState.selectors для предпросмотра значений */
  selectorState: {
    type: Object,
    default: () => ({ selectors: {} })
  },
  /** Функция для загрузки опций справочника (из composable) */
  loadRefOptions: {
    type: Function,
    default: () => {}
  }
})

const emit = defineEmits(['update:visible', 'apply', 'reset', 'cancel'])

// Локальная копия условий — редактируем только её
const localConditions = ref([])

// При открытии диалога — глубокое копирование текущих условий
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible) {
      localConditions.value = props.filterConditions.map(c => ({ ...c }))
      // Добавить одно пустое условие если нет ни одного
      if (localConditions.value.length === 0) {
        addLocalCondition()
      }
      // Предзагрузить опции справочных полей для equals-условий
      localConditions.value.forEach(c => {
        if ((c.columnType === 'dir' || c.columnType === 'multi') && c.dirTableId && c.operator === 'equals') {
          props.loadRefOptions(c.dirTableId)
        }
      })
    }
  },
  { immediate: true }
)

function addLocalCondition() {
  const firstField = props.filterableFields?.[0]
  const isRef = firstField?.columnType === 'dir' || firstField?.columnType === 'multi'
  const defaultOperator = isRef ? 'equals' : getDefaultOperatorForType(firstField?.type || 3)
  localConditions.value.push({
    headerId: firstField?.id || null,
    type: firstField?.type || 3,
    columnType: firstField?.columnType || 'regular',
    dirTableId: firstField?.dirTableId || null,
    operator: defaultOperator,
    value: null,
    value2: null,
    valueSource: 'manual',
    selectorName: null,
    hideColumn: false
  })
  if (isRef && firstField?.dirTableId) {
    props.loadRefOptions(firstField.dirTableId)
  }
}

function removeLocalCondition(index) {
  localConditions.value.splice(index, 1)
}

function updateLocalConditionType(index) {
  const field = props.filterableFields?.find(f => f.id === localConditions.value[index].headerId)
  if (field) {
    localConditions.value[index].type = field.type
    localConditions.value[index].columnType = field.columnType || 'regular'
    localConditions.value[index].dirTableId = field.dirTableId || null
    localConditions.value[index].value = null
    localConditions.value[index].value2 = null
    const isRef = field.columnType === 'dir' || field.columnType === 'multi'
    localConditions.value[index].operator = isRef ? 'equals' : getDefaultOperatorForType(field.type)
    if (isRef && field.dirTableId) props.loadRefOptions(field.dirTableId)
  }
}

function toggleLocalValueSource(index) {
  const condition = localConditions.value[index]
  if (condition.valueSource === 'selector') {
    condition.valueSource = 'manual'
    condition.selectorName = null
  } else {
    condition.valueSource = 'selector'
    condition.value = null
    condition.value2 = null
    const knownSelectors = Object.keys(props.selectorState?.selectors || {})
    if (knownSelectors.length > 0) condition.selectorName = knownSelectors[0]
  }
}

function onApply() {
  emit('apply', localConditions.value.map(c => ({ ...c })))
}
</script>

<style scoped>
.filter-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem;
}

.filter-conditions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-condition-item {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface-card);
}

.condition-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.condition-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.condition-fields {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.field label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}
</style>

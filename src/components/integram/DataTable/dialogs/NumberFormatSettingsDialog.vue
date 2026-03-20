<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Настройки формата числа"
    :style="{ width: '600px' }"
    :modal="true"
    :dismissableMask="true"
    class="number-format-settings-dialog"
  >
    <div class="format-settings-content">
      <!-- Format Type Selector -->
      <div class="form-field">
        <label>Тип формата</label>
        <Dropdown
          v-model="localConfig.type"
          :options="formatTypes"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите тип"
          class="w-full"
          @change="onFormatTypeChange"
        >
          <template #option="slotProps">
            <div class="format-type-option">
              <i :class="slotProps.option.icon"></i>
              <div class="format-type-info">
                <span class="format-type-label">{{ slotProps.option.label }}</span>
                <span class="format-type-description">{{ slotProps.option.description }}</span>
              </div>
            </div>
          </template>
        </Dropdown>
      </div>

      <!-- Preview -->
      <div class="format-preview">
        <label>Предварительный просмотр</label>
        <div class="preview-box" v-html="previewHtml"></div>
      </div>

      <!-- Number Settings -->
      <template v-if="localConfig.type === 'number'">
        <div class="form-field">
          <label>Разделитель тысяч</label>
          <Dropdown
            v-model="localConfig.separator"
            :options="separatorOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите разделитель"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>Знаков после запятой</label>
          <InputNumber
            v-model="localConfig.decimals"
            :min="0"
            :max="10"
            showButtons
            class="w-full"
          />
        </div>
      </template>

      <!-- Currency Settings -->
      <template v-if="localConfig.type === 'currency'">
        <div class="form-field">
          <label>Валюта</label>
          <Dropdown
            v-model="localConfig.currency"
            :options="currencyOptions"
            optionLabel="label"
            optionValue="value"
            :filter="true"
            placeholder="Выберите валюту"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>Позиция символа</label>
          <Dropdown
            v-model="localConfig.currencyPosition"
            :options="[
              { label: 'До числа (₽ 1 234)', value: 'before' },
              { label: 'После числа (1 234 ₽)', value: 'after' }
            ]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>Разделитель тысяч</label>
          <Dropdown
            v-model="localConfig.separator"
            :options="separatorOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>Знаков после запятой</label>
          <InputNumber
            v-model="localConfig.decimals"
            :min="0"
            :max="10"
            showButtons
            class="w-full"
          />
        </div>
      </template>

      <!-- Percent Settings -->
      <template v-if="localConfig.type === 'percent'">
        <div class="form-field">
          <label>Знаков после запятой</label>
          <InputNumber
            v-model="localConfig.decimals"
            :min="0"
            :max="10"
            showButtons
            class="w-full"
          />
        </div>
        <div class="form-field form-field-checkbox">
          <Checkbox
            v-model="localConfig.divideBy100"
            :binary="true"
            inputId="divide100"
          />
          <label for="divide100">Умножить на 100 (для значений 0-1)</label>
        </div>
      </template>

      <!-- Progress Bar Settings -->
      <template v-if="localConfig.type === 'progress'">
        <div class="form-row">
          <div class="form-field">
            <label>Минимум</label>
            <InputNumber
              v-model="localConfig.min"
              class="w-full"
            />
          </div>
          <div class="form-field">
            <label>Максимум</label>
            <InputNumber
              v-model="localConfig.max"
              class="w-full"
            />
          </div>
        </div>
        <div class="form-field">
          <label>Цвет полосы</label>
          <div class="color-picker-wrapper">
            <input
              type="color"
              v-model="localConfig.color"
              class="color-input"
            />
            <InputText
              v-model="localConfig.color"
              placeholder="#4CAF50"
              class="color-text-input"
            />
          </div>
        </div>
        <div class="form-field form-field-checkbox">
          <Checkbox
            v-model="localConfig.showValue"
            :binary="true"
            inputId="showValue"
          />
          <label for="showValue">Показывать число рядом</label>
        </div>
      </template>

      <!-- Ring Settings -->
      <template v-if="localConfig.type === 'ring'">
        <div class="form-row">
          <div class="form-field">
            <label>Минимум</label>
            <InputNumber
              v-model="localConfig.min"
              class="w-full"
            />
          </div>
          <div class="form-field">
            <label>Максимум</label>
            <InputNumber
              v-model="localConfig.max"
              class="w-full"
            />
          </div>
        </div>
        <div class="form-field">
          <label>Цвет</label>
          <div class="color-picker-wrapper">
            <input
              type="color"
              v-model="localConfig.color"
              class="color-input"
            />
            <InputText
              v-model="localConfig.color"
              placeholder="#4CAF50"
              class="color-text-input"
            />
          </div>
        </div>
        <div class="form-field form-field-checkbox">
          <Checkbox
            v-model="localConfig.showValue"
            :binary="true"
            inputId="showValueRing"
          />
          <label for="showValueRing">Показывать число рядом</label>
        </div>
      </template>

      <!-- Stars Settings -->
      <template v-if="localConfig.type === 'stars'">
        <div class="form-field">
          <label>Максимум звёзд</label>
          <Dropdown
            v-model="localConfig.maxStars"
            :options="[
              { label: '5 звёзд', value: 5 },
              { label: '10 звёзд', value: 10 }
            ]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
      </template>

      <!-- Checkbox type has no settings -->
      <template v-if="localConfig.type === 'checkbox'">
        <div class="format-info">
          <i class="pi pi-info-circle"></i>
          <span>Этот формат преобразует 0 в ☐ и 1 в ☑. Нет дополнительных настроек.</span>
        </div>
      </template>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" @click="$emit('cancel')" text />
      <Button label="Сохранить" icon="pi pi-check" @click="save" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { formatNumber } from '@/utils/numberFormatter.js'

const props = defineProps({
  visible: Boolean,
  config: Object,
  sampleValue: {
    type: Number,
    default: 12345.67
  }
})

const emit = defineEmits(['update:visible', 'save', 'cancel'])

const formatTypes = [
  {
    value: 'number',
    label: 'Число',
    icon: 'pi pi-hashtag',
    description: 'Просто число с разделителями'
  },
  {
    value: 'currency',
    label: 'Деньги',
    icon: 'pi pi-dollar',
    description: 'С символом валюты'
  },
  {
    value: 'percent',
    label: 'Процент',
    icon: 'pi pi-percentage',
    description: 'Число с символом %'
  },
  {
    value: 'progress',
    label: 'Прогресс-бар',
    icon: 'pi pi-chart-bar',
    description: 'Горизонтальная полоса заполненности'
  },
  {
    value: 'ring',
    label: 'Круговая иконка',
    icon: 'pi pi-circle',
    description: 'SVG-кружок с заполнением'
  },
  {
    value: 'stars',
    label: 'Звёзды',
    icon: 'pi pi-star',
    description: 'Рейтинг звёздами'
  },
  {
    value: 'checkbox',
    label: 'Чекбокс',
    icon: 'pi pi-check-square',
    description: '0 → ☐, 1 → ☑'
  }
]

const separatorOptions = [
  { label: 'Пробел (1 234 567)', value: 'space' },
  { label: 'Запятая (1,234,567)', value: 'comma' },
  { label: 'Точка (1.234.567)', value: 'dot' },
  { label: 'Без разделителя (1234567)', value: 'none' }
]

const currencyOptions = [
  { label: '₽ Российский рубль (RUB)', value: 'RUB' },
  { label: '$ Доллар США (USD)', value: 'USD' },
  { label: '€ Евро (EUR)', value: 'EUR' },
  { label: '£ Фунт стерлингов (GBP)', value: 'GBP' },
  { label: '¥ Японская йена (JPY)', value: 'JPY' },
  { label: '¥ Китайский юань (CNY)', value: 'CNY' },
  { label: '₣ Швейцарский франк (CHF)', value: 'CHF' },
  { label: '₹ Индийская рупия (INR)', value: 'INR' },
  { label: '₩ Южнокорейская вона (KRW)', value: 'KRW' },
  { label: 'R$ Бразильский реал (BRL)', value: 'BRL' },
  { label: 'C$ Канадский доллар (CAD)', value: 'CAD' },
  { label: 'A$ Австралийский доллар (AUD)', value: 'AUD' }
]

const localConfig = ref({
  type: 'number',
  decimals: 0,
  separator: 'space',
  currency: 'RUB',
  currencyPosition: 'before',
  min: 0,
  max: 100,
  color: '#4CAF50',
  maxStars: 5,
  showValue: true,
  divideBy100: false
})

// Initialize from props
watch(() => props.config, (newConfig) => {
  if (newConfig) {
    localConfig.value = { ...localConfig.value, ...newConfig }
  }
}, { immediate: true })

// Update visibility
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    // Reset on close
    localConfig.value = {
      type: 'number',
      decimals: 0,
      separator: 'space',
      currency: 'RUB',
      currencyPosition: 'before',
      min: 0,
      max: 100,
      color: '#4CAF50',
      maxStars: 5,
      showValue: true,
      divideBy100: false,
      ...(props.config || {})
    }
  }
})

const onFormatTypeChange = () => {
  // Reset type-specific settings when format changes
  if (localConfig.value.type === 'progress' || localConfig.value.type === 'ring') {
    localConfig.value.min = 0
    localConfig.value.max = 100
    localConfig.value.color = '#4CAF50'
    localConfig.value.showValue = true
  } else if (localConfig.value.type === 'stars') {
    localConfig.value.maxStars = 5
  } else if (localConfig.value.type === 'percent') {
    localConfig.value.decimals = 0
    localConfig.value.divideBy100 = false
  }
}

// Preview HTML
const previewHtml = computed(() => {
  let value = props.sampleValue

  // Use different sample values for different types
  if (localConfig.value.type === 'percent') {
    value = localConfig.value.divideBy100 ? 0.7567 : 75.67
  } else if (localConfig.value.type === 'progress' || localConfig.value.type === 'ring') {
    value = 65
  } else if (localConfig.value.type === 'stars') {
    value = 3
  } else if (localConfig.value.type === 'checkbox') {
    value = 1
  }

  return formatNumber(value, localConfig.value)
})

const save = () => {
  emit('save', localConfig.value)
  emit('update:visible', false)
}
</script>

<style scoped>
.format-settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-weight: 500;
  font-size: 13px;
  color: var(--p-text-color, #374151);
}

.form-field-checkbox {
  flex-direction: row;
  align-items: center;
}

.form-field-checkbox label {
  margin-left: 8px;
  font-weight: normal;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.format-type-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.format-type-option i {
  font-size: 18px;
  color: var(--p-text-muted-color, #6b7280);
}

.format-type-info {
  display: flex;
  flex-direction: column;
}

.format-type-label {
  font-weight: 500;
  color: var(--p-text-color, #111827);
}

.format-type-description {
  font-size: 12px;
  color: var(--p-text-muted-color, #6b7280);
}

.format-preview {
  background: var(--p-content-hover-background, #f9fafb);
  border: 1px solid var(--p-content-border-color, #e5e7eb);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-preview label {
  font-weight: 500;
  font-size: 12px;
  color: var(--p-text-muted-color, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  font-size: 16px;
}

.color-picker-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  width: 48px;
  height: 38px;
  border: 1px solid var(--p-content-border-color, #d1d5db);
  border-radius: 4px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
}

.format-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--p-blue-50, #eff6ff);
  border: 1px solid var(--p-blue-200, #bfdbfe);
  border-radius: 6px;
  color: var(--p-blue-700, #1e40af);
  font-size: 13px;
  line-height: 1.5;
}

.format-info i {
  font-size: 16px;
  margin-top: 2px;
}
</style>

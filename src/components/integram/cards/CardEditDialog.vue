<template>
  <Dialog
    :visible="visible"
    :style="{ width: '92vw', maxWidth: '1160px' }"
    :modal="true"
    :closable="false"
    :draggable="false"
    :header="null"
    appendTo="body"
    @update:visible="$emit('update:visible', $event)"
    @hide="onCancel"
  >
    <template #container="{ closeCallback }">
      <div class="ced-root">

        <!-- ─── Cover ─── -->
        <div class="ced-cover" :class="{ 'ced-cover--image': hasCover, 'ced-cover--stripe': !hasCover }">
          <img
            v-if="coverImageUrl && !imageLoadFailed"
            :src="coverImageUrl"
            class="ced-cover-img"
            :style="{ objectPosition: coverPosition || 'center' }"
            alt=""
            loading="lazy"
            @error="onImageError"
          />
          <div v-else class="ced-cover-accent" :style="{ background: accentGradient }"></div>
          <button class="ced-close" :title="'Закрыть'" @click="closeCallback">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- ─── Title row ─── -->
        <div class="ced-title-row">
          <span class="ced-id-chip">#{{ card?.id }}</span>
          <InputText
            v-model="editTitleValue"
            class="ced-title-input"
            :placeholder="card?.title || 'Без названия'"
          />
        </div>

        <!-- ─── Body: loading / error / fields ─── -->
        <div class="ced-body">
          <div v-if="loading" class="ced-status-msg">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Загрузка...</span>
          </div>

          <div v-else-if="editError" class="ced-status-msg ced-status-msg--error">
            <i class="pi pi-exclamation-circle"></i>
            {{ editError }}
          </div>

          <div v-else class="ced-layout">

            <!-- LEFT: long/description fields -->
            <div v-if="longFields.length" class="ced-left">
              <div
                v-for="field in longFields"
                :key="field.id"
                class="ced-longfield"
              >
                <div class="ced-longfield-label">
                  <i class="pi pi-align-left"></i>
                  {{ field.name }}
                </div>
                <Textarea
                  v-model="editValues[field.id]"
                  :autoResize="true"
                  rows="4"
                  class="ced-longfield-input"
                  :placeholder="'Введите ' + field.name.toLowerCase() + '...'"
                />
              </div>
            </div>

            <!-- RIGHT: property rows -->
            <div class="ced-props" :class="{ 'ced-props--full': !longFields.length }">
              <template v-if="!shortFields.length && !longFields.length">
                <p class="ced-empty">Нет редактируемых полей</p>
              </template>

              <div
                v-for="field in shortFields"
                :key="field.id"
                class="ced-prop-row"
                :class="{ 'ced-prop-row--editing': activeField === field.id }"
                @click="openField(field)"
              >
                <span class="ced-prop-icon">
                  <i :class="fieldIcon(field)"></i>
                </span>
                <span class="ced-prop-label">{{ field.name }}</span>
                <div class="ced-prop-value-wrap" @click.stop>
                  <!-- Read mode -->
                  <span
                    v-if="activeField !== field.id"
                    class="ced-prop-value"
                    :class="{ 'ced-prop-value--empty': !displayValue(field) }"
                    @click="openField(field)"
                  >
                    <template v-if="field.baseType === 'REFERENCE' && refLabel(field)">
                      <Tag :value="refLabel(field)" class="ced-ref-tag" />
                    </template>
                    <template v-else>
                      {{ displayValue(field) || 'Не задано' }}
                    </template>
                  </span>

                  <!-- Edit mode -->
                  <div v-else class="ced-prop-editor" @click.stop>
                    <!-- NUMBER -->
                    <InputNumber
                      v-if="field.baseType === 'NUMBER'"
                      v-model="editValues[field.id]"
                      class="ced-prop-input"
                      :useGrouping="false"
                      autofocus
                      @keydown.escape="closeField"
                      @keydown.enter="closeField"
                    />
                    <!-- DATE -->
                    <DatePicker
                      v-else-if="field.baseType === 'DATE' || field.baseType === 'DATETIME'"
                      v-model="editValues[field.id]"
                      dateFormat="dd.mm.yy"
                      class="ced-prop-input"
                      showIcon
                      autofocus
                      @keydown.escape="closeField"
                    />
                    <!-- REFERENCE -->
                    <Select
                      v-else-if="field.baseType === 'REFERENCE'"
                      v-model="editValues[field.id]"
                      :options="field.options || []"
                      optionLabel="label"
                      optionValue="value"
                      :filter="true"
                      :showClear="true"
                      class="ced-prop-input"
                      placeholder="Выберите..."
                      autofocus
                      @keydown.escape="closeField"
                    />
                    <!-- SHORT text -->
                    <InputText
                      v-else
                      ref="shortInputRef"
                      v-model="editValues[field.id]"
                      class="ced-prop-input"
                      @keydown.escape="closeField"
                      @keydown.enter="closeField"
                    />
                    <button class="ced-prop-confirm" @click.stop="closeField">
                      <i class="pi pi-check"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── Footer ─── -->
        <div class="ced-footer">
          <Button
            label="Удалить"
            icon="pi pi-trash"
            severity="danger"
            text
            :loading="deleting"
            @click="onDelete"
          />
          <div class="ced-footer-right">
            <Button label="Отмена" icon="pi pi-times" text @click="onCancel" />
            <Button
              label="Сохранить"
              icon="pi pi-check"
              :loading="saving"
              @click="onSave"
            />
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import integramApiClient from '@/services/integramApiClient'
import { ensureKvalProxy } from '@/services/integramKvalProxyService'
import { integramEventBus } from '@/services/integramEventBus'
import { useIntegramSync } from '@/composables/useIntegramSync'
const integramSync = useIntegramSync()

// Reused from CardItem.vue
const IMAGE_URL_RE = /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff?)(\?.*)?$/i
// prettier-ignore
const IMAGE_CDN_RE = /^https?:\/\/(avatars\.mds\.yandex\.net|avatars\.yandex\.net|sun\d+-\d+\.userapi\.com|pp\.userapi\.com|lh\d+\.googleusercontent\.com|cdn\d*\.telegram\.org|storage\.googleapis\.com|[^/]+\.s3\.amazonaws\.com|[^/]+\.cloudfront\.net|img\.freepik\.com|images\.unsplash\.com|cdn\.pixabay\.com|[^/]+\.twimg\.com|[^/]+\.fbcdn\.net)\/.*/i
const SEARCH_PAGE_RE = /\/(search|images\/search|поиск)\?/i
const IMAGE_KEYWORDS = ['image', 'img', 'photo', 'фото', 'изображение', 'картинка', 'picture']

const FLAT_COLORS = [
  ['#6366f1', '#8b5cf6'],
  ['#8b5cf6', '#ec4899'],
  ['#ec4899', '#ef4444'],
  ['#ef4444', '#f97316'],
  ['#f97316', '#eab308'],
  ['#22c55e', '#14b8a6'],
  ['#14b8a6', '#0ea5e9'],
  ['#0ea5e9', '#3b82f6'],
  ['#3b82f6', '#6366f1'],
  ['#6366f1', '#ec4899'],
]

function isImageUrl(value) {
  if (typeof value !== 'string') return false
  if (SEARCH_PAGE_RE.test(value)) return false
  if (IMAGE_URL_RE.test(value)) return true
  if (IMAGE_CDN_RE.test(value)) return true
  return false
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  card: { type: Object, default: null },
  database: { type: String, required: true },
  tableId: { type: [String, Number], required: true },
  coverPosition: { type: String, default: 'center' }
})

const emit = defineEmits(['update:visible', 'saved', 'deleted', 'cancel'])

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editError = ref('')
const editValues = ref({})
const editableFields = ref([])
const editTitleValue = ref('')
const imageLoadFailed = ref(false)
const activeField = ref(null)
const shortInputRef = ref(null)

function onImageError() {
  imageLoadFailed.value = true
}

const coverImageUrl = computed(() => {
  const card = props.card
  if (!card) return null
  imageLoadFailed.value = false
  const fields = card.fields || []
  for (const f of fields) {
    const alias = (f.alias || f.name || '').toLowerCase()
    if (IMAGE_KEYWORDS.some(kw => alias.includes(kw)) && isImageUrl(f.value)) return f.value
  }
  for (const f of fields) {
    if (isImageUrl(f.value)) return f.value
  }
  if (card.reqs) {
    for (const [, req] of Object.entries(card.reqs)) {
      const alias = (req.alias || req.name || '').toLowerCase()
      const val = req.value || (typeof req === 'string' ? req : '')
      if (IMAGE_KEYWORDS.some(kw => alias.includes(kw)) && isImageUrl(val)) return val
    }
    for (const [, req] of Object.entries(card.reqs)) {
      const val = req.value || (typeof req === 'string' ? req : '')
      if (isImageUrl(val)) return val
    }
  }
  return null
})

const accentGradient = computed(() => {
  if (!props.card) return 'linear-gradient(135deg, #6366f1, #8b5cf6)'
  const pair = FLAT_COLORS[parseInt(props.card.id) % FLAT_COLORS.length]
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`
})

const hasCover = computed(() => !!(coverImageUrl.value && !imageLoadFailed.value))

// Split fields into long (left panel) and short (right panel)
const longFields = computed(() => editableFields.value.filter(f => f.isLong))
const shortFields = computed(() => editableFields.value.filter(f => !f.isLong))

function fieldIcon(field) {
  switch (field.baseType) {
    case 'NUMBER': return 'pi pi-hashtag'
    case 'DATE': return 'pi pi-calendar'
    case 'DATETIME': return 'pi pi-calendar-clock'
    case 'REFERENCE': return 'pi pi-link'
    case 'MEMO': return 'pi pi-align-left'
    default: return 'pi pi-pencil'
  }
}

function displayValue(field) {
  const v = editValues.value[field.id]
  if (v === null || v === undefined || v === '') return ''
  if (field.baseType === 'DATE' && v instanceof Date) {
    return v.toLocaleDateString('ru-RU')
  }
  if (field.baseType === 'REFERENCE') {
    return refLabel(field) || String(v)
  }
  return String(v)
}

function refLabel(field) {
  const v = editValues.value[field.id]
  if (!v || !field.options?.length) return null
  const opt = field.options.find(o => o.value === String(v))
  return opt?.label || null
}

function openField(field) {
  activeField.value = field.id
  nextTick(() => {
    if (shortInputRef.value) {
      if (Array.isArray(shortInputRef.value)) shortInputRef.value[0]?.focus()
      else shortInputRef.value?.focus()
    }
  })
}

function closeField() {
  activeField.value = null
}

watch(() => props.visible, async (vis) => {
  if (vis && props.card) {
    imageLoadFailed.value = false
    activeField.value = null
    await loadCardData(props.card)
  }
}, { immediate: false })

async function loadCardData(card) {
  loading.value = true
  editError.value = ''
  editValues.value = {}
  editableFields.value = []
  editTitleValue.value = card.title || ''

  try {
    if (props.database === 'kval') {
      await ensureKvalProxy()
    } else if (props.database && integramApiClient.database !== props.database) {
      await integramApiClient.switchDatabase(props.database)
    }
    const data = await integramApiClient.getObjectEditData(card.id)

    const reqs = data.reqs || {}
    const BASE_TYPE_MAP = { 2: 'MEMO', 3: 'SHORT', 4: 'DATETIME', 5: 'DATE', 6: 'TIME', 7: 'BUTTON', 8: 'REFERENCE', 13: 'NUMBER' }
    function resolveBaseType(raw) {
      if (!raw) return 'SHORT'
      if (typeof raw === 'number') return BASE_TYPE_MAP[raw] || 'SHORT'
      const s = String(raw).toUpperCase()
      return BASE_TYPE_MAP[parseInt(raw)] || s
    }
    function resolveFieldName(reqData) {
      const attrs = reqData.attrs || ''
      const m = attrs.match(/:ALIAS=([^:]+):/)
      return m ? m[1] : (reqData.type || '')
    }

    if (data.req_order && data.req_order.length > 0) {
      const reqOrder = data.req_order
      const reqTypes = data.req_type || {}
      const reqBase = data.req_base || {}
      const refType = data.ref_type || {}
      editableFields.value = reqOrder
        .filter(rid => reqTypes[rid])
        .map(rid => {
          const baseType = resolveBaseType(reqBase[rid])
          const isReference = !!refType[rid]
          return {
            id: String(rid),
            name: reqTypes[rid],
            isLong: baseType === 'MEMO' || baseType === 'LONG',
            baseType: isReference ? 'REFERENCE' : baseType,
            refTypeId: refType[rid] || null,
            options: []
          }
        })
    } else {
      editableFields.value = Object.entries(reqs)
        .filter(([, rd]) => rd && !rd.arr_type && rd.base !== 'BUTTON' && rd.base !== '7')
        .sort((a, b) => parseInt(a[1].order || 0) - parseInt(b[1].order || 0))
        .map(([reqId, rd]) => {
          const isReference = !!rd.ref_type
          const baseType = isReference ? 'REFERENCE' : resolveBaseType(rd.base)
          return {
            id: reqId,
            name: resolveFieldName(rd) || rd.type || reqId,
            isLong: baseType === 'MEMO' || baseType === 'LONG',
            baseType,
            refTypeId: rd.ref_type ? String(rd.ref_type) : null,
            options: []
          }
        })
    }

    for (const field of editableFields.value) {
      const reqData = reqs[field.id]
      let rawVal = (reqData !== null && reqData !== undefined && typeof reqData === 'object')
        ? (reqData.value ?? reqData.val ?? null)
        : reqData ?? null

      if (field.baseType === 'REFERENCE' && reqData && typeof reqData === 'object') {
        const rdRef = reqData.ref
        console.log(`[CardEditDialog] REFERENCE field=${field.id} rdRef=`, rdRef, 'reqData.value=', reqData.value)
        if (rdRef !== null && rdRef !== undefined && rdRef !== '' && rdRef !== '0' && rdRef !== 0) {
          const parts = String(rdRef).split(':')
          const parsedId = parts[parts.length - 1]
          rawVal = parsedId && parsedId !== '0' ? parsedId : null
        } else {
          const cardField = Array.isArray(card.fields)
            ? card.fields.find(f => String(f.id) === String(field.id))
            : null
          const fallbackVal = cardField?.value || null
          rawVal = fallbackVal && fallbackVal !== '0' ? fallbackVal : null
          console.log(`[CardEditDialog] REFERENCE field=${field.id} fallback from card.fields:`, fallbackVal, '→ rawVal=', rawVal)
        }
      }

      if (field.baseType === 'NUMBER') {
        editValues.value[field.id] = rawVal != null ? Number(rawVal) : null
      } else if (field.baseType === 'DATE' || field.baseType === 'DATETIME') {
        editValues.value[field.id] = rawVal ? new Date(rawVal) : null
      } else if (field.baseType === 'REFERENCE') {
        editValues.value[field.id] = rawVal != null && rawVal !== '' ? String(rawVal) : null
      } else {
        editValues.value[field.id] = rawVal != null ? String(rawVal) : ''
      }
    }

    for (const field of editableFields.value) {
      if (field.baseType === 'REFERENCE' && field.refTypeId) {
        try {
          const refData = await integramApiClient.getReferenceOptions(field.id, card.id)
          if (refData && typeof refData === 'object' && !Array.isArray(refData)) {
            field.options = Object.entries(refData).map(([id, label]) => ({
              label: typeof label === 'object' ? (label.val || String(id)) : String(label),
              value: String(id)
            }))
            const currentVal = editValues.value[field.id]
            const directMatch = field.options.find(o => o.value === currentVal)
            if (!directMatch && currentVal) {
              const labelMatch = field.options.find(o => o.label === currentVal)
              if (labelMatch) editValues.value[field.id] = labelMatch.value
            }
            console.log(`[CardEditDialog] field=${field.id} options=${field.options.length} currentVal=${currentVal} directMatch=${!!directMatch}`)
          }
        } catch (refErr) {
          console.warn(`[CardEditDialog] Failed to load reference options for field ${field.id}:`, refErr?.message || refErr)
        }
      }
    }
  } catch (e) {
    editError.value = `Ошибка загрузки: ${e.message}`
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!props.card) return
  saving.value = true
  try {
    if (props.database === 'kval') {
      await ensureKvalProxy()
    } else if (props.database && integramApiClient.database !== props.database) {
      await integramApiClient.switchDatabase(props.database)
    }
    const requisites = {}
    for (const field of editableFields.value) {
      let val = editValues.value[field.id]
      if (field.baseType === 'DATE' && val instanceof Date) {
        const y = val.getFullYear()
        const m = String(val.getMonth() + 1).padStart(2, '0')
        const d = String(val.getDate()).padStart(2, '0')
        val = `${y}-${m}-${d}`
      }
      if (field.baseType === 'REFERENCE' && (val === null || val === undefined)) continue
      requisites[String(field.id)] = val != null ? String(val) : ''
    }
    const newTitle = editTitleValue.value.trim()
    if (newTitle && newTitle !== (props.card.title || '')) {
      await integramApiClient.saveObject(props.card.id, props.tableId, newTitle)
    }
    await integramApiClient.setObjectRequisites(props.card.id, requisites)
    const displayLabels = {}
    for (const field of editableFields.value) {
      if (field.baseType === 'REFERENCE' && field.options && requisites[String(field.id)]) {
        const opt = field.options.find(o => o.value === requisites[String(field.id)])
        if (opt) displayLabels[String(field.id)] = opt.label
      }
    }
    integramEventBus.emit('object:updated', {
      database: props.database,
      typeId: String(props.tableId),
      objectId: props.card.id,
      requisites,
      displayLabels: Object.keys(displayLabels).length > 0 ? displayLabels : undefined
    })
    integramSync.publish('object:updated', { database: props.database, typeId: String(props.tableId), objectId: props.card.id, requisites })
    emit('saved', { cardId: props.card.id, values: requisites, title: newTitle || props.card.title })
    emit('update:visible', false)
  } catch (e) {
    editError.value = `Ошибка сохранения: ${e.message}`
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!props.card) return
  deleting.value = true
  try {
    if (props.database === 'kval') {
      await ensureKvalProxy()
    } else if (props.database && integramApiClient.database !== props.database) {
      await integramApiClient.switchDatabase(props.database)
    }
    await integramApiClient.deleteObject(props.card.id)
    integramEventBus.emit('object:deleted', {
      database: props.database,
      typeId: String(props.tableId),
      objectId: props.card.id
    })
    integramSync.publish('object:deleted', { database: props.database, typeId: String(props.tableId), objectId: props.card.id })
    emit('deleted', props.card.id)
    emit('update:visible', false)
  } catch (e) {
    editError.value = `Ошибка удаления: ${e.message}`
  } finally {
    deleting.value = false
  }
}

function onCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════
   Root container
   ═══════════════════════════════════════════════════════ */
.ced-root {
  display: flex;
  flex-direction: column;
  border-radius: var(--p-dialog-border-radius, 12px);
  overflow: hidden;
  background: var(--p-dialog-background, var(--p-content-background, #fff));
  min-height: 560px;
  max-height: 90vh;
}

/* ═══════════════════════════════════════════════════════
   Cover
   ═══════════════════════════════════════════════════════ */
.ced-cover {
  position: relative;
  width: 100%;
  flex-shrink: 0;
}

.ced-cover--image {
  height: 240px;
}

.ced-cover--stripe {
  height: 8px;
}

.ced-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ced-cover-accent {
  width: 100%;
  height: 100%;
  min-height: 8px;
}

.ced-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.4);
  color: var(--p-primary-contrast-color, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: background 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 10;
  backdrop-filter: blur(4px);
}

.ced-cover--stripe .ced-close {
  top: 50%;
  transform: translateY(-50%);
  background: var(--p-content-hover-background, #f1f5f9);
  color: var(--p-text-muted-color, #64748b);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.ced-close:hover {
  background: rgba(0, 0, 0, 0.6);
}

.ced-cover--stripe .ced-close:hover {
  background: var(--p-content-border-color, #e2e8f0);
}

/* ═══════════════════════════════════════════════════════
   Title row
   ═══════════════════════════════════════════════════════ */
.ced-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 28px 10px;
  flex-shrink: 0;
}

.ced-id-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color, #94a3b8);
  background: var(--p-content-hover-background, #f1f5f9);
  border-radius: 6px;
  padding: 3px 9px;
  flex-shrink: 0;
  letter-spacing: 0.3px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
}

.ced-title-input {
  flex: 1;
  font-size: 22px !important;
  font-weight: 700 !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--p-text-color, #0f172a) !important;
  padding: 2px 4px !important;
  outline: none !important;
  box-shadow: none !important;
  transition: border-color 0.15s !important;
  font-family: inherit !important;
  line-height: 1.3 !important;
}

.ced-title-input:focus {
  border-bottom-color: var(--p-primary-color, #6366f1) !important;
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 4%, transparent) !important;
  border-radius: 6px 6px 0 0 !important;
}

/* ═══════════════════════════════════════════════════════
   Body
   ═══════════════════════════════════════════════════════ */
.ced-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 20px;
  min-height: 0;
}

.ced-status-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 32px;
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 14px;
}

.ced-status-msg--error {
  color: var(--p-red-500, #ef4444);
}

/* ─── Two-panel layout ─── */
.ced-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 0 24px;
  align-items: start;
}

/* ─── Left panel: long text fields ─── */
.ced-left {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0;
}

.ced-longfield-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #94a3b8);
  margin-bottom: 6px;
}

.ced-longfield-label .pi {
  font-size: 12px;
}

.ced-longfield-input {
  width: 100%;
  font-size: 14px;
  line-height: 1.6;
  border-radius: 8px;
  resize: none;
}

/* ─── Right panel: property rows ─── */
.ced-props {
  border-left: 1px solid var(--p-content-border-color, #e2e8f0);
  padding: 8px 0 8px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ced-props--full {
  border-left: none;
  padding-left: 0;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 4px 16px;
}

.ced-empty {
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 13px;
  padding: 12px 0;
}

/* ─── Property row ─── */
.ced-prop-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-height: 40px;
  border-radius: 8px;
  transition: background 0.12s;
  cursor: pointer;
  padding: 6px 8px;
  position: relative;
}

.ced-prop-row:hover {
  background: var(--p-content-hover-background, #f8fafc);
}

.ced-prop-row--editing {
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 6%, transparent);
}

.ced-prop-icon {
  width: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 13px;
  margin-top: 2px;
}

.ced-prop-label {
  width: 100px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--p-text-muted-color, #64748b);
  line-height: 1.4;
  padding-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ced-prop-value-wrap {
  flex: 1;
  min-width: 0;
}

.ced-prop-value {
  display: block;
  font-size: 13px;
  color: var(--p-text-color, #1e293b);
  padding: 2px 6px;
  border-radius: 4px;
  min-height: 26px;
  line-height: 1.5;
  word-break: break-word;
}

.ced-prop-value--empty {
  color: var(--p-text-muted-color, #cbd5e1);
  font-style: italic;
}

.ced-ref-tag {
  font-size: 11px !important;
}

/* Edit mode in property row */
.ced-prop-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ced-prop-input {
  flex: 1;
  font-size: 13px !important;
  height: 32px !important;
  min-height: 32px !important;
}

.ced-prop-input :deep(input),
.ced-prop-input:not(.p-select) {
  font-size: 13px !important;
  height: 32px !important;
  padding: 4px 8px !important;
}

.ced-prop-confirm {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--p-primary-color, #6366f1);
  color: var(--p-primary-contrast-color, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
  transition: background 0.12s;
}

.ced-prop-confirm:hover {
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 80%, black);
}

/* ═══════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════ */
.ced-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  border-top: 1px solid var(--p-content-border-color, #e2e8f0);
  flex-shrink: 0;
  background: var(--p-content-hover-background, #fafafa);
}

.ced-footer-right {
  display: flex;
  gap: 8px;
}

/* ═══════════════════════════════════════════════════════
   Responsive: narrow screens → single column
   ═══════════════════════════════════════════════════════ */
@media (max-width: 700px) {
  .ced-layout {
    grid-template-columns: 1fr;
  }

  .ced-props {
    border-left: none;
    border-top: 1px solid var(--p-content-border-color, #e2e8f0);
    padding: 12px 0 0;
    margin-top: 8px;
  }
}
</style>

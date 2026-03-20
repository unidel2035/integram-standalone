<template>
  <div
    class="card-item"
    :class="[`size-${size}`, { 'is-dragging': isDragging, 'drag-over': isDragOver }]"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    @dblclick="onCardDblClick"
    @click="$emit('click', card)"
  >
    <!-- Image header (if image URL detected and showImage is on) -->
    <div v-if="showImage && cardImageUrl && !imageLoadFailed" class="card-image-header">
      <img :src="cardImageUrl" class="card-cover-img" alt="" loading="lazy" @error="onImageError" />
    </div>

    <!-- Flat color header (no image, image disabled, or image failed to load) -->
    <div v-else-if="showImage" class="card-color-header" :style="{ background: stripeColor }"></div>

    <!-- Legacy narrow stripe (when showImage is off entirely) -->
    <div v-else class="card-stripe" :style="{ background: stripeColor }"></div>

    <div class="card-body">
      <!-- Card header: ID + title -->
      <div class="card-header">
        <span class="card-id">#{{ card.id }}</span>
        <!-- Inline-editable title -->
        <span
          v-if="!editingTitle"
          class="card-title"
          :title="card.title || '—'"
          @dblclick.stop="startEditTitle"
        >{{ card.title || '—' }}</span>
        <input
          v-else
          ref="titleInputRef"
          v-model="editTitleValue"
          class="card-title-input"
          @blur="saveTitle"
          @keydown.enter.prevent="saveTitle"
          @keydown.escape.prevent="cancelEditTitle"
          @click.stop
          @dblclick.stop
        />
      </div>

      <!-- Fields (based on size) -->
      <div v-if="size !== 'S' && visibleFields.length" class="card-fields">
        <div
          v-for="f in visibleFields"
          :key="f.id"
          class="card-field"
        >
          <span class="field-label">{{ f.name }}</span>
          <span
            v-if="editingFieldId !== f.id"
            class="field-value"
            :class="{ 'long-text': f.isLong }"
            @dblclick.stop="startEditField(f)"
          >
            {{ truncate(f.value, size === 'L' ? 120 : 60) }}
          </span>
          <input
            v-else
            :ref="el => { if (el) fieldInputRefs[f.id] = el }"
            v-model="editFieldValue"
            class="card-field-input"
            @blur="saveField(f)"
            @keydown.enter.prevent="saveField(f)"
            @keydown.escape.prevent="cancelEditField"
            @click.stop
            @dblclick.stop
          />
        </div>
      </div>
    </div>

    <!-- Inline edit action buttons (shown when editing) -->
    <div v-if="editingTitle || editingFieldId !== null" class="card-inline-actions" @click.stop>
      <button class="inline-action-btn confirm-btn" title="Сохранить" @click.stop="confirmEdit">
        <i class="pi pi-check"></i>
      </button>
      <button class="inline-action-btn cancel-btn" title="Отменить" @click.stop="cancelAll">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'

const FLAT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6',
]

// Standard image URL: must have a recognized file extension before optional query string
const IMAGE_URL_RE = /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff?)(\?.*)?$/i

// Well-known CDN hosts that serve images without file extensions
// prettier-ignore
const IMAGE_CDN_RE = /^https?:\/\/(avatars\.mds\.yandex\.net|avatars\.yandex\.net|sun\d+-\d+\.userapi\.com|pp\.userapi\.com|lh\d+\.googleusercontent\.com|cdn\d*\.telegram\.org|storage\.googleapis\.com|[^/]+\.s3\.amazonaws\.com|[^/]+\.cloudfront\.net|img\.freepik\.com|images\.unsplash\.com|cdn\.pixabay\.com|[^/]+\.twimg\.com|[^/]+\.fbcdn\.net)\/.*/i

// URLs that look like search pages — should NOT be treated as images
const SEARCH_PAGE_RE = /\/(search|images\/search|поиск)\?/i

const IMAGE_KEYWORDS = ['image', 'img', 'photo', 'фото', 'изображение', 'картинка', 'picture']

function isImageUrl(value, anyUrl = false) {
  if (typeof value !== 'string') return false
  // Exclude search/browse pages regardless of other rules
  if (SEARCH_PAGE_RE.test(value)) return false
  // Standard extension-based match
  if (IMAGE_URL_RE.test(value)) return true
  // Known CDN host without extension
  if (IMAGE_CDN_RE.test(value)) return true
  // Optional: treat any https URL as image
  if (anyUrl && /^https?:\/\/.+/.test(value)) return true
  return false
}

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: 'M' }, // S, M, L
  visibleFieldIds: { type: Array, default: () => [] },
  stripeColor: { type: String, default: null },
  // imageField: explicit field id to use as image (null = auto-detect)
  imageField: { type: String, default: null },
  // showImage: whether to show image/color header (true by default)
  showImage: { type: Boolean, default: true },
  // anyUrlAsImage: treat any https:// URL as an image URL
  anyUrlAsImage: { type: Boolean, default: false }
})

const emit = defineEmits(['click', 'edit', 'drag-start', 'drop', 'inline-save'])

const isDragging = ref(false)
const isDragOver = ref(false)
const imageLoadFailed = ref(false)

function onImageError() {
  imageLoadFailed.value = true
}

// ─── Inline editing state ──────────────────────────────────────────────────────
const editingTitle = ref(false)
const editTitleValue = ref('')
const titleInputRef = ref(null)

const editingFieldId = ref(null)
const editFieldValue = ref('')
const fieldInputRefs = {}

function onCardDblClick(e) {
  // If not clicking on a specific editable element, open the edit dialog
  if (!editingTitle.value && editingFieldId.value === null) {
    emit('edit', props.card)
  }
}

function startEditTitle() {
  // Cancel any field edit in progress
  editingFieldId.value = null
  editFieldValue.value = ''

  editTitleValue.value = props.card.title || ''
  editingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

async function saveTitle() {
  if (!editingTitle.value) return
  const newVal = editTitleValue.value.trim()
  editingTitle.value = false
  if (newVal === (props.card.title || '').trim()) return
  emit('inline-save', { fieldId: null, value: newVal })
}

function cancelEditTitle() {
  editingTitle.value = false
  editTitleValue.value = ''
}

function startEditField(field) {
  // Cancel title edit in progress
  if (editingTitle.value) {
    editingTitle.value = false
    editTitleValue.value = ''
  }

  editingFieldId.value = field.id
  editFieldValue.value = field.value || ''
  nextTick(() => {
    const el = fieldInputRefs[field.id]
    if (el) {
      el.focus()
      el.select()
    }
  })
}

async function saveField(field) {
  if (editingFieldId.value !== field.id) return
  const newVal = editFieldValue.value
  editingFieldId.value = null
  editFieldValue.value = ''
  if (newVal === (field.value || '')) return
  emit('inline-save', { fieldId: field.id, value: newVal })
}

function cancelEditField() {
  editingFieldId.value = null
  editFieldValue.value = ''
}

function cancelAll() {
  cancelEditTitle()
  cancelEditField()
}

function confirmEdit() {
  if (editingTitle.value) {
    saveTitle()
  } else if (editingFieldId.value !== null) {
    const field = visibleFields.value.find(f => f.id === editingFieldId.value)
    if (field) saveField(field)
  }
}

// Compute resolved stripe color (flat color by id if no color given)
const resolvedStripeColor = computed(() => {
  if (props.stripeColor) return props.stripeColor
  return FLAT_COLORS[parseInt(props.card.id) % FLAT_COLORS.length]
})

// Expose stripeColor (overridable via prop, fallback to flat color)
// Used in template as stripeColor (prop), but we compute the card color header
const cardColorHeader = computed(() => resolvedStripeColor.value)

// Detect image URL from card fields
const cardImageUrl = computed(() => {
  if (!props.card.reqs && !props.card.fields) return null
  // Reset error state when URL recomputes
  imageLoadFailed.value = false

  const anyUrl = props.anyUrlAsImage

  // If explicit imageField provided, try it first
  if (props.imageField) {
    // Check in reqs object
    if (props.card.reqs) {
      const req = props.card.reqs[props.imageField]
      if (req && isImageUrl(req.value || req, anyUrl)) return req.value || req
    }
    // Check in fields array
    if (props.card.fields) {
      const f = props.card.fields.find(f => f.id === props.imageField)
      if (f && isImageUrl(f.value, anyUrl)) return f.value
    }
  }

  // Auto-detect: first try fields with image-like alias/name
  const fields = props.card.fields || []
  for (const f of fields) {
    const alias = (f.alias || f.name || '').toLowerCase()
    if (IMAGE_KEYWORDS.some(kw => alias.includes(kw)) && isImageUrl(f.value, anyUrl)) {
      return f.value
    }
  }

  // Auto-detect: any field whose value is an image URL
  for (const f of fields) {
    if (isImageUrl(f.value, anyUrl)) return f.value
  }

  // Check reqs object format
  if (props.card.reqs) {
    for (const [, req] of Object.entries(props.card.reqs)) {
      const alias = (req.alias || req.name || '').toLowerCase()
      const val = req.value || (typeof req === 'string' ? req : '')
      if (IMAGE_KEYWORDS.some(kw => alias.includes(kw)) && isImageUrl(val, anyUrl)) {
        return val
      }
    }
    for (const [, req] of Object.entries(props.card.reqs)) {
      const val = req.value || (typeof req === 'string' ? req : '')
      if (isImageUrl(val, anyUrl)) return val
    }
  }

  return null
})

const visibleFields = computed(() => {
  const fields = props.card.fields || []
  if (!props.visibleFieldIds.length) {
    // Show top N fields depending on size
    const limit = props.size === 'L' ? 6 : props.size === 'M' ? 3 : 0
    return fields.filter(f => f.value).slice(0, limit)
  }
  return fields.filter(f => props.visibleFieldIds.includes(f.id) && f.value)
})

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '…' : (s || '')
}

function onDragStart(e) {
  isDragging.value = true
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: props.card.id }))
  emit('drag-start', props.card)
}

function onDragEnd() {
  isDragging.value = false
}

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e) {
  e.stopPropagation()
  isDragOver.value = false
  const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}')
  emit('drop', { draggedCardId: data.cardId, targetCardId: props.card.id })
}
</script>

<style scoped>
.card-item {
  display: flex;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  background: var(--p-content-background, white);
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
  flex-direction: column;
  user-select: none;
  position: relative;
}

.card-item:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--p-primary-color, #6366f1) 40%, transparent);
}

.card-item.is-dragging {
  opacity: 0.5;
  transform: rotate(2deg);
}

.card-item.drag-over {
  border-color: var(--p-primary-color, #6366f1);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color, #6366f1) 30%, transparent);
}

/* Size variants */
.size-S {
  min-height: 60px;
}

.size-M {
  min-height: 100px;
}

.size-L {
  min-height: 180px;
}

/* ─── Legacy narrow stripe (showImage=false) ─── */
.card-stripe {
  width: 100%;
  height: 4px;
  flex-shrink: 0;
}

/* ─── Flat color header ─── */
.card-color-header {
  width: 100%;
  height: 80px;
  flex-shrink: 0;
}

.size-S .card-color-header {
  height: 48px;
}

.size-L .card-color-header {
  height: 120px;
}

/* ─── Image header ─── */
.card-image-header {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  flex-shrink: 0;
}

.size-S .card-image-header {
  aspect-ratio: 4 / 2;
}

.card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.card-item:hover .card-cover-img {
  transform: scale(1.03);
}

/* ─── Body ─── */
.card-body {
  padding: 8px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.size-S .card-body {
  padding: 6px 10px;
}

.size-L .card-body {
  padding: 12px 14px;
  gap: 8px;
}

.card-header {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.card-id {
  font-size: 10px;
  color: var(--p-text-muted-color, #94a3b8);
  flex-shrink: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  cursor: text;
}

.size-L .card-title {
  font-size: 14px;
  white-space: normal;
}

/* ─── Inline edit inputs ─── */
.card-title-input {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  background: var(--p-content-background, white);
  border: 1px solid var(--p-primary-color, #6366f1);
  border-radius: 4px;
  padding: 2px 6px;
  flex: 1;
  min-width: 0;
  outline: none;
  font-family: inherit;
  user-select: text;
}

.size-L .card-title-input {
  font-size: 14px;
}

.card-field-input {
  font-size: 11px;
  color: var(--p-text-color, #1e293b);
  background: var(--p-content-background, white);
  border: 1px solid var(--p-primary-color, #6366f1);
  border-radius: 3px;
  padding: 1px 4px;
  width: 100%;
  outline: none;
  font-family: inherit;
  user-select: text;
  flex: 1;
}

.size-L .card-field-input {
  font-size: 12px;
}

/* ─── Inline action buttons ─── */
.card-inline-actions {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  z-index: 2;
}

.inline-action-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: background 0.12s;
}

.confirm-btn {
  background: var(--p-primary-color, #6366f1);
  color: white;
}

.confirm-btn:hover {
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 80%, black);
}

.cancel-btn {
  background: var(--p-content-hover-background, #f1f5f9);
  color: var(--p-text-muted-color, #64748b);
}

.cancel-btn:hover {
  background: var(--p-content-border-color, #e2e8f0);
}

.card-fields {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}

.card-field {
  display: flex;
  gap: 6px;
  font-size: 11px;
  align-items: baseline;
}

.size-L .card-field {
  font-size: 12px;
  flex-direction: column;
  gap: 2px;
}

.field-label {
  color: var(--p-text-muted-color, #94a3b8);
  flex-shrink: 0;
  min-width: 50px;
  font-weight: 500;
}

.size-L .field-label {
  min-width: auto;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.4px;
}

.field-value {
  color: var(--p-text-muted-color, #475569);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  flex: 1;
}

.size-L .field-value {
  white-space: normal;
  word-break: break-word;
}

.field-value.long-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 10px;
}
</style>

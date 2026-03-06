<template>
  <Dialog
    v-model:visible="isVisible"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="room-creation-dialog"
    :style="{ width: '600px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <i class="pi pi-plus-circle mr-2"></i>
        <span>Создать комнату</span>
      </div>
    </template>

    <div class="room-creation-content">
      <!-- Room Name -->
      <div class="form-field">
        <label for="roomName" class="field-label">
          Название комнаты <span class="required">*</span>
        </label>
        <InputText
          id="roomName"
          v-model="formData.name"
          placeholder="Введите название комнаты"
          class="w-full"
          :class="{ 'p-invalid': errors.name }"
          @input="clearError('name')"
        />
        <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
      </div>

      <!-- Room Description -->
      <div class="form-field">
        <label for="roomDescription" class="field-label">Описание</label>
        <Textarea
          id="roomDescription"
          v-model="formData.description"
          placeholder="Краткое описание комнаты (опционально)"
          rows="3"
          class="w-full"
        />
      </div>

      <!-- Room Type - Modern Cards -->
      <div class="form-field">
        <label class="field-label">
          Тип комнаты <span class="required">*</span>
        </label>
        <div class="room-type-cards">
          <div
            v-for="type in roomTypes"
            :key="type.value"
            class="room-type-card"
            :class="{ 'selected': formData.type === type.value }"
            @click="selectRoomType(type.value)"
          >
            <i :class="type.icon" class="type-icon"></i>
            <div class="type-info">
              <div class="type-label">{{ type.label }}</div>
              <small class="type-description">{{ type.description }}</small>
            </div>
            <i v-if="formData.type === type.value" class="pi pi-check check-icon"></i>
          </div>
        </div>
        <small v-if="errors.type" class="p-error">{{ errors.type }}</small>
      </div>

      <!-- Initial Members -->
      <div class="form-field">
        <div class="members-header">
          <label for="members" class="field-label">Участники</label>
          <span v-if="formData.members.length > 0" class="members-count">
            {{ formData.members.length }} выбрано
          </span>
        </div>
        <div class="members-search">
          <MultiSelect
            id="members"
            v-model="formData.members"
            :options="availableUsers"
            optionLabel="name"
            optionValue="id"
            placeholder="Выберите участников"
            :filter="true"
            :loading="loadingUsers"
            class="w-full"
            display="chip"
            :maxSelectedLabels="3"
            data-testid="members-multiselect"
          >
            <template #empty>
              <div class="empty-state">
                <i class="pi pi-users empty-icon"></i>
                <p class="empty-text">Пользователи не найдены</p>
                <small class="empty-hint">Попробуйте изменить запрос</small>
              </div>
            </template>
            <template #option="slotProps">
              <div class="user-option-modern">
                <Avatar
                  :image="slotProps.option.avatar"
                  :label="getAvatarLabel(slotProps.option.name)"
                  size="normal"
                  shape="circle"
                  :style="!slotProps.option.avatar ? { backgroundColor: getAvatarColor(slotProps.option.id) } : {}"
                />
                <div class="user-info">
                  <div class="user-name">{{ slotProps.option.name }}</div>
                  <div v-if="slotProps.option.email && slotProps.option.email !== slotProps.option.name" class="user-email">
                    {{ slotProps.option.email }}
                  </div>
                  <div v-else-if="slotProps.option.username && slotProps.option.username !== slotProps.option.name" class="user-username">
                    @{{ slotProps.option.username }}
                  </div>
                </div>
              </div>
            </template>
            <template #chip="slotProps">
              <div class="user-chip-modern">
                <Avatar
                  :image="slotProps.value.avatar"
                  :label="getAvatarLabel(slotProps.value.name)"
                  size="small"
                  shape="circle"
                  :style="!slotProps.value.avatar ? { backgroundColor: getAvatarColor(slotProps.value.id) } : {}"
                />
                <span class="chip-name">{{ slotProps.value.name }}</span>
              </div>
            </template>
          </MultiSelect>
        </div>
        <small class="field-hint">
          Вы будете автоматически добавлены как администратор комнаты
        </small>
      </div>

      <!-- Error Message -->
      <Message v-if="errorMessage" severity="error" :closable="false" class="mt-3">
        {{ errorMessage }}
      </Message>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Отмена"
          icon="pi pi-times"
          @click="handleClose"
          severity="secondary"
          :disabled="creating"
        />
        <Button
          label="Создать"
          icon="pi pi-check"
          @click="handleCreate"
          :loading="creating"
          :disabled="!isValid"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'created'])

const toast = useToast()

// Form data
const formData = ref({
  name: '',
  description: '',
  type: 'group',
  members: []
})

const errors = ref({})
const errorMessage = ref('')
const creating = ref(false)
const loadingUsers = ref(false)
const availableUsers = ref([])

// Room types
const roomTypes = [
  {
    value: 'personal',
    label: 'Личный чат',
    icon: 'pi pi-user',
    description: 'Приватная беседа один-на-один'
  },
  {
    value: 'group',
    label: 'Групповой чат',
    icon: 'pi pi-users',
    description: 'Обсуждение в группе'
  },
  {
    value: 'channel',
    label: 'Канал',
    icon: 'pi pi-megaphone',
    description: 'Объявления для большой аудитории'
  }
]

// Visibility control
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Validation
const isValid = computed(() => {
  return formData.value.name.trim().length > 0 && formData.value.type
})

// Load available users
async function loadAvailableUsers() {
  loadingUsers.value = true
  try {
    const token = localStorage.getItem('integram_token')
    const response = await fetch('/api/general-chat/available-users', {
      headers: {
        'X-Authorization': token
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load users')
    }

    const data = await response.json()
    availableUsers.value = data.data || []
  } catch (error) {
    console.error('Error loading users:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить список пользователей',
      life: 3000
    })
  } finally {
    loadingUsers.value = false
  }
}

// Create room
async function handleCreate() {
  // Validate
  errors.value = {}
  if (!formData.value.name.trim()) {
    errors.value.name = 'Введите название комнаты'
    return
  }
  if (!formData.value.type) {
    errors.value.type = 'Выберите тип комнаты'
    return
  }

  creating.value = true
  errorMessage.value = ''

  try {
    const token = localStorage.getItem('integram_token')
    const response = await fetch('/api/general-chat/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': token
      },
      body: JSON.stringify({
        name: formData.value.name.trim(),
        description: formData.value.description.trim(),
        type: formData.value.type,
        initialMembers: formData.value.members
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to create room')
    }

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: `Комната "${formData.value.name}" создана`,
      life: 3000
    })

    emit('created', data.data)
    handleClose()
  } catch (error) {
    console.error('Error creating room:', error)
    errorMessage.value = error.message || 'Не удалось создать комнату'
  } finally {
    creating.value = false
  }
}

// Select room type
function selectRoomType(type) {
  formData.value.type = type
  clearError('type')
}

// Clear error for field
function clearError(field) {
  delete errors.value[field]
}

// Handle dialog close
function handleClose() {
  formData.value = {
    name: '',
    description: '',
    type: 'group',
    members: []
  }
  errors.value = {}
  errorMessage.value = ''
  emit('update:visible', false)
}

// Get avatar label (first 2 chars)
function getAvatarLabel(name) {
  if (!name) return '??'
  return name.substring(0, 2).toUpperCase()
}

// Get consistent avatar color based on user ID
function getAvatarColor(userId) {
  if (!userId) return '#6366F1'

  const hash = userId.toString().split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  const colors = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B',
    '#EF4444', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
  ]

  return colors[Math.abs(hash) % colors.length]
}

// Load users when dialog opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadAvailableUsers()
  }
})

onMounted(() => {
  if (props.visible) {
    loadAvailableUsers()
  }
})
</script>

<style scoped>
/* Modern dialog styling */
.room-creation-dialog {
  font-family: var(--font-family);
}

.room-creation-dialog :deep(.p-dialog-header) {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-600) 100%);
  color: white;
  border-radius: 12px 12px 0 0;
  padding: 1.25rem 1.5rem;
}

.room-creation-dialog :deep(.p-dialog-content) {
  padding: 1.5rem;
  background: var(--surface-ground);
}

.room-creation-dialog :deep(.p-dialog-footer) {
  padding: 1rem 1.5rem;
  background: var(--surface-card);
  border-top: 1px solid var(--surface-border);
}

.dialog-header {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.dialog-header i {
  font-size: 1.5rem;
}

.room-creation-content {
  padding: 0.5rem 0;
}

.form-field {
  margin-bottom: 1.5rem;
}

.field-label {
  display: block;
  margin-bottom: 0.625rem;
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.95rem;
}

.required {
  color: var(--red-500);
}

.field-hint {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  line-height: 1.4;
}

/* Room type cards - modern style */
.room-type-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.room-type-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem;
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface-card);
}

.room-type-card:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.room-type-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.type-icon {
  font-size: 2rem;
  color: var(--primary-color);
  margin-bottom: 0.75rem;
}

.type-info {
  text-align: center;
}

.type-label {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.type-description {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  line-height: 1.3;
}

.check-icon {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  color: var(--primary-color);
  font-size: 1.25rem;
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

/* Members section */
.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
}

.members-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-50);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--text-color-secondary);
  opacity: 0.5;
  margin-bottom: 0.75rem;
}

.empty-text {
  margin: 0 0 0.25rem 0;
  font-weight: 500;
  color: var(--text-color);
}

.empty-hint {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

/* Legacy support */
.room-type-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.room-type-option:hover {
  background-color: var(--surface-hover);
}

/* Modern user option with two-line layout */
.user-option-modern {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  transition: background-color 0.2s;
}

.user-option-modern:hover {
  background-color: var(--surface-hover);
  border-radius: 8px;
  padding-left: 0.5rem;
  margin-left: -0.5rem;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.user-name {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.95rem;
}

.user-email,
.user-username {
  font-size: 0.825rem;
  color: var(--text-color-secondary);
}

.user-username {
  font-style: italic;
}

/* Modern chip styling */
.user-chip-modern {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.chip-name {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Legacy support */
.user-option {
  display: flex;
  align-items: center;
  padding: 0.25rem 0;
}

.user-chip {
  display: flex;
  align-items: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.members-search {
  position: relative;
}
</style>

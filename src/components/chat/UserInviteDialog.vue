<template>
  <Dialog
    v-model:visible="isVisible"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="user-invite-dialog"
    :style="{ width: '600px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <i class="pi pi-user-plus mr-2"></i>
        <span>Пригласить участников</span>
      </div>
    </template>

    <div class="invite-content">
      <!-- User Search and Selection -->
      <div class="form-field">
        <label for="users" class="field-label">Выберите пользователей</label>
        <MultiSelect
          id="users"
          v-model="selectedUsers"
          :options="filteredUsers"
          optionLabel="name"
          optionValue="id"
          placeholder="Поиск пользователей..."
          :filter="true"
          :loading="loadingUsers"
          class="w-full"
          display="chip"
          :showClear="true"
          filterPlaceholder="Введите имя..."
          @filter="handleFilter"
        >
          <template #option="slotProps">
            <div class="user-option">
              <Avatar
                :image="slotProps.option.avatar"
                :label="getAvatarLabel(slotProps.option.name)"
                :style="!slotProps.option.avatar ? { backgroundColor: getAvatarColor(slotProps.option.id) } : {}"
                size="normal"
                shape="circle"
                class="mr-2"
              />
              <div>
                <div class="font-semibold">{{ slotProps.option.name }}</div>
                <small v-if="slotProps.option.email" class="text-gray-600">
                  {{ slotProps.option.email }}
                </small>
              </div>
            </div>
          </template>
          <template #chip="slotProps">
            <div class="user-chip">
              <Avatar
                :label="getAvatarLabel(getUserById(slotProps.value)?.name)"
                size="small"
                shape="circle"
                class="mr-1"
              />
              <span>{{ getUserById(slotProps.value)?.name }}</span>
            </div>
          </template>
          <template #empty>
            <div class="empty-message">
              <i class="pi pi-info-circle mr-2"></i>
              <span>{{ searchQuery ? 'Пользователи не найдены' : 'Начните вводить имя для поиска' }}</span>
            </div>
          </template>
        </MultiSelect>
        <small class="field-hint">
          Выбрано: {{ selectedUsers.length }} {{ pluralize(selectedUsers.length, 'пользователь', 'пользователя', 'пользователей') }}
        </small>
      </div>

      <!-- Role Selection -->
      <div class="form-field">
        <label for="role" class="field-label">Роль новых участников</label>
        <Dropdown
          id="role"
          v-model="selectedRole"
          :options="roleOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        >
          <template #option="slotProps">
            <div>
              <div class="font-semibold">{{ slotProps.option.label }}</div>
              <small class="text-gray-600">{{ slotProps.option.description }}</small>
            </div>
          </template>
        </Dropdown>
      </div>

      <!-- Selected Users Preview -->
      <div v-if="selectedUsers.length > 0" class="selected-users-preview">
        <div class="preview-header">
          <span class="font-semibold">Будут добавлены:</span>
        </div>
        <div class="preview-list">
          <div v-for="userId in selectedUsers" :key="userId" class="preview-item">
            <Avatar
              :image="getUserById(userId)?.avatar"
              :label="getAvatarLabel(getUserById(userId)?.name)"
              :style="!getUserById(userId)?.avatar ? { backgroundColor: getAvatarColor(userId) } : {}"
              size="normal"
              shape="circle"
            />
            <span>{{ getUserById(userId)?.name }}</span>
            <Tag :value="roleOptions.find(r => r.value === selectedRole)?.label" severity="info" />
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <Message v-if="errorMessage" severity="error" :closable="true" @close="errorMessage = ''" class="mt-3">
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
          :disabled="inviting"
        />
        <Button
          label="Пригласить"
          icon="pi pi-check"
          @click="handleInvite"
          :loading="inviting"
          :disabled="selectedUsers.length === 0"
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
  },
  roomId: {
    type: [Number, null],
    default: null
  },
  existingMemberIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'invited'])

const toast = useToast()

// State
const selectedUsers = ref([])
const selectedRole = ref('member')
const loadingUsers = ref(false)
const inviting = ref(false)
const errorMessage = ref('')
const availableUsers = ref([])
const searchQuery = ref('')

// Role options
const roleOptions = [
  {
    value: 'member',
    label: 'Участник',
    description: 'Может отправлять и читать сообщения'
  },
  {
    value: 'moderator',
    label: 'Модератор',
    description: 'Может управлять участниками и сообщениями'
  },
  {
    value: 'admin',
    label: 'Администратор',
    description: 'Полный доступ к управлению комнатой'
  }
]

// Visibility
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Filter users (exclude existing members)
const filteredUsers = computed(() => {
  return availableUsers.value.filter(
    user => !props.existingMemberIds.includes(user.id)
  )
})

// Load available users
async function loadAvailableUsers() {
  loadingUsers.value = true
  try {
    const token = localStorage.getItem('integram_token')
    const excludeIds = props.existingMemberIds.join(',')

    const response = await fetch(
      `/api/general-chat/available-users?exclude=${excludeIds}`,
      {
        headers: {
          'X-Authorization': token
        }
      }
    )

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

// Handle filter
function handleFilter(event) {
  searchQuery.value = event.value || ''
}

// Get user by ID
function getUserById(userId) {
  return availableUsers.value.find(u => u.id === userId)
}

// Invite users
async function handleInvite() {
  if (selectedUsers.value.length === 0) return

  inviting.value = true
  errorMessage.value = ''

  const results = {
    success: [],
    failed: []
  }

  try {
    const token = localStorage.getItem('integram_token')

    // Add each user
    for (const userId of selectedUsers.value) {
      try {
        const response = await fetch(
          `/api/general-chat/rooms/${props.roomId}/members`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Authorization': token
            },
            body: JSON.stringify({
              userId,
              role: selectedRole.value
            })
          }
        )

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || 'Failed to add user')
        }

        results.success.push({ userId, data: data.data })
      } catch (error) {
        console.error(`Error adding user ${userId}:`, error)
        results.failed.push({ userId, error: error.message })
      }
    }

    // Show results
    if (results.success.length > 0) {
      toast.add({
        severity: 'success',
        summary: 'Участники добавлены',
        detail: `Добавлено: ${results.success.length} ${pluralize(results.success.length, 'пользователь', 'пользователя', 'пользователей')}`,
        life: 3000
      })

      // Emit invited events
      results.success.forEach(({ data }) => {
        emit('invited', data)
      })
    }

    if (results.failed.length > 0) {
      errorMessage.value = `Не удалось добавить ${results.failed.length} ${pluralize(results.failed.length, 'пользователя', 'пользователей', 'пользователей')}`
    } else {
      // Close dialog if all succeeded
      handleClose()
    }
  } catch (error) {
    console.error('Error inviting users:', error)
    errorMessage.value = 'Произошла ошибка при приглашении участников'
  } finally {
    inviting.value = false
  }
}

// Handle close
function handleClose() {
  selectedUsers.value = []
  selectedRole.value = 'member'
  errorMessage.value = ''
  searchQuery.value = ''
  emit('update:visible', false)
}

// Pluralize helper
function pluralize(count, one, few, many) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

// Get avatar label
function getAvatarLabel(name) {
  if (!name) return '??'
  return name.substring(0, 2).toUpperCase()
}

// Get avatar color
function getAvatarColor(userId) {
  if (!userId) return 'var(--surface-300)'

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
.user-invite-dialog {
  font-family: var(--font-family);
}

.dialog-header {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
}

.invite-content {
  padding: 0.5rem 0;
}

.form-field {
  margin-bottom: 1.5rem;
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
}

.field-hint {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.user-option {
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
}

.user-chip {
  display: flex;
  align-items: center;
}

.empty-message {
  text-align: center;
  padding: 1rem;
  color: var(--text-color-secondary);
}

.selected-users-preview {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.preview-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--surface-card);
  border-radius: 6px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>

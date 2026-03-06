<template>
  <Dialog
    v-model:visible="isVisible"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="room-members-dialog"
    :style="{ width: '700px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <i class="pi pi-users mr-2"></i>
        <span>Участники комнаты</span>
        <Tag v-if="members.length > 0" :value="members.length" severity="info" class="ml-2" />
      </div>
    </template>

    <div class="members-content">
      <!-- Add Member Button -->
      <div class="members-actions" v-if="canManageMembers">
        <Button
          label="Добавить участников"
          icon="pi pi-user-plus"
          @click="showInviteDialog = true"
          severity="success"
          outlined
          size="small"
        />
      </div>

      <!-- Members List -->
      <div v-if="loading" class="loading-state">
        <ProgressSpinner style="width: 40px; height: 40px" />
        <p class="text-gray-600 mt-2">Загрузка участников...</p>
      </div>

      <div v-else-if="members.length === 0" class="empty-state">
        <i class="pi pi-users" style="font-size: 3rem; color: var(--text-color-secondary)"></i>
        <p class="text-gray-600 mt-2">В комнате пока нет участников</p>
        <Button
          v-if="canManageMembers"
          label="Добавить участников"
          icon="pi pi-user-plus"
          @click="showInviteDialog = true"
          class="mt-3"
          outlined
        />
      </div>

      <div v-else class="members-list">
        <div
          v-for="member in members"
          :key="member.id"
          class="member-item"
          :class="{ 'current-user': member.userId === currentUserId }"
        >
          <!-- Avatar -->
          <Avatar
            :image="member.userAvatar"
            :label="getAvatarLabel(member.userName)"
            :style="!member.userAvatar ? { backgroundColor: getAvatarColor(member.userId) } : {}"
            size="large"
            shape="circle"
            class="member-avatar"
          />

          <!-- Member Info -->
          <div class="member-info">
            <div class="member-name">
              {{ member.userName }}
              <Tag v-if="member.role === 'admin'" value="Админ" severity="danger" class="ml-2" />
              <Tag v-else-if="member.role === 'moderator'" value="Модератор" severity="warning" class="ml-2" />
              <Tag v-if="member.userId === currentUserId" value="Вы" severity="info" class="ml-2" />
            </div>
            <small class="member-joined text-gray-600">
              Присоединился: {{ formatDate(member.joinedAt) }}
            </small>
          </div>

          <!-- Actions -->
          <div class="member-actions">
            <!-- Role Selector (for admins only) -->
            <Dropdown
              v-if="canManageMembers && member.userId !== roomCreatorId"
              v-model="member.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
              @change="updateMemberRole(member)"
              class="role-selector"
              size="small"
            />

            <!-- Remove Button -->
            <Button
              v-if="canRemoveMember(member)"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="confirmRemoveMember(member)"
              v-tooltip.top="member.userId === currentUserId ? 'Покинуть комнату' : 'Удалить участника'"
            />
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
          label="Закрыть"
          icon="pi pi-times"
          @click="handleClose"
          severity="secondary"
        />
      </div>
    </template>
  </Dialog>

  <!-- User Invite Dialog -->
  <UserInviteDialog
    v-model:visible="showInviteDialog"
    :roomId="roomId"
    :existingMemberIds="members.map(m => m.userId)"
    @invited="handleMemberAdded"
  />

  <!-- Confirm Remove Dialog -->
  <Dialog
    v-model:visible="showRemoveConfirm"
    :modal="true"
    header="Подтверждение"
    :style="{ width: '400px' }"
  >
    <div class="confirm-content">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--yellow-500)"></i>
      <p class="mt-3">
        {{ memberToRemove?.userId === currentUserId
           ? 'Вы уверены, что хотите покинуть эту комнату?'
           : `Удалить участника ${memberToRemove?.userName}?` }}
      </p>
    </div>
    <template #footer>
      <Button label="Отмена" @click="showRemoveConfirm = false" severity="secondary" />
      <Button label="Удалить" @click="removeMember" severity="danger" :loading="removing" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import UserInviteDialog from './UserInviteDialog.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  roomId: {
    type: [Number, null],
    default: null
  },
  roomCreatorId: {
    type: Number,
    default: null
  },
  currentUserId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'member-removed'])

const toast = useToast()

// State
const members = ref([])
const loading = ref(false)
const errorMessage = ref('')
const showInviteDialog = ref(false)
const showRemoveConfirm = ref(false)
const memberToRemove = ref(null)
const removing = ref(false)

// Role options
const roleOptions = [
  { value: 'member', label: 'Участник' },
  { value: 'moderator', label: 'Модератор' },
  { value: 'admin', label: 'Администратор' }
]

// Visibility
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Check if current user can manage members
const canManageMembers = computed(() => {
  const currentMember = members.value.find(m => m.userId === props.currentUserId)
  return currentMember && ['admin', 'moderator'].includes(currentMember.role)
})

// Load members
async function loadMembers() {
  if (!props.roomId) return

  loading.value = true
  errorMessage.value = ''

  try {
    const token = localStorage.getItem('integram_token')
    const response = await fetch(`/api/general-chat/rooms/${props.roomId}/members`, {
      headers: {
        'X-Authorization': token
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load members')
    }

    const data = await response.json()
    members.value = data.data || []
  } catch (error) {
    console.error('Error loading members:', error)
    errorMessage.value = 'Не удалось загрузить список участников'
  } finally {
    loading.value = false
  }
}

// Update member role
async function updateMemberRole(member) {
  try {
    const token = localStorage.getItem('integram_token')
    const response = await fetch(
      `/api/general-chat/rooms/${props.roomId}/members/${member.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': token
        },
        body: JSON.stringify({ role: member.role })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to update role')
    }

    toast.add({
      severity: 'success',
      summary: 'Роль обновлена',
      detail: `Роль участника изменена на: ${member.role}`,
      life: 3000
    })
  } catch (error) {
    console.error('Error updating role:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message || 'Не удалось обновить роль',
      life: 3000
    })
  }
}

// Check if can remove member
function canRemoveMember(member) {
  // Creator cannot be removed
  if (member.userId === props.roomCreatorId) {
    return false
  }

  // User can leave themselves
  if (member.userId === props.currentUserId) {
    return true
  }

  // Admin/moderator can remove others
  return canManageMembers.value
}

// Confirm remove member
function confirmRemoveMember(member) {
  memberToRemove.value = member
  showRemoveConfirm.value = true
}

// Remove member
async function removeMember() {
  if (!memberToRemove.value) return

  removing.value = true

  try {
    const token = localStorage.getItem('integram_token')
    const response = await fetch(
      `/api/general-chat/rooms/${props.roomId}/members/${memberToRemove.value.id}`,
      {
        method: 'DELETE',
        headers: {
          'X-Authorization': token
        }
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to remove member')
    }

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: memberToRemove.value.userId === props.currentUserId
        ? 'Вы покинули комнату'
        : 'Участник удалён',
      life: 3000
    })

    // Remove from local list
    members.value = members.value.filter(m => m.id !== memberToRemove.value.id)

    // If current user left, emit event and close dialog
    if (memberToRemove.value.userId === props.currentUserId) {
      emit('member-removed', { self: true })
      handleClose()
    } else {
      emit('member-removed', { member: memberToRemove.value })
    }

    showRemoveConfirm.value = false
    memberToRemove.value = null
  } catch (error) {
    console.error('Error removing member:', error)
    errorMessage.value = error.message || 'Не удалось удалить участника'
  } finally {
    removing.value = false
  }
}

// Handle member added
function handleMemberAdded(newMember) {
  members.value.push(newMember)
  toast.add({
    severity: 'success',
    summary: 'Участник добавлен',
    detail: `${newMember.userName} добавлен в комнату`,
    life: 3000
  })
}

// Handle close
function handleClose() {
  emit('update:visible', false)
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Неизвестно'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
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

// Load members when dialog opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadMembers()
  }
})

onMounted(() => {
  if (props.visible) {
    loadMembers()
  }
})
</script>

<style scoped>
.room-members-dialog {
  font-family: var(--font-family);
}

.dialog-header {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
}

.members-content {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
}

.members-actions {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  transition: all 0.2s;
}

.member-item:hover {
  background: var(--surface-hover);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.member-item.current-user {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.member-avatar {
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.member-joined {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.role-selector {
  min-width: 150px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
}
</style>

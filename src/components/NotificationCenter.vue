<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotifications } from '@/composables/notifications'
import { useRouter } from 'vue-router'

const router = useRouter()
const {
  notifications,
  unreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  clearAll,
  formatRelativeTime,
  initialize,
  closeWebSocket
} = useNotifications()

// Initialize notification system on mount
onMounted(async () => {
  await initialize()
})

// Clean up WebSocket on unmount
onUnmounted(() => {
  closeWebSocket()
})

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'close'])

const activeTab = ref('all')
const menu = ref(null)

const filteredNotifications = computed(() => {
  if (activeTab.value === 'unread') {
    return notifications.value.filter(n => !n.read)
  }
  return notifications.value
})

const hasNotifications = computed(() => {
  return filteredNotifications.value.length > 0
})

const handleNotificationClick = (notification) => {
  markAsRead(notification.id)
  if (notification.link) {
    router.push(notification.link)
    emit('close')
  }
}

const handleMarkAsRead = (notification, event) => {
  event.stopPropagation()
  markAsRead(notification.id)
}

const handleMarkAsUnread = (notification, event) => {
  event.stopPropagation()
  markAsUnread(notification.id)
}

const handleDelete = (notification, event) => {
  event.stopPropagation()
  deleteNotification(notification.id)
}

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const getNotificationClass = (notification) => {
  return {
    'notification-item': true,
    'notification-unread': !notification.read,
    'notification-read': notification.read,
    [`notification-${notification.priority}`]: true
  }
}

const getIconColorClass = (color) => {
  const colorMap = {
    blue: 'bg-blue-100 dark:bg-blue-400/10 text-blue-500',
    purple: 'bg-purple-100 dark:bg-purple-400/10 text-purple-500',
    red: 'bg-red-100 dark:bg-red-400/10 text-red-500',
    green: 'bg-green-100 dark:bg-green-400/10 text-green-500',
    cyan: 'bg-cyan-100 dark:bg-cyan-400/10 text-cyan-500',
    orange: 'bg-orange-100 dark:bg-orange-400/10 text-orange-500',
    pink: 'bg-pink-100 dark:bg-pink-400/10 text-pink-500'
  }
  return colorMap[color] || colorMap.blue
}
</script>

<template>
  <Sidebar
    :visible="visible"
    position="right"
    :modal="true"
    :dismissable="true"
    class="notification-sidebar"
    @update:visible="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <i class="pi pi-bell text-2xl"></i>
          <div>
            <h2 class="text-xl font-semibold m-0">Уведомления</h2>
            <p class="text-sm text-muted-color m-0" v-if="unreadCount > 0">
              {{ unreadCount }} непрочитанных
            </p>
          </div>
        </div>
      </div>
    </template>

    <div class="notification-center-content">
      <!-- Action bar -->
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface">
        <div class="flex gap-2">
          <Button
            :label="`Все (${notifications.length})`"
            :outlined="activeTab !== 'all'"
            size="small"
            @click="activeTab = 'all'"
          />
          <Button
            :label="`Непрочитанные (${unreadCount})`"
            :outlined="activeTab !== 'unread'"
            size="small"
            @click="activeTab = 'unread'"
          />
        </div>
        <Button
          icon="pi pi-ellipsis-v"
          text
          rounded
          @click="menu.toggle($event)"
        />
        <Menu ref="menu" :model="[
          {
            label: 'Отметить все как прочитанные',
            icon: 'pi pi-check',
            command: markAllAsRead,
            disabled: unreadCount === 0
          },
          {
            label: 'Очистить все',
            icon: 'pi pi-trash',
            command: clearAll,
            disabled: notifications.length === 0
          },
          {
            separator: true
          },
          {
            label: 'Настройки уведомлений',
            icon: 'pi pi-cog',
            command: () => {
              router.push('/settings/notifications')
              handleClose()
            }
          }
        ]" popup />
      </div>

      <!-- Notifications list -->
      <div class="notifications-list" v-if="hasNotifications">
        <div
          v-for="notification in filteredNotifications"
          :key="notification.id"
          :class="getNotificationClass(notification)"
          @click="handleNotificationClick(notification)"
        >
          <div class="flex gap-3 w-full">
            <!-- Icon -->
            <div
              :class="[
                'notification-icon',
                'w-12 h-12 flex items-center justify-center rounded-full shrink-0',
                getIconColorClass(notification.iconColor)
              ]"
            >
              <i :class="['pi', notification.icon, '!text-xl']"></i>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h4 class="notification-title font-semibold text-sm m-0">
                  {{ notification.title }}
                </h4>
                <Badge
                  v-if="!notification.read"
                  value=" "
                  severity="info"
                  class="notification-badge"
                />
              </div>
              <p class="notification-message text-sm text-muted-color m-0 mb-2">
                {{ notification.message }}
              </p>
              <div class="flex items-center justify-between">
                <span class="notification-time text-xs text-muted-color">
                  {{ formatRelativeTime(notification.createdAt) }}
                </span>
                <div class="notification-actions flex gap-1">
                  <Button
                    v-if="!notification.read"
                    icon="pi pi-check"
                    text
                    rounded
                    size="small"
                    title="'Отметить как прочитанное'"
                    @click="handleMarkAsRead(notification, $event)"
                  />
                  <Button
                    v-else
                    icon="pi pi-envelope"
                    text
                    rounded
                    size="small"
                    title="'Отметить как непрочитанное'"
                    @click="handleMarkAsUnread(notification, $event)"
                  />
                  <Button
                    icon="pi pi-times"
                    text
                    rounded
                    size="small"
                    severity="danger"
                    title="'Удалить'"
                    @click="handleDelete(notification, $event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state text-center py-12">
        <i class="pi pi-bell text-6xl text-muted-color mb-4"></i>
        <h3 class="text-xl font-semibold mb-2">Нет уведомлений</h3>
        <p class="text-muted-color">
          {{ activeTab === 'unread' ? 'Все уведомления прочитаны' : 'У вас пока нет уведомлений' }}
        </p>
      </div>
    </div>
  </Sidebar>
</template>

<style scoped lang="scss">
.notification-sidebar {
  width: 28rem;
  max-width: 100vw;
}

.notification-center-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.notifications-list {
  flex: 1;
  overflow-y: auto;
}

.notification-item {
  padding: 1rem;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--surface-hover);
  }

  &:last-child {
    border-bottom: none;
  }
}

.notification-unread {
  background-color: var(--primary-50);

  &:hover {
    background-color: var(--primary-100);
  }
}

.notification-read {
  opacity: 0.7;
}

.notification-critical {
  border-left: 3px solid var(--red-500);
}

.notification-high {
  border-left: 3px solid var(--orange-500);
}

.notification-medium {
  border-left: 3px solid var(--blue-500);
}

.notification-low {
  border-left: 3px solid var(--surface-300);
}

.notification-title {
  color: var(--text-color);
  line-height: 1.4;
}

.notification-message {
  line-height: 1.5;
  word-break: break-word;
}

.notification-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.notification-item:hover .notification-actions {
  opacity: 1;
}

.notification-badge {
  width: 8px;
  height: 8px;
  min-width: 8px;
  padding: 0;
  border-radius: 50%;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .notification-sidebar {
    width: 100%;
  }
}
</style>

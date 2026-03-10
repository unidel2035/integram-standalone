<template>
  <div class="rs-wrap" ref="wrapEl">
    <!-- Текущая роль — кнопка-пилюля -->
    <button class="rs-pill" :style="{ '--rs-color': roleStore.currentRole.color }" @click="toggleOpen" :title="roleStore.currentRole.description">
      <i :class="roleStore.currentRole.icon"></i>
      <span class="rs-pill-label">{{ roleStore.currentRole.labelShort }}</span>
      <i class="pi pi-chevron-down rs-chevron" :class="{ open: isOpen }"></i>
    </button>

    <!-- Dropdown -->
    <Transition name="rs-drop">
      <div v-if="isOpen" class="rs-dropdown">
        <div class="rs-dropdown-title">Сменить роль</div>

        <button
          v-for="role in roleStore.availableRoles"
          :key="role.id"
          :class="['rs-role-btn', { active: roleStore.activeRole === role.id }]"
          :style="{ '--rs-color': role.color }"
          @click="selectRole(role.id)"
        >
          <i :class="role.icon"></i>
          <div class="rs-role-info">
            <span class="rs-role-label">{{ role.label }}</span>
            <span class="rs-role-desc">{{ role.description }}</span>
          </div>
          <i v-if="roleStore.activeRole === role.id" class="pi pi-check rs-check"></i>
        </button>

        <!-- Полный доступ для администраторов -->
        <div v-if="roleStore.isAdmin" class="rs-divider"></div>
        <button
          v-if="roleStore.isAdmin"
          :class="['rs-full-btn', { active: roleStore.fullMenuMode }]"
          @click="toggleFull"
          :title="roleStore.fullMenuMode ? 'Показать только мои разделы' : 'Показать полное меню администратора'"
        >
          <i :class="roleStore.fullMenuMode ? 'pi pi-eye-slash' : 'pi pi-th-large'"></i>
          <span>{{ roleStore.fullMenuMode ? 'Скрыть всё меню' : 'Полное меню' }}</span>
          <span class="rs-admin-badge">ADMIN</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoleStore } from '@/stores/roleStore'

const roleStore = useRoleStore()
const isOpen = ref(false)
const wrapEl = ref(null)

function toggleOpen() { isOpen.value = !isOpen.value }

function selectRole(roleId) {
  roleStore.setRole(roleId)
  isOpen.value = false
}

function toggleFull() {
  roleStore.toggleFullMenu()
  isOpen.value = false
}

function onClickOutside(e) {
  if (wrapEl.value && !wrapEl.value.contains(e.target)) isOpen.value = false
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.rs-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* Pill button */
.rs-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--rs-color) 40%, transparent);
  background: color-mix(in srgb, var(--rs-color) 10%, var(--p-surface-card));
  color: var(--rs-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.rs-pill:hover {
  background: color-mix(in srgb, var(--rs-color) 18%, var(--p-surface-card));
}
.rs-pill-label { max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
.rs-chevron { font-size: 10px; transition: transform 0.2s; }
.rs-chevron.open { transform: rotate(180deg); }

/* Dropdown */
.rs-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--p-text-color) 12%, transparent);
  z-index: 200;
  overflow: hidden;
}
.rs-dropdown-title {
  padding: 10px 14px 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
}

.rs-role-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--p-text-color);
  transition: background 0.12s;
  text-align: left;
}
.rs-role-btn:hover {
  background: color-mix(in srgb, var(--rs-color) 8%, var(--p-surface-ground));
}
.rs-role-btn.active {
  background: color-mix(in srgb, var(--rs-color) 12%, var(--p-surface-ground));
}
.rs-role-btn i:first-child { color: var(--rs-color); font-size: 14px; flex-shrink: 0; }
.rs-role-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.rs-role-label { font-size: 12px; font-weight: 600; }
.rs-role-desc { font-size: 11px; color: var(--p-text-muted-color); }
.rs-check { color: var(--rs-color); font-size: 11px; }

.rs-divider {
  height: 1px;
  background: var(--p-content-border-color);
  margin: 4px 0;
}

.rs-full-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--fst-red);
  font-size: 12px;
  font-weight: 600;
  transition: background 0.12s;
  text-align: left;
}
.rs-full-btn:hover { background: color-mix(in srgb, var(--fst-red) 8%, var(--p-surface-ground)); }
.rs-full-btn.active { background: color-mix(in srgb, var(--fst-red) 12%, var(--p-surface-ground)); }
.rs-full-btn i { font-size: 14px; }
.rs-admin-badge {
  margin-left: auto;
  background: color-mix(in srgb, var(--fst-red) 15%, transparent);
  color: var(--fst-red);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

/* Animation */
.rs-drop-enter-active, .rs-drop-leave-active { transition: opacity 0.15s, transform 0.15s; }
.rs-drop-enter-from, .rs-drop-leave-to { opacity: 0; transform: translateY(-6px); }
</style>

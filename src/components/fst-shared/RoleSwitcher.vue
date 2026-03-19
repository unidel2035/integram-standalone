<template>
  <div class="rs-wrap">
    <button class="rs-pill" :style="{ '--rs-color': roleStore.currentRole.color }" @click="toggle">
      <i :class="roleStore.currentRole.icon"></i>
      <span class="rs-pill-label">{{ roleStore.currentRole.labelShort }}</span>
      <i class="pi pi-chevron-down rs-chevron"></i>
    </button>

    <Popover ref="pop" appendTo="body" :baseZIndex="99999">
      <div class="rs-menu">
        <div class="rs-menu-title">Сменить роль</div>
        <button
          v-for="role in roleStore.availableRoles"
          :key="role.id"
          :class="['rs-role-btn', { active: roleStore.activeRole === role.id }]"
          :style="{ '--rs-color': role.color }"
          @click="selectRole(role.id)"
        >
          <i :class="role.icon" class="rs-role-icon"></i>
          <div class="rs-role-info">
            <span class="rs-role-label">{{ role.label }}</span>
            <span class="rs-role-desc">{{ role.description }}</span>
          </div>
          <i v-if="roleStore.activeRole === role.id" class="pi pi-check rs-check"></i>
        </button>
      </div>
    </Popover>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Popover from 'primevue/popover'
import { useRoleStore } from '@/stores/roleStore'

const roleStore = useRoleStore()
const pop = ref()

function toggle(event) {
  pop.value.toggle(event)
}

function selectRole(roleId) {
  roleStore.setRole(roleId)
  pop.value.hide()
}
</script>

<style scoped>
.rs-wrap {
  display: inline-flex;
  align-items: center;
}

.rs-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--rs-color) 40%, transparent);
  background: color-mix(in srgb, var(--rs-color) 10%, var(--p-surface-card));
  color: var(--rs-color);
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.rs-pill:hover {
  background: color-mix(in srgb, var(--rs-color) 18%, var(--p-surface-card));
}
.rs-pill-label { max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
.rs-chevron { font-size: 0.7rem; }

.rs-menu {
  min-width: 220px;
  padding: 4px 0;
}
.rs-menu-title {
  padding: 8px 14px 6px;
  font-size: 0.75rem;
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
  background: color-mix(in srgb, var(--rs-color) 10%, var(--p-surface-card));
}
.rs-role-btn.active {
  background: color-mix(in srgb, var(--rs-color) 20%, var(--p-surface-card));
  border-left: 3px solid var(--rs-color);
}
.rs-role-btn.active .rs-role-icon { color: var(--rs-color); }
.rs-role-btn.active .rs-role-label { color: var(--p-text-color); font-weight: 700; }
.rs-role-btn.active .rs-role-desc { color: var(--p-text-muted-color); }
.rs-role-btn.active .rs-check { color: var(--rs-color); }
.rs-role-icon { color: var(--rs-color); font-size: 0.93rem; flex-shrink: 0; }
.rs-role-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.rs-role-label { font-size: 0.88rem; font-weight: 600; color: var(--p-text-color); }
.rs-role-desc { font-size: 0.78rem; color: var(--p-text-muted-color); }
.rs-check { color: var(--rs-color); font-size: 0.78rem; }
</style>

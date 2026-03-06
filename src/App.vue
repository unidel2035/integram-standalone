<template>
  <div class="fst-app">
    <Toast />
    <ConfirmDialog />
    <RouterView />
  </div>
</template>

<script setup>
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--p-surface-50, #f8fafc);
  color: var(--p-surface-900, #0f172a);
}
.fst-app { min-height: 100vh; }
</style>

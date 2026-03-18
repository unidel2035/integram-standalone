<template>
  <div class="fst-page">
    <Toolbar v-if="showToolbar" class="fst-page-toolbar">
      <template #start>
        <slot name="header">
          <div class="fst-page-title-block">
            <div class="fst-page-title-row">
              <span v-if="live" class="fst-page-live-dot" />
              <i v-else-if="icon" :class="icon" class="fst-page-icon" />
              <h1 class="fst-page-title">{{ title }}</h1>
            </div>
            <p v-if="subtitle" class="fst-page-subtitle">{{ subtitle }}</p>
          </div>
        </slot>
      </template>
      <template v-if="$slots.center" #center>
        <slot name="center" />
      </template>
      <template #end>
        <div class="fst-page-actions">
          <slot name="actions" />
        </div>
      </template>
    </Toolbar>
    <div class="fst-page-body" :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<script setup>
import Toolbar from 'primevue/toolbar';

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  live: { type: Boolean, default: true },
  showToolbar: { type: Boolean, default: true },
  bodyClass: { type: [String, Object, Array], default: '' }
});
</script>

<style scoped>
.fst-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.fst-page-toolbar {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid var(--p-content-border-color) !important;
  border-radius: 0 !important;
  padding: var(--fst-topbar-pad-y) var(--fst-topbar-pad-x) !important;
  flex-shrink: 0;
}

.fst-page-title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fst-page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fst-page-icon {
  font-size: 16px;
  color: var(--p-text-color);
  flex-shrink: 0;
}

.fst-page-live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-primary-color);
  box-shadow: 0 0 6px var(--p-primary-color);
  flex-shrink: 0;
  animation: fst-dot-pulse 2s infinite;
}
@keyframes fst-dot-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.fst-page-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.2;
}

.fst-page-subtitle {
  margin: 0;
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-weight: 400;
  line-height: 1.2;
}

.fst-page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.fst-page-body {
  flex: 1;
  padding: var(--fst-body-pad);
}

@media (max-width: 768px) {
  .fst-page-toolbar {
    padding: 8px 12px !important;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fst-page-toolbar :deep(.p-toolbar-start) {
    width: 100%;
    min-width: 0;
  }
  .fst-page-toolbar :deep(.p-toolbar-end) {
    width: 100%;
    justify-content: flex-start;
  }
  .fst-page-title {
    font-size: 0.85rem;
  }
  .fst-page-subtitle {
    font-size: 0.75rem;
  }
  .fst-page-body {
    padding: 12px;
  }
  .fst-page-actions {
    width: 100%;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    padding-bottom: 2px;
  }
  .fst-page-actions :deep(.p-button) {
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .fst-page-actions :deep(.p-button .p-button-label) {
    display: none;
  }
  .fst-page-actions :deep(.p-button .p-button-icon) {
    margin-right: 0;
  }
}

@media (max-width: 480px) {
  .fst-page-toolbar {
    padding: 6px 10px !important;
  }
  .fst-page-title {
    font-size: 0.8rem;
  }
  .fst-page-body {
    padding: 8px;
  }
}
</style>

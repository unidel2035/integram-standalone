<template>
  <div class="workflow-properties-panel">
    <div class="panel-header">
      <h3>Workflow Properties</h3>
      <Button icon="pi pi-times" class="p-button-text p-button-sm" @click="$emit('close')" />
    </div>

    <div class="panel-body">
      <div class="property-group">
        <label>Workflow Name</label>
        <InputText v-model="workflowName" @input="updateWorkflow" placeholder="Enter workflow name..." />
      </div>

      <div class="property-group">
        <label>Description</label>
        <Textarea
          v-model="workflowDescription"
          rows="4"
          placeholder="Enter workflow description..."
          @input="updateWorkflow"
        />
      </div>

      <div class="property-group">
        <label>Version</label>
        <InputText :value="workflowVersion" disabled />
      </div>

      <div class="config-section">
        <h4>Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <i class="pi pi-circle"></i>
            <div class="stat-content">
              <span class="stat-value">{{ nodeCount }}</span>
              <span class="stat-label">Nodes</span>
            </div>
          </div>
          <div class="stat-item">
            <i class="pi pi-arrow-right"></i>
            <div class="stat-content">
              <span class="stat-value">{{ edgeCount }}</span>
              <span class="stat-label">Connections</span>
            </div>
          </div>
        </div>
      </div>

      <div class="config-section" v-if="validationErrors && validationErrors.length > 0">
        <h4>Validation</h4>
        <Message v-for="error in validationErrors" :key="error.message" :severity="error.severity || 'error'">
          {{ error.message }}
        </Message>
      </div>

      <div class="config-section">
        <h4>Actions</h4>
        <div class="action-buttons">
          <Button label="Export JSON" icon="pi pi-download" outlined @click="exportWorkflow" class="w-full mb-2" />
          <Button label="Import JSON" icon="pi pi-upload" outlined @click="showImportDialog = true"
            class="w-full mb-2" />
          <Button label="Clear Canvas" icon="pi pi-trash" severity="danger" outlined @click="clearCanvas"
            class="w-full" />
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <Button label="Save Workflow" icon="pi pi-save" @click="saveWorkflow" class="w-full" />
    </div>

    <Dialog v-model:visible="showImportDialog" header="Import Workflow" :modal="true" :style="{ width: '450px' }">
      <div class="import-dialog-content">
        <Textarea v-model="importJson" rows="10" placeholder="Paste JSON here..." class="w-full" />
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" @click="showImportDialog = false" text />
        <Button label="Import" icon="pi pi-check" @click="importWorkflow" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

import { useToast } from 'primevue/usetoast'

const props = defineProps({
  workflowName: {
    type: String,
    default: ''
  },
  workflowDescription: {
    type: String,
    default: ''
  },
  workflowVersion: {
    type: Number,
    default: 1
  },
  nodeCount: {
    type: Number,
    default: 0
  },
  edgeCount: {
    type: Number,
    default: 0
  },
  validationErrors: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:workflowName',
  'update:workflowDescription',
  'export-workflow',
  'import-workflow',
  'save-workflow',
  'clear-canvas',
  'close'
])

const toast = useToast()
const workflowName = ref(props.workflowName)
const workflowDescription = ref(props.workflowDescription)
const showImportDialog = ref(false)
const importJson = ref('')

watch(
  () => props.workflowName,
  (newVal) => {
    workflowName.value = newVal
  }
)

watch(
  () => props.workflowDescription,
  (newVal) => {
    workflowDescription.value = newVal
  }
)

const updateWorkflow = () => {
  emit('update:workflowName', workflowName.value)
  emit('update:workflowDescription', workflowDescription.value)
}

const exportWorkflow = () => {
  emit('export-workflow')
}

const importWorkflow = () => {
  try {
    const workflow = JSON.parse(importJson.value)
    emit('import-workflow', workflow)
    showImportDialog.value = false
    importJson.value = ''
    toast.add({ severity: 'success', summary: 'Success', detail: 'Workflow imported successfully', life: 3000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Invalid JSON format', life: 3000 })
  }
}

const saveWorkflow = () => {
  emit('save-workflow')
}

const clearCanvas = () => {
  if (confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
    emit('clear-canvas')
  }
}
</script>

<style scoped lang="scss">
.workflow-properties-panel {
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 350px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--surface-border);

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.property-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-color);
  }

  .p-inputtext,
  .p-inputtextarea {
    width: 100%;
  }
}

.config-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-border);

  h4 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-color);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: var(--content-border-radius);

  i {
    font-size: 1.5rem;
    color: var(--primary-color);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-color);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
}

.panel-footer {
  padding: 1rem;
  border-top: 1px solid var(--surface-border);
}

.import-dialog-content {
  padding: 0.5rem 0;
}
</style>

<template>
  <div class="node-properties-panel" v-if="selectedNode">
    <div class="panel-header">
      <h3>Node Properties</h3>
      <Button icon="pi pi-times" class="p-button-text p-button-sm" @click="$emit('close')" />
    </div>

    <div class="panel-body">
      <div class="property-group">
        <label>Node ID</label>
        <InputText v-model="selectedNode.id" disabled />
      </div>

      <div class="property-group">
        <label>Label</label>
        <InputText v-model="selectedNode.label" @input="updateNode" />
      </div>

      <div class="property-group">
        <label>Type</label>
        <InputText :value="selectedNode.type" disabled />
      </div>

      <!-- Agent-specific configurations -->
      <div class="config-section" v-if="selectedNode.data && selectedNode.data.config">
        <h4>Configuration</h4>

        <!-- TableAnalyzerAgent config -->
        <template v-if="selectedNode.type === 'TableAnalyzerAgent'">
          <div class="property-group">
            <label>Analysis Types</label>
            <MultiSelect
              v-model="selectedNode.data.config.analysisTypes"
              :options="['structure', 'data', 'statistics', 'quality', 'patterns']"
              placeholder="Select types"
              display="chip"
              @change="updateNode"
            />
          </div>
          <div class="property-group">
            <label>Depth</label>
            <Dropdown
              v-model="selectedNode.data.config.depth"
              :options="['shallow', 'medium', 'full']"
              placeholder="Select depth"
              @change="updateNode"
            />
          </div>
        </template>

        <!-- DataTransformAgent config -->
        <template v-if="selectedNode.type === 'DataTransformAgent'">
          <div class="property-group">
            <label>Transformation Type</label>
            <Dropdown
              v-model="selectedNode.data.config.transformationType"
              :options="['map', 'filter', 'reduce', 'pivot', 'unpivot']"
              placeholder="Select type"
              @change="updateNode"
            />
          </div>
          <div class="property-group">
            <label>Enable Validation</label>
            <Checkbox v-model="selectedNode.data.config.validation" binary @change="updateNode" />
          </div>
        </template>

        <!-- ValidatorAgent config -->
        <template v-if="selectedNode.type === 'ValidatorAgent'">
          <div class="property-group">
            <label>Stop on Error</label>
            <Checkbox v-model="selectedNode.data.config.stopOnError" binary @change="updateNode" />
          </div>
          <div class="property-group">
            <label>Severity Levels</label>
            <MultiSelect
              v-model="selectedNode.data.config.severityLevels"
              :options="['error', 'warning', 'info']"
              placeholder="Select levels"
              display="chip"
              @change="updateNode"
            />
          </div>
        </template>

        <!-- ReportGeneratorAgent config -->
        <template v-if="selectedNode.type === 'ReportGeneratorAgent'">
          <div class="property-group">
            <label>Format</label>
            <Dropdown
              v-model="selectedNode.data.config.format"
              :options="['pdf', 'html', 'excel', 'json']"
              placeholder="Select format"
              @change="updateNode"
            />
          </div>
          <div class="property-group">
            <label>Template</label>
            <InputText v-model="selectedNode.data.config.template" @input="updateNode" />
          </div>
          <div class="property-group">
            <label>Include Charts</label>
            <Checkbox v-model="selectedNode.data.config.includeCharts" binary @change="updateNode" />
          </div>
        </template>

        <!-- IntegrationAgent config -->
        <template v-if="selectedNode.type === 'IntegrationAgent'">
          <div class="property-group">
            <label>Endpoint URL</label>
            <InputText v-model="selectedNode.data.config.endpoint" @input="updateNode" />
          </div>
          <div class="property-group">
            <label>Method</label>
            <Dropdown
              v-model="selectedNode.data.config.method"
              :options="['GET', 'POST', 'PUT', 'DELETE', 'PATCH']"
              placeholder="Select method"
              @change="updateNode"
            />
          </div>
          <div class="property-group">
            <label>Auth Type</label>
            <Dropdown
              v-model="selectedNode.data.config.auth"
              :options="['none', 'bearer', 'basic', 'api-key']"
              placeholder="Select auth"
              @change="updateNode"
            />
          </div>
        </template>
      </div>

      <div class="config-section">
        <h4>Description</h4>
        <Textarea
          v-model="selectedNode.data.description"
          rows="3"
          placeholder="Enter description..."
          @input="updateNode"
        />
      </div>
    </div>

    <div class="panel-footer">
      <Button label="Delete Node" icon="pi pi-trash" severity="danger" outlined @click="deleteNode" />
    </div>
  </div>
</template>

<script setup>
import { logger } from '@/utils/logger'
import { watch } from 'vue'

const props = defineProps({
  selectedNode: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:selectedNode', 'update-node', 'delete-node', 'close'])

const updateNode = () => {
  emit('update-node', props.selectedNode)
}

const deleteNode = () => {
  emit('delete-node', props.selectedNode.id)
  emit('close')
}

watch(
  () => props.selectedNode,
  (newVal) => {
    if (newVal) {
      logger.debug('Selected node:', newVal)
    }
  }
)
</script>

<style scoped lang="scss">
.node-properties-panel {
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
  .p-dropdown,
  .p-multiselect,
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

.panel-footer {
  padding: 1rem;
  border-top: 1px solid var(--surface-border);
}
</style>

<template>
  <div class="meta-agent-creator">
    <div class="creator-layout">
      <!-- Left Panel: Form -->
      <div class="form-panel">
        <Card>
          <template #title>
            <div class="card-title">
              <i class="pi pi-sparkles"></i>
              AI-Powered Agent Creation
            </div>
          </template>
          <template #content>
            <div class="form-content">
              <Message severity="info" :closable="false">
                Describe the agent you want to create. The system will automatically generate requirements, create a GitHub issue, and trigger the development process.
              </Message>

              <div class="p-field">
                <label for="agentName">Agent Name *</label>
                <InputText
                  id="agentName"
                  v-model="agentData.name"
                  placeholder="e.g., Social Media Analytics Agent"
                  class="w-full"
                />
              </div>

              <div class="p-field">
                <label for="category">Category *</label>
                <Select
                  id="category"
                  v-model="agentData.category"
                  :options="categories"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select category"
                  class="w-full"
                />
              </div>

              <div class="p-field">
                <label for="description">Short Description</label>
                <Textarea
                  id="description"
                  v-model="agentData.description"
                  rows="3"
                  placeholder="Brief description of what this agent does..."
                  class="w-full"
                />
              </div>

              <div class="p-field">
                <label for="aiPrompt">Detailed AI Prompt (Optional)</label>
                <Textarea
                  id="aiPrompt"
                  v-model="agentData.aiPrompt"
                  rows="8"
                  placeholder="Describe in detail what the agent should do, what data it should collect, what actions it should perform, etc. The more detail you provide, the better the result."
                  class="w-full"
                />
                <small class="p-hint">Provide detailed requirements for the AI to generate better specifications.</small>
              </div>

              <div class="p-field">
                <label for="aiModel">AI Model for Generation</label>
                <Select
                  id="aiModel"
                  v-model="agentData.aiModel"
                  :options="aiModels"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select AI model (default: DeepSeek)"
                  class="w-full"
                  :loading="loadingModels"
                />
                <small class="p-hint">Choose which AI model to use for generating agent specifications.</small>
              </div>

              <div class="p-field">
                <div class="save-to-integram">
                  <Checkbox
                    id="saveToIntegram"
                    v-model="agentData.saveToIntegram"
                    :binary="true"
                  />
                  <label for="saveToIntegram" class="ml-2">Save agent to Integram for reuse</label>
                </div>
                <small class="p-hint">Enables agent versioning and sharing across projects.</small>
              </div>

              <Divider />

              <div class="creation-mode">
                <div class="mode-label">Creation Mode:</div>
                <SelectButton
                  v-model="useAI"
                  :options="modeOptions"
                  optionLabel="label"
                  optionValue="value"
                />
              </div>

              <div class="action-buttons">
                <Button
                  label="Clear"
                  icon="pi pi-times"
                  severity="secondary"
                  outlined
                  @click="clearForm"
                  :disabled="isCreating"
                />
                <Button
                  label="Create Agent"
                  icon="pi pi-plus"
                  :loading="isCreating"
                  @click="createAgent"
                  :disabled="!canCreate"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Right Panel: Result / History -->
      <div class="result-panel">
        <Card v-if="creationResult">
          <template #title>
            <div class="card-title">
              <i class="pi pi-check-circle" style="color: var(--green-500)"></i>
              Agent Creation Result
            </div>
          </template>
          <template #content>
            <div class="result-content">
              <Message severity="success" :closable="false">
                Agent creation initiated successfully!
              </Message>

              <div class="result-section">
                <h4>Agent Information</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value">{{ creationResult.agent.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">ID:</span>
                    <span class="info-value">{{ creationResult.agent.id }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Icon:</span>
                    <span class="info-value">{{ creationResult.agent.icon }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Category:</span>
                    <Tag :value="creationResult.agent.category" severity="info" />
                  </div>
                </div>
              </div>

              <div class="result-section">
                <h4>GitHub Issue</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Issue Number:</span>
                    <span class="info-value">#{{ creationResult.issue.number }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Title:</span>
                    <span class="info-value">{{ creationResult.issue.title }}</span>
                  </div>
                </div>
                <Button
                  label="View Issue"
                  icon="pi pi-external-link"
                  outlined
                  @click="openUrl(creationResult.issue.url)"
                  class="mt-3"
                />
              </div>

              <div class="result-section" v-if="creationResult.solve">
                <h4>Solve Command Status</h4>
                <Message
                  :severity="creationResult.solve.triggered ? 'success' : 'warn'"
                  :closable="false"
                >
                  {{ creationResult.solve.message }}
                </Message>
                <div class="info-grid" v-if="creationResult.solve.triggered">
                  <div class="info-item">
                    <span class="info-label">Session ID:</span>
                    <span class="info-value">{{ creationResult.solve.sessionId }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Status:</span>
                    <Tag :value="creationResult.solve.status" />
                  </div>
                </div>
              </div>

              <Divider />

              <div class="next-steps">
                <h4>Next Steps</h4>
                <ul>
                  <li>✅ GitHub issue created with full specifications</li>
                  <li>{{ creationResult.solve.triggered ? '✅' : '⏳' }} Solve command triggered</li>
                  <li>⏳ Agent development in progress</li>
                  <li>⏳ Automated tests will be generated</li>
                  <li>⏳ Peer review by quality agents</li>
                  <li>⏳ Integration after all checks pass</li>
                </ul>
              </div>
            </div>
          </template>
        </Card>

        <Card v-else-if="creationError">
          <template #title>
            <div class="card-title">
              <i class="pi pi-times-circle" style="color: var(--red-500)"></i>
              Creation Failed
            </div>
          </template>
          <template #content>
            <Message severity="error" :closable="false">
              {{ creationError }}
            </Message>
          </template>
        </Card>

        <Card v-else>
          <template #title>
            <div class="card-title">
              <i class="pi pi-info-circle"></i>
              How It Works
            </div>
          </template>
          <template #content>
            <div class="info-content">
              <Timeline :value="workflowSteps" class="custom-timeline">
                <template #content="slotProps">
                  <div class="timeline-item">
                    <div class="timeline-icon">
                      <i :class="slotProps.item.icon"></i>
                    </div>
                    <div class="timeline-content">
                      <h5>{{ slotProps.item.title }}</h5>
                      <p>{{ slotProps.item.description }}</p>
                    </div>
                  </div>
                </template>
              </Timeline>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const agentData = ref({
  name: '',
  description: '',
  category: '',
  aiPrompt: '',
  aiModel: 'deepseek-chat',
  saveToIntegram: true
})

const categories = ref([])
const aiModels = ref([
  { label: 'DeepSeek Chat (Recommended)', value: 'deepseek-chat' },
  { label: 'DeepSeek Code', value: 'deepseek-code' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude Sonnet 3.5', value: 'claude-3.5-sonnet' }
])
const loadingModels = ref(false)
const useAI = ref(true)
const isCreating = ref(false)
const creationResult = ref(null)
const creationError = ref(null)

const modeOptions = [
  { label: 'AI-Powered', value: true },
  { label: 'Manual', value: false }
]

const workflowSteps = [
  {
    icon: 'pi pi-file-edit',
    title: 'Generate Requirements',
    description: 'AI analyzes your description and generates functional requirements, technical specifications, and success metrics.'
  },
  {
    icon: 'pi pi-github',
    title: 'Create GitHub Issue',
    description: 'A comprehensive GitHub issue is created with full system prompt and agent specifications.'
  },
  {
    icon: 'pi pi-code',
    title: 'Trigger Development',
    description: 'Solve command starts automated development process using Claude Code.'
  },
  {
    icon: 'pi pi-shield',
    title: 'Quality Checks',
    description: 'Peer review by Code Quality, Security, Documentation, and Integration agents.'
  },
  {
    icon: 'pi pi-check-square',
    title: 'Automated Testing',
    description: 'Unit, integration, and E2E tests are generated and executed (70%+ coverage required).'
  },
  {
    icon: 'pi pi-verified',
    title: 'Integration',
    description: 'After all checks pass, agent is integrated into the system and appears on /spaces page.'
  }
]

const canCreate = computed(() => {
  return agentData.value.name && agentData.value.category && !isCreating.value
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadAIModels()])
})

async function loadCategories() {
  try {
    const response = await fetch('/api/agent-creator/categories')
    const data = await response.json()

    if (data.success) {
      categories.value = data.categories
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load categories',
      life: 3000
    })
  }
}

async function loadAIModels() {
  loadingModels.value = true
  try {
    const response = await fetch('/api/agent-creator/models')
    const data = await response.json()

    if (data.success && data.models?.length > 0) {
      aiModels.value = data.models
    }
  } catch (error) {
    console.error('Failed to load AI models, using defaults:', error)
    // Keep default models if API fails
  } finally {
    loadingModels.value = false
  }
}

async function createAgent() {
  if (!canCreate.value) return

  isCreating.value = true
  creationResult.value = null
  creationError.value = null

  try {
    const endpoint = useAI.value ? '/api/agent-creator/create-with-ai' : '/api/agent-creator/create'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentData.value)
    })

    const data = await response.json()

    if (data.success) {
      creationResult.value = data
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Agent creation initiated successfully!',
        life: 5000
      })
    } else {
      creationError.value = data.error || 'Failed to create agent'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: creationError.value,
        life: 5000
      })
    }
  } catch (error) {
    creationError.value = error.message || 'Network error'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to create agent',
      life: 5000
    })
  } finally {
    isCreating.value = false
  }
}

function clearForm() {
  agentData.value = {
    name: '',
    description: '',
    category: '',
    aiPrompt: '',
    aiModel: 'deepseek-chat',
    saveToIntegram: true
  }
  creationResult.value = null
  creationError.value = null
}

function openUrl(url) {
  window.open(url, '_blank')
}
</script>

<style scoped lang="scss">
.meta-agent-creator {
  height: 100%;
  overflow: hidden;
}

.creator-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  height: 100%;
  padding: 1.5rem;
  overflow: auto;
}

.form-panel,
.result-panel {
  height: fit-content;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.form-content {
  .p-field {
    margin-bottom: 1.5rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .p-hint {
      display: block;
      margin-top: 0.25rem;
      color: var(--text-color-secondary);
      font-size: 0.85rem;
    }
  }

  .save-to-integram {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    label {
      cursor: pointer;
      font-weight: 500;
    }
  }

  .creation-mode {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;

    .mode-label {
      font-weight: 600;
      font-size: 0.9rem;
    }
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }
}

.result-content {
  .result-section {
    margin-bottom: 1.5rem;

    h4 {
      margin-bottom: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--primary-color);
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        .info-label {
          font-size: 0.85rem;
          color: var(--text-color-secondary);
        }

        .info-value {
          font-weight: 600;
          color: var(--text-color);
        }
      }
    }
  }

  .next-steps {
    h4 {
      margin-bottom: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--primary-color);
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--surface-border);

        &:last-child {
          border-bottom: none;
        }
      }
    }
  }
}

.info-content {
  .custom-timeline {
    :deep(.p-timeline-event-content) {
      padding-left: 1rem;
    }
  }

  .timeline-item {
    .timeline-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-50);
      color: var(--primary-color);
      border-radius: 50%;
      font-size: 1.2rem;
    }

    .timeline-content {
      h5 {
        margin: 0 0 0.5rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-color);
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        line-height: 1.5;
      }
    }
  }
}

@media (max-width: 1200px) {
  .creator-layout {
    grid-template-columns: 1fr;
  }
}
</style>

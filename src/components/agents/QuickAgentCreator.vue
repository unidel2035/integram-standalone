<template>
  <div class="quick-agent-creator">
    <div class="creator-header">
      <h2><i class="pi pi-magic"></i> Quick Agent Creator</h2>
      <p class="creator-subtitle">Describe your agent in one sentence and we'll create it for you</p>
    </div>

    <div class="creator-form">
      <div class="prompt-input-container">
        <Textarea
          v-model="agentPrompt"
          rows="3"
          placeholder="e.g., 'An agent that analyzes financial reports and extracts key metrics' or 'A customer support bot that answers product questions'"
          :disabled="isCreating"
          class="prompt-textarea"
          @keydown.enter.ctrl="createAgent"
        />
        <div class="input-hint">
          <i class="pi pi-info-circle"></i>
          Press Ctrl+Enter to create or click the button below
        </div>
      </div>

      <div class="options-row">
        <div class="option-group">
          <label><i class="pi pi-wrench"></i> Auto-configure tools</label>
          <InputSwitch v-model="autoTools" :disabled="isCreating" />
        </div>
        <div class="option-group">
          <label><i class="pi pi-sitemap"></i> Generate SGR schema</label>
          <InputSwitch v-model="autoSchema" :disabled="isCreating" />
        </div>
        <div class="option-group">
          <label><i class="pi pi-database"></i> Enable RAG</label>
          <InputSwitch v-model="enableRag" :disabled="isCreating" />
        </div>
      </div>

      <div class="action-row">
        <Button
          :label="isCreating ? 'Creating...' : 'Create Agent'"
          icon="pi pi-sparkles"
          :loading="isCreating"
          :disabled="!agentPrompt.trim() || isCreating"
          @click="createAgent"
          class="create-button"
        />
        <Button
          label="Advanced Editor"
          icon="pi pi-cog"
          severity="secondary"
          outlined
          @click="$emit('openAdvanced')"
          :disabled="isCreating"
        />
      </div>
    </div>

    <!-- Creation Progress -->
    <div v-if="isCreating" class="creation-progress">
      <ProgressBar :value="creationProgress" :showValue="true" />
      <div class="progress-steps">
        <div
          v-for="(step, index) in creationSteps"
          :key="index"
          class="progress-step"
          :class="{ 'active': currentStep === index, 'completed': currentStep > index }"
        >
          <i :class="step.icon"></i>
          <span>{{ step.label }}</span>
        </div>
      </div>
    </div>

    <!-- Created Agent Preview -->
    <div v-if="createdAgent" class="agent-preview">
      <div class="preview-header">
        <h3><i class="pi pi-check-circle" style="color: var(--green-500)"></i> Agent Created!</h3>
        <Button icon="pi pi-times" severity="secondary" text rounded @click="createdAgent = null" />
      </div>

      <Card class="preview-card">
        <template #title>
          <div class="agent-title">
            <span class="agent-icon">{{ createdAgent.icon || '🤖' }}</span>
            <span>{{ createdAgent.name }}</span>
          </div>
        </template>
        <template #subtitle>{{ createdAgent.description }}</template>
        <template #content>
          <div class="agent-details">
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <Tag :value="createdAgent.type" />
            </div>
            <div v-if="createdAgent.tools?.length" class="detail-row">
              <span class="detail-label">Tools:</span>
              <div class="tools-list">
                <Tag v-for="tool in createdAgent.tools" :key="tool" :value="tool" severity="info" />
              </div>
            </div>
            <div v-if="createdAgent.sgrSchema" class="detail-row">
              <span class="detail-label">SGR Schema:</span>
              <Tag value="Configured" severity="success" />
            </div>
          </div>
        </template>
        <template #footer>
          <div class="preview-actions">
            <Button label="Test Agent" icon="pi pi-play" @click="testAgent" />
            <Button label="Deploy" icon="pi pi-cloud-upload" severity="success" @click="deployAgent" />
            <Button label="Edit" icon="pi pi-pencil" severity="secondary" outlined @click="editAgent" />
          </div>
        </template>
      </Card>
    </div>

    <!-- Error Display -->
    <Message v-if="error" severity="error" :closable="true" @close="error = null">
      {{ error }}
    </Message>

    <!-- Agent Templates Suggestions -->
    <div v-if="!agentPrompt && !createdAgent" class="templates-suggestions">
      <h4><i class="pi pi-lightbulb"></i> Popular Templates</h4>
      <div class="templates-grid">
        <div
          v-for="template in popularTemplates"
          :key="template.id"
          class="template-card"
          @click="useTemplate(template)"
        >
          <span class="template-icon">{{ template.icon }}</span>
          <span class="template-name">{{ template.name }}</span>
          <span class="template-desc">{{ template.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import apiClient from '@/axios2.js'

const toast = useToast()

const emit = defineEmits(['created', 'openAdvanced', 'test', 'deploy', 'edit'])

// Form state
const agentPrompt = ref('')
const autoTools = ref(true)
const autoSchema = ref(true)
const enableRag = ref(false)

// Creation state
const isCreating = ref(false)
const creationProgress = ref(0)
const currentStep = ref(-1)
const createdAgent = ref(null)
const error = ref(null)

// Creation steps
const creationSteps = [
  { label: 'Analyzing prompt', icon: 'pi pi-search' },
  { label: 'Generating agent config', icon: 'pi pi-cog' },
  { label: 'Setting up tools', icon: 'pi pi-wrench' },
  { label: 'Creating SGR schema', icon: 'pi pi-sitemap' },
  { label: 'Finalizing', icon: 'pi pi-check' }
]

// Popular templates
const popularTemplates = [
  {
    id: 'financial',
    name: 'Financial Analyst',
    icon: '📊',
    description: 'Analyzes financial reports and company data',
    prompt: 'An agent that analyzes financial reports, extracts key metrics like revenue, profit margins, and growth rates, and provides investment recommendations'
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    icon: '💬',
    description: 'Answers customer questions and resolves issues',
    prompt: 'A friendly customer support agent that answers product questions, helps troubleshoot issues, and escalates complex problems to humans'
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    icon: '👨‍💻',
    description: 'Reviews code and suggests improvements',
    prompt: 'A code review agent that analyzes code quality, identifies bugs and security issues, and suggests best practice improvements'
  },
  {
    id: 'research',
    name: 'Research Assistant',
    icon: '🔬',
    description: 'Helps with research and analysis',
    prompt: 'A research assistant that searches for information, summarizes findings, and helps analyze complex topics'
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    icon: '📈',
    description: 'Analyzes data and creates insights',
    prompt: 'A data analysis agent that processes datasets, creates visualizations, and extracts actionable insights'
  },
  {
    id: 'writer',
    name: 'Content Writer',
    icon: '✍️',
    description: 'Creates and edits written content',
    prompt: 'A content writing agent that creates blog posts, marketing copy, and technical documentation in various styles'
  }
]

// Create agent from prompt
async function createAgent() {
  if (!agentPrompt.value.trim()) return

  isCreating.value = true
  error.value = null
  creationProgress.value = 0
  currentStep.value = 0

  try {
    // Simulate step progress (replace with actual API calls)
    for (let i = 0; i < creationSteps.length; i++) {
      currentStep.value = i
      await simulateStep(i)
      creationProgress.value = ((i + 1) / creationSteps.length) * 100
    }

    // Call API to create agent (Taskade-style quick creation)
    const response = await apiClient.post('/api/agent-creator/create-from-prompt', {
      prompt: agentPrompt.value,
      options: {
        autoTools: autoTools.value,
        autoSchema: autoSchema.value,
        enableRag: enableRag.value
      }
    })

    if (response.data.success) {
      createdAgent.value = response.data.agent
      emit('created', response.data.agent)
      toast.add({
        severity: 'success',
        summary: 'Agent Created',
        detail: `${response.data.agent.name} is ready to use!`,
        life: 3000
      })
    } else {
      throw new Error(response.data.error || 'Failed to create agent')
    }
  } catch (err) {
    console.error('[QuickAgentCreator] Error:', err)
    error.value = err.message || 'Failed to create agent. Please try again.'

    // Fallback: Create mock agent for demo
    if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
      createdAgent.value = generateMockAgent(agentPrompt.value)
      toast.add({
        severity: 'warn',
        summary: 'Demo Mode',
        detail: 'API not available. Created demo agent.',
        life: 3000
      })
      error.value = null
    }
  } finally {
    isCreating.value = false
    currentStep.value = -1
  }
}

// Simulate step progress
function simulateStep(stepIndex) {
  const delays = [500, 800, 600, 700, 400]
  return new Promise(resolve => setTimeout(resolve, delays[stepIndex]))
}

// Generate mock agent for demo
function generateMockAgent(prompt) {
  const words = prompt.toLowerCase().split(' ')
  const type = words.includes('chat') || words.includes('support') ? 'chat' :
               words.includes('workflow') || words.includes('pipeline') ? 'workflow' : 'task'

  const icons = ['🤖', '🧠', '⚡', '🎯', '🔧', '📊', '💡']
  const randomIcon = icons[Math.floor(Math.random() * icons.length)]

  // Extract potential tools from prompt
  const potentialTools = []
  if (words.some(w => ['search', 'find', 'research'].includes(w))) potentialTools.push('web_search')
  if (words.some(w => ['data', 'analyze', 'analysis'].includes(w))) potentialTools.push('data_analysis')
  if (words.some(w => ['code', 'programming', 'developer'].includes(w))) potentialTools.push('code_execution')
  if (words.some(w => ['database', 'integram', 'records'].includes(w))) potentialTools.push('integram_mcp')

  return {
    id: `agent_${Date.now()}`,
    name: generateAgentName(prompt),
    description: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt,
    type,
    icon: randomIcon,
    tools: potentialTools.length > 0 ? potentialTools : ['general_assistant'],
    sgrSchema: autoSchema.value ? { name: 'generated_schema', version: '1.0' } : null,
    systemPrompt: `You are an AI agent. ${prompt}`,
    createdAt: new Date().toISOString()
  }
}

// Generate agent name from prompt
function generateAgentName(prompt) {
  const words = prompt.split(' ').slice(0, 4)
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim() || 'New Agent'
}

// Use template
function useTemplate(template) {
  agentPrompt.value = template.prompt
}

// Action handlers
function testAgent() {
  emit('test', createdAgent.value)
}

function deployAgent() {
  emit('deploy', createdAgent.value)
  toast.add({
    severity: 'success',
    summary: 'Agent Deployed',
    detail: 'Your agent is now active and ready to use!',
    life: 3000
  })
}

function editAgent() {
  emit('edit', createdAgent.value)
}
</script>

<style scoped>
.quick-agent-creator {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.creator-header {
  text-align: center;
  margin-bottom: 2rem;
}

.creator-header h2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.creator-subtitle {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.creator-form {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--surface-border);
}

.prompt-input-container {
  margin-bottom: 1.5rem;
}

.prompt-textarea {
  width: 100%;
  font-size: 1.1rem;
}

.input-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.options-row {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.option-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.action-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.create-button {
  min-width: 150px;
}

/* Creation Progress */
.creation-progress {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: var(--surface-ground);
  border-radius: 12px;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  opacity: 0.5;
  transition: all 0.3s ease;
}

.progress-step.active {
  opacity: 1;
  color: var(--primary-color);
}

.progress-step.completed {
  opacity: 1;
  color: var(--green-500);
}

.progress-step i {
  font-size: 1.5rem;
}

/* Agent Preview */
.agent-preview {
  margin-top: 1.5rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.preview-card {
  background: var(--surface-card);
}

.agent-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-icon {
  font-size: 1.5rem;
}

.agent-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-label {
  font-weight: 600;
  color: var(--text-color-secondary);
  min-width: 80px;
}

.tools-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.preview-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* Templates Suggestions */
.templates-suggestions {
  margin-top: 2rem;
}

.templates-suggestions h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: var(--text-color-secondary);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.template-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.template-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.template-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.template-desc {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .options-row {
    flex-direction: column;
    gap: 1rem;
  }

  .action-row {
    flex-direction: column;
  }

  .progress-steps {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .progress-step {
    flex: 1 1 45%;
  }
}
</style>

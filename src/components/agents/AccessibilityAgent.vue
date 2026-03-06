<template>
  <div class="accessibility-agent">
    <Card>
      <template #header>
        <div class="flex align-items-center justify-content-between p-3">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-universal-access text-4xl text-primary"></i>
            <div>
              <h2 id="agent-title" class="m-0">AI Accessibility Agent</h2>
              <p class="m-0 text-sm text-color-secondary">
                Automated WCAG 2.1 AA Compliance Scanner
              </p>
            </div>
          </div>
          <Button
            v-if="!isScanning"
            label="Start Scan"
            icon="pi pi-play"
            @click="startScan"
            :disabled="isScanning"
            aria-label="Start accessibility scan"
          />
          <Button
            v-else
            label="Stop Scan"
            icon="pi pi-stop"
            severity="danger"
            @click="stopScan"
            aria-label="Stop accessibility scan"
          />
        </div>
      </template>

      <template #content>
        <!-- Progress Section -->
        <div v-if="isScanning" class="mb-4" role="region" aria-labelledby="progress-heading">
          <h3 id="progress-heading" class="text-lg font-semibold mb-2">Scan Progress</h3>
          <ProgressBar
            :value="scanProgress"
            :showValue="true"
            aria-label="Scan progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="scanProgress"
          />
          <p class="mt-2 text-sm text-color-secondary" aria-live="polite">
            {{ currentStatus }}
          </p>
        </div>

        <!-- Results Summary -->
        <div v-if="scanResults" class="mb-4" role="region" aria-labelledby="summary-heading">
          <h3 id="summary-heading" class="text-lg font-semibold mb-3">Scan Results</h3>
          <div class="grid">
            <div class="col-12 md:col-3">
              <Card class="bg-red-50 border-red-200">
                <template #content>
                  <div class="text-center">
                    <i class="pi pi-exclamation-triangle text-4xl text-red-500" aria-hidden="true"></i>
                    <p class="text-2xl font-bold text-red-700 m-0" aria-label="Critical issues">
                      {{ scanResults.critical }}
                    </p>
                    <p class="text-sm text-color-secondary m-0">Critical</p>
                  </div>
                </template>
              </Card>
            </div>
            <div class="col-12 md:col-3">
              <Card class="bg-orange-50 border-orange-200">
                <template #content>
                  <div class="text-center">
                    <i class="pi pi-exclamation-circle text-4xl text-orange-500" aria-hidden="true"></i>
                    <p class="text-2xl font-bold text-orange-700 m-0" aria-label="High priority issues">
                      {{ scanResults.high }}
                    </p>
                    <p class="text-sm text-color-secondary m-0">High</p>
                  </div>
                </template>
              </Card>
            </div>
            <div class="col-12 md:col-3">
              <Card class="bg-yellow-50 border-yellow-200">
                <template #content>
                  <div class="text-center">
                    <i class="pi pi-info-circle text-4xl text-yellow-600" aria-hidden="true"></i>
                    <p class="text-2xl font-bold text-yellow-700 m-0" aria-label="Medium priority issues">
                      {{ scanResults.medium }}
                    </p>
                    <p class="text-sm text-color-secondary m-0">Medium</p>
                  </div>
                </template>
              </Card>
            </div>
            <div class="col-12 md:col-3">
              <Card class="bg-green-50 border-green-200">
                <template #content>
                  <div class="text-center">
                    <i class="pi pi-check-circle text-4xl text-green-500" aria-hidden="true"></i>
                    <p class="text-2xl font-bold text-green-700 m-0" aria-label="Components passed">
                      {{ scanResults.passed }}
                    </p>
                    <p class="text-sm text-color-secondary m-0">Passed</p>
                  </div>
                </template>
              </Card>
            </div>
          </div>

          <!-- Coverage Metrics -->
          <div class="mt-4">
            <h4 class="text-base font-semibold mb-2">ARIA Coverage</h4>
            <div class="flex align-items-center gap-3">
              <ProgressBar
                :value="scanResults.ariaCoverage"
                :showValue="false"
                class="flex-1"
                aria-label="ARIA coverage percentage"
                :aria-valuenow="scanResults.ariaCoverage"
              />
              <span class="font-bold text-lg">{{ scanResults.ariaCoverage }}%</span>
            </div>
            <p class="text-sm text-color-secondary mt-1">
              Target: 100% (Current: {{ scanResults.componentsWithAria }} / {{ scanResults.totalComponents }})
            </p>
          </div>
        </div>

        <!-- Issues Table -->
        <div v-if="issues.length > 0" role="region" aria-labelledby="issues-heading">
          <div class="flex align-items-center justify-content-between mb-3">
            <h3 id="issues-heading" class="text-lg font-semibold m-0">
              Issues Found ({{ filteredIssues.length }})
            </h3>
            <div class="flex gap-2">
              <Dropdown
                v-model="selectedSeverity"
                :options="severityOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Filter by severity"
                :showClear="true"
                aria-label="Filter issues by severity"
              />
              <Dropdown
                v-model="selectedCategory"
                :options="categoryOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Filter by category"
                :showClear="true"
                aria-label="Filter issues by category"
              />
              <Button
                label="Auto-Fix All"
                icon="pi pi-wrench"
                @click="autoFixAll"
                :disabled="!canAutoFix"
                severity="success"
                aria-label="Automatically fix all fixable issues"
              />
            </div>
          </div>

          <DataTable
            :value="filteredIssues"
            :paginator="true"
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            responsiveLayout="scroll"
            aria-label="Accessibility issues table"
          >
            <Column field="severity" header="Severity" :sortable="true" style="width: 10%">
              <template #body="{ data }">
                <Tag
                  :value="data.severity"
                  :severity="getSeverityColor(data.severity)"
                  :aria-label="`Severity: ${data.severity}`"
                />
              </template>
            </Column>
            <Column field="category" header="Category" :sortable="true" style="width: 15%">
              <template #body="{ data }">
                <span>{{ data.category }}</span>
              </template>
            </Column>
            <Column field="component" header="Component" :sortable="true" style="width: 25%">
              <template #body="{ data }">
                <code class="text-sm">{{ data.component }}</code>
              </template>
            </Column>
            <Column field="issue" header="Issue" style="width: 30%">
              <template #body="{ data }">
                <p class="m-0">{{ data.issue }}</p>
                <small class="text-color-secondary">Line {{ data.line }}</small>
              </template>
            </Column>
            <Column field="wcag" header="WCAG" style="width: 10%">
              <template #body="{ data }">
                <a
                  :href="`https://www.w3.org/WAI/WCAG21/quickref/#${data.wcag}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm"
                  :aria-label="`WCAG guideline ${data.wcag}`"
                >
                  {{ data.wcag }}
                </a>
              </template>
            </Column>
            <Column header="Actions" style="width: 10%">
              <template #body="{ data }">
                <div class="flex gap-2">
                  <Button
                    v-if="data.autoFixable"
                    icon="pi pi-wrench"
                    size="small"
                    @click="autoFixIssue(data)"
                    v-tooltip.top="'Auto-fix this issue'"
                    severity="success"
                    :aria-label="`Auto-fix issue in ${data.component}`"
                  />
                  <Button
                    icon="pi pi-eye"
                    size="small"
                    @click="viewIssue(data)"
                    v-tooltip.top="'View details'"
                    :aria-label="`View details for issue in ${data.component}`"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!isScanning && scanResults"
          class="text-center p-5"
          role="status"
        >
          <i class="pi pi-check-circle text-6xl text-green-500 mb-3" aria-hidden="true"></i>
          <h3 class="text-xl font-semibold text-green-700">All Clear!</h3>
          <p class="text-color-secondary">
            No accessibility issues found. Your application meets WCAG 2.1 AA standards.
          </p>
        </div>

        <!-- Initial State -->
        <div
          v-else-if="!isScanning && !scanResults"
          class="text-center p-5"
          role="status"
        >
          <i class="pi pi-universal-access text-6xl text-primary mb-3" aria-hidden="true"></i>
          <h3 class="text-xl font-semibold">Ready to Scan</h3>
          <p class="text-color-secondary mb-4">
            Click "Start Scan" to analyze your Vue.js components for accessibility issues.
          </p>
          <ul class="text-left inline-block text-sm text-color-secondary">
            <li>✓ ARIA attributes validation</li>
            <li>✓ Form accessibility checks</li>
            <li>✓ Image alt text verification</li>
            <li>✓ Modal and dialog accessibility</li>
            <li>✓ Keyboard navigation support</li>
            <li>✓ Color contrast analysis</li>
          </ul>
        </div>
      </template>
    </Card>

    <!-- Issue Detail Dialog -->
    <Dialog
      v-model:visible="showIssueDialog"
      :header="selectedIssue?.issue"
      :modal="true"
      :style="{ width: '50vw' }"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="selectedIssue ? `issue-dialog-${selectedIssue.id}` : undefined"
    >
      <div v-if="selectedIssue">
        <h4 :id="`issue-dialog-${selectedIssue.id}`" class="mt-0">Issue Details</h4>

        <div class="mb-3">
          <label class="font-semibold block mb-1">Component:</label>
          <code class="block bg-gray-100 p-2 rounded">{{ selectedIssue.component }}</code>
        </div>

        <div class="mb-3">
          <label class="font-semibold block mb-1">Line:</label>
          <span>{{ selectedIssue.line }}</span>
        </div>

        <div class="mb-3">
          <label class="font-semibold block mb-1">Current Code:</label>
          <pre class="bg-gray-100 p-3 rounded overflow-x-auto"><code>{{ selectedIssue.currentCode }}</code></pre>
        </div>

        <div class="mb-3">
          <label class="font-semibold block mb-1">Suggested Fix:</label>
          <pre class="bg-green-50 p-3 rounded overflow-x-auto"><code>{{ selectedIssue.suggestedFix }}</code></pre>
        </div>

        <div class="mb-3">
          <label class="font-semibold block mb-1">Explanation:</label>
          <p>{{ selectedIssue.explanation }}</p>
        </div>

        <div class="mb-3">
          <label class="font-semibold block mb-1">WCAG Reference:</label>
          <a
            :href="`https://www.w3.org/WAI/WCAG21/quickref/#${selectedIssue.wcag}`"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Read WCAG guideline ${selectedIssue.wcag}`"
          >
            {{ selectedIssue.wcag }} - {{ selectedIssue.wcagTitle }}
          </a>
        </div>
      </div>

      <template #footer>
        <Button
          label="Close"
          icon="pi pi-times"
          @click="showIssueDialog = false"
          text
          aria-label="Close issue details dialog"
        />
        <Button
          v-if="selectedIssue?.autoFixable"
          label="Apply Fix"
          icon="pi pi-check"
          @click="applyFix(selectedIssue)"
          severity="success"
          aria-label="Apply suggested fix"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import { scanForAccessibilityIssues, autoFixIssue as applyAutoFix } from '@/services/accessibilityScanner'

const toast = useToast()

// State
const isScanning = ref(false)
const scanProgress = ref(0)
const currentStatus = ref('')
const scanResults = ref(null)
const issues = ref([])
const selectedSeverity = ref(null)
const selectedCategory = ref(null)
const showIssueDialog = ref(false)
const selectedIssue = ref(null)

// Filter options
const severityOptions = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

const categoryOptions = [
  { label: 'ARIA Attributes', value: 'aria' },
  { label: 'Form Accessibility', value: 'forms' },
  { label: 'Images', value: 'images' },
  { label: 'Modals & Dialogs', value: 'modals' },
  { label: 'Keyboard Navigation', value: 'keyboard' },
  { label: 'Color Contrast', value: 'contrast' }
]

// Computed
const filteredIssues = computed(() => {
  let filtered = issues.value

  if (selectedSeverity.value) {
    filtered = filtered.filter(issue => issue.severity === selectedSeverity.value)
  }

  if (selectedCategory.value) {
    filtered = filtered.filter(issue => issue.category === selectedCategory.value)
  }

  return filtered
})

const canAutoFix = computed(() => {
  return filteredIssues.value.some(issue => issue.autoFixable)
})

// Methods
const startScan = async () => {
  isScanning.value = true
  scanProgress.value = 0
  currentStatus.value = 'Initializing scan...'

  try {
    // Simulate scanning with progress updates
    const result = await scanForAccessibilityIssues((progress, status) => {
      scanProgress.value = progress
      currentStatus.value = status
    })

    scanResults.value = result.summary
    issues.value = result.issues

    toast.add({
      severity: result.summary.critical > 0 ? 'error' : 'success',
      summary: 'Scan Complete',
      detail: `Found ${result.issues.length} accessibility issues`,
      life: 5000
    })
  } catch (error) {
    console.error('Scan failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Scan Failed',
      detail: error.message,
      life: 5000
    })
  } finally {
    isScanning.value = false
    scanProgress.value = 100
  }
}

const stopScan = () => {
  isScanning.value = false
  currentStatus.value = 'Scan stopped by user'
  toast.add({
    severity: 'warn',
    summary: 'Scan Stopped',
    detail: 'Accessibility scan was interrupted',
    life: 3000
  })
}

const getSeverityColor = (severity) => {
  const colors = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'secondary'
  }
  return colors[severity] || 'secondary'
}

const viewIssue = (issue) => {
  selectedIssue.value = issue
  showIssueDialog.value = true
}

const autoFixIssue = async (issue) => {
  try {
    currentStatus.value = `Fixing issue in ${issue.component}...`
    await applyAutoFix(issue)

    // Remove from issues list
    issues.value = issues.value.filter(i => i.id !== issue.id)

    // Update counters
    scanResults.value[issue.severity]--
    scanResults.value.passed++

    toast.add({
      severity: 'success',
      summary: 'Issue Fixed',
      detail: `Fixed ${issue.issue} in ${issue.component}`,
      life: 3000
    })
  } catch (error) {
    console.error('Auto-fix failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Fix Failed',
      detail: error.message,
      life: 5000
    })
  }
}

const autoFixAll = async () => {
  const fixableIssues = filteredIssues.value.filter(i => i.autoFixable)

  if (fixableIssues.length === 0) {
    toast.add({
      severity: 'info',
      summary: 'No Fixable Issues',
      detail: 'There are no issues that can be automatically fixed',
      life: 3000
    })
    return
  }

  let fixed = 0
  let failed = 0

  for (const issue of fixableIssues) {
    try {
      await applyAutoFix(issue)
      fixed++
      issues.value = issues.value.filter(i => i.id !== issue.id)
      scanResults.value[issue.severity]--
      scanResults.value.passed++
    } catch (error) {
      console.error(`Failed to fix issue in ${issue.component}:`, error)
      failed++
    }
  }

  toast.add({
    severity: failed === 0 ? 'success' : 'warn',
    summary: 'Auto-Fix Complete',
    detail: `Fixed ${fixed} issues. ${failed > 0 ? `${failed} failed.` : ''}`,
    life: 5000
  })
}

const applyFix = async (issue) => {
  await autoFixIssue(issue)
  showIssueDialog.value = false
  selectedIssue.value = null
}
</script>

<style scoped>
.accessibility-agent {
  padding: 1rem;
}

code {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>

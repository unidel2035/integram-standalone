<template>
  <div class="agent-knowledge-base">
    <!-- Header -->
    <div class="kb-header">
      <h2>Knowledge Base</h2>
      <p class="text-color-secondary">
        Upload documents to enhance your agent with domain-specific knowledge
      </p>
    </div>

    <!-- Upload Section -->
    <div class="upload-section">
      <div
        class="upload-dropzone"
        :class="{ 'drag-over': isDragOver, 'uploading': isUploading }"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.csv,.json"
          @change="handleFileSelect"
          style="display: none"
        />

        <div v-if="isUploading" class="upload-progress">
          <ProgressSpinner style="width: 50px; height: 50px" />
          <p>Uploading {{ uploadProgress.current }} of {{ uploadProgress.total }}...</p>
          <ProgressBar :value="uploadProgress.percent" style="width: 80%" />
        </div>

        <div v-else class="upload-content">
          <i class="pi pi-cloud-upload upload-icon"></i>
          <p class="upload-title">Drop files here or click to browse</p>
          <p class="upload-hint">
            Supported: PDF, DOCX, TXT, MD, CSV, JSON (max 50MB per file)
          </p>
        </div>
      </div>
    </div>

    <!-- Processing Options -->
    <div class="processing-options">
      <h4>Processing Options</h4>
      <div class="options-grid">
        <div class="option-item">
          <label>Chunk Size</label>
          <Dropdown
            v-model="processingOptions.chunkSize"
            :options="chunkSizeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select chunk size"
          />
        </div>
        <div class="option-item">
          <label>Overlap</label>
          <Dropdown
            v-model="processingOptions.overlap"
            :options="overlapOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select overlap"
          />
        </div>
        <div class="option-item">
          <label>Embedding Model</label>
          <Dropdown
            v-model="processingOptions.embeddingModel"
            :options="embeddingModels"
            optionLabel="label"
            optionValue="value"
            placeholder="Select model"
          />
        </div>
        <div class="option-item checkbox-item">
          <Checkbox
            v-model="processingOptions.extractMetadata"
            :binary="true"
            inputId="extractMetadata"
          />
          <label for="extractMetadata">Extract metadata</label>
        </div>
      </div>
    </div>

    <!-- Documents List -->
    <div class="documents-section">
      <div class="section-header">
        <h4>Documents ({{ documents.length }})</h4>
        <div class="section-actions">
          <Button
            v-if="selectedDocuments.length > 0"
            label="Delete Selected"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            outlined
            @click="deleteSelected"
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            outlined
            @click="loadDocuments"
            :loading="isLoading"
          />
        </div>
      </div>

      <DataTable
        v-if="documents.length > 0"
        v-model:selection="selectedDocuments"
        :value="documents"
        :loading="isLoading"
        dataKey="id"
        responsiveLayout="scroll"
        class="documents-table"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem" />

        <Column field="name" header="Document" sortable>
          <template #body="{ data }">
            <div class="document-cell">
              <i :class="getFileIcon(data.type)" class="file-icon"></i>
              <div class="document-info">
                <span class="document-name">{{ data.name }}</span>
                <span class="document-type">{{ data.type.toUpperCase() }}</span>
              </div>
            </div>
          </template>
        </Column>

        <Column field="size" header="Size" sortable>
          <template #body="{ data }">
            {{ formatFileSize(data.size) }}
          </template>
        </Column>

        <Column field="chunks" header="Chunks" sortable>
          <template #body="{ data }">
            <Tag :value="`${data.chunks} chunks`" severity="info" />
          </template>
        </Column>

        <Column field="status" header="Status" sortable>
          <template #body="{ data }">
            <Tag
              :value="data.status"
              :severity="getStatusSeverity(data.status)"
            />
          </template>
        </Column>

        <Column field="createdAt" header="Added" sortable>
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>

        <Column header="Actions" style="width: 120px">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-eye"
                severity="secondary"
                text
                rounded
                @click="previewDocument(data)"
                v-tooltip.top="'Preview'"
              />
              <Button
                icon="pi pi-refresh"
                severity="secondary"
                text
                rounded
                @click="reprocessDocument(data)"
                v-tooltip.top="'Reprocess'"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="deleteDocument(data)"
                v-tooltip.top="'Delete'"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <div v-else class="empty-state">
        <i class="pi pi-folder-open empty-icon"></i>
        <p>No documents uploaded yet</p>
        <p class="text-color-secondary">
          Upload documents to build your knowledge base
        </p>
      </div>
    </div>

    <!-- Knowledge Base Stats -->
    <div class="kb-stats" v-if="stats.totalDocuments > 0">
      <div class="stat-card">
        <i class="pi pi-file stat-icon"></i>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalDocuments }}</span>
          <span class="stat-label">Documents</span>
        </div>
      </div>
      <div class="stat-card">
        <i class="pi pi-th-large stat-icon"></i>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalChunks }}</span>
          <span class="stat-label">Chunks</span>
        </div>
      </div>
      <div class="stat-card">
        <i class="pi pi-database stat-icon"></i>
        <div class="stat-content">
          <span class="stat-value">{{ formatFileSize(stats.totalSize) }}</span>
          <span class="stat-label">Total Size</span>
        </div>
      </div>
      <div class="stat-card">
        <i class="pi pi-check-circle stat-icon success"></i>
        <div class="stat-content">
          <span class="stat-value">{{ stats.indexedDocuments }}</span>
          <span class="stat-label">Indexed</span>
        </div>
      </div>
    </div>

    <!-- Link to Agent -->
    <div class="link-section" v-if="agentId">
      <h4>Agent Integration</h4>
      <div class="integration-status">
        <i class="pi pi-link"></i>
        <span>
          This knowledge base is linked to agent: <strong>{{ agentId }}</strong>
        </span>
        <Tag value="RAG Enabled" severity="success" />
      </div>
    </div>

    <!-- Document Preview Dialog -->
    <Dialog
      v-model:visible="showPreviewDialog"
      :header="previewDocument?.name || 'Document Preview'"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '1000px' }"
      class="preview-dialog"
    >
      <div v-if="previewContent" class="preview-content">
        <div class="preview-metadata">
          <Tag :value="previewDocument?.type.toUpperCase()" />
          <span>{{ formatFileSize(previewDocument?.size) }}</span>
          <span>{{ previewDocument?.chunks }} chunks</span>
        </div>
        <div class="preview-text">
          <pre>{{ previewContent }}</pre>
        </div>
      </div>
      <div v-else class="preview-loading">
        <ProgressSpinner />
        <p>Loading preview...</p>
      </div>
    </Dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import ProgressBar from 'primevue/progressbar'
import ConfirmDialog from 'primevue/confirmdialog'
import axios from 'axios'

const props = defineProps({
  agentId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['uploaded', 'deleted', 'updated'])

const toast = useToast()
const confirm = useConfirm()

// State
const fileInput = ref(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const isLoading = ref(false)
const documents = ref([])
const selectedDocuments = ref([])
const showPreviewDialog = ref(false)
const previewDocument = ref(null)
const previewContent = ref(null)

const uploadProgress = reactive({
  current: 0,
  total: 0,
  percent: 0
})

const processingOptions = reactive({
  chunkSize: 1000,
  overlap: 200,
  embeddingModel: 'default',
  extractMetadata: true
})

const stats = reactive({
  totalDocuments: 0,
  totalChunks: 0,
  totalSize: 0,
  indexedDocuments: 0
})

// Options
const chunkSizeOptions = [
  { label: 'Small (500 chars)', value: 500 },
  { label: 'Medium (1000 chars)', value: 1000 },
  { label: 'Large (2000 chars)', value: 2000 },
  { label: 'XL (4000 chars)', value: 4000 }
]

const overlapOptions = [
  { label: 'None (0)', value: 0 },
  { label: 'Small (100)', value: 100 },
  { label: 'Medium (200)', value: 200 },
  { label: 'Large (500)', value: 500 }
]

const embeddingModels = [
  { label: 'Default (text-embedding-3-small)', value: 'default' },
  { label: 'Large (text-embedding-3-large)', value: 'large' },
  { label: 'Ada v2', value: 'ada-002' }
]

// API base URL
const API_URL = import.meta.env.VITE_API_URL || ''

// Methods
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleDragOver = () => {
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (event) => {
  isDragOver.value = false
  const files = Array.from(event.dataTransfer.files)
  uploadFiles(files)
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  uploadFiles(files)
  event.target.value = '' // Reset input
}

const uploadFiles = async (files) => {
  if (files.length === 0) return

  // Validate files
  const validFiles = files.filter(file => {
    const ext = file.name.split('.').pop().toLowerCase()
    const validExtensions = ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'json']
    const maxSize = 50 * 1024 * 1024 // 50MB

    if (!validExtensions.includes(ext)) {
      toast.add({
        severity: 'warn',
        summary: 'Invalid File Type',
        detail: `${file.name} is not supported`,
        life: 3000
      })
      return false
    }

    if (file.size > maxSize) {
      toast.add({
        severity: 'warn',
        summary: 'File Too Large',
        detail: `${file.name} exceeds 50MB limit`,
        life: 3000
      })
      return false
    }

    return true
  })

  if (validFiles.length === 0) return

  isUploading.value = true
  uploadProgress.current = 0
  uploadProgress.total = validFiles.length
  uploadProgress.percent = 0

  try {
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      uploadProgress.current = i + 1
      uploadProgress.percent = Math.round(((i + 1) / validFiles.length) * 100)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('chunkSize', processingOptions.chunkSize)
      formData.append('overlap', processingOptions.overlap)
      formData.append('embeddingModel', processingOptions.embeddingModel)
      formData.append('extractMetadata', processingOptions.extractMetadata)

      if (props.agentId) {
        formData.append('agentId', props.agentId)
      }

      await axios.post(`${API_URL}/api/knowledge-base/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }

    toast.add({
      severity: 'success',
      summary: 'Upload Complete',
      detail: `Successfully uploaded ${validFiles.length} file(s)`,
      life: 3000
    })

    await loadDocuments()
    emit('uploaded', validFiles.length)
  } catch (error) {
    console.error('Upload error:', error)
    toast.add({
      severity: 'error',
      summary: 'Upload Failed',
      detail: error.response?.data?.message || error.message,
      life: 5000
    })
  } finally {
    isUploading.value = false
  }
}

const loadDocuments = async () => {
  isLoading.value = true
  try {
    const params = props.agentId ? { agentId: props.agentId } : {}
    const response = await axios.get(`${API_URL}/api/knowledge-base/documents`, { params })

    documents.value = response.data.documents || []

    // Calculate stats
    stats.totalDocuments = documents.value.length
    stats.totalChunks = documents.value.reduce((sum, doc) => sum + (doc.chunks || 0), 0)
    stats.totalSize = documents.value.reduce((sum, doc) => sum + (doc.size || 0), 0)
    stats.indexedDocuments = documents.value.filter(doc => doc.status === 'indexed').length
  } catch (error) {
    console.error('Failed to load documents:', error)
    // Use mock data for development
    documents.value = []
  } finally {
    isLoading.value = false
  }
}

const deleteDocument = (doc) => {
  confirm.require({
    message: `Are you sure you want to delete "${doc.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await axios.delete(`${API_URL}/api/knowledge-base/documents/${doc.id}`)
        await loadDocuments()
        emit('deleted', doc.id)
        toast.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `${doc.name} has been deleted`,
          life: 3000
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: error.message,
          life: 5000
        })
      }
    }
  })
}

const deleteSelected = () => {
  if (selectedDocuments.value.length === 0) return

  confirm.require({
    message: `Are you sure you want to delete ${selectedDocuments.value.length} document(s)?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const deletePromises = selectedDocuments.value.map(doc =>
          axios.delete(`${API_URL}/api/knowledge-base/documents/${doc.id}`)
        )
        await Promise.all(deletePromises)
        await loadDocuments()
        selectedDocuments.value = []
        toast.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Selected documents have been deleted',
          life: 3000
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: error.message,
          life: 5000
        })
      }
    }
  })
}

const reprocessDocument = async (doc) => {
  try {
    await axios.post(`${API_URL}/api/knowledge-base/documents/${doc.id}/reprocess`, {
      chunkSize: processingOptions.chunkSize,
      overlap: processingOptions.overlap,
      embeddingModel: processingOptions.embeddingModel
    })

    toast.add({
      severity: 'info',
      summary: 'Reprocessing',
      detail: `${doc.name} is being reprocessed`,
      life: 3000
    })

    // Reload after a delay to get updated status
    setTimeout(loadDocuments, 2000)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Reprocess Failed',
      detail: error.message,
      life: 5000
    })
  }
}

const previewDocumentHandler = async (doc) => {
  previewDocument.value = doc
  previewContent.value = null
  showPreviewDialog.value = true

  try {
    const response = await axios.get(
      `${API_URL}/api/knowledge-base/documents/${doc.id}/preview`
    )
    previewContent.value = response.data.content
  } catch (error) {
    previewContent.value = 'Failed to load preview: ' + error.message
  }
}

// Utility functions
const getFileIcon = (type) => {
  const icons = {
    pdf: 'pi pi-file-pdf',
    docx: 'pi pi-file-word',
    doc: 'pi pi-file-word',
    txt: 'pi pi-file',
    md: 'pi pi-file',
    csv: 'pi pi-file-excel',
    json: 'pi pi-file'
  }
  return icons[type?.toLowerCase()] || 'pi pi-file'
}

const getStatusSeverity = (status) => {
  const severities = {
    indexed: 'success',
    processing: 'info',
    pending: 'warning',
    error: 'danger'
  }
  return severities[status] || 'secondary'
}

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.agent-knowledge-base {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.kb-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.upload-section {
  margin-bottom: 1rem;
}

.upload-dropzone {
  border: 2px dashed var(--surface-border);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--surface-ground);
}

.upload-dropzone:hover {
  border-color: var(--p-primary-color);
  background: var(--surface-hover);
}

.upload-dropzone.drag-over {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

.upload-dropzone.uploading {
  cursor: default;
}

.upload-icon {
  font-size: 3rem;
  color: var(--p-text-muted-color);
  margin-bottom: 1rem;
}

.upload-title {
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
}

.upload-hint {
  color: var(--p-text-muted-color);
  margin: 0;
  font-size: 0.875rem;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.processing-options {
  background: var(--surface-card, #f7f7f5);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--surface-border);
}

.processing-options h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-item label {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.option-item.checkbox-item {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.documents-section {
  background: var(--surface-card, #f7f7f5);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--surface-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 0.5rem;
}

.documents-table {
  border: none;
}

.document-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

.document-info {
  display: flex;
  flex-direction: column;
}

.document-name {
  font-weight: 500;
}

.document-type {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  font-size: 4rem;
  color: var(--p-text-muted-color);
  margin-bottom: 1rem;
}

.kb-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--surface-card, #f7f7f5);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

.stat-icon.success {
  color: var(--p-green-500);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.link-section {
  background: var(--surface-card, #f7f7f5);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--surface-border);
}

.link-section h4 {
  margin: 0 0 0.75rem 0;
}

.integration-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-text-muted-color);
}

.integration-status i {
  color: var(--p-green-500);
}

.preview-dialog .preview-content {
  max-height: 60vh;
  overflow: auto;
}

.preview-metadata {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.preview-text {
  background: var(--surface-ground);
  padding: 1rem;
  border-radius: 8px;
  max-height: 50vh;
  overflow: auto;
}

.preview-text pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  font-size: 0.875rem;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}
</style>

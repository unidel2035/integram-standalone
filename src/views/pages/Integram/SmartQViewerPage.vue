<template>
  <div class="smartq-viewer-page">
    <Toast />
    <ConfirmDialog />

    <!-- Breadcrumb -->
    <div class="mb-3">
      <IntegramBreadcrumb :items="breadcrumbItems" />
    </div>

    <Card>
      <template #title>
        <div class="flex align-items-center justify-content-between flex-wrap gap-2">
          <span><i class="pi pi-table mr-2" />SmartQ Viewer</span>
          <div class="flex gap-2 align-items-center">
            <!-- Report ID input (when no reportId in URL) -->
            <template v-if="!routeReportId">
              <InputNumber
                v-model="reportIdInput"
                :placeholder="$t('smartq.reportIdPlaceholder')"
                style="width: 10rem"
                size="small"
              />
              <Button
                :label="$t('smartq.loadReport')"
                icon="pi pi-search"
                size="small"
                :disabled="!reportIdInput"
                @click="loadReport"
              />
            </template>

            <!-- Editability toggle -->
            <Button
              v-if="currentReportId"
              :icon="editOverride === true ? 'pi pi-lock-open' : editOverride === false ? 'pi pi-lock' : 'pi pi-key'"
              :label="editLabel"
              size="small"
              severity="secondary"
              outlined
              v-tooltip.bottom="$t('smartq.toggleEditTooltip')"
              @click="cycleEditOverride"
            />
          </div>
        </div>
      </template>

      <template #content>
        <SmartQViewer
          v-if="currentReportId"
          :report-id="currentReportId"
          :editable="editOverride"
          :drag-enabled="true"
          @error="handleError"
          @loaded="handleLoaded"
        />

        <div v-else class="text-center py-6 surface-ground border-round">
          <i class="pi pi-table text-5xl text-color-secondary mb-3 block" />
          <h4 class="m-0 mb-2">{{ $t('smartq.noReportLoaded') }}</h4>
          <p class="text-color-secondary m-0">{{ $t('smartq.enterReportIdToStart') }}</p>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue'
import SmartQViewer from '@/components/integram/SmartQViewer.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

// Route param (may be undefined when navigating to /integram/smartq-viewer without ID)
const routeReportId = computed(() => {
  const id = route.params.reportId
  return id ? parseInt(id, 10) : null
})

const reportIdInput = ref(null)
const currentReportId = ref(routeReportId.value)

// undefined = auto (use sq-granted from API), true = force editable, false = force readonly
const editOverride = ref(undefined)

const editLabel = computed(() => {
  if (editOverride.value === true) return t('smartq.editMode.on')
  if (editOverride.value === false) return t('smartq.editMode.off')
  return t('smartq.editMode.auto')
})

function cycleEditOverride() {
  if (editOverride.value === undefined) editOverride.value = true
  else if (editOverride.value === true) editOverride.value = false
  else editOverride.value = undefined
}

function loadReport() {
  if (!reportIdInput.value) return
  currentReportId.value = reportIdInput.value
  router.replace({ params: { reportId: reportIdInput.value } })
}

function handleError(err) {
  toast.add({ severity: 'error', summary: t('smartq.errors.loadFailed'), detail: err, life: 5000 })
}

function handleLoaded(data) {
  // Update page title with report name if available
  if (data?.title) {
    document.title = `${data.title} – SmartQ Viewer`
  }
}

// Sync route param → currentReportId
watch(routeReportId, (id) => {
  if (id) currentReportId.value = id
})

// Breadcrumb
const breadcrumbItems = computed(() => {
  const items = [
    { label: 'SmartQ Viewer', icon: 'pi pi-table', to: '/integram/smartq-viewer' }
  ]
  if (currentReportId.value) {
    items.push({ label: `#${currentReportId.value}`, icon: 'pi pi-file' })
  }
  return items
})
</script>

<style scoped>
.smartq-viewer-page {
  width: 100%;
}
</style>

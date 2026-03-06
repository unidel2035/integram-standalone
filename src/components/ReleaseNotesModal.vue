<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import packageJson from '../../package.json'
import { parseChangelog, extractHighlights } from '@/services/releaseManagementService'
import changelogRaw from '../../CHANGELOG.md?raw'

const { t } = useI18n()

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:visible', 'close'])

const currentVersion = ref(packageJson.version)
const lastSeenVersion = ref(null)
const showModal = ref(false)
const autoDismissTimer = ref(null)

// Parse CHANGELOG.md into structured releases
const releases = computed(() => parseChangelog(changelogRaw))
const latestRelease = computed(() => releases.value[0] || null)
const highlights = computed(() => latestRelease.value ? extractHighlights(latestRelease.value) : [])

const shouldShowModal = computed(() => {
    if (!lastSeenVersion.value) return true
    return currentVersion.value !== lastSeenVersion.value
})

const closeModal = () => {
    showModal.value = false
    emit('update:visible', false)
    emit('close')
    localStorage.setItem('lastSeenVersion', currentVersion.value)
    lastSeenVersion.value = currentVersion.value
    if (autoDismissTimer.value) {
        clearTimeout(autoDismissTimer.value)
        autoDismissTimer.value = null
    }
}

const startAutoDismissTimer = () => {
    autoDismissTimer.value = setTimeout(() => {
        closeModal()
    }, 5000)
}

const handleEscKey = (event) => {
    if (event.key === 'Escape' && showModal.value) {
        closeModal()
    }
}

onMounted(() => {
    lastSeenVersion.value = localStorage.getItem('lastSeenVersion')

    if (shouldShowModal.value && props.visible !== false) {
        showModal.value = true
        emit('update:visible', true)
        startAutoDismissTimer()
    }

    document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
    if (autoDismissTimer.value) {
        clearTimeout(autoDismissTimer.value)
    }
    document.removeEventListener('keydown', handleEscKey)
})

watch(showModal, (newValue) => {
    if (newValue) {
        startAutoDismissTimer()
    } else {
        if (autoDismissTimer.value) {
            clearTimeout(autoDismissTimer.value)
            autoDismissTimer.value = null
        }
    }
})
</script>

<template>
    <Dialog
        v-if="latestRelease"
        v-model:visible="showModal"
        :header="t('releaseNotes.whatsNew', { version: latestRelease.version })"
        :modal="true"
        :closable="true"
        :dismissableMask="true"
        :style="{ width: '50rem' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
        @hide="closeModal"
    >
        <div class="release-notes-content">
            <div class="mb-4">
                <p class="text-muted-color text-sm">{{ t('releaseNotes.releasedOn', { date: latestRelease.date }) }}</p>
            </div>

            <div v-if="highlights.length > 0" class="mb-5">
                <h3 class="text-lg font-semibold mb-3">{{ t('releaseNotes.highlights') }}</h3>
                <ul class="list-disc pl-5 space-y-2">
                    <li v-for="(highlight, index) in highlights" :key="index" class="text-color">
                        {{ highlight }}
                    </li>
                </ul>
            </div>

            <div v-if="latestRelease.sections.added.length > 0" class="mb-4">
                <h4 class="font-semibold mb-2 text-green-600">{{ t('releaseNotes.added') }}</h4>
                <ul class="list-disc pl-5 space-y-1">
                    <li v-for="(item, index) in latestRelease.sections.added" :key="index" class="text-sm">
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div v-if="latestRelease.sections.changed.length > 0" class="mb-4">
                <h4 class="font-semibold mb-2 text-blue-600">{{ t('releaseNotes.changed') }}</h4>
                <ul class="list-disc pl-5 space-y-1">
                    <li v-for="(item, index) in latestRelease.sections.changed" :key="index" class="text-sm">
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div v-if="latestRelease.sections.fixed.length > 0" class="mb-4">
                <h4 class="font-semibold mb-2 text-orange-600">{{ t('releaseNotes.fixed') }}</h4>
                <ul class="list-disc pl-5 space-y-1">
                    <li v-for="(item, index) in latestRelease.sections.fixed" :key="index" class="text-sm">
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div v-if="latestRelease.sections.performance.length > 0" class="mb-4">
                <h4 class="font-semibold mb-2 text-purple-600">{{ t('releaseNotes.performance') }}</h4>
                <ul class="list-disc pl-5 space-y-1">
                    <li v-for="(item, index) in latestRelease.sections.performance" :key="index" class="text-sm">
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div v-if="latestRelease.sections.documentation.length > 0" class="mb-4">
                <h4 class="font-semibold mb-2 text-gray-600">{{ t('releaseNotes.documentation') }}</h4>
                <ul class="list-disc pl-5 space-y-1">
                    <li v-for="(item, index) in latestRelease.sections.documentation" :key="index" class="text-sm">
                        {{ item }}
                    </li>
                </ul>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center w-full">
                <span class="text-sm text-muted-color">v{{ currentVersion }}</span>
                <Button
                    :label="t('releaseNotes.gotIt')"
                    icon="pi pi-check"
                    @click="closeModal"
                    autofocus
                />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.release-notes-content {
    max-height: 60vh;
    overflow-y: auto;
}

.release-notes-content h3 {
    color: var(--primary-color);
}

.release-notes-content ul {
    color: var(--text-color);
}
</style>

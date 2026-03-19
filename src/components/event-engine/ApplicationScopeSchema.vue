<template>
  <div v-if="tree" class="scope-schema">
    <div class="schema-header">
      <i class="pi pi-sitemap" />
      <span>Схема связей приложения</span>
    </div>
    <div class="schema-tree">
      <div class="tree-root">
        <div class="tree-node app-node">
          <i class="pi pi-box" />
          <span>{{ tree.name }}</span>
        </div>
        <div class="tree-children">
          <div v-for="model in tree.models" :key="model.id" class="tree-branch">
            <div class="tree-node model-node" @click="$emit('open-model', model.id)">
              <i class="pi pi-cog" />
              <span>{{ model.name }}</span>
              <span v-if="model.concept" class="node-sub">{{ model.concept }}</span>
            </div>
            <div v-if="model.individuals.length" class="tree-children">
              <div v-for="ind in model.individuals" :key="ind.id" class="tree-node ind-node">
                <i class="pi pi-user" />
                <span>{{ ind.name }}</span>
              </div>
            </div>
          </div>
          <div v-if="tree.vocabularies.length" class="tree-branch">
            <div class="tree-node vocab-group">
              <i class="pi pi-book" />
              <span>Словари</span>
            </div>
            <div class="tree-children">
              <div v-for="v in tree.vocabularies" :key="v.id" class="tree-node vocab-node">
                <i class="pi pi-book" />
                <span>{{ v.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, inject } from 'vue'
import axios from 'axios'

const props = defineProps({
  applicationId: { type: [String, Number], default: null },
})

defineEmits(['open-model'])

const API = inject('eventEngineAPI')
const tree = ref(null)

async function loadTree() {
  if (!props.applicationId) { tree.value = null; return }
  try {
    const [appRes, scopeRes, modelsRes, individualsRes, vocabsRes] = await Promise.all([
      axios.get(`${API}/applications`),
      axios.get(`${API}/applications/${props.applicationId}/scope`),
      axios.get(`${API}/models`),
      axios.get(`${API}/individuals`),
      axios.get(`${API}/vocabularies`),
    ])
    const apps = appRes.data?.data || []
    const scope = scopeRes.data?.data
    const allModels = modelsRes.data?.data || []
    const allIndividuals = individualsRes.data?.data || []
    const allVocabs = vocabsRes.data?.data || []
    const app = apps.find(a => String(a.id) === String(props.applicationId))
    if (!app || !scope || scope.unrestricted) { tree.value = null; return }

    const scopeModels = allModels.filter(m => scope.modelIds.includes(String(m.id)))
    const models = scopeModels.map(m => {
      const conceptId = m.reqs?.['Концепт']?.value
      const conceptName = conceptId
        ? (allIndividuals.find(i => false) || { val: '' }).val // placeholder
        : null
      // Find concept name from concepts — but we have individuals, let's use model's concept ref display name
      const conceptDisplay = m.reqs?.['Концепт']?.display || m.reqs?.['Концепт']?.value || ''
      const individuals = allIndividuals.filter(i => {
        const iConceptId = i.reqs?.['Концепт']?.value
        return iConceptId && String(iConceptId) === String(conceptId)
      }).slice(0, 8).map(i => ({ id: i.id, name: i.val }))
      return { id: m.id, name: m.val, concept: conceptDisplay, individuals }
    })
    const vocabularies = allVocabs
      .filter(v => scope.vocabularyIds.includes(String(v.id)))
      .map(v => ({ id: v.id, name: v.val }))

    tree.value = { name: app.val, models, vocabularies }
  } catch (e) {
    console.error('[ScopeSchema]', e)
    tree.value = null
  }
}

watch(() => props.applicationId, loadTree)
onMounted(loadTree)
</script>

<style scoped>
.scope-schema {
  margin-top: 16px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--p-surface-card);
}

.schema-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 12px;
  color: var(--p-text-color);
}

.tree-root {
  padding-left: 0;
}

.tree-children {
  padding-left: 24px;
  border-left: 2px solid var(--p-surface-border);
  margin-left: 10px;
}

.tree-branch {
  margin-bottom: 4px;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  margin: 2px 0;
  white-space: nowrap;
}

.app-node {
  background: var(--p-primary-100);
  color: var(--p-primary-800);
  font-weight: 600;
  font-size: 0.95rem;
}

.model-node {
  background: var(--p-blue-50);
  color: var(--p-blue-800);
  cursor: pointer;
}

.model-node:hover {
  background: var(--p-blue-100);
}

.node-sub {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-left: 4px;
}

.ind-node {
  background: var(--p-green-50);
  color: var(--p-green-800);
  font-size: 0.8rem;
}

.vocab-group {
  background: var(--p-orange-50);
  color: var(--p-orange-800);
  font-weight: 600;
}

.vocab-node {
  background: var(--p-orange-50);
  color: var(--p-orange-800);
  font-size: 0.8rem;
}
</style>

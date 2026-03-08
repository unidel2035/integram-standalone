<template>
  <div class="entity-links-panel">
    <div class="links-header">
      <span class="links-title">
        <i class="pi pi-link" />
        Связи (LinksPlatform)
      </span>
      <Button icon="pi pi-plus" size="small" text @click="showAdd = true" v-tooltip="'Добавить связь'" />
    </div>

    <!-- Существующие связи -->
    <div v-if="links.length" class="links-list">
      <div v-for="link in links" :key="link.id" class="link-item">
        <span class="link-direction">
          <i :class="link.direction === 'outgoing' ? 'pi pi-arrow-right' : 'pi pi-arrow-left'"
             :style="{ color: linkTypeInfo(link.linkType).color }" />
        </span>
        <Tag :value="linkTypeInfo(link.linkType).label"
             :style="{ background: linkTypeInfo(link.linkType).color + '22', color: linkTypeInfo(link.linkType).color, border: 'none' }"
             class="link-type-tag" />
        <span class="link-target">
          {{ link.targetType === 'concept' || link.sourceType === 'concept' ? '🔷' : '🏢' }}
          {{ getLabel(link) }}
        </span>
        <span class="link-weight" v-tooltip="'Сила связи'">{{ link.weight }}%</span>
        <Button icon="pi pi-times" size="small" text severity="danger"
                @click="removeLink(link.id)" class="link-delete" />
      </div>
    </div>
    <div v-else-if="!loading" class="links-empty">
      Связей нет — добавьте концепты онтологии или другие сущности
    </div>
    <div v-if="loading" class="links-loading">
      <i class="pi pi-spin pi-spinner" /> Загрузка...
    </div>

    <!-- Диалог добавления связи -->
    <Dialog v-model:visible="showAdd" header="Добавить связь" :style="{ width: '480px' }" modal>
      <div class="add-link-form">
        <div class="field">
          <label>Тип связи</label>
          <Select v-model="newLink.type" :options="linkTypeOptions"
                  optionLabel="label" optionValue="value"
                  placeholder="Выберите тип" fluid />
        </div>
        <div class="field">
          <label>Тип цели</label>
          <Select v-model="newLink.targetType" :options="targetTypeOptions"
                  optionLabel="label" optionValue="value"
                  placeholder="Выберите тип цели" fluid />
        </div>
        <div class="field">
          <label>ID цели</label>
          <InputText v-model="newLink.targetId" placeholder="ID объекта или концепта" fluid />
          <small v-if="newLink.targetType === 'concept'">
            Концепты БПЛА: typeId 1673250 в базе kval
          </small>
        </div>
        <div class="field">
          <label>Сила связи: {{ newLink.weight }}%</label>
          <Slider v-model="newLink.weight" :min="0" :max="100" />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showAdd = false" />
        <Button label="Добавить" icon="pi pi-check" @click="addLink" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { createLink, getLinks, deleteLink, LINK_TYPES } from '@/services/fstLinksService'

const props = defineProps({
  entityId:   { type: [String, Number], required: true },
  entityType: { type: String, default: 'company' },
  labelMap:   { type: Object, default: () => ({}) }, // id → label для отображения
})

const emit = defineEmits(['link-added', 'link-removed'])

const links   = ref([])
const loading = ref(false)
const saving  = ref(false)
const showAdd = ref(false)
const newLink = ref({ type: 'uses', targetType: 'concept', targetId: '', weight: 70 })

const linkTypeOptions = Object.entries(LINK_TYPES).map(([value, info]) => ({
  value,
  label: info.label,
}))

const targetTypeOptions = [
  { value: 'concept', label: 'Концепт онтологии БПЛА' },
  { value: 'company', label: 'Компания портфеля' },
  { value: 'deal',    label: 'Сделка' },
  { value: 'fund',    label: 'Фонд' },
  { value: 'link',    label: 'Другая связь (гипер-граф)' },
]

function linkTypeInfo(type) {
  return LINK_TYPES[type] || LINK_TYPES['related']
}

function getLabel(link) {
  const id = link.direction === 'outgoing' ? link.targetId : link.sourceId
  if (link.meta?.conceptName) return link.meta.conceptName
  if (link.meta?.companyName && link.direction === 'incoming') return link.meta.companyName
  return props.labelMap[id] || `#${id}`
}

async function load() {
  loading.value = true
  try {
    links.value = await getLinks(props.entityId, props.entityType)
  } finally {
    loading.value = false
  }
}

async function addLink() {
  if (!newLink.value.targetId) return
  saving.value = true
  try {
    const created = await createLink(
      props.entityId,
      props.entityType,
      newLink.value.targetId,
      newLink.value.targetType,
      newLink.value.type,
      newLink.value.weight,
    )
    links.value.push({ ...created, direction: 'outgoing' })
    emit('link-added', created)
    showAdd.value = false
    newLink.value = { type: 'uses', targetType: 'concept', targetId: '', weight: 70 }
  } finally {
    saving.value = false
  }
}

async function removeLink(linkId) {
  await deleteLink(linkId)
  links.value = links.value.filter(l => l.id !== linkId)
  emit('link-removed', linkId)
}

onMounted(load)
watch(() => props.entityId, load)
</script>

<style scoped>
.entity-links-panel {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface-card);
}
.links-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.links-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 6px;
}
.links-list { display: flex; flex-direction: column; gap: 6px; }
.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--surface-ground);
  font-size: 0.85rem;
}
.link-target { flex: 1; color: var(--p-text-color); }
.link-weight { font-size: 0.75rem; color: var(--p-text-muted-color); min-width: 30px; text-align: right; }
.link-delete { margin-left: auto; }
.link-type-tag { font-size: 0.75rem; padding: 2px 6px; }
.links-empty { font-size: 0.8rem; color: var(--p-text-muted-color); padding: 8px 0; text-align: center; }
.links-loading { text-align: center; color: var(--p-text-muted-color); padding: 8px; }
.add-link-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.85rem; font-weight: 500; }
.field small { color: var(--p-text-muted-color); font-size: 0.75rem; }
</style>

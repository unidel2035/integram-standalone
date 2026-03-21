<template>
  <div class="integram-table-view">
    <IntegramDataTableWrapper
      :typeId="typeId"
      :databaseProp="database"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import IntegramDataTableWrapper from '@/components/integram/IntegramDataTableWrapper.vue'

const route = useRoute()
const typeId = computed(() => route.params.typeId)
const database = computed(() => route.params.database || 'fst')
</script>

<style scoped>
.integram-table-view {
  padding: 0;
  height: 100%;
}
</style>

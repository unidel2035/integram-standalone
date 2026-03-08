<template>
  <FstLanding v-if="!isAuth" />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FstLanding from './FstLanding.vue'

const router = useRouter()
const isAuth = computed(() => !!localStorage.getItem('token'))

onMounted(() => {
  if (isAuth.value) router.replace('/fst-hub')
})
</script>

<template>
  <FstLanding v-if="!isAuth" />
  <AppLayout v-else>
    <FstHub />
  </AppLayout>
</template>

<script setup>
import { computed } from 'vue'
import FstLanding from './FstLanding.vue'
import FstHub from './FstHub.vue'
import AppLayout from '@/layout/AppLayout.vue'

const isAuth = computed(() => !!localStorage.getItem('token'))
</script>

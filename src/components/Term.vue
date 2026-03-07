<script setup>
import { ref } from 'vue'

const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['open'])

const handleClick = () => {
  emit('open', props.id)
}
</script>

<template>
  <span
    class="term-wrapper"
    @click="handleClick"
    role="button"
    tabindex="0"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <slot></slot>
  </span>
</template>

<style scoped>
.term-wrapper {
  color: var(--p-primary-color);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline;
}

.term-wrapper:hover {
  color: var(--p-primary-600);
  text-decoration-style: solid;
}

.term-wrapper:focus {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Dark mode */
:root.dark .term-wrapper:hover {
  color: var(--p-primary-400);
}
</style>

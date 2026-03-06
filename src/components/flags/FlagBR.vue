<template>
  <svg :width="width" :height="height" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
    <!-- Green background -->
    <rect fill="#009C3B" width="900" height="600"/>
    <!-- Yellow rhombus -->
    <polygon fill="#FFDF00" points="450,60 840,300 450,540 60,300"/>
    <!-- Blue circle -->
    <circle cx="450" cy="300" r="150" fill="#002776"/>
    <!-- White band -->
    <path d="M 310,230 A 150,150 0 0,1 590,230" fill="none" stroke="white" stroke-width="30"/>
    <!-- Stars (simplified dots) -->
    <circle cx="380" cy="210" r="8" fill="white"/>
    <circle cx="450" cy="195" r="8" fill="white"/>
    <circle cx="520" cy="210" r="8" fill="white"/>
    <circle cx="560" cy="260" r="8" fill="white"/>
    <circle cx="340" cy="260" r="8" fill="white"/>
  </svg>
</template>

<script setup>
defineProps({
  width:  { type: [String, Number], default: 24 },
  height: { type: [String, Number], default: 16 }
})
</script>

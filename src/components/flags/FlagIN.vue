<template>
  <svg :width="width" :height="height" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
    <!-- Saffron stripe -->
    <rect fill="#FF9933" width="900" height="200"/>
    <!-- White stripe -->
    <rect fill="#FFFFFF" y="200" width="900" height="200"/>
    <!-- Green stripe -->
    <rect fill="#138808" y="400" width="900" height="200"/>
    <!-- Ashoka Chakra (simplified blue circle) -->
    <circle cx="450" cy="300" r="70" fill="none" stroke="#000080" stroke-width="8"/>
    <circle cx="450" cy="300" r="10" fill="#000080"/>
    <!-- 24 spokes (simplified as 8 main) -->
    <g stroke="#000080" stroke-width="4">
      <line x1="450" y1="230" x2="450" y2="370"/>
      <line x1="380" y1="300" x2="520" y2="300"/>
      <line x1="400" y1="250" x2="500" y2="350"/>
      <line x1="500" y1="250" x2="400" y2="350"/>
      <line x1="420" y1="234" x2="480" y2="366"/>
      <line x1="480" y1="234" x2="420" y2="366"/>
      <line x1="366" y1="280" x2="534" y2="320"/>
      <line x1="366" y1="320" x2="534" y2="280"/>
    </g>
  </svg>
</template>

<script setup>
defineProps({
  width:  { type: [String, Number], default: 24 },
  height: { type: [String, Number], default: 16 }
})
</script>

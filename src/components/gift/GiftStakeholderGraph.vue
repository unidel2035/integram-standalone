<template>
  <div class="gsg-root">
    <div class="fst-section-title">
      <i class="pi pi-share-alt" />
      Граф взаимности
    </div>
    <div class="gsg-canvas" ref="canvasRef">
      <!-- Edges (SVG layer) -->
      <svg class="gsg-edges" v-if="positionedEdges.length">
        <line
          v-for="(e, i) in positionedEdges"
          :key="'edge-' + i"
          :x1="e.x1" :y1="e.y1"
          :x2="e.x2" :y2="e.y2"
          class="gsg-edge"
          :style="{ opacity: Math.max(0.15, Math.min(1, e.weight)) }"
        />
      </svg>
      <!-- Nodes -->
      <div
        v-for="(p, idx) in positionedPersons"
        :key="p.id || idx"
        class="gsg-node"
        :style="{ left: p.x + 'px', top: p.y + 'px' }"
        :title="p.name"
      >
        <span class="gsg-initials">{{ getInitials(p.name) }}</span>
        <span class="gsg-name">{{ p.name }}</span>
      </div>
    </div>
    <div v-if="!persons.length" class="gsg-empty">
      <i class="pi pi-info-circle" />
      <span>Нет участников для отображения</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  persons: { type: Array, default: () => [] },
  edges:   { type: Array, default: () => [] }
});

const canvasRef = ref(null);

const RADIUS = 140;
const CENTER = 180;
const NODE_SIZE = 48;

const positionedPersons = computed(() => {
  const count = props.persons.length;
  if (!count) return [];
  return props.persons.map((p, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      ...p,
      x: CENTER + RADIUS * Math.cos(angle) - NODE_SIZE / 2,
      y: CENTER + RADIUS * Math.sin(angle) - NODE_SIZE / 2
    };
  });
});

const positionedEdges = computed(() => {
  const pMap = {};
  positionedPersons.value.forEach(p => {
    pMap[p.id] = { x: p.x + NODE_SIZE / 2, y: p.y + NODE_SIZE / 2 };
  });
  return props.edges
    .filter(e => pMap[e.from] && pMap[e.to])
    .map(e => ({
      x1: pMap[e.from].x,
      y1: pMap[e.from].y,
      x2: pMap[e.to].x,
      y2: pMap[e.to].y,
      weight: e.weight ?? 0.5
    }));
});

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
</script>

<style scoped>
.gsg-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gsg-canvas {
  position: relative;
  width: 360px;
  height: 360px;
  margin: 0 auto;
}

.gsg-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.gsg-edge {
  stroke: var(--fst-cyan);
  stroke-width: 2;
  stroke-linecap: round;
}

.gsg-node {
  position: absolute;
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: default;
}

.gsg-initials {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--fst-purple) 18%, transparent);
  border: 2px solid var(--fst-purple);
  color: var(--fst-purple);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.gsg-node:hover .gsg-initials {
  transform: scale(1.15);
  background: color-mix(in srgb, var(--fst-purple) 30%, transparent);
}

.gsg-name {
  font-size: 10px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 64px;
  text-align: center;
}

.gsg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}
</style>

<template>
  <div class="hiw-panel">
    <h3 class="hiw-title">Как это работает</h3>
    <p class="hiw-subtitle">Событийная онтология для чайников</p>

    <!-- Главная схема -->
    <div class="hiw-schema">
      <div
        v-for="(layer, i) in layers"
        :key="layer.key"
        class="hiw-layer"
        :class="{ active: activeLayer === layer.key }"
        @click="activeLayer = layer.key"
      >
        <div class="hiw-layer-icon" :style="{ background: layer.color }">
          <i :class="layer.icon" />
        </div>
        <div class="hiw-layer-body">
          <div class="hiw-layer-name">{{ layer.name }}</div>
          <div class="hiw-layer-desc">{{ layer.shortDesc }}</div>
        </div>
        <div v-if="i < layers.length - 1" class="hiw-arrow">
          <i class="pi pi-arrow-down" />
        </div>
      </div>
    </div>

    <!-- Детали выбранного слоя -->
    <Transition name="fade" mode="out-in">
      <div :key="activeLayer" class="hiw-detail">
        <div class="hiw-detail-header" :style="{ borderLeftColor: activeDetail.color }">
          <i :class="activeDetail.icon" :style="{ color: activeDetail.color }" />
          <h4>{{ activeDetail.name }}</h4>
          <Tag :value="activeDetail.tag" :style="{ background: activeDetail.color }" />
        </div>

        <p class="hiw-detail-explain">{{ activeDetail.explain }}</p>

        <!-- Аналогия из жизни -->
        <div class="hiw-analogy">
          <i class="pi pi-lightbulb" />
          <div>
            <strong>Аналогия:</strong>
            <span>{{ activeDetail.analogy }}</span>
          </div>
        </div>

        <!-- Примеры из системы -->
        <div class="hiw-examples">
          <div class="hiw-examples-title">Примеры в DronDoc:</div>
          <div class="hiw-example-cards">
            <div v-for="ex in activeDetail.examples" :key="ex.name" class="hiw-example-card">
              <div class="hiw-example-name">{{ ex.name }}</div>
              <div class="hiw-example-desc">{{ ex.desc }}</div>
            </div>
          </div>
        </div>

        <!-- Что внутри (для модели) -->
        <div v-if="activeDetail.contains" class="hiw-contains">
          <div class="hiw-contains-title">Что внутри модели:</div>
          <div class="hiw-contains-grid">
            <div v-for="item in activeDetail.contains" :key="item.name" class="hiw-contains-item">
              <i :class="item.icon" :style="{ color: item.color }" />
              <div>
                <strong>{{ item.name }}</strong>
                <span>{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Живая диаграмма потока -->
    <div class="hiw-flow">
      <div class="hiw-flow-title">Как работает один цикл</div>
      <div class="hiw-flow-steps">
        <div
          v-for="(step, i) in flowSteps"
          :key="i"
          class="hiw-flow-step"
          :class="{ highlight: flowActive === i }"
        >
          <div class="hiw-flow-num">{{ i + 1 }}</div>
          <div class="hiw-flow-content">
            <div class="hiw-flow-action">{{ step.action }}</div>
            <div class="hiw-flow-result">{{ step.result }}</div>
          </div>
          <div v-if="i < flowSteps.length - 1" class="hiw-flow-arrow">
            <i class="pi pi-arrow-right" />
          </div>
        </div>
      </div>
      <Button
        :label="flowRunning ? 'Остановить' : 'Запустить анимацию'"
        :icon="flowRunning ? 'pi pi-pause' : 'pi pi-play'"
        severity="secondary"
        size="small"
        outlined
        @click="toggleFlow"
        class="hiw-flow-btn"
      />
    </div>

    <!-- 10 доменов -->
    <div class="hiw-domains">
      <div class="hiw-domains-title">10 доменов DronDoc</div>
      <div class="hiw-domain-grid">
        <div v-for="d in domains" :key="d.prefix" class="hiw-domain-chip" :style="{ borderColor: d.color }">
          <div class="hiw-domain-prefix" :style="{ color: d.color }">{{ d.prefix }}.*</div>
          <div class="hiw-domain-name">{{ d.name }}</div>
          <div class="hiw-domain-count">{{ d.events }} событий</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const activeLayer = ref('domain')

const layers = [
  {
    key: 'domain',
    name: 'Домен',
    shortDesc: 'Предметная область',
    icon: 'pi pi-globe',
    color: '#6366f1',
  },
  {
    key: 'concept',
    name: 'Концепт',
    shortDesc: 'Класс сущностей',
    icon: 'pi pi-sitemap',
    color: '#8b5cf6',
  },
  {
    key: 'model',
    name: 'Модель',
    shortDesc: 'Исполняемая схема',
    icon: 'pi pi-cog',
    color: '#06b6d4',
  },
  {
    key: 'individual',
    name: 'Индивид',
    shortDesc: 'Конкретный экземпляр',
    icon: 'pi pi-user',
    color: '#10b981',
  },
]

const details = {
  domain: {
    name: 'Домен',
    icon: 'pi pi-globe',
    color: '#6366f1',
    tag: 'Верхний уровень',
    explain: 'Домен — это большая предметная область. Как папка в проводнике, которая группирует всё, что относится к одной теме. В DronDoc 10 доменов — от разработки ПО до страхования дронов.',
    analogy: 'Домен — это как факультет в университете. Физика, математика, история — каждый про своё, но все в одном здании.',
    examples: [
      { name: 'DevOps (dev.*)', desc: 'Разработка, CI/CD, деплой' },
      { name: 'Swarm (swarm.*)', desc: 'Координация роёв дронов' },
      { name: 'Insurance (risk.*)', desc: 'Страхование и оценка рисков' },
    ],
  },
  concept: {
    name: 'Концепт',
    icon: 'pi pi-sitemap',
    color: '#8b5cf6',
    tag: 'Что моделируем',
    explain: 'Концепт — это тип сущности, шаблон. Он описывает «о чём» мы говорим. Как слово «автомобиль» описывает целый класс машин, не конкретную.',
    analogy: 'Концепт — как рецепт торта. Он описывает что нужно делать, но сам торт — это индивид.',
    examples: [
      { name: 'Разработка_ПО', desc: 'Процесс создания софта от задачи до деплоя' },
      { name: 'Координация_роя', desc: 'Управление группой дронов в миссии' },
      { name: 'Обучение_операторов', desc: 'Тренировка людей на тренажёрах' },
    ],
  },
  model: {
    name: 'Модель',
    icon: 'pi pi-cog',
    color: '#06b6d4',
    tag: 'Как работает',
    explain: 'Модель — это исполняемая схема поведения. Она говорит «как» всё устроено: какие события могут произойти, какие есть состояния, что автоматически запускается.',
    analogy: 'Модель — как правила настольной игры. Они описывают какие ходы возможны, когда можно ходить, и что происходит при каждом ходе.',
    examples: [
      { name: 'Модель_разработки_ПО', desc: '34 события, 8 состояний FSM, 13 переходов' },
      { name: 'Модель_координации_роя', desc: 'Миссии, назначение дронов, выбор лидера' },
      { name: 'Модель_цифрового_двойника', desc: 'Телеметрия, аномалии, калибровка' },
    ],
    contains: [
      { name: 'События', desc: 'Что может произойти (dev.build_succeeded)', icon: 'pi pi-bolt', color: '#f59e0b' },
      { name: 'FSM-состояния', desc: 'Жизненный цикл (Планирование → В_работе → Готово)', icon: 'pi pi-replay', color: '#06b6d4' },
      { name: 'Переходы', desc: 'Какое событие меняет состояние', icon: 'pi pi-arrow-right', color: '#10b981' },
      { name: 'Триггеры', desc: 'Автоматические реакции (если X → сделать Y)', icon: 'pi pi-directions', color: '#ef4444' },
    ],
  },
  individual: {
    name: 'Индивид',
    icon: 'pi pi-user',
    color: '#10b981',
    tag: 'Конкретная штука',
    explain: 'Индивид — конкретный экземпляр концепта. Он живёт, проходит по состояниям FSM, порождает события. Каждая задача, каждая миссия, каждый дрон — это индивид.',
    analogy: 'Если концепт — это «автомобиль», то индивид — это ваш конкретный красный Ford Focus с номером А123БВ.',
    examples: [
      { name: 'Задача: «Добавить экспорт»', desc: 'Проходит: Планирование → В_работе → Ревью → Развёрнуто' },
      { name: 'Рой: «Миссия SWM-42»', desc: '5 дронов, покрытие территории, выбор лидера' },
      { name: 'Полис: «RISK-007»', desc: 'Оценка рисков → премия → выплата' },
    ],
  },
}

const activeDetail = computed(() => details[activeLayer.value])

// Flow animation
const flowSteps = [
  { action: 'Пользователь ставит задачу', result: 'Создаётся индивид' },
  { action: 'СОД стреляет событие', result: 'dev.issue_opened' },
  { action: 'Триггер срабатывает', result: 'Автоматически создаёт ветку' },
  { action: 'FSM меняет состояние', result: 'Планирование → В_работе' },
  { action: 'Каскад продолжается', result: 'CI → PR → Merge → Deploy' },
  { action: 'Индивид завершён', result: 'Состояние: Развёрнуто' },
]

const flowActive = ref(-1)
const flowRunning = ref(false)
let flowTimer = null

function toggleFlow() {
  if (flowRunning.value) {
    flowRunning.value = false
    clearInterval(flowTimer)
    flowActive.value = -1
    return
  }
  flowRunning.value = true
  flowActive.value = 0
  flowTimer = setInterval(() => {
    flowActive.value = (flowActive.value + 1) % flowSteps.length
  }, 1500)
}

onUnmounted(() => clearInterval(flowTimer))

// 10 domains
const domains = [
  { prefix: 'dev', name: 'DevOps', events: 34, color: '#6366f1' },
  { prefix: 'twin', name: 'Цифровой двойник', events: 12, color: '#06b6d4' },
  { prefix: 'ops', name: 'Операции', events: 10, color: '#10b981' },
  { prefix: 'reg', name: 'Регуляторика', events: 8, color: '#f59e0b' },
  { prefix: 'risk', name: 'Страхование', events: 8, color: '#ef4444' },
  { prefix: 'market', name: 'Маркетплейс', events: 8, color: '#ec4899' },
  { prefix: 'swarm', name: 'Координация роёв', events: 10, color: '#8b5cf6' },
  { prefix: 'train', name: 'Обучение', events: 8, color: '#14b8a6' },
  { prefix: 'dao', name: 'DAO управление', events: 8, color: '#f97316' },
  { prefix: 'voice', name: 'Голосовой ввод', events: 6, color: '#64748b' },
]
</script>

<style scoped>
.hiw-panel {
  max-width: 960px;
  margin: 0 auto;
}

.hiw-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
}

.hiw-subtitle {
  margin: 0 0 24px;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
}

/* Schema */
.hiw-schema {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 24px;
}

.hiw-layer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--p-surface-card);
  border: 2px solid var(--p-surface-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.hiw-layer:hover {
  border-color: var(--p-primary-300);
  transform: translateX(4px);
}

.hiw-layer.active {
  border-color: var(--p-primary-500);
  background: var(--p-primary-50);
  box-shadow: 0 0 0 3px var(--p-primary-100);
}

.hiw-layer-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.hiw-layer-name {
  font-weight: 700;
  font-size: 1.05rem;
}

.hiw-layer-desc {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.hiw-arrow {
  position: absolute;
  bottom: -18px;
  left: 38px;
  z-index: 1;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

/* Detail */
.hiw-detail {
  background: var(--p-surface-card);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--p-surface-border);
  margin-bottom: 24px;
  border-left: 4px solid;
}

.hiw-detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.hiw-detail-header i {
  font-size: 1.3rem;
}

.hiw-detail-header h4 {
  margin: 0;
  flex: 1;
  font-size: 1.15rem;
}

.hiw-detail-header .p-tag {
  color: #fff;
  border: none;
}

.hiw-detail-explain {
  margin: 0 0 16px;
  line-height: 1.6;
  font-size: 0.95rem;
}

.hiw-analogy {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: var(--p-yellow-50, #fffbeb);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  align-items: flex-start;
}

.hiw-analogy i {
  color: #f59e0b;
  font-size: 1.1rem;
  margin-top: 2px;
}

.hiw-analogy strong {
  margin-right: 4px;
}

/* Examples */
.hiw-examples-title,
.hiw-contains-title {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hiw-example-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.hiw-example-card {
  padding: 12px 14px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}

.hiw-example-name {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.hiw-example-desc {
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
}

/* Contains (model internals) */
.hiw-contains {
  margin-top: 16px;
}

.hiw-contains-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hiw-contains-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  align-items: flex-start;
}

.hiw-contains-item i {
  font-size: 1.1rem;
  margin-top: 2px;
}

.hiw-contains-item strong {
  display: block;
  font-size: 0.9rem;
}

.hiw-contains-item span {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

/* Flow */
.hiw-flow {
  background: var(--p-surface-card);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--p-surface-border);
  margin-bottom: 24px;
}

.hiw-flow-title {
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 16px;
}

.hiw-flow-steps {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.hiw-flow-step {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
  flex-shrink: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.hiw-flow-step.highlight {
  background: var(--p-primary-50);
  border-color: var(--p-primary-400);
  box-shadow: 0 0 12px var(--p-primary-200);
}

.hiw-flow-num {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--p-surface-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
  transition: background 0.3s;
}

.hiw-flow-step.highlight .hiw-flow-num {
  background: var(--p-primary-500);
  color: #fff;
}

.hiw-flow-action {
  font-size: 0.82rem;
  font-weight: 600;
}

.hiw-flow-result {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.hiw-flow-arrow {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.hiw-flow-btn {
  margin-top: 4px;
}

/* Domains */
.hiw-domains {
  background: var(--p-surface-card);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--p-surface-border);
}

.hiw-domains-title {
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 14px;
}

.hiw-domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.hiw-domain-chip {
  padding: 10px 14px;
  border-radius: 10px;
  border: 2px solid;
  background: var(--p-surface-ground);
  transition: transform 0.15s;
}

.hiw-domain-chip:hover {
  transform: scale(1.03);
}

.hiw-domain-prefix {
  font-weight: 700;
  font-size: 0.85rem;
  font-family: monospace;
}

.hiw-domain-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.hiw-domain-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .hiw-flow-steps {
    flex-direction: column;
  }
  .hiw-flow-arrow i::before {
    content: '\e930'; /* pi-arrow-down */
  }
  .hiw-contains-grid {
    grid-template-columns: 1fr;
  }
}
</style>

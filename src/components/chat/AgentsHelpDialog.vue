<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '800px' }"
    :breakpoints="{ '960px': '90vw' }"
  >
    <template #header>
      <div class="help-header">
        <i class="pi pi-compass"></i>
        <span>Справка: Агенты навигации и знаний</span>
      </div>
    </template>

    <div class="help-content">
      <!-- Quick Start -->
      <div class="help-section">
        <h3><i class="pi pi-bolt"></i> Быстрый старт</h3>
        <p>Используйте специальные команды для получения информации о платформе и навигации:</p>
        <div class="command-list">
          <div class="command-item" @click="tryCommand('/info')">
            <code>/info</code>
            <span>Информация о платформе и доступных функциях</span>
          </div>
          <div class="command-item" @click="tryCommand('/navigate workspace')">
            <code>/navigate [запрос]</code>
            <span>Предложения для навигации по разделам</span>
          </div>
          <div class="command-item" @click="tryCommand('/search егрюл')">
            <code>/search [запрос]</code>
            <span>Поиск по маршрутам и агентам</span>
          </div>
        </div>
      </div>

      <!-- Examples -->
      <div class="help-section">
        <h3><i class="pi pi-lightbulb"></i> Примеры использования</h3>

        <Accordion :activeIndex="0">
          <AccordionTab header="Получить информацию о платформе">
            <p><strong>Команды:</strong></p>
            <ul>
              <li><code>/info</code> - общая информация</li>
              <li><code>/info workspace</code> - информация о workspace</li>
              <li><code>что ты умеешь?</code> - автоматическое обогащение контекстом</li>
            </ul>
            <div class="example-result">
              <strong>Результат:</strong> AI расскажет о возможностях платформы и покажет кнопки для перехода к нужным разделам.
            </div>
          </AccordionTab>

          <AccordionTab header="Навигация по сайту">
            <p><strong>Команды:</strong></p>
            <ul>
              <li><code>/navigate workspace</code> - показать разделы для работы с кодом</li>
              <li><code>куда перейти для работы с кодом?</code> - естественный язык</li>
              <li><code>покажи разделы для бизнеса</code> - автоопределение намерения</li>
            </ul>
            <div class="example-result">
              <strong>Результат:</strong> Список навигационных кнопок с описанием разделов.
            </div>
          </AccordionTab>

          <AccordionTab header="Поиск функций">
            <p><strong>Команды:</strong></p>
            <ul>
              <li><code>/search егрюл</code> - найти функции для работы с ЕГРЮЛ</li>
              <li><code>найди агенты для автоматизации</code> - поиск по описанию</li>
            </ul>
            <div class="example-result">
              <strong>Результат:</strong> Список найденных маршрутов и агентов с кнопками перехода.
            </div>
          </AccordionTab>
        </Accordion>
      </div>

      <!-- Categories -->
      <div class="help-section">
        <h3><i class="pi pi-tags"></i> Категории разделов</h3>
        <div class="categories-grid">
          <Tag value="ai" severity="info" @click="tryCommand('/navigate ai')">AI & Чаты</Tag>
          <Tag value="workspace" severity="success" @click="tryCommand('/navigate workspace')">Workspace & Код</Tag>
          <Tag value="business" @click="tryCommand('/navigate business')">Бизнес</Tag>
          <Tag value="automation" severity="warning" @click="tryCommand('/navigate automation')">Автоматизация</Tag>
          <Tag value="documentation" severity="secondary" @click="tryCommand('/navigate documentation')">Документация</Tag>
          <Tag value="analytics" severity="help" @click="tryCommand('/navigate analytics')">Аналитика</Tag>
        </div>
      </div>

      <!-- How it works -->
      <div class="help-section">
        <h3><i class="pi pi-cog"></i> Как это работает</h3>
        <div class="how-it-works">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <strong>Определение намерения</strong>
              <p>AI анализирует ваш запрос и определяет, что вы ищете</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <strong>Поиск по базе знаний</strong>
              <p>Агент находит подходящие разделы и функции</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <strong>Умный ответ</strong>
              <p>AI формирует ответ с учетом контекста платформы</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <strong>Навигационные кнопки</strong>
              <p>Показываются кнопки для быстрого перехода</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto-enrichment -->
      <div class="help-section">
        <h3><i class="pi pi-sparkles"></i> Автоматическое обогащение</h3>
        <p>AI автоматически добавляет контекст о платформе при запросах, содержащих:</p>
        <div class="triggers-list">
          <Tag value="что ты умеешь" severity="secondary" size="small" />
          <Tag value="какие функции" severity="secondary" size="small" />
          <Tag value="куда перейти" severity="secondary" size="small" />
          <Tag value="где находится" severity="secondary" size="small" />
          <Tag value="help" severity="secondary" size="small" />
        </div>
        <Message severity="info" :closable="false" class="mt-3">
          Это позволяет AI давать более точные ответы о возможностях платформы без явных команд.
        </Message>
      </div>

      <!-- Documentation -->
      <div class="help-section">
        <h3><i class="pi pi-book"></i> Полная документация</h3>
        <p>Подробное руководство по использованию агентов:</p>
        <ul class="doc-links">
          <li>
            <a href="https://github.com/unidel2035/dronedoc2025/blob/dev/docs/SITE_AGENTS.md" target="_blank">
              <i class="pi pi-github"></i> docs/SITE_AGENTS.md
            </a>
          </li>
          <li>
            <a href="https://github.com/unidel2035/dronedoc2025/blob/dev/docs/CHAT_AI_DOCUMENTATION.md#site-knowledge--navigation-agents" target="_blank">
              <i class="pi pi-github"></i> docs/CHAT_AI_DOCUMENTATION.md
            </a>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="help-footer">
        <Button label="Попробовать команду" icon="pi pi-play" @click="showQuickTry = !showQuickTry" text />
        <Button label="Закрыть" icon="pi pi-times" @click="closeDialog" autofocus />
      </div>
    </template>
  </Dialog>

  <!-- Quick Try Input -->
  <Dialog
    v-model:visible="showQuickTry"
    modal
    header="Попробуйте команду"
    :style="{ width: '500px' }"
  >
    <div class="quick-try">
      <p>Введите команду или выберите пример:</p>
      <div class="quick-examples">
        <Tag value="/info" @click="quickCommand = '/info'" class="clickable" />
        <Tag value="/navigate workspace" @click="quickCommand = '/navigate workspace'" class="clickable" />
        <Tag value="/search егрюл" @click="quickCommand = '/search егрюл'" class="clickable" />
      </div>
      <InputText v-model="quickCommand" placeholder="Введите команду..." class="w-full mt-3" />
    </div>
    <template #footer>
      <Button label="Отправить в чат" icon="pi pi-send" @click="sendToChat" severity="help" />
      <Button label="Отмена" @click="showQuickTry = false" text />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'send-command'])

const visible = ref(props.modelValue)
const showQuickTry = ref(false)
const quickCommand = ref('')

function tryCommand(command) {
  quickCommand.value = command
  showQuickTry.value = true
}

function sendToChat() {
  emit('send-command', quickCommand.value)
  showQuickTry.value = false
  visible.value = false
  emit('update:modelValue', false)
}

function closeDialog() {
  visible.value = false
  emit('update:modelValue', false)
}

// Watch for external changes
import { watch } from 'vue'
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})
</script>

<style scoped>
.help-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.help-header i {
  color: var(--primary-color);
  font-size: 1.5rem;
}

.help-content {
  max-height: 70vh;
  overflow-y: auto;
  padding: 0.5rem;
}

.help-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--surface-border);
}

.help-section:last-child {
  border-bottom: none;
}

.help-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: var(--text-color);
}

.help-section h3 i {
  color: var(--primary-color);
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.command-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.command-item:hover {
  background: var(--surface-hover);
  transform: translateX(5px);
}

.command-item code {
  min-width: 180px;
  padding: 0.5rem;
  background: var(--surface-card);
  border-radius: 4px;
  font-family: monospace;
  color: var(--primary-color);
  font-weight: 600;
}

.command-item span {
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.example-result {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--surface-50);
  border-left: 3px solid var(--primary-color);
  border-radius: 4px;
}

.categories-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.categories-grid .p-tag {
  cursor: pointer;
  transition: transform 0.2s;
}

.categories-grid .p-tag:hover {
  transform: scale(1.05);
}

.how-it-works {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.step-number {
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 1.25rem;
}

.step-content {
  flex: 1;
}

.step-content strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-color);
}

.step-content p {
  color: var(--text-color-secondary);
  margin: 0;
}

.triggers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.doc-links {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0 0;
}

.doc-links li {
  margin: 0.5rem 0;
}

.doc-links a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
  text-decoration: none;
  transition: all 0.2s;
}

.doc-links a:hover {
  text-decoration: underline;
  transform: translateX(5px);
}

.help-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.quick-try {
  padding: 1rem 0;
}

.quick-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.clickable {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable:hover {
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .command-item {
    flex-direction: column;
    gap: 0.5rem;
  }

  .command-item code {
    min-width: auto;
  }
}
</style>

<template>
  <div class="tutorial-panel">
    <div class="panel-toolbar">
      <h3>Интерактивный урок</h3>
      <div class="toolbar-actions">
        <Tag :value="'Шаг ' + (currentStep + 1) + ' / ' + steps.length" severity="info" />
        <Button label="Сбросить" icon="pi pi-replay" severity="secondary" text @click="resetTutorial" />
      </div>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: ((currentStep + 1) / steps.length * 100) + '%' }"></div>
    </div>

    <!-- Current step -->
    <div class="step-card">
      <div class="step-header">
        <Tag :value="steps[currentStep].category" :severity="categoryColor(steps[currentStep].category)" />
        <h4>{{ steps[currentStep].title }}</h4>
      </div>

      <div class="step-description" v-html="steps[currentStep].description"></div>

      <!-- Integram connection note -->
      <div v-if="steps[currentStep].integramNote" class="integram-note">
        <i class="pi pi-database"></i>
        <div>
          <strong>Связь с Integram:</strong>
          <span>{{ steps[currentStep].integramNote }}</span>
        </div>
      </div>

      <!-- Interactive action -->
      <div v-if="steps[currentStep].action" class="step-action">
        <div class="action-header">
          <i class="pi pi-bolt"></i>
          <strong>Практическое задание:</strong>
        </div>

        <!-- Action: create -->
        <div v-if="steps[currentStep].action.type === 'create'" class="action-form">
          <div v-for="field in steps[currentStep].action.fields" :key="field.name" class="action-field">
            <label>{{ field.label }}</label>
            <Select v-if="field.type === 'select'" v-model="actionValues[field.name]"
              :options="field.options" class="w-full" :placeholder="field.placeholder" />
            <InputText v-else v-model="actionValues[field.name]" class="w-full"
              :placeholder="field.placeholder" />
          </div>
          <Button :label="steps[currentStep].action.buttonLabel || 'Создать'" icon="pi pi-plus"
            @click="executeAction" :loading="actionLoading" :disabled="!isActionReady" />
        </div>

        <!-- Action: explore -->
        <div v-if="steps[currentStep].action.type === 'explore'" class="action-explore">
          <Button :label="steps[currentStep].action.buttonLabel || 'Загрузить'" icon="pi pi-search"
            @click="executeAction" :loading="actionLoading" />
        </div>

        <!-- Action: navigate -->
        <div v-if="steps[currentStep].action.type === 'navigate'" class="action-navigate">
          <Button :label="steps[currentStep].action.buttonLabel" :icon="steps[currentStep].action.icon || 'pi pi-arrow-right'"
            @click="navigateTo(steps[currentStep].action.section)" />
        </div>

        <!-- Action result -->
        <div v-if="actionResult" class="action-result">
          <Message :severity="actionResult.success ? 'success' : 'error'" :closable="false">
            {{ actionResult.message }}
          </Message>
          <pre v-if="actionResult.data" class="result-json">{{ JSON.stringify(actionResult.data, null, 2) }}</pre>
        </div>
      </div>

      <!-- Key concepts -->
      <div v-if="steps[currentStep].concepts" class="step-concepts">
        <h5>Ключевые понятия:</h5>
        <div v-for="c in steps[currentStep].concepts" :key="c.term" class="concept-item">
          <Tag :value="c.term" severity="secondary" />
          <span>{{ c.definition }}</span>
        </div>
      </div>

      <!-- API info -->
      <div v-if="steps[currentStep].api" class="step-api">
        <h5>API эндпоинты:</h5>
        <div v-for="ep in steps[currentStep].api" :key="ep" class="api-endpoint">
          <code>{{ ep }}</code>
        </div>
      </div>

      <!-- Constraints info (for model editor step) -->
      <div v-if="steps[currentStep].constraintsList" class="constraints-list">
        <h5>12 типов ограничений:</h5>
        <div class="constraints-grid">
          <div v-for="c in steps[currentStep].constraintsList" :key="c.name" class="constraint-card">
            <Tag :value="c.name" :severity="c.severity" size="small" />
            <span>{{ c.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="step-navigation">
      <Button label="Назад" icon="pi pi-arrow-left" severity="secondary" text
        @click="prevStep" :disabled="currentStep === 0" />

      <!-- Step dots -->
      <div class="step-dots">
        <span v-for="(s, i) in steps" :key="i"
          class="step-dot"
          :class="{ active: i === currentStep, completed: completedSteps.has(i) }"
          @click="goToStep(i)"
          v-tooltip="s.title">
        </span>
      </div>

      <Button :label="currentStep === steps.length - 1 ? 'Завершить' : 'Далее'"
        :icon="currentStep === steps.length - 1 ? 'pi pi-check' : 'pi pi-arrow-right'"
        iconPos="right"
        @click="nextStep" />
    </div>

    <!-- Quick reference -->
    <div class="quick-reference">
      <h5>Быстрая справка</h5>
      <div class="ref-grid">
        <div class="ref-card" @click="goToStep(0)">
          <i class="pi pi-info-circle"></i>
          <span>Введение</span>
        </div>
        <div class="ref-card" @click="goToStep(1)">
          <i class="pi pi-database"></i>
          <span>Integram</span>
        </div>
        <div class="ref-card" @click="goToStep(2)">
          <i class="pi pi-users"></i>
          <span>Акторы</span>
        </div>
        <div class="ref-card" @click="goToStep(4)">
          <i class="pi pi-book"></i>
          <span>Словари</span>
        </div>
        <div class="ref-card" @click="goToStep(6)">
          <i class="pi pi-cog"></i>
          <span>Модели</span>
        </div>
        <div class="ref-card" @click="goToStep(8)">
          <i class="pi pi-user"></i>
          <span>Индивиды</span>
        </div>
        <div class="ref-card" @click="goToStep(9)">
          <i class="pi pi-share-alt"></i>
          <span>DAG</span>
        </div>
        <div class="ref-card" @click="goToStep(10)">
          <i class="pi pi-code"></i>
          <span>BSL</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'

const API = inject('eventEngineAPI')
const openModelEditor = inject('openModelEditor', null)
const openIndividualForm = inject('openIndividualForm', null)

const currentStep = ref(0)
const completedSteps = ref(new Set())
const actionValues = ref({})
const actionResult = ref(null)
const actionLoading = ref(false)

const steps = [
  // 0: Introduction
  {
    title: 'Что такое событийная онтология?',
    category: 'Введение',
    description: `
      <p>Событийная онтология — это подход к моделированию предметных областей, где <strong>всё является событием</strong>.</p>
      <p>В классической базе данных вы храните <em>текущее состояние</em>: "Дрон DJI-017 имеет статус active". Предыдущее состояние затирается.</p>
      <p>В событийной онтологии вы храните <strong>все события</strong>, которые привели к текущему состоянию:</p>
      <ul>
        <li>Создание дрона DJI-017 (Иванов, 10:00)</li>
        <li>Назначение статуса "active" (Петрова, 10:15)</li>
        <li>Каждое событие знает КТО, КОГДА, ПОЧЕМУ (причина)</li>
      </ul>
      <p>События образуют <strong>DAG (направленный ациклический граф)</strong> — граф причинно-следственных связей.</p>
    `,
    concepts: [
      { term: 'Событие', definition: 'Неизменяемый факт: кто-то сделал что-то с чем-то в определённый момент' },
      { term: 'DAG', definition: 'Directed Acyclic Graph — граф без циклов, где рёбра = причинные связи' },
      { term: 'Immutable', definition: 'События нельзя изменить или удалить — только добавить новые' },
    ],
  },

  // 1: Integram connection
  {
    title: 'Связь с Integram',
    category: 'Архитектура',
    description: `
      <p>Вся событийная онтология <strong>хранится в Integram</strong> (база данных kval на ai2o.ru).</p>
      <p><strong>10 таблиц</strong> с префиксом "СОД" (Событийная Онтология Движок):</p>
      <table class="info-table">
        <tr><td>СОД Роли</td><td>1709560</td><td>Роли акторов</td></tr>
        <tr><td>СОД Акторы</td><td>1709561</td><td>Кто действует</td></tr>
        <tr><td>СОД Концепты</td><td>1709562</td><td>Классы объектов</td></tr>
        <tr><td>СОД Словари</td><td>1709563</td><td>Наборы свойств</td></tr>
        <tr><td>СОД Свойства</td><td>1709564</td><td>Атрибуты, отношения</td></tr>
        <tr><td>СОД Приложения</td><td>1709565</td><td>Рабочие пространства</td></tr>
        <tr><td>СОД Модели</td><td>1709566</td><td>Схемы заполнения</td></tr>
        <tr><td>СОД Модельные события</td><td>1709567</td><td>Дерево свойств модели</td></tr>
        <tr><td>СОД Индивиды</td><td>1709568</td><td>Экземпляры концептов</td></tr>
        <tr><td>СОД Предметные события</td><td>1709569</td><td>DAG фактических событий</td></tr>
      </table>
      <p>Каждая операция (создание, изменение) — это <code>_m_new</code> / <code>_m_save</code> вызов к Integram API.</p>
      <p>Reference-поля (ref) — это реальные ссылки Integram между таблицами.</p>
    `,
    integramNote: 'Откройте ai2o.ru/kval в браузере — вы увидите те же самые таблицы и данные. EventEngineService.js — это обёртка над Integram REST API.',
    action: {
      type: 'explore',
      buttonLabel: 'Загрузить статистику из Integram',
    },
    api: [
      'POST /kval/auth — авторизация',
      'GET /kval/object/{typeId} — список объектов',
      'POST /kval/_m_new/{typeId} — создание',
      'POST /kval/_m_save/{objId} — обновление',
      'POST /kval/_m_set/{objId} — MULTI ref',
    ],
  },

  // 2: Actors
  {
    title: 'Акторы: кто действует?',
    category: 'Онтология',
    description: `
      <p><strong>Актор</strong> — это тот, кто совершает события. Три типа:</p>
      <ul>
        <li><strong>human</strong> — человек (пилот, инженер, аналитик)</li>
        <li><strong>sensor</strong> — датчик или устройство (дрон, камера, GPS)</li>
        <li><strong>agent</strong> — AI-агент (GPT-4o, Claude, автоматический процесс)</li>
      </ul>
      <p>Каждый актор имеет набор <strong>ролей</strong> (Оператор, Инженер, Наблюдатель).</p>
      <p>При работе с индивидами выбираете <strong>текущего актора</strong> в заголовке — он будет записан во все создаваемые события.</p>
    `,
    integramNote: 'Таблица "СОД Акторы" (1709561): поля Тип, Описание, Статус + MULTI ref на "СОД Роли".',
    action: {
      type: 'create',
      buttonLabel: 'Создать актора',
      fields: [
        { name: 'name', label: 'Имя', placeholder: 'Например: Сидоров К.А.' },
        { name: 'type', label: 'Тип', type: 'select', options: ['human', 'sensor', 'agent'], placeholder: 'Выберите тип' },
      ],
    },
    api: ['GET /api/event-engine/actors', 'POST /api/event-engine/actors'],
  },

  // 3: Concepts
  {
    title: 'Концепты: классы объектов',
    category: 'Онтология',
    description: `
      <p><strong>Концепт</strong> — это класс (тип) объектов предметной области.</p>
      <p>Примеры: Миссия БПЛА, Дрон, Пилот, Аэросъёмка, Отчёт.</p>
      <p>При создании концепта <strong>автоматически создаётся модель</strong> с префиксом "Model_".</p>
      <p>Например: концепт "Дрон" → модель "Model_Дрон".</p>
      <p>Модель определяет, <em>какие свойства</em> есть у экземпляров этого концепта и <em>какие ограничения</em> на них действуют.</p>
    `,
    integramNote: 'Таблица "СОД Концепты" (1709562). При POST автоматически создаётся строка в "СОД Модели" (1709566) с ref на концепт.',
    action: {
      type: 'create',
      buttonLabel: 'Создать концепт',
      fields: [
        { name: 'name', label: 'Название', placeholder: 'Например: Отчёт' },
      ],
    },
    api: ['GET /api/event-engine/concepts', 'POST /api/event-engine/concepts'],
  },

  // 4: Vocabularies
  {
    title: 'Словари: наборы свойств',
    category: 'Онтология',
    description: `
      <p><strong>Словарь</strong> — именованный набор свойств (property).</p>
      <p>Каждое <strong>свойство</strong> имеет:</p>
      <ul>
        <li><strong>Тип свойства</strong>: attribute (данные), relation (связь с другим концептом), role (роль)</li>
        <li><strong>Тип данных</strong>: BasicType (строка), Text (длинный текст), Numeric (число), Date (дата), Boolean, EnumType (выбор из списка)</li>
        <li><strong>Range</strong> (для relation): какой концепт допустим как значение</li>
        <li><strong>Допустимые значения</strong> (для EnumType): JSON массив вариантов</li>
      </ul>
      <p>Словари можно переиспользовать в разных приложениях.</p>
    `,
    integramNote: 'Таблица "СОД Словари" (1709563) + "СОД Свойства" (1709564). Свойство имеет ref на словарь и ref на концепт (Range).',
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть раздел Словари',
      section: 'vocabularies',
    },
    concepts: [
      { term: 'attribute', definition: 'Свойство-данные: имя, возраст, дата' },
      { term: 'relation', definition: 'Свойство-связь: "оператор" → ссылка на другой индивид' },
      { term: 'EnumType', definition: 'Перечисление: ["Запланирован", "В полёте", "Завершён"]' },
    ],
  },

  // 5: Applications
  {
    title: 'Приложения: рабочие пространства',
    category: 'Онтология',
    description: `
      <p><strong>Приложение</strong> — это контекст работы. Оно объединяет:</p>
      <ul>
        <li>Набор <strong>моделей</strong> (какие концепты используются)</li>
        <li>Набор <strong>словарей</strong> (какие свойства доступны)</li>
      </ul>
      <p>Это позволяет создавать <em>разные рабочие пространства</em> для разных задач.</p>
      <p>Например: "Управление БПЛА-миссиями" использует модели Дрон + Миссия + Аэросъёмка и словари БПЛА + Аэросъёмки.</p>
    `,
    integramNote: 'Таблица "СОД Приложения" (1709565). MULTI ref на модели (1709603) и MULTI ref на словари (1709604). Используется Integram _m_set для привязки.',
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть раздел Приложения',
      section: 'applications',
    },
  },

  // 6: Models
  {
    title: 'Модели: схемы заполнения (ключевой компонент!)',
    category: 'Моделирование',
    description: `
      <p><strong>Модель</strong> — это дерево <strong>модельных событий</strong>, описывающее "что можно записать" для индивида.</p>
      <p>Каждый узел дерева:</p>
      <ul>
        <li>Связан со <strong>свойством</strong> из словаря</li>
        <li>Имеет <strong>12 типов ограничений</strong> (required, immutable, unique и др.)</li>
        <li>Может иметь <strong>вложенные свойства</strong> (до 5 уровней)</li>
      </ul>
      <p>Модель — это НЕ схема БД. Это <em>шаблон поведения</em>: "при заполнении индивида Дрон нужно указать серийный номер (required + unique + immutable)".</p>
    `,
    integramNote: 'Таблица "СОД Модельные события" (1709567): ref на модель, ref на свойство, self-ref на родителя (для дерева), поле Ограничения (JSON).',
    constraintsList: [
      { name: 'required', severity: 'danger', description: 'Обязательное поле — нельзя пропустить' },
      { name: 'multiple', severity: 'info', description: 'Множественные значения (массив)' },
      { name: 'immutable', severity: 'warn', description: 'После первого ввода нельзя изменить' },
      { name: 'unique', severity: 'contrast', description: 'Уникальное значение среди всех индивидов' },
      { name: 'uniqueIdentifier', severity: 'contrast', description: 'Уникальный идентификатор' },
      { name: 'condition', severity: 'secondary', description: 'BSL-условие показа поля' },
      { name: 'valueCondition', severity: 'secondary', description: 'Проверка значения ($Value)' },
      { name: 'permission', severity: 'warn', description: 'Роль актора для доступа' },
      { name: 'setValue', severity: 'success', description: 'Автовычисляемое значение (BSL)' },
      { name: 'setRange', severity: 'success', description: 'Допустимый диапазон (BSL)' },
      { name: 'default', severity: 'info', description: 'Значение по умолчанию' },
      { name: 'range', severity: 'info', description: 'Концепт-диапазон для отношений' },
    ],
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть Редактор модели',
      section: 'modelEditor',
    },
  },

  // 7: Model editor detail
  {
    title: 'Редактор модели: практика',
    category: 'Моделирование',
    description: `
      <p>В <strong>Редакторе модели</strong> вы видите:</p>
      <ul>
        <li><strong>Левая панель</strong> — дерево свойств модели (PrimeVue Tree)</li>
        <li><strong>Правая панель</strong> — ограничения выбранного свойства</li>
      </ul>
      <p><strong>Как работать:</strong></p>
      <ol>
        <li>Выберите модель из выпадающего списка</li>
        <li>Нажмите [+ Свойство] чтобы добавить свойство из словаря</li>
        <li>Кликните на свойство в дереве — справа появятся ограничения</li>
        <li>Установите ограничения (required, immutable, default и др.)</li>
        <li>Нажмите [Сохранить ограничения]</li>
        <li>Кнопка [+] на узле — вложенное свойство</li>
      </ol>
      <p>Каждое изменение ограничений сохраняется как JSON в поле "Ограничения" модельного события в Integram.</p>
    `,
    integramNote: 'PUT /model-events/:id → _m_save в Integram. JSON ограничений записывается в поле "Ограничения" (тип LONG).',
    action: {
      type: 'navigate',
      buttonLabel: 'Перейти к редактору модели',
      section: 'modelEditor',
    },
  },

  // 8: Individuals
  {
    title: 'Индивиды: экземпляры концептов',
    category: 'Исполнение',
    description: `
      <p><strong>Индивид</strong> — конкретный экземпляр концепта. Например:</p>
      <ul>
        <li>Концепт "Дрон" → индивид "DJI Mavic 3 #017"</li>
        <li>Концепт "Миссия БПЛА" → индивид "Аэросъёмка лесного массива"</li>
      </ul>
      <p>При выборе индивида отображается <strong>автогенерированная форма</strong> по модели. Три вкладки:</p>
      <ul>
        <li><strong>Форма</strong> — заполнение по модели с валидацией ограничений</li>
        <li><strong>Таймлайн</strong> — хронология всех событий индивида</li>
        <li><strong>Исполнить модель</strong> — пакетное создание событий с полной валидацией</li>
      </ul>
      <p><strong>Причинные связи:</strong> перед сохранением можно выбрать события-причины (зелёные теги). Это создаёт рёбра в DAG.</p>
    `,
    integramNote: 'Таблица "СОД Индивиды" (1709568): ref на концепт, ref на модель, ref на актора-создателя. "Исполнить модель" → пакет _m_new в "СОД Предметные события".',
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть раздел Индивиды',
      section: 'individualForm',
    },
  },

  // 9: Event Graph
  {
    title: 'Граф событий: визуализация DAG',
    category: 'Анализ',
    description: `
      <p><strong>Граф событий</strong> — D3-визуализация направленного ациклического графа (DAG) всех предметных событий.</p>
      <p><strong>4 layout:</strong></p>
      <ul>
        <li><strong>DAG сверху вниз</strong> — уровни по глубине причинных связей</li>
        <li><strong>DAG слева направо</strong> — горизонтальная компоновка</li>
        <li><strong>Timeline</strong> — ось X = время, ось Y = индивид</li>
        <li><strong>Force</strong> — физическая симуляция</li>
      </ul>
      <p><strong>Фильтры:</strong> по индивиду, по актору.</p>
      <p><strong>Подсветка цепочки:</strong> кликните на узел → [Показать цепочку] → выделяются все предки и потомки красным.</p>
      <p><strong>Цвета узлов:</strong> синий = human, зелёный = sensor, жёлтый = agent. Буква внутри: H/S/A.</p>
    `,
    integramNote: 'GET /graph читает ВСЕ строки "СОД Предметные события", парсит JSON поле "Причины" для построения рёбер DAG.',
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть граф событий',
      section: 'eventGraph',
    },
  },

  // 10: BSL Query
  {
    title: 'Query Builder: язык BSL',
    category: 'Анализ',
    description: `
      <p><strong>BSL (Event Semantic Language)</strong> — язык запросов к событийной онтологии.</p>
      <p><strong>Синтаксис:</strong> <code>$(условия).Свойство</code></p>
      <p><strong>Примеры запросов:</strong></p>
      <ul>
        <li><code>$($EQ.$Model("Model_Дрон"))</code> — все индивиды модели Дрон</li>
        <li><code>$($EQ.$Concept("Миссия БПЛА"))</code> — все миссии</li>
        <li><code>$($EQ.$Model("Model_Дрон")).Серийный номер</code> — серийные номера всех дронов</li>
      </ul>
      <p><strong>Операторы:</strong></p>
      <ul>
        <li><code>$EQ</code> — равно, <code>$NE</code> — не равно</li>
        <li><code>$GT</code> — больше, <code>$LT</code> — меньше</li>
        <li><code>$Model("name")</code> — фильтр по модели</li>
        <li><code>$Concept("name")</code> — фильтр по концепту</li>
      </ul>
    `,
    integramNote: 'POST /query → парсинг BSL на бэкенде → фильтрация индивидов и событий в таблицах Integram → возврат результата.',
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть Query Builder',
      section: 'queryBuilder',
    },
  },

  // 11: Full workflow
  {
    title: 'Полный рабочий процесс',
    category: 'Практика',
    description: `
      <p>Вот как выглядит <strong>полный цикл работы</strong>:</p>
      <ol>
        <li><strong>Определить домен</strong> — создать концепты (Дрон, Миссия, Аэросъёмка)</li>
        <li><strong>Создать словари</strong> — свойства (серийный номер, высота полёта, тип съёмки)</li>
        <li><strong>Настроить модели</strong> — добавить свойства в дерево, задать ограничения</li>
        <li><strong>Создать приложение</strong> — объединить модели и словари</li>
        <li><strong>Работать с индивидами</strong> — создать экземпляры, заполнить через форму</li>
        <li><strong>Анализировать</strong> — граф событий, BSL-запросы, таймлайны</li>
      </ol>
      <p><strong>Что это даёт:</strong></p>
      <ul>
        <li>Полная <strong>трассировка</strong> — кто одобрил полёт? На основании чего?</li>
        <li><strong>Аудит</strong> — невозможно подделать историю (события immutable)</li>
        <li><strong>Откат</strong> — восстановить состояние на любой момент</li>
        <li><strong>Аналитика</strong> — сколько миссий на оператора, среднее время от плана до выполнения</li>
      </ul>
    `,
    action: {
      type: 'navigate',
      buttonLabel: 'Открыть Dashboard',
      section: 'dashboard',
    },
  },
]

function categoryColor(cat) {
  const map = { 'Введение': 'info', 'Архитектура': 'contrast', 'Онтология': 'success', 'Моделирование': 'warn', 'Исполнение': 'danger', 'Анализ': 'secondary', 'Практика': 'info' }
  return map[cat] || 'secondary'
}

const isActionReady = computed(() => {
  const action = steps[currentStep.value]?.action
  if (!action || action.type !== 'create') return true
  return action.fields.every(f => actionValues.value[f.name])
})

function navigateTo(section) {
  // Emit to parent to switch section
  if (section === 'modelEditor' && openModelEditor) openModelEditor(null)
  else if (section === 'individualForm' && openIndividualForm) openIndividualForm(null, null)
  // Use a custom event since we can't directly change parent state
  window.dispatchEvent(new CustomEvent('ee-navigate', { detail: { section } }))
  completedSteps.value.add(currentStep.value)
}

async function executeAction() {
  const step = steps[currentStep.value]
  if (!step.action) return
  actionLoading.value = true
  actionResult.value = null

  try {
    if (step.action.type === 'explore') {
      const { data } = await axios.get(`${API}/stats`)
      actionResult.value = { success: true, message: 'Данные загружены из Integram (kval)', data: data.data }
    } else if (step.action.type === 'create') {
      if (step.category === 'Онтология' && step.title.includes('Актор')) {
        const { data } = await axios.post(`${API}/actors`, {
          name: actionValues.value.name,
          type: actionValues.value.type,
          status: 'active',
        })
        actionResult.value = { success: data.success, message: data.success ? `Актор "${actionValues.value.name}" создан в Integram (таблица 1709561)` : data.error }
      } else if (step.title.includes('Концепт')) {
        const { data } = await axios.post(`${API}/concepts`, {
          name: actionValues.value.name,
        })
        actionResult.value = { success: data.success, message: data.success ? `Концепт "${actionValues.value.name}" создан + авто-модель "Model_${actionValues.value.name}"` : data.error }
      }
      actionValues.value = {}
    }
    completedSteps.value.add(currentStep.value)
  } catch (e) {
    actionResult.value = { success: false, message: e.response?.data?.error || e.message }
  }
  actionLoading.value = false
}

function nextStep() {
  completedSteps.value.add(currentStep.value)
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    actionResult.value = null
    actionValues.value = {}
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
    actionResult.value = null
    actionValues.value = {}
  }
}

function goToStep(idx) {
  currentStep.value = idx
  actionResult.value = null
  actionValues.value = {}
}

function resetTutorial() {
  currentStep.value = 0
  completedSteps.value = new Set()
  actionResult.value = null
  actionValues.value = {}
}
</script>

<style scoped>
.tutorial-panel { max-width: 900px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }

/* Progress */
.progress-bar { height: 4px; background: var(--p-surface-200); border-radius: 2px; margin-bottom: 16px; }
.progress-fill { height: 100%; background: var(--p-primary-color); border-radius: 2px; transition: width 0.3s; }

/* Step card */
.step-card {
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 10px; padding: 20px; margin-bottom: 16px;
}
.step-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.step-header h4 { margin: 0; font-size: 1.15rem; }
.step-description { font-size: 0.95rem; line-height: 1.7; }
.step-description :deep(p) { margin: 8px 0; }
.step-description :deep(ul), .step-description :deep(ol) { padding-left: 20px; }
.step-description :deep(li) { margin: 4px 0; }
.step-description :deep(code) { background: var(--p-surface-100); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
.step-description :deep(strong) { color: var(--p-primary-color); }
.step-description :deep(.info-table) { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.9rem; }
.step-description :deep(.info-table td) { padding: 4px 8px; border-bottom: 1px solid var(--p-surface-border); }
.step-description :deep(.info-table td:first-child) { font-weight: 600; }

/* Integram note */
.integram-note {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 14px; margin-top: 12px;
  background: var(--p-blue-50); border-left: 4px solid var(--p-blue-400);
  border-radius: 6px; font-size: 0.9rem;
}
.integram-note i { color: var(--p-blue-500); margin-top: 2px; }
.integram-note strong { display: block; color: var(--p-blue-700); }

/* Action */
.step-action {
  margin-top: 16px; padding: 14px;
  background: var(--p-surface-50); border-radius: 8px;
  border: 1px dashed var(--p-surface-border);
}
.action-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.95rem; }
.action-header i { color: var(--p-yellow-600); }
.action-form { display: flex; flex-direction: column; gap: 10px; }
.action-field { display: flex; flex-direction: column; gap: 4px; }
.action-field label { font-weight: 500; font-size: 0.85rem; }
.action-result { margin-top: 10px; }
.result-json { font-size: 0.8rem; max-height: 150px; overflow: auto; background: var(--p-surface-100); padding: 8px; border-radius: 4px; margin-top: 6px; }

/* Concepts */
.step-concepts { margin-top: 14px; }
.step-concepts h5 { margin: 0 0 8px 0; font-size: 0.9rem; }
.concept-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 0.9rem; }

/* API */
.step-api { margin-top: 14px; }
.step-api h5 { margin: 0 0 8px 0; font-size: 0.9rem; }
.api-endpoint { margin: 3px 0; }
.api-endpoint code { font-size: 0.85rem; background: var(--p-surface-100); padding: 2px 6px; border-radius: 4px; }

/* Constraints */
.constraints-list { margin-top: 14px; }
.constraints-list h5 { margin: 0 0 8px 0; font-size: 0.9rem; }
.constraints-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.constraint-card { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; padding: 4px 0; }

/* Navigation */
.step-navigation {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; margin-bottom: 16px;
}
.step-dots { display: flex; gap: 6px; }
.step-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--p-surface-300); cursor: pointer;
  transition: all 0.2s;
}
.step-dot.active { background: var(--p-primary-color); transform: scale(1.3); }
.step-dot.completed { background: var(--p-green-400); }
.step-dot:hover { transform: scale(1.2); }

/* Quick reference */
.quick-reference {
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 8px; padding: 14px;
}
.quick-reference h5 { margin: 0 0 10px 0; }
.ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.ref-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px; border-radius: 6px;
  background: var(--p-surface-50); cursor: pointer;
  transition: background 0.2s;
  font-size: 0.85rem;
}
.ref-card:hover { background: var(--p-surface-100); }
.ref-card i { font-size: 1.3rem; color: var(--p-primary-color); }
</style>

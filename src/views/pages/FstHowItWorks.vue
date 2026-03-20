<template>
  <FstPageLayout title="Как это работает" subtitle="Наведите на любой элемент схемы" icon="pi pi-info-circle">
    <template #actions>
      <Button label="Подать заявку" icon="pi pi-send" severity="success" size="small" @click="$router.push('/fst-apply')" />
    </template>

    <div class="hiw">
      <!-- Заголовок -->
      <div class="hiw-title">VentureOS — полный цикл венчурного фонда</div>
      <div class="hiw-subtitle">от заявки стартапа до выхода из инвестиции</div>

      <!-- === СХЕМА === -->
      <div class="hiw-diagram">

        <!-- СЛОЙ 1: Источники -->
        <div class="hiw-layer">
          <div class="hiw-layer-label">ВХОДНЫЕ ДАННЫЕ</div>
          <div class="hiw-row">
            <div
              v-for="src in sources" :key="src.id"
              class="hiw-node hiw-node--src"
              @mouseenter="show(src)" @mouseleave="hide()"
            >
              <i :class="src.icon"></i>
              <span>{{ src.label }}</span>
            </div>
          </div>
        </div>

        <!-- Коннектор вниз -->
        <div class="hiw-connector">
          <div class="hiw-connector-line"></div>
          <div class="hiw-connector-dot"></div>
          <div class="hiw-connector-line"></div>
        </div>

        <!-- СЛОЙ 2: AI-ядро -->
        <div class="hiw-core">
          <div class="hiw-core-label">AI-ЯДРО</div>

          <!-- LLM -->
          <div class="hiw-core-row">
            <div
              class="hiw-node hiw-node--llm"
              @mouseenter="show(llmNode)" @mouseleave="hide()"
            >
              <i class="pi pi-microchip-ai"></i>
              <span>LLM-роутер</span>
              <div class="hiw-chips">
                <span v-for="m in models" :key="m">{{ m }}</span>
              </div>
            </div>
          </div>

          <!-- Агенты -->
          <div class="hiw-core-row">
            <div
              v-for="agent in agents" :key="agent.id"
              class="hiw-node hiw-node--agent"
              @mouseenter="show(agent)" @mouseleave="hide()"
            >
              <i :class="agent.icon"></i>
              <span>{{ agent.label }}</span>
            </div>
          </div>

          <!-- Процессы -->
          <div class="hiw-core-row">
            <div
              v-for="proc in processes" :key="proc.id"
              class="hiw-node hiw-node--proc"
              @mouseenter="show(proc)" @mouseleave="hide()"
            >
              <i :class="proc.icon"></i>
              <span>{{ proc.label }}</span>
            </div>
          </div>
        </div>

        <!-- Коннектор вниз -->
        <div class="hiw-connector">
          <div class="hiw-connector-line"></div>
          <div class="hiw-connector-dot"></div>
          <div class="hiw-connector-line"></div>
        </div>

        <!-- СЛОЙ 3: Результаты -->
        <div class="hiw-layer">
          <div class="hiw-layer-label">РЕЗУЛЬТАТЫ ИНВЕСТОРУ</div>
          <div class="hiw-row">
            <div
              v-for="out in outputs" :key="out.id"
              class="hiw-node hiw-node--out"
              @mouseenter="show(out)" @mouseleave="hide()"
            >
              <i :class="out.icon"></i>
              <span>{{ out.label }}</span>
            </div>
          </div>
        </div>

        <!-- Всплывающая подсказка -->
        <Transition name="tooltip">
          <div v-if="tip" class="hiw-tooltip" :style="tipStyle">
            <div class="hiw-tooltip-title">{{ tip.label }}</div>
            <div class="hiw-tooltip-desc">{{ tip.desc }}</div>
            <div v-if="tip.detail" class="hiw-tooltip-detail">{{ tip.detail }}</div>
            <div v-if="tip.route" class="hiw-tooltip-link" @click="$router.push(tip.route)">
              Открыть модуль <i class="pi pi-arrow-right"></i>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Боковая инфо -->
      <div class="hiw-footer-row">
        <div class="hiw-stat" v-for="s in stats" :key="s.label">
          <div class="hiw-stat-val">{{ s.val }}</div>
          <div class="hiw-stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const tip = ref(null)
const tipStyle = ref({})

function show(node, e) {
  tip.value = node
}
function hide() {
  tip.value = null
}

const models = ['Claude', 'DeepSeek', 'GPT-4o', 'YandexGPT']

const stats = [
  { val: '48 ч', label: 'Анализ сделки' },
  { val: '6', label: 'AI-агентов' },
  { val: '30+', label: 'Модулей' },
  { val: '1 100+', label: 'Концептов в графе знаний' },
  { val: '60+', label: 'MCP-инструментов' },
]

const sources = [
  { id: 's1', icon: 'pi pi-file-edit', label: 'Заявка', desc: 'Стартап подаёт заявку через веб-форму, Telegram-бота или API. Система автоматически извлекает ключевые параметры.', detail: 'Время: ~5 минут', route: '/fst-apply' },
  { id: 's2', icon: 'pi pi-database', label: 'ЕГРЮЛ', desc: 'Автоматический запрос в государственные реестры — проверка юрлица, учредителей, финансовой отчётности.', detail: 'Источник: ФНС, Росстат' },
  { id: 's3', icon: 'pi pi-globe', label: 'Рынок', desc: 'Анализ рыночных трендов, конкурентной среды, TAM/SAM/SOM — на основе открытых данных и баз.', detail: 'Автоматический сбор' },
  { id: 's4', icon: 'pi pi-verified', label: 'Патенты', desc: 'Проверка патентной чистоты и IP через Роспатент. Оценка уникальности технологического решения.', detail: 'Источник: Роспатент' },
  { id: 's5', icon: 'pi pi-building', label: 'Реестр БАС', desc: 'Проверка по реестру производителей БПЛА (ПП-1726). Сертификация и соответствие нацпроекту.', detail: 'Постановление Правительства №1726', route: '/fst-registry' },
]

const llmNode = {
  id: 'llm', icon: 'pi pi-microchip-ai', label: 'LLM-роутер',
  desc: 'Автоматически выбирает лучшую AI-модель под каждую задачу. Claude — для стратегии, DeepSeek — для кода и данных, GPT-4o — мультимодальные задачи.',
  detail: '4 модели, переключение за 0 мс'
}

const agents = [
  { id: 'a1', icon: 'pi pi-microchip-ai', label: 'Технолог', desc: 'Оценивает TRL-уровень, технологический стек, патентную чистоту и масштабируемость решения.', detail: 'Проверяет: TRL, стек, IP', route: '/fst-committee' },
  { id: 'a2', icon: 'pi pi-wallet', label: 'Финансист', desc: 'Анализирует unit-экономику, burn rate, прогноз выручки, точку безубыточности.', detail: 'Строит финмодель DCF/IRR', route: '/fst-committee' },
  { id: 'a3', icon: 'pi pi-chart-bar', label: 'Рыночник', desc: 'Оценивает TAM/SAM/SOM, конкурентов, рыночные тренды и потенциал роста.', detail: 'Конкурентный анализ', route: '/fst-committee' },
  { id: 'a4', icon: 'pi pi-shield', label: 'Юрист', desc: 'Проверяет структуру IP, регуляторные риски, корпоративное право, санкционные списки.', detail: 'AML/KYC + санкции', route: '/fst-committee' },
  { id: 'a5', icon: 'pi pi-compass', label: 'Стратег', desc: 'Оценивает product-market fit, стратегию масштабирования, потенциал выхода на экспорт.', detail: 'PMF + стратегия роста', route: '/fst-committee' },
  { id: 'a6', icon: 'pi pi-exclamation-triangle', label: 'Риск', desc: 'Идентифицирует ключевые риски: рыночные, технологические, команды, санкционные. Оценка суверенности.', detail: 'Матрица рисков 9D', route: '/fst-committee' },
]

const processes = [
  { id: 'p1', icon: 'pi pi-chart-bar', label: 'Скоринг T·S·M·G·E', desc: 'Факторная модель: Technology, Sovereignty, Market, Governance, Economics — каждый фактор 0–100, итоговый балл.', route: '/fst-factor' },
  { id: 'p2', icon: 'pi pi-shield', label: 'Суверенность 9D', desc: '9 измерений суверенности: кадры, компоненты, ПО, данные, IP, инфра, финансы, рынок, регуляторика.', route: '/fst-sovereignty' },
  { id: 'p3', icon: 'pi pi-calculator', label: 'Финмодель', desc: 'Автоматическая финансовая модель на HyperFormula: DCF, мультипликаторы, IRR, точка безубыточности.', route: '/fst-deal' },
  { id: 'p4', icon: 'pi pi-search', label: 'Due Diligence', desc: 'Автоматическая проверка по 50+ параметрам: юрлицо, финансы, патенты, репутация, судебные дела.', route: '/fst-duediligence' },
]

const outputs = [
  { id: 'o1', icon: 'pi pi-file', label: 'Меморандум', desc: 'AI генерирует полный инвестиционный меморандум за 15 минут. Раньше — 2–4 недели.', detail: '15 мин вместо 4 недель', route: '/fst-memo' },
  { id: 'o2', icon: 'pi pi-star', label: 'Скоринг 0–100', desc: 'Объективная оценка от 6 AI-агентов. Рекомендация: Инвестировать / Отклонить / Доработать.', detail: 'Коллегиальное решение 6 AI', route: '/fst-committee' },
  { id: 'o3', icon: 'pi pi-chart-line', label: 'Финмодель', desc: 'Готовая финансовая модель: DCF, IRR, мультипликаторы, сценарии выхода.', detail: 'Автоматический расчёт', route: '/fst-deal' },
  { id: 'o4', icon: 'pi pi-briefcase', label: 'Портфель 24/7', desc: 'Мониторинг портфеля в реальном времени: светофор, KPI-датчики, AI-алерты.', detail: 'Цифровой двойник компании', route: '/fst-portfolio' },
  { id: 'o5', icon: 'pi pi-file-check', label: 'ILPA-отчёты', desc: 'Автоматические квартальные отчёты для LP-инвесторов по стандарту ILPA.', detail: 'Стандарт ILPA', route: '/fst-ilpa' },
]
</script>

<style scoped>
.hiw {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  min-height: 0;
}

.hiw-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--p-text-color);
  text-align: center;
}
.hiw-subtitle {
  font-size: 13px;
  color: var(--p-text-muted-color);
  text-align: center;
  margin-bottom: 28px;
}

/* === DIAGRAM === */
.hiw-diagram {
  position: relative;
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

/* Layers */
.hiw-layer {
  width: 100%;
}
.hiw-layer-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  text-align: center;
  margin-bottom: 10px;
}

.hiw-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Nodes */
.hiw-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--p-content-border-color);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 90px;
  position: relative;
}
.hiw-node:hover {
  transform: translateY(-4px);
  z-index: 5;
}
.hiw-node i {
  font-size: 22px;
}
.hiw-node span {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-color);
  text-align: center;
}

/* Source nodes */
.hiw-node--src {
  background: color-mix(in srgb, var(--fst-blue) 6%, transparent);
  border-color: color-mix(in srgb, var(--fst-blue) 25%, transparent);
}
.hiw-node--src:hover {
  border-color: var(--fst-blue);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--fst-blue) 20%, transparent);
}
.hiw-node--src i { color: var(--fst-blue); }

/* Output nodes */
.hiw-node--out {
  background: color-mix(in srgb, var(--fst-green) 6%, transparent);
  border-color: color-mix(in srgb, var(--fst-green) 25%, transparent);
}
.hiw-node--out:hover {
  border-color: var(--fst-green);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--fst-green) 20%, transparent);
}
.hiw-node--out i { color: var(--fst-green); }

/* Agent nodes */
.hiw-node--agent {
  background: color-mix(in srgb, var(--fst-purple) 6%, transparent);
  border-color: color-mix(in srgb, var(--fst-purple) 20%, transparent);
  min-width: 80px;
}
.hiw-node--agent:hover {
  border-color: var(--fst-purple);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--fst-purple) 20%, transparent);
}
.hiw-node--agent i { color: var(--fst-purple); }

/* Process nodes */
.hiw-node--proc {
  background: color-mix(in srgb, var(--fst-cyan) 5%, transparent);
  border-color: color-mix(in srgb, var(--fst-cyan) 20%, transparent);
  flex-direction: row;
  min-width: auto;
  padding: 8px 14px;
  gap: 8px;
}
.hiw-node--proc:hover {
  border-color: var(--fst-cyan);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--fst-cyan) 15%, transparent);
}
.hiw-node--proc i { color: var(--fst-cyan); font-size: 14px; }
.hiw-node--proc span { font-size: 10px; }

/* LLM node */
.hiw-node--llm {
  background: color-mix(in srgb, var(--fst-brand) 6%, transparent);
  border-color: color-mix(in srgb, var(--fst-brand) 25%, transparent);
  padding: 12px 24px;
  min-width: 200px;
}
.hiw-node--llm:hover {
  border-color: var(--fst-brand);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--fst-brand) 20%, transparent);
}
.hiw-node--llm i { color: var(--fst-brand); }

.hiw-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}
.hiw-chips span {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--fst-brand) 12%, transparent);
  color: var(--fst-brand);
}

/* Core block */
.hiw-core {
  width: 100%;
  border: 2px solid color-mix(in srgb, var(--fst-purple) 25%, var(--p-content-border-color));
  border-radius: 16px;
  padding: 20px 16px;
  background: color-mix(in srgb, var(--fst-purple) 2%, var(--p-surface-card));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  position: relative;
}

.hiw-core-label {
  position: absolute;
  top: -10px;
  left: 20px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  background: var(--p-surface-card);
  color: var(--fst-purple);
  padding: 2px 12px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
}

.hiw-core-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Connectors */
.hiw-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
}
.hiw-connector-line {
  width: 2px;
  height: 16px;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--fst-purple) 30%, transparent), color-mix(in srgb, var(--fst-purple) 10%, transparent));
}
.hiw-connector-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fst-purple);
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in srgb, var(--fst-purple) 30%, transparent); }
  50% { opacity: 0.6; box-shadow: 0 0 0 6px color-mix(in srgb, var(--fst-purple) 0%, transparent); }
}

/* Tooltip */
.hiw-tooltip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: var(--p-surface-card);
  border: 1.5px solid var(--p-primary-color);
  border-radius: 14px;
  padding: 20px 24px;
  max-width: 340px;
  box-shadow: 0 16px 48px color-mix(in srgb, var(--p-text-color) 25%, transparent);
  pointer-events: auto;
}

.hiw-tooltip-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--p-text-color);
  margin-bottom: 8px;
}

.hiw-tooltip-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin-bottom: 8px;
}

.hiw-tooltip-detail {
  font-size: 11px;
  font-weight: 700;
  color: var(--fst-green);
  margin-bottom: 6px;
}

.hiw-tooltip-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-primary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hiw-tooltip-link:hover { text-decoration: underline; }

/* Tooltip transitions */
.tooltip-enter-active { transition: all 0.15s ease-out; }
.tooltip-leave-active { transition: all 0.1s ease-in; }
.tooltip-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
.tooltip-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }

/* Footer stats */
.hiw-footer-row {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
}

.hiw-stat {
  text-align: center;
}
.hiw-stat-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--p-text-color);
}
.hiw-stat-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

/* Responsive */
@media (max-width: 600px) {
  .hiw-node { min-width: 70px; padding: 10px 8px; }
  .hiw-node i { font-size: 18px; }
  .hiw-node span { font-size: 10px; }
  .hiw-tooltip { max-width: 280px; }
}
</style>

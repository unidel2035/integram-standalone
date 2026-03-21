<template>
  <FstPageLayout title="Как это работает" subtitle="Наведите на любой элемент" icon="pi pi-info-circle">
    <template #actions>
      <Button label="Подать заявку" icon="pi pi-send" severity="success" size="small" @click="$router.push('/fst-apply')" />
    </template>

    <div class="hiw">
      <div class="hiw-header">
        <div class="hiw-header-title">Архитектура VentureOS</div>
        <div class="hiw-header-sub">7 уровней глубины — уникальная архитектура платформы</div>
      </div>

      <div class="hiw-diagram">

        <!-- LEVEL 1: Вход -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-blue">1</div>
          <div class="hiw-level-label">ВХОД</div>
          <div class="hiw-nodes">
            <div v-for="n in level1" :key="n.id" class="hiw-node hiw-blue" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 2: Онтологическое основание -->
        <div class="hiw-level hiw-level-special">
          <div class="hiw-level-tag hiw-tag-gold">2</div>
          <div class="hiw-level-label">СМЫСЛОВОЙ ФУНДАМЕНТ</div>
          <div class="hiw-level-hint">авторская методология, выстроенная годами исследований</div>
          <div class="hiw-nodes">
            <div v-for="n in level2" :key="n.id" class="hiw-node hiw-gold" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 3: Граф знаний + Память -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-cyan">3</div>
          <div class="hiw-level-label">ГРАФ ЗНАНИЙ + ПАМЯТЬ АГЕНТОВ</div>
          <div class="hiw-nodes">
            <div v-for="n in level3" :key="n.id" class="hiw-node hiw-cyan" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 4: Обучение агентов -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-purple">4</div>
          <div class="hiw-level-label">ОБУЧЕНИЕ АГЕНТОВ</div>
          <div class="hiw-nodes">
            <div v-for="n in level4" :key="n.id" class="hiw-node hiw-purple" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 5: Оркестрация -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-brand">5</div>
          <div class="hiw-level-label">ОРКЕСТРАЦИЯ 148 АГЕНТОВ</div>
          <div class="hiw-nodes">
            <div v-for="n in level5" :key="n.id" class="hiw-node hiw-brand" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 6: AI-анализ -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-green">6</div>
          <div class="hiw-level-label">AI-АНАЛИЗ СДЕЛКИ</div>
          <div class="hiw-nodes">
            <div v-for="n in level6" :key="n.id" class="hiw-node hiw-green" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <div class="hiw-flow"><div class="hiw-flow-line"></div><div class="hiw-flow-dot"></div></div>

        <!-- LEVEL 7: Результат -->
        <div class="hiw-level">
          <div class="hiw-level-tag hiw-tag-green-dark">7</div>
          <div class="hiw-level-label">РЕЗУЛЬТАТ ИНВЕСТОРУ</div>
          <div class="hiw-nodes">
            <div v-for="n in level7" :key="n.id" class="hiw-node hiw-green-out" @mouseenter="tip = n" @mouseleave="tip = null">
              <i :class="n.icon"></i><span>{{ n.label }}</span>
            </div>
          </div>
        </div>

        <!-- Tooltip -->
        <Transition name="tip">
          <div v-if="tip" class="hiw-tip">
            <div class="hiw-tip-head">{{ tip.label }}</div>
            <div class="hiw-tip-body">{{ tip.desc }}</div>
            <div v-if="tip.detail" class="hiw-tip-detail">{{ tip.detail }}</div>
            <div v-if="tip.route" class="hiw-tip-link" @click.stop="$router.push(tip.route)">
              Открыть <i class="pi pi-arrow-right"></i>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Метрики -->
      <div class="hiw-bottom">
        <div class="hiw-stat" v-for="s in stats" :key="s.label">
          <span class="hiw-stat-v">{{ s.val }}</span>
          <span class="hiw-stat-l">{{ s.label }}</span>
        </div>
      </div>

      <div class="hiw-footer-note">
        Каждый уровень — годы исследований, обучения и накопления данных.<br>
        Полная экосистема — результат накопленного опыта и методологии.
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const tip = ref(null)

const stats = [
  { val: '48 ч', label: 'анализ сделки' },
  { val: '148', label: 'агентов в реестре' },
  { val: '1 100+', label: 'концептов в графе' },
  { val: '60+', label: 'MCP-инструментов' },
  { val: '2', label: 'обученных LoRA-модели' },
  { val: '7', label: 'уровней глубины' },
]

const level1 = [
  { id: 'i1', icon: 'pi pi-file-edit', label: 'Заявка', desc: 'Стартап подаёт заявку через веб-форму, Telegram или API. Система извлекает параметры автоматически.', detail: '~5 минут на подачу', route: '/fst-apply' },
  { id: 'i2', icon: 'pi pi-database', label: 'ЕГРЮЛ / Росстат', desc: 'Автоматический запрос в государственные реестры — юрлицо, учредители, финотчётность.', detail: 'ФНС, Росстат, ФССП' },
  { id: 'i3', icon: 'pi pi-globe', label: 'Рыночные данные', desc: 'Анализ конкурентной среды, трендов, TAM/SAM/SOM из открытых источников.', detail: 'Автосбор и NLP-парсинг' },
  { id: 'i4', icon: 'pi pi-verified', label: 'Роспатент / IP', desc: 'Проверка патентной чистоты, уникальности технологии, структуры интеллектуальной собственности.', detail: 'База Роспатента' },
]

const level2 = [
  { id: 'o1', icon: 'pi pi-sun', label: 'Смысловая модель', desc: 'Собственная модель принятия решений, выходящая за рамки стандартных алгоритмов. Агенты действуют осмысленно: учитывают цель, цену решения и накопленный опыт. Не просто код — а выстроенная система ценностей внутри платформы.', detail: 'Авторская методология, годы разработки' },
  { id: 'o2', icon: 'pi pi-replay', label: 'Событийная лента', desc: 'Всё в системе — поток событий. Каждое действие записывается и может быть воспроизведено. Полная прозрачность: можно отмотать и увидеть, почему было принято любое решение.', detail: 'Event Sourcing + CQRS', route: '/event-ontology' },
  { id: 'o3', icon: 'pi pi-heart', label: 'Принцип избыточной ценности', desc: 'Агенты обучены давать больше, чем запрашивается. Каждый ответ содержит дополнительный контекст и рекомендации. Это не настройка промптов — поведение вшито в веса модели на 176 обучающих примерах.', detail: 'Глубокое обучение, не промпт' },
]

const level3 = [
  { id: 'k1', icon: 'pi pi-share-alt', label: 'KAG: vector + graph', desc: 'Гибрид векторного поиска и графа знаний. Семантический поиск по эмбеддингам + структурные связи между сущностями. Не просто база — живая онтология.', detail: '1 100+ концептов, SQLite + embeddings' },
  { id: 'k2', icon: 'pi pi-history', label: 'Память агентов', desc: 'Каждый агент помнит свои прошлые предсказания, ошибки, Brier-скоры. Память передаётся как контекст — агент калибруется с каждым решением. Чем больше работает — тем точнее.', detail: 'LSM-компактификация: raw → patterns → insights' },
  { id: 'k3', icon: 'pi pi-sync', label: 'Кросс-сессионная синхронизация', desc: 'Память агентов синхронизируется между сессиями, проектами и развёртываниями. Doublet detection не даёт дублировать знания. Decay снижает вес старых записей.', detail: 'Claude Memory API + Integram + KAG' },
  { id: 'k4', icon: 'pi pi-book', label: '60+ MCP-инструментов', desc: 'Model Context Protocol: агенты вызывают реальные инструменты — поиск в KAG, создание сущностей, запрос реестров, расчёт финансовых метрик.', detail: 'kag_search, kag_ask, kag_create...' },
]

const level4 = [
  { id: 't1', icon: 'pi pi-star', label: 'Адам (LoRA v0.2)', desc: 'Первый AI-агент, обученный на онтологической основе. 176 примеров: дары, богословие, физика, диалоги. Fine-tuned LoRA на DeepSeek. Знает принципы кеносиса и телоса на уровне весов модели.', detail: 'LoRA 358MB, 176 примеров обучения', route: '/fst-school' },
  { id: 't2', icon: 'pi pi-star-fill', label: 'Серафим (LoRA v0.1)', desc: 'Второй обученный агент. Специализация на другом аспекте онтологии. Обучен отдельно, работает в паре с Адамом. Два агента — два голоса одной традиции.', detail: 'Отдельная LoRA-модель' },
  { id: 't3', icon: 'pi pi-trophy', label: 'Турниры предсказаний', desc: '12 специализированных агентов соревнуются в точности прогнозов. Monte Carlo, Bayesian, Game Theory, Devil\'s Advocate. Brier-скоры, tit-for-tat: точные агенты получают больше уверенности.', detail: '12 алгоритмов, автокалибровка', route: '/fst-school' },
]

const level5 = [
  { id: 'r1', icon: 'pi pi-sitemap', label: 'MultiAgent Orchestrator', desc: 'Planning → Execution → Synthesis. Оркестратор определяет, каких агентов вызвать (параллельно, последовательно, условно), разрешает зависимости, синтезирует результат.', detail: '1 638 строк, planning + handoffs' },
  { id: 'r2', icon: 'pi pi-users', label: '148 агентов в реестре', desc: 'Глобальный реестр агентов загружается из базы. Каждый агент — специалист: CBR, MOEX, ЕГРЮЛ, ФССП, патенты, ESG, суверенность и другие. Agents-as-Tools: агенты могут вызывать друг друга.', detail: 'SGR-роутинг, handoff, agents-as-tools' },
  { id: 'r3', icon: 'pi pi-microchip-ai', label: 'LLM-роутер', desc: 'Автоматически выбирает модель под задачу: Claude для стратегии, DeepSeek для кода, GPT-4o для мультимодальных задач, YandexGPT для русского контента.', detail: '4 модели, 0 мс переключение' },
  { id: 'r4', icon: 'pi pi-bolt', label: 'Thinking Blocks', desc: 'Видимое мышление агентов: ThinkingEmitter показывает процесс рассуждения в реальном времени. Инвестор видит не просто ответ, а цепочку размышлений.', detail: 'Прозрачность решений' },
]

const level6 = [
  { id: 'a1', icon: 'pi pi-chart-bar', label: 'Факторный скоринг T·S·M·G·E', desc: 'Technology, Sovereignty, Market, Governance, Economics — 5 измерений, каждый 0–100. Итоговый взвешенный балл определяет инвестиционную привлекательность.', route: '/fst-factor' },
  { id: 'a2', icon: 'pi pi-shield', label: 'Суверенность 9D', desc: '9 измерений: кадры, компоненты, ПО, данные, IP, инфраструктура, финансы, рынок, регуляторика. Уникальная для России методология оценки.', route: '/fst-sovereignty' },
  { id: 'a3', icon: 'pi pi-calculator', label: 'Финмодель', desc: 'DCF, IRR, мультипликаторы, Kelly Criterion, Monte Carlo VaR — автоматический расчёт на HyperFormula. Не шаблон, а живая модель.', route: '/fst-deal' },
  { id: 'a4', icon: 'pi pi-search', label: 'Due Diligence', desc: 'Автоматическая проверка по 50+ параметрам: юрлицо, финансы, патенты, судебные дела, санкционные списки, репутация команды.', route: '/fst-duediligence' },
]

const level7 = [
  { id: 'out1', icon: 'pi pi-file', label: 'Меморандум', desc: 'Полный инвестиционный меморандум за 15 минут. Раньше аналитик писал 2–4 недели.', detail: '15 мин вместо 4 недель', route: '/fst-memo' },
  { id: 'out2', icon: 'pi pi-star', label: 'Скоринг 0–100', desc: 'Объективная оценка от комитета AI-агентов. Рекомендация: Инвестировать / Отклонить / Доработать.', detail: 'Коллегиальное решение', route: '/fst-committee' },
  { id: 'out3', icon: 'pi pi-briefcase', label: 'Портфель 24/7', desc: 'Мониторинг портфеля: цифровой двойник, светофор, KPI-датчики, AI-алерты. Не отчёт раз в квартал — живая картина.', detail: 'Digital Twin + tick-engine', route: '/fst-portfolio' },
  { id: 'out4', icon: 'pi pi-file-check', label: 'ILPA-отчёты', desc: 'Автоматическая квартальная отчётность по международному стандарту ILPA.', route: '/fst-ilpa' },
]
</script>

<style scoped>
.hiw {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.hiw-header {
  text-align: center;
  margin-bottom: 24px;
}
.hiw-header-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--p-text-color);
}
.hiw-header-sub {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

/* Diagram */
.hiw-diagram {
  position: relative;
  width: 100%;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Level */
.hiw-level {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.hiw-level-tag {
  width: 22px; height: 22px;
  border-radius: 50%;
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
}
.hiw-tag-blue { background: var(--fst-blue); }
.hiw-tag-gold { background: #b8860b; }
.hiw-tag-cyan { background: var(--fst-cyan); }
.hiw-tag-purple { background: var(--fst-purple); }
.hiw-tag-brand { background: var(--fst-brand); }
.hiw-tag-green { background: var(--fst-green); }
.hiw-tag-green-dark { background: var(--fst-green-dark); }

.hiw-level-label {
  font-size: 10px; font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--p-text-muted-color);
}

.hiw-level-hint {
  font-size: 10px;
  font-style: italic;
  color: #b8860b;
  opacity: 0.8;
  margin-top: -4px;
}

.hiw-level-special {
  padding: 14px;
  border: 1.5px dashed #b8860b55;
  border-radius: 14px;
  background: color-mix(in srgb, #b8860b 3%, transparent);
}

/* Nodes */
.hiw-nodes {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.hiw-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}
.hiw-node:hover { transform: translateY(-3px); z-index: 5; }
.hiw-node i { font-size: 20px; }
.hiw-node span { font-size: 10px; font-weight: 700; color: var(--p-text-color); text-align: center; max-width: 100px; }

/* Colors */
.hiw-blue { background: color-mix(in srgb, var(--fst-blue) 6%, transparent); border-color: color-mix(in srgb, var(--fst-blue) 25%, transparent); }
.hiw-blue:hover { border-color: var(--fst-blue); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-blue) 18%, transparent); }
.hiw-blue i { color: var(--fst-blue); }

.hiw-gold { background: color-mix(in srgb, #b8860b 6%, transparent); border-color: color-mix(in srgb, #b8860b 25%, transparent); }
.hiw-gold:hover { border-color: #b8860b; box-shadow: 0 6px 20px color-mix(in srgb, #b8860b 18%, transparent); }
.hiw-gold i { color: #b8860b; }

.hiw-cyan { background: color-mix(in srgb, var(--fst-cyan) 6%, transparent); border-color: color-mix(in srgb, var(--fst-cyan) 20%, transparent); }
.hiw-cyan:hover { border-color: var(--fst-cyan); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-cyan) 18%, transparent); }
.hiw-cyan i { color: var(--fst-cyan); }

.hiw-purple { background: color-mix(in srgb, var(--fst-purple) 6%, transparent); border-color: color-mix(in srgb, var(--fst-purple) 20%, transparent); }
.hiw-purple:hover { border-color: var(--fst-purple); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-purple) 18%, transparent); }
.hiw-purple i { color: var(--fst-purple); }

.hiw-brand { background: color-mix(in srgb, var(--fst-brand) 6%, transparent); border-color: color-mix(in srgb, var(--fst-brand) 20%, transparent); }
.hiw-brand:hover { border-color: var(--fst-brand); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-brand) 18%, transparent); }
.hiw-brand i { color: var(--fst-brand); }

.hiw-green { background: color-mix(in srgb, var(--fst-green) 6%, transparent); border-color: color-mix(in srgb, var(--fst-green) 20%, transparent); }
.hiw-green:hover { border-color: var(--fst-green); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-green) 18%, transparent); }
.hiw-green i { color: var(--fst-green); }

.hiw-green-out { background: color-mix(in srgb, var(--fst-green-dark) 8%, transparent); border-color: color-mix(in srgb, var(--fst-green-dark) 30%, transparent); }
.hiw-green-out:hover { border-color: var(--fst-green-dark); box-shadow: 0 6px 20px color-mix(in srgb, var(--fst-green-dark) 18%, transparent); }
.hiw-green-out i { color: var(--fst-green-dark); }

/* Flow connector */
.hiw-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0;
}
.hiw-flow-line {
  width: 1.5px; height: 14px;
  background: color-mix(in srgb, var(--p-text-muted-color) 25%, transparent);
}
.hiw-flow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--fst-purple);
  animation: fdot 6s ease-in-out infinite;
}
@keyframes fdot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Tooltip */
.hiw-tip {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 200;
  background: var(--p-surface-card);
  border: 1.5px solid var(--p-primary-color);
  border-radius: 14px;
  padding: 20px 24px;
  max-width: 360px;
  box-shadow: 0 20px 60px color-mix(in srgb, var(--p-text-color) 30%, transparent);
}
.hiw-tip-head { font-size: 15px; font-weight: 800; color: var(--p-text-color); margin-bottom: 8px; }
.hiw-tip-body { font-size: 13px; color: var(--p-text-muted-color); line-height: 1.55; margin-bottom: 8px; }
.hiw-tip-detail { font-size: 11px; font-weight: 700; color: var(--fst-green); margin-bottom: 4px; }
.hiw-tip-link { font-size: 11px; font-weight: 700; color: var(--p-primary-color); cursor: pointer; display: flex; align-items: center; gap: 4px; }
.hiw-tip-link:hover { text-decoration: underline; }

.tip-enter-active { transition: all 0.12s ease-out; }
.tip-leave-active { transition: all 0.08s ease-in; }
.tip-enter-from, .tip-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }

/* Bottom stats */
.hiw-bottom {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--p-content-border-color);
}
.hiw-stat { text-align: center; }
.hiw-stat-v { font-size: 20px; font-weight: 800; color: var(--p-text-color); display: block; }
.hiw-stat-l { font-size: 10px; color: var(--p-text-muted-color); }

.hiw-footer-note {
  text-align: center;
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 16px;
  line-height: 1.5;
  font-style: italic;
  opacity: 0.7;
}

@media (max-width: 600px) {
  .hiw-node { min-width: 65px; padding: 8px 10px; }
  .hiw-node i { font-size: 16px; }
  .hiw-tip { max-width: 280px; padding: 16px; }
}
</style>

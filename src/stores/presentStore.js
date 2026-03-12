import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useEventStore } from './eventStore.js'

const SESSION_ID = 'present-live'

export const PRESENT_SCENARIO = [
  {
    id: 1,
    route: '/fst',
    title: 'Открываем лендинг',
    subtitle: 'Позиционирование — не автоматизация, переписывание',
    script: 'Это ФСТ НТИ. Мы не автоматизировали старый процесс венчурного фонда — мы его переписали. Стартап не заполняет никаких форм. Наш AI-агент сам собирает данные из открытых источников и оценивает команду через интервью.',
    actions: [
      'Прокрутите вниз до блока «было / стало»',
      'Покажите блок «Мы с вами до выхода» — упаковка стартапов',
      'Вернитесь наверх перед следующим шагом',
    ],
    duration: 90,
  },
  {
    id: 2,
    route: '/fst-hub',
    title: 'Командный центр',
    subtitle: 'Всё состояние фонда — один экран',
    script: 'Командный центр фонда. В одном экране: заявки в воронке, состояние портфеля, активность инвесткомитета. Больше 30 модулей — каждый закрывает конкретную задачу управляющего.',
    actions: [
      'Покажите метрики сверху: заявки, компании, NAV фонда',
      'Укажите на плитки модулей — объясните, что каждая — рабочий инструмент',
    ],
    duration: 60,
  },
  {
    id: 3,
    route: '/fst-dealflow',
    title: 'Воронка сделок',
    subtitle: 'AI уже разобрал каждую заявку',
    script: 'Воронка всех заявок. Каждая уже проанализирована AI: суверенность, финансовые риски, команда. Директор фонда не читает PDF — он видит готовый вердикт с аргументами.',
    actions: [
      'Кликните на любую заявку — покажите карточку с AI-оценкой',
      'Обратите внимание на колонку «Суверенность» — это уникально',
    ],
    duration: 90,
  },
  {
    id: 4,
    route: '/fst-committee',
    title: 'AI-инвесткомитет',
    subtitle: '6 агентов — настоящие дебаты',
    script: 'Вот сердце платформы. Шесть AI-агентов одновременно анализируют стартап: технолог оценивает уровень готовности, финансист смотрит юнит-экономику, агент суверенности считает 9 измерений независимости. Они спорят друг с другом. Это не скоринг — это дебаты.',
    actions: [
      'Запустите инвесткомитет — нажмите «Провести ИК»',
      'Покажите, как агенты берут слово и возражают друг другу',
      'Дождитесь финального голосования',
    ],
    duration: 180,
    highlight: true,
  },
  {
    id: 5,
    route: '/fst-deal',
    title: 'Доведение сделки',
    subtitle: 'Term Sheet · SPV · KPI-транши',
    script: 'ИК одобрил — переходим к сделке. Платформа генерирует Term Sheet, структурирует SPV, разбивает инвестицию на транши. Каждый следующий транш разблокируется только при достижении KPI — инвестор защищён на каждом этапе.',
    actions: [
      'Покажите вкладки: Equity / CLN / Грант',
      'Откройте «Транши» — покажите KPI-триггеры',
    ],
    duration: 90,
  },
  {
    id: 6,
    route: '/fst-portfolio',
    title: 'Мониторинг портфеля',
    subtitle: 'Светофор рисков · ЕГРЮЛ · HH.ru',
    script: 'Сделка закрыта — начинается мониторинг. Каждую ночь AI проверяет все компании по открытым источникам: ЕГРЮЛ, HH.ru, ГосЗакупки, новости. Светофор сразу показывает, где проблема. Директор видит риск раньше, чем он стал кризисом.',
    actions: [
      'Покажите светофор — зелёные / жёлтые / красные',
      'Кликните на красную метку — покажите AI-анализ проблемы',
    ],
    duration: 90,
  },
  {
    id: 7,
    route: '/fst-sovereignty',
    title: 'Аудит суверенности 9D',
    subtitle: 'Уникальный инструмент — вшит в каждую сделку',
    script: '9-мерная матрица суверенности технологии: производство, компонентная база, ПО, данные, IP, кадры, цепочка поставок, экспортный контроль, стратегическая независимость. Ни один другой фонд в России не имеет обязательного критерия суверенности.',
    actions: [
      'Покажите 9 измерений и шкалу 0–9',
      'Укажите на минимальный порог — жёсткое условие для инвестиции',
    ],
    duration: 90,
  },
  {
    id: 8,
    route: '/fst-fund',
    title: 'Цифровой двойник фонда',
    subtitle: 'NAV · IRR · DPI — 3 субфонда, реальное время',
    script: 'Цифровой двойник всего фонда. NAV, IRR, DPI по трём субфондам в реальном времени. Фонд прозрачен для LP, для государства, для управляющего. Это не отчёт раз в квартал — это живое зеркало фонда.',
    actions: [
      'Покажите три субфонда: БАС, Робототехника, Машиностроение',
      'Укажите на IRR и DPI — ключевые метрики для LP',
    ],
    duration: 90,
  },
]

export const usePresentStore = defineStore('present', () => {
  const isActive = ref(false)
  const currentIndex = ref(0)
  const aiInsight = ref(null)      // AI commentary for current step
  const aiLoading = ref(false)

  let bc = null

  const currentStep = computed(() => PRESENT_SCENARIO[currentIndex.value] || null)
  const totalSteps = computed(() => PRESENT_SCENARIO.length)
  const progress = computed(() => ((currentIndex.value + 1) / totalSteps.value) * 100)
  const isFirst = computed(() => currentIndex.value === 0)
  const isLast = computed(() => currentIndex.value === totalSteps.value - 1)

  function _emit(type, data = {}) {
    // Primary: event store (cross-account)
    try {
      const eventStore = useEventStore()
      eventStore.add('session', SESSION_ID, type, data)
    } catch (e) {
      console.warn('[Present] eventStore emit failed:', e)
    }
    // Secondary: BroadcastChannel (same browser, instant)
    try {
      if (!bc) bc = new BroadcastChannel('fst-present')
      bc.postMessage({ type, ...data })
    } catch {}
  }

  function start() {
    isActive.value = true
    currentIndex.value = 0
    aiInsight.value = null
    _emit('PRESENT_STARTED', { stepIndex: 0, route: PRESENT_SCENARIO[0].route, stepTitle: PRESENT_SCENARIO[0].title })
    _emitStep(0)
    _loadAiInsight(0)
  }

  function next() {
    if (isLast.value) return
    currentIndex.value++
    _emitStep(currentIndex.value)
    _loadAiInsight(currentIndex.value)
  }

  function prev() {
    if (isFirst.value) return
    currentIndex.value--
    _emitStep(currentIndex.value)
    _loadAiInsight(currentIndex.value)
  }

  function goTo(index) {
    if (index < 0 || index >= totalSteps.value) return
    currentIndex.value = index
    _emitStep(index)
    _loadAiInsight(index)
  }

  function stop() {
    _emit('PRESENT_STOPPED', { totalSteps: totalSteps.value })
    isActive.value = false
    currentIndex.value = 0
    aiInsight.value = null
    try { if (bc) { bc.postMessage({ type: 'stop' }); bc.close(); bc = null } } catch {}
  }

  function _emitStep(index) {
    const step = PRESENT_SCENARIO[index]
    _emit('PRESENT_STEP', {
      stepIndex: index,
      route: step.route,
      stepTitle: step.title,
      totalSteps: PRESENT_SCENARIO.length,
    })
  }

  async function _loadAiInsight(index) {
    aiInsight.value = null
    aiLoading.value = true
    const step = PRESENT_SCENARIO[index]
    try {
      const resp = await fetch('/api/ai-tokens/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'deepseek/deepseek-chat',
          application: 'PresentMode',
          systemPrompt: 'Ты — AI-советник на презентации. Отвечай кратко, по-русски. Только JSON.',
          prompt: `Горин показывает платформу ФСТ НТИ Пескову (директор НТИ, знает Claude, интересуется AI-агентами).

Текущий шаг ${index + 1}/${PRESENT_SCENARIO.length}: "${step.title}"
Маршрут: ${step.route}
Сценарий: ${step.script}

Сгенерируй JSON:
{
  "hook": "одна сильная фраза-крючок для начала шага (макс 15 слов)",
  "peskovQuestion": "самый вероятный вопрос от Пескова на этом шаге",
  "answer": "краткий ответ Гордина (2-3 предложения)",
  "techNote": "одна техническая деталь которая впечатлит Пескова как знатока AI"
}

Только JSON, без markdown.`
        })
      })
      const { response } = await resp.json()
      const clean = response.replace(/```json?/g, '').replace(/```/g, '').trim()
      aiInsight.value = JSON.parse(clean)
    } catch (e) {
      aiInsight.value = null
    } finally {
      aiLoading.value = false
    }
  }

  return {
    isActive, currentIndex, aiInsight, aiLoading,
    currentStep, totalSteps, progress, isFirst, isLast,
    start, next, prev, goTo, stop,
    SESSION_ID,
  }
})

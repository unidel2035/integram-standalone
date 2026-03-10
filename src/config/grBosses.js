/**
 * GR Bosses — регуляторные барьеры как игровые боссы
 * Каждый босс «спавнится» когда в ленте появляется триггерное событие.
 * HP уменьшается от последующих событий-атак.
 * HP = 0 → босс повержен.
 */

export const GR_BOSSES = [
  {
    id: 'regulatory_barrier',
    trigger: 'REGULATORY_BARRIER_DETECTED',
    name: 'Регуляторный Барьер',
    subtitle: 'Сертификация · Росавиация · НПА',
    emoji: '🏛️',
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #ef444418, #ef444404)',
    maxHp: 500,
    lore: 'Стоит на пути выхода на рынок. Требует терпеливого и системного взаимодействия с регуляторами. Один неверный шаг — и сертификация откатывается на старт.',
    attacks: [
      { type: 'WORKING_GROUP_FORMED', label: 'Создать рабочую группу',   damage: 80,  icon: 'pi pi-users' },
      { type: 'MEASURE_APPLIED',      label: 'Подать заявку на меру',    damage: 100, icon: 'pi pi-send' },
      { type: 'MEASURE_APPROVED',     label: 'Получить одобрение',       damage: 150, icon: 'pi pi-check' },
      { type: 'MEASURE_FUNDED',       label: 'Получить финансирование',  damage: 100, icon: 'pi pi-dollar' },
      { type: 'TRL_UPDATED',          label: 'Повысить TRL',             damage: 70,  icon: 'pi pi-chart-line' },
    ],
    defeatText: '🎉 Барьер устранён! Сертификация получена. Путь на рынок открыт.',
    rewards: ['Доступ к рынку', 'Статус «Сертифицировано»', '+200 XP'],
  },
  {
    id: 'market_failure',
    trigger: 'MARKET_FAILURE_DETECTED',
    name: 'Провал Рынка',
    subtitle: 'Нет спроса · Нет инфраструктуры · Высокий риск',
    emoji: '📉',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #f59e0b18, #f59e0b04)',
    maxHp: 400,
    lore: 'Рынок не готов принять продукт. Инвесторы не верят. Нужно создать спрос искусственно — через гранты, пилоты и государственные контракты.',
    attacks: [
      { type: 'MEASURE_APPLIED',  label: 'Подать на грантовую программу', damage: 80,  icon: 'pi pi-file' },
      { type: 'MEASURE_APPROVED', label: 'Получить одобрение гранта',     damage: 100, icon: 'pi pi-check' },
      { type: 'MEASURE_FUNDED',   label: 'Получить финансирование',       damage: 150, icon: 'pi pi-dollar' },
      { type: 'TRL_UPDATED',      label: 'Повысить TRL через R&D',        damage: 70,  icon: 'pi pi-chart-line' },
    ],
    defeatText: '🎉 Рынок открыт! Государственный спрос создан. Коммерциализация запущена.',
    rewards: ['Первый контракт', 'Валидация рынка', '+150 XP'],
  },
  {
    id: 'tech_gap',
    trigger: 'TECH_GAP_DETECTED',
    name: 'Технологический Разрыв',
    subtitle: 'TRL < 6 · Нет прототипа · Нет испытаний',
    emoji: '⚙️',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #3b82f618, #3b82f604)',
    maxHp: 350,
    lore: 'Технология не готова к рынку. Прототип работает в лаборатории, но не выдерживает реальных условий. Нужны НИОКР-инвестиции и испытательные полигоны.',
    attacks: [
      { type: 'MEASURE_APPLIED',  label: 'Подать заявку на НИОКР',    damage: 80,  icon: 'pi pi-send' },
      { type: 'MEASURE_FUNDED',   label: 'Получить финансирование',   damage: 150, icon: 'pi pi-dollar' },
      { type: 'TRL_UPDATED',      label: 'Повысить TRL',              damage: 120, icon: 'pi pi-chart-line' },
    ],
    defeatText: '🎉 Разрыв преодолён! TRL достиг боевого уровня. Испытания пройдены.',
    rewards: ['TRL 6+', 'Готовность к рынку', '+120 XP'],
  },
  {
    id: 'infra_gap',
    trigger: 'INFRA_GAP_DETECTED',
    name: 'Инфраструктурный Пробел',
    subtitle: 'Нет полигонов · Нет стандартов · Нет связи',
    emoji: '🏗️',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #8b5cf618, #8b5cf604)',
    maxHp: 300,
    lore: 'Инфраструктура для испытаний отсутствует. Стандарты не приняты. Без инфраструктуры невозможно ни испытать технологию, ни привлечь инвесторов.',
    attacks: [
      { type: 'MEASURE_APPLIED', label: 'Подать на инфраструктуру', damage: 100, icon: 'pi pi-send' },
      { type: 'MEASURE_FUNDED',  label: 'Получить финансирование',  damage: 150, icon: 'pi pi-dollar' },
      { type: 'TRL_UPDATED',     label: 'Применить на полигоне',    damage: 50,  icon: 'pi pi-chart-line' },
    ],
    defeatText: '🎉 Инфраструктура создана! Полигоны готовы. Стандарты приняты.',
    rewards: ['Доступ к полигонам', 'Стандарт принят', '+100 XP'],
  },
]

/**
 * Вычислить состояние босса из ленты событий
 * @returns null если босс ещё не заспавнился
 */
export function getBossState(boss, events) {
  const triggered = events.some(e => e.type === boss.trigger)
  if (!triggered) return null

  let currentHp = boss.maxHp
  const attacksDone = new Set()
  const attackLog = [] // { type, damage, ts }

  for (const attack of boss.attacks) {
    const evt = events.find(e => e.type === attack.type)
    if (evt) {
      currentHp -= attack.damage
      attacksDone.add(attack.type)
      attackLog.push({ type: attack.type, damage: attack.damage, ts: evt.ts })
    }
  }

  currentHp = Math.max(0, currentHp)
  const hpPercent = (currentHp / boss.maxHp) * 100
  const defeated = currentHp === 0

  return {
    triggered,
    currentHp,
    maxHp: boss.maxHp,
    hpPercent,
    defeated,
    attacksDone,
    attackLog,
    defeatTs: defeated ? Math.max(...attackLog.map(a => a.ts)) : null,
  }
}

/**
 * GR Achievements — игровые достижения
 * checkAchievements(events) → массив новых ачивок
 */

export const GR_ACHIEVEMENTS = [
  {
    id: 'first_blood',
    title: '🗡️ Первая кровь',
    desc: 'Нанесён первый удар по регуляторному барьеру',
    check: (evts) => evts.some(e => e.type === 'MEASURE_APPLIED'),
  },
  {
    id: 'first_grant',
    title: '💰 Первый грант',
    desc: 'Получено первое государственное финансирование',
    check: (evts) => evts.some(e => e.type === 'MEASURE_FUNDED'),
  },
  {
    id: 'boss_slayer',
    title: '⚔️ Убийца боссов',
    desc: 'Повержен первый регуляторный барьер',
    check: (evts) => {
      const triggers = ['REGULATORY_BARRIER_DETECTED', 'MARKET_FAILURE_DETECTED', 'TECH_GAP_DETECTED', 'INFRA_GAP_DETECTED']
      const hasApproved = evts.some(e => e.type === 'MEASURE_APPROVED')
      const hasFunded   = evts.some(e => e.type === 'MEASURE_FUNDED')
      return triggers.some(t => evts.some(e => e.type === t)) && hasApproved && hasFunded
    },
  },
  {
    id: 'triple_kill',
    title: '🔥 Тройное убийство',
    desc: 'Три меры финансированы за один проект',
    check: (evts) => evts.filter(e => e.type === 'MEASURE_FUNDED').length >= 3,
  },
  {
    id: 'speed_run',
    title: '⚡ Спидран',
    desc: 'Мера одобрена менее чем за 30 дней с момента подачи',
    check: (evts) => {
      const applied  = evts.find(e => e.type === 'MEASURE_APPLIED')
      const approved = evts.find(e => e.type === 'MEASURE_APPROVED')
      if (!applied || !approved) return false
      return (approved.ts - applied.ts) < 30 * 24 * 3600 * 1000
    },
  },
  {
    id: 'combo',
    title: '💥 Комбо x5',
    desc: '5 событий добавлено за один день',
    check: (evts) => {
      const byDay = {}
      for (const e of evts) {
        const day = new Date(e.ts).toDateString()
        byDay[day] = (byDay[day] || 0) + 1
      }
      return Object.values(byDay).some(v => v >= 5)
    },
  },
  {
    id: 'trl_hero',
    title: '🚀 TRL Герой',
    desc: 'TRL вырос с начала наблюдения',
    check: (evts) => evts.some(e => e.type === 'TRL_UPDATED'),
  },
  {
    id: 'working_group',
    title: '🤝 Дипломат',
    desc: 'Создана рабочая группа с регулятором',
    check: (evts) => evts.some(e => e.type === 'WORKING_GROUP_FORMED'),
  },
  {
    id: 'exterminator',
    title: '💀 Истребитель',
    desc: 'Повержены ВСЕ активные боссы',
    check: (evts) => {
      const triggers = ['REGULATORY_BARRIER_DETECTED', 'MARKET_FAILURE_DETECTED', 'TECH_GAP_DETECTED', 'INFRA_GAP_DETECTED']
      const active = triggers.filter(t => evts.some(e => e.type === t))
      if (!active.length) return false
      const fundedCount = evts.filter(e => e.type === 'MEASURE_FUNDED').length
      return fundedCount >= active.length * 2
    },
  },
]

/** XP за типы событий */
export const EVENT_XP = {
  PROJECT_STARTED:             10,
  MARKET_FAILURE_DETECTED:      5,
  TECH_GAP_DETECTED:            5,
  REGULATORY_BARRIER_DETECTED:  5,
  INFRA_GAP_DETECTED:           5,
  WORKING_GROUP_FORMED:        20,
  MEASURE_APPLIED:             30,
  MEASURE_APPROVED:            60,
  MEASURE_FUNDED:             100,
  MEASURE_REJECTED:            10,
  TRL_UPDATED:                 50,
  AI_PLAN_GENERATED:           15,
}

/** Уровни */
export const XP_LEVELS = [
  { level: 1,  xp: 0,    label: 'Стартап',       color: '#94a3b8' },
  { level: 2,  xp: 50,   label: 'Инициатор',     color: '#64748b' },
  { level: 3,  xp: 150,  label: 'Заявитель',     color: '#3b82f6' },
  { level: 4,  xp: 300,  label: 'Переговорщик',  color: '#6366f1' },
  { level: 5,  xp: 500,  label: 'GR-специалист', color: '#8b5cf6' },
  { level: 6,  xp: 800,  label: 'Лоббист',       color: '#a855f7' },
  { level: 7,  xp: 1200, label: 'Стратег',       color: '#f59e0b' },
  { level: 8,  xp: 1800, label: 'Мастер GR',     color: '#ef4444' },
  { level: 9,  xp: 2500, label: 'Архитектор',    color: '#ec4899' },
  { level: 10, xp: 3500, label: '⭐ Легенда',    color: '#fbbf24' },
]

export function calcXp(events) {
  return events.reduce((sum, e) => sum + (EVENT_XP[e.type] || 5), 0)
}

export function getLevel(xp) {
  let lvl = XP_LEVELS[0]
  for (const l of XP_LEVELS) {
    if (xp >= l.xp) lvl = l
  }
  const nextLvl = XP_LEVELS.find(l => l.xp > xp)
  const progress = nextLvl
    ? ((xp - lvl.xp) / (nextLvl.xp - lvl.xp)) * 100
    : 100
  return { ...lvl, xp, nextXp: nextLvl?.xp || lvl.xp, progress }
}

export function checkAchievements(events, unlockedIds = new Set()) {
  return GR_ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id) && a.check(events))
}

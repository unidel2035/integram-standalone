/**
 * Pipeline AI Service — агенты анализа регуляторного конвейера
 *
 * Три специализированных AI-агента:
 *   1. Blocker Detector (DeepSeek) — быстрый анализ блокировщиков
 *   2. Next-Step Predictor (Claude) — прогноз следующих событий
 *   3. Report Generator (Claude) — compliance-отчёт
 */

const AI_ENDPOINT = '/api/ai-tokens/chat'

const SYSTEM_BASE = `Ты — регуляторный аналитик ФСТ НТИ (Фонд содействия технологиям НТИ).
Регламент инвестиционной деятельности утверждён 23.03.2023. Ты знаешь все 6 подпроцессов (ПП-1→ПП-6).
Отвечай конкретно, ссылайся на пункты регламента. Цифры — в рублях и рабочих днях.`

// ─── Вспомогательная функция вызова AI ───────────────────────────────────────

async function callAI(modelId, systemPrompt, prompt, application) {
  const resp = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, systemPrompt, application }),
  })
  if (!resp.ok) throw new Error(`AI error ${resp.status}`)
  const { response } = await resp.json()
  return response
}

// ─── Агент 1: Анализ блокировщиков (DeepSeek — быстро) ──────────────────────

/**
 * @param {PipelineStage[]} stages
 * @param {{ name, inn, askMln }} dealData
 * @returns {{ blockers: string[], risks: string[], urgent: string[], confidence: number }}
 */
export async function analyzePipeline(stages, dealData = {}) {
  const stagesSummary = stages.map(s => ({
    id: s.id,
    label: s.label,
    name: s.name,
    status: s.status,
    elapsedDays: s.elapsedDays,
    slaExceeded: s.sla.exceeded,
    slaRemaining: s.sla.remaining,
    slaDays: s.slaDays,
    eventsCount: s.events.length,
    lastEvent: s.lastEvent?.label,
    nextPossible: s.nextPossible.map(e => e.label),
  }))

  const systemPrompt = `${SYSTEM_BASE}
Ты анализируешь конвейер инвестиционной сделки. Верни JSON строго в формате:
{
  "blockers": ["строка 1", "строка 2"],
  "risks": ["риск 1", "риск 2"],
  "urgent": ["срочное действие 1"],
  "confidence": 0.85,
  "summary": "одно предложение — общее состояние"
}
Только JSON, без markdown.`

  const prompt = `Сделка: ${dealData.name || 'VentureOS'} (${dealData.inn || ''})
Запрошено: ${dealData.askMln || '?'} млн ₽

Состояние конвейера:
${JSON.stringify(stagesSummary, null, 2)}

Найди блокировщики, риски и срочные действия.`

  try {
    const raw = await callAI('deepseek/deepseek-chat', systemPrompt, prompt, 'PipelineBlockerDetector')
    // Извлекаем JSON из ответа (DeepSeek иногда добавляет ```json)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return { blockers: [], risks: [], urgent: [], confidence: 0, summary: raw }
  } catch {
    return { blockers: ['Ошибка анализа'], risks: [], urgent: [], confidence: 0, summary: '' }
  }
}

// ─── Агент 2: Прогноз следующих шагов (Claude — стратегически) ──────────────

/**
 * @param {PipelineStage} activeStage - текущая активная стадия
 * @param {Object} dealContext - { name, trl, sector, askMln, stage }
 * @returns {{ predictions: [{ eventType, label, probability, reasoning, timeEstimate }] }}
 */
export async function predictNextEvents(activeStage, dealContext = {}) {
  if (!activeStage) return { predictions: [] }

  const systemPrompt = `${SYSTEM_BASE}
Ты прогнозируешь ход инвестиционной сделки. Верни JSON:
{
  "predictions": [
    {
      "eventType": "IC1_DECISION_APPROVED",
      "label": "Решение ИК-1: одобрено",
      "probability": 0.72,
      "reasoning": "2-3 предложения почему",
      "timeEstimate": "5-7 р.д."
    }
  ],
  "bottleneck": "главный риск текущей стадии в 1 предложении"
}
Только JSON. Давай 3 варианта от наиболее до наименее вероятного.`

  const prompt = `Текущая стадия: ${activeStage.label} — ${activeStage.name}
Регламент: ${activeStage.reglamentRef}, лимит ${activeStage.slaDays || '?'} р.д.
Прошло: ${activeStage.elapsedDays || 0} дн.
Состоявшиеся события: ${activeStage.events.map(e => e.label).join(', ') || 'нет'}
Возможные следующие: ${activeStage.nextPossible.map(e => e.label).join(', ') || 'нет'}

Контекст сделки:
- Компания: ${dealContext.name || 'не указано'}
- TRL: ${dealContext.trl || '?'}
- Отрасль: ${dealContext.sector || 'НТИ'}
- Запрошено: ${dealContext.askMln || '?'} млн ₽
- Стадия: ${dealContext.stage || '?'}

Что произойдёт скорее всего?`

  try {
    const raw = await callAI('anthropic/claude-sonnet-4-20250514', systemPrompt, prompt, 'PipelinePredictor')
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return { predictions: [], bottleneck: raw }
  } catch {
    return { predictions: [], bottleneck: 'Ошибка прогноза' }
  }
}

// ─── Агент 3: Генерация compliance-отчёта (Claude — полный текст) ────────────

/**
 * @param {PipelineStage[]} stages
 * @param {Object} dealData
 * @returns {string} - готовый текст отчёта
 */
export async function generatePipelineReport(stages, dealData = {}) {
  const systemPrompt = `${SYSTEM_BASE}
Ты составляешь официальный отчёт о соответствии инвестиционного процесса Регламенту ФСТ НТИ.
Пиши официальным деловым языком. Структура отчёта:
1. Шапка (дата, сделка, статус)
2. Исполнение подпроцессов (таблица ПП-1→ПП-6)
3. Нарушения регламента (если есть)
4. Рекомендации по ускорению
5. Вывод о готовности к следующему этапу
Используй конкретные ссылки на пункты регламента.`

  const stagesText = stages.map(s =>
    `${s.label} (${s.name}): ${s.status === 'done' ? '✓ Завершён' : s.status === 'active' ? '⟳ Активен' : s.status === 'blocked' ? '✗ Заблокирован' : '◦ Ожидает'}` +
    (s.elapsedDays ? `, ${s.elapsedDays} дн.` : '') +
    (s.sla.exceeded ? ` ⚠ SLA превышен` : '') +
    (s.events.length ? `\n   Событий: ${s.events.map(e => e.label).join(' → ')}` : '')
  ).join('\n')

  const prompt = `Сделка: ${dealData.name || 'Портфельный проект'}
ИНН: ${dealData.inn || 'не указан'}
Дата отчёта: ${new Date().toLocaleDateString('ru-RU')}
Запрошено: ${dealData.askMln || '?'} млн ₽

Состояние конвейера:
${stagesText}

Составь официальный отчёт о соответствии регламенту.`

  try {
    return await callAI('anthropic/claude-sonnet-4-20250514', systemPrompt, prompt, 'PipelineReportGenerator')
  } catch {
    return 'Ошибка генерации отчёта. Проверьте соединение с AI-сервисом.'
  }
}

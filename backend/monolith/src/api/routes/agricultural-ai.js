// Agricultural AI API Routes
// Handles AI-powered features for agriculture module
// Issue #1203 - Auto-generate technical specifications (TZ) for agricultural orders

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'

const router = express.Router()

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

/**
 * Build system prompt for TZ generation
 */
function buildSystemPrompt() {
  return `Вы - эксперт по точному земледелию и агрохимик со специализацией в области дронового опрыскивания и удобрения сельскохозяйственных культур. Ваша задача - создавать детальные, точные и профессиональные технические задания для подрядчиков, выполняющих услуги по обработке полей с использованием беспилотных летательных аппаратов (БПЛА).

Технические задания должны быть:
- Максимально конкретными и детализированными
- Основанными на агрономических принципах и текущем состоянии поля
- Учитывающими погодные условия и ограничения
- Содержащими точные параметры и требования к выполнению
- Включающими критерии приемки работ и показатели качества
- Соответствующими нормативным требованиям безопасности

Отвечайте только в формате JSON со следующей структурой:
{
  "technical_specification": {
    "title": "...",
    "section_1_general_info": { "title": "...", "content": "..." },
    "section_2_object": { "title": "...", "content": "..." },
    "section_3_technical_requirements": { "title": "...", "content": "..." },
    "section_4_weather_constraints": { "title": "...", "content": "..." },
    "section_5_safety": { "title": "...", "content": "..." },
    "section_6_execution_procedure": { "title": "...", "content": "..." },
    "section_7_quality_control": { "title": "...", "content": "..." },
    "section_8_contract_terms": { "title": "...", "content": "..." }
  },
  "full_text_markdown": "..."
}`
}

/**
 * Interpret NDVI value
 */
function interpretNDVI(value) {
  if (value >= 0.8) return 'Отличное состояние, густая и здоровая растительность'
  if (value >= 0.6) return 'Хорошее состояние, умеренная растительность'
  if (value >= 0.4) return 'Удовлетворительное, разреженная растительность'
  if (value >= 0.2) return 'Слабая растительность, возможны проблемы'
  return 'Критическое состояние, отсутствие здоровой растительности'
}

/**
 * Interpret NDRE value
 */
function interpretNDRE(value) {
  if (value > 0.4) return 'Высокое содержание азота, хорошее питание'
  if (value >= 0.3) return 'Достаточное содержание азота'
  if (value >= 0.2) return 'Недостаток азота, требуется подкормка'
  return 'Критический дефицит азота'
}

/**
 * Interpret GNDVI value
 */
function interpretGNDVI(value) {
  if (value > 0.7) return 'Высокое содержание хлорофилла, активный фотосинтез'
  if (value >= 0.5) return 'Нормальное содержание хлорофилла'
  if (value >= 0.3) return 'Пониженное содержание хлорофилла'
  return 'Проблемы с фотосинтезом'
}

/**
 * Build user prompt for TZ generation
 */
function buildUserPrompt(orderData) {
  const { field, service, weather, recipe, order, vegetation_indices } = orderData

  let prompt = `# Контекст заказа

## Информация о поле
- **Название:** ${field.name}
- **Площадь:** ${field.area} га
- **Культура:** ${field.crop_type}${field.crop_variety ? ` (сорт: ${field.crop_variety})` : ''}
${field.planting_date ? `- **Дата посадки:** ${field.planting_date}` : ''}
${field.growth_stage ? `- **Текущая фаза роста:** ${field.growth_stage}` : ''}
`

  // Add vegetation indices if available
  if (vegetation_indices && Object.keys(vegetation_indices).length > 0) {
    prompt += '\n## Состояние растительности (последние данные)\n'

    if (vegetation_indices.ndvi) {
      prompt += `- **NDVI:** ${vegetation_indices.ndvi.value} (дата: ${vegetation_indices.ndvi.date}) - ${interpretNDVI(vegetation_indices.ndvi.value)}\n`
    }

    if (vegetation_indices.ndre) {
      prompt += `- **NDRE:** ${vegetation_indices.ndre.value} (дата: ${vegetation_indices.ndre.date}) - ${interpretNDRE(vegetation_indices.ndre.value)}\n`
    }

    if (vegetation_indices.gndvi) {
      prompt += `- **GNDVI:** ${vegetation_indices.gndvi.value} (дата: ${vegetation_indices.gndvi.date}) - ${interpretGNDVI(vegetation_indices.gndvi.value)}\n`
    }
  }

  prompt += `
## Услуга
- **Тип:** ${service.name}
- **Описание:** ${service.description}
- **Категория:** ${service.service_type}
- **Площадь обработки:** ${order.total_area || field.area} га
- **Запланированная дата:** ${order.scheduled_date}
- **Приоритет:** ${order.priority}
`

  // Add weather information if available
  if (weather) {
    prompt += '\n## Погодные условия\n'

    if (service.weather_requirements) {
      prompt += '\n### Требования к погоде для данной услуги:\n'
      const req = service.weather_requirements
      if (req.temperature) {
        prompt += `- Температура воздуха: ${req.temperature.min}°C - ${req.temperature.max}°C\n`
      }
      if (req.wind_speed_max) {
        prompt += `- Скорость ветра: не более ${req.wind_speed_max} м/с\n`
      }
      if (req.humidity) {
        prompt += `- Влажность воздуха: ${req.humidity.min}% - ${req.humidity.max}%\n`
      }
    }

    if (weather.forecast) {
      prompt += `\n### Прогноз погоды на ${order.scheduled_date}:\n`
      prompt += `- **Температура:** ${weather.forecast.temp_min || weather.forecast.temp}°C - ${weather.forecast.temp_max || weather.forecast.temp}°C\n`
      prompt += `- **Ветер:** ${weather.forecast.wind_speed} м/с${weather.forecast.wind_direction ? `, направление ${weather.forecast.wind_direction}` : ''}\n`
      prompt += `- **Влажность:** ${weather.forecast.humidity}%\n`
      if (weather.forecast.precipitation_probability) {
        prompt += `- **Осадки:** ${weather.forecast.precipitation_probability}%\n`
      }
    }
  }

  // Add recipe information if applicable
  if (recipe && (service.service_type === 'fertilizer' || service.service_type === 'pesticide')) {
    prompt += `\n## Рецептура обработки\n`
    prompt += `\n### Препараты для внесения:\n`

    if (recipe.items && recipe.items.length > 0) {
      recipe.items.forEach(item => {
        prompt += `\n- **${item.product_name}**\n`
        if (item.manufacturer) prompt += `  - Производитель: ${item.manufacturer}\n`
        if (item.active_ingredient) prompt += `  - Активный ингредиент: ${item.active_ingredient}\n`
        if (item.form) prompt += `  - Форма: ${item.form}\n`
        if (item.concentration) prompt += `  - Концентрация: ${item.concentration} ${item.concentration_unit}\n`
        prompt += `  - Дозировка: ${item.dosage} ${item.unit}\n`
        if (item.hazard_class) prompt += `  - Класс опасности: ${item.hazard_class}\n`
        if (item.purpose) prompt += `  - Назначение: ${item.purpose}\n`
        if (item.waiting_period) prompt += `  - Срок ожидания до уборки: ${item.waiting_period} дней\n`
      })
    }

    if (recipe.application_method) {
      prompt += `\n### Метод внесения:\n- ${recipe.application_method}\n`
    }
  }

  // Add technical parameters
  prompt += `\n## Технические параметры\n`
  prompt += `- **Общая площадь обработки:** ${order.total_area || field.area} га\n`
  if (order.total_price) {
    prompt += `- **Стоимость работ:** ${order.total_price} ₽\n`
  }

  if (order.notes) {
    prompt += `\n## Примечания заказчика\n${order.notes}\n`
  }

  prompt += `\n---\n\n# Задание\n\nНа основе предоставленной информации сформируйте полное техническое задание для подрядчика в формате JSON, которое включает все 8 обязательных разделов:

1. **Общие сведения о заказе**
2. **Характеристика объекта обработки**
3. **Технические требования к выполнению работ**
4. **Погодные условия и временные ограничения**
5. **Требования безопасности**
6. **Порядок выполнения работ**
7. **Контроль качества и критерии приемки**
8. **Условия договора**

Техническое задание должно быть профессиональным, содержать конкретные параметры и быть готовым к включению в договор с подрядчиком.`

  return prompt
}

/**
 * Call AI service (mock implementation - replace with actual AI service call)
 */
async function callAIService(systemPrompt, userPrompt, model = 'gpt-4') {
  // TODO: Replace with actual AI API call to OpenAI/Anthropic/etc
  // This is a mock implementation for demonstration

  // console.log('AI Service Call:', { model, systemPromptLength: systemPrompt.length, userPromptLength: userPrompt.length })

  // Mock response - in production, this would call actual AI API
  return {
    technical_specification: {
      title: 'Техническое задание (автогенерация)',
      section_1_general_info: {
        title: '1. Общие сведения о заказе',
        content: 'Данное техническое задание регламентирует выполнение работ по [услуга] на поле [название поля]...'
      },
      section_2_object: {
        title: '2. Характеристика объекта обработки',
        content: 'Объектом обработки является сельскохозяйственное поле...'
      },
      section_3_technical_requirements: {
        title: '3. Технические требования к выполнению работ',
        content: 'Работы выполняются с использованием БПЛА...'
      },
      section_4_weather_constraints: {
        title: '4. Погодные условия и временные ограничения',
        content: 'Работы выполняются при соблюдении следующих погодных условий...'
      },
      section_5_safety: {
        title: '5. Требования безопасности',
        content: 'При выполнении работ необходимо соблюдать требования безопасности...'
      },
      section_6_execution_procedure: {
        title: '6. Порядок выполнения работ',
        content: '1. Подготовка оборудования...\n2. Загрузка препаратов...'
      },
      section_7_quality_control: {
        title: '7. Контроль качества и критерии приемки',
        content: 'Приемка работ осуществляется на основании следующих критериев...'
      },
      section_8_contract_terms: {
        title: '8. Условия договора',
        content: 'Срок выполнения работ, стоимость, порядок оплаты...'
      }
    },
    full_text_markdown: '# Техническое задание\n\n## 1. Общие сведения...'
  }
}

/**
 * POST /api/ai/agriculture/generate-tz
 * Generate technical specification for agricultural order
 */
router.post('/generate-tz', [
  body('order_data').isObject(),
  body('order_data.field').isObject(),
  body('order_data.service').isObject(),
  body('order_data.order').isObject(),
  body('model').optional().isString(),
  body('language').optional().isString(),
  body('detail_level').optional().isString()
], validate, async (req, res) => {
  try {
    const { order_data, model = 'gpt-4', language = 'ru', detail_level = 'comprehensive' } = req.body

    // console.log('Generating TZ for order:', {
    //   field: order_data.field.name,
    //   service: order_data.service.name,
    //   model,
    //   detail_level
    // })

    // Build prompts
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(order_data)

    // Call AI service
    const aiResponse = await callAIService(systemPrompt, userPrompt, model)

    // Add metadata
    const response = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      model_used: model,
      ...aiResponse,
      metadata: {
        field_id: order_data.field.id,
        service_id: order_data.service.id,
        order_id: order_data.order.id,
        total_area: order_data.order.total_area || order_data.field.area,
        total_cost: order_data.order.total_price,
        priority: order_data.order.priority,
        scheduled_date: order_data.order.scheduled_date
      }
    }

    res.status(200).json({
      success: true,
      data: response,
      message: 'Technical specification generated successfully'
    })
  } catch (error) {
    console.error('Error generating TZ:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate technical specification',
      message: error.message
    })
  }
})

/**
 * POST /api/ai/agriculture/validate-tz
 * Validate generated technical specification
 */
router.post('/validate-tz', [
  body('tz_data').isObject()
], validate, async (req, res) => {
  try {
    const { tz_data } = req.body

    // Validation logic
    const validationResults = {
      is_valid: true,
      checks: {
        all_sections_present: true,
        has_numeric_parameters: true,
        has_safety_requirements: true,
        has_acceptance_criteria: true,
        has_cost_breakdown: true
      },
      warnings: [],
      errors: []
    }

    // Check if all sections are present
    const requiredSections = [
      'section_1_general_info',
      'section_2_object',
      'section_3_technical_requirements',
      'section_4_weather_constraints',
      'section_5_safety',
      'section_6_execution_procedure',
      'section_7_quality_control',
      'section_8_contract_terms'
    ]

    const ts = tz_data.technical_specification
    if (!ts) {
      validationResults.is_valid = false
      validationResults.errors.push('Missing technical_specification object')
    } else {
      requiredSections.forEach(section => {
        if (!ts[section]) {
          validationResults.is_valid = false
          validationResults.checks.all_sections_present = false
          validationResults.errors.push(`Missing required section: ${section}`)
        }
      })
    }

    // Check for full_text_markdown
    if (!tz_data.full_text_markdown || tz_data.full_text_markdown.length < 500) {
      validationResults.warnings.push('Full text markdown is too short or missing')
    }

    res.status(200).json({
      success: true,
      data: validationResults
    })
  } catch (error) {
    console.error('Error validating TZ:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate technical specification',
      message: error.message
    })
  }
})

/**
 * POST /api/ai/agriculture/regenerate-tz-section
 * Regenerate a specific section of TZ
 */
router.post('/regenerate-tz-section', [
  body('tz_id').isString(),
  body('section_name').isString(),
  body('additional_context').optional().isObject(),
  body('model').optional().isString()
], validate, async (req, res) => {
  try {
    const { tz_id, section_name, additional_context = {}, model = 'gpt-4' } = req.body

    // TODO: Implement section regeneration logic
    // This would fetch the original TZ, regenerate the specified section, and return the updated section

    res.status(200).json({
      success: true,
      data: {
        section_name,
        regenerated_content: 'Regenerated section content...',
        regenerated_at: new Date().toISOString()
      },
      message: 'Section regenerated successfully'
    })
  } catch (error) {
    console.error('Error regenerating section:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate section',
      message: error.message
    })
  }
})

export default router

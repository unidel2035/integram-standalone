// workPlanTemplates.js - Ready-to-use Work Plan Templates
// Issue #5427: Work Plan Templates - Шаблоны планов работы субагента

import {
  STEP_TYPES,
  TRIGGER_TYPES,
  MCP_OPERATIONS,
  createWorkPlan,
  createStep
} from './workPlanService.js';

/**
 * Customer Support Plan Template
 * Классификация запроса, поиск в базе знаний, ответ или эскалация
 */
export const CUSTOMER_SUPPORT_TEMPLATE = {
  id: 'template-customer-support',
  name: 'Customer Support Plan',
  description: 'Автоматическая обработка запросов в службу поддержки с классификацией, поиском в базе знаний и эскалацией сложных случаев',
  trigger: {
    type: TRIGGER_TYPES.MESSAGE,
    config: {
      source: 'chat',
      filters: {
        channel: 'support'
      }
    }
  },
  steps: [
    {
      id: 'step-classify',
      name: 'Анализ и классификация запроса',
      description: 'Определение типа и сложности запроса клиента',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Проанализируй запрос клиента и классифицируй его:

Запрос: {{message}}

Определи:
1. Тип запроса (technical, billing, general, complaint)
2. Сложность (simple, medium, complex)
3. Приоритет (low, medium, high, urgent)
4. Ключевые слова для поиска в базе знаний

Ответь в формате JSON:
{
  "type": "...",
  "complexity": "...",
  "priority": "...",
  "keywords": ["..."]
}`,
        model: null,
        temperature: 0.3,
        maxTokens: 500,
        outputVar: 'classification'
      },
      outputVar: 'classification'
    },
    {
      id: 'step-search-kb',
      name: 'Поиск в базе знаний',
      description: 'Поиск релевантных статей и решений',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.SEARCH,
        table: 'knowledge_base',
        query: '{{classification.keywords}}',
        filters: {
          status: 'published',
          category: '{{classification.type}}'
        },
        limit: 5,
        outputVar: 'kb_results'
      },
      inputVars: ['classification'],
      outputVar: 'kb_results'
    },
    {
      id: 'step-check-complexity',
      name: 'Проверка сложности',
      description: 'Определение необходимости эскалации',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{classification.complexity}} == "complex"',
        thenStep: 'step-escalate',
        elseStep: 'step-generate-response'
      },
      inputVars: ['classification']
    },
    {
      id: 'step-generate-response',
      name: 'Генерация ответа',
      description: 'Формирование ответа на основе найденной информации',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `На основе запроса клиента и найденной информации сформируй полезный ответ:

Запрос: {{message}}
Найденная информация: {{kb_results}}

Требования:
- Дружелюбный тон
- Конкретные решения
- Ссылки на статьи при необходимости
- Предложение дополнительной помощи`,
        temperature: 0.7,
        maxTokens: 1000,
        outputVar: 'response'
      },
      inputVars: ['message', 'kb_results'],
      outputVar: 'response'
    },
    {
      id: 'step-escalate',
      name: 'Эскалация специалисту',
      description: 'Передача сложного запроса человеку-оператору',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'escalate',
        parameters: {
          department: '{{classification.type}}',
          priority: '{{classification.priority}}',
          context: {
            originalMessage: '{{message}}',
            classification: '{{classification}}',
            knowledgeBaseResults: '{{kb_results}}'
          }
        },
        outputVar: 'escalation_result'
      },
      inputVars: ['message', 'classification', 'kb_results'],
      outputVar: 'escalation_result'
    }
  ],
  variables: {
    message: '',
    classification: {},
    kb_results: [],
    response: '',
    escalation_result: {}
  },
  fallback: {
    action: 'escalate',
    message: 'Извините, произошла ошибка. Передаю ваш запрос специалисту.'
  },
  metadata: {
    category: 'customer-support',
    tags: ['support', 'classification', 'knowledge-base', 'escalation']
  }
};

/**
 * Lead Qualification Plan Template
 * Извлечение информации, оценка лида, назначение менеджера
 */
export const LEAD_QUALIFICATION_TEMPLATE = {
  id: 'template-lead-qualification',
  name: 'Lead Qualification Plan',
  description: 'Автоматическая квалификация лидов с извлечением информации, оценкой потенциала и назначением менеджера',
  trigger: {
    type: TRIGGER_TYPES.WEBHOOK,
    config: {
      endpoint: '/api/leads/new',
      method: 'POST'
    }
  },
  steps: [
    {
      id: 'step-extract-info',
      name: 'Извлечение информации о лиде',
      description: 'Парсинг и структурирование данных лида',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Извлеки структурированную информацию о потенциальном клиенте:

Данные: {{leadData}}

Извлеки:
1. Название компании
2. Контактное лицо (имя, должность)
3. Контакты (email, телефон)
4. Сфера деятельности
5. Размер компании (сотрудников)
6. Потребность/запрос
7. Бюджет (если указан)

Ответь в формате JSON.`,
        temperature: 0.2,
        maxTokens: 800,
        outputVar: 'extractedInfo'
      },
      inputVars: ['leadData'],
      outputVar: 'extractedInfo'
    },
    {
      id: 'step-enrich-data',
      name: 'Обогащение данных',
      description: 'Поиск дополнительной информации о компании',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.QUERY,
        table: 'companies_database',
        query: {
          companyName: '{{extractedInfo.companyName}}'
        },
        outputVar: 'companyData'
      },
      inputVars: ['extractedInfo'],
      outputVar: 'companyData'
    },
    {
      id: 'step-score-lead',
      name: 'Оценка лида',
      description: 'Присвоение баллов и категории лида',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Оцени качество лида по шкале от 0 до 100:

Информация о лиде: {{extractedInfo}}
Данные компании: {{companyData}}

Критерии оценки:
- Размер компании (30 баллов)
- Бюджет (25 баллов)
- Соответствие нашему ICP (25 баллов)
- Срочность потребности (20 баллов)

Также определи категорию: hot, warm, cold

Ответь в JSON: {"score": number, "category": string, "reasoning": string}`,
        temperature: 0.3,
        maxTokens: 500,
        outputVar: 'leadScore'
      },
      inputVars: ['extractedInfo', 'companyData'],
      outputVar: 'leadScore'
    },
    {
      id: 'step-check-score',
      name: 'Проверка качества лида',
      description: 'Определение дальнейших действий',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{leadScore.score}} >= 70',
        thenStep: 'step-assign-senior',
        elseStep: 'step-check-medium'
      },
      inputVars: ['leadScore']
    },
    {
      id: 'step-check-medium',
      name: 'Проверка среднего качества',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{leadScore.score}} >= 40',
        thenStep: 'step-assign-junior',
        elseStep: 'step-nurture'
      },
      inputVars: ['leadScore']
    },
    {
      id: 'step-assign-senior',
      name: 'Назначение старшего менеджера',
      description: 'Назначение горячего лида опытному менеджеру',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.CREATE,
        table: 'lead_assignments',
        data: {
          leadId: '{{leadData.id}}',
          managerId: '{{seniorManagerId}}',
          priority: 'high',
          category: '{{leadScore.category}}',
          score: '{{leadScore.score}}',
          assignedAt: new Date().toISOString()
        },
        outputVar: 'assignment'
      },
      inputVars: ['leadData', 'leadScore'],
      outputVar: 'assignment'
    },
    {
      id: 'step-assign-junior',
      name: 'Назначение младшего менеджера',
      description: 'Назначение теплого лида младшему менеджеру',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.CREATE,
        table: 'lead_assignments',
        data: {
          leadId: '{{leadData.id}}',
          managerId: '{{juniorManagerId}}',
          priority: 'medium',
          category: '{{leadScore.category}}',
          score: '{{leadScore.score}}',
          assignedAt: new Date().toISOString()
        },
        outputVar: 'assignment'
      },
      inputVars: ['leadData', 'leadScore'],
      outputVar: 'assignment'
    },
    {
      id: 'step-nurture',
      name: 'Добавление в nurture-кампанию',
      description: 'Холодный лид отправляется в автоматическую nurture-кампанию',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'add_to_campaign',
        parameters: {
          campaignId: 'nurture-low-score',
          leadId: '{{leadData.id}}',
          leadInfo: '{{extractedInfo}}',
          score: '{{leadScore.score}}'
        },
        outputVar: 'nurture_result'
      },
      inputVars: ['leadData', 'extractedInfo', 'leadScore'],
      outputVar: 'nurture_result'
    }
  ],
  variables: {
    leadData: {},
    extractedInfo: {},
    companyData: {},
    leadScore: {},
    assignment: {},
    nurture_result: {},
    seniorManagerId: 'auto',
    juniorManagerId: 'auto'
  },
  fallback: {
    action: 'notify',
    message: 'Ошибка при обработке лида. Требуется ручная проверка.'
  },
  metadata: {
    category: 'sales',
    tags: ['lead', 'qualification', 'scoring', 'assignment']
  }
};

/**
 * Data Processing Plan Template
 * Валидация, трансформация, сохранение в БД
 */
export const DATA_PROCESSING_TEMPLATE = {
  id: 'template-data-processing',
  name: 'Data Processing Plan',
  description: 'Обработка входящих данных с валидацией, трансформацией и сохранением в базу данных',
  trigger: {
    type: TRIGGER_TYPES.WEBHOOK,
    config: {
      endpoint: '/api/data/import',
      method: 'POST'
    }
  },
  steps: [
    {
      id: 'step-validate',
      name: 'Валидация данных',
      description: 'Проверка корректности и полноты данных',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Проверь корректность данных:

Данные: {{inputData}}
Схема: {{dataSchema}}

Проверь:
1. Наличие всех обязательных полей
2. Корректность типов данных
3. Диапазоны значений
4. Формат (email, телефон и т.д.)

Ответь в JSON: {"valid": boolean, "errors": [], "warnings": []}`,
        temperature: 0.1,
        maxTokens: 1000,
        outputVar: 'validationResult'
      },
      inputVars: ['inputData', 'dataSchema'],
      outputVar: 'validationResult'
    },
    {
      id: 'step-check-valid',
      name: 'Проверка валидности',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{validationResult.valid}} == true',
        thenStep: 'step-transform',
        elseStep: 'step-handle-invalid'
      },
      inputVars: ['validationResult']
    },
    {
      id: 'step-transform',
      name: 'Трансформация данных',
      description: 'Преобразование данных в целевой формат',
      type: STEP_TYPES.TRANSFORM,
      config: {
        transformations: [
          { field: 'date', operation: 'parseDate', format: 'YYYY-MM-DD' },
          { field: 'amount', operation: 'parseFloat', decimals: 2 },
          { field: 'status', operation: 'toLowerCase' },
          { field: 'tags', operation: 'split', delimiter: ',' }
        ],
        outputVar: 'transformedData'
      },
      inputVars: ['inputData'],
      outputVar: 'transformedData'
    },
    {
      id: 'step-save',
      name: 'Сохранение в базу данных',
      description: 'Запись обработанных данных',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.CREATE,
        table: 'processed_data',
        data: '{{transformedData}}',
        outputVar: 'saveResult'
      },
      inputVars: ['transformedData'],
      outputVar: 'saveResult'
    },
    {
      id: 'step-notify-success',
      name: 'Уведомление об успехе',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'notify',
        parameters: {
          type: 'success',
          message: 'Данные успешно обработаны и сохранены',
          details: '{{saveResult}}'
        },
        outputVar: 'notification'
      },
      inputVars: ['saveResult'],
      outputVar: 'notification'
    },
    {
      id: 'step-handle-invalid',
      name: 'Обработка невалидных данных',
      description: 'Логирование и уведомление об ошибках',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'log_error',
        parameters: {
          severity: 'warning',
          message: 'Получены невалидные данные',
          errors: '{{validationResult.errors}}',
          data: '{{inputData}}'
        },
        outputVar: 'errorLog'
      },
      inputVars: ['validationResult', 'inputData'],
      outputVar: 'errorLog'
    }
  ],
  variables: {
    inputData: {},
    dataSchema: {},
    validationResult: {},
    transformedData: {},
    saveResult: {},
    notification: {},
    errorLog: {}
  },
  fallback: {
    action: 'log',
    message: 'Критическая ошибка обработки данных'
  },
  metadata: {
    category: 'data',
    tags: ['validation', 'transformation', 'database', 'etl']
  }
};

/**
 * Notification Plan Template
 * Проверка условий, форматирование, отправка уведомлений
 */
export const NOTIFICATION_TEMPLATE = {
  id: 'template-notification',
  name: 'Notification Plan',
  description: 'Умная система уведомлений с проверкой условий, форматированием и множественными каналами',
  trigger: {
    type: TRIGGER_TYPES.EVENT,
    config: {
      eventType: 'notification_trigger',
      sources: ['system', 'user', 'scheduled']
    }
  },
  steps: [
    {
      id: 'step-check-condition',
      name: 'Проверка условий отправки',
      description: 'Проверка необходимости отправки уведомления',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Проверь, нужно ли отправлять уведомление:

Событие: {{event}}
Условия: {{notificationRules}}
История: {{userHistory}}

Учти:
1. Частоту уведомлений (не спамить)
2. Важность события
3. Настройки пользователя
4. Время суток

Ответь в JSON: {"shouldNotify": boolean, "reason": string, "channel": string}`,
        temperature: 0.2,
        maxTokens: 500,
        outputVar: 'notificationDecision'
      },
      inputVars: ['event', 'notificationRules', 'userHistory'],
      outputVar: 'notificationDecision'
    },
    {
      id: 'step-check-decision',
      name: 'Проверка решения',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{notificationDecision.shouldNotify}} == true',
        thenStep: 'step-format-message',
        elseStep: 'step-skip-notification'
      },
      inputVars: ['notificationDecision']
    },
    {
      id: 'step-format-message',
      name: 'Форматирование сообщения',
      description: 'Создание персонализированного сообщения',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Создай уведомление для пользователя:

Событие: {{event}}
Канал: {{notificationDecision.channel}}
Данные пользователя: {{userData}}

Требования:
- Краткость и ясность
- Персонализация
- Call-to-action если нужен
- Соответствие каналу (email/sms/push)

Ответь в JSON: {"subject": string, "body": string, "cta": string}`,
        temperature: 0.7,
        maxTokens: 800,
        outputVar: 'message'
      },
      inputVars: ['event', 'notificationDecision', 'userData'],
      outputVar: 'message'
    },
    {
      id: 'step-send-notification',
      name: 'Отправка уведомления',
      description: 'Отправка через выбранный канал',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'send_notification',
        parameters: {
          channel: '{{notificationDecision.channel}}',
          recipient: '{{userData.id}}',
          message: '{{message}}',
          priority: '{{event.priority}}',
          metadata: {
            eventId: '{{event.id}}',
            timestamp: new Date().toISOString()
          }
        },
        outputVar: 'sendResult'
      },
      inputVars: ['notificationDecision', 'userData', 'message', 'event'],
      outputVar: 'sendResult'
    },
    {
      id: 'step-log-sent',
      name: 'Логирование отправки',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.CREATE,
        table: 'notification_log',
        data: {
          userId: '{{userData.id}}',
          eventId: '{{event.id}}',
          channel: '{{notificationDecision.channel}}',
          status: 'sent',
          sentAt: new Date().toISOString()
        },
        outputVar: 'logEntry'
      },
      inputVars: ['userData', 'event', 'notificationDecision'],
      outputVar: 'logEntry'
    },
    {
      id: 'step-skip-notification',
      name: 'Пропуск уведомления',
      description: 'Логирование пропущенного уведомления',
      type: STEP_TYPES.ACTION,
      config: {
        actionType: 'log',
        parameters: {
          level: 'info',
          message: 'Уведомление не отправлено',
          reason: '{{notificationDecision.reason}}',
          event: '{{event}}'
        },
        outputVar: 'skipLog'
      },
      inputVars: ['notificationDecision', 'event'],
      outputVar: 'skipLog'
    }
  ],
  variables: {
    event: {},
    notificationRules: {},
    userHistory: [],
    notificationDecision: {},
    userData: {},
    message: {},
    sendResult: {},
    logEntry: {},
    skipLog: {}
  },
  fallback: {
    action: 'retry',
    message: 'Ошибка отправки уведомления. Повтор через 5 минут.'
  },
  metadata: {
    category: 'notifications',
    tags: ['notification', 'messaging', 'automation', 'personalization']
  }
};

/**
 * Content Moderation Plan Template
 * Анализ контента, модерация, действия
 */
export const CONTENT_MODERATION_TEMPLATE = {
  id: 'template-content-moderation',
  name: 'Content Moderation Plan',
  description: 'Автоматическая модерация пользовательского контента с AI-анализом и гибкими правилами',
  trigger: {
    type: TRIGGER_TYPES.MESSAGE,
    config: {
      source: 'user_content',
      contentTypes: ['text', 'image', 'comment']
    }
  },
  steps: [
    {
      id: 'step-analyze-content',
      name: 'Анализ контента',
      description: 'AI-анализ на наличие нарушений',
      type: STEP_TYPES.LLM,
      config: {
        prompt: `Проанализируй контент на соответствие правилам:

Контент: {{content}}
Правила: {{moderationRules}}

Проверь на:
1. Оскорбления и hate speech
2. Спам и реклама
3. Запрещенный контент
4. Нарушение авторских прав
5. Персональные данные

Ответ в JSON: {
  "safe": boolean,
  "violations": [],
  "severity": "none|low|medium|high|critical",
  "confidence": number
}`,
        temperature: 0.1,
        maxTokens: 1000,
        outputVar: 'analysis'
      },
      inputVars: ['content', 'moderationRules'],
      outputVar: 'analysis'
    },
    {
      id: 'step-check-safety',
      name: 'Проверка безопасности',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{analysis.safe}} == true',
        thenStep: 'step-approve',
        elseStep: 'step-check-severity'
      },
      inputVars: ['analysis']
    },
    {
      id: 'step-check-severity',
      name: 'Проверка серьезности',
      type: STEP_TYPES.CONDITION,
      config: {
        condition: '{{analysis.severity}} == "critical"',
        thenStep: 'step-block-content',
        elseStep: 'step-flag-review'
      },
      inputVars: ['analysis']
    },
    {
      id: 'step-approve',
      name: 'Одобрение контента',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.UPDATE,
        table: 'content',
        data: {
          contentId: '{{content.id}}',
          status: 'approved',
          moderatedAt: new Date().toISOString(),
          moderationType: 'auto'
        },
        outputVar: 'approvalResult'
      },
      inputVars: ['content'],
      outputVar: 'approvalResult'
    },
    {
      id: 'step-block-content',
      name: 'Блокировка контента',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.UPDATE,
        table: 'content',
        data: {
          contentId: '{{content.id}}',
          status: 'blocked',
          violations: '{{analysis.violations}}',
          moderatedAt: new Date().toISOString(),
          moderationType: 'auto'
        },
        outputVar: 'blockResult'
      },
      inputVars: ['content', 'analysis'],
      outputVar: 'blockResult'
    },
    {
      id: 'step-flag-review',
      name: 'Флаг на ручную проверку',
      type: STEP_TYPES.MCP,
      config: {
        operation: MCP_OPERATIONS.CREATE,
        table: 'moderation_queue',
        data: {
          contentId: '{{content.id}}',
          violations: '{{analysis.violations}}',
          severity: '{{analysis.severity}}',
          confidence: '{{analysis.confidence}}',
          flaggedAt: new Date().toISOString()
        },
        outputVar: 'flagResult'
      },
      inputVars: ['content', 'analysis'],
      outputVar: 'flagResult'
    }
  ],
  variables: {
    content: {},
    moderationRules: {},
    analysis: {},
    approvalResult: {},
    blockResult: {},
    flagResult: {}
  },
  fallback: {
    action: 'flag',
    message: 'Ошибка модерации. Контент направлен на ручную проверку.'
  },
  metadata: {
    category: 'moderation',
    tags: ['content', 'moderation', 'safety', 'ai']
  }
};

/**
 * Get all available templates
 * @returns {Object} Map of template IDs to templates
 */
export function getAllTemplates() {
  return {
    [CUSTOMER_SUPPORT_TEMPLATE.id]: CUSTOMER_SUPPORT_TEMPLATE,
    [LEAD_QUALIFICATION_TEMPLATE.id]: LEAD_QUALIFICATION_TEMPLATE,
    [DATA_PROCESSING_TEMPLATE.id]: DATA_PROCESSING_TEMPLATE,
    [NOTIFICATION_TEMPLATE.id]: NOTIFICATION_TEMPLATE,
    [CONTENT_MODERATION_TEMPLATE.id]: CONTENT_MODERATION_TEMPLATE
  };
}

/**
 * Get template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template object or null
 */
export function getTemplateById(templateId) {
  const templates = getAllTemplates();
  return templates[templateId] || null;
}

/**
 * Get templates by category
 * @param {string} category - Category name
 * @returns {Array} Array of templates
 */
export function getTemplatesByCategory(category) {
  const templates = getAllTemplates();
  return Object.values(templates).filter(
    template => template.metadata.category === category
  );
}

/**
 * Get templates by tag
 * @param {string} tag - Tag name
 * @returns {Array} Array of templates
 */
export function getTemplatesByTag(tag) {
  const templates = getAllTemplates();
  return Object.values(templates).filter(
    template => template.metadata.tags.includes(tag)
  );
}

/**
 * Create work plan from template
 * @param {string} templateId - Template ID
 * @param {Object} customizations - Custom overrides
 * @returns {Object} Work plan instance
 */
export function createFromTemplate(templateId, customizations = {}) {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const plan = createWorkPlan({
    ...template,
    id: `plan-${Date.now()}`,
    ...customizations,
    metadata: {
      ...template.metadata,
      ...customizations.metadata,
      templateId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  return plan;
}

/**
 * Get template categories
 * @returns {Array} Array of unique categories
 */
export function getTemplateCategories() {
  const templates = getAllTemplates();
  const categories = new Set();
  Object.values(templates).forEach(template => {
    if (template.metadata.category) {
      categories.add(template.metadata.category);
    }
  });
  return Array.from(categories);
}

/**
 * Get all template tags
 * @returns {Array} Array of unique tags
 */
export function getTemplateTags() {
  const templates = getAllTemplates();
  const tags = new Set();
  Object.values(templates).forEach(template => {
    if (template.metadata.tags) {
      template.metadata.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags);
}

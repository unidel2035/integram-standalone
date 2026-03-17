/**
 * AgentTaxonomy — Formal Classification System for Agent Workforce
 *
 * Deloitte Tech Trends 2026: Agents as "a new form of labor" need
 * HR-equivalent frameworks: naming, classification, lifecycle tracking.
 *
 * Taxonomy structure:
 * - Domain: broad area (analytics, operations, development, governance)
 * - Role: functional role within domain (analyst, executor, monitor, coordinator)
 * - Capability: specific skill (data-query, code-review, compliance-check)
 * - Autonomy Level: augmentation → automation → autonomy
 *
 * Every agent in the system gets a taxonomic classification that enables:
 * - Workforce planning (what roles are covered?)
 * - Capability gap analysis
 * - FinOps cost attribution by role
 * - Governance policies per autonomy level
 */

import logger from '../../utils/logger.js';

// ─── Taxonomy Definitions ────────────────────────────────────────────────────

export const DOMAINS = {
  ANALYTICS:    { id: 'analytics',    name: 'Аналитика',      icon: 'pi-chart-bar' },
  OPERATIONS:   { id: 'operations',   name: 'Операции',       icon: 'pi-cog' },
  DEVELOPMENT:  { id: 'development',  name: 'Разработка',     icon: 'pi-code' },
  GOVERNANCE:   { id: 'governance',   name: 'Управление',     icon: 'pi-shield' },
  KNOWLEDGE:    { id: 'knowledge',    name: 'Знания',         icon: 'pi-book' },
  COMMUNICATION:{ id: 'communication',name: 'Коммуникации',   icon: 'pi-comments' },
  INFRASTRUCTURE:{ id: 'infrastructure', name: 'Инфраструктура', icon: 'pi-server' },
};

export const ROLES = {
  ANALYST:      { id: 'analyst',      name: 'Аналитик',       description: 'Исследование, анализ данных, формирование выводов' },
  EXECUTOR:     { id: 'executor',     name: 'Исполнитель',    description: 'Выполнение конкретных задач, CRUD-операции' },
  MONITOR:      { id: 'monitor',      name: 'Наблюдатель',    description: 'Мониторинг состояния, алерты, health checks' },
  COORDINATOR:  { id: 'coordinator',  name: 'Координатор',    description: 'Оркестрация, маршрутизация, планирование' },
  SPECIALIST:   { id: 'specialist',   name: 'Специалист',     description: 'Узкая экспертиза: парсинг, NLP, compliance' },
  GUARDIAN:     { id: 'guardian',      name: 'Страж',          description: 'Безопасность, аудит, валидация' },
  ASSISTANT:    { id: 'assistant',     name: 'Ассистент',      description: 'Поддержка пользователя, чат, onboarding' },
};

export const AUTONOMY_LEVELS = {
  AUGMENTATION: { id: 'augmentation', level: 1, name: 'Дополнение',   description: 'Помогает человеку, не действует самостоятельно', governance: 'minimal' },
  AUTOMATION:   { id: 'automation',   level: 2, name: 'Автоматизация', description: 'Выполняет определённые задачи по правилам',     governance: 'standard' },
  SUPERVISED:   { id: 'supervised',   level: 3, name: 'Под надзором',  description: 'Действует автономно, ключевые решения — человек', governance: 'elevated' },
  AUTONOMOUS:   { id: 'autonomous',   level: 4, name: 'Автономный',   description: 'Полная автономия в рамках мандата',              governance: 'strict' },
};

export const CAPABILITIES = {
  // Analytics
  DATA_QUERY:        { id: 'data-query',        domain: 'analytics',    name: 'Запрос данных' },
  DATA_TRANSFORM:    { id: 'data-transform',    domain: 'analytics',    name: 'Трансформация данных' },
  REPORT_GENERATION: { id: 'report-generation', domain: 'analytics',    name: 'Генерация отчётов' },
  SEMANTIC_SEARCH:   { id: 'semantic-search',   domain: 'analytics',    name: 'Семантический поиск' },
  PATTERN_DETECTION: { id: 'pattern-detection', domain: 'analytics',    name: 'Обнаружение паттернов' },

  // Operations
  CRUD_OPERATIONS:   { id: 'crud-operations',   domain: 'operations',   name: 'CRUD-операции' },
  WORKFLOW_EXECUTION:{ id: 'workflow-execution', domain: 'operations',   name: 'Выполнение workflow' },
  FILE_PROCESSING:   { id: 'file-processing',   domain: 'operations',   name: 'Обработка файлов' },
  INTEGRATION:       { id: 'integration',       domain: 'operations',   name: 'Интеграция с внешними системами' },
  SCHEDULING:        { id: 'scheduling',        domain: 'operations',   name: 'Планирование задач' },

  // Development
  CODE_GENERATION:   { id: 'code-generation',   domain: 'development',  name: 'Генерация кода' },
  CODE_REVIEW:       { id: 'code-review',       domain: 'development',  name: 'Code review' },
  TESTING:           { id: 'testing',           domain: 'development',  name: 'Тестирование' },
  DEPLOYMENT:        { id: 'deployment',        domain: 'development',  name: 'Деплой' },
  DEBUG:             { id: 'debug',             domain: 'development',  name: 'Отладка' },

  // Governance
  COMPLIANCE_CHECK:  { id: 'compliance-check',  domain: 'governance',   name: 'Проверка compliance' },
  AUDIT_LOG:         { id: 'audit-log',         domain: 'governance',   name: 'Аудит-лог' },
  ACCESS_CONTROL:    { id: 'access-control',    domain: 'governance',   name: 'Контроль доступа' },
  COST_TRACKING:     { id: 'cost-tracking',     domain: 'governance',   name: 'Учёт затрат' },
  RECEIPT_SIGNING:   { id: 'receipt-signing',    domain: 'governance',   name: 'Подпись расписок' },

  // Knowledge
  ONTOLOGY:          { id: 'ontology',          domain: 'knowledge',    name: 'Работа с онтологиями' },
  KNOWLEDGE_GRAPH:   { id: 'knowledge-graph',   domain: 'knowledge',    name: 'Граф знаний' },
  EMBEDDING:         { id: 'embedding',         domain: 'knowledge',    name: 'Векторные представления' },
  RAG:               { id: 'rag',               domain: 'knowledge',    name: 'RAG (retrieval-augmented)' },
  MEMORY:            { id: 'memory',            domain: 'knowledge',    name: 'Долговременная память' },

  // Communication
  CHAT:              { id: 'chat',              domain: 'communication', name: 'Чат с пользователем' },
  NOTIFICATION:      { id: 'notification',      domain: 'communication', name: 'Уведомления' },
  EMAIL:             { id: 'email',             domain: 'communication', name: 'Email-рассылки' },
  A2A_MESSAGING:     { id: 'a2a-messaging',     domain: 'communication', name: 'Agent-to-Agent обмен' },

  // Infrastructure
  HEALTH_MONITORING: { id: 'health-monitoring', domain: 'infrastructure', name: 'Мониторинг здоровья' },
  SELF_HEALING:      { id: 'self-healing',      domain: 'infrastructure', name: 'Самовосстановление' },
  RESOURCE_MANAGEMENT:{ id: 'resource-mgmt',    domain: 'infrastructure', name: 'Управление ресурсами' },
  MCP_BRIDGE:        { id: 'mcp-bridge',        domain: 'infrastructure', name: 'MCP-мост' },
};

// ─── Pre-built Agent Templates ───────────────────────────────────────────────

export const AGENT_TEMPLATES = {
  'integram-data-agent': {
    name: 'Integram Data Agent',
    domain: 'operations',
    role: 'executor',
    autonomy: 'automation',
    capabilities: ['data-query', 'crud-operations', 'data-transform'],
    description: 'CRUD-операции и запросы к Integram API',
  },
  'kag-knowledge-agent': {
    name: 'KAG Knowledge Agent',
    domain: 'knowledge',
    role: 'analyst',
    autonomy: 'supervised',
    capabilities: ['semantic-search', 'knowledge-graph', 'embedding', 'rag'],
    description: 'Семантический поиск и RAG через Knowledge Augmented Generation',
  },
  'code-review-agent': {
    name: 'Code Review Agent',
    domain: 'development',
    role: 'specialist',
    autonomy: 'augmentation',
    capabilities: ['code-review', 'testing', 'compliance-check'],
    description: 'Автоматический code review и проверка качества',
  },
  'process-orchestrator': {
    name: 'Process Orchestrator',
    domain: 'operations',
    role: 'coordinator',
    autonomy: 'supervised',
    capabilities: ['workflow-execution', 'scheduling', 'a2a-messaging'],
    description: 'Оркестрация бизнес-процессов (BPMN)',
  },
  'audit-guardian': {
    name: 'Audit Guardian',
    domain: 'governance',
    role: 'guardian',
    autonomy: 'autonomous',
    capabilities: ['audit-log', 'compliance-check', 'receipt-signing', 'cost-tracking'],
    description: 'Аудит, compliance, криптографические расписки',
  },
  'health-monitor': {
    name: 'Health Monitor',
    domain: 'infrastructure',
    role: 'monitor',
    autonomy: 'autonomous',
    capabilities: ['health-monitoring', 'self-healing', 'notification'],
    description: 'Мониторинг здоровья системы с автовосстановлением',
  },
  'chat-assistant': {
    name: 'Chat Assistant',
    domain: 'communication',
    role: 'assistant',
    autonomy: 'augmentation',
    capabilities: ['chat', 'semantic-search', 'memory'],
    description: 'Чат-ассистент с доступом к базе знаний',
  },
  'gift-economy-agent': {
    name: 'Gift Economy Agent',
    domain: 'analytics',
    role: 'specialist',
    autonomy: 'supervised',
    capabilities: ['pattern-detection', 'knowledge-graph', 'a2a-messaging'],
    description: 'Аналитика экономики дара — логосы, перихоресис, кеносис',
  },
};

// ─── Taxonomy Service ────────────────────────────────────────────────────────

export class AgentTaxonomy {
  constructor() {
    this.classifications = new Map(); // agentId → classification
  }

  /**
   * Classify an agent
   */
  classify(agentId, { domain, role, autonomy, capabilities = [], template, name, description } = {}) {
    // If template provided, use as base
    let classification;
    if (template && AGENT_TEMPLATES[template]) {
      const tmpl = AGENT_TEMPLATES[template];
      classification = {
        agentId,
        name: name || tmpl.name,
        description: description || tmpl.description,
        domain: domain || tmpl.domain,
        role: role || tmpl.role,
        autonomy: autonomy || tmpl.autonomy,
        capabilities: [...new Set([...(tmpl.capabilities || []), ...capabilities])],
      };
    } else {
      classification = {
        agentId,
        name: name || agentId,
        description: description || '',
        domain: domain || 'operations',
        role: role || 'executor',
        autonomy: autonomy || 'augmentation',
        capabilities,
      };
    }

    // Resolve references
    classification.domainInfo = DOMAINS[classification.domain.toUpperCase()] || { id: classification.domain, name: classification.domain };
    classification.roleInfo = ROLES[classification.role.toUpperCase()] || { id: classification.role, name: classification.role };
    classification.autonomyInfo = AUTONOMY_LEVELS[classification.autonomy.toUpperCase()] || AUTONOMY_LEVELS.AUGMENTATION;
    classification.capabilityInfo = classification.capabilities.map(c => {
      const cap = Object.values(CAPABILITIES).find(v => v.id === c);
      return cap || { id: c, name: c, domain: 'unknown' };
    });

    classification.classifiedAt = new Date().toISOString();
    this.classifications.set(agentId, classification);

    logger.info({ agentId, domain: classification.domain, role: classification.role }, '[Taxonomy] Agent classified');
    return classification;
  }

  /**
   * Get classification
   */
  getClassification(agentId) {
    return this.classifications.get(agentId) || null;
  }

  /**
   * Find agents by criteria
   */
  findAgents({ domain, role, autonomy, capability } = {}) {
    let results = Array.from(this.classifications.values());
    if (domain) results = results.filter(c => c.domain === domain);
    if (role) results = results.filter(c => c.role === role);
    if (autonomy) results = results.filter(c => c.autonomy === autonomy);
    if (capability) results = results.filter(c => c.capabilities.includes(capability));
    return results;
  }

  /**
   * Workforce dashboard data
   */
  getWorkforceDashboard() {
    const all = Array.from(this.classifications.values());
    const byDomain = {};
    const byRole = {};
    const byAutonomy = {};
    const capabilityCoverage = {};

    for (const c of all) {
      byDomain[c.domain] = (byDomain[c.domain] || 0) + 1;
      byRole[c.role] = (byRole[c.role] || 0) + 1;
      byAutonomy[c.autonomy] = (byAutonomy[c.autonomy] || 0) + 1;
      for (const cap of c.capabilities) {
        capabilityCoverage[cap] = (capabilityCoverage[cap] || 0) + 1;
      }
    }

    // Gap analysis: capabilities without agents
    const allCapabilities = Object.values(CAPABILITIES).map(c => c.id);
    const uncoveredCapabilities = allCapabilities.filter(c => !capabilityCoverage[c]);

    return {
      totalAgents: all.length,
      byDomain,
      byRole,
      byAutonomy,
      capabilityCoverage,
      gaps: uncoveredCapabilities,
      agents: all.map(c => ({
        agentId: c.agentId,
        name: c.name,
        domain: c.domain,
        role: c.role,
        autonomy: c.autonomy,
        capabilities: c.capabilities,
      })),
    };
  }

  /**
   * Get governance requirements for an agent based on autonomy level
   */
  getGovernancePolicy(agentId) {
    const c = this.classifications.get(agentId);
    if (!c) return null;

    const level = c.autonomyInfo;
    const policies = {
      augmentation: {
        requiresHumanApproval: true,
        maxActionsPerMinute: 100,
        canCreateData: false,
        canDeleteData: false,
        canAccessExternal: false,
        receiptRequired: false,
        auditLevel: 'basic',
      },
      automation: {
        requiresHumanApproval: false,
        maxActionsPerMinute: 500,
        canCreateData: true,
        canDeleteData: false,
        canAccessExternal: true,
        receiptRequired: true,
        auditLevel: 'standard',
      },
      supervised: {
        requiresHumanApproval: false,
        maxActionsPerMinute: 1000,
        canCreateData: true,
        canDeleteData: true,
        canAccessExternal: true,
        receiptRequired: true,
        auditLevel: 'elevated',
      },
      autonomous: {
        requiresHumanApproval: false,
        maxActionsPerMinute: 5000,
        canCreateData: true,
        canDeleteData: true,
        canAccessExternal: true,
        receiptRequired: true,
        auditLevel: 'strict',
      },
    };

    return {
      agentId,
      autonomy: c.autonomy,
      governance: level.governance,
      policy: policies[c.autonomy] || policies.augmentation,
    };
  }

  /**
   * Available templates
   */
  getTemplates() {
    return Object.entries(AGENT_TEMPLATES).map(([id, tmpl]) => ({ id, ...tmpl }));
  }

  /**
   * Full taxonomy tree for UI
   */
  getTaxonomyTree() {
    return {
      domains: Object.values(DOMAINS),
      roles: Object.values(ROLES),
      autonomyLevels: Object.values(AUTONOMY_LEVELS),
      capabilities: Object.entries(
        Object.values(CAPABILITIES).reduce((acc, cap) => {
          if (!acc[cap.domain]) acc[cap.domain] = [];
          acc[cap.domain].push(cap);
          return acc;
        }, {})
      ).map(([domain, caps]) => ({ domain, capabilities: caps })),
    };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance = null;
export function getAgentTaxonomy() {
  if (!_instance) _instance = new AgentTaxonomy();
  return _instance;
}

export default AgentTaxonomy;

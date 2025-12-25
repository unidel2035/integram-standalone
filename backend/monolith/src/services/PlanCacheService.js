// PlanCacheService.js - Advanced Planning: Plan Templates & Caching System
// Issue #5302: Plan caching and template system for 10x performance improvement

import EventEmitter from 'events';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import { BoundedMap, LRUCache, TTLCache } from '../utils/memoryOptimization.js';

/**
 * Plan Template - Reusable plan structure for common task types
 */
export class PlanTemplate {
  constructor({ id, name, type, description, subtaskTemplate, priority = 5 }) {
    this.id = id || randomUUID();
    this.name = name;
    this.type = type; // Task type this template applies to
    this.description = description;
    this.subtaskTemplate = subtaskTemplate; // Function or array
    this.priority = priority; // Higher priority templates are preferred
    this.createdAt = Date.now();
    this.usageCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.totalExecutionTime = 0;
  }

  /**
   * Instantiate template with actual task data
   */
  instantiate(task) {
    if (typeof this.subtaskTemplate === 'function') {
      return this.subtaskTemplate(task);
    }

    // Clone and customize template
    return JSON.parse(JSON.stringify(this.subtaskTemplate));
  }

  /**
   * Get template success rate
   */
  get successRate() {
    if (this.usageCount === 0) return 0;
    return this.successCount / this.usageCount;
  }

  /**
   * Get average execution time
   */
  get avgExecutionTime() {
    if (this.usageCount === 0) return 0;
    return this.totalExecutionTime / this.usageCount;
  }

  /**
   * Record template usage result
   */
  recordUsage(success, executionTime) {
    this.usageCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    this.totalExecutionTime += executionTime || 0;
  }
}

/**
 * Cosine Similarity Calculator for task comparison
 */
export class SimilarityCalculator {
  /**
   * Calculate cosine similarity between two task vectors
   * @param {Object} task1 - First task
   * @param {Object} task2 - Second task
   * @returns {number} Similarity score [0, 1]
   */
  static cosineSimilarity(task1, task2) {
    const vec1 = this.taskToVector(task1);
    const vec2 = this.taskToVector(task2);

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (mag1 === 0 || mag2 === 0) return 0;

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Convert task to feature vector
   * @private
   */
  static taskToVector(task) {
    const features = [];

    // Task type (one-hot encoding approximation)
    features.push(this.hashString(task.type || 'generic'));

    // Priority (normalized)
    features.push((task.priority || 3) / 10);

    // Complexity estimate
    features.push(this.estimateComplexity(task));

    // Required capabilities count
    const capCount = task.requiredCapabilities?.length || 0;
    features.push(Math.min(capCount / 5, 1));

    // Payload size (normalized)
    const payloadSize = task.payload ? JSON.stringify(task.payload).length : 0;
    features.push(Math.min(payloadSize / 10000, 1));

    // Time features
    const now = new Date();
    features.push(now.getHours() / 24); // Hour of day
    features.push(now.getDay() / 7); // Day of week

    return features;
  }

  /**
   * Simple hash function for strings
   * @private
   */
  static hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return (Math.abs(hash) % 100) / 100; // Normalize to [0, 1]
  }

  /**
   * Estimate task complexity
   * @private
   */
  static estimateComplexity(task) {
    let complexity = 1;

    if (task.requiredCapabilities?.length > 1) {
      complexity += task.requiredCapabilities.length * 0.5;
    }

    if (task.priority > 5) {
      complexity += 1;
    }

    if (task.payload && JSON.stringify(task.payload).length > 1000) {
      complexity += 1;
    }

    return Math.min(complexity / 10, 1);
  }

  /**
   * Find most similar task from history
   */
  static findMostSimilar(task, taskHistory) {
    let maxSimilarity = 0;
    let mostSimilar = null;

    for (const historyEntry of taskHistory) {
      const similarity = this.cosineSimilarity(task, historyEntry.task);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilar = { ...historyEntry, similarity };
      }
    }

    return mostSimilar;
  }
}

/**
 * PlanCacheService - High-performance plan caching and template system
 *
 * Features:
 * - Plan Templates: Reusable plans for common task types
 * - Plan Caching: Cache successful plans with TTL
 * - Similarity Detection: Find and reuse similar plans (cosine similarity)
 * - Incremental Planning: Update plans during execution
 * - Performance Tracking: Success rates and execution times
 */
export class PlanCacheService extends EventEmitter {
  constructor(options = {}) {
    super();

    // Plan Templates Library
    this.planTemplates = new Map(); // taskType -> PlanTemplate[]

    // Execution History (for similarity search)
    this.executionHistory = new BoundedMap(options.maxHistorySize || 10000);

    // Similarity Index (task signature -> cached plan)
    this.similarityIndex = new LRUCache(options.maxSimilarityCache || 5000);

    // Exact Match Cache (taskId hash -> plan)
    this.exactMatchCache = new TTLCache(options.cacheTTL || 3600000); // 1 hour default

    // Incremental plan updates
    this.incrementalPlans = new Map(); // taskId -> { plan, updates[] }

    // Configuration
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.templatePriorityWeight = options.templatePriorityWeight || 0.3;
    this.minTemplateSuccessRate = options.minTemplateSuccessRate || 0.8;

    // Performance metrics
    this.stats = {
      exactMatches: 0,
      similarMatches: 0,
      templateInstantiations: 0,
      newPlans: 0,
      cacheMisses: 0,
      totalGetPlanCalls: 0,
      avgPlanRetrievalTime: 0,
      totalPlanRetrievalTime: 0
    };

    // Initialize default templates
    this._initializeDefaultTemplates();

    logger.info('PlanCacheService initialized', {
      maxHistorySize: options.maxHistorySize || 10000,
      similarityThreshold: this.similarityThreshold,
      cacheTTL: options.cacheTTL || 3600000
    });
  }

  /**
   * Initialize default plan templates for top 10 task types
   * @private
   */
  _initializeDefaultTemplates() {
    // Template 1: Data Processing
    this.registerTemplate(new PlanTemplate({
      name: 'Data Processing Pipeline',
      type: 'data_processing',
      description: 'Standard data processing workflow',
      priority: 8,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'data_validation',
          requiredCapability: 'data_validation',
          description: 'Validate input data',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'data_transformation',
          requiredCapability: 'data_transformation',
          description: 'Transform data',
          dependencies: ['data_validation']
        },
        {
          id: randomUUID(),
          name: 'data_storage',
          requiredCapability: 'data_storage',
          description: 'Store processed data',
          dependencies: ['data_transformation']
        }
      ]
    }));

    // Template 2: API Request
    this.registerTemplate(new PlanTemplate({
      name: 'API Request Handler',
      type: 'api_request',
      description: 'Handle external API requests',
      priority: 9,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'request_validation',
          requiredCapability: 'validation',
          description: 'Validate API request',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'api_call',
          requiredCapability: 'http_client',
          description: 'Execute API call',
          dependencies: ['request_validation']
        },
        {
          id: randomUUID(),
          name: 'response_processing',
          requiredCapability: 'data_processing',
          description: 'Process API response',
          dependencies: ['api_call']
        }
      ]
    }));

    // Template 3: Database Operation
    this.registerTemplate(new PlanTemplate({
      name: 'Database CRUD Operation',
      type: 'database_operation',
      description: 'Standard database CRUD workflow',
      priority: 10,
      subtaskTemplate: (task) => {
        const operation = task.payload?.operation || 'read';
        const subtasks = [];

        if (['create', 'update', 'delete'].includes(operation)) {
          subtasks.push({
            id: randomUUID(),
            name: 'input_validation',
            requiredCapability: 'validation',
            description: 'Validate input',
            dependencies: []
          });
        }

        subtasks.push({
          id: randomUUID(),
          name: `db_${operation}`,
          requiredCapability: 'database',
          description: `Execute ${operation} operation`,
          dependencies: operation !== 'read' ? ['input_validation'] : []
        });

        if (operation === 'read') {
          subtasks.push({
            id: randomUUID(),
            name: 'result_formatting',
            requiredCapability: 'data_processing',
            description: 'Format query results',
            dependencies: [`db_${operation}`]
          });
        }

        return subtasks;
      }
    }));

    // Template 4: Report Generation
    this.registerTemplate(new PlanTemplate({
      name: 'Report Generation',
      type: 'report_generation',
      description: 'Generate formatted reports',
      priority: 7,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'data_collection',
          requiredCapability: 'data_collection',
          description: 'Collect report data',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'data_analysis',
          requiredCapability: 'analytics',
          description: 'Analyze data',
          dependencies: ['data_collection']
        },
        {
          id: randomUUID(),
          name: 'report_formatting',
          requiredCapability: 'document_generation',
          description: 'Format report',
          dependencies: ['data_analysis']
        },
        {
          id: randomUUID(),
          name: 'report_delivery',
          requiredCapability: 'file_delivery',
          description: 'Deliver report',
          dependencies: ['report_formatting']
        }
      ]
    }));

    // Template 5: File Processing
    this.registerTemplate(new PlanTemplate({
      name: 'File Processing',
      type: 'file_processing',
      description: 'Process uploaded files',
      priority: 8,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'file_validation',
          requiredCapability: 'file_validation',
          description: 'Validate file',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'file_parsing',
          requiredCapability: 'file_parsing',
          description: 'Parse file content',
          dependencies: ['file_validation']
        },
        {
          id: randomUUID(),
          name: 'data_extraction',
          requiredCapability: 'data_extraction',
          description: 'Extract data from file',
          dependencies: ['file_parsing']
        },
        {
          id: randomUUID(),
          name: 'result_storage',
          requiredCapability: 'data_storage',
          description: 'Store extracted data',
          dependencies: ['data_extraction']
        }
      ]
    }));

    // Template 6: Notification Workflow
    this.registerTemplate(new PlanTemplate({
      name: 'Notification Workflow',
      type: 'notification',
      description: 'Send notifications to users',
      priority: 6,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'recipient_lookup',
          requiredCapability: 'user_management',
          description: 'Lookup recipients',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'message_templating',
          requiredCapability: 'templating',
          description: 'Generate message from template',
          dependencies: ['recipient_lookup']
        },
        {
          id: randomUUID(),
          name: 'notification_delivery',
          requiredCapability: 'notification_delivery',
          description: 'Deliver notification',
          dependencies: ['message_templating']
        }
      ]
    }));

    // Template 7: Authentication Flow
    this.registerTemplate(new PlanTemplate({
      name: 'Authentication Flow',
      type: 'authentication',
      description: 'User authentication workflow',
      priority: 10,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'credential_validation',
          requiredCapability: 'validation',
          description: 'Validate credentials',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'user_lookup',
          requiredCapability: 'database',
          description: 'Lookup user in database',
          dependencies: ['credential_validation']
        },
        {
          id: randomUUID(),
          name: 'token_generation',
          requiredCapability: 'token_generation',
          description: 'Generate auth token',
          dependencies: ['user_lookup']
        }
      ]
    }));

    // Template 8: Data Aggregation
    this.registerTemplate(new PlanTemplate({
      name: 'Data Aggregation',
      type: 'data_aggregation',
      description: 'Aggregate data from multiple sources',
      priority: 7,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'source_identification',
          requiredCapability: 'data_source_management',
          description: 'Identify data sources',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'parallel_data_fetch',
          requiredCapability: 'data_fetching',
          description: 'Fetch data from sources',
          dependencies: ['source_identification']
        },
        {
          id: randomUUID(),
          name: 'data_merging',
          requiredCapability: 'data_processing',
          description: 'Merge data from sources',
          dependencies: ['parallel_data_fetch']
        },
        {
          id: randomUUID(),
          name: 'aggregation_calculation',
          requiredCapability: 'analytics',
          description: 'Calculate aggregations',
          dependencies: ['data_merging']
        }
      ]
    }));

    // Template 9: Batch Processing
    this.registerTemplate(new PlanTemplate({
      name: 'Batch Processing',
      type: 'batch_processing',
      description: 'Process items in batches',
      priority: 8,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'batch_preparation',
          requiredCapability: 'data_processing',
          description: 'Prepare batches',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'batch_execution',
          requiredCapability: 'batch_processor',
          description: 'Execute batch processing',
          dependencies: ['batch_preparation']
        },
        {
          id: randomUUID(),
          name: 'result_aggregation',
          requiredCapability: 'data_aggregation',
          description: 'Aggregate batch results',
          dependencies: ['batch_execution']
        }
      ]
    }));

    // Template 10: Workflow Orchestration
    this.registerTemplate(new PlanTemplate({
      name: 'Workflow Orchestration',
      type: 'workflow_orchestration',
      description: 'Orchestrate complex multi-step workflows',
      priority: 9,
      subtaskTemplate: (task) => [
        {
          id: randomUUID(),
          name: 'workflow_validation',
          requiredCapability: 'validation',
          description: 'Validate workflow definition',
          dependencies: []
        },
        {
          id: randomUUID(),
          name: 'step_scheduling',
          requiredCapability: 'scheduling',
          description: 'Schedule workflow steps',
          dependencies: ['workflow_validation']
        },
        {
          id: randomUUID(),
          name: 'step_execution',
          requiredCapability: 'task_execution',
          description: 'Execute workflow steps',
          dependencies: ['step_scheduling']
        },
        {
          id: randomUUID(),
          name: 'result_compilation',
          requiredCapability: 'data_processing',
          description: 'Compile workflow results',
          dependencies: ['step_execution']
        }
      ]
    }));

    logger.info('Default plan templates initialized', {
      templateCount: this._countTemplates()
    });
  }

  /**
   * Count total templates
   * @private
   */
  _countTemplates() {
    let count = 0;
    for (const templates of this.planTemplates.values()) {
      count += templates.length;
    }
    return count;
  }

  /**
   * Register a new plan template
   */
  registerTemplate(template) {
    if (!(template instanceof PlanTemplate)) {
      throw new Error('Invalid template: must be instance of PlanTemplate');
    }

    if (!this.planTemplates.has(template.type)) {
      this.planTemplates.set(template.type, []);
    }

    const templates = this.planTemplates.get(template.type);
    templates.push(template);

    // Sort by priority (higher first)
    templates.sort((a, b) => b.priority - a.priority);

    logger.info({ templateId: template.id, type: template.type, name: template.name },
      'Plan template registered');

    this.emit('template:registered', { template });
  }

  /**
   * Get plan for task (main entry point)
   * Implements multi-level caching strategy
   */
  async getPlan(task) {
    const startTime = Date.now();
    this.stats.totalGetPlanCalls++;

    try {
      // Level 1: Exact match cache (fastest - ~5ms)
      const exactMatch = this._findExactMatch(task);
      if (exactMatch) {
        this.stats.exactMatches++;
        this._recordPlanRetrievalTime(Date.now() - startTime);

        logger.debug({ taskId: task.id, method: 'exact_match' }, 'Plan retrieved from exact match cache');

        this.emit('plan:retrieved', {
          task,
          plan: exactMatch,
          method: 'exact_match',
          retrievalTime: Date.now() - startTime
        });

        return this._reusePlan(exactMatch, task);
      }

      // Level 2: Similar task (similarity search - ~10ms)
      const similar = await this._findSimilarTask(task);
      if (similar && similar.similarity >= this.similarityThreshold) {
        this.stats.similarMatches++;
        this._recordPlanRetrievalTime(Date.now() - startTime);

        logger.debug({
          taskId: task.id,
          method: 'similar_task',
          similarity: similar.similarity
        }, 'Plan adapted from similar task');

        const adaptedPlan = this._adaptPlan(similar.plan, task);

        this.emit('plan:retrieved', {
          task,
          plan: adaptedPlan,
          method: 'similar_task',
          similarity: similar.similarity,
          retrievalTime: Date.now() - startTime
        });

        // Cache the adapted plan for future exact matches
        await this.cachePlan(task, adaptedPlan);

        return adaptedPlan;
      }

      // Level 3: Template instantiation (~15ms)
      const template = this._findBestTemplate(task);
      if (template) {
        const plan = this._instantiateTemplate(template, task);
        this.stats.templateInstantiations++;
        this._recordPlanRetrievalTime(Date.now() - startTime);

        logger.debug({
          taskId: task.id,
          method: 'template',
          templateId: template.id
        }, 'Plan instantiated from template');

        this.emit('plan:retrieved', {
          task,
          plan,
          method: 'template',
          templateId: template.id,
          retrievalTime: Date.now() - startTime
        });

        // Cache the instantiated plan for future exact matches
        await this.cachePlan(task, plan);

        return plan;
      }

      // Level 4: Create new plan (slow path - ~100ms)
      this.stats.newPlans++;
      this.stats.cacheMisses++;

      const newPlan = await this._createNewPlan(task);
      this._recordPlanRetrievalTime(Date.now() - startTime);

      logger.info({
        taskId: task.id,
        method: 'new_plan',
        retrievalTime: Date.now() - startTime
      }, 'New plan created');

      this.emit('plan:created', {
        task,
        plan: newPlan,
        retrievalTime: Date.now() - startTime
      });

      // Cache the new plan
      await this.cachePlan(task, newPlan);

      return newPlan;

    } catch (error) {
      logger.error({ error, taskId: task.id }, 'Failed to get plan');
      throw error;
    }
  }

  /**
   * Find exact match in cache
   * @private
   */
  _findExactMatch(task) {
    const cacheKey = this._generateCacheKey(task);
    const cached = this.exactMatchCache.get(cacheKey);

    if (cached && cached.successRate > this.minTemplateSuccessRate) {
      return cached;
    }

    return null;
  }

  /**
   * Find similar task in history
   * @private
   */
  async _findSimilarTask(task) {
    const historyArray = Array.from(this.executionHistory.values());

    if (historyArray.length === 0) {
      return null;
    }

    const mostSimilar = SimilarityCalculator.findMostSimilar(task, historyArray);

    if (mostSimilar && mostSimilar.plan) {
      return mostSimilar;
    }

    return null;
  }

  /**
   * Find best template for task type
   * @private
   */
  _findBestTemplate(task) {
    const templates = this.planTemplates.get(task.type);

    if (!templates || templates.length === 0) {
      return null;
    }

    // Find template with best success rate above threshold
    for (const template of templates) {
      if (template.usageCount === 0 || template.successRate >= this.minTemplateSuccessRate) {
        return template;
      }
    }

    // If no template meets threshold, return highest priority
    return templates[0];
  }

  /**
   * Instantiate template
   * @private
   */
  _instantiateTemplate(template, task) {
    const subtasks = template.instantiate(task);

    const plan = {
      id: randomUUID(),
      taskId: task.id,
      subtasks,
      templateId: template.id,
      createdAt: Date.now(),
      method: 'template'
    };

    return plan;
  }

  /**
   * Reuse existing plan for new task
   * @private
   */
  _reusePlan(cachedPlan, task) {
    // Clone plan with new IDs
    const plan = JSON.parse(JSON.stringify(cachedPlan));
    plan.id = randomUUID();
    plan.taskId = task.id;
    plan.method = 'reuse';
    plan.sourceTaskId = cachedPlan.taskId;

    return plan;
  }

  /**
   * Adapt plan from similar task
   * @private
   */
  _adaptPlan(similarPlan, task) {
    // Clone and adapt plan
    const plan = JSON.parse(JSON.stringify(similarPlan));
    plan.id = randomUUID();
    plan.taskId = task.id;
    plan.method = 'adapted';
    plan.sourcePlanId = similarPlan.id;

    // Customize subtasks based on task differences
    // This is a simple implementation - could be enhanced
    plan.subtasks = plan.subtasks.map(st => ({
      ...st,
      id: randomUUID()
    }));

    return plan;
  }

  /**
   * Create new plan (slow path - delegates to TaskDecomposer)
   * @private
   */
  async _createNewPlan(task) {
    // This is a placeholder - in real implementation, this would
    // delegate to CoordinationEngine's task decomposer

    // For now, create a simple default plan
    const plan = {
      id: randomUUID(),
      taskId: task.id,
      subtasks: [
        {
          id: randomUUID(),
          name: 'execute_task',
          requiredCapability: task.requiredCapabilities?.[0] || 'generic',
          description: `Execute ${task.type || 'generic'} task`,
          dependencies: []
        }
      ],
      createdAt: Date.now(),
      method: 'new'
    };

    return plan;
  }

  /**
   * Cache a plan
   */
  async cachePlan(task, plan, result = null) {
    try {
      // Generate cache key
      const cacheKey = this._generateCacheKey(task);

      // Add metadata
      const cachedPlan = {
        ...plan,
        task: {
          id: task.id,
          type: task.type,
          priority: task.priority,
          requiredCapabilities: task.requiredCapabilities
        },
        usageCount: 1,
        successCount: result?.success ? 1 : 0,
        failureCount: result?.success === false ? 1 : 0,
        totalExecutionTime: result?.executionTime || 0,
        lastUsed: Date.now()
      };

      // Cache in exact match cache
      this.exactMatchCache.set(cacheKey, cachedPlan);

      // Add to execution history
      this.executionHistory.set(task.id, {
        task,
        plan: cachedPlan,
        result,
        timestamp: Date.now()
      });

      // Update template stats if plan came from template
      if (plan.templateId) {
        const template = this._findTemplateById(plan.templateId);
        if (template && result) {
          template.recordUsage(result.success, result.executionTime);
        }
      }

      logger.debug({ taskId: task.id, cacheKey }, 'Plan cached');

      this.emit('plan:cached', { task, plan: cachedPlan });

    } catch (error) {
      logger.error({ error, taskId: task.id }, 'Failed to cache plan');
    }
  }

  /**
   * Update plan incrementally during execution
   */
  updatePlan(taskId, updates) {
    if (!this.incrementalPlans.has(taskId)) {
      logger.warn({ taskId }, 'Cannot update plan: task not found');
      return false;
    }

    const entry = this.incrementalPlans.get(taskId);
    entry.updates.push({
      timestamp: Date.now(),
      updates
    });

    // Apply updates to plan
    Object.assign(entry.plan, updates);

    logger.debug({ taskId, updateCount: entry.updates.length }, 'Plan updated incrementally');

    this.emit('plan:updated', { taskId, updates });

    return true;
  }

  /**
   * Record plan execution result
   */
  recordPlanResult(taskId, result) {
    const historyEntry = this.executionHistory.get(taskId);

    if (historyEntry && historyEntry.plan) {
      historyEntry.plan.successCount = (historyEntry.plan.successCount || 0) + (result.success ? 1 : 0);
      historyEntry.plan.failureCount = (historyEntry.plan.failureCount || 0) + (result.success ? 0 : 1);
      historyEntry.plan.totalExecutionTime = (historyEntry.plan.totalExecutionTime || 0) + (result.executionTime || 0);
      historyEntry.plan.usageCount = (historyEntry.plan.usageCount || 0) + 1;
      historyEntry.result = result;
    }

    logger.debug({ taskId, success: result.success }, 'Plan result recorded');

    this.emit('plan:result_recorded', { taskId, result });
  }

  /**
   * Generate cache key for task
   * @private
   */
  _generateCacheKey(task) {
    const keyData = {
      type: task.type,
      requiredCapabilities: (task.requiredCapabilities || []).sort(),
      // Add more fields as needed for exact matching
    };

    return JSON.stringify(keyData);
  }

  /**
   * Find template by ID
   * @private
   */
  _findTemplateById(templateId) {
    for (const templates of this.planTemplates.values()) {
      const template = templates.find(t => t.id === templateId);
      if (template) return template;
    }
    return null;
  }

  /**
   * Record plan retrieval time for metrics
   * @private
   */
  _recordPlanRetrievalTime(timeMs) {
    this.stats.totalPlanRetrievalTime += timeMs;
    this.stats.avgPlanRetrievalTime =
      this.stats.totalPlanRetrievalTime / this.stats.totalGetPlanCalls;

    // Record metric
    metrics.recordHistogram('plan_cache.retrieval_time_ms', timeMs);
  }

  /**
   * Get service statistics
   */
  getStats() {
    const hitRate = this.stats.totalGetPlanCalls > 0
      ? ((this.stats.exactMatches + this.stats.similarMatches + this.stats.templateInstantiations) /
         this.stats.totalGetPlanCalls) * 100
      : 0;

    return {
      ...this.stats,
      cacheHitRate: hitRate,
      cacheMissRate: 100 - hitRate,
      totalTemplates: this._countTemplates(),
      historySize: this.executionHistory.size(),
      performanceGain: this._calculatePerformanceGain()
    };
  }

  /**
   * Calculate performance gain from caching
   * @private
   */
  _calculatePerformanceGain() {
    if (this.stats.totalGetPlanCalls === 0) return 0;

    // Estimated times
    const newPlanTime = 100; // ms
    const cachedPlanTime = 10; // ms (average of exact/similar/template)

    const savedTime = (this.stats.exactMatches * 5 + // exact: 5ms saved (100 - 5)
                       this.stats.similarMatches * 10 + // similar: 10ms saved (100 - 10)
                       this.stats.templateInstantiations * 15); // template: 15ms saved (100 - 15)

    const totalTimeWithoutCache = this.stats.totalGetPlanCalls * newPlanTime;
    const actualTime = this.stats.totalPlanRetrievalTime;

    return ((totalTimeWithoutCache - actualTime) / totalTimeWithoutCache) * 100;
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.exactMatchCache.clear();
    this.similarityIndex.clear();
    this.executionHistory.clear();
    this.incrementalPlans.clear();

    logger.info('Plan caches cleared');
    this.emit('caches:cleared');
  }

  /**
   * Export statistics for analysis
   */
  exportStats() {
    const templates = [];
    for (const [type, typeTemplates] of this.planTemplates.entries()) {
      templates.push(...typeTemplates.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        priority: t.priority,
        usageCount: t.usageCount,
        successRate: t.successRate,
        avgExecutionTime: t.avgExecutionTime
      })));
    }

    return {
      stats: this.getStats(),
      templates,
      historySize: this.executionHistory.size()
    };
  }

  /**
   * Shutdown service
   */
  shutdown() {
    logger.info('Shutting down PlanCacheService');

    this.clearCaches();
    this.removeAllListeners();

    logger.info('PlanCacheService shutdown complete');
  }
}

export default PlanCacheService;

// MLTaskRouter.js - ML-based intelligent task routing system
import EventEmitter from 'events';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';

/**
 * AgentPerformanceTracker - Tracks and analyzes agent performance metrics
 *
 * Responsibilities:
 * - Record task execution results per agent
 * - Calculate success rates and execution time averages
 * - Track performance by task type
 * - Calculate specialization scores
 */
export class AgentPerformanceTracker {
  constructor() {
    this.performance = new Map(); // agentId -> PerformanceData

    logger.info('AgentPerformanceTracker initialized');
  }

  /**
   * Get or create performance data for an agent
   * @private
   */
  getOrCreatePerformance(agentId) {
    if (!this.performance.has(agentId)) {
      this.performance.set(agentId, {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        totalExecutionTime: 0,
        currentLoad: 0,
        byType: {}, // taskType -> { total, successful, totalTime }
        recentResults: [], // Sliding window for recent performance
        maxRecentResults: 100
      });
    }
    return this.performance.get(agentId);
  }

  /**
   * Record a task result for an agent
   */
  recordTaskResult(agentId, taskId, result) {
    const perf = this.getOrCreatePerformance(agentId);

    perf.totalTasks++;

    if (result.success) {
      perf.successfulTasks++;
    } else {
      perf.failedTasks++;
    }

    const executionTime = result.executionTime || 0;
    perf.totalExecutionTime += executionTime;

    // Track by task type
    const taskType = result.taskType || 'generic';
    if (!perf.byType[taskType]) {
      perf.byType[taskType] = {
        total: 0,
        successful: 0,
        totalTime: 0,
        avgTime: 0
      };
    }

    perf.byType[taskType].total++;
    if (result.success) {
      perf.byType[taskType].successful++;
    }
    perf.byType[taskType].totalTime += executionTime;
    perf.byType[taskType].avgTime = perf.byType[taskType].totalTime / perf.byType[taskType].total;

    // Add to recent results (sliding window)
    perf.recentResults.push({
      taskId,
      success: result.success,
      executionTime,
      taskType,
      timestamp: Date.now()
    });

    // Keep only recent results
    if (perf.recentResults.length > perf.maxRecentResults) {
      perf.recentResults.shift();
    }

    // Update moving averages
    this.updateMovingAverages(perf, result);

    logger.debug({ agentId, taskId, success: result.success }, 'Task result recorded');
  }

  /**
   * Update moving averages based on recent results
   * @private
   */
  updateMovingAverages(perf, result) {
    // Calculate weighted average with more weight on recent results
    if (perf.recentResults.length > 0) {
      const recentWindow = perf.recentResults.slice(-20); // Last 20 tasks
      const recentSuccesses = recentWindow.filter(r => r.success).length;
      perf.recentSuccessRate = recentSuccesses / recentWindow.length;

      const recentTotalTime = recentWindow.reduce((sum, r) => sum + r.executionTime, 0);
      perf.recentAvgExecutionTime = recentTotalTime / recentWindow.length;
    }
  }

  /**
   * Update current load for an agent
   */
  updateCurrentLoad(agentId, load) {
    const perf = this.getOrCreatePerformance(agentId);
    perf.currentLoad = load;
  }

  /**
   * Get agent performance metrics
   */
  getAgentPerformance(agentId) {
    const perf = this.performance.get(agentId);

    if (!perf || perf.totalTasks === 0) {
      return this.getDefaultPerformance();
    }

    return {
      successRate: perf.successfulTasks / perf.totalTasks,
      avgExecutionTime: perf.totalExecutionTime / perf.totalTasks,
      currentLoad: perf.currentLoad,
      specializationScore: this.calculateSpecializationScore(perf),
      recentSuccessRate: perf.recentSuccessRate || (perf.successfulTasks / perf.totalTasks),
      recentAvgExecutionTime: perf.recentAvgExecutionTime || (perf.totalExecutionTime / perf.totalTasks),
      totalTasks: perf.totalTasks,
      taskTypeStats: perf.byType
    };
  }

  /**
   * Get default performance for new agents
   * @private
   */
  getDefaultPerformance() {
    return {
      successRate: 0.5, // Neutral assumption
      avgExecutionTime: 5000, // 5 seconds default
      currentLoad: 0,
      specializationScore: 0,
      recentSuccessRate: 0.5,
      recentAvgExecutionTime: 5000,
      totalTasks: 0,
      taskTypeStats: {}
    };
  }

  /**
   * Calculate specialization score for an agent
   * Higher score means agent excels at certain task types (more specialized)
   * @private
   */
  calculateSpecializationScore(perf) {
    const types = Object.values(perf.byType);

    if (types.length < 2) {
      return 0; // Not enough data to determine specialization
    }

    // Calculate variance in success rates across task types
    const successRates = types
      .filter(t => t.total > 0)
      .map(t => t.successful / t.total);

    if (successRates.length === 0) {
      return 0;
    }

    const mean = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const variance = successRates.reduce((sum, rate) =>
      sum + Math.pow(rate - mean, 2), 0
    ) / successRates.length;

    return variance * 100; // Scale to 0-100 range
  }

  /**
   * Get performance metrics for a specific task type
   */
  getPerformanceForTaskType(agentId, taskType) {
    const perf = this.performance.get(agentId);

    if (!perf || !perf.byType[taskType]) {
      return null;
    }

    const typeStats = perf.byType[taskType];
    return {
      successRate: typeStats.successful / typeStats.total,
      avgExecutionTime: typeStats.avgTime,
      totalTasks: typeStats.total
    };
  }

  /**
   * Get all performance data (for debugging/monitoring)
   */
  getAllPerformance() {
    const result = {};
    for (const [agentId, perf] of this.performance) {
      result[agentId] = this.getAgentPerformance(agentId);
    }
    return result;
  }

  /**
   * Reset performance data for an agent
   */
  resetAgentPerformance(agentId) {
    this.performance.delete(agentId);
    logger.info({ agentId }, 'Agent performance data reset');
  }

  /**
   * Clear all performance data
   */
  clearAll() {
    this.performance.clear();
    logger.info('All performance data cleared');
  }
}

/**
 * SimpleTaskRoutingModel - Simple linear model for task routing predictions
 *
 * Uses weighted scoring based on:
 * - Success rate (40%)
 * - Execution time (30%)
 * - Current load (20%)
 * - Specialization (10%)
 */
export class SimpleTaskRoutingModel {
  constructor(options = {}) {
    // Default weights
    this.weights = options.weights || {
      successRate: 0.4,
      avgExecutionTime: 0.3,
      currentLoad: 0.2,
      specializationScore: 0.1
    };

    // Normalization parameters (for execution time)
    this.maxExpectedExecutionTime = options.maxExpectedExecutionTime || 30000; // 30 seconds

    logger.info('SimpleTaskRoutingModel initialized', { weights: this.weights });
  }

  /**
   * Predict performance score for agent-task combination
   */
  async predict(features) {
    // Normalize features
    const normalized = this.normalize(features);

    // Weighted sum (higher score = better match)
    const score =
      normalized.successRate * this.weights.successRate +
      (1 - normalized.avgExecutionTime) * this.weights.avgExecutionTime + // Lower time is better
      (1 - normalized.currentLoad) * this.weights.currentLoad + // Lower load is better
      normalized.specializationScore * this.weights.specializationScore;

    return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
  }

  /**
   * Normalize feature values to [0, 1] range
   * @private
   */
  normalize(features) {
    return {
      successRate: Math.max(0, Math.min(1, features.successRate || 0.5)),
      avgExecutionTime: Math.min(
        (features.avgExecutionTime || 5000) / this.maxExpectedExecutionTime,
        1
      ),
      currentLoad: Math.max(0, Math.min(1, features.currentLoad || 0)),
      specializationScore: Math.min((features.specializationScore || 0) / 100, 1)
    };
  }

  /**
   * Update model weights based on training data
   * Simple gradient descent implementation
   */
  async retrain(trainingData) {
    if (!trainingData || trainingData.length === 0) {
      logger.warn('No training data provided for retraining');
      return;
    }

    // Simple learning rate
    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      let totalError = 0;

      for (const sample of trainingData) {
        const predicted = await this.predict(sample.features);
        const actual = sample.actualScore;
        const error = actual - predicted;

        totalError += Math.abs(error);

        // Update weights proportionally to error
        const normalized = this.normalize(sample.features);

        this.weights.successRate += learningRate * error * normalized.successRate;
        this.weights.avgExecutionTime += learningRate * error * (1 - normalized.avgExecutionTime);
        this.weights.currentLoad += learningRate * error * (1 - normalized.currentLoad);
        this.weights.specializationScore += learningRate * error * normalized.specializationScore;
      }

      // Normalize weights to sum to 1
      const weightSum = Object.values(this.weights).reduce((a, b) => a + b, 0);
      for (const key in this.weights) {
        this.weights[key] /= weightSum;
      }

      if (iter % 20 === 0) {
        logger.debug({ iteration: iter, avgError: totalError / trainingData.length }, 'Retraining progress');
      }
    }

    logger.info({ weights: this.weights }, 'Model retrained successfully');
  }

  /**
   * Get current model weights
   */
  getWeights() {
    return { ...this.weights };
  }

  /**
   * Set model weights
   */
  setWeights(weights) {
    this.weights = { ...weights };
    logger.info({ weights: this.weights }, 'Model weights updated');
  }
}

/**
 * MLTaskRouter - ML-based intelligent task routing system
 *
 * Features:
 * - Tracks agent performance history
 * - Uses ML model to predict best agent for each task
 * - Supports continuous learning from results
 * - Falls back to simple strategies if ML unavailable
 */
export class MLTaskRouter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.agentManager = options.agentManager;
    if (!this.agentManager) {
      throw new Error('agentManager is required');
    }

    this.performanceTracker = options.performanceTracker || new AgentPerformanceTracker();
    this.model = options.model || new SimpleTaskRoutingModel();
    this.fallbackStrategy = options.fallbackStrategy || 'least-loaded';

    // Learning configuration
    this.enableLearning = options.enableLearning !== false; // Default: true
    this.retrainThreshold = options.retrainThreshold || 100; // Retrain after N tasks
    this.tasksSinceRetrain = 0;
    this.trainingData = [];
    this.maxTrainingDataSize = options.maxTrainingDataSize || 1000;

    // Prediction tracking for learning
    this.predictions = new Map(); // taskId -> { agentId, features, timestamp }

    // A/B testing configuration
    this.abTestingEnabled = options.abTestingEnabled || false;
    this.mlRoutingProbability = options.mlRoutingProbability || 0.5;

    // Set up event listeners
    this._setupEventListeners();

    logger.info('MLTaskRouter initialized', {
      fallbackStrategy: this.fallbackStrategy,
      enableLearning: this.enableLearning,
      retrainThreshold: this.retrainThreshold,
      abTestingEnabled: this.abTestingEnabled
    });
  }

  /**
   * Set up event listeners for learning from results
   * @private
   */
  _setupEventListeners() {
    // Listen to task completion events from AgentManager
    this.agentManager.on('task:completed', ({ task, agent, result }) => {
      this._handleTaskCompleted(task, agent, result, true);
    });

    this.agentManager.on('task:failed', ({ task, agent, error }) => {
      this._handleTaskCompleted(task, agent, { error }, false);
    });
  }

  /**
   * Route a task to the best agent using ML
   */
  async route(task) {
    try {
      // A/B testing: randomly use ML or fallback
      if (this.abTestingEnabled && Math.random() > this.mlRoutingProbability) {
        logger.debug({ taskId: task.id }, 'Using fallback strategy for A/B testing');
        return await this.fallbackRoute(task);
      }

      // Extract task features
      const features = this.extractTaskFeatures(task);

      // Get candidate agents
      const candidates = this.agentManager.findCapableAgents(task);

      if (candidates.length === 0) {
        throw new Error('No capable agents found');
      }

      // Use ML model to rank agents
      const rankedAgents = await this.rankAgents(candidates, features, task);

      // Select best agent
      const selectedAgent = rankedAgents[0];

      // Track prediction for learning
      this.trackPrediction(task.id, selectedAgent.id, features);

      logger.info({
        taskId: task.id,
        agentId: selectedAgent.id,
        score: rankedAgents[0].score
      }, 'Task routed using ML');

      metrics.increment('mlRouter.routingSuccess');
      this.emit('routing:success', { task, agent: selectedAgent });

      return selectedAgent;
    } catch (error) {
      logger.error({ taskId: task.id, error: error.message }, 'ML routing failed, using fallback');
      metrics.increment('mlRouter.routingFallback');
      return await this.fallbackRoute(task);
    }
  }

  /**
   * Extract features from task for ML model
   * @private
   */
  extractTaskFeatures(task) {
    return {
      type: task.type,
      priority: task.priority || 3,
      complexity: this.estimateComplexity(task),
      dataSize: task.payload?.dataSize || 0,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      requiredCapabilities: task.requiredCapabilities || []
    };
  }

  /**
   * Estimate task complexity (simple heuristic)
   * @private
   */
  estimateComplexity(task) {
    let complexity = 1;

    // More capabilities = more complex
    if (task.requiredCapabilities && task.requiredCapabilities.length > 1) {
      complexity += task.requiredCapabilities.length * 0.5;
    }

    // Higher priority might indicate complexity
    if (task.priority > 5) {
      complexity += 1;
    }

    // Large payload = more complex
    if (task.payload && JSON.stringify(task.payload).length > 1000) {
      complexity += 1;
    }

    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Rank agents by predicted performance
   * @private
   */
  async rankAgents(candidates, taskFeatures, task) {
    const scores = [];

    for (const agent of candidates) {
      const agentFeatures = this.getAgentFeatures(agent.id, task.type);

      // Combine task and agent features
      const combinedFeatures = {
        ...agentFeatures,
        taskComplexity: taskFeatures.complexity,
        taskPriority: taskFeatures.priority
      };

      // Predict performance score
      const score = await this.model.predict(combinedFeatures);

      scores.push({
        agent,
        score,
        features: combinedFeatures
      });
    }

    // Sort by score descending (higher is better)
    scores.sort((a, b) => b.score - a.score);

    logger.debug({
      taskId: task.id,
      rankings: scores.map(s => ({ agentId: s.agent.id, score: s.score }))
    }, 'Agents ranked');

    return scores.map(s => ({ ...s.agent, score: s.score }));
  }

  /**
   * Get agent features for ML model
   * @private
   */
  getAgentFeatures(agentId, taskType) {
    const perf = this.performanceTracker.getAgentPerformance(agentId);

    // Check if agent has specific performance data for this task type
    const typePerf = this.performanceTracker.getPerformanceForTaskType(agentId, taskType);

    return {
      successRate: typePerf?.successRate || perf.successRate,
      avgExecutionTime: typePerf?.avgExecutionTime || perf.avgExecutionTime,
      currentLoad: perf.currentLoad,
      specializationScore: perf.specializationScore,
      recentSuccessRate: perf.recentSuccessRate,
      totalTasks: perf.totalTasks
    };
  }

  /**
   * Track prediction for later learning
   * @private
   */
  trackPrediction(taskId, agentId, features) {
    this.predictions.set(taskId, {
      agentId,
      features,
      timestamp: Date.now()
    });

    this.emit('prediction:made', { taskId, agentId, features });
  }

  /**
   * Handle task completion for learning
   * @private
   */
  _handleTaskCompleted(task, agent, result, success) {
    const executionTime = task.completedAt && task.startedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : 0;

    // Record result in performance tracker
    this.performanceTracker.recordTaskResult(agent.id, task.id, {
      success,
      executionTime,
      taskType: task.type,
      result
    });

    // Update agent's current load
    const currentTaskCount = this.agentManager.agentTaskCounts.get(agent.id) || 0;
    const maxTasks = this.agentManager.maxConcurrentTasksPerAgent || 1;
    this.performanceTracker.updateCurrentLoad(agent.id, currentTaskCount / maxTasks);

    // Learn from prediction if we made one
    if (this.enableLearning && this.predictions.has(task.id)) {
      this._learnFromResult(task, agent, result, success);
    }

    // Periodic retraining
    if (this.enableLearning && this.shouldRetrain()) {
      this._retrainModel().catch(error => {
        logger.error({ error: error.message }, 'Model retraining failed');
      });
    }
  }

  /**
   * Learn from task result
   * @private
   */
  _learnFromResult(task, agent, result, success) {
    const prediction = this.predictions.get(task.id);

    if (!prediction) {
      return;
    }

    // Calculate actual performance score
    const executionTime = task.completedAt && task.startedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : 0;

    // Score: 1.0 for perfect success with fast execution, 0.0 for failure
    let actualScore = success ? 0.5 : 0.0;

    if (success && executionTime > 0) {
      // Bonus for fast execution (up to 0.5 additional points)
      const timeBonus = Math.max(0, 0.5 - (executionTime / 60000)); // 1 minute = 0 bonus
      actualScore += timeBonus;
    }

    // Add to training data
    this.trainingData.push({
      features: prediction.features,
      actualScore,
      success,
      executionTime
    });

    // Limit training data size
    if (this.trainingData.length > this.maxTrainingDataSize) {
      this.trainingData.shift();
    }

    this.tasksSinceRetrain++;
    this.predictions.delete(task.id);

    logger.debug({
      taskId: task.id,
      agentId: agent.id,
      actualScore,
      trainingDataSize: this.trainingData.length
    }, 'Learning from result');
  }

  /**
   * Check if model should be retrained
   * @private
   */
  shouldRetrain() {
    return this.tasksSinceRetrain >= this.retrainThreshold &&
           this.trainingData.length >= 20; // Minimum data for retraining
  }

  /**
   * Retrain the ML model
   * @private
   */
  async _retrainModel() {
    logger.info({
      trainingDataSize: this.trainingData.length,
      tasksSinceRetrain: this.tasksSinceRetrain
    }, 'Retraining model...');

    try {
      await this.model.retrain(this.trainingData);

      this.tasksSinceRetrain = 0;

      logger.info('Model retrained successfully');
      this.emit('model:retrained', {
        dataSize: this.trainingData.length,
        weights: this.model.getWeights()
      });

      metrics.increment('mlRouter.retraining');
    } catch (error) {
      logger.error({ error: error.message }, 'Model retraining failed');
      throw error;
    }
  }

  /**
   * Fallback to simple routing strategy
   * @private
   */
  async fallbackRoute(task) {
    logger.debug({ taskId: task.id, strategy: this.fallbackStrategy }, 'Using fallback routing');

    const capableAgents = this.agentManager.findCapableAgents(task);

    if (capableAgents.length === 0) {
      throw new Error('No capable agents found for task');
    }

    const selectedAgent = this.agentManager.selectAgent(capableAgents, task);

    if (!selectedAgent) {
      throw new Error('Failed to select agent');
    }

    return selectedAgent;
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      performanceTracking: {
        agentsTracked: this.performanceTracker.performance.size,
        allPerformance: this.performanceTracker.getAllPerformance()
      },
      learning: {
        enabled: this.enableLearning,
        trainingDataSize: this.trainingData.length,
        tasksSinceRetrain: this.tasksSinceRetrain,
        retrainThreshold: this.retrainThreshold
      },
      model: {
        weights: this.model.getWeights()
      },
      abTesting: {
        enabled: this.abTestingEnabled,
        mlProbability: this.mlRoutingProbability
      },
      predictions: {
        pending: this.predictions.size
      }
    };
  }

  /**
   * Enable/disable A/B testing
   */
  setABTesting(enabled, mlProbability = 0.5) {
    this.abTestingEnabled = enabled;
    this.mlRoutingProbability = mlProbability;

    logger.info({ enabled, mlProbability }, 'A/B testing configuration updated');
  }

  /**
   * Manually trigger model retraining
   */
  async manualRetrain() {
    if (this.trainingData.length === 0) {
      throw new Error('No training data available');
    }

    await this._retrainModel();
  }

  /**
   * Reset all learning data
   */
  resetLearning() {
    this.trainingData = [];
    this.tasksSinceRetrain = 0;
    this.predictions.clear();
    this.performanceTracker.clearAll();

    logger.info('Learning data reset');
    this.emit('learning:reset');
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData() {
    return {
      agentPerformance: this.performanceTracker.getAllPerformance(),
      trainingData: this.trainingData,
      modelWeights: this.model.getWeights(),
      stats: this.getStats()
    };
  }

  /**
   * Shutdown the router
   */
  shutdown() {
    logger.info('Shutting down MLTaskRouter');

    this.predictions.clear();
    this.trainingData = [];

    // Remove event listeners
    this.agentManager.removeAllListeners('task:completed');
    this.agentManager.removeAllListeners('task:failed');
  }
}

export default MLTaskRouter;

// ResourcePredictor.js - Predicts resource requirements for tasks
// Part of Smart Resource Management system (Issue #5304)

import logger from '../utils/logger.js';

/**
 * ResourcePredictor estimates resource requirements for tasks
 *
 * Predicts:
 * - CPU usage
 * - Memory usage
 * - LLM token count
 * - I/O requirements
 * - Estimated execution time
 */
export class ResourcePredictor {
  constructor(options = {}) {
    // Historical data for predictions
    this.taskHistory = new Map(); // taskType -> Array<ExecutionData>
    this.maxHistorySize = options.maxHistorySize || 100;

    // Default resource estimates (fallback when no history)
    this.defaults = {
      cpu: 0.5, // 50% CPU
      memory: 100 * 1024 * 1024, // 100 MB
      tokens: 1000, // 1k tokens
      io: 'low', // low, medium, high
      executionTime: 5000 // 5 seconds
    };

    // Token estimation parameters
    this.tokensPerCharacter = options.tokensPerCharacter || 0.25; // ~4 chars per token
    this.baseTokenOverhead = options.baseTokenOverhead || 100; // Base overhead

    logger.info('ResourcePredictor initialized', {
      maxHistorySize: this.maxHistorySize,
      defaults: this.defaults
    });
  }

  /**
   * Predict resource requirements for a task
   * @param {Object} task - Task to predict resources for
   * @returns {Object} Predicted resource requirements
   */
  predict(task) {
    const taskType = task.type || 'generic';
    const history = this.taskHistory.get(taskType);

    // Use historical data if available
    if (history && history.length > 0) {
      return this._predictFromHistory(task, history);
    }

    // Fallback to heuristic prediction
    return this._predictHeuristic(task);
  }

  /**
   * Predict based on historical execution data
   * @private
   */
  _predictFromHistory(task, history) {
    // Use recent history (last 20 executions)
    const recentHistory = history.slice(-20);

    // Calculate averages
    const avgCpu = this._average(recentHistory.map(h => h.cpu));
    const avgMemory = this._average(recentHistory.map(h => h.memory));
    const avgTokens = this._average(recentHistory.map(h => h.tokens));
    const avgExecutionTime = this._average(recentHistory.map(h => h.executionTime));

    // Adjust based on task complexity
    const complexityFactor = this._estimateComplexityFactor(task);

    return {
      cpu: Math.min(1.0, avgCpu * complexityFactor),
      memory: Math.floor(avgMemory * complexityFactor),
      tokens: Math.floor(avgTokens * complexityFactor),
      io: this._estimateIOLevel(task),
      executionTime: Math.floor(avgExecutionTime * complexityFactor),
      confidence: Math.min(recentHistory.length / 20, 1.0) // 0-1 based on data availability
    };
  }

  /**
   * Predict using heuristics when no history available
   * @private
   */
  _predictHeuristic(task) {
    const complexity = this._estimateComplexityFactor(task);

    // Estimate tokens from payload
    const estimatedTokens = this._estimateTokens(task);

    // CPU and memory scale with token count
    const tokenFactor = Math.min(estimatedTokens / 1000, 10); // Cap at 10x

    return {
      cpu: Math.min(this.defaults.cpu * complexity * tokenFactor, 1.0),
      memory: Math.floor(this.defaults.memory * complexity * tokenFactor),
      tokens: estimatedTokens,
      io: this._estimateIOLevel(task),
      executionTime: Math.floor(this.defaults.executionTime * complexity * tokenFactor),
      confidence: 0.3 // Low confidence without history
    };
  }

  /**
   * Estimate complexity factor for task
   * @private
   */
  _estimateComplexityFactor(task) {
    let factor = 1.0;

    // More capabilities = more complex
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      factor += task.requiredCapabilities.length * 0.2;
    }

    // Priority might indicate complexity
    if (task.priority) {
      if (task.priority >= 8) factor += 0.5; // Critical tasks
      else if (task.priority >= 5) factor += 0.2; // High priority
    }

    // Payload size
    if (task.payload) {
      const payloadSize = JSON.stringify(task.payload).length;
      if (payloadSize > 10000) factor += 1.0; // Large payload
      else if (payloadSize > 1000) factor += 0.3; // Medium payload
    }

    // Task type specific adjustments
    if (task.type) {
      if (task.type.includes('llm') || task.type.includes('ai')) {
        factor += 1.5; // AI tasks are more resource intensive
      } else if (task.type.includes('analyze') || task.type.includes('process')) {
        factor += 0.5;
      }
    }

    return Math.min(factor, 5.0); // Cap at 5x
  }

  /**
   * Estimate token count for task
   * @private
   */
  _estimateTokens(task) {
    let tokens = this.baseTokenOverhead;

    // Count characters in payload
    if (task.payload) {
      const payloadStr = JSON.stringify(task.payload);
      tokens += Math.ceil(payloadStr.length * this.tokensPerCharacter);
    }

    // Count characters in description
    if (task.description) {
      tokens += Math.ceil(task.description.length * this.tokensPerCharacter);
    }

    // Add overhead for task type
    if (task.type) {
      if (task.type.includes('chat') || task.type.includes('conversation')) {
        tokens += 500; // Chat overhead
      } else if (task.type.includes('summary') || task.type.includes('analyze')) {
        tokens += 1000; // Analysis overhead
      }
    }

    return Math.max(tokens, 100); // Minimum 100 tokens
  }

  /**
   * Estimate I/O level for task
   * @private
   */
  _estimateIOLevel(task) {
    // Check for I/O intensive indicators
    if (task.type) {
      const type = task.type.toLowerCase();

      if (
        type.includes('file') ||
        type.includes('download') ||
        type.includes('upload') ||
        type.includes('storage')
      ) {
        return 'high';
      }

      if (
        type.includes('database') ||
        type.includes('query') ||
        type.includes('search')
      ) {
        return 'medium';
      }
    }

    // Check payload size
    if (task.payload && task.payload.dataSize) {
      if (task.payload.dataSize > 1024 * 1024) return 'high'; // > 1MB
      if (task.payload.dataSize > 100 * 1024) return 'medium'; // > 100KB
    }

    return 'low';
  }

  /**
   * Record actual resource usage for learning
   * @param {string} taskType - Type of task
   * @param {Object} actualUsage - Actual resource usage
   */
  recordActualUsage(taskType, actualUsage) {
    if (!this.taskHistory.has(taskType)) {
      this.taskHistory.set(taskType, []);
    }

    const history = this.taskHistory.get(taskType);

    history.push({
      cpu: actualUsage.cpu || 0,
      memory: actualUsage.memory || 0,
      tokens: actualUsage.tokens || 0,
      io: actualUsage.io || 'low',
      executionTime: actualUsage.executionTime || 0,
      timestamp: Date.now()
    });

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    logger.debug(
      { taskType, historySize: history.length },
      'Recorded actual resource usage'
    );
  }

  /**
   * Calculate average of array
   * @private
   */
  _average(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get prediction accuracy statistics
   * @param {string} taskType - Task type to analyze
   * @returns {Object} Accuracy statistics
   */
  getAccuracyStats(taskType) {
    const history = this.taskHistory.get(taskType);

    if (!history || history.length < 2) {
      return null;
    }

    // Calculate prediction accuracy for recent tasks
    const recentHistory = history.slice(-20);
    const predictions = recentHistory.map(h => ({
      actual: h.executionTime,
      predicted: this.defaults.executionTime
    }));

    const errors = predictions.map(p => Math.abs(p.actual - p.predicted));
    const avgError = this._average(errors);
    const maxError = Math.max(...errors);

    return {
      taskType,
      sampleSize: recentHistory.length,
      avgError,
      maxError,
      accuracy: 1 - Math.min(avgError / this.defaults.executionTime, 1)
    };
  }

  /**
   * Get all prediction statistics
   * @returns {Object} Statistics for all task types
   */
  getAllStats() {
    const stats = {};

    for (const [taskType, history] of this.taskHistory.entries()) {
      stats[taskType] = {
        historySize: history.length,
        accuracy: this.getAccuracyStats(taskType)
      };
    }

    return stats;
  }

  /**
   * Clear prediction history
   * @param {string} taskType - Optional task type to clear (clears all if not specified)
   */
  clearHistory(taskType) {
    if (taskType) {
      this.taskHistory.delete(taskType);
      logger.info({ taskType }, 'Cleared prediction history for task type');
    } else {
      this.taskHistory.clear();
      logger.info('Cleared all prediction history');
    }
  }
}

export default ResourcePredictor;

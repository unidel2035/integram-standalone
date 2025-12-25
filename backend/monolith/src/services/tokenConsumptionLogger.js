/**
 * Token Consumption Logger Service
 * Issue #3962: Фиксируй потребление токенов на ИИ
 *
 * Logs all AI token consumption to Integram database (my/object/198038)
 * Tracks: requests, tokens used, costs, model names, timestamps
 */

import axios from 'axios';
import logger from '../utils/logger.js';

class TokenConsumptionLogger {
  constructor() {
    // Integram API configuration
    this.integramBaseURL = 'https://dronedoc.ru';
    this.database = 'my';
    this.tokenConsumptionTypeId = 198038; // Table ID for token consumption

    // Authentication credentials (from environment or defaults)
    this.login = process.env.INTEGRAM_LOGIN || 'd';
    this.password = process.env.INTEGRAM_PASSWORD || 'd';

    // Session management
    this.sessionToken = null;
    this.xsrfToken = null;
    this.sessionExpiry = null;
  }

  /**
   * Authenticate with Integram
   */
  async authenticate() {
    try {
      // Check if session is still valid
      if (this.sessionToken && this.sessionExpiry && new Date() < this.sessionExpiry) {
        return true;
      }

      logger.info('[TokenConsumptionLogger] Authenticating with Integram...');

      const response = await axios.post(
        `${this.integramBaseURL}/${this.database}/auth`,
        new URLSearchParams({
          login: this.login,
          password: this.password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.token) {
        this.sessionToken = response.data.token;
        this.xsrfToken = response.data._xsrf || response.data.token;
        // Session expires in 1 hour
        this.sessionExpiry = new Date(Date.now() + 60 * 60 * 1000);

        logger.info('[TokenConsumptionLogger] Authentication successful');
        return true;
      } else {
        throw new Error('Authentication failed: No token received');
      }
    } catch (error) {
      logger.error('[TokenConsumptionLogger] Authentication failed:', error.message);
      return false;
    }
  }

  /**
   * Log token consumption to Integram
   *
   * @param {Object} params - Consumption parameters
   * @param {string} params.userId - User ID
   * @param {string} params.model - AI model name
   * @param {number} params.promptTokens - Input tokens used
   * @param {number} params.completionTokens - Output tokens used
   * @param {number} params.totalTokens - Total tokens used
   * @param {number} params.costRub - Cost in Russian Rubles
   * @param {string} params.application - Application name (e.g., 'polza', 'chat', 'youtube-analytics')
   * @param {string} params.operation - Operation type (e.g., 'chat', 'completion', 'analysis')
   * @param {Object} params.metadata - Additional metadata
   */
  async logConsumption(params) {
    try {
      const {
        userId = 'unknown',
        model = 'unknown',
        promptTokens = 0,
        completionTokens = 0,
        totalTokens = 0,
        costRub = 0,
        application = 'polza',
        operation = 'chat',
        metadata = {}
      } = params;

      // Ensure authentication
      const authenticated = await this.authenticate();
      if (!authenticated) {
        logger.error('[TokenConsumptionLogger] Cannot log consumption: not authenticated');
        return { success: false, error: 'Authentication failed' };
      }

      // Prepare consumption record
      const consumptionRecord = {
        user_id: userId,
        model: model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_rub: costRub,
        application: application,
        operation: operation,
        timestamp: new Date().toISOString(),
        metadata: JSON.stringify(metadata)
      };

      logger.info('[TokenConsumptionLogger] Logging consumption:', {
        userId,
        model,
        totalTokens,
        costRub,
        application
      });

      // Create object in Integram
      const response = await axios.post(
        `${this.integramBaseURL}/${this.database}/_m_add_obj`,
        new URLSearchParams({
          _xsrf: this.xsrfToken,
          typ: this.tokenConsumptionTypeId.toString(),
          val: `${application}:${model}:${new Date().toISOString()}`,
          req_json: JSON.stringify(consumptionRecord),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Authorization': this.sessionToken,
          },
        }
      );

      if (response.data && response.data.id) {
        logger.info(`[TokenConsumptionLogger] Consumption logged successfully: object ID ${response.data.id}`);
        return { success: true, objectId: response.data.id };
      } else {
        logger.warn('[TokenConsumptionLogger] Consumption logged but no object ID returned');
        return { success: true };
      }
    } catch (error) {
      logger.error('[TokenConsumptionLogger] Failed to log consumption:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate cost in rubles based on token usage
   *
   * @param {string} model - Model name
   * @param {number} promptTokens - Input tokens
   * @param {number} completionTokens - Output tokens
   * @returns {number} Cost in RUB
   */
  calculateCost(model, promptTokens, completionTokens) {
    // Pricing per 1M tokens (approximate rates in RUB)
    const pricing = {
      // OpenAI models
      'gpt-4': { input: 3000, output: 6000 },
      'gpt-4-turbo': { input: 1000, output: 3000 },
      'gpt-3.5-turbo': { input: 50, output: 150 },

      // Anthropic models
      'claude-3-opus': { input: 1500, output: 7500 },
      'claude-3-sonnet': { input: 300, output: 1500 },
      'claude-3-haiku': { input: 25, output: 125 },
      'claude-sonnet-4.5': { input: 300, output: 1500 },

      // Default fallback pricing
      'default': { input: 100, output: 300 }
    };

    // Find pricing for model (check partial matches)
    let modelPricing = pricing.default;
    for (const [key, value] of Object.entries(pricing)) {
      if (model.toLowerCase().includes(key.toLowerCase())) {
        modelPricing = value;
        break;
      }
    }

    // Calculate cost: (tokens / 1_000_000) * price_per_million
    const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (completionTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get consumption stats for a user
   *
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Consumption stats
   */
  async getConsumptionStats(userId, options = {}) {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, error: 'Authentication failed' };
      }

      const {
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0
      } = options;

      // Build query parameters
      const params = new URLSearchParams({
        _xsrf: this.xsrfToken,
        typ: this.tokenConsumptionTypeId.toString(),
        F_lim: limit.toString(),
        F_off: offset.toString(),
      });

      // Add filters if provided
      if (userId && userId !== 'all') {
        params.append('F_U', userId);
      }

      const response = await axios.post(
        `${this.integramBaseURL}/${this.database}/get_obj_list`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Authorization': this.sessionToken,
          },
        }
      );

      if (response.data && response.data.object) {
        return {
          success: true,
          objects: response.data.object,
          requisites: response.data.reqs || {},
          total: response.data.object.length
        };
      } else {
        return { success: true, objects: [], requisites: {}, total: 0 };
      }
    } catch (error) {
      logger.error('[TokenConsumptionLogger] Failed to get consumption stats:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new TokenConsumptionLogger();

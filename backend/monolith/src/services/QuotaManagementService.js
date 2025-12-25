/**
 * Quota Management Service
 * Issue #2482 - Comprehensive user quota management system
 *
 * Controls resource usage across all resource types:
 * - API requests (RPM/RPD/monthly limits)
 * - Storage (GB limits)
 * - Compute (hours/month)
 * - AI tokens (daily/monthly)
 *
 * Features:
 * - Soft/hard limits
 * - Usage metering and tracking
 * - Automatic upgrade recommendations
 * - Fair use policy enforcement
 * - Throttling and rate limiting
 */

export class QuotaManagementService {
  constructor({ db }) {
    this.db = db

    // Plan definitions with resource quotas
    this.plans = {
      free: {
        api: { rpm: 60, daily: 1000, monthly: 30000 },
        storage: 1, // GB
        compute: 10, // hours/month
        ai: { daily: 10000, monthly: 300000 }
      },
      starter: {
        api: { rpm: 300, daily: 5000, monthly: 150000 },
        storage: 10,
        compute: 50,
        ai: { daily: 50000, monthly: 1500000 }
      },
      pro: {
        api: { rpm: 1200, daily: 20000, monthly: 600000 },
        storage: 100,
        compute: 200,
        ai: { daily: 200000, monthly: 6000000 }
      },
      business: {
        api: { rpm: 6000, daily: 100000, monthly: 3000000 },
        storage: 500,
        compute: 1000,
        ai: { daily: 1000000, monthly: 30000000 }
      },
      enterprise: {
        api: { rpm: -1, daily: -1, monthly: -1 }, // Unlimited
        storage: -1,
        compute: -1,
        ai: { daily: -1, monthly: -1 }
      }
    }

    // Fair use policy thresholds
    this.fairUseThresholds = {
      burst_rpm: 3, // 3x normal RPM for short bursts
      sustained_high_usage_hours: 24, // Hours of >90% usage before warning
      storage_abuse_multiplier: 1.5, // 1.5x limit triggers investigation
      compute_spike_threshold: 2 // 2x normal compute usage
    }
  }

  /**
   * Get user's current quotas and usage
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Quota information
   */
  async getUserQuotas(userId) {
    // Get user's plan
    const userPlan = await this._getUserPlan(userId)
    const planLimits = this.plans[userPlan] || this.plans.free

    // Get current usage
    const usage = await this._getCurrentUsage(userId)

    return {
      userId,
      plan: userPlan,
      limits: planLimits,
      usage,
      usagePercent: {
        api: {
          rpm: this._calculatePercentage(usage.api.rpm, planLimits.api.rpm),
          daily: this._calculatePercentage(usage.api.daily, planLimits.api.daily),
          monthly: this._calculatePercentage(usage.api.monthly, planLimits.api.monthly)
        },
        storage: this._calculatePercentage(usage.storage, planLimits.storage),
        compute: this._calculatePercentage(usage.compute, planLimits.compute),
        ai: {
          daily: this._calculatePercentage(usage.ai.daily, planLimits.ai.daily),
          monthly: this._calculatePercentage(usage.ai.monthly, planLimits.ai.monthly)
        }
      },
      violations: await this._checkViolations(userId, usage, planLimits)
    }
  }

  /**
   * Check if user can perform an action given their quotas
   * @param {string} userId - User ID
   * @param {string} resourceType - Type of resource (api, storage, compute, ai)
   * @param {number} amount - Amount to consume
   * @returns {Promise<Object>} { allowed, reason, retryAfter }
   */
  async checkQuota(userId, resourceType, amount = 1) {
    const quotas = await this.getUserQuotas(userId)
    const limits = quotas.limits[resourceType]
    const usage = quotas.usage[resourceType]

    // Handle different resource types
    switch (resourceType) {
      case 'api':
        return this._checkApiQuota(usage, limits, amount)

      case 'storage':
        return this._checkStorageQuota(usage, limits, amount)

      case 'compute':
        return this._checkComputeQuota(usage, limits, amount)

      case 'ai':
        return this._checkAiQuota(usage, limits, amount)

      default:
        return { allowed: false, reason: 'Unknown resource type' }
    }
  }

  /**
   * Record resource usage
   * @param {string} userId - User ID
   * @param {string} resourceType - Resource type
   * @param {number} amount - Amount used
   * @param {Object} metadata - Additional metadata
   */
  async recordUsage(userId, resourceType, amount, metadata = {}) {
    const timestamp = new Date().toISOString()

    try {
      await this.db.query(`
        INSERT INTO quota_usage_log (
          user_id,
          resource_type,
          amount,
          timestamp,
          metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [userId, resourceType, amount, timestamp, JSON.stringify(metadata)])

      // Check if usage exceeds thresholds
      await this._checkAndRecordViolations(userId, resourceType)
    } catch (error) {
      console.error('Error recording quota usage:', error)
      // Don't throw - we don't want quota logging to fail the operation
    }
  }

  /**
   * Get upgrade recommendation for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Upgrade recommendation
   */
  async getUpgradeRecommendation(userId) {
    const quotas = await this.getUserQuotas(userId)
    const usagePercent = quotas.usagePercent

    const planHierarchy = ['free', 'starter', 'pro', 'business', 'enterprise']
    const currentIndex = planHierarchy.indexOf(quotas.plan)

    // Check if user is approaching limits
    const approaching = []
    const exceeded = []

    Object.entries(usagePercent).forEach(([resourceType, percent]) => {
      if (typeof percent === 'object') {
        Object.entries(percent).forEach(([period, value]) => {
          if (value >= 100) {
            exceeded.push(`${resourceType} (${period})`)
          } else if (value >= 80) {
            approaching.push(`${resourceType} (${period})`)
          }
        })
      } else {
        if (percent >= 100) {
          exceeded.push(resourceType)
        } else if (percent >= 80) {
          approaching.push(resourceType)
        }
      }
    })

    // Recommend upgrade if approaching or exceeded
    const shouldUpgrade = exceeded.length > 0 || approaching.length >= 2

    if (!shouldUpgrade || currentIndex >= planHierarchy.length - 1) {
      return {
        shouldUpgrade: false,
        currentPlan: quotas.plan,
        recommendedPlan: null,
        reason: 'Usage is within acceptable limits'
      }
    }

    const recommendedPlan = planHierarchy[currentIndex + 1]

    return {
      shouldUpgrade: true,
      currentPlan: quotas.plan,
      recommendedPlan,
      reason: exceeded.length > 0
        ? `Quota exceeded for: ${exceeded.join(', ')}`
        : `Approaching limits for: ${approaching.join(', ')}`,
      exceeded,
      approaching,
      benefits: this._getUpgradeBenefits(quotas.plan, recommendedPlan)
    }
  }

  /**
   * Set custom quotas for a user (admin only)
   * @param {string} userId - User ID
   * @param {Object} quotas - Custom quota settings
   */
  async setCustomQuotas(userId, quotas) {
    const allowedFields = ['plan', 'api_rpm', 'api_daily', 'api_monthly', 'storage', 'compute', 'ai_daily', 'ai_monthly']

    const updates = []
    const values = []
    let paramIndex = 1

    Object.entries(quotas).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        updates.push(`${snakeKey} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    if (updates.length === 0) {
      throw new Error('No valid quota fields provided')
    }

    values.push(userId)

    await this.db.query(`
      INSERT INTO user_quotas (user_id, ${updates.map((_, i) => allowedFields[i]).join(', ')})
      VALUES ($${values.length}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')})
      ON CONFLICT (user_id)
      DO UPDATE SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    `, values)
  }

  /**
   * Get quota statistics for all users
   * @returns {Promise<Object>} System-wide quota stats
   */
  async getSystemQuotaStats() {
    const stats = await this.db.query(`
      SELECT
        COUNT(DISTINCT user_id) as total_users,
        SUM(CASE WHEN (
          usage->>'api_daily' > limits->>'api_daily' OR
          usage->>'storage' > limits->>'storage' OR
          usage->>'compute' > limits->>'compute' OR
          usage->>'ai_daily' > limits->>'ai_daily'
        ) THEN 1 ELSE 0 END) as users_over_quota,
        SUM((usage->>'api_daily')::int) as total_api_requests_today,
        COUNT(DISTINCT user_id) FILTER (
          WHERE (usage->>'api_daily')::int::float / NULLIF((limits->>'api_daily')::int, 0) > 0.8
        ) as upgrade_recommendations
      FROM user_quota_summary
    `)

    return stats.rows[0] || {
      total_users: 0,
      users_over_quota: 0,
      total_api_requests_today: 0,
      upgrade_recommendations: 0
    }
  }

  /**
   * Get fair use policy violations
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} List of violations
   */
  async getViolations(filters = {}) {
    let query = `
      SELECT
        v.*,
        u.name as user_name,
        u.email as user_email
      FROM quota_violations v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (filters.userId) {
      query += ` AND v.user_id = $${paramIndex}`
      params.push(filters.userId)
      paramIndex++
    }

    if (filters.resolved !== undefined) {
      query += ` AND v.resolved = $${paramIndex}`
      params.push(filters.resolved)
      paramIndex++
    }

    if (filters.severity) {
      query += ` AND v.severity = $${paramIndex}`
      params.push(filters.severity)
      paramIndex++
    }

    query += ' ORDER BY v.timestamp DESC LIMIT 100'

    const result = await this.db.query(query, params)
    return result.rows
  }

  // Private helper methods

  async _getUserPlan(userId) {
    try {
      const result = await this.db.query(`
        SELECT plan FROM user_quotas WHERE user_id = $1
      `, [userId])

      return result.rows[0]?.plan || 'free'
    } catch (error) {
      console.error('Error getting user plan:', error)
      return 'free'
    }
  }

  async _getCurrentUsage(userId) {
    // This would query actual usage tables
    // For now, return structure for demonstration
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    try {
      // Get API usage
      const apiUsage = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE timestamp >= $1) as rpm,
          COUNT(*) FILTER (WHERE timestamp >= $2) as daily,
          COUNT(*) FILTER (WHERE timestamp >= $3) as monthly
        FROM api_request_log
        WHERE user_id = $4
          AND timestamp >= $3
      `, [
        new Date(Date.now() - 60000), // Last minute
        today,
        thisMonth,
        userId
      ])

      // Get storage usage
      const storageUsage = await this.db.query(`
        SELECT COALESCE(SUM(size_bytes) / 1073741824.0, 0) as storage_gb
        FROM user_files
        WHERE user_id = $1
      `, [userId])

      // Get compute usage
      const computeUsage = await this.db.query(`
        SELECT COALESCE(SUM(duration_seconds) / 3600.0, 0) as compute_hours
        FROM compute_usage_log
        WHERE user_id = $1
          AND timestamp >= $2
      `, [userId, thisMonth])

      // Get AI token usage
      const aiUsage = await this.db.query(`
        SELECT
          COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= $1), 0) as daily,
          COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= $2), 0) as monthly
        FROM ai_token_usage
        WHERE access_token_id IN (
          SELECT id FROM ai_access_tokens WHERE user_id = $3
        )
      `, [today, thisMonth, userId])

      return {
        api: {
          rpm: parseInt(apiUsage.rows[0]?.rpm || 0),
          daily: parseInt(apiUsage.rows[0]?.daily || 0),
          monthly: parseInt(apiUsage.rows[0]?.monthly || 0)
        },
        storage: parseFloat(storageUsage.rows[0]?.storage_gb || 0),
        compute: parseFloat(computeUsage.rows[0]?.compute_hours || 0),
        ai: {
          daily: parseInt(aiUsage.rows[0]?.daily || 0),
          monthly: parseInt(aiUsage.rows[0]?.monthly || 0)
        }
      }
    } catch (error) {
      console.error('Error getting current usage:', error)
      return {
        api: { rpm: 0, daily: 0, monthly: 0 },
        storage: 0,
        compute: 0,
        ai: { daily: 0, monthly: 0 }
      }
    }
  }

  _calculatePercentage(usage, limit) {
    if (limit === -1) return 0 // Unlimited
    if (limit === 0) return 100
    return (usage / limit) * 100
  }

  _checkApiQuota(usage, limits, amount) {
    // Check RPM (requests per minute)
    if (limits.rpm !== -1 && usage.rpm + amount > limits.rpm) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded (requests per minute)',
        retryAfter: 60,
        limitType: 'soft'
      }
    }

    // Check daily limit
    if (limits.daily !== -1 && usage.daily + amount > limits.daily) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const secondsUntilReset = Math.floor((tomorrow - new Date()) / 1000)

      return {
        allowed: false,
        reason: 'Daily API limit exceeded',
        retryAfter: secondsUntilReset,
        limitType: 'hard'
      }
    }

    // Check monthly limit
    if (limits.monthly !== -1 && usage.monthly + amount > limits.monthly) {
      return {
        allowed: false,
        reason: 'Monthly API limit exceeded',
        limitType: 'hard'
      }
    }

    return { allowed: true }
  }

  _checkStorageQuota(usage, limit, amount) {
    if (limit === -1) return { allowed: true }

    if (usage + amount > limit) {
      return {
        allowed: false,
        reason: `Storage quota exceeded (${usage.toFixed(2)} + ${amount.toFixed(2)} > ${limit} GB)`,
        limitType: 'hard'
      }
    }

    return { allowed: true }
  }

  _checkComputeQuota(usage, limit, amount) {
    if (limit === -1) return { allowed: true }

    if (usage + amount > limit) {
      return {
        allowed: false,
        reason: `Compute quota exceeded (${usage.toFixed(1)} + ${amount.toFixed(1)} > ${limit} hours)`,
        limitType: 'hard'
      }
    }

    return { allowed: true }
  }

  _checkAiQuota(usage, limits, amount) {
    // Check daily limit
    if (limits.daily !== -1 && usage.daily + amount > limits.daily) {
      return {
        allowed: false,
        reason: 'Daily AI token limit exceeded',
        limitType: 'hard'
      }
    }

    // Check monthly limit
    if (limits.monthly !== -1 && usage.monthly + amount > limits.monthly) {
      return {
        allowed: false,
        reason: 'Monthly AI token limit exceeded',
        limitType: 'hard'
      }
    }

    return { allowed: true }
  }

  async _checkViolations(userId, usage, limits) {
    const violations = []

    // Check for burst API usage (3x normal RPM)
    if (limits.api.rpm !== -1 && usage.api.rpm > limits.api.rpm * this.fairUseThresholds.burst_rpm) {
      violations.push({
        type: 'burst_rpm',
        severity: 'warning',
        message: `Burst API usage detected (${usage.api.rpm} RPM, limit: ${limits.api.rpm})`
      })
    }

    // Check for storage abuse
    if (limits.storage !== -1 && usage.storage > limits.storage * this.fairUseThresholds.storage_abuse_multiplier) {
      violations.push({
        type: 'storage_abuse',
        severity: 'critical',
        message: `Excessive storage usage (${usage.storage.toFixed(2)} GB, limit: ${limits.storage} GB)`
      })
    }

    // Check for compute spike
    if (limits.compute !== -1 && usage.compute > limits.compute * this.fairUseThresholds.compute_spike_threshold) {
      violations.push({
        type: 'compute_spike',
        severity: 'warning',
        message: `Compute usage spike detected (${usage.compute.toFixed(1)} hours, normal: ${limits.compute} hours)`
      })
    }

    return violations
  }

  async _checkAndRecordViolations(userId, resourceType) {
    const quotas = await this.getUserQuotas(userId)
    const violations = quotas.violations

    if (violations.length > 0) {
      for (const violation of violations) {
        await this.db.query(`
          INSERT INTO quota_violations (
            user_id,
            violation_type,
            resource_type,
            severity,
            timestamp,
            action,
            resolved
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, violation_type, timestamp::date)
          DO UPDATE SET
            action = $6,
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId,
          violation.type,
          resourceType,
          violation.severity,
          new Date().toISOString(),
          violation.severity === 'critical' ? 'Blocked' : 'Throttled',
          false
        ])
      }
    }
  }

  _getUpgradeBenefits(currentPlan, recommendedPlan) {
    const current = this.plans[currentPlan]
    const recommended = this.plans[recommendedPlan]

    return {
      apiRequests: {
        current: current.api,
        recommended: recommended.api,
        increase: recommended.api.monthly === -1 ? 'Unlimited' : `+${recommended.api.monthly - current.api.monthly} requests/month`
      },
      storage: {
        current: current.storage,
        recommended: recommended.storage,
        increase: recommended.storage === -1 ? 'Unlimited' : `+${recommended.storage - current.storage} GB`
      },
      compute: {
        current: current.compute,
        recommended: recommended.compute,
        increase: recommended.compute === -1 ? 'Unlimited' : `+${recommended.compute - current.compute} hours/month`
      },
      aiTokens: {
        current: current.ai,
        recommended: recommended.ai,
        increase: recommended.ai.monthly === -1 ? 'Unlimited' : `+${recommended.ai.monthly - current.ai.monthly} tokens/month`
      }
    }
  }
}

export default QuotaManagementService

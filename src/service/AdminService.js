import apiClient from '@/axios2'

class AdminService {
  // User Management
  async getUsers(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/users?${params}`)
    return response.data
  }

  async getUser(userId) {
    const response = await apiClient.get(`/admin/users/${userId}`)
    return response.data
  }

  async updateUser(userId, data) {
    const response = await apiClient.put(`/admin/users/${userId}`, data)
    return response.data
  }

  async blockUser(userId, reason) {
    const response = await apiClient.post(`/admin/users/${userId}/block`, { reason })
    return response.data
  }

  async unblockUser(userId) {
    const response = await apiClient.post(`/admin/users/${userId}/unblock`)
    return response.data
  }

  async deleteUser(userId) {
    const response = await apiClient.delete(`/admin/users/${userId}`)
    return response.data
  }

  async bulkAction(action, userIds) {
    const response = await apiClient.post('/admin/users/bulk', {
      action,
      user_ids: userIds
    })
    return response.data
  }

  // Organization Management
  async getOrganizations(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/organizations?${params}`)
    return response.data
  }

  async getOrganization(orgId) {
    const response = await apiClient.get(`/admin/organizations/${orgId}`)
    return response.data
  }

  async updateOrganization(orgId, data) {
    const response = await apiClient.put(`/admin/organizations/${orgId}`, data)
    return response.data
  }

  async transferOwnership(orgId, newOwnerId) {
    const response = await apiClient.post(`/admin/organizations/${orgId}/transfer`, {
      new_owner_id: newOwnerId
    })
    return response.data
  }

  async mergeOrganizations(sourceOrgId, targetOrgId) {
    const response = await apiClient.post('/admin/organizations/merge', {
      source_org_id: sourceOrgId,
      target_org_id: targetOrgId
    })
    return response.data
  }

  // Billing & Payments
  async getTransactions(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/transactions?${params}`)
    return response.data
  }

  async getTransaction(transactionId) {
    const response = await apiClient.get(`/admin/transactions/${transactionId}`)
    return response.data
  }

  async createManualAdjustment(data) {
    const response = await apiClient.post('/admin/transactions/adjustment', data)
    return response.data
  }

  async processRefund(transactionId, amount, reason) {
    const response = await apiClient.post(`/admin/transactions/${transactionId}/refund`, {
      amount,
      reason
    })
    return response.data
  }

  async getRevenueAnalytics(period) {
    const response = await apiClient.get(`/admin/analytics/revenue?period=${period}`)
    return response.data
  }

  // Content Management
  async getArticles(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/content/articles?${params}`)
    return response.data
  }

  async createArticle(data) {
    const response = await apiClient.post('/admin/content/articles', data)
    return response.data
  }

  async updateArticle(articleId, data) {
    const response = await apiClient.put(`/admin/content/articles/${articleId}`, data)
    return response.data
  }

  async deleteArticle(articleId) {
    const response = await apiClient.delete(`/admin/content/articles/${articleId}`)
    return response.data
  }

  async getAnnouncements() {
    const response = await apiClient.get('/admin/content/announcements')
    return response.data
  }

  async createAnnouncement(data) {
    const response = await apiClient.post('/admin/content/announcements', data)
    return response.data
  }

  // System Monitoring
  async getSystemHealth() {
    const response = await apiClient.get('/admin/monitoring/health')
    return response.data
  }

  async getErrorLogs(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/monitoring/errors?${params}`)
    return response.data
  }

  async getPerformanceMetrics(period) {
    const response = await apiClient.get(`/admin/monitoring/performance?period=${period}`)
    return response.data
  }

  async getApiUsage(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/monitoring/api-usage?${params}`)
    return response.data
  }

  // Analytics
  async getUserGrowth(period) {
    const response = await apiClient.get(`/admin/analytics/user-growth?period=${period}`)
    return response.data
  }

  async getEngagementMetrics(period) {
    const response = await apiClient.get(`/admin/analytics/engagement?period=${period}`)
    return response.data
  }

  async getConversionFunnels(period) {
    const response = await apiClient.get(`/admin/analytics/conversions?period=${period}`)
    return response.data
  }

  async getRetentionCohorts(period) {
    const response = await apiClient.get(`/admin/analytics/retention?period=${period}`)
    return response.data
  }

  async getFeatureUsage(period) {
    const response = await apiClient.get(`/admin/analytics/features?period=${period}`)
    return response.data
  }

  // Support Tools
  async getSupportTickets(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/support/tickets?${params}`)
    return response.data
  }

  async getUserActivity(userId, filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/support/users/${userId}/activity?${params}`)
    return response.data
  }

  async searchUserData(query) {
    const response = await apiClient.get(`/admin/support/search?q=${encodeURIComponent(query)}`)
    return response.data
  }

  async exportUserData(userId) {
    const response = await apiClient.get(`/admin/support/users/${userId}/export`, {
      responseType: 'blob'
    })
    return response.data
  }

  async deleteUserData(userId, reason) {
    const response = await apiClient.post(`/admin/support/users/${userId}/delete-data`, {
      reason
    })
    return response.data
  }

  // Configuration
  async getSystemSettings() {
    const response = await apiClient.get('/admin/config/settings')
    return response.data
  }

  async updateSystemSettings(settings) {
    const response = await apiClient.put('/admin/config/settings', settings)
    return response.data
  }

  async getRateLimits() {
    const response = await apiClient.get('/admin/config/rate-limits')
    return response.data
  }

  async updateRateLimits(limits) {
    const response = await apiClient.put('/admin/config/rate-limits', limits)
    return response.data
  }

  // Audit Log
  async getAuditLog(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/audit?${params}`)
    return response.data
  }

  async exportAuditLog(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/audit/export?${params}`, {
      responseType: 'blob'
    })
    return response.data
  }

  // Moderation
  async getReportedContent(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await apiClient.get(`/admin/moderation/reports?${params}`)
    return response.data
  }

  async reviewContent(reportId, action, reason) {
    const response = await apiClient.post(`/admin/moderation/reports/${reportId}/review`, {
      action,
      reason
    })
    return response.data
  }

  async getUserReports(userId) {
    const response = await apiClient.get(`/admin/moderation/users/${userId}/reports`)
    return response.data
  }

  async getContentQueue() {
    const response = await apiClient.get('/admin/moderation/queue')
    return response.data
  }
}

export default new AdminService()

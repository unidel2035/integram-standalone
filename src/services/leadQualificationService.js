/**
 * Lead Qualification Service
 *
 * Handles API calls for lead qualification agent:
 * - Lead CRUD operations
 * - Scoring and categorization
 * - CRM integrations
 * - Assignment routing
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Calculate lead score based on BANT criteria
 * @param {Object} lead - Lead data
 * @returns {number} Score from 0 to 100
 */
function calculateLeadScore(lead) {
  let score = 0

  // Budget scoring (25 points)
  if (lead.budget === 'budgeted') score += 25
  else if (lead.budget === 'potential') score += 15
  else score += 0

  // Authority scoring (25 points)
  if (lead.authority === 'decision_maker') score += 25
  else if (lead.authority === 'influencer') score += 15
  else score += 5

  // Need scoring (25 points)
  if (lead.painPoints && lead.painPoints.length > 2) score += 25
  else if (lead.painPoints && lead.painPoints.length > 0) score += 15
  else score += 5

  // Timeline/Urgency scoring (25 points)
  if (lead.urgency === 'urgent') score += 25
  else if (lead.urgency === 'planned') score += 15
  else score += 5

  return Math.min(score, 100)
}

/**
 * Categorize lead based on score
 * @param {number} score - Lead score
 * @returns {string} Category: Hot, Warm, or Cold
 */
function categorizeLead(score) {
  if (score >= 75) return 'Hot'
  if (score >= 50) return 'Warm'
  return 'Cold'
}

/**
 * Get all leads with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Leads data
 */
export async function getLeads(filters = {}) {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads`, { params: filters })
    return response.data
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    // Return mock data for development
    return {
      leads: [
        {
          id: 1,
          companyName: 'Tech Solutions Inc',
          contactName: 'John Smith',
          contactEmail: 'john@techsolutions.com',
          contactPhone: '+1-555-0123',
          companySize: 'medium',
          budget: 'Budgeted',
          urgency: 'Urgent',
          score: 85,
          category: 'Hot',
          authority: 'decision_maker',
          painPoints: ['Legacy systems', 'Manual processes', 'Poor analytics'],
          assignedTo: 'Sarah Johnson',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          companyName: 'Innovate Corp',
          contactName: 'Jane Doe',
          contactEmail: 'jane@innovatecorp.com',
          contactPhone: '+1-555-0124',
          companySize: 'large',
          budget: 'Potential',
          urgency: 'Planned',
          score: 65,
          category: 'Warm',
          authority: 'influencer',
          painPoints: ['Scalability issues'],
          assignedTo: null,
          createdAt: new Date().toISOString()
        },
        {
          id: 3,
          companyName: 'StartupXYZ',
          contactName: 'Mike Wilson',
          contactEmail: 'mike@startupxyz.com',
          contactPhone: '+1-555-0125',
          companySize: 'small',
          budget: 'None',
          urgency: 'Exploring',
          score: 35,
          category: 'Cold',
          authority: 'user',
          painPoints: [],
          assignedTo: null,
          createdAt: new Date().toISOString()
        }
      ]
    }
  }
}

/**
 * Get single lead by ID
 * @param {string|number} leadId - Lead ID
 * @returns {Promise<Object>} Lead data
 */
export async function getLead(leadId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/${leadId}`)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch lead ${leadId}:`, error)
    throw error
  }
}

/**
 * Create new lead
 * @param {Object} leadData - Lead information
 * @returns {Promise<Object>} Created lead
 */
export async function createLead(leadData) {
  try {
    // Calculate score and category
    const score = calculateLeadScore(leadData)
    const category = categorizeLead(score)

    const enrichedLead = {
      ...leadData,
      score,
      category,
      createdAt: new Date().toISOString(),
      id: Date.now() // Mock ID for development
    }

    // In production, this would call the API
    // const response = await axios.post(`${API_BASE_URL}/leads`, enrichedLead)
    // return response.data

    // Mock response for development
    return {
      success: true,
      lead: enrichedLead
    }
  } catch (error) {
    console.error('Failed to create lead:', error)
    throw error
  }
}

/**
 * Update existing lead
 * @param {string|number} leadId - Lead ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated lead
 */
export async function updateLead(leadId, updates) {
  try {
    // Recalculate score if relevant fields changed
    if (updates.budget || updates.authority || updates.urgency || updates.painPoints) {
      updates.score = calculateLeadScore({ ...updates })
      updates.category = categorizeLead(updates.score)
    }

    const response = await axios.patch(`${API_BASE_URL}/leads/${leadId}`, updates)
    return response.data
  } catch (error) {
    console.error(`Failed to update lead ${leadId}:`, error)
    throw error
  }
}

/**
 * Delete lead
 * @param {string|number} leadId - Lead ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLead(leadId) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/leads/${leadId}`)
    return response.data
  } catch (error) {
    console.error(`Failed to delete lead ${leadId}:`, error)
    throw error
  }
}

/**
 * Assign lead to a manager
 * @param {string|number} leadId - Lead ID
 * @param {string} managerId - Manager ID
 * @returns {Promise<Object>} Assignment result
 */
export async function assignLead(leadId, managerId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/leads/${leadId}/assign`, {
      managerId
    })
    return response.data
  } catch (error) {
    console.error(`Failed to assign lead ${leadId}:`, error)
    throw error
  }
}

/**
 * Send lead to CRM
 * @param {string|number} leadId - Lead ID
 * @param {string} crmType - CRM system type (amocrm, bitrix24, etc.)
 * @returns {Promise<Object>} CRM sync result
 */
export async function sendToCRM(leadId, crmType) {
  try {
    const response = await axios.post(`${API_BASE_URL}/leads/${leadId}/sync-crm`, {
      crmType
    })
    return response.data
  } catch (error) {
    console.error(`Failed to sync lead ${leadId} to ${crmType}:`, error)
    throw error
  }
}

/**
 * Get scoring configuration
 * @returns {Promise<Object>} Scoring criteria and weights
 */
export async function getScoringConfig() {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/config/scoring`)
    return response.data
  } catch (error) {
    console.error('Failed to fetch scoring config:', error)
    return {
      criteria: [
        { id: 'budget', weight: 25 },
        { id: 'authority', weight: 25 },
        { id: 'need', weight: 25 },
        { id: 'timeline', weight: 25 }
      ]
    }
  }
}

/**
 * Update scoring configuration
 * @param {Object} config - New scoring configuration
 * @returns {Promise<Object>} Update result
 */
export async function updateScoringConfig(config) {
  try {
    const response = await axios.put(`${API_BASE_URL}/leads/config/scoring`, config)
    return response.data
  } catch (error) {
    console.error('Failed to update scoring config:', error)
    throw error
  }
}

/**
 * Get routing rules
 * @returns {Promise<Array>} Routing rules
 */
export async function getRoutingRules() {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/config/routing`)
    return response.data
  } catch (error) {
    console.error('Failed to fetch routing rules:', error)
    return {
      rules: [
        { condition: 'score > 80', assignTo: 'senior_manager' },
        { condition: 'score >= 50', assignTo: 'manager' },
        { condition: 'score < 50', assignTo: 'junior' }
      ]
    }
  }
}

/**
 * Get lead analytics
 * @param {Object} filters - Time period and other filters
 * @returns {Promise<Object>} Analytics data
 */
export async function getLeadAnalytics(filters = {}) {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/analytics`, { params: filters })
    return response.data
  } catch (error) {
    console.error('Failed to fetch lead analytics:', error)
    return {
      totalLeads: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
      conversionRate: 0,
      averageScore: 0
    }
  }
}

export const leadQualificationService = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  assignLead,
  sendToCRM,
  getScoringConfig,
  updateScoringConfig,
  getRoutingRules,
  getLeadAnalytics,
  calculateLeadScore,
  categorizeLead
}

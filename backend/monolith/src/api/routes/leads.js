// leads.js - API routes for Lead Qualification Agent
// Issue #3039 - Backend API endpoints for Lead Qualification Agent
//
// NOTE: This module requires database integration via DronDoc API.
// Database requirements:
// - leads table (contact info, source, score, status)
// - qualification_criteria table (industry, budget, timeline)
// - qualification_results table (score, recommendations, next_steps)
// - assignment_history table (rep, timestamp, notes)
//
// Current implementation uses in-memory storage as a temporary solution.
// TODO: Integrate with DronDoc API for persistent storage when available.

import express from 'express';
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Temporary in-memory storage (replace with DronDoc API)
const inMemoryStorage = {
  leads: new Map(),
  qualificationCriteria: new Map(),
  qualificationResults: new Map(),
  assignmentHistory: []
};

// LLM Coordinator for AI operations
const llmCoordinator = new TokenBasedLLMCoordinator({ db: null });

// Valid lead statuses
const VALID_LEAD_STATUSES = ['new', 'qualified', 'disqualified', 'contacted', 'converted', 'lost'];

// Valid lead sources
const VALID_LEAD_SOURCES = ['website', 'referral', 'advertisement', 'social_media', 'cold_outreach', 'event', 'other'];

/**
 * Initialize in-memory storage with sample data for testing
 * This provides immediate data for the frontend without requiring database setup
 */
function initializeSampleData() {
  // Sample leads
  const sampleLeads = [
    {
      id: uuidv4(),
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@techcorp.com',
      phone: '+1-555-0123',
      company: 'TechCorp Inc',
      industry: 'Technology',
      budget: 100000,
      timeline: 'Q1 2025',
      source: 'website',
      status: 'qualified',
      qualificationScore: 85,
      assignedTo: { id: 'user1', name: 'Sarah Johnson' },
      notes: 'Strong lead - interested in enterprise solution',
      createdAt: new Date('2025-01-15').toISOString(),
      updatedAt: new Date('2025-01-15').toISOString(),
      lastQualifiedAt: new Date('2025-01-15').toISOString()
    },
    {
      id: uuidv4(),
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@innovate.com',
      phone: '+1-555-0124',
      company: 'Innovate Corp',
      industry: 'Software',
      budget: 75000,
      timeline: 'Q2 2025',
      source: 'referral',
      status: 'new',
      qualificationScore: 65,
      assignedTo: null,
      notes: 'Referred by existing client',
      createdAt: new Date('2025-01-20').toISOString(),
      updatedAt: new Date('2025-01-20').toISOString(),
      lastQualifiedAt: null
    },
    {
      id: uuidv4(),
      firstName: 'Mike',
      lastName: 'Wilson',
      email: 'mike@startupxyz.com',
      phone: '+1-555-0125',
      company: 'StartupXYZ',
      industry: 'E-commerce',
      budget: 25000,
      timeline: 'Exploring',
      source: 'cold_outreach',
      status: 'new',
      qualificationScore: 35,
      assignedTo: null,
      notes: 'Early stage startup, limited budget',
      createdAt: new Date('2025-01-22').toISOString(),
      updatedAt: new Date('2025-01-22').toISOString(),
      lastQualifiedAt: null
    }
  ];

  // Add sample leads to storage
  sampleLeads.forEach(lead => {
    inMemoryStorage.leads.set(lead.id, lead);
  });

  logger.info(`Initialized ${sampleLeads.length} sample leads for testing`);
}

// Initialize sample data on module load
initializeSampleData();

//=============================================================================
// ROUTE DEFINITIONS
// IMPORTANT: Route order matters in Express!
// - Specific routes (e.g., /health, /stats) MUST be defined BEFORE parameterized routes (e.g., /:id)
// - Otherwise, Express will match /:id first and specific routes will never be reached
// Current order (CORRECT):
//   1. POST /qualify
//   2. GET /health
//   3. GET /stats
//   4. GET / (list all leads)
//   5. POST / (create lead)
//   6. GET /:id (get specific lead)
//   7. PUT /:id (update lead)
//   8. DELETE /:id (delete lead)
//   9. PUT /:id/status (update status)
//   10. POST /:id/assign (assign lead)
//=============================================================================

/**
 * POST /api/leads/qualify
 * Qualify a lead using AI-powered analysis
 *
 * Request body:
 * {
 *   leadId: string - Lead UUID
 *   accessToken: string - DronDoc AI access token
 *   criteriaId?: string - Optional custom qualification criteria ID
 *   modelId?: string - Optional AI model ID (defaults to system default)
 * }
 */
router.post('/qualify', async (req, res) => {
  try {
    const { leadId, accessToken, criteriaId, modelId } = req.body;

    // Validation
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: 'leadId is required'
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'accessToken is required'
      });
    }

    // Get lead from storage
    const lead = inMemoryStorage.leads.get(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get qualification criteria (use default if not specified)
    let criteria = null;
    if (criteriaId) {
      criteria = inMemoryStorage.qualificationCriteria.get(criteriaId);
      if (!criteria) {
        return res.status(404).json({
          success: false,
          error: 'Qualification criteria not found'
        });
      }
    } else {
      // Use default criteria
      criteria = {
        id: 'default',
        industry: lead.industry || 'general',
        minBudget: 0,
        maxBudget: null,
        timeline: 'any',
        requiredFields: ['email', 'company'],
        scoringWeights: {
          budget: 0.3,
          timeline: 0.2,
          industry_fit: 0.25,
          engagement: 0.15,
          company_size: 0.1
        }
      };
    }

    logger.info({
      leadId,
      criteriaId: criteria.id
    }, 'Qualifying lead with AI');

    // Prepare prompt for AI qualification
    const prompt = `Analyze the following lead and provide a qualification score and recommendations.

Lead Information:
- Name: ${lead.firstName} ${lead.lastName}
- Email: ${lead.email}
- Company: ${lead.company || 'Unknown'}
- Phone: ${lead.phone || 'Not provided'}
- Industry: ${lead.industry || 'Unknown'}
- Budget: ${lead.budget || 'Not disclosed'}
- Timeline: ${lead.timeline || 'Not specified'}
- Source: ${lead.source}
- Notes: ${lead.notes || 'None'}

Qualification Criteria:
- Target Industry: ${criteria.industry}
- Budget Range: ${criteria.minBudget ? `$${criteria.minBudget}+` : 'Any'}
- Timeline: ${criteria.timeline}
- Required Fields: ${criteria.requiredFields.join(', ')}

Please provide:
1. A qualification score (0-100)
2. Key strengths (3-5 points)
3. Key concerns (3-5 points)
4. Recommended next steps (3-5 actions)
5. Overall assessment (1-2 paragraphs)

Format your response as JSON with the following structure:
{
  "score": number,
  "strengths": [string],
  "concerns": [string],
  "nextSteps": [string],
  "assessment": string,
  "recommendation": "qualified" | "needs_nurturing" | "disqualified"
}`;

    // Call AI with token
    const aiResponse = await llmCoordinator.chatWithToken(
      accessToken,
      modelId || null, // Use default model if not specified
      prompt,
      {
        application: 'LeadQualificationAgent',
        operation: 'qualify_lead',
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json'
      }
    );

    // Parse AI response
    let qualificationData;
    try {
      qualificationData = JSON.parse(aiResponse.content);
    } catch (parseError) {
      logger.error({ error: parseError.message }, 'Failed to parse AI response');
      return res.status(500).json({
        success: false,
        error: 'Failed to parse AI qualification response'
      });
    }

    // Create qualification result
    const resultId = uuidv4();
    const qualificationResult = {
      id: resultId,
      leadId,
      criteriaId: criteria.id,
      score: qualificationData.score,
      strengths: qualificationData.strengths,
      concerns: qualificationData.concerns,
      nextSteps: qualificationData.nextSteps,
      assessment: qualificationData.assessment,
      recommendation: qualificationData.recommendation,
      aiModelUsed: aiResponse.modelId || 'deepseek-chat',
      tokensUsed: aiResponse.tokensUsed || 0,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: 'AI'
    };

    // Store qualification result
    inMemoryStorage.qualificationResults.set(resultId, qualificationResult);

    // Update lead status based on recommendation
    if (qualificationData.recommendation === 'qualified') {
      lead.status = 'qualified';
      lead.qualificationScore = qualificationData.score;
    } else if (qualificationData.recommendation === 'disqualified') {
      lead.status = 'disqualified';
      lead.qualificationScore = qualificationData.score;
    }
    lead.lastQualifiedAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();
    inMemoryStorage.leads.set(leadId, lead);

    res.json({
      success: true,
      qualificationResult,
      lead
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Lead qualification failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leads/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'Lead Qualification Agent API',
    timestamp: new Date().toISOString(),
    storage: {
      leads: inMemoryStorage.leads.size,
      qualificationResults: inMemoryStorage.qualificationResults.size,
      assignmentHistory: inMemoryStorage.assignmentHistory.length
    }
  });
});

/**
 * GET /api/leads/stats
 * Get lead statistics
 * Query params:
 * - startDate?: ISO date string
 * - endDate?: ISO date string
 * - assignedTo?: User ID
 * - source?: Lead source
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, assignedTo, source } = req.query;

    logger.info({ startDate, endDate, assignedTo, source }, 'Getting lead statistics');

    // Get all leads
    let leads = Array.from(inMemoryStorage.leads.values());

    // Apply filters
    if (startDate) {
      leads = leads.filter(lead => new Date(lead.createdAt) >= new Date(startDate));
    }

    if (endDate) {
      leads = leads.filter(lead => new Date(lead.createdAt) <= new Date(endDate));
    }

    if (assignedTo) {
      leads = leads.filter(lead => lead.assignedTo?.id === assignedTo);
    }

    if (source) {
      leads = leads.filter(lead => lead.source === source);
    }

    // Calculate statistics
    const totalLeads = leads.length;
    const statusCounts = {};
    const sourceCounts = {};
    let totalScore = 0;
    let qualifiedLeads = 0;

    leads.forEach(lead => {
      // Count by status
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;

      // Count by source
      sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;

      // Calculate average score
      if (lead.qualificationScore !== undefined && lead.qualificationScore !== null) {
        totalScore += lead.qualificationScore;
        qualifiedLeads++;
      }
    });

    const averageScore = qualifiedLeads > 0 ? totalScore / qualifiedLeads : 0;

    // Get qualification results in date range
    let qualificationResults = Array.from(inMemoryStorage.qualificationResults.values());
    if (startDate) {
      qualificationResults = qualificationResults.filter(
        result => new Date(result.qualifiedAt) >= new Date(startDate)
      );
    }
    if (endDate) {
      qualificationResults = qualificationResults.filter(
        result => new Date(result.qualifiedAt) <= new Date(endDate)
      );
    }

    // Calculate AI usage stats
    const totalQualifications = qualificationResults.length;
    const totalTokensUsed = qualificationResults.reduce((sum, result) => sum + (result.tokensUsed || 0), 0);

    // Calculate conversion funnel
    const conversionFunnel = {
      new: statusCounts['new'] || 0,
      qualified: statusCounts['qualified'] || 0,
      contacted: statusCounts['contacted'] || 0,
      converted: statusCounts['converted'] || 0,
      disqualified: statusCounts['disqualified'] || 0,
      lost: statusCounts['lost'] || 0
    };

    // Calculate conversion rates
    const qualificationRate = totalLeads > 0
      ? ((statusCounts['qualified'] || 0) / totalLeads * 100).toFixed(2)
      : 0;

    const conversionRate = (statusCounts['qualified'] || 0) > 0
      ? ((statusCounts['converted'] || 0) / (statusCounts['qualified'] || 1) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      statistics: {
        overview: {
          totalLeads,
          qualifiedLeads: statusCounts['qualified'] || 0,
          convertedLeads: statusCounts['converted'] || 0,
          averageScore: averageScore.toFixed(2),
          qualificationRate: `${qualificationRate}%`,
          conversionRate: `${conversionRate}%`
        },
        byStatus: statusCounts,
        bySource: sourceCounts,
        conversionFunnel,
        aiUsage: {
          totalQualifications,
          totalTokensUsed,
          averageTokensPerQualification: totalQualifications > 0
            ? Math.round(totalTokensUsed / totalQualifications)
            : 0
        },
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get lead statistics failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leads
 * List leads with filtering and pagination
 *
 * Query params:
 * - status?: Lead status filter
 * - source?: Lead source filter
 * - assignedTo?: Assigned rep ID filter
 * - minScore?: Minimum qualification score
 * - maxScore?: Maximum qualification score
 * - search?: Search in name, email, company
 * - limit?: Results per page (default: 50)
 * - offset?: Pagination offset (default: 0)
 * - sortBy?: Field to sort by (default: createdAt)
 * - sortOrder?: Sort order (asc/desc, default: desc)
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      source,
      assignedTo,
      minScore,
      maxScore,
      search,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get all leads
    let leads = Array.from(inMemoryStorage.leads.values());

    // Apply filters
    if (status) {
      leads = leads.filter(lead => lead.status === status);
    }

    if (source) {
      leads = leads.filter(lead => lead.source === source);
    }

    if (assignedTo) {
      leads = leads.filter(lead => lead.assignedTo?.id === assignedTo);
    }

    if (minScore !== undefined) {
      const min = parseFloat(minScore);
      leads = leads.filter(lead => lead.qualificationScore !== undefined && lead.qualificationScore >= min);
    }

    if (maxScore !== undefined) {
      const max = parseFloat(maxScore);
      leads = leads.filter(lead => lead.qualificationScore !== undefined && lead.qualificationScore <= max);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      leads = leads.filter(lead =>
        (lead.firstName && lead.firstName.toLowerCase().includes(searchLower)) ||
        (lead.lastName && lead.lastName.toLowerCase().includes(searchLower)) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
        (lead.company && lead.company.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    leads.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = leads.length;
    const paginatedLeads = leads.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      leads: paginatedLeads,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'List leads failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/leads
 * Create a new lead
 *
 * Request body:
 * {
 *   firstName: string
 *   lastName: string
 *   email: string
 *   phone?: string
 *   company?: string
 *   industry?: string
 *   budget?: number
 *   timeline?: string
 *   source: string
 *   notes?: string
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      industry,
      budget,
      timeline,
      source,
      notes
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !source) {
      return res.status(400).json({
        success: false,
        error: 'firstName, lastName, email, and source are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate source
    if (!VALID_LEAD_SOURCES.includes(source)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source. Must be one of: ${VALID_LEAD_SOURCES.join(', ')}`
      });
    }

    logger.info({ email, source }, 'Creating new lead');

    // Create lead
    const leadId = uuidv4();
    const lead = {
      id: leadId,
      firstName,
      lastName,
      email,
      phone: phone || null,
      company: company || null,
      industry: industry || null,
      budget: budget || null,
      timeline: timeline || null,
      source,
      status: 'new',
      qualificationScore: null,
      assignedTo: null,
      assignedAt: null,
      lastQualifiedAt: null,
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.id || null
    };

    // Store lead
    inMemoryStorage.leads.set(leadId, lead);

    res.status(201).json({
      success: true,
      lead
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Create lead failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leads/:id
 * Get lead details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lead = inMemoryStorage.leads.get(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get associated qualification results
    const qualificationResults = Array.from(inMemoryStorage.qualificationResults.values())
      .filter(result => result.leadId === id)
      .sort((a, b) => new Date(b.qualifiedAt) - new Date(a.qualifiedAt));

    // Get assignment history
    const assignments = inMemoryStorage.assignmentHistory
      .filter(assignment => assignment.leadId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      lead,
      qualificationResults,
      assignments
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get lead details failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/leads/:id
 * Update lead information
 *
 * Request body: Partial lead object
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get lead
    const lead = inMemoryStorage.leads.get(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Validate email if provided
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
    }

    // Validate source if provided
    if (updates.source && !VALID_LEAD_SOURCES.includes(updates.source)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source. Must be one of: ${VALID_LEAD_SOURCES.join(', ')}`
      });
    }

    logger.info({ leadId: id }, 'Updating lead');

    // Prevent updating certain fields
    delete updates.id;
    delete updates.createdAt;
    delete updates.createdBy;

    // Update lead
    Object.assign(lead, updates);
    lead.updatedAt = new Date().toISOString();

    inMemoryStorage.leads.set(id, lead);

    res.json({
      success: true,
      lead
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Update lead failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if lead exists
    if (!inMemoryStorage.leads.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    logger.info({ leadId: id }, 'Deleting lead');

    // Delete lead and associated data
    inMemoryStorage.leads.delete(id);

    // Delete qualification results
    Array.from(inMemoryStorage.qualificationResults.keys()).forEach(resultId => {
      const result = inMemoryStorage.qualificationResults.get(resultId);
      if (result.leadId === id) {
        inMemoryStorage.qualificationResults.delete(resultId);
      }
    });

    // Delete assignment history
    inMemoryStorage.assignmentHistory = inMemoryStorage.assignmentHistory.filter(
      assignment => assignment.leadId !== id
    );

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Delete lead failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/leads/:id/status
 * Update lead status
 *
 * Request body:
 * {
 *   status: string - New status (new, qualified, disqualified, contacted, converted, lost)
 *   reason?: string - Optional reason for status change
 *   notes?: string - Optional notes
 * }
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, notes } = req.body;

    // Validation
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    if (!VALID_LEAD_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_LEAD_STATUSES.join(', ')}`
      });
    }

    // Get lead
    const lead = inMemoryStorage.leads.get(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    logger.info({
      leadId: id,
      oldStatus: lead.status,
      newStatus: status
    }, 'Updating lead status');

    // Update lead
    const oldStatus = lead.status;
    lead.status = status;
    lead.statusUpdatedAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();

    if (reason) {
      lead.statusChangeReason = reason;
    }

    if (notes) {
      lead.notes = (lead.notes || '') + '\n\n' + `[${new Date().toISOString()}] Status changed to ${status}: ${notes}`;
    }

    // Track status change in assignment history
    inMemoryStorage.assignmentHistory.push({
      id: uuidv4(),
      leadId: id,
      type: 'status_change',
      oldStatus,
      newStatus: status,
      reason: reason || null,
      notes: notes || null,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || null
    });

    inMemoryStorage.leads.set(id, lead);

    res.json({
      success: true,
      lead
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Update lead status failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/leads/:id/assign
 * Assign lead to a sales rep
 *
 * Request body:
 * {
 *   repId: string - Sales rep user ID
 *   repName: string - Sales rep name
 *   notes?: string - Optional assignment notes
 * }
 */
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { repId, repName, notes } = req.body;

    // Validation
    if (!repId || !repName) {
      return res.status(400).json({
        success: false,
        error: 'repId and repName are required'
      });
    }

    // Get lead
    const lead = inMemoryStorage.leads.get(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    logger.info({
      leadId: id,
      repId,
      repName
    }, 'Assigning lead to sales rep');

    // Update lead
    const previousAssignee = lead.assignedTo;
    lead.assignedTo = {
      id: repId,
      name: repName
    };
    lead.assignedAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();

    if (notes) {
      lead.notes = (lead.notes || '') + '\n\n' + `[${new Date().toISOString()}] Assigned to ${repName}: ${notes}`;
    }

    // Track assignment in history
    const assignmentRecord = {
      id: uuidv4(),
      leadId: id,
      type: 'assignment',
      repId,
      repName,
      previousAssignee: previousAssignee || null,
      notes: notes || null,
      timestamp: new Date().toISOString(),
      assignedBy: req.user?.id || null
    };

    inMemoryStorage.assignmentHistory.push(assignmentRecord);
    inMemoryStorage.leads.set(id, lead);

    res.json({
      success: true,
      lead,
      assignment: assignmentRecord
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Lead assignment failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

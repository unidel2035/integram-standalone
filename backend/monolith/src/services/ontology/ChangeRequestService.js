/**
 * Change Request Service for Ontology
 *
 * Provides a review/approval workflow for ontology modifications.
 * All changes (create, update, delete concepts and relations) go through
 * a pending state and must be approved before execution.
 *
 * Uses in-memory storage — requests are lost on restart.
 */

import { getOntologyService } from './IntegramOntologyService.js';
import logger from '../../utils/logger.js';

const VALID_TYPES = ['create_concept', 'update_concept', 'delete_concept', 'create_relation'];
const VALID_ACTIONS = ['approve', 'reject'];
const VALID_STATUSES = ['pending', 'approved', 'rejected'];

class ChangeRequestService {
  constructor() {
    /** @type {Array<Object>} In-memory store of all change requests */
    this.requests = [];
    /** @type {number} Auto-increment counter for request IDs */
    this.nextId = 1;
  }

  /**
   * Create a new change request in pending status.
   *
   * @param {string} type - One of: create_concept, update_concept, delete_concept, create_relation
   * @param {Object} data - Payload for the action (concept fields, relation info, etc.)
   * @param {string} author - Name or identifier of the request author
   * @returns {Object} The created change request
   */
  createRequest(type, data, author) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid request type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Request data must be a non-null object');
    }

    if (!author || typeof author !== 'string') {
      throw new Error('Author is required and must be a string');
    }

    const request = {
      id: this.nextId++,
      type,
      data: { ...data },
      author,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewer: null,
      comment: null,
      result: null,
    };

    this.requests.push(request);

    logger.info('[ChangeRequestService] Request created', {
      id: request.id,
      type: request.type,
      author: request.author,
    });

    return { ...request };
  }

  /**
   * List change requests, optionally filtered by status.
   *
   * @param {string} [status] - Filter by status: pending, approved, or rejected
   * @returns {Array<Object>} Requests sorted by createdAt descending
   */
  listRequests(status) {
    if (status && !VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status filter: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    let filtered = this.requests;
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    return filtered
      .map(r => ({ ...r }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get a single change request by ID.
   *
   * @param {number} id - The request ID
   * @returns {Object|null} The request or null if not found
   */
  getRequest(id) {
    const request = this.requests.find(r => r.id === id);
    return request ? { ...request } : null;
  }

  /**
   * Review (approve or reject) a change request.
   *
   * On approval, the corresponding ontology action is executed automatically.
   * On rejection, the request is simply marked as rejected with an optional comment.
   *
   * @param {number} id - The request ID
   * @param {string} action - 'approve' or 'reject'
   * @param {string} reviewer - Name or identifier of the reviewer
   * @param {string} [comment] - Optional review comment
   * @returns {Promise<Object>} The updated request
   */
  async reviewRequest(id, action, reviewer, comment) {
    if (!VALID_ACTIONS.includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    if (!reviewer || typeof reviewer !== 'string') {
      throw new Error('Reviewer is required and must be a string');
    }

    const request = this.requests.find(r => r.id === id);
    if (!request) {
      throw new Error(`Change request not found: ${id}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Request ${id} has already been reviewed (status: ${request.status})`);
    }

    request.reviewedAt = new Date().toISOString();
    request.reviewer = reviewer;
    request.comment = comment || null;

    if (action === 'reject') {
      request.status = 'rejected';
      logger.info('[ChangeRequestService] Request rejected', {
        id: request.id,
        reviewer,
        comment: request.comment,
      });
      return { ...request };
    }

    // action === 'approve' — execute the ontology action
    try {
      const result = await this._executeAction(request.type, request.data);
      request.status = 'approved';
      request.result = result;

      logger.info('[ChangeRequestService] Request approved and executed', {
        id: request.id,
        type: request.type,
        reviewer,
      });
    } catch (error) {
      // Execution failed — keep as pending so it can be retried
      request.reviewedAt = null;
      request.reviewer = null;
      request.comment = null;

      logger.error('[ChangeRequestService] Execution failed on approve', {
        id: request.id,
        type: request.type,
        error: error.message,
      });

      throw new Error(`Failed to execute change request ${id}: ${error.message}`);
    }

    return { ...request };
  }

  /**
   * Execute the ontology action corresponding to a request type.
   *
   * @param {string} type - The request type
   * @param {Object} data - The request payload
   * @returns {Promise<Object>} Result from the ontology service
   * @private
   */
  async _executeAction(type, data) {
    const ontologyService = getOntologyService();
    await ontologyService.initialize();

    switch (type) {
      case 'create_concept':
        return await ontologyService.createConcept(data);

      case 'update_concept':
        if (!data.id) {
          throw new Error('update_concept requires data.id');
        }
        return await ontologyService.updateObject(data.id, data);

      case 'delete_concept':
        if (!data.id) {
          throw new Error('delete_concept requires data.id');
        }
        return await ontologyService.deleteObject(data.id);

      case 'create_relation': {
        // Create a relation object in the ontology relations table
        const relationData = {
          sourceId: data.sourceId,
          targetId: data.targetId,
          relationType: data.relationType,
          ...data,
        };
        return await ontologyService.createConcept(relationData);
      }

      default:
        throw new Error(`Unknown request type: ${type}`);
    }
  }

  /**
   * Get aggregate statistics about change requests.
   *
   * @returns {Object} Counts: {pending, approved, rejected, total}
   */
  getStats() {
    const stats = { pending: 0, approved: 0, rejected: 0, total: this.requests.length };

    for (const request of this.requests) {
      if (stats[request.status] !== undefined) {
        stats[request.status]++;
      }
    }

    return stats;
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the singleton ChangeRequestService instance.
 *
 * @returns {ChangeRequestService}
 */
export function getChangeRequestService() {
  if (!instance) {
    instance = new ChangeRequestService();
    logger.info('[ChangeRequestService] Singleton instance created');
  }
  return instance;
}

export default ChangeRequestService;

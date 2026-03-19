/**
 * Travel Accommodation API Routes
 *
 * Provides endpoints for searching and managing accommodation options
 * across multiple booking platforms.
 */

import express from 'express';
import accommodationService from '../../services/travel-accommodation/accommodationService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * POST /api/travel-accommodation/search
 * Search for accommodations based on route and filters
 */
router.post('/search', async (req, res) => {
  try {
    const { routePoints, travelers, filters } = req.body;

    // Validate required fields
    if (!routePoints || !Array.isArray(routePoints) || routePoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Route points are required'
      });
    }

    if (!travelers || !travelers.adults) {
      return res.status(400).json({
        success: false,
        error: 'Traveler information is required'
      });
    }

    // Perform search
    const results = await accommodationService.searchAccommodations({
      routePoints,
      travelers,
      filters: filters || {}
    });

    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        searchParams: { routePoints, travelers, filters }
      }
    });
  } catch (error) {
    logger.error('Accommodation search error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search accommodations',
      message: error.message
    });
  }
});

/**
 * GET /api/travel-accommodation/:id
 * Get detailed information about a specific accommodation
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const details = await accommodationService.getAccommodationDetails(id);

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    logger.error('Get accommodation details error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get accommodation details',
      message: error.message
    });
  }
});

/**
 * POST /api/travel-accommodation/:id/contact-owner
 * Initiate communication with property owner via AI agent
 */
router.post('/:id/contact-owner', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user?.id || 'anonymous'; // Assumes auth middleware

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const result = await accommodationService.initiateOwnerCommunication(
      id,
      userId,
      message
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Contact owner error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to contact property owner',
      message: error.message
    });
  }
});

/**
 * GET /api/travel-accommodation/platforms/status
 * Get status of all booking platforms
 */
router.get('/platforms/status', async (req, res) => {
  try {
    const platforms = accommodationService.platforms;

    const platformStatus = Object.entries(platforms).map(([key, platform]) => ({
      key,
      name: platform.name,
      enabled: platform.enabled,
      configured: !!platform.apiKey
    }));

    res.json({
      success: true,
      data: platformStatus
    });
  } catch (error) {
    logger.error('Get platform status error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform status',
      message: error.message
    });
  }
});

export default router;

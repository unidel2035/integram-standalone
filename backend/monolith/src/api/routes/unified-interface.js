/**
 * Unified Interface API Routes
 *
 * Issue #3559 - Управление единым интерфейсом
 *
 * RESTful API for managing organization interface components:
 * - Sidebar menu
 * - Pages
 * - Agent instances
 * - UI settings
 * - Templates
 */

import express from 'express';
import UnifiedInterfaceService from '../../services/unified-interface/UnifiedInterfaceService.js';

const router = express.Router();
const uiService = new UnifiedInterfaceService();

// Initialize service on first request
let serviceInitialized = false;
async function ensureInitialized(req, res, next) {
  if (!serviceInitialized) {
    try {
      await uiService.initialize();
      serviceInitialized = true;
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize UnifiedInterfaceService',
        message: error.message
      });
    }
  }
  next();
}

router.use(ensureInitialized);

/**
 * GET /api/unified-interface/:orgId
 * Get complete interface configuration for organization
 */
router.get('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await uiService.getOrganizationInterface(orgId);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error getting interface:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get organization interface',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/:orgId/menu
 * Get sidebar menu for organization
 */
router.get('/:orgId/menu', async (req, res) => {
  try {
    const { orgId } = req.params;

    const menu = await uiService.getMenu(orgId);

    res.json({
      success: true,
      data: {
        items: menu,
        count: menu.length
      }
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error getting menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get menu',
      message: error.message
    });
  }
});

/**
 * POST /api/unified-interface/:orgId/menu
 * Update sidebar menu for organization
 */
router.post('/:orgId/menu', async (req, res) => {
  try {
    const { orgId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'items must be an array'
      });
    }

    const result = await uiService.updateMenu(orgId, items);

    res.json({
      success: true,
      message: 'Menu updated successfully',
      data: result
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error updating menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update menu',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/:orgId/pages
 * Get pages for organization
 */
router.get('/:orgId/pages', async (req, res) => {
  try {
    const { orgId } = req.params;

    const pages = await uiService.getPages(orgId);

    res.json({
      success: true,
      data: {
        pages,
        count: pages.length
      }
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error getting pages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pages',
      message: error.message
    });
  }
});

/**
 * POST /api/unified-interface/:orgId/pages
 * Create new page for organization
 */
router.post('/:orgId/pages', async (req, res) => {
  try {
    const { orgId } = req.params;
    const pageData = req.body;

    // Validate required fields
    if (!pageData.title || !pageData.route) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'title and route are required'
      });
    }

    const result = await uiService.createPage(orgId, pageData);

    res.json({
      success: true,
      message: 'Page created successfully',
      data: result
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error creating page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create page',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/:orgId/agents
 * Get agent instances for organization
 */
router.get('/:orgId/agents', async (req, res) => {
  try {
    const { orgId } = req.params;

    const agents = await uiService.getAgentInstances(orgId);

    res.json({
      success: true,
      data: {
        agents,
        count: agents.length
      }
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error getting agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent instances',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/:orgId/settings
 * Get UI settings for organization
 */
router.get('/:orgId/settings', async (req, res) => {
  try {
    const { orgId } = req.params;

    const settings = await uiService.getUISettings(orgId);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get UI settings',
      message: error.message
    });
  }
});

/**
 * PUT /api/unified-interface/:orgId/settings/:key
 * Update a UI setting
 */
router.put('/:orgId/settings/:key', async (req, res) => {
  try {
    const { orgId, key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'value is required'
      });
    }

    await uiService.updateUISetting(orgId, key, value);

    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error updating setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting',
      message: error.message
    });
  }
});

/**
 * POST /api/unified-interface/:orgId/apply-template
 * Apply organization template
 */
router.post('/:orgId/apply-template', async (req, res) => {
  try {
    const { orgId } = req.params;
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'templateId is required'
      });
    }

    const result = await uiService.applyTemplate(orgId, templateId);

    res.json({
      success: true,
      message: 'Template applied successfully',
      data: result
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error applying template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply template',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/:orgId/export
 * Export organization configuration as template
 */
router.get('/:orgId/export', async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await uiService.exportConfiguration(orgId);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error exporting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export configuration',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-interface/templates
 * List available organization templates
 */
router.get('/templates', async (req, res) => {
  try {
    // TODO: Implement template listing
    // For now, return empty array
    res.json({
      success: true,
      data: {
        templates: [],
        count: 0
      }
    });
  } catch (error) {
    console.error('[UnifiedInterface API] Error listing templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list templates',
      message: error.message
    });
  }
});

export default router;

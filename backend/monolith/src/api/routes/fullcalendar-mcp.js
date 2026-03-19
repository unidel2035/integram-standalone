/**
 * FullCalendar MCP API Routes
 *
 * HTTP endpoints for FullCalendar MCP Server
 */

import express from 'express';
import { fullcalendarBridge } from '../../services/mcp/http-fullcalendar-bridge.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/fullcalendar-mcp/tools
 * List available FullCalendar MCP tools
 */
router.get('/tools', async (req, res) => {
  try {
    const tools = await fullcalendarBridge.listTools();

    res.json({
      success: true,
      tools,
      count: tools.length
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list FullCalendar MCP tools');
    res.status(500).json({
      success: false,
      error: 'Failed to list tools',
      message: error.message
    });
  }
});

/**
 * POST /api/fullcalendar-mcp/execute
 * Execute a FullCalendar MCP tool
 */
router.post('/execute', async (req, res) => {
  try {
    const { toolName, arguments: args } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    const result = await fullcalendarBridge.executeTool(toolName, args || {});

    res.json({
      success: true,
      result,
      toolName
    });
  } catch (error) {
    logger.error(
      { error: error.message, tool: req.body.toolName },
      'Failed to execute FullCalendar MCP tool'
    );
    res.status(500).json({
      success: false,
      error: 'Tool execution failed',
      message: error.message,
      tool: req.body.toolName
    });
  }
});

/**
 * POST /api/fullcalendar-mcp/count-users
 * Quick endpoint to count users for an object
 */
router.post('/count-users', async (req, res) => {
  try {
    const { objectId, baseURL, login, password } = req.body;

    if (!objectId) {
      return res.status(400).json({
        success: false,
        error: 'objectId is required'
      });
    }

    // Authenticate if credentials provided
    if (login && password) {
      await fullcalendarBridge.executeTool('fullcalendar_authenticate', {
        baseURL: baseURL || 'https://dronedoc.ru/fullcalendar',
        login,
        password
      });
    }

    // Count users
    const result = await fullcalendarBridge.executeTool('fullcalendar_count_users', {
      objectId: parseInt(objectId, 10)
    });

    const content = result.content[0].text;
    const data = JSON.parse(content);

    res.json({
      success: true,
      objectId,
      userCount: data.userCount,
      users: data.users
    });
  } catch (error) {
    logger.error(
      { error: error.message, objectId: req.body.objectId },
      'Failed to count FullCalendar users'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to count users',
      message: error.message
    });
  }
});

export default router;

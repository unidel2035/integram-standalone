#!/usr/bin/env node

/**
 * FullCalendar MCP Server
 *
 * MCP server for accessing DronDoc FullCalendar API
 * Endpoint: https://dronedoc.ru/fullcalendar/
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

/**
 * FullCalendar API Client
 */
class FullCalendarClient {
  constructor() {
    this.baseURL = null;
    this.token = null;
    this.xsrfToken = null;
  }

  /**
   * Authenticate with FullCalendar API
   */
  async authenticate(baseURL, login, password) {
    this.baseURL = baseURL.replace(/\/$/, '');

    try {
      const response = await axios.post(
        `${this.baseURL}/auth`,
        new URLSearchParams({ login, pwd: password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (response.data.failed) {
        throw new Error('Authentication failed');
      }

      this.token = response.data.token;
      this.xsrfToken = response.data._xsrf;

      return {
        success: true,
        token: this.token,
        xsrf: this.xsrfToken
      };
    } catch (error) {
      throw new Error(`Auth error: ${error.message}`);
    }
  }

  /**
   * Get calendar object
   */
  async getObject(objectId) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/object/${objectId}?JSON`,
        { headers: { 'X-Authorization': this.token } }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Get object error: ${error.message}`);
    }
  }

  /**
   * Get calendar events
   */
  async getEvents(params = {}) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/events?JSON`,
        {
          headers: { 'X-Authorization': this.token },
          params
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Get events error: ${error.message}`);
    }
  }

  /**
   * Get users (participants)
   */
  async getUsers(objectId) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/object/${objectId}/users?JSON`,
        { headers: { 'X-Authorization': this.token } }
      );

      return response.data;
    } catch (error) {
      // Fallback: try getting object data and parse users
      const objectData = await this.getObject(objectId);
      return this.extractUsersFromObject(objectData);
    }
  }

  /**
   * Extract users from object data
   */
  extractUsersFromObject(objectData) {
    const users = [];

    // Try to find users in various possible structures
    if (objectData.users) {
      return objectData.users;
    }

    if (objectData.participants) {
      return objectData.participants;
    }

    if (objectData.attendees) {
      return objectData.attendees;
    }

    // Search in nested structures
    if (typeof objectData === 'object') {
      for (const [key, value] of Object.entries(objectData)) {
        if (key.toLowerCase().includes('user') ||
            key.toLowerCase().includes('participant') ||
            key.toLowerCase().includes('attendee')) {
          if (Array.isArray(value)) {
            users.push(...value);
          } else if (typeof value === 'object') {
            users.push(value);
          }
        }
      }
    }

    return users;
  }
}

// Global client instance
const client = new FullCalendarClient();

// Define available tools
const TOOLS = [
  {
    name: 'fullcalendar_authenticate',
    description: 'Authenticate with FullCalendar API',
    inputSchema: {
      type: 'object',
      properties: {
        baseURL: {
          type: 'string',
          description: 'FullCalendar base URL (e.g., https://dronedoc.ru/fullcalendar)'
        },
        login: {
          type: 'string',
          description: 'Username'
        },
        password: {
          type: 'string',
          description: 'Password'
        }
      },
      required: ['baseURL', 'login', 'password']
    }
  },
  {
    name: 'fullcalendar_get_object',
    description: 'Get calendar object by ID',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'number',
          description: 'Object ID'
        }
      },
      required: ['objectId']
    }
  },
  {
    name: 'fullcalendar_get_events',
    description: 'Get calendar events',
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        end: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)'
        }
      }
    }
  },
  {
    name: 'fullcalendar_get_users',
    description: 'Get users/participants for calendar object',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'number',
          description: 'Object ID'
        }
      },
      required: ['objectId']
    }
  },
  {
    name: 'fullcalendar_count_users',
    description: 'Count users/participants for calendar object',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'number',
          description: 'Object ID'
        }
      },
      required: ['objectId']
    }
  }
];

// Create MCP server
const server = new Server(
  {
    name: 'fullcalendar-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'fullcalendar_authenticate':
        result = await client.authenticate(
          args.baseURL,
          args.login,
          args.password
        );
        break;

      case 'fullcalendar_get_object':
        result = await client.getObject(args.objectId);
        break;

      case 'fullcalendar_get_events':
        result = await client.getEvents(args);
        break;

      case 'fullcalendar_get_users':
        result = await client.getUsers(args.objectId);
        break;

      case 'fullcalendar_count_users':
        const users = await client.getUsers(args.objectId);
        result = {
          objectId: args.objectId,
          userCount: Array.isArray(users) ? users.length : 0,
          users: users
        };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            arguments: args
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FullCalendar MCP server running on stdio');
}

main().catch(console.error);

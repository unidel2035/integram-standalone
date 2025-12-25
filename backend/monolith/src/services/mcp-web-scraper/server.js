#!/usr/bin/env node

/**
 * MCP Web Scraper Server
 *
 * Model Context Protocol (MCP) server for web scraping and automation
 * Provides AI-powered web scraping, search, and browser automation capabilities
 *
 * Features:
 * - Web scraping (HTML, Markdown)
 * - Structured data extraction
 * - Search engine results (SERP)
 * - Proxy rotation and rate limiting
 * - Batch operations
 *
 * Based on Bright Data MCP Server architecture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { config, validateConfig } from './config.js';
import { proxyManager } from './proxy_manager.js';
import { rateLimiter } from './rate_limiter.js';
import * as scrapingTools from './scraping_tools.js';
import * as searchTools from './search_tools.js';

// Validate configuration on startup
try {
  validateConfig();
  console.error('✓ Configuration validated');
} catch (error) {
  console.error('✗ Configuration validation failed:', error.message);
  process.exit(1);
}

// Define available MCP tools
const TOOLS = [
  // Scraping tools
  {
    name: 'scrape_as_markdown',
    description: 'Extract web page content as clean Markdown',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page to scrape',
        },
        waitFor: {
          type: 'string',
          description: 'CSS selector to wait for before extracting (optional)',
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds (default: 60000)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'scrape_as_html',
    description: 'Get raw HTML content from web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page to scrape',
        },
        fullPage: {
          type: 'boolean',
          description: 'Include head, scripts, and styles (default: false)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract',
    description: 'Extract structured data from web page using JSON schema',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page to scrape',
        },
        schema: {
          type: 'object',
          description: 'JSON Schema defining data structure to extract',
        },
        instructions: {
          type: 'string',
          description: 'Additional extraction instructions (optional)',
        },
      },
      required: ['url', 'schema'],
    },
  },
  {
    name: 'scrape_batch',
    description: 'Scrape multiple URLs in parallel (max 10)',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of URLs to scrape (max 10)',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'html'],
          description: 'Output format (default: markdown)',
        },
      },
      required: ['urls'],
    },
  },
  {
    name: 'check_url',
    description: 'Check if URL is accessible',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to check',
        },
      },
      required: ['url'],
    },
  },

  // Search tools
  {
    name: 'search_engine',
    description: 'Search using search engines (Google, Yandex, Bing, DuckDuckGo)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        engine: {
          type: 'string',
          enum: ['google', 'yandex', 'bing', 'duckduckgo'],
          description: 'Search engine to use (default: google)',
        },
        numResults: {
          type: 'number',
          description: 'Number of results to return (default: 10)',
        },
        country: {
          type: 'string',
          description: 'Country code (e.g., RU, US)',
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., en, ru)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_engine_batch',
    description: 'Search multiple queries (max 5)',
    inputSchema: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of search queries (max 5)',
        },
        engine: {
          type: 'string',
          enum: ['google', 'yandex', 'bing', 'duckduckgo'],
          description: 'Search engine to use (default: google)',
        },
        numResults: {
          type: 'number',
          description: 'Number of results per query (default: 10)',
        },
      },
      required: ['queries'],
    },
  },

  // Status tools
  {
    name: 'get_stats',
    description: 'Get scraper statistics (rate limits, proxy status)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'mcp-web-scraper',
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
      // Scraping tools
      case 'scrape_as_markdown':
        result = await scrapingTools.scrapeAsMarkdown(args.url, {
          waitFor: args.waitFor,
          timeout: args.timeout,
        });
        break;

      case 'scrape_as_html':
        result = await scrapingTools.scrapeAsHtml(args.url, {
          fullPage: args.fullPage,
        });
        break;

      case 'extract':
        result = await scrapingTools.extract(
          args.url,
          args.schema,
          args.instructions
        );
        break;

      case 'scrape_batch':
        result = await scrapingTools.scrapeBatch(args.urls, args.format);
        break;

      case 'check_url':
        result = await scrapingTools.checkUrl(args.url);
        break;

      // Search tools
      case 'search_engine':
        result = await searchTools.searchEngine(args.query, {
          engine: args.engine,
          numResults: args.numResults,
          country: args.country,
          language: args.language,
        });
        break;

      case 'search_engine_batch':
        result = await searchTools.searchEngineBatch(args.queries, {
          engine: args.engine,
          numResults: args.numResults,
        });
        break;

      // Status tools
      case 'get_stats':
        result = {
          proxy: proxyManager.getStats(),
          rateLimit: rateLimiter.getStats(),
          config: {
            maxConcurrentBrowsers: config.browser.maxConcurrent,
            proxyEnabled: proxyManager.proxyList.length > 0,
            rateLimitEnabled: config.rateLimit.enabled,
          },
        };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error.message,
              tool: name,
              arguments: args,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('='.repeat(60));
  console.error('🕷️  MCP Web Scraper Server');
  console.error('='.repeat(60));
  console.error(`Version: 1.0.0`);
  console.error(`Tools: ${TOOLS.length} available`);
  console.error(`Proxies: ${proxyManager.proxyList.length} configured`);
  console.error(`Rate Limit: ${config.rateLimit.enabled ? config.rateLimit.format : 'disabled'}`);
  console.error(`Browser: ${config.browser.headless ? 'headless' : 'headed'}`);
  console.error('='.repeat(60));
  console.error('✓ Server ready on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

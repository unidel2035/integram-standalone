/**
 * Tests for Integram MCP Server URL Building
 *
 * Tests URL construction for different domain configurations:
 * - dronedoc.ru
 * - integram.io
 * - app.integram.io
 * - Custom domains
 * - Various database names
 */

import { describe, it, expect } from 'vitest';

/**
 * Mock IntegramMCPClient for testing URL building logic
 * This is a copy of the URL building logic from integram-server.js
 */
class MockIntegramMCPClient {
  constructor() {
    this.baseURL = null;
    this.database = null;
    this.token = 'test-token';
    this.xsrfToken = 'test-xsrf';
  }

  setContext(baseURL, database) {
    this.baseURL = baseURL;
    this.database = database;
  }

  /**
   * Build API URL based on server type
   *
   * Supports multiple URL structures:
   * - dronedoc.ru: https://dronedoc.ru/{database}/{endpoint}?JSON_KV
   * - integram.io: https://integram.io/api/{database}/{endpoint}
   * - app.integram.io: https://app.integram.io/api/{database}/{endpoint}
   * - Any custom domain: Auto-detects format based on domain patterns
   */
  buildURL(endpoint) {
    if (!this.database || !this.baseURL) {
      throw new Error('Database and baseURL must be set. Use authenticate or setContext first.');
    }

    // Remove trailing slash from baseURL to prevent double slashes
    let cleanBaseURL = this.baseURL.replace(/\/$/, '');

    // Check if baseURL already contains the database path
    const dbPathRegex = new RegExp(`/${this.database}$`);
    const hasDbInPath = dbPathRegex.test(cleanBaseURL);

    // Detect server type by domain name
    const isDronedoc = cleanBaseURL.includes('dronedoc.ru');
    const isIntegram = cleanBaseURL.includes('integram.io');

    // Build URL based on server type
    if (isDronedoc) {
      // DronDoc format: https://dronedoc.ru/{database}/{endpoint}?JSON_KV
      if (hasDbInPath) {
        // Database already in baseURL, just append endpoint
        const url = `${cleanBaseURL}/${endpoint}`;
        return endpoint.includes('?') ? url : `${url}?JSON_KV`;
      }

      // Add database to path
      const url = `${cleanBaseURL}/${this.database}/${endpoint}`;
      return endpoint.includes('?') ? url : `${url}?JSON_KV`;
    }

    if (isIntegram) {
      // Integram format: https://[app.]integram.io/api/{database}/{endpoint}
      if (hasDbInPath) {
        // Database already in baseURL, just append endpoint
        return `${cleanBaseURL}/${endpoint}`;
      }

      // Add /api/{database} prefix
      return `${cleanBaseURL}/api/${this.database}/${endpoint}`;
    }

    // Default format for unknown domains (assumes Integram-like API structure)
    // This provides compatibility with any custom Integram installation
    if (hasDbInPath) {
      return `${cleanBaseURL}/${endpoint}`;
    }

    return `${cleanBaseURL}/api/${this.database}/${endpoint}`;
  }
}

describe('Integram MCP Server - URL Building', () => {
  let client;

  describe('DronDoc.ru Domain', () => {
    it('should build URL for dronedoc.ru with a2025 database', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');
    });

    it('should build URL for dronedoc.ru with custom database', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'mydb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/mydb/dict?JSON_KV');
    });

    it('should handle dronedoc.ru with trailing slash', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru/', 'a2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');
    });

    it('should handle dronedoc.ru with database already in baseURL', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru/a2025', 'a2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');
    });

    it('should not add JSON_KV if endpoint already has query params', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('dict?param=value');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?param=value');
    });

    it('should build auth URL for dronedoc.ru', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('auth');
      expect(url).toBe('https://dronedoc.ru/a2025/auth?JSON_KV');
    });

    it('should build POST endpoint URL for dronedoc.ru', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('_d_new');
      expect(url).toBe('https://dronedoc.ru/a2025/_d_new?JSON_KV');
    });
  });

  describe('Integram.io Domain', () => {
    it('should build URL for integram.io', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://integram.io', 'testdb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://integram.io/api/testdb/dict');
    });

    it('should build URL for app.integram.io', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://app.integram.io', 'production');

      const url = client.buildURL('dict');
      expect(url).toBe('https://app.integram.io/api/production/dict');
    });

    it('should handle integram.io with trailing slash', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://app.integram.io/', 'mydb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://app.integram.io/api/mydb/dict');
    });

    it('should handle integram.io with database already in baseURL', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://integram.io/api/testdb', 'testdb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://integram.io/api/testdb/dict');
    });

    it('should build auth URL for integram.io', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://app.integram.io', 'mydb');

      const url = client.buildURL('auth');
      expect(url).toBe('https://app.integram.io/api/mydb/auth');
    });

    it('should NOT add JSON_KV for integram.io endpoints', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://integram.io', 'testdb');

      const url = client.buildURL('dict');
      expect(url).not.toContain('JSON_KV');
    });
  });

  describe('Custom Domains', () => {
    it('should handle custom domain with Integram API format', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://custom.example.com', 'mydb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://custom.example.com/api/mydb/dict');
    });

    it('should handle custom domain with database in baseURL', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://custom.example.com/api/mydb', 'mydb');

      const url = client.buildURL('dict');
      expect(url).toBe('https://custom.example.com/api/mydb/dict');
    });

    it('should handle localhost for development', () => {
      client = new MockIntegramMCPClient();
      client.setContext('http://localhost:3000', 'devdb');

      const url = client.buildURL('dict');
      expect(url).toBe('http://localhost:3000/api/devdb/dict');
    });

    it('should handle IP address based URLs', () => {
      client = new MockIntegramMCPClient();
      client.setContext('http://192.168.1.100', 'testdb');

      const url = client.buildURL('dict');
      expect(url).toBe('http://192.168.1.100/api/testdb/dict');
    });
  });

  describe('Various Database Names', () => {
    it('should handle database name with numbers', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');
    });

    it('should handle database name with underscores', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'my_database');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/my_database/dict?JSON_KV');
    });

    it('should handle short database names', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://integram.io', 'db');

      const url = client.buildURL('dict');
      expect(url).toBe('https://integram.io/api/db/dict');
    });

    it('should handle long database names', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://app.integram.io', 'very_long_database_name_2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://app.integram.io/api/very_long_database_name_2025/dict');
    });
  });

  describe('Various Endpoints', () => {
    it('should build URL for dictionary endpoint', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('dict');
      expect(url).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');
    });

    it('should build URL for metadata endpoint', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('metadata/42');
      expect(url).toBe('https://dronedoc.ru/a2025/metadata/42?JSON_KV');
    });

    it('should build URL for object list endpoint', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('object/42');
      expect(url).toBe('https://dronedoc.ru/a2025/object/42?JSON_KV');
    });

    it('should build URL for DDL operation', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('_d_new');
      expect(url).toBe('https://dronedoc.ru/a2025/_d_new?JSON_KV');
    });

    it('should build URL for DML operation', () => {
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const url = client.buildURL('_m_save/123');
      expect(url).toBe('https://dronedoc.ru/a2025/_m_save/123?JSON_KV');
    });
  });

  describe('Error Handling', () => {
    it('should throw error if database not set', () => {
      client = new MockIntegramMCPClient();
      client.baseURL = 'https://dronedoc.ru';

      expect(() => client.buildURL('dict')).toThrow('Database and baseURL must be set');
    });

    it('should throw error if baseURL not set', () => {
      client = new MockIntegramMCPClient();
      client.database = 'a2025';

      expect(() => client.buildURL('dict')).toThrow('Database and baseURL must be set');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support all mentioned domains from issue #3449', () => {
      // Test dronedoc.ru
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');
      let url = client.buildURL('dict');
      expect(url).toContain('dronedoc.ru/a2025');

      // Test integram.io
      client = new MockIntegramMCPClient();
      client.setContext('https://integram.io', 'production');
      url = client.buildURL('dict');
      expect(url).toContain('integram.io/api/production');

      // Test app.integram.io
      client = new MockIntegramMCPClient();
      client.setContext('https://app.integram.io', 'staging');
      url = client.buildURL('dict');
      expect(url).toContain('app.integram.io/api/staging');
    });

    it('should work with any arbitrary database name', () => {
      const databases = ['a2025', 'mydb', 'test_db', 'db123', 'production', 'dev'];

      databases.forEach(dbName => {
        client = new MockIntegramMCPClient();
        client.setContext('https://dronedoc.ru', dbName);
        const url = client.buildURL('dict');
        expect(url).toContain(dbName);
      });
    });

    it('should maintain backward compatibility with existing usage', () => {
      // Existing usage: dronedoc.ru with a2025
      client = new MockIntegramMCPClient();
      client.setContext('https://dronedoc.ru', 'a2025');

      const dictUrl = client.buildURL('dict');
      expect(dictUrl).toBe('https://dronedoc.ru/a2025/dict?JSON_KV');

      const authUrl = client.buildURL('auth');
      expect(authUrl).toBe('https://dronedoc.ru/a2025/auth?JSON_KV');
    });
  });
});

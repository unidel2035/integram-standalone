/**
 * DataSourcesManager Tests
 *
 * Unit tests for data sources management service
 * Issue #3194 - Data source connection and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock organization service
vi.mock('../organization/OrganizationService.js', () => ({
  default: {
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
    getOrganization: vi.fn().mockResolvedValue({ id: 'org-123', name: 'Test Org' }),
    getMemberRole: vi.fn().mockResolvedValue('admin')
  },
  ROLES: {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer'
  }
}))

describe('DataSourcesManager', () => {
  let dataSourcesManager
  let testDataDir
  let testAuditDir

  beforeEach(async () => {
    // Create test directories
    testDataDir = path.join(__dirname, '../../../data/test_data_sources')
    testAuditDir = path.join(__dirname, '../../../data/test_data_sources_audit')

    await fs.mkdir(testDataDir, { recursive: true })
    await fs.mkdir(testAuditDir, { recursive: true })

    // Set test environment variables
    process.env.DATA_SOURCES_DIR = testDataDir
    process.env.DATA_SOURCES_AUDIT_DIR = testAuditDir

    // Import module after setting env vars
    const module = await import('../data-sources/DataSourcesManager.js')
    dataSourcesManager = module.default

    // Reset initialization
    dataSourcesManager.initialized = false
    await dataSourcesManager.initialize()
  })

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
      await fs.rm(testAuditDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(dataSourcesManager.initialized).toBe(true)
    })

    it('should create required directories', async () => {
      const dataDirExists = await fs.access(testDataDir).then(() => true).catch(() => false)
      const auditDirExists = await fs.access(testAuditDir).then(() => true).catch(() => false)

      expect(dataDirExists).toBe(true)
      expect(auditDirExists).toBe(true)
    })
  })

  describe('createDataSource', () => {
    it('should create a REST API data source', async () => {
      const dataSource = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Test API',
        type: 'rest_api',
        description: 'Test API description',
        secretId: 'secret-123',
        configuration: {
          endpoint: 'https://api.example.com/data',
          method: 'GET',
          authType: 'bearer'
        },
        createdBy: 'user-123'
      })

      expect(dataSource).toBeDefined()
      expect(dataSource.id).toBeDefined()
      expect(dataSource.name).toBe('Test API')
      expect(dataSource.type).toBe('rest_api')
      expect(dataSource.status).toBe('inactive')
      expect(dataSource.configuration.endpoint).toBe('https://api.example.com/data')
    })

    it('should create a database data source', async () => {
      const dataSource = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Test Database',
        type: 'database',
        configuration: {
          databaseType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'testdb'
        },
        createdBy: 'user-123'
      })

      expect(dataSource).toBeDefined()
      expect(dataSource.type).toBe('database')
      expect(dataSource.configuration.databaseType).toBe('postgresql')
    })

    it('should reject invalid source type', async () => {
      await expect(
        dataSourcesManager.createDataSource({
          organizationId: 'org-123',
          name: 'Invalid Source',
          type: 'invalid_type',
          configuration: {},
          createdBy: 'user-123'
        })
      ).rejects.toThrow('Invalid source type')
    })

    it('should reject REST API without endpoint', async () => {
      await expect(
        dataSourcesManager.createDataSource({
          organizationId: 'org-123',
          name: 'Invalid API',
          type: 'rest_api',
          configuration: {},
          createdBy: 'user-123'
        })
      ).rejects.toThrow('endpoint')
    })

    it('should reject database without required fields', async () => {
      await expect(
        dataSourcesManager.createDataSource({
          organizationId: 'org-123',
          name: 'Invalid DB',
          type: 'database',
          configuration: {},
          createdBy: 'user-123'
        })
      ).rejects.toThrow('databaseType')
    })
  })

  describe('getDataSource', () => {
    it('should retrieve created data source', async () => {
      const created = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Test Source',
        type: 'rest_api',
        configuration: {
          endpoint: 'https://api.example.com/data'
        },
        createdBy: 'user-123'
      })

      const retrieved = await dataSourcesManager.getDataSource(created.id, 'user-123')

      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toBe('Test Source')
    })

    it('should return null for non-existent source', async () => {
      const result = await dataSourcesManager.getDataSource('non-existent-id', 'user-123')
      expect(result).toBeNull()
    })
  })

  describe('listDataSources', () => {
    it('should list all data sources for organization', async () => {
      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Source 1',
        type: 'rest_api',
        configuration: { endpoint: 'https://api1.com' },
        createdBy: 'user-123'
      })

      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Source 2',
        type: 'database',
        configuration: {
          databaseType: 'postgresql',
          host: 'localhost',
          database: 'db'
        },
        createdBy: 'user-123'
      })

      const sources = await dataSourcesManager.listDataSources('org-123', 'user-123')

      expect(sources).toHaveLength(2)
      expect(sources[0].name).toBeDefined()
      expect(sources[1].name).toBeDefined()
    })

    it('should filter by type', async () => {
      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'API Source',
        type: 'rest_api',
        configuration: { endpoint: 'https://api.com' },
        createdBy: 'user-123'
      })

      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'DB Source',
        type: 'database',
        configuration: {
          databaseType: 'postgresql',
          host: 'localhost',
          database: 'db'
        },
        createdBy: 'user-123'
      })

      const apiSources = await dataSourcesManager.listDataSources(
        'org-123',
        'user-123',
        { type: 'rest_api' }
      )

      expect(apiSources).toHaveLength(1)
      expect(apiSources[0].type).toBe('rest_api')
    })
  })

  describe('updateDataSource', () => {
    it('should update data source', async () => {
      const created = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Original Name',
        type: 'rest_api',
        configuration: { endpoint: 'https://api.com' },
        createdBy: 'user-123'
      })

      const updated = await dataSourcesManager.updateDataSource(
        created.id,
        {
          name: 'Updated Name',
          description: 'New description'
        },
        'user-123'
      )

      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('New description')
      expect(updated.type).toBe('rest_api') // Unchanged
    })
  })

  describe('deleteDataSource', () => {
    it('should delete data source', async () => {
      const created = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'To Delete',
        type: 'rest_api',
        configuration: { endpoint: 'https://api.com' },
        createdBy: 'user-123'
      })

      const deleted = await dataSourcesManager.deleteDataSource(created.id, 'user-123')
      expect(deleted).toBe(true)

      const retrieved = await dataSourcesManager.getDataSource(created.id, 'user-123')
      expect(retrieved).toBeNull()
    })
  })

  describe('getStatistics', () => {
    it('should calculate statistics', async () => {
      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Source 1',
        type: 'rest_api',
        configuration: { endpoint: 'https://api1.com' },
        createdBy: 'user-123'
      })

      await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Source 2',
        type: 'database',
        configuration: {
          databaseType: 'postgresql',
          host: 'localhost',
          database: 'db'
        },
        createdBy: 'user-123'
      })

      const stats = await dataSourcesManager.getStatistics('org-123', 'user-123')

      expect(stats.total).toBe(2)
      expect(stats.byType.rest_api).toBe(1)
      expect(stats.byType.database).toBe(1)
      expect(stats.byStatus.inactive).toBe(2)
    })
  })

  describe('testConnection', () => {
    it('should test connection and update status', async () => {
      const created = await dataSourcesManager.createDataSource({
        organizationId: 'org-123',
        name: 'Test Source',
        type: 'webhook',
        configuration: {},
        createdBy: 'user-123'
      })

      const result = await dataSourcesManager.testConnection(created.id, 'user-123')

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()

      // Check status was updated
      const updated = await dataSourcesManager.getDataSource(created.id, 'user-123')
      expect(updated.status).not.toBe('inactive')
    })
  })
})

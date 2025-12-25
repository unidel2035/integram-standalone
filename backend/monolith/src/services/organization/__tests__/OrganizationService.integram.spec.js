/**
 * Unit Tests for OrganizationService with Integram Database Integration
 *
 * Tests the integration between OrganizationService and IntegramDatabaseService
 * Issue #3193 - База данных Integram для организаций
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'
import OrganizationService from '../OrganizationService.js'
import IntegramDatabaseService from '../../integram/IntegramDatabaseService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Use test directories
const TEST_ORG_DIR = path.join(__dirname, '../../../__test_data__/organizations')
const TEST_ORG_MEMBERS_DIR = path.join(__dirname, '../../../__test_data__/organization_members')
const TEST_INTEGRAM_DIR = path.join(__dirname, '../../../__test_data__/integram')

// Override environment variables for testing
process.env.ORGANIZATIONS_DIR = TEST_ORG_DIR
process.env.ORG_MEMBERS_DIR = TEST_ORG_MEMBERS_DIR
process.env.INTEGRAM_BASE_DIR = TEST_INTEGRAM_DIR

describe('OrganizationService - Integram Database Integration', () => {
  let organizationService
  let integramService
  let testOrgId

  beforeEach(async () => {
    // Clean up test directories
    await fs.rm(TEST_ORG_DIR, { recursive: true, force: true })
    await fs.rm(TEST_ORG_MEMBERS_DIR, { recursive: true, force: true })
    await fs.rm(TEST_INTEGRAM_DIR, { recursive: true, force: true })

    // Create fresh instances
    organizationService = new OrganizationService()
    integramService = new IntegramDatabaseService()

    await organizationService.initialize()
    await integramService.initialize()

    testOrgId = null
  })

  afterEach(async () => {
    // Clean up test organization if created
    if (testOrgId) {
      try {
        await organizationService.deleteOrganization(testOrgId, 'test-user@example.com')
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clean up test directories
    await fs.rm(TEST_ORG_DIR, { recursive: true, force: true })
    await fs.rm(TEST_ORG_MEMBERS_DIR, { recursive: true, force: true })
    await fs.rm(TEST_INTEGRAM_DIR, { recursive: true, force: true })
  })

  describe('createOrganization', () => {
    it('should create organization with Integram database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test organization',
        createdBy: 'test-user@example.com',
        metadata: { test: true },
        icon: '🏢',
        color: '#3B82F6',
        specification: 'Test spec'
      })

      testOrgId = org.id

      expect(org).toBeDefined()
      expect(org.id).toBeDefined()
      expect(org.name).toBe('Test Org')
      expect(org.integramDatabase).toBeDefined()
      expect(org.integramDatabase.created).toBe(true)
      expect(org.integramDatabase.systemTables).toBeInstanceOf(Array)
      expect(org.integramDatabase.systemTables.length).toBeGreaterThan(0)
    })

    it('should create all system tables in Integram database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      const tables = await integramService.listTables(org.id)

      expect(tables).toContain('organizations')
      expect(tables).toContain('teams')
      expect(tables).toContain('agents')
      expect(tables).toContain('agent_instances')
      expect(tables).toContain('data_sources')
      expect(tables).toContain('health_checks')
    })

    it('should insert organization record into Integram database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com',
        icon: '🏢',
        color: '#FF0000'
      })

      testOrgId = org.id

      const orgRecords = await integramService.find(org.id, 'organizations', { id: org.id })

      expect(orgRecords.length).toBe(1)
      expect(orgRecords[0].name).toBe('Test Org')
      expect(orgRecords[0].owner_email).toBe('test-user@example.com')
      expect(orgRecords[0].icon).toBe('🏢')
      expect(orgRecords[0].color).toBe('#FF0000')
    })
  })

  describe('deleteOrganization', () => {
    it('should delete organization and its Integram database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      // Verify database exists
      let dbExists = await integramService.databaseExists(org.id)
      expect(dbExists).toBe(true)

      // Delete organization
      await organizationService.deleteOrganization(org.id, 'test-user@example.com')
      testOrgId = null

      // Verify database is deleted
      dbExists = await integramService.databaseExists(org.id)
      expect(dbExists).toBe(false)
    })
  })

  describe('getDatabaseInfo', () => {
    it('should return database information for organization', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com',
        icon: '🏢'
      })

      testOrgId = org.id

      const dbInfo = await organizationService.getDatabaseInfo(org.id)

      expect(dbInfo).toBeDefined()
      expect(dbInfo.organizationId).toBe(org.id)
      expect(dbInfo.organizationName).toBe('Test Org')
      expect(dbInfo.databaseExists).toBe(true)
      expect(dbInfo.databasePath).toBeDefined()
      expect(dbInfo.systemTables).toBeInstanceOf(Array)
      expect(dbInfo.systemTables.length).toBeGreaterThan(0)
      expect(dbInfo.statistics).toBeDefined()
      expect(dbInfo.statistics.tableCount).toBeGreaterThan(0)
    })

    it('should throw error if database does not exist', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      // Delete the database manually
      await integramService.deleteOrganizationDatabase(org.id)

      // Try to get database info
      await expect(
        organizationService.getDatabaseInfo(org.id)
      ).rejects.toThrow('Integram database not found')
    })
  })

  describe('Integration with Integram operations', () => {
    it('should allow adding agent instances to organization database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      // Add agent instance
      const instance = await integramService.insert(org.id, 'agent_instances', {
        organization_id: org.id,
        agent_id: 'test-agent-123',
        instance_name: 'Test Agent',
        status: 'active',
        config: { test: true },
        created_by: 'test-user@example.com'
      })

      expect(instance).toBeDefined()
      expect(instance.id).toBeDefined()
      expect(instance.agent_id).toBe('test-agent-123')

      // Verify it's stored
      const instances = await integramService.find(org.id, 'agent_instances', {
        organization_id: org.id
      })

      expect(instances.length).toBe(1)
      expect(instances[0].instance_name).toBe('Test Agent')
    })

    it('should allow adding data sources to organization database', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      // Add data source
      const dataSource = await integramService.insert(org.id, 'data_sources', {
        organization_id: org.id,
        name: 'Test API',
        type: 'api',
        config: {
          url: 'https://api.example.com',
          method: 'GET'
        },
        status: 'active'
      })

      expect(dataSource).toBeDefined()
      expect(dataSource.id).toBeDefined()
      expect(dataSource.type).toBe('api')

      // Verify it's stored
      const sources = await integramService.find(org.id, 'data_sources', {
        organization_id: org.id
      })

      expect(sources.length).toBe(1)
      expect(sources[0].name).toBe('Test API')
    })

    it('should reflect data changes in database statistics', async () => {
      const org = await organizationService.createOrganization({
        name: 'Test Org',
        description: 'Test',
        createdBy: 'test-user@example.com'
      })

      testOrgId = org.id

      // Get initial stats
      let dbInfo = await organizationService.getDatabaseInfo(org.id)
      const initialAgentCount = dbInfo.statistics.tables.agent_instances?.rowCount || 0

      // Add agent instances
      await integramService.insert(org.id, 'agent_instances', {
        organization_id: org.id,
        agent_id: 'agent-1',
        instance_name: 'Agent 1',
        status: 'active',
        created_by: 'test-user@example.com'
      })

      await integramService.insert(org.id, 'agent_instances', {
        organization_id: org.id,
        agent_id: 'agent-2',
        instance_name: 'Agent 2',
        status: 'inactive',
        created_by: 'test-user@example.com'
      })

      // Get updated stats
      dbInfo = await organizationService.getDatabaseInfo(org.id)
      const updatedAgentCount = dbInfo.statistics.tables.agent_instances?.rowCount || 0

      expect(updatedAgentCount).toBe(initialAgentCount + 2)
    })
  })
})

/**
 * Organization Service
 *
 * Handles organization management including creation, member management,
 * and role-based access control for organization-scoped secrets.
 *
 * Issue #2963 - Organization-based secret management system
 * Issue #3112 - Phase 0: Infrastructure preparation (Integram integration)
 *
 * Features:
 * - Organization CRUD operations
 * - Member management with roles (owner, admin, member, viewer)
 * - Permission checking based on roles
 * - Organization statistics and metrics
 * - Integram database creation and management
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import IntegramDatabaseService from '../integram/IntegramDatabaseService.js'
import healthCheckService from '../HealthCheckService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage paths
const ORGANIZATIONS_DIR = process.env.ORGANIZATIONS_DIR || path.join(__dirname, '../../../data/organizations')
const ORG_MEMBERS_DIR = process.env.ORG_MEMBERS_DIR || path.join(__dirname, '../../../data/organization_members')

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
}

// Valid roles
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
}

/**
 * Organization Service
 */
class OrganizationService {
  constructor() {
    this.initialized = false
    this.integramService = new IntegramDatabaseService()
  }

  /**
   * Initialize the organization service
   */
  async initialize() {
    if (this.initialized) return

    try {
      await fs.mkdir(ORGANIZATIONS_DIR, { recursive: true })
      await fs.mkdir(ORG_MEMBERS_DIR, { recursive: true })

      // Initialize Integram service
      await this.integramService.initialize()

      this.initialized = true
      console.log('[OrganizationService] Initialized successfully')
    } catch (error) {
      console.error('[OrganizationService] Initialization failed:', error)
      throw new Error(`Failed to initialize OrganizationService: ${error.message}`)
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization({ name, description = '', createdBy, metadata = {}, icon = null, color = null, specification = null }) {
    await this.ensureInitialized()

    if (!name || !name.trim()) {
      throw new Error('Organization name is required')
    }

    if (!createdBy) {
      throw new Error('Creator user ID is required')
    }

    const orgId = uuidv4()
    const now = new Date().toISOString()

    const organization = {
      id: orgId,
      name: name.trim(),
      description: description.trim(),
      createdAt: now,
      createdBy,
      updatedAt: now,
      metadata,
      icon,
      color,
      specification
    }

    // Create Integram database for the organization
    try {
      const dbResult = await this.integramService.createOrganizationDatabase(orgId, {
        name: name.trim(),
        owner_email: createdBy, // In real implementation, get email from user service
        icon,
        color,
        specification
      })

      organization.integramDatabase = {
        created: true,
        path: dbResult.databasePath,
        systemTables: dbResult.systemTables
      }

      console.log(`[OrganizationService] Created Integram database for org: ${orgId}`)
    } catch (error) {
      console.error('[OrganizationService] Failed to create Integram database:', error)
      throw new Error(`Failed to create organization database: ${error.message}`)
    }

    // Save organization
    await this.saveOrganization(organization)

    // Add creator as owner
    await this.addMember({
      organizationId: orgId,
      userId: createdBy,
      role: ROLES.OWNER,
      addedBy: createdBy
    })

    // Add default health check agents for the organization
    try {
      const healthCheckAgents = await healthCheckService.addDefaultHealthCheckAgents(orgId)
      organization.healthCheckAgents = healthCheckAgents.map(hc => ({
        id: hc.id,
        agentId: hc.agentId,
        agentName: hc.agentName
      }))
      console.log(`[OrganizationService] Added ${healthCheckAgents.length} health check agents for org: ${orgId}`)
    } catch (error) {
      console.error('[OrganizationService] Failed to add health check agents:', error)
      // Don't fail organization creation if health checks fail
      organization.healthCheckAgents = []
    }

    console.log(`[OrganizationService] Created organization: ${orgId} (${name})`)

    return organization
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId) {
    await this.ensureInitialized()

    try {
      const filePath = path.join(ORGANIZATIONS_DIR, `${organizationId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Organization not found: ${organizationId}`)
      }
      throw error
    }
  }

  /**
   * List organizations for a user
   */
  async listUserOrganizations(userId) {
    await this.ensureInitialized()

    // Get all memberships for user
    const memberships = await this.getUserMemberships(userId)

    // Load organization details
    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        try {
          const org = await this.getOrganization(membership.organizationId)
          return {
            ...org,
            userRole: membership.role
          }
        } catch (error) {
          console.error(`[OrganizationService] Failed to load org ${membership.organizationId}:`, error)
          return null
        }
      })
    )

    return organizations.filter(org => org !== null)
  }

  /**
   * Update organization
   */
  async updateOrganization(organizationId, updates, userId) {
    await this.ensureInitialized()

    // Check permission
    await this.requireRole(organizationId, userId, ROLES.ADMIN)

    const organization = await this.getOrganization(organizationId)

    // Update fields
    if (updates.name !== undefined) {
      organization.name = updates.name.trim()
    }
    if (updates.description !== undefined) {
      organization.description = updates.description.trim()
    }
    if (updates.metadata !== undefined) {
      organization.metadata = { ...organization.metadata, ...updates.metadata }
    }

    organization.updatedAt = new Date().toISOString()

    await this.saveOrganization(organization)

    console.log(`[OrganizationService] Updated organization: ${organizationId}`)

    return organization
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId, userId) {
    await this.ensureInitialized()

    // Only owners can delete organization
    await this.requireRole(organizationId, userId, ROLES.OWNER)

    // Delete Integram database
    try {
      await this.integramService.deleteOrganizationDatabase(organizationId)
      console.log(`[OrganizationService] Deleted Integram database for org: ${organizationId}`)
    } catch (error) {
      console.error('[OrganizationService] Failed to delete Integram database:', error)
      // Continue with organization deletion even if Integram DB deletion fails
    }

    // Delete organization file
    const orgPath = path.join(ORGANIZATIONS_DIR, `${organizationId}.json`)
    await fs.unlink(orgPath)

    // Delete all memberships
    const membersPath = path.join(ORG_MEMBERS_DIR, `${organizationId}.json`)
    try {
      await fs.unlink(membersPath)
    } catch (error) {
      // Ignore if file doesn't exist
      if (error.code !== 'ENOENT') throw error
    }

    console.log(`[OrganizationService] Deleted organization: ${organizationId}`)

    return { deleted: true, organizationId }
  }

  /**
   * Add member to organization
   */
  async addMember({ organizationId, userId, role, addedBy }) {
    await this.ensureInitialized()

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      throw new Error(`Invalid role: ${role}`)
    }

    // Check if adder has permission (except for initial owner creation)
    if (addedBy !== userId) {
      await this.requireRole(organizationId, addedBy, ROLES.ADMIN)
    }

    // Check if organization exists
    await this.getOrganization(organizationId)

    // Load existing members
    const members = await this.getOrganizationMembers(organizationId)

    // Check if user is already a member
    if (members.find(m => m.userId === userId)) {
      throw new Error(`User ${userId} is already a member of organization ${organizationId}`)
    }

    const memberId = uuidv4()
    const now = new Date().toISOString()

    const membership = {
      id: memberId,
      organizationId,
      userId,
      role,
      joinedAt: now,
      addedBy
    }

    members.push(membership)

    await this.saveOrganizationMembers(organizationId, members)

    console.log(`[OrganizationService] Added member ${userId} to org ${organizationId} with role ${role}`)

    return membership
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId, userId, removedBy) {
    await this.ensureInitialized()

    // Check permission
    await this.requireRole(organizationId, removedBy, ROLES.ADMIN)

    const members = await this.getOrganizationMembers(organizationId)

    // Cannot remove the last owner
    const owners = members.filter(m => m.role === ROLES.OWNER)
    const targetMember = members.find(m => m.userId === userId)

    if (targetMember && targetMember.role === ROLES.OWNER && owners.length === 1) {
      throw new Error('Cannot remove the last owner of the organization')
    }

    // Remove member
    const updatedMembers = members.filter(m => m.userId !== userId)

    if (updatedMembers.length === members.length) {
      throw new Error(`User ${userId} is not a member of organization ${organizationId}`)
    }

    await this.saveOrganizationMembers(organizationId, updatedMembers)

    console.log(`[OrganizationService] Removed member ${userId} from org ${organizationId}`)

    return { removed: true, userId }
  }

  /**
   * Update member role
   */
  async updateMemberRole(organizationId, userId, newRole, updatedBy) {
    await this.ensureInitialized()

    // Check permission (only owners can change roles)
    await this.requireRole(organizationId, updatedBy, ROLES.OWNER)

    // Validate role
    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`)
    }

    const members = await this.getOrganizationMembers(organizationId)
    const member = members.find(m => m.userId === userId)

    if (!member) {
      throw new Error(`User ${userId} is not a member of organization ${organizationId}`)
    }

    // Cannot change role of last owner
    const owners = members.filter(m => m.role === ROLES.OWNER)
    if (member.role === ROLES.OWNER && owners.length === 1 && newRole !== ROLES.OWNER) {
      throw new Error('Cannot change role of the last owner')
    }

    member.role = newRole

    await this.saveOrganizationMembers(organizationId, members)

    console.log(`[OrganizationService] Updated role for ${userId} in org ${organizationId} to ${newRole}`)

    return member
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId) {
    await this.ensureInitialized()

    try {
      const filePath = path.join(ORG_MEMBERS_DIR, `${organizationId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Get user's memberships across all organizations
   */
  async getUserMemberships(userId) {
    await this.ensureInitialized()

    const memberships = []

    try {
      const files = await fs.readdir(ORG_MEMBERS_DIR)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filePath = path.join(ORG_MEMBERS_DIR, file)
        const data = await fs.readFile(filePath, 'utf-8')
        const members = JSON.parse(data)

        const userMembership = members.find(m => m.userId === userId)
        if (userMembership) {
          memberships.push(userMembership)
        }
      }
    } catch (error) {
      console.error('[OrganizationService] Error reading memberships:', error)
    }

    return memberships
  }

  /**
   * Get user's role in organization
   */
  async getUserRole(organizationId, userId) {
    const members = await this.getOrganizationMembers(organizationId)
    const member = members.find(m => m.userId === userId)
    return member ? member.role : null
  }

  /**
   * Check if user has at least the required role
   */
  async hasRole(organizationId, userId, requiredRole) {
    const userRole = await this.getUserRole(organizationId, userId)

    if (!userRole) {
      return false
    }

    const userRoleLevel = ROLE_HIERARCHY[userRole] || 0
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0

    return userRoleLevel >= requiredRoleLevel
  }

  /**
   * Require user to have at least the specified role (throw if not)
   */
  async requireRole(organizationId, userId, requiredRole) {
    const hasPermission = await this.hasRole(organizationId, userId, requiredRole)

    if (!hasPermission) {
      const userRole = await this.getUserRole(organizationId, userId)
      throw new Error(
        `Insufficient permissions. Required: ${requiredRole}, User has: ${userRole || 'none'}`
      )
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId) {
    await this.ensureInitialized()

    const organization = await this.getOrganization(organizationId)
    const members = await this.getOrganizationMembers(organizationId)

    const stats = {
      totalMembers: members.length,
      membersByRole: {
        owner: members.filter(m => m.role === ROLES.OWNER).length,
        admin: members.filter(m => m.role === ROLES.ADMIN).length,
        member: members.filter(m => m.role === ROLES.MEMBER).length,
        viewer: members.filter(m => m.role === ROLES.VIEWER).length
      },
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt
    }

    return stats
  }

  /**
   * Get Integram database information for organization
   */
  async getDatabaseInfo(organizationId) {
    await this.ensureInitialized()

    // Verify organization exists
    const organization = await this.getOrganization(organizationId)

    // Check if Integram database exists
    const dbExists = await this.integramService.databaseExists(organizationId)

    if (!dbExists) {
      throw new Error(`Integram database not found for organization ${organizationId}`)
    }

    // Get database statistics
    const dbStats = await this.integramService.getDatabaseStats(organizationId)

    return {
      organizationId,
      organizationName: organization.name,
      databaseExists: true,
      databasePath: organization.integramDatabase?.path || null,
      systemTables: organization.integramDatabase?.systemTables || [],
      statistics: dbStats,
      createdAt: organization.integramDatabase?.created ? organization.createdAt : null
    }
  }

  /**
   * Save organization to file
   */
  async saveOrganization(organization) {
    const filePath = path.join(ORGANIZATIONS_DIR, `${organization.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(organization, null, 2), 'utf-8')
  }

  /**
   * Save organization members to file
   */
  async saveOrganizationMembers(organizationId, members) {
    const filePath = path.join(ORG_MEMBERS_DIR, `${organizationId}.json`)
    await fs.writeFile(filePath, JSON.stringify(members, null, 2), 'utf-8')
  }
}

// Export singleton instance
const organizationService = new OrganizationService()
export default organizationService

export { ROLE_HIERARCHY }

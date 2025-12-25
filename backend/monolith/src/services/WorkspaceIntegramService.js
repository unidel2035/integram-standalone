/**
 * Workspace Integram Service (v2 - JSON-based storage)
 * Issue #4828: Store workspace and session settings in Integram
 *
 * This service manages workspace metadata storage in Integram 'my' database.
 * Uses JSON-based storage in shared requisites as per Issue #4828 requirements.
 *
 * Table Structure:
 * - Workspaces (205950): Stores workspace metadata in JSON format
 *   - WorkspaceTextField (205951): JSON with workspace metadata
 *   - WorkspaceNumberField (205952): JSON with statistics
 *   - WorkspaceDateField (205953): Date fields
 *   - WorkspaceBoolField (205954): JSON with permissions
 *   - WorkspaceLongTextField (205955): JSON with complex data (restrictedPaths, etc.)
 *
 * - WorkspaceSessions (205956): Stores session metadata in JSON format
 *   - WorkspaceTextField (205957): JSON with session metadata
 *   - WorkspaceDateField (205958): Session timestamps
 *   - WorkspaceNumberField (205959): Session statistics
 */

import IntegramMCPClient from './mcp/IntegramMCPClient.js';
import logger from '../utils/logger.js';

// Table and requisite IDs for Workspaces
const WORKSPACES_TABLE = {
  TYPE_ID: 205950,
  TEXT_FIELD: 205951,    // JSON: workspaceId, name, userId, integramServer, path, repositoryUrl, branch
  NUMBER_FIELD: 205952,   // JSON: repositoryFileCount, repositorySizeBytes, filesCreated, filesModified, filesDeleted, commandsExecuted
  DATE_FIELD: 205953,     // Date: createdAt, lastActivity
  BOOL_FIELD: 205954,     // JSON: allowRead, allowWrite, allowBash, allowWebFetch, allowGlob, allowGrep
  LONG_TEXT_FIELD: 205955 // JSON: restrictedPaths, toolConfig, repositoryInfo
};

// Table and requisite IDs for WorkspaceSessions
const SESSIONS_TABLE = {
  TYPE_ID: 205956,
  TEXT_FIELD: 205957,     // JSON: sessionId, workspaceId, filepath, userId
  DATE_FIELD: 205958,     // Date: createdAt, lastActivity
  NUMBER_FIELD: 205959    // JSON: messageCount, tokensUsed
};

class WorkspaceIntegramService {
  constructor() {
    this.integramClient = null;
    this.initialized = false;
    this.serverURL = process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru';
    this.database = process.env.WORKSPACE_INTEGRAM_DATABASE || 'my';
    this.login = process.env.INTEGRAM_LOGIN || 'd';
    this.password = process.env.INTEGRAM_PASSWORD || 'd';
  }

  /**
   * Initialize Integram client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.info({ serverURL: this.serverURL, database: this.database }, 'Initializing WorkspaceIntegramService');

    this.integramClient = new IntegramMCPClient({
      serverURL: this.serverURL,
      database: this.database
    });

    try {
      // Authenticate
      await this.integramClient.authenticate(this.login, this.password);
      this.initialized = true;
      logger.info('WorkspaceIntegramService initialized successfully');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize WorkspaceIntegramService');
      throw error;
    }
  }

  /**
   * Create workspace entry in Integram
   * @param {object} workspace - Full workspace object from WorkspaceService
   * @returns {Promise<string>} Integram object ID
   */
  async createWorkspace(workspace) {
    await this.initialize();

    try {
      logger.info({
        workspaceId: workspace.id,
        name: workspace.name,
        userId: workspace.userId
      }, 'Creating workspace in Integram');

      // Prepare JSON data for each requisite
      const textData = {
        workspaceId: workspace.id,
        name: workspace.name,
        userId: workspace.userId,
        integramServer: workspace.integramServer || null,
        path: workspace.path,
        repositoryUrl: workspace.repositoryUrl || null
      };

      const numberData = {
        repositoryFileCount: workspace.repositoryInfo?.fileCount || 0,
        repositorySizeBytes: workspace.repositoryInfo?.sizeBytes || 0,
        filesCreated: workspace.stats?.filesCreated || 0,
        filesModified: workspace.stats?.filesModified || 0,
        filesDeleted: workspace.stats?.filesDeleted || 0,
        commandsExecuted: workspace.stats?.commandsExecuted || 0
      };

      const boolData = {
        allowRead: workspace.toolConfig?.allowRead !== false,
        allowWrite: workspace.toolConfig?.allowWrite !== false,
        allowBash: workspace.toolConfig?.allowBash !== false,
        allowWebFetch: workspace.toolConfig?.allowWebFetch !== false,
        allowGlob: workspace.toolConfig?.allowGlob !== false,
        allowGrep: workspace.toolConfig?.allowGrep !== false
      };

      const longTextData = {
        restrictedPaths: workspace.toolConfig?.restrictedPaths || [],
        repositoryInfo: workspace.repositoryInfo || null,
        allowedCommands: workspace.toolConfig?.allowedCommands || null
      };

      // Create object in Integram
      const result = await this.integramClient.createObject({
        typeId: WORKSPACES_TABLE.TYPE_ID,
        value: workspace.name, // Object name/title
        requisites: {
          [WORKSPACES_TABLE.TEXT_FIELD]: JSON.stringify(textData),
          [WORKSPACES_TABLE.NUMBER_FIELD]: JSON.stringify(numberData),
          [WORKSPACES_TABLE.DATE_FIELD]: workspace.createdAt || new Date().toISOString(),
          [WORKSPACES_TABLE.BOOL_FIELD]: JSON.stringify(boolData),
          [WORKSPACES_TABLE.LONG_TEXT_FIELD]: JSON.stringify(longTextData)
        }
      });

      logger.info({
        integramObjectId: result.id,
        workspaceId: workspace.id,
        name: workspace.name
      }, 'Workspace created successfully in Integram');

      return result.id; // Return Integram object ID
    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        workspaceId: workspace.id
      }, 'Failed to create workspace in Integram');
      throw error;
    }
  }

  /**
   * Update workspace in Integram
   * @param {string} integramObjectId - Integram object ID
   * @param {object} workspace - Updated workspace object
   */
  async updateWorkspace(integramObjectId, workspace) {
    await this.initialize();

    try {
      // Prepare updated JSON data
      const textData = {
        workspaceId: workspace.id,
        name: workspace.name,
        userId: workspace.userId,
        integramServer: workspace.integramServer || null,
        path: workspace.path,
        repositoryUrl: workspace.repositoryUrl || null
      };

      const numberData = {
        repositoryFileCount: workspace.repositoryInfo?.fileCount || 0,
        repositorySizeBytes: workspace.repositoryInfo?.sizeBytes || 0,
        filesCreated: workspace.stats?.filesCreated || 0,
        filesModified: workspace.stats?.filesModified || 0,
        filesDeleted: workspace.stats?.filesDeleted || 0,
        commandsExecuted: workspace.stats?.commandsExecuted || 0
      };

      const boolData = {
        allowRead: workspace.toolConfig?.allowRead !== false,
        allowWrite: workspace.toolConfig?.allowWrite !== false,
        allowBash: workspace.toolConfig?.allowBash !== false,
        allowWebFetch: workspace.toolConfig?.allowWebFetch !== false,
        allowGlob: workspace.toolConfig?.allowGlob !== false,
        allowGrep: workspace.toolConfig?.allowGrep !== false
      };

      const longTextData = {
        restrictedPaths: workspace.toolConfig?.restrictedPaths || [],
        repositoryInfo: workspace.repositoryInfo || null,
        allowedCommands: workspace.toolConfig?.allowedCommands || null
      };

      // Update object requisites
      await this.integramClient.setRequisites(integramObjectId, {
        [WORKSPACES_TABLE.TEXT_FIELD]: JSON.stringify(textData),
        [WORKSPACES_TABLE.NUMBER_FIELD]: JSON.stringify(numberData),
        [WORKSPACES_TABLE.BOOL_FIELD]: JSON.stringify(boolData),
        [WORKSPACES_TABLE.LONG_TEXT_FIELD]: JSON.stringify(longTextData)
      });

      logger.info({ integramObjectId, workspaceId: workspace.id }, 'Workspace updated in Integram');
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId,
        workspaceId: workspace.id
      }, 'Failed to update workspace in Integram');
      // Don't throw - non-critical operation
    }
  }

  /**
   * Get workspace by Integram object ID
   * @param {string} integramObjectId - Integram object ID
   * @returns {Promise<object|null>} Workspace object or null
   */
  async getWorkspace(integramObjectId) {
    await this.initialize();

    try {
      const result = await this.integramClient.getEditObject(integramObjectId);
      const reqs = result.reqs || {};

      // Parse JSON data from requisites
      const textData = reqs[WORKSPACES_TABLE.TEXT_FIELD]?.value
        ? JSON.parse(reqs[WORKSPACES_TABLE.TEXT_FIELD].value)
        : {};

      const numberData = reqs[WORKSPACES_TABLE.NUMBER_FIELD]?.value
        ? JSON.parse(reqs[WORKSPACES_TABLE.NUMBER_FIELD].value)
        : {};

      const boolData = reqs[WORKSPACES_TABLE.BOOL_FIELD]?.value
        ? JSON.parse(reqs[WORKSPACES_TABLE.BOOL_FIELD].value)
        : {};

      const longTextData = reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD]?.value
        ? JSON.parse(reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD].value)
        : {};

      // Reconstruct workspace object
      const workspace = {
        id: textData.workspaceId,
        name: textData.name || result.obj.val,
        userId: textData.userId,
        integramServer: textData.integramServer,
        path: textData.path,
        repositoryUrl: textData.repositoryUrl,
        repositoryInfo: longTextData.repositoryInfo,
        createdAt: reqs[WORKSPACES_TABLE.DATE_FIELD]?.value || new Date().toISOString(),
        lastActivity: reqs[WORKSPACES_TABLE.DATE_FIELD]?.value || new Date().toISOString(),
        toolConfig: {
          allowRead: boolData.allowRead !== false,
          allowWrite: boolData.allowWrite !== false,
          allowBash: boolData.allowBash !== false,
          allowWebFetch: boolData.allowWebFetch !== false,
          allowGlob: boolData.allowGlob !== false,
          allowGrep: boolData.allowGrep !== false,
          restrictedPaths: longTextData.restrictedPaths || [],
          allowedCommands: longTextData.allowedCommands
        },
        stats: {
          filesCreated: numberData.filesCreated || 0,
          filesModified: numberData.filesModified || 0,
          filesDeleted: numberData.filesDeleted || 0,
          commandsExecuted: numberData.commandsExecuted || 0,
          sizeBytes: numberData.repositorySizeBytes || 0
        },
        _integramObjectId: integramObjectId // Store for updates
      };

      return workspace;
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId
      }, 'Failed to get workspace from Integram');
      return null;
    }
  }

  /**
   * Get all workspaces for a user
   * @param {string} userId - User identifier
   * @returns {Promise<array>} Array of workspace objects
   */
  async getUserWorkspaces(userId) {
    await this.initialize();

    try {
      const response = await this.integramClient.getObjects(
        WORKSPACES_TABLE.TYPE_ID,
        { LIMIT: 100 }
      );

      const workspaces = [];

      for (const obj of response.object || []) {
        const reqs = response.reqs?.[obj.id] || {};

        // Parse text data to check userId
        const textDataStr = reqs[WORKSPACES_TABLE.TEXT_FIELD];
        if (!textDataStr) continue;

        try {
          const textData = JSON.parse(textDataStr);

          // Filter by userId
          if (textData.userId !== userId) continue;

          // Parse other data
          const numberData = reqs[WORKSPACES_TABLE.NUMBER_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.NUMBER_FIELD])
            : {};

          const boolData = reqs[WORKSPACES_TABLE.BOOL_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.BOOL_FIELD])
            : {};

          const longTextData = reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD])
            : {};

          // Reconstruct workspace object
          workspaces.push({
            id: textData.workspaceId,
            name: textData.name || obj.val,
            userId: textData.userId,
            integramServer: textData.integramServer,
            path: textData.path,
            repositoryUrl: textData.repositoryUrl,
            repositoryInfo: longTextData.repositoryInfo,
            createdAt: reqs[WORKSPACES_TABLE.DATE_FIELD] || new Date().toISOString(),
            lastActivity: reqs[WORKSPACES_TABLE.DATE_FIELD] || new Date().toISOString(),
            toolConfig: {
              allowRead: boolData.allowRead !== false,
              allowWrite: boolData.allowWrite !== false,
              allowBash: boolData.allowBash !== false,
              allowWebFetch: boolData.allowWebFetch !== false,
              allowGlob: boolData.allowGlob !== false,
              allowGrep: boolData.allowGrep !== false,
              restrictedPaths: longTextData.restrictedPaths || [],
              allowedCommands: longTextData.allowedCommands
            },
            stats: {
              filesCreated: numberData.filesCreated || 0,
              filesModified: numberData.filesModified || 0,
              filesDeleted: numberData.filesDeleted || 0,
              commandsExecuted: numberData.commandsExecuted || 0,
              sizeBytes: numberData.repositorySizeBytes || 0
            },
            _integramObjectId: obj.id
          });
        } catch (parseError) {
          logger.warn({
            error: parseError.message,
            objectId: obj.id
          }, 'Failed to parse workspace data, skipping');
        }
      }

      logger.info({ userId, count: workspaces.length }, 'Retrieved user workspaces from Integram');
      return workspaces;
    } catch (error) {
      logger.error({
        error: error.message,
        userId
      }, 'Failed to get user workspaces from Integram');
      return [];
    }
  }

  /**
   * Get all workspaces from Integram (Issue #4828 Phase 2)
   * Used for loading all workspaces on backend initialization
   * @returns {Promise<Array>} Array of workspace objects
   */
  async getAllWorkspaces() {
    await this.initialize();

    try {
      const response = await this.integramClient.getObjects(
        WORKSPACES_TABLE.TYPE_ID,
        { LIMIT: 1000 } // Load up to 1000 workspaces
      );

      const workspaces = [];

      for (const obj of response.object || []) {
        const reqs = response.reqs?.[obj.id] || {};

        // Parse text data
        const textDataStr = reqs[WORKSPACES_TABLE.TEXT_FIELD];
        if (!textDataStr) continue;

        try {
          const textData = JSON.parse(textDataStr);

          // Parse other data
          const numberData = reqs[WORKSPACES_TABLE.NUMBER_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.NUMBER_FIELD])
            : {};

          const boolData = reqs[WORKSPACES_TABLE.BOOL_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.BOOL_FIELD])
            : {};

          const longTextData = reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD]
            ? JSON.parse(reqs[WORKSPACES_TABLE.LONG_TEXT_FIELD])
            : {};

          // Reconstruct workspace object
          workspaces.push({
            id: textData.workspaceId,
            name: textData.name || obj.val,
            userId: textData.userId,
            integramServer: textData.integramServer,
            path: textData.path,
            repositoryUrl: textData.repositoryUrl,
            repositoryInfo: longTextData.repositoryInfo,
            createdAt: reqs[WORKSPACES_TABLE.DATE_FIELD] || new Date().toISOString(),
            lastActivity: reqs[WORKSPACES_TABLE.DATE_FIELD] || new Date().toISOString(),
            toolConfig: {
              allowRead: boolData.allowRead !== false,
              allowWrite: boolData.allowWrite !== false,
              allowBash: boolData.allowBash !== false,
              allowWebFetch: boolData.allowWebFetch !== false,
              allowGlob: boolData.allowGlob !== false,
              allowGrep: boolData.allowGrep !== false,
              restrictedPaths: longTextData.restrictedPaths || [],
              allowedCommands: longTextData.allowedCommands
            },
            stats: {
              filesCreated: numberData.filesCreated || 0,
              filesModified: numberData.filesModified || 0,
              filesDeleted: numberData.filesDeleted || 0,
              commandsExecuted: numberData.commandsExecuted || 0,
              sizeBytes: numberData.repositorySizeBytes || 0
            },
            _integramObjectId: obj.id
          });
        } catch (parseError) {
          logger.warn({
            error: parseError.message,
            objectId: obj.id
          }, 'Failed to parse workspace data, skipping');
        }
      }

      logger.info({ count: workspaces.length }, 'Retrieved all workspaces from Integram');
      return workspaces;
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to get all workspaces from Integram');
      return [];
    }
  }

  /**
   * Update workspace last activity timestamp
   * @param {string} integramObjectId - Integram object ID
   */
  async updateWorkspaceActivity(integramObjectId) {
    await this.initialize();

    try {
      await this.integramClient.setRequisites(integramObjectId, {
        [WORKSPACES_TABLE.DATE_FIELD]: new Date().toISOString()
      });

      logger.debug({ integramObjectId }, 'Updated workspace activity');
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId
      }, 'Failed to update workspace activity');
      // Don't throw - non-critical operation
    }
  }

  /**
   * Delete workspace from Integram
   * @param {string} integramObjectId - Integram object ID
   */
  async deleteWorkspace(integramObjectId) {
    await this.initialize();

    try {
      await this.integramClient.deleteObject(integramObjectId);
      logger.info({ integramObjectId }, 'Workspace deleted from Integram');
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId
      }, 'Failed to delete workspace from Integram');
      // Don't throw - best effort
    }
  }

  /**
   * Create session entry in Integram
   * @param {object} session - Session object
   * @returns {Promise<string>} Integram object ID
   */
  async createSession(session) {
    await this.initialize();

    try {
      logger.info({
        sessionId: session.sessionId,
        workspaceId: session.workspaceId,
        filepath: session.filepath
      }, 'Creating session in Integram');

      const textData = {
        sessionId: session.sessionId,
        workspaceId: session.workspaceId,
        filepath: session.filepath,
        userId: session.userId
      };

      const numberData = {
        messageCount: session.messageCount || 0,
        tokensUsed: session.tokensUsed || 0
      };

      const result = await this.integramClient.createObject({
        typeId: SESSIONS_TABLE.TYPE_ID,
        value: `Session: ${session.filepath || 'workspace'}`, // Object name
        requisites: {
          [SESSIONS_TABLE.TEXT_FIELD]: JSON.stringify(textData),
          [SESSIONS_TABLE.DATE_FIELD]: session.createdAt || new Date().toISOString(),
          [SESSIONS_TABLE.NUMBER_FIELD]: JSON.stringify(numberData)
        }
      });

      logger.info({
        integramObjectId: result.id,
        sessionId: session.sessionId
      }, 'Session created successfully in Integram');

      return result.id;
    } catch (error) {
      logger.error({
        error: error.message,
        sessionId: session.sessionId
      }, 'Failed to create session in Integram');
      throw error;
    }
  }

  /**
   * Get sessions for a workspace
   * @param {string} workspaceId - Workspace identifier
   * @returns {Promise<array>} Array of session objects
   */
  async getWorkspaceSessions(workspaceId) {
    await this.initialize();

    try {
      const response = await this.integramClient.getObjects(
        SESSIONS_TABLE.TYPE_ID,
        { LIMIT: 100 }
      );

      const sessions = [];

      for (const obj of response.object || []) {
        const reqs = response.reqs?.[obj.id] || {};

        const textDataStr = reqs[SESSIONS_TABLE.TEXT_FIELD];
        if (!textDataStr) continue;

        try {
          const textData = JSON.parse(textDataStr);

          // Filter by workspaceId
          if (textData.workspaceId !== workspaceId) continue;

          const numberData = reqs[SESSIONS_TABLE.NUMBER_FIELD]
            ? JSON.parse(reqs[SESSIONS_TABLE.NUMBER_FIELD])
            : {};

          sessions.push({
            sessionId: textData.sessionId,
            workspaceId: textData.workspaceId,
            filepath: textData.filepath,
            userId: textData.userId,
            createdAt: reqs[SESSIONS_TABLE.DATE_FIELD] || new Date().toISOString(),
            lastActivity: reqs[SESSIONS_TABLE.DATE_FIELD] || new Date().toISOString(),
            messageCount: numberData.messageCount || 0,
            tokensUsed: numberData.tokensUsed || 0,
            _integramObjectId: obj.id
          });
        } catch (parseError) {
          logger.warn({
            error: parseError.message,
            objectId: obj.id
          }, 'Failed to parse session data, skipping');
        }
      }

      logger.info({ workspaceId, count: sessions.length }, 'Retrieved workspace sessions from Integram');
      return sessions;
    } catch (error) {
      logger.error({
        error: error.message,
        workspaceId
      }, 'Failed to get workspace sessions from Integram');
      return [];
    }
  }

  /**
   * Update session activity
   * @param {string} integramObjectId - Integram object ID
   * @param {object} updates - Updates to apply (messageCount, tokensUsed)
   */
  async updateSessionActivity(integramObjectId, updates = {}) {
    await this.initialize();

    try {
      const requisites = {
        [SESSIONS_TABLE.DATE_FIELD]: new Date().toISOString()
      };

      // If messageCount or tokensUsed provided, update number field
      if (updates.messageCount !== undefined || updates.tokensUsed !== undefined) {
        // Fetch current data first
        const current = await this.integramClient.getEditObject(integramObjectId);
        const currentNumberData = current.reqs?.[SESSIONS_TABLE.NUMBER_FIELD]?.value
          ? JSON.parse(current.reqs[SESSIONS_TABLE.NUMBER_FIELD].value)
          : {};

        const newNumberData = {
          messageCount: updates.messageCount !== undefined ? updates.messageCount : currentNumberData.messageCount || 0,
          tokensUsed: updates.tokensUsed !== undefined ? updates.tokensUsed : currentNumberData.tokensUsed || 0
        };

        requisites[SESSIONS_TABLE.NUMBER_FIELD] = JSON.stringify(newNumberData);
      }

      await this.integramClient.setRequisites(integramObjectId, requisites);

      logger.debug({ integramObjectId }, 'Updated session activity');
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId
      }, 'Failed to update session activity');
      // Don't throw - non-critical operation
    }
  }

  /**
   * Delete session from Integram
   * @param {string} integramObjectId - Integram object ID
   */
  async deleteSession(integramObjectId) {
    await this.initialize();

    try {
      await this.integramClient.deleteObject(integramObjectId);
      logger.info({ integramObjectId }, 'Session deleted from Integram');
    } catch (error) {
      logger.error({
        error: error.message,
        integramObjectId
      }, 'Failed to delete session from Integram');
      // Don't throw - best effort
    }
  }
}

// Export singleton instance
const workspaceIntegramService = new WorkspaceIntegramService();
export default workspaceIntegramService;

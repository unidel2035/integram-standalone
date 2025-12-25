/**
 * WorkspaceService - Manages AI workspaces for tool execution
 * Issue #3600: Implement workspace tool call support
 *
 * This service creates and manages isolated workspaces where AI models
 * can safely execute tools like file operations, code execution, etc.
 *
 * Features:
 * - Workspace creation and lifecycle management
 * - Git repository cloning for context
 * - File system operations within workspace
 * - Safe code execution in sandboxed environment
 * - Session persistence and cleanup
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import clonedRepositoryService from './ClonedRepositoryService.js';
import workspaceIntegramService from './WorkspaceIntegramService.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WorkspaceService
 * Manages isolated workspaces for AI tool execution
 */
class WorkspaceService {
  constructor() {
    this.workspaces = new Map(); // workspaceId → workspace object

    // Issue #4548: Use absolute persistent path for workspaces to survive backend updates
    // Default to /var/lib/drondoc/workspaces for production, or temp directory for development
    const defaultWorkspaceRoot = process.env.NODE_ENV === 'production'
      ? '/var/lib/drondoc/workspaces'
      : path.join(__dirname, '../../../workspaces');

    this.workspaceRoot = process.env.WORKSPACE_ROOT || defaultWorkspaceRoot;
    // JSON file for persistent storage (primary source, Integram as backup)
    this.metadataFile = path.join(this.workspaceRoot, 'workspaces-metadata.json');
    this.maxWorkspaceSize = parseInt(process.env.MAX_WORKSPACE_SIZE || '1073741824'); // 1GB default
    this.cleanupInterval = 3600000; // 1 hour
    this.maxWorkspaceAge = 86400000; // 24 hours

    // Start cleanup timer
    this._startCleanupTimer();
  }

  /**
   * Initialize the service
   * Creates workspace root directory and loads existing workspaces
   */
  async initialize() {
    try {
      // Issue #4548: Log workspace root configuration for debugging
      const isUsingEnvVar = !!process.env.WORKSPACE_ROOT;
      const isProduction = process.env.NODE_ENV === 'production';

      logger.info({
        workspaceRoot: this.workspaceRoot,
        isUsingEnvVar,
        isProduction
      }, '🔧 Workspace Service Configuration');

      if (!isUsingEnvVar && isProduction) {
        logger.warn({
          workspaceRoot: this.workspaceRoot,
          recommendation: 'Set WORKSPACE_ROOT environment variable to persist workspaces across deployments'
        }, '⚠️  Using default workspace root in production - workspaces may be lost during updates!');
      }

      // Create workspace root directory with proper error handling
      try {
        await fs.mkdir(this.workspaceRoot, { recursive: true, mode: 0o755 });
        logger.info({ workspaceRoot: this.workspaceRoot }, '✅ Workspace root directory verified/created');
      } catch (mkdirError) {
        if (mkdirError.code === 'EACCES') {
          logger.error({
            error: mkdirError.message,
            workspaceRoot: this.workspaceRoot,
            currentUser: process.env.USER || 'unknown',
            processUid: process.getuid ? process.getuid() : 'unknown',
            processGid: process.getgid ? process.getgid() : 'unknown'
          }, '❌ Permission denied creating workspace root directory');

          const permissionError = new Error(
            `Permission denied: Cannot create workspace root directory at ${this.workspaceRoot}.\n\n` +
            `Please ensure the Node.js process has write permissions.\n\n` +
            `You may need to run:\n` +
            `  sudo chown -R $USER:$USER ${this.workspaceRoot}\n` +
            `or\n` +
            `  sudo chmod -R 755 ${this.workspaceRoot}\n\n` +
            `Alternatively, set WORKSPACE_ROOT environment variable to a writable directory.`
          );
          permissionError.code = 'EACCES';
          throw permissionError;
        }
        throw mkdirError;
      }

      // Test write permissions by creating a test file
      try {
        const testFile = path.join(this.workspaceRoot, '.write-test');
        await fs.writeFile(testFile, 'test', 'utf-8');
        await fs.unlink(testFile);
        logger.info({ workspaceRoot: this.workspaceRoot }, '✅ Workspace root directory is writable');
      } catch (writeTestError) {
        logger.error({
          error: writeTestError.message,
          workspaceRoot: this.workspaceRoot
        }, '❌ Workspace root directory is not writable');
        throw new Error(
          `Workspace root directory ${this.workspaceRoot} exists but is not writable. ` +
          `Please check permissions: sudo chmod -R 755 ${this.workspaceRoot}`
        );
      }

      // Load existing workspaces from metadata file
      await this._loadWorkspacesMetadata();

      logger.info({ workspaceRoot: this.workspaceRoot, workspacesCount: this.workspaces.size }, 'WorkspaceService initialized');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize WorkspaceService');
      throw error;
    }
  }

  /**
   * Create a new workspace
   * @param {string} userId - User identifier
   * @param {object} options - Workspace options
   * @param {string} options.name - Workspace name
   * @param {string} options.repositoryUrl - Git repository URL to clone (optional)
   * @param {string} options.branch - Git branch to checkout (optional)
   * @param {object} options.toolConfig - Tool configuration (optional)
   * @param {string} options.githubToken - GitHub personal access token for private repos (optional)
   * @param {string} options.integramServer - Integram server hostname (optional, e.g., 'dronedoc.ru')
   * @returns {Promise<object>} Workspace object
   */
  async createWorkspace(userId, options = {}) {
    const workspaceId = uuidv4();
    const workspaceName = options.name || `workspace-${workspaceId.substring(0, 8)}`;

    // Issue #4584: Use {integramServer}_{userId} format for directory names
    // Extract server hostname from integramServer URL if provided
    let userDirectory = userId;
    if (options.integramServer) {
      try {
        // integramServer can be a URL like 'https://dronedoc.ru' or just 'dronedoc.ru'
        const serverName = options.integramServer.replace(/^https?:\/\//, '').replace(/\/$/, '');
        userDirectory = `${serverName}_${userId}`;
        logger.info({ integramServer: options.integramServer, serverName, userDirectory },
          'Using {integramServer}_{userId} directory format');
      } catch (error) {
        logger.warn({ error: error.message, integramServer: options.integramServer },
          'Failed to parse integramServer, falling back to userId only');
        userDirectory = userId;
      }
    }

    const workspacePath = path.join(this.workspaceRoot, userDirectory, workspaceId);

    logger.info({
      workspaceId,
      userId,
      workspaceName,
      workspacePath,
      repositoryUrl: options.repositoryUrl,
      branch: options.branch
    }, '🚀 Starting workspace creation');

    try {
      // Create workspace directory
      logger.info({ workspacePath }, '📁 Creating workspace directory');
      try {
        // First ensure parent directory exists with proper permissions
        const userDir = path.join(this.workspaceRoot, userId);
        try {
          await fs.mkdir(userDir, { recursive: true, mode: 0o755 });
          logger.info({ userDir }, '✅ User directory ensured');
        } catch (userDirError) {
          logger.warn({ error: userDirError.message, userDir }, '⚠️ Could not ensure user directory');
        }

        // Now create the workspace directory
        await fs.mkdir(workspacePath, { recursive: true, mode: 0o755 });
        logger.info({ workspacePath }, '✅ Workspace directory created');
      } catch (mkdirError) {
        // Handle permission errors with helpful message
        if (mkdirError.code === 'EACCES') {
          logger.error({
            error: mkdirError.message,
            workspacePath,
            workspaceRoot: this.workspaceRoot,
            currentUser: process.env.USER || 'unknown',
            processUid: process.getuid ? process.getuid() : 'unknown',
            processGid: process.getgid ? process.getgid() : 'unknown'
          }, '❌ Permission denied creating workspace directory');

          const permissionError = new Error(
            `Permission denied: Cannot create workspace directory at ${workspacePath}.\n\n` +
            `Please ensure the Node.js process has write permissions to ${this.workspaceRoot}.\n\n` +
            `You may need to run:\n` +
            `  sudo chown -R $USER:$USER ${this.workspaceRoot}\n` +
            `or\n` +
            `  sudo chmod -R 755 ${this.workspaceRoot}\n\n` +
            `Alternatively, set WORKSPACE_ROOT environment variable to a writable directory.`
          );
          permissionError.code = 'EACCES';
          permissionError.path = workspacePath;
          throw permissionError;
        }
        // Re-throw other errors
        throw mkdirError;
      }

      // Clone repository if provided and not empty
      let repositoryInfo = null;
      const hasRepositoryUrl = options.repositoryUrl && typeof options.repositoryUrl === 'string' && options.repositoryUrl.trim();
      if (hasRepositoryUrl) {
        logger.info({ repositoryUrl: options.repositoryUrl, workspacePath }, '🔄 Starting repository clone with validation');

        // Step 1: Validate URL format (Issue #4426)
        logger.info({ repositoryUrl: options.repositoryUrl }, '🔍 Validating repository URL');
        const validation = clonedRepositoryService.validateRepositoryUrl(options.repositoryUrl);
        if (!validation.isValid) {
          logger.error({
            repositoryUrl: options.repositoryUrl,
            error: validation.error,
            suggestedUrl: validation.normalizedUrl
          }, '❌ Repository URL validation failed');
          const error = new Error(validation.error);
          if (validation.normalizedUrl) {
            error.suggestedUrl = validation.normalizedUrl;
          }
          throw error;
        }
        logger.info({ normalizedUrl: validation.normalizedUrl }, '✅ Repository URL validated');

        // Step 2: Check user clone limits (Issue #4426, #4494)
        // Non-blocking: If Integram is unavailable, continue with workspace creation
        logger.info({ userId }, '🔍 Checking user clone limits');
        try {
          await clonedRepositoryService.checkUserCloneLimits(userId);
          logger.info({ userId }, '✅ User clone limits check passed');
        } catch (limitError) {
          logger.warn({
            error: limitError.message,
            userId
          }, '⚠️ Clone limits check failed (non-blocking)');
          // Continue with workspace creation even if limits check fails
        }

        // Step 3: Clone repository
        logger.info({ repositoryUrl: validation.normalizedUrl, workspacePath }, '🔄 Cloning repository');
        repositoryInfo = await this._cloneRepository(
          validation.normalizedUrl,
          workspacePath,
          options.branch,
          options.githubToken // Issue #4494: Pass GitHub token for authentication
        );
        logger.info({ repositoryInfo }, '✅ Repository cloned successfully');

        // Step 4: Validate repository size constraints (Issue #4426)
        logger.info({ fileCount: repositoryInfo.fileCount }, '🔍 Validating repository size');
        clonedRepositoryService.validateRepositorySize({
          fileCount: repositoryInfo.fileCount,
          sizeBytes: repositoryInfo.sizeBytes || 0
        });
        logger.info({ fileCount: repositoryInfo.fileCount }, '✅ Repository size validation passed');

        // Step 5: Store cloned repository metadata in Integram (Issue #4426)
        logger.info({ workspaceId, repositoryUrl: validation.normalizedUrl }, '💾 Storing cloned repository metadata in Integram');
        try {
          await clonedRepositoryService.storeClonedRepository({
            userId,
            workspaceId,
            repositoryUrl: validation.normalizedUrl,
            branch: repositoryInfo.branch,
            commitHash: repositoryInfo.commitHash,
            fileCount: repositoryInfo.fileCount,
            sizeBytes: repositoryInfo.sizeBytes || 0,
            workspacePath
          });
          logger.info({ workspaceId }, '✅ Cloned repository metadata stored in Integram');
        } catch (integramError) {
          logger.error({
            error: integramError.message,
            workspaceId,
            repositoryUrl: validation.normalizedUrl
          }, '⚠️ Failed to store cloned repository in Integram (non-blocking)');
          // Don't fail workspace creation if Integram storage fails
        }
      }

      // Create workspace metadata
      const workspace = {
        id: workspaceId,
        name: workspaceName,
        userId,
        integramServer: options.integramServer || null, // Issue #4584: Store integram server
        path: workspacePath,
        repositoryUrl: options.repositoryUrl || null,
        repositoryInfo,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        toolConfig: {
          allowRead: true,
          allowWrite: true,
          allowBash: true,
          allowWebFetch: true,
          allowGlob: true,
          allowGrep: true,
          restrictedPaths: ['/etc', '/sys', '/proc'], // System paths
          allowedCommands: null, // null = all commands allowed
          ...(options.toolConfig || {})
        },
        stats: {
          filesCreated: 0,
          filesModified: 0,
          filesDeleted: 0,
          commandsExecuted: 0,
          sizeBytes: 0
        }
      };

      this.workspaces.set(workspaceId, workspace);

      // Save to JSON file (primary storage)
      await this._saveWorkspacesMetadata();

      // Also save to Integram (backup)
      try {
        const integramObjectId = await workspaceIntegramService.createWorkspace(workspace);
        workspace._integramObjectId = integramObjectId;
        logger.debug({ workspaceId, integramObjectId }, 'Workspace saved to Integram');
      } catch (integramError) {
        logger.warn({ error: integramError.message }, 'Failed to save to Integram (non-critical)');
      }

      logger.info({
        workspaceId,
        userId,
        workspaceName,
        workspacePath,
        repositoryUrl: workspace.repositoryUrl,
        hasRepository: !!repositoryInfo
      }, '🎉 Workspace created successfully');

      return workspace;
    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        workspaceId,
        workspacePath,
        repositoryUrl: options.repositoryUrl
      }, '❌ Failed to create workspace');
      throw error;
    }
  }

  /**
   * Get workspace by ID
   * @param {string} workspaceId - Workspace identifier
   * @returns {object|null} Workspace object or null
   */
  getWorkspace(workspaceId) {
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * Check if user has access to workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} userId - User identifier
   * @returns {boolean} True if user has access
   */
  hasAccess(workspaceId, userId) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      return false;
    }
    // User has access if they own the workspace
    return workspace.userId === userId;
  }

  /**
   * Update workspace owner (Issue #4590: Fix workspaces with wrong userId)
   * @param {string} workspaceId - Workspace identifier
   * @param {string} newUserId - New user identifier
   * @returns {Promise<boolean>} True if updated successfully
   */
  async updateWorkspaceOwner(workspaceId, newUserId) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for owner update');
      return false;
    }

    const oldUserId = workspace.userId;
    workspace.userId = newUserId;

    // Issue #4828: Update in Integram database
    if (workspace._integramObjectId) {
      await workspaceIntegramService.updateWorkspace(workspace._integramObjectId, workspace);
    }

    logger.info({
      workspaceId,
      oldUserId,
      newUserId,
      workspaceName: workspace.name
    }, '✅ Workspace owner updated successfully');

    return true;
  }

  /**
   * Get all workspaces for a user
   * @param {string} userId - User identifier
   * @returns {array} Array of workspace objects
   */
  getUserWorkspaces(userId) {
    const workspaces = [];
    for (const [workspaceId, workspace] of this.workspaces.entries()) {
      if (workspace.userId === userId) {
        workspaces.push({
          id: workspace.id,
          name: workspace.name,
          createdAt: workspace.createdAt,
          lastActivity: workspace.lastActivity,
          repositoryUrl: workspace.repositoryUrl,
          stats: workspace.stats
        });
      }
    }
    return workspaces;
  }

  /**
   * Update workspace last activity timestamp
   * @param {string} workspaceId - Workspace identifier
   */
  async touchWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivity = new Date().toISOString();

      // Issue #4828 Phase 2: Update activity in Integram (non-blocking)
      if (workspace._integramObjectId) {
        try {
          await workspaceIntegramService.updateWorkspaceActivity(workspace._integramObjectId);
        } catch (integramError) {
          logger.debug({
            error: integramError.message,
            workspaceId
          }, '⚠️ Failed to update workspace activity in Integram (non-blocking)');
          // Don't fail - this is a non-critical operation
        }
      }
    }
  }

  /**
   * Get workspace file tree
   * @param {string} workspaceId - Workspace identifier
   * @param {string} relativePath - Relative path within workspace
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Promise<object>} File tree object
   */
  async getFileTree(workspaceId, relativePath = '', maxDepth = 3) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for file tree');
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const targetPath = path.join(workspace.path, relativePath);

    logger.info({
      workspaceId,
      workspaceName: workspace.name,
      relativePath,
      targetPath,
      maxDepth
    }, '🌳 Building file tree');

    try {
      const tree = await this._buildFileTree(targetPath, maxDepth, 0);
      const fileCount = this._countFilesInTree(tree);

      logger.info({
        workspaceId,
        relativePath,
        fileCount,
        maxDepth
      }, '✅ File tree built successfully');

      return tree;
    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        workspaceId,
        relativePath,
        targetPath
      }, '❌ Failed to get file tree');
      throw error;
    }
  }

  /**
   * Count files in tree (helper for logging)
   * @private
   */
  _countFilesInTree(tree) {
    if (!tree || !tree.children) return 0;
    let count = 0;
    for (const child of tree.children) {
      if (child.type === 'file') {
        count++;
      } else if (child.type === 'directory' && child.children) {
        count += this._countFilesInTree(child);
      }
    }
    return count;
  }

  /**
   * Read file from workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} filepath - Relative file path
   * @returns {Promise<string>} File content
   */
  async readFile(workspaceId, filepath) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for file read');
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowRead) {
      logger.warn({ workspaceId, filepath }, '⛔ Read operation not allowed');
      throw new Error('Read operation not allowed for this workspace');
    }

    const targetPath = this._resolvePath(workspace.path, filepath);

    logger.info({
      workspaceId,
      workspaceName: workspace.name,
      filepath,
      targetPath
    }, '📖 Reading file');

    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      const size = Buffer.byteLength(content, 'utf-8');

      logger.info({
        workspaceId,
        filepath,
        size,
        preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      }, '✅ File read successfully');

      this.touchWorkspace(workspaceId);
      return content;
    } catch (error) {
      logger.error({
        error: error.message,
        code: error.code,
        workspaceId,
        filepath,
        targetPath
      }, '❌ Failed to read file');
      throw error;
    }
  }

  /**
   * Write file to workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} filepath - Relative file path
   * @param {string} content - File content
   * @returns {Promise<object>} Write result
   */
  async writeFile(workspaceId, filepath, content) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for file write');
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowWrite) {
      logger.warn({ workspaceId, filepath }, '⛔ Write operation not allowed');
      throw new Error('Write operation not allowed for this workspace');
    }

    const targetPath = this._resolvePath(workspace.path, filepath);
    const isNewFile = !(await this._fileExists(targetPath));

    logger.info({
      workspaceId,
      workspaceName: workspace.name,
      filepath,
      targetPath,
      isNewFile,
      contentSize: Buffer.byteLength(content, 'utf-8')
    }, `📝 ${isNewFile ? 'Creating' : 'Modifying'} file`);

    try {
      // Create directory if it doesn't exist
      const dirPath = path.dirname(targetPath);
      logger.info({ dirPath }, '📁 Ensuring directory exists');
      await fs.mkdir(dirPath, { recursive: true });

      await fs.writeFile(targetPath, content, 'utf-8');

      // Update stats
      if (isNewFile) {
        workspace.stats.filesCreated++;
      } else {
        workspace.stats.filesModified++;
      }

      this.touchWorkspace(workspaceId);

      logger.info({
        workspaceId,
        filepath,
        isNewFile,
        stats: workspace.stats
      }, `✅ File ${isNewFile ? 'created' : 'modified'} successfully`);

      return { success: true, filepath, isNewFile };
    } catch (error) {
      logger.error({
        error: error.message,
        code: error.code,
        workspaceId,
        filepath,
        targetPath
      }, '❌ Failed to write file');
      throw error;
    }
  }

  /**
   * Delete file from workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} filepath - File path relative to workspace root
   * @returns {Promise<object>} Delete result
   */
  async deleteFile(workspaceId, filepath) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for file deletion');
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowWrite) {
      logger.warn({ workspaceId, filepath }, '⛔ Write operation (delete) not allowed');
      throw new Error('Write operation not allowed for this workspace');
    }

    const targetPath = this._resolvePath(workspace.path, filepath);

    logger.info({
      workspaceId,
      workspaceName: workspace.name,
      filepath,
      targetPath
    }, '🗑️ Deleting file');

    try {
      // Check if file exists
      const exists = await this._fileExists(targetPath);
      if (!exists) {
        logger.warn({ workspaceId, filepath }, '⚠️ File does not exist');
        throw new Error(`File not found: ${filepath}`);
      }

      // Get file stats to check if it's a directory
      const stats = await fs.stat(targetPath);
      if (stats.isDirectory()) {
        logger.error({ workspaceId, filepath }, '❌ Cannot delete directory, only files');
        throw new Error('Cannot delete directory, use a different method');
      }

      await fs.unlink(targetPath);

      // Update stats
      workspace.stats.filesModified++;
      this.touchWorkspace(workspaceId);

      logger.info({
        workspaceId,
        filepath,
        stats: workspace.stats
      }, '✅ File deleted successfully');

      return { success: true, filepath };
    } catch (error) {
      logger.error({
        error: error.message,
        code: error.code,
        workspaceId,
        filepath,
        targetPath
      }, '❌ Failed to delete file');
      throw error;
    }
  }

  /**
   * Execute command in workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} command - Command to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result
   */
  async executeCommand(workspaceId, command, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      logger.error({ workspaceId }, '❌ Workspace not found for command execution');
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowBash) {
      logger.warn({ workspaceId, command }, '⛔ Bash execution not allowed');
      throw new Error('Bash execution not allowed for this workspace');
    }

    // Security check: block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\/[^\/]/, // rm -rf /
      /:(){ :|:& };:/, // Fork bomb
      /mkfs/, // Format filesystem
      /dd\s+if=.*of=\/dev/, // Disk operations
      /\/dev\/sd[a-z]/, // Direct disk access
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        logger.error({ workspaceId, command }, '🚨 Dangerous command detected');
        throw new Error(`Dangerous command detected: ${command}`);
      }
    }

    logger.info({
      workspaceId,
      workspaceName: workspace.name,
      command,
      cwd: workspace.path,
      timeout: options.timeout || 30000
    }, '⚙️  Executing command');

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspace.path,
        timeout: options.timeout || 30000, // 30s default
        maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB
        env: {
          ...process.env,
          WORKSPACE_ID: workspaceId,
          WORKSPACE_PATH: workspace.path
        }
      });
      const duration = Date.now() - startTime;

      workspace.stats.commandsExecuted++;
      this.touchWorkspace(workspaceId);

      logger.info({
        workspaceId,
        command,
        duration,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        stats: workspace.stats
      }, '✅ Command executed successfully');

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error) {
      logger.error({
        error: error.message,
        code: error.code,
        workspaceId,
        command,
        stdout: error.stdout ? error.stdout.substring(0, 500) : '',
        stderr: error.stderr ? error.stderr.substring(0, 500) : ''
      }, '❌ Command execution failed');

      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Search files in workspace using glob pattern
   * @param {string} workspaceId - Workspace identifier
   * @param {string} pattern - Glob pattern
   * @returns {Promise<array>} Array of matching file paths
   */
  async globFiles(workspaceId, pattern) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowGlob) {
      throw new Error('Glob operation not allowed for this workspace');
    }

    try {
      const { stdout } = await execAsync(`find . -name "${pattern}" -type f`, {
        cwd: workspace.path
      });

      const files = stdout.trim().split('\n').filter(f => f);
      this.touchWorkspace(workspaceId);

      return files.map(f => f.replace(/^\.\//, ''));
    } catch (error) {
      logger.error({ error: error.message, workspaceId, pattern }, 'Failed to glob files');
      throw error;
    }
  }

  /**
   * Search file content using grep
   * @param {string} workspaceId - Workspace identifier
   * @param {string} pattern - Search pattern
   * @param {object} options - Search options
   * @returns {Promise<array>} Array of matches
   */
  async grepFiles(workspaceId, pattern, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!workspace.toolConfig.allowGrep) {
      throw new Error('Grep operation not allowed for this workspace');
    }

    try {
      const grepCommand = `grep -r ${options.ignoreCase ? '-i' : ''} -n "${pattern}" .`;
      const { stdout } = await execAsync(grepCommand, {
        cwd: workspace.path
      });

      const matches = stdout.trim().split('\n').filter(line => line).map(line => {
        const [filepath, ...rest] = line.split(':');
        const lineNumber = rest[0];
        const content = rest.slice(1).join(':');

        return {
          filepath: filepath.replace(/^\.\//, ''),
          lineNumber: parseInt(lineNumber),
          content: content.trim()
        };
      });

      this.touchWorkspace(workspaceId);
      return matches;
    } catch (error) {
      // Grep returns exit code 1 when no matches found
      if (error.code === 1) {
        return [];
      }
      logger.error({ error: error.message, workspaceId, pattern }, 'Failed to grep files');
      throw error;
    }
  }

  /**
   * Get Git status for workspace
   * @param {string} workspaceId - Workspace identifier
   * @returns {Promise<object>} Git status
   */
  async getGitStatus(workspaceId) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    try {
      const { stdout: statusOut } = await execAsync('git status --porcelain', {
        cwd: workspace.path
      });

      const { stdout: branchOut } = await execAsync('git branch --show-current', {
        cwd: workspace.path
      });

      const files = statusOut.trim().split('\n').filter(line => line).map(line => {
        const status = line.substring(0, 2).trim();
        const filepath = line.substring(3);
        return { status, filepath };
      });

      return {
        branch: branchOut.trim(),
        files,
        hasChanges: files.length > 0
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to get Git status');
      throw error;
    }
  }

  /**
   * Git pull - fetch and merge latest changes
   * @param {string} workspaceId - Workspace identifier
   * @param {object} options - Pull options
   * @param {string} options.remote - Remote name (default: origin)
   * @param {string} options.branch - Branch name (default: current branch)
   * @returns {Promise<object>} Pull result
   */
  async gitPull(workspaceId, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const { remote = 'origin', branch = null } = options;

    try {
      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        const { stdout: currentBranch } = await execAsync('git branch --show-current', {
          cwd: workspace.path
        });
        targetBranch = currentBranch.trim();
      }

      // Execute git pull
      const pullCommand = `git pull ${remote} ${targetBranch}`;
      const { stdout, stderr } = await execAsync(pullCommand, {
        cwd: workspace.path,
        timeout: 60000 // 1 minute timeout
      });

      logger.info({ workspaceId, remote, branch: targetBranch }, 'Git pull completed');

      return {
        success: true,
        remote,
        branch: targetBranch,
        output: stdout || stderr,
        message: 'Successfully pulled latest changes'
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git pull');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git commit - commit staged changes
   * @param {string} workspaceId - Workspace identifier
   * @param {string} message - Commit message
   * @param {object} options - Commit options
   * @param {boolean} options.addAll - Stage all changes before commit (default: false)
   * @returns {Promise<object>} Commit result
   */
  async gitCommit(workspaceId, message, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    if (!message || message.trim() === '') {
      throw new Error('Commit message is required');
    }

    const { addAll = false } = options;

    try {
      // Stage all changes if requested
      if (addAll) {
        await execAsync('git add -A', {
          cwd: workspace.path
        });
      }

      // Commit changes
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: workspace.path
      });

      // Get commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', {
        cwd: workspace.path
      });

      logger.info({ workspaceId, message, commitHash: commitHash.trim() }, 'Git commit completed');

      return {
        success: true,
        commitHash: commitHash.trim(),
        message,
        output: stdout
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git commit');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git push - push commits to remote
   * @param {string} workspaceId - Workspace identifier
   * @param {object} options - Push options
   * @param {string} options.remote - Remote name (default: origin)
   * @param {string} options.branch - Branch name (default: current branch)
   * @param {boolean} options.force - Force push (default: false)
   * @returns {Promise<object>} Push result
   */
  async gitPush(workspaceId, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const { remote = 'origin', branch = null, force = false } = options;

    try {
      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        const { stdout: currentBranch } = await execAsync('git branch --show-current', {
          cwd: workspace.path
        });
        targetBranch = currentBranch.trim();
      }

      // Execute git push
      const forceFlag = force ? ' --force' : '';
      const pushCommand = `git push ${remote} ${targetBranch}${forceFlag}`;
      const { stdout, stderr } = await execAsync(pushCommand, {
        cwd: workspace.path,
        timeout: 120000 // 2 minutes timeout
      });

      logger.info({ workspaceId, remote, branch: targetBranch, force }, 'Git push completed');

      return {
        success: true,
        remote,
        branch: targetBranch,
        output: stdout || stderr,
        message: 'Successfully pushed commits'
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git push');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git diff - show changes
   * @param {string} workspaceId - Workspace identifier
   * @param {object} options - Diff options
   * @param {string} options.filepath - Specific file to diff (optional)
   * @param {boolean} options.staged - Show staged changes only (default: false)
   * @returns {Promise<object>} Diff result
   */
  async gitDiff(workspaceId, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const { filepath = '', staged = false } = options;

    try {
      // Build diff command
      const stagedFlag = staged ? '--staged' : '';
      const diffCommand = `git diff ${stagedFlag} ${filepath}`.trim();

      const { stdout } = await execAsync(diffCommand, {
        cwd: workspace.path
      });

      return {
        success: true,
        diff: stdout,
        filepath: filepath || 'all files',
        staged,
        hasChanges: stdout.trim().length > 0
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git diff');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git clone repository into workspace
   * @param {string} workspaceId - Workspace identifier
   * @param {string} repositoryUrl - Git repository URL
   * @param {object} options - Clone options
   * @param {string} options.branch - Branch to clone (optional)
   * @param {string} options.token - Git token for authentication (optional)
   * @returns {Promise<object>} Clone result
   */
  async gitClone(workspaceId, repositoryUrl, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const { branch = null, token = null } = options;

    try {
      // Build repository URL with token if provided
      let authUrl = repositoryUrl;
      if (token && repositoryUrl.startsWith('https://')) {
        // Insert token into URL: https://token@github.com/...
        authUrl = repositoryUrl.replace('https://', `https://${token}@`);
      }

      // Clone repository
      const repoInfo = await this._cloneRepository(authUrl, workspace.path, branch);

      // Update workspace metadata
      workspace.repositoryUrl = repositoryUrl; // Store original URL without token
      workspace.branch = repoInfo.branch;
      workspace.lastCommit = repoInfo.commitHash;
      workspace.clonedAt = repoInfo.clonedAt;

      // Issue #4828: Update in Integram database
      if (workspace._integramObjectId) {
        await workspaceIntegramService.updateWorkspace(workspace._integramObjectId, workspace);
      }

      return {
        success: true,
        repositoryUrl,
        branch: repoInfo.branch,
        commitHash: repoInfo.commitHash,
        fileCount: repoInfo.fileCount,
        message: 'Repository cloned successfully'
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId, repositoryUrl }, 'Failed to git clone');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git checkout - switch branch or restore files
   * @param {string} workspaceId - Workspace identifier
   * @param {string} target - Branch name or file path
   * @param {object} options - Checkout options
   * @param {boolean} options.createBranch - Create new branch (default: false)
   * @returns {Promise<object>} Checkout result
   */
  async gitCheckout(workspaceId, target, options = {}) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const { createBranch = false } = options;

    try {
      // Build checkout command
      const createFlag = createBranch ? '-b' : '';
      const checkoutCommand = `git checkout ${createFlag} ${target}`.trim();

      const { stdout, stderr } = await execAsync(checkoutCommand, {
        cwd: workspace.path
      });

      logger.info({ workspaceId, target, createBranch }, 'Git checkout completed');

      return {
        success: true,
        target,
        output: stdout || stderr,
        message: createBranch ? `Created and switched to branch ${target}` : `Switched to ${target}`
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git checkout');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Git add - stage files for commit
   * @param {string} workspaceId - Workspace identifier
   * @param {string|array} files - File path(s) to stage, or '.' for all files
   * @returns {Promise<object>} Add result
   */
  async gitAdd(workspaceId, files) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    try {
      // Convert array to space-separated string
      const fileList = Array.isArray(files) ? files.join(' ') : files;

      const { stdout, stderr } = await execAsync(`git add ${fileList}`, {
        cwd: workspace.path
      });

      logger.info({ workspaceId, files: fileList }, 'Git add completed');

      return {
        success: true,
        files: fileList,
        output: stdout || stderr,
        message: 'Files staged successfully'
      };
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to git add');
      return {
        success: false,
        error: error.message,
        stderr: error.stderr
      };
    }
  }

  /**
   * Delete workspace
   * @param {string} workspaceId - Workspace identifier
   */
  async deleteWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return;
    }

    try {
      await fs.rm(workspace.path, { recursive: true, force: true });
      this.workspaces.delete(workspaceId);

      // Save to JSON file
      await this._saveWorkspacesMetadata();

      // Delete from Integram (backup)
      if (workspace._integramObjectId) {
        try {
          await workspaceIntegramService.deleteWorkspace(workspace._integramObjectId);
        } catch (integramError) {
          logger.warn({ error: integramError.message }, 'Failed to delete from Integram (non-critical)');
        }
      }

      logger.info({ workspaceId }, 'Deleted workspace');
    } catch (error) {
      logger.error({ error: error.message, workspaceId }, 'Failed to delete workspace');
      throw error;
    }
  }

  /**
   * Clean up old workspaces
   * @private
   */
  async _cleanupOldWorkspaces() {
    const now = Date.now();
    const workspacesToDelete = [];

    for (const [workspaceId, workspace] of this.workspaces.entries()) {
      const lastActivity = new Date(workspace.lastActivity).getTime();
      const age = now - lastActivity;

      if (age > this.maxWorkspaceAge) {
        workspacesToDelete.push(workspaceId);
      }
    }

    for (const workspaceId of workspacesToDelete) {
      try {
        await this.deleteWorkspace(workspaceId);
        logger.info({ workspaceId }, 'Cleaned up old workspace');
      } catch (error) {
        logger.error({ error: error.message, workspaceId }, 'Failed to cleanup workspace');
      }
    }

    if (workspacesToDelete.length > 0) {
      logger.info({ count: workspacesToDelete.length }, 'Workspace cleanup completed');
    }
  }

  /**
   * Start cleanup timer
   * @private
   */
  _startCleanupTimer() {
    setInterval(() => {
      this._cleanupOldWorkspaces().catch(error => {
        logger.error({ error: error.message }, 'Workspace cleanup failed');
      });
    }, this.cleanupInterval);
  }

  /**
   * Validate and normalize repository URL
   * Handles common mistakes like providing PR URLs instead of repo URLs
   * @private
   * @param {string} url - Repository URL to validate
   * @returns {object} { isValid: boolean, normalizedUrl: string, error: string }
   */
  _validateAndNormalizeRepositoryUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'URL is required and must be a string'
      };
    }

    const trimmedUrl = url.trim();

    // If URL is empty after trimming, return error
    if (!trimmedUrl) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'Repository URL cannot be empty'
      };
    }

    // Check if URL is a GitHub pull request URL (common mistake)
    // Pattern: https://github.com/owner/repo/pull/123
    const githubPrPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/\d+/i;
    const prMatch = trimmedUrl.match(githubPrPattern);

    if (prMatch) {
      const owner = prMatch[1];
      const repo = prMatch[2];
      const repoUrl = `https://github.com/${owner}/${repo}.git`;

      return {
        isValid: false,
        normalizedUrl: repoUrl,
        error: `Cannot clone from pull request URL. Did you mean the repository URL? Try: ${repoUrl}`
      };
    }

    // Check if URL is a GitHub issue URL (another common mistake)
    // Pattern: https://github.com/owner/repo/issues/123
    const githubIssuePattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/\d+/i;
    const issueMatch = trimmedUrl.match(githubIssuePattern);

    if (issueMatch) {
      const owner = issueMatch[1];
      const repo = issueMatch[2];
      const repoUrl = `https://github.com/${owner}/${repo}.git`;

      return {
        isValid: false,
        normalizedUrl: repoUrl,
        error: `Cannot clone from issue URL. Did you mean the repository URL? Try: ${repoUrl}`
      };
    }

    // Check if URL looks like a website URL (common mistake)
    // Pattern: https://dev.drondoc.ru/... or http://example.com/...
    const websitePattern = /^https?:\/\/(?!github\.com|gitlab\.com|bitbucket\.org)/i;
    if (websitePattern.test(trimmedUrl) && !trimmedUrl.endsWith('.git')) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: `This appears to be a website URL, not a Git repository URL. Expected formats: https://github.com/user/repo.git, https://github.com/user/repo, git@github.com:user/repo.git`
      };
    }

    // Valid Git URL patterns
    const gitUrlPatterns = [
      /^https?:\/\/.+\.git$/i,                     // https://github.com/user/repo.git
      /^https?:\/\/(github|gitlab|bitbucket)\.com\/[^\/]+\/[^\/]+$/i, // https://github.com/user/repo
      /^git@.+:.+\.git$/i,                         // git@github.com:user/repo.git
      /^git@.+:.+$/i,                              // git@github.com:user/repo (without .git)
      /^ssh:\/\/.+\.git$/i                         // ssh://git@github.com/user/repo.git
    ];

    const isValid = gitUrlPatterns.some(pattern => pattern.test(trimmedUrl));

    if (!isValid) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'Invalid Git repository URL format. Expected formats: ' +
               'https://github.com/user/repo.git, ' +
               'https://github.com/user/repo, ' +
               'git@github.com:user/repo.git, ' +
               'or similar formats for GitLab/Bitbucket'
      };
    }

    return {
      isValid: true,
      normalizedUrl: trimmedUrl,
      error: null
    };
  }

  /**
   * Clone Git repository
   * @private
   */
  async _cloneRepository(repositoryUrl, workspacePath, branch = null, githubToken = null) {
    // Validate and normalize repository URL first
    const validation = this._validateAndNormalizeRepositoryUrl(repositoryUrl);

    if (!validation.isValid) {
      const error = new Error(validation.error);
      error.suggestedUrl = validation.normalizedUrl;
      throw error;
    }

    let normalizedUrl = validation.normalizedUrl;

    // Issue #4494: Embed GitHub token in URL for authentication if provided
    // This allows cloning private repositories using Personal Access Token
    if (githubToken && normalizedUrl.includes('github.com')) {
      // Convert HTTPS URL to authenticated format: https://TOKEN@github.com/user/repo.git
      normalizedUrl = normalizedUrl.replace(
        /https:\/\/(github\.com)/,
        `https://${githubToken}@$1`
      );
      logger.info({
        hasToken: true,
        tokenLength: githubToken.length
      }, '🔐 GitHub token provided, using authenticated clone');
    }

    const cloneCommand = branch
      ? `git clone --branch ${branch} --single-branch ${normalizedUrl} .`
      : `git clone ${normalizedUrl} .`;

    // Mask token in logs
    const logCommand = githubToken
      ? cloneCommand.replace(githubToken, '***TOKEN***')
      : cloneCommand;

    logger.info({
      originalUrl: repositoryUrl,
      workspacePath,
      branch,
      command: logCommand, // Use masked command for logging
      hasGitHubToken: !!githubToken
    }, '🔄 Executing git clone command');

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(cloneCommand, {
        cwd: workspacePath,
        timeout: 120000 // 2 minutes for cloning
      });
      const duration = Date.now() - startTime;

      logger.info({
        repositoryUrl: normalizedUrl,
        duration,
        stdout: stdout.substring(0, 500), // Log first 500 chars
        stderr: stderr ? stderr.substring(0, 500) : null
      }, '✅ Git clone completed');

      // Get repository info
      logger.info({ workspacePath }, '🔍 Getting repository info (commit hash, branch)');
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', {
        cwd: workspacePath
      });

      const { stdout: remoteBranch } = await execAsync('git branch --show-current', {
        cwd: workspacePath
      });

      // Count files in repository
      const { stdout: fileCount } = await execAsync('find . -type f | wc -l', {
        cwd: workspacePath
      });

      // Get repository size in bytes (Issue #4426)
      let sizeBytes = 0;
      try {
        const { stdout: sizeOutput } = await execAsync('du -sb . | cut -f1', {
          cwd: workspacePath
        });
        sizeBytes = parseInt(sizeOutput.trim()) || 0;
        logger.info({ sizeBytes, sizeMB: Math.round(sizeBytes / 1024 / 1024) }, '📊 Repository size calculated');
      } catch (sizeError) {
        logger.warn({ error: sizeError.message }, '⚠️ Failed to calculate repository size, using 0');
      }

      const repoInfo = {
        commitHash: commitHash.trim(),
        branch: remoteBranch.trim(),
        clonedAt: new Date().toISOString(),
        fileCount: parseInt(fileCount.trim()),
        sizeBytes,
        cloneDuration: duration
      };

      logger.info({
        repositoryUrl: normalizedUrl,
        repoInfo
      }, '✅ Repository cloned and verified');

      return repoInfo;
    } catch (error) {
      logger.error({
        error: error.message,
        stderr: error.stderr,
        stdout: error.stdout,
        code: error.code,
        repositoryUrl: normalizedUrl,
        workspacePath,
        command: cloneCommand
      }, '❌ Failed to clone repository');
      throw error;
    }
  }

  /**
   * Build file tree recursively
   * @private
   */
  async _buildFileTree(dirPath, maxDepth, currentDepth, basePath = null) {
    if (currentDepth >= maxDepth) {
      return null;
    }

    // Use dirPath as basePath for root level
    const rootPath = basePath || dirPath;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Calculate relative path from workspace root
      const relativePath = dirPath === rootPath ? '' : path.relative(rootPath, dirPath);

      const tree = {
        name: path.basename(dirPath),
        path: relativePath || '.',
        type: 'directory',
        children: []
      };

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') && entry.name !== '.') {
          continue;
        }
        if (entry.name === 'node_modules' || entry.name === '__pycache__') {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.relative(rootPath, entryPath);

        if (entry.isDirectory()) {
          const subtree = await this._buildFileTree(entryPath, maxDepth, currentDepth + 1, rootPath);
          if (subtree) {
            tree.children.push(subtree);
          }
        } else {
          const stats = await fs.stat(entryPath);
          tree.children.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      }

      return tree;
    } catch (error) {
      logger.error({ error: error.message, dirPath }, 'Failed to build file tree');
      return null;
    }
  }

  /**
   * Resolve relative path within workspace
   * @private
   */
  _resolvePath(workspacePath, relativePath) {
    const resolved = path.resolve(workspacePath, relativePath);

    // Security check: ensure path is within workspace
    if (!resolved.startsWith(workspacePath)) {
      throw new Error('Path traversal detected');
    }

    return resolved;
  }

  /**
   * Check if file exists
   * @private
   */
  async _fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load workspaces from JSON file (primary) and Integram (backup)
   * @private
   */
  async _loadWorkspacesMetadata() {
    let loadedFromJson = false;

    // Try loading from JSON file first (primary source)
    try {
      const jsonExists = await this._fileExists(this.metadataFile);
      if (jsonExists) {
        const jsonData = await fs.readFile(this.metadataFile, 'utf-8');
        const workspacesArray = JSON.parse(jsonData);

        for (const workspace of workspacesArray) {
          const dirExists = await this._fileExists(workspace.path);
          if (dirExists) {
            this.workspaces.set(workspace.id, workspace);
          } else {
            logger.warn({ workspaceId: workspace.id, path: workspace.path }, 'Workspace directory not found - skipping');
          }
        }

        logger.info({ count: this.workspaces.size, source: 'JSON' }, '✅ Loaded workspaces from JSON file');
        loadedFromJson = true;
      }
    } catch (error) {
      logger.warn({ error: error.message }, '⚠️ Failed to load from JSON, trying Integram');
    }

    // If JSON failed or empty, try Integram as backup
    if (!loadedFromJson || this.workspaces.size === 0) {
      try {
        const integramWorkspaces = await workspaceIntegramService.getAllWorkspaces();

        if (integramWorkspaces && integramWorkspaces.length > 0) {
          for (const workspace of integramWorkspaces) {
            const dirExists = await this._fileExists(workspace.path);
            if (dirExists) {
              this.workspaces.set(workspace.id, workspace);
            }
          }
          logger.info({ count: this.workspaces.size, source: 'Integram' }, '✅ Loaded workspaces from Integram');

          // Save to JSON for next time
          await this._saveWorkspacesMetadata();
        }
      } catch (error) {
        logger.warn({ error: error.message }, '⚠️ Failed to load from Integram');
      }
    }

    if (this.workspaces.size === 0) {
      logger.info('No workspaces found - starting fresh');
    }
  }

  /**
   * Save workspaces to JSON file
   * @private
   */
  async _saveWorkspacesMetadata() {
    try {
      const workspacesArray = Array.from(this.workspaces.values());
      await fs.writeFile(this.metadataFile, JSON.stringify(workspacesArray, null, 2), 'utf-8');
      logger.debug({ count: workspacesArray.length }, 'Saved workspaces to JSON file');
    } catch (error) {
      logger.error({ error: error.message }, '❌ Failed to save workspaces to JSON');
    }
  }
}

// Export singleton instance
const workspaceService = new WorkspaceService();
export default workspaceService;

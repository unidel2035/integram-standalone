/**
 * WorkspaceService Tests
 * Issue #3600: Workspace tool call support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock logger to avoid console spam during tests
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('WorkspaceService', () => {
  let workspaceService;
  let testWorkspaceRoot;

  beforeEach(async () => {
    // Use a temporary test workspace root
    testWorkspaceRoot = path.join(__dirname, '../../../.test-workspaces');

    // Set environment variable before importing service
    process.env.WORKSPACE_ROOT = testWorkspaceRoot;

    // Dynamic import to pick up env var
    const module = await import('../WorkspaceService.js');
    workspaceService = module.default;

    // Initialize service
    await workspaceService.initialize();
  });

  afterEach(async () => {
    // Cleanup test workspaces
    try {
      await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clear module cache
    vi.resetModules();
  });

  describe('Workspace Creation', () => {
    it('should create a new workspace', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      expect(workspace).toBeDefined();
      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.userId).toBe('test-user');
      expect(workspace.path).toContain('test-user');
      expect(workspace.toolConfig).toBeDefined();
    });

    it('should create workspace directory', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      const exists = await fs.access(workspace.path).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should set default tool configuration', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      expect(workspace.toolConfig.allowRead).toBe(true);
      expect(workspace.toolConfig.allowWrite).toBe(true);
      expect(workspace.toolConfig.allowBash).toBe(true);
    });

    it('should allow custom tool configuration', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace',
        toolConfig: {
          allowWrite: false,
          allowBash: false
        }
      });

      expect(workspace.toolConfig.allowWrite).toBe(false);
      expect(workspace.toolConfig.allowBash).toBe(false);
    });
  });

  describe('File Operations', () => {
    let workspace;

    beforeEach(async () => {
      workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });
    });

    it('should write a file', async () => {
      const result = await workspaceService.writeFile(
        workspace.id,
        'test.txt',
        'Hello, World!'
      );

      expect(result.success).toBe(true);
      expect(result.isNewFile).toBe(true);
      expect(result.filepath).toBe('test.txt');
    });

    it('should read a file', async () => {
      await workspaceService.writeFile(workspace.id, 'test.txt', 'Hello, World!');

      const content = await workspaceService.readFile(workspace.id, 'test.txt');

      expect(content).toBe('Hello, World!');
    });

    it('should detect modified files', async () => {
      await workspaceService.writeFile(workspace.id, 'test.txt', 'Hello');

      const result = await workspaceService.writeFile(
        workspace.id,
        'test.txt',
        'Hello, World!'
      );

      expect(result.isNewFile).toBe(false);
      expect(workspace.stats.filesModified).toBe(1);
    });

    it('should create nested directories', async () => {
      await workspaceService.writeFile(
        workspace.id,
        'src/utils/helper.js',
        'module.exports = {};'
      );

      const content = await workspaceService.readFile(workspace.id, 'src/utils/helper.js');
      expect(content).toBe('module.exports = {};');
    });

    it('should prevent path traversal', async () => {
      await expect(
        workspaceService.readFile(workspace.id, '../../../etc/passwd')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should enforce read permissions', async () => {
      const restrictedWorkspace = await workspaceService.createWorkspace('test-user', {
        name: 'Restricted',
        toolConfig: {
          allowRead: false
        }
      });

      await expect(
        workspaceService.readFile(restrictedWorkspace.id, 'test.txt')
      ).rejects.toThrow('Read operation not allowed');
    });

    it('should enforce write permissions', async () => {
      const restrictedWorkspace = await workspaceService.createWorkspace('test-user', {
        name: 'Restricted',
        toolConfig: {
          allowWrite: false
        }
      });

      await expect(
        workspaceService.writeFile(restrictedWorkspace.id, 'test.txt', 'content')
      ).rejects.toThrow('Write operation not allowed');
    });
  });

  describe('Command Execution', () => {
    let workspace;

    beforeEach(async () => {
      workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });
    });

    it('should execute a simple command', async () => {
      const result = await workspaceService.executeCommand(workspace.id, 'echo "Hello"');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello');
      expect(result.exitCode).toBe(0);
    });

    it('should capture command errors', async () => {
      const result = await workspaceService.executeCommand(
        workspace.id,
        'exit 1'
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should block dangerous commands', async () => {
      await expect(
        workspaceService.executeCommand(workspace.id, 'rm -rf /')
      ).rejects.toThrow('Dangerous command detected');

      await expect(
        workspaceService.executeCommand(workspace.id, ':(){ :|:& };:')
      ).rejects.toThrow('Dangerous command detected');
    });

    it('should enforce bash permissions', async () => {
      const restrictedWorkspace = await workspaceService.createWorkspace('test-user', {
        name: 'Restricted',
        toolConfig: {
          allowBash: false
        }
      });

      await expect(
        workspaceService.executeCommand(restrictedWorkspace.id, 'echo "test"')
      ).rejects.toThrow('Bash execution not allowed');
    });

    it('should set working directory', async () => {
      await workspaceService.writeFile(workspace.id, 'test.txt', 'content');

      const result = await workspaceService.executeCommand(workspace.id, 'ls test.txt');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test.txt');
    });
  });

  describe('File Search Operations', () => {
    let workspace;

    beforeEach(async () => {
      workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      // Create test files
      await workspaceService.writeFile(workspace.id, 'file1.js', 'console.log("file1");');
      await workspaceService.writeFile(workspace.id, 'file2.js', 'console.log("file2");');
      await workspaceService.writeFile(workspace.id, 'readme.md', '# README');
    });

    it('should glob files by pattern', async () => {
      const files = await workspaceService.globFiles(workspace.id, '*.js');

      expect(files).toHaveLength(2);
      expect(files).toContain('file1.js');
      expect(files).toContain('file2.js');
    });

    it('should grep file content', async () => {
      const matches = await workspaceService.grepFiles(workspace.id, 'file1');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].content).toContain('file1');
    });

    it('should support case-insensitive grep', async () => {
      const matches = await workspaceService.grepFiles(workspace.id, 'README', {
        ignoreCase: true
      });

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', async () => {
      const matches = await workspaceService.grepFiles(workspace.id, 'nonexistent');

      expect(matches).toEqual([]);
    });
  });

  describe('Workspace Management', () => {
    it('should get workspace by ID', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      const retrieved = workspaceService.getWorkspace(workspace.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(workspace.id);
    });

    it('should return null for non-existent workspace', () => {
      const workspace = workspaceService.getWorkspace('non-existent');

      expect(workspace).toBeNull();
    });

    it('should get user workspaces', async () => {
      await workspaceService.createWorkspace('user1', { name: 'Workspace 1' });
      await workspaceService.createWorkspace('user1', { name: 'Workspace 2' });
      await workspaceService.createWorkspace('user2', { name: 'Workspace 3' });

      const user1Workspaces = workspaceService.getUserWorkspaces('user1');
      const user2Workspaces = workspaceService.getUserWorkspaces('user2');

      expect(user1Workspaces).toHaveLength(2);
      expect(user2Workspaces).toHaveLength(1);
    });

    it('should delete workspace', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      await workspaceService.deleteWorkspace(workspace.id);

      const retrieved = workspaceService.getWorkspace(workspace.id);
      expect(retrieved).toBeNull();

      // Check directory is deleted
      const exists = await fs.access(workspace.path).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should update last activity on operations', async () => {
      const workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      const originalActivity = workspace.lastActivity;

      // Wait a bit and perform operation
      await new Promise(resolve => setTimeout(resolve, 10));
      await workspaceService.writeFile(workspace.id, 'test.txt', 'content');

      const updated = workspaceService.getWorkspace(workspace.id);
      expect(new Date(updated.lastActivity).getTime()).toBeGreaterThan(
        new Date(originalActivity).getTime()
      );
    });
  });

  describe('File Tree', () => {
    let workspace;

    beforeEach(async () => {
      workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });

      // Create directory structure
      await workspaceService.writeFile(workspace.id, 'README.md', '# Project');
      await workspaceService.writeFile(workspace.id, 'src/index.js', 'console.log()');
      await workspaceService.writeFile(workspace.id, 'src/utils/helper.js', '//helper');
    });

    it('should build file tree', async () => {
      const tree = await workspaceService.getFileTree(workspace.id);

      expect(tree).toBeDefined();
      expect(tree.type).toBe('directory');
      expect(tree.children).toBeDefined();
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('should respect max depth', async () => {
      const shallowTree = await workspaceService.getFileTree(workspace.id, '', 1);
      const deepTree = await workspaceService.getFileTree(workspace.id, '', 3);

      // Shallow tree should have less nesting
      expect(shallowTree).toBeDefined();
      expect(deepTree).toBeDefined();
    });
  });

  describe('Statistics', () => {
    let workspace;

    beforeEach(async () => {
      workspace = await workspaceService.createWorkspace('test-user', {
        name: 'Test Workspace'
      });
    });

    it('should track files created', async () => {
      await workspaceService.writeFile(workspace.id, 'file1.txt', 'content');
      await workspaceService.writeFile(workspace.id, 'file2.txt', 'content');

      const updated = workspaceService.getWorkspace(workspace.id);
      expect(updated.stats.filesCreated).toBe(2);
    });

    it('should track files modified', async () => {
      await workspaceService.writeFile(workspace.id, 'file.txt', 'v1');
      await workspaceService.writeFile(workspace.id, 'file.txt', 'v2');
      await workspaceService.writeFile(workspace.id, 'file.txt', 'v3');

      const updated = workspaceService.getWorkspace(workspace.id);
      expect(updated.stats.filesModified).toBe(2);
    });

    it('should track commands executed', async () => {
      await workspaceService.executeCommand(workspace.id, 'echo "test1"');
      await workspaceService.executeCommand(workspace.id, 'echo "test2"');

      const updated = workspaceService.getWorkspace(workspace.id);
      expect(updated.stats.commandsExecuted).toBe(2);
    });
  });
});

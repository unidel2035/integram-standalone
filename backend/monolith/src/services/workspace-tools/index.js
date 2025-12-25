/**
 * Workspace Tools for Claude Tool Calling
 * Issue #3600: Implement workspace tool call support
 *
 * Defines tools that AI models can use to interact with workspaces.
 * Compatible with Anthropic's tool calling API format.
 */

import workspaceService from '../WorkspaceService.js';
import clonedRepositoryService from '../ClonedRepositoryService.js';
import logger from '../../utils/logger.js';

/**
 * Tool definitions for Anthropic API
 * Each tool follows the format required by Claude's tool use feature
 */
export const WORKSPACE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the workspace. Use this to examine code, configuration files, documentation, or any text-based file.',
    input_schema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'The relative path to the file within the workspace (e.g., "src/index.js", "README.md")'
        }
      },
      required: ['filepath']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the workspace. Creates the file if it doesn\'t exist, or overwrites it if it does. Use this to create new files or modify existing ones.',
    input_schema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'The relative path to the file within the workspace'
        },
        content: {
          type: 'string',
          description: 'The complete content to write to the file'
        }
      },
      required: ['filepath', 'content']
    }
  },
  {
    name: 'execute_command',
    description: 'Execute a shell command in the workspace directory. Use this to run build scripts, tests, git commands, npm/pip installs, or any terminal command. The command runs with a 30-second timeout.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "npm install", "git status", "python script.py")'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'list_files',
    description: 'List all files and directories in the workspace or a specific directory. Use this to explore the workspace structure and find files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative directory path to list (optional, defaults to workspace root)'
        }
      },
      required: []
    }
  },
  {
    name: 'search_files',
    description: 'Search for files matching a pattern using glob syntax. Use this to find files by name or extension (e.g., "*.js", "**/*.test.js", "src/**/*.vue").',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern to match files (e.g., "*.py", "src/**/*.js")'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'search_content',
    description: 'Search for text content within files using grep. Use this to find code patterns, function names, variables, or any text across multiple files.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The text pattern to search for'
        },
        ignoreCase: {
          type: 'boolean',
          description: 'Whether to perform case-insensitive search (default: false)'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'git_status',
    description: 'Get the current Git status of the workspace, showing modified, added, and deleted files. Use this to check what changes have been made.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_pull',
    description: 'Pull latest changes from the remote repository. Use this to update the workspace with the latest code from the repository.',
    input_schema: {
      type: 'object',
      properties: {
        remote: {
          type: 'string',
          description: 'Remote name (default: origin)'
        },
        branch: {
          type: 'string',
          description: 'Branch name (optional, defaults to current branch)'
        }
      },
      required: []
    }
  },
  {
    name: 'git_commit',
    description: 'Commit staged changes to the Git repository with a message. Use this after making and staging changes to save them to version control.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message describing the changes'
        },
        addAll: {
          type: 'boolean',
          description: 'Whether to stage all changes before committing (default: false)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'git_push',
    description: 'Push committed changes to the remote repository. Use this to upload your local commits to the remote server.',
    input_schema: {
      type: 'object',
      properties: {
        remote: {
          type: 'string',
          description: 'Remote name (default: origin)'
        },
        branch: {
          type: 'string',
          description: 'Branch name (optional, defaults to current branch)'
        },
        force: {
          type: 'boolean',
          description: 'Force push (use with caution, default: false)'
        }
      },
      required: []
    }
  },
  {
    name: 'git_diff',
    description: 'Show changes in files compared to the last commit. Use this to review what has been modified before committing.',
    input_schema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Specific file to diff (optional, shows all files if not provided)'
        },
        staged: {
          type: 'boolean',
          description: 'Show only staged changes (default: false)'
        }
      },
      required: []
    }
  },
  {
    name: 'git_clone',
    description: 'Clone a Git repository into the workspace. Use this to download a repository for the first time.',
    input_schema: {
      type: 'object',
      properties: {
        repositoryUrl: {
          type: 'string',
          description: 'Git repository URL (e.g., https://github.com/user/repo.git)'
        },
        branch: {
          type: 'string',
          description: 'Branch to clone (optional, defaults to default branch)'
        },
        token: {
          type: 'string',
          description: 'Git token for authentication (optional, for private repos)'
        }
      },
      required: ['repositoryUrl']
    }
  },
  {
    name: 'git_checkout',
    description: 'Switch to a different branch or restore files. Use this to change the current working branch or undo changes to specific files.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Branch name or file path to checkout'
        },
        createBranch: {
          type: 'boolean',
          description: 'Create a new branch (default: false)'
        }
      },
      required: ['target']
    }
  },
  {
    name: 'git_add',
    description: 'Stage files for the next commit. Use this to mark files that should be included in the next commit.',
    input_schema: {
      type: 'object',
      properties: {
        files: {
          type: 'string',
          description: 'File path(s) to stage (use "." for all files, or space-separated paths)'
        }
      },
      required: ['files']
    }
  },
  {
    name: 'get_cloned_repositories',
    description: 'Get list of cloned repositories for current user or workspace. Shows repository metadata including URL, branch, commit hash, file count, size, and clone status. Use this to see what repositories have been cloned.',
    input_schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to filter repositories (optional, defaults to workspace owner)'
        },
        status: {
          type: 'string',
          description: 'Filter by status: "active", "deleted", or "failed" (optional, shows all if not provided)',
          enum: ['active', 'deleted', 'failed']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of repositories to return (default: 100)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_cloned_repository_details',
    description: 'Get detailed information about a specific cloned repository by its ID. Returns full metadata including URL, branch, commit hash, workspace association, file count, size, status, and timestamps.',
    input_schema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'The Integram object ID of the cloned repository'
        }
      },
      required: ['repositoryId']
    }
  },
  {
    name: 'delete_cloned_repository',
    description: 'Mark a cloned repository as deleted in the database. This updates the repository status to "deleted" and records the deletion timestamp. The workspace files are not automatically removed - use workspace deletion for that.',
    input_schema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'The Integram object ID of the cloned repository to delete'
        }
      },
      required: ['repositoryId']
    }
  }
];

/**
 * Execute a workspace tool
 * @param {string} workspaceId - Workspace identifier
 * @param {string} toolName - Tool name to execute
 * @param {object} toolInput - Tool input parameters
 * @returns {Promise<object>} Tool execution result
 */
export async function executeWorkspaceTool(workspaceId, toolName, toolInput) {
  logger.info({ workspaceId, toolName, toolInput }, 'Executing workspace tool');

  try {
    switch (toolName) {
      case 'read_file':
        return await handleReadFile(workspaceId, toolInput);

      case 'write_file':
        return await handleWriteFile(workspaceId, toolInput);

      case 'execute_command':
        return await handleExecuteCommand(workspaceId, toolInput);

      case 'list_files':
        return await handleListFiles(workspaceId, toolInput);

      case 'search_files':
        return await handleSearchFiles(workspaceId, toolInput);

      case 'search_content':
        return await handleSearchContent(workspaceId, toolInput);

      case 'git_status':
        return await handleGitStatus(workspaceId, toolInput);

      case 'git_pull':
        return await handleGitPull(workspaceId, toolInput);

      case 'git_commit':
        return await handleGitCommit(workspaceId, toolInput);

      case 'git_push':
        return await handleGitPush(workspaceId, toolInput);

      case 'git_diff':
        return await handleGitDiff(workspaceId, toolInput);

      case 'git_clone':
        return await handleGitClone(workspaceId, toolInput);

      case 'git_checkout':
        return await handleGitCheckout(workspaceId, toolInput);

      case 'git_add':
        return await handleGitAdd(workspaceId, toolInput);

      case 'get_cloned_repositories':
        return await handleGetClonedRepositories(workspaceId, toolInput);

      case 'get_cloned_repository_details':
        return await handleGetClonedRepositoryDetails(workspaceId, toolInput);

      case 'delete_cloned_repository':
        return await handleDeleteClonedRepository(workspaceId, toolInput);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    logger.error({ error: error.message, workspaceId, toolName }, 'Tool execution failed');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle read_file tool
 */
async function handleReadFile(workspaceId, input) {
  const { filepath } = input;

  try {
    const content = await workspaceService.readFile(workspaceId, filepath);

    return {
      success: true,
      filepath,
      content,
      lines: content.split('\n').length,
      size: Buffer.byteLength(content, 'utf8')
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file ${filepath}: ${error.message}`
    };
  }
}

/**
 * Handle write_file tool
 */
async function handleWriteFile(workspaceId, input) {
  const { filepath, content } = input;

  try {
    const result = await workspaceService.writeFile(workspaceId, filepath, content);

    return {
      success: true,
      filepath,
      isNewFile: result.isNewFile,
      size: Buffer.byteLength(content, 'utf8'),
      message: result.isNewFile ? `Created new file ${filepath}` : `Updated file ${filepath}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file ${filepath}: ${error.message}`
    };
  }
}

/**
 * Handle execute_command tool
 */
async function handleExecuteCommand(workspaceId, input) {
  const { command } = input;

  try {
    const result = await workspaceService.executeCommand(workspaceId, command);

    return {
      success: result.success,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute command: ${error.message}`
    };
  }
}

/**
 * Handle list_files tool
 */
async function handleListFiles(workspaceId, input) {
  const { path = '' } = input;

  try {
    const tree = await workspaceService.getFileTree(workspaceId, path, 2);

    return {
      success: true,
      path: path || '/',
      tree
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list files: ${error.message}`
    };
  }
}

/**
 * Handle search_files tool
 */
async function handleSearchFiles(workspaceId, input) {
  const { pattern } = input;

  try {
    const files = await workspaceService.globFiles(workspaceId, pattern);

    return {
      success: true,
      pattern,
      matchCount: files.length,
      files
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search files: ${error.message}`
    };
  }
}

/**
 * Handle search_content tool
 */
async function handleSearchContent(workspaceId, input) {
  const { pattern, ignoreCase = false } = input;

  try {
    const matches = await workspaceService.grepFiles(workspaceId, pattern, { ignoreCase });

    return {
      success: true,
      pattern,
      matchCount: matches.length,
      matches: matches.slice(0, 100) // Limit to 100 matches
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search content: ${error.message}`
    };
  }
}

/**
 * Handle git_status tool
 */
async function handleGitStatus(workspaceId, input) {
  try {
    const status = await workspaceService.getGitStatus(workspaceId);

    return {
      success: true,
      branch: status.branch,
      hasChanges: status.hasChanges,
      fileCount: status.files.length,
      files: status.files
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get git status: ${error.message}`
    };
  }
}

/**
 * Handle git_pull tool
 */
async function handleGitPull(workspaceId, input) {
  const { remote, branch } = input;

  try {
    const result = await workspaceService.gitPull(workspaceId, { remote, branch });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git pull: ${error.message}`
    };
  }
}

/**
 * Handle git_commit tool
 */
async function handleGitCommit(workspaceId, input) {
  const { message, addAll = false } = input;

  try {
    const result = await workspaceService.gitCommit(workspaceId, message, { addAll });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git commit: ${error.message}`
    };
  }
}

/**
 * Handle git_push tool
 */
async function handleGitPush(workspaceId, input) {
  const { remote, branch, force = false } = input;

  try {
    const result = await workspaceService.gitPush(workspaceId, { remote, branch, force });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git push: ${error.message}`
    };
  }
}

/**
 * Handle git_diff tool
 */
async function handleGitDiff(workspaceId, input) {
  const { filepath, staged = false } = input;

  try {
    const result = await workspaceService.gitDiff(workspaceId, { filepath, staged });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git diff: ${error.message}`
    };
  }
}

/**
 * Handle git_clone tool
 */
async function handleGitClone(workspaceId, input) {
  const { repositoryUrl, branch, token } = input;

  try {
    const result = await workspaceService.gitClone(workspaceId, repositoryUrl, { branch, token });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git clone: ${error.message}`
    };
  }
}

/**
 * Handle git_checkout tool
 */
async function handleGitCheckout(workspaceId, input) {
  const { target, createBranch = false } = input;

  try {
    const result = await workspaceService.gitCheckout(workspaceId, target, { createBranch });
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git checkout: ${error.message}`
    };
  }
}

/**
 * Handle git_add tool
 */
async function handleGitAdd(workspaceId, input) {
  const { files } = input;

  try {
    const result = await workspaceService.gitAdd(workspaceId, files);
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to git add: ${error.message}`
    };
  }
}

/**
 * Handle get_cloned_repositories tool (Issue #4426)
 */
async function handleGetClonedRepositories(workspaceId, input) {
  const { userId, status, limit } = input;

  try {
    // Get workspace to determine user if not provided
    const workspace = workspaceService.getWorkspace(workspaceId);
    const effectiveUserId = userId || workspace?.userId;

    if (!effectiveUserId) {
      return {
        success: false,
        error: 'Could not determine user ID for repository query'
      };
    }

    const repositories = await clonedRepositoryService.getClonedRepositories(
      effectiveUserId,
      { status, limit }
    );

    return {
      success: true,
      userId: effectiveUserId,
      count: repositories.length,
      repositories: repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        url: repo.url,
        branch: repo.branch,
        commitHash: repo.commitHash,
        workspaceId: repo.workspaceId,
        clonedAt: repo.clonedAt,
        fileCount: repo.fileCount,
        sizeBytes: repo.sizeBytes,
        sizeMB: Math.round(repo.sizeBytes / 1024 / 1024),
        status: repo.status,
        lastActivity: repo.lastActivity
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get cloned repositories: ${error.message}`
    };
  }
}

/**
 * Handle get_cloned_repository_details tool (Issue #4426)
 */
async function handleGetClonedRepositoryDetails(workspaceId, input) {
  const { repositoryId } = input;

  try {
    // Get all repositories and find the one with matching ID
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return {
        success: false,
        error: `Workspace not found: ${workspaceId}`
      };
    }

    const repositories = await clonedRepositoryService.getClonedRepositories(
      workspace.userId
    );

    const repository = repositories.find(repo => repo.id === repositoryId);

    if (!repository) {
      return {
        success: false,
        error: `Cloned repository not found: ${repositoryId}`
      };
    }

    return {
      success: true,
      repository: {
        id: repository.id,
        name: repository.name,
        url: repository.url,
        branch: repository.branch,
        commitHash: repository.commitHash,
        workspaceId: repository.workspaceId,
        userId: repository.userId,
        clonedAt: repository.clonedAt,
        fileCount: repository.fileCount,
        sizeBytes: repository.sizeBytes,
        sizeMB: Math.round(repository.sizeBytes / 1024 / 1024),
        status: repository.status,
        workspacePath: repository.workspacePath,
        lastActivity: repository.lastActivity
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get cloned repository details: ${error.message}`
    };
  }
}

/**
 * Handle delete_cloned_repository tool (Issue #4426)
 */
async function handleDeleteClonedRepository(workspaceId, input) {
  const { repositoryId } = input;

  try {
    const result = await clonedRepositoryService.deleteClonedRepository(repositoryId);

    return {
      success: true,
      repositoryId,
      message: result.message,
      deletedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete cloned repository: ${error.message}`
    };
  }
}

export default {
  WORKSPACE_TOOLS,
  executeWorkspaceTool
};

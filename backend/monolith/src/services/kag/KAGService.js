/**
 * Knowledge Augmented Generation (KAG) Service
 *
 * Implements a KAG-based knowledge base for the DronDoc project
 * combining retrieval-augmented generation with knowledge graphs.
 *
 * Features:
 * - Automated indexing of repository content (code, PRs, issues, docs)
 * - Knowledge graph storage using MCP Memory
 * - Semantic search with vector embeddings
 * - RAG-based question answering
 *
 * References:
 * - https://github.com/OpenSPG/KAG
 * - Issue #5005
 *
 * @module KAGService
 */

import { Octokit } from '@octokit/rest';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbeddingService } from './EmbeddingService.js';
import { getVectorStore } from './VectorStore.js';
import { CodeParser } from './CodeParser.js';
import { getVersionManager } from './VersionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * KAG Service for managing project knowledge base
 */
class KAGService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined
    });

    // Multi-repository configuration
    // Default: single repository (backward compatibility)
    this.repositories = [
      {
        owner: 'unidel2035',
        repo: 'dronedoc2025',
        enabled: true,
        namespace: 'dronedoc2025'
      }
    ];

    // Legacy single-repo properties (for backward compatibility)
    this.owner = 'unidel2035';
    this.repo = 'dronedoc2025';

    // Storage paths
    this.dataDir = path.join(__dirname, '../../../data/kag');
    this.cacheDir = path.join(this.dataDir, 'cache');
    this.embeddingsDir = path.join(this.dataDir, 'embeddings');

    // Knowledge graph structure
    this.entities = new Map(); // entityId -> entity
    this.relations = new Map(); // relationId -> relation

    // Vector search services
    this.embeddingService = getEmbeddingService();
    this.vectorStore = getVectorStore();

    // Code parser
    this.codeParser = new CodeParser();

    // Version manager
    this.versionManager = getVersionManager({ dataDir: this.dataDir });

    // Initialize
    this.initialized = false;
  }

  /**
   * Configure repositories to index
   * @param {Array} repositories - Array of repository configs
   * Example:
   * [
   *   { owner: 'unidel2035', repo: 'dronedoc2025', enabled: true, namespace: 'dronedoc' },
   *   { owner: 'unidel2035', repo: 'backend-services', enabled: true, namespace: 'backend' }
   * ]
   */
  configureRepositories(repositories) {
    if (!Array.isArray(repositories) || repositories.length === 0) {
      throw new Error('Repositories must be a non-empty array');
    }

    // Validate repository configurations
    for (const repo of repositories) {
      if (!repo.owner || !repo.repo) {
        throw new Error('Each repository must have owner and repo fields');
      }
      if (!repo.namespace) {
        repo.namespace = repo.repo; // Default namespace to repo name
      }
      if (repo.enabled === undefined) {
        repo.enabled = true; // Default to enabled
      }
    }

    this.repositories = repositories;
    logger.info('[KAG Multi-Repo] Configured repositories', {
      count: repositories.length,
      namespaces: repositories.map(r => r.namespace)
    });
  }

  /**
   * Get list of configured repositories
   * @returns {Array} Repository configurations
   */
  getRepositories() {
    return this.repositories.filter(r => r.enabled);
  }

  /**
   * Get repository by namespace
   * @param {string} namespace - Repository namespace
   * @returns {Object|null} Repository config or null
   */
  getRepositoryByNamespace(namespace) {
    return this.repositories.find(r => r.namespace === namespace && r.enabled) || null;
  }

  /**
   * Create namespaced entity ID
   * @param {string} namespace - Repository namespace
   * @param {string} localId - Local entity ID
   * @returns {string} Namespaced entity ID
   */
  createNamespacedId(namespace, localId) {
    return `${namespace}::${localId}`;
  }

  /**
   * Parse namespaced entity ID
   * @param {string} namespacedId - Namespaced entity ID
   * @returns {Object} { namespace, localId }
   */
  parseNamespacedId(namespacedId) {
    const parts = namespacedId.split('::');
    if (parts.length === 2) {
      return { namespace: parts[0], localId: parts[1] };
    }
    // Backward compatibility: no namespace means dronedoc2025
    return { namespace: 'dronedoc2025', localId: namespacedId };
  }

  /**
   * Initialize the KAG service
   */
  async initialize() {
    if (this.initialized) {
      logger.info('[KAG] Already initialized', {
        entities: this.entities.size,
        relations: this.relations.size
      });
      return;
    }

    logger.info('[KAG] Starting initialization...');

    // Create data directories
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.embeddingsDir, { recursive: true });

    // Load existing knowledge graph
    await this.loadKnowledgeGraph();

    // Initialize vector services
    await this.embeddingService.initialize();
    await this.vectorStore.initialize();

    // Initialize version manager
    await this.versionManager.initialize();

    this.initialized = true;
    logger.info('[KAG] Initialization complete', {
      entities: this.entities.size,
      relations: this.relations.size,
      vectorDocuments: await this.vectorStore.count()
    });
  }

  /**
   * Index all repository content
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} Indexing results
   */
  async indexRepository(options = {}) {
    await this.initialize();

    const {
      includeIssues = true,
      includePRs = true,
      includeCode = true,
      includeDocs = true,
      includeCommits = true,
      maxIssues = 100,
      maxPRs = 100,
      maxCommits = 200,
      incremental = true,  // NEW: Enable incremental indexing by default
      repositories = null   // NEW: Specific repositories to index (null = all enabled)
    } = options;

    logger.info('Starting repository indexing...', { options });

    // Determine which repositories to index
    let reposToIndex = this.getRepositories();
    if (repositories && Array.isArray(repositories) && repositories.length > 0) {
      // Filter to only specified repositories
      reposToIndex = reposToIndex.filter(repo =>
        repositories.includes(repo.namespace) ||
        repositories.includes(repo.repo) ||
        repositories.includes(`${repo.owner}/${repo.repo}`)
      );
    }

    logger.info('[KAG Multi-Repo] Indexing repositories', {
      count: reposToIndex.length,
      namespaces: reposToIndex.map(r => r.namespace)
    });

    const results = {
      issues: 0,
      prs: 0,
      files: 0,
      commits: 0,
      entities: 0,
      relations: 0,
      errors: [],
      mode: incremental ? 'incremental' : 'full',
      apiCallsSaved: 0,
      repositoriesIndexed: 0,
      repositoryResults: []
    };

    try {
      // Load last index metadata
      const lastIndexMeta = await this.loadIndexMetadata();

      // Iterate through each repository
      for (const repoConfig of reposToIndex) {
        const { owner, repo, namespace } = repoConfig;
        logger.info('[KAG Multi-Repo] Indexing repository', { owner, repo, namespace });

        const repoResults = {
          namespace,
          owner,
          repo,
          issues: 0,
          prs: 0,
          files: 0,
          commits: 0,
          entities: 0,
          relations: 0,
          apiCallsSaved: 0,
          errors: []
        };

        try {
          // Index issues
          if (includeIssues) {
            const issuesResult = await this.indexIssues({
              owner,
              repo,
              namespace,
              max: maxIssues,
              since: incremental ? lastIndexMeta[namespace]?.lastIssuesIndexedAt : null
            });
            repoResults.issues = issuesResult.indexed;
            repoResults.entities += issuesResult.entities;
            repoResults.relations += issuesResult.relations;
            repoResults.apiCallsSaved += issuesResult.apiCallsSaved || 0;
          }

          // Index PRs
          if (includePRs) {
            const prsResult = await this.indexPullRequests({
              owner,
              repo,
              namespace,
              max: maxPRs,
              since: incremental ? lastIndexMeta[namespace]?.lastPRsIndexedAt : null
            });
            repoResults.prs = prsResult.indexed;
            repoResults.entities += prsResult.entities;
            repoResults.relations += prsResult.relations;
            repoResults.apiCallsSaved += prsResult.apiCallsSaved || 0;
          }

          // Index code files
          if (includeCode) {
            const codeResult = await this.indexCodeFiles({
              owner,
              repo,
              namespace,
              incremental,
              lastTreeSha: lastIndexMeta[namespace]?.lastTreeSha
            });
            repoResults.files = codeResult.indexed;
            repoResults.entities += codeResult.entities;
            repoResults.relations += codeResult.relations;
            repoResults.apiCallsSaved += codeResult.apiCallsSaved || 0;
          }

          // Index documentation
          if (includeDocs) {
            const docsResult = await this.indexDocumentation({
              owner,
              repo,
              namespace,
              incremental,
              lastIndexedAt: lastIndexMeta[namespace]?.lastDocsIndexedAt
            });
            repoResults.files += docsResult.indexed;
            repoResults.entities += docsResult.entities;
            repoResults.relations += docsResult.relations;
          }

          // Index commit history
          if (includeCommits) {
            const commitsResult = await this.indexCommitHistory({
              owner,
              repo,
              namespace,
              max: maxCommits,
              since: incremental ? lastIndexMeta[namespace]?.lastCommitsIndexedAt : null
            });
            repoResults.commits = commitsResult.indexed;
            repoResults.entities += commitsResult.entities;
            repoResults.relations += commitsResult.relations;
          }

          // Aggregate repository results
          results.issues += repoResults.issues;
          results.prs += repoResults.prs;
          results.files += repoResults.files;
          results.commits += repoResults.commits;
          results.entities += repoResults.entities;
          results.relations += repoResults.relations;
          results.apiCallsSaved += repoResults.apiCallsSaved;
          results.repositoriesIndexed++;
          results.repositoryResults.push(repoResults);

        } catch (repoError) {
          logger.error('[KAG Multi-Repo] Repository indexing failed', {
            namespace,
            owner,
            repo,
            error: repoError.message
          });
          repoResults.errors.push(repoError.message);
          results.errors.push(`${namespace}: ${repoError.message}`);
          results.repositoryResults.push(repoResults);
        }
      }

      // Save knowledge graph
      await this.saveKnowledgeGraph();

      // Generate embeddings for all entities
      logger.info('[KAG] Generating embeddings for indexed entities...');
      const embeddingsCount = await this.generateAllEmbeddings();
      results.embeddings = embeddingsCount;

      // Save index metadata
      await this.saveIndexMetadata({
        lastIndexedAt: new Date().toISOString(),
        lastIssuesIndexedAt: new Date().toISOString(),
        lastPRsIndexedAt: new Date().toISOString(),
        lastCommitsIndexedAt: new Date().toISOString(),
        lastDocsIndexedAt: new Date().toISOString(),
        lastTreeSha: results.lastTreeSha || lastIndexMeta.lastTreeSha,
        stats: results
      });

      logger.info('Repository indexing completed', results);
      return results;
    } catch (error) {
      logger.error('Repository indexing failed', { error: error.message });
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Index GitHub issues
   * @param {Object} options - Options
   * @returns {Promise<Object>} Results
   */
  async indexIssues(options = {}) {
    const {
      owner = this.owner,
      repo = this.repo,
      namespace = 'dronedoc2025',
      max = 100,
      since = null
    } = options;

    logger.info(`Indexing issues (owner: ${owner}, repo: ${repo}, namespace: ${namespace}, max: ${max}, since: ${since || 'all time'})...`);

    let indexed = 0;
    let entities = 0;
    let relations = 0;
    let apiCallsSaved = 0;

    try {
      // Prepare API request parameters
      const requestParams = {
        owner,
        repo,
        state: 'all',
        per_page: Math.min(max, 100),
        sort: 'updated',
        direction: 'desc'
      };

      // Add 'since' parameter for incremental indexing
      if (since) {
        requestParams.since = since;
        logger.info('[KAG Incremental] Fetching issues updated since:', since);
      }

      const issues = await this.octokit.rest.issues.listForRepo(requestParams);

      // If using 'since', we saved API calls by not fetching old issues
      if (since && issues.data.length < max) {
        apiCallsSaved = Math.ceil((max - issues.data.length) / 100);
        logger.info(`[KAG Incremental] API calls saved: ${apiCallsSaved} (fetched ${issues.data.length} instead of ${max})`);
      }

      for (const issue of issues.data) {
        // Skip pull requests (they come with issues API)
        if (issue.pull_request) continue;

        // Create namespaced entity IDs
        const issueId = this.createNamespacedId(namespace, `issue_${issue.number}`);
        const authorId = this.createNamespacedId(namespace, `user_${issue.user.login}`);

        // Create issue entity
        const issueEntity = {
          id: issueId,
          type: 'Issue',
          name: `Issue #${issue.number}: ${issue.title}`,
          namespace,  // Add namespace property
          repository: `${owner}/${repo}`,  // Add repository info
          properties: {
            number: issue.number,
            title: issue.title,
            body: issue.body || '',
            state: issue.state,
            url: issue.html_url,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
            author: issue.user.login,
            labels: issue.labels.map(l => l.name),
            namespace,  // Store namespace in properties too
            repository: `${owner}/${repo}`
          },
          observations: [
            `Repository: ${owner}/${repo}`,
            `Issue #${issue.number}`,
            `Title: ${issue.title}`,
            `State: ${issue.state}`,
            `Created: ${issue.created_at}`,
            `Author: ${issue.user.login}`,
            ...(issue.labels.length > 0 ? [`Labels: ${issue.labels.map(l => l.name).join(', ')}`] : []),
            ...(issue.body ? [issue.body.substring(0, 500)] : [])
          ]
        };

        // Update or add entity
        this.addOrUpdateEntity(issueEntity);
        entities++;

        // Create relations to author
        const authorEntity = {
          id: authorId,
          type: 'User',
          name: issue.user.login,
          namespace,
          repository: `${owner}/${repo}`,
          properties: {
            login: issue.user.login,
            url: issue.user.html_url,
            namespace,
            repository: `${owner}/${repo}`
          }
        };

        this.addOrUpdateEntity(authorEntity);
        entities++;

        this.addRelation({
          from: issueId,
          to: authorId,
          type: 'created_by'
        });
        relations++;

        // Create relations to labels
        for (const label of issue.labels) {
          const labelId = this.createNamespacedId(namespace, `label_${label.name}`);
          const labelEntity = {
            id: labelId,
            type: 'Label',
            name: label.name,
            namespace,
            repository: `${owner}/${repo}`,
            properties: {
              name: label.name,
              color: label.color,
              namespace,
              repository: `${owner}/${repo}`
            }
          };

          this.addOrUpdateEntity(labelEntity);

          this.addRelation({
            from: issueId,
            to: labelId,
            type: 'has_label'
          });
          relations++;
        }

        indexed++;
      }

      logger.info(`Indexed ${indexed} issues`);
      return { indexed, entities, relations, apiCallsSaved };
    } catch (error) {
      logger.error('Failed to index issues', { error: error.message });
      return { indexed, entities, relations, apiCallsSaved };
    }
  }

  /**
   * Index GitHub pull requests
   * @param {Object} options - Options
   * @returns {Promise<Object>} Results
   */
  async indexPullRequests(options = {}) {
    const { max = 100, since = null } = options;

    logger.info(`Indexing pull requests (max: ${max}, since: ${since || 'all time'})...`);

    let indexed = 0;
    let entities = 0;
    let relations = 0;
    let apiCallsSaved = 0;

    try {
      // Note: GitHub pulls API doesn't support 'since' parameter directly
      // We need to filter manually after fetching
      const prs = await this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: Math.min(max, 100),
        sort: 'updated',
        direction: 'desc'
      });

      // Filter PRs by 'since' if provided
      let filteredPRs = prs.data;
      if (since) {
        const sinceDate = new Date(since);
        filteredPRs = prs.data.filter(pr => new Date(pr.updated_at) > sinceDate);
        logger.info(`[KAG Incremental] Filtered ${filteredPRs.length} PRs updated since ${since} (from ${prs.data.length} total)`);

        // Calculate API calls saved
        if (filteredPRs.length < prs.data.length) {
          apiCallsSaved = Math.ceil((prs.data.length - filteredPRs.length) / 100);
        }
      }

      for (const pr of filteredPRs) {
        // Create PR entity
        const prEntity = {
          id: `pr_${pr.number}`,
          type: 'PullRequest',
          name: `PR #${pr.number}: ${pr.title}`,
          properties: {
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            state: pr.state,
            merged: pr.merged_at !== null,
            url: pr.html_url,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            merged_at: pr.merged_at,
            closed_at: pr.closed_at,
            author: pr.user.login,
            base_branch: pr.base.ref,
            head_branch: pr.head.ref
          },
          observations: [
            `Pull Request #${pr.number}`,
            `Title: ${pr.title}`,
            `State: ${pr.state}`,
            `Merged: ${pr.merged_at ? 'Yes' : 'No'}`,
            `Created: ${pr.created_at}`,
            `Author: ${pr.user.login}`,
            `Base: ${pr.base.ref} ← Head: ${pr.head.ref}`,
            ...(pr.body ? [pr.body.substring(0, 500)] : [])
          ]
        };

        this.addOrUpdateEntity(prEntity);
        entities++;

        // Create relation to author
        const authorEntity = {
          id: `user_${pr.user.login}`,
          type: 'User',
          name: pr.user.login,
          properties: {
            login: pr.user.login,
            url: pr.user.html_url
          }
        };

        this.addOrUpdateEntity(authorEntity);
        entities++;

        this.addRelation({
          from: prEntity.id,
          to: authorEntity.id,
          type: 'created_by'
        });
        relations++;

        indexed++;
      }

      logger.info(`Indexed ${indexed} pull requests`);
      return { indexed, entities, relations, apiCallsSaved };
    } catch (error) {
      logger.error('Failed to index pull requests', { error: error.message });
      return { indexed, entities, relations, apiCallsSaved };
    }
  }

  /**
   * Index all code files using GitHub tree API
   * @param {Object} options - Options
   * @returns {Promise<Object>} Results
   */
  async indexCodeFiles(options = {}) {
    const { incremental = false, lastTreeSha = null } = options;

    logger.info('Indexing all code files...', { incremental, lastTreeSha });

    let indexed = 0;
    let entities = 0;
    let relations = 0;
    let skipped = 0;
    let errors = 0;
    let apiCallsSaved = 0;

    try {
      // Get the repository tree recursively
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: 'heads/dev'
      });

      const treeSha = refData.object.sha;

      logger.info(`Getting repository tree from commit ${treeSha}...`);

      // Skip if tree hasn't changed (incremental mode)
      if (incremental && lastTreeSha === treeSha) {
        logger.info('[KAG Incremental] Tree SHA unchanged, skipping code indexing', {
          treeSha
        });
        apiCallsSaved = 1; // Saved the tree API call
        return { indexed, entities, relations, skipped, errors, apiCallsSaved, lastTreeSha: treeSha };
      }

      const { data: treeData } = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: treeSha,
        recursive: 'true'
      });

      logger.info(`Found ${treeData.tree.length} total items in repository`);

      // Filter code files
      const codeFiles = treeData.tree.filter(item => {
        if (item.type !== 'blob') return false;

        // Skip excluded directories
        const excludedDirs = [
          'node_modules/',
          '.git/',
          'dist/',
          'build/',
          'venv/',
          '.venv/',
          '__pycache__/',
          'coverage/',
          '.cache/',
          'vendor/'
        ];

        if (excludedDirs.some(dir => item.path.startsWith(dir))) {
          return false;
        }

        // Check if file has supported extension
        return this.codeParser.isSupported(item.path);
      });

      logger.info(`Found ${codeFiles.length} code files to index`);

      // Process files in batches to avoid rate limits
      const batchSize = 50;
      for (let i = 0; i < codeFiles.length; i += batchSize) {
        const batch = codeFiles.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(codeFiles.length / batchSize)}`);

        await Promise.all(batch.map(async (file) => {
          try {
            // Get file content
            const { data } = await this.octokit.rest.repos.getContent({
              owner: this.owner,
              repo: this.repo,
              path: file.path
            });

            if (data.type !== 'file') return;

            const content = Buffer.from(data.content, 'base64').toString('utf-8');

            // Parse file structure
            const structure = this.codeParser.parseFile(file.path, content);

            if (!structure) {
              skipped++;
              return;
            }

            // Create file entity
            const fileId = `file_${file.path.replace(/[\/\.]/g, '_')}`;
            const fileEntity = {
              id: fileId,
              type: structure.type || 'CodeFile',
              name: file.path,
              properties: {
                path: file.path,
                url: data.html_url,
                size: data.size,
                sha: data.sha,
                extension: file.path.substring(file.path.lastIndexOf('.')),
                ...structure
              },
              observations: [
                `File: ${file.path}`,
                `Type: ${structure.type}`,
                `Size: ${data.size} bytes`,
                `Functions: ${structure.functions?.length || 0}`,
                `Classes: ${structure.classes?.length || 0}`,
                `Imports: ${structure.imports?.length || 0}`,
                content.substring(0, 5000)  // First 5000 chars for search
              ]
            };

            this.addEntity(fileEntity);
            entities++;
            indexed++;

            // Create relations for imports
            if (structure.imports) {
              for (const imp of structure.imports) {
                const source = imp.source || imp.names?.[0];
                if (source) {
                  // Resolve relative imports to absolute paths
                  const targetPath = this.resolveImportPath(file.path, source);
                  const targetId = `file_${targetPath.replace(/[\/\.]/g, '_')}`;

                  this.addRelation({
                    from: fileId,
                    to: targetId,
                    type: 'imports',
                    properties: {
                      source: source,
                      specifiers: imp.specifiers || imp.names
                    }
                  });
                  relations++;
                }
              }
            }

            // Create entities for functions
            if (structure.functions) {
              for (const func of structure.functions) {
                const funcId = `func_${fileId}_${func.name}`;
                const funcEntity = {
                  id: funcId,
                  type: 'Function',
                  name: `${file.path}:${func.name}`,
                  properties: {
                    name: func.name,
                    params: func.params,
                    line: func.line,
                    file: file.path
                  },
                  observations: [
                    `Function: ${func.name}`,
                    `File: ${file.path}`,
                    `Line: ${func.line}`,
                    `Params: ${func.params?.join(', ') || 'none'}`
                  ]
                };

                this.addEntity(funcEntity);
                entities++;

                this.addRelation({
                  from: fileId,
                  to: funcId,
                  type: 'defines'
                });
                relations++;
              }
            }

            // Create entities for classes
            if (structure.classes) {
              for (const cls of structure.classes) {
                const classId = `class_${fileId}_${cls.name}`;
                const classEntity = {
                  id: classId,
                  type: 'Class',
                  name: `${file.path}:${cls.name}`,
                  properties: {
                    name: cls.name,
                    methods: cls.methods || cls.bases,
                    superClass: cls.superClass || null,
                    line: cls.line,
                    file: file.path
                  },
                  observations: [
                    `Class: ${cls.name}`,
                    `File: ${file.path}`,
                    `Line: ${cls.line}`,
                    `Methods: ${cls.methods?.length || 0}`,
                    ...(cls.superClass ? [`Extends: ${cls.superClass}`] : [])
                  ]
                };

                this.addEntity(classEntity);
                entities++;

                this.addRelation({
                  from: fileId,
                  to: classId,
                  type: 'defines'
                });
                relations++;
              }
            }

            // Create relations for class inheritance (class_extends_class)
            if (structure.classExtensions) {
              for (const ext of structure.classExtensions) {
                const childClassId = `class_${fileId}_${ext.class}`;
                // The parent class might be in the same file or different file
                // For now, we'll create a relation even if the parent isn't indexed yet
                const parentClassId = `class_${fileId}_${ext.extends}`;

                this.addRelation({
                  from: childClassId,
                  to: parentClassId,
                  type: 'extends',
                  properties: {
                    childClass: ext.class,
                    parentClass: ext.extends,
                    line: ext.line
                  }
                });
                relations++;
              }
            }

            // Create relations for function calls (function_calls_function)
            if (structure.functionCalls) {
              for (const call of structure.functionCalls) {
                // Construct caller function ID
                const callerFuncId = call.caller.includes('.')
                  ? `func_${fileId}_${call.caller.replace(/\./g, '_')}`
                  : `func_${fileId}_${call.caller}`;

                // Construct callee function ID (might be in different file)
                // For now, assume same file. Later we can enhance with import resolution
                const calleeFuncId = call.callee.includes('.')
                  ? `func_${fileId}_${call.callee.replace(/\./g, '_')}`
                  : `func_${fileId}_${call.callee}`;

                this.addRelation({
                  from: callerFuncId,
                  to: calleeFuncId,
                  type: 'calls',
                  properties: {
                    caller: call.caller,
                    callee: call.callee,
                    line: call.line
                  }
                });
                relations++;
              }
            }
          } catch (error) {
            logger.warn(`Failed to index file ${file.path}`, { error: error.message });
            errors++;
          }
        }));

        // Small delay between batches to avoid rate limits
        if (i + batchSize < codeFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Code indexing complete', {
        indexed,
        entities,
        relations,
        skipped,
        errors,
        apiCallsSaved
      });

      return { indexed, entities, relations, skipped, errors, apiCallsSaved, lastTreeSha: treeSha };
    } catch (error) {
      logger.error('Failed to index code files', { error: error.message });
      return { indexed, entities, relations, skipped, errors, apiCallsSaved };
    }
  }

  /**
   * Resolve import path to absolute repository path
   * @param {string} currentFile - Current file path
   * @param {string} importSource - Import source
   * @returns {string} Resolved path
   */
  resolveImportPath(currentFile, importSource) {
    // Handle relative imports
    if (importSource.startsWith('./') || importSource.startsWith('../')) {
      const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
      const parts = currentDir.split('/');
      const importParts = importSource.split('/');

      for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
          parts.pop();
        } else {
          parts.push(part);
        }
      }

      let resolved = parts.join('/');

      // Add common file extensions if not present
      if (!resolved.match(/\.(js|vue|ts|tsx|jsx)$/)) {
        // Try common extensions
        const extensions = ['.js', '.vue', '.ts', '.tsx', '.jsx', '/index.js', '/index.vue'];
        for (const ext of extensions) {
          resolved += ext;
          break;  // Use first extension for now
        }
      }

      return resolved;
    }

    // Handle absolute imports (like @/...)
    if (importSource.startsWith('@/')) {
      return 'src/' + importSource.substring(2);
    }

    // Handle node_modules imports (external)
    return `node_modules/${importSource}`;
  }

  /**
   * Index documentation files
   * @returns {Promise<Object>} Results
   */
  async indexDocumentation() {
    logger.info('Indexing documentation...');

    let indexed = 0;
    let entities = 0;
    let relations = 0;

    const docPaths = [
      'docs',
      'CLAUDE.md',
      'README.md'
    ];

    try {
      for (const docPath of docPaths) {
        try {
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: docPath
          });

          if (Array.isArray(data)) {
            // It's a directory
            for (const item of data) {
              if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
                const fileContent = await this.octokit.rest.repos.getContent({
                  owner: this.owner,
                  repo: this.repo,
                  path: item.path
                });

                const content = Buffer.from(fileContent.data.content, 'base64').toString('utf-8');

                const docEntity = {
                  id: `doc_${item.path.replace(/[\/\.]/g, '_')}`,
                  type: 'Documentation',
                  name: item.path,
                  properties: {
                    path: item.path,
                    url: item.html_url,
                    size: item.size
                  },
                  observations: [
                    `Documentation: ${item.path}`,
                    content.substring(0, 10000)  // Increased from 1000 to 10000 chars for better search coverage
                  ]
                };

                this.addEntity(docEntity);
                entities++;
                indexed++;
              }
            }
          } else if (data.type === 'file') {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');

            const docEntity = {
              id: `doc_${docPath.replace(/[\/\.]/g, '_')}`,
              type: 'Documentation',
              name: docPath,
              properties: {
                path: docPath,
                url: data.html_url,
                size: data.size
              },
              observations: [
                `Documentation: ${docPath}`,
                content.substring(0, 10000)  // Increased from 1000 to 10000 chars for better search coverage
              ]
            };

            this.addEntity(docEntity);
            entities++;
            indexed++;
          }
        } catch (error) {
          logger.warn(`Failed to index documentation ${docPath}`, { error: error.message });
        }
      }

      logger.info(`Indexed ${indexed} documentation files`);
      return { indexed, entities, relations };
    } catch (error) {
      logger.error('Failed to index documentation', { error: error.message });
      return { indexed, entities, relations };
    }
  }

  /**
   * Index Git commit history
   * @param {Object} options - Options
   * @returns {Promise<Object>} Results
   */
  async indexCommitHistory(options = {}) {
    const { max = 200, branch = 'dev', since = null } = options;

    logger.info(`Indexing commit history (max: ${max}, branch: ${branch}, since: ${since || 'all time'})...`);

    let indexed = 0;
    let entities = 0;
    let relations = 0;

    try {
      // Prepare API request parameters
      const requestParams = {
        owner: this.owner,
        repo: this.repo,
        sha: branch,
        per_page: Math.min(max, 100)
      };

      // Add 'since' parameter for incremental indexing
      if (since) {
        requestParams.since = since;
        logger.info('[KAG Incremental] Fetching commits since:', since);
      }

      // Fetch commits from GitHub API
      const commits = await this.octokit.rest.repos.listCommits(requestParams);

      for (const commit of commits.data) {
        // Create commit entity
        const commitEntity = {
          id: `commit_${commit.sha.substring(0, 8)}`,
          type: 'Commit',
          name: `Commit ${commit.sha.substring(0, 8)}: ${commit.commit.message.split('\n')[0]}`,
          properties: {
            sha: commit.sha,
            short_sha: commit.sha.substring(0, 8),
            message: commit.commit.message,
            author: commit.commit.author.name,
            author_email: commit.commit.author.email,
            date: commit.commit.author.date,
            url: commit.html_url,
            committer: commit.commit.committer.name,
            committer_email: commit.commit.committer.email,
            committer_date: commit.commit.committer.date,
            verified: commit.commit.verification?.verified || false
          },
          observations: [
            `Commit ${commit.sha.substring(0, 8)}`,
            `Message: ${commit.commit.message}`,
            `Author: ${commit.commit.author.name} <${commit.commit.author.email}>`,
            `Date: ${commit.commit.author.date}`,
            `URL: ${commit.html_url}`
          ]
        };

        this.addEntity(commitEntity);
        entities++;

        // Create author entity (User type)
        const authorEntity = {
          id: `user_${commit.commit.author.email}`,
          type: 'User',
          name: commit.commit.author.name,
          properties: {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            login: commit.author?.login || commit.commit.author.name
          }
        };

        this.addEntity(authorEntity);
        entities++;

        // Create relation: commit created_by user
        this.addRelation({
          from: commitEntity.id,
          to: authorEntity.id,
          type: 'created_by'
        });
        relations++;

        // Fetch commit details to get files changed
        try {
          const commitDetails = await this.octokit.rest.repos.getCommit({
            owner: this.owner,
            repo: this.repo,
            ref: commit.sha
          });

          // Create relations to modified files
          if (commitDetails.data.files) {
            for (const file of commitDetails.data.files) {
              const fileEntity = {
                id: `file_${file.filename.replace(/[\/\.]/g, '_')}`,
                type: 'File',
                name: file.filename,
                properties: {
                  path: file.filename,
                  status: file.status
                }
              };

              this.addEntity(fileEntity);

              // Create temporal relation: commit_modifies_file
              this.addRelation({
                from: commitEntity.id,
                to: fileEntity.id,
                type: 'commit_modifies_file',
                properties: {
                  status: file.status, // added, modified, removed, renamed
                  additions: file.additions,
                  deletions: file.deletions,
                  changes: file.changes,
                  patch: file.patch?.substring(0, 500) // Store first 500 chars of patch
                }
              });
              relations++;
            }
          }

          // Extract issue references from commit message (e.g., #123, fixes #456)
          const issueRegex = /#(\d+)/g;
          let match;
          while ((match = issueRegex.exec(commit.commit.message)) !== null) {
            const issueNumber = match[1];
            const issueId = `issue_${issueNumber}`;

            // Create relation: commit_fixes_issue or commit_references_issue
            const isFix = /fix(es|ed)?|close(s|d)?|resolve(s|d)?/i.test(commit.commit.message);
            this.addRelation({
              from: commitEntity.id,
              to: issueId,
              type: isFix ? 'commit_fixes_issue' : 'commit_references_issue',
              properties: {
                issue_number: issueNumber
              }
            });
            relations++;
          }

          // Extract PR references (e.g., PR #123, pull request #456)
          const prRegex = /(?:PR|pull request)\s*#(\d+)/gi;
          while ((match = prRegex.exec(commit.commit.message)) !== null) {
            const prNumber = match[1];
            const prId = `pr_${prNumber}`;

            // Create relation: commit_part_of_pr
            this.addRelation({
              from: commitEntity.id,
              to: prId,
              type: 'commit_part_of_pr',
              properties: {
                pr_number: prNumber
              }
            });
            relations++;
          }
        } catch (detailError) {
          logger.warn(`Failed to fetch commit details for ${commit.sha}`, { error: detailError.message });
        }

        indexed++;

        // Rate limiting: pause briefly every 50 commits
        if (indexed % 50 === 0) {
          logger.info(`Progress: ${indexed} commits indexed...`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(`Indexed ${indexed} commits`);
      return { indexed, entities, relations };
    } catch (error) {
      logger.error('Failed to index commit history', { error: error.message });
      return { indexed, entities, relations };
    }
  }

  /**
   * Add entity to knowledge graph
   * @param {Object} entity - Entity to add
   */
  addEntity(entity) {
    if (!entity.id) {
      logger.warn('Entity without ID', entity);
      return;
    }

    const existing = this.entities.get(entity.id);
    if (existing) {
      // Merge observations
      if (entity.observations) {
        existing.observations = [
          ...new Set([
            ...(existing.observations || []),
            ...entity.observations
          ])
        ];
      }

      // Merge properties
      existing.properties = {
        ...existing.properties,
        ...entity.properties
      };
    } else {
      this.entities.set(entity.id, entity);
    }
  }

  /**
   * Generate and store embedding for an entity
   * @param {Object} entity - Entity to embed
   * @returns {Promise<void>}
   */
  async generateEntityEmbedding(entity) {
    try {
      // Create text representation of entity
      const text = this._entityToText(entity);

      // Generate embedding
      const embedding = await this.embeddingService.embed(text);

      // Store in vector database
      await this.vectorStore.addDocument(
        entity.id,
        embedding,
        {
          type: entity.type,
          name: entity.name,
          ...entity.properties
        },
        text
      );

      logger.debug('[KAG] Entity embedding generated', {
        id: entity.id,
        type: entity.type
      });
    } catch (error) {
      logger.error('[KAG] Failed to generate entity embedding', {
        id: entity.id,
        error: error.message
      });
    }
  }

  /**
   * Generate embeddings for all entities
   * @returns {Promise<number>} Number of embeddings generated
   */
  async generateAllEmbeddings() {
    await this.initialize();

    let count = 0;
    const entities = Array.from(this.entities.values());

    logger.info('[KAG] Generating embeddings for entities', {
      total: entities.length
    });

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (entity) => {
          await this.generateEntityEmbedding(entity);
          count++;
        })
      );

      logger.info('[KAG] Embedding batch processed', {
        processed: count,
        total: entities.length
      });
    }

    return count;
  }

  /**
   * Convert entity to text for embedding
   * @param {Object} entity - Entity
   * @returns {string} Text representation
   * @private
   */
  _entityToText(entity) {
    const parts = [
      `Type: ${entity.type}`,
      `Name: ${entity.name}`
    ];

    if (entity.observations && entity.observations.length > 0) {
      parts.push(...entity.observations);
    }

    if (entity.properties) {
      parts.push(JSON.stringify(entity.properties));
    }

    return parts.join('\n');
  }

  /**
   * Add relation to knowledge graph
   * @param {Object} relation - Relation to add
   */
  addRelation(relation) {
    const relationId = `${relation.from}_${relation.type}_${relation.to}`;
    this.relations.set(relationId, {
      id: relationId,
      ...relation
    });
  }

  /**
   * Add or update entity (alias for addEntity for clarity in incremental indexing)
   * @param {Object} entity - Entity to add or update
   */
  addOrUpdateEntity(entity) {
    this.addEntity(entity);
  }

  /**
   * Load indexing metadata
   * @returns {Promise<Object>} Index metadata
   */
  async loadIndexMetadata() {
    const metadataFile = path.join(this.dataDir, 'index_metadata.json');

    try {
      const data = await fs.readFile(metadataFile, 'utf-8');
      const metadata = JSON.parse(data);
      logger.info('[KAG] Loaded index metadata', {
        lastIndexedAt: metadata.lastIndexedAt
      });
      return metadata;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('[KAG] No index metadata found, starting fresh');
      } else {
        logger.error('[KAG] Error loading index metadata', { error: error.message });
      }

      // Return default metadata
      return {
        lastIndexedAt: null,
        lastIssuesIndexedAt: null,
        lastPRsIndexedAt: null,
        lastCommitsIndexedAt: null,
        lastDocsIndexedAt: null,
        lastTreeSha: null,
        stats: {}
      };
    }
  }

  /**
   * Save indexing metadata
   * @param {Object} metadata - Metadata to save
   */
  async saveIndexMetadata(metadata) {
    const metadataFile = path.join(this.dataDir, 'index_metadata.json');

    const data = {
      ...metadata,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(metadataFile, JSON.stringify(data, null, 2));
    logger.info('[KAG] Index metadata saved', {
      lastIndexedAt: metadata.lastIndexedAt,
      file: metadataFile
    });
  }

  /**
   * Load ETag cache
   * @returns {Promise<Map>} ETag cache
   */
  async loadETagCache() {
    const cacheFile = path.join(this.cacheDir, 'etag_cache.json');

    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      const cacheData = JSON.parse(data);
      const cache = new Map(Object.entries(cacheData));
      logger.info('[KAG] Loaded ETag cache', { entries: cache.size });
      return cache;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('[KAG] Error loading ETag cache', { error: error.message });
      }
      return new Map();
    }
  }

  /**
   * Save ETag cache
   * @param {Map} cache - ETag cache to save
   */
  async saveETagCache(cache) {
    const cacheFile = path.join(this.cacheDir, 'etag_cache.json');
    const cacheData = Object.fromEntries(cache);
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    logger.info('[KAG] ETag cache saved', { entries: cache.size });
  }

  /**
   * Make a conditional GitHub API request with ETag caching
   * @param {Function} apiCall - API call function
   * @param {string} cacheKey - Cache key for this request
   * @param {Map} etagCache - ETag cache
   * @returns {Promise<Object>} API response or cached data
   */
  async makeConditionalRequest(apiCall, cacheKey, etagCache) {
    const cachedEntry = etagCache.get(cacheKey);

    try {
      const headers = {};
      if (cachedEntry && cachedEntry.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const response = await apiCall(headers);

      // Check if content was not modified (304)
      if (response.status === 304 && cachedEntry) {
        logger.info('[KAG Cache] ETag cache hit', { key: cacheKey });
        return {
          data: cachedEntry.data,
          fromCache: true
        };
      }

      // Update cache with new ETag
      const etag = response.headers.etag;
      if (etag) {
        etagCache.set(cacheKey, {
          etag,
          data: response.data,
          timestamp: new Date().toISOString()
        });
      }

      return {
        data: response.data,
        fromCache: false
      };
    } catch (error) {
      // If 304 Not Modified, return cached data
      if (error.status === 304 && cachedEntry) {
        logger.info('[KAG Cache] ETag cache hit (304)', { key: cacheKey });
        return {
          data: cachedEntry.data,
          fromCache: true
        };
      }

      throw error;
    }
  }

  /**
   * Search knowledge base using keyword search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async keywordSearch(query, options = {}) {
    const {
      entityTypes = null,
      minScore = 0.3
    } = options;

    const results = [];
    const queryLower = query.toLowerCase();

    // Keyword-based search
    for (const [id, entity] of this.entities) {
      if (entityTypes && !entityTypes.includes(entity.type)) {
        continue;
      }

      let score = 0;

      // Check name
      if (entity.name.toLowerCase().includes(queryLower)) {
        score += 1.0;
      }

      // Check observations
      if (entity.observations) {
        for (const obs of entity.observations) {
          if (obs.toLowerCase().includes(queryLower)) {
            score += 0.5;
          }
        }
      }

      // Check properties
      if (entity.properties) {
        const propsString = JSON.stringify(entity.properties).toLowerCase();
        if (propsString.includes(queryLower)) {
          score += 0.3;
        }
      }

      // Boost important documents
      if (entity.type === 'Documentation') {
        score += 0.5;
      }
      if (entity.name === 'README.md' || entity.name === 'CLAUDE.md') {
        score += 2.0;
      }
      if (entity.type === 'File' && (entity.name === 'README.md' || entity.name === 'package.json')) {
        score += 1.5;
      }

      if (score >= minScore) {
        results.push({
          entity,
          score,
          id: entity.id
        });
      }
    }

    return results;
  }

  /**
   * Search knowledge base using semantic (vector) search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async semanticSearch(query, options = {}) {
    const {
      limit = 10,
      entityTypes = null
    } = options;

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query);

      // Search vector store
      const vectorResults = await this.vectorStore.search(queryEmbedding, {
        limit: limit * 2, // Get more results for filtering
        where: entityTypes ? { type: { $in: entityTypes } } : null
      });

      // Map vector results to our format
      const results = vectorResults.map(result => {
        const entity = this.entities.get(result.id);
        return {
          entity: entity || {
            id: result.id,
            name: result.metadata.name || result.id,
            type: result.metadata.type || 'Unknown',
            properties: result.metadata
          },
          score: result.score,
          id: result.id
        };
      });

      return results;
    } catch (error) {
      logger.error('[KAG] Semantic search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search knowledge base using hybrid approach (keyword + semantic)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    await this.initialize();

    const {
      limit = 10,
      entityTypes = null,
      minScore = 0.3,
      mode = 'hybrid', // 'hybrid', 'keyword', 'semantic'
      // Advanced filters
      dateFrom = null,
      dateTo = null,
      dateField = 'created_at', // 'created_at', 'updated_at', 'closed_at'
      authors = null, // Array of author logins
      state = null, // 'open', 'closed', 'merged', 'all'
      labels = null, // Array of label names
      labelLogic = 'OR' // 'AND' or 'OR'
    } = options;

    logger.info('Searching knowledge base', { query, mode, options });

    try {
      let results = [];

      if (mode === 'keyword') {
        // Keyword-only search
        results = await this.keywordSearch(query, { entityTypes, minScore });
        results.sort((a, b) => b.score - a.score);
      } else if (mode === 'semantic') {
        // Semantic-only search
        results = await this.semanticSearch(query, { limit, entityTypes });
      } else {
        // Hybrid search: combine keyword and semantic
        const [keywordResults, semanticResults] = await Promise.all([
          this.keywordSearch(query, { entityTypes, minScore }),
          this.semanticSearch(query, { limit, entityTypes })
        ]);

        // Merge results with weighted scores
        const merged = new Map();

        // Add keyword results with weight 0.4
        for (const result of keywordResults) {
          merged.set(result.id, {
            ...result,
            score: result.score * 0.4,
            sources: ['keyword']
          });
        }

        // Add semantic results with weight 0.6
        for (const result of semanticResults) {
          const existing = merged.get(result.id);
          if (existing) {
            existing.score += result.score * 0.6;
            existing.sources.push('semantic');
          } else {
            merged.set(result.id, {
              ...result,
              score: result.score * 0.6,
              sources: ['semantic']
            });
          }
        }

        results = Array.from(merged.values());
        results.sort((a, b) => b.score - a.score);

        logger.info('[KAG] Hybrid search completed', {
          keywordResults: keywordResults.length,
          semanticResults: semanticResults.length,
          mergedResults: results.length
        });
      }

      // Apply advanced filters
      results = this.applyAdvancedFilters(results, {
        dateFrom,
        dateTo,
        dateField,
        authors,
        state,
        labels,
        labelLogic
      });

      return results.slice(0, limit);
    } catch (error) {
      logger.error('[KAG] Search failed', { error: error.message });
      // Fallback to keyword search
      const fallbackResults = await this.keywordSearch(query, { entityTypes, minScore });
      fallbackResults.sort((a, b) => b.score - a.score);
      return fallbackResults.slice(0, limit);
    }
  }

  /**
   * Get entity by ID
   * @param {string} entityId - Entity ID
   * @returns {Object|null} Entity or null
   */
  getEntity(entityId) {
    return this.entities.get(entityId) || null;
  }

  /**
   * Get relations for entity
   * @param {string} entityId - Entity ID
   * @param {string} direction - 'outgoing', 'incoming', or 'both'
   * @returns {Array} Relations
   */
  getRelations(entityId, direction = 'both') {
    const results = [];

    for (const [id, relation] of this.relations) {
      if (direction === 'outgoing' || direction === 'both') {
        if (relation.from === entityId) {
          results.push(relation);
        }
      }

      if (direction === 'incoming' || direction === 'both') {
        if (relation.to === entityId) {
          results.push(relation);
        }
      }
    }

    return results;
  }

  /**
   * Query when a file was last changed
   * @param {string} filePath - Path to the file
   * @returns {Array} Array of commits that modified the file, sorted by date (newest first)
   */
  getFileHistory(filePath) {
    const fileId = `file_${filePath.replace(/[\/\.]/g, '_')}`;
    const fileEntity = this.getEntity(fileId);

    if (!fileEntity) {
      return [];
    }

    // Find all commits that modified this file
    const commits = [];
    for (const [id, relation] of this.relations) {
      if (relation.type === 'commit_modifies_file' && relation.to === fileId) {
        const commitEntity = this.getEntity(relation.from);
        if (commitEntity) {
          commits.push({
            commit: commitEntity,
            relation: relation,
            date: commitEntity.properties.date,
            author: commitEntity.properties.author,
            message: commitEntity.properties.message,
            changes: {
              status: relation.properties?.status,
              additions: relation.properties?.additions,
              deletions: relation.properties?.deletions,
              changes: relation.properties?.changes
            }
          });
        }
      }
    }

    // Sort by date (newest first)
    commits.sort((a, b) => new Date(b.date) - new Date(a.date));

    return commits;
  }

  /**
   * Query who last modified a file or entity
   * @param {string} entityId - Entity ID (file, function, etc.)
   * @returns {Object|null} Last modifier information
   */
  getLastModifier(entityId) {
    const history = this.getFileHistory(entityId.replace(/^file_/, ''));

    if (history.length === 0) {
      return null;
    }

    const latest = history[0];
    return {
      author: latest.author,
      date: latest.date,
      commit: latest.commit,
      message: latest.message,
      changes: latest.changes
    };
  }

  /**
   * Query what changed in a file over time
   * @param {string} filePath - Path to the file
   * @param {Object} options - Query options
   * @returns {Array} Changes over time
   */
  getFileChanges(filePath, options = {}) {
    const {
      since = null,
      until = null,
      author = null,
      limit = null
    } = options;

    let history = this.getFileHistory(filePath);

    // Filter by date range
    if (since) {
      const sinceDate = new Date(since);
      history = history.filter(item => new Date(item.date) >= sinceDate);
    }

    if (until) {
      const untilDate = new Date(until);
      history = history.filter(item => new Date(item.date) <= untilDate);
    }

    // Filter by author
    if (author) {
      history = history.filter(item =>
        item.author.toLowerCase().includes(author.toLowerCase()) ||
        item.commit.properties.author_email.toLowerCase().includes(author.toLowerCase())
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      history = history.slice(0, limit);
    }

    return history;
  }

  /**
   * Find commits that fixed a specific issue
   * @param {number} issueNumber - Issue number
   * @returns {Array} Commits that fixed the issue
   */
  getCommitsForIssue(issueNumber) {
    const issueId = `issue_${issueNumber}`;
    const commits = [];

    for (const [id, relation] of this.relations) {
      if ((relation.type === 'commit_fixes_issue' || relation.type === 'commit_references_issue')
          && relation.to === issueId) {
        const commitEntity = this.getEntity(relation.from);
        if (commitEntity) {
          commits.push({
            commit: commitEntity,
            type: relation.type,
            date: commitEntity.properties.date,
            author: commitEntity.properties.author,
            message: commitEntity.properties.message
          });
        }
      }
    }

    // Sort by date (newest first)
    commits.sort((a, b) => new Date(b.date) - new Date(a.date));

    return commits;
  }

  /**
   * Track feature development by finding related commits
   * @param {string} keyword - Keyword to search in commit messages
   * @returns {Array} Related commits
   */
  getFeatureDevelopmentHistory(keyword) {
    const commits = [];
    const keywordLower = keyword.toLowerCase();

    for (const [id, entity] of this.entities) {
      if (entity.type === 'Commit') {
        const message = entity.properties.message.toLowerCase();
        if (message.includes(keywordLower)) {
          commits.push({
            commit: entity,
            date: entity.properties.date,
            author: entity.properties.author,
            message: entity.properties.message
          });
        }
      }
    }

    // Sort by date (oldest first for feature development tracking)
    commits.sort((a, b) => new Date(a.date) - new Date(b.date));

    return commits;
  }

  /**
   * Get commit statistics for a user
   * @param {string} userIdentifier - User name or email
   * @returns {Object} User commit statistics
   */
  getUserCommitStats(userIdentifier) {
    const userLower = userIdentifier.toLowerCase();
    const commits = [];

    for (const [id, entity] of this.entities) {
      if (entity.type === 'Commit') {
        const author = entity.properties.author.toLowerCase();
        const email = entity.properties.author_email.toLowerCase();

        if (author.includes(userLower) || email.includes(userLower)) {
          commits.push(entity);
        }
      }
    }

    // Calculate statistics
    const stats = {
      totalCommits: commits.length,
      firstCommit: null,
      lastCommit: null,
      filesModified: new Set(),
      issuesFixed: new Set(),
      commitsByMonth: {}
    };

    if (commits.length === 0) {
      return stats;
    }

    // Sort by date
    commits.sort((a, b) => new Date(a.properties.date) - new Date(b.properties.date));

    stats.firstCommit = commits[0];
    stats.lastCommit = commits[commits.length - 1];

    // Analyze commits
    for (const commit of commits) {
      // Count files modified
      const fileRelations = this.getRelations(commit.id, 'outgoing');
      for (const rel of fileRelations) {
        if (rel.type === 'commit_modifies_file') {
          stats.filesModified.add(rel.to);
        }
        if (rel.type === 'commit_fixes_issue') {
          stats.issuesFixed.add(rel.properties.issue_number);
        }
      }

      // Count commits by month
      const date = new Date(commit.properties.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      stats.commitsByMonth[monthKey] = (stats.commitsByMonth[monthKey] || 0) + 1;
    }

    stats.filesModified = stats.filesModified.size;
    stats.issuesFixed = stats.issuesFixed.size;

    return stats;
  }

  /**
   * Apply advanced filters to search results
   * @param {Array} results - Search results
   * @param {Object} filters - Filter options
   * @returns {Array} Filtered results
   */
  applyAdvancedFilters(results, filters) {
    const {
      dateFrom,
      dateTo,
      dateField,
      authors,
      state,
      labels,
      labelLogic
    } = filters;

    return results.filter(result => {
      const entity = result.entity;

      // Date range filter
      if (dateFrom || dateTo) {
        const dateValue = entity.properties?.[dateField];
        if (!dateValue) return false;

        const entityDate = new Date(dateValue);
        if (dateFrom && entityDate < new Date(dateFrom)) return false;
        if (dateTo && entityDate > new Date(dateTo)) return false;
      }

      // Author filter
      if (authors && authors.length > 0) {
        const entityAuthor = entity.properties?.author || entity.properties?.user;
        if (!entityAuthor) return false;

        const authorLogin = typeof entityAuthor === 'string' ? entityAuthor : entityAuthor.login;
        if (!authors.includes(authorLogin)) return false;
      }

      // State filter
      if (state && state !== 'all') {
        const entityState = entity.properties?.state;
        if (!entityState) return false;

        if (state === 'merged') {
          // For PRs: check if merged
          if (entity.type !== 'PullRequest' || !entity.properties?.merged_at) return false;
        } else {
          // For issues and PRs: check state
          if (entityState !== state) return false;
        }
      }

      // Labels filter
      if (labels && labels.length > 0) {
        // Get labels for this entity by finding label relations
        const entityLabels = [];
        for (const relation of this.relations.values()) {
          if (relation.type === 'has_label' && relation.from === entity.id) {
            const labelEntity = this.getEntity(relation.to);
            if (labelEntity) {
              entityLabels.push(labelEntity.name);
            }
          }
        }

        if (labelLogic === 'AND') {
          // ALL labels must match
          if (!labels.every(label => entityLabels.includes(label))) return false;
        } else {
          // ANY label must match (OR logic)
          if (!labels.some(label => entityLabels.includes(label))) return false;
        }
      }

      return true;
    });
  }

  /**
   * Get knowledge graph statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const entityTypes = {};
    const relationTypes = {};

    for (const entity of this.entities.values()) {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    }

    for (const relation of this.relations.values()) {
      relationTypes[relation.type] = (relationTypes[relation.type] || 0) + 1;
    }

    return {
      totalEntities: this.entities.size,
      totalRelations: this.relations.size,
      entityTypes,
      relationTypes
    };
  }

  /**
   * Save knowledge graph to disk
   */
  async saveKnowledgeGraph() {
    const graphFile = path.join(this.dataDir, 'knowledge_graph.json');

    const data = {
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations.values()),
      metadata: {
        savedAt: new Date().toISOString(),
        stats: this.getStats()
      }
    };

    await fs.writeFile(graphFile, JSON.stringify(data, null, 2));
    logger.info('Knowledge graph saved', { file: graphFile });

    // Create snapshot (versioning)
    try {
      await this.versionManager.createSnapshot(data, {
        source: 'saveKnowledgeGraph',
        stats: data.metadata.stats
      });
    } catch (error) {
      logger.error('Failed to create snapshot', { error: error.message });
    }
  }

  /**
   * Load knowledge graph from disk
   */
  async loadKnowledgeGraph() {
    const graphFile = path.join(this.dataDir, 'knowledge_graph.json');
    logger.info('[KAG] Loading knowledge graph from file', { graphFile });

    try {
      const data = await fs.readFile(graphFile, 'utf-8');
      const graph = JSON.parse(data);
      logger.info('[KAG] Parsed graph data', {
        entitiesCount: graph.entities?.length,
        relationsCount: graph.relations?.length
      });

      // Load entities
      this.entities.clear();
      for (const entity of graph.entities) {
        this.entities.set(entity.id, entity);
      }
      logger.info('[KAG] Loaded entities into map', { count: this.entities.size });

      // Load relations
      this.relations.clear();
      for (const relation of graph.relations) {
        this.relations.set(relation.id, relation);
      }
      logger.info('[KAG] Loaded relations into map', { count: this.relations.size });

      logger.info('[KAG] Knowledge graph loaded successfully', {
        entities: this.entities.size,
        relations: this.relations.size
      });
    } catch (error) {
      logger.error('[KAG] Error loading knowledge graph', {
        error: error.message,
        code: error.code,
        graphFile
      });
      if (error.code === 'ENOENT') {
        logger.info('[KAG] No existing knowledge graph found, starting fresh');
      }
    }
  }

  /**
   * Answer question using RAG pipeline
   * @param {string} question - User's question
   * @param {Object} options - RAG options
   * @returns {Promise<Object>} Answer with sources
   */
  async answerQuestion(question, options = {}) {
    await this.initialize();

    const {
      llmCoordinator = null,
      accessToken = null,
      modelId = null,
      maxSources = 5,
      minScore = 0.3,
      temperature = 0.2,
      maxTokens = 2000,
      conversationHistory = []
    } = options;

    if (!llmCoordinator) {
      throw new Error('LLM coordinator is required for RAG');
    }

    if (!accessToken || !modelId) {
      throw new Error('Access token and model ID are required for RAG');
    }

    logger.info('[KAG RAG] Starting question answering', { question, maxSources, minScore });

    // Step 1: RETRIEVE - Search knowledge base for relevant entities
    const searchResults = await this.search(question, {
      limit: maxSources,
      minScore
    });

    logger.info('[KAG RAG] Retrieved search results', {
      resultsCount: searchResults.length,
      topScore: searchResults[0]?.score || 0
    });

    // Step 2: AUGMENT - Build context from search results
    const context = this._buildContext(searchResults);
    const sources = searchResults.map(r => ({
      id: r.entity.id,
      type: r.entity.type,
      name: r.entity.name,
      score: r.score,
      url: r.entity.properties?.url || null
    }));

    logger.info('[KAG RAG] Built context', {
      contextLength: context.length,
      sourcesCount: sources.length
    });

    // Step 3: GENERATE - Use LLM to answer with context
    const prompt = this._buildPrompt(question, context, conversationHistory);

    logger.info('[KAG RAG] Calling LLM', {
      promptLength: prompt.length,
      temperature,
      maxTokens
    });

    try {
      const llmResponse = await llmCoordinator.chatWithToken(
        accessToken,
        modelId,
        prompt,
        {
          application: 'KnowledgeBase',
          operation: 'rag_answer',
          temperature,
          maxTokens,
          systemPrompt: 'Ты - помощник по проекту DronDoc2025. Отвечай точно, используя предоставленный контекст из базы знаний. Если информации недостаточно, честно скажи об этом.'
        }
      );

      const answer = llmResponse.content || llmResponse.response || 'Извините, не удалось получить ответ.';

      logger.info('[KAG RAG] Answer generated successfully', {
        answerLength: answer.length,
        usage: llmResponse.usage
      });

      return {
        success: true,
        answer,
        sources,
        usage: llmResponse.usage || null,
        metadata: {
          retrievedDocs: searchResults.length,
          contextLength: context.length,
          model: modelId,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('[KAG RAG] Failed to generate answer', { error: error.message });
      throw new Error(`RAG pipeline failed: ${error.message}`);
    }
  }

  /**
   * Build context from search results
   * @param {Array} searchResults - Search results
   * @returns {string} Context string
   * @private
   */
  _buildContext(searchResults) {
    const contextParts = [];

    for (const result of searchResults) {
      const entity = result.entity;
      const parts = [
        `[${entity.type}] ${entity.name}`,
        `Score: ${result.score.toFixed(2)}`
      ];

      // Add key properties
      if (entity.properties) {
        const importantProps = ['title', 'state', 'author', 'created_at', 'url'];
        for (const prop of importantProps) {
          if (entity.properties[prop]) {
            parts.push(`${prop}: ${entity.properties[prop]}`);
          }
        }
      }

      // Add observations (limit to first 3 to prevent huge context)
      if (entity.observations && entity.observations.length > 0) {
        const observations = entity.observations.slice(0, 3).join('\n');
        parts.push(`\nInformation:\n${observations}`);
      }

      contextParts.push(parts.join('\n'));
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Build prompt for LLM
   * @param {string} question - User's question
   * @param {string} context - Retrieved context
   * @param {Array} conversationHistory - Previous messages
   * @returns {string} Prompt
   * @private
   */
  _buildPrompt(question, context, conversationHistory = []) {
    let prompt = '';

    // Add conversation history if provided
    if (conversationHistory.length > 0) {
      prompt += 'ИСТОРИЯ РАЗГОВОРА:\n';
      for (const msg of conversationHistory) {
        prompt += `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}\n`;
      }
      prompt += '\n';
    }

    // Add context from knowledge base
    prompt += 'КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:\n';
    prompt += context;
    prompt += '\n\n';

    // Add current question
    prompt += 'ВОПРОС ПОЛЬЗОВАТЕЛЯ:\n';
    prompt += question;
    prompt += '\n\n';

    // Add instruction
    prompt += 'Дай подробный и точный ответ на русском языке, используя информацию из контекста. ';
    prompt += 'Если в контексте недостаточно информации для полного ответа, честно скажи об этом и укажи, какой информации не хватает. ';
    prompt += 'Ссылайся на источники из контекста (Issues, PRs, файлы) когда это уместно.';

    return prompt;
  }

  /**
   * Export knowledge graph to MCP Memory format
   * @returns {Object} MCP Memory compatible format
   */
  /**
   * Get available filter options (authors, labels, states)
   * @returns {Object} Filter options
   */
  getFilterOptions() {
    const authors = new Set();
    const labels = new Set();
    const states = new Set();

    for (const entity of this.entities.values()) {
      // Collect authors
      if (entity.properties?.author) {
        const author = typeof entity.properties.author === 'string'
          ? entity.properties.author
          : entity.properties.author.login;
        if (author) authors.add(author);
      }
      if (entity.properties?.user) {
        const user = typeof entity.properties.user === 'string'
          ? entity.properties.user
          : entity.properties.user.login;
        if (user) authors.add(user);
      }

      // Collect states (for issues and PRs)
      if (entity.type === 'Issue' || entity.type === 'PullRequest') {
        if (entity.properties?.state) {
          states.add(entity.properties.state);
        }
        // Add 'merged' for PRs
        if (entity.type === 'PullRequest' && entity.properties?.merged_at) {
          states.add('merged');
        }
      }

      // Collect labels
      if (entity.type === 'Label') {
        labels.add(entity.name);
      }
    }

    return {
      authors: Array.from(authors).sort(),
      labels: Array.from(labels).sort(),
      states: Array.from(states).sort()
    };
  }

  exportToMCPMemory() {
    const mcpEntities = [];
    const mcpRelations = [];

    for (const entity of this.entities.values()) {
      mcpEntities.push({
        name: entity.name,
        entityType: entity.type,
        observations: entity.observations || [JSON.stringify(entity.properties)]
      });
    }

    for (const relation of this.relations.values()) {
      const fromEntity = this.entities.get(relation.from);
      const toEntity = this.entities.get(relation.to);

      if (fromEntity && toEntity) {
        mcpRelations.push({
          from: fromEntity.name,
          to: toEntity.name,
          relationType: relation.type
        });
      }
    }

    return {
      entities: mcpEntities,
      relations: mcpRelations
    };
  }

  /**
   * Update files from push event (webhook)
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateFilesFromPush(options) {
    await this.initialize();

    const { addedFiles = [], modifiedFiles = [], removedFiles = [], ref } = options;

    logger.info('[KAG Webhook] Updating files from push', {
      added: addedFiles.length,
      modified: modifiedFiles.length,
      removed: removedFiles.length,
      ref
    });

    let updated = 0;
    let added = 0;
    let removed = 0;

    try {
      // Handle removed files - delete entities
      for (const filePath of removedFiles) {
        const fileId = `file_${filePath.replace(/[\/\.]/g, '_')}`;
        const entity = this.entities.get(fileId);

        if (entity) {
          this.entities.delete(fileId);

          // Remove all relations involving this file
          for (const [relationId, relation] of this.relations) {
            if (relation.from === fileId || relation.to === fileId) {
              this.relations.delete(relationId);
            }
          }

          removed++;
          logger.debug('[KAG Webhook] File entity removed', { filePath });
        }
      }

      // Handle added and modified files - re-index them
      const filesToIndex = [...addedFiles, ...modifiedFiles];

      for (const filePath of filesToIndex) {
        try {
          // Check if file is supported code file
          if (!this.codeParser.isSupported(filePath)) {
            continue;
          }

          // Fetch file content from GitHub
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: filePath
          });

          if (data.type !== 'file') continue;

          const content = Buffer.from(data.content, 'base64').toString('utf-8');

          // Parse file structure
          const structure = this.codeParser.parseFile(filePath, content);
          if (!structure) continue;

          // Create or update file entity
          const fileId = `file_${filePath.replace(/[\/\.]/g, '_')}`;
          const fileEntity = {
            id: fileId,
            type: structure.type || 'CodeFile',
            name: filePath,
            properties: {
              path: filePath,
              url: data.html_url,
              size: data.size,
              sha: data.sha,
              extension: filePath.substring(filePath.lastIndexOf('.')),
              ...structure
            },
            observations: [
              `File: ${filePath}`,
              `Type: ${structure.type}`,
              `Size: ${data.size} bytes`,
              `Functions: ${structure.functions?.length || 0}`,
              `Classes: ${structure.classes?.length || 0}`,
              `Imports: ${structure.imports?.length || 0}`,
              content.substring(0, 5000)
            ]
          };

          // Determine if this is new or update
          const isNew = !this.entities.has(fileId);

          this.addOrUpdateEntity(fileEntity);

          if (isNew) {
            added++;
          } else {
            updated++;
          }

          logger.debug('[KAG Webhook] File entity updated', { filePath, isNew });
        } catch (error) {
          logger.warn(`[KAG Webhook] Failed to update file ${filePath}`, { error: error.message });
        }
      }

      // Save updated knowledge graph
      await this.saveKnowledgeGraph();

      logger.info('[KAG Webhook] Files updated successfully', { updated, added, removed });

      return { updated, added, removed };
    } catch (error) {
      logger.error('[KAG Webhook] Failed to update files from push', { error: error.message });
      throw error;
    }
  }

  /**
   * Update pull request entity (webhook)
   * @param {Object} prData - PR data from webhook
   * @returns {Promise<Object>} Update result
   */
  async updatePullRequest(prData) {
    await this.initialize();

    const { number, title, body, state, merged, url, created_at, updated_at, merged_at, closed_at, author, base_branch, head_branch } = prData;

    logger.info('[KAG Webhook] Updating PR entity', { number, title });

    try {
      const prEntity = {
        id: `pr_${number}`,
        type: 'PullRequest',
        name: `PR #${number}: ${title}`,
        properties: {
          number,
          title,
          body: body || '',
          state,
          merged,
          url,
          created_at,
          updated_at,
          merged_at,
          closed_at,
          author,
          base_branch,
          head_branch
        },
        observations: [
          `Pull Request #${number}`,
          `Title: ${title}`,
          `State: ${state}`,
          `Merged: ${merged ? 'Yes' : 'No'}`,
          `Created: ${created_at}`,
          `Author: ${author}`,
          `Base: ${base_branch} ← Head: ${head_branch}`,
          ...(body ? [body.substring(0, 500)] : [])
        ]
      };

      this.addOrUpdateEntity(prEntity);

      // Update author entity
      const authorEntity = {
        id: `user_${author}`,
        type: 'User',
        name: author,
        properties: {
          login: author
        }
      };

      this.addOrUpdateEntity(authorEntity);

      // Add created_by relation
      this.addRelation({
        from: prEntity.id,
        to: authorEntity.id,
        type: 'created_by'
      });

      // Save updated knowledge graph
      await this.saveKnowledgeGraph();

      logger.info('[KAG Webhook] PR entity updated successfully', { number });

      return { updated: true };
    } catch (error) {
      logger.error('[KAG Webhook] Failed to update PR entity', { number, error: error.message });
      throw error;
    }
  }

  /**
   * Update issue entity (webhook)
   * @param {Object} issueData - Issue data from webhook
   * @returns {Promise<Object>} Update result
   */
  async updateIssue(issueData) {
    await this.initialize();

    const { number, title, body, state, url, created_at, updated_at, closed_at, author, labels } = issueData;

    logger.info('[KAG Webhook] Updating issue entity', { number, title });

    try {
      const issueEntity = {
        id: `issue_${number}`,
        type: 'Issue',
        name: `Issue #${number}: ${title}`,
        properties: {
          number,
          title,
          body: body || '',
          state,
          url,
          created_at,
          updated_at,
          closed_at,
          author,
          labels
        },
        observations: [
          `Issue #${number}`,
          `Title: ${title}`,
          `State: ${state}`,
          `Created: ${created_at}`,
          `Author: ${author}`,
          ...(labels.length > 0 ? [`Labels: ${labels.join(', ')}`] : []),
          ...(body ? [body.substring(0, 500)] : [])
        ]
      };

      this.addOrUpdateEntity(issueEntity);

      // Update author entity
      const authorEntity = {
        id: `user_${author}`,
        type: 'User',
        name: author,
        properties: {
          login: author
        }
      };

      this.addOrUpdateEntity(authorEntity);

      // Add created_by relation
      this.addRelation({
        from: issueEntity.id,
        to: authorEntity.id,
        type: 'created_by'
      });

      // Update label relations
      for (const labelName of labels) {
        const labelEntity = {
          id: `label_${labelName}`,
          type: 'Label',
          name: labelName,
          properties: {
            name: labelName
          }
        };

        this.addOrUpdateEntity(labelEntity);

        this.addRelation({
          from: issueEntity.id,
          to: labelEntity.id,
          type: 'has_label'
        });
      }

      // Save updated knowledge graph
      await this.saveKnowledgeGraph();

      logger.info('[KAG Webhook] Issue entity updated successfully', { number });

      return { updated: true };
    } catch (error) {
      logger.error('[KAG Webhook] Failed to update issue entity', { number, error: error.message });
      throw error;
    }
  }

  /**
   * Update issue with comment (webhook)
   * @param {Object} data - Issue comment data
   * @returns {Promise<Object>} Update result
   */
  async updateIssueWithComment(data) {
    await this.initialize();

    const { issueNumber, comment } = data;

    logger.info('[KAG Webhook] Adding comment to issue entity', { issueNumber, commentId: comment.id });

    try {
      const issueId = `issue_${issueNumber}`;
      const issueEntity = this.entities.get(issueId);

      if (!issueEntity) {
        logger.warn('[KAG Webhook] Issue entity not found, cannot add comment', { issueNumber });
        return { updated: false, reason: 'issue not found' };
      }

      // Add comment as observation
      const commentObservation = `Comment by ${comment.author} at ${comment.created_at}: ${comment.body.substring(0, 300)}`;

      if (!issueEntity.observations) {
        issueEntity.observations = [];
      }

      issueEntity.observations.push(commentObservation);

      // Update entity
      this.entities.set(issueId, issueEntity);

      // Save updated knowledge graph
      await this.saveKnowledgeGraph();

      logger.info('[KAG Webhook] Issue comment added successfully', { issueNumber, commentId: comment.id });

      return { updated: true };
    } catch (error) {
      logger.error('[KAG Webhook] Failed to add comment to issue', { issueNumber, error: error.message });
      throw error;
    }
  }

  /**
   * Export knowledge graph to JSON format
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  exportToJSON(options = {}) {
    const {
      includeMetadata = true,
      includeEmbeddings = false,
      version = '1.0.0'
    } = options;

    logger.info('[KAG Export] Exporting to JSON', {
      entities: this.entities.size,
      relations: this.relations.size,
      includeMetadata,
      includeEmbeddings
    });

    const data = {
      format: 'kag-json',
      version,
      exportedAt: new Date().toISOString(),
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations.values())
    };

    if (includeMetadata) {
      data.metadata = {
        stats: this.getStats(),
        repository: {
          owner: this.owner,
          repo: this.repo
        }
      };
    }

    return data;
  }

  /**
   * Export knowledge graph to CSV format (entities and relations as separate files)
   * @returns {Object} CSV data with entities and relations
   */
  exportToCSV() {
    logger.info('[KAG Export] Exporting to CSV', {
      entities: this.entities.size,
      relations: this.relations.size
    });

    // Entities CSV
    const entitiesHeader = ['id', 'type', 'name', 'properties', 'observations'];
    const entitiesRows = Array.from(this.entities.values()).map(entity => [
      entity.id,
      entity.type,
      entity.name || '',
      JSON.stringify(entity.properties || {}),
      JSON.stringify(entity.observations || [])
    ]);

    const entitiesCSV = [
      entitiesHeader.join(','),
      ...entitiesRows.map(row => row.map(cell => {
        // Escape CSV cells
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    // Relations CSV
    const relationsHeader = ['id', 'from', 'to', 'type', 'properties'];
    const relationsRows = Array.from(this.relations.values()).map(relation => [
      relation.id,
      relation.from,
      relation.to,
      relation.type,
      JSON.stringify(relation.properties || {})
    ]);

    const relationsCSV = [
      relationsHeader.join(','),
      ...relationsRows.map(row => row.map(cell => {
        // Escape CSV cells
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    return {
      entities: entitiesCSV,
      relations: relationsCSV,
      metadata: {
        exportedAt: new Date().toISOString(),
        stats: this.getStats()
      }
    };
  }

  /**
   * Export knowledge graph to GraphML format
   * @returns {string} GraphML XML
   */
  exportToGraphML() {
    logger.info('[KAG Export] Exporting to GraphML', {
      entities: this.entities.size,
      relations: this.relations.size
    });

    // Build GraphML XML
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
    lines.push('    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    lines.push('    xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns');
    lines.push('    http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');

    // Define keys for node and edge attributes
    lines.push('  <key id="type" for="node" attr.name="type" attr.type="string"/>');
    lines.push('  <key id="name" for="node" attr.name="name" attr.type="string"/>');
    lines.push('  <key id="properties" for="node" attr.name="properties" attr.type="string"/>');
    lines.push('  <key id="observations" for="node" attr.name="observations" attr.type="string"/>');
    lines.push('  <key id="relType" for="edge" attr.name="type" attr.type="string"/>');
    lines.push('  <key id="relProps" for="edge" attr.name="properties" attr.type="string"/>');

    lines.push('  <graph id="KAG" edgedefault="directed">');

    // Add nodes (entities)
    for (const entity of this.entities.values()) {
      const xmlId = this._escapeXML(entity.id);
      lines.push(`    <node id="${xmlId}">`);
      lines.push(`      <data key="type">${this._escapeXML(entity.type)}</data>`);
      if (entity.name) {
        lines.push(`      <data key="name">${this._escapeXML(entity.name)}</data>`);
      }
      if (entity.properties) {
        lines.push(`      <data key="properties">${this._escapeXML(JSON.stringify(entity.properties))}</data>`);
      }
      if (entity.observations) {
        lines.push(`      <data key="observations">${this._escapeXML(JSON.stringify(entity.observations))}</data>`);
      }
      lines.push('    </node>');
    }

    // Add edges (relations)
    let edgeId = 0;
    for (const relation of this.relations.values()) {
      const source = this._escapeXML(relation.from);
      const target = this._escapeXML(relation.to);
      lines.push(`    <edge id="e${edgeId++}" source="${source}" target="${target}">`);
      lines.push(`      <data key="relType">${this._escapeXML(relation.type)}</data>`);
      if (relation.properties) {
        lines.push(`      <data key="relProps">${this._escapeXML(JSON.stringify(relation.properties))}</data>`);
      }
      lines.push('    </edge>');
    }

    lines.push('  </graph>');
    lines.push('</graphml>');

    return lines.join('\n');
  }

  /**
   * Import knowledge graph from JSON format
   * @param {Object} data - Imported JSON data
   * @param {Object} options - Import options
   * @returns {Object} Import results
   */
  async importFromJSON(data, options = {}) {
    const {
      mode = 'merge',  // 'merge' or 'replace'
      validate = true
    } = options;

    logger.info('[KAG Import] Importing from JSON', { mode, validate });

    // Validate format
    if (validate) {
      if (!data.format || data.format !== 'kag-json') {
        throw new Error('Invalid format: expected kag-json');
      }
      if (!data.entities || !Array.isArray(data.entities)) {
        throw new Error('Invalid data: entities must be an array');
      }
      if (!data.relations || !Array.isArray(data.relations)) {
        throw new Error('Invalid data: relations must be an array');
      }
    }

    await this.initialize();

    const stats = {
      entitiesAdded: 0,
      entitiesUpdated: 0,
      relationsAdded: 0,
      errors: []
    };

    // Replace mode: clear existing data
    if (mode === 'replace') {
      logger.info('[KAG Import] Clearing existing knowledge graph');
      this.entities.clear();
      this.relations.clear();
      await this.vectorStore.clear();
    }

    // Import entities
    for (const entity of data.entities) {
      try {
        const existed = this.entities.has(entity.id);
        this.addEntity(entity);
        if (existed) {
          stats.entitiesUpdated++;
        } else {
          stats.entitiesAdded++;
        }
      } catch (error) {
        logger.error('[KAG Import] Failed to import entity', {
          entityId: entity.id,
          error: error.message
        });
        stats.errors.push(`Entity ${entity.id}: ${error.message}`);
      }
    }

    // Import relations
    for (const relation of data.relations) {
      try {
        const relationId = `${relation.from}_${relation.type}_${relation.to}`;
        const existed = this.relations.has(relationId);
        this.addRelation(relation);
        if (!existed) {
          stats.relationsAdded++;
        }
      } catch (error) {
        logger.error('[KAG Import] Failed to import relation', {
          relation,
          error: error.message
        });
        stats.errors.push(`Relation ${relation.from}->${relation.to}: ${error.message}`);
      }
    }

    // Save knowledge graph
    await this.saveKnowledgeGraph();

    // Regenerate embeddings
    logger.info('[KAG Import] Regenerating embeddings...');
    const embeddingsCount = await this.generateAllEmbeddings();
    stats.embeddingsGenerated = embeddingsCount;

    logger.info('[KAG Import] Import complete', stats);

    return {
      success: true,
      stats,
      metadata: data.metadata || null
    };
  }

  /**
   * Import knowledge graph from CSV format
   * @param {Object} csvData - CSV data with entities and relations
   * @param {Object} options - Import options
   * @returns {Object} Import results
   */
  async importFromCSV(csvData, options = {}) {
    const { mode = 'merge' } = options;

    logger.info('[KAG Import] Importing from CSV', { mode });

    await this.initialize();

    const stats = {
      entitiesAdded: 0,
      entitiesUpdated: 0,
      relationsAdded: 0,
      errors: []
    };

    // Replace mode: clear existing data
    if (mode === 'replace') {
      logger.info('[KAG Import] Clearing existing knowledge graph');
      this.entities.clear();
      this.relations.clear();
      await this.vectorStore.clear();
    }

    // Parse entities CSV
    if (csvData.entities) {
      const rows = csvData.entities.split('\n').filter(row => row.trim());
      const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

      for (let i = 1; i < rows.length; i++) {
        try {
          const values = this._parseCSVRow(rows[i]);
          const entity = {
            id: values[0],
            type: values[1],
            name: values[2],
            properties: values[3] ? JSON.parse(values[3]) : {},
            observations: values[4] ? JSON.parse(values[4]) : []
          };

          const existed = this.entities.has(entity.id);
          this.addEntity(entity);
          if (existed) {
            stats.entitiesUpdated++;
          } else {
            stats.entitiesAdded++;
          }
        } catch (error) {
          logger.error('[KAG Import] Failed to parse entity row', {
            row: i,
            error: error.message
          });
          stats.errors.push(`Entity row ${i}: ${error.message}`);
        }
      }
    }

    // Parse relations CSV
    if (csvData.relations) {
      const rows = csvData.relations.split('\n').filter(row => row.trim());
      const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

      for (let i = 1; i < rows.length; i++) {
        try {
          const values = this._parseCSVRow(rows[i]);
          const relation = {
            from: values[1],
            to: values[2],
            type: values[3],
            properties: values[4] ? JSON.parse(values[4]) : {}
          };

          this.addRelation(relation);
          stats.relationsAdded++;
        } catch (error) {
          logger.error('[KAG Import] Failed to parse relation row', {
            row: i,
            error: error.message
          });
          stats.errors.push(`Relation row ${i}: ${error.message}`);
        }
      }
    }

    // Save knowledge graph
    await this.saveKnowledgeGraph();

    // Regenerate embeddings
    logger.info('[KAG Import] Regenerating embeddings...');
    const embeddingsCount = await this.generateAllEmbeddings();
    stats.embeddingsGenerated = embeddingsCount;

    logger.info('[KAG Import] Import complete', stats);

    return {
      success: true,
      stats
    };
  }

  /**
   * Parse a CSV row handling quoted fields
   * @param {string} row - CSV row
   * @returns {Array} Parsed values
   */
  _parseCSVRow(row) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current);

    return values;
  }

  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  _escapeXML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Singleton instance - reset on code change to pick up new VectorStore version
let kagServiceInstance = null;
const KAG_CODE_VERSION = 'v5097-fix-4-debug-chroma-disabled';

export function getKAGService() {
  // Force recreation on code change to get new VectorStore instance
  if (!kagServiceInstance || kagServiceInstance.codeVersion !== KAG_CODE_VERSION) {
    console.log(`[KAG] Creating new KAGService instance with version ${KAG_CODE_VERSION}`);
    kagServiceInstance = new KAGService();
    kagServiceInstance.codeVersion = KAG_CODE_VERSION;
  }
  return kagServiceInstance;
}

export default KAGService;

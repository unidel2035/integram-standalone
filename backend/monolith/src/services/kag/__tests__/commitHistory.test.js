/**
 * Tests for KAG Commit History Indexing
 * Issue #5075
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import KAGService from '../KAGService.js';

// Mock Octokit
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        repos: {
          listCommits: vi.fn(),
          getCommit: vi.fn()
        },
        issues: {
          listForRepo: vi.fn()
        },
        pulls: {
          list: vi.fn()
        }
      }
    }))
  };
});

describe('KAG Commit History Indexing', () => {
  let kagService;
  let mockOctokit;

  beforeEach(() => {
    kagService = new KAGService();
    mockOctokit = kagService.octokit;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('indexCommitHistory', () => {
    it('should index commits successfully', async () => {
      // Mock commit data
      const mockCommits = {
        data: [
          {
            sha: 'abc123def456',
            commit: {
              message: 'feat: Add new feature',
              author: {
                name: 'John Doe',
                email: 'john@example.com',
                date: '2025-01-15T10:00:00Z'
              },
              committer: {
                name: 'John Doe',
                email: 'john@example.com',
                date: '2025-01-15T10:00:00Z'
              },
              verification: {
                verified: true
              }
            },
            html_url: 'https://github.com/test/repo/commit/abc123',
            author: {
              login: 'johndoe'
            }
          }
        ]
      };

      const mockCommitDetails = {
        data: {
          files: [
            {
              filename: 'src/feature.js',
              status: 'added',
              additions: 100,
              deletions: 0,
              changes: 100,
              patch: '@@ -0,0 +1,100 @@\n+function newFeature() {}'
            }
          ]
        }
      };

      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitDetails);

      const result = await kagService.indexCommitHistory({ max: 10 });

      expect(result.indexed).toBe(1);
      expect(result.entities).toBeGreaterThan(0);
      expect(result.relations).toBeGreaterThan(0);
    });

    it('should create commit entities with correct properties', async () => {
      const mockCommits = {
        data: [
          {
            sha: 'abc123def456',
            commit: {
              message: 'fix: Fix bug in feature',
              author: {
                name: 'Jane Smith',
                email: 'jane@example.com',
                date: '2025-01-16T14:30:00Z'
              },
              committer: {
                name: 'Jane Smith',
                email: 'jane@example.com',
                date: '2025-01-16T14:30:00Z'
              },
              verification: {
                verified: false
              }
            },
            html_url: 'https://github.com/test/repo/commit/abc123',
            author: {
              login: 'janesmith'
            }
          }
        ]
      };

      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.getCommit.mockResolvedValue({ data: { files: [] } });

      await kagService.indexCommitHistory({ max: 10 });

      const commitEntity = kagService.getEntity('commit_abc123de');

      expect(commitEntity).toBeDefined();
      expect(commitEntity.type).toBe('Commit');
      expect(commitEntity.properties.sha).toBe('abc123def456');
      expect(commitEntity.properties.author).toBe('Jane Smith');
      expect(commitEntity.properties.message).toBe('fix: Fix bug in feature');
    });

    it('should create temporal relations for modified files', async () => {
      const mockCommits = {
        data: [
          {
            sha: 'def456ghi789',
            commit: {
              message: 'refactor: Refactor code',
              author: {
                name: 'Bob Wilson',
                email: 'bob@example.com',
                date: '2025-01-17T09:15:00Z'
              },
              committer: {
                name: 'Bob Wilson',
                email: 'bob@example.com',
                date: '2025-01-17T09:15:00Z'
              }
            },
            html_url: 'https://github.com/test/repo/commit/def456',
            author: {
              login: 'bobwilson'
            }
          }
        ]
      };

      const mockCommitDetails = {
        data: {
          files: [
            {
              filename: 'src/utils.js',
              status: 'modified',
              additions: 50,
              deletions: 30,
              changes: 80
            },
            {
              filename: 'src/helpers.js',
              status: 'added',
              additions: 100,
              deletions: 0,
              changes: 100
            }
          ]
        }
      };

      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitDetails);

      await kagService.indexCommitHistory({ max: 10 });

      const relations = kagService.getRelations('commit_def456gh', 'outgoing');
      const fileRelations = relations.filter(r => r.type === 'commit_modifies_file');

      expect(fileRelations.length).toBeGreaterThanOrEqual(2);

      const utilsRelation = fileRelations.find(r => r.to === 'file_src_utils_js');
      expect(utilsRelation).toBeDefined();
      expect(utilsRelation.properties.status).toBe('modified');
      expect(utilsRelation.properties.additions).toBe(50);
      expect(utilsRelation.properties.deletions).toBe(30);
    });

    it('should extract issue references from commit messages', async () => {
      const mockCommits = {
        data: [
          {
            sha: 'issue123commit',
            commit: {
              message: 'fix: Fix authentication bug\n\nFixes #123\nResolves #456',
              author: {
                name: 'Alice Brown',
                email: 'alice@example.com',
                date: '2025-01-18T11:45:00Z'
              },
              committer: {
                name: 'Alice Brown',
                email: 'alice@example.com',
                date: '2025-01-18T11:45:00Z'
              }
            },
            html_url: 'https://github.com/test/repo/commit/issue123',
            author: {
              login: 'alicebrown'
            }
          }
        ]
      };

      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.getCommit.mockResolvedValue({ data: { files: [] } });

      await kagService.indexCommitHistory({ max: 10 });

      const relations = kagService.getRelations('commit_issue123', 'outgoing');
      const issueRelations = relations.filter(
        r => r.type === 'commit_fixes_issue' || r.type === 'commit_references_issue'
      );

      expect(issueRelations.length).toBeGreaterThan(0);

      const issue123Relation = issueRelations.find(r => r.to === 'issue_123');
      expect(issue123Relation).toBeDefined();
      expect(issue123Relation.type).toBe('commit_fixes_issue');
    });

    it('should extract PR references from commit messages', async () => {
      const mockCommits = {
        data: [
          {
            sha: 'pr456commit789',
            commit: {
              message: 'Merge pull request #456 from feature/new-ui\n\nAdd new UI components',
              author: {
                name: 'GitHub',
                email: 'noreply@github.com',
                date: '2025-01-19T16:00:00Z'
              },
              committer: {
                name: 'GitHub',
                email: 'noreply@github.com',
                date: '2025-01-19T16:00:00Z'
              }
            },
            html_url: 'https://github.com/test/repo/commit/pr456commit',
            author: null
          }
        ]
      };

      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.getCommit.mockResolvedValue({ data: { files: [] } });

      await kagService.indexCommitHistory({ max: 10 });

      const relations = kagService.getRelations('commit_pr456com', 'outgoing');
      const prRelations = relations.filter(r => r.type === 'commit_part_of_pr');

      expect(prRelations.length).toBeGreaterThan(0);

      const pr456Relation = prRelations.find(r => r.to === 'pr_456');
      expect(pr456Relation).toBeDefined();
      expect(pr456Relation.properties.pr_number).toBe('456');
    });

    it('should handle errors gracefully', async () => {
      mockOctokit.rest.repos.listCommits.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await kagService.indexCommitHistory({ max: 10 });

      expect(result.indexed).toBe(0);
      expect(result.entities).toBe(0);
      expect(result.relations).toBe(0);
    });
  });

  describe('getFileHistory', () => {
    beforeEach(async () => {
      // Setup test data
      kagService.addEntity({
        id: 'commit_abc123de',
        type: 'Commit',
        name: 'Commit abc123de',
        properties: {
          sha: 'abc123def456',
          message: 'Update README',
          author: 'John Doe',
          date: '2025-01-15T10:00:00Z'
        }
      });

      kagService.addEntity({
        id: 'file_README_md',
        type: 'File',
        name: 'README.md',
        properties: {
          path: 'README.md'
        }
      });

      kagService.addRelation({
        from: 'commit_abc123de',
        to: 'file_README_md',
        type: 'commit_modifies_file',
        properties: {
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15
        }
      });
    });

    it('should return file history', () => {
      const history = kagService.getFileHistory('README.md');

      expect(history.length).toBe(1);
      expect(history[0].commit.id).toBe('commit_abc123de');
      expect(history[0].author).toBe('John Doe');
      expect(history[0].changes.status).toBe('modified');
    });

    it('should return empty array for non-existent file', () => {
      const history = kagService.getFileHistory('nonexistent.js');

      expect(history).toEqual([]);
    });

    it('should sort history by date (newest first)', async () => {
      // Add another commit
      kagService.addEntity({
        id: 'commit_def456gh',
        type: 'Commit',
        name: 'Commit def456gh',
        properties: {
          sha: 'def456ghi789',
          message: 'Update README again',
          author: 'Jane Smith',
          date: '2025-01-20T15:00:00Z'
        }
      });

      kagService.addRelation({
        from: 'commit_def456gh',
        to: 'file_README_md',
        type: 'commit_modifies_file',
        properties: {
          status: 'modified',
          additions: 20,
          deletions: 3,
          changes: 23
        }
      });

      const history = kagService.getFileHistory('README.md');

      expect(history.length).toBe(2);
      expect(history[0].commit.id).toBe('commit_def456gh'); // Newest first
      expect(history[1].commit.id).toBe('commit_abc123de');
    });
  });

  describe('getLastModifier', () => {
    beforeEach(() => {
      kagService.addEntity({
        id: 'commit_latest123',
        type: 'Commit',
        name: 'Commit latest123',
        properties: {
          sha: 'latest123456',
          message: 'Latest update',
          author: 'Alice Brown',
          author_email: 'alice@example.com',
          date: '2025-01-21T12:00:00Z'
        }
      });

      kagService.addEntity({
        id: 'file_src_app_js',
        type: 'File',
        name: 'src/app.js',
        properties: {
          path: 'src/app.js'
        }
      });

      kagService.addRelation({
        from: 'commit_latest123',
        to: 'file_src_app_js',
        type: 'commit_modifies_file',
        properties: {
          status: 'modified',
          additions: 50,
          deletions: 20
        }
      });
    });

    it('should return last modifier information', () => {
      const modifier = kagService.getLastModifier('file_src_app_js');

      expect(modifier).toBeDefined();
      expect(modifier.author).toBe('Alice Brown');
      expect(modifier.date).toBe('2025-01-21T12:00:00Z');
      expect(modifier.message).toBe('Latest update');
    });

    it('should return null for entity with no history', () => {
      const modifier = kagService.getLastModifier('file_nonexistent_js');

      expect(modifier).toBeNull();
    });
  });

  describe('getFileChanges', () => {
    beforeEach(() => {
      // Add multiple commits for filtering tests
      const commits = [
        {
          id: 'commit_jan10',
          date: '2025-01-10T10:00:00Z',
          author: 'John Doe',
          email: 'john@example.com'
        },
        {
          id: 'commit_jan15',
          date: '2025-01-15T14:00:00Z',
          author: 'Jane Smith',
          email: 'jane@example.com'
        },
        {
          id: 'commit_jan20',
          date: '2025-01-20T09:00:00Z',
          author: 'John Doe',
          email: 'john@example.com'
        }
      ];

      kagService.addEntity({
        id: 'file_test_js',
        type: 'File',
        name: 'test.js',
        properties: { path: 'test.js' }
      });

      commits.forEach(commit => {
        kagService.addEntity({
          id: commit.id,
          type: 'Commit',
          name: commit.id,
          properties: {
            message: `Update test.js`,
            author: commit.author,
            author_email: commit.email,
            date: commit.date
          }
        });

        kagService.addRelation({
          from: commit.id,
          to: 'file_test_js',
          type: 'commit_modifies_file'
        });
      });
    });

    it('should filter by date range', () => {
      const changes = kagService.getFileChanges('test.js', {
        since: '2025-01-12T00:00:00Z',
        until: '2025-01-18T00:00:00Z'
      });

      expect(changes.length).toBe(1);
      expect(changes[0].commit.id).toBe('commit_jan15');
    });

    it('should filter by author', () => {
      const changes = kagService.getFileChanges('test.js', {
        author: 'John Doe'
      });

      expect(changes.length).toBe(2);
      expect(changes.every(c => c.author === 'John Doe')).toBe(true);
    });

    it('should apply limit', () => {
      const changes = kagService.getFileChanges('test.js', {
        limit: 2
      });

      expect(changes.length).toBe(2);
    });

    it('should combine filters', () => {
      const changes = kagService.getFileChanges('test.js', {
        author: 'John Doe',
        limit: 1
      });

      expect(changes.length).toBe(1);
      expect(changes[0].author).toBe('John Doe');
    });
  });

  describe('getCommitsForIssue', () => {
    beforeEach(() => {
      kagService.addEntity({
        id: 'issue_123',
        type: 'Issue',
        name: 'Issue #123',
        properties: { number: 123 }
      });

      kagService.addEntity({
        id: 'commit_fix123',
        type: 'Commit',
        name: 'Fix commit',
        properties: {
          message: 'Fix bug #123',
          author: 'Developer',
          date: '2025-01-15T10:00:00Z'
        }
      });

      kagService.addRelation({
        from: 'commit_fix123',
        to: 'issue_123',
        type: 'commit_fixes_issue',
        properties: { issue_number: '123' }
      });
    });

    it('should return commits that fixed an issue', () => {
      const commits = kagService.getCommitsForIssue(123);

      expect(commits.length).toBe(1);
      expect(commits[0].commit.id).toBe('commit_fix123');
      expect(commits[0].type).toBe('commit_fixes_issue');
    });

    it('should return empty array for issue with no commits', () => {
      const commits = kagService.getCommitsForIssue(999);

      expect(commits).toEqual([]);
    });
  });

  describe('getFeatureDevelopmentHistory', () => {
    beforeEach(() => {
      const commits = [
        { id: 'commit_auth1', message: 'Add authentication module', date: '2025-01-01T10:00:00Z' },
        { id: 'commit_auth2', message: 'Improve authentication flow', date: '2025-01-05T14:00:00Z' },
        { id: 'commit_other', message: 'Update documentation', date: '2025-01-10T09:00:00Z' },
        { id: 'commit_auth3', message: 'Fix authentication bug', date: '2025-01-15T16:00:00Z' }
      ];

      commits.forEach(commit => {
        kagService.addEntity({
          id: commit.id,
          type: 'Commit',
          name: commit.id,
          properties: {
            message: commit.message,
            author: 'Developer',
            date: commit.date
          }
        });
      });
    });

    it('should find commits related to a feature keyword', () => {
      const commits = kagService.getFeatureDevelopmentHistory('authentication');

      expect(commits.length).toBe(3);
      expect(commits.every(c => c.message.toLowerCase().includes('authentication'))).toBe(true);
    });

    it('should sort commits by date (oldest first)', () => {
      const commits = kagService.getFeatureDevelopmentHistory('authentication');

      expect(commits[0].commit.id).toBe('commit_auth1');
      expect(commits[1].commit.id).toBe('commit_auth2');
      expect(commits[2].commit.id).toBe('commit_auth3');
    });

    it('should return empty array for non-matching keyword', () => {
      const commits = kagService.getFeatureDevelopmentHistory('nonexistent');

      expect(commits).toEqual([]);
    });
  });

  describe('getUserCommitStats', () => {
    beforeEach(() => {
      const commits = [
        {
          id: 'commit_user1',
          author: 'John Doe',
          email: 'john@example.com',
          date: '2025-01-15T10:00:00Z'
        },
        {
          id: 'commit_user2',
          author: 'John Doe',
          email: 'john@example.com',
          date: '2025-02-20T14:00:00Z'
        },
        {
          id: 'commit_user3',
          author: 'John Doe',
          email: 'john@example.com',
          date: '2025-03-25T16:00:00Z'
        }
      ];

      commits.forEach(commit => {
        kagService.addEntity({
          id: commit.id,
          type: 'Commit',
          name: commit.id,
          properties: {
            message: 'Test commit',
            author: commit.author,
            author_email: commit.email,
            date: commit.date
          }
        });

        kagService.addEntity({
          id: `file_${commit.id}`,
          type: 'File',
          name: `file${commit.id}.js`
        });

        kagService.addRelation({
          from: commit.id,
          to: `file_${commit.id}`,
          type: 'commit_modifies_file'
        });
      });

      // Add issue fix relation
      kagService.addRelation({
        from: 'commit_user1',
        to: 'issue_100',
        type: 'commit_fixes_issue',
        properties: { issue_number: '100' }
      });
    });

    it('should calculate user commit statistics', () => {
      const stats = kagService.getUserCommitStats('John Doe');

      expect(stats.totalCommits).toBe(3);
      expect(stats.filesModified).toBe(3);
      expect(stats.issuesFixed).toBe(1);
      expect(stats.firstCommit).toBeDefined();
      expect(stats.lastCommit).toBeDefined();
    });

    it('should group commits by month', () => {
      const stats = kagService.getUserCommitStats('John Doe');

      expect(stats.commitsByMonth['2025-01']).toBe(1);
      expect(stats.commitsByMonth['2025-02']).toBe(1);
      expect(stats.commitsByMonth['2025-03']).toBe(1);
    });

    it('should return zero stats for unknown user', () => {
      const stats = kagService.getUserCommitStats('Unknown User');

      expect(stats.totalCommits).toBe(0);
      expect(stats.firstCommit).toBeNull();
      expect(stats.lastCommit).toBeNull();
    });

    it('should match by email', () => {
      const stats = kagService.getUserCommitStats('john@example.com');

      expect(stats.totalCommits).toBe(3);
    });
  });
});

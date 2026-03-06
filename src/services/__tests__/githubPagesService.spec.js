/**
 * Tests for GitHub Pages Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import githubPagesService from '../githubPagesService';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('GitHubPagesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setGitHubToken', () => {
    it('should set GitHub token in headers', () => {
      const token = 'ghp_test_token';
      githubPagesService.setGitHubToken(token);

      expect(githubPagesService.apiClient.defaults.headers['x-github-token']).toBe(token);
    });
  });

  describe('getBranches', () => {
    it('should fetch branches for a repository', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              name: 'main',
              commit: { sha: 'abc123', url: 'https://api.github.com/repos/owner/repo/commits/abc123' },
              protected: true
            },
            {
              name: 'dev',
              commit: { sha: 'def456', url: 'https://api.github.com/repos/owner/repo/commits/def456' },
              protected: false
            }
          ]
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getBranches('owner/repo');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('main');
      expect(result.data[0].protected).toBe(true);
    });

    it('should handle errors when fetching branches', async () => {
      const errorMessage = 'Repository not found';
      githubPagesService.apiClient.get = vi.fn().mockRejectedValue({
        response: { data: { error: errorMessage } }
      });

      await expect(githubPagesService.getBranches('owner/repo')).rejects.toThrow(errorMessage);
    });
  });

  describe('getPullRequests', () => {
    it('should fetch pull requests for a repository', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              number: 1,
              title: 'Test PR',
              state: 'open',
              user: { login: 'testuser', avatarUrl: 'https://avatar.url' },
              head: { ref: 'feature-branch', sha: 'abc123' },
              base: { ref: 'main', sha: 'def456' },
              draft: false
            }
          ]
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getPullRequests('owner/repo', 'open');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].number).toBe(1);
      expect(result.data[0].title).toBe('Test PR');
      expect(result.data[0].state).toBe('open');
    });

    it('should handle different PR states', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: []
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      await githubPagesService.getPullRequests('owner/repo', 'closed');

      expect(githubPagesService.apiClient.get).toHaveBeenCalledWith('/pull-requests', {
        params: { repository: 'owner/repo', state: 'closed' }
      });
    });
  });

  describe('getPreviewUrl', () => {
    it('should generate preview URL for a PR', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            previewUrl: 'https://owner.github.io/repo/pr-preview/pr-123/',
            type: 'pr',
            identifier: 123,
            available: true
          }
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getPreviewUrl('owner/repo', 'pr', 123);

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(true);
      expect(result.data.previewUrl).toContain('pr-123');
    });

    it('should indicate when preview is not available', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            previewUrl: null,
            type: 'branch',
            identifier: 'feature',
            available: false
          }
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getPreviewUrl('owner/repo', 'branch', 'feature');

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(false);
      expect(result.data.previewUrl).toBeNull();
    });
  });

  describe('getPRDetails', () => {
    it('should fetch detailed PR information', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            number: 1,
            title: 'Test PR',
            files: [
              { filename: 'test.js', status: 'modified', additions: 10, deletions: 5 }
            ],
            checks: [
              { id: 1, name: 'CI', status: 'completed', conclusion: 'success' }
            ]
          }
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getPRDetails('owner/repo', 1);

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(1);
      expect(result.data.checks).toHaveLength(1);
      expect(result.data.checks[0].conclusion).toBe('success');
    });
  });

  describe('getDeployments', () => {
    it('should fetch deployment history', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 1,
              ref: 'main',
              sha: 'abc123',
              environment: 'production',
              creator: { login: 'testuser' }
            }
          ]
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getDeployments('owner/repo');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].environment).toBe('production');
    });
  });

  describe('getCommit', () => {
    it('should fetch commit details', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sha: 'abc123',
            message: 'Test commit',
            author: { name: 'Test User', email: 'test@example.com' },
            stats: { additions: 10, deletions: 5 }
          }
        }
      };

      githubPagesService.apiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await githubPagesService.getCommit('owner/repo', 'abc123');

      expect(result.success).toBe(true);
      expect(result.data.sha).toBe('abc123');
      expect(result.data.message).toBe('Test commit');
    });
  });

  describe('handleError', () => {
    it('should handle response errors', () => {
      const error = {
        response: {
          data: { error: 'Not found' },
          statusText: 'Not Found'
        }
      };

      const handledError = githubPagesService.handleError(error);

      expect(handledError.message).toBe('Not found');
    });

    it('should handle request errors', () => {
      const error = {
        request: {}
      };

      const handledError = githubPagesService.handleError(error);

      expect(handledError.message).toContain('No response from server');
    });

    it('should handle unknown errors', () => {
      const error = {
        message: 'Unknown error'
      };

      const handledError = githubPagesService.handleError(error);

      expect(handledError.message).toBe('Unknown error');
    });
  });
});

// deployment-info.js - Deployment and version information routes
import express from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createDeploymentInfoRoutes() {
  const router = express.Router();

  /**
   * Get deployment information
   * Returns: last update time, git branch, git commit, deployment status
   */
  router.get('/deployment-info', async (req, res) => {
    try {
      const deploymentInfo = {
        timestamp: new Date().toISOString(),
        serverUptime: process.uptime(),
        nodeVersion: process.version
      };

      // Try to get Git information
      try {
        // Get current branch
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        deploymentInfo.branch = branch;

        // Get current commit hash (short)
        const commitHash = execSync('git rev-parse --short HEAD', {
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        deploymentInfo.commitHash = commitHash;

        // Get commit date
        const commitDate = execSync('git log -1 --format=%cd --date=iso', {
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        deploymentInfo.lastCommitDate = commitDate;

        // Get commit message
        const commitMessage = execSync('git log -1 --format=%s', {
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        deploymentInfo.lastCommitMessage = commitMessage;

        // Check if branch matches dev (for deployment status)
        deploymentInfo.isDevBranch = branch === 'dev';
        deploymentInfo.deploymentStatus = branch === 'dev' ? 'synchronized' : 'branch-mismatch';

      } catch (gitError) {
        console.error('Error fetching Git information:', gitError.message);
        deploymentInfo.gitError = 'Git information unavailable';
        deploymentInfo.deploymentStatus = 'unknown';
      }

      // Try to read package.json version
      try {
        const packageJsonPath = path.resolve(__dirname, '../../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        deploymentInfo.version = packageJson.version;
      } catch (versionError) {
        console.error('Error reading package.json:', versionError.message);
        deploymentInfo.version = 'unknown';
      }

      res.json({
        success: true,
        data: deploymentInfo
      });

    } catch (error) {
      console.error('Error fetching deployment info:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        data: {
          timestamp: new Date().toISOString(),
          deploymentStatus: 'error'
        }
      });
    }
  });

  return router;
}

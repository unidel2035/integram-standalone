# Commit History Indexing

**Issue**: [#5075](https://github.com/unidel2035/dronedoc2025/issues/5075)
**Related**: [#5005](https://github.com/unidel2035/dronedoc2025/issues/5005)

## Overview

The Commit History Indexing feature extends the KAG (Knowledge Augmented Generation) service to track code evolution over time by indexing Git commit history from GitHub. This enables temporal queries about code changes, feature development tracking, and code archaeology.

## Features

### 1. Commit Indexing

Fetches and indexes commit history from GitHub API:

- **Commit metadata**: SHA, message, author, date, URL
- **Author information**: Name, email, GitHub login
- **Verification status**: GPG signature verification
- **Temporal data**: Commit and committer timestamps

### 2. Temporal Relations

Creates knowledge graph relations to track code evolution:

#### `commit_modifies_file`

Links commits to files they modified with change details:

```javascript
{
  from: 'commit_abc123de',
  to: 'file_src_app_js',
  type: 'commit_modifies_file',
  properties: {
    status: 'modified',      // added, modified, removed, renamed
    additions: 50,           // Lines added
    deletions: 20,           // Lines deleted
    changes: 70,             // Total changes
    patch: '...'             // First 500 chars of patch
  }
}
```

#### `commit_fixes_issue`

Links commits that fix issues (detected from commit messages):

```javascript
{
  from: 'commit_def456gh',
  to: 'issue_123',
  type: 'commit_fixes_issue',
  properties: {
    issue_number: '123'
  }
}
```

Detected patterns: `fix #123`, `fixes #123`, `fixed #123`, `close #123`, `closes #123`, `closed #123`, `resolve #123`, `resolves #123`, `resolved #123`

#### `commit_references_issue`

Links commits that reference issues without fixing them:

```javascript
{
  from: 'commit_ghi789jk',
  to: 'issue_456',
  type: 'commit_references_issue',
  properties: {
    issue_number: '456'
  }
}
```

Detected pattern: `#456` in commit message (without fix keywords)

#### `commit_part_of_pr`

Links commits to pull requests:

```javascript
{
  from: 'commit_jkl012mn',
  to: 'pr_789',
  type: 'commit_part_of_pr',
  properties: {
    pr_number: '789'
  }
}
```

Detected patterns: `PR #789`, `pull request #789`

#### `created_by`

Links commits to their authors:

```javascript
{
  from: 'commit_abc123de',
  to: 'user_john@example.com',
  type: 'created_by'
}
```

### 3. Historical Query Methods

#### `getFileHistory(filePath)`

Returns commit history for a specific file, sorted by date (newest first):

```javascript
const history = kagService.getFileHistory('src/app.js');
// Returns:
[
  {
    commit: { /* commit entity */ },
    relation: { /* relation data */ },
    date: '2025-01-20T15:00:00Z',
    author: 'Jane Smith',
    message: 'Refactor app initialization',
    changes: {
      status: 'modified',
      additions: 30,
      deletions: 15,
      changes: 45
    }
  },
  // ... older commits
]
```

**Use cases**:
- "When was `src/app.js` changed?"
- "What's the history of this file?"
- Code archaeology

#### `getLastModifier(entityId)`

Returns information about who last modified a file or entity:

```javascript
const modifier = kagService.getLastModifier('file_src_app_js');
// Returns:
{
  author: 'Jane Smith',
  date: '2025-01-20T15:00:00Z',
  commit: { /* commit entity */ },
  message: 'Refactor app initialization',
  changes: { /* change details */ }
}
```

**Use cases**:
- "Who last modified `src/app.js`?"
- Identifying code owners
- Finding experts for specific files

#### `getFileChanges(filePath, options)`

Returns file changes with filtering options:

```javascript
const changes = kagService.getFileChanges('src/app.js', {
  since: '2025-01-01T00:00:00Z',  // Start date
  until: '2025-01-31T23:59:59Z',  // End date
  author: 'Jane Smith',            // Filter by author
  limit: 10                        // Limit results
});
```

**Use cases**:
- "What changed in this file last month?"
- "Show me changes by specific developer"
- Analyzing file evolution patterns

#### `getCommitsForIssue(issueNumber)`

Returns commits that fixed or referenced an issue:

```javascript
const commits = kagService.getCommitsForIssue(123);
// Returns:
[
  {
    commit: { /* commit entity */ },
    type: 'commit_fixes_issue',
    date: '2025-01-15T10:00:00Z',
    author: 'John Doe',
    message: 'fix: Fix authentication bug (#123)'
  }
]
```

**Use cases**:
- "How was issue #123 fixed?"
- Finding bug introduction points
- Tracking issue resolution

#### `getFeatureDevelopmentHistory(keyword)`

Tracks feature development by finding related commits (sorted oldest first):

```javascript
const commits = kagService.getFeatureDevelopmentHistory('authentication');
// Returns commits with 'authentication' in message, chronologically ordered
```

**Use cases**:
- "Show development history of authentication feature"
- Understanding feature evolution
- Documentation generation

#### `getUserCommitStats(userIdentifier)`

Returns commit statistics for a user:

```javascript
const stats = kagService.getUserCommitStats('Jane Smith');
// Returns:
{
  totalCommits: 156,
  firstCommit: { /* oldest commit */ },
  lastCommit: { /* newest commit */ },
  filesModified: 87,
  issuesFixed: 23,
  commitsByMonth: {
    '2025-01': 45,
    '2025-02': 38,
    '2025-03': 42
  }
}
```

**Use cases**:
- Developer activity reports
- Contribution analysis
- Team metrics

## API Endpoints

### Index Commit History

```http
POST /api/kag/index
Content-Type: application/json

{
  "includeCommits": true,
  "maxCommits": 200,
  "includeIssues": true,
  "includePRs": true,
  "includeCode": true,
  "includeDocs": true
}
```

Response:
```json
{
  "success": true,
  "results": {
    "issues": 100,
    "prs": 100,
    "files": 20,
    "commits": 200,
    "entities": 650,
    "relations": 1250,
    "errors": []
  }
}
```

### Get File History

```http
GET /api/kag/history/file/src/app.js
```

Response:
```json
{
  "success": true,
  "filePath": "src/app.js",
  "history": [
    {
      "commit": { /* commit entity */ },
      "date": "2025-01-20T15:00:00Z",
      "author": "Jane Smith",
      "message": "Refactor app initialization",
      "changes": {
        "status": "modified",
        "additions": 30,
        "deletions": 15,
        "changes": 45
      }
    }
  ]
}
```

### Get Last Modifier

```http
GET /api/kag/history/modifier/file_src_app_js
```

Response:
```json
{
  "success": true,
  "entityId": "file_src_app_js",
  "modifier": {
    "author": "Jane Smith",
    "date": "2025-01-20T15:00:00Z",
    "commit": { /* commit entity */ },
    "message": "Refactor app initialization"
  }
}
```

### Get File Changes with Filters

```http
POST /api/kag/history/changes
Content-Type: application/json

{
  "filePath": "src/app.js",
  "since": "2025-01-01T00:00:00Z",
  "until": "2025-01-31T23:59:59Z",
  "author": "Jane Smith",
  "limit": 10
}
```

Response:
```json
{
  "success": true,
  "filePath": "src/app.js",
  "options": {
    "since": "2025-01-01T00:00:00Z",
    "until": "2025-01-31T23:59:59Z",
    "author": "Jane Smith",
    "limit": 10
  },
  "changes": [ /* array of changes */ ]
}
```

### Get Commits for Issue

```http
GET /api/kag/history/issue/123
```

Response:
```json
{
  "success": true,
  "issueNumber": 123,
  "commits": [
    {
      "commit": { /* commit entity */ },
      "type": "commit_fixes_issue",
      "date": "2025-01-15T10:00:00Z",
      "author": "John Doe",
      "message": "fix: Fix authentication bug (#123)"
    }
  ]
}
```

### Get Feature Development History

```http
GET /api/kag/history/feature/authentication
```

Response:
```json
{
  "success": true,
  "keyword": "authentication",
  "commits": [ /* commits with 'authentication' in message */ ]
}
```

### Get User Commit Statistics

```http
GET /api/kag/history/user/Jane%20Smith
```

Response:
```json
{
  "success": true,
  "userIdentifier": "Jane Smith",
  "stats": {
    "totalCommits": 156,
    "firstCommit": { /* commit entity */ },
    "lastCommit": { /* commit entity */ },
    "filesModified": 87,
    "issuesFixed": 23,
    "commitsByMonth": {
      "2025-01": 45,
      "2025-02": 38,
      "2025-03": 42
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# GitHub API token for fetching commits
GITHUB_TOKEN=ghp_your_token_here
```

### Indexing Options

```javascript
await kagService.indexCommitHistory({
  max: 200,              // Maximum commits to index
  branch: 'dev'          // Branch to index (default: 'dev')
});
```

## Performance Considerations

### Rate Limiting

- GitHub API has rate limits (5000 requests/hour for authenticated users)
- The service pauses for 100ms every 50 commits to avoid hitting rate limits
- Each commit requires 2 API calls: `listCommits` + `getCommit` for file details

### Optimization Tips

1. **Incremental Indexing**: Index commits in batches, not all at once
2. **Branch Selection**: Index only the main development branch (`dev` or `main`)
3. **Limit Commits**: Start with recent commits (e.g., last 200) for most use cases
4. **Caching**: Knowledge graph is saved to disk after indexing

### Memory Usage

- Each commit creates 2+ entities (commit + author)
- Each modified file creates 1 file entity + 1 relation
- For 200 commits with ~5 files each: ~600 entities, ~1000 relations

## Use Cases

### 1. Code Archaeology

**Question**: "When was the authentication module introduced?"

```javascript
const commits = kagService.getFeatureDevelopmentHistory('authentication');
const firstCommit = commits[0]; // Oldest commit (chronological order)
console.log(`Authentication was introduced on ${firstCommit.date} by ${firstCommit.author}`);
```

### 2. Bug Tracking

**Question**: "How was issue #5075 fixed?"

```javascript
const commits = kagService.getCommitsForIssue(5075);
commits.forEach(c => {
  console.log(`${c.date}: ${c.message} (by ${c.author})`);
});
```

### 3. File Ownership

**Question**: "Who should I ask about `src/app.js`?"

```javascript
const modifier = kagService.getLastModifier('file_src_app_js');
console.log(`Last modified by ${modifier.author} on ${modifier.date}`);
```

### 4. Change Analysis

**Question**: "What changed in `package.json` this month?"

```javascript
const changes = kagService.getFileChanges('package.json', {
  since: '2025-01-01T00:00:00Z',
  until: '2025-01-31T23:59:59Z'
});
console.log(`${changes.length} changes this month`);
```

### 5. Developer Metrics

**Question**: "How active is Jane Smith?"

```javascript
const stats = kagService.getUserCommitStats('Jane Smith');
console.log(`Total commits: ${stats.totalCommits}`);
console.log(`Files modified: ${stats.filesModified}`);
console.log(`Issues fixed: ${stats.issuesFixed}`);
```

## Testing

Run the comprehensive test suite:

```bash
# Run commit history tests
npm test -- src/services/kag/__tests__/commitHistory.test.js

# Run all KAG tests
npm test -- src/services/kag/
```

Test coverage includes:
- Commit indexing
- Entity and relation creation
- Temporal relation types
- Historical query methods
- Filtering and sorting
- Error handling

## Future Enhancements

1. **Function-level tracking**: `commit_affects_function` relation
2. **Blame analysis**: Line-level attribution
3. **Semantic commit parsing**: Conventional Commits support
4. **Performance metrics**: Code churn, complexity changes
5. **AI-powered insights**: Automatic change summaries
6. **Real-time indexing**: Webhook integration for new commits
7. **Multi-branch tracking**: Compare changes across branches

## Related Documentation

- [KAG Service Overview](./README.md)
- [Issue #5075: Commit History Indexing](https://github.com/unidel2035/dronedoc2025/issues/5075)
- [Issue #5005: KAG Knowledge Base](https://github.com/unidel2035/dronedoc2025/issues/5005)
- [API Routes Documentation](../../api/routes/kag.js)

## Support

For questions or issues:
1. Check the test suite for usage examples
2. Review API endpoint documentation
3. Create an issue on GitHub

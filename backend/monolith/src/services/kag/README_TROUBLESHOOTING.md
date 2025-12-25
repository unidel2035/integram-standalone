# KAG Service Troubleshooting Guide

## Overview

This guide helps diagnose and fix common issues with the KAG (Knowledge Augmented Generation) service.

## Quick Diagnosis

### Health Check Endpoint

Test the KAG service health:

```bash
curl http://localhost:8081/api/kag/health
```

This endpoint will return:
- `status`: "healthy" or "unhealthy"
- `checks`: Object showing which components passed/failed
  - `dependencies`: Required npm packages installed
  - `config`: Environment variables configured
  - `initialization`: Service can initialize successfully
- `issues`: Array of specific problems found

## Common Issues

### 1. 503 Service Unavailable Errors

**Symptoms:**
- All `/api/kag/*` endpoints return 503
- Frontend shows "Failed to load stats" errors
- Console shows "KAG service initialization failed"

**Possible Causes:**

#### A. Missing Dependencies

**Error:** `Cannot find package '@octokit/rest'`

**Solution:**
```bash
cd backend/monolith
npm install
```

**Verification:**
```bash
ls node_modules/@octokit/rest
```

#### B. Missing Environment Variables

**Error:** `No API key configured`

**Solution:**
Add to `.env` file or environment:
```bash
# Required: AI embeddings API key (choose one)
DEEPSEEK_API_KEY=your-deepseek-key
# OR
OPENAI_API_KEY=your-openai-key

# Optional: GitHub API token (for higher rate limits)
GITHUB_TOKEN=your-github-token
```

**Verification:**
```bash
echo $DEEPSEEK_API_KEY
# or
echo $OPENAI_API_KEY
```

#### C. Data Directory Permissions

**Error:** `ENOENT: no such file or directory` or `EACCES: permission denied`

**Solution:**
```bash
mkdir -p backend/monolith/data/kag/{cache,embeddings,embeddings-cache}
chmod -R 755 backend/monolith/data/kag
```

**Verification:**
```bash
ls -la backend/monolith/data/kag
```

### 2. Empty Knowledge Base (0 entities, 0 relations)

**Symptoms:**
- Stats show 0 entities and 0 relations
- Search returns no results
- RAG chat says "no knowledge base"

**Solution:**

1. **Index the repository:**
   ```bash
   curl -X POST http://localhost:8081/api/kag/index \
     -H "Content-Type: application/json" \
     -d '{
       "includeIssues": true,
       "includePRs": true,
       "includeCode": true,
       "includeDocs": true,
       "maxIssues": 100,
       "maxPRs": 100
     }'
   ```

2. **Check indexing progress:**
   ```bash
   curl http://localhost:8081/api/kag/stats
   ```

3. **Verify data was saved:**
   ```bash
   ls -lh backend/monolith/data/kag/*.json
   ```

### 3. Slow or Timeout Errors

**Symptoms:**
- Requests timeout after 60-120 seconds
- 502 Bad Gateway errors
- "Request took too long" messages

**Solutions:**

1. **Reduce indexing scope:**
   ```json
   {
     "maxIssues": 50,
     "maxPRs": 50,
     "includeCode": false
   }
   ```

2. **Enable incremental indexing:**
   ```json
   {
     "incremental": true
   }
   ```

3. **Increase nginx timeout (if applicable):**
   ```nginx
   proxy_read_timeout 300s;
   proxy_connect_timeout 300s;
   ```

### 4. API Key or Rate Limit Errors

**Symptoms:**
- "Rate limit exceeded" errors
- "Invalid API key" errors
- Embedding generation fails

**Solutions:**

1. **Check API key validity:**
   ```bash
   curl https://api.deepseek.com/v1/models \
     -H "Authorization: Bearer $DEEPSEEK_API_KEY"
   ```

2. **Add GitHub token for higher limits:**
   ```bash
   export GITHUB_TOKEN=your_github_token
   ```

3. **Reduce concurrent requests:**
   Edit `backend/monolith/src/services/kag/EmbeddingService.js`:
   ```javascript
   batchSize: 10  // Reduce from 100
   ```

## Testing KAG Locally

### 1. Test Initialization

```bash
cd backend/monolith
node test-kag-init.js
```

Expected output:
```
=== Testing KAG Service Initialization ===

Step 1: Getting KAG service instance...
✓ KAG service instance obtained

Step 2: Initializing KAG service...
✓ KAG service initialized successfully

Step 3: Getting stats...
✓ Stats retrieved:
{
  "totalEntities": 0,
  "totalRelations": 0,
  ...
}

=== SUCCESS: KAG service is working! ===
```

### 2. Test Indexing

```bash
cd backend/monolith
node test-kag-indexing.js
```

### 3. Test Search

```bash
curl -X POST http://localhost:8081/api/kag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication", "limit": 5}'
```

## Monitoring and Logs

### Enable Debug Logging

Set environment variable:
```bash
export LOG_LEVEL=debug
```

Or in `.env`:
```
LOG_LEVEL=debug
```

### Check Logs

```bash
# Server logs
tail -f backend/monolith/logs/combined.log

# KAG-specific logs
tail -f backend/monolith/logs/combined.log | grep "\[KAG\]"

# Error logs only
tail -f backend/monolith/logs/error.log
```

### Monitor Performance

```bash
# Watch stats in real-time
watch -n 5 'curl -s http://localhost:8081/api/kag/stats | jq'

# Monitor health
watch -n 10 'curl -s http://localhost:8081/api/kag/health | jq'
```

## Production Deployment Checklist

Before deploying KAG to production:

- [ ] All dependencies installed (`npm install` in backend/monolith)
- [ ] Environment variables set (DEEPSEEK_API_KEY or OPENAI_API_KEY)
- [ ] GitHub token configured (GITHUB_TOKEN)
- [ ] Data directories created with correct permissions
- [ ] Health check endpoint returns "healthy"
- [ ] Initial indexing completed successfully
- [ ] Nginx/proxy timeouts configured (≥300s)
- [ ] Monitoring and alerting configured
- [ ] Backup strategy for `data/kag/` directory

## Getting Help

1. **Check health endpoint:**
   ```bash
   curl http://localhost:8081/api/kag/health
   ```

2. **Review error logs:**
   ```bash
   tail -100 backend/monolith/logs/error.log
   ```

3. **Test locally:**
   ```bash
   cd backend/monolith
   node test-kag-init.js
   ```

4. **Report issue:**
   - Include health check output
   - Include relevant error logs
   - Include steps to reproduce
   - Link to GitHub issue: https://github.com/unidel2035/dronedoc2025/issues

## Related Documentation

- [KAG Service Documentation](./INTEGRAM_MCP_README.md)
- [Backend Monolith Setup](../../README.md)
- [Environment Variables](../../../.env.example)
- [Issue #5116](https://github.com/unidel2035/dronedoc2025/issues/5116)

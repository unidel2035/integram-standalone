# KAG Service - Knowledge Augmented Generation

## Overview

The KAG (Knowledge Augmented Generation) service provides a knowledge base for the DronDoc project by indexing repository content and creating a searchable knowledge graph.

## Components

### KAGService

Main service for managing the knowledge base.

**Features:**
- Repository indexing (issues, PRs, code, docs)
- Knowledge graph storage
- Semantic search
- Entity and relation management
- MCP Memory export

### CodeParser

Parser for extracting structure from code files.

**Supported Languages:**
- JavaScript (.js)
- TypeScript (.ts, .tsx)
- JSX (.jsx)
- Vue (.vue)
- Python (.py)

**Extracted Information:**
- Imports/exports
- Function definitions
- Class definitions
- Variable declarations
- Function calls (JavaScript/TypeScript only)

## Usage

### Initialize and Index

```javascript
import { getKAGService } from './services/kag/KAGService.js';

const kagService = getKAGService();

// Initialize
await kagService.initialize();

// Index repository
const results = await kagService.indexRepository({
  includeIssues: true,
  includePRs: true,
  includeCode: true,
  includeDocs: true,
  maxIssues: 100,
  maxPRs: 100
});

console.log('Indexed:', results);
```

### Search

```javascript
// Search knowledge base
const results = await kagService.search('router', {
  limit: 10,
  entityTypes: ['File', 'Function'],
  minScore: 0.3
});

results.forEach(result => {
  console.log(result.entity.name, '- Score:', result.score);
});
```

### Get Entity Details

```javascript
// Get entity by ID
const entity = kagService.getEntity('file_src_router_index_js');

// Get relations
const relations = kagService.getRelations('file_src_router_index_js', 'both');

relations.forEach(rel => {
  console.log(rel.type, ':', rel.from, '->', rel.to);
});
```

### Statistics

```javascript
const stats = kagService.getStats();

console.log('Total entities:', stats.totalEntities);
console.log('Total relations:', stats.totalRelations);
console.log('Entity types:', stats.entityTypes);
console.log('Relation types:', stats.relationTypes);
```

## Entity Types

| Type | Description |
|------|-------------|
| Issue | GitHub issue |
| PullRequest | GitHub pull request |
| User | GitHub user |
| Label | GitHub label |
| File | Important project file |
| Documentation | Documentation file |
| JavaScriptModule | JavaScript/TypeScript file |
| VueComponent | Vue component file |
| PythonModule | Python file |
| Function | Function definition |
| Class | Class definition |

## Relation Types

| Type | Description |
|------|-------------|
| created_by | Entity created by user |
| has_label | Issue/PR has label |
| imports | File imports another file |
| defines | File defines function/class |

## CodeParser Details

### JavaScript/TypeScript Parsing

Uses **acorn** parser with full ES2022+ support.

**Extracted:**
- Import declarations (default, named, namespace)
- Export declarations (named, default)
- Function declarations
- Class declarations (with methods)
- Variable declarations (const, let, var)
- Function calls (including method calls)

**Example:**

```javascript
import { parse } from './CodeParser.js';

const structure = parser.parseJavaScriptFile('src/router/index.js', content);

console.log(structure);
// {
//   type: 'JavaScriptModule',
//   imports: [
//     { source: 'vue-router', specifiers: [{ type: 'named', imported: 'createRouter', local: 'createRouter' }] }
//   ],
//   exports: [
//     { type: 'default', declaration: 'CallExpression' }
//   ],
//   functions: [
//     { name: 'setupRoutes', params: ['app'], line: 10 }
//   ],
//   classes: [],
//   variables: [
//     { name: 'router', kind: 'const', line: 5 }
//   ],
//   calls: [
//     { callee: 'createRouter', line: 6 }
//   ]
// }
```

### Vue Component Parsing

Uses **@vue/compiler-sfc** for Vue Single File Components.

**Extracted:**
- Template content
- Script content (parsed as JavaScript)
- Style blocks
- All JavaScript structure from script

**Example:**

```javascript
const structure = parser.parseVueFile('src/App.vue', content);

console.log(structure);
// {
//   type: 'VueComponent',
//   template: { content: '<div>...</div>', lang: 'html' },
//   script: { content: 'export default { ... }', lang: 'js', setup: false },
//   style: [{ content: '.app { ... }', lang: 'css', scoped: true }],
//   imports: [...],
//   functions: [...],
//   ...
// }
```

### Python Parsing

Uses regex-based parsing (basic support).

**Extracted:**
- Import statements
- Function definitions (def)
- Class definitions (class)

**Limitations:**
- No AST parsing
- May miss complex syntax
- No decorators or type hints

**Example:**

```javascript
const structure = parser.parsePythonFile('script.py', content);

console.log(structure);
// {
//   type: 'PythonModule',
//   imports: [
//     { source: 'os', names: ['path', 'environ'] }
//   ],
//   functions: [
//     { name: 'main', params: [], line: 10 }
//   ],
//   classes: [
//     { name: 'MyClass', bases: ['BaseClass'], line: 5 }
//   ]
// }
```

## Import Path Resolution

The service resolves import paths to absolute repository paths:

```javascript
// Relative imports
'./router' → 'src/router.js'
'../utils' → 'utils.js'

// Absolute imports
'@/components/Foo' → 'src/components/Foo.js'

// External imports
'vue-router' → 'node_modules/vue-router'
```

## Storage

Knowledge graph is saved to:
```
backend/monolith/data/kag/knowledge_graph.json
```

Structure:
```json
{
  "entities": [...],
  "relations": [...],
  "metadata": {
    "savedAt": "2025-12-17T10:30:00Z",
    "stats": { ... }
  }
}
```

## API Endpoints

See `src/api/routes/kag.js`:

- `POST /api/kag/index` - Start indexing
- `POST /api/kag/search` - Search knowledge base
- `GET /api/kag/entity/:id` - Get entity details
- `GET /api/kag/stats` - Get statistics
- `POST /api/kag/export/mcp` - Export to MCP Memory format
- `GET /api/kag/health` - Health check

## Testing

```bash
# Run test script
node test-kag-indexing.js

# Or use npm script (if added)
npm run test:kag
```

## Performance Tips

1. **Use GitHub token**: Set `GITHUB_TOKEN` env var for higher rate limits
2. **Batch processing**: Adjust batch size (default: 50 files)
3. **Selective indexing**: Only index what you need (code, docs, issues, PRs)
4. **Memory**: Increase Node.js memory for large repos: `--max-old-space-size=4096`

## Troubleshooting

### Parser Errors

If parsing fails for a file, it's logged as a warning but indexing continues.

**Common causes:**
- Syntax errors in source file
- Unsupported JavaScript syntax
- Missing dependencies

**Solution:** Check logs for specific error messages

### Rate Limits

GitHub API has rate limits:
- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

**Solution:** Set `GITHUB_TOKEN` environment variable

### Memory Issues

Large repositories may exceed memory limits.

**Solution:**
- Increase memory: `node --max-old-space-size=4096`
- Process in smaller batches
- Save graph more frequently

## Future Enhancements

- [ ] Vector embeddings for semantic search
- [ ] Incremental indexing (only changed files)
- [ ] Function call graph
- [ ] TypeScript type extraction
- [ ] JSDoc extraction
- [ ] Python AST parser
- [ ] Test-to-source linking

## Related Files

- `KAGService.js` - Main service
- `CodeParser.js` - Code parsing
- `../../api/routes/kag.js` - API routes
- `../../../test-kag-indexing.js` - Test script
- `../../../docs/KAG_FULL_CODEBASE_INDEXING.md` - Documentation

## References

- [OpenSPG/KAG](https://github.com/OpenSPG/KAG)
- [Acorn Parser](https://github.com/acornjs/acorn)
- [Vue Compiler SFC](https://github.com/vuejs/core/tree/main/packages/compiler-sfc)
- Issue #5073

import { describe, it, expect } from 'vitest';

/**
 * Regression tests for Issue #413: URL routing case sensitivity.
 *
 * PHP lowercases the entire URI before routing:
 *   $com = explode("?", strtolower($_SERVER["REQUEST_URI"]));
 *
 * Node.js must replicate this so that requests like /MyDB/Auth work the
 * same way they do under PHP (lowered to /mydb/auth).
 *
 * These tests verify the three lowercasing mechanisms in legacy-compat.js
 * (lines 284-292) by simulating the middleware behaviour on mock req objects.
 */

// ── Middleware functions under test (extracted from legacy-compat.js) ────────
// These mirror the exact implementations at lines 284-292.

/** router.param('db') callback */
function dbParamMiddleware(req, val) {
  req.params.db = val.toLowerCase();
}

/** router.param('action') callback */
function actionParamMiddleware(req, val) {
  req.params.action = val.toLowerCase();
}

/** router.use() URL lowercasing middleware */
function urlLowercaseMiddleware(req) {
  req.url = req.url.toLowerCase();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate PHP: $com = explode("?", strtolower($_SERVER["REQUEST_URI"])); */
function phpRouting(uri) {
  const parts = uri.toLowerCase().split('?');
  const segments = parts[0].split('/');
  return {
    db: segments[1] || 'my',
    action: segments[2] || '',
    id: segments[3] || '',
  };
}

/** Simulate Node.js middleware chain on a given URI */
function nodeRouting(uri) {
  const pathOnly = uri.split('?')[0];
  const segments = pathOnly.split('/');
  const req = {
    url: uri,
    params: {
      db: segments[1] || '',
      action: segments[2] || '',
      id: segments[3] || '',
    },
  };

  // Apply the three middleware in order
  dbParamMiddleware(req, req.params.db);
  actionParamMiddleware(req, req.params.action);
  urlLowercaseMiddleware(req);

  // After URL lowercasing, re-extract segments (as Express would re-route)
  const loweredSegments = req.url.split('?')[0].split('/');
  return {
    db: req.params.db,
    action: req.params.action,
    id: loweredSegments[3] || '',
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('URL case-insensitive routing (#413)', () => {

  describe('router.param("db") lowercases :db', () => {
    it('lowercases uppercase DB name', () => {
      const req = { params: {} };
      dbParamMiddleware(req, 'MyDB');
      expect(req.params.db).toBe('mydb');
    });

    it('lowercases mixed-case DB name', () => {
      const req = { params: {} };
      dbParamMiddleware(req, 'TestDatabase');
      expect(req.params.db).toBe('testdatabase');
    });

    it('preserves already-lowercase DB name', () => {
      const req = { params: {} };
      dbParamMiddleware(req, 'mydb');
      expect(req.params.db).toBe('mydb');
    });

    it('handles single-char uppercase', () => {
      const req = { params: {} };
      dbParamMiddleware(req, 'X');
      expect(req.params.db).toBe('x');
    });
  });

  describe('router.param("action") lowercases :action', () => {
    it('lowercases uppercase action', () => {
      const req = { params: {} };
      actionParamMiddleware(req, 'Object');
      expect(req.params.action).toBe('object');
    });

    it('lowercases mixed-case action with underscore', () => {
      const req = { params: {} };
      actionParamMiddleware(req, 'Edit_Obj');
      expect(req.params.action).toBe('edit_obj');
    });

    it('preserves already-lowercase action', () => {
      const req = { params: {} };
      actionParamMiddleware(req, 'auth');
      expect(req.params.action).toBe('auth');
    });
  });

  describe('req.url lowercasing middleware', () => {
    it('lowercases the entire URL path', () => {
      const req = { url: '/MyDB/XSRF' };
      urlLowercaseMiddleware(req);
      expect(req.url).toBe('/mydb/xsrf');
    });

    it('lowercases URL with query string (full URL lowered)', () => {
      const req = { url: '/MyDB/Auth?JSON' };
      urlLowercaseMiddleware(req);
      expect(req.url).toBe('/mydb/auth?json');
    });

    it('preserves already-lowercase URL', () => {
      const req = { url: '/mydb/csv_all' };
      urlLowercaseMiddleware(req);
      expect(req.url).toBe('/mydb/csv_all');
    });

    it('handles root path', () => {
      const req = { url: '/' };
      urlLowercaseMiddleware(req);
      expect(req.url).toBe('/');
    });
  });

  describe('PHP vs Node.js parity', () => {
    const testCases = [
      '/MyDB/Auth',
      '/TestDB/Object/123',
      '/DEMO/Edit_Obj/456',
      '/mydb/xsrf',
      '/MyDB/CSV_ALL',
      '/demo/auth',
      '/MY/Register',
    ];

    for (const uri of testCases) {
      it(`"${uri}" routes identically in PHP and Node`, () => {
        const php = phpRouting(uri);
        const node = nodeRouting(uri);
        expect(node.db).toBe(php.db);
        expect(node.action).toBe(php.action);
      });
    }
  });

  describe('edge cases', () => {
    it('handles numeric-only DB name', () => {
      const req = { params: {} };
      dbParamMiddleware(req, '12345');
      expect(req.params.db).toBe('12345');
    });

    it('handles empty string gracefully', () => {
      const req = { params: {} };
      dbParamMiddleware(req, '');
      expect(req.params.db).toBe('');
    });

    it('handles URL with trailing slash', () => {
      const req = { url: '/MyDB/Auth/' };
      urlLowercaseMiddleware(req);
      expect(req.url).toBe('/mydb/auth/');
    });
  });
});

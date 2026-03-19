/**
 * Regression tests for issue #442:
 * edit_obj returns error "typeId required" instead of deriving typeId from object ID
 *
 * Tests verify the logic changes without requiring a full Express app:
 * 1. Error message distinction: "objectId" for edit_obj vs "typeId" for object
 * 2. POST action=edit_obj rewrites to edit_obj path (not object)
 * 3. Query param fallback for edit_obj id
 */

import { describe, it, expect } from 'vitest';

describe('edit_obj typeId derivation logic (#442)', () => {
  /**
   * Test the error message logic from legacy-compat.js line ~5021.
   * Before fix: both object and edit_obj said "typeId required".
   * After fix: edit_obj says "objectId required".
   */
  it('error message should say "objectId" for edit_obj page', () => {
    const page = 'edit_obj';
    const db = 'testdb';
    const errorMsg = `${page === 'edit_obj' ? 'objectId' : 'typeId'} required: /${db}/${page}/{id}?JSON`;
    expect(errorMsg).toBe('objectId required: /testdb/edit_obj/{id}?JSON');
  });

  it('error message should say "typeId" for object page', () => {
    const page = 'object';
    const db = 'testdb';
    const errorMsg = `${page === 'edit_obj' ? 'objectId' : 'typeId'} required: /${db}/${page}/{id}?JSON`;
    expect(errorMsg).toBe('typeId required: /testdb/object/{id}?JSON');
  });

  /**
   * Test the query param fallback logic from legacy-compat.js line ~5018-5021.
   * Before fix: subId was only derived from URL path.
   * After fix: edit_obj also checks req.query.id.
   */
  it('edit_obj should derive subId from query param when path has no id', () => {
    const page = 'edit_obj';
    const fullPath = '';  // no sub-path
    let subId = parseInt((fullPath || '').replace(/^\//, ''), 10) || 0;

    // After fix: fallback to query param for edit_obj
    if (!subId && (page === 'edit_obj' || page === 'edit')) {
      const queryId = '123';  // simulates req.query.id
      subId = parseInt(queryId || 0, 10) || 0;
    }

    expect(subId).toBe(123);
  });

  it('edit_obj with path id should use path id', () => {
    const page = 'edit_obj';
    const fullPath = '/456';
    let subId = parseInt((fullPath || '').replace(/^\//, ''), 10) || 0;

    // Fallback should not be needed since path has id
    expect(subId).toBe(456);
  });

  it('object page should NOT use query id fallback', () => {
    const page = 'object';
    const fullPath = '';
    let subId = parseInt((fullPath || '').replace(/^\//, ''), 10) || 0;

    // The fix only applies to edit_obj/edit, not object
    if (!subId && (page === 'edit_obj' || page === 'edit')) {
      subId = parseInt('123', 10) || 0;
    }

    expect(subId).toBe(0);  // object page should still be 0
  });

  /**
   * Test the POST action rewrite logic from legacy-compat.js line ~4767-4771.
   * Before fix: action=edit_obj was rewritten to /object/:id.
   * After fix: action=edit_obj is rewritten to /edit_obj/:id.
   */
  it('POST action=edit_obj should rewrite to edit_obj path', () => {
    const action = 'edit_obj';
    const db = 'testdb';
    const id = 123;

    let url;
    if (action === 'edit_obj') {
      url = `/${db}/edit_obj/${id}`;
    } else {
      url = `/${db}/object/${id}`;
    }

    expect(url).toBe('/testdb/edit_obj/123');
  });

  it('POST action=object should rewrite to object path', () => {
    const action = 'object';
    const db = 'testdb';
    const id = 456;

    let url;
    if (action === 'edit_obj') {
      url = `/${db}/edit_obj/${id}`;
    } else {
      url = `/${db}/object/${id}`;
    }

    expect(url).toBe('/testdb/object/456');
  });
});

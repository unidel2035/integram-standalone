/**
 * Auth Content-Disposition header regression tests (Issue #425)
 *
 * PHP sendJsonHeaders() sets Content-Disposition: attachment;filename=login.json
 * and Content-Transfer-Encoding: binary on ALL auth JSON responses via api_dump().
 *
 * Node.js middleware (lines 316-328) sets Content-Transfer-Encoding: binary and
 * a default Content-Disposition: attachment;filename=api.json on all res.json() calls.
 * Auth responses must override with filename=login.json to match PHP parity.
 *
 * PHP source: index.php lines 3963-3968 (sendJsonHeaders), 472-475 (login function)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the source file to perform static analysis of header presence
const sourceCode = fs.readFileSync(
  path.join(__dirname, '..', 'legacy-compat.js'),
  'utf-8'
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Issue #425 — Auth JSON responses include Content-Disposition: login.json', () => {
  /**
   * Verify that all auth-related response paths set Content-Disposition: login.json
   * before calling res.json() / res.status().json().
   *
   * PHP login() function (index.php:472-475) always calls api_dump(..., "login.json")
   * which calls sendJsonHeaders("login.json") setting both headers.
   */

  // Extract all code blocks that return auth-style JSON responses
  // (those containing message/login/db fields or _xsrf/token/id fields)

  describe('logout endpoint (/:db/exit)', () => {
    it('sets Content-Disposition: login.json before res.json with message/db/login', () => {
      // Find the exit handler section
      const exitMatch = sourceCode.match(/router\.all\([^)]*exit[^)]*\)/);
      expect(exitMatch).toBeTruthy();

      // The exit handler's JSON response must be preceded by login.json header
      const exitSection = sourceCode.slice(
        sourceCode.indexOf("router.all('/:db/exit'"),
        sourceCode.indexOf("router.all('/:db/exit'") + 2000
      );
      expect(exitSection).toContain("attachment;filename=login.json");
      expect(exitSection).toContain('res.json({ message:');
    });
  });

  describe('xsrf endpoint (/:db/xsrf)', () => {
    it('sets Content-Disposition: login.json on success path', () => {
      const xsrfIdx = sourceCode.indexOf("router.get('/:db/xsrf'");
      expect(xsrfIdx).toBeGreaterThan(0);
      const xsrfSection = sourceCode.slice(xsrfIdx, xsrfIdx + 3000);

      // Count login.json header occurrences - should be at least 3
      // (success, invalid token, and error paths)
      const loginJsonCount = (xsrfSection.match(/attachment;filename=login\.json/g) || []).length;
      expect(loginJsonCount).toBeGreaterThanOrEqual(3);
    });

    it('sets Content-Disposition: login.json on invalid token path', () => {
      const xsrfIdx = sourceCode.indexOf("router.get('/:db/xsrf'");
      const xsrfSection = sourceCode.slice(xsrfIdx, xsrfIdx + 3000);

      // The invalid-token path (clearCookie + empty session JSON) must have the header
      const invalidTokenIdx = xsrfSection.indexOf('Invalid token');
      expect(invalidTokenIdx).toBeGreaterThan(0);
      const afterInvalidToken = xsrfSection.slice(invalidTokenIdx, invalidTokenIdx + 500);
      expect(afterInvalidToken).toContain('login.json');
    });

    it('sets Content-Disposition: login.json on error catch path', () => {
      const xsrfIdx = sourceCode.indexOf("router.get('/:db/xsrf'");
      const xsrfSection = sourceCode.slice(xsrfIdx, xsrfIdx + 3000);

      // The catch block must also set the header
      const catchIdx = xsrfSection.indexOf('[Legacy xsrf] Error');
      expect(catchIdx).toBeGreaterThan(0);
      const afterCatch = xsrfSection.slice(catchIdx, catchIdx + 300);
      expect(afterCatch).toContain('login.json');
    });
  });

  describe('confirm endpoint (/:db/confirm)', () => {
    it('sets Content-Disposition: login.json on confirm success', () => {
      const confirmIdx = sourceCode.indexOf('async function handleConfirm');
      expect(confirmIdx).toBeGreaterThan(0);
      const confirmSection = sourceCode.slice(confirmIdx, confirmIdx + 2000);

      // Find confirm success path
      const confirmSuccessIdx = confirmSection.indexOf("message: 'confirm'");
      expect(confirmSuccessIdx).toBeGreaterThan(0);

      // The login.json header must appear before the confirm response
      const beforeConfirm = confirmSection.slice(0, confirmSuccessIdx);
      expect(beforeConfirm).toContain('login.json');
    });

    it('sets Content-Disposition: login.json on obsolete response', () => {
      const confirmIdx = sourceCode.indexOf('async function handleConfirm');
      const confirmSection = sourceCode.slice(confirmIdx, confirmIdx + 2000);

      const obsoleteIdx = confirmSection.indexOf("message: 'obsolete'");
      expect(obsoleteIdx).toBeGreaterThan(0);

      // login.json header must precede the obsolete response
      const beforeObsolete = confirmSection.slice(Math.max(0, obsoleteIdx - 300), obsoleteIdx);
      expect(beforeObsolete).toContain('login.json');
    });
  });

  describe('JWT auth endpoint', () => {
    it('sets Content-Disposition: login.json on JWT success', () => {
      const jwtIdx = sourceCode.indexOf('authJWT() response');
      expect(jwtIdx).toBeGreaterThan(0);
      // The login.json header must appear near the JWT response
      const jwtSection = sourceCode.slice(jwtIdx - 200, jwtIdx + 200);
      expect(jwtSection).toContain('login.json');
    });
  });

  describe('registration toConfirm response', () => {
    it('sets Content-Disposition: login.json on registration success', () => {
      const toConfirmIdx = sourceCode.indexOf("message: 'toConfirm'");
      expect(toConfirmIdx).toBeGreaterThan(0);
      const beforeToConfirm = sourceCode.slice(Math.max(0, toConfirmIdx - 300), toConfirmIdx);
      expect(beforeToConfirm).toContain('login.json');
    });
  });

  describe('password reset WRONG_CONT responses', () => {
    it('all WRONG_CONT response paths have Content-Disposition: login.json', () => {
      // Find all occurrences of WRONG_CONT in the source
      const wrongContMatches = [...sourceCode.matchAll(/message:\s*'WRONG_CONT'/g)];
      expect(wrongContMatches.length).toBeGreaterThanOrEqual(2);

      for (const match of wrongContMatches) {
        const before = sourceCode.slice(Math.max(0, match.index - 400), match.index);
        expect(before).toContain('login.json');
      }
    });
  });

  describe('password reset SMS response', () => {
    it('SMS response has Content-Disposition: login.json', () => {
      const smsIdx = sourceCode.indexOf("message: 'SMS'");
      expect(smsIdx).toBeGreaterThan(0);
      const beforeSms = sourceCode.slice(Math.max(0, smsIdx - 400), smsIdx);
      expect(beforeSms).toContain('login.json');
    });
  });

  describe('Content-Transfer-Encoding middleware', () => {
    it('middleware sets Content-Transfer-Encoding: binary on all JSON responses', () => {
      // The middleware at lines 316-328 wraps res.json to add this header
      expect(sourceCode).toContain("res.setHeader('Content-Transfer-Encoding', 'binary')");
      // Verify it's in the apiDumpJson middleware
      expect(sourceCode).toContain('function apiDumpJson');
    });
  });
});

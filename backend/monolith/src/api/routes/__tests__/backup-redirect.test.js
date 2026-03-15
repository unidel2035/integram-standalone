/**
 * Regression test for issue #452 — backup and csv_all must return 302 redirect
 *
 * PHP saves the ZIP to templates/custom/{db}/backups/ and responds with:
 *   header("Location: /$z/dir_admin/?templates=1&add_path=/backups&gf=$name.zip");
 *   → HTTP 302 redirect
 *
 * Node was previously returning 200 with the ZIP body directly.
 *
 * This test verifies the source code contains the redirect pattern
 * (code-level assertion) since full HTTP integration requires a running DB.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read the source file to verify the redirect pattern
const sourceFile = path.resolve(
  import.meta.dirname, '..', 'legacy-compat.js'
);
const source = fs.readFileSync(sourceFile, 'utf8');

describe('Issue #452 — backup and csv_all return 302 redirect (code-level)', () => {

  describe('GET /:db/backup route', () => {
    // Extract the backup route handler source (between "router.get('/:db/backup'" and the next "router.")
    const backupMatch = source.match(
      /router\.get\('\/\:db\/backup'[\s\S]*?(?=\nrouter\.|\/\/ ====)/
    );
    const backupSource = backupMatch ? backupMatch[0] : '';

    it('should contain res.redirect(302, ...) instead of res.send(zipBuffer)', () => {
      expect(backupSource).toContain('res.redirect(302,');
      expect(backupSource).not.toMatch(/res\.send\(zipBuffer\)/);
    });

    it('should redirect to /{db}/dir_admin/?templates=1&add_path=/backups&gf=...', () => {
      expect(backupSource).toContain('dir_admin/?templates=1&add_path=/backups&gf=');
    });

    it('should save ZIP file to templates/custom/{db}/backups/ before redirecting', () => {
      expect(backupSource).toContain("'templates', 'custom', db, 'backups'");
      expect(backupSource).toContain('fs.writeFileSync');
    });

    it('should create backups directory if it does not exist', () => {
      expect(backupSource).toContain('fs.mkdirSync');
      expect(backupSource).toContain('recursive: true');
    });

    it('should NOT set Content-Type: application/zip (no longer streaming)', () => {
      // The old code set Content-Type for direct streaming; redirect should not
      expect(backupSource).not.toContain("'Content-Type', 'application/zip'");
    });
  });

  describe('GET /:db/csv_all route', () => {
    const csvAllMatch = source.match(
      /router\.get\('\/\:db\/csv_all'[\s\S]*?(?=\n\/\*\*|\nrouter\.|\/\/ ====)/
    );
    const csvAllSource = csvAllMatch ? csvAllMatch[0] : '';

    it('should contain res.redirect(302, ...) instead of res.send(zipBuffer)', () => {
      expect(csvAllSource).toContain('res.redirect(302,');
      expect(csvAllSource).not.toMatch(/res\.send\(zipBuffer\)/);
    });

    it('should redirect to /{db}/dir_admin/?templates=1&add_path=/backups&gf=...', () => {
      expect(csvAllSource).toContain('dir_admin/?templates=1&add_path=/backups&gf=');
    });

    it('should save ZIP file to templates/custom/{db}/backups/ before redirecting', () => {
      expect(csvAllSource).toContain("'templates', 'custom', db, 'backups'");
      expect(csvAllSource).toContain('fs.writeFileSync');
    });

    it('should create backups directory if it does not exist', () => {
      expect(csvAllSource).toContain('fs.mkdirSync');
      expect(csvAllSource).toContain('recursive: true');
    });

    it('should NOT set Content-Type: application/zip (no longer streaming)', () => {
      expect(csvAllSource).not.toContain("'Content-Type', 'application/zip'");
    });
  });

  describe('redirect URL format matches PHP exactly', () => {
    it('backup redirect uses PHP format: /${db}/dir_admin/?templates=1&add_path=/backups&gf=${zipFilename}', () => {
      // PHP: header("Location: /$z/dir_admin/?templates=1&add_path=/backups&gf=$name.zip");
      // Node should use the same URL pattern in res.redirect()
      const redirectPattern = /res\.redirect\(302,\s*`\/\$\{db\}\/dir_admin\/\?templates=1&add_path=\/backups&gf=\$\{zipFilename\}`\)/;
      expect(source).toMatch(redirectPattern);
    });

    it('csv_all redirect uses the same PHP format', () => {
      // Both backup and csv_all should use the same redirect pattern
      const matches = source.match(
        /res\.redirect\(302,\s*`\/\$\{db\}\/dir_admin\/\?templates=1&add_path=\/backups&gf=\$\{zipFilename\}`\)/g
      );
      // Should appear at least twice: once for backup, once for csv_all
      expect(matches).not.toBeNull();
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });
});

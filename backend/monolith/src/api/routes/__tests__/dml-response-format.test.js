/**
 * DML Response Format Parity Tests (Issue #439)
 *
 * Verifies that DML endpoints (_m_new, _m_save, _m_del, _m_up, _m_ord, _m_move, _m_id)
 * have the correct response format matching PHP behavior:
 *
 * - Success: bare object via legacyRespond / res.json({...}) — not wrapped in array
 * - my_die() errors: [{error:"..."}] (array format matches PHP my_die)
 * - die()/exit() validation errors: plain text via res.send() (not JSON)
 *
 * These tests verify the response format by inspecting the source code patterns,
 * since the DML routes require complex auth/XSRF mock setup for HTTP-level testing.
 *
 * PHP source references:
 * - api_dump (line 7448): success JSON object
 * - my_die (line 985): [{error:"msg"}] for API requests
 * - die("text") / exit("text"): plain text for validation guards
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '..', 'legacy-compat.js'), 'utf-8');

// ─── Helper: extract a route handler's source code ──────────────────────────

function getRouteSection(endpoint) {
  // Find the route definition and extract until next router.post/router.get or EOF
  const patterns = {
    '_m_id': /router\.post\([^)]*_m_id[^)]*\)/,
    '_m_ord': /router\.post\([^)]*_m_ord[^)]*\)/,
    '_m_move': /router\.post\([^)]*_m_move[^)]*\)/,
    '_m_del': /router\.post\([^)]*_m_del[^)]*\)/,
    '_m_save': /router\.post\([^)]*_m_save[^)]*\)/,
    '_m_up': /router\.post\([^)]*_m_up[^)]*\)/,
    '_m_new': /router\.post\([^)]*_m_new[^)]*\)/,
  };

  const startMatch = SRC.match(patterns[endpoint]);
  if (!startMatch) return '';
  const startIdx = startMatch.index;

  // Find the next router definition after this one
  const rest = SRC.slice(startIdx + 10);
  const nextRoute = rest.match(/\nrouter\.(post|get|put|delete|all)\(/);
  const endIdx = nextRoute ? startIdx + 10 + nextRoute.index : SRC.length;

  return SRC.slice(startIdx, endIdx);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DML Response Format Parity (Issue #439)', () => {

  describe('_m_id — validation errors return plain text (PHP: die("Invalid ID"))', () => {
    const section = getRouteSection('_m_id');

    it('returns res.send("Invalid ID") for invalid new_id, not res.json([{error}])', () => {
      // PHP line 8842-8843: die("Invalid ID") — plain text
      expect(section).toContain("res.status(200).send('Invalid ID')");
      expect(section).not.toMatch(/json\(\[\{.*error.*new_id must be a positive integer/);
    });

    it('returns [{error}] for "This id belongs to metadata" (PHP: my_die)', () => {
      // PHP line 8848-8849: my_die("This id belongs to metadata") → [{error}]
      expect(section).toContain("'This id belongs to metadata'");
      expect(section).toMatch(/json\(\[\{.*error.*This id belongs to metadata/s);
    });

    it('returns [{error}] for "The new id is occupied" (PHP: my_die)', () => {
      // PHP line 8850-8851: my_die("The new id is occupied") → [{error}]
      expect(section).toContain("'The new id is occupied'");
      expect(section).toMatch(/json\(\[\{.*error.*The new id is occupied/s);
    });
  });

  describe('_m_ord — validation errors return plain text (PHP: die("Invalid order"))', () => {
    const section = getRouteSection('_m_ord');

    it('returns res.send("Invalid order") for invalid order param', () => {
      // PHP line 7822-7823: die("Invalid order") — plain text
      expect(section).toContain("res.status(200).send('Invalid order')");
    });
  });

  describe('_m_move — validation errors return plain text (PHP: die/exit)', () => {
    const section = getRouteSection('_m_move');

    it('returns plain text "Wrong id: ..." for id=0 (PHP: die line 8239)', () => {
      // PHP line 8238-8239: die("Wrong id: $id") — plain text
      expect(section).toMatch(/res\.status\(200\)\.send\(`Wrong id: \$\{id\}`\)/);
    });

    it('returns plain text "Cannot update meta-data" (PHP: exit line 8260)', () => {
      expect(section).toContain("res.status(200).send('Cannot update meta-data')");
    });

    it('returns plain text "No such record" when object/parent not found (PHP: exit line 8271)', () => {
      expect(section).toContain("res.status(200).send('No such record')");
    });

    it('returns plain text for types mismatch (PHP: exit line 8262)', () => {
      expect(section).toMatch(/res\.status\(200\)\.send\(`Types mismatch/);
    });
  });

  describe('_m_del — error format parity', () => {
    const section = getRouteSection('_m_del');

    it('returns [{error}] for wrong id=0 (PHP: my_die line 8277)', () => {
      // PHP: my_die("Wrong id: $id") → [{error}]
      expect(section).toMatch(/json\(\[\{.*error.*Wrong id/s);
    });

    it('returns plain text "Object not found" (PHP: die line 8306)', () => {
      expect(section).toContain("res.status(200).send('Object not found')");
    });

    it('returns [{error}] for metadata deletion (PHP: my_die line 8288)', () => {
      expect(section).toMatch(/json\(\[\{.*error.*can't delete metadata/s);
    });

    it('success path uses legacyRespond (bare object)', () => {
      expect(section).toContain('legacyRespond(req, res, db,');
    });
  });

  describe('_m_save — error format parity', () => {
    const section = getRouteSection('_m_save');

    it('returns plain text "No such record" (PHP: exit line 7999)', () => {
      expect(section).toContain("res.status(200).send('No such record')");
    });

    it('returns plain text "Cannot update meta-data" (PHP: exit line 8001)', () => {
      expect(section).toContain("res.status(200).send('Cannot update meta-data')");
    });

    it('success path uses legacyRespond (bare object)', () => {
      expect(section).toContain('legacyRespond(req, res, db,');
    });
  });

  describe('_m_up — error format parity', () => {
    const section = getRouteSection('_m_up');

    it('returns plain text "No arr recs" when object not found (PHP: exit line 7816)', () => {
      expect(section).toContain("res.status(200).send('No arr recs')");
    });

    it('success path uses legacyRespond (bare object)', () => {
      expect(section).toContain('legacyRespond(req, res, db,');
    });
  });

  describe('_m_new — success returns bare object', () => {
    const section = getRouteSection('_m_new');

    it('success path returns res.json({...}) bare object (not array)', () => {
      // PHP line 8546-8547: die("{\"id\":...}") — bare JSON object
      expect(section).toMatch(/return res\.json\(\{ id.*obj.*ord.*next_act.*args.*val/);
    });
  });

  describe('legacyRespond returns bare object (not array)', () => {
    it('legacyRespond sends { id, obj, next_act, args, warnings } as bare object', () => {
      // The function body should return res.json({...}), not res.json([{...}])
      const funcMatch = SRC.match(/function legacyRespond[\s\S]*?^}/m);
      expect(funcMatch).toBeTruthy();
      const funcBody = funcMatch[0];
      expect(funcBody).toContain('res.json({ id, obj, next_act');
      expect(funcBody).not.toContain('res.json([');
    });
  });
});

# 30-special-operations — Misc Special Operations

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_save (rename type) | 200 | 200 | MATCH |
| 2 | #2 GET /edit_types (after rename) | 200 | 200 | MATCH |
| 3 | #3 POST /_d_null (set NOT NULL) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_new (empty with NOT NULL) | 200 | 200 | MATCH |
| 5 | #6 POST /_d_null (remove NOT NULL) | 200 | 200 | MATCH |
| 6 | #7 POST /_m_save (rename object) | 200 | 200 | MATCH |
| 7 | #8 GET /edit_obj (after rename) | 200 | 200 | MATCH |
| 8 | #9 POST /_m_del (referenced object) | 200 | 200 | MATCH |
| 9 | #10 GET /metadata (main type) | 200 | 200 | MATCH |
| 10 | #11 GET /metadata (JSON_KV) | 200 | 200 | MATCH |
| 11 | #12 GET /obj_meta (object) | 200 | 200 | MATCH |
| 12 | #13 POST /_d_del (empty type) | 200 | 200 | MATCH |
| 13 | #14 POST /_d_del (type with objects, forced) | 200 | 200 | MATCH |
| 14 | #15 GET /edit_types (after deletes) | 200 | 200 | MATCH |
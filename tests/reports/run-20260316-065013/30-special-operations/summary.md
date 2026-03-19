# 30-special-operations

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_save (rename type) | POST | 200 | 200 | MATCH |
| 02 | #2 GET /edit_types (after rename) | GET | 200 | 200 | MATCH |
| 03 | #3 POST /_d_null (set NOT NULL) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_new (empty with NOT NULL) | POST | 200 | 200 | MATCH |
| 05 | #6 POST /_d_null (remove NOT NULL) | POST | 200 | 200 | MATCH |
| 06 | #7 POST /_m_save (rename object) | POST | 200 | 200 | MATCH |
| 07 | #8 GET /edit_obj (after rename) | GET | 200 | 200 | MATCH |
| 08 | #9 POST /_m_del (referenced object) | POST | 200 | 200 | MATCH |
| 09 | #10 GET /metadata (main type) | GET | 200 | 200 | MATCH |
| 10 | #11 GET /metadata (JSON_KV) | GET | 200 | 200 | MATCH |
| 11 | #12 GET /obj_meta (object) | GET | 200 | 200 | MATCH |
| 12 | #13 POST /_d_del (empty type) | POST | 200 | 200 | MATCH |
| 13 | #14 POST /_d_del (type with objects, forced) | POST | 200 | 200 | MATCH |
| 14 | #15 GET /edit_types (after deletes) | GET | 200 | 200 | MATCH |
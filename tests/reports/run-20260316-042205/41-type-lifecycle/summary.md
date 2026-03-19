# 41-type-lifecycle

**19 MATCH / 0 DIFF** out of 19 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /terms (after create) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /metadata (after SHORT col) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /metadata (after NUMBER col) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /metadata (after DATETIME col) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /metadata (after REF col) | GET | 200 | 200 | MATCH |
| 06 | #6 POST /_d_save (rename type) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_d_alias (rename col1) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /metadata (after renames) | GET | 200 | 200 | MATCH |
| 09 | #9 POST /_d_null (set NOT NULL) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_d_multi (set MULTI) | POST | 200 | 200 | MATCH |
| 11 | #11 GET /metadata (after modifiers) | GET | 200 | 200 | MATCH |
| 12 | #12 POST /_d_null (remove NOT NULL) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_d_up (move col2 up) | POST | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (after reorder) | GET | 200 | 200 | MATCH |
| 15 | #15 POST /_d_del_req (delete DATETIME) | POST | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after del col) | GET | 200 | 200 | MATCH |
| 17 | #17 POST /_d_del (forced) | POST | 200 | 200 | MATCH |
| 18 | #18 GET /terms (after delete) | GET | 200 | 200 | MATCH |
| 19 | #19 GET /edit_types (after delete) | GET | 200 | 200 | MATCH |
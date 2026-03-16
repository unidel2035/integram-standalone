# 35-metadata-obj-meta

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /metadata (JSON) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /metadata (JSON_KV) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /metadata (no typeId) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /obj_meta (obj with values) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /obj_meta (obj no values) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /metadata (after add col) | GET | 200 | 200 | MATCH |
| 07 | #7 POST /_d_alias (rename col) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /metadata (after rename) | GET | 200 | 200 | MATCH |
| 09 | #9 POST /_d_del_req (delete col) | POST | 200 | 200 | MATCH |
| 10 | #10 GET /metadata (after del col) | GET | 200 | 200 | MATCH |
| 11 | #12 GET /edit_types (JSON) | GET | 200 | 200 | MATCH |
| 12 | #13 GET /edit_types (JSON_DATA) | GET | 200 | 200 | MATCH |
| 13 | #14 GET /terms (JSON) | GET | 200 | 200 | MATCH |
| 14 | #15 GET /terms (JSON_DATA) | GET | 200 | 200 | MATCH |
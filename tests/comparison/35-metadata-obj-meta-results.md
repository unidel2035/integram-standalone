# 35-metadata-obj-meta — Metadata Deep Comparison

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /metadata (JSON) | 200 | 200 | MATCH |
| 2 | #2 GET /metadata (JSON_KV) | 200 | 200 | MATCH |
| 3 | #3 GET /metadata (no typeId) | 200 | 200 | MATCH |
| 4 | #4 GET /obj_meta (obj with values) | 200 | 200 | MATCH |
| 5 | #5 GET /obj_meta (obj no values) | 200 | 200 | MATCH |
| 6 | #6 GET /metadata (after add col) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_alias (rename col) | 200 | 200 | MATCH |
| 8 | #8 GET /metadata (after rename) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_del_req (delete col) | 200 | 200 | MATCH |
| 10 | #10 GET /metadata (after del col) | 200 | 200 | MATCH |
| 11 | #12 GET /edit_types (JSON) | 200 | 200 | MATCH |
| 12 | #13 GET /edit_types (JSON_DATA) | 200 | 200 | MATCH |
| 13 | #14 GET /terms (JSON) | 200 | 200 | MATCH |
| 14 | #15 GET /terms (JSON_DATA) | 200 | 200 | MATCH |
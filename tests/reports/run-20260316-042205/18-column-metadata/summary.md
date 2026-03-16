# 18-column-metadata

**19 MATCH / 0 DIFF** out of 19 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_alias (set alias) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_d_alias (number alias) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_d_alias (clear alias) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_d_alias (set again) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_d_null (set NOT NULL) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_d_null (toggle off) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_d_multi (set MULTI) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_d_multi (toggle off) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_d_ord (move to pos 1) | POST | 200 | 200 | MATCH |
| 10 | #10 GET /metadata (after reorder) | GET | 200 | 200 | MATCH |
| 11 | #11 POST /_d_up (move col up) | POST | 200 | 200 | MATCH |
| 12 | #12 GET /metadata (after move up) | GET | 200 | 200 | MATCH |
| 13 | #13 POST /_d_attrs (set attrs) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_d_attrs (clear attrs) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_d_del_req (delete column) | POST | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after delete col) | GET | 200 | 200 | MATCH |
| 17 | #17 POST /_d_del_req (already deleted) | POST | 200 | 200 | MATCH |
| 18 | #18 GET /edit_types (full state) | GET | 200 | 200 | MATCH |
| 19 | #19 GET /metadata (final) | GET | 200 | 200 | MATCH |
# 49-more-legacy-aliases

**23 MATCH / 0 DIFF** out of 23 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_attributes/:typeId (add column) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_attributes (nonexistent typeId) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_setalias/:reqId (rename column) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_setalias (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_setnull/:reqId (toggle NOT NULL) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_setnull (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_setmulti/:reqId (toggle multiselect) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_setmulti (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_setorder/:reqId (reorder column) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_setorder (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_moveup/:reqId (move column up) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_moveup (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_modifiers/:reqId (set attrs :!NULL:) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_modifiers (no xsrf — should reject) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_modifiers (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_deletereq/:reqId (delete column) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /_deletereq (nonexistent reqId) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_deleteterm/:typeId (delete type) | POST | 200 | 200 | MATCH |
| 19 | #19 GET /terms (deleted type gone from both) | GET | 200 | 200 | MATCH |
| 20 | #20 POST /_deleteterm (nonexistent typeId) | POST | 200 | 200 | MATCH |
| 21 | #21 POST /_setalias (no xsrf — should reject) | POST | 200 | 200 | MATCH |
| 22 | #22 POST /_setnull (no xsrf — should reject) | POST | 200 | 200 | MATCH |
| 23 | #23 POST /_deleteterm (no xsrf — should reject) | POST | 200 | 200 | MATCH |
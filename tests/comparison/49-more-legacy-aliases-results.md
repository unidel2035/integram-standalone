# 49-more-legacy-aliases — More Legacy URL Aliases

23 MATCH / 0 DIFF out of 23 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_attributes/:typeId (add column) | 200 | 200 | MATCH |
| 2 | #2 POST /_attributes (nonexistent typeId) | 200 | 200 | MATCH |
| 3 | #3 POST /_setalias/:reqId (rename column) | 200 | 200 | MATCH |
| 4 | #4 POST /_setalias (nonexistent reqId) | 200 | 200 | MATCH |
| 5 | #5 POST /_setnull/:reqId (toggle NOT NULL) | 200 | 200 | MATCH |
| 6 | #6 POST /_setnull (nonexistent reqId) | 200 | 200 | MATCH |
| 7 | #7 POST /_setmulti/:reqId (toggle multiselect) | 200 | 200 | MATCH |
| 8 | #8 POST /_setmulti (nonexistent reqId) | 200 | 200 | MATCH |
| 9 | #9 POST /_setorder/:reqId (reorder column) | 200 | 200 | MATCH |
| 10 | #10 POST /_setorder (nonexistent reqId) | 200 | 200 | MATCH |
| 11 | #11 POST /_moveup/:reqId (move column up) | 200 | 200 | MATCH |
| 12 | #12 POST /_moveup (nonexistent reqId) | 200 | 200 | MATCH |
| 13 | #13 POST /_modifiers/:reqId (set attrs :!NULL:) | 200 | 200 | MATCH |
| 14 | #14 POST /_modifiers (no xsrf — should reject) | 200 | 200 | MATCH |
| 15 | #15 POST /_modifiers (nonexistent reqId) | 200 | 200 | MATCH |
| 16 | #16 POST /_deletereq/:reqId (delete column) | 200 | 200 | MATCH |
| 17 | #17 POST /_deletereq (nonexistent reqId) | 200 | 200 | MATCH |
| 18 | #18 POST /_deleteterm/:typeId (delete type) | 200 | 200 | MATCH |
| 19 | #19 GET /terms (deleted type gone from both) | 200 | 200 | MATCH |
| 20 | #20 POST /_deleteterm (nonexistent typeId) | 200 | 200 | MATCH |
| 21 | #21 POST /_setalias (no xsrf — should reject) | 200 | 200 | MATCH |
| 22 | #22 POST /_setnull (no xsrf — should reject) | 200 | 200 | MATCH |
| 23 | #23 POST /_deleteterm (no xsrf — should reject) | 200 | 200 | MATCH |
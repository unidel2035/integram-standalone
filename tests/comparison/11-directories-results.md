# 11-directories — Справочники & References

22 MATCH / 0 DIFF out of 22 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (lookup list) | 200 | 200 | MATCH |
| 2 | #2 GET /object (lookup LIMIT=3) | 200 | 200 | MATCH |
| 3 | #3 GET /edit_obj (lookup item) | 200 | 200 | MATCH |
| 4 | #4 GET /_ref_reqs (color options) | 200 | 200 | MATCH |
| 5 | #5 GET /_ref_reqs (size options) | 200 | 200 | MATCH |
| 6 | #6 GET /_ref_reqs (query=Крас) | 200 | 200 | MATCH |
| 7 | #7 GET /_ref_reqs (empty query) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (set color ref) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (set size ref) | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (with refs) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (change color ref) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (clear color ref) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (multiselect add red) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (multiselect add green) | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (multiselect add blue) | 200 | 200 | MATCH |
| 16 | #16 GET /edit_obj (multiselect obj) | 200 | 200 | MATCH |
| 17 | #17 GET /_ref_reqs (multiselect col) | 200 | 200 | MATCH |
| 18 | #18 GET /object (with multiselect) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_new (add to lookup) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (rename lookup) | 200 | 200 | MATCH |
| 21 | #21 POST /_m_del (delete lookup val) | 200 | 200 | MATCH |
| 22 | #22 GET /object (lookup after CRUD) | 200 | 200 | MATCH |
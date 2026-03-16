# 11-directories

**22 MATCH / 0 DIFF** out of 22 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (lookup list) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (lookup LIMIT=3) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /edit_obj (lookup item) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /_ref_reqs (color options) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /_ref_reqs (size options) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /_ref_reqs (query=Крас) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /_ref_reqs (empty query) | GET | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (set color ref) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (set size ref) | POST | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (with refs) | GET | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (change color ref) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (clear color ref) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (multiselect add red) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (multiselect add green) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (multiselect add blue) | POST | 200 | 200 | MATCH |
| 16 | #16 GET /edit_obj (multiselect obj) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /_ref_reqs (multiselect col) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /object (with multiselect) | GET | 200 | 200 | MATCH |
| 19 | #19 POST /_m_new (add to lookup) | POST | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (rename lookup) | POST | 200 | 200 | MATCH |
| 21 | #21 POST /_m_del (delete lookup val) | POST | 200 | 200 | MATCH |
| 22 | #22 GET /object (lookup after CRUD) | GET | 200 | 200 | MATCH |
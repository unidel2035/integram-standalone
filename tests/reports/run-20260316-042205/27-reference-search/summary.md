# 27-reference-search

**13 MATCH / 0 DIFF** out of 13 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /_ref_reqs (all items) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /_ref_reqs (with obj id) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (lookup all) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (F_U=1) | GET | 200 | 200 | MATCH |
| 05 | #5 POST /_m_set (set ref to Дрон) | POST | 200 | 200 | MATCH |
| 06 | #6 GET /edit_obj (after set ref) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (listing with refs) | GET | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (invalid ref) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (clear ref to 0) | POST | 200 | 200 | MATCH |
| 10 | #10 GET /_ref_reqs (nonexistent) | GET | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (set ref obj2) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (set ref obj3 same) | POST | 200 | 200 | MATCH |
| 13 | #13 GET /object (all with refs) | GET | 200 | 200 | MATCH |
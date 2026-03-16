# 27-reference-search — Reference Dropdown & Search

13 MATCH / 0 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /_ref_reqs (all items) | 200 | 200 | MATCH |
| 2 | #2 GET /_ref_reqs (with obj id) | 200 | 200 | MATCH |
| 3 | #3 GET /object (lookup all) | 200 | 200 | MATCH |
| 4 | #4 GET /object (F_U=1) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_set (set ref to Дрон) | 200 | 200 | MATCH |
| 6 | #6 GET /edit_obj (after set ref) | 200 | 200 | MATCH |
| 7 | #7 GET /object (listing with refs) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (invalid ref) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (clear ref to 0) | 200 | 200 | MATCH |
| 10 | #10 GET /_ref_reqs (nonexistent) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (set ref obj2) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (set ref obj3 same) | 200 | 200 | MATCH |
| 13 | #13 GET /object (all with refs) | 200 | 200 | MATCH |
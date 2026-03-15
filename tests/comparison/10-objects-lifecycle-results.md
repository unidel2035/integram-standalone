# 10-objects-lifecycle — Full Object Lifecycle

28 MATCH / 0 DIFF out of 28 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_m_new (value only) | 200 | 200 | MATCH |
| 2 | #2 POST /_m_new (with requisites) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_new (empty) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_new (special chars) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_save (rename) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_save (with reqs) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_save (copy) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (text) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (number) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (date) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (bool true) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (bool false) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (long text) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (clear field) | 200 | 200 | MATCH |
| 15 | #15 GET /object (list) | 200 | 200 | MATCH |
| 16 | #16 GET /object (LIMIT=2) | 200 | 200 | MATCH |
| 17 | #17 GET /object (page 2) | 200 | 200 | MATCH |
| 18 | #18 GET /edit_obj | 200 | 200 | MATCH |
| 19 | #19 GET /object (count, LIMIT=0) | 200 | 200 | MATCH |
| 20 | #20 GET /obj_meta | 200 | 200 | MATCH |
| 21 | #21 POST /_m_up | 200 | 200 | MATCH |
| 22 | #22 POST /_m_ord (order=1) | 200 | 200 | MATCH |
| 23 | #23 POST /_m_move (to root) | 200 | 200 | MATCH |
| 24 | #24 POST /_m_id (valid) | 200 | 200 | MATCH |
| 25 | #25 POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 26 | #26 POST /_m_del (existing) | 200 | 200 | MATCH |
| 27 | #27 POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 28 | #28 GET /object (after delete) | 200 | 200 | MATCH |
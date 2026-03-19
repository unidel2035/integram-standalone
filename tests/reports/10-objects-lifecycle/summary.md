# 10-objects-lifecycle

**28 MATCH / 0 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_new (value only) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_m_new (with requisites) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_new (empty) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_new (special chars) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_save (rename) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_save (with reqs) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_save (copy) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (text) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (number) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (date) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (bool true) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (bool false) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (long text) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (clear field) | POST | 200 | 200 | MATCH |
| 15 | #15 GET /object (list) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /object (LIMIT=2) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /object (page 2) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /edit_obj | GET | 200 | 200 | MATCH |
| 19 | #19 GET /object (count, LIMIT=0) | GET | 200 | 200 | MATCH |
| 20 | #20 GET /obj_meta | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_m_up | POST | 200 | 200 | MATCH |
| 22 | #22 POST /_m_ord (order=1) | POST | 200 | 200 | MATCH |
| 23 | #23 POST /_m_move (to root) | POST | 200 | 200 | MATCH |
| 24 | #24 POST /_m_id (valid) | POST | 200 | 200 | MATCH |
| 25 | #25 POST /_m_id (duplicate) | POST | 200 | 200 | MATCH |
| 26 | #26 POST /_m_del (existing) | POST | 200 | 200 | MATCH |
| 27 | #27 POST /_m_del (non-existent) | POST | 200 | 200 | MATCH |
| 28 | #28 GET /object (after delete) | GET | 200 | 200 | MATCH |
# 33-error-handling-edge

**20 MATCH / 0 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /edit_obj (nonexistent) | GET | 200 | 200 | MATCH |
| 02 | #2 POST /_m_del (nonexistent) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_set (nonexistent) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_save (nonexistent) | POST | 200 | 200 | MATCH |
| 05 | #5 GET /object (nonexistent type) | GET | 200 | 200 | MATCH |
| 06 | #6 POST /_m_del (no xsrf) | POST | 403 | 403 | MATCH |
| 07 | #7 POST /_m_del (wrong xsrf) | POST | 403 | 403 | MATCH |
| 08 | #8 POST /_d_new (no xsrf) | POST | 403 | 403 | MATCH |
| 09 | #9 POST /_m_del (first delete) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_del (double delete) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (very long value) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (special chars) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (emoji) | POST | 500 | 200 | MATCH |
| 14 | #14 POST /_m_set (number=0) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (number=-999) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /auth (JSON content-type) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /_m_set (string id) | POST | 200 | 200 | MATCH |
| 18 | #18 GET /object (id=0) | GET | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (id=0) | GET | 200 | 200 | MATCH |
| 20 | #20 POST /_m_up (nonexistent) | POST | 200 | 200 | MATCH |
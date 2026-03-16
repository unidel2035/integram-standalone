# 33-error-handling-edge — Error Handling & Edge Cases

20 MATCH / 0 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /edit_obj (nonexistent) | 200 | 200 | MATCH |
| 2 | #2 POST /_m_del (nonexistent) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_set (nonexistent) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_save (nonexistent) | 200 | 200 | MATCH |
| 5 | #5 GET /object (nonexistent type) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_del (no xsrf) | 403 | 403 | MATCH |
| 7 | #7 POST /_m_del (wrong xsrf) | 403 | 403 | MATCH |
| 8 | #8 POST /_d_new (no xsrf) | 403 | 403 | MATCH |
| 9 | #9 POST /_m_del (first delete) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_del (double delete) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (very long value) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (special chars) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (emoji) | 500 | 200 | MATCH |
| 14 | #14 POST /_m_set (number=0) | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (number=-999) | 200 | 200 | MATCH |
| 16 | #16 POST /auth (JSON content-type) | 200 | 200 | MATCH |
| 17 | #17 POST /_m_set (string id) | 200 | 200 | MATCH |
| 18 | #18 GET /object (id=0) | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (id=0) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_up (nonexistent) | 200 | 200 | MATCH |
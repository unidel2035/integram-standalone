# 45-m-id-validate-auth — ID Change & Auth Endpoints

22 MATCH / 0 DIFF out of 22 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /validate (with cookie) | 200 | 200 | MATCH |
| 2 | #2 GET /validate (no cookie) | 302 | 401 | MATCH |
| 3 | #3 POST /getcode (bad email format) | 200 | 200 | MATCH |
| 4 | #4 POST /getcode (empty email) | 200 | 200 | MATCH |
| 5 | #5 POST /getcode (no u param) | 200 | 200 | MATCH |
| 6 | #6 POST /getcode (unknown email) | 200 | 200 | MATCH |
| 7 | #7 POST /getcode (known email testbot) | 200 | 200 | MATCH |
| 8 | #8 POST /checkcode (no params) | 200 | 200 | MATCH |
| 9 | #9 POST /checkcode (short code) | 200 | 200 | MATCH |
| 10 | #10 POST /checkcode (wrong code) | 200 | 200 | MATCH |
| 11 | #11 POST /checkcode (no user match) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_id (success) | 200 | 200 | MATCH |
| 13 | #13 GET /edit_obj (after id change) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_id (same id) | 200 | 200 | MATCH |
| 15 | #15 POST /_m_id (occupied target) | 200 | 200 | MATCH |
| 16 | #16 POST /_m_id (nonexistent src) | 200 | 200 | MATCH |
| 17 | #17 POST /_m_id (invalid new_id) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_id (no new_id) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_id (type row, up=0) | 200 | 200 | MATCH |
| 20 | #20 GET /edit_obj (obj2 intact) | 200 | 200 | MATCH |
| 21 | #21 POST /_m_id (parent with children) | 200 | 200 | MATCH |
| 22 | #22 GET /object (children under new id) | 200 | 200 | MATCH |
# 45-m-id-validate-auth

**22 MATCH / 0 DIFF** out of 22 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /validate (with cookie) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /validate (no cookie) | GET | 302 | 401 | MATCH |
| 03 | #3 POST /getcode (bad email format) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /getcode (empty email) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /getcode (no u param) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /getcode (unknown email) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /getcode (known email testbot) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /checkcode (no params) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /checkcode (short code) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /checkcode (wrong code) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /checkcode (no user match) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_id (success) | POST | 200 | 200 | MATCH |
| 13 | #13 GET /edit_obj (after id change) | GET | 200 | 200 | MATCH |
| 14 | #14 POST /_m_id (same id) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_m_id (occupied target) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_m_id (nonexistent src) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /_m_id (invalid new_id) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_m_id (no new_id) | POST | 200 | 200 | MATCH |
| 19 | #19 POST /_m_id (type row, up=0) | POST | 200 | 200 | MATCH |
| 20 | #20 GET /edit_obj (obj2 intact) | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_m_id (parent with children) | POST | 200 | 200 | MATCH |
| 22 | #22 GET /object (children under new id) | GET | 200 | 200 | MATCH |
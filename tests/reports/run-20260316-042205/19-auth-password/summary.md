# 19-auth-password

**21 MATCH / 0 DIFF** out of 21 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /auth (valid login) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /auth (response keys) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /auth (wrong password) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /auth (nonexistent user) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /auth (empty login) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /auth (empty password) | POST | 200 | 200 | MATCH |
| 07 | #7 GET /xsrf (valid token) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /xsrf (no cookie) | GET | 401 | 401 | MATCH |
| 09 | #9 GET /xsrf (invalid token) | GET | 401 | 401 | MATCH |
| 10 | #10 GET /validate (valid token) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /validate (no cookie) | GET | 401 | 401 | MATCH |
| 12 | #12 POST /getcode (invalid email) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /getcode (empty user) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /getcode (nonexistent email) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /checkcode (invalid data) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /checkcode (wrong code) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /checkcode (short code) | POST | 200 | 200 | MATCH |
| 18 | #19 POST /_m_new (no XSRF) | POST | 403 | 403 | MATCH |
| 19 | #20 POST /_m_new (wrong XSRF) | POST | 403 | 403 | MATCH |
| 20 | #21 GET /grants | GET | 200 | 200 | MATCH |
| 21 | #22 POST /check_grant | POST | 200 | 200 | MATCH |
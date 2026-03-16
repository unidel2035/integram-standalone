# 19-auth-password — Authentication & Password Flow

21 MATCH / 0 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /auth (valid login) | 200 | 200 | MATCH |
| 2 | #2 POST /auth (response keys) | 200 | 200 | MATCH |
| 3 | #3 POST /auth (wrong password) | 200 | 200 | MATCH |
| 4 | #4 POST /auth (nonexistent user) | 200 | 200 | MATCH |
| 5 | #5 POST /auth (empty login) | 200 | 200 | MATCH |
| 6 | #6 POST /auth (empty password) | 200 | 200 | MATCH |
| 7 | #7 GET /xsrf (valid token) | 200 | 200 | MATCH |
| 8 | #8 GET /xsrf (no cookie) | 401 | 401 | MATCH |
| 9 | #9 GET /xsrf (invalid token) | 401 | 401 | MATCH |
| 10 | #10 GET /validate (valid token) | 200 | 200 | MATCH |
| 11 | #11 GET /validate (no cookie) | 401 | 401 | MATCH |
| 12 | #12 POST /getcode (invalid email) | 200 | 200 | MATCH |
| 13 | #13 POST /getcode (empty user) | 200 | 200 | MATCH |
| 14 | #14 POST /getcode (nonexistent email) | 200 | 200 | MATCH |
| 15 | #15 POST /checkcode (invalid data) | 200 | 200 | MATCH |
| 16 | #16 POST /checkcode (wrong code) | 200 | 200 | MATCH |
| 17 | #17 POST /checkcode (short code) | 200 | 200 | MATCH |
| 18 | #19 POST /_m_new (no XSRF) | 403 | 403 | MATCH |
| 19 | #20 POST /_m_new (wrong XSRF) | 403 | 403 | MATCH |
| 20 | #21 GET /grants | 200 | 200 | MATCH |
| 21 | #22 POST /check_grant | 200 | 200 | MATCH |
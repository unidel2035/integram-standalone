# 32-session-exit-jwt

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /jwt (empty body) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /jwt (jwt=empty) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /jwt (fake token) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /jwt (malformed) | POST | 200 | 200 | MATCH |
| 05 | #5 GET /confirm (no params) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /confirm (empty params) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /confirm (invalid user) | GET | 200 | 200 | MATCH |
| 08 | #8 POST /confirm (no params) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /confirm (invalid) | POST | 200 | 200 | MATCH |
| 10 | #10 GET /login | GET | 302 | 302 | MATCH |
| 11 | #11 POST /login | POST | 200 | 302 | MATCH |
| 12 | #12 GET /exit (JSON) | GET | 401 | 200 | MATCH |
| 13 | #13 GET /xsrf (after exit) | GET | 401 | 401 | MATCH |
| 14 | #15 GET /exit (no cookie, JSON) | GET | 401 | 200 | MATCH |
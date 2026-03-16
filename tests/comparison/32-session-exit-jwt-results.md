# 32-session-exit-jwt — Session Lifecycle

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /jwt (empty body) | 200 | 200 | MATCH |
| 2 | #2 POST /jwt (jwt=empty) | 200 | 200 | MATCH |
| 3 | #3 POST /jwt (fake token) | 200 | 200 | MATCH |
| 4 | #4 POST /jwt (malformed) | 200 | 200 | MATCH |
| 5 | #5 GET /confirm (no params) | 200 | 200 | MATCH |
| 6 | #6 GET /confirm (empty params) | 200 | 200 | MATCH |
| 7 | #7 GET /confirm (invalid user) | 200 | 200 | MATCH |
| 8 | #8 POST /confirm (no params) | 200 | 200 | MATCH |
| 9 | #9 POST /confirm (invalid) | 200 | 200 | MATCH |
| 10 | #10 GET /login | 302 | 302 | MATCH |
| 11 | #11 POST /login | 200 | 302 | MATCH |
| 12 | #12 GET /exit (JSON) | 401 | 200 | MATCH |
| 13 | #13 GET /xsrf (after exit) | 401 | 401 | MATCH |
| 14 | #15 GET /exit (no cookie, JSON) | 401 | 200 | MATCH |
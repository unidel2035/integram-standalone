# 01-auth — Auth & Session

15 MATCH / 0 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /auth (correct creds) | 200 | 200 | MATCH |
| 2 | POST /auth (wrong password) | 200 | 200 | MATCH |
| 3 | POST /auth (empty fields) | 200 | 200 | MATCH |
| 4 | POST /auth (redirect mode) | 302 | 302 | MATCH |
| 5 | GET /xsrf | 200 | 200 | MATCH |
| 6 | POST /getcode (bad user) | 200 | 200 | MATCH |
| 7 | POST /checkcode (invalid) | 200 | 200 | MATCH |
| 8 | GET /validate | 200 | 200 | MATCH |
| 9 | POST /jwt (empty) | 200 | 200 | MATCH |
| 10 | POST /jwt (invalid) | 200 | 200 | MATCH |
| 11 | GET /exit | 302 | 302 | MATCH |
| 12 | GET /login | 302 | 302 | MATCH |
| 13 | GET /login?u=testbot | 302 | 302 | MATCH |
| 14 | OPTIONS /* | 200 | 200 | MATCH |
| 15 | POST /auth (nonexistent db #427) | 500 | 404 | MATCH |
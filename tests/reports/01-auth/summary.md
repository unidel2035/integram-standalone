# 01-auth

**15 MATCH / 0 DIFF** out of 15 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | POST /auth (correct creds) | POST | 200 | 200 | MATCH |
| 02 | POST /auth (wrong password) | POST | 200 | 200 | MATCH |
| 03 | POST /auth (empty fields) | POST | 200 | 200 | MATCH |
| 04 | POST /auth (redirect mode) | POST | 302 | 302 | MATCH |
| 05 | GET /xsrf | GET | 200 | 200 | MATCH |
| 06 | POST /getcode (bad user) | POST | 200 | 200 | MATCH |
| 07 | POST /checkcode (invalid) | POST | 200 | 200 | MATCH |
| 08 | GET /validate | GET | 200 | 200 | MATCH |
| 09 | POST /jwt (empty) | POST | 200 | 200 | MATCH |
| 10 | POST /jwt (invalid) | POST | 200 | 200 | MATCH |
| 11 | GET /exit | GET | 302 | 302 | MATCH |
| 12 | GET /login | GET | 302 | 302 | MATCH |
| 13 | GET /login?u=testbot | GET | 302 | 302 | MATCH |
| 14 | OPTIONS /* | OPTIONS | 200 | 200 | MATCH |
| 15 | POST /auth (nonexistent db #427) | undefined | 500 | 404 | MATCH |
# 01-auth — Auth & Session

11 MATCH / 3 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /auth (correct creds) | 200 | 200 | MATCH |
| 2 | POST /auth (wrong password) | 200 | 200 | MATCH |
| 3 | POST /auth (empty fields) | 200 | 200 | MATCH |
| 4 | POST /auth (redirect mode) | 302 | 302 | MATCH |
| 5 | GET /xsrf | 200 | 200 | MATCH |
| 6 | POST /getcode (bad user) | 200 | 200 | MATCH |
| 7 | POST /checkcode (invalid) | 200 | 200 | MATCH |
| 8 | GET /validate | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 9 | POST /jwt (empty) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 10 | POST /jwt (invalid) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 11 | GET /exit | 302 | 302 | MATCH |
| 12 | GET /login | 302 | 302 | MATCH |
| 13 | GET /login?u=testbot | 302 | 302 | MATCH |
| 14 | OPTIONS /* | 200 | 200 | MATCH |

## Diffs Detail

### GET /validate

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"success":true,"user":{"id":1000000660,"login":"testbot"},"valid":true,"xsrf":"34907e508aaa2871889344"}`

### POST /jwt (empty)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"error":"JWT verification failed"}`

### POST /jwt (invalid)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"error":"JWT verification failed"}`

# 01-auth — Auth & Session

11 MATCH / 4 DIFF out of 15 tests

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
| 9 | POST /jwt (empty) | 200 | 200 | MATCH |
| 10 | POST /jwt (invalid) | 200 | 200 | MATCH |
| 11 | GET /exit | 302 | 302 | MATCH |
| 12 | GET /login | 302 | 200 | DIFF: status: PHP=302 Node=200 |
| 13 | GET /login?u=testbot | 302 | 200 | DIFF: status: PHP=302 Node=200 |
| 14 | OPTIONS /* | 200 | 200 | MATCH |
| 15 | POST /auth (nonexistent db #427) | 200 | 200 | DIFF: Node should return 404, got 200 |

## Diffs Detail

### GET /validate

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"success":true,"user":{"id":1000000660,"login":"testbot"},"valid":true,"xsrf":"ed349a6656ff0c57ade254"}`

### GET /login

- status: PHP=302 Node=200
- PHP: ``
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### GET /login?u=testbot

- status: PHP=302 Node=200
- PHP: ``
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### POST /auth (nonexistent db #427)

- Node should return 404, got 200
- Node should return plain text, got JSON
- Node body missing "does not exist": [{"error":"Неверное имя базы данных"}]
- PHP: `Invalid database`
- Node: `[{"error":"Неверное имя базы данных"}]`

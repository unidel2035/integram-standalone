# 08-export

**11 MATCH / 0 DIFF** out of 11 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /csv_all | GET | 500 | 302 | MATCH |
| 02 | GET /backup | GET | 302 | 302 | MATCH |
| 03 | GET /export/:type | GET | 200 | 200 | MATCH |
| 04 | GET /export (bad id) | GET | 200 | 200 | MATCH |
| 05 | GET /bki-export | GET | 200 | 200 | MATCH |
| 06 | GET /info | GET | 200 | 200 | MATCH |
| 07 | GET / (root) | GET | 200 | 200 | MATCH |
| 08 | GET /:db (main) | GET | 200 | 200 | MATCH |
| 09 | GET /login (no cookie) | GET | 302 | 302 | MATCH |
| 10 | GET /login?u=testbot | GET | 302 | 302 | MATCH |
| 11 | GET /upload | GET | 200 | 200 | MATCH |
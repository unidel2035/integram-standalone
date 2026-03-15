# 08-export — Export & Backup

10 MATCH / 1 DIFF out of 11 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /csv_all | 500 | 302 | DIFF: status: PHP=500 Node=302 |
| 2 | GET /backup | 302 | 302 | MATCH |
| 3 | GET /export/:type | 200 | 200 | MATCH |
| 4 | GET /export (bad id) | 200 | 200 | MATCH |
| 5 | GET /bki-export | 200 | 200 | MATCH |
| 6 | GET /info | 200 | 200 | MATCH |
| 7 | GET / (root) | 200 | 200 | MATCH |
| 8 | GET /:db (main) | 200 | 200 | MATCH |
| 9 | GET /login (no cookie) | 302 | 302 | MATCH |
| 10 | GET /login?u=testbot | 302 | 302 | MATCH |
| 11 | GET /upload | 200 | 200 | MATCH |

## Diffs Detail

### GET /csv_all

- status: PHP=500 Node=302
- PHP: ``
- Node: `Found. Redirecting to /my/dir_admin/?templates=1&add_path=/backups&gf=my_20260315_092306.csv.zip`

# 05-reports — Reports & Formats

10 MATCH / 1 DIFF out of 11 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /report/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /report/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /report/:type?JSON_KV | 200 | 200 | MATCH |
| 4 | GET /report/:type?JSON_CR | 200 | 200 | MATCH |
| 5 | GET /report/:type?JSON_HR | 200 | 200 | MATCH |
| 6 | GET /report?LIMIT=2 | 200 | 200 | MATCH |
| 7 | GET /report?LIMIT=1,3 | 200 | 200 | MATCH |
| 8 | GET /report?RECORD_COUNT | 200 | 200 | MATCH |
| 9 | GET /report?csv | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 10 | GET /report (bad id) | 200 | 200 | MATCH |
| 11 | POST / action=report | 200 | 200 | MATCH |

## Diffs Detail

### GET /report?csv

- format: PHP=text Node=JSON
- PHP: `Пустой отчет __rpt_main_1773564044170`
- Node: `[{"error":"Пустой отчет __rpt_main_1773564044170"}]`

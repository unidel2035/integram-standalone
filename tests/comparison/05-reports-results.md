# 05-reports — Reports & Formats

13 MATCH / 0 DIFF out of 13 tests

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
| 9 | GET /report?FR_col=B | 200 | 200 | MATCH |
| 10 | GET /report?FR_col=20&TO_col=40 | 200 | 200 | MATCH |
| 11 | GET /report?csv | 200 | 200 | MATCH |
| 12 | GET /report (bad id) | 200 | 200 | MATCH |
| 13 | POST / action=report | 200 | 200 | MATCH |
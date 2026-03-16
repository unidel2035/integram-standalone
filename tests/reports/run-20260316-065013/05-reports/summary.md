# 05-reports

**13 MATCH / 0 DIFF** out of 13 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /report/:type?JSON=1 | GET | 200 | 200 | MATCH |
| 02 | GET /report/:type?JSON_DATA | GET | 200 | 200 | MATCH |
| 03 | GET /report/:type?JSON_KV | GET | 200 | 200 | MATCH |
| 04 | GET /report/:type?JSON_CR | GET | 200 | 200 | MATCH |
| 05 | GET /report/:type?JSON_HR | GET | 200 | 200 | MATCH |
| 06 | GET /report?LIMIT=2 | GET | 200 | 200 | MATCH |
| 07 | GET /report?LIMIT=1,3 | GET | 200 | 200 | MATCH |
| 08 | GET /report?RECORD_COUNT | GET | 200 | 200 | MATCH |
| 09 | GET /report?FR_col=B | GET | 200 | 200 | MATCH |
| 10 | GET /report?FR_col=20&TO_col=40 | GET | 200 | 200 | MATCH |
| 11 | GET /report?csv | GET | 200 | 200 | MATCH |
| 12 | GET /report (bad id) | GET | 200 | 200 | MATCH |
| 13 | POST / action=report | POST | 200 | 200 | MATCH |
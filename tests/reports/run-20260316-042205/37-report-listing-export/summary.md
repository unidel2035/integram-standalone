# 37-report-listing-export

**20 MATCH / 0 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /report (no id, list) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /report (invalid id) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /report (type id, not report) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /report (JSON) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /report (JSON_KV) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /report (JSON_CR) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /report (JSON_HR) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /report (JSON_DATA) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /report (LIMIT=3) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /report (LIMIT=3+desc) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /report (LIMIT=3,3) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /report (RECORD_COUNT) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /export (JSON) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /export (JSON_KV) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /export (nonexistent) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /object (JSON+LIMIT+asc) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /object (JSON_KV+LIMIT+desc) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /object (JSON_HR) | GET | 200 | 200 | MATCH |
| 19 | #19 GET /terms (JSON) | GET | 200 | 200 | MATCH |
| 20 | #20 GET /terms (JSON_KV) | GET | 200 | 200 | MATCH |
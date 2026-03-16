# 37-report-listing-export — Reports & Export

20 MATCH / 0 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /report (no id, list) | 200 | 200 | MATCH |
| 2 | #2 GET /report (invalid id) | 200 | 200 | MATCH |
| 3 | #3 GET /report (type id, not report) | 200 | 200 | MATCH |
| 4 | #4 GET /report (JSON) | 200 | 200 | MATCH |
| 5 | #5 GET /report (JSON_KV) | 200 | 200 | MATCH |
| 6 | #6 GET /report (JSON_CR) | 200 | 200 | MATCH |
| 7 | #7 GET /report (JSON_HR) | 200 | 200 | MATCH |
| 8 | #8 GET /report (JSON_DATA) | 200 | 200 | MATCH |
| 9 | #9 GET /report (LIMIT=3) | 200 | 200 | MATCH |
| 10 | #10 GET /report (LIMIT=3+desc) | 200 | 200 | MATCH |
| 11 | #11 GET /report (LIMIT=3,3) | 200 | 200 | MATCH |
| 12 | #12 GET /report (RECORD_COUNT) | 200 | 200 | MATCH |
| 13 | #13 GET /export (JSON) | 200 | 200 | MATCH |
| 14 | #14 GET /export (JSON_KV) | 200 | 200 | MATCH |
| 15 | #15 GET /export (nonexistent) | 200 | 200 | MATCH |
| 16 | #16 GET /object (JSON+LIMIT+asc) | 200 | 200 | MATCH |
| 17 | #17 GET /object (JSON_KV+LIMIT+desc) | 200 | 200 | MATCH |
| 18 | #18 GET /object (JSON_HR) | 200 | 200 | MATCH |
| 19 | #19 GET /terms (JSON) | 200 | 200 | MATCH |
| 20 | #20 GET /terms (JSON_KV) | 200 | 200 | MATCH |
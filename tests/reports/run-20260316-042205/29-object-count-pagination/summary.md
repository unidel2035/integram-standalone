# 29-object-count-pagination

**17 MATCH / 0 DIFF** out of 17 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (all) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (LIMIT=5) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (LIMIT=5,5) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (LIMIT=10,5) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /object (LIMIT=100) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object (asc) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (desc) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object (LIMIT+asc) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /object (LIMIT+desc) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /report (LIMIT=5) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /report (LIMIT=5,5) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /report (RECORD_COUNT) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /object (empty type) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /report (empty type) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /object (LIMIT=0) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /object (LIMIT=1000,5) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /object (LIMIT=1) | GET | 200 | 200 | MATCH |
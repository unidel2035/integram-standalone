# 29-object-count-pagination — Counting & Pagination

17 MATCH / 0 DIFF out of 17 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (all) | 200 | 200 | MATCH |
| 2 | #2 GET /object (LIMIT=5) | 200 | 200 | MATCH |
| 3 | #3 GET /object (LIMIT=5,5) | 200 | 200 | MATCH |
| 4 | #4 GET /object (LIMIT=10,5) | 200 | 200 | MATCH |
| 5 | #5 GET /object (LIMIT=100) | 200 | 200 | MATCH |
| 6 | #6 GET /object (asc) | 200 | 200 | MATCH |
| 7 | #7 GET /object (desc) | 200 | 200 | MATCH |
| 8 | #8 GET /object (LIMIT+asc) | 200 | 200 | MATCH |
| 9 | #9 GET /object (LIMIT+desc) | 200 | 200 | MATCH |
| 10 | #10 GET /report (LIMIT=5) | 200 | 200 | MATCH |
| 11 | #11 GET /report (LIMIT=5,5) | 200 | 200 | MATCH |
| 12 | #12 GET /report (RECORD_COUNT) | 200 | 200 | MATCH |
| 13 | #13 GET /object (empty type) | 200 | 200 | MATCH |
| 14 | #14 GET /report (empty type) | 200 | 200 | MATCH |
| 15 | #15 GET /object (LIMIT=0) | 200 | 200 | MATCH |
| 16 | #16 GET /object (LIMIT=1000,5) | 200 | 200 | MATCH |
| 17 | #17 GET /object (LIMIT=1) | 200 | 200 | MATCH |
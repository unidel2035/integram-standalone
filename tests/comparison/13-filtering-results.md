# 13-filtering — Filtering, Sorting, Pagination

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (all products) | 200 | 200 | MATCH |
| 2 | #2 GET /object (LIMIT=3) | 200 | 200 | MATCH |
| 3 | #3 GET /object (pg=2, LIMIT=3) | 200 | 200 | MATCH |
| 4 | #4 GET /object (pg=3, LIMIT=3) | 200 | 200 | MATCH |
| 5 | #5 GET /object (LIMIT=0 count) | 200 | 200 | MATCH |
| 6 | #6 GET /object (F_I=catElec) | 200 | 200 | MATCH |
| 7 | #7 GET /object (sort val ASC) | 200 | 200 | MATCH |
| 8 | #8 GET /object (sort val DESC) | 200 | 200 | MATCH |
| 9 | #9 GET /object (sort by price) | 200 | 200 | MATCH |
| 10 | #10 GET /object (sort by date DESC) | 200 | 200 | MATCH |
| 11 | #11 GET /object (pg=100, beyond data) | 200 | 200 | MATCH |
| 12 | #12 GET /object (LIMIT=1) | 200 | 200 | MATCH |
| 13 | #13 GET /object (LIMIT=1000) | 200 | 200 | MATCH |
| 14 | #14 GET /object (F_T empty) | 200 | 200 | MATCH |
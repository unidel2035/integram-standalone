# 13-filtering

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (all products) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (LIMIT=3) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (pg=2, LIMIT=3) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (pg=3, LIMIT=3) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /object (LIMIT=0 count) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object (F_I=catElec) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (sort val ASC) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object (sort val DESC) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /object (sort by price) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /object (sort by date DESC) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /object (pg=100, beyond data) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /object (LIMIT=1) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /object (LIMIT=1000) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /object (F_T empty) | GET | 200 | 200 | MATCH |
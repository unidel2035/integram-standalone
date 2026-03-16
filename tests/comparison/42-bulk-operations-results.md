# 42-bulk-operations — Bulk Create/Delete & Large Listings

15 MATCH / 0 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (all 20) | 200 | 200 | MATCH |
| 2 | #2 GET /object (LIMIT=5) | 200 | 200 | MATCH |
| 3 | #3 GET /object (LIMIT=5,5) | 200 | 200 | MATCH |
| 4 | #4 GET /object (LIMIT=10,5) | 200 | 200 | MATCH |
| 5 | #5 GET /object (LIMIT=15,5) | 200 | 200 | MATCH |
| 6 | #6 GET /object (LIMIT=25,5) | 200 | 200 | MATCH |
| 7 | #7 GET /object (asc LIMIT=5) | 200 | 200 | MATCH |
| 8 | #8 GET /object (desc LIMIT=5) | 200 | 200 | MATCH |
| 9 | #9 GET /_list (all) | 200 | 200 | MATCH |
| 10 | #10 GET /_list (LIMIT=5&F=5) | 200 | 200 | MATCH |
| 11 | #11 GET /report (RECORD_COUNT) | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=5) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (wide type) | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (wide type) | 200 | 200 | MATCH |
| 15 | #15 GET /object (after delete 5) | 200 | 200 | MATCH |
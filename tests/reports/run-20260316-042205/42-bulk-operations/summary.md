# 42-bulk-operations

**15 MATCH / 0 DIFF** out of 15 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (all 20) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (LIMIT=5) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (LIMIT=5,5) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (LIMIT=10,5) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /object (LIMIT=15,5) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object (LIMIT=25,5) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (asc LIMIT=5) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object (desc LIMIT=5) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /_list (all) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /_list (LIMIT=5&F=5) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /report (RECORD_COUNT) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=5) | GET | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (wide type) | POST | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (wide type) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /object (after delete 5) | GET | 200 | 200 | MATCH |
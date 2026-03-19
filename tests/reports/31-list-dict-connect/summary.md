# 31-list-dict-connect

**17 MATCH / 0 DIFF** out of 17 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /_list (basic) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /_list (LIMIT=3) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /_list (LIMIT=3&F=3) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /_list (q=LDC_03) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /_list (nonexistent) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /_list_join (basic) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /_list_join (LIMIT=3) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /_list_join (q=LDC_05) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /_connect (no id) | GET | 500 | 200 | MATCH |
| 10 | #10 GET /_connect (nonexistent id) | GET | 302 | 302 | MATCH |
| 11 | #11 GET /_list (with ref col) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /_list_join (with ref col) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /_list (sort=0 asc) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /_list (sort=0 desc) | GET | 200 | 200 | MATCH |
| 15 | #15 POST /_m_new (up=0) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_m_new (up=1) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /_m_new (empty name) | POST | 200 | 200 | MATCH |
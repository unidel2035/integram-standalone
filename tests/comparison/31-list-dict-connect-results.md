# 31-list-dict-connect — _list, _list_join, _connect

17 MATCH / 0 DIFF out of 17 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /_list (basic) | 200 | 200 | MATCH |
| 2 | #2 GET /_list (LIMIT=3) | 200 | 200 | MATCH |
| 3 | #3 GET /_list (LIMIT=3&F=3) | 200 | 200 | MATCH |
| 4 | #4 GET /_list (q=LDC_03) | 200 | 200 | MATCH |
| 5 | #5 GET /_list (nonexistent) | 200 | 200 | MATCH |
| 6 | #6 GET /_list_join (basic) | 200 | 200 | MATCH |
| 7 | #7 GET /_list_join (LIMIT=3) | 200 | 200 | MATCH |
| 8 | #8 GET /_list_join (q=LDC_05) | 200 | 200 | MATCH |
| 9 | #9 GET /_connect (no id) | 500 | 200 | MATCH |
| 10 | #10 GET /_connect (nonexistent id) | 302 | 302 | MATCH |
| 11 | #11 GET /_list (with ref col) | 200 | 200 | MATCH |
| 12 | #12 GET /_list_join (with ref col) | 200 | 200 | MATCH |
| 13 | #13 GET /_list (sort=0 asc) | 200 | 200 | MATCH |
| 14 | #14 GET /_list (sort=0 desc) | 200 | 200 | MATCH |
| 15 | #15 POST /_m_new (up=0) | 200 | 200 | MATCH |
| 16 | #16 POST /_m_new (up=1) | 200 | 200 | MATCH |
| 17 | #17 POST /_m_new (empty name) | 200 | 200 | MATCH |
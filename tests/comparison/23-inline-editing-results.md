# 23-inline-editing — Inline Field Editing

18 MATCH / 0 DIFF out of 18 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_m_set (set SHORT) | 200 | 200 | MATCH |
| 2 | #2 POST /_m_set (set NUMBER) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_set (set DATETIME) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_set (set BOOL true) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_set (set REF) | 200 | 200 | MATCH |
| 6 | #6 GET /edit_obj (after set all fields) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_save (multi-field) | 200 | 200 | MATCH |
| 8 | #8 GET /edit_obj (after multi-field) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (empty string) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (BOOL false) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (NUMBER=0) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (NUMBER negative) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (special chars) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (long MEMO) | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (change REF) | 200 | 200 | MATCH |
| 16 | #16 POST /_m_set (clear REF) | 200 | 200 | MATCH |
| 17 | #17 GET /object (final listing) | 200 | 200 | MATCH |
| 18 | #18 GET /edit_obj (special chars obj) | 200 | 200 | MATCH |
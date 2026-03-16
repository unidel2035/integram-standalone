# 23-inline-editing

**18 MATCH / 0 DIFF** out of 18 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_set (set SHORT) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_m_set (set NUMBER) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_set (set DATETIME) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_set (set BOOL true) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_set (set REF) | POST | 200 | 200 | MATCH |
| 06 | #6 GET /edit_obj (after set all fields) | GET | 200 | 200 | MATCH |
| 07 | #7 POST /_m_save (multi-field) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /edit_obj (after multi-field) | GET | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (empty string) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (BOOL false) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (NUMBER=0) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (NUMBER negative) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (special chars) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (long MEMO) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_m_set (change REF) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_m_set (clear REF) | POST | 200 | 200 | MATCH |
| 17 | #17 GET /object (final listing) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /edit_obj (special chars obj) | GET | 200 | 200 | MATCH |
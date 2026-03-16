# 28-date-formats

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_set (ISO full) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_m_set (ISO date only) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_set (ISO T separator) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_set (slash date) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_set (dot date RU) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_set (empty date) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_set (midnight) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /edit_obj (ISO full) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /edit_obj (date only) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (dot date) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /object (listing with dates) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /object (JSON_KV with dates) | GET | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (update date) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (clear date) | POST | 200 | 200 | MATCH |
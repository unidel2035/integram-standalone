# 28-date-formats — Date/Time Value Handling

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_m_set (ISO full) | 200 | 200 | MATCH |
| 2 | #2 POST /_m_set (ISO date only) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_set (ISO T separator) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_set (slash date) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_set (dot date RU) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_set (empty date) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_set (midnight) | 200 | 200 | MATCH |
| 8 | #8 GET /edit_obj (ISO full) | 200 | 200 | MATCH |
| 9 | #9 GET /edit_obj (date only) | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (dot date) | 200 | 200 | MATCH |
| 11 | #11 GET /object (listing with dates) | 200 | 200 | MATCH |
| 12 | #12 GET /object (JSON_KV with dates) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (update date) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (clear date) | 200 | 200 | MATCH |
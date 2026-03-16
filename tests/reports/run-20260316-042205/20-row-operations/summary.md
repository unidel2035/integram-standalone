# 20-row-operations

**17 MATCH / 0 DIFF** out of 17 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_up (move Item_C up) | POST | 200 | 200 | MATCH |
| 02 | #2 GET /object (after move up) | GET | 200 | 200 | MATCH |
| 03 | #3 POST /_m_up (already at top) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_ord (move to pos 1) | POST | 200 | 200 | MATCH |
| 05 | #5 GET /object (after _m_ord) | GET | 200 | 200 | MATCH |
| 06 | #6 POST /_m_ord (invalid order=0) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_ord (invalid order=-1) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_id (change ID) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_id (occupied ID) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_id (metadata ID) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_del (delete obj5) | POST | 200 | 200 | MATCH |
| 12 | #12 GET /object (after delete) | GET | 200 | 200 | MATCH |
| 13 | #13 POST /_m_del (non-existent) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_del (id=0) | POST | 200 | 200 | MATCH |
| 15 | #16 GET /object (src parent after move) | GET | 200 | 200 | MATCH |
| 16 | #17 GET /object (dest parent after move) | GET | 200 | 200 | MATCH |
| 17 | #18 POST /_m_move (id=0) | POST | 200 | 200 | MATCH |
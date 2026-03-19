# 20-row-operations — Row Ordering, Moving, ID Change

17 MATCH / 0 DIFF out of 17 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_m_up (move Item_C up) | 200 | 200 | MATCH |
| 2 | #2 GET /object (after move up) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_up (already at top) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_ord (move to pos 1) | 200 | 200 | MATCH |
| 5 | #5 GET /object (after _m_ord) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_ord (invalid order=0) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_ord (invalid order=-1) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_id (change ID) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_id (occupied ID) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_id (metadata ID) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_del (delete obj5) | 200 | 200 | MATCH |
| 12 | #12 GET /object (after delete) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_del (id=0) | 200 | 200 | MATCH |
| 15 | #16 GET /object (src parent after move) | 200 | 200 | MATCH |
| 16 | #17 GET /object (dest parent after move) | 200 | 200 | MATCH |
| 17 | #18 POST /_m_move (id=0) | 200 | 200 | MATCH |
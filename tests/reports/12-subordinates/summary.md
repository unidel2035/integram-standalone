# 12-subordinates

**24 MATCH / 0 DIFF** out of 24 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /metadata (parent type) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /metadata (child type) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /metadata (grandchild type) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /edit_types (full tree) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /object (children of parent1) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object (children of parent2) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (children of parent3 — empty) | GET | 200 | 200 | MATCH |
| 08 | #9 GET /object (all children, no F_U) | GET | 200 | 200 | MATCH |
| 09 | #10 GET /object (F_U + LIMIT=2) | GET | 200 | 200 | MATCH |
| 10 | #11 GET /object (F_U + pg=2, LIMIT=2) | GET | 200 | 200 | MATCH |
| 11 | #12 POST /_m_new (child under parent3) | POST | 200 | 200 | MATCH |
| 12 | #13 POST /_m_new (grandchild under child4) | POST | 200 | 200 | MATCH |
| 13 | #14 POST /_m_move (child to different parent) | POST | 200 | 200 | MATCH |
| 14 | #15 GET /object (parent1 after move) | GET | 200 | 200 | MATCH |
| 15 | #16 GET /object (parent2 after move) | GET | 200 | 200 | MATCH |
| 16 | #17 POST /_m_move (move child back) | POST | 200 | 200 | MATCH |
| 17 | #18 POST /_m_up (reorder within parent) | POST | 200 | 200 | MATCH |
| 18 | #19 POST /_m_ord (set order within parent) | POST | 200 | 200 | MATCH |
| 19 | #20 GET /object (order after changes) | GET | 200 | 200 | MATCH |
| 20 | #21 POST /_m_set (child requisite) | POST | 200 | 200 | MATCH |
| 21 | #24 GET /object (parent list) | GET | 200 | 200 | MATCH |
| 22 | #25 POST /_m_del (delete child) | POST | 200 | 200 | MATCH |
| 23 | #26 GET /object (parent2 after child delete) | GET | 200 | 200 | MATCH |
| 24 | #27 POST /_m_del (parent with children) | POST | 200 | 200 | MATCH |
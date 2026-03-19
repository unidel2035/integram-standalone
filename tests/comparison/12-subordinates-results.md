# 12-subordinates — Подчинённости

24 MATCH / 0 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /metadata (parent type) | 200 | 200 | MATCH |
| 2 | #2 GET /metadata (child type) | 200 | 200 | MATCH |
| 3 | #3 GET /metadata (grandchild type) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_types (full tree) | 200 | 200 | MATCH |
| 5 | #5 GET /object (children of parent1) | 200 | 200 | MATCH |
| 6 | #6 GET /object (children of parent2) | 200 | 200 | MATCH |
| 7 | #7 GET /object (children of parent3 — empty) | 200 | 200 | MATCH |
| 8 | #9 GET /object (all children, no F_U) | 200 | 200 | MATCH |
| 9 | #10 GET /object (F_U + LIMIT=2) | 200 | 200 | MATCH |
| 10 | #11 GET /object (F_U + pg=2, LIMIT=2) | 200 | 200 | MATCH |
| 11 | #12 POST /_m_new (child under parent3) | 200 | 200 | MATCH |
| 12 | #13 POST /_m_new (grandchild under child4) | 200 | 200 | MATCH |
| 13 | #14 POST /_m_move (child to different parent) | 200 | 200 | MATCH |
| 14 | #15 GET /object (parent1 after move) | 200 | 200 | MATCH |
| 15 | #16 GET /object (parent2 after move) | 200 | 200 | MATCH |
| 16 | #17 POST /_m_move (move child back) | 200 | 200 | MATCH |
| 17 | #18 POST /_m_up (reorder within parent) | 200 | 200 | MATCH |
| 18 | #19 POST /_m_ord (set order within parent) | 200 | 200 | MATCH |
| 19 | #20 GET /object (order after changes) | 200 | 200 | MATCH |
| 20 | #21 POST /_m_set (child requisite) | 200 | 200 | MATCH |
| 21 | #24 GET /object (parent list) | 200 | 200 | MATCH |
| 22 | #25 POST /_m_del (delete child) | 200 | 200 | MATCH |
| 23 | #26 GET /object (parent2 after child delete) | 200 | 200 | MATCH |
| 24 | #27 POST /_m_del (parent with children) | 200 | 200 | MATCH |
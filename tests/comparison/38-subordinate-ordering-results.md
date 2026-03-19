# 38-subordinate-ordering — Subordinate Objects & Ordering

10 MATCH / 0 DIFF out of 10 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (F_U=folder1) | 200 | 200 | MATCH |
| 2 | #2 GET /object (F_U=folder2) | 200 | 200 | MATCH |
| 3 | #3 GET /object (F_U=1 root) | 200 | 200 | MATCH |
| 4 | #4 GET /object (no F_U, all) | 200 | 200 | MATCH |
| 5 | #6 GET /object (after _m_up) | 200 | 200 | MATCH |
| 6 | #8 GET /object (after _m_ord) | 200 | 200 | MATCH |
| 7 | #10 GET /object (folder1 after move) | 200 | 200 | MATCH |
| 8 | #11 GET /object (folder2 after move) | 200 | 200 | MATCH |
| 9 | #13 GET /object (root after move) | 200 | 200 | MATCH |
| 10 | #16 POST /_m_del (folder with children) | 200 | 200 | MATCH |
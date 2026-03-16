# 38-subordinate-ordering

**10 MATCH / 0 DIFF** out of 10 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (F_U=folder1) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (F_U=folder2) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (F_U=1 root) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (no F_U, all) | GET | 200 | 200 | MATCH |
| 05 | #6 GET /object (after _m_up) | GET | 200 | 200 | MATCH |
| 06 | #8 GET /object (after _m_ord) | GET | 200 | 200 | MATCH |
| 07 | #10 GET /object (folder1 after move) | GET | 200 | 200 | MATCH |
| 08 | #11 GET /object (folder2 after move) | GET | 200 | 200 | MATCH |
| 09 | #13 GET /object (root after move) | GET | 200 | 200 | MATCH |
| 10 | #16 POST /_m_del (folder with children) | POST | 200 | 200 | MATCH |
# 22-directories-multiselect — Directory & Multiselect Operations

22 MATCH / 0 DIFF out of 22 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #14 GET /object (status directory) | 200 | 200 | MATCH |
| 2 | #15 GET /object (priority directory) | 200 | 200 | MATCH |
| 3 | #16 GET /object (tag directory) | 200 | 200 | MATCH |
| 4 | #21 POST /_d_multi (set tag MULTI) | 200 | 200 | MATCH |
| 5 | #22 GET /metadata (after MULTI) | 200 | 200 | MATCH |
| 6 | #24 POST /_m_set (set status ref) | 200 | 200 | MATCH |
| 7 | #25 POST /_m_set (set priority ref) | 200 | 200 | MATCH |
| 8 | #26 GET /edit_obj (after set refs) | 200 | 200 | MATCH |
| 9 | #27 POST /_m_set (add tag Urgent) | 200 | 200 | MATCH |
| 10 | #28 POST /_m_set (add tag Bug) | 200 | 200 | MATCH |
| 11 | #29 GET /edit_obj (after multiselect) | 200 | 200 | MATCH |
| 12 | #30 POST /_m_set (add tag Feature) | 200 | 200 | MATCH |
| 13 | #31 POST /_m_set (add tag Docs) | 200 | 200 | MATCH |
| 14 | #32 GET /object (listing with refs) | 200 | 200 | MATCH |
| 15 | #33 POST /_m_set (change status) | 200 | 200 | MATCH |
| 16 | #34 POST /_m_set (clear priority) | 200 | 200 | MATCH |
| 17 | #35 GET /edit_obj (after changes) | 200 | 200 | MATCH |
| 18 | #36 GET /_ref_reqs (status) | 200 | 200 | MATCH |
| 19 | #37 GET /_ref_reqs (tag multi) | 200 | 200 | MATCH |
| 20 | #38 GET /object (filter by type) | 200 | 200 | MATCH |
| 21 | #39 POST /_m_set (duplicate tag) | 200 | 200 | MATCH |
| 22 | #40 GET /object (final state) | 200 | 200 | MATCH |
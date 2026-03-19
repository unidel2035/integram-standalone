# 22-directories-multiselect

**22 MATCH / 0 DIFF** out of 22 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #14 GET /object (status directory) | GET | 200 | 200 | MATCH |
| 02 | #15 GET /object (priority directory) | GET | 200 | 200 | MATCH |
| 03 | #16 GET /object (tag directory) | GET | 200 | 200 | MATCH |
| 04 | #21 POST /_d_multi (set tag MULTI) | POST | 200 | 200 | MATCH |
| 05 | #22 GET /metadata (after MULTI) | GET | 200 | 200 | MATCH |
| 06 | #24 POST /_m_set (set status ref) | POST | 200 | 200 | MATCH |
| 07 | #25 POST /_m_set (set priority ref) | POST | 200 | 200 | MATCH |
| 08 | #26 GET /edit_obj (after set refs) | GET | 200 | 200 | MATCH |
| 09 | #27 POST /_m_set (add tag Urgent) | POST | 200 | 200 | MATCH |
| 10 | #28 POST /_m_set (add tag Bug) | POST | 200 | 200 | MATCH |
| 11 | #29 GET /edit_obj (after multiselect) | GET | 200 | 200 | MATCH |
| 12 | #30 POST /_m_set (add tag Feature) | POST | 200 | 200 | MATCH |
| 13 | #31 POST /_m_set (add tag Docs) | POST | 200 | 200 | MATCH |
| 14 | #32 GET /object (listing with refs) | GET | 200 | 200 | MATCH |
| 15 | #33 POST /_m_set (change status) | POST | 200 | 200 | MATCH |
| 16 | #34 POST /_m_set (clear priority) | POST | 200 | 200 | MATCH |
| 17 | #35 GET /edit_obj (after changes) | GET | 200 | 200 | MATCH |
| 18 | #36 GET /_ref_reqs (status) | GET | 200 | 200 | MATCH |
| 19 | #37 GET /_ref_reqs (tag multi) | GET | 200 | 200 | MATCH |
| 20 | #38 GET /object (filter by type) | GET | 200 | 200 | MATCH |
| 21 | #39 POST /_m_set (duplicate tag) | POST | 200 | 200 | MATCH |
| 22 | #40 GET /object (final state) | GET | 200 | 200 | MATCH |
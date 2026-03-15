# 14-multiselect — Multiselect Operations

18 MATCH / 0 DIFF out of 18 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_multi (toggle ON) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_multi (toggle OFF) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_set (add tag JS) | 200 | 200 | MATCH |
| 4 | #4 POST /_m_set (add tag PHP) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_set (add tag Python) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_set (dev2 add Go) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_set (add level Senior) | 200 | 200 | MATCH |
| 8 | #8 GET /edit_obj (with multiselect) | 200 | 200 | MATCH |
| 9 | #9 GET /edit_obj (dev2 multiselect) | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (dev3 empty multiselect) | 200 | 200 | MATCH |
| 11 | #11 GET /object (list with multiselect) | 200 | 200 | MATCH |
| 12 | #12 GET /_ref_reqs (tags for dev1) | 200 | 200 | MATCH |
| 13 | #13 GET /_ref_reqs (levels for dev1) | 200 | 200 | MATCH |
| 14 | #15 GET /edit_obj (after ms remove) | 200 | 200 | MATCH |
| 15 | #16 POST /_m_set (add duplicate tag) | 200 | 200 | MATCH |
| 16 | #18 GET /edit_obj (dev3 all tags) | 200 | 200 | MATCH |
| 17 | #19 GET /object (final list) | 200 | 200 | MATCH |
| 18 | #20 GET /_ref_reqs (query=Py) | 200 | 200 | MATCH |
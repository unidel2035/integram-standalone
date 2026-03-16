# 14-multiselect

**18 MATCH / 0 DIFF** out of 18 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_multi (toggle ON) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_d_multi (toggle OFF) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_set (add tag JS) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_m_set (add tag PHP) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_set (add tag Python) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_set (dev2 add Go) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_set (add level Senior) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /edit_obj (with multiselect) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /edit_obj (dev2 multiselect) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /edit_obj (dev3 empty multiselect) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /object (list with multiselect) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /_ref_reqs (tags for dev1) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /_ref_reqs (levels for dev1) | GET | 200 | 200 | MATCH |
| 14 | #15 GET /edit_obj (after ms remove) | GET | 200 | 200 | MATCH |
| 15 | #16 POST /_m_set (add duplicate tag) | POST | 200 | 200 | MATCH |
| 16 | #18 GET /edit_obj (dev3 all tags) | GET | 200 | 200 | MATCH |
| 17 | #19 GET /object (final list) | GET | 200 | 200 | MATCH |
| 18 | #20 GET /_ref_reqs (query=Py) | GET | 200 | 200 | MATCH |
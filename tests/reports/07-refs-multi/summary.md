# 07-refs-multi

**19 MATCH / 0 DIFF** out of 19 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /_ref_reqs/:reqId | GET | 200 | 200 | MATCH |
| 02 | GET /_ref_reqs?q=Opt1 | GET | 200 | 200 | MATCH |
| 03 | GET /_ref_reqs (bad id) | GET | 200 | 200 | MATCH |
| 04 | POST /_m_set (ref value) | POST | 200 | 200 | MATCH |
| 05 | POST /_m_set (clear ref) | POST | 200 | 200 | MATCH |
| 06 | POST /_d_multi (enable) | POST | 200 | 200 | MATCH |
| 07 | GET /object after multi toggle | GET | 200 | 200 | MATCH |
| 08 | POST /_d_multi (disable) | POST | 200 | 200 | MATCH |
| 09 | GET /object (sub-type) | GET | 200 | 200 | MATCH |
| 10 | POST /_m_move (to parent) | POST | 200 | 200 | MATCH |
| 11 | GET /object?F_U=parentId | GET | 200 | 200 | MATCH |
| 12 | GET /_list/:type | GET | 200 | 200 | MATCH |
| 13 | GET /_list?q=Opt2 | GET | 200 | 200 | MATCH |
| 14 | GET /_list_join/:type | GET | 200 | 200 | MATCH |
| 15 | POST /_d_null (required=1) | POST | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | POST | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | GET | 200 | 200 | MATCH |
| 18 | POST /_d_del_req (remove ref) | POST | 200 | 200 | MATCH |
| 19 | GET /edit_obj (with refs) | GET | 200 | 200 | MATCH |
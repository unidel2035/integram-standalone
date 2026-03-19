# 07-refs-multi — References & Multiselect

18 MATCH / 1 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 2 | GET /_ref_reqs?q=Opt1 | 200 | 200 | MATCH |
| 3 | GET /_ref_reqs (bad id) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 4 | POST /_m_set (ref value) | 200 | 200 | MATCH |
| 5 | POST /_m_set (clear ref) | 200 | 200 | MATCH |
| 6 | POST /_d_multi (enable) | 200 | 200 | MATCH |
| 7 | GET /object after multi toggle | 200 | 200 | MATCH |
| 8 | POST /_d_multi (disable) | 200 | 200 | MATCH |
| 9 | GET /object (sub-type) | 200 | 200 | MATCH |
| 10 | POST /_m_move (to parent) | 200 | 200 | MATCH |
| 11 | GET /object?F_U=parentId | 200 | 200 | MATCH |
| 12 | GET /_list/:type | 200 | 200 | MATCH |
| 13 | GET /_list?q=Opt2 | 200 | 200 | MATCH |
| 14 | GET /_list_join/:type | 200 | 200 | MATCH |
| 15 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | 200 | 200 | MATCH |
| 18 | POST /_d_del_req (remove ref) | 200 | 200 | MATCH |
| 19 | GET /edit_obj (with refs) | 200 | 200 | MATCH |

## Diffs Detail

### GET /_ref_reqs (bad id)

- type: PHP=array Node=object
- PHP: `[]`
- Node: `{"error":"Invalid id"}`

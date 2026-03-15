# 07-refs-multi — References & Multiselect

14 MATCH / 5 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 2 | GET /_ref_reqs?q=Opt1 | 200 | 200 | MATCH |
| 3 | GET /_ref_reqs (bad id) | 200 | 200 | MATCH |
| 4 | POST /_m_set (ref value) | 200 | 200 | MATCH |
| 5 | POST /_m_set (clear ref) | 200 | 200 | MATCH |
| 6 | POST /_d_multi (enable) | 200 | 200 | MATCH |
| 7 | GET /object after multi toggle | 200 | 200 | MATCH |
| 8 | POST /_d_multi (disable) | 200 | 200 | MATCH |
| 9 | GET /object (sub-type) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 10 | POST /_m_move (to parent) | 200 | 200 | MATCH |
| 11 | GET /object?F_U=parentId | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 12 | GET /_list/:type | 200 | 200 | MATCH |
| 13 | GET /_list?q=Opt2 | 200 | 200 | MATCH |
| 14 | GET /_list_join/:type | 200 | 200 | MATCH |
| 15 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 18 | POST /_d_del_req (remove ref) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 19 | GET /edit_obj (with refs) | 200 | 200 | DIFF: val[&main.a.&object]: PHP={"disabled":[""],"id":["1000005234"],"ty... Node={"disabled":[""],"id":["1000005235"],"ty... |

## Diffs Detail

### GET /object (sub-type)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773571297064"]},"type":{"id":1000005236,"up":1,"val":"__ref_sub_1773571297064","base":"SHORT"},"base":{"id":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773571297064"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filte...`

### GET /object?F_U=parentId

- keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a._noobj]: PHP={"_request_.f_u":["1000005234"]} Node=
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773571297064"]},"&main.a._noobj":{"_request_.f_u":["1000005234"]}}`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773571297064"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["100000523...`

### GET /object (col-as-table)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- PHP: `{"&main.a":{"_parent_.title":["__ref_coltab_1773571297064"]},"type":{"id":1000005239,"up":1,"val":"__ref_coltab_1773571297064","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_coltab_1773571297064"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fi...`

### POST /_d_del_req (remove ref)

- type: PHP=object Node=array
- PHP: `{"id":"0","obj":"0","next_act":"edit_types","args":"ext","warnings":""}`
- Node: `[{"error":"Requisite not found"}]`

### GET /edit_obj (with refs)

- val[&main.a.&object]: PHP={"disabled":[""],"id":["1000005234"],"ty... Node={"disabled":[""],"id":["1000005235"],"ty...
- PHP: `{"obj":{"id":"1000005234","val":"ParentA","parent":"1","typ":"1000005225","typ_name":"__ref_parent_1773571297064","base_typ":"3"},"&main.a.&object":{"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005235"],"typ":["1000005225","1000005225"],"typ_name":["__ref_parent_1773571297064","__ref_parent_17735...`

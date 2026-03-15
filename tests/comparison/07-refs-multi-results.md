# 07-refs-multi — References & Multiselect

6 MATCH / 13 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 2 | GET /_ref_reqs?q=Opt1 | 200 | 200 | MATCH |
| 3 | GET /_ref_reqs (bad id) | 200 | 404 | DIFF: status: PHP=200 Node=404 |
| 4 | POST /_m_set (ref value) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 5 | POST /_m_set (clear ref) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 6 | POST /_d_multi (enable) | 200 | 200 | MATCH |
| 7 | GET /object after multi toggle | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 8 | POST /_d_multi (disable) | 200 | 200 | MATCH |
| 9 | GET /object (sub-type) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 10 | POST /_m_move (to parent) | 200 | 200 | DIFF: body: PHP=Cannot update meta-data Node=Types mismatch 1000004154!=1000004142 |
| 11 | GET /object?F_U=parentId | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 12 | GET /_list/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 13 | GET /_list?q=Opt2 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 14 | GET /_list_join/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 15 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 18 | POST /_d_del_req (remove ref) | 200 | 200 | DIFF: val[obj]: PHP=null Node="__ID__" |
| 19 | GET /edit_obj (with refs) | 200 | 200 | DIFF: val[obj]: PHP={"id":"__ID__","val":"ParentA","parent":... Node={"base_typ":"3","id":"__ID__","parent":"... |

## Diffs Detail

### GET /_ref_reqs (bad id)

- status: PHP=200 Node=404
- length: PHP=0 Node=1
- PHP: `[]`
- Node: `[{"error":"Reference not found"}]`

### POST /_m_set (ref value)

- type: PHP=array Node=object
- PHP: `[{"error":"У вас нет доступа к реквизиту объекта: 1000004152, 1000004143 () или его родителю  ()! Ваш глобальный доступ: 'WRITE'."}]`
- Node: `{"args":"","id":"1000004153","next_act":"nul","obj":1000004151,"warnings":""}`

### POST /_m_set (clear ref)

- type: PHP=array Node=object
- PHP: `[{"error":"У вас нет доступа к реквизиту объекта: 1000004152, 1000004143 () или его родителю  ()! Ваш глобальный доступ: 'WRITE'."}]`
- Node: `{"args":"","id":"","next_act":"nul","obj":1000004151,"warnings":""}`

### GET /object after multi toggle

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_paren... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004142"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_parent_1773564051936"]},"type":{"id":1000004142,"up":1,"val":"__ref_parent_1773564051936","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_parent_1773564051936"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fi...`

### GET /object (sub-type)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_sub_1... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004154"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773564051936"]},"type":{"id":1000004154,"up":1,"val":"__ref_sub_1773564051936","base":"SHORT"},"base":{"id":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773564051936"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filte...`

### POST /_m_move (to parent)

- body: PHP=Cannot update meta-data Node=Types mismatch 1000004154!=1000004142
- PHP: `Cannot update meta-data`
- Node: `Types mismatch 1000004154!=1000004142`

### GET /object?F_U=parentId

- keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a._noobj]: PHP={"_request_.f_u":["1000004152"]} Node=
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773564051936"]},"&main.a._noobj":{"_request_.f_u":["1000004152"]}}`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773564051936"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["100000415...`

### GET /_list/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[{"id":1000004145,"ord":1,"reqs":{},"t":1000004143,"up":1,"val":"RefOpt1"},{"id":1000004146,"ord":1,"reqs":{},"t":1000004143,"up":1,"val":"Ref...`

### GET /_list?q=Opt2

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[{"id":1000004148,"ord":1,"reqs":{},"t":1000004143,"up":1,"val":"RefOpt2"},{"id":1000004147,"ord":2,"reqs":{},"t":1000004143,"up":1,"val":"Ref...`

### GET /_list_join/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[[1000004144,""],[1000004151,"ParentA"],[1000004152,"ParentA"]],"limit":50,"offset":0,"requisites":[],"total":3}`

### GET /object (col-as-table)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_colta... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004157"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_coltab_1773564051936"]},"type":{"id":1000004157,"up":1,"val":"__ref_coltab_1773564051936","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_coltab_1773564051936"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fi...`

### POST /_d_del_req (remove ref)

- val[obj]: PHP=null Node="__ID__"
- PHP: `{"id":1000004158,"obj":null,"next_act":"edit_types","args":"ext","warnings":""}`
- Node: `{"args":"ext","id":"0","next_act":"edit_types","obj":"0","warnings":""}`

### GET /edit_obj (with refs)

- val[obj]: PHP={"id":"__ID__","val":"ParentA","parent":... Node={"base_typ":"3","id":"__ID__","parent":"...
- val[&main.a.&object]: PHP={"typ":["1000004142","1000004142"],"up":... Node={"disabled":[""],"id":["1000004151"],"ty...
- val[&main.a.&object.&edit_req]: PHP={"type":["text"],"typ":["1000004142"],"_... Node={"_parent_.disabled":[""],"_parent_.val"...
- PHP: `{"obj":{"id":"1000004152","val":"ParentA","parent":"1","typ":"1000004142","typ_name":"__ref_parent_1773564051936","base_typ":"3"},"&main.a.&object":{"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000004151"],"typ":["1000004142","1000004142"],"typ_name":["__ref_parent_1773564051936","__ref_parent_17735...`

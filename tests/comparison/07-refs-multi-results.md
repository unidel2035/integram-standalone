# 07-refs-multi — References & Multiselect

8 MATCH / 11 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 2 | GET /_ref_reqs?q=Opt1 | 200 | 200 | MATCH |
| 3 | GET /_ref_reqs (bad id) | 200 | 200 | MATCH |
| 4 | POST /_m_set (ref value) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 5 | POST /_m_set (clear ref) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 6 | POST /_d_multi (enable) | 200 | 200 | MATCH |
| 7 | GET /object after multi toggle | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 8 | POST /_d_multi (disable) | 200 | 200 | MATCH |
| 9 | GET /object (sub-type) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 10 | POST /_m_move (to parent) | 200 | 200 | DIFF: body: PHP=Cannot update meta-data Node=Types mismatch 1000004283!=1000004271 |
| 11 | GET /object?F_U=parentId | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 12 | GET /_list/:type | 200 | 200 | DIFF: body: PHP=null Node=1000004274	RefOpt1
1000004275	RefOpt1
1000004277	R... |
| 13 | GET /_list?q=Opt2 | 200 | 200 | DIFF: body: PHP=null Node=1000004277	RefOpt2
1000004276	RefOpt2 |
| 14 | GET /_list_join/:type | 200 | 200 | DIFF: body: PHP=null Node=1000004273	
1000004280	ParentA
1000004281	ParentA |
| 15 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 18 | POST /_d_del_req (remove ref) | 200 | 200 | MATCH |
| 19 | GET /edit_obj (with refs) | 200 | 200 | DIFF: val[obj]: PHP={"id":"__ID__","val":"ParentA","parent":... Node={"base_typ":"3","id":"__ID__","parent":"... |

## Diffs Detail

### POST /_m_set (ref value)

- type: PHP=array Node=object
- PHP: `[{"error":"У вас нет доступа к реквизиту объекта: 1000004280, 1000004272 () или его родителю  ()! Ваш глобальный доступ: 'WRITE'."}]`
- Node: `{"args":"","id":"1000004282","next_act":"nul","obj":1000004281,"warnings":""}`

### POST /_m_set (clear ref)

- type: PHP=array Node=object
- PHP: `[{"error":"У вас нет доступа к реквизиту объекта: 1000004280, 1000004272 () или его родителю  ()! Ваш глобальный доступ: 'WRITE'."}]`
- Node: `{"args":"","id":"","next_act":"nul","obj":1000004281,"warnings":""}`

### GET /object after multi toggle

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_paren... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004271"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_parent_1773566543436"]},"type":{"id":1000004271,"up":1,"val":"__ref_parent_1773566543436","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_parent_1773566543436"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id...`

### GET /object (sub-type)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_sub_1... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004283"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773566543436"]},"type":{"id":1000004283,"up":1,"val":"__ref_sub_1773566543436","base":"SHORT"},"base":{"id":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773566543436"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":[...`

### POST /_m_move (to parent)

- body: PHP=Cannot update meta-data Node=Types mismatch 1000004283!=1000004271
- PHP: `Cannot update meta-data`
- Node: `Types mismatch 1000004283!=1000004271`

### GET /object?F_U=parentId

- keys: PHP=[&main.a,&main.a._noobj] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a._noobj]: PHP={"_request_.f_u":["1000004280"]} Node=
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773566543436"]},"&main.a._noobj":{"_request_.f_u":["1000004280"]}}`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773566543436"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":["1000004281"],"filter":["&F...`

### GET /_list/:type

- body: PHP=null Node=1000004274	RefOpt1
1000004275	RefOpt1
1000004277	R...
- PHP: `null`
- Node: `1000004274	RefOpt1
1000004275	RefOpt1
1000004277	RefOpt2
1000004279	RefOpt3
1000004276	RefOpt2
1000004278	RefOpt3`

### GET /_list?q=Opt2

- body: PHP=null Node=1000004277	RefOpt2
1000004276	RefOpt2
- PHP: `null`
- Node: `1000004277	RefOpt2
1000004276	RefOpt2`

### GET /_list_join/:type

- body: PHP=null Node=1000004273	
1000004280	ParentA
1000004281	ParentA
- PHP: `null`
- Node: `1000004273	
1000004280	ParentA
1000004281	ParentA`

### GET /object (col-as-table)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_colta... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004286"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__ref_coltab_1773566543436"]},"type":{"id":1000004286,"up":1,"val":"__ref_coltab_1773566543436","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_coltab_1773566543436"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id...`

### GET /edit_obj (with refs)

- val[obj]: PHP={"id":"__ID__","val":"ParentA","parent":... Node={"base_typ":"3","id":"__ID__","parent":"...
- val[&main.a.&object]: PHP={"typ":["1000004271","1000004271"],"up":... Node={"id":["1000004281"],"typ":["1000004271"...
- val[&main.a.&object.&edit_req]: PHP={"type":["text"],"typ":["1000004271"],"_... Node={"_parent_.disabled":[""],"_parent_.val"...
- PHP: `{"obj":{"id":"1000004280","val":"ParentA","parent":"1","typ":"1000004271","typ_name":"__ref_parent_1773566543436","base_typ":"3"},"&main.a.&object":{"...`
- Node: `{"&main.a.&object":{"id":["1000004281"],"typ":["1000004271","1000004271"],"typ_name":["__ref_parent_1773566543436","__ref_parent_1773566543436"],"up":...`

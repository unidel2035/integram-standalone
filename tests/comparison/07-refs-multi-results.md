# 07-refs-multi — References & Multiselect

0 MATCH / 8 DIFF out of 8 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs (bad id) | 200 | 404 | DIFF: status: PHP=200 Node=404 |
| 2 | GET /object after multi toggle | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 3 | GET /object (sub-type) | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 4 | GET /_list/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 5 | GET /_list?q=Opt2 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 6 | GET /_list_join/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 7 | GET /object (col-as-table) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 8 | GET /edit_obj (with refs) | 200 | 200 | DIFF: type: PHP=object Node=array |

## Diffs Detail

### GET /_ref_reqs (bad id)

- status: PHP=200 Node=404
- length: PHP=0 Node=1
- PHP: `[]`
- Node: `[{"error":"Reference not found"}]`

### GET /object after multi toggle

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_paren... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__ref_parent_1773535083642"]},"type":{"id":1000004063,"up":1,"val":"__ref_parent_1773535083642","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_parent_1773535083642"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fi...`

### GET /object (sub-type)

- format: PHP=text Node=JSON
- PHP: `Тип 1000004072 не найден`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773535083642"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filte...`

### GET /_list/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"total":0}`

### GET /_list?q=Opt2

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"total":0}`

### GET /_list_join/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"requisites":[],"total":0}`

### GET /object (col-as-table)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__ref_colta... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__ref_coltab_1773535083642"]},"type":{"id":1000004073,"up":1,"val":"__ref_coltab_1773535083642","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_coltab_1773535083642"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fi...`

### GET /edit_obj (with refs)

- type: PHP=object Node=array
- PHP: `{"obj":{"id":"1000004071","val":"ParentA","parent":"1","typ":"1000004063","typ_name":"__ref_parent_1773535083642","base_typ":"3"},"&main.a.&object":{"...`
- Node: `[{"error":"typeId required: /my/edit_obj/{id}?JSON"}]`

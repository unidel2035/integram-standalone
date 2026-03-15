# 04-listing — Listing & Querying

5 MATCH / 16 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 4 | GET /object/:type (empty) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 9 | GET /object?order_val=val | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 10 | GET /object?desc=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 11 | GET /edit_obj/:id | 200 | 200 | DIFF: val[obj]: PHP={"id":"__ID__","val":"Alpha","parent":"1... Node={"base_typ":"3","id":"__ID__","parent":"... |
| 12 | GET /edit_types | 200 | 200 | DIFF: keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.a.&types,edit_types,editable,types] |
| 13 | GET /obj_meta/:type | 200 | 200 | DIFF: val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}} |
| 14 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 15 | GET /_list/:type | 200 | 200 | DIFF: body: PHP=null Node=1000004244	
1000004245	Alpha
1000004246	Alpha
1000... |
| 16 | GET /_list?q=Alpha | 200 | 200 | DIFF: body: PHP=null Node=1000004245	Alpha
1000004246	Alpha |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | DIFF: body: PHP=null Node=1000004244	
1000004245	Alpha |
| 18 | GET /_list_join/:type | 200 | 200 | DIFF: body: PHP=null Node=1000004244	
1000004245	Alpha
1000004246	Alpha
1000... |
| 19 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | 200 | 200 | MATCH |
| 21 | POST / action=object | 200 | 200 | MATCH |

## Diffs Detail

### GET /object/:type?JSON=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":...`

### GET /object/:type?LIMIT=2

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":...`

### GET /object/:type (empty)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_empty... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004255"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_empty_1773566529145"]},"type":{"id":1000004255,"up":1,"val":"__lst_empty_1773566529145","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__lst_empty_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id"...`

### GET /object?F_U=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":["1"],"filter":["&F_U=1","&...`

### GET /object?F_U=0

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":["0"],"filter":["&F_U=0","&...`

### GET /object?F_I=id

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":["1000...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":["1000004245"],"f_u":[""],"filter":[""...`

### GET /object?F_{type}=Alpha

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":...`

### GET /object?order_val=val

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":...`

### GET /object?desc=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"create_granted":["block"],"f_i":[""],"...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004242"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"type":{"id":1000004242,"up":1,"val":"__lst_main_1773566529145","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773566529145"]},"&main.a.&uni_obj":{"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":...`

### GET /edit_obj/:id

- val[obj]: PHP={"id":"__ID__","val":"Alpha","parent":"1... Node={"base_typ":"3","id":"__ID__","parent":"...
- val[&main.a.&object]: PHP={"typ":["1000004242","1000004242"],"up":... Node={"id":["1000004245"],"typ":["1000004242"...
- val[&main.a.&object.&edit_req]: PHP={"type":["text"],"typ":["1000004242"],"_... Node={"_parent_.disabled":[""],"_parent_.val"...
- PHP: `{"obj":{"id":"1000004246","val":"Alpha","parent":"1","typ":"1000004242","typ_name":"__lst_main_1773566529145","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `{"&main.a.&object":{"id":["1000004245"],"typ":["1000004242","1000004242"],"typ_name":["__lst_main_1773566529145","__lst_main_1773566529145"],"up":["1"...`

### GET /edit_types

- keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.a.&types,edit_types,editable,types]
- val[&main.a.&editables]: PHP={"ok":[""]} Node=
- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`

### GET /obj_meta/:type

- val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}}
- PHP: `{"id":"1000004242","up":"0","type":"3","val":"__lst_main_1773566529145","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `{"id":"1000004242","reqs":{"":{"id":"","type":"","val":""}},"type":"3","up":"0","val":"__lst_main_1773566529145"}`

### GET /_list/:type

- body: PHP=null Node=1000004244	
1000004245	Alpha
1000004246	Alpha
1000...
- PHP: `null`
- Node: `1000004244	
1000004245	Alpha
1000004246	Alpha
1000004248	Beta
1000004250	Gamma
1000004252	Delta
1000004254	Epsilon
1000004247	Beta
1000004249	Gamma
10...`

### GET /_list?q=Alpha

- body: PHP=null Node=1000004245	Alpha
1000004246	Alpha
- PHP: `null`
- Node: `1000004245	Alpha
1000004246	Alpha`

### GET /_list?LIMIT=2

- body: PHP=null Node=1000004244	
1000004245	Alpha
- PHP: `null`
- Node: `1000004244	
1000004245	Alpha`

### GET /_list_join/:type

- body: PHP=null Node=1000004244	
1000004245	Alpha
1000004246	Alpha
1000...
- PHP: `null`
- Node: `1000004244	
1000004245	Alpha
1000004246	Alpha
1000004248	Beta
1000004250	Gamma
1000004252	Delta
1000004254	Epsilon
1000004247	Beta
1000004249	Gamma
10...`

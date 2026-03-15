# 04-listing — Listing & Querying

4 MATCH / 17 DIFF out of 21 tests

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
| 12 | GET /edit_types | 200 | 200 | DIFF: val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"... |
| 13 | GET /obj_meta/:type | 200 | 200 | DIFF: format: PHP=JSON Node=text |
| 14 | GET /obj_meta (bad id) | 200 | 200 | DIFF: format: PHP=JSON Node=text |
| 15 | GET /_list/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | GET /_list?q=Alpha | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 18 | GET /_list_join/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 19 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | 200 | 200 | MATCH |
| 21 | POST / action=object | 200 | 200 | MATCH |

## Diffs Detail

### GET /object/:type?JSON=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object/:type?LIMIT=2

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object/:type (empty)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_empty... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004126"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_empty_1773564037652"]},"type":{"id":1000004126,"up":1,"val":"__lst_empty_1773564037652","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__lst_empty_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fil...`

### GET /object?F_U=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["1"],"fil...`

### GET /object?F_U=0

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["0"],"fil...`

### GET /object?F_I=id

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["1000004116"],"f_u":...`

### GET /object?F_{type}=Alpha

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?order_val=val

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?desc=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&new_req]: PHP={"new_req":[""],"_parent_.typ":["1000004... Node={"_parent_.typ":["1000004113"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"type":{"id":1000004113,"up":1,"val":"__lst_main_1773564037652","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773564037652"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /edit_obj/:id

- val[obj]: PHP={"id":"__ID__","val":"Alpha","parent":"1... Node={"base_typ":"3","id":"__ID__","parent":"...
- val[&main.a.&object]: PHP={"typ":["1000004113","1000004113"],"up":... Node={"disabled":[""],"id":["1000004116"],"ty...
- val[&main.a.&object.&edit_req]: PHP={"type":["text"],"typ":["1000004113"],"_... Node={"_parent_.disabled":[""],"_parent_.val"...
- PHP: `{"obj":{"id":"1000004117","val":"Alpha","parent":"1","typ":"1000004113","typ_name":"__lst_main_1773564037652","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000004116"],"typ":["1000004113","1000004113"],"typ_name":["__lst_main_1773564037652","__lst_main_177356403...`

### GET /edit_types

- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.a.&editables":{"ok":[""]},"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CH...`

### GET /obj_meta/:type

- format: PHP=JSON Node=text
- PHP: `{"id":"1000004113","up":"0","type":"3","val":"__lst_main_1773564037652","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### GET /obj_meta (bad id)

- format: PHP=JSON Node=text
- PHP: `{}`
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### GET /_list/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[{"id":1000004115,"ord":0,"reqs":{},"t":1000004113,"up":0,"val":""},{"id":1000004116,"ord":1,"reqs":{},"t":1000004113,"up":1,"val":"Alpha"},{"...`

### GET /_list?q=Alpha

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[{"id":1000004116,"ord":1,"reqs":{},"t":1000004113,"up":1,"val":"Alpha"},{"id":1000004117,"ord":1,"reqs":{},"t":1000004113,"up":1,"val":"Alpha...`

### GET /_list?LIMIT=2

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[{"id":1000004115,"ord":0,"reqs":{},"t":1000004113,"up":0,"val":""},{"id":1000004116,"ord":1,"reqs":{},"t":1000004113,"up":1,"val":"Alpha"}],"...`

### GET /_list_join/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[[1000004115,""],[1000004116,"Alpha"],[1000004117,"Alpha"],[1000004119,"Beta"],[1000004121,"Gamma"],[1000004123,"Delta"],[1000004125,"Epsilon"...`

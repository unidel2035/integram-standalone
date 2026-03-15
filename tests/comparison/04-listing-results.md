# 04-listing — Listing & Querying

14 MATCH / 7 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 4 | GET /object/:type (empty) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo... |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | MATCH |
| 9 | GET /object?order_val=val | 200 | 200 | MATCH |
| 10 | GET /object?desc=1 | 200 | 200 | MATCH |
| 11 | GET /edit_obj/:id | 200 | 200 | DIFF: val[&main.a.&object]: PHP={"disabled":[""],"id":["1000005200"],"ty... Node={"disabled":[""],"id":["1000005199"],"ty... |
| 12 | GET /edit_types | 200 | 200 | DIFF: val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"... |
| 13 | GET /obj_meta/:type | 200 | 200 | MATCH |
| 14 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 15 | GET /_list/:type | 200 | 200 | MATCH |
| 16 | GET /_list?q=Alpha | 200 | 200 | MATCH |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | MATCH |
| 18 | GET /_list_join/:type | 200 | 200 | MATCH |
| 19 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | 200 | 200 | MATCH |
| 21 | POST / action=object | 200 | 200 | MATCH |

## Diffs Detail

### GET /object/:type?LIMIT=2

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"type":{"id":1000005196,"up":1,"val":"__lst_main_1773571296052","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object/:type (empty)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- PHP: `{"&main.a":{"_parent_.title":["__lst_empty_1773571296052"]},"type":{"id":1000005209,"up":1,"val":"__lst_empty_1773571296052","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__lst_empty_1773571296052"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fil...`

### GET /object?F_U=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a._noobj]: PHP={"_request_.f_u":["1"]} Node=
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"type":{"id":1000005196,"up":1,"val":"__lst_main_1773571296052","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["1"],"fil...`

### GET /object?F_U=0

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":[],"id":[],"val":[]}
- val[&main.a._noobj]: PHP={"_request_.f_u":["0"]} Node=
- val[object]: PHP=[{"base":"1000005196","id":"__ID__","up"... Node=[]
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"type":{"id":1000005196,"up":1,"val":"__lst_main_1773571296052","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["0"],"fil...`

### GET /object?F_I=id

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT"],"id":["1000005200"],"v... Node={"align":["LEFT"],"id":["1000005199"],"v...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"type":{"id":1000005196,"up":1,"val":"__lst_main_1773571296052","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773571296052"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["1000005199"],"f_u":...`

### GET /edit_obj/:id

- val[&main.a.&object]: PHP={"disabled":[""],"id":["1000005200"],"ty... Node={"disabled":[""],"id":["1000005199"],"ty...
- PHP: `{"obj":{"id":"1000005200","val":"Alpha","parent":"1","typ":"1000005196","typ_name":"__lst_main_1773571296052","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005199"],"typ":["1000005196","1000005196"],"typ_name":["__lst_main_1773571296052","__lst_main_177357129...`

### GET /edit_types

- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.a.&editables":{"ok":[""]},"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CH...`

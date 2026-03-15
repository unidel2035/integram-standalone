# 04-listing — Listing & Querying

17 MATCH / 4 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | MATCH |
| 4 | GET /object/:type (empty) | 200 | 200 | MATCH |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr... |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr... |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr... |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr... |
| 9 | GET /object?order_val=val | 200 | 200 | MATCH |
| 10 | GET /object?desc=1 | 200 | 200 | MATCH |
| 11 | GET /edit_obj/:id | 200 | 200 | MATCH |
| 12 | GET /edit_types | 200 | 200 | MATCH |
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

### GET /object?F_U=1

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"type":{"id":1000008162,"up":1,"val":"__lst_main_1773581667491","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"&main.a._noobj":{"_request_.f_u":["1"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_U=0

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"type":{"id":1000008162,"up":1,"val":"__lst_main_1773581667491","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"&main.a._noobj":{"_request_.f_u":["0"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_I=id

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"type":{"id":1000008162,"up":1,"val":"__lst_main_1773581667491","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["1000008167"],"f_u":...`

### GET /object?F_{type}=Alpha

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"type":{"id":1000008162,"up":1,"val":"__lst_main_1773581667491","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773581667491"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

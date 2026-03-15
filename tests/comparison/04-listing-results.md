# 04-listing — Listing & Querying

16 MATCH / 5 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | MATCH |
| 4 | GET /object/:type (empty) | 200 | 200 | MATCH |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr... |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr... |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT"],"base":["SHORT"],"val"... Node={"align":["LEFT"],"base":["SHORT"],"val"... |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr... |
| 9 | GET /object?order_val=val | 200 | 200 | MATCH |
| 10 | GET /object?desc=1 | 200 | 200 | MATCH |
| 11 | GET /edit_obj/:id | 200 | 200 | DIFF: val[&main.a.&object.&object_reqs.&editreq_array]: PHP={"_parent_.arr_num":["0"],"_parent_.id":... Node={"_parent_.arr_num":["0"],"_parent_.id":... |
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

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"type":{"id":1000006141,"up":1,"val":"__lst_main_1773579060577","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"&main.a._noobj":{"_request_.f_u":["1"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_U=0

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"type":{"id":1000006141,"up":1,"val":"__lst_main_1773579060577","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"&main.a._noobj":{"_request_.f_u":["0"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_I=id

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT"],"base":["SHORT"],"val"... Node={"align":["LEFT"],"base":["SHORT"],"val"...
- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr...
- val[&object_reqs]: PHP={"1000006146":["<A HREF=\"/my/object/204... Node={"1000006145":["<A HREF=\"/my/object/204...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"type":{"id":1000006141,"up":1,"val":"__lst_main_1773579060577","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["1000006145"],"f_u":...`

### GET /object?F_{type}=Alpha

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"204212\""],"arr... Node={"arr_type":["arr-type=\"204212\""],"arr...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"type":{"id":1000006141,"up":1,"val":"__lst_main_1773579060577","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773579060577"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /edit_obj/:id

- val[&main.a.&object.&object_reqs.&editreq_array]: PHP={"_parent_.arr_num":["0"],"_parent_.id":... Node={"_parent_.arr_num":["0"],"_parent_.id":...
- PHP: `{"obj":{"id":"1000006146","val":"Alpha","parent":"1","typ":"1000006141","typ_name":"__lst_main_1773579060577","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000006145"],"typ":["1000006141","1000006141"],"typ_name":["__lst_main_1773579060577","__lst_main_177357906...`

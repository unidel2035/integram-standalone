# 16-datatable-patterns — DataTable Component Patterns

15 MATCH / 9 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (preload status dir) | 200 | 200 | MATCH |
| 2 | #2 GET /object (preload prio dir) | 200 | 200 | MATCH |
| 3 | #3 GET /object (full list) | 200 | 200 | DIFF: val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1","... Node={"1000006491":{"1000006483":"Задача 1","... |
| 4 | #4 GET /object (LIMIT=20) | 200 | 200 | DIFF: val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1","... Node={"1000006491":{"1000006483":"Задача 1","... |
| 5 | #5 GET /_list (alternative) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_set (edit title cell) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 7 | #7 POST /_m_set (edit hours cell) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (toggle bool cell) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (edit date cell) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (change ref cell) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (clear ref cell) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_save (save full row) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 13 | #13 GET /_ref_reqs (status dropdown) | 200 | 200 | MATCH |
| 14 | #14 GET /_ref_reqs (prio dropdown) | 200 | 200 | MATCH |
| 15 | #15 GET /_ref_reqs (search=Завер) | 200 | 200 | MATCH |
| 16 | #16 GET /edit_obj (task form) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 17 | #17 GET /edit_obj (task with refs) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | DIFF: val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"1... Node={"1":{"attrs":"1","id":"__ID__","type":"... |
| 23 | #23 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |
| 24 | #24 GET /object (final count) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |

## Diffs Detail

### #3 GET /object (full list)

- val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1","... Node={"1000006491":{"1000006483":"Задача 1","...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"type":{"id":1000006482,"up":1,"val":"__dt_tasks_1773579366208","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #4 GET /object (LIMIT=20)

- val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1","... Node={"1000006491":{"1000006483":"Задача 1","...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"type":{"id":1000006482,"up":1,"val":"__dt_tasks_1773579366208","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #6 POST /_m_set (edit title cell)

- type: PHP=object Node=array
- PHP: `{"id":"1000006493","obj":1000006491,"next_act":"nul","args":"","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #12 POST /_m_save (save full row)

- type: PHP=object Node=array
- PHP: `{"id":"1000006482","obj":1000006498,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000006498","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #16 GET /edit_obj (task form)

- keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["","CHECKED"],"disabled":[""... Node={"checked":["",""],"disabled":["",""],"t...
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["1000006487"],"v... Node={"disabled":[""],"typ":["1000006487"],"v...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["1000006493","","1000006494","... Node={"reqid":["","","","","","",""]}
- PHP: `{"obj":{"id":"1000006491","val":"Задача 1","parent":"1","typ":"1000006482","typ_name":"__dt_tasks_1773579366208","base_typ":"3"},"&main.a.&object":{"t...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000006492"],"typ":["1000006482","1000006482"],"typ_name":["__dt_tasks_1773579366208","__dt_tasks_177357936...`

### #17 GET /edit_obj (task with refs)

- keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["","CHECKED"],"disabled":[""... Node={"checked":["",""],"disabled":["",""],"t...
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["1000006487"],"v... Node={"disabled":[""],"typ":["1000006487"],"v...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["1000006507","","1000006508","... Node={"reqid":["","","","","","",""]}
- PHP: `{"obj":{"id":"1000006505","val":"Bug fix #123","parent":"1","typ":"1000006482","typ_name":"__dt_tasks_1773579366208","base_typ":"3"},"&main.a.&object"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000006506"],"typ":["1000006482","1000006482"],"typ_name":["__dt_tasks_1773579366208","__dt_tasks_177357936...`

### #22 GET /obj_meta (row meta)

- val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"1... Node={"1":{"attrs":"1","id":"__ID__","type":"...
- PHP: `{"id":"1000006491","up":"1","type":"1000006482","val":"Задача 1","reqs":{"1":{"id":"1000006493","val":"custom_agent_instances","type":"3","ref":"22082...`
- Node: `{"id":"1000006492","up":"1","type":"1000006482","val":"Задача 1","reqs":{"1":{"id":"1000006533","val":"MEMO","type":"12","attrs":"1"}}}`

### #23 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"1000006491":["Задача 1 (обновлена)",""... Node={"1000006491":["Задача 1 (обновлена)",""...
- val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1 (о... Node={"1000006491":{"1000006483":"Задача 1 (о...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"type":{"id":1000006482,"up":1,"val":"__dt_tasks_1773579366208","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #24 GET /object (final count)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"1000006491":["Задача 1 (обновлена)",""... Node={"1000006491":["Задача 1 (обновлена)",""...
- val[reqs]: PHP={"1000006491":{"1000006483":"Задача 1 (о... Node={"1000006491":{"1000006483":"Задача 1 (о...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"type":{"id":1000006482,"up":1,"val":"__dt_tasks_1773579366208","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773579366208"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

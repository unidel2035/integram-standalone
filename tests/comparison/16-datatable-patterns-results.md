# 16-datatable-patterns — DataTable Component Patterns

14 MATCH / 10 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (preload status dir) | 200 | 200 | MATCH |
| 2 | #2 GET /object (preload prio dir) | 200 | 200 | MATCH |
| 3 | #3 GET /object (full list) | 200 | 200 | DIFF: val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}} |
| 4 | #4 GET /object (LIMIT=20) | 200 | 200 | DIFF: val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}} |
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
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | DIFF: val[val]: PHP="1" Node="7" |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | DIFF: val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"_... Node={"1":{"attrs":"1","id":"__ID__","type":"... |
| 23 | #23 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","... |
| 24 | #24 GET /object (final count) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","... |

## Diffs Detail

### #3 GET /object (full list)

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"type":{"id":1000008494,"up":1,"val":"__dt_tasks_1773581675455","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #4 GET /object (LIMIT=20)

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"type":{"id":1000008494,"up":1,"val":"__dt_tasks_1773581675455","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #6 POST /_m_set (edit title cell)

- type: PHP=object Node=array
- PHP: `{"id":"1000008503","obj":1000008502,"next_act":"nul","args":"","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #12 POST /_m_save (save full row)

- type: PHP=object Node=array
- PHP: `{"id":"1000008494","obj":1000008508,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000008508","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #16 GET /edit_obj (task form)

- keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["CHECKED"],"disabled":[""],"... Node={"checked":[""],"disabled":[""],"typ":["...
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["__ID__","__ID__","__ID__","__... Node={"reqid":["","","","",""]}
- PHP: `{"obj":{"id":"1000008502","val":"Задача 1","parent":"1","typ":"1000008494","typ_name":"__dt_tasks_1773581675455","base_typ":"3"},"&main.a.&object":{"t...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000008501"],"typ":["1000008494","1000008494"],"typ_name":["__dt_tasks_1773581675455","__dt_tasks_177358167...`

### #17 GET /edit_obj (task with refs)

- keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["CHECKED"],"disabled":[""],"... Node={"checked":[""],"disabled":[""],"typ":["...
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["__ID__","__ID__","__ID__","__... Node={"reqid":["","","","",""]}
- PHP: `{"obj":{"id":"1000008516","val":"Bug fix #123","parent":"1","typ":"1000008494","typ_name":"__dt_tasks_1773581675455","base_typ":"3"},"&main.a.&object"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000008515"],"typ":["1000008494","1000008494"],"typ_name":["__dt_tasks_1773581675455","__dt_tasks_177358167...`

### #18 POST /_m_new (add row via DataTable)

- val[val]: PHP="1" Node="7"
- PHP: `{"id":1000008546,"obj":1000008546,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"1"}`
- Node: `{"args":"new1=1&","id":1000008547,"next_act":"edit_obj","obj":1000008547,"ord":7,"val":"7"}`

### #22 GET /obj_meta (row meta)

- val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"_... Node={"1":{"attrs":"1","id":"__ID__","type":"...
- PHP: `{"id":"1000008502","up":"1","type":"1000008494","val":"Задача 1","reqs":{"1":{"id":"1000008503","val":"__adv_products_1773534190136_n","type":"3","ref...`
- Node: `{"id":"1000008501","up":"1","type":"1000008494","val":"Задача 1","reqs":{"1":{"id":"1000008543","val":"MEMO","type":"12","attrs":"1"}}}`

### #23 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"type":{"id":1000008494,"up":1,"val":"__dt_tasks_1773581675455","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #24 GET /object (final count)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"type":{"id":1000008494,"up":1,"val":"__dt_tasks_1773581675455","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773581675455"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

# 16-datatable-patterns — DataTable Component Patterns

14 MATCH / 10 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (preload status dir) | 200 | 200 | MATCH |
| 2 | #2 GET /object (preload prio dir) | 200 | 200 | MATCH |
| 3 | #3 GET /object (full list) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
| 4 | #4 GET /object (LIMIT=20) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
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
| 16 | #16 GET /edit_obj (task form) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 17 | #17 GET /edit_obj (task with refs) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | DIFF: keys: PHP=[id,reqs,type,unique,up,val] Node=[&main.&top_menu,&main.myrolemenu] |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | DIFF: val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"1... Node={"1":{"attrs":"1000005965","id":"__ID__"... |
| 23 | #23 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
| 24 | #24 GET /object (final count) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |

## Diffs Detail

### #3 GET /object (full list)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_head_filter.&filter_req_rcm]: PHP={"_parent_.dd":["","","","","",""],"_par... Node={"_parent_.dd":["","","",""],"_parent_.r...
- val[&object_reqs]: PHP={"1000005970":["","","","",""," <A HREF=... Node={"1000005970":["","","","","","",""],"10...
- val[reqs]: PHP={"1000005970":{"1000005967":"***","10000... Node={"1000005971":{"1000005962":"Задача 1","...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"type":{"id":1000005961,"up":1,"val":"__dt_tasks_1773575884066","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #4 GET /object (LIMIT=20)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_head_filter.&filter_req_rcm]: PHP={"_parent_.dd":["","","","","",""],"_par... Node={"_parent_.dd":["","","",""],"_parent_.r...
- val[&object_reqs]: PHP={"1000005970":["","","","",""," <A HREF=... Node={"1000005970":["","","","","","",""],"10...
- val[reqs]: PHP={"1000005970":{"1000005967":"***","10000... Node={"1000005971":{"1000005962":"Задача 1","...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"type":{"id":1000005961,"up":1,"val":"__dt_tasks_1773575884066","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #6 POST /_m_set (edit title cell)

- type: PHP=object Node=array
- PHP: `{"id":"1000005972","obj":1000005971,"next_act":"nul","args":"","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #12 POST /_m_save (save full row)

- type: PHP=object Node=array
- PHP: `{"id":"1000005961","obj":1000005978,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000005978","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### #16 GET /edit_obj (task form)

- keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&buttons]: PHP={"attrs":[""],"val":["__sys_bt7_17735758... Node=
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["CHECKED",""],"disabled":[""... Node=
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["1000005966"],"v... Node={"disabled":[""],"typ":["1000005966"],"v...
- PHP: `{"obj":{"id":"1000005971","val":"Задача 1","parent":"1","typ":"1000005961","typ_name":"__dt_tasks_1773575884066","base_typ":"3"},"&main.a.&object":{"t...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005970"],"typ":["1000005961","1000005961"],"typ_name":["__dt_tasks_1773575884066","__dt_tasks_177357588...`

### #17 GET /edit_obj (task with refs)

- keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&buttons]: PHP={"attrs":[""],"val":["__sys_bt7_17735758... Node=
- val[&main.a.&object.&object_reqs.&editreq_boolean]: PHP={"checked":["CHECKED",""],"disabled":[""... Node=
- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["1000005966"],"v... Node={"disabled":[""],"typ":["1000005966"],"v...
- PHP: `{"obj":{"id":"1000005985","val":"Bug fix #123","parent":"1","typ":"1000005961","typ_name":"__dt_tasks_1773575884066","base_typ":"3"},"&main.a.&object"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005984"],"typ":["1000005961","1000005961"],"typ_name":["__dt_tasks_1773575884066","__dt_tasks_177357588...`

### #21 GET /metadata (DataTable columns)

- keys: PHP=[id,reqs,type,unique,up,val] Node=[&main.&top_menu,&main.myrolemenu]
- val[id]: PHP="__ID__" Node=
- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"43","typ... Node=
- val[type]: PHP="3" Node=
- PHP: `{"id":"1000005961","up":"0","type":"3","val":"__dt_tasks_1773575884066","unique":"0","reqs":[{"num":1,"id":"1000005962","val":"class","orig":"43","typ...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### #22 GET /obj_meta (row meta)

- val[reqs]: PHP={"1":{"attrs":"1","id":"__ID__","ref":"1... Node={"1":{"attrs":"1000005965","id":"__ID__"...
- PHP: `{"id":"1000005971","up":"1","type":"1000005961","val":"Задача 1","reqs":{"1":{"id":"1000005972","val":"class","type":"3","ref":"43","ref_id":"10000059...`
- Node: `{"id":"1000005970","up":"1","type":"1000005961","val":"Задача 1","reqs":{"1":{"id":"1000006012","val":"MEMO","type":"12","attrs":"1000005965"}}}`

### #23 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_head_filter.&filter_req_rcm]: PHP={"_parent_.dd":["","","","","",""],"_par... Node={"_parent_.dd":["","","",""],"_parent_.r...
- val[&object_reqs]: PHP={"1000005970":["","","","<A HREF=\"/my/o... Node={"1000005970":["","","","","","",""],"10...
- val[reqs]: PHP={"1000005970":{"1000005965":"MEMO","1000... Node={"1000005971":{"1000005962":"Задача 1 (о...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"type":{"id":1000005961,"up":1,"val":"__dt_tasks_1773575884066","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #24 GET /object (final count)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","CENTER","CENTER... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_head_filter.&filter_req_rcm]: PHP={"_parent_.dd":["","","","","",""],"_par... Node={"_parent_.dd":["","","",""],"_parent_.r...
- val[&object_reqs]: PHP={"1000005970":["","","","<A HREF=\"/my/o... Node={"1000005970":["","","","","","",""],"10...
- val[reqs]: PHP={"1000005970":{"1000005965":"MEMO","1000... Node={"1000005971":{"1000005962":"Задача 1 (о...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"type":{"id":1000005961,"up":1,"val":"__dt_tasks_1773575884066","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773575884066"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

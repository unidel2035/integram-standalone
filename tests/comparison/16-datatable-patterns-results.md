# 16-datatable-patterns — DataTable Component Patterns

17 MATCH / 7 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (preload status dir) | 200 | 200 | MATCH |
| 2 | #2 GET /object (preload prio dir) | 200 | 200 | MATCH |
| 3 | #3 GET /object (full list) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |
| 4 | #4 GET /object (LIMIT=20) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |
| 5 | #5 GET /_list (alternative) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_set (edit title cell) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_set (edit hours cell) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (toggle bool cell) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (edit date cell) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (change ref cell) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (clear ref cell) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_save (save full row) | 200 | 200 | MATCH |
| 13 | #13 GET /_ref_reqs (status dropdown) | 200 | 200 | MATCH |
| 14 | #14 GET /_ref_reqs (prio dropdown) | 200 | 200 | MATCH |
| 15 | #15 GET /_ref_reqs (search=Завер) | 200 | 200 | MATCH |
| 16 | #16 GET /edit_obj (task form) | 200 | 200 | DIFF: val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":... |
| 17 | #17 GET /edit_obj (task with refs) | 200 | 200 | DIFF: val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":... |
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | DIFF: val[val]: PHP="1" Node="7" |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | MATCH |
| 23 | #23 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |
| 24 | #24 GET /object (final count) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","... |

## Diffs Detail

### #3 GET /object (full list)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["Deploy v2.0","","4","","01.0... Node={"__ID__":["Deploy v2.0","","4","","01.0...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"type":{"id":1000010979,"up":1,"val":"__dt_tasks_1773584404947","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #4 GET /object (LIMIT=20)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["Deploy v2.0","","4","","01.0... Node={"__ID__":["Deploy v2.0","","4","","01.0...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"type":{"id":1000010979,"up":1,"val":"__dt_tasks_1773584404947","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #16 GET /edit_obj (task form)

- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["","__ID__","__ID__","__ID__",... Node={"reqid":["__ID__","","__ID__","__ID__",...
- val[&main.a.&object.&object_reqs.&editreq_html]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_short]: PHP={"disabled":["",""],"typ":["__ID__","__I... Node={"disabled":["",""],"typ":["__ID__","__I...
- PHP: `{"obj":{"id":"1000010987","val":"Задача 1","parent":"1","typ":"1000010979","typ_name":"__dt_tasks_1773584404947","base_typ":"3"},"&main.a.&object":{"t...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000010988"],"typ":["1000010979","1000010979"],"typ_name":["__dt_tasks_1773584404947","__dt_tasks_177358440...`

### #17 GET /edit_obj (task with refs)

- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["","__ID__","__ID__","__ID__",... Node={"reqid":["__ID__","","__ID__","","__ID_...
- val[&main.a.&object.&object_reqs.&editreq_html]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_number]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- PHP: `{"obj":{"id":"1000011010","val":"Bug fix #123","parent":"1","typ":"1000010979","typ_name":"__dt_tasks_1773584404947","base_typ":"3"},"&main.a.&object"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000011009"],"typ":["1000010979","1000010979"],"typ_name":["__dt_tasks_1773584404947","__dt_tasks_177358440...`

### #18 POST /_m_new (add row via DataTable)

- val[val]: PHP="1" Node="7"
- PHP: `{"id":1000011055,"obj":1000011055,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"1"}`
- Node: `{"args":"new1=1&","id":1000011056,"next_act":"edit_obj","obj":1000011056,"ord":7,"val":"7"}`

### #23 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["","Задача 1 (обновлена)","Оп... Node={"__ID__":["","Задача 1 (обновлена)","Оп...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"type":{"id":1000010979,"up":1,"val":"__dt_tasks_1773584404947","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #24 GET /object (final count)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["","Задача 1 (обновлена)","Оп... Node={"__ID__":["","Задача 1 (обновлена)","Оп...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"type":{"id":1000010979,"up":1,"val":"__dt_tasks_1773584404947","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773584404947"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

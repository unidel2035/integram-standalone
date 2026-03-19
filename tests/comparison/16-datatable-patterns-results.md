# 16-datatable-patterns — DataTable Component Patterns

22 MATCH / 2 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (preload status dir) | 200 | 200 | MATCH |
| 2 | #2 GET /object (preload prio dir) | 200 | 200 | MATCH |
| 3 | #3 GET /object (full list) | 200 | 200 | MATCH |
| 4 | #4 GET /object (LIMIT=20) | 200 | 200 | MATCH |
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
| 16 | #16 GET /edit_obj (task form) | 200 | 200 | MATCH |
| 17 | #17 GET /edit_obj (task with refs) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | MATCH |
| 23 | #23 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
| 24 | #24 GET /object (final count) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |

## Diffs Detail

### #23 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773722654190"]},"type":{"id":1000031592,"up":1,"val":"__dt_tasks_1773722654190","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773722654190"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### #24 GET /object (final count)

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...
- PHP: `{"&main.a":{"_parent_.title":["__dt_tasks_1773722654190"]},"type":{"id":1000031592,"up":1,"val":"__dt_tasks_1773722654190","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__dt_tasks_1773722654190"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

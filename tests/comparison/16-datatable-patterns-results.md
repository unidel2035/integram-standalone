# 16-datatable-patterns — DataTable Component Patterns

21 MATCH / 3 DIFF out of 24 tests

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
| 16 | #16 GET /edit_obj (task form) | 200 | 200 | DIFF: val[reqs]: PHP={"__ID__":{"arr":0,"arr_type":null,"base... Node={"__ID__":{"arr":"1","arr_type":null,"ba... |
| 17 | #17 GET /edit_obj (task with refs) | 200 | 200 | DIFF: val[reqs]: PHP={"__ID__":{"arr":0,"arr_type":null,"base... Node={"__ID__":{"arr":"1","arr_type":null,"ba... |
| 18 | #18 POST /_m_new (add row via DataTable) | 200 | 200 | DIFF: val[val]: PHP="1" Node="8" |
| 19 | #19 POST /_m_del (delete row via DataTable) | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | 200 | 200 | MATCH |
| 23 | #23 GET /object (final state) | 200 | 200 | MATCH |
| 24 | #24 GET /object (final count) | 200 | 200 | MATCH |

## Diffs Detail

### #16 GET /edit_obj (task form)

- val[reqs]: PHP={"__ID__":{"arr":0,"arr_type":null,"base... Node={"__ID__":{"arr":"1","arr_type":null,"ba...
- PHP: `{"obj":{"id":"1000016461","val":"Задача 1","parent":"1","typ":"1000016454","typ_name":"__dt_tasks_1773592051295","base_typ":"3"},"&main.a.&object":{"t...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000016462"],"typ":["1000016454","1000016454"],"typ_name":["__dt_tasks_1773592051295","__dt_tasks_177359205...`

### #17 GET /edit_obj (task with refs)

- val[reqs]: PHP={"__ID__":{"arr":0,"arr_type":null,"base... Node={"__ID__":{"arr":"1","arr_type":null,"ba...
- PHP: `{"obj":{"id":"1000016485","val":"Bug fix #123","parent":"1","typ":"1000016454","typ_name":"__dt_tasks_1773592051295","base_typ":"3"},"&main.a.&object"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000016486"],"typ":["1000016454","1000016454"],"typ_name":["__dt_tasks_1773592051295","__dt_tasks_177359205...`

### #18 POST /_m_new (add row via DataTable)

- val[val]: PHP="1" Node="8"
- PHP: `{"id":1000016533,"obj":1000016533,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"1"}`
- Node: `{"args":"new1=1&","id":1000016534,"next_act":"edit_obj","obj":1000016534,"ord":8,"val":"8"}`

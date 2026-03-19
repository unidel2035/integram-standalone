# 16-datatable-patterns

**22 MATCH / 2 DIFF** out of 24 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (preload status dir) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (preload prio dir) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (full list) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /object (LIMIT=20) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /_list (alternative) | GET | 200 | 200 | MATCH |
| 06 | #6 POST /_m_set (edit title cell) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_set (edit hours cell) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (toggle bool cell) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (edit date cell) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (change ref cell) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (clear ref cell) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_save (save full row) | POST | 200 | 200 | MATCH |
| 13 | #13 GET /_ref_reqs (status dropdown) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /_ref_reqs (prio dropdown) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /_ref_reqs (search=Завер) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /edit_obj (task form) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /edit_obj (task with refs) | GET | 200 | 200 | MATCH |
| 18 | #18 POST /_m_new (add row via DataTable) | POST | 200 | 200 | MATCH |
| 19 | #19 POST /_m_del (delete row via DataTable) | POST | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | POST | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | GET | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | GET | 200 | 200 | MATCH |
| 23 | #23 GET /object (final state) | GET | 200 | 200 | DIFF |
| 24 | #24 GET /object (final count) | GET | 200 | 200 | DIFF |

---
### DIFF 23: #23 GET /object (final state)

- **PHP path:** `/object/1000031592?JSON=1`
- **Node path:** `/object/1000031591?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...

Full responses: [23-php.json](./23-php.json) | [23-node.json](./23-node.json)

---
### DIFF 24: #24 GET /object (final count)

- **PHP path:** `/object/1000031592?LIMIT=0&JSON=1`
- **Node path:** `/object/1000031591?LIMIT=0&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","RIGHT","LEFT","... Node={"align":["LEFT","LEFT","RIGHT","LEFT","...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...

Full responses: [24-php.json](./24-php.json) | [24-node.json](./24-node.json)
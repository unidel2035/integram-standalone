# 16-datatable-patterns

**17 MATCH / 7 DIFF** out of 24 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (preload status dir) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /object (preload prio dir) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /object (full list) | GET | 200 | 200 | DIFF |
| 04 | #4 GET /object (LIMIT=20) | GET | 200 | 200 | DIFF |
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
| 16 | #16 GET /edit_obj (task form) | GET | 200 | 200 | DIFF |
| 17 | #17 GET /edit_obj (task with refs) | GET | 200 | 200 | DIFF |
| 18 | #18 POST /_m_new (add row via DataTable) | POST | 200 | 200 | DIFF |
| 19 | #19 POST /_m_del (delete row via DataTable) | POST | 200 | 200 | MATCH |
| 20 | #20 POST /_m_save (copy row) | POST | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (DataTable columns) | GET | 200 | 200 | MATCH |
| 22 | #22 GET /obj_meta (row meta) | GET | 200 | 200 | MATCH |
| 23 | #23 GET /object (final state) | GET | 200 | 200 | DIFF |
| 24 | #24 GET /object (final count) | GET | 200 | 200 | DIFF |

---
### DIFF 03: #3 GET /object (full list)

- **PHP path:** `/object/1000010979?JSON=1`
- **Node path:** `/object/1000010979?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["Deploy v2.0","","4","","01.0... Node={"__ID__":["Deploy v2.0","","4","","01.0...

Full responses: [03-php.json](./03-php.json) | [03-node.json](./03-node.json)

---
### DIFF 04: #4 GET /object (LIMIT=20)

- **PHP path:** `/object/1000010979?LIMIT=20&JSON=1`
- **Node path:** `/object/1000010979?LIMIT=20&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["Deploy v2.0","","4","","01.0... Node={"__ID__":["Deploy v2.0","","4","","01.0...

Full responses: [04-php.json](./04-php.json) | [04-node.json](./04-node.json)

---
### DIFF 16: #16 GET /edit_obj (task form)

- **PHP path:** `/edit_obj/1000010987?JSON=1`
- **Node path:** `/edit_obj/1000010988?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["","__ID__","__ID__","__ID__",... Node={"reqid":["__ID__","","__ID__","__ID__",...
- val[&main.a.&object.&object_reqs.&editreq_html]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_short]: PHP={"disabled":["",""],"typ":["__ID__","__I... Node={"disabled":["",""],"typ":["__ID__","__I...

Full responses: [16-php.json](./16-php.json) | [16-node.json](./16-node.json)

---
### DIFF 17: #17 GET /edit_obj (task with refs)

- **PHP path:** `/edit_obj/1000011010?JSON=1`
- **Node path:** `/edit_obj/1000011009?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&object.&object_reqs.&editreq_datetime]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["","__ID__","__ID__","__ID__",... Node={"reqid":["__ID__","","__ID__","","__ID_...
- val[&main.a.&object.&object_reqs.&editreq_html]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...
- val[&main.a.&object.&object_reqs.&editreq_number]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node={"disabled":[""],"typ":["__ID__"],"val":...

Full responses: [17-php.json](./17-php.json) | [17-node.json](./17-node.json)

---
### DIFF 18: #18 POST /_m_new (add row via DataTable)

- **PHP path:** `/_m_new/1000010979`
- **Node path:** `/_m_new/1000010979`
- **PHP status:** 200
- **Node status:** 200

- val[val]: PHP="1" Node="7"

Full responses: [18-php.json](./18-php.json) | [18-node.json](./18-node.json)

---
### DIFF 23: #23 GET /object (final state)

- **PHP path:** `/object/1000010979?JSON=1`
- **Node path:** `/object/1000010979?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["","Задача 1 (обновлена)","Оп... Node={"__ID__":["","Задача 1 (обновлена)","Оп...

Full responses: [23-php.json](./23-php.json) | [23-node.json](./23-node.json)

---
### DIFF 24: #24 GET /object (final count)

- **PHP path:** `/object/1000010979?LIMIT=0&JSON=1`
- **Node path:** `/object/1000010979?LIMIT=0&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","RIGHT","... Node={"align":["LEFT","LEFT","LEFT","RIGHT","...
- val[&object_reqs]: PHP={"__ID__":["","Задача 1 (обновлена)","Оп... Node={"__ID__":["","Задача 1 (обновлена)","Оп...

Full responses: [24-php.json](./24-php.json) | [24-node.json](./24-node.json)
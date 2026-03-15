# 15-reports-advanced

**14 MATCH / 6 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object/22 (report list) | GET | 200 | 200 | DIFF |
| 02 | #2 GET /edit_types | GET | 200 | 200 | MATCH |
| 03 | #3 POST /_m_new/22 (create report) | POST | 200 | 200 | MATCH |
| 04 | #4 GET /edit_obj (new report) | GET | 200 | 200 | DIFF |
| 05 | #5 POST /_m_new/44 (add FROM) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_new/28 (add val column) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_new/28 (add num column) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_new/28 (add date column) | POST | 200 | 200 | MATCH |
| 09 | #9 GET /edit_obj (report with columns) | GET | 200 | 200 | DIFF |
| 10 | #10 POST /_m_save (set execute flag) | POST | 200 | 200 | MATCH |
| 11 | #11 GET /report (execute JSON) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=2) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /report (pg=2, LIMIT=2) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /report (CSV) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /metadata (report) | GET | 200 | 200 | DIFF |
| 16 | #16 GET /object/28 (report columns) | GET | 200 | 200 | DIFF |
| 17 | #17 POST /_m_save (rename report) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_m_del (delete report) | POST | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (deleted report) | GET | 200 | 200 | DIFF |
| 20 | #20 GET /report (non-existent) | GET | 200 | 200 | MATCH |

---
### DIFF 01: #1 GET /object/22 (report list)

- **PHP path:** `/object/22?JSON=1`
- **Node path:** `/object/22?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&object_reqs]: PHP={"169":["<A HREF=\"/my/object/28/?F_U=16... Node={"169":["<A HREF=\"/my/object/28/?F_U=16...

Full responses: [01-php.json](./01-php.json) | [01-node.json](./01-node.json)

---
### DIFF 04: #4 GET /edit_obj (new report)

- **PHP path:** `/edit_obj/1000017211?JSON=1`
- **Node path:** `/edit_obj/1000017212?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...

Full responses: [04-php.json](./04-php.json) | [04-node.json](./04-node.json)

---
### DIFF 09: #9 GET /edit_obj (report with columns)

- **PHP path:** `/edit_obj/1000017211?JSON=1`
- **Node path:** `/edit_obj/1000017212?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...

Full responses: [09-php.json](./09-php.json) | [09-node.json](./09-node.json)

---
### DIFF 15: #15 GET /metadata (report)

- **PHP path:** `/metadata/1000017211?JSON=1`
- **Node path:** `/metadata/1000017212?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- format: PHP=text Node=JSON

Full responses: [15-php.json](./15-php.json) | [15-node.json](./15-node.json)

---
### DIFF 16: #16 GET /object/28 (report columns)

- **PHP path:** `/object/28?F_U=1000017211&JSON=1`
- **Node path:** `/object/28?F_U=1000017212&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj.&new_req_report_column]: PHP={"_parent_.typ":["28"],"new_req":[""]} Node=
- val[&main.a.&uni_obj.&new_req_report_column.&rep_col_list]: PHP={"id":["__ID__","__ID__","__ID__","__ID_... Node=
- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT"],"id":["_... Node={"align":["LEFT","LEFT","LEFT"],"id":["_...

Full responses: [16-php.json](./16-php.json) | [16-node.json](./16-node.json)

---
### DIFF 19: #19 GET /edit_obj (deleted report)

- **PHP path:** `/edit_obj/1000017211?JSON=1`
- **Node path:** `/edit_obj/1000017212?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- format: PHP=text Node=JSON

Full responses: [19-php.json](./19-php.json) | [19-node.json](./19-node.json)
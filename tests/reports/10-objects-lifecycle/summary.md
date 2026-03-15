# 10-objects-lifecycle

**23 MATCH / 5 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_new (value only) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_m_new (with requisites) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_new (empty) | POST | 200 | 200 | DIFF |
| 04 | #4 POST /_m_new (special chars) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_save (rename) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_save (with reqs) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_save (copy) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (text) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (number) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (date) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (bool true) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (bool false) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (long text) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_set (clear field) | POST | 200 | 200 | MATCH |
| 15 | #15 GET /object (list) | GET | 200 | 200 | DIFF |
| 16 | #16 GET /object (LIMIT=2) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /object (page 2) | GET | 200 | 200 | DIFF |
| 18 | #18 GET /edit_obj | GET | 200 | 200 | MATCH |
| 19 | #19 GET /object (count, LIMIT=0) | GET | 200 | 200 | DIFF |
| 20 | #20 GET /obj_meta | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_m_up | POST | 200 | 200 | MATCH |
| 22 | #22 POST /_m_ord (order=1) | POST | 200 | 200 | MATCH |
| 23 | #23 POST /_m_move (to root) | POST | 200 | 200 | MATCH |
| 24 | #24 POST /_m_id (valid) | POST | 200 | 200 | MATCH |
| 25 | #25 POST /_m_id (duplicate) | POST | 200 | 200 | MATCH |
| 26 | #26 POST /_m_del (existing) | POST | 200 | 200 | MATCH |
| 27 | #27 POST /_m_del (non-existent) | POST | 200 | 200 | MATCH |
| 28 | #28 GET /object (after delete) | GET | 200 | 200 | DIFF |

---
### DIFF 03: #3 POST /_m_new (empty)

- **PHP path:** `/_m_new/1000010792`
- **Node path:** `/_m_new/1000010792`
- **PHP status:** 200
- **Node status:** 200

- val[val]: PHP="1" Node="8"

Full responses: [03-php.json](./03-php.json) | [03-node.json](./03-node.json)

---
### DIFF 15: #15 GET /object (list)

- **PHP path:** `/object/1000010792?JSON=1`
- **Node path:** `/object/1000010792?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...

Full responses: [15-php.json](./15-php.json) | [15-node.json](./15-node.json)

---
### DIFF 17: #17 GET /object (page 2)

- **PHP path:** `/object/1000010792?LIMIT=2&pg=2&JSON=1`
- **Node path:** `/object/1000010792?LIMIT=2&pg=2&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]

Full responses: [17-php.json](./17-php.json) | [17-node.json](./17-node.json)

---
### DIFF 19: #19 GET /object (count, LIMIT=0)

- **PHP path:** `/object/1000010792?LIMIT=0&JSON=1`
- **Node path:** `/object/1000010792?LIMIT=0&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...

Full responses: [19-php.json](./19-php.json) | [19-node.json](./19-node.json)

---
### DIFF 28: #28 GET /object (after delete)

- **PHP path:** `/object/1000010792?JSON=1`
- **Node path:** `/object/1000010792?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...

Full responses: [28-php.json](./28-php.json) | [28-node.json](./28-node.json)
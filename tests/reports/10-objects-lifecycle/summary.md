# 10-objects-lifecycle

**18 MATCH / 10 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_new (value only) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_m_new (with requisites) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_m_new (empty) | POST | 200 | 200 | DIFF |
| 04 | #4 POST /_m_new (special chars) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_m_save (rename) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_save (with reqs) | POST | 200 | 200 | DIFF |
| 07 | #7 POST /_m_save (copy) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (text) | POST | 200 | 200 | DIFF |
| 09 | #9 POST /_m_set (number) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_set (date) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_set (bool true) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_set (bool false) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_set (long text) | POST | 200 | 200 | DIFF |
| 14 | #14 POST /_m_set (clear field) | POST | 200 | 200 | DIFF |
| 15 | #15 GET /object (list) | GET | 200 | 200 | DIFF |
| 16 | #16 GET /object (LIMIT=2) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /object (page 2) | GET | 200 | 200 | DIFF |
| 18 | #18 GET /edit_obj | GET | 200 | 200 | DIFF |
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

- **PHP path:** `/_m_new/1000008246`
- **Node path:** `/_m_new/1000008246`
- **PHP status:** 200
- **Node status:** 200

- val[val]: PHP="1" Node="8"

Full responses: [03-php.json](./03-php.json) | [03-node.json](./03-node.json)

---
### DIFF 06: #6 POST /_m_save (with reqs)

- **PHP path:** `/_m_save/1000008254`
- **Node path:** `/_m_save/1000008255`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [06-php.json](./06-php.json) | [06-node.json](./06-node.json)

---
### DIFF 08: #8 POST /_m_set (text)

- **PHP path:** `/_m_set/1000008257`
- **Node path:** `/_m_set/1000008256`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [08-php.json](./08-php.json) | [08-node.json](./08-node.json)

---
### DIFF 13: #13 POST /_m_set (long text)

- **PHP path:** `/_m_set/1000008259`
- **Node path:** `/_m_set/1000008258`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [13-php.json](./13-php.json) | [13-node.json](./13-node.json)

---
### DIFF 14: #14 POST /_m_set (clear field)

- **PHP path:** `/_m_set/1000008259`
- **Node path:** `/_m_set/1000008258`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [14-php.json](./14-php.json) | [14-node.json](./14-node.json)

---
### DIFF 15: #15 GET /object (list)

- **PHP path:** `/object/1000008246?JSON=1`
- **Node path:** `/object/1000008246?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...

Full responses: [15-php.json](./15-php.json) | [15-node.json](./15-node.json)

---
### DIFF 17: #17 GET /object (page 2)

- **PHP path:** `/object/1000008246?LIMIT=2&pg=2&JSON=1`
- **Node path:** `/object/1000008246?LIMIT=2&pg=2&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]

Full responses: [17-php.json](./17-php.json) | [17-node.json](./17-node.json)

---
### DIFF 18: #18 GET /edit_obj

- **PHP path:** `/edit_obj/1000008254?JSON=1`
- **Node path:** `/edit_obj/1000008255?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&object_reqs.&editreq_array]: PHP={"_parent_.arr_num":["1"],"_parent_.id":... Node={"_parent_.arr_num":["0"],"_parent_.id":...
- val[&main.a.&object.&object_reqs.&editreq_file]: PHP={"reqid":["__ID__","__ID__","","",""]} Node={"reqid":["","","","",""]}
- val[&main.a.&object.&object_reqs.&editreq_html]: PHP={"disabled":[""],"typ":["__ID__"],"val":... Node=

Full responses: [18-php.json](./18-php.json) | [18-node.json](./18-node.json)

---
### DIFF 19: #19 GET /object (count, LIMIT=0)

- **PHP path:** `/object/1000008246?LIMIT=0&JSON=1`
- **Node path:** `/object/1000008246?LIMIT=0&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...

Full responses: [19-php.json](./19-php.json) | [19-node.json](./19-node.json)

---
### DIFF 28: #28 GET /object (after delete)

- **PHP path:** `/object/1000008246?JSON=1`
- **Node path:** `/object/1000008246?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","RIGHT","LEFT","CENTER"... Node={"align":["LEFT","RIGHT","LEFT","CENTER"...
- val[object]: PHP=[{"base":"__ID__","id":"__ID__","up":"1"... Node=[{"base":"__ID__","id":"__ID__","up":"1"...

Full responses: [28-php.json](./28-php.json) | [28-node.json](./28-node.json)
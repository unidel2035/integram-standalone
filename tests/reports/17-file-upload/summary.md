# 17-file-upload

**5 MATCH / 2 DIFF** out of 7 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #2 GET /edit_obj (after upload) | GET | 200 | 200 | MATCH |
| 02 | #3 GET /object (listing with file) | GET | 200 | 200 | DIFF |
| 03 | #5 GET /edit_obj (after _m_set upload) | GET | 200 | 200 | MATCH |
| 04 | #7 GET /edit_obj (after replace) | GET | 200 | 200 | MATCH |
| 05 | #8 POST /_m_set (clear file) | POST | 200 | 200 | MATCH |
| 06 | #9 GET /edit_obj (after clear) | GET | 200 | 200 | MATCH |
| 07 | #15 GET /object (final state) | GET | 200 | 200 | DIFF |

---
### DIFF 02: #3 GET /object (listing with file)

- **PHP path:** `/object/1000031699?JSON=1`
- **Node path:** `/object/1000031698?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT"],"... Node={"align":["LEFT","LEFT","LEFT","LEFT"],"...
- val[reqs]: PHP={"__ID__":{"__ID__":"<a target=\"_blank\... Node=

Full responses: [02-php.json](./02-php.json) | [02-node.json](./02-node.json)

---
### DIFF 07: #15 GET /object (final state)

- **PHP path:** `/object/1000031699?JSON=1`
- **Node path:** `/object/1000031698?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT"],"... Node={"align":["LEFT","LEFT","LEFT","LEFT"],"...
- val[&object_reqs]: PHP={"__ID__":["","<a target=\"_blank\" href... Node={"__ID__":["","<a target=\"_blank\" href...
- val[reqs]: PHP={"__ID__":{"__ID__":"<a target=\"_blank\... Node={"__ID__":{"__ID__":"<a target=\"_blank\...

Full responses: [07-php.json](./07-php.json) | [07-node.json](./07-node.json)
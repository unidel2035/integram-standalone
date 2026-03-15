# 04-listing

**17 MATCH / 4 DIFF** out of 21 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /object/:type?JSON=1 | GET | 200 | 200 | MATCH |
| 02 | GET /object/:type?JSON_DATA | GET | 200 | 200 | MATCH |
| 03 | GET /object/:type?LIMIT=2 | GET | 200 | 200 | MATCH |
| 04 | GET /object/:type (empty) | GET | 200 | 200 | MATCH |
| 05 | GET /object?F_U=1 | GET | 200 | 200 | DIFF |
| 06 | GET /object?F_U=0 | GET | 200 | 200 | DIFF |
| 07 | GET /object?F_I=id | GET | 200 | 200 | DIFF |
| 08 | GET /object?F_{type}=Alpha | GET | 200 | 200 | DIFF |
| 09 | GET /object?order_val=val | GET | 200 | 200 | MATCH |
| 10 | GET /object?desc=1 | GET | 200 | 200 | MATCH |
| 11 | GET /edit_obj/:id | GET | 200 | 200 | MATCH |
| 12 | GET /edit_types | GET | 200 | 200 | MATCH |
| 13 | GET /obj_meta/:type | GET | 200 | 200 | MATCH |
| 14 | GET /obj_meta (bad id) | GET | 200 | 200 | MATCH |
| 15 | GET /_list/:type | GET | 200 | 200 | MATCH |
| 16 | GET /_list?q=Alpha | GET | 200 | 200 | MATCH |
| 17 | GET /_list?LIMIT=2 | GET | 200 | 200 | MATCH |
| 18 | GET /_list_join/:type | GET | 200 | 200 | MATCH |
| 19 | GET /_ref_reqs/:reqId | GET | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | GET | 200 | 200 | MATCH |
| 21 | POST / action=object | POST | 200 | 200 | MATCH |

---
### DIFF 05: GET /object?F_U=1

- **PHP path:** `/object/1000008162?JSON=1&F_U=1`
- **Node path:** `/object/1000008162?JSON=1&F_U=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...

Full responses: [05-php.json](./05-php.json) | [05-node.json](./05-node.json)

---
### DIFF 06: GET /object?F_U=0

- **PHP path:** `/object/1000008162?JSON=1&F_U=0`
- **Node path:** `/object/1000008162?JSON=1&F_U=0`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...

Full responses: [06-php.json](./06-php.json) | [06-node.json](./06-node.json)

---
### DIFF 07: GET /object?F_I=id

- **PHP path:** `/object/1000008162?JSON=1&F_I=1000008166`
- **Node path:** `/object/1000008162?JSON=1&F_I=1000008167`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...

Full responses: [07-php.json](./07-php.json) | [07-node.json](./07-node.json)

---
### DIFF 08: GET /object?F_{type}=Alpha

- **PHP path:** `/object/1000008162?JSON=1&F_1000008162=Alpha`
- **Node path:** `/object/1000008162?JSON=1&F_1000008162=Alpha`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj.&uni_obj_head]: PHP={"arr_type":["arr-type=\"__ID__\""],"arr... Node={"arr_type":["arr-type=\"__ID__\""],"arr...

Full responses: [08-php.json](./08-php.json) | [08-node.json](./08-node.json)
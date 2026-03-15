# 09-tables-crud

**19 MATCH / 6 DIFF** out of 25 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_new (basic type) | POST | 200 | 200 | DIFF |
| 02 | #2 POST /_d_new (LONG base) | POST | 200 | 200 | DIFF |
| 03 | #3 POST /_d_new (empty name) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_d_new (subordinate) | POST | 200 | 200 | DIFF |
| 05 | #5 POST /_d_req (SHORT col) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_d_req (NUMBER col) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_d_req (DATE col) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_d_req (BOOL col) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_d_req (LONG col) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_d_alias (set name) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_d_attrs | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_d_null (toggle ON) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_d_null (toggle OFF) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_d_multi (toggle ON) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_d_up (move col up) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_d_ref (add ref col) | POST | 200 | 200 | MATCH |
| 17 | #17 GET /metadata (single type) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /edit_types | GET | 200 | 200 | MATCH |
| 19 | #19 GET /terms | GET | 200 | 200 | MATCH |
| 20 | #20 GET /dict?JSON=1 | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_d_save (rename type) | POST | 200 | 200 | DIFF |
| 22 | #22 POST /_d_del_req (delete col) | POST | 200 | 200 | DIFF |
| 23 | #23 POST /_d_del_req (non-existent) | POST | 200 | 200 | DIFF |
| 24 | #24 POST /_d_del (empty type) | POST | 200 | 200 | MATCH |
| 25 | #25 POST /_d_del (non-existent) | POST | 200 | 200 | MATCH |

---
### DIFF 01: #1 POST /_d_new (basic type)

- **PHP path:** `/_d_new`
- **Node path:** `/_d_new`
- **PHP status:** 200
- **Node status:** 200

- val[warnings]: PHP="Тип __tbl_verify___ID__ уже существует!... Node=""

Full responses: [01-php.json](./01-php.json) | [01-node.json](./01-node.json)

---
### DIFF 02: #2 POST /_d_new (LONG base)

- **PHP path:** `/_d_new`
- **Node path:** `/_d_new`
- **PHP status:** 200
- **Node status:** 200

- val[warnings]: PHP="" Node="Тип __tbl_long___ID__ уже существует!"

Full responses: [02-php.json](./02-php.json) | [02-node.json](./02-node.json)

---
### DIFF 04: #4 POST /_d_new (subordinate)

- **PHP path:** `/_d_new`
- **Node path:** `/_d_new`
- **PHP status:** 200
- **Node status:** 200

- val[warnings]: PHP="Тип __tbl_sub___ID__ уже существует!" Node=""

Full responses: [04-php.json](./04-php.json) | [04-node.json](./04-node.json)

---
### DIFF 21: #21 POST /_d_save (rename type)

- **PHP path:** `/_d_save/1000008235`
- **Node path:** `/_d_save/1000008235`
- **PHP status:** 200
- **Node status:** 200

- keys[0]: PHP=[error] Node=[args,id,next_act,obj,warnings]

Full responses: [21-php.json](./21-php.json) | [21-node.json](./21-node.json)

---
### DIFF 22: #22 POST /_d_del_req (delete col)

- **PHP path:** `/_d_del_req/1000008241`
- **Node path:** `/_d_del_req/1000008241`
- **PHP status:** 200
- **Node status:** 200

- val[obj]: PHP=null Node="__ID__"

Full responses: [22-php.json](./22-php.json) | [22-node.json](./22-node.json)

---
### DIFF 23: #23 POST /_d_del_req (non-existent)

- **PHP path:** `/_d_del_req/999999999`
- **Node path:** `/_d_del_req/999999999`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[args,id,next_act,obj,warnings] Node=[error]
- val[args]: PHP="ext" Node=
- val[id]: PHP="__ID__" Node=
- val[next_act]: PHP="edit_types" Node=

Full responses: [23-php.json](./23-php.json) | [23-node.json](./23-node.json)
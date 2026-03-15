# 12-subordinates

**24 MATCH / 3 DIFF** out of 27 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /metadata (parent type) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /metadata (child type) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /metadata (grandchild type) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /edit_types (full tree) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /object (children of parent1) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object (children of parent2) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object (children of parent3 — empty) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object (grandchildren of child1) | GET | 200 | 200 | DIFF |
| 09 | #9 GET /object (all children, no F_U) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /object (F_U + LIMIT=2) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /object (F_U + pg=2, LIMIT=2) | GET | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (child under parent3) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (grandchild under child4) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_m_move (child to different parent) | POST | 200 | 200 | MATCH |
| 15 | #15 GET /object (parent1 after move) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /object (parent2 after move) | GET | 200 | 200 | MATCH |
| 17 | #17 POST /_m_move (move child back) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_m_up (reorder within parent) | POST | 200 | 200 | MATCH |
| 19 | #19 POST /_m_ord (set order within parent) | POST | 200 | 200 | MATCH |
| 20 | #20 GET /object (order after changes) | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_m_set (child requisite) | POST | 200 | 200 | MATCH |
| 22 | #22 GET /edit_obj (child) | GET | 500 | 200 | DIFF |
| 23 | #23 GET /edit_obj (grandchild) | GET | 500 | 200 | DIFF |
| 24 | #24 GET /object (parent list) | GET | 200 | 200 | MATCH |
| 25 | #25 POST /_m_del (delete child) | POST | 200 | 200 | MATCH |
| 26 | #26 GET /object (parent2 after child delete) | GET | 200 | 200 | MATCH |
| 27 | #27 POST /_m_del (parent with children) | POST | 200 | 200 | MATCH |

---
### DIFF 08: #8 GET /object (grandchildren of child1)

- **PHP path:** `/object/1000008331?F_U=NaN&JSON=1`
- **Node path:** `/object/1000008331?F_U=NaN&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...

Full responses: [08-php.json](./08-php.json) | [08-node.json](./08-node.json)

---
### DIFF 22: #22 GET /edit_obj (child)

- **PHP path:** `/edit_obj/NaN?JSON=1`
- **Node path:** `/edit_obj/NaN?JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [22-php.json](./22-php.json) | [22-node.json](./22-node.json)

---
### DIFF 23: #23 GET /edit_obj (grandchild)

- **PHP path:** `/edit_obj/NaN?JSON=1`
- **Node path:** `/edit_obj/NaN?JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [23-php.json](./23-php.json) | [23-node.json](./23-node.json)
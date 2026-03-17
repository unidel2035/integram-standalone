# 09-tables-crud

**24 MATCH / 1 DIFF** out of 25 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_new (basic type) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_d_new (LONG base) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_d_new (empty name) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_d_new (subordinate) | POST | 200 | 200 | MATCH |
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
| 17 | #17 GET /metadata (single type) | GET | 200 | 200 | DIFF |
| 18 | #18 GET /edit_types | GET | 200 | 200 | MATCH |
| 19 | #19 GET /terms | GET | 200 | 200 | MATCH |
| 20 | #20 GET /dict?JSON=1 | GET | 200 | 200 | MATCH |
| 21 | #21 POST /_d_save (rename type) | POST | 200 | 200 | MATCH |
| 22 | #22 POST /_d_del_req (delete col) | POST | 200 | 200 | MATCH |
| 23 | #23 POST /_d_del_req (non-existent) | POST | 200 | 200 | MATCH |
| 24 | #24 POST /_d_del (empty type) | POST | 200 | 200 | MATCH |
| 25 | #25 POST /_d_del (non-existent) | POST | 200 | 200 | MATCH |

---
### DIFF 17: #17 GET /metadata (single type)

- **PHP path:** `/metadata/1000031246?JSON=1`
- **Node path:** `/metadata/1000031245?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"id":"__ID__","num":1,"orig":"__ID__",...

Full responses: [17-php.json](./17-php.json) | [17-node.json](./17-node.json)
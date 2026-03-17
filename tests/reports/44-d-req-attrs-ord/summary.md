# 44-d-req-attrs-ord

**26 MATCH / 2 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_d_req (add SHORT col) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_d_req (add NUMBER col) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /_d_req (add LONG col) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /_d_req (add DATETIME col) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /_d_req (add REF col) | POST | 200 | 200 | MATCH |
| 06 | #6 GET /metadata (after _d_req) | GET | 200 | 200 | MATCH |
| 07 | #7 POST /_d_req (nonexistent type) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_d_req (nonexistent parent) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_d_req (duplicate SHORT) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_d_ref (create ref) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_d_ref (idempotent) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_d_ref (nonexistent) | POST | 200 | 200 | MATCH |
| 13 | #13 POST /_d_attrs (alias+required) | POST | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (after _d_attrs) | GET | 200 | 200 | DIFF |
| 15 | #15 POST /_d_attrs (multi=1) | POST | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after multi) | GET | 200 | 200 | DIFF |
| 17 | #17 POST /_d_attrs (clear alias) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_d_attrs (nonexistent col) | POST | 200 | 404 | MATCH |
| 19 | #19 GET /metadata (before _d_ord) | GET | 200 | 200 | MATCH |
| 20 | #20 POST /_d_ord (col3 → ord=1) | POST | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (after _d_ord) | GET | 200 | 200 | MATCH |
| 22 | #22 POST /_d_ord (col1 → ord=3) | POST | 200 | 200 | MATCH |
| 23 | #23 GET /metadata (after second _d_ord) | GET | 200 | 200 | MATCH |
| 24 | #24 POST /_d_ord (nonexistent col) | POST | 200 | 200 | MATCH |
| 25 | #25 POST /_d_req (with alias) | POST | 200 | 200 | MATCH |
| 26 | #26 POST /_d_req (with required) | POST | 200 | 200 | MATCH |
| 27 | #27 POST /_d_req (ref+multiselect) | POST | 200 | 200 | MATCH |
| 28 | #28 GET /metadata (with modifiers) | GET | 200 | 200 | MATCH |

---
### DIFF 14: #14 GET /metadata (after _d_attrs)

- **PHP path:** `/metadata/1000032407?JSON=1`
- **Node path:** `/metadata/1000032408?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI::ALI... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев...

Full responses: [14-php.json](./14-php.json) | [14-node.json](./14-node.json)

---
### DIFF 16: #16 GET /metadata (after multi)

- **PHP path:** `/metadata/1000032407?JSON=1`
- **Node path:** `/metadata/1000032408?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI:","i... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев...

Full responses: [16-php.json](./16-php.json) | [16-node.json](./16-node.json)
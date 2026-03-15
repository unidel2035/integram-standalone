# 04-listing

**21 MATCH / 0 DIFF** out of 21 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /object/:type?JSON=1 | GET | 200 | 200 | MATCH |
| 02 | GET /object/:type?JSON_DATA | GET | 200 | 200 | MATCH |
| 03 | GET /object/:type?LIMIT=2 | GET | 200 | 200 | MATCH |
| 04 | GET /object/:type (empty) | GET | 200 | 200 | MATCH |
| 05 | GET /object?F_U=1 | GET | 200 | 200 | MATCH |
| 06 | GET /object?F_U=0 | GET | 200 | 200 | MATCH |
| 07 | GET /object?F_I=id | GET | 200 | 200 | MATCH |
| 08 | GET /object?F_{type}=Alpha | GET | 200 | 200 | MATCH |
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
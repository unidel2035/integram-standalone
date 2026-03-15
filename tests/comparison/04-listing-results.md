# 04-listing — Listing & Querying

21 MATCH / 0 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | MATCH |
| 4 | GET /object/:type (empty) | 200 | 200 | MATCH |
| 5 | GET /object?F_U=1 | 200 | 200 | MATCH |
| 6 | GET /object?F_U=0 | 200 | 200 | MATCH |
| 7 | GET /object?F_I=id | 200 | 200 | MATCH |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | MATCH |
| 9 | GET /object?order_val=val | 200 | 200 | MATCH |
| 10 | GET /object?desc=1 | 200 | 200 | MATCH |
| 11 | GET /edit_obj/:id | 200 | 200 | MATCH |
| 12 | GET /edit_types | 200 | 200 | MATCH |
| 13 | GET /obj_meta/:type | 200 | 200 | MATCH |
| 14 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 15 | GET /_list/:type | 200 | 200 | MATCH |
| 16 | GET /_list?q=Alpha | 200 | 200 | MATCH |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | MATCH |
| 18 | GET /_list_join/:type | 200 | 200 | MATCH |
| 19 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | 200 | 200 | MATCH |
| 21 | POST / action=object | 200 | 200 | MATCH |
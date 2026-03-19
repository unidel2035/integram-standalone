# 06-admin

**16 MATCH / 0 DIFF** out of 16 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | GET /terms?JSON=1 | GET | 200 | 200 | MATCH |
| 02 | GET /terms (HTML) | GET | 200 | 200 | MATCH |
| 03 | GET /dict?JSON=1 | GET | 200 | 200 | MATCH |
| 04 | GET /dict/:type?JSON=1 | GET | 200 | 200 | MATCH |
| 05 | GET /dict (bad id) | GET | 200 | 200 | MATCH |
| 06 | GET /edit_types?JSON=1 | GET | 200 | 200 | MATCH |
| 07 | GET /types?JSON=1 | GET | 200 | 200 | MATCH |
| 08 | GET /obj_meta/:type | GET | 200 | 200 | MATCH |
| 09 | GET /obj_meta (bad id) | GET | 200 | 200 | MATCH |
| 10 | GET /form?JSON=1 | GET | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | GET | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | GET | 200 | 200 | MATCH |
| 13 | GET /validate?JSON=1 | GET | 200 | 200 | MATCH |
| 14 | GET /grants?JSON=1 | GET | 200 | 200 | MATCH |
| 15 | POST /check_grant | POST | 200 | 200 | MATCH |
| 16 | GET /exit | GET | 302 | 302 | MATCH |
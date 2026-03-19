# 06-admin — Admin & Metadata

16 MATCH / 0 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /terms?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /terms (HTML) | 200 | 200 | MATCH |
| 3 | GET /dict?JSON=1 | 200 | 200 | MATCH |
| 4 | GET /dict/:type?JSON=1 | 200 | 200 | MATCH |
| 5 | GET /dict (bad id) | 200 | 200 | MATCH |
| 6 | GET /edit_types?JSON=1 | 200 | 200 | MATCH |
| 7 | GET /types?JSON=1 | 200 | 200 | MATCH |
| 8 | GET /obj_meta/:type | 200 | 200 | MATCH |
| 9 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 10 | GET /form?JSON=1 | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | 200 | 200 | MATCH |
| 13 | GET /validate?JSON=1 | 200 | 200 | MATCH |
| 14 | GET /grants?JSON=1 | 200 | 200 | MATCH |
| 15 | POST /check_grant | 200 | 200 | MATCH |
| 16 | GET /exit | 302 | 302 | MATCH |
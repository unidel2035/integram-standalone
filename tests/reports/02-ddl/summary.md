# 02-ddl

**20 MATCH / 0 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | POST /_d_new (SHORT type) | POST | 200 | 200 | MATCH |
| 02 | POST /_d_new (NUMBER type) | POST | 200 | 200 | MATCH |
| 03 | POST /_d_new (DATE type) | POST | 200 | 200 | MATCH |
| 04 | POST /_d_new (duplicate name) | POST | 200 | 200 | MATCH |
| 05 | POST /_d_new (unique=1) | POST | 200 | 200 | MATCH |
| 06 | POST /_d_new (empty name) | POST | 200 | 200 | MATCH |
| 07 | POST /_d_save (rename) | POST | 200 | 200 | MATCH |
| 08 | POST /_d_save (unique=1) | POST | 200 | 200 | MATCH |
| 09 | POST /_d_req (text column) | POST | 200 | 200 | MATCH |
| 10 | POST /_d_req (number column) | POST | 200 | 200 | MATCH |
| 11 | POST /_d_ref (reference column) | POST | 200 | 200 | MATCH |
| 12 | POST /_d_null (required=1) | POST | 200 | 200 | MATCH |
| 13 | POST /_d_multi (multi=1) | POST | 200 | 200 | MATCH |
| 14 | POST /_d_up | POST | 200 | 200 | MATCH |
| 15 | POST /_d_ord (order=1) | POST | 200 | 200 | MATCH |
| 16 | POST /_d_alias | POST | 200 | 200 | MATCH |
| 17 | POST /_d_attrs | POST | 200 | 200 | MATCH |
| 18 | POST /_d_del_req | POST | 200 | 200 | MATCH |
| 19 | POST /_d_del (empty type) | POST | 200 | 200 | MATCH |
| 20 | POST /_d_del (non-existent) | POST | 200 | 200 | MATCH |
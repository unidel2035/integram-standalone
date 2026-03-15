# 09-tables-crud — Table CRUD

22 MATCH / 3 DIFF out of 25 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_new (basic type) | 200 | 200 | DIFF: val[warnings]: PHP="Тип __tbl_verify___ID__ уже существует!... Node="" |
| 2 | #2 POST /_d_new (LONG base) | 200 | 200 | DIFF: val[warnings]: PHP="Тип __tbl_long___ID__ уже существует!" Node="" |
| 3 | #3 POST /_d_new (empty name) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_new (subordinate) | 200 | 200 | DIFF: val[warnings]: PHP="Тип __tbl_sub___ID__ уже существует!" Node="" |
| 5 | #5 POST /_d_req (SHORT col) | 200 | 200 | MATCH |
| 6 | #6 POST /_d_req (NUMBER col) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_req (DATE col) | 200 | 200 | MATCH |
| 8 | #8 POST /_d_req (BOOL col) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_req (LONG col) | 200 | 200 | MATCH |
| 10 | #10 POST /_d_alias (set name) | 200 | 200 | MATCH |
| 11 | #11 POST /_d_attrs | 200 | 200 | MATCH |
| 12 | #12 POST /_d_null (toggle ON) | 200 | 200 | MATCH |
| 13 | #13 POST /_d_null (toggle OFF) | 200 | 200 | MATCH |
| 14 | #14 POST /_d_multi (toggle ON) | 200 | 200 | MATCH |
| 15 | #15 POST /_d_up (move col up) | 200 | 200 | MATCH |
| 16 | #16 POST /_d_ref (add ref col) | 200 | 200 | MATCH |
| 17 | #17 GET /metadata (single type) | 200 | 200 | MATCH |
| 18 | #18 GET /edit_types | 200 | 200 | MATCH |
| 19 | #19 GET /terms | 200 | 200 | MATCH |
| 20 | #20 GET /dict?JSON=1 | 200 | 200 | MATCH |
| 21 | #21 POST /_d_save (rename type) | 200 | 200 | MATCH |
| 22 | #22 POST /_d_del_req (delete col) | 200 | 200 | MATCH |
| 23 | #23 POST /_d_del_req (non-existent) | 200 | 200 | MATCH |
| 24 | #24 POST /_d_del (empty type) | 200 | 200 | MATCH |
| 25 | #25 POST /_d_del (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### #1 POST /_d_new (basic type)

- val[warnings]: PHP="Тип __tbl_verify___ID__ уже существует!... Node=""
- PHP: `{"id":"","obj":"1000010782","next_act":"edit_types","args":"ext","warnings":"Тип __tbl_verify_1773584401016 уже существует!"}`
- Node: `{"args":"ext","id":"","next_act":"edit_types","obj":1000010782,"warnings":""}`

### #2 POST /_d_new (LONG base)

- val[warnings]: PHP="Тип __tbl_long___ID__ уже существует!" Node=""
- PHP: `{"id":"","obj":"1000010783","next_act":"edit_types","args":"ext","warnings":"Тип __tbl_long_1773584401016 уже существует!"}`
- Node: `{"args":"ext","id":"","next_act":"edit_types","obj":1000010783,"warnings":""}`

### #4 POST /_d_new (subordinate)

- val[warnings]: PHP="Тип __tbl_sub___ID__ уже существует!" Node=""
- PHP: `{"id":"","obj":"1000010784","next_act":"edit_types","args":"ext","warnings":"Тип __tbl_sub_1773584401016 уже существует!"}`
- Node: `{"args":"ext","id":"","next_act":"edit_types","obj":1000010784,"warnings":""}`

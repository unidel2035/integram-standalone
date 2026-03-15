# 02-ddl — Type/Column DDL

17 MATCH / 3 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_d_new (SHORT type) | 200 | 200 | MATCH |
| 2 | POST /_d_new (NUMBER type) | 200 | 200 | MATCH |
| 3 | POST /_d_new (DATE type) | 200 | 200 | MATCH |
| 4 | POST /_d_new (duplicate name) | 200 | 200 | MATCH |
| 5 | POST /_d_new (unique=1) | 200 | 200 | MATCH |
| 6 | POST /_d_new (empty name) | 200 | 200 | MATCH |
| 7 | POST /_d_save (rename) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 8 | POST /_d_save (unique=1) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 9 | POST /_d_req (text column) | 200 | 200 | MATCH |
| 10 | POST /_d_req (number column) | 200 | 200 | MATCH |
| 11 | POST /_d_ref (reference column) | 200 | 200 | MATCH |
| 12 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 13 | POST /_d_multi (multi=1) | 200 | 200 | MATCH |
| 14 | POST /_d_up | 200 | 200 | MATCH |
| 15 | POST /_d_ord (order=1) | 200 | 200 | MATCH |
| 16 | POST /_d_alias | 200 | 200 | MATCH |
| 17 | POST /_d_attrs | 200 | 200 | MATCH |
| 18 | POST /_d_del_req | 200 | 200 | DIFF: keys: PHP=[args,id,next_act,obj,warnings] Node=[error] |
| 19 | POST /_d_del (empty type) | 200 | 200 | MATCH |
| 20 | POST /_d_del (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### POST /_d_save (rename)

- type: PHP=object Node=array
- PHP: `{"id":1000006101,"obj":1000006101,"next_act":"edit_types","args":"ext","warnings":""}`
- Node: `[{"args":"ext","id":1000006101,"next_act":"edit_types","obj":1000006101,"warnings":""}]`

### POST /_d_save (unique=1)

- type: PHP=object Node=array
- PHP: `{"id":1000006101,"obj":1000006101,"next_act":"edit_types","args":"ext","warnings":""}`
- Node: `[{"args":"ext","id":1000006101,"next_act":"edit_types","obj":1000006101,"warnings":""}]`

### POST /_d_del_req

- keys: PHP=[args,id,next_act,obj,warnings] Node=[error]
- val[args]: PHP="ext" Node=
- val[id]: PHP="__ID__" Node=
- val[next_act]: PHP="edit_types" Node=
- PHP: `{"id":"1000006101","obj":"1000006101","next_act":"edit_types","args":"ext","warnings":""}`
- Node: `{"error":"Requisite not found"}`

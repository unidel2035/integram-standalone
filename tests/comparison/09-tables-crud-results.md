# 09-tables-crud — Table CRUD

19 MATCH / 6 DIFF out of 25 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_new (basic type) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_new (LONG base) | 200 | 200 | DIFF: val[warnings]: PHP="Тип __tbl_long_1773575832626 уже сущест... Node="" |
| 3 | #3 POST /_d_new (empty name) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_new (subordinate) | 200 | 200 | DIFF: val[warnings]: PHP="Тип __tbl_sub_1773575832626 уже существ... Node="" |
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
| 17 | #17 GET /metadata (single type) | 200 | 200 | DIFF: keys: PHP=[id,reqs,type,unique,up,val] Node=[&main.&top_menu,&main.myrolemenu] |
| 18 | #18 GET /edit_types | 200 | 200 | MATCH |
| 19 | #19 GET /terms | 200 | 200 | MATCH |
| 20 | #20 GET /dict?JSON=1 | 200 | 200 | MATCH |
| 21 | #21 POST /_d_save (rename type) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 22 | #22 POST /_d_del_req (delete col) | 200 | 200 | DIFF: val[obj]: PHP="__ID__" Node=null |
| 23 | #23 POST /_d_del_req (non-existent) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 24 | #24 POST /_d_del (empty type) | 200 | 200 | MATCH |
| 25 | #25 POST /_d_del (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### #2 POST /_d_new (LONG base)

- val[warnings]: PHP="Тип __tbl_long_1773575832626 уже сущест... Node=""
- PHP: `{"id":"","obj":"1000005704","next_act":"edit_types","args":"ext","warnings":"Тип __tbl_long_1773575832626 уже существует!"}`
- Node: `{"args":"ext","id":"","next_act":"edit_types","obj":1000005704,"warnings":""}`

### #4 POST /_d_new (subordinate)

- val[warnings]: PHP="Тип __tbl_sub_1773575832626 уже существ... Node=""
- PHP: `{"id":"","obj":"1000005705","next_act":"edit_types","args":"ext","warnings":"Тип __tbl_sub_1773575832626 уже существует!"}`
- Node: `{"args":"ext","id":"","next_act":"edit_types","obj":1000005705,"warnings":""}`

### #17 GET /metadata (single type)

- keys: PHP=[id,reqs,type,unique,up,val] Node=[&main.&top_menu,&main.myrolemenu]
- val[id]: PHP="__ID__" Node=
- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"10000057... Node=
- val[type]: PHP="3" Node=
- PHP: `{"id":"1000005701","up":"0","type":"3","val":"__tbl_basic_1773575832626","unique":"0","reqs":[{"num":1,"id":"1000005707","val":"__sys_bt11_17735758327...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### #21 POST /_d_save (rename type)

- type: PHP=array Node=object
- PHP: `[{"error":"Неверный базовый тип (0) "}]`
- Node: `{"args":"ext","id":1000005701,"next_act":"edit_types","obj":1000005701,"warnings":""}`

### #22 POST /_d_del_req (delete col)

- val[obj]: PHP="__ID__" Node=null
- PHP: `{"id":"1000005701","obj":"1000005701","next_act":"edit_types","args":"ext","warnings":""}`
- Node: `{"args":"ext","id":1000005701,"next_act":"edit_types","obj":null,"warnings":""}`

### #23 POST /_d_del_req (non-existent)

- type: PHP=object Node=array
- PHP: `{"id":999999999,"obj":null,"next_act":"edit_types","args":"ext","warnings":""}`
- Node: `[{"error":"Requisite not found"}]`

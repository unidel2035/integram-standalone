# 04-listing — Listing & Querying

2 MATCH / 17 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | DIFF: length: PHP=5 Node=0 |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 4 | GET /object/:type (empty) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 9 | GET /object?order_val=val | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 10 | GET /object?desc=1 | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 11 | GET /edit_obj/:id | 200 | 200 | DIFF: type: PHP=object Node=array |
| 12 | GET /edit_types | 200 | 200 | DIFF: keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.&top_menu,&main.a.&editables,&main.a.&types,&main.myro...] |
| 13 | GET /obj_meta/:type | 200 | 200 | DIFF: val[up]: PHP="0" Node="1" |
| 14 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 15 | GET /_list/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | GET /_list?q=Alpha | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 18 | GET /_list_join/:type | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 19 | POST / action=object | 200 | 200 | MATCH |

## Diffs Detail

### GET /object/:type?JSON=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object/:type?JSON_DATA

- length: PHP=5 Node=0
- PHP: `[{"i":1000004045,"u":1,"o":1,"r":["Alpha"]},{"i":1000004046,"u":1,"o":1,"r":["Beta"]},{"i":1000004047,"u":1,"o":1,"r":["Gamma"]},{"i":1000004048,"u":1...`
- Node: `[]`

### GET /object/:type?LIMIT=2

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object/:type (empty)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_empty... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_empty_1773535069115"]},"type":{"id":1000004050,"up":1,"val":"__lst_empty_1773535069115","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__lst_empty_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fil...`

### GET /object?F_U=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["1"],"fil...`

### GET /object?F_U=0

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":["0"],"fil...`

### GET /object?F_I=id

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?F_{type}=Alpha

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?order_val=val

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?desc=1

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[type]: PHP={"id":"__ID__","up":1,"val":"__lst_main_... Node={"base":"SHORT","id":"__ID__","up":1,"va...
- val[base]: PHP={"id":"__ID__","unique":""} Node={"id":"__ID__","unique":"unique"}
- val[&main.a.&uni_obj]: PHP={"create_granted":["block"],"id":["10000... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"type":{"id":1000004040,"up":1,"val":"__lst_main_1773535069115","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773535069115"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filt...`

### GET /edit_obj/:id

- type: PHP=object Node=array
- PHP: `{"obj":{"id":"1000004045","val":"Alpha","parent":"1","typ":"1000004040","typ_name":"__lst_main_1773535069115","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `[{"error":"typeId required: /my/edit_obj/{id}?JSON"}]`

### GET /edit_types

- keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.&top_menu,&main.a.&editables,&main.a.&types,&main.myro...]
- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.a.&editables":{"ok":[""]},"&m...`

### GET /obj_meta/:type

- val[up]: PHP="0" Node="1"
- val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}}
- PHP: `{"id":"1000004040","up":"0","type":"3","val":"__lst_main_1773535069115","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `{"id":"1000004041","reqs":{"":{"id":"","type":"","val":""}},"type":"3","up":"1","val":"__lst_main_1773535069115"}`

### GET /_list/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"total":0}`

### GET /_list?q=Alpha

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"total":0}`

### GET /_list?LIMIT=2

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":2,"offset":0,"total":0}`

### GET /_list_join/:type

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"data":[],"limit":50,"offset":0,"requisites":[],"total":0}`

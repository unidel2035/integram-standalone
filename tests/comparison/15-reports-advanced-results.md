# 15-reports-advanced — Report CRUD & Execution

10 MATCH / 10 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object/22 (report list) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
| 2 | #2 GET /edit_types | 200 | 200 | MATCH |
| 3 | #3 POST /_m_new/22 (create report) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_obj (new report) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 5 | #5 POST /_m_new/44 (add FROM) | 200 | 200 | DIFF: val[val]: PHP="__rpt_data_1773575879858" Node="__ORD__" |
| 6 | #6 POST /_m_new/28 (add val column) | 200 | 200 | DIFF: val[val]: PHP="__rpt_data_1773575879858 -&gt; Backend ... Node="__ORD__" |
| 7 | #7 POST /_m_new/28 (add num column) | 200 | 200 | DIFF: val[val]: PHP="__rpt_data_1773575879858 -&gt; __sys_bt... Node="__ORD__" |
| 8 | #8 POST /_m_new/28 (add date column) | 200 | 200 | DIFF: val[val]: PHP="__rpt_data_1773575879858 -&gt; __sys_bt... Node="__ORD__" |
| 9 | #9 GET /edit_obj (report with columns) | 200 | 200 | DIFF: keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...] |
| 10 | #10 POST /_m_save (set execute flag) | 200 | 200 | MATCH |
| 11 | #11 GET /report (execute JSON) | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=2) | 200 | 200 | MATCH |
| 13 | #13 GET /report (pg=2, LIMIT=2) | 200 | 200 | MATCH |
| 14 | #14 GET /report (CSV) | 200 | 200 | MATCH |
| 15 | #15 GET /metadata (report) | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | #16 GET /object/28 (report columns) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 17 | #17 POST /_m_save (rename report) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_del (delete report) | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (deleted report) | 200 | 404 | DIFF: status: PHP=200 Node=404 |
| 20 | #20 GET /report (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### #1 GET /object/22 (report list)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&object_reqs]: PHP={"169":["<A HREF=\"/my/object/28/?F_U=16... Node={"169":["<A HREF=\"/my/object/28/?F_U=16...
- val[reqs]: PHP={"169":{"28":6,"111":"***"},"187":{"28":... Node={"169":{"28":6},"187":{"28":2},"217":{"2...
- PHP: `{"&main.a":{"_parent_.title":["Query"]},"type":{"id":22,"up":1,"val":"Query","base":"SHORT"},"base":{"id":"3","unique":""},"&main.a.&uni_obj":{"create...`
- Node: `{"&main.a":{"_parent_.title":["Query"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":["...`

### #4 GET /edit_obj (new report)

- keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&buttons]: PHP={"attrs":["report/1000005932"],"val":["R... Node=
- val[&main.a.&object.&object_reqs.&editreq_array]: PHP={"_parent_.arr_num":["0","0","0"],"_pare... Node={"_parent_.arr_num":["0","0","0"],"_pare...
- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...
- PHP: `{"obj":{"id":"1000005932","val":"__rpt_report_1773575879858","parent":"1","typ":"22","typ_name":"Query","base_typ":"3"},"&main.a.&object":{"typ":["22"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005933"],"typ":["22","22"],"typ_name":["Query","Query"],"up":["1"],"val":["__rpt_report_1773575879858",...`

### #5 POST /_m_new/44 (add FROM)

- val[val]: PHP="__rpt_data_1773575879858" Node="__ORD__"
- PHP: `{"id":1000005935,"obj":1000005935,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"__rpt_data_1773575879858"}`
- Node: `{"args":"new1=1&","id":1000005934,"next_act":"edit_obj","obj":1000005934,"ord":1,"val":"1000005903"}`

### #6 POST /_m_new/28 (add val column)

- val[val]: PHP="__rpt_data_1773575879858 -&gt; Backend ... Node="__ORD__"
- PHP: `{"id":1000005937,"obj":1000005937,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"__rpt_data_1773575879858 -&gt; Backend Health Config"}`
- Node: `{"args":"new1=1&","id":1000005936,"next_act":"edit_obj","obj":1000005936,"ord":1,"val":"1000005904"}`

### #7 POST /_m_new/28 (add num column)

- val[val]: PHP="__rpt_data_1773575879858 -&gt; __sys_bt... Node="__ORD__"
- PHP: `{"id":1000005939,"obj":1000005939,"ord":2,"next_act":"edit_obj","args":"new1=1&","val":"__rpt_data_1773575879858 -&gt; __sys_bt11_1773575868629"}`
- Node: `{"args":"new1=1&","id":1000005938,"next_act":"edit_obj","obj":1000005938,"ord":2,"val":"1000005905"}`

### #8 POST /_m_new/28 (add date column)

- val[val]: PHP="__rpt_data_1773575879858 -&gt; __sys_bt... Node="__ORD__"
- PHP: `{"id":1000005940,"obj":1000005940,"ord":3,"next_act":"edit_obj","args":"new1=1&","val":"__rpt_data_1773575879858 -&gt; __sys_bt4_1773575868616"}`
- Node: `{"args":"new1=1&","id":1000005941,"next_act":"edit_obj","obj":1000005941,"ord":3,"val":"1000005906"}`

### #9 GET /edit_obj (report with columns)

- keys: PHP=[&main.a.&object,&main.a.&object.&buttons,&main.a.&object.&ed...] Node=[&main.a.&object,&main.a.&object.&edit_req,&main.a.&object.&o...]
- val[&main.a.&object.&buttons]: PHP={"attrs":["report/1000005932"],"val":["R... Node=
- val[&main.a.&object.&object_reqs.&editreq_array]: PHP={"_parent_.arr_num":["3","0","1"],"_pare... Node={"_parent_.arr_num":["3","0","1"],"_pare...
- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...
- PHP: `{"obj":{"id":"1000005932","val":"__rpt_report_1773575879858","parent":"1","typ":"22","typ_name":"Query","base_typ":"3"},"&main.a.&object":{"typ":["22"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000005933"],"typ":["22","22"],"typ_name":["Query","Query"],"up":["1"],"val":["__rpt_report_1773575879858",...`

### #15 GET /metadata (report)

- format: PHP=text Node=JSON
- PHP: `Invalid Term id 1000005932`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### #16 GET /object/28 (report columns)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["16"],"create_granted":["bl... Node={"base_typ":["16"],"create_granted":["bl...
- val[&main.a.&uni_obj.&head_ord]: PHP={"filler":[""]} Node=
- val[&main.a.&uni_obj.&head_ord_n]: PHP={"filler":[""]} Node=
- PHP: `{"&main.a":{"_parent_.title":["Query fields"]},"type":{"id":28,"up":1000005932,"val":"Query fields","base":"REPORT_COLUMN"},"base":{"id":"16","unique"...`
- Node: `{"&main.a":{"_parent_.title":["Query fields"]},"&main.a._noobj":{"_request_.f_u":["1000005933"]},"&main.a.&uni_obj":{"base_typ":["16"],"create_granted...`

### #19 GET /edit_obj (deleted report)

- status: PHP=200 Node=404
- format: PHP=text Node=JSON
- PHP: `Объект 1000005932 не найден, вероятно, он был удален`
- Node: `[{"error":"Object not found"}]`

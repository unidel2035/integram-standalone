# 15-reports-advanced — Report CRUD & Execution

14 MATCH / 6 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object/22 (report list) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L... |
| 2 | #2 GET /edit_types | 200 | 200 | MATCH |
| 3 | #3 POST /_m_new/22 (create report) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_obj (new report) | 200 | 200 | DIFF: val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"... |
| 5 | #5 POST /_m_new/44 (add FROM) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_new/28 (add val column) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_new/28 (add num column) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_new/28 (add date column) | 200 | 200 | MATCH |
| 9 | #9 GET /edit_obj (report with columns) | 200 | 200 | DIFF: val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"... |
| 10 | #10 POST /_m_save (set execute flag) | 200 | 200 | MATCH |
| 11 | #11 GET /report (execute JSON) | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=2) | 200 | 200 | MATCH |
| 13 | #13 GET /report (pg=2, LIMIT=2) | 200 | 200 | MATCH |
| 14 | #14 GET /report (CSV) | 200 | 200 | MATCH |
| 15 | #15 GET /metadata (report) | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | #16 GET /object/28 (report columns) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 17 | #17 POST /_m_save (rename report) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_del (delete report) | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (deleted report) | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 20 | #20 GET /report (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### #1 GET /object/22 (report list)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT","L... Node={"align":["LEFT","LEFT","LEFT","LEFT","L...
- val[&object_reqs]: PHP={"169":["<A HREF=\"/my/object/28/?F_U=16... Node={"169":["<A HREF=\"/my/object/28/?F_U=16...
- PHP: `{"&main.a":{"_parent_.title":["Query"]},"type":{"id":22,"up":1,"val":"Query","base":"SHORT"},"base":{"id":"3","unique":""},"&main.a.&uni_obj":{"create...`
- Node: `{"&main.a":{"_parent_.title":["Query"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":["...`

### #4 GET /edit_obj (new report)

- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...
- PHP: `{"obj":{"id":"1000010950","val":"__rpt_report_1773584403927","parent":"1","typ":"22","typ_name":"Query","base_typ":"3"},"&main.a.&object":{"typ":["22"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000010951"],"typ":["22","22"],"typ_name":["Query","Query"],"up":["1"],"val":["__rpt_report_1773584403927",...`

### #9 GET /edit_obj (report with columns)

- val[reqs]: PHP={"97":{"base":"CHARS","order":"4","type"... Node={"97":{"base":"CHARS","order":"4","type"...
- PHP: `{"obj":{"id":"1000010950","val":"__rpt_report_1773584403927","parent":"1","typ":"22","typ_name":"Query","base_typ":"3"},"&main.a.&object":{"typ":["22"...`
- Node: `{"&main.a.&object":{"disabled":[""],"id":["1000010951"],"typ":["22","22"],"typ_name":["Query","Query"],"up":["1"],"val":["__rpt_report_1773584403927",...`

### #15 GET /metadata (report)

- format: PHP=text Node=JSON
- PHP: `Invalid Term id 1000010950`
- Node: `{"id":"1000010951","reqs":[{"arr_id":"28","attrs":"1000010907","id":"1000010955","num":1,"orig":"28","type":"16","val":"Query fields"},{"arr_id":"44",...`

### #16 GET /object/28 (report columns)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj.&new_req_report_column]: PHP={"_parent_.typ":["28"],"new_req":[""]} Node=
- val[&main.a.&uni_obj.&new_req_report_column.&rep_col_list]: PHP={"id":["__ID__","__ID__","__ID__","__ID_... Node=
- val[&main.a.&uni_obj.&uni_obj_all]: PHP={"align":["LEFT","LEFT","LEFT"],"id":["_... Node={"align":["LEFT","LEFT","LEFT"],"id":["_...
- PHP: `{"&main.a":{"_parent_.title":["Query fields"]},"type":{"id":28,"up":1000010950,"val":"Query fields","base":"REPORT_COLUMN"},"base":{"id":"16","unique"...`
- Node: `{"&main.a":{"_parent_.title":["Query fields"]},"&main.a._noobj":{"_request_.f_u":["1000010951"]},"&main.a.&uni_obj":{"base_typ":["16"],"create_granted...`

### #19 GET /edit_obj (deleted report)

- format: PHP=text Node=JSON
- PHP: `Объект 1000010950 не найден, вероятно, он был удален`
- Node: `{}`

# 18-column-metadata — Column Metadata Operations

17 MATCH / 2 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_alias (set alias) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_alias (number alias) | 200 | 200 | MATCH |
| 3 | #3 POST /_d_alias (clear alias) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_alias (set again) | 200 | 200 | MATCH |
| 5 | #5 POST /_d_null (set NOT NULL) | 200 | 200 | MATCH |
| 6 | #6 POST /_d_null (toggle off) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_multi (set MULTI) | 200 | 200 | MATCH |
| 8 | #8 POST /_d_multi (toggle off) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_ord (move to pos 1) | 200 | 200 | MATCH |
| 10 | #10 GET /metadata (after reorder) | 200 | 200 | MATCH |
| 11 | #11 POST /_d_up (move col up) | 200 | 200 | MATCH |
| 12 | #12 GET /metadata (after move up) | 200 | 200 | MATCH |
| 13 | #13 POST /_d_attrs (set attrs) | 200 | 200 | MATCH |
| 14 | #14 POST /_d_attrs (clear attrs) | 200 | 200 | MATCH |
| 15 | #15 POST /_d_del_req (delete column) | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after delete col) | 200 | 200 | DIFF: val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"attrs":":ALIAS=Стоимость::ALIAS=Price... |
| 17 | #17 POST /_d_del_req (already deleted) | 200 | 200 | MATCH |
| 18 | #18 GET /edit_types (full state) | 200 | 200 | MATCH |
| 19 | #19 GET /metadata (final) | 200 | 200 | DIFF: val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"attrs":":ALIAS=Стоимость::ALIAS=Price... |

## Diffs Detail

### #16 GET /metadata (after delete col)

- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"attrs":":ALIAS=Стоимость::ALIAS=Price...
- PHP: `{"id":"1000031716","up":"0","type":"3","val":"__colm_tasks_1773722658906","unique":"0","reqs":[{"num":1,"id":"1000031722","val":"__sys_bt13_1773722657...`
- Node: `{"id":"1000031717","reqs":[{"attrs":":ALIAS=Стоимость::ALIAS=Price:","id":"1000031723","num":1,"orig":"1000031697","type":"13","val":"__sys_bt13_17737...`

### #19 GET /metadata (final)

- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"attrs":":ALIAS=Стоимость::ALIAS=Price...
- PHP: `{"id":"1000031716","up":"0","type":"3","val":"__colm_tasks_1773722658906","unique":"0","reqs":[{"num":1,"id":"1000031722","val":"__sys_bt13_1773722657...`
- Node: `{"id":"1000031717","reqs":[{"attrs":":ALIAS=Стоимость::ALIAS=Price:","id":"1000031723","num":1,"orig":"1000031697","type":"13","val":"__sys_bt13_17737...`

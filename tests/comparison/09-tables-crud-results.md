# 09-tables-crud — Table CRUD

24 MATCH / 1 DIFF out of 25 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_new (basic type) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_new (LONG base) | 200 | 200 | MATCH |
| 3 | #3 POST /_d_new (empty name) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_new (subordinate) | 200 | 200 | MATCH |
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
| 17 | #17 GET /metadata (single type) | 200 | 200 | DIFF: val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"id":"__ID__","num":1,"orig":"__ID__",... |
| 18 | #18 GET /edit_types | 200 | 200 | MATCH |
| 19 | #19 GET /terms | 200 | 200 | MATCH |
| 20 | #20 GET /dict?JSON=1 | 200 | 200 | MATCH |
| 21 | #21 POST /_d_save (rename type) | 200 | 200 | MATCH |
| 22 | #22 POST /_d_del_req (delete col) | 200 | 200 | MATCH |
| 23 | #23 POST /_d_del_req (non-existent) | 200 | 200 | MATCH |
| 24 | #24 POST /_d_del (empty type) | 200 | 200 | MATCH |
| 25 | #25 POST /_d_del (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### #17 GET /metadata (single type)

- val[reqs]: PHP=[{"id":"__ID__","num":1,"orig":"__ID__",... Node=[{"id":"__ID__","num":1,"orig":"__ID__",...
- PHP: `{"id":"1000031246","up":"0","type":"3","val":"__tbl_basic_1773722635400","unique":"0","reqs":[{"num":1,"id":"1000031255","val":"__sys_bt13_17737226244...`
- Node: `{"id":"1000031245","reqs":[{"id":"1000031256","num":1,"orig":"1000031202","type":"13","val":"__sys_bt13_1773722624420"},{"attrs":":ALIAS=Тестовое поле...`

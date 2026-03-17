# 44-d-req-attrs-ord — Column Creation & Modifiers

26 MATCH / 2 DIFF out of 28 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_req (add SHORT col) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_req (add NUMBER col) | 200 | 200 | MATCH |
| 3 | #3 POST /_d_req (add LONG col) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_req (add DATETIME col) | 200 | 200 | MATCH |
| 5 | #5 POST /_d_req (add REF col) | 200 | 200 | MATCH |
| 6 | #6 GET /metadata (after _d_req) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_req (nonexistent type) | 200 | 200 | MATCH |
| 8 | #8 POST /_d_req (nonexistent parent) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_req (duplicate SHORT) | 200 | 200 | MATCH |
| 10 | #10 POST /_d_ref (create ref) | 200 | 200 | MATCH |
| 11 | #11 POST /_d_ref (idempotent) | 200 | 200 | MATCH |
| 12 | #12 POST /_d_ref (nonexistent) | 200 | 200 | MATCH |
| 13 | #13 POST /_d_attrs (alias+required) | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (after _d_attrs) | 200 | 200 | DIFF: val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI::ALI... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев... |
| 15 | #15 POST /_d_attrs (multi=1) | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after multi) | 200 | 200 | DIFF: val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI:","i... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев... |
| 17 | #17 POST /_d_attrs (clear alias) | 200 | 200 | MATCH |
| 18 | #18 POST /_d_attrs (nonexistent col) | 200 | 404 | MATCH |
| 19 | #19 GET /metadata (before _d_ord) | 200 | 200 | MATCH |
| 20 | #20 POST /_d_ord (col3 → ord=1) | 200 | 200 | MATCH |
| 21 | #21 GET /metadata (after _d_ord) | 200 | 200 | MATCH |
| 22 | #22 POST /_d_ord (col1 → ord=3) | 200 | 200 | MATCH |
| 23 | #23 GET /metadata (after second _d_ord) | 200 | 200 | MATCH |
| 24 | #24 POST /_d_ord (nonexistent col) | 200 | 200 | MATCH |
| 25 | #25 POST /_d_req (with alias) | 200 | 200 | MATCH |
| 26 | #26 POST /_d_req (with required) | 200 | 200 | MATCH |
| 27 | #27 POST /_d_req (ref+multiselect) | 200 | 200 | MATCH |
| 28 | #28 GET /metadata (with modifiers) | 200 | 200 | MATCH |

## Diffs Detail

### #14 GET /metadata (after _d_attrs)

- val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI::ALI... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев...
- PHP: `{"id":"1000032407","up":"0","type":"3","val":"__dreq_attrs_1773722707977","unique":"0","reqs":[{"num":1,"id":"1000032409","val":"__bulk_item_177372270...`
- Node: `{"id":"1000032408","reqs":[{"arr_id":"1000032301","attrs":":ALIAS=Псевдоним::!NULL:","id":"1000032410","num":1,"orig":"1000032301","type":"3","val":"_...`

### #16 GET /metadata (after multi)

- val[reqs]: PHP=[{"arr_id":"__ID__","attrs":":MULTI:","i... Node=[{"arr_id":"__ID__","attrs":":ALIAS=Псев...
- PHP: `{"id":"1000032407","up":"0","type":"3","val":"__dreq_attrs_1773722707977","unique":"0","reqs":[{"num":1,"id":"1000032409","val":"__bulk_item_177372270...`
- Node: `{"id":"1000032408","reqs":[{"arr_id":"1000032301","attrs":":ALIAS=Псевдоним::MULTI:","id":"1000032410","num":1,"orig":"1000032301","type":"3","val":"_...`

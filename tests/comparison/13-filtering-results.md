# 13-filtering — Filtering, Sorting, Pagination

0 MATCH / 28 DIFF out of 28 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (all products) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 2 | #2 GET /object (LIMIT=3) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 3 | #3 GET /object (pg=2, LIMIT=3) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 4 | #4 GET /object (pg=3, LIMIT=3) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 5 | #5 GET /object (LIMIT=0 count) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 6 | #6 GET /object (F_T val=iPhone) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 7 | #7 GET /object (F_T val=Мол) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 8 | #8 GET /object (F_T val=ZZZZZ) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 9 | #9 GET /object (F_T on req field) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 10 | #10 GET /object (F_I ref=Electronics) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 11 | #11 GET /object (F_I bool=1) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 12 | #12 GET /object (F_I bool=0) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 13 | #13 GET /object (F_I text exact) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 14 | #14 GET /object (F_I + LIMIT=2) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 15 | #15 GET /object (sort val ASC) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 16 | #16 GET /object (sort val DESC) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 17 | #17 GET /object (sort by price) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 18 | #18 GET /object (sort by date DESC) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 19 | #19 GET /object (F_I + sort) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 20 | #20 GET /object (F_I + sort + LIMIT=2) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 21 | #21 GET /object (F_I cat + F_I active) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 22 | #22 GET /object (F_T + F_I) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 23 | #23 GET /object (pg=100, beyond data) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 24 | #24 GET /object (LIMIT=1) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 25 | #25 GET /object (LIMIT=1000) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 26 | #26 GET /object (F_I non-existent ref) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 27 | #27 GET /object (F_T empty) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 28 | #28 GET /object (F_T on LONG field) | 500 | 200 | DIFF: status: PHP=500 Node=200 |

## Diffs Detail

### #1 GET /object (all products)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #2 GET /object (LIMIT=3)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #3 GET /object (pg=2, LIMIT=3)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #4 GET /object (pg=3, LIMIT=3)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #5 GET /object (LIMIT=0 count)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #6 GET /object (F_T val=iPhone)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #7 GET /object (F_T val=Мол)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #8 GET /object (F_T val=ZZZZZ)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #9 GET /object (F_T on req field)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #10 GET /object (F_I ref=Electronics)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #11 GET /object (F_I bool=1)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #12 GET /object (F_I bool=0)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #13 GET /object (F_I text exact)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #14 GET /object (F_I + LIMIT=2)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #15 GET /object (sort val ASC)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #16 GET /object (sort val DESC)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #17 GET /object (sort by price)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #18 GET /object (sort by date DESC)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #19 GET /object (F_I + sort)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #20 GET /object (F_I + sort + LIMIT=2)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #21 GET /object (F_I cat + F_I active)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #22 GET /object (F_T + F_I)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #23 GET /object (pg=100, beyond data)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #24 GET /object (LIMIT=1)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #25 GET /object (LIMIT=1000)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #26 GET /object (F_I non-existent ref)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #27 GET /object (F_T empty)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- val[&main.a.&uni_obj.&filter_val_rcm]: PHP={"f_typ":["F_1000006314"],"filter":[""]} Node={"f_typ":["F_1000006315"],"filter":[""]}
- val[&main.a.&uni_obj.&new_req]: PHP={"_parent_.typ":["1000006314"],"_parent_... Node={"_parent_.typ":["1000006315"],"_parent_...
- PHP: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"type":{"id":1000006314,"up":1,"val":"__flt_products_1773579362764","base":"SHORT"},"ba...`
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #28 GET /object (F_T on LONG field)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773579362764"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

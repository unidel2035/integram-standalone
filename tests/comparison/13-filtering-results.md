# 13-filtering — Filtering, Sorting, Pagination

13 MATCH / 15 DIFF out of 28 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object (all products) | 200 | 200 | MATCH |
| 2 | #2 GET /object (LIMIT=3) | 200 | 200 | MATCH |
| 3 | #3 GET /object (pg=2, LIMIT=3) | 200 | 200 | MATCH |
| 4 | #4 GET /object (pg=3, LIMIT=3) | 200 | 200 | MATCH |
| 5 | #5 GET /object (LIMIT=0 count) | 200 | 200 | MATCH |
| 6 | #6 GET /object (F_T val=iPhone) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 7 | #7 GET /object (F_T val=Мол) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 8 | #8 GET /object (F_T val=ZZZZZ) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 9 | #9 GET /object (F_T on req field) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 10 | #10 GET /object (F_I ref=Electronics) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 11 | #11 GET /object (F_I bool=1) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 12 | #12 GET /object (F_I bool=0) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 13 | #13 GET /object (F_I text exact) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 14 | #14 GET /object (F_I + LIMIT=2) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 15 | #15 GET /object (sort val ASC) | 200 | 200 | MATCH |
| 16 | #16 GET /object (sort val DESC) | 200 | 200 | MATCH |
| 17 | #17 GET /object (sort by price) | 200 | 200 | MATCH |
| 18 | #18 GET /object (sort by date DESC) | 200 | 200 | MATCH |
| 19 | #19 GET /object (F_I + sort) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 20 | #20 GET /object (F_I + sort + LIMIT=2) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 21 | #21 GET /object (F_I cat + F_I active) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 22 | #22 GET /object (F_T + F_I) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 23 | #23 GET /object (pg=100, beyond data) | 200 | 200 | MATCH |
| 24 | #24 GET /object (LIMIT=1) | 200 | 200 | MATCH |
| 25 | #25 GET /object (LIMIT=1000) | 200 | 200 | MATCH |
| 26 | #26 GET /object (F_I non-existent ref) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 27 | #27 GET /object (F_T empty) | 200 | 200 | MATCH |
| 28 | #28 GET /object (F_T on LONG field) | 500 | 200 | DIFF: status: PHP=500 Node=200 |

## Diffs Detail

### #6 GET /object (F_T val=iPhone)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #7 GET /object (F_T val=Мол)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #8 GET /object (F_T val=ZZZZZ)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #9 GET /object (F_T on req field)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

### #10 GET /object (F_I ref=Electronics)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #11 GET /object (F_I bool=1)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #12 GET /object (F_I bool=0)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #13 GET /object (F_I text exact)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #14 GET /object (F_I + LIMIT=2)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #19 GET /object (F_I + sort)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #20 GET /object (F_I + sort + LIMIT=2)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #21 GET /object (F_I cat + F_I active)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #22 GET /object (F_T + F_I)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #26 GET /object (F_I non-existent ref)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":["NaN"],"f_u":[""...`

### #28 GET /object (F_T on LONG field)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `{"&main.a":{"_parent_.title":["__flt_products_1773589822056"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"...`

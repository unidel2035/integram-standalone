# 12-subordinates — Подчинённости

24 MATCH / 3 DIFF out of 27 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /metadata (parent type) | 200 | 200 | MATCH |
| 2 | #2 GET /metadata (child type) | 200 | 200 | MATCH |
| 3 | #3 GET /metadata (grandchild type) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_types (full tree) | 200 | 200 | MATCH |
| 5 | #5 GET /object (children of parent1) | 200 | 200 | MATCH |
| 6 | #6 GET /object (children of parent2) | 200 | 200 | MATCH |
| 7 | #7 GET /object (children of parent3 — empty) | 200 | 200 | MATCH |
| 8 | #8 GET /object (grandchildren of child1) | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo... |
| 9 | #9 GET /object (all children, no F_U) | 200 | 200 | MATCH |
| 10 | #10 GET /object (F_U + LIMIT=2) | 200 | 200 | MATCH |
| 11 | #11 GET /object (F_U + pg=2, LIMIT=2) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (child under parent3) | 200 | 200 | MATCH |
| 13 | #13 POST /_m_new (grandchild under child4) | 200 | 200 | MATCH |
| 14 | #14 POST /_m_move (child to different parent) | 200 | 200 | MATCH |
| 15 | #15 GET /object (parent1 after move) | 200 | 200 | MATCH |
| 16 | #16 GET /object (parent2 after move) | 200 | 200 | MATCH |
| 17 | #17 POST /_m_move (move child back) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_up (reorder within parent) | 200 | 200 | MATCH |
| 19 | #19 POST /_m_ord (set order within parent) | 200 | 200 | MATCH |
| 20 | #20 GET /object (order after changes) | 200 | 200 | MATCH |
| 21 | #21 POST /_m_set (child requisite) | 200 | 200 | MATCH |
| 22 | #22 GET /edit_obj (child) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 23 | #23 GET /edit_obj (grandchild) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 24 | #24 GET /object (parent list) | 200 | 200 | MATCH |
| 25 | #25 POST /_m_del (delete child) | 200 | 200 | MATCH |
| 26 | #26 GET /object (parent2 after child delete) | 200 | 200 | MATCH |
| 27 | #27 POST /_m_del (parent with children) | 200 | 200 | MATCH |

## Diffs Detail

### #8 GET /object (grandchildren of child1)

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["blo...
- PHP: `{"&main.a":{"_parent_.title":["__sub_grandchild_1773589821219"]},"type":{"id":1000015333,"up":1,"val":"__sub_grandchild_1773589821219","base":"SHORT"}...`
- Node: `{"&main.a":{"_parent_.title":["__sub_grandchild_1773589821219"]},"&main.a._noobj":{"_request_.f_u":["NaN"]},"&main.a.&uni_obj":{"base_typ":["3"],"crea...`

### #22 GET /edit_obj (child)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `[{"error":"objectId required: /my/edit_obj/{id}?JSON"}]`

### #23 GET /edit_obj (grandchild)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `[{"error":"objectId required: /my/edit_obj/{id}?JSON"}]`

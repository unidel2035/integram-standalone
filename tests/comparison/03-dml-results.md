# 03-dml — Object DML

13 MATCH / 3 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | MATCH |
| 2 | POST /_m_new (empty val) | 200 | 200 | DIFF: val[val]: PHP="1" Node="5" |
| 3 | POST /_m_save (rename) | 200 | 200 | MATCH |
| 4 | POST /_m_save (copy) | 200 | 200 | MATCH |
| 5 | POST /_m_set (text) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 6 | POST /_m_set (number) | 200 | 200 | MATCH |
| 7 | POST /_m_set (clear) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 8 | POST /_m_up | 200 | 200 | MATCH |
| 9 | POST /_m_ord (order=5) | 200 | 200 | MATCH |
| 10 | POST /_m_move (to root) | 200 | 200 | MATCH |
| 11 | POST /_m_id | 200 | 200 | MATCH |
| 12 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 13 | POST /_m_id (zero) | 200 | 200 | MATCH |
| 14 | POST /_m_del | 200 | 200 | MATCH |
| 15 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 16 | POST /_d_del (type with objects) | 200 | 200 | MATCH |

## Diffs Detail

### POST /_m_new (empty val)

- val[val]: PHP="1" Node="5"
- PHP: `{"id":1000008150,"obj":1000008150,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"1"}`
- Node: `{"args":"new1=1&","id":1000008149,"next_act":"edit_obj","obj":1000008149,"ord":5,"val":"5"}`

### POST /_m_set (text)

- type: PHP=object Node=array
- PHP: `{"id":1000008153,"obj":1000008144,"next_act":"nul","args":"","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

### POST /_m_set (clear)

- type: PHP=object Node=array
- PHP: `{"id":"","obj":1000008146,"next_act":"nul","args":"","warnings":""}`
- Node: `[{"error":"Couldn't execute query [insertRow_query] Unknown column 'NaN' in 'VALUES' (INSERT INTO `my` (up, ord, t, val) VALUES (?, ?, ?, ?))"}]`

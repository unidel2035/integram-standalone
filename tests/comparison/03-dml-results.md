# 03-dml — Object DML

2 MATCH / 11 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | DIFF: type: PHP=object Node=array |
| 2 | POST /_m_new (empty val) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 3 | POST /_m_save (rename) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 4 | POST /_m_save (copy) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 5 | POST /_m_up | 200 | 200 | DIFF: type: PHP=object Node=array |
| 6 | POST /_m_ord (order=5) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 7 | POST /_m_move (to root) | 200 | 200 | DIFF: type: PHP=object Node=array |
| 8 | POST /_m_id | 200 | 200 | DIFF: type: PHP=object Node=array |
| 9 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 10 | POST /_m_id (zero) | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 11 | POST /_m_del | 200 | 200 | DIFF: type: PHP=object Node=array |
| 12 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 13 | POST /_d_del (type with objects) | 200 | 200 | DIFF: format: PHP=text Node=JSON |

## Diffs Detail

### POST /_m_new

- type: PHP=object Node=array
- PHP: `{"id":1000004035,"obj":1000004035,"ord":1,"next_act":"object","args":"","val":"NewObj"}`
- Node: `[{"error":"Type 1000004031 does not exist"}]`

### POST /_m_new (empty val)

- type: PHP=object Node=array
- PHP: `{"id":1000004036,"obj":1000004036,"ord":1,"next_act":"object","args":"","val":"1"}`
- Node: `[{"error":"Type 1000004031 does not exist"}]`

### POST /_m_save (rename)

- type: PHP=object Node=array
- PHP: `{"id":"1000004030","obj":1000004032,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000004032","warnings":""}`
- Node: `[{"error":"Couldn't execute query [post_db_m_save_id_select] Unknown column 'NaN' in 'WHERE' (SELECT id, up FROM `my` WHERE id = ? LIMIT 1)"}]`

### POST /_m_save (copy)

- type: PHP=object Node=array
- PHP: `{"id":"1000004030","obj":1000004037,"next_act":"object","args":"copied1=1&F_U=1&F_I=1000004037","warnings":""}`
- Node: `[{"error":"Couldn't execute query [post_db_m_save_id_select] Unknown column 'NaN' in 'WHERE' (SELECT id, up FROM `my` WHERE id = ? LIMIT 1)"}]`

### POST /_m_up

- type: PHP=object Node=array
- PHP: `{"id":"1000004030","obj":null,"next_act":"object","args":"F_U=1","warnings":""}`
- Node: `[{"error":"Insufficient privileges"}]`

### POST /_m_ord (order=5)

- type: PHP=object Node=array
- PHP: `{"id":"1","obj":"1","next_act":"_m_ord","args":"","warnings":""}`
- Node: `[{"error":"Insufficient privileges"}]`

### POST /_m_move (to root)

- type: PHP=object Node=array
- PHP: `{"id":1000004033,"obj":null,"next_act":"object","args":"moved&","warnings":""}`
- Node: `[{"error":"Insufficient privileges"}]`

### POST /_m_id

- type: PHP=object Node=array
- PHP: `{"id":9997771,"obj":9997771,"next_act":"_m_id","args":"","warnings":""}`
- Node: `[{"error":"Insufficient privileges"}]`

### POST /_m_id (zero)

- format: PHP=text Node=JSON
- PHP: `Invalid ID`
- Node: `[{"error":"new_id must be a positive integer"}]`

### POST /_m_del

- type: PHP=object Node=array
- PHP: `{"id":"1000004030","obj":1000004039,"next_act":"object","args":"","warnings":""}`
- Node: `[{"error":"Wrong id: nan"}]`

### POST /_d_del (type with objects)

- format: PHP=text Node=JSON
- PHP: `Нельзя удалить тип при наличии его экземпляров (всего: 7)!`
- Node: `{"args":"ext","id":1000004031,"next_act":"edit_types","obj":null,"warnings":""}`

# 03-dml — Object DML

7 MATCH / 6 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | DIFF: val[ord]: PHP=1 Node=4 |
| 2 | POST /_m_new (empty val) | 200 | 200 | DIFF: val[ord]: PHP=1 Node=5 |
| 3 | POST /_m_save (rename) | 200 | 200 | DIFF: val[args]: PHP="saved1=1&F_U=1&F_I=1000004098" Node="saved1=1&F_U=1&F_I=1000004097" |
| 4 | POST /_m_save (copy) | 200 | 200 | DIFF: val[args]: PHP="copied1=1&F_U=1&F_I=1000004108" Node="copied1=1&F_U=1&F_I=1000004107" |
| 5 | POST /_m_up | 200 | 200 | MATCH |
| 6 | POST /_m_ord (order=5) | 200 | 200 | MATCH |
| 7 | POST /_m_move (to root) | 200 | 200 | MATCH |
| 8 | POST /_m_id | 200 | 200 | DIFF: type: PHP=array Node=object |
| 9 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 10 | POST /_m_id (zero) | 200 | 200 | MATCH |
| 11 | POST /_m_del | 200 | 200 | MATCH |
| 12 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 13 | POST /_d_del (type with objects) | 200 | 200 | DIFF: format: PHP=text Node=JSON |

## Diffs Detail

### POST /_m_new

- val[ord]: PHP=1 Node=4
- PHP: `{"id":1000004104,"obj":1000004104,"ord":1,"next_act":"object","args":"","val":"NewObj"}`
- Node: `{"args":"","id":1000004103,"next_act":"object","obj":1000004103,"ord":4,"val":"NewObj"}`

### POST /_m_new (empty val)

- val[ord]: PHP=1 Node=5
- val[val]: PHP="1" Node="5"
- PHP: `{"id":1000004106,"obj":1000004106,"ord":1,"next_act":"object","args":"","val":"1"}`
- Node: `{"args":"","id":1000004105,"next_act":"object","obj":1000004105,"ord":5,"val":"5"}`

### POST /_m_save (rename)

- val[args]: PHP="saved1=1&F_U=1&F_I=1000004098" Node="saved1=1&F_U=1&F_I=1000004097"
- PHP: `{"id":"1000004096","obj":1000004098,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000004098","warnings":""}`
- Node: `{"args":"saved1=1&F_U=1&F_I=1000004097","id":"1000004096","next_act":"object","obj":1000004097,"warnings":""}`

### POST /_m_save (copy)

- val[args]: PHP="copied1=1&F_U=1&F_I=1000004108" Node="copied1=1&F_U=1&F_I=1000004107"
- PHP: `{"id":"1000004096","obj":1000004108,"next_act":"object","args":"copied1=1&F_U=1&F_I=1000004108","warnings":""}`
- Node: `{"args":"copied1=1&F_U=1&F_I=1000004107","id":"1000004096","next_act":"object","obj":1000004107,"warnings":""}`

### POST /_m_id

- type: PHP=array Node=object
- PHP: `[{"error":"Новый id занят"}]`
- Node: `{"args":"","id":9997772,"next_act":"_m_id","obj":9997772,"warnings":""}`

### POST /_d_del (type with objects)

- format: PHP=text Node=JSON
- PHP: `Нельзя удалить тип при наличии его экземпляров (всего: 14)!`
- Node: `[{"error":"Cannot delete the Type in case there are objects of this type (total objects: 14)!"}]`

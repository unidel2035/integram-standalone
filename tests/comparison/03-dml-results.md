# 03-dml — Object DML

9 MATCH / 4 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | DIFF: val[ord]: PHP=1 Node=4 |
| 2 | POST /_m_new (empty val) | 200 | 200 | DIFF: val[ord]: PHP=1 Node=5 |
| 3 | POST /_m_save (rename) | 200 | 200 | DIFF: val[args]: PHP="saved1=1&F_U=1&F_I=1000004538" Node="saved1=1&F_U=1&F_I=1000004539" |
| 4 | POST /_m_save (copy) | 200 | 200 | DIFF: val[args]: PHP="copied1=1&F_U=1&F_I=1000004549" Node="copied1=1&F_U=1&F_I=1000004548" |
| 5 | POST /_m_up | 200 | 200 | MATCH |
| 6 | POST /_m_ord (order=5) | 200 | 200 | MATCH |
| 7 | POST /_m_move (to root) | 200 | 200 | MATCH |
| 8 | POST /_m_id | 200 | 200 | MATCH |
| 9 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 10 | POST /_m_id (zero) | 200 | 200 | MATCH |
| 11 | POST /_m_del | 200 | 200 | MATCH |
| 12 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 13 | POST /_d_del (type with objects) | 200 | 200 | MATCH |

## Diffs Detail

### POST /_m_new

- val[ord]: PHP=1 Node=4
- PHP: `{"id":1000004545,"obj":1000004545,"ord":1,"next_act":"object","args":"","val":"NewObj"}`
- Node: `{"args":"","id":1000004544,"next_act":"object","obj":1000004544,"ord":4,"val":"NewObj"}`

### POST /_m_new (empty val)

- val[ord]: PHP=1 Node=5
- val[val]: PHP="1" Node="5"
- PHP: `{"id":1000004547,"obj":1000004547,"ord":1,"next_act":"object","args":"","val":"1"}`
- Node: `{"args":"","id":1000004546,"next_act":"object","obj":1000004546,"ord":5,"val":"5"}`

### POST /_m_save (rename)

- val[args]: PHP="saved1=1&F_U=1&F_I=1000004538" Node="saved1=1&F_U=1&F_I=1000004539"
- PHP: `{"id":"1000004537","obj":1000004538,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000004538","warnings":""}`
- Node: `{"args":"saved1=1&F_U=1&F_I=1000004539","id":"1000004537","next_act":"object","obj":1000004539,"warnings":""}`

### POST /_m_save (copy)

- val[args]: PHP="copied1=1&F_U=1&F_I=1000004549" Node="copied1=1&F_U=1&F_I=1000004548"
- PHP: `{"id":"1000004537","obj":1000004549,"next_act":"object","args":"copied1=1&F_U=1&F_I=1000004549","warnings":""}`
- Node: `{"args":"copied1=1&F_U=1&F_I=1000004548","id":"1000004537","next_act":"object","obj":1000004548,"warnings":""}`

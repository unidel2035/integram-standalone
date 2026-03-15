# 03-dml — Object DML

9 MATCH / 4 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | DIFF: val[ord]: PHP=1 Node=4 |
| 2 | POST /_m_new (empty val) | 200 | 200 | DIFF: val[ord]: PHP=1 Node=5 |
| 3 | POST /_m_save (rename) | 200 | 200 | DIFF: val[args]: PHP="saved1=1&F_U=1&F_I=1000004227" Node="saved1=1&F_U=1&F_I=1000004226" |
| 4 | POST /_m_save (copy) | 200 | 200 | DIFF: val[args]: PHP="copied1=1&F_U=1&F_I=1000004236" Node="copied1=1&F_U=1&F_I=1000004237" |
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
- PHP: `{"id":1000004233,"obj":1000004233,"ord":1,"next_act":"object","args":"","val":"NewObj"}`
- Node: `{"args":"","id":1000004232,"next_act":"object","obj":1000004232,"ord":4,"val":"NewObj"}`

### POST /_m_new (empty val)

- val[ord]: PHP=1 Node=5
- val[val]: PHP="1" Node="5"
- PHP: `{"id":1000004235,"obj":1000004235,"ord":1,"next_act":"object","args":"","val":"1"}`
- Node: `{"args":"","id":1000004234,"next_act":"object","obj":1000004234,"ord":5,"val":"5"}`

### POST /_m_save (rename)

- val[args]: PHP="saved1=1&F_U=1&F_I=1000004227" Node="saved1=1&F_U=1&F_I=1000004226"
- PHP: `{"id":"1000004225","obj":1000004227,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000004227","warnings":""}`
- Node: `{"args":"saved1=1&F_U=1&F_I=1000004226","id":"1000004225","next_act":"object","obj":1000004226,"warnings":""}`

### POST /_m_save (copy)

- val[args]: PHP="copied1=1&F_U=1&F_I=1000004236" Node="copied1=1&F_U=1&F_I=1000004237"
- PHP: `{"id":"1000004225","obj":1000004236,"next_act":"object","args":"copied1=1&F_U=1&F_I=1000004236","warnings":""}`
- Node: `{"args":"copied1=1&F_U=1&F_I=1000004237","id":"1000004225","next_act":"object","obj":1000004237,"warnings":""}`

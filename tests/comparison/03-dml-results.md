# 03-dml — Object DML

16 MATCH / 0 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | MATCH |
| 2 | POST /_m_new (empty val) | 200 | 200 | MATCH |
| 3 | POST /_m_save (rename) | 200 | 200 | MATCH |
| 4 | POST /_m_save (copy) | 200 | 200 | MATCH |
| 5 | POST /_m_set (text) | 200 | 200 | MATCH |
| 6 | POST /_m_set (number) | 200 | 200 | MATCH |
| 7 | POST /_m_set (clear) | 200 | 200 | MATCH |
| 8 | POST /_m_up | 200 | 200 | MATCH |
| 9 | POST /_m_ord (order=5) | 200 | 200 | MATCH |
| 10 | POST /_m_move (to root) | 200 | 200 | MATCH |
| 11 | POST /_m_id | 200 | 200 | MATCH |
| 12 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 13 | POST /_m_id (zero) | 200 | 200 | MATCH |
| 14 | POST /_m_del | 200 | 200 | MATCH |
| 15 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 16 | POST /_d_del (type with objects) | 200 | 200 | MATCH |
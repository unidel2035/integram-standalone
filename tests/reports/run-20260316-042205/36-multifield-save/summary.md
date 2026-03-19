# 36-multifield-save

**15 MATCH / 0 DIFF** out of 15 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_m_save (all fields) | POST | 200 | 200 | MATCH |
| 02 | #2 GET /edit_obj (after multi-save) | GET | 200 | 200 | MATCH |
| 03 | #3 POST /_m_save (partial update) | POST | 200 | 200 | MATCH |
| 04 | #4 GET /edit_obj (after partial save) | GET | 200 | 200 | MATCH |
| 05 | #5 POST /_m_save (clear number) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_set (clear ref to 0) | POST | 200 | 200 | MATCH |
| 07 | #7 GET /edit_obj (after clears) | GET | 200 | 200 | MATCH |
| 08 | #8 POST /_m_set (set ref) | POST | 200 | 200 | MATCH |
| 09 | #9 POST /_m_set (change ref) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_m_new (HTML name) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /_m_new (quotes) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (newlines) | POST | 200 | 200 | MATCH |
| 13 | #13 GET /object (JSON_KV) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /object (JSON_DATA) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /object (JSON_CR) | GET | 200 | 200 | MATCH |
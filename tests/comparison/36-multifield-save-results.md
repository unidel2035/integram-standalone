# 36-multifield-save — Multi-field Save & Create

15 MATCH / 0 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_m_save (all fields) | 200 | 200 | MATCH |
| 2 | #2 GET /edit_obj (after multi-save) | 200 | 200 | MATCH |
| 3 | #3 POST /_m_save (partial update) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_obj (after partial save) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_save (clear number) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_set (clear ref to 0) | 200 | 200 | MATCH |
| 7 | #7 GET /edit_obj (after clears) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_set (set ref) | 200 | 200 | MATCH |
| 9 | #9 POST /_m_set (change ref) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_new (HTML name) | 200 | 200 | MATCH |
| 11 | #11 POST /_m_new (quotes) | 200 | 200 | MATCH |
| 12 | #12 POST /_m_new (newlines) | 200 | 200 | MATCH |
| 13 | #13 GET /object (JSON_KV) | 200 | 200 | MATCH |
| 14 | #14 GET /object (JSON_DATA) | 200 | 200 | MATCH |
| 15 | #15 GET /object (JSON_CR) | 200 | 200 | MATCH |
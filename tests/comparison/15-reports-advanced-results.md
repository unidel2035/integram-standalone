# 15-reports-advanced — Report CRUD & Execution

20 MATCH / 0 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /object/22 (report list) | 200 | 200 | MATCH |
| 2 | #2 GET /edit_types | 200 | 200 | MATCH |
| 3 | #3 POST /_m_new/22 (create report) | 200 | 200 | MATCH |
| 4 | #4 GET /edit_obj (new report) | 200 | 200 | MATCH |
| 5 | #5 POST /_m_new/44 (add FROM) | 200 | 200 | MATCH |
| 6 | #6 POST /_m_new/28 (add val column) | 200 | 200 | MATCH |
| 7 | #7 POST /_m_new/28 (add num column) | 200 | 200 | MATCH |
| 8 | #8 POST /_m_new/28 (add date column) | 200 | 200 | MATCH |
| 9 | #9 GET /edit_obj (report with columns) | 200 | 200 | MATCH |
| 10 | #10 POST /_m_save (set execute flag) | 200 | 200 | MATCH |
| 11 | #11 GET /report (execute JSON) | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=2) | 200 | 200 | MATCH |
| 13 | #13 GET /report (pg=2, LIMIT=2) | 200 | 200 | MATCH |
| 14 | #14 GET /report (CSV) | 200 | 200 | MATCH |
| 15 | #15 GET /metadata (report) | 200 | 200 | MATCH |
| 16 | #16 GET /object/28 (report columns) | 200 | 200 | MATCH |
| 17 | #17 POST /_m_save (rename report) | 200 | 200 | MATCH |
| 18 | #18 POST /_m_del (delete report) | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (deleted report) | 200 | 200 | MATCH |
| 20 | #20 GET /report (non-existent) | 200 | 200 | MATCH |
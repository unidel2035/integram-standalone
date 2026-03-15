# 15-reports-advanced

**20 MATCH / 0 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object/22 (report list) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /edit_types | GET | 200 | 200 | MATCH |
| 03 | #3 POST /_m_new/22 (create report) | POST | 200 | 200 | MATCH |
| 04 | #4 GET /edit_obj (new report) | GET | 200 | 200 | MATCH |
| 05 | #5 POST /_m_new/44 (add FROM) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /_m_new/28 (add val column) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_m_new/28 (add num column) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /_m_new/28 (add date column) | POST | 200 | 200 | MATCH |
| 09 | #9 GET /edit_obj (report with columns) | GET | 200 | 200 | MATCH |
| 10 | #10 POST /_m_save (set execute flag) | POST | 200 | 200 | MATCH |
| 11 | #11 GET /report (execute JSON) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /report (LIMIT=2) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /report (pg=2, LIMIT=2) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /report (CSV) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /metadata (report) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /object/28 (report columns) | GET | 200 | 200 | MATCH |
| 17 | #17 POST /_m_save (rename report) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_m_del (delete report) | POST | 200 | 200 | MATCH |
| 19 | #19 GET /edit_obj (deleted report) | GET | 200 | 200 | MATCH |
| 20 | #20 GET /report (non-existent) | GET | 200 | 200 | MATCH |
# 25-admin-endpoints

**19 MATCH / 0 DIFF** out of 19 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /terms (JSON) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /edit_types (JSON) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /info | GET | 200 | 200 | MATCH |
| 04 | #4 GET /dir_admin | GET | 200 | 200 | MATCH |
| 05 | #5 GET /form | GET | 200 | 200 | MATCH |
| 06 | #6 GET /sql | GET | 200 | 200 | MATCH |
| 07 | #7 GET /grants (JSON) | GET | 200 | 200 | MATCH |
| 08 | #8 POST /check_grant | POST | 200 | 200 | MATCH |
| 09 | #9 GET /backup | GET | 302 | 302 | MATCH |
| 10 | #10 GET /csv_all | GET | 500 | 302 | MATCH |
| 11 | #11 GET /bki-export | GET | 200 | 200 | MATCH |
| 12 | #13 GET /object (nonexistent type) | GET | 200 | 200 | MATCH |
| 13 | #14 GET /edit_obj (nonexistent obj) | GET | 200 | 200 | MATCH |
| 14 | #15 POST /_m_del (metadata id=1) | POST | 200 | 200 | MATCH |
| 15 | #16 POST /_d_del (nonexistent) | POST | 200 | 200 | MATCH |
| 16 | #17 POST /_m_new (no body) | POST | 200 | 200 | MATCH |
| 17 | #18 GET /validate | GET | 200 | 200 | MATCH |
| 18 | #19 GET /xsrf (session check) | GET | 200 | 200 | MATCH |
| 19 | #20 GET /metadata (type 3) | GET | 200 | 200 | MATCH |
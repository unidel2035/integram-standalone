# 25-admin-endpoints — Admin & System Endpoints

19 MATCH / 0 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /terms (JSON) | 200 | 200 | MATCH |
| 2 | #2 GET /edit_types (JSON) | 200 | 200 | MATCH |
| 3 | #3 GET /info | 200 | 200 | MATCH |
| 4 | #4 GET /dir_admin | 200 | 200 | MATCH |
| 5 | #5 GET /form | 200 | 200 | MATCH |
| 6 | #6 GET /sql | 200 | 200 | MATCH |
| 7 | #7 GET /grants (JSON) | 200 | 200 | MATCH |
| 8 | #8 POST /check_grant | 200 | 200 | MATCH |
| 9 | #9 GET /backup | 302 | 302 | MATCH |
| 10 | #10 GET /csv_all | 500 | 302 | MATCH |
| 11 | #11 GET /bki-export | 200 | 200 | MATCH |
| 12 | #13 GET /object (nonexistent type) | 200 | 200 | MATCH |
| 13 | #14 GET /edit_obj (nonexistent obj) | 200 | 200 | MATCH |
| 14 | #15 POST /_m_del (metadata id=1) | 200 | 200 | MATCH |
| 15 | #16 POST /_d_del (nonexistent) | 200 | 200 | MATCH |
| 16 | #17 POST /_m_new (no body) | 200 | 200 | MATCH |
| 17 | #18 GET /validate | 200 | 200 | MATCH |
| 18 | #19 GET /xsrf (session check) | 200 | 200 | MATCH |
| 19 | #20 GET /metadata (type 3) | 200 | 200 | MATCH |
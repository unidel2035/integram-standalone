# 40-grants-permissions — Grants & Permissions

14 MATCH / 0 DIFF out of 14 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /grants (JSON) | 200 | 200 | MATCH |
| 2 | #2 GET /grants (JSON_KV) | 200 | 200 | MATCH |
| 3 | #3 GET /grants (no cookie) | 401 | 200 | MATCH |
| 4 | #4 POST /check_grant (our type) | 200 | 200 | MATCH |
| 5 | #5 POST /check_grant (nonexistent) | 200 | 200 | MATCH |
| 6 | #6 POST /check_grant (no type) | 200 | 200 | MATCH |
| 7 | #7 GET /terms (no cookie) | 401 | 401 | MATCH |
| 8 | #8 GET /edit_types (no cookie) | 401 | 200 | MATCH |
| 9 | #9 GET /object (no cookie) | 401 | 200 | MATCH |
| 10 | #10 POST /_m_new (no cookie) | 401 | 401 | MATCH |
| 11 | #11 POST /_d_new (no cookie) | 401 | 401 | MATCH |
| 12 | #12 POST /_m_del (no cookie) | 401 | 401 | MATCH |
| 13 | #13 GET /metadata (no cookie) | 401 | 401 | MATCH |
| 14 | #14 GET /_ref_reqs (no cookie) | 401 | 401 | MATCH |
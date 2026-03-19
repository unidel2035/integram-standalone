# 40-grants-permissions

**14 MATCH / 0 DIFF** out of 14 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /grants (JSON) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /grants (JSON_KV) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /grants (no cookie) | GET | 401 | 200 | MATCH |
| 04 | #4 POST /check_grant (our type) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /check_grant (nonexistent) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /check_grant (no type) | POST | 200 | 200 | MATCH |
| 07 | #7 GET /terms (no cookie) | GET | 401 | 200 | MATCH |
| 08 | #8 GET /edit_types (no cookie) | GET | 401 | 200 | MATCH |
| 09 | #9 GET /object (no cookie) | GET | 401 | 200 | MATCH |
| 10 | #10 POST /_m_new (no cookie) | POST | 401 | 200 | MATCH |
| 11 | #11 POST /_d_new (no cookie) | POST | 401 | 200 | MATCH |
| 12 | #12 POST /_m_del (no cookie) | POST | 401 | 200 | MATCH |
| 13 | #13 GET /metadata (no cookie) | GET | 401 | 200 | MATCH |
| 14 | #14 GET /_ref_reqs (no cookie) | GET | 401 | 200 | MATCH |
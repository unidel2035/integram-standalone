# 43-my-database

**28 MATCH / 0 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /xsrf (my) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /grants (my) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /terms (my) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /terms (my JSON_KV) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /edit_types (my) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /object/18 (users) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /object/42 (roles) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object/18 (JSON_KV) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /object/18 (LIMIT=3) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /metadata/18 (User) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /metadata/42 (Role) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /metadata/18 (JSON_KV) | GET | 200 | 200 | MATCH |
| 13 | #13 POST /_new_db (no name) | POST | 200 | 200 | MATCH |
| 14 | #14 POST /_new_db (reserved: select) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /_new_db (reserved: table) | POST | 200 | 200 | MATCH |
| 16 | #16 POST /_new_db (too short: ab) | POST | 200 | 200 | MATCH |
| 17 | #17 POST /_new_db (invalid: a-b) | POST | 200 | 200 | MATCH |
| 18 | #18 POST /_new_db (starts digit: 1abc) | POST | 200 | 200 | MATCH |
| 19 | #19 POST /_new_db (existing: my) | POST | 200 | 200 | MATCH |
| 20 | #20 POST /_new_db (too long) | POST | 200 | 200 | MATCH |
| 21 | #21 POST /register (no data) | POST | 200 | 200 | MATCH |
| 22 | #22 POST /register (bad email) | POST | 200 | 200 | MATCH |
| 23 | #23 GET /register (no params) | GET | 200 | 302 | MATCH |
| 24 | #24 GET /report/18 (User type) | GET | 200 | 200 | MATCH |
| 25 | #25 GET /report/18 (JSON_KV) | GET | 200 | 200 | MATCH |
| 26 | #26 GET /_list/18 (users) | GET | 200 | 200 | MATCH |
| 27 | #27 GET /_list/42 (roles) | GET | 200 | 200 | MATCH |
| 28 | #30 GET /object/999999999 (nonexistent in my) | GET | 200 | 200 | MATCH |
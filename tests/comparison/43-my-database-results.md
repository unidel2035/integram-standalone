# 43-my-database — Master Database Operations

28 MATCH / 0 DIFF out of 28 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /xsrf (my) | 200 | 200 | MATCH |
| 2 | #2 GET /grants (my) | 200 | 200 | MATCH |
| 3 | #3 GET /terms (my) | 200 | 200 | MATCH |
| 4 | #4 GET /terms (my JSON_KV) | 200 | 200 | MATCH |
| 5 | #5 GET /edit_types (my) | 200 | 200 | MATCH |
| 6 | #6 GET /object/18 (users) | 200 | 200 | MATCH |
| 7 | #7 GET /object/42 (roles) | 200 | 200 | MATCH |
| 8 | #8 GET /object/18 (JSON_KV) | 200 | 200 | MATCH |
| 9 | #9 GET /object/18 (LIMIT=3) | 200 | 200 | MATCH |
| 10 | #10 GET /metadata/18 (User) | 200 | 200 | MATCH |
| 11 | #11 GET /metadata/42 (Role) | 200 | 200 | MATCH |
| 12 | #12 GET /metadata/18 (JSON_KV) | 200 | 200 | MATCH |
| 13 | #13 POST /_new_db (no name) | 200 | 200 | MATCH |
| 14 | #14 POST /_new_db (reserved: select) | 200 | 200 | MATCH |
| 15 | #15 POST /_new_db (reserved: table) | 200 | 200 | MATCH |
| 16 | #16 POST /_new_db (too short: ab) | 200 | 200 | MATCH |
| 17 | #17 POST /_new_db (invalid: a-b) | 200 | 200 | MATCH |
| 18 | #18 POST /_new_db (starts digit: 1abc) | 200 | 200 | MATCH |
| 19 | #19 POST /_new_db (existing: my) | 200 | 200 | MATCH |
| 20 | #20 POST /_new_db (too long) | 200 | 200 | MATCH |
| 21 | #21 POST /register (no data) | 200 | 200 | MATCH |
| 22 | #22 POST /register (bad email) | 200 | 200 | MATCH |
| 23 | #23 GET /register (no params) | 200 | 302 | MATCH |
| 24 | #24 GET /report/18 (User type) | 200 | 200 | MATCH |
| 25 | #25 GET /report/18 (JSON_KV) | 200 | 200 | MATCH |
| 26 | #26 GET /_list/18 (users) | 200 | 200 | MATCH |
| 27 | #27 GET /_list/42 (roles) | 200 | 200 | MATCH |
| 28 | #30 GET /object/999999999 (nonexistent in my) | 200 | 200 | MATCH |
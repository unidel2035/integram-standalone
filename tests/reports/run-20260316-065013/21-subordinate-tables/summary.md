# 21-subordinate-tables

**8 MATCH / 0 DIFF** out of 8 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #3 GET /edit_types (has subordinate) | GET | 200 | 200 | MATCH |
| 02 | #4 GET /metadata (subordinate) | GET | 200 | 200 | MATCH |
| 03 | #7 GET /object (parent listing) | GET | 200 | 200 | MATCH |
| 04 | #11 GET /object (children of proj1) | GET | 200 | 200 | MATCH |
| 05 | #12 GET /object (children of proj2) | GET | 200 | 200 | MATCH |
| 06 | #18 GET /metadata (grandchild type) | GET | 200 | 200 | MATCH |
| 07 | #22 GET /object (no children after delete) | GET | 200 | 200 | MATCH |
| 08 | #23 GET /object (sub type no filter) | GET | 200 | 200 | MATCH |
# 21-subordinate-tables — Subordinate Type Operations

8 MATCH / 0 DIFF out of 8 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #3 GET /edit_types (has subordinate) | 200 | 200 | MATCH |
| 2 | #4 GET /metadata (subordinate) | 200 | 200 | MATCH |
| 3 | #7 GET /object (parent listing) | 200 | 200 | MATCH |
| 4 | #11 GET /object (children of proj1) | 200 | 200 | MATCH |
| 5 | #12 GET /object (children of proj2) | 200 | 200 | MATCH |
| 6 | #18 GET /metadata (grandchild type) | 200 | 200 | MATCH |
| 7 | #22 GET /object (no children after delete) | 200 | 200 | MATCH |
| 8 | #23 GET /object (sub type no filter) | 200 | 200 | MATCH |
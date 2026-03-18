# 46-legacy-aliases

**10 MATCH / 0 DIFF** out of 10 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /_terms (create type) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /_terms/:parentTypeId (child type) | POST | 200 | 200 | MATCH |
| 03 | #3 GET /terms (created type visible in both) | GET | 200 | 200 | MATCH |
| 04 | #4 POST /_references/:typeId (add ref column) | POST | 200 | 200 | MATCH |
| 05 | #5 GET /metadata (after _references) | GET | 200 | 200 | MATCH |
| 06 | #6 POST /_references (nonexistent type) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /_patchterm/:typeId (rename) | POST | 200 | 200 | MATCH |
| 08 | #8 GET /edit_types (after _patchterm) | GET | 200 | 200 | MATCH |
| 09 | #9 POST /_patchterm (nonexistent) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /_terms (no xsrf) | POST | 200 | 200 | MATCH |
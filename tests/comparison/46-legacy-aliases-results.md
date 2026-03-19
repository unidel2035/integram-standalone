# 46-legacy-aliases — Legacy URL Aliases

10 MATCH / 0 DIFF out of 10 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_terms (create type) | 200 | 200 | MATCH |
| 2 | #2 POST /_terms/:parentTypeId (child type) | 200 | 200 | MATCH |
| 3 | #3 GET /terms (created type visible in both) | 200 | 200 | MATCH |
| 4 | #4 POST /_references/:typeId (add ref column) | 200 | 200 | MATCH |
| 5 | #5 GET /metadata (after _references) | 200 | 200 | MATCH |
| 6 | #6 POST /_references (nonexistent type) | 200 | 200 | MATCH |
| 7 | #7 POST /_patchterm/:typeId (rename) | 200 | 200 | MATCH |
| 8 | #8 GET /edit_types (after _patchterm) | 200 | 200 | MATCH |
| 9 | #9 POST /_patchterm (nonexistent) | 200 | 200 | MATCH |
| 10 | #10 POST /_terms (no xsrf) | 200 | 200 | MATCH |
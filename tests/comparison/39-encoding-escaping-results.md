# 39-encoding-escaping — Unicode & HTML Escaping

15 MATCH / 0 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #3 GET /edit_obj (Cyrillic name) | 200 | 200 | MATCH |
| 2 | #4 GET /edit_obj (mixed name) | 200 | 200 | MATCH |
| 3 | #6 GET /edit_obj (HTML entities) | 200 | 200 | MATCH |
| 4 | #7 POST /_m_set (double quotes) | 200 | 200 | MATCH |
| 5 | #8 GET /edit_obj (after quotes set) | 200 | 200 | MATCH |
| 6 | #10 GET /edit_obj (plus sign) | 200 | 200 | MATCH |
| 7 | #12 GET /edit_obj (percent) | 200 | 200 | MATCH |
| 8 | #13 POST /_d_alias (Cyrillic alias) | 200 | 200 | MATCH |
| 9 | #14 GET /metadata (after Cyrillic alias) | 200 | 200 | MATCH |
| 10 | #15 GET /object (JSON listing) | 200 | 200 | MATCH |
| 11 | #16 GET /object (JSON_KV listing) | 200 | 200 | MATCH |
| 12 | #17 GET /terms (has Cyrillic type) | 200 | 200 | MATCH |
| 13 | #18 GET /_list (q=Привет) | 200 | 200 | MATCH |
| 14 | #19 GET /_list (q=Test) | 200 | 200 | MATCH |
| 15 | #20 GET /_list (q=ZZZZZZZ) | 200 | 200 | MATCH |
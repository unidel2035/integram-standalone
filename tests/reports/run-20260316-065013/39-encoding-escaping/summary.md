# 39-encoding-escaping

**15 MATCH / 0 DIFF** out of 15 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #3 GET /edit_obj (Cyrillic name) | GET | 200 | 200 | MATCH |
| 02 | #4 GET /edit_obj (mixed name) | GET | 200 | 200 | MATCH |
| 03 | #6 GET /edit_obj (HTML entities) | GET | 200 | 200 | MATCH |
| 04 | #7 POST /_m_set (double quotes) | POST | 200 | 200 | MATCH |
| 05 | #8 GET /edit_obj (after quotes set) | GET | 200 | 200 | MATCH |
| 06 | #10 GET /edit_obj (plus sign) | GET | 200 | 200 | MATCH |
| 07 | #12 GET /edit_obj (percent) | GET | 200 | 200 | MATCH |
| 08 | #13 POST /_d_alias (Cyrillic alias) | POST | 200 | 200 | MATCH |
| 09 | #14 GET /metadata (after Cyrillic alias) | GET | 200 | 200 | MATCH |
| 10 | #15 GET /object (JSON listing) | GET | 200 | 200 | MATCH |
| 11 | #16 GET /object (JSON_KV listing) | GET | 200 | 200 | MATCH |
| 12 | #17 GET /terms (has Cyrillic type) | GET | 200 | 200 | MATCH |
| 13 | #18 GET /_list (q=Привет) | GET | 200 | 200 | MATCH |
| 14 | #19 GET /_list (q=Test) | GET | 200 | 200 | MATCH |
| 15 | #20 GET /_list (q=ZZZZZZZ) | GET | 200 | 200 | MATCH |
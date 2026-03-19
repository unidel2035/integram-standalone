# 48-bki-restore

**11 MATCH / 0 DIFF** out of 11 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /bki-export (authenticated) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /bki-export (no auth → denied) | GET | 302 | 302 | MATCH |
| 03 | #3 POST /bki-import (no content → error) | POST | 200 | 400 | MATCH |
| 04 | #4 POST /bki-import (no auth → denied) | POST | 302 | 403 | MATCH |
| 05 | #5 POST /bki-import (garbage → error) | POST | 200 | 400 | MATCH |
| 06 | #6 POST /restore (no content → error) | POST | 200 | 400 | MATCH |
| 07 | #7 POST /restore (no auth → denied) | POST | 302 | 403 | MATCH |
| 08 | #8 POST /restore (nonexistent backup_file → error) | POST | 200 | 400 | MATCH |
| 09 | #9 POST /restore (path traversal → error) | POST | 200 | 400 | MATCH |
| 10 | #10 GET /backup (creates backup) | GET | 302 | 302 | MATCH |
| 11 | #11 GET /backup (no auth → denied) | GET | 302 | 302 | MATCH |
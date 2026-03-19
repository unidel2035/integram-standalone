# 48-bki-restore — BKI Import/Export & Restore

11 MATCH / 0 DIFF out of 11 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /bki-export (authenticated) | 200 | 200 | MATCH |
| 2 | #2 GET /bki-export (no auth → denied) | 302 | 302 | MATCH |
| 3 | #3 POST /bki-import (no content → error) | 200 | 400 | MATCH |
| 4 | #4 POST /bki-import (no auth → denied) | 302 | 403 | MATCH |
| 5 | #5 POST /bki-import (garbage → error) | 200 | 400 | MATCH |
| 6 | #6 POST /restore (no content → error) | 200 | 400 | MATCH |
| 7 | #7 POST /restore (no auth → denied) | 302 | 403 | MATCH |
| 8 | #8 POST /restore (nonexistent backup_file → error) | 200 | 400 | MATCH |
| 9 | #9 POST /restore (path traversal → error) | 200 | 400 | MATCH |
| 10 | #10 GET /backup (creates backup) | 302 | 302 | MATCH |
| 11 | #11 GET /backup (no auth → denied) | 302 | 302 | MATCH |
# 17-file-upload — File Upload, Download, Blacklist

7 MATCH / 0 DIFF out of 7 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #2 GET /edit_obj (after upload) | 200 | 200 | MATCH |
| 2 | #3 GET /object (listing with file) | 200 | 200 | MATCH |
| 3 | #5 GET /edit_obj (after _m_set upload) | 200 | 200 | MATCH |
| 4 | #7 GET /edit_obj (after replace) | 200 | 200 | MATCH |
| 5 | #8 POST /_m_set (clear file) | 200 | 200 | MATCH |
| 6 | #9 GET /edit_obj (after clear) | 200 | 200 | MATCH |
| 7 | #15 GET /object (final state) | 200 | 200 | MATCH |
# 17-file-upload

**7 MATCH / 0 DIFF** out of 7 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #2 GET /edit_obj (after upload) | GET | 200 | 200 | MATCH |
| 02 | #3 GET /object (listing with file) | GET | 200 | 200 | MATCH |
| 03 | #5 GET /edit_obj (after _m_set upload) | GET | 200 | 200 | MATCH |
| 04 | #7 GET /edit_obj (after replace) | GET | 200 | 200 | MATCH |
| 05 | #8 POST /_m_set (clear file) | POST | 200 | 200 | MATCH |
| 06 | #9 GET /edit_obj (after clear) | GET | 200 | 200 | MATCH |
| 07 | #15 GET /object (final state) | GET | 200 | 200 | MATCH |
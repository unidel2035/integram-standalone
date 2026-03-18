# 47-upload-direct

**9 MATCH / 0 DIFF** out of 9 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /upload (txt file) | POST | 200 | 200 | MATCH |
| 02 | #2 POST /upload (csv file) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /upload (png with valid magic) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /upload (pdf with valid magic) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /upload (png ext, wrong magic) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /upload (jpg ext, wrong magic) | POST | 200 | 200 | MATCH |
| 07 | #7 POST /upload (no file) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /upload (no auth) | POST | 302 | 302 | MATCH |
| 09 | #9 GET /upload (page) | GET | 200 | 200 | MATCH |
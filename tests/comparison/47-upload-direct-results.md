# 47-upload-direct — POST /upload Endpoint

9 MATCH / 0 DIFF out of 9 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /upload (txt file) | 200 | 200 | MATCH |
| 2 | #2 POST /upload (csv file) | 200 | 200 | MATCH |
| 3 | #3 POST /upload (png with valid magic) | 200 | 200 | MATCH |
| 4 | #4 POST /upload (pdf with valid magic) | 200 | 200 | MATCH |
| 5 | #5 POST /upload (png ext, wrong magic) | 200 | 200 | MATCH |
| 6 | #6 POST /upload (jpg ext, wrong magic) | 200 | 200 | MATCH |
| 7 | #7 POST /upload (no file) | 200 | 200 | MATCH |
| 8 | #8 POST /upload (no auth) | 302 | 302 | MATCH |
| 9 | #9 GET /upload (page) | 200 | 200 | MATCH |
# 50-dir-admin-write

**24 MATCH / 0 DIFF** out of 24 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 POST /dir_admin?mkdir (valid name) | POST | 302 | 302 | MATCH |
| 02 | #2 POST /dir_admin?mkdir (duplicate — already exists) | POST | 200 | 200 | MATCH |
| 03 | #3 POST /dir_admin?mkdir (name with spaces — invalid) | POST | 200 | 200 | MATCH |
| 04 | #4 POST /dir_admin?mkdir (name with slash — invalid) | POST | 200 | 200 | MATCH |
| 05 | #5 POST /dir_admin?mkdir (empty dir_name — invalid) | POST | 200 | 200 | MATCH |
| 06 | #6 POST /dir_admin?touch (valid .html file) | POST | 302 | 302 | MATCH |
| 07 | #7 POST /dir_admin?touch (duplicate file — already exists) | POST | 200 | 200 | MATCH |
| 08 | #8 POST /dir_admin?touch (no extension — auto .html) | POST | 302 | 302 | MATCH |
| 09 | #9 POST /dir_admin?touch (blacklisted .php extension) | POST | 200 | 200 | MATCH |
| 10 | #10 POST /dir_admin?touch (blacklisted .jsp extension) | POST | 200 | 200 | MATCH |
| 11 | #11 POST /dir_admin?touch (name with spaces — invalid) | POST | 200 | 200 | MATCH |
| 12 | #12 POST /dir_admin (delete existing file) | POST | 302 | 302 | MATCH |
| 13 | #13 POST /dir_admin (delete second file) | POST | 302 | 302 | MATCH |
| 14 | #14 POST /dir_admin (double-delete — file already gone) | POST | 200 | 200 | MATCH |
| 15 | #15 POST /dir_admin (delete directory) | POST | 302 | 302 | MATCH |
| 16 | #16 POST /dir_admin (delete=1 no del[] — empty delete) | POST | 302 | 302 | MATCH |
| 17 | #17 POST /dir_admin (path traversal — both prevent it) | POST | 200 | 302 | MATCH |
| 18 | #18 POST /dir_admin?mkdir (no XSRF — rejected) | POST | 403 | 403 | MATCH |
| 19 | #19 POST /dir_admin?touch (no XSRF — rejected) | POST | 403 | 403 | MATCH |
| 20 | #20 POST /dir_admin (delete, no XSRF — rejected) | POST | 403 | 403 | MATCH |
| 21 | #21 POST /dir_admin?mkdir (no auth — rejected) | POST | 302 | 302 | MATCH |
| 22 | #22 POST /dir_admin (no operation param — unknown op error) | POST | 200 | 200 | MATCH |
| 23 | #23 POST /dir_admin?mkdir&download (mkdir in download folder) | POST | 302 | 302 | MATCH |
| 24 | #24 POST /dir_admin?download (delete in download folder) | POST | 302 | 302 | MATCH |
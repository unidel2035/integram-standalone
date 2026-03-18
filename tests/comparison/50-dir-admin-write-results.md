# 50-dir-admin-write — POST dir_admin filesystem operations

24 MATCH / 0 DIFF out of 24 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /dir_admin?mkdir (valid name) | 302 | 302 | MATCH |
| 2 | #2 POST /dir_admin?mkdir (duplicate — already exists) | 200 | 200 | MATCH |
| 3 | #3 POST /dir_admin?mkdir (name with spaces — invalid) | 200 | 200 | MATCH |
| 4 | #4 POST /dir_admin?mkdir (name with slash — invalid) | 200 | 200 | MATCH |
| 5 | #5 POST /dir_admin?mkdir (empty dir_name — invalid) | 200 | 200 | MATCH |
| 6 | #6 POST /dir_admin?touch (valid .html file) | 302 | 302 | MATCH |
| 7 | #7 POST /dir_admin?touch (duplicate file — already exists) | 200 | 200 | MATCH |
| 8 | #8 POST /dir_admin?touch (no extension — auto .html) | 302 | 302 | MATCH |
| 9 | #9 POST /dir_admin?touch (blacklisted .php extension) | 200 | 200 | MATCH |
| 10 | #10 POST /dir_admin?touch (blacklisted .jsp extension) | 200 | 200 | MATCH |
| 11 | #11 POST /dir_admin?touch (name with spaces — invalid) | 200 | 200 | MATCH |
| 12 | #12 POST /dir_admin (delete existing file) | 302 | 302 | MATCH |
| 13 | #13 POST /dir_admin (delete second file) | 302 | 302 | MATCH |
| 14 | #14 POST /dir_admin (double-delete — file already gone) | 200 | 200 | MATCH |
| 15 | #15 POST /dir_admin (delete directory) | 302 | 302 | MATCH |
| 16 | #16 POST /dir_admin (delete=1 no del[] — empty delete) | 302 | 302 | MATCH |
| 17 | #17 POST /dir_admin (path traversal — both prevent it) | 200 | 302 | MATCH |
| 18 | #18 POST /dir_admin?mkdir (no XSRF — rejected) | 403 | 403 | MATCH |
| 19 | #19 POST /dir_admin?touch (no XSRF — rejected) | 403 | 403 | MATCH |
| 20 | #20 POST /dir_admin (delete, no XSRF — rejected) | 403 | 403 | MATCH |
| 21 | #21 POST /dir_admin?mkdir (no auth — rejected) | 302 | 302 | MATCH |
| 22 | #22 POST /dir_admin (no operation param — unknown op error) | 200 | 200 | MATCH |
| 23 | #23 POST /dir_admin?mkdir&download (mkdir in download folder) | 302 | 302 | MATCH |
| 24 | #24 POST /dir_admin?download (delete in download folder) | 302 | 302 | MATCH |
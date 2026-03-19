# 34-ref-search-filters — Ref Search & Object Filters

20 MATCH / 0 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /_ref_reqs (all) | 200 | 200 | MATCH |
| 2 | #2 GET /_ref_reqs (q=Альф) | 200 | 200 | MATCH |
| 3 | #3 GET /_ref_reqs (q=ZZZZZ) | 200 | 200 | MATCH |
| 4 | #4 GET /_ref_reqs (r=id1,id2) | 200 | 200 | MATCH |
| 5 | #5 GET /_ref_reqs (r=999999999) | 200 | 200 | MATCH |
| 6 | #6 GET /_ref_reqs (LIMIT=3) | 200 | 200 | MATCH |
| 7 | #7 GET /_ref_reqs (LIMIT+q) | 200 | 200 | MATCH |
| 8 | #8 GET /object (F_I=objId) | 200 | 200 | MATCH |
| 9 | #9 GET /object (F_I=999999999) | 200 | 200 | MATCH |
| 10 | #10 GET /object (F_U=1) | 200 | 200 | MATCH |
| 11 | #11 GET /object (F_U=0) | 200 | 200 | MATCH |
| 12 | #12 GET /object (LIMIT=2 + desc) | 200 | 200 | MATCH |
| 13 | #13 GET /object (LIMIT=2 + asc) | 200 | 200 | MATCH |
| 14 | #14 GET /object (LIMIT=2,2 + desc) | 200 | 200 | MATCH |
| 15 | #15 GET /obj_meta (obj with ref) | 200 | 200 | MATCH |
| 16 | #16 GET /obj_meta (bare obj) | 200 | 200 | MATCH |
| 17 | #17 GET /obj_meta (nonexistent) | 200 | 200 | MATCH |
| 18 | #18 GET /download (nonexistent) | 200 | 404 | MATCH |
| 19 | #19 GET /report (LIMIT=2 + desc) | 200 | 200 | MATCH |
| 20 | #20 GET /report (RECORD_COUNT+LIMIT) | 200 | 200 | MATCH |
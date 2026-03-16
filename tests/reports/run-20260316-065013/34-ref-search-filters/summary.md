# 34-ref-search-filters

**20 MATCH / 0 DIFF** out of 20 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /_ref_reqs (all) | GET | 200 | 200 | MATCH |
| 02 | #2 GET /_ref_reqs (q=Альф) | GET | 200 | 200 | MATCH |
| 03 | #3 GET /_ref_reqs (q=ZZZZZ) | GET | 200 | 200 | MATCH |
| 04 | #4 GET /_ref_reqs (r=id1,id2) | GET | 200 | 200 | MATCH |
| 05 | #5 GET /_ref_reqs (r=999999999) | GET | 200 | 200 | MATCH |
| 06 | #6 GET /_ref_reqs (LIMIT=3) | GET | 200 | 200 | MATCH |
| 07 | #7 GET /_ref_reqs (LIMIT+q) | GET | 200 | 200 | MATCH |
| 08 | #8 GET /object (F_I=objId) | GET | 200 | 200 | MATCH |
| 09 | #9 GET /object (F_I=999999999) | GET | 200 | 200 | MATCH |
| 10 | #10 GET /object (F_U=1) | GET | 200 | 200 | MATCH |
| 11 | #11 GET /object (F_U=0) | GET | 200 | 200 | MATCH |
| 12 | #12 GET /object (LIMIT=2 + desc) | GET | 200 | 200 | MATCH |
| 13 | #13 GET /object (LIMIT=2 + asc) | GET | 200 | 200 | MATCH |
| 14 | #14 GET /object (LIMIT=2,2 + desc) | GET | 200 | 200 | MATCH |
| 15 | #15 GET /obj_meta (obj with ref) | GET | 200 | 200 | MATCH |
| 16 | #16 GET /obj_meta (bare obj) | GET | 200 | 200 | MATCH |
| 17 | #17 GET /obj_meta (nonexistent) | GET | 200 | 200 | MATCH |
| 18 | #18 GET /download (nonexistent) | GET | 200 | 404 | MATCH |
| 19 | #19 GET /report (LIMIT=2 + desc) | GET | 200 | 200 | MATCH |
| 20 | #20 GET /report (RECORD_COUNT+LIMIT) | GET | 200 | 200 | MATCH |
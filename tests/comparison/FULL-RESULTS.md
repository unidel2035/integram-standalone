# PHP vs Node.js — Full Comparison Report

**Date**: 2026-03-17T04:21:40.009Z

| Test | Status |
|------|--------|
| 01-auth.js | PASS |
| 02-ddl.js | PASS |
| 03-dml.js | PASS |
| 04-listing.js | DIFF |
| 05-reports.js | PASS |
| 06-admin.js | PASS |
| 07-refs-multi.js | DIFF |
| 08-export.js | PASS |

**6 passed, 2 with diffs/errors**


---

# 01-auth — Auth & Session

15 MATCH / 0 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /auth (correct creds) | 200 | 200 | MATCH |
| 2 | POST /auth (wrong password) | 200 | 200 | MATCH |
| 3 | POST /auth (empty fields) | 200 | 200 | MATCH |
| 4 | POST /auth (redirect mode) | 302 | 302 | MATCH |
| 5 | GET /xsrf | 200 | 200 | MATCH |
| 6 | POST /getcode (bad user) | 200 | 200 | MATCH |
| 7 | POST /checkcode (invalid) | 200 | 200 | MATCH |
| 8 | GET /validate | 200 | 200 | MATCH |
| 9 | POST /jwt (empty) | 200 | 200 | MATCH |
| 10 | POST /jwt (invalid) | 200 | 200 | MATCH |
| 11 | GET /exit | 302 | 302 | MATCH |
| 12 | GET /login | 302 | 302 | MATCH |
| 13 | GET /login?u=testbot | 302 | 302 | MATCH |
| 14 | OPTIONS /* | 200 | 200 | MATCH |
| 15 | POST /auth (nonexistent db #427) | 500 | 404 | MATCH |

---

# 02-ddl — Type/Column DDL

20 MATCH / 0 DIFF out of 20 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_d_new (SHORT type) | 200 | 200 | MATCH |
| 2 | POST /_d_new (NUMBER type) | 200 | 200 | MATCH |
| 3 | POST /_d_new (DATE type) | 200 | 200 | MATCH |
| 4 | POST /_d_new (duplicate name) | 200 | 200 | MATCH |
| 5 | POST /_d_new (unique=1) | 200 | 200 | MATCH |
| 6 | POST /_d_new (empty name) | 200 | 200 | MATCH |
| 7 | POST /_d_save (rename) | 200 | 200 | MATCH |
| 8 | POST /_d_save (unique=1) | 200 | 200 | MATCH |
| 9 | POST /_d_req (text column) | 200 | 200 | MATCH |
| 10 | POST /_d_req (number column) | 200 | 200 | MATCH |
| 11 | POST /_d_ref (reference column) | 200 | 200 | MATCH |
| 12 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 13 | POST /_d_multi (multi=1) | 200 | 200 | MATCH |
| 14 | POST /_d_up | 200 | 200 | MATCH |
| 15 | POST /_d_ord (order=1) | 200 | 200 | MATCH |
| 16 | POST /_d_alias | 200 | 200 | MATCH |
| 17 | POST /_d_attrs | 200 | 200 | MATCH |
| 18 | POST /_d_del_req | 200 | 200 | MATCH |
| 19 | POST /_d_del (empty type) | 200 | 200 | MATCH |
| 20 | POST /_d_del (non-existent) | 200 | 200 | MATCH |

---

# 03-dml — Object DML

16 MATCH / 0 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_m_new | 200 | 200 | MATCH |
| 2 | POST /_m_new (empty val) | 200 | 200 | MATCH |
| 3 | POST /_m_save (rename) | 200 | 200 | MATCH |
| 4 | POST /_m_save (copy) | 200 | 200 | MATCH |
| 5 | POST /_m_set (text) | 200 | 200 | MATCH |
| 6 | POST /_m_set (number) | 200 | 200 | MATCH |
| 7 | POST /_m_set (clear) | 200 | 200 | MATCH |
| 8 | POST /_m_up | 200 | 200 | MATCH |
| 9 | POST /_m_ord (order=5) | 200 | 200 | MATCH |
| 10 | POST /_m_move (to root) | 200 | 200 | MATCH |
| 11 | POST /_m_id | 200 | 200 | MATCH |
| 12 | POST /_m_id (duplicate) | 200 | 200 | MATCH |
| 13 | POST /_m_id (zero) | 200 | 200 | MATCH |
| 14 | POST /_m_del | 200 | 200 | MATCH |
| 15 | POST /_m_del (non-existent) | 200 | 200 | MATCH |
| 16 | POST /_d_del (type with objects) | 200 | 200 | MATCH |

---

# 04-listing — Listing & Querying

11 MATCH / 10 DIFF out of 21 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /object/:type?JSON=1 | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 2 | GET /object/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /object/:type?LIMIT=2 | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 4 | GET /object/:type (empty) | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 5 | GET /object?F_U=1 | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 6 | GET /object?F_U=0 | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 7 | GET /object?F_I=id | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 8 | GET /object?F_{type}=Alpha | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 9 | GET /object?order_val=val | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 10 | GET /object?desc=1 | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 11 | GET /edit_obj/:id | 200 | 200 | DIFF: val[&main.a.&object]: PHP={"disabled":[""],"id":["__ID__"],"typ":[... Node={"disabled":["DISABLED"],"id":["__ID__"]... |
| 12 | GET /edit_types | 200 | 200 | MATCH |
| 13 | GET /obj_meta/:type | 200 | 200 | MATCH |
| 14 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 15 | GET /_list/:type | 200 | 200 | MATCH |
| 16 | GET /_list?q=Alpha | 200 | 200 | MATCH |
| 17 | GET /_list?LIMIT=2 | 200 | 200 | MATCH |
| 18 | GET /_list_join/:type | 200 | 200 | MATCH |
| 19 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 20 | GET /_ref_reqs?q=test | 200 | 200 | MATCH |
| 21 | POST / action=object | 200 | 200 | MATCH |

## Diffs Detail

### GET /object/:type?JSON=1

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filte...`

### GET /object/:type?LIMIT=2

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filte...`

### GET /object/:type (empty)

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_empty_1773721284843"]},"type":{"id":1000030987,"up":1,"val":"__lst_empty_1773721284843","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__lst_empty_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filt...`

### GET /object?F_U=1

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a._noobj":{"_request_.f_u":["1"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_U=0

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a._noobj":{"_request_.f_u":["0"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_grant...`

### GET /object?F_I=id

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":["1000030978"],"f_u":[...`

### GET /object?F_{type}=Alpha

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filte...`

### GET /object?order_val=val

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filte...`

### GET /object?desc=1

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"type":{"id":1000030970,"up":1,"val":"__lst_main_1773721284843","base":"SHORT"},"base":{"id...`
- Node: `{"&main.a":{"_parent_.title":["__lst_main_1773721284843"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filte...`

### GET /edit_obj/:id

- val[&main.a.&object]: PHP={"disabled":[""],"id":["__ID__"],"typ":[... Node={"disabled":["DISABLED"],"id":["__ID__"]...
- val[&main.a.&object.&edit_req]: PHP={"_parent_.disabled":[""],"_parent_.val"... Node={"_parent_.disabled":["DISABLED"],"_pare...
- PHP: `{"obj":{"id":"1000030977","val":"Alpha","parent":"1","typ":"1000030970","typ_name":"__lst_main_1773721284843","base_typ":"3"},"&main.a.&object":{"typ"...`
- Node: `{"&main.a.&object":{"disabled":["DISABLED"],"id":["1000030978"],"typ":["1000030971","1000030971"],"typ_name":["__lst_main_1773721284843","__lst_main_1...`


---

# 05-reports — Reports & Formats

13 MATCH / 0 DIFF out of 13 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /report/:type?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /report/:type?JSON_DATA | 200 | 200 | MATCH |
| 3 | GET /report/:type?JSON_KV | 200 | 200 | MATCH |
| 4 | GET /report/:type?JSON_CR | 200 | 200 | MATCH |
| 5 | GET /report/:type?JSON_HR | 200 | 200 | MATCH |
| 6 | GET /report?LIMIT=2 | 200 | 200 | MATCH |
| 7 | GET /report?LIMIT=1,3 | 200 | 200 | MATCH |
| 8 | GET /report?RECORD_COUNT | 200 | 200 | MATCH |
| 9 | GET /report?FR_col=B | 200 | 200 | MATCH |
| 10 | GET /report?FR_col=20&TO_col=40 | 200 | 200 | MATCH |
| 11 | GET /report?csv | 200 | 200 | MATCH |
| 12 | GET /report (bad id) | 200 | 200 | MATCH |
| 13 | POST / action=report | 200 | 200 | MATCH |

---

# 06-admin — Admin & Metadata

16 MATCH / 0 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /terms?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /terms (HTML) | 200 | 200 | MATCH |
| 3 | GET /dict?JSON=1 | 200 | 200 | MATCH |
| 4 | GET /dict/:type?JSON=1 | 200 | 200 | MATCH |
| 5 | GET /dict (bad id) | 200 | 200 | MATCH |
| 6 | GET /edit_types?JSON=1 | 200 | 200 | MATCH |
| 7 | GET /types?JSON=1 | 200 | 200 | MATCH |
| 8 | GET /obj_meta/:type | 200 | 200 | MATCH |
| 9 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 10 | GET /form?JSON=1 | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | 200 | 200 | MATCH |
| 13 | GET /validate?JSON=1 | 200 | 200 | MATCH |
| 14 | GET /grants?JSON=1 | 200 | 200 | MATCH |
| 15 | POST /check_grant | 200 | 200 | MATCH |
| 16 | GET /exit | 302 | 302 | MATCH |

---

# 07-refs-multi — References & Multiselect

14 MATCH / 5 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /_ref_reqs/:reqId | 200 | 200 | MATCH |
| 2 | GET /_ref_reqs?q=Opt1 | 200 | 200 | MATCH |
| 3 | GET /_ref_reqs (bad id) | 200 | 200 | DIFF: type: PHP=array Node=object |
| 4 | POST /_m_set (ref value) | 200 | 200 | MATCH |
| 5 | POST /_m_set (clear ref) | 200 | 200 | MATCH |
| 6 | POST /_d_multi (enable) | 200 | 200 | MATCH |
| 7 | GET /object after multi toggle | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 8 | POST /_d_multi (disable) | 200 | 200 | MATCH |
| 9 | GET /object (sub-type) | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 10 | POST /_m_move (to parent) | 200 | 200 | MATCH |
| 11 | GET /object?F_U=parentId | 200 | 200 | MATCH |
| 12 | GET /_list/:type | 200 | 200 | MATCH |
| 13 | GET /_list?q=Opt2 | 200 | 200 | MATCH |
| 14 | GET /_list_join/:type | 200 | 200 | MATCH |
| 15 | POST /_d_null (required=1) | 200 | 200 | MATCH |
| 16 | POST /_d_null (required=0) | 200 | 200 | MATCH |
| 17 | GET /object (col-as-table) | 200 | 200 | DIFF: val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non... |
| 18 | POST /_d_del_req (remove ref) | 200 | 200 | MATCH |
| 19 | GET /edit_obj (with refs) | 200 | 200 | DIFF: val[&main.a.&object]: PHP={"disabled":[""],"id":["__ID__"],"typ":[... Node={"disabled":["DISABLED"],"id":["__ID__"]... |

## Diffs Detail

### GET /_ref_reqs (bad id)

- type: PHP=array Node=object
- PHP: `[]`
- Node: `{"error":"Invalid id"}`

### GET /object after multi toggle

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__ref_parent_1773721290537"]},"type":{"id":1000031024,"up":1,"val":"__ref_parent_1773721290537","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_parent_1773721290537"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"fil...`

### GET /object (sub-type)

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__ref_sub_1773721290537"]},"type":{"id":1000031035,"up":1,"val":"__ref_sub_1773721290537","base":"SHORT"},"base":{"id":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_sub_1773721290537"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"filter...`

### GET /object (col-as-table)

- val[&main.a.&uni_obj]: PHP={"base_typ":["3"],"create_granted":["blo... Node={"base_typ":["3"],"create_granted":["non...
- PHP: `{"&main.a":{"_parent_.title":["__ref_coltab_1773721290537"]},"type":{"id":1000031038,"up":1,"val":"__ref_coltab_1773721290537","base":"SHORT"},"base":...`
- Node: `{"&main.a":{"_parent_.title":["__ref_coltab_1773721290537"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["none"],"f_i":[""],"f_u":[""],"fil...`

### GET /edit_obj (with refs)

- val[&main.a.&object]: PHP={"disabled":[""],"id":["__ID__"],"typ":[... Node={"disabled":["DISABLED"],"id":["__ID__"]...
- val[&main.a.&object.&edit_req]: PHP={"_parent_.disabled":[""],"_parent_.val"... Node={"_parent_.disabled":["DISABLED"],"_pare...
- PHP: `{"obj":{"id":"1000031033","val":"ParentA","parent":"1","typ":"1000031024","typ_name":"__ref_parent_1773721290537","base_typ":"3"},"&main.a.&object":{"...`
- Node: `{"&main.a.&object":{"disabled":["DISABLED"],"id":["1000031034"],"typ":["1000031024","1000031024"],"typ_name":["__ref_parent_1773721290537","__ref_pare...`


---

# 08-export — Export & Backup

11 MATCH / 0 DIFF out of 11 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /csv_all | 500 | 302 | MATCH |
| 2 | GET /backup | 302 | 302 | MATCH |
| 3 | GET /export/:type | 200 | 200 | MATCH |
| 4 | GET /export (bad id) | 200 | 200 | MATCH |
| 5 | GET /bki-export | 200 | 200 | MATCH |
| 6 | GET /info | 200 | 200 | MATCH |
| 7 | GET / (root) | 200 | 200 | MATCH |
| 8 | GET /:db (main) | 200 | 200 | MATCH |
| 9 | GET /login (no cookie) | 302 | 302 | MATCH |
| 10 | GET /login?u=testbot | 302 | 302 | MATCH |
| 11 | GET /upload | 200 | 200 | MATCH |
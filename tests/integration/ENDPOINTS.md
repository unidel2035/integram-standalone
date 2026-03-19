# Tested Endpoints & Parameters

349 PASS / 0 FAIL / 57 SKIP across 11 test suites.

## Auth & Session

| Method | Endpoint | Query params | Body params |
|--------|----------|-------------|-------------|
| POST | `/auth` | `JSON=1` | `login`, `pwd`, `tzone`, `change=1`, `npw1`, `npw2`, `secret` |
| GET | `/auth` | `secret=` | — |
| GET | `/xsrf` | `JSON=1` | — |
| GET | `/validate` | `JSON=1` | — | **NODE-ONLY** (#451) |
| POST | `/getcode` | — | `u`, `login`, `tzone` |
| POST | `/checkcode` | — | `u`, `login`, `c`, `code` |
| GET | `/confirm` | `JSON=1` | — |
| POST | `/jwt` | — | `jwt`, `token`, `JSON=1` |
| POST | `/my/register` | — | `email`, `regpwd`, `regpwd1`, `agree=1`, `JSON=1` |
| GET | `/exit` | — | — |
| GET | `/login` | `u=` | — |
| OPTIONS | `/*` | — | — |

## Types DDL

| Method | Endpoint | Query params | Body params |
|--------|----------|-------------|-------------|
| POST | `/_d_new` | — | `_xsrf`, `val`, `t` (3,11,12,16,23,...), `up`, `unique=1`, `JSON=1` |
| POST | `/_d_save/:typeId` | — | `_xsrf`, `val`, `t`, `unique=1`, `JSON=1` |
| POST | `/_d_req/:typeId` | — | `_xsrf`, `t` (col type), `JSON=1` |
| POST | `/_d_ref/:typeId` | — | `_xsrf`, `t` (ref type), `JSON=1` |
| POST | `/_d_del/:typeId` | — | `_xsrf`, `forced`, `JSON=1` |
| POST | `/_d_del_req/:reqId` | — | `_xsrf`, `JSON=1` |
| POST | `/_d_null/:reqId` | — | `_xsrf`, `required=0\|1`, `JSON=1` |
| POST | `/_d_multi/:reqId` | — | `_xsrf`, `multi=0\|1`, `JSON=1` |
| POST | `/_d_up/:reqId` | — | `_xsrf`, `JSON=1` |
| POST | `/_d_ord/:reqId` | — | `_xsrf`, `order=N`, `JSON=1` |
| POST | `/_d_alias/:reqId` | — | `_xsrf`, `val`, `JSON=1` |
| POST | `/_d_attrs/:reqId` | — | `_xsrf`, `alias`, `name`, `required=0\|1`, `multi=0\|1`, `set_null=1`, `JSON=1` |

## Objects DML

| Method | Endpoint | Query params | Body params |
|--------|----------|-------------|-------------|
| POST | `/_m_new/:typeId` | — | `_xsrf`, `up` (1=root), `t{typeId}=val`, `type`, `JSON=1` |
| POST | `/_m_save/:objId` | — | `_xsrf`, `t{typeId}=val`, `copybtn`, `val`, `tab=N`, `tzone`, `JSON=1` |
| POST | `/_m_del/:objId` | — | `_xsrf`, `cascade=1`, `forced`, `JSON=1` |
| POST | `/_m_set/:objId` | — | `_xsrf`, `t{colTypeId}=val`, `JSON=1` |
| POST | `/_m_up/:objId` | — | `_xsrf`, `JSON=1` |
| POST | `/_m_ord/:objId` | — | `_xsrf`, `order=N`, `JSON=1` |
| POST | `/_m_id/:objId` | — | `_xsrf`, `new_id=N`, `JSON=1` |
| POST | `/_m_move/:objId` | — | `_xsrf`, `up=parentId`, `JSON=1` |

## Listing & Querying

| Method | Endpoint | Query params |
|--------|----------|-------------|
| GET | `/object/:typeId` | `JSON=1`, `JSON_DATA`, `LIMIT=N`, `F_U=parentId`, `F_U=0`, `F_I=objId`, `F_{typeId}=val`, `order_val=val`, `desc=1` |
| GET | `/edit_obj/:objId` | `JSON=1` |
| GET | `/edit_types` | `JSON=1` |
| GET | `/terms` | `JSON=1` |
| GET | `/metadata` | `JSON=1` |
| GET | `/metadata/:typeId` | `JSON=1` |
| GET | `/obj_meta/:objId` | — |
| GET | `/_ref_reqs/:reqId` | `q=search`, `q=@ID` |
| GET | `/_list/:typeId` | `JSON=1`, `q=search`, `LIMIT=N`, `F=offset`, `sort=col`, `dir=asc\|desc`, `up=parentId` | **NODE-ONLY** (#451) |
| GET | `/_list_join/:typeId` | `JSON=1`, `q=search`, `LIMIT=N`, `F=offset` | **NODE-ONLY** (#451) |
| GET | `/_dict` | `JSON=1` |
| GET | `/_dict/:typeId` | `JSON=1` |
| GET | `/_d_main/:typeId` | `JSON=1` |
| POST | `/` (action=object) | `a=object`, `id=typeId`, `JSON=1`, `JSON_DATA` |

## Reports

| Method | Endpoint | Query params |
|--------|----------|-------------|
| GET | `/report` | `JSON=1` |
| GET | `/report/:reportId` | `JSON=1`, `JSON_DATA`, `JSON_KV`, `JSON_CR`, `JSON_HR`, `RECORD_COUNT`, `LIMIT=N`, `LIMIT=offset,count`, `F=offset`, `ORDER=col`, `ORDER=col+DESC`, `FR_col=val`, `TO_col=val`, `EQ_col=val`, `LIKE_col=val`, `SELECT=col1,col2`, `field_names=1`, `csv`, `format=csv` |
| POST | `/` (action=report) | `action=report`, `id=reportId`, `_xsrf`, `JSON=1`, `JSON_KV`, `LIMIT=N` |

## Admin & System

| Method | Endpoint | Query params | Body params |
|--------|----------|-------------|-------------|
| GET | `/dir_admin` | `JSON=1` | — | **NODE-ONLY** (#451) |
| GET | `/sql` | `JSON=1` | — |
| GET | `/form` | `JSON=1` | — |
| GET | `/dict` | `JSON=1` | — |
| GET | `/grants` | `JSON=1` | — | **NODE-ONLY** (#451) |
| POST | `/check_grant` | — | `grant=ddl`, `JSON=1` | **NODE-ONLY** (#451) |
| GET | `/csv_all` | — | — |
| GET | `/backup` | — | — |
| GET | `/export/:typeId` | — | — |
| GET | `/download/:file` | — | — |
| GET | `/_connect/:objId` | `JSON=1` | — |
| POST | `/my/_new_db` | — | `db=name`, `template=empty`, `JSON=1` |

## JSON Format Variants

| Parameter | Format |
|-----------|--------|
| `JSON=1` | `{object: [{id, val, up, ...}], ...}` |
| `JSON_DATA` | `[[val1, val2, ...], ...]` compact array |
| `JSON_KV` | `[{col: val, ...}, ...]` key-value |
| `JSON_CR` | `{columns: [], rows: [], totalCount: N}` |
| `JSON_HR` | Hierarchical with groups |
| `RECORD_COUNT` | `{count: N}` |
| `csv` / `format=csv` | CSV text |

## Filter Parameters

| Parameter | Meaning |
|-----------|---------|
| `F_U=parentId` | Filter by parent object ID |
| `F_U=0` | Root objects only |
| `F_I=objId` | Filter by exact object ID |
| `F_{typeId}=val` | Filter by main column value |
| `FR_col=val` | Range from (>=) |
| `TO_col=val` | Range to (<=) |
| `EQ_col=val` | Exact match |
| `LIKE_col=val` | Contains (LIKE %val%) |
| `q=search` | Full-text search |

## Node-Only Endpoints (no PHP equivalent — #451)

These endpoints exist only in the Node.js backend. PHP either returns `null` (plain text, 200) or renders HTML with no JSON API. They are **not bugs** — they are Node-only features that have no PHP counterpart to compare against.

| Method | Endpoint | Node Response |
|--------|----------|---------------|
| GET | `/_list/:typeId?JSON=1` | `{data, total, limit, offset}` |
| GET | `/_list_join/:typeId?JSON=1` | `{data, total, limit, offset, requisites}` |
| GET | `/validate?JSON=1` | `{success, valid, user: {id, login}, xsrf}` |
| GET | `/dir_admin?JSON=1` | `{dirs, files}` or file download |
| GET | `/grants?JSON=1` | `{success, user, grants: [{id, type}]}` |
| POST | `/check_grant` | `{granted, level}` |

## Not Tested

| Endpoint | Reason |
|----------|--------|
| File upload via `_m_set` multipart | Needs file fixtures |
| `google-auth` | Requires OAuth credentials |
| `auth.asp` | Legacy ASP redirect |
| `bki-export` / `bki-import` / `restore` | Binary formats, destructive |
| Parent-child objects (`up=objectId`) | Requires GRANT permissions |
| BUTTON type behavior | Requires UI interaction |

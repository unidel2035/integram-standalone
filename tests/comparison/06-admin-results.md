# 06-admin — Admin & Metadata

13 MATCH / 3 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /terms?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /terms (HTML) | 200 | 200 | MATCH |
| 3 | GET /dict?JSON=1 | 200 | 200 | MATCH |
| 4 | GET /dict/:type?JSON=1 | 200 | 200 | MATCH |
| 5 | GET /dict (bad id) | 200 | 200 | MATCH |
| 6 | GET /edit_types?JSON=1 | 200 | 200 | DIFF: keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.a.&types,edit_types,editable,types] |
| 7 | GET /types?JSON=1 | 200 | 200 | MATCH |
| 8 | GET /obj_meta/:type | 200 | 200 | DIFF: val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}} |
| 9 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 10 | GET /form?JSON=1 | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | 200 | 200 | DIFF: body: PHP=<!DOCTYPE html>
<html>
<head>
    <meta charset... Node=<!DOCTYPE html>
<html>
<head>
    <meta charset... |
| 13 | GET /validate?JSON=1 | 200 | 200 | MATCH |
| 14 | GET /grants?JSON=1 | 200 | 200 | MATCH |
| 15 | POST /check_grant | 200 | 200 | MATCH |
| 16 | GET /exit | 302 | 302 | MATCH |

## Diffs Detail

### GET /edit_types?JSON=1

- keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.a.&types,edit_types,editable,types]
- val[&main.a.&editables]: PHP={"ok":[""]} Node=
- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`

### GET /obj_meta/:type

- val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}}
- PHP: `{"id":"1000004267","up":"0","type":"3","val":"__adm_main_1773566536441","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `{"id":"1000004267","reqs":{"":{"id":"","type":"","val":""}},"type":"3","up":"0","val":"__adm_main_1773566536441"}`

### GET /dir_admin?JSON=1

- body: PHP=<!DOCTYPE html>
<html>
<head>
    <meta charset... Node=<!DOCTYPE html>
<html>
<head>
    <meta charset...
- PHP: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" cont...`
- Node: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" cont...`

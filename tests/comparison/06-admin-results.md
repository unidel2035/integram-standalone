# 06-admin — Admin & Metadata

8 MATCH / 8 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /terms?JSON=1 | 200 | 200 | DIFF: type: PHP=array Node=object |
| 2 | GET /terms (HTML) | 200 | 200 | MATCH |
| 3 | GET /dict?JSON=1 | 200 | 200 | MATCH |
| 4 | GET /dict/:type?JSON=1 | 200 | 200 | MATCH |
| 5 | GET /dict (bad id) | 200 | 200 | MATCH |
| 6 | GET /edit_types?JSON=1 | 200 | 200 | DIFF: val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"... |
| 7 | GET /types?JSON=1 | 200 | 200 | MATCH |
| 8 | GET /obj_meta/:type | 200 | 200 | DIFF: format: PHP=JSON Node=text |
| 9 | GET /obj_meta (bad id) | 200 | 200 | DIFF: format: PHP=JSON Node=text |
| 10 | GET /form?JSON=1 | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 13 | GET /validate?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 14 | GET /grants?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 15 | POST /check_grant | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | GET /exit | 302 | 302 | MATCH |

## Diffs Detail

### GET /terms?JSON=1

- type: PHP=array Node=object
- PHP: `[{"id":1000001489,"type":3,"name":":!NULL:"},{"id":1000001488,"type":3,"name":":ALIAS=test::!NULL:renamed"},{"id":220822,"type":3,"name":"agent_applic...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### GET /edit_types?JSON=1

- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.a.&editables":{"ok":[""]},"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CH...`

### GET /obj_meta/:type

- format: PHP=JSON Node=text
- PHP: `{"id":"1000004138","up":"0","type":"3","val":"__adm_main_1773564047611","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### GET /obj_meta (bad id)

- format: PHP=JSON Node=text
- PHP: `{}`
- Node: `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="styles...`

### GET /dir_admin?JSON=1

- format: PHP=text Node=JSON
- PHP: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" cont...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### GET /validate?JSON=1

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"success":true,"user":{"id":1000000660,"login":"testbot"},"valid":true,"xsrf":"21c8b5ef82d391e8cd6e90"}`

### GET /grants?JSON=1

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.myrolemenu":{"href":["dict","...`

### POST /check_grant

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `[{"error":"Object ID required"}]`

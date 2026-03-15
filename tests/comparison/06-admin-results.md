# 06-admin — Admin & Metadata

10 MATCH / 6 DIFF out of 16 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /terms?JSON=1 | 200 | 200 | MATCH |
| 2 | GET /terms (HTML) | 200 | 200 | MATCH |
| 3 | GET /dict?JSON=1 | 200 | 200 | MATCH |
| 4 | GET /dict/:type?JSON=1 | 200 | 200 | MATCH |
| 5 | GET /dict (bad id) | 200 | 200 | MATCH |
| 6 | GET /edit_types?JSON=1 | 200 | 200 | DIFF: keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.&top_menu,&main.a.&editables,&main.a.&types,&main.myro...] |
| 7 | GET /types?JSON=1 | 200 | 200 | MATCH |
| 8 | GET /obj_meta/:type | 200 | 200 | DIFF: val[up]: PHP="0" Node="1" |
| 9 | GET /obj_meta (bad id) | 200 | 200 | MATCH |
| 10 | GET /form?JSON=1 | 200 | 200 | MATCH |
| 11 | GET /sql?JSON=1 | 200 | 200 | MATCH |
| 12 | GET /dir_admin?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 13 | GET /validate?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 14 | GET /grants?JSON=1 | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 15 | POST /check_grant | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 16 | GET /exit | 302 | 302 | MATCH |

## Diffs Detail

### GET /edit_types?JSON=1

- keys: PHP=[&main.a.&editables,&main.a.&types,edit_types,editable,types] Node=[&main.&top_menu,&main.a.&editables,&main.a.&types,&main.myro...]
- val[edit_types]: PHP={"0":["1000001489","1000001488","220822"... Node={"0":["1000001489","1000001488","220822"...
- PHP: `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BO...`
- Node: `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.a.&editables":{"ok":[""]},"&m...`

### GET /obj_meta/:type

- val[up]: PHP="0" Node="1"
- val[reqs]: PHP={"":{"id":"__ID__","val":"","type":""}} Node={"":{"id":"__ID__","type":"","val":""}}
- PHP: `{"id":"1000004059","up":"0","type":"3","val":"__adm_main_1773535078212","reqs":{"":{"id":"","val":"","type":""}}}`
- Node: `{"id":"1000004060","reqs":{"":{"id":"","type":"","val":""}},"type":"3","up":"1","val":"__adm_main_1773535078212"}`

### GET /dir_admin?JSON=1

- format: PHP=text Node=JSON
- PHP: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" cont...`
- Node: `{"add_path":"","directories":[{"name":"backups","type":"directory"},{"name":"logs","type":"directory"}],"files":[{"modified":"2026-03-13T21:36:07.995Z...`

### GET /validate?JSON=1

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"success":true,"user":{"id":1000000660,"login":"testbot"},"valid":true,"xsrf":"ded7e39f1380e82e45acdd"}`

### GET /grants?JSON=1

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `{"grants":[{"id":0,"type":"WRITE"},{"id":1,"type":"WRITE"},{"id":10,"type":"WRITE"}],"success":true,"user":"testbot"}`

### POST /check_grant

- format: PHP=text Node=JSON
- PHP: `null`
- Node: `[{"error":"Object ID required"}]`

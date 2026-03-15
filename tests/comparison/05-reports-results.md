# 05-reports — Reports & Formats

2 MATCH / 9 DIFF out of 11 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | GET /report/:type?JSON=1 | 200 | 200 | DIFF: type: PHP=array Node=object |
| 2 | GET /report/:type?JSON_DATA | 200 | 200 | DIFF: type: PHP=array Node=object |
| 3 | GET /report/:type?JSON_KV | 200 | 200 | DIFF: length: PHP=1 Node=18 |
| 4 | GET /report/:type?JSON_CR | 200 | 200 | DIFF: type: PHP=array Node=object |
| 5 | GET /report/:type?JSON_HR | 200 | 200 | DIFF: type: PHP=array Node=object |
| 6 | GET /report?LIMIT=2 | 200 | 200 | DIFF: type: PHP=array Node=object |
| 7 | GET /report?LIMIT=1,3 | 200 | 200 | DIFF: type: PHP=array Node=object |
| 8 | GET /report?RECORD_COUNT | 200 | 200 | DIFF: format: PHP=text Node=JSON |
| 9 | GET /report?csv | 200 | 200 | MATCH |
| 10 | GET /report (bad id) | 200 | 404 | DIFF: status: PHP=200 Node=404 |
| 11 | POST / action=report | 200 | 200 | MATCH |

## Diffs Detail

### GET /report/:type?JSON=1

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{"columns":[],"data":[]}`

### GET /report/:type?JSON_DATA

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{}`

### GET /report/:type?JSON_KV

- length: PHP=1 Node=18
- keys[0]: PHP=[error] Node=[]
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `[{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}]`

### GET /report/:type?JSON_CR

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{"columns":[],"rows":{"0":{},"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"2":{},"3":{},"4":{},"5":{},"6":{},"7":{},"8":{},"...`

### GET /report/:type?JSON_HR

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{"columns":[],"groups":{"0":[{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}]},"totalCount":18}`

### GET /report?LIMIT=2

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{"columns":[],"data":[]}`

### GET /report?LIMIT=1,3

- type: PHP=array Node=object
- PHP: `[{"error":"Пустой отчет __rpt_main_1773535075073"}]`
- Node: `{"columns":[],"data":[]}`

### GET /report?RECORD_COUNT

- format: PHP=text Node=JSON
- PHP: `Пустой отчет __rpt_main_1773535075073`
- Node: `{"count":18}`

### GET /report (bad id)

- status: PHP=200 Node=404
- PHP: `[{"error":"У вас нет доступа к реквизиту объекта: 999999999, 0 () или его родителю  ()! Ваш глобальный доступ: 'WRITE'."}]`
- Node: `[{"error":"Report not found"}]`

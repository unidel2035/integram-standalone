# PHP vs Node.js Response Comparison

Date: 2026-03-14

| # | Test | Method | Path | PHP | Node | Match | Notes |
|---|------|--------|------|-----|------|-------|-------|
| 1 | POST /auth (correct) | POST | `/auth` | 500 | 200 | DIFF | token/xsrf values differ (expected) |
| 2 | POST /auth (wrong pwd) | POST | `/auth` | 500 | 200 | DIFF |  |
| 3 | GET /xsrf | GET | `/xsrf?JSON=1` | 200 | 200 | MATCH | xsrf values differ (expected) |
| 4 | GET /validate | GET | `/validate?JSON=1` | 200 | 200 | DIFF |  |
| 5 | POST /getcode | POST | `/getcode` | 500 | 200 | DIFF |  |
| 6 | POST /checkcode (invalid) | POST | `/checkcode` | 500 | 200 | DIFF |  |
| 7 | GET /terms | GET | `/terms` | 200 | 200 | MATCH | PHP: 232 types, Node: 232 types |
| 8 | GET /metadata | GET | `/metadata?JSON=1` | 200 | 200 | MATCH |  |
| 9 | GET /obj_meta | GET | `/obj_meta/:id` | 200 | 200 | MATCH | IDs differ (expected) |
| 10 | POST /_d_new (create type) | POST | `/_d_new` | 200 | 200 | MATCH |  |
| 11 | POST /_d_save (rename type) | POST | `/_d_save/:id` | 200 | 200 | DIFF |  |
| 12 | POST /_d_req (add column) | POST | `/_d_req/:id` | 200 | 200 | MATCH |  |
| 13 | POST /_d_ref (add ref column) | POST | `/_d_ref/:id` | 200 | 200 | MATCH |  |
| 14 | POST /_m_new (create object) | POST | `/_m_new/:typeId` | 200 | 200 | MATCH |  |
| 15 | POST /_m_save (update object) | POST | `/_m_save/:id` | 200 | 200 | MATCH |  |
| 16 | POST /_m_set (set attribute) | POST | `/_m_set/:id` | 200 | 200 | MATCH |  |
| 17 | POST /_m_save (copy object) | POST | `/_m_save/:id&copybtn` | 200 | 200 | MATCH |  |
| 18 | POST /_m_ord (set order) | POST | `/_m_ord/:id` | 200 | 200 | MATCH |  |
| 19 | POST /_m_up (move up) | POST | `/_m_up/:id` | 200 | 200 | MATCH |  |
| 20 | POST /_m_id (change ID) | POST | `/_m_id/:id` | 200 | 200 | MATCH |  |
| 21 | GET /object/:type?JSON=1 | GET | `/object/:type?JSON=1` | 200 | 200 | DIFF | PHP: 5 objs, Node: 5 objs |
| 22 | GET /object/:type?JSON_DATA | GET | `/object/:type?JSON_DATA` | 200 | 200 | MATCH |  |
| 23 | GET /object?JSON=1&LIMIT=2 | GET | `/object/:type?JSON=1&LIMIT=2` | 200 | 200 | DIFF | PHP: 2 objs, Node: 2 objs |
| 24 | GET /object?F_I=id | GET | `/object/:type?JSON=1&F_I=id` | 200 | 200 | DIFF |  |
| 25 | GET /edit_obj/:id?JSON=1 | GET | `/edit_obj/:id?JSON=1` | 200 | 200 | DIFF |  |
| 26 | GET /edit_types?JSON=1 | GET | `/edit_types?JSON=1` | 200 | 200 | DIFF |  |
| 27 | GET /report/:id?JSON=1 | GET | `/report/:id?JSON=1` | 200 | 200 | MATCH |  |
| 28 | GET /report/:id?JSON_KV | GET | `/report/:id?JSON_KV` | 200 | 200 | DIFF |  |
| 29 | GET /report/:id?JSON_CR | GET | `/report/:id?JSON_CR` | 200 | 200 | MATCH |  |
| 30 | GET /report/:id?RECORD_COUNT | GET | `/report/:id?RECORD_COUNT` | 200 | 200 | DIFF |  |
| 31 | GET /report?JSON_KV&LIMIT=2 | GET | `/report/:id?JSON_KV&LIMIT=2` | 200 | 200 | MATCH |  |
| 32 | GET /dict?JSON=1 | GET | `/dict?JSON=1` | 200 | 200 | MATCH |  |
| 33 | GET /sql?JSON=1 | GET | `/sql?JSON=1` | 200 | 200 | MATCH |  |
| 34 | GET /form?JSON=1 | GET | `/form?JSON=1` | 200 | 200 | MATCH |  |
| 35 | GET /terms (invalid db) | GET | `/nonexistent_db/terms` | 200 | 200 | MATCH |  |
| 36 | POST /_m_del (delete object) | POST | `/_m_del/:id` | 200 | 200 | MATCH |  |

## Detailed Responses

### 1. POST /auth (correct)

**POST `/auth`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 500 | `` |
| Node | 200 | `<!doctype html> <html> <head>     <meta charset="utf-8">     <meta name="description" content="Простой и мощный инструмент для программирования баз данных, приложений и веб-сервисов" />     <meta name="keywords" content="автоматизация бизнеса,гугл таблицы,создать базу данных,конструктор интеграм,инт` |

> token/xsrf values differ (expected)

### 2. POST /auth (wrong pwd)

**POST `/auth`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 500 | `` |
| Node | 200 | `<!doctype html> <html> <head>     <meta charset="utf-8">     <meta name="description" content="Простой и мощный инструмент для программирования баз данных, приложений и веб-сервисов" />     <meta name="keywords" content="автоматизация бизнеса,гугл таблицы,создать базу данных,конструктор интеграм,инт` |

### 3. GET /xsrf

**GET `/xsrf?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"_xsrf":"3391b9a929007761cc7869","token":"47555cbbfc9bb0bfb1a90b2ef0846633","user":"testbot","role":"admin","id":"1000000660","msg":""}` |
| Node | 200 | `{"_xsrf":"3391b9a929007761cc7869","id":"1000000660","msg":"","role":"admin","token":"47555cbbfc9bb0bfb1a90b2ef0846633","user":"testbot"}` |

> xsrf values differ (expected)

### 4. GET /validate

**GET `/validate?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `null` |
| Node | 200 | `{"success":true,"user":{"id":1000000660,"login":"testbot"},"valid":true,"xsrf":"3391b9a929007761cc7869"}` |

### 5. POST /getcode

**POST `/getcode`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 500 | `` |
| Node | 200 | `<!doctype html> <html> <head>     <meta charset="utf-8">     <meta name="description" content="Простой и мощный инструмент для программирования баз данных, приложений и веб-сервисов" />     <meta name="keywords" content="автоматизация бизнеса,гугл таблицы,создать базу данных,конструктор интеграм,инт` |

### 6. POST /checkcode (invalid)

**POST `/checkcode`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 500 | `` |
| Node | 200 | `<!doctype html> <html> <head>     <meta charset="utf-8">     <meta name="description" content="Простой и мощный инструмент для программирования баз данных, приложений и веб-сервисов" />     <meta name="keywords" content="автоматизация бизнеса,гугл таблицы,создать базу данных,конструктор интеграм,инт` |

### 7. GET /terms

**GET `/terms`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"id":1000001489,"type":3,"name":":!NULL:"},{"id":1000001488,"type":3,"name":":ALIAS=test::!NULL:renamed"},{"id":220822,"type":3,"name":"agent_applications"},{"id":220824,"type":3,"name":"agent_tasks"},{"id":238200,"type":3,"name":"AI Agent Demo"},{"id":238206,"type":3,"name":"AI_Agent_Configs"},{"` |
| Node | 200 | `[{"id":1000001489,"name":":!NULL:","type":3},{"id":1000001488,"name":":ALIAS=test::!NULL:renamed","type":3},{"id":220822,"name":"agent_applications","type":3},{"id":220824,"name":"agent_tasks","type":3},{"id":238200,"name":"AI Agent Demo","type":3},{"id":238206,"name":"AI_Agent_Configs","type":3},{"` |

> PHP: 232 types, Node: 232 types

### 8. GET /metadata

**GET `/metadata?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"id":"18","up":"0","type":"3","val":"User1","unique":"0","reqs":[{"num":1,"id":"274","val":"social","orig":"273","type":"3"},{"num":2,"id":"115","val":"Role","orig":"42","type":"3","ref":"42","ref_id":"114","attrs":":!NULL:164"},{"num":3,"id":"41","val":"Email","orig":"31","type":"3","attrs":":!NU` |
| Node | 200 | `[{"id":"18","reqs":[{"id":"274","num":1,"orig":"273","type":"3","val":"social"},{"attrs":":!NULL:164","id":"115","num":2,"orig":"42","ref":"42","ref_id":"114","type":"3","val":"Role"},{"attrs":":!NULL:","id":"41","num":3,"orig":"31","type":"3","val":"Email"},{"id":"30","num":4,"orig":"21","type":"3"` |

### 9. GET /obj_meta

**GET `/obj_meta/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1000003287","up":"1","type":"1000003285","val":"item_0","reqs":{"":{"id":"","val":"","type":""}}}` |
| Node | 200 | `{"id":"1000003286","reqs":{"1":{"attrs":"1","id":"1000003300","type":"11","val":"__cmp_num_n_1773532165509"}},"type":"1000003284","up":"1","val":"item_0"}` |

> IDs differ (expected)

### 10. POST /_d_new (create type)

**POST `/_d_new`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"","obj":1000003302,"next_act":"edit_types","args":"ext","warnings":""}` |
| Node | 200 | `{"args":"ext","id":"","next_act":"edit_types","obj":1000003301,"warnings":""}` |

### 11. POST /_d_save (rename type)

**POST `/_d_save/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"error":"Неверный базовый тип (0) "}]` |
| Node | 200 | `{"args":"ext","id":1000003284,"next_act":"edit_types","obj":1000003284,"warnings":""}` |

### 12. POST /_d_req (add column)

**POST `/_d_req/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":1000003304,"obj":1000003285,"next_act":"edit_types","args":"ext","warnings":""}` |
| Node | 200 | `{"args":"ext","id":1000003303,"next_act":"edit_types","obj":1000003284,"warnings":""}` |

### 13. POST /_d_ref (add ref column)

**POST `/_d_ref/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":1000003285,"obj":1000003306,"next_act":"edit_types","args":"ext","warnings":""}` |
| Node | 200 | `{"args":"ext","id":1000003284,"next_act":"edit_types","obj":1000003305,"warnings":""}` |

### 14. POST /_m_new (create object)

**POST `/_m_new/:typeId`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":1000003308,"obj":1000003308,"ord":1,"next_act":"edit_obj","args":"new1=1&","val":"NewObj"}` |
| Node | 200 | `{"args":"new1=1&","id":1000003307,"next_act":"edit_obj","obj":1000003307,"ord":4,"val":"NewObj"}` |

### 15. POST /_m_save (update object)

**POST `/_m_save/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1000003285","obj":1000003287,"next_act":"object","args":"saved1=1&F_U=1&F_I=1000003287","warnings":""}` |
| Node | 200 | `{"args":"saved1=1&F_U=1&F_I=1000003286","id":"1000003284","next_act":"object","obj":1000003286,"warnings":""}` |

### 16. POST /_m_set (set attribute)

**POST `/_m_set/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"","obj":1000003289,"next_act":"nul","args":"","warnings":""}` |
| Node | 200 | `{"args":"","id":"1000003309","next_act":"nul","obj":1000003288,"warnings":""}` |

### 17. POST /_m_save (copy object)

**POST `/_m_save/:id&copybtn`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1000003285","obj":1000003311,"next_act":"object","args":"copied1=1&F_U=1&F_I=1000003311","warnings":""}` |
| Node | 200 | `{"args":"copied1=1&F_U=1&F_I=1000003310","id":"1000003284","next_act":"object","obj":1000003310,"warnings":""}` |

### 18. POST /_m_ord (set order)

**POST `/_m_ord/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1","obj":"1","next_act":"_m_ord","args":"","warnings":""}` |
| Node | 200 | `{"args":"","id":"1","next_act":"_m_ord","obj":"1","warnings":""}` |

### 19. POST /_m_up (move up)

**POST `/_m_up/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1000003285","obj":null,"next_act":"object","args":"F_U=1","warnings":""}` |
| Node | 200 | `{"args":"F_U=1","id":"1000003284","next_act":"object","obj":null,"warnings":""}` |

### 20. POST /_m_id (change ID)

**POST `/_m_id/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":851166,"obj":851166,"next_act":"_m_id","args":"","warnings":""}` |
| Node | 200 | `{"args":"","id":851167,"next_act":"_m_id","obj":851167,"warnings":""}` |

### 21. GET /object/:type?JSON=1

**GET `/object/:type?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"&main.a":{"_parent_.title":["__cmp_type_p_1773532165509"]},"type":{"id":1000003285,"up":1,"val":"__cmp_type_p_1773532165509","base":"SHORT"},"base":{"id":"3","unique":""},"&main.a.&uni_obj":{"create_granted":["block"],"id":["1000003285"],"f_u":[""],"up":["1"],"unique":[""],"base_typ":["3"],"filter` |
| Node | 200 | `{"&main.a":{"_parent_.title":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":["1000003284"],"lnx":["0"],"typ":["1000003284"],"unique":[""],"up":["1"],"val":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_` |

> PHP: 5 objs, Node: 5 objs

### 22. GET /object/:type?JSON_DATA

**GET `/object/:type?JSON_DATA`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"i":851166,"u":1,"o":0,"r":["item_2","",""]},{"i":1000003287,"u":1,"o":0,"r":["Updated","",""]},{"i":1000003289,"u":1,"o":0,"r":["item_1","",""]},{"i":1000003308,"u":1,"o":0,"r":["NewObj","",""]},{"i":1000003311,"u":1,"o":0,"r":["Updated","",""]}]` |
| Node | 200 | `[{"i":851167,"o":3,"r":["item_2","",""],"u":1},{"i":1000003286,"o":1,"r":["Updated","",""],"u":1},{"i":1000003288,"o":0,"r":["item_1","",""],"u":1},{"i":1000003307,"o":4,"r":["NewObj","",""],"u":1},{"i":1000003310,"o":0,"r":["CopyObj","",""],"u":1}]` |

### 23. GET /object?JSON=1&LIMIT=2

**GET `/object/:type?JSON=1&LIMIT=2`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"&main.a":{"_parent_.title":["__cmp_type_p_1773532165509"]},"type":{"id":1000003285,"up":1,"val":"__cmp_type_p_1773532165509","base":"SHORT"},"base":{"id":"3","unique":""},"&main.a.&uni_obj":{"create_granted":["block"],"id":["1000003285"],"f_u":[""],"up":["1"],"unique":[""],"base_typ":["3"],"filter` |
| Node | 200 | `{"&main.a":{"_parent_.title":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":["1000003284"],"lnx":["0"],"typ":["1000003284"],"unique":[""],"up":["1"],"val":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_` |

> PHP: 2 objs, Node: 2 objs

### 24. GET /object?F_I=id

**GET `/object/:type?JSON=1&F_I=id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"&main.a":{"_parent_.title":["__cmp_type_p_1773532165509"]},"type":{"id":1000003285,"up":1,"val":"__cmp_type_p_1773532165509","base":"SHORT"},"base":{"id":"3","unique":""},"&main.a.&uni_obj":{"create_granted":["block"],"id":["1000003285"],"f_u":[""],"up":["1"],"unique":[""],"base_typ":["3"],"filter` |
| Node | 200 | `{"&main.a":{"_parent_.title":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"filter":["",""],"id":["1000003284"],"lnx":["0"],"typ":["1000003284"],"unique":[""],"up":["1"],"val":["__cmp_renamed_n_1773532165509"]},"&main.a.&uni_` |

### 25. GET /edit_obj/:id?JSON=1

**GET `/edit_obj/:id?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"obj":{"id":"1000003287","val":"Updated","parent":"1","typ":"1000003285","typ_name":"__cmp_type_p_1773532165509","base_typ":"3"},"&main.a.&object":{"typ":["1000003285","1000003285"],"up":["1"],"typ_name":["__cmp_type_p_1773532165509","__cmp_type_p_1773532165509"],"val":["Updated","Updated"],"id":["` |
| Node | 200 | `{"&main.a.&object":{"disabled":[""],"id":["1000003286"],"typ":["1000003284","1000003284"],"typ_name":["__cmp_renamed_n_1773532165509","__cmp_renamed_n_1773532165509"],"up":["1"],"val":["Updated","Updated"]},"&main.a.&object.&edit_req":{"_parent_.disabled":[""],"_parent_.val":["Updated"],"typ":["1000` |

### 26. GET /edit_types?JSON=1

**GET `/edit_types?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BOOLEAN","MEMO","DATETIME","FILE","HTML","BUTTON","PWD","GRANT","CALCULATABLE","REPORT_COLUMN","PATH"]},"&main.a.&editables":{"ok":[""]},"edit_types":{"` |
| Node | 200 | `{"&main.&top_menu":{"top_menu":["Таблицы","Структура","Файлы"],"top_menu_href":["dict","edit_types","dir_admin"]},"&main.a.&editables":{"ok":[""]},"&main.a.&types":{"typ":["3","8","9","13","14","11","12","4","10","2","7","6","5","15","16","17"],"val":["SHORT","CHARS","DATE","NUMBER","SIGNED","BOOLEA` |

### 27. GET /report/:id?JSON=1

**GET `/report/:id?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"columns":[{"id":"206341","type":"198038","format":"DATETIME","name":"ID","granted":1},{"id":"206343","type":"205916","format":"MEMO","name":"Вопрос","granted":1},{"id":"206345","type":"198041","format":"SHORT","name":"Input","granted":1},{"id":"206347","type":"198042","format":"SHORT","name":"Outp` |
| Node | 200 | `{"columns":[{"align":"LEFT","format":"DATETIME","granted":1,"id":206341,"name":"Транзакция","ref":null,"type":198038},{"align":"LEFT","format":"CHARS","granted":1,"id":206343,"name":"205916","ref":1,"type":205916},{"align":"LEFT","format":"CHARS","id":206343,"name":"205916ID","ref":1,"type":205916},` |

### 28. GET /report/:id?JSON_KV

**GET `/report/:id?JSON_KV`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"ID":"13.12.2025 15:30:00","Вопрос":"Тестовый вопрос","Input":"100","Output":"200","Цена":"5"},{"ID":"13.12.2025 19:30:00","Вопрос":"","Input":"","Output":"","Цена":""},{"ID":"13.12.2025 19:31:28","Вопрос":"Тест учета токенов - Claude Code проверка","Input":"21","Output":"346","Цена":"0"},{"ID":"1` |
| Node | 200 | `[{"198041":"","198042":"","198043":"","205916":"","Транзакция":"20241202"},{"198041":"","198042":"","198043":"","205916":"","Транзакция":"20241202"},{"198041":"","198042":"","198043":"","205916":"","Транзакция":"1765666200"},{"198041":"","198042":"","198043":"","205916":"","Транзакция":"1765666200"}` |

### 29. GET /report/:id?JSON_CR

**GET `/report/:id?JSON_CR`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"columns":[{"id":"206341","name":"ID","type":"string"},{"id":"206343","name":"Вопрос","type":"string"},{"id":"206345","name":"Input","type":"string"},{"id":"206347","name":"Output","type":"string"},{"id":"206349","name":"Цена","type":"string"}],"rows":[{"206341":"13.12.2025 15:30:00","206343":"Тест` |
| Node | 200 | `{"columns":[{"id":"206341","name":"Транзакция","type":"string"},{"id":"206343","name":"205916","type":"string"},{"id":"206345","name":"198041","type":"string"},{"id":"206347","name":"198042","type":"string"},{"id":"206349","name":"198043","type":"string"}],"rows":{"0":{"206341":"20241202","206343":"` |

### 30. GET /report/:id?RECORD_COUNT

**GET `/report/:id?RECORD_COUNT`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `145` |
| Node | 200 | `{"count":20}` |

### 31. GET /report?JSON_KV&LIMIT=2

**GET `/report/:id?JSON_KV&LIMIT=2`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `[{"ID":"13.12.2025 15:30:00","Вопрос":"Тестовый вопрос","Input":"100","Output":"200","Цена":"5"},{"ID":"13.12.2025 19:30:00","Вопрос":"","Input":"","Output":"","Цена":""}]` |
| Node | 200 | `[{"198041":"","198042":"","198043":"","205916":"","Транзакция":"20241202"},{"198041":"","198042":"","198043":"","205916":"","Транзакция":"20241202"}]` |

### 32. GET /dict?JSON=1

**GET `/dict?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"18":"User1","22":"Query","42":"Role","47":"Grant","63":"Function","65":"Total","137":"Form","1141":"Plan","17599":"Recruit ","194865":"Агент","194871":"Категория агента","194876":"creator","194882":"тег","195629":"menu_dash","195686":"Модель","195687":"Провайдер","195690":"Контекстное окно","19569` |
| Node | 200 | `{"18":"User1","22":"Query","42":"Role","47":"Grant","63":"Function","65":"Total","137":"Form","1141":"Plan","17599":"Recruit ","194865":"Агент","194871":"Категория агента","194876":"creator","194882":"тег","195629":"menu_dash","195686":"Модель","195687":"Провайдер","195690":"Контекстное окно","19569` |

### 33. GET /sql?JSON=1

**GET `/sql?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"&main.a.&functions":{"id":["98","89","85","90","93","88","92","87","86","91","77","74","235","75","76","141","140","73","142"],"val":["abn_BT","abn_DATE2STR","abn_ID","abn_NUM2STR","abn_ORD","abn_REQ","abn_ROWNUM","abn_TYP","abn_UP","abn_URL","AVG","COUNT","GROUP_CONCAT","MAX","MIN","MONTH","ROUND` |
| Node | 200 | `{"&main.a.&formats":{"id":["78","34","81","82","79","80"],"val":["DATE","HTML","NUMBER","PATH","SHORT","SIGNED"]},"&main.a.&functions":{"id":["98","89","85","90","93","88","92","87","86","91","77","74","235","75","76","141","140","73","142"],"val":["abn_BT","abn_DATE2STR","abn_ID","abn_NUM2STR","abn` |

### 34. GET /form?JSON=1

**GET `/form?JSON=1`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"edit_types":{"0":["1000001489","1000001488","2974","2974","2974","2974","2974","220822","220822","220822","220822","220822","220822","220822","220822","238200","238200","238200","238200","238206","238206","238206","238206","198016","198016","198016","198016","198016","198016","198016","198016","19` |
| Node | 200 | `{"edit_types":{"0":["1000001489","1000001488","2974","2974","2974","2974","2974","220822","220822","220822","220822","220822","220822","220822","220822","238200","238200","238200","238200","238206","238206","238206","238206","198016","198016","198016","198016","198016","198016","198016","198016","19` |

### 35. GET /terms (invalid db)

**GET `/nonexistent_db/terms`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `Invalid database` |
| Node | 200 | `Invalid database` |

### 36. POST /_m_del (delete object)

**POST `/_m_del/:id`**

| | Status | Body (first 300 chars) |
|---|--------|------------------------|
| PHP | 200 | `{"id":"1000003285","obj":851166,"next_act":"object","args":"","warnings":""}` |
| Node | 200 | `{"args":"","id":"1000003284","next_act":"object","obj":851167,"warnings":""}` |

## Summary

**23 MATCH / 13 DIFF** out of 36 tests.

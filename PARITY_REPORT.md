# Отчёт о расхождениях: PHP vs Node.js

**Дата:** 2026-03-16
**Метод:** Параллельный аудит 5 агентов + ручная верификация кодом
**Файлы:** `integram-server/index.php` (9252 строки) vs `backend/monolith/src/api/routes/legacy-compat.js` (14769 строк)

---

## Критические проблемы

### C1 — `restore`: полностью противоположное поведение

**PHP** (`index.php:4237`):
```php
die("INSERT INTO `$z` (`id`, `t`, `up`, `ord`, `val`) VALUES $output;");
```
PHP **возвращает SQL строку** клиенту. Клиент должен сам её выполнить.

**Node** (`legacy-compat.js:14374`):
```js
await insertBatch(pool, db, rows, { ... });
res.json({ status: 'Ok', rows: rows.length });
```
Node **выполняет INSERT немедленно** и возвращает `{status:'Ok', rows:N}`.

**Опасность:**
- Клиент ожидающий SQL строку получит `{status:'Ok'}` и ничего не сделает — данные не восстановятся молча.
- Клиент ожидающий автоматическое выполнение на PHP — получит SQL текст и выполнит его дважды.
- Node добавляет `?sql` режим для обратной совместимости, но он не дефолтный.

---

### C2 — `nul` next_act: PHP возвращает JSON, Node возвращает пустую строку

**PHP** (`index.php:9241-9242`):
```php
if($next_act == "nul")
    die('{"id":"'.$id.'", "obj":"'.$obj.'", "a":"'.$a.'", "args":"'.$arg.'"}');
```
При `next_act=nul` PHP возвращает JSON объект с полями `id`, `obj`, `a`, `args`.

**Node** (`legacy-compat.js:585`):
```js
if (effectiveNextAct === 'nul') return res.send('');
```
Node возвращает **пустую строку**.

**Опасность:**
- Это путь который явно запрашивает клиент (`?next_act=nul`). Клиент ожидает JSON с `"a"` полем для определения следующего действия.
- Пустой ответ ломает клиентскую логику — нет данных о том, что делать дальше.
- Поле `"a"` (action) есть только в этом пути PHP и нигде не документировано в Node.

---

## Высокие проблемы

### H1 — `_m_set`: файлы сохраняются по неверному пути

**PHP** (`index.php:7986`):
```php
$subdir = GetSubdir($req_id);   // путь = floor(req_id/1000) + sha-суффикс
GetFilename($req_id)             // имя  = sha1(req_id)
```
PHP использует ID **атрибута** (строки реквизита) для вычисления пути.

**Node** (`legacy-compat.js:7985`):
```js
const subdir = getSubdir(db, objectId);    // путь от ID объекта
const baseName = getFilename(db, objectId); // имя от ID объекта
```
Node использует ID **родительского объекта**.

**Опасность:**
- Файлы загружённые через Node хранятся в `/download/{objectId_subdir}/` вместо `/download/{req_id_subdir}/`.
- Ссылки на файлы (`args` в ответе) указывают на неверный путь — файл скачать невозможно.
- PHP клиент открывающий файл по пути из ответа получит 404.
- Файлы накапливаются в неверных директориях — нет очистки.

---

### H2 — `_ref_reqs`: пропущена фильтрация по ролям (security regression)

**PHP** (`index.php:9100-9140`):
```php
if(isset($GLOBALS["GRANTS"]["mask"])){
    // Применяет маску доступа к значениям выпадающего списка
    foreach($GLOBALS["GRANTS"]["mask"][$dic] as $mask => $level){
        Construct_WHERE($dic, array("F" => $mask), 1, FALSE);
        $granted .= ...
    }
    $reqs_granted .= " AND ($granted)";
}
```
PHP фильтрует значения справочника по правам роли пользователя.

**Node** (`legacy-compat.js:9128`):
```js
// PHP does NOT apply grant mask filtering on _ref_reqs (#429)
```
Комментарий неверен — PHP применяет фильтрацию. Node пропускает её полностью.

**Опасность:**
- Пользователь с ограниченными правами видит в выпадающем списке **все** значения справочника, включая закрытые для него.
- Это утечка данных: секретные объекты, клиенты других пользователей, скрытые записи — всё видно в dropdown.
- Проблема затрагивает все reference-поля во всех формах редактирования.

---

### H3 — `_d_del_req`: формат ошибки — объект вместо массива

**PHP** `my_die()` (`index.php:994`):
```php
die("[{\"error\":\"$msg\"}]");  // JSON МАССИВ
```

**Node** (`legacy-compat.js:9992`):
```js
return res.status(200).type('text/html; charset=UTF-8').send(JSON.stringify({
    error: `...`  // JSON ОБЪЕКТ
}));
```
Комментарий в коде Node (`// PHP parity (issue #542): my_die() returns plain object`) — **неверный**.

**Опасность:**
- Клиент проверяющий `response[0].error` получит `undefined` вместо текста ошибки.
- Ошибки при удалении реквизита (используется в отчётах/ролях) проходят незамеченными.
- Затрагивает два места: `usageRow.cnt > 0` без `forced` и `repRoleRow` check.

---

### H4 — `obj_meta`: поле `attrs` захардкожено в `"1"`

**PHP** (`index.php:8860`):
```php
.($row["attrs"] ? ",\"attrs\":\"".$row["attrs"]."\"" : "")
```
PHP возвращает **реальное значение** из БД: `:ALIAS=Название::!NULL:` и т.п.

**Node** (`legacy-compat.js:10379`):
```js
// PHP normalizes attrs to just "1" (flag indicating attributes exist)
if (row.attrs) reqEntry.attrs = '1';
```
Node всегда возвращает строку `"1"`.

**Опасность:**
- Клиент читающий `attrs` для получения alias реквизита получит `"1"` — alias потерян.
- NOT_NULL маска (`:!NULL:`) не видна клиенту — формы не знают что поле обязательное.
- MULTI маска (`:MULTI:`) не видна — поведение множественного выбора сломано.
- Затрагивает все формы редактирования объектов использующие `obj_meta`.

---

### H5 — `csv_all`: несовместимый формат CSV

**PHP** (`index.php:4006-4011`):
```php
function maskCsvDelimiters($v){
    if(strpos($v,"\"") !== false)
        return "\"".str_replace("\"","\"\"",$v)."\"";  // RFC 4180: кавычки
    elseif(strpos($v,";") !== false)
        return "\"".$v."\"";
    return $v;
}
```

**Node** (`legacy-compat.js:12897`):
```js
return str.replace(/;/g, '\\;').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
```

**Опасность:**
- Файлы экспортированные из Node не открываются корректно в Excel/LibreOffice.
- Значения содержащие `;` выглядят как `value\;with\;semis` — парсеры не понимают backslash-escape в CSV.
- Перенос строки внутри значения преобразуется в `\n` (буква n) вместо правильного quoted-field.
- Импорт таких файлов обратно в другую систему невозможен.

---

### H6 — Express автоматически экранирует `<`, `>`, `&`

**PHP** с `JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE`:
```json
{"val": "<div>Tom & Jerry</div>"}
```

**Node** через `res.json()` (Express default XSS protection):
```json
{"val": "\u003cdiv\u003eTom \u0026 Jerry\u003c/div\u003e"}
```

**Опасность:**
- Любое поле содержащее HTML (описания, тексты, значения с `&`) будет иметь другой байтовый вид.
- Клиент сравнивающий ответы PHP и Node побайтово — получит расхождение.
- Особенно критично для `val` полей с HTML-разметкой (сообщения, названия с `&`).
- Затрагивает **все** JSON-ответы через `legacyRespond()` и `res.json()`.

---

### H7 — `JSON_HEX_QUOT`: двойные кавычки кодируются по-разному

**PHP** (`index.php:9250`):
```php
json_encode(..., JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE)
// "args": "value \"quoted\" text"  →  "args": "value \u0022quoted\u0022 text"
```

**Node**: `JSON.stringify` — стандартное экранирование `\"`.

**Опасность:**
- Если в значениях полей (`args`, `warnings`, `val`) есть двойные кавычки — байтовое представление отличается.
- Критично для полей типа `args` в ответах DDL-эндпоинтов — там могут быть строки с кавычками.

---

### H8 — Report non-execute + isApi: разные тела ответа

**PHP** (`index.php:9220-9224`):
```php
if(isApi())
    die(json_encode($GLOBALS["GLOBAL_VARS"]["api"], ...));
```
Возвращает объект `api` — данные страницы (типы, объекты, иерархия).

**Node** (`legacy-compat.js:12519`):
```js
return res.json({
    id: report.id, name: report.header, columns: ..., head: ..., types: ...
});
```
Возвращает определение отчёта.

**Опасность:**
- Клиент запрашивающий `?JSON` без флага execute получает структурно разные данные.
- PHP даёт `api` объект для SPA-навигации; Node даёт схему отчёта.
- Любой клиент использующий этот режим (предпросмотр, навигация) сломается.

---

## Средние проблемы

### M1 — `_d_req`: отсутствие параметра `t` ведёт себя по-разному

**PHP** (`index.php:8561`): `if(($id == 0) || ($t == 0)) my_die(...)` — ошибка.
**Node** (`legacy-compat.js:9504`): `parseInt(req.body.t || '8', 10)` — молча подставляет тип CHARS (8).

**Опасность:** Клиент с багом (не передаёт `t`) получит от Node успех с неверным типом реквизита вместо ошибки.

---

### M2 — `_d_req`: Node сохраняет `alias`/`required` при создании, PHP нет

**PHP**: при создании реквизита сохраняет `""` или `:MULTI:`.
**Node**: может сохранить `:ALIAS=x::!NULL::MULTI:` если клиент передал эти параметры.

**Опасность:** Реквизиты созданные через Node имеют флаги которые PHP никогда не устанавливает при создании. Поведение при дальнейшем редактировании через PHP может быть непредсказуемым.

---

### M3 — `_ref_reqs` пустой результат: PHP `[]` vs Node `{}`

**PHP**: `json_encode(Array())` → `[]` (пустой массив).
**Node**: `res.json({})` → `{}` (пустой объект).

**Опасность:** Клиент использующий `Object.entries(result)` или `for..in` — работает для обоих. Но клиент проверяющий `Array.isArray(result)` или `result.length` — получит неверный результат от Node для пустых списков.

---

### M4 — `_ref_reqs` id=0: PHP ошибка, Node продолжает

**PHP** (`index.php:9013`): `if((int)$id === 0) die("{\"error\":\"Invalid id\"}");`
**Node**: нет проверки, выполняет SQL запрос с `id=0`.

---

### M5 — `upload`: PHP 302 redirect, Node 200 JSON

**PHP**: после загрузки файла через `dir_admin` → `header("Location: ...")`.
**Node**: POST `/upload` → `200 {status:'Ok', filename, path}`.

**Опасность:** HTML-форма загрузки ожидает redirect — после Node ответа форма не перенаправится.

---

### M6 — POST `/auth` ошибка смены пароля: разные токены в ответе

**PHP**: всегда вызывает `updateTokens()` и возвращает реальный `token`/`_xsrf` даже при ошибке валидации пароля.
**Node**: при ошибке возвращает `{_xsrf: '', token: '', id: 0, msg: '...'}`.

**Опасность:** Клиент после неудачной смены пароля теряет сессию если использует Node.

---

### M7 — `backup`/`csv_all`/`restore` при отказе доступа: PHP 200, Node 403

**PHP**: `die(t9n(...))` — HTTP 200 с текстом ошибки в теле.
**Node**: `res.status(403).send(...)` — HTTP 403.

**Опасность:** Клиент проверяющий только HTTP статус для доступа — не заметит ошибку от PHP. Клиент ожидающий 200 от Node — не обработает 403.

---

### M8 — `isApiRequest()` шире `isApi()`

**PHP**: только `?JSON`, `?JSON_DATA`, `?JSON_KV`, `?JSON_CR`, `?JSON_HR`.
**Node**: плюс `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`, `?csv`, `?format=csv`, `?RECORD_COUNT`.

**Опасность:** AJAX-запросы с `Content-Type: application/json` получают от Node JSON, а от PHP — HTML/redirect. Меняет поведение auth-middleware (JSON ошибка vs 302 redirect).

---

### M9 — `_d_null`/`_d_multi`: PHP toggle, Node принимает явное значение

**PHP**: всегда инвертирует флаг `:!NULL:` / `:MULTI:`.
**Node**: если в теле запроса есть `required`/`multi` — устанавливает явно, иначе инвертирует.

**Опасность:** Клиент передающий `required=1` при повторном вызове получит разное поведение от PHP и Node.

---

### M10 — `terms` double-encoding HTML entities

**PHP** (`index.php:8948`): `htmlspecialchars($val)` вставляется в ручную строку JSON — `&amp;` остаётся как есть.
**Node**: `htmlEsc(val)` → `&amp;` → затем `res.json()` кодирует `&` → `\u0026amp;`.

**Опасность:** Названия типов содержащие `&` (например `"Tom & Jerry"`) отображаются как `Tom &amp; Jerry` вместо `Tom & Jerry`.

---

### M11 — `metadata` val escaping: двойное экранирование

**PHP** (`index.php:8898`): `addcslashes($val, "\\'")` → `\'` как буквальный текст в JSON строке.
**Node**: `replace(/'/g, "\\'")` → `res.json()` кодирует `\` → `\\` → двойное экранирование.

**Опасность:** Атрибуты реквизитов содержащие одинарные кавычки отображаются с лишними backslash.

---

### M12 — Auth: DB не найдена

**PHP** (`index.php:41`): `header("HTTP/1.0 404 Not found"); die("$z does not exist")`.
**Node**: нет проверки в middleware — SQL ошибка → `sendLegacyDie(..., 401)`.

**Опасность:** Клиент проверяющий существование БД по статусу 404 — получит 401 от Node.

---

### M13 — `_connect` без коннектора

**PHP**: выходит из `case` через `break` без ответа → default handler → рендерит страницу объекта.
**Node** (`legacy-compat.js:9163`): возвращает `legacyRespond({id, obj:null, next_act:'_connect', ...})`.

**Опасность:** Клиент ожидающий данные объекта получит структурированный error-like JSON.

---

## Низкие проблемы

### L1 — Content-Type на успешных ответах

Эндпоинты `getcode`, `_m_new`, `_m_set`, `_ref_reqs`:
- **PHP**: `die()` → `text/html` (глобальный заголовок `index.php:3`)
- **Node**: `res.json()` → `application/json`

Практического эффекта нет если клиент парсит JSON не глядя на Content-Type.

---

### L2 — `api_dump` заголовки отсутствуют в Node

**PHP**: каждый JSON ответ через `api_dump` содержит:
- `Content-Disposition: attachment;filename=api.json`
- `Content-Transfer-Encoding: binary`

**Node**: `Content-Disposition` добавлен через middleware (`phpJsonMiddleware`) — проверить полноту покрытия. `Content-Transfer-Encoding: binary` не отправляется нигде.

---

### L3 — legacyAuthMiddleware: токен без Bearer

**PHP** (`index.php:1169`): raw token в Authorization заголовке → `htmlentities()`.
**Node**: raw token используется без `htmlentities()`.
Практически безвредно — токены hex-строки.

---

### L4 — `dir_admin ?gf` файл не найден

**PHP**: HTTP 200 + текст "File not found".
**Node**: HTTP 404.

---

### L5 — `dir_admin` временны́е метки файлов

**PHP**: `date()` → timezone сервера (обычно UTC+3 и т.п.).
**Node**: `toUTCString()` → UTC.

---

### L6 — `_d_up` / `_m_up`: UPDATE по `ord` vs по `id`

**PHP**: swap строк находя по значению `ord` — если дубли ord, затронет несколько строк.
**Node**: swap строго по `id` — только 2 строки.

---

### L7 — `exit` не поддерживает `next_act`

**PHP**: после выхода если `$next_act` задан → JS redirect через `document.location.href`.
**Node**: `next_act` игнорируется.

---

### L8 — `checkcode` без email валидации в Node

**PHP**: проверяет email через `MAIL_MASK` → `{"error":"invalid data"}`.
**Node**: без проверки → `{"error":"user not found"}` при несуществующем email.

---

### L9 — Basic Auth не поддерживается в Node

**PHP** (`index.php:1138`): декодирует `Authorization: Basic base64(user:pass)`.
**Node**: только Bearer токен.

---

### L10 — Гостевой токен: PHP обновляет значение токена на xsrf (quirk)

**PHP** (`index.php:1226`): `Update_Val($row["token"], $xsrf)` — записывает xsrf в поле токена (вероятно ошибка copy-paste).
**Node**: не воспроизводит эту аномалию.

---

## Итоговая таблица

| Уровень | Кол-во | Описание |
|---------|--------|----------|
| Критический | 2 | Полностью сломанная функциональность |
| Высокий | 8 | Потеря данных / security regression / несовместимые форматы |
| Средний | 13 | Неверные статусы / некорректные форматы / скрытые баги |
| Низкий | 10 | Заголовки / edge cases / незначительные расхождения |
| **Итого** | **33** | |

## Приоритет исправления

1. **H2** — `_ref_reqs` grant mask (утечка данных)
2. **C1** — `restore` (инверсия поведения)
3. **C2** — `nul` next_act (сломанная навигация)
4. **H1** — `_m_set` путь файла (битые ссылки)
5. **H3** — `_d_del_req` формат ошибки
6. **H4** — `obj_meta` attrs
7. **H5** — csv_all формат
8. **H6** — Express `<>&` escaping (системная проблема)
9. **H7** — JSON_HEX_QUOT
10. **H8** — Report non-execute

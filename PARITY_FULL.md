# PHP vs Node.js Parity Audit — Final Report
**Date:** 2026-03-16
**Rounds:** 3 independent passes + manual code reads for disputed items
**PHP:** `integram-server/index.php`
**Node:** `backend/monolith/src/api/routes/legacy-compat.js`

---

## Legend
- 🔴 CRITICAL — data corruption, security bypass, or core feature broken
- 🟠 HIGH — wrong data returned, ACL not enforced, wrong field value
- 🟡 MEDIUM — response format / encoding / protocol mismatch
- 🟢 LOW — minor, unlikely to affect clients in practice

---

## 1. CRITICAL

### 1.1 🔴 `restore` — Node executes SQL; PHP returns it
PHP (`index.php:4237`):
```php
die("INSERT INTO `$z` (`id`, `t`, `up`, `ord`, `val`) VALUES $output;");
```
Always returns SQL text. Never executes it. Client reviews and decides.

Node (`legacy-compat.js:14373`): calls `insertBatch()` and modifies the database. Returns SQL text only if `?sql` param is passed.

**Risk:** Default restore call on Node silently modifies live data without review.

---

### 1.2 🔴 `_ref_reqs` — grant mask filtering absent in Node
PHP (`index.php:9100–9121`): builds `$reqs_granted` WHERE clause from `$GLOBALS["GRANTS"]["mask"]`, filtering rows the user cannot access.

Node (`legacy-compat.js:9128`):
```javascript
// PHP does NOT apply grant mask filtering on _ref_reqs (#429)
```
Comment is factually wrong. PHP does apply it. Node never does.

**Risk:** Restricted requisite metadata exposed to all authenticated users.

---

### 1.3 🔴 Object list — BARRED columns not filtered in Node
PHP (`index.php:5780–5782`):
```php
if(isset($GLOBALS["GRANTS"][$row["id"]]))
    if($GLOBALS["GRANTS"][$row["id"]] == "BARRED")
        continue;
```
Also at lines 4677–4679 and 6411–6413.

Node (`legacy-compat.js:5883–5890`): iterates all rows, no BARRED check anywhere.

**Risk:** Confidential fields exposed to users without access.

---

### 1.4 🔴 `dir_admin` — POST mutations completely absent in Node
PHP (`index.php:6650–6726`): `POST /:db/dir_admin` handles:
- `mkdir` (line 6650) — create directory
- `touch` (line 6666) — create blank file
- `upload` (line 6687) — upload files to `templates/` or `download/`
- `delete` (line 6714) — delete files/dirs

All four check XSRF and WRITE grant.

Node (`legacy-compat.js:11063`): only `router.get(...)` exists. No POST handler.

**Risk:** File manager is read-only via Node. All mutations silently unavailable.

---

### 1.5 🔴 `restore` — reads backup file from wrong directory
PHP (`index.php:4183–4186`):
```php
$path = "templates/custom/$z/backups";
```
Same directory `backup` writes ZIP files to.

Node (`legacy-compat.js:14277–14279`):
```javascript
const backupDir = path.join(legacyPath, 'download', db);
```
Different directory. Files written by `backup` are never found by `restore`.

**Risk:** `restore` is broken end-to-end.

---

### 1.6 🔴 `restore` — `/`-prefixed lines parse `up`/`t` in wrong order
Dump format for `/`-prefixed lines: id increments by 1, `up` is **omitted** (carried over from previous row), remaining content is `{t};{ord};{val}`.

PHP (`index.php:4204–4222`): the `$lastup` parse block is **inside** the `else{}` (lines 4218–4221). For `/` prefix, the `else` is skipped → `$lastup` stays from previous row → first remaining token parsed as `$lastt`. ✓

Node (`legacy-compat.js:14321–14336`): `lastUp` parse is **outside** the if/else (lines 14334–14336) → always executes → reads `t` as `up`, `ord` as `t`. ✗

**Verified by manual code read.** The brace structure is unambiguous.

**Risk:** Every `/`-prefixed row restored with wrong parent (`up`) and wrong type (`t`). Silent structural corruption.

---

### 1.7 🔴 `_m_set` file upload — path computed from wrong ID
PHP (`index.php:7980–7986`):
```php
$req_id = $row["id"];            // ID of the value row (SELECT ... WHERE up=$obj AND t=$t)
// or:
$req_id = Insert($obj, 1, $t, ...); // ID of the newly inserted value row
$subdir = GetSubdir($req_id);    // path based on VALUE ROW ID
```

Node (`legacy-compat.js:7985`):
```javascript
const subdir = getSubdir(db, objectId); // path based on PARENT OBJECT ID
```

`GetSubdir` / `getSubdir` formulas are identical (`floor(id/1000) + sha[0:8]`), but inputs are different IDs. **Verified by manual code read.**

**Risk:** Files saved by Node are in a different directory than PHP would look for them. Cross-backend file access breaks silently.

---

### 1.8 🔴 `upload` (`POST /:db/upload`) — allowlist blocks legitimate types
PHP `BlackList()` (`index.php:574–577`): blocklist — rejects only `php cgi pl fcgi fpl phtml shtml php2 php3 php4 php5 asp jsp`.

Node (`legacy-compat.js:10929–10932`):
```javascript
const allowed = /\.(pdf|doc|docx|xls|xlsx|csv|txt|png|jpg|jpeg|gif|zip|rar|7z|odt|ods)$/i;
```
Allowlist — silently rejects `.html`, `.xml`, `.bki`, `.dmp`, `.svg`, `.js`, `.json`, `.ico`, `.css` and everything else not listed.

**Risk:** Users cannot upload template files, dump files, or any application-managed format outside the hardcoded list.

---

## 2. HIGH

### 2.1 🟠 `nul` next_act — Node returns empty string
PHP (`index.php:9241`):
```php
if($next_act == "nul")
    die('{"id":"'.$id.'", "obj":"'.$obj.'", "a":"'.$a.'", "args":"'.$arg.'"}');
```

Node (`legacy-compat.js:585`):
```javascript
if (effectiveNextAct === 'nul') return res.send('');
```

**Risk:** Client gets no ID or action data; any code reading `result.id` after a save fails.

---

### 2.2 🟠 Object list — `create_granted` hardcoded `'block'`
PHP (`index.php:5131–5134`):
```php
if((Grant_1level($id) == "WRITE") || Check_Grant($f_u, $id, "WRITE", FALSE))
    $blocks[$block]["create_granted"][] = "block";
else
    $blocks[$block]["create_granted"][] = "none";
```

Node (`legacy-compat.js:5782`): `create_granted: ['block']` — hardcoded.

**Risk:** "none" access level never returned. All users appear to have create permission.

---

### 2.3 🟠 Object list — per-row `grant` field absent in Node
PHP (`index.php:5784`):
```php
$blocks[$block]["grant"][] = isset($GLOBALS["GRANTS"][$row["id"]])
    ? $GLOBALS["GRANTS"][$row["id"]] : "";
```
Each row gets its grant level (e.g., `"READ"`, `"WRITE"`, `"BARRED"`).

Node (`legacy-compat.js:5885`): object row is `{id, up, val, base}` — no `grant` field.

**Risk:** Per-requisite access level not communicated to client.

---

### 2.4 🟠 Object list — `val` not formatted via `Format_Val_View`
PHP (`index.php:6130`):
```php
$GLOBALS["GLOBAL_VARS"]["api"]["object"][$i]["val"] = Format_Val_View($cur_base_typ, $v, $row["id"]);
```

Node (`legacy-compat.js:5885`): `val: htmlEsc(r.val || '')` — raw DB value.

**Risk:** DATE fields show `2026-03-16` instead of formatted `16.03.2026`. NUMBER fields unformatted.

---

### 2.5 🟠 `edit_obj` — `disabled` never set from ACL
PHP (`index.php:4348–4354`):
```php
if(Check_Grant($row["id"], 0, "WRITE", FALSE))
    $parent_disabled = "";
else if(Check_Val_granted(...) === "WRITE")
    $parent_disabled = "";
else
    $parent_disabled = "DISABLED";
```

Node (`legacy-compat.js:6420`): `disabled: ['']` — hardcoded empty.

**Risk:** Read-only fields are editable by all users.

---

### 2.6 🟠 `edit_obj` — `type` ignores DATE base type
PHP (`index.php:4466`):
```php
$blocks[$block]["type"][] = ($base == "DATE" ? "date" : "text");
```

Node (`legacy-compat.js:6423`): `type: ['text']` — hardcoded.

**Risk:** DATE fields render as plain text inputs, not date pickers.

---

### 2.7 🟠 `obj_meta` — `attrs` hardcoded `'1'`
PHP (`index.php:8860`):
```php
.($row["attrs"]?",\"attrs\":\"".$row["attrs"]."\"":"")
```
Raw DB value, key omitted when empty.

Node (`legacy-compat.js:10379`): `if (row.attrs) reqEntry.attrs = '1';` — always `'1'`.

**Risk:** Type attribute flags always reported as `'1'` regardless of actual value.

---

### 2.8 🟠 Reports — Node adds `{name}ID` companion columns
PHP: builds columns from stored report definition only. No extras.

Node (`legacy-compat.js:12466–12479`): for each `isMainCol` or `isRef` column, inserts an extra column with name `{name}ID`.

**Risk:** Report column count differs. Clients parsing by position get wrong data.

---

### 2.9 🟠 `_d_del_req` errors — plain object instead of array
PHP (`index.php:985–998`), `my_die()`:
```php
if(isApi())
    die("[{\"error\":\"$msg\"}]");   // array-wrapped
```

Node (`legacy-compat.js:9992`, `10005`):
```javascript
res.send(JSON.stringify({ error: `...` }));  // plain object
```

**Risk:** Clients checking `result[0].error` get `undefined`.

---

### 2.10 🟠 `restore` — CRLF dumps get trailing `\r` in every value
PHP (`index.php:4232`): `substr($line, $delim+1, -1)` — `-1` trims trailing char (newline).

Node (`legacy-compat.js:14308`): `dumpContent.split('\n')` — no `\r` stripping. Line 14350 replaces `&ritrr;` escape sequences but not literal `\r`.

**Risk:** All string values from Windows-created backups contain trailing `\r`.

---

## 3. MEDIUM

### 3.1 🟡 `legacyRespond()` sends `application/json`; PHP sends `text/html`
PHP (`index.php:3`): `header("Content-Type: text/html; charset=UTF-8")` — global, never changed.

Node (`legacy-compat.js:577`): `res.json(...)` → `Content-Type: application/json`.

Note: `sendLegacyDie()` in Node correctly uses `text/html` for error responses.

---

### 3.2 🟡 `isApiRequest()` triggers on more signals than PHP
PHP (`index.php:79`): checks only `JSON / JSON_DATA / JSON_KV / JSON_CR / JSON_HR` in POST/GET.

Node (`legacy-compat.js:364–394`): all of the above, plus `?RECORD_COUNT`, `?csv`, `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`.

---

### 3.3 🟡 `admin` username check case-insensitive in Node
PHP (`index.php:4089`, `4242`): `$user != "admin"` — case-sensitive.

Node (`legacy-compat.js:12740`, `13131`, `14262`): `username.toLowerCase() !== 'admin'` — case-insensitive.

Affects `csv_all`, `backup`, `restore`.

---

### 3.4 🟡 `csv_all` — Node uses backslash escaping instead of RFC 4180
PHP (`index.php:4005–4010`): wraps in `"` when field contains `"` or `;`, doubles internal `"`. RFC 4180 compliant.

Node (`legacy-compat.js:12897–12901`): `str.replace(/;/g, '\\;')` — non-standard backslash escaping.

**Risk:** CSV output not interchangeable. Spreadsheets misparse fields with `;`.

---

### 3.5 🟡 `_connect` — PHP is GET-only; Node proxies POST body
PHP (`index.php:9168–9182`): only `CURLOPT_URL` set. No POST forwarding.

Node (`legacy-compat.js:9183–9201`): checks `req.body`, builds POST request with `application/x-www-form-urlencoded` or multipart.

---

### 3.6 🟡 `_ref_reqs` id=0 — PHP returns error object; Node returns `[]`
PHP (`index.php:9013`): `die("{\"error\":\"Invalid id\"}")` — plain error object.

Node (`legacy-compat.js:8820`): returns `[]` — empty array.

---

### 3.7 🟡 `terms` — Node escapes `'` → `&#039;`; PHP does not
PHP (`index.php:8948`): `htmlspecialchars($val)` with default `ENT_COMPAT` — does NOT escape `'`.

Node (`legacy-compat.js:1357`): `htmlEsc()` — `.replace(/'/g, '&#039;')` — escapes `'`.

`O'Brien` → PHP: `O'Brien` / Node: `O&#039;Brien`. Visible if frontend renders raw string.

---

## 4. LOW

### 4.1 🟢 mysql2 returns typed values; PHP returns strings
`mysqli_fetch_array` returns strings for all columns. `mysql2` returns typed values (int, float, null). Strict `===` comparisons may differ; JSON output is equivalent.

---

## 5. Fixed

| Bug | Fix | Where |
|-----|-----|-------|
| `legacyAuthMiddleware` no-token → 200 | Now returns 401 | line ~2950 |
| `_d_del_req` LEFT JOIN (masked test race condition) | Reverted to INNER JOIN | c8e5bf2 |
| **2.1** `nul` → empty string | Returns `{id,obj,a,args}` as text/html | line 585 |
| **2.9** `_d_del_req` errors plain object | Array-wrapped `[{"error":"..."}]` | lines 9992, 10005 |
| **1.5** `restore` wrong directory | `templates/custom/{db}/backups` | line 14278 |
| **1.6** `restore` `/`-prefix parse order | `up` now inside `else{}`, skipped for `/` | lines 14359–14382 |
| **2.10** `restore` CRLF trailing `\r` | Strip `\r` on split | line 14343 |
| **2.7** `obj_meta` attrs hardcoded `'1'` | Returns raw DB value | line 10379 |
| **2.6** `edit_obj` type always `'text'` | DATE base type → `'date'` | line 6423 |
| **1.8** `upload` allowlist → blocklist | Blocked list matching PHP BlackList() | line 10927 |
| **3.6** `_ref_reqs` id=0 → `[]` | Returns `{"error":"Invalid id"}` | line 8820 |
| **1.7** `_m_set` file path objectId → req_id | Queries/inserts value row, uses its ID | lines 7978–8020 |

---

## 6. Definitively Refuted

Each item below was claimed as a bug, investigated across multiple rounds, and rejected.

| Claim | Verdict | Evidence |
|-------|---------|----------|
| File upload: `req_id` vs `objectId` = same ID | **WRONG — re-added as 1.7** | PHP uses VALUE ROW id (from Insert/SELECT); Node uses parent OBJECT id. Manual read confirmed. |
| `_connect` no-row → PHP redirects, Node returns JSON | **NOT A BUG** | PHP `break` falls to `default:` which calls `legacyRespond`. Same result. |
| `&no_page` — Node ignores filter state | **NOT A BUG** | Both check `count == DEFAULT_LIMIT`. Equivalent logic. |
| `uni_obj_head` header grant — Node always `''` | **NOT A BUG** | PHP also outputs `''` for the header block grant. |
| Express `res.json()` escapes `<>&` | **NOT A BUG** | Express does NOT escape `<>&` by default. Claim was wrong. |
| `xsrf` — PHP returns integer `id`, Node returns string | **NOT A BUG** | PHP `mysqli_fetch_array` returns strings; `$user_id` is a string. Node `String(uid)` is also string. Both identical. |
| `terms` double HTML encoding | **NOT A BUG** | Both apply exactly one HTML escape pass. Confirmed twice. |

---

## 7. Final Count

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 8 |
| 🟠 HIGH | 10 |
| 🟡 MEDIUM | 7 |
| 🟢 LOW | 1 |
| **Total confirmed** | **26** |

---

## 8. Fix Priority

1. **restore executes SQL** (1.1) — data modification without review
2. **restore wrong directory** (1.5) — restore completely broken
3. **restore `/` parse order** (1.6) — silent structural corruption on restore
4. **dir_admin POST absent** (1.4) — file manager read-only
5. **upload allowlist** (1.8) — blocks app's own file types
6. **_ref_reqs grant mask** (1.2) — security: exposes restricted metadata
7. **BARRED columns** (1.3) — security: confidential fields leak
8. **_m_set file path** (1.7) — files saved to wrong location
9. **nul empty response** (2.1) — core save flow broken
10. **create_granted hardcoded** (2.2) — create ACL never enforced
11. **Format_Val_View missing** (2.4) — all dates/numbers display wrong
12. **disabled hardcoded** (2.5) — edit ACL not enforced
13. **type hardcoded** (2.6) — date pickers never rendered
14. **obj_meta attrs** (2.7) — type flags always wrong
15. **restore CRLF** (2.10) — trailing `\r` on Windows backups
16. **report companion cols** (2.8) — report column count wrong
17. **per-row grant absent** (2.3) — grant per requisite not returned
18. **Content-Type** (3.1) — application/json vs text/html
19. **CSV escaping** (3.4) — non-RFC 4180 output
20. **terms `'` escaping** (3.7) — apostrophes mangled
21. **_d_del_req error format** (2.9) — object vs array wrapping
22. **admin case check** (3.3) — minor auth bypass
23. **isApiRequest extra triggers** (3.2) — extra JSON detection signals
24. **_connect POST proxy** (3.5) — upstream sees unexpected POST
25. **_ref_reqs id=0** (3.6) — `[]` vs error object

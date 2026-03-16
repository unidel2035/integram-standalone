# PHP vs Node.js Parity Audit Report

**Дата**: 2026-03-16
**Файлы**:
- PHP: `integram-server/index.php` (9252 строк)
- Node: `backend/monolith/src/api/routes/legacy-compat.js` (14811 строк)

**Методология**: 4 независимых агента аудита (раунд 1) + 2 перекрёстных проверки спорных багов (раунд 2) + ручная верификация.

---

## Сводка

| Severity | Всего | Исправлено | Осталось |
|----------|-------|------------|----------|
| 🔴 CRITICAL | 8 | 4 | 4 |
| 🟠 HIGH | 9 | 4 | 5 |
| 🟡 MEDIUM | 7 | 2 | 5 |
| 🟢 LOW | 2 | 0 | 2 |
| **Итого** | **26** | **10** | **16** |

---

## Часть A: Исправленные баги (12 фиксов) — все ВЕРИФИЦИРОВАНЫ ✓

| # | Баг | Фикс | Node строка | Статус |
|---|-----|------|-------------|--------|
| 2.1 | `nul` → пустой ответ | `{id,obj,a,args}` text/html | 587-588 | ✅ VERIFIED |
| 2.9 | `_d_del_req` plain object | `[{"error":"..."}]` array-wrapped | 10023-10038 | ✅ VERIFIED |
| 1.5 | restore — неверная директория | `templates/custom/{db}/backups` | 14312 | ✅ VERIFIED |
| 1.6 | restore — `/-prefix` parse | `lastUp` внутри `else{}` | 14361-14378 | ✅ VERIFIED |
| 2.10 | restore — CRLF | strip `\r` при split | 14344 | ✅ VERIFIED |
| 2.7 | obj_meta attrs хардкод '1' | `String(row.attrs)` | 10408-10410 | ✅ VERIFIED |
| 2.6 | edit_obj type всегда 'text' | `objBaseTypId === TYPE.DATE` | 6426-6429 | ✅ VERIFIED |
| 1.8 | upload allowlist | blocklist: php/cgi/pl/fcgi/fpl/phtml/shtml/asp/jsp | 10959-10964, 3300-3305 | ✅ VERIFIED |
| 3.6 | `_ref_reqs` id=0 → `[]` | `{"error":"Invalid id"}` text/html | 8844-8850 | ✅ VERIFIED |
| 1.7 | `_m_set` objectId вместо reqId | query/insert value row → reqId → getSubdir | 7991-8008 | ✅ VERIFIED |
| — | auth 401 | был 200, теперь 401 | 2954, 2960, 3561, 3975, 4997, 5046, 8751, 8771 | ✅ VERIFIED |
| — | `_d_del_req` LEFT JOIN | INNER JOIN (PHP parity) | 9972-9977 | ✅ VERIFIED |

---

## Часть B: Неисправленные баги

### 🔴 CRITICAL (4 бага)

#### 1.1 restore исполняет SQL вместо возврата текста
- **PHP** (line 4237): `die("INSERT INTO ...")` — **всегда** возвращает SQL как текст, никогда не исполняет
- **Node** (lines 14400-14419): по умолчанию **исполняет** `insertBatch()`, SQL-текст возвращается только при `?sql`
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: вызов restore без `?sql` **деструктивно модифицирует БД** в Node, тогда как PHP просто показывает SQL

#### 1.2 `_ref_reqs` grant mask фильтрация отсутствует
- **PHP** (lines 9099-9147): строит `$reqs_granted` WHERE из `GRANTS["mask"]`, применяет в SELECT (line 9147)
- **Node** (line 9158): комментарий `// PHP does NOT apply grant mask filtering on _ref_reqs (#429)` — **ложный**. Фильтрация отсутствует.
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: Node возвращает нефильтрованные данные, потенциально раскрывая строки, к которым пользователь не имеет доступа

#### 1.3 BARRED columns — read-side проверка отсутствует
- **PHP** (lines 4677-4679, 5780-5782, 6411-6413): `if(GRANTS[$key] == "BARRED") continue;` — скрывает BARRED-колонки при чтении
- **Node**: BARRED проверяется только на write-side (lines 7153, 7672). Read-side loops (lines 5459, 5694, 6208) **не фильтруют** BARRED реквизиты
- **Консенсус**: CONFIRMED ×3 агента + перекрёстная проверка
- **Риск**: BARRED колонки видны пользователям, которые не должны их видеть

#### 1.4 dir_admin POST операции отсутствуют
- **PHP** (lines 6650-6726): 4 POST-мутации — mkdir, touch, upload, delete
- **Node** (line 11096): только `router.get('/:db/dir_admin', ...)`, POST-handler **отсутствует**
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: невозможно создавать папки, файлы, загружать и удалять через dir_admin

---

### 🟠 HIGH (5 багов)

#### 2.2 create_granted хардкод
- **PHP** (lines 5131-5134): `Grant_1level() == "WRITE" || Check_Grant()` → `"block"` или `"none"`
- **Node** (line 5785): `create_granted: ['block']` — всегда
- **Консенсус**: CONFIRMED ×3 агента
- **Риск**: кнопка "создать" видна пользователям без WRITE-гранта

#### 2.3 grant per-row всегда пустой
- **PHP** (line 5784): `GRANTS[$row["id"]]` — реальное значение гранта
- **Node** (line 5634): `head.grant.push('')` — хардкод пустой строки
- **Консенсус**: CONFIRMED ×3 агента
- **Риск**: фронтенд не может определить per-column grant (READ/WRITE/BARRED)

#### 2.4 Format_Val_View не применяется к main object val
- **PHP** (line 6130): `Format_Val_View($cur_base_typ, $v, $row["id"])` — форматирует даты, булевы и т.д.
- **Node** (lines 5654-5661): только `htmlEsc(v)` — сырые значения без форматирования
- **Уточнение**: для реквизитов (`reqMap`) `formatValView()` **вызывается** (line 5378). Баг только в main val column.
- **Консенсус**: CONFIRMED (уточнён после спора раундов 1-2)
- **Severity**: MEDIUM (понижен с HIGH, т.к. reqs корректны)
- **Риск**: даты отображаются как `20250316` вместо `16.03.2025` в main val

#### 2.5 disabled хардкод
- **PHP** (lines 4347-4354): `Check_Grant()` / `Check_Val_granted()` → `""` или `"DISABLED"`
- **Node** (lines 6265, 6423): `const dis = ''` / `disabled: ['']` — всегда пустой
- **Консенсус**: CONFIRMED ×3 агента
- **Риск**: все поля в edit_obj редактируемы, даже для read-only пользователей

#### 2.8 companion `{name}ID` колонки
- **PHP** (lines 3828-3860): ровно одна колонка на поле, без companion columns
- **Node** (lines 12498-12512): вставляет `col.name + 'ID'` для `isMainCol || isRef`
- **Спор**: один агент считает "intentional enhancement", другой — "parity bug"
- **Вердикт**: PHP parity нарушена. Даже если задумано для smartq.js — это расхождение, ломающее column-index-based код
- **Консенсус**: CONFIRMED ×2 агента
- **Severity**: HIGH (ломает соответствие columns↔data при column-count-based доступе)

---

### 🟡 MEDIUM (5 багов)

#### 3.1 Content-Type расхождения
- **PHP** (line 3): `text/html` глобально; `api_dump()` (line 3963) устанавливает `application/json` + `Content-Disposition: attachment;filename=api.json`
- **Node**: `res.json()` отдаёт `application/json`, но **без** `Content-Disposition` header
- **Консенсус**: CONFIRMED ×4 агента (minor — отсутствует attachment header)
- **PHP lines**: 3, 3963-3967 | **Node**: line 577

#### 3.2 isApiRequest лишние триггеры
- **PHP** (line 79): 5 пар params — `JSON`, `JSON_DATA`, `JSON_KV`, `JSON_CR`, `JSON_HR`
- **Node** (lines 359-393): +6 доп. триггеров: `json` (lowercase), `RECORD_COUNT`, `csv`, `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: запросы с `?csv` или AJAX headers получают JSON вместо HTML redirect

#### 3.3 admin case-insensitive
- **PHP** (lines 969, 1003, 1094): `== "admin"` (case-sensitive)
- **Node** (lines 1498, 1622, 1634): `.toLowerCase() === 'admin'` (case-insensitive)
- **Примечание**: на практике username всегда lowercase после login (PHP line 7693). Расхождение безвредно.
- **Консенсус**: CONFIRMED ×4 агента (LOW risk)

#### 3.4 CSV backslash вместо RFC 4180
- **PHP**: `fputcsv()` — RFC 4180 (double-quote escaping: `"hello;world"`)
- **Node** `csv_all` (lines 12930-12934): backslash escaping (`hello\;world`) — **не RFC 4180**
- **Node** `report CSV` (lines 12955-12963): `escapeCell()` — **правильный** RFC 4180
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: `csv_all` экспорт ломает стандартные CSV-парсеры

#### 3.5 `_connect` проксирует POST
- **PHP** (lines 9160-9183): **всегда GET** — `curl_setopt($ch, CURLOPT_URL, $url)`, без CURLOPT_POST
- **Node** (lines 9213-9231): если `req.body` есть → **POST**
- **Консенсус**: CONFIRMED ×4 агента
- **Риск**: upstream-серверы получают POST вместо GET

#### 3.7 terms экранирует `'` (single quote)
- **PHP**: `htmlspecialchars()` с `ENT_COMPAT` — `'` **не экранируется**
- **Node** (line 1360): `.replace(/'/g, '&#039;')` — `'` → `&#039;`
- **Консенсус**: CONFIRMED ×3 агента (спор раунда 4 опровергнут ручной проверкой)
- **Риск**: `O'Brien` → `O&#039;Brien` в Node, ломает string comparisons на фронтенде

---

### 🟢 LOW (2 бага)

#### 4.1 mysql2 типизированные значения
- **PHP**: `mysqli_fetch_array()` — все значения строки (`"123"`, `"NULL"`)
- **Node**: `mysql2` — типизированные (`123`, `null`)
- **Консенсус**: CONFIRMED ×2 агента
- **Риск**: `===` сравнения ломаются; JSON отдаёт `"id": 123` вместо `"id": "123"`

#### 4.2 Content-Disposition attachment header отсутствует
- **PHP** (line 3967): `Content-Disposition: attachment;filename=api.json`
- **Node**: отсутствует
- **Консенсус**: CONFIRMED (выявлен в раунде 1)
- **Риск**: клиенты, проверяющие download headers, не получают их

---

## Часть C: Разрешённые споры

| Баг | Раунд 1 | Раунд 2 / перекрёстная проверка | Итог |
|-----|---------|-------------------------------|------|
| 2.4 Format_Val_View | Агент A: REFUTED, Агент B: CONFIRMED (main val only) | Cross-check: REFUTED (reqs OK) | **PARTIALLY CONFIRMED** — баг только в main val (line 5654), reqs корректны (line 5378). Severity понижен до MEDIUM |
| 1.3 BARRED | Агент A: CONFIRMED, Агент B: PARTIALLY CONFIRMED | Cross-check: **CONFIRMED** — read-side отсутствует (lines 5459, 5694, 6208) | **CONFIRMED CRITICAL** |
| 2.8 companion ID | Агент A: CONFIRMED bug, Агент B: intentional enhancement | Ручная проверка: PHP не добавляет, Node добавляет | **CONFIRMED** — parity divergence, severity HIGH |

---

## Часть D: Приоритеты исправления

### Немедленно (security/data integrity)
1. **1.1** restore — убрать дефолтное исполнение SQL, возвращать текст как PHP
2. **1.2** `_ref_reqs` — реализовать grant mask фильтрацию
3. **1.3** BARRED — добавить read-side `if (grants[k] === 'BARRED') continue;` в 3 цикла
4. **2.5** disabled — реализовать `checkGrant()` для per-field disabled

### Высокий приоритет (функциональность)
5. **1.4** dir_admin — добавить POST handler (mkdir/touch/upload/delete)
6. **2.2** create_granted — реализовать грант-проверку
7. **2.3** grant per-row — заполнять реальными значениями из grants
8. **2.8** companion ID — убрать или согласовать с PHP

### Средний приоритет (parity)
9. **3.2** isApiRequest — убрать лишние триггеры
10. **3.4** CSV — заменить backslash на RFC 4180 в csv_all
11. **3.5** `_connect` — всегда GET как PHP
12. **2.4** main val formatValView — добавить вызов
13. **3.7** htmlEsc — убрать экранирование `'`

### Низкий приоритет
14. **3.1/4.2** Content-Disposition header
15. **3.3** admin case — убрать toLowerCase (косметика)
16. **4.1** mysql2 типы — добавить stringification или typeCast config

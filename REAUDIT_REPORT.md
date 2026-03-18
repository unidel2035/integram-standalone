# PHP vs Node.js Parity Audit Report — Final

**Дата**: 2026-03-16
**Файлы**:
- PHP: `integram-server/index.php` (9252 строк)
- Node: `backend/monolith/src/api/routes/legacy-compat.js` (14811 строк)

**Методология**:
- **Раунд 1**: 4 агента по категориям (CRITICAL, HIGH, MEDIUM, fixed) + 2 перекрёстных проверки споров + ручная верификация
- **Раунд 2**: 4 свежих агента по доменам (auth/grants, data ops, routing/HTTP, SQL/types) — независимо от раунда 1
- **Финал**: сравнение раундов, разрешение споров, ручные спот-чеки

---

## Сводка

| Severity | Раунд 1 | Новые в раунде 2 | Итого неисправленных |
|----------|---------|-------------------|----------------------|
| 🔴 CRITICAL | 4 | 0 | **4** |
| 🟠 HIGH | 5 | +6 | **11** |
| 🟡 MEDIUM | 5 | +13 | **18** |
| 🟢 LOW | 2 | +8 | **10** |
| **Итого** | **16** | **+27** | **43** |

Исправленных багов: **12** (все верифицированы ✓)

---

## Часть A: Исправленные баги (12 фиксов) — все ВЕРИФИЦИРОВАНЫ ✓

| # | Баг | Фикс | Node строка | Статус |
|---|-----|------|-------------|--------|
| 2.1 | `nul` → пустой ответ | `{id,obj,a,args}` text/html | 587-588 | ✅ |
| 2.9 | `_d_del_req` plain object | `[{"error":"..."}]` array-wrapped | 10023-10038 | ✅ |
| 1.5 | restore — неверная директория | `templates/custom/{db}/backups` | 14312 | ✅ |
| 1.6 | restore — `/-prefix` parse | `lastUp` внутри `else{}` | 14361-14378 | ✅ |
| 2.10 | restore — CRLF | strip `\r` при split | 14344 | ✅ |
| 2.7 | obj_meta attrs хардкод '1' | `String(row.attrs)` | 10408-10410 | ✅ |
| 2.6 | edit_obj type всегда 'text' | `objBaseTypId === TYPE.DATE` | 6426-6429 | ✅ |
| 1.8 | upload allowlist | blocklist: php/cgi/pl/etc | 10959-10964 | ✅ |
| 3.6 | `_ref_reqs` id=0 → `[]` | `{"error":"Invalid id"}` | 8844-8850 | ✅ |
| 1.7 | `_m_set` objectId вместо reqId | reqId → getSubdir | 7991-8008 | ✅ |
| — | auth 401 | был 200, теперь 401 | 2954+ | ✅ |
| — | `_d_del_req` LEFT JOIN | INNER JOIN | 9972-9977 | ✅ |

---

## Часть B: Неисправленные баги

### 🔴 CRITICAL (4 бага)

| # | Баг | PHP | Node | Консенсус |
|---|-----|-----|------|-----------|
| 1.1 | restore исполняет SQL | `die("INSERT...")` — всегда текст (L4237) | `insertBatch()` по умолчанию (L14416); `?sql` для текста | ×6 агентов |
| 1.2 | `_ref_reqs` grant mask | `$reqs_granted` WHERE из GRANTS["mask"] (L9099-9147) | Ложный комментарий `// PHP does NOT apply...` (L9158) | ×6 агентов |
| 1.3 | BARRED read-side | `if(GRANTS[$key]=="BARRED") continue;` в 3 местах (L4677, 5780, 6411) | Только write-side (L7153, 7672); read-side (L5459, 5694, 6208) — нет | ×5 + cross-check |
| 1.4 | dir_admin POST | mkdir/touch/upload/delete (L6650-6726) | Только `router.get` (L11096), POST отсутствует | ×6 агентов |

---

### 🟠 HIGH (11 багов)

#### Из раунда 1 (5):

| # | Баг | PHP | Node |
|---|-----|-----|------|
| 2.2 | create_granted хардкод | `Grant_1level()=="WRITE"` → "block"/"none" (L5131-5134) | `['block']` всегда (L5785) |
| 2.3 | grant per-row пустой | `GRANTS[$row["id"]]` (L5784) | `head.grant.push('')` (L5634) |
| 2.5 | disabled хардкод | `Check_Grant()` → ""/`"DISABLED"` (L4347-4354) | `const dis = ''` (L6265) |
| 2.8 | companion `{name}ID` колонки | Нет лишних колонок (L3828-3860) | `col.name + 'ID'` для isMainCol/isRef (L12498-12512) |
| 4.1↑ | mysql2 типы (повышен) | Все строки | Типизированные: числа, null — ломает `===` и JSON |

#### Новые из раунда 2 (6):

| # | Баг | PHP | Node | Агент |
|---|-----|-----|------|-------|
| N1 | **URL lowercasing ломает ?JSON_DATA** | `$_GET` сохраняет регистр (L28) | `req.url.toLowerCase()` (L289) — `?JSON_DATA` → `?json_data`, `req.query.JSON_DATA` = undefined | R2-HTTP |
| N2 | **Report column `granted` = READ вместо WRITE** | `Check_Grant(..., "WRITE", FALSE)` (L3842-3855) | `checkGrant(..., 'READ', username)` (L12243) | R2-Auth |
| N3 | **ref_create_granted** всегда granted | `Grant_1level(ref)=="WRITE"` (L4875-4878) | Безусловный `push(k)` (L6275) | R2-Auth |
| N4 | **_ref_reqs search scope CONCAT** | Поиск только по `vals.val` (L9087-9096) | `CONCAT(vals.val, '/', a{req}.val)` — ищет по всем реквизитам (L9113-9121) | R2-SQL |
| N5 | **formatValView FILE** — нет HTML ссылки | `<a href=...>` для FILE (L1429-1434) | Только filename без ссылки (L2159-2167) | R2-Data |
| N6 | **formatValView REPORT_COLUMN** — raw ID | DB lookup для имён колонок (L1454-1483) | Возвращает raw ID (L2186-2189) | R2-Data |

---

### 🟡 MEDIUM (18 багов)

#### Из раунда 1 (5):

| # | Баг | Суть |
|---|-----|------|
| 3.2 | isApiRequest лишние триггеры | +6 доп: `json`, `RECORD_COUNT`, `csv`, Accept, Content-Type, X-Requested-With |
| 3.4 | CSV backslash | `csv_all`: backslash вместо RFC 4180 |
| 3.5 | `_connect` POST | PHP всегда GET; Node POST при наличии body |
| 2.4 | Format_Val_View main val | Для main object val — только `htmlEsc()`, не `formatValView()` |
| 3.7 | htmlEsc `'` | Node экранирует `'` → `&#039;`; PHP (ENT_COMPAT) — нет |

#### Новые из раунда 2 (13):

| # | Баг | PHP | Node | Агент |
|---|-----|-----|------|-------|
| N7 | **nul response `a` = "nul"** | `$a` = original action (L9242) | `a: next_act` = "nul" (L588) | R2-HTTP |
| N8 | **sendLegacyDie JSON для non-API** | `die($msg)` для non-API (L993-996) | Всегда `[{"error":"..."}]` (L608-611) | R2-HTTP |
| N9 | **XSRF fallback** wrong 2nd arg | `xsrf($token, $z)` — 2nd=db (L1197) | `generateXsrf(token, uname, db)` — 2nd=username (L2836) | R2-Auth |
| N10 | **Grant mask BuiltIn** fallback | `Get_block_data()` для неизвестных `[placeholder]` (L1296-1309) | Возвращает as-is (L3161) | R2-Auth |
| N11 | **Ref dropdown** grant mask | `Construct_WHERE()` + `$reqs_granted` (L4957-4998) | Простой SELECT без грантов (L6337-6354) | R2-Auth |
| N12 | **Report column granted** chain | Parent/array chain: isArray → parent → fallback (L3839-3856) | Одиночный `checkGrant()` (L12243) | R2-Auth |
| N13 | **formatValView PATH** | Полный server path (L1442-1445) | Только filename (L2169-2177) | R2-Data |
| N14 | **formatValView NUMBER** | `number_format()` — округление (L1424-1427) | `parseInt()` — усечение (L2143-2147) | R2-Data |
| N15 | **formatValView GRANT** fall-through | Falls through to REPORT_COLUMN (L1446-1453) | Возвращает raw val (L2179-2184) | R2-Data |
| N16 | **_m_new calculatable defaults** | `Get_block_data()` для вычисляемых (L8346-8363) | Не портировано (L7053-7058) | R2-Data |
| N17 | **DDLIST_ITEMS** configurable | Фиксировано 80 (L302) | До 500 через `?LIMIT` (L8827) | R2-SQL |
| N18 | **Timezone rounding** | Cookie + round to 30min (L1211, 7632-7635) | Raw request param, без округления (L7400) | R2-SQL |
| N19 | **_d_del safety check** SQL | Specific join pattern (L8755-8762) | Simplified queries (L9466-9505) | R2-SQL |

---

### 🟢 LOW (10 багов)

#### Из раунда 1 (2):

| # | Баг |
|---|-----|
| 4.2 | Content-Disposition filename отсутствует |
| 3.3 | admin case-insensitive (безвредно) |

#### Новые из раунда 2 (8):

| # | Баг | Суть | Агент |
|---|-----|------|-------|
| N20 | Content-Disposition filename | Всегда "api.json" vs context-specific | R2-HTTP |
| N21 | nul response value types | `"id":"123"` vs `"id":123` | R2-HTTP |
| N22 | formatValView BOOLEAN | PHP `0 != ""` false; Node `0` falsy | R2-Data |
| N23 | Report extra fields | Node добавляет `align`, `totals` per-column | R2-Data |
| N24 | _m_save 2 queries vs 1 | PHP 1 query; Node 2 (extra round-trip) | R2-SQL |
| N25 | Mixed `${z}`/`${db}` quoting | Inconsistent identifier escaping | R2-SQL |
| N26 | XSRF admin backdoor | PHP: any user with xsrf=ADMINHASH; Node: only flagged user | R2-Auth |
| N27 | checkTypesGrant error format | PHP: `die(text)`; Node: `{error, status:200}` | R2-Auth |

---

## Часть C: Споры между раундами и их разрешение

### Спор 1: Bug 2.4 — Format_Val_View

| Источник | Вердикт |
|----------|---------|
| Раунд 1, Агент A | REFUTED — `formatValView()` есть и используется |
| Раунд 1, Агент B | CONFIRMED — main val only |
| Раунд 2, Cross-check | REFUTED (reqs OK) |
| Раунд 2, Agent Data | CONFIRMED — main val line 5654 uses htmlEsc only |
| Ручная проверка | PHP L6130 вызывает `Format_Val_View()`, Node L5654-5661 — только `htmlEsc()` |

**Итог**: **PARTIALLY CONFIRMED MEDIUM**. `formatValView()` портирован и используется для реквизитов (line 5378), но **не вызывается** для main object val (line 5654). Агенты, говорившие REFUTED, проверяли reqs path. Агенты, говорившие CONFIRMED, проверяли main val path. Оба правы — баг частичный.

### Спор 2: Bug 2.8 — Companion ID columns

| Источник | Вердикт |
|----------|---------|
| Раунд 1, Агент A | CONFIRMED bug |
| Раунд 1, Агент B | Intentional enhancement |
| Раунд 2, Agent Data | MEDIUM divergence |

**Итог**: **CONFIRMED HIGH**. PHP не добавляет companion columns (L3828-3860 — одна колонка на поле). Node добавляет (L12498-12512). Даже если для smartq.js — ломает column-count-based доступ. Parity bug.

### Спор 3: Bug 1.3 — BARRED

| Источник | Вердикт |
|----------|---------|
| Раунд 1, Агент A | CONFIRMED |
| Раунд 1, Агент B | PARTIALLY CONFIRMED |
| Раунд 2, Cross-check | CONFIRMED — read-side missing |
| Раунд 2, Agent Auth | CONFIRMED — lines 5459, 5694, 6208 |

**Итог**: **CONFIRMED CRITICAL**. Write-side BARRED есть (L7153, 7672), read-side **отсутствует** в 3 циклах.

### Спор 4: Bug N1 (новый) — URL lowercasing

Только раунд 2 обнаружил. Раунд 1 отметил лишние триггеры в `isApiRequest` (bug 3.2), но **не заметил**, что `req.url.toLowerCase()` (L289) ломает uppercase query keys (`?JSON_DATA` → `?json_data`). Это значит `isApiRequest()` вернёт `false` для GET-запросов с `?JSON_DATA`, т.к. `req.query.JSON_DATA` = undefined после lowercasing. **Критичный** для PHP API compatibility.

### Спор 5: Bug 4.1 — mysql2 typed values

| Источник | Severity |
|----------|----------|
| Раунд 1 | LOW |
| Раунд 2, Agent SQL | HIGH (systematic risk) |

**Итог**: **HIGH**. Раунд 2 показал системный характер проблемы. JSON API отдаёт `"id":123` (number) вместо `"id":"123"` (string). Фронтенд `===` сравнения ломаются. Node код частично компенсирует через `String()`, но **не везде**.

---

## Часть D: Новые баги, выявленные только в раунде 2

Раунд 2 (свежий code review по доменам) обнаружил **27 новых багов**, которые раунд 1 (проверка известного списка) пропустил:

**Самые важные:**
1. **N1** URL lowercasing ломает `?JSON_DATA` — HIGH (затрагивает ВСЕ API-запросы через query string)
2. **N2** Report `granted` = READ вместо WRITE — HIGH (инлайн-редактирование отчётов)
3. **N3** ref_create_granted без проверки — HIGH (создание через reference)
4. **N4** _ref_reqs CONCAT search — HIGH (расширенный поиск, которого нет в PHP)
5. **N5** formatValView FILE — нет HTML ссылки — HIGH (файлы некликабельны)
6. **N6** formatValView REPORT_COLUMN — raw ID — HIGH (вместо имён колонок)
7. **N7** nul response `a` = "nul" — MEDIUM (ломает клиентский парсинг)
8. **N8** sendLegacyDie всегда JSON — MEDIUM (non-API получают JSON вместо текста)
9. **N11** Ref dropdown без grant mask — MEDIUM (security: видны все значения)

**Почему раунд 1 их пропустил**: раунд 1 проверял **список известных багов** из пользовательского отчёта. Раунд 2 читал код **с нуля** по доменам, без привязки к существующему списку. Это классический пример: целевая проверка ≠ полный аудит.

---

## Часть E: Приоритеты исправления

### P0: Немедленно (security + data integrity)
1. **1.1** restore — возвращать SQL текст, не исполнять
2. **1.2** _ref_reqs grant mask — портировать фильтрацию
3. **1.3** BARRED read-side — добавить `if (grants[k] === 'BARRED') continue;`
4. **2.5** disabled — реализовать `checkGrant()` per-field
5. **N11** Ref dropdown grant mask — портировать

### P1: Высокий (функциональность + parity)
6. **1.4** dir_admin POST — mkdir/touch/delete handlers
7. **N1** URL lowercasing — не lowercasing query string
8. **2.2** create_granted — грант-проверка
9. **2.3** grant per-row — реальные значения
10. **N2** Report column granted — WRITE вместо READ
11. **N3** ref_create_granted — грант-проверка
12. **N5** formatValView FILE — HTML ссылка
13. **N6** formatValView REPORT_COLUMN — DB lookup
14. **2.8** companion ID — убрать или согласовать
15. **4.1** mysql2 типы — typeCast config

### P2: Средний (parity)
16. **N4** _ref_reqs search scope — только vals.val
17. **N7** nul response `a` field — original action
18. **N8** sendLegacyDie — non-API = plain text
19. **N9** XSRF fallback — correct 2nd arg
20. **N10** Grant mask BuiltIn — fallback
21. **N12** Report granted chain — parent/array
22. **3.2** isApiRequest — убрать лишние триггеры
23. **3.4** CSV backslash → RFC 4180
24. **3.5** _connect — всегда GET
25. **2.4** main val formatValView
26. **3.7** htmlEsc `'`
27. **N14** formatValView NUMBER — `number_format`
28. **N16** _m_new calculatable defaults
29. **N18** Timezone rounding
30. **N19** _d_del safety SQL

### P3: Низкий
31-43. Content-Disposition, admin case, BOOLEAN, nul types, report extra fields, mixed quoting, etc.

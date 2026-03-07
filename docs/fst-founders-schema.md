# FST Founders CRM — Database Schema

> Created: 2026-03-07 | Database: `fst` | Issue: #25

---

## Overview

CRM система для управления отношениями с основателями портфельных компаний и база менторов Фонда.

Аналоги: Sequoia Scouts network, Y Combinator alumni, a16z Executive Network.

---

## New Types for Integram

### Type: Founders (typeId: TBD ~1220)

Профили основателей портфельных компаний.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Full Name | SHORT (1042) | ФИО основателя (main field) |
| TBD | Photo URL | SHORT (1042) | URL фотографии |
| TBD | Biography | HTML (1018) | Биография, опыт |
| TBD | LinkedIn | SHORT (1042) | URL профиля LinkedIn |
| TBD | Telegram | SHORT (1042) | Telegram username |
| TBD | Email | SHORT (1042) | Email |
| TBD | Phone | SHORT (1042) | Телефон |
| TBD | Tags | HTML (1018) | JSON array: ["Сильный технарь", "Сильный продавец"] |
| TBD | Current Role | SHORT (1042) | Текущая роль |
| TBD | Equity Share | NUMBER (144) | Доля в компании (%) |
| TBD | Date Added | DATETIME (123) | Дата добавления в CRM |
| TBD | Project | REF → Projects (1155) | Текущая компания |
| TBD | Status | REF → Founder Status | Активный/Alumni/Exit |

**Tags examples:**
- "Сильный технарь"
- "Сильный продавец"
- "Нужна поддержка"
- "Отличный нетворкер"
- "Опыт B2G продаж"

### Type: Founder Companies History (typeId: TBD ~1222)

История участия основателей в других компаниях.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Company Name | SHORT (1042) | Название компании (main) |
| TBD | Role | SHORT (1042) | Роль (CEO, CTO, Co-founder) |
| TBD | Equity Share | NUMBER (144) | Доля (%) |
| TBD | Start Date | DATETIME (123) | Дата начала |
| TBD | End Date | DATETIME (123) | Дата окончания (null если текущая) |
| TBD | Outcome | SHORT (1042) | Исход (Exit, Acquired, Closed, Active) |
| TBD | Founder | REF → Founders | Связь с основателем |

### Type: Founder Interactions (typeId: TBD ~1224)

История взаимодействий с ФСТ.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Interaction Type | SHORT (1042) | Встреча/Звонок/Письмо (main) |
| TBD | Summary | HTML (1018) | Краткое описание |
| TBD | Date | DATETIME (123) | Дата взаимодействия |
| TBD | FST Representative | SHORT (1042) | Кто от ФСТ участвовал |
| TBD | Next Steps | HTML (1018) | Договоренности/Next actions |
| TBD | Founder | REF → Founders | Связь с основателем |
| TBD | Project | REF → Projects (1155) | Связь с проектом |

### Type: Mentors (typeId: TBD ~1226)

База экспертов и менторов Фонда.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Full Name | SHORT (1042) | ФИО ментора (main) |
| TBD | Photo URL | SHORT (1042) | URL фотографии |
| TBD | Specializations | HTML (1018) | JSON array: ["БПЛА-инженерия", "Авионика", ...] |
| TBD | Biography | HTML (1018) | Опыт, достижения |
| TBD | LinkedIn | SHORT (1042) | URL профиля |
| TBD | Email | SHORT (1042) | Email |
| TBD | Phone | SHORT (1042) | Телефон |
| TBD | Availability Hours | NUMBER (144) | Доступность (часов/месяц) |
| TBD | Sessions Count | NUMBER (144) | Проведено сессий |
| TBD | Average Rating | NUMBER (144) | Средняя оценка (0-5) |
| TBD | Status | SHORT (1042) | Active/Busy/On Leave |
| TBD | Date Added | DATETIME (123) | Дата добавления |

**Specialization examples:**
- "БПЛА-инженерия"
- "Авионика"
- "Продажи гос.заказчику"
- "IP и патенты"
- "Производство и сертификация"
- "Финансирование и фандрайзинг"
- "Product Management"
- "Go-to-market B2G"

### Type: Mentor Sessions (typeId: TBD ~1228)

Трекинг менторских сессий.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Session Title | SHORT (1042) | Тема сессии (main) |
| TBD | Date | DATETIME (123) | Дата проведения |
| TBD | Duration Hours | NUMBER (144) | Длительность (часы) |
| TBD | Summary | HTML (1018) | Краткое описание |
| TBD | Company Feedback | HTML (1018) | Обратная связь от компании |
| TBD | Company Rating | NUMBER (144) | Оценка от компании (1-5) |
| TBD | Mentor | REF → Mentors | Ментор |
| TBD | Project | REF → Projects (1155) | Компания |
| TBD | Founder | REF → Founders | Основатель (опционально) |

### Type: Mentor Matching Requests (typeId: TBD ~1230)

Запросы на подбор ментора (AI-матчинг).

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Request Title | SHORT (1042) | Название запроса (main) |
| TBD | Expertise Needed | HTML (1018) | Требуемая экспертиза |
| TBD | Problem Description | HTML (1018) | Описание проблемы |
| TBD | Priority | SHORT (1042) | High/Medium/Low |
| TBD | Status | SHORT (1042) | Open/Matched/In Progress/Completed |
| TBD | AI Suggestions | HTML (1018) | JSON array рекомендаций AI |
| TBD | Matched Mentor | REF → Mentors | Выбранный ментор |
| TBD | Project | REF → Projects (1155) | Компания-запрашивающая |
| TBD | Date Created | DATETIME (123) | Дата создания |
| TBD | Date Matched | DATETIME (123) | Дата матчинга |

### Type: Alumni Events (typeId: TBD ~1232)

Тематические встречи портфельных компаний.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| TBD | Event Name | SHORT (1042) | Название события (main) |
| TBD | Description | HTML (1018) | Описание |
| TBD | Date | DATETIME (123) | Дата проведения |
| TBD | Location | SHORT (1042) | Место |
| TBD | Format | SHORT (1042) | Online/Offline/Hybrid |
| TBD | Participants | HTML (1018) | JSON array участников (founder IDs) |
| TBD | Subfund | REF → Subfunds (1082) | Тематика (БАС/РОБО/МЭ) |
| TBD | Organizer | SHORT (1042) | Организатор от ФСТ |
| TBD | Materials | HTML (1018) | Ссылки на материалы |

---

## Reference Types (Enums)

### Founder Status (typeId: TBD ~1234)
- Active (текущий портфель)
- Alumni (exit состоялся)
- On Hold (компания приостановлена)

---

## Data Graph

```
                    Projects (1155) ──────────────┐
                         │                        │
              ┌──────────┴─────────┐              │
              ▼                    ▼              │
    Founders (1220)      Mentor Sessions (1228) ──┘
         │    │                   │
         │    │                   ▼
         │    │             Mentors (1226)
         │    │                   │
         │    └───────┐           │
         ▼            ▼           ▼
Founder Companies  Founder    Mentor Matching
History (1222)   Interactions  Requests (1230)
                   (1224)           │
                                    ▼
                              Projects (1155)

                  Alumni Events (1232)
                         │
                         ├─► Subfunds (1082)
                         └─► Founders (1220)
```

---

## AI Mentor Matching Logic

### Input:
- Company risk from `/fst-execution` (runway, TRL, KPI)
- Specific expertise request
- Founder tags and needs

### AI Prompt:
```
У компании {company} выявлен риск: {risk_description}
Текущая ситуация: runway={runway}мес, TRL={trl}, проблемная область={area}

Доступные менторы в базе:
{mentors_list with specializations}

Задача: подобрать ментора с учётом:
1. Релевантность экспертизы
2. Доступность (часов/мес)
3. Рейтинг и опыт
4. Специфика субфонда (БАС/РОБО/МЭ)

Верни топ-3 рекомендации с обоснованием.
```

---

## Demo Data (seed)

### Founders:
1. **Петров Дмитрий** (CEO АвиаЛогик)
   - Tags: "Сильный технарь", "Опыт B2G"
   - LinkedIn, Telegram
   - Доля: 45%

2. **Соколова Мария** (CEO НейроПилот)
   - Tags: "Сильный продавец", "Отличный нетворкер"
   - Доля: 38%

3. **Карпов Иван** (CEO РоботМед)
   - Tags: "Нужна поддержка", "Регуляторика"
   - Доля: 52%

### Mentors:
1. **Иванов Алексей** (БПЛА-инженерия, Авионика)
   - 20 часов/мес, рейтинг 4.8
   - Специализация: сертификация, импортозамещение

2. **Смирнова Елена** (Продажи гос.заказчику)
   - 15 часов/мес, рейтинг 4.9
   - Опыт: Минобороны, Росатом

3. **Новиков Сергей** (IP и патенты)
   - 10 часов/мес, рейтинг 4.7
   - Опыт: 150+ патентов, ФИПС

---

## API Integration

All CRUD operations through `/api/mcp/integram/chat` with standard Integram protocol:

```javascript
// Create founder
POST /_m_new/1220
Body: t1220=Петров+Дмитрий&r{photo}=url&r{bio}=...&r{project}=1202

// Get all founders
GET /_d_req/1220?JSON_KV&l=100

// Update founder
POST /_m_set/{founderId}
Body: r{tags}=["Сильный+технарь"]

// Get founder with relations
GET /_d_req/1220?JSON_KV&l=100&where=id={founderId}
  + GET /_d_req/1222?JSON_KV&where=r{founder}={founderId}  // history
  + GET /_d_req/1224?JSON_KV&where=r{founder}={founderId}  // interactions
```

---

## Notes

1. **JSON Storage**: Complex fields (tags, participants, AI suggestions) stored as JSON strings in HTML requisites
2. **References**: Use existing Projects (1155) and Subfunds (1082) types
3. **AI Integration**: Mentor matching uses `/api/ai-tokens/chat` with prompt engineering
4. **Scalability**: Schema supports 100+ founders, 50+ mentors, unlimited interactions
5. **Privacy**: Sensitive founder data (email, phone) only visible to FST staff

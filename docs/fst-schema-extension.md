# FST Database Schema Extension Plan

## Issue #83: Remove hardcoded data from FstHub and FstCommittee

### Current State

**Hardcoded in FstCommitteeConfig.js:**

#### SUBFUNDS (lines 169-203)
```javascript
{
  id: 'bas',
  name: 'Субфонд БАС',
  shortName: 'БАС',
  color: '#42a5f5',
  icon: 'pi pi-send',
  budget: 3_200_000_000,
  deployedRatio: 0.31,
  description: 'Беспилотные авиационные системы',
  marketFocus: ['aeronet']
}
```

**Fields:** id, name, shortName, color, icon, budget, deployedRatio, description, marketFocus

---

#### PROJECTS_POOL (lines 207-323)
```javascript
{
  id: 'proj_001',
  title: 'АвиаЛогик — система управления роем БПЛА',
  company: 'ООО АвиаЛогик',
  subFund: 'bas',
  market: 'АэроНет',
  stage: 'Seed',
  requestedAmount: 180_000_000,
  trl: 6,
  mrl: 4,
  sovereigntyScore: 7,
  localizationRatio: 0.72,
  marketSize: 12_400_000_000,
  projectedIRR: 0.34,
  teamStrength: 0.78,
  employees: 23,
  founded: 2021,
  patents: 3,
  description: '...',
  strengths: ['...'],
  risks: ['...'],
  documents: ['...']
}
```

**Fields:** id, title, company, subFund, market, stage, requestedAmount, trl, mrl, sovereigntyScore, localizationRatio, marketSize, projectedIRR, teamStrength, employees, founded, patents, description, strengths (array), risks (array), documents (array)

---

### Existing Integram Schema (from fstApi.js)

**Type 1155 "Проекты ФСТ v2":**
- t1155 = название компании (main)
- t1156 = ОГРН (SHORT)
- t1157 = Запрашиваемая сумма, руб (NUMBER)
- t1158 = Описание проекта (HTML)
- t1159 = Дата подачи (DATETIME)
- t1177 = Субфонд (ref→1082)
- t1179 = Стадия (ref→1084)
- t1181 = Тип финансирования (ref→1086)
- t1183 = Статус проекта (ref→1088)

**Type 1082 "Субфонды":**
- БАС=1096, РОБО=1098, МЭ=1100

---

### Required Extensions

#### Option 1: Create New Types (Recommended)

**New Type: FST Extended Projects (e.g., type 1200+)**

Add requisites to type 1155:
- t1XXX = Название проекта (SHORT) - project title
- t1XXX = TRL уровень (NUMBER) - 1-9
- t1XXX = MRL уровень (NUMBER) - 1-10
- t1XXX = Суверенность (NUMBER) - 0-9
- t1XXX = Доля локализации (NUMBER) - 0-1 (0.72 = 72%)
- t1XXX = Размер рынка, руб (NUMBER)
- t1XXX = Прогнозный IRR (NUMBER) - 0-1 (0.34 = 34%)
- t1XXX = Сила команды (NUMBER) - 0-1 (0.78 = 78%)
- t1XXX = Количество сотрудников (NUMBER)
- t1XXX = Год основания (NUMBER)
- t1XXX = Количество патентов (NUMBER)
- t1XXX = Рынок (SHORT) - АэроНет, АвтоНет, etc.
- t1XXX = Сильные стороны (HTML) - JSON array as HTML
- t1XXX = Риски (HTML) - JSON array as HTML
- t1XXX = Документы (HTML) - JSON array as HTML

**New Type: FST Subfunds Metadata (e.g., type 1210)**

Create entries for each subfund (БАС, РОБО, МЭ):
- t1210 = Название (main)
- t1211 = Краткое название (SHORT)
- t1212 = Цвет (SHORT) - hex color
- t1213 = Иконка (SHORT) - PrimeIcons class
- t1214 = Бюджет, руб (NUMBER)
- t1215 = Доля размещения (NUMBER) - 0-1 (0.31 = 31%)
- t1216 = Описание (HTML)
- t1217 = Фокус рынков (HTML) - JSON array as HTML

---

#### Option 2: Extend Existing Types (Simpler)

**Extend Type 1155 with new requisites:**

Just add missing fields to the existing "Проекты ФСТ v2" type.

**For Subfunds:**

Use existing type 1082 entries (1096, 1098, 1100) and add requisites to them.

---

### Implementation Strategy

Since we cannot directly modify Integram schema from code, we'll:

1. **Use existing schema where possible** - Type 1155 for projects, use requisites that exist
2. **Add new requisites via Integram UI** - Manually add missing requisites to type 1155
3. **Store complex data as JSON strings** - strengths, risks, documents as JSON in HTML requisites
4. **Create seed script** - Populate database with demo data from FstCommitteeConfig.js

---

### API Methods to Add to fstApi.js

```javascript
// Get all subfunds with metadata
export async function getSubfunds()

// Get enriched stats for FstHub
export async function getStats()

// Get enriched projects for FstCommittee
export async function getEnrichedProjects()

// Seed database with demo data
export async function seedDemoData()
```

---

### Migration Plan

1. Create seed script that reads hardcoded constants and writes to Integram
2. Extend fstApi.js with new methods
3. Update FstHub.vue to call getStats() on mount
4. Update FstCommittee.vue to call getEnrichedProjects() on mount
5. Keep hardcoded data as fallback for demo/offline mode

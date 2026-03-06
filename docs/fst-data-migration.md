# FST Data Migration Guide

## Issue #83: Remove Hardcoded Data from FstHub and FstCommittee

### Overview

This migration removes hardcoded data from `FstHub.vue` and `FstCommittee.vue` and replaces it with live data from the Integram database (`ai2o.ru/fst`).

### Changes Made

#### 1. New Files Created

**`src/services/fstExtendedApi.js`**
- Extended API methods for FST data
- `getEnrichedProjects()` - Fetch projects with TRL, MRL, IRR, sovereignty, etc.
- `getSubfunds()` - Fetch subfund metadata (budget, color, icon)
- `getStats()` - Calculate aggregate stats for FstHub
- `createEnrichedProject()` - Create project with extended fields
- `seedDemoProjects()` - Populate database with demo data

**`src/composables/useFstData.js`**
- Vue composable for reactive data loading
- Automatic caching (5 minute TTL)
- Loading states and error handling
- Fallback to hardcoded data if API fails
- `loadProjects()`, `loadSubfunds()`, `loadStats()` methods

**`scripts/seed-fst-demo-data.js`**
- Seed script to populate Integram database
- Reads from hardcoded PROJECTS_POOL constants
- Creates projects with extended data stored as JSON

**`docs/fst-schema-extension.md`**
- Technical documentation of schema extension strategy
- Field mapping between hardcoded constants and Integram schema

#### 2. Modified Files

**`src/views/pages/FstHub.vue`**
- Imports `useFstData` composable
- Loads stats from API on mount
- Computed `heroStats` based on API data
- Added skeleton loader for loading state

**`src/views/pages/FstCommittee.vue`**
- Imports `useFstData` composable
- Loads projects and subfunds from API on mount
- Replaced direct PROJECTS_POOL/SUBFUNDS imports with reactive refs
- Updated script logic to use `.value` for reactive refs

**`package.json`**
- Added `seed:fst` script: `npm run seed:fst`

#### 3. Data Storage Strategy

Since we cannot directly modify the Integram database schema from code, we use a pragmatic approach:

1. **Reuse existing schema** - Type 1155 "Проекты ФСТ v2" for projects
2. **JSON in HTML fields** - Extended fields (TRL, MRL, IRR, etc.) stored as JSON comment in description field:
   ```html
   Project description text here
   <!--FST_EXTENDED_DATA:{"trl":6,"mrl":4,"sovereigntyScore":7,...}-->
   ```
3. **Hardcoded subfund metadata** - Subfund colors, icons, budgets in `fstExtendedApi.js` (can be moved to Integram later)

### Usage

#### 1. Seed Demo Data (Optional)

If the database is empty, populate it with demo data:

```bash
npm run seed:fst
```

This creates 5 demo projects:
- АвиаЛогик (БАС, Seed, TRL 6)
- МикроСхема (МЭ, Series A, TRL 5)
- АэроМед (БАС, Pre-seed, TRL 4)
- РоботАгро (Робот, Series A, TRL 7)
- СканТекс (БАС, Seed, TRL 5)

#### 2. Development

The pages now automatically load data from Integram API on mount:

```bash
npm run dev
```

Visit:
- `/fst` - FstHub with live stats from API
- `/fst-committee` - AI Committee with live projects from API

#### 3. Fallback Behavior

If the API fails or returns empty data, the system automatically falls back to hardcoded data from `FstCommitteeConfig.js`. This ensures the demo still works offline.

### Testing Data Changes

1. Go to https://ai2o.ru/fst
2. Log in with credentials from `.env`
3. Find a project (type 1155)
4. Edit fields (e.g., change requested amount)
5. Save changes
6. Reload `/fst-committee` page
7. Verify changes appear immediately (or after cache TTL expires)

### API Endpoints

The frontend calls these methods from `fstExtendedApi.js`:

```javascript
// Get all projects with extended fields
const projects = await getEnrichedProjects()
// Returns: [{ id, title, company, trl, mrl, sovereigntyScore, ... }]

// Get subfunds with metadata
const subfunds = getSubfunds()
// Returns: [{ id, name, shortName, color, icon, budget, ... }]

// Get aggregate stats for FstHub
const stats = await getStats()
// Returns: { aum, portfolioCount, subfundCount, avgIRR, projects, subfunds }
```

### Database Schema

**Existing Type 1155 "Проекты ФСТ v2":**
- t1155 = Company name (main)
- t1156 = OGRN
- t1157 = Requested amount (NUMBER)
- t1158 = Description (HTML) **← Extended JSON stored here**
- t1159 = Submitted date (DATETIME)
- t1177 = Subfund ref (→1082)
- t1179 = Stage ref (→1084)
- t1183 = Status ref (→1088)

**Extended Fields (JSON in t1158):**
```json
{
  "title": "Project title",
  "trl": 6,
  "mrl": 4,
  "sovereigntyScore": 7,
  "localizationRatio": 0.72,
  "marketSize": 12400000000,
  "projectedIRR": 0.34,
  "teamStrength": 0.78,
  "employees": 23,
  "founded": 2021,
  "patents": 3,
  "market": "АэроНет",
  "strengths": ["...", "..."],
  "risks": ["...", "..."],
  "documents": ["...", "..."]
}
```

### Checklist for Completion

- [x] Created `fstExtendedApi.js` with API methods
- [x] Created `useFstData.js` composable
- [x] Created seed script `seed-fst-demo-data.js`
- [x] Updated `FstHub.vue` to load from API
- [x] Updated `FstCommittee.vue` to load from API
- [x] Added skeleton loader for loading states
- [x] Implemented fallback to hardcoded data
- [x] Added npm script `seed:fst`
- [ ] Seeded database with demo data (manual step)
- [ ] Verified data changes in Integram reflect on frontend
- [ ] Tested all pages load correctly
- [ ] Passed CI checks

### Next Steps

1. **Manual seed (if needed):** Run `npm run seed:fst` to populate database
2. **Verify pages load:** Visit `/fst` and `/fst-committee` to confirm data loads
3. **Test data editing:** Edit project in Integram UI, reload page, verify changes
4. **Optional:** Move subfund metadata from code to Integram (create new type)
5. **Optional:** Add UI toggle for switching between API and demo mode

### Rollback Plan

If issues occur, the system automatically falls back to hardcoded data. To force demo mode:

1. Set `useApiData.value = false` in `useFstData.js`
2. Or comment out `loadProjects()` / `loadStats()` calls in Vue components

### Notes

- Cache TTL is 5 minutes - increase in `useFstData.js` if needed
- Seed script is **idempotent** - running it multiple times will create duplicate projects (by design for testing)
- Extended data is **backward compatible** - old projects without JSON in description will use default values

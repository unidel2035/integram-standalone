# FST Sourcing Service

## Overview
Backend service for AI Deal Sourcing — automatic monitoring of open sources to find promising startups in UAV/ROBO/ME sectors.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sourcing Pipeline                         │
├─────────────────────────────────────────────────────────────┤
│  Sources → Parsing → Deduplication → AI Scoring → Storage   │
└─────────────────────────────────────────────────────────────┘
```

## Data Sources

### 1. **Telegram** (via tg-search-agent.mjs)
- Session: @gd2035
- Keywords: БПЛА, UAV, дрон, беспилотник, робототехника
- Output: company mentions, team activities, product launches

### 2. **HH.ru API**
- Monitor job postings as growth proxy
- Track: number of vacancies, hiring velocity, tech stack
- Filter: target cities, engineering roles

### 3. **ЕГРЮЛ/ФНС**
- New LLC registrations in target OKVED codes
- OKVED: 26.11 (electronics), 30.30 (aircraft), etc.
- API: https://egrul.nalog.ru/

### 4. **ФИПС (Rospatent)**
- Patent applications in classes:
  - B64: Aircraft, aviation, cosmonautics
  - G05: Controlling, regulating
  - H04: Electric communication technique
- API: http://new.fips.ru/

### 5. **Skolkovo**
- Resident registry (open API)
- Filter: IT cluster, target sectors
- Grant amounts, milestones

### 6. **Bortnik Fund (RRIT)**
- Competition winners
- Scrape: http://fasie.ru/

### 7. **GitHub/GitLab**
- Repositories with tags: UAV, БПЛА, autonomous, drone, robotics
- Stars, commits, contributors as growth signals
- GitHub API search

### 8. **News/Media**
- Sources: VC.ru, Habr, Rusbase, RBC Tech
- AI sentiment analysis
- Entity extraction

## Pipeline Stages

### Stage 1: Parsing
```javascript
// Pseudo-code
async function parseSource(source) {
  const rawData = await fetchFromSource(source)
  const entities = extractEntities(rawData)
  return entities.map(e => ({
    source: source.name,
    company: e.name,
    inn: e.inn,
    description: e.description,
    signals: e.signals,
    foundAt: new Date()
  }))
}
```

### Stage 2: Deduplication
```javascript
// Use KAG (Knowledge-Augmented Generation)
async function deduplicate(leads) {
  for (const lead of leads) {
    const existing = await kag.find({
      inn: lead.inn,
      name: similarTo(lead.company)
    })

    if (existing) {
      // Merge signals
      existing.signals.push(...lead.signals)
      await kag.update(existing)
    } else {
      await kag.insert(lead)
    }
  }
}
```

### Stage 3: AI Scoring
```javascript
async function scoreStartup(lead) {
  const prompt = `
Оцени стартап для ФСТ НТИ (фонд суверенных технологий):

Компания: ${lead.company}
Сектор: ${lead.sector}
Описание: ${lead.description}
Сигналы роста: ${lead.signals.join(', ')}

Критерии оценки:
1. Релевантность сектору ФСТ (БАС/РОБО/МЭ): 0-100
2. Предварительная суверенность (по публичным данным): 0-9
3. Вероятность прохождения gate-критериев ФСТ: 0-100

Сигналы роста:
- Найм (активность на HH.ru)
- Патенты (заявки в ФИПС)
- Контракты (упоминания в СМИ)
- PR (позитивный sentiment)

Верни JSON:
{
  "score": 0-100 (итоговая оценка),
  "relevance": 0-100,
  "sovereignty": 0-9,
  "gatePass": 0-100,
  "reasoning": "краткое обоснование"
}
`

  const response = await fetch('/api/ai-tokens/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: 'deepseek/deepseek-chat', // Fast for structured data
      prompt,
      systemPrompt: 'Ты — AI-аналитик венчурного фонда ФСТ НТИ.',
      application: 'FstSourcing'
    })
  })

  const result = await response.json()
  return JSON.parse(result.response)
}
```

### Stage 4: Storage (Integram)
```javascript
// Store in ai2o.ru/fst database
async function storeLeads(leads) {
  for (const lead of leads) {
    await fetch('https://ai2o.ru/fst/_m_new/LEAD_TYPE_ID', {
      method: 'POST',
      headers: {
        'X-Authorization': integramToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'tNAME_FIELD_ID': lead.company,
        'rSECTOR_FIELD_ID': lead.sector,
        'rSOURCE_FIELD_ID': lead.source,
        'rSCORE_FIELD_ID': lead.score,
        'rDESCRIPTION_FIELD_ID': lead.description,
        '_xsrf': xsrfToken
      })
    })
  }
}
```

## API Endpoints

### `GET /api/fst-sourcing/leads`
Fetch sourced leads with filters.

**Query params:**
- `source`: telegram | hh | egrul | fips | skolkovo | bortnik | github | news | all
- `sector`: БАС | РОБО | МЭ | all
- `score`: high (75+) | medium (50-74) | low (<50) | all
- `period`: today | week | month | all
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "leads": [
    {
      "id": 1,
      "company": "ООО АвтоПилот",
      "sector": "БАС",
      "source": "GitHub",
      "score": 82,
      "description": "...",
      "foundAt": "2026-03-06T10:00:00Z",
      "signals": [
        { "type": "GitHub", "text": "340 stars" },
        { "type": "Патенты", "text": "2 заявки в ФИПС" }
      ],
      "aiAnalysis": {
        "relevance": 95,
        "sovereignty": 7,
        "gatePass": 82
      },
      "contact": {
        "inn": "7701234567",
        "website": "https://...",
        "email": "info@..."
      }
    }
  ],
  "total": 120,
  "stats": {
    "totalLeads": 120,
    "highScore": 45,
    "thisWeek": 23,
    "addedToDealflow": 12
  }
}
```

### `POST /api/fst-sourcing/scan`
Trigger manual scan of all sources.

**Body:**
```json
{
  "sources": ["telegram", "hh", "github"], // optional, default: all enabled
  "keywords": "БПЛА, UAV, дрон" // optional, override default
}
```

**Response:**
```json
{
  "status": "running",
  "jobId": "scan-2026-03-07-12345",
  "estimatedTime": "5-10 minutes"
}
```

### `POST /api/fst-sourcing/settings`
Update sourcing settings.

**Body:**
```json
{
  "sources": {
    "telegram": { "enabled": true },
    "hh": { "enabled": true },
    "fips": { "enabled": false }
  },
  "keywords": "UAV, БПЛА, autonomous, дрон",
  "updateFrequency": "daily" // hourly | daily | weekly | manual
}
```

### `POST /api/fst-sourcing/lead/:id/add-to-dealflow`
Add a sourced lead to the dealflow pipeline.

**Response:**
```json
{
  "success": true,
  "dealflowId": 123,
  "dealflowUrl": "/fst-dealflow"
}
```

## Scheduler (Cron)

### Daily scan (default)
```bash
# /etc/cron.d/fst-sourcing-daily
0 6 * * * /usr/bin/node /app/backend/monolith/src/services/sourcing/scan.mjs >> /var/log/fst-sourcing.log 2>&1
```

### Hourly scan (optional)
```bash
# /etc/cron.d/fst-sourcing-hourly
0 * * * * /usr/bin/node /app/backend/monolith/src/services/sourcing/scan.mjs >> /var/log/fst-sourcing.log 2>&1
```

## SOCKS Proxy (9050)
Use for Russian sources that may require proxying:
```javascript
const { SocksProxyAgent } = require('socks-proxy-agent')

const agent = new SocksProxyAgent('socks5://127.0.0.1:9050')

const response = await fetch('https://egrul.nalog.ru/...', { agent })
```

## Integration with KAG

Store company profiles in the knowledge graph:
```javascript
// KAG node structure
{
  type: 'Company',
  name: 'ООО АвтоПилот',
  inn: '7701234567',
  sector: 'БАС',
  sources: ['GitHub', 'ФИПС'],
  signals: [
    { type: 'GitHub', date: '2026-03-06', value: 340 },
    { type: 'Patent', date: '2026-02-15', value: 2 }
  ],
  aiScores: [
    { date: '2026-03-06', score: 82, relevance: 95, sovereignty: 7 }
  ],
  edges: [
    { type: 'SIMILAR_TO', target: 'ООО ДронТех' },
    { type: 'ADDED_TO_DEALFLOW', target: 'Deal_456' }
  ]
}
```

## Implementation Priority

1. **Phase 1 (MVP):** Frontend UI + Mock data ✅
2. **Phase 2:** GitHub/GitLab scraper
3. **Phase 3:** ЕГРЮЛ/ФНС integration
4. **Phase 4:** HH.ru monitoring
5. **Phase 5:** Telegram integration (reuse tg-search-agent)
6. **Phase 6:** ФИПС scraper
7. **Phase 7:** Skolkovo API
8. **Phase 8:** News/Media scraper + sentiment

## Performance

- **Scan frequency:** Daily (default), hourly (optional)
- **Processing time:** ~5-10 minutes per full scan
- **Rate limits:** Respect API limits (GitHub: 5000/hour, ЕГРЮЛ: 100/day)
- **Storage:** ~100-200 new leads per day → ~3-6K leads/month

## Security

- API keys in `.env` (never commit)
- Integram token rotation
- SOCKS proxy for anonymity
- Rate limiting on endpoints

## Monitoring

- Track scan success rate
- Monitor API errors by source
- Alert on zero leads (possible scraper breakage)
- Log AI scoring quality

---

**Status:** Phase 1 (Frontend MVP) — Complete
**Next:** Implement GitHub scraper

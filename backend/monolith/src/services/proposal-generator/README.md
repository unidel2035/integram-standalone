# Proposal Generator Service

**Issue #4467** - Business Intelligence-driven Proposal Generator

## Overview

Automated system for generating personalized commercial proposals (КП) with AI-powered content and data-driven cost analysis.

## Features

### 1. Company Data Collection

- **Website Parsing**: Extracts company information from domain
  - Meta descriptions
  - Contact information (email, phone)
  - Product catalog size
  - FAQ sections
  - Forms and blog content

- **Data Sources**:
  - Company website (primary)
  - Public registries (planned)
  - Manual input (fallback)

### 2. Industry Detection

- **OKVED Classification**: Automatically determines industry code
- **Keyword-Based Detection**: Uses website description for classification
- **Confidence Scoring**: Returns probability of correct classification (0-1)

Supported Industries:
- 62.01 - Software Development
- 62.02 - System Administration
- 73.11 - Marketing/Advertising
- 47.91 - Retail Sales
- 56.10 - Food Service
- 68.20 - Real Estate
- 85.41 - Education

### 3. Employee Cost Calculation

- **Salary Data Parsing**: HH.ru/Avito job market data
- **Position Mapping**: OKVED → target job positions
- **Cost Analysis**:
  - Median salary calculation
  - 30% overhead for taxes/benefits
  - Regional adjustments

### 4. Routine Task Analysis

Analyzes website to estimate time spent on:
- Product updates (20 min/product)
- FAQ management (15 min/question)
- Form processing (10 min/form submission)
- Content creation (120 min/article)

Outputs:
- Total hours per month
- FTE (Full-Time Equivalent) calculation
- Detailed breakdown by task type

### 5. AI-Powered Proposal Generation

- **LLM Integration**: DeepSeek via TokenBasedLLMCoordinator
- **Value-Based Selling**: Focus on ROI and cost savings
- **Personalization**: Uses collected data to create targeted messaging
- **Fallback**: Basic HTML template if AI unavailable

## API Endpoints

### POST `/api/proposal-generator/generate`

Generate a complete commercial proposal.

**Request Body:**
```json
{
  "companyName": "ООО Ромашка",
  "domain": "romashka.ru",
  "region": "Москва",
  "userId": "user-123"
}
```

**Response:**
```json
{
  "success": true,
  "proposal": "<html>...</html>",
  "data": {
    "company": { ... },
    "industry": { ... },
    "cost": { ... },
    "routine": { ... },
    "competitors": { ... }
  },
  "saved": { ... }
}
```

### GET `/api/proposal-generator/analyze/:domain`

Analyze a company website without generating full proposal.

**Response:**
```json
{
  "success": true,
  "data": {
    "company": {
      "name": "Unknown",
      "domain": "example.com",
      "description": "...",
      "website": {
        "productCount": 50,
        "faqCount": 10,
        ...
      }
    },
    "industry": {
      "okved": "62.01",
      "industry": "Разработка ПО",
      "confidence": 0.85
    },
    "routine": {
      "totalHoursPerMonth": 120,
      "equivalentFTE": 0.75
    }
  }
}
```

### GET `/api/proposal-generator/salary/:position/:region?`

Get salary data for a specific position.

**Response:**
```json
{
  "success": true,
  "data": {
    "position": "программист",
    "region": "Москва",
    "averageSalary": 150000,
    "fullCost": 195000
  }
}
```

### GET `/api/proposal-generator/okved-positions/:okved`

Get target positions for OKVED code.

**Response:**
```json
{
  "success": true,
  "data": {
    "okved": "62.01",
    "positions": ["программист", "тестировщик", "разработчик"],
    "count": 3
  }
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Vue.js)                      │
│  - ProposalGenerator.vue                │
│  - Input form                           │
│  - Results display                      │
└──────────────┬──────────────────────────┘
               │ HTTP
               ▼
┌─────────────────────────────────────────┐
│  Backend API (Express)                  │
│  - /api/proposal-generator/*            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ProposalGeneratorService               │
│  ├─ collectCompanyData()                │
│  ├─ detectIndustryAndRegion()           │
│  ├─ calculateEmployeeCost()             │
│  ├─ analyzeWebsiteRoutine()             │
│  ├─ collectCompetitiveContext()         │
│  ├─ generateProposalWithAI()            │
│  └─ saveProposalData()                  │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┬────────────────┐
       ▼                ▼                ▼
┌─────────────┐  ┌────────────┐  ┌─────────────┐
│ Web Scraper │  │ HH.ru API  │  │ DeepSeek AI │
│ (axios +    │  │ (job data) │  │ (TokenBased │
│  cheerio)   │  │            │  │  LLM)       │
└─────────────┘  └────────────┘  └─────────────┘
```

## Data Storage

Following project guidelines, the service **does NOT create databases directly**. Instead:

- **Current**: Returns metadata for proposed storage
- **Future**: Integration with Integram MCP for persistent storage
- **Local**: Can save to files for prototyping

Proposed Integram Tables:
- `proposals` - Generated proposals
- `company_data` - Collected company information
- `salary_data_cache` - Cached salary information

## Usage Example

```javascript
import ProposalGeneratorService from './ProposalGeneratorService.js'

const service = new ProposalGeneratorService({ db })

// Generate proposal
const result = await service.generateProposal({
  companyName: 'ООО Ромашка',
  domain: 'romashka.ru',
  region: 'Москва',
  userId: 'user-123'
})

console.log(result.proposal) // HTML proposal
console.log(result.data.cost.fullCost) // 195000 руб./мес.
```

## Testing

Run tests with:

```bash
cd backend/monolith
npm test -- src/services/proposal-generator/__tests__
```

Test coverage includes:
- Industry detection logic
- Employee cost calculation
- Routine analysis
- Data extraction (email, phone)
- Proposal prompt building
- Fallback proposal generation

## Dependencies

- `axios` - HTTP requests for web scraping
- `cheerio` - HTML parsing (like jQuery for Node.js)
- `TokenBasedLLMCoordinator` - AI integration

## Future Enhancements

1. **Integram MCP Integration**
   - Save proposals to database
   - Proposal history and templates
   - Version control for proposals

2. **Enhanced Data Sources**
   - Official HH.ru API integration
   - Government procurement data (zakupki.gov.ru)
   - Marketplace data (Wildberries, Ozon)

3. **Advanced Analytics**
   - Competitor analysis
   - Market trend detection
   - Custom industry templates

4. **Export Formats**
   - PDF generation
   - DOCX export
   - PowerPoint presentations

5. **Collaboration Features**
   - Sales team comments
   - Proposal approval workflow
   - Client feedback tracking

## Troubleshooting

**Issue**: No salary data returned
- **Solution**: Check HH.ru accessibility, fallback to manual input

**Issue**: Industry detection confidence < 0.5
- **Solution**: Ask user to select industry manually, improve keyword mappings

**Issue**: AI generation fails
- **Solution**: Service automatically falls back to basic HTML template

**Issue**: Website parsing fails
- **Solution**: Check domain accessibility, validate URL format

## Security Considerations

- **Input Validation**: All user inputs are sanitized
- **Rate Limiting**: HH.ru requests are rate-limited to avoid blocking
- **XSS Prevention**: DOMPurify used on frontend for HTML rendering
- **API Keys**: DeepSeek key stored securely in environment variables

## Performance

- **Average Generation Time**: 10-30 seconds
- **Breakdown**:
  - Website parsing: 2-5 sec
  - Salary data fetching: 3-10 sec
  - AI generation: 5-15 sec
- **Caching**: Salary data can be cached for 24 hours

## License

Part of DronDoc platform - proprietary software.

## Contact

For questions or issues:
- GitHub: https://github.com/unidel2035/dronedoc2025/issues/4467
- Team: DronDoc Development Team

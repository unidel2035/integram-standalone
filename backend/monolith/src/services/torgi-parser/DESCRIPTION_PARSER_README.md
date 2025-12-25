# Torgi Description Parser

## Overview

The Torgi Description Parser automatically extracts structured data from unstructured description text in torgi.gov.ru lot listings. It parses Russian text to identify key information such as cadastral numbers, areas, permitted uses, and other property characteristics.

## Purpose

Many torgi.gov.ru lot listings have rich information embedded in the "Описание" (Description) field, but the corresponding structured fields remain empty. This parser automatically fills these structured fields by extracting data from the description text.

## Supported Data Types

The parser can extract the following information:

### 1. Cadastral Number (Кадастровый номер)
- **Pattern**: XX:XX:XXXXXX:XXX format (e.g., 64:32:023644:496)
- **Keywords**:
  - "кадастровый номер"
  - "кадастровым номером"
  - "кадастровому номеру"
  - "кад. №"
- **Example**: "земельный участок с кадастровым номером 64:32:023644:496"
- **Target Field**: 553 (Кадастровый номер)

### 2. Area (Площадь)
- **Units**: Square meters (кв.м, м²)
- **Formats**:
  - Integer: "1168 кв. м"
  - Decimal with dot: "14.5 кв. м"
  - Decimal with comma: "14,5 кв. м"
- **Keywords**: "площадь", "площадью", "общая площадь"
- **Example**: "площадью 1168 кв. м"
- **Target Field**: 554 (Площадь м2)

### 3. Permitted Use (Разрешенное использование)
- **Keywords**:
  - "разрешенное использование:"
  - "вид разрешённого использования:"
  - "для [назначение]"
- **Examples**:
  - "разрешенное использование: ведение садоводства"
  - "для индивидуального жилищного строительства"
- **Target Field**: 555 (Разрешенное использование)

### 4. Ownership Form (Форма собственности)
- **Types**:
  - Государственная собственность
  - Муниципальная собственность
  - Частная собственность
  - Федеральная собственность
- **Example**: "имущество государственная собственность"
- **Target Field**: 556 (Форма собственности)

### 5. Restrictions (Ограничения прав)
- **Keywords**:
  - "ограничения прав"
  - "обременения"
  - "зона с особыми условиями"
  - "водоохранная зона"
  - "санитарно-защитная зона"
- **Example**: "Земельный участок частично расположен в зоне с особыми условиями использования территории"
- **Target Field**: 557 (Ограничения прав)

### 6. VIN Number (for vehicles)
- **Pattern**: 17-character alphanumeric code
- **Format**: "VIN XXXXXXXXXXXXXXXXX"
- **Example**: "VIN XTA210930M0784689"

### 7. Year (Год)
- **For**: Vehicles, buildings
- **Formats**:
  - "1990 г.в." (год выпуска)
  - "2010г" (short form)
  - "год постройки – 1999"
- **Range**: 1900 to current year + 2

## Architecture

### Core Module
- **File**: `src/services/torgi-parser/descriptionParser.js`
- **Type**: Pure JavaScript module (ES6)
- **Dependencies**: None (uses only standard JavaScript)

### Functions

#### `extractCadastralNumber(description)`
Extracts cadastral number from description text.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (string|null): Cadastral number in XX:XX:XXXXXX:XXX format or null if not found

**Example:**
```javascript
const cadastralNumber = extractCadastralNumber(
  'земельный участок с кадастровым номером 64:32:023644:496'
)
// Returns: '64:32:023644:496'
```

#### `extractArea(description)`
Extracts area in square meters from description text.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (number|null): Area in square meters or null if not found

**Example:**
```javascript
const area = extractArea('площадью 1168 кв. м')
// Returns: 1168

const areaDecimal = extractArea('Общая площадь объекта: 14,5 кв. м')
// Returns: 14.5
```

#### `extractPermittedUse(description)`
Extracts permitted use (вид разрешенного использования) from description.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (string|null): Permitted use description or null if not found

**Example:**
```javascript
const use = extractPermittedUse('разрешенное использование: ведение садоводства')
// Returns: 'ведение садоводства'
```

#### `extractOwnershipForm(description)`
Extracts ownership form (форма собственности) from description.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (string|null): Ownership form or null if not found

**Example:**
```javascript
const ownership = extractOwnershipForm('имущество государственная собственность')
// Returns: 'Государственная'
```

#### `extractRestrictions(description)`
Extracts restrictions (ограничения прав) from description.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (string|null): Restrictions description or null if not found

**Example:**
```javascript
const restrictions = extractRestrictions(
  'Земельный участок частично расположен в зоне с особыми условиями использования территории'
)
// Returns: 'Земельный участок частично расположен в зоне с особыми условиями использования территории.'
```

#### `extractVIN(description)`
Extracts VIN number for vehicles.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (string|null): VIN number (17 characters) or null if not found

**Example:**
```javascript
const vin = extractVIN('Автомобиль ВАЗ 21093, VIN XTA210930M0784689')
// Returns: 'XTA210930M0784689'
```

#### `extractYear(description)`
Extracts year for vehicles or buildings.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (number|null): Year (1900-current+2) or null if not found

**Example:**
```javascript
const year = extractYear('Автомобиль ВАЗ 21093, 1990 г.в.')
// Returns: 1990

const buildingYear = extractYear('год постройки – 1999')
// Returns: 1999
```

#### `parseDescription(description)`
Main parser function that extracts all available structured data from description.

**Parameters:**
- `description` (string): Lot description text

**Returns:**
- (Object): Object containing all extracted fields

**Example:**
```javascript
const result = parseDescription(
  'земельный участок площадью 1168 кв. м с кадастровым номером 64:32:023644:496'
)
// Returns:
// {
//   cadastralNumber: '64:32:023644:496',
//   area: 1168
// }
```

#### `generateParsingSummary(parsedData)`
Generates human-readable summary of parsed data.

**Parameters:**
- `parsedData` (Object): Result from `parseDescription()`

**Returns:**
- (string): Human-readable summary

**Example:**
```javascript
const summary = generateParsingSummary({
  cadastralNumber: '64:32:023644:496',
  area: 1168
})
// Returns:
// "Кадастровый номер: 64:32:023644:496
//  Площадь: 1168 м²"
```

## Integration with TorgiParserService

### Methods

#### `parseAndUpdateLotDescription(objectId)`
Parses description for a single lot and updates structured fields in Integram.

**Parameters:**
- `objectId` (number): Integram object ID for the lot

**Returns:**
- (Object): Result object with success status, parsed data, and updated fields

**Example:**
```javascript
const service = new TorgiParserService()
await service.authenticate({ serverURL, database, login, password })

const result = await service.parseAndUpdateLotDescription(2619)
// Returns:
// {
//   success: true,
//   objectId: 2619,
//   parsedData: { cadastralNumber: '64:32:023644:496', area: 1168 },
//   updatedFields: { '553': '64:32:023644:496', '554': 1168 }
// }
```

#### `parseAndUpdateMultipleLots(objectIds, options)`
Parses descriptions for multiple lots with batch processing.

**Parameters:**
- `objectIds` (Array<number>): Array of Integram object IDs
- `options` (Object):
  - `batchSize` (number): Number of lots to process in parallel (default: 10)
  - `delayMs` (number): Delay between batches in milliseconds (default: 1000)

**Returns:**
- (Object): Aggregated results with success/failure counts

**Example:**
```javascript
const result = await service.parseAndUpdateMultipleLots([2619, 2621, 2623], {
  batchSize: 2,
  delayMs: 500
})
// Returns:
// {
//   total: 3,
//   successful: 3,
//   failed: 0,
//   results: [/* detailed results for each lot */],
//   durationMs: 1234
// }
```

#### `parseAllDescriptions(options)`
Parses descriptions for all lots in the database with optional filtering.

**Parameters:**
- `options` (Object):
  - `limit` (number): Maximum number of lots to process (default: 100)
  - `offset` (number): Starting offset for pagination (default: 0)
  - `onlyEmpty` (boolean): Only process lots with empty structured fields (default: false)
  - `batchSize` (number): Batch size for processing (default: 10)
  - `delayMs` (number): Delay between batches (default: 1000)

**Returns:**
- (Object): Aggregated results with success/failure counts

**Example:**
```javascript
const result = await service.parseAllDescriptions({
  limit: 50,
  onlyEmpty: true,
  batchSize: 5
})
// Returns:
// {
//   total: 50,
//   successful: 48,
//   failed: 2,
//   results: [/* detailed results */],
//   durationMs: 15678
// }
```

## API Endpoints

### POST `/api/torgi-parser/parse-description`
Parses description for a single lot.

**Request Body:**
```json
{
  "login": "d",
  "password": "d",
  "objectId": 2619
}
```

**Response:**
```json
{
  "success": true,
  "objectId": 2619,
  "parsedData": {
    "cadastralNumber": "64:32:023644:496",
    "area": 1168
  },
  "updatedFields": {
    "553": "64:32:023644:496",
    "554": 1168
  }
}
```

### POST `/api/torgi-parser/parse-descriptions-batch`
Parses descriptions for multiple lots with batch processing.

**Request Body:**
```json
{
  "login": "d",
  "password": "d",
  "objectIds": [2619, 2621, 2623],
  "batchSize": 10,
  "delayMs": 1000
}
```

**Response:**
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "success": true,
      "objectId": 2619,
      "parsedData": { "cadastralNumber": "64:32:023644:496", "area": 1168 }
    }
  ],
  "durationMs": 2345
}
```

### POST `/api/torgi-parser/parse-all-descriptions`
Parses descriptions for all lots with filtering options.

**Request Body:**
```json
{
  "login": "d",
  "password": "d",
  "limit": 100,
  "offset": 0,
  "onlyEmpty": true,
  "batchSize": 10,
  "delayMs": 1000
}
```

**Response:**
```json
{
  "total": 100,
  "successful": 95,
  "failed": 5,
  "results": [/* detailed results */],
  "durationMs": 12345
}
```

## Testing

### Unit Tests
Run unit tests with:
```bash
node src/services/torgi-parser/__tests__/testDescriptionParser.js
```

Tests cover:
- Cadastral number extraction (4 tests)
- Area extraction (5 tests)
- Permitted use extraction (2 tests)
- Ownership form extraction (3 tests)
- Restrictions extraction (2 tests)
- VIN extraction (2 tests)
- Year extraction (3 tests)
- Integration tests with real examples (7 tests)

**Total: 28 tests**

### Integration Tests
Run integration tests with real Integram data:
```bash
node examples/test-torgi-description-parser.js
```

This tests:
- Authentication with Integram
- Parsing single objects
- Batch parsing
- Field updates in database

## Field Mapping

| Parsed Field | Integram Field ID | Field Name |
|--------------|-------------------|------------|
| cadastralNumber | 553 | Кадастровый номер |
| area | 554 | Площадь м2 |
| permittedUse | 555 | Разрешенное использование |
| ownershipForm | 556 | Форма собственности |
| restrictions | 557 | Ограничения прав |

## Error Handling

The parser is designed to be fault-tolerant:
- Returns `null` for individual extractors when pattern not found
- Returns empty object `{}` from `parseDescription()` when no data found
- Batch processing continues even if individual lots fail
- Failed lots are reported in results with error messages
- API endpoints return appropriate HTTP status codes

## Performance Considerations

### Batch Processing
- Default batch size: 10 lots in parallel
- Default delay between batches: 1000ms
- Configurable via options to prevent API overload

### Regex Patterns
- Optimized patterns for common Russian text formats
- Case-insensitive matching
- Early returns on first match

### Database Updates
- Only updates fields that have new data
- Skips empty/null values
- Single API call per lot for updates

## Use Cases

### 1. Initial Data Population
Parse descriptions for all existing lots with empty fields:
```javascript
await service.parseAllDescriptions({ onlyEmpty: true, limit: 1000 })
```

### 2. Single Lot Update
Update a specific lot after manual review:
```javascript
await service.parseAndUpdateLotDescription(2619)
```

### 3. Batch Processing
Process a specific set of lots:
```javascript
await service.parseAndUpdateMultipleLots([2619, 2621, 2623, 2625])
```

## Limitations

1. **Language**: Only Russian text supported
2. **Format Variations**: May not catch all possible text variations
3. **Complex Descriptions**: Very complex or poorly formatted descriptions may not parse correctly
4. **Data Quality**: Output quality depends on input description quality

## Future Enhancements

Possible improvements:
- Support for English descriptions
- Machine learning for better text understanding
- Automatic detection of description format/structure
- Confidence scores for extracted data
- Support for additional data types (coordinates, building characteristics, etc.)

## Related Issues

- **Issue #4662**: Original requirement for description parsing
- **PR #4663**: Implementation pull request

## Credits

Developed as part of the DronDoc 2025 project for automating torgi.gov.ru data processing.

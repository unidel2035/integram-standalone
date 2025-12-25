# DATETIME Fix for Integram MCP Server

## Problem

When creating or updating objects in Integram via MCP with DATETIME fields, dates were being saved incorrectly:

- Input: `"2025-12-16"` (current date)
- Saved as: `"23.08.1970 12:20:16"` ❌ (incorrect Unix timestamp interpretation)

### Root Cause

The MCP server was formatting dates as bare numbers without dashes (e.g., `20251216`). Integram's PHP backend interpreted these as **Unix timestamp seconds** instead of dates:

```
20251216 seconds from 1970-01-01 = ~234 days = August 23, 1970
```

## Solution

Modified the `formatRequisiteValue()` function in `integram-server.js` to use **ISO format with dashes**:

### Before (Broken)
```javascript
// Compact format without dashes - FAILS!
return `${year}${month}${day} ${hours}:${minutes}:${seconds}`;
// Output: "20251216 14:30:00" → interpreted as Unix timestamp!
```

### After (Fixed)
```javascript
// ISO format with dashes - WORKS!
return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
// Output: "2025-12-16 14:30:00" → correctly parsed as date!
```

## CRITICAL: Format Requirements

**Correct formats that WORK:**
- `YYYY-MM-DD` → `"2025-12-16"` ✅
- `YYYY-MM-DD HH:MM:SS` → `"2025-12-16 18:30:00"` ✅
- `DD.MM.YYYY` → `"16.12.2025"` ✅
- `DD.MM.YYYY HH:MM:SS` → `"16.12.2025 18:30:00"` ✅
- `MM/DD/YYYY` → `"12/16/2025"` ✅

**Wrong formats that FAIL:**
- `YYYYMMDD` (without dashes) → interpreted as Unix timestamp ❌
- `YYYYMMDD HH:MM:SS` (without dashes) → interpreted as Unix timestamp ❌

## Test Results (2025-12-16)

```
Format                 Result                 Status
------                 ------                 ------
16.12.2025             16.12.2025 00:00:00    ✅ OK
16.12.2025 18:30:45    16.12.2025 18:30:45    ✅ OK
2025-12-16             16.12.2025 00:00:00    ✅ OK
2025-12-16 18:30:45    16.12.2025 18:30:45    ✅ OK
20251216               23.08.1970 12:20:16    ❌ FAIL
20251216 18:30:45      23.08.1970 12:20:16    ❌ FAIL
12/16/2025             16.12.2025 00:00:00    ✅ OK
16-12-2025             16.12.2025 00:00:00    ✅ OK
```

## Examples

| Input | Output (to Integram) | Saved As |
|-------|---------------------|----------|
| `"2025-12-16"` | `"2025-12-16 00:00:00"` | `"16.12.2025 00:00:00"` ✅ |
| `"2025-12-16T14:30:00"` | `"2025-12-16 14:30:00"` | `"16.12.2025 14:30:00"` ✅ |
| `"16.12.2025"` | `"2025-12-16 00:00:00"` | `"16.12.2025 00:00:00"` ✅ |
| `"16.12.2025 18:45:30"` | `"2025-12-16 18:45:30"` | `"16.12.2025 18:45:30"` ✅ |

## Testing

Run the test script to verify format compatibility:

```bash
cd /home/hive/dronedoc2025/backend/monolith
node test-datetime-formats.cjs
```

## Usage in MCP

After applying this fix, you can create objects with dates using natural formats:

```javascript
// ISO format (recommended)
integram_create_object({
  typeId: 994775,
  value: "Test",
  requisites: {
    "995236": "2025-12-16"  // Converts to "2025-12-16 00:00:00"
  }
})

// Russian format
integram_create_object({
  typeId: 994775,
  value: "Test",
  requisites: {
    "995236": "16.12.2025"  // Converts to "2025-12-16 00:00:00"
  }
})

// With time
integram_create_object({
  typeId: 994775,
  value: "Test",
  requisites: {
    "995236": "2025-12-16T14:30:00"  // Converts to "2025-12-16 14:30:00"
  }
})
```

## Applying the Fix

1. **Code is already updated** in:
   - `backend/monolith/src/services/mcp/integram-server.js`
   - `src/services/integramApiClient.js`

2. **Restart backend server** (if using HTTP MCP bridge):
   ```bash
   pm2 restart dronedoc-backend
   # OR
   sudo systemctl restart dronedoc-backend
   ```

3. **Restart Claude Code session** to reload MCP server (stdio mode):
   - Exit Claude Code
   - Restart Claude Code

## Verification

After restarting, test with:

```javascript
integram_create_object({
  typeId: 994775,
  value: "Verification Test",
  requisites: { "995236": "2025-12-16" }
})
```

Then check the saved date:
```javascript
integram_get_object_edit_data({ objectId: <new_object_id> })
```

Expected: `"value": "16.12.2025 00:00:00"` ✅

## Files Changed

- `backend/monolith/src/services/mcp/integram-server.js`
  - Modified `formatRequisiteValue()` function
  - Uses ISO format with dashes (YYYY-MM-DD HH:MM:SS)

- `src/services/integramApiClient.js`
  - Same fix applied to frontend client

## Issue Reference

- Original issue: Creating objects with DATETIME fields resulted in incorrect dates (1970)
- Root cause: Compact date format (YYYYMMDD) interpreted as Unix timestamp
- Fix: Use ISO format with dashes (YYYY-MM-DD HH:MM:SS)
- Fix applied: 2025-12-16
- Test script: `backend/monolith/test-datetime-formats.cjs`

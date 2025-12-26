# Integram API v2 Authentication Fix

## Problem

API v2 was using hardcoded mock authentication instead of real Integram API authentication.

## Solution

### 1. Updated IntegramAuthService (src/services/IntegramAuthService.cjs)

**Key changes:**
- Implemented real Integram API authentication using official endpoint
- Endpoint: `POST https://dronedoc.ru/{database}/auth?JSON_KV`
- Request format: form-urlencoded with fields `login` and `pwd` (not `password`!)
- Response format: `{ token, _xsrf, id, msg }`
- Added session management with in-memory store (Map)
- Added session validation and expiration handling

**Authentication flow:**
```javascript
1. POST /auth with form-urlencoded body: login=...&pwd=...
2. Receive response: { token, _xsrf, id }
3. Generate session ID and store session data
4. Return session ID to client
```

### 2. Updated server-api-v2.js

**Changes:**
- Changed default port from 3000 to 3001
- Added environment variable support: `API_V2_PORT`

### 3. Test Results

Created comprehensive test suite (`test-api-v2-complete.cjs`) that validates:

✅ **Test 1**: Server health check
✅ **Test 2**: Real Integram API authentication
✅ **Test 3**: Session verification
✅ **Test 4**: Get dictionary (list of types)
✅ **Test 5**: Get type metadata
✅ **Test 6**: Logout

All tests passed successfully!

### 4. Test Files

Created additional test files:
- `test-auth-service.cjs` - Unit tests for IntegramAuthService
- `test-api-v2-complete.cjs` - Integration tests for API v2

## Usage

### Start API v2 Server

```bash
cd backend/monolith
node src/server-api-v2.js
```

Server will start on port 3001 (or use `API_V2_PORT` environment variable).

### Test Authentication

```bash
node test-auth-service.cjs
```

### Test Complete API v2

```bash
node test-api-v2-complete.cjs
```

## API Endpoints

### Authentication

**POST /api/v2/auth**
```json
{
  "data": {
    "type": "auth",
    "attributes": {
      "login": "d",
      "password": "d",
      "database": "a2025"
    }
  }
}
```

Response:
```json
{
  "data": {
    "type": "auth-session",
    "id": "sess_...",
    "attributes": {
      "userId": "1153",
      "session": "sess_...",
      "token": "...",
      "expiresAt": "..."
    }
  }
}
```

### Verify Session

**GET /api/v2/auth/verify**
```
Authorization: Bearer sess_...
```

### Get Dictionary

**GET /api/v2/integram/databases/{database}/types**
```
Authorization: Bearer sess_...
```

## Technical Details

### Integram API Authentication

**Endpoint format:**
- URL: `https://dronedoc.ru/{database}/auth?JSON_KV`
- Method: POST
- Content-Type: `application/x-www-form-urlencoded`
- Body: `login={username}&pwd={password}` (note: `pwd`, not `password`!)

**Response format:**
```json
{
  "token": "8df96caccc6a82e05a336cfc499a2cee",
  "_xsrf": "09d938053750c8b2ff4d4f",
  "id": "1153",
  "msg": ""
}
```

**Error format:**
```json
{
  "failed": "error message"
}
```
or
```json
{
  "error": "error message"
}
```

### Session Management

- Sessions stored in-memory (Map)
- Session lifetime: 24 hours
- Session cleanup: manual (call `cleanupExpiredSessions()`)
- Session data includes: userId, login, database, token, xsrf

**Production recommendation:** Use Redis or similar for session storage.

## Files Changed

1. `backend/monolith/src/services/IntegramAuthService.cjs` - Complete rewrite with real API integration
2. `backend/monolith/src/server-api-v2.js` - Port change to 3001
3. `backend/monolith/test-auth-service.cjs` - New test file
4. `backend/monolith/test-api-v2-complete.cjs` - New test file

## Next Steps

1. Add Redis for production session storage
2. Add rate limiting for authentication endpoint
3. Add refresh token support
4. Add logout endpoint implementation (currently just returns success)
5. Add session cleanup cron job

## Notes

- API v2 uses JSON:API 1.1 format for all responses
- All dates in ISO 8601 format
- Session tokens use prefix `sess_`
- Request IDs use prefix `req_`

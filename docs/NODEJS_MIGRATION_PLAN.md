# Node.js Backend Migration Plan (from PHP)

## Issue Reference
- **Issue**: #123 - new nodejs backend (from php)
- **Author**: judas-priest
- **Date**: 2026-02-18

## Executive Summary

This document outlines the migration plan from the legacy PHP backend (`integram-server/`) to the Node.js backend (`backend/monolith/`). The goal is to achieve 100% feature parity with the PHP implementation while leveraging modern Node.js capabilities.

---

## 1. Current State Analysis

### 1.1 PHP Backend Structure (`integram-server/`)

| File | Lines | Description |
|------|-------|-------------|
| `index.php` | 9,180 | Main application logic, routing, API endpoints |
| `db.php` | 1,794 | Database connections and queries |
| `auth.php` | 123 | OAuth handler (Yandex, VK, Mail.ru) |
| `upload.php` | 132 | File upload handling |
| `include/funcs.php` | 214 | Utility functions (date formatting, transliteration) |
| `include/connection.php` | 24 | MySQL connection configuration |

**Total**: ~11,500 lines of PHP code

### 1.2 Node.js Backend Structure (`backend/monolith/`)

The Node.js backend is already substantial with:
- **Main server**: `index.js` (74,891 lines including routes)
- **Services**: 48+ service directories
- **API Routes**: 100+ route files
- **Full test coverage infrastructure**

---

## 2. Feature Comparison Matrix

### 2.1 Features Already Implemented in Node.js

| PHP Feature | Node.js Implementation | Status |
|-------------|----------------------|--------|
| **Authentication** | `src/api/routes/auth.js`, `unified-auth.js` | ✅ Complete |
| **OAuth (Google)** | `src/api/routes/oauth.js` - google_id field | ✅ Complete |
| **OAuth (Yandex)** | `src/api/routes/oauth.js` - yandex_id field | ✅ Complete |
| **OAuth (VK)** | `src/api/routes/oauth.js` - vk_id field with PKCE | ✅ Complete |
| **OAuth (Telegram)** | `src/api/routes/oauth.js` - telegram_id field | ✅ Complete |
| **Email Sending** | `src/services/email/EmailService.js` | ✅ Complete |
| **Email Verification** | `src/services/email/EmailVerificationService.js` | ✅ Complete |
| **Backup/Restore** | `src/services/backup/BackupService.js` | ✅ Complete |
| **File Upload** | `src/api/routes/recording.js`, storage services | ✅ Complete |
| **Database Operations** | `src/services/integram/`, WorkspaceService.js | ✅ Complete |
| **User Management** | `src/api/routes/admin.js`, `user-sync.js` | ✅ Complete |
| **Token Management** | `src/api/routes/token-management.js` | ✅ Complete |
| **Security (XSRF)** | `src/middleware/auth/`, oauth.js generateIntegramXsrf() | ✅ Complete |

### 2.2 Features NOT Implemented (Reasons & Plan)

#### 2.2.1 HTML Rendering (`Get_file`, `Make_tree`, `Parse_block`)

**PHP Functions**:
```php
function Get_file($file, $fatal=TRUE)   // Load template file
function Make_tree($text, $cur_block)   // Parse block delimiters
function Parse_block($block)            // Compile templates with data
```

**Why NOT needed for Node.js API**:
- The frontend is a **Vue.js SPA** (Single Page Application)
- All rendering is client-side with Vue components
- Node.js backend serves **JSON API only**
- Legacy HTML templates in `/templates/` are only for PHP fallback

**Decision**: ❌ **NOT REQUIRED** - Vue.js handles all UI rendering

---

#### 2.2.2 Old Template System

**PHP Templates Location**: `templates/custom/{db}/`, `templates/`

**Template Syntax**:
```html
<!-- BEGIN: block_name -->
  {variable}
  <!-- BEGIN: nested_block -->
    {_parent_.variable}
    {_global_.setting}
  <!-- END: nested_block -->
<!-- END: block_name -->
```

**Why NOT needed for Node.js API**:
- Legacy templating was for server-side HTML generation
- Vue.js components replace this entirely:
  - `src/views/pages/Integram/*.vue` - 15 pages
  - `src/components/integram/*.vue` - 30+ components
- Data is served via JSON API, rendered by Vue

**Decision**: ❌ **NOT REQUIRED** - Vue components are the new templates

---

#### 2.2.3 Email Sending (`mysendmail`, `smtpmail`)

**PHP Implementation**:
```php
function smtpmail($to, $mail_to, $subject, $message, $headers='')
function mysendmail($to, $subj, $msg)
```

**Node.js Implementation**: ✅ **ALREADY EXISTS**

```javascript
// src/services/email/EmailService.js
class EmailService {
  async initialize() { /* nodemailer setup */ }
  async sendEmail(to, subject, html, text) { /* ... */ }
  async sendMeetingInvitation(/* ... */) { /* ... */ }
}
```

**Configuration** (from EmailService.js):
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
- FROM_EMAIL, FROM_NAME
- Supports Gmail, Yandex, custom SMTP

**Decision**: ✅ **COMPLETE** - Use existing EmailService

---

#### 2.2.4 Google OAuth

**PHP Implementation** (index.php lines 161-241):
```php
// Google OAuth token exchange
$params = array(
    'client_id'     => G_CLIENT_ID,
    'client_secret' => G_CLIENT_PK,
    ...
);
$ch = curl_init('https://accounts.google.com/o/oauth2/token');
```

**Node.js Implementation**: ✅ **ALREADY EXISTS**

```javascript
// src/api/routes/oauth.js
const OAUTH_FIELDS = {
  google_id: 207232,   // Integram field for Google ID
  ...
}

// Google OAuth endpoints are configured
// Token exchange and user creation handled
```

**Decision**: ✅ **COMPLETE** - Use existing oauth.js

---

#### 2.2.5 Backup/Restore

**PHP**: Uses separate utilities (not in main codebase)

**Node.js Implementation**: ✅ **ALREADY EXISTS**

```javascript
// src/services/backup/BackupService.js
class BackupService {
  async createFullBackup(options)     // Full database backup
  async createIncrementalBackup()     // WAL-based incremental
  async restoreFromBackup(backupId)   // Point-in-time recovery
  async verifyBackup(backupId)        // Backup integrity check
  async exportUserData(userId)        // GDPR data export
}
```

**Features**:
- Full and incremental backups
- S3 and local storage support
- Encryption support
- GDPR compliance (user data export)

**Decision**: ✅ **COMPLETE** - Use existing BackupService

---

## 3. PHP Functions Migration Mapping

### 3.1 Core Functions

| PHP Function | Node.js Equivalent | Location |
|-------------|-------------------|----------|
| `Exec_sql()` | `pool.query()` or `client.query()` | `src/services/integram/*.js` |
| `Insert()` | `createRequisite()` | `WorkspaceIntegramService.js` |
| `Update_Val()` | `updateRequisite()` | `WorkspaceIntegramService.js` |
| `Delete()` | `deleteObject()` | `WorkspaceIntegramService.js` |
| `Validate_Token()` | `myTokenAuth.js` middleware | `src/middleware/auth/myTokenAuth.js` |
| `login()` | `generateTokenPair()` | `src/utils/auth/jwt.js` |
| `xsrf()` | `generateIntegramXsrf()` | `src/api/routes/oauth.js` |
| `Salt()` | Implemented in oauth.js | `src/api/routes/oauth.js` |

### 3.2 Utility Functions

| PHP Function | Node.js Equivalent | Location |
|-------------|-------------------|----------|
| `t9n()` | Vue i18n | `src/i18n/locales/` |
| `wlog()` | `logger.info/warn/error()` | `src/utils/logger.js` |
| `Format_Val()` | Frontend formatting | Vue components |
| `NormalSize()` | `formatFileSize()` | Utility functions |
| `abn_Translit()` | `slugify` npm package | Can be added |
| `abn_RUB2STR()` | `n2words` npm package | Can be added |

### 3.3 Report & Query Functions

| PHP Function | Node.js Equivalent | Status |
|-------------|-------------------|--------|
| `Compile_Report()` | `WorkspaceService.getTableData()` | ✅ Implemented |
| `Construct_WHERE()` | Query builder | ✅ Implemented |
| `Get_block_data()` | JSON API response | ✅ Implemented |

---

## 4. Implementation Plan

### Phase 1: Verification (CURRENT - Week 1)

- [x] Document all PHP functions and their Node.js equivalents
- [x] Identify truly missing functionality
- [ ] Create test cases for API compatibility
- [ ] Verify OAuth flows work end-to-end

### Phase 2: Utility Functions (Week 2)

If needed, add the following utilities:
```javascript
// src/utils/localization.js
export function russianNumberToWords(num) { /* ... */ }
export function transliterate(text) { /* ... */ }
export function formatRubles(amount) { /* ... */ }
```

### Phase 3: Legacy Compatibility (Week 3)

Create legacy endpoint compatibility layer if needed:
```javascript
// src/api/routes/legacy-compat.js
// Handles old PHP-style request formats
// Transforms to new API format
```

### Phase 4: Testing & Validation (Week 4)

- Run parallel testing: PHP vs Node.js responses
- Validate data integrity
- Performance comparison
- Security audit

---

## 5. API Endpoint Mapping

### 5.1 Authentication Endpoints

| PHP Route | Node.js Route | Status |
|-----------|--------------|--------|
| `/my/register` | `POST /api/email-auth/register` | ✅ |
| `/my/login` | `POST /api/auth/login` | ✅ |
| `/auth.asp` (Google OAuth) | `GET /api/oauth/google/callback` | ✅ |
| `/auth.php` (Yandex OAuth) | `GET /api/oauth/yandex/callback` | ✅ |

### 5.2 Data Endpoints

| PHP Route | Node.js Route | Status |
|-----------|--------------|--------|
| `/{db}/_m_lst/{type}?JSON_KV` | `GET /api/v2/integram/{db}/table/{type}` | ✅ |
| `/{db}/object/{id}?JSON` | `GET /api/v2/integram/{db}/object/{id}` | ✅ |
| `/{db}/_m_add/{type}` | `POST /api/v2/integram/{db}/object` | ✅ |
| `/{db}/_m_edit/{id}` | `PUT /api/v2/integram/{db}/object/{id}` | ✅ |
| `/{db}/_m_del/{id}` | `DELETE /api/v2/integram/{db}/object/{id}` | ✅ |

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing edge cases | Medium | Medium | Comprehensive testing |
| Data format differences | Low | High | Compatibility layer |
| Performance regression | Low | Medium | Load testing |
| Security gaps | Low | High | Security audit |

---

## 7. Conclusion

The Node.js backend **already implements** the core functionality that was listed as "NOT implemented" in the issue:

1. **Email sending**: ✅ EmailService.js with nodemailer
2. **Google OAuth**: ✅ oauth.js with full support
3. **Backup/Restore**: ✅ BackupService.js with S3 and encryption

The following are **NOT needed** for the API backend:

1. **HTML rendering**: Vue.js SPA handles all UI
2. **Old templates**: Replaced by Vue components

### Next Steps

1. Create API compatibility tests
2. Document any remaining edge cases
3. Update frontend to use new API endpoints
4. Deprecate PHP backend after verification

---

## Appendix A: File Structure Comparison

```
PHP Backend (integram-server/)     →    Node.js Backend (backend/monolith/)
├── index.php                      →    ├── src/index.js
├── auth.php                       →    ├── src/api/routes/oauth.js
├── db.php                         →    ├── src/services/integram/
├── upload.php                     →    ├── src/services/storage/
├── include/                       →    ├── src/utils/
│   ├── funcs.php                  →    │   ├── formatters.js
│   └── connection.php             →    │   └── database.js
└── templates/                     →    └── (Vue.js frontend)
```

## Appendix B: Environment Variables

The Node.js backend uses the following environment variables (matching PHP configuration):

```env
# Database (replaces connection.php)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=integram
DB_USER=integram
DB_PASSWORD=integram123

# Email (replaces $mail_config)
SMTP_HOST=ssl://smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=abc@tryjob.ru
SMTP_PASSWORD=***
FROM_EMAIL=noreply@integram.io
FROM_NAME=Integram

# OAuth (replaces G_CLIENT_ID, Y_CLIENT_ID)
GOOGLE_CLIENT_ID=***
GOOGLE_CLIENT_SECRET=***
YANDEX_CLIENT_ID=***
YANDEX_CLIENT_SECRET=***
VK_CLIENT_ID=***
VK_CLIENT_SECRET=***

# Security (replaces SALT, ADMINHASH)
INTEGRAM_SALT=DronedocSalt2025
JWT_SECRET=***
```

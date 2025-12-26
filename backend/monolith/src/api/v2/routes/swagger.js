/**
 * API v2 Swagger UI Routes
 *
 * Интерактивная документация с Swagger UI
 */

const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Загрузить OpenAPI спецификацию
const openapiPath = path.join(__dirname, '../../../../docs/api/openapi-v2.yaml');

let swaggerDocument = null;

try {
  const yamlContent = fs.readFileSync(openapiPath, 'utf8');
  swaggerDocument = yaml.load(yamlContent);
  console.log('✅ [Swagger] OpenAPI specification loaded successfully');
} catch (error) {
  console.error('❌ [Swagger] Failed to load OpenAPI specification:', error.message);
}

/**
 * Swagger UI Options
 * Настройки для интерактивной документации
 */
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    url: '/api/v2/openapi.json',
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    deepLinking: true,
    displayOperationId: true,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 36px; }
  `,
  customSiteTitle: 'Integram API v2 Documentation',
  customfavIcon: '/favicon.ico'
};

/**
 * GET /api/v2/docs
 * Swagger UI интерфейс
 */
if (swaggerDocument) {
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(swaggerDocument, swaggerUiOptions));
} else {
  // Fallback если спецификация не загружена
  router.get('/', (req, res) => {
    res.status(503).json({
      error: 'OpenAPI specification not available',
      message: 'The Swagger UI is temporarily unavailable. Please check server logs.'
    });
  });
}

module.exports = router;

/**
 * Content Extractor
 *
 * Extracts structured data from HTML based on JSON schema
 * Uses CSS selectors and text patterns to find data
 */

import { JSDOM } from 'jsdom';

/**
 * Extract structured data from HTML
 * @param {string} html - HTML content
 * @param {Object} schema - JSON Schema defining what to extract
 * @param {string} instructions - Additional instructions for extraction
 * @returns {Object} Extracted data matching schema
 */
export async function extractData(html, schema, instructions = '') {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const result = {};

  // Process schema properties
  if (schema.type === 'object' && schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      try {
        result[key] = await extractProperty(document, key, propSchema, instructions);
      } catch (error) {
        console.error(`Error extracting ${key}:`, error.message);
        result[key] = null;
      }
    }
  } else if (schema.type === 'array' && schema.items) {
    // Handle array schemas (e.g., list of products)
    result.items = await extractArray(document, schema.items, instructions);
  }

  return result;
}

/**
 * Extract single property from document
 * @param {Document} document - JSDOM document
 * @param {string} key - Property key/name
 * @param {Object} propSchema - Property schema
 * @param {string} instructions - Additional instructions
 * @returns {any} Extracted value
 */
async function extractProperty(document, key, propSchema, instructions) {
  const { type, selector, pattern, format } = propSchema;

  // Try custom selector first
  if (selector) {
    const element = document.querySelector(selector);
    if (element) {
      return parseValue(element.textContent.trim(), type);
    }
  }

  // Try common selectors based on property name
  const commonSelectors = getCommonSelectors(key);
  for (const sel of commonSelectors) {
    const element = document.querySelector(sel);
    if (element && element.textContent.trim()) {
      return parseValue(element.textContent.trim(), type);
    }
  }

  // Try pattern matching in text
  if (pattern) {
    const regex = new RegExp(pattern);
    const match = document.body.textContent.match(regex);
    if (match) {
      return parseValue(match[1] || match[0], type);
    }
  }

  // Fallback: search for text containing key
  const textContent = document.body.textContent;
  const keyPattern = new RegExp(`${key}[:\\s]+([^\\n]+)`, 'i');
  const match = textContent.match(keyPattern);
  if (match) {
    return parseValue(match[1].trim(), type);
  }

  return null;
}

/**
 * Extract array of items from document
 * @param {Document} document - JSDOM document
 * @param {Object} itemSchema - Schema for array items
 * @param {string} instructions - Additional instructions
 * @returns {Array} Extracted items
 */
async function extractArray(document, itemSchema, instructions) {
  const items = [];

  // Common container selectors for lists
  const listSelectors = [
    '.product',
    '.item',
    'article',
    '[itemtype*="Product"]',
    '.result',
    '.listing',
  ];

  for (const selector of listSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) continue;

    for (const element of elements) {
      try {
        const item = {};
        if (itemSchema.properties) {
          for (const [key, propSchema] of Object.entries(itemSchema.properties)) {
            item[key] = await extractPropertyFromElement(element, key, propSchema);
          }
        }
        items.push(item);
      } catch (error) {
        console.error('Error extracting item:', error);
      }
    }

    // If we found items, stop looking
    if (items.length > 0) break;
  }

  return items;
}

/**
 * Extract property from a specific element
 * @param {HTMLElement} element - HTML element
 * @param {string} key - Property key
 * @param {Object} propSchema - Property schema
 * @returns {any} Extracted value
 */
async function extractPropertyFromElement(element, key, propSchema) {
  const { type, selector } = propSchema;

  // Try selector within element
  if (selector) {
    const child = element.querySelector(selector);
    if (child) {
      return parseValue(child.textContent.trim(), type);
    }
  }

  // Try common selectors for this property
  const commonSelectors = getCommonSelectors(key);
  for (const sel of commonSelectors) {
    const child = element.querySelector(sel);
    if (child && child.textContent.trim()) {
      return parseValue(child.textContent.trim(), type);
    }
  }

  return null;
}

/**
 * Get common CSS selectors for property names
 * @param {string} key - Property name (e.g., "price", "title")
 * @returns {Array<string>} Common selectors
 */
function getCommonSelectors(key) {
  const keyLower = key.toLowerCase();

  const selectorMap = {
    title: [
      'h1',
      '.title',
      '.name',
      '.product-title',
      '[itemprop="name"]',
      '.heading',
    ],
    price: [
      '.price',
      '[itemprop="price"]',
      '.cost',
      '.amount',
      '.product-price',
      '[data-price]',
    ],
    description: [
      '.description',
      '[itemprop="description"]',
      '.details',
      '.product-description',
      'meta[name="description"]',
    ],
    image: [
      'img',
      '[itemprop="image"]',
      '.product-image img',
      '.main-image',
    ],
    rating: [
      '.rating',
      '[itemprop="ratingValue"]',
      '.stars',
      '.review-score',
    ],
    author: [
      '.author',
      '[itemprop="author"]',
      '[rel="author"]',
      '.byline',
    ],
    date: [
      'time',
      '.date',
      '[datetime]',
      '[itemprop="datePublished"]',
    ],
  };

  // Return specific selectors if found
  if (selectorMap[keyLower]) {
    return selectorMap[keyLower];
  }

  // Generic fallback selectors
  return [
    `.${keyLower}`,
    `[data-${keyLower}]`,
    `[itemprop="${keyLower}"]`,
    `[class*="${keyLower}"]`,
  ];
}

/**
 * Parse value to specified type
 * @param {string} value - Raw value
 * @param {string} type - Expected type (string, number, boolean)
 * @returns {any} Parsed value
 */
function parseValue(value, type) {
  if (!value) return null;

  switch (type) {
    case 'number':
      // Extract number from string (e.g., "$123.45" -> 123.45)
      const numberMatch = value.match(/[\d.,]+/);
      if (numberMatch) {
        return parseFloat(numberMatch[0].replace(/,/g, ''));
      }
      return null;

    case 'boolean':
      return value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';

    case 'string':
    default:
      return value.trim();
  }
}

/**
 * Extract structured data using AI-powered extraction (if available)
 * @param {string} html - HTML content
 * @param {Object} schema - JSON Schema
 * @param {string} instructions - Instructions
 * @returns {Object} Extracted data
 */
export async function extractWithAI(html, schema, instructions) {
  // This would integrate with AI services (DeepSeek, GPT, etc.)
  // For now, fall back to rule-based extraction
  console.warn('AI extraction not yet implemented, using rule-based extraction');
  return extractData(html, schema, instructions);
}

export default {
  extractData,
  extractWithAI,
};

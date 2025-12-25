/**
 * HTML to Markdown Converter
 *
 * Converts HTML content to clean, readable Markdown format
 * Removes ads, navigation, footers, and other non-content elements
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { JSDOM } from 'jsdom';

/**
 * Convert HTML to Markdown
 * @param {string} html - HTML content
 * @param {Object} options - Conversion options
 * @param {boolean} options.preserveImages - Include images in output
 * @param {boolean} options.preserveLinks - Include links in output
 * @param {boolean} options.cleanContent - Remove navigation, ads, footers
 * @returns {string} Markdown content
 */
export function htmlToMarkdown(html, options = {}) {
  const {
    preserveImages = true,
    preserveLinks = true,
    cleanContent = true,
  } = options;

  try {
    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Clean content if requested
    if (cleanContent) {
      removeNonContentElements(document);
    }

    // Extract main content
    const mainContent = extractMainContent(document);

    // Initialize Turndown service
    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use # for headings
      codeBlockStyle: 'fenced', // Use ``` for code blocks
      emDelimiter: '_', // Use _ for emphasis
      strongDelimiter: '**', // Use ** for strong
      linkStyle: 'inlined', // Use [text](url) for links
    });

    // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
    turndownService.use(gfm);

    // Custom rules for better formatting
    addCustomRules(turndownService, { preserveImages, preserveLinks });

    // Convert to Markdown
    const markdown = turndownService.turndown(mainContent || html);

    // Post-process Markdown
    return cleanMarkdown(markdown);
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    // Return plain text as fallback
    return extractPlainText(html);
  }
}

/**
 * Remove non-content elements (ads, navigation, footers)
 * @param {Document} document - JSDOM document
 */
function removeNonContentElements(document) {
  const selectorsToRemove = [
    // Navigation
    'nav',
    '[role="navigation"]',
    '.nav',
    '.navbar',
    '.navigation',
    '.menu',
    '.breadcrumb',

    // Headers/Footers
    'header',
    'footer',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.header',
    '.footer',
    '.site-header',
    '.site-footer',

    // Ads and promotional content
    '.ad',
    '.ads',
    '.advertisement',
    '.promo',
    '.promotion',
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[class*="advertisement"]',
    'aside',

    // Social media widgets
    '.social',
    '.share',
    '.sharing',
    '.social-share',

    // Comments
    '.comments',
    '.comment-section',
    '#comments',

    // Popups and modals
    '.modal',
    '.popup',
    '.overlay',

    // Related content (often clickbait)
    '.related',
    '.recommended',
    '.sidebar',
  ];

  selectorsToRemove.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
}

/**
 * Extract main content from document
 * @param {Document} document - JSDOM document
 * @returns {HTMLElement|null} Main content element
 */
function extractMainContent(document) {
  // Try common main content selectors
  const contentSelectors = [
    'main',
    '[role="main"]',
    'article',
    '.article',
    '.content',
    '.main-content',
    '.post',
    '.post-content',
    '.entry-content',
    '#content',
    '#main',
  ];

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 100) {
      return element;
    }
  }

  // Fallback: return body
  return document.body;
}

/**
 * Add custom Turndown rules
 * @param {TurndownService} service - Turndown service instance
 * @param {Object} options - Options
 */
function addCustomRules(service, options) {
  const { preserveImages, preserveLinks } = options;

  // Remove images if not preserving them
  if (!preserveImages) {
    service.addRule('removeImages', {
      filter: 'img',
      replacement: () => '',
    });
  }

  // Remove links if not preserving them
  if (!preserveLinks) {
    service.addRule('removeLinks', {
      filter: 'a',
      replacement: (content) => content,
    });
  }

  // Handle code blocks better
  service.addRule('codeBlock', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement: (content, node) => {
      const code = node.firstChild;
      const language = code.className.match(/language-(\w+)/)?.[1] || '';
      return `\n\`\`\`${language}\n${code.textContent}\n\`\`\`\n`;
    },
  });

  // Handle tables better
  service.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
}

/**
 * Clean Markdown output
 * @param {string} markdown - Raw Markdown
 * @returns {string} Cleaned Markdown
 */
function cleanMarkdown(markdown) {
  return markdown
    // Remove excessive newlines (more than 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace
    .trim()
    // Normalize list spacing
    .replace(/\n([*-]\s)/g, '\n$1')
    // Remove empty links
    .replace(/\[([^\]]+)\]\(\)/g, '$1')
    // Remove broken image tags
    .replace(/!\[\]\([^)]*\)/g, '');
}

/**
 * Extract plain text from HTML (fallback)
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function extractPlainText(html) {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    removeNonContentElements(document);
    const mainContent = extractMainContent(document);
    return (mainContent || document.body).textContent
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    // Ultimate fallback: strip HTML tags with regex
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export default htmlToMarkdown;

/**
 * Code highlighting utility using prism-code-editor's built-in Prism
 *
 * Rewritten from prismjs to prism-code-editor to fix production build errors
 * where prismjs modules in vendor-other executed before Prism core initialization.
 * prism-code-editor uses proper ESM imports, so Rollup orders them correctly.
 *
 * Usage in components:
 * ```js
 * import { loadPrismLanguage, highlightCode } from '@/utils/lazyLoadPrismJS'
 *
 * async function highlightMyCode() {
 *   const highlighted = await highlightCode(code, 'javascript')
 *   // Use highlighted HTML
 * }
 * ```
 */

import { logger } from './logger'
import { languages, highlightText } from 'prism-code-editor/prism'

let prismLoaded = false
const loadedLanguages = new Set()

// Language import map using prism-code-editor (ESM-compatible)
const languageImportMap = {
  markup: () => import('prism-code-editor/prism/languages/markup'),
  xml: () => import('prism-code-editor/prism/languages/xml'),
  javascript: () => import('prism-code-editor/prism/languages/javascript'),
  typescript: () => import('prism-code-editor/prism/languages/typescript'),
  python: () => import('prism-code-editor/prism/languages/python'),
  java: () => import('prism-code-editor/prism/languages/java'),
  json: () => import('prism-code-editor/prism/languages/json'),
  yaml: () => import('prism-code-editor/prism/languages/yaml'),
  css: () => import('prism-code-editor/prism/languages/css'),
  'css-extras': () => import('prism-code-editor/prism/languages/css-extras'),
  clike: () => import('prism-code-editor/prism/languages/clike'),
  c: () => import('prism-code-editor/prism/languages/c'),
  sql: () => import('prism-code-editor/prism/languages/sql'),
  bash: () => import('prism-code-editor/prism/languages/bash'),
  go: () => import('prism-code-editor/prism/languages/go'),
  rust: () => import('prism-code-editor/prism/languages/rust'),
  cpp: () => import('prism-code-editor/prism/languages/cpp'),
  csharp: () => import('prism-code-editor/prism/languages/csharp'),
  ruby: () => import('prism-code-editor/prism/languages/ruby'),
  swift: () => import('prism-code-editor/prism/languages/swift'),
  kotlin: () => import('prism-code-editor/prism/languages/kotlin'),
  r: () => import('prism-code-editor/prism/languages/r'),
  perl: () => import('prism-code-editor/prism/languages/perl'),
  lua: () => import('prism-code-editor/prism/languages/lua'),
  shell: () => import('prism-code-editor/prism/languages/bash'),
  sh: () => import('prism-code-editor/prism/languages/bash'),
  html: () => import('prism-code-editor/prism/languages/markup'),
  jsx: () => import('prism-code-editor/prism/languages/jsx'),
  tsx: () => import('prism-code-editor/prism/languages/tsx'),
  diff: () => import('prism-code-editor/prism/languages/diff'),
  graphql: () => import('prism-code-editor/prism/languages/graphql'),
  regex: () => import('prism-code-editor/prism/languages/regex'),
  ini: () => import('prism-code-editor/prism/languages/ini'),
  scss: () => import('prism-code-editor/prism/languages/scss'),
  less: () => import('prism-code-editor/prism/languages/less'),
  makefile: () => import('prism-code-editor/prism/languages/makefile'),
}

// Language dependencies
const languageDependencies = {
  c: ['clike'],
  cpp: ['c'],
  csharp: ['clike'],
  java: ['clike'],
  javascript: ['clike'],
  typescript: ['javascript'],
  jsx: ['markup', 'javascript'],
  tsx: ['jsx', 'typescript'],
  kotlin: ['clike'],
  json: ['clike'],
}

/**
 * Load Prism core (from prism-code-editor)
 * @returns {Promise<Object>} Prism-compatible module
 */
export async function loadPrism() {
  if (!prismLoaded) {
    // Track already registered languages
    for (const lang in languages) {
      if (typeof languages[lang] === 'object') {
        loadedLanguages.add(lang)
      }
    }
    prismLoaded = true
    logger.debug('Prism core ready, languages:', Object.keys(languages).length)
  }
  return { languages, highlight: highlightText }
}

/**
 * Load a specific language
 * @param {string} language - Language name
 * @returns {Promise<Object>} Prism-compatible module
 */
export async function loadPrismLanguage(language) {
  const lang = language.toLowerCase()
  const Prism = await loadPrism()

  if (loadedLanguages.has(lang) && languages[lang]) {
    return Prism
  }

  // Load dependencies first
  const deps = languageDependencies[lang] || []
  for (const dep of deps) {
    if (!loadedLanguages.has(dep) || !languages[dep]) {
      await loadPrismLanguage(dep)
    }
  }

  try {
    if (languageImportMap[lang]) {
      await languageImportMap[lang]()
      if (languages[lang]) {
        loadedLanguages.add(lang)
      }
      return Prism
    }
    logger.debug(`Language '${lang}' not available`)
    return Prism
  } catch (error) {
    logger.error(`Failed to load language '${lang}':`, error)
    return Prism
  }
}

/**
 * Highlight code
 * @param {string} code - Code to highlight
 * @param {string} language - Language name
 * @returns {Promise<string>} Highlighted HTML string
 */
export async function highlightCode(code, language = 'javascript') {
  if (!code || typeof code !== 'string') return ''

  try {
    const lang = language.toLowerCase()
    await loadPrismLanguage(lang)

    // Find grammar - try exact, then fallbacks
    const grammar = languages[lang] || languages.clike || languages.markup
    if (!grammar) {
      return escapeHtml(code)
    }

    const usedLang = languages[lang] ? lang : (languages.clike ? 'clike' : 'markup')
    return highlightText(code, usedLang)
  } catch (error) {
    logger.error('Failed to highlight code:', error)
    return escapeHtml(code)
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export async function highlightElement(element, language = 'javascript') {
  try {
    const code = element.textContent || element.innerText
    element.innerHTML = await highlightCode(code, language)
  } catch (error) {
    logger.error('Failed to highlight element:', error)
  }
}

export async function highlightAllInContainer(container) {
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]')
  await Promise.all(Array.from(codeBlocks).map(async (block) => {
    const cls = Array.from(block.classList).find(c => c.startsWith('language-'))
    await highlightElement(block, cls ? cls.replace('language-', '') : 'javascript')
  }))
}

export function isPrismLoaded() { return prismLoaded }
export function isLanguageLoaded(language) { return loadedLanguages.has(language.toLowerCase()) }
export function getSupportedLanguages() { return Object.keys(languageImportMap) }

export async function preloadCommonLanguages() {
  for (const lang of ['javascript', 'typescript', 'python', 'json', 'bash', 'css']) {
    try { await loadPrismLanguage(lang) } catch {}
  }
}

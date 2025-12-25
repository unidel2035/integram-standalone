/**
 * Utility for lazy loading PrismJS with dynamic language support
 *
 * Issue #4432: PrismJS (~100-200KB with all languages) is pre-bundled in vite.config.js,
 * increasing initial bundle size even though it's only needed for code editor pages.
 *
 * This utility ensures PrismJS is only loaded when actually needed,
 * with on-demand language loading for better performance.
 *
 * IMPORTANT: Uses import.meta.glob() for Vite compatibility in production.
 * Dynamic imports like `import(\`prismjs/components/prism-${lang}\`)` don't work
 * in production because Vite can't analyze them at build time.
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

let prismModule = null
// Don't pre-assume languages are loaded - verify at runtime
const loadedLanguages = new Set()

// Use import.meta.glob to create a map of all prism language modules at build time
// This allows Vite to analyze and bundle them correctly
const prismLanguageModules = import.meta.glob(
  '/node_modules/prismjs/components/prism-*.js',
  { eager: false }
)

// Alternative: direct mapping for common languages (more reliable)
const languageImportMap = {
  markup: () => import('prismjs/components/prism-markup'),
  javascript: () => import('prismjs/components/prism-javascript'),
  typescript: () => import('prismjs/components/prism-typescript'),
  python: () => import('prismjs/components/prism-python'),
  java: () => import('prismjs/components/prism-java'),
  json: () => import('prismjs/components/prism-json'),
  yaml: () => import('prismjs/components/prism-yaml'),
  markdown: () => import('prismjs/components/prism-markdown'),
  css: () => import('prismjs/components/prism-css'),
  clike: () => import('prismjs/components/prism-clike'),
  c: () => import('prismjs/components/prism-c'),
  sql: () => import('prismjs/components/prism-sql'),
  bash: () => import('prismjs/components/prism-bash'),
  go: () => import('prismjs/components/prism-go'),
  rust: () => import('prismjs/components/prism-rust'),
  cpp: () => import('prismjs/components/prism-cpp'),
  csharp: () => import('prismjs/components/prism-csharp'),
  php: () => import('prismjs/components/prism-php'),
  ruby: () => import('prismjs/components/prism-ruby'),
  swift: () => import('prismjs/components/prism-swift'),
  kotlin: () => import('prismjs/components/prism-kotlin'),
  scala: () => import('prismjs/components/prism-scala'),
  r: () => import('prismjs/components/prism-r'),
  perl: () => import('prismjs/components/prism-perl'),
  lua: () => import('prismjs/components/prism-lua'),
  shell: () => import('prismjs/components/prism-bash'), // alias
  sh: () => import('prismjs/components/prism-bash'), // alias
  html: () => import('prismjs/components/prism-markup'), // alias
  xml: () => import('prismjs/components/prism-markup'), // alias
  jsx: () => import('prismjs/components/prism-jsx'),
  tsx: () => import('prismjs/components/prism-tsx'),
  vue: () => import('prismjs/components/prism-markup'), // Vue uses markup
  diff: () => import('prismjs/components/prism-diff'),
  docker: () => import('prismjs/components/prism-docker'),
  nginx: () => import('prismjs/components/prism-nginx'),
  graphql: () => import('prismjs/components/prism-graphql'),
  regex: () => import('prismjs/components/prism-regex'),
  toml: () => import('prismjs/components/prism-toml'),
  ini: () => import('prismjs/components/prism-ini'),
}

// Language dependencies - some languages need others loaded first
const languageDependencies = {
  c: ['clike'],
  cpp: ['c'],
  csharp: ['clike'],
  java: ['clike'],
  javascript: ['clike'],
  typescript: ['javascript'],
  jsx: ['markup', 'javascript'],
  tsx: ['jsx', 'typescript'],
  php: ['markup', 'clike'],
  scala: ['java'],
  kotlin: ['clike'],
  markdown: ['markup'],
  json: ['clike'],
}

/**
 * Lazy load PrismJS core (singleton pattern - loads only once)
 * @returns {Promise<Object>} Prism module
 */
export async function loadPrism() {
  if (!prismModule) {
    logger.info('📦 Loading PrismJS core...')

    // Import prismjs core - the prism-core includes base functionality
    const module = await import('prismjs/prism.js')

    // prismjs sets itself on window.Prism
    prismModule = (typeof window !== 'undefined' && window.Prism)
      ? window.Prism
      : (module.default || module)

    // Ensure Prism is available globally for language components
    if (typeof window !== 'undefined') {
      window.Prism = prismModule
      // Initialize languages object if not present
      if (!window.Prism.languages) {
        window.Prism.languages = {}
      }
    }

    // Ensure local module has languages object
    if (!prismModule.languages) {
      prismModule.languages = window?.Prism?.languages || {}
    }

    // Track which core languages are actually loaded
    const availableLangs = Object.keys(prismModule.languages).filter(
      k => typeof prismModule.languages[k] === 'object'
    )
    availableLangs.forEach(lang => loadedLanguages.add(lang))
    logger.debug('📋 Core languages available:', availableLangs.join(', ') || 'none')
    logger.debug('📋 window.Prism.languages exists:', !!window?.Prism?.languages)

    logger.info('✅ PrismJS core loaded successfully')
  }
  return prismModule
}

/**
 * Lazy load a specific PrismJS language
 * @param {string} language - Language name (e.g., 'javascript', 'python', 'typescript')
 * @returns {Promise<Object>} Prism module with language loaded
 */
export async function loadPrismLanguage(language) {
  // Normalize language name
  const lang = language.toLowerCase()

  // Load core Prism first
  const Prism = await loadPrism()

  // Check if language is already loaded AND grammar actually exists
  if (loadedLanguages.has(lang) && Prism.languages?.[lang]) {
    logger.debug(`✅ PrismJS language '${lang}' already loaded`)
    return Prism
  }

  // Load dependencies first
  const deps = languageDependencies[lang] || []
  for (const dep of deps) {
    if (!loadedLanguages.has(dep) || !Prism.languages?.[dep]) {
      await loadPrismLanguage(dep)
    }
  }

  try {
    logger.debug(`📦 Loading PrismJS language: ${lang}`)

    // Ensure window.Prism and window.Prism.languages exist before importing components
    if (typeof window !== 'undefined') {
      if (!window.Prism) {
        window.Prism = Prism
      }
      if (!window.Prism.languages) {
        window.Prism.languages = Prism.languages || {}
      }
    }

    // Try explicit import map first (most reliable)
    if (languageImportMap[lang]) {
      try {
        await languageImportMap[lang]()
      } catch (importError) {
        logger.error(`❌ Import error for '${lang}':`, importError.message || importError)
        throw importError
      }

      // Verify grammar was registered (check both local and window.Prism)
      const grammar = Prism.languages?.[lang] || window?.Prism?.languages?.[lang]
      if (grammar) {
        // Sync to local Prism if loaded on window
        if (!Prism.languages[lang] && window?.Prism?.languages?.[lang]) {
          Prism.languages[lang] = window.Prism.languages[lang]
        }
        loadedLanguages.add(lang)
        logger.debug(`✅ PrismJS language '${lang}' loaded`)
      } else {
        logger.warn(`⚠️ PrismJS language '${lang}' import succeeded but grammar not registered`)
      }
      return Prism
    }

    // Fallback: try glob pattern
    const globKey = `/node_modules/prismjs/components/prism-${lang}.js`
    if (prismLanguageModules[globKey]) {
      await prismLanguageModules[globKey]()

      const grammar = Prism.languages?.[lang] || window?.Prism?.languages?.[lang]
      if (grammar) {
        if (!Prism.languages[lang] && window?.Prism?.languages?.[lang]) {
          Prism.languages[lang] = window.Prism.languages[lang]
        }
        loadedLanguages.add(lang)
        logger.debug(`✅ PrismJS language '${lang}' loaded via glob`)
      }
      return Prism
    }

    // Language not found - use fallback
    logger.warn(`⚠️ PrismJS language '${lang}' not available, using fallback`)
    return Prism

  } catch (error) {
    logger.error(`❌ Failed to load PrismJS language '${lang}':`, error)

    // Return Prism anyway - will use 'clike' or plain text
    return Prism
  }
}

/**
 * Highlight code with PrismJS
 * @param {string} code - Code to highlight
 * @param {string} language - Language name
 * @returns {Promise<string>} Highlighted HTML string
 */
export async function highlightCode(code, language = 'javascript') {
  // Handle empty or null input
  if (!code || typeof code !== 'string') {
    return ''
  }

  try {
    const lang = language.toLowerCase()
    const Prism = await loadPrismLanguage(lang)

    // Debug: log available languages
    const availableLangs = Prism.languages ? Object.keys(Prism.languages).filter(k => typeof Prism.languages[k] === 'object') : []
    logger.debug(`🔍 Highlighting '${lang}', available grammars: ${availableLangs.slice(0, 10).join(', ')}...`)

    // Check if language grammar exists - try multiple fallbacks
    let grammar = null
    let usedLang = lang

    if (Prism.languages && Prism.languages[lang]) {
      grammar = Prism.languages[lang]
    } else if (Prism.languages && Prism.languages.clike) {
      grammar = Prism.languages.clike
      usedLang = 'clike'
      logger.debug(`⚠️ Grammar '${lang}' not found, using 'clike' fallback`)
    } else if (Prism.languages && Prism.languages.markup) {
      grammar = Prism.languages.markup
      usedLang = 'markup'
      logger.debug(`⚠️ Grammar '${lang}' not found, using 'markup' fallback`)
    }

    if (!grammar) {
      logger.warn(`⚠️ No grammar found for '${language}', returning plain text`)
      return escapeHtml(code)
    }

    // Highlight the code
    const highlighted = Prism.highlight(code, grammar, usedLang)
    logger.debug(`✅ Code highlighted successfully (${code.length} chars, lang: ${usedLang})`)
    return highlighted
  } catch (error) {
    logger.error('❌ Failed to highlight code:', error)
    // Return escaped code as fallback
    return escapeHtml(code)
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Highlight code element in DOM
 * @param {HTMLElement} element - Element containing code
 * @param {string} language - Language name
 * @returns {Promise<void>}
 */
export async function highlightElement(element, language = 'javascript') {
  try {
    const code = element.textContent || element.innerText
    const highlighted = await highlightCode(code, language)
    element.innerHTML = highlighted
  } catch (error) {
    logger.error('❌ Failed to highlight element:', error)
  }
}

/**
 * Highlight all code blocks in a container
 * @param {HTMLElement} container - Container element
 * @returns {Promise<void>}
 */
export async function highlightAllInContainer(container) {
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]')

  const highlightPromises = Array.from(codeBlocks).map(async (block) => {
    // Extract language from class name (e.g., 'language-javascript')
    const languageClass = Array.from(block.classList).find(cls => cls.startsWith('language-'))
    const language = languageClass ? languageClass.replace('language-', '') : 'javascript'

    await highlightElement(block, language)
  })

  await Promise.all(highlightPromises)
}

/**
 * Check if PrismJS is loaded
 * @returns {boolean} True if PrismJS core is loaded
 */
export function isPrismLoaded() {
  return prismModule !== null
}

/**
 * Check if a language is loaded
 * @param {string} language - Language name
 * @returns {boolean} True if language is loaded
 */
export function isLanguageLoaded(language) {
  return loadedLanguages.has(language.toLowerCase())
}

/**
 * Get list of supported languages
 * @returns {string[]} Array of supported language names
 */
export function getSupportedLanguages() {
  return Object.keys(languageImportMap)
}

/**
 * Preload common languages in the background (for optimization)
 * This can be called during idle time to prefetch common languages
 * without blocking the main thread.
 *
 * Usage:
 * ```js
 * requestIdleCallback(() => {
 *   preloadCommonLanguages()
 * })
 * ```
 */
export async function preloadCommonLanguages() {
  const commonLanguages = [
    'javascript',
    'typescript',
    'python',
    'json',
    'markdown',
    'bash',
    'css'
  ]

  logger.debug('🔄 Preloading common PrismJS languages...')

  for (const lang of commonLanguages) {
    try {
      await loadPrismLanguage(lang)
    } catch (error) {
      // Silently fail for preload - not critical
      logger.debug(`Skipped preload of '${lang}':`, error.message)
    }
  }

  logger.debug('✅ Common PrismJS languages preloaded')
}

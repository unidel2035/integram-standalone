/**
 * Smart Paste Handler for Block Editor
 * Issue #6845: Clean paste from clipboard, detect content types, and format appropriately
 *
 * Features:
 * - HTML cleaning (strip external styles, use only editor styles)
 * - Markdown detection and conversion
 * - Table detection (Excel, CSV, HTML)
 * - Image upload to Integram server
 * - Link detection and iframe embedding (YouTube, websites)
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * Detect if clipboard contains Excel/CSV data
 */
function detectSpreadsheetData(clipboardData) {
  const types = clipboardData.types || []

  // Excel specific MIME types — always treat as spreadsheet
  if (
    types.includes('application/vnd.ms-excel') ||
    types.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ) {
    return true
  }

  // Only detect tab-separated values (CSV detection removed — too many false positives
  // from normal text with commas in sentences).
  const text = clipboardData.getData('text/plain')
  if (!text) return false

  const lines = text.trim().split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return false

  // Count lines that have actual tab characters
  const tabLines = lines.filter((line) => line.includes('\t'))
  // Need at least 2 tab-containing lines to be a real table
  if (tabLines.length < 2) return false

  // All tab-lines must have a consistent column count (±1) — real tabular data
  const colCounts = tabLines.map((l) => l.split('\t').length)
  const minCols = Math.min(...colCounts)
  const maxCols = Math.max(...colCounts)
  // Must have ≥2 columns and consistent structure
  if (minCols < 2 || maxCols - minCols > 1) return false

  // At least 50% of non-empty lines must be tab-separated
  return tabLines.length / lines.length > 0.5
}

/**
 * Parse CSV/TSV text into table structure
 */
function parseSpreadsheetText(text) {
  const lines = text.trim().split('\n')
  const delimiter = text.includes('\t') ? '\t' : ','

  return lines.map((line) => {
    // Simple CSV parsing (doesn't handle quoted values with delimiters)
    return line.split(delimiter).map((cell) => cell.trim())
  })
}

/**
 * Convert table data to HTML table
 */
function tableToHtml(rows) {
  if (!rows || rows.length === 0) return ''

  let html = '<table><thead><tr>'

  // First row as header
  rows[0].forEach((cell) => {
    html += `<th>${DOMPurify.sanitize(cell)}</th>`
  })
  html += '</tr></thead><tbody>'

  // Remaining rows as body
  for (let i = 1; i < rows.length; i++) {
    html += '<tr>'
    rows[i].forEach((cell) => {
      html += `<td>${DOMPurify.sanitize(cell)}</td>`
    })
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

/**
 * Extract 2D array of strings from a <table> DOM element.
 * Returns null if fewer than 2 rows.
 */
function extractTableData(tableEl) {
  const rows = []
  tableEl.querySelectorAll('tr').forEach((tr) => {
    const cells = []
    tr.querySelectorAll('th, td').forEach((cell) => {
      cells.push(cell.textContent.trim())
    })
    if (cells.length > 0) rows.push(cells)
  })

  // Normalise to uniform column count
  if (rows.length === 0) return null
  const maxCols = Math.max(...rows.map((r) => r.length))
  rows.forEach((r) => {
    while (r.length < maxCols) r.push('')
  })

  return rows.length >= 2 ? rows : null
}

/**
 * Parse an HTML string that contains a <table> into a 2D array of strings.
 * Returns null if no table found or table has fewer than 2 rows.
 */
function parseHtmlTable(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html
  const table = temp.querySelector('table')
  if (!table) return null
  return extractTableData(table)
}

/**
 * Known embed blot class names → blotName mapping.
 * Used to detect and preserve Quill BlockEmbed blots during paste.
 */
const BLOT_CLASS_MAP = {
  'coda-simple-table-embed': 'simple-table',
  'whiteboard-block-embed': 'whiteboard',
  'callout-block-wrapper': 'callout',
  'mermaid-block-embed': 'mermaid',
  'map-block-embed': 'map',
  'domain-block-embed': 'domain-block',
  'spoiler-embed': 'spoiler',
  'integram-report-embed': 'integram-report',
  'integram-calendar-embed': 'integram-calendar',
  'video-embed': 'video-embed',
  'timeline-embed': 'timeline-embed',
}

/**
 * Returns true if the element is a known Quill embed blot (by class name).
 */
function isKnownBlot(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false
  for (const cls of Object.keys(BLOT_CLASS_MAP)) {
    if (el.classList && el.classList.contains(cls)) return true
  }
  return false
}

/**
 * Returns true if the HTML string contains any known embed blot class.
 * Used for fast pre-check before parsing the DOM.
 */
function hasEmbedBlot(html) {
  if (!html) return false
  return Object.keys(BLOT_CLASS_MAP).some((cls) => html.includes(cls))
}

/**
 * Returns all text content that lies OUTSIDE any <table> elements or embed blots
 * in the HTML. Used to determine if the clipboard has mixed text+table content.
 * Blot divs are removed so their UI chrome doesn't count as "text outside table".
 */
function getTextOutsideTable(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html
  const body = temp.querySelector('body') || temp
  body.querySelectorAll('table').forEach((t) => t.remove())
  // Remove known blot elements by class name
  const blotSelector = Object.keys(BLOT_CLASS_MAP).map((cls) => `.${cls}`).join(', ')
  body.querySelectorAll(blotSelector).forEach((el) => el.remove())
  // Also remove any remaining contenteditable=false elements (unknown blots)
  body.querySelectorAll('[contenteditable="false"]').forEach((el) => el.remove())
  return body.textContent.trim()
}

/**
 * Split HTML into ordered segments of {type:'html'|'table', html?, tableData?}.
 * Walks top-level nodes; when a <table> is encountered it becomes a 'table' segment,
 * everything else is accumulated into 'html' segments.
 * Elements that contain a nested <table> are recursed into so the surrounding
 * markup is not silently dropped.
 */
function splitHtmlIntoSegments(html) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  // Unwrap <html>/<body> if present (common in clipboard HTML)
  const body = wrapper.querySelector('body') || wrapper

  const segments = []
  let htmlBuffer = []

  function flushBuffer() {
    if (htmlBuffer.length === 0) return
    const joined = htmlBuffer.join('')
    const probe = document.createElement('div')
    probe.innerHTML = joined
    if (!probe.textContent.trim()) { htmlBuffer = []; return }

    // Skip cleanHtml for already-clean HTML (e.g. intra-editor copy) —
    // running it would mangle Quill's semantic markup.
    if (isCleanHtml(joined)) {
      segments.push({ type: 'html', html: joined })
      htmlBuffer = []
      return
    }

    const cleaned = cleanHtml(joined)
    // Double-check that cleanHtml didn't strip all content
    const cleanedProbe = document.createElement('div')
    cleanedProbe.innerHTML = cleaned
    if (cleanedProbe.textContent.trim()) {
      segments.push({ type: 'html', html: cleaned })
    }
    htmlBuffer = []
  }

  function walkChildren(parent) {
    for (const child of Array.from(parent.childNodes)) {
      // Skip comment nodes (<!--StartFragment-->, <!--EndFragment--> OS clipboard markers)
      if (child.nodeType === Node.COMMENT_NODE) continue
      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'TABLE') {
        // Direct <table> element
        flushBuffer()
        const tableData = extractTableData(child)
        if (tableData && tableData.length >= 2) {
          segments.push({ type: 'table', tableData })
        }
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        isKnownBlot(child)
      ) {
        // Known Quill embed blot — recognized by class name.
        // Never recurse — that would pollute htmlBuffer with UI chrome.
        flushBuffer()
        const dataValueStr = child.getAttribute && child.getAttribute('data-value')
        // Find the blotName by matching the element's classes to BLOT_CLASS_MAP
        let blotName = null
        for (const [cls, name] of Object.entries(BLOT_CLASS_MAP)) {
          if (child.classList && child.classList.contains(cls)) { blotName = name; break }
        }
        let pushed = false
        if (dataValueStr && blotName) {
          try {
            segments.push({ type: 'blot', blotName, value: JSON.parse(dataValueStr) })
            pushed = true
          } catch {
            // data-value is malformed; fall through to table extraction
          }
        }
        if (!pushed) {
          // No data-value or parse failed: try to extract a native <table> if present (last resort)
          const tableEl = child.querySelector && child.querySelector('table')
          if (tableEl) {
            const tableData = extractTableData(tableEl)
            if (tableData && tableData.length >= 2) {
              segments.push({ type: 'table', tableData })
            }
          }
        }
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        child.getAttribute &&
        child.getAttribute('contenteditable') === 'false'
      ) {
        // Unknown contenteditable=false element (not in BLOT_CLASS_MAP).
        // Try to extract a native <table> if present; otherwise skip.
        flushBuffer()
        const tableEl = child.querySelector && child.querySelector('table')
        if (tableEl) {
          const tableData = extractTableData(tableEl)
          if (tableData && tableData.length >= 2) {
            segments.push({ type: 'table', tableData })
          }
        }
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        child.querySelector &&
        child.querySelector('table')
      ) {
        // Generic wrapper containing a table — recurse to preserve sibling text
        walkChildren(child)
      } else {
        htmlBuffer.push(child.outerHTML || child.textContent || '')
      }
    }
  }

  walkChildren(body)
  flushBuffer()

  return segments
}

/**
 * Detect if text is Markdown
 */
function detectMarkdown(text) {
  if (!text) return false

  // Check for common Markdown patterns
  const mdPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\*\*.*?\*\*/m, // Bold
    /\*.*?\*/m, // Italic
    /^\s*[-*+]\s+/m, // Unordered lists
    /^\s*\d+\.\s+/m, // Ordered lists
    /\[.*?\]\(.*?\)/m, // Links
    /!\[.*?\]\(.*?\)/m, // Images
    /```[\s\S]*?```/m, // Code blocks
    /`.*?`/m, // Inline code
    /^\s*>\s+/m // Blockquotes
  ]

  return mdPatterns.some((pattern) => pattern.test(text))
}

/**
 * Convert Markdown to HTML
 */
function markdownToHtml(markdown) {
  // marked v15: use options in parse() call, not deprecated setOptions()
  const html = marked.parse(markdown, {
    gfm: true, // GitHub Flavored Markdown
    breaks: true // Convert \n to <br>
  })
  return html
}

/**
 * Returns true if HTML is already clean (no external CSS/font markup).
 * Used to skip cleanHtml() for intra-editor copy-paste — Quill generates
 * semantic HTML with no inline styles; running cleanHtml() on it would
 * mangle formatting (e.g. promoteHeadings turning <strong> into <h2>).
 */
function isCleanHtml(html) {
  return !/style\s*=|<font[\s>]|mso-|font-family:|background-color:/i.test(html)
}

/**
 * Returns true if the HTML clipboard contains real semantic formatting
 * (copied from a rich editor). When true, Markdown path must be skipped
 * even if plain text incidentally matches ** or ## patterns.
 */
function hasSemanticFormatting(html) {
  if (!html) return false
  return (
    /<(strong|em|b(?!\w)|i(?!\w)|u(?!\w)|h[1-6]|ul|ol|blockquote|pre|code)\b/i.test(html) ||
    /data-list=/i.test(html)
  )
}

/**
 * Decide whether to use plain-text Markdown conversion instead of the HTML
 * clipboard content. Returns true when:
 *  1. No HTML at all — plain text is all we have.
 *  2. HTML has NO semantic formatting AND its text content contains literal
 *     ** / ## Markdown markers (source didn't render them, just copied raw text).
 * Returns false when HTML already has <strong>, <h2>, data-list, etc. —
 * that means it came from our editor or another rich editor and must be preserved.
 */
function shouldUsePlaintextMarkdown(html, plainText) {
  if (!html) return true
  if (hasSemanticFormatting(html)) return false
  // If HTML contains Quill embed blots, use HTML path to preserve them
  if (/contenteditable="false"/i.test(html)) return false
  // HTML is a plain wrapper — check if it literally contains ** or ## markers
  const temp = document.createElement('div')
  temp.innerHTML = html
  return /\*\*[^*\n]+\*\*|^#{1,6}\s+\S/m.test(temp.textContent)
}

/**
 * Before stripping attributes, convert CSS-based styling on <span>/<font>
 * elements to semantic HTML tags. This preserves bold/italic from sources
 * like Word and Google Docs that use inline CSS instead of <strong>/<em>.
 * Mutates the DOM in place.
 */
function semanticifyStyles(root) {
  root.querySelectorAll('span[style], font[style]').forEach((el) => {
    const s = el.style
    const bold = s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 600
    const italic = s.fontStyle === 'italic'
    const underline = s.textDecoration && s.textDecoration.includes('underline')

    if (!bold && !italic && !underline) return

    // Build nested wrappers: underline → em → strong (innermost first)
    let inner = el.innerHTML
    if (underline) inner = `<u>${inner}</u>`
    if (italic)    inner = `<em>${inner}</em>`
    if (bold)      inner = `<strong>${inner}</strong>`

    const frag = document.createRange().createContextualFragment(inner)
    el.parentNode.insertBefore(frag, el)
    el.parentNode.removeChild(el)
  })
}

/**
 * Clean HTML: strip external styles, keep only semantic structure
 */
function cleanHtml(html) {
  // Configure DOMPurify
  const config = {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'strike',
      'del',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'sup',
      'sub',
      'span',
      'div',
      'iframe'
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'data-*',
      'frameborder',
      'allowfullscreen',
      'allow'
    ],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false
  }

  let cleaned = DOMPurify.sanitize(html, config)

  const temp = document.createElement('div')
  temp.innerHTML = cleaned

  // Pass 0: convert CSS-based bold/italic/underline to semantic tags BEFORE
  // stripping style attributes, so formatting from Word/Google Docs is preserved.
  semanticifyStyles(temp)

  // Pass 1: strip all presentation attributes from every element
  temp.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
    el.removeAttribute('id')
    el.removeAttribute('color')   // legacy <td color="...">
    el.removeAttribute('bgcolor')
    el.removeAttribute('face')    // legacy <font face="...">
    el.removeAttribute('size')    // legacy <font size="...">
  })

  // Pass 2: replace <font> tags with plain <span> (content kept)
  temp.querySelectorAll('font').forEach((font) => {
    const span = document.createElement('span')
    span.innerHTML = font.innerHTML
    font.parentNode.replaceChild(span, font)
  })

  // Pass 3: unwrap <span> elements — they carry no semantic meaning
  // without style/class; keeping them lets Quill's clipboard matchers
  // sometimes re-attach font properties.
  temp.querySelectorAll('span').forEach((span) => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
  })

  // Pass 4: convert block-level <div> to <p> so Quill treats them as paragraphs
  temp.querySelectorAll('div').forEach((div) => {
    // Only if the div doesn't contain block children (to avoid double-wrap)
    const hasBlockChild = Array.from(div.children).some((c) =>
      ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE'].includes(c.tagName)
    )
    if (!hasBlockChild) {
      const p = document.createElement('p')
      p.innerHTML = div.innerHTML
      div.parentNode.replaceChild(p, div)
    }
  })

  // Pass 5: remove empty paragraphs and divs
  temp.querySelectorAll('p, div').forEach((el) => {
    if (!el.textContent.trim() && el.children.length === 0) el.remove()
  })

  // NOTE: promoteHeadings() removed — it was converting <p><strong>text</strong></p>
  // to <h2> which mangled intra-editor copy-paste of bold paragraphs.

  return temp.innerHTML
}

/**
 * Promote paragraphs that contain only bold text to headings.
 * Also handles literal **text** markdown in text nodes.
 * Mutates the DOM element in place.
 */
function promoteHeadings(root) {
  // 1. Paragraphs / divs where the only non-empty content is a <strong> or <b>
  root.querySelectorAll('p, div').forEach((el) => {
    const text = el.textContent.trim()
    if (!text || text.length < 5) return

    const nonEmptyChildren = Array.from(el.childNodes).filter(
      (n) => n.textContent.trim().length > 0
    )
    if (nonEmptyChildren.length === 1) {
      const child = nonEmptyChildren[0]
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child.tagName === 'STRONG' || child.tagName === 'B') &&
        child.textContent.trim().length > 5
      ) {
        const h2 = document.createElement('h2')
        h2.textContent = child.textContent.trim()
        el.parentNode.replaceChild(h2, el)
      }
    }
  })

  // 2. Text nodes with literal **heading** pattern (markdown asterisks in HTML)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false)
  const textNodes = []
  let node
  while ((node = walker.nextNode())) textNodes.push(node)

  textNodes.forEach((textNode) => {
    const text = textNode.textContent
    // Match **entire text of a paragraph**
    const match = text.match(/^\s*\*\*(.+?)\*\*\s*$/)
    if (match && match[1].length > 5) {
      const parent = textNode.parentNode
      const isBlock = parent && ['P', 'DIV', 'LI'].includes(parent.tagName)
      if (isBlock) {
        const h2 = document.createElement('h2')
        h2.textContent = match[1]
        parent.parentNode.replaceChild(h2, parent)
      } else {
        // Inline: replace **text** with <strong>text</strong>
        const strong = document.createElement('strong')
        strong.textContent = match[1]
        textNode.parentNode.replaceChild(strong, textNode)
      }
    }
  })
}

/**
 * Detect YouTube URL and convert to embed iframe
 */
function detectYouTubeUrl(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1] // Video ID
    }
  }

  return null
}

/**
 * Create YouTube embed HTML
 */
function createYouTubeEmbed(videoId) {
  return `<div class="video-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1em 0;">
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
    </iframe>
  </div>`
}

/**
 * Detect if URL should be embedded as iframe
 */
function shouldEmbedAsIframe(url) {
  // List of domains that support iframe embedding
  const embedDomains = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'codepen.io',
    'jsfiddle.net',
    'codesandbox.io',
    'figma.com',
    'miro.com',
    'notion.so',
    'airtable.com',
    'google.com/maps'
  ]

  try {
    const urlObj = new URL(url)
    return embedDomains.some((domain) => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * Create generic iframe embed
 */
function createIframeEmbed(url) {
  return `<div class="iframe-embed" style="position: relative; padding-bottom: 75%; height: 0; overflow: hidden; max-width: 100%; margin: 1em 0; border: 1px solid #ddd;">
    <iframe
      src="${url}"
      frameborder="0"
      allowfullscreen
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
    </iframe>
  </div>`
}

/**
 * Process URLs in text and convert to embeds where appropriate
 */
function processUrls(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Find all links
  const links = temp.querySelectorAll('a[href]')

  links.forEach((link) => {
    const url = link.getAttribute('href')

    // Check for YouTube
    const youtubeId = detectYouTubeUrl(url)
    if (youtubeId) {
      const embed = createYouTubeEmbed(youtubeId)
      const embedDiv = document.createElement('div')
      embedDiv.innerHTML = embed
      link.parentNode.replaceChild(embedDiv.firstChild, link)
      return
    }

    // Check for other embeddable URLs
    if (shouldEmbedAsIframe(url)) {
      const embed = createIframeEmbed(url)
      const embedDiv = document.createElement('div')
      embedDiv.innerHTML = embed
      link.parentNode.replaceChild(embedDiv.firstChild, link)
    }
  })

  // Also check for plain URLs in text nodes
  const textNodes = []
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null, false)
  let node
  while ((node = walker.nextNode())) {
    textNodes.push(node)
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent
    const urlPattern = /(https?:\/\/[^\s]+)/g
    const urls = text.match(urlPattern)

    if (urls && urls.length > 0) {
      let newHtml = text

      urls.forEach((url) => {
        const youtubeId = detectYouTubeUrl(url)
        if (youtubeId) {
          newHtml = newHtml.replace(url, createYouTubeEmbed(youtubeId))
        } else if (shouldEmbedAsIframe(url)) {
          newHtml = newHtml.replace(url, createIframeEmbed(url))
        } else {
          newHtml = newHtml.replace(url, `<a href="${url}" target="_blank">${url}</a>`)
        }
      })

      const wrapper = document.createElement('div')
      wrapper.innerHTML = newHtml
      textNode.parentNode.replaceChild(wrapper, textNode)
    }
  })

  return temp.innerHTML
}

/**
 * Загрузка изображения в таблицу "Файлы документов" (Integram FILE storage)
 * Создаёт запись в таблице файлов, загружает файл в FILE-реквизит,
 * читает объект обратно для получения URL скачивания.
 *
 * @param {File|Blob} file - Файл изображения
 * @param {Object} integramClient - Integram API client
 * @param {string} database - Имя БД (напр. 'kval')
 * @param {Object} filesConfig - Конфиг таблицы файлов из editorSchema
 *   { typeId, requisites: { 'Файл': reqId, 'Тип файла': reqId, 'Размер': reqId, 'Документ': reqId, ... } }
 * @param {number|null} documentId - ID документа для привязки
 * @returns {Promise<string>} URL для скачивания файла
 */
export async function uploadImageToFileStorage(file, integramClient, database, filesConfig, documentId = null) {
  const { typeId, requisites } = filesConfig
  const fileName = file.name || `image_${Date.now()}.png`

  // 1. Собираем реквизиты для создания записи
  const reqs = {}
  if (requisites['Тип файла']) {
    reqs[requisites['Тип файла']] = file.type || 'image/png'
  }
  if (requisites['Размер']) {
    reqs[requisites['Размер']] = String(file.size || 0)
  }
  if (documentId && requisites['Документ']) {
    reqs[requisites['Документ']] = String(documentId)
  }

  // 2. Создаём объект в таблице файлов
  const createResult = await integramClient.createObject(typeId, fileName, reqs)
  const objectId = createResult.obj || createResult.id
  if (!objectId) {
    throw new Error('Не удалось создать запись в таблице файлов')
  }

  // 3. Загружаем файл в FILE-реквизит
  const fileReqId = requisites['Файл']
  if (!fileReqId) {
    throw new Error('Не найден реквизит "Файл" в таблице файлов')
  }
  await integramClient.uploadRequisiteFile(objectId, fileReqId, file)

  // 4. Читаем объект обратно для получения URL скачивания
  const editData = await integramClient.getObjectEditData(objectId)

  // Извлекаем значение FILE-реквизита (может быть в разных форматах)
  let fileValue = ''
  if (editData?.reqs) {
    if (Array.isArray(editData.reqs)) {
      // Массив реквизитов: [{ id, val, ... }]
      const fileReq = editData.reqs.find(r => String(r.id) === String(fileReqId))
      fileValue = fileReq?.val || fileReq?.value || ''
    } else if (typeof editData.reqs === 'object') {
      // Объект: { reqId: { value: ... } } или { reqId: "value" }
      const rv = editData.reqs[fileReqId]
      fileValue = typeof rv === 'object' ? (rv?.value || rv?.val || '') : (rv || '')
    }
  }
  // Также проверяем плоский формат t{reqId}
  if (!fileValue && editData?.[`t${fileReqId}`]) {
    fileValue = editData[`t${fileReqId}`]
  }

  // FILE-реквизит возвращает HTML: <a href="download/kval/ab/abc123.png">filename</a>
  const hrefMatch = String(fileValue).match(/href="([^"]+)"/)
  if (hrefMatch) {
    const serverUrl = (integramClient.serverUrl || integramClient.serverURL || 'api.ai2o.ru').replace(/^https?:\/\//, '')
    const protocol = serverUrl.startsWith('localhost') ? 'http://' : 'https://'
    const path = hrefMatch[1].startsWith('/') ? hrefMatch[1] : `/${database}/${hrefMatch[1]}`
    return `${protocol}${serverUrl}${path}`
  }

  // Fallback: если не удалось получить URL из FILE-поля, возвращаем dir_admin URL
  console.warn('[SmartPaste] Не удалось получить URL из FILE-реквизита, используем dir_admin fallback')
  const serverUrl = (integramClient.serverUrl || integramClient.serverURL || 'api.ai2o.ru').replace(/^https?:\/\//, '')
  const protocol = serverUrl.startsWith('localhost') ? 'http://' : 'https://'
  return `${protocol}${serverUrl}/${database}/dir_admin/?download=1&file=${encodeURIComponent(fileName)}`
}

/**
 * Upload image to Integram server via dir_admin
 * @param {File|Blob} file - Image file
 * @param {Object} integramClient - Integram API client instance
 * @param {string} database - Database name
 * @param {Object|null} filesConfig - Deprecated, ignored (kept for backward compat)
 * @param {number|null} documentId - Deprecated, ignored (kept for backward compat)
 * @returns {Promise<string>} URL to uploaded image
 */
export async function uploadImageToIntegram(file, integramClient, database, filesConfig = null, documentId = null) {
  try {
    const result = await integramClient.uploadFile(file, '')

    // URL: https://api.ai2o.ru/{database}/dir_admin/?download=1&file={filename}
    const serverUrl = (integramClient.serverUrl || integramClient.serverURL || 'api.ai2o.ru').replace(/^https?:\/\//, '')
    const protocol = serverUrl.startsWith('localhost') ? 'http://' : 'https://'
    const fileName = result.filename || file.name

    return `${protocol}${serverUrl}/${database}/dir_admin/?download=1&file=${encodeURIComponent(fileName)}`
  } catch (error) {
    console.error('[SmartPaste] Image upload failed:', error)
    throw new Error('Не удалось загрузить файл в Integram')
  }
}

/**
 * Process images in clipboard
 * @param {DataTransfer} clipboardData
 * @param {Object} integramClient
 * @param {string} database
 */
export async function processClipboardImages(clipboardData, integramClient, database) {
  const items = clipboardData.items || []
  const imagePromises = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (item.type.indexOf('image') !== -1) {
      const blob = item.getAsFile()
      if (blob) {
        imagePromises.push(
          uploadImageToIntegram(blob, integramClient, database).then((url) => ({
            type: 'image',
            url,
            alt: 'Pasted image'
          }))
        )
      }
    }
  }

  return Promise.all(imagePromises)
}

/**
 * Main smart paste handler
 * @param {ClipboardEvent} event - Paste event
 * @param {Object} integramClient - Integram API client instance
 * @param {string} database - Current database
 * @returns {Promise<Object>} Processed content with type and html
 */
export async function handleSmartPaste(event, integramClient, database) {
  const clipboardData = event.clipboardData || window.clipboardData

  if (!clipboardData) {
    return null
  }

  // Read clipboard data synchronously before any await
  const html = clipboardData.getData('text/html')
  const plainText = clipboardData.getData('text/plain')

  // Pre-detect table data: TSV/CSV in plain text OR <table> in HTML OR embed blot
  const hasSpreadsheet = detectSpreadsheetData(clipboardData)
  const htmlTableData = html ? parseHtmlTable(html) : null
  const hasBlotEmbed = hasEmbedBlot(html)
  const hasTableData = hasSpreadsheet || (htmlTableData && htmlTableData.length >= 2) || hasBlotEmbed

  // 1. Images — ONLY if clipboard contains no table/blot data.
  //    Excel/Sheets copy cells as both image + table data; prefer table.
  if (!hasTableData) {
    const images = await processClipboardImages(clipboardData, integramClient, database)
    if (images.length > 0) {
      const imageHtml = images.map((img) => `<img src="${img.url}" alt="${img.alt}" />`).join('')
      return {
        type: 'images',
        html: imageHtml,
        count: images.length
      }
    }
  }

  // 2. HTML with <table> OR embed blots (e.g. SimpleTableBlot placeholder).
  //    Checked BEFORE TSV so surrounding text is never lost.
  //    hasBlotEmbed covers the case where the blot has no <table> yet (placeholder state).
  if ((htmlTableData && htmlTableData.length >= 2) || hasBlotEmbed) {
    const textOutside = getTextOutsideTable(html)
    // Any non-empty text outside the table/blot = mixed content.
    const hasMixedContent = textOutside.length > 0

    if (hasMixedContent || hasBlotEmbed) {
      // Try to split into text/table/blot segments for ideal formatting
      const segments = splitHtmlIntoSegments(html)
      const hasHtmlSegments = segments.some((s) => s.type === 'html')
      const hasTableSegments = segments.some((s) => s.type === 'table' || s.type === 'blot')

      // If we got both html and table/blot segments, return mixed
      if (hasHtmlSegments && hasTableSegments) {
        return { type: 'mixed', segments }
      }

      // Only table/blot segments (text was stripped by cleanHtml or was empty)
      if (hasTableSegments && !hasHtmlSegments) {
        return { type: 'mixed', segments }
      }

      // Only html segments (table detection failed): return as mixed to preserve
      if (hasHtmlSegments && !hasTableSegments) {
        return { type: 'mixed', segments }
      }

      // No segments at all — fall back to full HTML insertion
      if (html) return { type: 'html', html: processUrls(cleanHtml(html)) }
    }

    // Pure table (no text outside, no blot embed) — but only if we have actual table data
    if (htmlTableData && htmlTableData.length >= 2) {
      return {
        type: 'table',
        html: tableToHtml(htmlTableData),
        tableData: htmlTableData,
        rows: htmlTableData.length,
        cols: htmlTableData[0]?.length || 0
      }
    }
  }

  // 3. TSV in plain text (only when no rich HTML table found above)
  //    Split into text/table segments if there are non-tab lines mixed in.
  if (hasSpreadsheet) {
    const lines = plainText.trim().split('\n')
    const hasNonTabLines = lines.some((l) => l.trim() && !l.includes('\t'))

    if (hasNonTabLines) {
      // Mixed plain text: split into contiguous text-blocks and table-blocks
      const segments = []
      let textBuffer = []
      let tableBuffer = []

      function flushText() {
        if (textBuffer.length === 0) return
        const joined = textBuffer.join('\n').trim()
        if (joined) segments.push({ type: 'html', html: `<p>${joined.replace(/\n/g, '<br>')}</p>` })
        textBuffer = []
      }
      function flushTable() {
        if (tableBuffer.length === 0) return
        const tableData = tableBuffer.map((l) => l.split('\t').map((c) => c.trim()))
        if (tableData.length >= 2) segments.push({ type: 'table', tableData })
        tableBuffer = []
      }

      for (const line of lines) {
        if (line.includes('\t')) {
          flushText()
          tableBuffer.push(line)
        } else {
          flushTable()
          textBuffer.push(line)
        }
      }
      flushText()
      flushTable()

      if (segments.some((s) => s.type === 'html') && segments.length > 1) {
        return { type: 'mixed', segments }
      }
    }

    // Pure table (no non-tab lines, or all segments collapsed to one table)
    const tableData = parseSpreadsheetText(plainText)
    return {
      type: 'table',
      html: tableToHtml(tableData),
      tableData,
      rows: tableData.length,
      cols: tableData[0]?.length || 0
    }
  }

  // 4. Plain text with Markdown markers — only when HTML has no real formatting.
  //    shouldUsePlaintextMarkdown() guards against false positives on editor copy:
  //    if HTML contains <strong>, <h2>, data-list etc. → skip, use HTML path instead.
  //    marked() output is already clean semantic HTML — no need for cleanHtml().
  if (plainText && detectMarkdown(plainText) && shouldUsePlaintextMarkdown(html, plainText)) {
    const converted = markdownToHtml(plainText)
    return { type: 'markdown', html: processUrls(converted) }
  }

  // 5. HTML — clean if external, pass through if already clean (e.g. from our editor)
  if (html) {
    const processedHtml = isCleanHtml(html) ? html : processUrls(cleanHtml(html))
    return { type: 'html', html: processedHtml }
  }

  // 6. Plain text
  if (plainText) {
    return {
      type: 'text',
      html: processUrls(`<p>${plainText}</p>`)
    }
  }

  return null
}

export default {
  handleSmartPaste,
  uploadImageToIntegram,
  processClipboardImages,
  cleanHtml,
  detectMarkdown,
  markdownToHtml,
  detectYouTubeUrl,
  createYouTubeEmbed,
  createIframeEmbed,
  tableToHtml,
  parseSpreadsheetText
}

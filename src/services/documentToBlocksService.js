/**
 * documentToBlocksService.js
 * Issue #7077: Convert document sections (from /api/documents/parse) into editor blocks
 * Issue #7078: Optional translation support via /api/ai-tokens/chat
 *
 * Accepts parsed sections from the file parser (#7076) and inserts them into
 * the BlockDocumentEditor (Quill) as appropriate embed types.
 *
 * Supported section types:
 *  - heading    → Quill header formatting
 *  - paragraph  → Quill HTML clipboard paste
 *  - table      → SimpleTable embed (default) or Integram table
 *  - image      → image embed (URL via Integram or raw base64)
 */

const BATCH_SIZE = 10

/**
 * Generate a short random UID (used for column/row IDs in SimpleTable).
 * @returns {string}
 */
function uid() {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Upload a base64-encoded image to the backend and return a public URL.
 *
 * Calls POST /api/documents/upload-image with a JSON body containing the base64 data.
 * Falls back to the raw base64 data URI if the upload fails.
 *
 * @param {string} base64 - Base64 string (with or without the data URI prefix)
 * @param {string} [mimeType='image/png'] - MIME type of the image
 * @returns {Promise<string>} Public URL or data URI
 */
export async function uploadImageToIntegram(base64, mimeType = 'image/png') {
  try {
    const response = await fetch('/api/documents/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType })
    })

    if (!response.ok) {
      console.warn('[documentToBlocksService] Image upload failed, falling back to base64', response.status)
      return base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`
    }

    const data = await response.json()
    return data.url
  } catch (err) {
    console.warn('[documentToBlocksService] Image upload error, using base64 fallback:', err.message)
    return base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`
  }
}

/**
 * Convert an Excel-style formula to a SimpleTableFormulaEngine-compatible formula.
 * Most common formulas are directly compatible. Unsupported ones return null with a warning.
 *
 * @param {string} formula - Excel formula string (including leading '=')
 * @returns {{ formula: string, warning: string|null }} Mapped formula and optional warning
 */
export function mapExcelFormula(formula) {
  if (!formula || !formula.startsWith('=')) {
    return { formula, warning: null }
  }

  const upper = formula.toUpperCase()

  // Check for unsupported functions
  const unsupportedFunctions = [
    'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'INDIRECT', 'OFFSET',
    'SUMIF', 'COUNTIF', 'AVERAGEIF', 'SUMPRODUCT', 'IFERROR',
    'XLOOKUP', 'UNIQUE', 'FILTER', 'SORT', 'TRANSPOSE'
  ]

  for (const fn of unsupportedFunctions) {
    if (upper.includes(fn + '(')) {
      return {
        formula: null,
        warning: `Функция ${fn} не поддерживается в SimpleTable — ячейка будет пустой`
      }
    }
  }

  // AVERAGE → AVG alias (SimpleTableFormulaEngine supports both, but let's normalize)
  let mapped = formula

  // Direct compatibility: SUM, AVG, MIN, MAX, COUNT, IF, CONCAT, ROUND, ABS, SQRT, POWER, MOD
  // These are already supported by SimpleTableFormulaEngine, no changes needed.

  return { formula: mapped, warning: null }
}

/**
 * Convert a table section (from parsed document) into the SimpleTable data format.
 *
 * @param {Object} section - Table section from parser
 * @param {string[]} section.headers - Column header labels
 * @param {Array<string[]>} section.rows - 2D array of cell values
 * @param {Object} [section.formulas] - Map of "R:C" → formula string (e.g. "1:2" → "=SUM(A1:A3)")
 * @returns {{ tableData: Object, formulaWarnings: string[] }} SimpleTable-compatible data
 */
export function convertSectionToSimpleTable(section) {
  const { headers = [], rows = [], formulas = {} } = section
  const formulaWarnings = []

  // Build columns
  const columns = headers.map((label, idx) => ({
    id: uid(),
    label: label || `Колонка ${idx + 1}`,
    width: null,
    order: idx
  }))

  // If no columns were provided, create a default single column
  if (columns.length === 0) {
    columns.push({ id: uid(), label: 'Колонка 1', width: null, order: 0 })
  }

  // Build rows
  const tableRows = rows.map((rowValues, rowIdx) => {
    const cells = {}
    columns.forEach((col, colIdx) => {
      // Check if this cell has a formula
      const formulaKey = `${rowIdx}:${colIdx}`
      const rawFormula = formulas[formulaKey] || null

      let cellFormula = null
      if (rawFormula) {
        const { formula: mapped, warning } = mapExcelFormula(rawFormula)
        cellFormula = mapped
        if (warning) {
          formulaWarnings.push(`[${rowIdx + 1}:${colIdx + 1}] ${warning}`)
        }
      }

      cells[col.id] = {
        value: rowValues[colIdx] !== undefined ? String(rowValues[colIdx]) : '',
        formula: cellFormula,
        rowspan: 1,
        colspan: 1
      }
    })
    return {
      id: uid(),
      order: rowIdx,
      color: null,
      cells
    }
  })

  // Ensure at least one row
  if (tableRows.length === 0) {
    const emptyRow = { id: uid(), order: 0, color: null, cells: {} }
    columns.forEach(col => {
      emptyRow.cells[col.id] = { value: '', formula: null, rowspan: 1, colspan: 1 }
    })
    tableRows.push(emptyRow)
  }

  const tableData = {
    headerTheme: 'blue',
    columns,
    rows: tableRows
  }

  return { tableData, formulaWarnings }
}

/**
 * Insert a table section as a SimpleTable embed into the Quill editor.
 *
 * @param {Object} section - Table section from parser
 * @param {Object} quillEditor - Quill editor instance
 * @returns {Promise<{ embedId: string, warnings: string[] }>}
 */
export async function insertAsSimpleTable(section, quillEditor) {
  const { tableData, formulaWarnings } = convertSectionToSimpleTable(section)

  const position = quillEditor.getLength()
  quillEditor.insertEmbed(position, 'simple-table', tableData, 'user')
  quillEditor.setSelection(position + 1)

  const embedId = `simple-table-${Date.now()}`
  return { embedId, warnings: formulaWarnings }
}

/**
 * Insert a table section as an Integram table block into the editor.
 * Creates the table in Integram via MCP and inserts an IntegramDataTable embed.
 *
 * NOTE: This requires Integram authentication to be set up prior to calling.
 *
 * @param {Object} section - Table section from parser
 * @param {Object} quillEditor - Quill editor instance
 * @param {Object} [integramConfig] - Integram connection config
 * @param {string} [integramConfig.serverURL='ai2o.ru'] - Server URL
 * @param {string} [integramConfig.database='my'] - Database name
 * @param {string} [integramConfig.token] - Auth token
 * @returns {Promise<{ typeId: string|null, error: string|null }>}
 */
export async function insertAsIntegramTable(section, quillEditor, integramConfig = {}) {
  const { serverURL = 'ai2o.ru', database = 'my', token = '' } = integramConfig

  try {
    const { headers = [], rows = [] } = section

    // Build table name from section title or timestamp
    const tableName = section.title || `Таблица_${Date.now()}`

    // Call the backend MCP endpoint to create the Integram type and populate it
    const response = await fetch('/api/mcp/integram/create-table', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        serverURL,
        database,
        token,
        tableName,
        headers,
        rows
      })
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const typeId = data.typeId

    // Insert the IntegramDataTable embed block into the editor
    const position = quillEditor.getLength()
    quillEditor.insertEmbed(position, 'integram-table', {
      typeId,
      database,
      serverURL,
      title: tableName
    }, 'user')
    quillEditor.setSelection(position + 1)

    return { typeId, error: null }
  } catch (err) {
    console.error('[documentToBlocksService] insertAsIntegramTable error:', err)
    return { typeId: null, error: err.message }
  }
}

/**
 * Main entry point: insert parsed document sections into the Quill editor.
 *
 * @param {Array<Object>} sections - Array of parsed document sections from /api/documents/parse
 * @param {Object} quillEditor - Quill editor instance
 * @param {Object} [options] - Import options
 * @param {boolean} [options.storeImages=true] - Upload images to backend; false = embed as base64
 * @param {boolean} [options.storeTablesInIntegram=false] - Insert tables as Integram tables
 * @param {Object} [options.integramConfig] - Integram config (used when storeTablesInIntegram=true)
 * @param {Function} [options.onProgress] - Optional callback(current, total, sectionType)
 * @param {Function} [options.onWarning] - Optional callback(warning: string)
 * @returns {Promise<{ inserted: number, warnings: string[], errors: string[] }>}
 */
export async function insertDocumentSections(sections, quillEditor, options = {}) {
  const {
    storeImages = true,
    storeTablesInIntegram = false,
    integramConfig = {},
    onProgress = null,
    onWarning = null
  } = options

  const warnings = []
  const errors = []
  let inserted = 0

  const emitWarning = (msg) => {
    warnings.push(msg)
    if (onWarning) onWarning(msg)
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    if (onProgress) onProgress(i + 1, sections.length, section.type)

    try {
      switch (section.type) {
        case 'heading': {
          const level = Math.max(1, Math.min(6, section.level || 2))
          const pos = quillEditor.getLength()
          // Insert text with header format on its own line
          quillEditor.insertText(pos, section.text + '\n', 'user')
          quillEditor.formatLine(pos, 1, 'header', level, 'user')
          inserted++
          break
        }

        case 'paragraph': {
          // Insert HTML content via clipboard API
          const pos = Math.max(0, quillEditor.getLength() - 1)
          if (section.html) {
            quillEditor.clipboard.dangerouslyPasteHTML(pos, section.html, 'user')
          } else if (section.text) {
            quillEditor.insertText(quillEditor.getLength(), section.text + '\n', 'user')
          }
          inserted++
          break
        }

        case 'table': {
          if (storeTablesInIntegram) {
            const { typeId, error } = await insertAsIntegramTable(section, quillEditor, integramConfig)
            if (error) {
              emitWarning(`Таблица не вставлена в Integram: ${error}. Используется SimpleTable.`)
              // Fallback to SimpleTable
              const { warnings: tableWarns } = await insertAsSimpleTable(section, quillEditor)
              tableWarns.forEach(w => emitWarning(w))
            } else {
              console.debug('[documentToBlocksService] Integram table created:', typeId)
            }
          } else {
            const { warnings: tableWarns } = await insertAsSimpleTable(section, quillEditor)
            tableWarns.forEach(w => emitWarning(w))
          }
          inserted++
          break
        }

        case 'image': {
          let imageUrl
          if (storeImages && section.base64) {
            imageUrl = await uploadImageToIntegram(section.base64, section.mimeType || 'image/png')
          } else if (section.url) {
            imageUrl = section.url
          } else if (section.base64) {
            const mime = section.mimeType || 'image/png'
            imageUrl = section.base64.startsWith('data:')
              ? section.base64
              : `data:${mime};base64,${section.base64}`
          }

          if (imageUrl) {
            const pos = Math.max(0, quillEditor.getLength() - 1)
            quillEditor.insertEmbed(pos, 'image', imageUrl, 'user')
            inserted++
          } else {
            emitWarning('Изображение пропущено: нет данных (base64 или url)')
          }
          break
        }

        default:
          emitWarning(`Неизвестный тип секции: ${section.type} — пропущен`)
          break
      }
    } catch (err) {
      const errMsg = `Ошибка при вставке секции ${i + 1} (${section.type}): ${err.message}`
      errors.push(errMsg)
      console.error('[documentToBlocksService]', errMsg, err)
    }
  }

  return { inserted, warnings, errors }
}

// ─── Translation helpers (Issue #7078) ───────────────────────────────────────

/**
 * Translate a single section (text or HTML) via the DronDoc AI token endpoint.
 *
 * @param {Object} section - { type, text, html }
 * @param {string} sourceLang - Source language code ('auto', 'en', 'zh', etc.)
 * @returns {Promise<Object>} Translated section
 */
export async function translateSection(section, sourceLang = 'auto') {
  if (!section.text && !section.html) return section

  const textToTranslate = section.text || stripHtml(section.html)
  if (!textToTranslate.trim()) return section

  // Tables are not translated — structure must be preserved
  if (section.type === 'table') return section

  const langDescription = sourceLang === 'auto' ? 'исходного языка' : sourceLang

  try {
    const response = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: textToTranslate,
        systemPrompt: `Ты — профессиональный переводчик. Переводи с ${langDescription} на русский язык.
Сохраняй структуру: заголовки, списки, таблицы.
Возвращай ТОЛЬКО перевод без комментариев.`,
        application: 'DocumentTranslator'
      })
    })

    if (!response.ok) return section

    const data = await response.json()
    const translatedText = data.response || data.content || textToTranslate

    // Reconstruct HTML for the translated text
    let translatedHtml
    if (section.type && /^h[1-4]$/.test(section.type)) {
      const level = section.type.slice(1)
      translatedHtml = `<h${level}>${translatedText}</h${level}>`
    } else {
      translatedHtml = `<p>${translatedText}</p>`
    }

    return { ...section, text: translatedText, html: translatedHtml }
  } catch (err) {
    console.warn('[documentToBlocksService] translateSection error:', err)
    return section
  }
}

/**
 * Translate all sections in parallel batches of BATCH_SIZE.
 *
 * @param {Array} sections - Array of { type, text, html }
 * @param {string} sourceLang - Source language code
 * @param {Function} [onProgress] - Optional callback(translated, total)
 * @returns {Promise<Array>} Translated sections
 */
export async function translateSections(sections, sourceLang = 'auto', onProgress = null) {
  const total = sections.length
  const translated = [...sections]

  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    const batch = sections.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(s => translateSection(s, sourceLang)))
    results.forEach((result, j) => {
      translated[i + j] = result
    })
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, total), total)
    }
  }

  return translated
}

/**
 * Convert an array of sections (from /api/documents/parse) into HTML.
 *
 * @param {Array} sections - Array of { type, text, html }
 * @returns {string} Combined HTML
 */
export function sectionsToHtml(sections) {
  return sections.map(s => s.html || `<p>${s.text || ''}</p>`).join('\n')
}

/**
 * Strip HTML tags from a string.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '')
}

/**
 * Parse a document file (DOCX/PDF/XLSX) via the backend /api/documents/parse endpoint.
 *
 * @param {File} file - File object
 * @returns {Promise<Object>} { success, fileType, html, sections }
 */
export async function parseDocumentFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/documents/parse', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error || `Parse failed: ${response.status}`)
  }

  return response.json()
}

export default {
  insertDocumentSections,
  insertAsSimpleTable,
  insertAsIntegramTable,
  uploadImageToIntegram,
  mapExcelFormula,
  convertSectionToSimpleTable,
  translateSection,
  translateSections,
  sectionsToHtml,
  stripHtml,
  parseDocumentFile
}

/**
 * AI Response Parser
 * Parses AI responses and converts special block syntax to Quill-compatible format
 * Issue #6572: Support for custom blocks in AI responses
 */

import { logger } from '@/utils/logger'

/**
 * Parse AI response and extract special blocks
 * @param {string} aiResponse - Raw AI response with special block syntax
 * @returns {Object} Parsed response with HTML and special blocks
 */
export function parseAiResponse(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'string') {
    logger.warn('aiResponseParser: Invalid AI response', { aiResponse })
    return {
      html: '',
      specialBlocks: []
    }
  }

  let processedResponse = aiResponse.trim()
  const specialBlocks = []

  try {
    // 1. Parse CALLOUT blocks
    const calloutResult = parseCalloutBlocks(processedResponse)
    processedResponse = calloutResult.content
    specialBlocks.push(...calloutResult.blocks)

    // 2. Parse CHECKLIST blocks
    const checklistResult = parseChecklistBlocks(processedResponse)
    processedResponse = checklistResult.content
    specialBlocks.push(...checklistResult.blocks)

    // 3. Parse QUOTE blocks
    const quoteResult = parseQuoteBlocks(processedResponse)
    processedResponse = quoteResult.content
    specialBlocks.push(...quoteResult.blocks)

    // 4. Parse BUTTON blocks
    const buttonResult = parseButtonBlocks(processedResponse)
    processedResponse = buttonResult.content
    specialBlocks.push(...buttonResult.blocks)

    // 5. Parse INTEGRAM_TABLE references
    const tableResult = parseTableBlocks(processedResponse)
    processedResponse = tableResult.content
    specialBlocks.push(...tableResult.blocks)

    // 6. Parse VUE_COMPONENT blocks
    const vueResult = parseVueComponentBlocks(processedResponse)
    processedResponse = vueResult.content
    specialBlocks.push(...vueResult.blocks)

    // 7. Parse ECOSYSTEM_UNIFIED blocks
    const ecoUnifiedResult = parseEcosystemUnifiedBlocks(processedResponse)
    processedResponse = ecoUnifiedResult.content
    specialBlocks.push(...ecoUnifiedResult.blocks)

    // 7. Clean up markdown code blocks if present (fallback)
    processedResponse = processedResponse
      .replace(/^```(?:html)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    logger.info('aiResponseParser: Response parsed', {
      originalLength: aiResponse.length,
      processedLength: processedResponse.length,
      specialBlocksCount: specialBlocks.length,
      blockTypes: specialBlocks.map(b => b.type)
    })

    return {
      html: processedResponse,
      specialBlocks
    }
  } catch (error) {
    logger.error('aiResponseParser: Error parsing AI response', error)
    return {
      html: aiResponse,
      specialBlocks: []
    }
  }
}

/**
 * Parse [CALLOUT]...[/CALLOUT] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseCalloutBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[CALLOUT(?:\s+type="(info|warning|success|error)")?(?:\s+icon="([^"]+)")?\]([\s\S]+?)\[\/CALLOUT\]/gi

  const processedContent = content.replace(regex, (match, type, icon, calloutContent) => {
    const blockId = `callout-placeholder-${blockCounter++}`

    blocks.push({
      type: 'callout',
      id: blockId,
      data: {
        type: type || 'info',
        icon: icon || '💡',
        content: calloutContent.trim()
      }
    })

    // Return placeholder that will be replaced later
    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [CHECKLIST]...[/CHECKLIST] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseChecklistBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[CHECKLIST\]([\s\S]+?)\[\/CHECKLIST\]/gi

  const processedContent = content.replace(regex, (match, checklistContent) => {
    const blockId = `checklist-placeholder-${blockCounter++}`

    // Parse checklist items
    const items = checklistContent
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map((line, idx) => {
        const checked = line.includes('[x]') || line.includes('[X]')
        const text = line.replace(/^- \[([ xX])\]\s*/, '').trim()

        return {
          id: `item-${Date.now()}-${idx}`,
          text,
          checked
        }
      })

    if (items.length > 0) {
      blocks.push({
        type: 'checklist',
        id: blockId,
        data: { items }
      })

      return `<p data-block-placeholder="${blockId}"></p>`
    }

    return match // Return original if no valid items
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [QUOTE author="..."]...[/QUOTE] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseQuoteBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[QUOTE(?:\s+author="([^"]+)")?\]([\s\S]+?)\[\/QUOTE\]/gi

  const processedContent = content.replace(regex, (match, author, quoteContent) => {
    const blockId = `quote-placeholder-${blockCounter++}`

    blocks.push({
      type: 'quote',
      id: blockId,
      data: {
        author: author || 'Автор',
        content: quoteContent.trim()
      }
    })

    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [BUTTON ...] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseButtonBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[BUTTON\s+text="([^"]+)"(?:\s+style="(primary|secondary|success|danger)")?(?:\s+action="([^"]+)")?(?:\s+message="([^"]+)")?\]/gi

  const processedContent = content.replace(regex, (match, text, style, action, message) => {
    const blockId = `button-placeholder-${blockCounter++}`

    blocks.push({
      type: 'button',
      id: blockId,
      data: {
        text,
        style: style || 'primary',
        action: action || 'showMessage',
        message: message || 'Кнопка нажата!'
      }
    })

    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [INTEGRAM_TABLE id="..."] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseTableBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[INTEGRAM_TABLE\s+id="(\d+)"(?:\s+mode="(simple|full)")?\]/gi

  const processedContent = content.replace(regex, (match, tableId, mode) => {
    const blockId = `table-placeholder-${blockCounter++}`

    blocks.push({
      type: 'integram-table',
      id: blockId,
      data: {
        tableId: parseInt(tableId, 10),
        mode: mode || 'simple'
      }
    })

    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [VUE_COMPONENT]...[/VUE_COMPONENT] blocks
 * Извлекает Vue/PrimeVue код компонента, валидирует безопасность
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseVueComponentBlocks(content) {
  const blocks = []
  let blockCounter = 0

  const regex = /\[VUE_COMPONENT\]([\s\S]+?)\[\/VUE_COMPONENT\]/gi

  const processedContent = content.replace(regex, (match, componentCode) => {
    const code = componentCode.trim()

    // Валидация безопасности — запрет опасных конструкций
    const forbidden = [
      /\beval\s*\(/i,
      /\bFunction\s*\(/i,
      /\bimport\s*\(/i,
      /\brequire\s*\(/i,
      /\blocalStorage\b/i,
      /\bsessionStorage\b/i,
      /\bdocument\.cookie\b/i,
      /\bwindow\.location\b/i,
      /\bfetch\s*\(/i,
      /\bXMLHttpRequest\b/i,
      /\bnew\s+Worker\b/i,
      /\bpostMessage\b/i,
    ]

    const isForbidden = forbidden.some(re => re.test(code))
    if (isForbidden) {
      logger.warn('aiResponseParser: VUE_COMPONENT blocked — forbidden code detected', { codePreview: code.substring(0, 100) })
      return `<p><em>Vue компонент заблокирован — обнаружен запрещённый код</em></p>`
    }

    const blockId = `vue-component-placeholder-${blockCounter++}`

    // Определить используемые PrimeVue компоненты
    const knownComponents = [
      'Button', 'InputText', 'InputNumber', 'Textarea', 'Checkbox', 'RadioButton',
      'Dropdown', 'MultiSelect', 'Calendar', 'Slider', 'Rating', 'InputSwitch',
      'Card', 'Panel', 'Fieldset', 'Accordion', 'AccordionTab', 'TabView', 'TabPanel',
      'DataTable', 'Column', 'Tag', 'Badge', 'Chip', 'Avatar', 'Message',
      'ProgressBar', 'ProgressSpinner', 'Divider', 'Skeleton',
      'Dialog', 'Popover', 'Tooltip',
      'SelectButton', 'ToggleButton', 'Listbox', 'Password',
    ]
    const imports = knownComponents.filter(comp => code.includes(comp))

    blocks.push({
      type: 'vue-component',
      id: blockId,
      data: {
        code,
        imports
      }
    })

    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Parse [ECOSYSTEM_UNIFIED]...[/ECOSYSTEM_UNIFIED] blocks
 * @param {string} content - Content to parse
 * @returns {Object} Parsed content and extracted blocks
 */
function parseEcosystemUnifiedBlocks(content) {
  const blocks = []
  let blockCounter = 0

  // Self-closing tag: [ECOSYSTEM_UNIFIED tab="models" height="600"]
  const selfClosingRegex = /\[ECOSYSTEM_UNIFIED(?:\s+tab="(models|ecosystem|backtest)")?(?:\s+height="(\d+)")?\]/gi

  const processedContent = content.replace(selfClosingRegex, (match, tab, height) => {
    const blockId = `ecosystem-unified-placeholder-${blockCounter++}`

    blocks.push({
      type: 'ecosystem-unified',
      id: blockId,
      data: {
        tab: tab || 'models',
        height: height ? parseInt(height, 10) : 600
      }
    })

    return `<p data-block-placeholder="${blockId}"></p>`
  })

  return {
    content: processedContent,
    blocks
  }
}

/**
 * Insert special blocks into Quill editor
 * @param {Object} quillEditor - Quill editor instance
 * @param {number} position - Position to insert at
 * @param {string} html - HTML content with placeholders
 * @param {Array} specialBlocks - Array of special blocks
 */
export function insertResponseWithBlocks(quillEditor, position, html, specialBlocks) {
  if (!quillEditor) {
    logger.error('aiResponseParser: insertResponseWithBlocks called without quillEditor')
    return
  }

  try {
    // Убираем placeholder-ы из HTML (Quill не сохраняет data-атрибуты на <p>)
    const cleanHtml = html.replace(/<p data-block-placeholder="[^"]+"><\/p>/g, '').trim()

    // Вставляем обычный HTML-контент (если есть)
    let currentPos = position
    if (cleanHtml) {
      quillEditor.clipboard.dangerouslyPasteHTML(currentPos, cleanHtml)
      // Сдвигаем позицию на длину вставленного контента
      currentPos = quillEditor.getLength() - 1
    }

    // Вставляем специальные блоки напрямую как embed
    specialBlocks.forEach(block => {
      try {
        insertSpecialBlock(quillEditor, currentPos, block)
        currentPos += 1 // embed занимает 1 символ в Quill
        logger.info('aiResponseParser: Special block inserted', { type: block.type, id: block.id })
      } catch (err) {
        logger.error('aiResponseParser: Failed to insert special block', { type: block.type, error: err })
      }
    })

    logger.info('aiResponseParser: Response inserted with special blocks', {
      htmlLength: html.length,
      specialBlocksCount: specialBlocks.length
    })
  } catch (error) {
    logger.error('aiResponseParser: Error inserting response with blocks', error)
    // Fallback: вставляем embed напрямую без HTML
    try {
      specialBlocks.forEach(block => insertSpecialBlock(quillEditor, position, block))
    } catch (fallbackErr) {
      logger.error('aiResponseParser: Fallback also failed', fallbackErr)
    }
  }
}

/**
 * Insert a single special block into Quill
 * @param {Object} quillEditor - Quill editor instance
 * @param {number} position - Position to insert at
 * @param {Object} block - Block data
 */
function insertSpecialBlock(quillEditor, position, block) {
  try {
    switch (block.type) {
      case 'callout':
        quillEditor.insertEmbed(position, 'coda-callout', {
          type: block.data.type,
          icon: block.data.icon
        })
        // Insert content inside callout (this is simplified, actual implementation may vary)
        // For now, we'll insert it as HTML after the callout
        quillEditor.clipboard.dangerouslyPasteHTML(position + 1, `<p>${block.data.content}</p>`)
        break

      case 'checklist':
        quillEditor.insertEmbed(position, 'coda-checklist', {
          items: block.data.items
        })
        break

      case 'quote':
        quillEditor.insertEmbed(position, 'coda-quote', {
          author: block.data.author
        })
        // Insert quote content after the quote block
        quillEditor.clipboard.dangerouslyPasteHTML(position + 1, `<p>${block.data.content}</p>`)
        break

      case 'button':
        quillEditor.insertEmbed(position, 'coda-button', {
          text: block.data.text,
          style: block.data.style,
          action: block.data.action,
          message: block.data.message
        })
        break

      case 'integram-table':
        quillEditor.insertEmbed(position, 'integram-table', {
          tableId: block.data.tableId,
          mode: block.data.mode
        })
        break

      case 'vue-component':
        quillEditor.insertEmbed(position, 'vue-component', {
          code: block.data.code,
          imports: block.data.imports
        })
        break

      case 'ecosystem-unified':
        quillEditor.insertEmbed(position, 'ecosystem_unified_embed', {
          tab: block.data.tab || 'models',
          height: block.data.height || 600
        })
        break

      default:
        logger.warn('aiResponseParser: Unknown block type', { type: block.type })
    }
  } catch (error) {
    logger.error('aiResponseParser: Error inserting special block', { block, error })
  }
}

/**
 * Convert AI response to plain HTML without special blocks
 * (Fallback for simple insertion)
 * @param {string} aiResponse - AI response
 * @returns {string} HTML string
 */
export function convertToPlainHtml(aiResponse) {
  const { html } = parseAiResponse(aiResponse)
  // Remove all placeholders
  return html.replace(/<p data-block-placeholder="[^"]+"><\/p>/g, '')
}

export default {
  parseAiResponse,
  insertResponseWithBlocks,
  convertToPlainHtml
}

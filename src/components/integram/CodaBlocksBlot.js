/**
 * Custom Quill Blots for Coda.io-inspired blocks
 *
 * This file implements 16 custom block types as Quill Blots:
 * 1. Checklist Block
 * 2. Callout Block
 * 3. Columns Block
 * 4. Interactive Button Block
 * 5. Progress Bar Block
 * 6. Toggle/Collapsible Block
 * 7. Quote Block
 * 8. Card Block
 * 9. Divider Block
 * 10. Code Block
 * 11. AI Block
 * 12. Video Block
 * 13. Image Block
 * 14. Formula Block (KaTeX)
 * 15. Vue Component Block
 * 16. Map Block (Leaflet) - Issue #6588
 */
import Quill from 'quill'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const BlockEmbed = Quill.import('blots/block/embed')

// Helper function to generate unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * 1. Checklist Block Blot
 */
class ChecklistBlot extends BlockEmbed {
  static blotName = 'coda-checklist'
  static tagName = 'div'
  static className = 'coda-checklist-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const blockId = generateId('checklist')
    node.setAttribute('data-block-id', blockId)

    const items = value?.items || [
      { id: 'item1', text: 'Задача 1', checked: false },
      { id: 'item2', text: 'Задача 2', checked: false },
      { id: 'item3', text: 'Задача 3', checked: false }
    ]

    node.innerHTML = `
      <div class="checklist-header">
        <i class="pi pi-check-square"></i>
        <span>Чеклист</span>
      </div>
      <div class="checklist-items" contenteditable="true">
        ${items.map(item => `
          <div class="checklist-item" data-item-id="${item.id}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} onclick="this.closest('.coda-checklist-block').dispatchEvent(new CustomEvent('checklist-toggle', { detail: { id: '${item.id}' } }))" />
            <span contenteditable="true">${item.text}</span>
          </div>
        `).join('')}
      </div>
    `

    return node
  }

  static value(node) {
    const items = []
    const itemElements = node.querySelectorAll('.checklist-item')
    itemElements.forEach(el => {
      const checkbox = el.querySelector('input[type="checkbox"]')
      const span = el.querySelector('span')
      items.push({
        id: el.getAttribute('data-item-id') || generateId('item'),
        text: span?.textContent || '',
        checked: checkbox?.checked || false
      })
    })
    return { items }
  }
}

/**
 * 2. Callout Block Blot
 */
class CalloutBlot extends BlockEmbed {
  static blotName = 'coda-callout'
  static tagName = 'div'
  static className = 'coda-callout-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const icon = value?.icon || '💡'
    const type = value?.type || 'info' // info, warning, success, error

    node.setAttribute('data-callout-type', type)

    node.innerHTML = `
      <div class="callout-icon">${icon}</div>
      <div class="callout-content" contenteditable="true">
        <p><strong>Важная информация</strong></p>
        <p>Добавьте здесь важный текст или подсказку. Вы можете изменить иконку и стиль выделения.</p>
      </div>
    `

    return node
  }

  static value(node) {
    const icon = node.querySelector('.callout-icon')?.textContent || '💡'
    const type = node.getAttribute('data-callout-type') || 'info'
    return { icon, type }
  }
}

/**
 * 3. Columns Block Blot
 */
class ColumnsBlot extends BlockEmbed {
  static blotName = 'coda-columns'
  static tagName = 'div'
  static className = 'coda-columns-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const columnCount = value?.columnCount || 2

    node.innerHTML = `
      ${Array(columnCount).fill(0).map((_, i) => `
        <div class="column-item" contenteditable="true">
          <p><strong>Колонка ${i + 1}</strong></p>
          <p>Содержимое ${i === 0 ? 'первой' : 'второй'} колонки. ${i === 0 ? 'Вы можете добавить текст, списки и другие элементы.' : 'Отлично подходит для сравнения или параллельного отображения информации.'}</p>
        </div>
      `).join('')}
    `

    return node
  }

  static value(node) {
    const columns = node.querySelectorAll('.column-item')
    return { columnCount: columns.length }
  }
}

/**
 * 4. Interactive Button Block Blot
 */
class ButtonBlot extends BlockEmbed {
  static blotName = 'coda-button'
  static tagName = 'div'
  static className = 'coda-button-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const text = value?.text || 'Нажми меня'
    const action = value?.action || 'showMessage'
    const style = value?.style || 'primary'
    const message = value?.message || 'Кнопка нажата!'

    node.setAttribute('data-button-action', action)
    node.setAttribute('data-button-style', style)
    node.setAttribute('data-button-message', message)

    const buttonClasses = {
      primary: 'p-button-primary',
      secondary: 'p-button-secondary',
      success: 'p-button-success',
      danger: 'p-button-danger'
    }

    node.innerHTML = `
      <button class="p-button ${buttonClasses[style] || buttonClasses.primary}"
              onclick="this.closest('.coda-button-block').dispatchEvent(new CustomEvent('button-click', { detail: { action: '${action}', message: '${message}' } }))">
        ${text}
      </button>
    `

    return node
  }

  static value(node) {
    const button = node.querySelector('button')
    return {
      text: button?.textContent || 'Нажми меня',
      action: node.getAttribute('data-button-action') || 'showMessage',
      style: node.getAttribute('data-button-style') || 'primary',
      message: node.getAttribute('data-button-message') || 'Кнопка нажата!'
    }
  }
}

/**
 * 5. Progress Bar Block Blot
 */
class ProgressBlot extends BlockEmbed {
  static blotName = 'coda-progress'
  static tagName = 'div'
  static className = 'coda-progress-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const progress = value?.progress || 75
    const label = value?.label || 'Прогресс проекта'

    node.setAttribute('data-progress', progress)

    node.innerHTML = `
      <div class="progress-header">
        <span contenteditable="true">${label}</span>
        <span>${progress}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <p contenteditable="true">Описание задачи или метрики. Вы можете отредактировать текст и процент выполнения.</p>
    `

    return node
  }

  static value(node) {
    const progress = parseInt(node.getAttribute('data-progress')) || 75
    const labelEl = node.querySelector('.progress-header span:first-child')
    return {
      progress,
      label: labelEl?.textContent || 'Прогресс проекта'
    }
  }
}

/**
 * 6. Toggle/Collapsible Block Blot
 */
class ToggleBlot extends BlockEmbed {
  static blotName = 'coda-toggle'
  static tagName = 'div'
  static className = 'coda-toggle-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const title = value?.title || 'Нажмите, чтобы развернуть'
    const expanded = value?.expanded || false

    node.setAttribute('data-expanded', expanded)

    node.innerHTML = `
      <div class="toggle-header" onclick="this.closest('.coda-toggle-block').dispatchEvent(new CustomEvent('toggle-expand', {bubbles: true}))">
        <i class="pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}"></i>
        <span contenteditable="true">${title}</span>
      </div>
      <div class="toggle-content" style="display: ${expanded ? 'block' : 'none'}" contenteditable="true">
        <p>Здесь находится скрытое содержимое. Вы можете добавить сюда текст, списки, изображения и другие элементы.</p>
      </div>
    `

    return node
  }

  static value(node) {
    const expanded = node.getAttribute('data-expanded') === 'true'
    const titleEl = node.querySelector('.toggle-header span')
    return {
      title: titleEl?.textContent || 'Нажмите, чтобы развернуть',
      expanded
    }
  }
}

/**
 * 7. Quote Block Blot
 */
class QuoteBlot extends BlockEmbed {
  static blotName = 'coda-quote'
  static tagName = 'div'
  static className = 'coda-quote-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const author = value?.author || 'Автор'

    node.innerHTML = `
      <div class="quote-mark">"</div>
      <div class="quote-content" contenteditable="true">
        <p>Добавьте сюда цитату или важное высказывание. Текст будет отформатирован в стиле красивой цитаты.</p>
      </div>
      <div class="quote-author" contenteditable="true">— ${author}</div>
    `

    return node
  }

  static value(node) {
    const authorEl = node.querySelector('.quote-author')
    return {
      author: authorEl?.textContent?.replace('— ', '') || 'Автор'
    }
  }
}

/**
 * 8. Card Block Blot
 */
class CardBlot extends BlockEmbed {
  static blotName = 'coda-card'
  static tagName = 'div'
  static className = 'coda-card-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    node.innerHTML = `
      <div class="card-header" contenteditable="true">
        <h3>Заголовок карточки</h3>
      </div>
      <div class="card-body" contenteditable="true">
        <p>Содержимое карточки. Карточки отлично подходят для выделения важной информации, создания визуальных разделов или организации контента.</p>
      </div>
    `

    return node
  }

  static value(node) {
    return {}
  }
}

/**
 * 9. Divider Block Blot
 */
class DividerBlot extends BlockEmbed {
  static blotName = 'coda-divider'
  static tagName = 'div'
  static className = 'coda-divider-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const style = value?.style || 'solid'

    node.innerHTML = `<hr class="divider-line divider-${style}" />`

    return node
  }

  static value(node) {
    return { style: 'solid' }
  }
}

/**
 * 10. Code Block Blot
 */
class CodeBlockBlot extends BlockEmbed {
  static blotName = 'coda-code'
  static tagName = 'div'
  static className = 'coda-code-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const language = value?.language || 'javascript'

    node.setAttribute('data-language', language)

    node.innerHTML = `
      <div class="code-header">
        <span class="code-language">${language}</span>
      </div>
      <pre class="code-content" contenteditable="true"><code>// Добавьте сюда код
function hello() {
  console.log('Hello, World!')
}</code></pre>
    `

    return node
  }

  static value(node) {
    const language = node.getAttribute('data-language') || 'javascript'
    return { language }
  }
}

/**
 * 11. AI Block Blot (Issue #6507, enhanced in #6572)
 * Enhanced AI block with context display and improved UI
 */
class AiBlockBlot extends BlockEmbed {
  static blotName = 'coda-ai-block'
  static tagName = 'div'
  static className = 'coda-ai-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const blockId = value?.blockId || generateId('ai-block')
    node.setAttribute('data-ai-block-id', blockId)
    node.setAttribute('data-ai-status', 'idle')

    // Issue #6572: Enhanced UI with context panel
    node.innerHTML = `
      <div class="ai-block-header">
        <div class="ai-block-title">
          <i class="pi pi-sparkles" style="color: var(--primary-color);"></i>
          <span>ИИ Ассистент</span>
        </div>
        <button class="ai-block-close" data-ai-action="remove" data-block-id="${blockId}" title="Закрыть">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div class="ai-block-hint">
        <i class="pi pi-info-circle"></i>
        <span>Попробуйте: "Создай список из 5 пунктов" или "Улучши этот текст"</span>
      </div>

      <div class="ai-block-input-wrapper">
        <textarea
          class="ai-block-input"
          data-ai-input="${blockId}"
          placeholder="Что нужно сделать?..."
          rows="2"
        ></textarea>
      </div>

      <div class="ai-block-buttons">
        <button class="ai-block-send primary" data-ai-action="send" data-block-id="${blockId}">
          <i class="pi pi-send"></i>
          <span>Отправить</span>
          <small>(Ctrl+Enter)</small>
        </button>
      </div>

      <div class="ai-block-context" data-ai-context="${blockId}" style="display: none;">
        <div class="context-header">
          <i class="pi pi-file"></i>
          <span>Контекст документа</span>
        </div>
        <div class="context-body">
          <div class="context-item">
            <strong>Документ:</strong> <span class="context-doc-title">—</span>
          </div>
          <div class="context-item">
            <strong>Секция:</strong> <span class="context-section">—</span>
          </div>
          <div class="context-item">
            <strong>Размер:</strong> <span class="context-size">—</span>
          </div>
        </div>
      </div>

      <div class="ai-block-loading" data-ai-loading="${blockId}" style="display: none;">
        <div class="loading-spinner">
          <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div class="loading-text">Генерация ответа...</div>
        <div class="loading-progress"></div>
      </div>

      <div class="ai-block-response" data-ai-response="${blockId}" style="display: none;"></div>

      <div class="ai-format-selector" data-ai-format="${blockId}" style="display: none;">
        <span class="format-label">Формат:</span>
        <div class="format-options">
          <button class="format-option active" data-format="auto" data-ai-action="format" data-block-id="${blockId}">
            <i class="pi pi-sparkles"></i> Авто
          </button>
          <button class="format-option" data-format="text" data-ai-action="format" data-block-id="${blockId}">
            <i class="pi pi-align-left"></i> Текст
          </button>
          <button class="format-option" data-format="checklist" data-ai-action="format" data-block-id="${blockId}">
            <i class="pi pi-check-square"></i> Чеклист
          </button>
          <button class="format-option" data-format="component" data-ai-action="format" data-block-id="${blockId}">
            <i class="pi pi-code"></i> Компонент
          </button>
        </div>
      </div>

      <div class="ai-block-actions" data-ai-actions="${blockId}" style="display: none;">
        <button class="action-primary" data-ai-action="apply" data-block-id="${blockId}">
          <i class="pi pi-check"></i>
          Вставить в документ
        </button>
        <button class="action-secondary" data-ai-action="retry" data-block-id="${blockId}">
          <i class="pi pi-refresh"></i>
          Повторить
        </button>
        <button class="action-secondary" data-ai-action="edit" data-block-id="${blockId}">
          <i class="pi pi-pencil"></i>
          Редактировать запрос
        </button>
      </div>

      <div class="ai-block-error" data-ai-error="${blockId}" style="display: none;">
        <i class="pi pi-exclamation-triangle"></i>
        <span class="error-message"></span>
      </div>
    `

    return node
  }

  static value(node) {
    return { blockId: node.getAttribute('data-ai-block-id') || '' }
  }
}

/**
 * 12. Video Embed Blot
 * Supports YouTube, Vimeo, and direct video URLs
 */
class VideoBlot extends BlockEmbed {
  static blotName = 'coda-video'
  static tagName = 'div'
  static className = 'coda-video-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const url = value?.url || ''
    const caption = value?.caption || ''
    node.setAttribute('data-url', url)
    if (caption) node.setAttribute('data-caption', caption)

    const embedUrl = VideoBlot.getEmbedUrl(url)

    if (embedUrl) {
      node.innerHTML = `
        <div class="video-wrapper">
          <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        ${caption ? `<div class="video-caption" contenteditable="true">${caption}</div>` : ''}
      `
    } else if (url) {
      node.innerHTML = `
        <div class="video-wrapper video-native">
          <video controls src="${url}"></video>
        </div>
        ${caption ? `<div class="video-caption" contenteditable="true">${caption}</div>` : ''}
      `
    } else {
      node.innerHTML = `
        <div class="video-placeholder">
          <i class="pi pi-video"></i>
          <span>Вставьте URL видео (YouTube, Vimeo или прямая ссылка)</span>
        </div>
      `
    }

    return node
  }

  static getEmbedUrl(url) {
    if (!url) return null
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    // RuTube
    const rutubeMatch = url.match(/rutube\.ru\/video\/([a-f0-9]+)/)
    if (rutubeMatch) return `https://rutube.ru/play/embed/${rutubeMatch[1]}`
    return null
  }

  static value(node) {
    return {
      url: node.getAttribute('data-url') || '',
      caption: node.querySelector('.video-caption')?.textContent || node.getAttribute('data-caption') || ''
    }
  }
}

/**
 * 13. Image Block Blot (with caption and resize)
 */
class ImageBlockBlot extends BlockEmbed {
  static blotName = 'coda-image'
  static tagName = 'div'
  static className = 'coda-image-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const src = value?.src || ''
    const caption = value?.caption || ''
    const width = value?.width || '100%'
    const alt = value?.alt || caption || 'Изображение'
    node.setAttribute('data-src', src)
    if (caption) node.setAttribute('data-caption', caption)
    node.setAttribute('data-width', width)

    if (src) {
      node.innerHTML = `
        <div class="image-wrapper" style="max-width: ${width}; margin: 0 auto;">
          <img src="${src}" alt="${alt}" style="width: 100%; display: block; border-radius: 4px;" />
        </div>
        ${caption ? `<div class="image-caption" contenteditable="true">${caption}</div>` : '<div class="image-caption image-caption-empty" contenteditable="true" data-placeholder="Добавить подпись..."></div>'}
      `
    } else {
      node.innerHTML = `
        <div class="image-placeholder">
          <i class="pi pi-image"></i>
          <span>Вставьте URL изображения</span>
        </div>
      `
    }

    return node
  }

  static value(node) {
    return {
      src: node.getAttribute('data-src') || node.querySelector('img')?.src || '',
      caption: node.querySelector('.image-caption')?.textContent || node.getAttribute('data-caption') || '',
      width: node.getAttribute('data-width') || '100%'
    }
  }
}

/**
 * 14. Formula Blot (KaTeX math)
 * Renders LaTeX formulas using bundled KaTeX (npm package)
 */
class FormulaBlot extends BlockEmbed {
  static blotName = 'coda-formula'
  static tagName = 'div'
  static className = 'coda-formula-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const latex = value?.latex || 'E = mc^2'
    const displayMode = value?.displayMode !== false
    const base64 = btoa(unescape(encodeURIComponent(latex)))
    node.setAttribute('data-latex-base64', base64)
    node.setAttribute('data-display-mode', displayMode ? 'true' : 'false')

    const display = document.createElement('div')
    display.className = 'formula-display'
    display.setAttribute('data-latex', latex)
    node.appendChild(display)

    try {
      katex.render(latex, display, {
        displayMode,
        throwOnError: false,
        output: 'html'
      })
    } catch (e) {
      console.warn('FormulaBlot: KaTeX render error', e)
      display.innerHTML = `<code class="formula-source">${latex}</code>`
    }

    // Edit button
    const editBtn = document.createElement('button')
    editBtn.className = 'formula-edit-btn'
    editBtn.textContent = '✏️'
    editBtn.title = 'Редактировать формулу'
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const currentLatex = decodeURIComponent(escape(atob(node.getAttribute('data-latex-base64'))))
      const newLatex = prompt('LaTeX формула:', currentLatex)
      if (newLatex !== null && newLatex !== currentLatex) {
        const newBase64 = btoa(unescape(encodeURIComponent(newLatex)))
        node.setAttribute('data-latex-base64', newBase64)
        display.setAttribute('data-latex', newLatex)
        try {
          katex.render(newLatex, display, { displayMode, throwOnError: false, output: 'html' })
        } catch (err) {
          display.innerHTML = `<code class="formula-source">${newLatex}</code>`
        }
      }
    })
    node.appendChild(editBtn)

    return node
  }

  static value(node) {
    const base64 = node.getAttribute('data-latex-base64')
    let latex = 'E = mc^2'
    if (base64) {
      try {
        latex = decodeURIComponent(escape(atob(base64)))
      } catch (e) { /* fallback */ }
    }
    return {
      latex,
      displayMode: node.getAttribute('data-display-mode') !== 'false'
    }
  }
}

/**
 * 15. Vue Component Block Blot
 * Renders live Vue/PrimeVue components generated by AI
 * Code is stored as base64 in data-code-base64 attribute
 */
class VueComponentBlot extends BlockEmbed {
  static blotName = 'vue-component'
  static tagName = 'div'
  static className = 'vue-component-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const code = value?.code || '<p>Пустой компонент</p>'
    const imports = value?.imports || []
    const embedId = value?.embedId || generateId('vue-comp')

    // Encode code to base64 for safe storage in HTML
    const base64Code = btoa(unescape(encodeURIComponent(code)))
    node.setAttribute('data-code-base64', base64Code)
    node.setAttribute('data-imports', imports.join(','))
    node.setAttribute('data-embed-id', embedId)

    // Placeholder content (replaced by mountVueComponent)
    node.innerHTML = `
      <div class="vue-component-placeholder">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-code text-primary"></i>
          <h4 class="m-0 text-primary">Vue компонент</h4>
        </div>
        <div class="mt-2 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Монтирование компонента...
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    const base64Code = node.getAttribute('data-code-base64') || ''
    let code = ''
    if (base64Code) {
      try {
        code = decodeURIComponent(escape(atob(base64Code)))
      } catch (e) {
        code = ''
      }
    }
    const importsStr = node.getAttribute('data-imports') || ''
    const imports = importsStr ? importsStr.split(',').filter(Boolean) : []
    const embedId = node.getAttribute('data-embed-id') || ''

    return { code, imports, embedId }
  }
}

// Import MapBlot from separate file (Issue #6588)
import { MapBlot } from './MapBlot.js'
// Import IntegramChartBlot (Issue #6587)
import { IntegramChartBlot } from './IntegramChartBlot.js'
// Import CalendarBlot (Issue #6879)
import { CalendarBlot } from './CalendarBlot.js'
// Import IntegramTabsBlot (Issue #6843)
import { IntegramTabsBlot } from './IntegramTabsBlot.js'

// Register all custom blots
Quill.register(ChecklistBlot)
Quill.register(CalloutBlot)
Quill.register(ColumnsBlot)
Quill.register(ButtonBlot)
Quill.register(ProgressBlot)
Quill.register(ToggleBlot)
Quill.register(QuoteBlot)
Quill.register(CardBlot)
Quill.register(DividerBlot)
Quill.register(CodeBlockBlot)
Quill.register(AiBlockBlot)
Quill.register(VideoBlot)
Quill.register(ImageBlockBlot)
Quill.register(FormulaBlot)
Quill.register(VueComponentBlot)
Quill.register(MapBlot)
Quill.register(IntegramChartBlot, true)
Quill.register(CalendarBlot, true)
Quill.register(IntegramTabsBlot, true)

export {
  ChecklistBlot,
  CalloutBlot,
  ColumnsBlot,
  ButtonBlot,
  ProgressBlot,
  ToggleBlot,
  QuoteBlot,
  CardBlot,
  DividerBlot,
  CodeBlockBlot,
  AiBlockBlot,
  VideoBlot,
  ImageBlockBlot,
  FormulaBlot,
  VueComponentBlot,
  MapBlot,
  IntegramChartBlot,
  CalendarBlot
}

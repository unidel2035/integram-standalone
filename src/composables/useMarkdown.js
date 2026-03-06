import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Composable for rendering markdown with GitHub-style features
 * - Sanitized HTML output
 * - Code block copy buttons
 * - File link detection and conversion
 */
export function useMarkdown() {
  /**
   * Configure marked with GitHub-flavored markdown options
   */
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
    headerIds: true,
    mangle: false,
    sanitize: false // We'll use DOMPurify instead
  })

  /**
   * Custom renderer for code blocks with copy button
   */
  const renderer = new marked.Renderer()

  // Override code block rendering to add copy button
  renderer.code = (code, language) => {
    const lang = language || 'text'
    const escaped = code.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-language">${lang}</span>
          <button class="code-copy-btn" data-code="${escaped.replace(/"/g, '&quot;')}" title="Скопировать код">
            <i class="pi pi-copy"></i>
            <span class="copy-text">Копировать</span>
          </button>
        </div>
        <pre><code class="language-${lang}">${escaped}</code></pre>
      </div>
    `
  }

  // Override link rendering to detect file references
  const originalLink = renderer.link.bind(renderer)
  renderer.link = (href, title, text) => {
    // Check if this looks like a file reference (e.g., src/file.js, ./path/to/file)
    const filePattern = /^\.{0,2}\/?[\w-]+(?:\/[\w.-]+)*\.\w+$/

    if (filePattern.test(href)) {
      // It's a file reference
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${href}" class="file-link"${titleAttr}><i class="pi pi-file"></i> ${text}</a>`
    }

    // Regular link
    return originalLink(href, title, text)
  }

  marked.use({ renderer })

  /**
   * Render markdown to sanitized HTML
   * @param {string} markdown - The markdown text to render
   * @param {Object} options - Rendering options
   * @returns {string} Sanitized HTML
   */
  function renderMarkdown(markdown, options = {}) {
    if (!markdown) return ''

    try {
      // Convert markdown to HTML
      const html = marked.parse(markdown)

      // Sanitize HTML to prevent XSS
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'a', 'code', 'pre',
          'blockquote',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'img',
          'hr',
          'div', 'span', 'button', 'i'
        ],
        ALLOWED_ATTR: [
          'href', 'title', 'alt', 'src',
          'class', 'data-code',
          'id', 'name',
          'width', 'height'
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      })

      return sanitized
    } catch (error) {
      console.error('Error rendering markdown:', error)
      return markdown // Return original markdown if rendering fails
    }
  }

  /**
   * Set up copy button event handlers
   * Should be called after rendering markdown to DOM
   * @param {HTMLElement} container - The container element with rendered markdown
   */
  function setupCopyButtons(container) {
    if (!container) return

    const copyButtons = container.querySelectorAll('.code-copy-btn')

    copyButtons.forEach(button => {
      // Remove any existing listeners
      const newButton = button.cloneNode(true)
      button.parentNode.replaceChild(newButton, button)

      newButton.addEventListener('click', async (e) => {
        e.preventDefault()
        const code = newButton.getAttribute('data-code')

        // Decode HTML entities
        const textarea = document.createElement('textarea')
        textarea.innerHTML = code
        const decodedCode = textarea.value

        try {
          await navigator.clipboard.writeText(decodedCode)

          // Visual feedback
          const originalContent = newButton.innerHTML
          newButton.innerHTML = '<i class="pi pi-check"></i><span class="copy-text">Скопировано!</span>'
          newButton.classList.add('copied')

          setTimeout(() => {
            newButton.innerHTML = originalContent
            newButton.classList.remove('copied')
          }, 2000)
        } catch (error) {
          console.error('Failed to copy code:', error)

          // Fallback: Show error feedback
          const originalContent = newButton.innerHTML
          newButton.innerHTML = '<i class="pi pi-times"></i><span class="copy-text">Ошибка</span>'

          setTimeout(() => {
            newButton.innerHTML = originalContent
          }, 2000)
        }
      })
    })
  }

  /**
   * Detect and convert file references in text to links
   * @param {string} text - The text to process
   * @param {string} repoUrl - Base repository URL (e.g., https://github.com/owner/repo)
   * @param {string} branch - Branch name (default: 'main')
   * @returns {string} Text with file references converted to links
   */
  function linkifyFileReferences(text, repoUrl = '', branch = 'main') {
    if (!text || !repoUrl) return text

    // Pattern to match file paths in text (e.g., src/components/MyComponent.vue)
    const filePattern = /(?:^|\s)((?:\.{0,2}\/)?[\w-]+(?:\/[\w.-]+)*\.\w+)(?=\s|$|[,.])/g

    return text.replace(filePattern, (match, filepath, offset) => {
      // Clean up the filepath
      const cleanPath = filepath.replace(/^\.\//, '')

      // Build GitHub blob URL
      const fileUrl = `${repoUrl}/blob/${branch}/${cleanPath}`

      // Return the replacement with proper spacing
      const prefix = match[0] === ' ' ? ' ' : ''
      return `${prefix}<a href="${fileUrl}" class="file-link" target="_blank" rel="noopener noreferrer"><i class="pi pi-file"></i> ${filepath}</a>`
    })
  }

  return {
    renderMarkdown,
    setupCopyButtons,
    linkifyFileReferences
  }
}

<template>
  <div class="markdown-content" v-html="parsedMarkdown"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  content: {
    type: [String, Object],
    required: true
  }
})

const parsedMarkdown = computed(() => {
  // Ensure content is always a string
  let contentStr = props.content

  // Handle non-string content gracefully
  if (typeof contentStr !== 'string') {
    if (contentStr === null || contentStr === undefined) {
      return ''
    }
    // If it's an object, try to stringify it
    try {
      contentStr = JSON.stringify(contentStr, null, 2)
    } catch (e) {
      console.error('MarkdownRender: Failed to stringify content', e)
      contentStr = String(contentStr)
    }
  }

  // Handle empty strings
  if (!contentStr || contentStr.trim() === '') {
    return ''
  }

  // Collapse all double blank lines to single
  contentStr = contentStr.replace(/\n{2,}/g, '\n').trim()

  try {
    let html = marked(contentStr)
    // Strip emoji from rendered HTML (replace with nothing)
    html = html.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}]+/gu, '')
    // Remove resulting empty tags
    html = html.replace(/<(p|span|li)>\s*<\/\1>/g, '')
    return html
  } catch (error) {
    console.error('MarkdownRender: marked() parsing error', error)
    // Fallback to escaped HTML if marked fails
    const div = document.createElement('div')
    div.textContent = contentStr
    return div.innerHTML
  }
})
</script>

<style scoped>
:deep(.markdown-content) {
  width: 100%;
  overflow: hidden;
  font-size: inherit;
  line-height: inherit;
}

:deep(.markdown-content p) {
  margin: 0;
}

:deep(.markdown-content p + p) {
  margin-top: 0.2em;
}

:deep(.markdown-content ul),
:deep(.markdown-content ol) {
  margin: 0.1em 0;
  padding-left: 1.1em;
}

:deep(.markdown-content li) {
  margin: 0;
}

:deep(.markdown-content h1),
:deep(.markdown-content h2),
:deep(.markdown-content h3) {
  margin: 0.25em 0 0.1em;
  font-size: 1em;
  font-weight: 600;
}

:deep(.markdown-content h1) { font-size: 1.05em; }

:deep(.markdown-content blockquote) {
  margin: 0.3em 0;
  padding-left: 0.8em;
  border-left: 3px solid var(--p-content-border-color);
  opacity: 0.85;
}

/* Блоки кода */
:deep(.markdown-content pre) {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  padding: 0.6em 0.8em;
  border-radius: 6px;
  max-width: 100%;
  overflow-x: auto;
  margin: 0.3em 0;
  font-size: 0.85em;
  box-sizing: border-box;
}

/* Inline код */
:deep(.markdown-content code:not(pre code)) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: var(--p-surface-ground);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  font-size: 0.88em;
}

/* Код внутри pre */
:deep(.markdown-content pre code) {
  display: block;
  white-space: pre;
  overflow-x: auto;
  line-height: 1.4;
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  color: var(--p-text-color);
  background: transparent;
  width: 100%;
  box-sizing: border-box;
}

:deep(.markdown-content pre)::-webkit-scrollbar {
  height: 4px;
}

:deep(.markdown-content pre)::-webkit-scrollbar-thumb {
  background: var(--p-text-muted-color);
  border-radius: 2px;
  opacity: 0.3;
}
</style>
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

  // Collapse 3+ consecutive blank lines to 2 (prevents excessive whitespace from models)
  contentStr = contentStr.replace(/\n{3,}/g, '\n\n').trim()

  try {
    return marked(contentStr)
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
}

:deep(.markdown-content p) {
  margin: 0.25em 0;
}

:deep(.markdown-content p + p) {
  margin-top: 0.5em;
}

:deep(.markdown-content ul),
:deep(.markdown-content ol) {
  margin: 0.3em 0;
  padding-left: 1.4em;
}

:deep(.markdown-content li) {
  margin: 0.1em 0;
}

:deep(.markdown-content h1),
:deep(.markdown-content h2),
:deep(.markdown-content h3) {
  margin: 0.6em 0 0.3em;
}

:deep(.markdown-content blockquote) {
  margin: 0.4em 0;
}

/* Жесткое ограничение для блоков кода */
:deep(.markdown-content pre) {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  max-width: 100%;
  overflow-x: auto;
  margin: 0.5rem 0;

  /* Критически важные свойства */
  width: fit-content;
  min-width: 100%;
  box-sizing: border-box;
}

/* Стили для inline кода */
:deep(.markdown-content code:not(pre code)) {
  font-family: monospace;
  background: #f0f0f0;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

:deep(pre) {
  padding: 10px;
  background-color: #444;
  color: #fff;
}

/* Стили для блоков кода */
:deep(.markdown-content pre code) {
  display: block;
  white-space: pre;
  overflow-x: auto;
  line-height: 1.5;
  font-family: 'Courier New', Courier, monospace;

  /* Важно для правильного отображения */
  width: 100%;
  box-sizing: border-box;
}

/* Стили для скроллбара (опционально) */
:deep(.markdown-content pre)::-webkit-scrollbar {
  height: 6px;
}

:deep(.markdown-content pre)::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

/* ... остальные стили языков ... */
</style>
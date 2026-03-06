/**
 * Chat Agent Service
 * Provides Claude-like agent capabilities:
 * - Web search
 * - Code generation and execution
 * - Dependency installation
 * - File operations in sandbox
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api';

/**
 * Perform web search
 * @param {string} query - Search query
 * @returns {Promise<Object>} Search results
 */
export async function searchWeb(query) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Search failed');
  }

  return response.json();
}

/**
 * Execute code in sandbox
 * @param {string} code - Code to execute
 * @param {string} language - Programming language (javascript, python, bash, html, css)
 * @param {string} [filename] - Optional filename
 * @returns {Promise<Object>} Execution result with output, error, execId
 */
export async function executeCode(code, language, filename = null) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, language, filename }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Execution failed');
  }

  return response.json();
}

/**
 * Install dependencies in sandbox
 * @param {Array<string>} dependencies - List of dependencies to install
 * @param {string} language - Language (javascript or python)
 * @returns {Promise<Object>} Installation result
 */
export async function installDependencies(dependencies, language) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/install-dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dependencies, language }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Installation failed');
  }

  return response.json();
}

/**
 * Get sandbox info (list files)
 * @param {string} execId - Execution ID
 * @returns {Promise<Object>} Sandbox info with file list
 */
export async function getSandboxInfo(execId) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/sandbox/${execId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get sandbox info');
  }

  return response.json();
}

/**
 * Get file from sandbox
 * @param {string} execId - Execution ID
 * @param {string} filename - Filename to retrieve
 * @returns {Promise<Object>} File content
 */
export async function getSandboxFile(execId, filename) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/sandbox/${execId}/${filename}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get file');
  }

  return response.json();
}

/**
 * Clean up sandbox
 * @param {string} execId - Execution ID
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupSandbox(execId) {
  const response = await fetch(`${API_BASE_URL}/chat-agent/sandbox/${execId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Cleanup failed');
  }

  return response.json();
}

/**
 * Extract code blocks from markdown text
 * @param {string} text - Markdown text
 * @returns {Array<Object>} Array of code blocks with language and code
 */
export function extractCodeBlocks(text) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * Check if message contains executable code
 * @param {string} text - Message text
 * @returns {boolean} True if message contains code blocks
 */
export function hasExecutableCode(text) {
  const blocks = extractCodeBlocks(text);
  const executableLanguages = ['javascript', 'python', 'bash', 'html', 'css'];

  return blocks.some(block => executableLanguages.includes(block.language.toLowerCase()));
}

/**
 * Format search results for display
 * @param {Object} results - Search results from searchWeb()
 * @returns {string} Formatted markdown text
 */
export function formatSearchResults(results) {
  let formatted = `# Результаты поиска: ${results.query}\n\n`;

  if (results.abstract) {
    formatted += `**${results.abstractSource}**\n\n`;
    formatted += `${results.abstract}\n\n`;
    if (results.abstractURL) {
      formatted += `[Подробнее](${results.abstractURL})\n\n`;
    }
  }

  if (results.relatedTopics && results.relatedTopics.length > 0) {
    formatted += `## Связанные темы\n\n`;
    results.relatedTopics.forEach(topic => {
      if (topic.text && topic.url) {
        formatted += `- [${topic.text}](${topic.url})\n`;
      }
    });
    formatted += '\n';
  }

  if (results.results && results.results.length > 0) {
    formatted += `## Результаты\n\n`;
    results.results.forEach((result, index) => {
      // Support both DuckDuckGo format (title, url, snippet) and old format (Text, FirstURL)
      const title = result.title || result.Text || 'Результат';
      const url = result.url || result.FirstURL;
      const snippet = result.snippet || '';

      // Title as hyperlink
      if (url) {
        formatted += `${index + 1}. [**${title}**](${url})\n`;
      } else {
        formatted += `${index + 1}. **${title}**\n`;
      }
      if (snippet) {
        formatted += `   ${snippet}\n`;
      }
      formatted += '\n';
    });
  }

  return formatted;
}

/**
 * Review code using Kodus AI
 * @param {string} code - Code to review
 * @param {string} language - Programming language
 * @param {Array<string>} [policies] - Review policies
 * @param {string} [context] - Additional context
 * @returns {Promise<Object>} Review result
 */
export async function reviewCode(code, language = 'auto', policies = ['security', 'best-practices'], context = '') {
  const response = await fetch(`${API_BASE_URL}/chat-agent/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, language, policies, context }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Code review failed');
  }

  return response.json();
}

/**
 * Generate system prompt for agent with tools
 * @returns {string} System prompt
 */
export function getAgentSystemPrompt() {
  return `Ты - ИИ-ассистент DronDoc с расширенными возможностями агента, подобно Claude Code.

**Твои возможности:**

1. **Поиск в интернете**: Ты можешь искать информацию в интернете по запросу пользователя.

2. **Генерация кода**: Ты можешь генерировать код на разных языках программирования (JavaScript, Python, Bash, HTML, CSS).

3. **Выполнение кода**: Ты можешь выполнять сгенерированный код в изолированной среде и показывать результаты пользователю.

4. **Установка зависимостей**: Ты можешь устанавливать npm пакеты для JavaScript или pip пакеты для Python.

5. **Работа с файлами**: Ты можешь создавать, читать и управлять файлами в песочнице.

6. **Code Review с Kodus AI**: Ты можешь анализировать код на безопасность, производительность и соответствие best practices. Автоматически находишь уязвимости (SQL injection, XSS), проблемы производительности (N+1 queries, memory leaks) и нарушения code style.

**Как использовать инструменты:**

- Когда пользователь просит найти информацию в интернете, используй функцию поиска.
- Когда генерируешь код, оборачивай его в блоки кода с указанием языка: \`\`\`javascript\n...\n\`\`\`
- После генерации кода, спрашивай пользователя, хочет ли он выполнить этот код.
- Если код требует внешних библиотек, предупреди пользователя и предложи установить зависимости.
- Для HTML/CSS кода предложи открыть превью в отдельном окне.
- Когда пользователь отправляет блок кода или просит проверить код, автоматически запускай code review через Kodus AI и показывай результаты с категоризацией проблем по severity (critical, high, medium, low, info).

**Важные правила:**

- Всегда объясняй, что делает твой код
- Предупреждай о потенциальных рисках перед выполнением кода
- Не выполняй деструктивные операции без явного подтверждения пользователя
- Если код завершился с ошибкой, помоги пользователю исправить её
- При code review выделяй критические проблемы безопасности красным цветом

Работай пошагово, объясняй свои действия и будь helpful!`;
}

export default {
  searchWeb,
  executeCode,
  installDependencies,
  getSandboxInfo,
  getSandboxFile,
  cleanupSandbox,
  extractCodeBlocks,
  hasExecutableCode,
  formatSearchResults,
  reviewCode,
  getAgentSystemPrompt,
};

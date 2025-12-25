/**
 * Torgi.gov.ru Document Parser using Playwright
 *
 * Парсит документы со страниц лотов torgi.gov.ru с использованием Playwright MCP.
 * Извлекает информацию о документах непосредственно из HTML страницы.
 *
 * Example URLs:
 * - https://torgi.gov.ru/new/public/lots/lot/22000010600000000293_6/(lotInfo:docs)#lotInfoSection-docs
 * - https://dronedoc.ru/torgi/object/561/?F_U=2555
 */

/**
 * Извлечение ID лота из URL
 * @param {string} url - URL лота
 * @returns {string|null} ID лота
 */
export function extractLotId(url) {
  const patterns = [
    /lot\/([^\/\(]+)/,  // lot/22000010600000000293_6
    /lots\/([^\/\(]+)/,
    /lotId=([^&]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Парсинг документов со страницы лота с использованием Playwright MCP
 * @param {Object} playwrightMCP - Playwright MCP client
 * @param {string} lotUrl - URL страницы лота
 * @returns {Promise<Object>} Результат парсинга
 */
export async function parseDocumentsFromPage(playwrightMCP, lotUrl) {
  try {
    console.log(`[PlaywrightDocParser] Парсинг документов с ${lotUrl}`)

    // Извлекаем ID лота
    const lotId = extractLotId(lotUrl)
    if (!lotId) {
      throw new Error('Не удалось извлечь ID лота из URL')
    }

    // Навигация на страницу лота
    await playwrightMCP.browser_navigate({ url: lotUrl })

    // Ждём загрузки страницы (документы могут подгружаться динамически)
    await playwrightMCP.browser_wait_for({ time: 3 })

    // Получаем snapshot страницы для анализа
    const snapshot = await playwrightMCP.browser_snapshot()

    // Извлекаем документы из snapshot
    const documents = extractDocumentsFromSnapshot(snapshot)

    console.log(`[PlaywrightDocParser] Найдено ${documents.length} документов для лота ${lotId}`)

    return {
      success: true,
      lotId,
      lotUrl,
      documentsCount: documents.length,
      documents
    }
  } catch (error) {
    console.error(`[PlaywrightDocParser] Ошибка парсинга: ${error.message}`)
    return {
      success: false,
      error: error.message,
      documents: []
    }
  }
}

/**
 * Извлечение документов из accessibility snapshot
 * @param {Object} snapshot - Accessibility snapshot от Playwright
 * @returns {Array} Массив документов
 */
function extractDocumentsFromSnapshot(snapshot) {
  const documents = []

  if (!snapshot || !snapshot.children) {
    return documents
  }

  // Рекурсивно ищем элементы с документами
  function traverse(node) {
    if (!node) return

    // Проверяем, является ли узел ссылкой на документ
    if (isDocumentLink(node)) {
      const doc = extractDocumentInfo(node)
      if (doc) {
        documents.push(doc)
      }
    }

    // Рекурсивно обходим детей
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(snapshot)
  return documents
}

/**
 * Проверка, является ли узел ссылкой на документ
 * @param {Object} node - Узел accessibility tree
 * @returns {boolean}
 */
function isDocumentLink(node) {
  if (!node) return false

  // Проверяем роль элемента
  if (node.role === 'link') {
    const name = (node.name || '').toLowerCase()
    const value = (node.value || '').toLowerCase()

    // Ищем признаки документа в тексте ссылки
    const docIndicators = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.zip', '.rar', '.7z',
      'скачать', 'загрузить', 'документ', 'файл',
      'download', 'file', 'document'
    ]

    for (const indicator of docIndicators) {
      if (name.includes(indicator) || value.includes(indicator)) {
        return true
      }
    }
  }

  return false
}

/**
 * Извлечение информации о документе из узла
 * @param {Object} node - Узел accessibility tree
 * @returns {Object|null} Информация о документе
 */
function extractDocumentInfo(node) {
  if (!node) return null

  try {
    // Название документа
    const name = node.name || 'Документ'

    // URL документа (может быть в value или в атрибутах)
    let url = node.value || ''

    // Если URL относительный, делаем абсолютным
    if (url && !url.startsWith('http')) {
      url = `https://torgi.gov.ru${url.startsWith('/') ? '' : '/'}${url}`
    }

    // Пытаемся определить размер файла из текста
    const sizeMatch = name.match(/\(([^)]+)\)/)
    const size = sizeMatch ? sizeMatch[1] : null

    // Определяем тип документа по расширению или названию
    const type = detectDocumentType(name, url)

    return {
      name: name.trim(),
      url: url.trim(),
      size,
      type,
      downloadUrl: url.trim()
    }
  } catch (error) {
    console.error(`[PlaywrightDocParser] Ошибка извлечения информации о документе: ${error.message}`)
    return null
  }
}

/**
 * Определение типа документа
 * @param {string} name - Название документа
 * @param {string} url - URL документа
 * @returns {string} Тип документа
 */
function detectDocumentType(name, url) {
  const text = `${name} ${url}`.toLowerCase()

  // Проверяем по ключевым словам
  if (text.includes('форма заявки') || text.includes('заявка')) {
    return 'форма заявки'
  }
  if (text.includes('документация') || text.includes('аукционная')) {
    return 'документация аукциона'
  }
  if (text.includes('договор') || text.includes('проект договора')) {
    return 'проект договора'
  }
  if (text.includes('извещение')) {
    return 'извещение о торгах'
  }
  if (text.includes('протокол')) {
    return 'протокол'
  }
  if (text.includes('разъяснени')) {
    return 'разъяснение'
  }
  if (text.includes('егрн') || text.includes('выписка')) {
    return 'егрн'
  }

  // По расширению файла
  if (text.includes('.pdf')) return 'документация аукциона'
  if (text.includes('.doc')) return 'форма заявки'
  if (text.includes('.xls')) return 'форма заявки'
  if (text.includes('.zip') || text.includes('.rar')) return 'документация аукциона'

  return 'иное'
}

/**
 * Альтернативный метод: парсинг документов через JavaScript evaluation
 * Используется если accessibility snapshot не содержит нужной информации
 * @param {Object} playwrightMCP - Playwright MCP client
 * @returns {Promise<Array>} Массив документов
 */
export async function parseDocumentsViaEval(playwrightMCP) {
  try {
    const evalResult = await playwrightMCP.browser_evaluate({
      function: `() => {
        const documents = [];

        // Ищем все ссылки на документы
        const links = document.querySelectorAll('a[href*="download"], a[href*=".pdf"], a[href*=".doc"], a.document-link, .file-link a');

        links.forEach(link => {
          const name = link.textContent.trim() || link.getAttribute('title') || 'Документ';
          const url = link.href;

          // Ищем размер файла рядом
          const sizeElement = link.closest('.file-item, .document-item')?.querySelector('.file-size, .size');
          const size = sizeElement ? sizeElement.textContent.trim() : null;

          // Ищем тип документа
          const typeElement = link.closest('.file-item, .document-item')?.querySelector('.file-type, .type');
          const type = typeElement ? typeElement.textContent.trim() : null;

          documents.push({ name, url, size, type });
        });

        return documents;
      }`
    })

    return evalResult || []
  } catch (error) {
    console.error(`[PlaywrightDocParser] Ошибка eval: ${error.message}`)
    return []
  }
}

/**
 * Парсинг документов с автоматическим выбором метода
 * @param {Object} playwrightMCP - Playwright MCP client
 * @param {string} lotUrl - URL страницы лота
 * @returns {Promise<Object>} Результат парсинга
 */
export async function parseDocumentsAuto(playwrightMCP, lotUrl) {
  // Сначала пробуем через snapshot
  const snapshotResult = await parseDocumentsFromPage(playwrightMCP, lotUrl)

  // Если нашли документы, возвращаем результат
  if (snapshotResult.success && snapshotResult.documents.length > 0) {
    return snapshotResult
  }

  // Если не нашли, пробуем через eval
  console.log('[PlaywrightDocParser] Snapshot не дал результатов, пробуем eval')
  const evalDocs = await parseDocumentsViaEval(playwrightMCP)

  return {
    success: evalDocs.length > 0,
    lotId: extractLotId(lotUrl),
    lotUrl,
    documentsCount: evalDocs.length,
    documents: evalDocs,
    method: 'eval'
  }
}

export default {
  parseDocumentsFromPage,
  parseDocumentsViaEval,
  parseDocumentsAuto,
  extractLotId
}

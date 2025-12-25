/**
 * Description Parser for Torgi Lots
 *
 * Parses structured data from the lot description text field
 * Extracts: cadastral number, area, permitted use, ownership form, restrictions, etc.
 */

/**
 * Extract cadastral number from description text
 * Patterns:
 * - "кадастровым номером 64:32:023644:496"
 * - "кадастровый номер 63:12:1003021:733"
 * - "с кадастровым номером 52:48:1200021:699"
 * - "кадастровому номеру 18:30:000497:311"
 *
 * @param {string} description - Lot description text
 * @returns {string|null} - Cadastral number or null if not found
 */
export function extractCadastralNumber(description) {
  if (!description) return null

  // Pattern: XX:XX:XXXXXX:XXX (cadastral number format)
  // Match: кадастровый номер / кадастровым номером / кадастровому номеру + number
  const patterns = [
    /кадастров[а-я]*\s+номер[а-я]*\s+(\d{1,2}:\d{1,2}:\d{4,7}:\d{1,5})/i,
    /кадастр[а-я]*\.\s*№?\s*(\d{1,2}:\d{1,2}:\d{1,7}:\d{1,5})/i,
    /\bкад\.\s*№?\s*(\d{1,2}:\d{1,2}:\d{1,7}:\d{1,5})/i,
    // Standalone cadastral number (if no keywords nearby)
    /\b(\d{1,2}:\d{1,2}:\d{4,7}:\d{1,5})\b/
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Extract area (square meters) from description text
 * Patterns:
 * - "площадью 1168 кв. м"
 * - "площадь 3243 кв.м"
 * - "Общая площадь объекта: 14,5 кв. м"
 * - "площадью 308 кв.м"
 * - "площадью 1375 кв.м."
 *
 * @param {string} description - Lot description text
 * @returns {number|null} - Area in square meters or null if not found
 */
export function extractArea(description) {
  if (!description) return null

  // Pattern: площадь[ь]ю / площадь + number + кв.м / м2 / кв м
  const patterns = [
    /площад[ь]?ю?\s+[:\s]*(\d+[\s,.]?\d*)\s*кв\.?\s*м\.?/i,
    /площад[ь]?ю?\s+[:\s]*(\d+[\s,.]?\d*)\s*м[²2]/i,
    /общая\s+площадь[^\d]*(\d+[\s,.]?\d*)\s*кв\.?\s*м\.?/i,
    /(\d+[\s,.]?\d*)\s*кв\.?\s*м\.?\s*площад/i
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      // Convert comma to dot and remove spaces
      const areaStr = match[1].replace(',', '.').replace(/\s/g, '')
      const area = parseFloat(areaStr)
      if (!isNaN(area) && area > 0) {
        return area
      }
    }
  }

  return null
}

/**
 * Extract permitted use (вид разрешенного использования) from description
 * Patterns:
 * - "разрешенное использование: ведение садоводства"
 * - "для индивидуального жилищного строительства"
 * - "вид разрешённого использования: ..."
 *
 * @param {string} description - Lot description text
 * @returns {string|null} - Permitted use or null if not found
 */
export function extractPermittedUse(description) {
  if (!description) return null

  const patterns = [
    /разрешен[а-я]*\s+использован[а-я]*[:\s]+([^.,;]+)/i,
    /вид\s+разрешен[а-я]*\s+использован[а-я]*[:\s]+([^.,;]+)/i,
    /целевое\s+назначение[:\s]+([^.,;]+)/i,
    /для\s+(индивидуального\s+жилищного\s+строительства|ведения\s+садоводства|[а-яё\s]+строительства)/i
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      let use = match[1].trim()
      // Limit to reasonable length and clean up
      if (use.length > 200) {
        use = use.substring(0, 200)
      }
      return use
    }
  }

  return null
}

/**
 * Extract ownership form (форма собственности) from description
 * Patterns:
 * - "государственная собственность"
 * - "муниципальная собственность"
 * - "частная собственность"
 *
 * @param {string} description - Lot description text
 * @returns {string|null} - Ownership form or null if not found
 */
export function extractOwnershipForm(description) {
  if (!description) return null

  const patterns = [
    /(государственная|муниципальная|частная|федеральная)\s+собственность/i,
    /форма\s+собственности[:\s]+([а-яё\s]+)/i,
    /собственность[:\s]+([а-яё\s]+)/i
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      let form = match[1].trim()
      // Capitalize first letter
      form = form.charAt(0).toUpperCase() + form.slice(1).toLowerCase()
      if (form.length > 100) {
        form = form.substring(0, 100)
      }
      return form
    }
  }

  return null
}

/**
 * Extract restrictions (ограничения прав) from description
 * Patterns:
 * - "Земельный участок частично расположен в зоне с особыми условиями..."
 * - "ограничения прав: ..."
 * - "обременения: ..."
 *
 * @param {string} description - Lot description text
 * @returns {string|null} - Restrictions or null if not found
 */
export function extractRestrictions(description) {
  if (!description) return null

  const patterns = [
    /ограничен[а-я]*\s+прав[а-я]*[:\s]+([^.]+\.)/i,
    /обременен[а-я]*[:\s]+([^.]+\.)/i,
    /зон[аы]\s+с\s+особыми\s+условиями[^.]+\./i,
    /водоохранная\s+зона[^.]+\./i,
    /санитарно-защитная\s+зона[^.]+\./i
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      let restriction = match[1] || match[0]
      restriction = restriction.trim()
      if (restriction.length > 500) {
        restriction = restriction.substring(0, 500)
      }
      return restriction
    }
  }

  return null
}

/**
 * Extract VIN number for vehicles
 * Pattern: VIN XXXXXXXXXXXXXXXXX (17 characters)
 *
 * @param {string} description - Lot description text
 * @returns {string|null} - VIN number or null if not found
 */
export function extractVIN(description) {
  if (!description) return null

  const pattern = /VIN\s+([A-Z0-9]{17})/i
  const match = description.match(pattern)

  if (match && match[1]) {
    return match[1].toUpperCase()
  }

  return null
}

/**
 * Extract year for vehicles
 * Patterns:
 * - "2010г"
 * - "1995 г.в."
 * - "2018г.в."
 *
 * @param {string} description - Lot description text
 * @returns {number|null} - Year or null if not found
 */
export function extractYear(description) {
  if (!description) return null

  const patterns = [
    /(\d{4})\s*г\.?в\.?/i,
    /(\d{4})\s*г[,.\s]/i,  // Match "2010г," or "2010г." or "2010г "
    /(\d{4})\s*год[а]?\s+(выпуска|постройки)/i,
    /год\s+постройки\s+[–—-]\s+(\d{4})/i
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      const year = parseInt(match[1])
      // Validate year is reasonable (between 1900 and current year + 2)
      const currentYear = new Date().getFullYear()
      if (year >= 1900 && year <= currentYear + 2) {
        return year
      }
    }
  }

  return null
}

/**
 * Parse all structured data from description
 *
 * @param {string} description - Lot description text
 * @returns {Object} - Extracted data object with all found fields
 */
export function parseDescription(description) {
  if (!description) {
    return {}
  }

  const result = {}

  // Extract cadastral number
  const cadastralNumber = extractCadastralNumber(description)
  if (cadastralNumber) {
    result.cadastralNumber = cadastralNumber
  }

  // Extract area
  const area = extractArea(description)
  if (area !== null) {
    result.area = area
  }

  // Extract permitted use
  const permittedUse = extractPermittedUse(description)
  if (permittedUse) {
    result.permittedUse = permittedUse
  }

  // Extract ownership form
  const ownershipForm = extractOwnershipForm(description)
  if (ownershipForm) {
    result.ownershipForm = ownershipForm
  }

  // Extract restrictions
  const restrictions = extractRestrictions(description)
  if (restrictions) {
    result.restrictions = restrictions
  }

  // Extract VIN (for vehicles)
  const vin = extractVIN(description)
  if (vin) {
    result.vin = vin
  }

  // Extract year
  const year = extractYear(description)
  if (year) {
    result.year = year
  }

  return result
}

/**
 * Generate a summary of what was extracted
 *
 * @param {Object} parsedData - Result from parseDescription()
 * @returns {string} - Human-readable summary
 */
export function generateParsingSummary(parsedData) {
  const items = []

  if (parsedData.cadastralNumber) {
    items.push(`Кадастровый номер: ${parsedData.cadastralNumber}`)
  }
  if (parsedData.area) {
    items.push(`Площадь: ${parsedData.area} м²`)
  }
  if (parsedData.permittedUse) {
    items.push(`Разрешённое использование: ${parsedData.permittedUse}`)
  }
  if (parsedData.ownershipForm) {
    items.push(`Форма собственности: ${parsedData.ownershipForm}`)
  }
  if (parsedData.restrictions) {
    items.push(`Ограничения: ${parsedData.restrictions}`)
  }
  if (parsedData.vin) {
    items.push(`VIN: ${parsedData.vin}`)
  }
  if (parsedData.year) {
    items.push(`Год: ${parsedData.year}`)
  }

  return items.length > 0
    ? items.join('\n')
    : 'Структурированные данные не найдены'
}

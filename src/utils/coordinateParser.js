/**
 * Coordinate parsing utility for Integram map data.
 *
 * Supports formats:
 *   - Decimal degrees: "55.7558", "37.6173"
 *   - DMS (Degrees Minutes Seconds): 56°04'40.10"С.Ш., 107°40'38.50" В.Д.
 *   - DMS with СК-42 suffix: 107°40'38.50" В.Д. (СК-42)
 *   - Compact DMS: 56°04'40.10"N, 107°40'38.50"E
 *   - Numbers with comma decimal separator: "55,7558"
 */

/**
 * Parse a DMS (Degrees Minutes Seconds) string to decimal degrees.
 * Handles formats like:
 *   56°04'40.10"С.Ш.
 *   107°40'38.50" В.Д. (СК-42)
 *   56°04'40.10"N
 *   107°40'38.50"E
 *
 * @param {string} dmsStr - DMS string
 * @returns {number|null} - Decimal degrees or null if unparseable
 */
export function parseDMS(dmsStr) {
  if (!dmsStr || typeof dmsStr !== 'string') return null

  const str = dmsStr.trim()

  // Match pattern: degrees°minutes'seconds"[direction]
  // Examples: 56°04'40.10"С.Ш.  /  107°40'38.50" В.Д. (СК-42)  /  56°04'40.10"N
  const dmsRegex = /(\d+)[°]\s*(\d+)[''′]\s*([\d.,]+)[""″]?\s*(.*)/
  const match = str.match(dmsRegex)

  if (!match) return null

  const degrees = parseFloat(match[1])
  const minutes = parseFloat(match[2])
  const seconds = parseFloat(match[3].replace(',', '.'))
  const directionStr = match[4].trim()

  let decimal = degrees + minutes / 60 + seconds / 3600

  // Determine if negative (South or West)
  const isNegative = /[SWЮЗюз]|З\.Д\.|З\.д\.|з\.д\.|Ю\.Ш\.|Ю\.ш\.|ю\.ш\./.test(directionStr)
  if (isNegative) {
    decimal = -decimal
  }

  return decimal
}

/**
 * Try to parse a coordinate value from various formats.
 *
 * @param {string|number} value - Coordinate value in any supported format
 * @returns {number|null} - Decimal degrees or null
 */
export function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return null

  // Already a number
  if (typeof value === 'number') {
    return isFinite(value) ? value : null
  }

  const str = String(value).trim()
  if (!str) return null

  // Try decimal (with dot or comma)
  const decimalStr = str.replace(',', '.')
  const num = parseFloat(decimalStr)
  if (!isNaN(num) && isFinite(num) && /^-?\d+([.,]\d+)?$/.test(str.replace(/\s/g, ''))) {
    return num
  }

  // Try DMS format
  const dms = parseDMS(str)
  if (dms !== null) return dms

  // Try extracting just a number from the string
  const numMatch = str.match(/(-?\d+[.,]?\d*)/)
  if (numMatch) {
    const extracted = parseFloat(numMatch[1].replace(',', '.'))
    // Only return if it contains degree symbol (likely DMS was already tried)
    // or if the number looks like a valid coordinate
    if (!isNaN(extracted) && isFinite(extracted) && Math.abs(extracted) <= 180) {
      return extracted
    }
  }

  return null
}

/**
 * Parse a pair of coordinate values into { lat, lng }.
 *
 * @param {string|number} latValue - Latitude value
 * @param {string|number} lngValue - Longitude value
 * @returns {{ lat: number, lng: number }|null}
 */
export function parseCoordinatePair(latValue, lngValue) {
  const lat = parseCoordinate(latValue)
  const lng = parseCoordinate(lngValue)

  if (lat === null || lng === null) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  return { lat, lng }
}

/**
 * Auto-detect coordinate format from a sample value.
 *
 * @param {string} value - Sample coordinate value
 * @returns {'decimal'|'dms'|'unknown'}
 */
export function detectCoordinateFormat(value) {
  if (!value || typeof value !== 'string') return 'unknown'

  const str = value.trim()

  // Check for degree symbol → DMS
  if (/°/.test(str)) return 'dms'

  // Check for decimal number
  const decimalStr = str.replace(',', '.')
  if (!isNaN(parseFloat(decimalStr)) && /^-?\d+([.,]\d+)?$/.test(str.replace(/\s/g, ''))) {
    return 'decimal'
  }

  return 'unknown'
}

/**
 * Convert Web Mercator (EPSG:3857) coordinates to WGS-84 (EPSG:4326).
 *
 * Used for converting PKK Rosreestr cadastral boundaries which use Web Mercator projection.
 *
 * @param {number} x - X coordinate (easting) in meters
 * @param {number} y - Y coordinate (northing) in meters
 * @returns {{ lat: number, lng: number }} - Coordinates in decimal degrees
 */
export function webMercatorToWgs84(x, y) {
  const lng = (x * 180) / 20037508.34
  const lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90
  return { lat, lng }
}

/**
 * Utility for lazy loading XLSX library
 *
 * Issue #4324: XLSX is a heavy library (~1.2MB minified) that's not needed on all pages.
 * This utility ensures it's only loaded when actually needed (e.g., when exporting to Excel).
 *
 * Usage in components:
 * ```js
 * import { loadXLSX } from '@/utils/lazyLoadXLSX'
 *
 * async function exportToExcel() {
 *   const XLSX = await loadXLSX()
 *   // Use XLSX here
 * }
 * ```
 */

let xlsxModule = null

/**
 * Lazy load XLSX library (singleton pattern - loads only once)
 * @returns {Promise<Object>} XLSX module
 */
export async function loadXLSX() {
  if (!xlsxModule) {
    xlsxModule = await import('xlsx')
  }
  return xlsxModule
}

/**
 * Helper: Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Output filename
 * @param {string} sheetName - Sheet name (default: 'Data')
 */
export async function exportToExcel(data, filename = 'export.xlsx', sheetName = 'Data') {
  const XLSX = await loadXLSX()

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

/**
 * Helper: Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Output filename
 */
export async function exportToCSV(data, filename = 'export.csv') {
  const XLSX = await loadXLSX()

  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })

  // Download
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Helper: Parse Excel/CSV file to JSON
 * @param {File} file - File to parse
 * @returns {Promise<Array>} Parsed data as array of objects
 */
export async function parseExcelFile(file) {
  const XLSX = await loadXLSX()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target.result
        const workbook = XLSX.read(data, {
          type: file.name.endsWith('.csv') ? 'string' : 'binary'
        })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = (error) => reject(error)

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsBinaryString(file)
    }
  })
}

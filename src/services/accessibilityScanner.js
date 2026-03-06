/**
 * Accessibility Scanner Service
 * Scans Vue.js components for WCAG 2.1 AA compliance issues
 *
 * NOTE: File system operations have been disabled for browser build.
 * These should be moved to a backend service.
 */

// Disabled Node.js imports for browser build
// import { promises as fs } from 'fs'
// import path from 'path'

// WCAG rules definitions
const WCAG_RULES = {
  MISSING_LABEL: {
    id: '1.3.1',
    title: 'Info and Relationships',
    level: 'A',
    category: 'forms'
  },
  MISSING_ALT_TEXT: {
    id: '1.1.1',
    title: 'Non-text Content',
    level: 'A',
    category: 'images'
  },
  MISSING_ARIA_DESCRIBEDBY: {
    id: '3.3.1',
    title: 'Error Identification',
    level: 'A',
    category: 'forms'
  },
  MISSING_ARIA_REQUIRED: {
    id: '3.3.2',
    title: 'Labels or Instructions',
    level: 'A',
    category: 'forms'
  },
  MISSING_ARIA_INVALID: {
    id: '3.3.1',
    title: 'Error Identification',
    level: 'A',
    category: 'forms'
  },
  MISSING_ROLE_ALERT: {
    id: '4.1.3',
    title: 'Status Messages',
    level: 'AA',
    category: 'forms'
  },
  MISSING_DIALOG_ARIA: {
    id: '4.1.2',
    title: 'Name, Role, Value',
    level: 'A',
    category: 'modals'
  },
  MISSING_KEYBOARD_SUPPORT: {
    id: '2.1.1',
    title: 'Keyboard',
    level: 'A',
    category: 'keyboard'
  }
}

/**
 * Scan Vue.js codebase for accessibility issues
 * @param {Function} progressCallback - Callback for progress updates (progress, status)
 * @returns {Promise<Object>} Scan results with issues and summary
 */
/**
 * Scan for accessibility issues
 * NOTE: This function requires backend implementation with file system access
 */
export async function scanForAccessibilityIssues(progressCallback) {
  if (progressCallback) {
    progressCallback(0, 'Initializing scan...')
  }

  // Return empty results since file system operations are disabled in browser builds
  // This functionality should be moved to a backend API endpoint
  const results = {
    issues: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      passed: 0,
      totalComponents: 0,
      componentsWithAria: 0,
      ariaCoverage: 0
    },
    error: 'Accessibility scanning requires backend implementation. This feature is currently disabled in browser builds.'
  }

  if (progressCallback) {
    progressCallback(100, 'Scan disabled (requires backend)')
  }

  return results
}

/**
 * Find all Vue files in directory recursively
 * @param {string} dir - Directory to search
 * @returns {Promise<Array<string>>} List of Vue file paths
 */
async function findVueFiles(dir) {
  const files = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          await walk(fullPath)
        }
      } else if (entry.isFile() && entry.name.endsWith('.vue')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files
}

/**
 * Check if Vue file has ARIA attributes
 * @param {string} filePath - Path to Vue file
 * @returns {Promise<boolean>} True if has ARIA attributes
 */
async function hasAriaAttributes(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const ariaPattern = /aria-[\w-]+=/gi
    return ariaPattern.test(content)
  } catch (error) {
    console.error(`Error checking ARIA in ${filePath}:`, error)
    return false
  }
}

/**
 * Scan a single Vue file for accessibility issues
 * @param {string} filePath - Path to Vue file
 * @returns {Promise<Array>} List of issues found
 */
async function scanVueFile(filePath) {
  const issues = []

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const componentName = path.relative('/tmp/gh-issue-solver-1765207893645/src', filePath)

    // Check for form inputs without labels
    const formIssues = checkFormAccessibility(lines, componentName)
    issues.push(...formIssues)

    // Check for images without alt text
    const imageIssues = checkImageAccessibility(lines, componentName)
    issues.push(...imageIssues)

    // Check for modals/dialogs
    const modalIssues = checkModalAccessibility(lines, componentName)
    issues.push(...modalIssues)

    // Check for error messages
    const errorIssues = checkErrorMessages(lines, componentName)
    issues.push(...errorIssues)

  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error)
  }

  return issues
}

/**
 * Check form accessibility
 * @param {Array<string>} lines - File lines
 * @param {string} componentName - Component name
 * @returns {Array} Form accessibility issues
 */
function checkFormAccessibility(lines, componentName) {
  const issues = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for InputText, Dropdown, Textarea without aria-describedby
    if (/<(InputText|Dropdown|Textarea|Calendar)\b/.test(line)) {
      if (!line.includes('aria-describedby') && !line.includes('aria-label')) {
        issues.push({
          id: `${componentName}-${lineNumber}-aria-describedby`,
          component: componentName,
          line: lineNumber,
          severity: 'high',
          category: 'forms',
          issue: 'Form input missing aria-describedby or aria-label',
          wcag: WCAG_RULES.MISSING_ARIA_DESCRIBEDBY.id,
          wcagTitle: WCAG_RULES.MISSING_ARIA_DESCRIBEDBY.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' aria-describedby="field-description" />'),
          explanation: 'Form inputs should have aria-describedby pointing to error messages or help text, or aria-label for screen readers.',
          autoFixable: true
        })
      }

      // Check for missing aria-required
      if (!line.includes('aria-required') && !line.includes('required')) {
        issues.push({
          id: `${componentName}-${lineNumber}-aria-required`,
          component: componentName,
          line: lineNumber,
          severity: 'medium',
          category: 'forms',
          issue: 'Required form input missing aria-required attribute',
          wcag: WCAG_RULES.MISSING_ARIA_REQUIRED.id,
          wcagTitle: WCAG_RULES.MISSING_ARIA_REQUIRED.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' aria-required="true" />'),
          explanation: 'Required form fields should have aria-required="true" to inform screen reader users.',
          autoFixable: true
        })
      }

      // Check for missing aria-invalid
      if (!line.includes('aria-invalid')) {
        issues.push({
          id: `${componentName}-${lineNumber}-aria-invalid`,
          component: componentName,
          line: lineNumber,
          severity: 'medium',
          category: 'forms',
          issue: 'Form input missing aria-invalid attribute',
          wcag: WCAG_RULES.MISSING_ARIA_INVALID.id,
          wcagTitle: WCAG_RULES.MISSING_ARIA_INVALID.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' :aria-invalid="!!errors.field" />'),
          explanation: 'Form inputs should have aria-invalid to indicate validation state to screen readers.',
          autoFixable: true
        })
      }
    }

    // Check for form fields without labels
    if (/<(InputText|Dropdown|Textarea|Calendar)\b/.test(line) && line.includes('id=')) {
      const nextFewLines = lines.slice(Math.max(0, i - 3), i).join('\n')
      if (!nextFewLines.includes('<label') && !nextFewLines.includes('aria-label')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-label`,
          component: componentName,
          line: lineNumber,
          severity: 'critical',
          category: 'forms',
          issue: 'Form input missing associated <label> element',
          wcag: WCAG_RULES.MISSING_LABEL.id,
          wcagTitle: WCAG_RULES.MISSING_LABEL.title,
          currentCode: line.trim(),
          suggestedFix: `<label for="field-id">Field Label</label>\n${line.trim()}`,
          explanation: 'Every form input must have an associated <label> element with matching "for" attribute, or an aria-label.',
          autoFixable: false
        })
      }
    }
  }

  return issues
}

/**
 * Check image accessibility
 * @param {Array<string>} lines - File lines
 * @param {string} componentName - Component name
 * @returns {Array} Image accessibility issues
 */
function checkImageAccessibility(lines, componentName) {
  const issues = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for <img> without alt attribute
    if (/<img\b/.test(line)) {
      if (!line.includes('alt=') && !line.includes(':alt=')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-alt`,
          component: componentName,
          line: lineNumber,
          severity: 'critical',
          category: 'images',
          issue: 'Image missing alt attribute',
          wcag: WCAG_RULES.MISSING_ALT_TEXT.id,
          wcagTitle: WCAG_RULES.MISSING_ALT_TEXT.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/<img/, '<img alt="Image description"'),
          explanation: 'All images must have an alt attribute. Use empty alt="" for decorative images, or descriptive text for meaningful images.',
          autoFixable: false
        })
      }
    }

    // Check for Avatar, Image components without alt
    if (/<(Avatar|Image)\b/.test(line) && !line.includes('alt=') && !line.includes(':alt=')) {
      issues.push({
        id: `${componentName}-${lineNumber}-component-missing-alt`,
        component: componentName,
        line: lineNumber,
        severity: 'high',
        category: 'images',
        issue: 'Image component missing alt attribute',
        wcag: WCAG_RULES.MISSING_ALT_TEXT.id,
        wcagTitle: WCAG_RULES.MISSING_ALT_TEXT.title,
        currentCode: line.trim(),
        suggestedFix: line.trim().replace(/\/>/, ' alt="Image description" />'),
        explanation: 'Image components must have an alt attribute for screen readers.',
        autoFixable: true
      })
    }
  }

  return issues
}

/**
 * Check modal/dialog accessibility
 * @param {Array<string>} lines - File lines
 * @param {string} componentName - Component name
 * @returns {Array} Modal accessibility issues
 */
function checkModalAccessibility(lines, componentName) {
  const issues = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for Dialog without aria-modal
    if (/<Dialog\b/.test(line)) {
      if (!line.includes('aria-modal')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-aria-modal`,
          component: componentName,
          line: lineNumber,
          severity: 'high',
          category: 'modals',
          issue: 'Dialog missing aria-modal attribute',
          wcag: WCAG_RULES.MISSING_DIALOG_ARIA.id,
          wcagTitle: WCAG_RULES.MISSING_DIALOG_ARIA.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' aria-modal="true" />'),
          explanation: 'Dialog components should have aria-modal="true" to inform screen readers of modal state.',
          autoFixable: true
        })
      }

      if (!line.includes('role=') && !line.includes('role="dialog"')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-role-dialog`,
          component: componentName,
          line: lineNumber,
          severity: 'high',
          category: 'modals',
          issue: 'Dialog missing role="dialog" attribute',
          wcag: WCAG_RULES.MISSING_DIALOG_ARIA.id,
          wcagTitle: WCAG_RULES.MISSING_DIALOG_ARIA.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' role="dialog" />'),
          explanation: 'Dialog components should have role="dialog" for proper semantics.',
          autoFixable: true
        })
      }

      if (!line.includes('aria-labelledby')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-aria-labelledby`,
          component: componentName,
          line: lineNumber,
          severity: 'medium',
          category: 'modals',
          issue: 'Dialog missing aria-labelledby attribute',
          wcag: WCAG_RULES.MISSING_DIALOG_ARIA.id,
          wcagTitle: WCAG_RULES.MISSING_DIALOG_ARIA.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/\/>/, ' aria-labelledby="dialog-title" />'),
          explanation: 'Dialogs should have aria-labelledby pointing to the dialog title for screen readers.',
          autoFixable: false
        })
      }
    }
  }

  return issues
}

/**
 * Check error message accessibility
 * @param {Array<string>} lines - File lines
 * @param {string} componentName - Component name
 * @returns {Array} Error message issues
 */
function checkErrorMessages(lines, componentName) {
  const issues = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for error messages without role="alert"
    if (/class="p-error"|class=".*error.*"/.test(line) && /<small|<div|<span/.test(line)) {
      if (!line.includes('role="alert"') && !line.includes('aria-live')) {
        issues.push({
          id: `${componentName}-${lineNumber}-missing-role-alert`,
          component: componentName,
          line: lineNumber,
          severity: 'high',
          category: 'forms',
          issue: 'Error message missing role="alert" or aria-live',
          wcag: WCAG_RULES.MISSING_ROLE_ALERT.id,
          wcagTitle: WCAG_RULES.MISSING_ROLE_ALERT.title,
          currentCode: line.trim(),
          suggestedFix: line.trim().replace(/<(small|div|span)/, '<$1 role="alert" aria-live="polite"'),
          explanation: 'Error messages should have role="alert" or aria-live="polite" to announce changes to screen readers.',
          autoFixable: true
        })
      }
    }
  }

  return issues
}

/**
 * Auto-fix an accessibility issue
 * @param {Object} issue - Issue object
 * @returns {Promise<void>}
 *
 * NOTE: This function requires backend implementation with file system access
 */
export async function autoFixIssue(issue) {
  throw new Error('Auto-fix requires backend implementation. This feature is currently disabled in browser builds.')
}

export default {
  scanForAccessibilityIssues,
  autoFixIssue
}

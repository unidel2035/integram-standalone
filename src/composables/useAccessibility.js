/**
 * Accessibility Composable
 *
 * Provides reusable accessibility utilities for Vue components.
 * Helps ensure WCAG 2.1 AA compliance throughout the application.
 */

import { ref, computed, nextTick } from 'vue'

/**
 * Focus management composable
 * Helps manage focus for keyboard navigation and screen readers
 *
 * @returns {Object} Focus management utilities
 */
export function useFocusManagement() {
  const previousFocusElement = ref(null)

  /**
   * Trap focus within an element (for modals/dialogs)
   * @param {HTMLElement} element - Container element
   */
  const trapFocus = (element) => {
    if (!element) return

    previousFocusElement.value = document.activeElement

    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)

    // Focus first element
    firstElement?.focus()

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  }

  /**
   * Restore focus to previously focused element
   */
  const restoreFocus = () => {
    if (previousFocusElement.value) {
      previousFocusElement.value.focus()
      previousFocusElement.value = null
    }
  }

  /**
   * Focus first invalid field in form
   * @param {HTMLElement} formElement - Form container
   */
  const focusFirstInvalidField = async () => {
    await nextTick()

    const firstInvalid =
      document.querySelector('[aria-invalid="true"]') ||
      document.querySelector('.p-invalid')

    if (firstInvalid) {
      firstInvalid.focus()
      firstInvalid.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  return {
    trapFocus,
    restoreFocus,
    focusFirstInvalidField
  }
}

/**
 * Announce messages to screen readers
 * Uses aria-live regions for dynamic content announcements
 *
 * @returns {Object} Announcement utilities
 */
export function useScreenReaderAnnouncements() {
  const announcements = ref([])

  /**
   * Create or get existing announcement region
   * @param {String} politeness - 'polite' or 'assertive'
   * @returns {HTMLElement} Announcement region
   */
  const getAnnouncementRegion = (politeness = 'polite') => {
    const id = `sr-announce-${politeness}`
    let region = document.getElementById(id)

    if (!region) {
      region = document.createElement('div')
      region.id = id
      region.setAttribute('aria-live', politeness)
      region.setAttribute('aria-atomic', 'true')
      region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status')
      region.className = 'sr-only'
      region.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `
      document.body.appendChild(region)
    }

    return region
  }

  /**
   * Announce message to screen readers
   * @param {String} message - Message to announce
   * @param {String} politeness - 'polite' (default) or 'assertive'
   */
  const announce = (message, politeness = 'polite') => {
    const region = getAnnouncementRegion(politeness)

    // Clear existing message
    region.textContent = ''

    // Use setTimeout to ensure screen reader picks up the change
    setTimeout(() => {
      region.textContent = message
      announcements.value.push({
        message,
        politeness,
        timestamp: new Date()
      })
    }, 100)
  }

  /**
   * Announce error message
   * @param {String} message - Error message
   */
  const announceError = (message) => {
    announce(message, 'assertive')
  }

  /**
   * Announce success message
   * @param {String} message - Success message
   */
  const announceSuccess = (message) => {
    announce(message, 'polite')
  }

  return {
    announce,
    announceError,
    announceSuccess,
    announcements: computed(() => announcements.value)
  }
}

/**
 * Keyboard navigation composable
 * Handles common keyboard navigation patterns
 *
 * @returns {Object} Keyboard navigation utilities
 */
export function useKeyboardNavigation() {
  /**
   * Handle arrow key navigation in a list
   * @param {KeyboardEvent} event - Keyboard event
   * @param {Array<HTMLElement>} items - List items
   * @param {Number} currentIndex - Current focused index
   * @returns {Number} New focused index
   */
  const handleArrowNavigation = (event, items, currentIndex) => {
    if (!items || items.length === 0) return currentIndex

    let newIndex = currentIndex

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
        break
      case 'ArrowDown':
        event.preventDefault()
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        event.preventDefault()
        newIndex = 0
        break
      case 'End':
        event.preventDefault()
        newIndex = items.length - 1
        break
      default:
        return currentIndex
    }

    items[newIndex]?.focus()
    return newIndex
  }

  /**
   * Handle Enter/Space activation
   * @param {KeyboardEvent} event - Keyboard event
   * @param {Function} callback - Callback to execute
   */
  const handleActivation = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback(event)
    }
  }

  /**
   * Handle Escape key
   * @param {KeyboardEvent} event - Keyboard event
   * @param {Function} callback - Callback to execute
   */
  const handleEscape = (event, callback) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      callback(event)
    }
  }

  return {
    handleArrowNavigation,
    handleActivation,
    handleEscape
  }
}

/**
 * Form accessibility composable
 * Provides utilities for accessible form validation
 *
 * @returns {Object} Form accessibility utilities
 */
export function useFormAccessibility() {
  const { focusFirstInvalidField } = useFocusManagement()
  const { announceError, announceSuccess } = useScreenReaderAnnouncements()

  /**
   * Generate ARIA attributes for form field
   * @param {String} fieldId - Field ID
   * @param {Object} options - Field options
   * @returns {Object} ARIA attributes
   */
  const getFieldAria = (fieldId, options = {}) => {
    const {
      error = null,
      helpText = null,
      required = false,
      success = null
    } = options

    const describedBy = []

    if (helpText) {
      describedBy.push(`${fieldId}-help`)
    }

    if (error) {
      describedBy.push(`${fieldId}-error`)
    } else if (success) {
      describedBy.push(`${fieldId}-success`)
    }

    return {
      id: fieldId,
      'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
      'aria-required': required ? 'true' : undefined,
      'aria-invalid': error ? 'true' : 'false'
    }
  }

  /**
   * Handle form submission with accessibility
   * @param {Function} validateFn - Validation function
   * @param {Function} submitFn - Submit function
   * @param {Object} options - Options
   */
  const handleAccessibleSubmit = async (validateFn, submitFn, options = {}) => {
    const { successMessage = 'Form submitted successfully' } = options

    try {
      // Validate form
      const errors = await validateFn()

      if (Object.keys(errors).length > 0) {
        // Focus first invalid field
        await focusFirstInvalidField()

        // Announce error count
        const errorCount = Object.keys(errors).length
        announceError(
          `Form has ${errorCount} error${errorCount > 1 ? 's' : ''}. Please fix the errors and try again.`
        )

        return { success: false, errors }
      }

      // Submit form
      const result = await submitFn()

      // Announce success
      announceSuccess(successMessage)

      return { success: true, result }

    } catch (error) {
      announceError(`Form submission failed: ${error.message}`)
      throw error
    }
  }

  return {
    getFieldAria,
    handleAccessibleSubmit,
    focusFirstInvalidField
  }
}

/**
 * Skip links composable
 * Provides skip navigation functionality
 *
 * @returns {Object} Skip link utilities
 */
export function useSkipLinks() {
  /**
   * Create skip link
   * @param {String} targetId - ID of target element
   * @param {String} label - Link label
   */
  const createSkipLink = (targetId, label = 'Skip to main content') => {
    const link = document.createElement('a')
    link.href = `#${targetId}`
    link.textContent = label
    link.className = 'skip-link'
    link.style.cssText = `
      position: absolute;
      left: -10000px;
      top: auto;
      width: 1px;
      height: 1px;
      overflow: hidden;
      z-index: 10000;
      background: var(--primary-color);
      color: white;
      padding: 0.5rem 1rem;
      text-decoration: none;
      font-weight: bold;
    `

    // Show on focus
    link.addEventListener('focus', () => {
      link.style.left = '10px'
      link.style.top = '10px'
      link.style.width = 'auto'
      link.style.height = 'auto'
    })

    link.addEventListener('blur', () => {
      link.style.left = '-10000px'
      link.style.top = 'auto'
      link.style.width = '1px'
      link.style.height = '1px'
    })

    link.addEventListener('click', (e) => {
      e.preventDefault()
      const target = document.getElementById(targetId)
      if (target) {
        target.setAttribute('tabindex', '-1')
        target.focus()
        target.scrollIntoView({ behavior: 'smooth' })
      }
    })

    return link
  }

  return {
    createSkipLink
  }
}

/**
 * Color contrast checker
 * Validates WCAG AA/AAA contrast ratios
 *
 * @returns {Object} Contrast checking utilities
 */
export function useColorContrast() {
  /**
   * Calculate relative luminance
   * @param {String} color - Hex color (#RRGGBB)
   * @returns {Number} Relative luminance (0-1)
   */
  const getRelativeLuminance = (color) => {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255

    const [rs, gs, bs] = [r, g, b].map(c =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    )

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  /**
   * Calculate contrast ratio
   * @param {String} foreground - Foreground color (hex)
   * @param {String} background - Background color (hex)
   * @returns {Number} Contrast ratio
   */
  const getContrastRatio = (foreground, background) => {
    const l1 = getRelativeLuminance(foreground)
    const l2 = getRelativeLuminance(background)

    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)

    return (lighter + 0.05) / (darker + 0.05)
  }

  /**
   * Check if colors meet WCAG AA standard
   * @param {String} foreground - Foreground color
   * @param {String} background - Background color
   * @param {String} size - 'normal' or 'large'
   * @returns {Boolean} True if meets AA standard
   */
  const meetsWCAG_AA = (foreground, background, size = 'normal') => {
    const ratio = getContrastRatio(foreground, background)
    const minRatio = size === 'large' ? 3 : 4.5
    return ratio >= minRatio
  }

  /**
   * Check if colors meet WCAG AAA standard
   * @param {String} foreground - Foreground color
   * @param {String} background - Background color
   * @param {String} size - 'normal' or 'large'
   * @returns {Boolean} True if meets AAA standard
   */
  const meetsWCAG_AAA = (foreground, background, size = 'normal') => {
    const ratio = getContrastRatio(foreground, background)
    const minRatio = size === 'large' ? 4.5 : 7
    return ratio >= minRatio
  }

  return {
    getContrastRatio,
    meetsWCAG_AA,
    meetsWCAG_AAA
  }
}

export default {
  useFocusManagement,
  useScreenReaderAnnouncements,
  useKeyboardNavigation,
  useFormAccessibility,
  useSkipLinks,
  useColorContrast
}

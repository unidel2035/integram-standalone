/**
 * Composable for handling form validation errors
 */

import { ref, computed } from 'vue'
import { formatValidationErrors } from '@/utils/errorHandling'

export function useFormErrors() {
  const errors = ref({})
  const serverErrors = ref([])

  /**
   * Set error for a specific field
   */
  const setError = (field, message) => {
    errors.value[field] = message
  }

  /**
   * Clear error for a specific field
   */
  const clearError = (field) => {
    delete errors.value[field]
  }

  /**
   * Clear all errors
   */
  const clearAllErrors = () => {
    errors.value = {}
    serverErrors.value = []
  }

  /**
   * Get error for a specific field
   */
  const getError = (field) => {
    return errors.value[field]
  }

  /**
   * Check if field has error
   */
  const hasError = (field) => {
    return !!errors.value[field]
  }

  /**
   * Check if form has any errors
   */
  const hasAnyError = computed(() => {
    return Object.keys(errors.value).length > 0 || serverErrors.value.length > 0
  })

  /**
   * Set errors from server response
   */
  const setServerErrors = (error) => {
    const validationErrors = formatValidationErrors(error)

    if (validationErrors.length > 0) {
      validationErrors.forEach(err => {
        if (err.field) {
          setError(err.field, err.message)
        } else {
          serverErrors.value.push(err.message)
        }
      })
    } else {
      // Generic error message
      const message = error?.response?.data?.message ||
                     error?.message ||
                     'Ошибка валидации'
      serverErrors.value.push(message)
    }
  }

  /**
   * Validate field with custom rules
   */
  const validateField = (field, value, rules) => {
    clearError(field)

    for (const rule of rules) {
      const result = rule(value)
      if (result !== true) {
        setError(field, result)
        return false
      }
    }

    return true
  }

  /**
   * Validate multiple fields
   */
  const validateFields = (fieldsConfig) => {
    let isValid = true

    for (const [field, config] of Object.entries(fieldsConfig)) {
      const { value, rules } = config
      if (!validateField(field, value, rules)) {
        isValid = false
      }
    }

    return isValid
  }

  /**
   * Common validation rules
   */
  const rules = {
    required: (message = 'Это поле обязательно') => (value) => {
      if (value === null || value === undefined || value === '') {
        return message
      }
      return true
    },

    email: (message = 'Неверный формат email') => (value) => {
      if (!value) return true
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value) || message
    },

    minLength: (min, message) => (value) => {
      if (!value) return true
      return value.length >= min || message || `Минимум ${min} символов`
    },

    maxLength: (max, message) => (value) => {
      if (!value) return true
      return value.length <= max || message || `Максимум ${max} символов`
    },

    pattern: (regex, message) => (value) => {
      if (!value) return true
      return regex.test(value) || message || 'Неверный формат'
    },

    numeric: (message = 'Должно быть числом') => (value) => {
      if (!value) return true
      return !isNaN(value) || message
    },

    min: (min, message) => (value) => {
      if (!value) return true
      return Number(value) >= min || message || `Минимальное значение ${min}`
    },

    max: (max, message) => (value) => {
      if (!value) return true
      return Number(value) <= max || message || `Максимальное значение ${max}`
    },

    custom: (validator, message) => (value) => {
      return validator(value) || message || 'Неверное значение'
    }
  }

  return {
    errors,
    serverErrors,
    hasAnyError,
    setError,
    clearError,
    clearAllErrors,
    getError,
    hasError,
    setServerErrors,
    validateField,
    validateFields,
    rules
  }
}

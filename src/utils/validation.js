import { z } from 'zod'

/**
 * Validation schemas for Flow Editor
 * Provides comprehensive validation for filters, transformations, and data imports
 */

// Base field name validation
const fieldNameSchema = z
  .string()
  .min(1, 'Имя поля не может быть пустым')
  .max(100, 'Имя поля не должно превышать 100 символов')
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    'Имя поля должно начинаться с буквы или подчеркивания и содержать только буквы, цифры и подчеркивания',
  )

// Filter condition validation
export const filterConditionSchema = z
  .string()
  .min(1, 'Условие фильтра не может быть пустым')
  .max(500, 'Условие фильтра не должно превышать 500 символов')
  .refine(
    value => {
      // Check for basic operators
      const hasOperator =
        value.includes('>') ||
        value.includes('<') ||
        value.includes('=') ||
        value.includes('contains') ||
        value.includes('CONTAINS')
      return hasOperator
    },
    {
      message:
        'Условие фильтра должно содержать оператор (>, <, =, contains)',
    },
  )

// Filter schema
export const filterSchema = z.object({
  name: z
    .string()
    .min(1, 'Название фильтра не может быть пустым')
    .max(100, 'Название фильтра не должно превышать 100 символов'),
  condition: filterConditionSchema,
})

// Transformation parameter schemas
const transformationParamsSchemas = {
  filter: z.object({
    filterPredicate: z
      .string()
      .min(1, 'Предикат фильтра не может быть пустым')
      .max(1000, 'Предикат фильтра слишком длинный'),
  }),

  project: z.object({
    projectFields: z
      .string()
      .min(1, 'Укажите хотя бы одно поле для проекции')
      .refine(
        value => {
          const fields = value.split(',').map(f => f.trim())
          return fields.length > 0 && fields.every(f => f.length > 0)
        },
        {
          message: 'Поля должны быть разделены запятыми и не могут быть пустыми',
        },
      ),
  }),

  join: z.object({
    joinType: z.enum(['inner', 'left', 'right', 'full'], {
      errorMap: () => ({
        message:
          'Тип соединения должен быть: inner, left, right или full',
      }),
    }),
    joinTable: z.string().min(1, 'Выберите таблицу для соединения'),
  }),

  aggregate: z.object({
    aggregateFunction: z.enum(
      ['count', 'sum', 'avg', 'min', 'max', 'first', 'last'],
      {
        errorMap: () => ({
          message:
            'Функция агрегации должна быть: count, sum, avg, min, max, first или last',
        }),
      },
    ),
    aggregateField: z.string().optional(),
  }),

  groupby: z.object({
    groupByFields: z
      .string()
      .min(1, 'Укажите хотя бы одно поле для группировки')
      .refine(
        value => {
          const fields = value.split(',').map(f => f.trim())
          return fields.length > 0 && fields.every(f => f.length > 0)
        },
        {
          message: 'Поля должны быть разделены запятыми и не могут быть пустыми',
        },
      ),
  }),

  having: z.object({
    havingCondition: z
      .string()
      .min(1, 'Условие HAVING не может быть пустым')
      .max(500, 'Условие HAVING слишком длинное'),
  }),

  orderby: z.object({
    orderByFields: z
      .string()
      .min(1, 'Укажите хотя бы одно поле для сортировки')
      .refine(
        value => {
          const fields = value.split(',').map(f => f.trim())
          return fields.length > 0 && fields.every(f => f.length > 0)
        },
        {
          message: 'Поля должны быть разделены запятыми и не могут быть пустыми',
        },
      ),
  }),

  limit: z.object({
    limitCount: z
      .number()
      .int('Лимит должен быть целым числом')
      .positive('Лимит должен быть положительным числом')
      .max(10000, 'Лимит не должен превышать 10000'),
    offsetCount: z
      .number()
      .int('Смещение должно быть целым числом')
      .nonnegative('Смещение не может быть отрицательным')
      .optional(),
  }),

  window: z.object({
    windowPartition: z.string().optional(),
    windowOrder: z.string().optional(),
  }),

  segment: z.object({
    segmentField: z.string().min(1, 'Укажите поле для сегментации'),
    segmentRanges: z
      .string()
      .min(1, 'Укажите диапазоны сегментации')
      .refine(
        value => {
          // Check if ranges are comma-separated numbers
          const ranges = value.split(',').map(r => r.trim())
          return ranges.every(r => !isNaN(parseFloat(r)))
        },
        {
          message:
            'Диапазоны должны быть числами, разделенными запятыми',
        },
      ),
  }),

  geofilter: z.object({
    geoField: z.string().min(1, 'Укажите поле с координатами'),
    geoCondition: z.string().min(1, 'Укажите геоусловие'),
  }),

  textsearch: z.object({
    textSearchField: z.string().min(1, 'Укажите поле для текстового поиска'),
    textSearchQuery: z
      .string()
      .min(1, 'Поисковый запрос не может быть пустым')
      .max(200, 'Поисковый запрос не должен превышать 200 символов'),
  }),

  explode: z.object({
    explodeField: z.string().min(1, 'Укажите поле для развертывания'),
  }),

  pivot: z.object({
    pivotRows: z.string().min(1, 'Укажите поле для строк сводной таблицы'),
    pivotColumns: z.string().min(1, 'Укажите поле для столбцов сводной таблицы'),
    pivotValues: z.string().min(1, 'Укажите поле для значений сводной таблицы'),
  }),

  sample: z.object({
    sampleSize: z
      .number()
      .int('Размер выборки должен быть целым числом')
      .positive('Размер выборки должен быть положительным')
      .max(1000, 'Размер выборки не должен превышать 1000'),
  }),

  split: z.object({
    splitConditions: z
      .string()
      .min(1, 'Укажите условия разделения')
      .max(500, 'Условия разделения слишком длинные'),
  }),

  annotate: z.object({
    annotationRule: z
      .string()
      .min(1, 'Правило аннотации не может быть пустым')
      .max(500, 'Правило аннотации слишком длинное'),
    annotationField: z
      .string()
      .min(1, 'Укажите поле для аннотации')
      .max(50, 'Имя поля для аннотации слишком длинное'),
  }),

  enrich: z.object({
    enrichLookupTable: z.string().min(1, 'Выберите таблицу для обогащения'),
  }),

  union: z.object({
    setOperationTable: z.string().min(1, 'Выберите таблицу для объединения'),
  }),

  intersect: z.object({
    setOperationTable: z.string().min(1, 'Выберите таблицу для пересечения'),
  }),

  except: z.object({
    setOperationTable: z.string().min(1, 'Выберите таблицу для разности'),
  }),

  distinct: z.object({
    distinctFields: z.string().optional(),
  }),
}

// Full transformation schema
export const transformationSchema = z.object({
  type: z.enum(
    [
      'filter',
      'project',
      'enrich',
      'join',
      'union',
      'intersect',
      'except',
      'distinct',
      'groupby',
      'aggregate',
      'having',
      'orderby',
      'limit',
      'window',
      'segment',
      'geofilter',
      'textsearch',
      'explode',
      'pivot',
      'sample',
      'split',
      'annotate',
    ],
    {
      errorMap: () => ({ message: 'Недопустимый тип трансформации' }),
    },
  ),
  params: z.record(z.any()).optional(),
})

// XLSX import validation
export const xlsxImportSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      file => {
        const validExtensions = ['.xlsx', '.xls', '.csv']
        return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      },
      {
        message: 'Файл должен быть в формате XLSX, XLS или CSV',
      },
    )
    .refine(
      file => {
        // Max 10MB
        const maxSize = 10 * 1024 * 1024
        return file.size <= maxSize
      },
      {
        message: 'Размер файла не должен превышать 10 МБ',
      },
    ),
})

// XLSX data validation after parsing
export const xlsxDataSchema = z.object({
  rows: z
    .array(z.record(z.any()))
    .min(1, 'Файл должен содержать хотя бы одну строку данных')
    .max(10000, 'Файл не должен содержать более 10000 строк'),
  headers: z
    .array(z.string())
    .min(1, 'Файл должен содержать хотя бы один столбец')
    .max(100, 'Файл не должен содержать более 100 столбцов')
    .refine(
      headers => {
        // Check for duplicate headers
        const uniqueHeaders = new Set(headers)
        return uniqueHeaders.size === headers.length
      },
      {
        message: 'Заголовки столбцов должны быть уникальными',
      },
    )
    .refine(
      headers => {
        // Check that headers are not empty
        return headers.every(h => h && h.trim().length > 0)
      },
      {
        message: 'Заголовки столбцов не могут быть пустыми',
      },
    ),
})

/**
 * Validate transformation parameters based on transformation type
 * @param {string} type - Transformation type
 * @param {object} params - Parameters to validate
 * @returns {{ success: boolean, errors: string[] }}
 */
export function validateTransformationParams(type, params) {
  const schema = transformationParamsSchemas[type]
  if (!schema) {
    return {
      success: false,
      errors: [`Неизвестный тип трансформации: ${type}`],
    }
  }

  const result = schema.safeParse(params)
  if (result.success) {
    return { success: true, errors: [] }
  }

  const errors = result.error.errors.map(err => {
    const field = err.path.join('.')
    return field ? `${field}: ${err.message}` : err.message
  })

  return { success: false, errors }
}

/**
 * Validate filter condition
 * @param {string} condition - Filter condition to validate
 * @returns {{ success: boolean, errors: string[] }}
 */
export function validateFilterCondition(condition) {
  const result = filterConditionSchema.safeParse(condition)
  if (result.success) {
    return { success: true, errors: [] }
  }

  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

/**
 * Validate XLSX file before reading
 * @param {File} file - File to validate
 * @returns {{ success: boolean, errors: string[] }}
 */
export function validateXLSXFile(file) {
  const result = xlsxImportSchema.shape.file.safeParse(file)
  if (result.success) {
    return { success: true, errors: [] }
  }

  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

/**
 * Validate XLSX data after parsing
 * @param {Array} rows - Parsed rows
 * @param {Array} headers - Parsed headers
 * @returns {{ success: boolean, errors: string[] }}
 */
export function validateXLSXData(rows, headers) {
  const result = xlsxDataSchema.safeParse({ rows, headers })
  if (result.success) {
    return { success: true, errors: [] }
  }

  const errors = result.error.errors.map(err => {
    const field = err.path.join('.')
    return field ? `${field}: ${err.message}` : err.message
  })

  return { success: false, errors }
}

/**
 * Format validation error for display
 * @param {string[]} errors - Array of error messages
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors) {
  if (errors.length === 0) return ''
  if (errors.length === 1) return errors[0]
  return '• ' + errors.join('\n• ')
}

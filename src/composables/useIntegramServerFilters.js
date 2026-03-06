/**
 * useIntegramServerFilters.js
 *
 * Composable для серверной фильтрации данных Integram.
 * Извлечён из IntegramDataTableWrapper.vue для переиспользования
 * в IntegramCardsEmbed, IntegramObjectList и других компонентах.
 *
 * Нормализованный формат поля (NormalizedField):
 * {
 *   id:         string  — идентификатор колонки (headerId в filterConditions)
 *   label:      string  — отображаемое имя
 *   type:       number  — тип Integram (3=SHORT, 2=MEMO, 8=DIR, 13=NUMBER, 4=DATETIME, 5=DATE)
 *   columnType: string  — 'regular' | 'dir' | 'multi' | 'nested' | 'lookup'
 *   dirTableId: string  — ID справочной таблицы (только для dir/multi)
 *   apiKey:     string  — ключ реквизита для F_{apiKey}= в запросе к Integram
 * }
 *
 * Использование:
 * ```js
 * import { useIntegramServerFilters } from '@/composables/useIntegramServerFilters'
 *
 * const filters = useIntegramServerFilters()
 *
 * // Открыть диалог:
 * filters.openFilterDialog(filterableFields.value)
 *
 * // Построить параметры для API:
 * const params = filters.buildServerFilters(normalizedFields.value, tableTypeId)
 *
 * // Загрузить начальные условия (из props / localStorage):
 * filters.loadInitialConditions({ initialConditions, blockId, filtersStorageKey, selectorName, selectorColumnId })
 * ```
 */

import { ref, computed } from 'vue'
import integramApiClient from '@/services/integramApiClient'
import { getGlobalSelector } from '@/stores/selectorState'

// Сентинельное значение для «Текущий пользователь» в выпадающем списке справочника
export const REF_CURRENT_USER = '__current_user__'

// ─── Операторы фильтрации ────────────────────────────────────────────────────

export const FILTER_OPERATORS = {
  text: [
    { label: 'содержит', value: 'contains' },
    { label: 'равно', value: 'equals' },
    { label: 'начинается с', value: 'startsWith' },
    { label: 'заканчивается на', value: 'endsWith' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  number: [
    { label: 'равно', value: 'equals' },
    { label: 'больше', value: 'greater' },
    { label: 'меньше', value: 'less' },
    { label: 'между', value: 'between' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  date: [
    { label: 'равно', value: 'equals' },
    { label: 'между', value: 'between' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  boolean: [
    { label: 'равно', value: 'equals' },
    { label: 'не равно', value: 'notEquals' }
  ]
}

export function getTypeCategory(type) {
  switch (type) {
    case 3: case 8: case 12: return 'text'
    case 13: case 14: return 'number'
    case 9: case 4: case 5: return 'date'
    case 11: return 'boolean'
    default: return 'text'
  }
}

export function getOperatorsForType(type) {
  return FILTER_OPERATORS[getTypeCategory(type)]
}

export function getDefaultOperatorForType(type) {
  return FILTER_OPERATORS[getTypeCategory(type)][0].value
}

export function isRangeOperator(operator) {
  return operator === 'between'
}

/**
 * Преобразует строковый базовый тип Integram API в числовой тип для UI.
 * Используется в компонентах, где API возвращает строку ('SHORT', 'MEMO' и т.д.)
 */
export function baseTypeStringToIntType(baseType, isReference = false) {
  if (isReference) return 8
  switch (baseType) {
    case 'SHORT': return 3
    case 'MEMO': return 2
    case 'NUMBER': case 'INT': case 'DECIMAL': return 13
    case 'DATE': return 5
    case 'DATETIME': return 4
    case 'BOOL': return 11
    default: return 3
  }
}

// ─── Основной composable ─────────────────────────────────────────────────────

export function useIntegramServerFilters() {
  // Условия фильтрации
  const filterConditions = ref([])
  const isFilterDialogVisible = ref(false)

  // Кэш опций справочных полей: { [dirTableId]: [{id, label, isSpecial?}] }
  const refFilterOptions = ref({})
  const refFilterLoading = ref({})

  // Есть ли активные (непустые) условия
  const hasActiveFilters = computed(() =>
    filterConditions.value.some(c =>
      c.operator === 'isEmpty' || (c.value !== null && c.value !== '')
    )
  )

  // ─── Загрузка опций для справочного поля ─────────────────────────────────

  async function loadRefOptions(dirTableId) {
    if (!dirTableId) return
    if (refFilterOptions.value[dirTableId]) return // уже загружено
    refFilterLoading.value = { ...refFilterLoading.value, [dirTableId]: true }
    try {
      const data = await integramApiClient.getObjectList(dirTableId, { LIMIT: 500 })
      const items = [
        { id: REF_CURRENT_USER, label: '👤 Текущий пользователь', isSpecial: true },
        ...(data.object || []).map(obj => ({
          id: String(obj.id),
          label: obj.val || `#${obj.id}`
        }))
      ]
      refFilterOptions.value = { ...refFilterOptions.value, [dirTableId]: items }
    } catch {
      refFilterOptions.value = { ...refFilterOptions.value, [dirTableId]: [
        { id: REF_CURRENT_USER, label: '👤 Текущий пользователь', isSpecial: true }
      ] }
    } finally {
      refFilterLoading.value = { ...refFilterLoading.value, [dirTableId]: false }
    }
  }

  // ─── Построение параметров серверной фильтрации ───────────────────────────

  /**
   * Конвертирует filterConditions в параметры Integram API.
   *
   * @param {NormalizedField[]} fieldsArray — список полей с apiKey
   * @param {string|number|null} typeId — ID таблицы (для фильтрации по полю 'val')
   * @returns {Object} — параметры запроса: { F_926911: '@1003', lnx: 0, ... }
   */
  function buildServerFilters(fieldsArray, typeId = null) {
    const serverFilters = {}
    let hasLikeFilters = false

    filterConditions.value.forEach(condition => {
      let cond = { ...condition }

      // Разрешить источник значения: currentUser (legacy)
      if (cond.valueSource === 'currentUser') {
        const uid = integramApiClient.userId
        if (!uid) return
        cond = { ...cond, value: String(uid), operator: 'equals' }
      }

      // Разрешить сентинель __current_user__ из выпадающего списка
      if (cond.value === REF_CURRENT_USER) {
        const uid = integramApiClient.userId
        if (!uid) return
        cond = { ...cond, value: String(uid), operator: 'equals' }
      }

      // Разрешить значение из Selector-блока
      if (cond.valueSource === 'selector') {
        if (!cond.selectorName) return
        const resolved = getGlobalSelector(cond.selectorName)
        if (!resolved) return
        cond = { ...cond, value: resolved }
      }

      // Пропустить пустые условия
      if (!cond.headerId) return
      if (cond.operator !== 'isEmpty' && (!cond.value && cond.value !== 0)) return

      // Найти поле чтобы получить apiKey
      const field = fieldsArray.find(f => f.id === cond.headerId)
      if (!field) return

      // Определить ключ параметра
      let filterKey
      if (field.apiKey === 'val' && typeId) {
        filterKey = `F_${typeId}`
      } else if (field.apiKey) {
        filterKey = `F_${field.apiKey}`
      } else {
        return
      }

      // Оператор isEmpty — отдельный параметр
      if (cond.operator === 'isEmpty') {
        serverFilters[`${filterKey}_NULL`] = 1
        return
      }

      let filterValue = String(cond.value)

      const isRefColumn = cond.columnType === 'dir' || cond.columnType === 'multi' ||
                          field.columnType === 'dir' || field.columnType === 'multi'

      if (isRefColumn && cond.operator === 'equals') {
        // Для справочных полей: формат @objectId
        filterValue = filterValue.startsWith('@') ? filterValue : `@${filterValue}`
      } else {
        switch (cond.operator) {
          case 'contains':
            filterValue = `%${filterValue.replace(/%/g, '')}%`
            hasLikeFilters = true
            break
          case 'startsWith':
            filterValue = `${filterValue.replace(/%/g, '')}%`
            hasLikeFilters = true
            break
          case 'endsWith':
            filterValue = `%${filterValue.replace(/%/g, '')}`
            hasLikeFilters = true
            break
        }
      }

      serverFilters[filterKey] = filterValue
    })

    if (hasLikeFilters) serverFilters.lnx = 0

    return serverFilters
  }

  // ─── Управление условиями (используется диалогом) ────────────────────────

  /**
   * Добавить новое условие с дефолтными значениями для первого поля.
   * @param {NormalizedField[]} filterableFieldsArray
   */
  function addCondition(filterableFieldsArray) {
    const firstField = filterableFieldsArray?.[0]
    const isRef = firstField?.columnType === 'dir' || firstField?.columnType === 'multi'
    const defaultOperator = isRef ? 'equals' : getDefaultOperatorForType(firstField?.type || 3)
    filterConditions.value.push({
      headerId: firstField?.id || null,
      type: firstField?.type || 3,
      columnType: firstField?.columnType || 'regular',
      dirTableId: firstField?.dirTableId || null,
      operator: defaultOperator,
      value: null,
      value2: null,
      valueSource: 'manual',
      selectorName: null,
      hideColumn: false
    })
    if (isRef && firstField?.dirTableId) {
      loadRefOptions(firstField.dirTableId)
    }
  }

  function removeCondition(index) {
    filterConditions.value.splice(index, 1)
  }

  /**
   * Обновить метаданные условия при смене поля (тип, columnType, dirTableId).
   * @param {number} index
   * @param {NormalizedField[]} filterableFieldsArray
   */
  function updateConditionType(index, filterableFieldsArray) {
    const field = filterableFieldsArray?.find(f => f.id === filterConditions.value[index].headerId)
    if (field) {
      filterConditions.value[index].type = field.type
      filterConditions.value[index].columnType = field.columnType || 'regular'
      filterConditions.value[index].dirTableId = field.dirTableId || null
      filterConditions.value[index].value = null
      filterConditions.value[index].value2 = null
      const isRef = field.columnType === 'dir' || field.columnType === 'multi'
      filterConditions.value[index].operator = isRef ? 'equals' : getDefaultOperatorForType(field.type)
      if (isRef && field.dirTableId) loadRefOptions(field.dirTableId)
    }
  }

  function toggleValueSource(index, selectorStateObj) {
    const condition = filterConditions.value[index]
    if (condition.valueSource === 'selector') {
      condition.valueSource = 'manual'
      condition.selectorName = null
    } else {
      condition.valueSource = 'selector'
      condition.value = null
      condition.value2 = null
      if (selectorStateObj) {
        const knownSelectors = Object.keys(selectorStateObj.selectors || {})
        if (knownSelectors.length > 0) condition.selectorName = knownSelectors[0]
      }
    }
  }

  // ─── Диалог ──────────────────────────────────────────────────────────────

  /**
   * Открыть диалог фильтров. При отсутствии условий — добавляет одно пустое.
   * Также предзагружает опции справочных полей.
   * @param {NormalizedField[]} filterableFieldsArray
   */
  function openFilterDialog(filterableFieldsArray) {
    if (filterConditions.value.length === 0) {
      addCondition(filterableFieldsArray)
    }
    isFilterDialogVisible.value = true
    // Предзагрузить опции справочных полей
    filterConditions.value.forEach(c => {
      if ((c.columnType === 'dir' || c.columnType === 'multi') && c.dirTableId && c.operator === 'equals') {
        loadRefOptions(c.dirTableId)
      }
    })
  }

  function closeFilterDialog() {
    isFilterDialogVisible.value = false
  }

  // ─── Загрузка начальных условий ──────────────────────────────────────────

  /**
   * Загрузить начальные условия из props.initialFilterConditions или localStorage,
   * затем смёрджить props.selectorName в условия (для backward compat).
   *
   * @param {Object} opts
   * @param {Array|null}  opts.initialConditions    — props.initialFilterConditions
   * @param {string|null} opts.blockId              — props.blockId (если задан — не читаем localStorage)
   * @param {string|null} opts.filtersStorageKey    — ключ localStorage
   * @param {string|null} opts.selectorName         — props.selectorName (legacy)
   * @param {string|null} opts.selectorColumnId     — props.selectorColumnId (legacy)
   */
  function loadInitialConditions({ initialConditions, blockId, filtersStorageKey, selectorName, selectorColumnId } = {}) {
    if (initialConditions && Array.isArray(initialConditions) && initialConditions.length > 0) {
      filterConditions.value = initialConditions
    } else if (!blockId && filtersStorageKey) {
      try {
        const stored = localStorage.getItem(filtersStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            filterConditions.value = parsed
          } else if (parsed?.filterConditions?.length > 0) {
            filterConditions.value = parsed.filterConditions
          }
        }
      } catch {}
    }
    // Смёрджить prop selector в условия
    if (selectorName && selectorColumnId) {
      const alreadyHas = filterConditions.value.some(
        c => c.valueSource === 'selector' && c.selectorName === selectorName
      )
      if (!alreadyHas) {
        const headerId = selectorColumnId === '__val__' ? 'val' : `req_${selectorColumnId}`
        filterConditions.value.push({
          headerId, type: 3, columnType: 'regular', dirTableId: null,
          operator: 'equals', value: null, value2: null,
          valueSource: 'selector', selectorName, hideColumn: false
        })
      }
    }
  }

  return {
    // Состояние
    REF_CURRENT_USER,
    filterConditions,
    isFilterDialogVisible,
    refFilterOptions,
    refFilterLoading,
    hasActiveFilters,

    // Константы и хелперы операторов
    FILTER_OPERATORS,
    getTypeCategory,
    getOperatorsForType,
    getDefaultOperatorForType,
    isRangeOperator,

    // Методы
    loadRefOptions,
    buildServerFilters,
    addCondition,
    removeCondition,
    updateConditionType,
    toggleValueSource,
    openFilterDialog,
    closeFilterDialog,
    loadInitialConditions
  }
}

/**
 * DataTable Constants
 * Extracted from DataTable.vue for better maintainability
 */

// Column sizing
export const MIN_COLUMN_WIDTH = 50
export const MAX_DEPTH = 20

// Virtual scrolling
export const VIRTUAL_SCROLL_ROW_HEIGHT = 32 // Row height in pixels (matches comfortable density)
export const VIRTUAL_SCROLL_BUFFER = 20 // Extra rows to render above/below viewport
export const VIRTUAL_SCROLL_ENABLED_THRESHOLD = 500 // Enable virtual scrolling when rows > threshold

// Caching
export const DIR_ROW_CACHE_TTL = 5 * 60 * 1000 // 5 minutes TTL

// Debouncing
export const ROW_HOVER_DEBOUNCE_MS = 150 // Debounce time for row hover preloading
export const BACKGROUND_LOAD_DELAY_MS = 500 // Delay between background requests

// History (Undo/Redo)
export const MAX_HISTORY_SIZE = 50

// Duplicate highlighting colors
export const DUPLICATE_COLORS = [
  '#FFE5E5', // Light red
  '#E5F0FF', // Light blue
  '#FFF4E5', // Light orange
  '#E5FFE5', // Light green
  '#FFE5FF', // Light magenta
  '#E5FFFF', // Light cyan
  '#FFF0E5', // Light peach
  '#F0E5FF'  // Light purple
]

// Formula function handlers
export const FUNCTION_HANDLERS = {
  SUM: args => args.flat().map(arg => typeof arg === 'number' ? arg : parseFloat(arg))?.reduce((a, b) => a + b, 0),
  AVG: args => {
    const numbers = args.flat().map(arg => typeof arg === 'number' ? arg : parseFloat(arg))
    const sum = numbers.reduce((a, b) => a + b, 0)
    return numbers.length > 0 ? sum / numbers.length : 0
  },
  MIN: args => Math.min(...args.flat().map(arg => typeof arg === 'number' ? arg : parseFloat(arg))),
  MAX: args => Math.max(...args.flat().map(arg => typeof arg === 'number' ? arg : parseFloat(arg))),
  COUNT: args => args.flat().length,
  IF: ([condition, trueVal, falseVal]) => condition ? trueVal : falseVal,
  NUMBER: ([val]) => isNaN(parseFloat(val)) ? 0 : parseFloat(val)
}

// Header context menu items generator - Coda.io style multi-level menu
export const getHeaderContextMenuItems = (header, options = {}) => {
  const {
    onSortAsc,
    onSortDesc,
    onClearSort,
    onRename,
    onChangeType,
    onFilter,
    onClearFilter,
    onGroupBy,
    onAddToGroup,
    onRemoveFromGroup,
    onToggleGroupMode,
    onPin,
    onShowDuplicates,
    onHide,
    onDelete,
    isPinned = false,
    hasDuplicates = false,
    duplicateCount = 0,
    isSorted = false,
    hasFilter = false,
    isGrouped = false,
    groupingMode = 'merged',
    availableTypes = [],
    currentType = null,
    disableEditing = false,
    disableTypeEditing = false
  } = options

  const menuItems = []

  // 1. Rename
  if (!disableEditing) {
    menuItems.push({
      label: 'Переименовать',
      icon: 'pi pi-pencil',
      command: onRename
    })
  }

  // 2. Type submenu (only if not disabled)
  if (!disableTypeEditing && availableTypes.length > 0) {
    menuItems.push({
      label: 'Тип данных',
      icon: 'pi pi-th-large',
      items: availableTypes.map(type => ({
        label: type.label,
        icon: `fas ${type.icon}`,
        command: () => onChangeType && onChangeType(type.value),
        // Mark current type with checkmark
        class: currentType === type.value ? 'menu-item-checked' : ''
      }))
    })
  }

  menuItems.push({ separator: true })

  // 3. Sort submenu
  const sortItems = [
    {
      label: 'По возрастанию ↑',
      icon: 'pi pi-sort-amount-up',
      command: onSortAsc
    },
    {
      label: 'По убыванию ↓',
      icon: 'pi pi-sort-amount-down',
      command: onSortDesc
    }
  ]

  if (isSorted && onClearSort) {
    sortItems.push(
      { separator: true },
      {
        label: 'Сбросить сортировку',
        icon: 'pi pi-times',
        command: onClearSort
      }
    )
  }

  menuItems.push({
    label: 'Сортировать',
    icon: 'pi pi-sort-alt',
    items: sortItems
  })

  // 4. Filter submenu
  const filterItems = [
    {
      label: 'Добавить фильтр',
      icon: 'pi pi-filter',
      command: onFilter
    }
  ]

  if (hasFilter && onClearFilter) {
    filterItems.push(
      { separator: true },
      {
        label: 'Сбросить фильтр',
        icon: 'pi pi-filter-slash',
        command: onClearFilter
      }
    )
  }

  menuItems.push({
    label: 'Фильтровать',
    icon: 'pi pi-filter',
    items: filterItems
  })

  // 5. Group submenu
  const groupItems = []

  if (!isGrouped) {
    groupItems.push({
      label: 'Группировать по этой колонке',
      icon: 'pi pi-th-large',
      command: onGroupBy
    })
  } else {
    groupItems.push(
      {
        label: 'Добавить к группировке',
        icon: 'pi pi-plus',
        command: onAddToGroup
      },
      {
        label: 'Убрать из группировки',
        icon: 'pi pi-minus',
        command: onRemoveFromGroup
      },
      { separator: true },
      {
        label: groupingMode === 'merged' ? 'Режим: Объединённые ячейки ✓' : 'Режим: Объединённые ячейки',
        icon: 'pi pi-th-large',
        command: () => onToggleGroupMode && onToggleGroupMode('merged')
      },
      {
        label: groupingMode === 'rows' ? 'Режим: Строки групп ✓' : 'Режим: Строки групп',
        icon: 'pi pi-bars',
        command: () => onToggleGroupMode && onToggleGroupMode('rows')
      }
    )
  }

  menuItems.push({
    label: 'Группировать',
    icon: 'pi pi-objects-column',
    items: groupItems
  })

  menuItems.push({ separator: true })

  // 6. View options
  menuItems.push(
    {
      label: isPinned ? '📌 Открепить колонку' : '📌 Закрепить колонку',
      icon: isPinned ? 'pi pi-lock-open' : 'pi pi-lock',
      command: onPin
    },
    {
      label: '👁 Скрыть колонку',
      icon: 'pi pi-eye-slash',
      command: onHide
    },
    {
      label: hasDuplicates
        ? `🔍 Скрыть дубликаты`
        : `🔍 Показать дубликаты${duplicateCount > 0 ? ` (${duplicateCount})` : ''}`,
      icon: 'pi pi-copy',
      command: onShowDuplicates
    }
  )

  // 7. Delete (danger zone)
  if (!disableEditing && onDelete) {
    menuItems.push(
      { separator: true },
      {
        label: '🗑 Удалить колонку',
        icon: 'pi pi-trash',
        class: 'danger-menu-item',
        command: onDelete
      }
    )
  }

  return menuItems
}

// Row context menu items generator
export const getRowContextMenuItems = (options = {}) => {
  const {
    onCopy,
    onPaste,
    onEdit,
    onMoveUp,
    onChangeParent,
    onDelete,
    hasCopiedValue = false
  } = options

  return [
    {
      label: 'Копировать значение',
      icon: 'pi pi-copy',
      command: onCopy
    },
    {
      label: 'Вставить значение',
      icon: 'pi pi-clipboard',
      disabled: !hasCopiedValue,
      command: onPaste
    },
    { separator: true },
    {
      label: 'Редактировать строку',
      icon: 'pi pi-pencil',
      command: onEdit
    },
    {
      label: 'Переместить вверх',
      icon: 'pi pi-arrow-up',
      command: onMoveUp
    },
    {
      label: 'Изменить родителя',
      icon: 'pi pi-sitemap',
      command: onChangeParent
    },
    { separator: true },
    {
      label: 'Удалить строку',
      icon: 'pi pi-trash',
      class: 'danger-menu-item',
      command: onDelete
    }
  ]
}

// Weekdays for autofill
export const WEEKDAYS_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
export const WEEKDAYS_RU_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
export const WEEKDAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Months for autofill
export const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

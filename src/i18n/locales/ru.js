export default {
  // Общие элементы интерфейса
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    update: 'Обновить',
    search: 'Поиск',
    filter: 'Фильтр',
    actions: 'Действия',
    back: 'Назад',
    next: 'Далее',
    previous: 'Предыдущий',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    info: 'Информация',
    confirm: 'Подтвердить',
    close: 'Закрыть',
    yes: 'Да',
    no: 'Нет',
    download: 'Скачать',
    upload: 'Загрузить',
    export: 'Экспорт',
    import: 'Импорт',
    refresh: 'Обновить',
    reset: 'Сбросить',
    apply: 'Применить',
    clear: 'Очистить',
    selectAll: 'Выбрать все',
    deselectAll: 'Снять выделение',
    noData: 'Нет данных',
    selectLanguage: 'Выбрать язык',
    add: 'Добавить',
    remove: 'Удалить',
    select: 'Выбрать',
    copy: 'Копировать',
    paste: 'Вставить',
    cut: 'Вырезать',
    undo: 'Отменить',
    redo: 'Повторить',
    submit: 'Отправить',
    send: 'Отправить',
    attach: 'Прикрепить',
    detach: 'Открепить',
    confirmation: 'Подтверждение',
    active: 'Активен',
    inactive: 'Неактивен',
    connect: 'Подключить',
    connected: 'Подключен',
    disconnected: 'Отключен',
    saveSettings: 'Сохранить настройки'
  },

  // Навигация и меню
  nav: {
    home: 'Главная',
    dashboard: 'Дашборд',
    settings: 'Настройки',
    profile: 'Профиль',
    logout: 'Выход',
    login: 'Вход',
    help: 'Помощь',
    documentation: 'Документация',
    about: 'О системе',
    mainMenu: 'Главное меню навигации'
  },

  // Маршруты и заголовки страниц
  routes: {
    home: 'Главная',
    dashboard: 'Дашборд',
    document: 'Документ',
    quickStart: 'Быстрый старт',
    userGuide: 'Руководство пользователя',
    apiReference: 'Справочник API',
    examples: 'Примеры',
    faq: 'Частые вопросы',
    mySpaces: 'Мои пространства',
    workspace: 'Рабочее пространство',
    agents: 'Агенты',
    aiModels: 'Модели ИИ',
    voiceAgent: 'Голосовой агент',
    settings: 'Настройки',
    profile: 'Профиль',
    notifications: 'Уведомления',
    videoConference: 'Видеоконференция',
    youtubeAnalytics: 'Аналитика YouTube',
    webScraper: 'Веб-скрапер',
    salesAgent: 'Агент продаж',
    cryptoWallet: 'Крипто-кошелек',
    agroAnalytics: 'Сельскохозяйственная аналитика',
    competitorMonitor: 'Мониторинг конкурентов',
    integrationAgent: 'Агент интеграции',
    codeReview: 'Ревью кода',
    tables: 'Таблицы',
    reports: 'Отчеты'
  },

  // Тема и внешний вид
  theme: {
    light: 'Включить светлую тему',
    dark: 'Включить тёмную тему',
    settings: 'Настройки темы',
    colorScheme: 'Цветовая схема',
    primaryColor: 'Основной цвет',
    scale: 'Масштаб',
    menuMode: 'Режим меню'
  },

  // Страница 404
  notFound: {
    title: 'Страница не найдена',
    code: '404',
    description: 'Запрашиваемый ресурс недоступен.',
    links: {
      faq: {
        title: 'Часто задаваемые вопросы',
        description: 'Ответы на популярные вопросы.'
      },
      solution: {
        title: 'Центр решений',
        description: 'Помощь в решении проблем.'
      },
      permissions: {
        title: 'Управление разрешениями',
        description: 'Настройка прав доступа.'
      }
    },
    button: 'Перейти на главную'
  },

  // Страница настроек
  settings: {
    title: 'Настройки',
    export: {
      title: 'Экспорт данных',
      fullExport: 'Полный экспорт данных',
      dataTypes: 'Типы данных',
      selectDataTypes: 'Выберите типы данных',
      format: 'Формат экспорта',
      selectFormat: 'Выберите формат',
      dateRange: 'Период',
      selectDateRange: 'Выберите период',
      includeMetadata: 'Включить метаданные',
      includeAttachments: 'Включить вложения',
      request: 'Запросить экспорт',
      gdpr: 'GDPR экспорт (все данные)',
      history: 'История экспортов',
      id: 'ID',
      status: 'Статус',
      createdAt: 'Создан',
      size: 'Размер',
      actions: 'Действия',
      download: 'Скачать',
      delete: 'Удалить',
      scheduled: 'Запланированные экспорты',
      frequency: 'Частота',
      selectFrequency: 'Выберите частоту',
      scheduleExport: 'Создать расписание',
      nextRun: 'Следующий запуск'
    },
    import: {
      title: 'Импорт данных',
      uploadFile: 'Загрузить файл для импорта',
      dragDrop: 'Перетащите файл сюда или нажмите для выбора',
      fileSelected: 'Выбран файл',
      dryRun: 'Пробный запуск (без изменений)',
      validateOnly: 'Только проверка',
      upload: 'Загрузить и проверить',
      cancel: 'Отмена',
      validationResults: 'Результаты проверки',
      errorsFound: 'Обнаружены ошибки',
      moreErrors: 'И еще',
      errors: 'ошибок',
      validationSuccess: 'Валидация успешна. Можно импортировать.',
      preview: 'Предпросмотр',
      recordsToImport: 'Записей для импорта',
      confirm: 'Подтвердить импорт',
      history: 'История импортов',
      id: 'ID',
      filename: 'Файл',
      status: 'Статус',
      imported: 'Импортировано',
      createdAt: 'Создан',
      actions: 'Действия'
    },
    backup: {
      title: 'Резервное копирование',
      create: 'Создать резервную копию',
      description: 'Создайте полную резервную копию всех ваших данных',
      createNow: 'Создать резервную копию',
      cloudIntegration: 'Интеграция с облачными хранилищами',
      history: 'История резервных копий',
      date: 'Дата',
      size: 'Размер',
      status: 'Статус',
      actions: 'Действия',
      download: 'Скачать',
      restore: 'Восстановить',
      delete: 'Удалить'
    },
    security: {
      title: 'Безопасность и аудит',
      exportSettings: 'Настройки безопасности экспорта',
      encryptExports: 'Шифровать экспорты',
      passwordProtect: 'Защищать паролем',
      tempLinks: 'Использовать временные ссылки (7 дней)',
      save: 'Сохранить настройки',
      auditLog: 'Журнал аудита экспортов',
      timestamp: 'Время',
      action: 'Действие',
      user: 'Пользователь',
      details: 'Детали'
    }
  },

  // Аутентификация
  auth: {
    login: 'Вход',
    logout: 'Выход',
    register: 'Регистрация',
    email: 'Email',
    password: 'Пароль',
    confirmPassword: 'Подтвердите пароль',
    forgotPassword: 'Забыли пароль?',
    rememberMe: 'Запомнить меня',
    loginButton: 'Войти',
    registerButton: 'Зарегистрироваться',
    or: 'или',
    loginWith: 'Войти через',
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?'
  },

  // Дата и время
  dateTime: {
    today: 'Сегодня',
    yesterday: 'Вчера',
    tomorrow: 'Завтра',
    thisWeek: 'На этой неделе',
    thisMonth: 'В этом месяце',
    thisYear: 'В этом году',
    custom: 'Выборочно',
    from: 'С',
    to: 'До',
    selectDate: 'Выберите дату',
    selectTime: 'Выберите время',
    selectDateTime: 'Выберите дату и время'
  },

  // Сообщения валидации
  validation: {
    required: 'Это поле обязательно',
    email: 'Введите корректный email',
    minLength: 'Минимальная длина {min} символов',
    maxLength: 'Максимальная длина {max} символов',
    pattern: 'Введите корректное значение',
    passwordMatch: 'Пароли не совпадают',
    invalidFormat: 'Неверный формат'
  },

  // Уведомления
  notifications: {
    title: 'Уведомления',
    markAllRead: 'Отметить все прочитанными',
    noNotifications: 'Нет уведомлений',
    viewAll: 'Показать все',
    settings: 'Настройки уведомлений',
    enableSound: 'Включить звук',
    enableDesktop: 'Включить уведомления на рабочем столе'
  },

  // Ошибки
  errors: {
    unexpected: 'Произошла непредвиденная ошибка',
    network: 'Ошибка сети. Проверьте подключение.',
    notFound: 'Ресурс не найден',
    unauthorized: 'Неавторизованный доступ',
    forbidden: 'Доступ запрещен',
    serverError: 'Ошибка сервера. Попробуйте позже.',
    tryAgain: 'Попробуйте еще раз',
    technical: 'Технические детали',
    boundary: {
      title: 'Ошибка отображения компонента',
      message: 'Не удалось отобразить компонент. Попробуйте обновить страницу.',
      staleChunkTitle: 'Приложение обновилось',
      staleChunkMessage: 'Загружена новая версия приложения. Страница будет перезагружена автоматически.',
      autoReload: 'Автоперезагрузка через {seconds}с...',
      hints: {
        nodeType: 'Произошла ошибка позиционирования UI-элемента. Попробуйте закрыть меню и открыть снова.',
        default: 'Если ошибка повторяется, обновите страницу или обратитесь в поддержку.'
      }
    },
    actions: {
      retry: 'Попробовать снова',
      goHome: 'На главную',
      reloadPage: 'Перезагрузить',
      cancelReload: 'Отменить'
    }
  },

  // Главное меню
  menu: {
    main: 'Главное',
    tasks: 'Задачи',
    agents: 'Агенты',
    myWorkspaces: 'Мои пространства',
    infrastructure: 'Инфраструктура БАС',
    droneManagement: 'Управление дронами',
    controlPanel: 'Панель управления',
    buildAnalytics: 'Аналитика сборки',
    map: 'Карта',
    tar1090: 'Tar1090',
    analyticsAndAggregators: 'Аналитика и агрегаторы',
    youtubeAnalytics: 'Аналитика YouTube',
    telegramGroupParser: 'Парсер Telegram групп',
    telegramAds: 'Реклама в Telegram',
    webScraper: 'Парсер сайтов',
    management: 'Управление',
    editor: 'Редактор',
    flowEditor: 'Flow Editor',
    reportEditor: 'Редактор отчётов',
    tables: 'Таблицы',
    reports: 'Отчёты',
    structure: 'Структура',
    kanban: 'Канбан',
    maps: 'Карты',
    finModel: 'Финмодель',
    vueFlow: 'Vue Flow',
    surveys: 'Опросы',
    test: 'Тест',
    agentsAndWorkflow: 'Агенты и Воркфлоу',
    training: 'Обучение',
    lesson: 'Урок',
    introduction: 'Введение',
    firstWorkflow: 'Первый Workflow',
    agentSettings: 'Настройки агентов',
    advancedTechniques: 'Продвинутые техники',
    practicalCases: 'Практические кейсы',
    aiSystemPrototyping: 'Прототипирование систем с ИИ',
    aiBibliographicWork: 'Практическое применение ИИ в библиографической работе',
    aiLibraryIntegration: 'Интеграция ИИ с библиотечными системами',
    mlRecommendations: 'Машинное обучение для рекомендательных систем',
    nlpQueryProcessing: 'NLP в обработке запросов'
  },

  // Модуль агентов
  agents: {
    title: 'Агенты',
    createNew: 'Создать агента',
    list: 'Список агентов',
    edit: 'Редактировать агента',
    delete: 'Удалить агента',
    settings: 'Настройки агента',
    status: 'Статус',
    running: 'Работает',
    stopped: 'Остановлен',
    error: 'Ошибка',
    name: 'Имя агента',
    description: 'Описание',
    type: 'Тип',
    created: 'Создан',
    modified: 'Изменен',
    actions: 'Действия',
    start: 'Запустить',
    stop: 'Остановить',
    restart: 'Перезапустить',
    configure: 'Настроить',
    logs: 'Логи',
    metrics: 'Метрики',
    testRunner: 'Тест-раннер',
    // AgentStatusPanel
    statistics: 'Статистика',
    agentsCount: 'агентов',
    suggestionsCount: 'предложений',
    filesAnalyzed: 'Файлов проанализировано',
    suggestions: 'Предложений',
    applied: 'Применено',
    errorsFound: 'Ошибок найдено',
    started: 'Запущен',
    goToWorkspace: 'Перейти к workspace',
    stopAgent: 'Остановить агента',
    removeAgent: 'Удалить агента',
    noAgents: 'Нет запущенных агентов',
    emptyStateHint: 'Запустите агента в workspace для автоматического анализа кода',
    openWorkspaces: 'Открыть Workspaces',
    goToAgents: 'Перейти в агенты'
  },

  // Визуальный конструктор агентов
  visualAgentBuilder: {
    title: 'Визуальный конструктор агентов',
    canvasPlaceholder: 'Название холста',
    canvas: 'Canvas',
    mindMap: 'Mind Map',
    formView: 'Форма',
    preview: 'Предпросмотр',
    generateCode: 'Сгенерировать код',
    save: 'Сохранить',
    components: 'Компоненты',
    categories: {
      core: 'Базовые',
      tools: 'Инструменты',
      workflows: 'Процессы',
      advanced: 'Расширенные',
      ui: 'UI элементы'
    },
    properties: 'Свойства',
    noComponentSelected: 'Выберите компонент для редактирования',
    name: 'Название',
    position: 'Позиция',
    componentName: 'Название компонента',
    configuration: 'Конфигурация',
    deleteComponent: 'Удалить компонент',
    agentPreview: 'Предпросмотр агента',
    testInput: 'Тестовый ввод',
    testInputPlaceholder: 'Введите тестовые данные...',
    runPreview: 'Запустить предпросмотр',
    output: 'Результат',
    logs: 'Логи',
    generatedAgentCode: 'Сгенерированный код агента',
    copyCode: 'Копировать код',
    download: 'Скачать',
    close: 'Закрыть',
    mockMode: 'Симуляция',
    aiMode: 'AI тестирование',
    aiModel: 'AI модель',
    selectModel: 'Выберите модель',
    createAgentForm: 'Создание агента через форму',
    agentBasicInfo: 'Основная информация',
    agentName: 'Название агента',
    agentNamePlaceholder: 'Например: Ассистент для поддержки клиентов',
    agentDescription: 'Описание агента',
    agentDescriptionPlaceholder: 'Опишите, что делает ваш агент...',
    agentRole: 'Роль агента',
    agentRolePlaceholder: 'Например: Помощник службы поддержки',
    systemPrompt: 'Системный промпт',
    systemPromptPlaceholder: 'Введите системный промпт для агента...',
    agentCapabilities: 'Возможности агента',
    capabilitiesPlaceholder: 'Например: отвечать на вопросы, создавать задачи',
    addCapability: 'Добавить возможность',
    agentCategory: 'Категория',
    selectCategory: 'Выберите категорию',
    agentPricing: 'Ценообразование',
    pricingModel: 'Модель оплаты',
    price: 'Цена',
    agentTools: 'Инструменты и сервисы',
    mcpServers: 'MCP серверы',
    selectMcpServers: 'Выберите MCP серверы',
    memoryType: 'Тип памяти',
    selectMemoryType: 'Выберите тип памяти',
    uiInterface: 'UI интерфейс',
    selectUiInterface: 'Выберите интерфейс',
    createFromForm: 'Создать агента',
    formToCanvas: 'Преобразовать в Canvas',
    noComponentsYet: 'Компоненты ещё не добавлены',
    switchToCanvas: 'Переключитесь в режим Canvas для добавления компонентов',
    aiPrompt: 'AI Промпт',
    aiPromptTitle: 'Создание агента с помощью AI',
    aiPromptDescription: 'Опишите, какого агента вы хотите создать, и AI сгенерирует полную конфигурацию. Можно создать нового агента или отредактировать существующего.',
    createNew: 'Создать новый',
    editExisting: 'Редактировать текущий',
    yourPrompt: 'Ваш промпт',
    aiPromptPlaceholderCreate: 'Например: Создай агента для анализа данных о продажах с возможностью построения графиков и экспорта отчётов',
    aiPromptPlaceholderEdit: 'Например: Добавь возможность отправки отчётов по email',
    generateAgent: 'Сгенерировать агента',
    applyChanges: 'Применить изменения',
    clearPrompt: 'Очистить',
    aiResponse: 'Ответ AI',
    toast: {
      error: 'Ошибка',
      success: 'Успешно',
      warning: 'Предупреждение',
      loaded: 'Загружено',
      saved: 'Сохранено',
      copied: 'Скопировано',
      deleted: 'Удалено',
      downloaded: 'Скачано',
      failedToInitialize: 'Не удалось инициализировать конструктор',
      failedToLoadComponents: 'Не удалось загрузить компоненты',
      canvasLoaded: 'Холст "{name}" загружен',
      failedToLoadCanvas: 'Не удалось загрузить холст, создаём новый',
      failedToCreateCanvas: 'Не удалось создать холст',
      componentAdded: 'Компонент добавлен',
      failedToAdd: 'Не удалось добавить компонент',
      failedToUpdate: 'Не удалось обновить компонент',
      invalidJSON: 'Некорректный JSON',
      componentRemoved: 'Компонент удалён',
      failedToDelete: 'Не удалось удалить компонент',
      connectionExists: 'Соединение уже существует',
      connectionCreated: 'Соединение создано',
      failedToCreateConnection: 'Не удалось создать соединение',
      previewFailed: 'Не удалось запустить предпросмотр',
      generationFailed: 'Не удалось сгенерировать код',
      codeCopied: 'Код скопирован в буфер обмена',
      codeDownloaded: 'Код скачан',
      canvasSaved: 'Холст успешно сохранён',
      failedToSave: 'Не удалось сохранить холст'
    }
  },

  // Модуль сельского хозяйства
  agriculture: {
    title: 'Сельское хозяйство',
    productivity: {
      title: 'Продуктивность полей',
      addField: 'Добавить поле',
      fieldName: 'Название поля',
      area: 'Площадь',
      crop: 'Культура',
      yield: 'Урожайность',
      season: 'Сезон',
      edit: 'Редактировать поле',
      delete: 'Удалить поле',
      statistics: 'Статистика',
      averageYield: 'Средняя урожайность',
      totalArea: 'Общая площадь',
      totalProduction: 'Общее производство'
    },
    services: {
      title: 'Заказ услуг',
      pollination: 'Услуга опыления',
      fertilization: 'Услуга обработки удобрениями',
      orderService: 'Заказать услугу',
      serviceType: 'Тип услуги',
      date: 'Дата',
      status: 'Статус',
      pending: 'Ожидает',
      inProgress: 'В процессе',
      completed: 'Завершено',
      cancelled: 'Отменено'
    },
    recipes: {
      title: 'Рецептуры обработки',
      createRecipe: 'Создать рецептуру',
      recipeName: 'Название рецептуры',
      ingredients: 'Ингредиенты',
      dosage: 'Дозировка',
      application: 'Способ применения',
      notes: 'Примечания',
      edit: 'Редактировать рецептуру',
      delete: 'Удалить рецептуру'
    },
    missions: {
      title: 'Полетные задания',
      createMission: 'Создать задание',
      missionName: 'Название задания',
      field: 'Поле',
      recipe: 'Рецептура',
      drone: 'Дрон',
      date: 'Дата',
      status: 'Статус',
      planned: 'Запланировано',
      inProgress: 'Выполняется',
      completed: 'Завершено',
      failed: 'Не выполнено'
    }
  },

  // Модуль таблиц
  tables: {
    title: 'Таблицы',
    createTable: 'Создать таблицу',
    tableName: 'Название таблицы',
    columns: 'Столбцы',
    rows: 'Строки',
    addColumn: 'Добавить столбец',
    addRow: 'Добавить строку',
    deleteColumn: 'Удалить столбец',
    deleteRow: 'Удалить строку',
    columnName: 'Название столбца',
    columnType: 'Тип столбца',
    text: 'Текст',
    number: 'Число',
    date: 'Дата',
    boolean: 'Логический',
    select: 'Выбор',
    multiSelect: 'Множественный выбор',
    export: 'Экспорт',
    import: 'Импорт',
    filter: 'Фильтр',
    sort: 'Сортировка',
    search: 'Поиск',
    noData: 'Нет данных'
  },

  // Модуль чата
  chat: {
    title: 'Чат',
    sendMessage: 'Отправить сообщение',
    attachFile: 'Прикрепить файл',
    fromDevice: 'С устройства',
    tablesReports: 'Таблицы/отчёты',
    saveChat: 'Сохранить текущий чат',
    clearChat: 'Очистить чат',
    settings: 'Настройки',
    model: 'Модель',
    temperature: 'Температура',
    maxTokens: 'Макс. токенов',
    systemPrompt: 'Системный промпт',
    resetDefaults: 'Сбросить по умолчанию',
    tools: 'Инструменты',
    availableTools: 'Доступные инструменты',
    close: 'Закрыть',
    cancel: 'Отмена',
    attach: 'Прикрепить',
    save: 'Сохранить'
  },

  // Профиль и настройки пользователя
  profile: {
    title: 'Профиль',
    editProfile: 'Редактировать профиль',
    logout: 'Выход',
    name: 'Имя',
    email: 'Email',
    phone: 'Телефон',
    avatar: 'Аватар',
    changePassword: 'Изменить пароль',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    confirmPassword: 'Подтвердите пароль',
    saveChanges: 'Сохранить изменения',
    language: 'Язык',
    theme: 'Тема',
    notifications: 'Уведомления'
  },

  // Модуль API ключей
  apiKeys: {
    title: 'API Ключи',
    createNew: 'Создать новый ключ',
    keyName: 'Название ключа',
    permissions: 'Разрешения',
    created: 'Создан',
    lastUsed: 'Последнее использование',
    status: 'Статус',
    active: 'Активен',
    inactive: 'Неактивен',
    revoked: 'Отозван',
    edit: 'Редактировать',
    delete: 'Удалить',
    revoke: 'Отозвать',
    copyKey: 'Копировать ключ',
    showKey: 'Показать ключ',
    hideKey: 'Скрыть ключ',
    confirmDelete: 'Вы уверены, что хотите удалить этот API ключ?',
    confirmRevoke: 'Вы уверены, что хотите отозвать этот API ключ?',
    createKey: 'Создать ключ',
    saveKey: 'Сохранить'
  },

  // Видеоконференция
  videoConference: {
    title: 'Видеоконференция',
    startMeeting: 'Начать встречу',
    joinMeeting: 'Присоединиться к встрече',
    meetingId: 'ID встречи',
    copyLink: 'Копировать ссылку',
    shareScreen: 'Демонстрация экрана',
    stopScreenShare: 'Остановить демонстрацию',
    toggleCamera: 'Включить/выключить камеру',
    toggleMicrophone: 'Включить/выключить микрофон',
    leaveMeeting: 'Покинуть встречу',
    endMeeting: 'Завершить встречу',
    participants: 'Участники',
    chat: 'Чат',
    settings: 'Настройки',
    audioSettings: 'Настройки аудио',
    videoSettings: 'Настройки видео',
    selectMicrophone: 'Выбрать микрофон',
    selectCamera: 'Выбрать камеру',
    selectSpeaker: 'Выбрать динамик'
  },

  // Аналитика YouTube
  youtubeAnalytics: {
    title: 'Аналитика YouTube',
    channelUrl: 'URL канала',
    analyze: 'Анализировать',
    loading: 'Загрузка...',
    statistics: 'Статистика',
    subscribers: 'Подписчики',
    views: 'Просмотры',
    videos: 'Видео',
    averageViews: 'Средние просмотры на видео',
    engagement: 'Уровень вовлеченности',
    topVideos: 'Топ видео',
    recentVideos: 'Недавние видео',
    videoTitle: 'Название',
    videoViews: 'Просмотры',
    videoLikes: 'Лайки',
    videoComments: 'Комментарии',
    publishedAt: 'Опубликовано',
    exportData: 'Экспорт данных',
    exportJSON: 'Экспорт в JSON',
    exportCSV: 'Экспорт в CSV',
    clear: 'Очистить',
    aiAnalysis: 'AI анализ',
    selectModel: 'AI модель для анализа'
  },

  // Веб-скрапер
  webScraper: {
    title: 'Парсер сайтов',
    url: 'URL',
    startParsing: 'Начать парсинг',
    parsing: 'Парсинг...',
    results: 'Результаты',
    total: 'Всего',
    exportJSON: 'Экспорт в JSON',
    exportCSV: 'Экспорт в CSV',
    clear: 'Очистить',
    selectSource: 'Выбрать источник',
    avitoRealEstate: 'Avito Недвижимость',
    cianRealEstate: 'CIAN Недвижимость',
    customUrl: 'Свой URL',
    filters: 'Фильтры',
    city: 'Город',
    priceMin: 'Мин. цена',
    priceMax: 'Макс. цена',
    area: 'Площадь',
    rooms: 'Комнаты',
    aiModel: 'AI модель для анализа'
  },

  // Криптокошелек
  cryptoWallet: {
    title: 'Криптокошелек',
    totalBalance: 'Общий баланс',
    addWallet: 'Добавить кошелек',
    wallets: 'Кошельки',
    currency: 'Валюта',
    balance: 'Баланс',
    value: 'Стоимость',
    send: 'Отправить',
    receive: 'Получить',
    transactions: 'Транзакции',
    date: 'Дата',
    type: 'Тип',
    amount: 'Сумма',
    status: 'Статус',
    pending: 'Ожидает',
    completed: 'Завершено',
    failed: 'Не выполнено',
    address: 'Адрес',
    copyAddress: 'Копировать адрес',
    qrCode: 'QR код',
    settings: 'Настройки',
    security: 'Безопасность',
    supportedCurrencies: 'Поддерживаемые валюты',
    about: 'О модуле',
    features: 'Возможности',
    display: 'Отображение',
    notifications: 'Уведомления'
  },

  // Управление дронами
  drone: {
    title: 'Управление дронами',
    controlPanel: 'Панель управления',
    buildAnalytics: 'Аналитика сборки',
    status: 'Статус',
    connected: 'Подключен',
    disconnected: 'Отключен',
    battery: 'Батарея',
    altitude: 'Высота',
    speed: 'Скорость',
    gps: 'GPS',
    takeoff: 'Взлет',
    land: 'Посадка',
    returnHome: 'Возврат домой',
    emergency: 'Экстренная остановка',
    flightMode: 'Режим полета',
    manual: 'Ручной',
    automatic: 'Автоматический',
    waypoints: 'Точки маршрута',
    mission: 'Миссия',
    motors: 'Моторы',
    batteryDetails: 'Аккумулятор',
    stack: 'Стек (Flight Controller)',
    propellers: 'Пропеллеры',
    compatibility: 'Совместимость компонентов'
  },

  // Источники данных
  dataSources: {
    title: 'Источники данных',
    subtitle: 'Управление подключениями к внешним источникам данных',
    addSource: 'Добавить источник',
    addFirst: 'Добавить первый источник',
    empty: 'Нет подключенных источников данных',
    saved: 'Источник сохранен',
    savedMessage: 'Источник данных успешно сохранен',
    neverSynced: 'Никогда',

    stats: {
      total: 'Всего источников',
      active: 'Активных',
      syncs: 'Синхронизаций',
      errors: 'Ошибок'
    },

    filters: {
      type: 'Тип',
      status: 'Статус',
      allTypes: 'Все типы',
      allStatuses: 'Все статусы',
      reset: 'Сбросить фильтры'
    },

    table: {
      name: 'Название',
      type: 'Тип',
      status: 'Статус',
      lastSync: 'Последняя синхронизация',
      syncCount: 'Количество синхронизаций',
      actions: 'Действия'
    },

    actions: {
      test: 'Тестировать подключение',
      sync: 'Синхронизировать',
      edit: 'Редактировать',
      delete: 'Удалить'
    },

    test: {
      success: 'Подключение успешно',
      failed: 'Подключение не удалось',
      error: 'Ошибка тестирования'
    },

    sync: {
      success: 'Синхронизация завершена',
      failed: 'Синхронизация не удалась',
      recordsProcessed: 'Обработано записей: {count}'
    },

    delete: {
      title: 'Удалить источник данных',
      message: 'Вы уверены, что хотите удалить источник "{name}"?',
      success: 'Источник удален',
      successMessage: 'Источник данных "{name}" успешно удален',
      failed: 'Не удалось удалить источник'
    },

    errors: {
      loadFailed: 'Не удалось загрузить источники данных'
    },

    types: {
      restApi: {
        description: 'Подключение к REST API эндпоинтам'
      },
      database: {
        description: 'Подключение к базам данных'
      },
      fileUpload: {
        description: 'Загрузка данных из файлов'
      },
      webhook: {
        description: 'Получение данных через вебхуки'
      },
      googleSheets: {
        description: 'Синхронизация с Google Таблицами'
      },
      integram: {
        description: 'Подключение к базе данных Интеграм'
      }
    },

    wizard: {
      title: 'Добавить источник данных',
      editTitle: 'Редактировать источник данных',

      steps: {
        type: 'Тип',
        basic: 'Основная информация',
        config: 'Конфигурация',
        credentials: 'Учетные данные',
        review: 'Проверка'
      },

      step1: {
        title: 'Выберите тип источника данных',
        description: 'Выберите тип источника данных, который вы хотите подключить'
      },

      step2: {
        title: 'Основная информация',
        description: 'Укажите название и описание источника данных',
        name: 'Название',
        namePlaceholder: 'Введите название источника данных',
        description: 'Описание',
        descriptionPlaceholder: 'Введите описание (опционально)'
      },

      step3: {
        title: 'Конфигурация подключения',
        description: 'Настройте параметры подключения',
        endpoint: 'Эндпоинт',
        method: 'HTTP метод',
        authType: 'Тип аутентификации',
        timeout: 'Таймаут',
        databaseType: 'Тип базы данных',
        host: 'Хост',
        port: 'Порт',
        database: 'База данных',
        webhookInfo: 'Вебхук URL будет сгенерирован после создания',
        fileType: 'Тип файла',
        spreadsheetId: 'ID Google Таблицы',
        sheetName: 'Название листа',
        databaseName: 'Название базы данных',
        username: 'Имя пользователя',
        password: 'Пароль'
      },

      step4: {
        title: 'Учетные данные',
        description: 'Выберите учетные данные для подключения',
        selectSecret: 'Выберите секрет',
        selectSecretPlaceholder: 'Выберите существующий секрет',
        secretHelp: 'Секреты хранятся в безопасном хранилище организации',
        noSecrets: 'Нет доступных секретов. Создайте секрет в настройках организации.'
      },

      step5: {
        title: 'Проверка и подтверждение',
        description: 'Проверьте настройки перед сохранением',
        sourceType: 'Тип источника',
        name: 'Название',
        description: 'Описание',
        configuration: 'Конфигурация',
        secret: 'Секрет'
      }
    }
  },

  // Агент 1С
  onecAgent: {
    title: 'Агент интеграции 1С',
    checkConnection: 'Проверить подключение',
    getDatabaseStructure: 'Получить структуру базы',
    unload: 'Выгрузить',
    unloadData: 'Выгрузить данные',
    loadData: 'Загрузить данные'
  },

  // Отслеживание посылок
  packageTracking: {
    title: 'Отслеживание посылок',
    track: 'Отследить',
    save: 'Сохранить',
    update: 'Обновить',
    updateAll: 'Обновить все'
  },

  // Парсер групп
  groupParserBot: {
    title: 'Парсер Telegram групп',
    checkConnection: 'Проверить подключение',
    loadGroups: 'Загрузить группы',
    updateList: 'Обновить список',
    parse: 'Парсить',
    update: 'Обновить'
  },

  // Мониторинг конкурентов
  competitorMonitor: {
    title: 'Мониторинг конкурентов',
    aiModel: 'AI модель для анализа'
  },

  // GitHub агент
  githubAgent: {
    // Диалоги
    tokenDialog: {
      header: 'GitHub Personal Access Token',
      githubToken: 'GitHub Token'
    },
    viewTokenDialog: {
      header: 'GitHub Personal Access Token'
    },
    createIssueDialog: {
      header: 'Создать новый Issue'
    },
    createPRDialog: {
      header: 'Создать Pull Request'
    },
    mergeDialog: {
      header: 'Подтвердите мерж'
    },
    clearTokenDialog: {
      header: 'Подтвердите удаление токена'
    },
    issueDetailsDialog: {
      header: 'Issue #{number}',
      loading: 'Загрузка...'
    },
    prDetailsDialog: {
      header: 'Pull Request #{number}',
      loading: 'Загрузка...'
    },
    editCommentDialog: {
      header: 'Редактировать комментарий'
    },
    editBodyDialog: {
      headerIssue: 'Редактировать описание issue',
      headerPR: 'Редактировать описание PR'
    },
    deleteCommentDialog: {
      header: 'Удалить комментарий'
    },
    createReviewDialog: {
      header: 'Создать отзыв'
    },
    // Вкладки
    tabs: {
      issues: 'Issues',
      pullRequests: 'Pull Requests'
    }
  },

  // Backend Dashboard
  backendDashboard: {
    title: 'Панель управления Backend',
    subtitle: 'Комплексная панель для мониторинга, управления и развертывания всех backend сервисов',
    refreshAll: 'Обновить всё',
    systemHealth: 'Состояние системы',

    // Overview Cards
    overview: {
      systemStatus: 'Статус системы',
      serverIp: 'IP сервера',
      memoryUsage: 'Использование памяти',
      activeServices: 'Активные сервисы',
      apiEndpoints: 'API эндпоинты',
      environment: 'Окружение',
      loading: 'Загрузка...',
      unknown: 'неизвестно',
      free: 'свободно',
      healthy: 'здоровых',
      categories: 'категорий'
    },

    // Tabs
    tabs: {
      services: 'Сервисы',
      endpoints: 'API Эндпоинты',
      configuration: 'Конфигурация',
      deployment: 'Развертывание',
      logs: 'Логи',
      metrics: 'Метрики'
    },

    // Services Tab
    services: {
      searchPlaceholder: 'Поиск сервисов...',
      filterByStatus: 'Фильтр по статусу',
      allStatus: 'Все статусы',
      running: 'Работает',
      stopped: 'Остановлен',
      unknown: 'Неизвестно',
      serviceName: 'Название сервиса',
      status: 'Статус',
      health: 'Здоровье',
      ipAddress: 'IP адрес',
      location: 'Местоположение',
      port: 'Порт',
      uptime: 'Время работы',
      actions: 'Действия',
      viewDetails: 'Просмотр деталей',
      openServiceUrl: 'Открыть URL сервиса',
      restartService: 'Перезапустить сервис',
      na: 'Н/Д'
    },

    // Endpoints Tab
    endpoints: {
      searchPlaceholder: 'Поиск эндпоинтов...',
      filterByCategory: 'Фильтр по категории',
      allCategories: 'Все категории',
      endpoint: 'Эндпоинт',
      category: 'Категория',
      sourceFile: 'Исходный файл',
      size: 'Размер',
      lastModified: 'Последнее изменение',
      actions: 'Действия',
      apiDocumentation: 'API документация',
      viewSourceCode: 'Просмотр исходного кода'
    },

    // Configuration Tab
    configuration: {
      serverConfiguration: 'Конфигурация сервера',
      port: 'Порт',
      httpsEnabled: 'HTTPS включен',
      environment: 'Окружение',
      yes: 'Да',
      no: 'Нет',
      featureFlags: 'Флаги функций',
      redis: 'Redis',
      database: 'База данных',
      openai: 'OpenAI',
      deepseek: 'DeepSeek',
      youtubeApi: 'YouTube API',
      stripe: 'Stripe',
      pathsDirectories: 'Пути и директории',
      workingDirectory: 'Рабочая директория',
      uploadsDirectory: 'Директория загрузок',
      dataDirectory: 'Директория данных',
      logsDirectory: 'Директория логов'
    },

    // Deployment Tab
    deployment: {
      currentDeployment: 'Текущее развертывание',
      environment: 'Окружение',
      version: 'Версия',
      deployedAt: 'Развернуто',
      gitBranch: 'Git ветка',
      gitCommit: 'Git коммит',
      deploymentActions: 'Действия развертывания',
      deployToProduction: 'Развернуть в продакшн',
      deployToStaging: 'Развернуть на staging',
      rollback: 'Откатить',
      deploymentHistory: 'История развертываний',
      noHistory: 'История развертываний недоступна',
      confirmProduction: 'Вы уверены, что хотите развернуть в продакшн?',
      confirmRollback: 'Вы уверены, что хотите откатить развертывание?',
      comingSoon: 'Функция скоро появится'
    },

    // Logs Tab
    logs: {
      title: 'Файлы логов',
      refresh: 'Обновить список',
      development: 'Разработка (dev.drondoc.ru)',
      production: 'Продакшн (drondoc.ru)',
      backendMonolith: 'Backend Монолит',
      noLogs: 'Нет доступных логов',
      selectFile: 'Выберите лог-файл для просмотра',
      loading: 'Загрузка лога...',
      empty: 'Лог пуст или недоступен',
      download: 'Скачать',
      autoRefresh: 'Авто-обновление',
      stopAutoRefresh: 'Остановить авто-обновление',
      startAutoRefresh: 'Включить авто-обновление',
      lines: 'Строк',
      tailMode: 'Последние строки',
      apply: 'Применить',
      fileSize: 'Размер',
      totalLines: 'Строк',
      modified: 'Изменён',
      showingLines: 'Показано строк',
      of: 'из',
      autoRefreshEnabled: 'Авто-обновление включено',
      autoRefreshDisabled: 'Авто-обновление выключено',
      every: 'каждые',
      seconds: 'секунд',
      errorLoading: 'Не удалось загрузить',
      errorDownload: 'Не удалось скачать лог файл',
      successDownload: 'Лог файл скачан',
      fileUnavailable: 'Файл лога недоступен'
    },

    // Metrics Tab
    metrics: {
      systemMemory: 'Системная память',
      cpuInformation: 'Информация о CPU',
      processMemory: 'Память процесса',
      total: 'Всего',
      used: 'Использовано',
      free: 'Свободно',
      usage: 'Использование',
      cores: 'Ядра',
      model: 'Модель',
      loadAverage: 'Средняя загрузка (1м)',
      heapUsed: 'Heap используется',
      heapTotal: 'Heap всего',
      external: 'Внешняя',
      rss: 'RSS'
    },

    // Service Details Dialog
    serviceDetails: {
      serviceInformation: 'Информация о сервисе',
      status: 'Статус',
      health: 'Здоровье',
      type: 'Тип',
      port: 'Порт',
      serverInformation: 'Информация о сервере',
      ipAddress: 'IP адрес',
      hostname: 'Имя хоста',
      domain: 'Домен',
      location: 'Местоположение',
      allIpAddresses: 'Все IP адреса',
      publicIps: 'Публичные IP:',
      privateIps: 'Приватные IP:',
      serviceUrl: 'URL сервиса',
      open: 'Открыть',
      endpoints: 'Эндпоинты',
      description: 'Описание',
      na: 'Н/Д'
    }
  },

  // Воркфлоу (Workflow)
  workflow: {
    title: 'Воркфлоу',
    settings: 'Настройка воркфлоу',
    agent: 'Агент',
    createFrame: 'Создать рамку',
    cancelFrame: 'Отменить рамку',
    group: 'Группировать',
    autoLayout: 'Авто-раскладка',
    validate: 'Валидировать',
    save: 'Сохранить',
    nodes: 'Узлы воркфлоу',
    searchNodes: 'Поиск узлов...',
    startCreating: 'Начните создавать воркфлоу',
    apply: 'Применить',
    applyAndSave: 'Применить и сохранить',
    validationErrors: 'Ошибки валидации',
    fixErrors: 'Исправьте ошибки в воркфлоу',
    saved: 'Воркфлоу сохранён',
    saveSuccess: 'Воркфлоу успешно сохранён'
  },

  // Категории агентов
  agentCategories: {
    all: 'Все категории',
    ai: 'ИИ и ML',
    analytics: 'Аналитика',
    drones: 'Дроны и IoT',
    automation: 'Автоматизация',
    text: 'Обработка текста',
    web: 'Веб-инструменты',
    business: 'Бизнес',
    hr: 'HR',
    design: 'Дизайн',
    sales: 'Продажи',
    communication: 'Коммуникация',
    education: 'Образование',
    development: 'Разработка'
  },

  // Страница агентов
  agentsPage: {
    title: 'Агенты',
    subtitle: 'Умные агенты собирают данные и выполняют действия в каждом мини-приложении. Используйте готовые решения или создайте своего агента',
    createAgent: 'Создать агента',
    searchPlaceholder: 'Поиск агентов...',
    createDialog: {
      title: 'Создать нового агента',
      name: 'Название агента',
      namePlaceholder: 'Например: Агент анализа данных',
      description: 'Описание',
      descriptionPlaceholder: 'Опишите, какие данные собирает агент и какие действия выполняет...',
      category: 'Категория',
      categoryPlaceholder: 'Выберите категорию',
      icon: 'Иконка (emoji)',
      iconPlaceholder: '🤖',
      aiAssistant: 'ИИ-Ассистент',
      aiHelp: 'Опишите, какие данные должен собирать агент и какие действия выполнять, и наш ИИ поможет создать его',
      aiPromptPlaceholder: 'Например: Создай агента для сбора и анализа тональности текстов из социальных сетей с автоматической генерацией отчетов',
      generateWithAI: 'Сгенерировать с помощью ИИ'
    },
    creator: 'DronDoc Team',
    statusRunning: 'Работает',
    statusDraft: 'Черновик',
    statusBeta: 'Бета'
  },

  // Issue #4960: Agent Purchase Translations
  agentCard: {
    free: 'Бесплатно',
    month: 'мес',
    activate: 'Активировать',
    buy: 'Купить',
    subscribe: 'Подписаться',
    get: 'Получить'
  },

  // Issue #4987: Agent Comparison Translations
  agentCompare: {
    title: 'Сравнение агентов',
    subtitle: 'Сравните {count} агентов и выберите лучший для ваших задач',
    selected: '{count} выбрано',
    more: 'ещё',
    clear: 'Очистить',
    compare: 'Сравнить',
    addMore: 'Добавить агенты',
    feature: 'Характеристика',
    features: {
      price: 'Цена',
      pricingModel: 'Модель оплаты',
      status: 'Статус',
      category: 'Категория',
      description: 'Описание',
      tags: 'Функции и возможности'
    },
    pricingModels: {
      free: 'Бесплатно',
      oneTime: 'Единоразовая покупка',
      subscription: 'Подписка'
    },
    emptyTitle: 'Выберите агенты для сравнения',
    emptyDescription: 'Вернитесь на страницу агентов и отметьте чекбоксы на карточках агентов, которые хотите сравнить',
    browseAgents: 'Перейти к агентам',
    maxReached: 'Достигнут лимит',
    maxReachedDetail: 'Можно сравнить максимум 5 агентов одновременно',
    notEnoughAgents: 'Недостаточно агентов',
    notEnoughAgentsDetail: 'Выберите хотя бы 2 агента для сравнения',
    purchaseInitiated: 'Переход к покупке',
    noAgentsFound: 'Агенты не найдены'
  },

  agentPurchase: {
    title: 'Покупка агента',
    by: 'От',
    pricingDetails: 'Информация о ценах',
    free: 'Бесплатно',
    month: 'мес',
    paymentMethod: 'Способ оплаты',
    activate: 'Активировать',
    buyNow: 'Купить',
    subscribe: 'Подписаться',
    models: {
      free: 'Бесплатно',
      oneTime: 'Единоразовая оплата',
      subscription: 'Подписка'
    },
    methods: {
      card: 'Банковская карта',
      yookassa: 'ЮКасса',
      stripe: 'Stripe'
    },
    features: {
      basicAccess: 'Базовый доступ',
      lifetimeAccess: 'Бессрочный доступ',
      monthlyUpdates: 'Ежемесячные обновления',
      prioritySupport: 'Приоритетная поддержка',
      cancelAnytime: 'Отмена в любое время'
    },
    success: {
      activated: 'Агент успешно активирован',
      alreadyActivated: 'Этот агент уже активирован для вашего аккаунта',
      purchased: 'Агент успешно приобретен',
      subscribed: 'Подписка на агента оформлена',
      activatedDetail: '{name} добавлен в "Мои агенты"',
      purchasedDetail: '{name} добавлен в "Мои агенты"',
      subscribedDetail: '{name} добавлен в "Мои агенты"'
    },
    error: {
      activationFailed: 'Не удалось активировать агента',
      purchaseFailed: 'Не удалось купить агента',
      subscriptionFailed: 'Не удалось оформить подписку'
    },
    actions: {
      openAgent: 'Открыть агента',
      goToMyAgents: 'Перейти в Мои агенты',
      continueShopping: 'Продолжить покупки',
      whatNext: 'Что делать дальше?'
    }
  },

  // Backend Configuration
  backendConfig: {
    title: 'Конфигурация бэкенда и БД',
    refresh: 'Обновить',
    save: 'Сохранить',

    // Tabs
    tabs: {
      monolith: 'Монолитный бэкенд',
      integram: 'База данных Integram',
      endpoints: 'Маппинг эндпоинтов',
      test: 'Тестирование соединения'
    },

    // Monolith Backend
    monolith: {
      info: 'Настройте параметры подключения к монолитному бэкенду DronDoc (Node.js/Express)',
      backendSettings: 'Настройки сервера бэкенда',
      backendUrl: 'URL бэкенда',
      backendUrlPlaceholder: 'http://localhost:8081',
      backendUrlHelp: 'URL-адрес сервера монолитного бэкенда',
      port: 'Порт',
      portPlaceholder: '8081',
      portHelp: 'Порт сервера бэкенда',

      // Database
      databaseSettings: 'Настройки базы данных (PostgreSQL)',
      dbHost: 'Хост базы данных',
      dbHostPlaceholder: 'localhost',
      dbPort: 'Порт базы данных',
      dbPortPlaceholder: '5432',
      dbName: 'Имя базы данных',
      dbNamePlaceholder: 'dronedoc',
      dbUser: 'Пользователь БД',
      dbUserPlaceholder: 'dronedoc',
      dbPassword: 'Пароль БД',
      dbPasswordPlaceholder: 'password',

      // Authentication
      authSettings: 'Настройки аутентификации',
      jwtSecret: 'JWT Secret',
      jwtSecretPlaceholder: 'Секретный ключ для подписи JWT',
      jwtSecretHelp: 'Секретный ключ для подписи и проверки JWT токенов',
      accessTokenExpiry: 'Срок действия Access Token',
      accessTokenExpiryPlaceholder: '15m',
      accessTokenExpiryHelp: 'Формат: 15m, 1h, 7d и т.д.',
      refreshTokenExpiry: 'Срок действия Refresh Token',
      refreshTokenExpiryPlaceholder: '7d',
      refreshTokenExpiryHelp: 'Формат: 15m, 1h, 7d и т.д.'
    },

    // Integram
    integram: {
      info: 'Настройте параметры подключения к базе данных Integram (ddadmin)',
      apiSettings: 'Настройки API Integram',
      apiUrl: 'URL API Integram',
      apiUrlPlaceholder: 'https://ai2o.ru',
      apiUrlHelp: 'Базовый URL для Integram API',
      database: 'Имя базы данных',
      databasePlaceholder: 'ddadmin',
      databaseHelp: 'Имя базы данных Integram (например, ddadmin, a2025)',

      // Credentials
      adminCredentials: 'Учетные данные администратора',
      adminLogin: 'Логин администратора',
      adminLoginPlaceholder: 'd',
      adminLoginHelp: 'Логин администратора для базы ddadmin',
      adminPassword: 'Пароль администратора',
      adminPasswordPlaceholder: 'd',
      adminPasswordHelp: 'Пароль администратора для базы ddadmin',

      // Tables
      dataTables: 'Таблицы данных',
      usersTable: 'ID таблицы пользователей',
      usersTablePlaceholder: '18',
      usersTableHelp: 'ID таблицы Integram для пользователей',
      menusTable: 'ID таблицы меню',
      menusTablePlaceholder: 'ID типа меню',
      menusTableHelp: 'ID таблицы Integram для меню',
      agentsTable: 'ID таблицы агентов',
      agentsTablePlaceholder: 'ID типа агента',
      agentsTableHelp: 'ID таблицы Integram для агентов',
      tokensTable: 'ID таблицы токенов',
      tokensTablePlaceholder: 'ID типа токена',
      tokensTableHelp: 'ID таблицы Integram для токенов',
      paymentsTable: 'ID таблицы платежей',
      paymentsTablePlaceholder: 'ID типа платежа',
      paymentsTableHelp: 'ID таблицы Integram для платежей'
    },

    // Endpoint Mapping
    endpoints: {
      info: 'Сопоставьте эндпоинты монолитного бэкенда с ID таблиц Integram',
      mappingsTitle: 'Маппинг эндпоинт → Таблица',
      backendEndpoint: 'Эндпоинт бэкенда',
      tableId: 'ID таблицы Integram',
      description: 'Описание',
      addMapping: 'Добавить новый маппинг',
      mappingUpdated: 'Маппинг обновлен',
      mappingUpdatedDetail: 'Маппинг эндпоинта был обновлен'
    },

    // Testing
    test: {
      info: 'Протестируйте соединения с бэкендом и базой данных Integram',
      monolithTests: 'Тесты монолитного бэкенда',
      testHealth: 'Проверить работоспособность',
      testDatabase: 'Проверить подключение к БД',
      testAuth: 'Проверить аутентификацию',
      integramTests: 'Тесты базы данных Integram',
      testAPI: 'Проверить Integram API',
      testIntegramAuth: 'Проверить аутентификацию',
      testDict: 'Проверить доступ к справочнику',
      testResults: 'Результаты тестов:',
      passed: 'УСПЕШНО',
      failed: 'ОШИБКА'
    },

    // Messages
    messages: {
      configLoaded: 'Конфигурация загружена',
      configSaved: 'Конфигурация успешно сохранена',
      useCachedConfig: 'Используется кэшированная конфигурация',
      couldNotLoadFromServer: 'Не удалось загрузить с сервера, используется локальный кэш',
      savedLocally: 'Сохранено локально',
      savedToLocalStorage: 'Конфигурация сохранена в хранилище браузера',
      testPassed: 'Тест пройден',
      testFailed: 'Тест не пройден',
      backendHealthy: 'Бэкенд работает исправно',
      backendHealthSuccess: 'Проверка работоспособности бэкенда успешна',
      backendHealthFailed: 'Проверка работоспособности бэкенда не удалась',
      dbConnectionSuccess: 'Подключение к базе данных успешно',
      dbConnectionFailed: 'Тест подключения к базе данных не прошел',
      authTestSuccess: 'Система аутентификации работает',
      authTestFailed: 'Тест аутентификации не прошел',
      integramAPISuccess: 'Успешно подключено к Integram API',
      integramAPIAccessible: 'Integram API доступен',
      integramAPIFailed: 'Не удалось подключиться к Integram API',
      integramAuthSuccess: 'Успешная аутентификация',
      integramAuthFailed: 'Аутентификация не удалась',
      integramAuthSuccessDetail: 'Аутентификация Integram успешна',
      integramDictSuccess: 'Доступ к справочнику успешен',
      integramDictFailed: 'Доступ к справочнику не удался',
      failedToConnect: 'Не удалось подключиться'
    }
  },

  // Landing Page
  landing: {
    hero: {
      badge: 'КБ трансформации бизнеса — AI-Native платформа',
      titleLine1: 'Конструкторское бюро',
      titleLine2: 'трансформации бизнеса',
      titleLine3: 'через ИИ-агентов',
      title: 'КБ трансформации бизнеса через ИИ-агентов',
      subtitle: 'Проектируем и внедряем AI-Native бизнес-процессы. От анализа AS-IS до запуска агентов — за дни, не месяцы.',
      cta: 'Начать трансформацию',
      ctaDemo: 'Смотреть демо',
      ctaROI: 'Рассчитать экономию',
      proof1: '500+ AI-агентов в работе',
      proof2: 'Запуск за 1 день',
      proof3: 'Безопасность данных',
      terminalTitle: 'Агент трансформации',
      terminalAgent: 'transformation-agent ~ live',
      terminalStatus: 'Агент активен',
      statAgents: 'агентов',
      statTasks: 'задач/день',
      statSavings: 'экономия',
      chatPlaceholder: 'Опишите процесс для автоматизации...',
      chatTitle: 'Анализ бизнес-процесса',
      chatSubtitle: 'Проектируем AI-агента для вашей задачи',
      chatSend: 'Запустить анализ'
    },

    agentDemo: {
      badge: 'Демо в реальном времени',
      title: 'Наблюдайте, как работают',
      titleHighlight: ' AI-агенты',
      subtitle: 'Интерактивные демонстрации реальных сценариев автоматизации для разных отделов',
      result: 'Результат трансформации:',
      scenario: {
        support: 'Поддержка клиентов',
        supportTitle: 'AI-агент первой линии поддержки',
        supportDesc: 'Агент обрабатывает входящие обращения, классифицирует их по теме, отвечает на типовые вопросы и передаёт сложные кейсы в нужный отдел.',
        supportResult: 'Сокращение нагрузки на команду поддержки на 70%. Среднее время ответа — 1.2 секунды.',
        sales: 'Отдел продаж',
        salesTitle: 'AI-агент квалификации лидов',
        salesDesc: 'Агент автоматически оценивает входящих лидов, задаёт уточняющие вопросы, скорит и передаёт горячих клиентов менеджерам с готовым контекстом.',
        salesResult: 'Конверсия лидов в сделки увеличивается на 35%. Менеджеры работают только с квалифицированными лидами.',
        analytics: 'Аналитика',
        analyticsTitle: 'AI-агент бизнес-аналитики',
        analyticsDesc: 'Агент ежедневно собирает данные из всех систем, анализирует KPI, выявляет аномалии и отправляет отчёты нужным людям.',
        analyticsResult: 'Ежедневные аналитические отчёты без аналитика. Аномалии выявляются автоматически.'
      },
      step: {
        receive: 'Получение обращения',
        receiveDesc: 'Входящее сообщение из любого канала',
        classify: 'Классификация',
        classifyDesc: 'AI определяет тему и приоритет',
        respond: 'Ответ клиенту',
        respondDesc: 'Мгновенный ответ из базы знаний',
        escalate: 'Эскалация',
        escalateDesc: 'Передача сложных кейсов специалисту',
        qualify: 'Квалификация лида',
        qualifyDesc: 'Оценка потенциала клиента',
        nurture: 'Прогрев',
        nurtureDesc: 'Персонализированная коммуникация',
        book: 'Запись на встречу',
        bookDesc: 'Автоматическое бронирование слота',
        handoff: 'Передача менеджеру',
        handoffDesc: 'Горячий лид с контекстом',
        collect: 'Сбор данных',
        collectDesc: 'Агрегация из CRM, 1С, аналитики',
        analyze: 'Анализ',
        analyzeDesc: 'Выявление трендов и аномалий',
        report: 'Отчёт',
        reportDesc: 'Автоматическая рассылка отчётов',
        alert: 'Алерты',
        alertDesc: 'Уведомления о критических изменениях'
      }
    },

    bento: {
      badge: 'Платформенные возможности',
      title: 'Всё для AI-Native бизнеса',
      subtitle: 'Единая платформа для проектирования, запуска и масштабирования AI-агентов',
      card1: {
        tag: 'Конструктор',
        title: 'No-Code конструктор агентов',
        desc: 'Создавайте AI-агентов без программирования. Визуальный редактор, готовые шаблоны, MCP-интеграции и поддержка всех LLM-моделей.'
      },
      card2: {
        title: 'Работа круглосуточно',
        desc: 'AI-агенты не уходят на больничный и не берут отпуск. Обслуживание клиентов и автоматизация процессов без перерывов.'
      },
      card3: {
        title: 'Готовые интеграции',
        desc: 'Telegram, CRM, 1С, Google Sheets, Bitrix24, AmoCRM, Notion и 50+ других сервисов из коробки.'
      },
      card4: {
        title: 'Аналитика эффективности',
        desc: 'Отслеживайте ROI каждого агента, конверсию, время обработки и качество ответов в реальном времени.'
      },
      card5: {
        title: 'Корпоративная безопасность',
        desc: 'Данные клиентов защищены шифрованием. Соответствие требованиям GDPR и 152-ФЗ. Развёртывание в изолированном контуре.'
      },
      card6: {
        title: 'Мультиканальность',
        desc: 'Один агент — все каналы. Telegram, Web-виджет, WhatsApp, Email, REST API и голосовые интерфейсы.'
      },
      tag: {
        templates: 'Шаблоны',
        mcp: 'MCP',
        llm: 'LLM',
        flow: 'Flow'
      },
      security: {
        encryption: 'Шифрование данных',
        gdpr: 'GDPR / 152-ФЗ',
        audit: 'Журнал аудита',
        rbac: 'Ролевой доступ',
        backup: 'Резервное копирование',
        sla: 'SLA 99.9%'
      },
      channel: {
        voice: 'Голос'
      }
    },

    transform: {
      badge: 'AS-IS → TO-BE трансформация',
      title: 'Как меняется ваш бизнес',
      subtitle: 'Сравните текущее состояние процессов с AI-Native подходом',
      before: {
        label: 'До трансформации',
        title: 'Традиционная модель',
        cost: 'Операционные затраты',
        costValue: '1 200 000₽/мес',
        costNote: 'на команду из 8 человек'
      },
      after: {
        label: 'После трансформации',
        title: 'AI-Native модель',
        cost: 'Операционные затраты',
        costValue: '120 000₽/мес',
        costNote: 'экономия 90% при том же результате'
      },
      pain: {
        hiring: 'Найм занимает 2-3 месяца',
        hiringDesc: 'HR, собеседования, онбординг',
        cost: 'Высокие ФОТ и накладные',
        costDesc: 'Зарплата + налоги + офис',
        errors: 'Человеческий фактор',
        errorsDesc: 'Ошибки, усталость, забывчивость',
        availability: 'Работа только 8 ч/день',
        availabilityDesc: 'Выходные, отпуска, больничные'
      },
      gain: {
        deploy: 'Запуск за 1 день',
        deployDesc: 'Вместо 2-3 месяцев найма',
        deployStat: '1 день',
        cost: 'Стоимость 10% от сотрудника',
        costDesc: 'Экономия операционных расходов',
        costStat: '-90% затрат',
        quality: 'Нулевой человеческий фактор',
        qualityDesc: 'Точные ответы по базе знаний',
        qualityStat: '99.9% точность',
        availability: 'Работает без остановок',
        availabilityDesc: 'Всегда онлайн, любой канал'
      },
      cta: 'Начать трансформацию бесплатно'
    },

    useCases: {
      badge: 'Отраслевые решения',
      title: 'AI-трансформация по отраслям',
      subtitle: 'Готовые кейсы и шаблоны для разных индустрий — от розницы до недвижимости',
      retail: {
        industry: 'Розничная торговля',
        title: 'Цифровой ассистент магазина',
        feature1: 'Приём и обработка заказов 24/7',
        feature2: 'Консультации по ассортименту',
        feature3: 'Обработка возвратов и жалоб',
        feature4: 'Персональные рекомендации',
        roi: 'Экономия до 300 000₽/мес при замене 2 операторов на AI-агента'
      },
      telecom: {
        industry: 'Телекоммуникации',
        title: 'Разгрузка колл-центра на 60%',
        feature1: 'Консультации по тарифам и подключению',
        feature2: 'Обработка заявок на подключение',
        feature3: 'Техническая поддержка 1-й линии',
        feature4: 'Upsell и переключение на нужный тариф',
        roi: '-60% звонков в колл-центр, +25% конверсия в продажи'
      },
      finance: {
        industry: 'Финансы и страхование',
        title: 'Автоматизация клиентского сервиса',
        feature1: 'Консультации по продуктам банка/страховки',
        feature2: 'Сбор и верификация документов',
        feature3: 'Обработка заявок на кредит / полис',
        feature4: 'Напоминания и уведомления клиентам',
        roi: '80% заявок обрабатывается без участия оператора'
      },
      logistics: {
        industry: 'Логистика и доставка',
        title: 'Трекинг и поддержка клиентов',
        feature1: 'Статус заказа и трекинг доставки',
        feature2: 'Изменение адреса и времени доставки',
        feature3: 'Обработка претензий по доставке',
        feature4: 'Уведомления о статусе отправлений',
        roi: 'Обработка 10 000+ запросов в день без операторов'
      },
      hr: {
        industry: 'HR и рекрутинг',
        title: 'Автоматизация подбора персонала',
        feature1: 'Скрининг резюме по критериям',
        feature2: 'Первичные собеседования через чат',
        feature3: 'Координация собеседований и напоминания',
        feature4: 'Онбординг новых сотрудников',
        roi: '-80% времени HR на рутинных задачах скрининга'
      },
      realestate: {
        industry: 'Недвижимость',
        title: 'AI-брокер и консультант',
        feature1: 'Подбор объектов по параметрам клиента',
        feature2: 'Запись на показы и консультации',
        feature3: 'Ответы на вопросы об объектах',
        feature4: 'Сопровождение сделок и документооборот',
        roi: 'Конверсия из лида в показ вырастает на 40%'
      },
      cta: {
        hint: 'Не нашли свою отрасль?',
        label: 'Посмотреть все решения'
      }
    },

    features: {
      title: 'Всё, что нужно для трансформации',
      builder: 'Конструктор агентов',
      builderDesc: 'Создавайте без кода',
      integrations: 'Интеграции',
      integrationsDesc: '50+ готовых интеграций',
      multichannel: 'Мультиканальность',
      multichannelDesc: 'Сайт, мессенджеры, email',
      analytics: 'Аналитика',
      analyticsDesc: 'Отслеживайте эффективность',
      security: 'Безопасность',
      securityDesc: 'Шифрование и защита данных',
      scalability: 'Масштабируемость',
      scalabilityDesc: 'От стартапа до энтерпрайза'
    },

    socialProof: {
      title: 'Нам доверяют',
      agents: '500+ активных агентов',
      requests: '10 000+ обработанных заявок в день',
      savings: '60% средняя экономия на операционных расходах'
    },

    pricing: {
      title: 'Прозрачные цены',
      starter: {
        title: 'Starter',
        price: 'Бесплатно',
        agent: '1 агент',
        interactions: '100 взаимодействий/мес',
        integrations: 'Базовые интеграции',
        support: 'Email поддержка',
        cta: 'Начать бесплатно'
      },
      business: {
        title: 'Business',
        price: '5 000 руб./мес',
        agents: '5 агентов',
        interactions: '5000 взаимодействий/мес',
        integrations: 'Все интеграции',
        support: 'Приоритетная поддержка',
        cta: 'Попробовать 14 дней бесплатно'
      },
      enterprise: {
        title: 'Enterprise',
        price: 'Индивидуально',
        agents: 'Безлимитные агенты',
        server: 'Выделенный сервер',
        sla: 'SLA 99.9%',
        manager: 'Персональный менеджер',
        cta: 'Связаться с нами'
      }
    },

    faq: {
      title: 'Частые вопросы',
      q1: 'Что такое ИИ-агент и как он работает?',
      a1: 'ИИ-агент — это программа, которая автоматически выполняет задачи, используя искусственный интеллект. Он может общаться с клиентами, обрабатывать запросы, анализировать данные и многое другое.',
      q2: 'Нужны ли технические знания для создания агента?',
      a2: 'Нет, наш конструктор позволяет создавать агентов без программирования. Достаточно описать задачу и настроить параметры через визуальный интерфейс.',
      q3: 'Как быстро можно запустить первого агента?',
      a3: 'В среднем первый агент запускается за 2-4 часа. Для простых задач может потребоваться всего 30-60 минут.',
      q4: 'Можно ли интегрировать с моими существующими системами?',
      a4: 'Да, DronDoc поддерживает более 50 готовых интеграций с популярными сервисами: CRM, мессенджеры, платежные системы, базы данных и другие.',
      q5: 'Какая поддержка предоставляется?',
      a5: 'На бесплатном тарифе — поддержка через email. На платных — приоритетная поддержка с гарантированным временем ответа. На Enterprise — персональный менеджер.',
      q6: 'Что происходит с данными клиентов?',
      a6: 'Все данные шифруются и хранятся в соответствии с требованиями безопасности. Мы не передаем данные третьим лицам. Доступны регулярные резервные копии.',
      q7: 'Можно ли изменить или отменить подписку?',
      a7: 'Да, вы можете изменить тариф или отменить подписку в любое время. Возврат средств осуществляется пропорционально неиспользованному периоду.',
      q8: 'Есть ли ограничения на количество запросов?',
      a8: 'Ограничения зависят от тарифа. На Starter — 100 взаимодействий в месяц, на Business — 5000. На Enterprise ограничений нет.'
    },

    finalCta: {
      title: 'Готовы автоматизировать ваш бизнес?',
      subtitle: 'Создайте первого агента бесплатно. Без кредитной карты. Без обязательств.',
      cta: 'Начать прямо сейчас',
      demo: 'Или запланируйте демо с нашим экспертом'
    }
  },

  // Customer Support Agent
  customerSupport: {
    title: 'Агент поддержки клиентов',
    subtitle: 'Автоматический чат-бот в Telegram для общения с клиентами, который знает о тарифах, функциях платформы и помогает решать вопросы',

    // Header actions
    startBot: 'Запустить бота',
    stopBot: 'Остановить бота',
    refresh: 'Обновить',

    // Status card
    statusCard: {
      title: 'Статус бота',
      state: 'Состояние',
      running: 'Работает',
      stopped: 'Остановлен',
      uptime: 'Время работы',
      activeDialogs: 'Активных диалогов',
      totalCustomers: 'Всего клиентов',
      categoryDistribution: 'Распределение по категориям'
    },

    // Categories
    categories: {
      general: 'Общий',
      tariff: 'Тарифы',
      technical_issue: 'Техническая проблема',
      feature_inquiry: 'Вопрос о функциях'
    },

    // Sentiment
    sentiment: {
      positive: 'Позитивное',
      neutral: 'Нейтральное',
      negative: 'Негативное'
    },

    // Conversations table
    conversations: {
      title: 'Активные диалоги',
      emptyState: 'Нет активных диалогов',
      chatId: 'Chat ID',
      conversationId: 'Conversation ID',
      customer: 'Клиент',
      category: 'Категория',
      sentiment: 'Настроение',
      lastMessage: 'Последнее сообщение',
      actions: 'Действия',
      viewDetails: 'Просмотр деталей',
      messages: 'Сообщений'
    },

    // Token management
    tokenManagement: {
      title: 'Локальное хранение токенов',
      description: 'Храните токены локально в браузере для быстрого доступа. Токены шифруются перед сохранением для безопасности.',
      stats: {
        total: 'Всего токенов',
        active: 'Активных',
        expired: 'Истекших'
      },
      savedTokens: 'Сохраненные токены',
      addToken: 'Добавить токен',
      addFirstToken: 'Добавить первый токен',
      noTokens: 'Нет сохраненных токенов',
      default: 'По умолчанию',
      expired: 'Истек',
      created: 'Создан',
      balance: 'токенов',
      exportTokens: 'Экспорт токенов',
      importTokens: 'Импорт токенов',
      clearAll: 'Очистить все',
      setDefault: 'Сделать по умолчанию',
      deleteToken: 'Удалить',
      editToken: 'Редактировать'
    },

    // Token form
    tokenForm: {
      add: 'Добавить новый токен',
      edit: 'Редактировать токен',
      name: 'Название токена',
      namePlaceholder: 'Мой токен DeepSeek',
      value: 'Значение токена',
      valuePlaceholder: 'dd_tok_...',
      valueHelp: 'Токен будет зашифрован перед сохранением',
      provider: 'Провайдер',
      providerPlaceholder: 'Выберите провайдера',
      model: 'Модель',
      modelPlaceholder: 'deepseek-chat',
      balance: 'Баланс токенов',
      dailyLimit: 'Дневной лимит',
      monthlyLimit: 'Месячный лимит',
      useAsDefault: 'Использовать по умолчанию',
      required: 'обязательно',
      cancel: 'Отмена',
      save: 'Сохранить',
      add: 'Добавить'
    },

    // Import dialog
    importDialog: {
      title: 'Импорт токенов',
      description: 'Вставьте JSON данные экспортированных токенов:',
      placeholder: '[{"name": "My Token", "tokenValue": "...", ...}]',
      help: 'Используйте кнопку "Экспорт токенов" для получения данных в нужном формате',
      cancel: 'Отмена',
      import: 'Импортировать'
    },

    // Configuration
    configuration: {
      title: 'Конфигурация бота',
      telegramSettings: 'Telegram API настройки:',
      requirements: [
        'API ID и API Hash должны быть указаны в .env файле',
        'Необходимо создать сессию через команду node scripts/telegram-auth.js',
        'Session string также должен быть в .env (TELEGRAM_SESSION)'
      ],
      getCredentials: 'Получить API credentials →',
      features: {
        title: 'Возможности бота',
        list: [
          'Автоматическое общение с клиентами через Telegram',
          'Отслеживание контекста (тарифы, вопросы, проблемы)',
          'AI-powered ответы с использованием DeepSeek',
          'Определение тональности сообщений',
          'Категоризация запросов (тарифы, технические вопросы, функции)',
          'История диалогов с каждым клиентом',
          'Знание о платформе DronDoc (функции, тарифы, поддержка)',
          'Локальное хранение токенов для всех пользователей'
        ]
      }
    },

    // Customer details dialog
    customerDetails: {
      title: 'Детали клиента',
      customerId: 'ID клиента:',
      chatId: 'Chat ID:',
      category: 'Категория:',
      sentiment: 'Настроение:',
      messages: 'Сообщений:',
      created: 'Создан:',
      lastMessage: 'Последнее сообщение:',
      questions: 'Вопросы клиента',
      issues: 'Технические проблемы',
      features: 'Интерес к функциям'
    },

    // Notifications
    notifications: {
      botStarted: 'Бот запущен',
      botStartedMessage: 'Telegram бот поддержки успешно запущен',
      botStopped: 'Бот остановлен',
      botStoppedMessage: 'Telegram бот поддержки остановлен',
      error: 'Ошибка',
      startError: 'Не удалось запустить бота',
      stopError: 'Не удалось остановить бота',
      tokenAdded: 'Токен добавлен',
      tokenUpdated: 'Токен обновлен',
      tokenDeleted: 'Токен удален',
      tokenSetDefault: 'Токен установлен по умолчанию',
      tokensExported: 'Токены экспортированы',
      tokensImported: 'Импортировано токенов:',
      tokensCleared: 'Все токены удалены',
      tokenError: 'Не удалось сохранить токен',
      loadError: 'Не удалось загрузить токены',
      deleteError: 'Не удалось удалить токен',
      exportError: 'Не удалось экспортировать токены',
      importError: 'Не удалось импортировать токены',
      clearError: 'Не удалось очистить токены'
    },

    // Confirmations
    confirmations: {
      deleteToken: {
        message: 'Вы уверены, что хотите удалить этот токен?',
        header: 'Подтверждение удаления',
        accept: 'Удалить',
        reject: 'Отмена'
      },
      clearAll: {
        message: 'Вы уверены, что хотите удалить ВСЕ сохраненные токены? Это действие необратимо.',
        header: 'Подтверждение очистки',
        accept: 'Удалить все',
        reject: 'Отмена'
      }
    }
  },

  // Appointment Booking Agent
  appointmentBooking: {
    title: 'Агент бронирования записей',
    description: 'Управление записями, специалистами и услугами с интеграцией календаря',

    tabs: {
      calendar: 'Календарь',
      specialists: 'Специалисты',
      services: 'Услуги',
      myAppointments: 'Мои записи',
      settings: 'Настройки'
    },

    calendar: {
      selectSpecialist: 'Выберите специалиста',
      selectService: 'Выберите услугу',
      view: 'Вид',
      allSpecialists: 'Все специалисты',
      allServices: 'Все услуги',
      availableSlots: 'Доступные временные слоты',
      noSlotsAvailable: 'Нет доступных слотов на эту дату',
      views: {
        month: 'Месяц',
        week: 'Неделя',
        day: 'День'
      }
    },

    specialists: {
      title: 'Управление специалистами',
      addNew: 'Добавить специалиста',
      name: 'Имя',
      email: 'Email',
      specialty: 'Специализация',
      timezone: 'Часовой пояс',
      status: 'Статус',
      edit: 'Редактировать специалиста',
      create: 'Создать специалиста',
      confirmDelete: 'Вы уверены, что хотите удалить этого специалиста?',
      deleteSuccess: 'Специалист успешно удалён'
    },

    services: {
      title: 'Управление услугами',
      addNew: 'Добавить услугу',
      name: 'Название',
      description: 'Описание',
      duration: 'Продолжительность (минуты)',
      price: 'Цена',
      edit: 'Редактировать услугу',
      create: 'Создать услугу'
    },

    dialogs: {
      book: {
        title: 'Забронировать запись'
      },
      details: {
        title: 'Детали записи'
      }
    },

    success: {
      bookingCreated: 'Запись создана',
      bookingCreatedDetail: 'Ваша запись успешно забронирована',
      appointmentCancelled: 'Запись отменена',
      appointmentRescheduled: 'Запись перенесена'
    },

    errors: {
      loadSpecialistsFailed: 'Не удалось загрузить специалистов',
      loadServicesFailed: 'Не удалось загрузить услуги',
      loadAppointmentsFailed: 'Не удалось загрузить записи',
      cancelFailed: 'Не удалось отменить запись',
      rescheduleFailed: 'Не удалось перенести запись'
    }
  },

  // Lead Qualification Agent
  leadQualification: {
    title: 'Агент квалификации лидов',
    subtitle: 'Автоматическая оценка и приоритизация потенциальных клиентов',
    addLead: 'Добавить лида',
    configure: 'Настроить',
    search: 'Поиск по лидам...',
    filterByStatus: 'Фильтр по статусу',
    viewDetails: 'Просмотр деталей',
    assign: 'Назначить',

    // Statistics
    stats: {
      total: 'Всего лидов',
      hot: 'Горячие',
      warm: 'Тёплые',
      cold: 'Холодные'
    },

    // Status
    status: {
      all: 'Все',
      hot: 'Горячие',
      warm: 'Тёплые',
      cold: 'Холодные'
    },

    // Budget
    budget: {
      budgeted: 'Бюджет утвержден',
      potential: 'Потенциальный бюджет',
      none: 'Без бюджета'
    },

    // Urgency
    urgency: {
      urgent: 'Срочно',
      planned: 'Запланировано',
      exploring: 'Изучает'
    },

    // Criteria
    criteria: {
      budget: 'Бюджет',
      authority: 'Полномочия',
      need: 'Потребность',
      timeline: 'Сроки'
    },

    // Leads Table
    leadsTable: {
      title: 'Лиды',
      company: 'Компания',
      score: 'Оценка',
      category: 'Категория',
      budget: 'Бюджет',
      urgency: 'Срочность',
      assignedTo: 'Назначен',
      actions: 'Действия'
    },

    // Add Lead Dialog
    addLeadDialog: {
      title: 'Добавить нового лида',
      companyName: 'Название компании',
      contactName: 'Контактное лицо',
      contactEmail: 'Email',
      contactPhone: 'Телефон',
      companySize: 'Размер компании',
      selectSize: 'Выберите размер',
      budget: 'Бюджет',
      selectBudget: 'Выберите бюджет',
      urgency: 'Срочность',
      selectUrgency: 'Выберите срочность',
      notes: 'Примечания'
    },

    // Config Dialog
    configDialog: {
      title: 'Настройки агента квалификации',
      scoring: 'Критерии оценки',
      routing: 'Правила маршрутизации',
      integrations: 'Интеграции',
      routingDescription: 'Настройте автоматическую маршрутизацию лидов на основе их оценки:',
      condition: 'Условие',
      assignTo: 'Назначить',
      integrationsInfo: 'Подключите CRM-системы для синхронизации лидов:',
      // Routing rules
      highScoreCondition: 'Оценка > 80',
      mediumScoreCondition: 'Оценка 60-80',
      lowScoreCondition: 'Оценка < 60',
      seniorSalesManager: 'Старший менеджер по продажам',
      salesManager: 'Менеджер по продажам',
      juniorSales: 'Младший менеджер'
    },

    // Integrations
    integrations: {
      amocrm: 'Синхронизация лидов с amoCRM',
      bitrix24: 'Синхронизация лидов с Bitrix24',
      hubspot: 'Синхронизация лидов с HubSpot'
    },

    // Success Messages
    success: {
      leadAdded: 'Лид успешно добавлен',
      configSaved: 'Настройки сохранены',
      assigningLead: 'Назначение'
    },

    // Error Messages
    errors: {
      loadFailed: 'Не удалось загрузить лидов',
      addFailed: 'Не удалось добавить лида'
    }
  },

  // Common locale identifier
  locale: 'ru',

  // Must-Have Agents ROI Calculator
  mustHaveAgents: {
    // Meta and SEO
    meta: {
      title: 'Калькулятор ROI AI-агентов - Оценка влияния на бизнес',
      description: 'Рассчитайте ROI и экономию времени от внедрения AI-агентов. Интерактивный исследовательский инструмент для оценки влияния автоматизации на бизнес.',
      keywords: 'калькулятор ROI AI-агентов, ROI автоматизации, калькулятор экономии времени, анализ влияния на бизнес, калькулятор продуктивности'
    },

    // Header
    header: {
      badge: 'Калькулятор ROI и исследовательский инструмент',
      title: 'Рассчитайте ROI ваших AI-агентов',
      subtitle: 'Оцените влияние внедрения AI-агентов автоматизации на бизнес. Получите персонализированные данные об экономии времени, снижении затрат и росте выручки.',
      infoText: 'Интерактивный исследовательский инструмент • Расчёты в реальном времени • Аналитика на основе данных'
    },

    // File Upload and AI Analysis
    fileUpload: {
      badge: 'AI-анализ потерь',
      title: 'Анализ управленческой отчётности',
      subtitle: 'Загрузите вашу управленческую отчётность в Excel и получите AI-анализ, где ваш бизнес теряет деньги',
      uploadPrompt: 'Загрузите управленческую отчётность',
      uploadDescription: 'Перетащите Excel-файл сюда или нажмите для выбора',
      selectFile: 'Выбрать файл',
      supportedFormats: 'Поддерживаемые форматы: XLSX, XLS, CSV',
      rows: 'строк',
      dataPreview: 'Предпросмотр данных',
      showingPreview: 'Показаны первые 3 строки и 6 столбцов',
      analyzeButton: 'Анализировать с помощью AI',
      analyzing: 'Анализируем...',
      changeFile: 'Сменить файл',
      parseError: 'Не удалось прочитать файл. Проверьте формат файла.',
      noFileError: 'Пожалуйста, сначала загрузите файл',
      analysisError: 'Ошибка анализа. Попробуйте снова.'
    },

    // Analysis Results
    analysis: {
      title: 'Результаты анализа потерь',
      summary: 'Резюме',
      totalLoss: 'Общая оценка потерь',
      lossAreas: 'Выявленные области потерь',
      examples: 'Примеры из ваших данных:',
      recommendations: 'Рекомендации:',
      priorityActions: 'Приоритетные действия'
    },

    // Business Parameters
    businessParams: {
      title: 'Параметры вашего бизнеса',
      teamSize: 'Размер команды (сотрудники)',
      avgHourlyRate: 'Средняя почасовая ставка ($)',
      leadsPerMonth: 'Лидов в месяц',
      conversionRate: 'Конверсия (%)',
      avgDealValue: 'Средний чек ($)',
      invoicesPerMonth: 'Счетов в месяц'
    },

    // Agent Selection
    agentSelection: {
      title: 'Выберите агентов для оценки'
    },

    // Agents
    agents: {
      leadQualification: {
        name: 'Агент квалификации лидов',
        description: 'Автоматическая квалификация и оценка лидов по настраиваемым критериям.'
      },
      billingPayment: {
        name: 'Агент выставления счетов и оплаты',
        description: 'Автоматизация выставления счетов, обработки платежей и взыскания задолженности.'
      },
      qualityFeedback: {
        name: 'Агент качества и обратной связи',
        description: 'Сбор, анализ и обработка обратной связи от клиентов.'
      },
      monitoringAlerts: {
        name: 'Агент мониторинга и оповещений',
        description: 'Мониторинг критических бизнес-метрик и систем.'
      },
      salesAutomation: {
        name: 'Агент автоматизации продаж',
        description: 'Автоматизация рутинных задач продаж и последующих контактов.'
      }
    },

    // ROI Summary
    roiSummary: {
      title: 'Итоги ROI',
      timeSavedYear: 'Сэкономлено времени / Год',
      hours: 'часов',
      valueYear: 'Ценность / Год',
      totalImpact: 'общее влияние',
      roi: 'ROI',
      returnOnInvestment: 'возврат инвестиций',
      paybackPeriod: 'Период окупаемости',
      timeToROI: 'время до ROI',
      monthlyCosts: 'Ежемесячные затраты',
      timeSavingsValue: 'Ценность экономии времени',
      revenueImpact: 'Влияние на выручку',
      netMonthlyValue: 'Чистая месячная ценность',
      month: 'месяц',
      lessThanMonth: 'Менее 1 месяца'
    },

    // Key Insights
    keyInsights: {
      title: 'Ключевые выводы',
      productivityBoost: {
        title: 'Рост продуктивности',
        description: 'Экономия {hours} часов в неделю, что эквивалентно {percentage}% полного рабочего времени сотрудника'
      },
      errorReduction: {
        title: 'Снижение ошибок',
        description: 'Среднее снижение на {percentage}% ручных ошибок и ошибок ввода данных'
      },
      revenueGrowth: {
        title: 'Рост выручки',
        description: 'Потенциально {amount} дополнительной выручки в год за счёт улучшенной конверсии'
      },
      costEfficiency: {
        title: 'Эффективность затрат',
        description: '{amount} чистой экономии в год после вычета затрат на агентов'
      }
    },

    // CTA
    cta: {
      title: 'Готовы начать?',
      description: 'Внедрите этих агентов и начните видеть результаты в течение нескольких дней.',
      buttonUser: 'Перейти в Dashboard',
      buttonGuest: 'Войти для продолжения'
    },

    // Visual Analysis
    visualAnalysis: {
      title: 'Визуальный анализ',
      subtitle: 'Интерактивные графики для понимания влияния и прогнозов ROI.',
      timeSavingsChart: 'Экономия времени по агентам (Часы/Неделя)',
      roiChart: 'Прогноз ROI на 12 месяцев',
      valueBreakdownChart: 'Разбивка месячной ценности',
      hoursUnit: 'ч',
      cumulativeSavings: 'Накопительная экономия',
      cumulativeCosts: 'Накопительные затраты',
      timeSavingsValueLabel: 'Ценность экономии времени',
      revenueIncreaseLabel: 'Рост выручки',
      agentCostsLabel: 'Затраты на агентов'
    },

    // Agent Details
    agentDetails: {
      title: 'Метрики производительности агентов',
      subtitle: 'Детальная разбивка влияния каждого агента на бизнес-операции.',
      perMonth: '/мес',
      timeSaved: 'Сэкономлено времени',
      hoursPerWeek: 'ч/нед',
      conversionBoost: 'Рост конверсии',
      errorReduction: 'Снижение ошибок',
      additionalMetrics: 'Дополнительные метрики:',
      metrics: {
        responseTimeReduction: 'Снижение времени ответа',
        leadProcessingSpeed: 'Скорость обработки лидов',
        dataAccuracy: 'Точность данных',
        paymentCollectionSpeed: 'Скорость сбора платежей',
        billingAccuracy: 'Точность выставления счетов',
        latePaymentReduction: 'Снижение просроченных платежей',
        feedbackCollectionIncrease: 'Рост сбора обратной связи',
        issueResolutionSpeed: 'Скорость решения проблем',
        customerSatisfactionIncrease: 'Рост удовлетворённости клиентов',
        incidentDetectionSpeed: 'Скорость обнаружения инцидентов',
        downtimeReduction: 'Снижение простоев',
        falseAlertReduction: 'Снижение ложных оповещений',
        productivityIncrease: 'Рост продуктивности',
        dealsClosed: 'Закрытых сделок',
        followUpRate: 'Уровень последующих контактов'
      }
    },

    // Methodology
    methodology: {
      title: 'Методология расчётов',
      subtitle: 'Прозрачный, основанный на данных подход к оценке ROI.',
      timeSavings: {
        title: 'Расчёт экономии времени',
        description: 'На основе измеренной экономии времени от возможностей автоматизации каждого агента:',
        formula: 'Месячная ценность = (Сэкономленные часы в неделю × 4) × Почасовая ставка'
      },
      revenueImpact: {
        title: 'Расчёт влияния на выручку',
        description: 'Улучшение конверсии от агентов квалификации лидов и автоматизации продаж:',
        formula: 'Дополнительная выручка = (Лиды × Улучшенная конверсия × Средний чек) - Текущая выручка'
      },
      roi: {
        title: 'Расчёт ROI',
        description: 'Возврат инвестиций за 12 месяцев:',
        formula: 'ROI = ((Годовая чистая экономия) / (Годовые затраты на агентов)) × 100'
      },
      disclaimer: 'Примечание: Эти расчёты основаны на средних отраслевых показателях и могут отличаться в зависимости от конкретных условий бизнеса, качества внедрения и паттернов использования. Показанные результаты являются оценочными для исследовательских целей.'
    }
  },

  // SmartQ
  smartq: {
    title: 'SmartQ - Умные запросы и отчёты',
    description: 'Интерактивная система для работы с динамическими отчётами и таблицами данных',
    selectReport: 'Выберите отчёт',
    reportIdPlaceholder: 'Введите ID отчёта',
    loadReport: 'Загрузить отчёт',
    noReportLoaded: 'Отчёт не загружен',
    enterReportIdToStart: 'Введите ID отчёта, чтобы начать работу',
    loading: 'Загрузка данных...',
    all: 'Все',
    search: 'Поиск',
    addRow: 'Добавить строку',
    duplicate: 'Дублировать',
    delete: 'Удалить',
    actions: 'Действия',
    of: 'из',
    retry: 'Повторить',
    viewRawResponse: 'Показать сырой ответ',
    filters: 'Фильтры',
    clearFilters: 'Очистить фильтры',
    refresh: 'Обновить',
    noData: 'Нет данных',
    cancel: 'Отмена',

    // Экспорт
    exportCSV: 'Экспорт CSV',
    exportExcel: 'Экспорт Excel',
    exportHTML: 'Экспорт HTML',
    copyLink: 'Копировать ссылку',
    copyLinkTooltip: 'Скопировать ссылку на отчёт',
    linkCopied: 'Ссылка скопирована',
    linkCopiedDetail: 'Ссылка на отчёт скопирована в буфер обмена',
    copyLinkFailed: 'Не удалось скопировать ссылку',
    export: {
      noData: 'Нет данных',
      noDataDetail: 'Нет данных для экспорта',
      success: 'Экспорт выполнен',
      csvDownloaded: 'CSV файл загружен',
      excelDownloaded: 'Excel файл загружен',
      htmlDownloaded: 'HTML файл загружен',
      xlsxNotLoaded: 'Библиотека Excel не загружена',
      xlsxNotLoadedDetail: 'Пожалуйста, обновите страницу и попробуйте снова',
      failed: 'Ошибка экспорта'
    },

    // Встроенное редактирование
    saved: 'Сохранено',
    cellUpdated: 'Ячейка обновлена',
    cellUpdatedSuccess: 'Значение ячейки успешно сохранено',
    saveNewRowToCommit: 'Сохраните всю строку, чтобы зафиксировать изменения в базе данных',
    saveRow: 'Сохранить строку',
    rowSaved: 'Строка сохранена',
    rowSavedDetail: 'Новая строка успешно сохранена в базе данных',

    // Манипуляции со строками
    rowAdded: 'Строка добавлена',
    rowAddedDetail: 'Новая строка добавлена. Заполните ячейки и нажмите ✓ для сохранения.',
    rowDuplicated: 'Строка продублирована',
    editAndSave: 'Отредактируйте продублированную строку и сохраните изменения',
    rowRemoved: 'Строка удалена',
    unsavedRowRemoved: 'Несохранённая строка была удалена',
    confirmDelete: 'Вы уверены, что хотите удалить эту строку? Это действие нельзя отменить.',
    deleteRow: 'Удалить строку',
    deleted: 'Удалено',
    rowDeletedSuccess: 'Строка успешно удалена',

    // Промежуточные итоги
    subTotals: {
      count: 'Количество',
      sum: 'Сумма',
      average: 'Среднее',
      minMax: 'Мин / Макс',
      clear: 'Очистить выделение'
    },

    errors: {
      noReportId: 'Укажите ID отчёта',
      loadFailed: 'Ошибка загрузки отчёта',
      saveFailed: 'Не удалось сохранить изменения',
      deleteFailed: 'Не удалось удалить строку',
      unknown: 'Неизвестная ошибка',
      noTypeId: 'Невозможно создать строку',
      noTypeIdDetail: 'Отчёт не вернул ID типа, необходимый для создания новых строк. Обратитесь к администратору.',
      loadReferencesFailed: 'Не удалось загрузить варианты для выбора'
    },

    // Навигация
    nav: {
      reports: 'Отчёты',
      viewer: 'Просмотр', // Legacy - для обратной совместимости
      editor: 'Редактор данных', // Интерактивная таблица с редактированием (legacy "editor")
      designer: 'Конструктор запросов', // Конструктор запросов (legacy "sql editor")
      createReport: 'Создать отчёт',
      browseReports: 'Обзор отчётов'
    },

    // Список отчётов
    reports: {
      list: 'Список отчётов',
      listDescription: 'Просмотр и управление всеми отчётами',
      create: 'Создать отчёт',
      id: 'ID',
      name: 'Название',
      actions: 'Действия',
      view: 'Просмотр',
      edit: 'Редактировать данные',
      design: 'Конструктор запросов',
      clone: 'Клонировать',
      delete: 'Удалить',
      noReports: 'Отчёты не найдены',
      noReportsDescription: 'Начните с создания вашего первого отчёта',
      createFirst: 'Создать первый отчёт',
      confirmDelete: 'Вы уверены, что хотите удалить этот отчёт?',
      confirmDeleteHeader: 'Подтверждение удаления',
      deleteSuccess: 'Отчёт успешно удалён',
      deleteFailed: 'Не удалось удалить отчёт',
      cloneSuccess: 'Отчёт успешно клонирован',
      cloneFailed: 'Не удалось клонировать отчёт',
      clonePrompt: 'Введите имя для клонированного отчёта:',
      cloneDefaultName: 'Копия'
    },

    // Редактор отчётов
    editor: {
      editReport: 'Редактировать отчёт',
      createReport: 'Создать новый отчёт',
      description: 'Создание и настройка SmartQ отчётов с SQL запросами',
      reportName: 'Название отчёта',
      reportNamePlaceholder: 'Введите название отчёта',
      sqlQuery: 'SQL запрос',
      sqlQueryPlaceholder: 'SELECT * FROM ...',
      sqlQueryHint: 'Введите SQL запрос для генерации данных отчёта',
      advancedSettings: 'Дополнительные настройки',
      category: 'Категория',
      categoryPlaceholder: 'например, Продажи, Аналитика, HR',
      tags: 'Теги',
      tagsPlaceholder: 'тег1, тег2, тег3',
      tagsHint: 'Разделяйте теги запятыми',
      testQuery: 'Тестировать запрос',
      updateReport: 'Обновить отчёт',
      testResults: 'Результаты теста',
      queryError: 'Ошибка запроса',
      testingQuery: 'Тестирование запроса',
      testingQueryMessage: 'Выполнение SQL запроса для проверки синтаксиса и структуры',
      queryValid: 'Запрос корректен',
      queryValidMessage: 'Синтаксис SQL запроса корректен',
      confirmCancel: 'У вас есть несохранённые изменения. Вы уверены, что хотите отменить?',
      created: 'Отчёт создан',
      createdMessage: 'Отчёт "{name}" успешно создан',
      updated: 'Отчёт обновлён',
      updatedMessage: 'Отчёт "{name}" успешно обновлён',
      errors: {
        nameRequired: 'Название отчёта обязательно',
        sqlQueryRequired: 'SQL запрос обязателен',
        queryFailed: 'Ошибка тестирования запроса',
        saveFailed: 'Не удалось сохранить отчёт'
      },
      warnings: {
        noQuery: 'Нет запроса',
        noQueryMessage: 'Пожалуйста, введите SQL запрос для тестирования',
        validationFailed: 'Ошибка валидации',
        validationFailedMessage: 'Пожалуйста, исправьте ошибки перед сохранением'
      },
      columnManagement: 'Управление колонками',
      columns: 'Колонки отчёта',
      columnsDescription: 'Настройте колонки для отображения в отчёте',
      columnName: 'Название колонки',
      columnType: 'Тип данных',
      addColumn: 'Добавить колонку',
      removeColumn: 'Удалить колонку',
      moveUp: 'Переместить вверх',
      moveDown: 'Переместить вниз',
      noColumns: 'Колонки не добавлены',
      columnAdded: 'Колонка добавлена',
      columnAddedMessage: 'Новая колонка успешно добавлена',
      columnRemoved: 'Колонка удалена',
      columnRemovedMessage: 'Колонка "{name}" была удалена',
      confirmRemoveColumn: 'Вы уверены, что хотите удалить эту колонку?',
      unnamedColumn: 'Без названия',
      columnTypes: {
        SHORT: 'Короткий текст',
        CHARS: 'Текст',
        NUMBER: 'Число',
        DATE: 'Дата',
        DATETIME: 'Дата и время',
        BOOLEAN: 'Логический',
        MEMO: 'Длинный текст',
        HTML: 'HTML',
        FILE: 'Файл'
      }
    }
  },

  // Визуальный конструктор запросов
  queryBuilder: {
    title: 'Визуальный конструктор запросов',
    interactive: 'Интерактивный',
    limit: 'Лимит',
    addColumn: 'Добавить колонку',
    addCalculated: 'Добавить вычисляемое поле',
    addJoin: 'Добавить JOIN',
    selectTable: 'Выберите таблицу',
    selectColumn: 'Выберите колонку',
    columnName: 'Название колонки',
    filter: 'Фильтр',
    from: 'От',
    to: 'До',
    format: 'Формат',
    selectFormat: 'Выберите формат',
    function: 'Функция',
    selectFunction: 'Выберите функцию',
    order: 'Порядок',
    totals: 'Итоги',
    selectTotals: 'Выберите итог',
    expression: 'Формула',
    expressionPlaceholder: 'Введите SQL выражение',
    having: 'HAVING',
    actions: 'Действия',
    moveUp: 'Переместить выше',
    moveDown: 'Переместить ниже',
    show: 'Показать колонку',
    hide: 'Скрыть колонку',
    removeColumn: 'Удалить колонку',
    noColumns: 'Колонки не выбраны',
    noColumnsHint: 'Выберите таблицу и добавьте колонки для построения запроса',
    sqlPreview: 'Предпросмотр SQL',
    copySQL: 'Скопировать SQL',
    executeQuery: 'Выполнить запрос',
    sqlCopied: 'SQL скопирован в буфер обмена',
    calculatedColumnAdded: 'Вычисляемая колонка добавлена',
    joinAdded: 'JOIN успешно добавлен',
    columnRemoved: 'Колонка удалена',
    addIdColumn: 'Добавить колонку ID',
    idColumnAdded: 'Колонка ID добавлена',

    controls: {
      filter: 'Фильтр',
      format: 'Формат',
      function: 'Функция',
      order: 'Сортировка',
      totals: 'Итоги',
      expression: 'Формула',
      having: 'HAVING',
      set: 'Присвоить'
    },

    // SET колонка
    set: 'Присвоить',
    setPlaceholder: 'RAND(), IF(...), POWER(...)',
    setHint: 'Выражение для присвоения значению колонки',

    joinDialog: {
      title: 'Добавить соединение таблиц (JOIN)',
      leftTable: 'Присоединить таблицу',
      alias: 'Псевдоним',
      aliasPlaceholder: 'Одно короткое слово латиницей',
      leftField: 'Левое поле',
      rightField: 'Правое поле',
      selectField: 'Выберите поле',
      rightColumn: 'Правая колонка (существующая)'
    },

    errors: {
      loadTablesFailed: 'Не удалось загрузить список таблиц',
      loadColumnsFailed: 'Не удалось загрузить список колонок'
    }
  },

  // Управление Workspace
  workspaces: {
    // Заголовки и основная информация
    title: 'Workspaces',
    subtitle: 'Интеграция с ИИ агентами, modern CLI, управлением файлами и Deep AI',
    subtitleSuffix: '',
    yourWorkspaces: 'Workspaces',

    // Badges
    badges: {
      aiPowered: 'AI-Powered',
      loading: 'Загрузка...',
      unsaved: 'Не сохранено'
    },

    // Действия с workspace
    create: 'Создать',
    createFirst: 'Создать первый workspace',
    view: 'Просмотр',
    delete: 'Удалить',
    refresh: 'Обновить',
    refreshList: 'Обновить список',

    // Таблица workspace
    table: {
      name: 'Название',
      repository: 'Репозиторий',
      actions: 'Действия',
      aiAgent: 'AI Agent',
      noRepository: 'Без репозитория',
      openInNewTab: 'Открыть в IDE',
      copyText: 'Скопировать'
    },

    // Пустое состояние
    empty: {
      title: 'Нет созданных workspace',
      description: 'Создайте первый workspace для работы с репозиториями, AI агентами и управления файлами'
    },

    // Диалог создания workspace
    createDialog: {
      title: 'Создать Workspace',
      nameLabel: 'Название workspace',
      namePlaceholder: 'Например: MyProject',
      repositoryLabel: 'URL Git репозитория (опционально)',
      repositoryPlaceholder: 'https://github.com/user/repo.git',
      repositoryHint: 'Используйте URL репозитория, а не pull request. Пример: https://github.com/user/repo.git',
      branchLabel: 'Ветка (опционально)',
      branchPlaceholder: 'main',
      nameRequired: 'Название workspace обязательно',
      githubAuthHint: '💡 Для клонирования приватных репозиториев необходима авторизация GitHub.\nПожалуйста, авторизуйтесь через настройки или страницу GitHub.'
    },

    // Подтверждение удаления
    deleteConfirm: 'Вы уверены, что хотите удалить workspace "{name}"?',
    deleteSuccess: 'Workspace удалён',
    deleteError: 'Ошибка удаления workspace: {error}',
    createError: 'Ошибка создания workspace',
    suggestedUrl: 'Попробуйте использовать: {url}',

    // Вкладки workspace
    tabs: {
      codeAndAi: 'Code & AI',
      smartEditor: 'Smart Editor',
      terminal: 'Терминал',
      cli: 'CLI',
      git: 'Git',
      versionControl: 'Version Control'
    },

    // Файловый браузер
    files: {
      search: 'Поиск файлов...',
      newFile: 'Новый файл',
      createFile: 'Создать файл',
      loading: 'Загрузка файлов...',
      empty: {
        title: 'Файлы не найдены',
        description: 'Создайте новый файл для начала работы'
      },
      edit: 'Редактировать',
      open: 'Открыть',
      rename: 'Переименовать',
      delete: 'Удалить',
      deleteConfirm: 'Вы уверены, что хотите удалить файл "{name}"?',
      deleteSuccess: 'Файл {name} удалён',
      deleteError: 'Ошибка удаления файла: {error}',
      loadError: 'Ошибка загрузки файлов'
    },

    // Редактор файлов
    editor: {
      selectFile: 'Выберите файл для редактирования',
      selectFileDescription: 'Выберите файл из списка слева или создайте новый файл',
      save: 'Сохранить',
      close: 'Закрыть',
      saved: 'Файл {name} успешно сохранён',
      saveError: 'Ошибка сохранения файла: {error}',
      unsavedChanges: 'У вас есть несохранённые изменения. Закрыть редактор?',
      enterFileName: 'Введите имя файла',

      // Режимы редактора
      modes: {
        view: 'Просмотр файла',
        edit: 'Редактировать файл',
        create: 'Создать файл'
      },

      // Метки полей
      pathLabel: 'Путь к файлу',
      pathPlaceholder: 'example/myfile.txt',
      pathHint: 'Относительный путь от корня workspace',
      contentLabel: 'Содержимое файла',
      pathRequired: 'Укажите путь к файлу',
      readError: 'Ошибка чтения файла: {error}'
    },

    // AI помощник
    ai: {
      assistant: 'AI помощник',
      chat: 'AI чат',
      show: 'AI помощник',
      hide: 'Скрыть AI',
      closeChat: 'Закрыть AI чат',
      aiHelper: 'AI Помощник',
      thinking: 'AI думает...',
      askAboutFile: 'Спросите AI о файле {file}...',
      askAboutWorkspace: 'Спросите AI о workspace...',

      // Быстрые действия
      presetActions: 'Быстрые действия:',
      optimize: 'Оптимизировать',
      explain: 'Что делает код',
      findBugs: 'Найти баги',
      addComments: 'Добавить комментарии',
      security: 'Проверить безопасность',
      refactor: 'Рефакторинг',
      clearChat: 'Очистить чат',
      startChat: 'Начните чат с AI',
      error: 'Ошибка AI',
      presets: {
        optimize: 'Оптимизируй код в этом файле, улучши производительность',
        findBugs: 'Найди потенциальные баги и проблемы в коде',
        security: 'Проверь код на уязвимости безопасности',
        explain: 'Объясни, что делает этот код'
      },

      // AI Assistant Dialog
      dialog: {
        title: 'AI Помощник Workspace',
        description: 'AI-помощник может помочь вам с workspace. Выберите действие или задайте вопрос:',
        createWorkspace: 'Создать workspace',
        findCode: 'Найти код в проекте',
        securityAudit: 'Проверить безопасность кода',
        optimizePerformance: 'Оптимизировать производительность',
        explainArchitecture: 'Объяснить архитектуру проекта',
        askQuestion: 'Или задайте свой вопрос:',
        questionPlaceholder: 'Например: Помоги мне настроить CI/CD для проекта',
        askAI: 'Спросить AI',

        // Workspace Agents
        agents: {
          title: 'Workspace Агенты',
          description: 'Запустите агента для автоматического анализа и улучшения кода',
          analyzer: {
            name: 'Анализатор кода',
            description: 'Анализирует структуру и качество кода'
          },
          reviewer: {
            name: 'Code Reviewer',
            description: 'Проверяет код на соответствие стандартам'
          },
          security: {
            name: 'Сканер безопасности',
            description: 'Находит уязвимости и проблемы безопасности'
          },
          performance: {
            name: 'Оптимизатор',
            description: 'Находит узкие места производительности'
          },
          watcher: {
            name: 'File Watcher',
            description: 'Отслеживает изменения файлов в реальном времени'
          }
        }
      }
    },

    // Git интеграция
    git: {
      repository: 'URL репозитория',
      repositoryNotSpecified: 'Не указан',
      branch: 'Ветка',
      selectBranch: 'Выберите ветку',
      refreshBranches: 'Обновить ветки',
      commits: 'Последние коммиты',
      refreshCommits: 'Обновить коммиты',
      noCommits: 'Коммиты не найдены',
      copyCommitSha: 'Копировать SHA',
      pullChanges: 'Получить последние изменения',
      loadBranchesError: 'Ошибка загрузки веток: {error}',
      loadCommitsError: 'Ошибка загрузки коммитов: {error}',

      // Время коммитов
      justNow: 'только что',
      minutesAgo: '{count} мин назад',
      hoursAgo: '{count} ч назад',
      daysAgo: '{count} дн назад',
      title: 'Git',
      sourceControl: 'Контроль версий',
      staged: 'Подготовлено',
      changes: 'Изменения',
      noChanges: 'Нет изменений',
      pull: 'Pull',
      push: 'Push',
      commit: 'Commit',
      commitChanges: 'Коммит изменений',
      commitMessage: 'Сообщение коммита',
      commitPlaceholder: 'Опишите изменения...'
    },

    // IDE layout keys
    back: 'Назад',
    owner: 'Владелец',
    hideSidebar: 'Скрыть боковую панель',
    showSidebar: 'Показать боковую панель',
    layoutSettings: 'Настройки интерфейса',
    explorer: 'Проводник',
    newFile: 'Новый файл',
    newFolder: 'Новая папка',
    search: 'Поиск',
    searchPlaceholder: 'Поиск в файлах...',
    loading: 'Загрузка...',
    line: 'Строка',
    column: 'Столбец',
    welcome: 'Добро пожаловать в IDE',
    welcomeDescription: 'Выберите файл для редактирования или используйте быстрые клавиши.',
    quickOpen: 'Быстрое открытие (Ctrl+P)',
    save: 'Сохранить (Ctrl+S)',
    toggleTerminal: 'Терминал (Ctrl+`)',
    closePanel: 'Закрыть панель',
    noProblems: 'Нет проблем',
    showBottomPanel: 'Показать нижнюю панель',
    sidebarWidth: 'Ширина боковой панели',
    bottomPanelHeight: 'Высота нижней панели',
    defaultBottomTab: 'Вкладка по умолчанию',
    resetLayout: 'Сбросить',
    apply: 'Применить',
    cancel: 'Отмена',
    terminal: 'Терминал',
    problems: 'Проблемы',
    noFiles: 'Нет файлов',
    notFound: 'Workspace не найден',
    goBack: 'Вернуться назад',
    error: 'Ошибка',
    loadError: 'Не удалось загрузить workspace',
    saved: 'Файл сохранён',
    settingsSaved: 'Настройки сохранены',
    enterFileName: 'Введите имя файла:',
    enterFolderName: 'Введите имя папки:',

    // Настройки workspace
    settings: {
      title: 'Настройки Workspace',
      save: 'Сохранить настройки',
      updated: 'Настройки обновлены'
    },

    // Агенты workspace
    agents: {
      status: {
        label: 'Статус',
        notRunning: 'Не запущен',
        idle: 'Ожидание',
        watching: 'Наблюдение',
        analyzing: 'Анализ...',
        suggesting: 'Предложения',
        executing: 'Выполнение',
        waitingApproval: 'Ожидает одобрения',
        error: 'Ошибка',
        stopped: 'Остановлен'
      },
      agentType: 'Тип агента',
      workMode: 'Режим работы',
      start: 'Запустить',
      stop: 'Остановить',
      apply: 'Применить',
      types: {
        analyzer: 'Анализатор',
        reviewer: 'Ревьюер',
        security: 'Безопасность',
        performance: 'Производительность',
        fileWatcher: 'Наблюдатель'
      },
      autonomy: {
        supervised: 'Ручной',
        semiAuto: 'Полуавто',
        fullAuto: 'Авто'
      },
      stats: {
        files: 'Файлов',
        suggestions: 'Предложений',
        applied: 'Применено'
      },
      fileChanges: 'Изменения файлов',
      waitingChanges: 'Ожидание изменений...',
      fileChange: {
        add: 'Добавлен',
        change: 'Изменён',
        unlink: 'Удалён',
        addDir: 'Папка создана',
        unlinkDir: 'Папка удалена'
      },
      suggestions: 'Предложения',
      noProblems: 'Проблем не найдено',
      emptyState: 'Запустите агента для автоматического анализа кода'
    },

    // Настройки workspace (inline компонент)
    settingsInline: {
      generalInfo: 'Основная информация',
      workspaceName: 'Название Workspace',
      workspaceNamePlaceholder: 'Мой проект',
      description: 'Описание',
      descriptionPlaceholder: 'Описание workspace',
      repositoryUrl: 'URL репозитория',
      repositoryUrlReadonly: 'URL репозитория нельзя изменить после создания',

      themeAppearance: 'Тема и внешний вид',
      colorTheme: 'Цветовая тема Workspace',
      colorThemeHint: 'Выберите цвет для идентификации workspace',
      terminalTheme: 'Тема терминала',
      selectTerminalTheme: 'Выберите тему терминала',
      editorTheme: 'Тема редактора',
      selectEditorTheme: 'Выберите тему редактора',
      fontSize: 'Размер шрифта',
      compactMode: 'Компактный режим (уменьшить отступы)',

      aiConfig: 'Конфигурация AI-агента',
      enableAiAgent: 'Включить AI-агента для workspace',
      aiModel: 'AI модель с вызовом инструментов',
      selectAiModel: 'Выберите AI модель',
      toolCalling: 'Tool Calling',
      agentCapabilities: 'Возможности агента',
      capabilities: {
        fileOps: 'Операции с файлами',
        gitOps: 'Операции Git',
        search: 'Поиск',
        shell: 'Shell команды'
      },

      advancedSettings: 'Расширенные настройки',
      autoSave: 'Автосохранение файлов при изменении',
      autoCommit: 'Автокоммит изменений (требуется Git)',
      fileWatching: 'Отслеживание файлов',
      selectFileWatching: 'Выберите режим отслеживания',
      fileWatchingOptions: {
        auto: 'Авто (рекомендуется)',
        enabled: 'Включено',
        disabled: 'Отключено'
      },

      saveChanges: 'Сохранить изменения',
      reset: 'Сбросить',
      resetConfirm: 'Сбросить все изменения?'
    },

    // Справка по workspace
    help: {
      title: 'Справка по Workspace',
      subtitle: 'Полное руководство по работе с IDE',

      // Обзор
      overview: {
        title: 'Что такое Workspace?',
        description: 'Workspace — это полноценная облачная IDE с интеграцией ИИ агентов, modern CLI, управлением файлами и Deep AI. Работайте с кодом, запускайте команды на естественном языке и получайте помощь от AI в едином интерфейсе.'
      },

      // Возможности
      features: {
        title: 'Основные возможности',
        ide: {
          title: 'Облачная IDE',
          description: 'Полноценная среда разработки в браузере. Файловый менеджер, редактор с вкладками, терминал, Git и AI — всё в одном месте.'
        },
        codeEditor: {
          title: 'Редактор кода',
          description: 'Редактор с подсветкой синтаксиса для 50+ языков, автодополнением, поиском и заменой. Поддержка множественных вкладок.'
        },
        aiAssistant: {
          title: 'AI Агент',
          description: 'Интеллектуальный помощник с поддержкой разных провайдеров моделей. Анализ кода, рефакторинг, генерация, поиск багов и уязвимостей. Понимает контекст проекта.'
        },
        terminal: {
          title: 'AI Терминал',
          description: 'Выполняйте команды напрямую или включите AI режим — пишите на естественном языке, AI выполнит нужные команды за вас.'
        },
        gitIntegration: {
          title: 'Git & GitHub',
          description: 'Клонирование репозиториев, просмотр коммитов, переключение веток. OAuth авторизация для приватных репозиториев.'
        },
        agents: {
          title: 'Автономные агенты',
          description: 'Агенты работают в фоне: анализируют код, находят проблемы, отслеживают изменения и проверяют безопасность. Автоматизация рутинных задач.'
        }
      },

      // Разделы интерфейса
      sections: {
        title: 'Интерфейс',
        fileBrowser: {
          title: 'Файловый браузер',
          description: 'Дерево файлов с поиском, созданием, переименованием и удалением. Иконки по типу файла. Drag & drop поддержка.'
        },
        editor: {
          title: 'Редактор',
          description: 'Центральная область с вкладками файлов. Индикатор несохранённых изменений. Автосохранение опционально.'
        },
        aiChat: {
          title: 'AI Чат',
          description: 'Чат с Deep AI внизу экрана. Отправляйте код на анализ, задавайте вопросы. AI видит контекст открытого файла.'
        },
        tabs: {
          title: 'Вкладки',
          codeAndAi: 'Code & AI — редактирование файлов с AI-помощником',
          terminal: 'Терминал — CLI с поддержкой AI режима',
          git: 'Git — управление репозиторием и настройки'
        }
      },

      // Настройки
      settingsGuide: {
        title: 'Настройки',
        location: 'Кнопка настроек в заголовке или вкладка Git → Настройки Workspace.',
        options: 'Название, репозиторий, ветка, AI агент, автосохранение, тема редактора.'
      },

      // Быстрые действия
      quickActions: {
        title: 'Быстрые AI действия',
        description: 'Кнопки в AI чате:',
        optimize: 'Оптимизировать код',
        findBugs: 'Найти баги',
        security: 'Аудит безопасности'
      },

      // Советы
      tips: {
        title: 'Советы',
        tip1: 'Включите AI режим в терминале (кнопка ✨) для команд на естественном языке',
        tip2: 'Ctrl+S — сохранить файл, Ctrl+W — закрыть вкладку',
        tip3: 'Выберите файл перед вопросом AI для контекстных ответов',
        tip4: 'В AI терминале: "создай файл test.js с функцией сортировки"',
        tip5: 'История команд доступна по кнопке в футере терминала'
      },

      // Действия
      close: 'Закрыть',
      gotIt: 'Понятно!'
    },

    // Компонент терминала workspace
    workspaceTerminal: {
      // Заголовок
      aiAgentTerminal: 'AI-Терминал агента',
      modernCliTerminal: 'Терминал',
      polzaAi: 'Polza AI',
      unavailable: 'Недоступен',
      naturalLanguageCommands: 'Команды на естественном языке с AI-выполнением',
      executeCommandsDesc: 'Выполняйте команды в workspace с подсветкой синтаксиса и историей',

      // Кнопки
      aiMode: 'Режим AI',
      enableAi: 'Включить AI',
      clear: 'Очистить',
      selectAiModel: 'Выбрать AI модель',
      aiModeTooltip: 'Включить режим AI: пишите команды на естественном языке, AI выполнит их за вас',
      aiModeTooltipEnabled: 'Режим AI активен: пишите запросы на естественном языке',

      // Приветственное сообщение
      welcomeTitle: 'Добро пожаловать в Терминал',
      welcomeSubtitle: 'Вводите команды для взаимодействия с вашим workspace',
      supportedCommands: 'Команды: ls, cd, cat, git, npm, run... Введите help для полного списка',
      tryRunHelp: 'Попробуйте: <code>run --help</code> для выполнения кода на 25+ языках',

      // Выполнение команд
      executingCommand: 'Выполнение команды...',

      // Ввод команд
      typeCommandPlaceholder: 'Введите команду и нажмите Enter...',

      // Подвал
      workingDir: 'Рабочая директория',
      history: 'История',
      commandHistory: 'История команд',

      // Диалог истории
      commandHistoryTitle: 'История команд',
      noCommandHistory: 'Нет истории команд',
      clearHistory: 'Очистить историю',
      commandHistoryCleared: 'История команд очищена',

      // Сообщения режима AI
      aiModeEnabled: 'Режим AI-агента включен. Теперь вы можете использовать команды на естественном языке!',
      aiModeDisabled: 'Переключено обратно в обычный режим терминала',
      aiAgentNotAvailable: 'AI-агент недоступен в этой системе.',
      aiRequirements: `Требования:
  • Среда выполнения Bun (https://bun.sh)
  • Пакет agent_polza2 (backend/monolith/vendor/hives/agent_polza2)
  • Действительный ключ POLZA_API_KEY в переменных окружения

Пожалуйста, установите необходимые зависимости или используйте обычный режим терминала.`,

      // События AI-агента
      aiAgentStarting: 'Запуск AI-агента (модель: {model})...',
      aiAgentCompleted: 'AI-агент завершил работу ({count} событий)',
      aiAgentError: 'Ошибка AI-агента: {error}',
      toolUsed: 'Инструмент: {name}',

      // Ошибки команд
      commandNotAllowed: 'Команда не разрешена',
      useHelp: 'Введите help для списка доступных команд',

      // Справка по встроенным командам
      helpTitle: 'Терминал - Доступные команды:',
      helpFileOps: `Операции с файлами:
  ls, dir           - Список файлов и каталогов
  cd <dir>          - Изменить каталог
  pwd               - Показать текущий каталог
  cat <file>        - Показать содержимое файла
  mkdir <dir>       - Создать каталог
  touch <file>      - Создать пустой файл
  rm <file>         - Удалить файл
  mv <src> <dest>   - Переместить/переименовать файл`,

      helpGitOps: `Операции Git:
  git status        - Показать статус git
  git log           - Показать историю коммитов
  git diff          - Показать изменения
  git add <files>   - Добавить файлы в индекс
  git commit -m     - Создать коммит
  git push          - Отправить на удаленный репозиторий
  git pull          - Получить с удаленного репозитория`,

      helpPackageMgmt: `Управление пакетами:
  npm install       - Установить npm пакеты
  npm run <script>  - Запустить npm скрипт
  pip install       - Установить Python пакеты`,

      helpUniversalRunner: `Универсальный исполнитель кода (25+ языков):
  run --help        - Показать справку по команде run
  run --languages   - Список всех поддерживаемых языков
  run --lang python --code "print('Привет!')"
  run script.py     - Выполнить файл (автоопределение языка)`,

      helpOther: `Другое:
  clear, cls        - Очистить терминал
  help              - Показать это сообщение справки
  history           - Показать историю команд
  echo <text>       - Вывести текст
  neofetch          - Информация о системе и браузере
  claude <prompt>   - AI ассистент Claude (SSE стриминг)

Используйте стрелки Вверх/Вниз для навигации по истории команд.
Используйте "run --help" для подробных примеров выполнения кода.`,

      // Описания команд для автодополнения
      cmds: {
        ls: 'Список файлов и каталогов',
        cd: 'Изменить каталог',
        pwd: 'Текущий каталог',
        cat: 'Показать содержимое файла',
        mkdir: 'Создать каталог',
        touch: 'Создать пустой файл',
        rm: 'Удалить файл',
        mv: 'Переместить/переименовать',
        cp: 'Копировать файл',
        gitStatus: 'Статус git',
        gitLog: 'История коммитов',
        gitDiff: 'Показать изменения',
        gitAdd: 'Добавить в индекс',
        gitCommit: 'Создать коммит',
        gitPush: 'Отправить на сервер',
        gitPull: 'Получить с сервера',
        npmInstall: 'Установить пакеты',
        npmRun: 'Запустить скрипт',
        npmStart: 'Запустить приложение',
        npmTest: 'Запустить тесты',
        runHelp: 'Справка по run',
        runLanguages: 'Список языков',
        runPython: 'Выполнить Python код',
        runJs: 'Выполнить JavaScript код',
        runRust: 'Выполнить Rust код',
        clear: 'Очистить терминал',
        help: 'Показать справку',
        history: 'История команд',
        whoami: 'Текущий пользователь',
        neofetch: 'Информация о системе и браузере',
        claude: 'AI ассистент Claude (SSE стриминг)'
      },

      // Claude command translations
      claudeUsage: 'Использование: claude <ваш запрос>',
      claudeExample: 'Пример: claude напиши функцию сортировки',
      claudeNoResponse: 'Нет ответа от Claude',

      // Справка по команде run
      runHelpTitle: 'Универсальный исполнитель кода - Выполнение кода на 25+ языках',
      runHelpUsage: `Использование:
  run [опции] <код-или-файл>`,

      runHelpOptions: `Опции:
  --lang, -l <язык>     Указать язык программирования
  --code, -c <код>      Встроенный код для выполнения
  --languages, --list   Показать все поддерживаемые языки
  --help, -h            Показать это сообщение справки`,

      runHelpLanguages: `Поддерживаемые языки (25+):
  Python, JavaScript, TypeScript, Rust, Go, C, C++, Java, C#,
  Ruby, PHP, Bash, Swift, Kotlin, Lua, Perl, Haskell, Elixir,
  Julia, R, Dart, Crystal, Groovy, Zig, Nim`,

      runHelpExamples: `Примеры:
  run --lang python --code "print('Привет из Python!')"
  run --lang javascript --code "console.log('Привет из JS!')"
  run --lang rust --code "fn main() { println!(\"Привет из Rust!\"); }"
  run script.py
  run program.js
  run --languages  (показать все поддерживаемые языки)`,

      runHelpAutoDetect: `Автоопределение:
  При выполнении файла язык автоматически определяется по расширению.`,

      runHelpDocs: `Документация:
  См. backend/monolith/docs/UNIVERSAL_RUNNER_INTEGRATION.md`,

      // Сообщения об определении языка
      autoDetectedLanguage: 'Автоопределен язык: {language}',
      executedWith: 'Выполнено с {language} (код выхода: {code})',

      // Сообщения об ошибках
      errorMissingCodeOrFile: 'Ошибка: Требуется код или файл. Используйте "run --help" для справки.',
      errorFetchLanguages: 'Ошибка: Не удалось получить список поддерживаемых языков',
      errorExecuting: 'Ошибка: {message}',

      // Отображение поддерживаемых языков
      supportedLanguagesTitle: 'Поддерживаемые языки (всего {total}):',
      useRunHelp: 'Используйте "run --help" для примеров использования.',

      // Подсказки команд
      listFiles: 'Список файлов и каталогов',
      changeDirectory: 'Изменить каталог',
      printWorkingDir: 'Показать текущий каталог',
      displayFile: 'Показать содержимое файла',
      createDir: 'Создать каталог',
      createFile: 'Создать пустой файл',
      removeFile: 'Удалить файл',
      moveRenameFile: 'Переместить/переименовать файл',
      copyFile: 'Копировать файл',
      showGitStatus: 'Показать статус git',
      showCommitHistory: 'Показать историю коммитов',
      showChanges: 'Показать изменения',
      stageFiles: 'Добавить файлы в индекс',
      commitChanges: 'Создать коммит',
      pushToRemote: 'Отправить на удаленный репозиторий',
      pullFromRemote: 'Получить с удаленного репозитория',
      installPackages: 'Установить пакеты',
      runScript: 'Запустить скрипт',
      startApp: 'Запустить приложение',
      runTests: 'Запустить тесты',
      showRunnerHelp: 'Показать справку по универсальному исполнителю',
      listSupportedLangs: 'Список поддерживаемых языков',
      executePythonCode: 'Выполнить Python код',
      executeJsCode: 'Выполнить JavaScript код',
      executeRustCode: 'Выполнить Rust код',
      clearTerminal: 'Очистить терминал',
      showHelp: 'Показать справку',
      showHistory: 'Показать историю команд'
    }
  },

  // Modern CLI Terminal
  terminal: {
    title: 'Modern CLI Terminal',
    newSession: 'Новая сессия',
    selectModel: 'Выбрать AI модель',
    aiAssist: 'AI Помощник',
    clearScreen: 'Очистить',
    closeSession: 'Закрыть сессию',
    sessionId: 'ID сессии',
    workDir: 'Рабочая директория',
    status: 'Статус',
    connected: 'Подключено',
    disconnected: 'Отключено',
    noSession: 'Нет активной сессии терминала',
    clickNewSession: 'Нажмите "Новая сессия" для запуска терминала',

    // AI Assistant
    aiAssistant: 'AI Помощник команд',
    aiAssistHelp: 'Попросите AI помощника помочь с командами терминала, объяснениями или решениями.',
    yourQuestion: 'Ваш вопрос',
    aiQueryPlaceholder: 'Например: Как найти большие файлы? или Что означает эта ошибка?',
    askAI: 'Спросить AI',
    aiThinking: 'AI думает...',
    aiResponse: 'Ответ AI',

    // Features
    features: 'Возможности',
    lightweight: 'Легковесный',
    lightweightDesc: 'Быстрый и отзывчивый терминал с минимальными накладными расходами',
    secureIsolation: 'Безопасная изоляция',
    secureIsolationDesc: 'Каждая сессия работает в изолированном окружении для безопасности',
    commandFiltering: 'Фильтрация команд',
    commandFilteringDesc: 'Автоматическая проверка команд для предотвращения потенциально опасных операций',
    projectDirectory: 'Директория проекта',
    projectDirectoryDesc: 'Автоматически запускается в директории вашего проекта для удобства',
    aiAssistantDesc: 'Встроенный AI помощник для помощи с командами и устранением неполадок'
  },

  // Philosophy Knowledge Graph
  philosophyGraph: {
    title: 'Граф знаний: Античная философия',
    filterBySchool: 'Фильтровать по школе',
    allSchools: 'Все школы',
    search: 'Поиск',
    searchPlaceholder: 'Введите имя философа...',
    years: 'Годы жизни',
    school: 'Школа',
    description: 'Описание',
    keyIdeas: 'Ключевые идеи',
    quotes: 'Цитаты',
    period: 'Период',
    place: 'Место',
    mainIdeas: 'Основные идеи'
  },

  // Philosophy Mind Map
  philosophyMindMap: {
    title: 'Ментальная карта: Античная философия',
    legendRoot: 'Корень (Античная философия)',
    legendSchool: 'Философская школа',
    legendPhilosopher: 'Философ'
  },

  // Philosophy Study Guide
  philosophyStudyGuide: {
    title: 'Конспект по античной философии',
    subtitle: 'Учебные материалы для студентов философского факультета МГУ',
    downloadMd: 'Скачать MD',
    downloadDocx: 'Скачать DOCX',
    methodology: 'Методика изучения',
    quickReference: 'Быстрая справка: Ключевые философы'
  },

  // Agent Studio
  agentStudio: {
    // Toolbar
    title: 'Студия Агентов',
    newAgent: 'Новый агент',
    loadAgent: 'Загрузить',
    save: 'Сохранить',
    nodesCount: '{count} узлов',
    connectionsCount: '{count} связей',
    exportJson: 'Экспорт JSON',
    publish: 'Опубликовать',
    preview: 'Тест',

    // Tabs
    tabs: {
      nodes: 'Узлы',
      properties: 'Свойства',
      canvas: 'Холст',
      prompt: 'Промпт',
      knowledge: 'База знаний',
      tools: 'Инструменты'
    },

    // Dialogs
    dialogs: {
      createNewAgent: 'Создать нового агента',
      loadAgent: 'Загрузить агента',
      agentName: 'Имя агента',
      category: 'Категория',
      description: 'Описание',
      icon: 'Иконка (emoji)',
      cancel: 'Отмена',
      create: 'Создать'
    },

    // Categories
    categories: {
      ai: 'ИИ и МО',
      analytics: 'Аналитика',
      automation: 'Автоматизация',
      business: 'Бизнес',
      data: 'Данные',
      text: 'Обработка текста',
      web: 'Веб',
      custom: 'Пользовательский'
    },

    // Table Headers
    table: {
      name: 'Имя',
      category: 'Категория',
      version: 'Версия',
      status: 'Статус',
      created: 'Создано'
    },

    // Status
    status: {
      draft: 'Черновик',
      active: 'Активен',
      inactive: 'Неактивен',
      error: 'Ошибка'
    },

    // Messages
    messages: {
      agentCreated: 'Агент успешно создан',
      agentSaved: 'Агент успешно сохранен',
      agentLoaded: 'Агент успешно загружен',
      agentExported: 'Агент успешно экспортирован',
      genesisLoaded: 'Загружен план "{name}" из Genesis',
      genesisNotFound: 'План из Genesis не найден. Создайте приложение заново.',
      noAgent: 'Нет агента',
      createOrLoadFirst: 'Пожалуйста, сначала создайте или загрузите агента',
      success: 'Успешно',
      error: 'Ошибка',
      info: 'Информация',
      warning: 'Предупреждение'
    },

    // Empty States
    emptyStates: {
      selectNode: 'Выберите узел для редактирования свойств',
      clickPreview: 'Нажмите Тест для проверки вашего агента'
    },

    // Sidebar
    sidebar: {
      agentPreview: 'Предпросмотр агента'
    },

    // Node Palette
    nodePalette: {
      searchNodes: 'Поиск узлов...',
      categories: {
        input: 'Ввод',
        processing: 'Обработка',
        memory: 'Память',
        tools: 'Инструменты',
        output: 'Вывод'
      },
      nodes: {
        // Input
        userInput: 'Пользовательский ввод',
        userInputDesc: 'Получить сообщение пользователя',
        fileInput: 'Загрузка файла',
        fileInputDesc: 'Загрузить файл',

        // Processing
        llmCall: 'Вызов LLM',
        llmCallDesc: 'Обработка с помощью модели ИИ',
        transform: 'Преобразование',
        transformDesc: 'Преобразовать данные',
        condition: 'Условие',
        conditionDesc: 'Логика if/else',

        // Memory
        vectorStore: 'Векторное хранилище',
        vectorStoreDesc: 'RAG векторная база данных',
        chatHistory: 'История чата',
        chatHistoryDesc: 'Память разговора',

        // Tools
        webSearch: 'Веб-поиск',
        webSearchDesc: 'Поиск в интернете',
        apiCall: 'API вызов',
        apiCallDesc: 'Вызов внешнего API',
        codeExecutor: 'Исполнитель кода',
        codeExecutorDesc: 'Запустить код',

        // Output
        textOutput: 'Текстовый вывод',
        textOutputDesc: 'Вернуть текстовый ответ',
        jsonOutput: 'JSON вывод',
        jsonOutputDesc: 'Вернуть JSON данные'
      }
    },

    // Properties Panel
    properties: {
      title: 'Свойства узла',
      label: 'Метка',
      inputType: 'Тип ввода',
      aiModel: 'Модель ИИ',
      temperature: 'Температура',
      memoryType: 'Тип памяти',
      toolName: 'Имя инструмента',
      outputFormat: 'Формат вывода',

      // Options
      inputTypes: {
        text: 'Текст',
        file: 'Файл',
        image: 'Изображение',
        audio: 'Аудио'
      },
      memoryTypes: {
        vector: 'Векторный',
        conversation: 'Разговор',
        longTerm: 'Долгосрочный',
        shortTerm: 'Краткосрочный'
      },
      outputFormats: {
        text: 'Текст',
        json: 'JSON',
        markdown: 'Markdown',
        html: 'HTML'
      }
    },

    // Placeholders
    placeholders: {
      agentName: 'напр., Агент поддержки клиентов',
      selectCategory: 'Выберите категорию',
      description: 'Краткое описание...',
      iconEmoji: '🤖'
    }
  },

  // Genesis - One Prompt → One App
  genesis: {
    title: 'Genesis',
    subtitle: 'Один промпт → Одно приложение',
    viewTemplates: 'Шаблоны',
    myApps: 'Мои приложения',

    // Input section
    describeApp: 'Опишите ваше приложение',
    describeAppHint: 'Опишите, какое приложение вы хотите создать. Genesis проанализирует ваш запрос и сгенерирует полное приложение с агентами, рабочими процессами и интерфейсом.',
    appDescriptionLabel: 'Описание приложения *',
    appDescriptionPlaceholder: 'Пример: Создайте приложение для анализа отзывов клиентов с дашбордом, показывающим тренды настроений, общие темы и еженедельные сводки',
    appDescriptionHint: 'Будьте конкретны в отношении функций, данных и рабочих процессов',

    // Buttons
    clear: 'Очистить',
    analyzeAndGenerate: 'Анализировать и создать',
    analyzing: 'Анализ...',

    // Progress messages
    analyzingRequest: 'Анализируем ваш запрос...',
    appGeneratedSuccess: 'Приложение успешно создано!',
    generationFailed: 'Ошибка генерации',
    failedToGenerate: 'Не удалось создать приложение',
    failedToLoadApps: 'Не удалось загрузить ваши приложения',
    failedToLoadApp: 'Не удалось загрузить приложение',
    noAgentAvailable: 'Для этого приложения ещё не создан агент',

    // My Apps section
    myGeneratedApps: 'Мои созданные приложения',
    appTemplates: 'Шаблоны приложений',
    created: 'Создано',
    view: 'Просмотр',
    openChat: 'Открыть чат',
    searchApps: 'Поиск приложений...',
    filterByType: 'Фильтр по типу',
    filterByStatus: 'Фильтр по статусу',

    // Preview section
    planGenerated: 'План приложения успешно создан!',
    generatedSummary: 'Создано {components} компонентов и {dataModels} моделей данных.',
    overview: 'Обзор',
    appType: 'Тип приложения:',
    description: 'Описание:',
    complexity: 'Сложность:',
    componentsCount: 'Компоненты:',
    components: 'Компоненты',
    config: 'Конфигурация:',
    dataModels: 'Модели данных',
    generationResult: 'Результат генерации',
    errorsOccurred: '{count} ошибок при генерации:',

    // Stats
    agents: 'Агенты',
    workflows: 'Рабочие процессы',
    uiComponents: 'UI компоненты',

    // Actions
    deployApp: 'Развернуть',
    openChat: 'Открыть чат',
    openAgent: 'Открыть агента',
    openInAgentStudio: 'Открыть в Agent Studio',
    editPlan: 'Редактировать план',
    download: 'Скачать',

    // Errors
    agentNotCreated: 'Агент не создан',
    agentNotCreatedDetail: 'Агент не был создан из-за ошибки. Попробуйте создать приложение заново.',

    // App types
    appTypes: {
      chatbot: 'Чат-бот',
      dashboard: 'Дашборд',
      form_processor: 'Обработчик форм',
      automation: 'Автоматизация',
      full_app: 'Полное приложение'
    },

    // Complexity levels
    complexityLevels: {
      simple: 'Простой',
      medium: 'Средний',
      complex: 'Сложный'
    },

    // Component types
    componentTypes: {
      agent: 'Агент',
      workflow: 'Рабочий процесс',
      ui_component: 'UI компонент',
      data_model: 'Модель данных',
      api_endpoint: 'API эндпоинт'
    },

    // Statuses
    statuses: {
      planned: 'Запланировано',
      generating: 'Генерация',
      ready: 'Готово',
      failed: 'Ошибка'
    },

    // Generation modes
    generationMode: 'Режим генерации',
    modes: {
      genesis: 'Genesis',
      project: 'Проект',
      agents: 'Агенты',
      automation: 'Автоматизация'
    },
    modeDescriptions: {
      genesis: 'Создать полное приложение с workspace, агентами и автоматизацией',
      project: 'Создать только workspace с базой знаний',
      agents: 'Создать только AI-агентов без workspace',
      automation: 'Создать только автоматизацию без агентов'
    },

    // Progress steps
    steps: {
      analyzing: 'Анализ запроса',
      analyzingDesc: 'Понимаем ваши требования',
      planning: 'Планирование',
      planningDesc: 'Создаём архитектуру приложения',
      creatingWorkspace: 'Создание Workspace',
      creatingWorkspaceDesc: 'Настройка рабочего пространства',
      creatingKnowledge: 'База знаний',
      creatingKnowledgeDesc: 'Настройка базы знаний',
      creatingAgent: 'Создание агента',
      creatingAgentDesc: 'Конфигурация AI-агента',
      settingAutomation: 'Автоматизация',
      settingAutomationDesc: 'Настройка рабочих процессов',
      enablingPublic: 'Публичный доступ',
      enablingPublicDesc: 'Включение публичного доступа',
      complete: 'Завершено',
      completeDesc: 'Приложение готово к использованию'
    },

    // Thinking blocks
    thinking: {
      analyzingPrompt: 'Анализ промпта',
      analyzingPromptDesc: 'Разбираем ваш запрос на компоненты',
      generatingPlan: 'Генерация плана',
      generatingPlanDesc: 'Создаём структуру приложения',
      complete: 'Генерация завершена',
      completeDesc: 'Приложение успешно создано',
      error: 'Ошибка',
      errorDesc: 'Произошла ошибка во время генерации'
    },

    // Progress component
    hideThinking: 'Скрыть AI мышление',
    showThinking: 'Показать AI мышление',
    aiThinking: 'AI мышление',
    generationComplete: 'Генерация завершена',
    generating: 'Генерация...',
    ready: 'Готов',

    // Mermaid diagram
    architectureDiagram: 'Диаграмма архитектуры',

    // Template features
    templateApplied: 'Шаблон применён',
    templateAppliedDetail: 'Шаблон "{name}" успешно применён',
    usingTemplate: 'Используется шаблон',
    templateCategory: 'Категория',
    willCreate: 'Будет создано',
    popular: 'Популярный',
    noTemplatesInCategory: 'Нет шаблонов в этой категории',

    // Categories
    categories: {
      all: 'Все',
      business: 'Бизнес',
      analytics: 'Аналитика',
      automation: 'Автоматизация'
    },
    regenerate: 'Пересоздать',
    downloadSvg: 'Скачать SVG',
    renderingDiagram: 'Рендеринг диаграммы...',
    diagramRenderError: 'Ошибка рендеринга диаграммы',
    viewMermaidCode: 'Посмотреть Mermaid код',
    openAgent: 'Открыть агента',

    // FAQ
    faq: {
      title: 'Часто Задаваемые Вопросы',
      q1: 'Сколько стоит Genesis?',
      a1: 'Genesis использует ваши AI-токены DronDoc. Стоимость зависит от сложности: простое приложение ~5K токенов ($0.05), среднее ~15K токенов ($0.15), сложное ~30K токенов ($0.30).',
      q2: 'Как долго создается приложение?',
      a2: 'Обычно 30-60 секунд для полного приложения в зависимости от сложности и количества компонентов.',
      q3: 'Могу ли я редактировать созданный код?',
      a3: 'Да! Весь код доступен для редактирования. Агентов можно настроить в интерфейсе, таблицы - в Integram, автоматизацию - на странице Automation.',
      q4: 'Какие AI-модели поддерживаются?',
      a4: 'Genesis поддерживает DeepSeek (по умолчанию), GPT-4/GPT-4o, Claude (Sonnet, Opus) и другие модели через токены DronDoc.',
      q5: 'Как добавить данные в приложение?',
      a5: 'Три способа: через формы в приложении, напрямую в Integram, или через API (POST запросы).',
      q6: 'Что если результат не устраивает?',
      a6: 'Попробуйте уточнить промпт (добавить детали), изменить режим генерации, использовать шаблон как основу, или редактировать компоненты вручную.',
      q7: 'Можно ли удалить приложение?',
      a7: 'Да, откройте список приложений, нажмите "Удалить" на карточке и подтвердите. Внимание: удаляются все компоненты (агент, таблицы, автоматизация).',
      q8: 'Как поделиться приложением?',
      a8: 'Два варианта: включить публичный доступ для агента (получите публичную ссылку) или пригласить пользователей в workspace.',
      viewDocs: 'Смотреть полную документацию'
    },

    // Help tooltips
    help: {
      modeSelector: 'Выберите тип генерации: Genesis (полное приложение), Project (workspace + проекты), Agents (только AI-агенты), Automation (только автоматизация)',
      promptInput: 'Опишите детально: какие таблицы нужны, что должен делать агент, какие дашборды показывать, какую автоматизацию настроить',
      templates: 'Используйте готовые шаблоны для быстрого старта. Можно редактировать промпт после выбора шаблона',
      viewApps: 'Посмотрите все ваши созданные приложения, откройте их или удалите ненужные'
    }
  },

  // Agent Preview Page
  agentPreview: {
    share: 'Поделиться',
    loadingAgent: 'Загрузка агента...',
    errorLoading: 'Ошибка загрузки агента',
    agentNotFound: 'Агент не найден',
    agentNotFoundDetail: 'Агент с таким ID не существует. Возможно, он не был создан или был удалён.',
    retry: 'Повторить',
    backToGenesis: 'Вернуться в Genesis',
    welcomeTitle: 'Добро пожаловать!',
    welcomeMessage: 'Начните диалог, чтобы пообщаться с агентом',
    inputPlaceholder: 'Введите сообщение...',
    error: 'Ошибка',
    shareSuccess: 'Скопировано!',
    shareSuccessDetail: 'Ссылка на агента скопирована в буфер обмена',
    shareFailed: 'Не удалось скопировать ссылку'
  },

  quickActions: {
    suggestedActions: 'Быстрые действия',
    success: 'Успешно',
    error: 'Ошибка',
    automationStarted: 'Автоматизация запущена',
    escalated: 'Обращение передано',
    types: {
      prompt: 'Промпт',
      api: 'API-вызов',
      automation: 'Автоматизация',
      escalate: 'Эскалация'
    },
    editor: {
      title: 'Редактор быстрых действий',
      subtitle: 'Настройте кнопки быстрых действий для этого агента',
      label: 'Название',
      type: 'Тип',
      icon: 'Иконка',
      severity: 'Стиль',
      prompt: 'Текст промпта',
      apiEndpoint: 'API endpoint',
      method: 'HTTP метод',
      automationId: 'ID автоматизации',
      reason: 'Причина эскалации',
      priority: 'Приоритет',
      addAction: 'Добавить действие',
      newAction: 'Новое действие',
      noActions: 'Быстрые действия не настроены. Нажмите "Добавить действие" чтобы создать.',
      saved: 'Быстрые действия успешно сохранены',
      loadFailed: 'Не удалось загрузить быстрые действия'
    }
  },

  // Ecosystem (FinModel Ecosystem — Drone Value Chain)
  ecosystem: {
    title: 'Экосистема FinModel — Цепочка ценности дронов',
    subtitle: 'Интерактивные прототипы всех 10 аналитических фреймворков.',
    subtitleChain: 'Взаимосвязанные бизнесы: Производство → Услуги → Аналитика → Страхование.',
    fromIntegram: 'из Integram',
    dataSourceIntegram: 'данные из Integram',

    badges: {
      systemNPV: 'NPV системы',
      synergyPremium: 'Синерг. премия',
      maxMultiplier: 'Макс. мультипл.',
      totalInvestment: 'Суммарные инв.'
    },

    tabs: {
      overview: 'Обзор',
      sankey: 'Потоки Санкей',
      leontief: 'Матрица Леонтьева',
      flywheel: 'Маховик',
      cld: 'Контуры КОС',
      scenarios: 'Сценарии',
      frameworks: 'Фреймворки',
      synergyDcf: 'Синергия DCF',
      consolidation: 'Консолидация',
      roadmap: 'Инв. дорожная карта',
      monteCarlo: 'Монте-Карло',
      realOptions: 'Реальные опционы',
      tornado: 'Торнадо-диаграмма',
      pdf: 'Экспорт PDF'
    },

    overview: {
      phase: 'Фаза',
      standaloneNPV: 'NPV самостоятельно',
      investment: 'Инвестиции',
      leontiefMult: 'Мультипл. Леонт.',
      max: 'МАКС',
      valueChain: 'Цепочка ценности',
      valueChainSubtitle: 'Каждый бизнес передаёт следующему данные, компетенции и клиентов'
    },

    businesses: {
      manufacturing: 'Производство дронов',
      services: 'Дроновые услуги (DaaS)',
      analytics: 'Аналитика данных',
      insurance: 'Оптимизация страхования',
      manufacturingDesc: 'Производит промышленные дроны; поставляет в Услуги по себестоимости; запускает маховик данных.',
      servicesDesc: 'Аэрофотосъёмка и картографирование по подписке; генерирует 100М+ точек данных/год.',
      analyticsDesc: 'Скоринг рисков, детектирование аномалий и модели предиктивного обслуживания.',
      insuranceDesc: 'Точное страхование на основе данных о рисках от дронов; наибольший абсолютный NPV.'
    },

    panes: {
      sankeyTitle: 'Диаграмма Санкей:',
      sankeyDesc: 'Ширина потока пропорциональна годовому объёму. Прототип использует SVG без внешних библиотек. Для продакшна рекомендуется d3-sankey для оптимального расположения узлов.',
      leontiefTitle: 'Матрица Леонтьева:',
      leontiefDesc: 'Измените технические коэффициенты для просмотра мультипликаторов в реальном времени. Инверсия матрицы выполняется методом Гаусса-Жордана — без внешних библиотек. Мультипликатор выпуска = сумма столбца (I−A)⁻¹.',
      leontiefDataSource: 'данные из Integram (тип 17822)',
      flywheelTitle: 'Диаграмма маховика:',
      flywheelDesc: 'Круговая визуализация контуров обратной связи. Коэффициент маховика = (∏ эластичностей)^(1/n). КМ>1 = самоусиливающийся (зелёный), КМ<1 = затухающий (красный).',
      flywheelDataSource: 'данные из Integram (типы 17815+17993)',
      cldTitle: 'Диаграмма КОС:',
      cldDesc: 'Нажмите кнопку контура для выделения пути. Перетащите узлы для перестановки. Нажмите "↓ SVG" для экспорта.',
      cldDataSource: 'данные из Integram (типы 17815+17993)',
      scenariosTitle: 'Сравнение сценариев:',
      scenariosDesc: 'Три сценария, построенные мультиметодным подходом. Все сценарии показывают положительную синергетическую премию — даже в пессимистичном варианте.',
      frameworksTitle: 'Матрица сравнения инструментов:',
      frameworksDesc: 'Все 10 фреймворков из исследования, оценённые по ключевым критериям. См. полный документ исследования для подробностей.',
      synergyDcfTitle: 'Калькулятор синергетического DCF',
      synergyDcfTitleParens: '(метод Дамодарана):',
      synergyDcfDesc: 'NPV системы = Σ NPV самостоятельно + PV(операц. синергий) + Финансовые синергии. Управляйте WACC и вероятностью реализации синергий ползунками. Диаграмма водопада показывает пошаговое наращивание стоимости.',
      consolidationTitle: 'Многосубъектная консолидация:',
      consolidationDesc: 'Объединение P&L всех бизнесов. Внутригрупповые потоки (из диаграммы Санкей) исключаются для отображения чистой внешней выручки. Включайте исключения и синергетические корректировки для оценки их влияния на консолидированный результат.',
      consolidationDataSource: 'потоки ценности из Integram',
      roadmapTitle: 'Инвестиционная дорожная карта:',
      roadmapDesc: 'Денежный поток по годам и бизнесам. Зелёные столбцы = положительный ДП, красные = инвестиции / отрицательный ДП. Пунктирная линия = год безубыточности. Накопленный график показывает горизонт окупаемости системы. Вехи отмечают ключевые события запуска.',
      monteCarloTitle: 'Симуляция Монте-Карло:',
      monteCarloDesc: '10 000 стохастических сценариев. Выручка, затраты, вероятности потоков, задержка и ставка дисконтирования сэмплируются из треугольных распределений. Гистограмма показывает полное распределение NPV; нанесены линии P10/P50/P90 и VaR (P5).',
      realOptionsTitle: 'Оценка реальных опционов (составной колл Блэка-Шоулза):',
      realOptionsDesc: 'Каждая фазовая инвестиция = опцион на вход в следующий бизнес. Стоимость составного опциона отражает поэтапную гибкость. Управляйте волатильностью (σ) и безрисковой ставкой ползунками.',
      tornadoTitle: 'Торнадо-диаграмма (анализ чувствительности):',
      tornadoDesc: 'Каждый параметр меняется на ±20% при фиксированных остальных. Столбцы отсортированы по абсолютному влиянию на NPV системы — самые широкие вносят наибольший вклад. Наведите на столбец для детального разбора.',
      pdfTitle: 'Экспорт инвест. меморандума в PDF:',
      pdfDesc: 'Создаёт профессиональный документ для инвесторов. Включает краткое резюме, все визуализации (Санкей, Водопад, Монте-Карло, Реальные опционы, Торнадо), методологию и допущения. Целевой размер: <5 МБ.'
    },

    scenarios: {
      totalInvestment: 'Суммарные инвестиции',
      standaloneNPVSum: 'Сумма NPV самостоятельно',
      systemNPV: 'NPV системы',
      synergyValue: 'Стоимость синергий',
      synergyPremium: 'Синергетическая премия',
      standalone: 'Самост.',
      synergy: 'Синергия',
      pessimistic: 'Пессимистичный',
      pessimisticTag: 'Снижение',
      pessimisticDesc: '40% реализации синергий, WACC 15%, медленное освоение рынка',
      base: 'Базовый',
      baseTag: 'Наиболее вероятный',
      baseDesc: '80% реализации синергий, WACC 12%, умеренный рост',
      optimistic: 'Оптимистичный',
      optimisticTag: 'Рост',
      optimisticDesc: '100% реализации синергий, WACC 10%, высокий рост и сетевые эффекты'
    },

    frameworks: {
      header: 'Фреймворк',
      feedbackLoops: 'Контуры ОС',
      financialValue: 'Финансовая ценность',
      uncertainty: 'Неопределённость',
      visualization: 'Визуализация',
      investorFacing: 'Для инвестора',
      scalable: 'Масштаб. до N',
      scoreLegendHigh: '✓ Да/Высокий',
      scoreLegendMid: '~ Частично/Средний',
      scoreLegendLow: '✗ Нет/Низкий',
      synergyDCF: 'Синергетический DCF (Дамодаран)',
      systemDynamics: 'Системная динамика / КОС',
      leontief: 'Модель Леонтьева (затраты-выпуск)',
      flywheel: 'Платформенный маховик',
      realOptions: 'Реальные опционы (МК)',
      bsc: 'BSC / Стратегические карты',
      consolidation: 'Многосубъектная консолидация',
      bmc: 'BMC экосистемы',
      portfolio: 'Портфельные матрицы (BCG)',
      graph: 'Граф-ориентированное моделирование'
    },

    sankey: {
      title: 'Потоки ценности между бизнесами (диаграмма Санкей)',
      description: 'Ширина каждого потока пропорциональна годовому объёму. Наведите на поток для подробностей.',
      tooltipType: 'Тип:',
      tooltipVolume: 'Объём:',
      perYear: '/год',
      tooltipSynergy: 'Синергия:'
    },

    leontief: {
      title: 'Матрица Леонтьева «затраты-выпуск»',
      description: 'Коэффициент a_ij = доля выпуска сектора i, потребляемая сектором j. Модель Леонтьева: x = (I−A)⁻¹ · d. Измените значения коэффициентов для просмотра мультипликаторов в реальном времени.',
      singularWarning: '⚠ Матрица вырождена (det=0) — мультипликаторы приблизительны. Проверьте согласованность коэффициентов.',
      sectionA: 'Матрица технических коэффициентов A',
      sectionHeatmap: 'Тепловая карта коэффициентов',
      sectionInverse: 'Обратная матрица Леонтьева (I - A)⁻¹',
      sectionMultipliers: 'Мультипликаторы выпуска (совокупный выпуск системы на $1 инвестиций)',
      axisLabel: 'От ↓ / К →',
      heatmapNote: 'Интенсивность цвета отражает величину коэффициента. Темнее = сильнее межсекторная зависимость.',
      inverseNote: 'Элемент [i,j] = совокупный прямой + косвенный выпуск сектора i на единицу конечного спроса сектора j.',
      multipliersNote: 'Сумма столбца (I−A)⁻¹ для каждого сектора. Выше мультипликатор = больше рычаг на совокупный выпуск.',
      perDollar: 'на $1 инвестиций',
      maxBadge: 'MAX',
      insightLabel: 'Ключевой вывод:',
      insightText: 'Наибольший мультипликатор принадлежит {sector} (${value} на $1 инвестиций). Это означает, что наиболее выгодная точка инвестиций для совокупного выпуска системы — {sector}.',
      multTooltip: 'Каждый $1 в {sector} генерирует ${value} в системе',
      sectorMfg: 'Производство дронов',
      sectorMfgShort: 'Пр-во',
      sectorSvc: 'Дроновые услуги',
      sectorSvcShort: 'Услуги',
      sectorAnalytics: 'Аналитика данных',
      sectorAnalyticsShort: 'Аналит.',
      sectorInsurance: 'Опт. страхования',
      sectorInsuranceShort: 'Страх.'
    },

    cld: {
      title: 'Диаграмма контуров обратной связи (КОС)',
      description: 'Контуры обратной связи в экосистеме дронов.',
      polarityPlus: 'усиливающая полярность',
      polarityMinus: 'балансирующая полярность',
      loopR: 'усиливающий контур.',
      dragHint: 'Перетащите узлы для перестановки.',
      exportSvg: 'Экспорт в SVG',
      flywheelFactor: 'Коэффициент маховика:',
      loopClosure: '↩ (контур)',
      reinforcingPolarity: 'Полярность усиления: A растёт → B растёт',
      balancingPolarity: 'Полярность баланса: A растёт → B убывает',
      reinforcingLoop: 'Усиливающий контур — маховик',
      r1Name: 'R1: Маховик данных',
      r1Desc: 'Больше полётов → больше данных → лучше прогностические модели → выше страховая ценность → больше инвестиций в дроны.',
      r2Name: 'R2: Контур затрат',
      r2Desc: 'Больше производства → ниже удельные затраты → дешевле услуги → больше спроса → рост производства.',
      r3Name: 'R3: Контур доверия',
      r3Desc: 'Лучшая аналитика → меньше претензий → доверие страховщиков → снижение премий → больше застрахованных клиентов.',
      varFlightHours: 'Часы полётов',
      varDataVolume: 'Объём данных',
      varModelAccuracy: 'Точность моделей',
      varInsuranceValue: 'Страховая ценность',
      varInvestment: 'Инвестиции',
      varFleetSize: 'Размер парка дронов',
      varProductionVolume: 'Объём производства',
      varUnitCost: 'Удельная стоимость',
      varServicePrice: 'Цена услуги',
      varCustomerDemand: 'Спрос клиентов',
      varAnalyticsQuality: 'Качество аналитики',
      varClaimsReduction: 'Снижение претензий',
      varInsurancePremium: 'Страховая премия',
      varInsuredClients: 'Застрахованные клиенты',
      varFlightDataVolume: 'Объём полётных данных'
    },

    flywheel: {
      title: 'Диаграмма маховика',
      description: 'Круговая визуализация контуров обратной связи. Каждая стрелка — причинно-следственная связь с полярностью (+/−). Коэффициент маховика (КМ) — геометрическое среднее всех эластичностей контура. Зелёный = самоусиливающийся (КМ>1), Красный = затухающий (КМ<1).',
      ffLabel: 'FF',
      reinforcing: 'УСИЛ.',
      damping: 'ЗАТУХ.',
      flywheelFactor: 'Коэффициент маховика:',
      reinforcingText: '↑ самоусиливающийся',
      dampingText: '↓ затухающий',
      formulaLabel: 'КМ = (∏ эластичностей)^(1/n) = ',
      r1Name: 'R1: Маховик данных',
      r1Desc: 'Больше полётов → больше данных → лучше прогностические модели → выше страховая ценность → больше дронов.',
      r2Name: 'R2: Затраты производства',
      r2Desc: 'Больше производства → ниже удельные затраты → дешевле услуги → больше клиентов.',
      r3Name: 'R3: Контур доверия',
      r3Desc: 'Лучшая аналитика → меньше претензий → доверие страховщиков → снижение премий → больше застрахованных.',
      varFlightHours: 'Часы полётов',
      varDataVolume: 'Объём данных',
      varModelAccuracy: 'Точность моделей',
      varInsuranceValue: 'Страховая ценность',
      varInvestment: 'Инвестиции',
      varFleetSize: 'Размер парка дронов',
      varProductionVolume: 'Объём производства',
      varUnitCost: 'Удельная стоимость',
      varServicePrice: 'Цена услуги',
      varCustomerDemand: 'Спрос клиентов',
      varAnalyticsQuality: 'Качество аналитики',
      varClaimsReduction: 'Снижение претензий',
      varInsurancePremium: 'Страховая премия',
      varInsuredClients: 'Застрахованные клиенты',
      varFlightDataVolume: 'Объём полётных данных'
    },

    consolidation: {
      showEliminations: 'Показать исключения',
      on: 'ВКЛ',
      off: 'ВЫКЛ',
      showSynergyAdj: 'Показать синергетические корректировки',
      currency: 'Валюта',
      colPLLine: 'Строка P&L',
      colEliminations: 'Исключения',
      colSynergyCorr: 'Корр. синергий',
      colConsolidated: 'Консолид.',
      revenue: 'Выручка',
      totalRevenue: 'Общая выручка',
      cogs: 'Себестоимость',
      grossProfit: 'Валовая прибыль',
      opex: 'Операционные расходы',
      sga: 'Коммерч. и адм. расходы',
      ebitda: 'EBITDA',
      da: 'Аморт. и износ (D&A)',
      ebit: 'EBIT',
      belowOpIncome: 'Ниже операционной прибыли',
      interestExpense: 'Процентные расходы',
      ebt: 'EBT (прибыль до налогов)',
      incomeTax: 'Налог на прибыль',
      netIncome: 'Чистая прибыль',
      eliminationsLegend: 'Внутригрупповые исключения (потоки ценности)',
      formulaTitle: 'Формула консолидации (FinParser)',
      formulaLine1: 'Консолид. P&L = Σ P&L(i) бизнесов',
      formulaLine2: '− Внутригрупповые исключения',
      formulaLine3: '+ Синергетические корректировки',
      netExternalRevenue: 'Внешняя выручка нетто:',
      netEbitda: 'EBITDA нетто:',
      netIncomeSys: 'Чистая прибыль системы:',
      shortMfg: 'Пр-во',
      shortSvc: 'Услуги',
      shortAnalytics: 'Аналит.',
      shortInsurance: 'Страх.',
      elimMfgSvcDesc: 'Дроны по себестоимости (Пр-во→Услуги)',
      elimSvcAnalyticsDesc: 'Услуги данных (Услуги→Аналитика)'
    },

    roadmap: {
      startYear: 'Начальный год',
      horizon: 'Горизонт (лет)',
      years: 'лет',
      show: 'Показать',
      cumulativeCF: 'Накопл. ДП',
      milestones: 'Вехи',
      chartTitle: 'Инвестиционная дорожная карта: денежные потоки по годам и бизнесам',
      cumulativeChartTitle: 'Накопленный денежный поток — система итого ($М)',
      totalInvestment: 'Суммарные инвестиции',
      payback: 'Окупаемость системы',
      yearPrefix: 'Год',
      terminalCF: 'Терм. ДП (год {year})',
      breakevenLabel: 'БУ:',
      positiveCF: 'Положит. ДП',
      negativeCF: 'Отрицат. ДП (инвестиции)',
      milestoneMfgLaunch: 'Запуск производства',
      milestoneSvcLaunch: 'Запуск услуг',
      milestoneFirstDataProduct: 'Первый продукт данных',
      milestoneInsuranceLicense: 'Страховая лицензия',
      shortMfg: 'Пр-во',
      shortSvc: 'Услуги',
      shortAnalytics: 'Аналит.',
      shortInsurance: 'Страхование'
    },

    monteCarlo: {
      iterations: 'Итерации',
      iter1000: '1 000 (быстро)',
      iter5000: '5 000',
      iter10000: '10 000 (по умолчанию)',
      revenueRange: 'Диапазон выручки (±%)',
      costRange: 'Диапазон затрат (±%)',
      probRange: 'Диапазон вероятностей (±)',
      discountRange: 'Ставка дисконт. (±п.п.)',
      running: '⏳ Выполняется…',
      runButton: '▶ Запустить Монте-Карло',
      targetNPV: 'Целевой NPV системы ($М)',
      targetProbability: 'Вероятность достижения цели:',
      breakevenProbability: 'Вероятность безубыточности:',
      var: 'VaR (P5)',
      p10: 'P10',
      p25: 'P25',
      p50: 'P50 (Медиана)',
      p75: 'P75',
      p90: 'P90',
      mean: 'Среднее',
      stdDev: 'Ст. откл.',
      chartTitle: 'Распределение NPV системы ({n} сценариев)',
      yAxis: 'Частота',
      xAxis: 'NPV системы ($М)',
      targetLine: 'Цель',
      emptyState: 'Нажмите «Запустить Монте-Карло» для построения распределения',
      elapsed: 'Симуляция завершена за {ms}мс ({n} итераций)'
    },

    realOptions: {
      sigma: 'Волатильность σ (%)',
      riskFreeRate: 'Безрисковая ставка (%)',
      timeStep: 'Шаг времени (лет)',
      years: 'лет',
      compoundOptionValue: 'Стоимость составного опциона',
      standaloneNPVSum: 'Σ NPV самостоятельно',
      optionPremium: 'Премия опциона',
      premiumPct: 'Премия %',
      chartTitle: 'Дерево решений реальных опционов: стоимость составного опциона',
      investNode: 'Узел инвестиций (стоимость опциона)',
      decisionNode: 'Решение: max(вложить, выйти)',
      abandonNode: 'Выход (сохранить инвестиции)',
      invest: 'Инвестировать →',
      abandon: 'Выйти',
      investLabel: 'Инвест.: -${value}М',
      sensitivityTitle: 'Чувствительность к волатильности',
      colSigma: 'Волатильность σ',
      colCompoundValue: 'Стоимость составного опциона',
      colStandaloneNPV: 'NPV самостоятельно (сумма)',
      colOptionPremium: 'Премия опциона',
      colPremiumPct: 'Премия %',
      phaseMfg: 'Производство',
      phaseMfgShort: 'Пр-во',
      phaseSvc: 'Услуги (DaaS)',
      phaseSvcShort: 'Услуги',
      phaseAnalytics: 'Аналитика',
      phaseAnalyticsShort: 'Аналит.',
      phaseInsurance: 'Страхование',
      phaseInsuranceShort: 'Страх.'
    },

    tornado: {
      variationRange: 'Диапазон изменения (±%)',
      topN: 'Топ параметров',
      topNLabel: 'Топ {n}',
      discountRate: 'Ставка дисконтирования (%)',
      chartTitle: 'Торнадо-диаграмма: топ {n} параметров по влиянию на NPV системы',
      baseline: 'Базовый ${value}М',
      xAxisLabel: 'ΔNPV от базового значения ($М)',
      tooltipBaseNPV: 'Базовый NPV:',
      tooltipLow: '-{pct}%:',
      tooltipHigh: '+{pct}%:',
      legendLow: '-{pct}% (влияние снижения)',
      legendHigh: '+{pct}% (влияние роста)',
      paramInsuranceRevenue: 'Страховая выручка ±20%',
      paramDiscountRate: 'Ставка дисконтирования ±20%',
      paramAnalyticsRevenue: 'Выручка аналитики ±20%',
      paramServicesRevenue: 'Выручка услуг ±20%',
      paramAnalyticsFlow: 'Поток Аналитика→Страхование ±20%',
      paramInsuranceCosts: 'Затраты страхования ±20%',
      paramMfgRevenue: 'Выручка производства ±20%'
    },

    pdf: {
      generating: '⏳ Генерация PDF…',
      exportButton: '📄 Экспорт инвест. меморандума (PDF)',
      lastGenerated: 'Последний:',
      previewHint: 'Будет создан многостраничный PDF-документ: Краткое резюме · Карта экосистемы · Профили бизнесов · Анализ синергий · Мультипликаторы Леонтьева · Контуры обратной связи · Монте-Карло · Реальные опционы · Инвестиционная дорожная карта · Торнадо-анализ · Приложение',
      coverTitle: 'Инвестиционный меморандум',
      coverSubtitle: 'Экосистема цепочки ценности дронов',
      coverTagline: 'Стохастическая оценка · Реальные опционы · Мультиметодный анализ',
      sec1Title: 'Краткое резюме',
      sec1SystemNPV: 'NPV системы (базовый сценарий)',
      sec1SynergyPremium: 'Синергетическая премия',
      sec1TotalInvestment: 'Суммарные инвестиции',
      sec1IRR: 'IRR (оценочный)',
      sec1Payback: 'Окупаемость (лет)',
      sec1MCMedian: 'Монте-Карло P50',
      sec2Title: 'Профили бизнесов',
      sec2ColBusiness: 'Бизнес',
      sec2ColType: 'Тип',
      sec2ColStandaloneNPV: 'NPV самостоятельно.',
      sec2ColInvestment: 'Инвестиции',
      sec2ColLeontief: 'Мультипл. Леонт.',
      sec2ColPhase: 'Фаза',
      sec2Total: 'Итого',
      sec3Title: 'Анализ синергий (метод Дамодарана)',
      sec3StandaloneSum: 'Сумма NPV самостоятельно',
      sec3OpSynergies: '+ Операционные синергии (выручка)',
      sec3FinSynergies: '+ Финансовые синергии (стоимость капитала)',
      sec3SystemNPV: '= NPV системы',
      sec3SynergyPremium: 'Синергетическая премия',
      sec3FlowsTitle: 'Потоки ценности',
      sec3ColSource: 'Источник',
      sec3ColTarget: 'Получатель',
      sec3ColVolume: 'Годовой объём',
      sec3ColFlowType: 'Тип потока',
      sec3ColSynergyType: 'Тип синергии',
      sec4Title: 'Симуляция Монте-Карло',
      sec4ColPercentile: 'Перцентиль',
      sec4ColSystemNPV: 'NPV системы',
      sec4ColInterpretation: 'Интерпретация',
      sec4P5: 'P5 (VaR)',
      sec4P5Desc: 'Худшие 5% исходов',
      sec4P10: 'P10',
      sec4P10Desc: 'Пессимистичный сценарий',
      sec4P25: 'P25',
      sec4P25Desc: 'Консервативный вариант',
      sec4P50: 'P50 (Медиана)',
      sec4P50Desc: 'Наиболее вероятный исход',
      sec4P75: 'P75',
      sec4P75Desc: 'Оптимистичный сценарий',
      sec4P90: 'P90',
      sec4P90Desc: 'Оптимистичный вариант',
      sec4BreakevenProb: 'Вероятность безубыточности (NPV ≥ 0):',
      sec4TargetProb: 'Вероятность достижения цели',
      sec5Title: 'Оценка реальных опционов',
      sec5CompoundValue: 'Стоимость составного опциона',
      sec5StandaloneSum: 'Σ NPV самостоятельно',
      sec5OptionPremium: 'Премия опциона',
      sec6Title: 'Анализ чувствительности (Торнадо)',
      sec6Desc: 'Ключевые факторы стоимости, ранжированные по абсолютному влиянию на NPV системы при изменении ±20%. Ставка дисконтирования и выручка от страхования — наиболее значимые параметры.',
      sec6ColParam: 'Параметр',
      sec6ColBaseNPV: 'Базовый NPV',
      sec6ColMin: 'Минимум (-20%)',
      sec6ColMax: 'Максимум (+20%)',
      sec6ColRange: 'Диапазон (ΔNPV)',
      sec7Title: 'Методология и приложение',
      sec7FrameworksTitle: 'Использованные аналитические фреймворки',
      sec7AssumptionsTitle: 'Допущения',
      sec7Disclaimer: 'Документ создан автоматически инструментом DronDoc FinModel Ecosystem. Все данные основаны на текущем состоянии модели экосистемы. Создан:'
    },

    synergyDCF: {
      wacc: 'WACC (%)',
      synergyRealization: 'Реализация синергии (%)',
      forecastPeriod: 'Период прогноза (лет)',
      years: 'лет',
      standaloneNPVSum: 'Сумма NPV самостоятельно',
      opSynergies: 'Операционные синергии',
      finSynergies: 'Финансовые синергии',
      systemNPV: 'NPV системы',
      synergyPremium: 'Синергетическая премия',
      requiredInvestment: 'Требуемые инвестиции',
      waterfallTitle: 'Водопад синергий: NPV самостоятельно → NPV системы (метод Дамодарана)',
      tableTitle: 'Компоненты синергии (взвешенные по вероятности)',
      colType: 'Тип синергии',
      colDescription: 'Описание',
      colGrossValue: 'Валовая стоимость',
      colProbability: 'Вероятность',
      colPV: 'PV (взвешенная)',
      totalLabel: 'Итого NPV синергий',
      standalone: 'Самост.',
      synergies: 'Синергии',
      operating: 'Опер.',
      financial: 'Фин.',
      system: 'Система',
      npv: 'NPV',
      synergyTypeRevenue: 'Выручка',
      synergyTypeCost: 'Затраты',
      synergyTypeFinancial: 'Финансовая',
      synDesc1: 'Кросс-продажи: дроновые услуги → страховые клиенты',
      synDesc2: 'Монетизация данных: аналитика → внешние рынки',
      synDesc3: 'Общий парк дронов: производство по себестоимости для услуг',
      synDesc4: 'Единая платформа: общие IT и комплаенс',
      synDesc5: 'Диверсификация → снижение WACC (~2%)',
      synDesc6: 'Налоговый щит через консолидированную отчётность'
    }
  },

  // Self-Improving Agent (СамоУлучшайка)
  selfImprovingAgent: {
    title: 'СамоУлучшайка',
    subtitle: 'Автономный агент для анализа и улучшения проекта',
    status: 'Статус агента',
    running: 'Запущен',
    stopped: 'Остановлен',
    pid: 'PID:',
    startedAt: 'Запущен:',
    screenSession: 'Screen:',
    start: 'Запустить',
    stop: 'Остановить',
    restart: 'Перезапустить',
    refresh: 'Обновить',
    statistics: 'Статистика',
    issuesCreated: 'Issues созданы',
    issuesSolved: 'Issues решены',
    prsMerged: 'PR смержены сегодня',
    activeSolves: 'Активные solve',
    successRate: 'Успешность',
    activeSessions: 'Активные сессии',
    noSessions: 'Нет активных solve сессий',
    logs: 'Логи',
    linesCount: 'Строк',
    noLogs: 'Логи недоступны',
    activityCharts: 'Графики активности',
    issuesChart: 'Issues по дням',
    prChart: 'Pull Requests по дням',
    successRateChart: 'Успешность по дням',
    prsMergedByDay: 'PR смержены',
    noHistory: 'История недоступна'
  },
  releaseNotes: {
    whatsNew: "Что нового в v{version}",
    releasedOn: "Дата выпуска: {date}",
    highlights: "Главное",
    added: "Добавлено",
    changed: "Изменено",
    fixed: "Исправлено",
    performance: "Производительность",
    documentation: "Документация",
    gotIt: "Понятно!"
  }
}

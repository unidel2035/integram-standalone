/**
 * Route Descriptions
 *
 * This file contains human-readable descriptions for all routes in the application.
 * When adding new routes, please add corresponding descriptions here.
 *
 * Format:
 * - Key: route path
 * - Value: object with { description, category, tags }
 */

export const routeDescriptions = {
  '/': {
    description: 'Главная страница платформы ДронДок с описанием возможностей и основных функций',
    category: 'public',
    tags: ['Landing', 'Home']
  },

  '/investor': {
    description: 'Презентация для инвестора: суверенная платформа знаний АэроНет. Когнитивная аналитика рынка БАС, архитектура платформы, 14 живых модулей, сравнение с Palantir, финансовая модель 2025-2028, суверенное преимущество. Интерактивные CSS-схемы, анимации, ссылки на все модули.',
    category: 'business',
    tags: ['Investor', 'Presentation', 'AeroNet', 'BAС', 'Palantir', 'Financial Model', 'NTI', 'Sovereignty']
  },

  '/must-have-agents': {
    description: 'AI Agents ROI Calculator: Interactive research tool to evaluate the business impact of implementing AI automation agents. Calculate time savings, cost reduction, and revenue growth with real-time visualizations.',
    category: 'tools',
    tags: ['ROI Calculator', 'AI Agents', 'Research Tool', 'Business Impact', 'Analytics', 'Automation', 'Productivity', 'Time Savings']
  },

  '/customer-journey': {
    description: 'Путь клиента до покупки: 6-шаговый процесс онбординга от запроса функций агента до регистрации. Включает создание организации, выбор агентов, расчет ROI, формирование КП и бесплатный 2-недельный тестовый период.',
    category: 'business',
    tags: ['Customer Journey', 'Onboarding', 'ROI Calculator', 'Commercial Proposal', 'Trial', 'Registration', 'Organization', 'AI Agents']
  },

  '/egrul': {
    description: 'Поиск данных ЕГРЮЛ по ИНН: получение полной информации о российских компаниях из Единого государственного реестра юридических лиц. Поддерживается поиск по ИНН (10 или 12 цифр), отображение основной информации (название, адрес, статус, ОГРН, КПП), кодов ОКВЭД, информации о руководителе и учредителях, контактных данных. Возможность скачивания выписки в форматах JSON и XML. Данные получаются из открытых источников через INN Parser API.',
    category: 'business',
    tags: ['ЕГРЮЛ', 'ИНН', 'Поиск компании', 'Выписка', 'Реквизиты', 'ОКВЭД', 'Директор', 'Учредители', 'Юридическая информация', 'Customer Journey', 'Organization Data', 'Company Lookup', 'Business Intelligence']
  },

  '/pentaract': {
    description: 'Pentaract Cloud Storage: облачное хранилище на базе Telegram с неограниченным объёмом (Issue #6252). Управление хранилищами (создание, удаление), файловый браузер с навигацией по папкам, загрузка/скачивание файлов с отслеживанием прогресса, создание папок, поиск файлов, управление доступом (Viewer/CanEdit/Admin). Интеграция через self-hosted Pentaract API. Поддержка файлов до 2GB.',
    category: 'data',
    tags: ['Cloud Storage', 'Files', 'Pentaract', 'Telegram', 'Upload', 'Download', 'File Browser', 'Storage Management', 'Issue #6252']
  },

  '/vtb-personal-data': {
    description: 'Система учёта процессов обработки персональных данных для ВТБ (Issue #5630): полнофункциональная система управления процессами обработки ПДн в соответствии с ФЗ-152 и требованиями регуляторов. Управление процессами обработки (создание, редактирование, удаление, фильтрация), категории ПДн (общие, специальные, биометрические, финансовые, идентификационные), цели обработки (банковские операции, кредитная история, маркетинг, аналитика), правовые основания (согласие, договор, федеральный закон, законные интересы), статусы процессов (активный, приостановлен, завершен, на ревизии, требует внимания). Ответственные подразделения и лица, состав обрабатываемых ПДн, источники получения данных, сроки хранения, меры защиты. Статистика и аналитика по процессам. База данных: ai2o.ru/vtb. Интеграция через Integram MCP.',
    category: 'business',
    tags: ['VTB', 'ВТБ', 'ПДн', 'Персональные данные', 'Personal Data', 'GDPR', '152-ФЗ', 'Compliance', 'Data Protection', 'Banking', 'Security', 'Audit', 'Integram', 'Issue #5630']
  },

  '/purchase-journey-testing': {
    description: 'Автоматический агент тестирования пути покупки: фоновое тестирование каждые 30 минут всех этапов пользовательского пути (от запроса агента до регистрации). Использует парадигму ReAct (Reason-Act-Observe). Автоматически создаёт issues, запускает solve command и мержит исправления. Улучшенный дашборд с Real-time updates (10с авто-обновление), детальная история тестов с фильтрацией и сортировкой, диалог с подробностями тестов (плейсхолдеры для скриншотов из Issue #5109), аналитические графики (success rate, duration, failures), отслеживание активных Issues и Pull Requests, индикаторы здоровья системы, панель быстрых действий, адаптивный дизайн для мобильных устройств. Мониторинг всех 6 шагов customer journey с детальной статистикой и метриками производительности.',
    category: 'automation',
    tags: ['Journey Testing', 'Automated Testing', 'ReAct', 'Background Agent', 'E2E Testing', 'Auto-Fix', 'GitHub Integration', 'Monitoring', 'Quality Assurance', 'Continuous Testing', 'Real-time Updates', 'Analytics Charts', 'Dashboard', 'Health Indicators', 'Issue #4999', 'Issue #5112']
  },

  // Welcome and onboarding
  '/welcome': {
    description: 'Онбординг нового пользователя: интерактивный тур с подарочными токенами (1M), обзор платформы, каталог готовых решений, выбор первого бесплатного агента, и руководство по началу работы. Решает проблему высокого bounce rate новых пользователей (Issue #4963)',
    category: 'tutorial',
    tags: ['Welcome', 'Onboarding', 'Getting Started', 'Interactive Tour', 'Free Trial', 'Gift Tokens', 'User Activation']
  },

  // Chat with AI
  '/chat': {
    description: 'Чат с ИИ-ассистентом: поддержка множества моделей (Claude, GPT, Gemini), режим агента с tool calling, workspace для работы с кодом и Git репозиториями, выполнение кода, поиск в интернете',
    category: 'ai',
    tags: ['Chat', 'AI', 'Assistant', 'Claude', 'GPT', 'Workspace', 'Tool Calling', 'Code Execution', 'Web Search']
  },

  // Video Call
  '/video-call': {
    description: 'P2P видеозвонки с WebRTC: защищенные видеоконференции с шифрованием от конца до конца (E2E). Создание комнат и прямое присоединение по ID, WebRTC с автоматическим выбором STUN/TURN серверов для надёжного соединения, управление камерой и микрофоном, демонстрация экрана, адаптивный интерфейс для всех устройств. Socket.IO сигнальный сервер для установки P2P соединений. Интеграция с MiroTalk C2C API для fallback режима.',
    category: 'communication',
    tags: ['Video Call', 'WebRTC', 'P2P', 'Conference', 'E2E Encryption', 'Screen Sharing', 'Real-time', 'Communication', 'MiroTalk', 'Socket.IO']
  },

  // MiroTalk C2C Video Conferencing
  '/mirotalk-c2c': {
    description: 'Профессиональные видеоконференции MiroTalk C2C с iframe интеграцией: создание защищенных комнат с E2E шифрованием, присоединение к существующим комнатам по ID, копирование ссылок для приглашения участников, встроенный интерфейс MiroTalk C2C с полной поддержкой камеры, микрофона, демонстрации экрана и записи встреч. Backend интеграция через MiroTalk API с автоматическим fallback на публичный demo-сервер. Поддержка до 100 участников, текстовый чат, кроссплатформенность.',
    category: 'communication',
    tags: ['MiroTalk', 'Video Conference', 'E2E Encryption', 'WebRTC', 'Screen Sharing', 'Recording', 'Chat', 'Iframe', 'API Integration', 'Communication']
  },

  '/demo/agents': {
    description: 'Демонстрация Site Knowledge & Navigation Agents: интеллектуальные агенты для получения информации о платформе и навигации. Поддержка команд (/info, /navigate, /search), автоматическое обогащение AI промптов контекстом о сайте, генерация навигационных предложений на основе запросов пользователя, интерактивная демонстрация работы агентов с примерами команд',
    category: 'demo',
    tags: ['Demo', 'Agents', 'Site Knowledge', 'Navigation', 'AI Chat', 'Commands', 'Interactive', 'Middleware']
  },

  '/workspaces': {
    description: 'AI-Powered Workspaces: управление Git-проектами с полной поддержкой Deep Agent, AI помощник для workspace, мастер создания с генерацией названий, tool calling (чтение/запись файлов, Git операции, выполнение команд), интеграция с GitHub, файловый менеджер, чат проекта с AI для обсуждения архитектуры и назначения задач, preset actions (оптимизация, поиск багов, рефакторинг, безопасность), работа с ИИ-агентом в контексте выбранного workspace, синхронизация с чатами отдельных файлов, отображение выполненных AI инструментов. AI Agent Terminal с интеграцией agent_polza2 (Bun-based) для выполнения команд на естественном языке с использованием Claude Sonnet 4.5, переключаемый режим AI/обычный терминал, real-time streaming событий, поддержка инструментов (read, write, bash, grep, glob, websearch). НОВЫЕ ВОЗМОЖНОСТИ: AI предложения действий в зависимости от контекста файла, side-by-side diff viewer для изменений кода, batch apply для применения множественных изменений, история изменений с возможностью отката (undo), пользовательские шаблоны действий AI для часто используемых операций',
    category: 'ai',
    tags: ['Workspace', 'Deep Agent', 'Tool Calling', 'AI Assistant', 'Wizard', 'Project Chat', 'GitHub', 'Git', 'File Manager', 'AI Agent', 'Code', 'Task Assignment', 'Repository', 'File Operations', 'Shell Commands', 'Preset Actions', 'Optimization', 'Security', 'AI Terminal', 'agent_polza2', 'Polza AI', 'Natural Language', 'Claude Sonnet 4.5', 'Bun', 'Code Changes', 'Diff Viewer', 'Batch Apply', 'Change History', 'Undo', 'Custom Templates']
  },

  '/workspace-file-editor': {
    description: 'Редактор файлов для Workspace: просмотр файлов с подсветкой синтаксиса (JavaScript, Python, TypeScript, Java, JSON, YAML, Markdown, CSS, SQL и др.), настройки редактора (тема, размер шрифта, номера строк, перенос строк, выбор языка), интеграция с AI чатом для помощи по файлу, древовидная структура файлов workspace, поддержка множества языков программирования',
    category: 'development',
    tags: ['File Editor', 'Workspace', 'Syntax Highlighting', 'Code Viewer', 'AI Chat', 'Settings', 'File Tree', 'Development', 'PrismJS', 'Multi-language']
  },

  // Documentation routes
  '/docs/getting-started': {
    description: 'Быстрый старт: пошаговое руководство для новых пользователей платформы',
    category: 'documentation',
    tags: ['Docs', 'Tutorial']
  },
  '/docs/user-guide': {
    description: 'Полное руководство пользователя с инструкциями и лучшими практиками',
    category: 'documentation',
    tags: ['Docs', 'Guide']
  },
  '/docs/api-reference': {
    description: 'Справочник по API платформы ДронДок',
    category: 'documentation',
    tags: ['Docs', 'API']
  },
  '/docs/examples': {
    description: 'Примеры использования функций и возможностей платформы',
    category: 'documentation',
    tags: ['Docs', 'Examples']
  },
  '/docs/faq': {
    description: 'Часто задаваемые вопросы и ответы о платформе',
    category: 'documentation',
    tags: ['Docs', 'Support']
  },
  '/docs/best-practices': {
    description: 'Лучшие практики: проверенные методы и рекомендации для максимальной эффективности работы с DronDoc. Советы по настройке агентов, интеграциям, оптимизации затрат и масштабированию',
    category: 'documentation',
    tags: ['Docs', 'Best Practices', 'Guidelines', 'Optimization', 'Tips']
  },
  '/docs': {
    description: 'Documentation Portal: интерактивный портал документации с категориями (Быстрый старт, AI Агенты, Workflows, Интеграции, Best Practices). Поиск по всей документации, примеры, руководства, API reference',
    category: 'documentation',
    tags: ['Documentation', 'Portal', 'Search', 'Categories', 'Guides', 'API', 'Tutorials']
  },
  '/changelog': {
    description: 'Changelog: история версий и обновлений DronDoc. Все новые функции, улучшения, исправления багов. Подписка на уведомления о релизах. Timeline формат с фильтрацией по типу изменений',
    category: 'documentation',
    tags: ['Changelog', 'Releases', 'Updates', 'Version History', 'Release Notes', 'Features', 'Bug Fixes']
  },
  '/community': {
    description: 'Community Hub: сообщество пользователей и разработчиков DronDoc. Обсуждения, помощь, витрина проектов, интеграция с GitHub Discussions. 6 категорий: Общее, Помощь, Предложения, Баги, Анонсы, Обучение',
    category: 'community',
    tags: ['Community', 'Forum', 'Discussions', 'Showcase', 'GitHub', 'Help', 'Support', 'Projects']
  },
  '/tutorials': {
    description: 'Video Tutorials: видео-уроки по DronDoc для всех уровней (Начинающий, Средний, Продвинутый). Плейлисты по темам: Быстрый старт, AI-агенты, Orchestration. Интеграция с YouTube, поиск и фильтрация',
    category: 'education',
    tags: ['Video', 'Tutorials', 'Learning', 'Courses', 'YouTube', 'Training', 'Education', 'Playlists']
  },
  '/community-apps': {
    description: 'Community Apps Gallery: публичная галерея AI агентов от сообщества DronDoc. Две вкладки: Workspace Apps (личные агенты) и Community Apps (публичные агенты). Категории: Quick Apps, Tools, Websites, Projects, Dashboards, Forms, Workflows, Agents, Automations, Commerce, Entertainment. Каждый агент отображается с иконкой, описанием, статистикой (просмотры, лайки, комментарии, запуски), автором. Поддержка поиска и фильтрации',
    category: 'agents',
    tags: ['Community', 'Apps Gallery', 'AI Agents', 'Public Agents', 'Marketplace', 'Workspace', 'Stats', 'Categories', 'Search']
  },
  '/a/:slug': {
    description: 'Public Agent Short URL: короткий URL для доступа к публичному агенту по slug. Отображает страницу агента с полной информацией, статистикой (views, likes, comments, runs), функциями чата, поделиться (share), и получения embed кода. Автоматически инкрементит счётчик просмотров',
    category: 'agents',
    tags: ['Public Agent', 'Short URL', 'Slug', 'Agent Page', 'Stats', 'Chat', 'Share', 'Embed']
  },
  '/agent/:id': {
    description: 'Agent Preview Page: полная страница публичного агента по ID. Включает заголовок с иконкой, названием, категорией и версией, карточку статистики с views/likes/comments/runs, кнопки для лайка/share/embed, описание агента, чат-интерфейс для взаимодействия. Поддержка генерации iframe и widget embed кодов с настраиваемыми размерами',
    category: 'agents',
    tags: ['Agent Preview', 'Public Agent', 'Agent ID', 'Full Page', 'Interactive', 'Chat', 'Stats', 'Embed Code', 'Widget']
  },
  '/embed/agent/:id': {
    description: 'Agent Embed Frame: минимальная встраиваемая версия агента для iframe и widget. Компактный хедер с иконкой и названием, полнофункциональный чат-интерфейс, автоинкремент статистики views и runs, powered by DronDoc footer. Оптимизирован для встраивания на внешние сайты',
    category: 'agents',
    tags: ['Embed', 'iFrame', 'Widget', 'Agent Chat', 'Minimal', 'External', 'Integration']
  },
  '/docs/multiselect-pattern': {
    description: 'Документация по паттерну мультиселект: как правильно реализовать поля с множественным выбором используя "пузыри" и выпадающий список (Issue #3378)',
    category: 'documentation',
    tags: ['Docs', 'Patterns', 'Multiselect', 'UI Components', 'Integram', 'Reference Fields']
  },
  '/public-routes': {
    description: 'Публичные маршруты: полный список страниц приложения, доступных без регистрации и авторизации. Включает документацию, лендинги и открытые функции',
    category: 'documentation',
    tags: ['Routes', 'Public', 'No Auth', 'Navigation', 'Site Map']
  },

  // Core application routes
  '/dashboard': {
    description: 'Unified Dashboard — агентная панель управления в стиле Palantir Workshop (Issue #7194). Виджеты: счётчики объектов (дроны из Integram kval/1731380, миссии, активные агенты, события за день), график активности за 7 дней, лог событий агентов с автообновлением каждые 10 секунд, панель статусов агентов (running/idle/error). Backend: GET /api/dashboard/stats, GET /api/dashboard/activity, GET /api/dashboard/agents-status.',
    category: 'core',
    tags: ['Dashboard', 'Overview', 'Agents', 'Monitoring', 'Real-time', 'WebSocket', 'Integram', 'Issue #7194']
  },
  '/editor/:id?': {
    description: 'Визуальный редактор документов с поддержкой совместной работы',
    category: 'core',
    tags: ['Editor', 'Documents']
  },
  '/organizations': {
    description: 'Управление организациями: создание, редактирование, управление участниками. Интеграция с AI (выбор модели, deep agent режим) для автоматизации задач. Пользователь может быть владельцем или участником нескольких организаций',
    category: 'core',
    tags: ['Organizations', 'Teams', 'Members', 'Management', 'AI Integration', 'Deep Agent']
  },
  '/organizations/:id': {
    description: 'Детальная информация и управление конкретной организацией с встроенным AI-чатом для работы с проектом: назначение задач, анализ документов, управление участниками. Чат синхронизируется с чатом файлов. Поддержка настройки AI-модели и deep agent режима',
    category: 'core',
    tags: ['Organizations', 'Details', 'AI Chat', 'Workspace Chat', 'Project Management', 'Tasks', 'Deep Agent']
  },
  '/organizations/:orgId/boards/:boardId': {
    description: 'Kanban-доска для управления задачами организации в стиле Taskade: drag-n-drop карточек между колонками, приоритеты, метки, чек-листы, комментарии, вложения, назначение исполнителей. Полная интеграция с Integram DB',
    category: 'core',
    tags: ['Taskade', 'Kanban', 'Board', 'Tasks', 'Drag-n-Drop', 'Organization', 'Project Management', 'Collaboration']
  },
  '/organization': {
    description: 'Управление организацией в стиле Coda.io: приглашение людей, добавление AI-агентов, редактирование спецификации организации для контекста AI. Современный документо-ориентированный интерфейс с чистым дизайном',
    category: 'core',
    tags: ['Organization', 'Team', 'AI Agents', 'Management', 'Coda Style', 'Modern UI']
  },
  '/organization/ready-solutions': {
    description: 'Каталог готовых решений: разверните ансамбль агентов в организацию одним кликом для автоматизации бизнес-процессов',
    category: 'core',
    tags: ['Organization', 'Ready Solutions', 'Ensembles', 'Automation', 'One-Click Deploy']
  },
  '/organization/data-sources': {
    description: 'Управление источниками данных организации: подключение REST API, баз данных, файлов, webhooks, Google Sheets для интеграции с агентами',
    category: 'core',
    tags: ['Organization', 'Data Sources', 'API', 'Database', 'Integration', 'Webhooks', 'Connectivity']
  },
  '/genesis': {
    description: 'Genesis - One Prompt → One App: генерация полноценных приложений из одного промпта. AI анализирует описание и создаёт агентов, workflows, дашборды, формы и data models автоматически. 4 режима работы: Genesis (полное приложение), Project (workspace), Agents (только агенты), Automation (только автоматизация). Real-time progress с "Thinking..." блоками и Mermaid диаграммой архитектуры. Аналог Taskade Genesis для DronDoc платформы.',
    category: 'ai',
    tags: ['Genesis', 'AI Generator', 'App Builder', 'Low-Code', 'No-Code', 'Automated Development', 'One-Click Apps', 'AI Automation', 'Progress Tracking', 'Mermaid Diagrams', 'Workspace Generator'],
    seo: {
      title: 'Genesis - One Prompt → One App | DronDoc',
      description: 'Generate complete applications from a single prompt. Create agents, workflows, dashboards, and data models automatically with AI. Real-time progress tracking and architecture diagrams.',
      keywords: 'app generator, AI application builder, low-code, no-code, automated development, Genesis AI, prompt-to-app, workspace generator, agent creator'
    }
  },
  // Issue #5415: Genesis Workspace Architecture
  '/genesis-workspace/:id': {
    description: 'Genesis Workspace: единая среда для организации Projects, Agents и Automations. Kanban boards, списки задач, интеграция с агентами и автоматизированные workflow. Часть Genesis экосистемы.',
    category: 'core',
    tags: ['Workspace', 'Project Management', 'Kanban', 'Task List', 'Agents', 'Automation', 'Genesis'],
    seo: {
      title: 'Genesis Workspace - Project Management | DronDoc',
      description: 'Organize your projects, agents, and automations in a unified Genesis Workspace. Kanban boards, task lists, and automated workflows.',
      keywords: 'workspace, project management, kanban, task management, agent workspace, automation workspace'
    }
  },
  // Issue #5541: Agent Templates
  '/templates': {
    description: 'Agent Templates: YAML-based templates для быстрого создания AgentApplications и FunctionalAgents. Просмотр категоризированных шаблонов (Support, Analytics, Automation и др.), предварительный просмотр, валидация конфигурации и мгновенное создание агентов на основе готовых шаблонов. Интегрирован с новой онтологией агентов (Workspace → FunctionalAgent → Tasks)',
    category: 'agents',
    tags: ['Templates', 'Agent Creation', 'YAML', 'Quick Start', 'Ontology', 'Automation', 'Development'],
    seoTitle: 'Agent Templates | Quick Start Agent Creation',
    seoDescription: 'Browse and use pre-configured YAML templates to create AI agents in seconds. Support, Analytics, Automation, and more. Integrated with agent ontology architecture.',
    seoKeywords: 'agent templates, YAML templates, quick agent creation, agent builder, automation templates, AI agent scaffolding, agent ontology'
  },
  // Issue #5402: Unified agents page
  '/spaces': {
    description: 'AI Agents Marketplace: единый каталог всех доступных AI-агентов с функциями просмотра, покупки, клонирования и публикации. 100+ готовых решений для бизнеса, аналитики, разработки и автоматизации. Объединяет функционал Marketplace и My Agents в одном интерфейсе',
    category: 'core',
    tags: ['Agents', 'Apps', 'AI', 'Marketplace', 'Automation', 'Tools', 'Business', 'Clone', 'Publish'],
    // SEO optimization (Issue #4989)
    seoTitle: 'AI Agents Marketplace | Automation Tools & Intelligent Agents',
    seoDescription: 'Comprehensive collection of AI-powered agents and automation tools for business, analytics, development, and more. Browse 100+ ready-to-use agents or create your own custom solutions.',
    seoKeywords: 'AI agents, automation tools, business agents, analytics agents, AI marketplace, workflow automation, intelligent agents, AI-powered tools, agent marketplace, no-code automation'
  },
  // Issue #5402: Marketplace alias - redirects to /spaces for backward compatibility
  '/marketplace': {
    description: 'Agent Marketplace (алиас /spaces): единый каталог AI-агентов с возможностью клонирования в workspace и публикации своих агентов. Поддерживает поиск, фильтрацию по категориям и цене, сравнение агентов, trial и demo режимы. Обратная совместимость для старых ссылок',
    category: 'agents',
    tags: ['Marketplace', 'Community', 'Clone', 'Browse', 'Agents', 'Templates', 'Discovery', '1-Click Install', 'Alias', 'Backward Compatibility'],
    seoTitle: 'Agent Marketplace | Browse and Clone AI Agents',
    seoDescription: 'Discover and clone AI agents created by the community. Browse hundreds of ready-to-use agents for automation, analytics, content creation, and more.',
    seoKeywords: 'agent marketplace, clone agents, AI templates, agent library, community agents, ready-to-use agents'
  },
  // Issue #4987: Agent comparison
  '/compare': {
    description: 'Сравнение агентов: side-by-side таблица с ценами, функциями, рейтингами и возможностями. Позволяет сравнить до 5 агентов одновременно для принятия обоснованного решения о покупке',
    category: 'core',
    tags: ['Agent Comparison', 'Agents', 'Pricing', 'Features', 'Discovery', 'UX']
  },

  // Agent Creator (Issue #4692, #5542)
  '/agent-creator': {
    description: 'Унифицированный API для создания и подключения агентов к платформе. Поддержка Integram-клиента, MCP-инструментов, AI-провайдеров и токенов. Визуальный мастер создания агентов с выбором шаблона, настройкой конфигурации, кастомизацией кода и тестированием в песочнице. Новая система CustomAgentRegistry с разделением AgentApplication (UI/Workspace) и FunctionalAgent (исполнение логики) согласно Agent Ontology. Полная поддержка CRUD операций, управления жизненным циклом агентов и трекинга задач',
    category: 'agents',
    tags: ['Agent Creator', 'API', 'Integram', 'MCP', 'AI Providers', 'Agent Wizard', 'Templates', 'Configuration', 'Code Editor', 'Sandbox', 'Deployment', 'CustomAgentRegistry', 'Agent Ontology', 'CRUD', 'Lifecycle Management', 'Task Tracking']
  },

  // Work Plan Editor - Sub-Agent Work Plan Templates (Issue #5427)
  '/work-plan-editor': {
    description: 'Редактор планов работы субагентов: визуальный конструктор workflow с шагами (LLM, MCP, Condition, Action), настройка триггеров (message, schedule, webhook, manual), условные переходы (if/else), переменные между шагами, готовые шаблоны (Customer Support, Lead Qualification, Data Processing, Notification, Content Moderation), валидация плана, импорт/экспорт JSON. Part of Sub-Agent Builder Epic #5425.',
    category: 'ai',
    tags: ['Work Plan', 'Workflow', 'Sub-Agent', 'Templates', 'Visual Editor', 'Timeline', 'Triggers', 'Conditions', 'Variables', 'LLM', 'MCP', 'Actions', 'Validation', 'Import/Export', 'Issue #5427', 'Epic #5425']
  },

  // Sub-Agent Builder - Build agents from ready-made blocks (Issue #5425)
  '/sub-agent-builder': {
    description: 'Sub-Agent Builder: быстрое создание субагентов из готовых блоков с MCP интеграцией. Пошаговый wizard (5 шагов): настройка агента, выбор MCP Integration Blocks (CRUD операции с Integram), выбор Work Plan Templates (пошаговые workflow для CRM/Support/HR/Sales/Analytics), выбор UI Component Blocks (формы, чаты, дашборды), просмотр и создание. 8 готовых MCP блоков (Create/Read/Update/Delete record, List, Search, Create table, Get schema), 5 business templates (CRM/Support/HR/Sales/Analytics workflow), 3 UI блока (Simple Form, Chat Interface, Data Dashboard). Автогенерация системного промпта из выбранных блоков. Библиотека блоков в Integram MCP (5 таблиц). Inspired by Zapier, Make, n8n, но специфично для SubAgents с встроенной Integram интеграцией.',
    category: 'agents',
    tags: ['Sub-Agent Builder', 'MCP Integration', 'Blocks', 'Templates', 'Workflow', 'CRUD', 'Integram', 'CRM', 'Support', 'HR', 'Sales', 'Analytics', 'UI Components', 'Forms', 'Chat', 'Dashboard', 'Wizard', 'Issue #5425']
  },

  // Agent Studio - No-Code Agent Builder (Issue #5345)
  '/agent-studio': {
    description: 'No-Code визуальный конструктор AI-агентов: drag-drop canvas с узлами (Input, Processing, Memory, Tools, Output), визуальный редактор промптов с переменными и шаблонами, интеграция Knowledge Base (RAG) с загрузкой PDF/DOCX/URL/Integram, конфигурация Tools (Web Search, Code Executor, API Call), тестирование в sandbox с метриками (latency, tokens, cost), экспорт в JSON. Inspired by Taskade, Flowise, Langflow.',
    category: 'ai',
    tags: ['Agent Studio', 'No-Code', 'Visual Builder', 'Drag-Drop', 'Canvas', 'Prompt Editor', 'RAG', 'Knowledge Base', 'Tools', 'Sandbox', 'Testing', 'Export', 'VueFlow', 'Issue #5345']
  },

  // Unicode Test Agent (Issue #5456)
  // Testing unicode: 你好 мир 🌍
  '/unicode-test-agent': {
    description: 'Агент с русскими символами и 特殊字符 - тестирование работы с unicode: отправка и получение сообщений на любых языках (русский, English, 中文, 日本語, العربية, עברית, ไทย, 한국어), автоматическое определение языков в тексте, анализ unicode символов (code points, bytes), echo test для проверки корректности передачи данных, статистика по языкам и сообщениям. Демонстрирует правильную обработку unicode во всём стеке: frontend (Vue 3), backend (Node.js/Express), хранение (JSON files), API (UTF-8).',
    category: 'tools',
    tags: ['Unicode', 'Testing', 'Multilingual', '多语言', 'Русский', 'i18n', 'UTF-8', 'Character Analysis', 'Language Detection', 'Text Processing', 'Issue #5456']
  },

  // Self-Improving Agent (СамоУлучшайка)
  '/self-improving-agent': {
    description: 'Автономный агент для непрерывного анализа и улучшения проекта. Автоматически находит проблемы в коде (TODO, FIXME, console.log), создает GitHub issues, запускает решение через solve, мониторит Pull Requests и автоматически мерджит готовые PR. 5 стратегий анализа: поиск TODO/FIXME, обнаружение console.log, проверка покрытия тестов, аудит безопасности npm, анализ больших файлов. Управление агентом: старт/стоп/перезапуск, просмотр статистики (issues created/solved, PRs merged, success rate), мониторинг активных solve сессий, чтение логов в реальном времени. Работает в фоне 24/7 через screen сессии.',
    category: 'automation',
    tags: ['Automation', 'CI/CD', 'GitHub', 'Self-Improving', 'Code Analysis', 'Auto-Merge', 'Issue Tracking', 'DevOps', 'Quality Assurance', 'Monitoring', 'Agent Management']
  },

  // Console Health Agent (Issue #5561)
  '/console-health-agent': {
    description: 'Browser Error Monitoring & Auto-Fix Agent. Мониторит ошибки в консоли браузера через Playwright MCP, автоматически создаёт GitHub issues для критичных ошибок (превышающих threshold) и запускает hive-mind solve для исправления. Группировка одинаковых ошибок, отслеживание первого/последнего появления, предотвращение дубликатов issues. Dashboard: статус агента (running/stopped, PID, screen session), статистика (errors detected, issues created/solved, active solves, success rate), список обнаруженных ошибок с деталями (message, source, count, timestamps), активные solve сессии, логи в реальном времени, графики (errors по дням, success rate). Управление: старт/стоп/перезапуск через UI. Автоматическое создание issues с метками console-error, auto-detected, bug, health-monitor. Работает в фоне через screen сессии с интервальной проверкой консоли.',
    category: 'automation',
    tags: ['Browser', 'Error Monitoring', 'Auto-Fix', 'Playwright', 'Console', 'Health', 'GitHub', 'Auto-Detection', 'Debugging', 'Quality Assurance', 'Agent Management', 'Automation']
  },

  // Metrics Master - GitHub Activity Monitor (Issue #5578)
  '/metrics-master': {
    description: 'Автономный агент мониторинга активности GitHub репозитория. Сбор метрик: contributor activity (commits, PRs, reviews, issues по авторам), repository metrics (velocity, PR merge rate, issue close rate, review/resolution time), code velocity (commits per day, lines changed, files changed), quality metrics (test coverage, code review coverage, CI failures, reverted commits), project health (open issues trend, stale PRs >7 days, unassigned issues, critical bugs). Еженедельные автоматические отчёты (понедельник 9:00) в Markdown формате с детальными таблицами, графиками активности, топ контрибьюторами, velocity trends, health indicators. Dashboard: статус агента, выбор периода (last week/month/3 months), кнопки сбора метрик и генерации отчёта, визуализация всех метрик в карточках, таблица топ контрибьюторов, экспорт в JSON/CSV, история отчётов. API endpoints: /status, /collect, /report, /contributors, /repository, /velocity, /quality, /health, /export, /history. Работает через GitHub REST API и gh CLI.',
    category: 'analytics',
    tags: ['GitHub', 'Metrics', 'Analytics', 'Activity Monitor', 'Contributors', 'Repository Stats', 'Weekly Reports', 'Code Velocity', 'Quality Metrics', 'Project Health', 'Automation', 'Dashboard', 'Export', 'Issue #5578']
  },

  // Security Guard Agent (Issue #5580)
  '/security-guard': {
    description: 'Автономный агент безопасности для непрерывного мониторинга и улучшения безопасности проекта. Сканирование кода на уязвимости (SAST), проверка зависимостей (npm audit, yarn audit), аудит безопасности, мониторинг CVE базы данных для установленных пакетов. Автоматическое создание GitHub issues при обнаружении критических уязвимостей, рекомендации по исправлению, отслеживание статуса устранения проблем. Dashboard: статус агента, результаты последнего сканирования, список обнаруженных уязвимостей с severity (critical/high/medium/low), кнопки запуска различных типов проверок (code scan, dependencies scan, full audit). API endpoints: /status, /scan/code, /scan/dependencies, /scan (full audit), /health.',
    category: 'automation',
    tags: ['Security', 'Scanning', 'Vulnerabilities', 'SAST', 'Dependencies', 'CVE', 'npm audit', 'Code Analysis', 'DevSecOps', 'Auto-Detection', 'GitHub Issues', 'Issue #5580']
  },

  // Librarian Agent
  '/librarian': {
    description: 'Агент управления базой знаний проекта. Индексация всей документации (README, docs/, *.md), поиск по коду и документам, организация knowledge base. Автоматическое обновление README при изменениях в проекте, создание документации из кода (JSDoc, TypeDoc), генерация справочных материалов и API reference. Интеграция с KAG (Knowledge-Augmented Generation) для семантического поиска, извлечение entities и relations из документации. Dashboard: статус агента, статистика индексированных документов, поиск по knowledge base, последние обновления документации.',
    category: 'automation',
    tags: ['Documentation', 'Knowledge Base', 'Indexing', 'Search', 'README', 'Code Documentation', 'JSDoc', 'TypeDoc', 'KAG', 'Semantic Search', 'Auto-Update']
  },

  // Test Master Agent (Issue #5572)
  '/test-master': {
    description: 'Агент управления и выполнения всех типов тестов в проекте. Запуск unit, integration, E2E тестов через единый интерфейс, анализ покрытия кода (coverage reports), обнаружение flaky тестов (тесты, которые периодически падают), автоматическое создание отчетов о качестве. Интеграция с CI/CD pipeline, мониторинг качества в real-time, тренды покрытия тестов. Dashboard: статус агента, summary последнего запуска тестов (total/passed/failed/skipped), покрытие кода (statements/branches/functions/lines), список flaky тестов, кнопки запуска разных типов тестов. API endpoints: /status, /run/unit, /run/integration, /run/e2e, /run/all, /coverage, /flaky, /health.',
    category: 'automation',
    tags: ['Testing', 'Unit Tests', 'Integration Tests', 'E2E', 'Coverage', 'Quality', 'CI/CD', 'Reports', 'Flaky Tests', 'Test Runner', 'Automation', 'Issue #5572']
  },

  // Documentalist Agent
  '/documentalist': {
    description: 'Агент автоматической генерации и поддержки актуальности документации проекта. Создание API documentation из кода (автоматический парсинг JSDoc/TypeDoc комментариев), обновление CHANGELOG при новых коммитах и релизах, генерация release notes на основе merged PR и closed issues, документирование архитектуры (auto-generated diagrams из кода). Анализ кода и автоматическое создание/обновление JSDoc/TypeDoc комментариев для недокументированных функций и классов. Dashboard: статус агента, статистика документации (% покрытия документацией), последние обновления CHANGELOG, кнопки генерации различных типов документов.',
    category: 'automation',
    tags: ['Documentation', 'API Docs', 'CHANGELOG', 'Release Notes', 'JSDoc', 'TypeDoc', 'Architecture', 'Auto-Generation', 'Code Analysis', 'Diagrams']
  },

  // Mass Document Editor (Issue #6384)
  '/mass-document-editor': {
    description: 'Агент для массовой правки Word документов (.doc/.docx). Загрузка файлов или ссылок с Яндекс Диска, AI-распознавание задачи пользователя (например, "заменить все даты с 2023 на 2024", "изменить фамилию Иванов на Петров"), автоматическое выполнение массовых замен с учётом контекста. Предпросмотр правил замены перед применением, статистика обработки документов (количество замен, детализация по правилам), история обработанных документов. Поддержка сложных правил: регистрозависимость, замена целых слов, множественные правила в одной операции. Скачивание обработанных документов. Dashboard: загрузка файлов, поле описания задачи, предпросмотр правил, статистика, история.',
    category: 'business',
    tags: ['Documents', 'Word', 'Mass Edit', 'Replace', 'AI', 'Automation', 'Yandex Disk', 'DOCX', 'Office', 'Text Processing', 'Issue #6384']
  },

  // Data Guardian Agent (Issue #5574)
  '/data-guardian': {
    description: 'Агент управления и защиты данных в проекте. Мониторинг целостности данных (checksums, validation), автоматические бэкапы критических данных с настраиваемым расписанием, контроль доступа и аудит всех операций с данными. Обнаружение аномалий в данных (unexpected changes, corruption), проверка compliance с требованиями (GDPR, HIPAA), шифрование sensitive данных. Dashboard: статус агента, последний бэкап (timestamp, size), статистика операций с данными, обнаруженные аномалии, compliance status. API endpoints: /status, /backup/create, /backup/list, /backup/restore, /audit/log, /anomalies, /compliance, /health.',
    category: 'automation',
    tags: ['Data', 'Security', 'Backup', 'Compliance', 'Audit', 'Encryption', 'Monitoring', 'Anomaly Detection', 'GDPR', 'Data Integrity', 'Issue #5574']
  },

  // Flow Validator Agent
  '/flow-validator': {
    description: 'Агент проверки и валидации Flow Editor процессов. Статический анализ flow definitions (проверка корректности структуры), проверка корректности PQ-Programs (Process Query Programs), валидация Role-Sets и их взаимодействий, обнаружение циклов и dead-ends в процессах. Автоматические рекомендации по оптимизации процессов, проверка на best practices. Dashboard: статус агента, список проверенных flows, обнаруженные проблемы (cycles, dead-ends, invalid PQ-Programs), рекомендации по улучшению.',
    category: 'automation',
    tags: ['Flow Editor', 'Validation', 'PQ-Program', 'Role-Sets', 'Process', 'Static Analysis', 'Optimization', 'Best Practices', 'Cycle Detection']
  },

  // E2E Tester Agent
  '/e2e-tester': {
    description: 'Агент end-to-end тестирования пользовательских сценариев. Автоматическое тестирование purchase journeys, user flows, критических путей в приложении. Интеграция с Playwright для browser automation, генерация скриншотов при ошибках, видеозапись выполнения тестов, автоматические отчеты о найденных багах. Мониторинг доступности сервисов (uptime checks), smoke tests для production environment. Dashboard: статус агента, результаты последних E2E тестов (passed/failed journeys), скриншоты ошибок, история выполнения, кнопки запуска различных test suites.',
    category: 'automation',
    tags: ['E2E', 'Testing', 'Playwright', 'User Flows', 'Purchase Journey', 'Screenshots', 'Video Recording', 'Monitoring', 'Automation', 'Smoke Tests', 'Uptime']
  },

  // Sub-Agent UI Builder (Issue #5428)
  '/sub-agent-ui-builder': {
    description: 'UI Component Library для субагентов: библиотека готовых UI блоков для быстрой сборки интерфейса. 8+ типов компонентов (Chat Interface, Form Builder, File Upload, Data Table, Dashboard Card, Chart, Button Group, Stepper), drag-and-drop компоновка с grid layout (12 колонок), 5 готовых шаблонов (Chat Only, Chat with Sidebar, Dashboard, Form Wizard, Data Manager), визуальный редактор с live preview, настройка размеров и конфигурации блоков, responsive дизайн, dark mode support, экспорт макета в JSON. Part of Sub-Agent Builder Epic (#5425).',
    category: 'agents',
    tags: ['UI Builder', 'Components', 'Sub-Agent', 'Drag-Drop', 'Templates', 'Chat', 'Forms', 'Dashboard', 'No-Code', 'Layout Builder', 'Grid System', 'Responsive', 'Dark Mode', 'Issue #5428']
  },

  // Agent Preview Page (Issue #5407)
  '/agent/:id': {
    description: 'Публичная страница для демонстрации агента: красивый чат-интерфейс (как в Taskade Genesis), полноэкранный режим, брендированный header с именем и иконкой агента, responsive дизайн (mobile-first), работа с агентом через /api/agent-studio/sandbox/chat, история сообщений в localStorage, кнопка Share для копирования ссылки, метрики (latency, tokens) в footer. Доступно без авторизации для публичного шаринга агентов.',
    category: 'ai',
    tags: ['Agent Preview', 'Chat Interface', 'Public Access', 'Agent Studio', 'Taskade Genesis', 'Shareable', 'Mobile Responsive', 'Fullscreen', 'Metrics', 'No Auth', 'Issue #5407']
  },

  // AI Kits Marketplace (Issue #5346)
  '/kits': {
    description: 'AI Kits - готовые решения для быстрого старта. Пакеты включают агента, проект и автоматизации. Установка одним кликом, экспорт/импорт в JSON, 5+ готовых примеров (Content Creator, Sales Pipeline, Data Analytics, Customer Support, Workflow Automation)',
    category: 'agents',
    tags: ['AI Kits', 'Templates', 'Solutions', 'Bundles', 'Quick Start', 'One-Click Deploy', 'Agent Packages', 'Automation', 'Projects']
  },

  // Kit Builder (Issue #5346)
  '/kit-builder': {
    description: 'Конструктор AI Kits: создание пакетов готовых решений с агентами, проектами и автоматизациями. Wizard с 4 шагами: основная информация, добавление компонентов, конфигурация, предпросмотр. Поддержка версионирования, категорий, тегов',
    category: 'agents',
    tags: ['Kit Builder', 'Wizard', 'Package Creator', 'Templates', 'Solutions', 'Configuration']
  },

  // Template Library (Issue #5347)
  '/templates': {
    description: 'Библиотека Шаблонов: 50+ готовых решений для быстрого старта (по аналогии с Taskade 500+ templates). 4 типа шаблонов: AI-агенты, workflows, проекты, промпты. 10 категорий: Аналитика (5), AI/ML (5), Контент (5), Бизнес (5), HR (5), Разработка (5), Проекты (5), Образование (5), Сельское хозяйство (5), Дроны & IoT (5), Автоматизация (5). Фильтрация по типу и категории, поиск, сортировка по популярности/новизне. Preview шаблона, 1-click использование, отслеживание статистики.',
    category: 'agents',
    tags: ['Templates', 'Library', 'Quick Start', 'Agents', 'Workflows', 'Projects', 'Prompts', 'Taskade', 'Marketplace', '50+ Templates', 'Categories', 'Filters', 'Search', 'One-Click Use']
  },

  // DronDoc Agents API (Issue #4692)
  '/drondoc-agents': {
    description: 'Унифицированный DronDoc Agent API: создание, подключение и управление агентами. Интеграция с Integram (через MCP), AI-провайдерами (DeepSeek по умолчанию), управление инстансами агентов, версионирование кода, тестирование в песочнице, статистика и мониторинг. Полная спецификация: /backend/monolith/docs/DRONDOC_AGENT_API.md',
    category: 'agents',
    tags: ['DronDoc API', 'Agent Management', 'Unified API', 'Integram', 'MCP', 'AI Integration', 'DeepSeek', 'Instance Management', 'Version Control', 'Code Testing', 'Monitoring', 'Statistics', 'Agent Templates', 'Agent Registry', 'Task Management']
  },

  // Torgi.gov.ru Parser (Issue #4534)
  '/torgi-parser': {
    description: 'Парсер государственных торгов torgi.gov.ru с сохранением в Integram. Запросы выполняются из браузера для обхода защиты от ботов',
    category: 'web',
    tags: ['Торги', 'Государственные закупки', 'Парсер', 'Integram']
  },

  // AI and Models
  '/ai-models': {
    description: 'Управление AI моделями, настройка провайдеров и мониторинг использования',
    category: 'ai',
    tags: ['AI', 'Models', 'Configuration']
  },
  '/osint-dashboard': {
    description: 'OSINT-платформа для автоматического парсинга китайских аналитических источников по рынку дронов (БПЛА/无人机). Поддержка 6 источников: chyxx.com, qianzhan.com, moa.gov.cn, stats.gov.cn, mem.gov.cn, sohu.com. Онтология терминов с категориями: сельское хозяйство, картография, мониторинг, доставка, пожаротушение, рынок. Автоматическое извлечение метрик (объем рынка, доли, площади, количество). Анализ тональности. Интеграция с Integram kval database. Issue #7133.',
    category: 'analytics',
    tags: ['OSINT', 'China', 'Drones', 'UAV', 'Market Intelligence', 'Web Scraping', 'Analytics', 'Agriculture', 'Issue #7133']
  },
  '/voice-agent': {
    description: 'Голосовой ИИ-агент для взаимодействия через речь',
    category: 'ai',
    tags: ['AI', 'Voice', 'Assistant']
  },

  // Agent routes
  '/agents/constructor': {
    description: 'Объединенный конструктор агентов: No-Code визуальный конструктор, Workflow Builder для цепочек задач, Meta-Agent для автоматического создания агентов с помощью AI (генерирует GitHub issues, запускает разработку, тесты и peer review)',
    category: 'agents',
    tags: ['AI', 'Agents', 'No-Code', 'Workflow', 'Meta-Agent', 'Automation', 'Testing', 'GitHub', 'AI Creation']
  },
  '/agents/control-panel': {
    description: 'Панель управления запуском и мониторингом агентов',
    category: 'agents',
    tags: ['Agents', 'Control', 'Monitoring']
  },
  '/agents/history': {
    description: 'История выполнения задач агентами с логами и результатами',
    category: 'agents',
    tags: ['Agents', 'History', 'Logs']
  },
  '/agents/accessibility': {
    description: 'AI-агент для аудита доступности Vue.js приложений: автоматическое сканирование на соответствие WCAG 2.1 AA, выявление проблем с ARIA атрибутами, формами, изображениями и модальными окнами, авто-исправление найденных проблем',
    category: 'agents',
    tags: ['Accessibility', 'WCAG', 'ARIA', 'A11y', 'Compliance', 'Audit', 'Forms', 'Testing', 'Quality']
  },
  '/training': {
    description: 'Интерактивная система обучения работе с агентами DronDoc: quiz-режим с реальными примерами, обучение по категориям (Analytics, PM, Finance, Warehouse), практика с анализом запросов, отслеживание прогресса и рекомендации. Основана на реальных триггерах и edge cases из тестирования. 10 вопросов, 4 режима обучения, tracking прогресса в localStorage',
    category: 'tutorial',
    tags: ['Training', 'Education', 'Quiz', 'Agents', 'Learning', 'Interactive', 'Tutorial', 'Onboarding', 'Triggers', 'Practice', 'Progress Tracking', 'Testing']
  },
  '/agents/inn-parser': {
    description: 'Агент парсинга данных по ИНН: получение информации о компаниях из публичных источников (list-org.com) без авторизации. Поддержка одиночного и массового парсинга, получение названия, ОГРН, адреса, статуса и руководителя организации',
    category: 'agents',
    tags: ['INN', 'Parsing', 'Company Data', 'OGRN', 'Public Data', 'Web Scraping', 'Business Intelligence', 'Legal Entities']
  },
  '/agents/test-ai': {
    description: 'Тестовый AI агент для проверки категории "ai": демонстрация интеграции с AI через TokenBasedLLMCoordinator, поддержка нескольких моделей (DeepSeek, GPT, Claude), чат-интерфейс для взаимодействия с агентом, отслеживание использования токенов',
    category: 'ai',
    tags: ['AI', 'Testing', 'Chat', 'DeepSeek', 'GPT', 'Claude', 'Token Management', 'Demo']
  },
  '/agents/test-runner': {
    description: 'Запуск и мониторинг тестов проекта: unit, integration, E2E',
    category: 'agents',
    tags: ['Testing', 'QA', 'Automation']
  },
  '/agents/test-integration': {
    description: 'Test Integration Agent - Agent created during integration testing to validate agent creation workflow, testing infrastructure, and integration patterns. Demonstrates test management, statistics tracking, and automated test execution',
    category: 'agents',
    tags: ['Testing', 'Integration', 'Development', 'QA', 'Automation', 'Agent Creation', 'Issue #5452']
  },
  '/browser-automation': {
    description: 'Автоматизация браузера с Playwright MCP: управление сеансами браузера, интерактивные инструменты (клик, ввод, прокрутка, наведение), ARIA accessibility snapshots, создание скриншотов и PDF, мониторинг сетевых запросов и консоли браузера. Phase 3: Антидетект - подмена фингерпринта браузера (User Agent, Canvas, WebGL, Audio Context, экран, timezone, язык), обход Cloudflare защиты, интеграция с CAPTCHA сервисами (2Captcha, Anti-Captcha, RuCaptcha, CapMonster). Полная интеграция с Playwright через MCP сервер',
    category: 'automation',
    tags: ['Browser', 'Automation', 'Playwright', 'MCP', 'Testing', 'Screenshots', 'ARIA', 'Accessibility', 'Network', 'Console', 'E2E', 'Web Scraping', 'Anti-Detection', 'Fingerprint Spoofing', 'Cloudflare Bypass', 'CAPTCHA', 'Stealth', 'Privacy']
  },
  '/agents/integram-test': {
    description: 'Тестирование Integram API: авторизация, чтение и запись данных. Полная реализация взаимодействия с Integram через REST API с детальным логированием запросов и ответов',
    category: 'development',
    tags: ['Integram', 'API', 'Testing', 'Development', 'Integration', 'DBMS', 'REST']
  },
  '/agents/integram-sync': {
    description: 'Синхронизация данных агентов из Spaces.vue в таблицу Integram (Object ID: 837). Массовый импорт агентов с настройками синхронизации, прогрессом и логированием операций',
    category: 'agents',
    tags: ['Integram', 'Sync', 'Agents', 'Import', 'Database', 'Migration', 'Automation']
  },
  '/agents/ci-cd-testing': {
    description: 'Агент непрерывного тестирования (CI/CD Testing): автоматизация тестирования в pipeline, parallel test execution, flakiness detection, coverage tracking, visual & performance regression testing',
    category: 'automation',
    tags: ['CI/CD', 'Testing', 'Automation', 'Quality', 'DevOps']
  },
  '/agents/code-error-analyzer': {
    description: 'Агент анализа ошибок и утечек памяти: AI-powered анализ кода для обнаружения синтаксических и логических ошибок, утечек памяти, ресурсов (файлы, соединения), проблем производительности, уязвимостей безопасности. Поддержка JavaScript, Python, Java, C++, Go и др.',
    category: 'development',
    tags: ['Code Analysis', 'Error Detection', 'Memory Leaks', 'AI', 'Security', 'Performance', 'Code Quality', 'Debugging', 'Static Analysis']
  },
  '/agents/business-metrics': {
    description: 'Сбор и анализ бизнес-метрик: отслеживание KPI, пользовательского поведения, retention, churn, LTV. A/B тестирование, feature flags, экспорт в Google Analytics и Mixpanel',
    category: 'analytics',
    tags: ['Analytics', 'KPI', 'Metrics', 'Retention', 'Churn', 'LTV', 'A/B Testing', 'Feature Flags', 'Business Intelligence']
  },
  '/agents/manager-assistant': {
    description: 'Ассистент руководителя для анализа финансовой модели через Integram: чат-интерфейс для анализа бюджета, отклонений от инвестиционных показателей, динамики доходов/расходов с визуализацией графиков и таблиц',
    category: 'analytics',
    tags: ['Finance', 'Manager', 'Assistant', 'Integram', 'Budget', 'Investment', 'KPI', 'Chat', 'AI', 'MCP', 'Analytics']
  },
  '/agents/auto-call': {
    description: 'Агент автоматического обзвона клиентов с помощью AI: создание кампаний обзвона, загрузка списков клиентов из CSV/XLSX, настраиваемые сценарии разговора, распознавание речи (STT), синтез речи (TTS), запись и транскрипция разговоров, аналитика результатов звонков',
    category: 'automation',
    tags: ['Auto-Call', 'AI', 'Voice', 'TTS', 'STT', 'Campaign', 'CRM', 'Sales', 'Automation', 'Recording', 'Transcription', 'Analytics']
  },
  '/agents/inn-analytics': {
    description: 'Аналитика по ИНН клиента: парсинг данных из открытых источников ФНС (api-fns.ru), получение полной информации о компании, проверка контрагента, блокировка счетов, налоговая отчетность, коды ОКВЭД, руководители. Прямой способ получения аналитики минуя агрегаторы данных',
    category: 'business',
    tags: ['INN', 'Analytics', 'FNS', 'Company Data', 'Counterparty Check', 'Tax', 'OGRN', 'OKVED', 'Business', 'Data Parser', 'Client Analytics']
  },
  '/agents/quality-feedback': {
    description: 'Сбор и анализ обратной связи от клиентов с AI-анализом: многоканальный сбор отзывов, автоматическое определение тональности, NPS и CSAT метрики, создание опросов, мониторинг качества, автоматическое создание задач из негативных отзывов, предиктивный анализ оттока клиентов',
    category: 'analytics',
    tags: ['Feedback', 'Quality', 'NPS', 'CSAT', 'Sentiment Analysis', 'AI', 'Customer Support', 'Surveys', 'Churn Prediction', 'Action Items']
  },
  '/agents/health-monitor': {
    description: 'Комплексный мониторинг здоровья всех агентов и сервисов: автоматическая проверка подключений, валидация UI, мониторинг консоли, запуск тестов, автоматическое создание GitHub Issues при обнаружении проблем',
    category: 'agents',
    tags: ['Monitoring', 'Health Check', 'Backend', 'Diagnostics', 'DevOps', 'Automated Testing', 'Issue Creation', 'CI/CD']
  },
  '/agents/api-integration': {
    description: 'Критический агент для подключения внешних источников данных: REST API, базы данных (PostgreSQL, MySQL, MongoDB), загрузка файлов (CSV, JSON, XML, Excel), webhooks, интеграция с Telegram, Email, Slack, Google Sheets. Маппинг данных, расписание синхронизации, логирование',
    category: 'agents',
    tags: ['Integration', 'API', 'Database', 'File Upload', 'Webhooks', 'Data Sync', 'Mapping', 'Automation', 'Critical']
  },
  '/organization/monitoring': {
    description: 'Dashboard мониторинга здоровья агентов организации в реальном времени: статус агентов (healthy/degraded/unhealthy), метрики производительности (uptime, response time, error rate), активные алерты, исторические данные, настройка порогов оповещений',
    category: 'automation',
    tags: ['Monitoring', 'Dashboard', 'Real-time', 'Health', 'Metrics', 'Alerts', 'Performance', 'Organization']
  },
  '/support': {
    description: 'Единая платформа поддержки клиентов: система управления тикетами с AI-помощником, автоматический Telegram Bot для общения с клиентами, база знаний с поиском и управлением, шаблоны быстрых ответов, анализ тональности сообщений (positive/neutral/negative), автоматическая эскалация негативных случаев к специалистам, статистика работы поддержки. Объединяет тикет-систему и AI-бота в одном интерфейсе (Issue #3169)',
    category: 'support',
    tags: ['Support', 'Tickets', 'Customer Service', 'AI Assistant', 'Knowledge Base', 'Sentiment Analysis', 'Escalation', 'Help Desk', 'Telegram Bot', 'Chatbot', 'Automation', 'Unified']
  },
  '/agents/system-health-dashboard': {
    description: 'Централизованный dashboard для мониторинга здоровья всей мультиагентной системы как единого организма. Overall Health Score (0-100), organism vitality metrics (resilience, coordination, self-sufficiency), agent status overview, circuit breakers, restart history, recent events timeline, critical alerts. Real-time обновление каждые 5 секунд, экспорт в CSV/JSON',
    category: 'agents',
    tags: ['Monitoring', 'Dashboard', 'Multi-Agent', 'Health Score', 'Vitality', 'Circuit Breakers', 'Resilience', 'Self-Healing', 'Analytics', 'Real-time', 'DevOps', 'System Organism']
  },
  '/agent-health-docs': {
    description: 'Полная интерактивная документация системы автоматической проверки и исправления кода агентов. Включает описание AgentCodeLinterService (9 правил проверки), AgentAutoFixService (8 автоматических fixers), ContinuousAgentHealthMonitor (непрерывный мониторинг), REST API (11 endpoints), примеры использования, живой мониторинг статуса. Позволяет управлять системой здоровья агентов прямо из интерфейса',
    category: 'documentation',
    tags: ['Documentation', 'Agent Health', 'Code Linting', 'Auto-Fix', 'Monitoring', 'API Reference', 'DevOps', 'Code Quality', 'Self-Healing', 'Interactive Docs', 'Best Practices', 'Security', 'Performance']
  },
  '/agents/orchestrator': {
    description: 'Unified Agent Orchestrator (Issue #5632): централизованное управление ВСЕМИ 148+ агентами через GlobalAgentRegistry. Объединяет 3 параллельные системы (Production, Workspace, Custom/Genesis) в единую архитектуру. Автоматическая маршрутизация запросов, интеллектуальный выбор агентов на основе capabilities и приоритета, мониторинг статуса всех агентов в реальном времени, автосинхронизация с базой данных (каждые 5 минут), визуализация графа зависимостей, управление порядком старта агентов. API endpoints: POST /api/orchestrator/execute (выполнение запросов), GET /api/orchestrator/status (статус всех агентов), GET /api/orchestrator/dependency-graph (граф зависимостей). Поддержка 6 типов агентов: PRODUCTION, GOAL_ORIENTED, CUSTOM, GENESIS, TEMPLATE, WORKSPACE. Real-time updates каждые 30 секунд, event-driven architecture, O(1) agent lookup, comprehensive testing (175+ test cases).',
    category: 'agents',
    tags: ['Multi-Agent', 'Orchestration', 'GlobalAgentRegistry', 'Unified Architecture', 'Agent Control', 'Auto-Routing', 'Real-time Status', 'Database Sync', 'Dependencies', 'Startup Order', 'System Management', 'Automation', 'DevOps', 'API', 'Event-Driven', 'Performance', 'Testing', 'Issue #5632']
  },
  '/auto/orchestrator/execute': {
    description: 'Интерактивная страница выполнения запросов через мультиагентный оркестратор (Issue #7207). Позволяет отправить произвольный текстовый запрос через POST /api/orchestrator/execute и получить ответ. Оркестратор автоматически выбирает агентов по триггерам, выполняет их и синтезирует результат. Поддерживает: опциональный access token, включение трассировки выполнения, историю последних запросов.',
    category: 'automation',
    tags: ['Orchestrator', 'Execute', 'Multi-Agent', 'Query', 'Automation', 'API', 'Interactive', 'Issue #7207']
  },
  '/agents/sgr-research': {
    description: 'SGR (Schema-Guided Reasoning) Research Agent - интеллектуальный агент для глубоких исследований. Использует двухфазную архитектуру: reasoning (анализ) и action (действие). Поддерживает web search, structured reasoning, clarification requests, и automatic source citation. OpenAI-совместимый API.',
    category: 'agents',
    tags: ['AI', 'Research', 'Schema-Guided Reasoning', 'SGR', 'Web Search', 'Deep Research', 'Reasoning', 'Clarification', 'Sources', 'OpenAI Compatible', 'Automation', 'Intelligence']
  },
  '/agents/system-resources': {
    description: 'Мониторинг системных ресурсов в реальном времени: CPU, RAM, диски, сетевой трафик. Прогнозирование исчерпания ресурсов, автоматические алерты при критических значениях, рекомендации по оптимизации',
    category: 'automation',
    tags: ['Monitoring', 'System Resources', 'CPU', 'Memory', 'Disk', 'Network', 'Performance', 'Alerts', 'Predictions', 'DevOps']
  },
  '/agents/api-gateway': {
    description: 'Единая точка входа для всех API запросов. Управление маршрутизацией, балансировкой нагрузки, аутентификацией и мониторингом API. Аналитика запросов, контроль задержек, отслеживание ошибок',
    category: 'automation',
    tags: ['API Gateway', 'Routing', 'Load Balancing', 'Authentication', 'Monitoring', 'Analytics', 'Rate Limiting', 'Microservices', 'DevOps', 'Infrastructure']
  },
  '/agents/quota-management': {
    description: 'Управление пользовательскими квотами и лимитами: API requests, storage, compute, AI tokens. Soft/hard лимиты, usage metering, автоматические upgrade рекомендации, fair use policy enforcement, throttling и rate limiting',
    category: 'business',
    tags: ['Quotas', 'Metering', 'Rate Limiting', 'Throttling', 'Billing', 'Fair Use', 'Resource Management', 'Upgrade', 'API Limits', 'Storage Limits']
  },
  '/agents/auto-scaling': {
    description: 'Динамическое управление вычислительными ресурсами для обработки нагрузки: автоматическое масштабирование сервисов, балансировка нагрузки между инстансами, оптимизация стоимости облачных ресурсов, предсказание пиков нагрузки',
    category: 'automation',
    tags: ['Auto-Scaling', 'Load Balancing', 'Cloud', 'Cost Optimization', 'Performance', 'DevOps', 'Infrastructure', 'Prediction', 'Resource Management']
  },
  '/agents/cost-management': {
    description: 'Мониторинг и оптимизация финансовых затрат на облачную инфраструктуру: отслеживание затрат на AWS, GCP, Azure, cost allocation по проектам и командам, рекомендации по оптимизации, budget alerts, управление reserved instances, forecasting затрат. Метрики: cost tracking accuracy > 95%, cost optimization 15%+, budget alert accuracy > 90%, forecast accuracy > 85%',
    category: 'business',
    tags: ['Cost Management', 'Cloud', 'AWS', 'GCP', 'Azure', 'Budget', 'Optimization', 'Forecasting', 'Reserved Instances', 'FinOps', 'Cost Allocation', 'Infrastructure']
  },
  '/agents/anomaly-detection': {
    description: 'Агент обнаружения аномалий, атак и подозрительного поведения: мониторинг паттернов трафика, обнаружение DDoS атак, выявление аномального поведения пользователей, ML-based anomaly detection, автоматические алерты в Slack/Telegram',
    category: 'automation',
    tags: ['Security', 'Anomaly Detection', 'DDoS', 'Attack Detection', 'Machine Learning', 'Monitoring', 'Alerts', 'Cybersecurity', 'Threat Detection']
  },
  '/agents/api-monitoring': {
    description: 'API Monitoring Agent: комплексный мониторинг API endpoints - синтетический мониторинг внутренних API (user journeys, SSL certificates, performance tracking) и отслеживание внешних API (health checks, latency monitoring, rate limits detection, circuit breaker pattern, SLA monitoring). Unified dashboard с метриками uptime, latency (min/max/avg/p95/p99), error rates, и автоматическими алертами. Интеграция internal и external API мониторинга в единый интерфейс',
    category: 'automation',
    tags: ['Monitoring', 'API', 'Synthetic Monitoring', 'External API', 'Health Checks', 'Latency', 'Circuit Breaker', 'SLA', 'Performance', 'Uptime', 'Alerting', 'Resilience']
  },
  '/agents/code-quality': {
    description: 'Агент мониторинга качества кода: автоматический статический анализ кода (ESLint для JavaScript/Vue, Pylint для Python), расчет метрик сложности кода, обнаружение дубликатов, отслеживание технического долга с оценкой трудозатрат, автоматизация code review процесса, интеграция с SonarQube. Метафора: как контроль качества белков в клетках, обеспечивает чистоту и эффективность кода',
    category: 'automation',
    tags: ['Code Quality', 'Static Analysis', 'ESLint', 'Pylint', 'Complexity', 'Duplicates', 'Tech Debt', 'Code Review', 'SonarQube', 'Linting', 'Quality Metrics', 'Refactoring']
  },
  '/agents/tech-debt-management': {
    description: 'Агент управления техническим долгом: автоматическое обнаружение технического долга через анализ кода, code smell detection (дублирование, избыточная сложность, плохая архитектура), оценка стоимости исправления в часах и днях, интеллектуальная приоритизация по влиянию на бизнес, tracking прогресса устранения проблем, интеграция с системами управления задачами (JIRA/Linear). Метафора: как апоптоз удаляет старые клетки - системное удаление технического долга для здоровья кодовой базы',
    category: 'automation',
    tags: ['Tech Debt', 'Code Smells', 'Refactoring', 'Code Quality', 'Priority', 'JIRA', 'Linear', 'Business Impact', 'Cost Estimation', 'Technical Health', 'Legacy Code', 'Maintenance']
  },
  '/agents/incident-management': {
    description: 'Агент управления инцидентами: координация реагирования на инциденты, создание и отслеживание инцидентов, эскалация по степени критичности, автоматическое создание war rooms, post-mortem генерация. Интеграция с PagerDuty, Opsgenie. Метрики: MTTD < 5 минут, MTTR < 2 часов, точность эскалации > 90%, completion rate 100%',
    category: 'automation',
    tags: ['Incident Management', 'MTTD', 'MTTR', 'Escalation', 'War Room', 'Post-Mortem', 'PagerDuty', 'Opsgenie', 'DevOps', 'SRE', 'Monitoring', 'Response']
  },
  '/agents/logging-audit': {
    description: 'Агент логирования и аудита: централизованный сбор и хранение логов всех систем, полнотекстовый поиск по логам, обнаружение аномалий с помощью AI, генерация отчетов по инцидентам, соответствие требованиям аудита (GDPR, SOC2)',
    category: 'automation',
    tags: ['Logging', 'Audit', 'Compliance', 'GDPR', 'SOC2', 'Log Analysis', 'Search', 'Incident Reports', 'Security', 'Monitoring']
  },
  '/agents/backup-recovery': {
    description: 'Агент резервного копирования и восстановления: автоматические бэкапы баз данных и файлов, тестирование восстановления, disaster recovery планирование, метрики (RTO, RPO, Success Rate), географически распределенные копии',
    category: 'automation',
    tags: ['Backup', 'Recovery', 'Disaster Recovery', 'Database', 'Files', 'RTO', 'RPO', 'Data Protection', 'DevOps', 'Security']
  },
  '/agents/data-sync': {
    description: 'Агент синхронизации данных (Data Sync): синхронизация данных между системами в реальном времени, Change Data Capture (CDC), real-time sync между БД, conflict resolution стратегии, bidirectional sync, incremental sync для больших данных, мониторинг отставания (lag). Метрики: sync success rate > 99.9%, avg lag time < 1 сек, data integrity 100%, conflict resolution rate 100%',
    category: 'automation',
    tags: ['Data Sync', 'CDC', 'Real-time', 'Database', 'Conflict Resolution', 'Bidirectional', 'Incremental', 'Integration', 'Data Pipeline', 'ETL']
  },
  '/agents/event-bus': {
    description: 'Агент управления событиями (Event Bus): Pub/Sub система для связи между компонентами, event sourcing архитектура, publish/subscribe паттерн, event replay для отладки, schema registry для валидации событий, dead letter queue для неудачных доставок, интеграция с Kafka/RabbitMQ/Redis Pub/Sub, метрики доставки и задержки',
    category: 'automation',
    tags: ['Event Bus', 'Pub/Sub', 'Event Sourcing', 'Messaging', 'Event Replay', 'Schema Registry', 'DLQ', 'Kafka', 'RabbitMQ', 'Redis', 'Event-Driven', 'Async Communication', 'Microservices', 'Integration']
  },
  '/agents/queue-management': {
    description: 'Агент управления очередями задач: координация асинхронных задач и фоновых процессов с retry логикой, приоритизация задач (Critical/High/Normal/Low), мониторинг скорости обработки (>1000 tasks/sec), Dead Letter Queue обработка, управление воркерами, метрики успеха (99% success rate, 80% retry success)',
    category: 'automation',
    tags: ['Queue', 'Tasks', 'Background Jobs', 'Async', 'Retry', 'Priority', 'Workers', 'DLQ', 'Dead Letter Queue', 'Task Management', 'Performance', 'Monitoring', 'RabbitMQ-style', 'Redis Queue']
  },
  '/agents/database-agent': {
    description: 'Комплексный агент управления базами данных: автоматические бэкапы с тестированием восстановления, оптимизация индексов и запросов, мониторинг производительности (cache hit ratio, slow queries), управление миграциями схемы, архивирование старых данных, метрики здоровья БД',
    category: 'automation',
    tags: ['Database', 'Backup', 'Optimization', 'Performance', 'Migrations', 'Archiving', 'Monitoring', 'Query Tuning', 'Schema Management', 'DevOps', 'DBA']
  },
  '/agents/notification-hub': {
    description: 'Центр управления уведомлениями: централизованная отправка по всем каналам (email, SMS, Telegram, Slack, push), шаблоны уведомлений, управление подписками, rate limiting, приоритизация, tracking доставки и прочтения. Delivery rate > 99%, latency < 5s',
    category: 'automation',
    tags: ['Notifications', 'Email', 'SMS', 'Telegram', 'Slack', 'Push', 'Templates', 'Rate Limiting', 'Tracking', 'Delivery', 'Subscriptions', 'Multi-channel']
  },
  '/agents/release-management': {
    description: 'Агент управления релизами: автоматизация процесса релиза с semantic versioning, генерация changelog из conventional commits, автогенерация release notes, deployment approval workflow, механизм rollback, release analytics. Как стволовые клетки создают новые клетки.',
    category: 'automation',
    tags: ['Release', 'Deployment', 'Versioning', 'Semantic Versioning', 'Changelog', 'Release Notes', 'Approval', 'Rollback', 'CI/CD', 'DevOps', 'Git', 'Automation']
  },
  '/backend-dashboard': {
    description: 'Полноценная панель управления всеми backend-сервисами: мониторинг, конфигурация, деплой, логи, метрики, API endpoints',
    category: 'admin',
    tags: ['Backend', 'DevOps', 'Monitoring', 'Deployment', 'API', 'Logs', 'Metrics', 'Configuration']
  },
  '/turbo-control': {
    description: 'Турбо-Контроль - Performance Budget Agent: автономный мониторинг производительности приложения с автоматическим созданием GitHub issues. Bundle Size Monitoring (threshold >500KB), Lighthouse CI Integration (score <90), Memory Leak Detection (heap growth >50MB/min, detached DOM >100), API Performance (response time >2s, slow queries, N+1, 5xx errors), Runtime Performance (long tasks >50ms, CLS >0.1, input latency >100ms). Запускается каждые 6 часов, после каждого deploy, и при создании PR. Dashboard с графиками, трендами, Core Web Vitals, автоматическая диагностика с рекомендациями.',
    category: 'performance',
    tags: ['Performance', 'Monitoring', 'Bundle Size', 'Lighthouse', 'Memory Leaks', 'API Performance', 'Web Vitals', 'Automated Issues', 'CI/CD', 'DevOps', 'FCP', 'LCP', 'CLS', 'Chrome DevTools', 'GitHub Integration', 'Auto-Fix', 'Alerts', 'Dashboard', 'Analytics', 'Metrics', 'Issue #5569']
  },
  '/process/task-inbox': {
    description: 'Task Inbox for Human-AI Collaboration: manage user tasks, review AI agent results, approve/reject decisions, provide human feedback in workflow processes',
    category: 'automation',
    tags: ['Human-AI', 'Tasks', 'Workflow', 'Collaboration', 'Approval', 'Process', 'UserTask', 'Handoff']
  },
  '/process-monitor': {
    description: 'Real-time monitoring and management of BPMN workflow process executions: track active instances, view task status, manage process lifecycle (pause/resume/cancel), monitor events and agent activity',
    category: 'automation',
    tags: ['BPMN', 'Workflow', 'Process Engine', 'Orchestration', 'Monitoring', 'Real-time', 'Task Management', 'Agent Coordination', 'Events']
  },

  '/process-analytics': {
    description: 'Process Analytics & Reporting with PQ-programs: execution statistics, agent performance metrics, bottleneck detection, trend analysis, custom declarative queries',
    category: 'analytics',
    tags: ['BPMN', 'Analytics', 'Reporting', 'PQ-Programs', 'Metrics', 'Bottlenecks', 'Performance', 'Trends', 'Dashboard']
  },
  '/agents/iframe-masking': {
    description: 'Агент для безопасной маскировки и встраивания внешних сайтов',
    category: 'agents',
    tags: ['Security', 'Iframe', 'Masking']
  },
  '/agents/travel-accommodation': {
    description: 'Агент подбора жилья для путешественников с AI рекомендациями',
    category: 'agents',
    tags: ['Travel', 'AI', 'Recommendations']
  },
  '/agents/github': {
    description: 'Агент интеграции с GitHub для управления репозиториями и PR',
    category: 'agents',
    tags: ['GitHub', 'Integration', 'DevOps']
  },
  '/agents/vulnerability-scanner': {
    description: 'Агент сканирования уязвимостей: SAST, DAST, проверка зависимостей и OWASP Top 10',
    category: 'agents',
    tags: ['Security', 'Scanning', 'OWASP', 'Vulnerabilities', 'DevSecOps']
  },
  '/agents/workspace-ai': {
    description: 'Workspace AI Agent: Чат с ИИ для управления workspace через естественный язык. Операции с файлами, Git, выполнение команд, поиск по коду. Вдохновлено Hives Modern CLI с поддержкой tool calling и streaming ответов.',
    category: 'agents',
    tags: ['AI', 'Workspace', 'Chat', 'File Operations', 'Git', 'Commands', 'Tool Calling', 'Natural Language', 'Code Search', 'DeepSeek']
  },
  '/agents/excel-to-integram': {
    description: 'Excel → Integram: Агент импорта Excel/CSV файлов в Integram. Автоматическое распознавание структуры данных, определение типов колонок (текст, число, дата), нормализация названий полей, создание таблиц в Integram через MCP инструменты, пакетный импорт данных с отслеживанием прогресса. Issue #5002',
    category: 'data',
    tags: ['Excel', 'CSV', 'Import', 'Integram', 'MCP', 'Data Migration', 'Entity Recognition', 'Normalization', 'Spreadsheet', 'Database']
  },

  '/agents/custom-editor': {
    description: 'Редактор кастомных агентов: мощная система для создания агентов "на лету" с собственной логикой (JavaScript код) и пользовательским интерфейсом (Vue компоненты). Сохранение в Integram с версионированием, песочница выполнения, live-превью интерфейса, интеграция с Flow Editor. Разработано для Issue #3463.',
    category: 'agents',
    tags: ['Custom Agents', 'Agent Creator', 'JavaScript', 'Vue Components', 'Integram', 'No-Code', 'Dynamic UI', 'Code Editor', 'Sandbox Execution', 'Flow Editor Integration', 'Agent Development', 'Issue #3463']
  },

  '/agents/mlops': {
    description: 'Агент обучения и адаптации ML моделей: автоматическое переобучение, версионирование, A/B тестирование, мониторинг деградации моделей, управление feature store',
    category: 'ai',
    tags: ['Machine Learning', 'MLOps', 'Model Training', 'A/B Testing', 'Drift Detection', 'Feature Store', 'Model Versioning', 'AI']
  },
  '/video-generation': {
    description: 'Агент генерации видео по текстовому описанию с помощью ИИ: поддержка различных моделей (DeepSeek, Sora, Runway, Pika, Stable Video), настройка длительности, соотношения сторон, качества и стиля видео, загрузка референсных изображений, история генераций',
    category: 'ai',
    tags: ['AI', 'Video Generation', 'Text-to-Video', 'DeepSeek', 'Sora', 'Runway', 'Pika', 'Content Creation', 'Generative AI', 'Media', 'Issue #2983']
  },
  '/agents/feature-flags': {
    description: 'Агент управления релизами фич и экспериментов: feature flags, canary deployments, A/B тестирование, сегментация пользователей, автоматический rollback при проблемах, градуальный раскрытие фич',
    category: 'automation',
    tags: ['Feature Flags', 'Experiments', 'A/B Testing', 'Canary Deployment', 'Rollback', 'User Segmentation', 'Release Management', 'Gradual Rollout']
  },

  // Tutorial routes
  '/agents/tutorial/lesson-1': {
    description: 'Урок 1: Введение в агенты и их возможности',
    category: 'tutorial',
    tags: ['Tutorial', 'Learning']
  },
  '/agents/tutorial/lesson-2': {
    description: 'Урок 2: Создание первого агента',
    category: 'tutorial',
    tags: ['Tutorial', 'Learning']
  },
  '/agents/tutorial/lesson-3': {
    description: 'Урок 3: Настройка параметров и конфигурации агента',
    category: 'tutorial',
    tags: ['Tutorial', 'Configuration']
  },
  '/agents/tutorial/lesson-4': {
    description: 'Урок 4: Интеграция агентов с внешними сервисами',
    category: 'tutorial',
    tags: ['Tutorial', 'Integration']
  },
  '/agents/tutorial/lesson-5': {
    description: 'Урок 5: Продвинутые техники работы с агентами',
    category: 'tutorial',
    tags: ['Tutorial', 'Advanced']
  },
  '/agents/tutorial/lesson-6': {
    description: 'Урок 6: Мониторинг и оптимизация агентов',
    category: 'tutorial',
    tags: ['Tutorial', 'Monitoring']
  },
  '/agents/tutorial/lesson-7': {
    description: 'Урок 7: Структурированные и неструктурированные данные',
    category: 'tutorial',
    tags: ['Tutorial', 'Data']
  },
  '/agents/tutorial/lesson-8': {
    description: 'Урок 8: Интеграция ИИ с библиотечными системами',
    category: 'tutorial',
    tags: ['Tutorial', 'AI', 'Integration']
  },
  '/agents/tutorial/lesson-9': {
    description: 'Урок 9: Машинное обучение для рекомендательных систем',
    category: 'tutorial',
    tags: ['Tutorial', 'ML', 'Recommendations']
  },
  '/agents/tutorial/lesson-10': {
    description: 'Урок 10: NLP в обработке запросов',
    category: 'tutorial',
    tags: ['Tutorial', 'NLP', 'AI']
  },
  '/agents/tutorial/lesson-11': {
    description: 'Урок 11: Прототипирование систем с ИИ',
    category: 'tutorial',
    tags: ['Tutorial', 'Prototyping']
  },
  '/agents/tutorial/lesson-12': {
    description: 'Урок 12: Тестирование и оптимизация систем с ИИ',
    category: 'tutorial',
    tags: ['Tutorial', 'Testing', 'Optimization']
  },
  '/agents/tutorial/lesson-13': {
    description: 'Урок 13: Развертывание и масштабирование ИИ-систем',
    category: 'tutorial',
    tags: ['Tutorial', 'Deployment', 'Scaling']
  },

  // Drone and Agriculture routes
  '/drone': {
    description: 'Управление дронами: телеметрия, полетные задания, мониторинг через MAVLink, запрос разрешений на полет через системы Небосвод/LAANC',
    category: 'drones',
    tags: ['Drones', 'MAVLink', 'Control', 'Flight Permissions', 'Nebosvod', 'LAANC']
  },
  '/drone/build-analytics': {
    description: 'Аналитика сборки дронов: компоненты, совместимость, оптимизация',
    category: 'drones',
    tags: ['Drones', 'Analytics', 'Components']
  },
  '/drone/betaflight-mobile': {
    description: 'Мобильное управление дронами через BetaFlight',
    category: 'drones',
    tags: ['Drones', 'BetaFlight', 'Mobile']
  },
  '/my-test-agent-with-spaces': {
    description: 'Test agent for verifying ID generation from agent names containing spaces. Demonstrates proper kebab-case conversion and route registration.',
    category: 'tools',
    tags: ['Testing', 'ID Generation', 'Demo', 'Development']
  },
  '/agriculture/fields': {
    description: 'Управление сельскохозяйственными полями и участками',
    category: 'agriculture',
    tags: ['Agriculture', 'Fields']
  },
  '/agriculture/fields/:id': {
    description: 'Детальная информация о поле: границы, состояние, история обработки',
    category: 'agriculture',
    tags: ['Agriculture', 'Field Details']
  },
  '/agriculture/dashboard': {
    description: 'Дашборд аналитики продуктивности сельхоз земель',
    category: 'agriculture',
    tags: ['Agriculture', 'Analytics']
  },
  '/agriculture/vegetation': {
    description: 'Анализ индексов вегетации (NDVI, NDRE) с дронов',
    category: 'agriculture',
    tags: ['Agriculture', 'NDVI', 'Drones']
  },
  '/agriculture/harvests': {
    description: 'Анализ урожайности и прогнозирование',
    category: 'agriculture',
    tags: ['Agriculture', 'Harvest', 'Analytics']
  },

  // AeroMonitoring routes (Issue #5196, #5197)
  '/aero-monitoring': {
    description: 'Аэромониторинг: управление флотом дронов, мониторинг миссий и аналитика. Включает обзор флота с картами статуса, таблицу дронов с CRUD операциями, планирование миссий на интерактивной карте с расчетом параметров полета.',
    category: 'agriculture',
    tags: ['AeroMonitoring', 'Drones', 'Fleet Management', 'Missions', 'Analytics', 'CRUD', 'Battery', 'Flight Time', 'Issue #5196', 'Issue #5197']
  },
  '/aero-monitoring/mission/new': {
    description: 'Создание новой миссии аэромониторинга: интерактивная карта для построения маршрутов (линии, полигоны, точки интереса), настройка параметров полета (высота, скорость, перекрытие снимков), автоматический расчет времени полета, расхода батарей и количества фотографий.',
    category: 'agriculture',
    tags: ['AeroMonitoring', 'Mission Planning', 'Map', 'Leaflet', 'Flight Parameters', 'Route Planning', 'Issue #5197']
  },
  '/aero-monitoring/mission/:id': {
    description: 'Просмотр миссии аэромониторинга: отображение маршрута на карте, параметры полета, статистика миссии, управление статусом (запуск, остановка).',
    category: 'agriculture',
    tags: ['AeroMonitoring', 'Mission Details', 'Map', 'Flight Tracking', 'Issue #5197']
  },
  '/aero-monitoring/mission/:id/edit': {
    description: 'Редактирование миссии аэромониторинга: изменение маршрута на карте, обновление параметров полета, пересчет статистики миссии.',
    category: 'agriculture',
    tags: ['AeroMonitoring', 'Mission Edit', 'Map', 'Route Edit', 'Issue #5197']
  },
  '/aero-monitoring/flight-monitor': {
    description: 'Мониторинг полетов дронов в реальном времени: отображение дронов на карте с треками полета, панель телеметрии (высота, скорость, батарея, GPS), графики метрик, система алертов (низкий заряд, потеря связи), управление миссией (запуск, пауза, RTH, экстренная посадка). WebSocket для передачи телеметрии.',
    category: 'agriculture',
    tags: ['AeroMonitoring', 'Flight Monitor', 'Real-time Tracking', 'Telemetry', 'WebSocket', 'Drone Tracking', 'Alerts', 'Mission Control', 'Charts', 'GPS', 'Battery Monitoring', 'Issue #5198']
  },

  '/drone-monitor': {
    description: 'Drone Monitor Agent - AI-powered flight data analysis: интеллектуальный мониторинг и анализ полётных данных дронов с помощью AI. Включает анализ телеметрии полёта (обнаружение аномалий, оценка состояния батареи, качество связи, оценка безопасности полёта), предиктивное обслуживание (прогноз необходимости ТО, определение компонентов для замены, расчёт оставшихся полётов), оптимизация маршрутов полёта (минимизация времени и батареи, максимизация покрытия площади, повышение безопасности), детекция аномалий в реальном времени (отклонения от норм, определение рисков, рекомендации действий). Интеграция с TokenBasedLLMCoordinator для унифицированного доступа к AI моделям.',
    category: 'ai',
    tags: ['Drone Monitoring', 'AI Analysis', 'Flight Data', 'Telemetry Analysis', 'Anomaly Detection', 'Predictive Maintenance', 'Route Optimization', 'Real-time Monitoring', 'Deep Learning', 'AI Agent', 'TokenBasedLLMCoordinator', 'Issue #5458']
  },

  '/agriculture/services': {
    description: 'Каталог услуг обработки полей дронами',
    category: 'agriculture',
    tags: ['Agriculture', 'Services']
  },
  '/agriculture/orders': {
    description: 'Управление заказами на обработку полей',
    category: 'agriculture',
    tags: ['Agriculture', 'Orders']
  },
  '/agriculture/orders/new': {
    description: 'Создание нового заказа на обработку поля',
    category: 'agriculture',
    tags: ['Agriculture', 'Orders']
  },
  '/agriculture/orders/:id': {
    description: 'Детали заказа на обработку',
    category: 'agriculture',
    tags: ['Agriculture', 'Order Details']
  },
  '/agriculture/orders/:id/track': {
    description: 'Отслеживание выполнения заказа в реальном времени',
    category: 'agriculture',
    tags: ['Agriculture', 'Tracking']
  },
  '/agro-analytics': {
    description: 'Единое приложение агроаналитики: поля, рецептуры, полеты',
    category: 'agriculture',
    tags: ['Agriculture', 'Analytics', 'Drones']
  },
  '/recipe-management': {
    description: 'Управление рецептурами обработки полей (удобрения, пестициды)',
    category: 'agriculture',
    tags: ['Agriculture', 'Recipes', 'Chemistry']
  },

  // Analytics and Monitoring
  '/social-analytics': {
    description: 'Единая платформа аналитики социальных сетей: YouTube (каналы, тренды), Telegram (реклама, группы), VK (парсинг, статистика), кросс-платформенное сравнение',
    category: 'analytics',
    tags: ['Social Media', 'YouTube', 'Telegram', 'VK', 'Analytics', 'Cross-Platform']
  },
  // Legacy routes - now redirect to /social-analytics (Issue #3168)
  '/youtube-analytics': {
    description: '[DEPRECATED] Перенаправлено на /social-analytics?tab=youtube',
    category: 'analytics',
    tags: ['YouTube', 'Analytics', 'Deprecated']
  },
  '/telegram-ads': {
    description: '[DEPRECATED] Перенаправлено на /social-analytics?tab=telegram',
    category: 'analytics',
    tags: ['Telegram', 'Deprecated']
  },
  '/group-parser': {
    description: '[DEPRECATED] Перенаправлено на /social-analytics?tab=telegram',
    category: 'analytics',
    tags: ['Telegram', 'Deprecated']
  },
  '/appointment-booking': {
    description: 'Система бронирования встреч: календарь, специалисты, услуги, интеграция с Google/Outlook Calendar, платежи',
    category: 'business',
    tags: ['Appointments', 'Booking', 'Calendar', 'Payments', 'Scheduling']
  },
  '/competitor-monitor': {
    description: 'Мониторинг конкурентов: цены, контент, SEO, соцсети',
    category: 'analytics',
    tags: ['Competitive Analysis', 'Monitoring']
  },
  '/marketplace-analytics': {
    description: 'Аналитика маркет-плейсов: мониторинг товарных позиций и анализ конкурентов на Ozon, Wildberries, Яндекс.Маркет с AI-инсайтами',
    category: 'business',
    tags: ['Marketplace', 'E-commerce', 'Analytics', 'AI', 'Ozon', 'Wildberries', 'Яндекс.Маркет']
  },

  '/user-behavior-analytics': {
    description: 'AI-powered анализ поведения пользователей: отслеживание активности (DAU, MAU, сессии, события), поведенческая сегментация (power users, casual users, at-risk users), прогнозирование оттока с помощью DeepSeek, анализ пути пользователя и узких мест, персонализированные рекомендации для удержания. Автоматическая генерация инсайтов и метрик через AI. Comprehensive dashboard с real-time analytics.',
    category: 'analytics',
    tags: ['User Analytics', 'Behavior Analysis', 'AI Insights', 'Churn Prediction', 'User Segmentation', 'Engagement Metrics', 'Journey Mapping', 'Retention', 'DeepSeek', 'Real-time Analytics', 'Issue #5457']
  },

  // Web Tools
  '/web-scraper': {
    description: 'Универсальный парсер веб-сайтов с планировщиком и обработкой данных',
    category: 'web',
    tags: ['Web Scraping', 'Automation']
  },
  '/vk-parser': {
    description: 'Парсер ВКонтакте для сбора данных из групп и профилей',
    category: 'web',
    tags: ['VK', 'Parser', 'Social Media']
  },
  '/vk-subscriber-bot': {
    description: 'Бот для автоматического сбора подписчиков из групп ВКонтакте: поиск групп по темам, массовый сбор подписчиков, анализ аудитории (онлайн, география, активность), экспорт в CSV/JSON, статистика по городам и странам. Инструмент для маркетинга, исследований и построения базы потенциальных клиентов.',
    category: 'web',
    tags: ['VK', 'Bot', 'Subscribers', 'Marketing', 'Analytics', 'Social Media', 'Automation', 'Data Collection', 'Export']
  },
  '/document-converter': {
    description: 'Универсальный конвертер документов с AI: Excel, Word, Markdown, JSON, PDF с поддержкой OCR и интеграцией с Integram',
    category: 'tools',
    tags: ['Document Conversion', 'AI', 'OCR', 'Excel', 'Word', 'PDF', 'Markdown', 'JSON']
  },

  // Business and Sales
  '/agents/leads': {
    description: 'Единый агент квалификации и оценки лидов: AI-скоринг (0-100), BANT критерии (Budget, Authority, Need, Timeline), категоризация (Горячий/Тёплый/Холодный), автоматическая маршрутизация менеджерам, интеграция с CRM (amoCRM, Bitrix24, HubSpot, Salesforce, Pipedrive), прогнозирование конверсии, AI инсайты. Объединяет функционал /lead-scorer и /agents/lead-qualification. Issues #3001, #3167',
    category: 'business',
    tags: ['Sales', 'AI', 'Lead Management', 'CRM', 'BANT', 'Scoring', 'Automation', 'amoCRM', 'Bitrix24', 'HubSpot', 'Salesforce', 'Pipedrive', 'Conversion Prediction', 'AI Insights']
  },
  '/sales-agent': {
    description: 'AI агент продаж: генерация лидов, воронки, кампании',
    category: 'business',
    tags: ['Sales', 'AI', 'Automation']
  },
  '/telegram-lead-agent': {
    description: 'Telegram Lead Generation Agent: автоматический поиск потенциальных клиентов в Telegram-группах и каналах, парсинг контактных данных (телефоны, email, username), фильтрация по ключевым словам, оценка качества лидов (scoring), AI-генерация персонализированных коммерческих предложений, автоматическая отправка КП с антиспам защитой, статистика и трекинг кампаний. Работает через MTProto API (как обычный пользователь Telegram), поддерживает Web Telegram.',
    category: 'business',
    tags: ['Telegram', 'Lead Generation', 'Parsing', 'Contact Extraction', 'AI', 'Sales', 'Commercial Proposals', 'MTProto', 'Automation', 'Scoring', 'Anti-Spam', 'Campaign Tracking']
  },
  '/proposal-generator': {
    description: 'Генератор коммерческих предложений: автоматический сбор данных о компании, анализ отрасли, расчет стоимости персонала по данным HH.ru/Avito, оценка объема рутинных задач на сайте, генерация персонализированного КП с помощью AI (Issue #4467)',
    category: 'business',
    tags: ['Proposal', 'Sales', 'AI', 'Web Scraping', 'Business Intelligence', 'Value-Based Selling', 'ROI', 'Commercial Proposal']
  },
  '/industrial-robot-simulator': {
    description: 'Симулятор принятия решений по внедрению промышленных роботов: сравнение 5 сценариев (традиционный найм, аутсорсинг, промышленные роботы, гибридная модель, автоматизация + аутсорсинг) с расчетом инвестиций, операционных расходов, ROI, качества и рисков (Issue #4824)',
    category: 'business',
    tags: ['Industrial', 'Robots', 'Automation', 'Decision Making', 'ROI Calculator', 'Manufacturing', 'Production', 'Simulation', 'Outsourcing']
  },
  '/billing-agent': {
    description: 'Billing and Payment Agent: автоматическая генерация счетов, обработка платежей, финансовая аналитика, интеграция с платежными системами',
    category: 'finance',
    tags: ['Billing', 'Payments', 'Finance', 'Automation', 'Invoicing']
  },
  '/management-accounting': {
    description: 'Агент управленческого учета: бюджетирование план/факт, управление ФОТ (фонд оплаты труда), учет затрат OPEX/CAPEX, оргструктура, анализ EBITDA и денежного потока. Issue #4111',
    category: 'finance',
    tags: ['Management Accounting', 'Budget', 'Plan/Fact', 'Payroll', 'FOT', 'OPEX', 'CAPEX', 'EBITDA', 'Cash Flow', 'Cost Management', 'Organization Structure']
  },
  '/ecommerce-order-agent': {
    description: 'Управление заказами электронной коммерции: каталог товаров, корзина, оформление заказов, интеграция с платежными системами и доставкой',
    category: 'business',
    tags: ['E-commerce', 'Orders', 'Payment', 'Delivery', 'Shopping']
  },
  '/content-marketing-agent': {
    description: 'AI агент контент-маркетинга: парсинг конкурентов, определение хайповых тем, автоматическое создание и публикация статей об автоматизации, AI и бизнесе',
    category: 'business',
    tags: ['Marketing', 'Content', 'AI', 'Automation', 'Telegram']
  },
  '/dev-helper-agent': {
    description: 'Агент-помощник разработчика: сканирование PR, извлечение идей для будущих улучшений, автоматическое создание issues',
    category: 'development',
    tags: ['Developer', 'GitHub', 'AI', 'Automation', 'PR', 'Issues']
  },
  '/code-analyzer': {
    description: 'AI-агент анализа кода: автоматическое обнаружение ошибок, утечек памяти, уязвимостей безопасности, проблем производительности. Поддержка JavaScript, TypeScript, Python, Java, C++ и других языков. Issue #4508',
    category: 'development',
    tags: ['Code Analysis', 'Error Detection', 'Memory Leaks', 'Security', 'Performance', 'AI', 'DeepSeek', 'Code Quality', 'Static Analysis']
  },
  '/workspaces/terminal': {
    description: 'Терминал с изолированным выполнением и AI-ассистентом: безопасная среда выполнения команд с ограничениями доступа, блокировка опасных команд, минимальное потребление ресурсов, работа в директории проекта без возможности выхода. НОВОЕ: Deep Assistant AI для помощи с командами - объяснения, отладка ошибок, предложения команд, 13+ инструментов (file ops, bash, grep, web search). УНИВЕРСАЛЬНЫЙ РАННЕР (Issue #4839): интеграция run-kit для выполнения кода на 25+ языках (Python, JavaScript, TypeScript, Rust, Go, C, C++, Java, C#, Ruby, PHP, Bash, Swift, Kotlin, Lua, Perl, Haskell, Elixir, Julia, R, Dart, Crystal, Groovy, Zig, Nim), интерактивные REPL-сессии, автоопределение языка по расширению файла, единый API для мультиязычного выполнения кода, поддержка stdin/stdout. Issues #4673, #4725, #4839, #4863',
    category: 'development',
    tags: ['Terminal', 'CLI', 'Command Line', 'Shell', 'Security', 'Isolation', 'xterm.js', 'Development Tools', 'Sandbox', 'Deep Assistant', 'AI Assistant', 'Command Help', 'Error Debugging', 'Code Assistance', 'Universal Runner', 'run-kit', 'Multi-Language', 'Code Execution', 'REPL', 'Python', 'JavaScript', 'Rust', 'Go', 'Java', 'C++']
  },
  '/requirements-gathering-agent': {
    description: 'Агент сбора требований: интеллектуальный помощник для структурированного сбора и документирования требований к проекту. Конверсационный AI-интерфейс, шаблоны вопросов, генерация user stories, MoSCoW приоритизация, экспорт в PDF/DOCX/Jira/Trello. Issue #3030',
    category: 'business',
    tags: ['Requirements', 'Project Management', 'AI', 'User Stories', 'MoSCoW', 'Jira', 'Trello', 'Documentation', 'Templates', 'Analysis']
  },
  '/hr-screening-agent': {
    description: 'Агент HR-скрининга: автоматизация первичного отбора кандидатов с парсингом резюме (PDF/DOCX), автоматическими вопросами, AI-оценкой навыков и культурного соответствия, системой скоринга, интеграцией с ATS (HunterHR, HeadHunter), email-автоматизацией, ранжированием кандидатов. Issue #3030',
    category: 'hr',
    tags: ['HR', 'Recruitment', 'AI', 'Resume Parsing', 'ATS', 'Screening', 'Candidate Evaluation', 'Scoring', 'HunterHR', 'HeadHunter', 'Automation']
  },
  '/complaint-handling-agent': {
    description: 'Агент обработки жалоб: управление жалобами клиентов с мультиканальной подачей (веб, email, Telegram), AI-категоризацией, оценкой серьезности, логикой эскалации, автоматическим назначением, трекингом SLA, уведомлениями (Email/Slack/Telegram), аналитической панелью. Issue #3030',
    category: 'business',
    tags: ['Customer Support', 'Complaints', 'AI', 'Categorization', 'Escalation', 'SLA', 'Multi-channel', 'Analytics', 'Notifications', 'Telegram', 'Email', 'Slack']
  },
  '/feedback-collection': {
    description: 'Сбор и анализ обратной связи пользователей: встроенные виджеты, NPS опросы, голосование за функции, отчеты об ошибках, анализ тональности',
    category: 'business',
    tags: ['Feedback', 'NPS', 'Survey', 'Analytics', 'User Experience', 'Sentiment Analysis']
  },
  '/crm-settings': {
    description: 'Настройки интеграции с CRM системами: подключение HubSpot, Salesforce, Pipedrive через OAuth, управление соединениями, просмотр истории синхронизации, настройка маппинга полей, мониторинг очереди синхронизации. Issue #3041',
    category: 'settings',
    tags: ['CRM', 'Integration', 'Settings', 'OAuth', 'HubSpot', 'Salesforce', 'Pipedrive', 'Lead Management', 'Sync']
  },
  '/crm-oauth-callback': {
    description: 'OAuth callback страница для завершения авторизации CRM систем (HubSpot, Salesforce, Pipedrive)',
    category: 'auth',
    tags: ['OAuth', 'CRM', 'Authentication', 'Callback']
  },
  '/marketplace-review-agent': {
    description: 'Автоматическое написание и размещение отзывов на маркетплейсах с помощью AI: управление аккаунтами, генерация отзывов, планирование публикаций',
    category: 'business',
    tags: ['Marketplaces', 'Reviews', 'AI', 'Automation', 'E-commerce']
  },
  '/marketplace-agent': {
    description: 'Полнофункциональный агент для работы с Wildberries и Amazon: аналитика продаж, мониторинг конкурентов и цен, поиск товаров, автоматизация заказов. Интеграция с официальными API Wildberries и Amazon SP-API',
    category: 'business',
    tags: ['Marketplaces', 'E-commerce', 'Wildberries', 'Amazon', 'Analytics', 'Competitor Analysis', 'Price Tracking', 'Automation', 'AI']
  },
  '/research-agent': {
    description: 'Агент-исследователь для научно-исследовательской работы (НИР): постановка целей, определение объекта исследования, сбор и верификация данных, анализ источников, подготовка отчетов по стандартам Q1/Q2 и ГОСТ',
    category: 'ai',
    tags: ['Research', 'AI', 'Scientific', 'NIR', 'Bibliography', 'GOST', 'Q1', 'Q2', 'Data Collection', 'Verification']
  },
  '/migration-services': {
    description: 'Сервисы для мигрантов: услуги, заявки, документооборот',
    category: 'business',
    tags: ['B2B', 'Services', 'Legal']
  },
  '/package-tracking': {
    description: 'Отслеживание посылок через различные службы доставки',
    category: 'business',
    tags: ['Logistics', 'Tracking']
  },

  // Development and Technical
  '/code-review': {
    description: 'Управление ревью кода и проверками качества',
    category: 'development',
    tags: ['Code Review', 'QA']
  },
  '/kodus-ai': {
    description: 'Kodus AI - автоматический AI code review с контекстным анализом',
    category: 'ai',
    tags: ['AI', 'Code Review', 'Kodus', 'Security', 'Quality']
  },
  '/code-interpreter': {
    description: 'Интерпретатор кода с поддержкой разных языков программирования',
    category: 'development',
    tags: ['Code', 'Interpreter', 'Development']
  },
  '/developers': {
    description: 'Developer Portal: API ключи, документация, SDK',
    category: 'development',
    tags: ['API', 'Developer', 'Documentation']
  },
  '/api-keys': {
    description: 'Управление API ключами для интеграций',
    category: 'development',
    tags: ['API', 'Keys', 'Security']
  },
  '/password-vault': {
    description: 'Менеджер паролей в стиле Bitwarden: централизованное хранение и управление учетными данными пользователя во всех доступных базах данных Integram. Поиск, генерация паролей, безопасное копирование в буфер обмена',
    category: 'settings',
    tags: ['Password Manager', 'Vault', 'Security', 'Bitwarden', 'Credentials', 'Integram', 'Multi-Database']
  },
  '/api-docs': {
    description: 'Интерактивная Swagger документация API',
    category: 'development',
    tags: ['API', 'Documentation', 'Swagger']
  },
  '/api': {
    description: 'API песочница для тестирования endpoints',
    category: 'development',
    tags: ['API', 'Testing', 'Sandbox']
  },
  '/webhooks': {
    description: 'Настройка и управление вебхуками для интеграций',
    category: 'development',
    tags: ['Webhooks', 'Integration']
  },
  '/mcp-integration': {
    description: 'Интеграция MCP + ProTalk для расширенных возможностей',
    category: 'development',
    tags: ['MCP', 'Integration']
  },
  '/mcp-agent': {
    description: 'MCP Агент - управление серверами Model Context Protocol для расширения возможностей AI с доступом к 100+ MCP серверам',
    category: 'agents',
    tags: ['MCP', 'AI', 'Agents', 'Integration', 'Tools']
  },
  '/headhunter-agent': {
    description: 'HeadHunter Агент - поиск и анализ вакансий на hh.ru: парсинг требований к профессиям, анализ зарплат и ставок, сохранение данных в базу для отслеживания рынка труда',
    category: 'agents',
    tags: ['HeadHunter', 'HH.ru', 'Jobs', 'Vacancies', 'HR', 'Recruitment', 'Parser', 'Analytics', 'Salary']
  },
  '/hh-agent': {
    description: 'Альтернативный маршрут для HeadHunter агента (перенаправление на /headhunter-agent)',
    category: 'agents',
    tags: ['HeadHunter', 'HH.ru', 'Jobs']
  },
  '/integration-agent': {
    description: 'Агент для интеграции различных внешних сервисов',
    category: 'development',
    tags: ['Integration', 'Automation']
  },
  '/storage-management-agent': {
    description: 'Агент управления файловым хранилищем всех серверов проекта: мониторинг IP и местоположения, добавление/удаление серверов, автоматическая оптимизация, холодное хранилище, сжатие медиа (Issue #2677)',
    category: 'automation',
    tags: ['Storage', 'Servers', 'Monitoring', 'IP', 'Location', 'Optimization', 'Multi-Server', 'Files', 'CDN', 'Compression', 'Lifecycle']
  },
  '/external-integrations': {
    description: 'Внешние интеграции: подключение 100+ нативных сервисов и 7000+ приложений через Zapier/Make. Включает Slack, Microsoft Teams, GitHub, Discord, Telegram, Google Drive, Dropbox, HubSpot CRM, AWS S3. OAuth2 авторизация, управление webhooks, мониторинг здоровья интеграций, автоматическое обновление токенов. Zapier app: 6 triggers (новый агент, задача завершена, workflow запущен), 6 actions (создать задачу, запустить агента, обновить проект), 3 searches (Issues #2361, #5348)',
    category: 'tools',
    tags: ['Integration', 'Zapier', 'Make', 'OAuth', 'Webhooks', 'Slack', 'Teams', 'GitHub', 'Discord', 'Telegram', 'Google Drive', 'Dropbox', 'HubSpot', 'AWS S3', 'CRM', 'Automation', 'API']
  },
  '/logs': {
    description: 'Просмотр и загрузка системных логов: деплойменты, backend, ошибки (Issue #2140)',
    category: 'development',
    tags: ['Logs', 'Monitoring', 'Debug', 'Admin']
  },

  // Data and Visualization
  '/:dbName/tables': {
    description: 'Просмотр и управление таблицами базы данных',
    category: 'data',
    tags: ['Database', 'Tables']
  },
  '/tables-integram': {
    description: 'Редактор таблиц Integram: прямое подключение к Integram API для создания, редактирования и управления таблицами и записями. Поддержка DDL и DML операций, редактирование структуры таблиц и данных',
    category: 'data',
    tags: ['Integram', 'Tables', 'Database', 'DDL', 'DML', 'Table Editor', 'Data Management']
  },
  '/:dbName/reports': {
    description: 'Отчеты из базы данных с фильтрацией и экспортом',
    category: 'data',
    tags: ['Reports', 'Analytics']
  },
  '/enhanced-report/:reportId': {
    description: 'Расширенный просмотр отчетов с поддержкой редактирования, JSON_KV и JSON_RICH форматов. Интеграция с SmartQ редактором для создания и изменения отчетов',
    category: 'data',
    tags: ['Reports', 'Analytics', 'Editor', 'JSON_KV', 'JSON_RICH', 'SmartQ']
  },
  '/flow': {
    description: 'Редактор flow-диаграмм для визуализации процессов с поддержкой Role-Sets парадигмы (Issue #1992: Things с атрибутами из призм)',
    category: 'visualization',
    tags: ['Flow', 'Diagrams', 'Role-Sets', 'Prisms', 'Data Transformation']
  },
  '/flow_editor': {
    description: 'Редактор схем с поддержкой совместной работы',
    category: 'visualization',
    tags: ['Diagrams', 'Collaboration']
  },
  '/role-sets-editor': {
    description: 'Концептуальное моделирование с парадигмой Role-Sets: Prisms (перспективы), Roles (роли), Things (объекты), Witnesses (свидетели), PQ-запросы',
    category: 'visualization',
    tags: ['Role-Sets', 'Conceptual Modeling', 'Flow Editor', 'Prisms', 'PQ Queries']
  },
  '/role-sets-documentation': {
    description: 'Полная документация для разработчиков по парадигме Role-Sets: теория, архитектура, API, примеры кода, лучшие практики, руководства по устранению неполадок',
    category: 'documentation',
    tags: ['Role-Sets', 'Documentation', 'Developer Guide', 'API', 'Theory', 'Examples', 'Best Practices']
  },
  '/computational-ontology': {
    description: 'Вычислительная Онтология: обзор парадигмы Role-Sets, ключевые концепции (Things, Prisms, Roles, Witnesses), практические примеры и демонстрации. Эволюция данных без миграций схем',
    category: 'visualization',
    tags: ['Computational Ontology', 'Role-Sets', 'Prisms', 'Things', 'Witnesses', 'PQ Queries', 'Conceptual Modeling', 'Data Evolution']
  },
  '/event-ontology': {
    description: 'Движок событийной онтологии: редактор онтологий, workflow-движок и темпоральное хранилище. Акторы, концепты, словари, приложения, модели событий с ограничениями, индивиды, DAG предметных событий, BSL-запросы. Агентные триггеры: invokeAgent, chainAgent — автоматический запуск AI-агентов по событиям СОД.',
    category: 'data',
    tags: ['Ontology', 'Events', 'Workflow', 'DAG', 'BSL', 'Actors', 'Models', 'Temporal', 'Agents', 'Triggers', 'событийная онтология', 'событийный движок', 'event engine', 'онтология событий']
  },
  '/drononomics': {
    description: 'Дронономика v3: экономическая стратегия БАС на 10 лет. 7 регионов, 5 типов дронов, 8 полезных нагрузок, 8 типов миссий. Инфраструктура, производство, государство, война. Индекс Дронономики 0-1000.',
    category: 'analytics',
    tags: ['Economics', 'Drones', 'Strategy', 'Simulation', 'Infrastructure', 'Map', 'SVG', 'Game', 'War']
  },
  '/nti-simulator': {
    description: 'НТИ Фонд Симулятор: страница-игра на основе онтологии Фонда НТИ (ФСТ НТИ). 9 рынков, 6 типов проектов, 6-осевой AI-скоринг (вкл. суверенность), MRL, субфонды с leverage 1:3, конвертируемый заём, локализация, серийное производство. FSM-движок, Wright\'s Law, Леонтьевская матрица, фонд-индекс AAA-C. Роль «Инвестдиректор ФСТ» (бюджет 6.4 млрд, критерии Д. Гордина).',
    category: 'analytics',
    tags: ['NTI', 'Simulation', 'Strategy', 'Game', 'Economy', 'Fund', 'Markets', 'Innovation', 'SVG', 'FSM', 'Sovereignty', 'MRL', 'Scoring', 'FST']
  },
  '/fst': {
    description: 'ФСТ НТИ — Стартовая страница платформы управления венчурным портфелем. Единый хаб: воронка сделки (заявка → ИК → сделка → исполнение → мониторинг → выход), 6 модулей платформы, статистика фонда (6.4 млрд AUM, 7 компаний, 3 субфонда, IRR 38%). Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Хаб', 'Фонд', 'Суверенность', 'Портфель', 'AI', 'БПЛА', 'found']
  },
  '/fst-committee': {
    description: 'ФСТ НТИ AI Инвесткомитет: 6 AI-агентов разных ролей (технический аналитик, финансист, эксперт суверенности, риск-менеджер, стратег портфеля, адвокат дьявола) анализируют инвестиционный проект, вступают в дебаты с аргументами и контраргументами, голосуют и формируют рекомендацию. Люди утверждают решение. Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Инвесткомитет', 'AI Агенты', 'Суверенность', 'Дебаты', 'Голосование', 'Венчур', 'БПЛА', 'Фонд', 'found']
  },
  '/fst-protocol': {
    description: 'ФСТ НТИ — Протоколы инвесткомитета: история всех заседаний AI-инвесткомитета с полными дебатами агентов. Каждый протокол содержит: полную транскрипцию аргументов всех 6 агентов, итоговые голоса с баллами и уверенностью, решение комитета, условия одобрения, ключевые риски, параметры политики ФСТ на момент сессии. Прозрачность как у настоящего инвестиционного комитета. Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Протокол', 'Инвесткомитет', 'История', 'AI Агенты', 'Прозрачность', 'Венчур', 'БПЛА', 'Фонд', 'found']
  },
  '/fst-twin': {
    description: 'ФСТ НТИ — Цифровой двойник портфельной компании: живая симуляция компании «АвиаЛогик» с tick-engine. Жизненные показатели (выручка, burn rate, headcount, TRL/MRL/суверенность), датчики рисков, смарт-контракт с траншами и KPI-триггерами. Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Цифровой Двойник', 'Портфель', 'Симуляция', 'Смарт-контракт', 'AI', 'БПЛА', 'Венчур', 'Мониторинг', 'found']
  },
  '/fst-fund': {
    description: 'ФСТ НТИ — Цифровой двойник фонда: мониторинг всего портфеля из 7 компаний в 3 субфондах (БАС, РОБО, МЭ). Рейтинг здоровья, NAV, ROI, матрица рисков, AI-прогноз (NAV 2026/2027, IRR, DPI). Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Фонд', 'Портфель', 'NAV', 'ROI', 'IRR', 'AI', 'Цифровой Двойник', 'Субфонды', 'found']
  },
  '/fst-deal': {
    description: 'ФСТ НТИ — Доведение сделки: полный цикл от одобрения ИК до подписания смарт-контракта. Параметры сделки (equity/CLN/грант), SPV, транши с KPI-триггерами, автогенерация Term Sheet через AI. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Сделка', 'Смарт-контракт', 'SPV', 'Term Sheet', 'AI', 'Венчур', 'Инвестиции', 'CLN', 'Equity', 'found']
  },
  '/fst-learning': {
    description: 'ФСТ НТИ — Нейрокогнитивное ядро: самообучающаяся модель инвесткомитета на исторических данных (Issue #12). Датасет: проект → решение ИК (скоры агентов, аргументы) → факт через 3 года (жив/умер/exit). Калибровка весов агентов через логистическую регрессию. Post-audit анализ: прогнозный vs фактический IRR, производительность каждого агента (какой агент был точнее?). Дашборд точности ИК: predicted vs actual по годам, вклад агентов в правильные/неправильные решения. API: добавление обучающих примеров, автоматический fine-tuning весов скоринга. Экспорт калиброванных весов как JS код для FstCommitteeConfig.js. Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Machine Learning', 'Калибровка', 'Обучение', 'AI', 'Инвесткомитет', 'Анализ', 'Точность', 'Веса', 'Регрессия', 'found', 'Issue #12']
  },
  '/fst-execution': {
    description: 'ФСТ НТИ — Исполнение сделки: постинвестиционный мониторинг компании после выдачи транша. Kanban-доска 23 задач, KPI-прогресс, чеклист условий разблокировки транша 2, панель действий ФСТ. Канонический код: github.com/unidel2035/found',
    category: 'analytics',
    tags: ['ФСТ', 'НТИ', 'Исполнение', 'KPI', 'Задачи', 'Транши', 'Симуляция', 'Мониторинг', 'Kanban', 'found']
  },
  '/fst-portfolio': {
    description: 'ФСТ НТИ — Портфельный монитор: онлайн-мониторинг всех портфельных компаний с датчиками рисков и светофором (красный/жёлтый/зелёный). KPI, ЕГРЮЛ, ЕФРСБ, Роспатент, AI-еженедельный отчёт. Канонический код: github.com/unidel2035/found',
    category: 'analytics',
    tags: ['ФСТ', 'НТИ', 'Портфель', 'Мониторинг', 'Риски', 'ЕГРЮЛ', 'Светофор', 'AI', 'Runway', 'KPI', 'Отчёты', 'found']
  },
  '/fst-intelligence': {
    description: 'ФСТ НТИ — Portfolio Intelligence: автоматический еженедельный AI-отчёт по портфелю (Issue #22). Генерируется каждый понедельник через DeepSeek: Executive Digest (обзор недели, топ-3 позитива/риска, action items для управляющего), компании в зоне риска (runway < 6 мес, TRL стагнация 2+ кв, падение найма с рекомендациями по каждой), рыночная разведка (новости БАС/РОБО/МЭ, активность конкурентов, новые нормативные акты), прогноз на следующую неделю (ожидаемые KPI, транши к разблокировке, встречи с компаниями). Архив всех отчётов, доставка на email и Telegram. Аналоги: Andreessen Horowitz internal memo, Sequoia weekly portfolio update, Coatue AI research. Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Portfolio Intelligence', 'AI Отчёт', 'DeepSeek', 'Еженедельный', 'Риски', 'Рыночная разведка', 'Прогноз', 'БАС', 'РОБО', 'МЭ', 'Венчур', 'Аналитика', 'found', 'Issue #22']
  },
  '/fst-allocation': {
    description: 'ФСТ НТИ — Оптимизация аллокации капитала: количественное распределение NAV фонда между субфондами БАС/РОБО/МЭ/AI с использованием Black-Litterman (Issue #23). Интерактивные слайдеры весов субфондов, граница эффективности (efficient frontier) риск-доходность с визуализацией текущего портфеля, автоматический расчёт оптимальной аллокации по Sharpe ratio, взгляды управляющего (market views) с уверенностью для настройки Black-Litterman модели, матрица корреляций между субфондами для выявления концентрации рисков, сценарный стресс-тест (шок сертификации, заморозка бюджетов МО, кадровый кризис, санкционное давление) с оценкой влияния на NAV и IRR, концентрация рисков по заказчику/географии/технологии/стадии. Метрики: ожидаемый IRR, волатильность, Sharpe ratio, max drawdown. Аналоги: BlackRock Aladdin portfolio optimization, Two Sigma / Bridgewater risk parity. Канонический код: github.com/unidel2035/found',
    category: 'analytics',
    tags: ['ФСТ', 'НТИ', 'Аллокация', 'Black-Litterman', 'Оптимизация', 'Портфель', 'Риск', 'Доходность', 'Efficient Frontier', 'Sharpe Ratio', 'Корреляция', 'Стресс-тест', 'NAV', 'IRR', 'БАС', 'РОБО', 'МЭ', 'AI', 'Венчур', 'found', 'Issue #23']
  },
  '/fst-apply': {
    description: 'ФСТ НТИ — Подача заявки стартапом: многошаговая форма для подачи заявки в фонд (Issue #84). 4 шага: Компания (название, ИНН, сфера, стадия), Технология (TRL, патенты, рынок TAM/SAM, суверенность), Финансы (запрашиваемая сумма, pre-money, команда, достижения), Документы (pitch deck, финмодель, контакты). Прогресс-бар, inline-подсказки по TRL/MRL/суверенности, предварительный скоринг с gate-проверкой, сохранение в ai2o.ru/fst через Integram. После отправки: статус заявки и next steps (скрининг → DD → ИК → term sheet). Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Заявка', 'Стартапы', 'Форма', 'TRL', 'MRL', 'Суверенность', 'Скоринг', 'Integram', 'Венчур', 'БПЛА', 'found', 'Issue #84']
  },
  '/fst-sourcing': {
    description: 'ФСТ НТИ — AI Deal Sourcing: автоматический мониторинг открытых источников для поиска перспективных стартапов в секторах БАС/РОБО/МЭ (Issue #20). Источники: Telegram (через tg-search-agent), HH.ru (активность найма), ЕГРЮЛ/ФНС (новые ООО в целевых ОКВЭД), ФИПС (патентные заявки в классах B64/G05/H04), Сколково (реестр резидентов), Фонд Бортника, GitHub/GitLab (UAV, БПЛА, autonomous), СМИ + AI sentiment. Pipeline: парсинг → дедупликация → AI-скоринг (релевантность сектору, предварительная суверенность, сигналы роста, вероятность прохождения gate-критериев) → карточка в ленте. Фильтры по источнику/сектору/оценке/периоду. Кнопка "Добавить в воронку" → автоматически создаёт заявку в /fst-dealflow. Настройка ключевых слов, частоты обновления (hourly/daily/weekly). Аналоги: SignalFire Beacon (650M профилей), EQT Motherbrain (50+ источников). Канонический код: github.com/unidel2035/found',
    category: 'ai',
    tags: ['ФСТ', 'НТИ', 'Deal Sourcing', 'AI', 'Парсинг', 'Telegram', 'HH.ru', 'ЕГРЮЛ', 'ФИПС', 'Сколково', 'GitHub', 'Автоматизация', 'Скоринг', 'Дедупликация', 'БАС', 'РОБО', 'МЭ', 'Венчур', 'Стартапы', 'found', 'Issue #20']
  },
  '/fst-syndication': {
    description: 'ФСТ НТИ — Сеть со-инвесторов и синдикация: управление синдицированными сделками и базой со-инвесторов (Issue #24). База со-инвесторов: карточки институциональных партнёров (РФРИТ, Сколково, Ростех Венчурс, Росинфокоминвест, ВЭБ.РФ, Роснано, Sistema_VC, ФРП) с типом (гос/частный/корпоративный), фокус-секторами, историческими co-deals, рейтингом партнёра (скорость решений, чёткость условий, полезность), контактами (имя, должность, email) в Integram. Синдикация сделки: из /fst-deal кнопка "Пригласить со-инвестора", выбор из базы + параметры (доля со-инвестора, права pari passu/senior), автообновление cap table, статусы (переговоры / NDA / TS / закрыли). Аналитика: граф сети (D3 force graph — кто с кем инвестировал), тепловая карта активности по секторам (БАС, Deep Tech, Robotics, Агро, Телеком, Нанотех), синдикационный потенциал для заявок в воронке с подходящими со-инвесторами и % совпадения. Term Sheet шаблоны синдикации (паритетная, лид-инвестор, со-лид). Связь: #16 (cap table доли соинвесторов), #13 (dealflow). Аналоги: Nasdaq Private Market syndicate module, AngelList syndicates. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Синдикация', 'Со-инвестирование', 'РФРИТ', 'Сколково', 'Ростех', 'Росинфокоминвест', 'Сеть инвесторов', 'Co-investment', 'Cap Table', 'D3 Graph', 'Тепловая карта', 'Аналитика', 'Term Sheet', 'Pari Passu', 'Senior Rights', 'Венчур', 'found', 'Issue #24']
  },
  '/fst-founders': {
    description: 'ФСТ НТИ — Founders CRM & Mentors: CRM для управления отношениями с основателями портфельных компаний и база менторов Фонда (Issue #25). Founders CRM: профили основателей (фото, биография, LinkedIn, Telegram, email), связи с компаниями (текущие + предыдущие, роль, доля), история взаимодействий с ФСТ (встречи, звонки, письма), теги ("Сильный технарь", "Сильный продавец", "Нужна поддержка"), референс-проверка (был ли в других портфелях, оценки). База менторов: эксперты Фонда по направлениям (БПЛА-инженерия, авионика, продажи гос.заказчику, IP, производство), профиль (специализация, опыт, доступность часов/мес, рейтинг), трекинг сессий (количество, обратная связь, оценки компаний). AI Mentor Matching: автоматический подбор ментора при риске в /fst-execution на основе экспертизы, доступности и рейтинга. Alumni & Networking: портфельные основатели после exit, тематические встречи ("Все БАС-стартапы ФСТ" ежеквартально), запросы помощи (компания А ищет эксперта по регуляторике → система рекомендует). Связь: #13 (dealflow поле "Команда"), #22 (intelligence использует данные). Аналоги: Sequoia Scouts network, Y Combinator alumni, a16z Executive Network. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'CRM', 'Founders', 'Менторы', 'Networking', 'Alumni', 'AI Matching', 'Основатели', 'Эксперты', 'Сессии', 'Обратная связь', 'Рейтинг', 'Взаимодействия', 'Биография', 'Sequoia', 'Y Combinator', 'a16z', 'Венчур', 'found', 'Issue #25']
  },
  '/fst-board': {
    description: 'ФСТ НТИ — Управление советом директоров и правами наблюдателей: инструмент для управления правами фонда в советах директоров портфельных компаний (Issue #43). Board Calendar: расписание заседаний по всем компаниям, автогенерация повестки из /fst-execution (открытые задачи + метрики), напоминания за 7/3/1 день, трансляция онлайн-ссылок (Zoom/Teams/TrueConf). Board Materials: шаблон Board Pack с автогенерацией из данных платформы (CEO Letter, финансовые результаты vs план, KPI Dashboard, риски и действия, вопросы для голосования), версионирование материалов, защищённый доступ только членам совета. Protective Provisions: реестр прав фонда (veto rights, approval thresholds по ФЗ-208 «Об АО» ст. 64-71, ФЗ-14 «Об ООО» ст. 32, ГК РФ ст. 67.1), трекер запросов на одобрение компаний и решений фонда, флаги нарушений инвестиционного договора. Voting Tracker: голосования по вопросам совета (одобрение бюджета, новые раунды, ключевой найм), история решений с обоснованием. Связь: #13 (dealflow → создание места в совете), #18 (execution → автоматическая повестка), #21 (portfolio → отражение в риск-мониторе). Аналоги: Carta Board Management, Certent Board Portal, Diligent Boards. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Совет директоров', 'Board', 'Board Pack', 'Protective Provisions', 'Veto Rights', 'Голосования', 'Права наблюдателей', 'ФЗ-208', 'ФЗ-14', 'ГК РФ', 'Календарь заседаний', 'Корпоративное управление', 'Governance', 'Венчур', 'found', 'Issue #43']
  },
  '/fst-transparency': {
    description: 'ФСТ НТИ — Публичная витрина фонда (Santiago Principles): публичная страница демонстрации прозрачности фонда по стандарту Santiago Principles® IFSWF (Issue #47). Публичный дашборд (без конфиденциальных данных): размер фонда (AUM), инвестиционная стратегия, горизонты, структура фонда (GP/LP, управляющая компания, регулятор), инвестиционная стратегия и фокус (БАС, РОБО, МЭ), команда (партнёры, инвестиционный комитет), ESG политика и обязательства, Compliance (AML политика, KYC процедура, регуляторный статус). Santiago Principles Compliance: таблица соответствия 24 принципам IFSWF (SP-1: Правовая база, SP-2: Цели фонда, SP-12: Управление, SP-18: Инвестиционная политика, SP-22: ESG и др.) с указанием статуса (✅ соответствует, 🔄 частично) и подтверждающих документов (лицензия ЦБ РФ, инвестиционная декларация, политика управления, ESG Policy). Структура управления: совет директоров, инвестиционный комитет, управляющая компания, комитет по рискам. Команда: профили ключевых партнёров и инвестдиректоров. Investor Data Room: защищённый раздел для потенциальных LP (после NDA) с инвестиционным меморандумом фонда, аудированной отчётностью за прошлые периоды, track record команды, reference calls с действующими LP. Нормативная база: Santiago Principles® (IFSWF, 24 принципа прозрачности), ФЗ-156 «Об инвестиционных фондах» (раскрытие информации УК), Указание ЦБ РФ № 5790-У (требования к раскрытию информации), OECD Principles of Corporate Governance 2023. Связь: #40 (ILPA LP-отчётность), #34 (ESG scoring), #33 (AML/KYC compliance), #28 (fund twin). Аналоги: IFSWF Member Disclosure, Norway GPFG Annual Report, Temasek Transparency Portal. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Santiago Principles', 'IFSWF', 'Прозрачность', 'LP', 'Investor Relations', 'ESG', 'Compliance', 'AML', 'KYC', 'Data Room', 'Governance', 'ЦБ РФ', 'ФЗ-156', 'OECD', 'Венчур', 'found', 'Issue #47']
  },
  '/fst-administration': {
    description: 'ФСТ НТИ — Бэк-офис фонда: управленческий учёт и соответствие ФСБУ 4/2023 (Issue #46). Management Fee & Carried Interest: расчёт вознаграждения УК (2% годовых от committed capital), начисление management fee по кварталам с историей платежей, carried interest (20% от прибыли сверх hurdle rate 8%). Расходы фонда: операционные расходы по категориям (due diligence, legal, travel, audit, admin), детализация по контрагентам и периодам, статистика расходов с визуализацией. Расчёт NAV: квартальный расчёт Net Asset Value (committed - deployed + unrealized gains), детальный расчёт с разбивкой по статьям (взносы LP, инвестиции в портфель, возврат капитала, management fee, операционные расходы, нереализованная/реализованная переоценка, FX курсовые разницы). Банковские операции: реестр банковских счетов фонда (RUB/USD/EUR), Capital Calls (заявки на взносы LP с отслеживанием статусов), Distributions (выплаты инвесторам: дивиденды, возврат капитала, exit proceeds). Аудиторская поддержка: подготовка пакета для внешнего аудитора (E&Y), Trial Balance (оборотно-сальдовая ведомость), LP Account Reconciliation, Capital Activity Statement, Investment Schedule, Expense Detail, Valuation Report, Audit Trail (история всех операций с поиском и фильтрацией). Отчётность ФСБУ 4/2023: формы финансовой отчётности в соответствии с новым стандартом (обязателен с 01.01.2025) - Форма 1: Отчёт о финансовом положении (баланс), Форма 2: Отчёт о совокупном доходе (P&L), Форма 3: Отчёт об изменениях капитала, Форма 4: Отчёт о движении денежных средств (Cash Flow), Форма 5: Примечания к финансовой отчётности. Нормативная база: ФСБУ 4/2023 «Бухгалтерская (финансовая) отчётность», ФЗ-402 «О бухгалтерском учёте», ФЗ-156 «Об инвестиционных фондах», Положение ЦБ РФ № 590-П (оценка активов). Связь: #40 (ILPA отчётность), #35 (waterfall & carry), #28 (fund twin NAV). Аналоги: Carta Fund Admin, AngelList Back Office, Allocate Fund Administration. Канонический код: github.com/unidel2035/fund',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Бэк-офис', 'Управленческий учёт', 'ФСБУ 4/2023', 'Management Fee', 'Carried Interest', 'NAV', 'Capital Call', 'Distribution', 'Trial Balance', 'Аудит', 'Банк', 'ЦБ РФ', 'ФЗ-402', 'ФЗ-156', 'Расходы фонда', 'Финансовая отчётность', 'Венчур', 'fund', 'Issue #46']
  },
  '/fst-glossary': {
    description: 'ФСТ НТИ — Полный глоссарий венчурных терминов с AI-объяснениями и интерактивными калькуляторами (Issue #114). Страница-энциклопедия с 65+ терминами по 5 категориям. Левая панель: мгновенный поиск, фильтры по категориям (Финансовые/Венчурные/AI/Регулирование/Платформа), статистика по категориям. Правая панель — карточка термина: определение, формула, интерактивный калькулятор (для IRR, MOIC, DPI, TVPI, Burn Rate, Runway, Unit Economics, LTV/CAC, Dilution), практический пример, контекст в ФСТ НТИ, AI-объяснение простым языком (DeepSeek), связанные термины с навигацией. База терминов: Финансовые метрики (20+): IRR, MOIC, DPI, TVPI, RVPI, NAV, ROI, ROE, EBITDA, Burn Rate, Runway, Carried Interest, Waterfall, Hurdle Rate, Management Fee, Fair Value, Unit Economics, LTV, CAC, ARPU, MRR, ARR. Венчурные термины (25+): Cap Table, SPV, LP, GP, Term Sheet, Due Diligence, Down Round, Pro-rata, Cliff, Vesting, SAFE, Convertible Note, Liquidation Preference, Participating Preferred, Anti-Dilution, Full Ratchet, Weighted Average, Preemptive Right, ROFR, Tag-Along, Drag-Along, Bridge Round, Extension, Flat Round, Dilution, Option Pool, Investment Memo. AI и платформа (10+): AI-инвесткомитет, Скрининг, Digital Twin, KAG, MCP, RAG, Vector DB, Embedding, Knowledge Graph, Integram, Workspace Agent, Tool Calling. Регулирование (6+): AML, KYC, ILPA, ESG, ПП-1726, ФСБУ 4/2023. MCP-доступ для агентов: инструмент get_term_definition(term) для AI-агентов платформы. Интерактивные калькуляторы с real-time расчётами, визуальными индикаторами (LTV/CAC ratio), адаптивным дизайном. Технологии: Vue 3 Composition API, PrimeVue, FinancialCalculators.vue, DeepSeek API, модульная архитектура. Цель: снижение порога входа для начинающих венчурных инвесторов, единая база знаний для AI-агентов.',
    category: 'education',
    tags: ['ФСТ', 'НТИ', 'Глоссарий', 'Энциклопедия', 'Венчурные термины', 'AI-объяснения', 'Калькуляторы', 'DeepSeek', 'Обучение', 'IRR', 'MOIC', 'DPI', 'TVPI', 'NAV', 'LTV', 'CAC', 'Burn Rate', 'Term Sheet', 'Due Diligence', 'MCP', 'Образование', 'Интерактив', 'Поиск', 'Фильтры', 'fund', 'Issue #114']
  },
  '/fst-school': {
    description: 'ФСТ НТИ — Школа агентов ИК: тренировочная платформа для AI-агентов инвесткомитета на рынках предсказаний и крипторынке. 4 режима: Рейтинг агентов (Brier Score леадерборд, Tit-for-Tat динамика весов, Shapley Value), Рынки предсказаний (Manifold Markets + Metaculus, живые вопросы с вероятностями), Крипто-трекер (BTC/ETH/SOL/TON, 24h и 7d горизонты), История предсказаний (с фильтрацией по агенту/статусу/категории). 12 агентов с уникальными алгоритмами: Монте-Карло (Box-Muller N=500, VaR), Байесовский (референсный класс, P0 обновление), Маркс-таймер (цикл 1-10, "Почему сейчас?"), Real Options (биномиальное дерево), 7 Powers (Power Law 50x), Game Theory (Nash, Schelling), DCF+IRR (Kelly criterion), FMEA+VaR (пессимист), TRL/MRL (S-кривая), Геополитика (санкционный риск), Портфель (Sharpe, корреляции), Devil\'s Advocate (Black Swan). Память агентов: последние 5 предсказаний + Brier Score + слабые категории передаются в контекст AI. Nash Equilibrium check: стабильность консенсуса (≥80% = Nash). Хранение в Integram тип 4540 "Предсказание агента" (20 реквизитов). Цель: натренировать агентов на публичных рынках за 1-3 года до применения в реальных сделках ИК.',
    category: 'education',
    tags: ['ФСТ', 'НТИ', 'Школа агентов', 'Предсказания', 'Brier Score', 'Nash Equilibrium', 'Shapley Value', 'Tit-for-Tat', 'Manifold Markets', 'Metaculus', 'CoinGecko', 'Монте-Карло', 'Байес', 'Game Theory', 'Обучение', 'AI', 'Агенты', 'Инвесткомитет']
  },
  '/fst-benchmark': {
    description: 'ФСТ НТИ — Бенчмаркинг портфеля по отраслевым мультипликаторам: сравнение портфельных компаний с рыночными аналогами и отраслевыми медианами (Issue #44). Отраслевые мультипликаторы: EV/Revenue, EV/EBITDA, P/S по стадиям (Pre-seed: 10-20x, Seed: 5-15x, Series A: 3-10x, Growth: 2-8x), квартили (P25/Median/P75), позиция портфеля. Сравнение с пирами: таблица публичных аналогов (AgEagle, Joby Aviation, EHang) и портфельных компаний с метриками ARR Growth %, Gross Margin %, Rule of 40. Radar chart: компания vs медиана сектора vs топ-квартиль. Исторический тренд: мультипликаторы 2020-2026 по годам. Справедливая оценка: диапазон валюации на основе бенчмарков и сопоставимых сделок. Фондовые бенчмарки: сравнение IRR/TVPI/DPI с Cambridge Associates VC Median, РАВИ медиана российских венчурных фондов, РФПИ benchmark. Scatter-график Risk/Return: позиционирование фонда vs рынка (S&P500, ОФЗ) и других венчурных индексов. Источники данных: Crunchbase/PitchBook (глобальные сделки), РФПИ и РВК (российские оценки), публичные drone/robotics компании. Нормативная база: МСФО 13 (оценка справедливой стоимости для LP-отчётности), ФСО 8 (Федеральный стандарт оценки РФ). Связь: #16 (deal → валюация), #21 (portfolio → сравнение с бенчмарками), #28 (fund → фондовые метрики). Аналоги: PitchBook Benchmarking, Cambridge Associates Benchmarks, Preqin Quartile Analysis. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Бенчмаркинг', 'Мультипликаторы', 'EV/Revenue', 'EV/EBITDA', 'Валюация', 'IRR', 'TVPI', 'DPI', 'Radar Chart', 'Rule of 40', 'Cambridge Associates', 'РАВИ', 'РФПИ', 'РВК', 'PitchBook', 'Crunchbase', 'МСФО 13', 'ФСО 8', 'Венчур', 'found', 'Issue #44']
  },
  '/fst-secondary': {
    description: 'ФСТ НТИ — Secondary Market: управление вторичными сделками для продажи доли фонда другим инвесторам (Issue #28). Инициирование secondary: продажа полной/частичной доли из cap table с минимальной ценой. Процесс: ФСТ определяет долю и цену → предложение покупателям из сети соинвесторов → сбор LOI (Letter of Intent) → переговоры и закрытие → обновление cap table. Оценка доли: 3 метода (NAV-based с дисконтом ликвидности 10-30%, DCF приведённая стоимость CF, Comparable transactions похожие secondary сделки). Активные предложения с статусами (активно, ожидает LOI, переговоры, закрыто), детали предложений, заинтересованные покупатели. База покупателей: Ростех, Роскосмос, ВЭБ.РФ, Сколково Ventures, RVC, Газпромбанк Invest с профилями (размер фонда, портфель, фокус-области). История вторичных сделок с ценами, покупателями и money multiple. Интерактивные расчёты оценки по каждому методу с параметрами и рекомендациями. Связь: #16 (captable обновляется после secondary), #24 (network покупатели из сети соинвесторов). Аналоги: Nasdaq Private Market secondaries, Forge Global, EquityZen. Канонический код: github.com/unidel2035/found',
    category: 'finance',
    tags: ['ФСТ', 'НТИ', 'Secondary Market', 'Вторичные сделки', 'Продажа доли', 'NAV', 'DCF', 'Comparable', 'LOI', 'Госкорпорации', 'Ростех', 'Роскосмос', 'ВЭБ', 'Покупатели', 'Оценка', 'Cap Table', 'Ликвидность', 'Венчур', 'found', 'Issue #28']
  },
  '/orbita-planner': {
    description: 'Орбита Planner: демо системы управления строительным персоналом. 5 модулей (КЭ, КП, КД, СП, КК). Расчёт H_min (минимальная бригада), авто-назначение по СОМ, двухконтурная экономика (парадокс +50% ЗП / -40% стоимость), мониторинг М0-М3.',
    category: 'analytics',
    tags: ['Orbita', 'Construction', 'Planning', 'Economics', 'Monitoring', 'HR', 'Demo', 'Investor']
  },
  '/ontology-browser': {
    description: 'UAV Ontology Browser: мультиязычная SKOS-таксономия БПЛА. Иерархическое дерево концептов, поиск на русском/китайском/английском, детали концепта с мультиязычными метками и синонимами, маппинг на внешние онтологии (Dronetology, AGROVOC, SOSA/SSN), экспорт JSON-LD/CSV.',
    category: 'data',
    tags: ['Ontology', 'SKOS', 'UAV', 'Taxonomy', 'Multilingual', 'OSINT', 'Dronetology', 'AGROVOC']
  },
  '/ontology': {
    description: 'Ontology Manager: полноценный трёхпанельный менеджер SKOS-онтологии БПЛА. Дерево концептов (PrimeVue Tree), D3 граф с 3 layout-ами, CRUD с мультиязычными метками (ru/en/zh), иерархия broader/narrower, внешние маппинги, управление связями.',
    category: 'data',
    tags: ['Ontology', 'SKOS', 'UAV', 'Taxonomy', 'CRUD', 'D3', 'Graph', 'Multilingual', 'Manager']
  },

  '/ontology-map': {
    description: 'Ontology Map Editor: интерактивный граф-редактор UAV SKOS-онтологии (Issue #7192). Визуализация ~230 концептов и 164+ связей из kval/1673250. Цветовая маркировка доменов (БПЛА, Миссия, Регулятор, Сенсор...), клик по узлу — боковая панель с реквизитами, drag & drop, zoom/pan. Режим редактирования: добавление концептов, создание связей (is_a, part_of, uses, hasComponent...), удаление. Импорт OWL/Turtle файлов (SSN, SOSA, GeoSPARQL, OntoUAV...) с preview и batch-import. Экспорт в JSON-LD. Три режима отображения: граф / граф+детали / список.',
    category: 'data',
    tags: ['Ontology', 'SKOS', 'UAV', 'Graph Editor', 'D3', 'Interactive', 'OWL', 'Turtle', 'Import', 'Export', 'Palantir', 'Issue #7192', 'kval', 'Integram']
  },
  '/ontology-explorer': {
    description: 'Факт-эксплорер онтологий: drill-down навигация по концептам. Выбор концепта → граф окружения (1-3 уровня связей) → клик для перехода дальше. Breadcrumb навигация, карточка концепта, поиск. AI-ассистент для объяснения связей. Аналог OSA Fact Explorer с AI-усилением.',
    category: 'data',
    tags: ['Ontology', 'Explorer', 'Drill-down', 'Graph', 'Navigation', 'AI', 'Facts', 'SKOS']
  },
  '/ontology-analytics': {
    description: 'Аналитика и качество онтологий: дашборд с метриками полноты, структуры и качества. Полнота EN/ZH/определений, орфан-концепты, дубликаты, распределение по доменам (radar chart), средняя связность. AI-анализ проблем и рекомендации. Кликабельные метрики.',
    category: 'data',
    tags: ['Ontology', 'Analytics', 'Quality', 'Metrics', 'Chart.js', 'AI', 'Dashboard', 'SKOS']
  },
  '/ontology-rules': {
    description: 'Правила и автоклассификация онтологий: визуальный конструктор правил IF-THEN, AI-автоклассификация доменов, AI-перевод меток на EN/ZH. Применение правил к массе концептов с предпросмотром результатов. Аналог OSA Rules + Reasoner с AI-усилением.',
    category: 'data',
    tags: ['Ontology', 'Rules', 'Classification', 'AI', 'Translation', 'Automation', 'SKOS', 'Reasoner']
  },
  '/ontology-mindmap': {
    description: 'Ontology Mindmap: визуализация онтологии в виде дерева (mindmap). Горизонтальный D3-tree с collapse/expand, поиск по концептам, выбор корневого узла, экспорт SVG/PNG. Панель деталей концепта с иерархией и связями.',
    category: 'data',
    tags: ['Ontology', 'Mindmap', 'Tree', 'D3', 'Visualization', 'SKOS', 'Hierarchy', 'Export']
  },
  '/ontology-sparql': {
    description: 'SPARQL Console: полнофункциональная консоль SPARQL 1.1 запросов к RDF-графу онтологии. SELECT/ASK/CONSTRUCT, примеры запросов, сохранение, метрики выполнения.',
    category: 'data',
    tags: ['Ontology', 'SPARQL', 'RDF', 'Query', 'Semantic Web', 'N3']
  },
  '/ontology-reasoning': {
    description: 'OWL Reasoning: движок логического вывода (RDFS/OWL/SKOS). Транзитивность subClassOf/broader, inverseOf, symmetric properties. Визуализация выведенных трипл и объяснение inference chain.',
    category: 'data',
    tags: ['Ontology', 'OWL', 'RDFS', 'Reasoning', 'Inference', 'Logic']
  },
  '/ontology-versions': {
    description: 'Версии онтологии: снапшоты, diff между версиями, откат. Timeline с метаданными, unified diff view добавленных/удалённых трипл.',
    category: 'data',
    tags: ['Ontology', 'Versioning', 'Diff', 'Snapshot', 'Rollback', 'History']
  },
  '/ontology-alignment': {
    description: 'Ontology Alignment: загрузка внешних OWL/Turtle онтологий, автоматическое сопоставление по меткам (Levenshtein), создание exactMatch/closeMatch связей.',
    category: 'data',
    tags: ['Ontology', 'Alignment', 'Matching', 'OWL', 'Import', 'Interoperability']
  },
  '/ontology-sparql-builder': {
    description: 'Visual SPARQL Builder: визуальный конструктор SPARQL запросов. Drag-and-drop блоки на D3 canvas, автогенерация SPARQL, выполнение и просмотр результатов.',
    category: 'data',
    tags: ['Ontology', 'SPARQL', 'Visual', 'Builder', 'Drag-Drop', 'D3', 'Query']
  },
  '/ontology-platform': {
    description: 'Обзор онтологической платформы DronDoc: сравнение с Protégé, TopBraid, PoolParty, WebVOWL, VIVO. Модули, технологии, преимущества.',
    category: 'data',
    tags: ['Ontology', 'Platform', 'Comparison', 'Overview', 'Features']
  },
  '/ontology-ontograf': {
    description: 'OntoGraf — интерактивная D3 force-directed визуализация классов онтологии. Разные формы узлов (класс=круг, свойство=ромб, экземпляр=квадрат), drag-and-drop реорганизация иерархии, контекстное меню, фильтры по глубине/домену/типу связи, zoom.',
    category: 'data',
    tags: ['Ontology', 'Graph', 'D3', 'Visualization', 'OntoGraf', 'Force-Directed', 'Interactive']
  },
  '/ontology-swrl': {
    description: 'SWRL Rules — редактор правил вывода для онтологии. Парсер SWRL-синтаксиса, 5 встроенных правил для БПЛА домена, выполнение правил против RDF-графа, таблица результатов инференса.',
    category: 'data',
    tags: ['Ontology', 'SWRL', 'Rules', 'Inference', 'Reasoning', 'OWL']
  },
  '/ontology-taxonomy': {
    description: 'Таксономия — управление иерархией онтологии. Интерактивное дерево broader/narrower с drag-and-drop, извлечение терминов из текста (NLP), сопоставление с существующими концептами.',
    category: 'data',
    tags: ['Ontology', 'Taxonomy', 'Hierarchy', 'NLP', 'Term Extraction', 'Tree']
  },
  '/ontology-lod': {
    description: 'LOD Cloud — обогащение онтологии из Linked Open Data. Поиск по Wikidata/DBpedia, связывание концептов через owl:sameAs, карточки результатов с метаданными.',
    category: 'data',
    tags: ['Ontology', 'LOD', 'Wikidata', 'DBpedia', 'Linked Data', 'owl:sameAs', 'Enrichment']
  },
  '/ontology-changes': {
    description: 'Change Requests — workflow утверждения изменений онтологии. Создание запросов на изменение, ревью (approve/reject), автоматическое применение при утверждении.',
    category: 'data',
    tags: ['Ontology', 'Change Request', 'Workflow', 'Governance', 'Review', 'Approval']
  },
  '/ontology-quality': {
    description: 'Quality Dashboard — KPI качества онтологии с трендами. Покрытие переводов, orphan-концепты, плотность связей, Chart.js графики (линейный, радар, пай), AI-рекомендации.',
    category: 'data',
    tags: ['Ontology', 'Quality', 'KPI', 'Dashboard', 'Chart.js', 'Analytics', 'Trends']
  },
  '/ontology-lessons': {
    description: 'Интерактивные уроки по онтологиям: 8 пошаговых уроков от основ (что такое онтология, триплет, SKOS) до продвинутых инструментов (SPARQL, SHACL, OWL Reasoning, LOD Cloud). Sidebar-навигация, карточки с примерами, ссылки на реальные модули.',
    category: 'education',
    tags: ['Ontology', 'Lessons', 'Tutorial', 'SPARQL', 'SHACL', 'OWL', 'SKOS', 'Education', 'Learning']
  },
  '/onto': {
    description: 'Единое пространство онтологий (Issue #7201): унифицированная точка входа для работы со всеми онтологиями проекта. Охватывает kval-таблицы: Онтология БПЛА (1673250, ~1096 концептов), Событийная онтология (1708619), СОД Концепты (1709562), Дроны (1731380), Производители (1731375), Применения (1731606). Хаб для навигации по всем онтологическим модулям. 1100+ концептов, 900+ связей, 6 модулей. Глобальный поиск по всем концептам (ru/en/zh), фильтрация по доменам, детальная карточка концепта.',
    category: 'data',
    tags: ['Ontology', 'SKOS', 'UAV', 'Knowledge Base', 'Global Search', 'kval', 'БПЛА', 'Событийная', 'СОД', 'Issue #7201', 'Unified', 'Hub']
  },
  '/vsl-editor': {
    description: 'Visual Scene Language Editor: AI-редактор для архитектурных и инженерных чертежей. Работа с визуальными сценами через структурированный JSON формат, понятный LLM. Создание, редактирование и генерация сцен через естественный язык.',
    category: 'visualization',
    tags: ['VSL', 'Visual Scene Language', 'Architecture', 'Engineering', 'BIM', 'CAD', 'AI', 'LLM', 'Drawings', 'Blueprint']
  },
  '/construction-doc': {
    description: 'Агент исполнительной документации МК: загрузка DXF/DWG чертежей металлоконструкций, AI-распознавание узлов соединений, расчёт ведомости крепежа по ГОСТ (болты, гайки, шайбы), 3D визуализация узлов, экспорт в XLSX и DOCX.',
    category: 'agents',
    tags: ['Construction', 'Steel', 'DXF', 'DWG', 'GOST', 'Bolts', '3D', 'Three.js', 'AI', 'Metal Structures', 'KMD', 'BIM']
  },
  '/flow2': {
    description: 'Расширенный редактор flow-диаграмм с поддержкой BPMN 2.0, процессов, гейтвеев, событий и экспорта/импорта BPMN XML',
    category: 'visualization',
    tags: ['Flow', 'BPMN', 'Process Modeling', 'Business Process', 'Workflow', 'Animation']
  },
  '/image-manager': {
    description: 'Менеджер изображений: поиск качественных изображений из Unsplash и Pexels, генерация AI изображений через DALL-E, поиск анимированных иконок Lottie. Инструмент для дизайна landing страниц и UI.',
    category: 'tools',
    tags: ['Images', 'Design', 'AI Generation', 'Stock Photos', 'Unsplash', 'Pexels', 'Lottie', 'Animations', 'DALL-E', 'Landing Pages', 'UI Design']
  },
  '/table': {
    description: 'Тестовая таблица с демонстрацией возможностей',
    category: 'data',
    tags: ['Table', 'Demo']
  },
  '/repitor': {
    description: 'Редактор отчетов с шаблонами и автогенерацией',
    category: 'business',
    tags: ['Reports', 'Templates', 'BI']
  },

  // Maps and Geolocation
  '/map': {
    description: 'Интерактивная карта для отображения объектов',
    category: 'maps',
    tags: ['Maps', 'Geolocation']
  },
  '/osm': {
    description: 'Работа с OpenStreetMap данными',
    category: 'maps',
    tags: ['OSM', 'Maps', 'GIS']
  },
  '/cells': {
    description: 'Визуализация ячеек покрытия на карте',
    category: 'maps',
    tags: ['Maps', 'Cells', 'Coverage']
  },
  '/tar1090': {
    description: 'Интерфейс отслеживания воздушного транспорта',
    category: 'maps',
    tags: ['Aviation', 'Tracking', 'ADS-B']
  },

  // Communication and Collaboration
  '/messenger': {
    description: 'Встроенный мессенджер для командной работы',
    category: 'communication',
    tags: ['Messenger', 'Chat', 'Communication']
  },
  '/messenger/settings': {
    description: 'Настройки мессенджера',
    category: 'communication',
    tags: ['Messenger', 'Settings']
  },
  // Unified Conference Platform (Issue #3170)
  '/conference/:room?': {
    description: 'Единая платформа видеоконференций, объединяющая 4 функции в одном интерфейсе: (1) Видеоконференции - WebRTC связь, запись, транскрибация, чат, AI-подавление шума, видео фильтры, enterprise-grade безопасность (E2EE, пароли, host controls); (2) Облачные записи - автоматическая AI-обработка (транскрибация, краткое содержание, ключевые моменты, умные главы), полнотекстовый поиск; (3) Планирование - интеграция с календарями (Google Calendar, Outlook, iCal), приглашения, напоминания, повторяющиеся встречи; (4) Интерактивная доска - Whiteboard в стиле Figma для совместной работы в реальном времени. Переключение между режимами через вкладки. Всё на базе Zoom/Google Meet концепции - всё в одном.',
    category: 'communication',
    tags: ['Video Conference', 'Platform', 'Unified', 'WebRTC', 'Recording', 'AI', 'Transcription', 'Scheduling', 'Calendar', 'Whiteboard', 'Collaboration', 'Cloud', 'E2EE', 'Security', 'Meetings', 'All-in-One']
  },

  // Legacy routes - now redirect to unified platform
  '/videoconference/:room?': {
    description: 'Перенаправление на единую платформу видеоконференций (/conference) - вкладка "Видеоконференция"',
    category: 'communication',
    tags: ['Video', 'WebRTC', 'Conference', 'Redirect', 'Legacy']
  },

  '/whiteboard/:roomId?': {
    description: 'Перенаправление на единую платформу видеоконференций (/conference) - вкладка "Интерактивная доска"',
    category: 'communication',
    tags: ['Whiteboard', 'Collaboration', 'Redirect', 'Legacy']
  },

  '/cloud-recordings': {
    description: 'Перенаправление на единую платформу видеоконференций (/conference) - вкладка "Записи"',
    category: 'communication',
    tags: ['Cloud', 'Recording', 'Redirect', 'Legacy']
  },

  '/conference-scheduler': {
    description: 'Перенаправление на единую платформу видеоконференций (/conference) - вкладка "Планирование"',
    category: 'communication',
    tags: ['Calendar', 'Scheduling', 'Redirect', 'Legacy']
  },

  // Conference Analytics (Issue #2354)
  '/conference-analytics': {
    description: 'Детальная аналитика и отчеты по видеоконференциям: посещаемость участников (время входа/выхода), метрики вовлеченности (активность в чате, реакции), время речи каждого участника, качество сети (bitrate, packet loss, latency), статистика устройств. Экспорт отчетов в CSV и JSON, визуализация данных через интерактивные графики',
    category: 'analytics',
    tags: ['Analytics', 'Conference', 'Reports', 'Metrics', 'Attendance', 'Engagement', 'Network Quality', 'Chart.js', 'Export']
  },

  // Video Conference Performance Testing (Issue #2402)
  '/videoconference-performance-testing': {
    description: 'Тестирование производительности mesh P2P архитектуры видеоконференций: измерение baseline метрик (CPU, RAM, bandwidth, latency, packet loss, video quality) для 5, 10, 15, и 20 участников. Определение практических ограничений, точки деградации производительности, и планирование миграции на SFU. Real-time мониторинг WebRTC соединений, экспорт результатов в JSON и CSV, автоматические рекомендации',
    category: 'development',
    tags: ['Performance', 'Testing', 'WebRTC', 'Mesh P2P', 'Metrics', 'Bandwidth', 'Video Conference', 'Baseline', 'SFU Migration', 'Benchmarking']
  },
  '/share/recording/:token': {
    description: 'Публичный просмотр записи видеоконференции по уникальной ссылке с доступом к транскрипту и AI-аналитике',
    category: 'communication',
    tags: ['Share', 'Recording', 'Public', 'Video']
  },

  // Finance and Payments
  '/payment': {
    description: 'Управление платежами и подписками',
    category: 'finance',
    tags: ['Payment', 'Billing']
  },
  '/my-agents': {
    description: 'Мои агенты: управление купленными агентами и подписками, а также созданными кастомными агентами через CustomAgentRegistry. Просмотр активных агентов, статистики использования и выполненных задач (AgentTask), управление подписками (продление/отмена), история платежей и счета. Интеграция с Integram для хранения AgentApplication и FunctionalAgent сущностей. Полный контроль жизненного цикла: запуск/остановка/пауза агентов, мониторинг статусов (created/starting/running/paused/stopped/error/recovering)',
    category: 'agents',
    tags: ['My Agents', 'Subscriptions', 'Purchased Agents', 'Usage Stats', 'Billing History', 'Subscription Management', 'CustomAgentRegistry', 'Agent Ontology', 'AgentApplication', 'FunctionalAgent', 'AgentTask', 'Lifecycle Management', 'Agent Status', 'Task History', 'Integram']
  },
  '/tokens': {
    description: 'Управление токенами для AI моделей с детальной статистикой потребления: отслеживание запросов, использованных токенов и затрат для каждой модели. Интеграция с polza для фиксации всех обращений к ИИ',
    category: 'finance',
    tags: ['Tokens', 'AI', 'Billing', 'Token Consumption', 'Analytics', 'Polza']
  },
  '/secrets-manager': {
    description: 'Централизованное управление секретами, паролями, API ключами и токенами с автоматической ротацией и обнаружением утечек',
    category: 'automation',
    tags: ['Security', 'Secrets', 'Passwords', 'API Keys', 'Rotation', 'Leak Detection', 'Audit']
  },
  '/crypto-wallet': {
    description: 'Криптокошелек для операций с криптовалютой',
    category: 'finance',
    tags: ['Crypto', 'Wallet', 'Blockchain']
  },
  '/fin': {
    description: 'Финансовая модель инфраструктуры БАС',
    category: 'finance',
    tags: ['Finance', 'Drones', 'Infrastructure']
  },
  '/finmodel': {
    description: 'Финансовое моделирование и прогнозы',
    category: 'finance',
    tags: ['Finance', 'Modeling']
  },
  '/finmodel/ecosystem': {
    description: 'Анализ экосистемы взаимосвязанных бизнесов Drone Economy: синергии, матрица Леонтьева, петли обратной связи, диаграмма Санки и стратегические сценарии',
    category: 'finance',
    tags: ['Finance', 'Ecosystem', 'Synergy', 'Drones', 'Analytics', 'Leontief', 'DCF', 'Scenarios', 'Investment']
  },
  '/ecosystem-unified': {
    description: 'Единая модель экосистемы БАС: 7 бизнес-моделей с интерактивным P&L, экосистемный обзор (Sankey, Леонтьев), бэктест с Монте-Карло',
    category: 'finance',
    tags: ['Экосистема', 'Финмодель', 'Бэктест', 'Леонтьев', 'Monte Carlo', 'БАС']
  },
  '/drone-economy-demo': {
    description: 'Интерактивное инвестиционное демо: AI-агент по одной фразе в чате строит полную финмодель экосистемы дронов с P&L, Sankey-диаграммой, tornado-анализом чувствительности и пересчётом сценариев в реальном времени',
    category: 'demo',
    tags: ['Demo', 'AI', 'Finance', 'Drones', 'Ecosystem', 'Chat', 'NPV', 'Sankey', 'Tornado', 'Scenarios', 'Investment']
  },

  // Configuration and Settings
  '/settings': {
    description: 'Общие настройки платформы',
    category: 'settings',
    tags: ['Settings', 'Configuration']
  },
  '/settings/notifications': {
    description: 'Настройки уведомлений и оповещений',
    category: 'settings',
    tags: ['Notifications', 'Settings']
  },
  '/settings/branding': {
    description: 'White Label - Кастомный брендинг и домены: настройка логотипа, цветовой схемы, пользовательских доменов для корпоративных клиентов. Доступно на плане Корпоративный (Issue #5353)',
    category: 'settings',
    tags: ['White Label', 'Branding', 'Custom Domain', 'Logo', 'Colors', 'Corporate', 'Settings', 'Enterprise']
  },
  '/settings/backend': {
    description: 'Настройка монолит бэкэнда и базы данных Интеграм: конфигурация подключения, маппинг эндпоинтов к таблицам, тестирование соединений',
    category: 'settings',
    tags: ['Backend', 'Configuration', 'Database', 'Integram', 'Settings', 'Admin']
  },
  '/menu-config': {
    description: 'Настройка меню и навигации',
    category: 'settings',
    tags: ['Menu', 'Configuration']
  },
  '/intergram-config': {
    description: 'Конфигурация базы данных Интеграм',
    category: 'settings',
    tags: ['Database', 'Configuration', 'Intergram']
  },
  '/database-manager': {
    description: 'Управление базами данных платформы',
    category: 'settings',
    tags: ['Database', 'Management']
  },
  '/pages': {
    description: 'Управление всеми страницами платформы',
    category: 'settings',
    tags: ['Pages', 'Management']
  },
  '/pages-sections': {
    description: 'Управление разделами страниц',
    category: 'settings',
    tags: ['Pages', 'Sections']
  },
  '/profile/edit': {
    description: 'Редактирование профиля пользователя',
    category: 'settings',
    tags: ['Profile', 'User']
  },
  '/github-pages': {
    description: 'Управление GitHub Pages для публикации',
    category: 'settings',
    tags: ['GitHub', 'Publishing']
  },

  // Special and Experimental
  '/german-learning': {
    description: 'Интерактивное изучение немецкого языка с ИИ',
    category: 'education',
    tags: ['Learning', 'Languages', 'AI']
  },
  '/philosophy-graph': {
    description: 'Граф знаний по античной философии: интерактивная визуализация философов, школ и концепций с помощью D3.js. Фильтрация по школам, поиск по имени философа, просмотр биографии и ключевых идей, экспорт в SVG. База данных с 20 философами и 10 школами античной философии (Issue #5060)',
    category: 'education',
    tags: ['Philosophy', 'Knowledge Graph', 'D3.js', 'Ancient Philosophy', 'Visualization', 'Learning', 'Interactive', 'Issue #5060']
  },
  '/philosophy-mindmap': {
    description: 'Ментальная карта по античной философии: иерархическая визуализация школ и философов в виде интерактивного дерева с D3.js. Сворачивание/разворачивание уровней, экспорт в SVG, цветовая кодировка типов узлов. Удобный инструмент для изучения структуры и связей античной философии (Issue #5060)',
    category: 'education',
    tags: ['Philosophy', 'Mind Map', 'D3.js', 'Ancient Philosophy', 'Tree Visualization', 'Learning', 'Hierarchical', 'Issue #5060']
  },
  '/philosophy-study-guide': {
    description: 'Конспект по античной философии для студентов МГУ: подробный учебный материал по 32 темам экзамена по философии. Включает методику быстрого изучения (система "3 круга", mind map, elevator pitch), ключевые цитаты философов, и подробные конспекты всех тем от досократиков до неоплатонизма. Доступен экспорт в MD и DOCX форматы (Issue #5060)',
    category: 'education',
    tags: ['Philosophy', 'Study Guide', 'Ancient Philosophy', 'Learning', 'Education', 'Exam Preparation', 'MGU', 'Methodology', 'Issue #5060']
  },
  '/archive-digitization': {
    description: 'Оцифровка архивов: OCR, классификация, индексация',
    category: 'ai',
    tags: ['OCR', 'Archives', 'AI']
  },
  '/orthodox-knowledge': {
    description: 'Агент знаний о Святых Отцах и православной традиции',
    category: 'ai',
    tags: ['Knowledge', 'Religion', 'AI']
  },
  '/knowledge-management': {
    description: 'Централизованное хранилище знаний организации: индексация документации, FAQ, wiki, семантический поиск, автоматическая генерация документов из кода и логов, RAG (Retrieval Augmented Generation), рекомендации статей по контексту',
    category: 'ai',
    tags: ['Knowledge Management', 'Documentation', 'FAQ', 'Wiki', 'Semantic Search', 'RAG', 'Vector DB', 'AI', 'Code Documentation', 'Automation']
  },
  '/kag': {
    description: 'База знаний проекта DronDoc2025 на основе KAG (Knowledge Augmented Generation): автоматическая индексация issues, PR, кода и документации из GitHub репозитория, граф знаний с сущностями и связями, семантический поиск, RAG-чат для ответов на вопросы о проекте. Поддержка нескольких репозиториев с namespace для унифицированного поиска. Превосходит традиционный RAG благодаря логическому рассуждению на основе графов знаний (OpenSPG/KAG)',
    category: 'ai',
    tags: ['KAG', 'Knowledge Graph', 'RAG', 'GitHub', 'Issues', 'Pull Requests', 'Code Indexing', 'Semantic Search', 'Project Knowledge', 'Documentation', 'AI Chat', 'Multi-Repository', 'Issue #5005', 'Issue #5082']
  },
  '/knowledge-base': {
    description: 'Редирект на /kag - База знаний проекта с KAG (Knowledge Augmented Generation)',
    category: 'ai',
    tags: ['KAG', 'Knowledge Base', 'Redirect']
  },
  '/kag-graph-explorer': {
    description: 'Интерактивный граф знаний: визуализация сущностей и связей из базы знаний KAG с помощью D3.js. Поддерживает фильтрацию по типам сущностей и связей, поиск в графе, различные алгоритмы раскладки (силовая, круговая, иерархическая), панель детальной информации о сущностях, интерактивное исследование графа с zoom/pan, экспорт в JSON/GraphML/DOT. Превращает текстовые результаты KAG в визуальное исследование отношений.',
    category: 'visualization',
    tags: ['KAG', 'Knowledge Graph', 'D3.js', 'Visualization', 'Interactive', 'Graph Explorer', 'Filtering', 'Search', 'Force-Directed', 'Entity Relations', 'Issue #5077']
  },
  '/routes': {
    description: 'Визуализация всех маршрутов платформы с описаниями',
    category: 'development',
    tags: ['Routes', 'Navigation', 'Documentation']
  },
  '/nti-presentation': {
    description: 'Инвестиционная презентация для Фонда НТИ — суверенная платформа когнитивной аналитики рынка БАС. Два режима: для Пескова (стратегический визионер) и Малькова (аналитик фонда). Живые демо всех модулей, финансовая модель, структура сделки.',
    category: 'business',
    tags: ['НТИ', 'Инвестиции', 'Презентация', 'БАС', 'Аналитика', 'Онтология']
  },

  '/cargo-drone-presentation': {
    description: 'Презентация грузовых БПЛА и их возможностей',
    category: 'drones',
    tags: ['Drones', 'Cargo', 'Presentation']
  },
  '/test': {
    description: 'Тестовая страница для экспериментов',
    category: 'development',
    tags: ['Testing', 'Experimental']
  },
  '/integram-test': {
    description: 'Тестовая реализация для взаимодействия с Integram API: авторизация, чтение и запись данных в систему Integram',
    category: 'development',
    tags: ['Testing', 'Integram', 'API', 'Database', 'Integration']
  },
  '/integram-mcp': {
    description: 'Integram MCP Server: веб-интерфейс для работы с 27 MCP инструментами Integram API. Управление типами, объектами, реквизитами через AI-помощника на DeepSeek',
    category: 'development',
    tags: ['MCP', 'Integram', 'AI', 'Database', 'DeepSeek', 'Tools', 'API']
  },
  '/tracking': {
    description: 'Трекинг менеджер: простая система управления проектами и задачами с интеграцией Integram. Поддерживает создание проектов, задач с приоритетами и статусами, привязку к пользователю через авторизацию Integram',
    category: 'tools',
    tags: ['Tracking', 'Project Management', 'Tasks', 'Integram', 'Issue Tracker', 'Productivity']
  },
  '/orbity': {
    description: 'Платформа "Орбиты" - экосистема для заказчиков и исполнителей с системой наставничества и справедливой оплаты',
    category: 'business',
    tags: ['Орбиты', 'Freelance', 'Projects', 'Skills', 'Mentorship']
  },
  '/orbity/login': {
    description: 'Вход в платформу Орбиты: аутентификация пользователей, восстановление пароля и вход через Google',
    category: 'auth',
    tags: ['Орбиты', 'Login', 'Sign In', 'Auth', 'Authentication']
  },
  '/orbity/nav': {
    description: 'Навигация по разделам платформы Орбиты: доступ к проектам, задачам, профилю и настройкам',
    category: 'business',
    tags: ['Орбиты', 'Navigation', 'Menu', 'Dashboard']
  },
  '/orbity/setup': {
    description: 'Настройка базы данных платформы Орбиты в INTEGRA: создание типов, справочников, начальных данных',
    category: 'data',
    tags: ['Орбиты', 'INTEGRA', 'Setup', 'Database']
  },
  '/orbity/tables': {
    description: 'Браузер таблиц базы данных Orbits на integram.io: просмотр всех таблиц, доступ к таблице Пользователей (ID: 18)',
    category: 'data',
    tags: ['Орбиты', 'Orbits', 'Tables', 'Database', 'Integram']
  },
  '/orbity/tables/:tableId': {
    description: 'Управление данными таблицы Orbits: просмотр, создание, редактирование и удаление записей с динамическими формами',
    category: 'data',
    tags: ['Орбиты', 'Orbits', 'CRUD', 'Forms', 'Data Management']
  },

  // Orbity Construction Management Routes
  '/orbity/construction': {
    description: 'Панель управления установкой витражей и окон: отслеживание заявок, планирование работ бригад, мониторинг эффективности',
    category: 'business',
    tags: ['Орбиты', 'Витражи', 'Окна', 'Строительство', 'Бригады', 'Управление проектами']
  },
  '/orbity/construction/requests': {
    description: 'Управление заявками заказчиков: обработка запросов на установку витражей и окон, оценка стоимости, назначение бригад',
    category: 'business',
    tags: ['Орбиты', 'Заявки', 'CRM', 'Заказчики', 'Установка окон']
  },
  '/orbity/construction/schedule': {
    description: 'Суточный план работ бригад: временная шкала задач, распределение по бригадам, контроль выполнения, документация',
    category: 'business',
    tags: ['Орбиты', 'План работ', 'Расписание', 'Бригады', 'Календарь']
  },
  '/orbity/construction/contractors': {
    description: 'Автоматический скоринг и подбор исполнителей: оценка бригад по качеству, срокам, безопасности, рекомендации по назначению',
    category: 'business',
    tags: ['Орбиты', 'Скоринг', 'Исполнители', 'Бригады', 'AI оценка', 'Подбор']
  },
  '/orbity/construction/brigades': {
    description: 'Управление бригадами установки витражей: состав команд, специализация, текущие задачи, статистика эффективности',
    category: 'business',
    tags: ['Орбиты', 'Бригады', 'Команды', 'HR', 'Управление персоналом']
  },
  '/orbity/task-scheduler': {
    description: 'Умный Планировщик Задач: автоматическое распределение задач между исполнителями с учётом квалификации, загрузки, приоритетов, зависимостей. Использует метод критического пути (CPM) и систему оценок для оптимального назначения задач.',
    category: 'automation',
    tags: ['Орбиты', 'Планировщик', 'Задачи', 'CPM', 'Распределение', 'Автоматизация', 'Управление проектами', 'Зависимости', 'Приоритеты']
  },
  '/integram/login': {
    description: 'Страница входа в Integram: аутентификация пользователей, регистрация, сброс пароля и вход через Google',
    category: 'auth',
    tags: ['Integram', 'Login', 'Authentication', 'Registration', 'Auth']
  },
  '/integram': {
    description: 'Главная страница Integram: навигация по базам данных, таблицам и инструментам управления данными',
    category: 'data',
    tags: ['Integram', 'Main', 'Home', 'Navigation']
  },
  '/integram/dict': {
    description: 'Словарь таблиц Integram: просмотр и управление типами объектов в базе данных Integram',
    category: 'data',
    tags: ['Integram', 'Database', 'Tables', 'Dictionary', 'Schema']
  },
  '/integram/object/:typeId': {
    description: 'Просмотр объектов определенного типа в Integram: управление экземплярами, фильтрация, создание и удаление',
    category: 'data',
    tags: ['Integram', 'Database', 'Objects', 'CRUD', 'Data Management']
  },
  '/integram/edit_obj/:objectId': {
    description: 'Редактирование объекта Integram: изменение значений и реквизитов объекта базы данных',
    category: 'data',
    tags: ['Integram', 'Database', 'Edit', 'Form', 'Data Entry']
  },
  '/integram/edit_types': {
    description: 'Редактор типов Integram: создание и настройка структуры типов объектов, управление реквизитами и связями',
    category: 'data',
    tags: ['Integram', 'Database', 'Schema', 'DDL', 'Type Editor']
  },
  '/integram/form/:formId?': {
    description: 'Формы Integram: ввод и редактирование данных через настраиваемые формы',
    category: 'data',
    tags: ['Integram', 'Forms', 'Data Entry', 'Input']
  },
  '/integram/myform': {
    description: 'Конструктор форм Integram: создание и настройка пользовательских форм для ввода данных',
    category: 'development',
    tags: ['Integram', 'Form Builder', 'No-Code', 'Forms']
  },
  '/integram/report/:reportId?': {
    description: 'Отчеты Integram: просмотр списка отчетов, выполнение и анализ отчетов с возможностью экспорта в Excel. Полнофункциональный интерфейс для работы с отчетами на основе данных из базы',
    category: 'analytics',
    tags: ['Integram', 'Reports', 'Analytics', 'Data Visualization', 'Excel Export', 'Business Intelligence']
  },
  '/integram/:database/requests': {
    description: 'Отчёты (новый интерфейс): современный список всех отчётов из базы данных с возможностью просмотра в виде сетки, таблицы или списка. Поиск, фильтрация, избранное, метаданные отчётов, пагинация и infinite scroll',
    category: 'analytics',
    tags: ['Integram', 'Reports', 'Request List', 'Grid View', 'Table View', 'Search', 'Favorites', 'Metadata', 'Modern UI']
  },
  '/integram/:database/requests/:request_id': {
    description: 'ALL-IN-ONE просмотрщик отчёта: исчерпывающий функционал для работы с отчётами. Объединяет ReportViewer, IntegramReport, IntegramReportViewer, IntegrationReportPage и SmartQ. Фильтрация, поиск, скрытие колонок, infinite scroll, inline редактирование, SQL редактор, параметры отчёта, экспорт (Excel, HTML, PDF), печать, компактный режим, контекстное меню',
    category: 'analytics',
    tags: ['Integram', 'Report Viewer', 'All-in-One', 'Filters', 'Search', 'Export', 'Excel', 'HTML', 'PDF', 'Print', 'Inline Edit', 'SQL Editor', 'SmartQ', 'Infinite Scroll', 'Context Menu', 'Parameters']
  },
  '/integram/sql': {
    description: 'SQL-редактор Integram: выполнение SQL-запросов к базе данных напрямую',
    category: 'development',
    tags: ['Integram', 'SQL', 'Database', 'Query', 'Developer Tools']
  },
  '/integram/smartq': {
    description: 'SmartQ (Умные запросы) Integram: интерактивные таблицы с отчётами из объектов типа 22. Фильтрация, сортировка, inline-редактирование, подсчёт итогов, пагинация',
    category: 'data',
    tags: ['Integram', 'SmartQ', 'Reports', 'Object 22', 'Interactive Tables', 'Query Builder', 'Filtering', 'Sorting', 'Inline Editing']
  },
  '/integram/smartq-viewer/:reportId?': {
    description: 'SmartQ Viewer (Вариант B) — полноценный просмотрщик SmartQ-отчётов с inline-редактированием всех типов полей (текст, число, дата, булево, ссылочные поля), созданием строк, drag-and-drop сортировкой, подсчётом sub-totals, правами доступа (sq-granted), экспортом в CSV/Excel',
    category: 'data',
    tags: ['Integram', 'SmartQ', 'Reports', 'Inline Editing', 'REFERENCE Fields', 'Drag-and-Drop', 'Sub-Totals', 'Access Rights', 'Export', 'Issue #6643']
  },
  '/integram/quiz/:quizId?': {
    description: 'Опросы и тесты Integram: создание и прохождение опросов, анкет и тестов',
    category: 'tools',
    tags: ['Integram', 'Quiz', 'Survey', 'Forms', 'Testing']
  },
  '/integram/upload': {
    description: 'Загрузка файлов Integram: массовая загрузка данных из Excel, CSV и других форматов',
    category: 'data',
    tags: ['Integram', 'Upload', 'Import', 'Excel', 'CSV', 'Data Import']
  },
  '/block-editor': {
    description: 'Блочный редактор документов: копия IntegramDocumentEditor с блочным хранением в kval БД через /api/doc-blocks API. HTML контент разбивается на блоки (heading, paragraph, list, code, mermaid) для гранулярного версионирования и diff-based синхронизации. Включает историю изменений с возможностью просмотра, восстановления и скачивания версий документа.',
    category: 'tools',
    tags: ['Block Editor', 'Document Editor', 'kval', 'Blocks', 'Quill', 'WYSIWYG', 'Version History']
  },
  '/integram-cards': {
    description: 'Карточный интерфейс Integram в стиле Coda.io: отображает строки любой таблицы Integram в виде красивых карточек с тремя режимами (сетка, список, галерея), поиском и фильтрацией. Поддерживает авторизацию по любой БД.',
    category: 'data',
    tags: ['Integram', 'Cards', 'Coda.io', 'DataView', 'Table View']
  },
  '/tech-pyramid': {
    description: 'Пирамида технологий — интерактивная SVG-визуализация технологического суверенитета России из БД ai2o.ru/tech. 9 категорий технологий, 45 технологий из TSM PDF стр.15, клик по точке открывает модальное окно с описанием.',
    category: 'visualization',
    tags: ['Technology', 'Pyramid', 'TSM', 'Visualization', 'SVG', 'Russia', 'Sovereignty']
  },
  '/integram-doc-editor': {
    description: 'Редактор документов Integram с Coda.io функциональностью и WebSocket поддержкой для совместного редактирования: продвинутый редактор с интеграцией Integram таблиц и отчётов, real-time collaborative editing с индикацией активных пользователей (Issue #6459, Issue #6465), 10+ Coda.io-inspired блоков (чеклисты, callout, колонки, интерактивные кнопки, прогресс-бары, toggle/accordion, цитаты, карточки, разделители, код с подсветкой), встраивание таблиц и отчётов из Integram БД, Quill.js редактор с расширенным форматированием, поддержка нескольких баз данных (my, a2025, ddadmin), современный интерфейс с PrimeVue компонентами, автосинхронизация изменений между пользователями',
    category: 'tools',
    tags: ['Integram', 'Document Editor', 'Coda.io', 'Building Blocks', 'Quill', 'Tables', 'Reports', 'WYSIWYG', 'Document Creation', 'WebSocket', 'Collaborative Editing', 'Real-time', 'User Presence', 'Issue #6444', 'Issue #6459', 'Issue #6465']
  },
  '/doc/:docId': {
    description: 'Публичная страница просмотра документа без авторизации: read-only просмотр опубликованных Integram документов для всех пользователей. Только документы со статусом "Опубликован" доступны публично, минимальный интерфейс без редактора и меню, автоматический рендеринг Mermaid-диаграмм и таблиц, чистый просмотр контента без необходимости регистрации (Issue #6962)',
    category: 'public',
    tags: ['Document View', 'Public', 'Read-only', 'No Auth', 'Published', 'Integram', 'Mermaid', 'Tables', 'Issue #6962']
  },
  '/forms': {
    description: 'Управление формами и анкетами: список всех созданных форм с возможностью создания, редактирования, просмотра и удаления. Статусы форм (черновик/активна), переход к конструктору форм, просмотр результатов опросов',
    category: 'tools',
    tags: ['Forms', 'Surveys', 'Questionnaires', 'Management', 'Integram', 'Issue #6885']
  },
  '/form-builder': {
    description: 'Конструктор форм и анкет: создание и редактирование форм с различными типами вопросов (короткий текст, длинный текст, число, дата, шкала оценки, да/нет, выбор одного, выбор нескольких, файл). Drag-and-drop переупорядочивание вопросов, предпросмотр формы, публикация и создание таблицы ответов в Integram, рассылка форм через Telegram/Email. Аналог Google Forms с хранением в Integram (Issue #6885)',
    category: 'tools',
    tags: ['Form Builder', 'Survey Creator', 'Question Types', 'Drag-and-drop', 'Integram', 'Google Forms', 'Distribution', 'Telegram', 'Email', 'Issue #6885']
  },
  '/form/:id': {
    description: 'Публичная страница заполнения формы: интерфейс для респондентов без необходимости авторизации. Адаптивный дизайн, валидация обязательных полей, отправка ответов в таблицу Integram, страница благодарности после отправки, поддержка персонализированных ссылок с токеном (Issue #6885)',
    category: 'public',
    tags: ['Form Fill', 'Public Form', 'Survey Response', 'No Auth', 'Responsive', 'Integram', 'Issue #6885']
  },
  '/integram-documents': {
    description: 'Список документов Integram: просмотр всех сохранённых документов из редактора Integram. Просмотр документов с фильтрацией по базе данных, сортировка по дате создания и изменения, открытие документов для редактирования, удаление документов, навигация к созданию нового документа',
    category: 'tools',
    tags: ['Integram', 'Documents', 'List', 'Document Management', 'Browse', 'Issue #6421']
  },
  '/integram/dir_admin': {
    description: 'Управление файлами Integram: просмотр, загрузка и управление файлами, прикрепленными к объектам',
    category: 'data',
    tags: ['Integram', 'Files', 'File Manager', 'Attachments']
  },
  '/integram/info': {
    description: 'Информация о системе Integram: статистика, версия, настройки базы данных',
    category: 'data',
    tags: ['Integram', 'Info', 'System', 'Statistics']
  },
  '/integram/:database/document-editor': {
    description: 'Редактор документов Integram: минималистичный WYSIWYG редактор с возможностью вставки таблиц и отчетов Integram напрямую в документ. Поддержка форматирования текста (жирный, курсив, списки, заголовки), вставка данных из Integram таблиц и отчетов, сохранение и экспорт в HTML. Идеален для создания документации, отчетов и аналитических материалов с живыми данными из базы',
    category: 'data',
    tags: ['Integram', 'Document Editor', 'WYSIWYG', 'Tables', 'Reports', 'Export', 'HTML', 'Rich Text']
  },
  '/integram/:database/mention-test': {
    description: 'Тестирование упоминаний пользователей (@mentions) в Integram: интерактивная страница для демонстрации функции упоминания пользователей из таблицы 18. Поддержка автодополнения при вводе @, отображение фото и имени пользователя, сохранение в формате @{database}_{userId}. Режимы редактирования и отображения, примеры для тестирования, live parsing упоминаний',
    category: 'data',
    tags: ['Integram', 'Mentions', 'User Mentions', 'Autocomplete', 'Testing', 'Demo', 'Interactive', '@mentions', 'User Tagging']
  },

  // Orbits Module Routes
  '/orbits': {
    description: 'База данных Orbits на Integram.io: управление таблицами и данными проекта Orbits с динамическими формами для всех таблиц',
    category: 'data',
    tags: ['Orbits', 'Integram', 'Database', 'Project Management', 'Data']
  },
  '/orbits/dict': {
    description: 'Словарь таблиц Orbits: просмотр всех таблиц в базе данных Orbits на integram.io',
    category: 'data',
    tags: ['Orbits', 'Dictionary', 'Tables', 'Database', 'Schema']
  },
  '/orbits/table/:id': {
    description: 'Просмотр и редактирование данных таблицы Orbits: CRUD операции, динамические формы, управление записями',
    category: 'data',
    tags: ['Orbits', 'Table', 'CRUD', 'Forms', 'Data Management']
  },

  '/survey': {
    description: 'Конструктор и прохождение опросов',
    category: 'tools',
    tags: ['Survey', 'Forms']
  },
  '/canban': {
    description: 'Канбан-доска для управления задачами',
    category: 'tools',
    tags: ['Kanban', 'Tasks', 'ProjectManagement']
  },
  '/dash': {
    description: 'Дашборд задач и проектов',
    category: 'tools',
    tags: ['Dashboard', 'Tasks']
  },
  '/block': {
    description: 'Блочный редактор контента',
    category: 'tools',
    tags: ['Editor', 'Blocks']
  },
  '/guest': {
    description: 'Гостевая страница для неавторизованных пользователей',
    category: 'public',
    tags: ['Guest', 'Public']
  },
  '/help': {
    description: 'Справка и поддержка пользователей',
    category: 'support',
    tags: ['Help', 'Support']
  },
  '/icons': {
    description: 'Библиотека иконок: 275,000+ иконок от Iconify, PrimeIcons и Font Awesome. Просмотр, поиск и копирование кода иконок для использования в проекте',
    category: 'design',
    tags: ['Icons', 'Design', 'UI', 'Iconify', 'PrimeIcons', 'Font Awesome']
  },
  '/iconify-example': {
    description: 'Интерактивные примеры использования Iconify: демонстрация работы с иконками из api.iconify.design, динамическое изменение размера и цвета, примеры кода',
    category: 'design',
    tags: ['Icons', 'Iconify', 'Examples', 'Tutorial', 'UI', 'Components']
  },
  '/notifications/demo': {
    description: 'Демонстрация системы уведомлений',
    category: 'demo',
    tags: ['Notifications', 'Demo']
  },
  '/graph-visualization': {
    description: 'Демонстрация расширенной визуализации графов с использованием D3.js: интерактивные графы, различные алгоритмы раскладки, анализ и экспорт',
    category: 'visualization',
    tags: ['D3.js', 'Graph', 'Visualization', 'Demo', 'Data Visualization', 'Network']
  },

  // Authentication routes
  '/login': {
    description: 'Страница авторизации пользователей',
    category: 'auth',
    tags: ['Auth', 'Login']
  },
  '/register': {
    description: 'Регистрация новых пользователей',
    category: 'auth',
    tags: ['Auth', 'Register']
  },
  '/email-verify': {
    description: 'Подтверждение email адреса после регистрации',
    category: 'auth',
    tags: ['Auth', 'Email Verification', 'Register']
  },
  '/auth/access': {
    description: 'Страница отказа в доступе',
    category: 'auth',
    tags: ['Auth', 'Access Denied']
  },
  '/auth/error': {
    description: 'Страница ошибки аутентификации',
    category: 'auth',
    tags: ['Auth', 'Error']
  },

  // Admin routes
  '/admin/login': {
    description: 'Вход в административную панель',
    category: 'admin',
    tags: ['Admin', 'Login']
  },
  '/admin/dashboard': {
    description: 'Административная панель управления',
    category: 'admin',
    tags: ['Admin', 'Dashboard']
  },
  '/admin/users': {
    description: 'Управление пользователями системы',
    category: 'admin',
    tags: ['Admin', 'Users']
  },
  '/admin/billing': {
    description: 'Управление биллингом и подписками',
    category: 'admin',
    tags: ['Admin', 'Billing']
  },
  '/admin/configuration': {
    description: 'Системная конфигурация платформы',
    category: 'admin',
    tags: ['Admin', 'Configuration']
  },
  '/admin/audit': {
    description: 'Журнал аудита действий пользователей',
    category: 'admin',
    tags: ['Admin', 'Audit', 'Security']
  },

  // Legal routes
  '/legal/terms-of-service': {
    description: 'Условия использования платформы',
    category: 'legal',
    tags: ['Legal', 'Terms']
  },
  '/legal/privacy-policy': {
    description: 'Политика конфиденциальности',
    category: 'legal',
    tags: ['Legal', 'Privacy']
  },
  '/legal/cookie-policy': {
    description: 'Политика использования cookies',
    category: 'legal',
    tags: ['Legal', 'Cookies']
  },
  '/legal/refund-policy': {
    description: 'Политика возврата средств',
    category: 'legal',
    tags: ['Legal', 'Refund']
  },
  '/legal/acceptable-use-policy': {
    description: 'Политика допустимого использования',
    category: 'legal',
    tags: ['Legal', 'AUP']
  },
  '/legal/dmca-policy': {
    description: 'Политика защиты авторских прав (DMCA)',
    category: 'legal',
    tags: ['Legal', 'DMCA', 'Copyright']
  },

  // Research: Scenario Development (Issue #2530 - НИР Этап 9)
  '/research/scenario-development': {
    description: 'НИР Этап 9: Разработка трёх сценариев развития рынка робототехники в строительстве на 2025-2030 гг. (негативный, нейтральный, позитивный) с обоснованными расчётами объёма рынка, уровня проникновения, CAGR. Интерактивные графики, сравнительные таблицы, экспорт в Excel/Word/PowerPoint. Сценарное прогнозирование с учётом макроэкономических, отраслевых, технологических и социальных факторов',
    category: 'analytics',
    tags: ['Research', 'НИР', 'Robotics', 'Construction', 'Scenario Planning', 'Market Forecast', 'CAGR', 'Analytics', 'Charts', 'Excel Export']
  },

  // НИР 4.0 Results Page (Issue #3301)
  '/research/nir40-results': {
    description: 'НИР 4.0: Комплексные результаты исследования применимости робототехники в строительстве РФ. Интерактивные визуализации: технологические зависимости (30 технологий, ТОП-10 критических), кластерный анализ рынка (5 сегментов, 20 компаний), белые пятна и приоритеты импортозамещения (15 направлений), дорожная карта развития 2025-2030 (3 фазы, 9.3 млрд ₽), нормативно-правовые аспекты. Графы зависимостей, таблицы с данными, диаграммы Chart.js, расчёты ROI 5.7x-8.8x',
    category: 'analytics',
    tags: ['Research', 'НИР 4.0', 'Robotics', 'Construction', 'Technology Dependencies', 'Market Clusters', 'Import Substitution', 'Roadmap', 'Data Visualization', 'Charts', 'Analytics', 'Regulatory', 'ROI']
  },

  // Orbity Platform Routes (Issue #2991 - Stage 2)
  '/orbity/registration': {
    description: 'Регистрация в платформе Орбиты: экосистема для заказчиков и исполнителей с прозрачным разделением труда, обучением на практике и справедливым вознаграждением. Выбор ролей (Заказчик, Исполнитель, Наставник, Руководитель), заполнение профиля, валидация данных',
    category: 'business',
    tags: ['Orbity', 'Registration', 'Labor', 'Ecosystem', 'Freelance', 'Project Management']
  },
  '/orbity/profile': {
    description: 'Профиль пользователя Орбиты: просмотр и редактирование персональной информации, отображение ролей, список навыков с уровнями (Стажер, Специалист, Мастер), история изменения ставки, финансовая сводка (баланс, заработанная сумма)',
    category: 'business',
    tags: ['Orbity', 'Profile', 'User Management', 'Skills', 'Finance']
  },
  '/orbity/profile/:userId': {
    description: 'Публичный профиль пользователя Орбиты: просмотр информации о другом пользователе, его навыки, рейтинг, отзывы',
    category: 'business',
    tags: ['Orbity', 'Profile', 'Public', 'User Info']
  },
  '/orbity/dashboard/executor': {
    description: 'Дашборд исполнителя Орбиты: текущая ставка и баланс, доступные задачи (топ-5 с фильтрацией), активные задачи с прогрессом, навыки и прогресс обучения, график доходов за 30 дней, AI-рекомендации по обучению. Быстрые действия: поиск задач, управление навыками, финансы',
    category: 'business',
    tags: ['Orbity', 'Dashboard', 'Executor', 'Tasks', 'Skills', 'Income', 'Learning']
  },
  '/orbity/dashboard/customer': {
    description: 'Дашборд заказчика Орбиты: список проектов с прогрессом, статистика (всего проектов, активных, завершенных, бюджет израсходован), список лучших исполнителей по рейтингу, финансовая сводка (бюджет, затраты, экономия), последние обновления, создание нового проекта',
    category: 'business',
    tags: ['Orbity', 'Dashboard', 'Customer', 'Projects', 'Budget', 'Executors', 'Finance']
  },
  '/orbity/projects': {
    description: 'Список проектов Орбиты: управление проектами заказчика, просмотр прогресса, статистика выполнения задач, управление командой, фильтрация и поиск',
    category: 'business',
    tags: ['Orbity', 'Projects', 'Management', 'Tasks', 'Team']
  },
  '/orbity/projects/create': {
    description: 'Создание нового проекта в Орбиты: заполнение данных проекта, описание задач, установка бюджета и сроков',
    category: 'business',
    tags: ['Orbity', 'Projects', 'Create', 'Management']
  },
  '/orbity/projects/:projectId': {
    description: 'Детали проекта Орбиты: подробная информация о проекте, список задач, команда исполнителей, прогресс выполнения, финансовые данные',
    category: 'business',
    tags: ['Orbity', 'Projects', 'Details', 'Tasks', 'Team']
  },
  '/orbity/tasks': {
    description: 'Список задач Орбиты: управление задачами, фильтрация по статусу и типу, поиск, назначение исполнителей',
    category: 'business',
    tags: ['Orbity', 'Tasks', 'Management', 'Execution']
  },
  '/orbity/tasks/create': {
    description: 'Создание новой задачи в Орбиты: заполнение данных задачи, выбор типа, требуемые навыки, установка сроков',
    category: 'business',
    tags: ['Orbity', 'Tasks', 'Create', 'Management']
  },
  '/orbity/tasks/:taskId': {
    description: 'Детали задачи Орбиты: подробная информация о задаче, исполнитель, наставник, прогресс выполнения, контроль качества',
    category: 'business',
    tags: ['Orbity', 'Tasks', 'Details', 'Quality Control']
  },
  '/orbity/skills': {
    description: 'Каталог навыков Орбиты: список доступных навыков, видеоинструкции, уровни владения, добавление навыков в профиль',
    category: 'business',
    tags: ['Orbity', 'Skills', 'Learning', 'Training', 'Catalog']
  },

  // Orbity Extended Routes (Issue #3470)
  '/orbity/users': {
    description: 'Управление пользователями Орбиты: список пользователей, ролей, ФИО, Email, статус, дата регистрации, связь с ролями и навыками',
    category: 'business',
    tags: ['Orbity', 'Users', 'Management', 'Administration', 'Roles']
  },
  '/orbity/roles': {
    description: 'Управление ролями Орбиты: справочник ролей (Заказчик, Исполнитель, Наставник, Руководитель), описание, приоритет',
    category: 'business',
    tags: ['Orbity', 'Roles', 'Administration', 'Access Control']
  },
  '/orbity/skill-categories': {
    description: 'Категории навыков Орбиты: группировка навыков (Разработка, Дизайн, Маркетинг, Управление, Тестирование)',
    category: 'business',
    tags: ['Orbity', 'Skills', 'Categories', 'Organization']
  },
  '/orbity/skill-levels': {
    description: 'Уровни навыков Орбиты: Стажер (коэфф. времени 2.0, оплаты 0.5), Специалист (1.0, 1.0), Мастер (0.7, 1.5)',
    category: 'business',
    tags: ['Orbity', 'Skills', 'Levels', 'Expertise', 'Compensation']
  },
  '/orbity/user-skills': {
    description: 'Навыки пользователей Орбиты: управление навыками каждого пользователя с уровнем владения, количество выполнений, дата получения',
    category: 'business',
    tags: ['Orbity', 'Skills', 'Users', 'Progress', 'Training']
  },
  '/orbity/task-executions': {
    description: 'Выполнение задач Орбиты: назначение и отслеживание выполнения задач исполнителями, наставники для стажеров, контроль качества, фактическое время',
    category: 'business',
    tags: ['Orbity', 'Tasks', 'Execution', 'Quality Control', 'Mentoring']
  },
  '/orbity/mentoring': {
    description: 'Наставничество Орбиты: связи наставник-стажер по конкретным навыкам, количество занятий, статус наставничества (Активно, Завершено, Приостановлено)',
    category: 'business',
    tags: ['Orbity', 'Mentoring', 'Training', 'Skills', 'Learning']
  },
  '/orbity/rates': {
    description: 'Ставки Орбиты: история изменения ставок пользователей (руб/час), причины изменения, даты установки',
    category: 'business',
    tags: ['Orbity', 'Finance', 'Rates', 'Compensation', 'History']
  },
  '/orbity/transactions': {
    description: 'Транзакции Орбиты: финансовые операции пользователей (Оплата за работу, Пассивный доход, Вывод средств, Пополнение), статусы, связь с задачами',
    category: 'business',
    tags: ['Orbity', 'Finance', 'Transactions', 'Payments', 'Income']
  },
  '/orbity/video-instructions': {
    description: 'Видеоинструкции Орбиты: обучающие видеоматериалы по навыкам, длительность, автор, ссылки на видео',
    category: 'business',
    tags: ['Orbity', 'Learning', 'Video', 'Training', 'Education']
  },
  '/orbity/tech-improvements': {
    description: 'Технологические улучшения Орбиты: предложения по улучшению процессов и технологий, улучшение нормативов, количество применений, статус одобрения',
    category: 'business',
    tags: ['Orbity', 'Improvements', 'Innovation', 'Optimization', 'Passive Income']
  },

  '/smartq/:reportId?': {
    description: 'SmartQ (устаревший маршрут) - перенаправляет на /integram/smartq. Используйте /integram/smartq для доступа к SmartQ редактору',
    category: 'data',
    tags: ['SmartQ', 'Redirect', 'Legacy', 'Deprecated']
  },

  // Financial Research (Dexter-style Agent)
  '/financial-research': {
    description: 'FinancialResearchAgent: AI-powered финансовый анализ российских компаний и рынков. Multi-agent архитектура (Planner → Executor → Validator → Synthesizer) вдохновлённая Dexter. Источники: ЕГРЮЛ (данные компании), ФССП (задолженности), MOEX (котировки), ЦБ РФ (курсы валют). Loop detection и self-validation для автономной работы.',
    category: 'analytics',
    tags: ['Финансы', 'Аналитика', 'MOEX', 'ЕГРЮЛ', 'ФССП', 'ЦБ РФ', 'Курсы валют', 'Котировки', 'AI Agent', 'Company Analysis', 'Dexter', 'Multi-Agent']
  },

  '/access': {
    description: 'Страница управления доступом: вход в систему, восстановление пароля, управление правами доступа пользователей',
    category: 'auth',
    tags: ['Access', 'Auth', 'Login', 'Permissions']
  },

  '/admin': {
    description: 'Панель администратора: управление пользователями, системные настройки, мониторинг сервисов, управление базами данных и конфигурациями платформы',
    category: 'admin',
    tags: ['Admin', 'Panel', 'Settings', 'Users', 'System']
  },

  '/agent-system-test': {
    description: 'Тестирование агентной системы: проверка работоспособности AI-агентов, тестовые сценарии выполнения задач, диагностика интеграций с LLM провайдерами',
    category: 'development',
    tags: ['Testing', 'Agents', 'System Test', 'Diagnostics']
  },

  '/agent-templates': {
    description: 'Шаблоны AI-агентов: библиотека готовых конфигураций агентов для типовых задач (аналитика, обработка данных, мониторинг), быстрое создание агентов на основе шаблонов',
    category: 'agents',
    tags: ['Templates', 'Agents', 'Presets', 'Quick Start']
  },

  '/agents': {
    description: 'Каталог AI-агентов: динамическая библиотека агентов из базы данных Integram, поиск и фильтрация по категориям, запуск и управление агентами, мониторинг статуса',
    category: 'agents',
    tags: ['Agents', 'Catalog', 'Hub', 'AI', 'Spaces']
  },

  '/agents/lead-qualification': {
    description: 'Редирект на агент квалификации лидов (/agents/leads): автоматическая оценка и скоринг потенциальных клиентов',
    category: 'agents',
    tags: ['Lead Qualification', 'Scoring', 'Sales', 'Redirect']
  },

  '/agents/purchase-journey-testing': {
    description: 'Агент тестирования пути покупки: автоматическая проверка всех этапов customer journey от первого контакта до конверсии',
    category: 'automation',
    tags: ['Purchase Journey', 'Testing', 'E2E', 'Customer Journey']
  },

  '/agriculture': {
    description: 'Модуль сельского хозяйства: управление полями, мониторинг вегетации (NDVI), планирование с/х операций с БПЛА, учёт урожая, заказы услуг аэрообработки',
    category: 'agriculture',
    tags: ['Agriculture', 'Fields', 'NDVI', 'Harvest', 'UAV', 'Farming']
  },

  '/auth.asp': {
    description: 'OAuth callback для Integram: обработка авторизации через протокол OAuth при входе в систему Integram (ai2o.ru)',
    category: 'auth',
    tags: ['OAuth', 'Integram', 'Auth', 'Callback']
  },

  '/customer-support-agent': {
    description: 'Редирект на агент поддержки клиентов (/support): AI-ассистент для обработки обращений и тикетов',
    category: 'agents',
    tags: ['Support', 'Customer Service', 'Tickets', 'Redirect']
  },

  '/error': {
    description: 'Страница ошибки: отображение информации об ошибке (403, 404, 500) с возможностью возврата на главную страницу',
    category: 'other',
    tags: ['Error', '404', '403', '500', 'Not Found']
  },

  '/integram-browser': {
    description: 'Браузер баз данных Integram: просмотр и управление таблицами, объектами и реквизитами в базах данных ai2o.ru (my, kval, tech и др.)',
    category: 'data',
    tags: ['Integram', 'Browser', 'Database', 'Tables', 'ai2o.ru']
  },

  '/integram/api-docs': {
    description: 'Документация Integram API: справочник эндпоинтов, форматы запросов/ответов, примеры использования Integram REST API и MCP инструментов',
    category: 'documentation',
    tags: ['Integram', 'API', 'Documentation', 'Reference', 'MCP']
  },

  '/lead-scorer': {
    description: 'Редирект на скоринг лидов (/agents/leads): AI-оценка потенциальных клиентов по критериям готовности к покупке',
    category: 'agents',
    tags: ['Lead Scorer', 'Scoring', 'Sales', 'Redirect']
  },

  '/my': {
    description: 'Вход в Integram: авторизация в системе Integram через логин/пароль, выбор сервера (ai2o.ru), управление сессией',
    category: 'auth',
    tags: ['Integram', 'Login', 'Auth', 'my', 'Session']
  },

  '/oauth-callback': {
    description: 'OAuth callback: обработка возврата от OAuth-провайдеров (GitHub, Google) после авторизации, обмен кода на токен доступа',
    category: 'auth',
    tags: ['OAuth', 'Callback', 'GitHub', 'Google', 'Auth']
  },

  '/support/tickets': {
    description: 'Редирект на тикеты поддержки (/support): система обращений пользователей, отслеживание статуса заявок',
    category: 'support',
    tags: ['Support', 'Tickets', 'Help Desk', 'Redirect']
  },

  '/visual-agent-builder': {
    description: 'Визуальный конструктор AI-агентов: drag-and-drop интерфейс для создания агентов, настройка промптов, выбор моделей и инструментов, визуальная цепочка действий',
    category: 'agents',
    tags: ['Visual Builder', 'Agent', 'No-Code', 'Drag-and-Drop', 'AI']
  },

  '/vtb-card-pdn': {
    description: 'ВТБ Карточка ПДн: workflow система согласования процессов обработки персональных данных, маршруты утверждения, статусы карточек',
    category: 'business',
    tags: ['VTB', 'ВТБ', 'ПДн', 'Card', 'Workflow', 'Approval']
  },

  '/workspace-management-example': {
    description: 'Пример управления workspace: демонстрация возможностей API workspace — создание, конфигурация, управление файлами и настройками проекта',
    category: 'demo',
    tags: ['Workspace', 'Example', 'Demo', 'Management', 'API']
  },

  // Issue #6956: Irkutsk redirect — user-to-table routing stub
  '/irkutsk': {
    description: 'Страница-заглушка для перенаправления пользователей Иркутска на соответствующую таблицу в /integram/kval/table/{tableId}. Когда маппинг user.id → tableId будет настроен, пользователи будут автоматически перенаправляться на нужную таблицу.',
    category: 'other',
    tags: ['Иркутск', 'Redirect', 'Integram', 'Kval', 'Stub']
  },

  // Issue #7195: Geo Layer — объекты онтологии на интерактивной карте
  '/geo-objects': {
    description: 'Интерактивная карта объектов онтологии БАС: 26 центров НПЦ БАС по всей России и дроны из базы данных Integram. Leaflet + OSM тайлы, геокодирование через Nominatim, боковая панель со списком объектов и попап с деталями.',
    category: 'maps',
    tags: ['Карта', 'НПЦ БАС', 'Дроны', 'Геолокация', 'Leaflet', 'OSM', 'Nominatim', 'Онтология', 'Issue #7195']
  }
}

/**
 * Get description for a route path
 * @param {string} path - Route path
 * @returns {object|null} Route description object or null
 */
export function getRouteDescription(path) {
  // Try exact match first
  if (routeDescriptions[path]) {
    return routeDescriptions[path]
  }

  // Try to match parameterized routes
  for (const [routePath, description] of Object.entries(routeDescriptions)) {
    if (routePath.includes(':')) {
      const regex = new RegExp('^' + routePath.replace(/:[^/]+/g, '[^/]+') + '$')
      if (regex.test(path)) {
        return description
      }
    }
  }

  return null
}

/**
 * Get all route categories
 * @returns {Array<string>} Array of unique categories
 */
export function getRouteCategories() {
  const categories = new Set()
  Object.values(routeDescriptions).forEach(desc => {
    categories.add(desc.category)
  })
  return Array.from(categories).sort()
}

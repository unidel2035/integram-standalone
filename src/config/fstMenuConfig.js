// FST Platform — меню навигации
// SVG icons from Lucide (free, MIT license) for items missing in PrimeIcons
// Size: 1.25rem (20px) to match PrimeIcons font-size

const svgHandshake = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>'

const svgLeaf = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'

// Lucide: layers (digital twin — слои/дублирование)
const svgLayers = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>'

// Lucide: arrow-right-left (secondary market — обмен/торговля)
const svgArrowRightLeft = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>'

// Lucide: door-open (инвестиционный выход, не logout)
const svgDoorOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>'

// Lucide: banknotes (гранты — денежное финансирование)
const svgBanknotes = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>'

// Lucide: scale (юридика — весы правосудия)
const svgScale = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>'

// Lucide: network (синдикация — сеть соинвесторов)
const svgNetwork = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>'

// Lucide: circle-user-round (совет директоров — пользователь в круге)
const svgCircleUserRound = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>'

// Lucide: clipboard-pen (форма заявки — заполнение формы)
const svgClipboardPen = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5.5"/><path d="M4 13.5V6a2 2 0 0 1 2-2h2"/><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>'

// Lucide: file-chart-column-increasing (ILPA-отчёты — документ с финграфиком)
const svgFileChart = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-2"/><path d="M12 18v-4"/><path d="M16 18v-6"/></svg>'

// Lucide: book-open-text (Реестр ПП-1726 — открытый документ)
const svgBookOpenText = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M16 12h2"/><path d="M16 8h2"/><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'

// Lucide: landmark (GR-панель — госструктура/капитолий)
const svgLandmark = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>'

// Lucide: shield-check (AML/KYC — комплаенс/проверка)
const svgShieldCheck = '<svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>'

// roles[] — список ролей, которым виден пункт меню.
// Пустой массив или отсутствие поля = видят все.
// Если у пользователя fullMenuMode=true (admin) — видит всё.

// ─── Меню для роли present (Гордин) — только самое нужное ───────────────────
export const presentMenuConfig = [
  {
    label: 'Презентация',
    icon: 'pi pi-play-circle',
    roles: ['present'],
    items: [
      { label: 'Телесуфлёр',       icon: 'pi pi-play-circle', to: '/fst-present',     roles: ['present'] },
      { label: 'Инвесткомитет',    icon: 'pi pi-users',       to: '/fst-committee',   roles: ['present'] },
      { label: 'Портфель',         icon: 'pi pi-briefcase',   to: '/fst-portfolio',   roles: ['present'] },
      { label: 'Суверенность',     icon: 'pi pi-shield',      to: '/fst-sovereignty', roles: ['present'] },
      { label: 'Цифровой двойник', icon: 'pi pi-building',    to: '/fst-fund',        roles: ['present'] },
    ]
  }
]

export const fstMenuConfig = [
  {
    label: 'Обзор',
    icon: 'pi pi-eye',
    items: [
      { label: 'Главная',      icon: 'pi pi-home',     to: '/fst-hub' },
      { label: 'Command Center', icon: 'pi pi-sitemap', to: '/fst-cc', roles: ['director', 'analyst', 'admin'] },
      { label: 'Портфель',     icon: 'pi pi-briefcase', to: '/fst-portfolio', roles: ['investor', 'director', 'analyst', 'admin'] },
      { label: 'Digital Twin', svgIcon: svgLayers,      to: '/fst-twin',      roles: ['director', 'analyst', 'admin'] },
    ]
  },
  {
    label: 'Сделки',
    svgIcon: svgHandshake,
    items: [
      { label: 'Аватар Эксперта',    icon: 'pi pi-user-edit', to: '/fst-expert',    roles: ['investor', 'expert', 'director', 'admin'] },
      { label: 'Факторная модель',   icon: 'pi pi-chart-bar', to: '/fst-factor',      roles: ['investor', 'expert', 'director', 'analyst', 'admin'] },
      { label: 'Событийный граф',    icon: 'pi pi-share-alt', to: '/fst-event-graph', roles: ['director', 'analyst', 'admin'] },
      { label: 'Инвесткомитет',      icon: 'pi pi-users',     to: '/fst-committee', roles: ['investor', 'expert', 'director', 'admin'] },
      { label: 'Конвейер ПП-1→6',    icon: 'pi pi-map',       to: '/fst-pipeline',  roles: ['director', 'analyst', 'admin'] },
      { label: 'Дилфлоу',           icon: 'pi pi-filter',    to: '/fst-dealflow',  roles: ['investor', 'director', 'analyst', 'admin'] },
      { label: 'Меморандум',         icon: 'pi pi-file',      to: '/fst-memo',      roles: ['investor', 'director', 'admin'] },
      { label: 'Сделка',             svgIcon: svgHandshake,   to: '/fst-deal',      roles: ['director', 'analyst', 'admin'] },
      { label: 'Совет директоров',   svgIcon: svgCircleUserRound, to: '/fst-board', roles: ['director', 'admin'] },
      { label: 'Стартапер',          icon: 'pi pi-rocket',    to: '/fst-startuper', roles: ['startup', 'director', 'admin'] },
    ]
  },
  {
    label: 'Финансы',
    icon: 'pi pi-wallet',
    roles: ['investor', 'director', 'analyst', 'admin'],
    items: [
      { label: 'LP Кабинет',       icon: 'pi pi-wallet',        to: '/fst-lp',         roles: ['investor', 'director', 'admin'] },
      { label: 'Cap Table',         icon: 'pi pi-table',          to: '/fst-captable',   roles: ['director', 'analyst', 'admin'] },
      { label: 'Secondary Market',  svgIcon: svgArrowRightLeft,   to: '/fst-secondary',  roles: ['investor', 'director', 'admin'] },
      { label: 'Водопад',           icon: 'pi pi-chart-bar',      to: '/fst-waterfall',  roles: ['director', 'analyst', 'admin'] },
      { label: 'Выход',             svgIcon: svgDoorOpen,         to: '/fst-exit',       roles: ['director', 'analyst', 'admin'] },
      { label: 'Бенчмарк',         icon: 'pi pi-chart-line',     to: '/fst-benchmark',  roles: ['analyst', 'director', 'admin'] },
    ]
  },
  {
    label: 'Аналитика',
    icon: 'pi pi-chart-pie',
    roles: ['investor', 'expert', 'director', 'analyst', 'admin'],
    items: [
      { label: 'ESG',          svgIcon: svgLeaf,         to: '/fst-esg',         roles: ['investor', 'director', 'analyst', 'admin'] },
      { label: 'Суверенитет',  icon: 'pi pi-shield',     to: '/fst-sovereignty', roles: ['investor', 'expert', 'director', 'analyst', 'admin'] },
      { label: 'Нацпроект',    icon: 'pi pi-flag',       to: '/fst-natproject',  roles: ['director', 'admin'] },
      { label: 'GR-панель',    svgIcon: svgLandmark,     to: '/fst-gov',         roles: ['director', 'admin'] },
      { label: 'Agent Room',   icon: 'pi pi-comments',   to: '/fst-room',        roles: ['director', 'analyst', 'admin'] },
    ]
  },
  {
    label: 'Инфраструктура',
    icon: 'pi pi-server',
    roles: ['investor', 'director', 'analyst', 'admin'],
    items: [
      { label: 'ILPA-отчёты',    svgIcon: svgFileChart,    to: '/fst-ilpa',         roles: ['investor', 'director', 'admin'] },
      { label: 'AML/KYC',        svgIcon: svgShieldCheck,  to: '/fst-compliance',   roles: ['director', 'admin'] },
      { label: 'Гранты',         svgIcon: svgBanknotes,    to: '/fst-grants',       roles: ['startup', 'director', 'admin'] },
      { label: 'Синдикация',     svgIcon: svgNetwork,      to: '/fst-syndication',  roles: ['investor', 'director', 'admin'] },
      { label: 'Due Diligence',  icon: 'pi pi-search',     to: '/fst-duediligence', roles: ['analyst', 'director', 'admin'] },
      { label: 'Юридика',        svgIcon: svgScale,        to: '/fst-legal',        roles: ['director', 'admin'] },
      { label: 'Реестр ПП-1726', svgIcon: svgBookOpenText, to: '/fst-registry',     roles: ['director', 'admin'] },
      { label: 'Биллинг',        icon: 'pi pi-credit-card', to: '/fst-billing',     roles: ['director', 'admin'] },
    ]
  },
  {
    label: 'Подача заявок',
    svgIcon: svgClipboardPen,
    roles: ['startup', 'admin'],
    items: [
      { label: 'Форма заявки', svgIcon: svgClipboardPen, to: '/fst-apply', roles: ['startup', 'admin'] },
    ]
  },
  {
    label: 'Обучение',
    icon: 'pi pi-graduation-cap',
    items: [
      { label: 'Центр обучения', icon: 'pi pi-graduation-cap',   to: '/fst-dev-guide', roles: ['admin'] },
      { label: 'Глоссарий',     icon: 'pi pi-book',              to: '/fst-glossary' },
      { label: 'Мой прогресс',  icon: 'pi pi-chart-line',        to: '/fst-learning-progress' },
      { label: 'Начать тур',    icon: 'pi pi-map',               action: 'show-tours-menu', special: true },
      { label: 'Мини-квизы',    icon: 'pi pi-question-circle',   to: '/fst-quiz' },
      { label: 'Школа агентов', icon: 'pi pi-star',              to: '/fst-school', roles: ['director', 'analyst', 'admin'] },
      { label: 'Claude CLI',    icon: 'pi pi-code',              to: '/fst-terminal', roles: ['director', 'admin'] },
      { label: 'Курс разработчика', icon: 'pi pi-book',         to: '/fst-dev-course', roles: ['admin'] },
      { label: 'Режим презентации', icon: 'pi pi-play-circle',  to: '/fst-present', roles: ['director', 'admin'] },
    ]
  }
]

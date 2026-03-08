// FST Platform — меню навигации
// SVG icons from Lucide (free, MIT license) for items missing in PrimeIcons

const svgHandshake = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>'
const svgLeaf = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'

export const fstMenuConfig = [
  {
    label: 'Обзор',
    items: [
      { label: 'Главная', icon: 'pi pi-home', to: '/fst-hub' },
      { label: 'Портфель', icon: 'pi pi-briefcase', to: '/fst-portfolio' },
      { label: 'Digital Twin', icon: 'pi pi-chart-line', to: '/fst-twin' },
    ]
  },
  {
    label: 'Сделки',
    items: [
      { label: 'Дилфлоу', icon: 'pi pi-filter', to: '/fst-dealflow' },
      { label: 'Меморандум', icon: 'pi pi-file-word', to: '/fst-memo' },
      { label: 'Инвесткомитет', icon: 'pi pi-users', to: '/fst-committee' },
      { label: 'Сделка', svgIcon: svgHandshake, to: '/fst-deal' },
      { label: 'Совет директоров', icon: 'pi pi-sitemap', to: '/fst-board' },
    ]
  },
  {
    label: 'Финансы',
    items: [
      { label: 'LP Кабинет', icon: 'pi pi-wallet', to: '/fst-lp' },
      { label: 'Cap Table', icon: 'pi pi-table', to: '/fst-captable' },
      { label: 'Secondary Market', icon: 'pi pi-refresh', to: '/fst-secondary' },
      { label: 'Водопад', icon: 'pi pi-chart-bar', to: '/fst-waterfall' },
      { label: 'Выход', icon: 'pi pi-sign-out', to: '/fst-exit' },
      { label: 'Бенчмарк', icon: 'pi pi-chart-scatter', to: '/fst-benchmark' },
    ]
  },
  {
    label: 'Аналитика',
    items: [
      { label: 'ESG', svgIcon: svgLeaf, to: '/fst-esg' },
      { label: 'Суверенитет', icon: 'pi pi-shield', to: '/fst-sovereignty' },
      { label: 'Нацпроект', icon: 'pi pi-flag', to: '/fst-natproject' },
      { label: 'GR-панель', icon: 'pi pi-building', to: '/fst-gov' },
    ]
  },
  {
    label: 'Инфраструктура',
    items: [
      { label: 'ILPA-отчёты', icon: 'pi pi-file-pdf', to: '/fst-ilpa' },
      { label: 'AML/KYC', icon: 'pi pi-verified', to: '/fst-compliance' },
      { label: 'Гранты', icon: 'pi pi-gift', to: '/fst-grants' },
      { label: 'Синдикация', icon: 'pi pi-share-alt', to: '/fst-syndication' },
      { label: 'Due Diligence', icon: 'pi pi-search', to: '/fst-duediligence' },
      { label: 'Юридика', icon: 'pi pi-book', to: '/fst-legal' },
      { label: 'Реестр ПП-1726', icon: 'pi pi-server', to: '/fst-registry' },
    ]
  },
  {
    label: 'Подача заявок',
    items: [
      { label: 'Форма заявки', icon: 'pi pi-send', to: '/fst-apply' },
    ]
  },
  {
    label: 'Обучение',
    items: [
      { label: 'Путь обучения', icon: 'pi pi-graduation-cap', to: '/fst-dev-guide' },
      { label: 'Туры по модулям', icon: 'pi pi-map', action: 'show-tours-menu', special: true },
      { label: 'Глоссарий', icon: 'pi pi-book', to: '/fst-glossary' },
      { label: 'Мини-квизы', icon: 'pi pi-check-circle', to: '/fst-quiz' },
      { label: 'Школа агентов', icon: 'pi pi-star', to: '/fst-school' },
    ]
  }
]

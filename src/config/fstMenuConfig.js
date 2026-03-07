// FST Platform — меню навигации
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
      { label: 'Сделка', icon: 'pi pi-handshake', to: '/fst-deal' },
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
      { label: 'ESG', icon: 'pi pi-leaf', to: '/fst-esg' },
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
      { label: 'Туры по модулям', icon: 'pi pi-map', action: 'show-tours-menu', special: true },
      { label: 'Глоссарий', icon: 'pi pi-book', to: '/fst-glossary' },
      { label: 'Мини-квизы', icon: 'pi pi-check-circle', to: '/fst-quiz' },
    ]
  }
]

/**
 * Mock Data Service for DirInvest Clone
 * This service provides sample data from dirinvest.ru for development purposes
 * Will be replaced with Integram integration once database permissions are granted
 */

export const mockPlatforms = [
  { id: 1, name: 'STAT' },
  { id: 2, name: 'OTCM' },
  { id: 3, name: 'FINM' },
  { id: 4, name: 'BBOX' },
  { id: 5, name: 'ZORK' },
  { id: 6, name: 'BIZM' },
  { id: 7, name: 'AVRA' },
  { id: 8, name: 'ZPSK' }
]

export const mockSecurityTypes = [
  { id: 1, name: 'Обык' },
  { id: 2, name: 'Прив' }
]

export const mockDealTypes = [
  { id: 1, name: 'Перв.' },
  { id: 2, name: 'Втор.' }
]

export const mockIndustries = [
  { id: 1, code: 'K', name: 'Финансы и страхование (K)' },
  { id: 2, code: 'J', name: 'Информация, информационные технологии и связь (J)' },
  { id: 3, code: 'G', name: 'Торговля (G)' },
  { id: 4, code: 'M', name: 'Деятельность профессиональная, научная и техническая (M)' },
  { id: 5, code: 'A', name: 'Сельское хозяйство (A)' },
  { id: 6, code: 'STU', name: 'Другое (S,T,U)' },
  { id: 7, code: 'C', name: 'Обрабатывающие производства (C)' },
  { id: 8, code: 'F', name: 'Строительство (F)' },
  { id: 9, code: 'L', name: 'Операции с недвижимостью (L)' },
  { id: 10, code: 'H', name: 'Транспортировка и хранение (H)' },
  { id: 11, code: 'DE', name: 'Коммунальные услуги (D,E)' },
  { id: 12, code: 'B', name: 'Добыча полезных ископаемых (B)' }
]

export const mockRegions = [
  { id: 1, name: 'Москва' },
  { id: 2, name: 'Санкт-Петербург' },
  { id: 3, name: 'Удмуртская республика' },
  { id: 4, name: 'Свердловская область' },
  { id: 5, name: 'Тюменская область' },
  { id: 6, name: 'Татарстан, республика' },
  { id: 7, name: 'Крым, республика' },
  { id: 8, name: 'Калужская область' },
  { id: 9, name: 'Оренбургская область' },
  { id: 10, name: 'Пензенская область' },
  { id: 11, name: 'Самарская область' },
  { id: 12, name: 'Курганская область' },
  { id: 13, name: 'Краснодарский край' }
]

export const mockCompanies = [
  {
    id: 1,
    inn: '9703226086',
    name: 'АО "СУПРИКС"',
    brand: '',
    yearFounded: 2025,
    regionId: 1,
    industryId: 1,
    securityTypeId: 1,
    dealTypeId: 2,
    platformId: 1,
    revenue: 0,
    psRatio: 0,
    peRatio: 0,
    pbRatio: 0,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: null
  },
  {
    id: 2,
    inn: '9705187393',
    name: 'АО "НОВАЯ ЭНЕРГИЯ"',
    brand: 'Hyper',
    yearFounded: 2022,
    regionId: 1,
    industryId: 1,
    securityTypeId: 1,
    dealTypeId: 2,
    platformId: 2,
    revenue: 37221,
    psRatio: 16,
    peRatio: -37,
    pbRatio: 2,
    charterCapital: 57900000,
    ordinarySharesCount: 5790000,
    preferredSharesCount: 0,
    registrar: 'АО "Статус"',
    telegramLink: null
  },
  {
    id: 3,
    inn: '9703225798',
    name: 'АО "ВОСХОД - АМТЕХ"',
    brand: '',
    yearFounded: 2025,
    regionId: 1,
    industryId: 1,
    securityTypeId: 1,
    dealTypeId: 1,
    platformId: 7,
    revenue: 0,
    psRatio: 0,
    peRatio: 0,
    pbRatio: 0,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/951'
  },
  {
    id: 4,
    inn: '9703211682',
    name: 'АО "ЛО"',
    brand: '',
    yearFounded: 2025,
    regionId: 1,
    industryId: 2,
    securityTypeId: 2,
    dealTypeId: 1,
    platformId: 3,
    revenue: 0,
    psRatio: 0,
    peRatio: 0,
    pbRatio: 0,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/899'
  },
  {
    id: 5,
    inn: '1800017862',
    name: 'АО "РОЛЬ КАПИТАЛ"',
    brand: '',
    yearFounded: 2024,
    regionId: 3,
    industryId: 2,
    securityTypeId: 2,
    dealTypeId: 2,
    platformId: 1,
    revenue: 0,
    psRatio: 0,
    peRatio: -381,
    pbRatio: -421,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: null
  },
  {
    id: 6,
    inn: '7838130843',
    name: 'АО "РЕНТИФЛАЙ"',
    brand: '',
    yearFounded: 2025,
    regionId: 2,
    industryId: 2,
    securityTypeId: 1,
    dealTypeId: 2,
    platformId: 1,
    revenue: 17,
    psRatio: 48,
    peRatio: 155,
    pbRatio: 126,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/883'
  },
  {
    id: 7,
    inn: '9721258852',
    name: 'АО "МУВТУПЛЭЙ ИНВЕСТ"',
    brand: '',
    yearFounded: 2025,
    regionId: 1,
    industryId: 2,
    securityTypeId: 1,
    dealTypeId: 1,
    platformId: 4,
    revenue: 0,
    psRatio: 0,
    peRatio: 0,
    pbRatio: 0,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/961'
  },
  {
    id: 8,
    inn: '9721231748',
    name: 'АО "ПЛЮС"',
    brand: '',
    yearFounded: 2024,
    regionId: 1,
    industryId: 2,
    securityTypeId: 1,
    dealTypeId: 2,
    platformId: 2,
    revenue: 5988286,
    psRatio: 2,
    peRatio: -25,
    pbRatio: 1,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: null
  },
  {
    id: 9,
    inn: '7810969879',
    name: 'АО "ФЛИП"',
    brand: '',
    yearFounded: 2024,
    regionId: 2,
    industryId: 2,
    securityTypeId: 2,
    dealTypeId: 2,
    platformId: 1,
    revenue: 993,
    psRatio: 369,
    peRatio: -68,
    pbRatio: 13,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/885'
  },
  {
    id: 10,
    inn: '9734019435',
    name: 'АО "ОФЕРТА24"',
    brand: '',
    yearFounded: 2025,
    regionId: 1,
    industryId: 2,
    securityTypeId: 2,
    dealTypeId: 1,
    platformId: 3,
    revenue: 0,
    psRatio: 0,
    peRatio: 0,
    pbRatio: 0,
    charterCapital: 0,
    ordinarySharesCount: 0,
    preferredSharesCount: 0,
    registrar: '',
    telegramLink: 'https://t.me/news_spin/966'
  }
]

export const mockOrders = [
  // АО "НОВАЯ ЭНЕРГИЯ" orders
  {
    id: 1,
    companyId: 2,
    type: 'sell',
    price: 4195.00,
    quantity: 143,
    platformId: 1,
    date: new Date('2025-12-15')
  },
  {
    id: 2,
    companyId: 2,
    type: 'sell',
    price: 2000.00,
    quantity: 10,
    platformId: 1,
    date: new Date('2025-12-15')
  },
  {
    id: 3,
    companyId: 2,
    type: 'sell',
    price: 900.00,
    quantity: 69,
    platformId: 1,
    date: new Date('2025-12-15')
  },
  {
    id: 4,
    companyId: 2,
    type: 'sell',
    price: 600.00,
    quantity: 500,
    platformId: 1,
    date: new Date('2025-12-15')
  },
  {
    id: 5,
    companyId: 2,
    type: 'sell',
    price: 105.00,
    quantity: 256,
    platformId: 2,
    date: new Date('2025-12-15')
  },
  {
    id: 6,
    companyId: 2,
    type: 'buy',
    price: 103.90,
    quantity: 256,
    platformId: 2,
    date: new Date('2025-12-15')
  }
]

export const mockEvents = [
  {
    id: 1,
    title: 'Финансовый рынок. Итоги года',
    description: '',
    date: new Date('2025-12-04T10:00:00'),
    image: 'https://via.placeholder.com/400x200',
    eventLink: 'https://events.kommersant.ru/events/finansovyj-rynok-2025-itogi-goda',
    status: 'past'
  },
  {
    id: 2,
    title: 'Investment Leaders Forum & Award',
    description: '',
    date: new Date('2025-11-30T10:00:00'),
    image: 'https://via.placeholder.com/400x200',
    eventLink: 'https://investleaders.pro/',
    status: 'past'
  },
  {
    id: 3,
    title: 'PROFIT CONF 5.0',
    description: '',
    date: new Date('2025-11-29T10:00:00'),
    image: 'https://via.placeholder.com/400x200',
    eventLink: 'https://profitconf.ru/',
    status: 'past'
  }
]

export const mockNews = [
  {
    id: 1,
    title: 'Новый проект "Оферта24"',
    text: 'На российском рынке акций непубличных компаний появился новый эмитент АО "Оферта24". Привилегированные акции эмитента выставлены на продажу на платформе Финмастер.',
    date: new Date('2025-12-06'),
    companyId: 10
  },
  {
    id: 2,
    title: 'Новый эмитент "Аракай курорты"',
    text: 'На российском рынке акций непубличных компаний появился новый эмитент АО "Аракай курорты". Привилегированные акции эмитента выставлены на продажу на платформе Бизмолл.',
    date: new Date('2025-12-04'),
    companyId: null
  },
  {
    id: 3,
    title: 'Новый эмитент "Экоресурспереработка"',
    text: 'На российском рынке акций непубличных компаний появился новый эмитент АО "Экоресурсопереработка". Привилегированные акции эмитента выставлены на продажу на платформе Финмастер.',
    date: new Date('2025-12-02'),
    companyId: null
  }
]

/**
 * Get all companies with denormalized lookup data
 */
export function getCompaniesWithLookups() {
  return mockCompanies.map(company => ({
    ...company,
    region: mockRegions.find(r => r.id === company.regionId)?.name || '',
    industry: mockIndustries.find(i => i.id === company.industryId)?.name || '',
    securityType: mockSecurityTypes.find(s => s.id === company.securityTypeId)?.name || '',
    dealType: mockDealTypes.find(d => d.id === company.dealTypeId)?.name || '',
    platform: mockPlatforms.find(p => p.id === company.platformId)?.name || ''
  }))
}

/**
 * Get company by ID with denormalized data
 */
export function getCompanyById(id) {
  const company = mockCompanies.find(c => c.id === parseInt(id))
  if (!company) return null

  return {
    ...company,
    region: mockRegions.find(r => r.id === company.regionId)?.name || '',
    industry: mockIndustries.find(i => i.id === company.industryId)?.name || '',
    securityType: mockSecurityTypes.find(s => s.id === company.securityTypeId)?.name || '',
    dealType: mockDealTypes.find(d => d.id === company.dealTypeId)?.name || '',
    platform: mockPlatforms.find(p => p.id === company.platformId)?.name || ''
  }
}

/**
 * Get orders for a company
 */
export function getCompanyOrders(companyId) {
  return mockOrders
    .filter(order => order.companyId === parseInt(companyId))
    .map(order => ({
      ...order,
      platform: mockPlatforms.find(p => p.id === order.platformId)?.name || ''
    }))
}

/**
 * Filter companies by criteria
 */
export function filterCompanies(filters) {
  let filtered = [...mockCompanies]

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.inn.includes(searchLower)
    )
  }

  if (filters.revenue && filters.revenue !== 'any') {
    if (filters.revenue === 'none') {
      filtered = filtered.filter(c => c.revenue === 0)
    } else if (filters.revenue === 'under100m') {
      filtered = filtered.filter(c => c.revenue > 0 && c.revenue < 100000)
    } else if (filters.revenue === 'over100m') {
      filtered = filtered.filter(c => c.revenue >= 100000)
    }
  }

  if (filters.securityType && filters.securityType !== 'any') {
    filtered = filtered.filter(c => c.securityTypeId === parseInt(filters.securityType))
  }

  if (filters.dealType && filters.dealType !== 'any') {
    filtered = filtered.filter(c => c.dealTypeId === parseInt(filters.dealType))
  }

  if (filters.hideNoRevenue) {
    filtered = filtered.filter(c => c.revenue > 0)
  }

  return filtered.map(company => ({
    ...company,
    region: mockRegions.find(r => r.id === company.regionId)?.name || '',
    industry: mockIndustries.find(i => i.id === company.industryId)?.name || '',
    securityType: mockSecurityTypes.find(s => s.id === company.securityTypeId)?.name || '',
    dealType: mockDealTypes.find(d => d.id === company.dealTypeId)?.name || '',
    platform: mockPlatforms.find(p => p.id === company.platformId)?.name || ''
  }))
}

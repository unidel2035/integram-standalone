/**
 * ЕГРЮЛ/ЕФРСБ Parser
 *
 * Парсинг данных из ЕГРЮЛ (реестр юрлиц) и ЕФРСБ (реестр банкротств)
 * для мониторинга изменений в портфельных компаниях
 *
 * Источники:
 * - ЕГРЮЛ API: https://egrul.nalog.ru/
 * - ЕФРСБ: https://fedresurs.ru/
 *
 * Использует SOCKS5 прокси (127.0.0.1:9050) для анонимности
 */

import { SocksProxyAgent } from 'socks-proxy-agent'
import fetch from 'node-fetch'

const SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://127.0.0.1:9050'
const EGRUL_BASE_URL = 'https://egrul.nalog.ru'
const EFRSB_BASE_URL = 'https://fedresurs.ru/backend'

/**
 * Парсинг данных компании из ЕГРЮЛ по ИНН
 * @param {string} inn - ИНН компании
 * @returns {Promise<Object>} Данные компании из ЕГРЮЛ
 */
export async function fetchEgrulData(inn) {
  try {
    const agent = new SocksProxyAgent(SOCKS_PROXY)

    // Используем публичный API ЕГРЮЛ
    const searchUrl = `${EGRUL_BASE_URL}/search-result/${inn}`

    const response = await fetch(searchUrl, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    })

    if (!response.ok) {
      console.warn(`[EGRUL] Failed to fetch data for INN ${inn}: ${response.status}`)
      return null
    }

    const data = await response.json()

    return parseEgrulResponse(data, inn)
  } catch (error) {
    console.error(`[EGRUL] Error fetching data for INN ${inn}:`, error.message)
    return null
  }
}

/**
 * Парсинг ответа ЕГРЮЛ и извлечение релевантных данных
 */
function parseEgrulResponse(data, inn) {
  if (!data || !data.rows || data.rows.length === 0) {
    return { inn, found: false }
  }

  const company = data.rows[0]

  return {
    inn,
    found: true,
    name: company.n || company.name || '',
    ogrn: company.o || company.ogrn || '',
    registrationDate: company.r || company.regDate || null,
    address: company.a || company.address || '',
    ceo: company.g || company.director || '',
    status: company.s || company.status || 'active',
    lastUpdate: new Date().toISOString(),
    changes: detectChanges(company)
  }
}

/**
 * Детектирование изменений в данных компании
 */
function detectChanges(company) {
  const changes = []

  // Проверяем поля на наличие признаков изменения
  if (company.addressChangeDate) {
    changes.push({
      type: 'address',
      date: company.addressChangeDate,
      description: 'Изменение адреса юрлица'
    })
  }

  if (company.directorChangeDate) {
    changes.push({
      type: 'ceo',
      date: company.directorChangeDate,
      description: 'Смена директора'
    })
  }

  if (company.capitalChangeDate) {
    changes.push({
      type: 'capital',
      date: company.capitalChangeDate,
      description: 'Изменение уставного капитала'
    })
  }

  return changes
}

/**
 * Проверка наличия компании в реестре банкротств ЕФРСБ
 * @param {string} inn - ИНН компании
 * @returns {Promise<Object>} Данные о банкротстве (если есть)
 */
export async function checkBankruptcy(inn) {
  try {
    const agent = new SocksProxyAgent(SOCKS_PROXY)

    const searchUrl = `${EFRSB_BASE_URL}/companies?searchString=${inn}`

    const response = await fetch(searchUrl, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    })

    if (!response.ok) {
      return { inn, hasBankruptcy: false }
    }

    const data = await response.json()

    if (!data || !data.pageData || data.pageData.length === 0) {
      return { inn, hasBankruptcy: false }
    }

    // Проверяем наличие процедур банкротства
    const bankruptcyRecords = data.pageData.filter(record =>
      record.type === 'bankruptcy' || record.status === 'bankrupt'
    )

    if (bankruptcyRecords.length === 0) {
      return { inn, hasBankruptcy: false }
    }

    return {
      inn,
      hasBankruptcy: true,
      bankruptcyDate: bankruptcyRecords[0].date,
      bankruptcyStatus: bankruptcyRecords[0].status,
      message: `Обнаружена процедура банкротства (${bankruptcyRecords.length} записей)`,
      details: bankruptcyRecords.slice(0, 3) // Первые 3 записи
    }
  } catch (error) {
    console.error(`[ЕФРСБ] Error checking bankruptcy for INN ${inn}:`, error.message)
    return { inn, hasBankruptcy: false, error: error.message }
  }
}

/**
 * Мониторинг изменений для списка компаний
 * @param {Array<Object>} companies - Массив компаний с полями {id, name, inn}
 * @returns {Promise<Array<Object>>} Массив результатов с данными и изменениями
 */
export async function monitorCompanies(companies) {
  console.log(`[EGRUL Monitor] Starting monitoring for ${companies.length} companies`)

  const results = []

  for (const company of companies) {
    try {
      console.log(`[EGRUL Monitor] Processing ${company.name} (INN: ${company.inn})`)

      // Получаем данные из ЕГРЮЛ
      const egrulData = await fetchEgrulData(company.inn)

      // Проверяем банкротство
      const bankruptcyData = await checkBankruptcy(company.inn)

      const result = {
        companyId: company.id,
        companyName: company.name,
        inn: company.inn,
        timestamp: new Date().toISOString(),
        egrul: egrulData,
        bankruptcy: bankruptcyData,
        alerts: []
      }

      // Генерируем алерты при обнаружении изменений
      if (egrulData && egrulData.changes && egrulData.changes.length > 0) {
        result.alerts.push({
          level: 'warn',
          type: 'egrul_changes',
          message: `Обнаружены изменения в ЕГРЮЛ: ${egrulData.changes.map(c => c.description).join(', ')}`
        })
      }

      if (bankruptcyData && bankruptcyData.hasBankruptcy) {
        result.alerts.push({
          level: 'critical',
          type: 'bankruptcy',
          message: bankruptcyData.message
        })
      }

      results.push(result)

      // Небольшая задержка между запросами для избежания блокировок
      await sleep(2000)

    } catch (error) {
      console.error(`[EGRUL Monitor] Error processing ${company.name}:`, error.message)
      results.push({
        companyId: company.id,
        companyName: company.name,
        inn: company.inn,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  console.log(`[EGRUL Monitor] Completed monitoring. Found ${results.filter(r => r.alerts && r.alerts.length > 0).length} alerts`)

  return results
}

/**
 * Утилита для задержки
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  fetchEgrulData,
  checkBankruptcy,
  monitorCompanies
}

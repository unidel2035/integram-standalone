/**
 * Construction GOST Reference Service
 * Справочник ГОСТ для болтов, гаек, шайб и стальных профилей
 */

import gostBoltsData from '../../data/construction/gost-bolts.json'
import gostNutsData from '../../data/construction/gost-nuts.json'
import gostWashersData from '../../data/construction/gost-washers.json'
import steelProfilesData from '../../data/construction/steel-profiles.json'

// Маппинг диаметра отверстия → размер болта
const holeToBoltMap = gostBoltsData.hole_to_bolt_map

/**
 * Определить размер болта по диаметру отверстия
 * @param {number} holeDiameter - Диаметр отверстия, мм
 * @returns {string|null} Размер болта (напр. "M20") или null
 */
export function getBoltSizeByHole(holeDiameter) {
  const rounded = Math.round(holeDiameter)
  return holeToBoltMap[String(rounded)] || null
}

/**
 * Подобрать длину болта по толщине пакета
 * @param {string} boltSize - Размер болта (напр. "M20")
 * @param {number} packageThickness - Толщина пакета, мм
 * @param {string} connectionType - "normal" или "high_strength"
 * @returns {number|null} Стандартная длина болта, мм
 */
export function selectBoltLength(boltSize, packageThickness, connectionType = 'normal') {
  const gostKey = connectionType === 'high_strength' ? 'ГОСТ 22353-77' : 'ГОСТ 7798-70'
  const nutGostKey = connectionType === 'high_strength' ? 'ГОСТ 22354-77' : 'ГОСТ 5915-70'
  const washerGostKey = connectionType === 'high_strength' ? 'ГОСТ 22355-77' : 'ГОСТ 11371-78'

  const boltData = gostBoltsData[gostKey]?.sizes?.[boltSize]
  if (!boltData) return null

  const sizeNum = boltSize.replace('M', '')
  const nutHeight = gostNutsData[nutGostKey]?.sizes?.[boltSize]?.H || 0
  const washerThickness = gostWashersData[washerGostKey]?.sizes?.[sizeNum]?.thickness || 0

  // L ≥ толщина пакета + высота гайки + 2×толщина шайбы + 3мм запас
  const minLength = packageThickness + nutHeight + 2 * washerThickness + 3

  // Округляем до ближайшего стандартного размера вверх
  const availableLengths = boltData.lengths
  for (const len of availableLengths) {
    if (len >= minLength) return len
  }

  // Если ни одна стандартная длина не подходит, берём максимальную
  return availableLengths[availableLengths.length - 1]
}

/**
 * Получить полный комплект крепежа на 1 болт
 * @param {string} boltSize - Размер болта
 * @param {number} packageThickness - Толщина пакета, мм
 * @param {string} connectionType - "normal" или "high_strength" (фрикционное)
 * @returns {Object} Комплект { bolt, nut, washers }
 */
export function getBoltAssembly(boltSize, packageThickness, connectionType = 'normal') {
  const isHS = connectionType === 'high_strength' || connectionType === 'friction'
  const boltGost = isHS ? 'ГОСТ 22353-77' : 'ГОСТ 7798-70'
  const nutGost = isHS ? 'ГОСТ 22354-77' : 'ГОСТ 5915-70'
  const washerGost = isHS ? 'ГОСТ 22355-77' : 'ГОСТ 11371-78'
  const type = isHS ? 'high_strength' : 'normal'

  const length = selectBoltLength(boltSize, packageThickness, type)
  const sizeNum = boltSize.replace('M', '')

  const boltData = gostBoltsData[boltGost]?.sizes?.[boltSize]
  const nutData = gostNutsData[nutGost]?.sizes?.[boltSize]
  const washerData = gostWashersData[washerGost]?.sizes?.[sizeNum]

  const boltWeight = boltData?.weight_per_100?.[String(length)]
    ? boltData.weight_per_100[String(length)] / 100
    : 0

  return {
    bolt: {
      gost: boltGost.replace('ГОСТ ', ''),
      size: `${boltSize}×${length}`,
      diameter: boltSize,
      length,
      qty: 1,
      weight: Math.round(boltWeight * 10000) / 10000,
      strengthClass: isHS ? '10.9' : '8.8'
    },
    nut: {
      gost: nutGost.replace('ГОСТ ', ''),
      size: boltSize,
      qty: 1,
      weight: nutData?.weight_1pc || 0
    },
    washers: {
      gost: washerGost.replace('ГОСТ ', ''),
      size: sizeNum,
      qty: 2,
      weight: washerData?.weight_1pc ? Math.round(washerData.weight_1pc * 2 * 10000) / 10000 : 0
    },
    totalWeight() {
      return Math.round((this.bolt.weight + this.nut.weight + this.washers.weight) * 10000) / 10000
    }
  }
}

/**
 * Рассчитать ведомость крепежа для списка узлов
 * @param {Array} nodes - Массив узлов из AI анализа
 * @returns {Object} { items: [...], summary: { totalBolts, totalNuts, totalWashers, totalWeight } }
 */
export function calculateBoltSchedule(nodes) {
  const items = []
  let totalBolts = 0
  let totalNuts = 0
  let totalWashers = 0
  let totalWeight = 0

  for (const node of nodes) {
    const { bolts, packageThickness, connectionType } = node
    if (!bolts?.count || !bolts?.diameter) continue

    const assembly = getBoltAssembly(bolts.diameter, packageThickness || 30, connectionType || 'normal')

    const nodeItem = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      connectionType: connectionType || 'normal',
      profiles: node.profiles || [],
      bolt: {
        ...assembly.bolt,
        qty: bolts.count,
        totalWeight: Math.round(assembly.bolt.weight * bolts.count * 10000) / 10000
      },
      nut: {
        ...assembly.nut,
        qty: bolts.count,
        totalWeight: Math.round(assembly.nut.weight * bolts.count * 10000) / 10000
      },
      washers: {
        ...assembly.washers,
        qty: bolts.count * 2,
        totalWeight: Math.round(assembly.washers.weight * bolts.count * 10000) / 10000
      }
    }
    nodeItem.totalWeight = Math.round(
      (nodeItem.bolt.totalWeight + nodeItem.nut.totalWeight + nodeItem.washers.totalWeight) * 10000
    ) / 10000

    items.push(nodeItem)

    totalBolts += bolts.count
    totalNuts += bolts.count
    totalWashers += bolts.count * 2
    totalWeight += nodeItem.totalWeight
  }

  return {
    items,
    summary: {
      totalBolts,
      totalNuts,
      totalWashers,
      totalWeight: Math.round(totalWeight * 100) / 100
    }
  }
}

/**
 * Найти профиль по названию
 * @param {string} profileName - Название профиля (напр. "30Б1", "20П", "L100x8")
 * @returns {Object|null} Данные профиля
 */
export function findProfile(profileName) {
  const name = profileName.trim()

  // Двутавры
  if (steelProfilesData.i_beams.profiles[name]) {
    return { type: 'i_beam', name, ...steelProfilesData.i_beams.profiles[name] }
  }

  // Швеллеры
  if (steelProfilesData.channels.profiles[name]) {
    return { type: 'channel', name, ...steelProfilesData.channels.profiles[name] }
  }

  // Уголки
  if (steelProfilesData.angles.profiles[name]) {
    return { type: 'angle', name, ...steelProfilesData.angles.profiles[name] }
  }

  return null
}

/**
 * Получить все доступные профили по типу
 * @param {'i_beam'|'channel'|'angle'} type
 * @returns {Array}
 */
export function getProfilesByType(type) {
  const map = {
    i_beam: steelProfilesData.i_beams,
    channel: steelProfilesData.channels,
    angle: steelProfilesData.angles
  }
  const data = map[type]
  if (!data) return []
  return Object.entries(data.profiles).map(([name, props]) => ({ name, ...props }))
}

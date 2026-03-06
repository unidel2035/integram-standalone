/**
 * Integram Map Data Service
 *
 * Loads map data (markers/points with coordinates) from any Integram database.
 * Supports hierarchical object structures (objects → sub-objects → coordinate points).
 *
 * Works with both direct coordinate fields and nested sub-tables.
 */

import integramApiClient from '@/services/integramApiClient'
import { parseCoordinatePair, detectCoordinateFormat } from '@/utils/coordinateParser'
import { logger } from '@/utils/logger'

/**
 * @typedef {Object} MapDataSource
 * @property {string} database - Database name (e.g., 'kval', 'a2025')
 * @property {number} objectsTypeId - Main objects type ID
 * @property {number} [pointsTypeId] - Points sub-table type ID (for nested structures)
 * @property {number} latReqId - Latitude requisite ID
 * @property {number} lngReqId - Longitude requisite ID
 * @property {number} [labelReqId] - Optional label/name requisite ID
 * @property {number} [parentObjectId] - Optional parent filter
 * @property {number} [intermediateTypeId] - Intermediate sub-table (for 3-level hierarchy)
 * @property {string} [coordFormat] - 'decimal' | 'dms' | 'auto'
 */

/**
 * @typedef {Object} MapMarkerData
 * @property {number} lat - Latitude in decimal degrees
 * @property {number} lng - Longitude in decimal degrees
 * @property {string} [label] - Display label
 * @property {string} color - Marker color
 * @property {number} [objectId] - Source object ID in the database
 * @property {number} [parentId] - Parent object ID
 */

/**
 * Load map markers from an Integram database.
 *
 * Supports two structures:
 * 1. Flat: objectsTypeId has lat/lng fields directly
 * 2. Nested: objectsTypeId → [intermediateTypeId] → pointsTypeId (with lat/lng)
 *
 * @param {MapDataSource} dataSource - Data source configuration
 * @returns {Promise<MapMarkerData[]>} Array of parsed markers
 */
export async function loadMapMarkers(dataSource) {
  const {
    database,
    objectsTypeId,
    pointsTypeId,
    latReqId,
    lngReqId,
    labelReqId,
    parentObjectId,
    intermediateTypeId,
    coordFormat = 'auto',
    selectorName,
    selectorReqId,
    selectorValue,
    selectorTypeId,
    markerTypeReqId = null,  // req ID for "Тип объекта": Точка/Линия/Полигон/Высотный объект
    radiusReqId = null,       // req ID for "Радиус" (NUMBER)
    heightReqId = null        // req ID for "Высота" (NUMBER)
  } = dataSource

  logger.info('[IntegramMapData] Loading markers', { database, objectsTypeId, pointsTypeId, selectorName, selectorValue })

  // Ensure we're authenticated for the target database
  // Always call switchDatabase — it caches tokens, so repeated calls are cheap.
  // Skipping based on currentDatabase alone can miss cases where
  // currentDatabase was set (via setDatabase) but token exchange hasn't happened yet.
  try {
    await integramApiClient.switchDatabase(database)
  } catch (switchErr) {
    logger.warn('[IntegramMapData] switchDatabase failed, trying with current token', switchErr.message)
  }

  const markers = []

  try {
    // Load main objects
    const params = { LIMIT: 200, F_U: 1 }
    if (parentObjectId) {
      params.F_U = parentObjectId
    }

    // Selector filter: add server-side filter param
    // Resolve effective reqId: use configured selectorReqId, or auto-detect from selectorTypeId
    let effectiveSelectorReqId = selectorReqId
    if (selectorValue && !effectiveSelectorReqId && selectorTypeId) {
      // Auto-detect: find reference field in objectsType that points to selectorTypeId
      // Note: getTypeMetadata().reqs only has arr_id for sub-tables, not reference fields.
      // Reference fields (type 8/REFERENCE) show up in getObjectList response as ref_type map.
      try {
        const sampleData = await integramApiClient.getObjectList(objectsTypeId, { LIMIT: 1 })
        const refTypeMap = sampleData.ref_type || {}
        const matchingReqId = Object.keys(refTypeMap).find(reqId => String(refTypeMap[reqId]) === String(selectorTypeId))
        if (matchingReqId) {
          effectiveSelectorReqId = matchingReqId
          logger.info(`[IntegramMapData] Auto-detected selectorReqId=${effectiveSelectorReqId} for typeId=${selectorTypeId}`)
        } else {
          logger.warn(`[IntegramMapData] No ref field found in type ${objectsTypeId} pointing to ${selectorTypeId}`)
        }
      } catch (metaErr) {
        logger.warn('[IntegramMapData] Could not auto-detect selectorReqId:', metaErr.message)
      }
    }

    if (selectorValue && effectiveSelectorReqId) {
      if (effectiveSelectorReqId === '__val__') {
        params['F_N'] = selectorValue  // filter by name/val field
      } else {
        params[`F_${effectiveSelectorReqId}`] = selectorValue  // filter by requisite
      }
      logger.info(`[IntegramMapData] Selector filter applied: F_${effectiveSelectorReqId}=${selectorValue}`)
    }

    const objectsData = await integramApiClient.getObjectList(objectsTypeId, params)
    const objects = objectsData.object || objectsData.objects || []

    if (!objects.length) {
      logger.warn('[IntegramMapData] No objects found for type', objectsTypeId)
      return []
    }

    logger.info(`[IntegramMapData] Found ${objects.length} objects`)

    if (!pointsTypeId) {
      // Flat structure: lat/lng are direct fields on objects
      for (const obj of objects) {
        const reqs = objectsData.reqs?.[obj.id] || {}
        const latVal = reqs[latReqId]
        const lngVal = reqs[lngReqId]
        const label = labelReqId ? (reqs[labelReqId] || obj.val) : obj.val

        const coords = parseCoordinatePair(latVal, lngVal)
        if (coords) {
          markers.push({
            lat: coords.lat,
            lng: coords.lng,
            label: stripHtml(label),
            color: '#ff0000',
            objectId: parseInt(obj.id),
            parentId: null
          })
        }
      }
    } else {
      // Nested structure: traverse sub-objects to find coordinate points
      for (const obj of objects) {
        const objectId = parseInt(obj.id)
        const objectLabel = stripHtml(obj.val)

        // Read type/radius/height from parent object requisites
        const objReqs = objectsData.reqs?.[obj.id] || {}
        const markerTypeVal = markerTypeReqId ? (objReqs[String(markerTypeReqId)] || null) : null
        const radius = radiusReqId ? (parseFloat(objReqs[String(radiusReqId)]) || null) : null
        const height = heightReqId ? (parseFloat(objReqs[String(heightReqId)]) || null) : null

        // Map string type value to internal drawing type
        let drawingType = 'marker'
        if (markerTypeVal === 'Линия') drawingType = 'curve'
        else if (markerTypeVal === 'Высотный объект') drawingType = 'height-marker'
        else if (markerTypeVal === 'Полигон') drawingType = 'polygon'
        else if (markerTypeVal === 'Точка') drawingType = 'marker'
        else if (height && !markerTypeVal) drawingType = 'height-marker'

        try {
          const pointMarkers = await loadPointsForObject(
            objectId, objectLabel, pointsTypeId, latReqId, lngReqId,
            intermediateTypeId, coordFormat,
            { drawingType, radius, height }
          )
          markers.push(...pointMarkers)
        } catch (err) {
          logger.warn(`[IntegramMapData] Error loading points for object ${objectId}:`, err.message)
        }
      }
    }

    logger.info(`[IntegramMapData] Loaded ${markers.length} markers total`)
    return markers

  } catch (err) {
    logger.error('[IntegramMapData] Error loading map data:', err)
    throw err
  }
}

/**
 * Load coordinate points for a single parent object.
 * Handles both 2-level (object → points) and 3-level (object → intermediate → points) hierarchies.
 */
async function loadPointsForObject(
  objectId, objectLabel, pointsTypeId, latReqId, lngReqId,
  intermediateTypeId, coordFormat,
  extra = {}
) {
  const { drawingType = 'marker', radius = null, height = null } = extra

  // Choose color based on drawing type
  const color = drawingType === 'curve' ? '#3388ff'
    : drawingType === 'height-marker' ? '#ff8800'
    : '#ff0000'

  const markers = []

  if (intermediateTypeId) {
    // 3-level: object → intermediate → points
    const intermediateData = await integramApiClient.getObjectList(intermediateTypeId, {
      F_U: objectId, LIMIT: 100
    })
    const intermediates = intermediateData.object || []

    for (const inter of intermediates) {
      const interLabel = stripHtml(inter.val)
      const pointsData = await integramApiClient.getObjectList(pointsTypeId, {
        F_U: inter.id, LIMIT: 500
      })
      const points = pointsData.object || []

      for (const pt of points) {
        const reqs = pointsData.reqs?.[pt.id] || {}
        const latVal = reqs[latReqId]
        const lngVal = reqs[lngReqId]

        const coords = parseCoordinatePair(latVal, lngVal)
        if (coords) {
          markers.push({
            lat: coords.lat,
            lng: coords.lng,
            label: `${objectLabel} / ${interLabel} / ${stripHtml(pt.val)}`,
            color,
            objectId: parseInt(pt.id),
            parentId: objectId,
            drawingType,
            radius,
            height
          })
        }
      }
    }
  } else {
    // 2-level: object → points
    const pointsData = await integramApiClient.getObjectList(pointsTypeId, {
      F_U: objectId, LIMIT: 500
    })
    const points = pointsData.object || []

    for (const pt of points) {
      const reqs = pointsData.reqs?.[pt.id] || {}
      const latVal = reqs[latReqId]
      const lngVal = reqs[lngReqId]

      const coords = parseCoordinatePair(latVal, lngVal)
      if (coords) {
        markers.push({
          lat: coords.lat,
          lng: coords.lng,
          label: `${objectLabel} / ${stripHtml(pt.val)}`,
          color,
          objectId: parseInt(pt.id),
          parentId: objectId,
          drawingType,
          radius,
          height
        })
      }
    }
  }

  return markers
}

/**
 * Auto-discover coordinate fields in a type's metadata.
 * Looks for requisites named Широта/Долгота, lat/lng, latitude/longitude, etc.
 *
 * @param {number} typeId - Type ID to inspect
 * @returns {Promise<{ latReqId: number|null, lngReqId: number|null, subTypes: Array }>}
 */
export async function discoverCoordinateFields(typeId) {
  const metadata = await integramApiClient.getTypeMetadata(typeId)

  const latPatterns = /широта|latitude|lat|шир/i
  const lngPatterns = /долгота|longitude|lng|lon|долг/i

  let latReqId = null
  let lngReqId = null
  const subTypes = []

  const reqs = metadata.reqs || []
  for (const req of reqs) {
    const name = req.val || ''

    if (latPatterns.test(name)) {
      latReqId = parseInt(req.id)
    } else if (lngPatterns.test(name)) {
      lngReqId = parseInt(req.id)
    }

    // Collect sub-table types (arr_id means it's an array/sub-table)
    if (req.arr_id) {
      subTypes.push({
        reqId: parseInt(req.id),
        typeId: parseInt(req.arr_id),
        name: name
      })
    }
  }

  return { latReqId, lngReqId, subTypes, typeName: metadata.val, reqs }
}

/**
 * Recursively discover coordinate fields through sub-tables.
 *
 * @param {number} typeId - Root type ID
 * @param {number} [maxDepth=3] - Maximum recursion depth
 * @returns {Promise<Object>} Discovery result with path to coordinate fields
 */
export async function deepDiscoverCoordinateFields(typeId, maxDepth = 3) {
  const result = await discoverCoordinateFields(typeId)

  if (result.latReqId && result.lngReqId) {
    // Found directly on this type
    return {
      found: true,
      objectsTypeId: typeId,
      pointsTypeId: null,
      intermediateTypeId: null,
      latReqId: result.latReqId,
      lngReqId: result.lngReqId,
      path: [{ typeId, name: result.typeName }]
    }
  }

  if (maxDepth <= 0 || result.subTypes.length === 0) {
    return { found: false, objectsTypeId: typeId, subTypes: result.subTypes, reqs: result.reqs }
  }

  // Search sub-types recursively
  for (const sub of result.subTypes) {
    const subResult = await deepDiscoverCoordinateFields(sub.typeId, maxDepth - 1)
    if (subResult.found) {
      // Determine intermediate vs direct
      if (subResult.pointsTypeId === null) {
        // Direct sub-table has coordinates
        return {
          found: true,
          objectsTypeId: typeId,
          pointsTypeId: sub.typeId,
          intermediateTypeId: null,
          latReqId: subResult.latReqId,
          lngReqId: subResult.lngReqId,
          path: [{ typeId, name: result.typeName }, ...subResult.path]
        }
      } else {
        // Sub-sub-table has coordinates (3-level)
        return {
          found: true,
          objectsTypeId: typeId,
          pointsTypeId: subResult.pointsTypeId,
          intermediateTypeId: sub.typeId,
          latReqId: subResult.latReqId,
          lngReqId: subResult.lngReqId,
          path: [{ typeId, name: result.typeName }, ...subResult.path]
        }
      }
    }
  }

  return {
    found: false,
    objectsTypeId: typeId,
    subTypes: result.subTypes,
    reqs: result.reqs,
    typeName: result.typeName
  }
}

/**
 * Create a new point object in the database.
 *
 * @param {MapDataSource} dataSource - Data source configuration
 * @param {number} parentId - Parent object ID
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} [label] - Optional label
 * @returns {Promise<number>} Created object ID
 */
export async function createMapPoint(dataSource, parentId, lat, lng, label = '') {
  const { database, pointsTypeId, latReqId, lngReqId } = dataSource

  if (integramApiClient.currentDatabase !== database) {
    await integramApiClient.switchDatabase(database)
  }

  const typeId = pointsTypeId || dataSource.objectsTypeId
  const value = label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`

  const result = await integramApiClient.createObject(typeId, value, parentId || undefined)
  const objectId = result.id || result

  // Set coordinates
  await integramApiClient.setObjectRequisites(objectId, {
    [latReqId]: String(lat),
    [lngReqId]: String(lng)
  })

  return objectId
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(str) {
  if (!str) return ''
  return String(str).replace(/<[^>]*>/g, '').trim()
}

/**
 * Load cadastral numbers from an Integram database.
 *
 * Loads objects from objectsTypeId and extracts cadastral numbers
 * from a sub-table (e.g., "Кадастровый номер" sub-table under "Объект контроля").
 *
 * @param {Object} dataSource - Data source configuration
 * @param {string} dataSource.database - Database name (e.g. 'kval')
 * @param {number} dataSource.objectsTypeId - Main objects type ID (e.g. 916814 "Объект контроля")
 * @param {number} dataSource.cadastralTypeId - Cadastral numbers sub-table type ID (e.g. 916949)
 * @param {number} [dataSource.cadastralReqId] - Requisite ID for the cadastral number value (optional, uses object val if omitted)
 * @param {number} [dataSource.parentObjectId] - Optional parent filter
 * @returns {Promise<string[]>} Array of cadastral number strings
 */
export async function loadCadastralNumbers(dataSource) {
  const {
    database,
    objectsTypeId,
    cadastralTypeId,
    cadastralReqId,
    parentObjectId
  } = dataSource

  logger.info('[IntegramMapData] Loading cadastral numbers', { database, objectsTypeId, cadastralTypeId })

  try {
    await integramApiClient.switchDatabase(database)
  } catch (switchErr) {
    logger.warn('[IntegramMapData] switchDatabase failed for cadastral:', switchErr.message)
  }

  const cadastralNumbers = []

  try {
    const params = { LIMIT: 200, F_U: 1 }
    if (parentObjectId) {
      params.F_U = parentObjectId
    }

    const objectsData = await integramApiClient.getObjectList(objectsTypeId, params)
    const objects = objectsData.object || objectsData.objects || []

    if (!objects.length) {
      logger.warn('[IntegramMapData] No objects found for cadastral loading', objectsTypeId)
      return []
    }

    for (const obj of objects) {
      try {
        const subData = await integramApiClient.getObjectList(cadastralTypeId, {
          F_U: obj.id, LIMIT: 50
        })
        const subObjects = subData.object || []

        for (const sub of subObjects) {
          let cn = ''
          if (cadastralReqId && subData.reqs?.[sub.id]?.[cadastralReqId]) {
            cn = String(subData.reqs[sub.id][cadastralReqId]).trim()
          } else {
            cn = stripHtml(sub.val).trim()
          }

          // Validate cadastral number format
          if (cn && /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(cn)) {
            cadastralNumbers.push(cn)
          }
        }
      } catch (err) {
        logger.warn(`[IntegramMapData] Error loading cadastral for object ${obj.id}:`, err.message)
      }
    }

    logger.info(`[IntegramMapData] Loaded ${cadastralNumbers.length} cadastral numbers`)
    return [...new Set(cadastralNumbers)]

  } catch (err) {
    logger.error('[IntegramMapData] Error loading cadastral numbers:', err)
    throw err
  }
}

/**
 * Load cadastral records with cached GeoJSON polygons from req 949874.
 * Returns array of { cadastralNumber, subObjectId, cachedPolygons } where:
 * - cachedPolygons: already-parsed polygon array (from DB), or null if not cached
 * Returns only records with valid cadastral number format OR with cached polygons.
 */
export async function loadCadastralData(dataSource) {
  const { database, objectsTypeId, cadastralTypeId, parentObjectId } = dataSource
  const GEOJSON_REQ_ID = '949874'

  try {
    await integramApiClient.switchDatabase(database)
  } catch (switchErr) {
    logger.warn('[IntegramMapData] switchDatabase failed for loadCadastralData:', switchErr.message)
  }

  const records = []

  try {
    const params = { LIMIT: 200, F_U: parentObjectId || 1 }
    const objectsData = await integramApiClient.getObjectList(objectsTypeId, params)
    const objects = objectsData.object || objectsData.objects || []

    for (const obj of objects) {
      try {
        const subData = await integramApiClient.getObjectList(cadastralTypeId, { F_U: obj.id, LIMIT: 50 })
        const subObjects = subData.object || []

        for (const sub of subObjects) {
          const cn = stripHtml(sub.val || '').trim()
          const isValidCn = /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(cn)

          // Try to read cached GeoJSON from req 949874
          let cachedPolygons = null
          const reqData = subData.reqs?.[sub.id]
          const geoJsonRaw = reqData?.[GEOJSON_REQ_ID]
          if (geoJsonRaw) {
            try {
              cachedPolygons = JSON.parse(typeof geoJsonRaw === 'string' ? geoJsonRaw : JSON.stringify(geoJsonRaw))
              if (!Array.isArray(cachedPolygons)) cachedPolygons = null
            } catch (_) {
              cachedPolygons = null
            }
          }

          if (isValidCn || cachedPolygons) {
            records.push({
              cadastralNumber: isValidCn ? cn : null,
              subObjectId: sub.id,
              cachedPolygons
            })
          }
        }
      } catch (err) {
        logger.warn(`[IntegramMapData] Error loading cadastral data for object ${obj.id}:`, err.message)
      }
    }

    logger.info(`[IntegramMapData] loadCadastralData: ${records.length} records (${records.filter(r => r.cachedPolygons).length} cached)`)
    return records

  } catch (err) {
    logger.error('[IntegramMapData] Error in loadCadastralData:', err)
    throw err
  }
}

/**
 * Save fetched GeoJSON polygons to req 949874 of a "Кадастровый номер" record.
 * Called after successfully fetching boundaries from NSPD.
 */
export async function saveCadastralGeoJson(database, subObjectId, polygons) {
  const GEOJSON_REQ_ID = '949874'
  const CADASTRAL_TYPE_ID = 916949

  try {
    await integramApiClient.switchDatabase(database)
    await integramApiClient.saveObject(subObjectId, CADASTRAL_TYPE_ID, null, {
      [GEOJSON_REQ_ID]: JSON.stringify(polygons)
    })
    logger.info(`[IntegramMapData] Saved GeoJSON for object ${subObjectId} (${polygons.length} polygons)`)
  } catch (err) {
    logger.warn(`[IntegramMapData] Failed to save GeoJSON for object ${subObjectId}:`, err.message)
  }
}

export default {
  loadMapMarkers,
  discoverCoordinateFields,
  deepDiscoverCoordinateFields,
  createMapPoint,
  loadCadastralNumbers,
  loadCadastralData,
  saveCadastralGeoJson
}

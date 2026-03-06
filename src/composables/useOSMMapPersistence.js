import { logger } from '@/utils/logger'
/**
 * Composable for OSMMap persistence to DronDoc backend
 *
 * This composable extracts the server-specific logic from the OSMMap component,
 * allowing the map to be used standalone or with different persistence backends.
 *
 * Usage:
 * ```js
 * const mapState = ref({ ... })
 * const { saveToServer, loadFromServer, isLoading, error } = useOSMMapPersistence(mapState)
 *
 * watchEffect(() => {
 *   saveToServer()
 * })
 * ```
 */

import { ref, toValue } from 'vue'

export function useOSMMapPersistence(mapStateRef) {
  const isLoading = ref(false)
  const error = ref(null)
  const lastSaveTime = ref(null)

  /**
   * Get authentication credentials from localStorage
   */
  const getAuthCredentials = () => {
    const xsrf = localStorage.getItem('_xsrf')
    const userId = localStorage.getItem('id')
    const token = localStorage.getItem('token')

    if (!xsrf || !userId || !token) {
      throw new Error('Не найдены xsrf token, user id или token')
    }

    return { xsrf, userId, token }
  }

  /**
   * Get current timestamp in DronDoc format
   */
  const getCurrentDate = () => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
  }

  /**
   * Get map concession row ID from the server
   */
  const getMapConcessionRowId = async (token) => {
    const response = await fetch('https://drondoc.ru/api/A2025/report/963569', {
      headers: { Authorization: token }
    })

    if (!response.ok) {
      throw new Error('Ошибка получения mapConcessionRowId')
    }

    const data = await response.json()
    const row = data.response.rows[0]

    if (!row || !row.values || row.values.length === 0) {
      throw new Error('Не найдено данных в отчете 963569')
    }

    return row.values[0].value
  }

  /**
   * Create a new map object on the server
   */
  const createMapObject = async (token, xsrf) => {
    const formData = new FormData()
    formData.append('t952500', getCurrentDate())
    formData.append('up', '1')
    formData.append('_xsrf', xsrf)

    const response = await fetch(
      `https://ai2o.ru/a2025/_m_new/952500`,
      {
        method: 'POST',
        headers: { 'X-Authorization': token },
        body: formData,
      }
    )

    if (!response.ok) throw new Error('Ошибка создания объекта карты')
    const data = await response.json()
    return data.id
  }

  /**
   * Save markers to the server
   */
  const saveMarkers = async (markers, rowId, token, xsrf) => {
    for (const marker of markers) {
      if (marker.serverId) continue // Skip already saved markers

      const objectId = await createMapObject(token, xsrf)

      // Set object type (point)
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952514=952515`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Create point
      const pointFormData = new FormData()
      pointFormData.append('t952527', marker.label || 'Точка')
      pointFormData.append('_xsrf', xsrf)

      const pointResponse = await fetch(
        `https://ai2o.ru/a2025/_m_new/952527?JSON&up=${objectId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: pointFormData,
        }
      )

      if (!pointResponse.ok) throw new Error('Ошибка создания точки')
      const pointData = await pointResponse.json()
      const pointId = pointData.id

      // Set coordinates
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${pointId}?JSON&t952536=${marker.position.lat}&t952541=${marker.position.lng}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Link to concession
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952512=${rowId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Update marker with server ID
      marker.serverId = objectId
    }
  }

  /**
   * Save polygons to the server
   */
  const savePolygons = async (polygons, rowId, token, xsrf) => {
    for (const polygon of polygons) {
      if (polygon.serverId) continue // Skip already saved polygons

      const objectId = await createMapObject(token, xsrf)

      // Set object type (polygon)
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952514=952518`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Create polygon
      const polygonFormData = new FormData()
      polygonFormData.append('t952548', polygon.label || 'Полигон')
      polygonFormData.append('_xsrf', xsrf)

      const polygonResponse = await fetch(
        `https://ai2o.ru/a2025/_m_new/952548?JSON&up=${objectId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: polygonFormData,
        }
      )

      if (!polygonResponse.ok) throw new Error('Ошибка создания полигона')
      const polygonData = await polygonResponse.json()
      const polygonId = polygonData.id

      // Save polygon points
      for (let i = 0; i < polygon.points.length; i++) {
        const point = polygon.points[i]
        const coordFormData = new FormData()
        coordFormData.append('t952559', i.toString())
        coordFormData.append('_xsrf', xsrf)

        const coordResponse = await fetch(
          `https://ai2o.ru/a2025/_m_new/952559?JSON&up=${polygonId}`,
          {
            method: 'POST',
            headers: { 'X-Authorization': token },
            body: coordFormData,
          }
        )

        if (!coordResponse.ok) throw new Error('Ошибка создания координаты полигона')
        const coordData = await coordResponse.json()
        const coordId = coordData.id

        // Set coordinates
        await fetch(
          `https://ai2o.ru/a2025/_m_set/${coordId}?JSON&t952564=${point.lat}&t952569=${point.lng}`,
          {
            method: 'POST',
            headers: { 'X-Authorization': token },
            body: new URLSearchParams({ _xsrf: xsrf }),
          }
        )
      }

      // Link to concession
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952512=${rowId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Update polygon with server ID
      polygon.serverId = objectId
    }
  }

  /**
   * Save curves to the server
   */
  const saveCurves = async (curves, rowId, token, xsrf) => {
    for (const curve of curves) {
      if (curve.serverId) continue // Skip already saved curves

      const objectId = await createMapObject(token, xsrf)

      // Set object type (curve)
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952514=952521`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Create curve
      const curveFormData = new FormData()
      curveFormData.append('t952574', curve.label || 'Кривая')
      curveFormData.append('_xsrf', xsrf)

      const curveResponse = await fetch(
        `https://ai2o.ru/a2025/_m_new/952574?JSON&up=${objectId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: curveFormData,
        }
      )

      if (!curveResponse.ok) throw new Error('Ошибка создания кривой')
      const curveData = await curveResponse.json()
      const curveId = curveData.id

      // Save curve points
      for (let i = 0; i < curve.points.length; i++) {
        const point = curve.points[i]
        const coordFormData = new FormData()
        coordFormData.append('t952585', i.toString())
        coordFormData.append('_xsrf', xsrf)

        const coordResponse = await fetch(
          `https://ai2o.ru/a2025/_m_new/952585?JSON&up=${curveId}`,
          {
            method: 'POST',
            headers: { 'X-Authorization': token },
            body: coordFormData,
          }
        )

        if (!coordResponse.ok) throw new Error('Ошибка создания координаты кривой')
        const coordData = await coordResponse.json()
        const coordId = coordData.id

        // Set coordinates
        await fetch(
          `https://ai2o.ru/a2025/_m_set/${coordId}?JSON&t952590=${point.lat}&t952595=${point.lng}`,
          {
            method: 'POST',
            headers: { 'X-Authorization': token },
            body: new URLSearchParams({ _xsrf: xsrf }),
          }
        )
      }

      // Link to concession
      await fetch(
        `https://ai2o.ru/a2025/_m_set/${objectId}?JSON&t952512=${rowId}`,
        {
          method: 'POST',
          headers: { 'X-Authorization': token },
          body: new URLSearchParams({ _xsrf: xsrf }),
        }
      )

      // Update curve with server ID
      curve.serverId = objectId
    }
  }

  /**
   * Save all map objects to the server
   */
  const saveMapObjects = async (rowId, token, xsrf) => {
    const mapState = toValue(mapStateRef)

    // Save markers
    if (mapState.markers && mapState.markers.length > 0) {
      await saveMarkers(mapState.markers, rowId, token, xsrf)
    }

    // Save polygons
    if (mapState.polygons && mapState.polygons.length > 0) {
      await savePolygons(mapState.polygons, rowId, token, xsrf)
    }

    // Save curves
    if (mapState.curves && mapState.curves.length > 0) {
      await saveCurves(mapState.curves, rowId, token, xsrf)
    }
  }

  /**
   * Save map state to the server
   */
  const saveToServer = async () => {
    try {
      isLoading.value = true
      error.value = null

      const { xsrf, userId, token } = getAuthCredentials()

      // Get map concession row ID
      const rowId = await getMapConcessionRowId(token)

      // Update user for concession
      await fetch('https://drondoc.ru/api/A2025/tables/update', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: rowId,
          headers: [
            {
              headerId: 959621,
              value: userId,
              type: 3,
            },
          ],
        }),
      })

      // Save map objects
      await saveMapObjects(rowId, token, xsrf)

      lastSaveTime.value = new Date()
    } catch (err) {
      console.error('Ошибка сохранения на сервер:', err)
      error.value = err.message || 'Неизвестная ошибка сохранения'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load map state from the server
   */
  const loadFromServer = async () => {
    try {
      isLoading.value = true
      error.value = null

      const { token } = getAuthCredentials()

      // Get map concession row ID
      const rowId = await getMapConcessionRowId(token)

      // Load map objects
      const response = await fetch(
        `https://drondoc.ru/api/A2025/report/963572?JSON&concessionId=${rowId}`,
        {
          headers: { Authorization: token }
        }
      )

      if (!response.ok) {
        throw new Error('Ошибка загрузки объектов карты')
      }

      const data = await response.json()
      const mapState = toValue(mapStateRef)

      // Parse and populate map state
      // TODO: Implement parsing logic based on server response format
      logger.debug('Loaded map data:', data)

    } catch (err) {
      console.error('Ошибка загрузки с сервера:', err)
      error.value = err.message || 'Неизвестная ошибка загрузки'
    } finally {
      isLoading.value = false
    }
  }

  return {
    saveToServer,
    loadFromServer,
    isLoading,
    error,
    lastSaveTime
  }
}

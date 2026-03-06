/**
 * Mission Calculator Utility
 * Provides flight mission calculations for drone operations
 * Issue #5197 - Stage 3: Mission Planning
 */

import * as turf from '@turf/turf'

/**
 * Mission Calculator
 * Handles all mission-related calculations
 */
export const missionCalculator = {
  /**
   * Calculate route distance from GeoJSON LineString or MultiPoint
   * @param {Object} geoJson - GeoJSON object (LineString or MultiPoint)
   * @returns {number} Distance in meters
   */
  calculateRouteDistance(geoJson) {
    if (!geoJson || !geoJson.coordinates) {
      return 0
    }

    try {
      // Convert to feature if just geometry
      const feature = geoJson.type === 'Feature' ? geoJson : turf.feature(geoJson)

      // Calculate length based on geometry type
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        return turf.length(feature, { units: 'meters' })
      } else if (feature.geometry.type === 'MultiPoint' || feature.geometry.type === 'Point') {
        // For points, calculate distance between consecutive points
        const coords = feature.geometry.coordinates
        if (coords.length < 2) return 0

        let totalDistance = 0
        for (let i = 0; i < coords.length - 1; i++) {
          const from = turf.point(coords[i])
          const to = turf.point(coords[i + 1])
          totalDistance += turf.distance(from, to, { units: 'meters' })
        }
        return totalDistance
      }

      return 0
    } catch (error) {
      console.error('Error calculating route distance:', error)
      return 0
    }
  },

  /**
   * Calculate polygon area
   * @param {Object} polygon - GeoJSON Polygon or MultiPolygon
   * @returns {Object} Area in square meters and hectares
   */
  calculateArea(polygon) {
    if (!polygon || !polygon.coordinates) {
      return { sqMeters: 0, hectares: 0, sqKm: 0 }
    }

    try {
      // Convert to feature if just geometry
      const feature = polygon.type === 'Feature' ? polygon : turf.feature(polygon)

      // Calculate area in square meters
      const sqMeters = turf.area(feature)
      const hectares = sqMeters / 10000 // 1 hectare = 10,000 m²
      const sqKm = sqMeters / 1000000 // 1 km² = 1,000,000 m²

      return {
        sqMeters: Math.round(sqMeters),
        hectares: Math.round(hectares * 100) / 100, // Round to 2 decimals
        sqKm: Math.round(sqKm * 100) / 100
      }
    } catch (error) {
      console.error('Error calculating area:', error)
      return { sqMeters: 0, hectares: 0, sqKm: 0 }
    }
  },

  /**
   * Calculate flight time based on distance and speed
   * @param {number} distance - Distance in meters
   * @param {number} speed - Speed in m/s
   * @param {number} takeoffLandingTime - Time for takeoff and landing in minutes (default: 5)
   * @returns {number} Flight time in minutes
   */
  calculateFlightTime(distance, speed, takeoffLandingTime = 5) {
    if (!distance || !speed || speed <= 0) {
      return takeoffLandingTime
    }

    // Time = Distance / Speed (in seconds)
    const flightTimeSeconds = distance / speed

    // Convert to minutes and add takeoff/landing time
    const flightTimeMinutes = (flightTimeSeconds / 60) + takeoffLandingTime

    return Math.round(flightTimeMinutes * 10) / 10 // Round to 1 decimal
  },

  /**
   * Calculate number of batteries needed
   * @param {number} flightTime - Flight time in minutes
   * @param {number} batteryLife - Battery life in minutes (default: 25)
   * @returns {number} Number of batteries needed
   */
  calculateBatteryCount(flightTime, batteryLife = 25) {
    if (!flightTime || !batteryLife || batteryLife <= 0) {
      return 1
    }

    return Math.ceil(flightTime / batteryLife)
  },

  /**
   * Estimate number of photos based on area and overlap
   * @param {number} area - Area in square meters
   * @param {number} altitude - Flight altitude in meters
   * @param {number} overlap - Overlap percentage (60-90%)
   * @param {Object} cameraSpecs - Camera specifications
   * @returns {number} Estimated number of photos
   */
  estimatePhotoCount(area, altitude, overlap = 75, cameraSpecs = {}) {
    // Default camera specs (typical for DJI Phantom 4 Pro)
    const sensorWidth = cameraSpecs.sensorWidth || 13.2 // mm
    const sensorHeight = cameraSpecs.sensorHeight || 8.8 // mm
    const focalLength = cameraSpecs.focalLength || 8.8 // mm

    // Calculate ground coverage per photo
    const groundWidth = (sensorWidth * altitude) / focalLength
    const groundHeight = (sensorHeight * altitude) / focalLength
    const photoArea = groundWidth * groundHeight

    // Account for overlap
    const effectiveOverlap = overlap / 100
    const effectivePhotoArea = photoArea * (1 - effectiveOverlap) * (1 - effectiveOverlap)

    // Calculate number of photos needed
    const photoCount = Math.ceil(area / effectivePhotoArea)

    return photoCount
  },

  /**
   * Generate flight grid for photogrammetry coverage
   * @param {Object} polygon - GeoJSON Polygon defining the area
   * @param {number} altitude - Flight altitude in meters
   * @param {number} overlap - Overlap percentage (60-90%)
   * @param {Object} cameraSpecs - Camera specifications
   * @returns {Array} Array of waypoint coordinates [lng, lat, altitude]
   */
  generateFlightGrid(polygon, altitude, overlap = 75, cameraSpecs = {}) {
    if (!polygon || !polygon.coordinates) {
      return []
    }

    try {
      // Default camera specs
      const sensorWidth = cameraSpecs.sensorWidth || 13.2
      const sensorHeight = cameraSpecs.sensorHeight || 8.8
      const focalLength = cameraSpecs.focalLength || 8.8

      // Calculate spacing between flight lines
      const groundWidth = (sensorWidth * altitude) / focalLength
      const groundHeight = (sensorHeight * altitude) / focalLength
      const overlapFactor = (100 - overlap) / 100
      const lineSpacing = groundWidth * overlapFactor // Distance between parallel lines
      const photoSpacing = groundHeight * overlapFactor // Distance between photos on a line

      // Get bounding box
      const feature = polygon.type === 'Feature' ? polygon : turf.feature(polygon)
      const bbox = turf.bbox(feature)

      // Generate grid points
      const waypoints = []
      const [minLng, minLat, maxLng, maxLat] = bbox

      // Calculate grid dimensions
      const bboxWidth = turf.distance(
        turf.point([minLng, minLat]),
        turf.point([maxLng, minLat]),
        { units: 'meters' }
      )
      const bboxHeight = turf.distance(
        turf.point([minLng, minLat]),
        turf.point([minLng, maxLat]),
        { units: 'meters' }
      )

      // Number of lines and points per line
      const numLines = Math.ceil(bboxHeight / lineSpacing)
      const numPointsPerLine = Math.ceil(bboxWidth / photoSpacing)

      // Generate waypoints in a serpentine pattern (back and forth)
      for (let line = 0; line <= numLines; line++) {
        const latOffset = (line * lineSpacing) / 111000 // Approximate meters to degrees
        const lat = minLat + latOffset

        // Alternate direction for serpentine pattern
        const reverse = line % 2 === 1

        for (let point = 0; point <= numPointsPerLine; point++) {
          const actualPoint = reverse ? (numPointsPerLine - point) : point
          const lngOffset = (actualPoint * photoSpacing) / (111000 * Math.cos(lat * Math.PI / 180))
          const lng = minLng + lngOffset

          const waypoint = turf.point([lng, lat])

          // Check if point is inside polygon
          if (turf.booleanPointInPolygon(waypoint, feature)) {
            waypoints.push([lng, lat, altitude])
          }
        }
      }

      return waypoints
    } catch (error) {
      console.error('Error generating flight grid:', error)
      return []
    }
  },

  /**
   * Calculate mission summary statistics
   * @param {Object} missionParams - Mission parameters
   * @returns {Object} Summary statistics
   */
  calculateMissionSummary(missionParams) {
    const {
      route,
      polygon,
      altitude = 100,
      speed = 5,
      overlap = 75,
      cameraSpecs = {},
      batteryLife = 25
    } = missionParams

    const summary = {
      distance: 0,
      area: { sqMeters: 0, hectares: 0, sqKm: 0 },
      flightTime: 0,
      batteryCount: 0,
      photoCount: 0,
      waypoints: []
    }

    // Calculate distance if route exists
    if (route) {
      summary.distance = this.calculateRouteDistance(route)
    }

    // Calculate area if polygon exists
    if (polygon) {
      summary.area = this.calculateArea(polygon)
      summary.waypoints = this.generateFlightGrid(polygon, altitude, overlap, cameraSpecs)
      summary.photoCount = this.estimatePhotoCount(
        summary.area.sqMeters,
        altitude,
        overlap,
        cameraSpecs
      )

      // If waypoints generated, calculate total distance
      if (summary.waypoints.length > 1) {
        const waypointsLine = turf.lineString(summary.waypoints.map(w => [w[0], w[1]]))
        summary.distance = this.calculateRouteDistance(waypointsLine.geometry)
      }
    }

    // Calculate flight time
    summary.flightTime = this.calculateFlightTime(summary.distance, speed)

    // Calculate battery count
    summary.batteryCount = this.calculateBatteryCount(summary.flightTime, batteryLife)

    return summary
  }
}

export default missionCalculator

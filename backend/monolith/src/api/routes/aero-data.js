/**
 * Aero Monitoring - Mission Data API Routes
 * Part of Issue #5199 - Этап 5: ИИ-анализ данных и отчеты
 *
 * Manages mission data uploads (photos, videos, sensor data)
 * Handles EXIF extraction, file storage, and data association with missions
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import logger from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function createAeroDataRoutes() {
  const router = express.Router()

  // Storage configuration
  const STORAGE_PATH = path.join(process.cwd(), 'data', 'aero', 'missions')

  // Ensure storage directory exists
  fs.mkdir(STORAGE_PATH, { recursive: true }).catch(err =>
    logger.error({ error: err.message }, 'Failed to create storage directory')
  )

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const missionId = req.body.missionId || 'unknown'
      const missionPath = path.join(STORAGE_PATH, missionId.toString())

      try {
        await fs.mkdir(missionPath, { recursive: true })
        cb(null, missionPath)
      } catch (error) {
        logger.error({ error: error.message, missionId }, 'Failed to create mission directory')
        cb(error)
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
      const ext = path.extname(file.originalname)
      const baseName = path.basename(file.originalname, ext)
      cb(null, `${baseName}-${uniqueSuffix}${ext}`)
    }
  })

  // File filter - accept images and videos only
  const fileFilter = (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv'
    ]

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images and videos are allowed.`), false)
    }
  }

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    fileFilter
  })

  // Mock data storage (in production, use Integram)
  const mockDataStore = []

  /**
   * Extract EXIF data from image file
   * Note: For simplicity, this is a placeholder. In production, use exif-parser or similar library
   */
  async function extractEXIF(filePath) {
    try {
      // TODO: Implement actual EXIF extraction with exif-parser library
      // For now, return mock data
      return {
        latitude: null,
        longitude: null,
        altitude: null,
        timestamp: new Date().toISOString(),
        camera: {
          make: 'DJI',
          model: 'Mavic 3',
          focalLength: 24,
          aperture: 2.8,
          iso: 100,
          shutterSpeed: '1/1000'
        }
      }
    } catch (error) {
      logger.error({ error: error.message, filePath }, 'Failed to extract EXIF data')
      return null
    }
  }

  /**
   * POST /api/aero/data/upload
   * Upload mission data files (photos/videos)
   */
  router.post('/upload', upload.array('files', 100), async (req, res, next) => {
    try {
      const { missionId, customCoordinates } = req.body

      if (!missionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: missionId'
        })
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        })
      }

      const uploadedFiles = []

      for (const file of req.files) {
        // Extract EXIF data
        const exifData = await extractEXIF(file.path)

        // Parse custom coordinates if provided
        let coordinates = null
        if (customCoordinates) {
          try {
            const coords = JSON.parse(customCoordinates)
            coordinates = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              altitude: coords.altitude
            }
          } catch (e) {
            logger.warn({ error: e.message }, 'Failed to parse custom coordinates')
          }
        }

        // Determine file type
        const fileType = file.mimetype.startsWith('image/') ? 'Photo' : 'Video'

        // Create data record
        const fileData = {
          id: Date.now() + Math.random(),
          missionId: parseInt(missionId),
          type: fileType,
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          relativePath: path.relative(STORAGE_PATH, file.path),
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString(),
          // Use EXIF data if available, otherwise use custom coordinates
          latitude: exifData?.latitude || coordinates?.latitude || null,
          longitude: exifData?.longitude || coordinates?.longitude || null,
          altitude: exifData?.altitude || coordinates?.altitude || null,
          timestamp: exifData?.timestamp || new Date().toISOString(),
          metadata: {
            exif: exifData,
            custom: coordinates
          }
        }

        // Store in mock database
        mockDataStore.push(fileData)
        uploadedFiles.push(fileData)

        logger.info({
          missionId,
          filename: file.filename,
          type: fileType
        }, 'File uploaded successfully')
      }

      res.json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        files: uploadedFiles,
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to upload files')
      next(error)
    }
  })

  /**
   * GET /api/aero/data/mission/:missionId
   * Get all data files for a mission
   */
  router.get('/mission/:missionId', async (req, res, next) => {
    try {
      const { missionId } = req.params
      const { type } = req.query // Filter by type: Photo, Video, Sensor

      let files = mockDataStore.filter(f => f.missionId === parseInt(missionId))

      if (type) {
        files = files.filter(f => f.type === type)
      }

      // Sort by timestamp (newest first)
      files.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      res.json({
        success: true,
        missionId: parseInt(missionId),
        count: files.length,
        data: files,
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get mission data')
      next(error)
    }
  })

  /**
   * GET /api/aero/data/file/:id
   * Get a specific data file by ID
   */
  router.get('/file/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const file = mockDataStore.find(f => f.id === parseFloat(id))

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        })
      }

      res.json({
        success: true,
        data: file,
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get file')
      next(error)
    }
  })

  /**
   * GET /api/aero/data/download/:id
   * Download a data file
   */
  router.get('/download/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const file = mockDataStore.find(f => f.id === parseFloat(id))

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        })
      }

      // Check if file exists
      try {
        await fs.access(file.path)
      } catch (err) {
        return res.status(404).json({
          success: false,
          error: 'File not found on disk'
        })
      }

      // Send file
      res.download(file.path, file.originalName, (err) => {
        if (err) {
          logger.error({ error: err.message, fileId: id }, 'Failed to download file')
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Failed to download file'
            })
          }
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to download file')
      next(error)
    }
  })

  /**
   * DELETE /api/aero/data/:id
   * Delete a data file
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const fileIndex = mockDataStore.findIndex(f => f.id === parseFloat(id))

      if (fileIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        })
      }

      const file = mockDataStore[fileIndex]

      // Delete file from disk
      try {
        await fs.unlink(file.path)
      } catch (err) {
        logger.warn({ error: err.message, filePath: file.path }, 'Failed to delete file from disk')
      }

      // Remove from mock database
      mockDataStore.splice(fileIndex, 1)

      logger.info({ fileId: id, filename: file.filename }, 'File deleted successfully')

      res.json({
        success: true,
        message: 'File deleted successfully',
        file,
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete file')
      next(error)
    }
  })

  /**
   * GET /api/aero/data/stats/:missionId
   * Get statistics for mission data
   */
  router.get('/stats/:missionId', async (req, res, next) => {
    try {
      const { missionId } = req.params
      const files = mockDataStore.filter(f => f.missionId === parseInt(missionId))

      const stats = {
        total: files.length,
        photos: files.filter(f => f.type === 'Photo').length,
        videos: files.filter(f => f.type === 'Video').length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        withGPS: files.filter(f => f.latitude && f.longitude).length,
        withoutGPS: files.filter(f => !f.latitude || !f.longitude).length,
        dateRange: {
          earliest: files.length > 0 ?
            new Date(Math.min(...files.map(f => new Date(f.timestamp)))).toISOString() : null,
          latest: files.length > 0 ?
            new Date(Math.max(...files.map(f => new Date(f.timestamp)))).toISOString() : null
        }
      }

      res.json({
        success: true,
        missionId: parseInt(missionId),
        stats,
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get stats')
      next(error)
    }
  })

  return router
}

export default createAeroDataRoutes

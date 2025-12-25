/**
 * Google Drive Integration Provider
 *
 * Implements Google Drive-specific integration features:
 * - OAuth2 authentication
 * - Upload recordings to Google Drive
 * - Create and manage folders
 * - Generate shareable links
 * - File metadata management
 */

import { Readable } from 'stream'
import logger from '../../../utils/logger.js'

export class GoogleDriveProvider {
  constructor(config) {
    this.clientId = config.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID
    this.clientSecret = config.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET
    this.apiBaseUrl = 'https://www.googleapis.com/drive/v3'
    this.uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files'
  }

  /**
   * Create folder in Google Drive
   * @param {string} accessToken - OAuth access token
   * @param {string} folderName - Folder name
   * @param {string} parentId - Parent folder ID (optional)
   * @returns {Promise<Object>} Created folder metadata
   */
  async createFolder(accessToken, folderName, parentId = null) {
    try {
      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentId) {
        metadata.parents = [parentId]
      }

      const response = await fetch(`${this.apiBaseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Google Drive API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Created Google Drive folder', { folderId: data.id, folderName })

      return data
    } catch (error) {
      logger.error('Failed to create Google Drive folder', { error: error.message, folderName })
      throw error
    }
  }

  /**
   * Upload file to Google Drive
   * @param {string} accessToken - OAuth access token
   * @param {Buffer|Stream} fileData - File data
   * @param {Object} metadata - File metadata
   * @returns {Promise<Object>} Uploaded file metadata
   */
  async uploadFile(accessToken, fileData, metadata) {
    try {
      const { name, mimeType = 'application/octet-stream', folderId } = metadata

      const fileMetadata = {
        name
      }

      if (folderId) {
        fileMetadata.parents = [folderId]
      }

      // Use multipart upload
      const boundary = '-------boundary'
      const delimiter = `\r\n--${boundary}\r\n`
      const closeDelimiter = `\r\n--${boundary}--`

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        fileData.toString('base64') +
        closeDelimiter

      const response = await fetch(`${this.uploadUrl}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Google Drive upload error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Uploaded file to Google Drive', { fileId: data.id, fileName: name })

      return data
    } catch (error) {
      logger.error('Failed to upload file to Google Drive', { error: error.message, fileName: metadata.name })
      throw error
    }
  }

  /**
   * Upload recording to Google Drive
   * @param {string} accessToken - OAuth access token
   * @param {Object} recording - Recording metadata
   * @param {Buffer} recordingData - Recording file data
   * @param {string} folderId - Target folder ID (optional)
   * @returns {Promise<Object>} Uploaded file info
   */
  async uploadRecording(accessToken, recording, recordingData, folderId = null) {
    try {
      // Ensure DronDoc Recordings folder exists
      let targetFolderId = folderId
      if (!targetFolderId) {
        const folder = await this.ensureFolder(accessToken, 'DronDoc Recordings')
        targetFolderId = folder.id
      }

      // Create subfolder for this meeting if it has a title
      if (recording.title) {
        const meetingFolder = await this.createFolder(accessToken, recording.title, targetFolderId)
        targetFolderId = meetingFolder.id
      }

      const fileName = recording.fileName || `recording-${recording.id}.${recording.format || 'webm'}`
      const mimeType = recording.mimeType || 'video/webm'

      const uploadedFile = await this.uploadFile(accessToken, recordingData, {
        name: fileName,
        mimeType,
        folderId: targetFolderId
      })

      // Get shareable link
      const shareableLink = await this.createShareableLink(accessToken, uploadedFile.id)

      return {
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        webViewLink: uploadedFile.webViewLink,
        shareableLink,
        folderId: targetFolderId
      }
    } catch (error) {
      logger.error('Failed to upload recording to Google Drive', { error: error.message, recordingId: recording.id })
      throw error
    }
  }

  /**
   * Ensure folder exists (create if not)
   * @param {string} accessToken - OAuth access token
   * @param {string} folderName - Folder name
   * @param {string} parentId - Parent folder ID (optional)
   * @returns {Promise<Object>} Folder metadata
   */
  async ensureFolder(accessToken, folderName, parentId = null) {
    try {
      // Search for existing folder
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      if (parentId) {
        query += ` and '${parentId}' in parents`
      }

      const searchResponse = await fetch(
        `${this.apiBaseUrl}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!searchResponse.ok) {
        throw new Error('Failed to search for folder')
      }

      const searchData = await searchResponse.json()

      if (searchData.files && searchData.files.length > 0) {
        // Folder exists
        logger.info('Found existing Google Drive folder', { folderId: searchData.files[0].id, folderName })
        return searchData.files[0]
      }

      // Folder doesn't exist, create it
      return await this.createFolder(accessToken, folderName, parentId)
    } catch (error) {
      logger.error('Failed to ensure Google Drive folder', { error: error.message, folderName })
      throw error
    }
  }

  /**
   * Create shareable link
   * @param {string} accessToken - OAuth access token
   * @param {string} fileId - File ID
   * @returns {Promise<string>} Shareable link
   */
  async createShareableLink(accessToken, fileId) {
    try {
      // Make file accessible to anyone with link
      const permissionResponse = await fetch(`${this.apiBaseUrl}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      })

      if (!permissionResponse.ok) {
        logger.warn('Failed to create public permission, file may not be shareable')
      }

      // Get file metadata with webViewLink
      const fileResponse = await fetch(`${this.apiBaseUrl}/files/${fileId}?fields=webViewLink`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!fileResponse.ok) {
        throw new Error('Failed to get file metadata')
      }

      const fileData = await fileResponse.json()

      logger.info('Created shareable link for Google Drive file', { fileId })

      return fileData.webViewLink
    } catch (error) {
      logger.error('Failed to create shareable link', { error: error.message, fileId })
      throw error
    }
  }

  /**
   * List files in folder
   * @param {string} accessToken - OAuth access token
   * @param {string} folderId - Folder ID (optional, root if not specified)
   * @returns {Promise<Array>} List of files
   */
  async listFiles(accessToken, folderId = null) {
    try {
      let query = 'trashed=false'
      if (folderId) {
        query += ` and '${folderId}' in parents`
      }

      const response = await fetch(
        `${this.apiBaseUrl}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,size,webViewLink)`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Google Drive API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Listed Google Drive files', { count: data.files?.length || 0, folderId })

      return data.files || []
    } catch (error) {
      logger.error('Failed to list Google Drive files', { error: error.message, folderId })
      throw error
    }
  }

  /**
   * Delete file
   * @param {string} accessToken - OAuth access token
   * @param {string} fileId - File ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(accessToken, fileId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok && response.status !== 204) {
        const error = await response.json()
        throw new Error(`Google Drive API error: ${error.error?.message || 'Unknown error'}`)
      }

      logger.info('Deleted Google Drive file', { fileId })

      return true
    } catch (error) {
      logger.error('Failed to delete Google Drive file', { error: error.message, fileId })
      throw error
    }
  }

  /**
   * Get file metadata
   * @param {string} accessToken - OAuth access token
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(accessToken, fileId) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Google Drive API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Retrieved Google Drive file metadata', { fileId })

      return data
    } catch (error) {
      logger.error('Failed to get Google Drive file metadata', { error: error.message, fileId })
      throw error
    }
  }
}

export default GoogleDriveProvider

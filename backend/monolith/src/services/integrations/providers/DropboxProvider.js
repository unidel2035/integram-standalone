/**
 * Dropbox Integration Provider
 *
 * Implements Dropbox-specific integration features:
 * - OAuth2 authentication
 * - Upload recordings to Dropbox
 * - Folder management
 * - Shared links
 */

import logger from '../../../utils/logger.js'

export class DropboxProvider {
  constructor(config) {
    this.clientId = config.clientId || process.env.DROPBOX_CLIENT_ID
    this.clientSecret = config.clientSecret || process.env.DROPBOX_CLIENT_SECRET
    this.apiBaseUrl = 'https://api.dropboxapi.com/2'
    this.contentApiUrl = 'https://content.dropboxapi.com/2'
  }

  /**
   * Upload file to Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {string} path - File path in Dropbox
   * @param {Buffer} fileData - File data
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(accessToken, path, fileData) {
    try {
      const response = await fetch(`${this.contentApiUrl}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path,
            mode: 'add',
            autorename: true,
            mute: false
          })
        },
        body: fileData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Uploaded file to Dropbox', { path })

      return data
    } catch (error) {
      logger.error('Failed to upload file to Dropbox', { error: error.message, path })
      throw error
    }
  }

  /**
   * Upload recording to Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {Object} recording - Recording metadata
   * @param {Buffer} recordingData - Recording file data
   * @param {string} folderPath - Target folder path (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadRecording(accessToken, recording, recordingData, folderPath = '/DronDoc Recordings') {
    try {
      // Create folder if it doesn't exist
      await this.createFolder(accessToken, folderPath)

      // Create subfolder for meeting if it has a title
      let targetPath = folderPath
      if (recording.title) {
        const meetingFolder = `${folderPath}/${recording.title}`
        await this.createFolder(accessToken, meetingFolder)
        targetPath = meetingFolder
      }

      const fileName = recording.fileName || `recording-${recording.id}.${recording.format || 'webm'}`
      const filePath = `${targetPath}/${fileName}`

      const uploadResult = await this.uploadFile(accessToken, filePath, recordingData)

      // Create shared link
      const sharedLink = await this.createSharedLink(accessToken, filePath)

      return {
        path: uploadResult.path_display,
        id: uploadResult.id,
        sharedLink: sharedLink.url
      }
    } catch (error) {
      logger.error('Failed to upload recording to Dropbox', { error: error.message, recordingId: recording.id })
      throw error
    }
  }

  /**
   * Create folder in Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {string} path - Folder path
   * @returns {Promise<Object>} Folder metadata
   */
  async createFolder(accessToken, path) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/files/create_folder_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path,
          autorename: false
        })
      })

      if (!response.ok) {
        const error = await response.json()

        // Folder already exists is not an error
        if (error.error?.path?.['.tag'] === 'conflict') {
          logger.debug('Dropbox folder already exists', { path })
          return { path, exists: true }
        }

        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Created Dropbox folder', { path })

      return data.metadata
    } catch (error) {
      logger.error('Failed to create Dropbox folder', { error: error.message, path })
      throw error
    }
  }

  /**
   * Create shared link
   * @param {string} accessToken - OAuth access token
   * @param {string} path - File path
   * @returns {Promise<Object>} Shared link data
   */
  async createSharedLink(accessToken, path) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/sharing/create_shared_link_with_settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path,
          settings: {
            requested_visibility: 'public'
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()

        // Link already exists - get existing link
        if (error.error?.['.tag'] === 'shared_link_already_exists') {
          return await this.getSharedLink(accessToken, path)
        }

        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Created Dropbox shared link', { path })

      return data
    } catch (error) {
      logger.error('Failed to create Dropbox shared link', { error: error.message, path })
      throw error
    }
  }

  /**
   * Get existing shared link
   * @param {string} accessToken - OAuth access token
   * @param {string} path - File path
   * @returns {Promise<Object>} Shared link data
   */
  async getSharedLink(accessToken, path) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/sharing/list_shared_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get shared link')
      }

      const data = await response.json()

      if (data.links && data.links.length > 0) {
        return data.links[0]
      }

      throw new Error('No shared link found')
    } catch (error) {
      logger.error('Failed to get Dropbox shared link', { error: error.message, path })
      throw error
    }
  }

  /**
   * List files in folder
   * @param {string} accessToken - OAuth access token
   * @param {string} path - Folder path (empty string for root)
   * @returns {Promise<Array>} List of files
   */
  async listFiles(accessToken, path = '') {
    try {
      const response = await fetch(`${this.apiBaseUrl}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Listed Dropbox files', { path, count: data.entries?.length || 0 })

      return data.entries || []
    } catch (error) {
      logger.error('Failed to list Dropbox files', { error: error.message, path })
      throw error
    }
  }

  /**
   * Delete file
   * @param {string} accessToken - OAuth access token
   * @param {string} path - File path
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(accessToken, path) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      logger.info('Deleted Dropbox file', { path })

      return true
    } catch (error) {
      logger.error('Failed to delete Dropbox file', { error: error.message, path })
      throw error
    }
  }

  /**
   * Get account info
   * @param {string} accessToken - OAuth access token
   * @returns {Promise<Object>} Account info
   */
  async getAccountInfo(accessToken) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users/get_current_account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Dropbox API error: ${error.error_summary || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Retrieved Dropbox account info')

      return data
    } catch (error) {
      logger.error('Failed to get Dropbox account info', { error: error.message })
      throw error
    }
  }
}

export default DropboxProvider

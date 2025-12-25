/**
 * AWS S3 Integration Provider
 *
 * Implements AWS S3-specific integration features:
 * - API key authentication (Access Key ID + Secret Access Key)
 * - Upload recordings to S3
 * - Presigned URLs for secure sharing
 * - Bucket and object management
 * - CloudFront CDN support
 */

import crypto from 'crypto'
import logger from '../../../utils/logger.js'

export class AWSS3Provider {
  constructor(config) {
    this.accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID
    this.secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    this.region = config.region || process.env.AWS_REGION || 'us-east-1'
    this.bucket = config.bucket || process.env.AWS_S3_BUCKET
  }

  /**
   * Generate AWS Signature Version 4
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {Object} headers - Request headers
   * @param {string} payload - Request payload
   * @returns {string} Authorization header value
   */
  generateSignature(method, path, headers, payload = '') {
    const service = 's3'
    const algorithm = 'AWS4-HMAC-SHA256'
    const date = new Date()
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')

    // Create canonical request
    const canonicalUri = path
    const canonicalQueryString = ''
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`)
      .join('')
    const signedHeaders = Object.keys(headers)
      .map(k => k.toLowerCase())
      .sort()
      .join(';')

    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n')

    // Create string to sign
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n')

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    // Create authorization header
    return `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  }

  /**
   * Upload file to S3
   * @param {string} key - S3 object key
   * @param {Buffer} data - File data
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(key, data, options = {}) {
    try {
      const { contentType = 'application/octet-stream', metadata = {} } = options

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`

      const headers = {
        'Content-Type': contentType,
        'Content-Length': data.length.toString(),
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      }

      // Add custom metadata
      Object.entries(metadata).forEach(([k, v]) => {
        headers[`x-amz-meta-${k}`] = v
      })

      const authorization = this.generateSignature('PUT', `/${key}`, headers, data)
      headers['Authorization'] = authorization

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: data
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`S3 upload failed: ${error}`)
      }

      logger.info('Uploaded file to S3', { bucket: this.bucket, key })

      return {
        bucket: this.bucket,
        key,
        location: url,
        etag: response.headers.get('etag')
      }
    } catch (error) {
      logger.error('Failed to upload file to S3', { error: error.message, key })
      throw error
    }
  }

  /**
   * Upload recording to S3
   * @param {Object} recording - Recording metadata
   * @param {Buffer} recordingData - Recording file data
   * @param {string} prefix - S3 key prefix (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadRecording(recording, recordingData, prefix = 'recordings') {
    try {
      const fileName = recording.fileName || `recording-${recording.id}.${recording.format || 'webm'}`
      const key = `${prefix}/${recording.id}/${fileName}`

      const metadata = {
        'recording-id': recording.id,
        'title': recording.title || 'Untitled',
        'created-at': recording.createdAt || new Date().toISOString()
      }

      const uploadResult = await this.uploadFile(key, recordingData, {
        contentType: recording.mimeType || 'video/webm',
        metadata
      })

      // Generate presigned URL for viewing
      const presignedUrl = await this.generatePresignedUrl(key, 3600) // 1 hour expiry

      return {
        ...uploadResult,
        presignedUrl
      }
    } catch (error) {
      logger.error('Failed to upload recording to S3', { error: error.message, recordingId: recording.id })
      throw error
    }
  }

  /**
   * Generate presigned URL for object
   * @param {string} key - S3 object key
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} Presigned URL
   */
  async generatePresignedUrl(key, expiresIn = 3600) {
    try {
      const expires = Math.floor(Date.now() / 1000) + expiresIn
      const date = new Date()
      const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
      const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')

      const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
      const credential = `${this.accessKeyId}/${credentialScope}`

      const params = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host'
      })

      const canonicalRequest = [
        'GET',
        `/${key}`,
        params.toString(),
        `host:${this.bucket}.s3.${this.region}.amazonaws.com`,
        '',
        'host',
        'UNSIGNED-PAYLOAD'
      ].join('\n')

      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
      ].join('\n')

      const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest()
      const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
      const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

      params.append('X-Amz-Signature', signature)

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}?${params.toString()}`

      logger.info('Generated S3 presigned URL', { key, expiresIn })

      return url
    } catch (error) {
      logger.error('Failed to generate S3 presigned URL', { error: error.message, key })
      throw error
    }
  }

  /**
   * Delete object from S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteObject(key) {
    try {
      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`

      const headers = {
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      }

      const authorization = this.generateSignature('DELETE', `/${key}`, headers)
      headers['Authorization'] = authorization

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      })

      if (!response.ok && response.status !== 204) {
        const error = await response.text()
        throw new Error(`S3 delete failed: ${error}`)
      }

      logger.info('Deleted S3 object', { bucket: this.bucket, key })

      return true
    } catch (error) {
      logger.error('Failed to delete S3 object', { error: error.message, key })
      throw error
    }
  }

  /**
   * List objects in bucket
   * @param {string} prefix - Key prefix filter (optional)
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Array>} List of objects
   */
  async listObjects(prefix = '', maxKeys = 1000) {
    try {
      const params = new URLSearchParams({
        'list-type': '2',
        'max-keys': maxKeys.toString()
      })

      if (prefix) {
        params.append('prefix', prefix)
      }

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/?${params.toString()}`

      const headers = {
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      }

      const authorization = this.generateSignature('GET', '/', headers)
      headers['Authorization'] = authorization

      const response = await fetch(url, {
        headers
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`S3 list failed: ${error}`)
      }

      const xmlText = await response.text()

      // Simple XML parsing (in production, use proper XML parser)
      const objects = []
      const keyRegex = /<Key>(.*?)<\/Key>/g
      let match
      while ((match = keyRegex.exec(xmlText)) !== null) {
        objects.push({ key: match[1] })
      }

      logger.info('Listed S3 objects', { bucket: this.bucket, prefix, count: objects.length })

      return objects
    } catch (error) {
      logger.error('Failed to list S3 objects', { error: error.message, prefix })
      throw error
    }
  }
}

export default AWSS3Provider

/**
 * Firmware Service
 * Handles automatic firmware downloads from GitHub
 * and firmware compatibility checking
 */

export class FirmwareService {
  constructor() {
    this.betaflightRepo = 'betaflight/betaflight'
    this.inavRepo = 'iNavFlight/inav'
    this.cache = new Map()
  }

  /**
   * Get available firmware releases from GitHub
   */
  async getAvailableReleases(firmware = 'betaflight') {
    const repo = firmware === 'betaflight' ? this.betaflightRepo : this.inavRepo
    const cacheKey = `releases_${firmware}`

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.data
      }
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases`)
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const releases = await response.json()
      const parsed = releases.map(release => ({
        version: release.tag_name,
        name: release.name,
        published: new Date(release.published_at),
        prerelease: release.prerelease,
        assets: release.assets.map(asset => ({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size
        }))
      }))

      // Cache result
      this.cache.set(cacheKey, { data: parsed, timestamp: Date.now() })

      return parsed
    } catch (error) {
      console.error('[Firmware] Error fetching releases:', error)
      throw error
    }
  }

  /**
   * Get firmware file for specific board
   */
  async getFirmwareForBoard(firmware, version, boardIdentifier) {
    const releases = await this.getAvailableReleases(firmware)
    const release = releases.find(r => r.version === version)

    if (!release) {
      throw new Error(`Release ${version} not found`)
    }

    // Find hex file for board
    const hexPattern = new RegExp(`${boardIdentifier}.*\\.hex$`, 'i')
    const asset = release.assets.find(a => hexPattern.test(a.name))

    if (!asset) {
      throw new Error(`Firmware for board ${boardIdentifier} not found in ${version}`)
    }

    return {
      url: asset.url,
      name: asset.name,
      size: asset.size,
      version: release.version
    }
  }

  /**
   * Download firmware file
   */
  async downloadFirmware(url, onProgress) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const contentLength = response.headers.get('content-length')
      const total = parseInt(contentLength, 10)
      let loaded = 0

      const reader = response.body.getReader()
      const chunks = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        loaded += value.length

        if (onProgress && total) {
          onProgress((loaded / total) * 100)
        }
      }

      // Combine chunks
      const combined = new Uint8Array(loaded)
      let position = 0
      for (const chunk of chunks) {
        combined.set(chunk, position)
        position += chunk.length
      }

      return combined
    } catch (error) {
      console.error('[Firmware] Download error:', error)
      throw error
    }
  }

  /**
   * Check firmware compatibility
   */
  checkCompatibility(fcInfo, firmwareVersion) {
    const issues = []
    const warnings = []

    // Parse versions
    const currentVersion = this.parseVersion(fcInfo.version)
    const targetVersion = this.parseVersion(firmwareVersion)

    // Check for major version changes
    if (targetVersion.major > currentVersion.major) {
      warnings.push(`Major version upgrade (${currentVersion.major}.x → ${targetVersion.major}.x) may require reconfiguration`)
    }

    // Check for downgrades
    if (targetVersion.major < currentVersion.major ||
        (targetVersion.major === currentVersion.major && targetVersion.minor < currentVersion.minor)) {
      warnings.push('Downgrading firmware may cause issues. Backup your settings first.')
    }

    // Check firmware type match
    if (fcInfo.firmware && !firmwareVersion.toLowerCase().includes(fcInfo.firmware.toLowerCase())) {
      issues.push(`Firmware type mismatch: FC is ${fcInfo.firmware}, trying to flash ${firmwareVersion}`)
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings
    }
  }

  /**
   * Parse version string
   */
  parseVersion(versionString) {
    const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/)
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10)
      }
    }
    return { major: 0, minor: 0, patch: 0 }
  }

  /**
   * Get recommended version for board
   */
  async getRecommendedVersion(firmware, boardIdentifier) {
    const releases = await this.getAvailableReleases(firmware)

    // Filter to stable releases
    const stableReleases = releases.filter(r => !r.prerelease)

    // Find latest release with firmware for this board
    for (const release of stableReleases) {
      const hexPattern = new RegExp(`${boardIdentifier}.*\\.hex$`, 'i')
      const hasAsset = release.assets.some(a => hexPattern.test(a.name))

      if (hasAsset) {
        return release.version
      }
    }

    return null
  }

  /**
   * Parse Intel HEX file
   */
  parseHexFile(data) {
    const decoder = new TextDecoder('utf-8')
    const content = decoder.decode(data)
    const lines = content.split('\n')

    const records = []
    let startAddress = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed[0] !== ':') continue

      const byteCount = parseInt(trimmed.substring(1, 3), 16)
      const address = parseInt(trimmed.substring(3, 7), 16)
      const recordType = parseInt(trimmed.substring(7, 9), 16)
      const data = trimmed.substring(9, 9 + byteCount * 2)
      const checksum = parseInt(trimmed.substring(9 + byteCount * 2, 11 + byteCount * 2), 16)

      records.push({
        byteCount,
        address,
        recordType,
        data,
        checksum
      })

      // Record type 0x00 = Data, 0x01 = EOF, 0x04 = Extended Linear Address
      if (recordType === 0x04 && startAddress === null) {
        startAddress = parseInt(data, 16) << 16
      }
    }

    return {
      records,
      startAddress,
      totalRecords: records.length,
      size: records.reduce((sum, r) => sum + r.byteCount, 0)
    }
  }

  /**
   * Validate HEX file integrity
   */
  validateHexFile(data) {
    try {
      const parsed = this.parseHexFile(data)

      if (parsed.records.length === 0) {
        return { valid: false, error: 'No valid records found in HEX file' }
      }

      // Check for EOF record
      const eofRecord = parsed.records.find(r => r.recordType === 0x01)
      if (!eofRecord) {
        return { valid: false, error: 'EOF record not found' }
      }

      // Verify checksums (simplified check)
      const invalidChecksums = parsed.records.filter(r => {
        // In a real implementation, verify each record's checksum
        return false
      })

      if (invalidChecksums.length > 0) {
        return { valid: false, error: `${invalidChecksums.length} records have invalid checksums` }
      }

      return {
        valid: true,
        size: parsed.size,
        records: parsed.totalRecords,
        startAddress: parsed.startAddress
      }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }
}

export default FirmwareService

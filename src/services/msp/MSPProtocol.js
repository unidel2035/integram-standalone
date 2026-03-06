import { logger } from '@/utils/logger'

/**
 * MSP (MultiWii Serial Protocol) Implementation
 * Supports both MSP v1 and MSP v2 protocols
 *
 * MSP v1 Format:
 * Header: $M< or $M> or $M!
 * Size: 1 byte (payload length)
 * Command: 1 byte
 * Payload: 0-255 bytes
 * Checksum: 1 byte (XOR of size, command, and payload)
 *
 * MSP v2 Format:
 * Header: $X< or $X> or $X!
 * Flag: 1 byte
 * Function: 2 bytes (little-endian)
 * Payload Size: 2 bytes (little-endian)
 * Payload: 0-65535 bytes
 * Checksum: 1 byte (CRC8-DVB-S2)
 */

// MSP v1 Constants
const MSP_V1_HEADER = [0x24, 0x4D] // $M
const MSP_V1_FROM_MWI = 0x3E // >
const MSP_V1_TO_MWI = 0x3C // <
const MSP_V1_ERROR = 0x21 // !

// MSP v2 Constants
const MSP_V2_HEADER = [0x24, 0x58] // $X
const MSP_V2_FROM_MWI = 0x3E // >
const MSP_V2_TO_MWI = 0x3C // <
const MSP_V2_ERROR = 0x21 // !

// MSP Commands (Common)
export const MSP_API_VERSION = 1
export const MSP_FC_VARIANT = 2
export const MSP_FC_VERSION = 3
export const MSP_BOARD_INFO = 4
export const MSP_BUILD_INFO = 5
export const MSP_NAME = 10
export const MSP_STATUS = 101
export const MSP_RAW_IMU = 102
export const MSP_SERVO = 103
export const MSP_MOTOR = 104
export const MSP_RC = 105
export const MSP_RAW_GPS = 106
export const MSP_ATTITUDE = 108
export const MSP_ALTITUDE = 109
export const MSP_ANALOG = 110
export const MSP_PID = 112
export const MSP_SET_PID = 202
export const MSP_RC_TUNING = 111
export const MSP_SET_RC_TUNING = 204
export const MSP_BOXNAMES = 116
export const MSP_BOXIDS = 119
export const MSP_MODE_RANGES = 34
export const MSP_SET_MODE_RANGE = 35
export const MSP_REBOOT = 68
export const MSP_EEPROM_WRITE = 250
export const MSP_SET_MOTOR = 214
export const MSP_UID = 160
export const MSP_DATAFLASH_SUMMARY = 70
export const MSP_DATAFLASH_READ = 71
export const MSP_DATAFLASH_ERASE = 72
export const MSP_SET_RAW_RC = 200

export class MSPProtocol {
  constructor() {
    this.version = 1 // Default to v1
    this.buffer = []
    this.callbacks = new Map()
    this.messageId = 0
  }

  /**
   * Auto-detect MSP protocol version
   */
  async detectVersion(port) {
    logger.debug('[MSP] Detecting protocol version...')

    try {
      // Try MSP v2 first (send API_VERSION request)
      const v2Response = await this.sendCommand(port, MSP_API_VERSION, [], 2)
      if (v2Response) {
        this.version = 2
        logger.debug('[MSP] Detected MSP v2')
        return 2
      }
    } catch (error) {
      logger.debug('[MSP] MSP v2 detection failed, trying v1...')
    }

    try {
      // Try MSP v1
      const v1Response = await this.sendCommand(port, MSP_API_VERSION, [], 1)
      if (v1Response) {
        this.version = 1
        logger.debug('[MSP] Detected MSP v1')
        return 1
      }
    } catch (error) {
      console.error('[MSP] MSP v1 detection failed')
    }

    // Default to v1
    this.version = 1
    logger.debug('[MSP] Could not detect version, defaulting to MSP v1')
    return 1
  }

  /**
   * Encode MSP v1 message
   */
  encodeMSPv1(command, payload = []) {
    const size = payload.length
    const message = [
      ...MSP_V1_HEADER,
      MSP_V1_TO_MWI,
      size,
      command,
      ...payload
    ]

    // Calculate checksum (XOR)
    let checksum = size ^ command
    for (const byte of payload) {
      checksum ^= byte
    }
    message.push(checksum)

    return new Uint8Array(message)
  }

  /**
   * Encode MSP v2 message
   */
  encodeMSPv2(command, payload = []) {
    const flag = 0
    const payloadSize = payload.length
    const message = [
      ...MSP_V2_HEADER,
      MSP_V2_TO_MWI,
      flag,
      command & 0xFF,
      (command >> 8) & 0xFF,
      payloadSize & 0xFF,
      (payloadSize >> 8) & 0xFF,
      ...payload
    ]

    // Calculate CRC8-DVB-S2 checksum
    const checksum = this.crc8DvbS2(message.slice(3))
    message.push(checksum)

    return new Uint8Array(message)
  }

  /**
   * CRC8-DVB-S2 checksum calculation
   */
  crc8DvbS2(data) {
    let crc = 0
    for (const byte of data) {
      crc ^= byte
      for (let i = 0; i < 8; i++) {
        if (crc & 0x80) {
          crc = ((crc << 1) ^ 0xD5) & 0xFF
        } else {
          crc = (crc << 1) & 0xFF
        }
      }
    }
    return crc
  }

  /**
   * Decode MSP v1 response
   */
  decodeMSPv1(data) {
    if (data.length < 6) {
      return null
    }

    // Check header
    if (data[0] !== MSP_V1_HEADER[0] || data[1] !== MSP_V1_HEADER[1]) {
      return null
    }

    const direction = data[2]
    const size = data[3]
    const command = data[4]
    const payload = Array.from(data.slice(5, 5 + size))
    const checksum = data[5 + size]

    // Verify checksum
    let calculatedChecksum = size ^ command
    for (const byte of payload) {
      calculatedChecksum ^= byte
    }

    if (calculatedChecksum !== checksum) {
      console.error('[MSP] v1 checksum mismatch')
      return null
    }

    return {
      version: 1,
      direction,
      command,
      payload,
      error: direction === MSP_V1_ERROR
    }
  }

  /**
   * Decode MSP v2 response
   */
  decodeMSPv2(data) {
    if (data.length < 9) {
      return null
    }

    // Check header
    if (data[0] !== MSP_V2_HEADER[0] || data[1] !== MSP_V2_HEADER[1]) {
      return null
    }

    const direction = data[2]
    const flag = data[3]
    const command = data[4] | (data[5] << 8)
    const payloadSize = data[6] | (data[7] << 8)
    const payload = Array.from(data.slice(8, 8 + payloadSize))
    const checksum = data[8 + payloadSize]

    // Verify checksum
    const calculatedChecksum = this.crc8DvbS2(data.slice(3, 8 + payloadSize))

    if (calculatedChecksum !== checksum) {
      console.error('[MSP] v2 checksum mismatch')
      return null
    }

    return {
      version: 2,
      direction,
      flag,
      command,
      payload,
      error: direction === MSP_V2_ERROR
    }
  }

  /**
   * Send MSP command and wait for response
   */
  async sendCommand(port, command, payload = [], version = null) {
    const useVersion = version || this.version
    logger.debug(`[MSP] Sending command ${command} (v${useVersion})`)

    const message = useVersion === 2
      ? this.encodeMSPv2(command, payload)
      : this.encodeMSPv1(command, payload)

    // Send message
    if (port.writer) {
      await port.writer.write(message)
    } else if (port.writable) {
      const writer = port.writable.getWriter()
      await writer.write(message)
      writer.releaseLock()
    } else {
      throw new Error('No writable port available')
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      const messageId = this.messageId++
      const timeout = setTimeout(() => {
        this.callbacks.delete(messageId)
        reject(new Error(`MSP command ${command} timeout`))
      }, 3000)

      this.callbacks.set(messageId, (response) => {
        clearTimeout(timeout)
        if (response.error) {
          reject(new Error(`MSP command ${command} returned error`))
        } else {
          resolve(response)
        }
      })

      // Store command for matching response
      this.callbacks.get(messageId).command = command
    })
  }

  /**
   * Process incoming data
   */
  processData(data) {
    // Add to buffer
    this.buffer.push(...Array.from(data))

    // Try to parse messages
    while (this.buffer.length > 0) {
      // Check for MSP v1 header
      if (this.buffer[0] === MSP_V1_HEADER[0] && this.buffer.length > 1 && this.buffer[1] === MSP_V1_HEADER[1]) {
        if (this.buffer.length < 6) break // Need more data

        const size = this.buffer[3]
        const totalLength = 6 + size
        if (this.buffer.length < totalLength) break // Need more data

        const messageData = new Uint8Array(this.buffer.slice(0, totalLength))
        const decoded = this.decodeMSPv1(messageData)

        if (decoded) {
          this.handleMessage(decoded)
          this.buffer = this.buffer.slice(totalLength)
        } else {
          // Invalid message, skip header
          this.buffer.shift()
        }
      }
      // Check for MSP v2 header
      else if (this.buffer[0] === MSP_V2_HEADER[0] && this.buffer.length > 1 && this.buffer[1] === MSP_V2_HEADER[1]) {
        if (this.buffer.length < 9) break // Need more data

        const payloadSize = this.buffer[6] | (this.buffer[7] << 8)
        const totalLength = 9 + payloadSize
        if (this.buffer.length < totalLength) break // Need more data

        const messageData = new Uint8Array(this.buffer.slice(0, totalLength))
        const decoded = this.decodeMSPv2(messageData)

        if (decoded) {
          this.handleMessage(decoded)
          this.buffer = this.buffer.slice(totalLength)
        } else {
          // Invalid message, skip header
          this.buffer.shift()
        }
      } else {
        // Not a valid header, skip byte
        this.buffer.shift()
      }
    }
  }

  /**
   * Handle decoded message
   */
  handleMessage(message) {
    logger.debug('[MSP] Received message:', message)

    // Find matching callback
    for (const [id, callback] of this.callbacks.entries()) {
      if (callback.command === message.command) {
        callback(message)
        this.callbacks.delete(id)
        return
      }
    }

    // No callback found, might be unsolicited message
    logger.debug('[MSP] No callback found for command:', message.command)
  }

  /**
   * Helper: Read uint8 from payload
   */
  readU8(payload, offset = 0) {
    return payload[offset]
  }

  /**
   * Helper: Read uint16 (little-endian)
   */
  readU16(payload, offset = 0) {
    return payload[offset] | (payload[offset + 1] << 8)
  }

  /**
   * Helper: Read uint32 (little-endian)
   */
  readU32(payload, offset = 0) {
    return payload[offset] | (payload[offset + 1] << 8) | (payload[offset + 2] << 16) | (payload[offset + 3] << 24)
  }

  /**
   * Helper: Read int16 (little-endian)
   */
  readI16(payload, offset = 0) {
    const value = this.readU16(payload, offset)
    return value > 32767 ? value - 65536 : value
  }

  /**
   * Helper: Write uint8
   */
  writeU8(value) {
    return [value & 0xFF]
  }

  /**
   * Helper: Write uint16 (little-endian)
   */
  writeU16(value) {
    return [value & 0xFF, (value >> 8) & 0xFF]
  }

  /**
   * Helper: Write uint32 (little-endian)
   */
  writeU32(value) {
    return [
      value & 0xFF,
      (value >> 8) & 0xFF,
      (value >> 16) & 0xFF,
      (value >> 24) & 0xFF
    ]
  }

  /**
   * Helper: Write int16 (little-endian)
   */
  writeI16(value) {
    const unsigned = value < 0 ? value + 65536 : value
    return this.writeU16(unsigned)
  }
}

export default MSPProtocol

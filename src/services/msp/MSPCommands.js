/**
 * MSP Commands - High-level API for MSP protocol
 * Implements common MSP commands for BetaFlight/iNav/Cleanflight
 */

import {
  MSP_API_VERSION,
  MSP_FC_VARIANT,
  MSP_FC_VERSION,
  MSP_BOARD_INFO,
  MSP_BUILD_INFO,
  MSP_NAME,
  MSP_STATUS,
  MSP_RAW_IMU,
  MSP_MOTOR,
  MSP_RC,
  MSP_ATTITUDE,
  MSP_ALTITUDE,
  MSP_ANALOG,
  MSP_PID,
  MSP_SET_PID,
  MSP_RC_TUNING,
  MSP_SET_RC_TUNING,
  MSP_BOXNAMES,
  MSP_MODE_RANGES,
  MSP_SET_MODE_RANGE,
  MSP_EEPROM_WRITE,
  MSP_SET_MOTOR,
  MSP_UID,
  MSP_DATAFLASH_SUMMARY,
  MSP_DATAFLASH_READ,
  MSP_SET_RAW_RC
} from './MSPProtocol.js'

export class MSPCommands {
  constructor(msp) {
    this.msp = msp
  }

  /**
   * Get API version
   */
  async getApiVersion(port) {
    const response = await this.msp.sendCommand(port, MSP_API_VERSION)
    const protocol = this.msp.readU8(response.payload, 0)
    const apiVersionMajor = this.msp.readU8(response.payload, 1)
    const apiVersionMinor = this.msp.readU8(response.payload, 2)

    return {
      protocol,
      version: `${apiVersionMajor}.${apiVersionMinor}`
    }
  }

  /**
   * Get FC variant (BTFL, INAV, CLFL, etc.)
   */
  async getFCVariant(port) {
    const response = await this.msp.sendCommand(port, MSP_FC_VARIANT)
    const variant = String.fromCharCode(...response.payload).trim()
    return variant
  }

  /**
   * Get FC version
   */
  async getFCVersion(port) {
    const response = await this.msp.sendCommand(port, MSP_FC_VERSION)
    const major = this.msp.readU8(response.payload, 0)
    const minor = this.msp.readU8(response.payload, 1)
    const patch = this.msp.readU8(response.payload, 2)

    return {
      major,
      minor,
      patch,
      version: `${major}.${minor}.${patch}`
    }
  }

  /**
   * Get board info
   */
  async getBoardInfo(port) {
    const response = await this.msp.sendCommand(port, MSP_BOARD_INFO)
    const boardIdentifier = String.fromCharCode(...response.payload.slice(0, 4)).trim()
    const hardwareRevision = this.msp.readU16(response.payload, 4)

    return {
      boardIdentifier,
      hardwareRevision
    }
  }

  /**
   * Get build info
   */
  async getBuildInfo(port) {
    const response = await this.msp.sendCommand(port, MSP_BUILD_INFO)
    const buildDate = String.fromCharCode(...response.payload.slice(0, 11)).trim()
    const buildTime = String.fromCharCode(...response.payload.slice(11, 19)).trim()
    const gitRevision = String.fromCharCode(...response.payload.slice(19)).trim()

    return {
      buildDate,
      buildTime,
      gitRevision
    }
  }

  /**
   * Get craft name
   */
  async getName(port) {
    const response = await this.msp.sendCommand(port, MSP_NAME)
    const name = String.fromCharCode(...response.payload).trim()
    return name || 'Unnamed'
  }

  /**
   * Get flight controller status
   */
  async getStatus(port) {
    const response = await this.msp.sendCommand(port, MSP_STATUS)
    const cycleTime = this.msp.readU16(response.payload, 0)
    const i2cError = this.msp.readU16(response.payload, 2)
    const sensors = this.msp.readU16(response.payload, 4)
    const flags = this.msp.readU32(response.payload, 6)
    const currentProfileIndex = this.msp.readU8(response.payload, 10)

    return {
      cycleTime,
      i2cError,
      sensors,
      flags,
      currentProfileIndex,
      armed: (flags & 1) !== 0
    }
  }

  /**
   * Get raw IMU data
   */
  async getRawIMU(port) {
    const response = await this.msp.sendCommand(port, MSP_RAW_IMU)

    return {
      acc: {
        x: this.msp.readI16(response.payload, 0),
        y: this.msp.readI16(response.payload, 2),
        z: this.msp.readI16(response.payload, 4)
      },
      gyro: {
        x: this.msp.readI16(response.payload, 6),
        y: this.msp.readI16(response.payload, 8),
        z: this.msp.readI16(response.payload, 10)
      },
      mag: {
        x: this.msp.readI16(response.payload, 12),
        y: this.msp.readI16(response.payload, 14),
        z: this.msp.readI16(response.payload, 16)
      }
    }
  }

  /**
   * Get motor values
   */
  async getMotor(port) {
    const response = await this.msp.sendCommand(port, MSP_MOTOR)
    const motors = []
    for (let i = 0; i < response.payload.length / 2; i++) {
      motors.push(this.msp.readU16(response.payload, i * 2))
    }
    return motors
  }

  /**
   * Set motor values (for motor test)
   */
  async setMotor(port, motorValues) {
    const payload = []
    for (const value of motorValues) {
      payload.push(...this.msp.writeU16(value))
    }
    await this.msp.sendCommand(port, MSP_SET_MOTOR, payload)
  }

  /**
   * Get RC channels
   */
  async getRC(port) {
    const response = await this.msp.sendCommand(port, MSP_RC)
    const channels = []
    for (let i = 0; i < response.payload.length / 2; i++) {
      channels.push(this.msp.readU16(response.payload, i * 2))
    }
    return channels
  }

  /**
   * Set raw RC channels
   */
  async setRawRC(port, channels) {
    const payload = []
    for (const value of channels) {
      payload.push(...this.msp.writeU16(value))
    }
    await this.msp.sendCommand(port, MSP_SET_RAW_RC, payload)
  }

  /**
   * Get attitude (angles)
   */
  async getAttitude(port) {
    const response = await this.msp.sendCommand(port, MSP_ATTITUDE)

    return {
      roll: this.msp.readI16(response.payload, 0) / 10,
      pitch: this.msp.readI16(response.payload, 2) / 10,
      yaw: this.msp.readI16(response.payload, 4)
    }
  }

  /**
   * Get altitude
   */
  async getAltitude(port) {
    const response = await this.msp.sendCommand(port, MSP_ALTITUDE)

    return {
      altitude: this.msp.readI32(response.payload, 0) / 100, // cm to m
      vario: this.msp.readI16(response.payload, 4) / 100 // cm/s to m/s
    }
  }

  /**
   * Get analog values (voltage, amperage, etc.)
   */
  async getAnalog(port) {
    const response = await this.msp.sendCommand(port, MSP_ANALOG)

    return {
      voltage: this.msp.readU8(response.payload, 0) / 10,
      mahDrawn: this.msp.readU16(response.payload, 1),
      rssi: this.msp.readU16(response.payload, 3),
      amperage: this.msp.readI16(response.payload, 5) / 100
    }
  }

  /**
   * Get PID values
   */
  async getPID(port) {
    const response = await this.msp.sendCommand(port, MSP_PID)
    const pids = []

    for (let i = 0; i < response.payload.length; i += 3) {
      pids.push({
        p: this.msp.readU8(response.payload, i),
        i: this.msp.readU8(response.payload, i + 1),
        d: this.msp.readU8(response.payload, i + 2)
      })
    }

    return {
      roll: pids[0] || { p: 0, i: 0, d: 0 },
      pitch: pids[1] || { p: 0, i: 0, d: 0 },
      yaw: pids[2] || { p: 0, i: 0, d: 0 }
    }
  }

  /**
   * Set PID values
   */
  async setPID(port, pidSettings) {
    const payload = []

    // Roll
    payload.push(...this.msp.writeU8(pidSettings.roll.p))
    payload.push(...this.msp.writeU8(pidSettings.roll.i))
    payload.push(...this.msp.writeU8(pidSettings.roll.d))

    // Pitch
    payload.push(...this.msp.writeU8(pidSettings.pitch.p))
    payload.push(...this.msp.writeU8(pidSettings.pitch.i))
    payload.push(...this.msp.writeU8(pidSettings.pitch.d))

    // Yaw
    payload.push(...this.msp.writeU8(pidSettings.yaw.p))
    payload.push(...this.msp.writeU8(pidSettings.yaw.i))
    payload.push(...this.msp.writeU8(pidSettings.yaw.d))

    await this.msp.sendCommand(port, MSP_SET_PID, payload)
  }

  /**
   * Get RC tuning (rates)
   */
  async getRCTuning(port) {
    const response = await this.msp.sendCommand(port, MSP_RC_TUNING)

    return {
      roll: {
        rcRate: this.msp.readU8(response.payload, 0) / 100,
        rcExpo: this.msp.readU8(response.payload, 1) / 100,
        superRate: this.msp.readU8(response.payload, 3) / 100
      },
      pitch: {
        rcRate: this.msp.readU8(response.payload, 0) / 100,
        rcExpo: this.msp.readU8(response.payload, 2) / 100,
        superRate: this.msp.readU8(response.payload, 4) / 100
      },
      yaw: {
        rcRate: this.msp.readU8(response.payload, 5) / 100,
        rcExpo: this.msp.readU8(response.payload, 6) / 100,
        superRate: this.msp.readU8(response.payload, 7) / 100
      }
    }
  }

  /**
   * Set RC tuning (rates)
   */
  async setRCTuning(port, ratesSettings) {
    const payload = [
      ...this.msp.writeU8(Math.round(ratesSettings.roll.rcRate * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.roll.rcExpo * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.pitch.rcExpo * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.roll.superRate * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.pitch.superRate * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.yaw.rcRate * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.yaw.rcExpo * 100)),
      ...this.msp.writeU8(Math.round(ratesSettings.yaw.superRate * 100))
    ]

    await this.msp.sendCommand(port, MSP_SET_RC_TUNING, payload)
  }

  /**
   * Get box/mode names
   */
  async getBoxNames(port) {
    const response = await this.msp.sendCommand(port, MSP_BOXNAMES)
    const names = String.fromCharCode(...response.payload).split(';').filter(n => n.length > 0)
    return names
  }

  /**
   * Get mode ranges
   */
  async getModeRanges(port) {
    const response = await this.msp.sendCommand(port, MSP_MODE_RANGES)
    const ranges = []

    for (let i = 0; i < response.payload.length; i += 4) {
      ranges.push({
        id: this.msp.readU8(response.payload, i),
        auxChannelIndex: this.msp.readU8(response.payload, i + 1),
        start: this.msp.readU8(response.payload, i + 2) * 25 + 900,
        end: this.msp.readU8(response.payload, i + 3) * 25 + 900
      })
    }

    return ranges
  }

  /**
   * Set mode range
   */
  async setModeRange(port, modeRange) {
    const payload = [
      ...this.msp.writeU8(modeRange.id),
      ...this.msp.writeU8(modeRange.auxChannelIndex),
      ...this.msp.writeU8((modeRange.start - 900) / 25),
      ...this.msp.writeU8((modeRange.end - 900) / 25)
    ]

    await this.msp.sendCommand(port, MSP_SET_MODE_RANGE, payload)
  }

  /**
   * Save settings to EEPROM
   */
  async saveSettings(port) {
    await this.msp.sendCommand(port, MSP_EEPROM_WRITE)
  }

  /**
   * Get UID (unique identifier)
   */
  async getUID(port) {
    const response = await this.msp.sendCommand(port, MSP_UID)
    const uid = []
    for (let i = 0; i < response.payload.length; i++) {
      uid.push(this.msp.readU8(response.payload, i).toString(16).padStart(2, '0'))
    }
    return uid.join('')
  }

  /**
   * Get dataflash summary (blackbox)
   */
  async getDataflashSummary(port) {
    const response = await this.msp.sendCommand(port, MSP_DATAFLASH_SUMMARY)

    return {
      ready: this.msp.readU8(response.payload, 0) === 1,
      supported: this.msp.readU32(response.payload, 1),
      sectors: this.msp.readU32(response.payload, 5),
      totalSize: this.msp.readU32(response.payload, 9),
      usedSize: this.msp.readU32(response.payload, 13)
    }
  }

  /**
   * Read dataflash (blackbox log)
   */
  async readDataflash(port, address, size) {
    const payload = [
      ...this.msp.writeU32(address),
      ...this.msp.writeU16(size)
    ]

    const response = await this.msp.sendCommand(port, MSP_DATAFLASH_READ, payload)
    return response.payload
  }

  /**
   * Get comprehensive FC info
   */
  async getFullFCInfo(port) {
    try {
      const [apiVersion, variant, version, boardInfo, name, analog] = await Promise.all([
        this.getApiVersion(port),
        this.getFCVariant(port),
        this.getFCVersion(port),
        this.getBoardInfo(port),
        this.getName(port),
        this.getAnalog(port)
      ])

      return {
        api: apiVersion,
        firmware: variant,
        version: version.version,
        board: boardInfo.boardIdentifier,
        name,
        voltage: analog.voltage,
        amperage: analog.amperage,
        rssi: analog.rssi
      }
    } catch (error) {
      console.error('[MSP] Error getting FC info:', error)
      throw error
    }
  }
}

export default MSPCommands

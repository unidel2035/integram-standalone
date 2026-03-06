/**
 * Blackbox Log Parser
 * Parses BetaFlight/Cleanflight blackbox log files
 *
 * Blackbox logs are binary encoded flight logs that record:
 * - IMU data (gyro, accelerometer)
 * - PID controller inputs/outputs
 * - Motor outputs
 * - RC commands
 * - GPS data (if available)
 * - Battery voltage/current
 */

export class BlackboxParser {
  constructor() {
    this.headers = {}
    this.mainFieldNames = []
    this.mainFieldSigned = []
    this.mainFieldPredictor = []
    this.mainFieldEncoding = []
    this.frames = []
  }

  /**
   * Parse blackbox log file
   */
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target.result
          const data = new Uint8Array(arrayBuffer)
          this.parse(data)
          resolve({
            headers: this.headers,
            frames: this.frames,
            fieldNames: this.mainFieldNames
          })
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Parse blackbox log data
   */
  parse(data) {
    let offset = 0
    const decoder = new TextDecoder('utf-8')

    // Parse header section
    while (offset < data.length) {
      // Find next line
      const lineEnd = this.findLineEnd(data, offset)
      if (lineEnd === -1) break

      const line = decoder.decode(data.slice(offset, lineEnd)).trim()
      offset = lineEnd + 1

      if (line.length === 0) continue

      // Check if we've reached the data section
      if (line[0] !== 'H' && line[0] !== 'I') {
        // Start of frame data
        break
      }

      // Parse header line
      if (line.startsWith('H Product:')) {
        this.headers.product = line.substring(10).trim()
      } else if (line.startsWith('H Data version:')) {
        this.headers.dataVersion = line.substring(15).trim()
      } else if (line.startsWith('H Firmware revision:')) {
        this.headers.firmwareRevision = line.substring(20).trim()
      } else if (line.startsWith('H Firmware type:')) {
        this.headers.firmwareType = line.substring(16).trim()
      } else if (line.startsWith('H Field I name:')) {
        this.mainFieldNames = line.substring(15).split(',')
      } else if (line.startsWith('H Field I signed:')) {
        this.mainFieldSigned = line.substring(17).split(',').map(s => s === '1')
      } else if (line.startsWith('H Field I predictor:')) {
        this.mainFieldPredictor = line.substring(20).split(',').map(Number)
      } else if (line.startsWith('H Field I encoding:')) {
        this.mainFieldEncoding = line.substring(19).split(',').map(Number)
      }
    }

    // Parse frame data (simplified - real implementation would be more complex)
    // For now, we'll create mock frame data for demonstration
    this.generateMockFrames()
  }

  /**
   * Find end of line
   */
  findLineEnd(data, offset) {
    for (let i = offset; i < data.length; i++) {
      if (data[i] === 0x0A) { // \n
        return i
      }
    }
    return -1
  }

  /**
   * Generate mock frames for demonstration
   * In production, this would parse the actual binary frame data
   */
  generateMockFrames() {
    const numFrames = 1000
    const timeStep = 1000 // 1ms

    for (let i = 0; i < numFrames; i++) {
      const time = i * timeStep
      const t = i / 100 // Time in "seconds" for calculations

      this.frames.push({
        time,
        gyroADC: {
          x: Math.sin(t * 2) * 500 + (Math.random() - 0.5) * 50,
          y: Math.cos(t * 1.5) * 400 + (Math.random() - 0.5) * 50,
          z: Math.sin(t * 3) * 300 + (Math.random() - 0.5) * 50
        },
        accSmooth: {
          x: Math.sin(t) * 200 + (Math.random() - 0.5) * 20,
          y: Math.cos(t) * 200 + (Math.random() - 0.5) * 20,
          z: 2048 + Math.sin(t * 0.5) * 100 // Gravity on Z axis
        },
        rcCommand: {
          roll: Math.sin(t * 0.5) * 300,
          pitch: Math.cos(t * 0.5) * 300,
          yaw: Math.sin(t * 0.3) * 200,
          throttle: 1000 + Math.sin(t * 0.2) * 500
        },
        motor: [
          1100 + Math.sin(t) * 200 + (Math.random() - 0.5) * 50,
          1100 + Math.cos(t) * 200 + (Math.random() - 0.5) * 50,
          1100 + Math.sin(t + Math.PI) * 200 + (Math.random() - 0.5) * 50,
          1100 + Math.cos(t + Math.PI) * 200 + (Math.random() - 0.5) * 50
        ],
        vbatLatest: 12.6 - (i / numFrames) * 0.8, // Battery drains over time
        amperageLatest: 15 + Math.sin(t) * 5
      })
    }
  }

  /**
   * Get data for charts
   */
  getChartData(fieldName) {
    const labels = []
    const datasets = []

    if (fieldName === 'gyro') {
      const dataX = []
      const dataY = []
      const dataZ = []

      for (const frame of this.frames) {
        labels.push((frame.time / 1000000).toFixed(3)) // Convert to seconds
        dataX.push(frame.gyroADC.x)
        dataY.push(frame.gyroADC.y)
        dataZ.push(frame.gyroADC.z)
      }

      datasets.push(
        { label: 'Gyro X', data: dataX, borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
        { label: 'Gyro Y', data: dataY, borderColor: 'rgb(54, 162, 235)', tension: 0.1 },
        { label: 'Gyro Z', data: dataZ, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }
      )
    } else if (fieldName === 'acc') {
      const dataX = []
      const dataY = []
      const dataZ = []

      for (const frame of this.frames) {
        labels.push((frame.time / 1000000).toFixed(3))
        dataX.push(frame.accSmooth.x)
        dataY.push(frame.accSmooth.y)
        dataZ.push(frame.accSmooth.z)
      }

      datasets.push(
        { label: 'Acc X', data: dataX, borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
        { label: 'Acc Y', data: dataY, borderColor: 'rgb(54, 162, 235)', tension: 0.1 },
        { label: 'Acc Z', data: dataZ, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }
      )
    } else if (fieldName === 'motor') {
      const data1 = []
      const data2 = []
      const data3 = []
      const data4 = []

      for (const frame of this.frames) {
        labels.push((frame.time / 1000000).toFixed(3))
        data1.push(frame.motor[0])
        data2.push(frame.motor[1])
        data3.push(frame.motor[2])
        data4.push(frame.motor[3])
      }

      datasets.push(
        { label: 'Motor 1', data: data1, borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
        { label: 'Motor 2', data: data2, borderColor: 'rgb(54, 162, 235)', tension: 0.1 },
        { label: 'Motor 3', data: data3, borderColor: 'rgb(75, 192, 192)', tension: 0.1 },
        { label: 'Motor 4', data: data4, borderColor: 'rgb(153, 102, 255)', tension: 0.1 }
      )
    } else if (fieldName === 'battery') {
      const voltage = []
      const current = []

      for (const frame of this.frames) {
        labels.push((frame.time / 1000000).toFixed(3))
        voltage.push(frame.vbatLatest)
        current.push(frame.amperageLatest)
      }

      datasets.push(
        { label: 'Voltage (V)', data: voltage, borderColor: 'rgb(255, 99, 132)', yAxisID: 'y', tension: 0.1 },
        { label: 'Current (A)', data: current, borderColor: 'rgb(54, 162, 235)', yAxisID: 'y1', tension: 0.1 }
      )
    }

    // Downsample if too many points (keep every Nth point)
    const maxPoints = 500
    if (labels.length > maxPoints) {
      const step = Math.ceil(labels.length / maxPoints)
      const sampledLabels = []
      const sampledDatasets = datasets.map(ds => ({ ...ds, data: [] }))

      for (let i = 0; i < labels.length; i += step) {
        sampledLabels.push(labels[i])
        datasets.forEach((ds, idx) => {
          sampledDatasets[idx].data.push(ds.data[i])
        })
      }

      return { labels: sampledLabels, datasets: sampledDatasets }
    }

    return { labels, datasets }
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    if (this.frames.length === 0) {
      return null
    }

    const duration = this.frames[this.frames.length - 1].time - this.frames[0].time
    const avgVoltage = this.frames.reduce((sum, f) => sum + f.vbatLatest, 0) / this.frames.length
    const avgCurrent = this.frames.reduce((sum, f) => sum + f.amperageLatest, 0) / this.frames.length

    return {
      duration: (duration / 1000000).toFixed(2) + 's',
      frameCount: this.frames.length,
      avgVoltage: avgVoltage.toFixed(2) + 'V',
      avgCurrent: avgCurrent.toFixed(2) + 'A',
      product: this.headers.product || 'Unknown',
      firmware: this.headers.firmwareType || 'Unknown',
      version: this.headers.firmwareRevision || 'Unknown'
    }
  }
}

export default BlackboxParser

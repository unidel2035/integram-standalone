/**
 * WorkflowSimulator - симулятор выполнения workflow для обучающих уроков
 * Генерирует события и логи в реальном времени
 */

export class WorkflowSimulator extends EventTarget {
  constructor(workflow, options = {}) {
    super()
    this.workflow = workflow
    this.speed = options.speed || 1 // 1 = нормальная, 2 = x2, 0.5 = замедленная
    this.logs = []
    this.metrics = {}
    this.errors = []
    this.isRunning = false
    this.isPaused = false
    this.currentNodeIndex = 0
    this.startTime = null
  }

  /**
   * Запуск симуляции workflow
   */
  async start() {
    if (this.isRunning) return

    this.isRunning = true
    this.isPaused = false
    this.startTime = Date.now()
    this.currentNodeIndex = 0

    this.emit('workflow:start', {
      workflow: this.workflow,
      timestamp: this.startTime
    })

    this.addLog('info', 'Orchestrator', `Workflow '${this.workflow.name}' запущен`)

    try {
      for (let i = 0; i < this.workflow.nodes.length; i++) {
        if (!this.isRunning) break

        while (this.isPaused) {
          await this.delay(100)
        }

        this.currentNodeIndex = i
        const node = this.workflow.nodes[i]
        await this.executeNode(node)
      }

      if (this.isRunning) {
        await this.completeWorkflow()
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Выполнение одного узла workflow
   */
  async executeNode(node) {
    const startTime = Date.now()

    this.emit('node:start', { node, timestamp: startTime })
    this.addLog('info', node.agentName, `${node.startMessage || 'Начинаю работу'}`)

    // Симулировать прогресс
    const progressSteps = node.progressSteps || 5
    const stepDelay = (node.duration || 2000) / progressSteps / this.speed

    for (let i = 0; i <= progressSteps; i++) {
      if (!this.isRunning) break
      while (this.isPaused) await this.delay(100)

      const progress = Math.round((i / progressSteps) * 100)

      this.emit('node:progress', {
        node,
        progress,
        timestamp: Date.now()
      })

      // Обновить метрики
      this.updateMetrics(node, progress)

      // Добавить промежуточные логи
      if (node.progressLogs && node.progressLogs[i]) {
        this.addLog('info', node.agentName, node.progressLogs[i])
      }

      // Проверить ошибки
      if (node.errors && node.errors[i]) {
        throw node.errors[i]
      }

      await this.delay(stepDelay)
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(1)

    this.emit('node:complete', {
      node,
      duration,
      timestamp: endTime
    })

    this.addLog('success', node.agentName, `${node.completeMessage || 'Завершено'} за ${duration} сек`)
  }

  /**
   * Завершение workflow
   */
  async completeWorkflow() {
    const endTime = Date.now()
    const totalDuration = ((endTime - this.startTime) / 1000).toFixed(1)

    // Собрать статистику
    const stats = this.workflow.stats || {
      processedRows: 100,
      errorsFound: 0,
      filesCreated: 1
    }

    this.addLog('success', 'Orchestrator', `Workflow '${this.workflow.name}' успешно завершён`)

    this.emit('workflow:complete', {
      workflow: this.workflow,
      duration: totalDuration,
      stats,
      timestamp: endTime
    })

    this.isRunning = false
  }

  /**
   * Обработка ошибки
   */
  handleError(error) {
    const node = this.workflow.nodes[this.currentNodeIndex]

    this.addLog('error', node?.agentName || 'System', error.message)
    this.errors.push({
      id: Date.now(),
      node,
      type: error.type || 'Error',
      message: error.message,
      details: error.details || {},
      timestamp: Date.now(),
      fix: error.fix
    })

    this.emit('workflow:error', {
      error: this.errors[this.errors.length - 1],
      node,
      timestamp: Date.now()
    })

    if (error.critical !== false) {
      this.addLog('error', 'Orchestrator', 'Workflow остановлен из-за ошибок')
      this.stop()
    }
  }

  /**
   * Добавить лог
   */
  addLog(level, agent, message) {
    const log = {
      id: this.logs.length + 1,
      timestamp: Date.now(),
      level,
      agent,
      message,
      icon: this.getLogIcon(level)
    }

    this.logs.push(log)
    this.emit('log', log)
  }

  /**
   * Получить иконку для типа лога
   */
  getLogIcon(level) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔍'
    }
    return icons[level] || 'ℹ️'
  }

  /**
   * Обновить метрики
   */
  updateMetrics(node, progress) {
    if (!this.metrics[node.id]) {
      this.metrics[node.id] = {
        name: node.agentName,
        progress: 0,
        startTime: Date.now(),
        memoryUsage: Math.floor(Math.random() * 20) + 5, // MB
        performance: 0
      }
    }

    this.metrics[node.id].progress = progress

    // Симулировать производительность
    if (node.performance) {
      this.metrics[node.id].performance = Math.floor(
        node.performance.min +
        Math.random() * (node.performance.max - node.performance.min)
      )
    }

    this.emit('metrics:update', {
      nodeId: node.id,
      metrics: this.metrics[node.id]
    })
  }

  /**
   * Остановить симуляцию
   */
  stop() {
    this.isRunning = false
    this.isPaused = false
    this.emit('workflow:stop', { timestamp: Date.now() })
  }

  /**
   * Поставить на паузу
   */
  pause() {
    this.isPaused = true
    this.emit('workflow:pause', { timestamp: Date.now() })
  }

  /**
   * Продолжить выполнение
   */
  resume() {
    this.isPaused = false
    this.emit('workflow:resume', { timestamp: Date.now() })
  }

  /**
   * Перезапустить с определенного узла
   */
  async restartFrom(nodeIndex) {
    this.stop()
    await this.delay(500)

    this.currentNodeIndex = nodeIndex
    this.isRunning = true
    this.isPaused = false

    this.emit('workflow:restart', {
      nodeIndex,
      timestamp: Date.now()
    })

    try {
      for (let i = nodeIndex; i < this.workflow.nodes.length; i++) {
        if (!this.isRunning) break

        this.currentNodeIndex = i
        const node = this.workflow.nodes[i]
        await this.executeNode(node)
      }

      if (this.isRunning) {
        await this.completeWorkflow()
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Исправить ошибку и продолжить
   */
  async fixErrorAndContinue(errorId, fix) {
    const errorIndex = this.errors.findIndex(e => e.id === errorId)
    if (errorIndex === -1) return

    const error = this.errors[errorIndex]
    this.addLog('info', 'User', `Применено исправление: ${fix}`)

    // Убрать ошибку из узла
    if (error.node && error.node.errors) {
      error.node.errors = {}
    }

    // Пометить ошибку как исправленную
    this.errors[errorIndex].fixed = true
    this.emit('error:fixed', { error, fix })

    // Продолжить с узла где была ошибка
    await this.restartFrom(this.currentNodeIndex)
  }

  /**
   * Задержка
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Emit события
   */
  emit(eventName, data) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }))
  }

  /**
   * Получить все логи
   */
  getLogs() {
    return this.logs
  }

  /**
   * Получить логи определенного агента
   */
  getLogsByAgent(agentName) {
    return this.logs.filter(log => log.agent === agentName)
  }

  /**
   * Получить метрики
   */
  getMetrics() {
    return this.metrics
  }

  /**
   * Получить ошибки
   */
  getErrors() {
    return this.errors
  }

  /**
   * Очистить состояние
   */
  reset() {
    this.stop()
    this.logs = []
    this.metrics = {}
    this.errors = []
    this.currentNodeIndex = 0
    this.startTime = null
    this.emit('simulator:reset')
  }
}

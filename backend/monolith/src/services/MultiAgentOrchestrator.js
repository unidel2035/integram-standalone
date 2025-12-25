// MultiAgentOrchestrator.js - Координирует запуск и управление всей сетью агентов
import { promises as fs } from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import graphlib from 'graphlib'
const { Graph, alg } = graphlib
import EventEmitter from 'events'
import { fileURLToPath } from 'url'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * MultiAgentOrchestrator - координирует запуск и управление всей сетью агентов
 *
 * Issue #2700: Phase 1.2 - Multi-Agent Orchestrator
 *
 * Функции:
 * - Загрузка agent manifests из YAML
 * - Построение графа зависимостей между агентами
 * - Топологическая сортировка для определения порядка запуска
 * - Запуск и остановка агентов в правильном порядке
 * - Health check агентов после запуска
 * - Graceful shutdown в обратном порядке
 */
export class MultiAgentOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super()

    this.manifestsDir =
      options.manifestsDir || path.join(__dirname, '../agents/manifests')
    this.agentRegistry = options.agentRegistry
    this.agentManager = options.agentManager

    this.manifests = new Map() // agentId -> manifest
    this.dependencyGraph = null
    this.startOrder = []

    this.status = 'stopped' // stopped | starting | running | stopping

    logger.info('MultiAgentOrchestrator initialized', {
      manifestsDir: this.manifestsDir,
    })
  }

  /**
   * Загрузить все agent manifests
   */
  async loadManifests() {
    logger.info('Loading agent manifests...')

    try {
      // Check if manifests directory exists
      const dirExists = await fs
        .access(this.manifestsDir)
        .then(() => true)
        .catch(() => false)
      if (!dirExists) {
        logger.warn(
          { manifestsDir: this.manifestsDir },
          'Manifests directory does not exist',
        )
        return
      }

      const files = await fs.readdir(this.manifestsDir)
      const yamlFiles = files.filter(
        f => f.endsWith('.yml') || f.endsWith('.yaml'),
      )

      for (const file of yamlFiles) {
        const filePath = path.join(this.manifestsDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        const manifest = yaml.load(content)

        if (!manifest || !manifest.agent || !manifest.agent.id) {
          logger.warn({ file }, 'Invalid manifest file - missing agent.id')
          continue
        }

        this.manifests.set(manifest.agent.id, manifest.agent)
        logger.debug({ agentId: manifest.agent.id }, 'Loaded manifest')
      }

      logger.info({ count: this.manifests.size }, 'Agent manifests loaded')
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load manifests')
      throw error
    }
  }

  /**
   * Построить граф зависимостей
   */
  buildDependencyGraph() {
    logger.info('Building dependency graph...')

    const graph = new Graph()

    // Добавляем все агенты как узлы
    for (const [agentId, manifest] of this.manifests) {
      graph.setNode(agentId, manifest)
    }

    // Добавляем ребра зависимостей
    for (const [agentId, manifest] of this.manifests) {
      const requiredDeps = manifest.dependencies?.required || []

      for (const depId of requiredDeps) {
        if (!graph.hasNode(depId)) {
          logger.warn(
            { agentId, dependency: depId },
            'Missing dependency manifest',
          )
          continue
        }

        // Ребро от dependency к agent (dependency должна стартовать раньше)
        graph.setEdge(depId, agentId)
      }
    }

    // Проверка циклических зависимостей
    if (!alg.isAcyclic(graph)) {
      const cycles = alg.findCycles(graph)
      logger.error({ cycles }, 'Cyclic dependencies detected')
      throw new Error(`Cyclic dependencies detected: ${JSON.stringify(cycles)}`)
    }

    this.dependencyGraph = graph
    logger.info(
      {
        nodes: graph.nodeCount(),
        edges: graph.edgeCount(),
      },
      'Dependency graph built successfully',
    )
  }

  /**
   * Определить порядок запуска агентов (топологическая сортировка)
   */
  calculateStartOrder() {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built')
    }

    // Топологическая сортировка
    this.startOrder = alg.topsort(this.dependencyGraph)

    logger.info(
      {
        order: this.startOrder,
        count: this.startOrder.length,
      },
      'Start order calculated',
    )

    return this.startOrder
  }

  /**
   * Запустить одного агента
   */
  async startAgent(agentId) {
    const manifest = this.manifests.get(agentId)
    if (!manifest) {
      throw new Error(`Manifest not found for agent ${agentId}`)
    }

    logger.info({ agentId }, 'Starting agent...')

    try {
      // 1. Загрузить модуль агента
      const agentModule = await this.loadAgentModule(agentId)

      // 2. Создать инстанс
      const agentInstance = new agentModule.default({
        id: agentId,
        name: manifest.name,
        capabilities: manifest.provides?.capabilities || [],
        maxConcurrentTasks:
          manifest.config?.resources?.maxConcurrentTasks || 10,
      })

      // 3. Инициализировать
      await agentInstance.initialize()

      // 4. Зарегистрировать в AgentManager
      this.agentManager.registerAgent(
        {
          id: agentId,
          name: manifest.name,
          capabilities: manifest.provides?.capabilities || [],
        },
        agentInstance,
      )

      // 5. Ждать готовности (health check)
      const timeout = manifest.config?.startup?.timeout || 30000
      await this.waitForHealthy(agentId, timeout)

      logger.info({ agentId }, 'Agent started successfully')
      this.emit('agent:started', { agentId })

      return true
    } catch (error) {
      logger.error({ agentId, error: error.message }, 'Failed to start agent')
      this.emit('agent:failed', { agentId, error })
      throw error
    }
  }

  /**
   * Загрузить модуль агента динамически
   */
  async loadAgentModule(agentId) {
    // Конвертируем agent-id в AgentName (CamelCase)
    const className = agentId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    const modulePath = path.join(__dirname, `../agents/${className}.js`)

    try {
      return await import(modulePath)
    } catch (error) {
      logger.error(
        { agentId, modulePath, error: error.message },
        'Failed to load agent module',
      )
      throw new Error(`Agent module not found: ${modulePath}`)
    }
  }

  /**
   * Ждать, пока агент станет healthy
   */
  async waitForHealthy(agentId, timeout = 30000) {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const agent = this.agentRegistry.getAgent(agentId)

      if (agent && agent.status === 'idle') {
        return true
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    throw new Error(
      `Agent ${agentId} did not become healthy within ${timeout}ms`,
    )
  }

  /**
   * Запустить всю сеть агентов
   */
  async startAll() {
    logger.info('Starting multi-agent network...')
    this.status = 'starting'
    this.emit('network:starting')

    try {
      // 1. Загрузить manifests
      await this.loadManifests()

      // Если нет манифестов, ничего не делаем
      if (this.manifests.size === 0) {
        logger.warn('No agent manifests found')
        this.status = 'stopped'
        return {
          success: true,
          agentsStarted: 0,
          order: [],
        }
      }

      // 2. Построить граф зависимостей
      this.buildDependencyGraph()

      // 3. Вычислить порядок запуска
      this.calculateStartOrder()

      // 4. Запускать агентов по порядку
      for (const agentId of this.startOrder) {
        await this.startAgent(agentId)
      }

      this.status = 'running'
      this.emit('network:running')

      logger.info('Multi-agent network started successfully')

      return {
        success: true,
        agentsStarted: this.startOrder.length,
        order: this.startOrder,
      }
    } catch (error) {
      this.status = 'stopped'
      this.emit('network:failed', { error })

      logger.error(
        { error: error.message },
        'Failed to start multi-agent network',
      )

      throw error
    }
  }

  /**
   * Остановить всю сеть агентов
   */
  async stopAll() {
    logger.info('Stopping multi-agent network...')
    this.status = 'stopping'
    this.emit('network:stopping')

    try {
      // Останавливаем в обратном порядке
      const stopOrder = [...this.startOrder].reverse()

      for (const agentId of stopOrder) {
        await this.stopAgent(agentId)
      }

      this.status = 'stopped'
      this.emit('network:stopped')

      logger.info('Multi-agent network stopped successfully')

      return { success: true }
    } catch (error) {
      logger.error(
        { error: error.message },
        'Failed to stop multi-agent network',
      )
      throw error
    }
  }

  /**
   * Остановить одного агента
   */
  async stopAgent(agentId) {
    logger.info({ agentId }, 'Stopping agent...')

    try {
      const agent = this.agentRegistry.getAgent(agentId)
      if (!agent) {
        logger.warn({ agentId }, 'Agent not found in registry')
        return
      }

      const instance = this.agentManager.agentInstances.get(agentId)
      if (instance && instance.shutdown) {
        await instance.shutdown()
      }

      this.agentManager.unregisterAgent(agentId)

      logger.info({ agentId }, 'Agent stopped successfully')
      this.emit('agent:stopped', { agentId })
    } catch (error) {
      logger.error({ agentId, error: error.message }, 'Failed to stop agent')
      throw error
    }
  }

  /**
   * Получить статус всей сети
   */
  getStatus() {
    const agents = this.agentRegistry.getAllAgents()

    const statusCounts = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1
      return acc
    }, {})

    return {
      orchestratorStatus: this.status,
      totalAgents: agents.length,
      statusBreakdown: statusCounts,
      startOrder: this.startOrder,
      dependencyGraph: this.dependencyGraph
        ? this.dependencyGraph.nodeCount()
        : 0,
      manifestsLoaded: this.manifests.size,
    }
  }

  /**
   * Получить граф зависимостей для визуализации
   */
  getDependencyGraphData() {
    if (!this.dependencyGraph) {
      return { nodes: [], edges: [] }
    }

    const nodes = this.dependencyGraph.nodes().map(nodeId => {
      const manifest = this.manifests.get(nodeId)
      return {
        id: nodeId,
        name: manifest?.name || nodeId,
        criticality: manifest?.criticality || 'medium',
        capabilities: manifest?.provides?.capabilities || [],
      }
    })

    const edges = this.dependencyGraph.edges().map(edge => ({
      from: edge.v,
      to: edge.w,
    }))

    return { nodes, edges }
  }

  /**
   * Очистка ресурсов при shutdown
   */
  shutdown() {
    logger.info('Shutting down MultiAgentOrchestrator')
    this.manifests.clear()
    this.dependencyGraph = null
    this.startOrder = []
    this.status = 'stopped'
  }
}

export default MultiAgentOrchestrator

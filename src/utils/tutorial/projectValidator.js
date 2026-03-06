/**
 * Project Validator for Graduation Project
 * Validates workflow structure and execution results
 */

export class ProjectValidator {
  constructor(workflow, executionResult = null) {
    this.workflow = workflow
    this.executionResult = executionResult
    this.score = {
      total: 0,
      checks: {},
      feedback: []
    }
  }

  /**
   * Validate the graduation project workflow
   * @returns {Object} Validation results with score and feedback
   */
  validate() {
    this.score = {
      total: 0,
      checks: {},
      feedback: []
    }

    // Run all validation checks
    this.checkValidator()
    this.checkAnalyzer()
    this.checkTransform()
    this.checkReporter()
    this.checkMinimumNodes()
    this.checkConnectivity()

    // Bonus checks
    this.checkConditionalFlow()
    this.checkParallelExecution()

    // Execution result checks (if available)
    if (this.executionResult) {
      this.checkExecutionResults()
    }

    // Calculate grade
    this.score.grade = this.calculateGrade()

    return this.score
  }

  /**
   * Check if ValidatorAgent is present
   */
  checkValidator() {
    const hasValidator = this.workflow.nodes.some(n =>
      n.type === 'ValidatorAgent' || n.type === 'agent-validator'
    )

    this.score.checks.hasValidator = hasValidator

    if (hasValidator) {
      this.score.total += 20
      this.score.feedback.push({
        type: 'success',
        message: '✅ Используется валидация данных (+20 баллов)',
        requirement: 'Проверить валидность контактов'
      })
    } else {
      this.score.feedback.push({
        type: 'error',
        message: '❌ Добавьте ValidatorAgent для проверки контактов',
        requirement: 'Проверить валидность контактов'
      })
    }
  }

  /**
   * Check if TableAnalyzerAgent is present
   */
  checkAnalyzer() {
    const hasAnalyzer = this.workflow.nodes.some(n =>
      n.type === 'TableAnalyzerAgent' || n.type === 'agent-analyzer'
    )

    this.score.checks.hasAnalyzer = hasAnalyzer

    if (hasAnalyzer) {
      this.score.total += 20
      this.score.feedback.push({
        type: 'success',
        message: '✅ Используется анализ данных (+20 баллов)',
        requirement: 'Рассчитать средний уровень зарплат'
      })
    } else {
      this.score.feedback.push({
        type: 'error',
        message: '❌ Добавьте TableAnalyzerAgent для анализа данных',
        requirement: 'Рассчитать средний уровень зарплат'
      })
    }
  }

  /**
   * Check if DataTransformAgent is present
   */
  checkTransform() {
    const hasTransform = this.workflow.nodes.some(n =>
      n.type === 'DataTransformAgent' || n.type === 'agent-transform'
    )

    this.score.checks.hasTransform = hasTransform

    if (hasTransform) {
      this.score.total += 20
      this.score.feedback.push({
        type: 'success',
        message: '✅ Используется трансформация данных (+20 баллов)',
        requirement: 'Отфильтровать кандидатов по опыту и навыкам'
      })
    } else {
      this.score.feedback.push({
        type: 'error',
        message: '❌ Добавьте DataTransformAgent для фильтрации данных',
        requirement: 'Отфильтровать кандидатов по опыту и навыкам'
      })
    }
  }

  /**
   * Check if ReportGeneratorAgent is present
   */
  checkReporter() {
    const hasReporter = this.workflow.nodes.some(n =>
      n.type === 'ReportGeneratorAgent' || n.type === 'agent-reporter'
    )

    this.score.checks.hasReporter = hasReporter

    if (hasReporter) {
      this.score.total += 20
      this.score.feedback.push({
        type: 'success',
        message: '✅ Используется генерация отчётов (+20 баллов)',
        requirement: 'Сгенерировать PDF-отчёт'
      })
    } else {
      this.score.feedback.push({
        type: 'error',
        message: '❌ Добавьте ReportGeneratorAgent для создания отчёта',
        requirement: 'Сгенерировать PDF-отчёт'
      })
    }
  }

  /**
   * Check minimum number of nodes
   */
  checkMinimumNodes() {
    const minNodes = this.workflow.nodes.length >= 4
    this.score.checks.minNodes = minNodes

    if (minNodes) {
      this.score.total += 10
      this.score.feedback.push({
        type: 'success',
        message: `✅ Workflow содержит ${this.workflow.nodes.length} агентов (+10 баллов)`,
        requirement: 'Минимум 4 агента'
      })
    } else {
      this.score.feedback.push({
        type: 'error',
        message: `❌ Workflow должен содержать минимум 4 агента (сейчас: ${this.workflow.nodes.length})`,
        requirement: 'Минимум 4 агента'
      })
    }
  }

  /**
   * Check if all nodes are connected
   */
  checkConnectivity() {
    const isConnected = this.checkAllNodesConnected()
    this.score.checks.connected = isConnected

    if (isConnected) {
      this.score.total += 10
      this.score.feedback.push({
        type: 'success',
        message: '✅ Все агенты правильно соединены (+10 баллов)',
        requirement: 'Корректная связь агентов'
      })
    } else {
      this.score.feedback.push({
        type: 'warning',
        message: '⚠️ Проверьте, что все агенты правильно соединены',
        requirement: 'Корректная связь агентов'
      })
    }
  }

  /**
   * Check for conditional flow (bonus)
   */
  checkConditionalFlow() {
    const hasConditional = this.workflow.edges?.some(e => e.condition || e.data?.condition)
    this.score.checks.hasConditional = hasConditional

    if (hasConditional) {
      this.score.total += 10
      this.score.feedback.push({
        type: 'bonus',
        message: '🌟 Бонус: Использованы условные переходы! (+10 баллов)',
        requirement: 'Бонус: Условные переходы'
      })
    }
  }

  /**
   * Check for parallel execution (bonus)
   */
  checkParallelExecution() {
    const hasParallel = this.detectParallelExecution()
    this.score.checks.hasParallel = hasParallel

    if (hasParallel) {
      this.score.total += 10
      this.score.feedback.push({
        type: 'bonus',
        message: '🌟 Бонус: Использовано параллельное выполнение! (+10 баллов)',
        requirement: 'Бонус: Параллельное выполнение'
      })
    }
  }

  /**
   * Check execution results
   */
  checkExecutionResults() {
    if (!this.executionResult) return

    // Check if filtered candidates are correct
    if (this.executionResult.filteredCandidates) {
      const count = this.executionResult.filteredCandidates.length
      if (count === 10) {
        this.score.feedback.push({
          type: 'success',
          message: `✅ Правильное количество кандидатов в топ-10: ${count}`,
          requirement: 'Создать топ-10 кандидатов'
        })
      } else {
        this.score.feedback.push({
          type: 'warning',
          message: `⚠️ Ожидается 10 кандидатов, получено: ${count}`,
          requirement: 'Создать топ-10 кандидатов'
        })
      }
    }

    // Check if average salary is calculated
    if (this.executionResult.averageSalary !== undefined) {
      this.score.feedback.push({
        type: 'success',
        message: `✅ Средняя зарплата рассчитана: ${this.executionResult.averageSalary}`,
        requirement: 'Рассчитать среднюю зарплату'
      })
    }

    // Check if report was generated
    if (this.executionResult.reportGenerated) {
      this.score.feedback.push({
        type: 'success',
        message: '✅ PDF-отчёт успешно создан',
        requirement: 'Сгенерировать PDF-отчёт'
      })
    }
  }

  /**
   * Helper: Check if all nodes are connected
   */
  checkAllNodesConnected() {
    if (this.workflow.nodes.length === 0) return false
    if (this.workflow.nodes.length === 1) return true

    const edges = this.workflow.edges || []
    const connectedNodes = new Set()

    edges.forEach(edge => {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    })

    // At least most nodes should be connected
    return connectedNodes.size >= this.workflow.nodes.length - 1
  }

  /**
   * Helper: Detect parallel execution
   */
  detectParallelExecution() {
    if (!this.workflow.edges || this.workflow.edges.length === 0) return false

    // Check if any node has multiple outgoing edges to different targets
    const outgoingMap = {}

    this.workflow.edges.forEach(edge => {
      if (!outgoingMap[edge.source]) {
        outgoingMap[edge.source] = []
      }
      outgoingMap[edge.source].push(edge.target)
    })

    // Parallel execution exists if a node has 2+ outgoing edges
    return Object.values(outgoingMap).some(targets => targets.length >= 2)
  }

  /**
   * Calculate grade based on score
   */
  calculateGrade() {
    if (this.score.total >= 100) return 'Отлично! 🌟'
    if (this.score.total >= 90) return 'Отлично'
    if (this.score.total >= 70) return 'Хорошо'
    if (this.score.total >= 60) return 'Удовлетворительно'
    return 'Требуется доработка'
  }

  /**
   * Get summary of validation
   */
  getSummary() {
    const required = this.score.feedback.filter(f => f.type === 'error' || f.type === 'success')
    const bonus = this.score.feedback.filter(f => f.type === 'bonus')

    return {
      score: this.score.total,
      maxScore: 100,
      grade: this.score.grade,
      requiredComplete: required.filter(f => f.type === 'success').length,
      requiredTotal: required.length,
      bonusComplete: bonus.length,
      bonusTotal: 2,
      feedback: this.score.feedback
    }
  }
}

/**
 * Validate graduation project workflow
 * @param {Object} workflow - Workflow configuration
 * @param {Object} executionResult - Optional execution results
 * @returns {Object} Validation results
 */
export function validateGraduationProject(workflow, executionResult = null) {
  const validator = new ProjectValidator(workflow, executionResult)
  return validator.validate()
}

/**
 * Get validation summary
 * @param {Object} workflow - Workflow configuration
 * @param {Object} executionResult - Optional execution results
 * @returns {Object} Validation summary
 */
export function getValidationSummary(workflow, executionResult = null) {
  const validator = new ProjectValidator(workflow, executionResult)
  validator.validate()
  return validator.getSummary()
}

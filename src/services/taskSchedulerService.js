/**
 * Умный Планировщик Задач (Smart Task Scheduler)
 *
 * Implements intelligent task scheduling with:
 * - Dependency management (DAG)
 * - Critical Path Method (CPM) calculation
 * - Skill-based executor assignment
 * - Workload balancing
 * - Priority-based scoring
 */

/**
 * Task Priority levels
 */
export const TaskPriority = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
}

/**
 * Executor/Worker professionalism levels
 */
export const ProfessionalismLevel = {
  TRAINEE: 1,      // Стажёр
  JUNIOR: 2,       // Младший специалист
  MIDDLE: 3,       // Средний специалист
  SENIOR: 4,       // Старший специалист
  EXPERT: 5        // Эксперт
}

/**
 * Task Scheduler Service
 */
export class TaskSchedulerService {
  constructor() {
    this.tasks = new Map()
    this.executors = new Map()
    this.assignments = new Map() // taskId -> executorId
    this.dependencies = new Map() // taskId -> [dependencyTaskIds]

    // Scoring weights for task assignment
    this.weights = {
      professionalism: 0.3,  // W1
      priority: 0.25,         // W2
      workload: 0.25,         // W3
      timeConstraints: 0.1,   // W4 (lunch breaks, etc)
      mentorship: 0.1         // W5
    }
  }

  /**
   * Add a new task
   */
  addTask(task) {
    const taskId = task.id || this.generateId()

    const taskData = {
      id: taskId,
      title: task.title,
      description: task.description || '',
      complexity: task.complexity || 1, // 1-5 scale
      priority: task.priority || TaskPriority.MEDIUM,
      estimatedDuration: task.estimatedDuration || 8, // hours
      deadline: task.deadline || null,
      dependencies: task.dependencies || [],
      status: 'pending',
      assignedTo: null,

      // CPM calculation results
      earlyStart: 0,
      earlyFinish: 0,
      lateStart: 0,
      lateFinish: 0,
      slack: 0, // резерв времени (float)
      isCritical: false
    }

    this.tasks.set(taskId, taskData)
    this.dependencies.set(taskId, task.dependencies || [])

    return taskData
  }

  /**
   * Add an executor/worker
   */
  addExecutor(executor) {
    const executorId = executor.id || this.generateId()

    const executorData = {
      id: executorId,
      name: executor.name,
      professionalism: executor.professionalism || ProfessionalismLevel.JUNIOR,
      role: executor.role || 'developer',
      currentWorkload: 0, // current hours assigned
      maxWorkload: executor.maxWorkload || 40, // max hours per week
      skills: executor.skills || [],
      isMentor: executor.isMentor || false,
      mentees: executor.mentees || [], // IDs of trainees being mentored

      // Time constraints (e.g., lunch breaks)
      unavailableSlots: executor.unavailableSlots || [
        { start: 12, end: 13 } // Default lunch break 12:00-13:00
      ]
    }

    this.executors.set(executorId, executorData)

    return executorData
  }

  /**
   * Build dependency graph (DAG)
   */
  buildDependencyGraph() {
    const graph = new Map()

    for (const [taskId, deps] of this.dependencies.entries()) {
      graph.set(taskId, deps)
    }

    return graph
  }

  /**
   * Topological sort of tasks based on dependencies
   */
  topologicalSort() {
    const graph = this.buildDependencyGraph()
    const visited = new Set()
    const result = []

    const visit = (taskId) => {
      if (visited.has(taskId)) return

      visited.add(taskId)
      const deps = graph.get(taskId) || []

      for (const depId of deps) {
        visit(depId)
      }

      result.push(taskId)
    }

    for (const taskId of this.tasks.keys()) {
      visit(taskId)
    }

    return result
  }

  /**
   * Calculate CPM (Critical Path Method) metrics
   */
  calculateCPM() {
    const sortedTasks = this.topologicalSort()

    // Forward pass: Calculate Early Start (ES) and Early Finish (EF)
    for (const taskId of sortedTasks) {
      const task = this.tasks.get(taskId)
      const deps = this.dependencies.get(taskId) || []

      if (deps.length === 0) {
        task.earlyStart = 0
      } else {
        task.earlyStart = Math.max(
          ...deps.map(depId => {
            const depTask = this.tasks.get(depId)
            return depTask.earlyFinish
          })
        )
      }

      task.earlyFinish = task.earlyStart + task.estimatedDuration
    }

    // Find project deadline (max EF)
    const projectDeadline = Math.max(
      ...Array.from(this.tasks.values()).map(t => t.earlyFinish)
    )

    // Backward pass: Calculate Late Start (LS) and Late Finish (LF)
    const reversedTasks = [...sortedTasks].reverse()

    for (const taskId of reversedTasks) {
      const task = this.tasks.get(taskId)

      // Find tasks that depend on this task
      const dependents = Array.from(this.dependencies.entries())
        .filter(([_, deps]) => deps.includes(taskId))
        .map(([depTaskId]) => depTaskId)

      if (dependents.length === 0) {
        task.lateFinish = projectDeadline
      } else {
        task.lateFinish = Math.min(
          ...dependents.map(depId => {
            const depTask = this.tasks.get(depId)
            return depTask.lateStart
          })
        )
      }

      task.lateStart = task.lateFinish - task.estimatedDuration

      // Calculate slack (float)
      task.slack = task.lateStart - task.earlyStart

      // Mark as critical if slack is 0
      task.isCritical = task.slack === 0
    }

    return {
      projectDeadline,
      criticalPath: this.getCriticalPath()
    }
  }

  /**
   * Get critical path (tasks with 0 slack)
   */
  getCriticalPath() {
    return Array.from(this.tasks.values())
      .filter(task => task.isCritical)
      .map(task => task.id)
  }

  /**
   * Group tasks into cohorts (layers) that can be executed in parallel
   */
  groupTasksIntoCohorts() {
    const cohorts = []
    const processed = new Set()
    const graph = this.buildDependencyGraph()

    while (processed.size < this.tasks.size) {
      const cohort = []

      for (const [taskId, deps] of graph.entries()) {
        if (processed.has(taskId)) continue

        // Check if all dependencies are processed
        const allDepsProcessed = deps.every(depId => processed.has(depId))

        if (allDepsProcessed) {
          cohort.push(taskId)
        }
      }

      if (cohort.length === 0) {
        // Circular dependency detected
        console.error('Circular dependency detected in task graph')
        break
      }

      cohorts.push(cohort)
      cohort.forEach(taskId => processed.add(taskId))
    }

    return cohorts
  }

  /**
   * Calculate professionalism score for executor-task pairing
   */
  calculateProfessionalismScore(executor, task) {
    const profDiff = executor.professionalism - task.complexity

    // Ideal case: task complexity is 1-2 levels below professionalism
    if (profDiff >= 1 && profDiff <= 2) {
      return 1.0 // Perfect match
    } else if (profDiff === 0) {
      return 0.8 // Acceptable
    } else if (profDiff < 0) {
      return 0.0 // Cannot assign (too complex for executor)
    } else {
      return 0.5 // Task is too simple (demotivating)
    }
  }

  /**
   * Calculate priority score
   */
  calculatePriorityScore(task) {
    return task.priority / TaskPriority.CRITICAL
  }

  /**
   * Calculate workload score (lower workload = higher score)
   */
  calculateWorkloadScore(executor) {
    const workloadRatio = executor.currentWorkload / executor.maxWorkload
    return 1.0 - workloadRatio
  }

  /**
   * Calculate time constraint penalty (e.g., lunch breaks)
   */
  calculateTimeConstraintScore(executor, currentHour) {
    for (const slot of executor.unavailableSlots) {
      if (currentHour >= slot.start && currentHour < slot.end) {
        return 0.0 // Executor is unavailable
      }
    }
    return 1.0
  }

  /**
   * Calculate mentorship bonus
   */
  calculateMentorshipScore(executor, task) {
    // If executor is a mentor and task is suitable for mentoring
    if (executor.isMentor && task.complexity <= 3) {
      return 0.5
    }
    return 0.0
  }

  /**
   * Calculate overall assignment score
   */
  calculateAssignmentScore(executor, task, currentHour = 9) {
    const profScore = this.calculateProfessionalismScore(executor, task)

    // If executor cannot handle the task complexity, return 0
    if (profScore === 0.0) {
      return 0.0
    }

    const priorityScore = this.calculatePriorityScore(task)
    const workloadScore = this.calculateWorkloadScore(executor)
    const timeScore = this.calculateTimeConstraintScore(executor, currentHour)
    const mentorshipScore = this.calculateMentorshipScore(executor, task)

    const totalScore =
      this.weights.professionalism * profScore +
      this.weights.priority * priorityScore -
      this.weights.workload * (1.0 - workloadScore) -
      this.weights.timeConstraints * (1.0 - timeScore) +
      this.weights.mentorship * mentorshipScore

    return totalScore
  }

  /**
   * Assign tasks to executors using scoring function
   */
  assignTasks() {
    // First, calculate CPM to identify critical tasks
    this.calculateCPM()

    // Group tasks into cohorts
    const cohorts = this.groupTasksIntoCohorts()

    const assignments = []

    for (const cohort of cohorts) {
      // Sort tasks by priority and criticality
      const sortedTasks = cohort
        .map(taskId => this.tasks.get(taskId))
        .sort((a, b) => {
          // Critical tasks first
          if (a.isCritical && !b.isCritical) return -1
          if (!a.isCritical && b.isCritical) return 1
          // Then by priority
          return b.priority - a.priority
        })

      for (const task of sortedTasks) {
        if (task.assignedTo) continue // Already assigned

        let bestExecutor = null
        let bestScore = -Infinity

        // Find best executor for this task
        for (const executor of this.executors.values()) {
          const score = this.calculateAssignmentScore(executor, task)

          if (score > bestScore) {
            bestScore = score
            bestExecutor = executor
          }
        }

        if (bestExecutor && bestScore > 0) {
          // Assign task
          task.assignedTo = bestExecutor.id
          task.status = 'assigned'
          bestExecutor.currentWorkload += task.estimatedDuration

          this.assignments.set(task.id, bestExecutor.id)

          assignments.push({
            taskId: task.id,
            taskTitle: task.title,
            executorId: bestExecutor.id,
            executorName: bestExecutor.name,
            score: bestScore,
            isCritical: task.isCritical
          })
        }
      }
    }

    return assignments
  }

  /**
   * Get executor's assigned tasks
   */
  getExecutorTasks(executorId) {
    return Array.from(this.tasks.values())
      .filter(task => task.assignedTo === executorId)
      .sort((a, b) => {
        // Critical tasks first
        if (a.isCritical && !b.isCritical) return -1
        if (!a.isCritical && b.isCritical) return 1
        // Then by early start time
        return a.earlyStart - b.earlyStart
      })
  }

  /**
   * Get task details with assignment info
   */
  getTaskDetails(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const executor = task.assignedTo ? this.executors.get(task.assignedTo) : null
    const deps = this.dependencies.get(taskId) || []

    return {
      ...task,
      executor: executor ? {
        id: executor.id,
        name: executor.name,
        professionalism: executor.professionalism
      } : null,
      dependencies: deps.map(depId => {
        const depTask = this.tasks.get(depId)
        return {
          id: depId,
          title: depTask?.title || 'Unknown',
          status: depTask?.status || 'unknown'
        }
      })
    }
  }

  /**
   * Get schedule summary
   */
  getScheduleSummary() {
    const cpm = this.calculateCPM()

    return {
      totalTasks: this.tasks.size,
      assignedTasks: Array.from(this.tasks.values()).filter(t => t.assignedTo).length,
      criticalTasks: Array.from(this.tasks.values()).filter(t => t.isCritical).length,
      projectDeadline: cpm.projectDeadline,
      criticalPath: cpm.criticalPath,
      executors: Array.from(this.executors.values()).map(e => ({
        id: e.id,
        name: e.name,
        workload: e.currentWorkload,
        maxWorkload: e.maxWorkload,
        utilization: (e.currentWorkload / e.maxWorkload * 100).toFixed(1) + '%'
      }))
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Reset scheduler state
   */
  reset() {
    this.tasks.clear()
    this.executors.clear()
    this.assignments.clear()
    this.dependencies.clear()
  }
}

export default new TaskSchedulerService()

// tasks.js - Task management routes
import express from 'express';
import { TaskPriority } from '../../core/TaskQueue.js';
import logger from '../../utils/logger.js';

export function createTaskRoutes(orchestrator) {
  const router = express.Router();
  const { taskQueue } = orchestrator;

  /**
   * Create a new task
   */
  router.post('/', (req, res, next) => {
    try {
      const { type, payload, priority, requiredCapability } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Task type is required' });
      }

      const task = taskQueue.createTask({
        type,
        payload: payload || {},
        priority: priority || TaskPriority.NORMAL,
        requiredCapability
      });

      res.status(201).json({
        success: true,
        task: {
          id: task.id,
          type: task.type,
          status: task.status,
          priority: task.priority,
          createdAt: task.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get task by ID
   */
  router.get('/:id', (req, res, next) => {
    try {
      const task = taskQueue.getTask(req.params.id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        success: true,
        task: {
          id: task.id,
          type: task.type,
          status: task.status,
          priority: task.priority,
          assignedAgent: task.assignedAgent,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          result: task.result,
          error: task.error
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get all tasks
   */
  router.get('/', (req, res, next) => {
    try {
      const { status } = req.query;

      let tasks = status
        ? taskQueue.getTasksByStatus(status)
        : taskQueue.getAllTasks();

      // Limit response size
      const limit = parseInt(req.query.limit) || 100;
      tasks = tasks.slice(0, limit);

      res.json({
        success: true,
        count: tasks.length,
        tasks: tasks.map(task => ({
          id: task.id,
          type: task.type,
          status: task.status,
          priority: task.priority,
          assignedAgent: task.assignedAgent,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Cancel a task
   */
  router.delete('/:id', (req, res, next) => {
    try {
      const task = taskQueue.cancelTask(req.params.id);

      res.json({
        success: true,
        message: 'Task cancelled',
        task: {
          id: task.id,
          status: task.status
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get task queue statistics
   */
  router.get('/stats/summary', (req, res, next) => {
    try {
      const stats = taskQueue.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get dead letter queue
   */
  router.get('/dead-letter/list', (req, res, next) => {
    try {
      const deadLetterTasks = taskQueue.getDeadLetterQueue();

      res.json({
        success: true,
        count: deadLetterTasks.length,
        tasks: deadLetterTasks.map(task => ({
          id: task.id,
          type: task.type,
          status: task.status,
          retries: task.retries,
          error: task.error,
          createdAt: task.createdAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

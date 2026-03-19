// auto-scaling.js - Auto-scaling agent routes
import express from 'express';
import logger from '../../utils/logger.js';

export function createAutoScalingRoutes() {
  const router = express.Router();

  // In-memory storage for demo purposes
  // In production, this would be backed by a database
  const services = [
    {
      id: 'web-api',
      name: 'Web API Service',
      status: 'active',
      currentInstances: 3,
      minInstances: 2,
      maxInstances: 10,
      currentLoad: 65.5,
      cpuUsage: 62.3,
      memoryUsage: 71.2,
      scaleUpThreshold: 75,
      scaleDownThreshold: 30,
      cooldownPeriod: 120,
      loadHistory: generateLoadHistory(65.5),
      recentEvents: [
        {
          type: 'scale-up',
          message: 'Увеличено с 2 до 3 инстансов из-за высокой нагрузки',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        {
          type: 'prediction',
          message: 'Прогнозируется пик нагрузки через 30 минут',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      id: 'background-workers',
      name: 'Background Workers',
      status: 'active',
      currentInstances: 5,
      minInstances: 3,
      maxInstances: 20,
      currentLoad: 78.2,
      cpuUsage: 81.5,
      memoryUsage: 68.9,
      scaleUpThreshold: 75,
      scaleDownThreshold: 30,
      cooldownPeriod: 120,
      loadHistory: generateLoadHistory(78.2),
      recentEvents: [
        {
          type: 'scale-up',
          message: 'Увеличено с 4 до 5 инстансов',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        },
        {
          type: 'warning',
          message: 'CPU использование превышает 80%',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      id: 'database-pool',
      name: 'Database Connection Pool',
      status: 'active',
      currentInstances: 8,
      minInstances: 5,
      maxInstances: 15,
      currentLoad: 45.8,
      cpuUsage: 42.1,
      memoryUsage: 55.3,
      scaleUpThreshold: 75,
      scaleDownThreshold: 30,
      cooldownPeriod: 120,
      loadHistory: generateLoadHistory(45.8),
      recentEvents: [
        {
          type: 'scale-down',
          message: 'Уменьшено с 10 до 8 инстансов из-за низкой нагрузки',
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
        }
      ]
    }
  ];

  const predictions = [
    {
      serviceId: 'web-api',
      service: 'Web API Service',
      message: 'Прогнозируется пик нагрузки в 18:00 (через 2 часа)',
      predictedLoad: 92.5,
      timestamp: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    },
    {
      serviceId: 'background-workers',
      service: 'Background Workers',
      message: 'Ожидается увеличение нагрузки на 35% в ближайший час',
      predictedLoad: 88.3,
      timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }
  ];

  /**
   * Get auto-scaling status overview
   */
  router.get('/status', (req, res, next) => {
    try {
      const activeServices = services.filter(s => s.status === 'active').length;
      const avgLoad = services.reduce((sum, s) => sum + s.currentLoad, 0) / services.length;
      const avgResponseTime = 145; // Simulated
      const costSavings = 23; // Simulated 23% cost reduction

      const metrics = {
        reactionTime: 85, // seconds (target: < 120s)
        costOptimization: 23, // percent (target: >= 20%)
        downtime: 0, // minutes (target: 0)
        predictionAccuracy: 87 // percent (target: >= 85%)
      };

      logger.info('Auto-scaling status requested');

      res.json({
        success: true,
        data: {
          status: {
            activeServices,
            avgLoad,
            avgResponseTime,
            costSavings
          },
          services,
          predictions,
          metrics
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update service configuration
   */
  router.put('/services/:id/config', (req, res, next) => {
    try {
      const { id } = req.params;
      const { minInstances, maxInstances, scaleUpThreshold, scaleDownThreshold, cooldownPeriod } = req.body;

      const service = services.find(s => s.id === id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      // Validate configuration
      if (minInstances < 1) {
        return res.status(400).json({
          success: false,
          error: 'minInstances must be at least 1'
        });
      }

      if (maxInstances < minInstances) {
        return res.status(400).json({
          success: false,
          error: 'maxInstances must be greater than or equal to minInstances'
        });
      }

      if (scaleUpThreshold <= scaleDownThreshold) {
        return res.status(400).json({
          success: false,
          error: 'scaleUpThreshold must be greater than scaleDownThreshold'
        });
      }

      // Update configuration
      service.minInstances = minInstances;
      service.maxInstances = maxInstances;
      service.scaleUpThreshold = scaleUpThreshold;
      service.scaleDownThreshold = scaleDownThreshold;
      service.cooldownPeriod = cooldownPeriod;

      logger.info(`Updated auto-scaling config for service ${id}`, {
        minInstances,
        maxInstances,
        scaleUpThreshold,
        scaleDownThreshold,
        cooldownPeriod
      });

      res.json({
        success: true,
        data: {
          service
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Prepare resources for predicted load
   */
  router.post('/prepare', (req, res, next) => {
    try {
      const { serviceId, predictedLoad } = req.body;

      const service = services.find(s => s.id === serviceId);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      // Calculate required instances
      const currentCapacity = service.currentInstances * 100;
      const requiredCapacity = (predictedLoad / 100) * currentCapacity;
      const requiredInstances = Math.ceil(requiredCapacity / 100);
      const instancesToAdd = Math.min(
        Math.max(0, requiredInstances - service.currentInstances),
        service.maxInstances - service.currentInstances
      );

      if (instancesToAdd > 0) {
        service.currentInstances += instancesToAdd;
        service.recentEvents.unshift({
          type: 'scale-up',
          message: `Добавлено ${instancesToAdd} инстансов для подготовки к прогнозируемой нагрузке`,
          timestamp: new Date().toISOString()
        });

        logger.info(`Prepared resources for service ${serviceId}`, {
          predictedLoad,
          instancesToAdd,
          newTotal: service.currentInstances
        });
      }

      res.json({
        success: true,
        data: {
          message: instancesToAdd > 0
            ? `Добавлено ${instancesToAdd} инстансов`
            : 'Текущих ресурсов достаточно',
          service
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Manually trigger scaling action
   */
  router.post('/services/:id/scale', (req, res, next) => {
    try {
      const { id } = req.params;
      const { action, targetInstances } = req.body;

      const service = services.find(s => s.id === id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      let newInstances;
      let eventMessage;

      if (action === 'up') {
        newInstances = Math.min(service.currentInstances + 1, service.maxInstances);
        eventMessage = `Ручное масштабирование: увеличено до ${newInstances} инстансов`;
      } else if (action === 'down') {
        newInstances = Math.max(service.currentInstances - 1, service.minInstances);
        eventMessage = `Ручное масштабирование: уменьшено до ${newInstances} инстансов`;
      } else if (targetInstances !== undefined) {
        newInstances = Math.max(
          service.minInstances,
          Math.min(targetInstances, service.maxInstances)
        );
        eventMessage = `Ручное масштабирование: установлено ${newInstances} инстансов`;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid scaling action'
        });
      }

      service.currentInstances = newInstances;
      service.recentEvents.unshift({
        type: action === 'up' ? 'scale-up' : 'scale-down',
        message: eventMessage,
        timestamp: new Date().toISOString()
      });

      logger.info(`Manual scaling for service ${id}`, {
        action,
        newInstances
      });

      res.json({
        success: true,
        data: {
          service
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get scaling history for a service
   */
  router.get('/services/:id/history', (req, res, next) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      const service = services.find(s => s.id === id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      const history = service.recentEvents.slice(0, parseInt(limit));

      res.json({
        success: true,
        data: {
          serviceId: id,
          serviceName: service.name,
          history
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Generate simulated load history data
 */
function generateLoadHistory(currentLoad, points = 30) {
  const history = [];
  let load = currentLoad;

  for (let i = points - 1; i >= 0; i--) {
    // Simulate some variance
    const variance = (Math.random() - 0.5) * 20;
    load = Math.max(10, Math.min(100, load + variance));
    history.push(parseFloat(load.toFixed(1)));
  }

  return history;
}

export default createAutoScalingRoutes;

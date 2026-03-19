// marketplace-analytics.js - Marketplace Analytics API routes
import express from 'express';
import logger from '../../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create Marketplace Analytics routes
 * Provides endpoints for monitoring products and competitors on marketplaces
 * (Ozon, Wildberries, Yandex Market, etc.)
 */
export function createMarketplaceAnalyticsRoutes() {
  const router = express.Router();

  // Data storage path (local files as per guidelines)
  const dataDir = path.join(__dirname, '../../data/marketplace-analytics');

  /**
   * Ensure data directory exists
   */
  const ensureDataDir = async () => {
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error(`Error creating data directory: ${error.message}`);
    }
  };

  /**
   * Load data from file
   */
  const loadData = async (filename) => {
    try {
      const filePath = path.join(dataDir, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  };

  /**
   * Save data to file
   */
  const saveData = async (filename, data) => {
    await ensureDataDir();
    const filePath = path.join(dataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  };

  // ========================================
  // Dashboard Statistics Endpoints
  // ========================================

  /**
   * GET /api/marketplace-analytics/dashboard/stats
   * Get dashboard statistics
   */
  router.get('/dashboard/stats', async (req, res) => {
    try {
      const products = await loadData('products.json');
      const competitors = await loadData('competitors.json');

      // Calculate statistics
      const totalSales = products.reduce((sum, p) => sum + (p.sales || 0), 0);
      const avgPosition = products.length > 0
        ? Math.round(products.reduce((sum, p) => sum + (p.position || 0), 0) / products.length)
        : 0;

      res.json({
        totalProducts: products.length,
        totalSales,
        competitorsCount: competitors.length,
        avgPosition
      });
    } catch (error) {
      logger.error(`Error getting dashboard stats: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * GET /api/marketplace-analytics/dashboard/sales-chart
   * Get sales chart data
   */
  router.get('/dashboard/sales-chart', async (req, res) => {
    try {
      // TODO: Implement actual sales tracking over time
      // For now, return mock data
      const mockData = {
        labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
        datasets: [
          {
            label: 'Продажи',
            data: [450, 520, 610, 580, 720, 850],
            fill: false,
            borderColor: '#4CAF50',
            tension: 0.4
          }
        ]
      };

      res.json(mockData);
    } catch (error) {
      logger.error(`Error getting sales chart: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * GET /api/marketplace-analytics/dashboard/top-products
   * Get top performing products
   */
  router.get('/dashboard/top-products', async (req, res) => {
    try {
      const products = await loadData('products.json');

      // Sort by sales and take top 10
      const topProducts = products
        .sort((a, b) => (b.sales || 0) - (a.sales || 0))
        .slice(0, 10);

      res.json(topProducts);
    } catch (error) {
      logger.error(`Error getting top products: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // Products Endpoints
  // ========================================

  /**
   * GET /api/marketplace-analytics/products
   * Get all products
   */
  router.get('/products', async (req, res) => {
    try {
      const { marketplace } = req.query;
      let products = await loadData('products.json');

      // Filter by marketplace if specified
      if (marketplace && marketplace !== 'null') {
        products = products.filter(p => p.marketplace === marketplace);
      }

      res.json(products);
    } catch (error) {
      logger.error(`Error getting products: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/marketplace-analytics/products
   * Add a new product
   */
  router.post('/products', async (req, res) => {
    try {
      const { marketplace, url, name } = req.body;

      if (!marketplace || !url) {
        return res.status(400).json({
          error: 'Missing required fields',
          detail: 'marketplace and url are required'
        });
      }

      const products = await loadData('products.json');

      // Generate new product
      const newProduct = {
        id: Date.now(),
        marketplace,
        url,
        title: name || 'New Product',
        sku: `SKU${Date.now()}`,
        price: 0,
        stock: 0,
        sales: 0,
        position: null,
        positionChange: null,
        rating: null,
        reviews: 0,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      products.push(newProduct);
      await saveData('products.json', products);

      logger.info(`Product added: ${newProduct.id}`);
      res.json(newProduct);
    } catch (error) {
      logger.error(`Error adding product: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * PUT /api/marketplace-analytics/products/:id
   * Update a product
   */
  router.put('/products/:id', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const updates = req.body;

      const products = await loadData('products.json');
      const index = products.findIndex(p => p.id === productId);

      if (index === -1) {
        return res.status(404).json({
          error: 'Product not found',
          detail: `Product with id ${productId} not found`
        });
      }

      products[index] = {
        ...products[index],
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      await saveData('products.json', products);

      logger.info(`Product updated: ${productId}`);
      res.json(products[index]);
    } catch (error) {
      logger.error(`Error updating product: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * DELETE /api/marketplace-analytics/products/:id
   * Delete a product
   */
  router.delete('/products/:id', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);

      const products = await loadData('products.json');
      const filtered = products.filter(p => p.id !== productId);

      if (filtered.length === products.length) {
        return res.status(404).json({
          error: 'Product not found',
          detail: `Product with id ${productId} not found`
        });
      }

      await saveData('products.json', filtered);

      logger.info(`Product deleted: ${productId}`);
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
      logger.error(`Error deleting product: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/marketplace-analytics/products/:id/refresh
   * Refresh product data from marketplace
   */
  router.post('/products/:id/refresh', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);

      // TODO: Implement actual marketplace API integration
      // For now, simulate a refresh with random data updates
      const products = await loadData('products.json');
      const index = products.findIndex(p => p.id === productId);

      if (index === -1) {
        return res.status(404).json({
          error: 'Product not found',
          detail: `Product with id ${productId} not found`
        });
      }

      // Simulate data refresh
      products[index] = {
        ...products[index],
        sales: products[index].sales + Math.floor(Math.random() * 10),
        position: Math.max(1, (products[index].position || 10) + Math.floor(Math.random() * 5) - 2),
        rating: Math.min(5, Math.max(1, (products[index].rating || 4) + (Math.random() - 0.5) * 0.2)),
        lastUpdated: new Date().toISOString()
      };

      await saveData('products.json', products);

      logger.info(`Product refreshed: ${productId}`);
      res.json(products[index]);
    } catch (error) {
      logger.error(`Error refreshing product: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // Competitors Endpoints
  // ========================================

  /**
   * GET /api/marketplace-analytics/competitors
   * Get all competitors
   */
  router.get('/competitors', async (req, res) => {
    try {
      const competitors = await loadData('competitors.json');
      res.json(competitors);
    } catch (error) {
      logger.error(`Error getting competitors: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/marketplace-analytics/competitors
   * Add a new competitor
   */
  router.post('/competitors', async (req, res) => {
    try {
      const { marketplace, sellerId } = req.body;

      if (!marketplace || !sellerId) {
        return res.status(400).json({
          error: 'Missing required fields',
          detail: 'marketplace and sellerId are required'
        });
      }

      const competitors = await loadData('competitors.json');

      // Generate new competitor
      const newCompetitor = {
        id: Date.now(),
        marketplace,
        sellerId,
        sellerName: `Competitor ${sellerId}`,
        productsCount: 0,
        avgPrice: 0,
        estimatedSales: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      competitors.push(newCompetitor);
      await saveData('competitors.json', competitors);

      logger.info(`Competitor added: ${newCompetitor.id}`);
      res.json(newCompetitor);
    } catch (error) {
      logger.error(`Error adding competitor: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * DELETE /api/marketplace-analytics/competitors/:id
   * Delete a competitor
   */
  router.delete('/competitors/:id', async (req, res) => {
    try {
      const competitorId = parseInt(req.params.id);

      const competitors = await loadData('competitors.json');
      const filtered = competitors.filter(c => c.id !== competitorId);

      if (filtered.length === competitors.length) {
        return res.status(404).json({
          error: 'Competitor not found',
          detail: `Competitor with id ${competitorId} not found`
        });
      }

      await saveData('competitors.json', filtered);

      logger.info(`Competitor deleted: ${competitorId}`);
      res.json({ success: true, message: 'Competitor deleted' });
    } catch (error) {
      logger.error(`Error deleting competitor: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/marketplace-analytics/competitors/:id/refresh
   * Refresh competitor data
   */
  router.post('/competitors/:id/refresh', async (req, res) => {
    try {
      const competitorId = parseInt(req.params.id);

      // TODO: Implement actual marketplace API integration
      const competitors = await loadData('competitors.json');
      const index = competitors.findIndex(c => c.id === competitorId);

      if (index === -1) {
        return res.status(404).json({
          error: 'Competitor not found',
          detail: `Competitor with id ${competitorId} not found`
        });
      }

      // Simulate data refresh
      competitors[index] = {
        ...competitors[index],
        productsCount: competitors[index].productsCount + Math.floor(Math.random() * 5),
        estimatedSales: competitors[index].estimatedSales + Math.floor(Math.random() * 100),
        lastUpdated: new Date().toISOString()
      };

      await saveData('competitors.json', competitors);

      logger.info(`Competitor refreshed: ${competitorId}`);
      res.json(competitors[index]);
    } catch (error) {
      logger.error(`Error refreshing competitor: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // Price Monitoring Endpoints
  // ========================================

  /**
   * GET /api/marketplace-analytics/price-changes
   * Get price change history
   */
  router.get('/price-changes', async (req, res) => {
    try {
      const priceChanges = await loadData('price-changes.json');
      res.json(priceChanges);
    } catch (error) {
      logger.error(`Error getting price changes: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * GET /api/marketplace-analytics/price-chart
   * Get price chart data
   */
  router.get('/price-chart', async (req, res) => {
    try {
      // TODO: Implement actual price tracking over time
      // For now, return mock data
      const mockData = {
        labels: ['1 нед', '2 нед', '3 нед', '4 нед'],
        datasets: [
          {
            label: 'Мой товар',
            data: [2500, 2450, 2399, 2350],
            borderColor: '#4CAF50',
            tension: 0.4
          },
          {
            label: 'Конкурент A',
            data: [2400, 2350, 2300, 2250],
            borderColor: '#F44336',
            tension: 0.4
          }
        ]
      };

      res.json(mockData);
    } catch (error) {
      logger.error(`Error getting price chart: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // AI Insights Endpoints (placeholder for future integration)
  // ========================================

  /**
   * POST /api/marketplace-analytics/insights/generate
   * Generate AI insights
   *
   * NOTE: This endpoint should be integrated with the TokenBasedLLMCoordinator
   * when implementing actual AI functionality. For now, it returns mock insights.
   */
  router.post('/insights/generate', async (req, res) => {
    try {
      const { type, accessToken, modelId } = req.body;

      if (!accessToken || !modelId) {
        return res.status(400).json({
          error: 'Missing required fields',
          detail: 'accessToken and modelId are required for AI insights'
        });
      }

      logger.info(`Generating ${type} insights using model ${modelId}`);

      // TODO: Integrate with TokenBasedLLMCoordinator
      // const coordinator = new TokenBasedLLMCoordinator({ db });
      // const result = await coordinator.chatWithToken(accessToken, modelId, prompt, options);

      // Mock insights for now
      const mockInsights = [
        {
          type,
          title: 'Ценовая оптимизация',
          description: 'Ваши цены на 12% выше среднерыночных в категории',
          priority: 'high',
          recommendations: [
            'Снизить цену на топ-3 товара на 8-10%',
            'Установить автоматическое отслеживание цен конкурентов',
            'Запланировать акцию на следующую неделю'
          ],
          createdAt: new Date().toISOString()
        }
      ];

      res.json(mockInsights);
    } catch (error) {
      logger.error(`Error generating insights: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  return router;
}

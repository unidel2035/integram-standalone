// youtube.js - YouTube Analytics API routes (Native Node.js Implementation)
import express from 'express';
import { YouTubeService } from '../../services/youtube/YouTubeService.js';
import { AdvancedAnalyticsService } from '../../services/youtube/AdvancedAnalyticsService.js';
import logger from '../../utils/logger.js';

/**
 * Create YouTube Analytics routes
 * Native Node.js implementation using YouTube Data API v3
 * Replaces the Python FastAPI proxy with direct implementation
 */
export function createYouTubeRoutes() {
  const router = express.Router();

  /**
   * Get YouTube service instance with API key from request headers or environment
   */
  const getYouTubeService = (req) => {
    // Check for client-provided YouTube token in headers
    const youtubeToken = req.headers['x-youtube-token'];

    if (youtubeToken) {
      logger.info('Using client-provided YouTube API token');
      return new YouTubeService(youtubeToken);
    }

    // Use server-side API key
    logger.info('Using server-side YouTube API token');
    return new YouTubeService();
  };

  // Initialize Advanced Analytics service (stateless, no API key needed)
  const advancedAnalytics = new AdvancedAnalyticsService();

  // ========================================
  // Basic Channel Information Endpoints
  // ========================================

  /**
   * POST /api/youtube/channel/stats
   * Get channel statistics
   */
  router.post('/channel/stats', async (req, res) => {
    try {
      const { channel_id } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Getting stats for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);
      const stats = await youtubeService.getChannelStatistics(channel_id);

      if (!stats) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: `Channel not found: ${channel_id}`
        });
      }

      res.json(stats);

    } catch (error) {
      logger.error(`Error getting channel stats: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      if (error.code === 403 || error.message.includes('quota')) {
        return res.status(403).json({
          error: 'YouTube API quota exceeded',
          detail: 'Please check your API key and quota limits'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/channel/videos
   * Get recent videos from a channel
   */
  router.post('/channel/videos', async (req, res) => {
    try {
      const { channel_id, max_results = 50 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Getting recent videos for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);
      const videos = await youtubeService.getRecentVideos(channel_id, max_results);

      res.json({
        channel_id,
        max_results,
        videos_count: videos.length,
        videos
      });

    } catch (error) {
      logger.error(`Error getting recent videos: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/video/comments
   * Get comments for a specific video
   */
  router.post('/video/comments', async (req, res) => {
    try {
      const { video_id, max_results = 100, order = 'relevance' } = req.body;

      if (!video_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'video_id is required'
        });
      }

      logger.info(`Getting comments for video: ${video_id}, max_results: ${max_results}, order: ${order}`);

      const youtubeService = getYouTubeService(req);
      const comments = await youtubeService.getVideoComments(video_id, max_results, order);

      res.json({
        success: true,
        video_id: video_id,
        comments_count: comments.length,
        comments: comments
      });

    } catch (error) {
      logger.error(`Error getting video comments: ${error.message}`);

      if (error.message.includes('Comments are disabled')) {
        return res.status(403).json({
          error: 'Comments disabled',
          detail: error.message
        });
      }

      if (error.message.includes('Video not found')) {
        return res.status(404).json({
          error: 'Video not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/videos/comments
   * Get comments for multiple videos
   */
  router.post('/videos/comments', async (req, res) => {
    try {
      const { video_ids, comments_per_video = 50 } = req.body;

      if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'video_ids array is required'
        });
      }

      logger.info(`Getting comments for ${video_ids.length} videos, ${comments_per_video} per video`);

      const youtubeService = getYouTubeService(req);
      const comments = await youtubeService.getMultipleVideosComments(video_ids, comments_per_video);

      res.json({
        success: true,
        videos_count: video_ids.length,
        total_comments: comments.length,
        comments: comments
      });

    } catch (error) {
      logger.error(`Error getting comments for multiple videos: ${error.message}`);

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/channel/performance
   * Analyze channel performance over a period
   */
  router.post('/channel/performance', async (req, res) => {
    try {
      const { channel_id, days = 30 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Analyzing performance for channel: ${channel_id}, days: ${days}`);

      const youtubeService = getYouTubeService(req);
      const performance = await youtubeService.analyzeChannelPerformance(channel_id, days);

      if (!performance) {
        return res.status(404).json({
          error: 'Failed to analyze channel',
          detail: `Failed to analyze channel: ${channel_id}`
        });
      }

      res.json(performance);

    } catch (error) {
      logger.error(`Error analyzing channel performance: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/channels/compare
   * Compare multiple channels
   */
  router.post('/channels/compare', async (req, res) => {
    try {
      const { channel_ids, days = 30 } = req.body;

      if (!channel_ids || !Array.isArray(channel_ids) || channel_ids.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          detail: 'At least one channel ID required in channel_ids array'
        });
      }

      logger.info(`Comparing ${channel_ids.length} channels for ${days} days`);
      logger.info(`Channel identifiers: ${channel_ids.join(', ')}`);

      const youtubeService = getYouTubeService(req);
      const comparison = await youtubeService.compareChannels(channel_ids, days);

      if (!comparison) {
        return res.status(500).json({
          error: 'Failed to compare channels'
        });
      }

      res.json(comparison);

    } catch (error) {
      logger.error(`Error comparing channels: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // Advanced Analytics Endpoints
  // ========================================

  /**
   * POST /api/youtube/advanced/kpis
   * Get channel KPIs (Key Performance Indicators)
   */
  router.post('/advanced/kpis', async (req, res) => {
    try {
      const { channel_id, max_videos = 50 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Getting KPIs for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);

      // Get channel statistics
      const channelStats = await youtubeService.getChannelStatistics(channel_id);
      if (!channelStats) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: `Channel not found: ${channel_id}`
        });
      }

      // Get videos
      const videos = await youtubeService.getRecentVideos(channel_id, max_videos);

      // Calculate KPIs
      const kpis = advancedAnalytics.calculateKPIs(channelStats, videos);

      res.json(kpis);

    } catch (error) {
      logger.error(`Error calculating KPIs: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/recommendations
   * Get AI-generated recommendations for channel improvement
   */
  router.post('/advanced/recommendations', async (req, res) => {
    try {
      const { channel_id, max_videos = 50 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Generating recommendations for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);

      // Get channel statistics
      const channelStats = await youtubeService.getChannelStatistics(channel_id);
      if (!channelStats) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: `Channel not found: ${channel_id}`
        });
      }

      // Get videos
      const videos = await youtubeService.getRecentVideos(channel_id, max_videos);

      // Calculate KPIs
      const kpis = advancedAnalytics.calculateKPIs(channelStats, videos);

      // Rank videos by engagement
      const topVideos = advancedAnalytics.rankVideos(videos, 'engagement', 10);

      // Generate recommendations
      const recommendations = advancedAnalytics.generateRecommendations(kpis, topVideos);

      res.json({
        channel_id: channelStats.channel_id,
        channel_title: channelStats.title,
        timestamp: new Date().toISOString(),
        recommendations,
        kpis_summary: {
          avg_engagement_rate: kpis.avg_engagement_rate,
          total_videos: kpis.total_videos,
          shorts_count: kpis.shorts_count,
          regular_videos_count: kpis.regular_videos_count
        }
      });

    } catch (error) {
      logger.error(`Error generating recommendations: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/compare
   * Advanced comparison with additional metrics
   */
  router.post('/advanced/compare', async (req, res) => {
    try {
      const { channel_ids, days = 30, max_videos = 50 } = req.body;

      if (!channel_ids || !Array.isArray(channel_ids) || channel_ids.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          detail: 'At least one channel ID required in channel_ids array'
        });
      }

      logger.info(`Advanced comparison of ${channel_ids.length} channels`);

      const youtubeService = getYouTubeService(req);
      const channelsData = [];

      for (const channelId of channel_ids) {
        try {
          // Get basic statistics
          const channelStats = await youtubeService.getChannelStatistics(channelId);
          if (!channelStats) {
            logger.warn(`Channel not found: ${channelId}`);
            continue;
          }

          // Get videos
          const videos = await youtubeService.getRecentVideos(channelId, max_videos);

          // Calculate KPIs
          const kpis = advancedAnalytics.calculateKPIs(channelStats, videos);

          // Rank videos
          const topVideosByEngagement = advancedAnalytics.rankVideos(videos, 'engagement', 5);

          // Generate recommendations
          const recommendations = advancedAnalytics.generateRecommendations(kpis, topVideosByEngagement);

          channelsData.push({
            channel_id: channelStats.channel_id,
            channel_title: channelStats.title,
            kpis,
            top_videos: topVideosByEngagement,
            recommendations
          });

        } catch (error) {
          logger.error(`Error processing channel ${channelId}: ${error.message}`);
          continue;
        }
      }

      if (channelsData.length === 0) {
        return res.status(404).json({
          error: 'No valid channels found'
        });
      }

      // Sort channels by various metrics
      const byEngagement = [...channelsData]
        .sort((a, b) => (b.kpis.avg_engagement_rate || 0) - (a.kpis.avg_engagement_rate || 0))
        .map(c => ({
          channel_title: c.channel_title,
          engagement_rate: c.kpis.avg_engagement_rate || 0
        }));

      const bySubscribers = [...channelsData]
        .sort((a, b) => (b.kpis.subscriber_count || 0) - (a.kpis.subscriber_count || 0))
        .map(c => ({
          channel_title: c.channel_title,
          subscriber_count: c.kpis.subscriber_count || 0
        }));

      const byShortsPerformance = [...channelsData]
        .sort((a, b) =>
          (b.kpis.shorts_metrics?.avg_engagement_rate || 0) -
          (a.kpis.shorts_metrics?.avg_engagement_rate || 0)
        )
        .map(c => ({
          channel_title: c.channel_title,
          shorts_engagement: c.kpis.shorts_metrics?.avg_engagement_rate || 0,
          shorts_count: c.kpis.shorts_count || 0
        }));

      res.json({
        analysis_date: new Date().toISOString(),
        channels_analyzed: channelsData.length,
        period_days: days,
        channels: channelsData,
        rankings: {
          by_engagement: byEngagement,
          by_subscribers: bySubscribers,
          by_shorts_performance: byShortsPerformance
        }
      });

    } catch (error) {
      logger.error(`Error in advanced comparison: ${error.message}`);

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/vpd-metrics
   * Get Views Per Day (VPD) metrics
   */
  router.post('/advanced/vpd-metrics', async (req, res) => {
    try {
      const { channel_id, max_videos = 50 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Calculating VPD metrics for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);

      // Get videos
      const videos = await youtubeService.getRecentVideos(channel_id, max_videos);

      // Calculate VPD metrics
      const vpdData = advancedAnalytics.calculateVPDMetrics(videos);

      // Add channel_id and timestamp
      vpdData.channel_id = channel_id;
      vpdData.timestamp = new Date().toISOString();

      res.json(vpdData);

    } catch (error) {
      logger.error(`Error calculating VPD metrics: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/delta-metrics
   * Calculate delta (changes) between two data snapshots
   */
  router.post('/advanced/delta-metrics', async (req, res) => {
    try {
      const { current_data, previous_data } = req.body;

      if (!current_data || !previous_data) {
        return res.status(400).json({
          error: 'Missing required fields',
          detail: 'current_data and previous_data are required'
        });
      }

      logger.info('Calculating delta metrics');

      const deltaData = advancedAnalytics.calculateDeltaMetrics(current_data, previous_data);

      res.json(deltaData);

    } catch (error) {
      logger.error(`Error calculating delta metrics: ${error.message}`);

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/generate-alerts
   * Generate alerts based on customizable thresholds
   */
  router.post('/advanced/generate-alerts', async (req, res) => {
    try {
      const {
        channel_id,
        max_videos = 50,
        thresholds = {}
      } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Generating alerts for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);

      // Get channel statistics
      const channelStats = await youtubeService.getChannelStatistics(channel_id);
      if (!channelStats) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: `Channel not found: ${channel_id}`
        });
      }

      // Get videos
      const videos = await youtubeService.getRecentVideos(channel_id, max_videos);

      // Calculate VPD metrics
      const vpdData = advancedAnalytics.calculateVPDMetrics(videos);

      // Calculate KPIs for ER
      const kpis = advancedAnalytics.calculateKPIs(channelStats, videos);

      // Generate alerts
      const alerts = advancedAnalytics.generateAlerts(
        channelStats,
        videos,
        vpdData,
        kpis,
        thresholds
      );

      res.json(alerts);

    } catch (error) {
      logger.error(`Error generating alerts: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  /**
   * POST /api/youtube/advanced/trending-videos
   * Get trending videos based on VPD metrics
   */
  router.post('/advanced/trending-videos', async (req, res) => {
    try {
      const { channel_id, max_videos = 50 } = req.body;

      if (!channel_id) {
        return res.status(400).json({
          error: 'Missing required field',
          detail: 'channel_id is required'
        });
      }

      logger.info(`Getting trending videos for channel: ${channel_id}`);

      const youtubeService = getYouTubeService(req);

      // Get channel statistics
      const channelStats = await youtubeService.getChannelStatistics(channel_id);
      if (!channelStats) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: `Channel not found: ${channel_id}`
        });
      }

      // Get videos
      const videos = await youtubeService.getRecentVideos(channel_id, max_videos);

      // Calculate VPD metrics
      const vpdData = advancedAnalytics.calculateVPDMetrics(videos);

      const trendingVideos = vpdData.trending_videos || [];

      res.json({
        channel_id: channelStats.channel_id,
        channel_title: channelStats.title,
        timestamp: new Date().toISOString(),
        trending_videos: trendingVideos,
        trending_count: trendingVideos.length,
        avg_vpd: vpdData.avg_vpd || 0,
        trending_threshold: vpdData.trending_threshold || 0,
        summary: {
          total_videos_analyzed: vpdData.total_videos_analyzed || 0,
          avg_vpd: vpdData.avg_vpd || 0,
          median_vpd: vpdData.median_vpd || 0,
          max_vpd: vpdData.max_vpd || 0
        }
      });

    } catch (error) {
      logger.error(`Error getting trending videos: ${error.message}`);

      if (error.message.includes('Channel not found')) {
        return res.status(404).json({
          error: 'Channel not found',
          detail: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  });

  // ========================================
  // Telegram Notification Endpoints
  // ========================================
  // Note: These endpoints require TELEGRAM_BOT_TOKEN environment variable
  // They are currently not implemented in Node.js
  // If needed, we can add telegram-bot-api package

  /**
   * POST /api/telegram/send
   * Send a Telegram notification
   */
  router.post('/send', async (req, res) => {
    res.status(501).json({
      error: 'Not implemented',
      detail: 'Telegram notification endpoints are not yet implemented in Node.js backend. Use Python backend or implement using telegram-bot-api package.'
    });
  });

  /**
   * POST /api/telegram/test
   * Send a test Telegram notification
   */
  router.post('/test', async (req, res) => {
    res.status(501).json({
      error: 'Not implemented',
      detail: 'Telegram notification endpoints are not yet implemented in Node.js backend. Use Python backend or implement using telegram-bot-api package.'
    });
  });

  // ========================================
  // Health Check
  // ========================================

  /**
   * GET /api/youtube/health
   * Check if YouTube Analytics service is operational
   */
  router.get('/health', async (req, res) => {
    try {
      // Check if API key is configured
      const apiKey = process.env.YOUTUBE_API_KEY;

      res.json({
        status: apiKey ? 'ok' : 'warning',
        service: 'youtube-analytics-native',
        implementation: 'Node.js (Native)',
        api_key_configured: !!apiKey,
        message: apiKey
          ? 'YouTube Analytics service is operational'
          : 'YouTube API key not configured. Set YOUTUBE_API_KEY environment variable.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`YouTube Analytics health check failed: ${error.message}`);

      res.status(503).json({
        status: 'error',
        service: 'youtube-analytics-native',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

// AdvancedAnalyticsService.js - Advanced YouTube Analytics
import logger from '../../utils/logger.js';

/**
 * Advanced Analytics Service
 * Provides KPIs, recommendations, VPD metrics, and alerts
 */
export class AdvancedAnalyticsService {
  constructor() {
    logger.info('AdvancedAnalyticsService initialized');
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} duration - ISO 8601 duration (e.g., PT1H2M10S)
   * @returns {number} - Duration in seconds
   */
  _parseDuration(duration) {
    if (!duration) return 0;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Calculate metrics for a group of videos
   * @param {Array} videos - Array of videos
   * @returns {Object} - Metrics object
   */
  _calculateVideoGroupMetrics(videos) {
    if (!videos || videos.length === 0) {
      return {
        count: 0,
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        avg_views: 0,
        avg_likes: 0,
        avg_comments: 0,
        avg_engagement_rate: 0
      };
    }

    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const totalLikes = videos.reduce((sum, v) => sum + (v.like_count || 0), 0);
    const totalComments = videos.reduce((sum, v) => sum + (v.comment_count || 0), 0);

    const count = videos.length;
    const avgViews = totalViews / count;
    const avgLikes = totalLikes / count;
    const avgComments = totalComments / count;
    const avgEngagementRate = totalViews > 0
      ? ((totalLikes + totalComments) / totalViews * 100)
      : 0;

    return {
      count,
      total_views: totalViews,
      total_likes: totalLikes,
      total_comments: totalComments,
      avg_views: Math.round(avgViews),
      avg_likes: Math.round(avgLikes),
      avg_comments: Math.round(avgComments),
      avg_engagement_rate: parseFloat(avgEngagementRate.toFixed(2))
    };
  }

  /**
   * Calculate median value
   * @param {Array<number>} values - Array of numbers
   * @returns {number} - Median value
   */
  _median(values) {
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calculate Key Performance Indicators (KPIs)
   * @param {Object} channelStats - Channel statistics
   * @param {Array} videos - Array of videos
   * @returns {Object} - KPIs object
   */
  calculateKPIs(channelStats, videos) {
    if (!videos || videos.length === 0) {
      return {
        error: 'No videos available for analysis',
        channel_title: channelStats.title || 'Unknown'
      };
    }

    // Basic metrics
    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const totalLikes = videos.reduce((sum, v) => sum + (v.like_count || 0), 0);
    const totalComments = videos.reduce((sum, v) => sum + (v.comment_count || 0), 0);

    // Average values
    const avgViews = totalViews / totalVideos;
    const avgLikes = totalLikes / totalVideos;
    const avgComments = totalComments / totalVideos;

    // Engagement Rate
    const avgEngagementRate = totalViews > 0
      ? ((totalLikes + totalComments) / totalViews * 100)
      : 0;

    // Separate Shorts and regular videos
    const shorts = videos.filter(v => this._parseDuration(v.duration) <= 60);
    const regularVideos = videos.filter(v => this._parseDuration(v.duration) > 60);

    const shortsMetrics = this._calculateVideoGroupMetrics(shorts);
    const regularMetrics = this._calculateVideoGroupMetrics(regularVideos);

    // Median values
    const viewsList = videos.map(v => v.view_count || 0);
    const likesList = videos.map(v => v.like_count || 0);
    const medianViews = this._median(viewsList);
    const medianLikes = this._median(likesList);

    return {
      channel_id: channelStats.channel_id,
      channel_title: channelStats.title,
      timestamp: new Date().toISOString(),

      // Overall metrics
      total_videos: totalVideos,
      total_views: totalViews,
      total_likes: totalLikes,
      total_comments: totalComments,

      // Average values
      avg_views_per_video: Math.round(avgViews),
      avg_likes_per_video: Math.round(avgLikes),
      avg_comments_per_video: Math.round(avgComments),
      avg_engagement_rate: parseFloat(avgEngagementRate.toFixed(2)),

      // Median values
      median_views: Math.round(medianViews),
      median_likes: Math.round(medianLikes),

      // Subscriber info
      subscriber_count: channelStats.subscriber_count,
      video_count: channelStats.video_count,

      // Content breakdown
      shorts_count: shorts.length,
      regular_videos_count: regularVideos.length,
      shorts_metrics: shortsMetrics,
      regular_metrics: regularMetrics
    };
  }

  /**
   * Rank videos by specified metric
   * @param {Array} videos - Array of videos
   * @param {string} sortBy - Metric to sort by (views, likes, engagement)
   * @param {number} limit - Max number of videos to return
   * @returns {Array} - Sorted array of videos
   */
  rankVideos(videos, sortBy = 'views', limit = 10) {
    if (!videos || videos.length === 0) return [];

    let sorted = [...videos];

    switch (sortBy) {
      case 'views':
        sorted.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;

      case 'likes':
        sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;

      case 'engagement':
        sorted.sort((a, b) => {
          const engA = a.view_count > 0
            ? ((a.like_count + a.comment_count) / a.view_count * 100)
            : 0;
          const engB = b.view_count > 0
            ? ((b.like_count + b.comment_count) / b.view_count * 100)
            : 0;
          return engB - engA;
        });
        break;

      default:
        sorted.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    }

    return sorted.slice(0, limit).map(v => ({
      video_id: v.video_id,
      title: v.title,
      views: v.view_count,
      likes: v.like_count,
      comments: v.comment_count,
      published_at: v.published_at,
      duration: v.duration,
      engagement_rate: v.view_count > 0
        ? parseFloat((((v.like_count + v.comment_count) / v.view_count) * 100).toFixed(2))
        : 0
    }));
  }

  /**
   * Generate recommendations for channel improvement
   * @param {Object} kpis - KPIs object
   * @param {Array} topVideos - Top performing videos
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations(kpis, topVideos) {
    const recommendations = [];

    // Content format recommendations
    if (kpis.shorts_count > 0 && kpis.regular_videos_count > 0) {
      const shortsER = kpis.shorts_metrics.avg_engagement_rate;
      const regularER = kpis.regular_metrics.avg_engagement_rate;

      if (shortsER > regularER * 1.5) {
        recommendations.push({
          type: 'format',
          priority: 'high',
          title: 'Увеличьте долю Shorts',
          description: `Ваши Shorts показывают на ${Math.round((shortsER / regularER - 1) * 100)}% выше вовлеченность, чем обычные видео`,
          metric: 'engagement_rate',
          current_value: regularER,
          target_value: shortsER
        });
      } else if (regularER > shortsER * 1.5) {
        recommendations.push({
          type: 'format',
          priority: 'high',
          title: 'Сосредоточьтесь на полноформатном контенте',
          description: `Ваши обычные видео показывают на ${Math.round((regularER / shortsER - 1) * 100)}% выше вовлеченность, чем Shorts`,
          metric: 'engagement_rate',
          current_value: shortsER,
          target_value: regularER
        });
      }
    }

    // Engagement recommendations
    if (kpis.avg_engagement_rate < 2.0) {
      recommendations.push({
        type: 'engagement',
        priority: 'high',
        title: 'Низкий Engagement Rate',
        description: 'Добавляйте call-to-action, задавайте вопросы зрителям, используйте интерактивные элементы',
        metric: 'engagement_rate',
        current_value: kpis.avg_engagement_rate,
        target_value: 2.0
      });
    }

    // Publishing frequency
    if (kpis.total_videos < 20) {
      recommendations.push({
        type: 'frequency',
        priority: 'medium',
        title: 'Увеличьте частоту публикаций',
        description: 'Регулярные публикации помогают росту канала. Стремитесь к 2-3 видео в неделю',
        metric: 'total_videos',
        current_value: kpis.total_videos,
        target_value: 50
      });
    }

    // View consistency
    const viewVariation = kpis.avg_views_per_video > 0
      ? Math.abs(kpis.median_views - kpis.avg_views_per_video) / kpis.avg_views_per_video
      : 0;

    if (viewVariation > 0.5) {
      recommendations.push({
        type: 'consistency',
        priority: 'medium',
        title: 'Большой разброс в просмотрах',
        description: 'Проанализируйте топ видео и создавайте больше контента в популярном формате',
        metric: 'view_variation',
        current_value: viewVariation,
        target_value: 0.3
      });
    }

    // Strategy based on top videos
    if (topVideos && topVideos.length > 0) {
      const topVideo = topVideos[0];
      recommendations.push({
        type: 'strategy',
        priority: 'high',
        title: 'Повторите успех лучшего видео',
        description: `Ваше топ видео "${topVideo.title.substring(0, 50)}..." набрало ${topVideo.views.toLocaleString()} просмотров. Создайте похожий контент`,
        metric: 'views',
        current_value: kpis.avg_views_per_video,
        target_value: topVideo.views
      });
    }

    return recommendations;
  }

  /**
   * Calculate Views Per Day (VPD) metrics
   * @param {Array} videos - Array of videos
   * @returns {Object} - VPD metrics
   */
  calculateVPDMetrics(videos) {
    if (!videos || videos.length === 0) {
      return {
        total_videos_analyzed: 0,
        avg_vpd: 0,
        median_vpd: 0,
        max_vpd: 0,
        trending_threshold: 0,
        trending_videos: []
      };
    }

    const now = new Date();
    const vpdData = [];

    for (const video of videos) {
      const publishedDate = new Date(video.published_at);
      const daysSincePublished = Math.max(1, Math.floor((now - publishedDate) / (1000 * 60 * 60 * 24)));
      const vpd = (video.view_count || 0) / daysSincePublished;

      vpdData.push({
        video_id: video.video_id,
        title: video.title,
        views: video.view_count || 0,
        published_at: video.published_at,
        days_since_published: daysSincePublished,
        vpd: Math.round(vpd)
      });
    }

    const vpdValues = vpdData.map(v => v.vpd);
    const avgVPD = vpdValues.reduce((sum, v) => sum + v, 0) / vpdValues.length;
    const medianVPD = this._median(vpdValues);
    const maxVPD = Math.max(...vpdValues);

    // Trending threshold: videos with VPD > 1.5x median
    const trendingThreshold = medianVPD * 1.5;

    const trendingVideos = vpdData
      .filter(v => v.vpd > trendingThreshold)
      .sort((a, b) => b.vpd - a.vpd);

    return {
      total_videos_analyzed: videos.length,
      avg_vpd: Math.round(avgVPD),
      median_vpd: Math.round(medianVPD),
      max_vpd: Math.round(maxVPD),
      trending_threshold: Math.round(trendingThreshold),
      trending_videos: trendingVideos
    };
  }

  /**
   * Calculate delta (changes) between two data snapshots
   * @param {Object} currentData - Current data snapshot
   * @param {Object} previousData - Previous data snapshot
   * @returns {Object} - Delta metrics
   */
  calculateDeltaMetrics(currentData, previousData) {
    const delta = {};

    // Calculate delta for common numeric fields
    const numericFields = [
      'subscriber_count', 'video_count', 'view_count',
      'views', 'likes', 'comments', 'engagement_rate'
    ];

    for (const field of numericFields) {
      if (field in currentData && field in previousData) {
        const current = currentData[field] || 0;
        const previous = previousData[field] || 0;
        const change = current - previous;
        const percentChange = previous > 0
          ? ((change / previous) * 100)
          : 0;

        delta[field] = {
          current,
          previous,
          change,
          percent_change: parseFloat(percentChange.toFixed(2))
        };
      }
    }

    delta.timestamp = new Date().toISOString();

    return delta;
  }

  /**
   * Generate alerts based on metrics and thresholds
   * @param {Object} channelStats - Channel statistics
   * @param {Array} videos - Array of videos
   * @param {Object} vpdData - VPD metrics
   * @param {Object} kpis - KPIs
   * @param {Object} thresholds - Alert thresholds
   * @returns {Object} - Alerts object
   */
  generateAlerts(channelStats, videos, vpdData, kpis, thresholds = {}) {
    const {
      vpd_spike_threshold = 10000,
      low_er_threshold = 0.5,
      low_vpd_threshold = 100
    } = thresholds;

    const alerts = [];

    // Check for Views Spike (high VPD)
    if (vpdData.avg_vpd > vpd_spike_threshold) {
      alerts.push({
        type: 'views_spike',
        priority: 'high',
        icon: '🔥',
        title: 'Всплеск просмотров обнаружен',
        description: `Средний VPD (${vpdData.avg_vpd}) превышает порог (${vpd_spike_threshold})`,
        metric: 'avg_vpd',
        value: vpdData.avg_vpd,
        threshold: vpd_spike_threshold,
        timestamp: new Date().toISOString()
      });
    }

    // Check trending videos
    if (vpdData.trending_videos && vpdData.trending_videos.length > 0) {
      for (const video of vpdData.trending_videos.slice(0, 3)) {
        if (video.vpd > vpd_spike_threshold) {
          alerts.push({
            type: 'views_spike',
            priority: 'medium',
            icon: '🔥',
            title: `Трендовое видео: ${video.title.substring(0, 50)}...`,
            description: `VPD: ${video.vpd}, Views: ${video.views.toLocaleString()}`,
            video_id: video.video_id,
            metric: 'vpd',
            value: video.vpd,
            threshold: vpd_spike_threshold,
            url: `https://youtube.com/watch?v=${video.video_id}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Check for Low ER
    const avgER = kpis.avg_engagement_rate || 0;
    if (avgER < low_er_threshold) {
      alerts.push({
        type: 'low_er',
        priority: 'high',
        icon: '⚠️',
        title: 'Низкий Engagement Rate',
        description: `ER (${avgER.toFixed(2)}%) ниже порога (${low_er_threshold}%)`,
        metric: 'engagement_rate',
        value: avgER,
        threshold: low_er_threshold,
        recommendation: 'Добавляйте call-to-action, задавайте вопросы в видео',
        timestamp: new Date().toISOString()
      });
    }

    // Check for Low VPD
    if (vpdData.avg_vpd < low_vpd_threshold) {
      alerts.push({
        type: 'low_vpd',
        priority: 'medium',
        icon: '📉',
        title: 'Низкий рост просмотров',
        description: `Средний VPD (${vpdData.avg_vpd}) ниже минимального порога (${low_vpd_threshold})`,
        metric: 'avg_vpd',
        value: vpdData.avg_vpd,
        threshold: low_vpd_threshold,
        recommendation: 'Улучшите продвижение видео, оптимизируйте заголовки и превью',
        timestamp: new Date().toISOString()
      });
    }

    return {
      channel_id: channelStats.channel_id,
      channel_title: channelStats.title,
      timestamp: new Date().toISOString(),
      thresholds: {
        vpd_spike: vpd_spike_threshold,
        low_er: low_er_threshold,
        low_vpd: low_vpd_threshold
      },
      alerts,
      alerts_count: alerts.length,
      summary: {
        avg_vpd: vpdData.avg_vpd,
        avg_er: avgER,
        trending_videos_count: vpdData.trending_videos?.length || 0
      }
    };
  }
}

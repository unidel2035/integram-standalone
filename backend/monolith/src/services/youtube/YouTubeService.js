// YouTubeService.js - YouTube Data API v3 Integration
import { google } from 'googleapis';
import logger from '../../utils/logger.js';

/**
 * YouTube Analytics Service
 * Replaces the Python FastAPI YouTube backend with native Node.js implementation
 */
export class YouTubeService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY;

    if (!this.apiKey) {
      throw new Error('YouTube API key is required. Set YOUTUBE_API_KEY environment variable.');
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });

    logger.info('YouTubeService initialized successfully');
  }

  /**
   * Normalize channel identifier - accepts channel ID or @username
   * @param {string} identifier - Channel ID (UCxxxxx) or username (@username)
   * @returns {Promise<string|null>} - Channel ID or null if not found
   */
  async normalizeChannelIdentifier(identifier) {
    try {
      identifier = identifier.trim();

      // If already a channel ID (starts with UC and length ~24 chars)
      if (identifier.startsWith('UC') && identifier.length >= 24) {
        logger.info(`Using channel ID directly: ${identifier}`);
        return identifier;
      }

      // If @username or username, get channel ID
      logger.info(`Converting username to channel ID: ${identifier}`);
      return await this.getChannelIdByUsername(identifier);

    } catch (error) {
      logger.error(`Error normalizing channel identifier: ${error.message}`);
      return null;
    }
  }

  /**
   * Get channel ID by username
   * @param {string} username - YouTube username (e.g., @username)
   * @returns {Promise<string|null>} - Channel ID or null if not found
   */
  async getChannelIdByUsername(username) {
    try {
      const originalUsername = username;
      const usernameWithoutAt = username.replace(/^@/, '');

      // Try forHandle (for new @username handles)
      try {
        logger.info(`Trying to resolve handle: ${usernameWithoutAt}`);
        const response = await this.youtube.channels.list({
          part: 'id',
          forHandle: usernameWithoutAt
        });

        if (response.data.items && response.data.items.length > 0) {
          const channelId = response.data.items[0].id;
          logger.info(`Successfully resolved handle '${originalUsername}' to channel ID: ${channelId}`);
          return channelId;
        }
      } catch (error) {
        logger.debug(`forHandle failed for '${usernameWithoutAt}': ${error.message}`);
      }

      // Try forUsername (legacy format)
      try {
        logger.info(`Trying legacy username: ${usernameWithoutAt}`);
        const response = await this.youtube.channels.list({
          part: 'id',
          forUsername: usernameWithoutAt
        });

        if (response.data.items && response.data.items.length > 0) {
          const channelId = response.data.items[0].id;
          logger.info(`Successfully resolved legacy username '${originalUsername}' to channel ID: ${channelId}`);
          return channelId;
        }
      } catch (error) {
        logger.debug(`forUsername failed for '${usernameWithoutAt}': ${error.message}`);
      }

      // Try search as fallback
      logger.info(`Trying search for: ${usernameWithoutAt}`);
      const searchResponse = await this.youtube.search.list({
        part: 'snippet',
        q: usernameWithoutAt,
        type: 'channel',
        maxResults: 1
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const channelId = searchResponse.data.items[0].snippet.channelId;
        logger.info(`Found channel via search for '${originalUsername}': ${channelId}`);
        return channelId;
      }

      logger.warn(`Channel not found for username: ${originalUsername}`);
      logger.info(`Tried methods: forHandle, forUsername, and search - all failed for '${originalUsername}'`);
      return null;

    } catch (error) {
      logger.error(`Error getting channel ID for '${username}': ${error.message}`);

      // Check for quota error
      if (error.code === 403) {
        logger.error('This might be a YouTube API quota issue. Check your API key and quota limits.');
      }

      return null;
    }
  }

  /**
   * Get full channel statistics
   * @param {string} channelId - Channel ID (UCxxxxx) or username (@username)
   * @returns {Promise<Object|null>} - Channel statistics object
   */
  async getChannelStatistics(channelId) {
    try {
      // Normalize channel identifier
      const originalIdentifier = channelId;
      channelId = await this.normalizeChannelIdentifier(channelId);

      if (!channelId) {
        logger.warn(`Failed to normalize channel identifier: ${originalIdentifier}`);
        throw new Error(
          `Channel not found: '${originalIdentifier}'. ` +
          `Please verify the channel exists on YouTube. ` +
          `Supported formats: channel ID (UCxxxxx), @username, or channel name.`
        );
      }

      const response = await this.youtube.channels.list({
        part: 'snippet,statistics,contentDetails,status,topicDetails,brandingSettings,localizations',
        id: channelId
      });

      if (!response.data.items || response.data.items.length === 0) {
        logger.warn(`Channel not found: ${channelId}`);
        return null;
      }

      const channel = response.data.items[0];
      const snippet = channel.snippet || {};
      const statistics = channel.statistics || {};
      const contentDetails = channel.contentDetails || {};
      const status = channel.status || {};
      const topicDetails = channel.topicDetails || {};
      const brandingSettings = channel.brandingSettings || {};
      const localizations = channel.localizations || {};

      // Build comprehensive channel statistics
      return {
        channel_id: channelId,
        title: snippet.title || '',
        description: snippet.description || '',
        custom_url: snippet.customUrl || '',
        published_at: snippet.publishedAt || '',
        country: snippet.country || '',
        default_language: snippet.defaultLanguage || '',

        // Statistics
        subscriber_count: parseInt(statistics.subscriberCount || '0'),
        video_count: parseInt(statistics.videoCount || '0'),
        view_count: parseInt(statistics.viewCount || '0'),
        hidden_subscriber_count: statistics.hiddenSubscriberCount || false,

        // Thumbnails
        thumbnails: snippet.thumbnails || {},
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',

        // Playlists
        uploads_playlist_id: contentDetails.relatedPlaylists?.uploads || '',
        likes_playlist_id: contentDetails.relatedPlaylists?.likes || '',

        // Status
        privacy_status: status.privacyStatus || '',
        is_linked: status.isLinked || false,
        long_uploads_status: status.longUploadsStatus || '',
        made_for_kids: status.madeForKids || false,
        self_declared_made_for_kids: status.selfDeclaredMadeForKids || false,

        // Topics
        topic_categories: topicDetails.topicCategories || [],

        // Branding
        keywords: brandingSettings.channel?.keywords || '',
        tracking_analytics_account_id: brandingSettings.channel?.trackingAnalyticsAccountId || '',
        moderate_comments: brandingSettings.channel?.moderateComments || false,
        show_related_channels: brandingSettings.channel?.showRelatedChannels !== false,
        show_browse_view: brandingSettings.channel?.showBrowseView !== false,
        featured_channels_title: brandingSettings.channel?.featuredChannelsTitle || '',
        featured_channels_urls: brandingSettings.channel?.featuredChannelsUrls || [],
        unsubscribed_trailer: brandingSettings.channel?.unsubscribedTrailer || '',
        profile_color: brandingSettings.channel?.profileColor || '',

        // Localizations
        localized_title: snippet.localized?.title || snippet.title || '',
        localized_description: snippet.localized?.description || snippet.description || '',
        available_languages: Object.keys(localizations)
      };

    } catch (error) {
      logger.error(`Error getting channel statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent videos from a channel
   * @param {string} channelId - Channel ID (UCxxxxx) or username (@username)
   * @param {number} maxResults - Maximum number of videos to fetch (0 = all videos, default: 0)
   * @returns {Promise<Array>} - Array of videos with statistics
   */
  async getRecentVideos(channelId, maxResults = 0) {
    try {
      // Normalize channel identifier
      const originalIdentifier = channelId;
      channelId = await this.normalizeChannelIdentifier(channelId);

      if (!channelId) {
        logger.warn(`Failed to normalize channel identifier: ${originalIdentifier}`);
        throw new Error(
          `Channel not found: '${originalIdentifier}'. ` +
          `Please verify the channel exists on YouTube. ` +
          `Supported formats: channel ID (UCxxxxx), @username, or channel name.`
        );
      }

      // Get uploads playlist ID
      const channelStats = await this.getChannelStatistics(channelId);
      if (!channelStats) {
        return [];
      }

      const uploadsPlaylistId = channelStats.uploads_playlist_id;

      // Fetch all video IDs using pagination
      const allVideoIds = [];
      let nextPageToken = null;
      const perPageLimit = 50; // YouTube API max per request

      do {
        const requestParams = {
          part: 'snippet',
          playlistId: uploadsPlaylistId,
          maxResults: perPageLimit
        };

        if (nextPageToken) {
          requestParams.pageToken = nextPageToken;
        }

        const playlistResponse = await this.youtube.playlistItems.list(requestParams);

        const videoIds = playlistResponse.data.items.map(
          item => item.snippet.resourceId.videoId
        );

        allVideoIds.push(...videoIds);

        nextPageToken = playlistResponse.data.nextPageToken;

        // If maxResults is specified and we've collected enough, stop
        if (maxResults > 0 && allVideoIds.length >= maxResults) {
          allVideoIds.splice(maxResults); // Trim to exact maxResults
          break;
        }

        // Safety limit: stop if we've fetched more than 5000 videos
        // (to prevent infinite loops or excessive API usage)
        if (allVideoIds.length >= 5000) {
          logger.warn(`Reached safety limit of 5000 videos for channel ${channelId}`);
          break;
        }

      } while (nextPageToken);

      logger.info(`Fetched ${allVideoIds.length} video IDs for channel ${channelId}`);

      // Get detailed statistics for all videos
      const videos = await this.getVideosStatistics(allVideoIds);

      return videos;

    } catch (error) {
      logger.error(`Error getting recent videos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics for a list of videos
   * @param {Array<string>} videoIds - Array of video IDs
   * @returns {Promise<Array>} - Array of video statistics
   */
  async getVideosStatistics(videoIds) {
    try {
      if (!videoIds || videoIds.length === 0) {
        return [];
      }

      // YouTube API allows max 50 IDs per request
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < videoIds.length; i += batchSize) {
        batches.push(videoIds.slice(i, i + batchSize));
      }

      const allVideos = [];

      for (const batch of batches) {
        const response = await this.youtube.videos.list({
          part: 'snippet,statistics,contentDetails,status,topicDetails',
          id: batch.join(',')
        });

        for (const video of response.data.items || []) {
          const snippet = video.snippet || {};
          const statistics = video.statistics || {};
          const contentDetails = video.contentDetails || {};
          const status = video.status || {};
          const topicDetails = video.topicDetails || {};

          allVideos.push({
            video_id: video.id,
            title: snippet.title || '',
            description: snippet.description || '',
            channel_id: snippet.channelId || '',
            channel_title: snippet.channelTitle || '',
            published_at: snippet.publishedAt || '',
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            thumbnails: snippet.thumbnails || {},
            tags: snippet.tags || [],
            category_id: snippet.categoryId || '',
            default_language: snippet.defaultLanguage || '',
            default_audio_language: snippet.defaultAudioLanguage || '',
            live_broadcast_content: snippet.liveBroadcastContent || 'none',

            // Statistics
            view_count: parseInt(statistics.viewCount || '0'),
            like_count: parseInt(statistics.likeCount || '0'),
            comment_count: parseInt(statistics.commentCount || '0'),
            favorite_count: parseInt(statistics.favoriteCount || '0'),

            // Content details
            duration: contentDetails.duration || 'PT0S',
            dimension: contentDetails.dimension || '2d',
            definition: contentDetails.definition || 'sd',
            caption: contentDetails.caption || 'false',
            licensed_content: contentDetails.licensedContent || false,
            projection: contentDetails.projection || 'rectangular',

            // Status
            upload_status: status.uploadStatus || '',
            privacy_status: status.privacyStatus || '',
            license: status.license || '',
            embeddable: status.embeddable || false,
            public_stats_viewable: status.publicStatsViewable || false,
            made_for_kids: status.madeForKids || false,

            // Topics
            topic_categories: topicDetails.topicCategories || []
          });
        }
      }

      return allVideos;

    } catch (error) {
      logger.error(`Error getting videos statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze channel performance over a period
   * @param {string} channelId - Channel ID (UCxxxxx) or username (@username)
   * @param {number} days - Analysis period in days (0 = all time)
   * @returns {Promise<Object>} - Performance analysis object
   */
  async analyzeChannelPerformance(channelId, days = 30) {
    try {
      // Get channel statistics
      const channelStats = await this.getChannelStatistics(channelId);
      if (!channelStats) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // Get ALL videos from the channel (maxResults = 0 means fetch all)
      const allVideos = await this.getRecentVideos(channelId, 0);

      // Filter videos by date if days > 0
      let videosInPeriod = allVideos;
      if (days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        videosInPeriod = allVideos.filter(video => {
          const publishedDate = new Date(video.published_at);
          return publishedDate >= cutoffDate;
        });
      }

      // Calculate metrics
      const totalViews = videosInPeriod.reduce((sum, v) => sum + v.view_count, 0);
      const totalLikes = videosInPeriod.reduce((sum, v) => sum + v.like_count, 0);
      const totalComments = videosInPeriod.reduce((sum, v) => sum + v.comment_count, 0);

      const avgViewsPerVideo = videosInPeriod.length > 0
        ? totalViews / videosInPeriod.length
        : 0;

      const engagementRate = totalViews > 0
        ? ((totalLikes + totalComments) / totalViews) * 100
        : 0;

      // Get top videos sorted by views
      const topVideos = [...videosInPeriod]
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10)
        .map(v => ({
          video_id: v.video_id,
          title: v.title,
          views: v.view_count,
          likes: v.like_count,
          comments: v.comment_count,
          published_at: v.published_at
        }));

      return {
        channel_id: channelStats.channel_id,
        channel_title: channelStats.title,
        subscriber_count: channelStats.subscriber_count,
        total_videos: channelStats.video_count,
        analysis_period_days: days,
        videos_in_period: videosInPeriod.length,
        total_views: totalViews,
        total_likes: totalLikes,
        total_comments: totalComments,
        avg_views_per_video: Math.round(avgViewsPerVideo),
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        top_videos: topVideos
      };

    } catch (error) {
      logger.error(`Error analyzing channel performance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare multiple channels
   * @param {Array<string>} channelIds - Array of channel IDs or usernames
   * @param {number} days - Analysis period in days (0 = all time)
   * @returns {Promise<Object>} - Comparison results
   */
  async compareChannels(channelIds, days = 30) {
    try {
      if (!channelIds || channelIds.length === 0) {
        throw new Error('At least one channel ID required');
      }

      const allChannels = [];

      // Analyze each channel
      for (const channelId of channelIds) {
        try {
          const performance = await this.analyzeChannelPerformance(channelId, days);
          allChannels.push(performance);
        } catch (error) {
          logger.error(`Error analyzing channel ${channelId}: ${error.message}`);
          // Continue with other channels
        }
      }

      if (allChannels.length === 0) {
        throw new Error('No valid channels found');
      }

      // Sort rankings
      const byViews = [...allChannels]
        .sort((a, b) => b.total_views - a.total_views)
        .map(c => ({
          channel_title: c.channel_title,
          total_views: c.total_views
        }));

      const byEngagement = [...allChannels]
        .sort((a, b) => b.engagement_rate - a.engagement_rate)
        .map(c => ({
          channel_title: c.channel_title,
          engagement_rate: c.engagement_rate
        }));

      const byActivity = [...allChannels]
        .sort((a, b) => b.videos_in_period - a.videos_in_period)
        .map(c => ({
          channel_title: c.channel_title,
          videos_count: c.videos_in_period
        }));

      return {
        channels_analyzed: allChannels.length,
        period_days: days,
        all_channels: allChannels,
        rankings: {
          by_views: byViews,
          by_engagement: byEngagement,
          by_activity: byActivity
        }
      };

    } catch (error) {
      logger.error(`Error comparing channels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get comments for a specific video
   * @param {string} videoId - YouTube video ID
   * @param {number} maxResults - Maximum number of comments to retrieve (default: 100)
   * @param {string} order - Sort order: 'time' or 'relevance' (default: 'relevance')
   * @returns {Promise<Array>} - Array of comment objects
   */
  async getVideoComments(videoId, maxResults = 100, order = 'relevance') {
    try {
      if (!videoId) {
        throw new Error('Video ID is required');
      }

      logger.info(`Fetching comments for video: ${videoId}, maxResults: ${maxResults}, order: ${order}`);

      const comments = [];
      let pageToken = null;

      // Fetch comments (may need multiple pages)
      while (comments.length < maxResults) {
        const response = await this.youtube.commentThreads.list({
          part: 'snippet',
          videoId: videoId,
          maxResults: Math.min(100, maxResults - comments.length), // YouTube API max per request is 100
          order: order,
          pageToken: pageToken,
          textFormat: 'plainText'
        });

        if (!response.data.items || response.data.items.length === 0) {
          break; // No more comments
        }

        // Extract comment data
        for (const item of response.data.items) {
          const topComment = item.snippet.topLevelComment.snippet;
          comments.push({
            comment_id: item.id,
            text: topComment.textDisplay,
            author: topComment.authorDisplayName,
            author_channel_id: topComment.authorChannelId?.value || null,
            like_count: topComment.likeCount,
            published_at: topComment.publishedAt,
            updated_at: topComment.updatedAt,
            video_id: videoId
          });

          // Stop if we reached maxResults
          if (comments.length >= maxResults) {
            break;
          }
        }

        // Check if there are more pages
        pageToken = response.data.nextPageToken;
        if (!pageToken) {
          break; // No more pages
        }
      }

      logger.info(`Successfully fetched ${comments.length} comments for video ${videoId}`);
      return comments;

    } catch (error) {
      logger.error(`Error fetching video comments: ${error.message}`);

      // Check for specific YouTube API errors
      if (error.response?.data?.error?.code === 403) {
        throw new Error('Comments are disabled for this video or API quota exceeded');
      } else if (error.response?.data?.error?.code === 404) {
        throw new Error('Video not found');
      }

      throw error;
    }
  }

  /**
   * Get comments for multiple videos
   * @param {Array<string>} videoIds - Array of YouTube video IDs
   * @param {number} commentsPerVideo - Number of comments to fetch per video (default: 50)
   * @returns {Promise<Array>} - Array of all comments from all videos
   */
  async getMultipleVideosComments(videoIds, commentsPerVideo = 50) {
    try {
      if (!videoIds || videoIds.length === 0) {
        throw new Error('At least one video ID is required');
      }

      logger.info(`Fetching comments for ${videoIds.length} videos, ${commentsPerVideo} per video`);

      const allComments = [];

      for (const videoId of videoIds) {
        try {
          const comments = await this.getVideoComments(videoId, commentsPerVideo);
          allComments.push(...comments);
        } catch (error) {
          logger.warn(`Failed to fetch comments for video ${videoId}: ${error.message}`);
          // Continue with other videos
        }
      }

      logger.info(`Successfully fetched ${allComments.length} total comments from ${videoIds.length} videos`);
      return allComments;

    } catch (error) {
      logger.error(`Error fetching comments for multiple videos: ${error.message}`);
      throw error;
    }
  }
}

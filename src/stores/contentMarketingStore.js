/**
 * Content Marketing Agent Store
 * Manages state for content marketing operations
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { contentMarketingService } from '@/services/contentMarketingService'

export const useContentMarketingStore = defineStore('contentMarketing', () => {
  // State
  const articles = ref([])
  const trendingTopics = ref([])
  const competitorChannels = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const totalArticles = computed(() => articles.value.length)
  const publishedArticles = computed(() => articles.value.filter(a => a.status === 'published'))
  const draftArticles = computed(() => articles.value.filter(a => a.status === 'draft'))

  // Actions
  async function loadCompetitorChannels() {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.getCompetitorChannels()

      if (result.success) {
        competitorChannels.value = result.channels || []
        return result
      } else {
        throw new Error(result.error || 'Failed to load competitor channels')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addCompetitorChannel(channelData) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.addCompetitorChannel(channelData)

      if (result.success) {
        if (result.channel) {
          competitorChannels.value.push(result.channel)
        }
        return result
      } else {
        throw new Error(result.error || 'Failed to add competitor channel')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function removeCompetitorChannel(channelId) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.removeCompetitorChannel(channelId)

      if (result.success) {
        competitorChannels.value = competitorChannels.value.filter(c => c.id !== channelId)
        return result
      } else {
        throw new Error(result.error || 'Failed to remove competitor channel')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function parseChannel(channelId, botToken) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.parseChannel({
        channelId,
        botToken
      })

      if (result.success) {
        // Update channel in the store
        const channel = competitorChannels.value.find(c => c.id === channelId)
        if (channel) {
          channel.lastParsed = new Date().toISOString()
          channel.postsCount = result.postsCount || 0
        }

        return result
      } else {
        throw new Error(result.error || 'Failed to parse channel')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function parseAllChannels(botToken) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.parseAllChannels({
        botToken
      })

      if (result.success) {
        return result
      } else {
        throw new Error(result.error || 'Failed to parse all channels')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function analyzeTrendingTopics() {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.analyzeTrendingTopics()

      if (result.success) {
        trendingTopics.value = result.topics || []
        return result
      } else {
        throw new Error(result.error || 'Failed to analyze trending topics')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function generateArticle(topicId, modelId = null) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.generateArticle({
        topicId,
        modelId
      })

      if (result.success) {
        if (result.article) {
          articles.value.push(result.article)
        }
        return result
      } else {
        throw new Error(result.error || 'Failed to generate article')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function publishArticle(articleId, targetChannel) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.publishArticle({
        articleId,
        targetChannel
      })

      if (result.success) {
        // Update article in the store
        const article = articles.value.find(a => a.id === articleId)
        if (article) {
          article.status = 'published'
          article.publishedAt = new Date().toISOString()
        }

        return result
      } else {
        throw new Error(result.error || 'Failed to publish article')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function publishMultipleArticles(articleIds, targetChannel) {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.publishMultipleArticles({
        articleIds,
        targetChannel
      })

      if (result.success) {
        // Update articles in the store
        articleIds.forEach(articleId => {
          const article = articles.value.find(a => a.id === articleId)
          if (article) {
            article.status = 'published'
            article.publishedAt = new Date().toISOString()
          }
        })

        return result
      } else {
        throw new Error(result.error || 'Failed to publish articles')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadArticles() {
    loading.value = true
    error.value = null

    try {
      const result = await contentMarketingService.getArticles()

      if (result.success) {
        articles.value = result.articles || []
        return result
      } else {
        throw new Error(result.error || 'Failed to load articles')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    articles,
    trendingTopics,
    competitorChannels,
    loading,
    error,

    // Computed
    totalArticles,
    publishedArticles,
    draftArticles,

    // Actions
    loadCompetitorChannels,
    addCompetitorChannel,
    removeCompetitorChannel,
    parseChannel,
    parseAllChannels,
    analyzeTrendingTopics,
    generateArticle,
    publishArticle,
    publishMultipleArticles,
    loadArticles
  }
})

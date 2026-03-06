/**
 * useAgentMarketplace.js — Agent Marketplace with Ratings (AgentGPT pattern)
 *
 * Features:
 *   - Rate agents (1-5 stars)
 *   - Favorite agents
 *   - Write reviews
 *   - Agent leaderboard (by rating, usage, favorites)
 *   - Featured/trending agents detection
 *
 * Stored in localStorage. Can be synced to Integram later.
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

const RATINGS_KEY = 'agentRatings'
const FAVORITES_KEY = 'agentFavorites'
const REVIEWS_KEY = 'agentReviews'

// Singleton state
const ratings = ref({})     // { agentId: { sum, count, userRating } }
const favorites = ref([])   // [agentId, ...]
const reviews = ref([])     // [{ agentId, text, rating, timestamp, userId }]
let loaded = false

function load() {
  if (loaded) return
  try {
    const r = localStorage.getItem(RATINGS_KEY)
    ratings.value = r ? JSON.parse(r) : {}
    const f = localStorage.getItem(FAVORITES_KEY)
    favorites.value = f ? JSON.parse(f) : []
    const rv = localStorage.getItem(REVIEWS_KEY)
    reviews.value = rv ? JSON.parse(rv) : []
  } catch {
    ratings.value = {}
    favorites.value = []
    reviews.value = []
  }
  loaded = true
}

function save() {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings.value))
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.value))
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews.value))
  } catch { /* storage full */ }
}

export function useAgentMarketplace() {
  load()

  const favoriteAgentIds = computed(() => new Set(favorites.value))

  /**
   * Rate an agent (1-5)
   */
  function rateAgent(agentId, rating) {
    if (rating < 1 || rating > 5) return

    if (!ratings.value[agentId]) {
      ratings.value[agentId] = { sum: 0, count: 0, userRating: 0 }
    }

    const r = ratings.value[agentId]
    // Remove old user rating if exists
    if (r.userRating > 0) {
      r.sum -= r.userRating
      r.count--
    }
    r.userRating = rating
    r.sum += rating
    r.count++

    save()
    logger.info(`[AgentMarketplace] Rated ${agentId}: ${rating}/5`)
  }

  /**
   * Get average rating for an agent
   */
  function getAgentRating(agentId) {
    const r = ratings.value[agentId]
    if (!r || r.count === 0) return null
    return {
      average: Math.round((r.sum / r.count) * 10) / 10,
      count: r.count,
      userRating: r.userRating
    }
  }

  /**
   * Toggle favorite
   */
  function toggleFavorite(agentId) {
    const idx = favorites.value.indexOf(agentId)
    if (idx >= 0) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.push(agentId)
    }
    save()
  }

  function isFavorite(agentId) {
    return favorites.value.includes(agentId)
  }

  /**
   * Add a review
   */
  function addReview(agentId, text, rating = null) {
    const review = {
      id: `rv_${Date.now()}`,
      agentId,
      text,
      rating,
      timestamp: Date.now()
    }
    reviews.value.push(review)

    // Also set rating if provided
    if (rating) rateAgent(agentId, rating)

    save()
    logger.info(`[AgentMarketplace] Review added for ${agentId}`)
    return review
  }

  /**
   * Get reviews for an agent
   */
  function getAgentReviews(agentId) {
    return reviews.value
      .filter(r => r.agentId === agentId)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get leaderboard — top agents by rating
   * @param {Array} agents - full agent list from useAgentSelector
   * @param {string} sortBy - 'rating' | 'favorites' | 'reviews'
   * @param {number} limit
   */
  function getLeaderboard(agents, sortBy = 'rating', limit = 10) {
    const enriched = agents.map(agent => ({
      ...agent,
      rating: getAgentRating(agent.id),
      isFavorite: isFavorite(agent.id),
      reviewCount: reviews.value.filter(r => r.agentId === agent.id).length
    }))

    if (sortBy === 'rating') {
      enriched.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))
    } else if (sortBy === 'favorites') {
      enriched.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
    } else if (sortBy === 'reviews') {
      enriched.sort((a, b) => b.reviewCount - a.reviewCount)
    }

    return enriched.slice(0, limit)
  }

  /**
   * Get trending agents (recently rated/reviewed)
   */
  function getTrending(agents, limit = 5) {
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
    const recentReviews = reviews.value.filter(r => r.timestamp > recentCutoff)
    const activityCounts = {}
    for (const r of recentReviews) {
      activityCounts[r.agentId] = (activityCounts[r.agentId] || 0) + 1
    }

    return agents
      .filter(a => activityCounts[a.id])
      .sort((a, b) => (activityCounts[b.id] || 0) - (activityCounts[a.id] || 0))
      .slice(0, limit)
  }

  /**
   * Export marketplace data (for backup/sharing)
   */
  function exportData() {
    return JSON.stringify({
      ratings: ratings.value,
      favorites: favorites.value,
      reviews: reviews.value,
      exportedAt: Date.now()
    }, null, 2)
  }

  /**
   * Import marketplace data
   */
  function importData(json) {
    try {
      const data = JSON.parse(json)
      if (data.ratings) ratings.value = data.ratings
      if (data.favorites) favorites.value = data.favorites
      if (data.reviews) reviews.value = data.reviews
      save()
      return true
    } catch {
      return false
    }
  }

  return {
    ratings,
    favorites,
    reviews,
    favoriteAgentIds,
    rateAgent,
    getAgentRating,
    toggleFavorite,
    isFavorite,
    addReview,
    getAgentReviews,
    getLeaderboard,
    getTrending,
    exportData,
    importData
  }
}

/**
 * useBranding Composable
 *
 * Manages White Label branding configuration, CSS variables injection,
 * and custom domain detection.
 */

import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081'

// Shared state across all instances
const currentBranding = ref(null)
const isLoading = ref(false)
const error = ref(null)

export function useBranding() {
  /**
   * Get default branding
   */
  const getDefaultBranding = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/branding/default`)
      return response.data.branding
    } catch (err) {
      console.error('[useBranding] Error getting default branding:', err)
      return null
    }
  }

  /**
   * Get tenant branding by ID
   */
  const getTenantBranding = async (tenantId) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.get(`${API_BASE}/api/branding/tenant/${tenantId}`)
      currentBranding.value = response.data.branding
      return response.data.branding
    } catch (err) {
      error.value = err.message
      console.error('[useBranding] Error getting tenant branding:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get tenant branding by name
   */
  const getTenantBrandingByName = async (tenantName) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.get(`${API_BASE}/api/branding/tenant/by-name/${tenantName}`)
      currentBranding.value = response.data.branding
      return response.data.branding
    } catch (err) {
      error.value = err.message
      console.error('[useBranding] Error getting tenant branding by name:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create new tenant branding
   */
  const createTenantBranding = async (brandingData) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.post(`${API_BASE}/api/branding/tenant`, brandingData)
      currentBranding.value = response.data.branding
      return response.data.branding
    } catch (err) {
      error.value = err.message
      console.error('[useBranding] Error creating tenant branding:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update tenant branding
   */
  const updateTenantBranding = async (tenantId, brandingData) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.put(`${API_BASE}/api/branding/tenant/${tenantId}`, brandingData)
      currentBranding.value = response.data.branding
      return response.data.branding
    } catch (err) {
      error.value = err.message
      console.error('[useBranding] Error updating tenant branding:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete tenant branding
   */
  const deleteTenantBranding = async (tenantId) => {
    isLoading.value = true
    error.value = null

    try {
      await axios.delete(`${API_BASE}/api/branding/tenant/${tenantId}`)
      currentBranding.value = null
      return true
    } catch (err) {
      error.value = err.message
      console.error('[useBranding] Error deleting tenant branding:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Apply branding to current page
   */
  const applyBranding = (branding) => {
    if (!branding) return

    // Apply CSS variables
    const root = document.documentElement

    if (branding.primaryColor) {
      root.style.setProperty('--primary-color', branding.primaryColor)
    }

    if (branding.secondaryColor) {
      root.style.setProperty('--secondary-color', branding.secondaryColor)
    }

    if (branding.accentColor) {
      root.style.setProperty('--accent-color', branding.accentColor)
    }

    if (branding.backgroundColor) {
      root.style.setProperty('--background-color', branding.backgroundColor)
    }

    // Apply custom CSS variables
    if (branding.cssVariables && typeof branding.cssVariables === 'object') {
      Object.entries(branding.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value)
      })
    }

    // Apply custom font
    if (branding.font) {
      // Load Google Font if needed
      if (!document.getElementById('custom-branding-font')) {
        const link = document.createElement('link')
        link.id = 'custom-branding-font'
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${branding.font.replace(' ', '+')}&display=swap`
        document.head.appendChild(link)
      }

      root.style.setProperty('--font-family', `"${branding.font}", sans-serif`)
    }

    // Update favicon
    if (branding.faviconUrl) {
      let favicon = document.querySelector('link[rel="icon"]')
      if (!favicon) {
        favicon = document.createElement('link')
        favicon.rel = 'icon'
        document.head.appendChild(favicon)
      }
      favicon.href = branding.faviconUrl
    }

    // Update page title
    if (branding.appName) {
      document.title = branding.appName
    }

    currentBranding.value = branding
  }

  /**
   * Reset branding to default
   */
  const resetBranding = async () => {
    const defaultBranding = await getDefaultBranding()
    if (defaultBranding) {
      applyBranding(defaultBranding)
    }
  }

  /**
   * Get custom domains for tenant
   */
  const getCustomDomains = async (tenantId) => {
    try {
      const response = await axios.get(`${API_BASE}/api/branding/domains/${tenantId}`)
      return response.data.domains
    } catch (err) {
      console.error('[useBranding] Error getting custom domains:', err)
      return []
    }
  }

  /**
   * Create custom domain
   */
  const createCustomDomain = async (domainData) => {
    try {
      const response = await axios.post(`${API_BASE}/api/branding/domain`, domainData)
      return response.data.domain
    } catch (err) {
      console.error('[useBranding] Error creating custom domain:', err)
      throw err
    }
  }

  /**
   * Verify DNS for custom domain
   */
  const verifyDomainDNS = async (domainId) => {
    try {
      const response = await axios.post(`${API_BASE}/api/branding/domain/${domainId}/verify`)
      return response.data.verified
    } catch (err) {
      console.error('[useBranding] Error verifying domain:', err)
      throw err
    }
  }

  /**
   * Activate custom domain
   */
  const activateDomain = async (domainId) => {
    try {
      const response = await axios.post(`${API_BASE}/api/branding/domain/${domainId}/activate`)
      return response.data.activated
    } catch (err) {
      console.error('[useBranding] Error activating domain:', err)
      throw err
    }
  }

  /**
   * Get branding assets for tenant
   */
  const getBrandingAssets = async (tenantId, assetType = null) => {
    try {
      const params = assetType ? { type: assetType } : {}
      const response = await axios.get(`${API_BASE}/api/branding/assets/${tenantId}`, { params })
      return response.data.assets
    } catch (err) {
      console.error('[useBranding] Error getting branding assets:', err)
      return []
    }
  }

  /**
   * Upload branding asset
   */
  const uploadAsset = async (assetData) => {
    try {
      const response = await axios.post(`${API_BASE}/api/branding/asset`, assetData)
      return response.data.asset
    } catch (err) {
      console.error('[useBranding] Error uploading asset:', err)
      throw err
    }
  }

  /**
   * Detect tenant from current domain
   */
  const detectTenantFromDomain = () => {
    const hostname = window.location.hostname

    // Skip localhost and known default domains
    if (hostname === 'localhost' || hostname.includes('drondoc.ru') || hostname.includes('dev.drondoc.ru')) {
      return null
    }

    // Extract tenant identifier from custom domain
    // Example: agents.company.com -> company
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return parts[parts.length - 2] // Second-level domain
    }

    return null
  }

  /**
   * Auto-load branding based on current domain
   */
  const autoLoadBranding = async () => {
    const tenantName = detectTenantFromDomain()

    if (tenantName) {
      const branding = await getTenantBrandingByName(tenantName)
      if (branding && branding.active) {
        applyBranding(branding)
        return branding
      }
    }

    // Fallback to default branding
    const defaultBranding = await getDefaultBranding()
    if (defaultBranding) {
      applyBranding(defaultBranding)
    }

    return defaultBranding
  }

  // Computed properties
  const hasCustomBranding = computed(() => {
    return currentBranding.value && currentBranding.value.name !== 'DronDoc Default'
  })

  const brandingColors = computed(() => {
    if (!currentBranding.value) return {}

    return {
      primary: currentBranding.value.primaryColor,
      secondary: currentBranding.value.secondaryColor,
      accent: currentBranding.value.accentColor,
      background: currentBranding.value.backgroundColor
    }
  })

  // Watch for branding changes and apply them
  watch(currentBranding, (newBranding) => {
    if (newBranding) {
      applyBranding(newBranding)
    }
  }, { deep: true })

  return {
    // State
    currentBranding,
    isLoading,
    error,
    hasCustomBranding,
    brandingColors,

    // Methods - Tenant
    getDefaultBranding,
    getTenantBranding,
    getTenantBrandingByName,
    createTenantBranding,
    updateTenantBranding,
    deleteTenantBranding,

    // Methods - Application
    applyBranding,
    resetBranding,
    autoLoadBranding,
    detectTenantFromDomain,

    // Methods - Domains
    getCustomDomains,
    createCustomDomain,
    verifyDomainDNS,
    activateDomain,

    // Methods - Assets
    getBrandingAssets,
    uploadAsset
  }
}

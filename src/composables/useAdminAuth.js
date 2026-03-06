import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import apiClient from '@/axios2'

// Admin roles
export const AdminRole = {
  SUPER_ADMIN: 'super_admin',
  SUPPORT: 'support',
  FINANCE: 'finance',
  CONTENT_MANAGER: 'content_manager'
}

// Global state
const adminUser = ref(null)
const adminRole = ref(null)
const isAdminAuthenticated = ref(false)
const adminToken = ref(null)

export function useAdminAuth() {
  const router = useRouter()

  // Check if user has admin access
  const checkAdminAccess = async () => {
    try {
      const storedToken = sessionStorage.getItem('admin_token')
      const storedUser = sessionStorage.getItem('admin_user')
      const storedRole = sessionStorage.getItem('admin_role')

      if (storedToken && storedUser && storedRole) {
        adminToken.value = storedToken
        adminUser.value = JSON.parse(storedUser)
        adminRole.value = storedRole
        isAdminAuthenticated.value = true
        return true
      }

      // Verify with backend
      const response = await apiClient.get('/admin/verify')
      if (response.data?.isAdmin) {
        adminUser.value = response.data.user
        adminRole.value = response.data.role
        isAdminAuthenticated.value = true
        adminToken.value = response.data.token

        // Store in session
        sessionStorage.setItem('admin_token', response.data.token)
        sessionStorage.setItem('admin_user', JSON.stringify(response.data.user))
        sessionStorage.setItem('admin_role', response.data.role)
        return true
      }
      return false
    } catch (error) {
      console.error('Admin access check failed:', error)
      return false
    }
  }

  // Login as admin
  const loginAdmin = async (email, password, totpCode) => {
    try {
      const response = await apiClient.post('/admin/login', {
        email,
        password,
        totp_code: totpCode
      })

      if (response.data?.success) {
        adminUser.value = response.data.user
        adminRole.value = response.data.role
        adminToken.value = response.data.token
        isAdminAuthenticated.value = true

        // Store in session
        sessionStorage.setItem('admin_token', response.data.token)
        sessionStorage.setItem('admin_user', JSON.stringify(response.data.user))
        sessionStorage.setItem('admin_role', response.data.role)

        return { success: true }
      }
      return { success: false, error: response.data?.error || 'Login failed' }
    } catch (error) {
      console.error('Admin login failed:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      }
    }
  }

  // Logout admin
  const logout = () => {
    adminUser.value = null
    adminRole.value = null
    adminToken.value = null
    isAdminAuthenticated.value = false

    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_user')
    sessionStorage.removeItem('admin_role')
  }

  // Check if admin has permission for specific roles
  const hasPermission = (allowedRoles) => {
    if (!adminRole.value) return false
    if (adminRole.value === AdminRole.SUPER_ADMIN) return true
    return allowedRoles.includes(adminRole.value)
  }

  // Check if super admin
  const isSuperAdmin = computed(() => adminRole.value === AdminRole.SUPER_ADMIN)

  // Impersonate user (for support)
  const impersonateUser = async (userId) => {
    if (!hasPermission([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT])) {
      throw new Error('Permission denied')
    }

    try {
      const response = await apiClient.post('/admin/impersonate', {
        user_id: userId
      })

      if (response.data?.success) {
        // Store impersonation data
        sessionStorage.setItem('impersonating_user_id', userId)
        sessionStorage.setItem('impersonating_user', JSON.stringify(response.data.user))
        return { success: true, user: response.data.user }
      }
      return { success: false, error: 'Impersonation failed' }
    } catch (error) {
      console.error('Impersonation failed:', error)
      throw error
    }
  }

  // Stop impersonation
  const stopImpersonation = () => {
    sessionStorage.removeItem('impersonating_user_id')
    sessionStorage.removeItem('impersonating_user')
  }

  // Check if currently impersonating
  const isImpersonating = computed(() => {
    return !!sessionStorage.getItem('impersonating_user_id')
  })

  return {
    adminUser,
    adminRole,
    adminToken,
    isAdminAuthenticated,
    isSuperAdmin,
    isImpersonating,
    checkAdminAccess,
    loginAdmin,
    logout,
    hasPermission,
    impersonateUser,
    stopImpersonation,
    AdminRole
  }
}

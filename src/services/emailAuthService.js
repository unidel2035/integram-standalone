/**
 * Email Authentication Service
 *
 * Frontend service for email-based user registration and authentication.
 * Communicates with backend email-auth API.
 *
 * @module emailAuthService
 */

import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl();

/**
 * Register user with email verification
 * Sends verification email instead of creating user directly
 *
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.username - Username (optional)
 * @param {string} userData.displayName - Display name (optional)
 * @returns {Promise<Object>} Registration result
 */
export async function registerWithEmail(userData) {
  const response = await fetch(`${API_BASE_URL}/email-auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  return data;
}

/**
 * Register user directly without email verification (for development/testing)
 *
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.username - Username (optional)
 * @param {string} userData.displayName - Display name (optional)
 * @returns {Promise<Object>} Registration result
 */
export async function registerDirectly(userData) {
  const response = await fetch(`${API_BASE_URL}/email-auth/register-direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  return data;
}

/**
 * Verify email with token
 *
 * @param {string} token - Verification token from email
 * @param {Array<string>} databases - Databases to sync user to (optional)
 * @returns {Promise<Object>} Verification result with user info
 */
export async function verifyEmail(token, databases = null) {
  const body = { token };
  if (databases) {
    body.databases = databases;
  }

  const response = await fetch(`${API_BASE_URL}/email-auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Email verification failed');
  }

  return data;
}

/**
 * Resend verification email
 *
 * @param {Object} userData - User registration data (same as original registration)
 * @returns {Promise<Object>} Resend result
 */
export async function resendVerification(userData) {
  const response = await fetch(`${API_BASE_URL}/email-auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to resend verification email');
  }

  return data;
}

/**
 * Request password reset
 *
 * @param {string} email - User email
 * @returns {Promise<Object>} Request result
 */
export async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE_URL}/email-auth/password-reset-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to request password reset');
  }

  return data;
}

/**
 * Reset password with token
 *
 * @param {string} token - Password reset token from email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Reset result
 */
export async function resetPassword(token, newPassword) {
  const response = await fetch(`${API_BASE_URL}/email-auth/password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token, newPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset password');
  }

  return data;
}

/**
 * Verify password reset token (without resetting)
 *
 * @param {string} token - Password reset token
 * @returns {Promise<Object>} Token validation result
 */
export async function verifyResetToken(token) {
  const response = await fetch(`${API_BASE_URL}/email-auth/verify-reset-token?token=${encodeURIComponent(token)}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Invalid or expired token');
  }

  return data;
}

/**
 * Request magic link for passwordless login
 *
 * @param {string} email - User email
 * @returns {Promise<Object>} Request result
 */
export async function requestMagicLink(email) {
  const response = await fetch(`${API_BASE_URL}/email-auth/magic-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to request magic link');
  }

  return data;
}

/**
 * Login with magic link token
 *
 * @param {string} token - Magic link token from email
 * @returns {Promise<Object>} Login result with user info
 */
export async function loginWithMagicLink(token) {
  const response = await fetch(`${API_BASE_URL}/email-auth/magic-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Magic link login failed');
  }

  return data;
}

/**
 * Check health of email auth service
 *
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/email-auth/health`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return data;
}

export default {
  registerWithEmail,
  registerDirectly,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
  requestMagicLink,
  loginWithMagicLink,
  checkHealth
};

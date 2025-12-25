/**
 * Unified Auth Service
 *
 * Provides unified authentication across different auth methods
 */

import axios from 'axios';

export async function login(credentials) {
  const response = await axios.post('/api/auth/login', credentials);
  return response.data;
}

export async function logout() {
  const response = await axios.post('/api/auth/logout');
  return response.data;
}

export async function verifyToken(token) {
  const response = await axios.post('/api/auth/verify', { token });
  return response.data;
}

export const unifiedAuthService = {
  login,
  logout,
  verifyToken
};

export default unifiedAuthService;

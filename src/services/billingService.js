/**
 * Billing Service — frontend API client for ai2fund billing
 */

const API = '/api/billing'

export async function fetchPlans() {
  const res = await fetch(`${API}/plans`)
  const data = await res.json()
  return data.plans || []
}

export async function fetchSubscription(userId) {
  const res = await fetch(`${API}/subscription/${userId}`)
  const data = await res.json()
  return data.subscription
}

export async function subscribe(userId, planCode) {
  const res = await fetch(`${API}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, planCode }),
  })
  return res.json()
}

export async function cancelSubscription(userId) {
  const res = await fetch(`${API}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return res.json()
}

export async function fetchUsageStats(userId) {
  const res = await fetch(`${API}/usage/${userId}`)
  return res.json()
}

export async function fetchUsageHistory(userId, limit = 50) {
  const res = await fetch(`${API}/usage/${userId}/history?limit=${limit}`)
  const data = await res.json()
  return data.history || []
}

export async function fetchQuota(userId) {
  const res = await fetch(`${API}/quota/${userId}`)
  return res.json()
}

export async function fetchBalance(userId) {
  const res = await fetch(`${API}/balance/${userId}`)
  const data = await res.json()
  return data.balance
}

export async function fetchTransactions(userId, limit = 50) {
  const res = await fetch(`${API}/balance/${userId}/transactions?limit=${limit}`)
  const data = await res.json()
  return data.transactions || []
}

export async function depositTokens(userId, amount, description) {
  const res = await fetch(`${API}/balance/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, description }),
  })
  return res.json()
}

export default {
  fetchPlans, fetchSubscription, subscribe, cancelSubscription,
  fetchUsageStats, fetchUsageHistory, fetchQuota,
  fetchBalance, fetchTransactions, depositTokens,
}

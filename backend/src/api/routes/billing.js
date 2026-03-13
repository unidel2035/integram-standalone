/**
 * Billing Routes
 *
 * GET  /api/billing/plans              — все тарифные планы
 * GET  /api/billing/subscription/:uid  — подписка пользователя
 * POST /api/billing/subscribe          — подписать / сменить тариф
 * POST /api/billing/cancel             — отменить подписку
 * GET  /api/billing/usage/:uid         — агрегированная статистика
 * GET  /api/billing/usage/:uid/history — история вызовов
 * GET  /api/billing/quota/:uid         — проверка квоты
 * GET  /api/billing/balance/:uid       — баланс токенов
 * GET  /api/billing/balance/:uid/transactions — история транзакций
 * POST /api/billing/balance/deposit    — пополнение баланса (admin)
 */

import { Router } from 'express'
import {
  getPlans,
  getSubscription,
  createSubscription,
  updateSubscription,
  getUsageStats,
  getUsageHistory,
  checkQuota,
  ensureBalance,
  depositTokens,
  getTransactionHistory,
} from '../../services/billingService.js'

const router = Router()

// ── Plans ────────────────────────────────────────────────────────────────────────

router.get('/billing/plans', async (req, res) => {
  try {
    const plans = await getPlans()
    res.json({ success: true, plans })
  } catch (err) {
    console.error('[Billing] plans error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Subscription ────────────────────────────────────────────────────────────────

router.get('/billing/subscription/:userId', async (req, res) => {
  try {
    const sub = await getSubscription(req.params.userId)
    res.json({ success: true, subscription: sub })
  } catch (err) {
    console.error('[Billing] subscription error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/billing/subscribe', async (req, res) => {
  const { userId, planCode } = req.body
  if (!userId || !planCode) return res.status(400).json({ success: false, error: 'userId и planCode обязательны' })
  try {
    const existing = await getSubscription(userId)
    if (existing) {
      await updateSubscription(existing.id, { planCode, status: 'active', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() })
      res.json({ success: true, action: 'upgraded', subscriptionId: existing.id })
    } else {
      const id = await createSubscription(userId, planCode)
      res.json({ success: true, action: 'created', subscriptionId: id })
    }
  } catch (err) {
    console.error('[Billing] subscribe error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/billing/cancel', async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ success: false, error: 'userId обязателен' })
  try {
    const sub = await getSubscription(userId)
    if (!sub) return res.status(404).json({ success: false, error: 'Подписка не найдена' })
    await updateSubscription(sub.id, { status: 'cancelled' })
    res.json({ success: true })
  } catch (err) {
    console.error('[Billing] cancel error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Usage ────────────────────────────────────────────────────────────────────────

router.get('/billing/usage/:userId', async (req, res) => {
  try {
    const stats = await getUsageStats(req.params.userId)
    res.json({ success: true, ...stats })
  } catch (err) {
    console.error('[Billing] usage error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/billing/usage/:userId/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const history = await getUsageHistory(req.params.userId, limit)
    res.json({ success: true, history })
  } catch (err) {
    console.error('[Billing] usage history error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Quota ────────────────────────────────────────────────────────────────────────

router.get('/billing/quota/:userId', async (req, res) => {
  try {
    const quota = await checkQuota(req.params.userId)
    res.json({ success: true, ...quota })
  } catch (err) {
    console.error('[Billing] quota error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Token Balance ───────────────────────────────────────────────────────────────

router.get('/billing/balance/:userId', async (req, res) => {
  try {
    const bal = await ensureBalance(req.params.userId)
    res.json({ success: true, balance: bal })
  } catch (err) {
    console.error('[Billing] balance error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/billing/balance/:userId/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const transactions = await getTransactionHistory(req.params.userId, limit)
    res.json({ success: true, transactions })
  } catch (err) {
    console.error('[Billing] transactions error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/billing/balance/deposit', async (req, res) => {
  const { userId, amount, description } = req.body
  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ success: false, error: 'userId и amount (>0) обязательны' })
  }
  try {
    const result = await depositTokens(userId, amount, description)
    res.json({ success: true, newBalance: result.newBalance })
  } catch (err) {
    console.error('[Billing] deposit error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router

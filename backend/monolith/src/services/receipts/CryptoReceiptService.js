/**
 * CryptoReceiptService — Cryptographically Signed Action Receipts
 *
 * Deloitte Tech Trends 2026: "Digital identity systems, cryptographic
 * transaction receipts, immutable action logs" for agent governance.
 *
 * Every agent action gets an HMAC-SHA256 signed receipt chained
 * to the previous receipt (hash chain), creating an immutable,
 * verifiable audit trail.
 *
 * Features:
 * - HMAC-SHA256 signed receipts
 * - Hash chain (each receipt references previous)
 * - Receipt verification
 * - Tamper detection across the chain
 * - Query by agent, action, time range
 */

import { createHmac, randomUUID } from 'crypto';
import logger from '../../utils/logger.js';

// ─── Receipt ─────────────────────────────────────────────────────────────────

/**
 * Build canonical string for signing
 */
function canonicalize(receipt) {
  return [
    receipt.id,
    receipt.agentId,
    receipt.action,
    receipt.targetId || '',
    receipt.timestamp,
    receipt.previousHash || 'GENESIS',
    JSON.stringify(receipt.details || {}),
  ].join('|');
}

/**
 * Compute HMAC-SHA256 signature
 */
function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class CryptoReceiptService {
  constructor(options = {}) {
    this.secret = options.secret || process.env.RECEIPT_SECRET || process.env.JWT_SECRET || 'integram-receipt-key-change-me';
    this.maxReceipts = options.maxReceipts || 100000;
    this.receipts = [];          // ordered list
    this.receiptIndex = new Map(); // id → index
    this.agentIndex = new Map();   // agentId → [indices]
    this.lastHash = null;
    logger.info('[CryptoReceipt] Service initialized');
  }

  /**
   * Issue a new signed receipt
   */
  issueReceipt({ agentId, action, targetId = null, details = {}, meta = {} }) {
    if (this.receipts.length >= this.maxReceipts) {
      this._compact();
    }

    const receipt = {
      id: randomUUID(),
      agentId,
      action,
      targetId,
      details,
      meta,
      timestamp: new Date().toISOString(),
      previousHash: this.lastHash || 'GENESIS',
      sequenceNumber: this.receipts.length,
    };

    // Sign
    const canonical = canonicalize(receipt);
    receipt.signature = sign(canonical, this.secret);
    receipt.hash = sign(receipt.signature + receipt.previousHash, this.secret);

    // Store
    const idx = this.receipts.length;
    this.receipts.push(receipt);
    this.receiptIndex.set(receipt.id, idx);

    if (!this.agentIndex.has(agentId)) this.agentIndex.set(agentId, []);
    this.agentIndex.get(agentId).push(idx);

    this.lastHash = receipt.hash;

    this.onReceipt?.(receipt);

    logger.debug({ receiptId: receipt.id, agentId, action }, '[CryptoReceipt] Issued');
    return receipt;
  }

  /**
   * Verify a single receipt's signature
   */
  verifyReceipt(receiptId) {
    const idx = this.receiptIndex.get(receiptId);
    if (idx === undefined) return { valid: false, error: 'Receipt not found' };
    const receipt = this.receipts[idx];

    // Verify signature
    const canonical = canonicalize(receipt);
    const expectedSig = sign(canonical, this.secret);
    if (receipt.signature !== expectedSig) {
      return { valid: false, error: 'Signature mismatch — receipt tampered', receiptId };
    }

    // Verify hash chain
    const expectedHash = sign(receipt.signature + receipt.previousHash, this.secret);
    if (receipt.hash !== expectedHash) {
      return { valid: false, error: 'Hash mismatch — chain broken', receiptId };
    }

    // Verify previous hash link
    if (idx > 0) {
      const prev = this.receipts[idx - 1];
      if (receipt.previousHash !== prev.hash) {
        return { valid: false, error: 'Previous hash mismatch — chain tampered', receiptId };
      }
    } else if (receipt.previousHash !== 'GENESIS') {
      return { valid: false, error: 'First receipt should reference GENESIS', receiptId };
    }

    return { valid: true, receiptId, sequenceNumber: receipt.sequenceNumber };
  }

  /**
   * Verify entire chain integrity
   */
  verifyChain({ fromIndex = 0, toIndex } = {}) {
    const end = toIndex ?? this.receipts.length;
    const results = { valid: true, checked: 0, errors: [] };

    for (let i = fromIndex; i < end; i++) {
      const receipt = this.receipts[i];
      const canonical = canonicalize(receipt);
      const expectedSig = sign(canonical, this.secret);

      if (receipt.signature !== expectedSig) {
        results.valid = false;
        results.errors.push({ index: i, receiptId: receipt.id, error: 'Signature mismatch' });
        continue;
      }

      if (i > 0) {
        const prev = this.receipts[i - 1];
        if (receipt.previousHash !== prev.hash) {
          results.valid = false;
          results.errors.push({ index: i, receiptId: receipt.id, error: 'Chain link broken' });
        }
      }
      results.checked++;
    }

    return results;
  }

  /**
   * Get receipt by ID
   */
  getReceipt(receiptId) {
    const idx = this.receiptIndex.get(receiptId);
    return idx !== undefined ? this.receipts[idx] : null;
  }

  /**
   * Query receipts
   */
  query({ agentId, action, targetId, from, to, limit = 100, offset = 0 } = {}) {
    let results;

    if (agentId && this.agentIndex.has(agentId)) {
      results = this.agentIndex.get(agentId).map(i => this.receipts[i]);
    } else {
      results = [...this.receipts];
    }

    if (action) results = results.filter(r => r.action === action);
    if (targetId) results = results.filter(r => r.targetId === targetId);
    if (from) results = results.filter(r => r.timestamp >= from);
    if (to) results = results.filter(r => r.timestamp <= to);

    const total = results.length;
    results = results.slice(offset, offset + limit);

    return { results, total, offset, limit };
  }

  /**
   * Get receipts for a specific agent
   */
  getAgentReceipts(agentId, { limit = 50 } = {}) {
    const indices = this.agentIndex.get(agentId) || [];
    return indices.slice(-limit).map(i => this.receipts[i]);
  }

  /**
   * Stats
   */
  getStats() {
    const actionCounts = {};
    const agentCounts = {};
    for (const r of this.receipts) {
      actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
      agentCounts[r.agentId] = (agentCounts[r.agentId] || 0) + 1;
    }

    return {
      total: this.receipts.length,
      lastHash: this.lastHash,
      chainIntact: this.receipts.length < 1000 ? this.verifyChain().valid : 'skipped (>1000, use verifyChain)',
      byAction: actionCounts,
      byAgent: agentCounts,
    };
  }

  /**
   * Export receipts for external audit
   */
  exportChain({ from = 0, to } = {}) {
    const end = to ?? this.receipts.length;
    return {
      exported: new Date().toISOString(),
      chainStart: from,
      chainEnd: end,
      receipts: this.receipts.slice(from, end),
      verification: this.verifyChain({ fromIndex: from, toIndex: end }),
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _compact() {
    // Keep last 75% of receipts
    const keep = Math.floor(this.maxReceipts * 0.75);
    const removed = this.receipts.length - keep;
    this.receipts = this.receipts.slice(removed);

    // Rebuild indices
    this.receiptIndex.clear();
    this.agentIndex.clear();
    this.receipts.forEach((r, i) => {
      this.receiptIndex.set(r.id, i);
      if (!this.agentIndex.has(r.agentId)) this.agentIndex.set(r.agentId, []);
      this.agentIndex.get(r.agentId).push(i);
    });

    logger.info({ removed, remaining: this.receipts.length }, '[CryptoReceipt] Compacted');
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance = null;
export function getCryptoReceiptService(options) {
  if (!_instance) _instance = new CryptoReceiptService(options);
  return _instance;
}

export default CryptoReceiptService;

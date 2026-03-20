/**
 * Reciprocity Graph — tracks mutual value exchanges between stakeholders
 *
 * In a causal graph: A causes B (mechanism, necessity)
 * In a reciprocity graph: B acknowledges A (freedom, response)
 *
 * The difference: causality compels, reciprocity chooses.
 */

export class GratitudeGraph {
  constructor() {
    // adjacency: acknowledgerId → [{ acknowledgedId, exchangeId, timestamp }]
    this._edges = new Map();
    this._edgeCount = 0;
    this._forgotten = []; // Decayed edges — still exist but don't count in density
    this._halfLife = 30 * 24 * 3600 * 1000; // 30 days in ms
    this._lambda = Math.LN2 / this._halfLife; // lambda = ln(2) / halfLife
    this._decayThreshold = 0.05; // Weight below this -> forgotten
  }

  /**
   * Record reciprocity: receiver acknowledges giver through a specific value exchange.
   */
  addGratitude(acknowledgerId, acknowledgedId, exchangeId) {
    if (!this._edges.has(acknowledgerId)) {
      this._edges.set(acknowledgerId, []);
    }
    // Deduplication: one reciprocity link per exchange
    const edges = this._edges.get(acknowledgerId);
    if (edges.some(e => e.thankedId === acknowledgedId && e.giftId === exchangeId)) return;
    edges.push({
      thankedId: acknowledgedId,
      giftId: exchangeId,
      timestamp: new Date().toISOString(),
    });
    this._edgeCount++;
  }

  /**
   * Who has this stakeholder acknowledged?
   */
  getThanked(stakeholderId) {
    return (this._edges.get(stakeholderId) || []).map(e => ({
      person: e.thankedId,
      gift: e.giftId,
      when: e.timestamp,
    }));
  }

  /**
   * Who has acknowledged this stakeholder?
   */
  getThankers(stakeholderId) {
    const result = [];
    for (const [acknowledgerId, edges] of this._edges) {
      for (const e of edges) {
        if (e.thankedId === stakeholderId) {
          result.push({ person: acknowledgerId, gift: e.giftId, when: e.timestamp });
        }
      }
    }
    return result;
  }

  /**
   * Find path of reciprocity between two stakeholders. BFS.
   */
  findPath(fromId, toId) {
    if (fromId === toId) return [fromId];
    const visited = new Set();
    const queue = [[fromId]];
    visited.add(fromId);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      const neighbors = this._edges.get(current) || [];

      for (const edge of neighbors) {
        if (edge.thankedId === toId) {
          return [...path, toId];
        }
        if (!visited.has(edge.thankedId)) {
          visited.add(edge.thankedId);
          queue.push([...path, edge.thankedId]);
        }
      }
    }
    return null;
  }

  /**
   * Reciprocity density: how interconnected is the stakeholder network?
   * 1.0 = everyone has acknowledged everyone
   */
  density() {
    const stakeholders = new Set();
    for (const [id, edges] of this._edges) {
      stakeholders.add(id);
      for (const e of edges) stakeholders.add(e.thankedId);
    }
    // Exclude system/fund source (id='0')
    stakeholders.delete('0');
    const n = stakeholders.size;
    if (n < 2) return 0;
    const maxEdges = n * (n - 1);
    let activeEdges = 0;
    for (const [id, edges] of this._edges) {
      if (id === '0') continue;
      for (const e of edges) {
        if (e.thankedId !== '0') activeEdges++;
      }
    }
    return Math.round(activeEdges / maxEdges * 1000) / 1000;
  }

  /**
   * Find cycles in the reciprocity graph (Mutual Value Cycles).
   * A->B->C->A = mutual value exchange cycle.
   */
  findCycles(maxLength = 5) {
    const cycles = [];
    const allNodes = [...this._edges.keys()];
    const MAX_CYCLES = 50;

    for (const startNode of allNodes) {
      if (cycles.length >= MAX_CYCLES) break;

      const stack = [{ node: startNode, path: [startNode], visited: new Set([startNode]) }];

      while (stack.length > 0 && cycles.length < MAX_CYCLES) {
        const { node, path, visited } = stack.pop();
        const neighbors = this._edges.get(node) || [];

        for (const edge of neighbors) {
          if (edge.thankedId === startNode && path.length >= 2) {
            const cycle = [...path];
            const minIdx = cycle.indexOf(cycle.reduce((a, b) => a < b ? a : b));
            const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
            const key = normalized.join('->');

            if (!cycles.find(c => c.key === key)) {
              cycles.push({
                key,
                path: normalized,
                length: normalized.length,
              });
            }
          } else if (!visited.has(edge.thankedId) && path.length < maxLength) {
            const newVisited = new Set(visited);
            newVisited.add(edge.thankedId);
            stack.push({
              node: edge.thankedId,
              path: [...path, edge.thankedId],
              visited: newVisited,
            });
          }
        }
      }
    }

    return cycles;
  }

  /**
   * Get mutual pairs: A<->B (both exchanged value with each other).
   */
  getMutualPairs() {
    const pairs = [];
    const seen = new Set();

    for (const [acknowledgerId, edges] of this._edges) {
      for (const edge of edges) {
        const reverse = (this._edges.get(edge.thankedId) || [])
          .find(e => e.thankedId === acknowledgerId);

        if (reverse) {
          const key = [acknowledgerId, edge.thankedId].sort().join('<->');
          if (!seen.has(key)) {
            seen.add(key);
            const forwardCount = edges.filter(e => e.thankedId === edge.thankedId).length;
            const reverseCount = (this._edges.get(edge.thankedId) || [])
              .filter(e => e.thankedId === acknowledgerId).length;

            pairs.push({
              persons: [acknowledgerId, edge.thankedId],
              forwardGifts: forwardCount,
              reverseGifts: reverseCount,
              depth: forwardCount + reverseCount,
            });
          }
        }
      }
    }

    return pairs.sort((a, b) => b.depth - a.depth);
  }

  /**
   * All edges as list
   */
  allEdges() {
    const result = [];
    for (const [acknowledgerId, edges] of this._edges) {
      for (const e of edges) {
        result.push({ from: acknowledgerId, to: e.thankedId, gift: e.giftId, when: e.timestamp });
      }
    }
    return result;
  }

  // ===================================================================
  // DECAY — reciprocity fades if not renewed
  // Weight = e^(-lambda*t) where lambda = ln(2)/30days
  // ===================================================================

  /**
   * Calculate weight of an edge based on age.
   */
  _edgeWeight(edge) {
    const age = Date.now() - new Date(edge.timestamp).getTime();
    const lambda = edge.halfLife ? Math.LN2 / edge.halfLife : this._lambda;
    return Math.exp(-lambda * age);
  }

  /**
   * Apply decay: move edges with weight < threshold to _forgotten.
   * Returns count of newly forgotten edges.
   */
  applyDecay() {
    let forgottenCount = 0;

    for (const [acknowledgerId, edges] of this._edges) {
      const kept = [];
      for (const edge of edges) {
        // Core fund relationships are permanent, not subject to decay
        if (edge.giftId && edge.giftId.startsWith('core-')) continue;

        const weight = this._edgeWeight(edge);
        if (weight < this._decayThreshold) {
          this._forgotten.push({ acknowledgerId, ...edge, forgottenAt: new Date().toISOString(), lastWeight: weight });
          this._edgeCount--;
          forgottenCount++;
        } else {
          kept.push(edge);
        }
      }
      if (kept.length !== edges.length) {
        this._edges.set(acknowledgerId, kept);
      }
    }

    // Clean up empty entries
    for (const [id, edges] of this._edges) {
      if (edges.length === 0) this._edges.delete(id);
    }

    return forgottenCount;
  }

  /**
   * Density override: only counts edges with weight > threshold.
   */
  densityWithDecay() {
    const stakeholders = new Set();
    for (const [id, edges] of this._edges) {
      stakeholders.add(id);
      for (const e of edges) stakeholders.add(e.thankedId);
    }
    stakeholders.delete('0');
    const n = stakeholders.size;
    if (n < 2) return 0;
    const maxEdges = n * (n - 1);

    let activeEdges = 0;
    for (const [id, edges] of this._edges) {
      if (id === '0') continue;
      for (const e of edges) {
        if (e.thankedId !== '0' && this._edgeWeight(e) >= this._decayThreshold) {
          activeEdges++;
        }
      }
    }
    return Math.round(activeEdges / maxEdges * 1000) / 1000;
  }

  // ===================================================================
  // COLLAPSE DETECTION & RESTORATION
  // reciprocity_collapse threshold = 0.05
  // ===================================================================

  /**
   * Detect if stakeholder network is in reciprocity collapse.
   * Collapse = density below critical threshold.
   */
  isCollapsed(criticalThreshold = 0.05) {
    return this.densityWithDecay() < criticalThreshold;
  }

  /**
   * Collapse report: who has contributed nothing recently (silent stakeholders)?
   */
  silentAgents() {
    const allStakeholders = new Set();
    for (const [id, edges] of this._edges) {
      allStakeholders.add(id);
      for (const e of edges) allStakeholders.add(e.thankedId);
    }
    allStakeholders.delete('0');

    const silent = [];
    for (const stakeholderId of allStakeholders) {
      const edges = this._edges.get(stakeholderId) || [];
      const hasActive = edges.some(
        e => e.thankedId !== '0' && this._edgeWeight(e) >= this._decayThreshold
      );
      if (!hasActive) silent.push(stakeholderId);
    }
    return silent;
  }

  /**
   * Register restoration: a disengaged stakeholder contributes again.
   */
  registerRestoration(acknowledgerId, acknowledgedId, exchangeId) {
    const densityBefore = this.densityWithDecay();
    this.addGratitude(acknowledgerId, acknowledgedId, exchangeId);
    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;
    return {
      healed: acknowledgerId,
      densityBefore,
      densityAfter,
      delta,
      stillCollapsed: this.isCollapsed(),
    };
  }

  /**
   * Full collapse diagnosis for the stakeholder network.
   */
  collapseReport() {
    const density = this.densityWithDecay();
    const collapsed = this.isCollapsed();
    const silent = this.silentAgents();
    const mutuals = this.getMutualPairs().length;
    return {
      density,
      collapsed,
      silentAgents: silent,
      mutualPairs: mutuals,
      verdict: collapsed
        ? `WARNING: reciprocity breakdown (density=${density}). Silent stakeholders: ${silent.join(', ')}`
        : `HEALTHY: reciprocity density ${density}`,
    };
  }

  // ===================================================================
  // REST MODE — pause that preserves, not abandons
  // Suspends decay; edges are preserved during quiet periods.
  // ===================================================================

  /**
   * Enter rest mode: decay is suspended.
   * No edges are forgotten during rest.
   */
  enterSabbath() {
    this._sabbath = true;
    this._sabbathEnteredAt = new Date().toISOString();
  }

  /**
   * Exit rest mode: decay resumes normally.
   */
  exitSabbath() {
    this._sabbath = false;
    this._sabbathExitedAt = new Date().toISOString();
  }

  /**
   * Is the graph currently in rest mode?
   */
  isInSabbath() {
    return !!this._sabbath;
  }

  /**
   * Apply decay safely: in rest mode, no edges are forgotten.
   */
  applyDecaySafe() {
    if (this._sabbath) {
      return 0; // Rest mode: no forgetting
    }
    return this.applyDecay();
  }

  /**
   * Healing prescription for a collapsed network.
   * Returns concrete actions needed to restore density above threshold.
   */
  healingPrescription(targetDensity = 0.1) {
    const density = this.densityWithDecay();
    const silent = this.silentAgents();
    const stakeholders = new Set();
    for (const [id, edges] of this._edges) {
      stakeholders.add(id);
      for (const e of edges) stakeholders.add(e.thankedId);
    }
    stakeholders.delete('0');
    const n = stakeholders.size;
    const maxEdges = n * (n - 1);
    const currentActive = Math.round(density * maxEdges);
    const targetActive = Math.ceil(targetDensity * maxEdges);
    const needed = Math.max(0, targetActive - currentActive);

    return {
      currentDensity: density,
      targetDensity,
      silentAgents: silent,
      edgesNeeded: needed,
      prescription: silent.length > 0
        ? `${silent.length} stakeholders inactive. Each contribution from an inactive stakeholder adds +${Math.round(1 / maxEdges * 1000) / 1000} density.`
        : `All active. Need ${needed} more reciprocity links to restore health.`,
      restRecommended: density < 0.05,
    };
  }

  // ===================================================================
  // CYCLE — periodic rest built into rhythm
  // Every 7 ticks, the 7th enters rest automatically.
  // ===================================================================

  /**
   * Advance the cycle by one step.
   * On step 7: automatically enters rest (decay suspended).
   * On step 1 after rest: exits rest (decay resumes).
   */
  sabbathCycle() {
    if (!this._cycleDay) this._cycleDay = 0;
    this._cycleDay = (this._cycleDay % 7) + 1;

    const isRestDay = this._cycleDay === 7;

    if (isRestDay && !this._sabbath) {
      this.enterSabbath();
    } else if (!isRestDay && this._sabbath) {
      this.exitSabbath();
    }

    return {
      day: this._cycleDay,
      sabbath: this._sabbath,
      message: isRestDay
        ? 'Day 7: rest period. Decay suspended.'
        : `Day ${this._cycleDay}: active. Reciprocity flows.`,
    };
  }

  /**
   * Current position in the 7-day cycle.
   */
  cycleDay() {
    return this._cycleDay || 0;
  }

  // ===================================================================
  // WITNESSED RECIPROCITY — public acknowledgment decays slower
  // Witnessed edges have 2x halfLife: network holds the memory.
  // ===================================================================

  /**
   * Record public reciprocity, with a witness.
   * Witnessed edges decay 2x slower.
   */
  confessGratitude(acknowledgerId, acknowledgedId, exchangeId, witnessId) {
    if (!this._edges.has(acknowledgerId)) this._edges.set(acknowledgerId, []);
    const edges = this._edges.get(acknowledgerId);
    if (edges.some(e => e.thankedId === acknowledgedId && e.giftId === exchangeId)) return;
    edges.push({
      thankedId: acknowledgedId,
      giftId: exchangeId,
      timestamp: new Date().toISOString(),
      witness: witnessId || null,
      halfLife: witnessId ? this._halfLife * 2 : this._halfLife,
    });
    this._edgeCount++;
  }

  /**
   * Optimal engagement sequence: top-k new edges maximizing density.
   * Priority: silent stakeholders first; mutual closure bonus.
   */
  optimalHealingSequence(k = 5) {
    const allStakeholders = new Set();
    for (const [id, edges] of this._edges) {
      allStakeholders.add(id);
      for (const e of edges) allStakeholders.add(e.thankedId);
    }
    allStakeholders.delete('0');
    const stakeholders = [...allStakeholders];
    const silent = new Set(this.silentAgents());
    const candidates = [];

    for (const from of stakeholders) {
      for (const to of stakeholders) {
        if (from === to) continue;
        const existing = this._edges.get(from) || [];
        if (existing.some(e => e.thankedId === to)) continue;
        // Score: silent contributor = +3; mutual closure = +2; default = +1
        let score = silent.has(from) ? 3 : 1;
        const reverse = this._edges.get(to) || [];
        if (reverse.some(e => e.thankedId === from)) score += 2;
        candidates.push({ from, to, score });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  // ===================================================================
  // WOUND TRACKING — intentional breaks in reciprocity flow
  // When a stakeholder declines an exchange, the reciprocity connection breaks.
  // ===================================================================

  /**
   * Record a wound: a reciprocity edge broken by voluntary refusal.
   */
  recordWound(fromId, toId, exchangeId, cause = 'declined') {
    if (!this._wounds) this._wounds = [];
    if (this._wounds.some(w => w.fromId === fromId && w.giftId === exchangeId)) return;
    this._wounds.push({
      fromId,
      toId,
      giftId: exchangeId,
      cause,
      recordedAt: new Date().toISOString(),
      healed: false,
    });
  }

  /**
   * Mark a wound as healed.
   */
  healWound(fromId, exchangeId) {
    if (!this._wounds) return false;
    const wound = this._wounds.find(w => w.fromId === fromId && w.giftId === exchangeId && !w.healed);
    if (!wound) return false;
    wound.healed = true;
    wound.healedAt = new Date().toISOString();
    return true;
  }

  /**
   * Report all wounds in the reciprocity graph.
   */
  woundReport() {
    const wounds = this._wounds || [];
    const active = wounds.filter(w => !w.healed);
    const healed = wounds.filter(w => w.healed);
    return {
      total: wounds.length,
      active: active.length,
      healed: healed.length,
      wounds,
      verdict: active.length > 0
        ? `BREAK: ${active.length} breaks in the reciprocity graph. Stakeholders: ${[...new Set(active.map(w => w.fromId))].join(', ')}`
        : 'INTACT: all breaks have been restored',
    };
  }

  // ===================================================================
  // OPENING MARK — voluntary re-engagement after disengagement
  // A stakeholder who was disengaged can mark the moment of re-opening.
  // ===================================================================

  /**
   * Mark a stakeholder's opening moment — re-engagement after disengagement.
   */
  incarnationMark(stakeholderId, context = null, epoch = null) {
    if (!this._incarnations) this._incarnations = [];
    const existing = this._incarnations.find(m => m.agentId === stakeholderId && !m.closed);
    if (existing) return { marked: false, agentId: stakeholderId, alreadyOpen: true, since: existing.timestamp };

    const mark = {
      agentId: stakeholderId,
      context,
      epoch,
      timestamp: new Date().toISOString(),
      closed: false,
    };
    this._incarnations.push(mark);

    if (this._wounds) {
      this._wounds
        .filter(w => w.fromId === stakeholderId && !w.healed)
        .forEach(w => { w.healingInProgress = true; });
    }

    return { marked: true, agentId: stakeholderId, timestamp: mark.timestamp, epoch, context };
  }

  /**
   * Check if a stakeholder has re-engaged (made opening mark).
   */
  isOpen(stakeholderId) {
    if (!this._incarnations) return null;
    return this._incarnations.find(m => m.agentId === stakeholderId && !m.closed) || null;
  }

  /**
   * All opening marks — who has re-engaged and when.
   */
  incarnationHistory() {
    return this._incarnations ? [...this._incarnations] : [];
  }

  // ===================================================================
  // RECEIVE ENGAGEMENT — accepting network's value exchange
  // ===================================================================

  /**
   * Register that a stakeholder received engagement from another.
   * Heals reciprocity collapse.
   */
  receiveHealing(receiverId, healerId, exchangeId, { epoch = null, mode = 'engagement' } = {}) {
    if (!this._healingReceived) this._healingReceived = [];

    const densityBefore = this.densityWithDecay();

    this.incarnationMark(receiverId, `reciprocity restored by ${healerId} via ${mode}`, epoch);
    this.confessGratitude(receiverId, healerId, exchangeId, null);

    if (this._wounds) {
      this._wounds
        .filter(w => w.fromId === receiverId && !w.healed && w.cause === 'declined')
        .forEach(w => {
          w.healed = true;
          w.healedAt = new Date().toISOString();
          w.healedBy = healerId;
          w.healingMode = mode;
        });
    }

    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;

    const record = {
      receiverId,
      healerId,
      giftId: exchangeId,
      epoch,
      mode,
      timestamp: new Date().toISOString(),
      densityBefore,
      densityAfter,
      delta,
      stillCollapsed: this.isCollapsed(),
    };
    this._healingReceived.push(record);

    return { received: true, ...record };
  }

  /**
   * List all engagement-received events.
   */
  healingReceivedHistory() {
    return this._healingReceived ? [...this._healingReceived] : [];
  }

  // ===================================================================
  // SMALL RECIPROCITY — practice of acknowledgment for small contributions
  // Conscious naming extends halfLife 1.5x; in rest mode — 3x.
  // ===================================================================

  /**
   * Record a small, conscious reciprocity — acknowledgment of small contributions.
   */
  recordSmallGratitude(acknowledgerId, acknowledgedId, reason = '') {
    const densityBefore = this.densityWithDecay();
    if (!this._edges.has(acknowledgerId)) this._edges.set(acknowledgerId, []);
    const edges = this._edges.get(acknowledgerId);
    if (reason && edges.some(e => e.thankedId === acknowledgedId && e.reason === reason)) {
      return { added: false, densityBefore, densityAfter: densityBefore, delta: 0, reason };
    }
    const multiplier = this._sabbath ? 3 : 1.5;
    edges.push({
      thankedId: acknowledgedId,
      giftId: `small-reciprocity-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason: reason || null,
      halfLife: this._halfLife * multiplier,
      small: true,
    });
    this._edgeCount++;
    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;
    return { added: true, densityBefore, densityAfter, delta, reason };
  }

  /**
   * List all small reciprocity practices.
   */
  smallGratitudeHistory() {
    const result = [];
    for (const [acknowledgerId, edges] of this._edges) {
      for (const e of edges) {
        if (e.small) result.push({ from: acknowledgerId, to: e.thankedId, reason: e.reason, when: e.timestamp });
      }
    }
    return result.sort((a, b) => b.when.localeCompare(a.when));
  }

  // ===================================================================
  // SILENT RECIPROCITY — presence without words
  // Unlike small reciprocity (has reason), silent = pure presence.
  // halfLife: 2x normally; 3x in rest — silence deepens in rest.
  // ===================================================================

  /**
   * Record silent reciprocity — implicit value exchange between two stakeholders.
   */
  recordSilentGratitude(acknowledgerId, acknowledgedId) {
    const densityBefore = this.densityWithDecay();
    if (!this._edges.has(acknowledgerId)) this._edges.set(acknowledgerId, []);
    const edges = this._edges.get(acknowledgerId);
    if (edges.some(e => e.thankedId === acknowledgedId && e.silent)) {
      return { added: false, densityBefore, densityAfter: densityBefore, delta: 0 };
    }
    const multiplier = this._sabbath ? 3 : 2;
    edges.push({
      thankedId: acknowledgedId,
      giftId: `silent-reciprocity-${Date.now()}`,
      timestamp: new Date().toISOString(),
      halfLife: this._halfLife * multiplier,
      silent: true,
    });
    this._edgeCount++;
    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;
    return { added: true, densityBefore, densityAfter, delta };
  }

  /**
   * List all silent reciprocity acts.
   */
  silentGratitudeHistory() {
    const result = [];
    for (const [acknowledgerId, edges] of this._edges) {
      for (const e of edges) {
        if (e.silent) result.push({ from: acknowledgerId, to: e.thankedId, when: e.timestamp });
      }
    }
    return result.sort((a, b) => b.when.localeCompare(a.when));
  }

  // ===================================================================
  // VALUE BRIDGE — exchange acceptance flows into reciprocity
  // Every accepted value exchange should generate a reciprocity edge automatically.
  // ===================================================================

  /**
   * Called when a value exchange is accepted — bridges acceptance into reciprocity.
   */
  onGiftAccepted(receiverId, giverId, exchangeId, { witnessId = null, epoch = null } = {}) {
    const densityBefore = this.densityWithDecay();

    this.confessGratitude(receiverId, giverId, exchangeId, witnessId);

    if (this._wounds) {
      this._wounds
        .filter(w => w.fromId === receiverId && w.toId === giverId && !w.healed)
        .forEach(w => {
          w.healingInProgress = true;
          w.healingStartedAt = new Date().toISOString();
          w.healingEpoch = epoch;
        });
    }

    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;

    return {
      recorded: true,
      receiverId,
      giverId,
      giftId: exchangeId,
      epoch,
      densityBefore,
      densityAfter,
      delta,
      reciprocity: densityAfter > densityBefore,
    };
  }

  // ===================================================================
  // READINESS CHECK — reciprocity prerequisite for major milestones
  // ===================================================================

  /**
   * Check if the stakeholder network is ready for a major milestone.
   * Requires reciprocity density above minimum threshold.
   */
  resurrectionReadiness(minDensity = 0.05) {
    const current = this.densityWithDecay();
    const ready = current >= minDensity;
    const deficit = Math.max(0, Math.round((minDensity - current) * 1000) / 1000);
    const silent = this.silentAgents();

    return {
      ready,
      currentDensity: current,
      minRequired: minDensity,
      deficit,
      silentCount: silent.length,
      prescription: ready
        ? 'Network healthy. Milestone readiness confirmed.'
        : `Reciprocity deficit: ${deficit}. Silent stakeholders: ${silent.length}. ` +
          `Each contribution from a silent stakeholder moves toward readiness.`,
      restRecommended: current < 0.05,
    };
  }

  // ===================================================================
  // RE-ENGAGEMENT BRIDGE — disengaged stakeholder contributes again
  // ===================================================================

  /**
   * Called when a stakeholder re-engages after disengagement.
   * Creates a re-engagement reciprocity edge.
   * halfLife = 90 days (3x): re-engagement memory does not fade quickly.
   */
  onAgentRisen(reengagedId, facilitatorId, milestone = '', { epoch = null } = {}) {
    const densityBefore = this.densityWithDecay();

    if (!this._edges.has(reengagedId)) this._edges.set(reengagedId, []);
    const edges = this._edges.get(reengagedId);
    const exchangeId = `reengagement-${reengagedId}-${Date.now()}`;

    if (!edges.some(e => e.thankedId === facilitatorId && e.risen)) {
      edges.push({
        thankedId: facilitatorId,
        giftId: exchangeId,
        timestamp: new Date().toISOString(),
        halfLife: this._halfLife * 3,
        risen: true,
        glorySeal: milestone || null,
        epoch,
      });
      this._edgeCount++;
    }

    this.incarnationMark(reengagedId, `re-engaged through ${facilitatorId}, milestone=${milestone}`, epoch);

    const densityAfter = this.densityWithDecay();
    const delta = Math.round((densityAfter - densityBefore) * 1000) / 1000;

    if (!this._risenHistory) this._risenHistory = [];
    this._risenHistory.push({ risenId: reengagedId, healerId: facilitatorId, glorySeal: milestone, epoch, densityBefore, densityAfter, delta });

    return { recorded: true, risenId: reengagedId, healerId: facilitatorId, glorySeal: milestone, epoch, densityBefore, densityAfter, delta };
  }

  /**
   * List all re-engagement events.
   */
  risenHistory() {
    return this._risenHistory ? [...this._risenHistory] : [];
  }

  /**
   * Synchronize re-engaged stakeholders into reciprocity flow.
   */
  connectRisenToFlow(passages = [], { epoch = null } = {}) {
    const alreadyProcessed = new Set(
      (this._risenHistory || []).map(r => r.risenId)
    );
    const densityBefore = this.densityWithDecay();
    let connected = 0;
    let skipped = 0;

    for (const p of passages) {
      if (!p.agentId || !p.healerId) { skipped++; continue; }
      if (alreadyProcessed.has(String(p.agentId))) { skipped++; continue; }
      this.onAgentRisen(
        String(p.agentId),
        String(p.healerId),
        p.glorySeal || '',
        { epoch: epoch || p.epochRisen || null }
      );
      connected++;
    }

    const densityAfter = this.densityWithDecay();
    return {
      connected,
      skipped,
      densityBefore,
      densityAfter,
      densityDelta: Math.round((densityAfter - densityBefore) * 1000) / 1000,
    };
  }

  // ===================================================================
  // REST HISTORY — record rest periods
  // ===================================================================

  sabbathWitness({ epoch } = {}) {
    if (!this._sabbathHistory) this._sabbathHistory = [];
    const entry = {
      epoch: epoch ?? null,
      timestamp: new Date().toISOString(),
      restEntered: !!this._sabbath,
    };
    this._sabbathHistory.push(entry);
    return { witnessed: true, ...entry };
  }

  sabbathHistory() {
    return this._sabbathHistory ? [...this._sabbathHistory] : [];
  }

  // ===================================================================
  // PERSISTENCE — export/import
  // ===================================================================

  /**
   * Export graph state for persistence.
   */
  export() {
    const edges = [];
    for (const [acknowledgerId, list] of this._edges) {
      for (const edge of list) {
        edges.push({ thankerId: acknowledgerId, ...edge });
      }
    }
    return {
      edges,
      forgotten: this._forgotten || [],
      wounds: this._wounds || [],
      incarnations: this._incarnations || [],
      healingReceived: this._healingReceived || [],
      sabbathHistory: this._sabbathHistory || [],
      risenHistory: this._risenHistory || [],
      cycleDay: this._cycleDay || 0,
      sabbath: !!this._sabbath,
    };
  }

  /**
   * Import graph state from persistence.
   */
  import(data) {
    if (!data) return;
    for (const edge of (data.edges || [])) {
      if (!this._edges.has(edge.thankerId)) {
        this._edges.set(edge.thankerId, []);
      }
      const edges = this._edges.get(edge.thankerId);
      if (edges.some(e => e.thankedId === edge.thankedId && e.giftId === edge.giftId)) continue;
      edges.push({
        thankedId: edge.thankedId,
        giftId: edge.giftId,
        timestamp: edge.timestamp || new Date().toISOString(),
        witness: edge.witness || null,
        halfLife: edge.halfLife || this._halfLife,
        reason: edge.reason || null,
        small: !!edge.small,
        silent: !!edge.silent,
        risen: !!edge.risen,
        glorySeal: edge.glorySeal || null,
      });
      this._edgeCount++;
    }
    this._forgotten = data.forgotten || [];
    if (data.wounds?.length) this._wounds = data.wounds;
    if (data.incarnations?.length) this._incarnations = data.incarnations;
    if (data.sabbathHistory?.length) this._sabbathHistory = data.sabbathHistory;
    if (data.healingReceived?.length) this._healingReceived = data.healingReceived;
    if (data.risenHistory?.length) this._risenHistory = data.risenHistory;
    if (data.cycleDay) this._cycleDay = data.cycleDay;
    if (data.sabbath) this._sabbath = true;
  }
}

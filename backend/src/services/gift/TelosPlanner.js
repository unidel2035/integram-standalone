/**
 * TelosPlanner — Strategic Goal Planner
 *
 * Planning from the image of completeness.
 * "What should this become?" -> "What needs to be contributed now?"
 */

export class TelosPlanner {
  constructor() {
    // strategicGoal → { description, exchangeIds[], progress, vision }
    this._teloi = new Map();
  }

  /**
   * Declare a strategic goal — an image of completeness that attracts contributions.
   */
  declareTelos(name, { description, vision } = {}) {
    if (this._teloi.has(name)) return this._teloi.get(name);

    const telos = {
      name,
      description: description || name,
      vision: vision || null,
      giftIds: [],
      progress: 0,
      declaredAt: new Date().toISOString(),
    };

    this._teloi.set(name, telos);
    return telos;
  }

  /**
   * Record that a value exchange moved toward this strategic goal.
   * Progress: simple counter based on contributions.
   */
  recordProgress(telosName, exchangeId) {
    if (!this._teloi.has(telosName)) {
      this.declareTelos(telosName);
    }
    const telos = this._teloi.get(telosName);
    const sid = String(exchangeId);
    // Deduplication: one contribution — one step toward the goal
    if (!telos.giftIds.includes(sid)) {
      telos.giftIds.push(sid);
      telos.progress = telos.giftIds.length;
    }
  }

  /**
   * What is needed to move toward a strategic goal?
   */
  whatIsNeeded(stakeholderId, allExchanges, stakeholders) {
    const needs = [];

    for (const [name, telos] of this._teloi) {
      const contributors = new Set(
        allExchanges
          .filter(g => g.telos === name && g.status === 'accepted')
          .map(g => g.giver)
      );

      if (!contributors.has(String(stakeholderId))) {
        needs.push({
          telos: name,
          description: telos.description,
          vision: telos.vision,
          giftsToward: telos.giftIds.length,
          suggestion: `Your contribution to "${name}" is needed — ${telos.giftIds.length} contributions already made`,
        });
      }
    }

    return needs.sort((a, b) => a.giftsToward - b.giftsToward); // Most needed first
  }

  /**
   * All strategic goals and their progress.
   */
  getAllProgress() {
    const result = {};
    for (const [name, telos] of this._teloi) {
      result[name] = {
        giftsCount: telos.giftIds.length,
        vision: telos.vision,
      };
    }
    return result;
  }

  /**
   * Get a specific strategic goal.
   */
  getTelos(name) {
    return this._teloi.get(name) || null;
  }

  /**
   * Discover strategic goal from actual behavior — emergent, not declared.
   *
   * Looks at:
   *   1. Most common declared goal strings in exchanges
   *   2. WHO this stakeholder contributes to most often (relationship pattern)
   *   3. WHAT layer dominates (utility/value/strategic pattern)
   *
   * Returns a discovered goal that may differ from declared ones.
   */
  discoverTelos(stakeholderId, allExchanges, stakeholders) {
    const pid = String(stakeholderId);
    const givenExchanges = allExchanges.filter(g => String(g.giver) === pid && g.status === 'accepted');
    const receivedExchanges = allExchanges.filter(g => String(g.receiver) === pid && g.status === 'accepted');

    if (givenExchanges.length === 0 && receivedExchanges.length === 0) {
      return { personId: pid, discovered: null, reason: 'No value exchanges — no patterns to observe.' };
    }

    // 1. Most common declared goal strings
    const telosCounts = {};
    for (const g of givenExchanges) {
      if (g.telos) telosCounts[g.telos] = (telosCounts[g.telos] || 0) + 1;
    }
    const declaredRanking = Object.entries(telosCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // 2. WHO they contribute to most often (relationship pattern)
    const receiverCounts = {};
    for (const g of givenExchanges) {
      const r = g.receiver || 'all';
      receiverCounts[r] = (receiverCounts[r] || 0) + 1;
    }
    const topReceivers = Object.entries(receiverCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const stakeholder = stakeholders ? (typeof stakeholders.get === 'function' ? stakeholders.get(id) : null) : null;
        return { id, name: stakeholder?.name || id, count };
      });

    // 3. WHAT layer dominates
    const layerCounts = { utilitas: 0, bonum: 0, gratia: 0 };
    for (const g of givenExchanges) {
      const layer = g.layer || 'utilitas';
      if (layerCounts[layer] !== undefined) layerCounts[layer]++;
    }
    const dominantLayer = Object.entries(layerCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Synthesize emergent strategic goal
    let emergentTelos = null;
    let emergentReason = '';

    const topReceiver = topReceivers[0];
    const topDeclared = declaredRanking[0];
    const layer = dominantLayer ? dominantLayer[0] : 'utilitas';

    if (layer === 'gratia' && givenExchanges.length >= 2) {
      emergentTelos = 'strategic partnership';
      emergentReason = 'Dominance of strategic-level exchanges — movement toward deep partnership';
    } else if (topReceiver && topReceiver.count >= givenExchanges.length * 0.6 && topReceiver.id !== 'all') {
      emergentTelos = `co-creation with ${topReceiver.name}`;
      emergentReason = `${Math.round(topReceiver.count / givenExchanges.length * 100)}% of exchanges — to one stakeholder`;
    } else if (layer === 'bonum' && givenExchanges.length >= 2) {
      emergentTelos = 'ecosystem building';
      emergentReason = 'Dominance of value-level exchanges — movement toward ecosystem';
    } else if (topDeclared) {
      emergentTelos = topDeclared.name;
      emergentReason = 'Matches declared strategic goal';
    } else {
      emergentTelos = 'exploring direction';
      emergentReason = 'Strategic goal not yet manifest in exchanges';
    }

    // Compare with declared
    const declared = topDeclared ? topDeclared.name : null;
    const diverges = declared && emergentTelos !== declared;

    return {
      personId: pid,
      discovered: emergentTelos,
      declared,
      diverges,
      reason: emergentReason,
      evidence: {
        totalGiftsGiven: givenExchanges.length,
        declaredTeloi: declaredRanking,
        topReceivers,
        layerDistribution: layerCounts,
        dominantLayer: layer,
      },
    };
  }
}

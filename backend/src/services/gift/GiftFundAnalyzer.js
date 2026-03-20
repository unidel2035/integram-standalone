/**
 * GiftFundAnalyzer — Value Exchange layer for venture fund evaluation
 *
 * Adds three questions standard due diligence cannot ask:
 * 1. "What does the fund GIVE besides money?" (layer detection)
 * 2. "Does this transform the portfolio?" (mutual transformation)
 * 3. "Can the project say no?" (freedom as health signal)
 *
 * Strategic thesis: invest in projects that CONTRIBUTE (open code, shared infra, community),
 * not projects that only SELL (proprietary lock-in).
 *
 * Numbers are computed internally, prose and observations are output externally.
 */

import { getGiftEngine } from './GiftEngine.js';
import logger from '../../utils/logger.js';

const FUND_TELOS = 'Sovereign open source ecosystem';

/**
 * Keywords signaling open contribution vs. proprietary lock-in.
 */
const OPEN_KEYWORDS = [
  'open source', 'open-source', 'opensource',
  'apache', 'mit', 'gpl', 'bsd', 'mozilla', 'lgpl', 'public domain',
  'community', 'contribution', 'shared', 'commons',
];

const LOCK_IN_KEYWORDS = [
  'proprietary', 'closed source', 'vendor lock', 'exclusive',
  'license key', 'saas only', 'cloud-only', 'subscription',
  'black box', 'unavailable', 'nda',
];

class GiftFundAnalyzer {
  constructor() {
    this._engine = null;
  }

  /** Lazy accessor — engine may not be ready at construction time */
  get engine() {
    if (!this._engine) this._engine = getGiftEngine();
    return this._engine;
  }

  // ===================================================================
  // 1. ANALYZE PROJECT — value-exchange-layer due diligence
  // ===================================================================

  /**
   * Takes a project object and existing portfolio.
   * Returns value-exchange-layer analysis: what standard due diligence cannot see.
   *
   * @param {object} project — { name, description, products, openSource, license, dependencies, team, calling }
   * @param {object[]} portfolio — array of project objects already in portfolio
   * @returns {object} value-exchange-layer analysis
   */
  analyzeProject(project, portfolio = []) {
    if (!project || !project.name) {
      throw new Error('Project must have a name. Value exchanges require identity, not abstraction.');
    }

    const text = this._projectText(project);

    const openSourceHealth = this._assessOpenSourceHealth(project, text);
    const sovereigntyScore = this._assessSovereigntyGift(project, text);
    const portfolioTransformation = this._assessPortfolioTransformation(project, portfolio);
    const telosAlignment = this._assessTelosAlignment(project, text);
    const freedomSignal = this._assessFreedomSignal(project);

    // Detect value exchange layer
    const layer = this._detectProjectLayer(openSourceHealth, sovereigntyScore, freedomSignal);

    logger.info(`[GiftFund] Analyzed project "${project.name}" — layer: ${layer}`);

    return {
      project: project.name,
      layer,
      openSourceHealth,
      sovereigntyScore,
      portfolioTransformation,
      telosAlignment,
      freedomSignal,
      // What the system cannot know
      reserve: 'We see traces — code, licenses, commits. But the project\'s true calling is unknowable from outside.',
    };
  }

  // ===================================================================
  // 2. PORTFOLIO HEALTH — the stakeholder network as a whole
  // ===================================================================

  /**
   * Analyze the whole portfolio as a value exchange network.
   *
   * @param {object[]} [portfolio] — override portfolio; if absent, use all engine stakeholders
   * @returns {object}
   */
  analyzePortfolioHealth(portfolio) {
    const engine = this.engine;
    const stakeholders = portfolio || engine.persons.all();
    const exchanges = engine._gifts || [];
    const stakeholderIds = new Set(stakeholders.map(p => p.id || p.name));

    // Mutual Value Cycles
    const mutualCycles = engine.getPerichoresis();

    // Reciprocity density
    const reciprocityDensity = engine.gratitude.density();

    // Only givers / only takers among portfolio
    const giverIds = new Set(exchanges.filter(g => g.status === 'accepted').map(g => g.giver));
    const receiverIds = new Set(exchanges.filter(g => g.status === 'accepted' && g.receiver !== 'all').map(g => g.receiver));

    const onlyGivers = [];
    const onlyTakers = [];
    for (const p of stakeholders) {
      const id = p.id || p.name;
      const gives = giverIds.has(id);
      const takes = receiverIds.has(id);
      if (gives && !takes) onlyGivers.push({ id, name: p.name, calling: p.calling });
      if (takes && !gives) onlyTakers.push({ id, name: p.name, calling: p.calling });
    }

    // Open source contribution (from exchanges with open-source related content)
    const openExchanges = exchanges.filter(g => {
      const t = `${g.content || ''} ${g.telos || ''}`.toLowerCase();
      return OPEN_KEYWORDS.some(kw => t.includes(kw));
    });

    // Isolation risk: disconnected nodes with no reciprocity connections
    const edges = engine.gratitude.allEdges();
    const connectedIds = new Set();
    for (const e of edges) {
      connectedIds.add(e.from);
      connectedIds.add(e.to);
    }
    const isolatedStakeholders = stakeholders.filter(p => !connectedIds.has(p.id || p.name));

    // Observations — prose, not scores
    const observations = [];
    if (onlyGivers.length > 0) {
      observations.push(`Only contributing (burnout risk): ${onlyGivers.map(g => g.name).join(', ')}`);
    }
    if (onlyTakers.length > 0) {
      observations.push(`Only receiving (asymmetry): ${onlyTakers.map(t => t.name).join(', ')}`);
    }
    if (isolatedStakeholders.length > 0) {
      observations.push(`Isolated (low trust): ${isolatedStakeholders.map(p => p.name).join(', ')}`);
    }
    if (reciprocityDensity < 0.1 && stakeholders.length > 3) {
      observations.push('Reciprocity density is low — portfolio is fragmented');
    }
    if (mutualCycles.cycles.length > 0) {
      observations.push(`Mutual value cycles detected: ${mutualCycles.cycles.length} — healthy sign`);
    }

    const questions = [];
    if (onlyGivers.length > onlyTakers.length * 2) {
      questions.push('Someone carries the burden of contribution for the entire portfolio. Is this sustainable?');
    }
    if (isolatedStakeholders.length > stakeholders.length / 2) {
      questions.push('More than half the portfolio is isolated. Is this a portfolio or a collection of deals?');
    }

    return {
      personsCount: stakeholders.length,
      mutualCycles,
      reciprocityDensity,
      onlyGivers,
      onlyTakers,
      openSourceContribution: {
        giftsCount: openExchanges.length,
        share: exchanges.length > 0 ? Math.round(openExchanges.length / exchanges.length * 100) : 0,
      },
      isolationRisk: {
        isolatedStakeholders: isolatedStakeholders.map(p => ({ id: p.id, name: p.name })),
        observation: isolatedStakeholders.length > 0
          ? 'Isolated nodes — low reciprocity density. Anomalies are hard to detect.'
          : 'All nodes connected — anomalies are visible to the network.',
      },
      observations,
      questions,
    };
  }

  // ===================================================================
  // 3. SUGGEST PAIRS — calling compatibility
  // ===================================================================

  /**
   * Find which portfolio companies need each other based on calling compatibility.
   *
   * @param {object[]} [portfolio] — override; if absent, use engine stakeholders
   * @returns {object[]}
   */
  suggestPairs(portfolio) {
    const engine = this.engine;
    const stakeholders = portfolio || engine.persons.all();
    if (stakeholders.length < 2) return [];

    const existingPairs = new Set(
      engine.gratitude.getMutualPairs().map(p => p.persons.sort().join('<->'))
    );

    const suggestions = [];

    // Match by complementary callings
    const callingGroups = {
      producer: ['manufacturer', 'developer', 'constructor', 'builder', 'maker'],
      consumer: ['customer', 'operator', 'user', 'buyer', 'client'],
      knowledge: ['research', 'education', 'science', 'university', 'institute'],
      infra: ['infrastructure', 'coordination', 'platform', 'standard'],
      regulator: ['regulator', 'certification', 'compliance', 'authority'],
      ai: ['ai', 'machine learning', 'neural', 'algorithm', 'navigation'],
      components: ['component', 'engine', 'board', 'electronics', 'hardware'],
    };

    const classifyStakeholder = (stakeholder) => {
      const text = `${stakeholder.calling || ''} ${stakeholder.description || ''}`.toLowerCase();
      const roles = [];
      for (const [role, keywords] of Object.entries(callingGroups)) {
        if (keywords.some(kw => text.includes(kw))) roles.push(role);
      }
      return roles.length > 0 ? roles : ['unknown'];
    };

    const complementary = [
      ['producer', 'consumer'], ['knowledge', 'producer'], ['ai', 'producer'],
      ['components', 'producer'], ['infra', 'consumer'], ['knowledge', 'ai'],
      ['regulator', 'producer'], ['infra', 'knowledge'],
    ];

    for (let i = 0; i < stakeholders.length; i++) {
      for (let j = i + 1; j < stakeholders.length; j++) {
        const a = stakeholders[i];
        const b = stakeholders[j];
        const rolesA = classifyStakeholder(a);
        const rolesB = classifyStakeholder(b);

        const pairKey = [a.id || a.name, b.id || b.name].sort().join('<->');
        if (existingPairs.has(pairKey)) continue;

        let match = null;
        for (const [r1, r2] of complementary) {
          if ((rolesA.includes(r1) && rolesB.includes(r2)) ||
              (rolesA.includes(r2) && rolesB.includes(r1))) {
            match = [r1, r2];
            break;
          }
        }

        if (match) {
          const aGives = this._whatWouldGive(a, rolesA);
          const bGives = this._whatWouldGive(b, rolesB);

          suggestions.push({
            persons: [{ id: a.id, name: a.name, calling: a.calling }, { id: b.id, name: b.name, calling: b.calling }],
            complementaryRoles: match,
            exchange: {
              aGives,
              bGives,
              aReceives: bGives,
              bReceives: aGives,
            },
            expectedTransformation: {
              both: `Mutual enrichment: ${a.name} (${match[0]}) <-> ${b.name} (${match[1]})`,
              ecosystem: `Chain closure: ${match[0]} -> ${match[1]}`,
            },
          });
        }
      }
    }

    // Sort by unexpectedness
    const exchanges = engine._gifts || [];
    suggestions.sort((a, b) => {
      const aConnected = exchanges.some(g =>
        (g.giver === a.persons[0].id && g.receiver === a.persons[1].id) ||
        (g.giver === a.persons[1].id && g.receiver === a.persons[0].id)
      );
      const bConnected = exchanges.some(g =>
        (g.giver === b.persons[0].id && g.receiver === b.persons[1].id) ||
        (g.giver === b.persons[1].id && g.receiver === b.persons[0].id)
      );
      return (aConnected ? 1 : 0) - (bConnected ? 1 : 0);
    });

    return suggestions.slice(0, 20);
  }

  // ===================================================================
  // 4. EVALUATE OPEN SOURCE PROJECT — GitHub metrics through value exchange lens
  // ===================================================================

  /**
   * Evaluate an open source project for investment through value exchange lens.
   *
   * @param {object} repoMetrics — { name, stars, forks, contributors, prs, issues,
   *   reviewers, maintainers, license, closedIssuesRatio, avgPrReviewTime,
   *   busFactorTop3, dependents, dependencies }
   * @returns {object}
   */
  evaluateOpenSourceProject(repoMetrics) {
    if (!repoMetrics || !repoMetrics.name) {
      throw new Error('repoMetrics.name required');
    }

    const m = repoMetrics;
    const observations = [];
    const questions = [];

    // --- Burnout risk (xz/faker.js scenario) ---
    const maintainerRatio = (m.maintainers || 1) / Math.max(m.contributors || 1, 1);
    const busFactor = m.busFactorTop3 || null;

    if (maintainerRatio < 0.05 && (m.contributors || 0) > 20) {
      observations.push({
        type: 'burnout_risk',
        severity: 'high',
        text: `Less than 5% of contributors are maintainers. xz-scenario risk: one person carries the burden for all.`,
      });
    }
    if (busFactor !== null && busFactor > 0.8) {
      observations.push({
        type: 'bus_factor',
        severity: 'high',
        text: `Top-3 contributors do ${Math.round(busFactor * 100)}% of the work. Project is fragile.`,
      });
    }

    // --- Reciprocity cycles (healthy mutual review patterns) ---
    const reviewerCount = m.reviewers || 0;
    const prCount = m.prs || 0;

    if (reviewerCount > 3 && prCount > 0) {
      const reviewRatio = reviewerCount / Math.max(prCount, 1);
      if (reviewRatio > 0.3) {
        observations.push({
          type: 'reciprocity_cycle',
          severity: 'healthy',
          text: `Healthy pattern: ${reviewerCount} reviewers on ${prCount} PRs. Mutual attention.`,
        });
      }
    }
    if (reviewerCount <= 1 && prCount > 10) {
      observations.push({
        type: 'no_review',
        severity: 'warning',
        text: `${prCount} PRs, but review is done by <=1 person. No mutual witnessing.`,
      });
    }

    // --- Freedom of refusal ---
    const closedRatio = m.closedIssuesRatio || 0;
    let freedomAssessment;
    if (closedRatio > 0.3 && closedRatio < 0.8) {
      freedomAssessment = {
        signal: 'healthy',
        text: `${Math.round(closedRatio * 100)}% issues closed. Maintainers can say "no" — and do.`,
      };
    } else if (closedRatio >= 0.8) {
      freedomAssessment = {
        signal: 'question',
        text: `${Math.round(closedRatio * 100)}% issues closed. High standard or community exclusion?`,
      };
      questions.push('High closed issues ratio — freedom of refusal or ignoring the community?');
    } else {
      freedomAssessment = {
        signal: 'warning',
        text: `Only ${Math.round(closedRatio * 100)}% issues closed. Maintainers overloaded?`,
      };
    }

    // --- Backdoor resistance ---
    const dependentCount = m.dependents || 0;
    let backdoorResistance;

    if (reviewerCount > 3 && maintainerRatio > 0.1) {
      backdoorResistance = {
        level: 'high',
        text: 'Multiple reviewers and active maintainers. Anomaly injection is noticeable.',
      };
    } else if (reviewerCount <= 1 && dependentCount > 100) {
      backdoorResistance = {
        level: 'critical',
        text: `One reviewer, but ${dependentCount} dependent projects. Classic attack vector.`,
      };
      questions.push('Critical dependency of many on few. Who witnesses this code?');
    } else {
      backdoorResistance = {
        level: 'moderate',
        text: 'Moderate number of witnesses. Anomalies may be noticed, but not guaranteed.',
      };
    }

    // --- License as value exchange layer ---
    const license = (m.license || '').toLowerCase();
    let licenseLayer;
    if (['mit', 'apache', 'bsd', 'public domain', 'unlicense', 'cc0'].some(l => license.includes(l))) {
      licenseLayer = { layer: 'gratia', text: `License ${m.license} — unconditional contribution. Maximum freedom.` };
    } else if (['gpl', 'lgpl', 'agpl', 'mpl', 'mozilla'].some(l => license.includes(l))) {
      licenseLayer = { layer: 'bonum', text: `License ${m.license} — contribution with reciprocity condition (copyleft).` };
    } else if (license) {
      licenseLayer = { layer: 'utilitas', text: `License ${m.license} — conditional access, not a contribution.` };
    } else {
      licenseLayer = { layer: 'unknown', text: 'No license specified. Legal status of the contribution is unclear.' };
      questions.push('No license — unnamed contribution. Who is the owner? Can it be revoked?');
    }

    return {
      project: m.name,
      observations,
      freedomOfRefusal: freedomAssessment,
      backdoorResistance,
      licenseAsExchange: licenseLayer,
      questions,
      reserve: 'Metrics are traces. Contributor motivation, team trust, hidden conflicts — beyond observation.',
    };
  }

  // ===================================================================
  // 5. GENERATE VALUE EXCHANGE VERDICT — FST Committee style
  // ===================================================================

  /**
   * Produce a verdict from value exchange perspective.
   *
   * @param {object} project — { name, description, products, openSource, license, team, askAmount, calling }
   * @returns {object} { stance, exchangeLayer, reasoning, transformations, questions }
   */
  generateGiftVerdict(project) {
    if (!project || !project.name) {
      throw new Error('project.name required');
    }

    const text = this._projectText(project);
    const openHealth = this._assessOpenSourceHealth(project, text);
    const sovereignty = this._assessSovereigntyGift(project, text);
    const freedom = this._assessFreedomSignal(project);
    const telosAlign = this._assessTelosAlignment(project, text);

    // Determine stance
    let stance = 'DEFER';
    const reasons = [];
    const questions = [];

    const approveSignals = [
      openHealth.givingRatio > 0.5,
      sovereignty.isGiving,
      freedom.canRefuse,
      telosAlign.aligned,
    ].filter(Boolean).length;

    const rejectSignals = [
      sovereignty.isLockIn,
      openHealth.givingRatio === 0 && !project.openSource,
      freedom.captured,
    ].filter(Boolean).length;

    if (approveSignals >= 3 && rejectSignals === 0) {
      stance = 'APPROVE';
      reasons.push('Project contributes: open code, sovereignty, freedom of refusal.');
    } else if (rejectSignals >= 2) {
      stance = 'REJECT';
      reasons.push('Project sells, not contributes: lock-in, closed source, dependency.');
    } else {
      stance = 'DEFER';
      reasons.push('Clarification needed: project is on the boundary of contribution and sale.');
    }

    if (!project.openSource) {
      questions.push('Is the project willing to open-source? Without this — utility, not strategic value.');
    }
    if (!freedom.canRefuse) {
      questions.push('Can the project refuse fund conditions? Dependent projects are fragile investments.');
    }
    if (!telosAlign.aligned) {
      questions.push(`Project\'s calling ("${project.calling || '?'}") — how does it relate to fund\'s strategic goal?`);
    }

    // Exchange layer detection
    const layer = openHealth.givingRatio > 0.7 && sovereignty.isGiving
      ? 'gratia'
      : openHealth.givingRatio > 0.3
        ? 'bonum'
        : 'utilitas';

    // What transforms
    const transformations = {
      fund: stance === 'APPROVE'
        ? `Fund gains ${project.name} — ${openHealth.observation}. Portfolio transforms.`
        : `Fund holds position. ${project.name} needs maturation.`,
      project: stance === 'APPROVE'
        ? `${project.name} receives not only capital, but expertise, connections, co-presence in ecosystem.`
        : `${project.name} is invited to dialogue — the exchange of questions instead of money.`,
    };

    logger.info(`[GiftFund] Verdict for "${project.name}": ${stance} (layer: ${layer})`);

    return {
      project: project.name,
      stance,
      exchangeLayer: layer,
      reasoning: reasons.join(' '),
      transformations,
      questions,
      reserve: 'Verdict is an observer\'s testimony, not a sentence. Project may carry a calling invisible in data.',
    };
  }

  // ===================================================================
  // INTERNAL — assessments (compute inside, prose outside)
  // ===================================================================

  _projectText(project) {
    return [
      project.name, project.description, project.calling,
      ...(project.products || []),
      project.license, project.openSource ? 'open source' : '',
    ].filter(Boolean).join(' ').toLowerCase();
  }

  _assessOpenSourceHealth(project, text) {
    const openSignals = OPEN_KEYWORDS.filter(kw => text.includes(kw)).length;
    const lockSignals = LOCK_IN_KEYWORDS.filter(kw => text.includes(kw)).length;
    const total = openSignals + lockSignals || 1;
    const givingRatio = Math.round(openSignals / total * 100) / 100;

    let observation;
    if (project.openSource === true || givingRatio > 0.7) {
      observation = 'Project contributes code — open source, ecosystem contribution.';
    } else if (givingRatio > 0.3) {
      observation = 'Mixed model — elements of openness and closure.';
    } else {
      observation = 'Project consumes more than contributes. Open source not detected.';
    }

    return { givingRatio, openSignals, lockSignals, observation };
  }

  _assessSovereigntyGift(project, text) {
    const sovereignKeywords = ['sovereign', 'import substitution', 'domestic', 'independent', 'auditable'];
    const lockInKeywords = ['vendor lock', 'dependency', 'tied to', 'foreign', 'western'];

    const isSovereign = sovereignKeywords.some(kw => text.includes(kw));
    const isLockIn = lockInKeywords.some(kw => text.includes(kw));
    const isGiving = isSovereign && !isLockIn;

    let observation;
    if (isGiving) {
      observation = 'Project CONTRIBUTES sovereignty: auditable, independent, open.';
    } else if (isLockIn) {
      observation = 'Project SELLS sovereignty: dependency on external vendor.';
    } else {
      observation = 'Sovereignty undetermined — no clear signals.';
    }

    return { isSovereign, isLockIn, isGiving, observation };
  }

  _assessPortfolioTransformation(project, portfolio) {
    if (!portfolio || portfolio.length === 0) {
      return {
        observation: 'Portfolio is empty. This project will be the foundation.',
        synergies: [],
        gaps: [],
      };
    }

    const projectText = this._projectText(project);
    const synergies = [];
    const gaps = [];

    for (const existing of portfolio) {
      const existingText = this._projectText(existing);
      const sharedKeywords = OPEN_KEYWORDS.filter(kw =>
        projectText.includes(kw) && existingText.includes(kw)
      );

      if (sharedKeywords.length > 0) {
        synergies.push({
          with: existing.name,
          sharedThemes: sharedKeywords,
          potential: `${project.name} and ${existing.name} can strengthen each other in: ${sharedKeywords.join(', ')}`,
        });
      }
    }

    const existingCallings = portfolio.map(p => (p.calling || '').toLowerCase());
    const projectCalling = (project.calling || '').toLowerCase();
    if (projectCalling && !existingCallings.some(c => c.includes(projectCalling.slice(0, 5)))) {
      gaps.push(`${project.name} brings a new calling: "${project.calling}"`);
    }

    const observation = synergies.length > 0
      ? `${project.name} creates ${synergies.length} synergies with portfolio. Mutual transformation.`
      : `${project.name} does not overlap with portfolio. New direction — risk or diversification?`;

    return { observation, synergies, gaps };
  }

  _assessTelosAlignment(project, text) {
    const telosKeywords = ['drone', 'uas', 'uav', 'unmanned', 'aviation', 'aero', 'autonomous'];
    const ecosystemKeywords = ['ecosystem', 'platform', 'infrastructure', 'standard', 'community'];

    const relevantToUAS = telosKeywords.some(kw => text.includes(kw));
    const relevantToEcosystem = ecosystemKeywords.some(kw => text.includes(kw));
    const aligned = relevantToUAS || relevantToEcosystem;

    let observation;
    if (relevantToUAS && relevantToEcosystem) {
      observation = `Project calling aligns with fund strategic goal: "${FUND_TELOS}"`;
    } else if (relevantToUAS) {
      observation = 'Project is in the target industry, but not at ecosystem level.';
    } else if (relevantToEcosystem) {
      observation = 'Ecosystem project, but not specific to target industry.';
    } else {
      observation = 'Connection to fund strategic goal is unclear.';
    }

    return { aligned, relevantToUAS, relevantToEcosystem, fundTelos: FUND_TELOS, observation };
  }

  _assessFreedomSignal(project) {
    const hasAlternatives = (project.otherInvestors || []).length > 0 || project.profitable;
    const hasOwnRevenue = project.revenue > 0 || project.profitable;
    const canRefuse = hasAlternatives || hasOwnRevenue;
    const captured = project.dependent || project.onlyFunding;

    let observation;
    if (canRefuse) {
      observation = 'Project can refuse fund conditions. Paradox: this makes it a better investment.';
    } else if (captured) {
      observation = 'Project is dependent — cannot refuse. This is rescue, not investment. Different dynamics.';
    } else {
      observation = 'Freedom of refusal undetermined. Dialogue needed.';
    }

    return { canRefuse, captured, observation };
  }

  _detectProjectLayer(openHealth, sovereignty, freedom) {
    if (openHealth.givingRatio > 0.7 && sovereignty.isGiving && freedom.canRefuse) {
      return 'gratia';
    }
    if (openHealth.givingRatio > 0.3 || sovereignty.isGiving) {
      return 'bonum';
    }
    return 'utilitas';
  }

  _whatWouldGive(stakeholder, roles) {
    const roleContributions = {
      producer: 'Technologies, products, engineering solutions',
      consumer: 'Real-world usage data, feedback, orders',
      knowledge: 'Research, talent, methodologies',
      infra: 'Platform, standards, coordination',
      regulator: 'Certification, compliance, regulatory clarity',
      ai: 'Algorithms, models, autonomous navigation',
      components: 'Components, engines, electronics',
      unknown: 'Calling not recognized',
    };

    return roles.map(r => roleContributions[r] || roleContributions.unknown).join('; ');
  }
}

// ===================================================================
// Singleton
// ===================================================================

let _instance = null;

export function getGiftFundAnalyzer() {
  if (!_instance) _instance = new GiftFundAnalyzer();
  return _instance;
}

export { GiftFundAnalyzer };
export default GiftFundAnalyzer;

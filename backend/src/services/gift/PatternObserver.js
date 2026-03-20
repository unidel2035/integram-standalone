/**
 * PatternObserver — observer of value exchange patterns
 *
 * Computes ratios/counts internally, outputs prose. No scores.
 * Adapted for venture fund context: stakeholders, contributions, portfolio.
 */
class PatternObserver {
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * Observe patterns for a specific stakeholder or the entire network
   * @param {string} [stakeholderId] — if not specified, observes the entire network
   * @returns {{ observations: Array<{type: string, text: string}>, questions: string[] }}
   */
  observe(stakeholderId) {
    if (stakeholderId) {
      return this._observeStakeholder(stakeholderId);
    }
    return this._observeNetwork();
  }

  _observeStakeholder(stakeholderId) {
    const observations = [];
    const questions = [];
    const exchanges = this.engine.gifts || [];
    const stakeholders = this.engine.persons;

    const stakeholder = stakeholders.get(stakeholderId);
    if (!stakeholder) return { observations: [{ type: 'error', text: `Stakeholder ${stakeholderId} not found` }], questions: [] };

    const name = stakeholder.name;

    // Count exchanges
    const given = exchanges.filter(g => g.giver === stakeholderId);
    const received = exchanges.filter(g => g.receiver === stakeholderId);
    const givenAccepted = given.filter(g => g.status === 'accepted');
    const receivedAccepted = received.filter(g => g.status === 'accepted');
    const declined = given.filter(g => g.status === 'declined');

    observations.push({
      type: 'giving',
      text: `${name} contributed ${given.length} exchanges, received ${received.length}`
    });

    if (givenAccepted.length > 0 || receivedAccepted.length > 0) {
      observations.push({
        type: 'acceptance',
        text: `Accepted: ${givenAccepted.length} outgoing, ${receivedAccepted.length} incoming`
      });
    }

    if (declined.length > 0) {
      observations.push({
        type: 'declined',
        text: `${declined.length} contributions from ${name} were declined`
      });
    }

    // Silence — no activity in the last 14 days
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentActivity = exchanges.filter(g =>
      (g.giver === stakeholderId || g.receiver === stakeholderId) &&
      new Date(g.offeredAt || g.createdAt).getTime() > twoWeeksAgo
    );
    if (recentActivity.length === 0 && (given.length > 0 || received.length > 0)) {
      observations.push({
        type: 'silence',
        text: `${name} has been inactive for more than 2 weeks`
      });
    }

    // Reciprocity
    const gratitude = this.engine.gratitude;
    if (gratitude) {
      const mutualPairs = gratitude.getMutualPairs();
      const hasMutual = mutualPairs.some(p => p.persons[0] === stakeholderId || p.persons[1] === stakeholderId);
      if (!hasMutual && given.length > 2) {
        observations.push({
          type: 'mutuality',
          text: `No mutual reciprocity links with anyone`
        });
      }
    }

    // Impersonal — all exchanges to 'all' (no specific receiver)
    const impersonal = given.filter(g => !g.receiver || g.receiver === 'all');
    if (impersonal.length > 0 && impersonal.length === given.length && given.length > 2) {
      observations.push({
        type: 'impersonal',
        text: `All contributions are broadcast (no specific recipient)`
      });
    }

    // Questions
    if (received.length > given.length * 3 && received.length > 3) {
      questions.push(`${name} receives significantly more than contributes. Is support needed?`);
    }
    if (given.length > received.length * 3 && given.length > 3) {
      questions.push(`${name} contributes significantly more than receives. Risk of burnout?`);
    }
    if (impersonal.length === given.length && given.length > 2) {
      questions.push(`All contributions are broadcast. Is there an opportunity for targeted engagement?`);
    }
    if (declined.length > givenAccepted.length && declined.length > 2) {
      questions.push(`Most contributions from ${name} were declined. What is behind this?`);
    }

    return { observations, questions };
  }

  _observeNetwork() {
    const observations = [];
    const questions = [];
    const exchanges = this.engine.gifts || [];
    const stakeholders = this.engine.persons;

    const totalStakeholders = stakeholders.count();
    const totalExchanges = exchanges.length;
    const accepted = exchanges.filter(g => g.status === 'accepted').length;
    const declined = exchanges.filter(g => g.status === 'declined').length;
    const offered = exchanges.filter(g => g.status === 'offered').length;

    observations.push({
      type: 'community',
      text: `Network: ${totalStakeholders} stakeholders, ${totalExchanges} exchanges (${accepted} accepted, ${declined} declined, ${offered} pending)`
    });

    // Active contributors
    const givers = new Set(exchanges.map(g => g.giver));
    const receivers = new Set(exchanges.filter(g => g.receiver && g.receiver !== 'all').map(g => g.receiver));
    const onlyGivers = [...givers].filter(g => !receivers.has(g));
    const onlyReceivers = [...receivers].filter(r => !givers.has(r));

    if (onlyGivers.length > 0) {
      const names = onlyGivers.map(id => stakeholders.get(id)?.name || id).join(', ');
      observations.push({
        type: 'asymmetry',
        text: `Only contributing (not receiving): ${names}`
      });
    }
    if (onlyReceivers.length > 0) {
      const names = onlyReceivers.map(id => stakeholders.get(id)?.name || id).join(', ');
      observations.push({
        type: 'asymmetry',
        text: `Only receiving (not contributing): ${names}`
      });
    }

    // Reciprocity density
    const gratitude = this.engine.gratitude;
    if (gratitude) {
      const density = gratitude.density();
      if (density < 0.1 && totalStakeholders > 2) {
        observations.push({
          type: 'gratitude',
          text: `Reciprocity density is low — few mutual connections`
        });
      }
    }

    // Silence in the network
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentExchanges = exchanges.filter(g => new Date(g.offeredAt || g.createdAt).getTime() > oneWeekAgo);
    if (recentExchanges.length === 0 && totalExchanges > 0) {
      observations.push({
        type: 'silence',
        text: `No new value exchanges in the last week`
      });
    }

    // Questions
    if (declined > accepted && totalExchanges > 5) {
      questions.push('More exchanges declined than accepted. What blocks acceptance?');
    }
    if (offered > accepted + declined && offered > 3) {
      questions.push('Many exchanges await response. Is the network stalled?');
    }
    if (totalStakeholders > 3 && givers.size <= 1) {
      questions.push('Only one stakeholder is contributing. Network is passive?');
    }

    return { observations, questions };
  }
}

export default PatternObserver;

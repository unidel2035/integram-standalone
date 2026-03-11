<template>
  <FstPageLayout>
    <template #header>
      <div class="sc-title-group">
        <span class="sc-live-dot" />
        <span class="sc-title">Школа агентов</span>
        <span class="sc-sep">·</span>
        <span class="sc-sub">тренировка прогностики на рынках предсказаний</span>
      </div>
    </template>

    <!-- Metrics strip -->
    <div class="sc-metrics fst-metrics-strip">
      <div class="fst-metric-item" v-for="s in globalStats" :key="s.label">
        <i :class="s.icon" class="fst-metric-item-icon" :style="s.color ? { color: s.color } : {}"></i>
        <div class="fst-metric-item-val">{{ s.value }}</div>
        <div class="fst-metric-item-label">{{ s.label }}</div>
      </div>
    </div>

    <div class="sc-content">

      <!-- Tab switcher -->
      <SelectButton v-model="activeTab" :options="tabs" optionValue="id" :allowEmpty="false" size="small" class="sc-tabs">
        <template #option="slotProps">
          <i :class="slotProps.option.icon" />
          {{ slotProps.option.label }}
          <span v-if="tabBadge[slotProps.option.id]" class="sc-tab-badge">{{ tabBadge[slotProps.option.id] }}</span>
        </template>
      </SelectButton>

      <!-- ── Tab: Leaderboard ── -->
      <div v-if="activeTab === 'leaderboard'" class="tab-content">
        <div class="leaderboard-grid">
          <div v-for="(agent, idx) in rankedAgents" :key="agent.id"
            :class="['agent-card', `rank-${idx + 1}`]"
            :style="{ '--agent-color': agent.color }">
            <div class="agent-rank">{{ idx + 1 }}</div>
            <div class="agent-avatar">{{ agent.avatar }}</div>
            <div class="agent-info">
              <div class="agent-name">{{ agent.name }}</div>
              <div class="agent-algo">{{ agent.algorithm }}</div>
            </div>
            <div class="agent-metrics">
              <div class="metric" :class="brierClass(agent.stats?.avgBrier)">
                <span class="m-val">{{ agent.stats?.avgBrier?.toFixed(3) ?? '—' }}</span>
                <span class="m-lbl">Brier ↓</span>
              </div>
              <div class="metric">
                <span class="m-val">{{ agent.stats?.accuracy ?? '—' }}%</span>
                <span class="m-lbl">Точность</span>
              </div>
              <div class="metric">
                <span class="m-val">{{ agent.stats?.total ?? 0 }}</span>
                <span class="m-lbl">Ставок</span>
              </div>
              <div class="metric skill" :class="skillClass(agent.stats?.brierSkill)">
                <span class="m-val">{{ agent.stats?.brierSkill != null ? agent.stats.brierSkill + '%' : '—' }}</span>
                <span class="m-lbl">Skill</span>
              </div>
            </div>
            <div class="agent-spark">
              <div class="spark-bar" v-for="(b, i) in (agent.stats?.recentBriers || [])" :key="i"
                :style="{ height: Math.round(b * 200) + '%', background: brierColor(b) }" />
            </div>
            <Button
              :label="predicting === agent.id ? 'Думает...' : 'Предсказать'"
              :icon="predicting === agent.id ? 'pi pi-spin pi-spinner' : 'pi pi-play'"
              :disabled="predicting === agent.id"
              size="small"
              @click="quickPredict(agent)"
              :pt="{ root: { style: { background: 'var(--agent-color, var(--p-primary-color))', borderColor: 'var(--agent-color, var(--p-primary-color))' } } }"
            />
          </div>
        </div>
      </div>

      <!-- ── Tab: Markets ── -->
      <div v-if="activeTab === 'markets'" class="tab-content">
        <div class="markets-toolbar">
          <SelectButton v-model="marketFilter" :options="marketSources" optionLabel="label" optionValue="value" size="small" />
          <Button
            icon="pi pi-refresh"
            :loading="loadingMarkets"
            severity="secondary"
            size="small"
            outlined
            @click="loadMarkets"
            class="sc-refresh-btn"
          />
        </div>

        <div class="markets-grid">
          <div v-for="m in filteredMarkets" :key="m.id" class="market-card">
            <div class="market-platform">
              <span :class="platformIcon(m.platform)" />
              {{ m.platform }}
              <span class="market-cat">{{ m.category }}</span>
            </div>
            <div class="market-title">{{ m.title }}</div>
            <div class="market-prob-bar">
              <div class="prob-fill" :style="{ width: m.probability + '%', background: probColor(m.probability) }" />
            </div>
            <div class="market-meta">
              <span class="market-prob">{{ m.probability }}% YES</span>
              <span v-if="m.closeTime" class="market-close">
                до {{ new Date(m.closeTime).toLocaleDateString('ru') }}
              </span>
            </div>
            <div class="market-agent-preds" v-if="marketPredictions[m.id]?.length">
              <div v-for="p in marketPredictions[m.id]" :key="p.agentId"
                class="mini-pred" :title="p.reasoning">
                <span class="mini-avatar">{{ agentById(p.agentId)?.avatar }}</span>
                <span :class="['mini-prob', p.probability > 50 ? 'bull' : 'bear']">{{ p.probability }}%</span>
              </div>
            </div>
            <div class="market-actions">
              <Button label="Турнир агентов" icon="pi pi-chart-scatter" text size="small" @click="selectMarket(m)" />
              <Button v-if="m.url" as="a" :href="m.url" target="_blank" label="Открыть" icon="pi pi-external-link" text size="small" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tab: Crypto Live ── -->
      <div v-if="activeTab === 'crypto'" class="tab-content">
        <div class="sc-tab-header">
          <div class="sc-section-label"><i class="pi pi-bitcoin"></i> Крипто-трекер предсказаний</div>
          <Button
            icon="pi pi-refresh"
            label="Цены"
            :loading="loadingCrypto"
            severity="secondary"
            size="small"
            outlined
            @click="loadCrypto"
          />
        </div>
        <div class="crypto-grid">
          <div v-for="coin in cryptoPrices" :key="coin.id" class="coin-card">
            <div class="coin-header">
              <span class="coin-symbol">{{ coin.symbol?.toUpperCase() }}</span>
              <span class="coin-name">{{ coin.name }}</span>
            </div>
            <div class="coin-price">${{ coin.current_price?.toLocaleString() }}</div>
            <div class="coin-changes">
              <span :class="['change', coin.price_change_percentage_24h > 0 ? 'up' : 'down']">
                24h: {{ coin.price_change_percentage_24h?.toFixed(2) }}%
              </span>
              <span :class="['change', (coin.price_change_percentage_7d_in_currency || 0) > 0 ? 'up' : 'down']">
                7d: {{ (coin.price_change_percentage_7d_in_currency || 0).toFixed(2) }}%
              </span>
            </div>
            <div class="coin-forecasts">
              <div v-if="coinForecasts[coin.id]?.length" class="forecast-list">
                <div v-for="f in coinForecasts[coin.id]" :key="f.agentId" class="forecast-row">
                  <span class="f-avatar">{{ agentById(f.agentId)?.avatar }}</span>
                  <span class="f-name">{{ agentById(f.agentId)?.shortName }}</span>
                  <span :class="['f-pred', f.probability > 50 ? 'bull' : 'bear']">
                    {{ f.probability }}% ↑
                  </span>
                  <span class="f-conf" :title="f.reasoning">{{ f.confidence }}% увер.</span>
                </div>
              </div>
              <Button v-else
                :label="tourney === coin.id ? 'Анализ...' : 'Предсказать всеми агентами'"
                :icon="tourney === coin.id ? 'pi pi-spin pi-spinner' : 'pi pi-bolt'"
                :disabled="tourney === coin.id"
                text size="small"
                @click="runCoinTournament(coin)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tab: History ── -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div class="history-filters">
          <Select
            v-model="historyAgent"
            :options="agentSelectOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="sc-filter-select"
          />
          <Select
            v-model="historyStatus"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="sc-filter-select"
          />
          <Select
            v-model="historyCategory"
            :options="categoryOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="sc-filter-select"
          />
        </div>

        <div class="predictions-table">
          <div class="pred-header">
            <span>Агент</span><span>Предсказание</span><span>Алгоритм</span>
            <span>Ставка</span><span>Исход</span><span>Brier</span><span>Статус</span>
          </div>
          <div v-if="filteredHistory.length === 0" class="no-data">
            Нет предсказаний. Запустите агентов на рынках!
          </div>
          <div v-for="p in filteredHistory" :key="p._id" class="pred-row">
            <span class="pred-agent">
              <span class="agent-av">{{ agentById(p.agentId)?.avatar }}</span>
              {{ agentById(p.agentId)?.shortName }}
            </span>
            <span class="pred-title" :title="p.reasoning">{{ p.title }}</span>
            <span class="pred-algo">{{ p.algorithm }}</span>
            <span class="pred-prob">{{ p.probability }}%</span>
            <span class="pred-outcome">{{ p.actualOutcome || '?' }}%</span>
            <span class="pred-brier" :class="brierClass(p.brierScore)">
              {{ p.brierScore ? p.brierScore.toFixed(3) : '—' }}
            </span>
            <span :class="['pred-status', p.status]">
              {{ { open: '⏳', correct: '✓', wrong: '✗', resolved: '•' }[p.status] || '?' }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── Tab: Calculators Playground ── -->
      <div v-if="activeTab === 'calculators'" class="tab-content">
        <div class="calc-intro">
          <div class="calc-intro-body">
            <div class="sc-section-label"><i class="pi pi-calculator"></i> Верифицируемые калькуляторы</div>
            <p class="calc-intro-desc">Агенты вызывают эти калькуляторы <strong>до</strong> запроса к AI. Числа считаются реальными формулами — AI только интерпретирует результат. Проверьте сами теми же входными данными.</p>
          </div>
          <Button
            as="a"
            href="https://github.com/unidel2035/fund/blob/main/backend/calc.mjs"
            target="_blank"
            label="Исходный код"
            icon="pi pi-github"
            size="small"
            text
          />
        </div>

        <div class="calc-grid">
          <!-- Bayesian -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">📊</span>
              <div>
                <div class="calc-name">Байесовский обновитель</div>
                <div class="calc-formula">P(H|E) = P(E|H) × P(H) / P(E)</div>
              </div>
            </div>
            <div class="calc-inputs">
              <label class="calc-label">Приор P₀ (%)
                <Slider v-model="calc.bayesian.prior" :min="1" :max="99" class="calc-slider" />
                <span>{{ calc.bayesian.prior }}%</span>
              </label>
              <div class="calc-signals">
                <div v-for="(sig, i) in calc.bayesian.signals" :key="i" class="calc-signal-row">
                  <InputText v-model="sig.label" placeholder="Сигнал" size="small" class="calc-input-text" />
                  <Slider v-model="sig.likelihood" :min="0.05" :max="0.95" :step="0.05" class="calc-slider-sm" />
                  <span>{{ Math.round(sig.likelihood * 100) }}%</span>
                </div>
              </div>
            </div>
            <Button label="Считать" :icon="calcLoading.bayesian ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.bayesian" size="small" @click="runCalc('bayesian')" />
            <div v-if="calcResults.bayesian" class="calc-result">
              <div class="calc-result-main">{{ calcResults.bayesian.prior }}% → <strong>{{ calcResults.bayesian.posterior }}%</strong></div>
              <div v-for="s in calcResults.bayesian.steps" :key="s.label" class="calc-step">
                {{ s.label }}: {{ s.probability }}%
              </div>
              <div v-if="calcResults.bayesian.planningFallacyWarning" class="calc-warn">⚠ Planning Fallacy — слишком уверенный прогноз</div>
            </div>
          </div>

          <!-- DCF -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">💰</span>
              <div>
                <div class="calc-name">DCF + IRR</div>
                <div class="calc-formula">NPV = Σ CFₜ / (1+r)ᵗ + TV/(1+r)ⁿ</div>
              </div>
            </div>
            <div class="calc-inputs">
              <label class="calc-label">WACC (%) <InputNumber v-model="calc.dcf.wacc" :min="5" :max="60" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
              <label class="calc-label">CF год 1-5 (тыс.руб)</label>
              <div class="calc-flows">
                <InputNumber v-for="(_, i) in calc.dcf.flows" :key="i" v-model="calc.dcf.flows[i]" :showButtons="false" size="small" inputClass="calc-input-num-sm" />
              </div>
            </div>
            <Button label="Считать" :icon="calcLoading.dcf ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.dcf" size="small" @click="runCalc('dcf')" />
            <div v-if="calcResults.dcf" class="calc-result">
              <div class="calc-result-main">NPV: <strong>{{ calcResults.dcf.npv.toLocaleString() }}</strong> тыс.</div>
              <div>Терминальная стоимость: {{ calcResults.dcf.pvTerminalValue.toLocaleString() }} ({{ calcResults.dcf.tvShare }}% от итого)</div>
              <div>Итого: <strong>{{ calcResults.dcf.totalValue.toLocaleString() }}</strong> тыс.</div>
            </div>
            <div v-if="calcResults.irr" class="calc-result">
              <div>IRR: <strong :class="calcResults.irr.irr > 20 ? 'good' : 'ok'">{{ calcResults.irr.irr }}%</strong>
                {{ calcResults.irr.converged ? '✓' : '⚠ не сошлось' }}
              </div>
            </div>
          </div>

          <!-- Kelly -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">🎯</span>
              <div>
                <div class="calc-name">Kelly Criterion</div>
                <div class="calc-formula">f* = (p×b − q) / b</div>
              </div>
            </div>
            <div class="calc-inputs">
              <label class="calc-label">P(выигрыш) (%) <Slider v-model="calc.kelly.p" :min="1" :max="99" class="calc-slider" /> <span>{{ calc.kelly.p }}%</span></label>
              <label class="calc-label">Коэф. выплаты b <InputNumber v-model="calc.kelly.b" :min="0.1" :max="10" :step="0.1" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
            </div>
            <Button label="Считать" :icon="calcLoading.kelly ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.kelly" size="small" @click="runCalc('kelly')" />
            <div v-if="calcResults.kelly" class="calc-result">
              <div class="calc-result-main">Kelly full: <strong>{{ calcResults.kelly.kellyFull }}%</strong></div>
              <div>Дробный (×0.5): <strong>{{ calcResults.kelly.kellyFractional }}%</strong> от капитала</div>
              <div :class="calcResults.kelly.positive ? 'good' : 'bad'">{{ calcResults.kelly.recommendation }}</div>
            </div>
          </div>

          <!-- Monte Carlo VaR -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">🎲</span>
              <div>
                <div class="calc-name">Monte Carlo VaR</div>
                <div class="calc-formula">10 000 симуляций Box-Muller</div>
              </div>
            </div>
            <div class="calc-inputs">
              <label class="calc-label">Волатильность σ (%) <Slider v-model="calc.var.sigma" :min="5" :max="120" class="calc-slider" /> <span>{{ calc.var.sigma }}%</span></label>
              <label class="calc-label">Горизонт (дней) <InputNumber v-model="calc.var.horizon" :min="1" :max="252" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
            </div>
            <Button label="Считать" :icon="calcLoading.var ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.var" size="small" @click="runCalc('var')" />
            <div v-if="calcResults.var" class="calc-result">
              <div class="calc-result-main">VaR(95%): <strong class="bad">{{ calcResults.var.var95 }}%</strong></div>
              <div>VaR(99%): {{ calcResults.var.var99 }}% | CVaR: {{ calcResults.var.cvar }}%</div>
              <div>Медиана: {{ calcResults.var.median }}% за {{ calc.var.horizon }}д</div>
            </div>
          </div>

          <!-- Black-Scholes -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">🌳</span>
              <div>
                <div class="calc-name">Black-Scholes / Real Options</div>
                <div class="calc-formula">C = S·N(d₁) − K·e⁻ʳᵀ·N(d₂)</div>
              </div>
            </div>
            <div class="calc-inputs">
              <label class="calc-label">S (стоимость проекта) <InputNumber v-model="calc.bs.S" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
              <label class="calc-label">K (инвестиция) <InputNumber v-model="calc.bs.K" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
              <label class="calc-label">T (лет) <InputNumber v-model="calc.bs.T" :step="0.5" :showButtons="false" size="small" inputClass="calc-input-num" /></label>
              <label class="calc-label">σ (%) <Slider v-model="calc.bs.sigma" :min="5" :max="100" class="calc-slider" /> <span>{{ calc.bs.sigma }}%</span></label>
            </div>
            <Button label="Считать" :icon="calcLoading.blackscholes ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.blackscholes" size="small" @click="runCalc('blackscholes')" />
            <div v-if="calcResults.blackscholes" class="calc-result">
              <div class="calc-result-main">Стоимость опциона: <strong>{{ calcResults.blackscholes.callValue }}</strong></div>
              <div>P(исполнения): <strong>{{ calcResults.blackscholes.impliedProbability }}%</strong></div>
              <div>Delta: {{ calcResults.blackscholes.delta }} | d1={{ calcResults.blackscholes.d1 }}</div>
            </div>
          </div>

          <!-- Nash -->
          <div class="calc-card">
            <div class="calc-card-header">
              <span class="calc-icon">♟️</span>
              <div>
                <div class="calc-name">Nash Equilibrium</div>
                <div class="calc-formula">Стабильность ≥ 80% = Nash достигнут</div>
              </div>
            </div>
            <div class="calc-inputs">
              <div v-for="(val, key) in calc.nash.votes" :key="key" class="calc-signal-row">
                <span class="calc-signal-label">{{ key }}</span>
                <Slider v-model="calc.nash.votes[key]" :min="0.01" :max="0.99" :step="0.01" class="calc-slider-sm" />
                <span>{{ Math.round(calc.nash.votes[key] * 100) }}%</span>
              </div>
            </div>
            <Button label="Считать" :icon="calcLoading.nash ? 'pi pi-spin pi-spinner' : 'pi pi-play'" :disabled="calcLoading.nash" size="small" @click="runCalc('nash')" />
            <div v-if="calcResults.nash" class="calc-result">
              <div class="calc-result-main" :class="calcResults.nash.isNash ? 'good' : 'ok'">
                Nash: {{ calcResults.nash.isNash ? '✓ Достигнут' : '✗ Не достигнут' }}
              </div>
              <div>Консенсус: {{ calcResults.nash.consensus }} ({{ calcResults.nash.majorityShare }}%)</div>
              <div>Schelling point: {{ calcResults.nash.schellingPoint }}%</div>
              <div v-if="calcResults.nash.unstableAgents.length">Нестабильны: {{ calcResults.nash.unstableAgents.join(', ') }}</div>
            </div>
          </div>
        </div>

        <!-- Audit Trail Section -->
        <div class="audit-section">
          <div class="sc-section-label"><i class="pi pi-history"></i> Аудит-след последних предсказаний агентов</div>
          <p class="audit-desc">Каждое предсказание включает реальный вызов калькулятора. Ниже — последние 10 с входными данными и результатами.</p>
          <div v-if="!auditPredictions.length" class="no-data">Запустите агентов — здесь появится аудит-след</div>
          <div v-for="p in auditPredictions" :key="p._id" class="audit-row">
            <div class="audit-agent">
              <span>{{ agentById(p.agentId)?.avatar }}</span>
              <span>{{ agentById(p.agentId)?.shortName }}</span>
            </div>
            <div class="audit-market">{{ p.title }}</div>
            <div class="audit-prediction">{{ p.probability }}% YES</div>
            <div v-if="p.calcAudit" class="audit-calc">
              <span class="audit-calc-name">{{ p.calcAudit.name }}</span>
              <span class="audit-calc-summary">{{ p.calcAudit.summary }}</span>
            </div>
            <div v-else class="audit-no-calc">без калькулятора (старое предсказание)</div>
          </div>
        </div>
      </div>

    </div><!-- /sc-content -->

    <!-- Tournament Dialog (PrimeVue) -->
    <Dialog v-model:visible="showTournament" modal
      :header="`Турнир агентов: ${selectedMarket?.title || ''}`"
      :style="{ width: '700px', maxWidth: '95vw' }"
      :closable="!tournamentRunning">

      <!-- Pipeline: процесс работы агентов -->
      <div v-if="tournamentRunning" style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="a in agents" :key="a.id"
          style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--p-content-border-color)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:1.1rem">{{ a.avatar }}</span>
            <span style="font-size:0.8rem;font-weight:600">{{ a.shortName || a.name.split(' ')[0] }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;">
            <div :style="pipelineNodeStyle(a.id, 'integram', 'var(--fst-blue)')">
              <span>🗄</span><span style="font-size:0.65rem">Integram</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:0;min-width:44px;">
              <span style="font-size:0.55rem;color:var(--p-text-muted-color);white-space:nowrap">данные рынка</span>
              <span style="color:var(--p-text-muted-color);font-size:1rem;line-height:1">──›</span>
            </div>
            <div :style="pipelineNodeStyle(a.id, 'calc', 'var(--fst-brand)')">
              <i v-if="nodeState(a.id,'calc')==='active'" class="pi pi-spin pi-spinner" style="font-size:0.75rem" />
              <span v-else>🧮</span>
              <span style="font-size:0.65rem">{{ agentFlows[a.id]?.calcName || 'Calc' }}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:0;min-width:44px;">
              <span style="font-size:0.55rem;color:var(--p-text-muted-color);white-space:nowrap">расчёты</span>
              <span style="color:var(--p-text-muted-color);font-size:1rem;line-height:1">──›</span>
            </div>
            <div :style="pipelineNodeStyle(a.id, 'llm', 'var(--fst-purple)')">
              <i v-if="nodeState(a.id,'llm')==='active'" class="pi pi-spin pi-spinner" style="font-size:0.75rem" />
              <span v-else>🤖</span>
              <span style="font-size:0.65rem">
                {{ agentFlows[a.id]?.probability ? agentFlows[a.id].probability + '%' : 'DeepSeek' }}
              </span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:0;min-width:44px;">
              <span style="font-size:0.55rem;color:var(--p-text-muted-color);white-space:nowrap">предсказание</span>
              <span style="color:var(--p-text-muted-color);font-size:1rem;line-height:1">──›</span>
            </div>
            <div :style="pipelineNodeStyle(a.id, 'save', 'var(--fst-green)')">
              <i v-if="nodeState(a.id,'save')==='active'" class="pi pi-spin pi-spinner" style="font-size:0.75rem" />
              <span v-else>💾</span>
              <span style="font-size:0.65rem">Integram</span>
            </div>
          </div>
          <div v-if="agentFlows[a.id]?.calcSummary"
            style="font-size:0.68rem;color:var(--p-text-muted-color);font-family:monospace;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            {{ agentFlows[a.id].calcSummary }}
          </div>
        </div>
      </div>

      <!-- Результаты турнира -->
      <div v-else-if="tournamentResults.length" style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="r in tournamentResults" :key="r.agent.id"
          style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;border:1px solid var(--p-content-border-color)">
          <span style="font-size:1.2rem">{{ r.agent.avatar }}</span>
          <span style="min-width:80px;font-size:0.82rem;font-weight:600;color:var(--p-text-color)">{{ r.agent.name }}</span>
          <div style="flex:1;height:8px;background:var(--p-content-border-color);border-radius:4px;overflow:hidden">
            <div :style="{ width: r.prediction.probability + '%', height:'100%', background: probColor(r.prediction.probability), transition:'width 0.5s' }" />
          </div>
          <span style="min-width:52px;font-weight:700;font-size:0.88rem" :style="{ color: probColor(r.prediction.probability) }">{{ r.prediction.probability }}% YES</span>
          <span style="font-size:0.75rem;color:var(--p-text-muted-color)">conf:{{ r.prediction.confidence }}%</span>
          <Button text size="small" :icon="expandedResult === r.agent.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            @click="expandedResult = expandedResult === r.agent.id ? null : r.agent.id" />
          <div v-if="r.prediction.calcAudit" style="width:100%;font-size:0.72rem;color:var(--p-text-muted-color);font-family:monospace;margin-top:4px">
            🧮 {{ r.prediction.calcAudit.name }}: {{ r.prediction.calcAudit.summary }}
          </div>
        </div>
        <div v-if="expandedResult" style="padding:12px;background:var(--p-surface-card);border-radius:8px;font-size:0.82rem;color:var(--p-text-color)">
          {{ tournamentResults.find(r => r.agent.id === expandedResult)?.prediction.reasoning }}
        </div>
        <!-- Агрегат -->
        <div style="margin-top:8px;padding:12px;background:var(--p-surface-card);border-radius:8px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:0.75rem;color:var(--p-text-muted-color)">Медиана</div>
            <div style="font-size:1.4rem;font-weight:700" :style="{ color: probColor(medianPrediction) }">{{ medianPrediction }}% YES</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--p-text-muted-color)">Разброс</div>
            <div style="font-size:0.88rem">{{ spreadPrediction }}% — {{ spreadMax }}%</div>
          </div>
          <div v-if="nashResult">
            <div style="font-size:0.75rem;color:var(--p-text-muted-color)">Nash</div>
            <div style="font-size:0.82rem">{{ nashResult.isNash ? '✓ Достигнут' : '⚠ Нет консенсуса' }}</div>
          </div>
        </div>
        <Button label="Сохранить все предсказания" icon="pi pi-database" @click="saveAllPredictions" style="margin-top:8px" />
      </div>

      <!-- Кнопка запуска (footer slot) -->
      <template v-if="!tournamentRunning && !tournamentResults.length" #footer>
        <Button label="Запустить турнир агентов" icon="pi pi-bolt" @click="startTournament" />
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted, nextTick } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { AGENTS } from '@/components/fst-committee/FstCommitteeConfig.js'
import {
  fetchManifoldMarkets, fetchMetaculusQuestions,
  buildCryptoMarkets, fetchCryptoPrices,
  savePrediction, loadPredictions, computeAgentStats,
} from '@/components/fst-school/fstPredictionService.js'
import {
  generatePrediction, runAgentTournament,
} from '@/components/fst-school/fstAgentPredictionEngine.js'
import { checkNashEquilibrium } from '@/components/fst-committee/fstAgentConfigService.js'

// ── State ─────────────────────────────────────────────────────────────────────

const activeTab = ref('leaderboard')
const agents = ref(AGENTS)
const allPredictions = ref([])
const agentStats = ref({})
const markets = ref([])
const cryptoPrices = ref([])
const cryptoMarkets = ref([])
const coinForecasts = ref({})
const marketPredictions = ref({})
const marketFilter = ref('all')
const historyAgent = ref('')
const historyStatus = ref('')
const historyCategory = ref('')

// ── Pipeline animation state ───────────────────────────────────────────────────
const agentFlows = ref({})

function _setFlow(agentId, update) {
  agentFlows.value = {
    ...agentFlows.value,
    [agentId]: { ...(agentFlows.value[agentId] || {}), ...update },
  }
}

// ── Calculator Playground state ───────────────────────────────────────────────
const calc = reactive({
  bayesian: { prior: 30, signals: [
    { label: 'Сильная команда', likelihood: 0.75 },
    { label: 'PMF найден', likelihood: 0.65 },
  ]},
  dcf: { wacc: 25, flows: [100, 200, 350, 500, 750] },
  kelly: { p: 60, b: 2.0 },
  var: { sigma: 45, horizon: 5 },
  bs: { S: 100, K: 120, T: 1.0, sigma: 50 },
  nash: { votes: { monte_carlo: 0.70, bayesian: 0.55, market_timing: 0.40, risk: 0.30 } },
})
const calcResults = reactive({})
const calcLoading = reactive({})

async function runCalc(tool) {
  calcLoading[tool] = true
  try {
    const body = _buildCalcBody(tool)
    const res = await fetch(`/api/calc/${tool}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.ok) calcResults[tool] = data.result
    if (tool === 'dcf') {
      const irrRes = await fetch('/api/calc/irr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashFlows: [-calc.dcf.flows[0] * 5, ...calc.dcf.flows] }),
      })
      const irrData = await irrRes.json()
      if (irrData.ok) calcResults.irr = irrData.result
    }
  } finally {
    calcLoading[tool] = false
  }
}

function _buildCalcBody(tool) {
  switch (tool) {
    case 'bayesian':    return { prior: calc.bayesian.prior / 100, signals: calc.bayesian.signals }
    case 'dcf':         return { cashFlows: calc.dcf.flows, wacc: calc.dcf.wacc / 100, terminalGrowth: 0.03 }
    case 'kelly':       return { p: calc.kelly.p / 100, b: calc.kelly.b, fraction: 0.5 }
    case 'var':         return { mu: 0.1, sigma: calc.var.sigma / 100, horizon: calc.var.horizon }
    case 'blackscholes':return { S: calc.bs.S, K: calc.bs.K, T: calc.bs.T, r: 0.05, sigma: calc.bs.sigma / 100 }
    case 'nash':        return { votes: calc.nash.votes }
    default:            return {}
  }
}

const auditPredictions = computed(() =>
  allPredictions.value
    .filter(p => p.calcAudit)
    .slice(-10)
    .reverse()
)

const loadingMarkets = ref(false)
const loadingCrypto = ref(false)
const predicting = ref(null)
const tourney = ref(null)
const showTournament = ref(false)
const selectedMarket = ref(null)
const tournamentRunning = ref(false)
const tournamentDone = ref({})
const tournamentResults = ref([])
const expandedResult = ref(null)

const tabs = [
  { id: 'leaderboard', label: 'Рейтинг агентов', icon: 'pi pi-trophy' },
  { id: 'markets', label: 'Рынки предсказаний', icon: 'pi pi-chart-scatter' },
  { id: 'crypto', label: 'Крипто', icon: 'pi pi-bitcoin' },
  { id: 'history', label: 'История', icon: 'pi pi-history' },
  { id: 'calculators', label: 'Калькуляторы', icon: 'pi pi-calculator' },
]

const marketSources = [
  { label: 'Все', value: 'all' },
  { label: '🎯 Manifold', value: 'manifold' },
  { label: '📊 Metaculus', value: 'metaculus' },
  { label: '₿ Крипто', value: 'crypto' },
]

const statusOptions = [
  { label: 'Все статусы', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'Верные ✓', value: 'correct' },
  { label: 'Неверные ✗', value: 'wrong' },
]

const categoryOptions = [
  { label: 'Все категории', value: '' },
  ...['crypto','startup','macro','tech','other'].map(c => ({ label: c, value: c }))
]

const agentSelectOptions = computed(() => [
  { label: 'Все агенты', value: '' },
  ...agents.value.map(a => ({ label: `${a.avatar} ${a.name}`, value: a.id }))
])

const tabBadge = computed(() => ({
  markets: markets.value.length || null,
  history: allPredictions.value.length || null,
}))

// ── Computed ──────────────────────────────────────────────────────────────────

const rankedAgents = computed(() => {
  return [...agents.value]
    .map(a => ({
      ...a,
      stats: agentStats.value[a.id] || null,
      algorithm: _algoName(a.id),
    }))
    .sort((a, b) => {
      const ba = a.stats?.avgBrier ?? 999
      const bb = b.stats?.avgBrier ?? 999
      if (ba !== bb) return ba - bb
      return (b.stats?.total || 0) - (a.stats?.total || 0)
    })
})

const filteredMarkets = computed(() => {
  if (marketFilter.value === 'all') return markets.value
  return markets.value.filter(m => m.platform === marketFilter.value)
})

const filteredHistory = computed(() => {
  return allPredictions.value.filter(p => {
    if (historyAgent.value && p.agentId !== historyAgent.value) return false
    if (historyStatus.value && p.status !== historyStatus.value) return false
    if (historyCategory.value && p.category !== historyCategory.value) return false
    return true
  })
})

const globalStats = computed(() => {
  const total = allPredictions.value.length
  const resolved = allPredictions.value.filter(p => p.status !== 'open').length
  const correct = allPredictions.value.filter(p => p.status === 'correct').length
  const allBriers = allPredictions.value.filter(p => p.brierScore > 0).map(p => p.brierScore)
  const avgBrier = allBriers.length ? (allBriers.reduce((s, b) => s + b, 0) / allBriers.length).toFixed(3) : '—'
  return [
    { label: 'Предсказаний', value: total, icon: 'pi pi-bolt', color: null },
    { label: 'Разрешено', value: resolved, icon: 'pi pi-check', color: null },
    { label: 'Верных', value: correct, icon: 'pi pi-check-circle', color: 'var(--fst-green)' },
    { label: 'Avg Brier', value: avgBrier, icon: 'pi pi-chart-bar', color: 'var(--fst-blue)' },
  ]
})

const medianPrediction = computed(() => {
  const probs = tournamentResults.value.map(r => r.prediction.probability).sort((a, b) => a - b)
  if (!probs.length) return 50
  const mid = Math.floor(probs.length / 2)
  return probs.length % 2 ? probs[mid] : Math.round((probs[mid - 1] + probs[mid]) / 2)
})
const spreadPrediction = computed(() => Math.min(...tournamentResults.value.map(r => r.prediction.probability)))
const spreadMax = computed(() => Math.max(...tournamentResults.value.map(r => r.prediction.probability)))
const nashResult = computed(() => {
  if (!tournamentResults.value.length) return null
  const votes = {}
  for (const r of tournamentResults.value) votes[r.agent.id] = r.prediction.probability / 100
  return checkNashEquilibrium(votes)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadHistory(), loadMarkets(), loadCrypto()])
})

async function loadHistory() {
  try {
    allPredictions.value = await loadPredictions()
    agentStats.value = computeAgentStats(allPredictions.value)
    const mmap = {}
    for (const p of allPredictions.value) {
      if (!mmap[p.marketId]) mmap[p.marketId] = []
      mmap[p.marketId].push(p)
    }
    marketPredictions.value = mmap
  } catch (e) {
    console.warn('loadHistory:', e.message)
  }
}

async function loadMarkets() {
  loadingMarkets.value = true
  try {
    const [manifold, metaculus, crypto] = await Promise.all([
      fetchManifoldMarkets('', 12),
      fetchMetaculusQuestions(6),
      buildCryptoMarkets(),
    ])
    markets.value = [...manifold, ...metaculus, ...crypto.slice(0, 6)]
  } finally {
    loadingMarkets.value = false
  }
}

async function loadCrypto() {
  loadingCrypto.value = true
  try {
    cryptoPrices.value = await fetchCryptoPrices()
    cryptoMarkets.value = await buildCryptoMarkets()
  } finally {
    loadingCrypto.value = false
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function quickPredict(agent) {
  predicting.value = agent.id
  try {
    const market = markets.value[Math.floor(Math.random() * markets.value.length)]
    if (!market) return
    const memory = allPredictions.value.filter(p => p.agentId === agent.id)
    const stats = agentStats.value[agent.id] || {}
    const pred = await generatePrediction(agent.id, market, memory, stats)
    await savePrediction(pred)
    await loadHistory()
    activeTab.value = 'history'
  } finally {
    predicting.value = null
  }
}

function selectMarket(market) {
  selectedMarket.value = market
  tournamentResults.value = []
  tournamentDone.value = {}
  showTournament.value = true
}

async function startTournament() {
  if (!selectedMarket.value) return
  tournamentRunning.value = true
  tournamentResults.value = []

  const initialFlows = {}
  for (const a of agents.value) {
    initialFlows[a.id] = { integram: 'idle', calc: 'idle', llm: 'idle', save: 'idle', calcName: null, calcSummary: null, probability: null }
    tournamentDone.value[a.id] = 'pending'
  }
  agentFlows.value = initialFlows

  const onStep = async ({ stage, agentId: aid, calcName, calcSummary, probability }) => {
    if (stage === 'integram') {
      _setFlow(aid, { integram: 'done' })
    } else if (stage === 'calc') {
      _setFlow(aid, { calc: 'active' })
    } else if (stage === 'calc_done') {
      _setFlow(aid, { calc: 'done', ...(calcName && { calcName }), ...(calcSummary && { calcSummary }) })
    } else if (stage === 'llm') {
      _setFlow(aid, { llm: 'active' })
    } else if (stage === 'done') {
      _setFlow(aid, { llm: 'done', probability, save: 'active' })
    } else if (stage === 'error') {
      _setFlow(aid, { llm: 'error' })
    }
    await nextTick()
  }

  try {
    for (const agent of agents.value) {
      const memory = allPredictions.value.filter(p => p.agentId === agent.id)
      const stats = agentStats.value[agent.id] || {}
      try {
        const pred = await generatePrediction(agent.id, selectedMarket.value, memory, stats, onStep)
        _setFlow(agent.id, { save: 'done' })
        tournamentDone.value[agent.id] = pred
        tournamentResults.value.push({ agent, prediction: pred })
      } catch {
        _setFlow(agent.id, { llm: 'error' })
        tournamentDone.value[agent.id] = { probability: '?' }
      }
      await new Promise(r => setTimeout(r, 200))
    }
  } finally {
    tournamentRunning.value = false
  }
}

async function saveAllPredictions() {
  for (const r of tournamentResults.value) {
    try { await savePrediction(r.prediction) } catch { /* skip */ }
  }
  await loadHistory()
  showTournament.value = false
}

async function runCoinTournament(coin) {
  tourney.value = coin.id
  try {
    const market = cryptoMarkets.value.find(m => m.coinId === coin.id && m.horizon === '24h')
    if (!market) return
    const results = []
    for (const agent of agents.value.slice(0, 6)) {
      try {
        const pred = await generatePrediction(agent.id, market, [], {})
        results.push(pred)
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 200))
    }
    coinForecasts.value[coin.id] = results
  } finally {
    tourney.value = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentById(id) { return agents.value.find(a => a.id === id) }
function nodeState(agentId, node) { return agentFlows.value[agentId]?.[node] || 'idle' }
function pipelineNodeStyle(agentId, node, cssVar) {
  const state = nodeState(agentId, node)
  const base = 'display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 7px;border-radius:6px;min-width:52px;border:1px solid;transition:all 0.3s;font-size:0.9rem;'
  if (state === 'done')   return base + `border-color:${cssVar};background:color-mix(in srgb,${cssVar} 13%,transparent);opacity:1;`
  if (state === 'active') return base + `border-color:${cssVar};background:color-mix(in srgb,${cssVar} 7%,transparent);opacity:1;`
  if (state === 'error')  return base + `border-color:var(--fst-red);background:color-mix(in srgb,var(--fst-red) 7%,transparent);opacity:1;`
  return base + 'border-color:transparent;opacity:0.3;background:transparent;'
}
function brierClass(b) { if (!b) return ''; return b < 0.1 ? 'good' : b < 0.2 ? 'ok' : 'bad' }
function skillClass(s) { if (s == null) return ''; return s > 30 ? 'good' : s > 0 ? 'ok' : 'bad' }
function brierColor(b) { return b < 0.1 ? 'var(--fst-green)' : b < 0.2 ? 'var(--fst-brand)' : 'var(--fst-red)' }
function probColor(p) { return p > 65 ? 'var(--fst-green)' : p < 35 ? 'var(--fst-red)' : 'var(--fst-brand)' }
function srcLabel(src) { return { all: 'Все', manifold: '🎯 Manifold', metaculus: '📊 Metaculus', crypto: '₿ Крипто' }[src] || src }
function platformIcon(p) { return p === 'crypto' ? 'pi pi-bitcoin' : 'pi pi-chart-scatter' }
function _algoName(id) {
  const map = {
    monte_carlo: 'Monte Carlo', bayesian: 'Bayesian', market_timing: 'Цикл Маркса',
    real_options: 'Real Options', power_score: '7 Powers', game_theory: 'Nash Theory',
    finance: 'DCF/IRR', risk: 'VaR/FMEA', tech: 'TRL/MRL',
    sovereignty: 'Geopolitics', portfolio: 'Portfolio Theory', devil: "Devil's Advocate",
  }
  return map[id] || id
}
</script>

<style scoped>
/* ── Header ── */
.sc-title-group { display: flex; align-items: center; gap: 8px; }
.sc-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--p-primary-color); flex-shrink: 0; animation: sc-pulse 2s infinite; }
@keyframes sc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.sc-title { font-size: 14px; font-weight: 600; color: var(--p-text-color); }
.sc-sep { color: var(--p-text-muted-color); }
.sc-sub { font-size: 0.82rem; color: var(--p-text-muted-color); font-weight: 400; }

/* ── Metrics flush ── */
.sc-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }

/* ── Content wrapper ── */
.sc-content { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }

/* ── Tabs ── */
.sc-tabs { flex-wrap: wrap; }
.sc-tab-badge {
  background: var(--p-primary-color); color: white; border-radius: 50%;
  font-size: 0.7rem; min-width: 18px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 3px; margin-left: 3px;
}

/* ── Section label ── */
.sc-section-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 6px;
}

/* ── Tab header (crypto, etc) ── */
.sc-tab-header { display: flex; justify-content: space-between; align-items: center; }

/* ── Leaderboard ── */
.leaderboard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.agent-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-left: 4px solid var(--agent-color, var(--p-text-muted-color));
  border-radius: 12px; padding: 14px; position: relative;
  display: flex; flex-direction: column; gap: 10px;
}
.rank-1 { box-shadow: 0 0 20px color-mix(in srgb, var(--fst-brand) 30%, transparent); }
.rank-2 { box-shadow: 0 0 15px color-mix(in srgb, var(--p-text-muted-color) 30%, transparent); }
.rank-3 { box-shadow: 0 0 10px color-mix(in srgb, var(--fst-brand-dark) 30%, transparent); }
.agent-rank { position: absolute; top: 10px; right: 10px; font-size: 1.2rem; font-weight: 700; opacity: 0.5; }
.agent-avatar { font-size: 2rem; }
.agent-name { font-weight: 700; font-size: 1rem; }
.agent-algo { font-size: 0.75rem; color: var(--p-text-muted-color); }
.agent-metrics { display: flex; gap: 6px; flex-wrap: wrap; }
.metric { display: flex; flex-direction: column; align-items: center; min-width: 52px; }
.m-val { font-size: 1rem; font-weight: 700; }
.m-lbl { font-size: 0.65rem; color: var(--p-text-muted-color); }
.metric.good .m-val, .skill.good .m-val { color: var(--fst-green); }
.metric.ok .m-val, .skill.ok .m-val { color: var(--fst-brand); }
.metric.bad .m-val, .skill.bad .m-val { color: var(--fst-red); }
.agent-spark { display: flex; align-items: flex-end; height: 24px; gap: 2px; }
.spark-bar { width: 6px; border-radius: 2px; min-height: 2px; transition: height 0.3s; }

/* ── Markets ── */
.markets-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sc-refresh-btn { margin-left: auto; }
.markets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.market-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
}
.market-platform { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--p-text-muted-color); }
.market-cat {
  margin-left: auto; background: color-mix(in srgb, var(--p-text-color) 6%, transparent);
  border-radius: 4px; padding: 1px 6px; font-size: 0.7rem;
}
.market-title { font-weight: 600; font-size: 0.875rem; line-height: 1.3; }
.market-prob-bar { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.prob-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.market-meta { display: flex; justify-content: space-between; font-size: 0.8rem; }
.market-close { color: var(--p-text-muted-color); }
.market-agent-preds { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-pred { display: flex; align-items: center; gap: 3px; font-size: 0.8rem; }
.mini-prob.bull { color: var(--fst-green); }
.mini-prob.bear { color: var(--fst-red); }
.market-actions { display: flex; gap: 4px; }

/* ── Crypto ── */
.crypto-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.coin-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
}
.coin-header { display: flex; align-items: center; gap: 8px; }
.coin-symbol { font-weight: 800; font-size: 1.1rem; }
.coin-name { color: var(--p-text-muted-color); font-size: 0.85rem; }
.coin-price { font-size: 1.6rem; font-weight: 700; }
.coin-changes { display: flex; gap: 10px; }
.change { font-size: 0.85rem; font-weight: 600; }
.change.up { color: var(--fst-green); }
.change.down { color: var(--fst-red); }
.forecast-list { display: flex; flex-direction: column; gap: 6px; }
.forecast-row { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; }
.f-avatar { font-size: 1rem; }
.f-name { flex: 1; color: var(--p-text-muted-color); }
.f-pred { font-weight: 700; }
.f-pred.bull { color: var(--fst-green); }
.f-pred.bear { color: var(--fst-red); }
.f-conf { color: var(--p-text-muted-color); font-size: 0.75rem; }

/* ── History ── */
.history-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.sc-filter-select { min-width: 160px; }
.predictions-table { display: flex; flex-direction: column; gap: 0; }
.pred-header, .pred-row {
  display: grid;
  grid-template-columns: 100px 1fr 140px 60px 60px 70px 60px;
  gap: 6px; padding: 7px 10px; align-items: center; font-size: 0.82rem;
}
.pred-header {
  background: color-mix(in srgb, var(--p-text-color) 4%, transparent);
  border-radius: 6px; font-weight: 600; color: var(--p-text-muted-color);
}
.pred-row { border-bottom: 1px solid var(--p-content-border-color); }
.pred-row:hover { background: color-mix(in srgb, var(--p-text-color) 3%, transparent); }
.pred-agent { display: flex; align-items: center; gap: 4px; }
.agent-av { font-size: 1.1rem; }
.pred-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pred-brier.good { color: var(--fst-green); }
.pred-brier.ok { color: var(--fst-brand); }
.pred-brier.bad { color: var(--fst-red); }
.pred-status.correct { color: var(--fst-green); }
.pred-status.wrong { color: var(--fst-red); }
.no-data { text-align: center; padding: 28px; color: var(--p-text-muted-color); font-size: 0.875rem; }

/* ── Calculators ── */
.calc-intro { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 4px; justify-content: space-between; }
.calc-intro-desc { margin: 6px 0 0; font-size: 0.85rem; color: var(--p-text-muted-color); }
.calc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.calc-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
}
.calc-card-header { display: flex; align-items: flex-start; gap: 10px; }
.calc-icon { font-size: 1.8rem; }
.calc-name { font-weight: 700; font-size: 0.95rem; }
.calc-formula { font-size: 0.75rem; color: var(--p-text-muted-color); font-family: monospace; }
.calc-inputs { display: flex; flex-direction: column; gap: 8px; }
.calc-label { font-size: 0.82rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.calc-slider { flex: 1; min-width: 80px; }
.calc-slider-sm { width: 80px; }
.calc-input-num { width: 70px !important; }
.calc-input-num-sm { width: 55px !important; }
.calc-input-text { flex: 1; }
.calc-signals { display: flex; flex-direction: column; gap: 4px; }
.calc-signal-row { display: flex; align-items: center; gap: 6px; }
.calc-signal-label { font-size: 0.8rem; min-width: 80px; color: var(--p-text-muted-color); }
.calc-flows { display: flex; gap: 4px; flex-wrap: wrap; }
.calc-result {
  background: color-mix(in srgb, var(--p-text-color) 4%, transparent);
  border-radius: 6px; padding: 10px; font-size: 0.82rem;
  display: flex; flex-direction: column; gap: 4px;
}
.calc-result-main { font-size: 1rem; font-weight: 600; }
.calc-step { color: var(--p-text-muted-color); }
.calc-warn { color: var(--fst-brand); font-weight: 600; }
.good { color: var(--fst-green); }
.ok  { color: var(--fst-brand); }
.bad { color: var(--fst-red); }

/* ── Audit trail ── */
.audit-section { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.audit-desc { color: var(--p-text-muted-color); font-size: 0.85rem; margin: 0; }
.audit-row {
  display: grid; grid-template-columns: 80px 1fr 70px 1fr;
  gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color);
  align-items: center; font-size: 0.82rem;
}
.audit-agent { display: flex; align-items: center; gap: 4px; font-weight: 600; }
.audit-market { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--p-text-muted-color); }
.audit-prediction { font-weight: 700; }
.audit-calc { display: flex; flex-direction: column; gap: 2px; }
.audit-calc-name { font-weight: 600; color: var(--p-primary-color); font-size: 0.78rem; }
.audit-calc-summary { color: var(--p-text-muted-color); font-size: 0.75rem; }
.audit-no-calc { color: var(--p-text-muted-color); font-style: italic; font-size: 0.78rem; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .predictions-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .sc-tabs { overflow-x: auto; flex-wrap: nowrap; }
  .leaderboard-grid, .markets-grid, .crypto-grid { grid-template-columns: 1fr; }
}
</style>

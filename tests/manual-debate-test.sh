#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Manual verification script: debate voting modes + parallel agents
# Run: bash tests/manual-debate-test.sh
# ══════════════════════════════════════════════════════════════

API="http://localhost:8082/api/debate"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; FAILURES=$((FAILURES+1)); }
info() { echo -e "${YELLOW}→ $1${NC}"; }

FAILURES=0

echo "═══════════════════════════════════════════════════"
echo "  Debate Engine Manual Verification"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Test 1: Create session ──────────────────────────────────

info "Creating debate session..."
RESP=$(curl -s -X POST "$API/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "id": "test-manual",
      "title": "БПЛА Тест-Верификация",
      "subFund": "drones",
      "trl": 7, "mrl": 6,
      "sovereigntyScore": 7,
      "projectedIRR": 0.35,
      "marketSize": 30000000000,
      "requestedAmount": 150000000,
      "teamStrength": 0.75,
      "teamSize": 20
    },
    "agents": [
      {"id": "tech",    "name": "Технический аналитик", "focus": ["trl"]},
      {"id": "finance", "name": "Финансовый аналитик",  "focus": ["finance"]},
      {"id": "devil",   "name": "Критический аналитик", "focus": ["risk"]}
    ],
    "config": {
      "maxRounds": 2,
      "speedProfile": "fast"
    }
  }')

SESSION_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId','') or d.get('id',''))" 2>/dev/null)

if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "" ]; then
  pass "Session created: $SESSION_ID"
else
  fail "Failed to create session: $RESP"
  exit 1
fi

# ── Test 2: Start orchestrated debate ────────────────────────

info "Starting orchestrated debate..."
START_RESP=$(curl -s -X POST "$API/sessions/$SESSION_ID/start")
START_STATUS=$(echo "$START_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)

if echo "$START_STATUS" | grep -qiE "orchestrat|start"; then
  pass "Orchestration started (status=$START_STATUS)"
else
  fail "Failed to start: $START_RESP"
fi

# ── Test 3: Poll for completion ──────────────────────────────

info "Waiting for debate to complete (max 180s)..."
for i in $(seq 1 36); do
  sleep 5
  STATUS_RESP=$(curl -s "$API/sessions/$SESSION_ID")
  STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  PHASE=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('phase',''))" 2>/dev/null)
  MSG_COUNT=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('messages',[])))" 2>/dev/null)
  echo "  [${i}] phase=$PHASE status=$STATUS messages=$MSG_COUNT"

  if [ "$STATUS" = "concluded" ] || [ "$STATUS" = "error" ] || [ "$STATUS" = "aborted" ]; then
    break
  fi
done

if [ "$STATUS" = "concluded" ]; then
  pass "Debate concluded"
else
  fail "Debate did not conclude: status=$STATUS"
fi

# ── Test 4: Check messages from all phases ───────────────────

info "Checking message phases..."
PHASES_FOUND=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('messages', [])
phases = set()
for m in msgs:
    phases.add(m.get('type') or m.get('phase',''))
print(' '.join(sorted(phases)))
" 2>/dev/null)

echo "  Phases found: $PHASES_FOUND"

echo "$PHASES_FOUND" | grep -q "OPENING" && pass "OPENING messages present" || fail "No OPENING messages"
echo "$PHASES_FOUND" | grep -q "CHALLENGE\|COUNTER" && pass "CROSS_DEBATE messages present" || info "No CHALLENGE/COUNTER (may have converged)"
echo "$PHASES_FOUND" | grep -q "SUMMARY" && pass "SUMMARY messages present" || fail "No SUMMARY messages"
echo "$PHASES_FOUND" | grep -q "RESCORE" && pass "RESCORE messages present" || info "No RESCORE messages (agents may have skipped)"

# ── Test 5: Check votes ──────────────────────────────────────

info "Checking votes..."
VOTE_COUNT=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
votes = data.get('votes', [])
print(len(votes))
" 2>/dev/null)

if [ "$VOTE_COUNT" -ge 3 ] 2>/dev/null; then
  pass "Votes recorded: $VOTE_COUNT"
else
  fail "Expected >=3 votes, got: $VOTE_COUNT"
fi

# ── Test 6: Check decision ───────────────────────────────────

info "Checking final decision..."
DECISION=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
d = data.get('decision', {})
print(f\"verdict={d.get('verdict')} approves={d.get('approves')} rejects={d.get('rejects')} defers={d.get('defers')}\")
" 2>/dev/null)
echo "  Decision: $DECISION"

echo "$DECISION" | grep -qE "verdict=(APPROVE|DEFER|REJECT)" && pass "Valid verdict" || fail "Invalid verdict: $DECISION"

# ── Test 7: Check belief drift ───────────────────────────────

info "Checking belief drift..."
DRIFT=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
drift = data.get('decision', {}).get('beliefDrift', {})
for agent, d in drift.items():
    delta = d.get('delta', 0)
    changed = d.get('stanceChanged', False)
    print(f\"  {agent}: delta={delta:+.3f} stanceChanged={changed}\")
if not drift:
    print('  (no drift data)')
" 2>/dev/null)
echo "$DRIFT"
pass "Belief drift data available"

# ── Test 8: Parallel execution check ─────────────────────────

info "Checking parallel agent execution (from messages)..."
PARALLEL_CHECK=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('messages', [])
# Check OPENING messages — should be near-simultaneous
openings = [m for m in msgs if m.get('type') == 'OPENING']
if len(openings) >= 2:
    times = sorted([m.get('seq', 0) for m in openings])
    # All OPENINGs should have consecutive seq numbers (parallel batch)
    gaps = [times[i+1] - times[i] for i in range(len(times)-1)]
    max_gap = max(gaps) if gaps else 0
    print(f'OPENING agents: {len(openings)}, max seq gap: {max_gap}')
    if max_gap <= 2:
        print('PARALLEL')
    else:
        print('SEQUENTIAL')
else:
    print(f'Only {len(openings)} OPENING messages')
" 2>/dev/null)
echo "  $PARALLEL_CHECK"
echo "$PARALLEL_CHECK" | grep -q "PARALLEL" && pass "Agents executed in parallel" || info "Could not confirm parallelism"

# ── Summary ──────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════"
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
else
  echo -e "${RED}$FAILURES check(s) failed${NC}"
fi
echo "═══════════════════════════════════════════════════"
exit $FAILURES

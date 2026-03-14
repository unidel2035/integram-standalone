#!/bin/bash
# PHP vs Node.js Parity Integration Test
# Sends identical requests to both servers and compares responses
#
# Prerequisites:
#   PHP server on :8082  — cd integram-server && php -S 127.0.0.1:8082 router.php
#   Node server on :8081 — cd backend/monolith && PORT=8081 node start-legacy-test.js
#   MySQL running with integram database
#   Test user: testbot / test123

set -uo pipefail
unset LD_PRELOAD LD_LIBRARY_PATH 2>/dev/null || true

PHP_URL="http://127.0.0.1:8082"
NODE_URL="http://127.0.0.1:8081"
DB="my"
TOKEN=""
XSRF_PHP=""
XSRF_NODE=""
PASS=0
FAIL=0
SKIP=0
DIFF_LOG="/tmp/parity-diffs.log"

> "$DIFF_LOG"

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
bold()  { echo -e "\033[1m$*\033[0m"; }

log_diff() {
    local test_name="$1" field="$2" php_val="$3" node_val="$4"
    echo "[$test_name] $field" >> "$DIFF_LOG"
    echo "  PHP:  $php_val" >> "$DIFF_LOG"
    echo "  NODE: $node_val" >> "$DIFF_LOG"
    echo "" >> "$DIFF_LOG"
}

# Compare two values; returns 0 if equal
compare() {
    local test_name="$1" field="$2" php_val="$3" node_val="$4"
    if [ "$php_val" = "$node_val" ]; then
        return 0
    else
        log_diff "$test_name" "$field" "$php_val" "$node_val"
        return 1
    fi
}

# Run a test: send same request to both, compare status + body + key headers
# Usage: run_test "name" "method" "path" "data" "cookie"
run_test() {
    local name="$1" method="$2" path="$3" data="${4:-}" cookie="${5:-}"
    local php_out="/tmp/parity_php.txt" node_out="/tmp/parity_node.txt"
    local php_hdr="/tmp/parity_php_hdr.txt" node_hdr="/tmp/parity_node_hdr.txt"

    local curl_args=(-s -D /dev/stdout -o /dev/stdout -X "$method")
    [ -n "$data" ] && curl_args+=(-d "$data")
    [ -n "$cookie" ] && curl_args+=(--cookie "$cookie")

    # PHP request
    local php_response
    php_response=$(curl -s -w '\n__HTTP_CODE__%{http_code}' -D "$php_hdr" -o "$php_out" -X "$method" \
        ${data:+-d "$data"} ${cookie:+--cookie "$cookie"} "${PHP_URL}${path}" 2>&1)
    local php_code=$(echo "$php_response" | grep -oP '__HTTP_CODE__\K\d+')
    local php_body=$(cat "$php_out" 2>/dev/null)

    # Node request
    local node_response
    node_response=$(curl -s -w '\n__HTTP_CODE__%{http_code}' -D "$node_hdr" -o "$node_out" -X "$method" \
        ${data:+-d "$data"} ${cookie:+--cookie "$cookie"} "${NODE_URL}${path}" 2>&1)
    local node_code=$(echo "$node_response" | grep -oP '__HTTP_CODE__\K\d+')
    local node_body=$(cat "$node_out" 2>/dev/null)

    local ok=true

    # Compare status code
    if ! compare "$name" "status" "$php_code" "$node_code"; then
        ok=false
    fi

    # Compare body (normalize whitespace in JSON)
    local php_body_norm=$(echo "$php_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,sort_keys=True,ensure_ascii=False))" 2>/dev/null || echo "$php_body")
    local node_body_norm=$(echo "$node_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,sort_keys=True,ensure_ascii=False))" 2>/dev/null || echo "$node_body")

    if ! compare "$name" "body" "$php_body_norm" "$node_body_norm"; then
        ok=false
    fi

    # Compare key headers
    for hdr in "Content-Type" "Content-Disposition" "Cache-Control" "Access-Control-Allow-Origin"; do
        local php_h=$(grep -i "^${hdr}:" "$php_hdr" 2>/dev/null | head -1 | sed 's/\r$//' | tr -s ' ')
        local node_h=$(grep -i "^${hdr}:" "$node_hdr" 2>/dev/null | head -1 | sed 's/\r$//' | tr -s ' ')
        if [ -n "$php_h" ] || [ -n "$node_h" ]; then
            if ! compare "$name" "header:$hdr" "$php_h" "$node_h"; then
                ok=false
            fi
        fi
    done

    if $ok; then
        green "  PASS  $name"
        ((PASS++))
    else
        red "  FAIL  $name"
        ((FAIL++))
    fi
}

# ============================================================================
bold "═══════════════════════════════════════════════════"
bold "  PHP ↔ Node.js Parity Test"
bold "═══════════════════════════════════════════════════"
echo ""

# Step 0: Auth to get token
bold "▶ Authenticating..."
TOKEN_RESPONSE=$(curl -s -D- -X POST "${PHP_URL}/${DB}/auth" -d "login=testbot&pwd=test123" 2>&1)
TOKEN=$(echo "$TOKEN_RESPONSE" | grep -oP 'my=\K[a-f0-9]+' | tail -1)
if [ -z "$TOKEN" ]; then
    red "Failed to authenticate with PHP. Aborting."
    exit 1
fi
green "  Token: ${TOKEN:0:8}..."

# Get XSRF tokens
bold "▶ Getting XSRF tokens..."
XSRF_PHP_RESP=$(curl -s --cookie "${DB}=${TOKEN}" "${PHP_URL}/${DB}/xsrf" 2>&1)
XSRF_PHP=$(echo "$XSRF_PHP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_xsrf',''))" 2>/dev/null || echo "")

XSRF_NODE_RESP=$(curl -s --cookie "${DB}=${TOKEN}" "${NODE_URL}/${DB}/xsrf" 2>&1)
XSRF_NODE=$(echo "$XSRF_NODE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_xsrf',''))" 2>/dev/null || echo "")

if [ -n "$XSRF_PHP" ]; then
    green "  PHP XSRF:  ${XSRF_PHP:0:8}..."
else
    yellow "  PHP XSRF:  (empty)"
fi
if [ -n "$XSRF_NODE" ]; then
    green "  Node XSRF: ${XSRF_NODE:0:8}..."
else
    yellow "  Node XSRF: (empty)"
fi

COOKIE="${DB}=${TOKEN}"
echo ""

# ============================================================================
bold "▶ Group 1: Read-only endpoints (no auth mutation)"
# ============================================================================

# terms — type metadata
run_test "GET /terms" GET "/${DB}/terms" "" "$COOKIE"

# metadata — full type tree
run_test "GET /metadata" GET "/${DB}/metadata" "" "$COOKIE"

# xsrf — compare structure (not values, since they differ)
echo ""
bold "▶ XSRF structure comparison"
php_xsrf_keys=$(echo "$XSRF_PHP_RESP" | python3 -c "import sys,json; print(sorted(json.load(sys.stdin).keys()))" 2>/dev/null)
node_xsrf_keys=$(echo "$XSRF_NODE_RESP" | python3 -c "import sys,json; print(sorted(json.load(sys.stdin).keys()))" 2>/dev/null)
if [ "$php_xsrf_keys" = "$node_xsrf_keys" ]; then
    green "  PASS  xsrf keys match: $php_xsrf_keys"
    ((PASS++))
else
    red "  FAIL  xsrf keys differ"
    log_diff "xsrf_keys" "keys" "$php_xsrf_keys" "$node_xsrf_keys"
    ((FAIL++))
fi

# obj_meta for a type
# Find first type ID
FIRST_TYPE=$(curl -s --cookie "$COOKIE" "${PHP_URL}/${DB}/terms" 2>/dev/null | python3 -c "
import sys,json
data=json.load(sys.stdin)
if isinstance(data,list) and len(data)>0:
    print(data[0].get('id',''))
elif isinstance(data,dict):
    for k,v in data.items():
        if isinstance(v,dict) and 'id' in v:
            print(v['id'])
            break
        elif k.isdigit():
            print(k)
            break
" 2>/dev/null || echo "")

if [ -n "$FIRST_TYPE" ]; then
    run_test "GET /obj_meta/$FIRST_TYPE" GET "/${DB}/obj_meta/${FIRST_TYPE}" "" "$COOKIE"
else
    yellow "  SKIP  obj_meta — no type found"
    ((SKIP++))
fi

echo ""

# ============================================================================
bold "▶ Group 2: Data endpoints"
# ============================================================================

# Get list of objects for first type
if [ -n "$FIRST_TYPE" ]; then
    run_test "POST /object (type=$FIRST_TYPE)" POST "/${DB}" "id=${FIRST_TYPE}&a=object" "$COOKIE"
fi

# _ref_reqs
run_test "GET /_ref_reqs/18" GET "/${DB}/_ref_reqs/18" "" "$COOKIE"

echo ""

# ============================================================================
bold "▶ Group 3: Auth flow comparison"
# ============================================================================

# Wrong credentials
run_test "POST /auth (wrong pwd)" POST "/${DB}/auth" "login=testbot&pwd=wrongpassword" ""

# Missing fields
run_test "POST /auth (no fields)" POST "/${DB}/auth" "" ""

echo ""

# ============================================================================
bold "▶ Group 4: Error cases"
# ============================================================================

# Invalid database
run_test "GET /terms (bad db)" GET "/nonexist_db_xyz/terms" "" "$COOKIE"

# Unknown action
run_test "POST / (unknown action)" POST "/${DB}" "a=unknown_action_xyz" "$COOKIE"

# obj_meta missing type
run_test "GET /obj_meta/999999999" GET "/${DB}/obj_meta/999999999" "" "$COOKIE"

echo ""

# ============================================================================
bold "▶ Group 5: Write operations (with XSRF)"
# ============================================================================

# _d_save — save a type definition (use PHP xsrf for PHP, node xsrf for node)
# These can't use run_test directly since XSRF tokens differ
# Instead we compare response structure

echo ""

# ============================================================================
# Summary
# ============================================================================
bold "═══════════════════════════════════════════════════"
bold "  Results: $(green "$PASS passed"), $(red "$FAIL failed"), $(yellow "$SKIP skipped")"
bold "═══════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    bold "Differences found:"
    cat "$DIFF_LOG"
fi

exit $FAIL

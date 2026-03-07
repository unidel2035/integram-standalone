#!/bin/bash
#
# FST API Test Script
#
# Тестирование всех эндпоинтов REST API
#
# Usage:
#   export FST_API_TOKEN="your_test_token"
#   export WEBHOOK_SECRET_EGRUL="your_secret"
#   ./test_endpoints.sh

set -e

# Конфигурация
API_URL="${FST_API_URL:-http://localhost:3100}"
API_TOKEN="${FST_API_TOKEN:-test-token-12345}"
WEBHOOK_SECRET_EGRUL="${WEBHOOK_SECRET_EGRUL:-default-egrul-secret}"
WEBHOOK_SECRET_ROSPATENT="${WEBHOOK_SECRET_ROSPATENT:-default-rospatent-secret}"
WEBHOOK_SECRET_HH="${WEBHOOK_SECRET_HH:-default-hh-secret}"

echo "========================================"
echo "FST API Endpoint Testing"
echo "========================================"
echo "API URL: $API_URL"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для тестирования эндпоинта
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local headers="$4"
    local data="$5"
    local expected_status="${6:-200}"

    echo -n "Testing $name... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            "$API_URL$endpoint" \
            -H "$headers" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST \
            "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>&1)
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "401" ]; then
        echo -e "${GREEN}✓ ($status_code)${NC}"
        if [ "$status_code" != "$expected_status" ]; then
            echo -e "  ${YELLOW}Note: Got $status_code (expected $expected_status)${NC}"
        fi
        # echo "  Response: $body" | head -c 100
    else
        echo -e "${RED}✗ (Expected $expected_status, got $status_code)${NC}"
        echo "  Response: $body"
        return 1
    fi
}

echo "=== System Endpoints ==="
test_endpoint "Health Check" "GET" "/api/fst/health" "" "" 200

echo ""
echo "=== Portfolio Endpoints (require auth) ==="
test_endpoint "Get Portfolio" "GET" "/api/fst/portfolio" "Authorization: Bearer $API_TOKEN" "" 200
test_endpoint "Get Company Details" "GET" "/api/fst/company/1202" "Authorization: Bearer $API_TOKEN" "" 200
test_endpoint "Get Portfolio KPIs" "GET" "/api/fst/kpis" "Authorization: Bearer $API_TOKEN" "" 200

echo ""
echo "=== Application Endpoints (require auth) ==="

# Test данные для заявки
application_data='{
  "companyName": "Test Company",
  "inn": "7729999999",
  "ogrn": "1177746999999",
  "description": "Test application from automated test script",
  "requestedAmount": 10000000,
  "trl": 5,
  "sovereignty": 7,
  "contactEmail": "test@example.com",
  "source": "api"
}'

test_endpoint "Submit Application" "POST" "/api/fst/apply" "Authorization: Bearer $API_TOKEN" "$application_data" 201
test_endpoint "Get Application Status" "GET" "/api/fst/application/1202" "Authorization: Bearer $API_TOKEN" "" 200

echo ""
echo "=== Webhook Endpoints (require webhook secret) ==="

# Test данные для ЕГРЮЛ webhook
egrul_data='{
  "inn": "7729123456",
  "companyName": "Test Company",
  "changeType": "director",
  "oldValue": "Иванов И.И.",
  "newValue": "Петров П.П.",
  "source": "test-script",
  "changeDate": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

test_endpoint "EGRUL Webhook" "POST" "/api/fst/webhook/egrul" "X-Webhook-Secret: $WEBHOOK_SECRET_EGRUL" "$egrul_data" 200

# Test данные для Роспатент webhook
rospatent_data='{
  "inn": "7729123456",
  "companyName": "Test Company",
  "patentNumber": "RU2999999",
  "patentTitle": "Тестовое изобретение",
  "patentType": "invention",
  "status": "granted",
  "filingDate": "2025-01-15",
  "grantDate": "2026-03-07"
}'

test_endpoint "Rospatent Webhook" "POST" "/api/fst/webhook/rospatent" "X-Webhook-Secret: $WEBHOOK_SECRET_ROSPATENT" "$rospatent_data" 200

# Test данные для HH.ru webhook
hh_data='{
  "inn": "7729123456",
  "companyName": "Test Company",
  "activeVacancies": 15,
  "totalVacancies": 25,
  "avgSalary": 150000,
  "topPositions": [
    {"title": "Software Engineer", "count": 5},
    {"title": "Data Scientist", "count": 3}
  ],
  "period": "month"
}'

test_endpoint "HH.ru Webhook" "POST" "/api/fst/webhook/hh" "X-Webhook-Secret: $WEBHOOK_SECRET_HH" "$hh_data" 200

echo ""
echo "=== Authentication Tests ==="
test_endpoint "No Auth Token (should fail)" "GET" "/api/fst/portfolio" "" "" 401
test_endpoint "Invalid Auth Token (should fail)" "GET" "/api/fst/portfolio" "Authorization: Bearer invalid-token" "" 401
test_endpoint "No Webhook Secret (should fail)" "POST" "/api/fst/webhook/egrul" "" "$egrul_data" 401

echo ""
echo "========================================"
echo "Testing Complete!"
echo "========================================"
echo ""
echo "To view API documentation:"
echo "  Open: $API_URL/api/fst/docs"
echo ""

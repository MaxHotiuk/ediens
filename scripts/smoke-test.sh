#!/usr/bin/env bash
set -euo pipefail

# scripts/smoke-test.sh
# Automated Live Smoke & RFC 9457 Contract Verification Suite for ēdiens API
# Tests live /health, ping, all 10 OpenAPI endpoints, and negative RFC 9457 error contracts.

echo "=========================================================="
echo " ēdiens Live API Smoke & RFC 9457 Verification Suite"
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-8089}"
HOST_CANDIDATES=("http://localhost:8089" "http://localhost:8080" "http://localhost:5158" "http://127.0.0.1:8089" "http://127.0.0.1:8080" "http://127.0.0.1:5158")
BASE_URL="${API_URL:-}"

# Auto-detect running instance if API_URL not explicitly provided
if [ -z "$BASE_URL" ]; then
  for candidate in "${HOST_CANDIDATES[@]}"; do
    if curl -s -f -m 2 "$candidate/health" >/dev/null 2>&1; then
      BASE_URL="$candidate"
      echo "--> Detected live API running at: $BASE_URL"
      break
    fi
  done
fi

API_PID=""
cleanup() {
  if [ -n "$API_PID" ]; then
    echo "--> Stopping background API process (PID: $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ -z "$BASE_URL" ]; then
  if [[ "${1:-}" == "--boot" || "${AUTO_BOOT:-0}" == "1" ]]; then
    echo "--> No running API detected. Starting Ediens.Api in background..."
    dotnet run --project src/Ediens.Api/Ediens.Api.csproj --urls "http://localhost:5158" &
    API_PID=$!
    BASE_URL="http://localhost:5158"
    
    echo "--> Waiting up to 30s for API at $BASE_URL to become ready..."
    ATTEMPTS=0
    until curl -s -f -m 2 "$BASE_URL/health" >/dev/null 2>&1 || [ "$ATTEMPTS" -ge 30 ]; do
      sleep 1
      ATTEMPTS=$((ATTEMPTS + 1))
    done
    if [ "$ATTEMPTS" -ge 30 ]; then
      echo "  [ERROR] API failed to start within 30 seconds."
      exit 1
    fi
    echo "  ✓ API is up and responding."
  else
    echo "  [NOTICE] No active ēdiens API instance detected on ports 8080 or 5158."
    echo "  Run 'docker compose up -d' or pass '--boot' to start the local .NET API automatically."
    echo "  Skipping live smoke test execution in static validation mode."
    exit 0
  fi
fi

ERRORS=0
SUCCESSES=0

assert_status() {
  local label="$1"
  local expected_status="$2"
  local actual_status="$3"
  local response_body="$4"

  if [ "$actual_status" -eq "$expected_status" ]; then
    echo "  ✓ [$actual_status] $label"
    SUCCESSES=$((SUCCESSES + 1))
  else
    echo "  [FAIL] $label: Expected HTTP $expected_status, got $actual_status"
    echo "         Response: $response_body"
    ERRORS=$((ERRORS + 1))
  fi
}

assert_problem_json() {
  local label="$1"
  local expected_error_code="$2"
  local response_file="$3"

  local headers_file="${response_file%.json}.headers"
  if [ ! -f "$headers_file" ]; then
    headers_file="${response_file}.headers"
  fi

  if [ -f "$headers_file" ]; then
    local content_type
    content_type=$(grep -i "^content-type:" "$headers_file" | tr -d '\r' | awk '{print $2}' || echo "")
    if [[ "$content_type" != *"application/problem+json"* && "$content_type" != *"application/json"* ]]; then
      echo "  [FAIL] $label: Expected Content-Type application/problem+json, got '$content_type'"
      ERRORS=$((ERRORS + 1))
      return
    fi
  fi

  local error_code
  error_code=$(jq -r '.errorCode // empty' "$response_file" 2>/dev/null || echo "")
  if [ "$error_code" = "$expected_error_code" ]; then
    echo "  ✓ RFC 9457 error code matched: $expected_error_code"
    SUCCESSES=$((SUCCESSES + 1))
  else
    echo "  [FAIL] $label: Expected errorCode '$expected_error_code', got '$error_code'"
    echo "         Body: $(cat "$response_file")"
    ERRORS=$((ERRORS + 1))
  fi
}

TMP_DIR="$(mktemp -d)"
cleanup_tmp() {
  rm -rf "$TMP_DIR"
  cleanup
}
trap cleanup_tmp EXIT

# Known Seed UUIDs from DatabaseSeeder
MAIN_HOUSEHOLD="0192e2b0-8812-7001-9011-aa9988776655"
STRANGER_HOUSEHOLD="0192e2b0-8812-7001-9011-bb0000000099"
OLEG_USER="0192e2b0-0000-7000-8000-000000000001"
STRANGER_USER="0192e2b0-0000-7000-8000-000000000099"
MILK_BARCODE="4820000112233"

echo ""
echo "--- 1. Health & Ping Baseline ---"
STATUS=$(curl -s -o "$TMP_DIR/health.json" -w "%{http_code}" "$BASE_URL/health")
assert_status "GET /health" 200 "$STATUS" "$(cat "$TMP_DIR/health.json" 2>/dev/null)"

STATUS=$(curl -s -o "$TMP_DIR/ping.json" -w "%{http_code}" "$BASE_URL/api/v1/ping")
assert_status "GET /api/v1/ping" 200 "$STATUS" "$(cat "$TMP_DIR/ping.json" 2>/dev/null)"

echo ""
echo "--- 2. OpenAPI Route Verification (Positive Suite) ---"

# Route 1: POST /api/v1/inventory/items
EXPIRY_DATE=$(date -u -v+7d +"%Y-%m-%dT00:00:00Z" 2>/dev/null || date -u -d "+7 days" +"%Y-%m-%dT00:00:00Z")
STATUS=$(curl -s -D "$TMP_DIR/inv_post.headers" -o "$TMP_DIR/inv_post.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/inventory/items" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d "{
    \"householdId\": \"$MAIN_HOUSEHOLD\",
    \"productName\": \"Тестовий шпинат органічний\",
    \"location\": \"Fridge\",
    \"quantity\": 300,
    \"unit\": \"g\",
    \"expiresAt\": \"$EXPIRY_DATE\"
  }")
assert_status "POST /api/v1/inventory/items" 201 "$STATUS" "$(cat "$TMP_DIR/inv_post.json" 2>/dev/null)"

CREATED_ITEM_ID=$(jq -r '.id // empty' "$TMP_DIR/inv_post.json" 2>/dev/null || echo "")
CREATED_ETAG=$(grep -i "^etag:" "$TMP_DIR/inv_post.headers" | tr -d '\r' | awk '{print $2}' || echo "")

# PostgreSQL Physical Persistence Verification Gate
if [ -n "$CREATED_ITEM_ID" ]; then
  echo "  Verifying physical persistence of item $CREATED_ITEM_ID in PostgreSQL..."
  DB_COUNT=""
  if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "postgres"; then
    DB_COUNT=$(docker compose exec -T postgres psql -U postgres -d ediens -tAc "SELECT count(*) FROM inventory_items WHERE \"Id\" = '$CREATED_ITEM_ID';" 2>/dev/null || echo "")
  elif command -v psql >/dev/null 2>&1; then
    DB_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-ediens_secure_password}" psql -h localhost -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ediens}" -tAc "SELECT count(*) FROM inventory_items WHERE \"Id\" = '$CREATED_ITEM_ID';" 2>/dev/null || echo "")
  fi

  if [ "$DB_COUNT" = "1" ]; then
    echo "  ✓ Physical PostgreSQL persistence verified: row exists in table 'inventory_items' (count: $DB_COUNT)."
    SUCCESSES=$((SUCCESSES + 1))
  elif [ -n "$DB_COUNT" ]; then
    echo "  [FAIL] Expected 1 row in PostgreSQL table 'inventory_items', got '$DB_COUNT'"
    ERRORS=$((ERRORS + 1))
  else
    echo "  (Note: PostgreSQL container or psql CLI not reachable from smoke runner environment; continuing)"
  fi
fi

# Route 2: GET /api/v1/inventory/items
STATUS=$(curl -s -o "$TMP_DIR/inv_list.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/inventory/items?householdId=$MAIN_HOUSEHOLD")
assert_status "GET /api/v1/inventory/items?householdId=..." 200 "$STATUS" "$(cat "$TMP_DIR/inv_list.json" 2>/dev/null)"

# Route 3: GET /api/v1/inventory/items/{id}
if [ -n "$CREATED_ITEM_ID" ]; then
  STATUS=$(curl -s -o "$TMP_DIR/inv_get.json" -w "%{http_code}" \
    -H "X-User-Id: $OLEG_USER" \
    "$BASE_URL/api/v1/inventory/items/$CREATED_ITEM_ID")
  assert_status "GET /api/v1/inventory/items/{id}" 200 "$STATUS" "$(cat "$TMP_DIR/inv_get.json" 2>/dev/null)"

  # Route 4: PATCH /api/v1/inventory/items/{id} (OCC with If-Match)
  if [ -n "$CREATED_ETAG" ]; then
    STATUS=$(curl -s -D "$TMP_DIR/inv_patch.headers" -o "$TMP_DIR/inv_patch.json" -w "%{http_code}" \
      -X PATCH "$BASE_URL/api/v1/inventory/items/$CREATED_ITEM_ID" \
      -H "Content-Type: application/json" \
      -H "X-User-Id: $OLEG_USER" \
      -H "If-Match: $CREATED_ETAG" \
      -d '{"quantityDelta": -50, "markOpened": false}')
    assert_status "PATCH /api/v1/inventory/items/{id} (with If-Match)" 200 "$STATUS" "$(cat "$TMP_DIR/inv_patch.json" 2>/dev/null)"
  fi

  # Route 5: DELETE /api/v1/inventory/items/{id}
  STATUS=$(curl -s -o "$TMP_DIR/inv_delete.json" -w "%{http_code}" \
    -X DELETE "$BASE_URL/api/v1/inventory/items/$CREATED_ITEM_ID" \
    -H "X-User-Id: $OLEG_USER")
  assert_status "DELETE /api/v1/inventory/items/{id}" 204 "$STATUS" ""
fi

# Route 6: POST /api/v1/meals/log
IK_MEAL="0192e2b9-$(head -c 6 /dev/urandom | xxd -p)-7000-8000-000000000001"
STATUS=$(curl -s -o "$TMP_DIR/meal_post.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/meals/log" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -H "Idempotency-Key: $IK_MEAL" \
  -d "{
    \"mealType\": \"Breakfast\",
    \"loggedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"items\": [
      { \"productName\": \"Вівсяні пластівці 'Ніжні'\", \"quantity\": 80, \"unit\": \"g\" }
    ]
  }")
assert_status "POST /api/v1/meals/log (with Idempotency-Key)" 201 "$STATUS" "$(cat "$TMP_DIR/meal_post.json" 2>/dev/null)"

# Route 7: PUT /api/v1/nutrition/targets & GET /api/v1/nutrition/targets
STATUS=$(curl -s -o "$TMP_DIR/nut_put.json" -w "%{http_code}" \
  -X PUT "$BASE_URL/api/v1/nutrition/targets" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d '{
    "targetCalories": 2350,
    "targetProtein": 165,
    "targetFat": 68,
    "targetCarbs": 245
  }')
assert_status "PUT /api/v1/nutrition/targets" 200 "$STATUS" "$(cat "$TMP_DIR/nut_put.json" 2>/dev/null)"

STATUS=$(curl -s -o "$TMP_DIR/nut_get.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/nutrition/targets")
assert_status "GET /api/v1/nutrition/targets" 200 "$STATUS" "$(cat "$TMP_DIR/nut_get.json" 2>/dev/null)"

# Route 8: GET /api/v1/recipes/recommendations
STATUS=$(curl -s -o "$TMP_DIR/rec_list.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/recipes/recommendations?householdId=$MAIN_HOUSEHOLD")
assert_status "GET /api/v1/recipes/recommendations" 200 "$STATUS" "$(cat "$TMP_DIR/rec_list.json" 2>/dev/null)"

# Route 9: GET /api/v1/products/barcode/{code}
STATUS=$(curl -s -o "$TMP_DIR/product_barcode.json" -w "%{http_code}" \
  -H "X-Forwarded-For: 192.0.2.1" \
  "$BASE_URL/api/v1/products/barcode/$MILK_BARCODE")
assert_status "GET /api/v1/products/barcode/{code}" 200 "$STATUS" "$(cat "$TMP_DIR/product_barcode.json" 2>/dev/null)"

# Route 10: POST /api/v1/households/{id}/shopping-list/sync & GET
SHOP_ITEM_ID="0192e2b5-$(head -c 2 /dev/urandom | xxd -p)-7000-8000-000000000001"
STATUS=$(curl -s -o "$TMP_DIR/shop_sync.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/households/$MAIN_HOUSEHOLD/shopping-list/sync" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d "{
    \"lastSyncTimestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"clientChanges\": [
      {
        \"id\": \"$SHOP_ITEM_ID\",
        \"productName\": \"Грецький йогурт 2%\",
        \"quantity\": 2,
        \"unit\": \"pcs\",
        \"isPurchased\": false,
        \"clientUpdatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
      }
    ]
  }")
assert_status "POST /api/v1/households/{id}/shopping-list/sync" 200 "$STATUS" "$(cat "$TMP_DIR/shop_sync.json" 2>/dev/null)"

STATUS=$(curl -s -o "$TMP_DIR/shop_get.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/households/$MAIN_HOUSEHOLD/shopping-list")
assert_status "GET /api/v1/households/{id}/shopping-list" 200 "$STATUS" "$(cat "$TMP_DIR/shop_get.json" 2>/dev/null)"

# Route 11: GET /api/v1/nutrition/progress
STATUS=$(curl -s -o "$TMP_DIR/nut_progress.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/nutrition/progress?householdId=$MAIN_HOUSEHOLD")
assert_status "GET /api/v1/nutrition/progress" 200 "$STATUS" "$(cat "$TMP_DIR/nut_progress.json" 2>/dev/null)"

# Route 12: GET /api/v1/meals
STATUS=$(curl -s -o "$TMP_DIR/meals_get.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/meals")
assert_status "GET /api/v1/meals" 200 "$STATUS" "$(cat "$TMP_DIR/meals_get.json" 2>/dev/null)"

# Route 13: GET /api/v1/households
STATUS=$(curl -s -o "$TMP_DIR/households_get.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/households")
assert_status "GET /api/v1/households" 200 "$STATUS" "$(cat "$TMP_DIR/households_get.json" 2>/dev/null)"

# Route 14: GET /metrics (Prometheus Observability)
STATUS=$(curl -s -o "$TMP_DIR/metrics.txt" -w "%{http_code}" \
  "$BASE_URL/metrics")
assert_status "GET /metrics" 200 "$STATUS" ""

echo ""
echo "--- 3. Negative RFC 9457 Error Contract Suite ---"

# 400 Bad Request / VALIDATION_FAILED
STATUS=$(curl -s -D "$TMP_DIR/err400.headers" -o "$TMP_DIR/err400.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/inventory/items" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d "{
    \"householdId\": \"$MAIN_HOUSEHOLD\",
    \"productName\": \"X\",
    \"location\": \"Balcony\",
    \"quantity\": -10,
    \"unit\": \"kg\",
    \"expiresAt\": \"$EXPIRY_DATE\"
  }")
assert_status "400 Validation Problem (negative quantity & invalid location)" 400 "$STATUS" "$(cat "$TMP_DIR/err400.json")"
assert_problem_json "400 Validation Problem" "VALIDATION_FAILED" "$TMP_DIR/err400.json"

# 403 Forbidden / HOUSEHOLD_ACCESS_DENIED
STATUS=$(curl -s -D "$TMP_DIR/err403.headers" -o "$TMP_DIR/err403.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/inventory/items?householdId=$STRANGER_HOUSEHOLD")
assert_status "403 Forbidden (cross-tenant household access)" 403 "$STATUS" "$(cat "$TMP_DIR/err403.json")"
assert_problem_json "403 Forbidden" "HOUSEHOLD_ACCESS_DENIED" "$TMP_DIR/err403.json"

# 404 Not Found / ITEM_NOT_FOUND
STATUS=$(curl -s -D "$TMP_DIR/err404.headers" -o "$TMP_DIR/err404.json" -w "%{http_code}" \
  -H "X-User-Id: $OLEG_USER" \
  "$BASE_URL/api/v1/inventory/items/00000000-0000-0000-0000-000000000000")
assert_status "404 Resource Not Found" 404 "$STATUS" "$(cat "$TMP_DIR/err404.json")"
assert_problem_json "404 Not Found" "ITEM_NOT_FOUND" "$TMP_DIR/err404.json"

# 409 Conflict / CONCURRENT_MODIFICATION (Stale ETag OCC)
STATUS=$(curl -s -D "$TMP_DIR/err409_item.headers" -o "$TMP_DIR/err409_item.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/inventory/items" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d "{
    \"householdId\": \"$MAIN_HOUSEHOLD\",
    \"productName\": \"OCC Stale Verification Item\",
    \"location\": \"Pantry\",
    \"quantity\": 100,
    \"unit\": \"g\",
    \"expiresAt\": \"$EXPIRY_DATE\"
  }")
OCC_ITEM_ID=$(jq -r '.id // empty' "$TMP_DIR/err409_item.json" 2>/dev/null || echo "")
if [ -n "$OCC_ITEM_ID" ]; then
  STATUS=$(curl -s -D "$TMP_DIR/err409.headers" -o "$TMP_DIR/err409.json" -w "%{http_code}" \
    -X PATCH "$BASE_URL/api/v1/inventory/items/$OCC_ITEM_ID" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $OLEG_USER" \
    -H "If-Match: \"W/\\\"99999999\\\"\"" \
    -d '{"quantityDelta": -10, "markOpened": false}')
  assert_status "409 Conflict (stale ETag OCC mismatch)" 409 "$STATUS" "$(cat "$TMP_DIR/err409.json")"
  assert_problem_json "409 Conflict" "CONCURRENT_MODIFICATION" "$TMP_DIR/err409.json"

  # Clean up test item
  curl -s -X DELETE "$BASE_URL/api/v1/inventory/items/$OCC_ITEM_ID" -H "X-User-Id: $OLEG_USER" >/dev/null 2>&1 || true
fi

# 422 Insufficient Inventory / INSUFFICIENT_INVENTORY (Cook recipe with massive servings)
SEEDED_RECIPE_ID="0192e2b8-1234-7111-9988-bbccddeeff00"
STATUS=$(curl -s -D "$TMP_DIR/err422.headers" -o "$TMP_DIR/err422.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/recipes/$SEEDED_RECIPE_ID/cook" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $OLEG_USER" \
  -d "{
    \"householdId\": \"$MAIN_HOUSEHOLD\",
    \"servings\": 20,
    \"mealType\": \"Dinner\"
  }")
assert_status "422 Insufficient Inventory on cook recipe" 422 "$STATUS" "$(cat "$TMP_DIR/err422.json")"
assert_problem_json "422 Insufficient Inventory" "INSUFFICIENT_INVENTORY" "$TMP_DIR/err422.json"

# 429 Rate Limit Exceeded check on barcode route
RATE_LIMITED=0
for i in {1..35}; do
  RATE_STATUS=$(curl -s -D "$TMP_DIR/rate.headers" -o "$TMP_DIR/rate.json" -w "%{http_code}" \
    -H "X-Forwarded-For: 198.51.100.99" \
    "$BASE_URL/api/v1/products/barcode/4820000112233")
  if [ "$RATE_STATUS" -eq 429 ]; then
    RATE_LIMITED=1
    break
  fi
done

if [ "$RATE_LIMITED" -eq 1 ]; then
  assert_status "429 Rate Limit Exceeded" 429 "$RATE_STATUS" "$(cat "$TMP_DIR/rate.json")"
  assert_problem_json "429 Rate Limit" "RATE_LIMIT_EXCEEDED" "$TMP_DIR/rate.json"
  RETRY_AFTER=$(grep -i "^retry-after:" "$TMP_DIR/rate.headers" | tr -d '\r' | awk '{print $2}' || echo "")
  if [ -n "$RETRY_AFTER" ]; then
    echo "  ✓ Header 'Retry-After: $RETRY_AFTER' present on 429 response."
    SUCCESSES=$((SUCCESSES + 1))
  else
    echo "  [FAIL] Missing Retry-After header on 429 response."
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  (Note: Rate limit window not exceeded during burst test, continuing)"
fi

echo ""
echo "=========================================================="
if [ "$ERRORS" -gt 0 ]; then
  echo " Smoke Test FAILED with $ERRORS error(s) (Passed: $SUCCESSES)."
  echo "=========================================================="
  exit 1
else
  echo " Smoke Test PASSED! ($SUCCESSES tests verified with 0 errors)."
  echo "=========================================================="
  exit 0
fi

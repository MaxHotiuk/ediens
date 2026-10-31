#!/usr/bin/env bash
set -euo pipefail

# scripts/verify.sh
# Comprehensive verification suite and Anti-Kostyl Gate for the ēdiens platform.
# Verifies architecture documents, task queues (TASK-* & FIX-*), static anti-mock constraints,
# .NET backend build & tests, React 19 production build, Docker Compose stacks, and Prometheus monitoring.

echo "=========================================================="
echo " Running ēdiens Verification Suite & Anti-Kostyl Gate"
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# ------------------------------------------------------------------------------
# 1. Check Task Queue JSON Integrity (TASK-* and FIX-*)
# ------------------------------------------------------------------------------
echo "[1/7] Checking task queue JSON validity (TASK-* and FIX-*)..."
TASK_FILES=(.agents/tasks/TASK-*.json .agents/tasks/FIX-*.json)
CHECKED_TASKS=0
for task_file in "${TASK_FILES[@]}"; do
  if [ -f "$task_file" ]; then
    CHECKED_TASKS=$((CHECKED_TASKS + 1))
    if ! jq empty "$task_file" 2>/dev/null; then
      echo "  [ERROR] Invalid JSON in $task_file"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done
echo "  ✓ Validated $CHECKED_TASKS task queue definition files."

# ------------------------------------------------------------------------------
# 2. Verify Required Project & Architecture Documents
# ------------------------------------------------------------------------------
echo "[2/7] Verifying required foundational documents and configurations..."
REQUIRED_FILES=(
  "AGENTS.md"
  ".agents/WORKFLOW.md"
  ".agents/KNOWLEDGE.md"
  ".agents/AUDIT_REPORT.md"
  "docs/Ediens_SRS.md"
  "docs/Ediens_OpenAPI.yaml"
  "docs/LOCAL_DEVELOPMENT.md"
  "docs/VERIFICATION.md"
  "Dockerfile"
  "compose.yaml"
  "compose.monitoring.yaml"
  "scripts/claim-task.sh"
  "scripts/smoke-test.sh"
  "infra/nginx/nginx.conf"
  "infra/monitoring/prometheus/prometheus.yml"
  "infra/monitoring/prometheus/alert_rules.yml"
  "infra/monitoring/alertmanager/alertmanager.yml"
  "infra/monitoring/grafana/provisioning/datasources/prometheus.yml"
  "infra/monitoring/grafana/provisioning/dashboards/dashboards.yml"
  "infra/monitoring/grafana/dashboards/ediens_overview.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "  [ERROR] Required file missing: $file"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  ✓ All required architecture, container, and monitoring files present."

# ------------------------------------------------------------------------------
# 3. Anti-Kostyl Gate: Static Anti-Mock Check
# ------------------------------------------------------------------------------
echo "[3/7] Running Anti-Kostyl Gate: Scanning frontend for banned mock patterns..."
BANNED_PATTERNS=("MOCK_" "fallbackData" "fakeApi")
SRC_WEB_DIR="src/ediens-web/src"

if [ -d "$SRC_WEB_DIR" ]; then
  # 3.1 Check for banned pattern strings
  for pattern in "${BANNED_PATTERNS[@]}"; do
    MATCHES=$(grep -rn --exclude="*.test.*" --exclude="*.spec.*" "$pattern" "$SRC_WEB_DIR" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      echo "  [ERROR] Banned mock pattern '$pattern' detected in frontend source:"
      echo "$MATCHES" | sed 's/^/    /'
      ERRORS=$((ERRORS + 1))
    fi
  done

  # 3.2 Check for swallowed catch blocks returning hardcoded static arrays
  # Matches e.g.: catch (...) { return [...]; } or catch (...) { return default...; }
  SWALLOWED_ARRAYS=$(grep -rnE --exclude="*.test.*" --exclude="*.spec.*" "catch[[:space:]]*\([^)]*\)[[:space:]]*\{[[:space:]]*return[[:space:]]*\[" "$SRC_WEB_DIR" 2>/dev/null || true)
  if [ -n "$SWALLOWED_ARRAYS" ]; then
    echo "  [ERROR] Swallowed catch block returning static array detected:"
    echo "$SWALLOWED_ARRAYS" | sed 's/^/    /'
    ERRORS=$((ERRORS + 1))
  fi

  # 3.3 Anti-Mock Persistence Gate: Zero browser storage in domain code
  if grep -rnE "localStorage\.(setItem|getItem)|sessionStorage\.(setItem|getItem)|useLocalStorage" src/ediens-web/src/features/ src/ediens-web/src/pages/ src/ediens-web/src/api/ src/ediens-web/src/store/ 2>/dev/null; then
    echo "❌ ERROR: Browser storage persistence found in frontend domain code!"
    exit 1
  fi
  echo "  ✓ Zero browser storage persistence detected (all domain data wired to API & PostgreSQL)."

  echo "  ✓ Static anti-mock scan passed (zero banned mock patterns found)."
else
  echo "  [ERROR] Frontend source directory not found at $SRC_WEB_DIR"
  ERRORS=$((ERRORS + 1))
fi

# ------------------------------------------------------------------------------
# 4. Backend Build & Test Suite (.NET 8)
# ------------------------------------------------------------------------------
echo "[4/7] Checking .NET solution and running test suite..."
if [ -f "src/Ediens.Api/Ediens.Api.csproj" ]; then
  echo "  Compiling .NET API..."
  if ! dotnet build src/Ediens.Api/Ediens.Api.csproj; then
    echo "  [ERROR] .NET API build failed!"
    ERRORS=$((ERRORS + 1))
  fi

  if [ -f "src/Ediens.Tests/Ediens.Tests.csproj" ]; then
    echo "  Running .NET Integration & Unit Tests..."
    if ! dotnet test src/Ediens.Tests/Ediens.Tests.csproj; then
      echo "  [ERROR] .NET Test Suite failed!"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✓ .NET test runner completed successfully."
    fi
  fi
else
  echo "  [ERROR] .NET API project not found at src/Ediens.Api/Ediens.Api.csproj"
  ERRORS=$((ERRORS + 1))
fi

# ------------------------------------------------------------------------------
# 5. Frontend Type-Check & Production Build (React 19 + Vite)
# ------------------------------------------------------------------------------
echo "[5/7] Checking Web Frontend typecheck and production build..."
if [ -f "src/ediens-web/package.json" ]; then
  echo "  Building web app production bundle (tsc -b && vite build)..."
  if ! (cd src/ediens-web && npm run build); then
    echo "  [ERROR] Web frontend build failed!"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ Web frontend compiled successfully."
  fi
else
  echo "  [ERROR] Web frontend project not found at src/ediens-web/package.json"
  ERRORS=$((ERRORS + 1))
fi

# ------------------------------------------------------------------------------
# 6. Dockerfile & Compose Stack Configuration Validation
# ------------------------------------------------------------------------------
echo "[6/7] Validating Docker Compose and Container configurations..."
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "  Validating compose.yaml via docker compose..."
  if ! docker compose config --quiet; then
    echo "  [ERROR] compose.yaml configuration validation failed!"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ compose.yaml is valid."
  fi

  echo "  Validating compose.monitoring.yaml via docker compose..."
  if ! docker compose -f compose.monitoring.yaml config --quiet; then
    echo "  [ERROR] compose.monitoring.yaml configuration validation failed!"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ compose.monitoring.yaml is valid."
  fi
else
  echo "  (Docker CLI not available on current host; performing structural syntax checks)"
  if command -v ruby >/dev/null 2>&1; then
    echo "  Validating compose and monitoring YAML structure via Ruby YAML parser..."
    ruby -ryaml -e "
      ['compose.yaml', 'compose.monitoring.yaml', 'infra/monitoring/prometheus/prometheus.yml', 'infra/monitoring/prometheus/alert_rules.yml', 'infra/monitoring/alertmanager/alertmanager.yml'].each do |file|
        YAML.load_file(file)
      end
    "
    echo "  ✓ Strict YAML AST validation passed."
  fi

  # Verify key sections exist in compose.yaml
  for required_section in "services:" "postgres:" "redis:" "ediens-api:" "ediens-web:" "networks:" "volumes:"; do
    if ! grep -q "$required_section" compose.yaml; then
      echo "  [ERROR] Missing required section '$required_section' in compose.yaml"
      ERRORS=$((ERRORS + 1))
    fi
  done

  # Verify key sections exist in compose.monitoring.yaml
  for required_mon in "services:" "prometheus:" "alertmanager:" "grafana:" "networks:" "volumes:"; do
    if ! grep -q "$required_mon" compose.monitoring.yaml; then
      echo "  [ERROR] Missing required section '$required_mon' in compose.monitoring.yaml"
      ERRORS=$((ERRORS + 1))
    fi
  done
  echo "  ✓ Compose stacks structural validation passed."
fi

# ------------------------------------------------------------------------------
# 7. Observability & Monitoring Assets Validation
# ------------------------------------------------------------------------------
echo "[7/7] Validating Prometheus rules and Grafana dashboard JSON..."
if ! jq empty infra/monitoring/grafana/dashboards/ediens_overview.json 2>/dev/null; then
  echo "  [ERROR] Invalid JSON in Grafana dashboard infra/monitoring/grafana/dashboards/ediens_overview.json"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ Grafana dashboard JSON is valid."
fi

for alert_name in "EdiensApiDown" "HighApiLatencyP95" "HighHttp5xxErrorRate" "HighInventoryConcurrencyConflicts"; do
  if ! grep -q "$alert_name" infra/monitoring/prometheus/alert_rules.yml; then
    echo "  [ERROR] Missing expected alert rule: $alert_name in infra/monitoring/prometheus/alert_rules.yml"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  ✓ Alert rules validated."

# ------------------------------------------------------------------------------
# Optional Live Smoke Verification (if requested or live API detected)
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--smoke" || "${SMOKE_TEST:-0}" == "1" ]]; then
  echo ""
  echo "--> Running Live Smoke Test Suite via scripts/smoke-test.sh..."
  if ! ./scripts/smoke-test.sh; then
    echo "  [ERROR] Live Smoke Test Suite failed!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# ------------------------------------------------------------------------------
# Summary & Exit Code
# ------------------------------------------------------------------------------
if [ "$ERRORS" -gt 0 ]; then
  echo "=========================================================="
  echo " Verification FAILED with $ERRORS error(s)."
  echo "=========================================================="
  exit 1
else
  echo "=========================================================="
  echo " Verification PASSED successfully."
  echo "=========================================================="
  exit 0
fi

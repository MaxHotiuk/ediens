#!/usr/bin/env bash
set -euo pipefail

# scripts/verify.sh
# Comprehensive verification suite for the ēdiens project across documentation,
# backend (.NET 8 Minimal API), frontend (React 19 SPA), Docker Compose stacks, and Prometheus monitoring.

echo "=============================================="
echo " Running ēdiens Comprehensive Verification Suite"
echo "=============================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# ------------------------------------------------------------------------------
# 1. Check Task Queue JSON Integrity
# ------------------------------------------------------------------------------
echo "[1/6] Checking task queue JSON validity..."
for task_file in .agents/tasks/TASK-*.json; do
  if [ -f "$task_file" ]; then
    if ! jq empty "$task_file" 2>/dev/null; then
      echo "  [ERROR] Invalid JSON in $task_file"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done
echo "  ✓ Task files valid."

# ------------------------------------------------------------------------------
# 2. Verify Required Project & Architecture Documents
# ------------------------------------------------------------------------------
echo "[2/6] Verifying required foundational documents and configurations..."
REQUIRED_FILES=(
  "AGENTS.md"
  ".agents/WORKFLOW.md"
  ".agents/KNOWLEDGE.md"
  "docs/Ediens_SRS.md"
  "docs/Ediens_OpenAPI.yaml"
  "docs/LOCAL_DEVELOPMENT.md"
  "docs/VERIFICATION.md"
  "Dockerfile"
  "compose.yaml"
  "compose.monitoring.yaml"
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
# 3. Backend Build & Test Suite (.NET 8)
# ------------------------------------------------------------------------------
echo "[3/6] Checking .NET solution and running test suite..."
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
# 4. Frontend Type-Check & Production Build (React 19 + Vite)
# ------------------------------------------------------------------------------
echo "[4/6] Checking Web Frontend build..."
if [ -f "src/ediens-web/package.json" ]; then
  echo "  Building web app production bundle..."
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
# 5. Dockerfile & Compose Stack Configuration Validation
# ------------------------------------------------------------------------------
echo "[5/6] Validating Docker Compose and Container configurations..."
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
# 6. Observability & Monitoring Assets Validation
# ------------------------------------------------------------------------------
echo "[6/6] Validating Prometheus rules and Grafana dashboard JSON..."
if ! jq empty infra/monitoring/grafana/dashboards/ediens_overview.json 2>/dev/null; then
  echo "  [ERROR] Invalid JSON in Grafana dashboard infra/monitoring/grafana/dashboards/ediens_overview.json"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ Grafana dashboard JSON is valid."
fi

# Check that alert rules contain mandatory alert names
for alert_name in "EdiensApiDown" "HighApiLatencyP95" "HighHttp5xxErrorRate" "HighInventoryConcurrencyConflicts"; do
  if ! grep -q "$alert_name" infra/monitoring/prometheus/alert_rules.yml; then
    echo "  [ERROR] Missing expected alert rule: $alert_name in infra/monitoring/prometheus/alert_rules.yml"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  ✓ Alert rules validated."

# ------------------------------------------------------------------------------
# Summary & Exit Code
# ------------------------------------------------------------------------------
if [ "$ERRORS" -gt 0 ]; then
  echo "=============================================="
  echo " Verification FAILED with $ERRORS error(s)."
  echo "=============================================="
  exit 1
else
  echo "=============================================="
  echo " Verification PASSED successfully."
  echo "=============================================="
  exit 0
fi

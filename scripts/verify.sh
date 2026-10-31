#!/usr/bin/env bash
set -euo pipefail

# scripts/verify.sh
# Verification script for ēdiens project across documentation, backend, and frontend.

echo "=============================================="
echo " Running ēdiens Verification Suite"
echo "=============================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

echo "[1/4] Checking task queue JSON validity..."
for task_file in .agents/tasks/TASK-*.json; do
  if [ -f "$task_file" ]; then
    if ! jq empty "$task_file" 2>/dev/null; then
      echo "  [ERROR] Invalid JSON in $task_file"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done
echo "  ✓ Task files valid."

echo "[2/4] Verifying required foundational documents..."
REQUIRED_DOCS=(
  "AGENTS.md"
  ".agents/WORKFLOW.md"
  ".agents/KNOWLEDGE.md"
  "docs/Ediens_SRS.md"
  "docs/Ediens_OpenAPI.yaml"
)
for doc in "${REQUIRED_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "  [WARNING] Expected document missing: $doc"
  fi
done
echo "  ✓ Document check completed."

echo "[3/4] Checking .NET solution/project if present..."
if [ -f "src/Ediens.Api/Ediens.Api.csproj" ]; then
  echo "  Compiling .NET API..."
  dotnet build src/Ediens.Api/Ediens.Api.csproj
  if [ -f "src/Ediens.Tests/Ediens.Tests.csproj" ]; then
    echo "  Running tests..."
    dotnet test src/Ediens.Tests/Ediens.Tests.csproj
  fi
else
  echo "  (No .NET project files yet - scheduled for TASK-04)"
fi

echo "[4/4] Checking Web Frontend if present..."
if [ -f "src/ediens-web/package.json" ]; then
  echo "  Building web app..."
  (cd src/ediens-web && npm run build)
else
  echo "  (No Web frontend files yet - scheduled for TASK-05)"
fi

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

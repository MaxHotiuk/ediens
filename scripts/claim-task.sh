#!/usr/bin/env bash
set -euo pipefail

# scripts/claim-task.sh
# Atomic task locking script for Multi-PC Antigravity agents on the ēdiens project.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOSTNAME_VAL="$(hostname -s 2>/dev/null || hostname || echo "unknown-agent")"
MAX_ATTEMPTS=5
ATTEMPT=1

echo "=========================================================="
echo " ēdiens Task Claiming Engine"
echo " Host: $HOSTNAME_VAL"
echo "=========================================================="

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  echo "--> [Attempt $ATTEMPT/$MAX_ATTEMPTS] Syncing develop branch..."
  git checkout develop
  git fetch origin develop
  git reset --hard origin/develop

  # Run Python helper to find the first eligible task
  CLAIM_INFO=$(python3 - << 'EOF'
import glob
import json
import os
import sys

tasks = sorted(glob.glob(".agents/tasks/TASK-*.json") + glob.glob(".agents/tasks/FIX-*.json") + glob.glob(".agents/tasks/QOL-*.json"))
all_tasks = {}
for path in tasks:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        all_tasks[data["id"]] = data

selected_task = None
for tid in sorted(all_tasks.keys()):
    t = all_tasks[tid]
    if t.get("status") == "TODO":
        deps = t.get("dependencies", [])
        deps_satisfied = all(all_tasks.get(d, {}).get("status") == "DONE" for d in deps)
        if deps_satisfied:
            selected_task = t
            break

if selected_task:
    print(f"{selected_task['id']}|{selected_task['branch']}|{selected_task['title']}")
else:
    print("NONE")
EOF
)

  if [ "$CLAIM_INFO" = "NONE" ]; then
    echo "No tasks currently available for claiming (either all completed, in progress, or waiting on dependencies)."
    exit 0
  fi

  TASK_ID=$(echo "$CLAIM_INFO" | cut -d'|' -f1)
  TASK_BRANCH=$(echo "$CLAIM_INFO" | cut -d'|' -f2)
  TASK_TITLE=$(echo "$CLAIM_INFO" | cut -d'|' -f3)
  TASK_FILE=".agents/tasks/${TASK_ID}.json"

  echo "--> Candidate task found: $TASK_ID ($TASK_TITLE)"
  echo "    Target branch: $TASK_BRANCH"

  # Update JSON using Python
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  python3 - << EOF
import json

with open("$TASK_FILE", "r", encoding="utf-8") as f:
    data = json.load(f)

data["status"] = "IN_PROGRESS"
data["assigned_to"] = "$HOSTNAME_VAL"
data["updated_at"] = "$TIMESTAMP"

with open("$TASK_FILE", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF

  echo "--> Attempting atomic lock commit and push to origin/develop..."
  git add "$TASK_FILE"
  git commit -m "chore(lock): claim $TASK_ID on $HOSTNAME_VAL"

  if git push origin develop; then
    echo "=========================================================="
    echo " SUCCESS: Claimed $TASK_ID on $HOSTNAME_VAL!"
    echo "=========================================================="
    echo "--> Switching to task branch '$TASK_BRANCH'..."
    git checkout -b "$TASK_BRANCH"
    echo ""
    echo "Ready to begin work on $TASK_ID."
    echo "Please read .agents/KNOWLEDGE.md and respect allowed_paths in $TASK_FILE."
    exit 0
  else
    echo "  [CONFLICT] Push rejected! Another PC claimed a task concurrently."
    echo "  Resetting develop and retrying selection..."
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
  fi
done

echo "Failed to claim task after $MAX_ATTEMPTS attempts due to high contention. Please run again."
exit 1

# AGENTS.md — Multi-PC Autonomous Agent Guidelines for ēdiens

Welcome, autonomous agent. You are operating in a multi-PC distributed development environment across 2 or more machines for the project **"ēdiens — єдиний хаб для управління запасами продуктів, підрахунку макросів та рекомендацій рецептів"**.

Strict adherence to the rules below is mandatory to ensure **zero git merge conflicts**, **no duplicated work**, and **isolated atomic execution**.

---

## 1. Prime Directive: Branch & Push Boundaries

- **NEVER push to `main`.** The `main` branch is frozen after genesis.
- **NEVER push unreviewed code directly to `develop`.**
- The ONLY direct commit/push allowed on `develop` is the **task lock acquisition** on `.agents/tasks/TASK-XX.json`.
- All feature and documentation work MUST be developed on dedicated task branches (`docs/TASK-XX-...`, `feat/TASK-XX-...`, `chore/TASK-XX-...`) and merged into `develop`.

---

## 2. Multi-PC Zero-Conflict Protocol (Automated or Manual)

You can run `./scripts/claim-task.sh` to automate steps 2.1–2.4, or execute them manually:

### 2.1 Synchronization & Inspection
1. Checkout and sync `develop`:
   ```bash
   git checkout develop
   git pull origin develop --rebase
   ```
2. Scan `.agents/tasks/TASK-01.json` through `TASK-08.json` in numerical order.
3. Select the first task where:
   - `"status": "TODO"`
   - **ALL** task IDs listed in its `"dependencies"` array have `"status": "DONE"`.

### 2.2 Atomic Locking on `develop`
1. Edit **ONLY** that task's JSON file (`.agents/tasks/TASK-XX.json`):
   - Set `"status": "IN_PROGRESS"`
   - Set `"assigned_to": "<hostname>"` (e.g., `$(hostname -s)`)
   - Set `"updated_at": "<ISO-8601 UTC timestamp>"` (e.g., `$(date -u +"%Y-%m-%dT%H:%M:%SZ")`)
2. Commit and push ONLY that file directly to `origin/develop`:
   ```bash
   git add .agents/tasks/TASK-XX.json
   git commit -m "chore(lock): claim TASK-XX on $(hostname -s)"
   git push origin develop
   ```
3. **Race Condition Recovery:** If `git push origin develop` is rejected (the other PC claimed a task at the exact same second), immediately run:
   ```bash
   git fetch origin
   git reset --hard origin/develop
   ```
   and restart task selection from step 2.1.

### 2.3 Branching & Isolated Development
1. Once your lock push succeeds, switch to the task branch specified in the JSON:
   ```bash
   git checkout -b <branch_name_from_json>
   ```
2. Consult `.agents/KNOWLEDGE.md` for full project specifications, schemas, error formats, and architectural patterns.
3. Modify and create **ONLY** files listed under `"deliverables"` and `"allowed_paths"` in your task JSON. Touching files outside this scope will cause merge conflicts with other agents.
4. Run the verification script before completing:
   ```bash
   ./scripts/verify.sh
   ```

### 2.4 Task Completion & Merge to `develop`
1. Set `"status": "DONE"` and update `"updated_at"` in `.agents/tasks/TASK-XX.json`.
2. Commit your deliverables and updated task JSON using Conventional Commits:
   ```bash
   git add <deliverables> .agents/tasks/TASK-XX.json
   git commit -m "feat(TASK-XX): <concise description of deliverables>"
   ```
3. Push your task branch:
   ```bash
   git push -u origin <branch_name>
   ```
4. Merge into `develop`:
   - If GitHub CLI (`gh`) is authenticated:
     ```bash
     gh pr create --base develop --head <branch_name> --fill
     gh pr merge --merge --auto
     ```
   - If `gh` is not available, merge into local `develop` and push:
     ```bash
     git checkout develop
     git pull origin develop --rebase
     git merge --no-ff <branch_name> -m "merge: TASK-XX into develop"
     git push origin develop
     ```
   This immediately unblocks downstream dependent tasks for the other PC.

---

## 3. Communication and State Files
- `.agents/KNOWLEDGE.md`: Single source of truth for all domain rules, tech stack, APIs, and models.
- `.agents/WORKFLOW.md`: Detailed protocol reference and contingency handling.
- `.agents/tasks/TASK-*.json`: State machine for all pending and running tasks.

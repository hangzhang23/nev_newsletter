# WorkBuddy Global Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect WorkBuddy's weekly CSV output to GitHub so GitHub Actions reliably updates Supabase, regenerates verified static snapshots, and triggers Vercel without manual copying or force pushes.

**Architecture:** A testable TypeScript publisher clones the Git remote into a temporary directory, validates and synchronizes WorkBuddy data, and performs a normal fast-forward push. GitHub Actions reacts to data changes, runs tests, ingests through checked Supabase operations, prerenders deterministic JSON, validates latest-week freshness, and safely commits only generated snapshots.

**Tech Stack:** Node.js 24, TypeScript, Vitest, Git, GitHub Actions, Supabase JS, React/Vite, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-25-workbuddy-global-automation-design.md`

## Global Constraints

- Preserve all existing user changes in `/mnt/e/projects/nev_web`.
- Implement only in `/mnt/e/workbuddy/space/.worktrees/nev-web-global-automation` on `codex/global-automation`.
- Never use `git push --force` or `--force-with-lease`.
- Never print or commit Supabase, GitHub, IMA, or MCP credentials.
- Publisher stages only `data/NEV_weekly_report_*.csv` and `data/brand_colors.json`.
- Supabase writes must fail on the first returned error.
- Generated snapshots must contain the latest valid input week before commit.
- Every behavior change follows RED, GREEN, REFACTOR.

---

### Task 1: Establish a Clean Baseline

**Files:** No production changes.

- [ ] Install dependencies with `npm ci`, `npm --prefix scripts ci`, and `npm --prefix frontend ci`.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Record baseline failures and stop for direction if any failure is unrelated to missing runtime setup.

### Task 2: Extract Checked Supabase Writes

**Files:**
- Create: `scripts/ingest/upsert.ts`
- Create: `scripts/ingest/upsert.test.ts`
- Modify: `scripts/ingest/index.ts`

**Interfaces:**
- `upsertDataset(client, { vehicles, weeks, brands }): Promise<void>` accepts a Supabase-compatible client and throws the exact returned error for vehicles, weeks, or brands.

- [ ] Write tests using a deterministic fake fluent client that returns errors for each table in turn and records call order.
- [ ] Run `npm --prefix scripts test -- ingest/upsert.test.ts`; verify failure because `upsertDataset` is missing.
- [ ] Implement sequential checked upserts with existing conflict keys.
- [ ] Re-run the focused test and all scripts tests; verify zero failures.
- [ ] Update `ingest/index.ts` to call `upsertDataset` without changing normalization behavior.

### Task 3: Build the WorkBuddy Publisher

**Files:**
- Create: `scripts/publish/data-files.ts`
- Create: `scripts/publish/data-files.test.ts`
- Create: `scripts/publish/git.ts`
- Create: `scripts/publish/git.test.ts`
- Create: `scripts/publish/index.ts`
- Modify: `scripts/package.json`
- Modify: `package.json`

**Interfaces:**
- `selectDataFiles(sourceDir): SelectedData` validates filename dates, non-empty content, `brand_colors.json`, and `_fixed.csv` precedence.
- `syncSelectedData(selection, destinationDir): Promise<{ changed: string[] }>` writes only changed whitelist files.
- `publishData(options): Promise<{ status: "pushed" | "unchanged"; period: string }>` uses a temporary single-branch clone, normal push, one clean retry on non-fast-forward rejection, and unconditional cleanup.

- [ ] Write file-selection tests for whitelist filtering, fixed-file precedence, invalid dates, empty CSV, missing brand colors, and idempotent sync.
- [ ] Run the focused test and verify RED due to missing exports.
- [ ] Implement minimal file selection and synchronization; verify GREEN.
- [ ] Write real local-Git integration tests using a temporary bare remote for unchanged, pushed, retry-safe, commit-message, whitelist, and source-worktree-preservation behavior.
- [ ] Run the Git tests and verify RED due to missing publisher.
- [ ] Implement command execution with argument arrays, temporary clone cleanup, robot identity, normal push, and one retry; verify GREEN.
- [ ] Add `publish:data` scripts at scripts and root package levels.

### Task 4: Validate Snapshot Freshness

**Files:**
- Create: `scripts/validate-snapshot/index.ts`
- Create: `scripts/validate-snapshot/index.test.ts`
- Modify: `scripts/package.json`
- Modify: `package.json`

**Interfaces:**
- `latestInputWeek(dataDir): WeekMeta` uses the same fixed-file precedence as ingest.
- `validateSnapshot(dataDir, publicDataDir): void` throws unless `trend_weekly.json` includes the latest week and `vehicles.json` includes at least one vehicle assigned to it.

- [ ] Write tests for latest-week selection, fixed precedence, missing/corrupt JSON, stale trend data, stale vehicles, and a fresh snapshot.
- [ ] Run the focused test and verify RED due to missing validator.
- [ ] Implement the minimal validator and CLI; verify focused and full scripts tests GREEN.
- [ ] Add root `validate:snapshot` command.

### Task 5: Harden GitHub Actions

**Files:**
- Modify: `.github/workflows/weekly-update.yml`

- [ ] Add `push` trigger for `main` scoped to `data/**`, retain schedule and manual trigger.
- [ ] Add workflow concurrency with `cancel-in-progress: false`.
- [ ] Checkout full history and use Node 24 with `npm ci` for scripts and frontend.
- [ ] Run tests, typecheck, and build before database mutation.
- [ ] Run ingest, prerender, and `validate:snapshot` in order.
- [ ] Commit only `frontend/public/data` with a normal push.
- [ ] Replace force push with a bounded pull/rebase retry that never overwrites remote business commits.
- [ ] Validate YAML syntax and assert by test/script that no force-push token remains.

### Task 6: Add the WorkBuddy Entry Point and Documentation

**Files:**
- Create: `scripts/publish-workbuddy.cmd`
- Create: `docs/automation/workbuddy-integration.md`
- Modify: `.env.example`

- [ ] Add a Windows wrapper that resolves the repository from its own path and runs `npm run publish:data` with `NEV_DATA_DIR` defaulting to `E:\workbuddy\space`.
- [ ] Document the exact final step to append to `weekly-new-nev-investigation`, required local Git credentials, environment overrides, exit semantics, GitHub Secrets, recovery, and manual dry verification.
- [ ] Document that the WorkBuddy platform definition is external to the inspected project files; the integration contract is the wrapper command.
- [ ] Run secret-pattern scanning over all changed files.

### Task 7: Sync W34 and Verify End to End Locally

**Files:**
- Create: `data/NEV_weekly_report_20260816_20260822.csv`
- Potentially modify: `data/brand_colors.json` only when source content differs.

- [ ] Run the selection/sync layer against `/mnt/e/workbuddy/space` without pushing.
- [ ] Verify W34 is selected as the latest period and only whitelist data changes appear.
- [ ] Run all scripts tests, frontend tests, typecheck, and production build.
- [ ] Run ingest/prerender only if valid Supabase credentials are available; otherwise verify the pure pipeline and report cloud verification as pending authorization.
- [ ] Run `git diff --check`, inspect the final diff, and verify no user files outside scope changed.

### Task 8: Finish the Branch

**Files:** All scoped implementation files.

- [ ] Invoke `superpowers:verification-before-completion` and rerun every required verification fresh.
- [ ] Invoke `superpowers:requesting-code-review` for the completed change.
- [ ] Invoke `superpowers:finishing-a-development-branch` and present merge/push choices.
- [ ] Do not push, trigger GitHub Actions, write Supabase, or deploy Vercel without explicit authorization at the finishing step.

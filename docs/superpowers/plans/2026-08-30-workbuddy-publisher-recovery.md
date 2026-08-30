# WorkBuddy Publisher Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WorkBuddy's GitHub publication self-healing with a stable entry point and a 15-minute Windows retry task.

**Architecture:** A PowerShell runner owns a dedicated clean clone under WorkBuddy state, serializes invocations with a cross-session file lock, keeps unique pending request tokens, logs durable outcomes, fast-forwards itself from remote main, and invokes the existing idempotent TypeScript publisher. A separate installer copies the runner and wrapper to their stable paths and registers one current-user scheduled task.

**Tech Stack:** Windows PowerShell 5.1, Git for Windows, npm, TypeScript, Vitest, Windows Task Scheduler.

**Spec:** `docs/superpowers/specs/2026-08-30-workbuddy-publisher-recovery-design.md`

## Global Constraints

- Preserve all existing user changes in `E:\projects\nev_web`.
- Never use force push or print credentials.
- Only the dedicated `.workbuddy\publisher\nev_web` checkout may be reset to remote main.
- A repeated run with already-published data must remain a successful no-op.

---

### Task 1: Specify the Windows recovery contract

**Files:**
- Create: `scripts/publish/windows-recovery.test.ts`

**Interfaces:**
- Consumes: repository text files.
- Produces: static assertions for stable path, locking, logging, safe clone validation, 15-minute schedule, and WorkBuddy integration docs.

- [ ] Write the contract test before production files exist.
- [ ] Run the focused test and confirm it fails on missing files.

### Task 2: Implement the stable runner and installer

**Files:**
- Create: `scripts/workbuddy-publisher.ps1`
- Create: `scripts/install-workbuddy-publisher.ps1`
- Modify: `scripts/publish-workbuddy.cmd`

**Interfaces:**
- `workbuddy-publisher.ps1` returns `0` only for a remotely verified push or unchanged data.
- `install-workbuddy-publisher.ps1` creates the fixed launcher and replaces the single scheduled task idempotently.

- [ ] Implement a cross-session file lock, durable log, pending request tokens, remote preflight, reparse-point and Git-path validation, fast-forward refresh, deterministic dependency install, redaction, and publisher invocation.
- [ ] Implement stable-file installation and a 15-minute scheduled task.
- [ ] Make the repository wrapper delegate to the stable launcher after installation and directly invoke the runner before installation.
- [ ] Run the focused test and confirm it passes.

### Task 3: Integrate and document operations

**Files:**
- Modify: `docs/automation/workbuddy-integration.md`
- External install target: `E:\workbuddy\space\.workbuddy\bin`
- External WorkBuddy skill: `C:\Users\Tars\.workbuddy\skills\nev-weekly-workflow\SKILL.md`

**Interfaces:**
- WorkBuddy stage three calls the fixed launcher.
- Operators can inspect one log and one scheduled task for recovery status.

- [ ] Document one-time install, authentication preflight, retry behavior, logs, and uninstall command.
- [ ] Install the stable runner files without touching the dirty project checkout.
- [ ] Update the WorkBuddy stage-three command to the stable launcher.

### Task 4: Verify and finish

**Files:** All scoped files.

- [ ] Run focused and full tests, typecheck/build where the runtime permits.
- [ ] Run secret-pattern and force-push scans plus `git diff --check`.
- [ ] Verify the scheduled task and run the stable launcher once from Windows.
- [ ] Confirm GitHub main contains W35, then observe Actions, Supabase, and Vercel closure.

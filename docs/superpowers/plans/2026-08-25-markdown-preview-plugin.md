# Markdown Preview Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, validate, and install a personal Codex plugin that securely previews workspace Markdown files in a local browser with offline rendering and live reload.

**Architecture:** A Codex skill invokes a Python launcher bundled in the plugin. The launcher validates a requested workspace path, starts or reuses a token-protected HTTP server on `127.0.0.1`, and serves a vendored browser renderer; no MCP process, cloud service, or runtime network request is required.

**Tech Stack:** Codex personal plugins, Python 3 standard library, `unittest`, vendored markdown-it 14.1.0, Mermaid 11.12.2, highlight.js 11.11.1, DOMPurify 3.2.6.

**Spec:** `docs/superpowers/specs/2026-08-25-markdown-preview-plugin-design.md`

## Global Constraints

- Plugin name and outer folder are exactly `markdown-preview`.
- Preview server listens only on `127.0.0.1`.
- Runtime makes no network requests and uploads no content.
- Only `.md` files inside explicitly allowed canonical workspace roots may be read.
- Relative assets may be served only when their canonical paths remain inside an allowed workspace root.
- Raw rendered HTML is sanitized before DOM insertion; Markdown scripts never execute.
- No permanently running daemon; idle timeout is 30 minutes.
- Use the default personal marketplace at `/mnt/c/Users/Tars/.agents/plugins/marketplace.json`.
- Existing project changes and personal marketplace entries must be preserved.

---

## File Structure

- `/mnt/c/Users/Tars/plugins/markdown-preview/.codex-plugin/plugin.json`: plugin identity and Codex UI metadata.
- `/mnt/c/Users/Tars/plugins/markdown-preview/skills/markdown-preview/SKILL.md`: preview request routing and launcher invocation contract.
- `/mnt/c/Users/Tars/plugins/markdown-preview/scripts/preview.py`: CLI, validation, state management, server, browser launch, and shutdown lifecycle.
- `/mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py`: behavior tests against real temporary files and a real loopback HTTP server.
- `/mnt/c/Users/Tars/plugins/markdown-preview/assets/index.html`: preview UI shell and refresh client.
- `/mnt/c/Users/Tars/plugins/markdown-preview/assets/preview.css`: responsive GitHub-style light/dark presentation.
- `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/`: pinned offline JavaScript and CSS assets.
- `/mnt/c/Users/Tars/.agents/plugins/marketplace.json`: scaffold-managed personal marketplace entry.

### Task 1: Scaffold and Validate the Plugin Contract

**Files:**
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/.codex-plugin/plugin.json`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/skills/markdown-preview/SKILL.md`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/scripts/`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/tests/`
- Modify: `/mnt/c/Users/Tars/.agents/plugins/marketplace.json`

**Interfaces:**
- Consumes: plugin name `markdown-preview` and default personal marketplace rules.
- Produces: a valid plugin source tree whose skill calls `python3 <plugin-root>/scripts/preview.py --file <absolute-md-path> --root <absolute-workspace-root> --open`.

- [ ] **Step 1: Read the required skill-authoring instructions**

Read completely before editing:

```bash
sed -n '1,420p' /mnt/c/Users/Tars/.codex/skills/.system/skill-creator/SKILL.md
sed -n '1,420p' /mnt/c/Users/Tars/.codex/plugins/cache/openai-curated-remote/superpowers/6.3.0/skills/writing-skills/SKILL.md
```

- [ ] **Step 2: Scaffold the personal plugin and marketplace entry**

Run from the plugin-creator skill root:

```bash
python3 scripts/create_basic_plugin.py markdown-preview \
  --path /mnt/c/Users/Tars/plugins \
  --marketplace-path /mnt/c/Users/Tars/.agents/plugins/marketplace.json \
  --with-skills --with-scripts --with-assets --with-marketplace
```

Expected: `/mnt/c/Users/Tars/plugins/markdown-preview` exists and the personal marketplace contains one `markdown-preview` entry with `AVAILABLE`, `ON_INSTALL`, and `Productivity`.

- [ ] **Step 3: Write the manifest and skill contract**

Set manifest values to:

```json
{
  "name": "markdown-preview",
  "version": "0.1.0",
  "description": "Secure local browser previews for workspace Markdown files.",
  "author": { "name": "Tars" },
  "skills": "./skills/",
  "interface": {
    "displayName": "Markdown Preview",
    "shortDescription": "Preview local Markdown safely",
    "longDescription": "Open workspace Markdown in a secure local browser preview with Mermaid, code highlighting, an outline, and live refresh.",
    "developerName": "Tars",
    "category": "Productivity",
    "capabilities": ["Interactive", "Read"],
    "defaultPrompt": [
      "Preview this Markdown file",
      "Open the current design document",
      "Show this README with Mermaid rendered"
    ],
    "brandColor": "#2563EB"
  }
}
```

The skill must require an absolute `.md` target and an absolute workspace root, refuse inferred roots broader than the current workspace, invoke the launcher, and return its `PREVIEW_URL=` output as a clickable link when browser opening fails.

- [ ] **Step 4: Validate the empty scaffold contract**

Run:

```bash
python3 scripts/validate_plugin.py /mnt/c/Users/Tars/plugins/markdown-preview
python3 ../skill-creator/scripts/quick_validate.py /mnt/c/Users/Tars/plugins/markdown-preview/skills/markdown-preview
```

Expected: both validators exit 0 with no placeholders.

- [ ] **Step 5: Commit plugin source if the scaffold initializes or belongs to a Git repository**

If `git -C /mnt/c/Users/Tars/plugins/markdown-preview rev-parse --is-inside-work-tree` succeeds:

```bash
git -C /mnt/c/Users/Tars/plugins/markdown-preview add .
git -C /mnt/c/Users/Tars/plugins/markdown-preview commit -m "chore: scaffold markdown preview plugin"
```

Otherwise record that the personal plugin directory is not version-controlled and continue without initializing an unrelated repository.

### Task 2: Implement Secure Path and Capability Handling with TDD

**Files:**
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/scripts/preview.py`

**Interfaces:**
- Produces: `canonical_markdown(file_path: Path, roots: list[Path]) -> tuple[Path, Path]`, `resolve_asset(asset_path: str, document_dir: Path, root: Path) -> Path`, and `new_token() -> str`.
- Consumed by: Task 3 HTTP handler and CLI.

- [ ] **Step 1: Write failing validation tests**

Tests must create real temporary roots and assert:

```python
class PathValidationTests(unittest.TestCase):
    def test_accepts_markdown_inside_root(self): ...
    def test_rejects_non_markdown(self): ...
    def test_rejects_missing_file(self): ...
    def test_rejects_file_outside_root(self): ...
    def test_rejects_symlink_escape(self): ...
    def test_allows_relative_image_inside_root(self): ...
    def test_rejects_relative_image_escape(self): ...
```

- [ ] **Step 2: Run tests and verify RED**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: import or missing-symbol failures for `canonical_markdown` and `resolve_asset`.

- [ ] **Step 3: Implement minimal canonical validation**

Use `Path.resolve(strict=True)`, require `.suffix.lower() == ".md"`, and use `Path.relative_to(canonical_root)` for containment. Resolve symlinks before containment. Generate tokens with `secrets.token_urlsafe(32)`.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: all path and token tests pass.

- [ ] **Step 5: Commit the tested security core when version-controlled**

```bash
git -C /mnt/c/Users/Tars/plugins/markdown-preview add scripts/preview.py tests/test_preview.py
git -C /mnt/c/Users/Tars/plugins/markdown-preview commit -m "feat: validate markdown preview paths"
```

### Task 3: Implement the Loopback Preview Server with TDD

**Files:**
- Modify: `/mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py`
- Modify: `/mnt/c/Users/Tars/plugins/markdown-preview/scripts/preview.py`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/index.html`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/preview.css`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/markdown-it.min.js`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/mermaid.min.js`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/highlight.min.js`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/github-dark.min.css`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/github.min.css`
- Create: `/mnt/c/Users/Tars/plugins/markdown-preview/assets/vendor/purify.min.js`

**Interfaces:**
- Consumes: validated document, canonical root, and capability token from Task 2.
- Produces: `PreviewServer`, endpoints `/<token>/`, `/<token>/document`, `/<token>/version`, and `/<token>/asset/<encoded-relative-path>`.

- [ ] **Step 1: Write failing real-server tests**

Start `PreviewServer` on port `0` in a test thread and use `urllib.request` to verify:

```python
class PreviewServerTests(unittest.TestCase):
    def test_wrong_token_returns_404(self): ...
    def test_document_returns_utf8_markdown(self): ...
    def test_version_changes_after_file_update(self): ...
    def test_asset_endpoint_serves_contained_image(self): ...
    def test_asset_endpoint_rejects_escape(self): ...
    def test_index_sets_no_store_and_csp_headers(self): ...
```

- [ ] **Step 2: Run tests and verify RED**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: failures because `PreviewServer` and endpoints do not exist.

- [ ] **Step 3: Implement minimal server behavior**

Use `ThreadingHTTPServer(("127.0.0.1", 0), handler)`. Return `404` for invalid tokens, `Cache-Control: no-store` everywhere, and this CSP for the preview page:

```text
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';
```

The document endpoint returns raw UTF-8 Markdown as `text/plain`; the browser uses vendored markdown-it, DOMPurify, Mermaid, and highlight.js. It rewrites relative image URLs to the tokenized asset endpoint, builds the heading outline, polls `/version` every 1000 ms, and reloads content only when `mtime_ns:size` changes.

- [ ] **Step 4: Vendor pinned renderer assets**

Download exact versions during implementation, then record SHA-256 hashes in `assets/vendor/SHA256SUMS`:

```text
markdown-it 14.1.0
mermaid 11.12.2
highlight.js 11.11.1
DOMPurify 3.2.6
```

No `latest` URLs are allowed. Runtime HTML references only local `/static/...` paths.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: all server and security tests pass without network access.

- [ ] **Step 6: Commit the tested preview server when version-controlled**

```bash
git -C /mnt/c/Users/Tars/plugins/markdown-preview add scripts tests assets
git -C /mnt/c/Users/Tars/plugins/markdown-preview commit -m "feat: add secure live markdown preview"
```

### Task 4: Add Lifecycle, CLI, and Browser Fallback with TDD

**Files:**
- Modify: `/mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py`
- Modify: `/mnt/c/Users/Tars/plugins/markdown-preview/scripts/preview.py`

**Interfaces:**
- Produces CLI: `preview.py --file PATH --root ROOT [--open] [--idle-seconds 1800]` and stdout `PREVIEW_URL=http://127.0.0.1:<port>/<token>/`.
- Consumed by: plugin skill and manual verification.

- [ ] **Step 1: Write failing lifecycle tests**

Add tests for argument validation, state-file permission mode where supported, reuse of a healthy matching server, stale-state replacement, idle shutdown, and a browser-open failure that still prints `PREVIEW_URL` and exits 0.

- [ ] **Step 2: Run tests and verify RED**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: lifecycle and CLI tests fail because state and CLI orchestration are absent.

- [ ] **Step 3: Implement minimal lifecycle and CLI**

Store state under `tempfile.gettempdir()/markdown-preview-<uid>/state.json`, create directories with user-only permissions where supported, verify reused servers through their tokenized version endpoint, and spawn a detached child server. Use `webbrowser.open(url)` only for `--open`; always print the URL.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
```

Expected: all tests pass and leave no server processes behind.

- [ ] **Step 5: Commit the tested launcher when version-controlled**

```bash
git -C /mnt/c/Users/Tars/plugins/markdown-preview add scripts/preview.py tests/test_preview.py
git -C /mnt/c/Users/Tars/plugins/markdown-preview commit -m "feat: add preview launcher lifecycle"
```

### Task 5: Validate, Install, and Exercise the Plugin

**Files:**
- Verify: `/mnt/c/Users/Tars/plugins/markdown-preview/**`
- Verify: `/mnt/c/Users/Tars/.agents/plugins/marketplace.json`
- Preview: `/mnt/e/projects/nev_web/docs/superpowers/specs/2026-08-25-markdown-preview-plugin-design.md`

**Interfaces:**
- Consumes: completed plugin source and personal marketplace entry.
- Produces: installed `markdown-preview@personal` plugin and a working preview URL.

- [ ] **Step 1: Run the complete automated verification suite**

```bash
python3 -m unittest -v /mnt/c/Users/Tars/plugins/markdown-preview/tests/test_preview.py
python3 /mnt/c/Users/Tars/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py /mnt/c/Users/Tars/plugins/markdown-preview
python3 /mnt/c/Users/Tars/.codex/skills/.system/skill-creator/scripts/quick_validate.py /mnt/c/Users/Tars/plugins/markdown-preview/skills/markdown-preview
```

Expected: zero failed tests and both validators exit 0.

- [ ] **Step 2: Read and use the validated marketplace name**

```bash
python3 /mnt/c/Users/Tars/.codex/skills/.system/plugin-creator/scripts/read_marketplace_name.py
```

Expected: `personal` unless an existing valid personal marketplace uses another name.

- [ ] **Step 3: Install the plugin through Codex CLI**

```bash
codex plugin add markdown-preview@personal
codex plugin list
```

Expected: plugin list reports `markdown-preview` installed from the personal local marketplace.

- [ ] **Step 4: Launch the design document preview**

```bash
python3 /mnt/c/Users/Tars/plugins/markdown-preview/scripts/preview.py \
  --file /mnt/e/projects/nev_web/docs/superpowers/specs/2026-08-25-markdown-preview-plugin-design.md \
  --root /mnt/e/projects/nev_web \
  --open
```

Expected: stdout contains a loopback `PREVIEW_URL`; the page renders headings, lists, code, and updates after a temporary non-semantic edit/revert cycle.

- [ ] **Step 5: Perform the security smoke checks**

Confirm an incorrect token returns 404, `/etc/passwd` is rejected as both a document and asset, no listener exists on `0.0.0.0`, and browser developer tools show no runtime network requests outside `127.0.0.1`.

- [ ] **Step 6: Final handoff**

Tell the user to start a new Codex task so the installed skill is loaded. Provide the generated Codex `View markdown-preview` and `Share markdown-preview` personal-marketplace links using the absolute marketplace path.

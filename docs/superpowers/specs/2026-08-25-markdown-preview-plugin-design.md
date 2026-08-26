# Markdown Preview Plugin Design

## Goal

Create a personal Codex plugin named `markdown-preview` that opens a workspace Markdown file in a readable local browser preview with GitHub-style rendering, Mermaid diagrams, syntax highlighting, a heading outline, and automatic refresh.

## Scope

The plugin previews existing local `.md` files. It does not edit Markdown, publish files, synchronize cloud storage, or expose the preview outside the local machine.

## Plugin Structure

The plugin contains:

- `.codex-plugin/plugin.json`: validated Codex plugin manifest.
- `skills/markdown-preview/SKILL.md`: routes preview requests to the bundled launcher.
- `scripts/preview.py`: validates paths, manages the local HTTP server, and returns or opens the preview URL.
- `assets/`: pinned browser-side Markdown, Mermaid, and syntax-highlighting resources plus the preview shell.
- Personal marketplace entry in the default Codex marketplace.

No MCP server is required. The skill invokes the bundled launcher directly, keeping the plugin smaller and avoiding a permanently running background process.

## User Flow

1. The user asks Codex to preview a Markdown file.
2. The skill resolves the requested file to an absolute path.
3. The launcher verifies that the target exists, has a `.md` extension, and is inside an allowed workspace root.
4. The launcher starts or reuses a server bound to `127.0.0.1` on an available port.
5. The server returns a random per-process capability URL rather than accepting arbitrary filesystem paths in the URL.
6. The launcher attempts to open the default browser. If the environment cannot open a browser, Codex returns the local URL as a clickable link.
7. The browser polls file metadata and reloads the rendered document when the file changes.

## Rendering

The preview shell provides:

- GitHub-flavored Markdown tables, task lists, fenced code, and anchors.
- Mermaid rendering for fenced `mermaid` blocks.
- Syntax highlighting for common code blocks.
- A generated heading outline.
- Responsive light and dark themes.
- Local relative images resolved against the Markdown file directory.

Renderer assets are vendored at fixed versions so previews work without internet access. Markdown output is sanitized before insertion into the page. Raw script execution from Markdown is disabled.

## Security

- Listen only on `127.0.0.1`, never `0.0.0.0`.
- Accept only `.md` files under workspace roots supplied by Codex or the launcher configuration.
- Canonicalize paths before containment checks to block `..` traversal and symlink escapes.
- Serve relative images only when their canonical path remains under the Markdown file's workspace root.
- Use a random capability token for preview and refresh endpoints.
- Escape document metadata and sanitize rendered HTML.
- Do not upload Markdown or make runtime network requests.
- Do not expose directory listings or arbitrary file-read endpoints.

## Process Lifecycle

The launcher records the server PID, port, token, and allowed root in a temporary state file scoped to the current user. It reuses a healthy matching server. An idle server exits after 30 minutes, and stale state files are removed on the next launch.

## Compatibility

Primary target: Codex Desktop on Windows with workspaces mounted into WSL under `/mnt/<drive>/...`.

The launcher uses Python 3 standard-library server functionality. Browser opening is best-effort across Windows, WSL, macOS, and Linux. Preview remains usable through the returned URL if focus cannot be transferred automatically.

## Testing

Automated tests cover:

- Valid workspace Markdown acceptance.
- Rejection of non-Markdown files and missing files.
- Rejection of paths outside allowed roots.
- Rejection of traversal and symlink escape attempts.
- Capability-token enforcement.
- Relative-image containment.
- File-change version updates.
- Server reuse and stale-state recovery.
- Manifest and plugin validation.

Manual verification covers Markdown tables, task lists, code blocks, Mermaid, local images, dark mode, live refresh, and browser launch fallback.

## Installation

Use the Codex plugin scaffold and the default personal marketplace at `~/.agents/plugins/marketplace.json`. Validate the plugin before installation. Because this writes outside the project workspace, Codex requests explicit filesystem approval before scaffolding or marketplace registration. After installation, the user refreshes or restarts Codex and invokes the plugin by asking to preview a Markdown file.

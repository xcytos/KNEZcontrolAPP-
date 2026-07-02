## What I found (current repo state)
- There is an existing repo-level .taqwin memory mesh with TAQWIN/MCP artifacts, including TAQWIN capability registry and CP12 docs.
- The Control App already implements MCP over STDIO (spawn via Tauri, JSON-RPC 2.0, Content-Length + line fallback), with an Inspector UI and Playwright coverage.
- The MCP host config format currently only models STDIO servers (command/args/env/cwd). It does not model remote HTTP MCP servers.

## Core learnings to import from github/github-mcp-server
- Remote GitHub MCP server is an HTTP MCP endpoint at https://api.githubcopilot.com/mcp/ supporting toolset selection via URL paths (/x/{toolset}, /readonly, /insiders) and via headers (X-MCP-Toolsets, X-MCP-Tools, X-MCP-Readonly, X-MCP-Lockdown, X-MCP-Insiders).
- Local GitHub MCP server can run via Docker (ghcr.io/github/github-mcp-server) or built binary; configured via env vars (GITHUB_PERSONAL_ACCESS_TOKEN, GITHUB_TOOLSETS, GITHUB_TOOLS, GITHUB_READ_ONLY, GITHUB_LOCKDOWN_MODE, GITHUB_INSIDERS).
- Best practice: avoid hardcoding PATs; prefer prompted inputs or environment variables; support read-only and lockdown modes.

## Step 1 — Save GitHub MCP repo as a local reference
- Create a dedicated reference location inside this workspace (so it can be indexed/searchable by the Control App team):
  - vendor/github-mcp-server/ (full clone) OR vendor/github-mcp-server/ as a git submodule.
- Add a small “reference index” doc (docs/reference/github-mcp-server.md) that links to the key upstream docs we’ll rely on (remote server config, toolsets, security modes).

## Step 2 — Append learnings into .taqwin memory mesh + docs index
- Add .taqwin/memory/github-mcp-server.md containing:
  - Remote vs local server configuration patterns
  - Toolsets/tools/readonly/lockdown/insiders mapping (headers ↔ env vars)
  - Token-handling rules (never store secrets in git; prefer prompted inputs)
- Update .taqwin/memory/taqwin-capabilities.md with an “MCP Host Config Extensions” section describing the new HTTP server fields and input substitution.
- Add docs/taqwin/index.md as a table-of-contents for TAQWIN + MCP operator docs and troubleshooting.

## Step 3 — Upgrade Control App MCP to support HTTP (Remote MCP Servers)
- Extend MCP config schema to support both:
  - stdio servers (current)
  - http servers (new): { type: "http", url, headers?, toolsets?, readonly?, lockdown?, insiders? }
- Implement “inputs” and ${input:...} substitution compatible with common MCP host configs:
  - Allow config blocks like:
    - inputs: [{ type:"promptString", id:"github_mcp_pat", password:true, description:"..." }]
    - headers: { Authorization: "Bearer ${input:github_mcp_pat}" }
  - In the Control App, prompt the operator at runtime for any missing inputs.
  - Never persist secret values to disk by default; keep them in-memory for the session.
- Add an MCP HTTP client (Streamable HTTP):
  - POST JSON-RPC requests to the configured url
  - Accept application/json and text/event-stream (SSE) responses
  - Parse SSE streams when present; fall back to JSON responses
  - Feed all traffic into the existing Inspector traffic log model.
- Refactor Inspector/registry internals to treat “client transport” as an interface so STDIO and HTTP servers share:
  - start/stop, initialize, tools/list, tools/call
  - traffic/debug state

## Step 4 — Add GitHub MCP presets + UI affordances
- Add default config presets for:
  - Remote GitHub MCP server (PAT via prompted input; optional readonly/lockdown/toolsets)
  - Local GitHub MCP server (docker run -i --rm … with env)
- Add Inspector UI fields for HTTP servers:
  - Show URL, headers (redacted values), active toolset selection, readonly/lockdown/insiders
  - “Test connect” button (initialize + tools/list)
  - Clear error surfacing for 401/403/404 and network failures.

## Step 5 — Tests + verification
- Unit tests:
  - config parsing/normalization for stdio + http
  - ${input:...} substitution and redaction behavior
- Integration tests:
  - a local mock HTTP MCP server (node) used by Playwright/Vitest to validate initialize/tools/list/tools/call flows without external network.
- Update the existing Playwright MCP Inspector test to cover the new HTTP server rendering and validation.

## Step 6 — “30 tickets” backlog deliverable
- Create a new 30-ticket doc (docs/tickets/CONTROL_APP_30_MCP_TICKETS.md) that includes:
  - P0: HTTP transport + inputs + security (no secret persistence)
  - P0: GitHub MCP remote/local presets
  - P0: Inspector parity for HTTP (traffic, status, retry)
  - P1: toolset/readonly/lockdown UX controls
  - P1: diagnostics bundle includes MCP http traces (redacted)
  - P2: dynamic toolset discovery UX + future OAuth support

## Outcome
- Control App becomes a real MCP host for both TAQWIN (stdio) and GitHub MCP (http/docker) with standardized configuration, safer secret handling, and better Inspector tooling.

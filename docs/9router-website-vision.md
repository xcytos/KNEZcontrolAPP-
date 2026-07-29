# 9Router Website Vision — Living Document (Chrome DevTools MCP Reference)

> PURPOSE: This document is the visual/structural map of the 9Router dashboard
> (http://localhost:20128). It is maintained so that every future Chrome DevTools MCP
> session can navigate, locate elements, and perform actions on the 9Router site
> WITHOUT re-discovering the layout. Update it whenever the site changes.
>
> Last updated: 2026-07-12 · 9Router version: v0.5.30 (note: `NineRouterService.ts`
> hardcodes v0.5.15 — stale; trust the live site).

---

## 1. Access & Auth
- Base URL: `http://localhost:20128`
- Dashboard root: `http://localhost:20128/dashboard`
- API (OpenAI-compatible): `http://localhost:20128/v1`  (models: `/v1/models`, chat: `/v1/chat/completions`)
- Login page: `http://localhost:20128/login`
  - Default password: `123456` (filled into the single password textbox, then click "Login").
  - After first remote login you may be prompted to set a password.
- If not authenticated, any `/dashboard/*` URL redirects to `/login`.

## 2. Sidebar Navigation Map (left rail)
Every entry is a `<link>` with an `url=` and a leading icon (Material icon text).
Use the `url` to `navigate_page` directly instead of clicking — faster & stable.

| Label | URL | Notes |
|---|---|---|
| hub · 9Router Proxy | `/dashboard` | Home |
| api · Endpoint & Key | `/dashboard/endpoint` | Shows the proxy base URL + API key |
| dns · Providers | `/dashboard/providers` | **Main provider management page** |
| layers · Combos | `/dashboard/combos` | Model combos |
| bar_chart · Usage | `/dashboard/usage` | Usage stats |
| data_usage · Quota Tracker | `/dashboard/quota` | Per-provider quota |
| savings · Token Saver | `/dashboard/token-saver` | Token savings |
| terminal · CLI Tools | `/dashboard/cli-tools` | Local CLI tooling |
| (SYSTEM) perm_media · Media Providers | button (expand) | Media providers group |
| lan · Proxy Pools | `/dashboard/proxy-pools` | Proxy pools |
| extension · Skills | `/dashboard/skills` | Skills |
| terminal · Console Log | `/dashboard/console-log` | Logs |
| computer · Remote | button | Remote |
| settings · Settings | `/dashboard/profile` | Profile/settings |

## 3. Providers Page (`/dashboard/providers`) — Anatomy
Layout: heading "Providers" → search box → "Donate"/theme/lang/menu buttons →
four provider **sections** (each a `heading level=2`), then a list of provider cards.

Each provider is a `<link>` to `/dashboard/providers/{id}` with:
- logo `<image>` (url `/providers/{id}.png`)
- `heading level=3` (provider display name)
- status text: `Ready` | `{N} Connected` | `No connections`
- a `switch` (free/OAuth providers) to enable/disable the connection.

### 3.1 Sections & current inventory (state captured 2026-07-12)
**Custom Providers (OpenAI/Anthropic Compatible)**
- Buttons: `Add Anthropic Compatible`, `Add OpenAI Compatible`.
- Currently: "No custom providers".

**OAuth Providers** (connect a free account via OAuth; all currently `No connections`):
`claude`, `antigravity`, `codex` (OpenAI Codex), `github` (GitHub Copilot),
`cursor`, `kilocode`, `cline`, `clinepass`, `codebuddy-cn`, `kimchi`,
`grok-cli` (Grok Build), `xai` (Grok).  → 12 OAuth providers, 0 connected.

**Free Tier Providers** (no API key / free account; toggle `switch` to enable):
- Connected (switch checked): `gemini-cli` (1), `openrouter` (1), `nvidia` (1), `ollama` (1)
- Ready (free, no account needed): `mimo-free`, `opencode`
- No connections (click to connect / enable): `kiro`, `qoder`, `vertex`,
  `gemini`, `cloudflare-ai`, `byteplus`

**API Key Providers** (need an API key added in the detail page; all `No connections`
except via their own keys). Full list (34):
`alicode`, `alicode-intl`, `anthropic`, `azure`, `blackbox`, `cerebras`, `chutes`,
`cohere`, `commandcode`, `deepseek`, `featherless`, `fireworks`, `glm-cn`, `glm`,
`groq`, `hyperbolic`, `kimi`, `minimax-cn`, `minimax`, `mistral`, `nebius`,
`ollama-local`, `openai`, `opencode-go`, `perplexity`, `perplexity-agent`,
`siliconflow`, `together`, `venice`, `vercel-ai-gateway`, `vertex-partner`,
`volcengine-ark`, `xiaomi-mimo`, `xiaomi-tokenplan`.

> Note: API Key section is initially truncated — click the `Show all NN providers`
> button (bottom of the section) to reveal all 34.

## 4. Provider Detail Page (`/dashboard/providers/{id}`) — Anatomy
This is where you ADD connections / accounts / keys / models.

Common elements:
- `Back to Providers` link.
- Provider logo + name + `Get API Key` external link.
- `Connections` section (`heading level=2`):
  - Each row: key name, `active` status, `API Key` (masked), optional error note
    (e.g. `[429]: ...`), `Edit` / `Delete` buttons, and an `active` `switch`.
  - `Add` button → opens a form to add a new API-key connection (paste key, name it).
  - `Test Connection One-by-One` button, `Round Robin` switch, `Select All` checkboxes.
- `Available Models` section (`heading level=2`):
  - `Thinking` level combobox (Auto/Low/Medium/High) for copied model-name suffix.
  - Each model row: model id (`provider/model`), capability tags
    (Reasoning / Vision), `Test` / `Copy` / `Remove` (`close`) buttons.
  - `Add Model` button → add a custom model id.
  - `Suggested free models (≥200k context)` block: one-click `add <model>` buttons
    that append free models to the Available Models list **without a new key**
    (uses the existing connection).

### 4.1 How to ADD models/providers (MCP playbook)
- **Expand free models on an already-connected API-key provider (e.g. OpenRouter):**
  open `/dashboard/providers/openrouter` → scroll to `Suggested free models` →
  click each `add <model>` button. These immediately appear in 9Router's `/v1/models`.
- **Add an API-key provider:** open its detail → `Add` in Connections → paste key →
  save. Many have free tiers (DeepSeek, Groq, Mistral, Cerebras, Fireworks,
  Hyperbolic, Together, SiliconFlow, etc.) → new free models appear.
- **Enable a Free-Tier provider:** open detail → toggle the `switch` on; if it needs
  an account, follow the on-page connect flow.
- **Connect an OAuth provider:** open detail → connect account (interactive OAuth
  login in a popup/redirect — requires real credentials; cannot be fully automated
  without the user's account).

## 5. Chrome DevTools MCP Interaction Patterns
- Prefer `navigate_page({type:"url", url:"http://localhost:20128/dashboard/providers/{id}"})`
  over clicking links — stable UIDs, no snapshot drift.
- After `navigate_page`, always `take_snapshot` to get fresh UIDs (UIDs change per load).
- Locate action buttons by their trailing label text, e.g.:
  - `button "add Add"` (add connection) — NOTE the snapshot shows `add Add` because
    the icon text "add" is concatenated with the label "Add".
  - `button "add <model>"` (suggested free model).
  - `switch` near a provider = enable/disable.
- Fill forms with `fill({uid, value})` then `click` the submit button.
- Login: `fill` password textbox → `click` "Login" button. If the click reports the
  element "no longer exists", re-`take_snapshot` (the SPA re-rendered) and click again.

## 6. Integration with knez-control-app
- 9Router is the free-model gateway for knez-control-app.
- `src/services/router/NineRouterService.ts` polls `http://localhost:20128/v1/models`.
- `free_models.json` (repo root) is a snapshot of `/v1/models` (re-gather with
  `curl.exe http://localhost:20128/v1/models`).
- `src/features/models/ModelsPage.tsx` shows 9Router under a dedicated "9Router"
  sidebar section with nested providers; 9Router-sourced cards carry a "9Router" badge.
- Adding models in 9Router automatically surfaces them in the app after the 15s poll.

## 7. Change Log
- 2026-07-12 (2): Expanded OpenRouter free library via its detail page
  (`/dashboard/providers/openrouter` → "Suggested free models" one-click `add`
  buttons). Added 11 free models (lyria-3-clip-preview, qwen3-coder:free,
  nemotron-3-super-120b-a12b:free, hy3:free, laguna-xs-2.1:free, laguna-m.1:free,
  gemma-4-31b-it:free, north-mini-code:free, nemotron-3-nano-omni-30b-a3b-reasoning:free,
  nemotron-3-nano-30b-a3b:free, free). `free_models.json` regathered: 26 → 37 models.
  Confirms the §4.1 playbook works (no new key needed; uses existing "knez" connection).
- 2026-07-12 (1): Initial capture. Login password `123456`. v0.5.30. Full provider
  inventory + detail-page anatomy + MCP playbook documented. OpenRouter has 1
  existing connection ("knez"); free-tier connected: gemini-cli, openrouter,
  nvidia, ollama. All OAuth + most API-key providers are `No connections`.
